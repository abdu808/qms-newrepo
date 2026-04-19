/**
 * rollup.integration.test.js — السلسلة التلقائية end-to-end:
 *   POST /api/kpi/entries  →  Objective.progress  →  StrategicGoal.progress
 *
 * نُنشئ: StrategicGoal → Objective + OperationalActivity أطفال، ثم نُدخل
 * قراءات ونتحقّق من انعكاس progress على الأب والجذر.
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

async function createTree(prefix) {
  const sg = await prisma.strategicGoal.create({
    data: {
      code:  `${prefix}-SG-${Date.now()}`,
      title: 'هدف استراتيجي اختبار',
      progress: 0,
    },
  });
  const creator = await createUser({ email: `${prefix}-c@test.local`, role: 'QUALITY_MANAGER' });
  const obj = await prisma.objective.create({
    data: {
      code:      `${prefix}-OBJ-${Date.now()}`,
      title:     'هدف تشغيلي اختبار',
      kpi:       'قراءات شهرية',
      target:    100,
      startDate: new Date(),
      dueDate:   new Date(Date.now() + 365 * 24 * 3600 * 1000),
      createdById:     creator.id,
      strategicGoalId: sg.id,
      kpiType:         'CUMULATIVE',
      direction:       'HIGHER_BETTER',
    },
  });
  const act = await prisma.operationalActivity.create({
    data: {
      code:            `${prefix}-ACT-${Date.now()}`,
      title:           'نشاط اختبار',
      targetValue:     200,
      kpiType:         'CUMULATIVE',
      direction:       'HIGHER_BETTER',
      strategicGoalId: sg.id,
    },
  });
  return { sg, obj, act, creator };
}

describe('Auto rollup: KpiEntry → Objective → StrategicGoal', () => {
  it('قراءة على Objective تُحدّث progress تلقائياً', async () => {
    const { sg, obj } = await createTree('R1');
    const u = await createUser({ email: 'r1-user@test.local', role: 'QUALITY_MANAGER' });
    const { token } = await loginAs(app, u.email);

    // قراءة 40 من هدف 100 → progress متوقع = 40
    const res = await authed(app, token).post('/api/kpi/entries').send({
      objectiveId: obj.id, year: 2026, month: 1, actualValue: 40,
    });
    expect([200, 201]).toContain(res.status);

    const after = await prisma.objective.findUnique({ where: { id: obj.id } });
    expect(after.progress).toBe(40);
    expect(Number(after.currentValue)).toBe(40);

    // الجذر الاستراتيجي يجب أن يعكس متوسط أطفاله
    const sgAfter = await prisma.strategicGoal.findUnique({ where: { id: sg.id } });
    // الأطفال: obj.progress=40 + act.progress=0 → avg=20
    expect(sgAfter.progress).toBe(20);
  });

  it('قراءات متعدّدة تراكمية تُجمع وتنعكس على الأب', async () => {
    const { obj } = await createTree('R2');
    const u = await createUser({ email: 'r2-user@test.local', role: 'QUALITY_MANAGER' });
    const { token } = await loginAs(app, u.email);

    await authed(app, token).post('/api/kpi/entries').send({
      objectiveId: obj.id, year: 2026, month: 1, actualValue: 30,
    });
    await authed(app, token).post('/api/kpi/entries').send({
      objectiveId: obj.id, year: 2026, month: 2, actualValue: 50,
    });

    const after = await prisma.objective.findUnique({ where: { id: obj.id } });
    // 30 + 50 = 80 من 100
    expect(after.progress).toBe(80);
    expect(Number(after.currentValue)).toBe(80);
  });

  it('قراءة على OperationalActivity تُحدّث progress + تجميع spent', async () => {
    const { sg, act } = await createTree('R3');
    const u = await createUser({ email: 'r3-user@test.local', role: 'QUALITY_MANAGER' });
    const { token } = await loginAs(app, u.email);

    // target=200، ندخل 100 → progress=50
    const res = await authed(app, token).post('/api/kpi/entries').send({
      activityId: act.id, year: 2026, month: 3, actualValue: 100, spent: 5000,
    });
    expect([200, 201]).toContain(res.status);

    const after = await prisma.operationalActivity.findUnique({ where: { id: act.id } });
    expect(after.progress).toBe(50);
    expect(Number(after.spent)).toBe(5000);

    const sgAfter = await prisma.strategicGoal.findUnique({ where: { id: sg.id } });
    // avg(obj=0, act=50) = 25
    expect(sgAfter.progress).toBe(25);
  });

  it('حذف قراءة يُعيد حساب progress تلقائياً', async () => {
    const { obj } = await createTree('R4');
    const u = await createUser({ email: 'r4-user@test.local', role: 'QUALITY_MANAGER' });
    const { token } = await loginAs(app, u.email);

    const created = await authed(app, token).post('/api/kpi/entries').send({
      objectiveId: obj.id, year: 2026, month: 1, actualValue: 60,
    });
    const entryId = created.body?.entry?.id || created.body?.item?.id;
    expect(entryId).toBeTruthy();

    let after = await prisma.objective.findUnique({ where: { id: obj.id } });
    expect(after.progress).toBe(60);

    const del = await authed(app, token).delete(`/api/kpi/entries/${entryId}`);
    expect(del.status).toBe(200);

    after = await prisma.objective.findUnique({ where: { id: obj.id } });
    expect(after.progress).toBe(0);
    expect(after.currentValue).toBeNull();
  });
});
