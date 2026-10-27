/*
 * 型號設計容量對照表（mAh）
 * Apple 不公布 mAh，以下數值來自監管資料（中國 3C／監管資料庫、巴西 ANATEL、歐盟能源標籤、Chemtrec Wh 申報）、
 * 拆解標籤與多家媒體交叉比對（2026-10-27 調查，詳見 _claude_cache/RESEARCH_*.md）。
 * 全部型號以 Wh ÷ mAh 回算標稱電壓，都落在 3.846～3.910 V，沒有異常值。
 * conf：high＝監管資料或拆解標籤且多來源一致；mid＝多家可信報導一致但缺原始證書。
 * ratedCycles：Apple 官方「保有 80% 原始容量」的設計循環數（apple.com/batteries/service-and-recycling）：
 *   iPhone 14 與更早＝500 次；iPhone 15 系列＝1000 次；16 以後官方頁未列出，填 null，不自行假設。
 * 分析資料檔不含型號與設計容量，需使用者選擇；清單以外的型號用「自訂」。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BatteryModels = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  // group：選單分組；note：畫面上顯示的補充說明
  const MODELS = [
    { id: 'duo',             group: 'iPhone Duo（摺疊）', name: 'iPhone Duo', design: 4883, wh: null, ratedCycles: null, conf: 'high', note: '兩顆電芯 2962＋1921 mAh 合計；全球僅 eSIM。分析檔回報總量或分電芯尚未確認', src: '歐盟能源標籤（AndroidHeadlines、unwire.hk、iPhone Mania）' },
    { id: '18promax-sim',    group: 'iPhone 18', name: 'iPhone 18 Pro Max（實體 SIM 卡槽）', design: 5391, wh: 21.06, ratedCycles: null, conf: 'high', note: '台灣、香港、歐洲、中國', src: '中國 3C、歐盟能源標籤' },
    { id: '18promax-esim',   group: 'iPhone 18', name: 'iPhone 18 Pro Max（僅 eSIM）',       design: 5567, wh: 21.75, ratedCycles: null, conf: 'high', note: '美國、日本等', src: '中國 3C、iFixit 拆解' },
    { id: '18pro-sim',       group: 'iPhone 18', name: 'iPhone 18 Pro（實體 SIM 卡槽）',     design: 4056, wh: 15.86, ratedCycles: null, conf: 'high', note: '台灣、香港、歐洲、中國', src: '中國 3C、歐盟能源標籤' },
    { id: '18pro-esim',      group: 'iPhone 18', name: 'iPhone 18 Pro（僅 eSIM）',           design: 4288, wh: 16.76, ratedCycles: null, conf: 'high', note: '美國、日本等', src: '中國 3C、iFixit 拆解' },
    { id: '17promax-sim',    group: 'iPhone 17', name: 'iPhone 17 Pro Max（實體 SIM 卡槽）', design: 4823, wh: 18.75, ratedCycles: null, conf: 'mid',  note: 'A3526（台灣、香港、歐洲）、A3527（中國）', src: '中國監管資料庫、零件 661-56049、TidBITS' },
    { id: '17promax-esim',   group: 'iPhone 17', name: 'iPhone 17 Pro Max（僅 eSIM）',       design: 5088, wh: 19.77, ratedCycles: null, conf: 'mid',  note: 'A3257（美國）、A3525（日本等）', src: '中國監管資料庫、零件商標籤' },
    { id: '17pro-sim',       group: 'iPhone 17', name: 'iPhone 17 Pro（實體 SIM 卡槽）',     design: 3988, wh: 15.53, ratedCycles: null, conf: 'mid',  note: '台灣、香港、歐洲、中國；部分報導寫 3998 應為誤植', src: '中國監管資料庫、瘋先生、新浪' },
    { id: '17pro-esim',      group: 'iPhone 17', name: 'iPhone 17 Pro（僅 eSIM）',           design: 4252, wh: 16.56, ratedCycles: null, conf: 'mid',  note: '美國、日本等', src: '中國監管資料庫、9to5Mac、TidBITS' },
    { id: '17',              group: 'iPhone 17', name: 'iPhone 17',                          design: 3692, wh: 14.35, ratedCycles: null, conf: 'high', note: '', src: 'Apple 公布、heise、TidBITS' },
    { id: 'air',             group: 'iPhone 17', name: 'iPhone Air',                         design: 3149, wh: 12.26, ratedCycles: null, conf: 'high', note: '全球僅 eSIM（部分中國報導另列 3036 mAh，對應版本未確認）', src: 'Apple 公布、notebookcheck' },
    { id: '17e',             group: 'iPhone 17', name: 'iPhone 17e',                         design: 4005, wh: 15.556, ratedCycles: null, conf: 'high', note: 'A3635', src: 'ChargerLab 拆解標籤' },
    { id: '16promax',        group: 'iPhone 16', name: 'iPhone 16 Pro Max', design: 4685, wh: 18.17, ratedCycles: null, conf: 'high', note: '', src: '巴西 ANATEL、heise' },
    { id: '16pro',           group: 'iPhone 16', name: 'iPhone 16 Pro',     design: 3582, wh: 13.94, ratedCycles: null, conf: 'high', note: '', src: '巴西 ANATEL、heise' },
    { id: '16plus',          group: 'iPhone 16', name: 'iPhone 16 Plus',    design: 4674, wh: 18.11, ratedCycles: null, conf: 'high', note: '', src: '巴西 ANATEL' },
    { id: '16',              group: 'iPhone 16', name: 'iPhone 16',         design: 3561, wh: 13.84, ratedCycles: null, conf: 'high', note: '', src: '巴西 ANATEL、heise 拆解' },
    { id: '16e',             group: 'iPhone 16', name: 'iPhone 16e',        design: 4005, wh: 15.55, ratedCycles: null, conf: 'high', note: '另有 3961 mAh 一說，與 Wh 不符', src: 'REWA 拆解、Gizmodo JP' },
    { id: '15promax',        group: 'iPhone 15', name: 'iPhone 15 Pro Max', design: 4422, wh: 17.11, ratedCycles: 1000, conf: 'high', note: '', src: '中國監管資料庫、iFixit 拆解' },
    { id: '15pro',           group: 'iPhone 15', name: 'iPhone 15 Pro',     design: 3274, wh: 12.70, ratedCycles: 1000, conf: 'high', note: '', src: '中國監管資料庫' },
    { id: '15plus',          group: 'iPhone 15', name: 'iPhone 15 Plus',    design: 4383, wh: 16.95, ratedCycles: 1000, conf: 'high', note: '', src: '中國監管資料庫' },
    { id: '15',              group: 'iPhone 15', name: 'iPhone 15',         design: 3349, wh: 12.98, ratedCycles: 1000, conf: 'high', note: '', src: '中國監管資料庫' },
    { id: '14promax',        group: 'iPhone 14', name: 'iPhone 14 Pro Max', design: 4323, wh: 16.68, ratedCycles: 500, conf: 'high', note: '', src: '中國資料庫＋Chemtrec Wh' },
    { id: '14pro',           group: 'iPhone 14', name: 'iPhone 14 Pro',     design: 3200, wh: 12.38, ratedCycles: 500, conf: 'high', note: '', src: '中國資料庫＋Chemtrec Wh' },
    { id: '14plus',          group: 'iPhone 14', name: 'iPhone 14 Plus',    design: 4325, wh: 16.68, ratedCycles: 500, conf: 'high', note: '', src: '中國資料庫＋Chemtrec Wh' },
    { id: '14',              group: 'iPhone 14', name: 'iPhone 14',         design: 3279, wh: 12.68, ratedCycles: 500, conf: 'high', note: '', src: '中國資料庫＋Chemtrec Wh' },
    { id: '13promax',        group: 'iPhone 13', name: 'iPhone 13 Pro Max', design: 4352, wh: 16.75, ratedCycles: 500, conf: 'high', note: '', src: 'Chemtrec Wh、ChargerLab' },
    { id: '13pro',           group: 'iPhone 13', name: 'iPhone 13 Pro',     design: 3095, wh: 11.97, ratedCycles: 500, conf: 'high', note: '', src: 'Chemtrec Wh、ChargerLab' },
    { id: '13',              group: 'iPhone 13', name: 'iPhone 13',         design: 3227, wh: 12.41, ratedCycles: 500, conf: 'high', note: '3240 為由 Wh 反推的估計值，不採用', src: 'Chemtrec Wh、ChargerLab' },
    { id: '13mini',          group: 'iPhone 13', name: 'iPhone 13 mini',    design: 2406, wh: 9.34,  ratedCycles: 500, conf: 'high', note: '', src: '9to5Mac、DXOMARK' },
    { id: 'se3',             group: 'iPhone SE',  name: 'iPhone SE（第 3 代，2022）', design: 2018, wh: 7.82, ratedCycles: 500, conf: 'high', note: '', src: 'iMore 拆解、ChargerLab' },
  ];
  const DEFAULT_ID = '17promax-sim';
  const SOURCE = 'Apple 不公布 mAh；容量取自監管資料、拆解標籤與多家媒體交叉比對（2026-10）';
  function find(id) { return MODELS.find(m => m.id === id) || null; }
  return { MODELS, DEFAULT_ID, SOURCE, find };
});
