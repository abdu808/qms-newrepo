/**
 * schemas/complaint.schema.js — تحقق Zod للشكاوى (ISO 9.1.2 / P-11).
 */
import { z } from 'zod';
import {
  trimmedString, optionalTrimmedString, idString, optionalDate, intInRange,
} from './_helpers.js';

const SOURCES  = ['BENEFICIARY', 'DONOR', 'VOLUNTEER', 'EMPLOYEE', 'PARTNER', 'OTHER'];
const CHANNELS = ['PHONE', 'EMAIL', 'WEBSITE', 'IN_PERSON', 'WHATSAPP', 'SOCIAL', 'OTHER'];
const STATUSES = ['NEW', 'UNDER_REVIEW', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'REJECTED'];
const SEVERITIES = ['منخفضة', 'متوسطة', 'مرتفعة'];

const phone = z.preprocess(
  v => {
    if (v == null) return null;
    const t = String(v).trim();
    return t === '' ? null : t;
  },
  z.string().regex(/^[+0-9\s\-()]{6,20}$/, 'رقم هاتف غير صالح').nullable().optional(),
);

const email = z.preprocess(
  v => {
    if (v == null) return null;
    const t = String(v).trim();
    return t === '' ? null : t;
  },
  z.string().email('بريد إلكتروني غير صالح').max(200).nullable().optional(),
);

export const createSchema = z.object({
  source:           z.enum(SOURCES),
  channel:          z.enum(CHANNELS),
  complainantName:  optionalTrimmedString(120),
  complainantPhone: phone,
  complainantEmail: email,
  subject:          trimmedString(3, 300),
  description:      trimmedString(10, 5000),
  receivedAt:       optionalDate,
  severity:         z.enum(SEVERITIES).default('متوسطة'),
  assigneeId:       idString.nullable().optional(),
  status:           z.enum(STATUSES).default('NEW'),
  relatedNcrId:     idString.nullable().optional(),
}).strip();

export const updateSchema = z.object({
  source:           z.enum(SOURCES).optional(),
  channel:          z.enum(CHANNELS).optional(),
  complainantName:  optionalTrimmedString(120),
  complainantPhone: phone,
  complainantEmail: email,
  subject:          trimmedString(3, 300).optional(),
  description:      trimmedString(10, 5000).optional(),
  severity:         z.enum(SEVERITIES).optional(),
  assigneeId:       idString.nullable().optional(),
  rootCause:        optionalTrimmedString(5000),
  resolution:       optionalTrimmedString(5000),
  resolvedAt:       optionalDate,
  satisfaction:     intInRange(1, 5),
  status:           z.enum(STATUSES).optional(),
  relatedNcrId:     idString.nullable().optional(),
}).strip();

export const querySchema = z.object({
  q:          z.string().max(200).optional(),
  status:     z.enum(STATUSES).optional(),
  severity:   z.enum(SEVERITIES).optional(),
  assigneeId: idString.optional(),
}).strip();
