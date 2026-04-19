# النسخ الاحتياطي والاستعادة — QMS

> ISO 9001 §7.5.3 (ضبط المعلومات الموثّقة) + §9.1 (المراقبة والقياس).
> آخر تحديث: 2026-04-19

---

## 1) ما الذي يُنسخ؟

| المورد | المصدر | الوجهة | الصيغة |
|--------|--------|--------|--------|
| قاعدة البيانات | `DATABASE_URL` (Postgres) | `BACKUP_DIR/db-YYYY-MM-DD.sql.gz` | `pg_dump` plain → gzip |
| الملفات المرفوعة | `UPLOADS_DIR` | `BACKUP_DIR/files-YYYY-MM-DD.tar.gz` | `tar -czf` |

القيم الافتراضية: `BACKUP_DIR=./backups`, `UPLOADS_DIR=./uploads`.

---

## 2) التشغيل

### تلقائياً (Cron داخلي)

يعمل مجدول عمليات `scheduler.js` داخل العملية مرة يومياً بعد 2ص:

```
QMS_BACKUP=on
DATABASE_URL=postgresql://user:pass@host:5432/db
BACKUP_DIR=/var/qms/backups
UPLOADS_DIR=/var/qms/uploads
```

- `runDailyBackupIfDue()` يمنع التكرار عبر `lastBackupDate` في الذاكرة + تحقق وجود الملف على القرص.
- السجلات تُطبع كـ JSON: `[backup] {...}` لجمعها في أنظمة التسجيل.

### يدوياً

```bash
cd apps/api
npm run backup
```

يُخرج ملخّصاً JSON ويُنهي بكود `0` عند نجاح جزء DB.

---

## 3) التدوير

`rotateBackups('db' | 'files')`:

- الأيام 0–7: يُحتفظ بكل نسخة.
- الأيام 8–35: نسخة واحدة لكل أسبوع ISO.
- الأيام 36–210: نسخة واحدة لكل شهر.
- أكثر من 210 يوم: تُحذف.

السقف العملي: 7 يومية + 4 أسبوعية + 6 شهرية ≈ 17 نسخة لكل نوع.

---

## 4) تمرين الاستعادة (Restore Drill)

> **يُنفَّذ ربع سنوي على الأقل** للتأكد من قابلية الاسترجاع (وليس فقط وجود الملف).

### الخطوات

1. **تجهيز بيئة اختبار معزولة** (لا تستعد على قاعدة البيانات الحيّة):
   ```bash
   docker run --name qms-restore-test -e POSTGRES_PASSWORD=test -p 55432:5432 -d postgres:15
   export TEST_URL=postgresql://postgres:test@localhost:55432/postgres
   ```

2. **نسخ آخر backup محليّاً**:
   ```bash
   scp user@prod:/var/qms/backups/db-2026-04-19.sql.gz ./
   ```

3. **فك الضغط والاستعادة**:
   ```bash
   gunzip -c db-2026-04-19.sql.gz | psql "$TEST_URL"
   ```

4. **تشغيل Prisma ضد البيئة المؤقتة**:
   ```bash
   cd apps/api
   DATABASE_URL="$TEST_URL" npx prisma migrate deploy   # إذا لزم
   DATABASE_URL="$TEST_URL" npm start
   ```

5. **استعادة الملفات** (اختياري):
   ```bash
   mkdir -p /tmp/qms-uploads-restore
   tar -xzf files-2026-04-19.tar.gz -C /tmp/qms-uploads-restore
   ```

6. **تحقق سلامة البيانات**:
   - تسجيل الدخول بحساب `SUPER_ADMIN`.
   - عدّ السجلات الرئيسية: `users`, `documents`, `complaints`, `ncrs`, `kpiObjectives`, `kpiActivities`, `kpiEntries`.
   - فتح `dataHealth` — يجب ألا تظهر مشاكل جديدة.
   - افتح مستند PDF واحد على الأقل (تأكّد من استعادة `uploads`).

7. **تنظيف**:
   ```bash
   docker rm -f qms-restore-test
   rm -f db-2026-04-19.sql.gz files-2026-04-19.tar.gz
   rm -rf /tmp/qms-uploads-restore
   ```

### نموذج توثيق التمرين

| التاريخ | من نفّذ | النسخة المُستَعادة | المدة (ث) | النتيجة | ملاحظات |
|---------|---------|-------------------|-----------|---------|---------|
| 2026-04-19 | مدير الجودة | `db-2026-04-18.sql.gz` | 42 | ✅ ناجح | كل الجداول استُعيدت |

احتفظ بهذا الجدول في سجل مراجعة الإدارة (Mgmt Review) كدليل §9.3.

---

## 5) الأخطاء الشائعة

| الخطأ | السبب | الحل |
|-------|-------|------|
| `pg_dump غير مُثبَّت` | صورة Docker بلا postgres-client | أضف `RUN apk add --no-cache postgresql-client` أو مكافئ |
| `tar غير مُثبَّت` | بيئة Windows بدون Git Bash | استخدم WSL أو تجاهل files backup |
| حجم الملف 0 bytes | فشل `pg_dump` قبل الكتابة | راجع سجل `stderr` في مخرجات `[backup]` |
| `DATABASE_URL ليس Postgres` | بيئة اختبار بـ SQLite | الباكاب الحالي يدعم Postgres فقط — لبيئات SQLite انسخ ملف `.db` مباشرة |

---

## 6) خارطة الطريق (ديون تقنية)

- [ ] رفع النسخ إلى S3/R2 لعزل جغرافي (حالياً محلية فقط).
- [ ] تشفير النسخ بمفتاح خارجي قبل التخزين.
- [ ] اختبار استعادة مؤتمت أسبوعياً (دوكر + diff عدّ الصفوف).
