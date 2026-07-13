// GAS→Gemini 透過中継の呼び出し（wood-decay-fungi と同方式。Content-Type: text/plain でCORS回避）。
// リレーはフロントが組み立てた Gemini リクエストボディをそのまま generateContent へ渡す。

/**
 * @param {string} relayUrl - Geminiリレー(GAS)のURL
 * @param {string} systemInstruction - system_instruction のテキスト
 * @param {{role:'user'|'model', text:string, images?:{mimeType:string,data:string}[]}[]} history - 会話履歴
 * @param {string} [token] - リレーのスクリプトプロパティ TOKEN と一致させる合言葉
 * @returns {Promise<string>} モデルの応答テキスト
 */
export async function askGemini(relayUrl, systemInstruction, history, token) {
  if (!relayUrl) throw new Error('Geminiリレー(GAS)のURLが未設定です。設定タブで登録してください。');
  const body = {
    token,
    system_instruction: { parts: [{ text: systemInstruction }] },
    // 画像付きメッセージは inlineData を先頭に、続けてテキスト。gemini-2.5-flash はマルチモーダル対応。
    // 画像のみ（テキスト無し）のときは空テキストを付けない。
    contents: history.map((m) => {
      const parts = [];
      for (const im of (m.images || [])) parts.push({ inlineData: { mimeType: im.mimeType, data: im.data } });
      if (m.text) parts.push({ text: m.text });
      else if (!parts.length) parts.push({ text: '' });
      return { role: m.role, parts };
    }),
    // maxOutputTokens: gemini-2.5-flash は既定で内部「思考」にも出力トークンを使う。
    // 2048 では長めの回答が finishReason=MAX_TOKENS で途中で切れるため、思考＋本文に余裕を持たせる。
    generationConfig: { temperature: 0.2, topP: 0.9, maxOutputTokens: 8192 },
  };
  let res;
  try {
    res = await fetch(relayUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(body),
    });
  } catch (e) {
    // fetch自体が失敗（iOS Safariでは "Load failed"）。中継に到達できていない。
    throw new Error('リレーに接続できませんでした（' + e.message + '）。設定の「Geminiリレー URL」が /exec で正しいか、GASのデプロイの「アクセスできるユーザー」が「全員」になっているか確認してください。');
  }
  const raw = await res.text();
  let data;
  try { data = JSON.parse(raw); } catch { throw new Error('リレー応答の解析に失敗（HTMLが返っている可能性＝GASの公開設定やURLを確認）: ' + raw.slice(0, 200)); }
  if (data.error) {
    const detail = typeof data.error === 'string' ? data.error : (data.detail || JSON.stringify(data.error));
    throw new Error('Gemini中継エラー: ' + detail);
  }
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? '';
  const finish = data?.candidates?.[0]?.finishReason;
  if (!text) {
    throw new Error('応答が空でした' + (finish ? `（finishReason: ${finish}）` : '') + '。入力を短くして再試行してください。');
  }
  // トークン上限で途中終了したときは、切れたことが分かるよう一言添える（本文は保持）。
  if (finish === 'MAX_TOKENS') {
    return text + '\n\n…（回答が長く、途中で止まりました。「続けて」と送ると続きを出します）';
  }
  return text;
}

/**
 * RAG検索用: クエリ文を専用中継(gemini-relay.gs)経由で gemini-embedding-001 / 768次元 でベクトル化する。
 * ※ 既定の共用中継(wood-decay-fungi)は embed 非対応。設定で専用中継URLに差し替えて使う。
 * @param {string} relayUrl - Geminiリレー(GAS)のURL
 * @param {string} text - 埋め込む文
 * @param {string} [token] - リレーのスクリプトプロパティ TOKEN と一致させる合言葉
 * @returns {Promise<number[]>} 埋め込みベクトル
 */
export async function embedText(relayUrl, text, token) {
  if (!relayUrl) throw new Error('Geminiリレー(GAS)のURLが未設定です。');
  const res = await fetch(relayUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ embed: true, text, token }),
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
    return { findings: '', differential: '', recommendedPrecision: '', riskTr: '', management: '', clientExplanation: '', siteRisk: '', uncertainties: '', consultReport: text.trim() };
  }
}
