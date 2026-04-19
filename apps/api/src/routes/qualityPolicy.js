import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { BadRequest, Forbidden, NotFound } from '../utils/errors.js';
import { crudRouter } from '../utils/crudFactory.js';

// ISO 5.2 — quality policy activation requires top-management authority
const ACTIVATE_ROLES = ['SUPER_ADMIN', 'QUALITY_MANAGER'];

const base = crudRouter({
  model: 'qualityPolicy',
  resource: 'quality-policy',
  searchFields: ['title', 'content', 'version'],
  allowedSortFields: ['createdAt', 'effectiveDate', 'active'],
  beforeCreate: async (data) => {
    // Friendly Arabic error on duplicate version
    return data;
  },
});

const router = Router();

// Get the ACTIVE quality policy
router.get('/active', asyncHandler(async (req, res) => {
  const item = await prisma.qualityPolicy.findFirst({
    where: { active: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ ok: true, item });
}));

// Activate a policy — with role check + audit + approval stamping
router.post('/:id/activate', asyncHandler(async (req, res) => {
  if (!ACTIVATE_ROLES.includes(req.user.role)) {
    throw Forbidden('فقط مدير الجودة أو مسؤول النظام يمكنه تفعيل سياسة الجودة (ISO 5.2)');
  }

  const policy = await prisma.qualityPolicy.findUnique({ where: { id: req.params.id } });
  if (!policy) throw NotFound('السياسة غير موجودة');
  if (policy.active) throw BadRequest('هذه السياسة مفعلة بالفعل');

  // أولاً: إلغاء تفعيل كل السياسات الحالية (منفصلة لنحصل على العدد الفعلي)
  const deactivated = await prisma.qualityPolicy.updateMany({
    where: { active: true },
    data: { active: false },
  });

  // ثانياً: تفعيل السياسة الجديدة + سجل التدقيق في معاملة واحدة
  const [activated] = await prisma.$transaction([
    prisma.qualityPolicy.update({
      where: { id: req.params.id },
      data: {
        active: true,
        approvedBy: req.user.name || req.user.email,
        approvedAt: new Date(),
        effectiveDate: policy.effectiveDate || new Date(),
      },
    }),
    // Audit trail — يعرف الآن العدد الفعلي للسياسات الملغاة
    prisma.auditLog.create({
      data: {
        userId: req.user.sub,
        action: 'ACTIVATE_POLICY',
        entityType: 'QualityPolicy',
        entityId: req.params.id,
        changesJson: JSON.stringify({
          version: policy.version,
          title: policy.title,
          deactivatedPreviousCount: deactivated.count,
        }),
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    }),
  ]);

  res.json({ ok: true, item: activated, deactivatedCount: deactivated.count });
}));

router.use('/', base);

export default router;
