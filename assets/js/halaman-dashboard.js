// Skrip penutup dashboard: dulu 3 blok <script> inline di akhir <body> (dipindah agar lolos CSP tanpa
// 'unsafe-inline'), plus aksi bernama untuk data-qi-aksi yang dulu berupa kode majemuk di atribut onclick="...".
// Dimuat sinkron setelah semua skrip lain (butuh QIAksi dari qim-aksi.js).

// ── Bottom-sheet ──
/* Bottom-sheet "Analisa & Sinyal" untuk layar < 900px: tutup saat tap di luar atau Esc. */
document.addEventListener('click', function (e) {
    if (!document.body.classList.contains('qim-sheet-open')) return;
    if (e.target.closest('#qimRightPanel, .qim-analysis-toggle')) return;
    document.body.classList.remove('qim-sheet-open');
}, true);
document.addEventListener('keydown', function (e) { if (e.key === 'Escape') document.body.classList.remove('qim-sheet-open'); });

// ── Status online/offline ──
(function(){
    var dot = document.getElementById('liveStatusDot');
    var txt = document.getElementById('liveStatusText');
    function setOnline(on) {
        if (!dot || !txt) return;
        if (on) {
            dot.className = 'w-1.5 h-1.5 rounded-full bg-qi-green session-dot';
            txt.className = 'text-[10px] font-semibold text-qi-green tracking-wider';
            txt.textContent = 'LIVE';
        } else {
            dot.className = 'w-1.5 h-1.5 rounded-full bg-rose-500';
            txt.className = 'text-[10px] font-semibold text-rose-400 tracking-wider';
            txt.textContent = 'OFFLINE';
        }
    }
    window.addEventListener('online', function(){ setOnline(true); if(window.showQuantumToast) showQuantumToast('Koneksi kembali aktif','success',2000); });
    window.addEventListener('offline', function(){ setOnline(false); if(window.showQuantumToast) showQuantumToast('Koneksi terputus — data tidak diperbarui','warning',4000); });
    if (!navigator.onLine) setOnline(false);
})();

// ── PWA ──
// ── PWA: daftarkan service worker juga di dashboard ──────────────────────────
// Sebelumnya pendaftaran hanya ada di index.html, sehingga pengguna yang membuka
// aplikasi langsung (sudah login / tautan dalam) TIDAK mendapat kemampuan PWA
// (pasang ke layar utama + offline dasar). Didaftarkan setelah peristiwa 'load'
// supaya tidak memperlambat tampilan awal, dan seluruhnya dibungkus try/catch:
// kegagalan (browser lama / mode privat) tidak boleh mengganggu aplikasi.
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
        try {
            // PENTING — jangan ubah nomor versi di bawah tanpa menaikkan CACHE_NAME di sw.js.
            // Alasan (terukur 13 Okt): hosting mengirim sw.js dengan
            // "Cache-Control: public, max-age=2592000" (30 HARI). URL registrasi yang isinya
            // tetap (dulu 'sw.js?v=3.0.0') karena itu ter-cache lama, sehingga Service Worker
            // pengguna TERTAHAN di versi lama (terukur: sw.js tanpa query masih
            // quantum-terminal-v3.1.0 dengan Age ±25 jam, dan header no-cache pun tidak
            // menembusnya). Dengan menaikkan query ini setiap kali CACHE_NAME di sw.js naik,
            // peramban mengambil URL BARU sehingga SW langsung diperbarui.
            // Riwayat: v=3.0.0 (lama, nyangkut) → v=3.8.8 (sinkron dengan CACHE_NAME).
            navigator.serviceWorker.register('sw.js?v=3.8.9').catch(function () {});
        } catch (e) { /* diabaikan dengan sengaja */ }
    });
}

// ── Aksi bernama untuk data-qi-aksi (dulu kode majemuk di atribut onclick/oninput/onkeydown) ──
// Setiap aksi dipanggil (el, e, ...arg) — lihat assets/js/qim-aksi.js.
QIAksi.daftar({
    // Kartu sambutan: tutup sambutan lalu buka panel pilihan.
    sambutanKe(el, e, panel) { dismissQiOnboarding(); switchPanel(panel); },
    // Menu "Drawing" di header: buka chart lalu pilih alat garis tren.
    bukaAlatGambar() { switchPanel('panel-charts'); setTimeout(function () { setChartTool('trend-line'); }, 400); },
    // Tautan dengan href cadangan (dashboard.html?panel=…): pindah panel tanpa memuat ulang halaman.
    bukaPanelDariTautan(el, e, panel) { e.preventDefault(); switchPanel(panel); },
    ingatKembaliKeDashboard() { try { sessionStorage.setItem('qi_redirect_after_login', 'dashboard.html'); } catch (err) {} },
    fokusZonaPosisi() {
        if (window.QuantumChartZones && window.QuantumChartZones.fokus) {
            window.QuantumChartZones.fokus();
            showQuantumToast('⤢ Skala disesuaikan agar seluruh entry · TP · SL terlihat.', 'info', 2500);
        }
    },
    // Palet perintah: klik di latar (bukan di kotaknya) menutup palet.
    tutupPaletBilaLatar(el, e) { if (e.target === el) closeCommandPalette(); },
    // _lwChart dideklarasikan `let` di dashboard-app.js → bukan properti window, tetapi terlihat dari sini.
    pasChart() { if (_lwChart) _lwChart.timeScale().fitContent(); },
    kirimAiDenganEnter(el, e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAiMessage(); } },
    // Harga entry paper trading yang diketik pengguna tidak ditimpa harga live.
    tandaiDiubahPengguna(el) { el._userEdited = !!el.value; },
    geserWinRateAkademi(el) { document.getElementById('acadSimWRVal').textContent = el.value + '%'; runAcadSimulator(); },
});
