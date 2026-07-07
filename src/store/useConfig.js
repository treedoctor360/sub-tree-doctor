// 設定（localStorage）。Geminiリレー・記録GAS・担当者名。
import { useCallback, useEffect, useState } from 'react';

const KEY = 'subtreedoc.config.v1';

// 既定の Geminiリレーは wood-decay-fungi の透過中継を流用（設定で変更可）。
const DEFAULTS = {
  geminiRelayUrl: 'https://script.google.com/macros/s/AKfycbwfSHmBl8VYy635RPq0hnc_q_wJw1Cgrg0NzXDcucBmK0jTVOvDKbMxeYqvr-UtCyJ9fQ/exec',
  gasDbUrl: '',
  gasToken: '',
  inspector: '',
  // RAGの知識ベース(knowledgeEmbeddings.json)の配信URL。非公開(Drive等)を想定。
  // 未設定なら静的KB(knowledgeBase.js)にフォールバック。
  kbEmbeddingsUrl: '',
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
