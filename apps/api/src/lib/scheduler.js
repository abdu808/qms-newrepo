/**
 * scheduler.js — جدولة فحوصات دورية لإنشاء إشعارات آلية
 * P-06 §4 · ISO 9001 §7.4 · §9.1.3
 *
 * يعمل كـ setInterval داخل عملية Node الواحدة. لا يحتاج cron خارجي.
 * لتعطيله: ضَع ENV `QMS_SCHEDULER=off`.
 */
import { prisma } from '../db.js';
import { activeWhere } from './dataHelpers.js';
import { runBackupCycle } from '../services/backup.js';
import { scanSla } from './sla.js';

const INTERVAL_MS = 60 * 60 * 1000;   // كل ساعة
const OVERDUE_COMPLAINT_DAYS = 14;
const DOC_REVIEW_WARN_DAYS   = 30;
const RISK_REVIEW_STALE_DAYS = 90;
const NCR_STUCK_DAYS         = 30;
const MGMT_REVIEW_MAX_MONTHS = 12;

/** ينشئ إشعاراً فقط إذا لم يكن له مفتاح فريد مطابق (idempotent).
 *  نستخدم createMany({ skipDuplicates }) لتفادي ضرب القاعدة بخطأ unique
 *  على كل استدعاء متكرر — أنظف من try/catch للحالات المتوقعة. */
async function notifyOnce({ userId, type, title, message, link, entityType, entityId, eventKey }) {
  if (!userId || !eventKey) return;
  try {
    await prisma.notification.createMany({
      data: [{ userId, type, title, message, link, entityType, entityId, eventKey }],
      skipDuplicates: true,
    });
  } catch (e) {
    console.warn('[scheduler] notify failed:', e.message);
  }
}

/** مفتاح يومي ليُعاد الإشعار مرة واحدة في اليوم فقط. */
function dayKey(prefix, ...parts) {
  const today = new Date().toISOString().slice(0, 10);
  return [prefix, ...parts, today].join(':');
}

async function checkOverdueNcrs() {
  const now = new Date();
  const items = await prisma.nCR.findMany({
    where: activeWhere({
      status: { notIn: ['CLOSED'] },
      dueDate: { lt: now, not: null },
      assigneeId: { not: null },
    }),
    select: { id: true, code: true, title: true, assigneeId: true, dueDate: true },
  });
  for (const n of items) {
    await notifyOnce({
      userId: n.assigneeId,
      type: 'NCR_OVERDUE',
      title: `⚠️ عدم مطابقة متأخرة: ${n.code}`,
      message: `${n.title} — تجاوزت تاريخ المعالجة المقرَّر.`,
      link: `/#/ncr?id=${n.id}`,
      entityType: 'NCR',
      entityId: n.id,
      eventKey: dayKey('NCR_OVERDUE', n.id),
    });
  }
}

/**
 * SLA-driven escalation — يستبدل الحدود الثابتة بحساب SLA حسب الشدّة (lib/sla.js).
 *   • BREACHED → إشعار فوري (critical)
 *   • DUE_SOON → إشعار تحذيري (warning)
 *   • QM/SUPER_ADMIN يصلهم ملخّص لكل المتأخرات
 */
async function checkSlaBreaches() {
  const { complaints, ncrs } = await scanSla(prisma);
  const qms = await prisma.user.findMany({
    where: { role: { in: ['QUALITY_MANAGER', 'SUPER_ADMIN'] }, active: true },
    select: { id: true },
  });
  const qmIds = qms.map(u => u.id);

  // ── شكاوى ─────────────────────────────────────────────────────
  for (const c of complaints) {
    if (!['BREACHED', 'DUE_SOON'].includes(c.sla.overall)) continue;
    const isBreach = c.sla.overall === 'BREACHED';
    const icon = isBreach ? '🚨' : '⏰';
    const title = isBreach
      ? `${icon} شكوى تجاوزت SLA: ${c.code}`
      : `${icon} شكوى ستنتهي قريباً: ${c.code}`;
    const msg = `${c.subject} — الشدّة: ${c.severity || 'متوسطة'} — عمرها ${c.sla.ageDays} يوماً.`;
    const recipients = new Set([c.assigneeId, ...(isBreach ? qmIds : [])].filter(Boolean));
    for (const uid of recipients) {
      await notifyOnce({
        userId: uid,
        type: isBreach ? 'COMPLAINT_SLA_BREACH' : 'COMPLAINT_SLA_DUE_SOON',
        title, message: msg,
        link: `/#/complaints?id=${c.id}`,
        entityType: 'Complaint', entityId: c.id,
        eventKey: dayKey(isBreach ? 'CMP_BREACH' : 'CMP_DUE_SOON', c.id, uid),
      });
    }
  }

  // ── NCRs ─────────────────────────────────────────────────────
  for (const n of ncrs) {
    if (!['BREACHED', 'DUE_SOON'].includes(n.sla.overall)) continue;
    const isBreach = n.sla.overall === 'BREACHED';
    const icon = isBreach ? '🚨' : '⏰';
    const title = isBreach
      ? `${icon} عدم مطابقة تجاوزت SLA: ${n.code}`
      : `${icon} عدم مطابقة ستنتهي قريباً: ${n.code}`;
    const msg = `${n.title} — الشدّة: ${n.severity || 'متوسطة'} — عمرها ${n.sla.ageDays} يوماً.`;
    const recipients = new Set([n.assigneeId, ...(isBreach ? qmIds : [])].filter(Boolean));
    for (const uid of recipients) {
      await notifyOnce({
        userId: uid,
        type: isBreach ? 'NCR_SLA_BREACH' : 'NCR_SLA_DUE_SOON',
        title, message: msg,
        link: `/#/ncr?id=${n.id}`,
        entityType: 'NCR', entityId: n.id,
        eventKey: dayKey(isBreach ? 'NCR_BREACH' : 'NCR_DUE_SOON', n.id, uid),
      });
    }
  }
}

async function checkDocumentsDueForReview() {
  const now = new Date();
  const soon = new Date(now.getTime() + DOC_REVIEW_WARN_DAYS * 86400000);
  const docs = await prisma.document.findMany({
    where: activeWhere({
      status: 'PUBLISHED',
      reviewDate: { gte: now, lte: soon },
    }),
    select: { id: true, code: true, title: true, reviewDate: true, createdById: true },
  });
  // أَبلغ QM + منشئ الوثيقة
  const qms = await prisma.user.findMany({
    where: { role: { in: ['QUALITY_MANAGER', 'SUPER_ADMIN'] }, active: true },
    select: { id: true },
  });
  for (const d of docs) {
    const recipients = new Set([d.createdById, ...qms.map(u => u.id)].filter(Boolean));
    for (const uid of recipients) {
      await notifyOnce({
        userId: uid,
        type: 'DOC_REVIEW_DUE',
        title: `📄 وثيقة تستحق المراجعة: ${d.code}`,
        message: `${d.title} — تاريخ المراجعة ${new Date(d.reviewDate).toISOString().slice(0,10)}.`,
        link: `/#/documents?id=${d.id}`,
        entityType: 'Document',
        entityId: d.id,
        eventKey: dayKey('DOC_REVIEW_DUE', d.id, uid),
      });
    }
  }
}

async function checkStaleRisks() {
  const cutoff = new Date(Date.now() - RISK_REVIEW_STALE_DAYS * 86400000);
  const risks = await prisma.risk.findMany({
    where: activeWhere({
      status: { notIn: ['CLOSED', 'ACCEPTED'] },
      level: { in: ['حرج', 'مرتفع'] },
      updatedAt: { lt: cutoff },
      ownerId: { not: null },
    }),
    select: { id: true, code: true, title: true, level: true, ownerId: true },
  });
  for (const r of risks) {
    await notifyOnce({
      userId: r.ownerId,
      type: 'RISK_REVIEW_DUE',
      title: `⚠️ خطر [${r.level}] يحتاج مراجعة: ${r.code}`,
      message: `${r.title} — لم يُحدَّث منذ ${RISK_REVIEW_STALE_DAYS} يوماً.`,
      link: `/#/risks?id=${r.id}`,
      entityType: 'Risk',
      entityId: r.id,
      eventKey: dayKey('RISK_REVIEW_DUE', r.id),
    });
  }
}

async function checkMissingPolicyAcks() {
  const active = await prisma.qualityPolicy.findFirst({
    where: { active: true },
    orderBy: { effectiveDate: 'desc' },
  });
  if (!active) return;
  // مرة واحدة لكل موظف لكل إصدار سياسة
  const [users, acks] = await Promise.all([
    prisma.user.findMany({ where: { active: true }, select: { id: true, name: true } }),
    prisma.policyAcknowledgment.findMany({
      where: { policyId: active.id, policyVersion: active.version },
      select: { userId: true },
    }),
  ]);
  const ackedSet = new Set(acks.map(a => a.userId));
  for (const u of users) {
    if (ackedSet.has(u.id)) continue;
    await notifyOnce({
      userId: u.id,
      type: 'POLICY_ACK_PENDING',
      title: '📜 إقرار سياسة الجودة',
      message: `يرجى الإقرار بالاطّلاع على السياسة إصدار ${active.version}.`,
      link: '/#/qualityPolicy',
      entityType: 'QualityPolicy',
      entityId: active.id,
      eventKey: `POLICY_ACK_PENDING:${active.id}:${active.version}:${u.id}`,
    });
  }
}

/**
 * يُذكِّر الموظفين بالوثائق التي تحتاج إقراراً منهم ضمن إطار الإقرارات الموحَّد.
 * ISO 37001 · PDPL · حوكمة
 */
async function checkMissingAckDocuments() {
  try {
    const docs = await prisma.ackDocument.findMany({
      where: activeWhere({ active: true, mandatory: true,
               audience: { hasSome: ['EMPLOYEE', 'ALL'] } }),
      select: { id: true, version: true, code: true, title: true, category: true },
    });
    if (!docs.length) return;
    const users = await prisma.user.findMany({
      where: { active: true }, select: { id: true },
    });
    for (const d of docs) {
      const acks = await prisma.acknowledgment.findMany({
        where: { documentId: d.id, documentVersion: d.version, userId: { not: null } },
        select: { userId: true },
      });
      const ackedSet = new Set(acks.map(a => a.userId));
      for (const u of users) {
        if (ackedSet.has(u.id)) continue;
        await notifyOnce({
          userId: u.id,
          type: 'ACK_DOCUMENT_PENDING',
          title: `📋 وثيقة تحتاج إقرارك: ${d.code}`,
          message: `${d.title} — إصدار ${d.version}`,
          link: '/#/myAcknowledgments',
          entityType: 'AckDocument',
          entityId: d.id,
          eventKey: `ACK_DOC_PENDING:${d.id}:${d.version}:${u.id}`,
        });
      }
    }
  } catch (e) {
    // قد يكون موديل ackDocument غير متوفر قبل prisma generate — نتسامح
    if (!/ackDocument|acknowledgment/i.test(e.message || '')) {
      console.warn('[scheduler] checkMissingAckDocuments:', e.message);
    }
  }
}

/**
 * NCR مفتوح > 30 يوماً دون إجراء تصحيحي — يُنبَّه المكلَّف ومديرو الجودة.
 * ISO 10.2 — "the organization shall take action to control and correct".
 */
async function checkStuckNcrs() {
  const cutoff = new Date(Date.now() - NCR_STUCK_DAYS * 86400000);
  const items = await prisma.nCR.findMany({
    where: activeWhere({
      status: { in: ['OPEN', 'ROOT_CAUSE', 'ACTION_PLANNED', 'IN_PROGRESS', 'VERIFICATION'] },
      createdAt: { lte: cutoff },
      OR: [{ correctiveAction: null }, { correctiveAction: '' }],
    }),
    select: { id: true, code: true, title: true, assigneeId: true, reporterId: true },
  });
  const qms = await prisma.user.findMany({
    where: { role: { in: ['QUALITY_MANAGER', 'SUPER_ADMIN'] }, active: true },
    select: { id: true },
  });
  for (const n of items) {
    const recipients = new Set([n.assigneeId, n.reporterId, ...qms.map(u => u.id)].filter(Boolean));
    for (const uid of recipients) {
      await notifyOnce({
        userId: uid,
        type: 'NCR_STUCK',
        title: `🚧 عدم مطابقة بلا إجراء تصحيحي: ${n.code}`,
        message: `${n.title} — مفتوحة أكثر من ${NCR_STUCK_DAYS} يوماً بدون توثيق correctiveAction.`,
        link: `/#/ncr?id=${n.id}`,
        entityType: 'NCR',
        entityId: n.id,
        eventKey: dayKey('NCR_STUCK', n.id, uid),
      });
    }
  }
}

/**
 * ISO 9.3 — المراجعة الإدارية يجب أن تُجرى سنوياً على الأقل.
 * ينبَّه مديرو الجودة عند مرور أكثر من 12 شهراً بلا مراجعة مكتملة ودون جلسة قادمة مخطَّطة.
 */
async function checkDueManagementReview() {
  const threshold = new Date();
  threshold.setMonth(threshold.getMonth() - MGMT_REVIEW_MAX_MONTHS);

  const [lastCompleted, upcoming] = await Promise.all([
    prisma.managementReview.findFirst({
      where: { status: 'COMPLETED' },
      orderBy: { meetingDate: 'desc' },
      select: { id: true, meetingDate: true },
    }),
    prisma.managementReview.findFirst({
      where: { status: 'PLANNED', meetingDate: { gte: new Date() } },
      select: { id: true },
    }),
  ]);
  if (upcoming) return;
  const isOverdue = !lastCompleted || new Date(lastCompleted.meetingDate) < threshold;
  if (!isOverdue) return;

  const qms = await prisma.user.findMany({
    where: { role: { in: ['QUALITY_MANAGER', 'SUPER_ADMIN'] }, active: true },
    select: { id: true },
  });
  for (const u of qms) {
    await notifyOnce({
      userId: u.id,
      type: 'MGMT_REVIEW_DUE',
      title: '📋 مراجعة إدارية مستحقة',
      message: lastCompleted
        ? `آخر مراجعة مكتملة في ${new Date(lastCompleted.meetingDate).toISOString().slice(0,10)} — جدولة مراجعة جديدة مطلوبة (ISO 9.3).`
        : 'لا توجد مراجعة إدارية مكتملة — ISO 9.3 يشترطها سنوياً.',
      link: '/#/managementReview',
      entityType: 'ManagementReview',
      entityId: lastCompleted?.id || null,
      eventKey: dayKey('MGMT_REVIEW_DUE', u.id),
    });
  }
}

async function runAllChecks() {
  const started = Date.now();
  try {
    await Promise.allSettled([
      checkOverdueNcrs(),
      checkSlaBreaches(),        // بدل checkOverdueComplaints — يشمل شكاوى + NCR
      checkDocumentsDueForReview(),
      checkStaleRisks(),
      checkMissingPolicyAcks(),
      checkMissingAckDocuments(),
      checkStuckNcrs(),
      checkDueManagementReview(),
    ]);
    const ms = Date.now() - started;
    console.log(`[scheduler] checks completed in ${ms}ms`);
  } catch (e) {
    console.error('[scheduler] run failed:', e);
  }
}

// ─────────────────────────────────────────────────────────────
// Daily jobs — يُشغَّل مرة واحدة في اليوم (مع حارس تاريخ)
// ─────────────────────────────────────────────────────────────
let lastDailyJobDate = null;
async function runDailyJobsIfDue() {
  const today = new Date().toISOString().slice(0, 10);
  if (lastDailyJobDate === today) return;
  const hour = new Date().getHours();
  if (hour < 6) return; // بعد الـ6 صباحاً فقط
  lastDailyJobDate = today;
  try {
    await dailyDataHealthScan();
  } catch (e) { console.warn('[scheduler] daily jobs failed:', e.message); }
}

/**
 * فحص صحة البيانات اليومي (5.3).
 * يُنبّه QM بالنقاط الحرجة التي تحتاج تدخّلاً فورياً.
 */
async function dailyDataHealthScan() {
  const qms = await prisma.user.findMany({
    where: { role: { in: ['QUALITY_MANAGER', 'SUPER_ADMIN'] }, active: true },
    select: { id: true },
  });
  if (!qms.length) return;

  // مؤشرات حرجة (ممكن توسيعها لاحقاً بقراءة /api/data-health مباشرة)
  const [ncrBreached, cmpBreached, docsWithoutReview, usersWithoutDept] = await Promise.all([
    prisma.nCR.count({ where: activeWhere({ status: { not: 'CLOSED' }, dueDate: { lt: new Date(), not: null } }) }),
    prisma.complaint.count({ where: activeWhere({ status: { in: ['NEW', 'UNDER_REVIEW', 'IN_PROGRESS'] } }) }),
    prisma.document.count({ where: activeWhere({ status: 'PUBLISHED', reviewDate: null }) }),
    prisma.user.count({ where: { active: true, departmentId: null } }),
  ]);

  const issues = [];
  if (ncrBreached > 0) issues.push(`${ncrBreached} عدم مطابقة تجاوزت الاستحقاق`);
  if (cmpBreached > 0) issues.push(`${cmpBreached} شكوى مفتوحة تحتاج متابعة`);
  if (docsWithoutReview > 0) issues.push(`${docsWithoutReview} وثيقة منشورة بلا تاريخ مراجعة`);
  if (usersWithoutDept > 0) issues.push(`${usersWithoutDept} مستخدم بدون قسم`);

  if (!issues.length) return;

  const msg = '• ' + issues.join('\n• ');
  for (const u of qms) {
    await notifyOnce({
      userId: u.id,
      type: 'DAILY_DATA_HEALTH',
      title: '🩺 فحص صحة البيانات اليومي',
      message: msg,
      link: '/#/dataHealth',
      entityType: 'System',
      entityId: null,
      eventKey: dayKey('DAILY_HEALTH', u.id),
    });
  }
}

// ─────────────────────────────────────────────────────────────
// Weekly exec summary — الإثنين صباحاً
// ─────────────────────────────────────────────────────────────
let lastWeeklyDate = null;
async function runWeeklySummaryIfDue() {
  const now = new Date();
  if (now.getDay() !== 1) return; // الإثنين فقط (getDay: 0=Sun, 1=Mon)
  const hour = now.getHours();
  if (hour < 8) return; // بعد الـ8 صباحاً
  const today = now.toISOString().slice(0, 10);
  if (lastWeeklyDate === today) return;
  lastWeeklyDate = today;
  try { await sendWeeklyExecSummary(); }
  catch (e) { console.warn('[scheduler] weekly summary failed:', e.message); }
}

async function sendWeeklyExecSummary() {
  // جمهور التقرير: SUPER_ADMIN + EXECUTIVE (إن وُجد) + QUALITY_MANAGER
  const execs = await prisma.user.findMany({
    where: { role: { in: ['SUPER_ADMIN', 'QUALITY_MANAGER', 'EXECUTIVE'] }, active: true },
    select: { id: true },
  });
  if (!execs.length) return;

  const weekAgo = new Date(Date.now() - 7 * 86400000);
  const [newNcrs, closedNcrs, newComplaints, closedComplaints, slaData] = await Promise.all([
    prisma.nCR.count({ where: activeWhere({ createdAt: { gte: weekAgo } }) }),
    prisma.nCR.count({ where: activeWhere({ status: 'CLOSED', updatedAt: { gte: weekAgo } }) }),
    prisma.complaint.count({ where: activeWhere({ createdAt: { gte: weekAgo } }) }),
    prisma.complaint.count({ where: activeWhere({ status: { in: ['RESOLVED', 'CLOSED'] }, updatedAt: { gte: weekAgo } }) }),
    scanSla(prisma),
  ]);

  const s = slaData.summary;
  const msg = [
    `📊 ملخّص الأسبوع:`,
    `• عدم مطابقة جديدة: ${newNcrs} | مُغلقة: ${closedNcrs}`,
    `• شكاوى جديدة: ${newComplaints} | مُغلقة: ${closedComplaints}`,
    `• SLA: ${s.complaintsBreached + s.ncrsBreached} مخرقة، ${s.complaintsDueSoon + s.ncrsDueSoon} قاربت الاستحقاق`,
  ].join('\n');

  const weekKey = `WEEKLY:${new Date().toISOString().slice(0, 10)}`;
  for (const u of execs) {
    await notifyOnce({
      userId: u.id,
      type: 'WEEKLY_EXEC_SUMMARY',
      title: '📊 ملخّص تنفيذي أسبوعي',
      message: msg,
      link: '/#/dashboard',
      entityType: 'System',
      entityId: null,
      eventKey: `${weekKey}:${u.id}`,
    });
  }
}

// نسخ احتياطي آلي — مرة واحدة يومياً (عند أول فحص بعد منتصف الليل).
// idempotent: لا يُعيد التنفيذ إذا كان ملف اليوم موجود أصلاً.
let lastBackupDate = null;
async function runDailyBackupIfDue() {
  if (process.env.QMS_BACKUP !== 'on') return;
  const today = new Date().toISOString().slice(0, 10);
  if (lastBackupDate === today) return;
  // نفذ فقط بعد الساعة 02 صباحاً (UTC-agnostic — نستخدم الساعة المحلية للخادم)
  const hour = new Date().getHours();
  if (hour < 2) return;
  lastBackupDate = today;
  try {
    const r = await runBackupCycle();
    if (!r.db?.ok) console.warn('[scheduler] backup DB failed:', r.db?.error);
  } catch (e) {
    console.error('[scheduler] backup cycle failed:', e);
  }
}

let timer = null;
export function startScheduler() {
  if (process.env.QMS_SCHEDULER === 'off') {
    console.log('[scheduler] disabled via QMS_SCHEDULER=off');
    return;
  }
  // تشغيل أول بعد 30 ثانية ثم كل ساعة
  const tick = async () => {
    await runAllChecks();
    await runDailyBackupIfDue();
    await runDailyJobsIfDue();
    await runWeeklySummaryIfDue();
  };
  setTimeout(tick, 30 * 1000);
  timer = setInterval(tick, INTERVAL_MS);
  console.log(`[scheduler] started · interval=${INTERVAL_MS / 60000}min`);
}

export function stopScheduler() {
  if (timer) clearInterval(timer);
  timer = null;
}

// Export للاستخدام اليدوي من endpoint إداري
export const _internals = {
  runAllChecks,
  checkOverdueNcrs, checkSlaBreaches, checkDocumentsDueForReview,
  checkStaleRisks, checkMissingPolicyAcks, checkMissingAckDocuments,
  checkStuckNcrs, checkDueManagementReview,
  dailyDataHealthScan, sendWeeklyExecSummary,
};
