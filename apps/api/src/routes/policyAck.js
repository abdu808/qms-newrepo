/**
 * policyAck.js — إقرار الموظفين بالاطّلاع على سياسة الجودة
 * ISO 9001:2015 §5.2.2(b) — Quality policy shall be communicated, understood and applied
 * P-02 §3.4 — كل موظف يقرّ مكتوباً أنه اطّلع على السياسة السارية.
 */
import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { BadRequest, NotFound } from '../utils/errors.js';
import { requireAction } from '../lib/permissions.js';

const router = Router();

/**
 * GET /api/policy-ack/me
 * هل أقرّ المستخدم الحالي بأحدث سياسة سارية؟
 */
router.get('/me', asyncHandler(async (req, res) => {
  const active = await prisma.qualityPolicy.findFirst({
    where: { active: true },
    orderBy: { effectiveDate: 'desc' },
    select: {
      id: true, version: true, title: true, effectiveDate: true,
      content: true, commitments: true, approvedBy: true, approvedAt: true,
    },
  });

  if (!active) {
    return res.json({ ok: true, hasActivePolicy: false, acknowledged: false });
  }

  const ack = await prisma.policyAcknowledgment.findUnique({
    where: {
      userId_policyId_policyVersion: {
        userId: req.user.sub,
        policyId: active.id,
        policyVersion: active.version,
      },
    },
  });

  res.json({
    ok: true,
    hasActivePolicy: true,
    policy: active,
    acknowledged: !!ack,
    acknowledgedAt: ack?.acknowledgedAt || null,
  });
}));

/**
 * POST /api/policy-ack
 * المستخدم يقرّ بالاطّلاع على السياسة السارية.
 */
router.post('/', asyncHandler(async (req, res) => {
  const active = await prisma.qualityPolicy.findFirst({
    where: { active: true },
    orderBy: { effectiveDate: 'desc' },
  });
  if (!active) throw BadRequest('لا توجد سياسة جودة سارية للإقرار بها');

  const ack = await prisma.policyAcknowledgment.upsert({
    where: {
      userId_policyId_policyVersion: {
        userId: req.user.sub,
        policyId: active.id,
        policyVersion: active.version,
      },
    },
    update: {}, // idempotent
    create: {
      userId: req.user.sub,
      policyId: active.id,
      policyVersion: active.version,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    },
  });

  res.status(201).json({ ok: true, ack });
}));

/**
 * GET /api/policy-ack/report
 * تقرير الإقرارات (QM+): من أقرّ/لم يُقرّ بأحدث سياسة.
 */
router.get('/report', requireAction('quality-policy', 'update'), asyncHandler(async (req, res) => {
  const active = await prisma.qualityPolicy.findFirst({
    where: { active: true },
    orderBy: { effectiveDate: 'desc' },
  });
  if (!active) throw NotFound('لا توجد سياسة سارية');

  const [users, acks] = await Promise.all([
    prisma.user.findMany({
      where: { active: true },
      select: { id: true, name: true, email: true, role: true, departmentId: true },
      orderBy: { name: 'asc' },
    }),
    prisma.policyAcknowledgment.findMany({
      where: { policyId: active.id, policyVersion: active.version },
      select: { userId: true, acknowledgedAt: true },
    }),
  ]);

  const ackMap = new Map(acks.map(a => [a.userId, a.acknowledgedAt]));
  const rows = users.map(u => ({
    ...u,
    acknowledgedAt: ackMap.get(u.id) || null,
    acknowledged: ackMap.has(u.id),
  }));

  res.json({
    ok: true,
    policy: { id: active.id, version: active.version, title: active.title },
    total: users.length,
    acknowledged: acks.length,
    pending: users.length - acks.length,
    coverage: users.length ? Math.round((acks.length / users.length) * 100) : 0,
    rows,
  });
}));

export default router;
