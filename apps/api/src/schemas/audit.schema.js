/**
 * schemas/audit.schema.js — تحقق Zod للتدقيق الداخلي (ISO 9.2).
 */
import { z } from 'zod';
import { trimmedString, optionalTrimmedString, idString, optionalDate } from './_helpers.js';

const TYPES    = ['INTERNAL', 'EXTERNAL', 'SUPPLIER', 'FOLLOWUP'];
const STATUSES = ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

const dateRequired = z.preprocess(
  v => {
    if (v == null || v === '') return undefined;
    if (v instanceof Date) return v;
    const d = new Date(v);
    return isNaN(d.getTime()) ? v : d;
  },
  z.date({ required_error: 'التاريخ مطلوب' }),
);

export const createSchema = z.object({
  title:                trimmedString(3, 200),
  type:                 z.enum(TYPES).default('INTERNAL'),
  scope:                trimmedString(3, 1000),
  criteria:             optionalTrimmedString(1000),
  plannedDate:          dateRequired,
  actualDate:           optionalDate,
  leadAuditorId:        idString.nullable().optional(),
  team:                 optionalTrimmedString(500),
  strengths:            optionalTrimmedString(5000),
  weaknesses:           optionalTrimmedString(5000),
  reportUrl:            optionalTrimmedString(500),
  checklistTemplateId:  idString.nullable().optional(),
  status:               z.enum(STATUSES).default('PLANNED'),
}).strip();

export const updateSchema = createSchema.partial().extend({
  // findings JSON string — نتحقق من السلامة عند الحفظ
  findings: optionalTrimmedString(20000),
});

export const querySchema = z.object({
  q:      z.string().max(200).optional(),
  status: z.enum(STATUSES).optional(),
  type:   z.enum(TYPES).optional(),
}).strip();
