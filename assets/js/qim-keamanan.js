/* ═══════════════════════════════════════════════════════════════════════════
   QIM KEAMANAN — kartu keamanan akun di profile.html (api/keamanan.php).

   · Kartu "Verifikasi Dua Langkah" diganti dengan 2FA sungguhan: aktifkan lewat kode email,
     kode cadangan ditampilkan SEKALI, matikan dengan kata sandi atau kode cadangan.
   · Kartu "Riwayat Login" mendapat sesi saat ini + "Keluar dari semua perangkat" dan log
     aktivitas keamanan (login, 2FA gagal/aktif/nonaktif, keluar semua).
   Kartu lama tetap utuh bila endpoint/migrasi belum tersedia.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
    'use strict';

    const LABEL = {
        login: ['Login berhasil', '#4ade80'],
        login_2fa_tertunda: ['Login menunggu kode 2FA', '#fbbf24'],
        '2fa_gagal': ['Kode 2FA salah', '#f87171'],
        '2fa_aktif': ['2FA diaktifkan', '#4ade80'],
        '2fa_nonaktif': ['2FA dimatikan', '#fbbf24'],
        '2fa_matikan_gagal': ['Gagal mematikan 2FA', '#f87171'],
        keluar_semua: ['Keluar dari semua perangkat', '#93c5fd']
    };
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    const token = () => (window.QuantumAuth && QuantumAuth.getToken ? QuantumAuth.getToken() : '') || localStorage.getItem('qi_token') || sessionStorage.getItem('qi_token') || '';
    const toast = (m, ok) => (typeof window.showToast === 'function' ? window.showToast(m, ok !== false) : alert(m));
    const waktu = iso => { const d = new Date(iso); return isNaN(d) ? '—' : d.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); };
    function perangkat(ua) {
        ua = String(ua || '');
        const b = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : (ua ? 'Browser lain' : '—');
        const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
        return b + (os ? ' · ' + os : '');
    }

    async function api(metode, badan) {
        const r = await fetch('api/keamanan.php', {
            method: metode, cache: 'no-store',
            headers: Object.assign({ Authorization: 'Bearer ' + token() }, badan ? { 'Content-Type': 'application/json' } : {}),
            body: badan ? JSON.stringify(badan) : undefined
        });
        const d = await r.json().catch(() => ({ status: 'error', message: 'Respons tidak valid.' }));
        d._http = r.status;
        return d;
    }

    function kartuDari(judul) {
        const t = [...document.querySelectorAll('.section-title')].find(e => e.textContent.trim().startsWith(judul));
        return t ? t.closest('.bg-qi-card') : null;
    }

    const BTN = 'px-4 py-2 rounded-lg text-sm font-bold transition-colors';
    const INP = 'bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm outline-none';

    // ── Kartu 2FA ────────────────────────────────────────────────────────────────────
    function render2fa(kartu, d) {
        const f = d.twofa || {};
        let isi = '<div class="section-title">Verifikasi Dua Langkah</div>';
        if (f.aktif) {
            isi += '<p class="text-xs text-slate-400 mb-3 leading-relaxed"><span style="color:#4ade80;font-weight:700">● Aktif</span>'
                + (f.sejak ? ' sejak ' + esc(waktu(f.sejak)) : '')
                + '. Setiap login meminta kode 6 digit yang dikirim ke email Anda. Kode cadangan tersisa: <b class="text-white">' + (f.sisa_cadangan | 0) + '</b>.</p>'
                + (f.sisa_cadangan < 3 ? '<p class="text-[11px] mb-3" style="color:#fbbf24">Kode cadangan hampir habis — matikan lalu aktifkan lagi untuk membuat 10 kode baru.</p>' : '')
                + '<details><summary class="text-xs text-slate-400 cursor-pointer hover:text-white">Matikan verifikasi dua langkah</summary>'
                + '<div class="flex flex-wrap gap-2 mt-3"><input id="qkSandi" type="password" autocomplete="current-password" placeholder="Kata sandi atau kode cadangan" class="flex-1 ' + INP + '">'
                + '<button data-k="matikan" class="' + BTN + ' bg-slate-800 text-slate-200 hover:bg-slate-700">Matikan</button></div></details>';
        } else {
            isi += '<p class="text-xs text-slate-400 mb-4 leading-relaxed">Lindungi akun dengan kode 6 digit yang dikirim ke email setiap kali login. '
                + 'Orang yang tahu kata sandi Anda tetap tidak bisa masuk — dan tidak bisa mengeluarkan Anda dari perangkat ini.</p>';
            if (!f.smtp) isi += '<p class="text-[11px]" style="color:#fbbf24">Email server (SMTP) belum diatur oleh admin, jadi 2FA lewat email belum bisa diaktifkan.</p>';
            else isi += '<button data-k="mulai" class="' + BTN + ' bg-qi-purple text-white hover:bg-qi-purple/80">Aktifkan — kirim kode</button>'
                + '<div id="qkSetup" class="hidden mt-3"><div class="flex gap-2"><input id="qkKode" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="6 digit kode dari email" class="flex-1 ' + INP + ' tracking-widest text-center font-mono">'
                + '<button data-k="aktifkan" class="' + BTN + ' bg-qi-green text-slate-950 hover:bg-qi-green/80">Verifikasi</button></div></div>';
        }
        isi += '<div id="qkPesan" role="status" class="mt-2 text-[11px] text-slate-400"></div><div id="qkCadangan"></div>';
        kartu.innerHTML = isi;
    }

    function tampilCadangan(kode) {
        const el = document.getElementById('qkCadangan');
        if (!el) return;
        el.innerHTML = '<div class="mt-3 p-3 rounded-lg border" style="border-color:rgba(74,222,128,.35);background:rgba(74,222,128,.08)">'
            + '<div class="text-[11px] font-semibold mb-2" style="color:#4ade80">Kode cadangan — simpan sekarang, hanya ditampilkan sekali. Tiap kode berlaku satu kali bila email tidak bisa diakses.</div>'
            + '<div class="grid grid-cols-2 gap-1 font-mono text-sm text-white">' + kode.map(k => '<span>' + esc(k) + '</span>').join('') + '</div>'
            + '<button data-k="salin" class="mt-2 text-xs text-slate-300 hover:text-white">Salin semua</button> · <button data-k="selesai" class="mt-2 text-xs text-slate-300 hover:text-white">Sudah saya simpan</button></div>';
        el.dataset.kode = kode.join('\n');
    }

    // ── Kartu sesi + log aktivitas ──────────────────────────────────────────────────
    function renderSesi(kartu, d) {
        let blok = document.getElementById('qkSesi');
        if (!blok) {
            blok = document.createElement('div');
            blok.id = 'qkSesi';
            const head = kartu.firstElementChild;
            head.after(blok);
        }
        const s = d.sesi || {};
        blok.innerHTML = '<div class="flex flex-wrap items-center justify-between gap-2 bg-slate-900/60 rounded-lg px-3 py-2 mb-3 border text-xs" style="border-color:rgba(34,211,238,.2)">'
            + '<div><div class="text-white">' + esc(perangkat(s.user_agent)) + ' <span class="text-qi-cyan text-[10px]">(sesi ini)</span></div>'
            + '<div class="text-slate-500 text-[10px]">' + esc(s.ip_address || '—') + ' · masuk ' + esc(s.masuk ? waktu(s.masuk) : '—') + '</div></div>'
            + '<button data-k="keluar" class="text-[11px] px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700">Keluar dari semua perangkat</button></div>'
            + '<p class="text-[10px] text-slate-500 mb-3">' + (d.satu_sesi
                ? 'Akun ini hanya bisa aktif di satu perangkat: login baru otomatis mengakhiri sesi lama'
                : 'Akun ini bisa aktif di maksimal ' + (d.sesi_maks | 0) + ' perangkat (' + (d.sesi_aktif | 0) + ' aktif sekarang): login baru mengakhiri sesi terlama')
            + (d.twofa && d.twofa.aktif ? ' — setelah kode 2FA benar.' : '.') + '</p>';

        // Perangkat lain yang masih login (api/keamanan.php → sesi_lain).
        const lain = d.sesi_lain || [];
        if (lain.length) {
            blok.insertAdjacentHTML('beforeend', '<div class="text-[11px] font-semibold text-slate-300 mb-1">Perangkat lain yang masih login</div>'
                + lain.map(o => '<div class="flex items-center justify-between gap-2 bg-slate-900/60 rounded-lg px-3 py-2 mb-2 text-xs">'
                    + '<div><div class="text-white">' + esc(perangkat(o.user_agent))
                    + (o.menunggu_2fa ? ' <span class="text-[10px]" style="color:#fbbf24">(menunggu kode 2FA)</span>' : '') + '</div>'
                    + '<div class="text-slate-500 text-[10px]">' + esc(o.ip_address || '—') + ' · masuk ' + esc(o.masuk ? waktu(o.masuk) : '—') + '</div></div></div>').join('')
                + '<p class="text-[10px] text-slate-500 mb-3">Tidak mengenali perangkat di atas? Tekan "Keluar dari semua perangkat" lalu ganti kata sandi.</p>');
        }
        const tunggu = kartu.querySelector('[data-qk-tunggu]');
        if (tunggu) tunggu.remove();
        const segar = [...kartu.querySelectorAll('button')].find(b => /Refresh/.test(b.textContent));
        if (segar) segar.onclick = () => muat();

        let log = document.getElementById('qkLog');
        if (!log) {
            log = document.createElement('div');
            log.id = 'qkLog';
            log.className = 'mt-1';
            kartu.appendChild(log);
        }
        const baris = (d.log || []).slice(0, 15).map(r => {
            const [nama, warna] = LABEL[r.event] || [r.event, '#94a3b8'];
            return '<div class="flex items-start justify-between gap-3 py-1.5 border-b border-slate-800 text-[11px]">'
                + '<div><span style="color:' + warna + '">●</span> <span class="text-white">' + esc(nama) + '</span>'
                + (r.detail ? ' <span class="text-slate-500">— ' + esc(r.detail) + '</span>' : '')
                + '<div class="text-slate-500 text-[10px]">' + esc(perangkat(r.user_agent)) + ' · ' + esc(r.ip || '—') + '</div></div>'
                + '<span class="text-slate-500 text-[10px] whitespace-nowrap">' + esc(waktu(r.waktu)) + '</span></div>';
        }).join('');
        log.innerHTML = '<div class="text-[11px] font-semibold text-slate-300 mb-1">Aktivitas keamanan &amp; login</div>'
            + (baris || '<div class="text-slate-600 text-center py-3 text-xs">Belum ada aktivitas tercatat.</div>');
    }

    let kartu2fa = null, kartuSesi = null;
    async function muat() {
        const d = await api('GET').catch(() => null);
        if (!d || d.status !== 'success') {
            // Backend belum siap (mis. migrasi 020 belum dijalankan): katakan apa adanya, jangan "Memuat…" selamanya.
            const pesan = (d && d.message) || 'Pengaturan keamanan tidak dapat dimuat. Coba muat ulang halaman.';
            const p = kartu2fa && kartu2fa.querySelector('p');
            if (p) p.textContent = pesan;
            const t = kartuSesi && kartuSesi.querySelector('[data-qk-tunggu]');
            if (t) t.textContent = pesan;
            return;
        }
        if (kartu2fa) render2fa(kartu2fa, d);
        if (kartuSesi) renderSesi(kartuSesi, d);
    }

    async function aksi(k, tombol) {
        const pesan = document.getElementById('qkPesan');
        const tulis = (m, ok) => { if (pesan) { pesan.textContent = m; pesan.style.color = ok ? '#4ade80' : '#f87171'; } };
        tombol.disabled = true;
        try {
            if (k === 'mulai') {
                const d = await api('POST', { aksi: '2fa_mulai' });
                tulis(d.message || (d.status === 'success' ? 'Kode dikirim.' : 'Gagal mengirim kode.'), d.status === 'success');
                if (d.status === 'success') { document.getElementById('qkSetup').classList.remove('hidden'); document.getElementById('qkKode').focus(); tombol.textContent = 'Kirim ulang kode'; }
            } else if (k === 'aktifkan') {
                const d = await api('POST', { aksi: '2fa_aktifkan', kode: document.getElementById('qkKode').value.trim() });
                if (d.status !== 'success') return tulis(d.message || 'Kode tidak diterima.', false);
                toast('Verifikasi dua langkah aktif');
                await muat();
                tampilCadangan(d.kode_cadangan || []);
                document.getElementById('qkPesan').textContent = '';
            } else if (k === 'matikan') {
                const v = document.getElementById('qkSandi').value;
                if (!v) return tulis('Masukkan kata sandi atau kode cadangan.', false);
                const badan = /^[A-Za-z0-9]{4}-?[A-Za-z0-9]{4}$/.test(v.trim()) ? { aksi: '2fa_matikan', kode: v.trim(), password: v } : { aksi: '2fa_matikan', password: v };
                const d = await api('POST', badan);
                if (d.status !== 'success') return tulis(d.message || 'Gagal.', false);
                toast('Verifikasi dua langkah dimatikan');
                await muat();
            } else if (k === 'salin') {
                const el = document.getElementById('qkCadangan');
                await navigator.clipboard.writeText(el.dataset.kode || '').then(() => toast('Kode cadangan disalin'), () => toast('Salin manual dari daftar', false));
            } else if (k === 'selesai') {
                document.getElementById('qkCadangan').innerHTML = '';
            } else if (k === 'keluar') {
                if (!confirm('Akhiri sesi di semua perangkat, termasuk yang ini?')) return;
                const d = await api('POST', { aksi: 'keluar_semua' });
                if (d.status !== 'success') return toast(d.message || 'Gagal mengakhiri sesi', false);
                ['qi_token', 'qi_user'].forEach(x => { try { localStorage.removeItem(x); sessionStorage.removeItem(x); } catch (e) {} });
                location.href = 'login.html';
            }
        } catch (e) {
            tulis('Server tidak dapat dihubungi.', false);
        } finally {
            tombol.disabled = false;
        }
    }

    function mulai() {
        kartu2fa = kartuDari('Verifikasi Dua Langkah');
        kartuSesi = kartuDari('Riwayat Login');
        [kartu2fa, kartuSesi].forEach(k => k && k.addEventListener('click', e => {
            const b = e.target.closest('[data-k]');
            if (b) { e.preventDefault(); aksi(b.dataset.k, b); }
        }));
        if (kartu2fa) kartu2fa.addEventListener('keydown', e => {
            if (e.key !== 'Enter') return;
            if (e.target.id === 'qkKode') kartu2fa.querySelector('[data-k="aktifkan"]').click();
            if (e.target.id === 'qkSandi') kartu2fa.querySelector('[data-k="matikan"]').click();
        });
        muat();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mulai); else mulai();
    window.QimKeamanan = { muat };
})();
