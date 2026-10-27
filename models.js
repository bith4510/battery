/*
 * 型號設計容量對照表（mAh）
 * 來源：iPhone 17 系列容量為中國監管資料庫資料，經 MacRumors／MacTrast 轉述（2025-09），Apple 未正式公布。
 * 分析資料檔不含型號與設計容量，需使用者選擇；其他型號請用「自訂」輸入。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BatteryModels = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const MODELS = [
    { id: '17promax-sim',  name: 'iPhone 17 Pro Max（實體 SIM 卡槽）', design: 4823 },
    { id: '17promax-esim', name: 'iPhone 17 Pro Max（僅 eSIM）',       design: 5088 },
    { id: '17pro-sim',     name: 'iPhone 17 Pro（實體 SIM 卡槽）',     design: 3988 },
    { id: '17pro-esim',    name: 'iPhone 17 Pro（僅 eSIM）',           design: 4252 },
    { id: '17',            name: 'iPhone 17',                          design: 3692 },
    { id: 'air-sim',       name: 'iPhone Air（實體 SIM 卡槽）',        design: 3036 },
    { id: 'air-esim',      name: 'iPhone Air（僅 eSIM）',              design: 3149 },
  ];
  const DEFAULT_ID = '17promax-sim';
  const SOURCE = 'iPhone 17 系列容量：中國監管資料庫，經 MacRumors／MacTrast 轉述（2025-09），Apple 未正式公布';
  function find(id) { return MODELS.find(m => m.id === id) || null; }
  return { MODELS, DEFAULT_ID, SOURCE, find };
});
