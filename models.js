/*
 * 聲明：本專案的程式碼與文件全部由 AI（Anthropic 的 Claude）產生，內容依據公開的網路資料（Apple 文件、TI 電量計資料、各地論壇與拆解資料等）整理。
 * 專案擁有者不主張任何著作權，以公有領域方式釋出（CC0 1.0：https://creativecommons.org/publicdomain/zero/1.0/），任何人可自由使用、修改、散布。
 * 非 Apple 官方工具；數值僅供參考，不提供任何保證。
 */
/*
 * 型號設計容量對照表（mAh）
 * Apple 不公布 mAh，以下數值來自監管資料（中國 3C／監管資料庫、巴西 ANATEL、歐盟能源標籤、Chemtrec Wh 申報）、
 * 拆解標籤與多家媒體交叉比對（2026-10-27 調查，詳見 _claude_cache/RESEARCH_*.md）。
 * 全部型號以 Wh ÷ mAh 回算標稱電壓，都落在 3.846～3.910 V，沒有異常值。
 * conf：high＝監管資料或拆解標籤且多來源一致；mid＝多家可信報導一致但缺原始證書；real＝由官方 Wh 推算並經實機分析檔一致性檢查；
 *   est＝由官方 Wh 或同系列電池推估（自動判斷型號時容許 ±2%）。
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
    // iPad（2026-10-31 調查）：Apple 官方只公布 Wh（support.apple.com 各機型規格頁）；mAh 多為拆解、零件規格或推估。
    // iPad 官方循環目標＝1000 次保有 80%（apple.com/batteries/service-and-recycling）。conf：real＝經實機分析檔一致性檢查；est＝推估。
    { id: 'ipadminia20', group: 'iPad mini', name: 'iPad mini（A20 Pro，2026）', design: 4884, wh: 18.9, ratedCycles: 1000, conf: 'est', note: '官方 18.9 Wh ÷ 3.87 V 推估（3.87 V 取自同系列 A17 Pro 實機）；尚無標籤資料', src: 'apple.com/ipad-mini/specs' },
    { id: 'ipadmini7', group: 'iPad mini', name: 'iPad mini（A17 Pro，2024）', design: 4987, wh: 19.3, ratedCycles: 1000, conf: 'real', note: '設計容量以 Apple 官方 19.3 Wh ÷ 3.87 V 推算，並用實機分析檔驗證：三天的「標稱容量 ÷ 4987」四捨五入都等於系統顯示的健康度（反推範圍 4972～4993 mAh）。網路常見的 5078 mAh 是 19.3 Wh ÷ 3.8 V 的換算值、5034 mAh 是 mini 6 電池標籤值，套用後都與系統顯示不符，不採用', src: 'Apple 規格（19.3 Wh，support.apple.com/121456）＋實機一致性檢查' },
    { id: 'ipadmini6', group: 'iPad mini', name: 'iPad mini（第 6 代，2021）', design: 5034, wh: 19.3, ratedCycles: 1000, conf: 'mid', note: 'iFixit 拆解與電池標籤 5034 mAh／3.81 V；但同電池型號的 A17 Pro 實機反推約 4987，系統用的設計容量可能不同，請用一致性檢查確認', src: 'iFixit 拆解、support.apple.com/111886' },
    { id: 'ipadmini5', group: 'iPad mini', name: 'iPad mini（第 5 代，2019）', design: 5124, wh: 19.1, ratedCycles: 1000, conf: 'mid', note: '5124 mAh 來自 iFixit 零件規格與 theapplewiki；拆解標示 19.32 Wh', src: 'iFixit、support.apple.com/111904' },
    { id: 'ipadpro13m5', group: 'iPad Pro', name: 'iPad Pro 13 吋（M5，2025）', design: 10209, wh: 38.99, ratedCycles: 1000, conf: 'est', note: '官方 38.99 Wh 與 M4 13 吋相同，沿用 M4 的 10209 mAh（未證實是同一顆電池）', src: 'support.apple.com/125407' },
    { id: 'ipadpro11m5', group: 'iPad Pro', name: 'iPad Pro 11 吋（M5，2025）', design: 8160, wh: 31.29, ratedCycles: 1000, conf: 'est', note: '官方 31.29 Wh 與 M4 11 吋相同，沿用 M4 的 8160 mAh（未證實）', src: 'support.apple.com/125406' },
    { id: 'ipadpro13m4', group: 'iPad Pro', name: 'iPad Pro 13 吋（M4，2024）', design: 10209, wh: 38.99, ratedCycles: 1000, conf: 'mid', note: '拆解影片 10209 mAh（Phone Repair Guru，wccftech 報導）', src: 'support.apple.com/119891、wccftech' },
    { id: 'ipadpro11m4', group: 'iPad Pro', name: 'iPad Pro 11 吋（M4，2024）', design: 8160, wh: 31.29, ratedCycles: 1000, conf: 'est', note: '8160 mAh 只有 theapplewiki（無引用來源）', src: 'support.apple.com/119892、theapplewiki' },
    { id: 'ipadpro129g6', group: 'iPad Pro', name: 'iPad Pro 12.9 吋（第 6 代，2022）', design: 10566, wh: 40.88, ratedCycles: 1000, conf: 'mid', note: '與第 5 代共用電池 A2387（iFixit）', src: 'support.apple.com/111841、iFixit' },
    { id: 'ipadpro129g5', group: 'iPad Pro', name: 'iPad Pro 12.9 吋（第 5 代，2021）', design: 10566, wh: 40.88, ratedCycles: 1000, conf: 'mid', note: 'iFixit 電池 A2387 規格 10566 mAh', src: 'support.apple.com/111896、iFixit' },
    { id: 'ipadpro11g4', group: 'iPad Pro', name: 'iPad Pro 11 吋（第 4 代，2022）', design: 7538, wh: 28.65, ratedCycles: 1000, conf: 'est', note: '與第 3 代共用電池 A2369；7538（theapplewiki）與 7680（iFixit 零件規格）兩說衝突', src: 'support.apple.com/111842、theapplewiki' },
    { id: 'ipadpro11g3', group: 'iPad Pro', name: 'iPad Pro 11 吋（第 3 代，2021）', design: 7538, wh: 28.65, ratedCycles: 1000, conf: 'est', note: '電池 A2369；7538（theapplewiki）與 7680（iFixit 零件規格）兩說衝突', src: 'support.apple.com/111897、theapplewiki' },
    { id: 'ipadpro129g4', group: 'iPad Pro', name: 'iPad Pro 12.9 吋（第 4 代，2020）', design: 9720, wh: 36.71, ratedCycles: 1000, conf: 'mid', note: '與第 3 代共用電池 A2043（標籤 9720 mAh／3.76 V）', src: 'support.apple.com/111977、iFixit' },
    { id: 'ipadpro11g2', group: 'iPad Pro', name: 'iPad Pro 11 吋（第 2 代，2020）', design: 7540, wh: 28.65, ratedCycles: 1000, conf: 'mid', note: '電池 A2224 標籤 7540 mAh／3.77 V', src: 'support.apple.com/118452、iFixit、theapplewiki' },
    { id: 'ipadpro129g3', group: 'iPad Pro', name: 'iPad Pro 12.9 吋（第 3 代，2018）', design: 9720, wh: 36.71, ratedCycles: 1000, conf: 'mid', note: '電池 A2043 標籤 9720 mAh／3.76 V；iPadOS 27 不支援', src: 'support.apple.com/111979、iFixit' },
    { id: 'ipadpro11g1', group: 'iPad Pro', name: 'iPad Pro 11 吋（第 1 代，2018）', design: 7812, wh: 29.37, ratedCycles: 1000, conf: 'high', note: 'iFixit 拆解原廠電池「7812 mAh、3.77 V」；iPadOS 27 不支援', src: 'support.apple.com/111974、iFixit 拆解' },
    { id: 'ipadair13m4', group: 'iPad Air', name: 'iPad Air 13 吋（M4，2026）', design: 9629, wh: 36.59, ratedCycles: 1000, conf: 'est', note: '官方 36.59 Wh ÷ 3.80 V 推估，無標籤資料', src: 'support.apple.com/126472' },
    { id: 'ipadair11m4', group: 'iPad Air', name: 'iPad Air 11 吋（M4，2026）', design: 7606, wh: 28.93, ratedCycles: 1000, conf: 'est', note: '沿用 11 吋系列電池 A2288 的 7606 mAh（未證實）', src: 'support.apple.com/126471' },
    { id: 'ipadair13m3', group: 'iPad Air', name: 'iPad Air 13 吋（M3，2025）', design: 9629, wh: 36.59, ratedCycles: 1000, conf: 'est', note: '官方 36.59 Wh ÷ 3.80 V 推估，無標籤資料', src: 'support.apple.com/122242' },
    { id: 'ipadair11m3', group: 'iPad Air', name: 'iPad Air 11 吋（M3，2025）', design: 7606, wh: 28.93, ratedCycles: 1000, conf: 'est', note: '沿用電池 A2288 的 7606 mAh（未證實）', src: 'support.apple.com/122241' },
    { id: 'ipadair13m2', group: 'iPad Air', name: 'iPad Air 13 吋（M2，2024）', design: 9629, wh: 36.59, ratedCycles: 1000, conf: 'est', note: '官方 36.59 Wh ÷ 3.80 V 推估；theapplewiki 的 10340 換算電壓不合理，不採用', src: 'support.apple.com/119893' },
    { id: 'ipadair11m2', group: 'iPad Air', name: 'iPad Air 11 吋（M2，2024）', design: 7606, wh: 28.93, ratedCycles: 1000, conf: 'est', note: 'iFixit 列為使用電池 A2288（7606 mAh）', src: 'support.apple.com/119894、iFixit' },
    { id: 'ipadair5', group: 'iPad Air', name: 'iPad Air（第 5 代，2022）', design: 7606, wh: 28.6, ratedCycles: 1000, conf: 'mid', note: '電池 A2288 標籤 7606 mAh', src: 'support.apple.com/111887、iFixit' },
    { id: 'ipadair4', group: 'iPad Air', name: 'iPad Air（第 4 代，2020）', design: 7606, wh: 28.6, ratedCycles: 1000, conf: 'mid', note: '電池 A2288 標籤 7606 mAh', src: 'support.apple.com/111905、iFixit' },
    { id: 'ipadair3', group: 'iPad Air', name: 'iPad Air（第 3 代，2019）', design: 8134, wh: 30.2, ratedCycles: 1000, conf: 'mid', note: '電池 A2134，8134 mAh（theapplewiki、iFixit 零件規格）；iPadOS 27 不支援', src: 'support.apple.com/111939、iFixit' },
    { id: 'ipada16', group: 'iPad', name: 'iPad（A16，2025）', design: 7606, wh: 28.93, ratedCycles: 1000, conf: 'est', note: 'iFixit 列為使用電池 A2288（7606 mAh）', src: 'support.apple.com/122240、iFixit' },
    { id: 'ipad10', group: 'iPad', name: 'iPad（第 10 代，2022）', design: 7606, wh: 28.6, ratedCycles: 1000, conf: 'est', note: 'theapplewiki 與 iFixit 列為電池 A2288（7606 mAh）', src: 'support.apple.com/111840、theapplewiki' },
    { id: 'ipad9', group: 'iPad', name: 'iPad（第 9 代，2021）', design: 8557, wh: 32.4, ratedCycles: 1000, conf: 'est', note: '8557 mAh 只有 theapplewiki', src: 'support.apple.com/111898、theapplewiki' },
    { id: 'ipad8', group: 'iPad', name: 'iPad（第 8 代，2020）', design: 8557, wh: 32.4, ratedCycles: 1000, conf: 'est', note: '官方 Wh 與第 9 代相同，沿用 8557（未證實）；iPadOS 27 不支援', src: 'support.apple.com/118451' },
  ];
  const DEFAULT_ID = '17promax-sim';
  const SOURCE = 'Apple 不公布 mAh；容量取自監管資料、拆解標籤與多家媒體交叉比對（2026-10）';
  function find(id) { return MODELS.find(m => m.id === id) || null; }
  return { MODELS, DEFAULT_ID, SOURCE, find };
});
