# quantum-terminal/ — widget chart (vendor, hasil build)

Isi folder ini adalah **keluaran build SvelteKit pihak ketiga** (`@tradecanvas/chart`), bukan kode yang ditulis di repo ini.
Hanya berkas yang benar-benar terjangkau dari `embed/index.html` yang dimasukkan (±220 berkas, ±5 MB). Folder lengkap
(±83 MB: dokumentasi 15 bahasa, ribuan chunk dari build-build lama) sengaja TIDAK ikut — jangan disalin utuh kembali.

Dashboard memuat `embed/` di dalam iframe (`dashboard.html` → `quantum-terminal/embed/?ui=terminal&symbol=…`).

## Tambalan manual (harus diterapkan ulang bila widget di-build ulang)

1. **`_app/immutable/nodes/5.Cj2cORJe.js`** — `onReady` ditambah:
   `window.__quantumTerminalChart = e; window.dispatchEvent(new CustomEvent("qt-chart-ready", {detail: e}));`
   Tanpa ini `embed/qt-signal-bridge.js` tidak pernah menerima objek chart: tombol Zoom / Reset / Magnet, palet warna,
   overlay sinyal, dan fallback layar penuh di shell (`assets/js/qim-terminal-shell.js`) semuanya diam tanpa pesan.
   (Awalnya tambalan ini hanya ada di `embed/_app/…`, sedangkan halaman membaca `_app/…` di akar — jadi tidak pernah dipakai.)
2. **`embed/index.html`** — mengacu ke build `start.CljMvWqp.js` / `app.BLSVUgXG.js` / node `5.Cj2cORJe.js` (build yang memuat
   tambalan di atas), memuat `qt-signal-bridge.js`, dan memakai nama variabel bootstrap `__sveltekit_1e21pzv`
   (nama itu berubah tiap build; kalau tidak cocok dengan yang dibaca `app.*.js`, base path kosong dan rute `/embed` 404).
3. **`embed/qt-signal-bridge.js`** — jembatan shell ↔ chart (overlay sinyal, perintah `qt-chart-command`).
4. **`.htaccess`** — mematikan CSP Report-Only untuk folder ini (report-uri situs bersifat relatif sehingga dari sini selalu 404).

## Masalah yang diketahui di widget (belum diperbaiki — kodenya tidak ada di repo ini)

- Adapter kripto bawaan widget memanggil `api.binance.com` / `stream.binance.com` langsung dari peramban, tidak lewat
  `api/get-chart-data.php`. Di jaringan yang memblokir Binance (umum di Indonesia) chart kripto gagal memuat.
- Locale `id` diminta tetapi tidak ada bundel bahasanya (peringatan konsol, UI tetap Inggris).
