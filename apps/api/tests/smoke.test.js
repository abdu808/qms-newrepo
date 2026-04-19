/**
 * tests/smoke.test.js — Supertest smoke tests (بلا DB).
 *
 * نختبر هنا فقط الـ endpoints التي لا تحتاج اتصال بقاعدة البيانات:
 *   - /api/health
 *   - middleware authenticate (401 على مسار محمي بلا توكن)
 *   - errorHandler (404 على مسار غير موجود)
 *   - helmet + CORS headers موجودة
 *
 * اختبارات الـ endpoints التي تلمس DB تنتظر مرحلة testcontainers/sqlite lane.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { config } from '../src/config.js';
import { authenticate } from '../src/middleware/auth.js';
import { notFound, errorHandler } from '../src/middleware/errorHandler.js';

function makeApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: config.corsOrigin, credentials: true }));
  app.use(express.json());
  app.get('/api/health', (_req, res) => res.json({ ok: true, app: config.appName, time: new Date().toISOString() }));
  app.get('/api/protected', authenticate, (_req, res) => res.json({ ok: true }));
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

let app;
beforeAll(() => { app = makeApp(); });

describe('smoke: /api/health', () => {
  it('200 + shape', async () => {
    const r = await request(app).get('/api/health');
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
    expect(typeof r.body.app).toBe('string');
    expect(typeof r.body.time).toBe('string');
  });

  it('headers: helmet + XContentTypeOptions', async () => {
    const r = await request(app).get('/api/health');
    expect(r.headers['x-content-type-options']).toBe('nosniff');
    // CORS مُفعَّل
    expect(r.headers).toHaveProperty('access-control-allow-credentials');
  });
});

describe('smoke: authenticate middleware', () => {
  it('401 بلا توكن', async () => {
    const r = await request(app).get('/api/protected');
    expect(r.status).toBe(401);
    expect(r.body.ok).toBe(false);
  });

  it('401 مع Bearer غير صحيح', async () => {
    const r = await request(app)
      .get('/api/protected')
      .set('Authorization', 'Bearer not-a-real-token');
    expect(r.status).toBe(401);
  });
});

describe('smoke: 404 on unknown route', () => {
  it('returns JSON error', async () => {
    const r = await request(app).get('/api/does-not-exist');
    expect(r.status).toBe(404);
    expect(r.body.ok).toBe(false);
  });
});
