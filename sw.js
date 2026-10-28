/*
 * 聲明：本專案的程式碼與文件全部由 AI（Anthropic 的 Claude）產生，內容依據公開的網路資料（Apple 文件、TI 電量計資料、各地論壇與拆解資料等）整理。
 * 專案擁有者不主張任何著作權，以公有領域方式釋出（CC0 1.0：https://creativecommons.org/publicdomain/zero/1.0/），任何人可自由使用、修改、散布。
 * 非 Apple 官方工具；數值僅供參考，不提供任何保證。
 */
/* 離線快取：先用快取，背景更新；改版時調整 CACHE 名稱 */
const CACHE = 'bhp-v1.3.4';
const FILES = ['./', 'index.html', 'parser.js', 'models.js', 'fields.js', 'app.js', 'manifest.webmanifest',
  'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-512-maskable.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then(hit => {
    const net = fetch(e.request).then(r => { if (r && r.ok) { const cp = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); } return r; }).catch(() => hit);
    return hit || net;
  }));
});
