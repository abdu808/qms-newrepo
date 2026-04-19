/**
 * normalize.js — Arabic text normalization for search.
 *
 * Problem: Users type "احمد" but the DB stores "أحمد". Raw `contains` misses it.
 * Arabic also has multiple forms of the same letter (hamza variants, alef maqsura,
 * taa marbuta vs haa, tatweel, tashkeel/diacritics).
 *
 * This helper canonicalizes a string so variants converge to one form:
 *   - alef hamza variants → bare alef:  أ إ آ ٱ  → ا
 *   - alef maqsura      → yaa:          ى       → ي
 *   - taa marbuta       → haa:          ة       → ه
 *   - hamza-on-yaa/waw  → plain letter: ئ ؤ     → ي و
 *   - tatweel removed:                  ـ
 *   - tashkeel removed:                 U+064B..U+0652
 *
 * Usage:
 *   - Normalize USER input at query time.
 *   - Expand query into variants so we match DB content in any form.
 *   - Future (Phase 2): add a computed `nameNorm` column at write time.
 */

const ARABIC_DIACRITICS = /[\u064B-\u0652\u0670\u0640]/g;   // tashkeel + tatweel

/**
 * Full canonicalization. Use on the USER's query string.
 */
export function normalizeArabic(s) {
  if (!s) return '';
  return String(s)
    .replace(ARABIC_DIACRITICS, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ئ/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ة/g, 'ه')
    .trim();
}

/**
 * Generate a small set of likely DB-side variants for a query.
 * Since we cannot normalize DB content on the fly without a schema change,
 * we expand the query into the most common stored forms and OR them together.
 *
 * Kept intentionally small (≤6 variants) to avoid slow queries.
 */
export function arabicSearchVariants(q) {
  const base = normalizeArabic(q);
  if (!base) return [];
  const variants = new Set([base, q.trim()]);

  // alef alternatives — try bare and hamza'd
  if (/ا/.test(base)) {
    variants.add(base.replace(/ا/g, 'أ'));
    variants.add(base.replace(/ا/g, 'إ'));
  }
  // yaa ↔ alef maqsura at end of word
  if (base.endsWith('ي')) variants.add(base.slice(0, -1) + 'ى');
  // haa ↔ taa marbuta at end of word
  if (base.endsWith('ه')) variants.add(base.slice(0, -1) + 'ة');

  return [...variants].slice(0, 6);
}
