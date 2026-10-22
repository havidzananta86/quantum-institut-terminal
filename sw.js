/**
 * Quantum Institut Market Terminal — Service Worker
 * Versi: 3.0.0
 * #47 Improved cache strategy: stale-while-revalidate for assets, network-first for pages
 * v3.0.0: cache lama dibuang paksa — halaman HTML lama yang tersangkut di cache
 *         membuat antarmuka tampil beda dari build terbaru di server.
 */

// CACHE_NAME & STATIC_CACHE DITULIS OTOMATIS oleh 'npm run build:js' (hash build) — jangan diubah tangan.
// Bundel JS ber-hash (assets/dist/) baru → cache lama dibuang saat SW baru aktif.
const CACHE_NAME = 'quantum-terminal-434546e880';
const STATIC_CACHE = 'quantum-static-434546e880';

const CORE_ASSETS = [

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
    // bundel:mulai (ditulis npm run build:js)
    'assets/dist/kepala-awal.316cbd801a.js',
    'assets/dist/kepala.669545eb97.js',
    'assets/dist/pemuat.e1bcbad631.js',
    'assets/dist/awal.2649669b5c.js',
    'assets/dist/inti.56fbb1789c.js',
    'assets/dist/fitur.d17d997cd9.js',
    'assets/dist/tunda.7a7be7a1eb.js',
    // bundel:akhir
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
                    return caches.match('dashboard.html');
                }
                return new Response('Network Error', { status: 503 });
            });
        });
}

// ── Push Notification (Web Push dari api/_push.php — VAPID + aes128gcm) ─────
// waitUntil menjaga service worker tetap hidup sampai notifikasi tampil; tag per sinyal
// mencegah notifikasi ganda (tab terbuka juga memakai tag yang sama).
self.addEventListener('push', (event) => {
    let data = {};
    try { data = event.data ? event.data.json() : {}; } catch (e) { data = { body: event.data ? event.data.text() : '' }; }
    event.waitUntil(self.registration.showNotification(data.title || 'Quantum Signal', {
        body: data.body || 'Sinyal baru dari Quantum Institut Terminal',
        icon: 'assets/img/icon-192.png',
        badge: 'assets/img/icon-192.png',
        tag: data.tag || 'quantum-signal',
        renotify: false,
        data: { url: data.url || 'dashboard.html' },
    }));
});

// Klik notifikasi → fokuskan dashboard yang sudah terbuka, atau buka yang baru.
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const tujuan = new URL((event.notification.data && event.notification.data.url) || 'dashboard.html', self.registration.scope).href;
    event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((daftar) => {
        for (const c of daftar) {
            if (c.url.startsWith(self.registration.scope) && 'focus' in c) return c.focus();
        }
        return clients.openWindow ? clients.openWindow(tujuan) : undefined;
    }));
});
