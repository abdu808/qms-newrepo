#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# deploy-db.sh — تطبيق تغييرات قاعدة البيانات على الإنتاج
#
# يُنفّذ بالترتيب:
#   1) نسخة احتياطية (npm run backup)
#   2) prisma db push (تطبيق schema.prisma)
#   3) 3 ملفات SQL اليدوية من prisma/migrations-manual/
#   4) prisma generate (للتأكد من تزامن الـ client)
#
# الاستخدام (من داخل apps/api):
#   chmod +x scripts/deploy-db.sh
#   ./scripts/deploy-db.sh
#
# متطلبات: DATABASE_URL مضبوطة في البيئة، psql + node + npx متاحة.
# ──────────────────────────────────────────────────────────────
set -euo pipefail

# ألوان للقراءة
RED=$'\e[31m'; GRN=$'\e[32m'; YLW=$'\e[33m'; BLU=$'\e[34m'; RST=$'\e[0m'

log()  { echo "${BLU}▶${RST} $*"; }
ok()   { echo "${GRN}✓${RST} $*"; }
warn() { echo "${YLW}!${RST} $*"; }
die()  { echo "${RED}✗${RST} $*" >&2; exit 1; }

# تحقق من الموقع الحالي
if [ ! -f "package.json" ] || [ ! -d "prisma" ]; then
  die "شغّل السكربت من داخل apps/api (لم أجد package.json أو prisma/)."
fi

# تحقق من DATABASE_URL
if [ -z "${DATABASE_URL:-}" ]; then
  # جرّب تحميله من .env
  if [ -f ".env" ]; then
    # shellcheck disable=SC2046
    export $(grep -E '^DATABASE_URL=' .env | xargs)
  fi
fi
[ -n "${DATABASE_URL:-}" ] || die "DATABASE_URL غير معرّفة في البيئة ولا في .env"

log "DATABASE_URL محمّلة (الهوست المستخدم مُخفى في اللوج)."

# ──────────────────────────────────────────────────────────────
# 1) نسخة احتياطية
# ──────────────────────────────────────────────────────────────
log "الخطوة 1/4: نسخة احتياطية عبر 'npm run backup'..."
if npm run backup; then
  ok "تمّت النسخة الاحتياطية."
else
  die "فشل النسخ الاحتياطي — توقفت قبل تعديل القاعدة."
fi

# ──────────────────────────────────────────────────────────────
# 2) prisma db push
# ──────────────────────────────────────────────────────────────
log "الخطوة 2/4: تطبيق schema.prisma عبر 'prisma db push'..."
# --accept-data-loss لن يُستخدم — لو ظهرت حاجة له فهذا مؤشر خطر ويجب التدخل يدويًا
if npx prisma db push --skip-generate; then
  ok "تمّ تحديث الـ schema."
else
  die "فشل prisma db push — راجع الخطأ أعلاه قبل المتابعة."
fi

# ──────────────────────────────────────────────────────────────
# 3) SQL اليدوية
# ──────────────────────────────────────────────────────────────
log "الخطوة 3/4: تطبيق ملفات SQL اليدوية..."
MANUAL_DIR="prisma/migrations-manual"
[ -d "$MANUAL_DIR" ] || die "لا يوجد مجلد $MANUAL_DIR"

SQL_FILES=(
  "001_beneficiary_nationalId_partial_unique.sql"
  "002_supplier_cr_vat_partial_unique.sql"
  "003_optimistic_locking_version.sql"
)

for f in "${SQL_FILES[@]}"; do
  path="$MANUAL_DIR/$f"
  if [ ! -f "$path" ]; then
    warn "تخطّي $f (غير موجود)."
    continue
  fi
  log "  → $f"
  # ON_ERROR_STOP=1 يوقف psql عند أول خطأ
  if psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$path"; then
    ok "  تمّ: $f"
  else
    die "فشل تطبيق $f — توقفت هنا."
  fi
done

# ──────────────────────────────────────────────────────────────
# 4) prisma generate
# ──────────────────────────────────────────────────────────────
log "الخطوة 4/4: توليد Prisma Client..."
if npx prisma generate; then
  ok "تمّ توليد الـ client."
else
  warn "فشل prisma generate — قد تحتاج إعادة تشغيل يدوية."
fi

echo ""
ok "${GRN}انتهى تحديث قاعدة البيانات بنجاح.${RST}"
echo ""
warn "الخطوة التالية يدويًا:"
echo "   - أعد تشغيل الـ API (Coolify restart أو pm2 restart qms-api)."
echo "   - اختبر /api/health ثم /api/my-work للتأكد من عدم وجود أخطاء Prisma."
