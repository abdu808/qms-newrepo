/**
 * kpi-engine.js
 * ──────────────────────────────────────────────────────────────
 * محرك حساب الأداء للمؤشرات والنشاطات (Pure functions).
 * مسؤولية المحرك فقط: رياضيات + منطق. لا I/O هنا.
 */

// ─── أنماط الموسمية (أوزان شهرية، المجموع = 1) ─────────────────
export const SEASONALITY = {
  UNIFORM:        [1/12,1/12,1/12,1/12,1/12,1/12,1/12,1/12,1/12,1/12,1/12,1/12],
  MONTHLY_EVEN:   [1/12,1/12,1/12,1/12,1/12,1/12,1/12,1/12,1/12,1/12,1/12,1/12],
  QUARTERLY:      [0,   0,  .25, 0,   0,  .25, 0,   0,  .25, 0,   0,  .25 ],  // مارس/يونيو/سبتمبر/ديسمبر
  SCHOOL_START:   [0,   0,   0,  0,   0,   0,  0,  .5,  .5,  0,   0,   0 ],  // أغسطس-سبتمبر
  EID_SEASONAL:   [0, .15, .3,  0,  .3, .25,  0,   0,   0,  0,   0,   0 ],  // قبل العيدين
  RAMADAN_RELIEF: [0, .35, .35, 0,   0,  .3,  0,   0,   0,  0,   0,   0 ],  // رمضان 2026 + صيف
};

// ─── 1) كم يجب أن نكون أنجزنا حتى هذا الشهر؟ ──────────────────
export function expectedByMonth(kpi, month) {
  const { kpiType, targetValue = 0, seasonality = 'UNIFORM' } = kpi;
  const weights = SEASONALITY[seasonality] || SEASONALITY.UNIFORM;
  const cumWeight = weights.slice(0, month).reduce((a, b) => a + b, 0);

  switch (kpiType) {
    case 'CUMULATIVE':
      return targetValue * cumWeight;
    case 'PERIODIC':
      return targetValue; // كل شهر هدف مستقل
    case 'SNAPSHOT':
      return targetValue; // في أي وقت نقارن بالهدف الثابت
    case 'BINARY':
      return month >= 12 ? 1 : 0; // متوقع بحلول نهاية السنة
    default:
      return targetValue * cumWeight;
  }
}

// ─── 2) ماذا أنجزنا فعلاً؟ ─────────────────────────────────────
// entries: [{ year, month, actualValue }] مرتبة تصاعدياً
export function actualByMonth(kpi, entries, upToMonth) {
  const { kpiType } = kpi;
  const relevant = entries.filter(e => e.month <= upToMonth);
  if (!relevant.length) return null;

  switch (kpiType) {
    case 'CUMULATIVE':
      return relevant.reduce((s, e) => s + Number(e.actualValue || 0), 0);
    case 'PERIODIC': {
      // متوسط نسب تحقيق كل شهر
      const target = kpi.targetValue || 1;
      const ratios = relevant.map(e => Number(e.actualValue || 0) / target);
      return (ratios.reduce((a,b)=>a+b,0) / ratios.length) * target;
    }
    case 'SNAPSHOT': {
      // آخر قراءة
      const last = relevant[relevant.length - 1];
      return Number(last.actualValue || 0);
    }
    case 'BINARY': {
      // هل تحقق في أي شهر؟
      return relevant.some(e => Number(e.actualValue) >= 1) ? 1 : 0;
    }
    default:
      return relevant.reduce((s, e) => s + Number(e.actualValue || 0), 0);
  }
}

// ─── 3) نسبة الإنجاز الحالية ────────────────────────────────────
export function achievementRatio(kpi, actual, expected) {
  if (expected === 0 || expected == null) return null;
  const direction = kpi.direction || 'HIGHER_BETTER';
  const ratio = actual / expected;
  return direction === 'LOWER_BETTER' ? (1 / Math.max(ratio, 0.0001)) : ratio;
}

// ─── 4) حالة RAG ───────────────────────────────────────────────
export function ragStatus(ratio) {
  if (ratio == null || isNaN(ratio)) return 'GRAY';
  if (ratio >= 0.95) return 'GREEN';
  if (ratio >= 0.75) return 'YELLOW';
  return 'RED';
}

// ─── 5) التنبؤ بنهاية السنة ────────────────────────────────────
export function forecastYearEnd(kpi, entries, currentMonth) {
  if (!entries.length) return null;
  const { kpiType, targetValue = 0, seasonality = 'UNIFORM' } = kpi;
  const weights = SEASONALITY[seasonality] || SEASONALITY.UNIFORM;

  switch (kpiType) {
    case 'CUMULATIVE': {
      const actualSoFar = entries.reduce((s,e)=>s+Number(e.actualValue||0), 0);
      const weightSoFar = weights.slice(0, currentMonth).reduce((a,b)=>a+b,0);
      if (weightSoFar === 0) return actualSoFar;
      return actualSoFar / weightSoFar; // project based on seasonality-adjusted pace
    }
    case 'PERIODIC': {
      // متوسط آخر 3 أشهر × 12
      const last3 = entries.slice(-3);
      const avg = last3.reduce((s,e)=>s+Number(e.actualValue||0), 0) / last3.length;
      return avg; // يعرض كمتوسط شهري (يُقارن بـ targetValue)
    }
    case 'SNAPSHOT': {
      // إسقاط اتجاهي (slope) إذا توفر ≥3 قراءات، وإلا آخر قراءة
      if (entries.length < 3) return Number(entries[entries.length-1].actualValue || 0);
      const pts = entries.slice(-6);
      const n = pts.length;
      const sumX = pts.reduce((s,_,i)=>s+i, 0);
      const sumY = pts.reduce((s,e)=>s+Number(e.actualValue||0), 0);
      const sumXY = pts.reduce((s,e,i)=>s+i*Number(e.actualValue||0), 0);
      const sumX2 = pts.reduce((s,_,i)=>s+i*i, 0);
      const slope = (n*sumXY - sumX*sumY) / Math.max(n*sumX2 - sumX*sumX, 0.0001);
      const intercept = (sumY - slope*sumX) / n;
      const stepsAhead = 12 - currentMonth;
      return intercept + slope*(n-1+stepsAhead);
    }
    case 'BINARY': {
      return entries.some(e => Number(e.actualValue) >= 1) ? 1 : 0;
    }
    default:
      return null;
  }
}

// ─── 6) محرك التنبيهات ──────────────────────────────────────────
// يُرجع قائمة تنبيهات نشطة لمؤشر واحد
export function detectAlerts(kpi, entries, currentYear, currentMonth) {
  const alerts = [];
  const lastEntry = entries[entries.length - 1];

  // (أ) بيانات مفقودة > شهرين
  if (!lastEntry) {
    if (currentMonth >= 2) {
      alerts.push({ severity: 'WARNING', code: 'NO_DATA', msg: 'لا توجد بيانات مُدخلة لهذا المؤشر' });
    }
  } else {
    const monthsGap = (currentYear - lastEntry.year)*12 + (currentMonth - lastEntry.month);
    if (monthsGap >= 2) {
      alerts.push({ severity: 'WARNING', code: 'STALE_DATA', msg: `آخر إدخال منذ ${monthsGap} شهر` });
    }
  }

  if (entries.length === 0) return alerts;

  // (ب) انحراف حرج
  const expected = expectedByMonth(kpi, currentMonth);
  const actual = actualByMonth(kpi, entries, currentMonth);
  const ratio = achievementRatio(kpi, actual, expected);
  if (ratio != null && ratio < 0.60) {
    alerts.push({ severity: 'CRITICAL', code: 'CRITICAL_GAP', msg: `الإنجاز ${Math.round(ratio*100)}% من المتوقع` });
  }

  // (ج) التنبؤ أقل من 70% من الهدف السنوي
  const forecast = forecastYearEnd(kpi, entries, currentMonth);
  if (forecast != null && kpi.targetValue && forecast < kpi.targetValue * 0.70) {
    alerts.push({ severity: 'CRITICAL', code: 'FORECAST_MISS', msg: `التوقع بنهاية السنة ${Math.round(forecast)} فقط من ${kpi.targetValue}` });
  }

  // (د) تراجع في الأداء (SNAPSHOT فقط)
  if (kpi.kpiType === 'SNAPSHOT' && entries.length >= 2) {
    const prev = Number(entries[entries.length-2].actualValue || 0);
    const curr = Number(lastEntry.actualValue || 0);
    if (prev > 0 && curr < prev * 0.80) {
      alerts.push({ severity: 'HIGH', code: 'DECLINE', msg: `تراجع من ${prev} إلى ${curr}` });
    }
  }

  // (هـ) إسراف مالي — لو المصروف يسبق الإنجاز بكثير
  if (kpi.budget) {
    const totalSpent = entries.reduce((s,e)=>s+Number(e.spent||0), 0);
    const spentPct = (totalSpent / kpi.budget) * 100;
    const progressPct = ratio ? ratio * 100 : 0;
    if (spentPct > progressPct + 25 && spentPct > 30) {
      alerts.push({ severity: 'HIGH', code: 'BUDGET_OVERRUN', msg: `صُرف ${Math.round(spentPct)}% والإنجاز ${Math.round(progressPct)}%` });
    }
  }

  return alerts;
}

// ─── 7) تقييم شامل لمؤشر واحد ──────────────────────────────────
export function evaluateKpi(kpi, entries, currentYear, currentMonth) {
  const expected = expectedByMonth(kpi, currentMonth);
  const actual = actualByMonth(kpi, entries, currentMonth);
  const ratio = achievementRatio(kpi, actual, expected);
  const rag = ragStatus(ratio);
  const forecast = forecastYearEnd(kpi, entries, currentMonth);
  const alerts = detectAlerts(kpi, entries, currentYear, currentMonth);
  const totalSpent = entries.reduce((s,e)=>s+Number(e.spent||0), 0);

  return {
    expected,
    actual,
    ratio,
    rag,
    forecast,
    forecastRatio: kpi.targetValue ? forecast / kpi.targetValue : null,
    totalSpent,
    spentRatio: kpi.budget ? totalSpent / kpi.budget : null,
    alerts,
    entriesCount: entries.length,
  };
}
