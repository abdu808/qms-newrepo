/**
 * schemas/document.schema.js — تحقق Zod للوثائق (ISO 7.5).
 */
import { z } from 'zod';
import { trimmedString, optionalTrimmedString, idString, optionalDate } from './_helpers.js';

const CATEGORIES = [
  'MANUAL', 'POLICY', 'PROCEDURE', 'WORK_INSTRUCTION',
  'FORM', 'RECORD', 'EXTERNAL',
];

const STATUSES = ['DRAFT', 'UNDER_REVIEW', 'APPROVED', 'PUBLISHED', 'OBSOLETE'];

// رقم إصدار بصيغة M.m (1.0، 2.3) أو إصدار أبسط.
const versionField = z.preprocess(
  v => (typeof v === 'string' ? v.trim() : v),
  z.string().regex(/^\d+(\.\d+){0,2}$/, 'صيغة الإصدار غير صحيحة').max(16),
);

// بند ISO (مثال "7.5.3")
const isoClauseField = z.preprocess(
  v => {
    if (v == null) return null;
    const t = String(v).trim();
    return t === '' ? null : t;
  },
  z.string().regex(/^\d+(\.\d+){0,3}[a-z]?$/i, 'صيغة بند ISO غير صحيحة').max(16).nullable().optional(),
);

export const createSchema = z.object({
  title:          trimmedString(3, 200),
  category:       z.enum(CATEGORIES),
  departmentId:   idString.nullable().optional(),
  currentVersion: versionField.optional(),
  status:         z.enum(STATUSES).default('DRAFT'),
  effectiveDate:  optionalDate,
  reviewDate:     optionalDate,
  retentionYears: z.preprocess(
    v => (v === '' || v == null ? null : Number(v)),
    z.number().int().min(1).max(100).nullable().optional(),
  ),
  isoClause:      isoClauseField,
}).strip();

export const updateSchema = createSchema.partial();

export const querySchema = z.object({
  q:        z.string().max(200).optional(),
  status:   z.enum(STATUSES).optional(),
  category: z.enum(CATEGORIES).optional(),
}).strip();
