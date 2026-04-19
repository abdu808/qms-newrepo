/**
 * lib/sla.js — Batch 14
 * ──────────────────────────────────────────────────────────────
 * محرك SLA للشكاوى وعدم المطابقة (ISO 9.1.2 / 10.2).
 *
 * يحسب السياسة كاملةً من الحقول الموجودة دون الحاجة لأي Migration:
 *   - Complaint: receivedAt / assigneeId / resolvedAt / status
 *   - NCR:       detectedAt / status / verifiedAt
 *
 * كل درجة شدة (منخفضة / متوسطة / مرتفعة) لها نوافذ زمنية مختلفة.
 *
 * الحالة المُعادة لكل سجل:
 *   { stage, dueAt, ageDays, remainingDays, status: OK|DUE_SOON|BREACHED|MET, policy }
 *   - MET        : المرحلة أُنجِزت قبل استحقاقها
 *   - OK         : ضمن SLA، ويتبقى > 20% من النافذة
 *   - DUE_SOON   : ضمن SLA، ويتبقى ≤ 20% من النافذة
 *   - BREACHED   : تجاوز استحقاق المرحلة ولم تُنجَز
 */

const DAY = 24 * 60 * 60 * 1000;

// شدّة ⇆ وزن: المفتاح العربي هو القيمة المحفوظة حالياً، والإنجليزي احتياط.
function severityKey(s) {
  const v = String(s ?? '').trim();
  if (v === 'مرتفعة' || v === 'حرجة' || /^high|critical$/i.test(v)) return 'high';
  if (v === 'منخفضة' || /^low$/i.test(v)) return 'low';
  return 'med'; // المتوسطة هي الافتراض الآمن
}

// ─────────────────────────────────────────────────────────────
// سياسة SLA — قابلة للمراجعة من فريق الجودة
// ─────────────────────────────────────────────────────────────
export const SLA_POLICY = {
  complaint: {
    // ack: من استلام الشكوى حتى إسناد/فحص أولي
    ack:     { high: 1, med: 2, low: 3, label: 'الإسناد والاستلام' },
    // resolve: من استلام الشكوى حتى الحل أو الإغلاق
    resolve: { high: 3, med: 7, low: 14, label: 'الحل والإغلاق' },
  },
  ncr: {
    // rootCause: من الاكتشاف حتى تحديد السبب الجذري
    rootCause: { high: 2,  med: 5,  low: 10, label: 'تحديد السبب الجذري' },
    // action:    حتى تنفيذ الإجراء التصحيحي (الانتقال إلى VERIFICATION)
    action:    { high: 7,  med: 14, low: 30, label: 'تنفيذ الإجراء التصحيحي' },
    // close:     حتى التحقق من الفعالية والإغلاق
    close:     { high: 14, med: 30, low: 60, label: 'التحقق من الفعالية والإغلاق' },
  },
};

// ترتيب مراحل NCR — كل حالة تحمل "ما تم إنجازه إلى الآن".
const NCR_STAGE_REACHED = {
  OPEN:           0, // لم يُحدَّد سبب بعد
  ROOT_CAUSE:     1, // السبب الجذري حُدِّد
  ACTION_PLANNED: 1,
  IN_PROGRESS:    1,
  VERIFICATION:   2, // الإجراء نُفِّذ
  CLOSED:         3, // تم الإغلاق والتحقق
};

const COMPLAINT_OPEN = new Set(['NEW', 'UNDER_REVIEW', 'IN_PROGRESS']);
const COMPLAINT_DONE = new Set(['RESOLVED', 'CLOSED', 'REJECTED']);

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function classify(startAt, dueAt, doneAt, now = Date.now()) {
  const start = new Date(startAt).getTime();
  const due   = new Date(dueAt).getTime();
  const total = Math.max(1, due - start);
  if (doneAt) {
    const d = new Date(doneAt).getTime();
    return d <= due ? 'MET' : 'BREACHED_MET';
  }
  if (now > due) return 'BREACHED';
  const remainingRatio = (due - now) / total;
  return remainingRatio <= 0.2 ? 'DUE_SOON' : 'OK';
}

function daysBetween(a, b) {
  return Math.floor((new Date(b).getTime() - new Date(a).getTime()) / DAY);
}

// ─────────────────────────────────────────────────────────────
// Complaint SLA
// ─────────────────────────────────────────────────────────────
export function computeComplaintSla(c, now = new Date()) {
  const sev = severityKey(c.severity);
  const start = new Date(c.receivedAt || c.createdAt);
  const ackPolicy = SLA_POLICY.complaint.ack;
  const resPolicy = SLA_POLICY.complaint.resolve;

  const ackDueAt = new Date(start.getTime() + ackPolicy[sev] * DAY);
  const resDueAt = new Date(start.getTime() + resPolicy[sev] * DAY);

  // Acknowledgment = حصول assignee أو انتقال من NEW
  const acknowledged = !!c.assigneeId || (c.status && c.status !== 'NEW');
  const ackDoneAt    = acknowledged ? (c.updatedAt || null) : null;

  // Resolution = الانتقال لحالة منتهية أو وجود resolvedAt
  const resolved     = !!c.resolvedAt || COMPLAINT_DONE.has(c.status);
  const resDoneAt    = c.resolvedAt || (resolved ? c.updatedAt : null) || null;

  const ackStatus = classify(start, ackDueAt, ackDoneAt, now.getTime());
  const resStatus = classify(start, resDueAt, resDoneAt, now.getTime());

  // الحالة الإجمالية = الأسوأ بين المرحلتين غير المُنجزتَين
  const order = ['MET', 'OK', 'DUE_SOON', 'BREACHED_MET', 'BREACHED'];
  const overall = [ackStatus, resStatus].reduce(
    (worst, s) => (order.indexOf(s) > order.indexOf(worst) ? s : worst),
    'MET'
  );

  return {
    severity: sev,
    startAt:  start.toISOString(),
    ageDays:  daysBetween(start, now),
    stages: {
      ack: {
        label: ackPolicy.label,
        dueAt: ackDueAt.toISOString(),
        doneAt: ackDoneAt || null,
        status: ackStatus,
        daysToDue: daysBetween(now, ackDueAt),
      },
      resolve: {
        label: resPolicy.label,
        dueAt: resDueAt.toISOString(),
        doneAt: resDoneAt || null,
        status: resStatus,
        daysToDue: daysBetween(now, resDueAt),
      },
    },
    overall,
    breached: overall === 'BREACHED',
  };
}

// ─────────────────────────────────────────────────────────────
// NCR SLA
// ─────────────────────────────────────────────────────────────
export function computeNcrSla(n, now = new Date()) {
  const sev = severityKey(n.severity);
  const start = new Date(n.detectedAt || n.createdAt);
  const pol = SLA_POLICY.ncr;

  const rcDueAt    = new Date(start.getTime() + pol.rootCause[sev] * DAY);
  const actDueAt   = new Date(start.getTime() + pol.action[sev]    * DAY);
  const closeDueAt = new Date(start.getTime() + pol.close[sev]     * DAY);

  const reached = NCR_STAGE_REACHED[n.status] ?? 0;
  // لا تتوفر لدينا طوابع زمنية لكل انتقال؛ نستخدم updatedAt كأفضل تقريب
  // لحظة إنجاز المرحلة الحالية — ونسمح بعرض MET بدقة نسبية.
  const movedAt = n.updatedAt ? new Date(n.updatedAt) : null;

  const rcDone    = reached >= 1 ? (movedAt || now) : null;
  const actDone   = reached >= 2 ? (movedAt || now) : null;
  const closeDone = reached >= 3 ? (n.verifiedAt ? new Date(n.verifiedAt) : (movedAt || now)) : null;

  const rcStatus    = classify(start, rcDueAt,    rcDone,    now.getTime());
  const actStatus   = classify(start, actDueAt,   actDone,   now.getTime());
  const closeStatus = classify(start, closeDueAt, closeDone, now.getTime());

  const order = ['MET', 'OK', 'DUE_SOON', 'BREACHED_MET', 'BREACHED'];
  const overall = [rcStatus, actStatus, closeStatus].reduce(
    (worst, s) => (order.indexOf(s) > order.indexOf(worst) ? s : worst),
    'MET'
  );

  return {
    severity: sev,
    startAt:  start.toISOString(),
    ageDays:  daysBetween(start, now),
    stages: {
      rootCause: {
        label: pol.rootCause.label,
        dueAt: rcDueAt.toISOString(),
        doneAt: rcDone ? new Date(rcDone).toISOString() : null,
        status: rcStatus,
        daysToDue: daysBetween(now, rcDueAt),
      },
      action: {
        label: pol.action.label,
        dueAt: actDueAt.toISOString(),
        doneAt: actDone ? new Date(actDone).toISOString() : null,
        status: actStatus,
        daysToDue: daysBetween(now, actDueAt),
      },
      close: {
        label: pol.close.label,
        dueAt: closeDueAt.toISOString(),
        doneAt: closeDone ? new Date(closeDone).toISOString() : null,
        status: closeStatus,
        daysToDue: daysBetween(now, closeDueAt),
      },
    },
    overall,
    breached: overall === 'BREACHED',
  };
}

// ─────────────────────────────────────────────────────────────
// مسح مجمَّع: يُستخدم من dataHealth + لوحة SLA
// ─────────────────────────────────────────────────────────────
export async function scanSla(prisma) {
  const [complaints, ncrs] = await Promise.all([
    prisma.complaint.findMany({
      where: { deletedAt: null, status: { notIn: ['CLOSED', 'REJECTED'] } },
      select: {
        id: true, code: true, subject: true, severity: true, status: true,
        receivedAt: true, createdAt: true, updatedAt: true,
        assigneeId: true, resolvedAt: true,
      },
    }),
    prisma.nCR.findMany({
      where: { deletedAt: null, status: { not: 'CLOSED' } },
      select: {
        id: true, code: true, title: true, severity: true, status: true,
        detectedAt: true, createdAt: true, updatedAt: true, verifiedAt: true,
      },
    }),
  ]);

  const complaintsEval = complaints.map(c => ({ ...c, sla: computeComplaintSla(c) }));
  const ncrsEval       = ncrs.map(n => ({ ...n, sla: computeNcrSla(n) }));

  return {
    complaints: complaintsEval,
    ncrs: ncrsEval,
    summary: {
      complaintsBreached: complaintsEval.filter(c => c.sla.overall === 'BREACHED').length,
      complaintsDueSoon:  complaintsEval.filter(c => c.sla.overall === 'DUE_SOON').length,
      ncrsBreached:       ncrsEval.filter(n => n.sla.overall === 'BREACHED').length,
      ncrsDueSoon:        ncrsEval.filter(n => n.sla.overall === 'DUE_SOON').length,
    },
  };
}
