import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { NotFound } from '../utils/errors.js';
import { crudRouter } from '../utils/crudFactory.js';
import { requireAction } from '../lib/permissions.js';
import { requireFields, intInRange, triBool } from '../lib/dataHelpers.js';

const base = crudRouter({
  resource: 'training',
  model: 'training',
  codePrefix: 'TRN',
  searchFields: ['title', 'trainer'],
  include: {
    records: { include: { user: { select: { id: true, name: true, email: true } } } },
  },
  allowedSortFields: ['createdAt', 'date'],
});

const router = Router();

// GET /:id/records — list attendance/effectiveness records
router.get('/:id/records', requireAction('training', 'read'), asyncHandler(async (req, res) => {
  const training = await prisma.training.findUnique({ where: { id: req.params.id } });
  if (!training) throw NotFound('التدريب غير موجود');
  const records = await prisma.trainingRecord.findMany({
    where: { trainingId: req.params.id },
    include: { user: { select: { id: true, name: true, email: true, jobTitle: true } } },
    orderBy: { createdAt: 'asc' },
  });
  // Stats
  const attended = records.filter(r => r.attended).length;
  const effective = records.filter(r => r.effective === true).length;
  const assessed  = records.filter(r => r.effective !== null && r.effective !== undefined).length;
  const avgScore  = (() => {
    const scores = records.map(r => r.score).filter(s => s !== null && s !== undefined);
    return scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100 : null;
  })();
  res.json({
    ok: true,
    training,
    records,
    stats: {
      total: records.length,
      attended,
      attendanceRate: records.length ? Math.round((attended / records.length) * 100) : 0,
      effective,
      assessed,
      effectivenessRate: assessed ? Math.round((effective / assessed) * 100) : 0,
      avgScore,
    },
  });
}));

// POST /:id/records — upsert a single record (attendance/score/effectiveness)
router.post('/:id/records', requireAction('training', 'update'), asyncHandler(async (req, res) => {
  const { userId, attended, score, effective, certUrl } = req.body;
  requireFields({ userId }, { userId: 'الموظف' });

  const t = await prisma.training.findUnique({ where: { id: req.params.id } });
  if (!t) throw NotFound('التدريب غير موجود');

  const data = {
    attended:  !!attended,
    score:     intInRange(score, { min: 0, max: 100, label: 'الدرجة' }),
    effective: triBool(effective, { label: 'الفعالية' }),
    certUrl:   certUrl || null,
  };

  const record = await prisma.trainingRecord.upsert({
    where: { trainingId_userId: { trainingId: req.params.id, userId } },
    update: data,
    create: { trainingId: req.params.id, userId, ...data },
    include: { user: { select: { id: true, name: true } } },
  });
  res.json({ ok: true, item: record });
}));

// DELETE /:id/records/:userId — remove a record
router.delete('/:id/records/:userId', requireAction('training', 'update'), asyncHandler(async (req, res) => {
  await prisma.trainingRecord.delete({
    where: { trainingId_userId: { trainingId: req.params.id, userId: req.params.userId } },
  });
  res.json({ ok: true });
}));

router.use('/', base);

export default router;
