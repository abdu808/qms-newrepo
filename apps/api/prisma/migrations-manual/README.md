# Manual SQL Migrations — QMS

> مجلد للـ migrations اليدوية التي تستعمل ميزات Postgres غير مدعومة في Prisma DSL
> (أساساً: partial unique indexes).

---

## 📦 لماذا manual وليس `prisma migrate`؟

1. **المشروع يستعمل `prisma db push`** حالياً (لا يوجد `prisma/migrations/`).
2. **Partial unique indexes** (`WHERE col IS NOT NULL`) غير مدعومة في Prisma DSL —
   يجب تشغيلها كـ raw SQL بعد كل `db push`.
3. الـ schema-audit.md يوصي بـ 3 قيود خارج قدرة Prisma.

---

## 🚀 التطبيق

```bash
# 1) نسخة احتياطية إجبارية
npm run backup

# 2) تطبيق migration واحد على الـ staging DB
psql "$DATABASE_URL" -f prisma/migrations-manual/001_beneficiary_nationalId_partial_unique.sql

# 3) اختبار دخول نفس nationalId مرتين → يجب أن يُرفض
# 4) إذا نجح — طبّق على production

# لتطبيق الكل بالترتيب:
for f in prisma/migrations-manual/*.sql; do
  psql "$DATABASE_URL" -f "$f" || break
done
```

---

## 📋 قائمة الـ migrations

| # | الملف | الأولوية | الأثر |
|---|---|---|---|
| 001 | `beneficiary_nationalId_partial_unique.sql` | 🔴 عالية | يمنع تكرار نفس الهوية بين النشطين |
| 002 | `supplier_cr_vat_partial_unique.sql` | 🟡 متوسطة | يمنع تكرار السجل التجاري/الضريبي |
| 003 | `optimistic_locking_version.sql` | 🟡 متوسطة | version columns — يتطلّب تعديل services |

---

## ⚠️ ملاحظات مهمة

1. **Migration 3 يتطلّب تعديل الـ Prisma schema** (`version Int @default(0)` في 3 موديلات)
   وإلا ستختفي الأعمدة بعد أول `db push`.
2. **كل migration قابل للـ rollback** — تعليمات الـ rollback في نهاية كل ملف.
3. **بعد التطبيق**: حدّث `docs/schema-audit.md` لتأشير الحالة ✅.

---

## 📚 المرجع

- `docs/schema-audit.md` — التحليل الكامل.
- `docs/consultant-review-backlog.md` §1.3.
