/**
 * Quantum Institut Market Terminal — Service Worker
 * Versi: 2.1.0
 * #47 Improved cache strategy: stale-while-revalidate for assets, network-first for pages
 */

const CACHE_NAME = 'quantum-terminal-v2.1.0';
const STATIC_CACHE = 'quantum-static-v2.1.0';

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
    'assets/js/auth.js',
    'assets/js/theme-toggle.js',
    'assets/js/pro-features.js',
    'assets/js/perf-upgrades.js',
    'assets/js/error-tracker.js',
];

// ── Install: cache core assets ────────────────────────────────
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(STATIC_CACHE).then((cache) => {
            return cache.addAll(CORE_ASSETS).catch(() => {});
        }).then(() => self.skipWaiting())
    );
});

// ── Activate: cleanup old caches ─────────────────────────────
self.addEventListener('activate', (event) => {
    const keep = [CACHE_NAME, STATIC_CACHE];
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter(name => !keep.includes(name))
                    .map(name => caches.delete(name))
            );
        }).then(() => self.clients.claim())
    );
});

// ── Fetch strategies ─────────────────────────────────────────
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    if (request.method !== 'GET') return;
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return;
    if (!url.origin.includes(self.location.origin)) return;

    // API calls: network-only (trading data must be fresh)
    if (url.pathname.includes('/api/')) return;

    // Static assets (CSS, JS, images, fonts): stale-while-revalidate
    if (url.pathname.includes('/assets/') || url.pathname.includes('/manifest.json')) {
        event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
        return;
    }

    // HTML pages: network-first with cache fallback
    event.respondWith(networkFirst(request, CACHE_NAME));
});

function staleWhileRevalidate(request, cacheName) {
    return caches.open(cacheName).then(cache => {
        return cache.match(request).then(cached => {
            const networkFetch = fetch(request).then(response => {
                if (response.ok) {
                    cache.put(request, response.clone());
                }
                return response;
            }).catch(() => {
                return cached || new Response('', { status: 503 });
            });
            return cached || networkFetch;
        });
    });
}

function networkFirst(request, cacheName) {
    return fetch(request)
        .then(response => {
            if (response.ok) {
                const clone = response.clone();
                caches.open(cacheName).then(cache => cache.put(request, clone));
            }
            return response;
        })
        .catch(() => {
            return caches.match(request).then(cached => {
                if (cached) return cached;
                if (request.mode === 'navigate') {
                    return caches.match('terminal.html');
                }
                return new Response('Network Error', { status: 503 });
            });
        });
}

// ── Push Notification ───────────────────────────────────────
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
