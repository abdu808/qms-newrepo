/**
 * schemas/_helpers.js — أدوات مشتركة لـ Zod
 *
 * المرحلة 2 — البند 2.1 (طبقة تحقق موحّدة).
 * هدف التحقق: رفض الحقول المجهولة/المشوهة قبل الوصول إلى Prisma،
 * وتوحيد رسائل الأخطاء العربية، وتوليد 400 متسق.
 */
import { z } from 'zod';
import { BadRequest } from '../utils/errors.js';

/** نص غير فارغ مع قصّ تلقائي وحد أقصى للطول. */
export const trimmedString = (min = 1, max = 500) =>
  z.preprocess(
    v => (typeof v === 'string' ? v.trim() : v),
    z.string().min(min, `الحد الأدنى ${min} حرف`).max(max, `الحد الأقصى ${max} حرف`),
  );

/** نص اختياري يتحول "" / null / undefined إلى null. */
export const optionalTrimmedString = (max = 500) =>
  z.preprocess(
    v => {
      if (v == null) return null;
      if (typeof v === 'string') {
        const t = v.trim();
        return t === '' ? null : t;
      }
      return v;
    },
    z.string().max(max).nullable().optional(),
  );

/** Boolean مع قبول "true"/"false" كـ string. */
export const coercedBoolean = z.preprocess(
  v => {
    if (v === 'true')  return true;
    if (v === 'false') return false;
    if (v === '' || v === null) return null;
    return v;
  },
  z.boolean().nullable().optional(),
);

/** عدد صحيح بين min و max (يقبل string). */
export const intInRange = (min, max) =>
  z.preprocess(
    v => {
      if (v === '' || v == null) return null;
      const n = Number(v);
      return Number.isFinite(n) ? Math.round(n) : v;
    },
    z.number().int().min(min).max(max).nullable().optional(),
  );

/** تاريخ اختياري — يقبل ISO string أو Date. */
export const optionalDate = z.preprocess(
  v => {
    if (v == null || v === '') return null;
    if (v instanceof Date) return v;
    const d = new Date(v);
    return isNaN(d.getTime()) ? v : d;
  },
  z.date().nullable().optional(),
);

/** CUID أو UUID مقبول (Prisma يولد cuid افتراضياً).
 *  يُعامل "" / " " / null / undefined كغياب قيمة (null) حتى لا ينفجر FK
 *  عند Prisma — نماذج الفرونت ترسل "" للحقول الاختيارية بدلاً من عدم إرسالها.
 */
export const idString = z.preprocess(
  v => {
    if (v == null) return v;
    if (typeof v === 'string') {
      const t = v.trim();
      return t === '' ? null : t;
    }
    return v;
  },
  z.string().min(1).max(64),
);

/**
 * validateBody(schema) — يُرجع دالة beforeCreate/beforeUpdate موحّدة.
 *
 * الاستخدام عبر crudFactory:
 *   crudRouter({ ..., schemas: { create: createSchema, update: updateSchema } })
 *
 * أو يدوياً:
 *   beforeCreate: runSchema(createSchema)
 */
export function runSchema(schema) {
  return (data /* , req */) => {
    if (!schema) return data;
    const parsed = schema.safeParse(data);
    if (!parsed.success) {
      const first = parsed.error.issues?.[0];
      const field = first?.path?.join('.') || 'حقل';
      const msg   = first?.message || 'قيمة غير صالحة';
      throw BadRequest(`${field}: ${msg}`);
    }
    return parsed.data;
  };
}
