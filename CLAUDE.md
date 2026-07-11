# CLAUDE.md — サブ樹木医システム

樹木医の診断相談AI（React + Vite の SPA / GitHub Pages）。樹木医必携の2冊を根拠に
RAG検索し、gemini-2.5-flash で対話する。このファイルは「常に守る規約・制約」の蒸留版。
経緯の記録は `docs/HANDOFF-*.md`（時系列・履歴）を参照。

## 絶対に守ること（事故りやすい所）

- **著作権**: OCR本文 `*_full.md`（`tebiki_full.md` / `handbook_full.md`）とコーパス
  `knowledgeEmbeddings.json` は第三者著作物。**リポジトリ/Pages に置かない**（`.gitignore`済み）。
  参照はしてよいが、本文をコード・コミット・チャット出力へ大量に転記しない（短い要約・引用に留める）。
- **既定のリレーURLを埋め込まない**: `src/store/useConfig.js` の `geminiRelayUrl` 既定は空文字。
  特定の GAS URL をハードコードしない（URL露出＝課金キーへの入口の露出）。利用者が各自設定する。
- **リレーは2系統。混同しない**:
  - `gas/gemini-relay.gs` … 本アプリ専用（対話＋embed＋コーパス配信）。TOKEN認証あり。
  - wood-decay-fungi の共有リレー … 別アプリ用。**触らない**。
- **GASは手貼り運用**: リポジトリからデプロイしない。`gas/*.gs` を編集したら、GASエディタに貼り直し
  → スクリプトプロパティ設定 → **新バージョンで再デプロイ**（`/exec` URLは維持）。コード変更だけでは反映されない。
- **埋め込みモデルの整合**: コーパス生成(`scripts/build-embeddings.mjs`)とクエリ側(`gemini-relay.gs`)で
  **gemini-embedding-001 / outputDimensionality 768 / taskType** を一致させる（不一致でコサインが壊れる）。
  `text-embedding-004` は廃止済み。self-match は 1.0 にならないのが正常（DOCUMENT×QUERYの非対称）。
- **診断思想のガードレールを壊さない**: `src/logic/systemPrompt.js` の PERSONA は「主因・素因・誘因の複合」
  「病原体（腐朽菌）が存在しても主因とは限らない」「他要因を先に鑑別してから腐朽を位置づける」を保持する。
  腐朽菌カタログの常時注入や『必ず◯◯を挙げる』式のハードコードは**アンカリング/ハルシネーション源**なので避ける。

## デプロイ / Git

- **デプロイは `main` への push のみ**（`.github/workflows/deploy.yml` が `dist` を Pages へ）。
  作業ブランチに push しても本番は変わらない。→ 反映したい変更は `main` に入れる。
- push前に必ず `npm run build`（vite, 約51モジュール, エラーなし）でビルド確認。
- PR はユーザーが明示的に頼んだ時だけ作る。
- ローカルとクラウドの両方から `main` に push するため、push拒否時は `git fetch` → `git rebase origin/main`。

## アーキテクチャ（要点）

- RAG: `src/logic/retrieve.js` … クエリを embed → コーパス(int8+base64をInt8Arrayに復元)と
  cosine → top-k。コーパスは IndexedDB キャッシュ。未設定/失敗時は静的KB(`src/data/knowledgeBase.js`)へフォールバック。
- プロンプト組み立て: `src/logic/systemPrompt.js` … `buildSystemInstruction` が `{instruction, refs, mode}` を返す。
  `mode='rag'`（2冊検索）/`'static'`（要約KB）。`buildRetrievalQuery` が検索クエリをカルテ構造値＋
  樹種分類(`src/data/treeClass.js` 針葉樹/広葉樹の中立語)で拡張。
- 送信: `src/features/gemini.js` … `askGemini`/`embedText`。POSTボディに `token` を含める
  （GAS側で Gemini 転送前に `delete` 済み）。`maxOutputTokens: 8192`。
- 設定は端末内 `localStorage`（`src/store/useConfig.js`）、記録は IndexedDB（`src/db/db.js`）＋任意でGAS同期。
- UI: カルテ(`KartePanel`)は健全度14/活力度17をボタン選択。FABチャット(`ChatFab`/`ChatPanel`)。

## コマンド

- `npm run dev` / `npm run build` / `npm run preview`
- `GEMINI_API_KEY=xxx npm run build-embeddings`（コーパス生成。ローカルから直接 Gemini を叩く別系統。
  費用は課金キーに発生。生成後は Drive アップロード → `CORPUS_FILE_ID` 設定 → GAS再デプロイが手作業で必要）。
  **再生成前に `docs/corpus-corrections.md` の未反映OCR訂正をOCRマスターへ取り込むこと。**

## コミット規約

コミットメッセージ末尾に付ける:
```
Co-Authored-By: Claude <noreply@anthropic.com>
```
（モデル識別子や内部URL/キー/トークンの値はコミット・PR・コードに書かない。）
