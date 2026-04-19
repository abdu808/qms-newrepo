import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAction } from '../lib/permissions.js';
import { requireFields } from '../lib/dataHelpers.js';
import { parsePagination, paginationEnvelope } from '../utils/pagination.js';

const router = Router();

router.get('/', requireAction('signatures', 'read'), asyncHandler(async (req, res) => {
  const { entityType, entityId } = req.query;
  const where = {};
  if (entityType) where.entityType = entityType;
  if (entityId)   where.entityId = entityId;
  const { page, limit, skip } = parsePagination(req);
  const [total, items] = await Promise.all([
    prisma.signature.count({ where }),
    prisma.signature.findMany({
      where, include: { user: { select: { id: true, name: true, role: true } } },
      orderBy: { signedAt: 'desc' }, skip, take: limit,
    }),
  ]);
  res.json({ ok: true, ...paginationEnvelope({ total, page, limit, items }) });
}));

router.post('/', requireAction('signatures', 'create'), asyncHandler(async (req, res) => {
  const { entityType, entityId, purpose, signatureData } = req.body;
  requireFields(req.body, {
    entityType:    'نوع الكيان',
    entityId:      'معرف الكيان',
    signatureData: 'بيانات التوقيع',
  });
  const sig = await prisma.signature.create({
    data: {
      userId: req.user.sub, entityType, entityId,
      purpose: purpose || 'approve', signatureData,
      ipAddress: req.ip,
    },
  });
  res.status(201).json({ ok: true, item: sig });
}));

export default router;
