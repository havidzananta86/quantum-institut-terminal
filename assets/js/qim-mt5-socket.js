/**
 * QIM MT5 Socket — tick realtime dari mt5-bridge (WebSocket) ke chart dashboard.
 *
 * Alur: api/mt5-bridge-token.php (token 5 menit) → wss://bridge/ws/harga →
 * window.qiRealtimeTick() yang sudah memperbarui candle terakhir secara incremental.
 *
 * Bila bridge tidak dikonfigurasi (404), pengguna tidak berhak (403), atau socket
 * putus, modul ini diam dan polling yang sudah ada (realtime.js / live-price) tetap
 * menjadi sumber harga — tidak pernah ada keadaan "harga mati".
 */
(function () {
    'use strict';

    const TOKEN_URL = 'api/mt5-bridge-token.php';
    const FRESH_MS = 3000;          // selama socket mengirim tick ≤ 3 dtk lalu, sumber lain untuk simbol itu diabaikan
    const RETRY_LOGIN_MS = 5 * 60 * 1000;
    const MAX_BACKOFF_MS = 30000;

    let ws = null;
    let token = null;
    let tokenExp = 0;
    let bridgeUrl = null;
    let backoff = 1000;
    let reconnectTimer = null;
    let renewTimer = null;
    let lastStatusAt = 0;
    let state = 'off';              // off | connecting | live | disabled
    let disabledReason = '';
    const lastTickAt = {};

    function authHeaders() {
        return window.QuantumAuth && typeof window.QuantumAuth.authHeaders === 'function' ? window.QuantumAuth.authHeaders() : {};
    }

    function hasLogin() {
        try { return !!(window.QuantumAuth && window.QuantumAuth.getToken && window.QuantumAuth.getToken()); } catch (e) { return false; }
    }

    function disable(reason) {
        state = 'disabled';
        disabledReason = reason;
        clearTimeout(reconnectTimer);
        clearTimeout(renewTimer);
        console.info('[QIM MT5] socket tidak dipakai:', reason, '— tetap memakai polling.');
    }

    /** Mengembalikan true bila token siap; false bila harus berhenti/menunggu. */
    async function fetchToken() {
        const res = await fetch(TOKEN_URL, { headers: authHeaders(), cache: 'no-store' });
        if (res.status === 404) { disable('bridge belum dikonfigurasi'); return false; }
        if (res.status === 403) { disable('akun tidak terhubung ke bridge MT5'); return false; }
        if (res.status === 401) { scheduleReconnect(RETRY_LOGIN_MS); return false; }
        if (!res.ok) throw new Error('token HTTP ' + res.status);
        const json = await res.json();
        if (!json || json.status !== 'success' || !json.data) throw new Error('format token tidak valid');
        token = json.data.token;
        tokenExp = Date.now() + json.data.expires_in * 1000;
        bridgeUrl = json.data.url.replace(/\/+$/, '') + '/ws/harga';
        return true;
    }

    function scheduleReconnect(delay) {
        clearTimeout(reconnectTimer);
        const wait = delay != null ? delay : backoff + Math.random() * 500;
        backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
        reconnectTimer = setTimeout(connect, wait);
    }

    // Perbarui token di 80% umurnya tanpa memutus socket.
    function scheduleRenew() {
        clearTimeout(renewTimer);
        const inMs = Math.max(5000, (tokenExp - Date.now()) * 0.8);
        renewTimer = setTimeout(async () => {
            try {
                if (await fetchToken() && ws && ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'auth', token }));
                }
            } catch (e) { /* gagal memperbarui: server menutup saat kedaluwarsa lalu kita sambung ulang */ }
        }, inMs);
    }

    function reportStatus(symbolCount) {
        const now = Date.now();
        if (now - lastStatusAt < 1000 || typeof window.qiRealtimeState !== 'function') return;
        lastStatusAt = now;
        try { window.qiRealtimeState('broker', 'mt5-ws', { brokerAgeMs: 0, brokerSymbols: symbolCount }); } catch (e) {}
    }

    function handleMessage(ev) {
        let msg;
        try { msg = JSON.parse(ev.data); } catch (e) { return; }
        if (msg.type === 'ready') {
            state = 'live';
            backoff = 1000;
            scheduleRenew();
            if (msg.source === 'mock') console.warn('[QIM MT5] bridge memakai sumber MOCK (development) — bukan harga broker.');
        } else if (msg.type === 'renewed') {
            scheduleRenew();
        } else if (msg.type === 'ticks' && Array.isArray(msg.data)) {
            const now = Date.now();
            msg.data.forEach(t => {
                const bid = Number(t.bid);
                if (!t.s || !(bid > 0)) return;
                lastTickAt[t.s] = now;
                try {
                    window.qiRealtimeTick(t.s, bid, { source: t.src === 'mock' ? 'mt5_ws_mock' : 'mt5_ws', spread: Number(t.spread) });
                } catch (e) { /* satu tick rusak tidak boleh menghentikan aliran */ }
            });
            reportStatus(Object.keys(lastTickAt).length);
        }
    }

    async function connect() {
        if (state === 'disabled' || state === 'connecting' || ws || document.visibilityState === 'hidden') return;
        if (!hasLogin()) { scheduleReconnect(RETRY_LOGIN_MS); return; }
        state = 'connecting';
        try {
            if (!token || Date.now() > tokenExp - 30000) {
                if (!(await fetchToken())) { if (state === 'connecting') state = 'off'; return; }
            }
            const socket = new WebSocket(bridgeUrl);
            ws = socket;
            socket.onopen = () => socket.send(JSON.stringify({ type: 'auth', token }));
            socket.onmessage = handleMessage;
            socket.onclose = ev => {
                if (ws === socket) ws = null;
                if (state === 'disabled') return;
                state = 'off';
                clearTimeout(renewTimer);
                if (ev.code === 4401) token = null;                     // token kedaluwarsa/ditolak → minta baru
                if (ev.code === 4403) { disable('ditolak bridge (origin/izin)'); return; }
                if (ev.code !== 1000) scheduleReconnect();
            };
        } catch (e) {
            state = 'off';
            scheduleReconnect();
        }
    }

    // Sumber lain (polling EA, live-price, Binance) tidak boleh menimpa tick socket yang lebih baru.
    function installTickGuard() {
        const original = window.qiRealtimeTick;
        if (typeof original !== 'function' || original.__qimMt5Guard) return;
        const guarded = function (sym, price, meta) {
            const src = meta && meta.source;
            if (src !== 'mt5_ws' && src !== 'mt5_ws_mock' && Date.now() - (lastTickAt[sym] || 0) < FRESH_MS) return;
            return original.apply(this, arguments);
        };
        guarded.__qimMt5Guard = true;
        window.qiRealtimeTick = guarded;
    }

    // Hemat baterai/kuota: tutup socket saat tab disembunyikan, sambung lagi saat terlihat.
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            clearTimeout(reconnectTimer);
            if (ws) ws.close(1000, 'tab hidden');
        } else if (state !== 'disabled' && !ws) {
            backoff = 1000;
            connect();
        }
    });

    /** Candle historis dari terminal MT5 (REST bridge), memakai token yang sama. */
    async function candles(symbol, tf, count) {
        if (!token || Date.now() > tokenExp - 30000) {
            if (!(await fetchToken())) throw new Error(disabledReason || 'bridge tidak tersedia');
        }
        const base = bridgeUrl.replace(/^ws/i, 'http').replace(/\/ws\/harga$/, '');
        const qs = new URLSearchParams({ symbol, tf: tf || 'H1', count: String(count || 500) });
        const res = await fetch(base + '/api/candles?' + qs, { headers: { Authorization: 'Bearer ' + token } });
        if (!res.ok) throw new Error('candles HTTP ' + res.status);
        return (await res.json()).candles;
    }

    window.QIMMT5Socket = {
        state: () => ({ state, reason: disabledReason, symbols: Object.keys(lastTickAt), lastTickAt: Object.assign({}, lastTickAt) }),
        candles,
        reconnect: () => { if (state !== 'disabled') { backoff = 1000; connect(); } }
    };

    function start() {
        installTickGuard();
        connect();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
    else start();
})();
