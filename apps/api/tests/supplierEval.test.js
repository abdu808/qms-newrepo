/**
 * tests/supplierEval.test.js — Unit tests for services/supplierEval.js (بلا DB)
 */
import { describe, it, expect } from 'vitest';
import { buildSupplierEvalPayload } from '../src/services/supplierEval.js';

function base(data = {}) {
  return {
    supplierId: 'sup-1',
    notes: 'ملاحظة',
    ...data,
  };
}

describe('buildSupplierEvalPayload — legacy mode (totalScore/maxScore)', () => {
  it('يحسب النسبة والدرجة والقرار', () => {
    const out = buildSupplierEvalPayload({
      data: base({ totalScore: 85, maxScore: 100 }),
      supplierType: 'GOODS',
      evaluatorId: 'user-1',
    });
    expect(out.percentage).toBe(85);
    expect(out.grade).toBeDefined();
    expect(out.decision).toBeDefined();
    expect(out.evaluatorId).toBe('user-1');
    expect(out.answers).toBeUndefined();
    expect(out.recommendation).toBeUndefined();
  });

  it('يرفع خطأ إذا supplierId مفقود', () => {
    expect(() => buildSupplierEvalPayload({
      data: { totalScore: 80, maxScore: 100 },
      supplierType: 'GOODS',
      evaluatorId: 'user-1',
    })).toThrow(/supplierId/);
  });

  it('يستخدم maxScore الافتراضي (100) عند غيابه', () => {
    const out = buildSupplierEvalPayload({
      data: base({ totalScore: 50 }),
      supplierType: 'GOODS',
      evaluatorId: 'u',
    });
    expect(out.maxScore).toBe(100);
    expect(out.percentage).toBe(50);
  });
});

describe('buildSupplierEvalPayload — recommendation injection', () => {
  it('يحقن التوصية المسموحة داخل criteriaJson', () => {
    const criteriaJson = JSON.stringify({ criteria: {}, notes: '' });
    const out = buildSupplierEvalPayload({
      data: base({ totalScore: 80, maxScore: 100, criteriaJson, recommendation: 'approved' }),
      supplierType: 'GOODS',
      evaluatorId: 'u',
    });
    const parsed = JSON.parse(out.criteriaJson);
    expect(parsed.recommendation).toBe('approved');
  });

  it('يتجاهل توصية غير مسموحة', () => {
    const criteriaJson = JSON.stringify({ criteria: {} });
    const out = buildSupplierEvalPayload({
      data: base({ totalScore: 80, maxScore: 100, criteriaJson, recommendation: 'HACK' }),
      supplierType: 'GOODS',
      evaluatorId: 'u',
    });
    const parsed = JSON.parse(out.criteriaJson);
    expect(parsed.recommendation).toBeUndefined();
  });

  it('لا يتعطل مع criteriaJson فاسد', () => {
    const out = buildSupplierEvalPayload({
      data: base({ totalScore: 80, maxScore: 100, criteriaJson: '{not-json', recommendation: 'approved' }),
      supplierType: 'GOODS',
      evaluatorId: 'u',
    });
    expect(out.criteriaJson).toBe('{not-json'); // يُحتفظ بالأصل
  });
});

describe('buildSupplierEvalPayload — critical fail detection', () => {
  it('يكشف فشل معيار حرج من criteriaJson', () => {
    const criteriaJson = JSON.stringify({
      criteria: {
        q_critical: { score: 0, critical: true, failed: true },
      },
    });
    const out = buildSupplierEvalPayload({
      data: base({ totalScore: 90, maxScore: 100, criteriaJson }),
      supplierType: 'GOODS',
      evaluatorId: 'u',
    });
    // decision يجب أن يعكس الفشل الحرج (ليس approved رغم النسبة العالية)
    expect(out.decision).not.toBe('approved');
  });
});
