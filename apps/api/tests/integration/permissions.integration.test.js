import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
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

describe('RBAC alignment with permissions matrix', () => {
  it('يحجب QUALITY_MANAGER عن إنشاء المستخدمين', async () => {
    const qm = await createUser({ email: 'perm-qm@test.local', role: 'QUALITY_MANAGER' });
    const { token } = await loginAs(app, qm.email);

    const res = await authed(app, token).post('/api/users').send({
      email: 'new-user@test.local',
      name: 'مستخدم جديد',
      password: 'Test1234!',
      role: 'EMPLOYEE',
    });

    expect(res.status).toBe(403);
  });

  it('يسمح لـ DEPT_MANAGER بقراءة قائمة المستخدمين وفق المصفوفة', async () => {
    const manager = await createUser({ email: 'perm-mgr@test.local', role: 'DEPT_MANAGER' });
    const { token } = await loginAs(app, manager.email);

    const res = await authed(app, token).get('/api/users');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('يحجب EMPLOYEE عن timeline سجل التدقيق الفردي', async () => {
    const owner = await createUser({ email: 'perm-owner@test.local', role: 'QUALITY_MANAGER' });
    await prisma.auditLog.create({
      data: {
        userId: owner.id,
        action: 'TEST_AUDIT_EVENT',
        entityType: 'Document',
        entityId: 'doc-1',
        at: new Date(),
      },
    });

    const employee = await createUser({ email: 'perm-emp@test.local', role: 'EMPLOYEE' });
    const { token } = await loginAs(app, employee.email);
    const res = await authed(app, token).get('/api/audit-log/for/Document/doc-1');
    expect(res.status).toBe(403);
  });

  it('يحجب EMPLOYEE عن إنشاء سياسة جودة عبر CRUD الأساسي', async () => {
    const employee = await createUser({ email: 'perm-policy@test.local', role: 'EMPLOYEE' });
    const { token } = await loginAs(app, employee.email);

    const res = await authed(app, token).post('/api/quality-policy').send({
      title: 'سياسة غير مصرّح بها',
      version: '1.0',
      content: 'نص سياسة اختبار',
    });

    expect(res.status).toBe(403);
  });

  it('يسمح لـ QUALITY_MANAGER بقراءة سجل التدقيق وفق المصفوفة', async () => {
    const qm = await createUser({ email: 'perm-audit-read@test.local', role: 'QUALITY_MANAGER' });
    const { token } = await loginAs(app, qm.email);

    const res = await authed(app, token).get('/api/audit-log');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
