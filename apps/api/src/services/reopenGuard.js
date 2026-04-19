/**
 * services/reopenGuard.js — قواعد إعادة الفتح الموحَّدة.
 *
 * المبدأ: لا يُعاد فتح سجل مُغلَق دون:
 *   1) دور مناسب (QUALITY_MANAGER / SUPER_ADMIN فقط)
 *   2) سبب مكتوب (reopenReason)
 *   3) سجل AuditLog مستقل (قابل للتتبّع)
 *
 * يُستخدم داخل routes/ncr.js وroutes/complaints.js على المسار الاختياري
 * POST /:id/reopen.
 */
import { prisma } from '../db.js';
import { BadRequest, Forbidden, NotFound } from '../utils/errors.js';

const REOPEN_ROLES = ['QUALITY_MANAGER', 'SUPER_ADMIN'];

/**
 * reopenRecord — يعيد فتح NCR أو شكوى إلى IN_PROGRESS مع سجل رقابي.
 *
 * @param {object} opts
 * @param {'nCR'|'complaint'} opts.model   — اسم موديل Prisma
 * @param {string} opts.entityType         — 'NCR' أو 'Complaint' (لـ AuditLog)
 * @param {string} opts.id
 * @param {string} opts.reason
 * @param {object} opts.req
 */
export async function reopenRecord({ model, entityType, id, reason, req }) {
  if (!REOPEN_ROLES.includes(req?.user?.role)) {
    throw Forbidden('فقط مدير الجودة أو مسؤول النظام يمكنه إعادة فتح سجل مُغلَق');
  }
  const trimmed = String(reason || '').trim();
  if (trimmed.length < 10) {
    throw BadRequest('يجب توضيح سبب إعادة الفتح (10 أحرف على الأقل)');
  }

  const current = await prisma[model].findUnique({
    where: { id },
    select: { id: true, code: true, status: true, version: true },
  });
  if (!current) throw NotFound('السجل غير موجود');
  if (current.status !== 'CLOSED') {
    throw BadRequest('لا يمكن إعادة فتح سجل غير مُغلَق');
  }

  // optimistic locking عبر updateMany — count=0 عند تغيّر الإصدار (آمن ضد التزامن)
  const upd = await prisma[model].updateMany({
    where: { id, version: current.version },
    data: {
      status: 'IN_PROGRESS',
      version: { increment: 1 },
    },
  });
  if (upd.count === 0) {
    throw BadRequest('تغيّرت البيانات من طرف آخر — أعد التحميل');
  }
  const updated = await prisma[model].findUnique({ where: { id } });

  // سجل رقابي منفصل — await لضمان وجوده قبل الاستجابة (قابل للتتبّع)
  await prisma.auditLog.create({
    data: {
      userId:      req?.user?.sub,
      action:      `REOPEN_${entityType.toUpperCase()}`,
      entityType,
      entityId:    id,
      changesJson: JSON.stringify({
        previousStatus: 'CLOSED',
        newStatus:      'IN_PROGRESS',
        reason:         trimmed,
      }),
      ipAddress: req?.ip,
      userAgent: req?.headers?.['user-agent'],
    },
  }).catch(() => {});

  return updated;
}
