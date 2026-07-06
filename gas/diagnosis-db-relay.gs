/**
 * サブ樹木医 診断記録DB 中継WebApp v1.0
 * 役割: フロント(GitHub Pages)からの相談記録を共有スプレッドシートに保存/取得/削除する。
 *  - 保存は record_id で upsert（あれば上書き・なければ追加）
 *  - 認証は簡易トークン（スクリプトプロパティ TOKEN）
 *  - 機密（TOKEN, SHEET_ID）はコードに直書きせず「スクリプトプロパティ」に置く
 *  - 全量は _json 列に格納し、人が読める要約列を併記（shindanv27 の流儀）
 *
 * 【導入手順】
 *  1. 新しい Google スプレッドシートを作成し、そのIDを控える。
 *  2. GASプロジェクトを作成し本ファイルを貼り付け。
 *  3. プロジェクトの設定 → スクリプトプロパティに次を登録:
 *       SHEET_ID   = 上記スプレッドシートのID
 *       TOKEN      = 任意の合言葉（アプリの設定「記録GASトークン」と一致させる）
 *       SHEET_NAME = diagnoses（任意。未設定なら diagnoses）
 *  4. デプロイ → 新しいデプロイ → 種類「ウェブアプリ」→ アクセス「全員」→ デプロイ。
 *  5. 発行されたURLをアプリの設定「記録GAS URL」に貼る。
 *
 *  ※ 共有いただいた記録GAS(腐朽菌用)と I/O 契約は同一。COLS と既定シート名のみ差し替え。
 */

// 列の定義（スプレッドシートの並びと一致。順番を変えないこと）
const COLS = [
  'record_id','created_at','updated_at','inspector','project','tree_no',
  'species','nickname','location','tree_height','trunk_girth','lat','lng',
  'overall_grade','overall_text','decline_avg','decline_level','worst_health',
  'findings','differential','recommended_precision','risk_tr','management',
  'client_explanation','uncertainties','consult_report','advisor',
  '_json','synced_at'
];

function PROP(k){ return PropertiesService.getScriptProperties().getProperty(k); }

function json(obj){
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheet(){
  const ss = SpreadsheetApp.openById(PROP('SHEET_ID'));
  const name = PROP('SHEET_NAME') || 'diagnoses';
  let sh = ss.getSheetByName(name);
  if(!sh){ sh = ss.insertSheet(name); sh.appendRow(COLS); }
  else if(sh.getLastRow() === 0){ sh.appendRow(COLS); }
  return sh;
}

// ダウン同期: 全レコードをJSON配列で返す
function doGet(){
  try{
    const sh = getSheet();
    const values = sh.getDataRange().getValues();
    if(values.length <= 1) return json({ ok:true, records: [] });
    const header = values[0];
    const records = [];
    for(let i=1;i<values.length;i++){
      const rec = {};
      header.forEach((h,c)=> rec[h] = values[i][c]);
      records.push(rec);
    }
    return json({ ok:true, records: records });
  }catch(err){ return json({ ok:false, error:String(err) }); }
}

// アップ同期/削除: POST
function doPost(e){
  try{
    const body = JSON.parse(e.postData.contents);
    if(body.token !== PROP('TOKEN')) return json({ ok:false, error:'認証エラー' });
    if(body.action === 'save')   return json(saveRecords(body.records || []));
    if(body.action === 'delete') return json(deleteRecords(body.ids || []));
    return json({ ok:false, error:'不明なaction' });
  }catch(err){ return json({ ok:false, error:String(err) }); }
}

function saveRecords(records){
  const sh = getSheet();
  const values = sh.getDataRange().getValues();
  const idToRow = {};
  for(let i=1;i<values.length;i++){ idToRow[values[i][0]] = i+1; }
  const now = new Date().toISOString();
  let saved = 0;
  records.forEach(rec=>{
    rec.synced_at = now;
    const row = COLS.map(c => (rec[c] !== undefined && rec[c] !== null) ? rec[c] : '');
    const r = idToRow[rec.record_id];
    if(r){ sh.getRange(r, 1, 1, COLS.length).setValues([row]); }
    else { sh.appendRow(row); idToRow[rec.record_id] = sh.getLastRow(); }
    saved++;
  });
  return { ok:true, saved: saved };
}

function deleteRecords(ids){
  const sh = getSheet();
  const values = sh.getDataRange().getValues();
  const idSet = {};
  ids.forEach(id=> idSet[id] = true);
  let deleted = 0;
  for(let i=values.length-1;i>=1;i--){
    if(idSet[values[i][0]]){ sh.deleteRow(i+1); deleted++; }
  }
  return { ok:true, deleted: deleted };
}
