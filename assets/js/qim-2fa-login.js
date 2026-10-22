/* ═══════════════════════════════════════════════════════════════════════════
   QIM 2FA LOGIN — langkah kedua setelah kata sandi/Google benar (login.html).

   Server menandai sesi baru sebagai TERTUNDA bila akun memakai verifikasi dua langkah
   (api/_keamanan.php). QimDuaLangkah.selesaikan(token) menanyakan status sesi itu; bila
   perlu, menampilkan dialog kode (email 6 digit ATAU kode cadangan XXXX-XXXX).

   Hasil: { ok, perlu2fa }
     perlu2fa false → akun tanpa verifikasi dua langkah            → ok true
     perlu2fa true  → kode diterima server (ok true) / dibatalkan (ok false)
     perlu2fa null  → status tidak dapat diperiksa (batas 4 detik, diulang sekali) → ok true;
                      layar masuk menuliskannya apa adanya ("tidak dapat diperiksa") dan server
                      tetap menolak sesi yang masih tertunda.
   Gaya dialog: kelas .qm-dialog di assets/css/qim-masuk.css (tanpa atribut style).
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
    'use strict';
    if (window.QimDuaLangkah) return;

    var BATAS_STATUS = 4000;     // status_login: pembacaan ringan
    var BATAS_KIRIM = 12000;     // verifikasi / kirim ulang (bisa mengirim email)

    function sinyal(ms) {
        if (window.QuantumAuth && typeof window.QuantumAuth.batasWaktu === 'function') return window.QuantumAuth.batasWaktu(ms);
        try { if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') return AbortSignal.timeout(ms); } catch (e) {}
        return undefined;
    }
    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    async function api(token, metode, badan, query, batas) {
        var r = await fetch('api/keamanan.php' + (query || ''), {
            method: metode, cache: 'no-store',
            headers: Object.assign({ Authorization: 'Bearer ' + token }, badan ? { 'Content-Type': 'application/json' } : {}),
            body: badan ? JSON.stringify(badan) : undefined,
            signal: sinyal(batas || BATAS_KIRIM)
        });
        var d = await r.json().catch(function () { return {}; });
        d._http = r.status;
        return d;
    }

    // status_login dengan batas 4 detik dan SATU kali ulang. null = tidak dapat diperiksa.
    async function bacaStatus(token) {
        for (var coba = 0; coba < 2; coba++) {
            try {
                var info = await api(token, 'GET', null, '?aksi=status_login', BATAS_STATUS);
                if (info && info.status === 'success') return info;
                if (info && info._http >= 400 && info._http < 500) return null;   // jawaban pasti; mengulang tidak membantu
            } catch (e) { /* jaringan / batas waktu → ulang sekali */ }
        }
        return null;
    }

    function dialog(info) {
        var w = document.createElement('div');
        w.id = 'qim2fa';
        w.className = 'qm-dialog';
        w.setAttribute('role', 'dialog');
        w.setAttribute('aria-modal', 'true');
        w.setAttribute('aria-labelledby', 'qim2faJudul');
        w.setAttribute('aria-describedby', 'qim2faKet');
        w.innerHTML = '<form class="qm-dialog-kartu" novalidate>'
            + '<h2 id="qim2faJudul">Verifikasi dua langkah</h2>'
            + '<p id="qim2faKet" class="qm-dialog-ket">' + (info.smtp
                ? 'Kode 6 digit dikirim ke <b>' + esc(info.email) + '</b>. Berlaku 10 menit.'
                : 'Email server sedang tidak tersedia — gunakan salah satu <b>kode cadangan</b> Anda.') + '</p>'
            + '<label for="qim2faKode" class="qi-sr-only">Kode verifikasi</label>'
            + '<input id="qim2faKode" class="qm-dialog-kode" autocomplete="one-time-code" inputmode="text" maxlength="9" placeholder="123456 atau ABCD-EFGH">'
            + '<div id="qim2faPesan" class="qm-dialog-pesan" role="status" aria-live="polite"></div>'
            + '<button type="submit" class="pb-tombol pb-tombol--utama pb-tombol--penuh">Verifikasi</button>'
            + '<div class="qm-dialog-baris">'
            + '<button type="button" data-a="ulang" class="qm-dialog-tautan"' + (info.smtp ? '' : ' hidden') + '>Kirim ulang kode</button>'
            + '<button type="button" data-a="batal" class="qm-dialog-tautan qm-dialog-tautan--redup">Batal</button></div></form>';
        document.body.appendChild(w);
        return w;
    }

    function mintaKode(token, info) {
        return new Promise(function (selesai) {
            var sebelum = document.activeElement;          // tombol "Masuk" — fokus kembali ke sana bila batal
            var w = dialog(info);
            var form = w.querySelector('form'), inp = w.querySelector('#qim2faKode'), pesan = w.querySelector('#qim2faPesan');
            var sibuk = false, tertutup = false;
            function tulis(teks, jenis) { pesan.textContent = teks || ''; pesan.setAttribute('data-jenis', jenis || 'info'); }
            function tutup(hasil) {
                if (tertutup) return;
                tertutup = true;
                document.removeEventListener('keydown', kunciTombol, true);
                w.remove();
                if (!hasil && sebelum && typeof sebelum.focus === 'function') { try { sebelum.focus(); } catch (e) {} }
                selesai(hasil);
            }
            // Esc membatalkan; Tab berputar di dalam dialog (fokus tidak lari ke halaman di belakangnya).
            function kunciTombol(e) {
                if (!document.body.contains(w)) return;
                if (e.key === 'Escape') { e.preventDefault(); tutup(false); return; }
                if (e.key !== 'Tab') return;
                var bisa = Array.prototype.filter.call(w.querySelectorAll('input, button'), function (el) { return !el.hidden && !el.disabled; });
                if (!bisa.length) return;
                var awal = bisa[0], akhir = bisa[bisa.length - 1];
                if (e.shiftKey && document.activeElement === awal) { e.preventDefault(); akhir.focus(); }
                else if (!e.shiftKey && document.activeElement === akhir) { e.preventDefault(); awal.focus(); }
                else if (!w.contains(document.activeElement)) { e.preventDefault(); awal.focus(); }
            }
            document.addEventListener('keydown', kunciTombol, true);
            inp.focus();

            form.addEventListener('submit', async function (e) {
                e.preventDefault();
                if (sibuk) return;
                var kode = inp.value.trim();
                if (!kode) { tulis('Masukkan kode verifikasi dulu.', 'galat'); inp.focus(); return; }
                sibuk = true;
                tulis('Memeriksa kode…', 'info');
                var d = await api(token, 'POST', { aksi: 'verifikasi_login', kode: kode }).catch(function () { return { message: 'Server tidak dapat dihubungi. Coba lagi.' }; });
                sibuk = false;
                if (d.status === 'success') return tutup(true);
                tulis(d.message || 'Kode tidak diterima.', 'galat');
                if (d._http === 429 && /login ulang/i.test(d.message || '')) setTimeout(function () { tutup(false); }, 1800);
                inp.select();
            });
            w.addEventListener('click', async function (e) {
                var a = e.target.closest('[data-a]');
                if (!a) return;
                if (a.dataset.a === 'batal') return tutup(false);
                tulis('Mengirim kode baru…', 'info');
                var d = await api(token, 'POST', { aksi: 'kirim_ulang' }).catch(function () { return {}; });
                tulis(d.message || (d.status === 'success' ? 'Kode baru dikirim.' : 'Gagal mengirim ulang.'), d.status === 'success' ? 'ok' : 'galat');
            });
        });
    }

    async function selesaikan(token) {
        var info = await bacaStatus(token);
        if (!info) return { ok: true, perlu2fa: null };
        if (!info.perlu_2fa) return { ok: true, perlu2fa: false };
        var diterima = await mintaKode(token, info);
        return { ok: !!diterima, perlu2fa: true };
    }

    window.QimDuaLangkah = { selesaikan: selesaikan };
})();
