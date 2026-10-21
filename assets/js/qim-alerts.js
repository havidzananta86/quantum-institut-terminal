/* ═══════════════════════════════════════════════════════════════════════════
   QIM ALERTS — price alert disimpan di SERVER (api/price-alerts.php).

   · Panel "Price Alerts" lama (pro-features.js) tetap dipakai: daftar `_priceAlerts` diisi dari
     server, dan addPriceAlert/removeAlert dibungkus supaya menulis ke server.
   · Alert lama di localStorage (qi_price_alerts) diimpor SEKALI ke server.
   · Server memeriksa alert (saat daftar dimuat + cron) dan mengirim ke Telegram/Discord/Slack/
     email pengguna; peramban tetap memberi toast + notifikasi desktop saat alert kena.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
    'use strict';
    if (window.QimAlerts) return;

    const toast = (m, t) => { try { if (typeof window.showQuantumToast === 'function') window.showQuantumToast(m, t || 'info', 6000); } catch (e) {} };
    const st = { siap: false, memuat: false };

    async function api(metode, badan, query) {
        const opsi = { method: metode, cache: 'no-store', headers: {} };
        if (badan) { opsi.headers['Content-Type'] = 'application/json'; opsi.body = JSON.stringify(badan); }
        const r = await fetch('api/price-alerts.php' + (query || ''), opsi);
        const d = await r.json().catch(() => ({}));
        if (!r.ok || d.status !== 'success') throw new Error(d.message || ('HTTP ' + r.status));
        return d;
    }

    /** Isi ulang daftar milik pro-features.js (bentuk lama: {id, symbol, price, direction, active}). */
    function terapkan(daftar) {
        const arr = window._priceAlerts;
        const baru = (daftar || []).map(a => ({ id: a.id, symbol: a.symbol, price: a.price, direction: a.direction, active: a.active, createdAt: a.createdAt, triggeredAt: a.triggeredAt, server: true }));
        if (Array.isArray(arr)) { arr.length = 0; baru.forEach(x => arr.push(x)); } else window._priceAlerts = baru;
        try { localStorage.setItem('qi_price_alerts', JSON.stringify(baru)); } catch (e) {}
        try { if (typeof window.renderAlerts === 'function') window.renderAlerts(); } catch (e) {}
    }

    /** renderAlerts() lama tidak membedakan alert yang sudah kena → tandai barisnya. */
    function tandaiKena() {
        const baru = Array.isArray(window._priceAlerts) ? window._priceAlerts : [];
        const list = document.getElementById('alertList');
        if (list && list.children.length === baru.length) {
            baru.forEach((a, i) => {
                if (a.active) return;
                const row = list.children[i];
                row.style.opacity = '.55';
                const info = row.firstElementChild;
                if (info && !info.querySelector('.qal-kena')) {
                    const s = document.createElement('span');
                    s.className = 'qal-kena';
                    s.style.cssText = 'color:#4ade80;font-size:10px;font-weight:700';
                    s.textContent = '✓ kena' + (a.triggeredAt ? ' ' + new Date(a.triggeredAt).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
                    info.appendChild(s);
                }
            });
        }
    }

    function umumkan(kena) {
        (kena || []).forEach(k => {
            const msg = k.symbol + ' ' + (k.arah === 'above' ? 'naik ke ' : 'turun ke ') + k.target + ' (sekarang ' + k.harga + ')';
            toast('🔔 Price alert: ' + msg, 'success');
            try { if (typeof window.sendBrowserNotification === 'function') window.sendBrowserNotification('Price Alert: ' + k.symbol, msg); } catch (e) {}
            // Alert yang dipicu SERVER juga masuk kotak "Riwayat Alert Terpicu".
            // Dulu fungsi ini hanya memunculkan toast + notifikasi desktop, sehingga alert yang
            // kena saat dashboard tertutup — justru alasan utama alert dipindah ke server —
            // tidak pernah tercatat di riwayat mana pun.
            try {
                if (typeof window.catatAlertKena === 'function') {
                    window.catatAlertKena({
                        symbol: k.symbol,
                        price: k.target,
                        direction: k.arah,
                        currentPrice: k.harga,
                        triggeredAt: k.kena_pada || k.triggeredAt || new Date().toISOString(),
                        sumber: 'server',
                    });
                }
            } catch (e) {}
        });
    }

    async function muat() {
        if (st.memuat) return;
        st.memuat = true;
        try {
            const d = await api('GET');
            terapkan(d.alerts);
            umumkan(d.baru_kena);
        } catch (e) { /* server tak terjangkau → daftar lama tetap tampil */ }
        finally { st.memuat = false; }
    }

    async function imporLama() {
        let lama = [];
        try { if (localStorage.getItem('qim_alert_migrasi') === '1') return; lama = JSON.parse(localStorage.getItem('qi_price_alerts') || '[]'); } catch (e) {}
        const aktif = (lama || []).filter(a => a && a.active && !a.server);
        try {
            if (aktif.length) {
                const d = await api('POST', { aksi: 'impor', alerts: aktif });
                if (d.diimpor) toast(d.diimpor + ' price alert dipindah ke server — kini berbunyi walau dashboard ditutup.', 'success');
            }
            localStorage.setItem('qim_alert_migrasi', '1');
        } catch (e) { /* coba lagi lain kali */ }
    }

    async function tambah(symbol, price, direction) {
        const d = await api('POST', { symbol, price, direction });
        terapkan(d.alerts);
        return d;
    }

    function pasang() {
        if (st.siap) return;
        st.siap = true;
        const asliRender = window.renderAlerts;
        if (typeof asliRender === 'function') {
            window.renderAlerts = function () { const h = asliRender.apply(this, arguments); try { tandaiKena(); } catch (e) {} return h; };
        }
        // Form panel Price Alerts → server.
        const asliTambah = window.addPriceAlert;
        window.addPriceAlert = async function () {
            const sym = (document.getElementById('alertSym') || {}).value || '';
            const harga = parseFloat((document.getElementById('alertPrice') || {}).value);
            const arah = (document.getElementById('alertDir') || {}).value || 'above';
            if (!sym || !Number.isFinite(harga)) { toast('Isi pair & harga target', 'warning'); return; }
            try {
                await tambah(sym.toUpperCase(), harga, arah);
                const p = document.getElementById('alertPrice'); if (p) p.value = '';
                toast('Alert ' + sym.toUpperCase() + ' @ ' + harga + ' disimpan di server.', 'success');
                try { if (typeof window.requestNotificationPermission === 'function') window.requestNotificationPermission(); } catch (e) {}
            } catch (e) {
                toast('Alert gagal disimpan: ' + e.message, 'error');
                if (typeof asliTambah === 'function' && /HTTP 5|Failed to fetch/.test(e.message)) asliTambah();   // server mati → simpan lokal seperti dulu
            }
        };
        window.removeAlert = async function (id) {
            try { const d = await api('DELETE', null, '?id=' + encodeURIComponent(id)); terapkan(d.alerts); }
            catch (e) { toast('Alert gagal dihapus: ' + e.message, 'error'); }
        };
        imporLama().then(muat);
        setInterval(() => { if (document.visibilityState === 'visible') muat(); }, 60000);
    }

    window.QimAlerts = { muat, tambah };
    const mulai = () => {
        // Tunggu pro-features.js (pemilik panel alert) termuat.
        if (typeof window.renderAlerts === 'function' || Array.isArray(window._priceAlerts)) pasang(); else setTimeout(mulai, 500);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mulai); else mulai();
})();
