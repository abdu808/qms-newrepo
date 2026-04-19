/**
 * ackDocuments.js — إطار الإقرارات الموحَّد (سياسات، مواثيق، إقرارات)
 * ISO 37001 · PDPL · CHS · لائحة الجمعيات · مبادئ الحوكمة
 *
 * يُدير:
 *  - وثائق تتطلب إقراراً (AckDocument)
 *  - سجل الإقرارات (Acknowledgment) — داخلي (موظف) أو خارجي (مستفيد/مورد/متبرع)
 */
import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { BadRequest, NotFound } from '../utils/errors.js';
import { crudRouter } from '../utils/crudFactory.js';
import { requireAction } from '../lib/permissions.js';
import { activeWhere } from '../lib/dataHelpers.js';

const router = Router();

// ── CRUD للوثائق (سياسات/مواثيق) — QM فقط ───────────────────────────
const docsCrud = crudRouter({
  resource: 'ack-documents',
  model: 'ackDocument',
  codePrefix: 'ACK',
  searchFields: ['title', 'code', 'content'],
  allowedSortFields: ['createdAt', 'title', 'category', 'version'],
  allowedFilters: ['active', 'category', 'mandatory'],
  beforeCreate: async (data, req) => {
    data.createdById = req.user?.sub;
    if (data.audience && !Array.isArray(data.audience)) data.audience = [data.audience];
    return data;
  },
  beforeUpdate: async (data) => {
    if (data.audience && !Array.isArray(data.audience)) data.audience = [data.audience];
    return data;
  },
});

/**
 * POST /:id/activate — تفعيل الوثيقة (تنتقل من draft إلى active)
 * QM+ فقط
 */
router.post('/:id/activate', requireAction('ack-documents', 'update'), asyncHandler(async (req, res) => {
  const doc = await prisma.ackDocument.findUnique({ where: { id: req.params.id } });
  if (!doc) throw NotFound('الوثيقة غير موجودة');
  const updated = await prisma.ackDocument.update({
    where: { id: doc.id },
    data: {
      active: true,
      effectiveDate: doc.effectiveDate || new Date(),
      approvedBy: req.body.approvedBy || doc.approvedBy || req.user?.name,
      approvedAt: new Date(),
    },
  });
  res.json({ ok: true, doc: updated });
}));

/**
 * POST /:id/deactivate — إلغاء تفعيل وثيقة (عند إصدار نسخة جديدة)
 */
router.post('/:id/deactivate', requireAction('ack-documents', 'update'), asyncHandler(async (req, res) => {
  const updated = await prisma.ackDocument.update({
    where: { id: req.params.id },
    data: { active: false },
  });
  res.json({ ok: true, doc: updated });
}));

// ─────────────────────────────────────────────────────────────────────
// إقرارات المستخدم الحالي (الموظف)
// ─────────────────────────────────────────────────────────────────────

/**
 * GET /me/pending — قائمة الوثائق التي تخصّ الموظف ولم يُقرّ بها بعد
 */
router.get('/me/pending', asyncHandler(async (req, res) => {
  const userId = req.user.sub;
  const userRole = req.user.role;

  // تحديد الفئات المستهدفة بناء على دور المستخدم (الموظفون دائماً EMPLOYEE؛ SUPER_ADMIN يدخل كل شيء مستهدف للموظفين)
  const relevantAudiences = ['EMPLOYEE', 'ALL'];
  // (يمكن توسيعها لاحقاً لتمييز المتطوعين/الأعضاء عبر حقل خاص على User)

  const docs = await prisma.ackDocument.findMany({
    where: activeWhere({
      active: true,
      audience: { hasSome: relevantAudiences },
    }),
    orderBy: [{ mandatory: 'desc' }, { effectiveDate: 'desc' }],
  });

  const acks = await prisma.acknowledgment.findMany({
    where: { userId, documentId: { in: docs.map(d => d.id) } },
    select: { documentId: true, documentVersion: true, acknowledgedAt: true },
  });

  // خريطة: documentId+version → ack
  const ackMap = new Map(acks.map(a => [`${a.documentId}:${a.documentVersion}`, a]));

  const pending = [];
  const completed = [];
  for (const d of docs) {
    const key = `${d.id}:${d.version}`;
    const ack = ackMap.get(key);
    if (ack) {
      completed.push({ ...d, acknowledgedAt: ack.acknowledgedAt });
    } else {
      pending.push(d);
    }
  }
  res.json({ ok: true, pending, completed, pendingCount: pending.length });
}));

/**
 * POST /:id/acknowledge — المستخدم الحالي يُقرّ بوثيقة
 */
router.post('/:id/acknowledge', asyncHandler(async (req, res) => {
  const doc = await prisma.ackDocument.findUnique({ where: { id: req.params.id } });
  if (!doc) throw NotFound('الوثيقة غير موجودة');
  if (!doc.active) throw BadRequest('الوثيقة غير مفعّلة');

  const ack = await prisma.acknowledgment.upsert({
    where: {
      ack_internal_unique: {
        documentId: doc.id,
        documentVersion: doc.version,
        userId: req.user.sub,
      },
    },
    update: {}, // idempotent
    create: {
      documentId: doc.id,
      documentVersion: doc.version,
      userId: req.user.sub,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      method: 'DIGITAL',
    },
  });
  res.status(201).json({ ok: true, ack });
}));

/**
 * GET /me/history — سجلّ جميع إقرارات الموظف
 */
router.get('/me/history', asyncHandler(async (req, res) => {
  const items = await prisma.acknowledgment.findMany({
    where: { userId: req.user.sub },
    include: { document: { select: { code: true, title: true, category: true, version: true } } },
    orderBy: { acknowledgedAt: 'desc' },
  });
  res.json({ ok: true, items });
}));

// ─────────────────────────────────────────────────────────────────────
// QM — مصفوفة التغطية الشاملة + تقارير
// ─────────────────────────────────────────────────────────────────────

/**
 * GET /matrix — مصفوفة التغطية: جميع المستخدمين النشطين × جميع الوثائق الفعّالة
 * QM+ فقط
 */
router.get('/matrix', requireAction('ack-documents', 'update'), asyncHandler(async (req, res) => {
  const category = req.query.category; // فلترة اختيارية
  const audience = req.query.audience;  // فلترة اختيارية

  const whereDocs = activeWhere({ active: true });
  if (category) whereDocs.category = category;
  if (audience) whereDocs.audience = { has: audience };

  const [docs, users] = await Promise.all([
    prisma.ackDocument.findMany({
      where: whereDocs,
      select: { id: true, code: true, title: true, category: true, version: true, audience: true, mandatory: true },
      orderBy: [{ category: 'asc' }, { title: 'asc' }],
    }),
    prisma.user.findMany({
      where: { active: true },
      select: { id: true, name: true, email: true, role: true, departmentId: true,
                department: { select: { name: true } } },
      orderBy: { name: 'asc' },
    }),
  ]);

  const acksFinal = docs.length
    ? await prisma.acknowledgment.findMany({
        where: { documentId: { in: docs.map(d => d.id) }, userId: { not: null } },
        select: { documentId: true, documentVersion: true, userId: true, acknowledgedAt: true },
      })
    : [];

  const ackIndex = new Map(); // key: userId:docId:version → ackedAt
  for (const a of acksFinal) {
    ackIndex.set(`${a.userId}:${a.documentId}:${a.documentVersion}`, a.acknowledgedAt);
  }

  // بناء مصفوفة
  const rows = users.map(u => {
    const cells = docs.map(d => {
      const ackedAt = ackIndex.get(`${u.id}:${d.id}:${d.version}`);
      return {
        docId: d.id,
        acknowledged: !!ackedAt,
        acknowledgedAt: ackedAt || null,
      };
    });
    const ackedCount = cells.filter(c => c.acknowledged).length;
    return {
      user: { id: u.id, name: u.name, email: u.email, role: u.role,
              department: u.department?.name || null },
      cells,
      ackedCount,
      totalCount: docs.length,
      coverage: docs.length ? Math.round((ackedCount / docs.length) * 100) : 0,
    };
  });

  // إجماليات الوثائق
  const docStats = docs.map(d => {
    const count = acksFinal.filter(a => a.documentId === d.id && a.documentVersion === d.version).length;
    return { ...d, ackedCount: count, totalUsers: users.length,
             coverage: users.length ? Math.round((count / users.length) * 100) : 0 };
  });

  res.json({
    ok: true,
    docs: docStats,
    users: users.length,
    rows,
    overall: {
      totalCells: users.length * docs.length,
      acknowledgedCells: acksFinal.length,
      coverage: users.length && docs.length
        ? Math.round((acksFinal.length / (users.length * docs.length)) * 100)
        : 0,
    },
  });
}));

/**
 * GET /:id/report — تقرير إقرار وثيقة محددة (من أقرّ/لم يُقرّ)
 */
router.get('/:id/report', requireAction('ack-documents', 'update'), asyncHandler(async (req, res) => {
  const doc = await prisma.ackDocument.findUnique({ where: { id: req.params.id } });
  if (!doc) throw NotFound('الوثيقة غير موجودة');

  // فئات المستخدمين المستهدفين (داخلياً: employees/all)
  const internalAudiences = ['EMPLOYEE', 'ALL', 'BOARD_MEMBER', 'VOLUNTEER', 'AUDITOR'];
  const isInternal = doc.audience.some(a => internalAudiences.includes(a));

  let rows = [];
  let stats = { total: 0, acknowledged: 0, pending: 0, coverage: 0 };

  if (isInternal) {
    const [users, acks] = await Promise.all([
      prisma.user.findMany({ where: { active: true },
        select: { id: true, name: true, email: true, role: true,
                  department: { select: { name: true } } },
        orderBy: { name: 'asc' } }),
      prisma.acknowledgment.findMany({
        where: { documentId: doc.id, documentVersion: doc.version, userId: { not: null } },
        select: { userId: true, acknowledgedAt: true, ipAddress: true, method: true },
      }),
    ]);
    const ackMap = new Map(acks.map(a => [a.userId, a]));
    rows = users.map(u => ({
      ...u,
      department: u.department?.name || null,
      acknowledged: ackMap.has(u.id),
      acknowledgedAt: ackMap.get(u.id)?.acknowledgedAt || null,
      method: ackMap.get(u.id)?.method || null,
      ipAddress: ackMap.get(u.id)?.ipAddress || null,
    }));
    stats = {
      total: users.length,
      acknowledged: acks.length,
      pending: users.length - acks.length,
      coverage: users.length ? Math.round((acks.length / users.length) * 100) : 0,
    };
  } else {
    // إقرارات خارجية (مستفيدين/موردين/متبرعين) — نعرض السجلات كما هي
    const acks = await prisma.acknowledgment.findMany({
      where: { documentId: doc.id, documentVersion: doc.version },
      orderBy: { acknowledgedAt: 'desc' },
    });
    rows = acks.map(a => ({
      externalType: a.externalType,
      externalId: a.externalId,
      externalName: a.externalName,
      externalContact: a.externalContact,
      acknowledgedAt: a.acknowledgedAt,
      method: a.method,
      ipAddress: a.ipAddress,
      evidenceUrl: a.evidenceUrl,
    }));
    stats = { total: rows.length, acknowledged: rows.length, pending: 0, coverage: 100 };
  }

  res.json({ ok: true, doc, stats, rows });
}));

/**
 * POST /:id/external-ack — تسجيل إقرار من طرف خارجي (مستفيد/مورد/متبرع)
 * يُستخدم لتسجيل الإقرارات الورقية أو الإقرارات الرقمية عبر روابط عامة
 */
router.post('/:id/external-ack', requireAction('ack-documents', 'update'), asyncHandler(async (req, res) => {
  const doc = await prisma.ackDocument.findUnique({ where: { id: req.params.id } });
  if (!doc) throw NotFound('الوثيقة غير موجودة');
  const { externalType, externalId, externalName, externalContact, method, evidenceUrl, notes } = req.body;
  if (!externalType || !externalName) throw BadRequest('externalType و externalName مطلوبان');

  const ack = await prisma.acknowledgment.create({
    data: {
      documentId: doc.id,
      documentVersion: doc.version,
      externalType,
      externalId: externalId || null,
      externalName,
      externalContact: externalContact || null,
      method: method || 'PAPER',
      evidenceUrl: evidenceUrl || null,
      notes: notes || null,
      ipAddress: req.ip,
    },
  });
  res.status(201).json({ ok: true, ack });
}));

// ─────────────────────────────────────────────────────────────────────
// AckToken — روابط إقرار شخصية (تُرسل عبر واتساب/SMS/بريد)
// ─────────────────────────────────────────────────────────────────────

/**
 * POST /:id/tokens — إنشاء رابط إقرار مرتبط بشخص
 * body: { userId? } أو { externalType, externalName, externalContact }
 * يمكن إرسال body.bulk = true مع body.userIds = [] لإنشاء دفعة
 */
router.post('/:id/tokens', requireAction('ack-documents', 'update'), asyncHandler(async (req, res) => {
  const doc = await prisma.ackDocument.findUnique({ where: { id: req.params.id } });
  if (!doc) throw NotFound('الوثيقة غير موجودة');
  if (!doc.active) throw BadRequest('الوثيقة غير مفعّلة — فعّلها أولاً');

  const { userId, userIds, externalType, externalName, externalContact, sentVia, expiresAt, notes } = req.body;
  const createdById = req.user?.sub || null;
  const expires = expiresAt ? new Date(expiresAt) : new Date(Date.now() + 90 * 86400000); // 90 يوماً

  // Bulk mode — مصفوفة مستخدمين
  if (Array.isArray(userIds) && userIds.length) {
    const tokens = [];
    for (const uid of userIds) {
      // تخطّي من أقرّ مسبقاً
      const existing = await prisma.acknowledgment.findUnique({
        where: { ack_internal_unique: { documentId: doc.id, documentVersion: doc.version, userId: uid } },
      }).catch(() => null);
      if (existing) continue;
      // إعادة استخدام توكن غير مستخدم لنفس الشخص/الإصدار بدلاً من تكراره
      const existingToken = await prisma.ackToken.findFirst({
        where: { documentId: doc.id, documentVersion: doc.version, userId: uid, usedAt: null },
      });
      if (existingToken) { tokens.push(existingToken); continue; }
      const t = await prisma.ackToken.create({
        data: {
          documentId: doc.id,
          documentVersion: doc.version,
          userId: uid,
          createdById,
          expiresAt: expires,
          sentVia: sentVia || null,
          notes: notes || null,
        },
      });
      tokens.push(t);
    }
    return res.status(201).json({ ok: true, tokens, count: tokens.length });
  }

  // Single mode
  if (!userId && !externalName) throw BadRequest('حدّد userId أو externalName');

  // تخطّي إن أقرّ المستخدم مسبقاً
  if (userId) {
    const existing = await prisma.acknowledgment.findUnique({
      where: { ack_internal_unique: { documentId: doc.id, documentVersion: doc.version, userId } },
    }).catch(() => null);
    if (existing) throw BadRequest('هذا المستخدم قد أقرّ بهذه الوثيقة مسبقاً');
    const existingToken = await prisma.ackToken.findFirst({
      where: { documentId: doc.id, documentVersion: doc.version, userId, usedAt: null },
    });
    if (existingToken) return res.json({ ok: true, token: existingToken, reused: true });
  }

  const t = await prisma.ackToken.create({
    data: {
      documentId: doc.id,
      documentVersion: doc.version,
      userId: userId || null,
      externalType: externalType || null,
      externalName: externalName || null,
      externalContact: externalContact || null,
      sentVia: sentVia || null,
      createdById,
      expiresAt: expires,
      notes: notes || null,
    },
  });
  res.status(201).json({ ok: true, token: t });
}));

/**
 * GET /:id/tokens — قائمة الروابط لهذه الوثيقة
 */
router.get('/:id/tokens', requireAction('ack-documents', 'update'), asyncHandler(async (req, res) => {
  const items = await prisma.ackToken.findMany({
    where: { documentId: req.params.id },
    include: { user: { select: { name: true, email: true, role: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ ok: true, items });
}));

/**
 * POST /:id/tokens/:tokenId/mark-sent — تأشير الرابط كـ "مُرسل"
 */
router.post('/:id/tokens/:tokenId/mark-sent', requireAction('ack-documents', 'update'), asyncHandler(async (req, res) => {
  const t = await prisma.ackToken.update({
    where: { id: req.params.tokenId },
    data: { sentAt: new Date(), sentVia: req.body.sentVia || 'WHATSAPP' },
  });
  res.json({ ok: true, token: t });
}));

/**
 * DELETE /:id/tokens/:tokenId — إلغاء رابط غير مستخدم
 */
router.delete('/:id/tokens/:tokenId', requireAction('ack-documents', 'update'), asyncHandler(async (req, res) => {
  const t = await prisma.ackToken.findUnique({ where: { id: req.params.tokenId } });
  if (!t) throw NotFound('الرابط غير موجود');
  if (t.usedAt) throw BadRequest('لا يمكن حذف رابط تمّ استخدامه — احتفظ به كدليل');
  await prisma.ackToken.delete({ where: { id: req.params.tokenId } });
  res.json({ ok: true });
}));

// تثبيت crudRouter في النهاية حتى لا يلتقط مساراتنا المخصّصة (/matrix، /me/*، /:id/activate …) كـ /:id
router.use('/', docsCrud);

export default router;
