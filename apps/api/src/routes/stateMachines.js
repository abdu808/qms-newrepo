/**
 * routes/stateMachines.js — تعريض آلات الحالات للواجهة.
 *
 *   GET /api/state-machines                     — كل الآلات (للـ front-end cache)
 *   GET /api/state-machines/:entity/next/:from  — الحالات المسموح الانتقال إليها
 *
 * يسمح للواجهة أن تُظهر في dropdown فقط الحالات الصالحة من الحالة الحالية،
 * بدلاً من ترك المستخدم يحاول ويصطدم بالـ 400.
 */
import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { NotFound } from '../utils/errors.js';
import {
  NCR_STATUS, COMPLAINT_STATUS, AUDIT_STATUS, MGMT_REVIEW_STATUS, allowedNext,
} from '../lib/stateMachines.js';

const MACHINES = {
  ncr:                NCR_STATUS,
  complaint:          COMPLAINT_STATUS,
  audit:              AUDIT_STATUS,
  'management-review': MGMT_REVIEW_STATUS,
};

const router = Router();

router.get('/', asyncHandler(async (req, res) => {
  res.json({ ok: true, machines: MACHINES });
}));

router.get('/:entity/next/:from', asyncHandler(async (req, res) => {
  const machine = MACHINES[req.params.entity];
  if (!machine) throw NotFound('آلة الحالات غير معروفة لهذا الكيان');
  const next = allowedNext(machine, req.params.from);
  res.json({ ok: true, from: req.params.from, allowedNext: next });
}));

export default router;
