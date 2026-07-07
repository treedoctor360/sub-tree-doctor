// GAS→Gemini 透過中継の呼び出し（wood-decay-fungi と同方式。Content-Type: text/plain でCORS回避）。
// リレーはフロントが組み立てた Gemini リクエストボディをそのまま generateContent へ渡す。

/**
 * @param {string} relayUrl - Geminiリレー(GAS)のURL
 * @param {string} systemInstruction - system_instruction のテキスト
 * @param {{role:'user'|'model', text:string}[]} history - 会話履歴
 * @returns {Promise<string>} モデルの応答テキスト
 */
export async function askGemini(relayUrl, systemInstruction, history) {
  if (!relayUrl) throw new Error('Geminiリレー(GAS)のURLが未設定です。設定タブで登録してください。');
  const body = {
    system_instruction: { parts: [{ text: systemInstruction }] },
    contents: history.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
    generationConfig: { temperature: 0.5, topP: 0.95, maxOutputTokens: 2048 },
  };
  const res = await fetch(relayUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(body),
  });
  const raw = await res.text();
  let data;
  try { data = JSON.parse(raw); } catch { throw new Error('リレー応答の解析に失敗: ' + raw.slice(0, 200)); }
  if (data.error) {
    const detail = typeof data.error === 'string' ? data.error : (data.detail || JSON.stringify(data.error));
    throw new Error('Gemini中継エラー: ' + detail);
  }
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? '';
  if (!text) {
    const fb = data?.candidates?.[0]?.finishReason;
    throw new Error('応答が空でした' + (fb ? `（finishReason: ${fb}）` : '') + '。入力を短くして再試行してください。');
  }
  return text;
}

/**
 * RAG検索用: クエリ文を専用中継(gemini-relay.gs)経由で text-embedding-004 でベクトル化する。
 * ※ 既定の共用中継(wood-decay-fungi)は embed 非対応。設定で専用中継URLに差し替えて使う。
 * @param {string} relayUrl - Geminiリレー(GAS)のURL
 * @param {string} text - 埋め込む文
 * @returns {Promise<number[]>} 埋め込みベクトル
 */
export async function embedText(relayUrl, text) {
  if (!relayUrl) throw new Error('Geminiリレー(GAS)のURLが未設定です。');
  const res = await fetch(relayUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ embed: true, text }),
  });
  const raw = await res.text();
  let data;
  try { data = JSON.parse(raw); } catch { throw new Error('埋め込み中継応答の解析に失敗: ' + raw.slice(0, 200)); }
  if (data.error) {
    const detail = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
    throw new Error('埋め込み中継エラー: ' + detail);
  }
  const v = data?.embedding?.values;
  if (!Array.isArray(v)) throw new Error('埋め込みベクトルが取得できませんでした（中継が embed 非対応の可能性）。');
  return v;
}

// レポート用: 末尾にJSON出力を促し、パースして返す（失敗時は raw を consultReport に）。
export function parseReportJson(text) {
  let s = text.trim();
  const m = s.match(/\{[\s\S]*\}/);
  if (m) s = m[0];
  try {
    return JSON.parse(s);
  } catch {
    return { findings: '', differential: '', recommendedPrecision: '', riskTr: '', management: '', clientExplanation: '', uncertainties: '', consultReport: text.trim() };
  }
}
