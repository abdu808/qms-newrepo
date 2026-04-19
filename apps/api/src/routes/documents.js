import { Router } from 'express';
import { crudRouter } from '../utils/crudFactory.js';
import { prisma } from '../db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { BadRequest, NotFound } from '../utils/errors.js';
import { requireAction } from '../lib/permissions.js';
import { createSchema as docCreateSchema, updateSchema as docUpdateSchema } from '../schemas/document.schema.js';
import {
  approveDocument, obsoleteDocument, acknowledgeDocument, guardDocumentUpdate,
} from '../services/documentApproval.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(__dir, '..', '..', '..', 'uploads', 'docs');

// Ensure upload directory exists (robust to read-only / wrong-owner volumes)
try {
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
} catch (e) {
  // Don't crash the server on boot — just warn. Uploads will fail later with
  // a clearer error. This handles Coolify's "volume mounted as root" gotcha.
  console.warn(`[documents] cannot create UPLOAD_DIR (${UPLOAD_DIR}):`, e.message);
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ts = Date.now();
    const ext = path.extname(file.originalname);
    cb(null, `${ts}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg', 'image/png',
    ];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('نوع الملف غير مسموح به — PDF أو Word أو Excel أو صور فقط'));
  },
});

// حالة الوثيقة + قواعد الاعتماد/النشر نُقلت إلى services/documentApproval.js
// (ISO 7.5.3 — مصدر حقيقة واحد).

const router = crudRouter({
  model: 'document',
  codePrefix: 'DOC',
  searchFields: ['title', 'code'],
  include: {
    department: true,
    createdBy:  { select: { id: true, name: true } },
    approvedBy: { select: { id: true, name: true } },
    _count: { select: { acks: true, versions: true } },
  },
  allowedSortFields: ['createdAt', 'title', 'status'],
  schemas: { create: docCreateSchema, update: docUpdateSchema },
  smartFilters: {
    draft:     () => ({ status: 'DRAFT' }),
    published: () => ({ status: 'PUBLISHED' }),
    archived:  () => ({ status: 'ARCHIVED' }),
    mine:      (req) => ({ createdById: req.user.sub }),
    expiring:  () => {
      const soon = new Date(Date.now() + 30 * 86400000);
      return { status: 'PUBLISHED', reviewDate: { lt: soon } };
    },
    thisMonth: () => {
      const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0);
      return { createdAt: { gte: d } };
    },
  },
  beforeCreate: async (data, req) => ({ ...data, createdById: req.user.sub, status: 'DRAFT' }),
  beforeUpdate: async (data, req) => {
    // حقول الاعتماد لا تُعدَّل إلا عبر /approve — ننزعها هنا دائماً
    delete data.approvedById;
    delete data.approvedAt;
    return guardDocumentUpdate(data, req.params.id);
  },
});

// POST /:id/approve — اعتماد رسمي (مع خيار publish)
router.post('/:id/approve', asyncHandler(async (req, res) => {
  const publish = req.body?.publish === true || req.body?.publish === 'true';
  const item = await approveDocument({
    docId:    req.params.id,
    userId:   req.user.sub,
    userRole: req.user.role,
    publish,
  });
  res.json({ ok: true, item });
}));

// POST /:id/obsolete — سحب نهائي للوثيقة
router.post('/:id/obsolete', asyncHandler(async (req, res) => {
  const item = await obsoleteDocument({
    docId:    req.params.id,
    userRole: req.user.role,
  });
  res.json({ ok: true, item });
}));

// GET /:id/versions — سجل الإصدارات (ISO 7.5.3)
router.get('/:id/versions', requireAction('documents', 'read'), asyncHandler(async (req, res) => {
  const doc = await prisma.document.findUnique({
    where: { id: req.params.id },
    select: { id: true, code: true, title: true, currentVersion: true, status: true },
  });
  if (!doc) throw NotFound('الوثيقة غير موجودة');
  const versions = await prisma.docVersion.findMany({
    where: { documentId: req.params.id },
    orderBy: { uploadedAt: 'desc' },
  });
  res.json({ ok: true, document: doc, versions });
}));

// Acknowledge a document
router.post('/:id/ack', requireAction('documents', 'read'), asyncHandler(async (req, res) => {
  const ack = await acknowledgeDocument({
    docId:  req.params.id,
    userId: req.user.sub,
  });
  res.json({ ok: true, item: ack });
}));

// POST /:id/upload — رفع ملف إصدار جديد (ISO 7.5.3)
router.post('/:id/upload', requireAction('documents', 'update'), upload.single('file'), asyncHandler(async (req, res) => {
  const doc = await prisma.document.findUnique({ where: { id: req.params.id } });
  if (!doc) throw NotFound('الوثيقة غير موجودة');
  if (!req.file) throw BadRequest('لم يتم إرفاق ملف');

  const version  = (req.body.version  || doc.currentVersion).trim();
  const changeLog = req.body.changeLog || null;

  // Save version record
  const ver = await prisma.docVersion.create({
    data: {
      documentId: doc.id,
      version,
      filePath:  req.file.filename,
      fileSize:  req.file.size,
      mimeType:  req.file.mimetype,
      changeLog,
    },
  });

  // Bump document's currentVersion to the uploaded version
  await prisma.document.update({
    where: { id: doc.id },
    data:  { currentVersion: version },
  });

  res.json({ ok: true, version: ver });
}));

// GET /:id/download/:versionId — تنزيل ملف إصدار
router.get('/:id/download/:versionId', requireAction('documents', 'read'), asyncHandler(async (req, res) => {
  const ver = await prisma.docVersion.findUnique({
    where: { id: req.params.versionId },
    include: { document: { select: { id: true, code: true, title: true } } },
  });
  if (!ver || ver.documentId !== req.params.id) throw NotFound('الملف غير موجود');

  const filePath = path.join(UPLOAD_DIR, ver.filePath);
  if (!fs.existsSync(filePath)) throw NotFound('الملف المادي غير موجود على الخادم');

  const ext = path.extname(ver.filePath);
  const safeName = `${ver.document.code}_v${ver.version}${ext}`;
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(safeName)}`);
  res.setHeader('Content-Type', ver.mimeType || 'application/octet-stream');
  res.sendFile(filePath);
}));

export default router;
