/**
 * routes/kpi.js — نظام متابعة الأداء الشهري
 * ──────────────────────────────────────────────────────────────
 *   POST   /entries                 — إدخال/تحديث قيمة شهرية (upsert)
 *   GET    /entries?year&month     — إدخالات شهر محدد
 *   GET    /matrix?year            — مصفوفة كاملة (heatmap)
 *   GET    /dashboard?year         — لوحة تنفيذية (بطاقات + ملخص)
 *   GET    /objective/:id?year     — تفاصيل مؤشر استراتيجي
 *   GET    /activity/:id?year      — تفاصيل نشاط تشغيلي
 *   GET    /alerts?year&month      — التنبيهات النشطة
 */
import express from 'express';
import { prisma } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { requireAction } from '../lib/permissions.js';
import { BadRequest, NotFound } from '../utils/errors.js';
import { evaluateKpi, expectedByMonth, actualByMonth, ragStatus, achievementRatio, forecastYearEnd, detectAlerts } from '../lib/kpi-engine.js';
import { createSchema as kpiCreateSchema } from '../schemas/kpiEntry.schema.js';
import { runSchema } from '../schemas/_helpers.js';
import { upsertKpiEntry, isPeriodLocked } from '../services/kpi.js';
import { recomputeAfterEntry } from '../services/rollup.js';
import { arabicSearchVariants } from '../utils/normalize.js';

const validateKpiEntry = runSchema(kpiCreateSchema);

const router = express.Router();
router.use(authenticate);

const currentMonth = () => new Date().getMonth() + 1;
const currentYear  = () => new Date().getFullYear();

// ─── upsert قيمة شهرية ────────────────────────────────────────
router.post('/entries', requireAction('kpi', 'update'), async (req, res, next) => {
  try {
    // Zod موحّد: يضمن الأنواع والمدى (year/month/actualValue) وينظف الحقول المجهولة
    const parsed = validateKpiEntry(req.body);
    if (parsed.objectiveId && parsed.activityId)
      throw BadRequest('حدّد objectiveId أو activityId — ليس الاثنين معاً');

    const result = await upsertKpiEntry({
      ...parsed,
      userId:   req.user.sub,
      userRole: req.user?.role,
    });
    res.json({ ok: true, ...result });
  } catch (e) { next(e); }
});

// ─── إدخال مُجمَّع (Bulk) — لصق CSV أو JSON بدلاً من صف-بصف ──
// يقبل: { rows: [{ objectiveId|activityId, year, month, actualValue, spent? }, ...] }
// يُنفَّذ upsert لكل صف بشكل متسلسل (لنفس سجل الأب يتم rollup مرة واحدة في الآخر).
// يُرجع { ok, inserted, failed:[{row, error}], rollup:{objectiveIds, activityIds} }.
router.post('/entries/bulk', requireAction('kpi', 'update'), async (req, res, next) => {
  try {
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : null;
    if (!rows || !rows.length) throw BadRequest('rows مطلوبة كمصفوفة غير فارغة');
    if (rows.length > 500) throw BadRequest('الحد الأقصى 500 صف في الدفعة الواحدة');

    const inserted = [];
    const failed = [];
    // نؤجّل rollup إلى النهاية لتفادي إعادة حسابات متكرّرة لنفس الأب
    const touchedObj = new Set();
    const touchedAct = new Set();
    const touchedYears = new Set();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const parsed = validateKpiEntry(row);
        if (parsed.objectiveId && parsed.activityId)
          throw BadRequest('حدّد objectiveId أو activityId — ليس الاثنين معاً');
        // استخدم upsertKpiEntry بـ skipRollup=true (سنعمل rollup دفعة واحدة)
        const result = await upsertKpiEntry({
          ...parsed,
          userId:   req.user.sub,
          userRole: req.user?.role,
          skipRollup: true,
        });
        inserted.push({ row: i, entryId: result.entry?.id });
        if (parsed.objectiveId) touchedObj.add(parsed.objectiveId);
        if (parsed.activityId)  touchedAct.add(parsed.activityId);
        touchedYears.add(parsed.year);
      } catch (e) {
        failed.push({ row: i, error: e.message || String(e) });
      }
    }

    // rollup واحد لكل أب × كل سنة تم لمسها
    const { recomputeObjective, recomputeActivity } = await import('../services/rollup.js');
    for (const objId of touchedObj) {
      for (const y of touchedYears) {
        try { await recomputeObjective(objId, { year: y }); } catch (err) { console.error('[bulk rollup obj]', err?.message); }
      }
    }
    for (const actId of touchedAct) {
      for (const y of touchedYears) {
        try { await recomputeActivity(actId, { year: y }); } catch (err) { console.error('[bulk rollup act]', err?.message); }
      }
    }

    res.json({
      ok: true,
      total: rows.length,
      inserted: inserted.length,
      failed,
      rollup: {
        objectiveIds: [...touchedObj],
        activityIds:  [...touchedAct],
        years: [...touchedYears],
      },
    });
  } catch (e) { next(e); }
});

// ─── معاينة قراءة قبل الحفظ (Wizard step 2) ──────────────────
// يحسب expected / ratio / rag / forecast / alerts بناءً على قيمة مُقترَحة
// دون كتابتها في DB — يُمكِّن UX على شكل "راجع قبل الحفظ".
router.post('/entries/preview', requireAction('kpi', 'read'), async (req, res, next) => {
  try {
    const parsed = validateKpiEntry(req.body);
    if (parsed.objectiveId && parsed.activityId)
      throw BadRequest('حدّد objectiveId أو activityId — ليس الاثنين معاً');
    const { objectiveId, activityId, year, month, actualValue, spent } = parsed;

    // السجل الأب (للحصول على kpiType/target/seasonality/direction)
    const kpiRec = objectiveId
      ? await prisma.objective.findUnique({ where: { id: objectiveId } })
      : await prisma.operationalActivity.findUnique({ where: { id: activityId } });
    if (!kpiRec) throw NotFound('المؤشر/النشاط غير موجود');

    // إدخالات السنة الحالية — مع تجاوز الشهر المعاين
    const existing = await prisma.kpiEntry.findMany({
      where:   objectiveId ? { objectiveId, year } : { activityId, year },
      orderBy: [{ month: 'asc' }],
    });
    const overlay = existing.filter(e => e.month !== month);
    overlay.push({ month, actualValue: Number(actualValue), spent: spent != null ? Number(spent) : null });
    overlay.sort((a, b) => a.month - b.month);

    const kpi = {
      kpiType: kpiRec.kpiType, seasonality: kpiRec.seasonality, direction: kpiRec.direction,
      targetValue: objectiveId ? kpiRec.target : kpiRec.targetValue,
      unit:        objectiveId ? kpiRec.unit   : kpiRec.targetUnit,
    };
    const ev = evaluateKpi(kpi, overlay, year, month);
    const lock = await isPeriodLocked(year, month);
    const RAG_MESSAGES = {
      GREEN:  '🎯 أداء مطابق للمستهدف',
      YELLOW: '⚠️ دون المستهدف — يحتاج متابعة',
      RED:    '🔴 انحراف كبير — يتطلب إجراء تصحيحي',
    };
    res.json({
      preview: true,
      locked: lock.locked,
      lockReason: lock.locked ? `مُغلَق باعتماد المراجعة ${lock.reviewCode}` : null,
      kpi: { kpiType: kpi.kpiType, targetValue: kpi.targetValue, unit: kpi.unit },
      evaluation: {
        expected: ev.expected, actual: ev.actual, ratio: ev.ratio, rag: ev.rag,
        forecast: ev.forecast, alerts: ev.alerts,
        message: RAG_MESSAGES[ev.rag] || '⚪ بيانات غير كافية',
      },
    });
  } catch (e) { next(e); }
});

// ─── حالة قفل الفترة ─────────────────────────────────────────
router.get('/period-lock', requireAction('kpi', 'read'), async (req, res, next) => {
  try {
    const year  = Number(req.query.year)  || currentYear();
    const month = Number(req.query.month) || currentMonth();
    const lock = await isPeriodLocked(year, month);
    res.json({ year, month, ...lock });
  } catch (e) { next(e); }
});

// ─── "ما المطلوب منّي هذا الشهر؟" ────────────────────────────
// يُرجع المؤشرات/الأنشطة التي يملكها المستخدم مع حالة إدخال الشهر الحالي.
router.get('/my-due', requireAction('kpi', 'read'), async (req, res, next) => {
  try {
    const year  = Number(req.query.year)  || currentYear();
    const month = Number(req.query.month) || currentMonth();
    const userId   = req.user.sub;
    const userName = req.user.name || '';

    const [objectives, activities, lock, user] = await Promise.all([
      prisma.objective.findMany({
        where: { deletedAt: null, ownerId: userId, status: { not: 'CANCELLED' } },
        include: { strategicGoal: { select: { title: true, perspective: true } }, kpiEntries: { where: { year } } },
      }),
      prisma.operationalActivity.findMany({
        where: {
          deletedAt: null, year, status: { not: 'CANCELLED' },
          OR: userName
            ? [
                { responsible: userName },
                // variants عربية (alef/yaa/taa-marbuta) — يطابق كتابات مختلفة للاسم نفسه
                ...arabicSearchVariants(userName).map(v => ({
                  responsible: { contains: v, mode: 'insensitive' },
                })),
              ]
            : [{ responsible: '___nomatch___' }],
        },
        include: { strategicGoal: { select: { title: true } }, kpiEntries: { where: { year } } },
      }),
      isPeriodLocked(year, month),
      prisma.user.findUnique({ where: { id: userId }, select: { role: true, name: true } }),
    ]);

    const buildItem = (rec, kind) => {
      const kpi = {
        kpiType: rec.kpiType, seasonality: rec.seasonality, direction: rec.direction,
        targetValue: kind === 'objective' ? rec.target : rec.targetValue,
        unit: kind === 'objective' ? rec.unit : rec.targetUnit,
      };
      const thisMonthEntry = rec.kpiEntries.find(e => e.month === month);
      const ev = evaluateKpi(kpi, rec.kpiEntries, year, month);
      return {
        kind, id: rec.id, code: rec.code, title: rec.title,
        perspective: rec.strategicGoal?.perspective || rec.perspective || '—',
        goalTitle: rec.strategicGoal?.title,
        kpiType: rec.kpiType, targetValue: kpi.targetValue, unit: kpi.unit,
        currentProgress: Number(rec.progress ?? 0),
        thisMonth: thisMonthEntry
          ? { actualValue: thisMonthEntry.actualValue, spent: thisMonthEntry.spent, enteredAt: thisMonthEntry.enteredAt, note: thisMonthEntry.note, evidenceUrl: thisMonthEntry.evidenceUrl, id: thisMonthEntry.id }
          : null,
        entered: !!thisMonthEntry,
        evaluation: ev,
      };
    };

    const objItems = objectives.map(o => buildItem(o, 'objective'));
    const actItems = activities.map(a => buildItem(a, 'activity'));
    const all = [...objItems, ...actItems];

    const pending = all.filter(x => !x.entered);
    const entered = all.filter(x => x.entered);

    res.json({
      year, month,
      user: { id: userId, name: user?.name, role: user?.role },
      periodLock: lock,
      summary: {
        total: all.length,
        pending: pending.length,
        entered: entered.length,
        red:    entered.filter(x => x.evaluation.rag === 'RED').length,
        yellow: entered.filter(x => x.evaluation.rag === 'YELLOW').length,
        green:  entered.filter(x => x.evaluation.rag === 'GREEN').length,
      },
      pending, entered,
    });
  } catch (e) { next(e); }
});

// ─── حذف إدخال ───────────────────────────────────────────────
router.delete('/entries/:id', requireAction('kpi', 'update'), async (req, res, next) => {
  try {
    // نلتقط الأب/السنة قبل الحذف لإعادة الحساب بعده
    const entry = await prisma.kpiEntry.findUnique({
      where: { id: req.params.id },
      select: { objectiveId: true, activityId: true, year: true },
    });
    await prisma.kpiEntry.delete({ where: { id: req.params.id } });
    if (entry) {
      try { await recomputeAfterEntry(entry); } catch (err) {
        console.error('[kpi] rollup after delete failed:', err?.message || err);
      }
    }
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ─── إدخالات شهر محدد ────────────────────────────────────────
router.get('/entries', requireAction('kpi', 'read'), async (req, res, next) => {
  try {
    const year = Number(req.query.year) || currentYear();
    const month = req.query.month ? Number(req.query.month) : undefined;
    const where = { year, ...(month ? { month } : {}) };
    const entries = await prisma.kpiEntry.findMany({
      where,
      include: {
        objective: { select: { id: true, title: true } },
        activity:  { select: { id: true, code: true, title: true } },
        enteredBy: { select: { name: true } },
      },
      orderBy: [{ year: 'asc' }, { month: 'asc' }],
    });
    res.json({ ok: true, items: entries, total: entries.length });
  } catch (e) { next(e); }
});

// ─── helpers ─────────────────────────────────────────────────
async function getObjectivesWithEntries(year) {
  const objectives = await prisma.objective.findMany({
    include: {
      strategicGoal: { select: { title: true, perspective: true } },
      kpiEntries: { where: { year }, orderBy: [{ month: 'asc' }] },
    },
  });
  return objectives.map(o => ({
    id: o.id, code: o.code, title: o.title,
    perspective: o.strategicGoal?.perspective || '—',
    goalTitle: o.strategicGoal?.title,
    kpi: o.kpi,
    kpiType: o.kpiType, seasonality: o.seasonality, direction: o.direction,
    targetValue: o.target, unit: o.unit,
    ownerId: o.ownerId, departmentId: o.departmentId, status: o.status,
    entries: o.kpiEntries,
  }));
}
async function getActivitiesWithEntries(year) {
  const activities = await prisma.operationalActivity.findMany({
    where: { year },
    include: {
      strategicGoal: { select: { title: true } },
      kpiEntries: { where: { year }, orderBy: [{ month: 'asc' }] },
    },
  });
  return activities.map(a => ({
    id: a.id, code: a.code, title: a.title, description: a.description,
    perspective: a.perspective,
    goalTitle: a.strategicGoal?.title,
    kpiType: a.kpiType, seasonality: a.seasonality, direction: a.direction,
    targetValue: a.targetValue, unit: a.targetUnit,
    budget: a.budget,
    responsible: a.responsible, status: a.status,
    entries: a.kpiEntries,
  }));
}

// ── Smart filter chips للمؤشرات (quick=mine,red,behind...) ────────
// كل مرشّح predicate على كائن مُقيَّم (kpi مُرفَق مع evaluation).
// req: لتمرير معلومات المستخدم. month: لتحديد "missing".
export const KPI_SMART_FILTERS = {
  // الملكية
  mine: (k, req) => {
    if (k.kind === 'objective') return k.ownerId === req.user.sub;
    const name = (req.user.name || '').trim();
    return name && typeof k.responsible === 'string' && k.responsible.includes(name);
  },
  myDept: (k, req) =>
    k.kind === 'objective' && req.user.departmentId
      ? k.departmentId === req.user.departmentId
      : false,

  // الحالة (evaluation.rag)
  red:     (k) => k.rag === 'RED',
  yellow:  (k) => k.rag === 'YELLOW',
  green:   (k) => k.rag === 'GREEN',
  gray:    (k) => k.rag === 'GRAY',

  // الأداء الكمّي
  behind:  (k) => k.ratio != null && k.ratio < 0.7,
  ahead:   (k) => k.ratio != null && k.ratio >= 1.0,

  // قراءات الشهر الحالي
  missing: (k, _req, ctx) => !k.entries.some(e => e.month === ctx.month),
  entered: (k, _req, ctx) =>  k.entries.some(e => e.month === ctx.month),

  // تنبيهات
  criticalAlerts: (k) =>
    Array.isArray(k.alerts) && k.alerts.some(a => a.severity === 'CRITICAL'),

  // محاور BSC (perspective=X عبر param خاص)
  // (يتحقَّق في الكود عبر req.query.perspective وليس quick)
};

function applyKpiQuick(items, req, month) {
  const raw = String(req.query.quick || '').trim();
  const keys = raw.split(',').map(s => s.trim()).filter(Boolean);
  const ctx = { month };
  let out = items;
  for (const key of keys) {
    const fn = KPI_SMART_FILTERS[key];
    if (fn) out = out.filter(k => fn(k, req, ctx));
  }
  const perspective = String(req.query.perspective || '').trim();
  if (perspective) out = out.filter(k => (k.perspective || '') === perspective);
  return out;
}

function computeKpiCounts(items, req, month) {
  const counts = {};
  const ctx = { month };
  for (const [key, fn] of Object.entries(KPI_SMART_FILTERS)) {
    try { counts[key] = items.filter(k => fn(k, req, ctx)).length; }
    catch { counts[key] = 0; }
  }
  return counts;
}

// ─── مصفوفة (heatmap) ────────────────────────────────────────
// يدعم Smart Filters عبر ?quick=mine,red,behind,missing,criticalAlerts,...
// + ?perspective=<محور BSC>. يُرجع counts لكل مرشّح (للـ chips في الواجهة).
router.get('/matrix', requireAction('kpi', 'read'), async (req, res, next) => {
  try {
    const year = Number(req.query.year) || currentYear();
    const month = Number(req.query.month) || currentMonth();
    const [objectives, activities] = await Promise.all([
      getObjectivesWithEntries(year), getActivitiesWithEntries(year),
    ]);
    const build = (list, kind) => list.map(k => {
      const ev = evaluateKpi(k, k.entries, year, month);
      const monthCells = Array.from({ length: 12 }, (_, i) => {
        const e = k.entries.find(x => x.month === i + 1);
        if (!e) return { month: i+1, actualValue: null, status: 'GRAY' };
        const exp = expectedByMonth(k, i+1);
        const act = actualByMonth(k, k.entries, i+1);
        const r = achievementRatio(k, act, exp);
        return { month: i+1, actualValue: e.actualValue, spent: e.spent, status: ragStatus(r) };
      });
      return {
        kind, id: k.id, code: k.code, title: k.title,
        perspective: k.perspective, kpiType: k.kpiType,
        targetValue: k.targetValue, unit: k.unit,
        ownerId: k.ownerId, departmentId: k.departmentId,
        responsible: k.responsible,
        entries: k.entries,
        ...ev, months: monthCells,
      };
    });
    const allObjectives = build(objectives, 'objective');
    const allActivities = build(activities, 'activity');
    const all = [...allObjectives, ...allActivities];

    // counts قبل التمرير — يستخدمها الـ UI لعرض chips حتى لو المرشّح مُفعَّل
    const counts = {
      total: all.length,
      ...computeKpiCounts(all, req, month),
    };

    // قائمة المحاور الفريدة (لعرض filter dropdown)
    const perspectives = [...new Set(all.map(k => k.perspective).filter(Boolean))];

    const filteredObj = applyKpiQuick(allObjectives, req, month);
    const filteredAct = applyKpiQuick(allActivities, req, month);

    res.json({
      year, month,
      objectives: filteredObj,
      activities: filteredAct,
      counts,
      perspectives,
      activeQuick: String(req.query.quick || '').split(',').filter(Boolean),
      activePerspective: req.query.perspective || null,
    });
  } catch (e) { next(e); }
});

// ─── لوحة تنفيذية ───────────────────────────────────────────
router.get('/dashboard', requireAction('kpi', 'read'), async (req, res, next) => {
  try {
    const year = Number(req.query.year) || currentYear();
    const month = Number(req.query.month) || currentMonth();
    const [objectives, activities] = await Promise.all([
      getObjectivesWithEntries(year), getActivitiesWithEntries(year),
    ]);
    const all = [...objectives.map(o=>({...o,kind:'objective'})), ...activities.map(a=>({...a,kind:'activity'}))]
      .map(k => ({ ...k, evaluation: evaluateKpi(k, k.entries, year, month) }));

    // تجميع حسب المحور
    const byPerspective = {};
    for (const k of all) {
      const p = k.perspective || '—';
      byPerspective[p] = byPerspective[p] || { perspective: p, total: 0, green: 0, yellow: 0, red: 0, gray: 0, avgRatio: 0, criticalAlerts: 0 };
      const bp = byPerspective[p];
      bp.total++;
      const rag = k.evaluation.rag;
      bp[rag.toLowerCase()]++;
      if (k.evaluation.ratio != null) bp.avgRatio += Math.min(k.evaluation.ratio, 2);
      bp.criticalAlerts += k.evaluation.alerts.filter(a=>a.severity==='CRITICAL').length;
    }
    Object.values(byPerspective).forEach(bp => {
      bp.avgRatio = bp.total ? +(bp.avgRatio / bp.total).toFixed(3) : 0;
    });

    // Top variances (أسوأ 10 مؤشرات)
    const topVariances = [...all]
      .filter(k => k.evaluation.ratio != null)
      .sort((a,b) => a.evaluation.ratio - b.evaluation.ratio)
      .slice(0, 10)
      .map(k => ({
        kind: k.kind, id: k.id, code: k.code, title: k.title,
        perspective: k.perspective, targetValue: k.targetValue, unit: k.unit,
        actual: k.evaluation.actual, expected: k.evaluation.expected,
        ratio: k.evaluation.ratio, rag: k.evaluation.rag,
        forecast: k.evaluation.forecast,
      }));

    // إجمالي التنبيهات
    const allAlerts = all.flatMap(k => k.evaluation.alerts.map(a => ({
      ...a, kind: k.kind, id: k.id, code: k.code, title: k.title,
    })));

    // إجمالي الميزانية والصرف (نشاطات فقط)
    const totalBudget = activities.reduce((s,a)=>s+Number(a.budget||0), 0);
    const totalSpent  = activities.reduce((s,a)=>s+a.entries.reduce((ss,e)=>ss+Number(e.spent||0), 0), 0);

    res.json({
      year, month,
      perspectives: Object.values(byPerspective),
      summary: {
        totalObjectives: objectives.length,
        totalActivities: activities.length,
        green: all.filter(k=>k.evaluation.rag==='GREEN').length,
        yellow: all.filter(k=>k.evaluation.rag==='YELLOW').length,
        red: all.filter(k=>k.evaluation.rag==='RED').length,
        gray: all.filter(k=>k.evaluation.rag==='GRAY').length,
        criticalAlertsCount: allAlerts.filter(a=>a.severity==='CRITICAL').length,
        warningAlertsCount: allAlerts.filter(a=>a.severity==='WARNING' || a.severity==='HIGH').length,
        totalBudget, totalSpent,
        spentRatio: totalBudget ? +(totalSpent/totalBudget).toFixed(3) : 0,
      },
      topVariances,
      alerts: allAlerts.slice(0, 50),
    });
  } catch (e) { next(e); }
});

// ─── التنبيهات ──────────────────────────────────────────────
router.get('/alerts', requireAction('kpi', 'read'), async (req, res, next) => {
  try {
    const year = Number(req.query.year) || currentYear();
    const month = Number(req.query.month) || currentMonth();
    const [objectives, activities] = await Promise.all([
      getObjectivesWithEntries(year), getActivitiesWithEntries(year),
    ]);
    const all = [
      ...objectives.map(o=>({...o,kind:'objective'})),
      ...activities.map(a=>({...a,kind:'activity'})),
    ];
    const alerts = [];
    for (const k of all) {
      const list = detectAlerts(k, k.entries, year, month);
      for (const a of list) {
        alerts.push({ ...a, kind: k.kind, id: k.id, code: k.code, title: k.title, perspective: k.perspective });
      }
    }
    const order = { CRITICAL: 0, HIGH: 1, WARNING: 2, INFO: 3 };
    alerts.sort((a,b) => (order[a.severity]||9) - (order[b.severity]||9));
    res.json({ year, month, alerts });
  } catch (e) { next(e); }
});

// ─── تفاصيل مؤشر أو نشاط ───────────────────────────────────
router.get('/:kind(objective|activity)/:id', requireAction('kpi', 'read'), async (req, res, next) => {
  try {
    const { kind, id } = req.params;
    const year = Number(req.query.year) || currentYear();
    const month = Number(req.query.month) || currentMonth();

    let rec, entries;
    if (kind === 'objective') {
      rec = await prisma.objective.findUnique({
        where: { id }, include: { strategicGoal: { select: { title: true, perspective: true } } },
      });
      if (!rec) throw NotFound('مؤشر غير موجود');
      entries = await prisma.kpiEntry.findMany({ where: { objectiveId: id, year }, orderBy: [{ month: 'asc' }] });
    } else {
      rec = await prisma.operationalActivity.findUnique({
        where: { id }, include: { strategicGoal: { select: { title: true } } },
      });
      if (!rec) throw NotFound('نشاط غير موجود');
      entries = await prisma.kpiEntry.findMany({ where: { activityId: id, year }, orderBy: [{ month: 'asc' }] });
    }

    const kpi = {
      kpiType: rec.kpiType,
      targetValue: kind === 'objective' ? rec.target : rec.targetValue,
      unit: kind === 'objective' ? rec.unit : rec.targetUnit,
      seasonality: rec.seasonality,
      direction: rec.direction,
      budget: rec.budget,
    };
    const evaluation = evaluateKpi(kpi, entries, year, month);

    // سلسلة زمنية: متوقع/فعلي شهرياً
    const series = Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const entry = entries.find(e => e.month === m);
      const exp = expectedByMonth(kpi, m);
      const act = actualByMonth(kpi, entries, m);
      const r = achievementRatio(kpi, act, exp);
      return {
        month: m,
        expected: exp,
        actual: entry ? Number(entry.actualValue) : null,
        cumulativeActual: act,
        spent: entry ? Number(entry.spent || 0) : null,
        status: ragStatus(r),
        evidenceUrl: entry?.evidenceUrl,
        note: entry?.note,
      };
    });

    res.json({ kind, record: rec, kpi, evaluation, series, year, month });
  } catch (e) { next(e); }
});

export default router;
