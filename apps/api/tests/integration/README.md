# Integration Tests — QMS API

> اختبارات تكامل على مستوى HTTP + DB حقيقي (Postgres عبر testcontainers).
> لا تُخلط مع unit tests في `tests/*.test.js` الجذر (تلك بلا DB).

---

## 📦 الإعداد (مرة واحدة)

```bash
cd apps/api
npm install --save-dev @testcontainers/postgresql testcontainers
```

**متطلّب البيئة**: Docker Desktop شغّال (لـ testcontainers يطلق Postgres مؤقت لكل test run).

---

## 🚀 التشغيل

```bash
# local: يتطلّب Docker شغّال
npm run test:integration

# CI: يتطلّب runner يوفّر Docker لـ testcontainers
npm run test:integration -- --reporter=verbose
```

---

## 🗂️ البنية

```
tests/integration/
├── setup.js              ← يُنشئ container + يربط DATABASE_URL + يبني app
├── helpers/
│   ├── factories.js      ← بناة بيانات اختبار (user/doc/complaint/...)
│   └── auth.js           ← login + إرجاع token
└── <area>.integration.test.js  ← ملف لكل مسار حرج
```

---

## ✍️ قائمة الاختبارات الحاسمة (المستشار §1.1)

| # | الملف | المسارات المُختبَرة | الحالة |
|---|---|---|---|
| 1 | `auth.integration.test.js` | login success/fail، inactive user | ✅ |
| 2 | `publicAck.integration.test.js` | صلاحية التوكن غير الموجود | ✅ |
| 3 | `publicEval.integration.test.js` | صلاحية التوكن غير الموجود | ✅ |
| 4 | `surveys.integration.test.js` | المصادقة + القراءة المصرح بها | ✅ |
| 5 | `documents.integration.test.js` | القراءة + قيود الاعتماد | ✅ |
| 6 | `kpi.integration.test.js` | حماية المسار + تحقق الإدخال | ✅ |
| 7 | `kpi-bulk.integration.test.js` | bulk insert + تجميع الأخطاء | ✅ |
| 8 | `complaints.integration.test.js` | القراءة + تحقق التعديل | ✅ |
| 9 | `ncr.integration.test.js` | القراءة + تحقق التعديل | ✅ |
| 10 | `rollup.integration.test.js` | rollup من KPI إلى الهدف والجذر | ✅ |
| 11 | `reopen.integration.test.js` | إعادة الفتح + التدقيق + الصلاحيات | ✅ |
| 12 | `myWork.integration.test.js` | payload Guided Mode والتنبيهات | ✅ |
| 13 | `reportBuilder.integration.test.js` | datasets/run/export + الصلاحيات | ✅ |
| 14 | `auditLog.integration.test.js` | الفلترة + التصدير + الحجب | ✅ |
| 15 | `alerts.integration.test.js` | aggregate smoke + readiness | ✅ |

---

## 🧪 نمط موحّد للاختبار

```js
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setupTestDb, teardownTestDb, buildApp } from './setup.js';
import { createUser } from './helpers/factories.js';
import { loginAs } from './helpers/auth.js';

let app;

beforeAll(async () => {
  await setupTestDb();
  app = await buildApp();
}, 60_000);

afterAll(async () => { await teardownTestDb(); });

describe('auth login', () => {
  it('accepts valid credentials', async () => {
    const u = await createUser({ email: 'qm@test', role: 'QUALITY_MANAGER' });
    const res = await request(app).post('/api/auth/login').send({
      email: 'qm@test', password: 'Test1234!'
    });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });
});
```

---

## ⚠️ قرارات بنيوية مُعتمدة

1. **Docker عبر testcontainers** — وليس SQLite lane منفصل (يفقد JSONB/arrays).
2. **Prisma db push --skip-generate** على الـ container قبل كل ملف test.
3. **كل ملف تكامل يملك Postgres container مستقلًا** لتجنّب تلوّث البيانات.
4. **لا يوجد seed مشترك**: كل test يُنشئ بياناته بوضوح عبر factories.
5. **الـ CI لا يحتاج Postgres service منفصل** لأن testcontainers يدير البيئة كاملة.

---

## 📋 Checklist لإضافة اختبار جديد

- [ ] الملف ينتهي بـ `.integration.test.js`
- [ ] يستخدم `beforeAll(setupTestDb)` + `afterAll(teardownTestDb)`
- [ ] يُنشئ كل بياناته (لا يعتمد على seed مشترك عدا enums)
- [ ] يختبر الـ happy path + حالة خطأ واحدة على الأقل
- [ ] يتحقق من الـ envelope: `{ ok: true|false, ... }`
- [ ] لا يحمّل `prisma` على مستوى الملف قبل `setupTestDb()`
