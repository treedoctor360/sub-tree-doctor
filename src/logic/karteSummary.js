// カルテ（record）を、AIに渡す文脈テキストへ要約する。
import { HEALTH_ITEMS, HEALTH_GRADES } from '../data/healthItems.js';
import { DECLINE_ITEMS } from '../data/declineItems.js';
import { TEBIKI_GROUPS } from '../data/tebikiItems.js';
import { evaluateRecord } from './diagnosis.js';

const DECLINE_IDS = DECLINE_ITEMS.map((i) => i.id);
const gradeText = (g) => (HEALTH_GRADES.find((x) => x.value === g)?.label || g);

export function summarizeKarte(record) {
  if (!record) return '（カルテ未入力）';
  const lines = [];
  const meta = [];
  if (record.species) meta.push(`樹種:${record.species}`);
  if (record.nickname) meta.push(`個体:${record.nickname}`);
  if (record.location) meta.push(`場所:${record.location}`);
  if (record.treeHeight) meta.push(`樹高:${record.treeHeight}m`);
  if (record.trunkGirth) meta.push(`幹周:${record.trunkGirth}cm`);
  if (meta.length) lines.push('■ 対象木: ' + meta.join(' / '));

  const { avg, worst, overall } = evaluateRecord(record, DECLINE_IDS);
  if (overall) {
    lines.push(
      `■ 総合判定: ${overall.grade}（${overall.gradeText}）` +
        ` / 活力度平均 ${avg == null ? '—' : avg.toFixed(2)}` +
        (overall.declineLevel ? `（衰退度${overall.declineLevel}）` : '') +
        ` / 健全度最悪 ${worst ?? '—'}`
    );
  }

  // 健全度でA以外
  const health = record.health || {};
  const abn = HEALTH_ITEMS.filter((i) => health[i.id] && health[i.id] !== 'A')
    .map((i) => `${i.label}(${gradeText(health[i.id]).replace(/^.: /, '')})`);
  if (abn.length) lines.push('■ 健全度で異常あり: ' + abn.join('、'));

  // 活力度で評点2以上
  const scores = record.scores || {};
  const bad = DECLINE_ITEMS
    .map((i) => ({ i, s: Number(scores[i.id]) }))
    .filter((e) => !Number.isNaN(e.s) && scores[e.i.id] !== '' && scores[e.i.id] != null && e.s >= 2)
    .sort((a, b) => b.s - a.s)
    .map((e) => `${e.i.label}(評点${e.s})`);
  if (bad.length) lines.push('■ 活力度で状態の悪い項目: ' + bad.join('、'));

  // 手引き追加項目（入力あるもの）
  const t = record.tebiki || {};
  for (const g of TEBIKI_GROUPS) {
    const parts = g.fields
      .filter((f) => t[f.id] !== undefined && t[f.id] !== '' && t[f.id] != null)
      .map((f) => `${f.label}:${t[f.id]}${f.unit || ''}`);
    if (parts.length) lines.push(`■ ${g.label}: ` + parts.join(' / '));
  }
  if (record.fungusOther) lines.push('■ 腐朽菌メモ: ' + record.fungusOther);
  if (record.findings) lines.push('■ 所見: ' + record.findings);

  return lines.length ? lines.join('\n') : '（主要項目が未入力）';
}
