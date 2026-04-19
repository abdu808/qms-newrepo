import { crudRouter } from '../utils/crudFactory.js';
import { prisma } from '../db.js';
import { NotFound } from '../utils/errors.js';
import { AUDIT_STATUS, assertTransition } from '../lib/stateMachines.js';
import { requireSignatureFor } from '../lib/signatureGuard.js';
import { createSchema as auditCreateSchema, updateSchema as auditUpdateSchema } from '../schemas/audit.schema.js';

export default crudRouter({
  resource: 'audits',
  model: 'audit',
  codePrefix: 'AUD',
  searchFields: ['title', 'scope'],
  include: { leadAuditor: { select: { id: true, name: true } } },
  allowedSortFields: ['createdAt', 'plannedDate', 'status'],
  allowedFilters: ['status', 'type', 'leadAuditorId'],
  schemas: { create: auditCreateSchema, update: auditUpdateSchema },
  beforeUpdate: async (data, req) => {
    if (data.status) {
      const current = await prisma.audit.findUnique({
        where: { id: req.params.id }, select: { status: true },
      });
      if (!current) throw NotFound('التدقيق غير موجود');
      assertTransition(AUDIT_STATUS, current.status, data.status, {
        label: 'التدقيق', role: req.user?.role,
      });

      // ISO 9.2: إغلاق تدقيق داخلي يتطلب توقيعاً رقمياً من المدقق الرئيس
      if (data.status === 'COMPLETED') {
        await requireSignatureFor(req, {
          entityType: 'Audit',
          entityId:   req.params.id,
          purpose:    'complete',
          label:      'اعتماد تقرير التدقيق',
        });
      }
    }
    return data;
  },
});
