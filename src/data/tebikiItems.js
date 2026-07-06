// 「樹木医の手引き 第4版」を参考に追加した記録項目。
// shindanv27 の外観チェック（健全度14・活力度17）にない、EBD実務で残すべき項目群：
// 立地・誘因／精密診断の実測値／危険度と標的／腐朽診断／病虫害／処置・処方・モニタリング。
// いずれも任意入力。record.tebiki.<id> に格納。

export const TEBIKI_GROUPS = [
  {
    id: 'site', label: '立地・誘因（土壌診断）',
    note: '衰退の誘因となる環境・人為要因。土壌診断はCODIT防御と樹勢回復のエビデンス。',
    fields: [
      { id: 'compaction', label: '踏圧・固結', type: 'select', options: ['なし', '軽度', '中度', '重度'] },
      { id: 'construction', label: '工事履歴（掘削/盛土/舗装）', type: 'text', hint: '時期・内容' },
      { id: 'transplant', label: '移植歴・深植え', type: 'text' },
      { id: 'drainage', label: '排水・過湿', type: 'select', options: ['良好', 'やや不良', '不良（滞水）'] },
      { id: 'soilHardness', label: '土壌硬度（長谷川式 mm）', type: 'number', unit: 'mm', hint: '硬盤層の目安' },
      { id: 'airPhase', label: '気相率（三相分布 %）', type: 'number', unit: '%', hint: '通気性' },
      { id: 'soilPh', label: '土壌pH', type: 'number', hint: '極端な酸性化に注意' },
      { id: 'saltAirPollution', label: '塩害・薬害・大気汚染の疑い', type: 'text' },
    ],
  },
  {
    id: 'precision', label: '精密診断（実測値）',
    note: '外観診断で当たりを付けた後の機器診断の結果。危険度の科学的根拠。',
    fields: [
      { id: 't', label: '残存健全材厚 t（cm）', type: 'number', unit: 'cm', hint: '最も薄い方向' },
      { id: 'r', label: '幹半径 R（cm）', type: 'number', unit: 'cm', hint: '直径÷2' },
      { id: 'resistograph', label: 'レジストグラフ（穿孔抵抗）所見', type: 'textarea', hint: '空洞・腐朽範囲' },
      { id: 'picus', label: '応力波/音波（PiCUS等）トモグラフ所見', type: 'textarea' },
      { id: 'gamma', label: 'γ線 腐朽率（%）', type: 'number', unit: '%' },
      { id: 'coreStrength', label: '生長錐/フラクトメーター（材質強度）', type: 'textarea' },
      { id: 'airscopeRoot', label: 'エアースコップ（根系・支持根）所見', type: 'textarea' },
    ],
  },
  {
    id: 'risk', label: '危険度・標的（VTA）',
    note: 't/Rは0.30〜0.35を下回ると危険性が著しく上昇。開口空洞は応力集中。標的（人・物）の有無で優先度が変わる。',
    fields: [
      { id: 'cavityOpening', label: '開口空洞（部位・芯到達・周囲比）', type: 'text' },
      { id: 'leanAngle', label: '傾斜角（度）', type: 'number', unit: '°' },
      { id: 'reactionWood', label: '反応材・膨らみ（局部肥大）', type: 'select', options: ['なし', '軽度', '顕著'] },
      { id: 'target', label: '標的（倒伏時の人身・物財）', type: 'text', hint: '通行量・建物・工作物' },
      { id: 'rootHeave', label: '根返り兆候（地際隆起・根の浮き）', type: 'select', options: ['なし', '疑い', 'あり'] },
    ],
  },
  {
    id: 'decay', label: '腐朽診断',
    note: '腐朽菌の“確定”は wood-decay-fungi アプリへ。ここは診断上の当たりと部位・型を残す。',
    fields: [
      { id: 'rotType', label: '腐朽型', type: 'select', options: ['不明', '白色腐朽', '褐色腐朽'] },
      { id: 'rotSite', label: '腐朽部位', type: 'select', options: ['根株・地際', '幹', '枝', '複数'] },
      { id: 'fungusName', label: '腐朽菌名（wood-decay-fungi連携）', type: 'text' },
    ],
  },
  {
    id: 'pest', label: '病虫害（具体）',
    note: '腐朽以外の病害・虫害。IPMの考え方で。',
    fields: [
      { id: 'diseaseName', label: '病名（根頭がんしゅ/てんぐ巣/マツ材線虫病 等）', type: 'text' },
      { id: 'pestName', label: '虫名（カミキリ/キクイムシ/食葉性/吸汁性 等）', type: 'text' },
    ],
  },
  {
    id: 'treatment', label: '処置・処方・モニタリング',
    note: 'CODIT・過剰治療の戒めを踏まえた処置。生理（活力）と力学（強度）の両面。',
    fields: [
      { id: 'measures', label: '実施/推奨処置', type: 'textarea', hint: '外科的処置・支柱ワイヤー・土壌改良・不定根誘導・樹冠縮小剪定 等' },
      { id: 'pruningPolicy', label: '剪定方針', type: 'text', hint: '切除位置(BC/BBR)・時期・切り口保護' },
      { id: 'monitoring', label: 'モニタリング計画（次回点検）', type: 'text' },
    ],
  },
];

export const TEBIKI_FIELD_INDEX = TEBIKI_GROUPS.flatMap((g) => g.fields.map((f) => ({ group: g.id, ...f })));
