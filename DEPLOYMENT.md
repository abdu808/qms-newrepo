# 🚀 دليل النشر - نظام إدارة الجودة

**الجمهور المستهدف:** مسؤول التقنية / IT Admin
**مدة النشر المقدّرة:** 30–60 دقيقة

---

## 1. المتطلبات الأساسية

| البند | المواصفة |
|--------|----------|
| الخادم | Linux (Ubuntu 22.04+) مع Coolify مثبّت |
| RAM | 2 GB كحد أدنى (4 GB مُستحسن) |
| تخزين | 20 GB+ |
| المنفذ 80/443 | مفتوحَين |
| نطاق فرعي | `quality.bir-sabia.org.sa` يشير إلى الخادم |
| GitHub | حساب شخصي/منظّمة |

---

## 2. رفع الكود إلى GitHub

```bash
cd qms
git init
git add .
git commit -m "QMS initial commit"
git branch -M main
git remote add origin https://github.com/<USER>/qms.git
git push -u origin main
```

⚠️ **مهم:** لا ترفع ملف `.env` (محمي عبر `.gitignore`).

---

## 3. توليد أسرار قوية

```bash
# JWT_SECRET و REFRESH_SECRET
openssl rand -hex 32
openssl rand -hex 32

# POSTGRES_PASSWORD
openssl rand -base64 24
```

احفظ هذه القيم في مكان آمن (مدير كلمات مرور).

---

## 4. إنشاء المشروع في Coolify

1. افتح لوحة **Coolify** → **+ New** → **Docker Compose**.
2. اختر **Private Repository** (أو Public إن كان المستودع عاماً).
3. ألصق رابط مستودع GitHub + اختر الفرع `main`.
4. **Build Pack:** `Docker Compose`.
5. **Docker Compose File:** `docker-compose.yml`.
6. **Domain:** `https://quality.bir-sabia.org.sa` → اختر الخدمة `qms-web` (المنفذ 80).
7. **Environment Variables:** أضف جميع المتغيرات من `.env.example` بقيمها الحقيقية:
   - `NODE_ENV=production`
   - `APP_URL=https://quality.bir-sabia.org.sa`
   - `CORS_ORIGIN=https://quality.bir-sabia.org.sa`
   - `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB`
   - `DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@qms-db:5432/${POSTGRES_DB}?schema=public`
   - `JWT_SECRET` / `REFRESH_SECRET` (من الخطوة 3)
   - `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME`
   - `PORT=3000`
8. احفظ.

---

## 5. الإطلاق الأول

- اضغط **Deploy** في Coolify.
- انتظر حتى تكتمل جميع الخدمات (قد يستغرق 5–10 دقائق للبناء الأول).
- راقب السجلات عبر **Logs**:
  - `qms-db`: تأكد أن قاعدة البيانات بدأت.
  - `qms-api`: يجب أن ترى:
    ```
    [seed-if-empty] empty DB — running full seed
    [seed] done.
    [seed] Admin: admin@bir-sabia.org.sa / Admin@2026
    [qms-api] listening on :3000 (production)
    ```
  - `qms-web`: يجب أن يبدأ nginx بدون أخطاء.

---

## 6. تفعيل SSL (HTTPS)

Coolify يتعامل تلقائياً مع Let's Encrypt:
- افتح إعدادات المشروع → **Domains** → تأكد من تفعيل **Generate SSL Certificate**.
- بعد دقيقة ستعمل `https://quality.bir-sabia.org.sa`.

---

## 7. تفعيل Auto-Deploy من GitHub

في صفحة المشروع بـ Coolify:
1. **Webhooks** → انسخ رابط الـ Webhook.
2. في GitHub: `Settings` → `Webhooks` → **Add webhook**:
   - Payload URL: الرابط المنسوخ
   - Content type: `application/json`
   - Events: `Just the push event`
   - Secret: اتركه كما هو أو استخدم القيمة التي أعطاها Coolify.
3. احفظ.

الآن أي `git push` على فرع `main` سيُفعّل بناء ونشراً جديداً تلقائياً.

---

## 8. اختبار النظام

1. افتح `https://quality.bir-sabia.org.sa`.
2. سجّل دخول بـ:
   - البريد: `admin@bir-sabia.org.sa`
   - كلمة المرور: `Admin@2026`
3. **فوراً**: غيّر كلمة مرور المسؤول من صفحة **المستخدمون**.
4. أنشئ حسابات إضافية حسب الحاجة.

---

## 9. النسخ الاحتياطي

- **تلقائي:** حاوية `qms-backup` تنفّذ `pg_dump` يومياً الساعة 3 صباحاً وتحفظ في `./backups/`.
- **يدوي:**
  ```bash
  docker exec qms-db pg_dump -U qms_user qms_db | gzip > qms_$(date +%F).sql.gz
  ```
- **استرجاع:**
  ```bash
  gunzip < qms_2026-04-15.sql.gz | docker exec -i qms-db psql -U qms_user qms_db
  ```

---

## 10. التحديثات المستقبلية

```bash
# محليّاً
git pull
# عدّل الكود
git add . && git commit -m "وصف التعديل"
git push
# Coolify سينشر تلقائياً خلال 30 ثانية
```

لتنفيذ Migration لقاعدة البيانات:
- تعديل `prisma/schema.prisma`
- بعد `git push`، حاوية `qms-api` ستنفّذ `npx prisma migrate deploy` عند إعادة التشغيل تلقائياً.

---

## 11. استكشاف الأخطاء

| المشكلة | الحل |
|---------|------|
| لا يتم الوصول للموقع | تحقق من DNS وإعدادات Coolify → Domains |
| خطأ SSL | انتظر 2–5 دقائق وتأكد أن النطاق يشير للخادم |
| خطأ اتصال DB | تحقق من `DATABASE_URL` وسجلات `qms-db` |
| Seed لم يعمل | احذف volume `qms_db_data` وأعد النشر |
| Login فشل | تأكد من `JWT_SECRET` موجود ومن `ADMIN_EMAIL` |

---

## 12. الأمان

- ✅ غيّر كلمات المرور الافتراضية فوراً
- ✅ فعّل 2FA على GitHub وCoolify
- ✅ احتفظ بنسخة خارجية من `backups/` كل أسبوع
- ✅ راجع `سجل التدقيق` دورياً
- ✅ حدّث Docker images شهرياً: `docker compose pull && docker compose up -d`

---

**للتواصل الفني:** admin@bir-sabia.org.sa
