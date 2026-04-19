/**
 * services/kpi.js — خدمات قراءات KPI الشهرية (ISO 9.1 / 9.3).
 *
 * المرحلة 2 — Service Layer.
 *   ▸ isPeriodLocked       — هل فترة مُغلَقة بمراجعة إدارية مكتملة؟
 *   ▸ upsertKpiEntry       — upsert مع كل الحراسات + feedback فوري
 *   ▸ computeKpiFeedback   — تقييم سريع للقراءة (expected/ratio/rag/alerts)
 */
import { prisma } from '../db.js';
import { BadRequest } from '../utils/errors.js';
import { evaluateKpi } from '../lib/kpi-engine.js';
import { recomputeAfterEntry } from './rollup.js';

/**
 * هل هذا الشهر/السنة مُغلَق بسبب مراجعة إدارية مكتملة تغطّي هذه الفترة؟
 * ISO 9.3: بعد اعتماد المراجعة الإدارية لفترة معينة، تُجمَّد بياناتها.
 */
export async function isPeriodLocked(year, month) {
  const endOfMonth = new Date(year, month, 0, 23, 59, 59);
  const review = await prisma.managementReview.findFirst({
    where:   { status: 'COMPLETED', meetingDate: { gt: endOfMonth } },
    orderBy: { meetingDate: 'asc' },
    select:  { id: true, meetingDate: true, code: true },
  });
  return review
    ? { locked: true, reviewId: review.id, reviewCode: review.code, reviewDate: review.meetingDate }
    : { locked: false };
}

const RAG_MESSAGES = {
  GREEN:  '🎯 أداء مطابق للمستهدف',
  YELLOW: '⚠️ دون المستهدف — يحتاج متابعة',
  RED:    '🔴 انحراف كبير — يتطلب إجراء تصحيحي',
};

/**
 * computeKpiFeedback — ردّ فوري على إدخال قراءة (expected/actual/ratio/rag).
 * Silent-fail: يُرجع null إذا لم يعثر على السجل الأب أو فشل الحساب.
 */
export async function computeKpiFeedback({ objectiveId, activityId, year, month }) {
  try {
    const kpiRec = objectiveId
      ? await prisma.objective.findUnique({ where: { id: objectiveId } })
      : await prisma.operationalActivity.findUnique({ where: { id: activityId } });
    if (!kpiRec) return null;

    const allEntries = await prisma.kpiEntry.findMany({
      where:   objectiveId ? { objectiveId, year } : { activityId, year },
      orderBy: [{ month: 'asc' }],
    });
    const kpi = {
      kpiType:     kpiRec.kpiType,
      seasonality: kpiRec.seasonality,
      direction:   kpiRec.direction,
      targetValue: objectiveId ? kpiRec.target : kpiRec.targetValue,
      unit:        objectiveId ? kpiRec.unit   : kpiRec.targetUnit,
    };
    const ev = evaluateKpi(kpi, allEntries, year, month);
    return {
      expected: ev.expected, actual: ev.actual, ratio: ev.ratio, rag: ev.rag,
      forecast: ev.forecast, alerts: ev.alerts,
      message:  RAG_MESSAGES[ev.rag] || '⚪ بيانات غير كافية',
    };
  } catch {
    return null;
  }
}

/**
 * upsertKpiEntry — يمر من كل الحراسات ثم يُحدِّث/يُنشئ القراءة.
 * يُرجع: { entry, feedback, locked }
 */
export async function upsertKpiEntry({
  objectiveId, activityId, year, month,
  actualValue, spent, note, evidenceUrl,
  userId, userRole, skipRollup = false,
}) {
  // منع الإدخال على شهر في المستقبل
  const now = new Date();
  if (year > now.getFullYear() || (year === now.getFullYear() && month > now.getMonth() + 1)) {
    throw BadRequest('لا يمكن إدخال قراءة لشهر في المستقبل');
  }

  // منع الإدخال على فترة مُغلَقة بمراجعة إدارية (إلا SUPER_ADMIN)
  const lock = await isPeriodLocked(year, month);
  if (lock.locked && userRole !== 'SUPER_ADMIN') {
    const dateAr = new Date(lock.reviewDate).toLocaleDateString('ar-SA');
    throw BadRequest(
      `هذا الشهر مُغلَق باعتماد المراجعة الإدارية ${lock.reviewCode} (${dateAr}). لا يمكن التعديل عليه.`,
    );
  }

  const where = objectiveId
    ? { objectiveId_year_month: { objectiveId, year, month } }
    : { activityId_year_month:  { activityId,  year, month } };

  const data = {
    objectiveId: objectiveId || null,
    activityId:  activityId  || null,
    year, month,
    actualValue: Number(actualValue),
    spent:       spent != null ? Number(spent) : null,
    note:        note || null,
    evidenceUrl: evidenceUrl || null,
    enteredById: userId,
  };
  const entry = await prisma.kpiEntry.upsert({ where, update: data, create: data });

  // ── Auto rollup: يُحدِّث progress الأب + جذر الخطة الاستراتيجية ─────
  // يُشَغَّل بعد الـ upsert مباشرةً. لا نكسر الـ request لو فشل (نسجّل فقط).
  let rollup = null;
  if (!skipRollup) {
    try {
      rollup = await recomputeAfterEntry({ objectiveId, activityId, year });
    } catch (err) {
      console.error('[kpi] rollup failed:', err?.message || err);
    }
  }

  const feedback = await computeKpiFeedback({ objectiveId, activityId, year, month });
  return { entry, feedback, rollup, locked: lock.locked };
}
