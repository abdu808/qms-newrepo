/**
 * services/documentApproval.js — منطق اعتماد/نشر/سحب الوثائق (ISO 7.5.3).
 *
 * المرحلة 2 — Service Layer.
 * هذا المودول هو مصدر الحقيقة الوحيد لتحوّلات حالة الوثيقة "الرسمية":
 *   ▸ approve  — UNDER_REVIEW → APPROVED  (يمكن النشر مباشرة)
 *   ▸ publish  — APPROVED → PUBLISHED     (تفعيل رسمي)
 *   ▸ obsolete — * → OBSOLETE             (سحب نهائي)
 *   ▸ acknowledge — إقرار المستخدم على وثيقة منشورة (ISO 7.5.3.2(c))
 *
 * الـ route طبقة نقل فقط — كل القواعد هنا لضمان تطابق أي مسار
 * (API / CLI / backfill) مع نفس الضوابط.
 */
import { prisma } from '../db.js';
import { BadRequest, Forbidden, NotFound } from '../utils/errors.js';
import { DOCUMENT_STATUS, assertTransition } from '../lib/stateMachines.js';
import { withVersionGuard } from '../utils/optimisticLock.js';

// ISO 7.5.3 — فقط الأدوار الموكَّلة بمسؤولية الجودة تعتمد الوثائق.
export const APPROVE_ROLES = ['SUPER_ADMIN', 'QUALITY_MANAGER'];

/** نفس قواعد ALLOWED_TRANSITIONS القديمة لكن عبر الـ state machine الموحّدة. */
export function assertDocumentTransition(from, to) {
  assertTransition(DOCUMENT_STATUS, from, to, { label: 'الوثيقة' });
}

function requireApproveRole(role) {
  if (!APPROVE_ROLES.includes(role)) {
    throw Forbidden('فقط مدير الجودة أو مسؤول النظام يمكنه اعتماد/سحب الوثائق');
  }
}

/**
 * approveDocument — اعتماد رسمي (مع خيار النشر المباشر).
 *
 * القاعدة: الاعتماد ممكن فقط من UNDER_REVIEW (أو APPROVED — تكرار الاعتماد).
 * النشر يستلزم عبور APPROVED (نسمح الاثنين في خطوة واحدة لراحة المستخدم،
 * لكن نمر بالحالتين منطقياً).
 */
export async function approveDocument({ docId, userId, userRole, publish = false }) {
  requireApproveRole(userRole);

  const doc = await prisma.document.findUnique({ where: { id: docId } });
  if (!doc) throw NotFound('الوثيقة غير موجودة');
  if (doc.deletedAt) throw BadRequest('لا يمكن اعتماد وثيقة محذوفة');

  // القاعدة التاريخية: APPROVED مسموحة لإعادة الاعتماد
  if (!['UNDER_REVIEW', 'APPROVED'].includes(doc.status)) {
    throw BadRequest('لا يمكن اعتماد الوثيقة إلا من حالة "قيد المراجعة" أو بعد اعتمادها');
  }

  const nextStatus = publish ? 'PUBLISHED' : 'APPROVED';
  // الانتقال من UNDER_REVIEW → APPROVED مسموح؛ APPROVED → PUBLISHED مسموح.
  assertDocumentTransition(doc.status, nextStatus);

  // optimistic locking — يمنع اعتماد مزدوج من طرفين متزامنين
  return withVersionGuard(prisma.document, {
    id: doc.id,
    version: doc.version,
    data: {
      status:        nextStatus,
      approvedById:  userId,
      approvedAt:    new Date(),
      effectiveDate: publish ? new Date() : doc.effectiveDate,
    },
    include: { approvedBy: { select: { id: true, name: true } } },
  });
}

/** سحب وثيقة نهائياً (OBSOLETE) — مسموح من أي حالة غير نهائية. */
export async function obsoleteDocument({ docId, userRole }) {
  requireApproveRole(userRole);

  const doc = await prisma.document.findUnique({ where: { id: docId } });
  if (!doc) throw NotFound('الوثيقة غير موجودة');
  if (doc.status === 'OBSOLETE') {
    throw BadRequest('الوثيقة مسحوبة بالفعل');
  }
  assertDocumentTransition(doc.status, 'OBSOLETE');

  return withVersionGuard(prisma.document, {
    id: doc.id,
    version: doc.version,
    data: { status: 'OBSOLETE' },
  });
}

/**
 * acknowledgeDocument — إقرار مستخدم على الإصدار الحالي من وثيقة منشورة.
 * ISO 7.5.3.2(c): سجل من قرأ واعتمد كل إصدار.
 * Idempotent — إعادة الإقرار تُحدّث `ackedAt` فقط.
 */
export async function acknowledgeDocument({ docId, userId }) {
  const doc = await prisma.document.findUnique({ where: { id: docId } });
  if (!doc) throw NotFound('الوثيقة غير موجودة');
  if (doc.status !== 'PUBLISHED') {
    throw BadRequest('لا يمكن الإقرار إلا على الوثائق المنشورة');
  }

  return prisma.ack.upsert({
    where:  { documentId_userId_version: {
      documentId: doc.id, userId, version: doc.currentVersion,
    } },
    update: { ackedAt: new Date() },
    create: { documentId: doc.id, userId, version: doc.currentVersion },
  });
}

/**
 * guardGenericUpdate — لاستخدامه داخل crudFactory.beforeUpdate.
 * يمنع المرور إلى APPROVED/PUBLISHED من CRUD العام ويحترم state machine.
 */
export async function guardDocumentUpdate(data, docId) {
  if (!data.status) return data;

  const current = await prisma.document.findUnique({
    where: { id: docId }, select: { status: true, version: true },
  });
  if (!current) throw NotFound('الوثيقة غير موجودة');

  assertDocumentTransition(current.status, data.status);

  // optimistic locking — crudFactory يستهلك __expectedVersion
  data.__expectedVersion = current.version;

  // الاعتماد والنشر حصراً عبر /approve — لا يمر من CRUD العادي.
  if (['APPROVED', 'PUBLISHED'].includes(data.status) && current.status !== data.status) {
    throw BadRequest('يجب استخدام مسار الاعتماد الرسمي (/approve) لتفعيل الاعتماد أو النشر');
  }
  return data;
}
