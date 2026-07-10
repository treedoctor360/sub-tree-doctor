import { useState } from 'react';
import { embedText } from '../features/gemini.js';

export default function SettingsPanel({ config, update }) {
  const [testing, setTesting] = useState(false);
  const [relayResult, setRelayResult] = useState(null); // {ok, msg}
  const [kbResult, setKbResult] = useState(null);

  const testConnections = async () => {
    setTesting(true);
    setRelayResult(null);
    setKbResult(null);
    // 1) Geminiリレー: 短文を埋め込んで、到達＋トークン＋embed対応をまとめて確認（費用はごく僅か）。
    try {
      if (!config.geminiRelayUrl) throw new Error('Geminiリレー URL が未設定です。');
      const v = await embedText(config.geminiRelayUrl, '接続確認', config.geminiRelayToken);
      setRelayResult({ ok: true, msg: `接続OK（埋め込み ${v.length}次元の応答あり）` });
    } catch (e) {
      setRelayResult({ ok: false, msg: e.message });
    }
    // 2) 知識ベース: コーパスJSONを取得してチャンク数を確認（初回は数MB取得）。
    if (!config.kbEmbeddingsUrl) {
      setKbResult({ ok: false, msg: '未設定 → チャットは内蔵の「要約KB」で動作します。' });
    } else {
      try {
        const u = config.kbEmbeddingsUrl;
        const url = config.geminiRelayToken
          ? `${u}${u.includes('?') ? '&' : '?'}token=${encodeURIComponent(config.geminiRelayToken)}`
          : u;
        const res = await fetch(url);
        const raw = await res.text();
        let data;
        try { data = JSON.parse(raw); }
        catch { throw new Error('JSONでない応答（GASの公開設定やURLを確認）: ' + raw.slice(0, 120)); }
        if (data.error) throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error));
        const n = (data.chunks || []).length;
        if (!n) throw new Error('コーパスの chunks が空です。');
        setKbResult({ ok: true, msg: `接続OK（コーパス ${n}チャンク・model ${data.model || '?'} / dim ${data.dim || '?'}）` });
      } catch (e) {
        setKbResult({ ok: false, msg: e.message });
      }
    }
    setTesting(false);
  };

  return (
    <div className="settings">
      <p className="lead">AIの中継と記録の保存先を設定します。値はこの端末（localStorage）に保存され、外部には送られません。</p>
      <label className="field">
        <span>担当樹木医名</span>
        <input value={config.inspector} onChange={(e) => update({ inspector: e.target.value })} placeholder="記録の contributor に入ります" />
      </label>
      <label className="field">
        <span>Geminiリレー URL（GAS）</span>
        <input value={config.geminiRelayUrl} onChange={(e) => update({ geminiRelayUrl: e.target.value })} />
        <span className="hint">既定は wood-decay-fungi の透過中継を流用。RAG(知識ベース検索)を使うには gas/gemini-relay.gs をデプロイし、そのURL（embed対応の専用中継）に変更。</span>
      </label>
      <label className="field">
        <span>Geminiリレー トークン</span>
        <input value={config.geminiRelayToken} onChange={(e) => update({ geminiRelayToken: e.target.value })} placeholder="GASのスクリプトプロパティ TOKEN と一致させる" />
        <span className="hint">gas/gemini-relay.gs は合言葉トークンが一致しないと応答しません。友達に共有する場合は、このトークンとURLをセットで（非公開の手段で）渡してください。</span>
      </label>
      <label className="field">
        <span>知識ベースURL（埋め込みJSON・任意）</span>
        <input value={config.kbEmbeddingsUrl} onChange={(e) => update({ kbEmbeddingsUrl: e.target.value })} placeholder="未設定なら内蔵の要約KBで動作します" />
        <span className="hint">knowledgeEmbeddings.json(int8量子化・約5MB)の配信URL。書籍本文を含むため非公開に置くこと。Drive直リンクはCORSで読めないため、gas/gemini-relay.gs を配信元にし、上のGeminiリレーURLと同じ /exec URL を入れるのが簡単（GETで配信）。初回のみ取得し端末内(IndexedDB)にキャッシュ。</span>
      </label>

      <div className="field">
        <span>接続確認</span>
        <div className="row">
          <button className="btn" onClick={testConnections} disabled={testing}>
            {testing ? '確認中…' : '接続を確認'}
          </button>
        </div>
        {relayResult ? (
          <div className={relayResult.ok ? 'test-ok' : 'test-ng'}>
            Geminiリレー: {relayResult.ok ? '✓ ' : '✗ '}{relayResult.msg}
          </div>
        ) : null}
        {kbResult ? (
          <div className={kbResult.ok ? 'test-ok' : 'test-ng'}>
            知識ベース: {kbResult.ok ? '✓ ' : '△ '}{kbResult.msg}
          </div>
        ) : null}
        <span className="hint">「接続を確認」で、Geminiリレー（埋め込み応答）と知識ベース（コーパス取得）に実際につながるか試します。知識ベースが△＝未設定/取得失敗のときは、チャットは内蔵の要約KBで動作します（回答欄に「要約KB（内蔵）」と表示）。</span>
      </div>

      <label className="field">
        <span>記録GAS URL（診断DB中継）</span>
        <input value={config.gasDbUrl} onChange={(e) => update({ gasDbUrl: e.target.value })} placeholder="未設定でも端末内(IndexedDB)には保存されます" />
        <span className="hint">gas/diagnosis-db-relay.gs をデプロイし、そのURLを設定。共有スプレッドシートへ同期します。</span>
      </label>
      <label className="field">
        <span>記録GAS トークン</span>
        <input value={config.gasToken} onChange={(e) => update({ gasToken: e.target.value })} placeholder="GASのスクリプトプロパティ TOKEN と一致させる" />
      </label>
      <p className="muted small">出典：樹木医の手引き4版／緑化樹木腐朽病害ハンドブック。危険度・グレードは目安であり、最終判断と責任は樹木医が負う。</p>
    </div>
  );
}
