/**
 * services/supplierEval.js — منطق تقييم المورّدين (ISO 8.4)
 *
 * يستخرج `buildSupplierEvalPayload()` من `routes/supplierEvals.js::beforeCreate`
 * ليصبح المنطق قابل لإعادة الاستخدام في:
 *   - المسار الداخلي (route CRUD)
 *   - أي wizards مستقبلية
 *   - اختبارات الوحدة (بلا Express/req/res)
 *
 * يعتمد على `lib/evalEngine.js` للحساب الفعلي (محرك موحّد).
 */
import { BadRequest, NotFound } from '../utils/errors.js';
import { computeSupplierEval, grade, decision, hasCriticalFail } from '../lib/evalEngine.js';

const ALLOWED_RECOMMENDATIONS = ['approved', 'conditional', 'rejected', 'watch'];

/**
 * يحوّل payload الواجهة (answers | totalScore+maxScore) إلى سجل جاهز للحفظ.
 *
 * @param {Object} input
 * @param {Object} input.data              — req.body (بعد Zod)
 * @param {string} input.supplierType      — نوع المورّد (GOODS/SERVICE/PARTNER/...)
 * @param {string} input.evaluatorId       — معرّف المقيّم (من JWT)
 * @returns {Object} out — السجل الجاهز لـ prisma.supplierEval.create
 */
export function buildSupplierEvalPayload({ data, supplierType, evaluatorId }) {
  if (!data?.supplierId) throw BadRequest('supplierId مطلوب');

  // 1) الحساب: إما من answers (المحرّك الموحّد) أو من totalScore/maxScore (قديم)
  let computed;
  if (data.answers && typeof data.answers === 'object') {
    computed = computeSupplierEval({ supplierType, answers: data.answers });
  } else {
    const total = Number(data.totalScore) || 0;
    const max   = Number(data.maxScore)   || 100;
    const pct   = max > 0 ? Math.round((total / max) * 100) : 0;

    let criticalFailed = false;
    try {
      if (data.criteriaJson) {
        const parsed = JSON.parse(data.criteriaJson);
        criticalFailed = hasCriticalFail(parsed.criteria || parsed);
      }
    } catch { /* ignore malformed criteriaJson */ }

    computed = {
      totalScore: total,
      maxScore: max,
      percentage: pct,
      grade: grade(pct),
      decision: decision(pct, criticalFailed),
      criticalFailed,
      criteriaJson: data.criteriaJson || null,
    };
  }

  // 2) حقن توصية المقيّم في criteriaJson (إن كانت صالحة)
  let criteriaJson = computed.criteriaJson;
  const userRec = String(data.recommendation || '').trim();
  if (ALLOWED_RECOMMENDATIONS.includes(userRec) && criteriaJson) {
    try {
      const parsed = JSON.parse(criteriaJson);
      parsed.recommendation = userRec;
      criteriaJson = JSON.stringify(parsed);
    } catch { /* keep original */ }
  }

  // 3) تنظيف الحقول التي لا تُحفظ كما هي
  return {
    ...data,
    answers: undefined,       // لا نحفظ raw answers
    recommendation: undefined, // محفوظة داخل criteriaJson
    totalScore: computed.totalScore,
    maxScore:   computed.maxScore,
    percentage: computed.percentage,
    grade:      computed.grade,
    decision:   computed.decision,
    criteriaJson,
    evaluatorId,
  };
}

/**
 * Wrapper يحمّل نوع المورّد من DB ثم يبني payload.
 * يستخدمها `routes/supplierEvals.js::beforeCreate` لتوحيد الاستدعاء.
 */
export async function prepareSupplierEval({ prisma, data, evaluatorId }) {
  const supplier = await prisma.supplier.findUnique({
    where:  { id: data.supplierId },
    select: { type: true },
  });
  if (!supplier) throw NotFound('المورّد غير موجود');
  return buildSupplierEvalPayload({
    data,
    supplierType: supplier.type,
    evaluatorId,
  });
}
