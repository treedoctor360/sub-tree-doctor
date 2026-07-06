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
