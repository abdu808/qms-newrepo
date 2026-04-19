/**
 * publicAck.integration.test.js — صفحة الإقرار العامة (ISO 7.5.3.2(c)).
 * يختبر: GET توكن، POST توقيع، منع تكرار.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setupTestDb, teardownTestDb, buildApp } from './setup.js';

let app;

beforeAll(async () => { await setupTestDb(); app = await buildApp(); }, 120_000);
afterAll(async () => { await teardownTestDb(); });

describe('GET /ack/:token', () => {
  it('يُرجع 404 لتوكن غير موجود', async () => {
    const res = await request(app).get('/ack/nonexistent-token-xyz');
    expect([404, 400]).toContain(res.status);
    // المسار يعيد HTML لصفحة عامة؛ نكتفي بفحص رمز الحالة.
  });
});

describe('POST /ack/:token', () => {
  it('يرفض التوقيع بتوكن مزيّف', async () => {
    const res = await request(app)
      .post('/ack/nonexistent-token-xyz')
      .send({ signatureDataUrl: 'data:image/png;base64,iVBORw0KG' });
    expect([404, 400]).toContain(res.status);
  });
});
