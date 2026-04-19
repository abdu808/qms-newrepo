/**
 * lib/beneficiaryAssessment.js — Batch 15
 * ──────────────────────────────────────────────────────────────
 * محرك تقييم احتياجات المستفيدين (P-08 §3 / ISO 8.2.2 / 9.1.2).
 *
 * يحسب درجة الأولوية 1-5 من مُدخلات كمية وكيفية، دون الحاجة لأي Migration:
 *   - monthlyIncome        (دخل شهري بالريال)
 *   - familySize           (عدد أفراد الأسرة)
 *   - category             (الفئة — تأثير أساسي على الأولوية)
 *   - vulnerabilityFlags   (CSV: مؤشرات حماية — كل مؤشر يرفع الأولوية)
 *   - assessedAt           (للدورية — آخر تقييم)
 *
 * القاعدة: كل عامل يعطي "نقاطاً" ثم نُحوّل إلى مقياس 1-5 نهائي.
 *
 * الدورية (ISO 9.1.2): إعادة تقييم كل 365 يوماً.
 */

const REVIEW_INTERVAL_DAYS = 365;

// وزن أساسي لكل فئة (1=أقل إلحاحاً، 5=أشد إلحاحاً)
const CATEGORY_BASE = {
  ORPHAN:      5,
  DISABLED:    5,
  WIDOW:       4,
  POOR_FAMILY: 3,
  ELDERLY:     4,
  STUDENT:     2,
  OTHER:       2,
};

// مؤشرات حماية مقبولة (كل مؤشر يضيف نقطة إضافية)
export const VULNERABILITY_FLAGS = [
  { key: 'child_no_guardian', label: 'طفل بلا معيل' },
  { key: 'severe_disability', label: 'إعاقة شديدة' },
  { key: 'chronic_illness',   label: 'مرض مزمن' },
  { key: 'homeless',          label: 'بلا مأوى' },
  { key: 'abuse_victim',      label: 'ضحية إساءة' },
  { key: 'single_parent',     label: 'أسرة ذات عائل واحد' },
  { key: 'elderly_alone',     label: 'مسن بلا عائلة' },
  { key: 'medical_emergency', label: 'حالة طبية طارئة' },
];
const VALID_FLAG_KEYS = new Set(VULNERABILITY_FLAGS.map(f => f.key));

/**
 * خط الفقر المرجعي (ريال/فرد/شهر) — يُستخدم كعتبة لحساب الكفاية.
 * يُمكن تعديله عبر متغير بيئة QMS_POVERTY_LINE بدون تغيير الكود.
 */
function povertyLine() {
  const v = Number(process.env.QMS_POVERTY_LINE);
  return Number.isFinite(v) && v > 0 ? v : 1100;
}

function parseFlags(csv) {
  if (!csv) return [];
  return String(csv)
    .split(/[,،]/).map(s => s.trim()).filter(Boolean)
    .filter(k => VALID_FLAG_KEYS.has(k));
}

/**
 * يحسب الأولوية من بيانات المستفيد.
 * @param {{category, familySize, monthlyIncome, vulnerabilityFlags}} b
 * @returns {{score:1|2|3|4|5, breakdown:object, incomePerCapita:number|null,
 *            recommendation:'APPROVE'|'CONDITIONAL'|'REVIEW'|'REJECT'}}
 */
export function computePriority(b) {
  const base = CATEGORY_BASE[b.category] ?? 2;

  // العامل الاقتصادي (0-3 نقاط): على أساس نصيب الفرد من الدخل
  const fam = Math.max(1, Number(b.familySize) || 1);
  const income = Number(b.monthlyIncome);
  const pl = povertyLine();
  let economicPoints = 0;
  let incomePerCapita = null;
  if (Number.isFinite(income) && income >= 0) {
    incomePerCapita = +(income / fam).toFixed(2);
    if (incomePerCapita < 0.3 * pl)      economicPoints = 3;
    else if (incomePerCapita < 0.6 * pl) economicPoints = 2;
    else if (incomePerCapita < pl)       economicPoints = 1;
    else                                 economicPoints = 0;
  }

  // مؤشرات الحماية (كل مؤشر = 0.75، حد أقصى 3)
  const flags = parseFlags(b.vulnerabilityFlags);
  const vulnPoints = Math.min(3, flags.length * 0.75);

  // حجم الأسرة (0-1.5 نقطة إضافية للأسر الكبيرة)
  let familyPoints = 0;
  if (fam >= 8)      familyPoints = 1.5;
  else if (fam >= 5) familyPoints = 1.0;
  else if (fam >= 3) familyPoints = 0.5;

  // الصيغة النهائية: base (1-5) + factors — ثم نقصّها إلى 1-5
  const raw = base + economicPoints * 0.6 + vulnPoints * 0.5 + familyPoints * 0.4;
  const score = Math.max(1, Math.min(5, Math.round(raw)));

  // توصية
  let recommendation;
  if (score >= 4) recommendation = 'APPROVE';
  else if (score === 3) recommendation = 'CONDITIONAL';
  else if (score === 2) recommendation = 'REVIEW';
  else recommendation = 'REJECT';

  return {
    score,
    recommendation,
    incomePerCapita,
    povertyLine: pl,
    breakdown: {
      category: b.category,
      categoryBase: base,
      economicPoints,
      vulnerabilityFlags: flags,
      vulnPoints: +vulnPoints.toFixed(2),
      familyPoints,
      familySize: fam,
      rawTotal: +raw.toFixed(2),
    },
  };
}

/**
 * يحدّد هل يلزم إعادة تقييم (365 يوماً من آخر تقييم).
 */
export function needsReview(beneficiary, now = new Date()) {
  if (beneficiary.status !== 'ACTIVE') return false;
  if (!beneficiary.assessedAt) return true; // نشط بلا تقييم أساساً
  const ageDays = (now.getTime() - new Date(beneficiary.assessedAt).getTime()) / (24 * 3600 * 1000);
  return ageDays > REVIEW_INTERVAL_DAYS;
}

export function reviewDueDate(beneficiary) {
  if (!beneficiary.assessedAt) return null;
  return new Date(new Date(beneficiary.assessedAt).getTime() + REVIEW_INTERVAL_DAYS * 24 * 3600 * 1000);
}

/**
 * يتحقق من استيفاء متطلبات التفعيل (APPLICANT → ACTIVE).
 * يُستدعى من beforeUpdate في routes/beneficiaries.js.
 */
export function assertActivationReady(b) {
  const missing = [];
  if (!b.needsAssessment || !String(b.needsAssessment).trim()) missing.push('وصف الاحتياجات (needsAssessment)');
  if (!b.priorityScore) missing.push('درجة الأولوية (priorityScore)');
  if (!b.assessedAt) missing.push('تاريخ التقييم (assessedAt)');
  if (!b.assessedBy || !String(b.assessedBy).trim()) missing.push('اسم المقيّم (assessedBy)');
  if (missing.length) {
    const err = new Error('لا يمكن تفعيل المستفيد قبل استكمال التقييم: ' + missing.join(' · '));
    err.status = 400;
    throw err;
  }
}

export const REVIEW_INTERVAL = REVIEW_INTERVAL_DAYS;
