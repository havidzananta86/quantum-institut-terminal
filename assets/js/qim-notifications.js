/* ═══════════════════════════════════════════════════════════════════════════
   QIM NOTIFIKASI SINYAL (Fase 2) — pengaturan kanal per pengguna + notifikasi desktop.

   · Kartu "Notifikasi Sinyal" disisipkan sendiri ke panel Akun (setelah kartu Telegram
     admin bila ada), jadi dashboard.html cukup memuat berkas ini.
   · Telegram / Discord / Slack / Email dikirim SERVER saat sinyal tercatat
     (api/_notif.php). Peramban hanya mengatur dan menguji lewat api/notifikasi-setelan.php.
   · URL webhook tidak pernah dikirim balik oleh server; kolomnya selalu kosong dan hanya
     menampilkan petunjuk (mis. "discord.com/…/abcd"). Kolom kosong = biarkan yang tersimpan.
   · Notifikasi desktop: peramban menarik sinyal terbaru tiap 30 detik (60 detik saat tab
     tersembunyi) dan menampilkan Notification untuk id yang belum pernah dilihat. Id terakhir
     disimpan di localStorage dan dipakai sebagai `tag`, jadi beberapa tab tidak memunculkan
     notifikasi ganda. Ini MENGGANTIKAN checkNewSignals() lama di pro-features.js yang
     membandingkan jumlah rekor (macet setelah rekor mencapai batas 500).
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
    'use strict';
    if (window.QimNotif) return;

    var API = 'api/notifikasi-setelan.php';
    var KUNCI_TERAKHIR = 'qim_notif_sinyal_terakhir';
    var state = { setelan: null, server: null, timer: null };

    function token() {
        try {
            return (typeof QuantumAuth !== 'undefined' && QuantumAuth.getToken)
                ? QuantumAuth.getToken()
                : (localStorage.getItem('qi_token') || sessionStorage.getItem('qi_token'));
        } catch (e) { return null; }
    }
    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
    function $(id) { return document.getElementById(id); }
    function simpanLokal(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
    function bacaLokal(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }

    async function api(metode, badan, query, url) {
        var opsi = { method: metode, cache: 'no-store', headers: {} };
        var t = token();
        if (t) opsi.headers.Authorization = 'Bearer ' + t;
        if (badan) { opsi.headers['Content-Type'] = 'application/json'; opsi.body = JSON.stringify(badan); }
        var res = await fetch((url || API) + (query || ''), opsi);
        var d = await res.json().catch(function () { return {}; });
        d._http = res.status;
        return d;
    }

    // ── KARTU PENGATURAN ────────────────────────────────────────────────────────
    var BARIS = [
        { k: 'telegram', judul: 'Telegram', ket: 'Bot server mengirim ke chat id Anda. Kirim /start ke bot lebih dulu.', input: 'text', ph: '123456789 atau @nama_kanal' },
        { k: 'discord', judul: 'Discord', ket: 'Pengaturan Kanal → Integrasi → Webhook → Salin URL Webhook.', input: 'password', ph: 'https://discord.com/api/webhooks/…' },
        { k: 'slack', judul: 'Slack', ket: 'Aplikasi Slack → Incoming Webhooks → Add New Webhook → Copy.', input: 'password', ph: 'https://hooks.slack.com/services/…' },
        { k: 'email', judul: 'Email', ket: 'Dikirim ke alamat akun Anda.', input: null },
        { k: 'desktop', judul: 'Desktop', ket: 'Notifikasi peramban selama dashboard terbuka (boleh di tab lain).', input: null }
    ];

    function buatKartu() {
        if ($('qimNotifKartu')) return $('qimNotifKartu');
        var induk = $('tgKartu');
        var kartu = document.createElement('section');
        kartu.id = 'qimNotifKartu';
        kartu.className = 'mt-4 rounded-xl border border-qi-border bg-black/20 p-4';
        kartu.setAttribute('aria-labelledby', 'qimNotifJudul');

        var baris = BARIS.map(function (b) {
            var masukan = '';
            if (b.input) {
                masukan = '<input id="qimNotif_' + b.k + '_in" type="' + b.input + '" autocomplete="off" spellcheck="false" placeholder="' + esc(b.ph) + '"'
                    + ' class="mt-1 w-full rounded border border-qi-border bg-qi-bg px-2 py-2 text-[10px] text-white">';
            }
            var hapus = (b.k === 'discord' || b.k === 'slack')
                ? ' <button type="button" data-hapus="' + b.k + '" class="hidden rounded-lg border border-qi-border px-3 py-2 text-[10px] font-semibold text-slate-300 hover:text-white">Hapus URL</button>'
                : '';
            var izin = b.k === 'desktop'
                ? ' <button type="button" id="qimNotifIzin" class="rounded-lg border border-qi-cyan/40 bg-qi-cyan/10 px-3 py-2 text-[10px] font-semibold text-qi-cyan hover:bg-qi-cyan/20">Izinkan di peramban</button>'
                  + ' <button type="button" id="qimPushBtn" class="hidden rounded-lg border border-qi-cyan/40 bg-qi-cyan/10 px-3 py-2 text-[10px] font-semibold text-qi-cyan hover:bg-qi-cyan/20">Aktifkan push (tab tertutup)</button>'
                  + ' <button type="button" id="qimPushUji" class="hidden rounded-lg border border-qi-border px-3 py-2 text-[10px] font-semibold text-slate-300 hover:text-white">Uji push</button>'
                  + ' <span id="qimPushInfo" class="text-[10px] text-slate-500"></span>'
                : '';
            return '<div class="rounded border border-qi-border bg-black/20 p-2">'
                + '<div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">'
                + '<label class="flex items-start gap-2 text-[11px] text-white"><input id="qimNotif_' + b.k + '_on" type="checkbox" class="mt-1">'
                + '<span><span class="font-bold">' + b.judul + '</span><span class="mt-1 block text-[10px] text-slate-400">' + esc(b.ket) + '</span></span></label>'
                + '<span id="qimNotif_' + b.k + '_st" class="shrink-0 rounded-full border border-qi-border px-2 py-0.5 text-[10px] font-mono text-slate-400">—</span>'
                + '</div>' + masukan
                + '<div id="qimNotif_' + b.k + '_cat" class="mt-1 text-[10px] leading-relaxed text-slate-500"></div>'
                + (hapus || izin ? '<div class="mt-2 flex flex-wrap items-center gap-2">' + hapus + izin + '</div>' : '')
                + '</div>';
        }).join('');

        kartu.innerHTML =
            '<div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div>'
            + '<h3 id="qimNotifJudul" class="text-sm font-bold text-white">Notifikasi Sinyal</h3>'
            + '<p class="mt-1 text-[11px] text-slate-400">Setiap sinyal baru (entry, SL, TP, grade) dikirim ke semua kanal yang Anda aktifkan.</p>'
            + '</div><span id="qimNotifBadge" class="shrink-0 rounded-full border border-qi-border px-2 py-0.5 text-[10px] font-mono text-slate-400">memuat…</span></div>'
            + '<div class="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">' + baris + '</div>'
            + '<div class="mt-3 flex flex-wrap items-center gap-2">'
            + '<button type="button" id="qimNotifSimpan" class="rounded-lg border border-qi-cyan/40 bg-qi-cyan/10 px-3 py-2 text-[10px] font-semibold text-qi-cyan hover:bg-qi-cyan/20">Simpan</button>'
            + '<button type="button" id="qimNotifUji" class="rounded-lg border border-qi-green/40 bg-qi-green/10 px-3 py-2 text-[10px] font-semibold text-qi-green hover:bg-qi-green/20">Kirim Uji ke Semua Kanal</button>'
            + '<span id="qimNotifHasil" role="status" class="text-[10px] font-mono text-slate-400"></span></div>'
            + '<div id="qimNotifUjiHasil" class="mt-2 space-y-1 text-[10px] font-mono"></div>'
            + '<details class="mt-3 rounded border border-qi-border bg-black/20 p-2"><summary class="cursor-pointer text-[10px] font-semibold text-qi-cyan">Riwayat pengiriman terakhir</summary>'
            + '<div id="qimNotifRiwayat" class="mt-2 space-y-1 text-[10px] font-mono text-slate-400"></div></details>'
            + '<p class="mt-2 text-[10px] leading-relaxed text-slate-500">URL webhook disimpan terenkripsi dan tidak pernah ditampilkan kembali. Kosongkan kolom untuk mempertahankan URL yang tersimpan. Sinyal bukan jaminan menang.</p>';

        // Disisipkan sebagai bagian tersendiri dari panel Akun, tepat setelah blok yang memuat
        // kartu Telegram admin. Bukan DI DALAM blok itu: blok tersebut (penyiapan bridge MT)
        // tersembunyi bagi pengguna yang belum menyambungkan terminal.
        var panel = $('panel-account') || $('panel-alerts');
        if (!panel) return null;
        kartu.className = 'rounded-xl border border-qi-border bg-qi-panel p-4';
        var jangkar = induk;
        while (jangkar && jangkar.parentElement !== panel) jangkar = jangkar.parentElement;
        if (jangkar) jangkar.insertAdjacentElement('afterend', kartu);
        else panel.appendChild(kartu);

        $('qimNotifSimpan').addEventListener('click', function () { simpan(); });
        $('qimNotifUji').addEventListener('click', function () { uji(); });
        $('qimNotifIzin').addEventListener('click', mintaIzin);
        $('qimPushBtn').addEventListener('click', alihPush);
        $('qimPushUji').addEventListener('click', ujiPush);
        tampilkanPush();
        Array.prototype.forEach.call(kartu.querySelectorAll('[data-hapus]'), function (b) {
            b.addEventListener('click', function () {
                var k = b.getAttribute('data-hapus');
                if (!confirm('Hapus URL webhook ' + k + ' yang tersimpan?')) return;
                var badan = {}; badan[k + '_hapus'] = true;
                simpan(badan);
            });
        });
        return kartu;
    }

    function chip(el, teks, warna) {
        if (!el) return;
        el.textContent = teks;
        var kelas = {
            hijau: 'border-qi-green/40 bg-qi-green/10 text-qi-green',
            kuning: 'border-amber-400/40 bg-amber-400/10 text-amber-300',
            merah: 'border-qi-red/40 bg-qi-red/10 text-qi-red',
            abu: 'border-qi-border text-slate-400'
        }[warna || 'abu'];
        el.className = 'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-mono ' + kelas;
    }

    function tampilkan(d) {
        if (!d || !d.setelan) return;
        state.setelan = d.setelan;
        state.server = d.server || {};
        var s = d.setelan, srv = state.server, aktifN = 0;

        BARIS.forEach(function (b) {
            var on = $('qimNotif_' + b.k + '_on');
            var v = s[b.k] || {};
            if (on) on.checked = !!v.aktif;
            if (v.aktif) aktifN++;
        });

        var tg = $('qimNotif_telegram_in');
        if (tg && document.activeElement !== tg) tg.value = s.telegram.chat_id || '';
        var tgSiap = srv.telegram && srv.telegram.siap;
        chip($('qimNotif_telegram_st'), s.telegram.aktif ? (tgSiap ? 'AKTIF' : 'BOT BELUM SIAP') : 'MATI', s.telegram.aktif ? (tgSiap ? 'hijau' : 'kuning') : 'abu');
        $('qimNotif_telegram_cat').textContent = tgSiap ? '' : (srv.telegram ? srv.telegram.catatan : '');

        ['discord', 'slack'].forEach(function (k) {
            var v = s[k];
            var inp = $('qimNotif_' + k + '_in');
            if (inp) {
                inp.value = '';
                inp.placeholder = v.tersimpan ? ('Tersimpan: ' + v.petunjuk + ' — tempel URL baru untuk mengganti') : BARIS.filter(function (b) { return b.k === k; })[0].ph;
            }
            chip($('qimNotif_' + k + '_st'), v.aktif ? 'AKTIF' : (v.tersimpan ? 'TERSIMPAN · MATI' : 'MATI'), v.aktif ? 'hijau' : 'abu');
            $('qimNotif_' + k + '_cat').textContent = v.tersimpan ? ('URL tersimpan: ' + v.petunjuk) : 'Belum ada URL tersimpan.';
            var tombol = document.querySelector('[data-hapus="' + k + '"]');
            if (tombol) tombol.classList.toggle('hidden', !v.tersimpan);
        });

        var smtp = srv.email && srv.email.siap;
        chip($('qimNotif_email_st'), s.email.aktif ? (smtp ? 'AKTIF' : 'SMTP BELUM SIAP') : 'MATI', s.email.aktif ? (smtp ? 'hijau' : 'kuning') : 'abu');
        $('qimNotif_email_cat').textContent = 'Ke: ' + (s.email.alamat || '—') + (smtp ? '' : ' · ' + (srv.email ? srv.email.catatan : ''));

        tampilkanDesktop();
        chip($('qimNotifBadge'), aktifN ? (aktifN + ' KANAL AKTIF') : 'SEMUA MATI', aktifN ? 'hijau' : 'kuning');

        var r = $('qimNotifRiwayat');
        if (r) {
            r.innerHTML = (d.riwayat || []).length ? d.riwayat.map(function (x) {
                var w = x.ok === null ? 'text-slate-400' : (x.ok ? 'text-qi-green' : 'text-qi-red');
                return '<div class="' + w + '">' + (x.ok === null ? '…' : (x.ok ? '✓' : '✗')) + ' ' + esc(x.waktu) + ' · ' + esc(x.kanal)
                    + ' · ' + esc(x.sinyal) + ' — <span class="text-slate-400">' + esc(x.catatan) + '</span></div>';
            }).join('') : '<div>Belum ada kiriman.</div>';
        }
    }

    function tampilkanDesktop() {
        var s = state.setelan;
        if (!s) return;
        var dukung = 'Notification' in window;
        var izin = dukung ? Notification.permission : 'unsupported';
        var tombol = $('qimNotifIzin');
        if (tombol) tombol.classList.toggle('hidden', !dukung || izin !== 'default');
        var teks, warna;
        if (!dukung) { teks = 'TAK DIDUKUNG'; warna = 'abu'; }
        else if (!s.desktop.aktif) { teks = 'MATI'; warna = 'abu'; }
        else if (izin === 'granted') { teks = 'AKTIF'; warna = 'hijau'; }
        else if (izin === 'denied') { teks = 'DIBLOKIR PERAMBAN'; warna = 'merah'; }
        else { teks = 'PERLU IZIN'; warna = 'kuning'; }
        chip($('qimNotif_desktop_st'), teks, warna);
        $('qimNotif_desktop_cat').textContent = izin === 'denied'
            ? 'Izin notifikasi diblokir. Buka ikon gembok di bilah alamat → Notifikasi → Izinkan.'
            : (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1'
                ? 'Peramban hanya mengizinkan notifikasi di HTTPS.' : '');
    }

    // ── Web Push: notifikasi tetap muncul walau tab ditutup (api/push.php + sw.js) ──
    var pushDukung = ('serviceWorker' in navigator) && ('PushManager' in window) && ('Notification' in window);
    function urlB64KeUint8(b64) {
        var pad = '='.repeat((4 - b64.length % 4) % 4);
        var raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
        var out = new Uint8Array(raw.length);
        for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
        return out;
    }
    async function langgananKini() {
        if (!pushDukung) return null;
        var reg = await navigator.serviceWorker.getRegistration();
        return reg ? reg.pushManager.getSubscription() : null;
    }
    async function tampilkanPush() {
        var btn = $('qimPushBtn'), ujiB = $('qimPushUji'), info = $('qimPushInfo');
        if (!btn) return;
        if (!pushDukung) { btn.classList.add('hidden'); if (info) info.textContent = 'Push tidak didukung peramban ini.'; return; }
        var sub = null;
        try { sub = await langgananKini(); } catch (e) {}
        btn.classList.remove('hidden');
        btn.textContent = sub ? 'Matikan push di perangkat ini' : 'Aktifkan push (tab tertutup)';
        btn.dataset.aktif = sub ? '1' : '0';
        if (ujiB) ujiB.classList.toggle('hidden', !sub);
        if (info) info.textContent = sub ? 'Push aktif di perangkat ini.' : '';
    }
    async function alihPush() {
        var info = $('qimPushInfo');
        try {
            if ($('qimPushBtn').dataset.aktif === '1') {
                var lama = await langgananKini();
                if (lama) { await api('POST', { aksi: 'hapus', endpoint: lama.endpoint }, '', 'api/push.php'); await lama.unsubscribe(); }
                await tampilkanPush();
                return;
            }
            if (Notification.permission !== 'granted') await Notification.requestPermission();
            if (Notification.permission !== 'granted') { if (info) info.textContent = 'Izin notifikasi belum diberikan.'; tampilkanDesktop(); return; }
            var k = await api('GET', null, '', 'api/push.php');
            if (k._http !== 200 || !k.publicKey) throw new Error(k.message || 'kunci push tidak tersedia');
            var reg = await navigator.serviceWorker.getRegistration() || await navigator.serviceWorker.register('sw.js');
            await navigator.serviceWorker.ready;
            var sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64KeUint8(k.publicKey) });
            var d = await api('POST', { aksi: 'daftar', subscription: sub.toJSON() }, '', 'api/push.php');
            if (d._http !== 200) { await sub.unsubscribe(); throw new Error(d.message || ('HTTP ' + d._http)); }
            await tampilkanPush();
            tampilkanDesktop();
        } catch (e) { if (info) info.textContent = 'Push gagal: ' + (e && e.message ? e.message : e); }
    }
    async function ujiPush() {
        var info = $('qimPushInfo');
        if (info) info.textContent = 'mengirim push uji…';
        try {
            var d = await api('POST', { aksi: 'uji' }, '', 'api/push.php');
            if (info) info.textContent = d._http === 200 ? ('✓ push terkirim ke ' + d.terkirim + ' dari ' + d.dari + ' perangkat') : ('✗ ' + (d.message || ('HTTP ' + d._http)));
        } catch (e) { if (info) info.textContent = '✗ ' + e.message; }
    }

    function mintaIzin() {
        if (!('Notification' in window)) return;
        Notification.requestPermission().then(function () {
            tampilkanDesktop();
            if (Notification.permission === 'granted') tampilkanNotif({ id: 'qim-uji-izin', simbol: 'Quantum', arah: '', entry: '' }, 'Notifikasi desktop aktif', 'Sinyal baru akan muncul di sini.');
        });
    }

    function hasil(teks, warna) {
        var el = $('qimNotifHasil');
        if (!el) return;
        el.textContent = teks;
        el.className = 'text-[10px] font-mono ' + (warna === 'hijau' ? 'text-qi-green' : warna === 'merah' ? 'text-qi-red' : 'text-slate-400');
    }

    function kumpulkan() {
        var badan = { aksi: 'simpan' };
        BARIS.forEach(function (b) { var on = $('qimNotif_' + b.k + '_on'); if (on) badan[b.k + '_enabled'] = on.checked; });
        badan.telegram_chat_id = ($('qimNotif_telegram_in').value || '').trim();
        ['discord', 'slack'].forEach(function (k) {
            var v = ($('qimNotif_' + k + '_in').value || '').trim();
            if (v) badan[k + '_webhook'] = v;           // kosong = biarkan URL tersimpan
        });
        return badan;
    }

    async function simpan(tambahan) {
        hasil('menyimpan…');
        try {
            var badan = kumpulkan();
            for (var k in (tambahan || {})) badan[k] = tambahan[k];
            var d = await api('POST', badan);
            if (d._http === 200 && d.status === 'success') {
                tampilkan(d);
                hasil('✓ tersimpan', 'hijau');
                if (d.setelan.desktop.aktif && 'Notification' in window && Notification.permission === 'default') mintaIzin();
            } else {
                hasil('✗ ' + (d.message || ('HTTP ' + d._http)), 'merah');
            }
        } catch (e) { hasil('✗ ' + (e && e.message ? e.message : 'gagal menghubungi server'), 'merah'); }
    }

    async function uji() {
        hasil('mengirim pesan uji…');
        var wadah = $('qimNotifUjiHasil');
        if (wadah) wadah.innerHTML = '';
        try {
            var d = await api('POST', { aksi: 'uji' }, '?aksi=uji');
            if (d.setelan) tampilkan(d);
            if (d.uji) {
                var per = d.uji.per_kanal || {};
                var kunci = Object.keys(per);
                if (wadah) wadah.innerHTML = kunci.map(function (k) {
                    return '<div class="' + (per[k].ok ? 'text-qi-green' : 'text-qi-red') + '">' + (per[k].ok ? '✓ ' : '✗ ') + esc(k) + ': ' + esc(per[k].pesan) + '</div>';
                }).join('') || '<div class="text-slate-400">' + esc(d.uji.catatan) + '</div>';
                hasil(d.status === 'success' ? '✓ semua kanal terkirim' : 'sebagian kanal gagal — lihat rincian', d.status === 'success' ? 'hijau' : 'merah');
            } else {
                hasil('✗ ' + (d.message || ('HTTP ' + d._http)), 'merah');
            }
            if (state.setelan && state.setelan.desktop.aktif) {
                tampilkanNotif({ id: 'qim-uji-' + Date.now(), simbol: 'XAUUSD', arah: 'BUY', entry: '2400.50', sl: '2392.10', tp: '2417.30' }, '[UJI] Sinyal BUY XAUUSD', 'Entry 2400.50 · SL 2392.10 · TP 2417.30');
            }
        } catch (e) { hasil('✗ ' + (e && e.message ? e.message : 'gagal menghubungi server'), 'merah'); }
    }

    async function muat() {
        if (!token()) return;
        var kartu = buatKartu();
        try {
            var d = await api('GET');
            if (d._http === 200) { tampilkan(d); return; }
            if (kartu) { chip($('qimNotifBadge'), 'TIDAK TERSEDIA', 'kuning'); hasil(d.message || ('HTTP ' + d._http), 'merah'); }
        } catch (e) { if (kartu) hasil('gagal memuat pengaturan', 'merah'); }
    }

    // ── NOTIFIKASI DESKTOP ─────────────────────────────────────────────────────
    function tampilkanNotif(s, judul, isi) {
        if (!('Notification' in window) || Notification.permission !== 'granted') return false;
        try {
            var n = new Notification(judul, { body: isi, tag: s.id, icon: 'assets/img/icon-192.png', badge: 'assets/img/icon-192.png' });
            n.onclick = function () { try { window.focus(); if (typeof showPanel === 'function') showPanel('panel-signal'); } catch (e) {} n.close(); };
            return true;
        } catch (e) { return false; }
    }

    async function periksaSinyal() {
        if (!token() || !state.setelan || !state.setelan.desktop.aktif) return;
        try {
            var d = await api('GET', null, '?terbaru=1');
            var daftar = (d && d.sinyal) || [];
            if (!daftar.length) return;
            var terakhir = bacaLokal(KUNCI_TERAKHIR);
            simpanLokal(KUNCI_TERAKHIR, daftar[0].id);  // tulis dulu → tab lain tidak mengulang
            if (!terakhir) return;                       // kunjungan pertama: tandai saja, jangan banjiri
            var baru = [];
            for (var i = 0; i < daftar.length && daftar[i].id !== terakhir; i++) baru.push(daftar[i]);
            baru.slice(0, 3).reverse().forEach(function (s) {
                var judul = 'Sinyal ' + s.arah + ' ' + s.simbol + (s.grade ? ' · Grade ' + s.grade : '');
                var isi = 'Entry ' + s.entry + ' · SL ' + s.sl + ' · TP ' + s.tp + (s.rr ? ' · R:R 1:' + s.rr : '') + (s.mesin ? '\n' + s.mesin : '');
                tampilkanNotif(s, judul, isi);
                if (typeof showQuantumToast === 'function') showQuantumToast('Sinyal baru: ' + s.simbol + ' ' + s.arah, 'success', 5000);
            });
        } catch (e) { /* jaringan putus: coba lagi di putaran berikut */ }
    }

    function jadwal() {
        clearTimeout(state.timer);
        state.timer = setTimeout(function () { periksaSinyal().finally(jadwal); }, document.visibilityState === 'visible' ? 30000 : 60000);
    }

    function mulai() {
        // Poller lama (pro-features.js) dimatikan supaya tidak ada notifikasi ganda.
        window.checkNewSignals = function () {};
        muat().then(function () { periksaSinyal(); jadwal(); });
    }

    window.QimNotif = { muat: muat, simpan: simpan, uji: uji, periksaSinyal: periksaSinyal };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mulai);
    else mulai();
})();
