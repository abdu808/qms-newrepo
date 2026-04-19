/**
 * stateMachines.js — Formal status-transition maps for workflow-heavy entities.
 *
 * ISO 9001:2015 §7.5 — Documented information: controlled changes.
 * ISO 9001:2015 §10.2 — Nonconformity: defined treatment sequence.
 *
 * Unlike `workflow.js` (which implements the generic Maker/Checker/Approver
 * pattern on `workflowState`), these machines govern the domain `status`
 * field — the real business-meaning state the record is in.
 *
 * Why: today any user can jump NCR from OPEN straight to CLOSED if they pass
 * `guardClosure`. That's fine for the *closure guard*, but it lets records
 * skip Root-Cause → Action-Planned → Verification entirely, which is
 * non-compliant with ISO 10.2.
 *
 * Each machine is a map: currentStatus → allowedNextStatuses[]
 * Use `assertTransition(machine, from, to, { label })` to validate.
 */
import { BadRequest } from '../utils/errors.js';

// ═══════════════════════════════════════════════════════════════
//  NCR — ISO 10.2
//  OPEN → ROOT_CAUSE → ACTION_PLANNED → IN_PROGRESS → VERIFICATION → CLOSED
//  Any non-terminal state may regress by one step (re-analysis) or CANCEL.
// ═══════════════════════════════════════════════════════════════
export const NCR_STATUS = {
  OPEN:            ['ROOT_CAUSE', 'CANCELLED'],
  ROOT_CAUSE:      ['ACTION_PLANNED', 'OPEN', 'CANCELLED'],
  ACTION_PLANNED:  ['IN_PROGRESS', 'ROOT_CAUSE', 'CANCELLED'],
  IN_PROGRESS:     ['VERIFICATION', 'ACTION_PLANNED', 'CANCELLED'],
  VERIFICATION:    ['CLOSED', 'IN_PROGRESS', 'CANCELLED'],
  // CLOSED ↔ إعادة الفتح مسموحة لـ QM عبر مسار reopen المتخصص (يتطلّب سبباً مسجلاً).
  CLOSED:          ['IN_PROGRESS'],
  CANCELLED:       [],          // terminal
};

// ═══════════════════════════════════════════════════════════════
//  Complaint — ISO 9.1.2
//  NEW → UNDER_REVIEW → IN_PROGRESS → RESOLVED → CLOSED
//  ▸ إعادة الفتح (RESOLVED → IN_PROGRESS) مسموحة لأن المستفيد قد يعود بعد المعالجة.
// ═══════════════════════════════════════════════════════════════
export const COMPLAINT_STATUS = {
  NEW:           ['UNDER_REVIEW', 'IN_PROGRESS', 'CLOSED'],
  UNDER_REVIEW:  ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
  IN_PROGRESS:   ['RESOLVED', 'UNDER_REVIEW'],
  RESOLVED:      ['CLOSED', 'IN_PROGRESS'],
  // إعادة فتح الشكاوى عبر مسار reopen (يتطلّب QM + سبباً)
  CLOSED:        ['IN_PROGRESS'],
};

// ═══════════════════════════════════════════════════════════════
//  Audit — ISO 9.2
//  PLANNED → IN_PROGRESS → COMPLETED  (+ CANCELLED from any non-terminal)
// ═══════════════════════════════════════════════════════════════
export const AUDIT_STATUS = {
  PLANNED:      ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS:  ['COMPLETED', 'PLANNED', 'CANCELLED'],
  COMPLETED:    [],            // terminal
  CANCELLED:    [],            // terminal
};

// ═══════════════════════════════════════════════════════════════
//  ManagementReview — ISO 9.3
//  PLANNED → IN_PROGRESS → COMPLETED  (+ CANCELLED)
// ═══════════════════════════════════════════════════════════════
export const MGMT_REVIEW_STATUS = {
  PLANNED:      ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS:  ['COMPLETED', 'PLANNED', 'CANCELLED'],
  COMPLETED:    [],
  CANCELLED:    [],
};

// ═══════════════════════════════════════════════════════════════
//  Document — ISO 7.5.3
//  DRAFT → UNDER_REVIEW → APPROVED → PUBLISHED → OBSOLETE
//  ▸ الرجوع من UNDER_REVIEW/APPROVED إلى DRAFT مسموح (مراجعة ذاتية).
//  ▸ OBSOLETE قد يعاد إحياؤها فقط من خلال إنشاء وثيقة جديدة — terminal هنا.
//  ▸ Approve/Publish يحدث حصراً عبر services/documentApproval.js
//    (لا يمر من CRUD العام).
// ═══════════════════════════════════════════════════════════════
export const DOCUMENT_STATUS = {
  DRAFT:        ['UNDER_REVIEW', 'OBSOLETE'],
  UNDER_REVIEW: ['APPROVED', 'DRAFT', 'OBSOLETE'],
  APPROVED:     ['PUBLISHED', 'DRAFT', 'OBSOLETE'],
  PUBLISHED:    ['OBSOLETE', 'UNDER_REVIEW'],
  OBSOLETE:     [],
};

// ═══════════════════════════════════════════════════════════════
//  Core assertion
// ═══════════════════════════════════════════════════════════════

/**
 * Throws BadRequest when a status transition is not allowed by `machine`.
 * Silent no-op when `to` is undefined (caller didn't request a status change),
 * or when `from === to` (no-op update).
 *
 *   assertTransition(NCR_STATUS, current.status, data.status, { label: 'عدم المطابقة' });
 */
export function assertTransition(machine, from, to, { label = 'السجل', role } = {}) {
  if (to === undefined || to === null || to === '') return;   // no change requested
  if (from === to) return;                                     // no-op

  // Unknown source → configuration bug, reject with a clear message
  if (!(from in machine)) {
    throw BadRequest(`${label}: الحالة الحالية "${from}" غير معرَّفة في آلة الحالات`);
  }

  const allowed = machine[from];
  if (!allowed.includes(to)) {
    const allowedAr = allowed.length
      ? allowed.join(' أو ')
      : '(حالة نهائية — لا انتقال ممكن)';
    throw BadRequest(
      `${label}: لا يمكن الانتقال من "${from}" إلى "${to}". المسموح فقط: ${allowedAr}`,
    );
  }

  // Hook: break-glass — SUPER_ADMIN may need to force a transition.
  // Not yet used but kept so callers can pass `role` for future overrides.
  void role;
}

/**
 * Convenience: return the list of currently allowed next statuses.
 * Useful when rendering dropdowns on the front-end.
 */
export function allowedNext(machine, from) {
  return machine[from] || [];
}
