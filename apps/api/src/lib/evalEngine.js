/**
 * lib/evalEngine.js — Batch 12
 * ──────────────────────────────────────────────────────────────
 * محرك تقييم موحّد للموردين والتبرعات.
 * يحل مشكلة التباين بين:
 *   - المسار الداخلي (supplierEvals.js)     — رابط قرار مبسط + متوسط حسابي
 *   - المسار العام   (publicEval.js)         — قرار متقدم + قيمة أحدث
 * بعد هذا الملف: الاثنان يستخدمان نفس المعادلات والـ overallRating.
 *
 * كما يوفّر محرك تقييم تبرعات يتغيّر حسب نوع التبرع (CASH/IN_KIND/SERVICE).
 */

// ═══════════════════════════════════════════════════════════════
// 1) معايير الموردين حسب النوع  (مركزية — تُستورد من publicEval.js)
// ═══════════════════════════════════════════════════════════════

export const COMMON_SUPPLIER_CRITERIA = [
  { key: 'transparency',    label: 'الشفافية ومكافحة الفساد (عدم تقديم إكراميات)', max: 8,  critical: true  },
  { key: 'saudization',     label: 'نسبة السعودة وتوطين الوظائف',                max: 5,  critical: false },
  { key: 'sustainability',  label: 'الاستدامة والمسؤولية الاجتماعية',            max: 5,  critical: false },
  { key: 'financial_stab',  label: 'الاستقرار المالي وموثوقية المورد',           max: 5,  critical: false },
];

export const CORE_CRITERIA_BY_TYPE = {
  GOODS: [
    { key: 'product_quality', label: 'جودة المنتجات ومطابقة المواصفات',  max: 25, critical: true  },
    { key: 'delivery',        label: 'الالتزام بمواعيد التسليم',         max: 18, critical: false },
    { key: 'packaging',       label: 'التعبئة والتغليف والحفظ',          max: 10, critical: false },
    { key: 'pricing',         label: 'الأسعار والشروط التجارية',         max: 12, critical: false },
    { key: 'communication',   label: 'الاستجابة والتواصل',               max: 7,  critical: false },
    { key: 'after_sale',      label: 'خدمات ما بعد البيع والضمان',       max: 5,  critical: false },
  ],
  SERVICES: [
    { key: 'service_quality', label: 'جودة الخدمة المقدمة',              max: 22, critical: true  },
    { key: 'professionalism', label: 'الكفاءة والاحترافية للفريق',       max: 18, critical: false },
    { key: 'delivery',        label: 'الالتزام بالجدول الزمني',          max: 15, critical: false },
    { key: 'communication',   label: 'التواصل والاستجابة',               max: 12, critical: false },
    { key: 'pricing',         label: 'الأسعار والقيمة المقدمة',          max: 10, critical: false },
  ],
  CONSTRUCTION: [
    { key: 'spec_compliance', label: 'الالتزام بالمواصفات الفنية',       max: 14, critical: true  },
    { key: 'work_quality',    label: 'جودة التنفيذ والمعايير الهندسية',  max: 13, critical: true  },
    { key: 'schedule',        label: 'الالتزام بالجدول الزمني',          max: 12, critical: false },
    { key: 'hse_safety',      label: 'السلامة المهنية (HSE)',            max: 12, critical: true  },
    { key: 'workforce',       label: 'كفاءة العمالة والكوادر الفنية',    max: 8,  critical: false },
    { key: 'materials',       label: 'جودة المواد المستخدمة',            max: 8,  critical: false },
    { key: 'warranty',        label: 'فترة الضمان وما بعد التسليم',      max: 5,  critical: false },
    { key: 'permits',         label: 'الالتزام بالأنظمة والتراخيص',      max: 5,  critical: true  },
  ],
  IT_SERVICES: [
    { key: 'solution_quality', label: 'جودة الحل التقني',                max: 18, critical: true  },
    { key: 'sla_response',     label: 'الاستجابة والالتزام بـ SLA',       max: 15, critical: true  },
    { key: 'support',          label: 'الدعم الفني',                      max: 12, critical: false },
    { key: 'data_security',    label: 'أمن المعلومات وحماية البيانات',   max: 12, critical: true  },
    { key: 'compatibility',    label: 'التوافقية مع الأنظمة',             max: 8,  critical: false },
    { key: 'documentation',    label: 'التوثيق والتدريب',                 max: 7,  critical: false },
    { key: 'pricing',          label: 'الأسعار والقيمة',                  max: 5,  critical: false },
  ],
  TRANSPORT: [
    { key: 'safety',            label: 'سلامة النقل وحماية البضاعة',     max: 22, critical: true  },
    { key: 'delivery',          label: 'الالتزام بالمواعيد',              max: 22, critical: false },
    { key: 'vehicle_condition', label: 'حالة المركبات والمعدات',          max: 15, critical: false },
    { key: 'driver_conduct',    label: 'سلوك وكفاءة السائقين',            max: 10, critical: false },
    { key: 'communication',     label: 'التواصل والاستجابة',              max: 5,  critical: false },
    { key: 'pricing',           label: 'الأسعار والتنافسية',              max: 3,  critical: false },
  ],
  CONSULTING: [
    { key: 'output_quality',  label: 'جودة التقارير والمخرجات',          max: 22, critical: true  },
    { key: 'expertise',       label: 'الخبرة والكفاءة التخصصية',         max: 18, critical: true  },
    { key: 'delivery',        label: 'الالتزام بالجدول الزمني',          max: 15, critical: false },
    { key: 'communication',   label: 'التواصل والاستجابة',               max: 12, critical: false },
    { key: 'pricing',         label: 'الأسعار والقيمة المقابلة',         max: 10, critical: false },
  ],
  IN_KIND_DONOR: [
    { key: 'spec_conformity', label: 'مطابقة المواصفات المطلوبة',        max: 28, critical: true  },
    { key: 'product_quality', label: 'جودة المواد / البضائع',            max: 22, critical: true  },
    { key: 'delivery',        label: 'الالتزام بالمواعيد',               max: 15, critical: false },
    { key: 'compliance',      label: 'الامتثال (صلاحية - شهادات)',       max: 12, critical: true  },
  ],
  OTHER: [
    { key: 'quality',       label: 'جودة المنتج / الخدمة',               max: 22, critical: true  },
    { key: 'delivery',      label: 'الالتزام بالمواعيد',                 max: 18, critical: false },
    { key: 'communication', label: 'التواصل والاستجابة',                 max: 15, critical: false },
    { key: 'pricing',       label: 'الأسعار والشروط',                    max: 12, critical: false },
    { key: 'compliance',    label: 'الامتثال والوثائق',                  max: 10, critical: false },
  ],
};

export const SUPPLIER_TYPE_LABELS = {
  GOODS: 'بضائع ومنتجات',
  SERVICES: 'خدمات',
  CONSTRUCTION: 'مقاولات وبناء',
  IT_SERVICES: 'خدمات تقنية المعلومات',
  TRANSPORT: 'نقل وشحن',
  CONSULTING: 'استشارات',
  IN_KIND_DONOR: 'مورد تبرعات عينية',
  OTHER: 'أخرى',
};

export function getSupplierCriteria(supplierType) {
  const core = CORE_CRITERIA_BY_TYPE[supplierType] || CORE_CRITERIA_BY_TYPE.OTHER;
  return [...core, ...COMMON_SUPPLIER_CRITERIA];
}

// ═══════════════════════════════════════════════════════════════
// 2) قاموس القرار الموحّد (Approved / Conditional / Rejected)
// ═══════════════════════════════════════════════════════════════

export const DECISION = {
  APPROVED:      'معتمد',
  CONDITIONAL:   'معتمد مشروط',
  WATCH:         'قيد المراقبة',
  REJECTED:      'مرفوض',
  REJECTED_CRIT: 'مرفوض (فشل معيار حرج)',
};

export function grade(pct) {
  if (pct >= 90) return 'ممتاز';
  if (pct >= 80) return 'جيد جداً';
  if (pct >= 70) return 'جيد';
  if (pct >= 60) return 'مقبول';
  return 'ضعيف';
}

/**
 * قرار موحّد للتقييم الداخلي والعام.
 * فشل أي معيار حرج (<50% من حده) = رفض تلقائي بغض النظر عن النسبة الإجمالية.
 */
export function decision(pct, criticalFailed = false) {
  if (criticalFailed) return DECISION.REJECTED_CRIT;
  if (pct >= 85) return DECISION.APPROVED;
  if (pct >= 70) return DECISION.CONDITIONAL;
  if (pct >= 50) return DECISION.WATCH;
  return DECISION.REJECTED;
}

/**
 * يكشف إذا كان أي معيار حرج محسوم بأقل من 50% من حده الأقصى.
 * criteriaObj: { key: {max, score, critical} }
 */
export function hasCriticalFail(criteriaObj) {
  return Object.values(criteriaObj || {}).some(
    c => c.critical && Number(c.score) < (Number(c.max) * 0.5)
  );
}

/**
 * يحسب تقييم مورد كامل من إجابات خام + نوع المورد.
 * يُستخدم في:
 *   - POST /api/supplier-evals (تقييم داخلي)
 *   - POST /eval/:token         (تقييم خارجي)
 *
 * @param {Object} p
 * @param {string} p.supplierType — GOODS/SERVICES/...
 * @param {Object} p.answers      — { [key]: number, [key+'_note']: string }
 * @returns {Object} { criteriaJson, totalScore, maxScore, percentage, grade, decision, criticalFailed }
 */
export function computeSupplierEval({ supplierType, answers }) {
  const criteria = getSupplierCriteria(supplierType);
  let totalScore = 0, maxScore = 0;
  const criteriaObj = {};

  for (const c of criteria) {
    const raw = answers?.[c.key];
    const score = Math.min(c.max, Math.max(0, Number(raw) || 0));
    const note = String(answers?.[`${c.key}_note`] ?? '').trim().slice(0, 300) || null;
    totalScore += score;
    maxScore += c.max;
    criteriaObj[c.key] = {
      label: c.label,
      max: c.max,
      score,
      critical: !!c.critical,
      note,
    };
  }
  const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
  const criticalFailed = hasCriticalFail(criteriaObj);
  return {
    criteriaJson: JSON.stringify({ criteria: criteriaObj, criticalFailed }),
    totalScore,
    maxScore,
    percentage,
    grade:    grade(percentage),
    decision: decision(percentage, criticalFailed),
    criticalFailed,
  };
}

/**
 * يعيد حساب overallRating للمورد من كل تقييماته (weighted by recency).
 * الأحدث يأخذ وزناً أعلى (نصف حياة = 180 يوم).
 * هذا يحل التباين: كان الداخلي يستخدم متوسط حسابي، والعام يضع آخر قيمة.
 */
export async function recomputeSupplierRating(prisma, supplierId) {
  const evals = await prisma.supplierEval.findMany({
    where: { supplierId, deletedAt: null },
    select: { percentage: true, createdAt: true, decision: true },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  if (!evals.length) {
    await prisma.supplier.update({ where: { id: supplierId }, data: { overallRating: null } });
    return null;
  }

  // wieghted mean, half-life 180 days
  const now = Date.now();
  const halfLifeMs = 180 * 24 * 3600 * 1000;
  let sumW = 0, sumWX = 0;
  for (const e of evals) {
    const ageMs = now - new Date(e.createdAt).getTime();
    const w = Math.pow(0.5, ageMs / halfLifeMs);
    sumW += w;
    sumWX += w * Number(e.percentage || 0);
  }
  const overall = sumW ? +(sumWX / sumW).toFixed(2) : null;

  // لو أي تقييم "مرفوض (فشل معيار حرج)" خلال آخر 90 يوم → السقف 60
  const cutoff = new Date(now - 90 * 24 * 3600 * 1000);
  const recentCritFail = evals.some(
    e => e.decision === DECISION.REJECTED_CRIT && new Date(e.createdAt) > cutoff
  );
  const finalOverall = recentCritFail && overall > 60 ? 60 : overall;

  await prisma.supplier.update({
    where: { id: supplierId },
    data: { overallRating: finalOverall },
  });
  return finalOverall;
}

// ═══════════════════════════════════════════════════════════════
// 3) تقييم التبرعات — حسب النوع
// ═══════════════════════════════════════════════════════════════

/**
 * معايير التقييم تختلف جذرياً حسب نوع التبرع.
 * CASH    — اكتمال التوثيق، القيد المحاسبي، الغرض، الاعتماد
 * IN_KIND — السلامة، الصلاحية، مطابقة الاحتياج، الجودة
 * SERVICE — الكفاءة، التنفيذ، الاستفادة، التوثيق
 *
 * نعيد تخطيط حقول DonationEval الموجودة دلالياً حسب النوع:
 *   - `conformity` (boolean): معنى خاص بالنوع (انظر أسفل)
 *   - `expiryCheck` (boolean?): IN_KIND فقط (للباقي: null)
 *   - `quality` (1-5): جودة/اكتمال/تنفيذ
 *   - `usability` (1-5): استفادة/صلاحية الاستخدام/القيمة
 */
export const DONATION_EVAL_META = {
  CASH: {
    label: 'تبرع نقدي',
    conformityLabel: 'اكتمال التوثيق والقيد المحاسبي',
    qualityLabel:    'اكتمال المرفقات والمستندات (1-5)',
    usabilityLabel:  'وضوح الغرض والاعتماد (1-5)',
    expiryApplicable: false,
    hint: 'تأكد من: إيصال رسمي، قيد محاسبي، غرض موثّق، اعتماد من مدير الجودة.',
  },
  IN_KIND: {
    label: 'تبرع عيني',
    conformityLabel: 'مطابقة المواصفات والسلامة',
    qualityLabel:    'جودة الحالة والتعبئة (1-5)',
    usabilityLabel:  'مطابقة الاحتياج والجاهزية للتوزيع (1-5)',
    expiryApplicable: true,
    hint: 'تحقق من: الصلاحية، السلامة، سلامة التغليف، ملاءمة الاحتياج.',
  },
  SERVICE: {
    label: 'تبرع خدمي',
    conformityLabel: 'تسليم الخدمة بالكامل',
    qualityLabel:    'كفاءة التنفيذ (1-5)',
    usabilityLabel:  'مستوى الاستفادة والقيمة (1-5)',
    expiryApplicable: false,
    hint: 'تأكد من: اكتمال التنفيذ، توثيق الاستفادة، رضا المستفيدين.',
  },
};

export function computeDonationEval(donationType, input) {
  const meta = DONATION_EVAL_META[donationType] || DONATION_EVAL_META.IN_KIND;

  const q = Number(input.quality);
  const u = Number(input.usability);
  if (!Number.isFinite(q) || q < 1 || q > 5) throw new Error(`"${meta.qualityLabel}" يجب أن يكون 1-5`);
  if (!Number.isFinite(u) || u < 1 || u > 5) throw new Error(`"${meta.usabilityLabel}" يجب أن يكون 1-5`);

  const conformity = input.conformity === true || input.conformity === 'true';
  // expiryCheck: للعيني فقط إلزامي. للنوعين الآخرين يُتجاهل (null).
  let expiryCheck = null;
  if (meta.expiryApplicable) {
    if (input.expiryCheck == null || input.expiryCheck === '') {
      throw new Error('فحص الصلاحية إلزامي للتبرع العيني');
    }
    expiryCheck = input.expiryCheck === true || input.expiryCheck === 'true';
  }

  const score = +((q + u) / 2).toFixed(2);

  // قرار خاص بالنوع
  let decisionText;
  if (!conformity) {
    decisionText = donationType === 'CASH'
      ? 'رفض — توثيق ناقص أو قيد محاسبي غير مكتمل'
      : donationType === 'SERVICE'
        ? 'رفض — الخدمة لم تُسلَّم أو غير مكتملة'
        : 'رفض — غير مطابق للمواصفات';
  } else if (meta.expiryApplicable && expiryCheck === false) {
    decisionText = 'رفض — فشل فحص الصلاحية';
  } else if (score >= 4) {
    decisionText = 'قبول';
  } else if (score >= 3) {
    decisionText = 'قبول مشروط';
  } else {
    decisionText = donationType === 'CASH'
      ? 'رفض — جودة التوثيق غير كافية'
      : donationType === 'SERVICE'
        ? 'رفض — جودة التنفيذ غير كافية'
        : 'رفض — جودة غير كافية';
  }

  return {
    quality: q,
    usability: u,
    conformity,
    expiryCheck,
    score,
    decision: decisionText,
    // محتوى دلالي مُشرَّح (لعرض الواجهة)
    evalMeta: {
      donationType,
      conformityLabel: meta.conformityLabel,
      qualityLabel:    meta.qualityLabel,
      usabilityLabel:  meta.usabilityLabel,
    },
  };
}
