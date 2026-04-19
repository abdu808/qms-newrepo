/**
 * dataHelpers.js — Unified consistency layer
 * ─────────────────────────────────────────────────────────────────
 * Replaces the scattered `deletedAt: null`, `normalize()`, range
 * checks, and required-field validations across 35+ route files.
 *
 * Goal: every custom route uses the SAME logic as crudFactory.
 * When a new model gains `deletedAt`, you only update this file.
 */
import { BadRequest } from '../utils/errors.js';

// ═══════════════════════════════════════════════════════════════
//  SOFT-DELETE
// ═══════════════════════════════════════════════════════════════

/**
 * Returns a `where` clause that excludes soft-deleted rows.
 * Usage:  prisma.complaint.findMany({ where: activeWhere({ status: 'NEW' }) })
 */
export function activeWhere(extra = {}) {
  return { ...extra, deletedAt: null };
}

/**
 * Same as activeWhere, but respects privileged `?includeDeleted=1`
 * and `?onlyDeleted=1` flags (QM/SA only).  Mirrors crudFactory logic.
 */
export function activeWhereForReq(req, extra = {}) {
  const role = req.user?.role;
  const privileged = role === 'SUPER_ADMIN' || role === 'QUALITY_MANAGER';
  if (privileged && req.query.onlyDeleted === '1') {
    return { ...extra, deletedAt: { not: null } };
  }
  if (privileged && req.query.includeDeleted === '1') {
    return { ...extra };
  }
  return { ...extra, deletedAt: null };
}

// ═══════════════════════════════════════════════════════════════
//  VALIDATION PRIMITIVES
//  Each throws BadRequest with an Arabic message; returns the coerced value.
// ═══════════════════════════════════════════════════════════════

/**
 * Ensure every field in `fields` is present (not null/undefined/empty-string)
 * on `obj`.  Throws BadRequest listing the missing field(s) in Arabic.
 *
 *   requireFields(req.body, { email: 'البريد الإلكتروني', password: 'كلمة المرور' });
 */
export function requireFields(obj, fields) {
  const missing = [];
  for (const [key, label] of Object.entries(fields)) {
    const v = obj?.[key];
    if (v === undefined || v === null || v === '') missing.push(label);
  }
  if (missing.length) {
    throw BadRequest(`الحقول الإلزامية مفقودة: ${missing.join('، ')}`);
  }
  return obj;
}

/**
 * Coerce `val` to an integer in [min,max].
 * Returns null when val is null/undefined/''.  Throws BadRequest otherwise if invalid.
 *
 *   data.satisfaction = intInRange(data.satisfaction, { min: 1, max: 5, label: 'درجة الرضا' });
 */
export function intInRange(val, { min, max, label = 'القيمة', nullable = true } = {}) {
  if (val === '' || val === null || val === undefined) {
    if (nullable) return null;
    throw BadRequest(`${label} مطلوبة`);
  }
  const n = Number(val);
  if (!Number.isFinite(n) || n < min || n > max) {
    throw BadRequest(`${label} يجب أن تكون بين ${min} و ${max}`);
  }
  return Math.trunc(n);
}

/**
 * Coerce `val` to a finite number in [min,max] (decimals allowed).
 */
export function numberInRange(val, { min, max, label = 'القيمة', nullable = true } = {}) {
  if (val === '' || val === null || val === undefined) {
    if (nullable) return null;
    throw BadRequest(`${label} مطلوبة`);
  }
  const n = Number(val);
  if (!Number.isFinite(n)) throw BadRequest(`${label} يجب أن تكون رقماً`);
  if (min !== undefined && n < min) throw BadRequest(`${label} يجب ألا تقل عن ${min}`);
  if (max !== undefined && n > max) throw BadRequest(`${label} يجب ألا تزيد عن ${max}`);
  return n;
}

/**
 * Coerce tri-state boolean: true/'true'/1 → true, false/'false'/0 → false,
 * null/undefined/'' → null (if nullable), else throws.
 */
export function triBool(val, { label = 'القيمة', nullable = true } = {}) {
  if (val === '' || val === null || val === undefined) {
    if (nullable) return null;
    throw BadRequest(`${label} مطلوبة`);
  }
  if (val === true  || val === 'true'  || val === 1 || val === '1') return true;
  if (val === false || val === 'false' || val === 0 || val === '0') return false;
  throw BadRequest(`${label} يجب أن تكون true أو false`);
}

/**
 * Normalize an email: trim + lowercase.  Throws if empty or shape is wrong.
 */
export function normalizeEmail(val, { label = 'البريد الإلكتروني', required = true } = {}) {
  if (val === '' || val === null || val === undefined) {
    if (required) throw BadRequest(`${label} مطلوب`);
    return null;
  }
  const s = String(val).trim().toLowerCase();
  // Permissive check (server-side) — UI does strict validation.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) {
    throw BadRequest(`${label} غير صالح`);
  }
  return s;
}

// ═══════════════════════════════════════════════════════════════
//  PAGINATION
// ═══════════════════════════════════════════════════════════════

/**
 * Parse standard ?page=&limit= query params (defaults 1 / 20, capped 100).
 * Returns { page, limit, skip, take } ready to feed Prisma.
 */
export function parsePaging(req, { defaultLimit = 20, maxLimit = 100 } = {}) {
  const page  = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(maxLimit, Math.max(1, Number(req.query.limit) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit, take: limit };
}

// ═══════════════════════════════════════════════════════════════
//  OBJECT CLEANING
// ═══════════════════════════════════════════════════════════════

/**
 * Remove keys whose value is `undefined` from `obj` (mutates + returns).
 * Used when building a Prisma `data:` payload from a partial request body.
 */
export function stripUndefined(obj) {
  for (const k of Object.keys(obj)) {
    if (obj[k] === undefined) delete obj[k];
  }
  return obj;
}
