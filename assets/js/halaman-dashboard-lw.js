// Modul chart dashboard (lightweight-charts) → window._lwModules. Dipindah dari <script type="module"> inline
// agar lolos CSP tanpa 'unsafe-inline'. Import-map inline juga dihapus (ikut terkena script-src): URL CDN
// ditulis langsung. Import statis & dinamis WAJIB memakai URL yang sama supaya modulnya satu instans.
// Versi dikunci (5.2.1 = yang dulu didapat dari "@5") supaya bisa diberi SRI; CDN cadangan di dashboard-app.js
// (buildLwChart) memakai versi yang sama.
// PERBAIKAN PENTING: dulu kedua library diimpor dalam satu pernyataan import.
// Karena import bersifat "semua atau gagal", kegagalan library OPSIONAL (alat
// gambar) ikut menggagalkan library WAJIB (chart) -> window._lwModules tidak
// pernah terisi -> buildLwChart() menunggu tanpa batas dan chart tampak kosong
// sampai halaman dimuat ulang ("harus refresh dulu"). Kini dipisah: chart wajib,
// alat gambar boleh gagal tanpa mematikan chart.
import { createChart, CandlestickSeries, LineSeries, HistogramSeries, LineStyle, CrosshairMode } from 'https://cdn.jsdelivr.net/npm/lightweight-charts@5.2.1/+esm';
// Alat gambar (±81 KB dari CDN) dimuat SETELAH chart siap: dulu chart menunggu library
// opsional ini selesai diunduh sebelum bisa digambar. Saat tiba, ia dipasang ke chart
// yang sudah ada lewat peristiwa 'lc-drawing-ready' (lihat dashboard-app.js).
const DrawingManager = null;
// Di v5, `series.setMarkers()` DIHAPUS dan diganti `createSeriesMarkers()`.
// Ketiadaan fungsi itu TIDAK boleh menggagalkan import (import bernama yang tidak
// ada = error saat modul ditautkan), jadi diambil lewat import dinamis dan
// disimpan bila tersedia. Dengan begitu helper pemasang marker bisa melayani
// v4 maupun v5 — inilah yang membuat marker sinyal benar-benar tampil.
let createSeriesMarkers = null;
try {
    const lw = await import('https://cdn.jsdelivr.net/npm/lightweight-charts@5.2.1/+esm');
    createSeriesMarkers = (typeof lw.createSeriesMarkers === 'function') ? lw.createSeriesMarkers : null;
} catch (e) { /* biarkan null: jalur v4 tetap tersedia */ }
window._lwModules = { createChart, CandlestickSeries, LineSeries, HistogramSeries, LineStyle, CrosshairMode, DrawingManager, createSeriesMarkers };
window.dispatchEvent(new CustomEvent('lc-modules-ready'));
try {
    const alatGambar = await import('https://cdn.jsdelivr.net/npm/lightweight-charts-drawing@0.5.1/dist/lightweight-charts-drawing.es.js');
    if (alatGambar.DrawingManager) {
        window._lwModules.DrawingManager = alatGambar.DrawingManager;
        window.dispatchEvent(new CustomEvent('lc-drawing-ready'));
    }
} catch (e) {
    console.warn('[QI] Library alat gambar gagal dimuat — chart tetap berjalan tanpa alat gambar.');
}
