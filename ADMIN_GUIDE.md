# دليل المسؤول التقني — QMS

مرجع مختصر لتشغيل النظام وصيانته محليًا وفي الإنتاج.

## التشغيل المحلي

### عبر Docker

```bash
cp .env.example .env
docker compose -f docker-compose.dev.yml up --build
```

- الواجهة والتطبيق: `http://localhost:3000`
- قاعدة البيانات المحلية: `localhost:5432`

### بدون Docker

```bash
cd apps/api
cp .env.example .env
npm install
npx prisma db push
node src/seed-if-empty.js
npm run dev
```

## الاعتماديات

- `Node.js 20+`
- `PostgreSQL 16`
- `Docker Compose` عند استخدام التشغيل بالحاويات

## الحساب الافتراضي

- البريد: `admin@bir-sabia.org.sa`
- كلمة المرور: `Admin@2026`

يجب تغيير كلمة المرور مباشرة بعد أول تسجيل دخول.

## العمليات اليومية

- راجع [دليل العمليات](./docs/operations.md) لفهم الصلاحيات ومسارات العمل.
- راجع [دليل النسخ الاحتياطي والاستعادة](./docs/backup-restore.md) لإدارة النسخ والاسترجاع.
- راجع [دليل النشر](./DEPLOYMENT.md) لإعداد Coolify وبيئة الإنتاج.

## ملاحظات تشغيل

- `docker-compose.yml` مخصص للنشر والإنتاج.
- `docker-compose.dev.yml` مخصص للتجربة والتطوير المحلي.
- في بيئة التطوير المحلية يتم تعطيل المجدول (`QMS_SCHEDULER=off`) لتقليل الضوضاء أثناء الاختبار.
