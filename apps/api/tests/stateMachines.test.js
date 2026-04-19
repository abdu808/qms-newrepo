/**
 * tests/stateMachines.test.js — آلات الحالات (NCR / Complaint / Document / Audit).
 */
import { describe, it, expect } from 'vitest';
import {
  NCR_STATUS, COMPLAINT_STATUS, AUDIT_STATUS,
  MGMT_REVIEW_STATUS, DOCUMENT_STATUS,
  assertTransition, allowedNext,
} from '../src/lib/stateMachines.js';

describe('NCR state machine (ISO 10.2)', () => {
  it('allows OPEN → ROOT_CAUSE', () => {
    expect(() => assertTransition(NCR_STATUS, 'OPEN', 'ROOT_CAUSE')).not.toThrow();
  });

  it('rejects OPEN → CLOSED (skipping states)', () => {
    expect(() => assertTransition(NCR_STATUS, 'OPEN', 'CLOSED'))
      .toThrow(/لا يمكن الانتقال/);
  });

  it('allows VERIFICATION → CLOSED', () => {
    expect(() => assertTransition(NCR_STATUS, 'VERIFICATION', 'CLOSED')).not.toThrow();
  });

  it('CLOSED ↔ إعادة الفتح المضبوطة إلى IN_PROGRESS فقط', () => {
    // لا يمكن الرجوع إلى OPEN مباشرة — يجب المرور بـ IN_PROGRESS
    expect(() => assertTransition(NCR_STATUS, 'CLOSED', 'OPEN')).toThrow();
    // إعادة الفتح إلى IN_PROGRESS مسموحة (يحرسها reopenGuard بالدور + السبب)
    expect(() => assertTransition(NCR_STATUS, 'CLOSED', 'IN_PROGRESS')).not.toThrow();
    expect(allowedNext(NCR_STATUS, 'CLOSED')).toEqual(['IN_PROGRESS']);
  });

  it('no-op transition is silent', () => {
    expect(() => assertTransition(NCR_STATUS, 'OPEN', 'OPEN')).not.toThrow();
    expect(() => assertTransition(NCR_STATUS, 'OPEN', undefined)).not.toThrow();
  });
});

describe('Complaint state machine', () => {
  it('allows NEW → UNDER_REVIEW', () => {
    expect(() => assertTransition(COMPLAINT_STATUS, 'NEW', 'UNDER_REVIEW')).not.toThrow();
  });

  it('rejects IN_PROGRESS → NEW (backward skip)', () => {
    expect(() => assertTransition(COMPLAINT_STATUS, 'IN_PROGRESS', 'NEW')).toThrow();
  });
});

describe('Document state machine (ISO 7.5.3)', () => {
  it('allows DRAFT → UNDER_REVIEW', () => {
    expect(() => assertTransition(DOCUMENT_STATUS, 'DRAFT', 'UNDER_REVIEW')).not.toThrow();
  });

  it('rejects DRAFT → PUBLISHED', () => {
    expect(() => assertTransition(DOCUMENT_STATUS, 'DRAFT', 'PUBLISHED')).toThrow();
  });

  it('allows APPROVED → PUBLISHED', () => {
    expect(() => assertTransition(DOCUMENT_STATUS, 'APPROVED', 'PUBLISHED')).not.toThrow();
  });

  it('allows rollback PUBLISHED → UNDER_REVIEW', () => {
    expect(() => assertTransition(DOCUMENT_STATUS, 'PUBLISHED', 'UNDER_REVIEW')).not.toThrow();
  });

  it('OBSOLETE is terminal', () => {
    expect(allowedNext(DOCUMENT_STATUS, 'OBSOLETE')).toEqual([]);
  });
});

describe('Audit state machine', () => {
  it('allows PLANNED → IN_PROGRESS → COMPLETED', () => {
    expect(() => assertTransition(AUDIT_STATUS, 'PLANNED', 'IN_PROGRESS')).not.toThrow();
    expect(() => assertTransition(AUDIT_STATUS, 'IN_PROGRESS', 'COMPLETED')).not.toThrow();
  });
});

describe('MgmtReview state machine (ISO 9.3)', () => {
  it('allows PLANNED → IN_PROGRESS → COMPLETED', () => {
    expect(() => assertTransition(MGMT_REVIEW_STATUS, 'PLANNED', 'IN_PROGRESS')).not.toThrow();
    expect(() => assertTransition(MGMT_REVIEW_STATUS, 'IN_PROGRESS', 'COMPLETED')).not.toThrow();
  });

  it('COMPLETED is terminal', () => {
    expect(allowedNext(MGMT_REVIEW_STATUS, 'COMPLETED')).toEqual([]);
  });
});
