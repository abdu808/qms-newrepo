/**
 * myWork.integration.test.js — لوحة "مهامي اليوم" (Phase 1: Guided Mode).
 * يتحقّق من أن الـ payload يحتوي على الحقول الجديدة (pendingAcks, myDrafts)
 * ويُحصيها في summary.totalActions.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupTestDb, teardownTestDb, buildApp, getPrisma } from './setup.js';
import { createUser, createNCR } from './helpers/factories.js';
import { loginAs, authed } from './helpers/auth.js';

let app;
let prisma;

beforeAll(async () => {
  await setupTestDb();
  prisma = await getPrisma();
  app = await buildApp();
}, 120_000);
afterAll(async () => { await teardownTestDb(); });

describe('GET /api/my-work — Guided Mode payload', () => {
  it('يُرجع الحقول الأساسية + pendingAcks + myDrafts', async () => {
    const u = await createUser({ email: 'mywork1@test.local', role: 'EMPLOYEE' });
    const { token } = await loginAs(app, u.email);

    const res = await authed(app, token).get('/api/my-work');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    // الحقول الموجودة سابقاً
    expect(res.body).toHaveProperty('viewMode');
    expect(res.body).toHaveProperty('ncr');
    expect(res.body).toHaveProperty('complaints');
    expect(res.body).toHaveProperty('alerts');
    expect(res.body).toHaveProperty('summary');
    expect(typeof res.body.summary.totalActions).toBe('number');

    // الحقول الجديدة (Phase 1)
    expect(res.body).toHaveProperty('pendingAcks');
    expect(Array.isArray(res.body.pendingAcks)).toBe(true);
    expect(res.body).toHaveProperty('myDrafts');
    expect(res.body.myDrafts).toMatchObject({
      ncr: expect.any(Array),
      risks: expect.any(Array),
      documents: expect.any(Array),
      total: expect.any(Number),
    });
  });

  it('يحتسب مسوّدات NCR التي أنشأها المستخدم', async () => {
    const u = await createUser({ email: 'mywork2@test.local', role: 'EMPLOYEE' });
    // أنشئ NCR drafts برابط reporter على نفس المستخدم
    await createNCR({ reporterId: u.id, workflowState: 'DRAFT', status: 'OPEN', title: 'مسوّدة 1' });
    await createNCR({ reporterId: u.id, workflowState: 'DRAFT', status: 'OPEN', title: 'مسوّدة 2' });
    // NCR غير مسوّدة — ألا يُحسب
    await createNCR({ reporterId: u.id, workflowState: 'APPROVED', status: 'OPEN', title: 'معتمدة' });

    const { token } = await loginAs(app, u.email);
    const res = await authed(app, token).get('/api/my-work');
    expect(res.status).toBe(200);
    // نتحقّق على الأقل من أن المسوّدتين التي أنشأناهما ظهرتا (قد يسرّب
    // take: 10 سجلات قديمة — نكتفي بالحد الأدنى).
    expect(res.body.myDrafts.ncr.length).toBeGreaterThanOrEqual(2);
    expect(res.body.myDrafts.total).toBeGreaterThanOrEqual(2);
    // تأكّد أن المسوّدتين تظهران بالعناوين المتوقّعة
    const titles = res.body.myDrafts.ncr.map(d => d.title);
    expect(titles).toContain('مسوّدة 1');
    expect(titles).toContain('مسوّدة 2');
  });

  it('يُضيف تنبيه acks_pending عند وجود توكن إقرار غير مستخدَم', async () => {
    const u = await createUser({ email: 'mywork3@test.local', role: 'EMPLOYEE' });
    // أنشئ AckDocument ثم AckToken للمستخدم
    const doc = await prisma.ackDocument.create({
      data: {
        code: `POL-TEST-${Date.now()}`,
        title: 'سياسة اختبار',
        category: 'QUALITY_POLICY',
        audience: ['EMPLOYEE'],
        version: '1.0',
        content: 'نص السياسة',
        active: true,
      },
    });
    await prisma.ackToken.create({
      data: {
        documentId: doc.id,
        documentVersion: doc.version,
        userId: u.id,
      },
    });

    const { token } = await loginAs(app, u.email);
    const res = await authed(app, token).get('/api/my-work');
    expect(res.status).toBe(200);
    expect(res.body.pendingAcks.length).toBeGreaterThanOrEqual(1);
    const alert = (res.body.alerts || []).find(a => a.type === 'acks_pending');
    expect(alert).toBeTruthy();
    expect(alert.count).toBeGreaterThanOrEqual(1);
  });
});
