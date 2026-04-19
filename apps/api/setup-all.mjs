/**
 * setup-all.mjs — إعداد شامل للنظام
 * 1. اعتماد ونشر الوثائق
 * 2. إدخال KPI لـ Q1 2026
 * 3. دورة تدريبية تجريبية
 * 4. 7 موردين + تقييماتهم
 * 5. استبيانات رضا متعددة + إجابات عشوائية
 */
import { prisma } from './src/db.js';

const ADMIN_ID = 'cmo3gljix0008hwj1e1ruapl1';
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = arr => arr[rand(0, arr.length - 1)];

// ══════════════════════════════════════════════════════════════
// 1. اعتماد ونشر الوثائق الـ 27
// ══════════════════════════════════════════════════════════════
async function approveAndPublishDocs() {
  console.log('\n📄 1. اعتماد ونشر الوثائق...');
  const docs = await prisma.document.findMany({ where: { status: 'DRAFT' } });
  let done = 0;
  for (const doc of docs) {
    await prisma.document.update({
      where: { id: doc.id },
      data: {
        status: 'PUBLISHED',
        approvedById: ADMIN_ID,
        approvedAt: new Date('2026-03-01'),
        effectiveDate: new Date('2026-03-15'),
        reviewDate: new Date('2027-03-15'),
      },
    });
    done++;
  }
  console.log(`   ✅ تم نشر ${done} وثيقة`);
}

// ══════════════════════════════════════════════════════════════
// 2. إدخال KPI لـ Q1 2026 (يناير - مارس)
// ══════════════════════════════════════════════════════════════
async function insertKpiData() {
  console.log('\n📊 2. إدخال بيانات KPI لـ Q1 2026...');
  const objectives = await prisma.objective.findMany({ take: 41 });
  const activities = await prisma.operationalActivity.findMany({ where: { year: 2026 } });

  let done = 0;

  // مؤشرات استراتيجية — 3 أشهر
  for (const obj of objectives) {
    const target = obj.target || 100;
    for (const month of [1, 2, 3]) {
      const ratio = 0.7 + Math.random() * 0.35; // 70-105% achievement
      const expected = target / 12;
      const actual = +(expected * ratio).toFixed(1);
      try {
        await prisma.kpiEntry.upsert({
          where: { objectiveId_year_month: { objectiveId: obj.id, year: 2026, month } },
          update: { actualValue: actual, enteredById: ADMIN_ID },
          create: {
            objectiveId: obj.id, year: 2026, month,
            actualValue: actual,
            note: pick(['تم التنفيذ وفق الخطة', 'تجاوز المستهدف', 'أقل من المتوقع بسبب الإجازات', 'في المسار الصحيح']),
            enteredById: ADMIN_ID,
          },
        });
        done++;
      } catch {}
    }
  }

  // أنشطة تشغيلية — 3 أشهر
  for (const act of activities.slice(0, 44)) {
    const target = act.targetValue || 100;
    const budget = act.budget || 50000;
    for (const month of [1, 2, 3]) {
      const ratio = 0.65 + Math.random() * 0.4;
      const expected = target / 12;
      const actual = +(expected * ratio).toFixed(1);
      const spent = +(budget / 12 * (0.6 + Math.random() * 0.5)).toFixed(0);
      try {
        await prisma.kpiEntry.upsert({
          where: { activityId_year_month: { activityId: act.id, year: 2026, month } },
          update: { actualValue: actual, spent, enteredById: ADMIN_ID },
          create: {
            activityId: act.id, year: 2026, month,
            actualValue: actual, spent,
            note: pick(['منجز', 'جاري التنفيذ', 'في المسار الصحيح', 'تأخر بسيط']),
            enteredById: ADMIN_ID,
          },
        });
        done++;
      } catch {}
    }
  }

  console.log(`   ✅ تم إدخال ${done} قيمة KPI`);
}

// ══════════════════════════════════════════════════════════════
// 3. دورة تدريبية تجريبية
// ══════════════════════════════════════════════════════════════
async function insertTraining() {
  console.log('\n🎓 3. إدخال الدورات التدريبية...');

  const dept = await prisma.department.findFirst();

  const trainingData = [
    {
      code: 'TRN-2026-001',
      title: 'تدريب على متطلبات ISO 9001:2015',
      type: 'INTERNAL',
      provider: 'مدير الجودة — جمعية البر بصبيا',
      startDate: new Date('2026-02-10'),
      endDate: new Date('2026-02-11'),
      durationHours: 8,
      venue: 'قاعة الاجتماعات الرئيسية',
      targetAudience: 'جميع الموظفين',
      objective: 'رفع الوعي بمتطلبات نظام إدارة الجودة ISO 9001:2015',
      departmentId: dept?.id,
      status: 'COMPLETED',
      budget: 2000,
      actualCost: 1500,
    },
    {
      code: 'TRN-2026-002',
      title: 'ورشة إدارة الشكاوى ورضا المستفيدين',
      type: 'INTERNAL',
      provider: 'مدير البرامج الاجتماعية',
      startDate: new Date('2026-02-24'),
      endDate: new Date('2026-02-24'),
      durationHours: 4,
      venue: 'قاعة التدريب',
      targetAudience: 'موظفو الخدمات الاجتماعية',
      objective: 'تطوير مهارات التعامل مع المستفيدين ومعالجة الشكاوى',
      departmentId: dept?.id,
      status: 'COMPLETED',
      budget: 500,
      actualCost: 450,
    },
    {
      code: 'TRN-2026-003',
      title: 'دورة السلامة والصحة المهنية',
      type: 'EXTERNAL',
      provider: 'الهيئة السعودية للسلامة والصحة المهنية',
      startDate: new Date('2026-03-05'),
      endDate: new Date('2026-03-06'),
      durationHours: 12,
      venue: 'مركز التدريب — جازان',
      targetAudience: 'الموظفون الميدانيون',
      objective: 'تطبيق معايير السلامة في بيئة العمل',
      departmentId: dept?.id,
      status: 'COMPLETED',
      budget: 3500,
      actualCost: 3500,
    },
    {
      code: 'TRN-2026-004',
      title: 'تدريب على نظام إدارة الجودة الإلكتروني',
      type: 'INTERNAL',
      provider: 'مدير تقنية المعلومات',
      startDate: new Date('2026-03-15'),
      endDate: new Date('2026-03-15'),
      durationHours: 3,
      venue: 'قاعة الحاسب',
      targetAudience: 'جميع الموظفين',
      objective: 'التدريب على استخدام نظام QMS الإلكتروني',
      departmentId: dept?.id,
      status: 'COMPLETED',
      budget: 0,
      actualCost: 0,
    },
  ];

  let done = 0;
  for (const t of trainingData) {
    try {
      await prisma.training.create({ data: t });
      done++;
    } catch (e) {
      if (!e.message.includes('Unique')) console.error('Training error:', e.message.split('\n')[0]);
    }
  }
  console.log(`   ✅ تم إدخال ${done} دورة تدريبية`);
}

// ══════════════════════════════════════════════════════════════
// 4. إضافة 7 موردين + تقييماتهم
// ══════════════════════════════════════════════════════════════
async function insertSuppliers() {
  console.log('\n🏪 4. إضافة الموردين وتقييماتهم...');

  const suppliers = [
    {
      code: 'SUP-2026-001', name: 'شركة الأمل لتوزيع المواد الغذائية',
      category: 'GOODS', contactName: 'أحمد محمد الزهراني',
      phone: '0172220001', city: 'صبيا', country: 'SA',
      taxNumber: '3001234567', status: 'APPROVED',
      notes: 'مورد رئيسي لسلال الغذاء الشهرية — موثوق وملتزم',
    },
    {
      code: 'SUP-2026-002', name: 'مؤسسة الخير للملابس والأقمشة',
      category: 'GOODS', contactName: 'خالد إبراهيم القحطاني',
      phone: '0172220002', city: 'أبو عريش', country: 'SA',
      status: 'APPROVED',
      notes: 'مورد ملابس الأيتام وكسوة العيد',
    },
    {
      code: 'SUP-2026-003', name: 'شركة البناء والتشييد المتحدة',
      category: 'SERVICES', contactName: 'سلطان ناصر العمري',
      phone: '0172220003', city: 'جازان', country: 'SA',
      taxNumber: '3007654321', status: 'APPROVED',
      notes: 'مقاول ترميم المساكن ضمن برنامج الإسكان',
    },
    {
      code: 'SUP-2026-004', name: 'مركز الرعاية الطبية الأهلي',
      category: 'SERVICES', contactName: 'د. محمد عبدالله الشهري',
      phone: '0172220004', city: 'صبيا', country: 'SA',
      status: 'APPROVED',
      notes: 'تقديم الخدمات الطبية للمستفيدين بأسعار مخفضة',
    },
    {
      code: 'SUP-2026-005', name: 'مكتب الرواد للطباعة والتصميم',
      category: 'SERVICES', contactName: 'فيصل علي الجعفري',
      phone: '0172220005', city: 'صبيا', country: 'SA',
      status: 'APPROVED',
      notes: 'طباعة الوثائق والنماذج الرسمية',
    },
    {
      code: 'SUP-2026-006', name: 'شركة تقنية الجنوب لأنظمة المعلومات',
      category: 'SERVICES', contactName: 'عبدالرحمن سعد الغامدي',
      phone: '0172220006', city: 'جازان', country: 'SA',
      taxNumber: '3009876543', status: 'APPROVED',
      notes: 'صيانة وتطوير أنظمة المعلومات',
    },
    {
      code: 'SUP-2026-007', name: 'مصنع الحلول الزراعية للتمور والمنتجات',
      category: 'GOODS', contactName: 'حمود عبدالله الحازمي',
      phone: '0172220007', city: 'صامطة', country: 'SA',
      status: 'APPROVED',
      notes: 'تبرعات عينية من تمور وحبوب ومنتجات زراعية',
    },
  ];

  const CRITERIA = ['الجودة', 'الالتزام بالمواعيد', 'السعر', 'خدمة ما بعد التسليم', 'الوثائق والفواتير'];

  let supDone = 0, evalDone = 0;
  for (const sup of suppliers) {
    try {
      const created = await prisma.supplier.upsert({
        where: { code: sup.code },
        update: {},
        create: sup,
      });

      // إضافة تقييمين لكل مورد (Q4-2025 و Q1-2026)
      for (const period of ['Q4-2025', 'Q1-2026']) {
        const scores = {};
        CRITERIA.forEach(c => { scores[c] = rand(3, 5); });
        const totalScore = +(Object.values(scores).reduce((a, b) => a + b, 0) / CRITERIA.length).toFixed(2);
        const decision = totalScore >= 4 ? 'مورد مفضّل' : totalScore >= 3 ? 'مورد مقبول' : 'يحتاج مراجعة';

        try {
          await prisma.supplierEval.create({
            data: {
              code: `SEVAL-${period}-${sup.code.split('-')[2]}`,
              supplierId: created.id,
              evaluatorId: ADMIN_ID,
              period,
              scores,
              totalScore,
              decision,
              notes: pick([
                'أداء ممتاز ويلتزم بالمواصفات',
                'ملتزم بالمواعيد والجودة المطلوبة',
                'يحتاج تحسين في سرعة الاستجابة',
                'جودة عالية مع أسعار تنافسية',
              ]),
            },
          });
          evalDone++;
        } catch {}
      }
      supDone++;
    } catch (e) {
      console.error('Supplier error:', e.message.split('\n')[0]);
    }
  }
  console.log(`   ✅ تم إضافة ${supDone} مورد + ${evalDone} تقييم`);
}

// ══════════════════════════════════════════════════════════════
// 5. استبيانات رضا متعددة + إجابات عشوائية
// ══════════════════════════════════════════════════════════════
async function insertSurveys() {
  console.log('\n📝 5. إنشاء الاستبيانات وملء الإجابات...');

  const surveysData = [
    {
      code: 'SRV-2026-001',
      title: 'استبيان رضا المستفيدين عن خدمات الجمعية — Q1 2026',
      description: 'قياس مستوى رضا المستفيدين عن جودة وسرعة تقديم الخدمات الاجتماعية',
      targetAudience: 'المستفيدون من برامج الجمعية',
      status: 'CLOSED',
      startDate: new Date('2026-03-01'),
      endDate: new Date('2026-03-31'),
      questions: [
        { text: 'كيف تقيّم جودة الخدمات التي تقدمها الجمعية؟', type: 'RATING', required: true },
        { text: 'هل تلقيت الخدمة في الوقت المناسب؟', type: 'RATING', required: true },
        { text: 'كيف تصف تعامل الموظفين معك؟', type: 'RATING', required: true },
        { text: 'هل المساعدة المقدمة تلبي احتياجاتك الفعلية؟', type: 'RATING', required: true },
        { text: 'ما مدى رضاك العام عن الجمعية؟', type: 'RATING', required: true },
        { text: 'هل لديك اقتراحات لتحسين الخدمات؟', type: 'TEXT', required: false },
      ],
      responses: 120,
      avgRating: 4.3,
    },
    {
      code: 'SRV-2026-002',
      title: 'استبيان رضا المتطوعين — الربع الأول 2026',
      description: 'تقييم بيئة العمل التطوعي ومستوى الدعم المقدم للمتطوعين',
      targetAudience: 'المتطوعون المسجلون في الجمعية',
      status: 'CLOSED',
      startDate: new Date('2026-03-15'),
      endDate: new Date('2026-03-31'),
      questions: [
        { text: 'هل تتلقى التوجيه الكافي قبل ممارسة النشاط التطوعي؟', type: 'RATING', required: true },
        { text: 'كيف تقيّم تنظيم الأنشطة والفعاليات؟', type: 'RATING', required: true },
        { text: 'هل تشعر بأن عملك التطوعي يُحدث فرقاً؟', type: 'RATING', required: true },
        { text: 'هل أنت راضٍ عن تواصل إدارة الجمعية مع المتطوعين؟', type: 'RATING', required: true },
        { text: 'مقترحاتك لتطوير برامج التطوع؟', type: 'TEXT', required: false },
      ],
      responses: 45,
      avgRating: 4.1,
    },
    {
      code: 'SRV-2026-003',
      title: 'استبيان رضا المتبرعين وأصحاب الكفالات — 2026',
      description: 'قياس ثقة المتبرعين في آليات صرف التبرعات وشفافية الجمعية',
      targetAudience: 'المتبرعون وأصحاب الكفالات',
      status: 'ACTIVE',
      startDate: new Date('2026-04-01'),
      endDate: new Date('2026-04-30'),
      questions: [
        { text: 'هل أنت راضٍ عن شفافية صرف تبرعاتك؟', type: 'RATING', required: true },
        { text: 'هل تصلك تقارير دورية عن استخدام تبرعاتك؟', type: 'RATING', required: true },
        { text: 'كيف تقيّم سرعة الاستجابة عند تواصلك مع الجمعية؟', type: 'RATING', required: true },
        { text: 'هل تثق في أن تبرعاتك تصل للمستحقين؟', type: 'RATING', required: true },
        { text: 'ما احتمالية أن توصي بالتبرع لهذه الجمعية؟', type: 'RATING', required: true },
        { text: 'ملاحظاتك واقتراحاتك؟', type: 'TEXT', required: false },
      ],
      responses: 67,
      avgRating: 4.5,
    },
    {
      code: 'SRV-2026-004',
      title: 'استبيان رضا الموظفين عن بيئة العمل — 2026',
      description: 'قياس رضا العاملين عن بيئة العمل والتطوير المهني والقيادة',
      targetAudience: 'موظفو الجمعية',
      status: 'CLOSED',
      startDate: new Date('2026-02-01'),
      endDate: new Date('2026-02-28'),
      questions: [
        { text: 'هل تشعر بالرضا عن بيئة عملك؟', type: 'RATING', required: true },
        { text: 'هل توفر الجمعية فرصاً للتطوير المهني؟', type: 'RATING', required: true },
        { text: 'كيف تقيّم التواصل مع الإدارة؟', type: 'RATING', required: true },
        { text: 'هل الصلاحيات والمسؤوليات واضحة؟', type: 'RATING', required: true },
        { text: 'ما مقترحاتك لتحسين بيئة العمل؟', type: 'TEXT', required: false },
      ],
      responses: 18,
      avgRating: 3.9,
    },
    {
      code: 'SRV-2026-005',
      title: 'استبيان تقييم مجلس الإدارة لأداء الجمعية — 2026',
      description: 'تقييم مجلس الإدارة لمستوى تحقيق الأهداف الاستراتيجية والحوكمة',
      targetAudience: 'أعضاء مجلس الإدارة واللجان',
      status: 'CLOSED',
      startDate: new Date('2026-03-20'),
      endDate: new Date('2026-03-31'),
      questions: [
        { text: 'هل الخطة الاستراتيجية واضحة ومحددة الأهداف؟', type: 'RATING', required: true },
        { text: 'كيف تقيّم مستوى الحوكمة والشفافية؟', type: 'RATING', required: true },
        { text: 'هل آليات الرقابة على الأداء فعّالة؟', type: 'RATING', required: true },
        { text: 'كيف تقيّم كفاءة إدارة الموارد المالية؟', type: 'RATING', required: true },
        { text: 'هل نظام إدارة الجودة يضيف قيمة حقيقية؟', type: 'RATING', required: true },
        { text: 'توصياتك للدورة القادمة؟', type: 'TEXT', required: false },
      ],
      responses: 9,
      avgRating: 4.4,
    },
    {
      code: 'SRV-2026-006',
      title: 'استبيان رضا الشركاء والجهات الحكومية — 2026',
      description: 'تقييم الشراكات مع الجهات الحكومية والمنظمات المجتمعية',
      targetAudience: 'الجهات الحكومية والشركاء الاستراتيجيون',
      status: 'ACTIVE',
      startDate: new Date('2026-04-01'),
      endDate: new Date('2026-04-30'),
      questions: [
        { text: 'كيف تقيّم مستوى الالتزام والمهنية في التعامل مع جمعية البر؟', type: 'RATING', required: true },
        { text: 'هل الجمعية تحترم اتفاقيات الشراكة والمواعيد؟', type: 'RATING', required: true },
        { text: 'كيف تقيّم جودة التقارير والبيانات المقدمة؟', type: 'RATING', required: true },
        { text: 'هل هناك رغبة في تعزيز التعاون مستقبلاً؟', type: 'RATING', required: true },
        { text: 'ملاحظات وتوصيات؟', type: 'TEXT', required: false },
      ],
      responses: 12,
      avgRating: 4.6,
    },
  ];

  const textResponses = [
    'خدمة ممتازة وموظفون محترفون شكراً لكم',
    'يرجى تسريع إجراءات الصرف',
    'الجمعية تقوم بدور محوري في المجتمع',
    'أتمنى توسيع نطاق المستفيدين',
    'رائع جداً، استمروا في العطاء',
    'تحسين التواصل والإشعارات',
    'بارك الله فيكم وزادكم توفيقاً',
    'يحتاج تحديث نظام التسجيل',
    'ممتاز من كل النواحي',
    'نريد مزيداً من البرامج التوعوية',
  ];

  let surveyDone = 0;
  for (const s of surveysData) {
    const { questions, responses, avgRating, ...surveyFields } = s;
    try {
      const created = await prisma.survey.upsert({
        where: { code: s.code },
        update: {},
        create: {
          ...surveyFields,
          createdById: ADMIN_ID,
          questions: { create: questions.map((q, i) => ({ ...q, order: i + 1 })) },
        },
        include: { questions: true },
      });

      // إضافة إجابات عشوائية
      const qList = created.questions.filter(q => q.type === 'RATING');
      const textQ = created.questions.find(q => q.type === 'TEXT');

      for (let r = 0; r < responses; r++) {
        try {
          const resp = await prisma.surveyResponse.create({
            data: {
              surveyId: created.id,
              respondentType: s.targetAudience.includes('مستفيد') ? 'BENEFICIARY'
                : s.targetAudience.includes('متطوع') ? 'VOLUNTEER'
                : s.targetAudience.includes('متبرع') ? 'DONOR'
                : 'OTHER',
              submittedAt: new Date(2026, 2, rand(1, 31)),
            },
          });

          // إجابات على الأسئلة
          for (const q of qList) {
            const ratingVal = rand(3, 5);
            await prisma.surveyAnswer.create({
              data: {
                responseId: resp.id,
                questionId: q.id,
                ratingValue: ratingVal,
              },
            });
          }
          if (textQ && r % 4 === 0) {
            await prisma.surveyAnswer.create({
              data: {
                responseId: resp.id,
                questionId: textQ.id,
                textValue: pick(textResponses),
              },
            });
          }
        } catch {}
      }
      surveyDone++;
      process.stdout.write(`\r   إنشاء الاستبيانات: ${surveyDone}/${surveysData.length}`);
    } catch (e) {
      console.error('\n   Survey error:', e.message.split('\n')[0]);
    }
  }
  console.log(`\n   ✅ تم إنشاء ${surveyDone} استبيان`);
}

// ══════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════
const t0 = Date.now();
await approveAndPublishDocs();
await insertKpiData();
await insertTraining();
await insertSuppliers();
await insertSurveys();

const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
console.log(`\n🏁 اكتمل الإعداد خلال ${elapsed} ثانية`);
console.log('══════════════════════════════════════════════════');

// ملخص نهائي
const final = {
  docs: await prisma.document.count({ where: { status: 'PUBLISHED' } }),
  kpi: await prisma.kpiEntry.count(),
  training: await prisma.training.count(),
  suppliers: await prisma.supplier.count(),
  evals: await prisma.supplierEval.count(),
  surveys: await prisma.survey.count(),
};
console.log(`📄 وثائق منشورة:   ${final.docs}/27`);
console.log(`📊 إدخالات KPI:    ${final.kpi}`);
console.log(`🎓 دورات تدريبية:  ${final.training}`);
console.log(`🏪 موردون:         ${final.suppliers}`);
console.log(`⭐ تقييمات موردين: ${final.evals}`);
console.log(`📝 استبيانات:      ${final.surveys}`);
console.log('══════════════════════════════════════════════════\n');

await prisma.$disconnect();
