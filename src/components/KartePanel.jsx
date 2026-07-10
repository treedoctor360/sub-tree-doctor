import { useState } from 'react';
import { HEALTH_ITEMS } from '../data/healthItems.js';
import { DECLINE_ITEMS, DECLINE_ITEM_IDS } from '../data/declineItems.js';
import { TEBIKI_GROUPS } from '../data/tebikiItems.js';
import { evaluateRecord } from '../logic/diagnosis.js';
import { PRECISION_TRIGGER_IDS } from '../data/healthItems.js';

// v27風のボタン選択（0〜4 / A〜D）。数字を大きく、説明を下に。選択中を再クリックで解除。
function ScaleItem({ group, label, precision, options, value, onSelect }) {
  return (
    <div className="scale-item">
      <div className="scale-head">
        {group ? <span className="scale-group">{group}</span> : null}
        <span className="scale-label">{label}{precision ? <em className="prec">精</em> : null}</span>
      </div>
      <div className="scale-btns" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
        {options.map((o) => {
          const on = value != null && value !== '' && String(value) === String(o.value);
          return (
            <button type="button" key={o.value}
              className={`scale-btn ${on ? 'on' : ''}`}
              onClick={() => onSelect(on ? '' : o.value)}>
              <span className="scale-num">{o.value}</span>
              <span className="scale-desc">{o.desc}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function OverallBadge({ record }) {
  const { avg, worst, overall } = evaluateRecord(record, DECLINE_ITEM_IDS);
  if (!overall) return <div className="muted small">健全度・活力度が未入力です。</div>;
  const cls = { A: 'ok', B: 'caution', C: 'treat', D: 'danger' }[overall.grade];
  const needsPrecision = PRECISION_TRIGGER_IDS.some((id) => ['B', 'C', 'D'].includes((record.health?.[id] || '').toUpperCase()))
    || (record.fungusOther && record.fungusOther.trim());
  return (
    <div className="overall">
      <span className={`pill ${cls}`}>総合 {overall.grade}：{overall.gradeText}</span>
      <span className="muted small">
        活力度平均 {avg == null ? '—' : avg.toFixed(2)}
        {overall.declineLevel ? `（衰退度${overall.declineLevel}）` : ''} / 健全度最悪 {worst ?? '—'}
      </span>
      {needsPrecision ? <div className="warn-banner">外観所見（子実体・開口空洞・腐朽部露出等）あり → 精密診断（機器診断）の要否を検討。</div> : null}
    </div>
  );
}

export default function KartePanel({ record, onChange }) {
  const [importText, setImportText] = useState('');
  const [importMsg, setImportMsg] = useState('');

  const setMeta = (k, v) => onChange({ [k]: v });
  const setHealth = (id, v) => onChange({ health: { ...record.health, [id]: v } });
  const setScore = (id, v) => onChange({ scores: { ...record.scores, [id]: v } });
  const setTebiki = (id, v) => onChange({ tebiki: { ...record.tebiki, [id]: v } });

  const doImport = () => {
    try {
      const obj = JSON.parse(importText);
      const src = obj.record || obj;
      const patch = {};
      for (const k of ['species', 'nickname', 'location', 'treeHeight', 'trunkGirth', 'treeNo', 'projectId', 'latitude', 'longitude', 'findings', 'fungusOther']) {
        if (src[k] !== undefined) patch[k] = src[k];
      }
      if (src.scores) patch.scores = { ...record.scores, ...src.scores };
      if (src.health) patch.health = { ...record.health, ...src.health };
      if (Array.isArray(src.fungus)) patch.fungus = src.fungus;
      onChange(patch);
      setImportMsg('取り込みました。');
      setImportText('');
    } catch (e) {
      setImportMsg('JSONの解析に失敗: ' + e.message);
    }
  };

  return (
    <div className="karte">
      <OverallBadge record={record} />

      <details className="block">
        <summary>shindanv27 の診断記録を取り込む（JSON貼付）</summary>
        <textarea className="import-area" rows={4} placeholder='{"species":"...","scores":{...},"health":{...}}'
          value={importText} onChange={(e) => setImportText(e.target.value)} />
        <div className="row">
          <button className="btn" onClick={doImport} disabled={!importText.trim()}>取り込む</button>
          <span className="muted small">{importMsg}</span>
        </div>
      </details>

      <details className="block" open>
        <summary>対象木</summary>
        <div className="grid2">
          <label>樹種<input value={record.species || ''} onChange={(e) => setMeta('species', e.target.value)} /></label>
          <label>個体名/番号<input value={record.nickname || ''} onChange={(e) => setMeta('nickname', e.target.value)} /></label>
          <label>場所<input value={record.location || ''} onChange={(e) => setMeta('location', e.target.value)} /></label>
          <label>樹高(m)<input type="number" value={record.treeHeight || ''} onChange={(e) => setMeta('treeHeight', e.target.value)} /></label>
          <label>幹周(cm)<input type="number" value={record.trunkGirth || ''} onChange={(e) => setMeta('trunkGirth', e.target.value)} /></label>
        </div>
      </details>

      <details className="block">
        <summary>健全度（外観診断・14項目 / A〜D）</summary>
        <div className="scale-list">
          {HEALTH_ITEMS.map((it) => (
            <ScaleItem key={it.id} group={it.group} label={it.label} precision={it.precision}
              options={it.grades.map((g) => ({ value: g.value, desc: g.label }))}
              value={record.health?.[it.id]} onSelect={(v) => setHealth(it.id, v)} />
          ))}
        </div>
      </details>

      <details className="block">
        <summary>活力度（衰退度・17項目 / 0〜4）</summary>
        <div className="scale-list">
          {DECLINE_ITEMS.map((it) => (
            <ScaleItem key={it.id} group={it.group} label={it.label}
              options={it.desc.map((d, i) => ({ value: i, desc: d }))}
              value={record.scores?.[it.id]} onSelect={(v) => setScore(it.id, v)} />
          ))}
        </div>
      </details>

      {TEBIKI_GROUPS.map((g) => (
        <details className="block" key={g.id}>
          <summary>{g.label}<em className="tebiki-tag">手引き</em></summary>
          <p className="muted small note">{g.note}</p>
          <div className="grid2">
            {g.fields.map((f) => (
              <label key={f.id} className={f.type === 'textarea' ? 'wide' : ''}>
                {f.label}
                {f.type === 'select' ? (
                  <select value={record.tebiki?.[f.id] || ''} onChange={(e) => setTebiki(f.id, e.target.value)}>
                    <option value="">—</option>
                    {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : f.type === 'textarea' ? (
                  <textarea rows={2} value={record.tebiki?.[f.id] || ''} onChange={(e) => setTebiki(f.id, e.target.value)} />
                ) : (
                  <input type={f.type === 'number' ? 'number' : 'text'} placeholder={f.hint || ''}
                    value={record.tebiki?.[f.id] || ''} onChange={(e) => setTebiki(f.id, e.target.value)} />
                )}
              </label>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}
