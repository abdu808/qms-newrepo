/**
 * kpi-bulk.integration.test.js — Bulk إدخال قراءات متعددة في دفعة واحدة،
 * يتحقّق من (1) نجاح السطور الصحيحة، (2) تجميع الأخطاء، (3) rollup مرة واحدة للأب.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupTestDb, teardownTestDb, buildApp } from './setup.js';
import { prisma } from '../../src/db.js';
import { createUser } from './helpers/factories.js';
import { loginAs, authed } from './helpers/auth.js';

let app;
beforeAll(async () => { await setupTestDb(); app = await buildApp(); }, 120_000);
afterAll(async () => { await teardownTestDb(); });

async function createTree(prefix) {
  const sg = await prisma.strategicGoal.create({
    data: { code: `${prefix}-SG-${Date.now()}`, title: 'هدف', progress: 0 },
  });
  const creator = await createUser({ email: `${prefix}-c@test.local`, role: 'QUALITY_MANAGER' });
  const obj = await prisma.objective.create({
    data: {
      code: `${prefix}-OBJ-${Date.now()}`, title: 'obj', kpi: 'k', target: 100,
      startDate: new Date(), dueDate: new Date(Date.now() + 31536000000),
      createdById: creator.id, strategicGoalId: sg.id,
      kpiType: 'CUMULATIVE', direction: 'HIGHER_BETTER',
    },
  });
  return { sg, obj };
}

describe('Bulk KPI entries', () => {
  it('يقبل دفعة صحيحة ويُنفّذ rollup مرة واحدة', async () => {
    const { obj } = await createTree('B1');
    const u = await createUser({ email: 'b1@test.local', role: 'QUALITY_MANAGER' });
    const { token } = await loginAs(app, u.email);

    const res = await authed(app, token).post('/api/kpi/entries/bulk').send({
      rows: [
        { objectiveId: obj.id, year: 2026, month: 1, actualValue: 20 },
        { objectiveId: obj.id, year: 2026, month: 2, actualValue: 30 },
        { objectiveId: obj.id, year: 2026, month: 3, actualValue: 40 },
      ],
    });
    expect(res.status).toBe(200);
    expect(res.body.inserted).toBe(3);
    expect(res.body.failed).toEqual([]);

    const after = await prisma.objective.findUnique({ where: { id: obj.id } });
    expect(after.progress).toBe(90); // 20+30+40 من 100
  });

  it('يجمع الأخطاء ولا يُفسد النجاحات', async () => {
    const { obj } = await createTree('B2');
    const u = await createUser({ email: 'b2@test.local', role: 'QUALITY_MANAGER' });
    const { token } = await loginAs(app, u.email);

    const res = await authed(app, token).post('/api/kpi/entries/bulk').send({
      rows: [
        { objectiveId: obj.id, year: 2026, month: 1, actualValue: 10 },
        { objectiveId: obj.id, year: 2026, month: 13, actualValue: 5 }, // شهر غير صالح
        { objectiveId: obj.id, year: 2026, month: 2, actualValue: 20 },
      ],
    });
    expect(res.status).toBe(200);
    expect(res.body.inserted).toBe(2);
    expect(res.body.failed.length).toBe(1);
    expect(res.body.failed[0].row).toBe(1);

    const after = await prisma.objective.findUnique({ where: { id: obj.id } });
    expect(after.progress).toBe(30); // 10+20
  });

  it('يرفض دفعة فارغة', async () => {
    const u = await createUser({ email: 'b3@test.local', role: 'QUALITY_MANAGER' });
    const { token } = await loginAs(app, u.email);
    const res = await authed(app, token).post('/api/kpi/entries/bulk').send({ rows: [] });
    expect(res.status).toBe(400);
  });
});
