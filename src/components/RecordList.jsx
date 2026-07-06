export default function RecordList({ records, onDelete, onSync, onPull, syncing, gasReady }) {
  return (
    <div className="record-list">
      <div className="row between">
        <p className="lead" style={{ margin: 0 }}>保存した相談記録（{records.length}件）</p>
        <div className="row">
          <button className="btn" onClick={onPull} disabled={!gasReady || syncing} title="共有スプレッドシートから取り込み">⬇️ 読込</button>
          <button className="btn" onClick={onSync} disabled={!gasReady || syncing || records.length === 0} title="共有スプレッドシートへ同期">☁️ 共有</button>
        </div>
      </div>
      {!gasReady ? <div className="muted small">※ 記録GAS未設定のため端末内(IndexedDB)のみ保存。設定で登録すると共有できます。</div> : null}
      {records.length === 0 ? <div className="empty">まだ記録がありません。対話後に「この診断を記録」で保存できます。</div> : null}
      <div className="cards">
        {[...records].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')).map((r) => {
          const cls = { A: 'ok', B: 'caution', C: 'treat', D: 'danger' }[r.overall?.grade] || '';
          return (
            <div className="rec-card" key={r.id}>
              <div className="rec-head">
                <span className="rec-title">{r.species || '樹種未設定'}{r.nickname ? `（${r.nickname}）` : ''}</span>
                {r.overall?.grade ? <span className={`pill ${cls}`}>{r.overall.grade}</span> : null}
              </div>
              <div className="muted small">{r.location || '場所未設定'} ／ {(r.updatedAt || '').slice(0, 16).replace('T', ' ')} ／ {r.inspector || '担当未設定'}</div>
              {r.management ? <div className="rec-line"><b>対応:</b> {r.management}</div> : null}
              {r.recommendedPrecision ? <div className="rec-line"><b>精密診断:</b> {r.recommendedPrecision}</div> : null}
              {r.consultReport ? <details className="rec-report"><summary>診断レポート</summary><pre>{r.consultReport}</pre></details> : null}
              <div className="row">
                <button className="btn small danger-outline" onClick={() => onDelete(r.id)}>削除</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
