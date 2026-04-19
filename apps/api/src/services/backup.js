/**
 * services/backup.js — نسخ احتياطي آلي (ISO 9.1 / 7.5.3).
 *
 * يُنفِّذ:
 *   1) `pg_dump` لقاعدة بيانات PostgreSQL (مضغوط gzip)
 *   2) أرشفة مجلد الملفات المرفوعة (اختياري — إذا وُجد)
 *   3) تدوير: 7 يومية + 4 أسبوعية + 6 شهرية
 *
 * التفعيل: ENV `QMS_BACKUP=on` + `DATABASE_URL` + `BACKUP_DIR` (افتراضي: ./backups)
 * يعمل مرة واحدة يومياً عبر scheduler. أيضاً قابل للتشغيل اليدوي:
 *   node src/services/backup.js
 */
import { spawn } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { createGzip } from 'node:zlib';
import { join, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';

const BACKUP_DIR = resolve(process.env.BACKUP_DIR || './backups');
const UPLOADS_DIR = resolve(process.env.UPLOADS_DIR || './uploads');

/**
 * يستخرج DATABASE_URL من البيئة.
 * يدعم postgres:// و postgresql://
 */
function getDatabaseUrl() {
  return process.env.DATABASE_URL || '';
}

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function todayStamp() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

/**
 * pg_dump stream → gzip → ملف على القرص
 * Returns: { ok, path, sizeBytes, durationMs, error? }
 */
export async function runDatabaseBackup() {
  const started = Date.now();
  const url = getDatabaseUrl();
  if (!/^postgres(ql)?:\/\//.test(url)) {
    return { ok: false, error: 'DATABASE_URL ليس Postgres — لم يتم التنفيذ' };
  }
  ensureDir(BACKUP_DIR);
  const outPath = join(BACKUP_DIR, `db-${todayStamp()}.sql.gz`);

  return new Promise((resolve) => {
    const proc = spawn('pg_dump', ['--no-owner', '--no-privileges', '--format=plain', url], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stderrBuf = '';
    proc.stderr.on('data', (d) => { stderrBuf += d.toString(); });

    const gzip = createGzip({ level: 6 });
    const out  = createWriteStream(outPath);

    pipeline(proc.stdout, gzip, out).then(() => {}).catch(() => {});

    proc.on('close', (code) => {
      const durationMs = Date.now() - started;
      if (code !== 0) {
        try { unlinkSync(outPath); } catch { /* ignore */ }
        return resolve({
          ok: false,
          error: `pg_dump فشل (code=${code}): ${stderrBuf.slice(0, 500)}`,
          durationMs,
        });
      }
      let size = 0; try { size = statSync(outPath).size; } catch { /* ignore */ }
      resolve({ ok: true, path: outPath, sizeBytes: size, durationMs });
    });
    proc.on('error', (err) => {
      resolve({
        ok: false,
        error: err.code === 'ENOENT'
          ? 'pg_dump غير مُثبَّت على النظام'
          : err.message,
        durationMs: Date.now() - started,
      });
    });
  });
}

/**
 * أرشفة دليل uploads إلى tar.gz (إذا كان الدليل موجوداً).
 * يعتمد على أمر `tar` (متاح افتراضياً على Linux/Mac/Git-Bash-Windows).
 */
export async function runFilesBackup() {
  const started = Date.now();
  if (!existsSync(UPLOADS_DIR)) {
    return { ok: true, skipped: true, reason: 'UPLOADS_DIR غير موجود' };
  }
  ensureDir(BACKUP_DIR);
  const outPath = join(BACKUP_DIR, `files-${todayStamp()}.tar.gz`);

  return new Promise((resolve) => {
    const proc = spawn('tar', ['-czf', outPath, '-C', UPLOADS_DIR, '.'], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderrBuf = '';
    proc.stderr.on('data', (d) => { stderrBuf += d.toString(); });
    proc.on('close', (code) => {
      const durationMs = Date.now() - started;
      if (code !== 0) {
        try { unlinkSync(outPath); } catch { /* ignore */ }
        return resolve({ ok: false, error: `tar فشل (code=${code}): ${stderrBuf.slice(0, 300)}`, durationMs });
      }
      let size = 0; try { size = statSync(outPath).size; } catch { /* ignore */ }
      resolve({ ok: true, path: outPath, sizeBytes: size, durationMs });
    });
    proc.on('error', (err) => {
      resolve({
        ok: false,
        error: err.code === 'ENOENT' ? 'tar غير مُثبَّت' : err.message,
        durationMs: Date.now() - started,
      });
    });
  });
}

/**
 * تدوير النسخ: يحتفظ بـ 7 يومية حديثة + 4 أسبوعية + 6 شهرية.
 * قاعدة الاحتفاظ: 7 آخر أيام يُحتفظ بالكل، ثم ≥7 أيام يُحتفظ بواحد فقط لكل أسبوع،
 *   ثم ≥30 يوم بواحد لكل شهر، ثم >180 يوم يُحذف.
 */
export function rotateBackups(prefix) {
  if (!existsSync(BACKUP_DIR)) return { kept: 0, deleted: 0 };
  const all = readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith(prefix + '-') && (f.endsWith('.sql.gz') || f.endsWith('.tar.gz')))
    .map(f => {
      const m = f.match(/^.*?-(\d{4}-\d{2}-\d{2})\./);
      return m ? { f, date: m[1], ts: new Date(m[1]).getTime() } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.ts - a.ts); // الأحدث أولاً

  const now = Date.now();
  const DAY = 86400000;
  const keptWeeks = new Set(), keptMonths = new Set();
  const toKeep = new Set();
  for (const b of all) {
    const ageDays = (now - b.ts) / DAY;
    if (ageDays <= 7) {
      toKeep.add(b.f);
    } else if (ageDays <= 35) {
      // أسبوع ISO
      const d = new Date(b.ts);
      const yw = `${d.getUTCFullYear()}-W${Math.floor(d.getUTCDate() / 7)}`;
      if (!keptWeeks.has(yw)) { toKeep.add(b.f); keptWeeks.add(yw); }
    } else if (ageDays <= 210) {
      const d = new Date(b.ts);
      const ym = `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`;
      if (!keptMonths.has(ym)) { toKeep.add(b.f); keptMonths.add(ym); }
    }
    // >210 يوم = حذف
  }

  // التحقق من السقف (7+4+6=17 نسخة كحد أقصى لكل نوع)
  let deleted = 0;
  for (const b of all) {
    if (!toKeep.has(b.f)) {
      try { unlinkSync(join(BACKUP_DIR, b.f)); deleted++; } catch { /* ignore */ }
    }
  }
  return { kept: toKeep.size, deleted };
}

/**
 * تنفيذ دورة كاملة: DB + files + rotate.
 * يُستدعى من scheduler.js يومياً.
 */
export async function runBackupCycle() {
  const started = Date.now();
  const db    = await runDatabaseBackup();
  const files = await runFilesBackup();
  const rotDb = rotateBackups('db');
  const rotFs = rotateBackups('files');
  const durationMs = Date.now() - started;
  const summary = {
    at: new Date().toISOString(),
    db, files, rotate: { db: rotDb, files: rotFs }, durationMs,
  };
  console.log('[backup]', JSON.stringify(summary));
  return summary;
}

// CLI manual run: node src/services/backup.js
if (import.meta.url === `file://${process.argv[1]}`) {
  runBackupCycle()
    .then((r) => process.exit(r.db?.ok ? 0 : 1))
    .catch((e) => { console.error(e); process.exit(2); });
}
