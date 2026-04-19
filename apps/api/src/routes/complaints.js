import { Router } from 'express';
import { crudRouter } from '../utils/crudFactory.js';
import { prisma } from '../db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { BadRequest, NotFound } from '../utils/errors.js';
import { requireAction } from '../lib/permissions.js';
import { readAudit } from '../middleware/audit.js';
import { activeWhere } from '../lib/dataHelpers.js';
import { computeComplaintSla } from '../lib/sla.js';
import { createSchema as complaintCreateSchema, updateSchema as complaintUpdateSchema } from '../schemas/complaint.schema.js';
import { convertComplaintToNcr, guardComplaintUpdate } from '../services/complaintLifecycle.js';
import { reopenRecord } from '../services/reopenGuard.js';

const RESOLVED_STATES = ['RESOLVED', 'CLOSED'];
const OPEN_STATES     = ['NEW', 'UNDER_REVIEW', 'IN_PROGRESS'];
const OVERDUE_DAYS    = 14; // الحد الأقصى المقبول للمعالجة (ISO 9.1.2)

function normalize(data) {
  // satisfaction + types مُتحقَّق منها عبر Zod (schemas/complaint.schema.js).
  // هنا فقط قواعد الأعمال: auto-stamp resolvedAt عند الانتقال لحالة محلولة/مغلقة.
  if (RESOLVED_STATES.includes(data.status) && !data.resolvedAt) {
    data.resolvedAt = new Date();
  }
  return data;
}

const base = crudRouter({
  resource: 'complaints',
  model: 'complaint',
  codePrefix: 'CMP',
  searchFields: ['subject', 'description', 'complainantName'],
  include: {
    assignee:   { select: { id: true, name: true } },
    relatedNcr: { select: { id: true, code: true, status: true } },
  },
  allowedSortFields: ['createdAt', 'receivedAt', 'status', 'severity'],
  allowedFilters: ['status', 'severity', 'assigneeId'],
  schemas: { create: complaintCreateSchema, update: complaintUpdateSchema },
  smartFilters: {
    overdue: () => {
      const cutoff = new Date(Date.now() - OVERDUE_DAYS * 86400000);
      return {
        status: { in: OPEN_STATES },
        receivedAt: { lt: cutoff },
      };
    },
    mine: (req) => ({ assigneeId: req.user.sub }),
    pendingMine: (req) => ({
      assigneeId: req.user.sub,
      status: { in: OPEN_STATES },
    }),
    open: () => ({ status: { in: OPEN_STATES } }),
    closed: () => ({ status: { in: ['RESOLVED', 'CLOSED'] } }),
    thisMonth: () => {
      const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0);
      return { createdAt: { gte: d } };
    },
  },
  beforeCreate: async (data) => normalize(data),
  beforeUpdate: async (data, req) => {
    data = normalize(data);
    return guardComplaintUpdate(data, { complaintId: req.params.id, req });
  },
});

const router = Router();

// ISO 7.5.3.2(b) — audit who reads complaint records (contain complainant PII).
router.use(readAudit('Complaint'));

/**
 * GET /api/complaints/overdue
 * ISO 9.1.2 — الشكاوى المتأخرة (مفتوحة أكثر من 14 يوماً)
 */
router.get('/overdue', requireAction('complaints', 'read'), asyncHandler(async (req, res) => {
  const cutoff = new Date(Date.now() - OVERDUE_DAYS * 24 * 60 * 60 * 1000);

  const items = await prisma.complaint.findMany({
    where: activeWhere({
      status: { in: OPEN_STATES },
      receivedAt: { lte: cutoff },
    }),
    include: { assignee: { select: { id: true, name: true } } },
    orderBy: { receivedAt: 'asc' },
  });

  // احسب عمر الشكوى بالأيام + حالة SLA لكل سجل (Batch 14)
  const enriched = items.map(c => ({
    ...c,
    ageDays: Math.floor((Date.now() - new Date(c.receivedAt).getTime()) / (1000 * 60 * 60 * 24)),
    sla: computeComplaintSla(c),
  }));

  res.json({
    ok: true,
    overdueDays: OVERDUE_DAYS,
    count: enriched.length,
    items: enriched,
  });
}));

/**
 * POST /api/complaints/:id/convert-to-ncr
 * P-11 §3.4 — إذا كشفت الشكوى خللاً نظامياً، تُحوَّل إلى NCR ويُربطان معاً.
 * الصلاحية: QM+ (نفس صلاحية فتح NCR لأنها تنشئ سجلاً رسمياً).
 */
router.post(
  '/:id/convert-to-ncr',
  requireAction('ncr', 'create'),
  asyncHandler(async (req, res) => {
    const result = await convertComplaintToNcr({
      complaintId: req.params.id,
      userId:      req.user.sub,
      req,
    });
    res.status(201).json({ ok: true, ...result });
  })
);

/**
 * POST /api/complaints/:id/reopen — إعادة فتح شكوى مُغلَقة (ISO 9.1.2).
 * QM/SUPER_ADMIN فقط + سبب إلزامي + AuditLog.
 */
router.post('/:id/reopen', asyncHandler(async (req, res) => {
  const updated = await reopenRecord({
    model: 'complaint', entityType: 'Complaint',
    id: req.params.id, reason: req.body?.reason, req,
  });
  res.json({ ok: true, item: updated });
}));

router.use('/', base);

export default router;
