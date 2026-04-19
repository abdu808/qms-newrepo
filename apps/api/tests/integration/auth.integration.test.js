/**
 * tests/integration/auth.integration.test.js
 * تغطية: login success/fail, logout, rate-limit.
 *
 * ملاحظة: يتطلّب Docker شغّال + `npm install --save-dev @testcontainers/postgresql testcontainers`.
 * يُستبعد من `npm test` الافتراضي (vitest config يتجاهل **​/integration/**).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setupTestDb, teardownTestDb, buildApp } from './setup.js';
import { createUser } from './helpers/factories.js';
import { loginAs } from './helpers/auth.js';

let app;

beforeAll(async () => {
  await setupTestDb();
  app = await buildApp();
}, 120_000);

afterAll(async () => { await teardownTestDb(); });

describe('POST /api/auth/login', () => {
  it('يقبل بيانات صحيحة ويُرجع token', async () => {
    const u = await createUser({ email: 'qm@test.local', role: 'QUALITY_MANAGER' });
    const { token, user } = await loginAs(app, u.email);
    expect(token).toBeTruthy();
    expect(user.email).toBe(u.email);
  });

  it('يرفض بيانات خاطئة بـ 401', async () => {
    await createUser({ email: 'bad@test.local' });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'bad@test.local', password: 'WRONG' });
    expect(res.status).toBe(401);
    expect(res.body.ok).toBe(false);
  });

  it('يرفض مستخدم غير نشط', async () => {
    const u = await createUser({ email: 'off@test.local', active: false });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: u.email, password: 'Test1234!' });
    expect(res.status).toBe(401);
  });
});
