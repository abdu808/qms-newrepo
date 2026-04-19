import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { activeWhere } from '../lib/dataHelpers.js';

const router = Router();

const OVERDUE_DAYS    = 14;   // الشكاوى والNCR المتأخرة
const EXPIRY_WARN_DAYS = 30;  // الوثائق التي تنتهي صلاحية مراجعتها قريباً

router.get('/', asyncHandler(async (req, res) => {
  const now          = new Date();
  const overdueDate  = new Date(now.getTime() - OVERDUE_DAYS * 86400000);
  const expiryDate   = new Date(now.getTime() + EXPIRY_WARN_DAYS * 86400000);
  const threeMonths  = new Date(now.getTime() - 90 * 86400000);

  const OPEN_COMPLAINT = ['NEW', 'UNDER_REVIEW', 'IN_PROGRESS'];
  const OPEN_NCR       = ['OPEN', 'ROOT_CAUSE', 'ACTION_PLANNED', 'IN_PROGRESS', 'VERIFICATION'];

  const [
    // Objectives
    objTotal, objAchieved, objInProgress, objDelayed,
    // Risks
    risksByLevel,
    overdueNcr,
    // NCR
    ncrOpen, ncrClosed,
    // Complaints
    cmpOpen, cmpOverdue, cmpTotal,
    // Audits
    auditsPlanned, auditsDone,
    // Suppliers
    supplierTotal, supplierApproved, supplierPending,
    // Beneficiaries & Programs
    beneficiaries,
    // Documents
    docsPublished, docsExpiring,
    // Users
    usersActive,
    // Surveys
    surveyResponses,
    // Recent activity
    recentActivity,
    // Next review
    nextReview,
    // Training (last 90 days)
    recentTrainings,
  ] = await Promise.all([
    // Objectives — activeWhere يستبعد المحذوفة منطقياً
    prisma.objective.count({ where: activeWhere() }),
    prisma.objective.count({ where: activeWhere({ status: 'ACHIEVED' }) }),
    prisma.objective.count({ where: activeWhere({ status: 'IN_PROGRESS' }) }),
    prisma.objective.count({ where: activeWhere({ status: 'DELAYED' }) }),

    // Risks by level (غير المغلقة)
    prisma.risk.groupBy({
      by: ['level'],
      _count: { _all: true },
      where: activeWhere({ status: { not: 'CLOSED' } }),
    }),

    // NCR متأخر (dueDate فات ولم يُغلق)
    prisma.nCR.count({
      where: activeWhere({ status: { in: OPEN_NCR }, dueDate: { lt: now, not: null } }),
    }),

    // NCR
    prisma.nCR.count({ where: activeWhere({ status: { in: OPEN_NCR } }) }),
    prisma.nCR.count({ where: activeWhere({ status: 'CLOSED' }) }),

    // Complaints
    prisma.complaint.count({ where: activeWhere({ status: { in: OPEN_COMPLAINT } }) }),
    prisma.complaint.count({ where: activeWhere({ status: { in: OPEN_COMPLAINT }, receivedAt: { lte: overdueDate } }) }),
    prisma.complaint.count({ where: activeWhere() }),

    // Audits
    prisma.audit.count({ where: activeWhere({ status: 'PLANNED' }) }),
    prisma.audit.count({ where: activeWhere({ status: 'COMPLETED' }) }),

    // Suppliers
    prisma.supplier.count({ where: activeWhere() }),
    prisma.supplier.count({ where: activeWhere({ status: 'APPROVED' }) }),
    prisma.supplier.count({ where: activeWhere({ status: 'PENDING' }) }),

    // Beneficiaries
    prisma.beneficiary.count({ where: activeWhere({ status: 'ACTIVE' }) }),

    // Documents
    prisma.document.count({ where: activeWhere({ status: 'PUBLISHED' }) }),
    prisma.document.findMany({
      where: activeWhere({ status: 'PUBLISHED', reviewDate: { gte: now, lte: expiryDate } }),
      select: { id: true, code: true, title: true, reviewDate: true },
      orderBy: { reviewDate: 'asc' },
      take: 10,
    }),

    // Active users
    prisma.user.count({ where: { active: true } }),

    // Survey responses (total) — استبعاد الاستبيانات المحذوفة منطقياً
    prisma.survey.aggregate({ where: activeWhere(), _sum: { responses: true }, _avg: { avgScore: true } }),

    // Recent audit log (last 10)
    prisma.auditLog.findMany({
      take: 10,
      orderBy: { at: 'desc' },
      include: { user: { select: { name: true } } },
    }),

    // Next planned management review
    prisma.managementReview.findFirst({
      where: { status: 'PLANNED', meetingDate: { gte: now } },
      orderBy: { meetingDate: 'asc' },
      select: { title: true, meetingDate: true, period: true },
    }),

    // Recent trainings (last 90 days)
    prisma.training.count({ where: { date: { gte: threeMonths } } }),
  ]);

  // حوّل risksByLevel لخريطة
  const riskMap = { حرج: 0, مرتفع: 0, متوسط: 0, منخفض: 0 };
  for (const r of risksByLevel) riskMap[r.level] = (riskMap[r.level] || 0) + r._count._all;

  // قائمة التنبيهات
  const alerts = [];
  if (cmpOverdue > 0)
    alerts.push({ type: 'danger', icon: '📢', msg: `${cmpOverdue} شكوى مفتوحة تجاوزت ${OVERDUE_DAYS} يوماً بدون معالجة` });
  if (overdueNcr > 0)
    alerts.push({ type: 'danger', icon: '🔧', msg: `${overdueNcr} عدم مطابقة تجاوزت تاريخ المعالجة المحدد` });
  if (docsExpiring.length > 0)
    alerts.push({ type: 'warn', icon: '📄', msg: `${docsExpiring.length} وثيقة منشورة تستحق المراجعة خلال ${EXPIRY_WARN_DAYS} يوماً` });
  if (riskMap['حرج'] > 0)
    alerts.push({ type: 'danger', icon: '⚠️', msg: `${riskMap['حرج']} مخاطر حرجة نشطة تستوجب تدخلاً فورياً` });
  if (supplierPending > 0)
    alerts.push({ type: 'warn', icon: '🏭', msg: `${supplierPending} مورد في انتظار الاعتماد` });

  res.json({
    ok: true,
    alerts,
    kpis: {
      objectives: {
        total: objTotal,
        achieved: objAchieved,
        inProgress: objInProgress,
        delayed: objDelayed,
        achievementRate: objTotal ? Math.round((objAchieved / objTotal) * 100) : 0,
      },
      risks: {
        byCriticality: riskMap,
        totalActive: Object.values(riskMap).reduce((a, b) => a + b, 0),
      },
      ncr: { open: ncrOpen, closed: ncrClosed, overdue: overdueNcr },
      complaints: {
        open: cmpOpen,
        overdue: cmpOverdue,
        total: cmpTotal,
        resolutionRate: cmpTotal ? Math.round(((cmpTotal - cmpOpen) / cmpTotal) * 100) : 0,
      },
      audits: { planned: auditsPlanned, completed: auditsDone },
      suppliers: { total: supplierTotal, approved: supplierApproved, pending: supplierPending },
      beneficiaries: { active: beneficiaries },
      documents: { published: docsPublished, expiringCount: docsExpiring.length },
      users: { active: usersActive },
      surveys: {
        totalResponses: surveyResponses._sum.responses || 0,
        avgScore: surveyResponses._avg.avgScore
          ? Math.round(surveyResponses._avg.avgScore * 10) / 10
          : null,
      },
      training: { recent90Days: recentTrainings },
    },
    expiringDocs: docsExpiring,
    nextReview,
    recentActivity: recentActivity.map(a => ({
      id: a.id,
      at: a.at,
      action: a.action,
      entityType: a.entityType,
      entityId: a.entityId,
      userName: a.user?.name || 'النظام',
    })),
    generatedAt: now.toISOString(),
  });
}));

export default router;
