import { defineConfig } from 'vitest/config';

// افتراضياً: unit tests فقط (بلا DB).
// لـ integration tests: `npm run test:integration` (يحتاج Docker + testcontainers).
export default defineConfig({
  test: {
    include: ['tests/**/*.test.js'],
    exclude: ['tests/integration/**', 'node_modules/**'],
    environment: 'node',
    globals: false,
    testTimeout: 10_000,
  },
});
