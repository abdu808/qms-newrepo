/**
 * alerts.js — نظام التنبيهات الاستباقية (Live Health Signals)
 * ─────────────────────────────────────────────────────────────────
 * ISO 9001:2015 — §9.1.3 (Analysis & evaluation) + §10.1 (Improvement)
 *
 * الفرق بين هذا الملف و `scheduler.js`:
 *   • scheduler → يكتب إشعارات دائمة في صندوق بريد المستخدم (Notification)
 *   • alerts    → يعيد لقطة حيّة (snapshot) من حالة النظام الآن
 *                 مناسبة للوحات الصحة والشارات في شريط التنقل
 *
 * كل detector يُرجع كائناً موحّداً:
 *   {
 *     key:       'OVERDUE_COMPLAINTS',
 *     severity:  'danger' | 'warn' | 'info',
 *     title:     'شكاوى متأخرة',
 *     message:   '3 شكاوى تجاوزت 14 يوماً دون معالجة',
 *     count:     3,
 *     items:     [ { id, code, title, … } ],
 *     iso:       '9.1.2',
 *     actionUrl: '/#/complaints?filter=overdue',
 *   }
 */
import { prisma } from '../db.js';
import { activeWhere } from './dataHelpers.js';

// ═══════════════════════════════════════════════════════════════
//  Thresholds (single source of truth — lines up with scheduler.js)
// ═══════════════════════════════════════════════════════════════
const T = {
  OVERDUE_COMPLAINT_DAYS: 14,
  DOC_REVIEW_WARN_DAYS:   30,
  RISK_REVIEW_STALE_DAYS: 90,
  NCR_STUCK_DAYS:         30,   // NCR مفتوح دون إجراء تصحيحي لأكثر من 30 يوماً
  MGMT_REVIEW_MAX_MONTHS: 12,   // ISO 9.3: يجب إجراء مراجعة إدارية سنوياً على الأقل
  MAX_ITEMS_PER_ALERT:    5,    // كم سجلاً نُعيد في items[] ليُعرض في الـ UI
};

const OPEN_COMPLAINT = ['NEW', 'UNDER_REVIEW', 'IN_PROGRESS'];
const OPEN_NCR       = ['OPEN', 'ROOT_CAUSE', 'ACTION_PLANNED', 'IN_PROGRESS', 'VERIFICATION'];

// ═══════════════════════════════════════════════════════════════
//  Detectors
//  Each is async; returns null when there's nothing to report.
// ═══════════════════════════════════════════════════════════════

async function overdueComplaints() {
  const cutoff = new Date(Date.now() - T.OVERDUE_COMPLAINT_DAYS * 86400000);
  const [count, items] = await Promise.all([
    prisma.complaint.count({
      where: activeWhere({ status: { in: OPEN_COMPLAINT }, receivedAt: { lte: cutoff } }),
    }),
    prisma.complaint.findMany({
      where: activeWhere({ status: { in: OPEN_COMPLAINT }, receivedAt: { lte: cutoff } }),
      select: { id: true, code: true, subject: true, receivedAt: true, severity: true },
      orderBy: { receivedAt: 'asc' },
      take: T.MAX_ITEMS_PER_ALERT,
    }),
  ]);
  if (!count) return null;
  return {
    key: 'OVERDUE_COMPLAINTS',
    severity: 'danger',
    title: 'شكاوى متأخرة',
    message: `${count} شكوى مفتوحة تجاوزت ${T.OVERDUE_COMPLAINT_DAYS} يوماً دون حسم`,
    count, items,
    iso: '9.1.2',
    actionUrl: '/#/complaints?filter=overdue',
  };
}

async function overdueNcrs() {
  const now = new Date();
  const where = activeWhere({
    status: { notIn: ['CLOSED'] },
    dueDate: { lt: now, not: null },
  });
  const [count, items] = await Promise.all([
    prisma.nCR.count({ where }),
    prisma.nCR.findMany({
      where,
      select: { id: true, code: true, title: true, dueDate: true, severity: true, status: true },
      orderBy: { dueDate: 'asc' },
      take: T.MAX_ITEMS_PER_ALERT,
    }),
  ]);
  if (!count) return null;
  return {
    key: 'OVERDUE_NCRS',
    severity: 'danger',
    title: 'عدم مطابقة متأخرة',
    message: `${count} عدم مطابقة تجاوزت تاريخ المعالجة المقرَّر`,
    count, items,
    iso: '10.2',
    actionUrl: '/#/ncr?filter=overdue',
  };
}

async function stuckNcrs() {
  // NCR مفتوح > 30 يوماً ولا يحوي correctiveAction
  const cutoff = new Date(Date.now() - T.NCR_STUCK_DAYS * 86400000);
  const where = activeWhere({
    status: { in: OPEN_NCR },
    createdAt: { lte: cutoff },
    OR: [{ correctiveAction: null }, { correctiveAction: '' }],
  });
  const [count, items] = await Promise.all([
    prisma.nCR.count({ where }),
    prisma.nCR.findMany({
      where,
      select: { id: true, code: true, title: true, createdAt: true, status: true },
      orderBy: { createdAt: 'asc' },
      take: T.MAX_ITEMS_PER_ALERT,
    }),
  ]);
  if (!count) return null;
  return {
    key: 'STUCK_NCRS',
    severity: 'warn',
    title: 'عدم مطابقة بلا إجراء تصحيحي',
    message: `${count} سجل مفتوح أكثر من ${T.NCR_STUCK_DAYS} يوماً دون توثيق إجراء تصحيحي`,
    count, items,
    iso: '10.2',
    actionUrl: '/#/ncr?filter=stuck',
  };
}

async function criticalRisks() {
  const where = activeWhere({
    level: 'حرج',
    status: { notIn: ['CLOSED', 'ACCEPTED'] },
  });
  const [count, items] = await Promise.all([
    prisma.risk.count({ where }),
    prisma.risk.findMany({
      where,
      select: { id: true, code: true, title: true, level: true, status: true },
      orderBy: { updatedAt: 'asc' },
      take: T.MAX_ITEMS_PER_ALERT,
    }),
  ]);
  if (!count) return null;
  return {
    key: 'CRITICAL_RISKS',
    severity: 'danger',
    title: 'مخاطر حرجة نشطة',
    message: `${count} خطر حرج يستوجب تدخلاً فورياً`,
    count, items,
    iso: '6.1',
    actionUrl: '/#/risks?filter=critical',
  };
}

async function staleRisks() {
  const cutoff = new Date(Date.now() - T.RISK_REVIEW_STALE_DAYS * 86400000);
  const where = activeWhere({
    status: { notIn: ['CLOSED', 'ACCEPTED'] },
    level: { in: ['حرج', 'مرتفع'] },
    updatedAt: { lt: cutoff },
  });
  const [count, items] = await Promise.all([
    prisma.risk.count({ where }),
    prisma.risk.findMany({
      where,
      select: { id: true, code: true, title: true, level: true, updatedAt: true },
      orderBy: { updatedAt: 'asc' },
      take: T.MAX_ITEMS_PER_ALERT,
    }),
  ]);
  if (!count) return null;
  return {
    key: 'STALE_RISKS',
    severity: 'warn',
    title: 'مخاطر تحتاج مراجعة',
    message: `${count} خطر (مرتفع/حرج) لم يُحدَّث منذ ${T.RISK_REVIEW_STALE_DAYS} يوماً`,
    count, items,
    iso: '6.1',
    actionUrl: '/#/risks?filter=stale',
  };
}

async function docsDueForReview() {
  const now  = new Date();
  const soon = new Date(now.getTime() + T.DOC_REVIEW_WARN_DAYS * 86400000);
  const where = activeWhere({
    status: 'PUBLISHED',
    reviewDate: { gte: now, lte: soon },
  });
  const [count, items] = await Promise.all([
    prisma.document.count({ where }),
    prisma.document.findMany({
      where,
      select: { id: true, code: true, title: true, reviewDate: true, category: true },
      orderBy: { reviewDate: 'asc' },
      take: T.MAX_ITEMS_PER_ALERT,
    }),
  ]);
  if (!count) return null;
  return {
    key: 'DOCS_DUE_FOR_REVIEW',
    severity: 'warn',
    title: 'وثائق تستحق المراجعة',
    message: `${count} وثيقة منشورة تستحق المراجعة خلال ${T.DOC_REVIEW_WARN_DAYS} يوماً`,
    count, items,
    iso: '7.5.3',
    actionUrl: '/#/documents?filter=dueForReview',
  };
}

async function pendingSuppliers() {
  const where = activeWhere({ status: 'PENDING' });
  const [count, items] = await Promise.all([
    prisma.supplier.count({ where }),
    prisma.supplier.findMany({
      where,
      select: { id: true, code: true, name: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
      take: T.MAX_ITEMS_PER_ALERT,
    }),
  ]);
  if (!count) return null;
  return {
    key: 'PENDING_SUPPLIERS',
    severity: 'info',
    title: 'موردون في انتظار الاعتماد',
    message: `${count} مورد يحتاج إلى تقييم واعتماد`,
    count, items,
    iso: '8.4',
    actionUrl: '/#/suppliers?filter=pending',
  };
}

async function dueManagementReview() {
  // آخر مراجعة مكتملة قبل أكثر من MGMT_REVIEW_MAX_MONTHS شهراً، ولا يوجد PLANNED قادمة
  const threshold = new Date();
  threshold.setMonth(threshold.getMonth() - T.MGMT_REVIEW_MAX_MONTHS);

  const [lastCompleted, upcoming] = await Promise.all([
    prisma.managementReview.findFirst({
      where: { status: 'COMPLETED' },
      orderBy: { meetingDate: 'desc' },
      select: { id: true, title: true, meetingDate: true },
    }),
    prisma.managementReview.findFirst({
      where: { status: 'PLANNED', meetingDate: { gte: new Date() } },
      orderBy: { meetingDate: 'asc' },
      select: { id: true, title: true, meetingDate: true },
    }),
  ]);

  // إذا كانت هناك مراجعة قادمة مخطَّطة — لا داعي للتنبيه
  if (upcoming) return null;

  const isOverdue = !lastCompleted || new Date(lastCompleted.meetingDate) < threshold;
  if (!isOverdue) return null;

  return {
    key: 'MGMT_REVIEW_OVERDUE',
    severity: 'danger',
    title: 'مراجعة إدارية مستحقة',
    message: lastCompleted
      ? `آخر مراجعة إدارية مكتملة بتاريخ ${new Date(lastCompleted.meetingDate).toISOString().slice(0,10)} — مضى عليها أكثر من ${T.MGMT_REVIEW_MAX_MONTHS} شهراً`
      : 'لا توجد مراجعة إدارية مكتملة بعد — ISO 9.3 يشترطها سنوياً',
    count: 1,
    items: lastCompleted ? [lastCompleted] : [],
    iso: '9.3',
    actionUrl: '/#/managementReview',
  };
}

async function unapprovedSupplierEvals() {
  // تقييمات موردين لم تُعتمد بعد (percentage منخفض يحتاج قراراً إدارياً)
  const where = activeWhere({ percentage: { lt: 60 } });
  const [count, items] = await Promise.all([
    prisma.supplierEval.count({ where }).catch(() => 0),
    prisma.supplierEval.findMany({
      where,
      select: { id: true, code: true, percentage: true, supplier: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: T.MAX_ITEMS_PER_ALERT,
    }).catch(() => []),
  ]);
  if (!count) return null;
  return {
    key: 'LOW_SUPPLIER_SCORES',
    severity: 'warn',
    title: 'تقييمات موردين منخفضة',
    message: `${count} تقييم مورد بدرجة دون 60 — يحتاج قراراً بالإبقاء/الاستبعاد`,
    count, items,
    iso: '8.4.2',
    actionUrl: '/#/supplierEvals?filter=low',
  };
}

// ═══════════════════════════════════════════════════════════════
//  Runner
// ═══════════════════════════════════════════════════════════════

const DETECTORS = [
  overdueComplaints,
  overdueNcrs,
  stuckNcrs,
  criticalRisks,
  staleRisks,
  docsDueForReview,
  pendingSuppliers,
  dueManagementReview,
  unapprovedSupplierEvals,
];

/**
 * يُشغّل كل الـ detectors بالتوازي ويُعيد فقط غير الفارغة.
 * لا يرمي أبداً — الـ detector الفاشل يُعيد null ويُسجَّل في console.
 */
export async function collectAlerts() {
  const results = await Promise.all(
    DETECTORS.map(async (d) => {
      try { return await d(); }
      catch (e) {
        console.warn(`[alerts] detector ${d.name} failed:`, e.message);
        return null;
      }
    }),
  );
  return results.filter(Boolean);
}

/**
 * ملخص سريع: عدد التنبيهات مصنّفة حسب الشدّة (لاستخدام badge التنقل).
 */
export async function alertsSummary() {
  const alerts = await collectAlerts();
  const summary = { total: alerts.length, danger: 0, warn: 0, info: 0 };
  for (const a of alerts) summary[a.severity] = (summary[a.severity] || 0) + 1;
  return summary;
}

export const _thresholds = T;
