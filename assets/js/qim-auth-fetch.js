/**
 * QIM Auth Fetch — menyertakan token login pada panggilan data pasar.
 *
 * api/get-chart-data.php, api/live-price.php dan api/signals.php memakai header Authorization
 * (bila ada) untuk mengenali pemanggil: pengguna yang berhak mendapat feed broker MT5 (VPS),
 * dan harga EA MT5 miliknya sendiri. Tanpa header, endpoint tetap jalan seperti biasa dengan
 * sumber umum (OANDA via TradingView) — jadi modul ini aman bila tidak ada sesi login.
 *
 * Dimuat tepat setelah auth.js dan SEBELUM modul lain yang membungkus fetch (qim-price-store.js).
 */
(function () {
    'use strict';
    if (window.__qimAuthFetch || typeof window.fetch !== 'function') return;
    window.__qimAuthFetch = true;

    const TARGET = /(?:^|\/)api\/(?:get-chart-data|live-price|signals)\.php(?:[?#]|$)/;
    const nativeFetch = window.fetch.bind(window);

    function token() {
        try { return window.QuantumAuth && window.QuantumAuth.getToken ? window.QuantumAuth.getToken() : null; } catch (e) { return null; }
    }

    window.fetch = function (input, init) {
        try {
            const url = typeof input === 'string' ? input : (input && input.url) || '';
            const sameOrigin = !/^[a-z][a-z0-9+.-]*:/i.test(url) || url.indexOf(location.origin) === 0;
            if (sameOrigin && TARGET.test(url)) {
                const tok = token();
                if (tok) {
                    const headers = new Headers((init && init.headers) || (typeof input !== 'string' && input && input.headers) || undefined);
                    if (!headers.has('Authorization')) {
                        headers.set('Authorization', 'Bearer ' + tok);
                        init = Object.assign({}, init, { headers });
                    }
                }
            }
        } catch (e) { /* jangan pernah menggagalkan fetch hanya karena header tambahan */ }
        return nativeFetch(input, init);
    };
})();
