#!/usr/bin/env node
// 樹木医必携2冊のOCR Markdown を、章節見出し優先でチャンク化 → Gemini text-embedding-004 で埋め込み
// → knowledgeEmbeddings.json を生成する（オフライン実行、Node 18+）。
//
// 【重要】出力JSONは書籍本文を含むため非公開（第三者の著作物）。公開リポジトリ/Pages に置かないこと。
//         非公開の場所（Drive / 限定公開GAS）から配信し、アプリはURLでfetchする。
//
// 使い方:
//   GEMINI_API_KEY=xxxx node scripts/build-embeddings.mjs \
//     --in tebiki=./tebiki_full.md \
//     --in handbook=./handbook_full.md \
//     --out ./knowledgeEmbeddings.json
//
//   book キー: tebiki=樹木医の手引き4版 / handbook=緑化樹木腐朽病害ハンドブック
//   OCRノートブックが挿入する <!-- batch NNNN-NNNN --> をページ範囲メタとして拾う。
//
//   --dry-run を付けると、埋め込みAPIを呼ばずチャンク分割の統計だけを表示する
//   （GEMINI_API_KEY 不要・費用ゼロ。本実行前の確認用）。

import { readFileSync, writeFileSync } from 'node:fs';

const MODEL = 'gemini-embedding-001';   // text-embedding-004 は廃止。後継の安定版。
const OUTPUT_DIM = 768;                 // MRLで次元を縮約（既定3072はJSONが巨大に）。クエリ側(gemini-relay.gs)と必ず一致させること。
const EMBED_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:embedContent`;
const CHUNK = 600;     // 1チャンクの目安文字数
const OVERLAP = 100;   // 前チャンクとの重複文字数（文脈切れ防止）
const MIN_LEN = 40;    // これ未満の断片は捨てる
const SLEEP_MS = 200;  // 埋め込みAPIの間隔

// book キーごとの既定メタ（体系タグ・出典）。HANDOFF §5 準拠。
const BOOK_META = {
  tebiki:   { book: '樹木医の手引き4版',           system: 'shindan-14-17',   guideSource: 'tebiki' },
  handbook: { book: '緑化樹木腐朽病害ハンドブック', system: 'chofu-byougai-11', guideSource: 'handbook11' },
};

function parseArgs(argv) {
  const inputs = [];
  let out = './knowledgeEmbeddings.json';
  let dryRun = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--in') {
      const [key, path] = String(argv[++i] || '').split('=');
      if (!key || !path) throw new Error('--in は book=path 形式で指定してください（例: --in tebiki=./tebiki_full.md）');
      if (!BOOK_META[key]) throw new Error(`未知の book キー: ${key}（有効: ${Object.keys(BOOK_META).join(', ')}）`);
      inputs.push({ key, path });
    } else if (argv[i] === '--out') {
      out = argv[++i];
    } else if (argv[i] === '--dry-run') {
      dryRun = true;
    }
  }
  if (!inputs.length) throw new Error('少なくとも1つ --in book=path を指定してください。');
  return { inputs, out, dryRun };
}

// OCR由来のノイズ除去（YomiTokuのエスケープ \(→( 等、余分な空白の圧縮）。
function clean(s) {
  return s
    .replace(/\\([()\-[\]#*_])/g, '$1')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// 見出し由来で guideSource を細分（VTA/CODIT を拾えれば付ける）。
function refineGuide(base, section) {
  const s = section || '';
  if (base === 'tebiki' && /VTA|外観|力学|樹形/i.test(s)) return 'tebiki-VTA';
  if (base === 'tebiki' && /CODIT|防御層|区画|腐朽/i.test(s)) return 'tebiki-CODIT';
  return base;
}

// 見出し・batch印を区切りに、章節ごと→スライディングウィンドウでチャンク生成。
function* chunksFromDoc(raw, meta) {
  const lines = raw.split(/\r?\n/);
  let pageBatch = '';
  let section = meta.book;
  let buf = [];

  function* flush() {
    const body = clean(buf.join('\n'));
    buf = [];
    if (body.length < MIN_LEN) return;
    const step = CHUNK - OVERLAP;
    for (let i = 0; i < body.length; i += step) {
      const text = body.slice(i, i + CHUNK).trim();
      if (text.length >= MIN_LEN) {
        yield { section, pageBatch, text, guideSource: refineGuide(meta.guideSource, section) };
      }
      if (i + CHUNK >= body.length) break;
    }
  }

  for (const line of lines) {
    const bm = line.match(/<!--\s*batch\s+([0-9-]+)\s*-->/);
    if (bm) { yield* flush(); pageBatch = bm[1]; continue; }
    const hm = line.match(/^#{1,6}\s+(.*)$/);
    if (hm) { yield* flush(); const t = clean(hm[1]); if (t) section = t; continue; }
    buf.push(line);
  }
  yield* flush();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function embed(text, key, attempt = 0) {
  const res = await fetch(`${EMBED_URL}?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: `models/${MODEL}`,
      content: { parts: [{ text }] },
      taskType: 'RETRIEVAL_DOCUMENT',   // コーパス文書側。クエリ側は RETRIEVAL_QUERY。
      outputDimensionality: OUTPUT_DIM,
    }),
  });
  if (res.status === 429 && attempt < 5) {
    const wait = 2000 * (attempt + 1);
    console.warn(`  レート制限。${wait}ms待機して再試行(${attempt + 1}/5)…`);
    await sleep(wait);
    return embed(text, key, attempt + 1);
  }
  if (!res.ok) throw new Error(`embedContent 失敗 ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const v = data?.embedding?.values;
  if (!Array.isArray(v)) throw new Error('埋め込みベクトルが取得できませんでした: ' + JSON.stringify(data).slice(0, 200));
  return v;
}

async function main() {
  const { inputs, out, dryRun } = parseArgs(process.argv.slice(2));
  const key = process.env.GEMINI_API_KEY;
  if (!dryRun && !key) { console.error('環境変数 GEMINI_API_KEY を設定してください。'); process.exit(1); }

  // 1) 全書からチャンクを収集
  const chunks = [];
  for (const { key: bookKey, path } of inputs) {
    const meta = BOOK_META[bookKey];
    const raw = readFileSync(path, 'utf-8');
    let n = 0;
    for (const c of chunksFromDoc(raw, meta)) {
      chunks.push({
        id: `${bookKey}-${String(n).padStart(4, '0')}`,
        book: meta.book, bookKey,
        system: meta.system, guideSource: c.guideSource,
        section: c.section, pageBatch: c.pageBatch,
        text: c.text,
      });
      n++;
    }
    console.log(`${meta.book}: ${n} チャンク（${path}）`);
  }

  // --dry-run: 埋め込みを回さず、分割結果の統計だけ出して終了（APIキー不要・費用ゼロ）
  if (dryRun) {
    const lens = chunks.map((c) => c.text.length);
    const sum = lens.reduce((a, b) => a + b, 0);
    const min = Math.min(...lens), max = Math.max(...lens);
    const bySrc = {};
    for (const c of chunks) bySrc[c.guideSource] = (bySrc[c.guideSource] || 0) + 1;
    console.log('\n=== ドライラン結果（埋め込み未実行）===');
    console.log(`合計チャンク数: ${chunks.length}`);
    console.log(`文字数 平均/最小/最大: ${Math.round(sum / chunks.length)} / ${min} / ${max}`);
    console.log('guideSource 別:', JSON.stringify(bySrc));
    console.log('\n--- 先頭3チャンクのプレビュー ---');
    for (const c of chunks.slice(0, 3)) {
      console.log(`[${c.id}] batch=${c.pageBatch} section=「${c.section}」`);
      console.log('  ' + c.text.slice(0, 80).replace(/\n/g, ' ') + '…');
    }
    console.log('\n問題なければ、--dry-run を外して本実行してください。');
    return;
  }

  console.log(`合計 ${chunks.length} チャンクを埋め込みます…`);

  // 2) 埋め込み付与
  let dim = 0;
  for (let i = 0; i < chunks.length; i++) {
    const v = await embed(chunks[i].text, key);
    chunks[i].vector = v;
    dim = v.length;
    if ((i + 1) % 25 === 0 || i === chunks.length - 1) console.log(`  ${i + 1}/${chunks.length} 完了`);
    await sleep(SLEEP_MS);
  }

  // 3) 出力
  const payload = {
    model: MODEL, dim, createdAt: new Date().toISOString(),
    count: chunks.length, chunks,
  };
  writeFileSync(out, JSON.stringify(payload), 'utf-8');
  console.log(`書き出し完了: ${out}（${chunks.length}件 / ${dim}次元）`);
  console.log('※ このファイルは非公開。Drive等に置き、アプリの設定「知識ベースURL」に配信URLを登録してください。');
}

main().catch((e) => { console.error('エラー:', e.message); process.exit(1); });
