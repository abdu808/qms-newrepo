import { Router } from 'express';
import bcrypt from 'bcrypt';
import { prisma } from '../db.js';
import { config } from '../config.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { NotFound, Conflict } from '../utils/errors.js';
import { normalizeEmail, stripUndefined } from '../lib/dataHelpers.js';
import { requireAction } from '../lib/permissions.js';
import { createSchema as userCreateSchema, updateSchema as userUpdateSchema } from '../schemas/user.schema.js';
import { runSchema } from '../schemas/_helpers.js';

const validateCreate = runSchema(userCreateSchema);
const validateUpdate = runSchema(userUpdateSchema);

const router = Router();
const pub = { id: true, email: true, name: true, role: true, departmentId: true, jobTitle: true, phone: true, active: true, lastLoginAt: true, createdAt: true };

router.get('/', requireAction('users', 'read'), asyncHandler(async (req, res) => {
  const users = await prisma.user.findMany({ select: pub, orderBy: { createdAt: 'desc' } });
  res.json({ ok: true, items: users, total: users.length });
}));

router.get('/:id', requireAction('users', 'read'), asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id }, select: pub });
  if (!user) throw NotFound();
  res.json({ ok: true, item: user });
}));

router.post('/', requireAction('users', 'create'), asyncHandler(async (req, res) => {
  // Zod: password إلزامي عند إنشاء مستخدم جديد (لا نصنع مستخدم بلا كلمة سر)
  const body = validateCreate({ ...req.body, password: req.body?.password });
  if (!body.password) throw Conflict('كلمة المرور إلزامية عند إنشاء مستخدم جديد');

  const normalizedEmail = normalizeEmail(body.email);
  const exists = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (exists) throw Conflict('البريد مسجل مسبقاً');

  const passwordHash = await bcrypt.hash(body.password, config.bcryptRounds);
  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      passwordHash,
      name:         body.name,
      role:         body.role || 'EMPLOYEE',
      departmentId: body.departmentId ?? null,
      jobTitle:     body.jobTitle ?? null,
      phone:        body.phone ?? null,
      active:       body.active ?? true,
    },
    select: pub,
  });
  res.status(201).json({ ok: true, item: user });
}));

router.put('/:id', requireAction('users', 'update'), asyncHandler(async (req, res) => {
  const body = validateUpdate(req.body);
  // كلمة المرور لا تمر عبر schema العام — تبقى منفصلة حتى لا تُسرَّب عبر عمليات تعديل عامة
  const password = req.body?.password;

  const data = stripUndefined({
    name:         body.name,
    role:         body.role,
    departmentId: body.departmentId,
    jobTitle:     body.jobTitle,
    phone:        body.phone,
    active:       body.active,
  });
  if (password) {
    if (typeof password !== 'string' || password.length < 8) {
      throw Conflict('كلمة المرور الجديدة ٨ أحرف كحد أدنى');
    }
    data.passwordHash = await bcrypt.hash(password, config.bcryptRounds);
  }
  const user = await prisma.user.update({ where: { id: req.params.id }, data, select: pub });
  res.json({ ok: true, item: user });
}));

router.delete('/:id', requireAction('users', 'delete'), asyncHandler(async (req, res) => {
  await prisma.user.update({ where: { id: req.params.id }, data: { active: false } });
  res.json({ ok: true });
}));

export default router;
