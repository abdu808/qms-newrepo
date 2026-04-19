/**
 * kpi.integration.test.js — إدخال قراءات KPI + حارس الشهر المقفل.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupTestDb, teardownTestDb, buildApp } from './setup.js';
import { createUser } from './helpers/factories.js';
import { loginAs, authed } from './helpers/auth.js';

let app;

beforeAll(async () => { await setupTestDb(); app = await buildApp(); }, 120_000);
afterAll(async () => { await teardownTestDb(); });

describe('/api/kpi/entries', () => {
  it('يتطلّب المصادقة', async () => {
    const { default: request } = await import('supertest');
    const res = await request(app).post('/api/kpi/entries').send({});
    expect(res.status).toBe(401);
  });

  it('يرفض الإدخال بدون objectiveId أو activityId', async () => {
    const u = await createUser({ email: 'kpi@test.local', role: 'QUALITY_MANAGER' });
    const { token } = await loginAs(app, u.email);
    const res = await authed(app, token).post('/api/kpi/entries').send({
      year: 2026, month: 1, value: 50,
    });
    expect([400, 422]).toContain(res.status);
    expect(res.body.ok).toBe(false);
  });
});
