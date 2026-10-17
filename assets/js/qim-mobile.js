/**
 * Kerangka (skeleton) chart: tampil selama candle dimuat, hilang begitu chart berisi.
 * Sinyal dari dashboard-app.js (lwFetchAndSetData): 'qi-chart-loading' → tampil,
 * 'qi-chart-data' / 'qi-chart-gagal' → sembunyi. Batas 15 detik supaya kerangka tidak pernah
 * menutupi chart selamanya bila sesuatu gagal diam-diam.
 */
(function () {
    'use strict';
    const BATAS_MS = 15000;
    let pengaman = null;
    const el = () => document.getElementById('qimChartSkel');

    function sembunyi() {
        clearTimeout(pengaman);
        const s = el();
        if (s) s.classList.add('hilang');
    }
    function tampil() {
        const s = el();
        if (!s) return;
        s.classList.remove('hilang');
        clearTimeout(pengaman);
        pengaman = setTimeout(sembunyi, BATAS_MS);
    }

    window.addEventListener('qi-chart-loading', tampil);
    window.addEventListener('qi-chart-data', sembunyi);
    window.addEventListener('qi-chart-gagal', sembunyi);

    // Data bisa saja sudah ada sebelum skrip ini berjalan.
    try {
        const k = typeof window.qiChartKonteks === 'function' ? window.qiChartKonteks() : null;
        if (k && k.candles && k.candles.length) sembunyi();
        else pengaman = setTimeout(sembunyi, BATAS_MS);
    } catch (e) { pengaman = setTimeout(sembunyi, BATAS_MS); }

    window.QIMMobile = { tampilKerangka: tampil, sembunyiKerangka: sembunyi };
})();
