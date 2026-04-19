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

# CI: يتطلّب runner بـ Docker socket
npm run test:integration -- --reporter=verbose
```

---

## 🗂️ البنية

```
tests/integration/
├── setup.js              ← يُنشئ container + تطبيق migrations + seed أدنى
├── teardown.js           ← يوقف الـ container
├── helpers/
│   ├── app.js            ← يُنشئ Express app جاهز للـ supertest
│   ├── factories.js      ← بناة بيانات اختبار (user/doc/complaint/...)
│   └── auth.js           ← login + إرجاع token
└── <area>.integration.test.js  ← ملف لكل مسار حرج
```

---

## ✍️ قائمة الاختبارات الحاسمة (المستشار §1.1)

| # | الملف | المسارات المُختبَرة | الحالة |
|---|---|---|---|
| 1 | `auth.integration.test.js` | login success/fail، refresh، logout، rate-limit | ⬜ |
| 2 | `publicAck.integration.test.js` | توقيع، منع تكرار، صلاحية التوكن | ⬜ |
| 3 | `publicEval.integration.test.js` | تقييم مستفيد، انتهاء التوكن | ⬜ |
| 4 | `surveys.integration.test.js` | نشر، رد، إغلاق | ⬜ |
| 5 | `documents.integration.test.js` | اعتماد، إصدارات، إقرارات | ⬜ |
| 6 | `kpi.integration.test.js` | upsert قراءة، حساب RAG، تنبيه | ⬜ |
| 7 | `complaints.integration.test.js` | إنشاء، SLA، إغلاق | ⬜ |
| 8 | `ncr.integration.test.js` | دورة الحياة، إغلاق، race | ⬜ |

---

## 🧪 نمط موحّد للاختبار

```js
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setupTestDb, teardownTestDb, buildApp } from './setup.js';
import { loginAs, createUser } from './helpers/auth.js';

let app, db;

beforeAll(async () => {
  db = await setupTestDb();
  app = await buildApp(db.url);
}, 60_000);

afterAll(async () => { await teardownTestDb(db); });

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
2. **Prisma migrate deploy** على الـ container قبل أول test.
3. **Transactional rollback** عبر `BEGIN`/`ROLLBACK` لكل test — يمنع تلوث السجلات.
4. **Seed أدنى فقط**: Role enum + Setting أساسي. كل test يُنشئ بياناته.
5. **Rate-limit**: يُعطَّل في test env عبر `process.env.NODE_ENV === 'test'`.

---

## 📋 Checklist لإضافة اختبار جديد

- [ ] الملف ينتهي بـ `.integration.test.js`
- [ ] يستخدم `beforeAll(setupTestDb)` + `afterAll(teardownTestDb)`
- [ ] يُنشئ كل بياناته (لا يعتمد على seed مشترك عدا enums)
- [ ] يختبر الـ happy path + حالة خطأ واحدة على الأقل
- [ ] يتحقق من الـ envelope: `{ ok: true|false, ... }`
- [ ] لا يتجاوز 5 ثوانٍ (اختبار بطيء → افصله)
