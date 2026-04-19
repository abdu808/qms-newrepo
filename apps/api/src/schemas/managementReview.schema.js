/**
 * schemas/managementReview.schema.js — تحقق Zod للمراجعة الإدارية (ISO 9.3).
 * مهم: meetingDate يحتاج تحويل من string → Date قبل أن يصل Prisma.
 */
import { z } from 'zod';
import {
  trimmedString, optionalTrimmedString, optionalDate, coercedBoolean,
} from './_helpers.js';

const STATUSES = ['PLANNED', 'IN_PROGRESS', 'COMPLETED'];

export const createSchema = z.object({
  title:             trimmedString(3, 300),
  period:            optionalTrimmedString(100),
  meetingDate:       optionalDate,
  attendees:         optionalTrimmedString(5000),
  topManagementPresent: coercedBoolean,
  objectivesReview:  optionalTrimmedString(10000),
  risksStatus:       optionalTrimmedString(10000),
  conformityStatus:  optionalTrimmedString(10000),
  customerFeedback:  optionalTrimmedString(10000),
  auditResults:      optionalTrimmedString(10000),
  processPerformance: optionalTrimmedString(10000),
  decisions:         optionalTrimmedString(10000),
  improvementActions: optionalTrimmedString(10000),
  resourceNeeds:     optionalTrimmedString(10000),
  status:            z.enum(STATUSES).default('PLANNED'),
}).strip();

export const updateSchema = createSchema.partial();
