/*
 * 電池原始欄位說明表
 * level：known＝意義明確（欄位名稱即說明，或與系統顯示一致）；guess＝依數值推定；unknown＝意義不明，只列原始值
 * 單位或意義是推定的，畫面上會標「推定」，不當事實呈現。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BatteryFields = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const F = {
    CycleCount:              { label: '循環次數', unit: '次', level: 'known', group: 'cycle' },
    CycleCountLastQmax:      { label: '上次更新化學容量時的循環次數', unit: '次', level: 'known', group: 'cycle' },
    MaximumCapacityPercent:  { label: '系統健康度（最大容量）', unit: '%', level: 'known', group: 'health' },
    AppleRawMaxCapacity:     { label: '原始最大容量', unit: 'mAh', level: 'known', group: 'capacity' },
    NominalChargeCapacity:   { label: '標稱滿充容量', unit: 'mAh', level: 'known', group: 'capacity' },
    NCCMax:                  { label: '標稱滿充容量（最大）', unit: 'mAh', level: 'known', group: 'capacity' },
    NCCMin:                  { label: '標稱滿充容量（最小）', unit: 'mAh', level: 'known', group: 'capacity' },
    MaximumFCC:              { label: '滿充容量 FCC（歷史最大）', unit: 'mAh', level: 'known', group: 'capacity' },
    MinimumFCC:              { label: '滿充容量 FCC（歷史最小）', unit: 'mAh', level: 'known', group: 'capacity' },
    QmaxCell0:               { label: '化學容量 Qmax（電芯 0）', unit: 'mAh', level: 'known', group: 'capacity' },
    MaximumQmax:             { label: '化學容量 Qmax（歷史最大）', unit: 'mAh', level: 'known', group: 'capacity' },
    MinimumQmax:             { label: '化學容量 Qmax（歷史最小）', unit: 'mAh', level: 'known', group: 'capacity' },
    AverageTemperature:      { label: '平均溫度', unit: '°C', level: 'guess', group: 'temp' },
    MaximumTemperature:      { label: '最高溫度（原始值，推定 0.1 °C）', unit: '', level: 'guess', group: 'temp' },
    MinimumTemperature:      { label: '最低溫度（原始值，推定 0.1 °C）', unit: '', level: 'guess', group: 'temp' },
    TemperatureSamples:      { label: '溫度取樣次數', unit: '', level: 'guess', group: 'temp' },
    MaximumPackVoltage:      { label: '電池電壓（歷史最高）', unit: 'mV', level: 'known', group: 'elec' },
    MinimumPackVoltage:      { label: '電池電壓（歷史最低）', unit: 'mV', level: 'known', group: 'elec' },
    MaximumDeltaVoltage:     { label: '電芯壓差（最大）', unit: 'mV', level: 'guess', group: 'elec' },
    MinimumDeltaVoltage:     { label: '電芯壓差（最小）', unit: 'mV', level: 'guess', group: 'elec' },
    MaximumChargeCurrent:    { label: '充電電流（歷史最大）', unit: 'mA', level: 'known', group: 'elec' },
    MaximumDischargeCurrent: { label: '放電電流（歷史最大，負值為放電）', unit: 'mA', level: 'known', group: 'elec' },
    DailyMaxSoc:             { label: '當日最高電量', unit: '%', level: 'known', group: 'charge' },
    DailyMinSoc:             { label: '當日最低電量', unit: '%', level: 'known', group: 'charge' },
    TimeAbove95Perc:         { label: '電量高於 95% 的時間', unit: '', level: 'guess', group: 'charge' },
    KioskModeHighSocDays:    { label: '長時間高電量天數', unit: '天', level: 'guess', group: 'charge' },
    KioskModeHighSocSeconds: { label: '長時間高電量秒數', unit: '秒', level: 'guess', group: 'charge' },
    KioskModeLastHighSocHours:{ label: '最近一次高電量持續時數', unit: '小時', level: 'guess', group: 'charge' },
    TotalOperatingTime:      { label: '電池累計運轉時間', unit: '小時（推定）', level: 'guess', group: 'cycle' },
    DOFU:                    { label: '首次使用日（epoch 秒）', unit: '', level: 'known', group: 'cycle' },
    UpdateTime:              { label: '電池資料更新時間（epoch 秒）', unit: '', level: 'known', group: 'cycle' },
    WeekMfd:                 { label: '製造週次（編碼未知）', unit: '', level: 'unknown', group: 'status' },
    BatterySerialChanged:    { label: '電池序號曾變更', unit: '', level: 'known', group: 'status' },
    OriginalBattery:         { label: '原廠電池', unit: '', level: 'known', group: 'status' },
    LifetimeUPOCount:        { label: '非預期關機次數（UPO）', unit: '次', level: 'guess', group: 'status' },
    LastUPOTimestamp:        { label: '最近一次非預期關機時間', unit: '', level: 'guess', group: 'status' },
    WeightedRa:              { label: '加權內阻 Ra', unit: '（原始值）', level: 'guess', group: 'ra' },
    ChemicalWeightedRa:      { label: '化學加權內阻 Ra', unit: '（原始值）', level: 'guess', group: 'ra' },
    BatteryHealthMetric:     { label: '電池健康指標（意義未知）', unit: '', level: 'unknown', group: 'status' },
    RSS:                     { label: 'RSS（意義未知）', unit: '', level: 'unknown', group: 'status' },
    GasGaugeFirmwareVersion: { label: '電量計韌體版本', unit: '', level: 'known', group: 'status' },
    ChemID:                  { label: '電芯化學 ID', unit: '', level: 'known', group: 'status' },
    AlgoChemID:              { label: '演算法化學 ID', unit: '', level: 'known', group: 'status' },
    ResetCnt:                { label: '電量計重置次數', unit: '次', level: 'guess', group: 'status' },
    ServiceOption:           { label: '服務選項', unit: '', level: 'unknown', group: 'status' },
    batteryServiceFlags:     { label: '電池服務旗標', unit: '', level: 'unknown', group: 'status' },
    Flags:                   { label: '狀態旗標', unit: '', level: 'unknown', group: 'status' },
  };
  function info(key) {
    if (F[key]) return F[key];
    const m = key.match(/^RaTable_(\d+)$/);
    if (m) return { label: '內阻表第 ' + m[1] + ' 段', unit: '（原始值）', level: 'guess', group: 'ra' };
    return { label: key, unit: '', level: 'unknown', group: 'other' };
  }
  return { FIELDS: F, info };
});
