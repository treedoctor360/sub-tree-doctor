import { useEffect } from 'react';
import ChatPanel from './ChatPanel.jsx';

// フローティングのAIチャット。右下のボタンで開閉し、下からせり上がるシートに ChatPanel を内包する。
// ChatPanel 自体は変更せず、開閉のガワだけを足す（既存の対話ロジックはそのまま）。
export default function ChatFab({ open, setOpen, config, record, records, sites, messages, setMessages, onReport }) {
  // チャットを開いている間は背景（本体）のスクロールを止める（後ろの画面が動くのを防ぐ）。
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // 現在のカルテの見出し（何を根拠に相談しているかを一目で分かるように）
  const subject = [record?.species, record?.nickname || record?.treeNo]
    .filter(Boolean).join(' / ') || '対象木 未設定';

  return (
    <>
      {/* せり上がるチャットシート */}
      <div className={`chat-overlay ${open ? 'open' : ''}`} aria-hidden={!open}>
        <button className="chat-backdrop" aria-label="チャットを閉じる" onClick={() => setOpen(false)} />
        <div className="chat-sheet" role="dialog" aria-label="サブ樹木医チャット" aria-modal="true">
          <div className="chat-sheet-head">
            <div>
              <div className="chat-sheet-title">サブ樹木医</div>
              <div className="chat-sheet-sub">カルテ: {subject}</div>
            </div>
            <button className="btn ghost sheet-close" onClick={() => setOpen(false)} aria-label="閉じる">×</button>
          </div>
          {/* open のときだけ中身を描画（閉時は入力欄などを持たない＝軽量・安定） */}
          {open ? (
            <ChatPanel
              config={config}
              record={record}
              records={records}
              sites={sites}
              messages={messages}
              setMessages={setMessages}
              onReport={(d) => { onReport(d); setOpen(false); }}
            />
          ) : null}
        </div>
      </div>

      {/* 右下のフローティングボタン（開いている間は非表示） */}
      {!open ? (
        <button
          className="chat-fab"
          onClick={() => setOpen(true)}
          aria-label="サブ樹木医に相談する"
          aria-expanded={open}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8A2.5 2.5 0 0 1 17.5 16H9l-4 3.5V16H6.5A2.5 2.5 0 0 1 4 13.5v-8Z"
              fill="currentColor" />
          </svg>
          {messages.length > 0 ? <span className="chat-fab-dot" aria-hidden="true" /> : null}
        </button>
      ) : null}
    </>
  );
}
