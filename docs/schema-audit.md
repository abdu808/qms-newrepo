# مراجعة Schema — ISO 9.1 / سلامة البيانات

> مرجع المراجعة البنيوية لقيود قاعدة البيانات.
> آخر مراجعة: 2026-04-19
> المراجع: consultant-review-backlog.md §1.3

---

## 1) قيود UNIQUE — الحالة

### ✅ مطبّقة بشكل صحيح
| الموديل | الحقل/المركّب | الغرض |
|---|---|---|
| User | `email` | منع تكرار المستخدم |
| Department | `code` | رمز القسم فريد |
| Objective | `code` | رمز المؤشر |
| Supplier | `code` | رمز المورّد |
| SupplierEval | `code`, `evalTokenId` | حماية من استهلاك التوكن مرتين |
| Document | `code` | رمز الوثيقة |
| Training | `code` | رمز التدريب |
| TrainingRecord | `(trainingId, userId)` | موظف واحد = سجل واحد/تدريب |
| Ack | `(documentId, userId, version)` | إقرار واحد/إصدار |
| KpiEntry | `(objectiveId, year, month)` + `(activityId, year, month)` | قراءة واحدة/شهر |
| PolicyAcknowledgment | `(userId, policyId, policyVersion)` | إقرار سياسة واحد |
| Acknowledgment | 3 مؤشرات (internal + external by contact/id) | منع ازدواج الإقرار |
| RefreshToken | `token` | توكن فريد |
| EvalToken | `token` | توكن تقييم فريد |
| AckToken | `token` (افتراضي) | توكن إقرار فريد |

### ⚠️ مرشّحة للإضافة (دين تقني)
| الموديل | الحقل المقترح | السبب | خطورة |
|---|---|---|---|
| Supplier | `crNumber` (WHERE NOT NULL) | منع تكرار نفس السجل التجاري | متوسطة |
| Supplier | `vatNumber` (WHERE NOT NULL) | نفسه للرقم الضريبي | متوسطة |
| Beneficiary | `nationalId` (WHERE NOT NULL) | منع تسجيل نفس الهوية مرتين | **عالية** |
| Donation | `(donorName, itemName, receivedAt)` | منع ازدواج إدخال يدوي | منخفضة |

**ملاحظة**: Postgres يدعم partial unique indexes `WHERE ... IS NOT NULL` — مفيد لحقول اختيارية.

---

## 2) قيود NOT NULL — مراجعة

### المطلوب تشديده
| الموديل | الحقل | الحالة | المقترح | السبب |
|---|---|---|---|---|
| Complaint | `complainantName` | optional | يبقى | PII — قد تكون شكوى مجهولة |
| NCR | `title`, `description` | required ✅ | — | — |
| SupplierEval | `criteriaJson` | required ✅ | — | — |
| Document | `approverId` | optional | يبقى | وثيقة DRAFT قد لا يكون لها معتمِد |
| KpiEntry | `year`, `month` | required ✅ | — | — |

**القاعدة المُعتمدة**: اترك optional إلا عند وجود قيد أعمال صريح.

---

## 3) Race Conditions — تحليل

### 🔴 مناطق خطر محتمل

#### أ) اعتماد الوثائق (Document approval)
**السيناريو**: اثنان من QM يضغطان "اعتماد" في نفس الثانية على وثيقة DRAFT.
**الحالة الحالية**: `services/documentApproval.js` يتحقق من الحالة قبل UPDATE.
**الخطر**: TOCTOU — الاثنان يرون DRAFT، كلاهما يكتب APPROVED.
**الحل المقترح**:
```sql
UPDATE "Document"
SET status = 'APPROVED', approverId = $1, approvedAt = NOW()
WHERE id = $2 AND status = 'UNDER_REVIEW'  -- حارس ذري
RETURNING *;
```
إن لم تُعد صفاً → أحد الطرفين سبق. يُرفع خطأ `Conflict`.

#### ب) إغلاق NCR (NCR closure)
**الحالة الحالية**: `services/ncrClosure.js::guardClosure` يفحص الحالة قبل الكتابة.
**الخطر**: نفس TOCTOU.
**الحل**: UPDATE المشروط (where status='VERIFICATION').

#### ج) إدخال KPI (KpiEntry upsert)
**الحالة**: محمي بـ `@@unique([objectiveId, year, month])` ✅
**النتيجة**: race = UNIQUE violation → Prisma يُلقي `P2002` → نلتقطه كـ 409 Conflict. جيد.

#### د) استهلاك EvalToken
**الحالة**: محمي بـ `@unique` على `SupplierEval.evalTokenId` ✅
**النتيجة**: race = UNIQUE violation. جيد.

### 🛠️ الإجراء المقترح
إضافة **Optimistic Locking** (اختياري لكنه أمتن):
```prisma
model Document {
  ...
  version Int @default(0)  // يتزايد مع كل UPDATE
}
```
ثم في الـ service:
```js
await prisma.document.update({
  where: { id, version: currentVersion },  // يفشل إن تغيّر
  data:  { ..., version: { increment: 1 } },
});
```

**تقييم الجهد**: 2–3 migrations + تعديل services (documentApproval, ncrClosure, complaintLifecycle).

---

## 4) Soft-Delete — تحليل الاتساق

### الموديلات التي تدعم soft-delete (`deletedAt DateTime?`)
24 موديل — موحّدة مع `@@index([deletedAt])`:
Objective, Risk, Complaint, NCR, Audit, Supplier, SupplierEval, Donation, DonationEval, Beneficiary, Program, Survey, Document, Training, StrategicGoal, OperationalActivity, SwotItem, InterestedParty, Process, QualityPolicy, ManagementReview, CompetenceRequirement, CommunicationPlan, ImprovementProject, AuditChecklistTemplate, PerformanceReview, AckDocument.

### الموديلات التي **لا** تدعم soft-delete (مقصود)
سجلات تدقيق/إقرار immutable — الحذف غير مسموح:
`AuditLog`, `Ack`, `Acknowledgment`, `PolicyAcknowledgment`, `Signature`, `DocVersion`, `TrainingRecord`, `RefreshToken`, `EvalToken`, `AckToken`, `Notification`, `Setting`, `KpiEntry`.

### ⚠️ استثناء مشبوه: `User`
يستخدم `active Boolean` بدل `deletedAt`. الفرق:
- `active=false` → المستخدم مرئي في لوحات الإدارة لكنه معطّل.
- `deletedAt` → مخفي من القوائم الافتراضية.

**التوصية**: الإبقاء كما هو — المستخدم ليس "سجل تشغيلي". الحذف يُحترم عبر `active=false`.
**خطوة تالية**: توحيد اسم الفلتر في الكود (`where: { active: true }` vs `activeWhere`).

---

## 5) الفهارس (Indexes) — التغطية

### ✅ مغطّاة جيداً
- كل `deletedAt` لها `@@index` (24 موديل)
- كل `foreignKey` رئيسية لها فهرس
- `workflowState` على الموديلات ذات الـ Maker/Checker/Approver

### ⚠️ مرشّحة للإضافة (بعد نمو البيانات)
| الموديل | الحقل/المركّب | السبب |
|---|---|---|
| Complaint | `(receivedAt, status)` | تقرير SLA |
| NCR | `(dueDate, status)` | المتأخر |
| AuditLog | `(userId, createdAt)` | تدقيق شخصي |
| KpiEntry | `(year, month)` | استعلام الشهر الحالي عبر الموديلات |

**متى نضيف**: بعد 10K+ سجل/موديل، أو عند ظهور بطء في EXPLAIN.

---

## 6) خطة الـ Migrations المقترحة

### Migration 1 — أمان unique الحرجة (أولوية 🔴)
```sql
-- Beneficiary.nationalId يجب أن يكون فريداً عندما يُملأ
CREATE UNIQUE INDEX "beneficiary_nationalId_unique"
  ON "Beneficiary"("nationalId")
  WHERE "nationalId" IS NOT NULL AND "deletedAt" IS NULL;
```
يمنع تسجيل نفس المستفيد مرتين.

### Migration 2 — أمان unique المساعدة (أولوية 🟡)
```sql
CREATE UNIQUE INDEX "supplier_crNumber_unique"
  ON "Supplier"("crNumber")
  WHERE "crNumber" IS NOT NULL AND "deletedAt" IS NULL;

CREATE UNIQUE INDEX "supplier_vatNumber_unique"
  ON "Supplier"("vatNumber")
  WHERE "vatNumber" IS NOT NULL AND "deletedAt" IS NULL;
```

### Migration 3 — Optimistic Locking للحالات الحرجة (أولوية 🟡)
```prisma
model Document { ... version Int @default(0) }
model NCR      { ... version Int @default(0) }
model Complaint{ ... version Int @default(0) }
```
+ تعديل services للاعتماد على `version` في where clauses.

### Migration 4 — فهارس الأداء (بعد الإطلاق)
— يُطبَّق بعد جمع بيانات EXPLAIN حقيقية.

---

## 7) التنفيذ

المقترح:
1. **الآن**: مراجعة هذا المستند + موافقة المستشار.
2. **Sprint التالي**: Migration 1 (Beneficiary nationalId) — أقل خطر.
3. **Sprint بعده**: Migrations 2 + 3 بعد اختبار integration تكتشف أي أثر غير متوقع.

**بدون نشر**: هذه مقترحات — أيّ تطبيق يتطلّب:
- `prisma migrate dev` محلياً
- مراجعة الـ SQL المُولَّد
- اختبار على نسخة staging قبل prod
