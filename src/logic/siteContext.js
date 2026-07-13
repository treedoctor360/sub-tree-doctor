// 現地コンテキスト（対象木だけでは見えない情報）を決定論(JS)で整理する。
// Gemini には距離計算・比較をさせない。JS が計算し、結果だけを渡す。
// ★設計原則: 近接木は「感染源」ではなく「対照群」。要因カテゴリに専用配線を作らない。
//   腐朽菌名など特定要因のハードコードは一切しない（アンカリング源になるため）。
import { evaluateRecord } from './diagnosis.js';
import { DECLINE_ITEMS, DECLINE_ITEM_IDS } from '../data/declineItems.js';
import { HEALTH_ITEMS } from '../data/healthItems.js';

const num = (v) => v != null && v !== '' && !Number.isNaN(Number(v));
const hasCoord = (r) => num(r?.latitude) && num(r?.longitude);
const isNumTreeNo = (v) => v != null && v !== '' && !Number.isNaN(parseInt(v, 10));
const ev = (rec) => evaluateRecord(rec, DECLINE_ITEM_IDS);

// 2点間の距離(m)。Haversine。
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000, toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

// 対象木の異常項目ラベル（健全度A以外／活力度評点≧2）。要因ラベルには変換せず、生の項目名を返す。
function abnormalLabels(rec) {
  const out = [];
  const h = rec?.health || {};
  for (const it of HEALTH_ITEMS) { const g = h[it.id]; if (g && g !== 'A') out.push(it.label); }
  const s = rec?.scores || {};
  for (const it of DECLINE_ITEMS) {
    const raw = s[it.id]; const n = Number(raw);
    if (raw != null && raw !== '' && !Number.isNaN(n) && n >= 2) out.push(it.label);
  }
  return out;
}

// 同一個体（保存ごとに新idが振られる）を treeNo / nickname で1つに畳む（最新のみ残す）。
function dedupeIndividuals(recs) {
  const map = new Map();
  for (const r of recs) {
    const key = (r.treeNo && `no:${r.treeNo}`) || (r.nickname && `nick:${r.nickname}`) || `id:${r.id}`;
    const cur = map.get(key);
    if (!cur || (r.createdAt || '') > (cur.createdAt || '')) map.set(key, r);
  }
  return [...map.values()];
}

/**
 * 近接木を抽出する。★同一 projectId（現地）で必ず先に絞る = treeNo 衝突（別案件の同番号）を構造的に排除。
 * 座標があれば距離順、無ければ treeNo 連番隣接、どちらも無ければ同一現地の全個体。
 * @returns {Array<{rec, distM:number|null, seq?:boolean, sameSpecies:boolean}>}
 */
export function selectNeighbors(target, records, opts = {}) {
  const radiusM = Number(opts.neighborRadiusM ?? opts.radiusM ?? 10);
  const max = Number(opts.neighborMax ?? opts.max ?? 8);
  if (!target?.projectId) return []; // 現地未設定 → 近接木なし（判定保留=P4）
  let cands = (records || []).filter((r) => r && r.id !== target.id && r.projectId === target.projectId);
  // 同一 treeNo は「同一個体の履歴」なので近接木からは除外（経年変化は selectHistory 側）
  if (target.treeNo) cands = cands.filter((r) => String(r.treeNo) !== String(target.treeNo));
  cands = dedupeIndividuals(cands);

  let picked;
  if (hasCoord(target) && cands.some(hasCoord)) {
    picked = cands.filter(hasCoord)
      .map((c) => ({ rec: c, distM: Math.round(haversine(Number(target.latitude), Number(target.longitude), Number(c.latitude), Number(c.longitude))) }))
      .filter((x) => x.distM <= radiusM)
      .sort((a, b) => a.distM - b.distM);
  } else if (isNumTreeNo(target.treeNo)) {
    const tn = parseInt(target.treeNo, 10);
    picked = cands.map((c) => ({ rec: c, n: parseInt(c.treeNo, 10) }))
      .filter((x) => !Number.isNaN(x.n) && Math.abs(x.n - tn) <= 2)
      .sort((a, b) => Math.abs(a.n - tn) - Math.abs(b.n - tn))
      .map((x) => ({ rec: x.rec, distM: null, seq: true }));
  } else {
    picked = cands.map((c) => ({ rec: c, distM: null }));
  }
  picked = picked.slice(0, max);
  for (const p of picked) p.sameSpecies = !!(target.species && p.rec.species && p.rec.species === target.species);
  return picked;
}

/**
 * 経年変化: 同一 projectId かつ 同一 treeNo（無ければ nickname）の過去レコードを createdAt 昇順で最大3件。
 * treeNo / nickname が非空のときだけ照合する（空だと別個体まで束ねてしまうため）。
 */
export function selectHistory(target, records) {
  if (!target?.projectId) return [];
  const byNo = !!target.treeNo;
  const byNick = !byNo && !!target.nickname;
  if (!byNo && !byNick) return [];
  return (records || [])
    .filter((r) => r && r.id !== target.id && r.projectId === target.projectId &&
      ((byNo && String(r.treeNo) === String(target.treeNo)) || (byNick && r.nickname === target.nickname)))
    .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''))
    .slice(-3);
}

/**
 * 比較パターン判定。既存 evaluateRecord を再利用し、総合判定の分布で共通要因/個体固有を見立てる。
 * P1=近接木の過半も不良（共通要因優先）/ P2=近接木の過半が健全（個体固有優先）/ P4=近接木2本未満（判定保留）。
 * P3(併記)=対象木と近接木で一致する異常項目。キノコを特別扱いしない。
 */
export function comparePattern(target, neighborRecs) {
  const n = (neighborRecs || []).length;
  if (n < 2) return { pattern: 'P4', sharedFindings: [], neighborCount: n };
  const badGrade = (g) => g === 'C' || g === 'D';
  const evals = neighborRecs.map(ev);
  const badCount = evals.filter((e) => badGrade(e.overall?.grade)).length;
  // 過半（＝半数以上）が不良なら共通要因を疑う。同数のときは安全側=P1（鑑別を広げる）。
  const pattern = badCount * 2 >= n ? 'P1' : 'P2';

  const targetAbn = new Set(abnormalLabels(target));
  const shared = new Set();
  for (const r of neighborRecs) for (const lbl of abnormalLabels(r)) if (targetAbn.has(lbl)) shared.add(lbl);
  return { pattern, sharedFindings: [...shared], neighborCount: n };
}

// 近接木が「健全」か（陰性情報の集計用）。総合A・異常項目なし・腐朽菌メモなし。
export function neighborIsHealthy(nb) {
  const r = nb.rec;
  const e = ev(r);
  return !!(e.overall && e.overall.grade === 'A') && abnormalLabels(r).length === 0 && !r.fungusOther;
}

// 近接木1本を1行に要約。所見(fungusOther/findings)は生のまま載せる（ラベル変換しない）。
export function summarizeNeighbor(nb) {
  const r = nb.rec;
  const e = ev(r);
  const no = r.treeNo ? `No.${r.treeNo}` : (r.nickname || '個体');
  const dist = nb.distM != null ? `${nb.distM}m` : (nb.seq ? '番号隣接' : '同一現地');
  const head = `${no}（${dist}｜${r.species || '樹種不明'}）`;
  const grade = e.overall ? `総合${e.overall.grade}` : '判定なし';
  const decline = e.overall?.declineLevel ? `・衰退度${e.overall.declineLevel}` : '';
  const obs = [];
  const abn = abnormalLabels(r);
  if (abn.length) obs.push(abn.join('、'));
  if (r.fungusOther) obs.push(r.fungusOther);
  if (r.findings) obs.push(r.findings);
  const tail = obs.length ? `／${obs.join('／')}` : (neighborIsHealthy(nb) ? '・健全' : '');
  return `${head}${grade}${decline}${tail}`;
}

/**
 * パス2 RAG 用のクエリ。現地の history/environment/surroundings と近接木の異常項目＋所見を
 * そのまま連結（上限300字）。菌名リスト等のキュレーションは一切挟まない（偏りをコードで作らない）。
 * 空なら '' を返す（呼び出し側でパス2をスキップ）。
 */
export function buildSiteQuery(site, neighbors) {
  const parts = [];
  if (site) for (const k of ['history', 'environment', 'surroundings']) if (site[k]) parts.push(site[k]);
  for (const nb of (neighbors || [])) {
    const r = nb.rec;
    const abn = abnormalLabels(r);
    if (abn.length) parts.push(abn.join(' '));
    if (r.fungusOther) parts.push(r.fungusOther);
    if (r.findings) parts.push(r.findings);
  }
  return parts.join(' ').slice(0, 300);
}

/**
 * 現地コンテキスト一式を組み立てる。現地未設定(projectId空)なら null を返す＝現行と完全に同じ挙動（後方互換）。
 * @returns {null | {site, neighbors, history, pattern, sharedFindings, sameSpeciesControl, neighborCount}}
 */
export function buildSiteContext(target, records, sites, opts = {}) {
  if (!target?.projectId) return null;
  const site = (sites || []).find((s) => s.id === target.projectId) || null;
  const neighbors = selectNeighbors(target, records, opts);
  const history = selectHistory(target, records);
  const cmp = comparePattern(target, neighbors.map((n) => n.rec));
  const sameSpeciesCount = neighbors.filter((n) => n.sameSpecies).length;
  return { site, neighbors, history, sameSpeciesControl: sameSpeciesCount >= 2, ...cmp };
}
