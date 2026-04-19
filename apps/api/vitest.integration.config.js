import { defineConfig } from 'vitest/config';

// Integration tests فقط — تتطلّب Docker + @testcontainers/postgresql.
export default defineConfig({
  test: {
    include: ['tests/integration/**/*.integration.test.js'],
    environment: 'node',
    globals: false,
    testTimeout: 120_000,
    hookTimeout: 120_000,
    pool: 'forks',   // عزل الـ prisma client بين الملفات
    fileParallelism: false, // كل ملف يشارك نفس الـ container
  },
});
