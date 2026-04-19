/**
 * routes/dataHealth.js — تقرير صحة البيانات المؤسسية (Batch 13)
 *
 *   GET /api/data-health                   — كل الفحوصات مجمّعة
 *   GET /api/data-health/:check            — تفاصيل فحص واحد
 *
 * يكشف السجلات الناقصة/المتباينة التي قد تنفذ من خلال التحقق الفردي
 * (أهداف بلا مؤشرات، شكاوى بلا مسؤول، NCR بلا إجراء، وثائق بلا إقرارات…).
 *
 * الصلاحيات: QUALITY_MANAGER فأعلى (تقرير إشرافي).
 */
import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAction } from '../lib/permissions.js';
import { NotFound } from '../utils/errors.js';
import { activeWhere } from '../lib/dataHelpers.js';
import { scanSla } from '../lib/sla.js';
import { needsReview, reviewDueDate, REVIEW_INTERVAL } from '../lib/beneficiaryAssessment.js';

const router = Router();

// ─── أدوات داخلية ────────────────────────────────────────────
const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);
const SEV = { CRITICAL: 0, HIGH: 1, WARNING: 2, INFO: 3 };

// ─── الفحوصات (detectors) ───────────────────────────────────
// كل detector: async fn() => { key, title, severity, count, items: [{id, code?, title, reason}], hint }

const detectors = {
  /* 1) أهداف بلا مؤشرات (kpiEntries = 0 هذا العام) */
  async objectivesWithoutReadings() {
    const year = new Date().getFullYear();
    const list = await prisma.objective.findMany({
      where: activeWhere({ status: { notIn: ['CANCELLED', 'ACHIEVED'] } }),
      include: { kpiEntries: { where: { year }, select: { id: true } } },
    });
    const items = list.filter(o => o.kpiEntries.length === 0).map(o => ({
      id: o.id, code: o.code, title: o.title,
      reason: `لا توجد أي قراءة KPI لعام ${year}`,
      actionUrl: `/#/objectives?id=${o.id}`,
    }));
    return {
      key: 'objectivesWithoutReadings',
      title: 'أهداف بلا قراءات KPI هذا العام',
      severity: items.length ? 'HIGH' : 'INFO',
      count: items.length,
      items,
      hint: 'افتح كل هدف وأضف قراءات شهرية، أو أرفق مؤشر تكميلي.',
    };
  },

  /* 2) أهداف بلا مالك */
  async objectivesWithoutOwner() {
    const rows = await prisma.objective.findMany({
      where: activeWhere({ ownerId: null, status: { notIn: ['CANCELLED', 'ACHIEVED'] } }),
      select: { id: true, code: true, title: true },
    });
    return {
      key: 'objectivesWithoutOwner',
      title: 'أهداف بلا مالك معيَّن',
      severity: rows.length ? 'HIGH' : 'INFO',
      count: rows.length,
      items: rows.map(r => ({ ...r, reason: 'ownerId = null', actionUrl: `/#/objectives?id=${r.id}` })),
      hint: 'كل هدف يجب أن يكون له مالك مسؤول عن قراءاته (ISO 6.2.2).',
    };
  },

  /* 3) مؤشرات بدون قراءة حديثة (آخر قراءة > 60 يوم) */
  async staleKpiReadings() {
    const cutoff = daysAgo(60);
    const year = new Date().getFullYear();
    const [objs, acts] = await Promise.all([
      prisma.objective.findMany({
        where: activeWhere({ status: { notIn: ['CANCELLED', 'ACHIEVED'] } }),
        include: { kpiEntries: { orderBy: { enteredAt: 'desc' }, take: 1 } },
      }),
      prisma.operationalActivity.findMany({
        where: activeWhere({ year, status: { notIn: ['CANCELLED', 'COMPLETED'] } }),
        include: { kpiEntries: { orderBy: { enteredAt: 'desc' }, take: 1 } },
      }),
    ]);
    const items = [];
    for (const o of objs) {
      const last = o.kpiEntries[0];
      if (last && last.enteredAt < cutoff) {
        items.push({
          id: o.id, code: o.code, title: o.title,
          reason: `آخر قراءة قبل ${Math.round((Date.now() - new Date(last.enteredAt)) / 86400000)} يوم`,
          actionUrl: `/#/objectives?id=${o.id}`,
        });
      }
    }
    for (const a of acts) {
      const last = a.kpiEntries[0];
      if (last && last.enteredAt < cutoff) {
        items.push({
          id: a.id, code: a.code, title: a.title,
          reason: `آخر قراءة قبل ${Math.round((Date.now() - new Date(last.enteredAt)) / 86400000)} يوم`,
          actionUrl: `/#/operationalActivities?id=${a.id}`,
        });
      }
    }
    return {
      key: 'staleKpiReadings',
      title: 'مؤشرات بلا قراءة حديثة (> 60 يوم)',
      severity: items.length ? 'WARNING' : 'INFO',
      count: items.length,
      items,
      hint: 'القراءات القديمة تُخفي تدهوراً محتملاً. أدخل قراءة الشهر الحالي.',
    };
  },

  /* 4) شكاوى بلا مسؤول */
  async complaintsWithoutAssignee() {
    const rows = await prisma.complaint.findMany({
      where: activeWhere({ assigneeId: null, status: { notIn: ['CLOSED', 'RESOLVED'] } }),
      select: { id: true, code: true, subject: true, receivedAt: true },
    });
    return {
      key: 'complaintsWithoutAssignee',
      title: 'شكاوى مفتوحة بلا مسؤول',
      severity: rows.length ? 'CRITICAL' : 'INFO',
      count: rows.length,
      items: rows.map(r => ({
        id: r.id, code: r.code, title: r.subject,
        reason: `بلا assignee منذ ${new Date(r.receivedAt).toLocaleDateString('ar-SA')}`,
        actionUrl: `/#/complaints?id=${r.id}`,
      })),
      hint: 'عيِّن مسؤولاً لكل شكوى مفتوحة حتى يمكن متابعتها.',
    };
  },

  /* 5) NCR بلا إجراء تصحيحي (تجاوز مرحلة ROOT_CAUSE بلا actionPlan) */
  async ncrsWithoutAction() {
    const rows = await prisma.nCR.findMany({
      where: activeWhere({
        status: { in: ['ACTION_PLANNED', 'IN_PROGRESS', 'VERIFICATION'] },
        OR: [{ correctiveAction: null }, { correctiveAction: '' }],
      }),
      select: { id: true, code: true, title: true, status: true },
    });
    return {
      key: 'ncrsWithoutAction',
      title: 'NCR في مرحلة التنفيذ بلا إجراء تصحيحي موثّق',
      severity: rows.length ? 'CRITICAL' : 'INFO',
      count: rows.length,
      items: rows.map(r => ({
        id: r.id, code: r.code, title: r.title,
        reason: `الحالة: ${r.status} — correctiveAction فارغ`,
        actionUrl: `/#/ncr?id=${r.id}`,
      })),
      hint: 'ISO 10.2: كل NCR بعد تحديد السبب يجب أن يكون له إجراء تصحيحي موثّق.',
    };
  },

  /* 6) NCR مغلقة بلا تحقق من الفعالية */
  async ncrsClosedWithoutEffectiveness() {
    const rows = await prisma.nCR.findMany({
      where: activeWhere({ status: 'CLOSED', OR: [{ effective: null }, { effective: false }] }),
      select: { id: true, code: true, title: true, effective: true },
      take: 50,
    });
    return {
      key: 'ncrsClosedWithoutEffectiveness',
      title: 'NCR مغلقة دون تأكيد فعالية الإجراء',
      severity: rows.length ? 'HIGH' : 'INFO',
      count: rows.length,
      items: rows.map(r => ({
        id: r.id, code: r.code, title: r.title,
        reason: r.effective === null ? 'لم يُقيَّم بعد' : 'مُقيَّم كغير فعال',
        actionUrl: `/#/ncr?id=${r.id}`,
      })),
      hint: 'ISO 10.2: بعد الإغلاق، يجب التحقق من فعالية الإجراء (خلال 30-90 يوم).',
    };
  },

  /* 7) وثائق منشورة بلا إقرارات كافية */
  async publishedDocsLowAcks() {
    const docs = await prisma.document.findMany({
      where: activeWhere({ status: 'PUBLISHED' }),
      include: { _count: { select: { acks: true } } },
    });
    const items = docs
      .filter(d => (d._count?.acks || 0) < 3)
      .map(d => ({
        id: d.id, code: d.code, title: d.title,
        reason: `${d._count.acks || 0} إقرارات فقط`,
        actionUrl: `/#/documents?id=${d.id}`,
      }));
    return {
      key: 'publishedDocsLowAcks',
      title: 'وثائق منشورة بإقرارات قراءة قليلة (< 3)',
      severity: items.length ? 'WARNING' : 'INFO',
      count: items.length,
      items,
      hint: 'ISO 7.5.3: تأكد أن الوثائق المنشورة تصل للمعنيين وتُقرّ.',
    };
  },

  /* 8) استبيانات بلا ردود كافية */
  async surveysLowResponses() {
    const rows = await prisma.survey.findMany({
      where: activeWhere({ active: true, responses: { lt: 5 } }),
      select: { id: true, code: true, title: true, responses: true, period: true },
    });
    return {
      key: 'surveysLowResponses',
      title: 'استبيانات نشطة بعينة ضعيفة (< 5 ردود)',
      severity: rows.length ? 'WARNING' : 'INFO',
      count: rows.length,
      items: rows.map(r => ({
        id: r.id, code: r.code, title: r.title,
        reason: `${r.responses || 0} رد فقط${r.period ? ' — فترة ' + r.period : ''}`,
        actionUrl: `/#/surveys?id=${r.id}`,
      })),
      hint: 'زيادة عدد الردود يحسّن موثوقية النتائج الإحصائية.',
    };
  },

  /* 9) مخاطر حرجة بلا خطة معالجة */
  async criticalRisksWithoutPlan() {
    const rows = await prisma.risk.findMany({
      where: activeWhere({
        level: { in: ['حرج', 'مرتفع', 'CRITICAL', 'HIGH'] },
        status: { notIn: ['CLOSED', 'MITIGATED', 'ACCEPTED'] },
        OR: [{ treatment: null }, { treatment: '' }],
      }),
      select: { id: true, code: true, title: true, level: true },
    });
    return {
      key: 'criticalRisksWithoutPlan',
      title: 'مخاطر حرجة/مرتفعة بلا خطة معالجة',
      severity: rows.length ? 'CRITICAL' : 'INFO',
      count: rows.length,
      items: rows.map(r => ({
        id: r.id, code: r.code, title: r.title,
        reason: `المستوى: ${r.level} — خطة المعالجة فارغة`,
        actionUrl: `/#/risks?id=${r.id}`,
      })),
      hint: 'ISO 6.1: المخاطر الحرجة يجب أن يكون لها خطة معالجة موثّقة.',
    };
  },

  /* 10) موردون معتمدون بلا تقييم هذه السنة */
  async approvedSuppliersWithoutEval() {
    const year = new Date().getFullYear();
    const sups = await prisma.supplier.findMany({
      where: activeWhere({ status: 'APPROVED' }),
      include: { evaluations: { where: { createdAt: { gte: new Date(year, 0, 1) } }, select: { id: true } } },
    });
    const items = sups.filter(s => s.evaluations.length === 0).map(s => ({
      id: s.id, code: s.code, title: s.name,
      reason: `لا يوجد تقييم في ${year}`,
      actionUrl: `/#/suppliers?id=${s.id}`,
    }));
    return {
      key: 'approvedSuppliersWithoutEval',
      title: 'موردون معتمدون بلا تقييم هذا العام',
      severity: items.length ? 'HIGH' : 'INFO',
      count: items.length,
      items,
      hint: 'ISO 8.4: تقييم دوري للموردين المعتمدين على الأقل سنوياً.',
    };
  },

  /* 11) شكاوى خرقت SLA (Batch 14) */
  async complaintsSlaBreached() {
    const { complaints } = await scanSla(prisma);
    const breached = complaints.filter(c => c.sla.overall === 'BREACHED');
    return {
      key: 'complaintsSlaBreached',
      title: 'شكاوى تجاوزت SLA',
      severity: breached.length ? 'CRITICAL' : 'INFO',
      count: breached.length,
      items: breached.map(c => ({
        id: c.id, code: c.code, title: c.subject,
        reason: `تجاوز ${c.sla.stages.resolve.daysToDue < 0 ? 'مهلة الحل' : 'مهلة الإسناد'} — عمر: ${c.sla.ageDays}ي`,
        actionUrl: `/#/complaints?id=${c.id}`,
      })),
      hint: 'راجع السياسة: ISO 9.1.2 — تعامل فوري مع الشكاوى المتأخرة.',
    };
  },

  /* 11b) مستفيدون نشطون بلا إعادة تقييم دورية (Batch 15) */
  async beneficiariesDueReview() {
    const actives = await prisma.beneficiary.findMany({
      where: activeWhere({ status: 'ACTIVE' }),
      select: {
        id: true, code: true, fullName: true, assessedAt: true, priorityScore: true,
      },
    });
    const now = new Date();
    const due = actives.filter(b => needsReview(b, now));
    return {
      key: 'beneficiariesDueReview',
      title: `مستفيدون نشطون يلزمهم إعادة تقييم (كل ${REVIEW_INTERVAL} يوماً)`,
      severity: due.length ? 'HIGH' : 'INFO',
      count: due.length,
      items: due.map(b => ({
        id: b.id, code: b.code, title: b.fullName,
        reason: b.assessedAt
          ? `آخر تقييم: ${new Date(b.assessedAt).toLocaleDateString('ar-SA')} — مستحق منذ ${reviewDueDate(b)?.toLocaleDateString('ar-SA')}`
          : 'لم يُقيَّم أصلاً',
        actionUrl: `/#/beneficiaries?id=${b.id}`,
      })),
      hint: 'ISO 9.1.2 / P-08 §3: تحديث دوري لتقييم احتياجات المستفيد لضمان العدالة في التوزيع.',
    };
  },

  /* 11c) وثائق منشورة تجاوزت موعد المراجعة الدورية */
  async documentsReviewOverdue() {
    const now = new Date();
    const rows = await prisma.document.findMany({
      where: activeWhere({
        status: 'PUBLISHED',
        reviewDate: { not: null, lt: now },
      }),
      select: { id: true, code: true, title: true, reviewDate: true },
      take: 100,
    });
    return {
      key: 'documentsReviewOverdue',
      title: 'وثائق منشورة تجاوزت موعد المراجعة الدورية',
      severity: rows.length ? 'HIGH' : 'INFO',
      count: rows.length,
      items: rows.map(d => ({
        id: d.id, code: d.code, title: d.title,
        reason: `تاريخ المراجعة المستحقة: ${new Date(d.reviewDate).toLocaleDateString('ar-SA')} — متأخر ${Math.round((Date.now() - new Date(d.reviewDate))/86400000)} يوم`,
        actionUrl: `/#/documents?id=${d.id}`,
      })),
      hint: 'ISO 7.5.2: الوثائق تخضع لمراجعة دورية للتأكد من ملاءمتها.',
    };
  },

  /* 11d) مستخدمون نشطون لم يدخلوا منذ 90+ يوم */
  async staleUsers() {
    const cutoff = daysAgo(90);
    const rows = await prisma.user.findMany({
      where: { active: true, OR: [{ lastLoginAt: null }, { lastLoginAt: { lt: cutoff } }] },
      select: { id: true, name: true, email: true, lastLoginAt: true, role: true },
    });
    return {
      key: 'staleUsers',
      title: 'مستخدمون نشطون بلا دخول حديث (> 90 يوم)',
      severity: rows.length ? 'WARNING' : 'INFO',
      count: rows.length,
      items: rows.map(u => ({
        id: u.id, code: u.role, title: u.name,
        reason: u.lastLoginAt
          ? `آخر دخول: ${new Date(u.lastLoginAt).toLocaleDateString('ar-SA')}`
          : 'لم يسجّل دخولاً مطلقاً',
        actionUrl: `/#/users?id=${u.id}`,
      })),
      hint: 'راجع قائمة المستخدمين — قد تحتاج تعطيل الحسابات غير النشطة.',
    };
  },

  /* 12) عدم مطابقة خرقت SLA (Batch 14) */
  async ncrsSlaBreached() {
    const { ncrs } = await scanSla(prisma);
    const breached = ncrs.filter(n => n.sla.overall === 'BREACHED');
    return {
      key: 'ncrsSlaBreached',
      title: 'عدم مطابقة تجاوزت SLA',
      severity: breached.length ? 'CRITICAL' : 'INFO',
      count: breached.length,
      items: breached.map(n => ({
        id: n.id, code: n.code, title: n.title,
        reason: `تجاوز SLA — الحالة: ${n.status} — عمر: ${n.sla.ageDays}ي`,
        actionUrl: `/#/ncr?id=${n.id}`,
      })),
      hint: 'راجع ISO 10.2: الالتزام بمواعيد تحديد السبب والإجراء والإغلاق.',
    };
  },
};

// ─── المسارات ────────────────────────────────────────────────
router.get('/', requireAction('alerts', 'read'), asyncHandler(async (req, res) => {
  const results = await Promise.all(Object.values(detectors).map(fn => fn().catch(err => ({
    key: 'error', title: 'فحص فشل', severity: 'INFO', count: 0, items: [], error: err.message,
  }))));

  results.sort((a, b) => (SEV[a.severity] ?? 9) - (SEV[b.severity] ?? 9));

  const grandTotal = results.reduce((s, r) => s + r.count, 0);
  const critical = results.filter(r => r.severity === 'CRITICAL' && r.count).length;
  const high     = results.filter(r => r.severity === 'HIGH'     && r.count).length;
  const warning  = results.filter(r => r.severity === 'WARNING'  && r.count).length;

  res.json({
    ok: true,
    generatedAt: new Date().toISOString(),
    summary: {
      totalFindings: grandTotal,
      checksRun: results.length,
      critical, high, warning,
      healthScore: Math.max(0, 100 - (critical * 15 + high * 8 + warning * 3)),
    },
    checks: results,
  });
}));

router.get('/:check', requireAction('alerts', 'read'), asyncHandler(async (req, res) => {
  const fn = detectors[req.params.check];
  if (!fn) throw NotFound('فحص غير معروف');
  const result = await fn();
  res.json({ ok: true, ...result });
}));

export default router;
