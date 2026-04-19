/**
 * upload-iso-docs.mjs
 * ─────────────────────────────────────────────────────────────
 * يُنشئ سجلات الوثائق في قاعدة البيانات ثم يرفع الملفات.
 * يستخدم ملفات PDF حيثما توفرت، وإلا DOCX.
 * يتجاهل المجلدات 06-10 (أدوات/نماذج/نظام قديم).
 *
 * التشغيل:  node apps/api/upload-iso-docs.mjs
 */

import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
// Node.js 18+ has built-in fetch and FormData — no external packages needed

const __dir = path.dirname(fileURLToPath(import.meta.url));
const BASE   = 'http://localhost:3000/api';
const ISO_DIR = path.join(__dir, '..', '..', 'ISO9001');

// ─── بيانات تسجيل الدخول ─────────────────────────────────
const ADMIN_EMAIL    = process.env.ADMIN_EMAIL    || 'admin@bir-sabia.org.sa';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@2026';

// ─── خريطة الوثائق المراد رفعها ──────────────────────────
// filePdf: مسار PDF إن وُجد | fileDocx: مسار DOCX احتياطي
// category: من DocCategory  | isoClause: بند ISO
const DOCS = [
  // ── 01 السياسات والأهداف ─────────────────────────────────
  {
    code: 'QM-001', title: 'دليل نظام إدارة الجودة',
    category: 'MANUAL', isoClause: '4.3', version: '1.0',
    filePdf:  '01_السياسات_والأهداف/QM-001-2026-دليل-نظام-إدارة-الجودة.pdf',
    fileDocx: '01_السياسات_والأهداف/QM-001-2026-دليل-نظام-إدارة-الجودة.docx',
  },
  {
    code: 'QM-002', title: 'نطاق نظام إدارة الجودة',
    category: 'POLICY', isoClause: '4.3', version: '1.0',
    filePdf:  '01_السياسات_والأهداف/QM-002-2026-نطاق-نظام-إدارة-الجودة.pdf',
    fileDocx: '01_السياسات_والأهداف/QM-002-2026-نطاق-نظام-إدارة-الجودة.docx',
  },
  {
    code: 'QP-001', title: 'سياسة الجودة',
    category: 'POLICY', isoClause: '5.2', version: '1.0',
    filePdf:  '01_السياسات_والأهداف/QP-001-2026-سياسة-الجودة.pdf',
    fileDocx: '01_السياسات_والأهداف/QP-001-2026-سياسة-الجودة.docx',
  },
  {
    code: 'QP-002', title: 'أهداف الجودة',
    category: 'POLICY', isoClause: '6.2', version: '1.0',
    filePdf:  '01_السياسات_والأهداف/QP-002-2026-أهداف-الجودة.pdf',
    fileDocx: '01_السياسات_والأهداف/QP-002-2026-أهداف-الجودة.docx',
  },
  {
    code: 'QP-003', title: 'إجراء إدارة المخاطر والفرص',
    category: 'PROCEDURE', isoClause: '6.1', version: '1.0',
    filePdf:  '01_السياسات_والأهداف/QP-003-2026-إدارة-المخاطر-والفرص.pdf',
    fileDocx: '01_السياسات_والأهداف/QP-003-2026-إدارة-المخاطر-والفرص.docx',
  },
  {
    code: 'QP-004', title: 'إجراء ضبط الوثائق والسجلات',
    category: 'PROCEDURE', isoClause: '7.5', version: '1.0',
    filePdf:  '01_السياسات_والأهداف/QP-004-2026-ضبط-الوثائق-والسجلات.pdf',
    fileDocx: '01_السياسات_والأهداف/QP-004-2026-ضبط-الوثائق-والسجلات.docx',
  },
  {
    code: 'QP-005', title: 'سياسة التوثيق الرشيق',
    category: 'POLICY', isoClause: '7.5', version: '1.0',
    filePdf:  '01_السياسات_والأهداف/QP-005-2026-سياسة-التوثيق-الرشيق.pdf',
    fileDocx: '01_السياسات_والأهداف/QP-005-2026-سياسة-التوثيق-الرشيق.docx',
  },

  // ── 02 الإجراءات التشغيلية ────────────────────────────────
  {
    code: 'FIN-001', title: 'السياسة المالية واسترداد التبرعات',
    category: 'PROCEDURE', isoClause: '8.1', version: '1.0',
    fileDocx: '02_الإجراءات_التشغيلية/FIN-001-2026-السياسة-المالية-واسترداد-التبرعات.docx',
  },
  {
    code: 'HR-001', title: 'إجراء الموارد البشرية',
    category: 'PROCEDURE', isoClause: '7.1', version: '1.0',
    fileDocx: '02_الإجراءات_التشغيلية/HR-001-2026-إجراء-الموارد-البشرية.docx',
  },
  {
    code: 'IT-001', title: 'سياسة البنية التحتية التقنية',
    category: 'POLICY', isoClause: '7.1', version: '1.0',
    fileDocx: '02_الإجراءات_التشغيلية/IT-001-2026-سياسة-البنية-التحتية-التقنية.docx',
  },
  {
    code: 'PUR-001', title: 'إجراء المشتريات والموردين',
    category: 'PROCEDURE', isoClause: '8.4', version: '1.0',
    fileDocx: '02_الإجراءات_التشغيلية/PUR-001-2026-إجراء-المشتريات-والموردين.docx',
  },
  {
    code: 'QS-001', title: 'إجراءات تقديم الخدمات الاجتماعية',
    category: 'PROCEDURE', isoClause: '8.5', version: '1.0',
    fileDocx: '02_الإجراءات_التشغيلية/QS-001-2026-إجراءات-تقديم-الخدمات.docx',
  },
  {
    code: 'QS-002', title: 'إجراء إدارة المتطوعين',
    category: 'PROCEDURE', isoClause: '7.1', version: '1.0',
    fileDocx: '02_الإجراءات_التشغيلية/QS-002-2026-إدارة-المتطوعين.docx',
  },
  {
    code: 'QS-003', title: 'إجراء إدارة التبرعات',
    category: 'PROCEDURE', isoClause: '8.1', version: '1.0',
    fileDocx: '02_الإجراءات_التشغيلية/QS-003-2026-إدارة-التبرعات.docx',
  },
  {
    code: 'QS-004', title: 'إجراء حماية المستفيدين ومعالجة الشكاوى',
    category: 'PROCEDURE', isoClause: '9.1.2', version: '1.0',
    filePdf:  '05_وثائق_النشر_العام/QS-004-2026-حماية-المستفيدين-والشكاوى.pdf',
    fileDocx: '02_الإجراءات_التشغيلية/QS-004-2026-حماية-المستفيدين-والشكاوى.docx',
  },

  // ── 03 الحوكمة والمخاطر ──────────────────────────────────
  {
    code: 'GOV-001', title: 'ميثاق مجلس الإدارة واللجان',
    category: 'POLICY', isoClause: '5.1', version: '1.0',
    filePdf:  '03_الحوكمة_والمخاطر/GOV-001-2026-ميثاق-مجلس-الإدارة-واللجان.pdf',
    fileDocx: '03_الحوكمة_والمخاطر/GOV-001-2026-ميثاق-مجلس-الإدارة-واللجان.docx',
  },
  {
    code: 'GOV-002', title: 'سياسة الإفصاح والشفافية',
    category: 'POLICY', isoClause: '5.1', version: '1.0',
    filePdf:  '05_وثائق_النشر_العام/PUB-005-2026-سياسة-الإفصاح-والشفافية.pdf',
    fileDocx: '03_الحوكمة_والمخاطر/GOV-002-2026-سياسة-الإفصاح-والشفافية.docx',
  },
  {
    code: 'MR-001', title: 'أجندة مراجعة الإدارة',
    category: 'FORM', isoClause: '9.3', version: '1.0',
    fileDocx: '03_الحوكمة_والمخاطر/MR-001-2026-أجندة-مراجعة-الإدارة.docx',
  },
  {
    code: 'MR-002', title: 'نموذج تقرير مراجعة الإدارة',
    category: 'FORM', isoClause: '9.3', version: '1.0',
    fileDocx: '03_الحوكمة_والمخاطر/MR-002-2026-تقرير-مراجعة-الإدارة.docx',
  },

  // ── 04 التدقيق والتحسين ──────────────────────────────────
  {
    code: 'CA-001', title: 'إجراء عدم المطابقة والإجراءات التصحيحية',
    category: 'PROCEDURE', isoClause: '10.2', version: '1.0',
    fileDocx: '04_التدقيق_والتحسين/CA-001-2026-إجراء-عدم-المطابقة-والإجراءات-التصحيحية.docx',
  },
  {
    code: 'CA-002', title: 'سجل متابعة الإجراءات التصحيحية',
    category: 'RECORD', isoClause: '10.2', version: '1.0',
    fileDocx: '04_التدقيق_والتحسين/CA-002-2026-سجل-متابعة-الإجراءات-التصحيحية.docx',
  },
  {
    code: 'IA-001', title: 'خطة التدقيق الداخلي',
    category: 'PROCEDURE', isoClause: '9.2', version: '1.0',
    fileDocx: '04_التدقيق_والتحسين/IA-001-2026-خطة-التدقيق-الداخلي.docx',
  },
  {
    code: 'IA-002', title: 'نموذج تقرير التدقيق الداخلي',
    category: 'FORM', isoClause: '9.2', version: '1.0',
    fileDocx: '04_التدقيق_والتحسين/IA-002-2026-نموذج-تقرير-التدقيق-الداخلي.docx',
  },

  // ── 05 وثائق النشر العام (إضافية) ────────────────────────
  {
    code: 'PUB-006', title: 'سياسة مكافحة الاحتيال',
    category: 'POLICY', isoClause: '5.1', version: '1.0',
    filePdf:  '05_وثائق_النشر_العام/PUB-006-2026-سياسة-مكافحة-الاحتيال.pdf',
    fileDocx: '05_وثائق_النشر_العام/PUB-006-2026-سياسة-مكافحة-الاحتيال.docx',
  },
  {
    code: 'PUB-007', title: 'سياسة حماية المستفيدين',
    category: 'POLICY', isoClause: '8.2', version: '1.0',
    filePdf:  '05_وثائق_النشر_العام/PUB-007-2026-سياسة-حماية-المستفيدين.pdf',
    fileDocx: '05_وثائق_النشر_العام/PUB-007-2026-سياسة-حماية-المستفيدين.docx',
  },
  {
    code: 'PUB-008', title: 'سياسة استرداد التبرعات',
    category: 'POLICY', isoClause: '8.1', version: '1.0',
    filePdf:  '05_وثائق_النشر_العام/PUB-008-2026-سياسة-استرداد-التبرعات.pdf',
    fileDocx: '05_وثائق_النشر_العام/PUB-008-2026-سياسة-استرداد-التبرعات.docx',
  },
  {
    code: 'PUB-009', title: 'السياسة المالية العامة',
    category: 'POLICY', isoClause: '8.1', version: '1.0',
    filePdf:  '05_وثائق_النشر_العام/PUB-009-2026-السياسة-المالية-العامة.pdf',
    fileDocx: '05_وثائق_النشر_العام/PUB-009-2026-السياسة-المالية-العامة.docx',
  },
];

// ─── مساعدات ─────────────────────────────────────────────
function resolvePath(rel) {
  if (!rel) return null;
  const p = path.join(ISO_DIR, rel);
  return fs.existsSync(p) ? p : null;
}

function getMime(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.pdf')  return 'application/pdf';
  if (ext === '.docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (ext === '.doc')  return 'application/msword';
  return 'application/octet-stream';
}

async function apiJson(method, url, body, token) {
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(url, opts);
  const data = await r.json();
  if (!r.ok) throw new Error(data.message || `HTTP ${r.status}`);
  return data;
}

// ─── Main ─────────────────────────────────────────────────
async function main() {
  // 1. تسجيل الدخول
  console.log('🔐 تسجيل الدخول...');
  const auth = await apiJson('POST', `${BASE}/auth/login`, {
    email: ADMIN_EMAIL, password: ADMIN_PASSWORD,
  });
  const token = auth.accessToken || auth.token;
  if (!token) throw new Error('فشل الحصول على التوكن');
  console.log('✅ تم تسجيل الدخول\n');

  // 2. جلب الوثائق الموجودة
  const existing = await apiJson('GET', `${BASE}/documents?limit=200`, null, token);
  const existingCodes = new Set((existing.items || []).map(d => d.code));
  console.log(`📋 وثائق موجودة في النظام: ${existingCodes.size}\n`);

  let created = 0, uploaded = 0, skipped = 0, errors = 0;

  for (const doc of DOCS) {
    // تحديد الملف المناسب (PDF أولاً)
    const pdfPath  = resolvePath(doc.filePdf);
    const docxPath = resolvePath(doc.fileDocx);
    const filePath = pdfPath || docxPath;

    if (!filePath) {
      console.log(`⚠️  [${doc.code}] الملف غير موجود — تخطي`);
      skipped++;
      continue;
    }

    try {
      // 3. إنشاء سجل الوثيقة إن لم يكن موجوداً
      let docRecord;
      if (existingCodes.has(doc.code)) {
        // جلب السجل الموجود
        const list = await apiJson('GET', `${BASE}/documents?search=${doc.code}&limit=5`, null, token);
        docRecord = (list.items || []).find(d => d.code === doc.code);
        console.log(`📄 [${doc.code}] موجود مسبقاً — سيُرفع الملف فقط`);
      } else {
        docRecord = await apiJson('POST', `${BASE}/documents`, {
          code:     doc.code,
          title:    doc.title,
          category: doc.category,
          isoClause: doc.isoClause,
          currentVersion: doc.version,
          retentionYears: 5,
        }, token);
        // crudFactory يُعيد { item } أو الكائن مباشرة
        if (docRecord.item) docRecord = docRecord.item;
        console.log(`✨ [${doc.code}] تم إنشاؤه — "${doc.title}"`);
        created++;
      }

      if (!docRecord?.id) throw new Error('لم يُعد ID للوثيقة');

      // 4. رفع الملف باستخدام FormData المدمج في Node.js 18+
      const fileBuffer = fs.readFileSync(filePath);
      const blob = new Blob([fileBuffer], { type: getMime(filePath) });
      const form = new FormData();
      form.append('file', blob, path.basename(filePath));
      form.append('version', doc.version);
      form.append('changeLog', 'إصدار أولي — رفع تلقائي');

      const uploadRes = await fetch(`${BASE}/documents/${docRecord.id}/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.message || `رفع فشل HTTP ${uploadRes.status}`);

      const fileType = pdfPath ? 'PDF' : 'DOCX';
      const sizeKb   = Math.round(fs.statSync(filePath).size / 1024);
      console.log(`   ⬆️  رُفع [${fileType}] ${sizeKb} KB ✅`);
      uploaded++;

    } catch (e) {
      console.error(`   ❌ [${doc.code}] خطأ: ${e.message}`);
      errors++;
    }
  }

  console.log('\n══════════════════════════════════════');
  console.log(`✅ تم إنشاء:  ${created} وثيقة جديدة`);
  console.log(`⬆️  تم رفع:   ${uploaded} ملف`);
  console.log(`⏭️  تخطي:     ${skipped} (ملف غير موجود)`);
  console.log(`❌ أخطاء:    ${errors}`);
  console.log('══════════════════════════════════════\n');
}

main().catch(e => { console.error('خطأ فادح:', e.message); process.exit(1); });
