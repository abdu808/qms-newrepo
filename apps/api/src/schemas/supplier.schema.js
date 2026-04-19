/**
 * schemas/supplier.schema.js — تحقق Zod للموردين (ISO 8.4).
 */
import { z } from 'zod';
import { trimmedString, optionalTrimmedString } from './_helpers.js';

const TYPES = [
  'GOODS', 'SERVICES', 'CONSTRUCTION', 'IT_SERVICES',
  'IN_KIND_DONOR', 'TRANSPORT', 'CONSULTING', 'OTHER',
];
const STATUSES = [
  'PENDING', 'APPROVED', 'CONDITIONAL', 'REJECTED', 'SUSPENDED', 'BLACKLISTED',
];

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

// CR/VAT: أرقام بطول معقول (السعودية: CR = 10 أرقام، VAT = 15).
const numericId = (max) => z.preprocess(
  v => {
    if (v == null) return null;
    const t = String(v).trim();
    return t === '' ? null : t;
  },
  z.string().regex(/^[0-9]+$/, 'يجب أن يحتوي أرقاماً فقط').max(max).nullable().optional(),
);

export const createSchema = z.object({
  name:          trimmedString(2, 200),
  type:          z.enum(TYPES),
  category:      optionalTrimmedString(120),
  crNumber:      numericId(20),
  vatNumber:     numericId(20),
  contactPerson: optionalTrimmedString(120),
  phone,
  email,
  address:       optionalTrimmedString(500),
  city:          optionalTrimmedString(100),
  status:        z.enum(STATUSES).default('PENDING'),
  notes:         optionalTrimmedString(2000),
}).strip();

export const updateSchema = createSchema.partial();

export const querySchema = z.object({
  q:      z.string().max(200).optional(),
  status: z.enum(STATUSES).optional(),
  type:   z.enum(TYPES).optional(),
  city:   z.string().max(100).optional(),
}).strip();
