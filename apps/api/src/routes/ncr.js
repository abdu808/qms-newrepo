import { Router } from 'express';
import { crudRouter } from '../utils/crudFactory.js';
import { attachWorkflow } from '../lib/workflow.js';
import { readAudit } from '../middleware/audit.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { createSchema as ncrCreateSchema, updateSchema as ncrUpdateSchema } from '../schemas/ncr.schema.js';
import { guardNcrCreate, guardNcrUpdate } from '../services/ncrClosure.js';
import { reopenRecord } from '../services/reopenGuard.js';

const crud = crudRouter({
  resource: 'ncr',
  model: 'nCR',
  codePrefix: 'NCR',
  searchFields: ['title', 'description'],
  include: {
    department: true,
    reporter: { select: { id: true, name: true } },
    assignee: { select: { id: true, name: true } },
  },
  allowedSortFields: ['createdAt', 'dueDate', 'status'],
  allowedFilters: ['status', 'severity', 'departmentId', 'assigneeId', 'workflowState'],
  schemas: { create: ncrCreateSchema, update: ncrUpdateSchema },
  smartFilters: {
    overdue: () => ({
      status: { in: ['OPEN', 'ROOT_CAUSE', 'ACTION_PLANNED', 'IN_PROGRESS', 'VERIFICATION'] },
      dueDate: { lt: new Date() },
    }),
    mine: (req) => ({ assigneeId: req.user.sub }),
    pendingMine: (req) => ({
      assigneeId: req.user.sub,
      status: { in: ['OPEN', 'ROOT_CAUSE', 'ACTION_PLANNED', 'IN_PROGRESS', 'VERIFICATION'] },
    }),
    open: () => ({ status: { in: ['OPEN', 'ROOT_CAUSE', 'ACTION_PLANNED', 'IN_PROGRESS', 'VERIFICATION'] } }),
    closed: () => ({ status: 'CLOSED' }),
    pendingReview:   () => ({ workflowState: 'SUBMITTED' }),
    pendingApproval: () => ({ workflowState: 'UNDER_REVIEW' }),
    thisMonth: () => {
      const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0);
      return { createdAt: { gte: d } };
    },
  },
  beforeCreate: async (data, req) => {
    data = guardNcrCreate(data);
    return { ...data, reporterId: req.user.sub };
  },
  beforeUpdate: async (data, req) => guardNcrUpdate(data, { ncrId: req.params.id, req }),
});

const router = Router();
// ISO 7.5.3.2(b) — audit who reads nonconformity records.
router.use(readAudit('NCR'));

/**
 * POST /ncr/:id/reopen — إعادة فتح NCR مُغلَقة (ISO 10.2).
 * QM/SUPER_ADMIN فقط + سبب إلزامي + سجل AuditLog مستقل.
 * مُسجَّل قبل attachWorkflow لتفادي تعارض المسار العام /:id/reopen.
 */
router.post('/:id/reopen', asyncHandler(async (req, res) => {
  const updated = await reopenRecord({
    model: 'nCR', entityType: 'NCR',
    id: req.params.id, reason: req.body?.reason, req,
  });
  res.json({ ok: true, item: updated });
}));

attachWorkflow(router, { model: 'nCR', resource: 'ncr' });

router.use(crud);
export default router;
