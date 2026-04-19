/**
 * routes/myWork.js — Batch 16 + UX-1 (role-based views)
 * لوحة "مهامي" — تتكيف محتوياتها حسب دور المستخدم:
 *   - EMPLOYEE      → مهامي الشخصية فقط
 *   - DEPT_MANAGER  → مهامي + ما يخص فريق قسمي
 *   - QUALITY_*     → نظرة جودة شاملة (انحرافات + workflow + SLA + data health)
 *   - SUPER_ADMIN   → كل ما سبق + ملخص تنفيذي
 *
 *   GET /api/my-work  → {
 *     viewMode, role, user,
 *     kpi, ncr, complaints, workflow, beneficiaries,
 *     dept?:       { users:[], ncrAssigned:[], complaintsAssigned:[], kpiPending:[] },
 *     exec?:       { objectives, risks, complaints, ncrs, documents, mgmtReview },
 *     dataHealth:  { criticalCount, highCount },
 *     alerts:      [ {type, severity, count, action} ],
 *     summary:     { totalActions }
 *   }
 */
import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { activeWhere } from '../lib/dataHelpers.js';
import { computeComplaintSla } from '../lib/sla.js';
import { needsReview as beneficiaryNeedsReview } from '../lib/beneficiaryAssessment.js';

const router = Router();

const NCR_OPEN   = ['OPEN', 'ROOT_CAUSE', 'ACTION_PLANNED', 'IN_PROGRESS', 'VERIFICATION'];
const COMPL_OPEN = ['NEW', 'UNDER_REVIEW', 'IN_PROGRESS'];

function viewModeOf(role) {
  if (role === 'SUPER_ADMIN')                                return 'EXEC';
  if (role === 'QUALITY_MANAGER' || role === 'COMMITTEE_MEMBER') return 'QUALITY';
  if (role === 'DEPT_MANAGER')                               return 'DEPT';
  return 'EMPLOYEE';
}

router.get('/', asyncHandler(async (req, res) => {
  const userId   = req.user.sub;
  const role     = req.user.role;
  const viewMode = viewModeOf(role);
  const privileged = viewMode === 'QUALITY' || viewMode === 'EXEC';

  // ═══ 1) KPI الشخصية ═══
  let kpiSummary = null;
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  try {
    const ownedObjectives = await prisma.objective.findMany({
      where: activeWhere({ ownerId: userId, status: { notIn: ['CANCELLED', 'ACHIEVED'] } }),
      select: {
        id: true,
        kpiEntries: { where: { year, month }, select: { id: true } },
      },
    });
    const entered = ownedObjectives.filter(o => o.kpiEntries.length > 0).length;
    const pending = ownedObjectives.length - entered;
    kpiSummary = { total: ownedObjectives.length, pending, entered, month, year };
  } catch { kpiSummary = null; }

  // ═══ 2) NCR — مسندة لي + (privileged) بانتظار مراجعة/اعتماد ═══
  const [ncrAssigned, ncrPendingReview, ncrPendingApproval] = await Promise.all([
    prisma.nCR.findMany({
      where: activeWhere({ assigneeId: userId, status: { in: NCR_OPEN } }),
      select: { id: true, code: true, title: true, severity: true, status: true, dueDate: true },
      take: 20,
    }),
    privileged ? prisma.nCR.findMany({
      where: activeWhere({ workflowState: 'SUBMITTED' }),
      select: { id: true, code: true, title: true, submittedAt: true },
      take: 20,
    }) : [],
    privileged ? prisma.nCR.findMany({
      where: activeWhere({ workflowState: 'UNDER_REVIEW' }),
      select: { id: true, code: true, title: true, reviewedAt: true },
      take: 20,
    }) : [],
  ]);

  // ═══ 3) الشكاوى — مسندة لي + (privileged) المتجاوزة ═══
  const [compAssigned, compAll] = await Promise.all([
    prisma.complaint.findMany({
      where: activeWhere({ assigneeId: userId, status: { in: COMPL_OPEN } }),
      select: { id: true, code: true, subject: true, severity: true, status: true,
                receivedAt: true, assigneeId: true, resolvedAt: true, updatedAt: true, createdAt: true },
      take: 20,
    }),
    privileged
      ? prisma.complaint.findMany({
          where: activeWhere({ status: { in: COMPL_OPEN } }),
          select: { id: true, code: true, subject: true, severity: true, status: true,
                    receivedAt: true, assigneeId: true, resolvedAt: true, updatedAt: true, createdAt: true },
          orderBy: { receivedAt: 'desc' },
          take: 200, // cap to keep latency bounded — SLA breach filter happens in-memory
        })
      : [],
  ]);
  const compBreached = compAll
    .map(c => ({ ...c, sla: computeComplaintSla(c) }))
    .filter(c => c.sla.overall === 'BREACHED');

  // ═══ 4) Workflow pending (privileged) ═══
  const [risksPendingReview, supplierEvalsPendingReview] = await Promise.all([
    privileged ? prisma.risk.findMany({
      where: activeWhere({ workflowState: { in: ['SUBMITTED', 'UNDER_REVIEW'] } }),
      select: { id: true, code: true, title: true, workflowState: true, submittedAt: true },
      take: 20,
    }) : [],
    privileged ? prisma.supplierEval.findMany({
      where: activeWhere({ workflowState: { in: ['SUBMITTED', 'UNDER_REVIEW'] } }),
      select: {
        id: true, code: true, workflowState: true, submittedAt: true,
        supplier: { select: { name: true, code: true } },
      },
      take: 20,
    }) : [],
  ]);

  // ═══ 4b) Pending Acks — توكنات إقرار شخصية مرسَلة لي (ISO 7.5.3.2(c)) ═══
  let pendingAcks = [];
  try {
    pendingAcks = await prisma.ackToken.findMany({
      where: {
        userId,
        usedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      select: {
        id: true, token: true, documentVersion: true, expiresAt: true, sentAt: true,
        document: { select: { id: true, code: true, title: true, category: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  } catch { pendingAcks = []; }

  // ═══ 4c) مسوّداتي — NCR + Risk + Document حيث أنا المنشئ وفي حالة DRAFT ═══
  let myDrafts = { ncr: [], risks: [], documents: [], total: 0 };
  try {
    const [ncrDrafts, riskDrafts, docDrafts] = await Promise.all([
      prisma.nCR.findMany({
        where: activeWhere({ reporterId: userId, workflowState: 'DRAFT' }),
        select: { id: true, code: true, title: true, severity: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
        take: 10,
      }),
      prisma.risk.findMany({
        where: activeWhere({ createdById: userId, workflowState: 'DRAFT' }),
        select: { id: true, code: true, title: true, level: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
        take: 10,
      }),
      prisma.document.findMany({
        where: activeWhere({ createdById: userId, status: 'DRAFT' }),
        select: { id: true, code: true, title: true, category: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
        take: 10,
      }),
    ]);
    myDrafts = {
      ncr: ncrDrafts,
      risks: riskDrafts,
      documents: docDrafts,
      total: ncrDrafts.length + riskDrafts.length + docDrafts.length,
    };
  } catch { /* non-fatal */ }

  // ═══ 5) إعادة تقييم مستفيدين (privileged) ═══
  let beneficiariesDueReview = [];
  if (privileged) {
    try {
      const actives = await prisma.beneficiary.findMany({
        where: activeWhere({ status: 'ACTIVE' }),
        select: { id: true, code: true, fullName: true, assessedAt: true },
        orderBy: { assessedAt: 'asc' }, // الأقدم أولاً يتصدّر قائمة الحاجة للمراجعة
        take: 500, // سقف للأداء — الفلتر بعده في الذاكرة
      });
      beneficiariesDueReview = actives.filter(b => beneficiaryNeedsReview(b)).slice(0, 20);
    } catch { /* non-fatal */ }
  }

  // ═══ 6) نطاق القسم (DEPT_MANAGER فقط) ═══
  let deptBlock = null;
  if (viewMode === 'DEPT') {
    try {
      const me = await prisma.user.findUnique({
        where: { id: userId },
        select: { departmentId: true, department: { select: { id: true, name: true, code: true } } },
      });
      if (me?.departmentId) {
        const teamUsers = await prisma.user.findMany({
          where: { departmentId: me.departmentId, active: true },
          select: { id: true, name: true, email: true, jobTitle: true },
        });
        const teamIds = teamUsers.map(u => u.id);

        const [dNcr, dComp, dObjectives] = await Promise.all([
          prisma.nCR.findMany({
            where: activeWhere({ assigneeId: { in: teamIds }, status: { in: NCR_OPEN } }),
            select: { id: true, code: true, title: true, severity: true, status: true, dueDate: true, assigneeId: true },
            take: 30,
          }),
          prisma.complaint.findMany({
            where: activeWhere({ assigneeId: { in: teamIds }, status: { in: COMPL_OPEN } }),
            select: { id: true, code: true, subject: true, severity: true, status: true,
                      receivedAt: true, assigneeId: true, resolvedAt: true, updatedAt: true, createdAt: true },
            take: 30,
          }),
          prisma.objective.findMany({
            where: activeWhere({ ownerId: { in: teamIds }, status: { notIn: ['CANCELLED', 'ACHIEVED'] } }),
            select: {
              id: true, code: true, title: true, ownerId: true,
              kpiEntries: { where: { year, month }, select: { id: true } },
            },
          }),
        ]);
        const kpiPending = dObjectives
          .filter(o => o.kpiEntries.length === 0)
          .map(o => ({ id: o.id, code: o.code, title: o.title, ownerId: o.ownerId }));
        const compWithSla = dComp.map(c => ({ ...c, sla: computeComplaintSla(c) }));

        deptBlock = {
          department: me.department,
          teamSize: teamUsers.length,
          ncrAssigned: dNcr,
          complaintsAssigned: compWithSla.map(c => ({
            id: c.id, code: c.code, subject: c.subject, severity: c.severity, status: c.status,
            assigneeId: c.assigneeId, ageDays: c.sla.ageDays, overall: c.sla.overall,
          })),
          kpiPending,
          kpiPendingCount: kpiPending.length,
        };
      }
    } catch { /* non-fatal */ }
  }

  // ═══ 6b) أهداف/أنشطة منخفضة progress — تنبيه proactive ═══
  //   - للموظف: أهدافه الشخصية بـ progress < 50
  //   - للمدير/الجودة/التنفيذ: كل أهداف/أنشطة المؤسّسة بـ progress < 50
  //   نعرض بطاقة action "راجع الأسباب" (تشير إلى الصفحة المناسبة).
  let atRisk = { objectives: [], activities: [], total: 0 };
  try {
    const objScope = privileged
      ? activeWhere({ status: { notIn: ['CANCELLED', 'ACHIEVED'] }, progress: { lt: 50 } })
      : activeWhere({ ownerId: userId, status: { notIn: ['CANCELLED', 'ACHIEVED'] }, progress: { lt: 50 } });
    const actScope = privileged
      ? activeWhere({ status: { not: 'CANCELLED' }, progress: { lt: 50 } })
      : null;
    const [atRiskObj, atRiskAct] = await Promise.all([
      prisma.objective.findMany({
        where: objScope,
        select: { id: true, code: true, title: true, progress: true, ownerId: true },
        orderBy: { progress: 'asc' },
        take: 20,
      }),
      actScope ? prisma.operationalActivity.findMany({
        where: actScope,
        select: { id: true, code: true, title: true, progress: true, responsible: true },
        orderBy: { progress: 'asc' },
        take: 20,
      }) : [],
    ]);
    atRisk = {
      objectives: atRiskObj,
      activities: atRiskAct,
      total: atRiskObj.length + atRiskAct.length,
    };
  } catch { atRisk = { objectives: [], activities: [], total: 0 }; }

  // ═══ 7) ملخص تنفيذي (SUPER_ADMIN فقط) ═══
  let execBlock = null;
  if (viewMode === 'EXEC') {
    try {
      const [objectives, risks, complaintsAll, ncrsAll, documents, mgmtReview] = await Promise.all([
        prisma.objective.groupBy({
          by: ['status'], _count: { id: true }, where: activeWhere({}),
        }),
        prisma.risk.groupBy({
          by: ['level'], _count: { id: true }, where: activeWhere({ status: { not: 'CLOSED' } }),
        }),
        prisma.complaint.groupBy({
          by: ['status'], _count: { id: true }, where: activeWhere({}),
        }),
        prisma.nCR.groupBy({
          by: ['severity'], _count: { id: true }, where: activeWhere({ status: { in: NCR_OPEN } }),
        }),
        prisma.document.count({ where: activeWhere({ status: 'PUBLISHED' }) }).catch(() => 0),
        prisma.managementReview.findFirst({
          where: activeWhere({}),
          orderBy: { meetingDate: 'desc' },
          select: { id: true, meetingDate: true, status: true },
        }).catch(() => null),
      ]);

      const objByStatus = Object.fromEntries(objectives.map(r => [r.status, r._count.id]));
      const riskByLvl   = Object.fromEntries(risks.map(r => [r.level, r._count.id]));
      const compByStat  = Object.fromEntries(complaintsAll.map(r => [r.status, r._count.id]));
      const ncrBySev    = Object.fromEntries(ncrsAll.map(r => [r.severity, r._count.id]));

      execBlock = {
        objectives: {
          total: Object.values(objByStatus).reduce((a, b) => a + b, 0),
          byStatus: objByStatus,
        },
        risks: {
          critical: (riskByLvl['حرج'] || 0) + (riskByLvl['مرتفع'] || 0),
          byLevel: riskByLvl,
        },
        complaints: {
          open: (compByStat['NEW'] || 0) + (compByStat['UNDER_REVIEW'] || 0) + (compByStat['IN_PROGRESS'] || 0),
          byStatus: compByStat,
        },
        ncrs: {
          open: Object.values(ncrBySev).reduce((a, b) => a + b, 0),
          bySeverity: ncrBySev,
        },
        documents: { published: documents },
        mgmtReview,
      };
    } catch { /* non-fatal */ }
  }

  // ═══ 8) Data Health (ملخص) — privileged ═══
  let dataHealth = null;
  if (privileged) {
    try {
      // lightweight: نعتمد على الموجود في beneficiariesDueReview + compBreached + ncrs as proxy
      dataHealth = {
        criticalCount: compBreached.length,
        highCount: beneficiariesDueReview.length,
      };
    } catch { dataHealth = null; }
  }

  // ═══ 9) إجمالي المهام ═══
  const totalActions =
    (kpiSummary?.pending || 0) +
    ncrAssigned.length +
    (privileged ? ncrPendingReview.length + ncrPendingApproval.length : 0) +
    compAssigned.length +
    (privileged ? compBreached.length : 0) +
    (privileged ? risksPendingReview.length + supplierEvalsPendingReview.length : 0) +
    (privileged ? beneficiariesDueReview.length : 0) +
    pendingAcks.length +
    myDrafts.total +
    (deptBlock ? (deptBlock.ncrAssigned.length + deptBlock.complaintsAssigned.length + deptBlock.kpiPendingCount) : 0);

  // ═══ 10) تنبيهات موحّدة (بطاقات Action) ═══
  const alerts = [];
  if ((kpiSummary?.pending || 0) > 0) {
    alerts.push({
      type: 'kpi_missing',
      severity: 'warning',
      count: kpiSummary.pending,
      title: `${kpiSummary.pending} مؤشر بدون قراءة لهذا الشهر`,
      action: { page: 'myKpi', label: 'إدخال قراءة' },
    });
  }
  if (ncrAssigned.length > 0) {
    alerts.push({
      type: 'ncr_assigned',
      severity: 'warning',
      count: ncrAssigned.length,
      title: `${ncrAssigned.length} حالة عدم مطابقة مسنَدة إليك`,
      action: { page: 'ncr', label: 'فتح القائمة' },
    });
  }
  if (pendingAcks.length > 0) {
    alerts.push({
      type: 'acks_pending',
      severity: 'info',
      count: pendingAcks.length,
      title: `${pendingAcks.length} إقرار بانتظار توقيعك`,
      action: { page: 'myAcks', label: 'فتح الإقرارات' },
    });
  }
  if (myDrafts.total > 0) {
    alerts.push({
      type: 'drafts',
      severity: 'info',
      count: myDrafts.total,
      title: `${myDrafts.total} مسوّدة لم تُرسَل بعد`,
      action: { page: 'myWork', label: 'إكمال المسوّدات' },
    });
  }
  if (atRisk.total > 0) {
    alerts.push({
      type: 'progress_low',
      severity: atRisk.total >= 5 ? 'critical' : 'warning',
      count: atRisk.total,
      title: `${atRisk.total} ${privileged ? 'هدف/نشاط' : 'هدف'} دون 50% — راجع الأسباب`,
      action: { page: privileged ? 'strategicGoals' : 'myKpi', label: 'فتح القائمة' },
    });
  }
  if (compAssigned.length > 0) {
    alerts.push({
      type: 'complaints_assigned',
      severity: 'info',
      count: compAssigned.length,
      title: `${compAssigned.length} شكوى مسنَدة إليك`,
      action: { page: 'complaints', label: 'فتح القائمة' },
    });
  }
  if (privileged && compBreached.length > 0) {
    alerts.push({
      type: 'sla_breached',
      severity: 'critical',
      count: compBreached.length,
      title: `${compBreached.length} شكوى تجاوزت مدّة SLA`,
      action: { page: 'slaBoard', label: 'لوحة SLA' },
    });
  }
  if (privileged && beneficiariesDueReview.length > 0) {
    alerts.push({
      type: 'beneficiary_review_due',
      severity: 'warning',
      count: beneficiariesDueReview.length,
      title: `${beneficiariesDueReview.length} مستفيد يحتاج إعادة تقييم (>365 يوم)`,
      action: { page: 'beneficiaries', label: 'فتح القائمة' },
    });
  }
  if (privileged && (risksPendingReview.length + supplierEvalsPendingReview.length) > 0) {
    const n = risksPendingReview.length + supplierEvalsPendingReview.length;
    alerts.push({
      type: 'workflow_pending',
      severity: 'info',
      count: n,
      title: `${n} عنصر workflow بانتظار مراجعتك`,
      action: { page: 'risks', label: 'المخاطر' },
    });
  }
  if (execBlock?.mgmtReview) {
    const last = execBlock.mgmtReview.meetingDate ? new Date(execBlock.mgmtReview.meetingDate) : null;
    if (last) {
      const daysSince = Math.floor((Date.now() - last.getTime()) / 86400000);
      if (daysSince > 180) {
        alerts.push({
          type: 'mgmt_review_overdue',
          severity: 'critical',
          count: 1,
          title: `لم تُعقد مراجعة إدارية منذ ${daysSince} يوم`,
          action: { page: 'managementReview', label: 'فتح المراجعة' },
        });
      } else if (daysSince > 150) {
        alerts.push({
          type: 'mgmt_review_due_soon',
          severity: 'warning',
          count: 1,
          title: `المراجعة الإدارية مستحقة خلال ${180 - daysSince} يوم`,
          action: { page: 'managementReview', label: 'جدولة' },
        });
      }
    }
  }

  res.json({
    ok: true,
    viewMode,
    role,
    user: { id: userId, role },
    kpi: kpiSummary,
    ncr: {
      assigned: ncrAssigned,
      pendingReview:   privileged ? ncrPendingReview   : [],
      pendingApproval: privileged ? ncrPendingApproval : [],
    },
    complaints: {
      assigned: compAssigned,
      breached: privileged ? compBreached.map(c => ({
        id: c.id, code: c.code, subject: c.subject, severity: c.severity, status: c.status,
        ageDays: c.sla.ageDays, overall: c.sla.overall,
      })) : [],
    },
    workflow: {
      risksPendingReview:         privileged ? risksPendingReview : [],
      supplierEvalsPendingReview: privileged ? supplierEvalsPendingReview : [],
    },
    beneficiaries: {
      dueReview: privileged ? beneficiariesDueReview : [],
    },
    pendingAcks,
    myDrafts,
    atRisk,
    dept: deptBlock,
    exec: execBlock,
    dataHealth,
    alerts,
    summary: { totalActions },
  });
}));

export default router;
