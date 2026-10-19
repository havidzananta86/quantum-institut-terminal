/**
 * PEMUAT FITUR LAZY — modul yang jarang dipakai tidak ikut diunduh saat dashboard dibuka;
 * modul dimuat saat menunya pertama kali dibuka:
 *  - backtest   (qim-backtest-ui.js)                       : tombol "📊 Backtest metode" di kartu Setup Analisa;
 *  - multichart (qim-multichart.js)                        : menu Tata letak chart — atau langsung saat halaman
 *                                                             dibuka bila tata letak 2/4 chart tersimpan (dipulihkan seperti dulu);
 *  - pine       (qim-pine-smcsnd.js + qim-indikator-kustom.js): popover Indikator di kepala chart.
 * URL bundel ber-hash diisi skrip build (window.QIM_FITUR_LAZY, lihat tools/bundel-js.mjs). Bila bundel gagal
 * dimuat (mis. tab terbuka lama melewati deploy sehingga hash lama sudah dihapus), file sumbernya di assets/js/
 * dicoba berurutan.
 */
(function () {
    'use strict';
    const PETA = window.QIM_FITUR_LAZY || {};
    const janji = {};

    // Indikator Pine membaca bar replay dari peristiwa 'qim:replay-bar'. Peristiwa terakhir direkam di sini dan
    // dikirim ulang setelah modulnya tiba, supaya indikator yang dimuat di tengah replay tidak "membocorkan masa depan".
    let replayTerakhir;
    window.addEventListener('qim:replay-bar', e => { replayTerakhir = e.detail; });
    const SESUDAH = {
        pine() { if (replayTerakhir !== undefined) window.dispatchEvent(new CustomEvent('qim:replay-bar', { detail: replayTerakhir })); },
    };

    function skrip(url) {
        return new Promise((selesai, gagal) => {
            const s = document.createElement('script');
            s.src = url;
            s.async = false;   // file sumber cadangan wajib jalan berurutan (pine-smcsnd sebelum indikator-kustom)
            s.onload = () => selesai();
            s.onerror = () => { s.remove(); gagal(new Error('Gagal memuat ' + url)); };
            document.head.appendChild(s);
        });
    }

    function muat(nama) {
        if (janji[nama]) return janji[nama];
        const f = PETA[nama];
        if (!f) return Promise.reject(new Error('Fitur lazy tidak dikenal: ' + nama));
        janji[nama] = skrip(f.url)
            .catch(() => f.sumber.reduce((rantai, url) => rantai.then(() => skrip(url + '?v=' + Date.now())), Promise.resolve()))
            .then(() => { if (SESUDAH[nama]) SESUDAH[nama](); })
            .catch(e => { delete janji[nama]; throw e; });
        return janji[nama];
    }
    window.QIMMuatFitur = muat;

    const kabarGagal = () => {
        if (typeof window.showQuantumToast === 'function') window.showQuantumToast('Modul gagal dimuat — periksa koneksi lalu coba lagi.', 'error', 4000);
    };

    // Backtest: klik pertama memuat modul lalu membuka dialognya; klik berikutnya ditangani modul itu sendiri.
    let menungguBacktest = false;
    document.addEventListener('click', e => {
        if (window.QIMBacktestUI || menungguBacktest || !e.target.closest('#qimBacktestBuka')) return;
        menungguBacktest = true;
        muat('backtest').then(() => { if (window.QIMBacktestUI) window.QIMBacktestUI.buka(); }, kabarGagal)
            .finally(() => { menungguBacktest = false; });
    });

    // Multi-chart: tata letak tersimpan > 1 chart → muat segera supaya dipulihkan seperti saat modul selalu dimuat.
    try {
        const j = JSON.parse(localStorage.getItem('qim_multichart') || 'null');
        if (j && [2, 4].includes(j.jumlah)) muat('multichart').catch(() => {});
    } catch (e) { /* localStorage tidak tersedia: tetap 1 chart */ }
})();
