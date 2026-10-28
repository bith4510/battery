/* 電池健康度 Plus 網頁版 — 畫面邏輯 */
(function () {
  'use strict';
  const APP_VERSION = '1.3.2';
  const NO_BATTERY_LIST_MAX = 5;   // 合併訊息最多列出幾個檔名
  const P = window.BatteryParser, M = window.BatteryModels, FD = window.BatteryFields;
  const LS_MODEL = 'bhp_model_v1', LS_CUSTOM = 'bhp_custom_design_v1', LS_HISTORY = 'bhp_history_v1';
  const $ = (id) => document.getElementById(id);
  const MAX_FILE_BYTES = 50 * 1024 * 1024; // 分析資料檔實測約 2 MB；超過 50 MB 視為選錯檔，不讀進記憶體

  // ---------- 本機儲存（Safari 私密瀏覽等情況可能丟例外，一律包起來）----------
  function lsGet(k, def) { try { const v = localStorage.getItem(k); return v === null ? def : v; } catch (e) { return def; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  // 電腦版（PyQt 視窗）會在頁面載入前放入 window.BHP_HOST：歷史以電腦上的 JSON 檔為主，瀏覽器儲存只是附帶
  const HOST = (typeof window !== 'undefined' && window.BHP_HOST) ? window.BHP_HOST : null;
  let hostHistory = (HOST && Array.isArray(HOST.initialHistory)) ? HOST.initialHistory.slice() : null;
  function loadHistory() {
    if (hostHistory) return hostHistory.slice();
    try { const a = JSON.parse(lsGet(LS_HISTORY, '[]')); return Array.isArray(a) ? a : []; } catch (e) { return []; }
  }
  // 瀏覽器儲存約 5 MB（且與同網域其他工具共用）：只有最近 RAW_KEEP 筆保留完整原始欄位，
  // 更早的只留關鍵數值（完整原始資料仍在 iCloud 的分析檔）。一筆含原始欄位約 2.6 KB、不含約 0.8 KB。
  const RAW_KEEP = 300, RAW_KEEP_TIGHT = 50;
  function compactForStorage(h, keep) {
    if (h.length <= keep) return h;
    const cut = h.length - keep;
    return h.map((x, i) => {
      if (i >= cut || !x || !x.raw) return x;
      const y = Object.assign({}, x); delete y.raw; return y;
    });
  }
  function storeLocal(h) {
    // 依時間排序後保留最新的原始欄位；空間不足時再縮到 RAW_KEEP_TIGHT 筆重試
    return lsSet(LS_HISTORY, JSON.stringify(compactForStorage(h, RAW_KEEP)))
      || lsSet(LS_HISTORY, JSON.stringify(compactForStorage(h, RAW_KEEP_TIGHT)));
  }
  function saveHistory(h) {
    if (HOST && typeof HOST.saveHistory === 'function') {
      hostHistory = h.slice();          // 電腦版：完整保存在電腦的 history.json，不刪原始欄位
      storeLocal(h);
      try { HOST.saveHistory(JSON.stringify(h)); return true; } catch (e) { return false; }
    }
    return storeLocal(h);
  }

  // ---------- 格式化 ----------
  function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function fmt(v, d) { if (v === null || v === undefined || (typeof v === 'number' && !isFinite(v))) return '—'; return typeof v === 'number' ? v.toLocaleString('zh-TW', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }) : esc(String(v)); }
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
    // 依系列分組（optgroup），選項文字縮短以免手機上被截斷
    const groups = [];
    for (const m of M.MODELS) { let g = groups.find(x => x.name === m.group); if (!g) { g = { name: m.group, items: [] }; groups.push(g); } g.items.push(m); }
    const short = (n) => n.replace('iPhone ', '').replace('（實體 SIM 卡槽）', '・實體 SIM').replace('（僅 eSIM）', '・eSIM');
    sel.innerHTML = groups.map(g => `<optgroup label="${esc(g.name)}">` + g.items.map(m => `<option value="${m.id}">${esc(short(m.name))}・${m.design} mAh</option>`).join('') + '</optgroup>').join('') +
      '<optgroup label="其他"><option value="custom">自訂設計容量</option></optgroup>';
    sel.value = lsGet(LS_MODEL, M.DEFAULT_ID);
    if (!sel.value) sel.value = M.DEFAULT_ID;
    $('customDesign').value = lsGet(LS_CUSTOM, '');
    const showSource = () => {
      const m = M.find(sel.value);
      const conf = m ? (m.conf === 'high' ? '可信度高' : '可信度中') : '';
      $('modelSource').textContent = '分析資料檔不含型號與設計容量，健康度百分比依這裡選的容量計算。' + M.SOURCE + '。' +
        (m ? `\n${m.name}：${m.design} mAh${m.wh ? '／' + m.wh + ' Wh' : ''}（${conf}；來源：${m.src}）${m.note ? '。' + m.note : ''}` : '');
    };
    sel.addEventListener('change', showSource);
    showSource();
    const sync = () => {
      $('customDesign').classList.toggle('hidden', sel.value !== 'custom');
      lsSet(LS_MODEL, sel.value);
      lsSet(LS_CUSTOM, $('customDesign').value);
      if (current) render(current);
      renderHistory(loadHistory());
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
  // 讀取失敗時的診斷：只列字數、行數、檔頭與紀錄名稱，不列任何數值或識別碼
  function diagnose(text) {
    const t = String(text || '');
    const lines = t.split(/\r?\n/).filter(l => l.trim());
    const first = (lines[0] || '').slice(0, 40).replace(/[^\x20-\x7e]/g, '?');
    const names = new Set(); const re = /"name"\s*:\s*"([A-Za-z0-9_]{1,80})"/g; let m;
    while ((m = re.exec(t)) && names.size < 2000) names.add(m[1]);
    const bat = [...names].filter(n => /battery/i.test(n));
    return `${t.length.toLocaleString()} 字元、${lines.length} 行；第一行開頭「${first}」；紀錄名稱 ${names.size} 種，含 Battery 的 ${bat.length} 種` +
      (bat.length ? `：${bat.slice(0, 12).join('、')}` : '') + '。';
  }
  // 共用的讀入流程：檔案選取、捷徑傳入、剪貼簿、封存檔重新匯入都走這裡
  // items：[{ name, text }]；回傳成功筆數
  function ingest(items, box, results) {
    let history = loadHistory(), latest = null, okCount = 0;
    const report = (name, ok, error) => { if (results) results.push({ name, ok, error: error || '' }); };
    // 沒有電池紀錄的檔案（session 小檔、當天最新的檔）一次讀很多時會洗版：先收集，最後合併成一則
    const noBat = [];
    for (const it of items) {
      if (it.text === null) { msg(box, 'err', `${it.name}：讀取失敗`); report(it.name, false, '讀取失敗'); continue; }
      const parsed = P.parse(it.text);
      if (!parsed.ok && parsed.noBattery) { noBat.push({ name: it.name, error: parsed.error, text: it.text, warnings: parsed.warnings }); report(it.name, false, parsed.error); continue; }
      parsed.warnings.forEach(w => msg(box, 'warn', `${it.name}：${w}`));
      if (!parsed.ok) { msg(box, 'err', `${it.name}：${parsed.error}`); msg(box, 'warn', '診斷（不含個人資料）：' + diagnose(it.text)); report(it.name, false, parsed.error); continue; }
      okCount++; report(it.name, true, '');
      history = P.mergeHistory(history, P.snapshot(parsed, designCapacity()));
      // 用時間戳數值比較；沒有時間的檔案排最舊（v1.0 用字串比較，會把星期名稱拿來比，選錯檔）
      const tNew = parsed.meta.fileTime ? parsed.meta.fileTime.getTime() : -Infinity;
      const tOld = latest && latest.meta.fileTime ? latest.meta.fileTime.getTime() : -Infinity;
      if (!latest || tNew > tOld) latest = parsed;
    }
    if (noBat.length === 1) {
      noBat[0].warnings.forEach(w => msg(box, 'warn', `${noBat[0].name}：${w}`));
      msg(box, 'err', `${noBat[0].name}：${noBat[0].error}`); msg(box, 'warn', '診斷（不含個人資料）：' + diagnose(noBat[0].text));
    } else if (noBat.length > 1) {
      const shown = noBat.slice(0, NO_BATTERY_LIST_MAX).map(x => x.name).join('、');
      msg(box, 'warn', `另有 ${noBat.length} 份沒有電池紀錄，已略過（多半是檔名含 session 的小檔，或當天最新、還沒收集到的檔）：${shown}` +
        (noBat.length > NO_BATTERY_LIST_MAX ? ` 等` : '') + '。');
    }
    if (okCount) {
      if (!saveHistory(history)) msg(box, 'warn', '這個瀏覽器無法儲存紀錄（可能是私密瀏覽），趨勢圖只在這次有效。');
      msg(box, 'ok', `已讀取 ${okCount} 份，歷史共 ${history.length} 筆，顯示最新一份（${fmtDateTime(latest.meta.fileTime)}）。`);
      current = latest; render(current); renderHistory(history);
    }
    return okCount;
  }
  async function onFiles(files) {
    const box = $('messages'); box.innerHTML = '';
    if (!files || !files.length) return;
    const items = [];
    for (const f of files) {
      if (f.size > MAX_FILE_BYTES) { msg(box, 'err', `${f.name}：檔案太大（${fmt(f.size / 1048576, 0)} MB），分析資料檔通常只有幾 MB，可能選錯檔案。`); continue; }
      items.push(await readFile(f));
    }
    ingest(items, box);
    $('file').value = '';
  }

  // 捷徑傳入：網址 #d=<Base64>（可能再經過 URL 編碼）。# 後面的內容不會送到伺服器。
  function decodeShortcutPayload(raw) {
    let t = raw;
    try { t = decodeURIComponent(t); } catch (e) { /* 沒有 URL 編碼就用原字串 */ }
    t = t.replace(/ /g, '+').replace(/\s+/g, '');
    const bin = atob(t);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder('utf-8').decode(bytes);
  }
  function handleHash() {
    const h = location.hash || '';
    const box = $('messages');
    if (h.startsWith('#d=')) {
      box.innerHTML = '';
      let text = null;
      try { text = decodeShortcutPayload(h.slice(3)); } catch (e) { msg(box, 'err', '捷徑傳來的資料無法解碼（Base64 格式錯誤），請改用「選擇檔案」。'); }
      // 讀完立刻把資料從網址移除，避免留在瀏覽紀錄
      try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { location.hash = ''; }
      if (text !== null) ingest([{ name: '捷徑傳入', text }], box);
    } else if (h === '#paste') {
      $('pasteRow').classList.remove('hidden');
      try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* 忽略 */ }
    }
  }
  async function pasteFromClipboard() {
    const box = $('messages'); box.innerHTML = '';
    let text = '';
    try { text = await navigator.clipboard.readText(); } catch (e) { msg(box, 'err', '無法讀取剪貼簿（瀏覽器未允許）。請改用「選擇檔案」。'); return; }
    if (text.length > MAX_FILE_BYTES) { msg(box, 'err', '剪貼簿內容太大。'); return; }
    if (ingest([{ name: '剪貼簿', text }], box)) $('pasteRow').classList.add('hidden');
  }

  // ---------- 報告 ----------
  function render(p) {
    const b = p.battery, d = P.derive(p, designCapacity()), u = P.summarizeUsage(p);
    $('report').classList.remove('hidden');

    // 健康度
    const hs = (label, v, sub) => stat(label, `<span style="color:${healthColor(v)}">${fmt(v, 1)}${v === null ? '' : '%'}</span>`, sub);
    $('healthStats').innerHTML =
      hs('系統顯示', d.healthSystem, '分析檔 MaximumCapacityPercent') +
      hs('滿充容量 FCC', d.healthRaw, `${fmt(b.AppleRawMaxCapacity)} ÷ ${fmt(d.design)} mAh（coconutBattery 算法）`) +
      hs('標稱容量', d.healthNominal, `${fmt(b.NominalChargeCapacity)} ÷ ${fmt(d.design)} mAh`) +
      hs('化學容量 Qmax', d.healthQmax, `${fmt(b.QmaxCell0)} ÷ ${fmt(d.design)} mAh`);
    // 一致性檢查：標稱容量 ÷ 設計容量 四捨五入後，應等於系統顯示的健康度；不等時提示型號或設計容量可能選錯
    let check = '';
    if (d.design && d.healthNominal !== null && d.healthSystem !== null) {
      const r = Math.round(d.healthNominal);
      check = r === d.healthSystem ? `一致性檢查：標稱容量 ÷ 設計容量 = ${fmt(d.healthNominal, 2)}%，四捨五入 ${r}%，與系統顯示相同。`
        : `一致性檢查：標稱容量 ÷ 設計容量 = ${fmt(d.healthNominal, 2)}%，四捨五入 ${r}%，與系統顯示 ${d.healthSystem}% 不同，請確認型號（實體 SIM／eSIM）是否選對。`;
    }
    $('healthNote').textContent = d.design ? `設計容量 ${fmt(d.design)} mAh。設計容量是廠商標示的額定值（IEC 61960 的額定容量是保證下限），新電池實際容量常略高，所以超過 100% 屬正常；百分比只代表與額定值的比例。${check}` : '尚未設定設計容量，百分比無法計算。';
    const capMax = Math.max(d.design || 0, b.MaximumQmax || 0, b.MaximumFCC || 0, 1);
    const bar = (label, v, color) => `<div class="bar"><span>${esc(label)}</span><div class="track"><div class="fill" style="width:${v ? Math.min(100, v / capMax * 100) : 0}%;background:${color}"></div></div><span class="n" style="text-align:right">${fmt(v)} mAh</span></div>`;
    $('capBars').innerHTML = bar('設計容量', d.design, 'var(--bar4)') + bar('化學容量', b.QmaxCell0, 'var(--bar3)') + bar('滿充 FCC', b.AppleRawMaxCapacity, 'var(--bar1)') + bar('標稱容量', b.NominalChargeCapacity, 'var(--bar2)');

    // 循環
    $('cycleStats').innerHTML =
      stat('循環次數', fmt(b.CycleCount), `上次更新 Qmax 時：${fmt(b.CycleCountLastQmax)}`) +
      stat('首次使用', fmtDate(d.firstUse), d.daysSinceFirstUse !== null ? `已使用 ${fmt(d.daysSinceFirstUse, 0)} 天` : '') +
      stat('平均每天循環', fmt(d.cyclesPerDay, 2), d.cyclesPerDay !== null ? `約每 ${fmt(1 / d.cyclesPerDay, 1)} 天一次` : '') +
      stat('累計運轉', d.operatingHours !== null ? fmt(d.operatingHours) + ' h' : '—', d.operatingRatio !== null ? `佔使用期間 ${fmt(d.operatingRatio * 100, 0)}%` + tag('guess') : '單位推定為小時' + tag('guess'));
    const mdl = M.find($('model').value);
    $('cycleNote').innerHTML = (mdl && mdl.ratedCycles)
      ? esc(`Apple 官方設計目標：${mdl.name.replace(/（.*）/, '')} 在 ${mdl.ratedCycles} 次完整充電循環時仍保有 80% 原始容量（理想條件）。目前 ${fmt(b.CycleCount)} 次，為目標的 ${fmt(b.CycleCount / mdl.ratedCycles * 100, 1)}%。`)
      : esc('Apple 官方頁面只列出 iPhone 14 與更早（500 次）、iPhone 15 系列（1000 次）的循環目標；此型號未列出，不自行假設。');

    // 容量表
    const capRows = [
      ['設計容量（依型號）', d.design, '', 'known'],
      ['滿充容量 FCC', b.AppleRawMaxCapacity, 'AppleRawMaxCapacity', 'known'],
      ['標稱容量（系統健康度依此計算）', b.NominalChargeCapacity, 'NominalChargeCapacity', 'known'],
      ['標稱滿充容量 最大／最小', `${fmt(b.NCCMax)}／${fmt(b.NCCMin)}`, 'NCCMax／NCCMin', 'known'],
      ['滿充容量 FCC 最大／最小', `${fmt(b.MaximumFCC)}／${fmt(b.MinimumFCC)}`, `差 ${fmt(d.fccSpread)} mAh`, 'known'],
      ['化學容量 Qmax（電芯 0）', b.QmaxCell0, 'QmaxCell0', 'known'],
      ['化學容量 Qmax 最大／最小', `${fmt(b.MaximumQmax)}／${fmt(b.MinimumQmax)}`, 'MaximumQmax／MinimumQmax', 'known'],
      ['FCC 與設計容量相差', d.lostRawMah, '正數＝少於設計值、負數＝多於設計值', 'known'],
    ];
    $('capTable').innerHTML = '<tr><th>項目</th><th class="n">mAh</th></tr>' + capRows.map(r => row2(r[0], typeof r[1] === 'string' ? r[1] : fmt(r[1]), esc(r[2]), tag(r[3]))).join('');

    // 溫度
    $('tempStats').innerHTML =
      stat('平均', d.tempAvgC !== null ? fmt(d.tempAvgC, 0) + ' °C' : '—', `原始 ${fmt(b.AverageTemperature)}` + tag('guess')) +
      stat('歷史最高', d.tempMaxC !== null ? fmt(d.tempMaxC, 1) + ' °C' : '—', `原始 ${fmt(b.MaximumTemperature)}` + tag('guess')) +
      stat('歷史最低', d.tempMinC !== null ? fmt(d.tempMinC, 1) + ' °C' : '—', `原始 ${fmt(b.MinimumTemperature)}` + tag('guess')) +
      stat('歷史溫度範圍', (d.tempMaxC !== null && d.tempMinC !== null) ? fmt(d.tempMaxC - d.tempMinC, 1) + ' °C' : '—', `取樣次數 ${fmt(b.TemperatureSamples)}`);

    // 電壓電流
    $('elecStats').innerHTML =
      stat('電壓 最高', d.voltMaxV !== null ? fmt(d.voltMaxV, 3) + ' V' : '—', 'MaximumPackVoltage') +
      stat('電壓 最低', d.voltMinV !== null ? fmt(d.voltMinV, 3) + ' V' : '—', 'MinimumPackVoltage') +
      stat('充電電流 最大', d.chargeCurrentMaxA !== null ? fmt(d.chargeCurrentMaxA, 2) + ' A' : '—', d.chargeCRate !== null ? `${fmt(d.chargeCRate, 2)} C（電流 ÷ 設計容量）` : 'MaximumChargeCurrent') +
      stat('放電電流 最大', d.dischargeCurrentMaxA !== null ? fmt(d.dischargeCurrentMaxA, 2) + ' A' : '—', d.dischargeCRate !== null ? `${fmt(d.dischargeCRate, 2)} C（電流 ÷ 設計容量）` : 'MaximumDischargeCurrent');

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
      ['未接電時消耗能量', u.totalSec ? fmt(u.energyUnplugged) : '—', '原始值，Apple 未公開單位，只適合跟自己其他天比較'],
      ['其中螢幕亮時', u.totalSec ? fmt(u.energyScreenOnUnplugged) : '—', '原始值，Apple 未公開單位'],
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
  // [欄位, 名稱, 小數位, 單位（斜率顯示用）]
  const METRICS = [
    ['healthNominal', '標稱容量健康度（%，系統健康度依此計算）', 2, '%'],
    ['healthRaw', 'FCC 健康度（%）', 2, '%'], ['healthQmax', '化學容量健康度（%）', 2, '%'],
    ['healthSystem', '系統健康度（%，整數）', 0, '%'], ['nominal', '標稱容量（mAh）', 0, 'mAh'],
    ['rawMax', '滿充容量 FCC（mAh）', 0, 'mAh'], ['qmax', '化學容量 Qmax（mAh）', 0, 'mAh'],
    ['cycle', '循環次數', 0, '次'], ['weightedRa', '加權內阻 Ra（原始值）', 0, ''],
    ['tempAvg', '平均溫度（°C）', 0, '°C'], ['tempMax', '最高溫度（°C，推定）', 1, '°C'],
    ['voltMax', '最高電壓（V）', 3, 'V'], ['dailyMaxSoc', '當日最高電量（%）', 0, '%'], ['dailyMinSoc', '當日最低電量（%）', 0, '%'],
    ['screenOnH', '螢幕亮時間（小時）', 1, '小時'], ['chargingH', '充電時間（小時）', 1, '小時'],
    ['opHours', '累計運轉（小時，推定）', 0, '小時'],
  ];
  // 趨勢判讀門檻：資料太少或時間太短時，斜率主要反映雜訊，不顯示衰退率
  const TREND_MIN_POINTS = 5, TREND_MIN_DAYS = 30, TREND_MIN_CYCLES = 20;
  const DAY_MS = 86400000;

  function initHistoryUi() {
    $('metric').innerHTML = METRICS.map(m => `<option value="${m[0]}">${esc(m[1])}</option>`).join('');
    for (const id of ['metric', 'xAxis', 'maWin']) $(id).addEventListener('change', () => renderHistory(loadHistory()));
    $('cmpA').addEventListener('change', () => renderCompare(loadHistory()));
    $('cmpB').addEventListener('change', () => renderCompare(loadHistory()));
    $('exportJsonBtn').addEventListener('click', () => exportHistory('json'));
    $('exportCsvBtn').addEventListener('click', () => exportHistory('csv'));
    $('importFile').addEventListener('change', (e) => importHistory(Array.from(e.target.files || [])));
    $('pasteBtn').addEventListener('click', pasteFromClipboard);
    $('clearBtn').addEventListener('click', () => {
      if (!confirm('確定清除這台裝置上的全部歷史紀錄？建議先匯出備份。')) return;
      saveHistory([]); renderHistory([]);
    });
  }
  // 歷史快照的健康度用「目前選的設計容量」重算，換型號時趨勢與比較才一致
  function withDesign(h) {
    const d = designCapacity();
    if (!d) return h;
    const pct = v => (typeof v === 'number') ? v / d * 100 : null;
    return h.map(x => Object.assign({}, x, { design: d, healthRaw: pct(x.rawMax), healthNominal: pct(x.nominal), healthQmax: pct(x.qmax) }));
  }
  // 依目前設定取出 { x, y, t } 點；x＝距第一筆的天數或循環次數
  function seriesOf(h, key, axis) {
    const valid = h.filter(x => typeof x[key] === 'number' && x.fileTime && !isNaN(Date.parse(x.fileTime)));
    if (!valid.length) return [];
    const t0 = Date.parse(valid[0].fileTime);
    return valid.map(x => ({ t: x.fileTime, y: x[key], x: axis === 'cycle' ? x.cycle : (Date.parse(x.fileTime) - t0) / DAY_MS }))
      .filter(p => typeof p.x === 'number' && isFinite(p.x)).sort((a, b) => a.x - b.x);
  }
  function renderHistory(raw) {
    const h = withDesign(raw);
    const key = $('metric').value || METRICS[0][0], m = METRICS.find(x => x[0] === key) || METRICS[0];
    const axis = $('xAxis').value, win = Number($('maWin').value) || 0;
    const pts = seriesOf(h, key, axis);
    if (!pts.length) {
      $('trend').innerHTML = '<p class="muted">還沒有紀錄。讀取分析資料檔後會自動加入；一次選多天的檔案可以馬上看到趨勢。</p>';
      $('trendStats').innerHTML = '';
    } else {
      const reg = P.linearRegression(pts);
      const ma = win > 1 ? P.movingAverage(pts, win) : null;
      $('trend').innerHTML = trendSvg(pts, m[2], axis, reg, ma);
      $('trendStats').innerHTML = trendStatsHtml(h, key, m, pts);
    }
    const opts = h.map((x, i) => `<option value="${i}">${fmtDate(x.fileTime)}｜循環 ${fmt(x.cycle)}</option>`).join('');
    const a = $('cmpA'), b = $('cmpB');
    a.innerHTML = opts; b.innerHTML = opts;
    if (h.length) { a.value = String(Math.max(0, h.length - 2)); b.value = String(h.length - 1); }
    $('histCount').textContent = h.length;
    renderCompare(raw);
  }
  // 趨勢統計：分別對「天數」與「循環次數」做回歸，資料不足時只顯示原因、不給衰退率
  function trendStatsHtml(h, key, m, pts) {
    const byDay = seriesOf(h, key, 'date'), byCycle = seriesOf(h, key, 'cycle');
    const rd = P.linearRegression(byDay), rc = P.linearRegression(byCycle);
    const spanDays = rd ? rd.xMax - rd.xMin : 0, spanCycles = rc ? rc.xMax - rc.xMin : 0;
    const lines = [`資料 ${pts.length} 筆，時間跨度 ${fmt(spanDays, 0)} 天，循環跨度 ${fmt(spanCycles, 0)} 次。`];
    const reasons = [];
    if (pts.length < TREND_MIN_POINTS) reasons.push(`少於 ${TREND_MIN_POINTS} 筆`);
    if (spanDays < TREND_MIN_DAYS) reasons.push(`時間跨度不到 ${TREND_MIN_DAYS} 天`);
    if (reasons.length) {
      lines.push(`資料不足（${reasons.join('、')}），每日數值受溫度與使用方式影響起伏較大，現在算出的斜率主要是雜訊，暫不顯示衰退率。`);
    } else {
      const unit = m[3];
      if (rd) lines.push(`依日期回歸：每 30 天 ${rd.slope * 30 >= 0 ? '+' : ''}${fmt(rd.slope * 30, m[2] + 1)} ${unit}，R² = ${fmt(rd.r2, 2)}。`);
      if (rc && spanCycles >= TREND_MIN_CYCLES) lines.push(`依循環回歸：每 100 次循環 ${rc.slope * 100 >= 0 ? '+' : ''}${fmt(rc.slope * 100, m[2] + 1)} ${unit}，R² = ${fmt(rc.r2, 2)}。`);
      else if (rc) lines.push(`循環跨度不到 ${TREND_MIN_CYCLES} 次，不計算每 100 次循環的變化。`);
      const r2 = rd ? rd.r2 : 0;
      lines.push(r2 >= 0.7 ? 'R² ≥ 0.7：直線趨勢明確。' : r2 >= 0.4 ? 'R² 0.4～0.7：有趨勢但起伏不小，請搭配移動平均看。' : 'R² < 0.4：數值起伏大於趨勢，斜率參考價值低。');
    }
    lines.push('回歸為最小平方法直線；R² 越接近 1 表示越符合直線。不做未來外推。');
    return lines.map(l => `<div>${esc(l)}</div>`).join('');
  }
  function trendSvg(pts, dec, axis, reg, ma) {
    const W = 380, H = 220, L = 46, R = 12, T = 12, B = 40; // 寬度接近手機實際像素，文字才不會被縮太小
    const ys = pts.map(p => p.y).concat(ma ? ma.map(p => p.y) : [], reg ? [reg.intercept + reg.slope * pts[0].x, reg.intercept + reg.slope * pts[pts.length - 1].x] : []); // 回歸線端點也納入範圍，避免畫出框外
    let lo = Math.min(...ys), hi = Math.max(...ys);
    if (lo === hi) { lo -= 1; hi += 1; }
    const pad = (hi - lo) * 0.1; lo -= pad; hi += pad;
    let x0 = pts[0].x, x1 = pts[pts.length - 1].x;
    if (x0 === x1) { x0 -= 1; x1 += 1; }
    const X = v => L + (v - x0) / (x1 - x0) * (W - L - R);
    const Y = v => T + (hi - v) / (hi - lo) * (H - T - B);
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="趨勢圖">`;
    for (let k = 0; k <= 4; k++) { const v = lo + (hi - lo) * k / 4, yy = Y(v); s += `<line class="chart-axis" x1="${L}" y1="${yy}" x2="${W - R}" y2="${yy}"/><text class="chart-text" x="${L - 6}" y="${yy + 4}" text-anchor="end">${fmt(v, dec)}</text>`; }
    // 橫軸刻度：依實際數值等距，不是依筆數
    for (let k = 0; k <= 4; k++) {
      const v = x0 + (x1 - x0) * k / 4;
      const label = axis === 'cycle' ? fmt(v, 0) + ' 次' : fmtDate(Date.parse(pts[0].t) + (v - pts[0].x) * DAY_MS).slice(5);
      s += `<text class="chart-text" x="${X(v)}" y="${H - 22}" text-anchor="${k === 0 ? 'start' : k === 4 ? 'end' : 'middle'}">${label}</text>`;
    }
    s += `<text class="chart-text" x="${(L + W - R) / 2}" y="${H - 6}" text-anchor="middle">${axis === 'cycle' ? '循環次數' : '日期（依實際間隔）'}</text>`;
    if (reg) s += `<line x1="${X(x0)}" y1="${Y(reg.intercept + reg.slope * x0)}" x2="${X(x1)}" y2="${Y(reg.intercept + reg.slope * x1)}" stroke="var(--bar3)" stroke-width="2" stroke-dasharray="6 4"><title>回歸線</title></line>`;
    if (ma && ma.length > 1) s += `<polyline fill="none" stroke="var(--bar2)" stroke-width="2.5" points="${ma.map(p => `${X(p.x)},${Y(p.y)}`).join(' ')}"><title>移動平均</title></polyline>`;
    pts.forEach(p => { s += `<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="3.5" fill="var(--accent)"><title>${fmtDate(p.t)}：${fmt(p.y, dec)}</title></circle>`; });
    s += '</svg><div class="muted">● 每筆數值　<span style="color:var(--bar2)">━</span> 移動平均（本筆與前幾筆的平均，會落後實際變化）　<span style="color:var(--bar3)">┅</span> 回歸線</div>';
    return s;
  }
  function renderCompare(raw) {
    const h = withDesign(raw);
    const A = h[Number($('cmpA').value)], B = h[Number($('cmpB').value)], F = h[0];
    if (!A || !B || h.length < 2) { $('cmpTable').innerHTML = h.length === 1 ? '<tr><td class="muted">再讀一份不同日期的檔案就能比較。</td></tr>' : ''; return; }
    const diff = (x, y, d) => (typeof x === 'number' && typeof y === 'number') ? ((y - x) > 0 ? '+' : '') + fmt(y - x, d) : '—';
    $('cmpTable').innerHTML = `<tr><th>項目</th><th class="n">${fmtDate(A.fileTime)}</th><th class="n">${fmtDate(B.fileTime)}</th><th class="n">變化</th><th class="n">與第一筆比</th></tr>` +
      METRICS.map(m => `<tr><td>${esc(m[1])}</td><td class="n">${fmt(A[m[0]], m[2])}</td><td class="n">${fmt(B[m[0]], m[2])}</td><td class="n">${diff(A[m[0]], B[m[0]], m[2])}</td><td class="n">${diff(F[m[0]], B[m[0]], m[2])}</td></tr>`).join('');
  }

  // ---------- 匯出／匯入 ----------
  // JSON：完整紀錄（含原始電池欄位），可再匯入、可堆疊；CSV：給 Excel 看，UTF-8 含 BOM 避免中文亂碼
  const CSV_COLS = [
    ['fileTime', '分析檔時間'], ['osVersion', 'iOS'], ['design', '設計容量 mAh'], ['cycle', '循環次數'],
    ['healthSystem', '系統健康度 %'], ['nominal', '標稱容量 mAh'], ['rawMax', '滿充容量 FCC mAh'], ['qmax', '化學容量 Qmax mAh'],
    ['healthNominal', '標稱容量健康度 %'], ['healthRaw', 'FCC 健康度 %'], ['healthQmax', '化學容量健康度 %'],
    ['fccMax', 'FCC 終身最大 mAh'], ['fccMin', 'FCC 終身最小 mAh'], ['tempAvg', '平均溫度 °C'], ['tempMax', '最高溫度 °C（推定）'],
    ['tempMin', '最低溫度 °C（推定）'], ['voltMax', '最高電壓 V'], ['voltMin', '最低電壓 V'], ['weightedRa', '加權內阻 Ra（原始值）'],
    ['dailyMaxSoc', '當日最高電量 %'], ['dailyMinSoc', '當日最低電量 %'], ['screenOnH', '螢幕亮 小時'], ['chargingH', '充電 小時'],
    ['opHours', '累計運轉 小時（推定）'],
  ];
  function csvCell(v) {
    if (v === null || v === undefined) return '';
    let s = String(v);
    // 文字開頭是 = + - @ 時 Excel 會當公式執行，前面加 ' 防止（數字不處理，負數照常）
    if (typeof v !== 'number' && /^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function buildCsv(h) {
    return '﻿' + [CSV_COLS.map(c => csvCell(c[1])).join(',')]
      .concat(h.map(x => CSV_COLS.map(c => csvCell(x[c[0]])).join(','))).join('\r\n') + '\r\n';
  }
  async function exportHistory(kind) {
    const box = $('historyMsg'); box.innerHTML = '';
    const raw = loadHistory();
    if (!raw.length) { msg(box, 'warn', '沒有紀錄可以匯出。'); return; }
    const h = withDesign(raw);
    const stamp = fmtDate(new Date());
    const file = kind === 'csv'
      ? new File([buildCsv(h)], `battery_history_${stamp}.csv`, { type: 'text/csv' })
      : new File([JSON.stringify({ app: 'battery-health-plus', format: 1, version: APP_VERSION, exportedAt: new Date().toISOString(), history: raw }, null, 2)], `battery_history_${stamp}.json`, { type: 'application/json' });
    // iPhone 上優先用分享選單（可直接存到「檔案」），不支援時改用下載
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file] }); msg(box, 'ok', `已匯出 ${raw.length} 筆。`); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = file.name;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    msg(box, 'ok', `已匯出 ${raw.length} 筆。`);
  }
  // 匯入可多選；JSON 紀錄檔與分析資料檔（含捷徑存下的精簡檔）都能放進來，全部合併、同一份不重複
  async function importHistory(files) {
    const box = $('historyMsg'); box.innerHTML = '';
    if (!files.length) return;
    let h = loadHistory(), n = 0, before = h.length;
    const rawItems = [];
    for (const f of files) {
      if (f.size > MAX_FILE_BYTES) { msg(box, 'err', `${f.name}：檔案太大`); continue; }
      const { name, text } = await readFile(f);
      if (text === null) { msg(box, 'err', `${name}：讀取失敗`); continue; }
      let data = null; try { data = JSON.parse(text); } catch (e) { data = null; }
      const list = Array.isArray(data) ? data : (data && Array.isArray(data.history) ? data.history : null);
      if (list) { for (const s of list) { if (s && typeof s.key === 'string') { h = P.mergeHistory(h, s); n++; } } }
      else rawItems.push({ name, text });
    }
    if (n) { saveHistory(h); msg(box, 'ok', `JSON 紀錄讀入 ${n} 筆，歷史由 ${before} 筆變成 ${h.length} 筆（同一份檔案不重複）。`); }
    if (rawItems.length) ingest(rawItems, box);
    renderHistory(loadHistory());
    $('importFile').value = '';
  }

  // ---------- 啟動 ----------
  $('ver').textContent = 'v' + APP_VERSION + '（解析器 v' + P.PARSER_VERSION + '）';
  initModels(); initHistoryUi(); renderHistory(loadHistory());
  $('file').addEventListener('change', (e) => onFiles(Array.from(e.target.files || [])));
  handleHash();
  window.addEventListener('hashchange', handleHash);
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  window.__bhp = {
    render: (t) => { const p = P.parse(t); if (p.ok) { current = p; render(p); } return p; }, buildCsv, decodeShortcutPayload, // 測試用
    // 電腦版用：一次送入多份文字，回傳每份結果 [{ name, ok, error }]
    ingestTexts: (items) => { const box = $('messages'); box.innerHTML = ''; const results = []; ingest(items.map(x => ({ name: String(x.name), text: x.text === null ? null : String(x.text) })), box, results); return results; },
    historyCount: () => loadHistory().length,
  };
})();
