/**
 * schemas/beneficiary.schema.js — تحقق Zod للمستفيدين (ISO 8.2 / P-08).
 */
import { z } from 'zod';
import { trimmedString, optionalTrimmedString, optionalDate, intInRange } from './_helpers.js';

const CATEGORIES = [
  'ORPHAN', 'WIDOW', 'POOR_FAMILY', 'DISABLED', 'ELDERLY', 'STUDENT', 'OTHER',
];
const STATUSES = ['APPLICANT', 'ACTIVE', 'INACTIVE', 'GRADUATED', 'REJECTED'];
const GENDERS = ['ذكر', 'أنثى'];

const phone = z.preprocess(
  v => {
    if (v == null) return null;
    const t = String(v).trim();
    return t === '' ? null : t;
  },
  z.string().regex(/^[+0-9\s\-()]{6,20}$/, 'رقم هاتف غير صالح').nullable().optional(),
);

// الهوية الوطنية السعودية: 10 أرقام (مرنة لغير السعوديين)
const nationalId = z.preprocess(
  v => {
    if (v == null) return null;
    const t = String(v).trim();
    return t === '' ? null : t;
  },
  z.string().regex(/^[0-9]{8,15}$/, 'رقم الهوية يجب أن يكون أرقاماً فقط (8-15 خانة)').nullable().optional(),
);

const posNumber = z.preprocess(
  v => (v === '' || v == null ? null : Number(v)),
  z.number().min(0).nullable().optional(),
);

export const createSchema = z.object({
  fullName:           trimmedString(3, 200),
  nationalId,
  category:           z.enum(CATEGORIES),
  gender:             z.preprocess(
    v => (v == null || v === '' ? null : v),
    z.enum(GENDERS).nullable().optional(),
  ),
  birthDate:          optionalDate,
  phone,
  city:               optionalTrimmedString(100),
  district:           optionalTrimmedString(100),
  familySize:         z.preprocess(
    v => (v === '' || v == null ? null : Number(v)),
    z.number().int().min(1, 'حجم الأسرة 1 فأكثر').max(50).nullable().optional(),
  ),
  monthlyIncome:      posNumber,
  status:             z.enum(STATUSES).default('APPLICANT'),
  appliedAt:          optionalDate,
  notes:              optionalTrimmedString(5000),
  needsAssessment:    optionalTrimmedString(5000),
  priorityScore:      intInRange(1, 5),
  vulnerabilityFlags: optionalTrimmedString(500),
}).strip();

export const updateSchema = createSchema.partial();

export const querySchema = z.object({
  q:        z.string().max(200).optional(),
  status:   z.enum(STATUSES).optional(),
  category: z.enum(CATEGORIES).optional(),
  city:     z.string().max(100).optional(),
}).strip();
