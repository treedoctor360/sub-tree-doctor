// RAG検索: 相談文をクエリ埋め込み → コーパス(knowledgeEmbeddings.json)とコサイン類似度 → top-k。
// コーパス(書籍本文＋ベクトル)はIndexedDBにキャッシュ。未ロード/失敗時は null を返し、
// 呼び出し側は現行の静的KB(knowledgeBase.js)にフォールバックする。
import { embedText } from '../features/gemini.js';

const DB_NAME = 'sub-tree-doctor-kb';
const DB_VER = 1;
const STORE = 'corpus';

let memCache = null; // セッション内メモリキャッシュ（{ url, model, dim, chunks }）

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'url' });
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = () => reject(req.error);
  });
}

function idbGet(url) {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(url);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  }));
}

function idbPut(entry) {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  }));
}

// コーパスをロード（メモリ→IndexedDB→ネットワークの順）。URLが変われば取り直す。
async function loadCorpus(url) {
  if (memCache && memCache.url === url) return memCache;
  try {
    const cached = await idbGet(url);
    if (cached && Array.isArray(cached.chunks) && cached.chunks.length) { memCache = cached; return cached; }
  } catch { /* IndexedDB不可なら素通り */ }

  const res = await fetch(url);
  if (!res.ok) throw new Error(`知識ベースの取得に失敗（${res.status}）`);
  const data = await res.json();
  const entry = { url, model: data.model, dim: data.dim, chunks: data.chunks || [] };
  memCache = entry;
  try { await idbPut(entry); } catch { /* キャッシュ失敗は致命的でない */ }
  return entry;
}

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/**
 * 相談文に関連する知識チャンクを取得。
 * @returns {Promise<Array|null>} top-kのチャンク配列。コーパス未設定/未ロード時は null。
 */
export async function retrieve(relayUrl, corpusUrl, query, k = 6) {
  if (!corpusUrl || !query || !query.trim()) return null;
  const corpus = await loadCorpus(corpusUrl);
  if (!corpus || !corpus.chunks.length) return null;
  const qv = await embedText(relayUrl, query.trim());
  return corpus.chunks
    .map((c) => ({ c, score: cosine(qv, c.vector) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((x) => x.c);
}

// 設定変更時などにキャッシュを破棄したい場合に使う。
export function clearCorpusCache() { memCache = null; }
