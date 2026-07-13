// 設定（localStorage）。Geminiリレー・記録GAS・担当者名。
import { useCallback, useEffect, useState } from 'react';

const KEY = 'subtreedoc.config.v1';

// 中継URL・キー・トークンは端末ごとに各自が設定する（公開ビルドに特定のGAS URLを埋め込まない）。
// 既定を空にすることで、利用者は自分でデプロイした gas/gemini-relay.gs のURLを設定タブに入れて使う。
const DEFAULTS = {
  geminiRelayUrl: '',
  geminiRelayToken: '', // gas/gemini-relay.gs のスクリプトプロパティ TOKEN と一致させる
  gasDbUrl: '',
  gasToken: '',
  inspector: '',
  // RAGの知識ベース(knowledgeEmbeddings.json)の配信URL。非公開(Drive等)を想定。
  // 未設定なら静的KB(knowledgeBase.js)にフォールバック。
  kbEmbeddingsUrl: '',
  // 現地コンテキスト: 近接木の抽出パラメータ（座標がある場合の半径m / 最大本数）。
  neighborRadiusM: 10,
  neighborMax: 8,
};

export function loadConfig() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
  catch { return { ...DEFAULTS }; }
}

export function useConfig() {
  const [config, setConfig] = useState(loadConfig);
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(config)); } catch { /* ignore */ }
  }, [config]);
  const update = useCallback((patch) => setConfig((c) => ({ ...c, ...patch })), []);
  return [config, update];
}
