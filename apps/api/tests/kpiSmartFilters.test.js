/**
 * tests/kpiSmartFilters.test.js — مرشّحات KPI الذكية (quick chips).
 * Pure predicates — بلا DB.
 */
import { describe, it, expect } from 'vitest';
import { KPI_SMART_FILTERS as F } from '../src/routes/kpi.js';

const req = (overrides = {}) => ({
  user: { sub: 'u1', name: 'أحمد الفهد', departmentId: 'd1', ...overrides },
});
const ctx = { month: 4 };

// kpi factory
const K = (o = {}) => ({
  kind: 'objective',
  ownerId: 'u1',
  departmentId: 'd1',
  responsible: '',
  rag: 'GREEN',
  ratio: 1,
  alerts: [],
  entries: [],
  perspective: 'مالي',
  ...o,
});

describe('KPI smart filters — ملكية', () => {
  it('mine: objective by ownerId', () => {
    expect(F.mine(K({ ownerId: 'u1' }), req(), ctx)).toBe(true);
    expect(F.mine(K({ ownerId: 'u2' }), req(), ctx)).toBe(false);
  });

  it('mine: activity by responsible contains user.name', () => {
    const a = K({ kind: 'activity', responsible: 'أحمد الفهد، سارة', ownerId: null });
    expect(F.mine(a, req(), ctx)).toBe(true);
    expect(F.mine(K({ kind: 'activity', responsible: 'سارة فقط' }), req(), ctx)).toBe(false);
  });

  it('myDept: only objectives match departmentId', () => {
    expect(F.myDept(K({ departmentId: 'd1' }), req(), ctx)).toBe(true);
    expect(F.myDept(K({ departmentId: 'd2' }), req(), ctx)).toBe(false);
    // activity لا تُطابق لأن ليس لها departmentId في هذا السياق
    expect(F.myDept(K({ kind: 'activity', departmentId: 'd1' }), req(), ctx)).toBe(false);
  });
});

describe('KPI smart filters — حالة RAG', () => {
  it('red/yellow/green/gray', () => {
    expect(F.red(K({ rag: 'RED' }))).toBe(true);
    expect(F.red(K({ rag: 'GREEN' }))).toBe(false);
    expect(F.green(K({ rag: 'GREEN' }))).toBe(true);
    expect(F.yellow(K({ rag: 'YELLOW' }))).toBe(true);
    expect(F.gray(K({ rag: 'GRAY' }))).toBe(true);
  });
});

describe('KPI smart filters — أداء كمّي', () => {
  it('behind: ratio < 0.7', () => {
    expect(F.behind(K({ ratio: 0.5 }))).toBe(true);
    expect(F.behind(K({ ratio: 0.7 }))).toBe(false);
    expect(F.behind(K({ ratio: null }))).toBe(false);
  });
  it('ahead: ratio >= 1.0', () => {
    expect(F.ahead(K({ ratio: 1.0 }))).toBe(true);
    expect(F.ahead(K({ ratio: 1.5 }))).toBe(true);
    expect(F.ahead(K({ ratio: 0.99 }))).toBe(false);
  });
});

describe('KPI smart filters — قراءات الشهر', () => {
  it('missing: ليس للشهر الحالي إدخال', () => {
    expect(F.missing(K({ entries: [{ month: 3 }] }), req(), { month: 4 })).toBe(true);
    expect(F.missing(K({ entries: [{ month: 4 }] }), req(), { month: 4 })).toBe(false);
  });
  it('entered: يوجد إدخال للشهر', () => {
    expect(F.entered(K({ entries: [{ month: 4 }] }), req(), { month: 4 })).toBe(true);
    expect(F.entered(K({ entries: [] }), req(), { month: 4 })).toBe(false);
  });
});

describe('KPI smart filters — تنبيهات', () => {
  it('criticalAlerts: يحتوي CRITICAL', () => {
    expect(F.criticalAlerts(K({ alerts: [{ severity: 'CRITICAL' }] }))).toBe(true);
    expect(F.criticalAlerts(K({ alerts: [{ severity: 'INFO' }] }))).toBe(false);
    expect(F.criticalAlerts(K({ alerts: [] }))).toBe(false);
  });
});
