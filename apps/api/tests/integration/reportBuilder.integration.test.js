/**
 * reportBuilder.integration.test.js — Report Builder API (happy paths).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupTestDb, teardownTestDb, buildApp } from './setup.js';
import { createUser, createNCR, createComplaint } from './helpers/factories.js';
import { loginAs, authed } from './helpers/auth.js';

let app;

beforeAll(async () => { await setupTestDb(); app = await buildApp(); }, 120_000);
afterAll(async () => { await teardownTestDb(); });

describe('/api/report-builder', () => {
  it('GET /datasets يعيد كتالوج يحوي ncr + complaints', async () => {
    const u = await createUser({ email: 'rb1@test.local', role: 'QUALITY_MANAGER' });
    const { token } = await loginAs(app, u.email);
    const res = await authed(app, token).get('/api/report-builder/datasets');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    const keys = (res.body.datasets || []).map(d => d.key);
    expect(keys).toContain('ncr');
    expect(keys).toContain('complaints');
  });

  it('POST /run يرفض dataset غير معروف', async () => {
    const u = await createUser({ email: 'rb2@test.local', role: 'QUALITY_MANAGER' });
    const { token } = await loginAs(app, u.email);
    const res = await authed(app, token).post('/api/report-builder/run').send({ dataset: 'badX' });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('POST /run يعيد list mode مع select المحدَّد', async () => {
    const u = await createUser({ email: 'rb3@test.local', role: 'QUALITY_MANAGER' });
    const { token } = await loginAs(app, u.email);
    await createNCR({ severity: 'HIGH', status: 'OPEN' });
    await createNCR({ severity: 'LOW',  status: 'OPEN' });

    const res = await authed(app, token).post('/api/report-builder/run').send({
      dataset: 'ncr',
      columns: ['code', 'severity', 'status'],
      limit: 50,
    });
    expect(res.status).toBe(200);
    expect(res.body.mode).toBe('list');
    expect(res.body.rows.length).toBeGreaterThanOrEqual(2);
    for (const r of res.body.rows) {
      expect(Object.keys(r).sort()).toEqual(['code','severity','status'].sort());
    }
  });

  it('POST /run يدعم groupBy + _count', async () => {
    const u = await createUser({ email: 'rb4@test.local', role: 'QUALITY_MANAGER' });
    const { token } = await loginAs(app, u.email);
    await createComplaint({ status: 'NEW' });
    await createComplaint({ status: 'NEW' });
    await createComplaint({ status: 'IN_PROGRESS' });

    const res = await authed(app, token).post('/api/report-builder/run').send({
      dataset: 'complaints',
      groupBy: 'status',
    });
    expect(res.status).toBe(200);
    expect(res.body.mode).toBe('groupBy');
    const byStatus = Object.fromEntries(res.body.rows.map(r => [r.status, r._count?._all]));
    expect(byStatus.NEW).toBeGreaterThanOrEqual(2);
  });

  it('POST /export يعيد CSV', async () => {
    const u = await createUser({ email: 'rb5@test.local', role: 'QUALITY_MANAGER' });
    const { token } = await loginAs(app, u.email);
    await createNCR({});
    const res = await authed(app, token)
      .post('/api/report-builder/export')
      .send({ dataset: 'ncr', columns: ['code','status'], limit: 10 });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/csv/);
    expect(res.text).toContain('code,status');
  });

  it('يحجب الوصول عن EMPLOYEE', async () => {
    const u = await createUser({ email: 'rb6@test.local', role: 'EMPLOYEE' });
    const { token } = await loginAs(app, u.email);
    const res = await authed(app, token).get('/api/report-builder/datasets');
    expect([401, 403]).toContain(res.status);
  });
});
