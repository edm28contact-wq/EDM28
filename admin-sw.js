const CACHE_NAME = 'edm28-admin-shell-v3';
const OFFLINE_URL = '/admin-offline.html';
const SHELL_ASSETS = [
  OFFLINE_URL,
  '/admin.css?v=4',
  '/admin-install.js?v=2',
  '/admin-manifest.webmanifest',
  '/api/admin?icon=192',
  '/api/admin?icon=512'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request) {
  try {
    const response = await fetch(request, { cache: 'no-store' });
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw error;
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate' && url.pathname.startsWith('/admin')) {
    event.respondWith(
      fetch(request, { cache: 'no-store' }).catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  const isAdminIcon = url.pathname === '/api/admin' && ['192', '512'].includes(url.searchParams.get('icon'));
  if (url.pathname.startsWith('/api/') && !isAdminIcon) return;

  const isStaticAsset = url.pathname.endsWith('.js')
    || url.pathname.endsWith('.css')
    || url.pathname.endsWith('.webmanifest')
    || isAdminIcon
    || url.pathname === OFFLINE_URL;

  if (isStaticAsset) event.respondWith(networkFirst(request));
});