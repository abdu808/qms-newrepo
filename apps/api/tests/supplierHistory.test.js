/**
 * tests/supplierHistory.test.js — Unit tests لخدمة تحليل تاريخ تقييمات المورّد.
 */
import { describe, it, expect } from 'vitest';
import { computeTrend, computeOverallTrend, buildSupplierHistory } from '../src/services/supplierHistory.js';

const ev = (pct, date, extra = {}) => ({
  id: 'e-' + pct, code: 'EV-' + pct,
  percentage: pct, grade: 'جيد', decision: 'معتمد',
  evaluatedAt: new Date(date), period: null,
  evaluator: { id: 'u1', name: 'مقيّم' },
  workflowState: 'APPROVED',
  ...extra,
});

describe('computeTrend', () => {
  it('first evaluation has trend=first, delta=0', () => {
    const r = computeTrend(85, null);
    expect(r).toEqual({ trend: 'first', delta: 0 });
  });

  it('تحسّن عند +5 أو أكثر', () => {
    expect(computeTrend(90, 80).trend).toBe('improving');
    expect(computeTrend(85, 80).trend).toBe('improving');
  });

  it('تراجع عند -5 أو أقل', () => {
    expect(computeTrend(75, 80).trend).toBe('declining');
    expect(computeTrend(70, 80).trend).toBe('declining');
  });

  it('مستقر في النطاق الضيّق', () => {
    expect(computeTrend(83, 80).trend).toBe('stable');
    expect(computeTrend(77, 80).trend).toBe('stable');
  });

  it('delta مدوّر لرقم عشري واحد', () => {
    const r = computeTrend(80.37, 80);
    expect(r.delta).toBe(0.4);
  });
});

describe('computeOverallTrend', () => {
  it('insufficient_data عند أقل من تقييمين', () => {
    expect(computeOverallTrend([])).toBe('insufficient_data');
    expect(computeOverallTrend([80])).toBe('insufficient_data');
  });

  it('improving عند ارتفاع متوسط النصف الأخير', () => {
    expect(computeOverallTrend([60, 65, 80, 85])).toBe('improving');
  });

  it('declining عند انخفاض واضح', () => {
    expect(computeOverallTrend([90, 85, 70, 65])).toBe('declining');
  });

  it('stable عند تغيّر طفيف', () => {
    expect(computeOverallTrend([80, 82, 81, 79])).toBe('stable');
  });
});

describe('buildSupplierHistory', () => {
  it('يُرجع timeline فارغ + stats صفرية عند غياب التقييمات', () => {
    const { timeline, stats } = buildSupplierHistory([]);
    expect(timeline).toEqual([]);
    expect(stats.totalEvaluations).toBe(0);
    expect(stats.avgScore).toBeNull();
    expect(stats.overallTrend).toBe('insufficient_data');
  });

  it('يحسب stats + trend لكل تقييم', () => {
    const evals = [
      ev(70, '2025-01-15'),
      ev(78, '2025-06-15'),
      ev(88, '2026-01-15'),
    ];
    const { timeline, stats } = buildSupplierHistory(evals);

    expect(timeline).toHaveLength(3);
    expect(timeline[0].trend).toBe('first');
    expect(timeline[1].trend).toBe('improving'); // 78-70 = 8
    expect(timeline[2].trend).toBe('improving'); // 88-78 = 10

    expect(stats.totalEvaluations).toBe(3);
    expect(stats.bestScore).toBe(88);
    expect(stats.worstScore).toBe(70);
    expect(stats.avgScore).toBeGreaterThan(75);
    expect(stats.overallTrend).toBe('improving');
  });

  it('يحسب الاتجاه العام: مستقر', () => {
    const evals = [
      ev(80, '2025-01-15'),
      ev(82, '2025-06-15'),
      ev(79, '2026-01-15'),
      ev(81, '2026-03-15'),
    ];
    const { stats } = buildSupplierHistory(evals);
    expect(stats.overallTrend).toBe('stable');
  });

  it('يحسب الاتجاه العام: تراجع', () => {
    const evals = [
      ev(90, '2025-01-15'),
      ev(88, '2025-06-15'),
      ev(72, '2026-01-15'),
      ev(70, '2026-03-15'),
    ];
    const { stats } = buildSupplierHistory(evals);
    expect(stats.overallTrend).toBe('declining');
  });
});
