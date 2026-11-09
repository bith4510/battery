/*
 * 聲明：本專案的程式碼與文件全部由 AI（Anthropic 的 Claude）產生，內容依據公開的網路資料（Apple 文件、TI 電量計資料、各地論壇與拆解資料等）整理。
 * 專案擁有者不主張任何著作權，以公有領域方式釋出（CC0 1.0：https://creativecommons.org/publicdomain/zero/1.0/），任何人可自由使用、修改、散布。
 * 非 Apple 官方工具；數值僅供參考，不提供任何保證。
 */
/*
 * 電池健康度 Plus 網頁版 — 分析資料解析器
 * 輸入：iPhone「分析資料」檔（Analytics-YYYY-MM-DD-HHMMSS.ips.ca.synced）的文字內容
 * 輸出：電池、容量、溫度、電壓電流、使用時間、充電習慣等結構化資料
 * 只讀取電池與使用時間相關紀錄；裝置識別碼、App 使用統計一律不讀不存。
 * 瀏覽器（全域 BatteryParser）與 Node（module.exports）共用。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BatteryParser = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const PARSER_VERSION = '1.2.1';

  // 電池主紀錄名稱（iOS 27.0 實測）；之後 Apple 改名時在這裡加候選名稱
  const BATTERY_RECORD_NAMES = ['BatteryConfigValueHistogramFinal_V2', 'BatteryConfigValueHistogramFinal'];

  // 其他會讀的紀錄
  const REC = {
    highSoc: 'BatteryTimeAtHighSocLast',
    lowVolt: 'Battery_LowVoltageResidencyCountersLastValue',
    slowCharge: 'SlowChargingReason',
    jit: 'JITCharging_aggregated_metrics_with_trial',
    deviceState: 'RawDeviceStateHistogram',
    wireless: 'DailyWirelessUsageAgg',
  };

  // 安全解析一行 JSON；失敗回 null
  function tryJson(line) {
    try { return JSON.parse(line); } catch (e) { return null; }
  }

  // 數值轉換：null/undefined/非數字 → null
  function num(v) {
    return (typeof v === 'number' && isFinite(v)) ? v : null;
  }

  // 去掉 last_value_ 前綴
  function stripPrefix(msg) {
    const out = {};
    for (const k of Object.keys(msg || {})) {
      out[k.startsWith('last_value_') ? k.slice(11) : k] = msg[k];
    }
    return out;
  }

  // 合併兩組電池欄位：以 primary 為主，primary 為 null 時用 fallback 補
  function mergeFill(primary, fallback) {
    const out = Object.assign({}, fallback || {}, primary || {});
    for (const k of Object.keys(out)) {
      if (out[k] === null && fallback && fallback[k] !== null && fallback[k] !== undefined) out[k] = fallback[k];
    }
    return out;
  }

  // epoch 秒 → Date；0 或無效回 null
  function epochToDate(v) {
    const n = num(v);
    if (!n || n <= 0) return null;
    return new Date(n * 1000);
  }

  // 解析檔頭時間，格式如 "2026-01-01 08:00:00.00 +0800"
  function parseHeaderTime(s) {
    if (typeof s !== 'string') return null;
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})(?:\.\d+)? ([+-])(\d{2})(\d{2})$/);
    if (!m) return null;
    const iso = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}${m[7]}${m[8]}:${m[9]}`;
    const d = new Date(iso);
    return isNaN(d.getTime()) ? null : d;
  }

  // 主函式
  function parse(text) {
    if (typeof text !== 'string' || !text.trim()) {
      return { ok: false, error: '檔案是空的' };
    }
    const lines = text.split(/\r?\n/);
    const header = tryJson(lines[0]) || {};
    const result = {
      ok: false,
      parserVersion: PARSER_VERSION,
      meta: {
        osVersion: header.os_version || null,
        fileTime: parseHeaderTime(header.timestamp),
        fileTimeRaw: header.timestamp || null,
        bugType: header.bug_type || null,
        productSku: null,
        deviceCapacityGB: null,
        ramGB: null,
        ipadHint: null,       // metadata 的行動網路業者名稱含「iPad」時為 true（只有行動網路版 iPad 才有）；其他情況不確定，維持 null
      },
      battery: null,          // 電池欄位（去前綴、合併後）
      batteryRecordName: null,
      packs: [],              // 各 BatteryPackID 原始欄位
      highSocBins: [],        // [{bin, value}]
      lowVoltageBins: [],
      slowChargingReason: null,
      jit: null,              // 最佳化充電統計
      deviceStates: [],       // 一天的裝置狀態分布
      wireless: null,         // 無線模組統計（含螢幕亮、充電、低耗電時間）
      warnings: [],
    };

    // 第二行通常是 metadata
    const meta = tryJson(lines[1]);
    if (meta && meta._marker === '<metadata>') {
      result.meta.productSku = meta.productSku || null;
      result.meta.deviceCapacityGB = num(meta.deviceCapacity);
      result.meta.ramGB = num(meta.dramSize);
      if (/iPad/i.test(String(meta.homeCarrierName || ''))) result.meta.ipadHint = true;
    }
    if (!result.meta.osVersion || !/iPhone OS|iOS/.test(result.meta.osVersion)) {
      result.warnings.push('檔頭沒有 iPhone OS 版本，可能不是 iPhone／iPad 的分析資料檔');
    }

    const packRecords = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line || line.indexOf('"name"') < 0) continue;
      // 先用字串快速過濾，避免解析上千行無關紀錄
      if (!/Battery|JITCharging|SlowChargingReason|RawDeviceStateHistogram|DailyWirelessUsageAgg/.test(line)) continue;
      const o = tryJson(line);
      if (!o || typeof o.name !== 'string') continue;
      const msg = o.message || {};
      if (BATTERY_RECORD_NAMES.indexOf(o.name) >= 0) {
        packRecords.push({ name: o.name, packId: num(msg.BatteryPackID), fields: stripPrefix(msg) });
      } else if (o.name === REC.highSoc) {
        result.highSocBins.push({ bin: Number(msg.bin), value: num(msg.last_value_value) });
      } else if (o.name === REC.lowVolt) {
        result.lowVoltageBins.push({ bin: Number(msg.bin), value: num(msg.last_value_value) });
      } else if (o.name === REC.slowCharge) {
        result.slowChargingReason = num(msg.slow_charging_reason);
      } else if (o.name === REC.jit) {
        result.jit = {
          pluginSec: num(msg.sum_of_PluginDuration),
          idleSec: num(msg.sum_of_IdleDuration),
          actualUsableSec: num(msg.sum_of_ActualUsableEligibleDuration),
          estimatedUsableSec: num(msg.sum_of_EstimatedUsableEligibleDuration),
          underChargedAvoidable: num(msg.sum_of_UnderChargedAvoidable),
          underChargedUnavoidable: num(msg.sum_of_UnderChargedUnavoidable),
          count: num(msg.Count),
        };
      } else if (o.name === REC.deviceState) {
        result.deviceStates.push({
          awake: msg.awake === 1, charging: msg.charging === 1, pluggedIn: msg.pluggedIn === 1,
          screenOn: msg.screenOn === 1, lpm: msg.lpm === 1,
          durationSec: num(msg.sum_of_duration) || 0,
          energyNet: num(msg.sum_of_energyPassedChargeNet),
          energyAbs: num(msg.sum_of_energyAbsolute),
        });
      } else if (o.name === REC.wireless) {
        result.wireless = {
          totalSec: num(msg.sum_of_duration),
          screenOnSec: num(msg.sum_of_duration_screen_on),
          chargingSec: num(msg.sum_of_duration_charging),
          lowPowerModeSec: num(msg.sum_of_duration_low_power_mode),
          callsSec: num(msg.sum_of_duration_calls),
        };
      }
    }

    result.highSocBins.sort((a, b) => a.bin - b.bin);
    result.lowVoltageBins.sort((a, b) => a.bin - b.bin);

    if (!packRecords.length) {
      result.noBattery = true;   // 讓介面把多份「沒有電池紀錄」合併成一則訊息
      result.error = '找不到電池紀錄（' + BATTERY_RECORD_NAMES[0] + '）。可能是：分析檔太新還沒收集到、選錯檔案，或 Apple 改了紀錄名稱。';
      return result;
    }
    // 以 BatteryPackID 0 為主（含首次使用日），其他 pack 補空值
    packRecords.sort((a, b) => (a.packId === 0 ? -1 : b.packId === 0 ? 1 : 0));
    result.packs = packRecords.map(p => ({ packId: p.packId, fields: p.fields }));
    let merged = packRecords[0].fields;
    for (let i = 1; i < packRecords.length; i++) merged = mergeFill(merged, packRecords[i].fields);
    result.battery = merged;
    result.batteryRecordName = packRecords[0].name;
    result.ok = true;
    return result;
  }

  // 依設計容量計算衍生值
  function derive(parsed, designCapacity) {
    const b = (parsed && parsed.battery) || {};
    const design = num(designCapacity);
    const pct = (v) => (design && num(v) !== null) ? (num(v) / design * 100) : null;
    const firstUse = epochToDate(b.DOFU);
    // 實機發現：DOFU 都是 604800 秒（一週）的整數倍、落在週四 00:00 UTC，代表 Apple 只記到「哪一週」（實際啟用日會被記成該週的週四）
    const dofuWeek = firstUse !== null && num(b.DOFU) % 604800 === 0;
    const firstUseEnd = dofuWeek ? new Date(firstUse.getTime() + 6 * 86400000) : null;
    const ref = (parsed && parsed.meta && parsed.meta.fileTime) || epochToDate(b.UpdateTime);
    const daysMax = (firstUse && ref) ? (ref - firstUse) / 86400000 : null;
    // 那一週是 [DOFU, DOFU+7 天)：最晚在第 7 天結束前啟用，所以已使用天數下限＝上限 − 7（v1.3.10 修正：原本減 6 少算 1 天）
    // 檔案時間早於 DOFU（時鐘異常）時，下限不得大於上限
    const daysMin = (daysMax !== null && dofuWeek) ? Math.min(daysMax, Math.max(0, daysMax - 7)) : daysMax;
    const daysSinceFirstUse = daysMax === null ? null : (daysMax + daysMin) / 2;     // 以週為單位時取中間值
    const cycles = num(b.CycleCount);
    const opHours = num(b.TotalOperatingTime);
    const tMax = num(b.MaximumTemperature);
    const tMin = num(b.MinimumTemperature);
    const vMax = num(b.MaximumPackVoltage);
    const vMin = num(b.MinimumPackVoltage);
    return {
      design,
      healthSystem: num(b.MaximumCapacityPercent),
      healthRaw: pct(b.AppleRawMaxCapacity),
      healthNominal: pct(b.NominalChargeCapacity),
      healthQmax: pct(b.QmaxCell0),
      healthFccMax: pct(b.MaximumFCC),
      healthFccMin: pct(b.MinimumFCC),
      lostRawMah: (design && num(b.AppleRawMaxCapacity) !== null) ? design - b.AppleRawMaxCapacity : null,
      firstUse,
      firstUseEnd,                 // 以週為單位時的週末日（firstUse～firstUseEnd 之間某一天）
      dofuWeek,
      daysSinceMin: daysMin,
      daysSinceMax: daysMax,
      lastUpdate: epochToDate(b.UpdateTime),
      daysSinceFirstUse,
      cyclesPerDay: (cycles !== null && daysSinceFirstUse > 0) ? cycles / daysSinceFirstUse : null,
      operatingHours: opHours,
      operatingRatio: (opHours !== null && daysSinceFirstUse > 0) ? opHours / (daysSinceFirstUse * 24) : null,
      // 最高、最低溫度原始值推定單位 0.1 °C（504 → 50.4 °C）；平均溫度原始值已是 °C
      tempMaxC: tMax !== null ? tMax / 10 : null,
      tempMinC: tMin !== null ? tMin / 10 : null,
      tempAvgC: num(b.AverageTemperature),
      voltMaxV: vMax !== null ? vMax / 1000 : null,
      voltMinV: vMin !== null ? vMin / 1000 : null,
      chargeCurrentMaxA: num(b.MaximumChargeCurrent) !== null ? b.MaximumChargeCurrent / 1000 : null,
      dischargeCurrentMaxA: num(b.MaximumDischargeCurrent) !== null ? Math.abs(b.MaximumDischargeCurrent) / 1000 : null,
      fccSpread: (num(b.MaximumFCC) !== null && num(b.MinimumFCC) !== null) ? b.MaximumFCC - b.MinimumFCC : null,
      // C 率＝電流（A）÷ 設計容量（Ah），電池業界描述充放電強度的標準單位
      chargeCRate: (design && num(b.MaximumChargeCurrent) !== null) ? (b.MaximumChargeCurrent / 1000) / (design / 1000) : null,
      dischargeCRate: (design && num(b.MaximumDischargeCurrent) !== null) ? (Math.abs(b.MaximumDischargeCurrent) / 1000) / (design / 1000) : null,
      originalBatteryHint: b.BatterySerialChanged === false ? '電池序號未變更' : (b.BatterySerialChanged === true ? '電池序號曾變更' : '無資料'),
    };
  }

  // 一天的使用時間彙總（秒）
  function summarizeUsage(parsed) {
    const s = { totalSec: 0, screenOnSec: 0, screenOnUnpluggedSec: 0, pluggedSec: 0, chargingSec: 0,
                sleepUnpluggedSec: 0, awakeScreenOffUnpluggedSec: 0, lpmSec: 0,
                energyUnplugged: 0, energyScreenOnUnplugged: 0 };
    for (const r of (parsed && parsed.deviceStates) || []) {
      const d = r.durationSec || 0;
      s.totalSec += d;
      if (r.screenOn) s.screenOnSec += d;
      if (r.screenOn && !r.pluggedIn) s.screenOnUnpluggedSec += d;
      if (r.pluggedIn) s.pluggedSec += d;
      if (r.charging) s.chargingSec += d;
      if (r.lpm) s.lpmSec += d;
      if (!r.pluggedIn && !r.awake) s.sleepUnpluggedSec += d;
      if (!r.pluggedIn && r.awake && !r.screenOn) s.awakeScreenOffUnpluggedSec += d;
      if (!r.pluggedIn && r.energyNet !== null) s.energyUnplugged += r.energyNet;
      if (!r.pluggedIn && r.screenOn && r.energyNet !== null) s.energyScreenOnUnplugged += r.energyNet;
    }
    return s;
  }

  // 產生要存進歷史紀錄的精簡快照（不含任何識別資料）
  function snapshot(parsed, designCapacity) {
    const b = parsed.battery || {};
    const d = derive(parsed, designCapacity);
    const u = summarizeUsage(parsed);
    return {
      key: (parsed.meta.fileTimeRaw || '') + '|' + (b.UpdateTime || ''),
      fileTime: parsed.meta.fileTime ? parsed.meta.fileTime.toISOString() : null,
      osVersion: parsed.meta.osVersion,
      design: d.design,
      cycle: num(b.CycleCount),
      healthSystem: d.healthSystem,
      healthRaw: d.healthRaw,
      healthNominal: d.healthNominal,
      healthQmax: d.healthQmax,
      rawMax: num(b.AppleRawMaxCapacity),
      nominal: num(b.NominalChargeCapacity),
      qmax: num(b.QmaxCell0),
      fccMax: num(b.MaximumFCC), fccMin: num(b.MinimumFCC),
      tempAvg: d.tempAvgC, tempMax: d.tempMaxC, tempMin: d.tempMinC,
      voltMax: d.voltMaxV, voltMin: d.voltMinV,
      opHours: d.operatingHours,
      weightedRa: num(b.WeightedRa),
      dailyMaxSoc: num(b.DailyMaxSoc), dailyMinSoc: num(b.DailyMinSoc),
      screenOnH: u.totalSec ? u.screenOnSec / 3600 : null,
      chargingH: u.totalSec ? u.chargingSec / 3600 : null,
      // v1.1 起保存完整電池原始欄位（不含識別資料），日後公式更新可直接重算
      raw: Object.assign({}, b),
      usage: u,
      parserVersion: PARSER_VERSION,
      // v1.3.6：裝置辨識（分析檔沒有型號代碼；以電池「首次使用日」DOFU 區分不同裝置，換電池後會視為新裝置）
      dev: deviceKey(b),
      devInfo: { firstUse: epochToDate(b.DOFU) ? epochToDate(b.DOFU).toISOString() : null, sku: parsed.meta.productSku || null,
                 capacityGB: parsed.meta.deviceCapacityGB, ramGB: parsed.meta.ramGB, ipad: parsed.meta.ipadHint },
    };
  }

  // 裝置代碼：電池首次使用日（DOFU，秒級時間戳）；沒有時回傳 null
  function deviceKey(b) {
    const v = b ? num(b.DOFU) : null;
    return v ? 'dofu:' + v : null;
  }

  // 由「標稱容量 ÷ 設計容量 四捨五入＝系統健康度」反推設計容量範圍，回傳 { lo, hi }（無法判斷時 null）
  // 系統顯示 100% 時只知道上限（新電池標稱容量可能高於設計容量）
  function designRange(snaps) {
    let lo = 0, hi = Infinity, used = 0;
    for (const s of snaps || []) {
      const n = num(s && s.nominal), p = num(s && s.healthSystem);
      if (n === null || p === null || p <= 0) continue;
      used++;
      if (p >= 100) { hi = Math.min(hi, n / 0.995); continue; }
      lo = Math.max(lo, n / ((p + 0.5) / 100));
      hi = Math.min(hi, n / ((p - 0.5) / 100));
    }
    return used && lo <= hi ? { lo, hi, used } : null;
  }

  // 依設計容量範圍與 iPad 線索挑出可能的型號；models 為型號表（id、group、design）
  // v1.3.9：實機發現系統健康度（MaximumCapacityPercent）不會每天跟著標稱容量更新——
  // 標稱容量 ÷ 設計容量已降到四捨五入少 1%，系統仍顯示原值好幾天，
  // 所以各筆的範圍取交集會變成空集合。改成「每個型號算有幾筆對得上」，取對得上最多的型號（至少一半）。
  // v1.3.10：系統顯示 100% 時只知道「標稱 ÷ 設計 ≥ 99.5%」，新電池可超過 100%，下限放寬到 110%（原本 100.5% 會把新電池判成較大容量的型號）
  const NEW_BATTERY_MAX_RATIO = 1.10;   // 新電池標稱容量最多約為設計容量的 110%（推定上限，只用來縮小型號範圍）
  function guessModels(snaps, models, ipadHint) {
    const pts = (snaps || []).map(s => ({ n: num(s && s.nominal), p: num(s && s.healthSystem) })).filter(s => s.n !== null && s.p !== null && s.p > 0);
    if (!pts.length) return [];
    let all = models || [];
    if (ipadHint === true) all = all.filter(m => /^iPad/.test(m.group));
    const fits = (m, tolPct) => pts.filter(({ n, p }) => {
      const lo = (p >= 100 ? n / NEW_BATTERY_MAX_RATIO : n / ((p + 0.5) / 100)) * (1 - tolPct), hi = p >= 100 ? n / 0.995 * (1 + tolPct) : n / ((p - 0.5) / 100) * (1 + tolPct);
      return m.design >= lo - 0.5 && m.design <= hi + 0.5;
    }).length;
    const best = (tol) => {
      const scored = all.map(m => ({ m, k: fits(m, tol(m)) }));
      const top = Math.max(0, ...scored.map(x => x.k));
      return top >= Math.ceil(pts.length / 2) ? scored.filter(x => x.k === top).map(x => x.m) : [];
    };
    // 先用精確範圍；都沒有時，才把推估值（conf＝est，可能偏差 1～2%）放寬 ±2% 再找
    const exact = best(() => 0);
    return exact.length ? exact : best(m => (m.conf === 'est' ? 0.02 : 0));
  }

  // 合併歷史紀錄：同 key 以新的取代，依檔案時間排序
  function mergeHistory(history, snap) {
    const list = (Array.isArray(history) ? history : []).filter(h => h && h.key !== snap.key);
    list.push(snap);
    list.sort((a, b) => String(a.fileTime).localeCompare(String(b.fileTime)));
    return list;
  }

  /*
   * 最小平方法線性回歸 y = a + b·x
   * b = Σ(x-x̄)(y-ȳ) / Σ(x-x̄)²，a = ȳ - b·x̄，R² = 1 - SSres/SStot
   * 少於 2 點或 x 全相同時回傳 null（斜率無定義）；y 全相同時 R² 定為 1（完全由直線解釋）
   * v1.3.10：先減掉第一點當偏移再算，y 全相同時 Σ(y-ȳ)² 才會剛好是 0
   *（原本 50.4 這類小數連續 7 筆，平均值有浮點誤差，R² 被算成 0；x 是毫秒時間戳時也減少相消誤差）
   */
  function linearRegression(pts) {
    const v = (pts || []).filter(p => num(p.x) !== null && num(p.y) !== null);
    const n = v.length;
    if (n < 2) return null;
    const x0 = v[0].x, y0 = v[0].y;
    let sx = 0, sy = 0;
    for (const p of v) { sx += p.x - x0; sy += p.y - y0; }
    const mx = sx / n, my = sy / n;              // 偏移後的平均
    let sxx = 0, sxy = 0, syy = 0;
    for (const p of v) { const dx = (p.x - x0) - mx, dy = (p.y - y0) - my; sxx += dx * dx; sxy += dx * dy; syy += dy * dy; }
    if (sxx === 0) return null;
    const slope = sxy / sxx, intercept = (my + y0) - slope * (mx + x0);
    let ssRes = 0;
    for (const p of v) { const e = (p.y - y0) - (my + slope * ((p.x - x0) - mx)); ssRes += e * e; }
    const r2 = syy === 0 ? 1 : 1 - ssRes / syy;
    return { n, slope, intercept, r2, xMin: Math.min(...v.map(p => p.x)), xMax: Math.max(...v.map(p => p.x)) };
  }

  // 簡單移動平均：依 x 排序後，每點取「含自己在內往前 window 點」的平均；點數不足 window 時用現有點數
  function movingAverage(pts, window) {
    const v = (pts || []).filter(p => num(p.x) !== null && num(p.y) !== null).slice().sort((a, b) => a.x - b.x);
    const w = Math.max(1, Math.floor(window || 1));
    return v.map((p, i) => { const s = v.slice(Math.max(0, i - w + 1), i + 1); return { x: p.x, y: s.reduce((t, q) => t + q.y, 0) / s.length }; });
  }

  return { PARSER_VERSION, BATTERY_RECORD_NAMES, parse, derive, summarizeUsage, snapshot, mergeHistory, linearRegression, movingAverage,
           deviceKey, designRange, guessModels,
           _internal: { parseHeaderTime, stripPrefix, mergeFill, epochToDate } };
});
