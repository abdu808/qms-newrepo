/**
 * kpi-classification-proposal.mjs
 * ─────────────────────────────────────────────────────────────────
 * مقترح تصنيف الـ 82 مؤشر/نشاط لتفعيل محرك المتابعة والتنبيه.
 *
 * أنواع المؤشرات:
 *   CUMULATIVE  — تراكمي (يُجمع عبر الأشهر، يُقارن بالإجمالي السنوي)
 *   PERIODIC    — دوري شهري (هدف مستقل لكل شهر)
 *   SNAPSHOT    — لحظي (قراءة في نقطة زمنية، آخر قيمة = الحالة)
 *   BINARY      — ثنائي (تحقق / لم يتحقق)
 *
 * أنماط الموسمية (seasonality) — توزيع 12 شهر، المجموع = 1:
 *   UNIFORM        — [1/12]×12  (افتراضي)
 *   SCHOOL_START   — [0,0,0,0,0,0,0, .5, .5, 0,0,0]    للحقيبة المدرسية
 *   EID_SEASONAL   — [0, .15, .3, 0, .3, .25, 0,0,0,0,0,0]  كسوة العيد
 *   RAMADAN_RELIEF — [0, .35, .35, 0, 0, .3, 0,0,0,0,0,0]   السلل الموسمية
 *   QUARTERLY      — [0,0,.25, 0,0,.25, 0,0,.25, 0,0,.25]   فصلي
 *   MONTHLY_EVEN   — [1/12]×12 لأشياء شهرية (اجتماعات، تقارير)
 *
 * ملاحظات:
 * - كل مؤشر له: type + targetValue + targetUnit + seasonality + direction
 * - direction: HIGHER_BETTER (الأغلب) | LOWER_BETTER (زمن معالجة)
 * - يتم تطبيق هذا مباشرة على حقول جديدة في Objective و OperationalActivity
 */

// ══════════════════════════════════════════════════════════════════════
// القسم 1 — الأهداف الاستراتيجية (38)
// ══════════════════════════════════════════════════════════════════════
// المفتاح = title الحالي للمؤشر في DB (نطابق بالاسم)
export const OBJECTIVES_CLASSIFICATION = {
  // ── المستفيدون والمجتمع ─────────────────────────────────
  'عدد الأيتام المكفولين':                         { type: 'SNAPSHOT',   unit: 'يتيم',      seasonality: 'UNIFORM' },
  'عدد برامج الرعاية المقدمة للأيتام':             { type: 'CUMULATIVE', unit: 'برنامج',     seasonality: 'UNIFORM' },
  'عدد الأسر المستفيدة من الكفالة النقدية':        { type: 'SNAPSHOT',   unit: 'أسرة',      seasonality: 'UNIFORM' },
  'عدد برامج الرعاية المقدمة':                    { type: 'CUMULATIVE', unit: 'برنامج',     seasonality: 'QUARTERLY' },
  'عدد المستفيدين من مشروع السلة الغذائية':       { type: 'SNAPSHOT',   unit: 'أسرة',      seasonality: 'UNIFORM' },
  'عدد المستفيدين من خدمات تحسين المسكن':        { type: 'CUMULATIVE', unit: 'أسرة',      seasonality: 'UNIFORM' },
  'عدد المستفيدين من المساعدات الموسمية والطارئة':{ type: 'CUMULATIVE', unit: 'مستفيد',    seasonality: 'RAMADAN_RELIEF' },
  'نسبة رضا المستفيدين عن برامج الرعاية':         { type: 'SNAPSHOT',   unit: '%',         seasonality: 'UNIFORM' },
  'عدد المشاريع المحسّنة':                        { type: 'CUMULATIVE', unit: 'مشروع',     seasonality: 'UNIFORM' },
  'نسبة رضا المستفيدين عن الخدمات المحسّنة':     { type: 'SNAPSHOT',   unit: '%',         seasonality: 'UNIFORM' },
  'عدد مستفيدي برامج التدريب والتمكين':          { type: 'CUMULATIVE', unit: 'مستفيد',    seasonality: 'UNIFORM' },
  'عدد مستفيدي المشاريع الممولة':                { type: 'CUMULATIVE', unit: 'مستفيد',    seasonality: 'UNIFORM' },
  'عدد المستفيدين الذين تم توظيفهم':             { type: 'CUMULATIVE', unit: 'موظف',      seasonality: 'UNIFORM' },
  'عدد برامج التمكين التي تم تحسينها':           { type: 'CUMULATIVE', unit: 'برنامج',     seasonality: 'UNIFORM' },

  // ── مالي واستدامي ────────────────────────────────────
  'عدد الاستثمارات الجديدة':                      { type: 'CUMULATIVE', unit: 'استثمار',   seasonality: 'UNIFORM' },
  'نسبة نمو عائد الاستثمارات القائمة':           { type: 'SNAPSHOT',   unit: '%',         seasonality: 'UNIFORM' },
  'نسبة إعادة الاستثمار من إيرادات الجمعية':     { type: 'SNAPSHOT',   unit: '%',         seasonality: 'UNIFORM' },
  'نسبة زيادة إيرادات التبرعات':                 { type: 'SNAPSHOT',   unit: '%',         seasonality: 'UNIFORM' },
  'عدد مصادر الإيرادات':                          { type: 'SNAPSHOT',   unit: 'مصدر',      seasonality: 'UNIFORM' },
  'نسبة كفاءة الإنفاق مقارنة بالميزانية المخططة':{ type: 'SNAPSHOT',   unit: '%',         seasonality: 'UNIFORM' },
  'نسبة الترشيد من إجمالي المصروفات التشغيلية': { type: 'SNAPSHOT',   unit: '%',         seasonality: 'UNIFORM' },

  // ── العمليات الداخلية ───────────────────────────────
  'نسبة تأسيس وتطوير إدارة الاتصال المؤسسي':    { type: 'SNAPSHOT',   unit: '%',         seasonality: 'UNIFORM' },
  'نسبة رضا أصحاب المصلحة':                      { type: 'SNAPSHOT',   unit: '%',         seasonality: 'UNIFORM' },
  'عدد الحملات الإعلامية':                        { type: 'CUMULATIVE', unit: 'حملة',      seasonality: 'QUARTERLY' },
  'عدد الشراكات':                                  { type: 'SNAPSHOT',   unit: 'شراكة',     seasonality: 'UNIFORM' },
  'نسبة العائد من الشراكات':                     { type: 'SNAPSHOT',   unit: '%',         seasonality: 'UNIFORM' },
  'عدد الفرص التطوعية':                          { type: 'CUMULATIVE', unit: 'فرصة',      seasonality: 'UNIFORM' },
  'عدد المتطوعين':                                { type: 'CUMULATIVE', unit: 'متطوع',     seasonality: 'UNIFORM' },
  'العائد المالي من التطوع (ريال)':              { type: 'CUMULATIVE', unit: 'ريال',      seasonality: 'UNIFORM' },

  // ── التعلم والنمو ───────────────────────────────────
  'نسبة التحول التقني في العمليات':              { type: 'SNAPSHOT',   unit: '%',         seasonality: 'UNIFORM' },
  'نسبة التحول التقني في الخدمات والبرامج':      { type: 'SNAPSHOT',   unit: '%',         seasonality: 'UNIFORM' },
  'نسبة جاهزية بيئة العمل':                      { type: 'SNAPSHOT',   unit: '%',         seasonality: 'UNIFORM' },
  'عدد البرامج الاجتماعية للعاملين':             { type: 'CUMULATIVE', unit: 'برنامج',     seasonality: 'UNIFORM' },
  'نسبة درجة الحوكمة':                            { type: 'SNAPSHOT',   unit: '%',         seasonality: 'UNIFORM' },
  'نسبة استكمال السياسات والإجراءات':            { type: 'SNAPSHOT',   unit: '%',         seasonality: 'UNIFORM' },
  'نسبة جاهزية الجمعية لشهادات التميز':          { type: 'SNAPSHOT',   unit: '%',         seasonality: 'UNIFORM' },
  'عدد الحاصلين على الشهادات الاحترافية':        { type: 'CUMULATIVE', unit: 'موظف',      seasonality: 'UNIFORM' },
  'عدد البرامج التطويرية لكل موظف':              { type: 'SNAPSHOT',   unit: 'برنامج',     seasonality: 'UNIFORM' },

  // ── الأهداف اليتيمة (غير مربوطة بـ StrategicGoal) ──
  'رفع رضا المستفيدين':                           { type: 'SNAPSHOT',   unit: '%',         seasonality: 'UNIFORM' },
  'تقليل زمن معالجة الشكاوى':                    { type: 'SNAPSHOT',   unit: 'يوم',       seasonality: 'UNIFORM', direction: 'LOWER_BETTER' },
  'تنويع قاعدة المتبرعين':                        { type: 'CUMULATIVE', unit: 'متبرع',     seasonality: 'UNIFORM' },
};

// ══════════════════════════════════════════════════════════════════════
// القسم 2 — النشاطات التشغيلية 2026 (44)
// ══════════════════════════════════════════════════════════════════════
// المفتاح = code (OPA-2026-XXX)
export const ACTIVITIES_CLASSIFICATION = {
  // ── كفالة ────────────────────────────────────────────
  'OPA-2026-001': { type: 'SNAPSHOT',   targetValue: 870,       unit: 'يتيم',      seasonality: 'UNIFORM' },        // الكفالة النقدية
  'OPA-2026-002': { type: 'CUMULATIVE', targetValue: 500,       unit: 'حقيبة',     seasonality: 'SCHOOL_START' },   // الحقيبة المدرسية
  'OPA-2026-003': { type: 'CUMULATIVE', targetValue: 120,       unit: 'برنامج',     seasonality: 'UNIFORM' },        // البرامج الاجتماعية
  'OPA-2026-004': { type: 'CUMULATIVE', targetValue: 955,       unit: 'يتيم',      seasonality: 'EID_SEASONAL' },   // كسوة العيد
  'OPA-2026-005': { type: 'SNAPSHOT',   targetValue: 50,        unit: 'أسرة',      seasonality: 'UNIFORM' },        // كفالة الأسر

  // ── رعاية اجتماعية ──────────────────────────────────
  'OPA-2026-006': { type: 'PERIODIC',   targetValue: 1500,      unit: 'أسرة/شهر',  seasonality: 'UNIFORM' },        // السلة الغذائية شهرياً
  'OPA-2026-007': { type: 'CUMULATIVE', targetValue: 50,        unit: 'أسرة',      seasonality: 'UNIFORM' },        // سداد الإيجارات
  'OPA-2026-008': { type: 'CUMULATIVE', targetValue: 250,       unit: 'أسرة',      seasonality: 'UNIFORM' },        // تأثيث
  'OPA-2026-009': { type: 'CUMULATIVE', targetValue: 100,       unit: 'مستفيد',    seasonality: 'RAMADAN_RELIEF' }, // موسمية
  'OPA-2026-010': { type: 'CUMULATIVE', targetValue: 100,       unit: 'مستفيد',    seasonality: 'UNIFORM' },        // طارئة
  'OPA-2026-011': { type: 'SNAPSHOT',   targetValue: 100,       unit: '%',         seasonality: 'UNIFORM' },        // نسبة التوصيل

  // ── تمكين ────────────────────────────────────────────
  'OPA-2026-012': { type: 'CUMULATIVE', targetValue: 350,       unit: 'مستفيد',    seasonality: 'UNIFORM' },
  'OPA-2026-013': { type: 'CUMULATIVE', targetValue: 15,        unit: 'مشروع',     seasonality: 'UNIFORM' },
  'OPA-2026-014': { type: 'CUMULATIVE', targetValue: 20,        unit: 'موظف',      seasonality: 'UNIFORM' },

  // ── موارد مالية ─────────────────────────────────────
  'OPA-2026-015': { type: 'CUMULATIVE', targetValue: 500000,    unit: 'ريال',      seasonality: 'UNIFORM' },        // المتجر
  'OPA-2026-016': { type: 'CUMULATIVE', targetValue: 6,         unit: 'حملة',      seasonality: 'QUARTERLY' },
  'OPA-2026-017': { type: 'SNAPSHOT',   targetValue: 70,        unit: '%',         seasonality: 'UNIFORM' },
  'OPA-2026-018': { type: 'SNAPSHOT',   targetValue: 80,        unit: '%',         seasonality: 'UNIFORM' },        // استبقاء ≥80
  'OPA-2026-019': { type: 'SNAPSHOT',   targetValue: 9,         unit: 'مصدر',      seasonality: 'UNIFORM' },
  'OPA-2026-020': { type: 'SNAPSHOT',   targetValue: 100,       unit: '%',         seasonality: 'UNIFORM' },        // خطة استدامة
  'OPA-2026-021': { type: 'SNAPSHOT',   targetValue: 100,       unit: '%',         seasonality: 'UNIFORM' },

  // ── أصول واستثمارات ─────────────────────────────────
  'OPA-2026-022': { type: 'BINARY',     targetValue: 1,         unit: 'استثمار',   seasonality: 'UNIFORM' },        // استثمار جديد واحد
  'OPA-2026-023': { type: 'SNAPSHOT',   targetValue: 10,        unit: '%',         seasonality: 'UNIFORM' },
  'OPA-2026-024': { type: 'SNAPSHOT',   targetValue: 25,        unit: '%',         seasonality: 'UNIFORM' },
  'OPA-2026-025': { type: 'SNAPSHOT',   targetValue: 100,       unit: '%',         seasonality: 'UNIFORM' },

  // ── إدارة مالية ─────────────────────────────────────
  'OPA-2026-026': { type: 'PERIODIC',   targetValue: 100,       unit: '% شهرياً',  seasonality: 'UNIFORM' },        // ZATCA كل شهر
  'OPA-2026-027': { type: 'PERIODIC',   targetValue: 1,         unit: 'اجتماع/شهر',seasonality: 'UNIFORM' },        // اجتماع شهري
  'OPA-2026-028': { type: 'SNAPSHOT',   targetValue: 5,         unit: '%',         seasonality: 'UNIFORM' },

  // ── تميز مؤسسي ──────────────────────────────────────
  'OPA-2026-029': { type: 'SNAPSHOT',   targetValue: 100,       unit: '%',         seasonality: 'UNIFORM' },
  'OPA-2026-030': { type: 'CUMULATIVE', targetValue: 20,        unit: 'ساعة/موظف', seasonality: 'UNIFORM' },
  'OPA-2026-031': { type: 'BINARY',     targetValue: 1,         unit: 'شهادة',     seasonality: 'UNIFORM' },        // ISO
  'OPA-2026-032': { type: 'SNAPSHOT',   targetValue: 90,        unit: '%',         seasonality: 'UNIFORM' },
  'OPA-2026-033': { type: 'SNAPSHOT',   targetValue: 100,       unit: '%',         seasonality: 'UNIFORM' },
  'OPA-2026-034': { type: 'BINARY',     targetValue: 1,         unit: 'تقرير',     seasonality: 'UNIFORM' },
  'OPA-2026-035': { type: 'SNAPSHOT',   targetValue: 100,       unit: '%',         seasonality: 'UNIFORM' },

  // ── صورة ذهنية ──────────────────────────────────────
  'OPA-2026-036': { type: 'CUMULATIVE', targetValue: 4,         unit: 'فعالية',    seasonality: 'QUARTERLY' },
  'OPA-2026-037': { type: 'PERIODIC',   targetValue: 1,         unit: 'نشر/شهر',   seasonality: 'UNIFORM' },        // 12 شهراً نشاط شهري
  'OPA-2026-038': { type: 'PERIODIC',   targetValue: 1,         unit: 'تقرير/شهر', seasonality: 'UNIFORM' },        // 12 تقرير
  'OPA-2026-039': { type: 'CUMULATIVE', targetValue: 4,         unit: 'مبادرة',    seasonality: 'QUARTERLY' },

  // ── شراكات ──────────────────────────────────────────
  'OPA-2026-040': { type: 'CUMULATIVE', targetValue: 15,        unit: 'اتفاقية',   seasonality: 'UNIFORM' },
  'OPA-2026-041': { type: 'CUMULATIVE', targetValue: 4,         unit: 'شراكة',     seasonality: 'UNIFORM' },

  // ── تطوع ────────────────────────────────────────────
  'OPA-2026-042': { type: 'CUMULATIVE', targetValue: 4,         unit: 'فرصة',      seasonality: 'UNIFORM' },
  'OPA-2026-043': { type: 'CUMULATIVE', targetValue: 4,         unit: 'فرصة',      seasonality: 'UNIFORM' },
  'OPA-2026-044': { type: 'CUMULATIVE', targetValue: 4,         unit: 'فرصة',      seasonality: 'UNIFORM' },
};

// ══════════════════════════════════════════════════════════════════════
// ملخص
// ══════════════════════════════════════════════════════════════════════
if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}` || process.argv[1]?.endsWith('kpi-classification-proposal.mjs')) {
  const oCount = Object.values(OBJECTIVES_CLASSIFICATION).reduce((a, x) => { a[x.type] = (a[x.type]||0)+1; return a; }, {});
  const aCount = Object.values(ACTIVITIES_CLASSIFICATION).reduce((a, x) => { a[x.type] = (a[x.type]||0)+1; return a; }, {});
  console.log('═══ ملخص التصنيف المقترح ═══\n');
  console.log('🎯 الأهداف الاستراتيجية (' + Object.keys(OBJECTIVES_CLASSIFICATION).length + '):');
  Object.entries(oCount).forEach(([k,v]) => console.log('   ' + k.padEnd(12) + ': ' + v));
  console.log('\n⚙️  النشاطات التشغيلية (' + Object.keys(ACTIVITIES_CLASSIFICATION).length + '):');
  Object.entries(aCount).forEach(([k,v]) => console.log('   ' + k.padEnd(12) + ': ' + v));

  // موسميات غير افتراضية
  const seas = [...Object.values(OBJECTIVES_CLASSIFICATION), ...Object.values(ACTIVITIES_CLASSIFICATION)]
    .filter(x => x.seasonality && x.seasonality !== 'UNIFORM')
    .reduce((a,x)=>{ a[x.seasonality]=(a[x.seasonality]||0)+1; return a; }, {});
  console.log('\n📅 الأنماط الموسمية:');
  Object.entries(seas).forEach(([k,v]) => console.log('   ' + k.padEnd(16) + ': ' + v + ' مؤشر'));
}
