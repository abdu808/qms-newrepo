# QMS - نظام إدارة الجودة | جمعية البر بمحافظة صبيا

نظام إلكتروني متكامل لإدارة الجودة وفق ISO 9001:2015، مبني للجمعيات الخيرية.

## 🚀 التقنيات

- **Backend:** Node.js 20 + Express + Prisma + PostgreSQL 16
- **Frontend:** HTML + Tailwind CSS + Alpine.js + Chart.js
- **Auth:** JWT + bcrypt
- **PDF:** Puppeteer
- **Containers:** Docker Compose
- **Deploy:** Coolify (auto-deploy on git push)

## 📦 الوحدات

1. لوحة التحكم التنفيذية + KPIs
2. أهداف الجودة
3. المخاطر والفرص
4. الشكاوى والإجراءات التصحيحية (CAPA)
5. عدم المطابقة (NCR)
6. التدقيق الداخلي
7. تقييم الموردين (4 أنواع)
8. تقييم التبرعات العينية
9. المستفيدون والاستبيانات
10. التدريب والكفاءات
11. ضبط الوثائق والإصدارات
12. اطلاع الموظفين والتوقيع الإلكتروني
13. مراجعة الإدارة
14. سجل التدقيق (Audit Trail) — تلقائي
15. التقارير والتصدير (PDF + Excel)

## 🏃 التشغيل المحلي السريع

```bash
# 1. نسخ المشروع
git clone <YOUR_REPO_URL> qms
cd qms

# 2. إعداد متغيرات البيئة
cp .env.example .env
# يمكنك إبقاء القيم الافتراضية للتجربة السريعة عبر Docker

# 3. تشغيل بيئة التطوير المحلية
docker compose -f docker-compose.dev.yml up --build

# 4. فتح المتصفح
http://localhost:3000
```

**بيانات الدخول الافتراضية:**
- البريد: `admin@bir-sabia.org.sa`
- كلمة المرور: `Admin@2026` (يجب تغييرها فوراً)

### تشغيل بديل بدون Docker

```bash
cd apps/api
cp .env.example .env
npm install
npx prisma db push
node src/seed-if-empty.js
npm run dev
```

ثم افتح `http://localhost:3000`.

## 🌐 النشر على Coolify

راجع [DEPLOYMENT.md](./DEPLOYMENT.md)

## 📚 وثائق إضافية

- [دليل النشر (DEPLOYMENT.md)](./DEPLOYMENT.md)
- [دليل المستخدم (USER_GUIDE.md)](./USER_GUIDE.md)
- [دليل المسؤول التقني (ADMIN_GUIDE.md)](./ADMIN_GUIDE.md)

## 📝 الترخيص

ملكية خاصة لجمعية البر بمحافظة صبيا © 2026

---

**صُمم وفق ISO 9001:2015**
