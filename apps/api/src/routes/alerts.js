/**
 * routes/alerts.js — لقطة حيّة لصحة النظام
 *
 *   GET /api/alerts         — كل التنبيهات النشطة (مجمّعة حسب الشدّة)
 *   GET /api/alerts/summary — عدّادات فقط (لشارة شريط التنقل)
 *
 * يختلف عن /api/notifications الذي يعرض صندوق بريد المستخدم الشخصي.
 * هذا المسار يعطي صورة مؤسسية (organization-wide) لمديري الجودة.
 */
import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAction } from '../lib/permissions.js';
import { collectAlerts, alertsSummary } from '../lib/alerts.js';

const router = Router();

router.get('/', requireAction('alerts', 'read'), asyncHandler(async (req, res) => {
  const alerts = await collectAlerts();

  // تجميع حسب الشدّة — يسهّل عرضها في الـ UI
  const grouped = { danger: [], warn: [], info: [] };
  for (const a of alerts) (grouped[a.severity] || grouped.info).push(a);

  res.json({
    ok: true,
    total: alerts.length,
    summary: {
      danger: grouped.danger.length,
      warn:   grouped.warn.length,
      info:   grouped.info.length,
    },
    grouped,
    alerts,  // أيضاً مسطّحة لمن يفضّل معالجتها كقائمة
    generatedAt: new Date().toISOString(),
  });
}));

router.get('/summary', requireAction('alerts', 'read'), asyncHandler(async (req, res) => {
  const summary = await alertsSummary();
  res.json({ ok: true, ...summary });
}));

export default router;
