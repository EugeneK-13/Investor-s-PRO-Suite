// sw.js — InvCalc Pro Suite v1.4
// ─────────────────────────────────────────────────────────────────
// HOW TO UPDATE: bump CACHE_NAME here AND APP_VERSION in invpro.html
// to the same value on every deploy. Old caches auto-delete.
// ─────────────────────────────────────────────────────────────────

const CACHE_NAME = 'invcalc-v1.5';

// Only pre-cache local files — never external URLs in ASSETS
const PRECACHE_ASSETS = [
  '/invpro.html',
  '/manifest.json',
];

// ── INSTALL ───────────────────────────────────────────────────────
// Pre-cache assets individually so a missing manifest.json won't
// block the entire SW from installing. Then activate immediately.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache =>
        Promise.allSettled(
          PRECACHE_ASSETS.map(url =>
            fetch(url)
              .then(res => { if (res.ok) return cache.put(url, res); })
              .catch(() => {}) // ignore unreachable assets
          )
        )
      )
      .then(() => self.skipWaiting()) // activate immediately
  );
});

// ── ACTIVATE ──────────────────────────────────────────────────────
// Delete every cache that doesn't match the current CACHE_NAME.
// This removes ALL previous versions automatically.
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(names => {
        const old = names.filter(n => n !== CACHE_NAME);
        if (old.length) console.log('[SW] Removing old caches:', old);
        return Promise.all(old.map(n => caches.delete(n)));
      })
      .then(() => self.clients.claim()) // take control of all open pages
  );
});

// ── MESSAGE ───────────────────────────────────────────────────────
// invpro.html sends { type: 'SKIP_WAITING' } when it detects a new
// SW is waiting. This makes it activate without a tab close.
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
  //    These are versioned URLs that never change content.
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

  // ③ Main app (invpro.html or root /) — NETWORK-FIRST.
  //    Always try to get the latest version; cache only for offline.
  //    This prevents the old Russian-language version from appearing.
  if (url.pathname === '/invpro.html' || url.pathname === '/') {
    event.respondWith(
      fetch(request)
        .then(res => {
          if (res.ok) {
            // Store fresh copy so offline fallback is up to date
            caches.open(CACHE_NAME)
              .then(cache => cache.put('/invpro.html', res.clone()));
          }
          return res;
        })
        .catch(() =>
          caches.match('/invpro.html').then(c => c || caches.match('/'))
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
