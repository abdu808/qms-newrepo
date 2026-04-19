/**
 * performanceReviews.js — تقييم الأداء السنوي (ISO 9001 §7.2)
 * P-05 §5 — يُنشئه المدير، يوقّعه الموظف، ثم يُختم كنهائي.
 */
import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { BadRequest, NotFound, Forbidden } from '../utils/errors.js';
import { crudRouter } from '../utils/crudFactory.js';
import { requireAction, can } from '../lib/permissions.js';
import { activeWhere } from '../lib/dataHelpers.js';

const DIMENSIONS = [
  'jobKnowledge', 'qualityOfWork', 'productivity',
  'teamwork', 'communication', 'initiative', 'reliability',
];

function computeOverall(data) {
  const vals = DIMENSIONS.map(k => Number(data[k])).filter(v => Number.isFinite(v) && v >= 1 && v <= 5);
  if (vals.length === 0) return null;
  return Math.round((vals.reduce((a,b) => a+b, 0) / vals.length) * 100) / 100;
}

function gradeFor(score) {
  if (score == null) return null;
  if (score >= 4.5) return 'ممتاز';
  if (score >= 4)   return 'جيد جداً';
  if (score >= 3)   return 'جيد';
  if (score >= 2)   return 'مقبول';
  return 'ضعيف';
}

function normalize(data) {
  for (const k of DIMENSIONS) {
    if (data[k] === '' || data[k] === null || data[k] === undefined) {
      data[k] = null;
    } else {
      const n = Number(data[k]);
      if (!Number.isFinite(n) || n < 1 || n > 5) throw BadRequest(`قيمة "${k}" يجب أن تكون بين 1 و 5`);
      data[k] = n;
    }
  }
  const auto = computeOverall(data);
  if (auto != null) {
    data.overallRating = auto;
    data.grade = gradeFor(auto);
  }
  if (data.employeeId === data.reviewerId) {
    throw BadRequest('لا يجوز للموظف تقييم نفسه (Separation of Duty — ISO 7.1.2)');
  }
  return data;
}

const base = crudRouter({
  resource: 'performance-reviews',
  model: 'performanceReview',
  codePrefix: 'PRV',
  searchFields: ['code', 'period', 'strengths', 'areasToImprove'],
  allowedSortFields: ['createdAt', 'periodEnd', 'status', 'overallRating'],
  allowedFilters: ['status', 'employeeId', 'reviewerId', 'period'],
  beforeCreate: async (data, req) => {
    data = normalize(data);
    if (!data.reviewerId) data.reviewerId = req.user.sub;
    return data;
  },
  beforeUpdate: async (data) => normalize(data),
});

const router = Router();

/**
 * POST /api/performance-reviews/:id/submit-to-employee
 * المُقيِّم يُنهي التقييم ويرسله للموظف ليوقّع.
 */
router.post('/:id/submit-to-employee',
  requireAction('performance-reviews', 'update'),
  asyncHandler(async (req, res) => {
    const item = await prisma.performanceReview.findUnique({ where: { id: req.params.id } });
    if (!item) throw NotFound('التقييم غير موجود');
    if (item.status !== 'DRAFT') throw BadRequest('يمكن إرسال المسودات فقط');
    if (item.reviewerId !== req.user.sub && !can(req.user, 'performance-reviews', 'delete')) {
      throw Forbidden('فقط المُقيِّم أو QM يمكنه إرسال التقييم');
    }
    const updated = await prisma.performanceReview.update({
      where: { id: req.params.id },
      data: { status: 'EMPLOYEE_REVIEW' },
    });
    res.json({ ok: true, item: updated });
  }),
);

/**
 * POST /api/performance-reviews/:id/sign
 * الموظف يوقّع التقييم (يقرّ بالاطّلاع).
 * يستطيع إضافة تعليقه في employeeComments.
 */
router.post('/:id/sign', asyncHandler(async (req, res) => {
  const item = await prisma.performanceReview.findUnique({ where: { id: req.params.id } });
  if (!item) throw NotFound('التقييم غير موجود');
  if (item.employeeId !== req.user.sub) throw Forbidden('لا يمكنك توقيع تقييم موظف آخر');
  if (item.status !== 'EMPLOYEE_REVIEW') throw BadRequest('التقييم ليس في مرحلة التوقيع');

  const updated = await prisma.performanceReview.update({
    where: { id: req.params.id },
    data: {
      employeeComments: req.body?.employeeComments || item.employeeComments,
      employeeSignedAt: new Date(),
    },
  });
  res.json({ ok: true, item: updated });
}));

/**
 * POST /api/performance-reviews/:id/finalize
 * QM+ يختم التقييم كنهائي بعد توقيع الموظف.
 */
router.post('/:id/finalize',
  requireAction('performance-reviews', 'delete'), // QM+
  asyncHandler(async (req, res) => {
    const item = await prisma.performanceReview.findUnique({ where: { id: req.params.id } });
    if (!item) throw NotFound('التقييم غير موجود');
    if (!item.employeeSignedAt) throw BadRequest('لا يمكن ختم التقييم قبل توقيع الموظف');
    const updated = await prisma.performanceReview.update({
      where: { id: req.params.id },
      data: { status: 'FINALIZED', finalizedAt: new Date() },
    });
    res.json({ ok: true, item: updated });
  }),
);

/**
 * GET /api/performance-reviews/matrix?period=2026
 * مصفوفة تقييم: كل الموظفين × المتوسط الإجمالي في الفترة.
 */
router.get('/matrix', requireAction('performance-reviews', 'read'), asyncHandler(async (req, res) => {
  const period = req.query.period || String(new Date().getFullYear());
  const [users, reviews] = await Promise.all([
    prisma.user.findMany({
      where: { active: true },
      select: { id: true, name: true, jobTitle: true, departmentId: true },
      orderBy: { name: 'asc' },
    }),
    prisma.performanceReview.findMany({
      where: activeWhere({ period }),
      select: { employeeId: true, overallRating: true, grade: true, status: true, code: true },
    }),
  ]);
  const byUser = new Map(reviews.map(r => [r.employeeId, r]));
  const rows = users.map(u => ({
    ...u,
    review: byUser.get(u.id) || null,
  }));
  res.json({
    ok: true, period,
    total: users.length,
    reviewed: reviews.length,
    coverage: users.length ? Math.round((reviews.length / users.length) * 100) : 0,
    rows,
  });
}));

router.use('/', base);

export default router;
