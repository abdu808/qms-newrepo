/**
 * services/supplierHistory.js — تحليل تاريخ تقييمات المورّد (ISO 8.4.2)
 *
 * منطق مُستخرج من `routes/suppliers.js::/history` ليكون قابلاً للاختبار بلا DB.
 */

/**
 * يحسب الاتجاه بين تقييمين (أو first عند عدم وجود سابق).
 */
export function computeTrend(currentPct, previousPct) {
  if (previousPct == null) return { trend: 'first', delta: 0 };
  const delta = Math.round((currentPct - previousPct) * 10) / 10;
  let trend;
  if      (delta >= 5)  trend = 'improving';
  else if (delta <= -5) trend = 'declining';
  else                  trend = 'stable';
  return { trend, delta };
}

/**
 * يحسب الاتجاه العام بمقارنة النصف الأول بالنصف الأخير من سلسلة النتائج.
 */
export function computeOverallTrend(scores) {
  if (!Array.isArray(scores) || scores.length < 2) return 'insufficient_data';
  const mid = Math.floor(scores.length / 2);
  const first = scores.slice(0, mid);
  const last  = scores.slice(-mid);
  const avg = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
  const diff = avg(last) - avg(first);
  if (diff >= 5)  return 'improving';
  if (diff <= -5) return 'declining';
  return 'stable';
}

/**
 * يبني timeline + stats من قائمة تقييمات خام (مرتّبة تصاعدياً بالتاريخ).
 */
export function buildSupplierHistory(evaluations) {
  const timeline = evaluations.map((ev, i) => {
    const prev = i > 0 ? evaluations[i - 1] : null;
    const { trend, delta } = computeTrend(ev.percentage, prev?.percentage ?? null);
    return {
      id: ev.id, code: ev.code, evaluatedAt: ev.evaluatedAt, period: ev.period,
      percentage: ev.percentage, grade: ev.grade, decision: ev.decision,
      evaluator: ev.evaluator,
      workflowState: ev.workflowState,
      trend, delta,
    };
  });

  const scores = evaluations.map(e => e.percentage).filter(p => p != null);
  const stats = {
    totalEvaluations: evaluations.length,
    avgScore: scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null,
    bestScore: scores.length ? Math.max(...scores) : null,
    worstScore: scores.length ? Math.min(...scores) : null,
    firstEvaluatedAt: evaluations[0]?.evaluatedAt || null,
    lastEvaluatedAt:  evaluations[evaluations.length - 1]?.evaluatedAt || null,
    overallTrend: computeOverallTrend(scores),
  };

  return { timeline, stats };
}
