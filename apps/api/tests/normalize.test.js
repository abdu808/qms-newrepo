/**
 * tests/normalize.test.js — تطبيع النصوص العربية للبحث.
 */
import { describe, it, expect } from 'vitest';
import { normalizeArabic, arabicSearchVariants } from '../src/utils/normalize.js';

describe('normalizeArabic', () => {
  it('unifies alef variants', () => {
    expect(normalizeArabic('أحمد')).toBe('احمد');
    expect(normalizeArabic('إبراهيم')).toBe('ابراهيم');
    expect(normalizeArabic('آمنة')).toBe('امنه');
  });

  it('strips tashkeel', () => {
    expect(normalizeArabic('مُحَمَّد')).toBe('محمد');
  });

  it('unifies yaa and taa marbuta', () => {
    expect(normalizeArabic('مصطفى')).toBe('مصطفي');
    expect(normalizeArabic('فاطمة')).toBe('فاطمه');
  });

  it('handles empty / null', () => {
    expect(normalizeArabic('')).toBe('');
    expect(normalizeArabic(null)).toBe('');
    expect(normalizeArabic(undefined)).toBe('');
  });
});

describe('arabicSearchVariants', () => {
  it('generates alef variants', () => {
    const v = arabicSearchVariants('احمد');
    expect(v).toContain('احمد');
    expect(v).toContain('أحمد');
    expect(v).toContain('إحمد');
  });

  it('generates taa-marbuta variant at end', () => {
    const v = arabicSearchVariants('فاطمه');
    expect(v.some(s => s.endsWith('ة'))).toBe(true);
  });

  it('returns empty for empty input', () => {
    expect(arabicSearchVariants('')).toEqual([]);
  });

  it('caps variants at 6', () => {
    const v = arabicSearchVariants('احمدي');
    expect(v.length).toBeLessThanOrEqual(6);
  });
});
