/**
 * Quantum Institut Market Terminal — Service Worker
 * Versi: 1.4.0
 * Fungsi: Enable PWA install prompt + offline fallback caching
 */

const CACHE_NAME = 'quantum-terminal-v1.4.0';

// File inti yang di-cache untuk offline (relative to SW scope)
const CORE_ASSETS = [
    'terminal.html',
    'index.html',
    'dashboard.html',
    'status.html',
    'manifest.json',
    'assets/img/icon-192.png',
    'assets/img/icon-512.png',
    'assets/css/tokens.css',
    'assets/css/tailwind.css',
    'assets/js/main.js',
];

// ── Install: cache core assets ────────────────────────────────
self.addEventListener('install', (event) => {
    console.log('[SW] Installing Quantum Terminal Service Worker...');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(CORE_ASSETS).catch(err => {
                // Non-fatal: beberapa file mungkin belum ada
                console.warn('[SW] Some assets failed to cache (non-fatal):', err);
            });
        }).then(() => {
            console.log('[SW] Install complete ✅');
            return self.skipWaiting();
        })
    );
});

// ── Activate: cleanup old caches ─────────────────────────────
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter(name => name !== CACHE_NAME)
                    .map(name => {
                        console.log('[SW] Deleting old cache:', name);
                        return caches.delete(name);
                    })
            );
        }).then(() => {
            console.log('[SW] Activate complete ✅');
            return self.clients.claim();
        })
    );
});

// ── Fetch: Network-first strategy ─────────────────────────────
// Utamakan network (data realtime trading harus fresh),
// fallback ke cache hanya jika network gagal
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests & cross-origin API calls (Binance, Yahoo, etc.)
    if (request.method !== 'GET') return;
    if (!url.origin.includes(self.location.origin)) return;

    // Skip chrome-extension and devtools requests
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return;

    event.respondWith(
        fetch(request)
            .then(response => {
                // Cache successful responses for static assets
                if (response.ok && (
                    request.url.includes('/assets/') ||
                    request.url.includes('/manifest.json') ||
                    request.url.endsWith('/terminal.html')
                )) {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(request, responseClone);
                    });
                }
                return response;
            })
            .catch(() => {
                // Network failed — try cache
                return caches.match(request).then(cached => {
                    if (cached) {
                        console.log('[SW] Serving from cache (offline):', request.url);
                        return cached;
                    }
                    // Ultimate fallback for navigation requests
                    if (request.mode === 'navigate') {
                        return caches.match('terminal.html');
                    }
                    return new Response('Network Error', { status: 503 });
                });
            })
    );
});

// ── Push Notification (future use) ───────────────────────────
self.addEventListener('push', (event) => {
    if (!event.data) return;
    const data = event.data.json();
    self.registration.showNotification(data.title || 'Quantum Signal', {
        body: data.body || 'Sinyal baru dari Quantum Institut Terminal',
        icon: 'assets/img/icon-192.png',
        badge: 'assets/img/icon-192.png',
        tag: 'quantum-signal',
        requireInteraction: false,
    });
});
