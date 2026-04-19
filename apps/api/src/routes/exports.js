import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { activeWhere } from '../lib/dataHelpers.js';
import { NotFound, Forbidden } from '../utils/errors.js';
import { can } from '../lib/permissions.js';
import ExcelJS from 'exceljs';

const router = Router();

const fmt = (v, type) => {
  if (v === null || v === undefined) return '';
  if (type === 'date') return v ? new Date(v).toLocaleDateString('ar-SA-u-ca-gregory', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
  if (type === 'bool') return v ? 'نعم' : 'لا';
  return String(v);
};

const CONFIGS = {
  objectives: {
    label: 'الأهداف والمؤشرات',
    fetch: () => prisma.objective.findMany({ orderBy: { createdAt: 'desc' } }),
    cols: [
      { key: 'code', label: 'الرمز' },
      { key: 'title', label: 'الهدف' },
      { key: 'kpi', label: 'مؤشر الأداء' },
      { key: 'target', label: 'المستهدف' },
      { key: 'unit', label: 'الوحدة' },
      { key: 'currentValue', label: 'القيمة الحالية' },
      { key: 'progress', label: 'الإنجاز %' },
      { key: 'startDate', label: 'تاريخ البداية', type: 'date' },
      { key: 'dueDate', label: 'تاريخ الاستحقاق', type: 'date' },
      { key: 'status', label: 'الحالة' },
    ],
  },
  risks: {
    label: 'المخاطر والفرص',
    fetch: () => prisma.risk.findMany({ orderBy: { createdAt: 'desc' } }),
    cols: [
      { key: 'code', label: 'الرمز' },
      { key: 'type', label: 'النوع' },
      { key: 'title', label: 'العنوان' },
      { key: 'source', label: 'المصدر' },
      { key: 'probability', label: 'الاحتمالية' },
      { key: 'impact', label: 'الأثر' },
      { key: 'score', label: 'الدرجة' },
      { key: 'level', label: 'المستوى' },
      { key: 'status', label: 'الحالة' },
      { key: 'treatment', label: 'خطة المعالجة' },
    ],
  },
  complaints: {
    label: 'الشكاوى',
    fetch: () => prisma.complaint.findMany({ orderBy: { receivedAt: 'desc' } }),
    cols: [
      { key: 'code', label: 'الرمز' },
      { key: 'subject', label: 'الموضوع' },
      { key: 'source', label: 'الجهة' },
      { key: 'channel', label: 'القناة' },
      { key: 'complainantName', label: 'المشتكي' },
      { key: 'complainantPhone', label: 'الجوال' },
      { key: 'severity', label: 'الأهمية' },
      { key: 'status', label: 'الحالة' },
      { key: 'rootCause', label: 'السبب الجذري' },
      { key: 'resolution', label: 'الحل' },
      { key: 'receivedAt', label: 'تاريخ الاستقبال', type: 'date' },
    ],
  },
  ncr: {
    label: 'عدم المطابقة',
    fetch: () => prisma.nCR.findMany({ orderBy: { createdAt: 'desc' } }),
    cols: [
      { key: 'code', label: 'الرمز' },
      { key: 'title', label: 'العنوان' },
      { key: 'description', label: 'الوصف' },
      { key: 'severity', label: 'الأهمية' },
      { key: 'rootCause', label: 'السبب الجذري' },
      { key: 'correction', label: 'التصحيح الفوري' },
      { key: 'correctiveAction', label: 'الإجراء التصحيحي' },
      { key: 'status', label: 'الحالة' },
      { key: 'dueDate', label: 'تاريخ الاستحقاق', type: 'date' },
    ],
  },
  suppliers: {
    label: 'الموردون',
    fetch: () => prisma.supplier.findMany({ orderBy: { createdAt: 'desc' } }),
    cols: [
      { key: 'code', label: 'الرمز' },
      { key: 'name', label: 'الاسم' },
      { key: 'type', label: 'النوع' },
      { key: 'crNumber', label: 'السجل التجاري' },
      { key: 'vatNumber', label: 'الرقم الضريبي' },
      { key: 'contactPerson', label: 'الشخص المسؤول' },
      { key: 'phone', label: 'الجوال' },
      { key: 'city', label: 'المدينة' },
      { key: 'overallRating', label: 'التقييم الإجمالي' },
      { key: 'status', label: 'الحالة' },
    ],
  },
  beneficiaries: {
    label: 'المستفيدون',
    fetch: () => prisma.beneficiary.findMany({ orderBy: { createdAt: 'desc' } }),
    cols: [
      { key: 'code', label: 'الرمز' },
      { key: 'fullName', label: 'الاسم الكامل' },
      { key: 'nationalId', label: 'الهوية الوطنية' },
      { key: 'category', label: 'الفئة' },
      { key: 'gender', label: 'الجنس' },
      { key: 'birthDate', label: 'تاريخ الميلاد', type: 'date' },
      { key: 'phone', label: 'الجوال' },
      { key: 'city', label: 'المدينة' },
      { key: 'district', label: 'الحي' },
      { key: 'familySize', label: 'أفراد الأسرة' },
      { key: 'monthlyIncome', label: 'الدخل الشهري' },
      { key: 'status', label: 'الحالة' },
    ],
  },
  training: {
    label: 'التدريب',
    fetch: () => prisma.training.findMany({ orderBy: { date: 'desc' } }),
    cols: [
      { key: 'code', label: 'الرمز' },
      { key: 'title', label: 'الدورة' },
      { key: 'description', label: 'الوصف' },
      { key: 'trainer', label: 'المدرب' },
      { key: 'date', label: 'التاريخ', type: 'date' },
      { key: 'duration', label: 'المدة (ساعات)' },
      { key: 'location', label: 'المكان' },
      { key: 'category', label: 'الفئة' },
    ],
  },
  audits: {
    label: 'التدقيق الداخلي',
    fetch: () => prisma.audit.findMany({ orderBy: { createdAt: 'desc' } }),
    cols: [
      { key: 'code', label: 'الرمز' },
      { key: 'title', label: 'العنوان' },
      { key: 'type', label: 'النوع' },
      { key: 'scope', label: 'النطاق' },
      { key: 'plannedDate', label: 'التاريخ المخطط', type: 'date' },
      { key: 'actualDate', label: 'التاريخ الفعلي', type: 'date' },
      { key: 'findings', label: 'النتائج' },
      { key: 'strengths', label: 'نقاط القوة' },
      { key: 'weaknesses', label: 'نقاط التحسين' },
      { key: 'status', label: 'الحالة' },
    ],
  },
  donations: {
    label: 'التبرعات',
    fetch: () => prisma.donation.findMany({ orderBy: { receivedAt: 'desc' } }),
    cols: [
      { key: 'code', label: 'الرمز' },
      { key: 'donorName', label: 'المتبرع' },
      { key: 'donorPhone', label: 'الجوال' },
      { key: 'type', label: 'النوع' },
      { key: 'itemName', label: 'الصنف' },
      { key: 'quantity', label: 'الكمية' },
      { key: 'unit', label: 'الوحدة' },
      { key: 'amount', label: 'المبلغ' },
      { key: 'status', label: 'الحالة' },
      { key: 'receivedAt', label: 'تاريخ الاستلام', type: 'date' },
    ],
  },
  strategicGoals: {
    label: 'الخطة الاستراتيجية',
    fetch: () => prisma.strategicGoal.findMany({ orderBy: { createdAt: 'desc' } }),
    cols: [
      { key: 'code', label: 'الرمز' },
      { key: 'perspective', label: 'المحور' },
      { key: 'title', label: 'الهدف الاستراتيجي' },
      { key: 'kpi', label: 'مؤشر النجاح' },
      { key: 'baseline', label: 'الوضع الراهن' },
      { key: 'target', label: 'المستهدف' },
      { key: 'initiatives', label: 'المبادرات' },
      { key: 'responsible', label: 'الجهة المسؤولة' },
      { key: 'startYear', label: 'سنة البداية' },
      { key: 'endYear', label: 'سنة النهاية' },
      { key: 'progress', label: 'الإنجاز %' },
      { key: 'status', label: 'الحالة' },
    ],
  },
  operationalActivities: {
    label: 'الخطة التشغيلية',
    fetch: () => prisma.operationalActivity.findMany({ orderBy: { createdAt: 'desc' } }),
    cols: [
      { key: 'code', label: 'الرمز' },
      { key: 'title', label: 'النشاط' },
      { key: 'perspective', label: 'المحور' },
      { key: 'department', label: 'الإدارة' },
      { key: 'responsible', label: 'المسؤول' },
      { key: 'year', label: 'السنة' },
      { key: 'startDate', label: 'تاريخ البداية', type: 'date' },
      { key: 'endDate', label: 'تاريخ الانتهاء', type: 'date' },
      { key: 'budget', label: 'الميزانية' },
      { key: 'spent', label: 'المصروف' },
      { key: 'progress', label: 'الإنجاز %' },
      { key: 'status', label: 'الحالة' },
    ],
  },
  swot: {
    label: 'تحليل SWOT',
    fetch: () => prisma.swotItem.findMany({ orderBy: { createdAt: 'desc' } }),
    cols: [
      { key: 'code', label: 'الرمز' },
      { key: 'type', label: 'النوع' },
      { key: 'category', label: 'الفئة' },
      { key: 'description', label: 'الوصف' },
      { key: 'impact', label: 'الأثر' },
      { key: 'strategy', label: 'الاستراتيجية' },
      { key: 'status', label: 'الحالة' },
    ],
  },
  interestedParties: {
    label: 'الأطراف ذات العلاقة',
    fetch: () => prisma.interestedParty.findMany({ orderBy: { createdAt: 'desc' } }),
    cols: [
      { key: 'code', label: 'الرمز' },
      { key: 'name', label: 'الاسم' },
      { key: 'type', label: 'النوع' },
      { key: 'needs', label: 'الاحتياجات' },
      { key: 'expectations', label: 'التوقعات' },
      { key: 'influence', label: 'التأثير' },
      { key: 'monitoring', label: 'طريقة الرصد' },
      { key: 'responsible', label: 'المسؤول' },
    ],
  },
  processes: {
    label: 'خريطة العمليات',
    fetch: () => prisma.process.findMany({ orderBy: { createdAt: 'desc' } }),
    cols: [
      { key: 'code', label: 'الرمز' },
      { key: 'name', label: 'الاسم' },
      { key: 'type', label: 'النوع' },
      { key: 'owner', label: 'المالك' },
      { key: 'inputs', label: 'المدخلات' },
      { key: 'outputs', label: 'المخرجات' },
      { key: 'kpis', label: 'المؤشرات' },
      { key: 'risks', label: 'المخاطر' },
    ],
  },
  managementReview: {
    label: 'مراجعة الإدارة',
    fetch: () => prisma.managementReview.findMany({ orderBy: { meetingDate: 'desc' } }),
    cols: [
      { key: 'code', label: 'الرمز' },
      { key: 'title', label: 'العنوان' },
      { key: 'period', label: 'الفترة' },
      { key: 'meetingDate', label: 'تاريخ الاجتماع', type: 'date' },
      { key: 'attendees', label: 'الحضور' },
      { key: 'decisions', label: 'القرارات' },
      { key: 'improvementActions', label: 'إجراءات التحسين' },
      { key: 'status', label: 'الحالة' },
    ],
  },
  competence: {
    label: 'مصفوفة الكفاءات',
    fetch: () => prisma.competenceRequirement.findMany({ orderBy: { createdAt: 'desc' } }),
    cols: [
      { key: 'code', label: 'الرمز' },
      { key: 'jobTitle', label: 'المسمى الوظيفي' },
      { key: 'department', label: 'الإدارة' },
      { key: 'requiredSkills', label: 'المهارات المطلوبة' },
      { key: 'minEducation', label: 'الحد الأدنى للتعليم' },
      { key: 'minExperience', label: 'سنوات الخبرة' },
      { key: 'certifications', label: 'الشهادات' },
      { key: 'trainings', label: 'التدريبات' },
    ],
  },
  communication: {
    label: 'خطة الاتصال',
    fetch: () => prisma.communicationPlan.findMany({ orderBy: { createdAt: 'desc' } }),
    cols: [
      { key: 'code', label: 'الرمز' },
      { key: 'topic', label: 'الموضوع' },
      { key: 'audience', label: 'الجمهور' },
      { key: 'purpose', label: 'الغرض' },
      { key: 'channel', label: 'القناة' },
      { key: 'frequency', label: 'التكرار' },
      { key: 'responsible', label: 'المسؤول' },
      { key: 'format', label: 'الشكل' },
    ],
  },
  ackDocuments: {
    label: 'السياسات والمواثيق (الإقرارات)',
    fetch: () => prisma.ackDocument.findMany({ where: activeWhere(), orderBy: [{ category: 'asc' }, { title: 'asc' }] }),
    cols: [
      { key: 'code', label: 'الرمز' },
      { key: 'title', label: 'العنوان' },
      { key: 'category', label: 'الفئة' },
      { key: 'audience', label: 'المستهدفون' },
      { key: 'version', label: 'الإصدار' },
      { key: 'renewFrequency', label: 'تكرار التجديد' },
      { key: 'mandatory', label: 'إلزامية', type: 'bool' },
      { key: 'active', label: 'مفعّلة', type: 'bool' },
      { key: 'effectiveDate', label: 'تاريخ النفاذ', type: 'date' },
      { key: 'reviewDate', label: 'تاريخ المراجعة', type: 'date' },
      { key: 'approvedBy', label: 'الجهة المُعتمِدة' },
    ],
  },
  performanceReviews: {
    label: 'تقييمات الأداء',
    fetch: async () => {
      const items = await prisma.performanceReview.findMany({
        where: activeWhere(),
        orderBy: { createdAt: 'desc' },
      });
      const employeeIds = [...new Set(items.map(item => item.employeeId).filter(Boolean))];
      const employees = employeeIds.length
        ? await prisma.user.findMany({
          where: { id: { in: employeeIds } },
          select: { id: true, name: true },
        })
        : [];
      const employeeNames = new Map(employees.map(employee => [employee.id, employee.name]));
      return items.map(item => ({
        ...item,
        employeeName: employeeNames.get(item.employeeId) || item.employeeId,
        overallScore: item.overallRating,
        strengthsNotes: item.strengths,
        improvementNotes: item.areasToImprove,
      }));
    },
    cols: [
      { key: 'code', label: 'الرمز' },
      { key: 'employeeName', label: 'الموظف' },
      { key: 'period', label: 'الفترة' },
      { key: 'status', label: 'الحالة' },
      { key: 'overallScore', label: 'الدرجة الإجمالية' },
      { key: 'strengthsNotes', label: 'نقاط القوة' },
      { key: 'improvementNotes', label: 'مجالات التطوير' },
      { key: 'createdAt', label: 'تاريخ الإنشاء', type: 'date' },
    ],
  },
  improvementProjects: {
    label: 'مشاريع التحسين (PDCA)',
    fetch: () => prisma.improvementProject.findMany({
      where: activeWhere(),
      orderBy: { createdAt: 'desc' },
    }),
    cols: [
      { key: 'code', label: 'الرمز' },
      { key: 'title', label: 'المشروع' },
      { key: 'source', label: 'المصدر' },
      { key: 'phase', label: 'المرحلة (PDCA)' },
      { key: 'problemStatement', label: 'المشكلة' },
      { key: 'goalStatement', label: 'الهدف' },
      { key: 'plannedStart', label: 'بداية مقرَّرة', type: 'date' },
      { key: 'plannedEnd', label: 'نهاية مقرَّرة', type: 'date' },
      { key: 'actualEnd', label: 'الإغلاق الفعلي', type: 'date' },
    ],
  },
  auditChecklists: {
    label: 'قوائم تحقق التدقيق',
    fetch: () => prisma.auditChecklistTemplate.findMany({
      where: activeWhere(),
      orderBy: { createdAt: 'desc' },
    }),
    cols: [
      { key: 'code', label: 'الرمز' },
      { key: 'title', label: 'العنوان' },
      { key: 'scope', label: 'النطاق' },
      { key: 'clause', label: 'البند' },
      { key: 'version', label: 'الإصدار' },
      { key: 'active', label: 'مفعّلة', type: 'bool' },
      { key: 'createdAt', label: 'تاريخ الإنشاء', type: 'date' },
    ],
  },
};

const EXPORT_RESOURCE = {
  objectives: 'objectives',
  risks: 'risks',
  complaints: 'complaints',
  ncr: 'ncr',
  suppliers: 'suppliers',
  beneficiaries: 'beneficiaries',
  training: 'training',
  audits: 'audits',
  donations: 'donations',
  strategicGoals: 'strategic-goals',
  operationalActivities: 'operational-activities',
  swot: 'swot',
  interestedParties: 'interested-parties',
  processes: 'processes',
  managementReview: 'management-review',
  competence: 'competence',
  communication: 'communication',
  ackDocuments: 'ack-documents',
  performanceReviews: 'performance-reviews',
  improvementProjects: 'improvement-projects',
  auditChecklists: 'audit-checklists',
};

// preprocess: للتصدير، نُسطِّح حقول الـ relation والمصفوفات قبل العرض
const flattenForExport = (item, cfg) => {
  const out = { ...item };
  if (item.employee?.name !== undefined) out.employeeName = item.employee.name;
  if (Array.isArray(out.audience)) out.audience = out.audience.join('، ');
  return out;
};

router.get('/:model', asyncHandler(async (req, res) => {
  const cfg = CONFIGS[req.params.model];
  const resource = EXPORT_RESOURCE[req.params.model] || req.params.model;
  if (cfg && !can(req.user, resource, 'read')) throw Forbidden('ليس لديك صلاحية تصدير هذا المورد');
  if (!cfg) throw NotFound('نموذج التصدير غير موجود');

  const items = await cfg.fetch();

  const wb = new ExcelJS.Workbook();
  wb.creator = 'QMS - جمعية البر بصبيا';
  wb.created = new Date();

  const ws = wb.addWorksheet(cfg.label, { views: [{ rightToLeft: true }] });
  ws.columns = cfg.cols.map(c => ({ header: c.label, key: c.key, width: 26 }));

  const headerRow = ws.getRow(1);
  headerRow.height = 22;
  headerRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E8B57' } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = { top:{style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'} };
  });

  items.forEach((rawItem, idx) => {
    const item = flattenForExport(rawItem, cfg);
    const rowData = {};
    cfg.cols.forEach(c => { rowData[c.key] = fmt(item[c.key], c.type); });
    const row = ws.addRow(rowData);
    if (idx % 2 === 0) {
      row.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F9F4' } };
      });
    }
    row.eachCell(cell => {
      cell.border = { top:{style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'} };
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
    });
    row.height = 18;
  });

  const filename = encodeURIComponent(`${cfg.label}-${new Date().toISOString().split('T')[0]}.xlsx`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${filename}`);
  await wb.xlsx.write(res);
  res.end();
}));

export default router;
