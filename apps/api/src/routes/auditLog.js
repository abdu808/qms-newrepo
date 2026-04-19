/**
 * routes/auditLog.js — Activity Log API
 *
 * نقاط النهاية:
 *   GET  /api/audit-log/for/:entityType/:entityId   — timeline مبسَّط لسجل واحد
 *   GET  /api/audit-log                              — قائمة بفلاتر + pagination
 *   GET  /api/audit-log/export                       — تصدير CSV (نفس الفلاتر)
 *
 * الفلاتر المدعومة (GET / و /export):
 *   userId, entityType, entityId, action, from (ISO date), to (ISO date)
 */
import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { authorize } from '../middleware/auth.js';
import { requireAction } from '../lib/permissions.js';
import { parsePagination, paginationEnvelope } from '../utils/pagination.js';

const router = Router();

// بنّاء where موحَّد — يُستخدم في list + export
function buildWhere(q) {
  const where = {};
  if (q.userId)     where.userId     = q.userId;
  if (q.entityType) where.entityType = q.entityType;
  if (q.entityId)   where.entityId   = q.entityId;
  if (q.action)     where.action     = q.action;
  if (q.from || q.to) {
    where.at = {};
    if (q.from) {
      const d = new Date(q.from);
      if (!isNaN(d)) where.at.gte = d;
    }
    if (q.to) {
      const d = new Date(q.to);
      if (!isNaN(d)) where.at.lte = d;
    }
    if (Object.keys(where.at).length === 0) delete where.at;
  }
  return where;
}

// Lightweight timeline endpoint per entity.
// Still protected by the audit-log RBAC policy because timeline data is sensitive.
router.get('/for/:entityType/:entityId', requireAction('audit-log', 'read'), asyncHandler(async (req, res) => {
  const { entityType, entityId } = req.params;
  const items = await prisma.auditLog.findMany({
    where: { entityType, entityId },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { at: 'desc' },
    take: 50,
  });
  res.json({ ok: true, items });
}));

router.get('/', requireAction('audit-log', 'read'), asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req, { defaultLimit: 50, maxLimit: 200 });
  const where = buildWhere(req.query);

  const [total, items] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { at: 'desc' },
      skip, take: limit,
    }),
  ]);
  res.json({ ok: true, ...paginationEnvelope({ total, page, limit, items }) });
}));

/**
 * GET /api/audit-log/export?format=csv
 * تصدير السجل بنفس الفلاتر — حتى سقف 10,000 سطر (حماية للذاكرة).
 * ISO 7.5.3.2(b) — قابلية الاسترجاع للمراجعة الخارجية.
 */
router.get('/export', requireAction('audit-log', 'read'), asyncHandler(async (req, res) => {
  const where = buildWhere(req.query);
  const MAX_EXPORT = 10000;

  const rows = await prisma.auditLog.findMany({
    where,
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { at: 'desc' },
    take: MAX_EXPORT,
  });

  // CSV escape helper
  const esc = (v) => {
    if (v == null) return '';
    const s = String(v).replace(/"/g, '""');
    return /[",\n\r]/.test(s) ? `"${s}"` : s;
  };

  const headers = ['at', 'userId', 'userName', 'userEmail', 'action', 'entityType', 'entityId', 'ipAddress', 'userAgent', 'changes'];
  const lines = [headers.join(',')];
  for (const r of rows) {
    lines.push([
      r.at?.toISOString?.() || '',
      r.userId || '',
      r.user?.name || '',
      r.user?.email || '',
      r.action || '',
      r.entityType || '',
      r.entityId || '',
      r.ipAddress || '',
      r.userAgent || '',
      r.changesJson || '',
    ].map(esc).join(','));
  }
  // BOM لدعم Excel العربي
  const csv = '\uFEFF' + lines.join('\r\n');

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="audit-log-${stamp}.csv"`);
  res.setHeader('X-Export-Count', String(rows.length));
  res.setHeader('X-Export-Capped', rows.length >= MAX_EXPORT ? '1' : '0');
  res.send(csv);
}));

export default router;
