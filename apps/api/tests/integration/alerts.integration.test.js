/**
 * alerts.integration.test.js — /api/alerts + /api/health/ready.
 *
 * Rationale: the alerts endpoint aggregates queries across many models
 * (supplier evals, NCRs, risks, etc). A single bad field name in that
 * aggregation silently 500s every dashboard call in production (this
 * actually happened with supplierEval.score → percentage). A smoke
 * test that just hits the endpoint and expects 200 would have caught it.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupTestDb, teardownTestDb, buildApp } from './setup.js';
import { createUser } from './helpers/factories.js';
import { loginAs, authed } from './helpers/auth.js';

let app;
beforeAll(async () => { await setupTestDb(); app = await buildApp(); }, 120_000);
afterAll(async () => { await teardownTestDb(); });

describe('GET /api/alerts — aggregate smoke test', () => {
  it('يُرجع 200 بدون أي خطأ Prisma (حتى لو لا توجد بيانات)', async () => {
    const u = await createUser({ email: 'alerts1@test.local', role: 'QUALITY_MANAGER' });
    const { token } = await loginAs(app, u.email);

    const res = await authed(app, token).get('/api/alerts');
    expect(res.status).toBe(200);
    // الشكل الأساسي فقط — التفاصيل قد تتغيّر بمرور الوقت
    expect(res.body).toBeTruthy();
  });
});

describe('GET /api/health/ready — deep readiness', () => {
  it('يُرجع ok:true عندما تكون قاعدة البيانات متاحة', async () => {
    // لا يحتاج مصادقة
    const res = await (await import('supertest')).default(app).get('/api/health/ready');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.db).toBe('ok');
    expect(typeof res.body.ms).toBe('number');
  });
});
