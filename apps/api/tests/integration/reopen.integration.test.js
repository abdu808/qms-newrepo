/**
 * reopen.integration.test.js — إعادة فتح NCR/Complaint (ISO 10.2 · 9.1.2).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupTestDb, teardownTestDb, buildApp } from './setup.js';
import { prisma } from '../../src/db.js';
import { createUser, createNCR, createComplaint } from './helpers/factories.js';
import { loginAs, authed } from './helpers/auth.js';

let app;

beforeAll(async () => { await setupTestDb(); app = await buildApp(); }, 120_000);
afterAll(async () => { await teardownTestDb(); });

describe('POST /api/ncr/:id/reopen', () => {
  it('QUALITY_MANAGER يعيد فتح NCR مغلقة مع سبب صحيح', async () => {
    const u = await createUser({ email: 'rop1@test.local', role: 'QUALITY_MANAGER' });
    const { token } = await loginAs(app, u.email);
    const n = await createNCR({ status: 'CLOSED', version: 0 });
    const res = await authed(app, token).post(`/api/ncr/${n.id}/reopen`).send({
      reason: 'تم اكتشاف تكرار المشكلة بعد الإغلاق وتحتاج إعادة تحليل',
    });
    expect(res.status).toBe(200);
    expect(res.body.item.status).toBe('IN_PROGRESS');
    // AuditLog
    const log = await prisma.auditLog.findFirst({
      where: { action: 'REOPEN_NCR', entityId: n.id },
    });
    expect(log).toBeTruthy();
  });

  it('يرفض سبباً قصيراً', async () => {
    const u = await createUser({ email: 'rop2@test.local', role: 'QUALITY_MANAGER' });
    const { token } = await loginAs(app, u.email);
    const n = await createNCR({ status: 'CLOSED', version: 0 });
    const res = await authed(app, token).post(`/api/ncr/${n.id}/reopen`).send({ reason: 'قصير' });
    expect(res.status).toBe(400);
  });

  it('يحجب EMPLOYEE', async () => {
    const u = await createUser({ email: 'rop3@test.local', role: 'EMPLOYEE' });
    const { token } = await loginAs(app, u.email);
    const n = await createNCR({ status: 'CLOSED', version: 0 });
    const res = await authed(app, token).post(`/api/ncr/${n.id}/reopen`).send({
      reason: 'سبب معقول بتفاصيل كافية',
    });
    expect([401, 403]).toContain(res.status);
  });

  it('يرفض إعادة فتح سجل غير مغلق', async () => {
    const u = await createUser({ email: 'rop4@test.local', role: 'QUALITY_MANAGER' });
    const { token } = await loginAs(app, u.email);
    const n = await createNCR({ status: 'IN_PROGRESS', version: 0 });
    const res = await authed(app, token).post(`/api/ncr/${n.id}/reopen`).send({
      reason: 'سبب معقول بتفاصيل كافية',
    });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/complaints/:id/reopen', () => {
  it('SUPER_ADMIN يعيد فتح شكوى مغلقة', async () => {
    const u = await createUser({ email: 'rop5@test.local', role: 'SUPER_ADMIN' });
    const { token } = await loginAs(app, u.email);
    const c = await createComplaint({ status: 'CLOSED', version: 0 });
    const res = await authed(app, token).post(`/api/complaints/${c.id}/reopen`).send({
      reason: 'استلمنا معلومات جديدة تتطلب إعادة النظر',
    });
    expect(res.status).toBe(200);
    expect(res.body.item.status).toBe('IN_PROGRESS');
    const log = await prisma.auditLog.findFirst({
      where: { action: 'REOPEN_COMPLAINT', entityId: c.id },
    });
    expect(log).toBeTruthy();
  });
});
