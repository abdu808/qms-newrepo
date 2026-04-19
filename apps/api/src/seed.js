import bcrypt from 'bcrypt';
import { prisma } from './db.js';
import { config } from './config.js';

async function main() {
  console.log('[seed] starting...');

  // Departments
  const depts = [
    { code: 'QM',  name: 'إدارة الجودة' },
    { code: 'ADM', name: 'الإدارة العامة' },
    { code: 'FIN', name: 'المالية' },
    { code: 'HR',  name: 'الموارد البشرية' },
    { code: 'PRG', name: 'البرامج والمستفيدين' },
    { code: 'MKT', name: 'التسويق وجمع التبرعات' },
    { code: 'IT',  name: 'تقنية المعلومات' },
  ];
  for (const d of depts) {
    await prisma.department.upsert({ where: { code: d.code }, update: {}, create: d });
  }

  // Admin user
  const adminPasswordHash = await bcrypt.hash(config.admin.password, config.bcryptRounds);
  const qmDept = await prisma.department.findUnique({ where: { code: 'QM' } });
  await prisma.user.upsert({
    where: { email: config.admin.email.toLowerCase() },
    update: {},
    create: {
      email: config.admin.email.toLowerCase(),
      passwordHash: adminPasswordHash,
      name: config.admin.name,
      role: 'SUPER_ADMIN',
      departmentId: qmDept?.id,
      jobTitle: 'مسؤول النظام',
    },
  });

  // Quality Manager — password from env or secure default (never hardcoded)
  const qmPassword = process.env.QM_PASSWORD || `QM@${new Date().getFullYear()}!${Math.random().toString(36).slice(2, 8)}`;
  const qmPwd = await bcrypt.hash(qmPassword, config.bcryptRounds);
  const qmUser = await prisma.user.upsert({
    where: { email: 'quality@bir-sabia.org.sa' },
    update: {},
    create: {
      email: 'quality@bir-sabia.org.sa',
      passwordHash: qmPwd,
      name: 'مدير الجودة',
      role: 'QUALITY_MANAGER',
      departmentId: qmDept?.id,
      jobTitle: 'مدير الجودة',
    },
  });
  if (qmUser.createdAt >= new Date(Date.now() - 5000)) {
    console.log(`[seed] Quality Manager created: quality@bir-sabia.org.sa — set QM_PASSWORD env to control password`);
  }

  // Sample Objectives
  if ((await prisma.objective.count()) === 0) {
    const admin = await prisma.user.findUnique({ where: { email: config.admin.email.toLowerCase() } });
    const samples = [
      { code: 'OBJ-2026-001', title: 'رفع رضا المستفيدين', kpi: 'نسبة رضا المستفيدين', target: 90, unit: '%', currentValue: 82, progress: 60, status: 'IN_PROGRESS' },
      { code: 'OBJ-2026-002', title: 'تقليل زمن معالجة الشكاوى', kpi: 'متوسط أيام المعالجة', target: 5, unit: 'يوم', currentValue: 7, progress: 40, status: 'IN_PROGRESS' },
      { code: 'OBJ-2026-003', title: 'تنويع قاعدة المتبرعين', kpi: 'عدد المتبرعين الجدد', target: 100, unit: 'متبرع', currentValue: 45, progress: 45, status: 'IN_PROGRESS' },
    ];
    for (const s of samples) {
      await prisma.objective.create({
        data: {
          ...s,
          departmentId: qmDept?.id,
          startDate: new Date('2026-01-01'),
          dueDate: new Date('2026-12-31'),
          createdById: admin.id,
        },
      });
    }
  }

  // Sample Risks
  if ((await prisma.risk.count()) === 0) {
    const admin = await prisma.user.findUnique({ where: { email: config.admin.email.toLowerCase() } });
    await prisma.risk.createMany({
      data: [
        { code: 'RSK-2026-001', title: 'انقطاع نظام التبرعات الإلكتروني', probability: 2, impact: 5, score: 10, level: 'متوسط', status: 'UNDER_TREATMENT', createdById: admin.id },
        { code: 'RSK-2026-002', title: 'عدم كفاية الموارد البشرية', probability: 3, impact: 4, score: 12, level: 'مرتفع', status: 'IDENTIFIED', createdById: admin.id },
      ],
    });
  }

  console.log('[seed] done.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
