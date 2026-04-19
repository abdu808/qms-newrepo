/**
 * utils/optimisticLock.js — helper للـ optimistic locking على Document/NCR/Complaint.
 *
 * الاستخدام:
 *   await withVersionGuard(prisma.document, {
 *     id, version: currentVersion,
 *     data: { status: 'APPROVED', ... },
 *     include: { approvedBy: {...} },
 *   });
 *
 * إن تغيّر `version` بين القراءة والكتابة → يُلقى Conflict 409.
 */
import { Conflict } from './errors.js';

export async function withVersionGuard(model, { id, version, data, include, select }) {
  try {
    return await model.update({
      where: { id, version },
      data: { ...data, version: { increment: 1 } },
      ...(include ? { include } : {}),
      ...(select  ? { select }  : {}),
    });
  } catch (err) {
    // P2025 = RecordNotFound — هنا يعني أن الـ version تغيّر من طرف آخر
    if (err?.code === 'P2025') {
      throw Conflict('تغيّرت البيانات من طرف آخر — أعد التحميل وحاول مجدداً');
    }
    throw err;
  }
}
