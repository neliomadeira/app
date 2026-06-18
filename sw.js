// Service Worker — Juventude Sport Campinense
const CACHE_NAME = 'jsc-v2';
const PRECACHE = [
  '/',
  '/index.html',
  '/noticias.html',
  '/resultados.html',
  '/historia.html',
  '/formacao.html',
  '/equipa-principal.html',
  '/inscricao.html',
  '/modalidade.html',
  '/agenda.html',
  '/css/styles.css',
  '/css/resultados.css',
  '/js/site-config.js',
  '/js/security.js',
  '/js/noticias.js',
  '/js/resultados.js',
  '/js/historia.js',
  '/js/agenda.js',
  '/js/pwa.js',
  '/images/logo.svg',
  '/manifest.json',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Never intercept admin routes or non-GET requests
  if (url.pathname.startsWith('/admin') || e.request.method !== 'GET') return;

  // Network-first for HTML pages so content stays fresh
  if (e.request.destination === 'document') {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Cache-first for static assets (CSS, JS, images, fonts)
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res && res.status === 200 && res.type !== 'opaque') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return res;
      });
    })
  );
});
