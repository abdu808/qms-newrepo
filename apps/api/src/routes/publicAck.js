/**
 * publicAck.js — إقرار عام بالرابط (بدون مصادقة)
 * يُستخدم لإرسال روابط إقرار شخصية للأعضاء/الموظفين/المستفيدين/الموردين عبر واتساب/SMS/بريد
 */
import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { BadRequest, NotFound } from '../utils/errors.js';

const router = Router();

function escapeHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

/**
 * GET /ack/:token — صفحة الإقرار العامة (HTML)
 */
router.get('/:token', asyncHandler(async (req, res) => {
  const t = await prisma.ackToken.findUnique({
    where: { token: req.params.token },
    include: {
      document: true,
      user: { select: { name: true, email: true, role: true } },
    },
  });
  if (!t) return res.status(404).type('html').send(errorPage('رابط غير صحيح أو منتهي الصلاحية'));
  if (t.expiresAt && t.expiresAt < new Date()) {
    return res.status(410).type('html').send(errorPage('انتهت صلاحية هذا الرابط'));
  }

  // إذا استُخدم مسبقاً، اعرض شاشة التأكيد
  if (t.usedAt) {
    return res.type('html').send(alreadyPage(t));
  }

  const doc = t.document;
  if (!doc || !doc.active) {
    return res.status(410).type('html').send(errorPage('الوثيقة غير متاحة حالياً'));
  }
  if (doc.version !== t.documentVersion) {
    return res.status(410).type('html').send(errorPage('تم تحديث الوثيقة — اطلب رابطاً جديداً'));
  }

  const who = t.user?.name || t.externalName || 'المُخاطَب';

  res.type('html').send(`<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>إقرار — ${escapeHtml(doc.title)}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
  <style>
    body { font-family: 'Segoe UI', Tahoma, sans-serif; background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); }
    .prose h1,.prose h2,.prose h3 { font-weight: 700; margin: 1em 0 0.5em; color: #1e3a8a; }
    .prose h1 { font-size: 1.6rem; } .prose h2 { font-size: 1.3rem; } .prose h3 { font-size: 1.1rem; }
    .prose p, .prose li { line-height: 1.85; color: #334155; margin: 0.6em 0; }
    .prose ul { padding-right: 1.5em; list-style: disc; }
    .prose ol { padding-right: 1.5em; list-style: decimal; }
    .prose strong { color: #0f172a; }
  </style>
</head>
<body class="min-h-screen p-4 md:p-8">
  <div class="max-w-3xl mx-auto">
    <div class="bg-gradient-to-l from-indigo-700 to-blue-600 text-white rounded-t-2xl p-6 shadow-xl">
      <div class="flex items-center gap-3 mb-2">
        <span class="text-3xl">📋</span>
        <div>
          <div class="text-xs uppercase tracking-wide opacity-80">إقرار واطّلاع</div>
          <h1 class="text-xl font-bold">${escapeHtml(doc.title)}</h1>
          <div class="text-sm opacity-90 mt-1">
            الرمز: <b>${escapeHtml(doc.code)}</b> · الإصدار: <b>${escapeHtml(doc.version)}</b>
          </div>
        </div>
      </div>
      <div class="mt-3 bg-white/20 rounded-lg px-3 py-2 text-sm">
        👤 المُخاطَب: <b>${escapeHtml(who)}</b>
        ${t.externalType ? `· الصفة: ${escapeHtml(t.externalType)}` : ''}
        ${t.user?.role ? `· الدور: ${escapeHtml(t.user.role)}` : ''}
      </div>
    </div>

    <div class="bg-white shadow-xl p-6 md:p-8">
      <div id="docContent" data-md="${escapeHtml(doc.content || '')}" class="prose max-w-none border border-gray-200 rounded-xl p-5 bg-gray-50/40 max-h-[60vh] overflow-y-auto"
           onscroll="onScroll(this)"></div>

      ${doc.commitments ? `
        <div class="mt-4 bg-amber-50 border border-amber-300 rounded-xl p-4">
          <div class="font-bold text-amber-900 mb-2">⚖️ التعهدات:</div>
          <div id="commitments" data-md="${escapeHtml(doc.commitments)}" class="prose max-w-none text-sm"></div>
        </div>
      ` : ''}

      <div id="scrollHint" class="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
        ⬇️ يرجى قراءة النص كاملاً حتى النهاية ليتم تفعيل زر الإقرار
      </div>

      <form id="ackForm" onsubmit="submitAck(event)" class="mt-6 space-y-4">
        <div class="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label class="text-xs font-semibold text-indigo-900">الاسم الكامل *</label>
              <input required name="fullName" value="${escapeHtml(who)}" class="w-full border-2 border-indigo-200 rounded-lg px-3 py-2 text-sm bg-white" />
            </div>
            <div>
              <label class="text-xs font-semibold text-indigo-900">رقم الهوية / الجوال (اختياري)</label>
              <input name="idOrPhone" placeholder="للتوثيق" class="w-full border-2 border-indigo-200 rounded-lg px-3 py-2 text-sm bg-white" />
            </div>
          </div>
        </div>

        <label class="flex items-start gap-3 cursor-pointer bg-white border-2 border-gray-200 rounded-xl p-4 hover:border-indigo-400">
          <input type="checkbox" id="agree" disabled class="mt-1 w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500" onchange="toggleSubmit()">
          <span class="text-sm text-gray-700 leading-relaxed">
            أُقرُّ بأنّي قرأت الوثيقة بالكامل، وفهمت مضمونها، وأوافق على الالتزام ببنودها.
            <br><span class="text-xs text-gray-500">سيُسجَّل هذا الإقرار مع الطابع الزمني وعنوان IP كدليل قانوني.</span>
          </span>
        </label>

        <button type="submit" id="submitBtn" disabled
          class="w-full bg-gradient-to-l from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl shadow-lg transition-all">
          ✅ تسجيل الإقرار
        </button>
      </form>
    </div>

    <div class="bg-gray-100 rounded-b-2xl px-6 py-3 text-xs text-gray-500 text-center">
      نظام إدارة الجودة · جمعية البر بصبيا
    </div>
  </div>

  <script>
    // رندر Markdown
    document.querySelectorAll('[data-md]').forEach(el => {
      el.innerHTML = marked.parse(el.getAttribute('data-md') || '');
    });

    let scrolledToEnd = false;
    function onScroll(el) {
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 10) {
        scrolledToEnd = true;
        document.getElementById('scrollHint').classList.add('hidden');
        document.getElementById('agree').disabled = false;
      }
    }
    // إذا كان المحتوى قصير ولا يحتاج scroll
    setTimeout(() => {
      const el = document.getElementById('docContent');
      if (el && el.scrollHeight <= el.clientHeight + 5) {
        scrolledToEnd = true;
        document.getElementById('scrollHint').classList.add('hidden');
        document.getElementById('agree').disabled = false;
      }
    }, 300);

    function toggleSubmit() {
      const agree = document.getElementById('agree').checked;
      document.getElementById('submitBtn').disabled = !(agree && scrolledToEnd);
    }

    async function submitAck(e) {
      e.preventDefault();
      const btn = document.getElementById('submitBtn');
      btn.disabled = true; btn.textContent = '… جاري الحفظ';
      const form = e.target;
      const data = {
        fullName: form.fullName.value.trim(),
        idOrPhone: form.idOrPhone.value.trim(),
      };
      try {
        const res = await fetch(location.pathname, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error?.message || 'تعذّر الحفظ');
        document.body.innerHTML = \`
          <div class="min-h-screen flex items-center justify-center p-6">
            <div class="max-w-lg w-full bg-white shadow-2xl rounded-2xl p-8 text-center">
              <div class="text-6xl mb-4">✅</div>
              <h2 class="text-2xl font-bold text-green-700 mb-2">تم تسجيل إقرارك بنجاح</h2>
              <p class="text-gray-600 mb-4">شكراً لك. تم توثيق إقرارك في نظام الجودة.</p>
              <div class="bg-gray-50 border rounded-xl p-4 text-right text-sm space-y-1">
                <div>الوثيقة: <b>\${${JSON.stringify(escapeHtml(doc.title))}}</b></div>
                <div>الإصدار: <b>\${${JSON.stringify(escapeHtml(doc.version))}}</b></div>
                <div>التاريخ: <b>\${new Date().toLocaleString('ar-SA')}</b></div>
                <div>المرجع: <code class="bg-white px-2 rounded text-xs">\${json.ack?.id || ''}</code></div>
              </div>
              <p class="text-xs text-gray-500 mt-6">يمكنك إغلاق هذه الصفحة</p>
            </div>
          </div>\`;
      } catch (err) {
        btn.disabled = false; btn.textContent = '✅ تسجيل الإقرار';
        alert(err.message);
      }
    }
  </script>
</body>
</html>`);
}));

/**
 * POST /ack/:token — تسجيل الإقرار
 */
router.post('/:token', asyncHandler(async (req, res) => {
  const t = await prisma.ackToken.findUnique({
    where: { token: req.params.token },
    include: { document: true },
  });
  if (!t) throw NotFound('رابط غير صحيح');
  if (t.expiresAt && t.expiresAt < new Date()) throw BadRequest('انتهت صلاحية الرابط');
  if (t.usedAt) throw BadRequest('تم استخدام هذا الرابط مسبقاً');
  if (!t.document?.active) throw BadRequest('الوثيقة غير متاحة');
  if (t.document.version !== t.documentVersion) throw BadRequest('تم تحديث الوثيقة — اطلب رابطاً جديداً');

  // Enforce length limits on public input to prevent bloat-DoS
  const trimLen = (v, max) => String(v ?? '').trim().slice(0, max);
  const fullName  = trimLen(req.body?.fullName, 120);
  const idOrPhone = trimLen(req.body?.idOrPhone, 60);
  if (!fullName) throw BadRequest('الاسم الكامل مطلوب');

  const ipAddress = req.ip;
  const userAgent = req.headers['user-agent'] || null;

  // ═══ استهلاك ذرّي للتوكن — إصلاح race condition ═══
  // نحاول "claim" التوكن بتحديث شرطي: ينجح مرّة واحدة فقط حتى لو وصلت طلبات متوازية.
  // ثم ننشئ الإقرار داخل نفس المعاملة؛ أيّ فشل يُسقط المعاملة ويعيد التوكن قابلاً للاستهلاك.
  try {
    const ack = await prisma.$transaction(async (tx) => {
      const claimed = await tx.ackToken.updateMany({
        where: { id: t.id, usedAt: null },
        data: { usedAt: new Date(), ipAddress, userAgent },
      });
      if (claimed.count === 0) {
        // سباق: طلب آخر استهلك التوكن قبلنا
        throw new Error('TOKEN_ALREADY_USED');
      }

      if (t.userId) {
        return await tx.acknowledgment.upsert({
          where: {
            ack_internal_unique: {
              documentId: t.documentId,
              documentVersion: t.documentVersion,
              userId: t.userId,
            },
          },
          update: { acknowledgedAt: new Date(), ipAddress, userAgent, method: 'DIGITAL',
                    notes: idOrPhone ? `تأكيد شخصي: ${idOrPhone}` : null },
          create: {
            documentId: t.documentId,
            documentVersion: t.documentVersion,
            userId: t.userId,
            ipAddress, userAgent,
            method: 'DIGITAL',
            notes: idOrPhone ? `تأكيد شخصي: ${idOrPhone}` : null,
          },
        });
      } else {
        return await tx.acknowledgment.create({
          data: {
            documentId: t.documentId,
            documentVersion: t.documentVersion,
            externalType: t.externalType || 'EXTERNAL',
            externalName: fullName,
            externalContact: t.externalContact || idOrPhone || null,
            ipAddress, userAgent,
            method: 'DIGITAL',
            notes: idOrPhone ? `رقم هوية/جوال مُدخَل: ${idOrPhone}` : null,
          },
        });
      }
    });

    res.status(201).json({ ok: true, ack: { id: ack.id, acknowledgedAt: ack.acknowledgedAt } });
  } catch (e) {
    if (e.message === 'TOKEN_ALREADY_USED') throw BadRequest('تم استخدام هذا الرابط مسبقاً');
    throw e;
  }
}));

// ── صفحات مساعدة ───────────────────────────────────────────
function errorPage(msg) {
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<title>خطأ</title><script src="https://cdn.tailwindcss.com"></script></head>
<body class="min-h-screen flex items-center justify-center bg-red-50 p-6">
<div class="max-w-md w-full bg-white shadow-xl rounded-2xl p-8 text-center">
  <div class="text-5xl mb-3">⚠️</div>
  <h1 class="text-xl font-bold text-red-700 mb-2">تعذّر عرض الإقرار</h1>
  <p class="text-gray-600">${escapeHtml(msg)}</p>
  <p class="text-xs text-gray-400 mt-4">يرجى التواصل مع إدارة الجمعية للحصول على رابط جديد</p>
</div></body></html>`;
}

function alreadyPage(t) {
  const when = t.usedAt ? new Date(t.usedAt).toLocaleString('ar-SA') : '';
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<title>تم الإقرار مسبقاً</title><script src="https://cdn.tailwindcss.com"></script></head>
<body class="min-h-screen flex items-center justify-center bg-green-50 p-6">
<div class="max-w-md w-full bg-white shadow-xl rounded-2xl p-8 text-center">
  <div class="text-6xl mb-3">✅</div>
  <h1 class="text-xl font-bold text-green-700 mb-2">تمّ تسجيل إقرارك مسبقاً</h1>
  <p class="text-gray-600">تاريخ الإقرار: <b>${escapeHtml(when)}</b></p>
  <p class="text-xs text-gray-400 mt-4">لا حاجة لتكرار العملية</p>
</div></body></html>`;
}

export default router;
