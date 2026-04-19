import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { NotFound } from '../utils/errors.js';
import { config } from '../config.js';
import { requireAction } from '../lib/permissions.js';

const router = Router();

// POST /api/eval-tokens  — create shareable evaluation link for a supplier
router.post('/', requireAction('suppliers', 'update'), asyncHandler(async (req, res) => {
  const { supplierId, daysValid = 30 } = req.body;

  const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
  if (!supplier) throw NotFound('المورد غير موجود');

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + Number(daysValid));

  const evalToken = await prisma.evalToken.create({
    data: {
      supplierId,
      createdById: req.user.sub,
      expiresAt,
    },
    include: { supplier: { select: { name: true, code: true } } },
  });

  const baseUrl = config.appUrl.replace(/\/$/, '');
  const url = `${baseUrl}/eval/${evalToken.token}`;

  res.status(201).json({ ok: true, token: evalToken.token, url, expiresAt, supplier: evalToken.supplier });
}));

// GET /api/eval-tokens?supplierId=xxx  — list tokens for a supplier
router.get('/', requireAction('suppliers', 'read'), asyncHandler(async (req, res) => {
  const where = {};
  if (req.query.supplierId) where.supplierId = req.query.supplierId;

  const tokens = await prisma.evalToken.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { supplier: { select: { name: true, code: true } } },
  });

  const baseUrl = config.appUrl.replace(/\/$/, '');
  const items = tokens.map(t => ({
    ...t,
    url: `${baseUrl}/eval/${t.token}`,
    expired: t.expiresAt < new Date(),
    used: !!t.usedAt,
  }));

  res.json({ ok: true, items });
}));

// DELETE /api/eval-tokens/:id  — revoke a token
router.delete('/:id', requireAction('suppliers', 'update'), asyncHandler(async (req, res) => {
  await prisma.evalToken.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
}));

export default router;
