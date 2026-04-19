/**
 * routes/scheduler.js — تشغيل يدوي للـ jobs الدورية (SUPER_ADMIN فقط).
 * مفيد للاختبار، للتشخيص، ولإعادة توليد إشعارات بعد ترقية.
 */
import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { BadRequest, Forbidden } from '../utils/errors.js';
import { _internals } from '../lib/scheduler.js';

const router = Router();

function requireSuperAdmin(req, _res, next) {
  if (req.user?.role !== 'SUPER_ADMIN') {
    return next(Forbidden('مسؤول النظام فقط'));
  }
  next();
}

router.post('/run/:job', requireSuperAdmin, asyncHandler(async (req, res) => {
  const { job } = req.params;
  const fn = _internals[job];
  if (typeof fn !== 'function') {
    throw BadRequest(`job غير معروف: ${job}. المتاح: ${Object.keys(_internals).join(', ')}`);
  }
  const started = Date.now();
  await fn();
  res.json({ ok: true, job, durationMs: Date.now() - started });
}));

router.get('/jobs', requireSuperAdmin, (_req, res) => {
  res.json({ ok: true, jobs: Object.keys(_internals) });
});

export default router;
