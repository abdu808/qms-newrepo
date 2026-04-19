/**
 * workflow.js — Reusable Maker/Checker/Approver router.
 *
 * ISO 9001:2015 §7.1.2 — Separation of duty for business-critical records.
 *
 * State machine:
 *
 *    DRAFT  ──submit──▶  SUBMITTED  ──pickUp──▶  UNDER_REVIEW  ──approve──▶  APPROVED
 *      ▲                     │                       │                         │
 *      │                     │                       │                         │
 *      └─reject──────────────┴───────reject──────────┴─────────reject──────────┘
 *                                                                  (→ REJECTED)
 *
 * Separation of duty rules (enforced):
 *   - Submitter cannot review their own record.
 *   - Reviewer cannot approve (unless user is SUPER_ADMIN — break-glass).
 *   - Approve requires the record to be in UNDER_REVIEW.
 *
 * Usage (mount in a route file):
 *
 *   import { Router } from 'express';
 *   import { crudRouter } from '../utils/crudFactory.js';
 *   import { attachWorkflow } from '../lib/workflow.js';
 *
 *   const router = Router();
 *   attachWorkflow(router, { model: 'risk', resource: 'risks' });
 *   router.use(crudRouter({ resource: 'risks', model: 'risk', ... }));
 *   export default router;
 */
import { prisma } from '../db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { BadRequest, Forbidden, NotFound } from '../utils/errors.js';
import { can } from './permissions.js';

const VALID_TRANSITIONS = {
  DRAFT:        { submit: 'SUBMITTED' },
  SUBMITTED:    { pickUp: 'UNDER_REVIEW', reject: 'REJECTED' },
  UNDER_REVIEW: { approve: 'APPROVED', reject: 'REJECTED' },
  REJECTED:     { reopen: 'DRAFT' },    // allow resubmission after fixes
  APPROVED:     {},                     // terminal
};

function ensureCan(user, resource, action) {
  if (!can(user, resource, action)) {
    throw Forbidden('ليس لديك صلاحية تنفيذ هذا الإجراء');
  }
}

function transition(current, event) {
  const next = VALID_TRANSITIONS[current]?.[event];
  if (!next) {
    throw BadRequest(`لا يمكن تنفيذ "${event}" من حالة "${current}"`);
  }
  return next;
}

/**
 * @param {import('express').Router} router — the route file's router (mutations mounted on it)
 * @param {{ model: string, resource: string }} opts
 *   model    — Prisma model name (camelCase, e.g. 'risk', 'nCR', 'supplierEval')
 *   resource — matrix key used by can() (e.g. 'risks', 'ncr', 'supplier-evals')
 */
export function attachWorkflow(router, { model, resource }) {

  // POST /:id/submit — Maker sends DRAFT → SUBMITTED
  router.post('/:id/submit', asyncHandler(async (req, res) => {
    ensureCan(req.user, resource, 'create');  // maker tier
    const item = await prisma[model].findUnique({ where: { id: req.params.id } });
    if (!item) throw NotFound();
    const next = transition(item.workflowState, 'submit');

    const updated = await prisma[model].update({
      where: { id: item.id },
      data: {
        workflowState:  next,
        submittedById:  req.user.id,
        submittedAt:    new Date(),
        rejectionReason: null,
      },
    });
    res.json({ ok: true, item: updated });
  }));

  // POST /:id/review — Checker claims SUBMITTED → UNDER_REVIEW
  router.post('/:id/review', asyncHandler(async (req, res) => {
    ensureCan(req.user, resource, 'update');  // checker tier
    const item = await prisma[model].findUnique({ where: { id: req.params.id } });
    if (!item) throw NotFound();
    // SoD: a user cannot review their own submission
    if (item.submittedById && item.submittedById === req.user.id && req.user.role !== 'SUPER_ADMIN') {
      throw Forbidden('لا يمكنك مراجعة سجل قمتَ بإرساله (فصل المهام)');
    }
    const next = transition(item.workflowState, 'pickUp');

    const updated = await prisma[model].update({
      where: { id: item.id },
      data: {
        workflowState: next,
        reviewedById:  req.user.id,
        reviewedAt:    new Date(),
      },
    });
    res.json({ ok: true, item: updated });
  }));

  // POST /:id/approve — Approver moves UNDER_REVIEW → APPROVED
  router.post('/:id/approve', asyncHandler(async (req, res) => {
    ensureCan(req.user, resource, 'approve');
    const item = await prisma[model].findUnique({ where: { id: req.params.id } });
    if (!item) throw NotFound();
    // SoD: approver cannot be the original submitter (break-glass for SUPER_ADMIN)
    if (item.submittedById && item.submittedById === req.user.id && req.user.role !== 'SUPER_ADMIN') {
      throw Forbidden('لا يمكنك اعتماد سجل قمتَ بإرساله (فصل المهام)');
    }
    const next = transition(item.workflowState, 'approve');

    const updated = await prisma[model].update({
      where: { id: item.id },
      data: {
        workflowState: next,
        approvedById:  req.user.id,
        approvedAt:    new Date(),
      },
    });
    res.json({ ok: true, item: updated });
  }));

  // POST /:id/reject — anyone in review chain can reject with reason
  router.post('/:id/reject', asyncHandler(async (req, res) => {
    ensureCan(req.user, resource, 'update');
    const reason = (req.body?.reason || '').toString().trim();
    if (!reason) throw BadRequest('سبب الرفض مطلوب');
    const item = await prisma[model].findUnique({ where: { id: req.params.id } });
    if (!item) throw NotFound();
    const next = transition(item.workflowState, 'reject');

    const updated = await prisma[model].update({
      where: { id: item.id },
      data: {
        workflowState:    next,
        rejectionReason:  reason,
        // clear downstream approver fields on reject
        approvedById:     null,
        approvedAt:       null,
      },
    });
    res.json({ ok: true, item: updated });
  }));

  // POST /:id/reopen — Maker reopens a REJECTED record to fix & resubmit
  router.post('/:id/reopen', asyncHandler(async (req, res) => {
    ensureCan(req.user, resource, 'update');
    const item = await prisma[model].findUnique({ where: { id: req.params.id } });
    if (!item) throw NotFound();
    const next = transition(item.workflowState, 'reopen');

    const updated = await prisma[model].update({
      where: { id: item.id },
      data: {
        workflowState:   next,
        reviewedById:    null,
        reviewedAt:      null,
        approvedById:    null,
        approvedAt:      null,
        rejectionReason: null,
      },
    });
    res.json({ ok: true, item: updated });
  }));
}
