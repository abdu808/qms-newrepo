/**
 * seed-ack-documents.mjs — يحمِّل السياسات والمواثيق من ملفات markdown إلى جدول AckDocument.
 *
 * الاستخدام:
 *   node seed-ack-documents.mjs
 *
 * قابل لإعادة التشغيل (upsert على code). النسخة تظل 1.0 ما لم يُحدَّثها مسؤول QM يدوياً.
 */
import { PrismaClient } from '@prisma/client';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const prisma = new PrismaClient();
const __dir = path.dirname(fileURLToPath(import.meta.url));
const docsDir = path.join(__dir, '..', '..', 'ISO9001', '14_السياسات_والمواثيق_2026');

/** جدول البذور — كل صف يربط ملف markdown بميتاداتا AckDocument */
const seeds = [
  {
    code: 'POL-QP-01',
    file: null, // سياسة الجودة مستقلة عن هذا الإطار (موجودة كـ QualityPolicy) — نتجاهلها هنا
    skip: true,
  },
  {
    code: 'CODE-ETH-01',
    file: '02_الميثاق_الأخلاقي.md',
    title: 'الميثاق الأخلاقي ومدوّنة السلوك الوظيفي',
    category: 'CODE_OF_ETHICS',
    audience: ['EMPLOYEE', 'VOLUNTEER'],
    renewFrequency: 'ANNUAL',
    mandatory: true,
    commitments: 'أتعهد بالالتزام بمبادئ الميثاق الأخلاقي وإبلاغ الإدارة عن أي مخالفة، وأتقبّل المساءلة.',
  },
  {
    code: 'POL-COI-01',
    file: '03_إقرار_تضارب_المصالح.md',
    title: 'سياسة وإقرار تضارب المصالح',
    category: 'CONFLICT_OF_INTEREST',
    audience: ['EMPLOYEE', 'BOARD_MEMBER'],
    renewFrequency: 'ANNUAL',
    mandatory: true,
    commitments: 'أُفصح عن أي تضارب مصالح وأمتنع عن أي قرار أكون فيه طرفاً متضارباً.',
  },
  {
    code: 'POL-NDA-01',
    file: '04_اتفاقية_السرية.md',
    title: 'اتفاقية السرية وعدم الإفشاء',
    category: 'CONFIDENTIALITY',
    audience: ['EMPLOYEE', 'VOLUNTEER', 'AUDITOR'],
    renewFrequency: 'ONCE',
    mandatory: true,
    commitments: 'أتعهد بالحفاظ على سرية جميع المعلومات الخاصة بالجمعية ومستفيديها، خلال وبعد انتهاء العلاقة.',
  },
  {
    code: 'POL-PDPL-01',
    file: '05_سياسة_حماية_البيانات_الشخصية.md',
    title: 'سياسة حماية البيانات الشخصية',
    category: 'DATA_PROTECTION',
    audience: ['EMPLOYEE', 'VOLUNTEER'],
    renewFrequency: 'ANNUAL',
    mandatory: true,
  },
  {
    code: 'POL-SG-01',
    file: '06_سياسة_الحماية_Safeguarding.md',
    title: 'سياسة الحماية (Safeguarding) للفئات الضعيفة',
    category: 'SAFEGUARDING',
    audience: ['EMPLOYEE', 'VOLUNTEER'],
    renewFrequency: 'ANNUAL',
    mandatory: true,
  },
  {
    code: 'POL-HAR-01',
    file: '07_سياسة_مكافحة_التحرش.md',
    title: 'سياسة مكافحة التحرش والتمييز',
    category: 'ANTI_HARASSMENT',
    audience: ['EMPLOYEE', 'VOLUNTEER'],
    renewFrequency: 'ANNUAL',
    mandatory: true,
  },
  {
    code: 'POL-AB-01',
    file: '08_سياسة_مكافحة_الفساد.md',
    title: 'سياسة مكافحة الفساد والرشوة',
    category: 'ANTI_CORRUPTION',
    audience: ['EMPLOYEE', 'BOARD_MEMBER', 'SUPPLIER'],
    renewFrequency: 'ANNUAL',
    mandatory: true,
  },
  {
    code: 'POL-WB-01',
    file: '09_سياسة_الإبلاغ_عن_المخالفات.md',
    title: 'سياسة الإبلاغ عن المخالفات',
    category: 'WHISTLEBLOWER',
    audience: ['EMPLOYEE', 'VOLUNTEER'],
    renewFrequency: 'ANNUAL',
    mandatory: true,
  },
  {
    code: 'POL-HR-01',
    file: '10_لائحة_العمل_الداخلية.md',
    title: 'لائحة العمل الداخلية (دليل الموظف)',
    category: 'WORK_REGULATIONS',
    audience: ['EMPLOYEE'],
    renewFrequency: 'ON_CHANGE',
    mandatory: true,
  },
  {
    code: 'CHR-BRD-01',
    file: '11_ميثاق_مجلس_الإدارة.md',
    title: 'ميثاق مجلس الإدارة',
    category: 'BOARD_CHARTER',
    audience: ['BOARD_MEMBER'],
    renewFrequency: 'ANNUAL',
    mandatory: true,
  },
  {
    code: 'CHR-BEN-01',
    file: '12_حقوق_ومسؤوليات_المستفيد.md',
    title: 'ميثاق حقوق ومسؤوليات المستفيد',
    category: 'BENEFICIARY_RIGHTS',
    audience: ['BENEFICIARY'],
    renewFrequency: 'ONCE',
    mandatory: true,
  },
  {
    code: 'CHR-SUP-01',
    file: '13_ميثاق_سلوك_الموردين.md',
    title: 'ميثاق سلوك الموردين',
    category: 'SUPPLIER_CODE',
    audience: ['SUPPLIER'],
    renewFrequency: 'ANNUAL',
    mandatory: true,
  },
  {
    code: 'POL-DNR-01',
    file: '14_سياسة_خصوصية_المتبرع.md',
    title: 'سياسة خصوصية المتبرع',
    category: 'DONOR_PRIVACY',
    audience: ['DONOR'],
    renewFrequency: 'ON_CHANGE',
    mandatory: true,
  },
];

async function main() {
  console.log('📚 بدء تحميل وثائق الإقرار من: ' + docsDir);
  let created = 0, updated = 0, skipped = 0;

  for (const s of seeds) {
    if (s.skip) { skipped++; continue; }
    const filePath = path.join(docsDir, s.file);
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️  لم يُعثر على الملف: ${s.file} — تخطي`);
      skipped++;
      continue;
    }
    const content = fs.readFileSync(filePath, 'utf-8');

    const existing = await prisma.ackDocument.findUnique({ where: { code: s.code } });
    if (existing) {
      await prisma.ackDocument.update({
        where: { code: s.code },
        data: {
          title: s.title,
          category: s.category,
          audience: s.audience,
          renewFrequency: s.renewFrequency || 'ON_CHANGE',
          mandatory: s.mandatory ?? true,
          commitments: s.commitments || existing.commitments,
          content,
          // لا نغيّر active أو version لحماية الإصدارات المعتمدة
        },
      });
      updated++;
      console.log(`♻️  تحديث: ${s.code} — ${s.title}`);
    } else {
      await prisma.ackDocument.create({
        data: {
          code: s.code,
          title: s.title,
          category: s.category,
          audience: s.audience,
          renewFrequency: s.renewFrequency || 'ON_CHANGE',
          mandatory: s.mandatory ?? true,
          commitments: s.commitments || null,
          content,
          version: '1.0',
          active: false, // تحتاج تفعيل يدوي من QM بعد المراجعة
        },
      });
      created++;
      console.log(`✅ إنشاء: ${s.code} — ${s.title}`);
    }
  }

  console.log(`\n📊 الملخص: ${created} جديد · ${updated} محدَّث · ${skipped} متخطّى`);
  console.log('⚠️  الوثائق تم إنشاؤها بحالة `active=false` — يجب تفعيلها من شاشة QM بعد المراجعة.');
}

main()
  .catch(e => { console.error('❌', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
