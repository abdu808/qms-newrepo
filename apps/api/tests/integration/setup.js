/**
 * tests/integration/setup.js
 *
 * يشغّل Postgres مؤقت عبر testcontainers، يطبّق prisma schema، ويُنشئ Express app
 * للـ supertest. يُستعمل في كل *.integration.test.js.
 *
 * متطلبات:
 *   npm install --save-dev @testcontainers/postgresql testcontainers
 *   Docker Desktop شغّال محلياً.
 */
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { execSync } from 'child_process';

let container = null;
let prevUrl = null;

export async function setupTestDb() {
  container = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('qms_test')
    .withUsername('test')
    .withPassword('test')
    .start();

  const url = container.getConnectionUri();

  // طبّق الـ schema (push بدل migrate لأن المشروع لا يستعمل migrations folder)
  execSync('npx prisma db push --skip-generate --accept-data-loss', {
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'inherit',
  });

  // احفظ الـ URL الأصلية لاستعادتها في teardown
  prevUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = url;
  process.env.NODE_ENV = 'test';
  process.env.QMS_NO_LISTEN = '1';

  return { url, container };
}

export async function teardownTestDb() {
  if (container) {
    await container.stop();
    container = null;
  }
  if (prevUrl !== null) {
    process.env.DATABASE_URL = prevUrl;
    prevUrl = null;
  }
}

/**
 * يُرجع Express app جاهز للـ supertest. يستورد server.js مرة واحدة بعد
 * تعيين DATABASE_URL، فيبني الـ prisma client على الـ container.
 */
export async function buildApp() {
  const mod = await import('../../src/server.js');
  return mod.app;
}

/**
 * يحذف بيانات كل الجداول بين الاختبارات (أسرع من إعادة migrate).
 * استعمل في `afterEach` للاختبارات التي تكتب بيانات.
 */
export async function truncateAll(prisma) {
  const tables = await prisma.$queryRawUnsafe(`
    SELECT tablename FROM pg_tables
    WHERE schemaname='public' AND tablename NOT LIKE '_prisma%'
  `);
  const names = tables.map(t => `"${t.tablename}"`).join(', ');
  if (names) {
    await prisma.$executeRawUnsafe(`TRUNCATE ${names} RESTART IDENTITY CASCADE`);
  }
}
