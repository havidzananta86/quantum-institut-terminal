/* ═══════════════════════════════════════════════════════════════════════════
   QIM RISIKO — lot otomatis dari Guardrail + pemeriksaan sebelum membuka posisi paper.

   · Membaca Guardrail Risiko Pribadi (api/risk-profile.php): risiko per trade %, batas rugi
     harian %, maks. posisi terbuka.
   · "Lot dari risiko": lot = (ekuitas × risiko%) ÷ (jarak entry–SL × nilai kontrak), dibulatkan
     KE BAWAH ke 0,01 supaya rugi bila SL kena tidak melebihi risiko yang dipilih. Nilai kontrak
     dari model tunggal assets/js/qim-paper-math.js (sama dengan yang dipakai server).
   · Sebelum "+ Buka Posisi": bila melewati guardrail (tanpa SL, rugi > risiko, posisi penuh,
     rugi harian sudah melewati batas) pengguna diberi rincian dan memilih tetap membuka atau
     batal. Guardrail adalah preferensi pribadi (seperti tertulis di halaman Broker), jadi tidak
     memblokir diam-diam.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
    'use strict';
    if (window.QimRisk) return;

    const $ = id => document.getElementById(id);
    // Baca global let/const dashboard-app.js lewat getter-nya (dulu (0, eval)(nama) — dilarang CSP tanpa 'unsafe-eval').
    const g = nama => (typeof window.qiBacaGlobal === 'function' ? window.qiBacaGlobal(nama) : undefined);
    const uang = v => (v < 0 ? '-$' : '$') + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const st = { profil: null, aktif: false };
    try { st.aktif = localStorage.getItem('qim_lot_risiko') === '1'; } catch (e) {}

    async function muatProfil() {
        try {
            const r = await fetch('api/risk-profile.php', { cache: 'no-store' });
            const d = await r.json();
            if (d && d.status === 'success' && d.risk_profile) st.profil = d.risk_profile;
        } catch (e) { /* tetap memakai nilai terakhir / bawaan */ }
        hitung();
    }
    const profil = () => {
        const p = st.profil || {};
        // Nilai yang sedang diketik di form Guardrail (halaman Broker) dipakai bila ada.
        const ambil = (id, def) => { const el = $(id); const v = el ? Number(el.value) : NaN; return Number.isFinite(v) && v > 0 ? v : def; };
        return {
            risiko: ambil('riskPerTradePct', Number(p.risk_per_trade_pct) || 1),
            harian: ambil('maxDailyLossPct', Number(p.max_daily_loss_pct) || 3),
            maksPosisi: ambil('maxOpenPositions', Number(p.max_open_positions) || 3)
        };
    };
    const ekuitas = () => { const b = Number(g('_ptBalance')); return Number.isFinite(b) && b > 0 ? b : 10000; };
    const mult = (sym, harga) => (typeof window.qimPaperMult === 'function' ? window.qimPaperMult(sym, harga) : (typeof window.ptPnlMult === 'function' ? window.ptPnlMult(sym, harga) : 1));

    function bacaForm() {
        const sym = ($('ptSymbol') || {}).value;
        const sisi = ($('ptSide') || {}).value;
        const sl = parseFloat(($('ptSL') || {}).value);
        const lot = parseFloat(($('ptLots') || {}).value);
        const epRaw = ($('ptEntryPrice') || {}).value;
        const harga = g('_lastPrices') || {};
        const live = harga[sym] ? parseFloat(harga[sym].price) : NaN;
        const entry = epRaw ? parseFloat(epRaw) : live;
        return { sym, sisi, sl: Number.isFinite(sl) ? sl : null, lot, entry };
    }

    /** Hitung lot dari risiko; mengembalikan rincian untuk ditampilkan. */
    function rincian(f) {
        const p = profil();
        const risikoUsd = ekuitas() * p.risiko / 100;
        if (!f.sym || !Number.isFinite(f.entry)) return { pesan: 'Menunggu harga live…', p, risikoUsd };
        if (f.sl == null) return { pesan: 'Isi Stop Loss untuk menghitung lot dari risiko ' + p.risiko + '% (' + uang(risikoUsd) + ').', p, risikoUsd };
        const salahSisi = (f.sisi === 'BUY' && f.sl >= f.entry) || (f.sisi === 'SELL' && f.sl <= f.entry);
        if (salahSisi) return { pesan: 'SL harus ' + (f.sisi === 'BUY' ? 'di bawah' : 'di atas') + ' entry untuk posisi ' + f.sisi + '.', p, risikoUsd, salah: true };
        const jarak = Math.abs(f.entry - f.sl);
        const perLot = jarak * mult(f.sym, f.sl);
        const lot = Math.floor(risikoUsd / perLot / 0.01 + 1e-9) * 0.01;
        return { p, risikoUsd, jarak, perLot, lot: Math.round(lot * 100) / 100 };
    }

    function hitung() {
        const info = $('qrInfo');
        if (!info) return;
        const f = bacaForm();
        const r = rincian(f);
        if (r.pesan) { info.textContent = r.pesan; info.className = 'qr-info' + (r.salah ? ' warn' : ''); return; }
        const d = f.sym && f.sym.includes('JPY') ? 3 : (f.entry < 10 ? 5 : 2);
        if (r.lot < 0.01) {
            info.innerHTML = 'Risiko ' + r.p.risiko + '% = ' + uang(r.risikoUsd) + ', tetapi 0,01 lot sudah merugi ' + uang(r.perLot * 0.01) + ' bila SL kena. Perkecil jarak SL atau naikkan risiko.';
            info.className = 'qr-info warn';
            return;
        }
        if (st.aktif) {
            const el = $('ptLots');
            if (el && Math.abs(parseFloat(el.value) - r.lot) > 1e-9) el.value = r.lot.toFixed(2);
        }
        info.innerHTML = 'Risiko ' + r.p.risiko + '% = <b>' + uang(r.risikoUsd) + '</b> · jarak SL ' + r.jarak.toFixed(d) + ' → lot <b>' + r.lot.toFixed(2) + '</b>'
            + ' · rugi bila SL kena ' + uang(r.lot * r.perLot) + (st.aktif ? '' : ' <span class="qr-muted">(aktifkan untuk mengisi otomatis)</span>');
        info.className = 'qr-info';
    }

    /** Daftar pelanggaran guardrail untuk order yang akan dibuka. */
    function periksa() {
        const f = bacaForm();
        const p = profil();
        const masalah = [];
        const terbuka = (g('_ptPositions') || []).length;
        if (terbuka >= p.maksPosisi) masalah.push('Posisi terbuka sudah ' + terbuka + ' (batas Anda ' + p.maksPosisi + ').');
        if (f.sl == null) masalah.push('Tanpa Stop Loss — kerugian tidak dibatasi.');
        else if (Number.isFinite(f.entry) && Number.isFinite(f.lot)) {
            const rugi = Math.abs(f.entry - f.sl) * mult(f.sym, f.sl) * f.lot;
            const batas = ekuitas() * p.risiko / 100;
            if (rugi > batas * 1.02) masalah.push('Rugi bila SL kena ' + uang(rugi) + ' melebihi risiko per trade ' + p.risiko + '% (' + uang(batas) + ').');
        }
        const hariIni = new Date().toDateString();
        const netHariIni = (g('_ptHistory') || []).reduce((s, h) => {
            const t = h.closedAt ? new Date(h.closedAt) : null;
            return (t && t.toDateString() === hariIni) ? s + Number(h.realizedPnL ?? h.pnl ?? 0) : s;
        }, 0);
        const batasHarian = ekuitas() * p.harian / 100;
        if (netHariIni < 0 && -netHariIni >= batasHarian) masalah.push('Rugi bersih hari ini ' + uang(netHariIni) + ' sudah mencapai batas rugi harian ' + p.harian + '% (' + uang(-batasHarian) + ').');
        return masalah;
    }

    function pasang() {
        const lot = $('ptLots');
        if (!lot || $('qrBox')) return false;
        const kotak = document.createElement('div');
        kotak.id = 'qrBox';
        kotak.className = 'qr-box';
        kotak.innerHTML = '<label class="qr-toggle"><input type="checkbox" id="qrAuto"' + (st.aktif ? ' checked' : '') + '> ⚖ Lot dari Guardrail</label>'
            + '<span id="qrInfo" class="qr-info">Memuat guardrail…</span>'
            + '<button type="button" class="qr-link" id="qrAtur">Atur guardrail</button>';
        const baris = lot.closest('.grid') || lot.parentElement;
        baris.insertAdjacentElement('afterend', kotak);
        $('qrAuto').addEventListener('change', e => { st.aktif = e.target.checked; try { localStorage.setItem('qim_lot_risiko', st.aktif ? '1' : '0'); } catch (er) {} hitung(); });
        $('qrAtur').addEventListener('click', () => { if (window.QimPages) window.QimPages.buka('broker'); else if (window.switchPanel) window.switchPanel('panel-account'); });
        ['ptSymbol', 'ptSide', 'ptSL', 'ptEntryPrice'].forEach(id => { const el = $(id); if (el) { el.addEventListener('input', hitung); el.addEventListener('change', hitung); } });
        setInterval(() => { const p = $('panel-paper'); if (p && !p.classList.contains('hidden')) hitung(); }, 1500);

        // Pemeriksaan guardrail sebelum membuka posisi.
        const asli = window.ptOpenPosition;
        if (typeof asli === 'function' && !asli.__qr) {
            const bungkus = function () {
                if (st.aktif) hitung();
                const masalah = periksa();
                if (masalah.length && !window.confirm('Order ini melewati Guardrail Risiko Anda:\n\n• ' + masalah.join('\n• ') + '\n\nTetap buka posisi?')) return;
                return asli.apply(this, arguments);
            };
            bungkus.__qr = true;
            window.ptOpenPosition = bungkus;
        }
        // Simpan guardrail di halaman Broker → perbarui perhitungan di sini.
        const form = $('riskProfileForm');
        if (form) form.addEventListener('submit', () => setTimeout(muatProfil, 800));
        muatProfil();
        return true;
    }

    window.QimRisk = { hitung, periksa, rincian: () => rincian(bacaForm()) };
    const coba = () => { if (!pasang()) setTimeout(coba, 1000); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', coba); else coba();
})();
