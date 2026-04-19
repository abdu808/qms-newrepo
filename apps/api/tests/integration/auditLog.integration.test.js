/**
 * auditLog.integration.test.js — فلترة + تصدير سجل النشاط.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupTestDb, teardownTestDb, buildApp, getPrisma } from './setup.js';
import { createUser } from './helpers/factories.js';
import { loginAs, authed } from './helpers/auth.js';

let app;
let prisma;

beforeAll(async () => {
  await setupTestDb();
  prisma = await getPrisma();
  app = await buildApp();
}, 120_000);
afterAll(async () => { await teardownTestDb(); });

async function seedLog(user, action, entityType) {
  return prisma.auditLog.create({
    data: { userId: user.id, action, entityType, entityId: 'x', at: new Date() },
  });
}

describe('GET /api/audit-log', () => {
  it('يعيد قائمة مع pagination envelope', async () => {
    const u = await createUser({ email: 'al1@test.local', role: 'QUALITY_MANAGER' });
    const { token } = await loginAs(app, u.email);
    for (let i = 0; i < 3; i++) await seedLog(u, 'CREATE', 'Complaint');
    const res = await authed(app, token).get('/api/audit-log?limit=10');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('page');
    expect(res.body).toHaveProperty('pages');
    expect(res.body).toHaveProperty('items');
    expect(res.body.items.length).toBeGreaterThan(0);
  });

  it('يفلتر بـ entityType', async () => {
    const u = await createUser({ email: 'al2@test.local', role: 'QUALITY_MANAGER' });
    const { token } = await loginAs(app, u.email);
    await seedLog(u, 'CREATE', 'UniqueEntityAA');
    const res = await authed(app, token).get('/api/audit-log?entityType=UniqueEntityAA');
    expect(res.status).toBe(200);
    for (const it of res.body.items) expect(it.entityType).toBe('UniqueEntityAA');
  });

  it('يحجب EMPLOYEE', async () => {
    const u = await createUser({ email: 'al3@test.local', role: 'EMPLOYEE' });
    const { token } = await loginAs(app, u.email);
    const res = await authed(app, token).get('/api/audit-log');
    expect([401, 403]).toContain(res.status);
  });
});

describe('GET /api/audit-log/export', () => {
  it('يعيد CSV مع رأس صحيح', async () => {
    const u = await createUser({ email: 'al4@test.local', role: 'QUALITY_MANAGER' });
    const { token } = await loginAs(app, u.email);
    await seedLog(u, 'UPDATE', 'NCR');
    const res = await authed(app, token).get('/api/audit-log/export?entityType=NCR');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/csv/);
    expect(res.headers['x-export-count']).toBeDefined();
    expect(res.text.split('\n')[0]).toContain('at');
    expect(res.text.split('\n')[0]).toContain('action');
  });
});
