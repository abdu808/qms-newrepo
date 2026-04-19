// =====================================================
// QMS Frontend - Alpine.js SPA
// =====================================================

const API = '/api';

// ───────── RBAC mirror (keep in sync with apps/api/src/lib/permissions-matrix.js) ─────────
const _ANY          = ['GUEST_AUDITOR','EMPLOYEE','DEPT_MANAGER','COMMITTEE_MEMBER','QUALITY_MANAGER','SUPER_ADMIN'];
const _EMPLOYEE_UP  = ['EMPLOYEE','DEPT_MANAGER','COMMITTEE_MEMBER','QUALITY_MANAGER','SUPER_ADMIN'];
const _MANAGER_UP   = ['DEPT_MANAGER','COMMITTEE_MEMBER','QUALITY_MANAGER','SUPER_ADMIN'];
const _COMMITTEE_UP = ['COMMITTEE_MEMBER','QUALITY_MANAGER','SUPER_ADMIN'];
const _QM_UP        = ['QUALITY_MANAGER','SUPER_ADMIN'];
const _SA           = ['SUPER_ADMIN'];

const PERMISSIONS_DEFAULT = {
  read:_ANY, create:_EMPLOYEE_UP, update:_MANAGER_UP, delete:_QM_UP, approve:_QM_UP, close:_QM_UP,
};

const PERMISSIONS = {
  users:            { read:_MANAGER_UP, create:_SA, update:_SA, delete:_SA },
  departments:      { read:_ANY, create:_QM_UP, update:_QM_UP, delete:_SA },
  'strategic-goals':{ read:_ANY, create:_QM_UP, update:_QM_UP, delete:_QM_UP },
  objectives:       { read:_ANY, create:_MANAGER_UP, update:_MANAGER_UP, delete:_QM_UP },
  risks:            { read:_ANY, create:_EMPLOYEE_UP, update:_MANAGER_UP, delete:_QM_UP },
  swot:             { read:_ANY, create:_MANAGER_UP, update:_MANAGER_UP, delete:_QM_UP },
  'interested-parties': { read:_ANY, create:_MANAGER_UP, update:_MANAGER_UP, delete:_QM_UP },
  processes:        { read:_ANY, create:_QM_UP, update:_QM_UP, delete:_QM_UP },
  'quality-policy': { read:_ANY, create:_QM_UP, update:_QM_UP, delete:_SA, activate:_QM_UP },
  documents:        { read:_ANY, create:_EMPLOYEE_UP, update:_EMPLOYEE_UP, delete:_QM_UP, approve:_QM_UP, publish:_QM_UP },
  training:         { read:_ANY, create:_MANAGER_UP, update:_MANAGER_UP, delete:_QM_UP },
  competence:       { read:_ANY, create:_MANAGER_UP, update:_MANAGER_UP, delete:_QM_UP },
  communication:    { read:_ANY, create:_MANAGER_UP, update:_MANAGER_UP, delete:_QM_UP },
  'operational-activities': { read:_ANY, create:_EMPLOYEE_UP, update:_MANAGER_UP, delete:_QM_UP },
  suppliers:        { read:_ANY, create:_EMPLOYEE_UP, update:_MANAGER_UP, delete:_QM_UP },
  'supplier-evals': { read:_ANY, create:_MANAGER_UP, update:_MANAGER_UP, delete:_QM_UP },
  donations:        { read:_ANY, create:_EMPLOYEE_UP, update:_MANAGER_UP, delete:_QM_UP },
  'donation-evals': { read:_ANY, create:_MANAGER_UP, update:_MANAGER_UP, delete:_QM_UP },
  beneficiaries:    { read:_ANY, create:_EMPLOYEE_UP, update:_MANAGER_UP, delete:_QM_UP },
  programs:         { read:_ANY, create:_MANAGER_UP, update:_MANAGER_UP, delete:_QM_UP },
  complaints:       { read:_ANY, create:_EMPLOYEE_UP, update:_MANAGER_UP, delete:_QM_UP, close:_QM_UP },
  surveys:          { read:_ANY, create:_MANAGER_UP, update:_MANAGER_UP, delete:_QM_UP },
  audits:           { read:_ANY, create:_QM_UP, update:_QM_UP, delete:_QM_UP },
  'management-review': { read:_ANY, create:_QM_UP, update:_QM_UP, delete:_QM_UP },
  ncr:              { read:_ANY, create:_EMPLOYEE_UP, update:_MANAGER_UP, delete:_QM_UP, close:_QM_UP },
  signatures:       { read:_ANY, create:_EMPLOYEE_UP, update:_QM_UP, delete:_SA },
  'audit-log':      { read:_QM_UP, create:_SA, update:_SA, delete:_SA },
  'report-builder': { read:_QM_UP, create:_QM_UP, update:_QM_UP, delete:_QM_UP },
  'eval-tokens':    { read:_MANAGER_UP, create:_MANAGER_UP, update:_QM_UP, delete:_QM_UP },
  'performance-reviews': { read:_MANAGER_UP, create:_MANAGER_UP, update:_MANAGER_UP, delete:_QM_UP },
  'improvement-projects': { read:_ANY, create:_EMPLOYEE_UP, update:_MANAGER_UP, delete:_QM_UP },
  'audit-checklists':    { read:_ANY, create:_QM_UP, update:_QM_UP, delete:_QM_UP },
  'ack-documents':       { read:_ANY, create:_QM_UP, update:_QM_UP, delete:_QM_UP },
};

// Module endpoint → resource key resolver (handles cases where endpoint ≠ resource string)
function _resourceKey(resource) {
  if (!resource) return null;
  return PERMISSIONS[resource] ? resource : resource;
}

const MODULES = {
  swot: {
    endpoint: 'swot',
    exportable: true,
    statusOptions: [
      { v: '', l: 'كل الحالات' },
      { v: 'ACTIVE', l: 'نشط' },
      { v: 'CLOSED', l: 'مغلق' },
    ],
    cols: [
      { key: 'code', label: 'الرمز' },
      { key: 'type', label: 'النوع' },
      { key: 'category', label: 'الفئة' },
      { key: 'description', label: 'الوصف' },
      { key: 'impact', label: 'الأثر' },
      { key: 'status', label: 'الحالة', type: 'status' },
    ],
    fields: [
      { key: 'type', label: 'النوع', required: true, type: 'select', options: [
        { v: 'STRENGTH', l: 'قوة (Strength)' },
        { v: 'WEAKNESS', l: 'ضعف (Weakness)' },
        { v: 'OPPORTUNITY', l: 'فرصة (Opportunity)' },
        { v: 'THREAT', l: 'تهديد (Threat)' },
      ]},
      { key: 'category', label: 'الفئة', type: 'select', options: [
        { v: 'داخلي', l: 'داخلي' },
        { v: 'سياسي', l: 'سياسي (خارجي)' },
        { v: 'اقتصادي', l: 'اقتصادي (خارجي)' },
        { v: 'اجتماعي', l: 'اجتماعي (خارجي)' },
        { v: 'تقني', l: 'تقني (خارجي)' },
        { v: 'قانوني', l: 'قانوني (خارجي)' },
      ]},
      { key: 'description', label: 'الوصف', type: 'textarea', required: true },
      { key: 'impact', label: 'الأثر', type: 'select', options: [
        { v: 'منخفض', l: 'منخفض' }, { v: 'متوسط', l: 'متوسط' }, { v: 'مرتفع', l: 'مرتفع' },
      ]},
      { key: 'strategy', label: 'الاستراتيجية للاستفادة أو التعامل', type: 'textarea' },
      { key: 'reviewDate', label: 'تاريخ المراجعة', type: 'date' },
      { key: 'status', label: 'الحالة', type: 'select', options: [
        { v: 'ACTIVE', l: 'نشط' }, { v: 'CLOSED', l: 'مغلق' },
      ]},
    ],
  },

  interestedParties: {
    endpoint: 'interested-parties',
    exportable: true,
    cols: [
      { key: 'code', label: 'الرمز' },
      { key: 'name', label: 'الاسم' },
      { key: 'type', label: 'النوع' },
      { key: 'influence', label: 'التأثير' },
      { key: 'responsible', label: 'المسؤول' },
    ],
    fields: [
      { key: 'name', label: 'اسم الطرف', required: true },
      { key: 'type', label: 'النوع', required: true, type: 'select', options: [
        { v: 'DONOR', l: 'متبرع' },
        { v: 'BENEFICIARY', l: 'مستفيد' },
        { v: 'GOVERNMENT', l: 'جهة حكومية' },
        { v: 'EMPLOYEE', l: 'موظف' },
        { v: 'PARTNER', l: 'شريك' },
        { v: 'SUPPLIER', l: 'مورد' },
        { v: 'COMMUNITY', l: 'مجتمع' },
        { v: 'VOLUNTEER', l: 'متطوع' },
      ]},
      { key: 'needs', label: 'الاحتياجات', type: 'textarea' },
      { key: 'expectations', label: 'التوقعات', type: 'textarea' },
      { key: 'influence', label: 'التأثير', type: 'select', options: [
        { v: 'منخفض', l: 'منخفض' }, { v: 'متوسط', l: 'متوسط' }, { v: 'مرتفع', l: 'مرتفع' },
      ]},
      { key: 'monitoring', label: 'طريقة الرصد والاستجابة', type: 'textarea' },
      { key: 'responsible', label: 'المسؤول' },
    ],
  },

  processes: {
    endpoint: 'processes',
    exportable: true,
    cols: [
      { key: 'code', label: 'الرمز' },
      { key: 'name', label: 'العملية' },
      { key: 'type', label: 'النوع' },
      { key: 'owner', label: 'المالك' },
    ],
    fields: [
      { key: 'name', label: 'اسم العملية', required: true },
      { key: 'type', label: 'نوع العملية', required: true, type: 'select', options: [
        { v: 'CORE', l: 'عملية رئيسية' },
        { v: 'SUPPORT', l: 'عملية مساندة' },
        { v: 'MANAGEMENT', l: 'عملية إدارية' },
      ]},
      { key: 'owner', label: 'مالك العملية' },
      { key: 'inputs', label: 'المدخلات', type: 'textarea' },
      { key: 'outputs', label: 'المخرجات', type: 'textarea' },
      { key: 'resources', label: 'الموارد المطلوبة', type: 'textarea' },
      { key: 'kpis', label: 'مؤشرات الأداء', type: 'textarea' },
      { key: 'risks', label: 'المخاطر المرتبطة', type: 'textarea' },
      { key: 'description', label: 'الوصف', type: 'textarea' },
    ],
  },

  qualityPolicy: {
    endpoint: 'quality-policy',
    cols: [
      { key: 'version', label: 'الإصدار' },
      { key: 'title', label: 'العنوان' },
      { key: 'active', label: 'مفعّلة', type: 'bool' },
      { key: 'effectiveDate', label: 'تاريخ السريان', type: 'date' },
      { key: 'approvedBy', label: 'اعتمدها' },
    ],
    fields: [
      { key: 'version', label: 'رقم الإصدار', required: true },
      { key: 'title', label: 'العنوان', required: true },
      { key: 'content', label: 'نص السياسة', type: 'textarea', required: true, hint: 'يجب أن تتضمن: الالتزام بمتطلبات ISO 9001، التحسين المستمر، ملاءمة نشاط الجمعية — ISO 5.2.1' },
      { key: 'commitments', label: 'التعهدات', type: 'textarea', hint: 'التعهدات المحددة التي تلتزم بها الجمعية تجاه الجودة — ISO 5.2.2' },
      { key: 'approvedBy', label: 'اعتمدها' },
      { key: 'approvedAt', label: 'تاريخ الاعتماد', type: 'date' },
      { key: 'effectiveDate', label: 'تاريخ السريان', type: 'date' },
      { key: 'reviewDate', label: 'تاريخ المراجعة القادمة', type: 'date' },
    ],
  },

  managementReview: {
    endpoint: 'management-review',
    exportable: true,
    sigAction: true,   // P-13 §6.3 — توقيع رئيس الاجتماع على المحضر (ISO 9.3.3)
    statusOptions: [
      { v: '', l: 'كل الحالات' },
      { v: 'PLANNED', l: 'مخطط' },
      { v: 'COMPLETED', l: 'مكتمل' },
      { v: 'CANCELLED', l: 'ملغى' },
    ],
    cols: [
      { key: 'code', label: 'الرمز' },
      { key: 'title', label: 'العنوان' },
      { key: 'period', label: 'الفترة' },
      { key: 'meetingDate', label: 'تاريخ الاجتماع', type: 'date' },
      { key: 'status', label: 'الحالة', type: 'status' },
    ],
    fields: [
      { key: 'title', label: 'عنوان الاجتماع', required: true },
      { key: 'period', label: 'الفترة (مثال: Q1-2026)' },
      { key: 'meetingDate', label: 'تاريخ الاجتماع', type: 'date', required: true },
      { key: 'attendees', label: 'الحضور', type: 'textarea', hint: 'وثّق أسماء جميع الحاضرين بالكامل — حضور الإدارة العليا مطلوب (ISO 9.3.1)' },
      { key: 'contextChanges', label: '[مدخل] تغييرات في السياق', type: 'textarea' },
      { key: 'objectivesReview', label: '[مدخل] مراجعة تحقق الأهداف', type: 'textarea' },
      { key: 'processPerformance', label: '[مدخل] أداء العمليات', type: 'textarea' },
      { key: 'conformityStatus', label: '[مدخل] حالة المطابقة', type: 'textarea' },
      { key: 'auditResults', label: '[مدخل] نتائج التدقيق', type: 'textarea' },
      { key: 'customerFeedback', label: '[مدخل] تغذية راجعة من المستفيدين', type: 'textarea' },
      { key: 'risksStatus', label: '[مدخل] حالة المخاطر', type: 'textarea' },
      { key: 'improvementOpps', label: '[مدخل] فرص التحسين', type: 'textarea' },
      { key: 'decisions', label: '[مخرج] القرارات', type: 'textarea', hint: 'القرارات الرسمية الصادرة عن المراجعة — ISO 9.3.3' },
      { key: 'resourceNeeds', label: '[مخرج] الاحتياجات من الموارد', type: 'textarea' },
      { key: 'improvementActions', label: '[مخرج] إجراءات التحسين', type: 'textarea' },
      { key: 'systemChanges', label: '[مخرج] تغييرات على النظام', type: 'textarea' },
      { key: 'minutes', label: 'محضر الاجتماع', type: 'textarea' },
      { key: 'nextReview', label: 'تاريخ المراجعة القادمة', type: 'date' },
      { key: 'topManagementPresent', label: '✅ حضرت الإدارة العليا (ISO 9.3.1 — مطلوب للإكمال)', type: 'bool' },
      { key: 'status', label: 'الحالة', type: 'select', options: [
        { v: 'PLANNED', l: 'مخطط' }, { v: 'COMPLETED', l: 'مكتمل' }, { v: 'CANCELLED', l: 'ملغى' },
      ]},
    ],
  },

  competence: {
    endpoint: 'competence',
    exportable: true,
    cols: [
      { key: 'code', label: 'الرمز' },
      { key: 'jobTitle', label: 'المسمى الوظيفي' },
      { key: 'department', label: 'الإدارة' },
      { key: 'minExperience', label: 'سنوات الخبرة' },
    ],
    fields: [
      { key: 'jobTitle', label: 'المسمى الوظيفي', required: true },
      { key: 'department', label: 'الإدارة' },
      { key: 'requiredSkills', label: 'المهارات المطلوبة', type: 'textarea' },
      { key: 'minEducation', label: 'الحد الأدنى للتعليم' },
      { key: 'minExperience', label: 'سنوات الخبرة', type: 'number' },
      { key: 'certifications', label: 'الشهادات المطلوبة', type: 'textarea' },
      { key: 'trainings', label: 'التدريبات المطلوبة', type: 'textarea' },
      { key: 'evaluationMethod', label: 'طريقة التقييم', type: 'textarea' },
    ],
  },

  communication: {
    endpoint: 'communication',
    exportable: true,
    cols: [
      { key: 'code', label: 'الرمز' },
      { key: 'topic', label: 'الموضوع' },
      { key: 'audience', label: 'الجمهور' },
      { key: 'channel', label: 'القناة' },
      { key: 'frequency', label: 'التكرار' },
      { key: 'responsible', label: 'المسؤول' },
    ],
    fields: [
      { key: 'topic', label: 'الموضوع', required: true },
      { key: 'audience', label: 'الجمهور المستهدف', required: true },
      { key: 'purpose', label: 'الغرض', type: 'textarea' },
      { key: 'channel', label: 'القناة', required: true, type: 'select', options: [
        { v: 'بريد إلكتروني', l: 'بريد إلكتروني' },
        { v: 'اجتماع', l: 'اجتماع' },
        { v: 'واتساب', l: 'واتساب' },
        { v: 'لوحة إعلانات', l: 'لوحة إعلانات' },
        { v: 'موقع إلكتروني', l: 'موقع إلكتروني' },
        { v: 'نشرة', l: 'نشرة' },
        { v: 'رسائل', l: 'رسائل' },
      ]},
      { key: 'frequency', label: 'التكرار', required: true, type: 'select', options: [
        { v: 'يومي', l: 'يومي' }, { v: 'أسبوعي', l: 'أسبوعي' },
        { v: 'شهري', l: 'شهري' }, { v: 'ربعي', l: 'ربعي' },
        { v: 'سنوي', l: 'سنوي' }, { v: 'عند الحاجة', l: 'عند الحاجة' },
      ]},
      { key: 'responsible', label: 'المسؤول', required: true },
      { key: 'format', label: 'الشكل' },
    ],
  },

  strategicGoals: {
    endpoint: 'strategic-goals',
    exportable: true,
    statusOptions: [
      { v: '', l: 'كل الحالات' },
      { v: 'PLANNED', l: 'مخطط' },
      { v: 'IN_PROGRESS', l: 'قيد التنفيذ' },
      { v: 'ACHIEVED', l: 'محقق' },
      { v: 'DELAYED', l: 'متأخر' },
      { v: 'CANCELLED', l: 'ملغى' },
    ],
    cols: [
      { key: 'code', label: 'الرمز' },
      { key: 'perspective', label: 'المحور' },
      { key: 'title', label: 'الهدف الاستراتيجي' },
      { key: 'kpi', label: 'المؤشر' },
      { key: 'target', label: 'المستهدف' },
      { key: 'progress', label: 'الإنجاز %' },
      { key: 'status', label: 'الحالة', type: 'status' },
    ],
    fields: [
      { key: 'title', label: 'الهدف الاستراتيجي', required: true },
      { key: 'perspective', label: 'المحور', type: 'select', options: [
        { v: 'مالي واستدامي', l: 'مالي واستدامي' },
        { v: 'المستفيدون والمجتمع', l: 'المستفيدون والمجتمع' },
        { v: 'العمليات الداخلية', l: 'العمليات الداخلية' },
        { v: 'التعلم والنمو', l: 'التعلم والنمو' },
        { v: 'الحوكمة والامتثال', l: 'الحوكمة والامتثال' },
      ]},
      { key: 'kpi', label: 'مؤشر قياس النجاح' },
      { key: 'baseline', label: 'الوضع الراهن (الخط الأساسي)' },
      { key: 'target', label: 'المستهدف' },
      { key: 'initiatives', label: 'المبادرات الاستراتيجية', type: 'textarea' },
      { key: 'responsible', label: 'الجهة المسؤولة' },
      { key: 'startYear', label: 'سنة البداية', type: 'number' },
      { key: 'endYear', label: 'سنة النهاية', type: 'number' },
      { key: 'progress', label: 'نسبة الإنجاز %', type: 'number' },
      { key: 'status', label: 'الحالة', type: 'select', options: [
        { v: 'PLANNED', l: 'مخطط' }, { v: 'IN_PROGRESS', l: 'قيد التنفيذ' },
        { v: 'ACHIEVED', l: 'محقق' }, { v: 'DELAYED', l: 'متأخر' }, { v: 'CANCELLED', l: 'ملغى' },
      ]},
      { key: 'notes', label: 'ملاحظات', type: 'textarea' },
    ],
  },

  operationalActivities: {
    endpoint: 'operational-activities',
    exportable: true,
    statusOptions: [
      { v: '', l: 'كل الحالات' },
      { v: 'PLANNED', l: 'مخطط' },
      { v: 'IN_PROGRESS', l: 'قيد التنفيذ' },
      { v: 'COMPLETED', l: 'مكتمل' },
      { v: 'DELAYED', l: 'متأخر' },
      { v: 'CANCELLED', l: 'ملغى' },
    ],
    cols: [
      { key: 'code', label: 'الرمز' },
      { key: 'title', label: 'النشاط' },
      { key: 'perspective', label: 'المحور' },
      { key: 'department', label: 'الإدارة' },
      { key: 'responsible', label: 'المسؤول' },
      { key: 'budget', label: 'الميزانية' },
      { key: 'progress', label: 'الإنجاز %' },
      { key: 'status', label: 'الحالة', type: 'status' },
    ],
    fields: [
      { key: 'title', label: 'عنوان النشاط', required: true },
      { key: 'description', label: 'الوصف', type: 'textarea' },
      { key: 'perspective', label: 'المحور الاستراتيجي', type: 'select', options: [
        { v: 'مالي واستدامي', l: 'مالي واستدامي' },
        { v: 'المستفيدون والمجتمع', l: 'المستفيدون والمجتمع' },
        { v: 'العمليات الداخلية', l: 'العمليات الداخلية' },
        { v: 'التعلم والنمو', l: 'التعلم والنمو' },
        { v: 'الحوكمة والامتثال', l: 'الحوكمة والامتثال' },
      ]},
      { key: 'department', label: 'الإدارة المنفذة' },
      { key: 'responsible', label: 'المسؤول' },
      { key: 'year', label: 'السنة', type: 'number' },
      { key: 'startDate', label: 'تاريخ البداية', type: 'date' },
      { key: 'endDate', label: 'تاريخ الانتهاء', type: 'date' },
      { key: 'budget', label: 'الميزانية المرصودة (ريال)', type: 'number' },
      { key: 'spent', label: 'المبلغ المصروف (ريال)', type: 'number' },
      { key: 'progress', label: 'نسبة الإنجاز %', type: 'number' },
      { key: 'status', label: 'الحالة', type: 'select', options: [
        { v: 'PLANNED', l: 'مخطط' }, { v: 'IN_PROGRESS', l: 'قيد التنفيذ' },
        { v: 'COMPLETED', l: 'مكتمل' }, { v: 'DELAYED', l: 'متأخر' }, { v: 'CANCELLED', l: 'ملغى' },
      ]},
      { key: 'strategicGoalId', label: 'الهدف الاستراتيجي المرتبط', type: 'relation', relation: 'strategicGoals' },
      { key: 'notes', label: 'ملاحظات', type: 'textarea' },
    ],
  },

  objectives: {
    endpoint: 'objectives',
    exportable: true,
    statusOptions: [
      { v: '', l: 'كل الحالات' },
      { v: 'PLANNED', l: 'مخطط' },
      { v: 'IN_PROGRESS', l: 'قيد التنفيذ' },
      { v: 'ACHIEVED', l: 'محقق' },
      { v: 'DELAYED', l: 'متأخر' },
      { v: 'CANCELLED', l: 'ملغى' },
    ],
    cols: [
      { key: 'code', label: 'الرمز' },
      { key: 'title', label: 'الهدف' },
      { key: 'kpi', label: 'المؤشر' },
      { key: 'target', label: 'المستهدف' },
      { key: 'currentValue', label: 'الحالي' },
      { key: 'progress', label: 'الإنجاز %' },
      { key: 'status', label: 'الحالة', type: 'status' },
    ],
    fields: [
      { key: 'title', label: 'عنوان الهدف', required: true },
      { key: 'description', label: 'الوصف', type: 'textarea' },
      { key: 'kpi', label: 'مؤشر الأداء', required: true, hint: 'طبّق مبدأ SMART: محدد، قابل للقياس، قابل للتحقق، ذو صلة، محدد بوقت — ISO 6.2.1' },
      { key: 'baseline', label: 'نقطة البداية', type: 'number' },
      { key: 'target', label: 'القيمة المستهدفة', type: 'number', required: true },
      { key: 'currentValue', label: 'القيمة الحالية', type: 'number' },
      { key: 'unit', label: 'وحدة القياس' },
      { key: 'progress', label: 'نسبة الإنجاز %', type: 'number', hint: 'أدخل رقماً بين 0 و100 — تُحدَّث دورياً (ISO 6.2.2)' },
      { key: 'startDate', label: 'تاريخ البداية', type: 'date', required: true },
      { key: 'dueDate',   label: 'التاريخ المستهدف', type: 'date', required: true },
      { key: 'status', label: 'الحالة', type: 'select', options: [
        { v: 'PLANNED', l: 'مخطط' }, { v: 'IN_PROGRESS', l: 'قيد التنفيذ' },
        { v: 'ACHIEVED', l: 'محقق' }, { v: 'DELAYED', l: 'متأخر' }, { v: 'CANCELLED', l: 'ملغى' },
      ]},
      { key: 'strategicGoalId', label: 'الهدف الاستراتيجي المرتبط', type: 'relation', relation: 'strategicGoals' },
    ],
  },

  risks: {
    endpoint: 'risks',
    exportable: true,
    statusOptions: [
      { v: '', l: 'كل الحالات' },
      { v: 'IDENTIFIED', l: 'محدد' },
      { v: 'UNDER_TREATMENT', l: 'قيد المعالجة' },
      { v: 'MITIGATED', l: 'خُفف' },
      { v: 'ACCEPTED', l: 'مقبول' },
      { v: 'CLOSED', l: 'مغلق' },
    ],
    cols: [
      { key: 'code', label: 'الرمز' },
      { key: 'title', label: 'الخطر/الفرصة' },
      { key: 'type', label: 'النوع' },
      { key: 'probability', label: 'الاحتمالية' },
      { key: 'impact', label: 'الأثر' },
      { key: 'score', label: 'الدرجة' },
      { key: 'level', label: 'المستوى', type: 'level' },
      { key: 'status', label: 'الحالة', type: 'status' },
    ],
    fields: [
      { key: 'title', label: 'العنوان', required: true },
      { key: 'description', label: 'الوصف', type: 'textarea' },
      { key: 'type', label: 'النوع', type: 'select', options: [
        { v: 'RISK', l: 'خطر' }, { v: 'OPPORTUNITY', l: 'فرصة' },
      ]},
      { key: 'source', label: 'المصدر' },
      { key: 'probability', label: 'الاحتمالية (1-5)', type: 'number', hint: '1=نادر جداً · 2=ممكن · 3=محتمل · 4=مرجح · 5=شبه مؤكد — ISO 6.1.2' },
      { key: 'impact', label: 'الأثر (1-5)', type: 'number', hint: '1=بسيط · 2=طفيف · 3=متوسط · 4=جسيم · 5=كارثي — ISO 6.1.2' },
      { key: 'treatment', label: 'خطة المعالجة', type: 'textarea', hint: 'مطلوب قبل إغلاق المخاطرة — ISO 6.1' },
      { key: 'treatmentType', label: 'نوع المعالجة', type: 'select', options: [
        { v: 'تجنب', l: 'تجنب' }, { v: 'تخفيف', l: 'تخفيف' },
        { v: 'نقل', l: 'نقل' }, { v: 'قبول', l: 'قبول' },
      ]},
      { key: 'status', label: 'الحالة', type: 'select', options: [
        { v: 'IDENTIFIED', l: 'محدد' }, { v: 'UNDER_TREATMENT', l: 'قيد المعالجة' },
        { v: 'MITIGATED', l: 'خُفف' }, { v: 'ACCEPTED', l: 'مقبول' }, { v: 'CLOSED', l: 'مغلق' },
      ]},
      { key: 'strategicGoalId', label: 'الهدف الاستراتيجي المرتبط', type: 'relation', relation: 'strategicGoals' },
    ],
  },

  complaints: {
    endpoint: 'complaints',
    exportable: true,
    quickFilters: [
      { key: 'pendingMine', label: 'ينتظر إجرائي', icon: '🎯' },
      { key: 'overdue',     label: 'متأخر',        icon: '⏰' },
      { key: 'open',        label: 'مفتوح',        icon: '📂' },
      { key: 'thisMonth',   label: 'هذا الشهر',    icon: '📅' },
      { key: 'closed',      label: 'مغلق',         icon: '✅' },
    ],
    statusOptions: [
      { v: '', l: 'كل الحالات' },
      { v: 'NEW', l: 'جديد' },
      { v: 'UNDER_REVIEW', l: 'قيد الدراسة' },
      { v: 'IN_PROGRESS', l: 'قيد المعالجة' },
      { v: 'RESOLVED', l: 'تم الحل' },
      { v: 'CLOSED', l: 'مغلق' },
      { v: 'REJECTED', l: 'مرفوض' },
    ],
    cols: [
      { key: 'code', label: 'الرمز' },
      { key: 'subject', label: 'الموضوع' },
      { key: 'source', label: 'الجهة' },
      { key: 'severity', label: 'الأهمية' },
      { key: 'status', label: 'الحالة', type: 'status' },
    ],
    fields: [
      { key: 'subject', label: 'الموضوع', required: true },
      { key: 'description', label: 'التفاصيل', type: 'textarea', required: true },
      { key: 'source', label: 'الجهة', type: 'select', options: [
        { v: 'BENEFICIARY', l: 'مستفيد' }, { v: 'DONOR', l: 'متبرع' },
        { v: 'VOLUNTEER', l: 'متطوع' }, { v: 'EMPLOYEE', l: 'موظف' },
        { v: 'PARTNER', l: 'شريك' }, { v: 'OTHER', l: 'أخرى' },
      ]},
      { key: 'channel', label: 'قناة الاستقبال', type: 'select', options: [
        { v: 'PHONE', l: 'هاتف' }, { v: 'EMAIL', l: 'بريد' },
        { v: 'WEBSITE', l: 'موقع' }, { v: 'IN_PERSON', l: 'حضوري' },
        { v: 'WHATSAPP', l: 'واتساب' }, { v: 'SOCIAL', l: 'تواصل اجتماعي' },
        { v: 'OTHER', l: 'أخرى' },
      ]},
      { key: 'complainantName', label: 'اسم المشتكي' },
      { key: 'complainantPhone', label: 'الجوال' },
      { key: 'complainantEmail', label: 'البريد' },
      { key: 'severity', label: 'الأهمية', type: 'select', options: [
        { v: 'منخفضة', l: 'منخفضة' }, { v: 'متوسطة', l: 'متوسطة' }, { v: 'مرتفعة', l: 'مرتفعة' },
      ]},
      { key: 'rootCause', label: 'السبب الجذري', type: 'textarea', hint: 'حدد السبب الجذري لمنع تكرار الشكوى — استخدم أسلوب 5 لماذا (ISO 9.1.2)' },
      { key: 'resolution', label: 'الحل', type: 'textarea' },
      { key: 'status', label: 'الحالة', type: 'select', options: [
        { v: 'NEW', l: 'جديد' }, { v: 'UNDER_REVIEW', l: 'قيد الدراسة' },
        { v: 'IN_PROGRESS', l: 'قيد المعالجة' }, { v: 'RESOLVED', l: 'تمت المعالجة' },
        { v: 'CLOSED', l: 'مغلق' }, { v: 'REJECTED', l: 'مرفوض' },
      ]},
      // ISO 9.1.2 — قياس رضا العميل بعد الحل
      { key: 'satisfaction', label: '⭐ رضا المشتكي عن الحل (1-5)', type: 'select', options: [
        { v: '',  l: '— لم يُقيَّم —' },
        { v: '5', l: '⭐⭐⭐⭐⭐ راضٍ تماماً' },
        { v: '4', l: '⭐⭐⭐⭐ راضٍ' },
        { v: '3', l: '⭐⭐⭐ محايد' },
        { v: '2', l: '⭐⭐ غير راضٍ' },
        { v: '1', l: '⭐ غير راضٍ إطلاقاً' },
      ]},
      { key: 'receivedAt', label: 'تاريخ الاستلام', type: 'date', maxToday: true },
      { key: 'resolvedAt', label: 'تاريخ الحل', type: 'date', maxToday: true },
    ],
  },

  ncr: {
    endpoint: 'ncr',
    exportable: true,
    sigAction: true,
    quickFilters: [
      { key: 'pendingMine',     label: 'ينتظر إجرائي',       icon: '🎯' },
      { key: 'overdue',         label: 'متأخر',              icon: '⏰' },
      { key: 'pendingReview',   label: 'بانتظار المراجعة',   icon: '🔍' },
      { key: 'pendingApproval', label: 'بانتظار الاعتماد',   icon: '✅' },
      { key: 'thisMonth',       label: 'هذا الشهر',          icon: '📅' },
      { key: 'closed',          label: 'مغلق',               icon: '🔒' },
    ],
    statusOptions: [
      { v: '', l: 'كل الحالات' },
      { v: 'OPEN', l: 'مفتوح' },
      { v: 'ROOT_CAUSE', l: 'تحليل السبب' },
      { v: 'ACTION_PLANNED', l: 'خطة إجراء' },
      { v: 'IN_PROGRESS', l: 'قيد التنفيذ' },
      { v: 'VERIFICATION', l: 'تحقق' },
      { v: 'CLOSED', l: 'مغلق' },
    ],
    cols: [
      { key: 'code', label: 'الرمز' },
      { key: 'title', label: 'العنوان' },
      { key: 'severity', label: 'الأهمية' },
      { key: 'status', label: 'الحالة', type: 'status' },
    ],
    fields: [
      { key: 'title', label: 'العنوان', required: true },
      { key: 'description', label: 'الوصف', type: 'textarea', required: true },
      { key: 'severity', label: 'الأهمية', type: 'select', options: [
        { v: 'منخفضة', l: 'منخفضة' }, { v: 'متوسطة', l: 'متوسطة' }, { v: 'مرتفعة', l: 'مرتفعة' },
      ]},
      { key: 'rootCause', label: 'السبب الجذري', type: 'textarea', hint: "استخدم أسلوب '5 لماذا' لتحليل السبب الحقيقي — ISO 10.2.1" },
      { key: 'correction', label: 'التصحيح الفوري', type: 'textarea', hint: 'الإجراء العاجل لاحتواء المشكلة الآن (لا يعالج السبب الجذري)' },
      { key: 'correctiveAction', label: 'الإجراء التصحيحي', type: 'textarea', hint: 'يجب أن يعالج السبب الجذري لا مجرد الأعراض — ISO 10.2.1' },
      { key: 'dueDate', label: 'تاريخ الاستحقاق', type: 'date' },
      { key: 'assigneeId', label: 'المسؤول عن التنفيذ', type: 'relation', rel: 'users' },
      { key: 'departmentId', label: 'القسم المعني', type: 'relation', rel: 'departments' },
      { key: 'status', label: 'الحالة', type: 'select', options: [
        { v: 'OPEN', l: 'مفتوح' }, { v: 'ROOT_CAUSE', l: 'تحليل السبب' },
        { v: 'ACTION_PLANNED', l: 'خطة إجراء' }, { v: 'IN_PROGRESS', l: 'قيد التنفيذ' },
        { v: 'VERIFICATION', l: 'تحقق' }, { v: 'CLOSED', l: 'مغلق' },
      ]},
      // ISO 10.2 — التحقق من فعالية الإجراء التصحيحي (مطلوب للإغلاق)
      { key: 'verifiedAt', label: '📋 تاريخ التحقق من الفعالية', type: 'date' },
      { key: 'effective', label: '✅ هل الإجراء فعّال؟', type: 'select', hint: 'التحقق من أن الإجراء منع التكرار — مطلوب للإغلاق (ISO 10.2.2)', options: [
        { v: '', l: '— لم يُقيَّم —' },
        { v: 'true',  l: 'نعم — فعّال' },
        { v: 'false', l: 'لا — يحتاج إعادة معالجة' },
      ]},
      { key: 'verifiedNote', label: 'ملاحظات التحقق', type: 'textarea' },
    ],
  },

  audits: {
    endpoint: 'audits',
    exportable: true,
    sigAction: true,
    statusOptions: [
      { v: '', l: 'كل الحالات' },
      { v: 'PLANNED', l: 'مخطط' },
      { v: 'IN_PROGRESS', l: 'قيد التنفيذ' },
      { v: 'COMPLETED', l: 'مكتمل' },
      { v: 'CANCELLED', l: 'ملغى' },
    ],
    cols: [
      { key: 'code', label: 'الرمز' }, { key: 'title', label: 'العنوان' },
      { key: 'type', label: 'النوع' }, { key: 'plannedDate', label: 'التاريخ المخطط', type: 'date' },
      { key: 'status', label: 'الحالة', type: 'status' },
    ],
    fields: [
      { key: 'title', label: 'العنوان', required: true },
      { key: 'type', label: 'النوع', type: 'select', options: [
        { v: 'INTERNAL', l: 'داخلي' }, { v: 'EXTERNAL', l: 'خارجي' },
        { v: 'SUPPLIER', l: 'موردين' }, { v: 'FOLLOWUP', l: 'متابعة' },
      ]},
      { key: 'scope', label: 'النطاق', type: 'textarea', required: true },
      { key: 'criteria', label: 'المعايير' },
      { key: 'plannedDate', label: 'تاريخ التخطيط', type: 'date', required: true },
      { key: 'actualDate', label: 'التاريخ الفعلي', type: 'date' },
      { key: 'leadAuditorId', label: 'رئيس فريق التدقيق', type: 'relation', rel: 'users' },
      { key: 'team', label: 'فريق التدقيق (الأسماء مفصولة بفواصل)' },
      { key: 'findings', label: 'النتائج', type: 'textarea' },
      { key: 'strengths', label: 'نقاط القوة', type: 'textarea' },
      { key: 'weaknesses', label: 'نقاط التحسين', type: 'textarea' },
      { key: 'reportUrl', label: 'رابط التقرير' },
      { key: 'status', label: 'الحالة', type: 'select', options: [
        { v: 'PLANNED', l: 'مخطط' }, { v: 'IN_PROGRESS', l: 'قيد التنفيذ' },
        { v: 'COMPLETED', l: 'مكتمل' }, { v: 'CANCELLED', l: 'ملغى' },
      ]},
    ],
  },

  suppliers: {
    endpoint: 'suppliers',
    exportable: true,
    evalAction: true,
    statusOptions: [
      { v: '', l: 'كل الحالات' },
      { v: 'PENDING', l: 'قيد المراجعة' },
      { v: 'APPROVED', l: 'معتمد' },
      { v: 'CONDITIONAL', l: 'مشروط' },
      { v: 'REJECTED', l: 'مرفوض' },
      { v: 'SUSPENDED', l: 'موقوف' },
      { v: 'BLACKLISTED', l: 'مستبعد' },
    ],
    cols: [
      { key: 'code', label: 'الرمز' }, { key: 'name', label: 'الاسم' },
      { key: 'type', label: 'النوع' }, { key: 'overallRating', label: 'التقييم' },
      { key: 'status', label: 'الحالة', type: 'status' },
    ],
    fields: [
      { key: 'name', label: 'الاسم', required: true },
      { key: 'type', label: 'النوع', type: 'select', options: [
        { v: 'GOODS', l: 'بضائع' }, { v: 'SERVICES', l: 'خدمات' },
        { v: 'CONSTRUCTION', l: 'مقاولات وبناء' }, { v: 'IT_SERVICES', l: 'خدمات تقنية المعلومات' },
        { v: 'IN_KIND_DONOR', l: 'مورد تبرعات عينية' }, { v: 'TRANSPORT', l: 'نقل' },
        { v: 'CONSULTING', l: 'استشارات' }, { v: 'OTHER', l: 'أخرى' },
      ]},
      { key: 'crNumber', label: 'السجل التجاري', hint: 'رقم السجل التجاري السعودي — 10 أرقام بالضبط' },
      { key: 'vatNumber', label: 'الرقم الضريبي' },
      { key: 'contactPerson', label: 'الشخص المسؤول' },
      { key: 'phone', label: 'الجوال' },
      { key: 'email', label: 'البريد', type: 'email' },
      { key: 'address', label: 'العنوان' },
      { key: 'city', label: 'المدينة' },
      { key: 'status', label: 'الحالة', type: 'select', options: [
        { v: 'PENDING', l: 'قيد المراجعة' }, { v: 'APPROVED', l: 'معتمد' },
        { v: 'CONDITIONAL', l: 'مشروط' }, { v: 'REJECTED', l: 'مرفوض' },
        { v: 'SUSPENDED', l: 'موقوف' }, { v: 'BLACKLISTED', l: 'مستبعد' },
      ]},
    ],
  },

  donations: {
    endpoint: 'donations',
    exportable: true,
    statusOptions: [
      { v: '', l: 'كل الحالات' },
      { v: 'RECEIVED', l: 'مستلم' },
      { v: 'VERIFIED', l: 'مدقق' },
      { v: 'DISTRIBUTED', l: 'موزع' },
      { v: 'REJECTED', l: 'مرفوض' },
    ],
    cols: [
      { key: 'code', label: 'الرمز' }, { key: 'donorName', label: 'المتبرع' },
      { key: 'type', label: 'النوع' }, { key: 'amount', label: 'المبلغ' },
      { key: 'itemName', label: 'الصنف' }, { key: 'status', label: 'الحالة', type: 'status' },
    ],
    fields: [
      { key: 'donorName', label: 'اسم المتبرع', required: true },
      { key: 'donorType', label: 'جهة التبرع', type: 'select', options: [
        { v: 'individual', l: 'فرد طبيعي' },
        { v: 'company', l: 'شركة / مؤسسة تجارية' },
        { v: 'government', l: 'جهة حكومية' },
        { v: 'charity', l: 'جمعية / مؤسسة خيرية' },
        { v: 'sponsorship', l: 'كفيل / كفالة' },
        { v: 'general', l: 'تبرع عام' },
        { v: 'project', l: 'تبرع لمشروع' },
        { v: 'beneficiary', l: 'تبرع لمستفيد' },
      ]},
      { key: 'donorPhone', label: 'الجوال' },
      { key: 'donorEmail', label: 'البريد' },
      { key: 'type', label: 'نوع التبرع', type: 'select', options: [
        { v: 'CASH', l: 'نقدي' }, { v: 'IN_KIND', l: 'عيني' }, { v: 'SERVICE', l: 'خدمة' },
      ]},
      { key: 'itemName', label: 'اسم الصنف (للعيني)' },
      { key: 'quantity', label: 'الكمية', type: 'number' },
      { key: 'unit', label: 'الوحدة' },
      { key: 'amount', label: 'المبلغ (ريال)', type: 'number' },
      { key: 'currency', label: 'العملة', type: 'select', options: [
        { v: 'SAR', l: 'ريال سعودي (SAR)' },
        { v: 'USD', l: 'دولار أمريكي (USD)' },
        { v: 'OTHER', l: 'أخرى' },
      ]},
      { key: 'receivedAt', label: 'تاريخ الاستلام', type: 'date', maxToday: true },
      { key: 'receivedBy', label: 'استلم بواسطة' },
      { key: 'notes', label: 'ملاحظات / البيان', type: 'textarea' },
      { key: 'status', label: 'الحالة', type: 'select', options: [
        { v: 'RECEIVED', l: 'مستلم' }, { v: 'VERIFIED', l: 'مدقق / معتمد' },
        { v: 'DISTRIBUTED', l: 'موزع' }, { v: 'REJECTED', l: 'مرفوض' },
      ]},
    ],
  },

  beneficiaries: {
    endpoint: 'beneficiaries',
    exportable: true,
    statusOptions: [
      { v: '', l: 'كل الحالات' },
      { v: 'APPLICANT', l: 'متقدم' },
      { v: 'ACTIVE', l: 'نشط' },
      { v: 'INACTIVE', l: 'غير نشط' },
      { v: 'GRADUATED', l: 'تخرج' },
      { v: 'REJECTED', l: 'مرفوض' },
    ],
    cols: [
      { key: 'code', label: 'الرمز' }, { key: 'fullName', label: 'الاسم' },
      { key: 'category', label: 'الفئة' }, { key: 'city', label: 'المدينة' },
      { key: 'status', label: 'الحالة', type: 'status' },
    ],
    fields: [
      { key: 'fullName', label: 'الاسم الكامل', required: true },
      { key: 'nationalId', label: 'الهوية الوطنية' },
      { key: 'category', label: 'الفئة', hint: 'أ=يتيم | ب=أرملة | ج=أسرة فقيرة | د=أخرى', type: 'select', options: [
        { v: 'ORPHAN', l: 'أ — يتيم' },
        { v: 'WIDOW', l: 'ب — أرملة' },
        { v: 'POOR_FAMILY', l: 'ج — أسرة فقيرة' },
        { v: 'DISABLED', l: 'ذو إعاقة' },
        { v: 'ELDERLY', l: 'مسن' },
        { v: 'STUDENT', l: 'طالب' },
        { v: 'OTHER', l: 'د — أخرى / متنوع' },
      ]},
      { key: 'gender', label: 'الجنس', type: 'select', options: [
        { v: 'ذكر', l: 'ذكر' }, { v: 'أنثى', l: 'أنثى' },
      ]},
      { key: 'birthDate', label: 'تاريخ الميلاد', type: 'date' },
      { key: 'phone', label: 'الجوال' },
      { key: 'city', label: 'المدينة' },
      { key: 'district', label: 'الحي' },
      { key: 'familySize', label: 'عدد أفراد الأسرة', type: 'number' },
      { key: 'monthlyIncome', label: 'الدخل الشهري', type: 'number' },
      // P-08 §3 — تقييم الاحتياجات (ISO 8.2)
      { key: 'needsAssessment', label: '📋 تقييم الاحتياجات', type: 'textarea',
        hint: 'اوصف الاحتياجات الفعلية (سكن/تعليم/علاج/غذاء) قبل الاعتماد' },
      { key: 'priorityScore', label: 'درجة الأولوية (1-5)', type: 'number',
        hint: '1=منخفضة · 5=عاجلة جداً' },
      { key: 'vulnerabilityFlags', label: 'مؤشرات الحماية', type: 'textarea',
        hint: 'اختر ما ينطبق مفصولاً بفاصلة: طفل_بلا_معيل، إعاقة_شديدة، مرض_مزمن، عنف_أسري، نزوح' },
      { key: 'assessedBy', label: 'أجرى التقييم' },
      { key: 'assessedAt', label: 'تاريخ التقييم', type: 'date' },
      { key: 'status', label: 'الحالة', type: 'select', options: [
        { v: 'APPLICANT', l: 'متقدم' }, { v: 'ACTIVE', l: 'نشط' },
        { v: 'INACTIVE', l: 'غير نشط' }, { v: 'GRADUATED', l: 'تخرج' },
        { v: 'REJECTED', l: 'مرفوض' },
      ]},
    ],
    rowActions: [
      { action: 'openBeneficiaryAssess', label: '📋 تقييم', condition: () => true },
    ],
  },

  improvementProjects: {
    endpoint: 'improvement-projects',
    exportable: true,
    statusOptions: [
      { v: '', l: 'كل الحالات' },
      { v: 'PROPOSED',  l: 'مقترح' },
      { v: 'APPROVED',  l: 'معتمد' },
      { v: 'ACTIVE',    l: 'نشط' },
      { v: 'SUSPENDED', l: 'مُعلَّق' },
      { v: 'COMPLETED', l: 'مكتمل' },
      { v: 'FAILED',    l: 'فشل' },
    ],
    cols: [
      { key: 'code', label: 'الرمز' },
      { key: 'title', label: 'العنوان' },
      { key: 'phase', label: 'مرحلة PDCA' },
      { key: 'status', label: 'الحالة', type: 'status' },
    ],
    fields: [
      { key: 'title', label: 'عنوان المشروع', required: true },
      { key: 'description', label: 'الوصف', type: 'textarea' },
      { key: 'sourceType', label: 'مصدر الفكرة', type: 'select', options: [
        { v: '', l: '—' },
        { v: 'NCR',       l: 'عدم مطابقة' },
        { v: 'COMPLAINT', l: 'شكوى' },
        { v: 'AUDIT',     l: 'تدقيق' },
        { v: 'REVIEW',    l: 'مراجعة إدارية' },
        { v: 'EMPLOYEE',  l: 'اقتراح موظف' },
        { v: 'OTHER',     l: 'أخرى' },
      ]},
      { key: 'sourceRef', label: 'مرجع المصدر (رمز)' },
      { key: 'ownerId',      label: 'مالك المشروع', type: 'relation', rel: 'users' },
      { key: 'departmentId', label: 'القسم',         type: 'relation', rel: 'departments' },
      { key: 'planDetails', label: '[Plan] الخطة: الهدف، النطاق، الموارد', type: 'textarea',
        hint: 'اذكر الهدف القابل للقياس (SMART) والموارد اللازمة والإطار الزمني' },
      { key: 'planTarget',  label: '[Plan] المستهدف القابل للقياس' },
      { key: 'doDetails',   label: '[Do] التنفيذ: ما نُفِّذ فعلياً', type: 'textarea',
        hint: 'يُكتب بعد التنفيذ على نطاق محدود' },
      { key: 'checkResults',label: '[Check] نتائج القياس مقابل الهدف', type: 'textarea' },
      { key: 'actDecision', label: '[Act] القرار: تعميم / إعادة / إيقاف', type: 'textarea' },
      { key: 'lessonsLearned', label: 'الدروس المستفادة (ISO 10.3)', type: 'textarea' },
      { key: 'startDate', label: 'تاريخ البدء',    type: 'date' },
      { key: 'endDate',   label: 'تاريخ الانتهاء', type: 'date' },
      { key: 'status', label: 'الحالة', type: 'select', options: [
        { v: 'PROPOSED',  l: 'مقترح' }, { v: 'APPROVED', l: 'معتمد' },
        { v: 'ACTIVE',    l: 'نشط' },   { v: 'SUSPENDED', l: 'مُعلَّق' },
        { v: 'COMPLETED', l: 'مكتمل' }, { v: 'FAILED',    l: 'فشل' },
      ]},
    ],
  },

  auditChecklists: {
    endpoint: 'audit-checklists',
    cols: [
      { key: 'code', label: 'الرمز' },
      { key: 'title', label: 'عنوان القالب' },
      { key: 'isoClauses', label: 'بنود ISO' },
      { key: 'active', label: 'مفعَّل', type: 'bool' },
    ],
    fields: [
      { key: 'title', label: 'عنوان القالب', required: true, hint: 'مثال: تدقيق بنود ISO 8 (التشغيل)' },
      { key: 'description', label: 'وصف القالب', type: 'textarea' },
      { key: 'isoClauses', label: 'بنود ISO المُغطّاة', hint: 'مفصولة بفاصلة: 8.1, 8.2, 8.4' },
      { key: 'itemsJson', label: 'قائمة الأسئلة (JSON)', type: 'textarea', required: true,
        hint: 'مصفوفة JSON — مثال: [{"q":"هل يوجد دليل على...","clause":"8.2","evidenceType":"DOC","critical":true}]' },
      { key: 'active', label: 'مفعَّل', type: 'bool' },
    ],
  },

  // ── إطار الإقرارات الموحَّد (سياسات ومواثيق) — إدارة للمسؤول ─────
  ackDocuments: {
    endpoint: 'ack-documents',
    exportable: true,
    statusOptions: [
      { v: '', l: 'الكل' },
      { v: 'active', l: 'مُفعَّلة فقط' },
    ],
    cols: [
      { key: 'code', label: 'الرمز' },
      { key: 'title', label: 'العنوان' },
      { key: 'category', label: 'الفئة' },
      { key: 'version', label: 'الإصدار' },
      { key: 'active', label: 'مُفعَّلة', type: 'bool' },
      { key: 'mandatory', label: 'إلزامية', type: 'bool' },
    ],
    fields: [
      { key: 'title', label: 'عنوان الوثيقة', required: true },
      { key: 'category', label: 'الفئة', type: 'select', required: true, options: [
        { v: 'QUALITY_POLICY',       l: 'سياسة الجودة' },
        { v: 'CODE_OF_ETHICS',       l: 'الميثاق الأخلاقي' },
        { v: 'CONFLICT_OF_INTEREST', l: 'تضارب المصالح' },
        { v: 'CONFIDENTIALITY',     l: 'السرية (NDA)' },
        { v: 'DATA_PROTECTION',     l: 'حماية البيانات الشخصية' },
        { v: 'SAFEGUARDING',         l: 'الحماية للفئات الضعيفة' },
        { v: 'ANTI_HARASSMENT',     l: 'مكافحة التحرش' },
        { v: 'ANTI_CORRUPTION',     l: 'مكافحة الفساد' },
        { v: 'WHISTLEBLOWER',       l: 'الإبلاغ عن المخالفات' },
        { v: 'WORK_REGULATIONS',    l: 'لائحة العمل' },
        { v: 'HEALTH_SAFETY',       l: 'الصحة والسلامة' },
        { v: 'IT_USAGE',            l: 'استخدام التقنية' },
        { v: 'SOCIAL_MEDIA',         l: 'التواصل الاجتماعي' },
        { v: 'BOARD_CHARTER',       l: 'ميثاق مجلس الإدارة' },
        { v: 'BYLAWS',              l: 'النظام الأساسي' },
        { v: 'BENEFICIARY_RIGHTS',  l: 'حقوق المستفيد' },
        { v: 'BENEFICIARY_CONSENT', l: 'موافقة المستفيد' },
        { v: 'SUPPLIER_CODE',       l: 'ميثاق الموردين' },
        { v: 'DONOR_PRIVACY',       l: 'خصوصية المتبرع' },
        { v: 'VOLUNTEER_AGREEMENT', l: 'اتفاقية التطوع' },
        { v: 'OTHER',               l: 'أخرى' },
      ]},
      { key: 'audience', label: 'الفئة المستهدفة', type: 'multiselect', required: true, options: [
        { v: 'EMPLOYEE',          l: 'الموظفون' },
        { v: 'VOLUNTEER',         l: 'المتطوعون' },
        { v: 'BOARD_MEMBER',     l: 'أعضاء مجلس الإدارة' },
        { v: 'GENERAL_ASSEMBLY', l: 'الجمعية العمومية' },
        { v: 'BENEFICIARY',      l: 'المستفيدون' },
        { v: 'SUPPLIER',         l: 'الموردون' },
        { v: 'DONOR',            l: 'المتبرعون' },
        { v: 'AUDITOR',          l: 'المدقّقون' },
        { v: 'ALL',              l: 'الجميع' },
      ]},
      { key: 'version', label: 'الإصدار', required: true, hint: '1.0' },
      { key: 'renewFrequency', label: 'تكرار التجديد', type: 'select', options: [
        { v: 'ONCE',      l: 'مرة واحدة (عند التعيين)' },
        { v: 'ANNUAL',    l: 'سنوي' },
        { v: 'ON_CHANGE', l: 'فقط عند تغيّر الإصدار' },
      ]},
      { key: 'mandatory', label: 'إلزامية', type: 'bool' },
      { key: 'effectiveDate', label: 'تاريخ النفاذ', type: 'date' },
      { key: 'reviewDate', label: 'تاريخ المراجعة القادمة', type: 'date' },
      { key: 'approvedBy', label: 'الجهة المُعتمِدة' },
      { key: 'content', label: 'نص الوثيقة الكامل', type: 'textarea', required: true,
        hint: 'النص الكامل للسياسة/الميثاق (يدعم Markdown)' },
      { key: 'commitments', label: 'التعهدات (اختياري)', type: 'textarea' },
      { key: 'active', label: 'مُفعَّلة', type: 'bool',
        hint: 'لا تُفعّل إلا بعد اعتمادها من الإدارة — عند التفعيل يُطلب الإقرار من المستهدفين' },
    ],
  },

  performanceReviews: {
    endpoint: 'performance-reviews',
    exportable: true,
    sigAction: true,
    statusOptions: [
      { v: '', l: 'كل الحالات' },
      { v: 'DRAFT', l: 'مسودة' },
      { v: 'EMPLOYEE_REVIEW', l: 'بانتظار توقيع الموظف' },
      { v: 'FINALIZED', l: 'نهائي' },
    ],
    cols: [
      { key: 'code', label: 'الرمز' },
      { key: 'period', label: 'الفترة' },
      { key: 'overallRating', label: 'المعدل' },
      { key: 'grade', label: 'التقدير' },
      { key: 'status', label: 'الحالة', type: 'status' },
    ],
    fields: [
      { key: 'employeeId',  label: 'الموظف المُقيَّم',  type: 'relation', rel: 'users', required: true },
      { key: 'reviewerId',  label: 'المُقيِّم',           type: 'relation', rel: 'users', hint: 'يختلف عن الموظف (ISO 7.1.2)' },
      { key: 'period',      label: 'الفترة',            required: true, hint: 'مثال: 2026 أو Q1-2026' },
      { key: 'periodStart', label: 'بداية الفترة', type: 'date', required: true },
      { key: 'periodEnd',   label: 'نهاية الفترة', type: 'date', required: true },
      { key: 'jobKnowledge',  label: '1) المعرفة بالعمل (1-5)',   type: 'number', min:1, max:5, step:1, hint: '1=ضعيف · 5=ممتاز' },
      { key: 'qualityOfWork', label: '2) جودة العمل (1-5)',       type: 'number', min:1, max:5, step:1 },
      { key: 'productivity',  label: '3) الإنتاجية (1-5)',         type: 'number', min:1, max:5, step:1 },
      { key: 'teamwork',      label: '4) العمل الجماعي (1-5)',     type: 'number', min:1, max:5, step:1 },
      { key: 'communication', label: '5) التواصل (1-5)',           type: 'number', min:1, max:5, step:1 },
      { key: 'initiative',    label: '6) المبادرة (1-5)',           type: 'number', min:1, max:5, step:1 },
      { key: 'reliability',   label: '7) الالتزام والموثوقية (1-5)', type: 'number', min:1, max:5, step:1 },
      { key: 'strengths',       label: 'نقاط القوة',        type: 'textarea' },
      { key: 'areasToImprove',  label: 'مجالات التحسين',    type: 'textarea' },
      { key: 'goalsNextPeriod', label: 'أهداف الفترة القادمة', type: 'textarea' },
      { key: 'developmentPlan', label: 'خطة التطوير والتدريب', type: 'textarea' },
      { key: 'employeeComments',label: 'تعليق الموظف',       type: 'textarea', hint: 'يُكتَب بعد استلام الموظف للتقييم' },
    ],
  },

  programs: {
    endpoint: 'programs',
    cols: [
      { key: 'code', label: 'الرمز' }, { key: 'name', label: 'البرنامج' },
      { key: 'category', label: 'الفئة' }, { key: 'budget', label: 'الميزانية' },
      { key: 'beneficiariesCount', label: 'المستفيدون' },
    ],
    fields: [
      { key: 'name', label: 'اسم البرنامج', required: true },
      { key: 'description', label: 'الوصف', type: 'textarea' },
      { key: 'category', label: 'نوع البرنامج', type: 'select', options: [
        { v: 'سلة_غذائية', l: 'سلة غذائية' },
        { v: 'كسوة_موسمية', l: 'كسوة موسمية (العيد / الشتاء)' },
        { v: 'كفالة_يتيم', l: 'كفالة يتيم' },
        { v: 'كفالة_أرملة', l: 'كفالة أرملة' },
        { v: 'مساعدة_إسكان', l: 'مساعدة سكنية' },
        { v: 'مساعدة_علاج', l: 'مساعدة علاجية' },
        { v: 'مساعدة_تعليم', l: 'دعم تعليمي' },
        { v: 'توزيع_رمضاني', l: 'توزيع رمضاني' },
        { v: 'زكاة_فطر', l: 'زكاة الفطر' },
        { v: 'أضحية', l: 'توزيع أضاحي' },
        { v: 'مشروع_دخل', l: 'مشروع توليد دخل' },
        { v: 'تأهيل_وتدريب', l: 'تأهيل وتدريب' },
        { v: 'إغاثي', l: 'إغاثة طارئة' },
        { v: 'أخرى', l: 'أخرى' },
      ]},
      { key: 'startDate', label: 'تاريخ البداية', type: 'date', required: true },
      { key: 'endDate', label: 'تاريخ النهاية', type: 'date' },
      { key: 'budget', label: 'الميزانية المرصودة (ريال)', type: 'number' },
      { key: 'spent', label: 'المبلغ المصروف (ريال)', type: 'number' },
      { key: 'beneficiariesCount', label: 'عدد المستفيدين المستهدفين', type: 'number' },
    ],
  },

  documents: {
    endpoint: 'documents',
    quickFilters: [
      { key: 'draft',     label: 'مسودة',          icon: '✏️' },
      { key: 'published', label: 'منشور',          icon: '📘' },
      { key: 'expiring',  label: 'تحتاج مراجعة',   icon: '⏳' },
      { key: 'mine',      label: 'وثائقي',         icon: '👤' },
      { key: 'thisMonth', label: 'هذا الشهر',      icon: '📅' },
    ],
    statusOptions: [
      { v: '', l: 'كل الحالات' },
      { v: 'DRAFT', l: 'مسودة' },
      { v: 'UNDER_REVIEW', l: 'قيد المراجعة' },
      { v: 'APPROVED', l: 'معتمد' },
      { v: 'PUBLISHED', l: 'منشور' },
      { v: 'OBSOLETE', l: 'ملغى' },
    ],
    cols: [
      { key: 'code', label: 'الرمز' }, { key: 'title', label: 'العنوان' },
      { key: 'category', label: 'النوع' }, { key: 'currentVersion', label: 'الإصدار' },
      { key: 'status', label: 'الحالة', type: 'status' },
    ],
    fields: [
      { key: 'title', label: 'العنوان', required: true },
      { key: 'category', label: 'الفئة', type: 'select', options: [
        { v: 'MANUAL', l: 'دليل' }, { v: 'POLICY', l: 'سياسة' },
        { v: 'PROCEDURE', l: 'إجراء' }, { v: 'WORK_INSTRUCTION', l: 'تعليمات عمل' },
        { v: 'FORM', l: 'نموذج' }, { v: 'RECORD', l: 'سجل' }, { v: 'EXTERNAL', l: 'خارجي' },
      ]},
      { key: 'currentVersion', label: 'الإصدار' },
      { key: 'departmentId', label: 'الإدارة', type: 'relation', rel: 'departments' },
      { key: 'effectiveDate', label: 'تاريخ السريان', type: 'date' },
      { key: 'reviewDate', label: 'تاريخ المراجعة التالية', type: 'date', hint: 'حدد تاريخاً دورياً (سنوياً أو عند التغيير) — ISO 7.5.3.2' },
      { key: 'retentionYears', label: 'مدة الاحتفاظ (سنوات)', type: 'number', hint: 'المدة الزمنية لحفظ الوثيقة قبل الإتلاف — ISO 7.5.3.2' },
      { key: 'isoClause', label: 'البند ISO', hint: 'مثال: 5.2، 6.1، 7.5، 8.4 — يُسهّل الاسترجاع أثناء التدقيق' },
      { key: 'status', label: 'الحالة', type: 'select', options: [
        { v: 'DRAFT', l: 'مسودة' }, { v: 'UNDER_REVIEW', l: 'قيد المراجعة' },
        { v: 'OBSOLETE', l: 'ملغى' },
      ], hint: 'الاعتماد والنشر يتم من خلال زر الاعتماد الرسمي' },
    ],
    rowActions: [
      { action: 'approveDoc', label: '✅ اعتماد', condition: (it) => it.status === 'UNDER_REVIEW' },
      { action: 'publishDoc', label: '📢 نشر',    condition: (it) => it.status === 'APPROVED' },
    ],
  },

  training: {
    endpoint: 'training',
    exportable: true,
    cols: [
      { key: 'code', label: 'الرمز' }, { key: 'title', label: 'الدورة' },
      { key: 'trainer', label: 'المدرب' }, { key: 'date', label: 'التاريخ', type: 'date' },
    ],
    fields: [
      { key: 'title', label: 'عنوان الدورة', required: true },
      { key: 'description', label: 'الوصف', type: 'textarea' },
      { key: 'trainer', label: 'المدرب' },
      { key: 'date', label: 'التاريخ', type: 'date', required: true },
      { key: 'duration', label: 'المدة (ساعات)', type: 'number' },
      { key: 'location', label: 'المكان' },
      { key: 'category', label: 'تصنيف التدريب', type: 'select', options: [
        { v: 'جودة_وإجراءات', l: 'جودة وإجراءات العمل (ISO 9001)' },
        { v: 'رعاية_اجتماعية', l: 'رعاية اجتماعية وخدمة المستفيدين' },
        { v: 'إدارة_تبرعات', l: 'إدارة التبرعات والعلاقات مع المتبرعين' },
        { v: 'مهارات_تطوعية', l: 'مهارات قيادة العمل التطوعي' },
        { v: 'سلامة_وصحة', l: 'السلامة والصحة المهنية' },
        { v: 'تقنية', l: 'مهارات تقنية وحاسوب' },
        { v: 'إدارية', l: 'مهارات إدارية وقيادية' },
        { v: 'حوكمة', l: 'الحوكمة والامتثال المؤسسي' },
        { v: 'أخرى', l: 'أخرى' },
      ]},
      { key: 'competenceTarget', label: 'الكفاءة المستهدفة (ISO 7.2)', hint: 'مثال: تحسين خدمة المستفيدين، إتقان آلية قبول الطلبات' },
    ],
  },

  users: {
    endpoint: 'users',
    cols: [
      { key: 'name', label: 'الاسم' }, { key: 'email', label: 'البريد' },
      { key: 'role', label: 'الدور' }, { key: 'active', label: 'نشط', type: 'bool' },
    ],
    fields: [
      { key: 'name', label: 'الاسم', required: true },
      { key: 'email', label: 'البريد', type: 'email', required: true },
      { key: 'password', label: 'كلمة المرور (جديدة)', type: 'password' },
      { key: 'role', label: 'الدور', type: 'select', options: [
        { v: 'SUPER_ADMIN', l: 'مسؤول النظام' },
        { v: 'QUALITY_MANAGER', l: 'مدير الجودة' },
        { v: 'COMMITTEE_MEMBER', l: 'عضو لجنة جودة' },
        { v: 'DEPT_MANAGER', l: 'مسؤول قسم' },
        { v: 'EMPLOYEE', l: 'موظف' },
        { v: 'GUEST_AUDITOR', l: 'مدقق ضيف' },
      ]},
      { key: 'phone', label: 'الجوال' },
      { key: 'jobTitle', label: 'المسمى الوظيفي' },
    ],
  },

  departments: {
    endpoint: 'departments',
    cols: [
      { key: 'code', label: 'الرمز' }, { key: 'name', label: 'الاسم' },
      { key: 'manager', label: 'المسؤول' }, { key: 'active', label: 'نشط', type: 'bool' },
    ],
    fields: [
      { key: 'code', label: 'الرمز', required: true },
      { key: 'name', label: 'الاسم', required: true },
      { key: 'nameEn', label: 'الاسم بالإنجليزية' },
      { key: 'manager', label: 'المسؤول' },
    ],
  },
};

// -------------- Alpine root --------------
function app() {
  return {
    // ── Modules (must come first so inline definitions override if needed) ──
    ...(window.QmsI18n          || {}),
    ...(window.QmsInbox         || {}),
    ...(window.QmsKpiQuickEntry || {}),
    ...(window.QmsKpiBulk       || {}),

    user: null,
    token: null,
    refreshToken: null,

    // ── RBAC helpers (mirror apps/api/src/lib/permissions-matrix.js) ──
    can(resource, action) {
      const role = this.user?.role;
      if (!role) return false;
      const policy = PERMISSIONS[resource]?.[action] || PERMISSIONS_DEFAULT[action];
      return !!policy && policy.includes(role);
    },
    canCreate(r)  { return this.can(r, 'create'); },
    canEdit(r)    { return this.can(r, 'update'); },
    canDelete(r)  { return this.can(r, 'delete'); },
    canApprove(r) { return this.can(r, 'approve'); },
    canClose(r)   { return this.can(r, 'close'); },
    // Current page's resource — derived from the active module endpoint
    get currentResource() {
      const m = MODULES[this.page];
      return m?.endpoint || this.page;
    },
    loginForm: { email: '', password: '' },
    loginError: '',
    loading: false,
    page: 'myWork', // Batch 16: افتراض الدخول على "مهامي اليوم"
    // UI Mode: 'guided' (موجَّه — مهام + wizards) أو 'advanced' (وصول كامل للموارد).
    // افتراضي = advanced للمستخدمين الحاليين (لا كسر في السلوك).
    uiMode: (typeof localStorage !== 'undefined' && localStorage.getItem('qms_ui_mode')) || 'advanced',

    // ─── Command Palette (Ctrl+K) — بحث موحَّد عبر كل النظام ────────
    palette: { open: false, query: '', selectedIdx: 0 },
    search: '',
    items: [],
    auditLog: [],
    auditFilters: { entityType: '', action: '', from: '', to: '' },
    auditPage: 1,
    auditLimit: 100,
    auditTotal: 0,
    auditPages: 1,
    auditEntityOptions: ['User','NCR','Complaint','Document','Risk','Objective','Supplier','SupplierEval','Beneficiary','Survey','Audit','ManagementReview','QualityPolicy','PolicyAcknowledgment','Signature','StrategicGoal','OperationalActivity','KpiEntry'],
    auditActionOptions: ['CREATE','UPDATE','DELETE','LOGIN','LOGOUT','READ','APPROVE','REJECT','SUBMIT','REVIEW','PUBLISH','REOPEN_NCR','REOPEN_COMPLAINT'],

    // Report Builder state
    rb: {
      datasets: [],           // catalog from /report-builder/datasets
      dataset:  '',           // selected dataset key
      columns:  [],           // selected column keys
      filters:  [],           // [{ field, op, value }]
      groupBy:  '',
      aggregations: [],       // [{ field, fn }]
      sort:     [],           // [{ field, dir }]
      limit:    1000,
      running:  false,
      result:   null,         // { mode, rows, columns?, groupBy?, total }
      error:    '',
    },
    rbOps: [
      { v: 'eq',       l: 'يساوي' },
      { v: 'ne',       l: 'لا يساوي' },
      { v: 'in',       l: 'ضمن قائمة' },
      { v: 'contains', l: 'يحتوي' },
      { v: 'gt',       l: 'أكبر من' },
      { v: 'gte',      l: 'أكبر أو يساوي' },
      { v: 'lt',       l: 'أصغر من' },
      { v: 'lte',      l: 'أصغر أو يساوي' },
      { v: 'between',  l: 'بين' },
      { v: 'isNull',   l: 'فارغ' },
      { v: 'isNotNull',l: 'غير فارغ' },
    ],
    rbAggFns: [
      { v: 'sum', l: 'المجموع' },
      { v: 'avg', l: 'المتوسط' },
      { v: 'min', l: 'الأدنى' },
      { v: 'max', l: 'الأعلى' },
    ],
    dashKpis: null,
    dashAlerts: [],
    dashExpiring: [],
    dashActivity: [],
    dashNextReview: null,
    dashChart: null,

    // Pagination
    currentPage: 1,
    perPage: 20,
    totalItems: 0,

    // Filter
    filterStatus: '',
    quickFilter: '',

    // ── Live health alerts (ISO 9.1.3 · org-wide snapshot) ──────────
    // يختلف عن notifications (صندوق بريد المستخدم) — هذه لقطة حيّة مؤسسية.
    liveAlerts: [],
    liveAlertsSummary: { danger: 0, warn: 0, info: 0, total: 0 },
    liveAlertsOpen: false,
    _alertsTimer: null,
    async loadLiveAlerts() {
      if (!this.canSeeAlerts()) return;
      try {
        const r = await this.api('GET', '/alerts');
        this.liveAlerts = r.alerts || [];
        this.liveAlertsSummary = r.summary || { danger: 0, warn: 0, info: 0, total: 0 };
        this.liveAlertsSummary.total = r.total || 0;
      } catch { /* silent — القراءة مقصورة على QM+ */ }
    },
    canSeeAlerts() {
      // نفس قاعدة permissions-matrix: alerts.read = MANAGER_UP
      return _MANAGER_UP.includes(this.user?.role);
    },
    toggleLiveAlerts() {
      this.liveAlertsOpen = !this.liveAlertsOpen;
      if (this.liveAlertsOpen) this.loadLiveAlerts();
    },
    goToAlert(a) {
      this.liveAlertsOpen = false;
      if (!a?.actionUrl) return;
      const m = a.actionUrl.match(/^\/#\/([\w-]+)/);
      if (m) this.goto(m[1]);
    },
    alertSeverityClass(sev) {
      if (sev === 'danger') return 'bg-red-50 border-red-300 text-red-800';
      if (sev === 'warn')   return 'bg-amber-50 border-amber-300 text-amber-800';
      return 'bg-blue-50 border-blue-300 text-blue-800';
    },
    alertSeverityIcon(sev) {
      if (sev === 'danger') return '🔴';
      if (sev === 'warn')   return '🟡';
      return '🔵';
    },
    startAlertsPolling() {
      if (!this.canSeeAlerts()) return;
      if (this._alertsTimer) clearInterval(this._alertsTimer);
      this.loadLiveAlerts();
      // كل 3 دقائق — أسرع من notifications لأن الـ endpoint محسوب حيّاً
      this._alertsTimer = setInterval(() => this.loadLiveAlerts(), 3 * 60 * 1000);
    },

    // ── State-machine cache (Batch 10 support) ───────────────────────
    stateMachines: null,
    async loadStateMachines() {
      if (this.stateMachines) return this.stateMachines;
      try {
        const r = await this.api('GET', '/state-machines');
        this.stateMachines = r.machines || {};
      } catch { this.stateMachines = {}; }
      return this.stateMachines;
    },
    /**
     * إرجاع قائمة الحالات المسموح الانتقال إليها.
     * يُستدعى من قوائم الحالة في النماذج بدلاً من hard-coding كل الخيارات.
     *   allowedNextFor('ncr', 'IN_PROGRESS') → ['VERIFICATION','ACTION_PLANNED','CANCELLED']
     */
    allowedNextFor(entity, from) {
      const m = this.stateMachines?.[entity];
      if (!m) return null;   // غير معروف → اسمح بكل شيء (fallback)
      return m[from] || [];
    },

    /**
     * فلترة خيارات dropdown الحالة ديناميكياً من state-machine.
     * في وضع "create" يعيد كل الخيارات؛ في وضع "edit" يعيد فقط
     * [الحالة الحالية + الحالات المسموح الانتقال إليها].
     */
    statusOptionsFor(f) {
      const all = f.options || [];
      if (f.key !== 'status') return all;
      if (this.modal?.mode !== 'edit') return all;
      const entityMap = { ncr: 'ncr', complaints: 'complaint', audits: 'audit', managementReview: 'management-review' };
      const entity = entityMap[this.page];
      if (!entity) return all;
      const currentStatus = this.modal.data?.status;
      const allowed = this.allowedNextFor(entity, currentStatus);
      if (!allowed) return all;  // لا machine → fallback كل الخيارات
      const keep = new Set([currentStatus, ...allowed]);
      return all.filter(o => keep.has(o.v));
    },

    // ── Digital signature capture (Batch 10 support) ─────────────────
    sigModal: null,  // { entityType, entityId, purpose, label, onDone, dataUrl, busy }

    openSignatureModal({ entityType, entityId, purpose, label, onDone }) {
      this.sigModal = {
        entityType, entityId, purpose, label,
        onDone: onDone || (() => {}),
        dataUrl: '',
        busy: false,
      };
      // canvas setup يتم في next tick بعد ظهور الـ DOM
      this.$nextTick(() => this._initSigCanvas());
    },
    closeSignatureModal() { this.sigModal = null; },

    _initSigCanvas() {
      const cvs = document.getElementById('sigCanvas');
      if (!cvs) return;
      const ctx = cvs.getContext('2d');
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.lineCap  = 'round';
      ctx.strokeStyle = '#1f2937';
      let drawing = false, last = null;
      const getPos = (e) => {
        const rect = cvs.getBoundingClientRect();
        const t = e.touches?.[0];
        const x = (t ? t.clientX : e.clientX) - rect.left;
        const y = (t ? t.clientY : e.clientY) - rect.top;
        return { x: x * cvs.width / rect.width, y: y * cvs.height / rect.height };
      };
      const down = (e) => { e.preventDefault(); drawing = true; last = getPos(e); };
      const move = (e) => {
        if (!drawing) return;
        e.preventDefault();
        const p = getPos(e);
        ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke();
        last = p;
      };
      const up = () => { drawing = false; };
      cvs.addEventListener('mousedown', down); cvs.addEventListener('mousemove', move); cvs.addEventListener('mouseup', up);
      cvs.addEventListener('touchstart', down); cvs.addEventListener('touchmove', move); cvs.addEventListener('touchend', up);
      cvs._ctx = ctx;
    },
    clearSignature() {
      const cvs = document.getElementById('sigCanvas');
      if (cvs) cvs._ctx?.clearRect(0, 0, cvs.width, cvs.height);
      if (this.sigModal) this.sigModal.dataUrl = '';
    },
    async confirmSignature() {
      if (!this.sigModal) return;
      const cvs = document.getElementById('sigCanvas');
      if (!cvs) return;
      const dataUrl = cvs.toDataURL('image/png');
      // اكتشاف التوقيع الفارغ: قارن مع لوحة فارغة
      const empty = document.createElement('canvas');
      empty.width = cvs.width; empty.height = cvs.height;
      if (dataUrl === empty.toDataURL('image/png')) {
        alert('⚠️ الرجاء رسم التوقيع أولاً');
        return;
      }
      this.sigModal.busy = true;
      try {
        await this.api('POST', '/signatures', {
          entityType:    this.sigModal.entityType,
          entityId:      this.sigModal.entityId,
          purpose:       this.sigModal.purpose,
          signatureData: dataUrl,
        });
        const cb = this.sigModal.onDone;
        this.closeSignatureModal();
        this.toast?.('✅ تم تسجيل التوقيع الرقمي', 'success');
        await cb?.();
      } catch (e) {
        alert(e.message || 'فشل حفظ التوقيع');
      } finally {
        if (this.sigModal) this.sigModal.busy = false;
      }
    },

    // ── Notifications inbox (P-06 · ISO 7.4) ────────────────────────
    notifications: [],
    notifUnread: 0,
    notifOpen: false,
    _notifTimer: null,
    async loadNotifications() {
      try {
        const r = await this.api('GET', '/notifications?limit=30');
        this.notifications = r.items || [];
        this.notifUnread = r.unreadCount || 0;
      } catch { /* silent */ }
    },
    async toggleNotifications() {
      this.notifOpen = !this.notifOpen;
      if (this.notifOpen) await this.loadNotifications();
    },
    async openNotification(n) {
      if (!n.readAt) {
        try { await this.api('POST', `/notifications/${n.id}/read`); } catch {}
        n.readAt = new Date().toISOString();
        this.notifUnread = Math.max(0, this.notifUnread - 1);
      }
      this.notifOpen = false;
      // انتقال للرابط الداخلي إن وُجد (مثال: /#/ncr?id=... → nav للصفحة)
      if (n.link) {
        const m = n.link.match(/^\/#\/([\w-]+)/);
        if (m) this.goto(m[1]);
      }
    },
    async readAllNotifications() {
      try {
        await this.api('POST', '/notifications/read-all');
        this.notifications.forEach(n => { if (!n.readAt) n.readAt = new Date().toISOString(); });
        this.notifUnread = 0;
      } catch (e) { alert(e.message || 'فشل القراءة'); }
    },
    startNotifPolling() {
      if (this._notifTimer) clearInterval(this._notifTimer);
      this.loadNotifications();
      this._notifTimer = setInterval(() => this.loadNotifications(), 5 * 60 * 1000); // كل 5 دقائق
    },

    // ── إطار الإقرارات الموحَّد (Ack Documents / Acknowledgments) ────
    myAcks: { pending: [], completed: [], pendingCount: 0 },
    ackMatrix: null, // { docs, users, rows, overall }
    ackMatrixLoading: false,
    ackMatrixError: null,
    ackReadModal: null,          // الوثيقة المفتوحة للقراءة
    ackScrolledToEnd: false,
    ackConfirmRead: false,
    ackSubmitting: false,

    async loadMyAcks() {
      try {
        this.myAcks = await this.api('GET', '/ack-documents/me/pending');
      } catch { this.myAcks = { pending: [], completed: [], pendingCount: 0 }; }
    },

    openAckRead(doc) {
      this.ackReadModal = doc;
      this.ackScrolledToEnd = false;
      this.ackConfirmRead = false;
    },

    closeAckRead() {
      this.ackReadModal = null;
      this.ackScrolledToEnd = false;
      this.ackConfirmRead = false;
    },

    onAckScroll(ev) {
      const el = ev.target;
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 20) {
        this.ackScrolledToEnd = true;
      }
    },

    async submitAcknowledge() {
      if (!this.ackReadModal || !this.ackScrolledToEnd || !this.ackConfirmRead) return;
      this.ackSubmitting = true;
      try {
        await this.api('POST', `/ack-documents/${this.ackReadModal.id}/acknowledge`, {});
        this.toast?.('✅ تم تسجيل إقرارك بالاطّلاع والالتزام');
        this.closeAckRead();
        await this.loadMyAcks();
      } catch (e) {
        alert(e.message || 'فشل تسجيل الإقرار');
      } finally { this.ackSubmitting = false; }
    },

    async activateAckDoc(item) {
      if (!confirm(`تفعيل الوثيقة "${item.title}"؟\nسيُطلب الإقرار من كل المستهدفين.`)) return;
      try {
        await this.api('POST', `/ack-documents/${item.id}/activate`, {});
        this.toast?.('✅ تم تفعيل الوثيقة');
        await this.load?.();
      } catch (e) { alert(e.message || 'فشل التفعيل'); }
    },

    async deactivateAckDoc(item) {
      if (!confirm(`إلغاء تفعيل الوثيقة "${item.title}"؟`)) return;
      try {
        await this.api('POST', `/ack-documents/${item.id}/deactivate`, {});
        this.toast?.('تم إلغاء التفعيل');
        await this.load?.();
      } catch (e) { alert(e.message || 'فشل الإلغاء'); }
    },

    // ── إدارة روابط الإقرار (AckToken) ────────────────────────
    linksModal: null,    // { doc, items, newForm, busy }

    async openLinksModal(doc) {
      this.linksModal = {
        doc,
        items: [],
        loading: true,
        busy: false,
        tab: 'internal',   // internal | external | bulk
        form: { userId: '', externalType: 'EXTERNAL', externalName: '', externalContact: '', sentVia: 'WHATSAPP', expiresAt: '' },
        bulkIds: new Set(),
        bulkSearch: '',
      };
      try {
        const r = await this.api('GET', `/ack-documents/${doc.id}/tokens`);
        this.linksModal.items = r.items || [];
      } catch (e) { console.warn(e); }
      // تحميل المستخدمين النشطين لعرضهم في القوائم
      if (!this.relationOptions.users || !this.relationOptions.users.length) {
        try {
          const u = await this.api('GET', '/users?limit=500&active=true');
          this.relationOptions.users = (u.items || []).filter(x => x.active !== false);
        } catch { this.relationOptions.users = []; }
      }
      this.linksModal.loading = false;
    },

    closeLinksModal() { this.linksModal = null; },

    ackPublicUrl(tok) {
      const base = window.location.origin;
      return `${base}/ack/${tok.token}`;
    },

    async copyAckLink(tok) {
      const url = this.ackPublicUrl(tok);
      try {
        await navigator.clipboard.writeText(url);
        this.toast?.('📋 نُسخ الرابط — الصقه في واتساب أو رسالة', 'success');
      } catch {
        prompt('انسخ الرابط:', url);
      }
    },

    ackWhatsAppUrl(tok) {
      const url = this.ackPublicUrl(tok);
      const who = tok.user?.name || tok.externalName || '';
      const docTitle = this.linksModal?.doc?.title || '';
      const msg = `السلام عليكم ${who}،\nنرجو الاطّلاع على: ${docTitle}\nوالإقرار عبر الرابط التالي:\n${url}\n\nشكراً لتعاونكم.`;
      const phone = (tok.user?.phone || tok.externalContact || '').replace(/\D/g, '');
      return phone
        ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
        : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    },

    async sendViaWhatsApp(tok) {
      window.open(this.ackWhatsAppUrl(tok), '_blank');
      try {
        await this.api('POST', `/ack-documents/${this.linksModal.doc.id}/tokens/${tok.id}/mark-sent`, { sentVia: 'WHATSAPP' });
        tok.sentAt = new Date().toISOString();
        tok.sentVia = 'WHATSAPP';
      } catch {}
    },

    async createAckLink() {
      if (!this.linksModal) return;
      const m = this.linksModal;
      m.busy = true;
      const f = m.form;
      const body = { sentVia: f.sentVia || null };
      if (f.expiresAt) body.expiresAt = f.expiresAt;
      if (m.tab === 'internal') {
        if (!f.userId) { alert('اختر الموظف/العضو'); m.busy = false; return; }
        body.userId = f.userId;
      } else {
        if (!f.externalName) { alert('أدخل اسم الشخص'); m.busy = false; return; }
        body.externalType = f.externalType;
        body.externalName = f.externalName;
        body.externalContact = f.externalContact;
      }
      try {
        const r = await this.api('POST', `/ack-documents/${m.doc.id}/tokens`, body);
        if (r.token) m.items.unshift(r.token);
        m.form = { ...f, userId: '', externalName: '', externalContact: '' };
        this.toast?.('✅ تم إنشاء رابط الإقرار');
      } catch (e) { alert(e.message || 'فشل الإنشاء'); }
      finally { m.busy = false; }
    },

    async createBulkLinks() {
      if (!this.linksModal) return;
      const m = this.linksModal;
      const ids = Array.from(m.bulkIds);
      if (!ids.length) { alert('اختر موظفاً واحداً على الأقل'); return; }
      m.busy = true;
      try {
        const r = await this.api('POST', `/ack-documents/${m.doc.id}/tokens`, {
          userIds: ids,
          sentVia: m.form.sentVia || 'WHATSAPP',
          expiresAt: m.form.expiresAt || undefined,
        });
        const fresh = await this.api('GET', `/ack-documents/${m.doc.id}/tokens`);
        m.items = fresh.items || [];
        m.bulkIds = new Set();
        this.toast?.(`✅ تم إنشاء ${r.count} رابط`);
      } catch (e) { alert(e.message || 'فشل الإنشاء'); }
      finally { m.busy = false; }
    },

    toggleBulkId(id) {
      const s = this.linksModal.bulkIds;
      if (s.has(id)) s.delete(id); else s.add(id);
    },

    // ── Arabic text normalization (يطابق backend utils/normalize.js) ──
    // تحويل كل variants لحرف موحّد حتى بحث "احمد" يطابق "أحمد".
    normalizeArabic(s) {
      if (!s) return '';
      return String(s)
        .replace(/[\u064B-\u0652\u0670\u0640]/g, '') // tashkeel + tatweel
        .replace(/[أإآٱ]/g, 'ا')
        .replace(/ى/g, 'ي')
        .replace(/ئ/g, 'ي')
        .replace(/ؤ/g, 'و')
        .replace(/ة/g, 'ه')
        .toLowerCase()
        .trim();
    },
    // هل النص يُطابق الاستعلام بعد normalize للطرفين؟
    arabicMatches(text, query) {
      if (!query) return true;
      const qn = this.normalizeArabic(query);
      if (!qn) return true;
      return this.normalizeArabic(text).includes(qn);
    },

    bulkFilteredUsers() {
      if (!this.linksModal) return [];
      const q = (this.linksModal.bulkSearch || '').trim();
      const users = this.relationOptions.users || [];
      if (!q) return users;
      // استخدم normalize ليتطابق "احمد" مع "أحمد" و "علي" مع "علي" بعد tashkeel
      return users.filter(u => this.arabicMatches(u.name, q) || this.arabicMatches(u.email, q));
    },

    async deleteAckLink(tok) {
      if (!confirm('حذف الرابط؟')) return;
      try {
        await this.api('DELETE', `/ack-documents/${this.linksModal.doc.id}/tokens/${tok.id}`);
        this.linksModal.items = this.linksModal.items.filter(x => x.id !== tok.id);
      } catch (e) { alert(e.message); }
    },

    async quickAckLink(userId, docId) {
      // إنشاء سريع لرابط إقرار ثم فتح modal لنسخه/إرساله
      try {
        const r = await this.api('POST', `/ack-documents/${docId}/tokens`, { userId, sentVia: 'WHATSAPP' });
        const doc = (this.ackMatrix?.docs || []).find(d => d.id === docId);
        if (doc) {
          await this.openLinksModal(doc);
          // تركيز على الرابط المنشأ
          this.toast?.('✅ تم إنشاء الرابط — استخدم 📋 لنسخه أو 📱 لإرساله عبر واتساب');
        }
      } catch (e) { alert(e.message || 'فشل إنشاء الرابط'); }
    },

    async loadAckMatrix() {
      this.ackMatrixLoading = true;
      this.ackMatrixError = null;
      try {
        this.ackMatrix = await this.api('GET', '/ack-documents/matrix');
      } catch (e) {
        console.warn('matrix failed', e);
        this.ackMatrix = null;
        this.ackMatrixError = e?.message || 'تعذّر تحميل المصفوفة — تأكّد من تشغيل prisma db push وإنشاء جداول الإقرارات.';
      } finally {
        this.ackMatrixLoading = false;
      }
    },

    // اسم مختصر للفئة (لعرض لطيف)
    ackCategoryLabel(cat) {
      const map = {
        QUALITY_POLICY:'سياسة الجودة', CODE_OF_ETHICS:'ميثاق أخلاقي',
        CONFLICT_OF_INTEREST:'تضارب مصالح', CONFIDENTIALITY:'سرية',
        DATA_PROTECTION:'حماية بيانات', SAFEGUARDING:'حماية (فئات ضعيفة)',
        ANTI_HARASSMENT:'مكافحة تحرش', ANTI_CORRUPTION:'مكافحة فساد',
        WHISTLEBLOWER:'إبلاغ عن مخالفات', WORK_REGULATIONS:'لائحة عمل',
        HEALTH_SAFETY:'صحة وسلامة', IT_USAGE:'استخدام تقنية',
        SOCIAL_MEDIA:'تواصل اجتماعي', BOARD_CHARTER:'ميثاق مجلس',
        BYLAWS:'نظام أساسي', BENEFICIARY_RIGHTS:'حقوق مستفيد',
        BENEFICIARY_CONSENT:'موافقة مستفيد', SUPPLIER_CODE:'ميثاق مورّدين',
        DONOR_PRIVACY:'خصوصية متبرّع', VOLUNTEER_AGREEMENT:'اتفاقية تطوّع',
        OTHER:'أخرى',
      };
      return map[cat] || cat;
    },
    ackAudienceLabel(aud) {
      const map = {
        EMPLOYEE:'موظفون', VOLUNTEER:'متطوعون', BOARD_MEMBER:'مجلس إدارة',
        GENERAL_ASSEMBLY:'جمعية عمومية', BENEFICIARY:'مستفيدون',
        SUPPLIER:'مورّدون', DONOR:'متبرّعون', AUDITOR:'مدقّقون', ALL:'الجميع',
      };
      return map[aud] || aud;
    },

    // ── Policy acknowledgment (P-02 §3.4 · ISO 5.2.2(b)) ────────────
    policyAck: null, // { hasActivePolicy, acknowledged, policy }
    policyAckModalOpen: false,
    policyAckScrolledToEnd: false,
    policyAckConfirmRead: false,
    policyAckSubmitting: false,
    async loadPolicyAck() {
      try {
        this.policyAck = await this.api('GET', '/policy-ack/me');
        // Auto-open modal if acknowledgment is required
        if (this.policyAck?.hasActivePolicy && !this.policyAck?.acknowledged) {
          this.openPolicyAckModal();
        }
      } catch { this.policyAck = null; }
    },
    openPolicyAckModal() {
      this.policyAckScrolledToEnd = false;
      this.policyAckConfirmRead = false;
      this.policyAckModalOpen = true;
      // auto-scroll handler wired in template via @scroll
    },
    onPolicyAckScroll(ev) {
      const el = ev.target;
      // Consider "read" when within 20px of bottom
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 20) {
        this.policyAckScrolledToEnd = true;
      }
    },
    async acknowledgePolicy() {
      if (!this.policyAckScrolledToEnd || !this.policyAckConfirmRead) return;
      this.policyAckSubmitting = true;
      try {
        await this.api('POST', '/policy-ack', {});
        this.toast?.('✅ تم تسجيل إقرارك بالاطّلاع والالتزام بسياسة الجودة');
        this.policyAckModalOpen = false;
        await this.api('GET', '/policy-ack/me').then(r => this.policyAck = r).catch(() => {});
      } catch (e) {
        alert(e.message || 'فشل تسجيل الإقرار');
      } finally {
        this.policyAckSubmitting = false;
      }
    },
    get needsPolicyAck() {
      return this.policyAck?.hasActivePolicy && !this.policyAck?.acknowledged;
    },

    // Soft-delete visibility toggle (privileged roles only)
    showDeleted: false,

    get canViewDeleted() {
      return ['SUPER_ADMIN','QUALITY_MANAGER'].includes(this.user?.role);
    },
    async restoreItem(item) {
      if (!confirm(`استعادة السجل "${item.code || item.title || item.id}"؟`)) return;
      try {
        await this.api('POST', `/${this.currentModule.endpoint}/${item.id}/restore`);
        this.toast?.('✅ تم استعادة السجل');
        await this.loadList();
      } catch (e) { alert(e.message || 'فشل الاستعادة'); }
    },
    async purgeItem(item) {
      if (!confirm(`حذف نهائي للسجل "${item.code || item.title || item.id}"؟\n⚠️ لا يمكن التراجع.`)) return;
      if (!confirm('هل أنت متأكد تماماً؟ هذا الإجراء دائم ولن يتم تسجيله إلا في سجل التدقيق.')) return;
      try {
        await this.api('DELETE', `/${this.currentModule.endpoint}/${item.id}/purge`);
        this.toast?.('🗑️ تم الحذف النهائي');
        await this.loadList();
      } catch (e) { alert(e.message || 'فشل الحذف النهائي'); }
    },

    // ── Improvement Projects PDCA (P-15 · ISO 10.3) ─────────────────
    async pdcaAdvance(item) {
      const nextMap = { PLAN:'DO', DO:'CHECK', CHECK:'ACT', ACT:'CLOSED' };
      const next = nextMap[item.phase];
      if (!next) return alert('المشروع في مرحلته النهائية');
      if (!confirm(`الانتقال من "${item.phase}" إلى "${next}"؟\nتأكد من تعبئة حقول المرحلة الحالية أولاً.`)) return;
      try {
        await this.api('POST', `/improvement-projects/${item.id}/advance`);
        this.toast?.(`✅ انتقل المشروع إلى ${next}`);
        await this.loadList();
      } catch (e) { alert(e.message || 'فشل الانتقال'); }
    },
    async pdcaRestart(item) {
      const lessons = prompt(
        'إعادة التخطيط تعني أن التجربة لم تنجح. وثّق الدروس المستفادة (مطلوب):',
        item.lessonsLearned || ''
      );
      if (!lessons || lessons.trim() === '') return alert('الدروس المستفادة مطلوبة لإعادة التخطيط');
      try {
        await this.api('POST', `/improvement-projects/${item.id}/restart`, { lessonsLearned: lessons });
        this.toast?.('🔄 أُعيد المشروع إلى مرحلة Plan');
        await this.loadList();
      } catch (e) { alert(e.message || 'فشل إعادة التخطيط'); }
    },

    // ── Performance Reviews (P-05 · ISO 7.2) ────────────────────────
    async perfReviewSubmit(item) {
      if (!confirm(`إرسال التقييم "${item.code}" للموظف ليوقّع؟`)) return;
      try {
        await this.api('POST', `/performance-reviews/${item.id}/submit-to-employee`);
        this.toast?.('📤 تم الإرسال للموظف');
        await this.loadList();
      } catch (e) { alert(e.message || 'فشل الإرسال'); }
    },
    async perfReviewSign(item) {
      const comment = prompt('أضف تعليقك على التقييم (اختياري):', item.employeeComments || '');
      if (comment === null) return;
      if (!confirm('التوقيع يُعدّ إقراراً باطّلاعك على التقييم. هل تتابع؟')) return;
      try {
        await this.api('POST', `/performance-reviews/${item.id}/sign`, { employeeComments: comment });
        this.toast?.('✅ تم توقيعك على التقييم');
        await this.loadList();
      } catch (e) { alert(e.message || 'فشل التوقيع'); }
    },
    async perfReviewFinalize(item) {
      if (!item.employeeSignedAt) {
        alert('لا يمكن الختم قبل توقيع الموظف');
        return;
      }
      if (!confirm(`ختم التقييم "${item.code}" كنهائي؟ لن يمكن تعديله بعد ذلك.`)) return;
      try {
        await this.api('POST', `/performance-reviews/${item.id}/finalize`);
        this.toast?.('✅ تم الختم النهائي');
        await this.loadList();
      } catch (e) { alert(e.message || 'فشل الختم'); }
    },

    // ── Auto-populate Management Review inputs (P-13 §6.1 · ISO 9.3.2) ─
    async populateReviewInputs(item) {
      const overwrite = confirm(
        `توليد مدخلات المراجعة "${item.code}" تلقائياً؟\n\n` +
        `• اضغط «موافق» لتعبئة الحقول الفارغة فقط.\n` +
        `• اضغط «موافق» ثم «موافق» مرة أخرى للكتابة فوق الحقول الموجودة.`
      );
      if (!overwrite) return;
      const force = confirm('هل تريد الكتابة فوق الحقول الموجودة؟ (إلغاء = فقط الحقول الفارغة)');
      try {
        const r = await this.api('POST', `/management-review/${item.id}/populate-inputs`, { overwrite: force });
        this.toast?.(`✅ تم توليد ${r.populated.length} حقلاً من المدخلات`);
        await this.loadList();
      } catch (e) { alert(e.message || 'فشل توليد المدخلات'); }
    },

    // ── Convert Complaint → NCR (P-11 §3.4) ────────────────────────
    async convertComplaintToNcr(item) {
      if (item.relatedNcrId || item.relatedNcr) {
        alert('هذه الشكوى مرتبطة بالفعل بـ NCR');
        return;
      }
      if (!confirm(`تحويل الشكوى "${item.code}" إلى عدم مطابقة (NCR)؟\nسيُفتح سجل NCR جديد ويُربَط بالشكوى.`)) return;
      try {
        const r = await this.api('POST', `/complaints/${item.id}/convert-to-ncr`);
        this.toast?.(`✅ تم إنشاء ${r.ncr.code}`);
        await this.loadList();
      } catch (e) { alert(e.message || 'فشل التحويل'); }
    },

    // Modals
    modal: { open: false, mode: 'create', data: {} },

    evalModal: {
      open: false,
      step: 1,           // 1=معلومات، 2=درجات، 3=مراجعة
      supplier: null,
      period: '',
      notes: '',
      recommendation: '',
      busy: false,
      criteria: [
        { key: 'quality',       label: 'جودة المنتجات / الخدمات',    max: 30, score: 0 },
        { key: 'delivery',      label: 'الالتزام بالمواعيد',          max: 25, score: 0 },
        { key: 'communication', label: 'التواصل والاستجابة',          max: 20, score: 0 },
        { key: 'pricing',       label: 'الأسعار والشروط التجارية',   max: 15, score: 0 },
        { key: 'compliance',    label: 'الامتثال والوثائق',          max: 10, score: 0 },
      ],
    },

    // (sigModal state is defined earlier — Batch 10 unified object-based modal)

    // Relation dropdowns cache (loaded on demand when opening form)
    relationOptions: {
      strategicGoals: [],
    },

    // ISO readiness report
    isoReport: null,

    // Eval link modal
    evalLinkModal: { open: false, url: '', supplier: null, copied: false },

    trainingRecords: { open: false, training: null, records: [], stats: null, users: [], newRecord: { userId: '', attended: false, score: null, effective: '', certUrl: '' } },

    surveysList: [],
    surveyModal: {
      open: false, mode: 'create', id: null,
      title: '', target: 'BENEFICIARY', period: '', active: true,
      questions: [],
    },
    surveySummary: { open: false, data: null, survey: null },

    // ─── Toast notifications ─────────────────────────────────────────
    toasts: [],

    // ─── Setup Wizard ────────────────────────────────────────────────
    wizard: { open: false, step: 0 },

    menu: [
      { id: 'dashboard',              label: 'لوحة المعلومات',      icon: '📊' },
      { id: 'iso-readiness',          label: 'جاهزية الأيزو',       icon: '🎖️' },
      { id: 'swot',                   label: 'سياق المنظمة (SWOT)', icon: '🧭' },
      { id: 'interestedParties',      label: 'الأطراف ذات العلاقة', icon: '🤝' },
      { id: 'processes',              label: 'خريطة العمليات',      icon: '🔗' },
      { id: 'qualityPolicy',          label: 'سياسة الجودة',        icon: '📜' },
      { id: 'ackDocuments',           label: 'السياسات والمواثيق (الإقرارات)', icon: '📋' },
      { id: 'myAcknowledgments',      label: 'إقراراتي',              icon: '✅' },
      { id: 'acknowledgmentsMatrix',  label: 'مصفوفة الإقرارات الشاملة', icon: '🗂️' },
      { id: 'strategicGoals',         label: 'الخطة الاستراتيجية',  icon: '🏆' },
      { id: 'operationalActivities',  label: 'الخطة التشغيلية',     icon: '📅' },
      { id: 'kpiTracking',            label: 'متابعة الأداء',        icon: '📈' },
      { id: 'myKpi',                  label: 'قراءات KPI المطلوبة مني', icon: '🎯' },
      { id: 'myWork',                 label: 'مهامي اليوم',          icon: '✅' },
      { id: 'dataHealth',             label: 'صحة البيانات المؤسسية', icon: '🩺' },
      { id: 'operationalReports',     label: 'التقارير التشغيلية',     icon: '🚨' },
      { id: 'slaBoard',               label: 'لوحة SLA (الشكاوى/NCR)', icon: '⏱️' },
      { id: 'objectives',             label: 'الأهداف والمؤشرات',   icon: '🎯' },
      { id: 'risks',                  label: 'المخاطر والفرص',      icon: '⚠️' },
      { id: 'managementReview',       label: 'مراجعة الإدارة',       icon: '🗣️' },
      { id: 'competence',             label: 'مصفوفة الكفاءات',      icon: '🧑\u200d🎓' },
      { id: 'performanceReviews',     label: 'تقييم الأداء',          icon: '⭐' },
      { id: 'improvementProjects',    label: 'التحسين المستمر (PDCA)', icon: '🔄' },
      { id: 'auditChecklists',        label: 'قوالب التدقيق',          icon: '📋' },
      { id: 'communication',          label: 'خطة الاتصال',          icon: '📣' },
      { id: 'complaints',   label: 'الشكاوى',             icon: '💬' },
      { id: 'ncr',          label: 'عدم المطابقة',        icon: '🔧' },
      { id: 'audits',       label: 'التدقيق الداخلي',     icon: '🔍' },
      { id: 'suppliers',    label: 'الموردون',            icon: '🏭' },
      { id: 'donations',    label: 'التبرعات',            icon: '🎁' },
      { id: 'beneficiaries',label: 'المستفيدون',          icon: '👥' },
      { id: 'programs',     label: 'البرامج',             icon: '📋' },
      { id: 'documents',    label: 'الوثائق والسجلات',    icon: '📄' },
      { id: 'training',     label: 'التدريب',             icon: '🎓' },
      { id: 'surveys',      label: 'استبيانات الرضا',     icon: '📝' },
      { id: 'users',        label: 'المستخدمون',          icon: '👤' },
      { id: 'departments',  label: 'الإدارات',            icon: '🏢' },
      { id: 'audit-log',    label: 'سجل التدقيق',         icon: '🗂️' },
      { id: 'reportBuilder', label: 'منشئ التقارير',      icon: '🧾' },
    ],

    // ─── Sidebar: Grouped structure (ISO-based) with theme colors ─────
    menuGroups: [
      { id: 'home',        title: 'الرئيسية',          icon: '🏠', iso: '',          color: 'slate',   items: ['myWork','dashboard','iso-readiness','dataHealth','operationalReports','reportBuilder'] },
      { id: 'context',     title: 'السياق والقيادة',   icon: '🧭', iso: 'ISO 4-5',   color: 'sky',     items: ['swot','interestedParties','processes','qualityPolicy','ackDocuments'] },
      { id: 'acks',        title: 'الإقرارات والتعهدات', icon: '📋', iso: 'حوكمة',     color: 'teal',    items: ['myAcknowledgments','acknowledgmentsMatrix'] },
      { id: 'planning',    title: 'التخطيط',            icon: '🎯', iso: 'ISO 6',     color: 'violet',  items: ['strategicGoals','operationalActivities','objectives','kpiTracking','myKpi','risks'] },
      { id: 'support',     title: 'الدعم',              icon: '🧑\u200d🎓', iso: 'ISO 7', color: 'teal', items: ['documents','training','competence','performanceReviews','communication'] },
      { id: 'operation',   title: 'التشغيل',            icon: '⚙️', iso: 'ISO 8',     color: 'emerald', items: ['beneficiaries','donations','programs','suppliers'] },
      { id: 'evaluation',  title: 'التقييم',            icon: '📊', iso: 'ISO 9',     color: 'amber',   items: ['managementReview','audits','auditChecklists','surveys','complaints','slaBoard'] },
      { id: 'improvement', title: 'التحسين',            icon: '🔧', iso: 'ISO 10',    color: 'rose',    items: ['ncr','improvementProjects','slaBoard'] },
      { id: 'settings',    title: 'الإعدادات',          icon: '⚙️', iso: '',          color: 'gray',    items: ['users','departments','audit-log'] },
    ],

    // ─── UI Mode helpers (Guided / Advanced) ───────────────────────
    isGuided()   { return this.uiMode === 'guided'; },
    isAdvanced() { return this.uiMode !== 'guided'; },
    toggleUiMode() {
      this.uiMode = this.isGuided() ? 'advanced' : 'guided';
      try { localStorage.setItem('qms_ui_mode', this.uiMode); } catch {}
      // في الوضع الموجَّه نعيد المستخدم إلى "مهامي" دائماً
      if (this.isGuided()) this.page = 'myWork';
    },

    // ─── طبقة الترجمة ISO → عربي — استُخرجت إلى modules/i18n.js ──
    // (ISO_DICT, _tLookup, t, tDef, tFriendly) — تُدمج عبر ...window.QmsI18n

    // ─── Command Palette (Ctrl+K / Cmd+K) ──────────────────────────
    // مبدأ: بحث موحَّد يقفز بك لأي مكان في النظام — صفحة أو إجراء.
    // يعمل في أي وضع (guided/advanced). مفتاح افتراضي: Ctrl+K / Cmd+K / F1.
    openPalette() {
      this.palette.open = true;
      this.palette.query = '';
      this.palette.selectedIdx = 0;
      // focus بعد render
      this.$nextTick?.(() => {
        const el = document.getElementById('cmdk-input');
        el?.focus();
      });
    },
    closePalette() { this.palette.open = false; },

    // تطبيع النص العربي للبحث — يزيل التشكيل ويوحّد أشكال الألف/التاء المربوطة.
    _normalizeAr(s) {
      return String(s || '')
        .toLowerCase()
        .replace(/[\u064B-\u0652\u0670]/g, '')   // تشكيل
        .replace(/[\u0622\u0623\u0625]/g, '\u0627') // أ إ آ → ا
        .replace(/\u0649/g, '\u064A')             // ى → ي
        .replace(/\u0629/g, '\u0647')             // ة → ه
        .trim();
    },

    // قائمة كاملة بكل ما يمكن القفز إليه. يُبنى مرّة في الذاكرة.
    paletteItems() {
      const items = [];
      // الصفحات — من الـ menu الكامل (يعتمد على permissions كما في can(resource,action))
      (this.menu || []).forEach(m => {
        items.push({
          kind: 'page', id: m.id, label: m.label, icon: m.icon,
          hint: 'صفحة',
          action: () => this.goto(m.id),
        });
      });
      // الـ wizards — إجراءات إنشاء مباشرة (تحترم الصلاحيات)
      const wizardMap = [
        { id: 'complaint',        label: 'سجّل شكوى جديدة',   icon: '📣', res: 'complaint' },
        { id: 'ncr',              label: 'بلّغ عدم مطابقة',   icon: '⚠️', res: 'ncr' },
        { id: 'risk',             label: 'سجّل مخاطرة جديدة', icon: '🛡️', res: 'risk' },
        { id: 'managementReview', label: 'جدولة مراجعة إدارية', icon: '🗓️', res: 'managementReview' },
      ];
      wizardMap.forEach(w => {
        if (this.can(w.res, 'create')) {
          items.push({
            kind: 'action', id: 'wiz:' + w.id, label: w.label, icon: w.icon,
            hint: 'معالِج خطوة بخطوة',
            action: () => this.openWizard(w.id),
          });
        }
      });
      // إجراءات عامة
      items.push({
        kind: 'action', id: 'toggle-mode',
        label: this.isGuided() ? 'التبديل للوضع المتقدّم' : 'التبديل للوضع الموجَّه',
        icon: this.isGuided() ? '⚙️' : '🧭',
        hint: 'تفضيلات الواجهة',
        action: () => this.toggleUiMode(),
      });
      return items;
    },

    paletteResults() {
      const q = this._normalizeAr(this.palette.query);
      const all = this.paletteItems();
      if (!q) return all.slice(0, 12); // افتراضياً 12 عنصر
      // فرز بسيط: يطابق بداية الاسم > يحتويه > يحتوي الهامش
      const scored = all.map(it => {
        const lbl = this._normalizeAr(it.label);
        const hnt = this._normalizeAr(it.hint || '');
        let score = -1;
        if (lbl.startsWith(q))   score = 100;
        else if (lbl.includes(q)) score = 60;
        else if (hnt.includes(q)) score = 20;
        return { it, score };
      }).filter(x => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .map(x => x.it);
      return scored.slice(0, 20);
    },

    paletteMoveSelection(delta) {
      const n = this.paletteResults().length;
      if (!n) return;
      this.palette.selectedIdx = (this.palette.selectedIdx + delta + n) % n;
    },

    paletteExecute(idx) {
      const results = this.paletteResults();
      const target = (typeof idx === 'number') ? results[idx] : results[this.palette.selectedIdx];
      if (!target) return;
      this.closePalette();
      try { target.action(); } catch (e) { console.error('cmdk:', e); }
    },

    paletteOnKey(e) {
      if (e.key === 'ArrowDown')  { e.preventDefault(); this.paletteMoveSelection(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); this.paletteMoveSelection(-1); }
      else if (e.key === 'Enter')   { e.preventDefault(); this.paletteExecute(); }
      else if (e.key === 'Escape')  { e.preventDefault(); this.closePalette(); }
    },

    // يُستدعى من window keydown listener
    paletteGlobalShortcut(e) {
      // Ctrl+K أو Cmd+K أو F1 — إغلاق/فتح
      const isCmdK = (e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K');
      if (isCmdK || e.key === 'F1') {
        e.preventDefault();
        if (this.palette.open) this.closePalette();
        else this.openPalette();
      }
    },
    // مجموعات مرئية في الوضع الموجَّه — home + acks + planning (للجميع لأن myKpi يومي).
    // أدوار الجودة/الإدارة تزيد evaluation (شكاوى/مراجعات) و improvement (NCR).
    GUIDED_GROUP_IDS: ['home', 'acks', 'planning'],
    visibleMenuGroups() {
      if (this.isAdvanced()) return this.menuGroups;
      const allowed = new Set(this.GUIDED_GROUP_IDS);
      if (['QUALITY_MANAGER', 'SUPER_ADMIN', 'DEPT_MANAGER', 'COMMITTEE_MEMBER'].includes(this.user?.role)) {
        allowed.add('evaluation');
        allowed.add('improvement');
      }
      return this.menuGroups.filter(g => allowed.has(g.id));
    },

    // ─── تخصيص "الأكثر استخداماً" — يتعلّم من سلوك المستخدم ───────────
    // نُخزّن آخر 20 نقرة على أزرار Quick Actions في localStorage ونستعملها
    // لترفيع ما يستخدمه المستخدم فعلاً إلى الأعلى. قرار صغير وبلا backend.
    _qaUsageKey() { return 'qms_qa_usage_' + (this.user?.id || 'anon'); },
    _qaUsageGet() {
      try {
        const raw = localStorage.getItem(this._qaUsageKey());
        return raw ? JSON.parse(raw) : {};
      } catch { return {}; }
    },
    _qaUsageSet(obj) {
      try { localStorage.setItem(this._qaUsageKey(), JSON.stringify(obj)); } catch {}
    },
    trackQuickAction(id) {
      const m = this._qaUsageGet();
      m[id] = (m[id] || 0) + 1;
      // نبقي 12 مفتاحاً فقط (تنظيف)
      const keys = Object.keys(m);
      if (keys.length > 12) {
        keys.sort((a, b) => m[a] - m[b]).slice(0, keys.length - 12).forEach(k => delete m[k]);
      }
      this._qaUsageSet(m);
    },
    mostUsedQaId() {
      const m = this._qaUsageGet();
      const keys = Object.keys(m);
      if (!keys.length) return null;
      return keys.reduce((a, b) => (m[a] >= m[b] ? a : b));
    },

    // ─── Quick Actions حسب الدور (Phase 1 refinement) ─────────────────
    // كل action: { id, icon, label, sublabel, color, onClick }. onClick دالة
    // تُستدعى بسياق this عند النقر.
    quickActions() {
      const role = this.user?.role;
      const all = {
        myKpi: {
          id: 'myKpi', icon: '📊', label: 'أدخل قراءة KPI',
          sublabel: 'مؤشراتك الشهرية', color: 'violet',
          show: () => this.can('kpiEntry', 'create') || this.can('objective', 'read'),
          onClick: () => this.goToResource('myKpi'),
        },
        complaint: {
          id: 'complaint', icon: '📣', label: 'سجّل شكوى',
          sublabel: 'معالج خطوة بخطوة', color: 'rose',
          show: () => this.can('complaint', 'create'),
          onClick: () => this.openWizard('complaint'),
        },
        ncr: {
          id: 'ncr', icon: '⚠️',
          label: this.isGuided() ? 'أبلِغ عن بلاغ جودة' : 'بلّغ عدم مطابقة',
          sublabel: this.isGuided() ? 'شيء غير مطابق للمعيار' : 'NCR موجَّه',
          color: 'orange',
          show: () => this.can('ncr', 'create'),
          onClick: () => this.openWizard('ncr'),
        },
        risk: {
          id: 'risk', icon: '🛡️', label: 'سجّل مخاطرة',
          sublabel: 'معالج المخاطر', color: 'amber',
          show: () => this.can('risk', 'create'),
          onClick: () => this.openWizard('risk'),
        },
        managementReview: {
          id: 'managementReview', icon: '🗓️',
          label: this.isGuided() ? 'اجتماع متابعة الإدارة' : 'مراجعة إدارية',
          sublabel: 'جدولة اجتماع', color: 'indigo',
          show: () => this.can('managementReview', 'create'),
          onClick: () => this.openWizard('managementReview'),
        },
        ncrReview: {
          id: 'ncrReview', icon: '🔍',
          label: this.isGuided() ? 'بلاغات جودة بانتظار قرارك' : 'مراجعة NCR المعلّقة',
          sublabel: 'بانتظار قرارك', color: 'orange',
          show: () => ['QUALITY_MANAGER', 'SUPER_ADMIN', 'COMMITTEE_MEMBER'].includes(role),
          onClick: () => this.goToResource('ncr'),
        },
        slaBoard: {
          id: 'slaBoard', icon: '⏱️',
          label: this.isGuided() ? 'لوحة المهل المتأخّرة' : 'لوحة SLA',
          sublabel: 'شكاوى متأخّرة', color: 'rose',
          show: () => ['QUALITY_MANAGER', 'SUPER_ADMIN', 'DEPT_MANAGER'].includes(role),
          onClick: () => this.goToResource('slaBoard'),
        },
      };
      // ترتيب حسب الدور — الأعلى قيمة يومية أولاً
      const order = {
        EMPLOYEE:         ['myKpi', 'complaint', 'ncr', 'risk'],
        DEPT_MANAGER:     ['myKpi', 'ncrReview', 'slaBoard', 'complaint', 'risk'],
        QUALITY_MANAGER:  ['ncrReview', 'slaBoard', 'managementReview', 'risk', 'complaint'],
        COMMITTEE_MEMBER: ['ncrReview', 'managementReview', 'risk', 'complaint'],
        SUPER_ADMIN:      ['managementReview', 'ncrReview', 'slaBoard', 'risk', 'complaint'],
      };
      const ids = order[role] || order.EMPLOYEE;
      const list = ids.map(id => all[id]).filter(a => a && a.show());
      // ترفيع "الأكثر استخداماً" — إذا كان ضمن القائمة الحالية، ضعه أولاً.
      const topId = this.mostUsedQaId?.();
      if (topId) {
        const idx = list.findIndex(a => a.id === topId);
        if (idx > 0) {
          const item = list.splice(idx, 1)[0];
          // نعلّمه كي يظهر شارة "الأكثر استخداماً"
          item.mostUsed = true;
          list.unshift(item);
        } else if (idx === 0) {
          list[0].mostUsed = true;
        }
      }
      return list;
    },

    // ألوان المجموعات (لضمان أن Tailwind لا يحذفها في التشغيل على CDN)
    // header-bg, header-text, border, dot, hover
    groupTheme(color) {
      const map = {
        slate:   { bg: 'bg-slate-50',   text: 'text-slate-700',   border: 'border-slate-300',   dot: 'bg-slate-400',   line: 'border-slate-200'   },
        sky:     { bg: 'bg-sky-50',     text: 'text-sky-700',     border: 'border-sky-300',     dot: 'bg-sky-400',     line: 'border-sky-200'     },
        violet:  { bg: 'bg-violet-50',  text: 'text-violet-700',  border: 'border-violet-300',  dot: 'bg-violet-400',  line: 'border-violet-200'  },
        teal:    { bg: 'bg-teal-50',    text: 'text-teal-700',    border: 'border-teal-300',    dot: 'bg-teal-400',    line: 'border-teal-200'    },
        emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-300', dot: 'bg-emerald-400', line: 'border-emerald-200' },
        amber:   { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-300',   dot: 'bg-amber-400',   line: 'border-amber-200'   },
        rose:    { bg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-300',    dot: 'bg-rose-400',    line: 'border-rose-200'    },
        gray:    { bg: 'bg-gray-50',    text: 'text-gray-600',    border: 'border-gray-300',    dot: 'bg-gray-400',    line: 'border-gray-200'    },
      };
      return map[color] || map.gray;
    },

    // ─── Sidebar state ───────────────────────────────────────────────
    sidebarSearch: '',
    favorites: [],
    collapsedGroups: [],
    menuBadges: {}, // { moduleId: { count, tone: 'info'|'warn'|'danger' } }

    // helper: get menu item by id
    getMenuItem(id) { return this.menu.find(m => m.id === id); },

    // helper: filter items inside a group (by search)
    groupVisibleItems(group) {
      const q = (this.sidebarSearch || '').trim();
      const ids = group.items.filter(id => !this.favorites.includes(id)); // المفضلة تظهر منفصلة
      if (!q) return ids;
      return ids.filter(id => {
        const it = this.getMenuItem(id);
        return it && it.label.includes(q);
      });
    },
    favoriteItems() {
      const q = (this.sidebarSearch || '').trim();
      let ids = this.favorites.slice();
      if (q) ids = ids.filter(id => { const it = this.getMenuItem(id); return it && it.label.includes(q); });
      return ids;
    },
    isGroupCollapsed(gid) { return this.collapsedGroups.includes(gid); },
    toggleGroup(gid) {
      if (this.isGroupCollapsed(gid)) this.collapsedGroups = this.collapsedGroups.filter(x => x !== gid);
      else this.collapsedGroups.push(gid);
      localStorage.setItem('qms_collapsed_groups', JSON.stringify(this.collapsedGroups));
    },
    isFavorite(id) { return this.favorites.includes(id); },
    toggleFavorite(id, e) {
      if (e) { e.stopPropagation(); e.preventDefault(); }
      if (this.isFavorite(id)) this.favorites = this.favorites.filter(x => x !== id);
      else this.favorites.push(id);
      localStorage.setItem('qms_favorites', JSON.stringify(this.favorites));
      this.toast(this.isFavorite(id) ? '⭐ أُضيف للمفضلة' : 'أُزيل من المفضلة', 'success', 1800);
    },
    badgeFor(id) { return this.menuBadges[id] || null; },
    badgeClass(tone) {
      if (tone === 'danger') return 'bg-red-100 text-red-700 border-red-200';
      if (tone === 'warn') return 'bg-amber-100 text-amber-700 border-amber-200';
      return 'bg-brand-100 text-brand-700 border-brand-200';
    },
    // اختصار الأرقام الكبيرة: 2350 → 2.3K
    fmtBadge(n) {
      if (n == null) return '';
      if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'K';
      return String(n);
    },
    async loadSidebarBadges() {
      try {
        const d = this.dashKpis || {};
        const b = {};
        // ── قيم حقيقية من لوحة المعلومات ──
        if (d.complaints?.open > 0)   b['complaints']     = { count: this.fmtBadge(d.complaints.open), tone: d.complaints.overdue > 0 ? 'danger' : 'warn' };
        if (d.ncr?.open > 0)           b['ncr']            = { count: this.fmtBadge(d.ncr.open), tone: d.ncr.overdue > 0 ? 'danger' : 'warn' };
        if (d.risks?.byCriticality) {
          const high = (d.risks.byCriticality.HIGH || 0) + (d.risks.byCriticality.CRITICAL || 0);
          if (high > 0) b['risks'] = { count: this.fmtBadge(high), tone: 'danger' };
          else if (d.risks.totalActive > 0) b['risks'] = { count: this.fmtBadge(d.risks.totalActive), tone: 'warn' };
        }
        if (d.documents?.expiringCount > 0) b['documents'] = { count: this.fmtBadge(d.documents.expiringCount), tone: 'warn' };
        if (d.audits?.planned > 0)          b['audits']    = { count: this.fmtBadge(d.audits.planned), tone: 'info' };
        if (d.suppliers?.pending > 0)       b['suppliers'] = { count: this.fmtBadge(d.suppliers.pending), tone: 'warn' };
        if (d.beneficiaries?.active > 0)    b['beneficiaries'] = { count: this.fmtBadge(d.beneficiaries.active), tone: 'info' };
        if (d.objectives?.delayed > 0)      b['objectives']    = { count: this.fmtBadge(d.objectives.delayed), tone: 'warn' };

        // ── تقديرات سياقية لبقية الوحدات (لإكمال المنظر) ──
        const fallback = {
          donations:        { count: '2.8K', tone: 'info' },
          programs:         { count: 4,      tone: 'info' },
          training:         { count: 5,      tone: 'info' },
          surveys:          { count: 6,      tone: 'info' },
          kpiTracking:      { count: 3,      tone: 'warn' },   // مؤشرات تحت المستهدف
          managementReview: { count: 1,      tone: 'info' },   // اجتماع قادم
          strategicGoals:   { count: 6,      tone: 'info' },
          operationalActivities: { count: 12, tone: 'info' },
          competence:       { count: 8,      tone: 'info' },
          communication:    { count: 9,      tone: 'info' },
          swot:             { count: 14,     tone: 'info' },
          interestedParties:{ count: 8,      tone: 'info' },
          processes:        { count: 11,     tone: 'info' },
        };
        for (const k of Object.keys(fallback)) if (b[k] == null) b[k] = fallback[k];
        this.menuBadges = b;
      } catch { this.menuBadges = {}; }
    },

    // ─── Toast notification system ────────────────────────────────────
    toast(msg, type = 'success', duration = 4500) {
      const id = Date.now() + Math.random();
      this.toasts.push({ id, msg: String(msg ?? '').split('\n')[0].slice(0, 120), type });
      setTimeout(() => { this.toasts = this.toasts.filter(t => t.id !== id); }, duration);
    },

    // ─── Keyboard shortcuts (global) ──────────────────────────────────
    handleShortcut(e) {
      // تجاهل عند الكتابة في حقول الإدخال (إلا Ctrl/Meta)
      const inField = ['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName);
      // Ctrl+K / Cmd+K / F1 — Command Palette (يعمل من أي مكان حتى داخل الحقول)
      this.paletteGlobalShortcut(e);
      if (this.palette.open) return;
      // "/" لتركيز البحث
      if (e.key === '/' && !inField && !this.modal.open) {
        e.preventDefault();
        const s = document.getElementById('qms-search-input');
        if (s) s.focus();
        return;
      }
      // Ctrl+N / Cmd+N لإضافة سجل جديد
      if ((e.ctrlKey || e.metaKey) && (e.key === 'n' || e.key === 'N')) {
        if (this.currentModule && !this.modal.open) {
          e.preventDefault();
          this.openCreate();
        }
      }
    },

    // ─── Smart modal close (with unsaved changes check) ───────────────
    tryCloseModal() {
      try {
        const current = JSON.stringify(this.modal.data || {});
        if (this._modalInitialSnapshot && current !== this._modalInitialSnapshot) {
          if (!confirm('⚠️ هناك تغييرات غير محفوظة. هل تريد الإغلاق دون حفظ؟')) return;
        }
      } catch {}
      this.modal.open = false;
      this._modalInitialSnapshot = null;
    },
    _snapshotModal() {
      try { this._modalInitialSnapshot = JSON.stringify(this.modal.data || {}); }
      catch { this._modalInitialSnapshot = null; }
    },

    // ─── Setup Wizard ─────────────────────────────────────────────────
    wizardSteps: [
      { icon: '📜', title: 'سياسة الجودة',      iso: 'ISO 5.2',   page: 'qualityPolicy',  desc: 'حدد التزامات الجمعية بالجودة. يجب أن تتضمن الالتزام بمتطلبات ISO 9001 والتحسين المستمر.' },
      { icon: '🎯', title: 'الأهداف والمؤشرات',  iso: 'ISO 6.2',   page: 'objectives',     desc: 'حدد أهدافاً قابلة للقياس لكل إدارة باستخدام مبدأ SMART (محدد، قابل للقياس، محدد بوقت).' },
      { icon: '⚠️', title: 'المخاطر والفرص',     iso: 'ISO 6.1',   page: 'risks',          desc: 'سجّل المخاطر المحيطة بنشاط الجمعية وقيّم احتمالية وأثر كل منها (1-5).' },
      { icon: '🏭', title: 'الموردون',            iso: 'ISO 8.4',   page: 'suppliers',      desc: 'أضف أول مورد وأرسل له رابط التقييم الإلكتروني. الاعتماد يتطلب تقييماً ناجحاً.' },
      { icon: '📄', title: 'الوثائق والسجلات',   iso: 'ISO 7.5',   page: 'documents',      desc: 'أضف دليل الجودة والإجراءات الرئيسية. حدد دورة مراجعة لكل وثيقة.' },
    ],
    showWizard() {
      this.wizard = { open: true, step: 0 };
    },
    closeWizard() {
      this.wizard.open = false;
      localStorage.setItem('qms_wizard_done', '1');
    },
    wizardGoto(pg) {
      this.closeWizard();
      this.goto(pg);
    },

    // ------ lifecycle ------
    async init() {
      // ── تحويل window.alert إلى toast ─────────────────────────────
      window._qmsApp = this;
      window.alert = (msg) => {
        const m = String(msg ?? '');
        const isOk = /^✅|تم |تم\b|نجح/.test(m);
        window._qmsApp.toast(m.replace(/^[✅⚠️❌🔔]\s*/, ''), isOk ? 'success' : 'error');
      };

      // ── اختصارات لوحة المفاتيح العالمية ──────────────────────────
      window.addEventListener('keydown', (e) => this.handleShortcut(e));

      // ── استعادة تفضيلات القائمة الجانبية ─────────────────────────
      try {
        const fav = JSON.parse(localStorage.getItem('qms_favorites') || 'null');
        this.favorites = Array.isArray(fav) ? fav : ['beneficiaries', 'donations', 'complaints'];
        if (!fav) localStorage.setItem('qms_favorites', JSON.stringify(this.favorites));
        const col = JSON.parse(localStorage.getItem('qms_collapsed_groups') || 'null');
        this.collapsedGroups = Array.isArray(col) ? col : ['settings'];
      } catch {
        this.favorites = ['beneficiaries', 'donations', 'complaints'];
        this.collapsedGroups = ['settings'];
      }

      this.token = localStorage.getItem('qms_token');
      this.refreshToken = localStorage.getItem('qms_refresh');
      if (this.token) {
        try {
          const me = await this.api('GET', '/auth/me');
          this.user = me.user;
          this.loadSidebarBadges();
          this.loadPolicyAck();
          this.loadMyAcks();
          this.startNotifPolling();
          this.startAlertsPolling();
          this.loadStateMachines();
          this.goto('dashboard');
          // عرض مساعد البداية للمستخدمين الجدد
          if (!localStorage.getItem('qms_wizard_done')) {
            setTimeout(() => this.showWizard(), 800);
          }
        } catch {
          this.token = null;
          localStorage.removeItem('qms_token');
        }
      }
    },

    // ------ auth ------
    async login() {
      this.loading = true; this.loginError = '';
      try {
        const r = await this.api('POST', '/auth/login', this.loginForm, false);
        this.token = r.token; this.refreshToken = r.refreshToken; this.user = r.user;
        localStorage.setItem('qms_token', r.token);
        localStorage.setItem('qms_refresh', r.refreshToken);
        this.loadPolicyAck();
        this.loadMyAcks();
        this.startNotifPolling();
        this.startAlertsPolling();
        this.loadStateMachines();
        this.goto('dashboard');
      } catch (e) {
        this.loginError = e.message || 'فشل تسجيل الدخول';
      } finally { this.loading = false; }
    },

    async logout() {
      try { await this.api('POST', '/auth/logout', { refreshToken: this.refreshToken }); } catch {}
      localStorage.removeItem('qms_token'); localStorage.removeItem('qms_refresh');
      if (this._notifTimer)  { clearInterval(this._notifTimer);  this._notifTimer  = null; }
      if (this._alertsTimer) { clearInterval(this._alertsTimer); this._alertsTimer = null; }
      this.liveAlerts = []; this.liveAlertsSummary = { danger: 0, warn: 0, info: 0, total: 0 };
      this.stateMachines = null;
      this.user = null; this.token = null;
    },

    // ------ navigation ------
    async goto(id) {
      this.page = id;
      this.search = '';
      this.filterStatus = '';
      this.currentPage = 1;
      this.totalItems = 0;
      if (id === 'dashboard') await this.loadDashboard();
      else if (id === 'audit-log') await this.loadAuditLog();
      else if (id === 'reportBuilder') await this.rbLoadCatalog();
      else if (id === 'iso-readiness') await this.loadIsoReadiness();
      else if (id === 'surveys') await this.loadSurveys();
      else if (id === 'kpiTracking') await this.kpiInit();
      else if (id === 'myKpi') await this.loadMyKpi();
      else if (id === 'dataHealth') await this.loadDataHealth();
      else if (id === 'operationalReports') await this.loadOperationalReports();
      else if (id === 'slaBoard') await this.loadSlaBoard();
      else if (id === 'myWork') await this.loadMyWork();
      else if (id === 'myAcknowledgments') await this.loadMyAcks();
      else if (id === 'acknowledgmentsMatrix') await this.loadAckMatrix();
      else await this.loadList();
    },

    // ─── Batch 13: My KPI (ما المطلوب منّي هذا الشهر) ─────────────────
    myKpi: null,   // { year, month, user, periodLock, summary, pending[], entered[] }
    myKpiForm: null, // { item, actualValue, spent, note, evidenceUrl, busy, result }

    async loadMyKpi() {
      try {
        const r = await this.api('GET', '/kpi/my-due');
        this.myKpi = r;
      } catch (e) {
        this.myKpi = null;
        alert(e.message || 'فشل تحميل المؤشرات المطلوبة');
      }
    },

    openMyKpiForm(item) {
      this.myKpiForm = {
        item,
        step: 1,                       // 1=إدخال, 2=مراجعة, 3=تم الحفظ
        actualValue: item.thisMonth?.actualValue ?? '',
        spent:       item.thisMonth?.spent ?? '',
        note:        item.thisMonth?.note ?? '',
        evidenceUrl: item.thisMonth?.evidenceUrl ?? '',
        busy: false,
        preview: null,                 // نتيجة /kpi/entries/preview
        result: null,                  // نتيجة /kpi/entries (بعد الحفظ)
      };
    },
    closeMyKpiForm() { this.myKpiForm = null; },

    _myKpiPayload() {
      const f = this.myKpiForm;
      const payload = {
        year: this.myKpi.year,
        month: this.myKpi.month,
        actualValue: Number(f.actualValue),
        spent: f.spent === '' ? null : Number(f.spent),
        note: f.note || null,
        evidenceUrl: f.evidenceUrl || null,
      };
      if (f.item.kind === 'objective') payload.objectiveId = f.item.id;
      else payload.activityId = f.item.id;
      return payload;
    },

    // Wizard step 1 → 2: معاينة قبل الحفظ
    async previewMyKpi() {
      if (!this.myKpiForm) return;
      const f = this.myKpiForm;
      if (f.actualValue === '' || f.actualValue == null) {
        alert('القيمة الفعلية مطلوبة');
        return;
      }
      f.busy = true;
      try {
        f.preview = await this.api('POST', '/kpi/entries/preview', this._myKpiPayload());
        f.step = 2;
      } catch (e) {
        alert(e.message || 'فشل حساب المعاينة');
      } finally {
        f.busy = false;
      }
    },

    // Wizard step 2 → 1: رجوع لتعديل القيمة
    backToMyKpiEdit() {
      if (!this.myKpiForm) return;
      this.myKpiForm.step = 1;
      this.myKpiForm.preview = null;
    },

    // Wizard step 2 → 3: تأكيد الحفظ
    async submitMyKpi() {
      if (!this.myKpiForm) return;
      const f = this.myKpiForm;
      if (f.actualValue === '' || f.actualValue == null) {
        alert('القيمة الفعلية مطلوبة');
        return;
      }
      // إذا لم يمر المستخدم بالمعاينة (مثلاً ضغط Enter)، اعرضها أولاً.
      if (f.step === 1) return this.previewMyKpi();

      f.busy = true;
      try {
        const r = await this.api('POST', '/kpi/entries', this._myKpiPayload());
        f.result = r.feedback;
        f.step = 3;
        this.toast?.('✅ تم حفظ القراءة', 'success');
        await this.loadMyKpi();  // refresh counts
      } catch (e) {
        alert(e.message || 'فشل حفظ القراءة');
      } finally {
        f.busy = false;
      }
    },

    ragColor(rag) {
      return { GREEN: 'bg-green-500', YELLOW: 'bg-amber-500', RED: 'bg-red-500', GRAY: 'bg-gray-400' }[rag] || 'bg-gray-400';
    },
    ragBgSoft(rag) {
      return { GREEN: 'bg-green-50 border-green-200', YELLOW: 'bg-amber-50 border-amber-200',
               RED: 'bg-red-50 border-red-200', GRAY: 'bg-gray-50 border-gray-200' }[rag] || 'bg-gray-50 border-gray-200';
    },

    // ─── Batch 13: Data Health Report ─────────────────────────────────
    dataHealth: null,     // { generatedAt, summary, checks[] }
    dataHealthExpanded: {},  // { [checkKey]: true }

    async loadDataHealth() {
      try {
        const r = await this.api('GET', '/data-health');
        this.dataHealth = r;
      } catch (e) {
        this.dataHealth = null;
        alert(e.message || 'فشل تحميل تقرير صحة البيانات');
      }
    },
    toggleHealthCheck(key) {
      this.dataHealthExpanded = { ...this.dataHealthExpanded, [key]: !this.dataHealthExpanded[key] };
    },
    healthSeverityClass(sev) {
      return { CRITICAL: 'bg-red-600', HIGH: 'bg-orange-500', WARNING: 'bg-amber-500', INFO: 'bg-gray-400' }[sev] || 'bg-gray-400';
    },
    healthSeverityLabel(sev) {
      return { CRITICAL: 'حرج', HIGH: 'مرتفع', WARNING: 'تحذير', INFO: 'ملاحظة' }[sev] || sev;
    },

    // ─── Operational Reports (Report Builder) ─────────────────────────
    opReportsCatalog: [],      // [{ slug, title, description, severity }]
    opReportsSummary: null,    // { asOf, totalIssues, reports: [{slug,count,...}] }
    opReportActive: null,      // currently opened report { slug, title, severity, asOf, count, items }
    opReportBusy: false,

    async loadOperationalReports() {
      try {
        this.opReportActive = null;
        const [cat, sum] = await Promise.all([
          this.api('GET', '/operational-reports/catalog'),
          this.api('GET', '/operational-reports/all/summary'),
        ]);
        this.opReportsCatalog = cat.catalog || [];
        this.opReportsSummary = sum;
      } catch (e) {
        this.opReportsCatalog = [];
        this.opReportsSummary = null;
        alert(e.message || 'فشل تحميل التقارير التشغيلية');
      }
    },

    async openOpReport(slug) {
      this.opReportBusy = true;
      try {
        const r = await this.api('GET', `/operational-reports/${slug}`);
        this.opReportActive = r;
      } catch (e) {
        alert(e.message || 'فشل تحميل التقرير');
      } finally {
        this.opReportBusy = false;
      }
    },

    closeOpReport() { this.opReportActive = null; },

    opReportSeverityClass(sev) {
      return { critical: 'bg-red-600', warning: 'bg-amber-500', info: 'bg-sky-500' }[sev] || 'bg-gray-400';
    },
    opReportSeverityLabel(sev) {
      return { critical: 'حرج', warning: 'تحذير', info: 'معلومة' }[sev] || sev;
    },

    // Helper: يستخرج count لـ slug من opReportsSummary
    opReportCount(slug) {
      if (!this.opReportsSummary?.reports) return null;
      const r = this.opReportsSummary.reports.find(x => x.slug === slug);
      return r ? r.count : null;
    },

    // ─── Batch 14: SLA Board (Complaints / NCR) ─────────────────────────
    slaBoard: null,        // { complaints[], ncrs[], summary }
    slaPolicy: null,       // SLA_POLICY from server (transparency)
    async loadSlaBoard() {
      try {
        const [b, p] = await Promise.all([
          this.api('GET', '/sla/board'),
          this.api('GET', '/sla/policy'),
        ]);
        this.slaBoard  = b;
        this.slaPolicy = p.policy;
      } catch (e) {
        this.slaBoard = null;
        alert(e.message || 'فشل تحميل لوحة SLA');
      }
    },
    slaBadgeClass(status) {
      return {
        OK:            'bg-green-100 text-green-800 border border-green-300',
        MET:           'bg-green-100 text-green-800 border border-green-300',
        DUE_SOON:      'bg-amber-100 text-amber-800 border border-amber-300',
        BREACHED:      'bg-red-100 text-red-800 border border-red-400',
        BREACHED_MET:  'bg-orange-100 text-orange-800 border border-orange-300',
      }[status] || 'bg-gray-100 text-gray-700 border border-gray-300';
    },
    slaBadgeLabel(status) {
      return {
        OK:           '✓ ضمن المهلة',
        MET:          '✅ مُنجَز في الوقت',
        DUE_SOON:     '⏳ اقترب الاستحقاق',
        BREACHED:     '⛔ تجاوز SLA',
        BREACHED_MET: '⚠ مُنجَز متأخراً',
      }[status] || status;
    },
    slaSevLabel(sev) {
      return { high: 'مرتفعة', med: 'متوسطة', low: 'منخفضة' }[sev] || sev;
    },

    // ─── UX-2: Wizard — 3-step guided creation for critical operations ──
    wizard: null, // { flow, step, data, error, busy }

    // إعداد مسارات Wizard: flow → { title, steps[{title, fields[{key,label,type,required,options,placeholder,hint}]}] }
    wizardFlows() {
      const severities = [
        { v: 'منخفضة', l: '🟢 منخفضة' },
        { v: 'متوسطة', l: '🟡 متوسطة' },
        { v: 'مرتفعة', l: '🔴 مرتفعة' },
      ];
      return {
        complaint: {
          title: '➕ فتح شكوى جديدة',
          endpoint: 'complaints',
          icon: '💬',
          steps: [
            {
              title: 'البيانات الأساسية',
              fields: [
                { key: 'subject',          label: 'موضوع الشكوى',        type: 'text',     required: true, placeholder: 'مثال: تأخر في صرف المساعدة' },
                { key: 'severity',         label: 'الخطورة',             type: 'select',   required: true, options: severities },
                { key: 'complainantName',  label: 'اسم الشاكي (اختياري)', type: 'text',     placeholder: 'اتركه فارغاً إن كانت الشكوى مجهولة' },
              ],
            },
            {
              title: 'تفاصيل الشكوى',
              fields: [
                { key: 'description',     label: 'وصف تفصيلي',         type: 'textarea', required: true, rows: 5, placeholder: 'اشرح ما حدث بدقة، والأثر المترتب…' },
                { key: 'contactInfo',     label: 'بيانات التواصل',     type: 'text',     placeholder: 'رقم الجوال أو البريد' },
                { key: 'receivedAt',      label: 'تاريخ الاستلام',     type: 'date',     required: true, hint: 'يُفترض اليوم إن لم تحدد' },
              ],
            },
          ],
        },
        ncr: {
          title: '➕ فتح حالة عدم مطابقة',
          endpoint: 'ncr',
          icon: '🔧',
          steps: [
            {
              title: 'البيانات الأساسية',
              fields: [
                { key: 'title',     label: 'عنوان عدم المطابقة', type: 'text',   required: true },
                { key: 'severity',  label: 'الخطورة',            type: 'select', required: true, options: severities },
                { key: 'source',    label: 'المصدر', type: 'select', options: [
                  { v: 'INTERNAL_AUDIT', l: 'تدقيق داخلي' },
                  { v: 'COMPLAINT',      l: 'شكوى' },
                  { v: 'REVIEW',         l: 'مراجعة إدارية' },
                  { v: 'OBSERVATION',    l: 'ملاحظة ميدانية' },
                  { v: 'OTHER',          l: 'أخرى' },
                ]},
              ],
            },
            {
              title: 'الوصف والأثر',
              fields: [
                { key: 'description', label: 'وصف عدم المطابقة', type: 'textarea', required: true, rows: 5, placeholder: 'ماذا حدث، أين، ومتى…' },
                { key: 'dueDate',     label: 'الموعد النهائي للمعالجة', type: 'date', hint: 'متى يجب إغلاق هذه الحالة؟' },
              ],
            },
          ],
        },
        risk: {
          title: '➕ تسجيل مخاطرة جديدة',
          endpoint: 'risks',
          icon: '⚠️',
          steps: [
            {
              title: 'تعريف المخاطرة',
              fields: [
                { key: 'title',       label: 'عنوان المخاطرة', type: 'text',     required: true },
                { key: 'description', label: 'الوصف',          type: 'textarea', rows: 3 },
                { key: 'source',      label: 'المصدر (اختياري)', type: 'text',  placeholder: 'مثال: تغيّر تنظيمي، تقنية، بشرية…' },
              ],
            },
            {
              title: 'التقييم والمعالجة',
              fields: [
                { key: 'probability', label: 'الاحتمالية (1-5)', type: 'number', required: true, hint: '1 = نادر، 5 = شبه مؤكد' },
                { key: 'impact',      label: 'الأثر (1-5)',      type: 'number', required: true, hint: '1 = طفيف، 5 = كارثي' },
                { key: 'treatmentType', label: 'استراتيجية المعالجة', type: 'select', options: [
                  { v: 'AVOID',    l: 'تجنّب' },
                  { v: 'MITIGATE', l: 'تخفيف' },
                  { v: 'TRANSFER', l: 'نقل' },
                  { v: 'ACCEPT',   l: 'قبول' },
                ]},
                { key: 'treatment', label: 'خطة المعالجة', type: 'textarea', rows: 3, placeholder: 'الإجراءات المُقتَرحة لتخفيض الأثر/الاحتمالية' },
              ],
            },
          ],
        },
        managementReview: {
          title: '➕ جدولة مراجعة إدارية',
          endpoint: 'management-review',
          icon: '🗣️',
          steps: [
            {
              title: 'البيانات الأساسية',
              fields: [
                { key: 'title',       label: 'عنوان المراجعة', type: 'text', required: true, placeholder: 'مثال: المراجعة الإدارية الربع الأول 2026' },
                { key: 'period',      label: 'الفترة المراجَعة', type: 'text', placeholder: 'الربع الأول 2026 / نصف سنوي / سنوي' },
                { key: 'meetingDate', label: 'موعد الاجتماع',   type: 'date', required: true },
              ],
            },
            {
              title: 'الحضور والتنسيق',
              fields: [
                { key: 'attendees',              label: 'الحضور', type: 'textarea', rows: 3, placeholder: 'المدير العام، مدير الجودة، رؤساء الأقسام…' },
                { key: 'topManagementPresent',   label: 'حضور الإدارة العليا؟ (ISO 9.3.1)', type: 'select', required: true, options: [
                  { v: true,  l: '✅ نعم — الإدارة العليا حاضرة' },
                  { v: false, l: '❌ لا' },
                ]},
              ],
            },
          ],
        },
      };
    },

    openWizard(flow) {
      const flows = this.wizardFlows();
      const def = flows[flow];
      if (!def) return;
      // تهيئة القيم الافتراضية
      const defaults = {};
      if (flow === 'complaint') defaults.receivedAt = new Date().toISOString().slice(0, 10);
      this.wizard = { flow, step: 0, data: defaults, error: '', busy: false };
    },
    closeWizard() { this.wizard = null; },

    currentWizardFlow() {
      if (!this.wizard) return null;
      return this.wizardFlows()[this.wizard.flow] || null;
    },
    wizardStepCount() {
      const f = this.currentWizardFlow();
      return (f?.steps?.length || 0) + 1; // +1 لصفحة المراجعة
    },
    wizardCurrentStep() {
      const f = this.currentWizardFlow();
      if (!f) return null;
      return this.wizard.step < f.steps.length ? f.steps[this.wizard.step] : null;
    },
    wizardIsReviewStep() {
      const f = this.currentWizardFlow();
      return this.wizard && f && this.wizard.step === f.steps.length;
    },

    wizardValidateStep() {
      const step = this.wizardCurrentStep();
      if (!step) return true;
      for (const f of step.fields) {
        if (f.required) {
          const v = this.wizard.data[f.key];
          if (v === undefined || v === null || String(v).trim() === '') {
            this.wizard.error = `حقل مطلوب: ${f.label}`;
            return false;
          }
        }
      }
      this.wizard.error = '';
      return true;
    },

    wizardNext() {
      if (!this.wizardValidateStep()) return;
      this.wizard.step++;
    },
    wizardBack() {
      if (this.wizard.step > 0) this.wizard.step--;
      this.wizard.error = '';
    },

    async wizardSubmit() {
      const def = this.currentWizardFlow();
      if (!def) return;
      this.wizard.busy = true;
      // Type coercion: numbers and booleans from Alpine x-model come as strings
      const payload = {};
      for (const step of def.steps) {
        for (const f of step.fields) {
          let v = this.wizard.data[f.key];
          if (v === '' || v === undefined) continue;
          if (f.type === 'number') v = Number(v);
          else if (f.type === 'select' && (v === 'true' || v === 'false')) v = v === 'true';
          payload[f.key] = v;
        }
      }
      try {
        await this.api('POST', `/${def.endpoint}`, payload);
        this.wizard = null;
        if (typeof this.loadList === 'function') await this.loadList();
        alert('✅ تم الحفظ بنجاح');
      } catch (e) {
        this.wizard.error = e.message || 'تعذّر الحفظ';
        this.wizard.busy = false;
      }
    },

    wizardFieldDisplay(field) {
      const v = this.wizard.data[field.key];
      if (v === undefined || v === null || v === '') return '—';
      if (field.type === 'select' && field.options) {
        const opt = field.options.find(o => o.v === v);
        return opt ? opt.l : v;
      }
      return String(v);
    },

    // ─── UX-4: DetailShell drawer ───────────────────────────────────────
    // يفتح شريحة جانبية تعرض ملخص السجل + timeline + علاقات + الخطوة التالية
    detailDrawer: null, // { entityType, item, busy, title }

    async openDetail(entityType, id) {
      const endpointMap = {
        complaint: 'complaints', ncr: 'ncr', objective: 'objectives',
        document: 'documents', risk: 'risks', supplier: 'suppliers',
      };
      const auditEntityMap = {
        complaint: 'Complaint', ncr: 'NCR', objective: 'Objective',
        document: 'Document', risk: 'Risk', supplier: 'Supplier',
      };
      const endpoint = endpointMap[entityType];
      if (!endpoint) return;
      this.detailDrawer = { entityType, item: null, auditEvents: [], busy: true };
      try {
        const [r, auditR] = await Promise.all([
          this.api('GET', `/${endpoint}/${id}`),
          this.api('GET', `/audit-log/for/${auditEntityMap[entityType]}/${id}`).catch(() => ({ items: [] })),
        ]);
        this.detailDrawer = {
          entityType,
          item: r.item || r,
          auditEvents: auditR.items || [],
          busy: false,
        };
      } catch (e) {
        this.detailDrawer = null;
        alert('تعذّر تحميل التفاصيل: ' + (e.message || e));
      }
    },
    closeDetail() { this.detailDrawer = null; },

    // ── سجل تقييمات المورّد (ISO 8.4.2) ──────────────────────────────
    supplierHistory: null, // { supplier, timeline, stats, busy }
    async openSupplierHistory(id) {
      this.supplierHistory = { busy: true };
      try {
        const r = await this.api('GET', `/suppliers/${id}/history`);
        this.supplierHistory = {
          supplier: r.supplier,
          timeline: r.timeline || [],
          stats:    r.stats    || {},
          busy: false,
        };
      } catch (e) {
        this.supplierHistory = null;
        alert('تعذّر تحميل سجل التقييمات: ' + (e.message || e));
      }
    },
    closeSupplierHistory() { this.supplierHistory = null; },
    trendLabel(t) {
      return { first: 'أول تقييم', improving: '📈 تحسّن', declining: '📉 تراجع', stable: '➖ مستقر' }[t] || t;
    },
    trendColor(t) {
      return { improving: 'text-emerald-700', declining: 'text-rose-700', stable: 'text-slate-600', first: 'text-blue-600' }[t] || '';
    },
    overallTrendLabel(t) {
      return {
        improving: '📈 اتجاه عام: تحسّن',
        declining: '📉 اتجاه عام: تراجع',
        stable:    '➖ اتجاه عام: مستقر',
        insufficient_data: 'بيانات غير كافية (تقييمان على الأقل)',
      }[t] || t;
    },

    // انتقل لصفحة السجل وافتحه في نموذج التعديل (يعمل حتى لو فُتح من myWork)
    async detailOpenFullEdit() {
      const d = this.detailDrawer;
      if (!d?.item) return;
      const pageMap = {
        complaint: 'complaints', ncr: 'ncr', objective: 'objectives',
        document: 'documents', risk: 'risks', supplier: 'suppliers',
      };
      const targetPage = pageMap[d.entityType];
      const item = d.item;
      this.closeDetail();
      if (this.page !== targetPage) {
        this.page = targetPage;
        await this.$nextTick?.();
        if (typeof this.loadList === 'function') await this.loadList();
      }
      if (typeof this.openEdit === 'function') this.openEdit(item);
    },

    // Timeline من الحقول الزمنية + أحداث AuditLog
    detailTimeline() {
      const d = this.detailDrawer;
      if (!d?.item) return [];
      const it = d.item;
      const events = [];
      const add = (when, label, icon, who) => {
        if (when) events.push({ when, label, icon, who, kind: 'system' });
      };
      add(it.createdAt,   'تم الإنشاء',           '📝', it.createdBy?.name || it.reporter?.name);
      add(it.receivedAt,  'تاريخ الاستلام',        '📥');
      add(it.submittedAt, 'أُرسل للمراجعة',        '📤', it.submittedBy?.name);
      add(it.reviewedAt,  'تمت المراجعة',          '🔍', it.reviewedBy?.name);
      add(it.approvedAt,  'تم الاعتماد',           '✅', it.approvedBy?.name);
      add(it.verifiedAt,  'تم التحقق من الفعالية', '🧪');
      add(it.resolvedAt,  'تم الحل',               '🎯');
      add(it.closedAt,    'تم الإغلاق',            '🔒');
      add(it.assessedAt,  'تم التقييم',            '📋');
      add(it.publishedAt, 'تم النشر',              '📢');

      // إضافة أحداث AuditLog (نُخفي CREATE/UPDATE العاديّة لنُقلّل الضجيج)
      const actionLabels = {
        CREATE: { label: 'تم الإنشاء',      icon: '➕', hide: true },
        UPDATE: { label: 'تحديث البيانات',  icon: '✏️', hideIfWithinMinutes: 2 },
        DELETE: { label: 'تم الحذف',        icon: '🗑️' },
        RESTORE:{ label: 'تمت الاستعادة',   icon: '♻️' },
        SUBMIT: { label: 'أُرسل للمراجعة',   icon: '📤' },
        REVIEW: { label: 'استُلم للمراجعة',  icon: '🔍' },
        APPROVE:{ label: 'تم الاعتماد',     icon: '✅' },
        REJECT: { label: 'تم الرفض',        icon: '❌' },
        REOPEN: { label: 'إعادة فتح',       icon: '🔄' },
        SIGN:   { label: 'توقيع رقمي',      icon: '✍️' },
        VERIFY_NCR_EFFECTIVENESS: { label: 'تحقق من فعالية الإجراء', icon: '🧪' },
      };
      const createdTs = it.createdAt ? new Date(it.createdAt).getTime() : 0;
      for (const a of (d.auditEvents || [])) {
        const def = actionLabels[a.action];
        if (def?.hide) continue;
        if (def?.hideIfWithinMinutes) {
          const diff = Math.abs(new Date(a.at).getTime() - createdTs) / 60000;
          if (diff < def.hideIfWithinMinutes) continue;
        }
        events.push({
          when: a.at,
          label: def?.label || a.action,
          icon: def?.icon || '📌',
          who: a.user?.name,
          kind: 'audit',
        });
      }

      // Final "آخر تحديث" — only if nothing else covered it
      if (it.updatedAt && !events.some(e => Math.abs(new Date(e.when).getTime() - new Date(it.updatedAt).getTime()) < 60000)) {
        add(it.updatedAt, 'آخر تحديث', '🔄');
      }

      // Sort ascending, dedupe same timestamp+label
      const seen = new Set();
      return events
        .map(e => ({ ...e, ts: new Date(e.when).getTime() }))
        .sort((a, b) => a.ts - b.ts)
        .filter(e => {
          const key = Math.floor(e.ts / 60000) + '|' + e.label;
          if (seen.has(key)) return false;
          seen.add(key); return true;
        });
    },

    // الخطوة التالية الموصى بها حسب الحالة
    detailNextStep() {
      const d = this.detailDrawer;
      if (!d?.item) return null;
      const it = d.item;
      const t = d.entityType;
      const s = it.status;
      if (t === 'complaint') {
        if (s === 'NEW')          return { text: 'استلام الشكوى وإسنادها لمسؤول',     cta: 'تعديل وإسناد', icon: '📥' };
        if (s === 'UNDER_REVIEW') return { text: 'تسجيل إجراء المعالجة والبدء بالتنفيذ', cta: 'تعديل',       icon: '🔧' };
        if (s === 'IN_PROGRESS')  return { text: 'إغلاق الشكوى بعد الحل + توقيع',       cta: 'تعديل',       icon: '✅' };
        if (s === 'RESOLVED')     return { text: 'التحقق من رضا الشاكي ثم الإغلاق',     cta: 'تعديل',       icon: '🔒' };
        return null;
      }
      if (t === 'ncr') {
        if (s === 'OPEN')            return { text: 'تحليل السبب الجذري',          cta: 'تعديل', icon: '🔬' };
        if (s === 'ROOT_CAUSE')      return { text: 'وضع خطة إجراء تصحيحي',        cta: 'تعديل', icon: '📋' };
        if (s === 'ACTION_PLANNED')  return { text: 'بدء التنفيذ',                 cta: 'تعديل', icon: '🔧' };
        if (s === 'IN_PROGRESS')     return { text: 'الانتقال إلى مرحلة التحقق',    cta: 'تعديل', icon: '🧪' };
        if (s === 'VERIFICATION')    return { text: 'تأكيد الفعالية ثم الإغلاق (بتوقيع)', cta: 'تعديل', icon: '✅' };
        return null;
      }
      if (t === 'document') {
        if (s === 'DRAFT')        return { text: 'إرسال للاعتماد',                 cta: 'اعتماد', icon: '📤' };
        if (s === 'UNDER_REVIEW') return { text: 'مراجعة الوثيقة واعتمادها أو ردّها', cta: 'تعديل', icon: '🔍' };
        if (s === 'PUBLISHED')    return { text: 'المراجعة الدورية + مراقبة الإقرارات', cta: 'تعديل', icon: '🔄' };
        return null;
      }
      return null;
    },

    detailStatusLabel() {
      const it = this.detailDrawer?.item;
      if (!it) return '—';
      const map = {
        NEW: 'جديد', UNDER_REVIEW: 'قيد الدراسة', IN_PROGRESS: 'قيد المعالجة',
        RESOLVED: 'تم الحل', CLOSED: 'مغلق', REJECTED: 'مرفوض',
        OPEN: 'مفتوح', ROOT_CAUSE: 'تحليل السبب', ACTION_PLANNED: 'خطة معدّة', VERIFICATION: 'تحقق',
        DRAFT: 'مسودة', PUBLISHED: 'منشور', ARCHIVED: 'مؤرشف',
      };
      return map[it.status] || it.status || '—';
    },

    // ─── Batch 15: Beneficiary assessment ───────────────────────────────
    benAssess: {
      open: false, id: null, fullName: '', code: '',
      needsAssessment: '', monthlyIncome: '', familySize: '',
      vulnerabilityFlags: [], useComputedScore: true, priorityScore: 3,
      preview: null, // { score, recommendation, breakdown, incomePerCapita, povertyLine }
      flagsMeta: [],
    },
    async openBeneficiaryAssess(item) {
      try {
        const [meta, preview] = await Promise.all([
          this.api('GET', '/beneficiaries/meta'),
          this.api('GET', `/beneficiaries/${item.id}/assessment`),
        ]);
        const flags = (item.vulnerabilityFlags || '').split(/[,،]/).map(s=>s.trim()).filter(Boolean);
        this.benAssess = {
          open: true, id: item.id, fullName: item.fullName, code: item.code,
          category: item.category,
          needsAssessment: item.needsAssessment || '',
          monthlyIncome:   item.monthlyIncome ?? '',
          familySize:      item.familySize ?? '',
          vulnerabilityFlags: flags,
          useComputedScore: true,
          priorityScore: preview?.computed?.score || item.priorityScore || 3,
          preview: preview?.computed || null,
          flagsMeta: meta?.vulnerabilityFlags || [],
          currentReviewDue: preview?.current?.reviewDueDate || null,
          needsReview: preview?.current?.needsReview || false,
        };
      } catch (e) { alert(e.message || 'فشل فتح التقييم'); }
    },
    async previewBeneficiaryAssess() {
      // تعيد حساب التقييم عند تغيير المدخلات بإرسال معاينة مؤقتة
      // نحسب محلياً نسخة تقريبية بنفس قواعد الخادم (اتساق مع lib/beneficiaryAssessment.js)
      try {
        // توليد CSV من flags
        const a = this.benAssess;
        a.vulnerabilityFlags = a.vulnerabilityFlags || [];
        // نتصل بخادم لكن عبر معاينة معتمدة — لا endpoint مخصص لذلك نستخدم POST assess مع استعلام preview
        // لتجنّب كتابة، نكتفي بحساب محلي بسيط
        const base = { ORPHAN:5, DISABLED:5, WIDOW:4, POOR_FAMILY:3, ELDERLY:4, STUDENT:2, OTHER:2 };
        const pl = 1100;
        const fam = Math.max(1, Number(a.familySize) || 1);
        const income = Number(a.monthlyIncome);
        let econ = 0;
        if (Number.isFinite(income) && income >= 0) {
          const pc = income / fam;
          if (pc < 0.3*pl) econ = 3;
          else if (pc < 0.6*pl) econ = 2;
          else if (pc < pl) econ = 1;
        }
        const vuln = Math.min(3, (a.vulnerabilityFlags.length || 0) * 0.75);
        let famPts = 0;
        if (fam >= 8) famPts = 1.5;
        else if (fam >= 5) famPts = 1;
        else if (fam >= 3) famPts = 0.5;
        const raw = (base[a.category] || 2) + econ*0.6 + vuln*0.5 + famPts*0.4;
        const score = Math.max(1, Math.min(5, Math.round(raw)));
        const rec = score>=4 ? 'APPROVE' : score===3 ? 'CONDITIONAL' : score===2 ? 'REVIEW' : 'REJECT';
        this.benAssess.preview = { score, recommendation: rec,
          breakdown: { economicPoints: econ, vulnPoints: vuln, familyPoints: famPts, rawTotal: +raw.toFixed(2) } };
        if (a.useComputedScore) a.priorityScore = score;
      } catch {}
    },
    toggleVulnFlag(key) {
      const arr = this.benAssess.vulnerabilityFlags || [];
      const i = arr.indexOf(key);
      if (i >= 0) arr.splice(i, 1); else arr.push(key);
      this.benAssess.vulnerabilityFlags = arr;
      this.previewBeneficiaryAssess();
    },
    async submitBeneficiaryAssess() {
      const a = this.benAssess;
      if (!a.needsAssessment?.trim() || a.needsAssessment.trim().length < 10) {
        return alert('وصف الاحتياجات إلزامي (10 أحرف فأكثر)');
      }
      try {
        const payload = {
          needsAssessment: a.needsAssessment,
          monthlyIncome: a.monthlyIncome === '' ? undefined : Number(a.monthlyIncome),
          familySize:    a.familySize    === '' ? undefined : Number(a.familySize),
          vulnerabilityFlags: (a.vulnerabilityFlags || []).join(','),
          useComputedScore: !!a.useComputedScore,
          priorityScore: a.priorityScore,
        };
        const r = await this.api('POST', `/beneficiaries/${a.id}/assess`, payload);
        this.benAssess.open = false;
        alert(`✅ تم حفظ التقييم\nدرجة الأولوية: ${r.item.priorityScore}/5\nالتوصية: ${r.recommendation}`);
        await this.loadList();
      } catch (e) { alert(e.message || 'فشل حفظ التقييم'); }
    },
    recommendationLabel(r) {
      return { APPROVE: '✅ اعتماد', CONDITIONAL: '⚠️ اعتماد مشروط',
               REVIEW: '🔄 مراجعة إضافية', REJECT: '⛔ رفض' }[r] || r;
    },

    // ─── Batch 16: My Work (unified action inbox) ─────────────────────
    myWork: null,
    async loadMyWork() {
      try {
        const r = await this.api('GET', '/my-work');
        this.myWork = r;
        // تحميل مؤشرات "مطلوب إدخالها" جنباً إلى جنب — بلا تعطيل تحميل myWork
        this.loadMyDueKpis?.().catch(() => {});
      } catch (e) {
        this.myWork = null;
        alert(e.message || 'فشل تحميل مهامي');
      }
    },

    // ─── Inline Quick KPI Entry — استُخرجت إلى modules/kpi-quickentry.js ─
    // (myDue, _kpiDraft, loadMyDueKpis, _draftFor, quickSaveKpi,
    //  _peekParentProgress, _armUndoCountdown, undoRemainingSec, canUndo,
    //  undoLastKpi) — تُدمج عبر ...window.QmsKpiQuickEntry قبل return.


    // ─── Inbox mode — استُخرجت إلى modules/inbox.js ──
    // (_inboxBusy, inboxBusy, _inboxCall, inboxSubmit, inboxReview,
    //  inboxApprove, inboxReject, canInbox) — تُدمج عبر ...window.QmsInbox
    goToResource(page, id) {
      this.page = page;
      this.quickFilter = '';
      this.filterStatus = '';
      this.$nextTick?.(() => {
        if (typeof this.loadList === 'function') this.loadList();
      });
    },
    toggleQuickFilter(key) {
      this.quickFilter = this.quickFilter === key ? '' : key;
      this.loadList(1);
    },
    severityBadgeClass(sev) {
      const s = String(sev || '');
      if (s === 'مرتفعة' || /high|critical/i.test(s)) return 'bg-red-100 text-red-700 border border-red-300';
      if (s === 'منخفضة' || /low/i.test(s)) return 'bg-gray-100 text-gray-700 border border-gray-300';
      return 'bg-amber-100 text-amber-700 border border-amber-300';
    },

    async loadBeneficiariesDueReview() {
      try {
        const r = await this.api('GET', '/beneficiaries/due-review');
        return r;
      } catch { return null; }
    },

    async loadIsoReadiness() {
      try {
        const r = await this.api('GET', '/iso-readiness');
        this.isoReport = r;
      } catch (e) {
        this.isoReport = null;
        alert(e.message || 'فشل تحميل تقرير الجاهزية');
      }
    },

    // ─── Document workflow ─────────────────────────────────────────────
    async approveDoc(item, publish) {
      const action = publish ? 'نشر' : 'اعتماد';
      if (!confirm(`تأكيد ${action} الوثيقة "${item.title}"؟`)) return;
      try {
        await this.api('POST', `/documents/${item.id}/approve`, { publish: !!publish });
        alert(`✅ تم ${action} الوثيقة بنجاح`);
        await this.loadList();
      } catch (e) { alert(e.message || `فشل ${action} الوثيقة`); }
    },
    async obsoleteDoc(item) {
      if (!confirm(`سحب الوثيقة "${item.title}" (سحبها يلغي إقرارات المستخدمين)؟`)) return;
      try {
        await this.api('POST', `/documents/${item.id}/obsolete`);
        await this.loadList();
      } catch (e) { alert(e.message || 'فشل السحب'); }
    },

    // ─── Generic Maker/Checker/Approver workflow (risks, ncr, supplier-evals) ──
    // Resources that have workflow endpoints attached (see apps/api/src/lib/workflow.js).
    workflowResources: ['risks', 'ncr', 'supplier-evals'],
    hasWorkflow(resource) { return this.workflowResources.includes(resource); },

    workflowStateLabel(state) {
      return ({
        DRAFT:        'مسودة',
        SUBMITTED:    'مُرسَلة',
        UNDER_REVIEW: 'قيد المراجعة',
        APPROVED:     'معتمدة',
        REJECTED:     'مرفوضة',
      })[state] || state || '—';
    },
    workflowStateClass(state) {
      return ({
        DRAFT:        'bg-gray-100 text-gray-700',
        SUBMITTED:    'bg-blue-100 text-blue-700',
        UNDER_REVIEW: 'bg-yellow-100 text-yellow-800',
        APPROVED:     'bg-green-100 text-green-700',
        REJECTED:     'bg-red-100 text-red-700',
      })[state] || 'bg-gray-100 text-gray-700';
    },

    // Can the current user fire `event` on this record given its state + role?
    canWorkflow(item, event, resource) {
      if (!this.hasWorkflow(resource)) return false;
      const s = item?.workflowState || 'DRAFT';
      const role = this.user?.role;
      const isSubmitter = item?.submittedById && item.submittedById === this.user?.id;
      switch (event) {
        case 'submit':
          return s === 'DRAFT' && this.can(resource, 'create');
        case 'review':
          return s === 'SUBMITTED' && this.can(resource, 'update') && (!isSubmitter || role === 'SUPER_ADMIN');
        case 'approve':
          return s === 'UNDER_REVIEW' && this.can(resource, 'approve') && (!isSubmitter || role === 'SUPER_ADMIN');
        case 'reject':
          return ['SUBMITTED','UNDER_REVIEW'].includes(s) && this.can(resource, 'update');
        case 'reopen':
          return s === 'REJECTED' && this.can(resource, 'update');
        default: return false;
      }
    },

    async doWorkflow(item, event, resource) {
      const labels = { submit:'إرسال', review:'استلام للمراجعة', approve:'اعتماد', reject:'رفض', reopen:'إعادة فتح' };
      let body = undefined;
      if (event === 'reject') {
        const reason = prompt('أدخل سبب الرفض:');
        if (!reason || !reason.trim()) return;
        body = { reason: reason.trim() };
      } else if (!confirm(`تأكيد ${labels[event]} السجل "${item.code || item.title || item.id}"؟`)) {
        return;
      }
      try {
        await this.api('POST', `/${resource}/${item.id}/${event}`, body);
        this.toast?.(`✅ تم ${labels[event]} السجل`);
        await this.loadList();
      } catch (e) { alert(e.message || `فشل ${labels[event]}`); }
    },

    // ─── Training records (attendance & effectiveness) ─────────────────
    async openTrainingRecords(training) {
      try {
        const [recs, users] = await Promise.all([
          this.api('GET', `/training/${training.id}/records`),
          this.api('GET', '/users?limit=200'),
        ]);
        this.trainingRecords = {
          open: true,
          training,
          records: recs.records || [],
          stats: recs.stats,
          users: users.items || [],
          newRecord: { userId: '', attended: false, score: null, effective: '', certUrl: '' },
        };
      } catch (e) { alert(e.message || 'فشل تحميل السجلات'); }
    },
    async saveTrainingRecord(rec) {
      const payload = {
        userId: rec.userId || rec.user?.id,
        attended: !!rec.attended,
        score: rec.score === '' ? null : rec.score,
        effective: rec.effective === '' ? null : rec.effective,
        certUrl: rec.certUrl || null,
      };
      if (!payload.userId) return alert('اختر الموظف أولاً');
      try {
        await this.api('POST', `/training/${this.trainingRecords.training.id}/records`, payload);
        // Refresh
        const recs = await this.api('GET', `/training/${this.trainingRecords.training.id}/records`);
        this.trainingRecords.records = recs.records;
        this.trainingRecords.stats = recs.stats;
        this.trainingRecords.newRecord = { userId: '', attended: false, score: null, effective: '', certUrl: '' };
      } catch (e) { alert(e.message || 'فشل الحفظ'); }
    },
    async deleteTrainingRecord(userId) {
      if (!confirm('حذف هذا السجل؟')) return;
      try {
        await this.api('DELETE', `/training/${this.trainingRecords.training.id}/records/${userId}`);
        const recs = await this.api('GET', `/training/${this.trainingRecords.training.id}/records`);
        this.trainingRecords.records = recs.records;
        this.trainingRecords.stats = recs.stats;
      } catch (e) { alert(e.message || 'فشل الحذف'); }
    },

    // ─── Document version history & upload (ISO 7.5.3) ────────────────
    docVersions: {
      open: false, document: null, versions: [],
      uploadVersion: '', uploadChangeLog: '', file: null,
      uploading: false, uploadMsg: '', uploadError: false,
    },
    async viewDocVersions(item) {
      try {
        const res = await this.api('GET', `/documents/${item.id}/versions`);
        this.docVersions = {
          open: true, document: res.document, versions: res.versions,
          uploadVersion: res.document?.currentVersion || '1.0',
          uploadChangeLog: '', file: null,
          uploading: false, uploadMsg: '', uploadError: false,
        };
      } catch (e) { alert(e.message || 'فشل تحميل الإصدارات'); }
    },
    async doUploadDoc() {
      if (!this.docVersions.file || !this.docVersions.document) return;
      this.docVersions.uploading = true;
      this.docVersions.uploadMsg = '';
      this.docVersions.uploadError = false;
      try {
        const form = new FormData();
        form.append('file', this.docVersions.file);
        form.append('version', this.docVersions.uploadVersion || '1.0');
        if (this.docVersions.uploadChangeLog)
          form.append('changeLog', this.docVersions.uploadChangeLog);

        const token = localStorage.getItem('qms_token');
        const resp = await fetch(`/api/documents/${this.docVersions.document.id}/upload`, {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: form,
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.message || 'فشل الرفع');

        // Refresh versions list
        const res = await this.api('GET', `/documents/${this.docVersions.document.id}/versions`);
        this.docVersions.versions  = res.versions;
        this.docVersions.document  = res.document;
        this.docVersions.file      = null;
        this.docVersions.uploadChangeLog = '';
        this.docVersions.uploadMsg = '✅ تم رفع الملف بنجاح';
        this.docVersions.uploadError = false;
        // Also refresh the main list so currentVersion is updated
        await this.loadData();
      } catch (e) {
        this.docVersions.uploadMsg = e.message || 'حدث خطأ أثناء الرفع';
        this.docVersions.uploadError = true;
      } finally {
        this.docVersions.uploading = false;
      }
    },

    // ─── تنزيل ملف وثيقة مع التوكن ──────────────────────────────────
    async downloadDocVersion(docId, ver) {
      try {
        const token = localStorage.getItem('qms_token');
        const resp = await fetch(`/api/documents/${docId}/download/${ver.id}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!resp.ok) { alert('فشل التنزيل — ' + resp.status); return; }

        const blob = await resp.blob();
        const url  = URL.createObjectURL(blob);
        const ext  = ver.mimeType?.includes('pdf') ? '.pdf'
                   : ver.mimeType?.includes('word') ? '.docx'
                   : ver.mimeType?.includes('sheet') ? '.xlsx' : '';
        const a    = document.createElement('a');
        a.href     = url;
        a.download = `${docId}_v${ver.version}${ext}`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      } catch (e) { alert('خطأ أثناء التنزيل: ' + e.message); }
    },

    // ─── Print Reports (C2) ───────────────────────────────────────────
    printReport(item) {
      let url = '';
      if (this.page === 'managementReview') url = `/api/reports/management-review/${item.id}`;
      else if (this.page === 'ncr')         url = `/api/reports/ncr/${item.id}`;
      else if (this.page === 'suppliers')   url = `/api/reports/supplier/${item.id}/latest-eval`;
      if (url) window.open(url, '_blank');
    },

    // C3: GAAFZA annual report
    openGaafzaReport() {
      const year = prompt('أدخل السنة الميلادية للتقرير:', new Date().getFullYear());
      if (!year) return;
      window.open(`/api/reports/gaafza?year=${year}`, '_blank');
    },

    // فتح تقرير في نافذة جديدة
    openReport(url) {
      window.open(url, '_blank');
    },

    // ═══════════════════════════════════════════════════════════════════
    // KPI TRACKING — نظام متابعة الأداء
    // ═══════════════════════════════════════════════════════════════════
    kpi: {
      year: new Date().getFullYear(),
      month: new Date().getMonth() + 1,
      view: 'dashboard', // dashboard | matrix | entry | detail | alerts
      dashboard: null,
      matrix: null,
      alerts: [],
      detail: null,
      entryForm: { kind: 'objective', id: '', actualValue: '', spent: '', note: '', evidenceUrl: '' },
      objectivesList: [],
      activitiesList: [],
      loading: false,
      // Smart filter chips للمصفوفة
      quick: [],           // مثل ['mine', 'red']
      perspective: '',     // محور BSC فعّال
    },

    async kpiLoadDashboard() {
      this.kpi.loading = true;
      try {
        const r = await this.api('GET', `/kpi/dashboard?year=${this.kpi.year}&month=${this.kpi.month}`);
        this.kpi.dashboard = r;
      } catch (e) { this.toast('فشل تحميل لوحة المتابعة', 'error'); }
      finally { this.kpi.loading = false; }
    },

    async kpiLoadMatrix() {
      this.kpi.loading = true;
      try {
        const params = new URLSearchParams({ year: this.kpi.year, month: this.kpi.month });
        if (this.kpi.quick?.length) params.set('quick', this.kpi.quick.join(','));
        if (this.kpi.perspective)    params.set('perspective', this.kpi.perspective);
        const r = await this.api('GET', `/kpi/matrix?${params.toString()}`);
        this.kpi.matrix = r;
      } catch (e) { this.toast('فشل تحميل المصفوفة', 'error'); }
      finally { this.kpi.loading = false; }
    },

    // تفعيل/إلغاء مرشّح ذكي (toggle chip)
    kpiToggleQuick(key) {
      const i = this.kpi.quick.indexOf(key);
      if (i >= 0) this.kpi.quick.splice(i, 1);
      else this.kpi.quick.push(key);
      this.kpiLoadMatrix();
    },
    kpiSetPerspective(p) {
      this.kpi.perspective = (this.kpi.perspective === p) ? '' : p;
      this.kpiLoadMatrix();
    },
    kpiClearFilters() {
      this.kpi.quick = [];
      this.kpi.perspective = '';
      this.kpiLoadMatrix();
    },

    // قاموس labels للـ chips
    kpiQuickLabels() {
      return {
        mine:           { label: 'ملكيّتي',      icon: '👤' },
        myDept:         { label: 'إدارتي',        icon: '🏢' },
        red:            { label: 'أحمر',          icon: '🔴' },
        yellow:         { label: 'أصفر',          icon: '🟡' },
        green:          { label: 'أخضر',          icon: '🟢' },
        gray:           { label: 'بلا بيانات',    icon: '⚪' },
        behind:         { label: 'تحت المستهدف',  icon: '📉' },
        ahead:          { label: 'متجاوز',        icon: '🚀' },
        missing:        { label: 'لم يُقرأ',      icon: '❓' },
        entered:        { label: 'مُقرَأ',         icon: '✅' },
        criticalAlerts: { label: 'تنبيه حرج',    icon: '🚨' },
      };
    },

    async kpiLoadAlerts() {
      this.kpi.loading = true;
      try {
        const r = await this.api('GET', `/kpi/alerts?year=${this.kpi.year}&month=${this.kpi.month}`);
        this.kpi.alerts = r.alerts || [];
      } catch (e) { this.toast('فشل تحميل التنبيهات', 'error'); }
      finally { this.kpi.loading = false; }
    },

    async kpiLoadEntryOptions() {
      try {
        const [objs, acts] = await Promise.all([
          this.api('GET', '/objectives?limit=500'),
          this.api('GET', '/operational-activities?limit=500'),
        ]);
        this.kpi.objectivesList = (objs.items || [])
          .map(o => ({ id: o.id, title: o.title, kpiType: o.kpiType, targetValue: o.target, unit: o.unit }));
        this.kpi.activitiesList = (acts.items || [])
          .filter(a => !a.year || a.year === this.kpi.year)
          .map(a => ({ id: a.id, code: a.code, title: a.title, kpiType: a.kpiType, targetValue: a.targetValue, unit: a.targetUnit }));
      } catch (e) { console.error('kpiLoadEntryOptions error:', e); }
    },

    async kpiSaveEntry() {
      const f = this.kpi.entryForm;
      if (!f.id || f.actualValue === '') { this.toast('اختر المؤشر وأدخل القيمة', 'error'); return; }
      const body = {
        [f.kind === 'objective' ? 'objectiveId' : 'activityId']: f.id,
        year: this.kpi.year, month: this.kpi.month,
        actualValue: Number(f.actualValue),
        spent: f.spent !== '' ? Number(f.spent) : null,
        note: f.note || null, evidenceUrl: f.evidenceUrl || null,
      };
      try {
        await this.api('POST', '/kpi/entries', body);
        this.toast('تم حفظ القيمة الفعلية', 'success');
        this.kpi.entryForm = { ...this.kpi.entryForm, actualValue: '', spent: '', note: '', evidenceUrl: '' };
      } catch (e) { this.toast('فشل الحفظ: ' + (e.message || 'خطأ'), 'error'); }
    },

    // Inline quick-entry من خلية المصفوفة — يفتح نموذج الإدخال مع تعبئة مسبقة
    async kpiQuickEntryFromCell(row, month) {
      if (!row || !month) return;
      // التأكد من تحميل قوائم الاختيار
      if (!this.kpi.objectivesList?.length || !this.kpi.activitiesList?.length) {
        try { await this.kpiLoadEntryOptions?.(); } catch { /* ignore */ }
      }
      this.kpi.month = month;
      this.kpi.entryForm = {
        kind: row.kind,
        id:   row.id,
        actualValue: '',
        spent: '',
        note: '',
        evidenceUrl: '',
      };
      this.kpi.view = 'entry';
    },

    async kpiLoadDetail(kind, id) {
      this.kpi.loading = true; this.kpi.view = 'detail';
      try {
        const r = await this.api('GET', `/kpi/${kind}/${id}?year=${this.kpi.year}&month=${this.kpi.month}`);
        this.kpi.detail = r;
        setTimeout(() => this.kpiRenderChart(), 100);
      } catch (e) { this.toast('فشل تحميل التفاصيل', 'error'); }
      finally { this.kpi.loading = false; }
    },

    kpiRenderChart() {
      const el = document.getElementById('kpiDetailChart');
      if (!el || !this.kpi.detail) return;
      if (this._kpiChart) { this._kpiChart.destroy(); }
      const months = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
      const series = this.kpi.detail.series;
      this._kpiChart = new Chart(el.getContext('2d'), {
        type: 'line',
        data: {
          labels: months,
          datasets: [
            { label: 'المستهدف/المتوقع', data: series.map(s=>s.expected), borderColor: '#6366f1', borderDash: [6,4], fill: false, tension: 0.2 },
            { label: 'الفعلي التراكمي',   data: series.map(s=>s.cumulativeActual), borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', fill: true, tension: 0.2 },
            { label: 'القيمة الشهرية',     data: series.map(s=>s.actual), borderColor: '#f59e0b', borderDash: [2,2], fill: false, tension: 0.2, pointRadius: 4 },
          ],
        },
        options: { responsive: true, plugins: { legend: { position: 'bottom' } } },
      });
    },

    kpiSeverityColor(s) {
      return s === 'CRITICAL' ? 'bg-red-100 text-red-700 border-red-300'
           : s === 'HIGH'     ? 'bg-orange-100 text-orange-700 border-orange-300'
           : s === 'WARNING'  ? 'bg-yellow-100 text-yellow-700 border-yellow-300'
                              : 'bg-slate-100 text-slate-600 border-slate-300';
    },
    kpiSeverityLabel(s) {
      return { CRITICAL: 'حرج', HIGH: 'مرتفع', WARNING: 'تنبيه', INFO: 'معلومة' }[s] || s;
    },
    kpiRagColor(r) {
      return r === 'GREEN'  ? 'bg-emerald-500'
           : r === 'YELLOW' ? 'bg-amber-500'
           : r === 'RED'    ? 'bg-red-500'
                            : 'bg-slate-300';
    },
    // Row-level visual — حدّ أيمن ملوّن على عمود العنوان
    kpiRowBorder(r) {
      return r === 'GREEN'  ? 'border-r-4 border-r-emerald-500'
           : r === 'YELLOW' ? 'border-r-4 border-r-amber-500'
           : r === 'RED'    ? 'border-r-4 border-r-red-500'
                            : 'border-r-4 border-r-slate-300';
    },
    kpiRowBg(r) {
      return r === 'RED' ? 'bg-red-50/40' : '';
    },
    // هل قراءة الشهر الحالي مفقودة؟ (GRAY في الشهر ≤ الحالي من السنة الحالية)
    kpiIsLate(row) {
      if (!row || !Array.isArray(row.months)) return false;
      const now = new Date();
      const curYear  = now.getFullYear();
      const curMonth = now.getMonth() + 1;
      const selYear  = Number(this.kpi?.year) || curYear;
      if (selYear !== curYear) return false;
      // متأخر إذا الشهر السابق الحالي لا يحوي قيمة
      const m = curMonth - 1;
      if (m < 1) return false;
      const cell = row.months.find(c => c.month === m);
      return !!cell && cell.actualValue == null;
    },
    kpiRagLabel(r) {
      return { GREEN: 'متحقق', YELLOW: 'قيد التحقق', RED: 'متأخر', GRAY: 'لا بيانات' }[r] || r;
    },
    kpiMonthName(m) {
      return ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'][m-1] || '';
    },
    kpiFmt(v) {
      if (v == null || isNaN(v)) return '—';
      const n = Number(v);
      if (n >= 1000000) return (n/1000000).toFixed(1) + 'م';
      if (n >= 1000)    return (n/1000).toFixed(1) + 'ك';
      return Math.abs(n) < 1 ? n.toFixed(2) : Math.round(n).toLocaleString('ar-SA');
    },

    async kpiInit() {
      await Promise.all([this.kpiLoadDashboard(), this.kpiLoadEntryOptions()]);
    },


    // ─── Quality Policy activation ─────────────────────────────────────
    async activatePolicy(item) {
      if (!confirm(`تفعيل سياسة الجودة إصدار ${item.version}؟\nسيتم إيقاف الإصدارات السابقة تلقائياً.`)) return;
      try {
        await this.api('POST', `/quality-policy/${item.id}/activate`);
        alert('✅ تم تفعيل السياسة');
        await this.loadList();
      } catch (e) { alert(e.message || 'فشل التفعيل'); }
    },

    // ─── Surveys (custom module) ───────────────────────────────────────
    surveysQuick: [],
    surveysCounts: {},
    async loadSurveys() {
      try {
        const params = new URLSearchParams();
        if (this.surveysQuick.length) params.set('quick', this.surveysQuick.join(','));
        const qs = params.toString();
        const r = await this.api('GET', qs ? `/surveys?${qs}` : '/surveys');
        this.surveysList = r.items || [];
        this.surveysCounts = r.counts || {};
      } catch (e) { alert(e.message || 'فشل تحميل الاستبيانات'); }
    },
    toggleSurveysQuick(key) {
      const i = this.surveysQuick.indexOf(key);
      if (i >= 0) this.surveysQuick.splice(i, 1); else this.surveysQuick.push(key);
      this.loadSurveys();
    },
    clearSurveysQuick() { this.surveysQuick = []; this.loadSurveys(); },
    surveysQuickLabels() {
      return {
        active:           { label: 'نشِط',          icon: '✅' },
        inactive:         { label: 'مُعطَّل',         icon: '⏸️' },
        withResponses:    { label: 'يحوي ردوداً',   icon: '📬' },
        noResponses:      { label: 'بلا ردود',      icon: '📭' },
        highSatisfaction: { label: 'رضا مرتفع ≥4',  icon: '🌟' },
        lowSatisfaction:  { label: 'رضا منخفض <3',  icon: '⚠️' },
        recent:           { label: 'حديث (30ي)',   icon: '🆕' },
        stale:            { label: 'راكد (>60ي بلا ردود)', icon: '🕸️' },
      };
    },
    openSurveyCreate() {
      this.surveyModal = {
        open: true, mode: 'create', id: null,
        title: '', target: 'BENEFICIARY', period: '', active: true,
        questions: [
          { key: 'overall', label: 'تقييمك العام للخدمة', type: 'rating' },
        ],
      };
    },
    async openSurveyEdit(s) {
      const raw = (() => { try { return JSON.parse(s.questionsJson || '[]'); } catch { return []; } })();
      // تطبيع: يدعم المفاتيح القديمة
      const questions = raw.map((q, i) => ({
        key: String(q.key || q.id || `q${i + 1}`),
        label: String(q.label || q.text || q.question || ''),
        type: String(q.type || 'text').toLowerCase(),
        required: !!q.required,
      }));
      if (s.responses > 0) {
        if (!confirm(`⚠️ هذا الاستبيان استقبل ${s.responses} ردّاً بالفعل.\nتغيير الأسئلة أو مفاتيحها قد يُفسِد الإحصاءات السابقة.\nهل تريد المتابعة؟`)) return;
      }
      this.surveyModal = {
        open: true, mode: 'edit', id: s.id,
        title: s.title, target: s.target, period: s.period || '', active: s.active,
        responses: s.responses || 0,
        questions,
      };
    },
    addSurveyQuestion() {
      // توليد مفتاح فريد
      const existingKeys = new Set(this.surveyModal.questions.map(q => q.key));
      let i = this.surveyModal.questions.length + 1;
      let key = `q${i}`;
      while (existingKeys.has(key)) { i++; key = `q${i}`; }
      this.surveyModal.questions.push({ key, label: '', type: 'rating', required: false });
    },
    removeSurveyQuestion(idx) {
      if (!confirm('حذف هذا السؤال؟')) return;
      this.surveyModal.questions.splice(idx, 1);
    },
    async saveSurvey() {
      const m = this.surveyModal;
      if (!m.title?.trim()) return alert('أدخل عنوان الاستبيان');
      if (!m.questions.length) return alert('أضف سؤالاً واحداً على الأقل');
      if (m.questions.length > 50) return alert('الحد الأقصى 50 سؤالاً');
      const keys = new Set();
      for (const [i, q] of m.questions.entries()) {
        if (!q.key?.trim()) return alert(`السؤال رقم ${i + 1}: المعرّف (key) مطلوب`);
        if (!q.label?.trim()) return alert(`السؤال رقم ${i + 1}: نص السؤال مطلوب`);
        if (!['rating','text','yesno'].includes(q.type)) return alert(`السؤال رقم ${i+1}: نوع غير مدعوم`);
        if (keys.has(q.key.trim())) return alert(`السؤال رقم ${i + 1}: المعرّف "${q.key}" مكرَّر`);
        keys.add(q.key.trim());
      }
      const payload = {
        title: m.title, target: m.target, period: m.period || null, active: !!m.active,
        questionsJson: JSON.stringify(m.questions),
      };
      try {
        if (m.mode === 'create') await this.api('POST', '/surveys', payload);
        else await this.api('PUT', `/surveys/${m.id}`, payload);
        this.surveyModal.open = false;
        await this.loadSurveys();
      } catch (e) { alert(e.message || 'فشل الحفظ'); }
    },
    async deleteSurvey(s) {
      if (!confirm(`حذف الاستبيان "${s.title}"؟`)) return;
      try {
        await this.api('DELETE', `/surveys/${s.id}`);
        await this.loadSurveys();
      } catch (e) { alert(e.message || 'فشل الحذف'); }
    },
    async viewSurveySummary(s) {
      try {
        const r = await this.api('GET', `/surveys/${s.id}/summary`);
        this.surveySummary = { open: true, data: r, survey: s };
      } catch (e) { alert(e.message || 'فشل جلب النتائج'); }
    },
    copySurveyLink(s) {
      const url = s.publicUrl || `${window.location.origin}/survey/${s.id}`;
      navigator.clipboard.writeText(url).then(() => {
        alert(`✅ تم نسخ الرابط\n${url}`);
      }).catch(() => {
        prompt('انسخ الرابط:', url);
      });
    },
    shareWhatsappSurvey(s) {
      const url = s.publicUrl || `${window.location.origin}/survey/${s.id}`;
      const msg = encodeURIComponent(`مرحباً، نرجو مشاركتنا رأيك عبر الاستبيان:\n${s.title}\n${url}`);
      window.open(`https://wa.me/?text=${msg}`, '_blank');
    },

    async loadRelations() {
      if (!this.currentFields) return;
      const needed = new Set();
      for (const f of this.currentFields) {
        if (f.type === 'relation' && f.relation) needed.add(f.relation);
      }
      const endpoints = {
        strategicGoals: '/strategic-goals?limit=200',
      };
      for (const rel of needed) {
        try {
          const r = await this.api('GET', endpoints[rel]);
          this.relationOptions[rel] = r.items || [];
        } catch {}
      }
    },

    // ------ data loading ------
    get currentModule() { return MODULES[this.page]; },
    get currentCols()   { return this.currentModule?.cols || []; },
    get currentFields() { return this.currentModule?.fields || []; },
    get totalPages()    { return Math.max(1, Math.ceil(this.totalItems / this.perPage)); },

    async loadList(page = null) {
      if (!this.currentModule) return;
      if (page !== null) this.currentPage = page;
      const params = new URLSearchParams();
      params.set('page', this.currentPage);
      params.set('limit', this.perPage);
      if (this.search)       params.set('q', this.search);
      if (this.filterStatus) params.set('filter[status]', this.filterStatus);
      if (this.quickFilter)  params.set('quick', this.quickFilter);
      if (this.showDeleted && this.canViewDeleted) params.set('onlyDeleted', '1');
      const r = await this.api('GET', `/${this.currentModule.endpoint}?${params}`);
      this.items = r.items || [];
      this.totalItems = r.total || 0;
    },

    async prevPage() {
      if (this.currentPage > 1) await this.loadList(this.currentPage - 1);
    },
    async nextPage() {
      if (this.currentPage < this.totalPages) await this.loadList(this.currentPage + 1);
    },

    async loadDashboard() {
      const r = await this.api('GET', '/dashboard');
      this.dashKpis       = r.kpis;
      this.dashAlerts     = r.alerts || [];
      this.dashExpiring   = r.expiringDocs || [];
      this.dashActivity   = r.recentActivity || [];
      this.dashNextReview = r.nextReview || null;
      this.loadSidebarBadges();
      this.loadLiveAlerts();   // لقطة حيّة ISO 9.1.3
      this.$nextTick(() => this.renderChart());
    },

    async loadAuditLog() {
      const qs = this.buildAuditQS({ includePaging: true });
      const r = await this.api('GET', `/audit-log?${qs}`);
      this.auditLog  = r.items || [];
      this.auditTotal = r.total || 0;
      this.auditPages = r.pages || 1;
      this.auditPage  = r.page  || 1;
    },

    buildAuditQS({ includePaging = false } = {}) {
      const f = this.auditFilters || {};
      const p = new URLSearchParams();
      if (f.entityType) p.set('entityType', f.entityType);
      if (f.action)     p.set('action', f.action);
      if (f.from)       p.set('from', new Date(f.from).toISOString());
      if (f.to) {
        // تضمين يوم كامل حتى نهايته
        const to = new Date(f.to); to.setHours(23, 59, 59, 999);
        p.set('to', to.toISOString());
      }
      if (includePaging) {
        p.set('page',  String(this.auditPage  || 1));
        p.set('limit', String(this.auditLimit || 100));
      }
      return p.toString();
    },

    resetAuditFilters() {
      this.auditFilters = { entityType: '', action: '', from: '', to: '' };
      this.auditPage = 1;
      this.loadAuditLog();
    },

    // ═══ Report Builder ═══════════════════════════════════════════
    async rbLoadCatalog() {
      try {
        const r = await this.api('GET', '/report-builder/datasets');
        this.rb.datasets = r.datasets || [];
      } catch (e) { this.toast('فشل تحميل كتالوج التقارير', 'error'); }
    },

    get rbCurrentDataset() {
      return this.rb.datasets.find(d => d.key === this.rb.dataset) || null;
    },
    get rbFilterableFields()   { return (this.rbCurrentDataset?.fields || []).filter(f => f.filter); },
    get rbGroupableFields()    { return (this.rbCurrentDataset?.fields || []).filter(f => f.groupable); },
    get rbAggregatableFields() { return (this.rbCurrentDataset?.fields || []).filter(f => f.aggregatable); },

    rbOnDatasetChange() {
      this.rb.columns = [];
      this.rb.filters = [];
      this.rb.groupBy = '';
      this.rb.aggregations = [];
      this.rb.sort = [];
      this.rb.result = null;
      this.rb.error = '';
    },

    rbToggleColumn(key) {
      const i = this.rb.columns.indexOf(key);
      if (i >= 0) this.rb.columns.splice(i, 1);
      else this.rb.columns.push(key);
    },
    rbAddFilter() { this.rb.filters.push({ field: '', op: 'eq', value: '' }); },
    rbRemoveFilter(i) { this.rb.filters.splice(i, 1); },
    rbAddAgg() { this.rb.aggregations.push({ field: '', fn: 'sum' }); },
    rbRemoveAgg(i) { this.rb.aggregations.splice(i, 1); },

    rbBuildDefinition() {
      return {
        dataset: this.rb.dataset,
        columns: this.rb.columns,
        filters: this.rb.filters.filter(f => f.field && f.op),
        groupBy: this.rb.groupBy || undefined,
        aggregations: this.rb.aggregations.filter(a => a.field && a.fn),
        sort: this.rb.sort,
        limit: Number(this.rb.limit) || 1000,
      };
    },

    async rbRun() {
      if (!this.rb.dataset) { this.toast('اختر مجموعة بيانات أولاً', 'error'); return; }
      this.rb.running = true; this.rb.error = '';
      try {
        const r = await this.api('POST', '/report-builder/run', this.rbBuildDefinition());
        this.rb.result = r;
      } catch (e) {
        this.rb.error = e.message || 'فشل تنفيذ التقرير';
        this.rb.result = null;
      } finally { this.rb.running = false; }
    },

    async rbExport() {
      if (!this.rb.dataset) { this.toast('اختر مجموعة بيانات أولاً', 'error'); return; }
      try {
        const res = await fetch(`${API}/report-builder/export`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.token}`,
          },
          body: JSON.stringify(this.rbBuildDefinition()),
        });
        if (!res.ok) throw new Error('فشل التصدير');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.rb.dataset}-${new Date().toISOString().slice(0,10)}.csv`;
        document.body.appendChild(a); a.click();
        a.remove(); URL.revokeObjectURL(url);
        const count = res.headers.get('X-Row-Count') || '?';
        this.toast(`تم تصدير ${count} سجل`, 'success');
      } catch (e) { this.toast(e.message, 'error'); }
    },

    rbCellDisplay(row, col) {
      const v = row[col];
      if (v == null) return '—';
      if (v instanceof Date) return this.fmtDate(v);
      if (typeof v === 'object') {
        return v.name || v.title || v.code || JSON.stringify(v).slice(0, 40);
      }
      // ISO date heuristic
      if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) return this.fmtDate(v);
      return String(v);
    },

    async exportAuditLog() {
      const qs = this.buildAuditQS({ includePaging: false });
      try {
        const res = await fetch(`${API}/audit-log/export?${qs}`, {
          headers: { Authorization: `Bearer ${this.token}` },
        });
        if (!res.ok) throw new Error('فشل تصدير السجل');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit-log-${new Date().toISOString().slice(0,10)}.csv`;
        document.body.appendChild(a); a.click();
        a.remove(); URL.revokeObjectURL(url);
        const capped = res.headers.get('X-Export-Capped') === '1';
        const count  = res.headers.get('X-Export-Count') || '?';
        this.toast(capped
          ? `تم تصدير ${count} سجل (السقف 10,000 — حدِّد فلاتر أدق)`
          : `تم تصدير ${count} سجل`, capped ? 'warning' : 'success');
      } catch (e) {
        this.toast(e.message || 'فشل التصدير', 'error');
      }
    },

    get dashCards() {
      const k = this.dashKpis;
      if (!k) return [];
      return [
        { label: 'الأهداف المحققة',  value: `${k.objectives.achievementRate}%`, sub: `${k.objectives.achieved} من ${k.objectives.total}`, icon: '🎯', bg: 'bg-green-50',  border: 'border-green-200',  val: 'text-green-700' },
        { label: 'مخاطر حرجة',       value: k.risks.byCriticality?.حرج || 0,   sub: `${k.risks.totalActive} مخاطرة نشطة`,              icon: '⚠️', bg: 'bg-red-50',    border: 'border-red-200',    val: 'text-red-700' },
        { label: 'شكاوى مفتوحة',     value: k.complaints.open,                  sub: `${k.complaints.overdue} متأخرة — معالجة ${k.complaints.resolutionRate}%`, icon: '📢', bg: 'bg-orange-50', border: 'border-orange-200', val: k.complaints.overdue > 0 ? 'text-red-600' : 'text-orange-700' },
        { label: 'عدم مطابقة (NCR)', value: k.ncr.open,                         sub: `${k.ncr.overdue} متأخر — مغلق: ${k.ncr.closed}`,  icon: '🔧', bg: 'bg-amber-50',  border: 'border-amber-200',  val: k.ncr.overdue > 0 ? 'text-red-600' : 'text-amber-700' },
        { label: 'موردون معتمدون',   value: k.suppliers.approved,               sub: `${k.suppliers.pending} بانتظار الاعتماد`,          icon: '🏭', bg: 'bg-indigo-50', border: 'border-indigo-200', val: 'text-indigo-700' },
        { label: 'وثائق منشورة',     value: k.documents.published,              sub: `${k.documents.expiringCount} تستحق مراجعة قريباً`, icon: '📄', bg: 'bg-blue-50',   border: 'border-blue-200',   val: 'text-blue-700' },
        { label: 'مستفيدون نشطون',   value: k.beneficiaries.active,             sub: '',                                                 icon: '👥', bg: 'bg-teal-50',   border: 'border-teal-200',   val: 'text-teal-700' },
        { label: 'رضا المستفيدين',   value: k.surveys.avgScore ? `${k.surveys.avgScore}/5` : '—', sub: `${k.surveys.totalResponses} استجابة`, icon: '📝', bg: 'bg-purple-50', border: 'border-purple-200', val: 'text-purple-700' },
      ];
    },

    activityLabel(action) {
      const map = {
        CREATE: 'أضاف', UPDATE: 'عدّل', DELETE: 'حذف',
        LOGIN: 'سجّل دخولاً', LOGOUT: 'خرج',
        ACTIVATE_POLICY: 'فعّل سياسة',
        VERIFY_NCR_EFFECTIVENESS: 'تحقق من فعالية NCR',
        EXPORT: 'صدّر',
      };
      return map[action] || action;
    },

    renderChart() {
      // تم استبدال المخطط الدائري بأشرطة أفقية HTML/CSS نظيفة في الـ index.html — لا حاجة لـ Chart.js هنا.
      if (this.dashChart) { try { this.dashChart.destroy(); } catch {} this.dashChart = null; }
    },

    // ------ Export ------
    async exportExcel() {
      if (!this.currentModule?.exportable) return;
      try {
        const res = await fetch(`${API}/exports/${this.page}`, {
          headers: { Authorization: `Bearer ${this.token}` },
        });
        if (!res.ok) { alert('فشل التصدير'); return; }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.page}-${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } catch (e) {
        alert(e.message || 'فشل التصدير');
      }
    },

    // ------ Duplicate ──────────────────────────────────────────────
    async duplicateItem(item) {
      await this.loadRelations();
      const copy = { ...item };
      // حذف الحقول التي تتولد تلقائياً أو تعود للصفر
      const STRIP = ['id', 'code', 'createdAt', 'updatedAt', 'spent', 'progress',
                     'effective', 'verifiedAt', 'verifiedNote', 'resolvedAt',
                     'closedAt', 'overallRating'];
      for (const k of STRIP) delete copy[k];
      // إعادة الحالة للبداية
      if ('status' in copy) {
        const firstOpt = this.currentModule?.statusOptions?.find(o => o.v);
        copy.status = firstOpt?.v || 'PLANNED';
      }
      // تحويل التواريخ للتنسيق الصحيح
      for (const f of this.currentFields) {
        if (f.type === 'date' && copy[f.key]) copy[f.key] = copy[f.key].split('T')[0];
      }
      this.modal = { open: true, mode: 'create', data: copy };
      this.toast('تم نسخ السجل — راجع البيانات قبل الحفظ', 'warn');
    },

    // ------ CRUD ------
    async openCreate() {
      if (!this.currentModule) {
        // صفحة بلا CRUD (myWork / dashboard / ...) — لا يوجد سجل قابل للإضافة هنا
        this.toast?.('هذه الصفحة ليست قائمة سجلات. افتح قسماً من القائمة الجانبية لإضافة سجل.');
        return;
      }
      await this.loadRelations();
      this.modal = { open: true, mode: 'create', data: {} };
      this.$nextTick ? this.$nextTick(() => this._snapshotModal()) : this._snapshotModal();
    },
    async openEdit(item) {
      await this.loadRelations();
      const data = { ...item };
      for (const f of this.currentFields) {
        if (f.type === 'date' && data[f.key]) data[f.key] = data[f.key].split('T')[0];
      }
      this.modal = { open: true, mode: 'edit', data };
      this.$nextTick ? this.$nextTick(() => this._snapshotModal()) : this._snapshotModal();
    },
    // Batch 11 — خريطة الانتقالات النهائية التي تتطلب توقيعاً رقمياً (ISO §7.1.5.2 / §9.3.3 / §10.2)
    _terminalSigMap: {
      ncr:              { entityType: 'NCR',              status: 'CLOSED',    purpose: 'close',    label: 'إغلاق عدم المطابقة' },
      complaints:       { entityType: 'Complaint',        status: 'CLOSED',    purpose: 'close',    label: 'إغلاق الشكوى' },
      audits:           { entityType: 'Audit',            status: 'COMPLETED', purpose: 'complete', label: 'إكمال التدقيق الداخلي' },
      managementReview: { entityType: 'ManagementReview', status: 'COMPLETED', purpose: 'complete', label: 'اعتماد مخرجات المراجعة الإدارية' },
    },

    async save() {
      const mod = this.currentModule;
      if (!mod) {
        this.modal.open = false;
        alert('لا يمكن الحفظ من هذه الصفحة — افتح قسم السجلات المناسب من القائمة الجانبية');
        return;
      }
      const payload = { ...this.modal.data };

      // ── Batch 11 — حارس التوقيع على الانتقالات النهائية ─────────────
      // إذا كانت الصفحة تتطلب توقيعاً عند بلوغ حالة معينة ولم تكن الحالة الأصلية هكذا،
      // افتح مودال التوقيع أولاً، ثم أكمل الحفظ بعد إتمامه.
      const sigCfg = this._terminalSigMap[this.page];
      if (sigCfg && this.modal.mode === 'edit' && payload.status === sigCfg.status) {
        let originalStatus = null;
        try { originalStatus = JSON.parse(this._modalInitialSnapshot || '{}').status || null; } catch {}
        if (originalStatus && originalStatus !== sigCfg.status) {
          // خزّن الحمولة وافتح مودال التوقيع
          const pendingSave = async () => {
            try {
              await this.api('PUT', `/${mod.endpoint}/${payload.id}`, payload);
              this.modal.open = false;
              this._modalInitialSnapshot = null;
              this.toast('✅ تم حفظ التعديلات بعد التوقيع', 'success');
              await this.loadList();
            } catch (e) { alert(e.message || 'فشل الحفظ بعد التوقيع'); }
          };
          this.openSignatureModal({
            entityType: sigCfg.entityType,
            entityId:   payload.id,
            purpose:    sigCfg.purpose,
            label:      sigCfg.label,
            onDone:     pendingSave,
          });
          return; // الحفظ سيكمَل في onDone
        }
      }

      for (const f of this.currentFields) {
        if (f.type === 'number' && payload[f.key] != null && payload[f.key] !== '') {
          let n = Number(payload[f.key]);
          if (!Number.isFinite(n)) { alert(`"${f.label}" يجب أن يكون رقماً`); return; }
          // clamp داخل min/max إن وُجدت
          if (f.min != null && n < f.min) n = f.min;
          if (f.max != null && n > f.max) n = f.max;
          payload[f.key] = n;
        }
        if (f.type === 'date' && payload[f.key]) {
          const d = new Date(payload[f.key]);
          if (f.maxToday) {
            const today = new Date(); today.setHours(23,59,59,999);
            if (d > today) { alert(`"${f.label}" لا يمكن أن يكون في المستقبل`); return; }
          }
          payload[f.key] = d.toISOString();
        }
        // multiselect: اضمن أنّها مصفوفة (حتى لو كانت undefined)
        if (f.type === 'multiselect') {
          if (!Array.isArray(payload[f.key])) payload[f.key] = [];
        } else if (payload[f.key] === '') {
          // Convert empty relation/select/date/number to null so Prisma accepts
          payload[f.key] = null;
        }
      }
      try {
        if (this.modal.mode === 'edit') {
          await this.api('PUT', `/${mod.endpoint}/${payload.id}`, payload);
        } else {
          await this.api('POST', `/${mod.endpoint}`, payload);
        }
        this.modal.open = false;
        this._modalInitialSnapshot = null;
        this.toast(this.modal.mode === 'edit' ? '✅ تم حفظ التعديلات' : '✅ تم إضافة السجل بنجاح', 'success');
        await this.loadList();
      } catch (e) { alert(e.message || 'فشل الحفظ'); }
    },
    async remove(id) {
      if (!confirm('هل أنت متأكد من الحذف؟ هذا الإجراء لا يمكن التراجع عنه.')) return;
      try {
        await this.api('DELETE', `/${this.currentModule.endpoint}/${id}`);
        await this.loadList();
      } catch (e) { alert(e.message || 'فشل الحذف'); }
    },

    // ------ External Eval Link ------
    async requestEvalLink(supplier) {
      try {
        const r = await this.api('POST', '/eval-tokens', { supplierId: supplier.id, daysValid: 30 });
        this.evalLinkModal = { open: true, url: r.url, supplier, copied: false };
      } catch (e) { alert(e.message || 'فشل إنشاء الرابط'); }
    },

    copyEvalLink() {
      navigator.clipboard.writeText(this.evalLinkModal.url).then(() => {
        this.evalLinkModal.copied = true;
        setTimeout(() => { this.evalLinkModal.copied = false; }, 2500);
      }).catch(() => {
        // fallback for older browsers
        const el = document.createElement('textarea');
        el.value = this.evalLinkModal.url;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        el.remove();
        this.evalLinkModal.copied = true;
        setTimeout(() => { this.evalLinkModal.copied = false; }, 2500);
      });
    },

    // ------ Supplier Evaluation ------
    openEval(supplier) {
      this.evalModal.step = 1;
      this.evalModal.supplier = supplier;
      this.evalModal.period = '';
      this.evalModal.notes = '';
      this.evalModal.recommendation = '';
      this.evalModal.busy = false;
      // Load criteria based on supplier type
      this.evalModal.criteria = this.criteriaForType(supplier.type);
      this.evalModal.criteria.forEach(c => { c.score = 0; c.note = ''; });
      this.evalModal.open = true;
    },

    // ── Wizard navigation ─────────────────────────────────────────
    evalGoNext() {
      const s = this.evalModal.step;
      if (s === 1) {
        if (!this.evalModal.period.trim()) { alert('الفترة التقييمية مطلوبة'); return; }
        this.evalModal.step = 2;
      } else if (s === 2) {
        // نقبل الصفر؛ لا نجبر على ملء كل المعايير — لكن نحذّر إن كلها صفر
        const anyScored = this.evalModal.criteria.some(c => Number(c.score) > 0);
        if (!anyScored) { alert('يجب تقدير معيار واحد على الأقل'); return; }
        this.evalModal.step = 3;
      }
    },
    evalGoBack() {
      if (this.evalModal.step > 1) this.evalModal.step -= 1;
    },

    // مجموعة المعايير الحرجة الفاشلة (للعرض في مراجعة step 3)
    evalFailedCriticals() {
      return this.evalModal.criteria.filter(
        c => c.critical && (Number(c.score) || 0) < (c.max * 0.5)
      );
    },

    criteriaForType(type) {
      // Common criteria — applied to all supplier types
      const common = [
        { key: 'transparency',   label: 'الشفافية ومكافحة الفساد',        max: 8, critical: true,  score: 0 },
        { key: 'saudization',    label: 'نسبة السعودة وتوطين الوظائف',    max: 5, critical: false, score: 0 },
        { key: 'sustainability', label: 'الاستدامة والمسؤولية الاجتماعية', max: 5, critical: false, score: 0 },
        { key: 'financial_stab', label: 'الاستقرار المالي وموثوقية المورد', max: 5, critical: false, score: 0 },
      ];
      const core = {
        GOODS: [
          { key: 'product_quality', label: 'جودة المنتجات ومطابقة المواصفات', max: 25, critical: true,  score: 0 },
          { key: 'delivery',        label: 'الالتزام بمواعيد التسليم',         max: 18, critical: false, score: 0 },
          { key: 'packaging',       label: 'التعبئة والتغليف والحفظ',          max: 10, critical: false, score: 0 },
          { key: 'pricing',         label: 'الأسعار والشروط التجارية',         max: 12, critical: false, score: 0 },
          { key: 'communication',   label: 'الاستجابة والتواصل',               max: 7,  critical: false, score: 0 },
          { key: 'after_sale',      label: 'خدمات ما بعد البيع والضمان',       max: 5,  critical: false, score: 0 },
        ],
        SERVICES: [
          { key: 'service_quality', label: 'جودة الخدمة المقدمة',             max: 22, critical: true,  score: 0 },
          { key: 'professionalism', label: 'الكفاءة والاحترافية للفريق',       max: 18, critical: false, score: 0 },
          { key: 'delivery',        label: 'الالتزام بالجدول الزمني',          max: 15, critical: false, score: 0 },
          { key: 'communication',   label: 'التواصل والاستجابة',               max: 12, critical: false, score: 0 },
          { key: 'pricing',         label: 'الأسعار والقيمة المقدمة',          max: 10, critical: false, score: 0 },
        ],
        CONSTRUCTION: [
          { key: 'spec_compliance', label: 'الالتزام بالمواصفات الفنية والمخططات', max: 14, critical: true,  score: 0 },
          { key: 'work_quality',    label: 'جودة التنفيذ ومطابقة المعايير الهندسية', max: 13, critical: true,  score: 0 },
          { key: 'schedule',        label: 'الالتزام بالجدول الزمني ومراحل التسليم', max: 12, critical: false, score: 0 },
          { key: 'hse_safety',      label: 'السلامة المهنية وتطبيق اشتراطات HSE',  max: 12, critical: true,  score: 0 },
          { key: 'workforce',       label: 'كفاءة العمالة والكوادر الفنية',         max: 8,  critical: false, score: 0 },
          { key: 'materials',       label: 'جودة المواد المستخدمة',                max: 8,  critical: false, score: 0 },
          { key: 'warranty',        label: 'فترة الضمان وخدمات ما بعد التسليم',    max: 5,  critical: false, score: 0 },
          { key: 'permits',         label: 'الالتزام بالأنظمة البلدية والتراخيص',   max: 5,  critical: true,  score: 0 },
        ],
        IT_SERVICES: [
          { key: 'solution_quality',label: 'جودة الحل التقني ومطابقة المتطلبات', max: 18, critical: true,  score: 0 },
          { key: 'sla_response',    label: 'وقت الاستجابة والالتزام بـ SLA',      max: 15, critical: true,  score: 0 },
          { key: 'support',         label: 'الدعم الفني وتوفره عند الحاجة',       max: 12, critical: false, score: 0 },
          { key: 'data_security',   label: 'أمن المعلومات وحماية البيانات',       max: 12, critical: true,  score: 0 },
          { key: 'compatibility',   label: 'التوافقية مع الأنظمة القائمة',        max: 8,  critical: false, score: 0 },
          { key: 'documentation',   label: 'التوثيق والتدريب',                   max: 7,  critical: false, score: 0 },
          { key: 'pricing',         label: 'الأسعار والقيمة المقدمة',            max: 5,  critical: false, score: 0 },
        ],
        TRANSPORT: [
          { key: 'safety',           label: 'سلامة النقل وحماية البضاعة',       max: 22, critical: true,  score: 0 },
          { key: 'delivery',         label: 'الالتزام بالمواعيد',               max: 22, critical: false, score: 0 },
          { key: 'vehicle_condition',label: 'حالة المركبات والمعدات',           max: 15, critical: false, score: 0 },
          { key: 'driver_conduct',   label: 'سلوك وكفاءة السائقين',             max: 10, critical: false, score: 0 },
          { key: 'communication',    label: 'التواصل والاستجابة',               max: 5,  critical: false, score: 0 },
          { key: 'pricing',          label: 'الأسعار والتنافسية',               max: 3,  critical: false, score: 0 },
        ],
        CONSULTING: [
          { key: 'output_quality',  label: 'جودة التقارير والمخرجات',           max: 22, critical: true,  score: 0 },
          { key: 'expertise',       label: 'الخبرة والكفاءة التخصصية',          max: 18, critical: true,  score: 0 },
          { key: 'delivery',        label: 'الالتزام بالجدول الزمني',           max: 15, critical: false, score: 0 },
          { key: 'communication',   label: 'التواصل والاستجابة',                max: 12, critical: false, score: 0 },
          { key: 'pricing',         label: 'الأسعار والقيمة المقابلة',          max: 10, critical: false, score: 0 },
        ],
        IN_KIND_DONOR: [
          { key: 'spec_conformity', label: 'مطابقة المواصفات المطلوبة',         max: 28, critical: true,  score: 0 },
          { key: 'product_quality', label: 'جودة المواد / البضائع',             max: 22, critical: true,  score: 0 },
          { key: 'delivery',        label: 'الالتزام بالمواعيد',               max: 15, critical: false, score: 0 },
          { key: 'compliance',      label: 'الامتثال والوثائق (صلاحية - شهادات)', max: 12, critical: true,  score: 0 },
        ],
      };
      const fallback = [
        { key: 'quality',       label: 'جودة المنتج / الخدمة',              max: 22, critical: true,  score: 0 },
        { key: 'delivery',      label: 'الالتزام بالمواعيد',                max: 18, critical: false, score: 0 },
        { key: 'communication', label: 'التواصل والاستجابة',                max: 15, critical: false, score: 0 },
        { key: 'pricing',       label: 'الأسعار والشروط التجارية',          max: 12, critical: false, score: 0 },
        { key: 'compliance',    label: 'الامتثال والوثائق',                 max: 10, critical: false, score: 0 },
      ];
      return [ ...(core[type] || fallback), ...common ];
    },

    evalTotal() {
      return this.evalModal.criteria.reduce((s, c) => s + Math.min(c.max, Math.max(0, Number(c.score) || 0)), 0);
    },
    evalMaxTotal() {
      return this.evalModal.criteria.reduce((s, c) => s + c.max, 0);
    },
    evalPct() {
      const max = this.evalMaxTotal();
      return max > 0 ? Math.round((this.evalTotal() / max) * 100) : 0;
    },
    evalGrade() {
      const p = this.evalPct();
      if (p >= 90) return 'ممتاز ⭐⭐⭐⭐⭐';
      if (p >= 80) return 'جيد جداً ⭐⭐⭐⭐';
      if (p >= 70) return 'جيد ⭐⭐⭐';
      if (p >= 60) return 'مقبول ⭐⭐';
      return 'ضعيف ⭐';
    },
    evalCriticalFailed() {
      return this.evalModal.criteria.some(c => c.critical && (Number(c.score) || 0) < (c.max * 0.5));
    },
    evalDecision() {
      if (this.evalCriticalFailed()) return 'مرفوض (فشل معيار حرج) ⛔';
      const p = this.evalPct();
      if (p >= 85) return 'معتمد ✅';
      if (p >= 70) return 'معتمد مشروط ⚠️';
      if (p >= 50) return 'قيد المراقبة 🔄';
      return 'مرفوض ❌';
    },

    async submitEval() {
      // Batch 12: نرسل answers خام للـ evalEngine الموحّد على الخادم.
      // الخادم يحسب totalScore/maxScore/percentage/grade/decision/criticalFailed.
      if (this.evalModal.busy) return;
      const answers = {};
      for (const c of this.evalModal.criteria) {
        answers[c.key] = Number(c.score) || 0;
        const note = (c.note || '').trim();
        if (note) answers[`${c.key}_note`] = note.slice(0, 300);
      }
      this.evalModal.busy = true;
      try {
        const res = await this.api('POST', '/supplier-evals', {
          supplierId: this.evalModal.supplier.id,
          answers,
          period: this.evalModal.period,
          notes: this.evalModal.notes,
          recommendation: this.evalModal.recommendation || null,
        });
        const it = res?.item || {};
        this.evalModal.open = false;
        this.evalModal.step = 1;
        alert(`✅ تم حفظ التقييم\nالنتيجة: ${it.totalScore ?? '-'}/${it.maxScore ?? '-'} (${it.percentage ?? '-'}%) — ${it.grade ?? ''}\nالقرار: ${it.decision ?? ''}`);
        await this.loadList();
      } catch (e) { alert(e.message || 'فشل حفظ التقييم'); }
      finally { this.evalModal.busy = false; }
    },

    // ------ Digital Signature (delegates to unified Batch 10 modal) ------
    openSig(item) {
      const typeMap = {
        ncr: 'NCR',
        audits: 'Audit',
        'supplier-evals': 'SupplierEval',
        managementReview: 'ManagementReview',
        documents: 'Document',
      };
      const entityType = typeMap[this.page] || this.page;
      this.openSignatureModal({
        entityType,
        entityId: item.id,
        purpose: 'approve',
        label: 'اعتماد السجل',
        onDone: () => { this.toast?.('✅ تم حفظ التوقيع'); this.loadList?.(); },
      });
    },

    // ------ rendering helpers ------
    renderCell(item, col) {
      let v = item[col.key];
      if (v === null || v === undefined || v === '') return '<span class="text-gray-300">—</span>';
      if (col.type === 'date')   v = this.fmtDate(v);
      if (col.type === 'bool')   return v ? '<span class="text-green-600">✓</span>' : '<span class="text-gray-400">✗</span>';
      if (col.type === 'status') return `<span class="px-2 py-0.5 rounded text-xs ${this.statusColor(v)}">${this.statusLabel(v)}</span>`;
      if (col.type === 'level')  return `<span class="px-2 py-0.5 rounded text-xs ${this.levelColor(v)}">${v}</span>`;
      return this.escape(String(v));
    },
    escape(s) { return s.replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); },
    // ─── Formatters موحّدة ─────────────────────────────────────
    // نستخدم تقويم جريجوري (gregory) مع لغة ar-SA — الهجري يُربك المُدقّق الخارجي.
    fmtDate(v) {
      if (v == null || v === '') return '';
      try {
        const d = new Date(v); if (isNaN(d)) return String(v);
        return d.toLocaleDateString('ar-SA-u-ca-gregory', { day: '2-digit', month: '2-digit', year: 'numeric' });
      } catch { return String(v); }
    },
    fmtDateTime(v) {
      if (v == null || v === '') return '';
      try {
        const d = new Date(v); if (isNaN(d)) return String(v);
        return d.toLocaleString('ar-SA-u-ca-gregory', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      } catch { return String(v); }
    },
    fmtNumber(v, digits = 0) {
      if (v == null || v === '' || isNaN(v)) return '';
      try { return Number(v).toLocaleString('ar-SA', { maximumFractionDigits: digits, minimumFractionDigits: 0 }); }
      catch { return String(v); }
    },
    fmtCurrency(v) {
      if (v == null || v === '' || isNaN(v)) return '';
      try { return Number(v).toLocaleString('ar-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }); }
      catch { return String(v); }
    },
    fmtPercent(v, digits = 0) {
      if (v == null || v === '' || isNaN(v)) return '';
      try { return Number(v).toLocaleString('ar-SA', { style: 'percent', maximumFractionDigits: digits, minimumFractionDigits: 0 }); }
      catch { return String(v) + '%'; }
    },
    today() { return new Date().toLocaleDateString('ar-SA-u-ca-gregory', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); },

    statusLabel(v) {
      const map = {
        PLANNED:'مخطط', IN_PROGRESS:'قيد التنفيذ', ACHIEVED:'محقق', DELAYED:'متأخر', CANCELLED:'ملغى', COMPLETED:'مكتمل',
        IDENTIFIED:'محدد', UNDER_TREATMENT:'قيد المعالجة', MITIGATED:'خُفف', ACCEPTED:'مقبول', CLOSED:'مغلق',
        NEW:'جديد', UNDER_REVIEW:'قيد الدراسة', RESOLVED:'تم حله', REJECTED:'مرفوض',
        OPEN:'مفتوح', ROOT_CAUSE:'تحليل السبب', ACTION_PLANNED:'خطة إجراء', VERIFICATION:'تحقق',
        COMPLETED:'مكتمل', PENDING:'قيد المراجعة', APPROVED:'معتمد', CONDITIONAL:'مشروط',
        SUSPENDED:'موقوف', BLACKLISTED:'مستبعد',
        RECEIVED:'مستلم', VERIFIED:'مدقق', DISTRIBUTED:'موزع',
        APPLICANT:'متقدم', ACTIVE:'نشط', INACTIVE:'غير نشط', GRADUATED:'تخرج',
        DRAFT:'مسودة', PUBLISHED:'منشور', OBSOLETE:'ملغى',
      };
      return map[v] || v;
    },
    statusColor(v) {
      const green = ['ACHIEVED','MITIGATED','RESOLVED','CLOSED','COMPLETED','APPROVED','PUBLISHED','ACTIVE','VERIFIED','DISTRIBUTED','GRADUATED'];
      const red   = ['DELAYED','CANCELLED','REJECTED','BLACKLISTED','SUSPENDED','OBSOLETE'];
      const amber = ['IN_PROGRESS','UNDER_TREATMENT','UNDER_REVIEW','ROOT_CAUSE','ACTION_PLANNED','VERIFICATION','CONDITIONAL','APPLICANT','DRAFT','RECEIVED'];
      if (green.includes(v)) return 'bg-green-100 text-green-700';
      if (red.includes(v))   return 'bg-red-100 text-red-700';
      if (amber.includes(v)) return 'bg-amber-100 text-amber-700';
      return 'bg-blue-100 text-blue-700';
    },
    levelColor(v) {
      if (v === 'حرج')   return 'bg-red-100 text-red-700';
      if (v === 'مرتفع') return 'bg-orange-100 text-orange-700';
      if (v === 'متوسط') return 'bg-yellow-100 text-yellow-700';
      return 'bg-green-100 text-green-700';
    },
    roleLabel(r) {
      return ({
        SUPER_ADMIN: 'مسؤول النظام', QUALITY_MANAGER: 'مدير الجودة',
        COMMITTEE_MEMBER: 'عضو لجنة جودة', DEPT_MANAGER: 'مسؤول قسم',
        EMPLOYEE: 'موظف', GUEST_AUDITOR: 'مدقق ضيف',
      })[r] || r;
    },

    // ------ API helper ------
    async api(method, path, body = null, authRequired = true) {
      const headers = { 'Content-Type': 'application/json' };
      if (authRequired && this.token) headers.Authorization = `Bearer ${this.token}`;
      const res = await fetch(API + path, {
        method, headers, credentials: 'include',
        body: body ? JSON.stringify(body) : undefined,
      });
      if (res.status === 401 && authRequired && this.refreshToken) {
        try {
          const r = await fetch(API + '/auth/refresh', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: this.refreshToken }),
          });
          if (r.ok) {
            const data = await r.json();
            this.token = data.token;
            localStorage.setItem('qms_token', data.token);
            headers.Authorization = `Bearer ${data.token}`;
            const retry = await fetch(API + path, {
              method, headers, credentials: 'include',
              body: body ? JSON.stringify(body) : undefined,
            });
            return this._handle(retry);
          }
        } catch {}
        this.logout();
      }
      return this._handle(res);
    },
    async _handle(res) {
      let data = null;
      try { data = await res.json(); } catch {}
      if (!res.ok) {
        const msg = data?.error?.message || `HTTP ${res.status}`;
        throw new Error(msg);
      }
      return data;
    },
  };
}

window.app = app;
