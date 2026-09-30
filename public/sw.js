// Service worker mínimo: solo acelera la carga cacheando el "cascarón" de la
// app (JS/CSS estáticos de Next e íconos). Nunca cachea /api/* ni páginas
// (siempre se piden en vivo) — ningún dato clínico queda guardado en el
// dispositivo.

const CACHE = 'portal-shell-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const cacheable = url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/pwa-icon');
  if (!cacheable) return; // deja pasar /api/*, páginas y todo lo demás sin cachear

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
  );
});
