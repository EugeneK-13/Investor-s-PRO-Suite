// sw.js — InvCalc Pro Suite v1.5
// ─────────────────────────────────────────────────────────────────
// HOW TO UPDATE: bump CACHE_NAME here AND APP_VERSION in invpro.html
// to the same value on every deploy. Old caches auto-delete.
// GitHub Pages base: /Investor-s-PRO-Suite/
// ─────────────────────────────────────────────────────────────────

const CACHE_NAME = 'invcalc-v1.5';
const BASE = '/Investor-s-PRO-Suite/';

const PRECACHE_ASSETS = [
  BASE + 'invpro.html',
  BASE + 'manifest.json',
  BASE + 'icons/icon-192.png',
  BASE + 'icons/icon-512.png',
  BASE + 'icons/apple-touch-icon.png',
  BASE + 'icons/favicon-32.png',
  BASE + 'icons/favicon-16.png',
];

// ── INSTALL ───────────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache =>
        Promise.allSettled(
          PRECACHE_ASSETS.map(url =>
            fetch(url)
              .then(res => { if (res.ok) return cache.put(url, res); })
              .catch(() => {})
          )
        )
      )
      .then(() => self.skipWaiting())
  );
});

// ── ACTIVATE ──────────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(names => {
        const old = names.filter(n => n !== CACHE_NAME);
        if (old.length) console.log('[SW] Removing old caches:', old);
        return Promise.all(old.map(n => caches.delete(n)));
      })
      .then(() => self.clients.claim())
  );
});

// ── MESSAGE ───────────────────────────────────────────────────────
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ── FETCH ─────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // ① Finnhub API — NEVER cache. Financial data must always be live.
  if (url.hostname === 'finnhub.io') {
    event.respondWith(fetch(request));
    return;
  }

  // ② Google Fonts / CDN (Chart.js, jsPDF, SheetJS) — cache-first.
  if (
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com')    ||
    url.hostname.includes('cdnjs.cloudflare.com') ||
    url.hostname.includes('cdn.jsdelivr.net')
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache =>
        cache.match(request).then(cached => {
          if (cached) return cached;
          return fetch(request).then(res => {
            if (res.ok) cache.put(request, res.clone());
            return res;
          }).catch(() => cached);
        })
      )
    );
    return;
  }

  // ③ Main app (invpro.html) — NETWORK-FIRST.
  if (url.pathname === BASE + 'invpro.html' || url.pathname === BASE) {
    event.respondWith(
      fetch(request)
        .then(res => {
          if (res.ok) {
            caches.open(CACHE_NAME)
              .then(cache => cache.put(BASE + 'invpro.html', res.clone()));
          }
          return res;
        })
        .catch(() =>
          caches.match(BASE + 'invpro.html')
            .then(c => c || caches.match(BASE))
        )
    );
    return;
  }

  // ④ Everything else (manifest.json, favicon, etc.) — cache-first.
  event.respondWith(
    caches.match(request)
      .then(cached => cached || fetch(request))
  );
});
