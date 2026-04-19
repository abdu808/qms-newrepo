/**
 * notifications.js — صندوق إشعارات المستخدم
 * P-06 §4 · ISO 9001 §7.4
 */
import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { parsePagination, paginationEnvelope } from '../utils/pagination.js';

const router = Router();

/**
 * GET /api/notifications?unread=1&page=1&limit=50
 * صندوق الإشعارات الخاص بالمستخدم — مع pagination موحَّد.
 */
router.get('/', asyncHandler(async (req, res) => {
  const unreadOnly = req.query.unread === '1' || req.query.unread === 'true';
  const { page, limit, skip } = parsePagination(req, { defaultLimit: 50, maxLimit: 200 });

  const where = { userId: req.user.sub };
  if (unreadOnly) where.readAt = null;

  const [total, items, unreadCount] = await Promise.all([
    prisma.notification.count({ where }),
    prisma.notification.findMany({
      where, orderBy: { createdAt: 'desc' }, skip, take: limit,
    }),
    prisma.notification.count({ where: { userId: req.user.sub, readAt: null } }),
  ]);

  res.json({ ok: true, unreadCount, ...paginationEnvelope({ total, page, limit, items }) });
}));

/**
 * POST /api/notifications/:id/read
 */
router.post('/:id/read', asyncHandler(async (req, res) => {
  await prisma.notification.updateMany({
    where: { id: req.params.id, userId: req.user.sub, readAt: null },
    data: { readAt: new Date() },
  });
  res.json({ ok: true });
}));

/**
 * POST /api/notifications/read-all
 */
router.post('/read-all', asyncHandler(async (req, res) => {
  const r = await prisma.notification.updateMany({
    where: { userId: req.user.sub, readAt: null },
    data: { readAt: new Date() },
  });
  res.json({ ok: true, updated: r.count });
}));

export default router;
