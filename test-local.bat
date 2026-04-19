@echo off
echo ====================================
echo   QMS - Local Test Environment
echo ====================================

cd apps\api

if not exist .env (
    echo.
    echo ⚠️  لم يجد ملف .env
    echo.
    echo 1. اذهب الى neon.tech وانشئ قاعدة بيانات مجانية
    echo 2. انسخ ملف .env.example باسم .env
    echo 3. ضع CONNECTION STRING من Neon في DATABASE_URL
    echo.
    pause
    exit /b 1
)

echo.
echo [1/3] تطبيق تغييرات قاعدة البيانات...
node_modules\.bin\prisma db push --accept-data-loss
if errorlevel 1 (
    echo ❌ فشل db push - تحقق من DATABASE_URL في ملف .env
    pause
    exit /b 1
)

echo.
echo [2/3] إنشاء البيانات الأولية...
node src/seed-if-empty.js

echo.
echo [3/3] تشغيل السيرفر...
echo.
echo ✅ افتح المتصفح على: http://localhost:3000
echo ✅ أو: http://localhost:3000/login
echo.
echo للإيقاف: Ctrl+C
echo.
npm run dev
