import { useRef, useState, useEffect } from 'react';
import { askGemini, parseReportJson } from '../features/gemini.js';
import { buildSystemInstruction, REPORT_INSTRUCTION } from '../logic/systemPrompt.js';
import { classifyTr } from '../logic/diagnosis.js';
import { buildSiteContext } from '../logic/siteContext.js';
import { FLOW_STAGES } from '../data/diagnosisFlow.js';

const GREETING = 'サブ樹木医です。いま診ている木で、いちばん気になっている点を聞かせてください。カルテに総合判定や所見を入れておくと、それを踏まえて一緒に考えます。';
const MAX_IMAGES = 3;

// 端末側で画像を縮小して base64(dataURL) を返す（費用・通信量の削減）。最大辺1024px・JPEG。
async function downscaleToData(file, max = 1024, q = 0.8) {
  const img = await createImageBitmap(file);
  const s = Math.min(1, max / Math.max(img.width, img.height));
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.round(img.width * s));
  cv.height = Math.max(1, Math.round(img.height * s));
  cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
  const dataUrl = cv.toDataURL('image/jpeg', q);
  return { mimeType: 'image/jpeg', data: dataUrl.split(',')[1], preview: dataUrl };
}

export default function ChatPanel({ config, record, records = [], sites = [], messages, setMessages, onReport }) {
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [images, setImages] = useState([]);   // ② 添付画像 [{mimeType,data,preview}]
  const [showTr, setShowTr] = useState(false); // ③ t/R欄の開閉
  const [trT, setTrT] = useState('');          // ③ 初期値は空（既定値を勝手に送らない）
  const [trR, setTrR] = useState('');
  const [trOpen, setTrOpen] = useState(false); // 開口空洞（チェック時のみ文言を付ける）
  const [guided, setGuided] = useState(false); // 案1 ガイド診断モード
  const [stageIdx, setStageIdx] = useState(0); // 現在の診断段
  const scroller = useRef(null);
  const fileRef = useRef(null);   // 📷 撮影（capture=environment）
  const albumRef = useRef(null);  // 🖼 アルバム（capture無し）

  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight;
  }, [messages, busy]);

  // ③ t/R: t・R 両方が入力され、classifyTr が有効値を返すときだけ判定を得る。
  const trResult = (trT !== '' && trR !== '') ? classifyTr(trT, trR, trOpen) : null;
  // 案1: ガイド診断ONのとき現在の段。送信時に buildSystemInstruction へ渡してその段に集中させる。
  const stage = guided ? FLOW_STAGES[stageIdx] : null;

  const onPickImages = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = ''; // 同じ画像を選び直せるようにリセット
    if (!files.length) return;
    const room = MAX_IMAGES - images.length;
    if (room <= 0) { setError(`画像は最大${MAX_IMAGES}枚までです。`); return; }
    try {
      const added = [];
      for (const f of files.slice(0, room)) added.push(await downscaleToData(f));
      setImages((prev) => [...prev, ...added].slice(0, MAX_IMAGES));
    } catch (err) {
      setError('画像の読み込みに失敗しました: ' + err.message);
    }
  };
  const removeImage = (idx) => setImages((prev) => prev.filter((_, i) => i !== idx));

  // preset(文字列)が渡されたとき（ガイドの「この段を進める」等）は入力欄でなくその文を送る。
  const send = async (preset) => {
    const usePreset = typeof preset === 'string';
    const text = usePreset ? preset.trim() : input.trim();
    const hasImages = !usePreset && images.length > 0;
    // ③ 有効な t/R だけ「検算済みの事実」として1行付ける（未入力・無効なら何も送らない）
    const trLine = (!usePreset && trResult)
      ? `【現地計測】t/R = ${trResult.ratio.toFixed(2)}（${trResult.text}）` + (trOpen ? '／開口空洞あり' : '')
      : '';
    if ((!text && !trLine && !hasImages) || busy) return;
    setError('');
    const bodyText = [text, trLine].filter(Boolean).join('\n');
    const userMsg = {
      role: 'user',
      text: bodyText,
      images: hasImages ? images.map(({ mimeType, data }) => ({ mimeType, data })) : undefined,
    };
    const next = [...messages, userMsg];
    setMessages(next);
    if (!usePreset) { setInput(''); setImages([]); setTrT(''); setTrR(''); setTrOpen(false); }
    setBusy(true);
    try {
      // 検索クエリはユーザーが「診たい内容」(text)を主に、カルテ構造値で拡張(systemPrompt側)。
      // text が空（画像のみ等）でもカルテ文脈で検索できるよう text を渡す。ガイドONなら段(stage)を渡す。
      const siteContext = buildSiteContext(record, records, sites, config);
      const { instruction, refs, mode } = await buildSystemInstruction(record, config, text, stage, siteContext);
      const reply = await askGemini(config.geminiRelayUrl, instruction, next, config.geminiRelayToken);
      setMessages([...next, { role: 'model', text: reply, refs, mode }]);
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
      const siteContext = buildSiteContext(record, records, sites, config);
      const { instruction } = await buildSystemInstruction(record, config, query, null, siteContext);
      const reply = await askGemini(config.geminiRelayUrl, instruction, hist, config.geminiRelayToken);
      onReport(parseReportJson(reply));
    } catch (e) {
      setError('レポート生成に失敗: ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  const onKey = (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send(); };
  const canSend = !busy && (!!input.trim() || images.length > 0 || !!trResult);

  return (
    <div className="chat">
      <div className="messages" ref={scroller}>
        <div className="msg model"><div className="bubble">{GREETING}</div></div>
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            {m.images && m.images.length ? (
              <div className="bubble-imgs">
                {m.images.map((im, j) => (
                  <img key={j} src={`data:${im.mimeType};base64,${im.data}`} alt="添付画像" />
                ))}
              </div>
            ) : null}
            {m.text ? <div className="bubble">{m.text}</div> : null}
            {m.mode ? (
              <span className={`mode-tag ${m.mode}`}>
                {m.mode === 'rag' ? '📚 知識ベース（2冊検索）' : '要約KB（内蔵）'}
              </span>
            ) : null}
            {m.refs && m.refs.length ? (
              <details className="refs">
                <summary className="refs-title">{m.refs.length}件</summary>
                <div className="refs-list">
                  {m.refs.map((r) => (
                    <span key={r.n} className="ref">
                      【{r.n}】{r.book}{r.pageBatch ? ` p.${r.pageBatch}` : ''}{r.section ? ` 〔${r.section}〕` : ''}
                    </span>
                  ))}
                </div>
              </details>
            ) : null}
          </div>
        ))}
        {busy ? <div className="msg model"><div className="bubble typing">考えています…</div></div> : null}
      </div>
      {error ? <div className="chat-error">{error}</div> : null}

      <div className="composer">
        <div className="composer-tools">
          <button type="button" className={`chip ${guided ? 'on' : ''}`} onClick={() => setGuided((v) => !v)}
            title="手引きの診断順に沿って段階的に進める">🧭 ガイド</button>
          <button type="button" className="chip" onClick={() => fileRef.current?.click()} disabled={busy}>📷 撮影</button>
          <button type="button" className="chip" onClick={() => albumRef.current?.click()} disabled={busy}>🖼 アルバム</button>
          <button type="button" className={`chip ${showTr ? 'on' : ''}`} onClick={() => setShowTr((v) => !v)}>t/R</button>
          {/* 撮影は capture=environment でカメラ、アルバムは capture 無しで写真ライブラリ/ファイルから選択 */}
          <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple hidden onChange={onPickImages} />
          <input ref={albumRef} type="file" accept="image/*" multiple hidden onChange={onPickImages} />
        </div>

        {guided ? (
          <div className="flow-bar">
            <div className="flow-steps">
              {FLOW_STAGES.map((s, i) => (
                <button key={s.id} type="button"
                  className={`flow-step ${i === stageIdx ? 'on' : ''} ${i < stageIdx ? 'done' : ''}`}
                  onClick={() => setStageIdx(i)} title={s.goal}>{s.label}</button>
              ))}
            </div>
            <div className="flow-hint">{stage?.hint}</div>
            <div className="flow-nav">
              <button type="button" className="btn small" disabled={stageIdx === 0 || busy}
                onClick={() => setStageIdx((i) => Math.max(0, i - 1))}>◀ 前</button>
              <button type="button" className="btn small primary" disabled={busy}
                onClick={() => send(`「${stage.label}」の段を進めてください。`)}>この段を進める</button>
              <button type="button" className="btn small" disabled={stageIdx === FLOW_STAGES.length - 1 || busy}
                onClick={() => setStageIdx((i) => Math.min(FLOW_STAGES.length - 1, i + 1))}>次 ▶</button>
            </div>
          </div>
        ) : null}

        {showTr ? (
          <div className="tr-row">
            <label>t<input type="number" inputMode="decimal" value={trT} onChange={(e) => setTrT(e.target.value)} placeholder="cm" /></label>
            <label>R<input type="number" inputMode="decimal" value={trR} onChange={(e) => setTrR(e.target.value)} placeholder="cm" /></label>
            <label className="chk"><input type="checkbox" checked={trOpen} onChange={(e) => setTrOpen(e.target.checked)} />開口空洞</label>
            {trResult ? <span className={`pill ${trResult.c}`}>{trResult.ratio.toFixed(2)} {trResult.text}</span> : null}
          </div>
        ) : null}

        {images.length ? (
          <div className="img-previews">
            {images.map((im, i) => (
              <div key={i} className="thumb">
                <img src={im.preview} alt="添付プレビュー" />
                <button type="button" onClick={() => removeImage(i)} aria-label="削除">×</button>
              </div>
            ))}
          </div>
        ) : null}

        <textarea rows={2} value={input} placeholder="症状や気になる点を入力（Ctrl+Enterで送信）"
          onChange={(e) => setInput(e.target.value)} onKeyDown={onKey} disabled={busy} />
        <div className="composer-btns">
          <button className="btn primary" onClick={() => send()} disabled={!canSend}>送信</button>
          <button className="btn" onClick={makeReport} disabled={busy || messages.length === 0}
            title="対話とカルテから診断記録を生成">この診断を記録</button>
        </div>
      </div>
    </div>
  );
}
