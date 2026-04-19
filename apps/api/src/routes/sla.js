/**
 * routes/sla.js — Batch 14
 * لوحة SLA الموحَّدة للشكاوى وعدم المطابقة (ISO 9.1.2 / 10.2).
 *
 * GET /api/sla/board            — كل الـ SLA المفتوح + ملخص
 * GET /api/sla/policy           — يُرجع سياسة SLA للواجهة (شفافية)
 * GET /api/sla/complaint/:id    — SLA لشكوى واحدة
 * GET /api/sla/ncr/:id          — SLA لعدم مطابقة واحدة
 */
import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { NotFound } from '../utils/errors.js';
import { requireAction } from '../lib/permissions.js';
import {
  SLA_POLICY, scanSla, computeComplaintSla, computeNcrSla,
} from '../lib/sla.js';

const router = Router();

router.get('/policy', asyncHandler(async (_req, res) => {
  res.json({ ok: true, policy: SLA_POLICY });
}));

router.get('/board', requireAction('alerts', 'read'), asyncHandler(async (_req, res) => {
  const data = await scanSla(prisma);
  res.json({ ok: true, ...data });
}));

router.get('/complaint/:id', requireAction('complaints', 'read'), asyncHandler(async (req, res) => {
  const c = await prisma.complaint.findUnique({ where: { id: req.params.id } });
  if (!c) throw NotFound('الشكوى غير موجودة');
  res.json({ ok: true, id: c.id, code: c.code, sla: computeComplaintSla(c) });
}));

router.get('/ncr/:id', requireAction('ncr', 'read'), asyncHandler(async (req, res) => {
  const n = await prisma.nCR.findUnique({ where: { id: req.params.id } });
  if (!n) throw NotFound('عدم المطابقة غير موجودة');
  res.json({ ok: true, id: n.id, code: n.code, sla: computeNcrSla(n) });
}));

export default router;
