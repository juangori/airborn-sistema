const CACHE_NAME = 'stockmate-v1';
const OFFLINE_URL = '/offline.html';

// Archivos esenciales para cachear (shell de la app)
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/login.html',
  '/offline.html',
  '/app.js',
  '/manifest.json'
];

// Instalar: cachear archivos esenciales
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando Service Worker...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Cacheando archivos esenciales');
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activar: limpiar caches viejos
self.addEventListener('activate', (event) => {
  console.log('[SW] Activando Service Worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Borrando cache viejo:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// Estrategia de fetch: Network First con fallback a cache
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Solo manejar requests del mismo origen
  if (url.origin !== location.origin) return;

  // Para requests de API: Network Only (no cachear datos sensibles)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .catch(() => {
          // Si es un GET y falla, intentar devolver del cache
          if (request.method === 'GET') {
            return caches.match(request);
          }
          // Para POST/PUT/DELETE offline, guardar para sincronizar después
          return new Response(
            JSON.stringify({ error: 'Sin conexión. Los cambios se guardarán cuando vuelva internet.' }),
            { status: 503, headers: { 'Content-Type': 'application/json' } }
          );
        })
    );
    return;
  }

  // Para archivos estáticos: Cache First, luego Network
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          // Devolver del cache, pero actualizar en background
          event.waitUntil(
            fetch(request)
              .then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200) {
                  caches.open(CACHE_NAME)
                    .then((cache) => cache.put(request, networkResponse));
                }
              })
              .catch(() => {}) // Ignorar errores de red en background
          );
          return cachedResponse;
        }

        // No está en cache, buscar en red
        return fetch(request)
          .then((networkResponse) => {
            // Cachear la respuesta para futuro
            if (networkResponse && networkResponse.status === 200) {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME)
                .then((cache) => cache.put(request, responseToCache));
            }
            return networkResponse;
          })
          .catch(() => {
            // Offline y no en cache: mostrar página offline para navegación
            if (request.mode === 'navigate') {
              return caches.match(OFFLINE_URL);
            }
          });
      })
  );
});

// Escuchar mensajes del cliente
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});
