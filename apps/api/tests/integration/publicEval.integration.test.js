/**
 * publicEval.integration.test.js — تقييم مستفيد بتوكن.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setupTestDb, teardownTestDb, buildApp } from './setup.js';

let app;

beforeAll(async () => { await setupTestDb(); app = await buildApp(); }, 120_000);
afterAll(async () => { await teardownTestDb(); });

describe('GET /eval/:token', () => {
  it('يرفض توكن مجهول بـ 404', async () => {
    const res = await request(app).get('/eval/bogus-token');
    expect([404, 400, 410]).toContain(res.status);
    // المسار يعيد HTML لصفحة عامة؛ نكتفي بفحص رمز الحالة.
  });
});

describe('POST /eval/:token', () => {
  it('يرفض التقديم بدون توكن صالح', async () => {
    const res = await request(app)
      .post('/eval/bogus-token')
      .send({ criteriaJson: '{}' });
    expect([404, 400, 410]).toContain(res.status);
  });
});
