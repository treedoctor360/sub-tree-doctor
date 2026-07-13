// 記録DB中継GAS（診断スキーマ版）との同期。共有いただいた記録GASと同じI/O契約。
// COLS の全量は _json 列へ格納するため、フロントは record をそのまま送る。

function toRow(rec) {
  // 人が読める要約列（GAS側 COLS と対応）＋ _json 全量
  return {
    record_id: rec.id,
    created_at: rec.createdAt || '',
    updated_at: rec.updatedAt || '',
    inspector: rec.inspector || '',
    project: rec.projectId || '',
    tree_no: rec.treeNo || '',
    species: rec.species || '',
    nickname: rec.nickname || '',
    location: rec.location || '',
    tree_height: rec.treeHeight || '',
    trunk_girth: rec.trunkGirth || '',
    lat: rec.latitude || '',
    lng: rec.longitude || '',
    overall_grade: rec.overall?.grade || '',
    overall_text: rec.overall?.gradeText || '',
    decline_avg: rec.avg ?? '',
    decline_level: rec.overall?.declineLevel || '',
    worst_health: rec.worst || '',
    findings: rec.findings || '',
    differential: rec.differential || '',
    recommended_precision: rec.recommendedPrecision || '',
    risk_tr: rec.riskTr || '',
    management: rec.management || '',
    client_explanation: rec.clientExplanation || '',
    site_risk: rec.siteRisk || '',
    uncertainties: rec.uncertainties || '',
    consult_report: rec.consultReport || '',
    advisor: rec.advisor || 'Gemini(サブ樹木医)',
    _json: JSON.stringify(rec),
  };
}

async function post(gasUrl, token, payload) {
  const res = await fetch(gasUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ token, ...payload }),
  });
  return JSON.parse(await res.text());
}

export async function gasSaveRecords(gasUrl, token, records) {
  if (!gasUrl) throw new Error('記録GASのURLが未設定です。');
  return post(gasUrl, token, { action: 'save', records: records.map(toRow) });
}

export async function gasDeleteRecords(gasUrl, token, ids) {
  if (!gasUrl) throw new Error('記録GASのURLが未設定です。');
  return post(gasUrl, token, { action: 'delete', ids });
}

export async function gasGetAll(gasUrl) {
  if (!gasUrl) throw new Error('記録GASのURLが未設定です。');
  const res = await fetch(gasUrl);
  const data = JSON.parse(await res.text());
  if (!data.ok) throw new Error(data.error || '取得に失敗');
  // _json から record を復元
  return (data.records || []).map((row) => {
    try { return JSON.parse(row._json); } catch { return row; }
  });
}
