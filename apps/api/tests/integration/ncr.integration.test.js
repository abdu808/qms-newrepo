/**
 * ncr.integration.test.js — دورة حياة NCR + optimistic locking على CLOSE.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupTestDb, teardownTestDb, buildApp } from './setup.js';
import { createUser, createNCR } from './helpers/factories.js';
import { loginAs, authed } from './helpers/auth.js';

let app;

beforeAll(async () => { await setupTestDb(); app = await buildApp(); }, 120_000);
afterAll(async () => { await teardownTestDb(); });

describe('/api/ncr', () => {
  it('قراءة القائمة متاحة للمصادَق', async () => {
    const u = await createUser({ email: 'ncr@test.local', role: 'QUALITY_MANAGER' });
    const { token } = await loginAs(app, u.email);
    const res = await authed(app, token).get('/api/ncr');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('يرفض الإغلاق بدون التحقق من الفعالية', async () => {
    const u = await createUser({ email: 'ncr2@test.local', role: 'QUALITY_MANAGER' });
    const { token } = await loginAs(app, u.email);
    const ncr = await createNCR({ status: 'VERIFICATION', effective: null });
    const res = await authed(app, token).patch(`/api/ncr/${ncr.id}`).send({
      status: 'CLOSED',
    });
    expect([400, 403]).toContain(res.status);
    expect(res.body.ok).toBe(false);
  });
});
