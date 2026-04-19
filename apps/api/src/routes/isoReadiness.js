import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAction } from '../lib/permissions.js';

const router = Router();

/**
 * GET /api/iso-readiness
 * Returns completion status per ISO 9001:2015 clause
 */
router.get('/', requireAction('iso-readiness', 'read'), asyncHandler(async (req, res) => {
  const [
    swotCount, ipCount, processCount,
    policyActive,
    strategicCount, objCount, riskCount,
    ncrOpen, ncrClosed,
    auditPlanned, auditCompleted,
    complaintsResolved, complaintsOpen,
    supplierApproved, supplierTotal,
    docPublished, docTotal,
    trainingCount,
    competenceCount, commCount,
    reviewCount, reviewCompleted,
    beneficiaries, donations,
  ] = await Promise.all([
    prisma.swotItem.count({ where: { status: 'ACTIVE' } }),
    prisma.interestedParty.count({ where: { status: 'ACTIVE' } }),
    prisma.process.count({ where: { status: 'ACTIVE' } }),
    prisma.qualityPolicy.count({ where: { active: true } }),
    prisma.strategicGoal.count(),
    prisma.objective.count(),
    prisma.risk.count(),
    prisma.nCR.count({ where: { status: 'OPEN' } }),
    prisma.nCR.count({ where: { status: 'CLOSED' } }),
    prisma.audit.count({ where: { status: 'PLANNED' } }),
    prisma.audit.count({ where: { status: 'COMPLETED' } }),
    prisma.complaint.count({ where: { status: { in: ['RESOLVED', 'CLOSED'] } } }),
    prisma.complaint.count({ where: { status: { in: ['NEW', 'UNDER_REVIEW', 'IN_PROGRESS'] } } }),
    prisma.supplier.count({ where: { status: 'APPROVED' } }),
    prisma.supplier.count(),
    prisma.document.count({ where: { status: 'PUBLISHED' } }),
    prisma.document.count(),
    prisma.training.count(),
    prisma.competenceRequirement.count({ where: { status: 'ACTIVE' } }),
    prisma.communicationPlan.count({ where: { status: 'ACTIVE' } }),
    prisma.managementReview.count(),
    prisma.managementReview.count({ where: { status: 'COMPLETED' } }),
    prisma.beneficiary.count(),
    prisma.donation.count(),
  ]);

  const scoreItem = (has, weight = 1) => (has ? weight : 0);

  const clauses = [
    {
      clause: '4.1', title: 'فهم سياق المنظمة', weight: 5,
      score: scoreItem(swotCount > 0, 5),
      evidence: `${swotCount} بنود SWOT`,
      required: 'تحليل SWOT', ok: swotCount >= 4,
    },
    {
      clause: '4.2', title: 'الأطراف ذات العلاقة', weight: 5,
      score: scoreItem(ipCount > 0, 5),
      evidence: `${ipCount} طرف مسجل`,
      required: 'تحديد الأطراف واحتياجاتهم', ok: ipCount >= 4,
    },
    {
      clause: '4.4', title: 'خريطة العمليات', weight: 5,
      score: scoreItem(processCount >= 3, 5),
      evidence: `${processCount} عملية`,
      required: 'على الأقل 3 عمليات موثقة', ok: processCount >= 3,
    },
    {
      clause: '5.2', title: 'سياسة الجودة', weight: 8,
      score: scoreItem(policyActive > 0, 8),
      evidence: policyActive ? 'سياسة معتمدة ومفعّلة' : 'غير موجودة',
      required: 'سياسة معتمدة ومفعّلة', ok: policyActive > 0,
    },
    {
      clause: '6.1', title: 'مخاطر وفرص', weight: 7,
      score: scoreItem(riskCount >= 5, 7),
      evidence: `${riskCount} مخاطر/فرص`,
      required: 'سجل مخاطر فعال', ok: riskCount >= 5,
    },
    {
      clause: '6.2', title: 'أهداف الجودة', weight: 7,
      score: scoreItem(objCount >= 3, 7),
      evidence: `${objCount} هدف`,
      required: 'أهداف قابلة للقياس', ok: objCount >= 3,
    },
    {
      clause: '6.2+', title: 'خطة استراتيجية', weight: 5,
      score: scoreItem(strategicCount >= 3, 5),
      evidence: `${strategicCount} هدف استراتيجي`,
      required: 'خطة استراتيجية موثقة', ok: strategicCount >= 3,
    },
    {
      clause: '7.2', title: 'الكفاءة', weight: 5,
      score: scoreItem(competenceCount >= 3, 5),
      evidence: `${competenceCount} متطلب كفاءة، ${trainingCount} تدريب`,
      required: 'مصفوفة كفاءات + تدريبات', ok: competenceCount >= 3,
    },
    {
      clause: '7.4', title: 'التواصل', weight: 4,
      score: scoreItem(commCount >= 3, 4),
      evidence: `${commCount} خطة اتصال`,
      required: 'خطة اتصال موثقة', ok: commCount >= 3,
    },
    {
      clause: '7.5', title: 'المعلومات الموثقة', weight: 6,
      score: scoreItem(docPublished >= 5, 6),
      evidence: `${docPublished}/${docTotal} وثيقة منشورة`,
      required: 'وثائق الجودة الأساسية', ok: docPublished >= 5,
    },
    {
      clause: '8.4', title: 'ضبط الموردين', weight: 5,
      score: scoreItem(supplierApproved >= 1, 5),
      evidence: `${supplierApproved}/${supplierTotal} معتمد`,
      required: 'موردون مقيمون ومعتمدون', ok: supplierApproved >= 1,
    },
    {
      clause: '9.1.2', title: 'رضا المستفيدين', weight: 5,
      score: scoreItem(complaintsResolved > complaintsOpen, 5),
      evidence: `${complaintsResolved} تم حل / ${complaintsOpen} مفتوح`,
      required: 'معدل حل جيد للشكاوى', ok: complaintsResolved > complaintsOpen,
    },
    {
      clause: '9.2', title: 'التدقيق الداخلي', weight: 8,
      score: scoreItem(auditCompleted >= 1, 8),
      evidence: `مخطط: ${auditPlanned}، مكتمل: ${auditCompleted}`,
      required: 'تدقيق داخلي واحد على الأقل', ok: auditCompleted >= 1,
    },
    {
      clause: '9.3', title: 'مراجعة الإدارة', weight: 10,
      score: scoreItem(reviewCompleted >= 1, 10),
      evidence: `${reviewCompleted}/${reviewCount} مراجعة مكتملة`,
      required: 'مراجعة إدارية واحدة على الأقل', ok: reviewCompleted >= 1,
    },
    {
      clause: '10.2', title: 'عدم المطابقة والإجراءات التصحيحية', weight: 8,
      score: scoreItem(ncrClosed >= ncrOpen, 8),
      evidence: `مفتوح: ${ncrOpen}، مغلق: ${ncrClosed}`,
      required: 'NCRs تعالج وتغلق', ok: ncrClosed >= ncrOpen,
    },
  ];

  const totalWeight = clauses.reduce((s, c) => s + c.weight, 0);
  const totalScore  = clauses.reduce((s, c) => s + c.score, 0);
  const percentage  = Math.round((totalScore / totalWeight) * 100);

  const level =
    percentage >= 90 ? 'جاهز للاعتماد ✅' :
    percentage >= 75 ? 'جاهز تقريباً — مراجعة نهائية 🟡' :
    percentage >= 50 ? 'قيد التطوير 🟠' :
    'تحت التأسيس 🔴';

  res.json({
    ok: true,
    percentage,
    level,
    totalScore,
    totalWeight,
    clauses,
    stats: {
      strategicGoals: strategicCount,
      objectives: objCount,
      risks: riskCount,
      beneficiaries,
      donations,
    },
  });
}));

export default router;
