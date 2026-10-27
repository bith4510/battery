/* 電池健康度 Plus 網頁版 — 畫面邏輯 */
(function () {
  'use strict';
  const APP_VERSION = '1.0';
  const P = window.BatteryParser, M = window.BatteryModels, FD = window.BatteryFields;
  const LS_MODEL = 'bhp_model_v1', LS_CUSTOM = 'bhp_custom_design_v1', LS_HISTORY = 'bhp_history_v1';
  const $ = (id) => document.getElementById(id);

  // ---------- 本機儲存（Safari 私密瀏覽等情況可能丟例外，一律包起來）----------
  function lsGet(k, def) { try { const v = localStorage.getItem(k); return v === null ? def : v; } catch (e) { return def; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function loadHistory() { try { const a = JSON.parse(lsGet(LS_HISTORY, '[]')); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function saveHistory(h) { return lsSet(LS_HISTORY, JSON.stringify(h)); }

  // ---------- 格式化 ----------
  function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function fmt(v, d) { if (v === null || v === undefined || (typeof v === 'number' && !isFinite(v))) return '—'; return typeof v === 'number' ? v.toLocaleString('zh-TW', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }) : String(v); }
  function fmtDate(dt) { if (!dt) return '—'; const d = new Date(dt); if (isNaN(d)) return '—'; const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; }
  function fmtDateTime(dt) { if (!dt) return '—'; const d = new Date(dt); if (isNaN(d)) return '—'; const p = n => String(n).padStart(2, '0'); return `${fmtDate(d)} ${p(d.getHours())}:${p(d.getMinutes())}`; }
  function fmtH(sec) { if (sec === null || sec === undefined) return '—'; const h = sec / 3600; return h >= 1 ? fmt(h, 1) + ' 小時' : fmt(sec / 60, 0) + ' 分'; }
  function tag(level) { return level === 'guess' ? '<span class="tag guess">推定</span>' : level === 'unknown' ? '<span class="tag unknown">未知</span>' : ''; }
  function stat(k, v, s) { return `<div class="stat"><div class="k">${esc(k)}</div><div class="v">${v}</div>${s ? `<div class="s">${s}</div>` : ''}</div>`; }
  function healthColor(p) { if (p === null) return 'var(--muted)'; return p >= 90 ? 'var(--good)' : p >= 80 ? 'var(--warn)' : 'var(--bad)'; }
  // 兩欄表格列：左邊項目（下方小字說明），右邊數值；手機窄螢幕不會把項目擠成一字一行
  function row2(label, value, noteHtml, tagHtml) {
    const long = String(value).length > 14;
    return `<tr><td>${esc(label)}${tagHtml || ''}${noteHtml ? `<div class="muted">${noteHtml}</div>` : ''}</td><td class="n${long ? ' wrap' : ''}">${esc(value)}</td></tr>`;
  }
  function msg(el, kind, text) { el.insertAdjacentHTML('beforeend', `<div class="msg ${kind}">${esc(text)}</div>`); }

  // ---------- 型號 ----------
  function initModels() {
    const sel = $('model');
    sel.innerHTML = M.MODELS.map(m => `<option value="${m.id}">${esc(m.name.replace('iPhone ', '').replace('（實體 SIM 卡槽）', '・實體 SIM').replace('（僅 eSIM）', '・eSIM'))}・${m.design} mAh</option>`).join('') + '<option value="custom">自訂設計容量</option>';
    sel.value = lsGet(LS_MODEL, M.DEFAULT_ID);
    if (!sel.value) sel.value = M.DEFAULT_ID;
    $('customDesign').value = lsGet(LS_CUSTOM, '');
    $('modelSource').textContent = '分析資料檔不含型號與設計容量，健康度百分比依這裡選的容量計算。' + M.SOURCE + '。';
    const sync = () => {
      $('customDesign').classList.toggle('hidden', sel.value !== 'custom');
      lsSet(LS_MODEL, sel.value);
      lsSet(LS_CUSTOM, $('customDesign').value);
      if (current) render(current);
    };
    sel.addEventListener('change', sync);
    $('customDesign').addEventListener('input', sync);
    $('customDesign').classList.toggle('hidden', sel.value !== 'custom');
  }
  function designCapacity() {
    const sel = $('model');
    if (sel.value === 'custom') { const v = Number($('customDesign').value); return v >= 500 && v <= 10000 ? v : null; }
    const m = M.find(sel.value); return m ? m.design : null;
  }

  // ---------- 讀檔 ----------
  let current = null;
  function readFile(f) {
    return new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve({ name: f.name, text: String(r.result || '') });
      r.onerror = () => resolve({ name: f.name, text: null });
      r.readAsText(f);
    });
  }
  async function onFiles(files) {
    const box = $('messages'); box.innerHTML = '';
    if (!files || !files.length) return;
    let history = loadHistory(), latest = null, okCount = 0;
    for (const f of files) {
      const { name, text } = await readFile(f);
      if (text === null) { msg(box, 'err', `${name}：讀取失敗`); continue; }
      const parsed = P.parse(text);
      parsed.warnings.forEach(w => msg(box, 'warn', `${name}：${w}`));
      if (!parsed.ok) { msg(box, 'err', `${name}：${parsed.error}`); continue; }
      okCount++;
      history = P.mergeHistory(history, P.snapshot(parsed, designCapacity()));
      if (!latest || String(parsed.meta.fileTime) > String(latest.meta.fileTime) || (parsed.meta.fileTime && latest.meta.fileTime && parsed.meta.fileTime > latest.meta.fileTime)) latest = parsed;
    }
    if (okCount) {
      if (!saveHistory(history)) msg(box, 'warn', '這個瀏覽器無法儲存紀錄（可能是私密瀏覽），趨勢圖只在這次有效。');
      msg(box, 'ok', `已讀取 ${okCount} 份檔案，顯示最新一份（${fmtDateTime(latest.meta.fileTime)}）。`);
      current = latest; render(current); renderHistory(history);
    }
    $('file').value = '';
  }

  // ---------- 報告 ----------
  function render(p) {
    const b = p.battery, d = P.derive(p, designCapacity()), u = P.summarizeUsage(p);
    $('report').classList.remove('hidden');

    // 健康度
    const hs = (label, v, sub) => stat(label, `<span style="color:${healthColor(v)}">${fmt(v, 1)}${v === null ? '' : '%'}</span>`, sub);
    $('healthStats').innerHTML =
      hs('系統顯示', d.healthSystem, '分析檔 MaximumCapacityPercent') +
      hs('原始最大容量', d.healthRaw, `${fmt(b.AppleRawMaxCapacity)} ÷ ${fmt(d.design)} mAh`) +
      hs('標稱滿充容量', d.healthNominal, `${fmt(b.NominalChargeCapacity)} ÷ ${fmt(d.design)} mAh`) +
      hs('化學容量 Qmax', d.healthQmax, `${fmt(b.QmaxCell0)} ÷ ${fmt(d.design)} mAh`);
    $('healthNote').textContent = d.design ? `設計容量 ${fmt(d.design)} mAh。超過 100% 代表實際容量比設計值高，新電池常見。` : '尚未設定設計容量，百分比無法計算。';
    const capMax = Math.max(d.design || 0, b.MaximumQmax || 0, b.MaximumFCC || 0, 1);
    const bar = (label, v, color) => `<div class="bar"><span>${esc(label)}</span><div class="track"><div class="fill" style="width:${v ? Math.min(100, v / capMax * 100) : 0}%;background:${color}"></div></div><span class="n" style="text-align:right">${fmt(v)} mAh</span></div>`;
    $('capBars').innerHTML = bar('設計容量', d.design, 'var(--bar4)') + bar('化學容量', b.QmaxCell0, 'var(--bar3)') + bar('原始最大', b.AppleRawMaxCapacity, 'var(--bar1)') + bar('標稱滿充', b.NominalChargeCapacity, 'var(--bar2)');

    // 循環
    $('cycleStats').innerHTML =
      stat('循環次數', fmt(b.CycleCount), `上次更新 Qmax 時：${fmt(b.CycleCountLastQmax)}`) +
      stat('首次使用', fmtDate(d.firstUse), d.daysSinceFirstUse !== null ? `已使用 ${fmt(d.daysSinceFirstUse, 0)} 天` : '') +
      stat('平均每天循環', fmt(d.cyclesPerDay, 2), d.cyclesPerDay !== null ? `約每 ${fmt(1 / d.cyclesPerDay, 1)} 天一次` : '') +
      stat('累計運轉', d.operatingHours !== null ? fmt(d.operatingHours) + ' h' : '—', d.operatingRatio !== null ? `佔使用期間 ${fmt(d.operatingRatio * 100, 0)}%（單位推定為小時）` : '單位推定為小時');

    // 容量表
    const capRows = [
      ['設計容量（依型號）', d.design, '', 'known'],
      ['原始最大容量', b.AppleRawMaxCapacity, 'AppleRawMaxCapacity', 'known'],
      ['標稱滿充容量', b.NominalChargeCapacity, 'NominalChargeCapacity', 'known'],
      ['標稱滿充容量 最大／最小', `${fmt(b.NCCMax)}／${fmt(b.NCCMin)}`, 'NCCMax／NCCMin', 'known'],
      ['滿充容量 FCC 最大／最小', `${fmt(b.MaximumFCC)}／${fmt(b.MinimumFCC)}`, `差 ${fmt(d.fccSpread)} mAh`, 'known'],
      ['化學容量 Qmax（電芯 0）', b.QmaxCell0, 'QmaxCell0', 'known'],
      ['化學容量 Qmax 最大／最小', `${fmt(b.MaximumQmax)}／${fmt(b.MinimumQmax)}`, 'MaximumQmax／MinimumQmax', 'known'],
      ['與設計容量相差（原始）', d.lostRawMah, '正數＝少於設計值', 'known'],
    ];
    $('capTable').innerHTML = '<tr><th>項目</th><th class="n">mAh</th></tr>' + capRows.map(r => row2(r[0], typeof r[1] === 'string' ? r[1] : fmt(r[1]), esc(r[2]), tag(r[3]))).join('');

    // 溫度
    $('tempStats').innerHTML =
      stat('平均', d.tempAvgC !== null ? fmt(d.tempAvgC, 0) + ' °C' : '—', `原始 ${fmt(b.AverageTemperature)}` + tag('guess')) +
      stat('歷史最高', d.tempMaxC !== null ? fmt(d.tempMaxC, 1) + ' °C' : '—', `原始 ${fmt(b.MaximumTemperature)}` + tag('guess')) +
      stat('歷史最低', d.tempMinC !== null ? fmt(d.tempMinC, 1) + ' °C' : '—', `原始 ${fmt(b.MinimumTemperature)}` + tag('guess')) +
      stat('溫差', (d.tempMaxC !== null && d.tempMinC !== null) ? fmt(d.tempMaxC - d.tempMinC, 1) + ' °C' : '—', `取樣次數 ${fmt(b.TemperatureSamples)}`);

    // 電壓電流
    $('elecStats').innerHTML =
      stat('電壓 最高', d.voltMaxV !== null ? fmt(d.voltMaxV, 3) + ' V' : '—', 'MaximumPackVoltage') +
      stat('電壓 最低', d.voltMinV !== null ? fmt(d.voltMinV, 3) + ' V' : '—', 'MinimumPackVoltage') +
      stat('充電電流 最大', d.chargeCurrentMaxA !== null ? fmt(d.chargeCurrentMaxA, 2) + ' A' : '—', 'MaximumChargeCurrent') +
      stat('放電電流 最大', d.dischargeCurrentMaxA !== null ? fmt(d.dischargeCurrentMaxA, 2) + ' A' : '—', 'MaximumDischargeCurrent');

    // 使用時間
    $('usageNote').textContent = u.totalSec ? `統計期間約 ${fmt(u.totalSec / 3600, 1)} 小時（分析檔是每日彙整，時間已被系統四捨五入到約兩位有效數字）。` : '這份檔案沒有裝置狀態統計。';
    const ub = (label, sec, color) => `<div class="bar"><span>${esc(label)}</span><div class="track"><div class="fill" style="width:${u.totalSec ? Math.min(100, sec / u.totalSec * 100) : 0}%;background:${color}"></div></div><span class="n" style="text-align:right">${fmtH(sec)}</span></div>`;
    $('usageBars').innerHTML = u.totalSec ?
      ub('螢幕亮（未接電）', u.screenOnUnpluggedSec, 'var(--bar1)') + ub('螢幕暗但喚醒', u.awakeScreenOffUnpluggedSec, 'var(--bar3)') +
      ub('睡眠（未接電）', u.sleepUnpluggedSec, 'var(--bar4)') + ub('接電源', u.pluggedSec, 'var(--bar2)') : '';
    const w = p.wireless || {};
    const usageRows = [
      ['螢幕亮（全部）', fmtH(u.totalSec ? u.screenOnSec : null), '裝置狀態統計'],
      ['螢幕亮（行動網路模組統計）', fmtH(w.screenOnSec), '另一個來源，定義可能不同'],
      ['接電源', fmtH(u.totalSec ? u.pluggedSec : null), ''],
      ['實際充電中', fmtH(u.totalSec ? u.chargingSec : null), '裝置狀態統計'],
      ['充電（行動網路模組統計）', fmtH(w.chargingSec), ''],
      ['低耗電模式', fmtH(w.lowPowerModeSec), '行動網路模組統計'],
      ['未接電時消耗能量', u.totalSec ? fmt(u.energyUnplugged) : '—', '原始值，單位推定為 mWh'],
      ['其中螢幕亮時', u.totalSec ? fmt(u.energyScreenOnUnplugged) : '—', '原始值，單位推定為 mWh'],
    ];
    $('usageTable').innerHTML = '<tr><th>項目</th><th class="n">數值</th></tr>' + usageRows.map(r => row2(r[0], r[1], esc(r[2]) + (/推定/.test(r[2]) ? tag('guess') : ''))).join('');

    // 充電習慣
    const j = p.jit || {};
    $('chargeStats').innerHTML =
      stat('當日最高電量', b.DailyMaxSoc !== null && b.DailyMaxSoc !== undefined ? fmt(b.DailyMaxSoc) + '%' : '—', '') +
      stat('當日最低電量', b.DailyMinSoc !== null && b.DailyMinSoc !== undefined ? fmt(b.DailyMinSoc) + '%' : '—', '') +
      stat('插電時間', fmtH(j.pluginSec), '最佳化充電統計') +
      stat('慢速充電原因', p.slowChargingReason === null ? '—' : String(p.slowChargingReason), p.slowChargingReason === 0 ? '0＝推定為無' + tag('guess') : '代碼意義未知');
    const chargeRows = [
      ['插電但閒置（未充電）', fmtH(j.idleSec), '最佳化充電統計'],
      ['可延後充電的時間（實際／預估）', `${fmtH(j.actualUsableSec)}／${fmtH(j.estimatedUsableSec)}`, ''],
      ['沒充滿就拔掉（可避免／不可避免）', `${fmt(j.underChargedAvoidable)}／${fmt(j.underChargedUnavoidable)} 次`, ''],
      ['高電量持續（最近一次）', b.KioskModeLastHighSocHours !== undefined ? fmt(b.KioskModeLastHighSocHours) + ' 小時' : '—', 'KioskModeLastHighSocHours'],
      ['高電量時間分布（各區間原始值）', p.highSocBins.map(x => fmt(x.value)).join('、') || '—', 'BatteryTimeAtHighSocLast，區間定義未知'],
      ['低電壓停留（各區間原始值）', p.lowVoltageBins.length ? (p.lowVoltageBins.every(x => !x.value) ? `全部 0（${p.lowVoltageBins.length} 區間）` : p.lowVoltageBins.map(x => fmt(x.value)).join('、')) : '—', '全 0 代表沒有長時間低電壓'],
    ];
    $('chargeTable').innerHTML = '<tr><th>項目</th><th class="n">數值</th></tr>' + chargeRows.map(r => row2(r[0], r[1], esc(r[2]))).join('');

    // 內阻表
    const ra = []; for (let i = 1; i <= 15; i++) { const v = b['RaTable_' + i]; if (typeof v === 'number') ra.push({ i, v }); }
    $('raChart').innerHTML = ra.length ? raSvg(ra) + `<p class="muted">加權內阻 ${fmt(b.WeightedRa)}，化學加權內阻 ${fmt(b.ChemicalWeightedRa)}</p>` : '<p class="muted">沒有內阻表資料</p>';

    // 狀態
    const st = [
      ['電池序號', d.originalBatteryHint, 'BatterySerialChanged'],
      ['非預期關機次數', fmt(b.LifetimeUPOCount), 'LifetimeUPOCount' + tag('guess')],
      ['電量計重置（總計／軟體／硬體）', `${fmt(b.ResetCnt)}／${fmt(b.ResetDataSoftware)}／${fmt(b.ResetDataHardware)}`, ''],
      ['電量計韌體版本', fmt(b.GasGaugeFirmwareVersion), ''],
      ['製造週次（原始值）', fmt(b.WeekMfd), '編碼未知' + tag('unknown')],
      ['電池資料更新時間', fmtDateTime(d.lastUpdate), 'UpdateTime'],
      ['分析檔時間', fmtDateTime(p.meta.fileTime), ''],
      ['iOS 版本', p.meta.osVersion || '—', ''],
      ['解析的紀錄', p.batteryRecordName + `（${p.packs.length} 組）`, ''],
    ];
    $('statusTable').innerHTML = st.map(r => row2(r[0], r[1], r[2])).join('');

    // 全部原始欄位
    const keys = Object.keys(b).sort();
    $('rawCount').textContent = keys.length;
    $('rawTable').innerHTML = '<tr><th>欄位</th><th class="n">原始值</th></tr>' + keys.map(k => {
      const fi = FD.info(k); const v = b[k];
      return row2(fi.label + (fi.unit ? '（' + fi.unit + '）' : ''), v === null ? 'null' : (typeof v === 'number' ? String(v) : JSON.stringify(v)), `<code>${esc(k)}</code>`, tag(fi.level));
    }).join('');
  }

  // 內阻表長條圖
  function raSvg(ra) {
    const W = 600, H = 180, pad = 26, max = Math.max(...ra.map(r => r.v), 1);
    const bw = (W - pad * 2) / ra.length;
    const useLog = max / Math.max(1, Math.min(...ra.map(r => r.v))) > 20;
    const sc = v => useLog ? Math.log10(v + 1) / Math.log10(max + 1) : v / max;
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="內阻表">`;
    ra.forEach((r, k) => {
      const h = sc(r.v) * (H - pad * 2), x = pad + k * bw + 2, y = H - pad - h;
      s += `<rect x="${x}" y="${y}" width="${bw - 4}" height="${h}" rx="3" fill="var(--bar3)"><title>第 ${r.i} 段：${r.v}</title></rect>`;
      s += `<text class="chart-text" x="${x + (bw - 4) / 2}" y="${H - 8}" text-anchor="middle">${r.i}</text>`;
      s += `<text class="chart-text" x="${x + (bw - 4) / 2}" y="${y - 3}" text-anchor="middle">${r.v}</text>`;
    });
    s += `<line class="chart-axis" x1="${pad}" y1="${H - pad}" x2="${W - pad}" y2="${H - pad}"/></svg>`;
    if (useLog) s += '<p class="muted">數值差距大，長條高度用對數比例。</p>';
    return s;
  }

  // ---------- 歷史 ----------
  const METRICS = [
    ['healthRaw', '原始健康度（%）', 1], ['healthNominal', '標稱健康度（%）', 1], ['healthSystem', '系統健康度（%）', 0],
    ['healthQmax', '化學容量健康度（%）', 1], ['cycle', '循環次數', 0], ['rawMax', '原始最大容量（mAh）', 0],
    ['nominal', '標稱滿充容量（mAh）', 0], ['qmax', '化學容量 Qmax（mAh）', 0], ['tempAvg', '平均溫度（°C）', 0],
    ['tempMax', '最高溫度（°C，推定）', 1], ['weightedRa', '加權內阻（原始值）', 0], ['screenOnH', '螢幕亮時間（小時）', 1],
    ['chargingH', '充電時間（小時）', 1], ['opHours', '累計運轉（小時，推定）', 0],
  ];
  function initHistoryUi() {
    $('metric').innerHTML = METRICS.map(m => `<option value="${m[0]}">${esc(m[1])}</option>`).join('');
    $('metric').addEventListener('change', () => renderHistory(loadHistory()));
    $('cmpA').addEventListener('change', () => renderCompare(loadHistory()));
    $('cmpB').addEventListener('change', () => renderCompare(loadHistory()));
    $('exportBtn').addEventListener('click', exportHistory);
    $('importFile').addEventListener('change', (e) => importHistory(e.target.files && e.target.files[0]));
    $('clearBtn').addEventListener('click', () => {
      if (!confirm('確定清除這支手機上的全部歷史紀錄？建議先匯出備份。')) return;
      saveHistory([]); renderHistory([]);
    });
  }
  function renderHistory(h) {
    const key = $('metric').value || METRICS[0][0], m = METRICS.find(x => x[0] === key) || METRICS[0];
    const pts = h.filter(x => typeof x[key] === 'number').map(x => ({ t: x.fileTime, v: x[key] }));
    $('trend').innerHTML = pts.length ? trendSvg(pts, m[2]) : '<p class="muted">還沒有紀錄。讀取分析資料檔後會自動加入；一次選多天的檔案可以馬上看到趨勢。</p>';
    const opts = h.map((x, i) => `<option value="${i}">${fmtDate(x.fileTime)}｜循環 ${fmt(x.cycle)}</option>`).join('');
    const a = $('cmpA'), b = $('cmpB');
    a.innerHTML = opts; b.innerHTML = opts;
    if (h.length) { a.value = String(0); b.value = String(h.length - 1); }
    renderCompare(h);
  }
  function trendSvg(pts, dec) {
    const W = 600, H = 220, L = 48, R = 12, T = 14, B = 34;
    const vs = pts.map(p => p.v); let lo = Math.min(...vs), hi = Math.max(...vs);
    if (lo === hi) { lo -= 1; hi += 1; }
    const pad = (hi - lo) * 0.1; lo -= pad; hi += pad;
    const x = i => pts.length === 1 ? (L + W - R) / 2 : L + i * (W - L - R) / (pts.length - 1);
    const y = v => T + (hi - v) / (hi - lo) * (H - T - B);
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="趨勢圖">`;
    for (let k = 0; k <= 4; k++) { const v = lo + (hi - lo) * k / 4, yy = y(v); s += `<line class="chart-axis" x1="${L}" y1="${yy}" x2="${W - R}" y2="${yy}"/><text class="chart-text" x="${L - 6}" y="${yy + 4}" text-anchor="end">${fmt(v, dec)}</text>`; }
    if (pts.length > 1) s += `<polyline fill="none" stroke="var(--accent)" stroke-width="2.5" points="${pts.map((p, i) => `${x(i)},${y(p.v)}`).join(' ')}"/>`;
    const step = Math.max(1, Math.ceil(pts.length / 6));
    pts.forEach((p, i) => {
      s += `<circle cx="${x(i)}" cy="${y(p.v)}" r="4" fill="var(--accent)"><title>${fmtDate(p.t)}：${fmt(p.v, dec)}</title></circle>`;
      if (i % step === 0 || i === pts.length - 1) s += `<text class="chart-text" x="${x(i)}" y="${H - 12}" text-anchor="middle">${fmtDate(p.t).slice(5)}</text>`;
    });
    return s + '</svg>';
  }
  function renderCompare(h) {
    const A = h[Number($('cmpA').value)], B = h[Number($('cmpB').value)];
    if (!A || !B || h.length < 2) { $('cmpTable').innerHTML = h.length === 1 ? '<tr><td class="muted">再讀一份不同日期的檔案就能比較。</td></tr>' : ''; return; }
    $('cmpTable').innerHTML = `<tr><th>項目</th><th class="n">${fmtDate(A.fileTime)}</th><th class="n">${fmtDate(B.fileTime)}</th><th class="n">變化</th></tr>` +
      METRICS.map(m => { const a = A[m[0]], b = B[m[0]]; const dlt = (typeof a === 'number' && typeof b === 'number') ? b - a : null;
        return `<tr><td>${esc(m[1])}</td><td class="n">${fmt(a, m[2])}</td><td class="n">${fmt(b, m[2])}</td><td class="n">${dlt === null ? '—' : (dlt > 0 ? '+' : '') + fmt(dlt, m[2])}</td></tr>`; }).join('');
  }
  function exportHistory() {
    const h = loadHistory();
    const blob = new Blob([JSON.stringify({ app: 'battery-health-plus', version: APP_VERSION, exportedAt: new Date().toISOString(), history: h }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `battery_history_${fmtDate(new Date())}.json`; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  async function importHistory(f) {
    const box = $('historyMsg'); box.innerHTML = '';
    if (!f) return;
    const { text } = await readFile(f);
    let data; try { data = JSON.parse(text); } catch (e) { msg(box, 'err', '不是有效的紀錄檔'); return; }
    const list = Array.isArray(data) ? data : (data && Array.isArray(data.history) ? data.history : null);
    if (!list) { msg(box, 'err', '檔案裡沒有紀錄'); return; }
    let h = loadHistory(), n = 0;
    for (const s of list) { if (s && typeof s.key === 'string') { h = P.mergeHistory(h, s); n++; } }
    saveHistory(h); renderHistory(h); msg(box, 'ok', `已匯入 ${n} 筆（同一份檔案的紀錄會合併，不重複）。`);
    $('importFile').value = '';
  }

  // ---------- 啟動 ----------
  $('ver').textContent = 'v' + APP_VERSION + '（解析器 v' + P.PARSER_VERSION + '）';
  initModels(); initHistoryUi(); renderHistory(loadHistory());
  $('file').addEventListener('change', (e) => onFiles(Array.from(e.target.files || [])));
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  window.__bhp = { render: (t) => { const p = P.parse(t); if (p.ok) { current = p; render(p); } return p; } }; // 測試用
})();
