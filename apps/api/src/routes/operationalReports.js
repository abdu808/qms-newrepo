/**
 * routes/operationalReports.js — Report Builder تشغيلي (ISO 9.1 / 9.3).
 *
 * المرحلة 5.1 — تقارير الحالات التي تحتاج تدخلاً فورياً.
 * ليست تقارير export خام — تجمع ما يهم مدير الجودة والإدارة:
 *   ▸ overdue-ncrs             — عدم مطابقة تجاوز dueDate
 *   ▸ open-complaints          — شكاوى مفتوحة (+ عمر الشكوى + حالة SLA)
 *   ▸ overdue-complaints       — شكاوى تجاوزت 14 يوماً (ISO 9.1.2)
 *   ▸ docs-due-review          — وثائق منشورة تحتاج مراجعة خلال 30 يوماً
 *   ▸ docs-missing-acks        — وثائق بلا إقرارات كافية
 *   ▸ stuck-workflow           — سجلات عالقة في SUBMITTED/UNDER_REVIEW أكثر من 7 أيام
 *   ▸ kpi-missing-readings     — أهداف بلا قراءة للشهر الحالي
 *   ▸ kpi-red                  — قراءات مؤخّراً حالتها RED
 *   ▸ beneficiaries-due-review — مستفيدون نشطون تجاوزوا 365 يوماً
 *   ▸ suppliers-low-rating     — موردون overallRating < 60
 *
 * كل تقرير يُرجع: { slug, title, asOf, count, items, summary }
 */
import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { NotFound } from '../utils/errors.js';
import { computeComplaintSla } from '../lib/sla.js';
import { activeWhere } from '../lib/dataHelpers.js';

const router = Router();

// ── قاموس التقارير: slug → { title, description, handler } ─────
const REPORTS = {};
const register = (slug, meta) => { REPORTS[slug] = { slug, ...meta }; };

// ── الأدوات المشتركة ──────────────────────────────────────────
const daysAgo = (n) => new Date(Date.now() - n * 86400000);
const daysFromNow = (n) => new Date(Date.now() + n * 86400000);
const NCR_OPEN_STATES = ['OPEN', 'ROOT_CAUSE', 'ACTION_PLANNED', 'IN_PROGRESS', 'VERIFICATION'];
const COMPLAINT_OPEN_STATES = ['NEW', 'UNDER_REVIEW', 'IN_PROGRESS'];

// ══════════════════════════════════════════════════════════════
//  NCR متأخر
// ══════════════════════════════════════════════════════════════
register('overdue-ncrs', {
  title:       'عدم مطابقة متأخرة عن موعد الإغلاق',
  description: 'NCR تجاوزت dueDate وما زالت مفتوحة (ISO 10.2)',
  severity:    'critical',
  async handler() {
    const items = await prisma.nCR.findMany({
      where: activeWhere({
        status:  { in: NCR_OPEN_STATES },
        dueDate: { lt: new Date(), not: null },
      }),
      include: {
        department: { select: { id: true, name: true } },
        assignee:   { select: { id: true, name: true } },
      },
      orderBy: { dueDate: 'asc' },
    });
    const now = Date.now();
    return items.map(n => ({
      id: n.id, code: n.code, title: n.title,
      severity:   n.severity,
      status:     n.status,
      dueDate:    n.dueDate,
      daysOverdue: Math.floor((now - new Date(n.dueDate).getTime()) / 86400000),
      department: n.department?.name || null,
      assignee:   n.assignee?.name   || null,
    }));
  },
});

// ══════════════════════════════════════════════════════════════
//  شكاوى مفتوحة + SLA
// ══════════════════════════════════════════════════════════════
register('open-complaints', {
  title:       'شكاوى مفتوحة حالياً',
  description: 'كل الشكاوى غير المُغلقة مع عمرها وحالة SLA (ISO 9.1.2)',
  severity:    'warning',
  async handler() {
    const items = await prisma.complaint.findMany({
      where: activeWhere({ status: { in: COMPLAINT_OPEN_STATES } }),
      include: { assignee: { select: { id: true, name: true } } },
      orderBy: { receivedAt: 'asc' },
    });
    const now = Date.now();
    return items.map(c => ({
      id: c.id, code: c.code, subject: c.subject,
      source: c.source, channel: c.channel, status: c.status,
      severity: c.severity,
      receivedAt: c.receivedAt,
      ageDays:  Math.floor((now - new Date(c.receivedAt).getTime()) / 86400000),
      assignee: c.assignee?.name || null,
      sla: computeComplaintSla(c),
    }));
  },
});

register('overdue-complaints', {
  title:       'شكاوى متأخرة (>14 يوماً)',
  description: 'شكاوى مفتوحة تجاوز عمرها 14 يوماً (ISO 9.1.2)',
  severity:    'critical',
  async handler() {
    const cutoff = daysAgo(14);
    const items = await prisma.complaint.findMany({
      where: activeWhere({
        status: { in: COMPLAINT_OPEN_STATES },
        receivedAt: { lt: cutoff },
      }),
      include: { assignee: { select: { id: true, name: true } } },
      orderBy: { receivedAt: 'asc' },
    });
    return items.map(c => ({
      id: c.id, code: c.code, subject: c.subject,
      receivedAt: c.receivedAt,
      ageDays:    Math.floor((Date.now() - new Date(c.receivedAt).getTime()) / 86400000),
      daysOverdue: Math.floor((Date.now() - cutoff.getTime()) / 86400000)
                   - Math.floor((Date.now() - new Date(c.receivedAt).getTime()) / 86400000) * -1,
      assignee:   c.assignee?.name || null,
      status:     c.status,
    }));
  },
});

// ══════════════════════════════════════════════════════════════
//  وثائق تحتاج مراجعة
// ══════════════════════════════════════════════════════════════
register('docs-due-review', {
  title:       'وثائق تحتاج مراجعة قريبة',
  description: 'وثائق منشورة reviewDate أقل من 30 يوماً (ISO 7.5.3)',
  severity:    'warning',
  async handler() {
    const items = await prisma.document.findMany({
      where: activeWhere({
        status: 'PUBLISHED',
        reviewDate: { lt: daysFromNow(30), not: null },
      }),
      include: { department: { select: { id: true, name: true } } },
      orderBy: { reviewDate: 'asc' },
    });
    return items.map(d => ({
      id: d.id, code: d.code, title: d.title,
      category: d.category,
      reviewDate: d.reviewDate,
      daysUntilReview: Math.floor(
        (new Date(d.reviewDate).getTime() - Date.now()) / 86400000,
      ),
      department: d.department?.name || null,
    }));
  },
});

// ══════════════════════════════════════════════════════════════
//  workflow عالق
// ══════════════════════════════════════════════════════════════
register('stuck-workflow', {
  title:       'سجلات عالقة في سير الاعتماد',
  description: 'NCR/Risk في SUBMITTED أو UNDER_REVIEW أكثر من 7 أيام',
  severity:    'warning',
  async handler() {
    const cutoff = daysAgo(7);
    const [ncrs, risks] = await Promise.all([
      prisma.nCR.findMany({
        where: activeWhere({
          workflowState: { in: ['SUBMITTED', 'UNDER_REVIEW'] },
          submittedAt:   { lt: cutoff },
        }),
        select: {
          id: true, code: true, title: true, workflowState: true,
          submittedAt: true, reviewedAt: true,
        },
      }),
      prisma.risk.findMany({
        where: activeWhere({
          workflowState: { in: ['SUBMITTED', 'UNDER_REVIEW'] },
          submittedAt:   { lt: cutoff },
        }),
        select: {
          id: true, code: true, title: true, workflowState: true,
          submittedAt: true, reviewedAt: true,
        },
      }),
    ]);
    const mapIt = (entity) => (r) => ({
      entity, id: r.id, code: r.code, title: r.title,
      workflowState: r.workflowState,
      stuckSince:    r.reviewedAt || r.submittedAt,
      daysStuck:     Math.floor(
        (Date.now() - new Date(r.reviewedAt || r.submittedAt).getTime()) / 86400000,
      ),
    });
    return [
      ...ncrs.map(mapIt('NCR')),
      ...risks.map(mapIt('Risk')),
    ].sort((a, b) => b.daysStuck - a.daysStuck);
  },
});

// ══════════════════════════════════════════════════════════════
//  KPI — قراءات مفقودة للشهر الحالي
// ══════════════════════════════════════════════════════════════
register('kpi-missing-readings', {
  title:       'أهداف بلا قراءة للشهر الحالي',
  description: 'أهداف نشطة لم تُدخل قراءتها الشهرية (ISO 9.1)',
  severity:    'warning',
  async handler() {
    const now  = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const objectives = await prisma.objective.findMany({
      where:  activeWhere({ status: { in: ['PLANNED', 'IN_PROGRESS'] } }),
      select: { id: true, code: true, title: true, departmentId: true, ownerId: true,
                department: { select: { name: true } }, owner: { select: { name: true } } },
    });
    const entries = await prisma.kpiEntry.findMany({
      where:  { year, month, objectiveId: { in: objectives.map(o => o.id) } },
      select: { objectiveId: true },
    });
    const entered = new Set(entries.map(e => e.objectiveId));
    return objectives
      .filter(o => !entered.has(o.id))
      .map(o => ({
        id: o.id, code: o.code, title: o.title,
        department: o.department?.name || null,
        owner:      o.owner?.name      || null,
        missingFor: `${year}-${String(month).padStart(2, '0')}`,
      }));
  },
});

// ══════════════════════════════════════════════════════════════
//  مستفيدون — مراجعة متأخرة
// ══════════════════════════════════════════════════════════════
register('beneficiaries-due-review', {
  title:       'مستفيدون نشطون يحتاجون مراجعة (>365 يوماً)',
  description: 'مستفيدون نشطون بلا تقييم منذ أكثر من سنة (ISO 9.1.2 / P-08)',
  severity:    'warning',
  async handler() {
    const cutoff = daysAgo(365);
    const items = await prisma.beneficiary.findMany({
      where: activeWhere({
        status: 'ACTIVE',
        OR: [{ assessedAt: null }, { assessedAt: { lt: cutoff } }],
      }),
      select: {
        id: true, code: true, fullName: true, category: true,
        city: true, assessedAt: true, priorityScore: true,
      },
      orderBy: [{ assessedAt: 'asc' }],
    });
    return items.map(b => ({
      ...b,
      daysSinceAssessment: b.assessedAt
        ? Math.floor((Date.now() - new Date(b.assessedAt).getTime()) / 86400000)
        : null,
    }));
  },
});

// ══════════════════════════════════════════════════════════════
//  موردون منخفضو التقييم
// ══════════════════════════════════════════════════════════════
register('suppliers-low-rating', {
  title:       'موردون بتقييم منخفض (<60)',
  description: 'موردون معتمدون لكن overallRating تحت 60 (ISO 8.4)',
  severity:    'warning',
  async handler() {
    const items = await prisma.supplier.findMany({
      where: activeWhere({
        status:        'APPROVED',
        overallRating: { lt: 60, not: null },
      }),
      select: {
        id: true, code: true, name: true, type: true,
        overallRating: true, contactPerson: true, phone: true,
      },
      orderBy: { overallRating: 'asc' },
    });
    return items;
  },
});

// ══════════════════════════════════════════════════════════════
//  Routes
// ══════════════════════════════════════════════════════════════

/**
 * GET /api/operational-reports/catalog
 * يُرجع قائمة التقارير المتاحة (بلا تنفيذها) — للواجهة.
 */
router.get('/catalog', asyncHandler(async (_req, res) => {
  const catalog = Object.values(REPORTS).map(r => ({
    slug: r.slug, title: r.title, description: r.description, severity: r.severity,
  }));
  res.json({ ok: true, count: catalog.length, catalog });
}));

/**
 * GET /api/operational-reports/:slug
 * ينفّذ تقريراً واحداً ويُرجع العناصر + ملخصاً.
 */
router.get('/:slug', asyncHandler(async (req, res) => {
  const report = REPORTS[req.params.slug];
  if (!report) throw NotFound('تقرير غير معروف');

  const items = await report.handler(req);
  res.json({
    ok:       true,
    slug:     report.slug,
    title:    report.title,
    severity: report.severity,
    asOf:     new Date().toISOString(),
    count:    items.length,
    items,
  });
}));

/**
 * GET /api/operational-reports/all/summary
 * ينفّذ كل التقارير بالتوازي ويُرجع count فقط — للوحة قيادة.
 */
router.get('/all/summary', asyncHandler(async (_req, res) => {
  const entries = Object.values(REPORTS);
  const results = await Promise.all(entries.map(async r => {
    try {
      const items = await r.handler();
      return {
        slug: r.slug, title: r.title, severity: r.severity,
        count: items.length, ok: true,
      };
    } catch (e) {
      return {
        slug: r.slug, title: r.title, severity: r.severity,
        count: 0, ok: false, error: e.message,
      };
    }
  }));
  const totalIssues = results.reduce((s, r) => s + (r.count || 0), 0);
  res.json({
    ok: true,
    asOf: new Date().toISOString(),
    totalIssues,
    reports: results,
  });
}));

export default router;
