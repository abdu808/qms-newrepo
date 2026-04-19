/**
 * routes/supplierEvals.js — Batch 12 refactor
 * يستخدم الآن evalEngine الموحّد (نفس منطق publicEval).
 */
import { Router } from 'express';
import { crudRouter } from '../utils/crudFactory.js';
import { attachWorkflow } from '../lib/workflow.js';
import { prisma } from '../db.js';
import { recomputeSupplierRating } from '../lib/evalEngine.js';
import { prepareSupplierEval } from '../services/supplierEval.js';

const crud = crudRouter({
  resource: 'supplier-evals',
  model: 'supplierEval',
  codePrefix: 'REG-004-VAL',
  searchFields: ['notes'],
  include: { supplier: true, evaluator: { select: { id: true, name: true } } },
  allowedSortFields: ['createdAt', 'percentage'],
  beforeCreate: async (data, req) => prepareSupplierEval({
    prisma,
    data,
    evaluatorId: req.user.sub,
  }),
  afterCreate: async (record) => {
    if (record?.supplierId) await recomputeSupplierRating(prisma, record.supplierId);
  },
  afterUpdate: async (record) => {
    if (record?.supplierId) await recomputeSupplierRating(prisma, record.supplierId);
  },
  afterDelete: async (record) => {
    if (record?.supplierId) await recomputeSupplierRating(prisma, record.supplierId);
  },
});

const router = Router();
attachWorkflow(router, { model: 'supplierEval', resource: 'supplier-evals' });
router.use(crud);
export default router;
