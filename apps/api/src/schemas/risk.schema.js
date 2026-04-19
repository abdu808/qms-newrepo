/**
 * schemas/risk.schema.js — تحقق Zod للمخاطر والفرص (ISO 6.1).
 */
import { z } from 'zod';
import { trimmedString, optionalTrimmedString, idString, optionalDate } from './_helpers.js';

const TYPES    = ['RISK', 'OPPORTUNITY'];
const STATUSES = ['IDENTIFIED', 'UNDER_TREATMENT', 'MITIGATED', 'ACCEPTED', 'CLOSED'];
const WORKFLOW = ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'];
const LEVELS   = ['منخفض', 'متوسط', 'مرتفع', 'حرج'];
// قيم إنجليزية تطابق ما ترسله الواجهة. الـ Prisma field هو String? فلا enum على جانب DB.
const TREATMENT_TYPES = ['AVOID', 'MITIGATE', 'TRANSFER', 'ACCEPT'];

const scale1to5 = z.preprocess(
  v => (v === '' || v == null ? undefined : Number(v)),
  z.number().int().min(1, 'الحد الأدنى 1').max(5, 'الحد الأقصى 5'),
);

export const createSchema = z.object({
  type:            z.enum(TYPES).default('RISK'),
  title:           trimmedString(3, 200),
  description:     optionalTrimmedString(5000),
  source:          optionalTrimmedString(300),
  departmentId:    idString.nullable().optional(),
  probability:     scale1to5,
  impact:          scale1to5,
  level:           z.enum(LEVELS).optional(), // يُحسب عادةً لكن مقبول
  treatment:       optionalTrimmedString(5000),
  treatmentType:   z.preprocess(
    v => (v === '' || v == null ? null : v),
    z.enum(TREATMENT_TYPES).nullable().optional(),
  ),
  ownerId:         idString.nullable().optional(),
  status:          z.enum(STATUSES).default('IDENTIFIED'),
  reviewDate:      optionalDate,
  strategicGoalId: idString.nullable().optional(),
}).strip();

export const updateSchema = z.object({
  type:            z.enum(TYPES).optional(),
  title:           trimmedString(3, 200).optional(),
  description:     optionalTrimmedString(5000),
  source:          optionalTrimmedString(300),
  departmentId:    idString.nullable().optional(),
  probability:     scale1to5.optional(),
  impact:          scale1to5.optional(),
  level:           z.enum(LEVELS).optional(),
  treatment:       optionalTrimmedString(5000),
  treatmentType:   z.preprocess(
    v => (v === '' || v == null ? null : v),
    z.enum(TREATMENT_TYPES).nullable().optional(),
  ),
  ownerId:         idString.nullable().optional(),
  status:          z.enum(STATUSES).optional(),
  reviewDate:      optionalDate,
  strategicGoalId: idString.nullable().optional(),
  workflowState:   z.enum(WORKFLOW).optional(),
  rejectionReason: optionalTrimmedString(2000),
}).strip();

export const querySchema = z.object({
  q:      z.string().max(200).optional(),
  type:   z.enum(TYPES).optional(),
  status: z.enum(STATUSES).optional(),
  level:  z.enum(LEVELS).optional(),
}).strip();
