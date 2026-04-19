/**
 * tests/surveysSmartFilters.test.js — مرشّحات الاستبيانات الذكية.
 */
import { describe, it, expect } from 'vitest';
import { SURVEY_SMART_FILTERS as F } from '../src/routes/surveys.js';

const DAY = 86400000;
const S = (o = {}) => ({
  id: 's1', active: true, responses: 0, avgScore: null,
  createdAt: new Date().toISOString(), ...o,
});

describe('Survey smart filters — الحالة', () => {
  it('active / inactive', () => {
    expect(F.active(S({ active: true }))).toBe(true);
    expect(F.active(S({ active: false }))).toBe(false);
    expect(F.inactive(S({ active: false }))).toBe(true);
  });
});

describe('Survey smart filters — الاستجابات', () => {
  it('withResponses / noResponses', () => {
    expect(F.withResponses(S({ responses: 5 }))).toBe(true);
    expect(F.withResponses(S({ responses: 0 }))).toBe(false);
    expect(F.noResponses(S({ responses: 0 }))).toBe(true);
    expect(F.noResponses(S({ responses: 3 }))).toBe(false);
  });
});

describe('Survey smart filters — الرضا', () => {
  it('highSatisfaction: avgScore >= 4 ومعها ردود', () => {
    expect(F.highSatisfaction(S({ avgScore: 4.2, responses: 10 }))).toBe(true);
    expect(F.highSatisfaction(S({ avgScore: 4.2, responses: 0 }))).toBe(false); // بلا ردود
    expect(F.highSatisfaction(S({ avgScore: 3.5, responses: 10 }))).toBe(false);
    expect(F.highSatisfaction(S({ avgScore: null }))).toBe(false);
  });
  it('lowSatisfaction: avgScore < 3', () => {
    expect(F.lowSatisfaction(S({ avgScore: 2.1, responses: 5 }))).toBe(true);
    expect(F.lowSatisfaction(S({ avgScore: 3.1, responses: 5 }))).toBe(false);
    expect(F.lowSatisfaction(S({ avgScore: 2.1, responses: 0 }))).toBe(false);
  });
});

describe('Survey smart filters — توقيتي', () => {
  it('recent: خلال 30 يوماً', () => {
    const fresh = new Date(Date.now() - 5 * DAY).toISOString();
    const old   = new Date(Date.now() - 40 * DAY).toISOString();
    expect(F.recent(S({ createdAt: fresh }))).toBe(true);
    expect(F.recent(S({ createdAt: old }))).toBe(false);
  });
  it('stale: نشط + >60 يوم + بلا ردود', () => {
    const old = new Date(Date.now() - 90 * DAY).toISOString();
    expect(F.stale(S({ active: true, createdAt: old, responses: 0 }))).toBe(true);
    // وجود ردود = ليس stale
    expect(F.stale(S({ active: true, createdAt: old, responses: 5 }))).toBe(false);
    // غير نشط = ليس stale
    expect(F.stale(S({ active: false, createdAt: old, responses: 0 }))).toBe(false);
    // حديث = ليس stale
    expect(F.stale(S({ active: true, createdAt: new Date().toISOString(), responses: 0 }))).toBe(false);
  });
});
