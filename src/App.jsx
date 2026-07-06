import { useEffect, useState } from 'react';
import { useConfig } from './store/useConfig.js';
import { DECLINE_ITEM_IDS } from './data/declineItems.js';
import { evaluateRecord } from './logic/diagnosis.js';
import { idbGetAll, idbPut, idbRemove } from './db/db.js';
import { gasSaveRecords, gasGetAll } from './features/gasSync.js';
import KartePanel from './components/KartePanel.jsx';
import ChatPanel from './components/ChatPanel.jsx';
import RecordList from './components/RecordList.jsx';
import SettingsPanel from './components/SettingsPanel.jsx';
import ReferencePanel from './components/ReferencePanel.jsx';
import ReportModal from './components/ReportModal.jsx';

function newId() {
  return (crypto?.randomUUID?.() || 'r-' + Date.now() + '-' + Math.random().toString(16).slice(2));
}
function blankRecord() {
  return {
    id: newId(), projectId: '', treeNo: '', species: '', nickname: '', location: '',
    treeHeight: '', trunkGirth: '', latitude: '', longitude: '',
    scores: {}, health: {}, tebiki: {}, fungus: [], fungusOther: '', findings: '',
    createdAt: new Date().toISOString(),
  };
}

const TABS = [
  ['chat', '対話'], ['karte', 'カルテ'], ['record', '記録'], ['ref', '参照'], ['settings', '設定'],
];

export default function App() {
  const [config, updateConfig] = useConfig();
  const [tab, setTab] = useState('chat');
  const [record, setRecord] = useState(blankRecord);
  const [messages, setMessages] = useState([]);
  const [records, setRecords] = useState([]);
  const [draft, setDraft] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => { idbGetAll().then(setRecords).catch(() => {}); }, []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 3000); return () => clearTimeout(t); }, [toast]);

  const onKarteChange = (patch) => setRecord((r) => ({ ...r, ...patch }));

  const saveReport = async (fields) => {
    const { avg, worst, overall } = evaluateRecord(record, DECLINE_ITEM_IDS);
    const now = new Date().toISOString();
    const full = {
      ...record, ...fields,
      avg, worst, overall,
      advisor: 'Gemini(サブ樹木医)',
      inspector: config.inspector || record.inspector || '',
      transcript: messages,
      createdAt: record.createdAt || now, updatedAt: now,
    };
    await idbPut(full);
    setRecords((rs) => [full, ...rs.filter((x) => x.id !== full.id)]);
    setDraft(null);
    setToast('端末内に記録しました。');
    // 記録GAS があれば同期
    if (config.gasDbUrl) {
      try { await gasSaveRecords(config.gasDbUrl, config.gasToken, [full]); setToast('記録し、共有スプレッドシートへ同期しました。'); }
      catch (e) { setToast('端末内に記録（同期失敗: ' + e.message + '）'); }
    }
    // 次の診断へ備え、新しいカルテIDにする（内容は保持）
    setRecord((r) => ({ ...r, id: newId(), createdAt: now }));
  };

  const deleteRecord = async (id) => {
    await idbRemove(id);
    setRecords((rs) => rs.filter((r) => r.id !== id));
    setToast('削除しました。');
  };

  const syncUp = async () => {
    setSyncing(true);
    try { await gasSaveRecords(config.gasDbUrl, config.gasToken, records); setToast('共有しました。'); }
    catch (e) { setToast('共有失敗: ' + e.message); }
    finally { setSyncing(false); }
  };
  const pullDown = async () => {
    setSyncing(true);
    try {
      const remote = await gasGetAll(config.gasDbUrl);
      const map = new Map(records.map((r) => [r.id, r]));
      for (const r of remote) {
        const cur = map.get(r.id);
        if (!cur || (r.updatedAt || '') > (cur.updatedAt || '')) { map.set(r.id, r); await idbPut(r); }
      }
      setRecords([...map.values()]);
      setToast(`読込: ${remote.length}件を確認しました。`);
    } catch (e) { setToast('読込失敗: ' + e.message); }
    finally { setSyncing(false); }
  };

  const newKarte = () => { setRecord(blankRecord()); setMessages([]); setToast('新しいカルテを開始しました。'); };

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="logo" aria-hidden="true">🌳</span>
          <div>
            <div className="app-title">サブ樹木医システム</div>
            <div className="app-sub">樹木医必携の2冊を根拠に、共に考える先輩樹木医</div>
          </div>
        </div>
        <button className="btn ghost" onClick={newKarte}>＋ 新規カルテ</button>
      </header>

      <nav className="tabbar">
        {TABS.map(([id, label]) => (
          <button key={id} className={`tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>{label}</button>
        ))}
      </nav>

      <main className="main">
        {tab === 'chat' && (
          <div className="split">
            <section className="pane karte-pane">
              <h2 className="pane-title">カルテ</h2>
              <KartePanel record={record} onChange={onKarteChange} />
            </section>
            <section className="pane chat-pane">
              <ChatPanel config={config} record={record} messages={messages} setMessages={setMessages}
                onReport={(d) => setDraft(d)} />
            </section>
          </div>
        )}
        {tab === 'karte' && (
          <section className="pane"><KartePanel record={record} onChange={onKarteChange} /></section>
        )}
        {tab === 'record' && (
          <section className="pane">
            <RecordList records={records} onDelete={deleteRecord} onSync={syncUp} onPull={pullDown}
              syncing={syncing} gasReady={!!config.gasDbUrl} />
          </section>
        )}
        {tab === 'ref' && <section className="pane"><ReferencePanel /></section>}
        {tab === 'settings' && <section className="pane"><SettingsPanel config={config} update={updateConfig} /></section>}
      </main>

      {draft ? <ReportModal draft={draft} onSave={saveReport} onClose={() => setDraft(null)} /> : null}
      {toast ? <div className="toast">{toast}</div> : null}

      <footer className="app-foot">
        出典：樹木医の手引き4版／緑化樹木腐朽病害ハンドブック。危険度・グレードは目安であり、最終判断と責任は樹木医が負う。
        腐朽菌の同定は <a href="https://treedoctor360.github.io/wood-decay-fungi/" target="_blank" rel="noopener">wood-decay-fungi</a>。
      </footer>
    </div>
  );
}
