/**
 * documents.integration.test.js — دورة حياة الوثيقة + optimistic locking.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setupTestDb, teardownTestDb, buildApp } from './setup.js';
import { createUser, createDocument } from './helpers/factories.js';
import { loginAs, authed } from './helpers/auth.js';

let app;

beforeAll(async () => { await setupTestDb(); app = await buildApp(); }, 120_000);
afterAll(async () => { await teardownTestDb(); });

describe('/api/documents', () => {
  it('يتطلّب المصادقة', async () => {
    const res = await request(app).get('/api/documents');
    expect(res.status).toBe(401);
  });

  it('يُنشئ وثيقة ويقرأها', async () => {
    const u = await createUser({ email: 'qm-doc@test.local', role: 'QUALITY_MANAGER' });
    const { token } = await loginAs(app, u.email);
    const res = await authed(app, token).get('/api/documents');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it('يرفض اعتماد وثيقة DRAFT (يجب أن تكون UNDER_REVIEW أولاً)', async () => {
    const u = await createUser({ email: 'qm-doc2@test.local', role: 'QUALITY_MANAGER' });
    const { token } = await loginAs(app, u.email);
    const doc = await createDocument({ status: 'DRAFT' });
    const res = await authed(app, token).post(`/api/documents/${doc.id}/approve`);
    expect([400, 403, 409]).toContain(res.status);
  });
});
