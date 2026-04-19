/**
 * services/rollup.js — سلسلة التحديث التلقائي (Auto Rollup).
 *
 *   KpiEntry  →  Objective / OperationalActivity  →  StrategicGoal
 *
 * لمّا يُدخل موظف قراءة شهرية، تُستدعى هذه الخدمة فتُحدّث:
 *   (1) القيمة الفعلية للأب (Objective.currentValue / OperationalActivity.spent)
 *   (2) نسبة التقدّم progress % — باستخدام محرّك KPI الموجود (يحترم kpiType/direction)
 *   (3) progress الخطة الاستراتيجية = متوسط progress أبنائها
 *
 * نموذج الحساب (Option C — ذكي حسب kpiType):
 *   - CUMULATIVE  → مجموع القراءات حتى الآن
 *   - PERIODIC    → متوسط نسب التحقيق × الهدف
 *   - SNAPSHOT    → آخر قراءة
 *   - BINARY      → 0 أو 1
 * ثم progress = clamp(achievementRatio(actual, target) × 100, 0, 100)
 *  ← الاتجاه HIGHER_BETTER / LOWER_BETTER مُعالج في achievementRatio.
 *
 * Idempotent وقابلة للتشغيل بلا داعٍ (re-run آمن).
 */
import { prisma } from '../db.js';
import { actualByMonth, achievementRatio } from '../lib/kpi-engine.js';

const clampPct = (x) => {
  if (x == null || isNaN(x)) return 0;
  return Math.max(0, Math.min(100, Math.round(x)));
};

/**
 * يحسب { actual, progress } من قراءات سنة واحدة لكيان KPI (Objective/Activity).
 * يُرجع null إذا لم يكن هناك هدف صالح أو لا توجد قراءات.
 */
export function computeProgressFromEntries({ kpiType, seasonality, direction, target }, entries) {
  if (!target || target <= 0) return { actual: null, progress: 0 };
  if (!entries || !entries.length) return { actual: null, progress: 0 };
  const kpi = {
    kpiType:     kpiType     || 'SNAPSHOT',
    seasonality: seasonality || 'UNIFORM',
    direction:   direction   || 'HIGHER_BETTER',
    targetValue: Number(target),
  };
  // currentMonth=12 → الحساب يأخذ كل القراءات المتوفّرة للسنة
  const actual = actualByMonth(kpi, entries, 12);
  if (actual == null) return { actual: null, progress: 0 };
  // النسبة مقابل الهدف النهائي (ليس الهدف المتوقع بالتوزيع الشهري)
  const ratio = achievementRatio(kpi, actual, kpi.targetValue);
  const pct = ratio == null ? 0 : ratio * 100;
  return { actual, progress: clampPct(pct) };
}

/**
 * يُعيد حساب progress للهدف التشغيلي Objective ثم يُحدّث StrategicGoal إن وُجد.
 */
export async function recomputeObjective(objectiveId, { year } = {}) {
  if (!objectiveId) return null;
  const obj = await prisma.objective.findUnique({
    where: { id: objectiveId },
    select: { id: true, kpiType: true, seasonality: true, direction: true, target: true, strategicGoalId: true },
  });
  if (!obj) return null;
  const y = year || new Date().getFullYear();
  const entries = await prisma.kpiEntry.findMany({
    where: { objectiveId, year: y },
    orderBy: { month: 'asc' },
    select: { month: true, actualValue: true, spent: true },
  });
  const { actual, progress } = computeProgressFromEntries(
    { kpiType: obj.kpiType, seasonality: obj.seasonality, direction: obj.direction, target: obj.target },
    entries,
  );
  await prisma.objective.update({
    where: { id: obj.id },
    data:  { currentValue: actual, progress },
  });
  if (obj.strategicGoalId) await recomputeStrategicGoal(obj.strategicGoalId);
  return { objectiveId: obj.id, currentValue: actual, progress, strategicGoalId: obj.strategicGoalId };
}

/**
 * يُعيد حساب progress للنشاط التشغيلي OperationalActivity + تجميع spent من القراءات.
 */
export async function recomputeActivity(activityId, { year } = {}) {
  if (!activityId) return null;
  const act = await prisma.operationalActivity.findUnique({
    where: { id: activityId },
    select: { id: true, kpiType: true, seasonality: true, direction: true, targetValue: true, strategicGoalId: true },
  });
  if (!act) return null;
  const y = year || new Date().getFullYear();
  const entries = await prisma.kpiEntry.findMany({
    where: { activityId, year: y },
    orderBy: { month: 'asc' },
    select: { month: true, actualValue: true, spent: true },
  });
  const { progress } = computeProgressFromEntries(
    { kpiType: act.kpiType, seasonality: act.seasonality, direction: act.direction, target: act.targetValue },
    entries,
  );
  // تجميع المصروف الفعلي من كل قراءات هذه السنة
  const totalSpent = entries.reduce((s, e) => s + Number(e.spent || 0), 0);
  await prisma.operationalActivity.update({
    where: { id: act.id },
    data:  { progress, spent: totalSpent > 0 ? totalSpent : null },
  });
  if (act.strategicGoalId) await recomputeStrategicGoal(act.strategicGoalId);
  return { activityId: act.id, progress, spent: totalSpent, strategicGoalId: act.strategicGoalId };
}

/**
 * يُعيد حساب progress للهدف الاستراتيجي = متوسط progress لأبنائه المباشرين.
 * (Objectives + OperationalActivities). يتجاهل المحذوفة (soft delete).
 */
export async function recomputeStrategicGoal(strategicGoalId) {
  if (!strategicGoalId) return null;
  const [objs, acts] = await Promise.all([
    prisma.objective.findMany({
      where: { strategicGoalId, deletedAt: null },
      select: { progress: true },
    }),
    prisma.operationalActivity.findMany({
      where: { strategicGoalId, deletedAt: null },
      select: { progress: true },
    }),
  ]);
  const children = [...objs, ...acts];
  if (!children.length) {
    // لا أبناء → لا نعدّل (يحافظ على أي قيمة يدوية)
    return { strategicGoalId, progress: null, childrenCount: 0 };
  }
  const avg = Math.round(children.reduce((s, x) => s + (x.progress || 0), 0) / children.length);
  await prisma.strategicGoal.update({
    where: { id: strategicGoalId },
    data:  { progress: clampPct(avg) },
  });
  return { strategicGoalId, progress: avg, childrenCount: children.length };
}

/**
 * Entry-point — تُستدعى بعد upsert/delete لـ KpiEntry.
 * تُعيد حساب الأب (Objective أو Activity) ثم الجذر الاستراتيجي.
 */
export async function recomputeAfterEntry({ objectiveId, activityId, year } = {}) {
  if (objectiveId) return await recomputeObjective(objectiveId, { year });
  if (activityId)  return await recomputeActivity(activityId,  { year });
  return null;
}
