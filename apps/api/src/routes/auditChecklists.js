/**
 * auditChecklists.js — قوالب التدقيق القابلة لإعادة الاستخدام
 * ISO 9001 §9.2 · P-12 §3.2
 */
import { Router } from 'express';
import { BadRequest } from '../utils/errors.js';
import { crudRouter } from '../utils/crudFactory.js';

function normalize(data) {
  // itemsJson يقبل أحد أربعة أشكال، ويخزَّن دائماً كسلسلة JSON لمصفوفة:
  //   1) مصفوفة كائنات {q, clause?, evidenceType?, critical?}
  //   2) سلسلة JSON لمصفوفة كائنات
  //   3) مصفوفة نصوص — كل نص يُرفع إلى {q}
  //   4) نص عادي متعدد الأسطر — كل سطر سؤال مستقل (UX سهل للمدقق)
  const raw = data.itemsJson;
  if (raw === undefined || raw === null || raw === '') return data;

  const toItem = (v) => {
    if (typeof v === 'string') {
      const q = v.trim();
      return q ? { q } : null;
    }
    if (v && typeof v === 'object' && typeof v.q === 'string' && v.q.trim()) {
      return {
        q:            v.q.trim(),
        clause:       v.clause       || '',
        evidenceType: v.evidenceType || '',
        critical:     Boolean(v.critical),
      };
    }
    return null;
  };

  let items;
  if (Array.isArray(raw)) {
    items = raw;
  } else if (typeof raw === 'string') {
    const s = raw.trim();
    if (s.startsWith('[')) {
      try { items = JSON.parse(s); }
      catch { throw BadRequest('itemsJson: مصفوفة JSON غير صالحة'); }
    } else {
      // نص حر متعدد الأسطر — كل سطر سؤال
      items = s.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    }
  } else {
    throw BadRequest('itemsJson يجب أن يكون مصفوفة أو نصاً');
  }

  if (!Array.isArray(items)) throw BadRequest('itemsJson يجب أن يكون مصفوفة');
  const cleaned = items.map(toItem).filter(Boolean);
  if (cleaned.length === 0) {
    throw BadRequest('itemsJson: أضِف سؤالاً واحداً على الأقل');
  }
  data.itemsJson = JSON.stringify(cleaned);
  return data;
}

const base = crudRouter({
  resource: 'audit-checklists',
  model: 'auditChecklistTemplate',
  codePrefix: 'CHK',
  searchFields: ['title', 'description', 'isoClauses'],
  allowedSortFields: ['createdAt', 'title'],
  allowedFilters: ['active'],
  beforeCreate: async (d) => normalize(d),
  beforeUpdate: async (d) => normalize(d),
});

const router = Router();
router.use('/', base);
export default router;
