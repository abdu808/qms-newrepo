import { Router } from 'express';
import { crudRouter } from '../utils/crudFactory.js';
import { prisma } from '../db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { BadRequest, NotFound } from '../utils/errors.js';
import { requireAction } from '../lib/permissions.js';
import { createSchema as supplierCreateSchema, updateSchema as supplierUpdateSchema } from '../schemas/supplier.schema.js';
import { buildSupplierHistory } from '../services/supplierHistory.js';

// C7: رقم السجل التجاري يجب أن يكون 10 أرقام بالضبط
const CR_REGEX = /^\d{10}$/;

function validateCrNumber(data) {
  if (data.crNumber != null && data.crNumber !== '') {
    if (!CR_REGEX.test(String(data.crNumber).trim())) {
      throw BadRequest('رقم السجل التجاري يجب أن يتكون من 10 أرقام فقط');
    }
  }
}

const crud = crudRouter({
  resource: 'suppliers',
  model: 'supplier',
  codePrefix: 'SUP',
  searchFields: ['name', 'crNumber', 'contactPerson'],
  allowedSortFields: ['createdAt', 'name', 'status', 'overallRating'],
  allowedFilters: ['status', 'type'],
  schemas: { create: supplierCreateSchema, update: supplierUpdateSchema },
  smartFilters: {
    approved:    () => ({ status: 'APPROVED' }),
    pending:     () => ({ status: { in: ['PENDING', 'UNDER_REVIEW'] } }),
    rejected:    () => ({ status: 'REJECTED' }),
    highRated:   () => ({ overallRating: { gte: 80 } }),
    lowRated:    () => ({ overallRating: { lt: 60, not: null } }),
    needsReview: () => {
      // لم يُقيَّم منذ > 12 شهر
      const cutoff = new Date(); cutoff.setFullYear(cutoff.getFullYear() - 1);
      return { OR: [{ updatedAt: { lt: cutoff } }, { overallRating: null }] };
    },
    thisMonth: () => {
      const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0);
      return { createdAt: { gte: d } };
    },
  },
  beforeCreate: async (data) => {
    validateCrNumber(data);
    return data;
  },
  beforeUpdate: async (data, req) => {
    validateCrNumber(data);

    // ISO 8.4: لا يمكن اعتماد مورد دون وجود تقييم ناجح مسبق
    if (data.status === 'APPROVED') {
      const hasApprovedEval = await prisma.supplierEval.findFirst({
        where: {
          supplierId: req.params.id,
          decision: { in: ['معتمد', 'معتمد مشروط'] },
        },
        select: { id: true },
      });
      if (!hasApprovedEval) {
        throw BadRequest('لا يمكن اعتماد المورد دون وجود تقييم ناجح (ISO 8.4) — أرسل رابط التقييم للمورد أولاً');
      }
    }
    return data;
  },
});

const router = Router();

/**
 * GET /suppliers/:id/history — الخط الزمني لتقييمات المورّد (ISO 8.4.2)
 * يُرجع كل التقييمات السابقة مع تتبّع اتجاه الأداء (تحسّن/تراجع/مستقر).
 */
router.get('/:id/history', requireAction('suppliers', 'read'), asyncHandler(async (req, res) => {
  const supplier = await prisma.supplier.findUnique({
    where: { id: req.params.id },
    select: { id: true, code: true, name: true, type: true, overallRating: true, status: true },
  });
  if (!supplier) throw NotFound('المورّد غير موجود');

  const evaluations = await prisma.supplierEval.findMany({
    where: { supplierId: req.params.id, deletedAt: null },
    orderBy: { evaluatedAt: 'asc' },
    include: { evaluator: { select: { id: true, name: true } } },
  });

  const { timeline, stats } = buildSupplierHistory(evaluations);
  res.json({ ok: true, supplier, timeline, stats });
}));

router.use('/', crud);

export default router;
