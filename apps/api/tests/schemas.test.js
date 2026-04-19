/**
 * tests/schemas.test.js — Zod schemas (pure، بلا DB).
 * ضمانة أن قواعد التحقق لا تنكسر مع التعديلات المستقبلية.
 */
import { describe, it, expect } from 'vitest';
import { createSchema as userCreate, updateSchema as userUpdate } from '../src/schemas/user.schema.js';
import { createSchema as docCreate } from '../src/schemas/document.schema.js';
import { createSchema as complaintCreate } from '../src/schemas/complaint.schema.js';
import { createSchema as ncrCreate, updateSchema as ncrUpdate } from '../src/schemas/ncr.schema.js';
import { createSchema as kpiCreate } from '../src/schemas/kpiEntry.schema.js';
import { createSchema as benCreate } from '../src/schemas/beneficiary.schema.js';

describe('user schema', () => {
  it('accepts a valid user', () => {
    const r = userCreate.safeParse({
      email: '  Foo@Bar.COM ', name: 'أحمد', password: 'pass1234', role: 'EMPLOYEE',
    });
    expect(r.success).toBe(true);
    expect(r.data.email).toBe('foo@bar.com'); // normalized
  });

  it('rejects an invalid email', () => {
    const r = userCreate.safeParse({ email: 'not-an-email', name: 'x' });
    expect(r.success).toBe(false);
  });

  it('rejects a short name', () => {
    const r = userCreate.safeParse({ email: 'a@b.com', name: 'a' });
    expect(r.success).toBe(false);
  });

  it('allows partial update', () => {
    const r = userUpdate.safeParse({ name: 'اسم جديد' });
    expect(r.success).toBe(true);
  });
});

describe('document schema', () => {
  it('accepts a draft document', () => {
    const r = docCreate.safeParse({ title: 'دليل الجودة', category: 'MANUAL' });
    expect(r.success).toBe(true);
    expect(r.data.status).toBe('DRAFT'); // default
  });

  it('rejects invalid category', () => {
    const r = docCreate.safeParse({ title: 'سياسة الجودة', category: 'BOGUS' });
    expect(r.success).toBe(false);
  });

  it('rejects invalid version format', () => {
    const r = docCreate.safeParse({ title: 'سياسة', category: 'MANUAL', currentVersion: 'v1.0' });
    expect(r.success).toBe(false);
  });

  it('accepts valid version format', () => {
    const r = docCreate.safeParse({ title: 'سياسة', category: 'MANUAL', currentVersion: '2.3' });
    expect(r.success).toBe(true);
  });
});

describe('complaint schema', () => {
  it('accepts a valid complaint', () => {
    const r = complaintCreate.safeParse({
      source: 'BENEFICIARY', channel: 'PHONE',
      subject: 'تأخر صرف المعونة',
      description: 'لم تُصرف المعونة الشهرية منذ شهرين',
    });
    expect(r.success).toBe(true);
    expect(r.data.severity).toBe('متوسطة'); // default
  });

  it('rejects short description', () => {
    const r = complaintCreate.safeParse({
      source: 'BENEFICIARY', channel: 'PHONE', subject: 'x', description: 'قصير',
    });
    expect(r.success).toBe(false);
  });
});

describe('ncr schema', () => {
  it('accepts boolean "true" string for effective', () => {
    const r = ncrUpdate.safeParse({ effective: 'true' });
    expect(r.success).toBe(true);
    expect(r.data.effective).toBe(true);
  });

  it('accepts Arabic severity', () => {
    const r = ncrCreate.safeParse({
      title: 'خطأ في التوثيق',
      description: 'تم اكتشاف عدم مطابقة في ملف X',
      severity: 'مرتفعة',
    });
    expect(r.success).toBe(true);
  });

  it('rejects unknown severity', () => {
    const r = ncrCreate.safeParse({
      title: 'x', description: 'وصف كاف طويل بما يكفي',
      severity: 'critical',
    });
    expect(r.success).toBe(false);
  });
});

describe('kpi entry schema', () => {
  it('requires objectiveId OR activityId', () => {
    const r = kpiCreate.safeParse({ year: 2026, month: 1, actualValue: 50 });
    expect(r.success).toBe(false);
  });

  it('accepts with objectiveId', () => {
    const r = kpiCreate.safeParse({
      objectiveId: 'clxabc', year: 2026, month: 3, actualValue: 75,
    });
    expect(r.success).toBe(true);
  });

  it('rejects month out of range', () => {
    const r = kpiCreate.safeParse({
      activityId: 'x', year: 2026, month: 13, actualValue: 1,
    });
    expect(r.success).toBe(false);
  });

  it('coerces string numbers', () => {
    const r = kpiCreate.safeParse({
      objectiveId: 'a', year: '2026', month: '5', actualValue: '123.5',
    });
    expect(r.success).toBe(true);
    expect(r.data.actualValue).toBe(123.5);
  });
});

describe('beneficiary schema', () => {
  it('accepts valid applicant', () => {
    const r = benCreate.safeParse({ fullName: 'فاطمة علي', category: 'WIDOW' });
    expect(r.success).toBe(true);
    expect(r.data.status).toBe('APPLICANT');
  });

  it('rejects invalid national ID (letters)', () => {
    const r = benCreate.safeParse({
      fullName: 'x', category: 'ORPHAN', nationalId: 'ABC12345',
    });
    expect(r.success).toBe(false);
  });

  it('allows empty nationalId (optional)', () => {
    const r = benCreate.safeParse({
      fullName: 'محمد', category: 'POOR_FAMILY', nationalId: '',
    });
    expect(r.success).toBe(true);
    expect(r.data.nationalId).toBeNull();
  });
});
