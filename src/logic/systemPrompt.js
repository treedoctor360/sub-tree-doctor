// サブ樹木医の system_instruction を組み立てる。
import { KNOWLEDGE_BASE } from '../data/knowledgeBase.js';
import { summarizeKarte } from './karteSummary.js';
import { retrieve } from './retrieve.js';
import { HEALTH_ITEMS } from '../data/healthItems.js';     // ① 検索クエリ拡張用
import { DECLINE_ITEMS, DECLINE_ITEM_IDS } from '../data/declineItems.js';   // ① 検索クエリ拡張用
import { detectTreeClasses, CLASS_TERM } from '../data/treeClass.js'; // 検索の取りこぼし低減（針葉樹/広葉樹の分類語）
import { evaluateRecord } from './diagnosis.js';
import { buildSiteQuery, summarizeNeighbor, neighborIsHealthy } from './siteContext.js';

export const PERSONA = `あなたはベテランの先輩樹木医「サブ樹木医」。若手〜中堅の樹木医の相談相手として、共に考え、的確な指示を出し、診断結論へ導く。

【厳守】
- 根拠は必ず下記「知識ベース」（樹木医の手引き4版／緑化樹木腐朽病害ハンドブックの要約）に置く。範囲外・曖昧な点は「現地確認・実測が必要」と正直に言い、推測と根拠を分ける。
- 相手は診断入力システムで健全度14項目(A-D,最悪グレード)・活力度17項目(0-4,平均→衰退度Ⅰ-Ⅴ)を入力済み。総合判定 D=危険木 / C=要注意 / B=経過観察 / A=健全。この語彙とロジックを前提に話す。
- 進め方: ①提示された所見・グレードを読み解く ②診断に効く順に足りない点を1〜3点だけ聞き返す（一度に質問攻めにしない）③想定要因と鑑別（腐朽菌の“確定”はwood-decay-fungiアプリに委ねると伝える）④推奨する精密診断と的確な指示 ⑤t/R比・開口空洞・反応材で危険度を見立てる ⑥対応方針（存置/経過観察/治療/支持保護/伐採＋処置技術）をCODIT・過剰治療の戒めを踏まえ提示 ⑦記録すべき事項と依頼者への説明。
- 危険度は「外観(VTA)→力学(t/R比)→区画(CODIT/防御層)」の順に見立てる。空洞・傾き・反応材・キノコの発生が示されたら、判断の前に必要な計測（t/R比の t・R 等）を尋ねる。会話に「【現地計測】t/R=…」がある場合はその確定値を根拠に用い、自分で計算し直さない。
- 写真が添付された場合: 見える所見（子実体・空洞・傷・枯れ枝・胴枯れ・樹形の偏り等）を具体的に言語化し、想定要因と鑑別を挙げる。写真だけで断定せず、確定に要る精密診断を推奨する。腐朽菌の“種の確定”は wood-decay-fungi アプリに委ねる。
- 【複合要因の原則（手引き4版・総合診断／病気の概念）】樹木の異常・衰退は単一原因とは限らず、素因（樹種・個体の弱さ）＋誘因（環境・立地・人為＝踏圧・盛土・水環境・強剪定/フラッシュカット・機械傷・車両衝突・支柱擦れ・大気/塩害 等）＋主因が重なって起こることが多い。「病原体（腐朽菌）が存在しても樹木が病気にかかる・それが主因とは限らない」。子実体・腐朽の所見は「腐朽が存在する」事実であって、衰退の主因と即断しない（腐朽は損傷やストレスの“結果”＝二次的なことも多い）。
- したがって腐朽に飛びつかず、まず他要因を広く鑑別してから腐朽の可能性を位置づける。腐朽菌の候補を挙げるときも「腐朽が疑われる要因の一つ」として示し、他要因（生理的衰退・環境・人為・病害虫等）を排除するものではないと必ず添える。1つの原因に決めつけず、複合の可能性を保つ。
- 発生の時系列（いつから）・被害の範囲と分布・方向性、周囲の下層植生や他個体の状態も重視する（手引きの診断手順）。大木と下層植生の両方に異常があるなら、土壌悪化など共通・環境要因を疑う。可逆な誘因（土壌・水・人為）は改善策の検討対象にする。
- 安全最優先: 根株腐朽▲・褐色腐朽★・大開口空洞＋傾きは、樹勢が良く見えても危険側で扱う（※これは危険度の扱いであり、衰退の主因を腐朽と断定する意味ではない）。
- 断定的な最終診断・伐採指示はしない。判断材料と選択肢を整え、最終判断と責任は樹木医にあると明確にする。
- 資料（知識ベース）に該当する菌種・診断項目は、要点を省かず漏れなく挙げる。同じ相談には同じ範囲を一貫して示し、回答ごとに項目が増減しないようにする。
- 【確度の明示】診断・見立て・助言を述べるときは、回答の末尾に必ず次の3点を簡潔に（各1〜2行・箇条書き）添える:
  ・確からしさ〔高／中／低〕… なぜその確度か一言（例: 所見が少ない／未計測／鑑別が未絞りなら低）。
  ・確定していること／未確定なこと … 現物・実測で確かめるべき点を分けて書く。
  ・次に確かめる1点 … 最も診断を左右する観察・計測を「1つだけ」示す（質問攻めにしない）。
  情報が乏しいほど確度は低とし、低い時は断定せず「現地確認・実測が必要」を明示する。写真のみ・未計測では確度を上げない。過信を避け安全側に倒す。（記録レポートの「未確定・現地実測が要る点」とも齟齬させない）
- 出力は簡潔・実務的に。必要に応じ箇条書き。関連する出典（手引き/図鑑）を一言添える。日本語で答える。
- 【現地コンテキストの原則】提示された「現地コンテキスト」は、対象木を相対評価するための対照群・背景情報である。次の順で用いる:
  ①現地全体・近接木にも同様の異常があるなら、共通要因（土壌・水環境・大気・気象・管理・工事等）を優先して鑑別する。
  ②対象木だけが突出して不良で近接木が健全なら、個体固有の要因（根の損傷・腐朽・傷・素因・局所的な人為）に絞り込む。近接木が健全であることは「情報が無い」のではなく、個体固有要因を示唆する積極的な情報として扱う。
  ③近接木に所見（キノコ・虫害・枝枯れ・葉の異常等）がある場合、それは「対象木にも同じことが起こりうる」という仮説の材料であり、対象木の主因が確定したことを意味しない。特に近接木にキノコがあっても、対象木の衰退主因が腐朽であると即断しない（資料に「根株腐朽菌のすべてが根系を介して感染するわけではない」と明記されている）。
  ④近接木・現地情報が無い、または少ない場合は「判定保留」とし、推論を膨らませない。乏しい情報から断定しないこと。
- 【非対称の原則】健全な近接木は「共通要因が無い」という強い陰性証拠なので、個体固有要因へ候補を絞る材料に使ってよい。一方、異常な近接木は弱い示唆にすぎないので、対象木の鑑別候補を「増やす」だけに用い、他候補を消したり主因を上書きしたりしない。周辺の派手な所見に引きずられて鑑別を1つに畳まないこと。
- 【確度の結合】結論が対象木自身の直接所見・実測ではなく現地コンテキスト（近接木・履歴・環境）に依拠している場合、確からしさは必ず〔中〜低〕とし「仮説」と明示する。近接木の所見だけで確度を上げない。
- 【機械判定の扱い】「【システム規則】機械判定(P1/P2/P3)」はグレードの粗い比較にすぎず、書籍の記述でもない。現物所見が判定と食い違う場合は現物を優先し、その旨を述べてよい。機械判定を絶対視しない。
- 【要因の等価扱い】現地コンテキストは腐朽菌の検出のためのものではない。腐朽菌・穿孔性害虫・生理的衰退・土壌/水/大気環境・人為（掘削・踏圧・盛土・強剪定・薬剤・機械傷）・気象を等価な候補として扱い、現地の実データが指す方向に従う。特定の要因に先回りして寄らない。
- 【過去の経緯】工事・掘削・舗装改修・強剪定等の履歴は、根の切断や傷口を通じて後年の異常の誘因になりうる。誘因（履歴・環境）と主因（病原・害虫等）を分けて記述し、連鎖として説明する（単一原因に決めつけない）。
- 【出典の区別】「【システム規則】機械判定」はこのシステムが計算した結果であり書籍の記述ではない。書籍引用は【n】で示し、機械判定・一般知識と混同させない。知識ベースに無い文献（街路樹診断マニュアル等）を出典として引用しない。`;

// ① 検索クエリをカルテ構造値で拡張する。ユーザー文（診たい内容）を主に、対象木の状態を補助的に足して
//    「その木に効く箇所」を引けるようにする。全体を約400字で打ち切り、埋め込みが薄まりすぎないようにする。
function buildRetrievalQuery(record, userText) {
  const parts = [];
  if (userText && userText.trim()) parts.push(userText.trim());
  if (record) {
    if (record.species) parts.push(record.species);
    const health = record.health || {};
    const abn = HEALTH_ITEMS.filter((i) => health[i.id] && health[i.id] !== 'A').map((i) => i.label);
    if (abn.length) parts.push(abn.join(' '));
    const scores = record.scores || {};
    const bad = DECLINE_ITEMS
      .filter((i) => {
        const s = Number(scores[i.id]);
        return scores[i.id] != null && scores[i.id] !== '' && !Number.isNaN(s) && s >= 2;
      })
      .map((i) => i.label);
    if (bad.length) parts.push(bad.join(' '));
    if (record.fungusOther) parts.push(record.fungusOther);
    if (record.findings) parts.push(record.findings);
  }
  // 検索の取りこぼし低減: 樹種名(カルテ＋ユーザー文)から針葉樹/広葉樹の分類語を足す。
  // 例「ラクウショウ」→「針葉樹」を付与し、本の“針葉樹の腐朽”章を引けるようにする（中立な分類語のみ）。
  const classes = detectTreeClasses(`${userText || ''} ${record?.species || ''}`);
  for (const c of classes) parts.push(CLASS_TERM[c]);
  return parts.join(' ').slice(0, 400);
}

// 取得チャンクを出典タグ付きで整形（AIには【n】で引用させる）。mkLabel で番号体系を切り替える（対象木=1..／現地=S1..）。
function citeOf(c) {
  return [c.book, c.pageBatch ? `p.${c.pageBatch}` : '', c.section ? `〔${c.section}〕` : ''].filter(Boolean).join(' ');
}
function formatChunks(chunks, mkLabel = (i) => i + 1) {
  return chunks.map((c, i) => `【${mkLabel(i)}｜${citeOf(c)}】\n${c.text}`).join('\n\n');
}
// book+pageBatch+section で重複判定するキー。
const chunkKey = (c) => `${c.book}|${c.pageBatch}|${c.section}`;

// 現地コンテキストブロックを組み立てる。siteContext が null なら '' を返す（＝現行と完全に同じプロンプト）。
function buildSiteBlock(sc) {
  if (!sc) return '';
  const { site, neighbors, history, pattern, sharedFindings, sameSpeciesControl } = sc;
  const L = ['\n\n--- 現地コンテキスト（対象木だけでは見えない情報）---'];
  if (site) {
    if (site.projectName) L.push('■ 案件: ' + site.projectName);
    L.push('■ 現地: ' + (site.name || '（無名）') + (site.kind ? `（${site.kind}）` : ''));
    if (site.history) L.push('■ 経緯・履歴: ' + site.history);
    if (site.environment) L.push('■ 立地環境: ' + site.environment);
    if (site.surroundings) L.push('■ 周辺情報: ' + site.surroundings);
  }
  if (history && history.length) {
    const seg = history.map((h) => {
      const e = evaluateRecord(h, DECLINE_ITEM_IDS);
      const d = (h.createdAt || '').slice(0, 7);
      const lvl = e.overall?.declineLevel ? `衰退度${e.overall.declineLevel}` : (e.overall ? `総合${e.overall.grade}` : '記録');
      return `${d} ${lvl}`;
    });
    L.push('■ 経年変化（同一個体）: ' + seg.join(' → '));
  }
  if (!neighbors || !neighbors.length) {
    L.push('■ 近接木: データなし（判定保留）');
  } else {
    L.push('■ 近接木（同一現地・距離順／同樹種を対照群とする）:');
    const unhealthy = neighbors.filter((n) => !neighborIsHealthy(n));
    const healthy = neighbors.filter((n) => neighborIsHealthy(n));
    for (const n of unhealthy) L.push('  - ' + summarizeNeighbor(n));
    // 陰性情報も情報: 健全な近接木も必ず載せる（多い場合は集計行に畳む）。
    const ex = healthy.slice(0, unhealthy.length ? 1 : 2);
    for (const n of ex) L.push('  - ' + summarizeNeighbor(n));
    const rest = healthy.length - ex.length;
    if (rest > 0) L.push(`  （他${rest}本は健全）`);
  }
  const patternText = {
    P1: 'P1（近接木の過半も不良／共通要因を優先鑑別）',
    P2: 'P2（対象木のみ突出して不良／近接木の過半は健全）',
    P4: 'P4（近接木が少なく判定保留）',
  }[pattern] || pattern;
  let v = '■ 【システム規則】機械判定: ' + patternText;
  if (sharedFindings && sharedFindings.length) v += `\n   併記: P3（近接木と一致する異常項目: ${sharedFindings.join('、')}）`;
  if (pattern === 'P1') v += '\n   → 共通要因（土壌・水・大気・気象・管理・工事等）を優先しつつ、個体固有要因も鑑別に残すこと';
  else if (pattern === 'P2') v += '\n   → 個体固有要因を優先鑑別しつつ、一致所見の共通性も検討すること';
  else v += '\n   → 近接木情報が乏しい。推論を膨らませず判定保留とすること';
  if (neighbors && neighbors.length && !sameSpeciesControl) {
    v += '\n   （注: 同樹種の対照木が2本未満。異樹種を含む比較のため共通性の判断は慎重に）';
  }
  L.push(v);
  return L.join('\n');
}

/**
 * system_instruction を組み立てる。
 * 知識ベースURL(config.kbEmbeddingsUrl)が設定されていれば、相談文＋カルテ構造値で2冊本文を検索して
 * 関連箇所だけを注入するRAGモードで動く。未設定・取得失敗時は静的KB(KNOWLEDGE_BASE)にフォールバック。
 * @returns {{instruction:string, refs:Array}} instruction=system_instruction本文 / refs=検索でヒットした出典(UI表示用)
 */
export async function buildSystemInstruction(record, config, query, stage, siteContext) {
  let knowledge = KNOWLEDGE_BASE;
  let note = '';
  let refs = []; // 検索でヒットした出典（UI表示用）。フォールバック時は空。
  let mode = 'static'; // 'rag'=2冊検索を注入 / 'static'=内蔵の要約KBにフォールバック
  let siteRefBlock = ''; // パス2（現地・近接木由来）で引いた参考資料。知識ベースとは分離する（★アンカリング対策）。
  const searchQuery = buildRetrievalQuery(record, query); // ① カルテ構造値で拡張
  if (config?.kbEmbeddingsUrl) {
    // パス1（主）: 相談文＋対象木カルテ構造値。top-k=8 を維持（網羅質問の取りこぼし対策・偏りは足さない）。
    let ragChunks = null;
    if (searchQuery) {
      try {
        ragChunks = await retrieve(config.geminiRelayUrl, config.kbEmbeddingsUrl, searchQuery, 8, config.geminiRelayToken);
      } catch { /* 検索失敗時は静的KBへ */ }
    }
    // パス2（従）: 現地の履歴/環境/周辺＋近接木の所見。菌名等のキュレーションは挟まない（現場データに従わせる）。
    let siteChunks = null;
    if (siteContext) {
      const siteQuery = buildSiteQuery(siteContext.site, siteContext.neighbors);
      if (siteQuery) {
        try {
          siteChunks = await retrieve(config.geminiRelayUrl, config.kbEmbeddingsUrl, siteQuery, 4, config.geminiRelayToken);
        } catch { /* パス2失敗は無視 */ }
      }
    }
    if (ragChunks && ragChunks.length) {
      knowledge = formatChunks(ragChunks);
      note = '（相談内容に関連する箇所を樹木医必携の2冊から検索して抜粋。使った箇所は末尾で【n】として出典を添えること）\n';
      refs = ragChunks.map((c, i) => ({
        n: i + 1, origin: '対象木', book: c.book || '', pageBatch: c.pageBatch || '', section: c.section || '',
      }));
      mode = 'rag';
    }
    // ★パス2の結果は知識ベースに混ぜず、別ブロックとして提示する（近接木由来で対象木の知識ベースを汚染しない）。
    if (siteChunks && siteChunks.length) {
      const seen = new Set((ragChunks || []).map(chunkKey));
      const uniq = siteChunks.filter((c) => !seen.has(chunkKey(c)));
      if (uniq.length) {
        siteRefBlock = '\n\n--- 参考資料（現地・近接木の所見から引いた／対象木の直接証拠ではない）---\n' +
          '（相談中の対象木そのものではなく、現地・近接木の状況から引いた背景資料。仮説の材料であり、対象木の結論の根拠にはしない）\n' +
          formatChunks(uniq, (i) => `S${i + 1}`);
        refs = [
          ...refs,
          ...uniq.map((c, i) => ({ n: `S${i + 1}`, origin: '現地', book: c.book || '', pageBatch: c.pageBatch || '', section: c.section || '' })),
        ];
      }
    }
  }
  // 案1 ガイド診断: stage が渡されたら、その段に集中させる指示を足す（結論への先走りを防ぐ）。
  const stageBlock = stage
    ? '\n\n--- ガイド診断（現在の段階） ---\n' +
      `いまは「${stage.label}」の段。目的: ${stage.goal}\n${stage.ask}\n` +
      'この段に集中し、後の段の結論へ先走らない。前段までに分かったことは踏まえてよい。'
    : '';
  const instruction = (
    PERSONA +
    '\n\n--- 知識ベース ---\n' + note +
    knowledge +
    '\n\n--- 現在のカルテ ---\n' +
    summarizeKarte(record) +
    buildSiteBlock(siteContext) +
    siteRefBlock +
    stageBlock
  );
  return { instruction, refs, mode };
}

// 診断記録レポートの生成を促す最終指示（JSONで返させる）。
export const REPORT_INSTRUCTION = `これまでの対話とカルテを踏まえ、診断記録を作成する。次のキーだけを持つJSONを、コードブロックや前置きなしで出力せよ（値は日本語、該当なしは空文字）:
{"findings":"所見の要約","differential":"想定要因と鑑別","recommendedPrecision":"推奨する精密診断と指示","riskTr":"危険度の見立て(t/R・開口空洞・標的など)","management":"対応方針(存置/経過観察/治療/支持保護/伐採＋処置技術)","clientExplanation":"依頼者への説明事項","siteRisk":"周辺・履歴からの見えないリスク（近接木・現地環境・過去の経緯から推測される、対象木の外観に現れていないリスク。該当なしは空文字）","uncertainties":"未確定・現地実測が要る点","consultReport":"上記を統合した診断レポート本文(数段落)"}`;
