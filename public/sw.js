'use strict';
// Minimaler Service Worker fürs "Zum Home-Bildschirm hinzufügen" auf iOS/
// Android (PWA) — Ziel ist NICHT, die App offline voll nutzbar zu machen
// (die Daten kommen live vom Server), sondern: App-Shell schnell laden und
// bei fehlender Verbindung wenigstens eine Meldung statt einer leeren Seite
// zeigen. App-Code (HTML/JS/CSS) wird bewusst network-first geladen, damit
// niemand nach einem Deploy auf einer veralteten gecachten Version hängen
// bleibt — nur die (unveränderlichen) Icons sind cache-first.
const SHELL_CACHE = 'lst-shell-v1';
const SHELL_FILES = ['/', '/index.html', '/app.css', '/app.js', '/manifest.json'];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(SHELL_CACHE).then(cache => cache.addAll(SHELL_FILES).catch(() => {}))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== SHELL_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.pathname.startsWith('/api/')) return; // Live-Daten nie aus dem Cache bedienen

  if (url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(res => {
        const copy = res.clone();
        caches.open(SHELL_CACHE).then(c => c.put(req, copy));
        return res;
      }))
    );
    return;
  }

  event.respondWith(
    fetch(req).then(res => {
      const copy = res.clone();
      caches.open(SHELL_CACHE).then(c => c.put(req, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match(req).then(cached => cached || caches.match('/index.html')))
  );
});
