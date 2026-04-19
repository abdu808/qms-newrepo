/**
 * setup-all2.mjs — إعداد شامل (نسخة مصححة)
 */
import { prisma } from './src/db.js';

const ADMIN_ID = 'cmo3gljix0008hwj1e1ruapl1';
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = arr => arr[rand(0, arr.length - 1)];

// ══════════════════════════════════════════════════════════════
// 1. اعتماد ونشر الوثائق المتبقية
// ══════════════════════════════════════════════════════════════
async function fixDocs() {
  const remaining = await prisma.document.count({ where: { status: 'DRAFT' } });
  if (remaining === 0) { console.log('📄 الوثائق: كلها منشورة بالفعل ✅'); return; }
  await prisma.document.updateMany({
    where: { status: 'DRAFT' },
    data: {
      status: 'PUBLISHED',
      approvedById: ADMIN_ID,
      approvedAt: new Date('2026-03-01'),
      effectiveDate: new Date('2026-03-15'),
      reviewDate: new Date('2027-03-15'),
    },
  });
  console.log(`📄 تم نشر ${remaining} وثيقة إضافية ✅`);
}

// ══════════════════════════════════════════════════════════════
// 2. الدورات التدريبية — الحقول الصحيحة من المخطط
// ══════════════════════════════════════════════════════════════
async function insertTraining() {
  console.log('\n🎓 إدخال الدورات التدريبية...');

  const courses = [
    {
      code: 'TRN-2026-001',
      title: 'متطلبات ISO 9001:2015 — توعية عامة',
      trainer: 'مدير الجودة — جمعية البر بصبيا',
      date: new Date('2026-02-10'),
      duration: 8,
      location: 'قاعة الاجتماعات الرئيسية',
      category: 'جودة',
      competenceTarget: 'الوعي بمتطلبات ISO 9001 وأهمية نظام إدارة الجودة',
    },
    {
      code: 'TRN-2026-002',
      title: 'إدارة الشكاوى ورضا المستفيدين',
      trainer: 'مدير البرامج الاجتماعية',
      date: new Date('2026-02-24'),
      duration: 4,
      location: 'قاعة التدريب',
      category: 'خدمة عملاء',
      competenceTarget: 'مهارات التعامل مع المستفيدين ومعالجة الشكاوى بفعالية',
    },
    {
      code: 'TRN-2026-003',
      title: 'السلامة والصحة المهنية',
      trainer: 'الهيئة السعودية للسلامة والصحة المهنية',
      date: new Date('2026-03-05'),
      duration: 12,
      location: 'مركز التدريب — جازان',
      category: 'سلامة',
      competenceTarget: 'تطبيق معايير السلامة والصحة المهنية في بيئة العمل الخيري',
    },
    {
      code: 'TRN-2026-004',
      title: 'استخدام نظام إدارة الجودة الإلكتروني',
      trainer: 'مدير تقنية المعلومات',
      date: new Date('2026-03-15'),
      duration: 3,
      location: 'قاعة الحاسب',
      category: 'تقنية',
      competenceTarget: 'إتقان استخدام نظام QMS الإلكتروني لإدخال البيانات وقراءة التقارير',
    },
    {
      code: 'TRN-2026-005',
      title: 'مهارات التواصل مع المتبرعين',
      trainer: 'مستشار خارجي — د. عمر الفيفي',
      date: new Date('2026-04-02'),
      duration: 6,
      location: 'فندق جازان كونتيننتال',
      category: 'تواصل',
      competenceTarget: 'بناء علاقات مثمرة مع المتبرعين وتعزيز الولاء والثقة',
    },
  ];

  let done = 0;
  for (const c of courses) {
    try {
      await prisma.training.create({ data: c });
      done++;
    } catch (e) {
      if (!e.message.includes('Unique')) console.error('  خطأ:', e.message.split('\n')[0]);
    }
  }
  console.log(`   ✅ ${done} دورة تدريبية`);
}

// ══════════════════════════════════════════════════════════════
// 3. الموردون + تقييماتهم — الحقول الصحيحة
// ══════════════════════════════════════════════════════════════
async function insertSuppliers() {
  console.log('\n🏪 إضافة الموردين وتقييماتهم...');

  const suppliers = [
    {
      code: 'SUP-2026-001',
      name: 'شركة الأمل لتوزيع المواد الغذائية',
      type: 'GOODS',
      contactPerson: 'أحمد محمد الزهراني',
      phone: '0172220001',
      city: 'صبيا',
      vatNumber: '3001234567',
      status: 'APPROVED',
      notes: 'مورد رئيسي لسلال الغذاء الشهرية — موثوق وملتزم بالمواصفات',
    },
    {
      code: 'SUP-2026-002',
      name: 'مؤسسة الخير للملابس والأقمشة',
      type: 'GOODS',
      contactPerson: 'خالد إبراهيم القحطاني',
      phone: '0172220002',
      city: 'أبو عريش',
      status: 'APPROVED',
      notes: 'مورد ملابس الأيتام وكسوة العيد والشتاء',
    },
    {
      code: 'SUP-2026-003',
      name: 'شركة البناء والتشييد المتحدة',
      type: 'CONSTRUCTION',
      contactPerson: 'سلطان ناصر العمري',
      phone: '0172220003',
      city: 'جازان',
      vatNumber: '3007654321',
      status: 'APPROVED',
      notes: 'مقاول ترميم وبناء المساكن ضمن برنامج الإسكان الخيري',
    },
    {
      code: 'SUP-2026-004',
      name: 'مركز الرعاية الطبية الأهلي',
      type: 'SERVICES',
      contactPerson: 'د. محمد عبدالله الشهري',
      phone: '0172220004',
      city: 'صبيا',
      status: 'APPROVED',
      notes: 'تقديم الخدمات الطبية والرعاية الصحية للمستفيدين بأسعار مخفضة',
    },
    {
      code: 'SUP-2026-005',
      name: 'مكتب الرواد للطباعة والتصميم',
      type: 'SERVICES',
      contactPerson: 'فيصل علي الجعفري',
      phone: '0172220005',
      city: 'صبيا',
      status: 'APPROVED',
      notes: 'طباعة الوثائق والنماذج الرسمية واللافتات',
    },
    {
      code: 'SUP-2026-006',
      name: 'شركة تقنية الجنوب لأنظمة المعلومات',
      type: 'IT_SERVICES',
      contactPerson: 'عبدالرحمن سعد الغامدي',
      phone: '0172220006',
      city: 'جازان',
      vatNumber: '3009876543',
      status: 'APPROVED',
      notes: 'صيانة الأجهزة وتطوير الأنظمة ودعم البنية التحتية التقنية',
    },
    {
      code: 'SUP-2026-007',
      name: 'مزرعة الحلول الزراعية — التمور والمنتجات',
      type: 'IN_KIND_DONOR',
      contactPerson: 'حمود عبدالله الحازمي',
      phone: '0172220007',
      city: 'صامطة',
      status: 'APPROVED',
      notes: 'تبرعات عينية دورية: تمور وحبوب ومنتجات زراعية لصناديق الغذاء',
    },
  ];

  // معايير التقييم الموحدة
  const buildCriteria = () => ({
    'جودة المنتج أو الخدمة': rand(3, 5),
    'الالتزام بالمواعيد والكميات': rand(3, 5),
    'التسعير والقيمة مقابل التكلفة': rand(3, 5),
    'خدمة ما بعد التسليم والتواصل': rand(3, 5),
    'دقة الوثائق والفواتير': rand(3, 5),
  });

  const gradeLabel = (pct) =>
    pct >= 90 ? 'ممتاز' : pct >= 80 ? 'جيد جداً' : pct >= 70 ? 'جيد' : pct >= 60 ? 'مقبول' : 'ضعيف';
  const decisionLabel = (pct) =>
    pct >= 70 ? 'معتمد' : pct >= 60 ? 'مشروط' : 'مرفوض';

  let supDone = 0, evalDone = 0;

  for (const sup of suppliers) {
    try {
      const created = await prisma.supplier.upsert({
        where: { code: sup.code },
        update: {},
        create: sup,
      });

      for (const period of ['Q4-2025', 'Q1-2026']) {
        const criteria = buildCriteria();
        const vals = Object.values(criteria);
        const totalScore = +((vals.reduce((a, b) => a + b, 0) / vals.length) * 20).toFixed(1); // out of 100
        const maxScore = 100;
        const percentage = totalScore;

        try {
          await prisma.supplierEval.create({
            data: {
              code: `SEVAL-${period}-${sup.code.slice(-3)}`,
              supplierId: created.id,
              evaluatorId: ADMIN_ID,
              period,
              criteriaJson: JSON.stringify(criteria),
              totalScore,
              maxScore,
              percentage,
              grade: gradeLabel(percentage),
              decision: decisionLabel(percentage),
              notes: pick([
                'التزام ممتاز بالمواصفات والجودة المطلوبة',
                'أداء جيد مع بعض التحسينات المطلوبة في التسليم',
                'مورد موثوق يُعتمد للتعاملات المستقبلية',
                'يُنصح بمتابعة جودة التوريد في الدورة القادمة',
              ]),
            },
          });
          evalDone++;
        } catch {}
      }

      // تحديث متوسط التقييم
      const evals = await prisma.supplierEval.findMany({ where: { supplierId: created.id } });
      if (evals.length) {
        const avg = +(evals.reduce((s, e) => s + e.percentage, 0) / evals.length).toFixed(1);
        await prisma.supplier.update({ where: { id: created.id }, data: { overallRating: avg } });
      }
      supDone++;
    } catch (e) {
      console.error('  خطأ مورد:', e.message.split('\n')[0]);
    }
  }
  console.log(`   ✅ ${supDone} مورد + ${evalDone} تقييم`);
}

// ══════════════════════════════════════════════════════════════
// 4. الاستبيانات — questionsJson + بيانات محاكاة
// ══════════════════════════════════════════════════════════════
async function insertSurveys() {
  console.log('\n📝 إنشاء الاستبيانات...');

  const surveys = [
    {
      code: 'SRV-2026-001',
      title: 'رضا المستفيدين عن خدمات الجمعية — Q1 2026',
      target: 'BENEFICIARY',
      period: 'Q1-2026',
      active: false,
      responses: 120,
      avgScore: 4.3,
      questions: [
        { id:1, text:'كيف تقيّم جودة الخدمات التي تقدمها الجمعية؟', type:'RATING' },
        { id:2, text:'هل تلقيت الخدمة في الوقت المناسب؟', type:'RATING' },
        { id:3, text:'كيف تصف تعامل الموظفين معك؟', type:'RATING' },
        { id:4, text:'هل المساعدة المقدمة تلبي احتياجاتك الفعلية؟', type:'RATING' },
        { id:5, text:'ما مدى رضاك العام عن الجمعية؟', type:'RATING' },
        { id:6, text:'هل لديك اقتراحات لتحسين الخدمات؟', type:'TEXT' },
      ],
      results: { avgByQ: [4.4, 4.2, 4.5, 4.1, 4.3], topFeedback: ['خدمة ممتازة', 'تسريع الإجراءات', 'زيادة المساعدات'] },
    },
    {
      code: 'SRV-2026-002',
      title: 'رضا المتطوعين — الربع الأول 2026',
      target: 'VOLUNTEER',
      period: 'Q1-2026',
      active: false,
      responses: 45,
      avgScore: 4.1,
      questions: [
        { id:1, text:'هل تتلقى التوجيه الكافي قبل ممارسة النشاط التطوعي؟', type:'RATING' },
        { id:2, text:'كيف تقيّم تنظيم الأنشطة والفعاليات؟', type:'RATING' },
        { id:3, text:'هل تشعر بأن عملك التطوعي يُحدث فرقاً حقيقياً؟', type:'RATING' },
        { id:4, text:'هل أنت راضٍ عن التواصل مع إدارة الجمعية؟', type:'RATING' },
        { id:5, text:'مقترحاتك لتطوير برامج التطوع؟', type:'TEXT' },
      ],
      results: { avgByQ: [4.0, 4.2, 4.5, 3.9, null], topFeedback: ['تنظيم أفضل', 'تقدير المتطوعين', 'مزيد من الفعاليات'] },
    },
    {
      code: 'SRV-2026-003',
      title: 'رضا المتبرعين وأصحاب الكفالات — 2026',
      target: 'DONOR',
      period: '2026',
      active: true,
      responses: 67,
      avgScore: 4.5,
      questions: [
        { id:1, text:'هل أنت راضٍ عن شفافية صرف تبرعاتك؟', type:'RATING' },
        { id:2, text:'هل تصلك تقارير دورية عن استخدام تبرعاتك؟', type:'RATING' },
        { id:3, text:'كيف تقيّم سرعة الاستجابة عند تواصلك مع الجمعية؟', type:'RATING' },
        { id:4, text:'هل تثق في أن تبرعاتك تصل للمستحقين؟', type:'RATING' },
        { id:5, text:'ما احتمالية أن توصي بالتبرع لجمعية البر بصبيا؟', type:'RATING' },
        { id:6, text:'ملاحظاتك واقتراحاتك؟', type:'TEXT' },
      ],
      results: { avgByQ: [4.6, 4.2, 4.4, 4.8, 4.5, null], topFeedback: ['جمعية رائدة', 'نريد تقارير أكثر', 'بارك الله فيكم'] },
    },
    {
      code: 'SRV-2026-004',
      title: 'رضا الموظفين عن بيئة العمل — 2026',
      target: 'EMPLOYEE',
      period: '2026',
      active: false,
      responses: 18,
      avgScore: 3.9,
      questions: [
        { id:1, text:'هل تشعر بالرضا عن بيئة عملك في الجمعية؟', type:'RATING' },
        { id:2, text:'هل توفر الجمعية فرصاً للتطوير والنمو المهني؟', type:'RATING' },
        { id:3, text:'كيف تقيّم التواصل مع الإدارة العليا؟', type:'RATING' },
        { id:4, text:'هل الصلاحيات والمسؤوليات واضحة في عملك؟', type:'RATING' },
        { id:5, text:'ما مقترحاتك لتحسين بيئة العمل؟', type:'TEXT' },
      ],
      results: { avgByQ: [3.8, 3.7, 4.1, 4.0, null], topFeedback: ['تحسين الرواتب', 'مزيد من التدريب', 'بيئة عمل إيجابية'] },
    },
    {
      code: 'SRV-2026-005',
      title: 'تقييم مجلس الإدارة لأداء الجمعية — 2026',
      target: 'PARTNER',
      period: '2026',
      active: false,
      responses: 9,
      avgScore: 4.4,
      questions: [
        { id:1, text:'هل الخطة الاستراتيجية 2026 واضحة ومحددة الأهداف؟', type:'RATING' },
        { id:2, text:'كيف تقيّم مستوى الحوكمة والشفافية في الجمعية؟', type:'RATING' },
        { id:3, text:'هل آليات الرقابة على الأداء فعّالة وكافية؟', type:'RATING' },
        { id:4, text:'كيف تقيّم كفاءة إدارة الموارد المالية والتبرعات؟', type:'RATING' },
        { id:5, text:'هل نظام إدارة الجودة ISO يضيف قيمة حقيقية للجمعية؟', type:'RATING' },
        { id:6, text:'توصياتكم للدورة القادمة؟', type:'TEXT' },
      ],
      results: { avgByQ: [4.6, 4.4, 4.2, 4.3, 4.6, null], topFeedback: ['استمرار التطوير', 'مزيد من الشفافية', 'توسيع الشراكات'] },
    },
    {
      code: 'SRV-2026-006',
      title: 'رضا الشركاء والجهات الحكومية — 2026',
      target: 'PARTNER',
      period: '2026',
      active: true,
      responses: 12,
      avgScore: 4.6,
      questions: [
        { id:1, text:'كيف تقيّم مستوى الالتزام والمهنية في التعامل مع جمعية البر؟', type:'RATING' },
        { id:2, text:'هل الجمعية تحترم اتفاقيات الشراكة والمواعيد المحددة؟', type:'RATING' },
        { id:3, text:'كيف تقيّم جودة التقارير والبيانات المقدمة من الجمعية؟', type:'RATING' },
        { id:4, text:'هل هناك رغبة في تعزيز التعاون مع الجمعية مستقبلاً؟', type:'RATING' },
        { id:5, text:'ملاحظاتكم وتوصياتكم؟', type:'TEXT' },
      ],
      results: { avgByQ: [4.7, 4.6, 4.5, 4.7, null], topFeedback: ['نموذج يُحتذى به', 'تعاون ثمر', 'نتطلع لمزيد من الشراكات'] },
    },
  ];

  let done = 0;
  for (const s of surveys) {
    const { questions, results, ...fields } = s;
    try {
      await prisma.survey.upsert({
        where: { code: s.code },
        update: { responses: s.responses, avgScore: s.avgScore, resultsJson: JSON.stringify(results) },
        create: {
          ...fields,
          questionsJson: JSON.stringify(questions),
          resultsJson: JSON.stringify(results),
        },
      });
      done++;
    } catch (e) {
      console.error('  خطأ استبيان:', e.message.split('\n')[0]);
    }
  }
  console.log(`   ✅ ${done} استبيان بإجمالي ${surveys.reduce((s,r)=>s+r.responses,0)} استجابة`);
}

// ══════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════
console.log('🚀 بدء الإعداد الشامل...\n');
const t0 = Date.now();

await fixDocs();
await insertTraining();
await insertSuppliers();
await insertSurveys();

// ─── ملخص نهائي ──────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════════');
const f = {
  docsPublished: await prisma.document.count({ where: { status: 'PUBLISHED' } }),
  kpi:           await prisma.kpiEntry.count(),
  training:      await prisma.training.count(),
  suppliers:     await prisma.supplier.count(),
  evals:         await prisma.supplierEval.count(),
  surveys:       await prisma.survey.count(),
  beneficiaries: await prisma.beneficiary.count(),
  donations:     await prisma.donation.count(),
};
const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
console.log(`📄 وثائق منشورة:        ${f.docsPublished}/27`);
console.log(`📊 إدخالات KPI:         ${f.kpi}`);
console.log(`🎓 دورات تدريبية:       ${f.training}`);
console.log(`🏪 موردون:              ${f.suppliers}`);
console.log(`⭐ تقييمات موردين:      ${f.evals}`);
console.log(`📝 استبيانات:           ${f.surveys}`);
console.log(`👥 مستفيدون:            ${f.beneficiaries.toLocaleString('ar')}`);
console.log(`💰 تبرعات:              ${f.donations.toLocaleString('ar')}`);
console.log(`⏱️  المدة: ${elapsed} ثانية`);
console.log('══════════════════════════════════════════════════\n');

await prisma.$disconnect();
