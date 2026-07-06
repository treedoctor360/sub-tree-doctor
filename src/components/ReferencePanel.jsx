import { useState } from 'react';
import { classifyTr } from '../logic/diagnosis.js';
import { DEVICES, FUNGI, FUNGI_APP_URL } from '../data/reference.js';

const VERDICT_LABEL = { ok: '健全域', caution: '注意', treat: '要治療域', danger: '要警戒' };

function TrCalc() {
  const [t, setT] = useState('6');
  const [r, setR] = useState('25');
  const [open, setOpen] = useState(false);
  const res = classifyTr(t, r, open);
  return (
    <div className="card">
      <h3>t/R 危険度計算</h3>
      <p className="muted small">VTA(Matteck)。t/R が 0.30〜0.35 を下回ると危険性が著しく上昇。開口空洞は危険側へ補正。</p>
      <div className="grid2">
        <label>残存健全材厚 t（cm）<input type="number" value={t} onChange={(e) => setT(e.target.value)} /></label>
        <label>幹半径 R（cm）<input type="number" value={r} onChange={(e) => setR(e.target.value)} /></label>
      </div>
      <label className="check"><input type="checkbox" checked={open} onChange={(e) => setOpen(e.target.checked)} /> 開口空洞あり</label>
      {res ? (
        <div className="tr-result">
          <span className="tr-ratio">{res.ratio.toFixed(2)}</span>
          <span className={`pill ${res.c}`}>{VERDICT_LABEL[res.c]}</span>
        </div>
      ) : <div className="muted small">t と R を入力してください。</div>}
    </div>
  );
}

export default function ReferencePanel() {
  return (
    <div className="reference">
      <TrCalc />
      <div className="card">
        <h3>精密診断機器</h3>
        <div className="dev-grid">
          {DEVICES.map((d) => (
            <div className="dev" key={d.name}>
              <div className="kind">{d.kind}</div>
              <div className="dev-name">{d.name}</div>
              <p className="muted small">{d.desc}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="card">
        <h3>主要腐朽菌クイックリファレンス</h3>
        <p className="muted small">★褐色＝初期から強度急落／▲根株＝突然の根返り。詳細同定は
          <a href={FUNGI_APP_URL} target="_blank" rel="noopener"> wood-decay-fungi アプリ ↗</a></p>
        <div className="table-scroll">
          <table className="fungi">
            <thead><tr><th>菌名</th><th>宿主</th><th>部位</th><th>持続性</th><th>質感</th><th>柄</th><th>子実層托</th><th>腐朽型</th><th>危険度</th></tr></thead>
            <tbody>
              {FUNGI.map((row) => (
                <tr key={row[0]}>
                  {row.slice(0, 8).map((c, i) => <td key={i} style={i === 0 ? { fontWeight: 600 } : undefined}>{c}</td>)}
                  <td><span className={`dot ${row[9]}`} />{row[8]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
