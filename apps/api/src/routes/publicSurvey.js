import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

// تهريب HTML لمنع هجمات XSS في النماذج العامة
function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const TARGET_LABELS = {
  BENEFICIARY: 'المستفيدين',
  DONOR: 'المتبرعين',
  VOLUNTEER: 'المتطوعين',
  EMPLOYEE: 'الموظفين',
  PARTNER: 'الشركاء',
};

// GET /survey/:id — render public survey form
router.get('/:id', asyncHandler(async (req, res) => {
  const s = await prisma.survey.findUnique({ where: { id: req.params.id } });
  if (!s) return res.status(404).send(errorPage('الاستبيان غير موجود'));
  if (!s.active) return res.status(410).send(errorPage('هذا الاستبيان مغلق حالياً'));

  const rawQuestions = JSON.parse(s.questionsJson || '[]');
  const questions = rawQuestions.map((q, i) => normalizeQuestion(q, i));
  res.send(formPage(s, questions));
}));

// POST /survey/:id — submit response
router.post('/:id', asyncHandler(async (req, res) => {
  const s = await prisma.survey.findUnique({ where: { id: req.params.id } });
  if (!s) return res.status(404).send(errorPage('الاستبيان غير موجود'));
  if (!s.active) return res.status(410).send(errorPage('هذا الاستبيان مغلق حالياً'));

  const rawQuestions = JSON.parse(s.questionsJson || '[]');
  const questions = rawQuestions.map((q, i) => normalizeQuestion(q, i));
  // resultsJson قد يكون مصفوفة (الشكل الجديد) أو object (seed قديم avgByQ/topFeedback) — نطبّعه إلى مصفوفة
  let existing;
  try {
    const parsed = JSON.parse(s.resultsJson || '[]');
    existing = Array.isArray(parsed) ? parsed : [];
  } catch { existing = []; }

  // منع التكرار البسيط: نفس IP+UA خلال آخر ساعة → رفض
  const ipKey = (req.ip || '') + '|' + (req.headers['user-agent'] || '');
  const ONE_HOUR = 60 * 60 * 1000;
  const now = Date.now();
  const dup = existing.find(r => r._idHash === ipKey && (now - new Date(r.at).getTime()) < ONE_HOUR);
  if (dup) return res.status(429).send(errorPage('لا يمكنك إرسال الاستبيان أكثر من مرّة خلال ساعة واحدة'));

  // Build answers object from body
  const answers = {};
  const missing = [];
  let ratingSum = 0;
  let ratingCount = 0;
  for (const q of questions) {
    const v = req.body[q.key];
    const isEmpty = v === undefined || v === '' || v === null;
    if (isEmpty) {
      if (q.required) missing.push(q.label);
      continue;
    }
    if (q.type === 'rating') {
      const n = Math.max(1, Math.min(5, Number(v) || 0));
      answers[q.key] = n;
      ratingSum += n;
      ratingCount++;
    } else if (q.type === 'yesno') {
      answers[q.key] = v === 'yes' || v === 'نعم' ? 'yes' : 'no';
    } else {
      answers[q.key] = String(v).trim().slice(0, 5000);
    }
  }
  if (missing.length) {
    return res.status(400).send(errorPage('يرجى الإجابة عن الأسئلة المطلوبة: ' + missing.join(' · ')));
  }

  const response = {
    at: new Date().toISOString(),
    respondentName: (req.body.respondentName || '').toString().trim().slice(0, 100) || null,
    answers,
    _idHash: ipKey,  // لكشف التكرار فقط (لا يُعرض)
  };
  // ═══ كتابة ذرّية — إصلاح lost-update لسباقات التزامن ═══
  // نُعيد قراءة resultsJson داخل معاملة، نلحق الرد، ثم نكتب. يُقلّص نافذة الكتابات الضائعة.
  // ملاحظة: الحل الكامل يتطلب جدول SurveyResponse منفصل (ديْن تقني مسجَّل).
  await prisma.$transaction(async (tx) => {
    const fresh = await tx.survey.findUnique({ where: { id: s.id } });
    let freshArr;
    try {
      const parsed = JSON.parse(fresh.resultsJson || '[]');
      freshArr = Array.isArray(parsed) ? parsed : [];
    } catch { freshArr = []; }
    freshArr.push(response);

    let totalRatingSum = 0, totalRatingCount = 0;
    for (const r of freshArr) {
      for (const q of questions) {
        if (q.type === 'rating' && Number.isFinite(Number(r.answers?.[q.key]))) {
          totalRatingSum += Number(r.answers[q.key]);
          totalRatingCount++;
        }
      }
    }
    const avgScore = totalRatingCount > 0 ? Math.round((totalRatingSum / totalRatingCount) * 100) / 100 : null;

    await tx.survey.update({
      where: { id: s.id },
      data: {
        resultsJson: JSON.stringify(freshArr),
        responses: freshArr.length,
        avgScore,
      },
    });
  });

  res.send(successPage(s));
}));

// ─── HTML templates ────────────────────────────────────────────────────────

const baseStyle = `
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Segoe UI',Tahoma,Arial,sans-serif;background:#eff8fe;direction:rtl;color:#1a1a1a;min-height:100vh;display:flex;flex-direction:column;align-items:center;padding:20px 10px}
    .card{background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,.08);width:100%;max-width:640px;overflow:hidden}
    .header{background:linear-gradient(135deg,#1e40af,#3b82f6);color:#fff;padding:24px 28px}
    .header h1{font-size:1.3rem;margin-bottom:4px}
    .header p{opacity:.9;font-size:.9rem}
    .body{padding:24px 28px}
    .question{background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:10px;padding:14px;margin-bottom:12px}
    .qlabel{font-weight:600;margin-bottom:10px;color:#1e293b;font-size:.95rem}
    .rating{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}
    .rating label{cursor:pointer;padding:10px 14px;border:1.5px solid #cbd5e1;border-radius:8px;background:#fff;font-weight:600;transition:.15s}
    .rating input{display:none}
    .rating label:has(input:checked){background:#3b82f6;color:#fff;border-color:#3b82f6}
    textarea,input[type=text]{width:100%;border:1.5px solid #cbd5e1;border-radius:8px;padding:10px 12px;font-size:.95rem;font-family:inherit;direction:rtl}
    textarea:focus,input:focus{outline:none;border-color:#3b82f6}
    .yesno{display:flex;gap:10px}
    .yesno label{flex:1;text-align:center;padding:10px;border:1.5px solid #cbd5e1;border-radius:8px;cursor:pointer;font-weight:600}
    .yesno input{display:none}
    .yesno label:has(input:checked){background:#3b82f6;color:#fff;border-color:#3b82f6}
    .submit-btn{width:100%;background:#1e40af;color:#fff;border:none;padding:14px;border-radius:10px;font-size:1rem;font-weight:700;cursor:pointer;margin-top:8px}
    .submit-btn:hover{background:#1e3a8a}
    .footer{text-align:center;font-size:.75rem;color:#9ca3af;padding:16px;border-top:1px solid #f3f4f6}
    .field-group{margin-bottom:16px}
    label.field-lbl{display:block;font-weight:600;margin-bottom:6px;font-size:.9rem;color:#374151}
    .icon{font-size:3rem;margin-bottom:12px}
  </style>
`;

// تطبيع شكل السؤال — يدعم المفاتيح القديمة (id/text/RATING) والجديدة (key/label/rating)
function normalizeQuestion(raw, idx) {
  return {
    key: String(raw.key || raw.id || `q${idx + 1}`),
    label: String(raw.label || raw.text || raw.question || raw.title || ''),
    type: String(raw.type || 'text').toLowerCase(),
    required: !!raw.required,
  };
}

function renderQuestion(raw, idx) {
  const q = normalizeQuestion(raw, idx);
  const label = escapeHtml(q.label) || `سؤال ${idx + 1}`;
  const key   = escapeHtml(q.key);
  const req   = q.required ? '<span style="color:#dc2626;font-weight:700" title="إجباري">*</span>' : '';
  const reqAttr = q.required ? 'required' : '';
  if (q.type === 'rating') {
    const scale = [1, 2, 3, 4, 5];
    return `<div class="question">
      <div class="qlabel">${label} ${req}</div>
      <div class="rating">
        ${scale.map(n => `<label><input type="radio" name="${key}" value="${n}" ${reqAttr && n===1 ? 'required' : ''}><span>${'⭐'.repeat(n)} ${n}</span></label>`).join('')}
      </div>
    </div>`;
  }
  if (q.type === 'yesno') {
    return `<div class="question">
      <div class="qlabel">${label} ${req}</div>
      <div class="yesno">
        <label><input type="radio" name="${key}" value="yes" ${reqAttr}>✅ نعم</label>
        <label><input type="radio" name="${key}" value="no">❌ لا</label>
      </div>
    </div>`;
  }
  return `<div class="question">
    <div class="qlabel">${label} ${req}</div>
    <textarea name="${key}" rows="3" maxlength="5000" placeholder="اكتب إجابتك..." ${reqAttr}
      oninput="this.nextElementSibling.textContent = this.value.length + ' / 5000 حرفاً'"></textarea>
    <div style="text-align:left;font-size:.7rem;color:#9ca3af;margin-top:2px">0 / 5000 حرفاً</div>
  </div>`;
}

function formPage(s, questions) {
  const target = escapeHtml(TARGET_LABELS[s.target] || s.target);
  const title  = escapeHtml(s.title);
  const period = escapeHtml(s.period || '');
  return `<!DOCTYPE html><html lang="ar" dir="rtl"><head>${baseStyle}
    <title>${title}</title></head>
  <body>
    <div class="card">
      <div class="header">
        <div style="font-size:.8rem;opacity:.85;margin-bottom:4px">جمعية البر بصبيا — استبيان</div>
        <h1>📋 ${title}</h1>
        <p>الفئة المستهدفة: ${target}${period ? ` · ${period}` : ''}</p>
      </div>
      <div class="body">
        <form method="POST">
          <div class="field-group">
            <label class="field-lbl">اسمك (اختياري)</label>
            <input type="text" name="respondentName" placeholder="يمكنك ترك الاسم فارغاً">
          </div>
          ${questions.map((q, i) => renderQuestion(q, i)).join('')}
          <button type="submit" class="submit-btn">💾 إرسال الاستبيان</button>
        </form>
      </div>
      <div class="footer">شكراً لمشاركتك — رأيك يهمنا لتحسين خدماتنا</div>
    </div>
  </body></html>`;
}

function successPage(s) {
  const title = escapeHtml(s.title);
  return `<!DOCTYPE html><html lang="ar" dir="rtl"><head>${baseStyle}
    <title>تم الإرسال</title></head>
  <body>
    <div class="card">
      <div class="header">
        <h1>✅ شكراً لك!</h1>
        <p>${title}</p>
      </div>
      <div class="body" style="text-align:center;padding:40px 28px">
        <div class="icon">🙏</div>
        <div style="font-size:1.2rem;font-weight:700;color:#166534;margin-bottom:8px">تم استلام مشاركتك بنجاح</div>
        <p style="color:#6b7280">رأيك سيُسهم في تحسين خدمات الجمعية.</p>
        <p style="margin-top:20px;color:#9ca3af;font-size:.85rem">يمكنك إغلاق هذه الصفحة الآن</p>
      </div>
      <div class="footer">جمعية البر بصبيا — نظام إدارة الجودة</div>
    </div>
  </body></html>`;
}

function errorPage(msg) {
  const safeMsg = escapeHtml(msg);
  return `<!DOCTYPE html><html lang="ar" dir="rtl"><head>${baseStyle}
    <title>خطأ</title></head>
  <body>
    <div class="card">
      <div class="header" style="background:linear-gradient(135deg,#991b1b,#dc2626)">
        <h1>❌ ${safeMsg}</h1>
      </div>
      <div class="body" style="text-align:center;padding:40px 28px">
        <div class="icon">📋</div>
        <p style="color:#6b7280">تواصل مع الجمعية للاستفسار.</p>
      </div>
    </div>
  </body></html>`;
}

export default router;
