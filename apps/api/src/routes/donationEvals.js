/**
 * routes/donationEvals.js — Batch 12
 * نموذج تقييم مختلف حسب نوع التبرع (CASH / IN_KIND / SERVICE).
 * يستخدم محرك التقييم الموحّد في lib/evalEngine.js.
 */
import { Router } from 'express';
import { crudRouter } from '../utils/crudFactory.js';
import { prisma } from '../db.js';
import { computeDonationEval, DONATION_EVAL_META } from '../lib/evalEngine.js';
import { BadRequest, NotFound } from '../utils/errors.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const base = crudRouter({
  resource: 'donation-evals',
  model: 'donationEval',
  codePrefix: 'DEV',
  searchFields: ['notes'],
  include: {
    donation: { select: { id: true, code: true, type: true, donorName: true, itemName: true, amount: true } },
    evaluator: { select: { id: true, name: true } },
  },
  allowedSortFields: ['createdAt', 'score'],
  beforeCreate: async (data, req) => {
    if (!data.donationId) throw BadRequest('donationId مطلوب');
    const donation = await prisma.donation.findUnique({
      where: { id: data.donationId }, select: { type: true },
    });
    if (!donation) throw NotFound('التبرع غير موجود');
    const result = computeDonationEval(donation.type, data);
    return {
      ...data,
      quality:     result.quality,
      usability:   result.usability,
      conformity:  result.conformity,
      expiryCheck: result.expiryCheck,
      score:       result.score,
      decision:    result.decision,
      evaluatorId: req.user.sub,
    };
  },
  beforeUpdate: async (data, req) => {
    // الحصول على نوع التبرع من السجل الموجود
    const existing = await prisma.donationEval.findUnique({
      where: { id: req.params.id },
      include: { donation: { select: { type: true } } },
    });
    if (!existing) throw NotFound('التقييم غير موجود');
    // اسمح بتحديث جزئي: املأ الحقول المفقودة من السجل الحالي
    const merged = {
      quality:     data.quality     ?? existing.quality,
      usability:   data.usability   ?? existing.usability,
      conformity:  data.conformity  ?? existing.conformity,
      expiryCheck: data.expiryCheck ?? existing.expiryCheck,
    };
    const result = computeDonationEval(existing.donation.type, merged);
    return {
      ...data,
      quality:     result.quality,
      usability:   result.usability,
      conformity:  result.conformity,
      expiryCheck: result.expiryCheck,
      score:       result.score,
      decision:    result.decision,
    };
  },
});

const router = Router();

// ─── GET /api/donation-evals/meta/:type ─────────────────────────
// تُرجع تسميات الحقول الخاصة بنوع التبرع للواجهة (labels + hint).
// تستخدمها الواجهة لبناء النموذج المناسب حسب نوع التبرع.
router.get('/meta/:type', asyncHandler(async (req, res) => {
  const meta = DONATION_EVAL_META[req.params.type];
  if (!meta) throw NotFound('نوع تبرع غير معروف');
  res.json({ ok: true, type: req.params.type, ...meta });
}));

router.get('/meta', asyncHandler(async (_req, res) => {
  res.json({ ok: true, byType: DONATION_EVAL_META });
}));

router.use('/', base);

export default router;
