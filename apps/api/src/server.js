import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import { config } from './config.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';
import { authenticate, denyReadOnly } from './middleware/auth.js';
import { auditTrail } from './middleware/audit.js';

import authRoutes from './routes/auth.js';
import usersRoutes from './routes/users.js';
import deptsRoutes from './routes/departments.js';
import objectivesRoutes from './routes/objectives.js';
import risksRoutes from './routes/risks.js';
import complaintsRoutes from './routes/complaints.js';
import ncrRoutes from './routes/ncr.js';
import auditsRoutes from './routes/audits.js';
import suppliersRoutes from './routes/suppliers.js';
import supplierEvalsRoutes from './routes/supplierEvals.js';
import donationsRoutes from './routes/donations.js';
import donationEvalsRoutes from './routes/donationEvals.js';
import beneficiariesRoutes from './routes/beneficiaries.js';
import programsRoutes from './routes/programs.js';
import surveysRoutes from './routes/surveys.js';
import documentsRoutes from './routes/documents.js';
import trainingRoutes from './routes/training.js';
import signaturesRoutes from './routes/signatures.js';
import auditLogRoutes from './routes/auditLog.js';
import dashboardRoutes from './routes/dashboard.js';
import exportsRoutes from './routes/exports.js';
import strategicGoalsRoutes from './routes/strategicGoals.js';
import operationalActivitiesRoutes from './routes/operationalActivities.js';
import swotRoutes from './routes/swot.js';
import interestedPartiesRoutes from './routes/interestedParties.js';
import processesRoutes from './routes/processes.js';
import qualityPolicyRoutes from './routes/qualityPolicy.js';
import managementReviewRoutes from './routes/managementReview.js';
import competenceRoutes from './routes/competence.js';
import communicationRoutes from './routes/communication.js';
import isoReadinessRoutes from './routes/isoReadiness.js';
import evalTokensRoutes from './routes/evalTokens.js';
import reportsRoutes from './routes/reports.js';
import operationalReportsRoutes from './routes/operationalReports.js';
import kpiRoutes from './routes/kpi.js';
import publicEvalRoutes from './routes/publicEval.js';
import publicSurveyRoutes from './routes/publicSurvey.js';
import publicAckRoutes from './routes/publicAck.js';
import policyAckRoutes from './routes/policyAck.js';
import performanceReviewsRoutes from './routes/performanceReviews.js';
import improvementProjectsRoutes from './routes/improvementProjects.js';
import auditChecklistsRoutes from './routes/auditChecklists.js';
import notificationsRoutes from './routes/notifications.js';
import alertsRoutes from './routes/alerts.js';
import stateMachinesRoutes from './routes/stateMachines.js';
import ackDocumentsRoutes from './routes/ackDocuments.js';
import dataHealthRoutes from './routes/dataHealth.js';
import slaRoutes from './routes/sla.js';
import myWorkRoutes from './routes/myWork.js';
import schedulerRoutes from './routes/scheduler.js';
import reportBuilderRoutes from './routes/reportBuilder.js';
import { startScheduler } from './lib/scheduler.js';

const app = express();

app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan(config.env === 'production' ? 'combined' : 'dev'));

const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 500 });
app.use('/api/', apiLimiter);

// ═══ Rate limiters for PUBLIC token-based endpoints (no auth) ═══
// These endpoints must be defended against: token enumeration, DoS, survey flooding.
// Kept moderately permissive to allow legitimate retries, strict enough to block brute force.
const publicReadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,  // 4/min per IP — generous for retries but blocks enumeration
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'عدد كبير من الطلبات. حاول بعد قليل.' },
});
const publicSubmitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,  // 1 hour
  max: 10,  // 10 submissions/hour per IP — sufficient for family/office shared IPs
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'تم تجاوز الحد المسموح. حاول بعد ساعة.' },
});
// Smaller body limit for public endpoints — block bloat-DoS
const publicBodyLimit = express.json({ limit: '100kb' });
const publicUrlEncoded = express.urlencoded({ extended: true, limit: '100kb' });

// Anti-clickjacking + no-referrer leak on public pages
function publicSecurityHeaders(_req, res, next) {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
}

// ──────────────────────────────────────────────────────────────
// Slow-request observability — surfaces 1s+ endpoints in Logs
// so we spot latency regressions without an APM.
// ──────────────────────────────────────────────────────────────
const SLOW_REQUEST_MS = Number(process.env.SLOW_REQUEST_MS || 1000);
app.use((req, res, next) => {
  const t0 = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - t0;
    if (ms >= SLOW_REQUEST_MS && req.url.startsWith('/api/')) {
      console.warn(`[slow-req] ${req.method} ${req.url} ${ms}ms → ${res.statusCode}`);
    }
  });
  next();
});

// Health — shallow liveness (fast, used by Coolify/Cloudflare probes)
app.get('/api/health', (req, res) => {
  res.json({ ok: true, app: config.appName, time: new Date().toISOString() });
});

// Health — deep readiness. Verifies the DB actually responds.
// If this returns 503, Coolify's healthcheck should restart the container.
app.get('/api/health/ready', async (req, res) => {
  const t0 = Date.now();
  try {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [{ prisma }] = await Promise.all([import('./db.js')]);
    await prisma.$queryRawUnsafe('SELECT 1');
    res.json({ ok: true, db: 'ok', ms: Date.now() - t0, time: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({
      ok: false,
      db: 'error',
      error: err.message?.split('\n')[0] || 'unknown',
      ms: Date.now() - t0,
      time: new Date().toISOString(),
    });
  }
});

// الصفحة الأساسية '/' تخدم SPA مباشرة (لا إعادة توجيه إلى /login)
// الـ SPA يعرض شاشة تسجيل الدخول داخلياً إن لم يكن المستخدم مصادَقاً، ثم يعرض التطبيق.

// Public
app.use('/api/auth', authRoutes);

// Public evaluation form (no auth required — token-based)
app.use('/eval',
  publicSecurityHeaders,
  publicReadLimiter,
  publicBodyLimit,
  publicUrlEncoded,
  publicEvalRoutes,
);
// Public survey form (no auth required — open by survey ID)
// Uses stricter submit limiter since no token guards it.
app.use('/survey',
  publicSecurityHeaders,
  publicSubmitLimiter,
  publicBodyLimit,
  publicUrlEncoded,
  publicSurveyRoutes,
);
// Public acknowledgment page (token-based personal links sent via WhatsApp/SMS/email)
app.use('/ack',
  publicSecurityHeaders,
  publicReadLimiter,
  publicBodyLimit,
  publicUrlEncoded,
  publicAckRoutes,
);

// Authenticated
app.use('/api', authenticate, denyReadOnly, auditTrail());
app.use('/api/dashboard',     dashboardRoutes);
app.use('/api/users',         usersRoutes);
app.use('/api/departments',   deptsRoutes);
app.use('/api/objectives',    objectivesRoutes);
app.use('/api/risks',         risksRoutes);
app.use('/api/complaints',    complaintsRoutes);
app.use('/api/ncr',           ncrRoutes);
app.use('/api/audits',        auditsRoutes);
app.use('/api/suppliers',     suppliersRoutes);
app.use('/api/supplier-evals', supplierEvalsRoutes);
app.use('/api/donations',     donationsRoutes);
app.use('/api/donation-evals', donationEvalsRoutes);
app.use('/api/beneficiaries', beneficiariesRoutes);
app.use('/api/programs',      programsRoutes);
app.use('/api/surveys',       surveysRoutes);
app.use('/api/documents',     documentsRoutes);
app.use('/api/training',      trainingRoutes);
app.use('/api/signatures',    signaturesRoutes);
app.use('/api/audit-log',     auditLogRoutes);
app.use('/api/exports',                  exportsRoutes);
app.use('/api/strategic-goals',          strategicGoalsRoutes);
app.use('/api/operational-activities',   operationalActivitiesRoutes);
app.use('/api/swot',                     swotRoutes);
app.use('/api/interested-parties',       interestedPartiesRoutes);
app.use('/api/processes',                processesRoutes);
app.use('/api/quality-policy',           qualityPolicyRoutes);
app.use('/api/policy-ack',               policyAckRoutes);
app.use('/api/performance-reviews',      performanceReviewsRoutes);
app.use('/api/improvement-projects',     improvementProjectsRoutes);
app.use('/api/audit-checklists',         auditChecklistsRoutes);
app.use('/api/notifications',            notificationsRoutes);
app.use('/api/alerts',                   alertsRoutes);
app.use('/api/state-machines',           stateMachinesRoutes);
app.use('/api/ack-documents',            ackDocumentsRoutes);
app.use('/api/data-health',              dataHealthRoutes);
app.use('/api/sla',                       slaRoutes);
app.use('/api/my-work',                   myWorkRoutes);
app.use('/api/scheduler',                 schedulerRoutes);
app.use('/api/report-builder',            reportBuilderRoutes);
app.use('/api/management-review',        managementReviewRoutes);
app.use('/api/competence',               competenceRoutes);
app.use('/api/communication',            communicationRoutes);
app.use('/api/iso-readiness',            isoReadinessRoutes);
app.use('/api/eval-tokens',             evalTokensRoutes);
app.use('/api/reports',                 reportsRoutes);
app.use('/api/operational-reports',     operationalReportsRoutes);
app.use('/api/kpi',                     kpiRoutes);

// Serve frontend statically in development (for local testing)
if (config.env !== 'production') {
  const __dir = dirname(fileURLToPath(import.meta.url));
  const webPath = join(__dir, '..', '..', 'web', 'public');
  app.use(express.static(webPath, {
    setHeaders: (res, path) => {
      if (/\.(html|js|css)$/.test(path)) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      }
    },
  }));
  // الـ SPA يستخدم hash-routing (#/page) — كل المسارات غير API تُخدَم نفس index.html
  app.get(['/', '/login', '/app'], (req, res) => res.sendFile(join(webPath, 'index.html')));
  console.log(`[qms-api] serving frontend from ${webPath}`);
}

app.use(notFound);
app.use(errorHandler);

// Export the app for integration tests (supertest). In production this file
// is the main entry — it starts listening only when NOT imported as a module
// test (NODE_ENV='test' or QMS_NO_LISTEN='1' suppress listen).
export { app };

if (process.env.NODE_ENV !== 'test' && process.env.QMS_NO_LISTEN !== '1') {
  app.listen(config.port, () => {
    console.log(`[qms-api] listening on :${config.port} (${config.env})`);
    startScheduler();
  });
}
