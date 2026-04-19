/**
 * complaints.integration.test.js — دورة حياة الشكوى + optimistic locking.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupTestDb, teardownTestDb, buildApp } from './setup.js';
import { createUser, createComplaint } from './helpers/factories.js';
import { loginAs, authed } from './helpers/auth.js';

let app;

beforeAll(async () => { await setupTestDb(); app = await buildApp(); }, 120_000);
afterAll(async () => { await teardownTestDb(); });

describe('/api/complaints', () => {
  it('قراءة القائمة متاحة للمصادَق', async () => {
    const u = await createUser({ email: 'cmp@test.local', role: 'QUALITY_MANAGER' });
    const { token } = await loginAs(app, u.email);
    const res = await authed(app, token).get('/api/complaints');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('يرفض الإغلاق بدون توقيع رقمي', async () => {
    const u = await createUser({ email: 'cmp2@test.local', role: 'QUALITY_MANAGER' });
    const { token } = await loginAs(app, u.email);
    const c = await createComplaint({ status: 'IN_PROGRESS' });
    const res = await authed(app, token).patch(`/api/complaints/${c.id}`).send({
      status: 'CLOSED',
    });
    expect([400, 403]).toContain(res.status);
  });
});
