// sw.js — InvCalc Pro Suite v1.5
// GitHub Pages: https://eugenek-13.github.io/Investor-s-PRO-Suite/
// HOW TO UPDATE: bump CACHE_NAME here AND APP_VERSION in index.html together.

const CACHE_NAME = 'invcalc-v1.5';
const BASE = '/Investor-s-PRO-Suite/';

const PRECACHE_ASSETS = [
  BASE + 'index.html',
  BASE + 'manifest.json',
  BASE + 'icon-192.png',
  BASE + 'icon-512.png',
  BASE + 'apple-touch-icon.png',
  BASE + 'favicon-32.png',
  BASE + 'favicon-16.png',
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
      .then(names => Promise.all(
        names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

// ── MESSAGE ───────────────────────────────────────────────────────
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

// ── FETCH ─────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // ① Finnhub — never cache
  if (url.hostname === 'finnhub.io') {
    event.respondWith(fetch(event.request));
    return;
  }

  // ② CDN (Chart.js, jsPDF, SheetJS, Google Fonts) — cache-first
  if (
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com') ||
    url.hostname.includes('cdnjs.cloudflare.com') ||
    url.hostname.includes('cdn.jsdelivr.net')
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache =>
        cache.match(event.request).then(cached => {
          if (cached) return cached;
          return fetch(event.request).then(res => {
            if (res.ok) cache.put(event.request, res.clone());
            return res;
          });
        })
      )
    );
    return;
  }

  // ③ Main app (index.html) — network-first, cache fallback
  if (url.pathname === BASE + 'index.html' || url.pathname === BASE) {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          if (res.ok) {
            caches.open(CACHE_NAME)
              .then(cache => cache.put(BASE + 'index.html', res.clone()));
          }
          return res;
        })
        .catch(() => caches.match(BASE + 'index.html'))
    );
    return;
  }

  // ④ Everything else — cache-first
  event.respondWith(
    caches.match(event.request)
      .then(cached => cached || fetch(event.request))
  );
});
