import { prisma } from '../db.js';

/**
 * Fields that must NEVER be written to the audit log.
 * Any occurrence (at any depth) is replaced with the string '[REDACTED]'.
 */
const SENSITIVE_KEYS = new Set([
  'password', 'passwordHash', 'currentPassword', 'newPassword',
  'token', 'refreshToken', 'accessToken',
  'secret', 'apiKey', 'authorization',
  'nationalId',     // privacy — beneficiary IDs
  'phone',          // PII — stored in record itself; no need to duplicate in log
  'email',          // PII
  // PII في الشكاوى
  'complainantPhone', 'complainantEmail', 'complainantName',
  // PII في التبرعات
  'donorPhone', 'donorEmail', 'donorName',
  // PII في الإقرارات الخارجية
  'externalContact', 'externalName',
  // PII في أسماء ومقدمي الاستبيانات/التقييمات
  'respondentName', 'evaluatorName', 'evaluatorPhone', 'evaluatorEmail',
  // PII في المستفيدين
  'beneficiaryPhone', 'beneficiaryEmail', 'beneficiaryName',
  'guardianPhone', 'guardianEmail', 'guardianName',
  // عنوان
  'address', 'contactPhone', 'contactEmail',
]);

function redact(value, depth = 0) {
  if (value == null || depth > 6) return value;
  if (Array.isArray(value)) return value.map(v => redact(v, depth + 1));
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = SENSITIVE_KEYS.has(k) ? '[REDACTED]' : redact(v, depth + 1);
    }
    return out;
  }
  return value;
}

/**
 * Parse an Express request into (entityType, entityId) reliably.
 *   /api/donations        → ('donations',    null)
 *   /api/donations/abc    → ('donations',    'abc')
 *   /api/ncr/abc/approve  → ('ncr',          'abc')
 * Uses req.originalUrl so it works regardless of mount point.
 */
function parseEntity(req) {
  const url = (req.originalUrl || req.url).split('?')[0];
  const parts = url.split('/').filter(Boolean);
  // Strip leading 'api' if present
  const base = parts[0] === 'api' ? parts.slice(1) : parts;
  if (!base.length) return { entityType: null, entityId: null };

  // تمييز أجزاء تشبه المعرّفات (cuid/uuid/أرقام/hex) عن أجزاء المسار
  const isIdLike = (s) => (
    /^c[a-z0-9]{20,}$/i.test(s) ||         // cuid
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s) || // uuid
    /^[0-9a-f]{16,}$/i.test(s) ||           // hex id
    /^\d+$/.test(s)                         // numeric id
  );
  const RESERVED = /^(new|create|edit|update|delete)$/i;

  // آخر جزء يشبه المعرّف = entityId الفعلي
  let entityId = null;
  const typeSegments = [];
  for (const p of base) {
    if (isIdLike(p)) { entityId = p; continue; }
    if (RESERVED.test(p)) continue;
    typeSegments.push(p);
  }
  // النوع = الأجزاء غير المعرّفية مفصولة بنقطة (kpi.entries, ack-documents.tokens ...)
  const entityType = typeSegments.length ? typeSegments.join('.') : null;
  return { entityType, entityId };
}

/**
 * Audit trail middleware — logs every successful mutating request.
 * ISO 9001:2015 §7.5.3 — Control of documented information.
 */
export function auditTrail() {
  return (req, res, next) => {
    res.on('finish', async () => {
      try {
        if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return;
        if (res.statusCode >= 400) return;

        const action =
          req.method === 'POST'   ? 'CREATE' :
          req.method === 'DELETE' ? 'DELETE' : 'UPDATE';

        const { entityType, entityId } = parseEntity(req);

        // Skip noisy/irrelevant paths
        if (!entityType) return;
        if (entityType === 'auth')     return;   // auth has its own logAuth()
        if (entityType === 'audit-log') return;  // avoid recursion

        const body  = req.method !== 'DELETE' ? redact(req.body) : null;
        const bodyJson = body ? JSON.stringify(body).slice(0, 5000) : null;

        await prisma.auditLog.create({
          data: {
            userId:     req.user?.sub || null,
            action,
            entityType,
            entityId,
            ipAddress:  req.ip,
            userAgent:  req.headers['user-agent']?.slice(0, 500),
            changesJson: bodyJson,
          },
        });
      } catch (e) {
        // never fail the response over logging
        console.error('[audit] failed:', e.message);
      }
    });
    next();
  };
}

/**
 * Read-access audit middleware — logs successful GET requests for sensitive
 * entities (beneficiaries, complaints, ncr, donations, documents with PII).
 *
 * ISO 9001:2015 §7.5.3.2(b) — access controls with ability to reconstruct
 * who viewed privacy-sensitive records.
 *
 * Usage (opt-in per route):
 *   router.get('/:id', readAudit('Beneficiary'), asyncHandler(...));
 *
 * Only logs single-record reads (has :id). List endpoints (no id) are NOT
 * logged — too noisy and low-value. Use filters on the log to reconstruct
 * "who read which record when".
 */
export function readAudit(entityType) {
  return (req, res, next) => {
    res.on('finish', async () => {
      try {
        if (req.method !== 'GET') return;
        if (res.statusCode >= 400) return;
        // Only log record-level reads (there's a specific entity id in the path)
        const id = req.params.id;
        if (!id) return;
        await prisma.auditLog.create({
          data: {
            userId:     req.user?.sub || null,
            action:     'READ',
            entityType,
            entityId:   id,
            ipAddress:  req.ip,
            userAgent:  req.headers['user-agent']?.slice(0, 500),
          },
        });
      } catch (e) {
        console.error('[readAudit] failed:', e.message);
      }
    });
    next();
  };
}

export async function logAuth(userId, action, req) {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entityType: 'Auth',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']?.slice(0, 500),
      },
    });
  } catch (e) { /* ignore */ }
}
