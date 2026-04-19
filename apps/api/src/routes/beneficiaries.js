/**
 * routes/beneficiaries.js — Batch 15
 * تقييم الاحتياجات وسير العمل (ISO 8.2.2 / 9.1.2 / P-08 §3).
 *
 * مسارات خاصة:
 *   POST /:id/assess           — يسجّل تقييم احتياجات رسمياً + يحسب الأولوية آلياً
 *   GET  /:id/assessment       — معاينة نتيجة المحرك (دون حفظ)
 *   GET  /due-review           — مستفيدون نشطون تجاوزوا دورية المراجعة (365 يوماً)
 *   GET  /meta                 — فئات، مؤشرات الحماية (لتوحيد الواجهة)
 */
import { Router } from 'express';
import { crudRouter } from '../utils/crudFactory.js';
import { prisma } from '../db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { NotFound, BadRequest } from '../utils/errors.js';
import { requireAction } from '../lib/permissions.js';
import { readAudit } from '../middleware/audit.js';
import { activeWhere } from '../lib/dataHelpers.js';
import {
  computePriority, needsReview, reviewDueDate,
  assertActivationReady, VULNERABILITY_FLAGS, REVIEW_INTERVAL,
} from '../lib/beneficiaryAssessment.js';
import {
  createSchema as benCreateSchema,
  updateSchema as benUpdateSchema,
} from '../schemas/beneficiary.schema.js';

const BENEFICIARY_STATUSES = ['APPLICANT', 'ACTIVE', 'INACTIVE', 'GRADUATED', 'REJECTED'];

const crud = crudRouter({
  resource: 'beneficiaries',
  model: 'beneficiary',
  codePrefix: 'BEN',
  searchFields: ['fullName', 'nationalId', 'phone'],
  allowedSortFields: ['createdAt', 'appliedAt', 'status', 'priorityScore'],
  allowedFilters: ['status', 'category', 'city'],
  schemas: { create: benCreateSchema, update: benUpdateSchema },
  smartFilters: {
    applicants:  () => ({ status: 'APPLICANT' }),
    active:      () => ({ status: 'ACTIVE' }),
    inactive:    () => ({ status: 'INACTIVE' }),
    highPriority: () => ({ priorityScore: { gte: 4 }, status: { in: ['APPLICANT', 'ACTIVE'] } }),
    dueReview:   () => {
      // آخر تقييم تجاوز 365 يوماً — مستفيد نشط يحتاج مراجعة
      const cutoff = new Date(Date.now() - 365 * 86400000);
      return {
        status: 'ACTIVE',
        OR: [{ lastAssessedAt: null }, { lastAssessedAt: { lt: cutoff } }],
      };
    },
    mine:       (req) => ({ caseWorkerId: req.user.sub }),
    thisMonth:  () => {
      const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0);
      return { appliedAt: { gte: d } };
    },
  },
  beforeCreate: async (data) => {
    // تطبيع: priorityScore في 1-5، familySize > 0
    if (data.priorityScore != null) {
      const n = Number(data.priorityScore);
      if (!Number.isFinite(n) || n < 1 || n > 5) throw BadRequest('درجة الأولوية يجب أن تكون 1-5');
      data.priorityScore = Math.round(n);
    }
    return data;
  },
  beforeUpdate: async (data, req) => {
    // تطبيع درجة الأولوية
    if (data.priorityScore != null) {
      const n = Number(data.priorityScore);
      if (!Number.isFinite(n) || n < 1 || n > 5) throw BadRequest('درجة الأولوية يجب أن تكون 1-5');
      data.priorityScore = Math.round(n);
    }

    // سير الحالة: نحتاج السجل الحالي للتحقق
    if (data.status) {
      if (!BENEFICIARY_STATUSES.includes(data.status)) throw BadRequest('حالة مستفيد غير صحيحة');
      const current = await prisma.beneficiary.findUnique({ where: { id: req.params.id } });
      if (!current) throw NotFound('المستفيد غير موجود');

      const merged = { ...current, ...data };

      // APPLICANT → ACTIVE: يلزم تقييم مكتمل
      if (current.status === 'APPLICANT' && data.status === 'ACTIVE') {
        assertActivationReady(merged);
        if (!data.approvedAt) data.approvedAt = new Date();
      }

      // ACTIVE → GRADUATED/INACTIVE: مسموح؛ REJECTED فقط من APPLICANT
      if (data.status === 'REJECTED' && current.status !== 'APPLICANT') {
        throw BadRequest('الرفض مسموح فقط للمتقدمين (APPLICANT)');
      }
    }
    return data;
  },
});

const router = Router();

// ISO 7.5.3.2(b) — log who viewed which beneficiary record (PII-sensitive).
// Applied to ALL routes on this router (covers crud GET /:id and custom reads).
router.use(readAudit('Beneficiary'));

/**
 * GET /api/beneficiaries/meta — فئات ومؤشرات الحماية (لبناء نماذج موحّدة).
 */
router.get('/meta', asyncHandler(async (_req, res) => {
  res.json({
    ok: true,
    reviewIntervalDays: REVIEW_INTERVAL,
    vulnerabilityFlags: VULNERABILITY_FLAGS,
    statuses: BENEFICIARY_STATUSES,
  });
}));

/**
 * GET /api/beneficiaries/due-review — نشطون تجاوزوا 365 يوماً (ISO 9.1.2).
 */
router.get('/due-review', requireAction('beneficiaries', 'read'), asyncHandler(async (_req, res) => {
  const actives = await prisma.beneficiary.findMany({
    where: activeWhere({ status: 'ACTIVE' }),
    select: {
      id: true, code: true, fullName: true, category: true,
      assessedAt: true, priorityScore: true, city: true,
    },
    orderBy: { assessedAt: 'asc' },
  });
  const now = new Date();
  const due = actives
    .filter(b => needsReview(b, now))
    .map(b => ({
      ...b,
      reviewDueDate: reviewDueDate(b),
      daysOverdue: b.assessedAt
        ? Math.floor((now - new Date(b.assessedAt)) / (24 * 3600 * 1000)) - REVIEW_INTERVAL
        : null,
    }));
  res.json({ ok: true, count: due.length, items: due, reviewIntervalDays: REVIEW_INTERVAL });
}));

/**
 * GET /api/beneficiaries/:id/assessment — معاينة محرك التقييم (دون حفظ).
 */
router.get('/:id/assessment', requireAction('beneficiaries', 'read'), asyncHandler(async (req, res) => {
  const b = await prisma.beneficiary.findUnique({ where: { id: req.params.id } });
  if (!b) throw NotFound('المستفيد غير موجود');
  const result = computePriority(b);
  res.json({
    ok: true,
    id: b.id, code: b.code, fullName: b.fullName,
    current: {
      priorityScore: b.priorityScore,
      assessedAt: b.assessedAt,
      assessedBy: b.assessedBy,
      reviewDueDate: reviewDueDate(b),
      needsReview: needsReview(b),
    },
    computed: result,
  });
}));

/**
 * POST /api/beneficiaries/:id/assess
 * body: { needsAssessment, vulnerabilityFlags?, monthlyIncome?, familySize?,
 *         useComputedScore?: boolean, priorityScore?: 1-5, assessedBy? }
 *
 * يسجّل تقييم احتياجات ويحدّث السجل آلياً — يعتمد درجة الأولوية
 * المحسوبة من المحرك (موضوعية) ما لم يُرسل priorityScore يدوياً ويكون useComputedScore=false.
 */
router.post('/:id/assess', requireAction('beneficiaries', 'update'), asyncHandler(async (req, res) => {
  const b = await prisma.beneficiary.findUnique({ where: { id: req.params.id } });
  if (!b) throw NotFound('المستفيد غير موجود');

  const body = req.body || {};
  const needsAssessment = String(body.needsAssessment || '').trim();
  if (!needsAssessment) throw BadRequest('وصف الاحتياجات إلزامي (needsAssessment)');
  if (needsAssessment.length < 10) throw BadRequest('وصف الاحتياجات قصير جداً — اكتب تفاصيل كافية');

  // اقبل تحديث أرقام حديثة إن أُرسلت (لتعكس الواقع وقت التقييم)
  const patch = {};
  if (body.monthlyIncome != null && body.monthlyIncome !== '') {
    const n = Number(body.monthlyIncome);
    if (!Number.isFinite(n) || n < 0) throw BadRequest('monthlyIncome غير صحيح');
    patch.monthlyIncome = n;
  }
  if (body.familySize != null && body.familySize !== '') {
    const n = Number(body.familySize);
    if (!Number.isFinite(n) || n < 1) throw BadRequest('familySize يجب أن يكون 1 فأكثر');
    patch.familySize = Math.round(n);
  }
  if (body.vulnerabilityFlags !== undefined) {
    patch.vulnerabilityFlags = body.vulnerabilityFlags
      ? String(body.vulnerabilityFlags) : null;
  }

  const merged = { ...b, ...patch };
  const computed = computePriority(merged);

  // درجة الأولوية: المحسوبة افتراضاً — يمكن تجاوزها يدوياً مع useComputedScore=false
  let finalScore = computed.score;
  const useComputed = body.useComputedScore !== false; // default true
  if (!useComputed && body.priorityScore != null) {
    const n = Number(body.priorityScore);
    if (!Number.isFinite(n) || n < 1 || n > 5) throw BadRequest('priorityScore يجب أن يكون 1-5');
    finalScore = Math.round(n);
  }

  const assessedBy = (body.assessedBy && String(body.assessedBy).trim()) || req.user?.name || req.user?.sub || null;
  if (!assessedBy) throw BadRequest('assessedBy مطلوب');

  const updated = await prisma.beneficiary.update({
    where: { id: b.id },
    data: {
      ...patch,
      needsAssessment,
      priorityScore: finalScore,
      assessedAt: new Date(),
      assessedBy,
    },
  });

  // أثر رقابي
  prisma.auditLog.create({
    data: {
      userId:      req.user?.sub || null,
      action:      'BENEFICIARY_ASSESSED',
      entityType:  'Beneficiary',
      entityId:    b.id,
      changesJson: JSON.stringify({
        priorityScore: finalScore,
        computed:      computed,
        overrideUsed:  !useComputed,
      }),
      ipAddress:   req.ip,
      userAgent:   req.headers['user-agent'],
    },
  }).catch(() => {});

  res.json({
    ok: true,
    item: updated,
    computed,
    overrideUsed: !useComputed,
    recommendation: computed.recommendation,
  });
}));

router.use('/', crud);
export default router;
