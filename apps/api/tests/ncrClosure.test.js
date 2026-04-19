/**
 * tests/ncrClosure.test.js — قواعد إغلاق NCR (ISO 10.2).
 * اختبارات pure على الدوال التي لا تحتاج DB.
 */
import { describe, it, expect } from 'vitest';
import { normalizeNcr, guardClosure } from '../src/services/ncrClosure.js';

describe('normalizeNcr', () => {
  it('coerces "true"/"false" strings', () => {
    expect(normalizeNcr({ effective: 'true'  }).effective).toBe(true);
    expect(normalizeNcr({ effective: 'false' }).effective).toBe(false);
  });

  it('treats empty/null effective as null', () => {
    expect(normalizeNcr({ effective: '' }).effective).toBeNull();
    expect(normalizeNcr({ effective: null }).effective).toBeNull();
  });

  it('auto-stamps verifiedAt when effective is set', () => {
    const out = normalizeNcr({ effective: true });
    expect(out.verifiedAt).toBeInstanceOf(Date);
  });

  it('keeps existing verifiedAt when provided', () => {
    const d = new Date('2026-01-01');
    const out = normalizeNcr({ effective: true, verifiedAt: d });
    expect(out.verifiedAt).toBe(d);
  });

  it('leaves verifiedAt empty when effective is null', () => {
    const out = normalizeNcr({ effective: null });
    expect(out.verifiedAt).toBeUndefined();
  });
});

describe('guardClosure', () => {
  it('rejects CLOSED without effective=true', () => {
    expect(() => guardClosure({ status: 'CLOSED', effective: false }))
      .toThrow(/التحقق من فعالية/);
  });

  it('rejects CLOSED with effective=true but no verifiedAt', () => {
    expect(() => guardClosure({ status: 'CLOSED', effective: true }))
      .toThrow(/تاريخ التحقق/);
  });

  it('passes CLOSED with effective=true + verifiedAt', () => {
    expect(() => guardClosure({
      status: 'CLOSED', effective: true, verifiedAt: new Date(),
    })).not.toThrow();
  });

  it('no-op for non-CLOSED status', () => {
    expect(() => guardClosure({ status: 'OPEN' })).not.toThrow();
    expect(() => guardClosure({ status: 'ROOT_CAUSE', effective: false })).not.toThrow();
  });
});
