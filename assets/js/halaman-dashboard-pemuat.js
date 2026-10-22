// Layar pembuka dashboard (#qiLoadScreen). Dipisah dari <script> inline agar lolos CSP
// tanpa 'unsafe-inline', dan dimuat sinkron tepat setelah markupnya supaya tahapannya
// mulai berjalan sebelum halaman selesai dimuat. Gaya: assets/css/qim-masuk.css — sama
// dengan layar "Berhasil masuk" di login.html, jadi keduanya terasa satu alur.
//
// TAHAPANNYA MENGIKUTI KEJADIAN NYATA, BUKAN TIMER.
//   1 qiBootSesi — selesai saat halaman-dashboard-awal.js mengirim 'qi-sesi' {sah:true} dari
//                  verifikasi token ke server. Belum datang dalam 1,2 detik → "Sesi diverifikasi
//                  di latar" (keadaan lewat + data-lunak: permintaannya memang masih berjalan, tapi
//                  karena dipicu timer TIDAK dihitung di bilah sampai jawaban datang / layar ditutup).
//                  Jawaban gagal (5xx / jaringan) → "Server belum dapat memastikan sesi" / "Server
//                  sesi tidak terjangkau" (lewat). Ditolak (401) → gagal, dan layar TIDAK mengaku
//                  "Siap" karena halaman sedang dialihkan ke login.html.
//   2 qiBootData — selesai saat data candle pertama masuk ('qi-chart-data'); 'qi-chart-gagal' atau
//                  layar tertutup tanpa data → "Data pasar menyusul" (lewat), BUKAN "selesai".
//   3 qiBootSiap — selesai saat layar ditutup setelah DOMContentLoaded.
// Bilah kemajuan = tahap tuntas / jumlah tahap (lewat style.setProperty), tidak pernah animasi
// berdurasi tetap. "Siap" hanya ditulis setelah tahap 3 benar-benar selesai.
//
// Lanjutan dari login.html: sessionStorage 'qi_serah_masuk' (ditulis QimMasuk.serahkan hanya bila
// tujuannya dashboard.html, berlaku 30 detik, sekali pakai) → judul "Berhasil masuk", nama & paket,
// satu baris ringkas untuk tahapan login (jujur: "lewat" bila 2FA / sesi lama tidak dapat
// dipastikan), bilah mulai dari 3/4, dan tanpa jeda tampil minimum.
(function () {
    'use strict';
    var layar = document.getElementById('qiLoadScreen');
    if (!layar) return;

    var MIN_TAMPIL  = 650;   // kunjungan langsung: jeda agar layar tidak berkedip lalu hilang
    var BATAS       = 8000;  // pengaman koneksi lambat: jangan pernah mengurung pengguna
    var BATAS_SESI  = 1200;  // setelah ini verifikasi sesi dinyatakan "di latar"
    var TUNGGU_DATA = 900;   // setelah DOM siap, tunggu data pasar paling lama segini
    var TAHAP = ['qiBootSesi', 'qiBootData', 'qiBootSiap'];
    var mulai = Date.now();
    var selesai = false;
    var dialihkan = false;   // halaman sedang dialihkan ke login.html (tanpa sesi / sesi ditolak server)

    var gerakMinim = false;
    try { gerakMinim = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) {}
    if (gerakMinim) MIN_TAMPIL = 0;

    function el(id) { return document.getElementById(id); }
    function keadaan(id) { var e = el(id); return e && e.getAttribute ? e.getAttribute('data-keadaan') : null; }
    // data-lunak: keadaan dipasang timer batas lunak (bukan kejadian) → belum dihitung di bilah.
    function lunak(id) { var e = el(id); return !!(e && e.getAttribute && e.getAttribute('data-lunak') !== null); }
    function kemajuan() {
        var beres = 0;
        TAHAP.forEach(function (id) { var k = keadaan(id); if ((k === 'selesai' || k === 'lewat') && !lunak(id)) beres++; });
        var v = lanjutan ? 0.75 + 0.25 * beres / TAHAP.length : beres / TAHAP.length;
        if (layar.style && layar.style.setProperty) layar.style.setProperty('--qm-kemajuan', String(v));
    }
    function tahap(id, k, teks, olehTimer) {
        var e = el(id);
        if (!e) return;
        if (e.setAttribute) e.setAttribute('data-keadaan', k);
        if (olehTimer) { if (e.setAttribute) e.setAttribute('data-lunak', ''); }
        else if (e.removeAttribute) e.removeAttribute('data-lunak');
        if (typeof teks === 'string') {
            var t = e.querySelector ? e.querySelector('.qm-teks') : null;
            (t || e).textContent = teks;
        }
        kemajuan();
    }
    function status(teks) {
        var e = el('qiLoadStatus');
        if (e) e.textContent = teks;
    }

    // 0 — Lanjutan dari layar "Berhasil masuk" (login.html)?
    var lanjutan = null;
    try {
        var raw = sessionStorage.getItem('qi_serah_masuk');
        if (raw) {
            sessionStorage.removeItem('qi_serah_masuk');
            var s = JSON.parse(raw);
            var umur = Date.now() - (s && s.t);
            if (s && s.v === 1 && typeof s.t === 'number' && umur >= 0 && umur < 30000) lanjutan = s;
        }
    } catch (e) { lanjutan = null; }
    if (lanjutan) {
        MIN_TAMPIL = 0;   // pengguna sudah melihat layar masuk; jangan menahan lagi
        if (layar.classList) layar.classList.add('is-lanjutan');
        var judul = el('qiLoadJudul');
        if (judul) judul.textContent = lanjutan.sumber === 'sesi' ? 'Selamat datang kembali' : 'Berhasil masuk';
        var siapa = el('qiLoadSiapa');
        if (siapa && lanjutan.nama) {
            siapa.textContent = 'Masuk sebagai ' + String(lanjutan.nama).slice(0, 40) + (lanjutan.peran ? ' · ' + String(lanjutan.peran).slice(0, 8) : '');
            siapa.hidden = false;
        }
        // Baris ringkas tahapan login: "selesai" hanya bila semuanya memang terperiksa di login.html.
        if (el('qiBootMasuk')) {
            if (lanjutan.l2 === 'tak-terperiksa') tahap('qiBootMasuk', 'lewat', 'Masuk · verifikasi dua langkah tidak dapat diperiksa');
            else if (lanjutan.sumber === 'sesi' && lanjutan.l1 !== 'selesai') tahap('qiBootMasuk', 'lewat', 'Sesi lama belum dipastikan server');
            else if (lanjutan.sumber === 'sesi') tahap('qiBootMasuk', 'selesai', 'Sesi lama diverifikasi server');
            el('qiBootMasuk').hidden = false;
        }
    }
    kemajuan();

    // 1 — Sesi. Tanpa token, halaman-dashboard-awal.js langsung mengalihkan ke login.html.
    var adaSesi = false;
    try {
        adaSesi = !!(localStorage.getItem('qi_token') || sessionStorage.getItem('qi_token'));
    } catch (e) { adaSesi = false; }
    if (adaSesi) {
        tahap('qiBootSesi', 'jalan');
        status('Memverifikasi sesi…');
    } else {
        dialihkan = true;   // halaman-dashboard-awal.js langsung membuka login.html
        tahap('qiBootSesi', 'lewat', 'Belum masuk');
        status('Membuka halaman masuk…');
    }
    function sesiDiterima(e) {
        var d = (e && e.detail) || {};
        var k = keadaan('qiBootSesi');
        if (d.sah) {
            tahap('qiBootSesi', 'selesai', 'Sesi diverifikasi server');
        } else if (d.ditolak) {
            // Server menolak sesi (401 AUTH_REQUIRED / 2FA_REQUIRED): halaman-dashboard-awal.js
            // sedang membuka login.html — tutup() tidak boleh lagi mengaku "Siap".
            dialihkan = true;
            var duaLangkah = d.kode === '2FA_REQUIRED';
            tahap('qiBootSesi', 'gagal', duaLangkah ? 'Verifikasi dua langkah belum selesai' : 'Sesi sudah berakhir');
            status(duaLangkah ? 'Membuka halaman masuk…' : 'Sesi berakhir — membuka halaman masuk…');
            return;
        } else if (k !== 'selesai' && k !== 'gagal') {
            // Pemeriksaan SUDAH berakhir tanpa jawaban sah (5xx / jaringan): akses tetap dibuka, tapi
            // jangan menulis "diverifikasi di latar" — tidak ada lagi yang berjalan di latar.
            tahap('qiBootSesi', 'lewat', d.http ? 'Server belum dapat memastikan sesi' : 'Server sesi tidak terjangkau');
        }
        if (!selesai && keadaan('qiBootData') !== 'selesai') status('Menyambungkan data pasar…');
    }
    try { window.addEventListener('qi-sesi', sesiDiterima); } catch (e) {}
    if (adaSesi) {
        setTimeout(function () {
            // Batas lunak: layar tidak menunggu sesi. Labelnya benar (permintaannya memang masih
            // berjalan di latar), tapi ini timer, bukan kejadian → data-lunak, tidak memajukan bilah.
            // Jawaban yang datang kemudian tetap menandai tahap ini sesuai hasilnya.
            if (keadaan('qiBootSesi') === 'jalan') tahap('qiBootSesi', 'lewat', 'Sesi diverifikasi di latar', true);
        }, BATAS_SESI);
    }

    // 2 — Data pasar (dipicu dashboard-app.js dari api/get-chart-data.php).
    var dataMasuk = false;
    function dataDimuat() {
        if (dataMasuk || keadaan('qiBootData') !== 'tunggu') return;
        tahap('qiBootData', 'jalan');
    }
    function tandaiData() {
        if (dataMasuk) return;
        dataMasuk = true;
        tahap('qiBootData', 'selesai');
        if (!dialihkan) status('Menyiapkan terminal…');   // dialihkan: status tetap "… membuka halaman masuk…"
        tutup();
    }
    function dataGagal() {
        if (dataMasuk) return;
        tahap('qiBootData', 'lewat', 'Data pasar menyusul');
        tutup();
    }
    try {
        window.addEventListener('qi-chart-loading', dataDimuat);
        window.addEventListener('qi-chart-data', tandaiData, { once: true });
        window.addEventListener('qi-chart-gagal', dataGagal);
    } catch (e) {}

    // 3 — Tutup. Syaratnya: markup siap DAN (data pasar sudah masuk/gagal ATAU waktunya cukup).
    var domSiap = false;       // boleh menutup (DOM siap, window.load, atau pengaman)
    var domBenarSiap = false;  // DOMContentLoaded / load benar-benar terjadi
    // pengaman: batas BATAS sejak layar mulai sudah lewat — hanya saat itu layar boleh ditutup
    // ketika halaman sedang dialihkan ke login.html (tidak pernah mengurung bila pengalihan macet).
    function tutup() {
        var pengaman = Date.now() - mulai >= BATAS;
        if (selesai || !domSiap || (dialihkan && !pengaman)) return;
        selesai = true;
        var sisa = Math.max(0, MIN_TAMPIL - (Date.now() - mulai));
        setTimeout(function () {
            if (dialihkan && !pengaman) { selesai = false; return; }   // ditolak selama jeda tampil
            // Tahap yang belum tuntas TIDAK ditandai selesai. Sesi yang masih berjalan kini "lewat"
            // karena layar ditutup (kejadian nyata), jadi tanda data-lunak dilepas.
            if (keadaan('qiBootSesi') === 'jalan' || lunak('qiBootSesi')) tahap('qiBootSesi', 'lewat', 'Sesi diverifikasi di latar');
            if (keadaan('qiBootData') !== 'selesai' && keadaan('qiBootData') !== 'lewat') tahap('qiBootData', 'lewat', 'Data pasar menyusul');
            if (dialihkan) {
                // Status tetap "… membuka halaman masuk…": terminal ini tidak dibuka untuk pengguna.
                tahap('qiBootSiap', 'lewat', 'Terminal tidak dibuka');
            } else if (domBenarSiap) {
                tahap('qiBootSiap', 'selesai');
                status('Siap');
            } else {
                tahap('qiBootSiap', 'lewat', 'Terminal masih dimuat');
                status('Terminal masih dimuat…');
            }
            if (layar.classList) layar.classList.add('done');
            if (layar.setAttribute) layar.setAttribute('aria-busy', 'false');
            if (!dialihkan) {
                // Sambutan pertama kali menunggu kejadian ini — jangan dibuka untuk pengguna yang sedang dikeluarkan.
                window.__qiLayarPembukaSelesai = true;
                try { window.dispatchEvent(new CustomEvent('qi-layar-pembuka-selesai')); } catch (e) {}
            }
            setTimeout(function () { if (layar && layar.parentNode) layar.remove(); }, 420);
        }, sisa);
    }
    function domSelesai() {
        domSiap = true;
        domBenarSiap = true;
        // Dialihkan ke login.html (tanpa sesi / sesi ditolak): terminal ini tidak disiapkan untuk
        // pengguna — jangan menyalakan tahap 3 dan jangan menimpa status "… membuka halaman masuk…".
        if (!dialihkan && keadaan('qiBootSiap') === 'tunggu') tahap('qiBootSiap', 'jalan');
        if (!dialihkan && !dataMasuk && keadaan('qiBootData') !== 'lewat') status('Menyiapkan terminal…');
        // Tidak menunggu data pasar lebih dari sedetik: dashboard sudah bisa dipakai dengan
        // kerangka panel, dan menahan layar lebih lama hanya membuatnya terasa lambat.
        setTimeout(tutup, (dataMasuk || keadaan('qiBootData') === 'lewat') ? 0 : TUNGGU_DATA);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', domSelesai);
    else domSelesai();
    window.addEventListener('load', function () { domSiap = true; domBenarSiap = true; tutup(); });
    setTimeout(function () { domSiap = true; tutup(); }, BATAS);
})();
