/**
 * improvementProjects.js — مشاريع التحسين المستمر بدورة PDCA
 * ISO 9001 §10.3 · P-15 §3
 */
import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { BadRequest, NotFound } from '../utils/errors.js';
import { crudRouter } from '../utils/crudFactory.js';
import { requireAction } from '../lib/permissions.js';
import { activeWhere } from '../lib/dataHelpers.js';

const PHASES = ['PLAN', 'DO', 'CHECK', 'ACT', 'CLOSED'];
const NEXT = { PLAN: 'DO', DO: 'CHECK', CHECK: 'ACT', ACT: 'CLOSED' };

const base = crudRouter({
  resource: 'improvement-projects',
  model: 'improvementProject',
  codePrefix: 'IMP',
  searchFields: ['title', 'description', 'lessonsLearned'],
  allowedSortFields: ['createdAt', 'phase', 'status'],
  allowedFilters: ['status', 'phase', 'ownerId', 'departmentId', 'sourceType'],
  beforeCreate: async (data, req) => ({ ...data, proposedById: req.user.sub }),
});

const router = Router();

/**
 * POST /api/improvement-projects/:id/advance
 * ينقل المشروع للمرحلة التالية من PDCA.
 * يشترط تعبئة حقل المرحلة الحالية قبل الانتقال.
 */
router.post('/:id/advance',
  requireAction('improvement-projects', 'update'),
  asyncHandler(async (req, res) => {
    const item = await prisma.improvementProject.findUnique({ where: { id: req.params.id } });
    if (!item) throw NotFound('المشروع غير موجود');
    const next = NEXT[item.phase];
    if (!next) throw BadRequest('المشروع في مرحلته النهائية');

    // حراسات تكامل البيانات لكل مرحلة
    if (item.phase === 'PLAN' && !item.planDetails) throw BadRequest('لا يمكن الانتقال: اكتب تفاصيل الخطة أولاً');
    if (item.phase === 'DO'   && !item.doDetails)   throw BadRequest('لا يمكن الانتقال: وثّق التنفيذ أولاً');
    if (item.phase === 'CHECK' && !item.checkResults) throw BadRequest('لا يمكن الانتقال: سجّل نتائج القياس أولاً');
    if (item.phase === 'ACT'   && !item.actDecision)  throw BadRequest('لا يمكن الإغلاق: اكتب قرار التعميم/الإعادة أولاً');

    const updates = { phase: next };
    if (item.phase === 'PLAN')  { updates.doStartedAt = new Date(); updates.status = 'ACTIVE'; }
    if (item.phase === 'CHECK') { updates.checkMeasuredAt = new Date(); }
    if (next === 'CLOSED')      { updates.status = 'COMPLETED'; updates.endDate = new Date(); }

    const updated = await prisma.improvementProject.update({
      where: { id: req.params.id }, data: updates,
    });
    res.json({ ok: true, item: updated });
  }),
);

/**
 * POST /api/improvement-projects/:id/restart
 * إعادة تخطيط: يرجع المشروع لـ PLAN (فشل التجربة على نطاق محدود).
 */
router.post('/:id/restart',
  requireAction('improvement-projects', 'update'),
  asyncHandler(async (req, res) => {
    const item = await prisma.improvementProject.findUnique({ where: { id: req.params.id } });
    if (!item) throw NotFound('المشروع غير موجود');
    if (!item.lessonsLearned && !req.body?.lessonsLearned) {
      throw BadRequest('يجب توثيق الدروس المستفادة قبل إعادة التخطيط');
    }
    const updated = await prisma.improvementProject.update({
      where: { id: req.params.id },
      data: {
        phase: 'PLAN',
        status: 'ACTIVE',
        lessonsLearned: req.body?.lessonsLearned || item.lessonsLearned,
      },
    });
    res.json({ ok: true, item: updated });
  }),
);

/**
 * GET /api/improvement-projects/stats
 * إحصائيات لوحة تحسين مستمر (KPI للإجراء P-15).
 */
router.get('/stats', requireAction('improvement-projects', 'read'), asyncHandler(async (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  const yStart = new Date(`${year}-01-01`);
  const yEnd   = new Date(`${year + 1}-01-01`);

  const [byPhase, byStatus, implementedThisYear, successfulThisYear] = await Promise.all([
    prisma.improvementProject.groupBy({
      by: ['phase'], _count: { _all: true },
      where: activeWhere({ createdAt: { gte: yStart, lt: yEnd } }),
    }),
    prisma.improvementProject.groupBy({
      by: ['status'], _count: { _all: true },
      where: activeWhere({ createdAt: { gte: yStart, lt: yEnd } }),
    }),
    prisma.improvementProject.count({
      where: activeWhere({ endDate: { gte: yStart, lt: yEnd }, status: 'COMPLETED' }),
    }),
    prisma.improvementProject.count({
      where: activeWhere({ endDate: { gte: yStart, lt: yEnd }, status: 'COMPLETED', actDecision: { not: null } }),
    }),
  ]);

  res.json({
    ok: true, year,
    byPhase, byStatus,
    implementedThisYear,
    successRate: implementedThisYear ? Math.round((successfulThisYear / implementedThisYear) * 100) : 0,
    target: { implemented: 12, successRate: 60 }, // KPIs من P-15 §8
  });
}));

router.use('/', base);

export default router;
