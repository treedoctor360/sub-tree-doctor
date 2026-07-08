/**
 * サブ樹木医 専用Gemini中継 v1.0（generateContent ＋ embedContent 両対応）
 *
 * 役割: フロント(GitHub Pages)から CORS を避けて Gemini を呼ぶための透過中継。
 *   - 対話生成: gemini-2.5-flash（system_instruction / contents をそのまま渡す）
 *   - クエリ埋め込み: gemini-embedding-001 / 768次元（RAGの検索クエリをベクトル化）
 *   本アプリ専用。wood-decay-fungi の共用中継とは分ける（あちらは触らない）。
 *
 * 【導入手順】
 *  1. GASプロジェクトを作成し本ファイルを貼り付け。
 *  2. プロジェクトの設定 → スクリプトプロパティに登録:
 *       GEMINI_API_KEY = Google AI Studio で発行した APIキー
 *       CHAT_MODEL     = gemini-2.5-flash（任意。未設定なら既定値）
 *       EMBED_MODEL    = gemini-embedding-001（任意。未設定なら既定値。build-embeddings.mjsと一致必須）
 *  3. デプロイ → 新しいデプロイ → 種類「ウェブアプリ」→ アクセス「全員」→ デプロイ。
 *  4. 発行URLをアプリの設定「Geminiリレー URL」に貼る（既定の共用中継から差し替え）。
 *
 *  ※ リクエスト判定:
 *     - body.embed === true かつ body.text があれば embedContent（埋め込み）
 *     - それ以外は generateContent（対話生成）。body は Gemini のリクエスト形をそのまま渡す。
 */

function PROP(k){ return PropertiesService.getScriptProperties().getProperty(k); }

function json(obj){
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e){
  try{
    const key = PROP('GEMINI_API_KEY');
    if(!key) return json({ error: 'GEMINI_API_KEY 未設定（スクリプトプロパティ）' });
    const body = JSON.parse(e.postData.contents);
    return (body && body.embed === true) ? embed(body, key) : generate(body, key);
  }catch(err){ return json({ error: String(err) }); }
}

// --- クエリ埋め込み（RAG検索用） ---
function embed(body, key){
  // ★ build-embeddings.mjs とモデル・次元を必ず一致させること（gemini-embedding-001 / 768次元）。
  //    違うとコサイン類似度が壊れ、検索が効かない。
  const model = PROP('EMBED_MODEL') || 'gemini-embedding-001';
  const text = String(body.text || '');
  if(!text) return json({ error: '埋め込み対象テキストが空です' });
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':embedContent?key=' + key;
  const payload = {
    model: 'models/' + model,
    content: { parts: [{ text: text }] },
    taskType: 'RETRIEVAL_QUERY',   // 検索クエリ側。コーパスは RETRIEVAL_DOCUMENT。
    outputDimensionality: 768,     // build-embeddings.mjs の OUTPUT_DIM と一致させる。
  };
  const res = UrlFetchApp.fetch(url, {
    method: 'post', contentType: 'application/json',
    payload: JSON.stringify(payload), muteHttpExceptions: true,
  });
  const data = JSON.parse(res.getContentText());
  if(data.error) return json({ error: data.error.message || JSON.stringify(data.error) });
  return json({ embedding: data.embedding }); // { embedding: { values: [...] } }
}

// --- 対話生成（透過中継） ---
function generate(body, key){
  const model = PROP('CHAT_MODEL') || 'gemini-2.5-flash';
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + key;
  const res = UrlFetchApp.fetch(url, {
    method: 'post', contentType: 'application/json',
    payload: JSON.stringify(body), muteHttpExceptions: true,
  });
  const data = JSON.parse(res.getContentText());
  if(data.error) return json({ error: data.error.message || JSON.stringify(data.error) });
  return json(data); // candidates[].content.parts[].text をフロントが取り出す
}
