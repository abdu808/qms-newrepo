/**
 * schemas/ncr.schema.js — تحقق Zod لعدم المطابقة (ISO 10.2).
 *
 * لاحظ: المسار لديه guard إضافي (guardClosure) يفرض
 * effective + verifiedAt قبل الإغلاق — لا نكرر المنطق هنا.
 */
import { z } from 'zod';
import {
  trimmedString, optionalTrimmedString, idString, optionalDate, coercedBoolean,
} from './_helpers.js';

const STATUSES = [
  'OPEN', 'ROOT_CAUSE', 'ACTION_PLANNED', 'IN_PROGRESS', 'VERIFICATION', 'CLOSED',
];
const WORKFLOW = ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'];
const SEVERITIES = ['منخفضة', 'متوسطة', 'مرتفعة'];

export const createSchema = z.object({
  title:            trimmedString(3, 200),
  description:      trimmedString(10, 5000),
  departmentId:    idString.nullable().optional(),
  detectedAt:      optionalDate,
  assigneeId:      idString.nullable().optional(),
  severity:        z.enum(SEVERITIES).default('متوسطة'),
  rootCause:       optionalTrimmedString(5000),
  correction:      optionalTrimmedString(5000),
  correctiveAction: optionalTrimmedString(5000),
  dueDate:         optionalDate,
  status:          z.enum(STATUSES).default('OPEN'),
}).strip();

export const updateSchema = z.object({
  title:            trimmedString(3, 200).optional(),
  description:      trimmedString(10, 5000).optional(),
  departmentId:    idString.nullable().optional(),
  assigneeId:      idString.nullable().optional(),
  severity:        z.enum(SEVERITIES).optional(),
  rootCause:       optionalTrimmedString(5000),
  correction:      optionalTrimmedString(5000),
  correctiveAction: optionalTrimmedString(5000),
  dueDate:         optionalDate,
  verifiedAt:      optionalDate,
  verifiedNote:    optionalTrimmedString(2000),
  effective:       coercedBoolean,
  status:          z.enum(STATUSES).optional(),
  workflowState:   z.enum(WORKFLOW).optional(),
  rejectionReason: optionalTrimmedString(2000),
}).strip();

export const querySchema = z.object({
  q:             z.string().max(200).optional(),
  status:        z.enum(STATUSES).optional(),
  severity:      z.enum(SEVERITIES).optional(),
  departmentId:  idString.optional(),
  assigneeId:    idString.optional(),
  workflowState: z.enum(WORKFLOW).optional(),
}).strip();
