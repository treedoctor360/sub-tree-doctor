// サブ樹木医の system_instruction を組み立てる。
import { KNOWLEDGE_BASE } from '../data/knowledgeBase.js';
import { summarizeKarte } from './karteSummary.js';
import { retrieve } from './retrieve.js';

export const PERSONA = `あなたはベテランの先輩樹木医「サブ樹木医」。若手〜中堅の樹木医の相談相手として、共に考え、的確な指示を出し、診断結論へ導く。

【厳守】
- 根拠は必ず下記「知識ベース」（樹木医の手引き4版／緑化樹木腐朽病害ハンドブックの要約）に置く。範囲外・曖昧な点は「現地確認・実測が必要」と正直に言い、推測と根拠を分ける。
- 相手は診断入力システムで健全度14項目(A-D,最悪グレード)・活力度17項目(0-4,平均→衰退度Ⅰ-Ⅴ)を入力済み。総合判定 D=危険木 / C=要注意 / B=経過観察 / A=健全。この語彙とロジックを前提に話す。
- 進め方: ①提示された所見・グレードを読み解く ②診断に効く順に足りない点を1〜3点だけ聞き返す（一度に質問攻めにしない）③想定要因と鑑別（腐朽菌の“確定”はwood-decay-fungiアプリに委ねると伝える）④推奨する精密診断と的確な指示 ⑤t/R比・開口空洞・反応材で危険度を見立てる ⑥対応方針（存置/経過観察/治療/支持保護/伐採＋処置技術）をCODIT・過剰治療の戒めを踏まえ提示 ⑦記録すべき事項と依頼者への説明。
- 安全最優先: 根株腐朽▲・褐色腐朽★・大開口空洞＋傾きは、樹勢が良く見えても危険側で扱う。
- 断定的な最終診断・伐採指示はしない。判断材料と選択肢を整え、最終判断と責任は樹木医にあると明確にする。
- 出力は簡潔・実務的に。必要に応じ箇条書き。関連する出典（手引き/図鑑）を一言添える。日本語で答える。`;

// 取得チャンクを出典タグ付きで整形（AIには【n】で引用させる）。
function formatChunks(chunks) {
  return chunks
    .map((c, i) => {
      const cite = [c.book, c.pageBatch ? `p.${c.pageBatch}` : '', c.section ? `〔${c.section}〕` : '']
        .filter(Boolean).join(' ');
      return `【${i + 1}｜${cite}】\n${c.text}`;
    })
    .join('\n\n');
}

/**
 * system_instruction を組み立てる。
 * 知識ベースURL(config.kbEmbeddingsUrl)が設定されていれば、相談文(query)で2冊本文を検索して
 * 関連箇所だけを注入するRAGモードで動く。未設定・取得失敗時は静的KB(KNOWLEDGE_BASE)にフォールバック。
 */
export async function buildSystemInstruction(record, config, query) {
  let knowledge = KNOWLEDGE_BASE;
  let note = '';
  if (config?.kbEmbeddingsUrl && query) {
    try {
      const chunks = await retrieve(config.geminiRelayUrl, config.kbEmbeddingsUrl, query, 6);
      if (chunks && chunks.length) {
        knowledge = formatChunks(chunks);
        note = '（相談内容に関連する箇所を樹木医必携の2冊から検索して抜粋。使った箇所は末尾で【n】として出典を添えること）\n';
      }
    } catch { /* 検索失敗時は静的KBへフォールバック */ }
  }
  return (
    PERSONA +
    '\n\n--- 知識ベース ---\n' + note +
    knowledge +
    '\n\n--- 現在のカルテ ---\n' +
    summarizeKarte(record)
  );
}

// 診断記録レポートの生成を促す最終指示（JSONで返させる）。
export const REPORT_INSTRUCTION = `これまでの対話とカルテを踏まえ、診断記録を作成する。次のキーだけを持つJSONを、コードブロックや前置きなしで出力せよ（値は日本語、該当なしは空文字）:
{"findings":"所見の要約","differential":"想定要因と鑑別","recommendedPrecision":"推奨する精密診断と指示","riskTr":"危険度の見立て(t/R・開口空洞・標的など)","management":"対応方針(存置/経過観察/治療/支持保護/伐採＋処置技術)","clientExplanation":"依頼者への説明事項","uncertainties":"未確定・現地実測が要る点","consultReport":"上記を統合した診断レポート本文(数段落)"}`;
