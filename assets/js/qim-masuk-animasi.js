/* ═══════════════════════════════════════════════════════════════════════════
   QIM MASUK — layar "Berhasil masuk" di login.html (#qmLayar). Gaya: assets/css/qim-masuk.css.

   ATURAN KEJUJURAN (dikunci tests/animasi-masuk.test.js):
   - tandai() adalah SATU-SATUNYA yang mengubah tahap (li[data-keadaan]) atau bilah kemajuan
     (--qm-kemajuan = tahap selesai / jumlah tahap yang tampil). Pemanggilnya
     (assets/js/halaman-login.js) hanya menandai hal yang sudah benar-benar terjadi:
     server menerima kredensial, verifikasi dua langkah, sesi tersimpan, perpindahan halaman.
   - Tidak ada setInterval dan tidak ada tahap yang digerakkan timer. Satu-satunya timer adalah
     jeda tampil minimum di serahkan() (≤ 450 ms; 0 bila prefers-reduced-motion) supaya layar
     tidak berkedip lalu hilang. Sebelumnya login selalu menunggu 800 ms tetap.
   - Tahap terakhir ("Membuka terminal…") tetap "jalan" sampai halaman berganti — itu benar,
     karena browser memang sedang memuat halaman tujuan.

   API: window.QimMasuk = { mulai, tandai, serahkan, gagal, reset }
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
    'use strict';
    if (window.QimMasuk) return;

    var MIN_TAMPIL = 450;
    var LANGKAH = ['qmL1', 'qmL2', 'qmL3', 'qmL4'];
    var KEADAAN = { tunggu: 1, jalan: 1, selesai: 1, lewat: 1, gagal: 1 };
    var dibukaPada = 0;

    function $(id) { return document.getElementById(id); }
    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
    function gerakMinim() {
        try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
        catch (e) { return false; }
    }
    function status(teks) {
        var el = $('qmStatus');
        if (el) el.textContent = teks || '';
    }

    function perbaruiKemajuan() {
        var layar = $('qmLayar');
        if (!layar) return;
        var tampak = 0, beres = 0;
        LANGKAH.forEach(function (id) {
            var li = $(id);
            if (!li || li.hidden) return;
            tampak++;
            var k = li.getAttribute('data-keadaan');
            if (k === 'selesai' || k === 'lewat') beres++;
        });
        layar.style.setProperty('--qm-kemajuan', String(tampak ? beres / tampak : 0));
    }

    // keadaan: tunggu | jalan | selesai | lewat | gagal | sembunyi
    function tandai(id, keadaan, teks) {
        var li = $(id);
        if (!li) return;
        if (keadaan === 'sembunyi') li.hidden = true;
        else if (KEADAAN[keadaan]) { li.hidden = false; li.setAttribute('data-keadaan', keadaan); }
        if (typeof teks === 'string') {
            var t = li.querySelector('.qm-teks');
            (t || li).textContent = teks;
        }
        if (keadaan === 'jalan' && typeof teks === 'string') status(teks);
        perbaruiKemajuan();
    }

    // Latar (kepala, isi, kaki) tidak bisa difokus/diklik selama layar tampil.
    function kunciLatar(kunci) {
        [document.querySelector('.pb-kepala'), $('utama'), document.querySelector('.pb-kaki')].forEach(function (el) {
            if (!el) return;
            if (kunci) el.setAttribute('inert', '');
            else el.removeAttribute('inert');
        });
    }

    // o: { nama, peran, judul, asal (elemen tempat layar "tumbuh") }
    function mulai(o) {
        o = o || {};
        var layar = $('qmLayar');
        if (!layar) return;
        LANGKAH.forEach(function (id) { tandai(id, 'tunggu'); });
        layar.removeAttribute('data-keadaan');
        layar.setAttribute('aria-busy', 'true');
        var aksi = $('qmAksi');
        if (aksi) aksi.hidden = true;
        var judul = $('qmJudul');
        if (judul) judul.textContent = o.judul || 'Berhasil masuk';
        var siapa = $('qmSiapa');
        if (siapa) {
            var peran = String(o.peran || 'FREE');
            siapa.innerHTML = o.nama
                ? 'Masuk sebagai <b>' + esc(o.nama) + '</b> · <span class="qm-peran" data-peran="' + esc(peran.toLowerCase()) + '">' + esc(peran) + '</span>'
                : '';
            siapa.hidden = !o.nama;
        }
        status('');
        if (o.asal && o.asal.getBoundingClientRect) {
            try {
                var r = o.asal.getBoundingClientRect();
                layar.style.setProperty('--qm-x', Math.round(r.left + r.width / 2) + 'px');
                layar.style.setProperty('--qm-y', Math.round(r.top + r.height / 2) + 'px');
            } catch (e) {}
        }
        if (gerakMinim()) layar.removeAttribute('data-buka');
        else layar.setAttribute('data-buka', '');
        layar.hidden = false;
        kunciLatar(true);
        dibukaPada = Date.now();
        if (judul) { try { judul.focus({ preventScroll: true }); } catch (e) {} }
    }

    // Pindah ke halaman tujuan. s: { nama, peran, sumber, l1, l2, l3 } → sessionStorage qi_serah_masuk,
    // dibaca layar pembuka dashboard supaya tampilannya bersambung (bukan mengulang dari nol).
    // HANYA bila tujuannya dashboard.html — satu-satunya pembacanya. Untuk tujuan lain (kompetisi,
    // admin, profil, …) kunci itu akan tertinggal, lalu kunjungan dashboard berikutnya dalam 30 detik
    // mengaku "Berhasil masuk" untuk login yang tidak menuju ke sana.
    function serahkan(tujuan, s) {
        s = s || {};
        tujuan = tujuan || 'dashboard.html';
        var keDashboard = String(tujuan).split(/[?#]/)[0].split('/').pop() === 'dashboard.html';
        var tunggu = gerakMinim() ? 0 : Math.max(0, MIN_TAMPIL - (Date.now() - dibukaPada));
        function pindah() {
            try {
                if (keDashboard) {
                    sessionStorage.setItem('qi_serah_masuk', JSON.stringify({
                        v: 1, t: Date.now(), nama: s.nama || '', peran: s.peran || '', sumber: s.sumber || '',
                        l1: s.l1 || null, l2: s.l2 || null, l3: s.l3 || null
                    }));
                } else {
                    sessionStorage.removeItem('qi_serah_masuk');
                }
            } catch (e) {}
            window.location.replace(tujuan);
        }
        return new Promise(function (selesai) {
            if (tunggu <= 0) { pindah(); selesai(); return; }
            setTimeout(function () { pindah(); selesai(); }, tunggu);
        });
    }

    // Layar tetap terbuka dalam keadaan galat dengan tombol "Kembali"; tidak ada perpindahan halaman.
    function gagal(pesan) {
        var layar = $('qmLayar');
        if (!layar) return;
        if (layar.hidden) mulai({ judul: 'Belum bisa masuk' });
        layar.setAttribute('data-keadaan', 'gagal');
        layar.setAttribute('aria-busy', 'false');
        var judul = $('qmJudul');
        if (judul) judul.textContent = 'Belum bisa membuka terminal';
        status(pesan || 'Terjadi kesalahan. Silakan coba lagi.');
        var aksi = $('qmAksi');
        if (aksi) aksi.hidden = false;
        var kembali = $('qmKembali');
        if (kembali) { try { kembali.focus(); } catch (e) {} }
    }

    // Menutup layar. Bila layar tadi tampil, fokus ada di dalamnya (latar inert) dan akan hilang
    // ke <body> begitu layar disembunyikan — detail.fokus memberi tahu halaman-login.js untuk
    // mengembalikannya ke formulir (tombol asal atau isian pertama).
    function reset() {
        var layar = $('qmLayar');
        if (!layar) return;
        var tadiTampil = !layar.hidden;
        layar.hidden = true;
        layar.removeAttribute('data-buka');
        layar.removeAttribute('data-keadaan');
        layar.setAttribute('aria-busy', 'true');
        LANGKAH.forEach(function (id) { tandai(id, 'tunggu'); });
        status('');
        var aksi = $('qmAksi');
        if (aksi) aksi.hidden = true;
        kunciLatar(false);
        try { document.dispatchEvent(new CustomEvent('qm-reset', { detail: { fokus: tadiTampil } })); } catch (e) {}
    }

    var kembali = $('qmKembali');
    if (kembali) kembali.addEventListener('click', reset);

    window.QimMasuk = { mulai: mulai, tandai: tandai, serahkan: serahkan, gagal: gagal, reset: reset, MIN_TAMPIL: MIN_TAMPIL };
})();
