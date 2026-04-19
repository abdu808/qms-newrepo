/**
 * services/ncrClosure.js — قواعد إغلاق عدم المطابقة (ISO 10.2).
 *
 * المرحلة 2 — Service Layer.
 * يجمع كل قواعد الإغلاق في مكان واحد:
 *   ▸ normalizeNcr          — تحويل الأنواع واستيفاء verifiedAt تلقائياً
 *   ▸ guardClosure          — المتطلبات قبل CLOSE: effective=true + verifiedAt
 *   ▸ guardNcrUpdate        — state machine + توقيع رقمي + سجل التحقق من الفعالية
 */
import { prisma } from '../db.js';
import { BadRequest, NotFound } from '../utils/errors.js';
import { NCR_STATUS, assertTransition } from '../lib/stateMachines.js';
import { requireSignatureFor } from '../lib/signatureGuard.js';

export function normalizeNcr(data) {
  if (data.effective === 'true')       data.effective = true;
  else if (data.effective === 'false') data.effective = false;
  else if (data.effective === '' || data.effective === null) data.effective = null;

  // عند تسجيل الفعالية نختم verifiedAt تلقائياً إن لم يُرسَل
  if (data.effective !== null && data.effective !== undefined && !data.verifiedAt) {
    data.verifiedAt = new Date();
  }
  return data;
}

/**
 * guardClosure — يرفض CLOSE بدون تحقق من الفعالية (ISO 10.2).
 */
export function guardClosure(data) {
  if (data.status !== 'CLOSED') return;
  if (data.effective !== true) {
    throw BadRequest('لا يمكن إغلاق عدم المطابقة دون التحقق من فعالية الإجراء التصحيحي (ISO 10.2)');
  }
  if (!data.verifiedAt) {
    throw BadRequest('مطلوب تاريخ التحقق من الفعالية قبل الإغلاق');
  }
}

/**
 * guardNcrUpdate — حارس CRUD للتحديث.
 * يطبّق state machine + يفرض توقيعاً رقمياً عند الإغلاق
 * + يسجّل حدث VERIFY_NCR_EFFECTIVENESS بشكل منفصل.
 */
export async function guardNcrUpdate(data, { ncrId, req }) {
  normalizeNcr(data);
  guardClosure(data);

  if (data.status) {
    const current = await prisma.nCR.findUnique({
      where: { id: ncrId }, select: { status: true, version: true },
    });
    if (!current) throw NotFound('عدم المطابقة غير موجودة');
    assertTransition(NCR_STATUS, current.status, data.status, {
      label: 'عدم المطابقة', role: req?.user?.role,
    });
    // optimistic locking — crudFactory يستهلك __expectedVersion
    data.__expectedVersion = current.version;
  }

  if (data.status === 'CLOSED') {
    await requireSignatureFor(req, {
      entityType: 'NCR',
      entityId:   ncrId,
      purpose:    'close',
      label:      'إغلاق عدم المطابقة',
    });

    // سجل تحقق من الفعالية — fire-and-forget
    prisma.auditLog.create({
      data: {
        userId:      req?.user?.sub,
        action:      'VERIFY_NCR_EFFECTIVENESS',
        entityType:  'NCR',
        entityId:    ncrId,
        changesJson: JSON.stringify({
          effective:    data.effective,
          verifiedAt:   data.verifiedAt,
          verifiedNote: data.verifiedNote || null,
        }),
        ipAddress: req?.ip,
        userAgent: req?.headers?.['user-agent'],
      },
    }).catch(() => {});
  }
  return data;
}

/**
 * guardNcrCreate — تطبيع + حارس الإغلاق عند الإنشاء (نادر لكنه ممكن).
 */
export function guardNcrCreate(data) {
  normalizeNcr(data);
  guardClosure(data);
  return data;
}
