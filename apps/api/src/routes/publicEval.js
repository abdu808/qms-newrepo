import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { nextCode } from '../utils/codeGen.js';
import {
  getSupplierCriteria, SUPPLIER_TYPE_LABELS, COMMON_SUPPLIER_CRITERIA,
  computeSupplierEval, recomputeSupplierRating,
} from '../lib/evalEngine.js';

const router = Router();

// aliases لمحافظة الأسماء القديمة داخل هذا الملف
const TYPE_LABELS   = SUPPLIER_TYPE_LABELS;
const getCriteria   = getSupplierCriteria;

// تهريب HTML لمنع هجمات XSS في النماذج العامة
function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ملاحظة: المعايير + تصنيف الدرجات تُستورد الآن من lib/evalEngine.js (Batch 12)
// هذا يوحّد المنطق بين التقييم الداخلي والخارجي.
const COMMON_CRITERIA = COMMON_SUPPLIER_CRITERIA;

// ملاحظة: scoreLabel القديم أُزيل — عرض المستوى النصي يتم داخل formPage (levelText في JS الصفحة).
// getCriteria/grade/decision — يُستوردان الآن من lib/evalEngine.js (Batch 12)

// GET /eval/:token
router.get('/:token', asyncHandler(async (req, res) => {
  const record = await prisma.evalToken.findUnique({
    where: { token: req.params.token },
    include: { supplier: true },
  });

  if (!record) return res.status(404).send(errorPage('الرابط غير صحيح أو منتهي الصلاحية'));
  if (record.usedAt) return res.send(usedPage(record.supplier));
  if (record.expiresAt < new Date()) return res.status(410).send(errorPage('انتهت صلاحية هذا الرابط'));

  const criteria = getCriteria(record.supplier.type);
  res.send(formPage(record, criteria));
}));

// POST /eval/:token
router.post('/:token', asyncHandler(async (req, res) => {
  const record = await prisma.evalToken.findUnique({
    where: { token: req.params.token },
    include: { supplier: true },
  });

  if (!record) return res.status(404).send(errorPage('الرابط غير صحيح'));
  if (record.usedAt) return res.send(usedPage(record.supplier));
  if (record.expiresAt < new Date()) return res.status(410).send(errorPage('انتهت صلاحية هذا الرابط'));

  // Trim + enforce length limits on free-text public input (prevent DB/UI bloat abuse)
  const trimLen = (v, max) => String(v ?? '').trim().slice(0, max);
  const evaluatorName = trimLen(req.body.evaluatorName, 120);
  const evaluatorOrg  = trimLen(req.body.evaluatorOrg, 200);
  const notes         = trimLen(req.body.notes, 2000);
  const recommendation = req.body.recommendation;
  if (!evaluatorName) {
    return res.status(400).send(errorPage('اسم المقيّم مطلوب لإثبات التقييم'));
  }
  const criteria = getCriteria(record.supplier.type);

  // تحقّق أنّ كل المعايير مُعبَّأة (null ≠ 0)
  const unanswered = criteria.filter(c => req.body[c.key] === undefined || req.body[c.key] === '');
  if (unanswered.length) {
    return res.status(400).send(errorPage('يرجى تقييم كل المعايير قبل الإرسال: ' + unanswered.map(c => c.label).join(' · ')));
  }

  // ═══ محرك التقييم الموحّد (Batch 12) ═══
  const computed = computeSupplierEval({
    supplierType: record.supplier.type,
    answers: req.body,
  });
  const totalScore     = computed.totalScore;
  const maxTotal       = computed.maxScore;
  const pctNorm        = computed.percentage;
  const criticalFailed = computed.criticalFailed;
  const finalDecision  = computed.decision;

  // توصية المقيّم النهائية (اختيارية — إن لم تُرسل تُستخدم الحسابية)
  const userRec = (recommendation || '').trim();
  const allowedRec = ['approved','conditional','rejected','watch'];
  const recommendationFinal = allowedRec.includes(userRec) ? userRec : null;

  const code = await nextCode('supplierEval', 'SEVAL');

  // criteriaJson يأتي من المحرك؛ نحقن الـ recommendation فيه
  const parsedJson = JSON.parse(computed.criteriaJson);
  const payload = {
    ...parsedJson,
    recommendation: recommendationFinal,
  };

  // ═══ استهلاك ذرّي للتوكن — إصلاح race condition ═══
  try {
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.evalToken.updateMany({
        where: { id: record.id, usedAt: null },
        data: {
          usedAt: new Date(),
          evaluatorName: evaluatorName || null,
          evaluatorOrg:  evaluatorOrg  || null,
          notes:         notes         || null,
        },
      });
      if (claimed.count === 0) throw new Error('TOKEN_ALREADY_USED');

      await tx.supplierEval.create({
        data: {
          code,
          supplierId:   record.supplierId,
          evalTokenId:  record.id,  // ربط فريد: يمنع تقييمين من نفس الرابط
          evaluatorId:  record.createdById,
          period:       `تقييم خارجي — ${evaluatorOrg || evaluatorName || 'مقيّم خارجي'}`,
          criteriaJson: JSON.stringify(payload),
          totalScore,
          maxScore:   maxTotal,
          percentage: pctNorm,
          grade:      computed.grade,
          decision:   finalDecision,
          notes:      notes || null,
        },
      });
    });

    // إعادة حساب overallRating بمتوسط مرجَّح حديثي (Batch 12 - نفس الحساب للمسارين)
    await recomputeSupplierRating(prisma, record.supplierId);
  } catch (e) {
    if (e.message === 'TOKEN_ALREADY_USED') return res.send(usedPage(record.supplier));
    throw e;
  }

  res.send(successPage(record.supplier, totalScore, maxTotal, pctNorm, computed.grade, finalDecision, criticalFailed));
}));

// ─── HTML Templates ────────────────────────────────────────────────────────────

const baseStyle = `
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Segoe UI',Tahoma,Arial,sans-serif;background:#f0f9f4;direction:rtl;color:#1a1a1a;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding:20px 10px}
    .card{background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,.08);width:100%;max-width:680px;overflow:hidden}
    .header{background:linear-gradient(135deg,#2e8b57,#3aab6f);color:#fff;padding:24px 28px}
    .header h1{font-size:1.3rem;margin-bottom:4px}
    .header p{opacity:.9;font-size:.9rem}
    .body{padding:24px 28px}
    label{display:block;font-weight:600;margin-bottom:6px;font-size:.9rem;color:#374151}
    input[type=text],textarea{width:100%;border:1.5px solid #d1d5db;border-radius:8px;padding:10px 12px;font-size:.95rem;font-family:inherit;direction:rtl}
    input:focus,textarea:focus{outline:none;border-color:#2e8b57}
    .criterion{background:#f8fffe;border:1.5px solid #d1fae5;border-radius:10px;padding:14px;margin-bottom:10px;transition:border-color .2s}
    .criterion.critical{border-color:#fca5a5;background:#fef7f7}
    .criterion-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;gap:8px;flex-wrap:wrap}
    .criterion-label{font-weight:600;font-size:.9rem;flex:1;min-width:0}
    .chip{font-size:.7rem;padding:2px 8px;border-radius:20px;white-space:nowrap}
    .chip-max{color:#6b7280;background:#e5f7ed}
    .chip-crit{color:#991b1b;background:#fee2e2;font-weight:700}
    .score-display{font-size:1.3rem;font-weight:700;color:#2e8b57;min-width:36px;text-align:center}
    .score-level{font-size:.75rem;color:#6b7280;min-height:14px;margin-top:4px;text-align:center}
    input[type=range]{width:100%;accent-color:#2e8b57;height:6px;cursor:pointer}
    .note-input{width:100%;border:1px solid #e5e7eb;border-radius:6px;padding:6px 10px;font-size:.8rem;font-family:inherit;direction:rtl;margin-top:8px;background:#fff}
    .submit-btn{width:100%;background:#2e8b57;color:#fff;border:none;padding:14px;border-radius:10px;font-size:1rem;font-weight:700;cursor:pointer;margin-top:8px;transition:background .2s}
    .submit-btn:hover{background:#236b43}
    .total-bar{background:#f0fdf4;border:2px solid #86efac;border-radius:12px;padding:16px;text-align:center;margin:16px 0}
    .total-score{font-size:2.5rem;font-weight:800;color:#2e8b57}
    .footer{text-align:center;font-size:.75rem;color:#9ca3af;padding:16px;border-top:1px solid #f3f4f6}
    .icon{font-size:2rem;margin-bottom:8px}
    .success-title{font-size:1.4rem;font-weight:700;color:#166534;margin-bottom:8px}
    .badge{display:inline-block;padding:4px 14px;border-radius:20px;font-weight:700;font-size:.95rem}
    .badge-green{background:#dcfce7;color:#166534}
    .badge-amber{background:#fef3c7;color:#92400e}
    .badge-red{background:#fee2e2;color:#991b1b}
    .field-group{margin-bottom:16px}
    .section-title{font-weight:700;margin:20px 0 10px;color:#374151;font-size:.95rem;border-bottom:1.5px solid #e5e7eb;padding-bottom:8px}
    .rec-options{display:grid;grid-template-columns:1fr 1fr;gap:8px}
    .rec-options label{display:flex;align-items:center;gap:8px;background:#f9fafb;padding:10px 12px;border:1.5px solid #e5e7eb;border-radius:8px;cursor:pointer;font-size:.85rem;margin:0}
    .rec-options input[type=radio]{accent-color:#2e8b57}
    .rec-options label:has(input:checked){background:#dcfce7;border-color:#2e8b57}
    .legend{background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:10px 12px;font-size:.78rem;color:#78350f;margin-bottom:14px;line-height:1.6}
    @media (max-width:500px){.rec-options{grid-template-columns:1fr}}
  </style>
`;

function formPage(record, criteria) {
  const sup       = record.supplier;
  const expDate   = escapeHtml(record.expiresAt.toLocaleDateString('ar-SA'));
  const typeLabel = escapeHtml(TYPE_LABELS[sup.type] || sup.type);
  const supName   = escapeHtml(sup.name);
  const supCode   = escapeHtml(sup.code);
  const maxTotal  = criteria.reduce((s, c) => s + c.max, 0);

  const renderCrit = (c) => `
    <div class="criterion ${c.critical ? 'critical' : ''}">
      <div class="criterion-header">
        <span class="criterion-label">${escapeHtml(c.label)}</span>
        <div style="display:flex;gap:4px">
          ${c.critical ? '<span class="chip chip-crit">⚠️ معيار حرج</span>' : ''}
          <span class="chip chip-max">من ${c.max}</span>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:12px">
        <input type="range" name="${c.key}" min="0" max="${c.max}" value="0"
          data-max="${c.max}"
          oninput="updateCriterion(this)">
        <span class="score-display">0</span>
      </div>
      <div class="score-level"></div>
      <input type="text" class="note-input" name="${c.key}_note" maxlength="300"
        placeholder="ملاحظة (اختياري) — سبب الدرجة أو اقتراح تحسين...">
    </div>
  `;

  // افصل المعايير الأساسية عن المشتركة
  const coreCount = criteria.length - COMMON_CRITERIA.length;
  const coreHtml = criteria.slice(0, coreCount).map(renderCrit).join('');
  const commonHtml = criteria.slice(coreCount).map(renderCrit).join('');

  return `<!DOCTYPE html><html lang="ar" dir="rtl"><head>${baseStyle}
    <title>تقييم المورد — ${supName}</title></head>
  <body>
    <div class="card">
      <div class="header">
        <div style="font-size:.8rem;opacity:.85;margin-bottom:4px">نظام إدارة الجودة — جمعية البر بصبيا</div>
        <h1>📋 نموذج تقييم المورد</h1>
        <p>${supCode} — ${supName}</p>
        <p style="margin-top:4px;font-size:.8rem;opacity:.85">📦 نوع المورد: ${typeLabel}</p>
        <p style="margin-top:2px;font-size:.8rem;opacity:.75">⏳ الرابط صالح حتى ${expDate}</p>
      </div>
      <div class="body">
        <form method="POST">
          <div class="field-group">
            <label>اسمك الكامل *</label>
            <input type="text" name="evaluatorName" required placeholder="أدخل اسمك">
          </div>
          <div class="field-group">
            <label>جهتك / شركتك</label>
            <input type="text" name="evaluatorOrg" placeholder="اسم الجهة أو الشركة (اختياري)">
          </div>

          <div class="legend">
            💡 <strong>دليل التقييم:</strong>
            <div>• ممتاز (90%+) — يتجاوز التوقعات &nbsp; • جيد جداً (75%+) — مطابق</div>
            <div>• مقبول (60%+) — مع ملاحظات &nbsp; • ضعيف — يحتاج تحسين</div>
            <div style="margin-top:4px;color:#991b1b">⚠️ المعايير الحرجة: فشلها (أقل من 50%) يؤدي لرفض المورد تلقائياً</div>
          </div>

          <div class="section-title">⭐ المعايير الأساسية</div>
          ${coreHtml}

          <div class="section-title">🤝 معايير الامتثال والاستدامة (مشتركة)</div>
          ${commonHtml}

          <div class="total-bar">
            <div style="font-size:.85rem;color:#6b7280;margin-bottom:4px">المجموع الكلي</div>
            <div class="total-score" id="totalDisplay">0</div>
            <div style="font-size:.8rem;color:#6b7280">من ${maxTotal} نقطة (نسبة: <span id="pctDisplay">0</span>%)</div>
          </div>

          <div class="section-title">🎯 توصيتك النهائية</div>
          <div class="rec-options">
            <label><input type="radio" name="recommendation" value="approved"> ✅ معتمد</label>
            <label><input type="radio" name="recommendation" value="conditional"> ⚠️ معتمد مشروط</label>
            <label><input type="radio" name="recommendation" value="watch"> 🔄 قيد المراقبة</label>
            <label><input type="radio" name="recommendation" value="rejected"> ❌ غير معتمد</label>
          </div>

          <div class="field-group" style="margin-top:16px">
            <label>ملاحظات عامة وتوصيات للتحسين</label>
            <textarea name="notes" rows="3" placeholder="أي ملاحظات تتعلق بالمورد أو اقتراحات للتحسين..."></textarea>
          </div>

          <button type="submit" class="submit-btn">💾 إرسال التقييم</button>
        </form>
      </div>
      <div class="footer">هذا الرابط للاستخدام مرة واحدة فقط — وفقاً لمتطلبات ISO 9001:2015 بند 8.4</div>
    </div>

    <script>
      const maxTotal = ${maxTotal};
      function levelText(score, max){
        if(max===0) return '';
        const p=(score/max)*100;
        if(p>=90) return 'ممتاز ويتجاوز التوقعات';
        if(p>=75) return 'جيد جداً ومطابق';
        if(p>=60) return 'مقبول مع ملاحظات';
        if(p>=40) return 'ضعيف يحتاج تحسين';
        if(p>0)   return 'غير مقبول';
        return '';
      }
      function updateCriterion(r){
        const disp=r.nextElementSibling;
        const lvl=r.parentElement.nextElementSibling;
        disp.textContent=r.value;
        lvl.textContent=levelText(Number(r.value), Number(r.dataset.max));
        updateTotal();
      }
      function updateTotal(){
        let t=0;
        document.querySelectorAll('input[type=range]').forEach(r=>t+=Number(r.value));
        document.getElementById('totalDisplay').textContent=t;
        document.getElementById('pctDisplay').textContent=maxTotal?Math.round((t/maxTotal)*100):0;
      }
    </script>
  </body></html>`;
}

function successPage(sup, score, maxScore, pct, gradeStr, decisionStr, criticalFailed) {
  const color       = criticalFailed ? 'badge-red' : (pct >= 80 ? 'badge-green' : pct >= 60 ? 'badge-amber' : 'badge-red');
  const supName     = escapeHtml(sup.name);
  const supCode     = escapeHtml(sup.code);
  const safeGrade   = escapeHtml(gradeStr);
  const safeDecision= escapeHtml(decisionStr);
  return `<!DOCTYPE html><html lang="ar" dir="rtl"><head>${baseStyle}
    <title>تم الإرسال بنجاح</title></head>
  <body>
    <div class="card">
      <div class="header">
        <div style="font-size:.8rem;opacity:.85;margin-bottom:4px">نظام إدارة الجودة — جمعية البر بصبيا</div>
        <h1>✅ تم استلام تقييمك</h1>
        <p>${supCode} — ${supName}</p>
      </div>
      <div class="body" style="text-align:center;padding:40px 28px">
        <div class="icon">🎉</div>
        <div class="success-title">شكراً لك!</div>
        <p style="color:#6b7280;margin-bottom:24px">تم حفظ تقييمك بنجاح وإرساله لفريق الجودة</p>
        <div class="total-bar">
          <div style="font-size:.85rem;color:#6b7280;margin-bottom:4px">نتيجتك</div>
          <div class="total-score">${score}/${maxScore}</div>
          <div style="font-size:.8rem;color:#6b7280;margin-top:4px">النسبة المئوية: ${pct}%</div>
        </div>
        ${criticalFailed ? '<div style="background:#fee2e2;color:#991b1b;padding:10px;border-radius:8px;margin-bottom:12px;font-size:.85rem">⚠️ تم رصد فشل في معيار حرج</div>' : ''}
        <div style="margin-top:8px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
          <span class="badge ${color}">${safeGrade}</span>
          <span class="badge ${color}">${safeDecision}</span>
        </div>
        <p style="margin-top:24px;color:#9ca3af;font-size:.85rem">يمكنك إغلاق هذه الصفحة الآن</p>
      </div>
      <div class="footer">نظام إدارة الجودة — جمعية البر بصبيا</div>
    </div>
  </body></html>`;
}

function usedPage(sup) {
  const supName = escapeHtml(sup.name);
  return `<!DOCTYPE html><html lang="ar" dir="rtl"><head>${baseStyle}
    <title>تم الإرسال مسبقاً</title></head>
  <body>
    <div class="card">
      <div class="header" style="background:linear-gradient(135deg,#92400e,#b45309)">
        <h1>⚠️ تم استخدام هذا الرابط</h1>
        <p>${supName}</p>
      </div>
      <div class="body" style="text-align:center;padding:40px 28px">
        <div class="icon">🔒</div>
        <div style="font-size:1.1rem;font-weight:600;color:#92400e;margin-bottom:12px">تم تقديم التقييم مسبقاً</div>
        <p style="color:#6b7280">كل رابط يُستخدم مرة واحدة فقط.<br>تواصل مع الجهة المُرسِلة لرابط جديد إن لزم.</p>
      </div>
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
        <h1>❌ رابط غير صالح</h1>
      </div>
      <div class="body" style="text-align:center;padding:40px 28px">
        <div class="icon">🔗</div>
        <div style="font-size:1.1rem;font-weight:600;color:#991b1b;margin-bottom:12px">${safeMsg}</div>
        <p style="color:#6b7280">تواصل مع الجهة المُرسِلة للحصول على رابط صحيح.</p>
      </div>
    </div>
  </body></html>`;
}

export default router;
