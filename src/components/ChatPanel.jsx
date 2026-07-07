import { useRef, useState, useEffect } from 'react';
import { askGemini, parseReportJson } from '../features/gemini.js';
import { buildSystemInstruction, REPORT_INSTRUCTION } from '../logic/systemPrompt.js';

const GREETING = 'サブ樹木医です。いま診ている木で、いちばん気になっている点を聞かせてください。カルテに総合判定や所見を入れておくと、それを踏まえて一緒に考えます。';

export default function ChatPanel({ config, record, messages, setMessages, onReport }) {
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const scroller = useRef(null);

  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight;
  }, [messages, busy]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setError('');
    const next = [...messages, { role: 'user', text }];
    setMessages(next);
    setInput('');
    setBusy(true);
    try {
      const sys = await buildSystemInstruction(record, config, text);
      const reply = await askGemini(config.geminiRelayUrl, sys, next);
      setMessages([...next, { role: 'model', text: reply }]);
    } catch (e) {
      setError(e.message);
      setMessages(next); // 保持
    } finally {
      setBusy(false);
    }
  };

  const makeReport = async () => {
    if (busy) return;
    setError('');
    setBusy(true);
    try {
      const hist = [...messages, { role: 'user', text: REPORT_INSTRUCTION }];
      // 検索クエリは所見＋これまでの相談内容（要点）から組み立てる。
      const query = [record.findings, ...messages.filter((m) => m.role === 'user').map((m) => m.text)]
        .filter(Boolean).join(' ').slice(0, 1000);
      const sys = await buildSystemInstruction(record, config, query);
      const reply = await askGemini(config.geminiRelayUrl, sys, hist);
      onReport(parseReportJson(reply));
    } catch (e) {
      setError('レポート生成に失敗: ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  const onKey = (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send(); };

  return (
    <div className="chat">
      <div className="messages" ref={scroller}>
        <div className="msg model"><div className="bubble">{GREETING}</div></div>
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            <div className="bubble">{m.text}</div>
          </div>
        ))}
        {busy ? <div className="msg model"><div className="bubble typing">考えています…</div></div> : null}
      </div>
      {error ? <div className="chat-error">{error}</div> : null}
      <div className="composer">
        <textarea rows={2} value={input} placeholder="症状や気になる点を入力（Ctrl+Enterで送信）"
          onChange={(e) => setInput(e.target.value)} onKeyDown={onKey} disabled={busy} />
        <div className="composer-btns">
          <button className="btn primary" onClick={send} disabled={busy || !input.trim()}>送信</button>
          <button className="btn" onClick={makeReport} disabled={busy || messages.length === 0}
            title="対話とカルテから診断記録を生成">この診断を記録</button>
        </div>
      </div>
    </div>
  );
}
