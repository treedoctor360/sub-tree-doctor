// 総合判定ロジック — shindanv27 と同一（純粋関数）。
// 出典: 日本緑化センターの衰退度判定基準（平均評点 <0.8=Ⅰ良 / <1.6=Ⅱ / <2.4=Ⅲ / <3.2=Ⅳ / ≧3.2=Ⅴ枯死寸前）。

const HEALTH_ORDER = { A: 0, B: 1, C: 2, D: 3 };

export function calcDeclineAvg(scores, enabledIds) {
  if (!scores || !Array.isArray(enabledIds)) return null;
  const values = [];
  for (const id of enabledIds) {
    const raw = scores[id];
    if (raw === null || raw === undefined || raw === '') continue;
    const n = Number(raw);
    if (Number.isNaN(n)) continue;
    values.push(n);
  }
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function declineLevelFromAvg(avg) {
  if (avg === null || avg === undefined || Number.isNaN(avg)) return null;
  if (avg < 0.8) return { level: 'Ⅰ', text: '良' };
  if (avg < 1.6) return { level: 'Ⅱ', text: 'やや不良' };
  if (avg < 2.4) return { level: 'Ⅲ', text: '不良' };
  if (avg < 3.2) return { level: 'Ⅳ', text: '著しく不良' };
  return { level: 'Ⅴ', text: '枯死寸前' };
}

export function worstHealth(health) {
  if (!health) return null;
  let worst = null;
  for (const value of Object.values(health)) {
    if (typeof value !== 'string') continue;
    const grade = value.toUpperCase();
    if (!(grade in HEALTH_ORDER)) continue;
    if (worst === null || HEALTH_ORDER[grade] > HEALTH_ORDER[worst]) worst = grade;
  }
  return worst;
}

export function calcOverall(avg, worst) {
  if ((avg === null || avg === undefined) && !worst) return null;
  const decline = declineLevelFromAvg(avg);
  const declineLevel = decline ? decline.level : null;
  const avgNum = avg === null || avg === undefined ? -Infinity : avg;
  if (worst === 'D' || avgNum >= 3.2) return { grade: 'D', gradeText: '危険木（緊急対応）', declineLevel };
  if (worst === 'C' || avgNum >= 2.4) return { grade: 'C', gradeText: '要注意', declineLevel };
  if (worst === 'B' || avgNum >= 1.6) return { grade: 'B', gradeText: '健全に近い（経過観察）', declineLevel };
  return { grade: 'A', gradeText: '健全', declineLevel };
}

export function evaluateRecord(record, enabledIds) {
  const avg = calcDeclineAvg(record?.scores, enabledIds);
  const worst = worstHealth(record?.health);
  const overall = calcOverall(avg, worst);
  return { avg, worst, overall };
}

// t/R比の危険度分類（開口空洞ありは危険側へ補正）。
export function classifyTr(t, r, hasOpenCavity) {
  const rr = Number(r), tt = Number(t);
  if (!(rr > 0) || Number.isNaN(tt)) return null;
  const ratio = tt / rr;
  const adj = hasOpenCavity ? 0.05 : 0;
  let c, text;
  if (ratio >= 0.45 - adj) { c = 'ok'; text = '健全域'; }
  else if (ratio >= 0.35 - adj) { c = 'caution'; text = '注意'; }
  else if (ratio >= 0.30 - adj) { c = 'treat'; text = '要治療域'; }
  else { c = 'danger'; text = '要警戒'; }
  return { ratio, c, text };
}
