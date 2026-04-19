# سجل ملاحظات المستشار — خطة النضج الموحّدة

> المرجع الأوحد لكل ملاحظات المراجعة الاستشارية على نظام QMS.
> يتبع هذا الملف **خطة النضج السبعية** المعتمدة من المستشار.

التحديث الأخير: 2026-04-19

---

## 🎯 الخلاصة التنفيذية

| المرحلة | الاسم | التقدم | الأولوية |
|:---:|---------|:---:|:---:|
| 1 | السلامة والموثوقية | ~75% | 🔴 تبقّى 1.1 (اختبارات تكامل) + 1.3 (قيود DB) |
| 2 | الاتساق الداخلي | ~95% | 🟢 شبه مُنجزة |
| 3 | الواجهة والإرشاد | ~95% | 🟢 شبه مُنجزة |
| 4 | نضج الأعمال | ~50% | 🟡 يحتاج قرارات بنيوية |
| 5 | الرقابة التشغيلية | ~70% | 🟡 ثانوي |
| 6 | التبنّي المؤسسي | ~5% | 🔵 عمل مؤسسي (خارج الكود) |
| 7 | الاستدامة | ~25% | 🔵 مؤجّل |

**الوضع حالياً:** المرحلتان 2 و 3 شبه مُنجزتين. المرحلة 1 تبقّى فيها عملان بنيويان يتطلّبان قرار معماري (اختبارات تكامل + مراجعة schema). المراحل 4–7 إما تحتاج قرارات أعمال، أو هي عمل تنظيمي غير برمجي.

---

## المرحلة 1 — السلامة والموثوقية

> النظام لا ينكسر بسهولة. الصلاحيات منضبطة. البيانات موثوقة.

### ✅ المنجز
- [x] RBAC أساسي عبر `permissions.js` و `requireAction()`
- [x] حماية PII في endpoints العامة (publicAck/publicEval)
- [x] كاشفات dataHealth (8+ مؤشر)
- [x] Audit log على المسارات الحساسة
- [x] Rate limiter عام على `/api`

### ⬜ المتبقي (Blockers قبل الإطلاق)

#### 1.1 اختبارات تكامل للمسارات الحرجة 🔴
- [x] **بنية تحتية جاهزة** (testcontainers + Supertest) — 2026-04-19
  - `tests/integration/setup.js` — Postgres مؤقت + `prisma db push` تلقائي
  - `tests/integration/helpers/auth.js` + `helpers/factories.js`
  - `vitest.integration.config.js` منفصل + script `npm run test:integration`
  - refactor `src/server.js` لتصدير `app` دون `listen` في test mode
  - `tests/integration/README.md` يوثّق البنية والقرار (testcontainers لا SQLite lane)
  - **يتطلّب**: `npm install --save-dev @testcontainers/postgresql testcontainers` + Docker
- [x] **8 ملفات integration test scaffolded** (2026-04-19) — testcontainers مثبّت
  - `auth.integration.test.js` (login success/fail/inactive)
  - `publicAck.integration.test.js` (توكن مزيّف، رفض التوقيع)
  - `publicEval.integration.test.js` (توكن مجهول، منع التقديم)
  - `surveys.integration.test.js` (يتطلّب المصادقة، القراءة لمدير الجودة)
  - `documents.integration.test.js` (القائمة، رفض اعتماد DRAFT)
  - `kpi.integration.test.js` (المصادقة، رفض الإدخال بدون objectiveId)
  - `complaints.integration.test.js` (القائمة، رفض إغلاق بلا توقيع)
  - `ncr.integration.test.js` (القائمة، رفض إغلاق بلا فعالية)
  - ⬜ **للتوسّع**: happy paths، state transitions، ربط شكوى→NCR، الدورة الكاملة

#### 1.2 أمان المصادقة 🔴
- [x] Rate-limiter منفصل وصارم لـ `/auth/login` (2026-04-19)
  - حد مزدوج: 10 محاولات فاشلة/15د لكل (IP+email) + 30 محاولة/15د لكل IP
  - تسجيل `LOGIN_FAILED` في AuditLog
  - limiter منفصل لـ `/auth/refresh` (60/15د لكل IP)
- [x] Signature bypass audit (2026-04-19)
  - ✅ تحقق من entropy التوكنات — UUID v4 (122-bit) كافٍ ضد التخمين
  - ✅ Rate-limiter عام على `/eval`, `/survey`, `/ack` (60 GET/15د، 10 POST/ساعة)
  - ✅ حد جسم الطلب 100KB للمسارات العامة (كان 5MB)
  - ✅ Security headers: X-Frame-Options=DENY + X-Content-Type-Options + Referrer-Policy
  - ✅ حدود طول للحقول الحرة (name/org/notes/phone)
  - ⚠️ **دين تقني متبقي**: `/survey/:id` بلا توكن — يُوصى بنقل resultsJson لجدول SurveyResponse منفصل + توكن دعوة
- [x] Read-access audit trail (2026-04-19)
  - middleware `readAudit(entityType)` في `middleware/audit.js`
  - مُطبَّق على: Beneficiary (PII)، Complaint (PII)، NCR
  - يُسجَّل فقط قراءات السجلات الفردية (ليس القوائم) لتجنّب الضوضاء

#### 1.3 سلامة قاعدة البيانات 🔴
- [x] **مراجعة Schema كاملة** — `docs/schema-audit.md` (2026-04-19)
  - تحليل كل قيود UNIQUE / NOT NULL / soft-delete
  - تحليل race conditions (KpiEntry + EvalToken محميّان؛ Document/NCR/Complaint يحتاجان optimistic locking)
- [x] **3 migrations مُطبَّقة** (2026-04-19) — ملفات SQL في `prisma/migrations-manual/`
  - ✅ `001` — `beneficiary_nationalId_active_unique` (partial unique يحترم soft-delete)
  - ✅ `002` — `supplier_crNumber_active_unique` + `supplier_vatNumber_active_unique`
  - ✅ `003` — أعمدة `version Int @default(0)` على Document/NCR/Complaint (عبر `prisma db push`)
  - تحقق قبل التطبيق: 0 تكرارات في الحقول الثلاثة
- [x] **تعديل services للاعتماد على optimistic locking** (2026-04-19)
  - `utils/optimisticLock.js` — `withVersionGuard` helper (يُلقي Conflict 409 عند P2025)
  - `utils/crudFactory.js` — يستهلك `__expectedVersion` من beforeUpdate
  - `services/documentApproval.js` — `approveDocument`/`obsoleteDocument`/`guardDocumentUpdate` محميّة
  - `services/ncrClosure.js::guardNcrUpdate` — يضبط `__expectedVersion` عند انتقال الحالة
  - `services/complaintLifecycle.js::guardComplaintUpdate` — نفس النمط
- [x] soft-delete موحّد عبر 24 موديل (`deletedAt` + `@@index`) — موثّق في schema-audit §4
- [x] `prisma generate` في postinstall لجميع البيئات (2026-04-19)
  - نقل `prisma` CLI من devDependencies إلى dependencies
  - إضافة `"postinstall": "prisma generate"` في scripts
  - تبسيط Dockerfile — لا حاجة لـ `npx prisma generate` يدوياً
  - يعمل تلقائياً في: التطوير المحلي، Docker، Coolify Nixpacks، CI

#### 1.4 النسخ الاحتياطي 🔴
- [x] Cron آلي لنسخ Postgres + الملفات المرفوعة (2026-04-19)
  - `services/backup.js` — `pg_dump` → gzip، `tar -czf` لـ uploads
  - مجدول عبر `scheduler.js` يومياً بعد 2ص مع حارس `lastBackupDate`
  - ENV: `QMS_BACKUP=on` + `BACKUP_DIR` (افتراضي `./backups`)
  - تشغيل يدوي: `npm run backup`
- [x] اختبار استرجاع موثّق (documented restore drill) — 2026-04-19
  - `docs/backup-restore.md` — إجراء تفصيلي، جدول توثيق التمارين، بيئة Docker معزولة
- [x] تدوير النسخ (7 يومية / 4 أسبوعية / 6 شهرية) — مُضمَّن في `rotateBackups()`

---

## المرحلة 2 — الاتساق الداخلي

> سلوك النظام موحّد. تقليل التفاوت. سهولة الصيانة.

### ✅ المنجز
- [x] `crudFactory` موحّد لمعظم الـ resources
- [x] `smartFilters` موحّدة عبر crudFactory
- [x] نظام صلاحيات مركزي (`permissions.js`)

### ⬜ المتبقي

#### 2.1 طبقة تحقق موحّدة 🔴
- [x] تبنّي **Zod** كطبقة تحقق رسمية (2026-04-19)
  - `schemas/_helpers.js` — `runSchema()` + `trimmedString`/`optionalDate`/`coercedBoolean`/...
  - 5 resources: user, document, complaint, ncr, kpiEntry
  - لكل resource: `createSchema` + `updateSchema` + `querySchema`
  - دمج شفاف في `crudFactory` عبر خيار `schemas: { create, update }`
  - تطبيق على: `/users`, `/documents`, `/complaints`, `/ncr`, `/kpi/entries`
  - رسائل خطأ عربية موحّدة (`field: message`)
- [ ] مشاركة Schema بين frontend و backend (مجلد `packages/schemas`) — مؤجّل
- [x] توسيع للـ resources المتبقية (objectives, risks, suppliers, beneficiaries, audits) — 2026-04-19
  - 5 ملفات schema إضافية (`objective` / `risk` / `supplier` / `beneficiary` / `audit`)
  - enums من Prisma (ObjectiveStatus, RiskStatus, SupplierType/Status, BeneficiaryCategory/Status, AuditType/Status)
  - **الإجمالي الآن: 10 schemas** تغطي كل الـ resources التشغيلية الرئيسية
- [x] إزالة `requireFields` / `intInRange` من الـ routes المغطّاة بـ Zod (2026-04-19)
  - `complaints.js` — إزالة `intInRange(satisfaction)` (Zod updateSchema يتحقق منه)
  - `kpi.js` — إزالة استيراد `intInRange` غير المُستعمل
  - المتبقي: `training.js` و `signatures.js` (غير مغطَّين بـ Zod بعد) — سيُحوَّلان لاحقاً بعد كتابة schemas

#### 2.2 Service Layer لمنطق الأعمال 🔴
- [x] `services/kpi.js` — قراءات الأداء في مكان واحد (2026-04-19)
  - `upsertKpiEntry` + `isPeriodLocked` + `computeKpiFeedback`
  - `routes/kpi.js::POST /entries` أصبح استدعاء service بسطرين
- [x] `services/supplierEval.js` — منطق تقييم الموردين (2026-04-19)
  - `buildSupplierEvalPayload()` + `prepareSupplierEval()` — استخراج كامل منطق `beforeCreate`
  - `routes/supplierEvals.js` تقلّص من 60 سطر إلى 5 (استدعاء واحد)
  - 7 unit tests جديدة لتحقّق (legacy mode، recommendation injection، critical fail)
- [x] `services/ncrClosure.js` — قواعد إغلاق NCR (2026-04-19)
  - `normalizeNcr` + `guardClosure` + `guardNcrCreate` + `guardNcrUpdate`
  - `routes/ncr.js` تقلّص بنصف السطور
- [x] `services/documentApproval.js` — اعتماد ونشر الوثائق (2026-04-19)
  - `approveDocument` + `obsoleteDocument` + `acknowledgeDocument` + `guardDocumentUpdate`
  - `DOCUMENT_STATUS` state machine رسمي في `lib/stateMachines.js`
- [x] `services/complaintLifecycle.js` — دورة حياة الشكوى (2026-04-19)
  - `convertComplaintToNcr` (transactional) + `guardComplaintUpdate`
  - `routes/complaints.js::POST /:id/convert-to-ncr` أصبح 5 سطور

#### 2.3 توحيد Normalization 🟡
- [x] `normalize()` موحّدة للنصوص العربية (2026-04-19)
  - `utils/normalize.js` — `normalizeArabic()` + `arabicSearchVariants()`
  - مُدمج في `crudFactory` — كل بحث CRUD يعمل مع alef/yaa/taa-marbuta/tashkeel variants
- [x] تطبيقها على كل حقول البحث (2026-04-19)
  - كل CRUD route يستخدم `searchFields` عبر `crudFactory` الذي يطبّق `arabicSearchVariants` تلقائياً (21 resource)
  - الاستعلامات المخصصة: `kpi.js::myKpi` يستخدم `arabicSearchVariants(userName)` لمطابقة الأنشطة بالمسؤول مع اختلافات الألف/الياء/التاء المربوطة
  - Frontend: `normalizeArabic` + `arabicMatches` في `app.js` (مُطبَّق على `bulkFilteredUsers`)
- [x] توحيد formatting للتواريخ والأرقام (2026-04-19)
  - `fmtDate` / `fmtDateTime` / `fmtNumber` / `fmtCurrency` / `fmtPercent` في `app.js`
  - جميعها تستخدم `ar-SA-u-ca-gregory` (تقويم ميلادي) لتوافق التدقيق الخارجي — لا تخلط مع الهجري

#### 2.4 مراجعة المسارات المخصصة 🟡
- [x] توحيد استجابات الأخطاء (2026-04-19)
  - استبدال `res.status(404).json({ ok: false, error })` بـ `throw NotFound(...)` في:
    `dataHealth.js`, `exports.js`, `strategicGoals.js` (موضعين)
  - جميع الأخطاء الآن تمرّ عبر `errorHandler` بشكل واحد `{ ok:false, error:{ code, message } }`
- [x] توحيد envelope النجاح (2026-04-19)
  - `POST /kpi/entries` → `{ ok:true, entry, feedback, locked }` (كان يُعيد result فقط)
  - `GET /kpi/entries` → `{ ok:true, items, total }` (كان يُعيد array خاماً)
  - `exports.js` fmt('date') يستخدم التقويم الميلادي الصريح
- [ ] توحيد pagination في المسارات المخصصة التي تعيد قوائم طويلة (kpi/dashboard/matrix — حالياً بلا حدّ)
- [ ] تبنّي قواعد crudFactory في routes الـ reports/analytics — مؤجّل (طبيعتها aggregate)

---

## المرحلة 3 — الواجهة والإرشاد

> النظام سهل ومفهوم للموظف غير المختص.

### ✅ المنجز (12-point UX review)
- [x] Dashboard حسب الدور (`myWork` بـ 4 modes)
- [x] Wizards: شكوى، NCR، مخاطر، مراجعة إدارية
- [x] Smart filters: شكاوى، NCR، وثائق
- [x] DetailShell drawer مع Timeline
- [x] Empty states ذكية (أغلب الصفحات)
- [x] بطاقات تنبيه عملية مع أزرار إجراء
- [x] صفحة dataHealth
- [x] `myKpi` dashboard

### ⬜ المتبقي

#### 3.1 Wizards إضافية 🟡
- [x] Wizard إدخال قراءة KPI الشهرية — 3 خطوات (إدخال → مراجعة بحساب RAG/forecast/alerts عبر `POST /kpi/entries/preview` → حفظ) — 2026-04-19
- [x] Wizard تقييم مورد (type-polymorphic حسب نوع المورد) — 3 خطوات (معلومات+معاينة المعايير → درجات → مراجعة+قرار) مع إبراز المعايير الحرجة الفاشلة — 2026-04-19

#### 3.2 Smart Filters للوحدات المتبقية 🟡
- [x] أهداف الجودة (mine/myDept/open/closed/overdue/atRisk/thisMonth) — 2026-04-19
- [x] الموردين (approved/pending/rejected/highRated/lowRated/needsReview/thisMonth) — 2026-04-19
- [x] المستفيدين (applicants/active/inactive/highPriority/dueReview/mine/thisMonth) — 2026-04-19
- [x] المؤشرات (KPI) — 11 quick chips (mine/myDept/red/yellow/green/gray/behind/ahead/missing/entered/criticalAlerts) + perspective filter + counts endpoint `/kpi/matrix?quick=...`  — 2026-04-19
- [x] الاستبيانات — 8 quick chips (active/inactive/withResponses/noResponses/highSatisfaction/lowSatisfaction/recent/stale) + counts مع 6 unit tests — 2026-04-19

#### 3.3 تحسينات نماذج وتفاصيل 🟡
- [ ] تقسيم النماذج الطويلة إلى أقسام (basic + advanced fold)
- [ ] Tabs/Accordions في صفحات التفاصيل المزدحمة
- [x] Mobile card-view للجداول (2026-04-19)
  - أقل من `md` (768px): بطاقات عمودية بها `dt/dd` من نفس `currentCols`
  - `md` فأعلى: الجدول الأصلي مع `overflow-x-auto` للحماية من الفيض
  - أزرار الإجراءات المختصرة في البطاقة: تعديل/حذف/استعادة/عرض (detail drawer)

#### 3.4 اللغة العربية التشغيلية 🟡
- [x] جولة منهجية موحّدة للمصطلحات — قاموس مرجعي (2026-04-19)
  - `docs/terminology.md` — 60+ مصطلح معتمد مع بدائل مرفوضة
  - يغطي: دورة حياة السجلات، الأدوار، KPI، الشكاوى، المخاطر، الأزرار، التواريخ/الأرقام
  - قاعدة عامة: ميلادي `يوم/شهر/سنة`، `ar-SA` لجميع الأرقام، لا خلط مع الهجري
- [x] استبدال بدايات المصطلحات غير المتسقة (2026-04-19)
  - `رضا العملاء` → `رضا المستفيدين` (متوافق مع طبيعة المنظمة الخيرية)
- [ ] Subtitle تفسيري أسفل العناوين الرئيسية (قالب موجود في القاموس، التطبيق تدريجي)
- [ ] تمشيط كامل للواجهة — قيد الإنجاز (مُوثَّق كحارس في `terminology.md`)

#### 3.5 تحسينات KPI UI 🟡
- [x] لون أداء واضح داخل صف الجدول (2026-04-19)
  - `kpiRowBorder(row.rag)` — حدّ أيمن ملوّن 4px (أخضر/أصفر/أحمر/رمادي)
  - `kpiRowBg(row.rag)` — خلفية خفيفة حمراء للصفوف المتأخرة
- [x] إدخال سريع inline من الجدول (2026-04-19)
  - كل خلية شهرية أصبحت button — `kpiQuickEntryFromCell(row, month)` يفتح نموذج الإدخال مع تعبئة `kind/id/month`
  - تأثيرات hover: ring + scale لتوضيح قابلية النقر
- [x] مؤشر واضح للقراءات المتأخرة (2026-04-19)
  - شارة "⏰ متأخر" بجانب عنوان الصف عند غياب قراءة الشهر السابق
  - شريط تنبيه أحمر أعلى المصفوفة بعدد القراءات المفقودة + زر سريع "عرض المتأخرات فقط"

---

## المرحلة 4 — نضج الأعمال

> النماذج والعمليات تعكس الواقع المؤسسي بدقة.

### ✅ المنجز
- [x] دورة الوثائق (DRAFT → UNDER_REVIEW → APPROVED → PUBLISHED → OBSOLETE)
- [x] حالات NCR وshowaya الأساسية
- [x] المراجعة الإدارية (مع تنبيه 150/180 يوم)

### ⬜ المتبقي

#### 4.1 تقييم الموردين 🟡
- [ ] معايير type-polymorphic (حسب نوع المورد)
- [x] حساب موحّد في service layer (2026-04-19)
  - `services/supplierEval.js` — `buildSupplierEvalPayload` + `prepareSupplierEval`
  - 7 unit tests (legacy mode, recommendation injection, critical fail)
- [x] **تاريخ التقييمات وتتبع التحسّن** (ISO 8.4.2) — 2026-04-19
  - `services/supplierHistory.js` — `computeTrend` + `computeOverallTrend` + `buildSupplierHistory`
  - `GET /api/suppliers/:id/history` — timeline + stats (avg/best/worst/overall trend)
  - دلالات: first / improving (≥+5) / declining (≤-5) / stable
  - 13 unit tests (حالات حافة: أول تقييم، مستقر، تحسّن، تراجع)
  - [x] **UI timeline في صفحة المورد** (2026-04-19)
    - زر "📈 سجل التقييمات" في actions لكل مورد
    - Modal مع stats (عدد/متوسط/أعلى/أدنى) + الاتجاه العام + timeline مع نقاط ملوّنة حسب الاتجاه
    - `openSupplierHistory` + `trendLabel`/`trendColor`/`overallTrendLabel` في app.js

#### 4.2 تقييم التبرعات 🟡
- [ ] مراجعة النموذج الحالي
- [ ] ربط بمعايير الجودة
- [ ] تقارير تشغيلية للتبرعات

#### 4.3 تقييم المستفيد — Workflow فعلي 🟡
- [ ] تحويل من form بسيط إلى دورة حياة
- [ ] حالات: مطلوب → مجدول → مُنجز → متابعة
- [ ] ربط بالشكاوى والاستبيانات

#### 4.4 نضج الاستبيانات 🟡
- [ ] تقييم مركب (Composite scoring)
- [ ] أقسام ومعايير موزونة
- [ ] تحليل تلقائي للردود

#### 4.5 إقفال الحالات الحساسة 🟡
- [ ] State machine صريح لـ NCR
- [ ] State machine صريح للشكاوى
- [ ] State machine صريح للمراجعات
- [ ] قواعد إعادة فتح مضبوطة

#### 4.6 Time-driven operations 🟡
- [ ] تنبيهات آلية للشكاوى المتأخرة
- [ ] تنبيهات آلية لـ NCR بدون إجراء
- [ ] SLA واضح لكل حالة

---

## المرحلة 5 — الرقابة التشغيلية

> مدير الجودة والإدارة يرون ما يحتاج تدخلاً فورياً.

### ✅ المنجز
- [x] صفحة System Health (`dataHealth.js`)
- [x] EXEC summary في myWork (groupBy aggregates)
- [x] Alerts موحّدة بأزرار إجراء مباشرة
- [x] Activity log per-entity (DetailShell timeline)

### ⬜ المتبقي

#### 5.1 تقارير تنفيذية 🟡
- [ ] Report Builder تشغيلي (ليس export خام)
- [ ] تقارير جاهزة: المتأخر، غير المكتمل، المتعطل، يحتاج قرار
- [ ] جدولة تقارير دورية

#### 5.2 Activity Log مُحسّن 🟡
- [ ] عرض مُبسّط للمستخدم (من/ماذا/متى)
- [ ] فلترة حسب نوع الحدث
- [ ] تصدير للسجل

#### 5.3 Jobs دورية 🟡
- [ ] Job يومي لـ dataHealth مع تنبيه للجودة
- [ ] Job لحساب SLA والتنبيه
- [ ] Job لإرسال ملخص أسبوعي للإدارة

---

## المرحلة 6 — التبنّي المؤسسي

> الموظفون يستخدمون النظام فعلاً، لا شكلياً.

### ⬜ كل البنود

- [ ] دليل تدريب حسب الدور (EMPLOYEE / DEPT_MANAGER / QUALITY / EXEC)
- [ ] جلسات تدريبية موثقة
- [ ] خطة إلغاء النماذج الورقية/Excel الموازية
- [ ] لوحة قياس الاستخدام (usage metrics)
- [ ] قياس الالتزام بالإدخال (completion rates)
- [ ] استطلاع رضا المستخدمين الدوري
- [ ] قناة ملاحظات داخل النظام

---

## المرحلة 7 — الاستدامة والتحسين المستمر

> النظام يستمر في النضج بدون فوضى.

### ✅ المنجز
- [x] مذكرة ذاكرة للنشر على Coolify

### ⬜ المتبقي

#### 7.1 حوكمة التغييرات
- [ ] CHANGELOG منتظم
- [ ] مراجعة شهرية للتحسينات
- [ ] عملية اعتماد للتغييرات الكبيرة

#### 7.2 التوثيق الداخلي
- [x] `/docs/operations.md` — مرجع تشغيلي شامل (2026-04-19)
  - الأدوار والتسلسل الهرمي + مصفوفة الصلاحيات الكاملة
  - State machines لـ NCR/Complaint/Audit/ManagementReview/Document مع بنود ISO
  - قواعد الاعتماد والتوقيع الرقمي
  - 8 jobs دورية في المجدوِل مع توقيتها وغرضها
  - قواعد الأمان (rate limits, PII redaction, read audit, soft delete)
  - هيكل المشروع + أوامر التشغيل المحلي + جدول استكشاف الأخطاء
  - Checklist لإضافة resource جديد

#### 7.3 المراقبة والأداء
- [ ] Monitoring (uptime, errors, latency)
- [ ] Alerts للإدارة التقنية
- [ ] مراجعة الفهارس بعد نمو البيانات
- [ ] Query performance audit

#### 7.4 الميزات الاستراتيجية (Phase 3 من المراجعة الأولى)
- [ ] API tokens مع scopes
- [ ] Notifications متعددة القنوات (WhatsApp/SMS/Email)
- [ ] Multi-tenancy (organizationId)
- [ ] ClamAV لفحص المرفقات

---

## 📌 ملاحظات تنفيذية

- كل بند يحمل مربع `[ ]` قابل للتحديث عند الإنجاز
- الأولوية الحالية: **إكمال المرحلة 1 و 2** قبل التوسع
- الأيقونات: 🔴 حاسم | 🟡 مهم | 🟢 متقدم | 🔵 مؤجّل
- يُحدّث هذا الملف مع كل sprint

---

## 🚀 Sprint المقترح التالي

**الأسبوع القادم — إكمال المرحلة 1:**
1. Rate-limiter لـ `/auth/login`
2. Backup cron + اختبار استرجاع
3. Signature bypass audit
4. إعداد بنية الاختبارات (Playwright + Supertest)
5. أول 3 اختبارات تكامل: auth + publicAck + documents

**الأسبوع الذي يليه — بدء المرحلة 2:**
6. تبنّي Zod + أول 3 schemas (user, document, complaint)
7. أول service: `services/documentApproval.js`
