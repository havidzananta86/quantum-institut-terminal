/**
 * "Ikuti Auto Analisa" — akun SIMULASI yang membuka posisi otomatis dari sinyal Auto Analisa.
 *
 * Menampilkan (dari api/auto-paper.php): saldo simulasi, jumlah yang BERTAMBAH (kena TP) dan BERKURANG
 * (kena SL) hari ini, total sejak diaktifkan, posisi terbuka, dan transaksi terbaru dengan nominalnya.
 * Juga memperbarui tombol saldo di header dan banner ringkas di panel Auto Analisa.
 * Uang virtual saja; semua nilai berasal dari server (tidak dihitung di peramban).
 */
(function (root) {
    'use strict';

    const API = 'api/auto-paper.php';
    const SIMBOL = { BTCUSDT: 'BTC/USDT', ETHUSDT: 'ETH/USDT', SOLUSDT: 'SOL/USDT', BNBUSDT: 'BNB/USDT', XRPUSDT: 'XRP/USDT', DOGEUSDT: 'DOGE/USDT', XAUUSD: 'XAU/USD', EURUSD: 'EUR/USD', GBPUSD: 'GBP/USD', USDJPY: 'USD/JPY' };

    // ── Format (murni, bisa diuji) ──────────────────────────────────────────
    const angka = (n, d) => Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
    function usd(n, tanda) {
        const v = Number(n) || 0;
        const teks = '$' + angka(Math.abs(v), 2);
        if (!tanda) return (v < 0 ? '-' : '') + teks;
        return (v > 0 ? '+' : v < 0 ? '−' : '') + teks;
    }
    function hargaTeks(simbol, v) {
        const d = /JPY$/.test(simbol) ? 3 : (Number(v) < 10 ? 5 : 2);
        return angka(v, d);
    }
    function barisTransaksi(t) {
        const r = t.r === null || t.r === undefined ? '' : ' (' + (t.r > 0 ? '+' : t.r < 0 ? '−' : '') + Math.abs(t.r).toFixed(2) + 'R)';
        return { pair: SIMBOL[t.symbol] || t.symbol, arah: t.side, lot: t.lots,
                 harga: hargaTeks(t.symbol, t.entry) + ' → ' + hargaTeks(t.symbol, t.exit),
                 hasil: t.hasil, nominal: usd(t.pnl, true) + r, naik: t.pnl > 0, turun: t.pnl < 0 };
    }

    // ── DOM ─────────────────────────────────────────────────────────────────
    const $ = id => (typeof document !== 'undefined' ? document.getElementById(id) : null);
    let data = null, memuat = false, terakhir = 0, ditolak = false;

    function el(tag, kelas, teks) {
        const e = document.createElement(tag);
        if (kelas) e.className = kelas;
        if (teks !== undefined) e.textContent = teks;
        return e;
    }
    function headers(ekstra) {
        return (root.QuantumAuth && root.QuantumAuth.authHeaders) ? root.QuantumAuth.authHeaders(ekstra || {}) : (ekstra || {});
    }

    function render() {
        const d = data;
        const kartu = $('autoPaperCard');
        if (!d) return;
        const set = (id, teks, kelas) => { const e = $(id); if (e) { e.textContent = teks; if (kelas !== undefined) e.className = kelas; } };
        set('apSaldo', usd(d.saldo));
        set('apTambah', usd(d.hari_ini.bertambah, true), 'qap-up');
        set('apKurang', d.hari_ini.berkurang ? '−' + usd(d.hari_ini.berkurang) : usd(0), 'qap-down');
        set('apBersih', usd(d.hari_ini.bersih, true), d.hari_ini.bersih > 0 ? 'qap-up' : d.hari_ini.bersih < 0 ? 'qap-down' : '');
        const t = d.total;
        set('apTotal', t.tp + t.sl === 0
            ? (d.aktif ? 'Aktif. Menunggu sinyal Auto Analisa berikutnya — sinyal yang terbit sebelum fitur ini dinyalakan tidak diikuti.' : 'Nonaktif. Nyalakan untuk mengikuti sinyal Auto Analisa secara otomatis di akun simulasi.')
            : 'Sejak diaktifkan: ' + t.tp + ' TP (' + usd(t.bertambah, true) + ') · ' + t.sl + ' SL (−' + usd(t.berkurang) + ') · bersih ' + usd(t.bersih, true));

        const tombol = $('apToggle'), pilih = $('apRisiko');
        if (tombol) {
            tombol.disabled = false;
            tombol.setAttribute('aria-checked', d.aktif ? 'true' : 'false');
            tombol.classList.toggle('on', d.aktif);
            tombol.lastChild.textContent = d.aktif ? 'Aktif' : 'Nonaktif';
        }
        if (pilih) {
            const nilai = String(d.risiko_pct);
            if (![...pilih.options].some(o => Number(o.value) === Number(nilai))) pilih.add(new Option(nilai.replace('.', ',') + '%', nilai));
            pilih.value = [...pilih.options].find(o => Number(o.value) === Number(nilai)).value;
        }

        const posisi = $('apPosisi');
        if (posisi) {
            posisi.replaceChildren();
            posisi.hidden = !d.terbuka.length;
            d.terbuka.forEach(p => {
                const baris = el('div', 'qap-pos');
                baris.append(el('b', '', SIMBOL[p.symbol] || p.symbol), el('span', p.side === 'BUY' ? 'qap-up' : 'qap-down', p.side),
                    el('span', '', p.lots + ' lot'), el('span', '', 'entry ' + hargaTeks(p.symbol, p.entry)),
                    el('span', 'qap-down', 'SL ' + hargaTeks(p.symbol, p.sl) + (p.risiko_usd ? ' (−' + usd(p.risiko_usd) + ')' : '')),
                    el('span', 'qap-up', 'TP ' + hargaTeks(p.symbol, p.tp)));
                posisi.append(baris);
            });
        }
        const riwayat = $('apRiwayat');
        if (riwayat) {
            riwayat.replaceChildren();
            if (!d.terbaru.length) {
                riwayat.append(el('div', 'qap-kosong', 'Belum ada transaksi yang selesai.'));
            } else {
                d.terbaru.forEach(tr => {
                    const b = barisTransaksi(tr);
                    const baris = el('div', 'qap-trade');
                    baris.append(el('b', '', b.pair), el('span', b.arah === 'BUY' ? 'qap-up' : 'qap-down', b.arah), el('span', '', b.lot + ' lot'),
                        el('span', 'qap-muted', b.harga), el('span', 'qap-badge ' + (b.naik ? 'tp' : b.turun ? 'sl' : ''), b.hasil),
                        el('strong', b.naik ? 'qap-up' : b.turun ? 'qap-down' : '', b.nominal));
                    riwayat.append(baris);
                });
            }
        }
        const sub = kartu && kartu.querySelector('.qap-sub');
        if (sub) sub.title = 'Maksimal ' + d.batas.maks_terbuka + ' posisi terbuka sekaligus; satu posisi per simbol.';

        // Header: saldo simulasi terkini.
        const tombolSaldo = document.querySelector('.qim-balance-button');
        if (tombolSaldo && tombolSaldo.firstChild && tombolSaldo.firstChild.nodeType === 3) tombolSaldo.firstChild.nodeValue = '$' + angka(d.saldo, 2) + ' SIM ';

        // Banner di panel Auto Analisa.
        const banner = $('apBanner');
        if (banner) {
            banner.hidden = false;
            banner.classList.toggle('on', d.aktif);
            const teks = $('apBannerTeks');
            if (teks) teks.textContent = d.aktif
                ? '🤖 Akun simulasi mengikuti Auto Analisa · saldo ' + usd(d.saldo) + ' · hari ini ' + usd(d.hari_ini.bertambah, true) + ' / −' + usd(d.hari_ini.berkurang)
                : '🤖 Ikuti sinyal ini otomatis di akun simulasi: saldo naik saat TP, turun saat SL.';
            const taut = $('apBannerTaut'); if (taut) taut.textContent = d.aktif ? 'Detail →' : 'Aktifkan →';
        }
    }

    function tolak(pesan, naik) {
        const t = $('apTotal');
        if (t) t.textContent = pesan;
        const tombol = $('apToggle'); if (tombol) tombol.disabled = true;
        const banner = $('apBanner');
        if (banner && naik) {
            banner.hidden = false;
            const teks = $('apBannerTeks'); if (teks) teks.textContent = '🤖 Ikuti Auto Analisa di akun simulasi tersedia untuk paket PRO ke atas.';
            const taut = $('apBannerTaut'); if (taut) { taut.textContent = 'Upgrade →'; taut.onclick = null; taut.href = 'pricing.html'; }
        }
    }

    async function kirim(badan) {
        try {
            const res = await fetch(API, { method: 'POST', headers: headers({ 'Content-Type': 'application/json' }), body: JSON.stringify(badan) });
            const j = await res.json().catch(() => null);
            if (!res.ok || !j || j.status !== 'success') {
                const pesan = (j && j.message) || 'Gagal menyimpan pengaturan.';
                if (typeof root.showQuantumToast === 'function') root.showQuantumToast(pesan, 'error');
                return;
            }
            data = j.data; terakhir = Date.now(); render();
            if (typeof root.showQuantumToast === 'function' && 'aktif' in badan) {
                root.showQuantumToast(data.aktif ? 'Ikuti Auto Analisa aktif: sinyal baru dibuka otomatis di akun simulasi.' : 'Ikuti Auto Analisa dimatikan. Posisi yang masih terbuka tetap berjalan sampai TP/SL.', 'success');
            }
            try { if (typeof root.ptLoadFromServer === 'function') root.ptLoadFromServer(); } catch (e) {}
        } catch (e) { /* jaringan: biarkan tampilan terakhir */ }
    }

    async function muat(paksa) {
        if (memuat || ditolak) return;
        if (Date.now() - terakhir < (paksa ? 15000 : 120000)) return;
        const token = (root.QuantumAuth && root.QuantumAuth.getToken) ? root.QuantumAuth.getToken() : null;
        if (!token) return;
        memuat = true;
        try {
            const res = await fetch(API, { headers: headers(), cache: 'no-store' });
            if (res.status === 403) { ditolak = true; tolak('Ikuti Auto Analisa tersedia untuk paket PRO ke atas.', true); return; }
            if (res.status === 401) return;
            const j = await res.json().catch(() => null);
            if (!res.ok || !j || j.status !== 'success') return;
            data = j.data; terakhir = Date.now(); render();
        } catch (e) { /* tidak mengganggu dashboard */ }
        finally { memuat = false; }
    }

    function panelPaperTerlihat() {
        const p = $('panel-paper');
        return !!p && !p.classList.contains('hidden');
    }

    function pasang() {
        const tombol = $('apToggle'), pilih = $('apRisiko');
        if (tombol) tombol.addEventListener('click', () => {
            if (!data) return;
            kirim({ aktif: !data.aktif, risiko_pct: Number(pilih ? pilih.value : data.risiko_pct) });
        });
        if (pilih) pilih.addEventListener('change', () => { if (data) kirim({ aktif: data.aktif, risiko_pct: Number(pilih.value) }); });
        setTimeout(() => muat(true), 3500);
        setInterval(() => { if (document.hidden) return; muat(panelPaperTerlihat()); }, 20000);
        document.addEventListener('click', e => {
            if (e.target.closest('[data-panel="panel-paper"], [data-mob-panel="panel-paper"], [data-panel="panel-autosignal"], [data-mob-panel="panel-autosignal"]')) setTimeout(() => muat(true), 400);
        });
    }

    const api = { usd, hargaTeks, barisTransaksi };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) {
        root.QIMAutoPaper = Object.assign({ muat }, api);
        if (typeof document !== 'undefined') {
            if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pasang); else pasang();
        }
    }
})(typeof window !== 'undefined' ? window : null);
