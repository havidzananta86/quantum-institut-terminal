/* QIM BROKER — setup bridge MT5, guardrail eksekusi real, dan alert Telegram (halaman Profil).
 *
 * Dulu bagian dari panel Akun di dashboard lama (dashboard-app.js). Dashboard kini chart-first
 * (qim-terminal-shell.js) dan tidak punya panel Akun, jadi seluruh pengaturannya pindah ke
 * profile.html (#brokerSection). Perilaku & endpoint SAMA dengan sebelumnya:
 *   api/account-analytics.php   daftar akun bridge + jam server
 *   api/account-connection.php  provision / share / revoke
 *   api/live-trade.php          configure / set_enabled / emergency_stop / status
 *   api/telegram-setelan.php    token & chat id Telegram (admin)
 * Aksi tombol memakai data-qi-aksi (qim-aksi.js), jadi semua fungsi di bawah dipasang ke window.
 */
(function () {
    'use strict';

    const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const el = (id) => document.getElementById(id);
    let akunBridge = [];

    function kabar(pesan, tipe) {
        if (typeof window.showQuantumToast === 'function') return window.showQuantumToast(pesan, tipe || 'info');
        if (typeof window.showToast === 'function') return window.showToast(pesan, tipe !== 'error' && tipe !== 'warning');
    }
    function headerJson() {
        return window.QuantumAuth && QuantumAuth.authHeaders ? QuantumAuth.authHeaders({ 'Content-Type': 'application/json' }) : { 'Content-Type': 'application/json' };
    }
    function headerBiasa() {
        return window.QuantumAuth && QuantumAuth.authHeaders ? QuantumAuth.authHeaders() : {};
    }
    function peranSaya() {
        try { return String((JSON.parse(localStorage.getItem('qi_user') || '{}') || {}).role || '').toLowerCase(); } catch (e) { return ''; }
    }

    /* ── Endpoint & penyalinan ─────────────────────────────────────────────────── */
    function bridgeEndpointUrl() {
        try { return new URL('api/mt-bridge.php?action=snapshot', location.href).href; }
        catch (e) { return 'api/mt-bridge.php?action=snapshot'; }
    }
    function bridgeOrigin() {
        try { return new URL(bridgeEndpointUrl()).origin; } catch (e) { return location.origin; }
    }
    function isiEndpoint() {
        const endpoint = bridgeEndpointUrl(), origin = bridgeOrigin();
        if (el('bridgeEndpointValue')) el('bridgeEndpointValue').textContent = endpoint;
        if (el('bridgeOriginValue')) el('bridgeOriginValue').textContent = origin;
        if (el('bridgeOriginStep')) el('bridgeOriginStep').textContent = origin;
    }
    function salinCadangan(teks) {
        try {
            const area = document.createElement('textarea');
            area.value = teks; area.setAttribute('readonly', '');
            area.style.cssText = 'position:fixed;top:-1000px;opacity:0';
            document.body.appendChild(area); area.select(); area.setSelectionRange(0, teks.length);
            const ok = document.execCommand('copy');
            document.body.removeChild(area);
            return !!ok;
        } catch (e) { return false; }
    }
    function pilihTeks(id) {
        const e = el(id); if (!e) return;
        try { const r = document.createRange(); r.selectNodeContents(e); const s = window.getSelection(); s.removeAllRanges(); s.addRange(r); } catch (err) { /* abaikan */ }
    }
    async function salinKokoh(teks, idCadangan) {
        if (navigator.clipboard && window.isSecureContext) {
            try { await navigator.clipboard.writeText(teks); return true; } catch (e) { /* coba cara lama */ }
        }
        if (salinCadangan(teks)) return true;
        pilihTeks(idCadangan);
        return false;
    }
    function selectBridgeKey() { pilihTeks('bridgeKeyValue'); }
    async function copyBridgeEndpoint() {
        const ok = await salinKokoh(bridgeEndpointUrl(), 'bridgeEndpointValue');
        kabar(ok ? 'Endpoint disalin. Tempel ke input Endpoint pada EA.' : 'Penyalinan otomatis gagal — teksnya sudah diseleksi, tekan Ctrl+C.', ok ? 'success' : 'warning');
    }
    async function copyBridgeKey() {
        const kunci = (el('bridgeKeyValue') ? el('bridgeKeyValue').textContent : '').trim();
        if (!kunci) return;
        const ok = await salinKokoh(kunci, 'bridgeKeyValue');
        kabar(ok ? 'Bridge Key disalin. Simpan di tempat aman.' : 'Penyalinan otomatis gagal — teksnya sudah diseleksi, tekan Ctrl+C (atau tekan lama → Copy).', ok ? 'success' : 'warning');
    }

    /* ── Waktu & format ────────────────────────────────────────────────────────── */
    // Stempel MySQL ("YYYY-MM-DD HH:MM:SS") dibaca sebagai jam server: selisih dua nilai dari server
    // yang sama selalu tepat walau zonanya berbeda.
    function jamServer(nilai) {
        const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(String(nilai || ''));
        return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) : null;
    }
    function umurMenit(nilai, sekarangServer) {
        const a = jamServer(nilai), b = jamServer(sekarangServer);
        return a === null || b === null ? null : Math.max(0, (b - a) / 60000);
    }
    function sejak(nilai, sekarangServer) {
        if (!nilai) return null;
        const mnt = umurMenit(nilai, sekarangServer);
        if (mnt === null) {   // API tanpa jam server: tampilkan apa adanya, jangan menebak selisih zona
            const lokal = new Date(String(nilai).replace(' ', 'T'));
            return Number.isFinite(lokal.getTime()) ? lokal.toLocaleString('id-ID') : null;
        }
        if (mnt < 1) return 'baru saja';
        if (mnt < 60) return Math.floor(mnt) + ' menit lalu';
        const jam = Math.floor(mnt / 60);
        return jam < 24 ? jam + ' jam lalu' : Math.floor(jam / 24) + ' hari lalu';
    }
    function formatUsd(nilai) {
        const n = Number(nilai);
        return Number.isFinite(n) ? '$' + n.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';
    }
    function teksStatusBridge(status) {
        if (status === 'active') return ['TERHUBUNG', 'text-qi-green'];
        if (status === 'revoked') return ['DICABUT', 'text-slate-500'];
        if (status === 'pending') return ['menunggu snapshot', 'text-amber-300'];
        return [String(status || '-'), 'text-slate-400'];
    }

    /* ── Akun bridge ───────────────────────────────────────────────────────────── */
    function gambarAkun(akun, sekarangServer) {
        const kotak = el('bridgeAccountList'), baris = el('bridgeAccountRows');
        if (!kotak || !baris) return;
        akunBridge = Array.isArray(akun) ? akun : [];
        if (!akunBridge.length) { kotak.classList.add('hidden'); baris.innerHTML = ''; return; }
        kotak.classList.remove('hidden');
        const arg = (...a) => (window.QIAksi && QIAksi.arg ? QIAksi.arg(...a) : esc(JSON.stringify(a)));
        baris.innerHTML = akunBridge.map((a) => {
            const [teks, warna] = teksStatusBridge(a.connection_status);
            const bagian = [
                '<span class="font-semibold text-white">' + (esc(a.provider) || 'Akun') + '</span>',
                esc(a.account_reference) || null,
                esc(a.account_label) || null,
                '<span class="' + warna + '">' + teks + '</span>',
                a.bridge_key_created_at ? 'key ' + (sejak(a.bridge_key_created_at, sekarangServer) || 'baru') : null,
                a.last_synced_at ? 'snapshot ' + (sejak(a.last_synced_at, sekarangServer) || '-') : 'belum ada snapshot',
                a.balance == null ? null : 'saldo ' + formatUsd(a.balance),
            ].filter(Boolean);
            const berbagi = Number(a.share_positions) === 1;
            const tombol = a.connection_status === 'revoked' ? ''
                : '<div class="flex items-center gap-1">'
                + '<button type="button" data-qi-aksi="setPositionSharing" data-qi-arg="' + arg(Number(a.id), berbagi ? 0 : 1) + '" title="Izinkan pengguna PRO/VIP lain melihat posisi akun ini" class="rounded border ' + (berbagi ? 'border-qi-green/40 text-qi-green' : 'border-qi-border text-slate-400') + ' px-2 py-1 text-[9px] font-semibold hover:bg-white/5">Berbagi: ' + (berbagi ? 'YA' : 'tidak') + '</button>'
                + '<button type="button" data-qi-aksi="revokeBridgeAccount" data-qi-arg="' + arg(Number(a.id)) + '" class="rounded border border-qi-red/40 px-2 py-1 text-[9px] font-semibold text-qi-red hover:bg-qi-red/10">Cabut</button>'
                + '</div>';
            return '<div class="flex flex-col gap-1 rounded border border-qi-border bg-qi-bg px-2 py-2 sm:flex-row sm:items-center sm:justify-between">'
                + '<div class="min-w-0 text-[10px] text-slate-300">' + bagian.join(' · ') + '</div><div class="shrink-0">' + tombol + '</div></div>';
        }).join('');
    }
    async function muatAkun() {
        try {
            const res = await fetch('api/account-analytics.php', { headers: headerBiasa(), cache: 'no-store' });
            const d = await res.json();
            if (!res.ok || d.status !== 'success') throw new Error(d.code || 'ANALYTICS_UNAVAILABLE');
            gambarAkun(d.accounts, d.server_now);
        } catch (e) { /* daftar lama tetap tampil */ }
    }
    function refreshAccountConnection() { return Promise.all([muatAkun(), muatEksekusi()]); }

    async function provisionBridge(event) {
        if (event && event.preventDefault) event.preventDefault();
        const tombol = el('bridgeProvisionBtn');
        const badan = {
            action: 'provision',
            provider: el('bridgeProvider') ? el('bridgeProvider').value : '',
            account_label: el('bridgeAccountLabel') ? el('bridgeAccountLabel').value.trim() : '',
            account_reference: el('bridgeAccountReference') ? el('bridgeAccountReference').value.trim() : '',
        };
        if (!badan.provider || !badan.account_label || !badan.account_reference) { kabar('Lengkapi platform, nama, dan nomor akun.', 'warning'); return; }
        if (tombol) { tombol.disabled = true; tombol.textContent = 'Membuat key…'; }
        try {
            const res = await fetch('api/account-connection.php', { method: 'POST', headers: headerJson(), body: JSON.stringify(badan) });
            const d = await res.json();
            if (!res.ok || d.status !== 'success' || !(d.data && d.data.bridge_key)) throw new Error(d.message || 'PROVISION_FAILED');
            if (el('bridgeKeyValue')) el('bridgeKeyValue').textContent = d.data.bridge_key;
            if (el('bridgeKeyResult')) el('bridgeKeyResult').classList.remove('hidden');
            kabar('Bridge Key dibuat. Salin dan simpan sekarang.', 'success');
            muatAkun(); muatEksekusi();
        } catch (e) {
            kabar('Bridge Key tidak dapat dibuat. Periksa detail akun lalu coba lagi.', 'error');
        } finally {
            if (tombol) { tombol.disabled = false; tombol.textContent = 'Buat Bridge Key'; }
        }
    }
    async function setPositionSharing(id, bagikan) {
        try {
            const res = await fetch('api/account-connection.php', { method: 'POST', headers: headerJson(), body: JSON.stringify({ action: 'share', account_id: Number(id), share: bagikan ? 1 : 0 }) });
            const d = await res.json();
            if (!res.ok || d.status !== 'success') throw new Error(d.message || 'SHARE_FAILED');
            kabar(d.message || 'Pengaturan berbagi disimpan.', 'success');
            await muatAkun();
        } catch (e) { kabar(e.message || 'Pengaturan berbagi gagal disimpan.', 'error'); }
    }
    async function revokeBridgeAccount(id) {
        const akun = akunBridge.find((a) => Number(a.id) === Number(id));
        const label = akun ? (akun.provider + ' ' + (akun.account_reference || '')).trim() : 'akun ini';
        if (!window.confirm('Cabut koneksi ' + label + '? EA untuk akun ini berhenti mengirim data dan Bridge Key-nya tidak berlaku lagi.')) return;
        try {
            const res = await fetch('api/account-connection.php', { method: 'POST', headers: headerJson(), body: JSON.stringify({ action: 'revoke', account_id: Number(id) }) });
            const d = await res.json();
            if (!res.ok || d.status !== 'success') throw new Error(d.message || 'REVOKE_FAILED');
            kabar(d.message || 'Bridge dicabut.', 'success');
            await muatAkun(); await muatEksekusi();
        } catch (e) { kabar(e.message || 'Bridge tidak dapat dicabut.', 'error'); }
    }

    /* ── Eksekusi real ─────────────────────────────────────────────────────────── */
    /** Teks "SINYAL=Broker" per baris (koma/titik koma juga boleh) → objek. Nilai kosong = sengaja tidak dieksekusi. */
    function teksKePetaSimbol(teks) {
        const peta = {};
        String(teks || '').split(/[\n,;]+/).forEach((baris) => {
            const t = baris.trim();
            if (!t) return;
            const pisah = t.indexOf('=');
            const dari = (pisah === -1 ? t : t.slice(0, pisah)).trim().toUpperCase();
            const ke = pisah === -1 ? '' : t.slice(pisah + 1).trim();
            if (!/^[A-Z0-9._\/-]{3,32}$/.test(dari)) return;
            if (ke !== '' && !/^[A-Za-z0-9._-]{1,32}$/.test(ke)) return;
            peta[dari] = ke;
        });
        return peta;
    }
    function petaKeTeksSimbol(peta) {
        try { const o = peta && typeof peta === 'object' ? peta : {}; return Object.keys(o).map((k) => k + '=' + (o[k] == null ? '' : o[k])).join('\n'); }
        catch (e) { return ''; }
    }

    async function muatEksekusi() {
        const pilih = el('liveAccountId'), status = el('liveExecutionState');
        try {
            const res = await fetch('api/live-trade.php', { headers: headerBiasa(), cache: 'no-store' });
            const d = await res.json();
            if (!res.ok || d.status !== 'success') throw new Error('LOAD_FAILED');
            const akun = Array.isArray(d.accounts) ? d.accounts : [];
            const dipilih = pilih ? pilih.value : '';
            if (pilih) {
                pilih.innerHTML = akun.length
                    ? akun.map((a) => '<option value="' + Number(a.id) + '">' + esc(a.account_label || 'MT5') + ' · ' + esc(a.connection_status) + '</option>').join('')
                    : '<option value="">Belum ada akun MT5</option>';
                // Pilihan terakhir: yang sedang tampil, lalu yang tersimpan (dipakai juga Quick Trade di dashboard).
                let simpan = '';
                try { simpan = localStorage.getItem('qi_live_akun') || ''; } catch (e) { /* abaikan */ }
                const kandidat = [dipilih, simpan].find((v) => v && akun.some((a) => String(a.id) === v));
                if (kandidat) pilih.value = kandidat;
            }
            const sekarang = akun.find((a) => pilih && String(a.id) === pilih.value) || akun[0];
            if (status) status.textContent = sekarang
                ? (Number(sekarang.enabled) ? 'EKSEKUSI REAL AKTIF — pantau terminal dan log order.' : 'Eksekusi nonaktif. Guardrail tetap berlaku saat diaktifkan.')
                : 'Hubungkan MT5 read-only terlebih dahulu.';
        } catch (e) { if (status) status.textContent = 'Status eksekusi belum tersedia.'; }
    }
    async function aksiLive(muatan) {
        const id = Number(el('liveAccountId') ? el('liveAccountId').value : NaN);
        if (!Number.isInteger(id) || id < 1) { kabar('Pilih akun MT5 yang sudah terhubung.', 'warning'); return null; }
        const res = await fetch('api/live-trade.php', { method: 'POST', headers: headerJson(), body: JSON.stringify(Object.assign({}, muatan, { account_id: id })) });
        const d = await res.json();
        if (!res.ok || d.status !== 'success') throw new Error(d.message || 'LIVE_ACTION_FAILED');
        return d;
    }
    async function saveLiveGuardrails() {
        const simbol = (el('liveSymbols') ? el('liveSymbols').value : '').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
        // Bawaan ketat (rugi harian 5%, 3 posisi); lot tetap 0,01 karena itu batas keras server.
        const harian = Number((el('liveDailyLoss') && el('liveDailyLoss').value) || 5);
        const maksPosisi = Number((el('liveMaxPositions') && el('liveMaxPositions').value) || 3);
        const peta = teksKePetaSimbol(el('liveSymbolMap') ? el('liveSymbolMap').value : '');
        try {
            const d = await aksiLive({ action: 'configure', max_lot: 0.01, max_daily_loss_pct: harian, max_open_positions: maksPosisi, allowed_symbols: simbol, symbol_map: peta });
            if (!d) return;
            kabar(d.message, 'success'); muatEksekusi(); muatStatusEksekusi();
        } catch (e) { kabar(e.message || 'Guardrail eksekusi tidak tersimpan.', 'error'); }
    }
    async function setLiveExecution(aktif) {
        try {
            const d = await aksiLive({ action: 'set_enabled', enabled: aktif, confirm_text: el('liveConfirmText') ? el('liveConfirmText').value : '' });
            if (!d) return;
            kabar(d.message, aktif ? 'warning' : 'success'); muatEksekusi();
        } catch (e) { kabar(e.message || 'Status eksekusi tidak diubah.', 'error'); }
    }
    async function emergencyStopLive() {
        try {
            const d = await aksiLive({ action: 'emergency_stop' });
            if (!d) return;
            kabar(d.message, 'warning'); muatEksekusi();
        } catch (e) { kabar(e.message || 'Tombol darurat gagal diproses.', 'error'); }
    }

    /** Kesegaran EA + perintah terakhir: menjawab "EA saya hidup atau tidak?" tanpa bertanya ke dukungan. */
    async function muatStatusEksekusi() {
        const kotak = el('liveExecStatus'), daftar = el('liveExecOrders');
        const id = Number(el('liveAccountId') ? el('liveAccountId').value : NaN);
        if (!Number.isInteger(id) || id < 1) { if (kotak) kotak.textContent = 'Pilih akun MT5 yang sudah terhubung lebih dulu.'; return; }
        if (kotak) kotak.textContent = 'Memuat status eksekusi…';
        try {
            const res = await fetch('api/live-trade.php', { method: 'POST', headers: headerJson(), body: JSON.stringify({ action: 'status', account_id: id }) });
            const d = await res.json();
            if (!res.ok || d.status !== 'success') throw new Error(d.message || 'STATUS_FAIL');
            const p = (d.data && d.data.profil) || null, ea = (d.data && d.data.ea) || null, harian = (d.data && d.data.status_harian) || null;
            const perintah = Array.isArray(d.data && d.data.perintah) ? d.data.perintah : [];
            if (p) {   // tampilkan kembali pengaturan yang tersimpan, bukan hanya yang diketik
                const peta = el('liveSymbolMap');
                if (peta && !peta.value.trim() && p.symbol_map) peta.value = petaKeTeksSimbol(p.symbol_map);
                if (el('liveDailyLoss') && p.max_daily_loss_pct) el('liveDailyLoss').value = p.max_daily_loss_pct;
                if (el('liveMaxPositions') && p.max_open_positions) el('liveMaxPositions').value = p.max_open_positions;
            }
            if (kotak) {
                const umur = ea && Number.isFinite(ea.umur_detik) ? ea.umur_detik : null;
                const teksEa = ea
                    ? (ea.hidup ? '🟢 EA hidup (terakhir melapor ' + umur + ' dtk lalu)' : '🔴 EA tidak melapor ' + (umur === null ? '—' : umur + ' dtk') + ' — periksa terminal/AutoTrading')
                    : '⚪ EA belum pernah melapor — pasang EA & nyalakan AutoTrading';
                const st = p ? (Number(p.enabled) ? 'EKSEKUSI AKTIF' : (Number(p.emergency_stop) ? 'STOP DARURAT' : 'nonaktif')) : 'belum dikonfigurasi';
                const batas = p ? 'lot maks ' + Number(p.max_lot).toFixed(2) + ' · rugi harian maks ' + Number(p.max_daily_loss_pct).toFixed(1) + '% · maks ' + p.max_open_positions + ' posisi' : '';
                const hari = harian ? ' · ekuitas terakhir ' + Number(harian.ekuitas_terakhir).toLocaleString('en-US', { minimumFractionDigits: 2 }) + ' · ' + harian.posisi_terbuka + ' posisi terbuka' : '';
                kotak.innerHTML = '<div class="text-[10px] leading-relaxed text-slate-300">' + teksEa + '</div>'
                    + '<div class="mt-1 text-[10px] text-slate-500">Status: <span class="font-semibold ' + (p && Number(p.enabled) ? 'text-emerald-300' : 'text-slate-400') + '">' + st + '</span>' + (batas ? ' · ' + batas : '') + hari + '</div>';
            }
            if (daftar) {
                if (!perintah.length) {
                    daftar.innerHTML = '<div class="text-[10px] text-slate-500">Belum ada perintah. Perintah muncul saat sinyal AKTIF diterbitkan dan akun ini memenuhi semua syarat.</div>';
                } else {
                    const warna = { executed: 'text-emerald-300', rejected: 'text-red-300', queued: 'text-amber-300', dispatched: 'text-cyan-300', cancelled: 'text-slate-400', expired: 'text-slate-500' };
                    daftar.innerHTML = '<div class="text-[9px] font-semibold uppercase tracking-wider text-slate-500">Perintah terakhir</div>' + perintah.map((o) => {
                        const tiket = o.broker_order_ticket ? ' · tiket ' + esc(o.broker_order_ticket) : '';
                        const pesan = o.broker_message ? ' · ' + esc(String(o.broker_message).slice(0, 60)) : '';
                        return '<div class="rounded border border-qi-border/60 bg-black/20 px-2 py-1 text-[10px]"><span class="font-mono text-slate-300">' + esc(o.symbol) + '</span> <span class="' + (o.side === 'BUY' ? 'text-emerald-300' : 'text-red-300') + '">' + esc(o.side) + '</span> <span class="text-slate-500">' + Number(o.volume).toFixed(2) + ' lot</span> · <span class="' + (warna[o.status] || 'text-slate-400') + '">' + esc(o.status) + '</span><span class="text-slate-500">' + tiket + pesan + '</span><div class="text-[9px] text-slate-600">' + esc(o.created_at || '') + (o.signal_id ? ' · sinyal ' + esc(String(o.signal_id).slice(-12)) : '') + '</div></div>';
                    }).join('');
                }
            }
        } catch (e) {
            if (kotak) kotak.textContent = 'Status eksekusi belum dapat dibaca. ' + (e.message || '');
        }
    }

    /* ── Telegram (khusus admin) ───────────────────────────────────────────────── */
    async function muatTelegramStatus() {
        const kartu = el('tgKartu');
        if (!kartu) return;
        // Endpoint khusus admin: peran lain tidak memanggilnya (hanya menghasilkan 403 di konsol). Server tetap memeriksa sendiri.
        if (peranSaya() !== 'admin') { kartu.classList.add('hidden'); return; }
        try {
            const res = await fetch('api/telegram-setelan.php', { headers: headerBiasa(), cache: 'no-store' });
            if (!res.ok) { kartu.classList.add('hidden'); return; }
            const d = await res.json();
            kartu.classList.remove('hidden');
            const aktif = !!d.terkonfigurasi;
            const lencana = el('tgStatusBadge'), catatan = el('tgCatatan');
            if (lencana) {
                lencana.textContent = aktif ? 'AKTIF' : 'BELUM AKTIF';
                lencana.className = 'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-mono ' + (aktif ? 'border-qi-green/40 bg-qi-green/10 text-qi-green' : 'border-amber-400/40 bg-amber-400/10 text-amber-300');
            }
            if (catatan) {
                const bagian = [d.catatan || ''];
                if (d.ada_token && d.token_ekor) bagian.push('Token tersimpan (berakhir ' + d.token_ekor + ') — demi keamanan tidak ditampilkan utuh.');
                if (d.sumber) bagian.push('Sumber pengaturan: ' + d.sumber + '.');
                catatan.textContent = bagian.filter(Boolean).join(' ');
            }
            const chat = el('tgChat');
            if (chat && !chat.value && d.chat_id_tersimpan) chat.value = d.chat_id_tersimpan;
        } catch (e) { kartu.classList.add('hidden'); }
    }
    function tulisHasilTg(teks, kelas) {
        const h = el('tgHasil');
        if (h) { h.textContent = teks; h.className = 'text-[10px] font-mono ' + kelas; }
    }
    async function tgSimpan(uji) {
        const token = el('tgToken'), chat = el('tgChat');
        tulisHasilTg('menyimpan…', 'text-slate-400');
        try {
            const badan = { aksi: uji ? 'uji' : 'simpan', chat_id: chat ? chat.value.trim() : '' };
            // Token hanya dikirim bila kolomnya diisi, supaya menyimpan chat id tidak menghapus token yang ada.
            if (token && token.value.trim() !== '') badan.token = token.value.trim();
            const res = await fetch('api/telegram-setelan.php', { method: 'POST', headers: headerJson(), body: JSON.stringify(badan) });
            const d = await res.json().catch(() => ({}));
            if (token) token.value = '';
            if (uji && d.uji) tulisHasilTg((d.uji.ok ? '✓ ' : '✗ ') + d.uji.pesan, d.uji.ok ? 'text-qi-green' : 'text-qi-red');
            else if (res.ok && d.status === 'success') tulisHasilTg('✓ tersimpan', 'text-qi-green');
            else tulisHasilTg('✗ ' + (d.message || ('HTTP ' + res.status)), 'text-qi-red');
            await muatTelegramStatus();
        } catch (e) { tulisHasilTg('✗ ' + (e && e.message ? e.message : 'gagal menghubungi server'), 'text-qi-red'); }
    }
    async function tgHapus() {
        tulisHasilTg('menghapus…', 'text-slate-400');
        try {
            const res = await fetch('api/telegram-setelan.php', { method: 'POST', headers: headerJson(), body: JSON.stringify({ aksi: 'hapus' }) });
            const d = await res.json().catch(() => ({}));
            const ok = res.ok && d.status === 'success';
            tulisHasilTg(ok ? '✓ pengaturan dihapus' : '✗ ' + (d.message || ('HTTP ' + res.status)), ok ? 'text-qi-green' : 'text-qi-red');
            if (el('tgToken')) el('tgToken').value = '';
            if (el('tgChat')) el('tgChat').value = '';
            await muatTelegramStatus();
        } catch (e) { tulisHasilTg('✗ ' + (e && e.message ? e.message : 'gagal'), 'text-qi-red'); }
    }

    // Dipasang satu per satu (bukan Object.assign) supaya pemindai tests/csp-inline.test.js bisa
    // membuktikan setiap nama data-qi-aksi punya fungsi.
    window.QIMBroker = { teksKePetaSimbol, petaKeTeksSimbol, jamServer, umurMenit, sejak };
    window.teksKePetaSimbol = teksKePetaSimbol;
    window.petaKeTeksSimbol = petaKeTeksSimbol;
    window.selectBridgeKey = selectBridgeKey;
    window.copyBridgeEndpoint = copyBridgeEndpoint;
    window.copyBridgeKey = copyBridgeKey;
    window.refreshAccountConnection = refreshAccountConnection;
    window.provisionBridge = provisionBridge;
    window.setPositionSharing = setPositionSharing;
    window.revokeBridgeAccount = revokeBridgeAccount;
    window.saveLiveGuardrails = saveLiveGuardrails;
    window.setLiveExecution = setLiveExecution;
    window.emergencyStopLive = emergencyStopLive;
    window.muatStatusEksekusi = muatStatusEksekusi;
    window.muatTelegramStatus = muatTelegramStatus;
    window.tgSimpan = tgSimpan;
    window.tgHapus = tgHapus;

    function mulai() {
        if (!el('brokerSection')) return;
        isiEndpoint();
        muatAkun();
        muatEksekusi().then(muatStatusEksekusi);
        muatTelegramStatus();
        // Kartu akun menyegar tiap menit selama tab terlihat (status TERHUBUNG muncul tanpa refresh).
        setInterval(() => { if (document.visibilityState === 'visible') muatAkun(); }, 60000);
        const pilih = el('liveAccountId');
        if (pilih) pilih.addEventListener('change', () => {
            try { localStorage.setItem('qi_live_akun', pilih.value); } catch (e) { /* abaikan */ }
            muatStatusEksekusi();
        });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mulai); else mulai();
})();
