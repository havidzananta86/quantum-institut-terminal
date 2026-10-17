# Komponen Pihak Ketiga

Dokumen ini mencatat pustaka pihak ketiga yang dipakai di antarmuka web, beserta
lisensinya. Ini praktik yang benar untuk produk komersial: kewajiban lisensi
(menyertakan notice) terpenuhi dan jejaknya jelas.

## Pustaka yang dibundel / dirujuk

| Komponen | Versi | Lisensi | Dipakai di | Catatan |
|---|---|---|---|---|
| **TradingView Lightweight Charts™** | 4.1.3 (lokal) | **Apache-2.0** | `terminal.html` (`assets/js/lightweight-charts.standalone.production.js`) | Notice lisensi **dipertahankan** di dalam berkas ✓ (wajib untuk Apache-2.0) |
| **TradingView Lightweight Charts™** | 5.x (ESM, CDN) | **Apache-2.0** | `dashboard.html` (importmap → jsDelivr) | Versi 5 dipakai karena kode dashboard memakai API v5 (`addSeries`) |
| **lightweight-charts-drawing** | 0.5.1 (CDN) | **MIT** | `dashboard.html` (alat gambar, opsional) | Bila gagal dimuat, chart **tetap berjalan** (lihat `buildLwChart`) |
| **Tailwind CSS** | 3.4.x | **MIT** | build saja (devDependency) | CSS hasil build (`assets/css/tailwind.css`) yang di-deploy |
| **Microsoft SignalR JS client** | 8.0.7 (CDN) | **MIT** | `terminal.html` | Untuk hub realtime Biquote (`_connectBiquoteSignalR`) |
| **TradingView Widget** (`tv.js`) | terbaru (CDN) | Ketentuan TradingView | `terminal.html` | **Widget resmi** — hanya untuk *menampilkan*; tidak dipakai sebagai sumber data mesin |
| **JetBrains Mono / Archivo / Inter** | — | SIL Open Font License | via Google Fonts | Dimuat dari `fonts.googleapis.com` |

## Sumber data pasar (bukan komponen kode)

| Sumber | Dipakai untuk | Catatan |
|---|---|---|
| **Binance** (`data-api.binance.vision`) | kripto (candle + riwayat dalam) | data pasar publik |
| **biquote.io** | forex & emas (candle) | termasuk hub SignalR realtime |
| **Twelve Data** | emas/forex (fallback utama) | **kuota gratis terbatas**; paket berbayar untuk produksi |
| **Frankfurter / CoinGecko / xaus.com** | cadangan kurs & spot emas | gratis |

## Catatan teknis penting

1. **Dua versi Lightweight Charts dipakai bersamaan** (v4.1.3 di terminal, v5 di dashboard).
   Ini **bukan bug**, tetapi menyulitkan perawatan dan menjadi sumber kesalahan nyata:
   `series.setMarkers()` **dihapus di v5**, sehingga pemasangan marker di dashboard
   dulu gagal diam-diam. Sudah diatasi dengan helper `pasangMarker()` yang bekerja di
   kedua versi.
   **Rencana:** migrasi terminal ke v5 termasuk menulis ulang pemanggilan API
   (`addCandlestickSeries` → `addSeries(...)` dan sejenisnya) di `assets/js/chart-init.js`
   (±92 KB, banyak titik pemanggilan). Dikerjakan tersendiri dengan pengujian menyeluruh,
   **bukan** bersamaan dengan perubahan fitur.
2. **Atribusi wajib.** Apache-2.0 dan MIT mewajibkan notice hak cipta dipertahankan.
   Berkas `lightweight-charts.standalone.production.js` di repo ini **masih memuat**
   notice-nya (dicek pada sesi ini) — jangan menghapusnya saat memperbarui berkas.
3. **Widget resmi TradingView hanya untuk tampilan.** Ia tidak boleh (dan tidak bisa)
   menjadi sumber data untuk 9 mesin kuantum; mesin mengambil candle dari API sendiri
   (`api/get-chart-data.php`, `api/get-history.php`).

_Terakhir diperbarui: sesi pengembangan MESIN 9._
