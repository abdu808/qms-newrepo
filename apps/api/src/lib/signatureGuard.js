/**
 * signatureGuard.js — Enforce digital signature before closing/finalizing records.
 *
 * ISO 9001:2015 §7.1.5.2 — Measurement traceability (records of approvals).
 * ISO 9001:2015 §10.2     — NCR closure with verified corrective action.
 * ISO 9001:2015 §9.3.3    — Management review output must be documented.
 *
 * The Signature table is the single source of truth for "who personally
 * attested to this action, from which IP, at what time". When a record
 * transitions to a terminal state, the code REFUSES the transition unless
 * a matching Signature row exists (user-id, entityType, entityId, purpose).
 *
 * Users create signatures via `POST /api/signatures` — the UI collects the
 * drawn/typed signature and calls that endpoint before submitting the close.
 */
import { prisma } from '../db.js';
import { BadRequest } from '../utils/errors.js';

/**
 * Look up whether `userId` has signed `entity` for the given `purpose`.
 *
 *   const ok = await hasSignature(req.user.sub, { entityType: 'NCR', entityId: id, purpose: 'close' });
 */
export async function hasSignature(userId, { entityType, entityId, purpose }) {
  if (!userId || !entityType || !entityId || !purpose) return false;
  const sig = await prisma.signature.findFirst({
    where: { userId, entityType, entityId, purpose },
    select: { id: true },
  });
  return Boolean(sig);
}

/**
 * Throw BadRequest with a clear Arabic message when the required signature
 * is missing.  Call this inside `beforeUpdate` right before allowing the
 * transition to a terminal status.
 *
 * Usage:
 *   await requireSignatureFor(req, {
 *     entityType: 'NCR',
 *     entityId:   req.params.id,
 *     purpose:    'close',
 *     label:      'إغلاق عدم المطابقة',
 *   });
 */
export async function requireSignatureFor(req, { entityType, entityId, purpose, label }) {
  const ok = await hasSignature(req.user?.sub, { entityType, entityId, purpose });
  if (ok) return;
  throw BadRequest(
    `${label}: يتطلب توقيعاً رقمياً من المستخدم الحالي قبل التنفيذ. ` +
    `سجّل التوقيع عبر POST /api/signatures بـ purpose="${purpose}" ثم أعد المحاولة.`,
  );
}

/**
 * Bulk lookup helper — returns a Set of entityIds the user has signed for
 * a given (entityType, purpose). Useful when rendering a list view where
 * each row needs to know whether the "close" button is eligible.
 */
export async function listSignedIds(userId, { entityType, purpose, entityIds }) {
  if (!userId || !entityIds?.length) return new Set();
  const sigs = await prisma.signature.findMany({
    where: { userId, entityType, purpose, entityId: { in: entityIds } },
    select: { entityId: true },
  });
  return new Set(sigs.map(s => s.entityId));
}
