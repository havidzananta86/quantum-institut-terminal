/* Web Worker backtest Setup Analisa: menjalankan detektor + simulasi di luar thread tampilan
   supaya halaman tetap responsif di HP. Pesan masuk: { id, candles, opsi }; keluar: { id, kemajuan } / { id, hasil }. */
/* global importScripts, QIMBacktestSetup, QIMSetups */
self.window = self;   // qim-setups.js mendaftarkan diri ke `window`
const versi = (self.location.search.match(/[?&]v=([^&]+)/) || [])[1] || '1';
importScripts('qim-setups.js?v=' + versi, 'qim-backtest-setup.js?v=' + versi);
self.onmessage = function (e) {
    const d = e.data || {};
    try {
        const hasil = QIMBacktestSetup.jalankan(QIMSetups, d.candles || [], Object.assign({}, d.opsi, {
            kemajuan: p => self.postMessage({ id: d.id, kemajuan: p })
        }));
        self.postMessage({ id: d.id, hasil });
    } catch (err) {
        self.postMessage({ id: d.id, hasil: { ok: false, pesan: 'Backtest gagal: ' + (err && err.message || err) } });
    }
};
