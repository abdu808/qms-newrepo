/**
 * tests/integration/helpers/factories.js — بناة بيانات اختبار متكررة.
 * كل factory يُنشئ سجلاً مع قيم افتراضية معقولة، ويقبل `overrides` جزئي.
 */
import bcrypt from 'bcrypt';
import { prisma } from '../../../src/db.js';

let seq = 0;
const uniq = (prefix) => `${prefix}-${Date.now()}-${++seq}`;

export async function createUser(overrides = {}) {
  const password = overrides.password || 'Test1234!';
  const hash = await bcrypt.hash(password, 4);
  const email = overrides.email || uniq('user') + '@test.local';
  const data = {
    email,
    name: overrides.name || 'مستخدم اختبار',
    passwordHash: hash,
    role: overrides.role || 'EMPLOYEE',
    active: overrides.active ?? true,
    ...overrides,
    password: undefined,
  };
  // upsert — ضمان عدم فشل الاختبارات عند إعادة التشغيل أو تكرار الإيميل
  return prisma.user.upsert({
    where: { email },
    update: data,
    create: data,
  });
}

export async function createSupplier(overrides = {}) {
  return prisma.supplier.create({
    data: {
      code: overrides.code || uniq('SUP'),
      name: overrides.name || 'مورّد اختبار',
      type: overrides.type || 'خدمات',
      status: overrides.status || 'PENDING',
      ...overrides,
    },
  });
}

async function ensureSystemUser() {
  // مستخدم افتراضي لاستخدامه كـ reporter/creator عند عدم تمرير واحد
  return createUser({ email: 'system@test.local', role: 'SUPER_ADMIN', name: 'System' });
}

export async function createDocument(overrides = {}) {
  const creator = overrides.createdById
    ? { id: overrides.createdById }
    : await ensureSystemUser();
  return prisma.document.create({
    data: {
      code: overrides.code || uniq('DOC'),
      title: overrides.title || 'وثيقة اختبار',
      category: overrides.category || 'PROCEDURE',
      status: overrides.status || 'DRAFT',
      createdById: creator.id,
      ...overrides,
    },
  });
}

export async function createComplaint(overrides = {}) {
  return prisma.complaint.create({
    data: {
      code: overrides.code || uniq('CMP'),
      source: overrides.source || 'BENEFICIARY',
      channel: overrides.channel || 'PHONE',
      subject: overrides.subject || overrides.title || 'شكوى اختبار',
      description: overrides.description || 'وصف الشكوى',
      severity: overrides.severity || 'متوسطة',
      status: overrides.status || 'NEW',
      ...overrides,
      title: undefined,
    },
  });
}

export async function createNCR(overrides = {}) {
  const reporter = overrides.reporterId
    ? { id: overrides.reporterId }
    : await ensureSystemUser();
  return prisma.nCR.create({
    data: {
      code: overrides.code || uniq('NCR'),
      title: overrides.title || 'عدم مطابقة اختبار',
      description: overrides.description || 'وصف',
      severity: overrides.severity || 'متوسطة',
      status: overrides.status || 'OPEN',
      reporterId: reporter.id,
      ...overrides,
    },
  });
}
