/**
 * services/complaintLifecycle.js — دورة حياة الشكوى (ISO 9.1.2 / P-11).
 *
 * المرحلة 2 — Service Layer.
 * كل تحوّلات الحالة والعمليات المترابطة (شكوى ↔ NCR) تمر من هنا.
 *
 *   ▸ convertComplaintToNcr — تحويل شكوى إلى NCR وربطهما (P-11 §3.4)
 *   ▸ transitionComplaint   — انتقال حالة محروس بـ state machine
 *   ▸ closeComplaint        — إغلاق مع توقيع رقمي (ISO 9.1.2)
 *
 * معاملة ذرّية (transaction) حيث توجد كتابات متعددة على جدولين.
 */
import { prisma } from '../db.js';
import { BadRequest, NotFound } from '../utils/errors.js';
import { COMPLAINT_STATUS, assertTransition } from '../lib/stateMachines.js';
import { nextCode } from '../utils/codeGen.js';
import { requireSignatureFor } from '../lib/signatureGuard.js';

/**
 * convertComplaintToNcr — ينشئ NCR من شكوى ويربطهما.
 * Idempotency: إذا كانت الشكوى مرتبطة بـ NCR مسبقاً → BadRequest.
 * Atomicity: إنشاء NCR + ربط الشكوى يحدثان في transaction واحدة.
 */
export async function convertComplaintToNcr({ complaintId, userId, req }) {
  const complaint = await prisma.complaint.findUnique({ where: { id: complaintId } });
  if (!complaint) throw NotFound('الشكوى غير موجودة');
  if (complaint.relatedNcrId) {
    throw BadRequest('هذه الشكوى مرتبطة بالفعل بـ NCR');
  }

  const code = await nextCode('nCR', 'NCR');

  const ncr = await prisma.$transaction(async (tx) => {
    const created = await tx.nCR.create({
      data: {
        code,
        title:       `[من شكوى ${complaint.code}] ${complaint.subject}`.slice(0, 180),
        description: complaint.description + '\n\n— مصدر: الشكوى ' + complaint.code,
        severity:    complaint.severity || 'متوسطة',
        reporterId:  userId,
        status:      'OPEN',
      },
    });
    await tx.complaint.update({
      where: { id: complaintId },
      data:  { relatedNcrId: created.id },
    });
    return created;
  });

  // أثر رقابي — fire-and-forget (لا يعطّل الإرجاع لو فشل)
  prisma.auditLog.create({
    data: {
      userId,
      action:      'CONVERT_COMPLAINT_TO_NCR',
      entityType:  'Complaint',
      entityId:    complaintId,
      changesJson: JSON.stringify({ ncrId: ncr.id, ncrCode: ncr.code }),
      ipAddress:   req?.ip,
      userAgent:   req?.headers?.['user-agent'],
    },
  }).catch(() => {});

  return { ncr, complaintId };
}

/**
 * guardComplaintUpdate — حارس لاستخدامه في crudFactory.beforeUpdate.
 * يفرض state machine على status؛ الإغلاق النهائي يتطلب توقيعاً رقمياً.
 */
export async function guardComplaintUpdate(data, { complaintId, req }) {
  if (!data.status) return data;

  const current = await prisma.complaint.findUnique({
    where: { id: complaintId }, select: { status: true, version: true },
  });
  if (!current) throw NotFound('الشكوى غير موجودة');

  assertTransition(COMPLAINT_STATUS, current.status, data.status, {
    label: 'الشكوى', role: req?.user?.role,
  });

  // optimistic locking — crudFactory يستهلك __expectedVersion
  data.__expectedVersion = current.version;

  // توقيع رقمي إلزامي عند الإغلاق النهائي
  if (data.status === 'CLOSED') {
    await requireSignatureFor(req, {
      entityType: 'Complaint',
      entityId:   complaintId,
      purpose:    'close',
      label:      'إغلاق الشكوى',
    });
  }
  return data;
}
