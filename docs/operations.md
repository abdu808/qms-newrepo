# دليل العمليات — QMS جمعية البر بصبيا

> مرجع سريع للأدوار والصلاحيات ودورات العمل وقواعد الإغلاق والاعتماد.
> مُستخرج من الكود الفعلي — حدِّثه عند أي تغيير في `permissions-matrix.js` أو `stateMachines.js`.

آخر تحديث: 2026-04-19

---

## 👥 الأدوار

| الرمز | الدور | الوصف | الامتيازات |
|-------|------|------|------------|
| `GUEST_AUDITOR` | مدقّق ضيف | مدقّق خارجي | قراءة فقط — يُرفض أي طلب كتابة |
| `EMPLOYEE` | موظف | مُدخِل البيانات (Maker) | إنشاء السجلات في وحدات العمل اليومية |
| `DEPT_MANAGER` | مدير قسم | مراجع للقسم (Checker) | تعديل سجلات قسمه |
| `COMMITTEE_MEMBER` | عضو لجنة الجودة | مراجع جودة | مراجعة العمليات |
| `QUALITY_MANAGER` | مدير الجودة | مُعتمد (Approver) | اعتماد/إغلاق السجلات الحرجة |
| `SUPER_ADMIN` | مدير النظام | إداري أعلى | صلاحيات كاملة + حذف نهائي |

**التسلسل الهرمي (من الأدنى إلى الأعلى):**
```
GUEST_AUDITOR < EMPLOYEE < DEPT_MANAGER < COMMITTEE_MEMBER < QUALITY_MANAGER < SUPER_ADMIN
```

---

## 🔑 مصفوفة الصلاحيات (ملخّص)

| المورد | قراءة | إنشاء | تعديل | حذف | اعتماد/إغلاق |
|--------|:-----:|:-----:|:-----:|:---:|:------------:|
| المستخدمون | DEPT_MANAGER+ | SA | SA | SA | — |
| الأقسام | أي | QM+ | QM+ | SA | — |
| الأهداف | أي | DEPT_MANAGER+ | DEPT_MANAGER+ | QM+ | — |
| المخاطر | أي | EMPLOYEE+ | DEPT_MANAGER+ | QM+ | — |
| الوثائق | أي | EMPLOYEE+ | EMPLOYEE+ | QM+ | **QM+** (approve/publish) |
| الشكاوى | أي | EMPLOYEE+ | DEPT_MANAGER+ | QM+ | **QM+** (close) |
| عدم المطابقة (NCR) | أي | EMPLOYEE+ | DEPT_MANAGER+ | QM+ | **QM+** (close + توقيع) |
| الموردون | أي | EMPLOYEE+ | DEPT_MANAGER+ | QM+ | — |
| تقييم المورد | أي | DEPT_MANAGER+ | DEPT_MANAGER+ | QM+ | — |
| المستفيدون | أي | EMPLOYEE+ | DEPT_MANAGER+ | QM+ | — |
| التبرعات | أي | EMPLOYEE+ | DEPT_MANAGER+ | QM+ | — |
| المراجعة الإدارية | أي | QM+ | QM+ | QM+ | — |
| سياسة الجودة | أي | QM+ | QM+ | SA | activate: QM+ |
| سجل التدقيق | **QM+ فقط** | SA | SA | SA | — |

**القاعدة الافتراضية** (للموارد غير المذكورة):
- قراءة: أي مستخدم مصادَق
- إنشاء: EMPLOYEE+
- تعديل: DEPT_MANAGER+
- حذف/اعتماد/إغلاق: QUALITY_MANAGER+

**المصدر:** `apps/api/src/lib/permissions-matrix.js`

---

## 🔄 دورات العمل (State Machines)

### 1. عدم المطابقة (NCR) — ISO 10.2

```
OPEN → ROOT_CAUSE → ACTION_PLANNED → IN_PROGRESS → VERIFICATION → CLOSED
                                                                      ↓
                                                                 (terminal)
```

**قواعد إضافية:**
- أي حالة غير نهائية يمكن التراجع خطوة واحدة (re-analysis) أو إلغاؤها (CANCELLED)
- **الإغلاق يتطلّب:**
  - ✅ `effective = true` (فعّال)
  - ✅ `verifiedAt` موثَّق (تاريخ التحقق)
  - ✅ توقيع رقمي من المُغلِق (`signatureGuard`)
  - ✅ دور QUALITY_MANAGER أو SUPER_ADMIN
- الحالات النهائية: `CLOSED`, `CANCELLED`

### 2. الشكاوى (Complaint) — ISO 9.1.2

```
NEW → UNDER_REVIEW → IN_PROGRESS → RESOLVED → CLOSED
                                        ↑___(إعادة فتح)___↓
```

- إعادة الفتح (`RESOLVED → IN_PROGRESS`) مسموحة — المستفيد قد يعود
- `CLOSED` نهائية
- SLA: 14 يوماً — بعدها تُعدّ متأخرة

### 3. التدقيق الداخلي (Audit) — ISO 9.2

```
PLANNED → IN_PROGRESS → COMPLETED
            ↓
        CANCELLED (من أي حالة غير نهائية)
```

### 4. المراجعة الإدارية (ManagementReview) — ISO 9.3

```
PLANNED → IN_PROGRESS → COMPLETED
```

- **إلزامية سنوياً** — تنبيه آلي بعد 12 شهراً من آخر مراجعة مكتملة
- تُجمَّد بيانات KPI للفترة المغطّاة عند `COMPLETED` (`isPeriodLocked` في kpi.js)

### 5. الوثائق (Document) — ISO 7.5.3

```
DRAFT → UNDER_REVIEW → APPROVED → PUBLISHED → OBSOLETE
  ↑_______________________↓
```

- الاعتماد (`APPROVED/PUBLISHED`) يتطلّب مسار `/api/documents/:id/approve`
- `OBSOLETE` نهائية (إلا بإعادة فتح صريحة)
- مراجعة دورية كل 30 يوماً قبل الانتهاء — تنبيه آلي

**المصدر:** `apps/api/src/lib/stateMachines.js` + `routes/documents.js`

---

## ✍️ قواعد الاعتماد والتوقيع

| الإجراء | الصلاحية | توقيع رقمي؟ |
|---------|:--------:|:----------:|
| اعتماد وثيقة (DRAFT → APPROVED) | QM+ | ✅ يُسجَّل في Audit |
| نشر وثيقة (APPROVED → PUBLISHED) | QM+ | ✅ يُسجَّل في Audit |
| إغلاق NCR (→ CLOSED) | QM+ | ✅ **إلزامي** (`requireSignatureFor`) |
| إغلاق شكوى (→ CLOSED) | QM+ | — |
| إكمال مراجعة إدارية | QM+ | — |
| تفعيل سياسة جودة | QM+ | ✅ يُسجَّل |

**التوقيع الرقمي** — `signatureGuard.js`:
- يربط السجل (entityType + entityId + purpose) بالمستخدم وبصمة IP + UA
- يتم التحقق قبل تنفيذ العملية الحرجة

---

## 🔔 التنبيهات الآلية (scheduler.js)

تعمل كل **ساعة** تلقائياً داخل عملية Node (بدون cron خارجي).

| الفحص | المعيار | يُنبَّه |
|------|---------|-------|
| NCR متأخرة | `dueDate < now` ولم تُغلق | المُكلَّف |
| شكاوى متأخرة | > 14 يوم وحالة مفتوحة | المُكلَّف |
| وثائق تستحق المراجعة | خلال 30 يوماً | المنشئ + QMs |
| مخاطر عالية بلا تحديث | > 90 يوم + مستوى حرج/مرتفع | المالك |
| إقرار سياسة الجودة | موظف نشط لم يُقر | الموظف |
| وثائق إقرار إلزامية بلا إقرار | EMPLOYEE + ALL audience | كل موظف |
| NCR عالقة > 30 يوم | بدون correctiveAction | المُكلَّف + QMs |
| مراجعة إدارية مستحقة | > 12 شهر بلا جديدة | QMs |

**تعطيل التنبيهات:** `QMS_SCHEDULER=off`

---

## 🛡️ قواعد الأمان

### المصادقة
- JWT 8 ساعات + Refresh 30 يوماً
- Rate limiter لـ `/auth/login`:
  - 10 محاولات فاشلة/15د لكل (IP+email)
  - 30 محاولة فاشلة/15د لكل IP
  - تسجيل `LOGIN_FAILED` في AuditLog عند فشل كلمة المرور

### المسارات العامة (`/eval`, `/survey`, `/ack`)
- Rate limiter: 60 GET/15د + 10 POST/ساعة لكل IP
- حجم الطلب: 100KB كحد أقصى
- Headers: `X-Frame-Options=DENY`, `X-Content-Type-Options=nosniff`, `Referrer-Policy=no-referrer`
- التوكنات: UUID v4 (122 بت عشوائية)
- استهلاك ذرّي (transaction + updateMany)

### Soft Delete
- مُطبَّق افتراضياً على كل CRUD
- `deletedAt: null` يعني نشط
- الاستعادة: `POST /:id/restore` (QM+)
- الحذف النهائي: `DELETE /:id/purge` (SUPER_ADMIN فقط — غير قابل للتراجع)

### PII Redaction
الحقول التالية تُستبدل بـ `[REDACTED]` في AuditLog:
- `password*`, `token*`, `secret*`, `apiKey`, `authorization`
- `nationalId`, `phone`, `email`, `address`
- `complainant*`, `donor*`, `beneficiary*`, `guardian*`, `external*`
- `respondentName`, `evaluator*`, `contact*`

### Read-Access Audit
مُطبَّق على قراءة السجل الفردي:
- `Beneficiary` (بيانات مستفيد)
- `Complaint` (بيانات شاكٍ)
- `NCR` (سجلات جودة حساسة)

---

## 📂 بنية المشروع

```
apps/
  api/
    src/
      lib/
        permissions-matrix.js  ← RBAC
        permissions.js         ← gate middleware
        stateMachines.js       ← workflow transitions
        workflow.js            ← maker/checker/approver generic
        signatureGuard.js      ← digital signatures
        scheduler.js           ← hourly jobs
        kpi-engine.js          ← pure KPI math
        evalEngine.js          ← supplier evaluation
        alerts.js              ← live alert detectors
        beneficiaryAssessment.js ← priority scoring
        sla.js                 ← SLA tracking
      middleware/
        auth.js                ← JWT + denyReadOnly
        audit.js               ← auditTrail + readAudit + logAuth
      routes/                  ← one file per resource
      utils/
        crudFactory.js         ← generic CRUD + smart filters
        normalize.js           ← Arabic search normalization
        codeGen.js             ← auto-codes (OBJ-2026-001)
  web/
    public/
      index.html               ← Alpine.js SPA
      app.js                   ← SPA logic
docs/
  consultant-review-backlog.md ← roadmap موحّد
  operations.md                ← هذا الملف
```

---

## 🚀 تشغيل محلّي

```bash
# بيئة dev (Neon PostgreSQL — cloud)
cd apps/api
cp .env.example .env      # عدّل DATABASE_URL
npm install                # postinstall يشغّل prisma generate تلقائياً
npx prisma migrate dev     # تطبيق الـ migrations
npm run seed               # بيانات ابتدائية (admin/QM)
npm run dev                # http://localhost:3000

# بيئة إنتاج — Coolify
# docker-compose.yml + .env على Coolify
# qms-db (Postgres 16) + qms-api + qms-web
```

---

## 🔍 استكشاف الأخطاء

| المشكلة | الحل |
|---------|------|
| `prisma generate` يفشل | تأكد من `DATABASE_URL` — الأمر يستدعي schema validation |
| Login يرجع 429 | تجاوز rate limit — انتظر 15د أو غيّر IP |
| وثيقة لا تُعتمد | تأكد من الحالة `UNDER_REVIEW` أو `APPROVED` — لا يعمل من `DRAFT` مباشرة |
| NCR لا يُغلق | تحقق من: `effective=true`, `verifiedAt` موجود، توقيع رقمي |
| KPI لا يُعدّل في شهر قديم | الفترة مُجمَّدة بمراجعة إدارية مكتملة — راجع `isPeriodLocked` |
| بحث لا يجد السجل | الآن يدعم variants عربية (أ/إ/ا، ي/ى، ة/ه، التشكيل) |
| 429 على `/ack` أو `/eval` | تجاوز الحد — 60 قراءة أو 10 إرسال/ساعة |

---

## 📝 إضافة مورد جديد (Checklist)

1. ✅ أضف النموذج في `schema.prisma` (مع `deletedAt DateTime?` لـ soft-delete)
2. ✅ `npx prisma migrate dev --name add_<resource>`
3. ✅ أنشئ `src/routes/<resource>.js` باستخدام `crudRouter({ ... })`
4. ✅ سجّل المسار في `server.js`: `app.use('/api/<resource>', ...)`
5. ✅ أضف السياسة في `permissions-matrix.js` (أو اتركه للـ DEFAULT)
6. ✅ إن احتاج state machine → أضف في `stateMachines.js` + استخدم `assertTransition`
7. ✅ إن كان حساساً → أضف `readAudit(<EntityType>)` على router
8. ✅ أضف smart filters إن كان فيه تصفية شائعة
9. ✅ حدّث هذا الملف ومصفوفة الصلاحيات أعلاه
