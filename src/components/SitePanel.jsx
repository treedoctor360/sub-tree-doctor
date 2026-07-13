import { useState } from 'react';

// 現地（site）カルテ。案件→現地→樹木の「現地」を登録・編集する。
// 環境・経緯は複数個体で共有されるため個体カルテと分離し、他個体の診断時に参照できるようにする。
const KINDS = ['公園', '街路', '社寺', 'その他'];
const FIELDS = [
  ['projectName', '案件（業務名）', 'input', '例: A市街路樹診断業務'],
  ['name', '現地名', 'input', '例: 北通り 北側 / A公園'],
  ['history', '経緯・履歴', 'textarea', '工事・掘削・舗装改修・盛土・強剪定・薬剤・被害発生など'],
  ['environment', '立地環境', 'textarea', '土壌・排水・踏圧・植栽桝・日照・風・交通・塩害など'],
  ['surroundings', '周辺情報', 'textarea', '近隣でのナラ枯れ・カミキリ被害・枯損の発生情報など'],
  ['notes', 'メモ', 'textarea', ''],
];

function newId() {
  return (crypto?.randomUUID?.() ? 'site_' + crypto.randomUUID() : 'site_' + Date.now() + '-' + Math.random().toString(16).slice(2));
}
function blankSite() {
  return { id: newId(), projectName: '', name: '', kind: '', history: '', environment: '', surroundings: '', notes: '' };
}

export default function SitePanel({ sites, onSave, onDelete }) {
  const [edit, setEdit] = useState(null); // 編集中の site（null=一覧のみ）
  const set = (k, v) => setEdit((s) => ({ ...s, [k]: v }));
  const label = (s) => [s.projectName, s.name].filter(Boolean).join(' / ') || s.name || '（無名の現地）';

  const save = () => {
    if (!edit) return;
    onSave({ ...edit, name: edit.name || '（無名の現地）', updatedAt: new Date().toISOString(), createdAt: edit.createdAt || new Date().toISOString() });
    setEdit(null);
  };

  return (
    <div className="site-panel">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <p className="lead" style={{ margin: 0 }}>現地（公園・街路など）単位で環境・経緯を登録します。カルテの「現地」で選ぶと、近接木・履歴が診断に反映されます。</p>
        <button className="btn primary" onClick={() => setEdit(blankSite())}>＋ 新規現地</button>
      </div>

      {edit ? (
        <div className="block" style={{ marginTop: 12 }}>
          <div className="grid2">
            {FIELDS.map(([k, lbl, type, hint]) => (
              <label key={k} className={type === 'textarea' ? 'wide' : ''}>
                {lbl}
                {type === 'textarea'
                  ? <textarea rows={2} value={edit[k] || ''} placeholder={hint} onChange={(e) => set(k, e.target.value)} />
                  : <input value={edit[k] || ''} placeholder={hint} onChange={(e) => set(k, e.target.value)} />}
              </label>
            ))}
            <label>種別
              <select value={edit.kind || ''} onChange={(e) => set('kind', e.target.value)}>
                <option value="">—</option>
                {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </label>
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn primary" onClick={save}>保存</button>
            <button className="btn" onClick={() => setEdit(null)}>キャンセル</button>
          </div>
        </div>
      ) : null}

      <div className="site-list" style={{ marginTop: 12 }}>
        {(!sites || !sites.length) ? <p className="muted small">まだ現地が登録されていません。</p> : null}
        {(sites || []).map((s) => (
          <div key={s.id} className="block" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <div>
              <div><b>{label(s)}</b>{s.kind ? <span className="muted small">（{s.kind}）</span> : null}</div>
              {s.history ? <div className="muted small">経緯: {s.history}</div> : null}
              {s.environment ? <div className="muted small">環境: {s.environment}</div> : null}
            </div>
            <div className="row">
              <button className="btn small" onClick={() => setEdit({ ...s })}>編集</button>
              <button className="btn small" onClick={() => { if (confirm('この現地を削除しますか？（カルテの紐付けは残ります）')) onDelete(s.id); }}>削除</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
