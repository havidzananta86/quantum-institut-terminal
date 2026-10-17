/* ═══════════════════════════════════════════════════════════════════════════
   QIM 2FA LOGIN — langkah kedua setelah kata sandi/Google benar (login.html).

   Server menandai sesi baru sebagai TERTUNDA bila akun memakai verifikasi dua langkah
   (api/_keamanan.php). QimDuaLangkah.selesaikan(token) menanyakan status sesi itu; bila
   perlu, menampilkan dialog kode (email 6 digit ATAU kode cadangan XXXX-XXXX) dan baru
   mengembalikan true setelah server menerima kodenya. Batal → false (sesi tidak dipakai).
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
    'use strict';
    if (window.QimDuaLangkah) return;

    async function api(token, metode, badan, query) {
        const r = await fetch('api/keamanan.php' + (query || ''), {
            method: metode, cache: 'no-store',
            headers: Object.assign({ Authorization: 'Bearer ' + token }, badan ? { 'Content-Type': 'application/json' } : {}),
            body: badan ? JSON.stringify(badan) : undefined
        });
        const d = await r.json().catch(() => ({}));
        d._http = r.status;
        return d;
    }

    function dialog(info) {
        const w = document.createElement('div');
        w.id = 'qim2fa';
        w.setAttribute('role', 'dialog');
        w.setAttribute('aria-modal', 'true');
        w.setAttribute('aria-labelledby', 'qim2faJudul');
        w.style.cssText = 'position:fixed;inset:0;z-index:10050;display:grid;place-items:center;padding:16px;background:rgba(2,6,15,.78)';
        w.innerHTML = '<form style="width:min(380px,100%);padding:22px;border:1px solid #22324f;border-radius:14px;background:#0b1324;color:#e3e9f3;font-family:Inter,system-ui,sans-serif;box-shadow:0 20px 60px #000c">'
            + '<h2 id="qim2faJudul" style="margin:0 0 6px;font-size:18px;color:#fff">Verifikasi dua langkah</h2>'
            + '<p style="margin:0 0 14px;color:#9aa7bb;font-size:13px;line-height:1.5">' + (info.smtp
                ? 'Kode 6 digit dikirim ke <b style="color:#fff">' + String(info.email || '').replace(/</g, '&lt;') + '</b>. Berlaku 10 menit.'
                : 'Email server sedang tidak tersedia — gunakan salah satu <b style="color:#fff">kode cadangan</b> Anda.') + '</p>'
            + '<input id="qim2faKode" autocomplete="one-time-code" inputmode="text" maxlength="9" placeholder="123456 atau ABCD-EFGH" style="width:100%;padding:12px;border:1px solid #2a3954;border-radius:9px;background:#070d19;color:#fff;font-size:18px;letter-spacing:.2em;text-align:center">'
            + '<div id="qim2faPesan" role="status" style="min-height:18px;margin:8px 0;color:#f87171;font-size:12px"></div>'
            + '<button type="submit" style="width:100%;padding:11px;border:0;border-radius:9px;background:#1677ff;color:#fff;font-weight:700;font-size:14px;cursor:pointer">Verifikasi</button>'
            + '<div style="display:flex;justify-content:space-between;margin-top:12px;font-size:12px">'
            + '<button type="button" data-a="ulang" style="border:0;background:none;color:#3ea0ff;cursor:pointer;padding:0"' + (info.smtp ? '' : ' hidden') + '>Kirim ulang kode</button>'
            + '<button type="button" data-a="batal" style="border:0;background:none;color:#9aa7bb;cursor:pointer;padding:0">Batal</button></div></form>';
        document.body.appendChild(w);
        return w;
    }

    async function selesaikan(token) {
        let info;
        try { info = await api(token, 'GET', null, '?aksi=status_login'); }
        catch (e) { return true; }                       // endpoint tidak terjangkau → biarkan alur lama (server tetap menolak bila tertunda)
        if (!info || info.status !== 'success' || !info.perlu_2fa) return true;

        return new Promise(selesai => {
            const w = dialog(info);
            const form = w.querySelector('form'), inp = w.querySelector('#qim2faKode'), pesan = w.querySelector('#qim2faPesan');
            inp.focus();
            const tutup = hasil => { w.remove(); selesai(hasil); };
            form.addEventListener('submit', async e => {
                e.preventDefault();
                const kode = inp.value.trim();
                if (!kode) return;
                pesan.style.color = '#9aa7bb'; pesan.textContent = 'Memeriksa…';
                const d = await api(token, 'POST', { aksi: 'verifikasi_login', kode }).catch(() => ({ message: 'Server tidak dapat dihubungi.' }));
                if (d.status === 'success') return tutup(true);
                pesan.style.color = '#f87171'; pesan.textContent = d.message || 'Kode tidak diterima.';
                if (d._http === 429 && /login ulang/i.test(d.message || '')) setTimeout(() => tutup(false), 1800);
                inp.select();
            });
            w.addEventListener('click', async e => {
                const a = e.target.closest('[data-a]'); if (!a) return;
                if (a.dataset.a === 'batal') return tutup(false);
                const d = await api(token, 'POST', { aksi: 'kirim_ulang' }).catch(() => ({}));
                pesan.style.color = d.status === 'success' ? '#4ade80' : '#f87171';
                pesan.textContent = d.message || (d.status === 'success' ? 'Kode baru dikirim.' : 'Gagal mengirim ulang.');
            });
            document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape' && document.body.contains(w)) { document.removeEventListener('keydown', esc); tutup(false); } });
        });
    }

    window.QimDuaLangkah = { selesaikan };
})();
