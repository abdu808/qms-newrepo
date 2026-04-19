/**
 * تقارير الطباعة — نماذج HTML محسّنة للطباعة (A4 — عربي RTL)
 * ISO 9001:2015 — جمعية البر بصبيا
 */
import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { NotFound } from '../utils/errors.js';
import { activeWhere } from '../lib/dataHelpers.js';

const router = Router();

// ─── مشترك ─────────────────────────────────────────────────────────────────

const PRINT_BASE = `
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Tahoma,Arial,sans-serif;direction:rtl;color:#111;background:#fff;font-size:13px;line-height:1.6}
  .page{max-width:800px;margin:0 auto;padding:24px 28px}
  .header{border-bottom:3px solid #2e8b57;padding-bottom:12px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:flex-start}
  .org-name{font-size:1.2rem;font-weight:800;color:#2e8b57}
  .org-sub{font-size:.75rem;color:#666;margin-top:2px}
  .report-title{font-size:1.4rem;font-weight:700;margin-bottom:16px;color:#1a1a1a;border-right:4px solid #2e8b57;padding-right:10px}
  .meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;background:#f8fffe;border:1px solid #d1fae5;border-radius:8px;padding:12px;margin-bottom:20px}
  .meta-item .label{font-size:.7rem;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:.5px}
  .meta-item .value{font-weight:600;color:#111;margin-top:1px}
  .section{margin-bottom:18px}
  .section-title{font-weight:700;font-size:.95rem;color:#2e8b57;border-bottom:1px solid #d1fae5;padding-bottom:4px;margin-bottom:10px}
  .field{margin-bottom:8px}
  .field-label{font-size:.75rem;color:#6b7280;font-weight:600;margin-bottom:2px}
  .field-value{background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:8px 10px;min-height:32px;white-space:pre-wrap}
  table{width:100%;border-collapse:collapse;margin-bottom:12px;font-size:.85rem}
  th{background:#f0fdf4;color:#166534;font-weight:700;padding:7px 10px;text-align:right;border:1px solid #d1d5db}
  td{padding:6px 10px;border:1px solid #e5e7eb;vertical-align:top}
  tr:nth-child(even) td{background:#fafafa}
  .badge{display:inline-block;padding:2px 10px;border-radius:20px;font-size:.8rem;font-weight:700}
  .badge-green{background:#dcfce7;color:#166534}
  .badge-red{background:#fee2e2;color:#991b1b}
  .badge-amber{background:#fef3c7;color:#92400e}
  .badge-blue{background:#dbeafe;color:#1e40af}
  .badge-gray{background:#f3f4f6;color:#374151}
  .sig-row{display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb}
  .sig-box{text-align:center}
  .sig-line{border-bottom:1px solid #9ca3af;margin-bottom:6px;height:40px}
  .sig-label{font-size:.75rem;color:#6b7280}
  .footer{text-align:center;font-size:.7rem;color:#9ca3af;margin-top:24px;padding-top:8px;border-top:1px solid #f3f4f6}
  @media print{
    body{font-size:11px}
    .page{padding:10px 14px;max-width:100%}
    .no-print{display:none!important}
    @page{size:A4;margin:1.2cm 1.5cm}
  }
</style>`;

function printBtn(title) {
  return `<div class="no-print" style="text-align:center;margin:20px 0">
    <button onclick="window.print()" style="background:#2e8b57;color:#fff;border:none;padding:10px 28px;border-radius:8px;font-size:1rem;cursor:pointer;font-family:inherit">🖨️ طباعة / حفظ PDF</button>
    <button onclick="window.close()" style="background:#f3f4f6;border:none;padding:10px 20px;border-radius:8px;font-size:.9rem;cursor:pointer;margin-right:8px;font-family:inherit">✖ إغلاق</button>
  </div>`;
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' });
}
function val(v, fallback = '—') { return v || fallback; }

// ─── 1. تقرير المراجعة الإدارية (ISO 9.3) ──────────────────────────────────
router.get('/management-review/:id', asyncHandler(async (req, res) => {
  const review = await prisma.managementReview.findUnique({ where: { id: req.params.id } });
  if (!review) throw NotFound('المراجعة غير موجودة');

  const STATUS = { PLANNED: 'مخطط', COMPLETED: 'مكتمل', CANCELLED: 'ملغى' };

  const html = `<!DOCTYPE html><html lang="ar" dir="rtl"><head>${PRINT_BASE}
    <title>مراجعة الإدارة — ${review.code}</title></head>
  <body>
    <div class="page">
      ${printBtn()}
      <div class="header">
        <div>
          <div class="org-name">🌿 جمعية البر بصبيا</div>
          <div class="org-sub">نظام إدارة الجودة — ISO 9001:2015 البند 9.3</div>
        </div>
        <div style="text-align:left">
          <div style="font-size:.8rem;color:#666">رقم المراجعة</div>
          <div style="font-size:1.1rem;font-weight:800;color:#2e8b57">${review.code}</div>
          <div style="font-size:.75rem;color:#9ca3af;margin-top:2px">طُبع: ${formatDate(new Date())}</div>
        </div>
      </div>

      <div class="report-title">محضر مراجعة الإدارة — ${val(review.title)}</div>

      <div class="meta-grid">
        <div class="meta-item"><div class="label">تاريخ الاجتماع</div><div class="value">${formatDate(review.meetingDate)}</div></div>
        <div class="meta-item"><div class="label">الفترة</div><div class="value">${val(review.period)}</div></div>
        <div class="meta-item"><div class="label">الحالة</div><div class="value">${STATUS[review.status] || review.status}</div></div>
        <div class="meta-item"><div class="label">حضور الإدارة العليا</div><div class="value">${review.topManagementPresent ? '✅ نعم' : '❌ لم يُؤكد'}</div></div>
        <div class="meta-item" style="grid-column:span 2"><div class="label">الحضور</div><div class="value">${val(review.attendees)}</div></div>
      </div>

      <!-- المدخلات (ISO 9.3.2) -->
      <div class="section">
        <div class="section-title">📥 مدخلات المراجعة (ISO 9.3.2)</div>
        ${[
          ['تغييرات في السياق الداخلي والخارجي', review.contextChanges],
          ['مراجعة تحقق الأهداف والمؤشرات', review.objectivesReview],
          ['أداء العمليات ومطابقة المنتجات/الخدمات', review.processPerformance],
          ['حالة المطابقة وعدم المطابقة (NCR)', review.conformityStatus],
          ['نتائج التدقيق الداخلي', review.auditResults],
          ['تغذية راجعة من المستفيدين والمتبرعين', review.customerFeedback],
          ['حالة المخاطر والفرص', review.risksStatus],
          ['فرص التحسين المُحددة', review.improvementOpps],
        ].map(([label, value]) => `
        <div class="field">
          <div class="field-label">${label}</div>
          <div class="field-value">${val(value)}</div>
        </div>`).join('')}
      </div>

      <!-- المخرجات (ISO 9.3.3) -->
      <div class="section">
        <div class="section-title">📤 مخرجات المراجعة (ISO 9.3.3)</div>
        ${[
          ['القرارات المتخذة', review.decisions],
          ['الاحتياجات من الموارد', review.resourceNeeds],
          ['إجراءات التحسين المقررة', review.improvementActions],
          ['التغييرات المقترحة على نظام الجودة', review.systemChanges],
        ].map(([label, value]) => `
        <div class="field">
          <div class="field-label">${label}</div>
          <div class="field-value">${val(value)}</div>
        </div>`).join('')}
      </div>

      ${review.minutes ? `<div class="section">
        <div class="section-title">📝 محضر الاجتماع</div>
        <div class="field-value" style="min-height:80px">${review.minutes}</div>
      </div>` : ''}

      ${review.nextReview ? `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px 14px;margin-bottom:16px">
        📅 <strong>تاريخ المراجعة القادمة:</strong> ${formatDate(review.nextReview)}
      </div>` : ''}

      <!-- التوقيعات -->
      <div class="sig-row">
        <div class="sig-box"><div class="sig-line"></div><div class="sig-label">مدير الجودة</div></div>
        <div class="sig-box"><div class="sig-line"></div><div class="sig-label">المدير التنفيذي</div></div>
        <div class="sig-box"><div class="sig-line"></div><div class="sig-label">رئيس مجلس الإدارة</div></div>
      </div>

      <div class="footer">جمعية البر بصبيا — نظام إدارة الجودة ISO 9001:2015 | ${review.code} | ${formatDate(new Date())}</div>
    </div>
  </body></html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
}));

// ─── 2. تقرير عدم المطابقة (ISO 10.2) ─────────────────────────────────────
router.get('/ncr/:id', asyncHandler(async (req, res) => {
  const ncr = await prisma.nCR.findUnique({
    where: { id: req.params.id },
    include: {
      department: true,
      reporter: { select: { name: true } },
      assignee: { select: { name: true } },
    },
  });
  if (!ncr) throw NotFound('عدم المطابقة غير موجود');

  const statusLabel = {
    OPEN: 'مفتوح', ROOT_CAUSE: 'تحليل السبب الجذري',
    ACTION_PLANNED: 'مخطط للإجراء', IN_PROGRESS: 'جارٍ التنفيذ',
    VERIFICATION: 'قيد التحقق', CLOSED: 'مغلق',
  };
  const sevColor = ncr.severity === 'مرتفعة' ? 'badge-red' : ncr.severity === 'متوسطة' ? 'badge-amber' : 'badge-gray';
  const stColor  = ncr.status === 'CLOSED' ? 'badge-green' : ncr.status === 'OPEN' ? 'badge-red' : 'badge-blue';

  const html = `<!DOCTYPE html><html lang="ar" dir="rtl"><head>${PRINT_BASE}
    <title>تقرير عدم مطابقة — ${ncr.code}</title></head>
  <body>
    <div class="page">
      ${printBtn()}
      <div class="header">
        <div>
          <div class="org-name">🌿 جمعية البر بصبيا</div>
          <div class="org-sub">نظام إدارة الجودة — ISO 9001:2015 البند 10.2</div>
        </div>
        <div style="text-align:left">
          <div style="font-size:.8rem;color:#666">رقم عدم المطابقة</div>
          <div style="font-size:1.1rem;font-weight:800;color:#dc2626">${ncr.code}</div>
        </div>
      </div>

      <div class="report-title">تقرير عدم المطابقة والإجراء التصحيحي</div>

      <div class="meta-grid">
        <div class="meta-item"><div class="label">تاريخ الرصد</div><div class="value">${formatDate(ncr.detectedAt)}</div></div>
        <div class="meta-item"><div class="label">الإدارة</div><div class="value">${val(ncr.department?.name)}</div></div>
        <div class="meta-item"><div class="label">المُبلِّغ</div><div class="value">${val(ncr.reporter?.name)}</div></div>
        <div class="meta-item"><div class="label">المكلف بالمعالجة</div><div class="value">${val(ncr.assignee?.name)}</div></div>
        <div class="meta-item"><div class="label">الخطورة</div><div class="value"><span class="badge ${sevColor}">${val(ncr.severity)}</span></div></div>
        <div class="meta-item"><div class="label">الحالة</div><div class="value"><span class="badge ${stColor}">${statusLabel[ncr.status]||ncr.status}</span></div></div>
        <div class="meta-item"><div class="label">تاريخ الاستحقاق</div><div class="value">${formatDate(ncr.dueDate)}</div></div>
        <div class="meta-item"><div class="label">تاريخ التحقق</div><div class="value">${formatDate(ncr.verifiedAt)}</div></div>
      </div>

      <div class="section">
        <div class="section-title">📋 وصف عدم المطابقة</div>
        <div class="field"><div class="field-label">العنوان</div><div class="field-value">${val(ncr.title)}</div></div>
        <div class="field"><div class="field-label">الوصف التفصيلي</div><div class="field-value" style="min-height:60px">${val(ncr.description)}</div></div>
      </div>

      <div class="section">
        <div class="section-title">🔍 تحليل السبب الجذري والإجراءات</div>
        <div class="field"><div class="field-label">السبب الجذري</div><div class="field-value">${val(ncr.rootCause)}</div></div>
        <div class="field"><div class="field-label">التصحيح الفوري</div><div class="field-value">${val(ncr.correction)}</div></div>
        <div class="field"><div class="field-label">الإجراء التصحيحي</div><div class="field-value">${val(ncr.correctiveAction)}</div></div>
      </div>

      <div class="section">
        <div class="section-title">✅ التحقق من الفعالية (ISO 10.2.2)</div>
        <div class="meta-grid">
          <div class="meta-item"><div class="label">الفعالية</div><div class="value">
            ${ncr.effective === true ? '<span class="badge badge-green">✅ فعّال</span>' : ncr.effective === false ? '<span class="badge badge-red">❌ غير فعّال</span>' : '<span class="badge badge-gray">لم يُقيَّم</span>'}
          </div></div>
          <div class="meta-item"><div class="label">تاريخ التحقق</div><div class="value">${formatDate(ncr.verifiedAt)}</div></div>
          <div class="meta-item" style="grid-column:span 2"><div class="label">ملاحظة التحقق</div><div class="value">${val(ncr.verifiedNote)}</div></div>
        </div>
      </div>

      <div class="sig-row">
        <div class="sig-box"><div class="sig-line"></div><div class="sig-label">المُبلِّغ / ${val(ncr.reporter?.name)}</div></div>
        <div class="sig-box"><div class="sig-line"></div><div class="sig-label">المكلف / ${val(ncr.assignee?.name)}</div></div>
        <div class="sig-box"><div class="sig-line"></div><div class="sig-label">مدير الجودة</div></div>
      </div>

      <div class="footer">جمعية البر بصبيا — ISO 9001:2015 | ${ncr.code} | ${formatDate(new Date())}</div>
    </div>
  </body></html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
}));

// ─── 3. تقرير تقييم المورد (ISO 8.4) ──────────────────────────────────────
router.get('/supplier-eval/:id', asyncHandler(async (req, res) => {
  const ev = await prisma.supplierEval.findUnique({
    where: { id: req.params.id },
    include: {
      supplier: true,
      evaluator: { select: { name: true } },
    },
  });
  if (!ev) throw NotFound('التقييم غير موجود');

  let criteria = [];
  try { criteria = Object.entries(JSON.parse(ev.criteriaJson)?.criteria || {}); } catch {}

  const decColor = ev.decision?.includes('مرفوض') ? 'badge-red' : ev.decision?.includes('مشروط') ? 'badge-amber' : 'badge-green';
  const pct = Math.round(ev.percentage || 0);

  const html = `<!DOCTYPE html><html lang="ar" dir="rtl"><head>${PRINT_BASE}
    <title>تقييم المورد — ${ev.code}</title></head>
  <body>
    <div class="page">
      ${printBtn()}
      <div class="header">
        <div>
          <div class="org-name">🌿 جمعية البر بصبيا</div>
          <div class="org-sub">نظام إدارة الجودة — ISO 9001:2015 البند 8.4</div>
        </div>
        <div style="text-align:left">
          <div style="font-size:.8rem;color:#666">رقم التقييم</div>
          <div style="font-size:1rem;font-weight:800;color:#2e8b57">${ev.code}</div>
        </div>
      </div>

      <div class="report-title">تقرير تقييم المورد — ${ev.supplier?.name}</div>

      <div class="meta-grid">
        <div class="meta-item"><div class="label">رمز المورد</div><div class="value">${val(ev.supplier?.code)}</div></div>
        <div class="meta-item"><div class="label">نوع المورد</div><div class="value">${val(ev.supplier?.type)}</div></div>
        <div class="meta-item"><div class="label">المُقيِّم</div><div class="value">${val(ev.evaluator?.name)}</div></div>
        <div class="meta-item"><div class="label">تاريخ التقييم</div><div class="value">${formatDate(ev.evaluatedAt)}</div></div>
        <div class="meta-item"><div class="label">الفترة</div><div class="value">${val(ev.period)}</div></div>
        <div class="meta-item"><div class="label">التقدير</div><div class="value">${val(ev.grade)}</div></div>
      </div>

      <!-- نتيجة إجمالية بارزة -->
      <div style="text-align:center;background:#f0fdf4;border:2px solid #86efac;border-radius:12px;padding:16px;margin-bottom:20px">
        <div style="font-size:.85rem;color:#6b7280">النسبة الإجمالية</div>
        <div style="font-size:3rem;font-weight:900;color:#2e8b57">${pct}%</div>
        <div style="font-size:.9rem;color:#6b7280">من ${ev.maxScore} نقطة — الحصيلة: ${ev.totalScore}</div>
        <div style="margin-top:8px"><span class="badge ${decColor}" style="font-size:1rem;padding:4px 18px">${val(ev.decision)}</span></div>
      </div>

      ${criteria.length ? `
      <div class="section">
        <div class="section-title">📊 تفاصيل معايير التقييم</div>
        <table>
          <thead><tr>
            <th>المعيار</th><th>النوع</th><th>الدرجة</th><th>الأقصى</th><th>النسبة</th><th>المستوى</th><th>ملاحظة</th>
          </tr></thead>
          <tbody>
          ${criteria.map(([key, c]) => {
            const pctC = c.max > 0 ? Math.round((c.score / c.max) * 100) : 0;
            return `<tr>
              <td style="font-weight:600">${c.label || key}</td>
              <td>${c.critical ? '<span class="badge badge-red" style="font-size:.7rem">⚠️ حرج</span>' : '—'}</td>
              <td style="text-align:center;font-weight:700;color:#2e8b57">${c.score}</td>
              <td style="text-align:center;color:#6b7280">${c.max}</td>
              <td style="text-align:center">${pctC}%</td>
              <td>${c.level || '—'}</td>
              <td style="font-size:.8rem;color:#666">${c.note || '—'}</td>
            </tr>`;
          }).join('')}
          </tbody>
        </table>
      </div>` : ''}

      ${ev.notes ? `<div class="section">
        <div class="section-title">📝 ملاحظات المُقيِّم</div>
        <div class="field-value">${ev.notes}</div>
      </div>` : ''}

      <div class="sig-row">
        <div class="sig-box"><div class="sig-line"></div><div class="sig-label">المُقيِّم / ${val(ev.evaluator?.name)}</div></div>
        <div class="sig-box"><div class="sig-line"></div><div class="sig-label">مسؤول المشتريات</div></div>
        <div class="sig-box"><div class="sig-line"></div><div class="sig-label">مدير الجودة</div></div>
      </div>

      <div class="footer">جمعية البر بصبيا — ISO 9001:2015 | ${ev.code} | ${formatDate(new Date())}</div>
    </div>
  </body></html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
}));

// ─── 3b. تقرير المورد: آخر تقييم له (من صفحة الموردين) ────────────────────
router.get('/supplier/:supplierId/latest-eval', asyncHandler(async (req, res) => {
  const ev = await prisma.supplierEval.findFirst({
    where: { supplierId: req.params.supplierId },
    orderBy: { evaluatedAt: 'desc' },
    include: { supplier: true, evaluator: { select: { name: true } } },
  });
  if (!ev) {
    // إذا لم يوجد تقييم، نعرض ورقة بيانات المورد فقط
    const sup = await prisma.supplier.findUnique({ where: { id: req.params.supplierId } });
    if (!sup) throw NotFound('المورد غير موجود');
    const STATUS = { PENDING: 'معلق', APPROVED: 'معتمد', SUSPENDED: 'موقوف', REJECTED: 'مرفوض' };
    const html = `<!DOCTYPE html><html lang="ar" dir="rtl"><head>${PRINT_BASE}<title>بيانات المورد — ${sup.code}</title></head>
    <body><div class="page">
      ${printBtn()}
      <div class="header">
        <div><div class="org-name">🌿 جمعية البر بصبيا</div><div class="org-sub">نظام إدارة الجودة — ISO 9001:2015 البند 8.4</div></div>
        <div style="text-align:left"><div style="font-size:.8rem;color:#666">رمز المورد</div><div style="font-size:1.1rem;font-weight:800;color:#2e8b57">${sup.code}</div></div>
      </div>
      <div class="report-title">بيانات المورد — ${sup.name}</div>
      <div class="meta-grid">
        <div class="meta-item"><div class="label">الاسم</div><div class="value">${val(sup.name)}</div></div>
        <div class="meta-item"><div class="label">النوع</div><div class="value">${val(sup.type)}</div></div>
        <div class="meta-item"><div class="label">الحالة</div><div class="value">${STATUS[sup.status]||sup.status}</div></div>
        <div class="meta-item"><div class="label">رقم السجل التجاري</div><div class="value">${val(sup.crNumber)}</div></div>
        <div class="meta-item"><div class="label">جهة الاتصال</div><div class="value">${val(sup.contactPerson)}</div></div>
        <div class="meta-item"><div class="label">الهاتف</div><div class="value">${val(sup.phone)}</div></div>
        <div class="meta-item" style="grid-column:span 2"><div class="label">ملاحظات</div><div class="value">${val(sup.notes)}</div></div>
      </div>
      <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:12px;text-align:center;color:#92400e;font-weight:600">
        ⚠️ لا يوجد تقييم مسجّل لهذا المورد بعد — أرسل رابط التقييم للمورد من نظام QMS
      </div>
      <div class="footer">جمعية البر بصبيا — ISO 9001:2015 | ${sup.code} | ${formatDate(new Date())}</div>
    </div></body></html>`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  }

  // إعادة استخدام route التقييم مباشرةً
  return res.redirect(`/api/reports/supplier-eval/${ev.id}`);
}));

// ─── 4. التقرير السنوي لهيئة المنشآت غير الربحية (GAAFZA) ─────────────────
router.get('/gaafza', asyncHandler(async (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  const from = new Date(`${year}-01-01`);
  const to   = new Date(`${year}-12-31T23:59:59`);
  const range = { gte: from, lte: to };

  const [
    beneficiaryTotal, beneficiaryByCategory,
    donationTotal, donationByType, donationAmount,
    programs, activePrograms,
    ncrCount, ncrClosed,
    complaintsCount, resolvedComplaints,
    trainingCount, usersActive,
    surveyData,
  ] = await Promise.all([
    prisma.beneficiary.count({ where: { status: 'ACTIVE' } }),
    prisma.beneficiary.groupBy({ by: ['category'], _count: { _all: true } }),
    prisma.donation.count({ where: { receivedAt: range } }),
    prisma.donation.groupBy({ by: ['type'], _count: { _all: true }, where: { receivedAt: range } }),
    prisma.donation.aggregate({ where: { receivedAt: range }, _sum: { amount: true } }),
    prisma.program.count(),
    prisma.program.count({ where: { status: 'ACTIVE' } }),
    prisma.nCR.count({ where: { createdAt: range } }),
    prisma.nCR.count({ where: { createdAt: range, status: 'CLOSED' } }),
    prisma.complaint.count({ where: { receivedAt: range } }),
    prisma.complaint.count({ where: { receivedAt: range, status: { in: ['RESOLVED', 'CLOSED'] } } }),
    prisma.training.count({ where: { date: range } }),
    prisma.user.count({ where: { active: true } }),
    prisma.survey.aggregate({ _sum: { responses: true }, _avg: { avgScore: true } }),
  ]);

  const catLabel = {
    ORPHAN: 'أيتام', WIDOW: 'أرامل', POOR_FAMILY: 'أسر محتاجة',
    DISABLED: 'ذوو إعاقة', ELDERLY: 'مسنون', STUDENT: 'طلاب', OTHER: 'أخرى',
  };
  const typeLabel = { CASH: 'نقدي', IN_KIND: 'عيني', SERVICE: 'خدمة' };

  const html = `<!DOCTYPE html><html lang="ar" dir="rtl"><head>${PRINT_BASE}
    <title>التقرير السنوي — جمعية البر بصبيا ${year}</title></head>
  <body>
    <div class="page">
      ${printBtn()}
      <div class="header">
        <div>
          <div class="org-name">🌿 جمعية البر بصبيا</div>
          <div class="org-sub">التقرير السنوي — هيئة المنشآت غير الربحية (GAAFZA)</div>
        </div>
        <div style="text-align:left">
          <div style="font-size:1.3rem;font-weight:900;color:#2e8b57">${year}</div>
          <div style="font-size:.75rem;color:#9ca3af">طُبع: ${formatDate(new Date())}</div>
        </div>
      </div>

      <div class="report-title">التقرير السنوي للأداء المؤسسي ${year}</div>

      <!-- 1. المستفيدون -->
      <div class="section">
        <div class="section-title">👥 أولاً: المستفيدون</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px;text-align:center">
            <div style="font-size:2rem;font-weight:900;color:#2e8b57">${beneficiaryTotal}</div>
            <div style="font-size:.85rem;color:#6b7280">إجمالي المستفيدين النشطين</div>
          </div>
          <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px;text-align:center">
            <div style="font-size:2rem;font-weight:900;color:#1d4ed8">${activePrograms}/${programs}</div>
            <div style="font-size:.85rem;color:#6b7280">البرامج النشطة / الإجمالي</div>
          </div>
        </div>
        <table>
          <thead><tr><th>فئة المستفيدين</th><th>العدد</th></tr></thead>
          <tbody>
          ${beneficiaryByCategory.map(b => `<tr><td>${catLabel[b.category] || b.category}</td><td style="text-align:center;font-weight:700">${b._count._all}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>

      <!-- 2. التبرعات -->
      <div class="section">
        <div class="section-title">🎁 ثانياً: التبرعات المستلمة (${year})</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
          <div style="background:#fefce8;border:1px solid #fde68a;border-radius:8px;padding:12px;text-align:center">
            <div style="font-size:2rem;font-weight:900;color:#92400e">${donationTotal}</div>
            <div style="font-size:.85rem;color:#6b7280">إجمالي التبرعات المستلمة</div>
          </div>
          <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px;text-align:center">
            <div style="font-size:1.6rem;font-weight:900;color:#991b1b">${donationAmount._sum.amount ? Number(donationAmount._sum.amount).toLocaleString('ar-SA') + ' ريال' : '—'}</div>
            <div style="font-size:.85rem;color:#6b7280">إجمالي التبرعات النقدية</div>
          </div>
        </div>
        <table>
          <thead><tr><th>نوع التبرع</th><th>العدد</th></tr></thead>
          <tbody>
          ${donationByType.map(d => `<tr><td>${typeLabel[d.type] || d.type}</td><td style="text-align:center;font-weight:700">${d._count._all}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>

      <!-- 3. الجودة -->
      <div class="section">
        <div class="section-title">🏅 ثالثاً: مؤشرات الجودة</div>
        <table>
          <thead><tr><th>المؤشر</th><th>القيمة</th><th>الملاحظة</th></tr></thead>
          <tbody>
            <tr><td>حالات عدم المطابقة (NCR)</td><td style="text-align:center;font-weight:700">${ncrCount}</td><td>مغلق: ${ncrClosed} (${ncrCount ? Math.round(ncrClosed/ncrCount*100) : 0}%)</td></tr>
            <tr><td>الشكاوى المستلمة</td><td style="text-align:center;font-weight:700">${complaintsCount}</td><td>محلولة: ${resolvedComplaints} (${complaintsCount ? Math.round(resolvedComplaints/complaintsCount*100) : 0}%)</td></tr>
            <tr><td>جلسات التدريب المنفذة</td><td style="text-align:center;font-weight:700">${trainingCount}</td><td></td></tr>
            <tr><td>الكوادر البشرية (موظفون نشطون)</td><td style="text-align:center;font-weight:700">${usersActive}</td><td></td></tr>
            <tr><td>متوسط رضا المستفيدين</td><td style="text-align:center;font-weight:700">${surveyData._avg.avgScore ? (Math.round(surveyData._avg.avgScore*10)/10) + '/5' : '—'}</td><td>من ${surveyData._sum.responses||0} استجابة</td></tr>
          </tbody>
        </table>
      </div>

      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin-bottom:16px;font-size:.8rem;color:#6b7280">
        <strong>إقرار:</strong> يُقرّ مجلس إدارة جمعية البر بصبيا بصحة المعلومات الواردة في هذا التقرير للعام ${year}، ويُؤكد أن الجمعية تعمل وفق المتطلبات النظامية لهيئة المنشآت غير الربحية.
      </div>

      <div class="sig-row">
        <div class="sig-box"><div class="sig-line"></div><div class="sig-label">رئيس مجلس الإدارة</div></div>
        <div class="sig-box"><div class="sig-line"></div><div class="sig-label">المدير التنفيذي</div></div>
        <div class="sig-box"><div class="sig-line"></div><div class="sig-label">مدير الجودة والامتثال</div></div>
      </div>

      <div class="footer">جمعية البر بصبيا — التقرير السنوي ${year} | هيئة المنشآت غير الربحية</div>
    </div>
  </body></html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
}));

// ─── 5. التقرير التحليلي للشكاوى (ISO 9.1.2) ───────────────────────────────
router.get('/complaints-analytics', asyncHandler(async (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  const from = req.query.from ? new Date(req.query.from) : new Date(`${year}-01-01`);
  const to   = req.query.to   ? new Date(req.query.to)   : new Date(`${year}-12-31T23:59:59`);
  const range = { gte: from, lte: to };

  const all = await prisma.complaint.findMany({
    where: activeWhere({ receivedAt: range }),
    select: { source: true, channel: true, severity: true, status: true, receivedAt: true, resolvedAt: true, subject: true, code: true, satisfaction: true, relatedNcrId: true },
  });

  const SOURCE = { BENEFICIARY: 'مستفيد', DONOR: 'متبرع', VOLUNTEER: 'متطوع', EMPLOYEE: 'موظف', PARTNER: 'شريك', OTHER: 'أخرى' };
  const CHANNEL = { PHONE: 'هاتف', EMAIL: 'بريد', WEBSITE: 'موقع', IN_PERSON: 'حضور', WHATSAPP: 'واتساب', SOCIAL: 'سوشيال', OTHER: 'أخرى' };
  const STATUS = { NEW: 'جديدة', UNDER_REVIEW: 'قيد المراجعة', IN_PROGRESS: 'قيد المعالجة', RESOLVED: 'محلولة', CLOSED: 'مغلقة', REJECTED: 'مرفوضة' };

  const countBy = (arr, key, labels) => {
    const m = new Map();
    for (const r of arr) m.set(r[key], (m.get(r[key]) || 0) + 1);
    return Array.from(m.entries()).map(([k, v]) => ({ key: k, label: labels[k] || k, count: v, pct: arr.length ? Math.round(v*100/arr.length) : 0 }))
      .sort((a, b) => b.count - a.count);
  };

  const bySource = countBy(all, 'source', SOURCE);
  const byChannel = countBy(all, 'channel', CHANNEL);
  const bySeverity = countBy(all, 'severity', {});
  const byStatus = countBy(all, 'status', STATUS);

  // متوسط زمن المعالجة (أيام) — للشكاوى المحلولة/المغلقة فقط
  const resolved = all.filter(r => r.resolvedAt && r.receivedAt);
  const avgDays = resolved.length ? Math.round(resolved.reduce((a, r) => a + (new Date(r.resolvedAt) - new Date(r.receivedAt)) / 86400000, 0) / resolved.length * 10) / 10 : null;

  // توزيع شهري
  const monthly = new Array(12).fill(0).map((_, i) => ({ month: i+1, count: 0, resolved: 0 }));
  for (const r of all) {
    const m = new Date(r.receivedAt).getMonth();
    if (new Date(r.receivedAt).getFullYear() === year) monthly[m].count++;
    if (r.resolvedAt && new Date(r.resolvedAt).getFullYear() === year) monthly[new Date(r.resolvedAt).getMonth()].resolved++;
  }
  const monthNames = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  const maxMonth = Math.max(1, ...monthly.map(m => m.count));

  const resolvedCount = all.filter(r => r.status === 'RESOLVED' || r.status === 'CLOSED').length;
  const openCount = all.length - resolvedCount;
  const linkedNcr = all.filter(r => r.relatedNcrId).length;
  const avgSatisfaction = (() => {
    const s = all.filter(r => Number.isFinite(r.satisfaction)).map(r => r.satisfaction);
    return s.length ? Math.round(s.reduce((a, b) => a + b, 0) / s.length * 10) / 10 : null;
  })();

  const bar = (pct, color = '#2e8b57') => `<div style="background:#f3f4f6;border-radius:4px;height:14px;position:relative;overflow:hidden"><div style="background:${color};height:100%;width:${pct}%;border-radius:4px"></div></div>`;

  const html = `<!DOCTYPE html><html lang="ar" dir="rtl"><head>${PRINT_BASE}
    <title>التقرير التحليلي للشكاوى — ${year}</title></head>
  <body>
    <div class="page">
      ${printBtn()}
      <div class="header">
        <div><div class="org-name">🌿 جمعية البر بصبيا</div><div class="org-sub">نظام إدارة الجودة — ISO 9001:2015 البند 9.1.2</div></div>
        <div style="text-align:left"><div style="font-size:1.3rem;font-weight:900;color:#2e8b57">${year}</div><div style="font-size:.75rem;color:#9ca3af">طُبع: ${formatDate(new Date())}</div></div>
      </div>

      <div class="report-title">التقرير التحليلي للشكاوى</div>

      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:18px">
        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px;text-align:center">
          <div style="font-size:1.8rem;font-weight:900;color:#1e40af">${all.length}</div>
          <div style="font-size:.75rem;color:#6b7280">إجمالي الشكاوى</div>
        </div>
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px;text-align:center">
          <div style="font-size:1.8rem;font-weight:900;color:#166534">${resolvedCount}</div>
          <div style="font-size:.75rem;color:#6b7280">محلولة/مغلقة (${all.length ? Math.round(resolvedCount*100/all.length) : 0}%)</div>
        </div>
        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px;text-align:center">
          <div style="font-size:1.8rem;font-weight:900;color:#991b1b">${openCount}</div>
          <div style="font-size:.75rem;color:#6b7280">مفتوحة</div>
        </div>
        <div style="background:#fefce8;border:1px solid #fde68a;border-radius:8px;padding:12px;text-align:center">
          <div style="font-size:1.8rem;font-weight:900;color:#92400e">${avgDays ?? '—'}</div>
          <div style="font-size:.75rem;color:#6b7280">متوسط زمن المعالجة (يوم)</div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">📊 التوزيع حسب المصدر</div>
        <table><thead><tr><th>المصدر</th><th style="width:80px">العدد</th><th style="width:60px">%</th><th>الرسم</th></tr></thead>
        <tbody>${bySource.map(r => `<tr><td>${r.label}</td><td style="text-align:center;font-weight:700">${r.count}</td><td style="text-align:center">${r.pct}%</td><td>${bar(r.pct)}</td></tr>`).join('') || '<tr><td colspan="4" style="text-align:center;color:#9ca3af">لا بيانات</td></tr>'}</tbody></table>
      </div>

      <div class="section">
        <div class="section-title">📞 التوزيع حسب القناة</div>
        <table><thead><tr><th>القناة</th><th style="width:80px">العدد</th><th style="width:60px">%</th><th>الرسم</th></tr></thead>
        <tbody>${byChannel.map(r => `<tr><td>${r.label}</td><td style="text-align:center;font-weight:700">${r.count}</td><td style="text-align:center">${r.pct}%</td><td>${bar(r.pct, '#3b82f6')}</td></tr>`).join('') || '<tr><td colspan="4" style="text-align:center;color:#9ca3af">لا بيانات</td></tr>'}</tbody></table>
      </div>

      <div class="section">
        <div class="section-title">⚠️ التوزيع حسب الخطورة</div>
        <table><thead><tr><th>الخطورة</th><th style="width:80px">العدد</th><th style="width:60px">%</th><th>الرسم</th></tr></thead>
        <tbody>${bySeverity.map(r => {
          const color = r.key === 'مرتفعة' ? '#dc2626' : r.key === 'متوسطة' ? '#f59e0b' : '#6b7280';
          return `<tr><td>${r.label}</td><td style="text-align:center;font-weight:700">${r.count}</td><td style="text-align:center">${r.pct}%</td><td>${bar(r.pct, color)}</td></tr>`;
        }).join('') || '<tr><td colspan="4" style="text-align:center;color:#9ca3af">لا بيانات</td></tr>'}</tbody></table>
      </div>

      <div class="section">
        <div class="section-title">📅 التوزيع الشهري</div>
        <table><thead><tr><th>الشهر</th><th>الشكاوى الواردة</th><th>الشكاوى المحلولة</th><th>الرسم</th></tr></thead>
        <tbody>${monthly.map(m => `<tr><td>${monthNames[m.month-1]}</td><td style="text-align:center">${m.count}</td><td style="text-align:center">${m.resolved}</td><td>${bar(Math.round(m.count*100/maxMonth), '#8b5cf6')}</td></tr>`).join('')}</tbody></table>
      </div>

      <div class="section">
        <div class="section-title">📈 مؤشرات إضافية</div>
        <table><tbody>
          <tr><th style="width:40%">الشكاوى المرتبطة بعدم مطابقة (NCR)</th><td>${linkedNcr} (${all.length ? Math.round(linkedNcr*100/all.length) : 0}%)</td></tr>
          <tr><th>متوسط رضا الشاكين</th><td>${avgSatisfaction ? avgSatisfaction + '/5' : '—'}</td></tr>
          <tr><th>نسبة الحل</th><td>${all.length ? Math.round(resolvedCount*100/all.length) : 0}%</td></tr>
          <tr><th>الحالات المتأخرة (لم تُحل خلال 7 أيام)</th><td>${all.filter(r => !r.resolvedAt && (Date.now() - new Date(r.receivedAt).getTime()) > 7*86400000).length}</td></tr>
        </tbody></table>
      </div>

      <div class="sig-row">
        <div class="sig-box"><div class="sig-line"></div><div class="sig-label">مسؤول الشكاوى</div></div>
        <div class="sig-box"><div class="sig-line"></div><div class="sig-label">مدير الجودة</div></div>
        <div class="sig-box"><div class="sig-line"></div><div class="sig-label">المدير التنفيذي</div></div>
      </div>

      <div class="footer">جمعية البر بصبيا — التقرير التحليلي للشكاوى ${year} | ISO 9001:2015 §9.1.2</div>
    </div>
  </body></html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
}));

// ─── 6. التقرير التحليلي لعدم المطابقات (باريتو — ISO 10.2) ───────────────
router.get('/ncr-analytics', asyncHandler(async (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  const from = req.query.from ? new Date(req.query.from) : new Date(`${year}-01-01`);
  const to   = req.query.to   ? new Date(req.query.to)   : new Date(`${year}-12-31T23:59:59`);
  const range = { gte: from, lte: to };

  const all = await prisma.nCR.findMany({
    where: activeWhere({ createdAt: range }),
    include: { department: { select: { name: true } } },
  });

  const total = all.length;
  const byStatus = {};
  const bySeverity = {};
  const byDept = {};
  const byRoot = {};
  let closedCount = 0, effectiveCount = 0, evaluatedCount = 0;
  let totalCloseDays = 0, closedWithTime = 0;

  for (const n of all) {
    byStatus[n.status] = (byStatus[n.status] || 0) + 1;
    bySeverity[n.severity || 'غير محدد'] = (bySeverity[n.severity || 'غير محدد'] || 0) + 1;
    const dept = n.department?.name || 'غير محدد';
    byDept[dept] = (byDept[dept] || 0) + 1;
    const root = (n.rootCause || '').trim() || 'لم يُحدَّد';
    const rootKey = root.length > 60 ? root.slice(0, 60) + '…' : root;
    byRoot[rootKey] = (byRoot[rootKey] || 0) + 1;
    if (n.status === 'CLOSED') {
      closedCount++;
      if (n.verifiedAt) { totalCloseDays += (new Date(n.verifiedAt) - new Date(n.detectedAt)) / 86400000; closedWithTime++; }
    }
    if (n.effective !== null && n.effective !== undefined) {
      evaluatedCount++;
      if (n.effective) effectiveCount++;
    }
  }

  const avgCloseDays = closedWithTime ? Math.round(totalCloseDays / closedWithTime * 10) / 10 : null;
  const effectiveRate = evaluatedCount ? Math.round(effectiveCount * 100 / evaluatedCount) : null;

  // تحليل باريتو للأسباب الجذرية (80/20)
  const rootSorted = Object.entries(byRoot).sort((a, b) => b[1] - a[1]);
  let cumulative = 0;
  const paretoData = rootSorted.map(([cause, count]) => {
    cumulative += count;
    return { cause, count, pct: Math.round(count*100/total), cumPct: Math.round(cumulative*100/total) };
  });

  const STATUS_LABEL = { OPEN: 'مفتوح', ROOT_CAUSE: 'تحليل الجذر', ACTION_PLANNED: 'مخطط', IN_PROGRESS: 'جارٍ', VERIFICATION: 'قيد التحقق', CLOSED: 'مغلق' };
  const bar = (pct, color = '#2e8b57') => `<div style="background:#f3f4f6;border-radius:4px;height:14px;overflow:hidden"><div style="background:${color};height:100%;width:${pct}%"></div></div>`;

  const html = `<!DOCTYPE html><html lang="ar" dir="rtl"><head>${PRINT_BASE}
    <title>التقرير التحليلي لعدم المطابقات — ${year}</title></head>
  <body>
    <div class="page">
      ${printBtn()}
      <div class="header">
        <div><div class="org-name">🌿 جمعية البر بصبيا</div><div class="org-sub">نظام إدارة الجودة — ISO 9001:2015 البند 10.2</div></div>
        <div style="text-align:left"><div style="font-size:1.3rem;font-weight:900;color:#dc2626">${year}</div><div style="font-size:.75rem;color:#9ca3af">طُبع: ${formatDate(new Date())}</div></div>
      </div>

      <div class="report-title">التقرير التحليلي لعدم المطابقات — تحليل باريتو</div>

      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:18px">
        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px;text-align:center">
          <div style="font-size:1.8rem;font-weight:900;color:#991b1b">${total}</div>
          <div style="font-size:.75rem;color:#6b7280">إجمالي NCR</div>
        </div>
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px;text-align:center">
          <div style="font-size:1.8rem;font-weight:900;color:#166534">${closedCount}</div>
          <div style="font-size:.75rem;color:#6b7280">مغلقة (${total ? Math.round(closedCount*100/total) : 0}%)</div>
        </div>
        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px;text-align:center">
          <div style="font-size:1.8rem;font-weight:900;color:#1e40af">${avgCloseDays ?? '—'}</div>
          <div style="font-size:.75rem;color:#6b7280">متوسط زمن الإغلاق (يوم)</div>
        </div>
        <div style="background:#fefce8;border:1px solid #fde68a;border-radius:8px;padding:12px;text-align:center">
          <div style="font-size:1.8rem;font-weight:900;color:#92400e">${effectiveRate !== null ? effectiveRate + '%' : '—'}</div>
          <div style="font-size:.75rem;color:#6b7280">نسبة فعالية الإجراءات</div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">📊 تحليل باريتو للأسباب الجذرية (80/20)</div>
        <p style="font-size:.8rem;color:#6b7280;margin-bottom:8px">القاعدة: 80% من عدم المطابقات تنجم عن 20% من الأسباب — التركيز عليها يضاعف أثر التحسين.</p>
        <table><thead><tr><th>السبب الجذري</th><th style="width:70px">العدد</th><th style="width:60px">%</th><th style="width:80px">التراكمي</th><th>الرسم</th></tr></thead>
        <tbody>${paretoData.slice(0, 15).map(p => {
          const color = p.cumPct <= 80 ? '#dc2626' : '#9ca3af';
          return `<tr><td style="font-size:.82rem">${p.cause}</td><td style="text-align:center;font-weight:700">${p.count}</td><td style="text-align:center">${p.pct}%</td><td style="text-align:center;font-weight:600;color:${p.cumPct <= 80 ? '#dc2626' : '#166534'}">${p.cumPct}%</td><td>${bar(p.pct, color)}</td></tr>`;
        }).join('') || '<tr><td colspan="5" style="text-align:center;color:#9ca3af">لا بيانات</td></tr>'}</tbody></table>
      </div>

      <div class="section">
        <div class="section-title">🏢 التوزيع حسب الإدارة</div>
        <table><thead><tr><th>الإدارة</th><th style="width:80px">العدد</th><th style="width:60px">%</th><th>الرسم</th></tr></thead>
        <tbody>${Object.entries(byDept).sort((a,b) => b[1]-a[1]).map(([d, c]) => `<tr><td>${d}</td><td style="text-align:center;font-weight:700">${c}</td><td style="text-align:center">${total ? Math.round(c*100/total) : 0}%</td><td>${bar(total ? Math.round(c*100/total) : 0, '#8b5cf6')}</td></tr>`).join('') || '<tr><td colspan="4" style="text-align:center;color:#9ca3af">لا بيانات</td></tr>'}</tbody></table>
      </div>

      <div class="section">
        <div class="section-title">⚠️ التوزيع حسب الخطورة</div>
        <table><thead><tr><th>الخطورة</th><th style="width:80px">العدد</th><th style="width:60px">%</th></tr></thead>
        <tbody>${Object.entries(bySeverity).sort((a,b) => b[1]-a[1]).map(([s, c]) => `<tr><td>${s}</td><td style="text-align:center;font-weight:700">${c}</td><td style="text-align:center">${total ? Math.round(c*100/total) : 0}%</td></tr>`).join('') || '<tr><td colspan="3" style="text-align:center;color:#9ca3af">لا بيانات</td></tr>'}</tbody></table>
      </div>

      <div class="section">
        <div class="section-title">📋 التوزيع حسب الحالة</div>
        <table><thead><tr><th>الحالة</th><th style="width:80px">العدد</th><th style="width:60px">%</th></tr></thead>
        <tbody>${Object.entries(byStatus).map(([s, c]) => `<tr><td>${STATUS_LABEL[s] || s}</td><td style="text-align:center;font-weight:700">${c}</td><td style="text-align:center">${total ? Math.round(c*100/total) : 0}%</td></tr>`).join('') || '<tr><td colspan="3" style="text-align:center;color:#9ca3af">لا بيانات</td></tr>'}</tbody></table>
      </div>

      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin-bottom:16px;font-size:.82rem;color:#374151">
        <strong>🎯 التوصية:</strong> التركيز على أعلى ${Math.min(3, paretoData.length)} أسباب جذرية — معالجتها تغطي نحو ${paretoData.slice(0,3).reduce((a,p) => a+p.pct, 0)}% من الحالات.
      </div>

      <div class="sig-row">
        <div class="sig-box"><div class="sig-line"></div><div class="sig-label">مدير الجودة</div></div>
        <div class="sig-box"><div class="sig-line"></div><div class="sig-label">المدير التنفيذي</div></div>
        <div class="sig-box"><div class="sig-line"></div><div class="sig-label">ممثل الإدارة</div></div>
      </div>

      <div class="footer">جمعية البر بصبيا — التقرير التحليلي لـ NCR ${year} | ISO 9001:2015 §10.2</div>
    </div>
  </body></html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
}));

// ─── 7. سجل المخاطر (ISO 6.1) ──────────────────────────────────────────────
router.get('/risk-register', asyncHandler(async (req, res) => {
  const risks = await prisma.risk.findMany({
    where: activeWhere(),
    include: { department: { select: { name: true } }, owner: { select: { name: true } } },
    orderBy: [{ score: 'desc' }, { createdAt: 'desc' }],
  });

  const LEVEL_COLOR = { 'حرج': '#991b1b', 'مرتفع': '#dc2626', 'متوسط': '#f59e0b', 'منخفض': '#16a34a' };
  const STATUS = { IDENTIFIED: 'محدّد', ASSESSED: 'مُقيَّم', TREATED: 'قيد المعالجة', MONITORED: 'مُراقب', ACCEPTED: 'مقبول', CLOSED: 'مغلق' };

  const byLevel = {};
  for (const r of risks) byLevel[r.level] = (byLevel[r.level] || 0) + 1;

  // خريطة حرارة 5×5
  const heat = {};
  for (let p = 1; p <= 5; p++) { heat[p] = {}; for (let i = 1; i <= 5; i++) heat[p][i] = 0; }
  for (const r of risks) if (r.probability >= 1 && r.probability <= 5 && r.impact >= 1 && r.impact <= 5) heat[r.probability][r.impact]++;

  const heatColor = (p, i) => {
    const s = p * i;
    if (s >= 15) return '#991b1b';
    if (s >= 10) return '#dc2626';
    if (s >= 6) return '#f59e0b';
    if (s >= 3) return '#facc15';
    return '#22c55e';
  };

  const critical = risks.filter(r => r.level === 'حرج' || r.level === 'مرتفع');

  const html = `<!DOCTYPE html><html lang="ar" dir="rtl"><head>${PRINT_BASE}
    <title>سجل المخاطر — جمعية البر بصبيا</title></head>
  <body>
    <div class="page">
      ${printBtn()}
      <div class="header">
        <div><div class="org-name">🌿 جمعية البر بصبيا</div><div class="org-sub">نظام إدارة الجودة — ISO 9001:2015 البند 6.1</div></div>
        <div style="text-align:left"><div style="font-size:.8rem;color:#666">تاريخ الإصدار</div><div style="font-size:1rem;font-weight:800;color:#2e8b57">${formatDate(new Date())}</div></div>
      </div>

      <div class="report-title">سجل المخاطر والفرص</div>

      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:18px">
        ${['حرج', 'مرتفع', 'متوسط', 'منخفض'].map(lvl => `
        <div style="background:#fff;border:2px solid ${LEVEL_COLOR[lvl]};border-radius:8px;padding:10px;text-align:center">
          <div style="font-size:1.6rem;font-weight:900;color:${LEVEL_COLOR[lvl]}">${byLevel[lvl]||0}</div>
          <div style="font-size:.75rem;color:#6b7280">${lvl}</div>
        </div>`).join('')}
      </div>

      <div class="section">
        <div class="section-title">🌡️ خريطة الحرارة (الاحتمالية × الأثر)</div>
        <table style="max-width:450px;margin:0 auto">
          <thead><tr><th style="background:#f3f4f6">الاحتمالية \\ الأثر</th>${[1,2,3,4,5].map(i => `<th style="text-align:center">${i}</th>`).join('')}</tr></thead>
          <tbody>${[5,4,3,2,1].map(p => `
            <tr><th>${p}</th>${[1,2,3,4,5].map(i => {
              const c = heat[p][i];
              return `<td style="background:${heatColor(p,i)};color:#fff;text-align:center;font-weight:800;font-size:1rem;width:50px;height:42px">${c||''}</td>`;
            }).join('')}</tr>`).join('')}
          </tbody>
        </table>
        <div style="text-align:center;font-size:.75rem;color:#6b7280;margin-top:6px">الأرقام تمثّل عدد المخاطر في كل خلية</div>
      </div>

      ${critical.length ? `
      <div class="section">
        <div class="section-title">🚨 المخاطر الحرجة/المرتفعة (${critical.length})</div>
        <table>
          <thead><tr><th>الرمز</th><th>العنوان</th><th>الإدارة</th><th>المسؤول</th><th>P</th><th>I</th><th>الدرجة</th><th>المستوى</th><th>المعالجة</th></tr></thead>
          <tbody>${critical.map(r => `<tr>
            <td style="font-weight:700;color:#2e8b57">${r.code}</td>
            <td style="font-size:.82rem">${val(r.title)}</td>
            <td style="font-size:.8rem">${val(r.department?.name)}</td>
            <td style="font-size:.8rem">${val(r.owner?.name)}</td>
            <td style="text-align:center">${r.probability}</td>
            <td style="text-align:center">${r.impact}</td>
            <td style="text-align:center;font-weight:800">${r.score}</td>
            <td style="text-align:center"><span class="badge" style="background:${LEVEL_COLOR[r.level]||'#6b7280'};color:#fff">${r.level}</span></td>
            <td style="font-size:.78rem">${val(r.treatmentType)}</td>
          </tr>`).join('')}</tbody>
        </table>
      </div>` : ''}

      <div class="section">
        <div class="section-title">📋 السجل الكامل (${risks.length})</div>
        <table>
          <thead><tr><th>الرمز</th><th>النوع</th><th>العنوان</th><th>الإدارة</th><th>P×I</th><th>الدرجة</th><th>المستوى</th><th>الحالة</th></tr></thead>
          <tbody>${risks.map(r => `<tr>
            <td style="font-weight:700;font-size:.78rem">${r.code}</td>
            <td style="font-size:.75rem">${r.type === 'OPPORTUNITY' ? 'فرصة' : 'خطر'}</td>
            <td style="font-size:.8rem">${val(r.title)}</td>
            <td style="font-size:.78rem">${val(r.department?.name)}</td>
            <td style="text-align:center;font-size:.78rem">${r.probability}×${r.impact}</td>
            <td style="text-align:center;font-weight:700">${r.score}</td>
            <td style="text-align:center;font-size:.75rem"><span class="badge" style="background:${LEVEL_COLOR[r.level]||'#6b7280'};color:#fff">${r.level}</span></td>
            <td style="text-align:center;font-size:.75rem">${STATUS[r.status]||r.status}</td>
          </tr>`).join('') || '<tr><td colspan="8" style="text-align:center;color:#9ca3af">لا توجد مخاطر مسجّلة</td></tr>'}</tbody>
        </table>
      </div>

      <div class="sig-row">
        <div class="sig-box"><div class="sig-line"></div><div class="sig-label">مدير الجودة</div></div>
        <div class="sig-box"><div class="sig-line"></div><div class="sig-label">المدير التنفيذي</div></div>
        <div class="sig-box"><div class="sig-line"></div><div class="sig-label">رئيس مجلس الإدارة</div></div>
      </div>

      <div class="footer">جمعية البر بصبيا — سجل المخاطر | ISO 9001:2015 §6.1 | ${formatDate(new Date())}</div>
    </div>
  </body></html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
}));

// ─── 8. مركز التقارير — فهرس HTML تفاعلي ──────────────────────────────────
router.get('/hub', asyncHandler(async (req, res) => {
  const year = new Date().getFullYear();
  const [ncrCount, complaintsCount, risksCount, reviewsCount, supplierEvalsCount, surveysCount] = await Promise.all([
    prisma.nCR.count({ where: activeWhere() }).catch(() => 0),
    prisma.complaint.count({ where: activeWhere() }).catch(() => 0),
    prisma.risk.count({ where: activeWhere() }).catch(() => 0),
    prisma.managementReview.count().catch(() => 0),
    prisma.supplierEval.count().catch(() => 0),
    prisma.survey.count().catch(() => 0),
  ]);

  const cards = [
    { icon: '📊', title: 'التقرير التحليلي للشكاوى', desc: `تحليل ${complaintsCount} شكوى حسب المصدر/القناة/الخطورة + متوسط زمن المعالجة`, url: `/api/reports/complaints-analytics?year=${year}`, color: '#3b82f6' },
    { icon: '🔍', title: 'التقرير التحليلي لعدم المطابقات', desc: `تحليل باريتو لأسباب ${ncrCount} NCR + نسبة الفعالية`, url: `/api/reports/ncr-analytics?year=${year}`, color: '#dc2626' },
    { icon: '⚠️', title: 'سجل المخاطر', desc: `${risksCount} خطر/فرصة + خريطة حرارة + المخاطر الحرجة`, url: `/api/reports/risk-register`, color: '#f59e0b' },
    { icon: '🏛️', title: 'التقرير السنوي (GAAFZA)', desc: `تقرير الأداء المؤسسي الشامل لعام ${year}`, url: `/api/reports/gaafza?year=${year}`, color: '#2e8b57' },
    { icon: '📝', title: 'مراجعات الإدارة', desc: `${reviewsCount} محضر مراجعة (يُطبع من صفحة المراجعات)`, url: `/#managementReview`, color: '#8b5cf6' },
    { icon: '🏭', title: 'تقييمات الموردين', desc: `${supplierEvalsCount} تقييم (يُطبع من صفحة الموردين)`, url: `/#suppliers`, color: '#0ea5e9' },
    { icon: '⭐', title: 'الاستبيانات', desc: `${surveysCount} استبيان (التحليل من صفحة الاستبيانات)`, url: `/#surveys`, color: '#f97316' },
  ];

  const html = `<!DOCTYPE html><html lang="ar" dir="rtl"><head>${PRINT_BASE}
    <title>مركز التقارير — جمعية البر بصبيا</title>
    <style>
      .hub{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px;margin-top:18px}
      .hub-card{border:1.5px solid #e5e7eb;border-radius:12px;padding:16px;background:#fff;transition:.15s;text-decoration:none;color:inherit;display:flex;flex-direction:column;gap:6px}
      .hub-card:hover{box-shadow:0 6px 20px rgba(0,0,0,.08);transform:translateY(-2px)}
      .hub-card .ic{font-size:2rem}
      .hub-card .t{font-weight:800;font-size:1.05rem}
      .hub-card .d{font-size:.82rem;color:#6b7280;line-height:1.5}
      .hub-card .b{margin-top:8px;font-size:.8rem;color:#2e8b57;font-weight:700}
    </style></head>
  <body>
    <div class="page">
      <div class="header">
        <div><div class="org-name">🌿 جمعية البر بصبيا</div><div class="org-sub">مركز التقارير — جميع التقارير في مكان واحد</div></div>
        <div style="text-align:left"><button onclick="window.close()" style="background:#f3f4f6;border:none;padding:8px 16px;border-radius:6px;cursor:pointer">✖ إغلاق</button></div>
      </div>

      <div class="report-title">📚 مركز التقارير</div>
      <p style="color:#6b7280;font-size:.9rem">اختر التقرير الذي تريد عرضه أو طباعته. جميع التقارير تُفتح في نافذة طباعة جاهزة.</p>

      <div class="hub">
        ${cards.map(c => `<a class="hub-card" href="${c.url}" target="_blank">
          <div class="ic">${c.icon}</div>
          <div class="t" style="color:${c.color}">${c.title}</div>
          <div class="d">${c.desc}</div>
          <div class="b">فتح التقرير ←</div>
        </a>`).join('')}
      </div>

      <div class="footer">جمعية البر بصبيا — مركز التقارير | نظام إدارة الجودة ISO 9001:2015</div>
    </div>
  </body></html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
}));

export default router;
