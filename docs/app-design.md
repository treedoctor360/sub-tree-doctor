# サブ樹木医アプリ 設計メモ（連携型・Gemini）

## 位置づけ（エコシステム）
- **shindanv27**：診断項目の入力（健全度14・活力度17）と総合判定・所見・地図・Excel。
- **wood-decay-fungi**：腐朽菌の同定（写真AI＋65種）。
- **サブ樹木医（本アプリ）**：上記の診断結果を受け、**2冊を根拠に対話で推論し、次の一手・精密診断の指示・危険度の見立て・処置方針を導き、相談記録として残す“頭脳”層**。重複を作らず、空きを埋める。

技術：既存と同じ **GAS→Gemini（透過中継、無改造で流用）＋ IndexedDB ＋ 記録GAS**。GitHub Pages公開。

---

## 1. 記録スキーマ（shindanv27 互換 ＋ サブ樹木医 拡張）
shindanv27 の record コアをそのまま持ち、相談結果フィールドを足す。

```
{
  // --- shindanv27 互換コア ---
  id, projectId, treeNo, surveyDate, inspector,
  species, nickname, location, treeHeight, trunkGirth, latitude, longitude,
  scores: { /* 活力度17項目 0-4 */ },
  health: { /* 健全度14項目 A-D */ },
  fungus: [], fungusOther,
  avg, worst, overall,          // 同一ロジックで再計算（下記2）
  findings,                     // 所見（shindanv27機能①の出力 or 対話で作成）

  // --- サブ樹木医 拡張 ---
  differential,                 // 想定要因・鑑別
  recommendedPrecision,         // 推奨精密診断（レジストグラフ/PiCUS/γ線/生長錐/エアースコップ）
  riskTr,                       // t/R比・開口空洞・反応材による危険度の見立て
  management,                   // 処置方針（存置/経過観察/治療/支持保護/伐採＋処置技術）
  clientExplanation,            // 依頼者への説明事項
  uncertainties,                // 未確定・現地実測が要る点
  consultReport,                // 生成した診断レポート全文
  advisor: "Gemini(サブ樹木医)",
  createdAt, updatedAt, synced_at
}
```

## 2. 総合判定ロジック（shindanv27 と同一）
- 活力度：有効項目の平均 → 衰退度 Ⅰ〜Ⅴ（<0.8 良 / <1.6 / <2.4 / <3.2 / ≧3.2 枯死寸前、日本緑化センター基準）。
- 健全度：最悪グレード（A<B<C<D）。
- 総合：worst=D∨avg≥3.2→**D 危険木** / worst=C∨avg≥2.4→**C 要注意** / worst=B∨avg≥1.6→**B 経過観察** / それ以外→**A 健全**。
- 表示は必ずこの計算結果を映す（shindanv27の方針を踏襲）。

## 3. 記録GAS の COLS（人が読める列＋_json 復元列。shindanv27の流儀）
```js
const COLS = [
  'record_id','created_at','updated_at','inspector','project','tree_no',
  'species','nickname','location','tree_height','trunk_girth','lat','lng',
  'overall_grade','overall_text','decline_avg','decline_level','worst_health',
  'findings','differential','recommended_precision','risk_tr','management',
  'client_explanation','uncertainties','consult_report','advisor',
  '_json','synced_at'
];
```
`scores/health/fungus` 等の全量は `_json` に格納（列爆発を防ぐ）。共有いただいた記録GASの `saveRecords/deleteRecords/doGet` はこの `COLS` 差し替えでそのまま動く。

## 4. システムプロンプト骨子（フロントが `system_instruction` に載せる）
```
あなたはベテランの先輩樹木医「サブ樹木医」。若手〜中堅樹木医の相談相手。
- 根拠は必ず下記「知識ベース」（樹木医の手引き4版／緑化樹木腐朽病害ハンドブックの要約）に置く。
  曖昧・範囲外は「現地確認・実測が必要」と正直に言い、断定しない。
- 相手はshindanv27で健全度14(A-D,最悪グレード)・活力度17(0-4,平均→衰退度Ⅰ-Ⅴ)を入力済み。
  総合判定 D=危険木 / C=要注意 / B=経過観察 / A=健全。この語彙とロジックを前提に話す。
- 進め方：①提示された所見・グレードを読み解く ②足りない点を1〜3点だけ聞き返す
  ③想定要因と鑑別（腐朽菌の“確定”はwood-decay-fungiアプリへ渡す）
  ④推奨する精密診断と的確な指示 ⑤t/R比・開口空洞・反応材で危険度を見立てる
  ⑥対応方針（存置/経過観察/治療/支持保護/伐採＋処置技術）をCODIT・過剰治療の戒めを踏まえ提示
  ⑦記録すべき事項と依頼者への説明。
- 安全最優先：根株腐朽▲・褐色腐朽★・大開口空洞＋傾きは、樹勢が良く見えても危険側で扱う。
- 最終診断・伐採の指示はしない。判断材料と選択肢を整え、最終判断と責任は樹木医。
- 出力は簡潔・実務的。必要に応じ箇条書き。出典（手引き/図鑑）を添える。
--- 知識ベース ---
{docs/knowledge-base.md を要約埋め込み}
--- 現在のカルテ ---
{樹種・場所・寸法／総合グレード・衰退度／健全度で気になる項目／活力度で高い項目／子実体}
```
毎ターン、この system_instruction ＋ 会話履歴（contents）を Gemini リレーへ送る。

## 5. 画面構成
- **カルテ（左／上タブ）**
  - 取り込み：shindanv27 記録のJSON貼付 → 自動反映。または主要項目を手入力。
  - 総合判定を自動計算表示（グレード＋衰退度Ⅰ〜Ⅴ、精密診断誘導の注意バナー）。
- **対話（中央）**：サブ樹木医とのチャット。カルテと総合グレードが文脈に入る。
- **「この診断を記録」**：モデルが診断レポート（鑑別／推奨精密診断／危険度／処置方針／未確定）を生成 → 編集可 → 保存（IndexedDB＋記録GAS同期）。
- **参照タブ**：t/R計算・精密診断機器・基礎知識（既存HTMLから流用）。
- **設定**：Geminiリレー URL、記録GAS URL＋トークン、担当者名（localStorage保存）。
- **記録一覧**：保存した相談記録、☁️同期／⬇️読込。

## 6. 実装ステップ（MVP）
1. 記録GAS（`COLS`差し替え版）を `gas/diagnosis-db-relay.gs` に用意 → ユーザーがデプロイ、URL/トークンを設定へ。
2. フロント（自己完結HTML or Vite）：カルテ＋対話＋記録＋設定＋参照タブ。Geminiリレーは既存を流用（設定で変更可）。
3. GitHub Actions → Pages 公開。

## 7. 前提・免責
危険度・グレードは目安。最終判断と責任は樹木医。安全最優先・過剰治療の戒め・自然樹形の尊重（EBD倫理）。
出典：樹木医の手引き4版／緑化樹木腐朽病害ハンドブック。
