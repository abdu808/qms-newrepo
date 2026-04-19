/**
 * schemas/user.schema.js — تحقق Zod للمستخدمين.
 * ملاحظة: التسجيل ينشئ المستخدم عبر seed أو endpoint مخصص
 * (لا يوجد تسجيل عام). هذه schemas تخدم admin /users CRUD.
 */
import { z } from 'zod';
import { trimmedString, optionalTrimmedString, idString } from './_helpers.js';

const ROLES = [
  'SUPER_ADMIN',
  'QUALITY_MANAGER',
  'COMMITTEE_MEMBER',
  'DEPT_MANAGER',
  'EMPLOYEE',
  'GUEST_AUDITOR',
];

const emailField = z.preprocess(
  v => (typeof v === 'string' ? v.trim().toLowerCase() : v),
  z.string().email('بريد إلكتروني غير صالح').max(200),
);

const phoneField = z.preprocess(
  v => {
    if (v == null) return null;
    const t = String(v).trim();
    return t === '' ? null : t;
  },
  z.string()
    .regex(/^[+0-9\s\-()]{6,20}$/, 'رقم هاتف غير صالح')
    .nullable()
    .optional(),
);

export const createSchema = z.object({
  email:        emailField,
  name:         trimmedString(2, 120),
  // Password set via a dedicated endpoint — optional here (admin can create then invite).
  // If provided, enforce minimum length.
  password:     z.string().min(8, 'كلمة المرور ٨ أحرف كحد أدنى').max(128).optional(),
  role:         z.enum(ROLES).default('EMPLOYEE'),
  departmentId: idString.nullable().optional(),
  phone:        phoneField,
  jobTitle:     optionalTrimmedString(120),
  active:       z.boolean().optional(),
}).strip();

export const updateSchema = z.object({
  email:        emailField.optional(),
  name:         trimmedString(2, 120).optional(),
  role:         z.enum(ROLES).optional(),
  departmentId: idString.nullable().optional(),
  phone:        phoneField,
  jobTitle:     optionalTrimmedString(120),
  active:       z.boolean().optional(),
  // لا يُسمح بتعديل كلمة المرور عبر CRUD العادي — endpoint مخصص.
}).strip();

export const querySchema = z.object({
  q:            z.string().max(200).optional(),
  role:         z.enum(ROLES).optional(),
  departmentId: idString.optional(),
  active:       z.enum(['true', 'false']).optional(),
}).strip();
