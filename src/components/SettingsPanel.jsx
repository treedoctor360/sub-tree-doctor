export default function SettingsPanel({ config, update }) {
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
