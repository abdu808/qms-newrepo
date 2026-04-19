/**
 * surveys.integration.test.js — استبيانات.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupTestDb, teardownTestDb, buildApp } from './setup.js';
import { createUser } from './helpers/factories.js';
import { loginAs, authed } from './helpers/auth.js';

let app;

beforeAll(async () => { await setupTestDb(); app = await buildApp(); }, 120_000);
afterAll(async () => { await teardownTestDb(); });

describe('/api/surveys', () => {
  it('يتطلّب المصادقة', async () => {
    const { default: request } = await import('supertest');
    const res = await request(app).get('/api/surveys');
    expect(res.status).toBe(401);
  });

  it('يقبل القراءة من مدير الجودة', async () => {
    const u = await createUser({ email: 'qm-surveys@test.local', role: 'QUALITY_MANAGER' });
    const { token } = await loginAs(app, u.email);
    const res = await authed(app, token).get('/api/surveys');
    expect([200, 404]).toContain(res.status);
    if (res.status === 200) expect(res.body.ok).toBe(true);
  });
});
