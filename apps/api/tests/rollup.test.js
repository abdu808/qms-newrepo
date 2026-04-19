/**
 * rollup.test.js — اختبارات وحدة لـ computeProgressFromEntries (الدالة الرياضية
 * الخالصة الموجودة في services/rollup.js). لا تلمس قاعدة البيانات.
 */
import { describe, it, expect } from 'vitest';
import { computeProgressFromEntries } from '../src/services/rollup.js';

const e = (month, actualValue, spent) => ({ month, actualValue, spent: spent ?? null });

describe('computeProgressFromEntries', () => {
  it('بدون قراءات → progress=0 و actual=null', () => {
    const r = computeProgressFromEntries({ kpiType: 'CUMULATIVE', target: 100 }, []);
    expect(r.progress).toBe(0);
    expect(r.actual).toBeNull();
  });

  it('بدون هدف صالح → progress=0', () => {
    const r = computeProgressFromEntries({ kpiType: 'CUMULATIVE', target: 0 }, [e(1, 50)]);
    expect(r.progress).toBe(0);
  });

  describe('CUMULATIVE (تراكمي)', () => {
    it('قراءتان يجمعان للمستهدف', () => {
      const r = computeProgressFromEntries(
        { kpiType: 'CUMULATIVE', target: 100, direction: 'HIGHER_BETTER' },
        [e(1, 30), e(2, 50)],
      );
      expect(r.actual).toBe(80);
      expect(r.progress).toBe(80);
    });

    it('تجاوز الهدف يُقصّ عند 100', () => {
      const r = computeProgressFromEntries(
        { kpiType: 'CUMULATIVE', target: 100 },
        [e(1, 70), e(2, 60)],
      );
      expect(r.actual).toBe(130);
      expect(r.progress).toBe(100);
    });
  });

  describe('PERIODIC (شهري مستقل)', () => {
    it('متوسط نسب التحقيق', () => {
      // كل شهر هدفه 100؛ قراءات: 100, 80, 60 → متوسط = 80
      const r = computeProgressFromEntries(
        { kpiType: 'PERIODIC', target: 100, direction: 'HIGHER_BETTER' },
        [e(1, 100), e(2, 80), e(3, 60)],
      );
      expect(r.actual).toBeCloseTo(80, 1);
      expect(r.progress).toBe(80);
    });
  });

  describe('SNAPSHOT (لحظي)', () => {
    it('آخر قراءة فقط تُعتمد', () => {
      const r = computeProgressFromEntries(
        { kpiType: 'SNAPSHOT', target: 100 },
        [e(1, 20), e(2, 60), e(3, 90)],
      );
      expect(r.actual).toBe(90);
      expect(r.progress).toBe(90);
    });
  });

  describe('direction = LOWER_BETTER (الأقل أفضل)', () => {
    it('قراءة أقل من الهدف → progress عالي', () => {
      // target=10 شكاوى شهرياً، وصلنا لـ 5 → progress=100 (ممتاز)
      const r = computeProgressFromEntries(
        { kpiType: 'SNAPSHOT', target: 10, direction: 'LOWER_BETTER' },
        [e(3, 5)],
      );
      expect(r.actual).toBe(5);
      expect(r.progress).toBe(100);
    });

    it('قراءة أعلى من الهدف → progress منخفض', () => {
      // target=10 لكن الشكاوى 20 → ratio=10/20=0.5 → 50%
      const r = computeProgressFromEntries(
        { kpiType: 'SNAPSHOT', target: 10, direction: 'LOWER_BETTER' },
        [e(3, 20)],
      );
      expect(r.actual).toBe(20);
      expect(r.progress).toBe(50);
    });
  });

  describe('BINARY (نعم/لا)', () => {
    it('قراءة ≥1 → progress=100', () => {
      const r = computeProgressFromEntries(
        { kpiType: 'BINARY', target: 1 },
        [e(6, 1)],
      );
      expect(r.progress).toBe(100);
    });
    it('كل القراءات صفر → progress=0', () => {
      const r = computeProgressFromEntries(
        { kpiType: 'BINARY', target: 1 },
        [e(3, 0), e(4, 0)],
      );
      expect(r.progress).toBe(0);
    });
  });

  it('clamp — قيم سالبة/عالية جداً → [0,100]', () => {
    const r = computeProgressFromEntries(
      { kpiType: 'CUMULATIVE', target: 10 },
      [e(1, 1000)],
    );
    expect(r.progress).toBe(100);
    expect(r.progress).toBeGreaterThanOrEqual(0);
    expect(r.progress).toBeLessThanOrEqual(100);
  });
});
