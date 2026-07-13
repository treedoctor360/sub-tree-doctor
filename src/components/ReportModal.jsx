import { useState } from 'react';

const FIELDS = [
  ['findings', '所見'],
  ['differential', '想定要因・鑑別'],
  ['recommendedPrecision', '推奨する精密診断・指示'],
  ['riskTr', '危険度の見立て'],
  ['management', '対応方針（存置/経過観察/治療/支持保護/伐採）'],
  ['clientExplanation', '依頼者への説明'],
  ['siteRisk', '周辺・履歴からの見えないリスク'],
  ['uncertainties', '未確定・現地実測が要る点'],
  ['consultReport', '診断レポート本文'],
];

export default function ReportModal({ draft, onSave, onClose }) {
  const [v, setV] = useState(draft);
  const set = (k, val) => setV((s) => ({ ...s, [k]: val }));
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>診断記録の確認・編集</h3>
          <button className="icon-btn" onClick={onClose} aria-label="閉じる">✕</button>
        </div>
        <div className="modal-body">
          <p className="muted small">AIが対話とカルテから起こした草案です。<b>樹木医が確認・修正</b>してから保存してください。</p>
          {FIELDS.map(([k, label]) => (
            <label key={k} className="field">
              <span>{label}</span>
              <textarea rows={k === 'consultReport' ? 5 : 2} value={v[k] || ''} onChange={(e) => set(k, e.target.value)} />
            </label>
          ))}
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={onClose}>キャンセル</button>
          <button className="btn primary" onClick={() => onSave(v)}>この内容で記録</button>
        </div>
      </div>
    </div>
  );
}
