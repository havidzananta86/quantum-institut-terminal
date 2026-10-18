/* ═══════════════════════════════════════════════════════════════════════════
   MODEL P/L PAPER TRADING — SATU-SATUNYA versi JavaScript.

   Kembaran PHP-nya: qi_paper_pip_mult() di api/_paper_math.php. Keduanya diuji sama
   (tests/paper-math.test.js) supaya P/L yang dilihat di peramban = P/L yang disimpan
   server. dashboard-app.js (ptPnlMult) dan pro-trading-tools.js (_pipMult) memanggil
   fungsi ini.

   Model (1 lot standar):
     · Kripto (…USDT)          : 1 koin per lot          → P/L = selisih × lot
     · XAUUSD                  : 100 oz per lot           → $1 gerak = $100 per lot
     · XAGUSD                  : 5.000 oz per lot
     · Indeks (US30, NAS100,   : 1 kontrak per lot        → 1 poin = $1 per lot
       SPX500, GER40, UK100, JP225)
     · Pair berkuotasi USD     : 100.000 unit (EURUSD, GBPUSD, AUDUSD, NZDUSD)
     · Pair berbasis USD       : 100.000 unit, P/L dalam mata uang kuotasi lalu
       (USDJPY, USDCHF, USDCAD)  dikonversi ke USD pada harga itu → 100.000 / harga
     · Lainnya                 : 1000 (konvensi lama aplikasi, bukan spesifikasi broker)
   Tanpa harga, pair berbasis USD memakai konvensi lama 1000 (kompatibel ke belakang).
   ═══════════════════════════════════════════════════════════════════════════ */
(function (root) {
    'use strict';
    function qimPaperMult(symbol, price) {
        const s = String(symbol || '').toUpperCase().replace('/', '').trim();
        if (/USDT$/.test(s)) return 1;
        if (s === 'XAUUSD') return 100;
        if (s === 'XAGUSD') return 5000;
        if (['US30', 'NAS100', 'SPX500', 'GER40', 'UK100', 'JP225'].includes(s)) return 1;   // CFD indeks: 1 kontrak
        if (['EURUSD', 'GBPUSD', 'AUDUSD', 'NZDUSD'].includes(s)) return 100000;
        if (['USDJPY', 'USDCHF', 'USDCAD'].includes(s)) {
            const p = Number(price);
            return Number.isFinite(p) && p > 0 ? 100000 / p : 1000;
        }
        return 1000;
    }
    function qimPaperPnl(symbol, side, entry, exit, lots) {
        const diff = String(side).toUpperCase() === 'BUY' ? exit - entry : entry - exit;
        return Math.round(diff * lots * qimPaperMult(symbol, exit) * 100) / 100;
    }
    root.qimPaperMult = qimPaperMult;
    root.qimPaperPnl = qimPaperPnl;
    if (typeof module !== 'undefined' && module.exports) module.exports = { qimPaperMult, qimPaperPnl };
})(typeof window !== 'undefined' ? window : globalThis);
