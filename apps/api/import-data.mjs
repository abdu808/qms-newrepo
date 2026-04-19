/**
 * import-data.mjs — استيراد المستفيدين والتبرعات من Excel
 */
import xlsx from 'xlsx';
import { prisma } from './src/db.js';

const { readFile, utils } = xlsx;

// ─── تصنيف الفئات ────────────────────────────────────────────
const CAT_MAP = {
  'أ': 'ORPHAN',        // أيتام
  'ب': 'WIDOW',         // أرامل
  'ج': 'POOR_FAMILY',   // أسر فقيرة
  'د': 'OTHER',         // متنوع (كفالات وغيرها)
  'مؤقت': 'OTHER',
};

// ─── استخراج اسم المتبرع من البيان ───────────────────────────
function extractDonorName(bayan, donorCol) {
  if (donorCol && typeof donorCol === 'string' && donorCol.trim()) return donorCol.trim();
  if (!bayan) return 'متبرع غير معروف';
  // "تبرع عام - اسم المتبرع - فيصل ناصر..." → آخر جزء بعد " - "
  const parts = String(bayan).split(' - ').map(s => s.trim()).filter(Boolean);
  if (parts.length > 1) return parts[parts.length - 1];
  return String(bayan).substring(0, 60);
}

// ─── تحويل التاريخ ───────────────────────────────────────────
function parseDate(str) {
  if (!str) return new Date();
  if (typeof str === 'number') {
    // Excel serial date
    return new Date((str - 25569) * 86400 * 1000);
  }
  const s = String(str).trim();
  // 2026/04/16 format
  const m = s.match(/(\d{4})\/(\d{2})\/(\d{2})/);
  if (m) return new Date(`${m[1]}-${m[2]}-${m[3]}`);
  return new Date();
}

// ─── دالة مساعدة للدُفعات ────────────────────────────────────
async function batchInsert(items, fn, label) {
  const BATCH = 100;
  let done = 0, skipped = 0, errors = 0;
  for (let i = 0; i < items.length; i += BATCH) {
    const chunk = items.slice(i, i + BATCH);
    for (const item of chunk) {
      try {
        await fn(item);
        done++;
      } catch (e) {
        if (e.code === 'P2002') { skipped++; } // unique constraint
        else { errors++; /* console.error(e.message.split('\n')[0]); */ }
      }
    }
    process.stdout.write(`\r  ${label}: ${done} مُدخَل، ${skipped} مكرر، ${errors} خطأ  `);
  }
  console.log();
  return { done, skipped, errors };
}

// ══════════════════════════════════════════════════════════════
// 1. استيراد المستفيدين
// ══════════════════════════════════════════════════════════════
async function importBeneficiaries() {
  console.log('\n📥 استيراد المستفيدين...');
  const wb = readFile('C:/Users/abdu8/Downloads/18 أبريل 2026.xlsx');
  const rows = utils.sheet_to_json(wb.Sheets['Sheet1'], { header: 1 });

  // احصاء الموجودين للكود
  const startCount = await prisma.beneficiary.count();

  const items = rows.slice(1).map((r, idx) => {
    const fullName  = String(r[0] || '').trim();
    const catLetter = String(r[1] || '').trim();
    const fileNo    = r[2];
    const phone     = r[3] ? String(r[3]).trim() : null;
    const natId     = r[4] ? String(r[4]).trim() : null;
    const location  = String(r[5] || '').trim();

    // استخراج المدينة والحي من الموقع (مثال: "القحله-صبيا" → district=القحله city=صبيا)
    const locParts = location.split('-').map(s => s.trim());
    const district = locParts.length > 1 ? locParts[0] : null;
    const city     = locParts.length > 1 ? locParts[1] : location || null;

    const code = `BEN-2026-${String(startCount + idx + 1).padStart(4, '0')}`;

    return {
      code,
      fullName: fullName || 'بدون اسم',
      nationalId: natId || null,
      category: CAT_MAP[catLetter] || 'OTHER',
      phone,
      district,
      city,
      status: 'ACTIVE',
      notes: fileNo ? `رقم الملف: ${fileNo} | الفئة: ${catLetter}` : `الفئة: ${catLetter}`,
    };
  }).filter(r => r.fullName && r.fullName !== 'بدون اسم');

  console.log(`  إجمالي الصفوف للمعالجة: ${items.length}`);
  return batchInsert(items, (item) => prisma.beneficiary.create({ data: item }), 'مستفيد');
}

// ══════════════════════════════════════════════════════════════
// 2. استيراد التبرعات
// ══════════════════════════════════════════════════════════════
async function importDonations() {
  console.log('\n💰 استيراد التبرعات...');
  const wb = readFile('C:/Users/abdu8/Downloads/18 أبريل 2026 (1).xlsx');
  const rows = utils.sheet_to_json(wb.Sheets['Sheet1'], { header: 1 });

  const startCount = await prisma.donation.count();

  const items = rows.slice(1).map((r, idx) => {
    const amount     = Number(r[1]) || 0;
    const year       = Number(r[2]) || 2026;
    const receiptNo  = r[3] ? String(r[3]) : null;
    const typeAr     = String(r[4] || '').trim();
    const bayan      = r[5];
    const statusAr   = String(r[6] || '').trim();
    const methodAr   = String(r[7] || '').trim();
    const donorCol   = r[12]; // ملف الداعم
    const donorPhone = r[13] ? String(r[13]).trim() : null;
    const notes      = r[25] ? String(r[25]).trim() : null;
    const dateStr    = r[27]; // تاريخ السند الرقمي (2026/04/16)
    const createdBy  = r[29] ? String(r[29]).trim() : null;

    const code = `DON-${year}-${String(startCount + idx + 1).padStart(4, '0')}`;
    const donorName = extractDonorName(bayan, donorCol);

    // تصنيف نوع التبرع
    let donorType = 'general';
    if (typeAr === 'كفالة مالية') donorType = 'sponsorship';
    else if (typeAr === 'تبرع لمشروع') donorType = 'project';
    else if (typeAr === 'تبرع لمستفيد') donorType = 'beneficiary';

    return {
      code,
      type: 'CASH',
      donorName,
      donorPhone,
      donorType,
      amount,
      currency: 'SAR',
      status: statusAr === 'معتمد' ? 'VERIFIED' : 'RECEIVED',
      receivedAt: parseDate(dateStr),
      receivedBy: createdBy,
      notes: [
        typeAr,
        receiptNo ? `رقم السند: ${receiptNo}` : null,
        methodAr ? `وسيلة القبض: ${methodAr}` : null,
        notes,
        bayan ? String(bayan).substring(0, 100) : null,
      ].filter(Boolean).join(' | '),
    };
  });

  console.log(`  إجمالي الصفوف للمعالجة: ${items.length}`);
  return batchInsert(items, (item) => prisma.donation.create({ data: item }), 'تبرع');
}

// ══════════════════════════════════════════════════════════════
// Main
// ══════════════════════════════════════════════════════════════
const t0 = Date.now();
const benResult = await importBeneficiaries();
const donResult = await importDonations();

const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
const totalBen = await prisma.beneficiary.count();
const totalDon = await prisma.donation.count();
const totalAmount = await prisma.donation.aggregate({ _sum: { amount: true } });

console.log('\n══════════════════════════════════════════════════');
console.log(`✅ المستفيدون:  ${benResult.done} مُدخَل، ${benResult.skipped} مكرر`);
console.log(`✅ التبرعات:    ${donResult.done} مُدخَلة، ${donResult.skipped} مكرر`);
console.log(`📊 إجمالي المستفيدين في النظام: ${totalBen.toLocaleString('ar')}`);
console.log(`💰 إجمالي التبرعات في النظام:   ${totalDon.toLocaleString('ar')}`);
console.log(`💵 إجمالي المبالغ:              ${(totalAmount._sum.amount||0).toLocaleString('ar', {minimumFractionDigits:2})} ريال`);
console.log(`⏱️  الوقت المستغرق:              ${elapsed} ثانية`);
console.log('══════════════════════════════════════════════════\n');

await prisma.$disconnect();
