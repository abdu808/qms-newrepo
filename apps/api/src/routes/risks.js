import { Router } from 'express';
import { crudRouter } from '../utils/crudFactory.js';
import { attachWorkflow } from '../lib/workflow.js';
import { prisma } from '../db.js';
import { BadRequest } from '../utils/errors.js';
import { createSchema as riskCreateSchema, updateSchema as riskUpdateSchema } from '../schemas/risk.schema.js';

function computeLevel(score) {
  if (score >= 20) return 'حرج';
  if (score >= 12) return 'مرتفع';
  if (score >= 6)  return 'متوسط';
  return 'منخفض';
}

const crud = crudRouter({
  resource: 'risks',
  model: 'risk',
  codePrefix: 'RSK',
  searchFields: ['title', 'description'],
  include: { department: true, owner: { select: { id: true, name: true } } },
  allowedSortFields: ['createdAt', 'score', 'status'],
  allowedFilters: ['status', 'level', 'departmentId', 'ownerId', 'workflowState'],
  schemas: { create: riskCreateSchema, update: riskUpdateSchema },
  beforeCreate: async (data, req) => {
    const p = Math.min(5, Math.max(1, Number(data.probability) || 1));
    const i = Math.min(5, Math.max(1, Number(data.impact) || 1));
    const score = p * i;
    return { ...data, probability: p, impact: i, score, level: computeLevel(score), createdById: req.user.sub };
  },
  beforeUpdate: async (data, req) => {
    // إعادة حساب الدرجة مع التحقق من الحدود (1-5)
    if (data.probability != null || data.impact != null) {
      const p = Math.min(5, Math.max(1, Number(data.probability) || 1));
      const i = Math.min(5, Math.max(1, Number(data.impact) || 1));
      data.probability = p;
      data.impact      = i;
      data.score       = p * i;
      data.level       = computeLevel(data.score);
    }
    // ISO 6.1: لا إغلاق المخاطرة دون توثيق خطة المعالجة
    if (data.status === 'CLOSED') {
      const existing = await prisma.risk.findUnique({
        where: { id: req.params.id },
        select: { treatment: true, treatmentType: true },
      });
      const hasTreatment = data.treatment || existing?.treatment;
      if (!hasTreatment) {
        throw BadRequest('لا يمكن إغلاق المخاطرة دون توثيق خطة المعالجة (ISO 6.1)');
      }
    }
    return data;
  },
});

const router = Router();
attachWorkflow(router, { model: 'risk', resource: 'risks' });
router.use(crud);
export default router;
