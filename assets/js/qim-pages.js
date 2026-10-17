/* ═══════════════════════════════════════════════════════════════════════════
   QIM PAGES — rail ikon kiri + halaman Auto Analisa, Competition, News, Broker, Drawing.

   · Dibangun di ATAS dashboard yang ada: memakai switchPanel(), data & fungsi yang sudah
     ada (refreshAutoSignals, setChartTool, setChartInterval, DrawingManager), tidak
     menyalin logika bisnisnya. Gaya di assets/css/qim-pages.css.
   · Navigasi lama (#dashNav, ±40 panel) tidak dihapus: dipindah ke laci "Semua Panel"
     yang dibuka dari tombol gerigi di rail, jadi tidak ada fitur yang hilang.
   · Kejujuran data: papan peringkat dari paper trading nyata (api/competition.php),
     hadiah contoh ditandai "contoh", deskripsi kartu sinyal diturunkan dari matriks
     multi-timeframe — tidak ada angka yang dikarang.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
    'use strict';
    if (window.QimPages) return;

    const $ = id => document.getElementById(id);
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const ikon = (isi, vb) => '<svg viewBox="' + (vb || '0 0 24 24') + '" aria-hidden="true">' + isi + '</svg>';
    const toast = (m, t) => { try { if (typeof window.showQuantumToast === 'function') window.showQuantumToast(m, t || 'info', 4000); } catch (e) {} };
    const simpan = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
    const baca = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
    const g = (nama) => { try { return (0, eval)(nama); } catch (e) { return undefined; } };   // baca global let/const dashboard-app.js

    const I = {
        chart: '<path d="M7 3v4M7 17v4M17 3v6M17 15v6"/><rect x="5" y="7" width="4" height="10" rx="1"/><rect x="15" y="9" width="4" height="6" rx="1"/>',
        robot: '<rect x="4" y="8" width="16" height="11" rx="3"/><path d="M12 4.5V8M9 13h.01M15 13h.01M9.5 16h5M2 12.5v3M22 12.5v3"/><circle cx="12" cy="3.5" r="1"/>',
        trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4.5M16 6h3a3 3 0 0 1-3 4.5M12 13v4M8 21h8M9.5 17h5v4h-5z"/>',
        news: '<rect x="3" y="5" width="14" height="15" rx="2"/><path d="M17 9h3a1 1 0 0 1 1 1v8a2 2 0 0 1-2 2H5M6.5 9h7M6.5 12.5h7M6.5 16h4"/>',
        plug: '<path d="M9 2v5M15 2v5M6.5 7h11v3.5a5.5 5.5 0 0 1-11 0zM12 16v6"/>',
        pencil: '<path d="M4 20l4.2-1L19 8.2 15.8 5 5 15.8z"/><path d="M13.6 7.2l3.2 3.2"/>',
        gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6"/><circle cx="12" cy="12" r="7"/>',
        pin: '<path d="M12 21s-6-5.3-6-10a6 6 0 0 1 12 0c0 4.7-6 10-6 10z"/><circle cx="12" cy="11" r="2"/>',
        refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>',
        history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2"/>',
        up: '<path d="M12 19V5M5 12l7-7 7 7"/>',
        down: '<path d="M12 5v14M5 12l7 7 7-7"/>',
        minus: '<path d="M5 12h14"/>',
        user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
        clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
        search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
        link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
        bars: '<path d="M5 20V12M10 20V8M15 20V4M20 20v-6"/>',
        shield: '<path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z"/>',
        idcard: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="10" r="3"/><path d="M6.5 18a6.5 6.5 0 0 1 11 0"/>'
    };

    // ── Ikon aset & bendera (SVG sederhana; Windows tidak punya glyph emoji bendera) ──
    function benderaSvg(kode) {
        const k = String(kode || '').toUpperCase();
        const box = isi => ikon(isi, '0 0 30 30');
        if (k === 'EUR' || k === 'EU') {
            let bintang = '';
            for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; bintang += '<circle cx="' + (15 + 8 * Math.cos(a)).toFixed(1) + '" cy="' + (15 + 8 * Math.sin(a)).toFixed(1) + '" r="1.3" fill="#ffcc00"/>'; }
            return box('<rect width="30" height="30" fill="#003399"/>' + bintang);
        }
        if (k === 'GBP' || k === 'GB') return box('<rect width="30" height="30" fill="#012169"/><path d="M0 0L30 30M30 0L0 30" stroke="#fff" stroke-width="6"/><path d="M0 0L30 30M30 0L0 30" stroke="#c8102e" stroke-width="2"/><path d="M15 0v30M0 15h30" stroke="#fff" stroke-width="9"/><path d="M15 0v30M0 15h30" stroke="#c8102e" stroke-width="5"/>');
        if (k === 'JPY' || k === 'JP') return box('<rect width="30" height="30" fill="#fff"/><circle cx="15" cy="15" r="7" fill="#bc002d"/>');
        if (k === 'AUD' || k === 'AU' || k === 'NZD' || k === 'NZ') {
            const merah = (k === 'NZD' || k === 'NZ');
            return box('<rect width="30" height="30" fill="#012169"/><path d="M0 0L14 14M14 0L0 14" stroke="#fff" stroke-width="3"/><path d="M7 0v14M0 7h14" stroke="#fff" stroke-width="4"/><path d="M7 0v14M0 7h14" stroke="#c8102e" stroke-width="2"/>'
                + ['21,9', '24,15', '19,20', '22,25', '9,23'].map(p => '<circle cx="' + p.split(',')[0] + '" cy="' + p.split(',')[1] + '" r="1.7" fill="' + (merah ? '#c8102e' : '#fff') + '" stroke="#fff" stroke-width=".5"/>').join(''));
        }
        if (k === 'CHF' || k === 'CH') return box('<rect width="30" height="30" fill="#da291c"/><path d="M15 8v14M8 15h14" stroke="#fff" stroke-width="4.5"/>');
        if (k === 'CAD' || k === 'CA') return box('<rect width="30" height="30" fill="#fff"/><rect width="8" height="30" fill="#d52b1e"/><rect x="22" width="8" height="30" fill="#d52b1e"/><path d="M15 8l1.6 3.4 2.6-.8-.9 4.2 2.2-.6-3.3 3.5.5 2.3H14.3l.5-2.3-3.3-3.5 2.2.6-.9-4.2 2.6.8z" fill="#d52b1e"/>');
        if (k === 'USD' || k === 'US') return box('<rect width="30" height="30" fill="#fff"/>' + [0, 2, 4, 6, 8, 10, 12].map(i => '<rect y="' + (i * 2.31) + '" width="30" height="2.31" fill="#b22234"/>').join('') + '<rect width="14" height="16" fill="#3c3b6e"/>');
        if (k === 'ID') return box('<rect width="30" height="15" fill="#e70011"/><rect y="15" width="30" height="15" fill="#fff"/>');
        if (k === 'SG') return box('<rect width="30" height="15" fill="#ef3340"/><rect y="15" width="30" height="15" fill="#fff"/><circle cx="8" cy="7.5" r="4" fill="#fff"/><circle cx="9.5" cy="7.5" r="3.6" fill="#ef3340"/>');
        if (k === 'MY') return box([0, 2, 4, 6, 8, 10, 12].map(i => '<rect y="' + (i * 2.14) + '" width="30" height="2.14" fill="#cc0001"/>').join('') + '<rect width="15" height="15" fill="#010066"/><circle cx="7" cy="7.5" r="4" fill="#fc0"/><circle cx="8.3" cy="7.5" r="3.3" fill="#010066"/>');
        if (k === 'KR') return box('<rect width="30" height="30" fill="#fff"/><path d="M9 15a6 6 0 0 1 12 0z" fill="#cd2e3a"/><path d="M9 15a6 6 0 0 0 12 0z" fill="#0047a0"/>');
        if (k === 'DE') return box('<rect width="30" height="10" fill="#000"/><rect y="10" width="30" height="10" fill="#dd0000"/><rect y="20" width="30" height="10" fill="#ffce00"/>');
        if (k === 'CN') return box('<rect width="30" height="30" fill="#ee1c25"/><path d="M8 5l1.5 4.5H14l-3.7 2.7 1.4 4.4L8 13.9l-3.7 2.7 1.4-4.4L2 9.5h4.5z" fill="#ffde00"/>');
        return null;
    }
    const NAMA_NEGARA = { ID: 'Indonesia', SG: 'Singapore', MY: 'Malaysia', JP: 'Japan', US: 'USA', GB: 'UK', AU: 'Australia', KR: 'Korea', DE: 'Germany', CN: 'China', PH: 'Philippines', TH: 'Thailand', VN: 'Vietnam', IN: 'India', NZ: 'New Zealand', CA: 'Canada' };

    function ikonAset(sym) {
        const s = String(sym || '').toUpperCase().replace('/', '');
        if (s.startsWith('XAU') || s === 'GOLD') return '<span class="qim-asset gold">Au</span>';
        if (s.startsWith('BTC')) return '<span class="qim-asset btc">₿</span>';
        if (s.startsWith('ETH')) return '<span class="qim-asset eth">◆</span>';
        if (s.startsWith('SOL')) return '<span class="qim-asset sol">S</span>';
        if (s.length === 6) {
            const base = s.slice(0, 3), kuot = s.slice(3);
            const mata = base === 'USD' ? kuot : base;
            const svg = benderaSvg(mata);
            if (svg) return '<span class="qim-asset">' + svg + '</span>';
        }
        return '<span class="qim-asset" style="background:#22324f">' + esc(s.slice(0, 2)) + '</span>';
    }

    // ═════════════════════════════════════════════════════════════════════════
    // NAVIGASI: rail, top nav, mode halaman
    // ═════════════════════════════════════════════════════════════════════════
    const HALAMAN = [
        { kunci: 'chart', panel: 'panel-charts', label: 'Chart', ikon: 'chart' },
        { kunci: 'auto', panel: 'panel-autosignal', label: 'Auto Analisa', ikon: 'robot' },
        { kunci: 'competition', panel: 'panel-competition', label: 'Competition', ikon: 'trophy' },
        { kunci: 'news', panel: 'panel-news', label: 'News', ikon: 'news' },
        { kunci: 'broker', panel: 'panel-account', label: 'Broker', ikon: 'plug' },
        { kunci: 'drawing', panel: 'panel-charts', label: 'Drawing', ikon: 'pencil' }
    ];
    const state = { drawing: false, page: '' };

    function panelAktif() { const p = g('_activePanel'); return typeof p === 'string' ? p : ''; }

    function buka(kunci) {
        const h = HALAMAN.find(x => x.kunci === kunci);
        if (!h) return;
        state.drawing = kunci === 'drawing';
        tutupLaci();
        if (typeof window.switchPanel === 'function') window.switchPanel(h.panel);
        terapkan();
    }

    function terapkan() {
        const panel = panelAktif();
        if (panel !== 'panel-charts') state.drawing = false;
        let page = '';
        if (panel === 'panel-charts') page = state.drawing ? 'drawing' : 'chart';
        else { const h = HALAMAN.find(x => x.panel === panel); page = h ? h.kunci : ''; }
        state.page = page;
        document.body.dataset.qimPage = page;
        document.body.classList.toggle('qim-drawing', page === 'drawing');
        document.querySelectorAll('.qim-rail-btn[data-page]').forEach(b => b.classList.toggle('active', b.dataset.page === page));
        document.querySelectorAll('.qim-top-link[data-qim-page]').forEach(b => b.classList.toggle('active', b.dataset.qimPage === page));

        if (page === 'auto') siapkanAuto();
        if (page === 'competition') muatKompetisi();
        if (page === 'news') siapkanNews();
        if (page === 'broker') siapkanBroker();
        if (page === 'drawing') siapkanDrawing();
        if (panel === 'panel-track') siapkanTrack();
        if (page === 'chart') { siapkanAlatGambar(); jagaManager(); }
        if (page === 'chart' || page === 'drawing') siapkanKepalaChart();
        else { tutupPopover(); if (ch.replay) hentikanReplay(); }
        if (page === 'auto' || page === 'news') mulaiTicker(); else hentikanTicker();
        if (page === 'drawing' || page === 'chart') {
            // Ukuran area chart berubah (panel daftar gambar muncul/hilang) → minta chart menyesuaikan.
            setTimeout(() => { try { window.dispatchEvent(new Event('resize')); } catch (e) {} }, 60);
        }
    }

    function bangunRail() {
        if ($('qimRail')) return;
        const rail = document.createElement('nav');
        rail.id = 'qimRail';
        rail.className = 'qim-rail';
        rail.setAttribute('aria-label', 'Navigasi halaman');
        rail.innerHTML = HALAMAN.map(h => '<button type="button" class="qim-rail-btn" data-page="' + h.kunci + '" data-tip="' + h.label + '" aria-label="' + h.label + '">' + ikon(I[h.ikon]) + '</button>').join('')
            + '<span class="qim-rail-spacer"></span>'
            + '<button type="button" class="qim-rail-btn" id="qimRailSemua" data-tip="Semua panel & pengaturan" aria-label="Semua panel dan pengaturan" aria-expanded="false">' + ikon(I.gear) + '</button>';
        const sb = $('sidebar');
        if (!sb) return;
        sb.parentNode.insertBefore(rail, sb);
        document.body.classList.add('qim-has-rail');
        rail.querySelectorAll('[data-page]').forEach(b => b.addEventListener('click', () => buka(b.dataset.page)));
        $('qimRailSemua').addEventListener('click', bukaTutupLaci);

        // Laci "Semua Panel": navigasi lama dipindah ke sini (tetap berfungsi penuh).
        const laci = document.createElement('div');
        laci.id = 'qimAllPanels';
        laci.className = 'qim-allpanels';
        laci.innerHTML = '<div class="qim-allpanels-head"><span>Semua Panel</span><button type="button" aria-label="Tutup">✕</button></div>';
        document.body.appendChild(laci);
        laci.querySelector('button').addEventListener('click', tutupLaci);
        const nav = $('dashNav');
        if (nav) laci.appendChild(nav);
        // Sisa isi kolom kiri lama (Install App, Profil Saya, dst.) ikut ke laci.
        Array.from(sb.children).forEach(c => { if (!c.classList.contains('qim-side-widgets') && !c.classList.contains('qim-old-brand')) laci.appendChild(c); });
        laci.addEventListener('click', e => { if (e.target.closest('[data-panel]')) setTimeout(tutupLaci, 50); });
        document.addEventListener('keydown', e => { if (e.key === 'Escape') tutupLaci(); });
    }
    function bukaTutupLaci() {
        const l = $('qimAllPanels'); if (!l) return;
        const buka = !l.classList.contains('open');
        l.classList.toggle('open', buka);
        $('qimRailSemua')?.setAttribute('aria-expanded', String(buka));
    }
    function tutupLaci() { $('qimAllPanels')?.classList.remove('open'); $('qimRailSemua')?.setAttribute('aria-expanded', 'false'); }

    function ikatTopNav() {
        document.querySelectorAll('.qim-top-link').forEach(b => {
            const h = HALAMAN.find(x => x.label.toLowerCase() === b.textContent.trim().toLowerCase());
            if (!h) return;
            b.removeAttribute('onclick');
            b.removeAttribute('data-qim-panel');
            b.dataset.qimPage = h.kunci;
            b.addEventListener('click', () => buka(h.kunci));
        });
    }

    function kartuPengguna() {
        const wadah = document.querySelector('#sidebar .qim-side-widgets');
        if (!wadah || $('qimUserCard')) return;
        let nama = 'Trader', peran = String(window.QI_PERAN || 'free').toUpperCase();
        try {
            const u = JSON.parse(localStorage.getItem('qi_user') || sessionStorage.getItem('qi_user') || '{}');
            nama = u.full_name || u.name || localStorage.getItem('qi_user_name') || nama;
            if (u.role) peran = String(u.role).toUpperCase();
        } catch (e) {}
        const inisial = nama.split(/\s+/).map(x => x[0]).join('').slice(0, 2).toUpperCase();
        const kartu = document.createElement('section');
        kartu.id = 'qimUserCard';
        kartu.className = 'qim-card qim-user-card';
        kartu.innerHTML = '<span class="qim-user-avatar">' + esc(inisial) + '</span><span><b>' + esc(nama) + '</b><small>MARKET TERMINAL'
            + (peran && peran !== 'FREE' && peran !== 'USER' ? ' <i>' + esc(peran) + '</i>' : '') + '</small></span>'
            + '<a href="profile.html" aria-label="Profil & keamanan" title="Profil & keamanan">⋮</a>';
        wadah.appendChild(kartu);
    }

    // ═════════════════════════════════════════════════════════════════════════
    // PITA HARGA BERBENTUK SEL (Auto Analisa & News)
    // ═════════════════════════════════════════════════════════════════════════
    const TICK = [['BTCUSDT', 'BTC/USDT'], ['ETHUSDT', 'ETH/USDT'], ['BNBUSDT', 'BNB/USDT'], ['XRPUSDT', 'XRP/USDT'], ['DOGEUSDT', 'DOGE/USDT'],
        ['SOLUSDT', 'SOL/USDT'], ['XAUUSD', 'XAU/USD'], ['GBPUSD', 'GBP/USD'], ['USDJPY', 'USD/JPY'], ['AUDUSD', 'AUD/USD']];
    let tickTimer = null;
    function fmtHarga(v) {
        const n = Number(v);
        if (!Number.isFinite(n)) return '—';
        const d = n >= 1000 ? 2 : n >= 100 ? 3 : n >= 10 ? 3 : n >= 1 ? 4 : 5;
        return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
    }
    function bangunTicker() {
        if ($('qimTickerGrid')) return;
        const scroll = $('mainScroll');
        if (!scroll) return;
        const grid = document.createElement('div');
        grid.id = 'qimTickerGrid';
        grid.className = 'qim-tickergrid';
        grid.setAttribute('aria-label', 'Harga pasar');
        grid.style.gridTemplateColumns = 'repeat(' + TICK.length + ', minmax(92px, 1fr))';
        grid.innerHTML = TICK.map(([s, l]) => '<div class="qim-tick" data-sym="' + s + '"><span>' + l + '</span><b>—</b><em>—</em></div>').join('');
        scroll.insertBefore(grid, scroll.firstChild);
    }
    async function segarkanTicker() {
        try {
            const r = await fetch('api/live-price.php?symbols=' + TICK.map(t => t[0]).join(','), { cache: 'no-store' });
            const d = await r.json();
            const p = (d && d.prices) || {};
            document.querySelectorAll('#qimTickerGrid .qim-tick').forEach(sel => {
                const x = p[sel.dataset.sym];
                if (!x) return;
                const c = Number(x.chgPct);
                sel.querySelector('b').textContent = fmtHarga(x.price);
                const em = sel.querySelector('em');
                em.textContent = Number.isFinite(c) ? (c >= 0 ? '+' : '') + c.toFixed(1) + '%' : '—';
                em.className = Number.isFinite(c) ? (c >= 0 ? 'qim-up' : 'qim-down') : '';
            });
        } catch (e) { /* jaringan putus: biarkan nilai terakhir */ }
    }
    function mulaiTicker() { if (tickTimer) return; segarkanTicker(); tickTimer = setInterval(() => { if (document.visibilityState === 'visible') segarkanTicker(); }, 15000); }
    function hentikanTicker() { clearInterval(tickTimer); tickTimer = null; }

    // ═════════════════════════════════════════════════════════════════════════
    // KEPALA HALAMAN BERSAMA
    // ═════════════════════════════════════════════════════════════════════════
    function sesiAktif() {
        const j = new Date().getUTCHours();
        const sesi = [];
        if (j >= 21 || j < 6) sesi.push('Sydney');
        if (j >= 0 && j < 9) sesi.push('Tokyo');
        if (j >= 7 && j < 16) sesi.push('London');
        if (j >= 12 && j < 21) sesi.push('New York');
        return sesi.length ? sesi.join(' • ') : 'Pasar sepi';
    }
    const jamKini = (detik) => new Date().toLocaleTimeString('en-GB', detik ? {} : { hour: '2-digit', minute: '2-digit' });
    function metaSesi(idUpdated) {
        return '<span class="qim-head-meta">' + ikon(I.pin) + '<span data-qim-sesi>' + esc(sesiAktif()) + '</span></span>'
            + '<span class="qim-head-meta">Updated: <span id="' + idUpdated + '">' + jamKini() + '</span></span>';
    }
    setInterval(() => document.querySelectorAll('[data-qim-sesi]').forEach(e => { e.textContent = sesiAktif(); }), 60000);

    // ═════════════════════════════════════════════════════════════════════════
    // AUTO ANALISA
    // ═════════════════════════════════════════════════════════════════════════
    let autoSiap = false;
    function siapkanAuto() {
        const panel = $('panel-autosignal');
        if (!panel || autoSiap) return;
        autoSiap = true;
        const lama = panel.firstElementChild;
        if (lama) lama.classList.add('qim-hide');
        const kepala = document.createElement('div');
        kepala.className = 'qim-page-head';
        kepala.innerHTML = '<h1>Auto Signal</h1><span class="qim-live">LIVE</span><span class="qim-bo-chip" title="Sinyal baru ditahan di sekitar berita berdampak tinggi">⛔ Blackout berita</span>' + metaSesi('qimAutoUpdated')
            + '<div class="qim-head-actions"><button type="button" class="qim-btn" data-aksi="refresh">' + ikon(I.refresh) + 'Refresh</button>'
            + '<button type="button" class="qim-btn" data-aksi="riwayat">' + ikon(I.history) + 'Riwayat</button></div>'
            + '<p>Sinyal buy/sell otomatis dari 9 mesin kuantum — semua pair</p>';
        panel.insertBefore(kepala, panel.firstChild);
        kepala.querySelector('[data-aksi="refresh"]').addEventListener('click', () => { if (typeof window.refreshAutoSignals === 'function') window.refreshAutoSignals(); });
        kepala.querySelector('[data-aksi="riwayat"]').addEventListener('click', () => window.switchPanel && window.switchPanel('panel-track'));

        // Tiga ubin ringkasan berwarna dengan ikon (elemen hitungan lama dipertahankan → id tetap).
        const ubin = [['asBuyCount', 'buy', 'BUY Aktif', I.up], ['asSellCount', 'sell', 'SELL Aktif', I.down], ['asWaitCount', 'wait', 'WAIT / Neutral', I.minus]];
        ubin.forEach(([id, kelas, label, svg]) => {
            const angka = $(id);
            const kotak = angka && angka.parentElement;
            if (!kotak) return;
            kotak.className = 'qas-tile ' + kelas;
            angka.className = 'qas-tile-num';
            kotak.innerHTML = '';
            const ik = document.createElement('span'); ik.className = 'qas-tile-icon'; ik.innerHTML = ikon(svg);
            const teks = document.createElement('div');
            teks.innerHTML = '<div class="qas-tile-label">' + label + '</div>';
            teks.appendChild(angka);
            kotak.append(ik, teks);
        });

        // Catat waktu pembaruan setiap kali refreshAutoSignals selesai.
        const asli = window.refreshAutoSignals;
        if (typeof asli === 'function' && !asli.__qim) {
            const bungkus = async function () {
                const h = await asli.apply(this, arguments);
                const u = $('qimAutoUpdated'); if (u) u.textContent = jamKini();
                return h;
            };
            bungkus.__qim = true;
            window.refreshAutoSignals = bungkus;
        }
        const grid = $('asSignalGrid');
        if (grid) grid.addEventListener('click', e => { const b = e.target.closest('[data-why]'); if (b) bukaAlasan(b, b.dataset.why); });
        if (grid && !grid.querySelector('.qas-card') && typeof window.refreshAutoSignals === 'function') window.refreshAutoSignals();
    }

    const NAMA_MESIN = { AUTO_SIGNAL: 'Auto Signal', AI: 'AI Engine', NEWS: 'News Engine', TRADINGVIEW: 'TradingView', TV: 'TradingView' };
    function sumberRingkas(s) {
        if (!s) return '';
        let m = /rekor server \(([A-Z_]+)/i.exec(s);
        if (m) return NAMA_MESIN[m[1].toUpperCase()] || m[1];
        m = /Rencana TradingView \(([^·)]+)/i.exec(s);
        if (m) return 'Rencana TV ' + m[1].trim();
        return s.length > 22 ? s.slice(0, 22) + '…' : s;
    }
    function arahDari(v) { const s = String(v || '').toUpperCase(); return s.includes('BUY') ? 'buy' : s.includes('SELL') ? 'sell' : 'wait'; }
    function deskripsiMtf(mtf, dir) {
        if (!mtf) return 'Data matriks live belum tersedia untuk pair ini.';
        const tf = ['15m', '1h', '4h', '1D'].map(k => arahDari(mtf[k]));
        const nb = tf.filter(x => x === 'buy').length, ns = tf.filter(x => x === 'sell').length;
        if (nb === 4) return 'Tren naik selaras di semua timeframe.';
        if (ns === 4) return 'Tren turun selaras di semua timeframe.';
        if (nb === 3) return 'Tekanan beli dominan di 3 dari 4 timeframe.';
        if (ns === 3) return 'Tekanan jual dominan di 3 dari 4 timeframe.';
        if (tf[0] !== 'wait' && tf[3] !== 'wait' && tf[0] !== tf[3]) return 'Gerak jangka pendek berlawanan dengan tren harian — waspadai koreksi.';
        if (dir === 'WAIT') return 'Arah antar-timeframe belum seragam — tunggu konfirmasi.';
        return 'Sinyal ' + dir + ' aktif; konfirmasi antar-timeframe masih campuran.';
    }

    /** Templat kartu sinyal; dipanggil dari refreshAutoSignals() (dashboard-app.js). */
    function qimKartuSinyal(d) {
        const dir = (d.dir === 'BUY' || d.dir === 'SELL') ? d.dir : 'WAIT';
        const kelas = dir === 'BUY' ? 'buy' : dir === 'SELL' ? 'sell' : 'wait';
        const badge = dir === 'WAIT' ? 'WAIT' : (d.kuat ? 'STRONG ' + dir : dir);
        const baris = [];
        baris.push('<dt>Entry</dt><dd>' + esc(d.entry) + '</dd>');
        if (d.tp != null) baris.push('<dt>TP</dt><dd>' + esc(d.tp) + '</dd>');
        if (d.sl != null) baris.push('<dt>SL</dt><dd>' + esc(d.sl) + '</dd>');
        if (d.sumber) baris.push('<dt>Sumber</dt><dd class="qas-src" title="' + esc(d.sumber + (d.rr ? ' · ' + d.rr : '')) + '">' + esc(sumberRingkas(d.sumber)) + '</dd>');
        else baris.push('<dt>Sumber</dt><dd class="qas-none">belum ada setup (tidak dikarang)</dd>');
        if (d.rsi != null && d.rsi !== '') baris.push('<dt>RSI</dt><dd>' + esc(Number.isFinite(Number(d.rsi)) ? Number(d.rsi).toFixed(1) : d.rsi) + '</dd>');
        const mtf = d.mtf
            ? '<div class="qas-mtf"><div class="qas-mtf-title">Multi Timeframe:</div>' + ['15m', '1h', '4h', '1D'].map(k => {
                const v = String(d.mtf[k] || '—').replace(/_/g, ' ');
                return '<div><span>' + k + ':</span><b class="' + arahDari(v) + '">' + esc(v) + '</b></div>';
            }).join('') + '</div>'
            : '<div class="qas-mtf"><div class="qas-mtf-title">Multi Timeframe:</div><span>belum tersedia</span></div>';
        const kenapa = (d.sumber && /rekor server/i.test(d.sumber))
            ? ' <button type="button" class="qas-why" data-ch="why-' + esc(d.sym) + '" data-why="' + esc(d.sym) + '">Kenapa sinyal ini?</button>' : '';
        const kaki = d.catatan
            ? '<div class="qas-foot warn">⚠ ' + esc(d.catatan) + kenapa + '</div>'
            : '<div class="qas-foot">' + esc(deskripsiMtf(d.mtf, dir)) + kenapa + '</div>';
        return '<div class="qas-card"><div class="qas-head">' + ikonAset(d.sym) + '<span class="qas-pair">' + esc(d.label) + '</span>'
            + '<span class="qas-badge ' + kelas + '">' + esc(badge) + '</span></div>'
            + '<div class="qas-body"><dl class="qas-levels">' + baris.join('') + '</dl>' + mtf + '</div>' + kaki + '</div>';
    }
    window.qimKartuSinyal = qimKartuSinyal;

    // ═════════════════════════════════════════════════════════════════════════
    // COMPETITION
    // ═════════════════════════════════════════════════════════════════════════
    const komp = { papan: 'global', data: null, timer: null, memuat: false, aturanBuka: false };
    const uang = (n, tanda) => { const v = Number(n) || 0; return (tanda && v > 0 ? '+' : (v < 0 ? '-' : '')) + '$' + Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: 0 }); };
    const persen = n => (Number(n) > 0 ? '+' : '') + Number(n || 0).toFixed(1) + '%';

    function bangunPanelKompetisi() {
        if ($('panel-competition')) return;
        const scroll = $('mainScroll'); if (!scroll) return;
        const p = document.createElement('div');
        p.id = 'panel-competition';
        p.className = 'panel-content hidden qim-page';
        p.innerHTML = '<div class="qim-page-head"><h1>Competition</h1><p>Turnamen trading mingguan &amp; bulanan — uji strategi, raih hadiah</p></div><div id="qcompBody"><div class="qcomp-empty">Memuat kompetisi…</div></div>';
        scroll.appendChild(p);
        try { const meta = g('PANEL_META'); if (meta && !meta['panel-competition']) meta['panel-competition'] = { icon: '🏆', title: 'Competition' }; } catch (e) {}
        p.addEventListener('click', klikKompetisi);
        p.addEventListener('submit', simpanProfilKompetisi);
    }

    function trofiSvg() {
        return '<svg viewBox="0 0 120 150" aria-hidden="true"><defs><linearGradient id="qtg" x1="0" x2="1"><stop offset="0" stop-color="#b9770e"/><stop offset=".45" stop-color="#ffe08a"/><stop offset="1" stop-color="#c98a00"/></linearGradient></defs>'
            + '<path d="M28 18h64v30a32 32 0 0 1-64 0z" fill="url(#qtg)"/><path d="M28 26H12a18 18 0 0 0 20 22M92 26h16a18 18 0 0 1-20 22" fill="none" stroke="url(#qtg)" stroke-width="6"/>'
            + '<path d="M52 78h16v20H52z" fill="url(#qtg)"/><path d="M38 98h44v10H38zM30 108h60v14H30z" fill="url(#qtg)"/>'
            + '<path d="M60 30l7 14h-14z M53 44l7 10 7-10" fill="#fff6" /><text x="60" y="118" text-anchor="middle" font-size="9" font-weight="700" fill="#5a3b00">QIM</text></svg>';
    }
    function lencanaSvg(t) {
        if (!t) return '<span class="qim-muted">—</span>';
        const w = { diamond: ['#7dd3fc', '#2563eb'], platinum: ['#e2e8f0', '#64748b'], gold: ['#fde68a', '#d97706'], silver: ['#f1f5f9', '#94a3b8'] }[t] || ['#94a3b8', '#475569'];
        return '<span class="qcomp-badge" title="' + t + '"><svg viewBox="0 0 24 24"><path d="M12 2l8 3v6c0 5-3.5 9.5-8 11-4.5-1.5-8-6-8-11V5z" fill="' + w[1] + '" stroke="' + w[0] + '" stroke-width="1.5"/><path d="M12 7l1.5 3 3.3.4-2.4 2.3.6 3.3-3-1.6-3 1.6.6-3.3-2.4-2.3 3.3-.4z" fill="' + w[0] + '"/></svg></span>';
    }
    function sisaWaktu(iso, ringkas) {
        const ms = new Date(iso).getTime() - Date.now();
        if (!Number.isFinite(ms) || ms <= 0) return 'Selesai';
        const h = Math.floor(ms / 864e5), j = Math.floor(ms % 864e5 / 36e5), m = Math.floor(ms % 36e5 / 6e4);
        if (ringkas) return h > 0 ? h + ' hari' : j > 0 ? j + ' jam' : m + ' mnt';
        return (h ? h + ' Hari ' : '') + j + ' Jam ' + m + ' Menit';
    }
    function rentangTanggal(mulai, selesai) {
        const a = new Date(mulai), b = new Date(new Date(selesai).getTime() - 1);
        const bulan = b.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
        return a.getDate() + ' - ' + b.getDate() + ' ' + bulan;
    }

    async function muatKompetisi(papan) {
        bangunPanelKompetisi();
        if (papan) komp.papan = papan;
        if (komp.memuat) return;
        komp.memuat = true;
        try {
            const r = await fetch('api/competition.php?papan=' + encodeURIComponent(komp.papan), { cache: 'no-store' });
            const d = await r.json().catch(() => ({}));
            if (!r.ok || d.status !== 'success') {
                $('qcompBody').innerHTML = '<div class="qcomp-empty">' + esc(d.message || ('Gagal memuat (HTTP ' + r.status + ')')) + '</div>';
                return;
            }
            komp.data = d;
            renderKompetisi();
        } catch (e) {
            $('qcompBody').innerHTML = '<div class="qcomp-empty">Tidak dapat menghubungi server kompetisi.</div>';
        } finally { komp.memuat = false; }
        clearInterval(komp.timer);
        komp.timer = setInterval(() => {
            if (state.page !== 'competition') return;
            const t = komp.data && komp.data.turnamen;
            const el = $('qcompSisa'); if (el && t) el.textContent = sisaWaktu(t.selesai);
            document.querySelectorAll('[data-qcomp-sisa]').forEach(x => { x.textContent = sisaWaktu(x.dataset.qcompSisa, true); });
        }, 30000);
    }

    function renderKompetisi() {
        const d = komp.data, t = d.turnamen, saya = d.saya;
        const contoh = t.hadiah_contoh ? '<span class="qim-chip-contoh" title="Nilai hadiah belum ditetapkan admin (cache/competition.json)">contoh</span>' : '';
        const medali = ['gold', 'silver', 'bronze', 'team'];
        const hadiah = t.hadiah.map((h, i) => '<div class="qcomp-prize' + (i === 0 ? ' first' : '') + '"><span class="medal ' + (medali[i] || 'team') + '">' + (i < 3 ? '🏆' : '👥') + '</span><div><span>' + esc(h.label) + '</span><b>' + uang(h.nilai) + (h.total ? ' <small>(total)</small>' : '') + '</b></div></div>').join('');

        const tabs = [['global', 'Global'], ['indonesia', 'Indonesia'], ['friends', 'Friends'], ['weekly', 'Weekly'], ['monthly', 'Monthly']]
            .map(([k, l]) => '<button type="button" class="qcomp-tab' + (komp.papan === k ? ' active' : '') + '" data-papan="' + k + '">' + l + '</button>').join('');

        const barisTabel = b => {
            const neg = b.negara ? (benderaSvg(b.negara) || '') : '';
            return '<tr class="' + (b.saya ? 'me' : '') + '"><td><span class="qcomp-rank' + (b.rank <= 3 ? ' r' + b.rank : '') + '">' + b.rank + '</span></td>'
                + '<td><span class="qcomp-trader"><span class="qcomp-avatar">' + esc(String(b.nama).slice(0, 1).toUpperCase()) + '</span>' + esc(b.nama) + '</span></td>'
                + '<td>' + (b.negara ? '<span class="qcomp-flag">' + neg + esc(NAMA_NEGARA[b.negara] || b.negara) + '</span>' : '<span class="qim-muted">—</span>') + '</td>'
                + '<td class="num ' + (b.profit_pct >= 0 ? 'qim-up' : 'qim-down') + '">' + persen(b.profit_pct) + '</td>'
                + '<td class="num">' + b.trades + '</td><td class="num">' + b.win_rate + '%</td><td class="num">' + uang(b.equity) + '</td>'
                + '<td>' + (b.terdaftar ? lencanaSvg(b.lencana) : '<span class="qim-muted" title="Belum mendaftar turnamen minggu ini">—</span>') + '</td></tr>';
        };
        let isiTabel = d.papan.baris.map(barisTabel).join('');
        if (d.papan.saya_di_luar) isiTabel += '<tr><td colspan="8" class="qim-muted" style="text-align:center">⋯</td></tr>' + barisTabel(d.papan.saya_di_luar);
        const kosong = {
            friends: 'Belum ada teman dengan trade tertutup. Undang teman lewat Partner Program (Profil → Referral).',
            indonesia: 'Belum ada trader Indonesia di papan. Atur negara Anda di kartu "Your Stats".',
            weekly: 'Belum ada trade yang ditutup minggu ini.',
            monthly: 'Belum ada trade yang ditutup bulan ini.'
        }[komp.papan] || 'Belum ada trader dengan paper trade tertutup. Tutup posisi di Paper Trading untuk masuk papan.';
        const tabel = isiTabel
            ? '<table class="qcomp-table"><thead><tr><th>#</th><th>Trader</th><th>Country</th><th>Profit %</th><th>Total Trade</th><th>Win Rate</th><th>Equity</th><th>Badge</th></tr></thead><tbody>' + isiTabel + '</tbody></table>'
            : '<div class="qcomp-empty">' + esc(kosong) + '</div>';

        const opsiNegara = ['', ...Object.keys(NAMA_NEGARA)].map(k => '<option value="' + k + '"' + (d.profil.negara === k ? ' selected' : '') + '>' + (k ? k + ' · ' + NAMA_NEGARA[k] : 'Negara') + '</option>').join('');
        const statSaya = saya
            ? '<div class="qcomp-kv"><span>Rank</span><b>#' + saya.rank + ' <small class="qim-muted">dari ' + saya.dari.toLocaleString('en-US') + '</small></b></div>'
              + '<div class="qcomp-kv"><span>Profit</span><b class="' + (saya.profit_pct >= 0 ? 'qim-up' : 'qim-down') + '">' + persen(saya.profit_pct) + '</b></div>'
              + '<div class="qcomp-kv"><span>Total Trade</span><b>' + saya.trades + '</b></div>'
              + '<div class="qcomp-kv"><span>Win Rate</span><b>' + saya.win_rate + '%</b></div>'
              + '<div class="qcomp-kv"><span>Best Trade</span><b class="qim-up">' + uang(saya.terbaik, true) + '</b></div>'
              + '<div class="qcomp-kv"><span>Worst Trade</span><b class="qim-down">' + uang(saya.terburuk, true) + '</b></div>'
              + (saya.rank_berikut
                  ? '<div style="margin-top:10px;font-size:12px;color:#d7dfeb">Progress ke Rank Berikutnya</div><div class="qcomp-progress"><i style="width:' + (saya.progres_pct || 0) + '%"></i></div><div style="display:flex;justify-content:space-between;font-size:11px" class="qim-muted"><span>' + (saya.progres_pct || 0) + '%</span><span>(ke Rank #' + saya.rank_berikut + ')</span></div>'
                  : '<div style="margin-top:10px;font-size:12px" class="qim-up">🏆 Anda di peringkat teratas.</div>')
            : '<div class="qcomp-empty" style="padding:14px 0">Belum ada peringkat. Tutup minimal satu posisi di Paper Trading.</div><button type="button" class="qim-btn qim-btn-primary" data-aksi="paper" style="width:100%">Mulai Paper Trading</button>';

        const ikonTurnamen = p => p === 'crypto' ? ikonAset('BTCUSDT') : p === 'gold' ? ikonAset('XAUUSD') : '<span class="qim-asset">' + benderaSvg('GBP') + '</span>';
        const lain = d.lainnya.map(o => '<div class="qim-card2 qcomp-tour"><div class="qcomp-tour-top">' + ikonTurnamen(o.pasar) + '<div><b>' + esc(o.nama) + '</b>'
            + '<div class="qcomp-tour-nums"><div><span>Prize Pool</span><strong>' + uang(o.total_hadiah) + '</strong></div><div><span>Peserta</span><strong class="plain">' + o.peserta.toLocaleString('en-US') + '</strong></div></div>'
            + (o.hadiah_contoh ? '<span class="qim-chip-contoh" style="margin:4px 0 0">hadiah contoh</span>' : '') + '</div>'
            + '<span class="qcomp-time">⏱ <span data-qcomp-sisa="' + esc(o.selesai) + '">' + sisaWaktu(o.selesai, true) + '</span></span></div>'
            + (o.terdaftar ? '<button type="button" class="qim-btn" disabled>✓ Terdaftar</button>' : '<button type="button" class="qim-btn qim-btn-outline" data-daftar="' + esc(o.kunci) + '">Daftar Sekarang</button>') + '</div>').join('');

        $('qcompBody').innerHTML =
            '<div class="qcomp-stats">'
            + '<div class="qim-card2 qcomp-stat blue"><span class="qcomp-stat-icon">' + ikon(I.user) + '</span><div><span>Total Peserta</span><b>' + t.peserta.toLocaleString('en-US') + ' trader</b></div></div>'
            + '<div class="qim-card2 qcomp-stat gold"><span class="qcomp-stat-icon">' + ikon(I.trophy) + '</span><div><span>Prize Pool ' + contoh + '</span><b>' + uang(t.total_hadiah) + '</b></div></div>'
            + '<div class="qim-card2 qcomp-stat red"><span class="qcomp-stat-icon">' + ikon(I.clock) + '</span><div><span>Sisa Waktu</span><b id="qcompSisa">' + sisaWaktu(t.selesai) + '</b></div></div>'
            + '</div>'
            + '<div class="qcomp-banner"><div><div class="qcomp-banner-title">' + ikon('<path d="M8 4h8v5a4 4 0 0 1-8 0z" fill="#f5c443"/><path d="M8 6H5a3 3 0 0 0 3 4.5M16 6h3a3 3 0 0 1-3 4.5M12 13v4M8 21h8M9.5 17h5v4h-5z" stroke="#f5c443" stroke-width="1.6" fill="none"/>')
            + '<div><h2>' + esc(t.nama) + '</h2><p class="qcomp-period">Periode: ' + esc(rentangTanggal(t.mulai, t.selesai)) + '</p></div></div>'
            + '<div class="qcomp-prizes">' + hadiah + '</div>'
            + '</div>'
            + '<div class="qcomp-trophy">' + trofiSvg() + '</div>'
            + '<div class="qcomp-cta">' + (t.terdaftar ? '<button type="button" class="qim-btn qim-btn-green" disabled>✓ Anda Terdaftar</button>' : '<button type="button" class="qim-btn qim-btn-green" data-daftar="' + esc(t.kunci) + '">Daftar Sekarang</button>')
            + '<button type="button" class="qim-btn qim-btn-outline" data-aksi="aturan" aria-controls="qcompAturan">Lihat Aturan</button>'
            + (t.terdaftar ? '' : '<small class="qcomp-setuju">Dengan mendaftar Anda menyetujui aturan turnamen.</small>') + '</div></div>'
            + htmlAturan(d)
            + '<div class="qcomp-grid"><div class="qim-card2 qcomp-board"><div class="qcomp-board-head"><h3>Leaderboard</h3><div class="qcomp-tabs">' + tabs + '</div></div>' + tabel + '</div>'
            + '<div class="qim-card2 qcomp-side"><div class="qcomp-side-head"><span class="qbrk-head-icon" style="width:34px;height:34px">' + ikon(I.user) + '</span><h3>Your Stats</h3></div>' + statSaya
            + htmlRingkasLayak(t.kelayakan)
            + '<form class="qcomp-profile" data-form="profil"><input name="nama" maxlength="24" placeholder="Nama tampilan" value="' + esc(d.profil.nama_tampilan || '') + '" aria-label="Nama tampilan di papan peringkat">'
            + '<select name="negara" aria-label="Negara">' + opsiNegara + '</select><button type="submit" class="qim-btn">Simpan</button></form>'
            + '<p class="qim-note" style="margin-top:6px">Tanpa nama tampilan, nama Anda disamarkan untuk trader lain.</p></div></div>'
            + '<div class="qcomp-others-head"><span>★ Turnamen Aktif Lainnya</span></div><div class="qcomp-others">' + lain + '</div>';
    }

    // ── Aturan & syarat hadiah (api/_kompetisi_syarat.php) ──────────────────────
    function htmlRingkasLayak(k, statis) {
        if (!k) return '';
        const gagal = k.syarat.filter(s => !s.ok && s.kunci !== 'satu_akun').length;
        const [kelas, teks] = k.layak ? ['ok', '✓ Memenuhi syarat hadiah']
            : k.ditinjau ? ['tinjau', '⏳ Syarat terpenuhi — menunggu tinjauan admin']
            : ['kurang', gagal + ' syarat hadiah belum terpenuhi'];
        return statis
            ? '<div class="qcomp-layak ' + kelas + '">' + esc(teks) + '</div>'
            : '<button type="button" class="qcomp-layak ' + kelas + '" data-aksi="aturan">' + esc(teks) + '<span>Lihat syarat ›</span></button>';
    }
    function htmlAturan(d) {
        const t = d.turnamen, k = t.kelayakan;
        const bagian = (t.aturan || []).map(b => '<div class="qcomp-aturan-sec"><h4>' + esc(b.judul) + '</h4><ul>'
            + b.butir.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul></div>').join('');
        const cek = s => {
            const st = s.ok ? 'ok' : (s.kunci === 'satu_akun' ? 'tinjau' : 'kurang');
            return '<li class="' + st + '"><i aria-hidden="true">' + (s.ok ? '✓' : st === 'tinjau' ? '!' : '✗') + '</i><div><b>' + esc(s.label) + '</b><small>' + esc(s.detail) + '</small></div></li>';
        };
        const saya = k ? '<div class="qcomp-aturan-saya"><h4>Syarat hadiah Anda · ' + esc(t.periode) + '</h4><ul class="qcomp-cek">'
            + k.syarat.map(cek).join('') + '</ul>' + htmlRingkasLayak(k, true) + '</div>' : '';
        const admin = d.admin ? '<div class="qcomp-aturan-admin"><h4>Kandidat pemenang <small>(admin)</small></h4>'
            + '<div class="qcomp-admin-aksi"><button type="button" class="qim-btn qim-btn-outline" data-aksi="kandidat" data-periode="' + esc(t.periode) + '">Periode ini</button>'
            + '<button type="button" class="qim-btn qim-btn-outline" data-aksi="kandidat" data-periode="' + esc(kunciMingguLalu(t.mulai)) + '">Periode lalu</button></div>'
            + '<div id="qcompKandidat" class="qim-note">Tanda multi-akun hanya bahan tinjauan — periksa sebelum menetapkan pemenang.</div></div>' : '';
        return '<section id="qcompAturan" class="qim-card2 qcomp-aturan"' + (komp.aturanBuka ? '' : ' hidden') + ' aria-label="Aturan turnamen">'
            + '<div class="qcomp-aturan-head"><h3>Aturan &amp; Syarat — ' + esc(t.nama) + '</h3>'
            + (t.aturan_draf ? '<span class="qim-chip-contoh" title="Admin belum menetapkan aturan resmi (cache/competition.json → syarat.ditetapkan)">DRAF</span>' : '') + '</div>'
            + (t.aturan_draf ? '<p class="qcomp-draf">Aturan dan hadiah ini masih draf dan dapat berubah sebelum admin menetapkannya.</p>' : '')
            + '<div class="qcomp-aturan-grid"><div class="qcomp-aturan-isi">' + bagian + '</div>' + saya + '</div>' + admin + '</section>';
    }
    /** Kunci minggu ISO (mis. 2026-W41) untuk minggu sebelum periode yang dimulai pada mulaiIso. */
    function kunciMingguLalu(mulaiIso) {
        const [y, bln, tgl] = String(mulaiIso).slice(0, 10).split('-').map(Number);   // tanggal server (WIB), bukan zona peramban
        const d = new Date(Date.UTC(y, bln - 1, tgl - 7));
        d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));          // Kamis minggu itu
        const awal = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return d.getUTCFullYear() + '-W' + String(Math.ceil(((d - awal) / 864e5 + 1) / 7)).padStart(2, '0');
    }
    async function muatKandidat(periode) {
        const el = $('qcompKandidat'); if (!el) return;
        el.textContent = 'Memuat kandidat…';
        try {
            const r = await fetch('api/competition.php?kandidat=1&turnamen=weekly-championship&periode=' + encodeURIComponent(periode), { cache: 'no-store' });
            const d = await r.json().catch(() => ({}));
            if (!r.ok || d.status !== 'success') { el.textContent = d.message || 'Gagal memuat kandidat.'; return; }
            if (!d.kandidat.length) { el.textContent = 'Belum ada peserta terdaftar pada periode ' + d.periode + '.'; return; }
            const kel = k => k.kelompok ? '<small>Kelompok #' + k.kelompok.id + ' (' + k.kelompok.ukuran + ' akun): ' + esc(k.kelompok.alasan.join(', ')) + '</small>' : '';
            const status = k => k.layak ? '<span class="qcomp-st ok">Layak</span>'
                : k.ditinjau ? '<span class="qcomp-st tinjau">Tinjau</span>' + kel(k)
                : '<span class="qcomp-st kurang">Tidak layak</span><small>' + esc(k.gagal.join(' · ')) + '</small>' + kel(k);
            el.innerHTML = '<p class="qim-note">' + esc(d.nama) + ' · periode ' + esc(d.periode) + (d.berjalan ? ' (masih berjalan — posisi sementara)' : ' (selesai)')
                + ' · ' + d.peserta + ' peserta' + (d.hadiah_contoh ? ' · <b>hadiah masih contoh</b>' : '') + '</p>'
                + '<div class="qcomp-kand-wrap"><table class="qcomp-table qcomp-kand"><thead><tr><th>Juara</th><th>#</th><th>Peserta</th><th>Profit %</th><th>Trade</th><th>Win</th><th>Status</th></tr></thead><tbody>'
                + d.kandidat.map(k => '<tr><td>' + (k.posisi_juara ? '<b>' + k.posisi_juara + '</b>' : '<span class="qim-muted">—</span>') + '</td><td>' + k.rank_peserta + '</td>'
                    + '<td><b>' + esc(k.nama_tampilan || k.nama) + '</b><small>' + esc(k.email) + ' · id ' + k.user_id + '</small></td>'
                    + '<td class="num ' + (k.profit_pct >= 0 ? 'qim-up' : 'qim-down') + '">' + persen(k.profit_pct) + '</td><td class="num">' + k.trades + '</td><td class="num">' + k.win_rate + '%</td>'
                    + '<td class="qcomp-kand-st">' + status(k) + '</td></tr>').join('')
                + '</tbody></table></div>';
        } catch (e) { el.textContent = 'Tidak dapat menghubungi server.'; }
    }

    async function klikKompetisi(e) {
        const tab = e.target.closest('[data-papan]');
        if (tab) { muatKompetisi(tab.dataset.papan); return; }
        const daftar = e.target.closest('[data-daftar]');
        if (daftar) {
            daftar.disabled = true;
            try {
                const r = await fetch('api/competition.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aksi: 'daftar', turnamen: daftar.dataset.daftar }) });
                const d = await r.json().catch(() => ({}));
                toast(d.message || (r.ok ? 'Terdaftar.' : 'Gagal mendaftar.'), r.ok ? 'success' : 'error');
            } catch (er) { toast('Gagal menghubungi server.', 'error'); }
            muatKompetisi();
            return;
        }
        const aksi = e.target.closest('[data-aksi]');
        if (aksi && aksi.dataset.aksi === 'aturan') {
            const el = $('qcompAturan');
            if (el) { el.hidden = !el.hidden; komp.aturanBuka = !el.hidden; if (!el.hidden) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
        }
        if (aksi && aksi.dataset.aksi === 'kandidat') muatKandidat(aksi.dataset.periode || '');
        if (aksi && aksi.dataset.aksi === 'paper') window.switchPanel && window.switchPanel('panel-paper');
    }
    async function simpanProfilKompetisi(e) {
        const f = e.target.closest('[data-form="profil"]');
        if (!f) return;
        e.preventDefault();
        try {
            const r = await fetch('api/competition.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aksi: 'profil', nama_tampilan: f.nama.value.trim(), negara: f.negara.value }) });
            const d = await r.json().catch(() => ({}));
            toast(d.message || (r.ok ? 'Tersimpan.' : 'Gagal menyimpan.'), r.ok ? 'success' : 'error');
            if (r.ok) muatKompetisi();
        } catch (er) { toast('Gagal menghubungi server.', 'error'); }
    }

    // ═════════════════════════════════════════════════════════════════════════
    // NEWS
    // ═════════════════════════════════════════════════════════════════════════
    const berita = { data: [], kat: 'All', q: '', waktu: 0, memuat: false };
    const KATEGORI = ['All', 'Breaking', 'Forex', 'Economy', 'Central Banks', 'Commodities', 'Geopolitical', 'BTC', 'Gold', 'Crypto'];
    const POLA = {
        Economy: /\b(gdp|inflation|cpi|ppi|jobs|payroll|unemployment|economy|economic|retail sales|pmi|recession|growth)\b/i,
        'Central Banks': /\b(fed|fomc|ecb|boj|boe|rba|snb|central bank|rate (cut|hike)s?|interest rates?|powell|lagarde|ueda)\b/i,
        Commodities: /\b(oil|crude|brent|wti|gold|silver|copper|commodit\w*|bullion|natural gas|mining|production)\b/i,
        Geopolitical: /\b(war|sanction\w*|tariff\w*|election|geopolit\w*|conflict|white house|congress|senate|russia|ukraine|iran|israel|china|policy|bill|regulat\w*)\b/i,
        BTC: /\b(bitcoin|btc)\b/i,
        Gold: /\b(gold|xau|bullion)\b/i
    };
    function cocokKategori(a, k) {
        if (k === 'All') return true;
        const teks = a.title || '';
        if (k === 'Breaking') return (Date.now() - new Date(a.published_at).getTime()) < 3 * 36e5;
        if (k === 'Forex') return a.category === 'FOREX' || (a.symbols || []).some(s => /^(EUR|GBP|AUD|NZD|USD)[A-Z]{3}$/.test(s) && s !== 'XAUUSD');
        if (k === 'Crypto') return a.category === 'CRYPTO';
        if (k === 'Economy') return a.category === 'MACRO' || POLA.Economy.test(teks);
        if (k === 'Gold') return a.category === 'GOLD' || POLA.Gold.test(teks) || (a.symbols || []).includes('XAUUSD');
        if (k === 'BTC') return POLA.BTC.test(teks) || (a.symbols || []).includes('BTCUSDT');
        return POLA[k] ? POLA[k].test(teks) : false;
    }
    const LOGO = { CoinDesk: ['C', '#f5c443'], CoinTelegraph: ['CT', '#cfd6e3'], 'Yahoo Finance': ['Y', '#7b3ff2'] };
    function relatif(iso) {
        const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 6e4));
        if (!Number.isFinite(m)) return '';
        if (m < 60) return m + 'm ago';
        const j = Math.round(m / 60);
        return j < 24 ? j + 'h ago' : Math.round(j / 24) + 'd ago';
    }
    function siapkanNews() {
        const panel = $('panel-news');
        if (!panel) return;
        if (!panel.querySelector('.qnews')) {
            const w = document.createElement('div');
            w.className = 'qnews';
            w.innerHTML = '<div class="qnews-head"><h1 class="qnews-h1">' + ikon(I.news) + 'NEWS FEED</h1>'
                + metaSesi('qimNewsUpdated')
                + '<label class="qnews-search">' + ikon(I.search) + '<input type="search" placeholder="Search headlines..." aria-label="Cari berita"></label>'
                + '<button type="button" class="qim-btn" data-aksi="segar" aria-label="Muat ulang berita" title="Muat ulang">' + ikon(I.refresh) + '</button></div>'
                + '<div class="qnews-count" id="qnewsCount">—</div>'
                + '<div class="qnews-chips" role="tablist">' + KATEGORI.map(k => '<button type="button" class="qnews-chip' + (k === berita.kat ? ' active' : '') + '" data-kat="' + k + '">' + k + '</button>').join('') + '</div>'
                + '<div class="qnews-list" id="qnewsList"><div class="qnews-empty">Memuat berita…</div></div>';
            panel.insertBefore(w, panel.firstChild);
            w.querySelector('input').addEventListener('input', e => { berita.q = e.target.value.trim().toLowerCase(); renderNews(); });
            w.querySelector('[data-aksi="segar"]').addEventListener('click', () => muatNews(true));
            w.querySelector('.qnews-chips').addEventListener('click', e => {
                const b = e.target.closest('[data-kat]'); if (!b) return;
                berita.kat = b.dataset.kat;
                w.querySelectorAll('.qnews-chip').forEach(x => x.classList.toggle('active', x === b));
                renderNews();
            });
            setInterval(() => { if (state.page === 'news' && document.visibilityState === 'visible') muatNews(false); }, 300000);
        }
        if (Date.now() - berita.waktu > 120000) muatNews(false);
    }
    async function muatNews(paksa) {
        if (berita.memuat) return;
        berita.memuat = true;
        try {
            const r = await fetch('api/news.php' + (paksa ? '?t=' + Date.now() : ''), { cache: 'no-store' });
            const d = await r.json();
            berita.data = Array.isArray(d.data) ? d.data : [];
            berita.waktu = Date.now();
            const u = $('qimNewsUpdated'); if (u) u.textContent = jamKini(true);
            renderNews();
        } catch (e) {
            const l = $('qnewsList'); if (l && !berita.data.length) l.innerHTML = '<div class="qnews-empty">Berita tidak dapat dimuat. Coba lagi.</div>';
        } finally { berita.memuat = false; }
    }
    function renderNews() {
        const l = $('qnewsList'); if (!l) return;
        const daftar = berita.data.filter(a => cocokKategori(a, berita.kat) && (!berita.q || String(a.title).toLowerCase().includes(berita.q) || String(a.source).toLowerCase().includes(berita.q)));
        const c = $('qnewsCount'); if (c) c.textContent = daftar.length + ' articles';
        if (!daftar.length) { l.innerHTML = '<div class="qnews-empty">Tidak ada berita untuk filter ini.</div>'; return; }
        l.innerHTML = daftar.map(a => {
            const [huruf, warna] = LOGO[a.source] || [String(a.source || '?').slice(0, 1), '#5f7fb3'];
            const sent = String(a.sentiment || 'neutral').toLowerCase();
            const kat = String(a.category || '').toUpperCase();
            const aman = /^https:\/\//.test(a.url || '') ? a.url : '#';
            const gambar = /^https:\/\//.test(a.image || '') ? '<img src="' + esc(a.image) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' : '';
            return '<a class="qnews-item" href="' + esc(aman) + '" target="_blank" rel="noopener noreferrer"><div>'
                + '<div class="qnews-meta"><span class="qnews-logo" style="background:' + warna + '">' + esc(huruf) + '</span><span class="qnews-src">' + esc(a.source) + '</span>'
                + (kat ? '<span class="qnews-tag' + (kat === 'GOLD' ? ' gold' : '') + '">' + esc(kat) + '</span>' : '')
                + '<span class="qnews-tag ' + (sent === 'bullish' ? 'bullish' : sent === 'bearish' ? 'bearish' : '') + '">' + esc(sent.toUpperCase()) + '</span></div>'
                + '<div class="qnews-title">' + esc(a.title) + '</div></div>'
                + '<span class="qnews-time">' + esc(relatif(a.published_at)) + '</span>'
                + '<span class="qnews-thumb">' + gambar + '<span class="ph"' + (gambar ? ' hidden' : '') + '>' + esc(kat === 'GOLD' ? 'Au' : kat === 'CRYPTO' ? '₿' : kat === 'FOREX' ? '$' : '◆') + '</span></span></a>';
        }).join('');
        l.querySelectorAll('.qnews-thumb img').forEach(img => img.addEventListener('error', () => { img.remove(); const ph = img.parentElement && img.parentElement.querySelector('.ph'); if (ph) ph.hidden = false; }, { once: true }));
    }

    // ═════════════════════════════════════════════════════════════════════════
    // BROKER (Akun & Kinerja)
    // ═════════════════════════════════════════════════════════════════════════
    let brokerSiap = false;
    function lipat(section, chevron) {
        if (!section || section.classList.contains('qbrk-collapse')) return;
        const kepala = section.firstElementChild;
        if (!kepala) return;
        section.classList.add('qbrk-collapse');
        kepala.classList.add('qbrk-collapse-head');
        kepala.setAttribute('role', 'button');
        kepala.setAttribute('tabindex', '0');
        kepala.setAttribute('aria-expanded', 'false');
        if (chevron) { const c = document.createElement('span'); c.className = 'qbrk-chev'; c.textContent = '›'; kepala.appendChild(c); }
        const alih = e => {
            if (e.target.closest('input,select,button:not(.qbrk-collapse-head),a')) return;
            const buka = section.classList.toggle('open');
            kepala.setAttribute('aria-expanded', String(buka));
        };
        kepala.addEventListener('click', alih);
        kepala.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); alih(e); } });
    }
    function siapkanBroker() {
        const p = $('panel-account');
        if (!p) return;
        pindahkanKartuNotif();
        if (brokerSiap) return;
        brokerSiap = true;
        p.classList.add('qbrk');

        // Kepala: ikon bulat + tombol profil tanpa emoji.
        const kepala = p.firstElementChild;
        const emoji = kepala && kepala.querySelector('h2') && kepala.querySelector('h2').previousElementSibling;
        if (emoji) { emoji.className = 'qbrk-head-icon'; emoji.innerHTML = ikon(I.idcard); emoji.parentElement.style.gap = '12px'; }
        const prof = kepala && kepala.querySelector('a[href="profile.html"]');
        if (prof) prof.textContent = 'Kelola Profil & Keamanan';

        // Tiga kartu: judul berikon, isi rata tengah.
        const kartu = p.querySelectorAll(':scope > .grid > section');
        const judul = [['Akun Trading', I.link], ['Evaluasi Performa', I.bars], ['Rencana & Risiko', I.shield]];
        kartu.forEach((k, i) => {
            if (!judul[i]) return;
            k.classList.add('qbrk-card');
            const label = Array.from(k.querySelectorAll('div')).find(x => x.textContent.trim().toLowerCase() === judul[i][0].toLowerCase());
            if (label) label.style.display = 'none';
            const t = document.createElement('div');
            t.className = 'qbrk-card-title';
            t.innerHTML = ikon(judul[i][1]) + '<span>' + esc(judul[i][0]) + '</span>';
            k.insertBefore(t, k.firstChild);
            if (i === 0) {
                const atas = t.nextElementSibling;
                if (atas) { atas.style.flexDirection = 'column-reverse'; atas.style.alignItems = 'center'; }
                const ik = document.createElement('div'); ik.className = 'qbrk-link-icon'; ik.innerHTML = ikon(I.link);
                const ttl = $('accountConnectionTitle'); if (ttl) ttl.parentElement.insertBefore(ik, ttl);
            }
        });

        // Riwayat saldo kosong → kotak putus-putus berikon (bukan area grafik kosong besar).
        const ringkasSaldo = $('balanceHistorySummary');
        const kartuSaldo = ringkasSaldo && ringkasSaldo.closest('section');
        if (kartuSaldo) {
            const kotak = document.createElement('div');
            kotak.className = 'qbrk-empty-box';
            kotak.innerHTML = '<span>' + ikon('<path d="M4 17l5-5 4 3 7-8"/><path d="M15 7h5v5"/>') + '</span>Belum ada snapshot. Grafik akan terisi setelah EA read-only mengirim data (tiap ≤60 detik).';
            kartuSaldo.appendChild(kotak);
            const cekKosong = () => kartuSaldo.classList.toggle('qbrk-kosong', /belum ada snapshot/i.test(ringkasSaldo.textContent));
            cekKosong();
            new MutationObserver(cekKosong).observe(ringkasSaldo, { childList: true, characterData: true, subtree: true });
        }

        // Guardrail risiko: baris yang bisa dilipat + lencana status.
        const guard = $('riskProfileForm') && $('riskProfileForm').closest('section');
        if (guard) {
            lipat(guard, true);
            const st = $('riskProfileState');
            if (st) {
                const segar = () => {
                    const t = st.textContent.trim();
                    const ok = /tersimpan|disimpan|aktif/i.test(t) && !/belum|gagal|memuat/i.test(t);
                    st.className = 'qbrk-state' + (ok ? ' ok' : '');
                };
                segar();
                new MutationObserver(segar).observe(st, { childList: true, characterData: true, subtree: true });
            }
        }
    }
    function pindahkanKartuNotif() {
        const n = $('qimNotifKartu');
        const guard = $('riskProfileForm') && $('riskProfileForm').closest('section');
        if (!n || !guard) { if (!pindahkanKartuNotif.coba) { pindahkanKartuNotif.coba = 0; } if (pindahkanKartuNotif.coba++ < 20) setTimeout(pindahkanKartuNotif, 500); return; }
        if (n.previousElementSibling !== guard) guard.insertAdjacentElement('afterend', n);
        lipat(n, true);
    }

    // ═════════════════════════════════════════════════════════════════════════
    // DRAWING
    // ═════════════════════════════════════════════════════════════════════════
    const NAMA_ALAT = {
        'trend-line': 'Trendline', 'horizontal-line': 'Horizontal Line', 'horizontal-ray': 'Horizontal Ray', 'vertical-line': 'Vertical Line', ray: 'Ray',
        'extended-line': 'Extended Line', 'fib-retracement': 'Fibonacci', rectangle: 'Zone / Box', text: 'Text Annotation', 'parallel-channel': 'Parallel Channel',
        brush: 'Brush', 'price-range': 'Price Range', 'long-position': 'Long Position', 'short-position': 'Short Position', triangle: 'Triangle',
        'triangle-pattern': 'Triangle Pattern', arrow: 'Arrow', callout: 'Callout'
    };
    // Urutan mengikuti desain: kursor | garis | bentuk & teks | pola & ukur. Alat lain di menu gerigi.
    const ALAT = [
        [null, 'Kursor', '<path d="M5 3l13 7-6 1.8L9.5 18z"/>'],
        ['trend-line', 'Trendline', '<path d="M4 19L20 5"/><circle cx="4" cy="19" r="1.6"/><circle cx="20" cy="5" r="1.6"/>'],
        ['horizontal-ray', 'Horizontal Ray', '<circle cx="5" cy="12" r="1.8"/><path d="M7 12h14"/>'],
        ['horizontal-line', 'Horizontal Line', '<path d="M3 12h18"/>'],
        ['ray', 'Ray', '<path d="M4 20L20 4M14 4h6v6"/>'],
        ['fib-retracement', 'Fibonacci Retracement', '<path d="M3 5h18M3 9.5h18M3 14h18M3 18.5h18M7 3v18"/>'],
        ['arrow', 'Arrow', '<path d="M5 19L19 5M11 5h8v8"/>'],
        ['rectangle', 'Zone / Box', '<rect x="4" y="6" width="16" height="12" rx="1"/>'],
        ['callout', 'Callout', '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 16l-2 4 6-4M7 9h10M7 12h6"/>'],
        ['text', 'Teks', '<path d="M5 6h14M12 6v13"/>'],
        ['note', 'Catatan', '<path d="M4 18L9 5h1l5 13M6 13.5h7M16 14l4 4"/>'],
        ['xabcd-pattern', 'Pola XABCD', '<path d="M3 18L8 7l4 8 4-10 5 13"/>'],
        ['date-and-price-range', 'Ukur (harga & waktu)', '<path d="M4 18L18 4l2 2L6 20zM8 14l1.5 1.5M11 11l1.5 1.5M14 8l1.5 1.5"/>']
    ];
    const ALAT_LAIN = [['extended-line', 'Extended Line'], ['vertical-line', 'Vertical Line'], ['parallel-channel', 'Parallel Channel'], ['brush', 'Brush'],
        ['price-range', 'Price Range'], ['long-position', 'Long Position'], ['short-position', 'Short Position'], ['triangle-pattern', 'Triangle Pattern']];
    const PRESET = {
        scalper: { label: 'Scalper Setup', iv: '5', ind: ['indEMA20', 'indEMA50', 'indST'] },
        swing: { label: 'Swing Setup', iv: '240', ind: ['indEMA50', 'indEMA200', 'indSR', 'indFib'] },
        investor: { label: 'Investor Setup', iv: 'D', ind: ['indEMA200', 'indIchi'] },
        custom1: { label: 'Custom 1', custom: true },
        custom2: { label: 'Custom 2', custom: true }
    };
    const TF_LABEL = { '1': '1m', '5': '5m', '15': '15m', '30': '30m', '60': '1h', '240': '4h', D: '1D', W: '1W', MN: '1M' };
    const SEMUA_IND = ['indEMA20', 'indEMA50', 'indEMA200', 'indBB', 'indRSI', 'indVOL', 'indIchi', 'indSR', 'indFib', 'indGX', 'indSND', 'indVP', 'indPSAR', 'indKC', 'indST', 'indLIQ', 'indCDL'];
    const gbr = { mgr: null, lepas: [], pilih: null, siap: false, jaga: null };

    function mgr() { return g('_lwDrawings') || null; }
    let alatSiap = false;
    const MAGNET = ['off', 'weak', 'strong'];
    function siapkanAlatGambar() {
        const panel = $('panel-charts');
        if (!panel || alatSiap) return;
        alatSiap = true;
        const badan = Array.from(panel.children).find(c => c.querySelector && c.querySelector('#tv_chart_container'));
        if (badan) badan.classList.add('qim-chart-body');
        const barLama = document.querySelector('#panel-charts .lw-draw-btn') && document.querySelector('#panel-charts .lw-draw-btn').parentElement;
        if (barLama) barLama.classList.add('qdraw-oldbar');
        const alat = document.createElement('div');
        alat.className = 'qdraw-tools';
        alat.setAttribute('role', 'toolbar');
        alat.setAttribute('aria-label', 'Alat gambar');
        const tb = (aksi, judul, svg) => '<button type="button" class="qdraw-tool" data-aksi="' + aksi + '" title="' + judul + '" aria-label="' + judul + '">' + ikon(svg) + '</button>';
        alat.innerHTML = ALAT.map(([k, l, svg], i) => (i === 1 ? '<span class="qdraw-sep"></span>' : '') + '<button type="button" class="qdraw-tool" data-alat="' + (k || '') + '" title="' + l + '" aria-label="' + l + '">' + ikon(svg) + '</button>').join('')
            + '<span class="qdraw-sep"></span>'
            + tb('magnet', 'Magnet', '<path d="M6 4v8a6 6 0 0 0 12 0V4h-4v8a2 2 0 0 1-4 0V4zM6 8h4M14 8h4"/>')
            + tb('kunci', 'Kunci semua gambar', '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>')
            + tb('tampil', 'Tampilkan / sembunyikan semua gambar', '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>')
            + tb('hapus-pilih', 'Hapus gambar terpilih (tanpa pilihan: hapus semua)', '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>')
            + '<button type="button" class="qdraw-tool qdraw-gear" data-aksi="lain" data-ch="alatlain" title="Alat lain & pengaturan" aria-label="Alat lain dan pengaturan">' + ikon(I.gear) + '<span>⌄</span></button>';
        const sebelum = barLama || badan || panel.firstChild;
        sebelum.parentElement.insertBefore(alat, sebelum);
        let modeMagnet = baca('qim_magnet') || 'weak';
        terapMagnet = () => { const m = mgr(); try { if (m) m.setMagnet(modeMagnet); } catch (e) {} const b = alat.querySelector('[data-aksi="magnet"]'); b.classList.toggle('active', modeMagnet !== 'off'); b.title = 'Magnet: ' + ({ off: 'mati', weak: 'lemah', strong: 'kuat' }[modeMagnet]); };
        terapMagnet();
        alat.addEventListener('click', e => {
            const b = e.target.closest('button'); if (!b) return;
            const m = mgr();
            const aksi = b.dataset.aksi;
            if (aksi === 'magnet') { modeMagnet = MAGNET[(MAGNET.indexOf(modeMagnet) + 1) % MAGNET.length]; simpan('qim_magnet', modeMagnet); terapMagnet(); toast(b.title, 'info'); return; }
            if (aksi === 'kunci') {
                if (!m || !m.drawings().length) { toast('Belum ada gambar untuk dikunci.', 'info'); return; }
                const semuaTerkunci = m.drawings().every(d => d.locked);
                m.drawings().forEach(d => m.update(Object.assign({}, d, { locked: !semuaTerkunci })));
                b.classList.toggle('active', !semuaTerkunci);
                toast(semuaTerkunci ? 'Semua gambar dibuka kuncinya.' : 'Semua gambar dikunci (tidak bisa digeser).', 'info');
                return;
            }
            if (aksi === 'tampil') { if (m) { m.setDrawingsVisible(!m.drawingsVisible()); b.classList.toggle('active', !m.drawingsVisible()); renderDaftar(); } return; }
            if (aksi === 'hapus-pilih') {
                if (!m) return;
                if (m.selection().length) { if (typeof window.lwDeleteSelected === 'function') window.lwDeleteSelected(); }
                else if (m.drawings().length && confirm('Tidak ada gambar terpilih. Hapus SEMUA gambar di chart ini?')) { if (typeof window.lwClearAll === 'function') window.lwClearAll(); }
                renderDaftar();
                return;
            }
            if (aksi === 'lain') {
                const p = bukaPopover(b, '<div class="qch-pop-title">Alat lain</div>' + ALAT_LAIN.map(([k, l]) => '<button type="button" class="qch-item" data-alat-lain="' + k + '">' + esc(l) + '</button>').join('')
                    + '<div class="qch-pop-sep"></div><label class="qch-item"><input type="checkbox" id="qchTetap"' + (baca('qim_draw_tetap') === '1' ? ' checked' : '') + '> Tetap di mode gambar setelah menaruh</label>', 230);
                if (!p) return;
                p.addEventListener('click', ev => { const x = ev.target.closest('[data-alat-lain]'); if (x) { window.setChartTool && window.setChartTool(x.dataset.alatLain); tandaiAlat(); tutupPopover(); } });
                p.querySelector('#qchTetap').addEventListener('change', ev => { simpan('qim_draw_tetap', ev.target.checked ? '1' : '0'); try { const mm = mgr(); if (mm) mm.setStayInDrawingMode(ev.target.checked); } catch (er) {} });
                return;
            }
            if (typeof window.setChartTool === 'function') window.setChartTool(b.dataset.alat || null);
            tandaiAlat();
        });
    }

    function siapkanDrawing() {
        const panel = $('panel-charts');
        if (!panel) return;
        siapkanAlatGambar();
        if (!gbr.siap) {
            gbr.siap = true;

            const p = document.createElement('div');
            p.className = 'qdraw-panel';
            const tbl = (aksi, ikonSvg, label, kelas) => '<button type="button" class="qdraw-btn' + (kelas ? ' ' + kelas : '') + '" data-aksi="' + aksi + '">' + ikon(ikonSvg) + label + '</button>';
            const dbtn = (alatK, ikonSvg, label) => '<button type="button" class="qdraw-dbtn" data-dalat="' + alatK + '">' + ikon(ikonSvg) + label + '</button>';
            p.innerHTML = '<div class="qdraw-bar2" role="toolbar" aria-label="Alat gambar cepat"><b>DRAW</b>'
                + '<select class="qdraw-select" aria-label="Pilih alat gambar"><option value="">Select</option>'
                + ALAT.slice(1).concat(ALAT_LAIN.map(([k, l]) => [k, l])).map(([k, l]) => '<option value="' + k + '">' + esc(l) + '</option>').join('') + '</select>'
                + dbtn('trend-line', '<path d="M4 19L20 5"/>', 'Trendline')
                + dbtn('horizontal-line', '<circle cx="4" cy="12" r="1.6"/><path d="M6 12h15"/>', 'Horz Line')
                + dbtn('ray', '<path d="M4 20L20 4M14 4h6v6"/>', 'Ray')
                + dbtn('fib-retracement', '<path d="M3 5h18M3 10h18M3 14h18M3 19h18"/>', 'Fibo')
                + dbtn('rectangle', '<rect x="4" y="6" width="16" height="12" rx="1"/>', 'Box')
                + '<button type="button" class="qdraw-dbtn" data-aksi="zona" data-ch="zona">' + ikon('<rect x="3" y="5" width="18" height="6" rx="1"/><rect x="3" y="13" width="18" height="6" rx="1"/>') + 'Zone</button>'
                + dbtn('text', '<path d="M5 6h14M12 6v13"/>', 'Text')
                + '<button type="button" class="qdraw-dbtn" data-aksi="hapus">' + ikon('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>') + 'Hapus</button>'
                + '<button type="button" class="qdraw-dbtn" data-aksi="reset">Reset</button></div>'
                + '<div class="qim-card2 qdraw-list"><div class="qdraw-list-head"><h3>Daftar Gambar</h3><span id="qdrawSync" class="qdraw-sync" title="Gambar & template tersimpan di akun Anda, jadi ikut ke perangkat lain"></span>'
                + tbl('tambah', '<path d="M12 5v14M5 12h14"/>', 'Tambah Gambar', 'primary')
                + tbl('simpan-tpl', '<path d="M5 3h11l3 3v15H5z"/><path d="M8 3v5h7V3M8 21v-7h8v7"/>', 'Simpan Template')
                + tbl('muat-tpl', '<path d="M3 7h6l2 2h10v10H3z"/>', 'Load Template')
                + tbl('png', '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 17l-6-6-8 8"/>', 'Export PNG')
                + tbl('csv', '<path d="M6 3h9l4 4v14H6z"/><path d="M9 12h7M9 16h7"/>', 'Export CSV') + '</div>'
                + '<div id="qdrawTabel"></div></div>'
                + '<div class="qdraw-presets" title="Preset mengatur timeframe & indikator. Custom menyimpan setup Anda (gambar dipulihkan hanya pada simbol yang sama)."><b>Template Preset</b>'
                + Object.keys(PRESET).map(k => '<button type="button" class="qdraw-preset" data-preset="' + k + '">' + PRESET[k].label + '</button>').join('') + '</div>';
            panel.appendChild(p);
            p.addEventListener('click', klikDrawing);
            p.querySelector('.qdraw-select').addEventListener('change', e => {
                if (typeof window.setChartTool === 'function') window.setChartTool(e.target.value || null);
                tandaiAlat();
            });
            p.addEventListener('input', e => {
                const inp = e.target.closest('input[data-warna]'); if (!inp) return;
                const m = mgr(), d = m && m.get(inp.dataset.warna);
                if (d) { m.update(Object.assign({}, d, { style: Object.assign({}, d.style || {}, { color: inp.value }) })); }
            });
        }
        tandaiPreset();
        tarikTemplate();
        jagaManager();
        renderDaftar();
        if (sinkron.status) statusSinkron(sinkron.status, /offline/.test(sinkron.status) ? 'warn' : 'ok');
    }
    function jagaManager() {
        ikatManager();
        if (gbr.jaga) return;
        gbr.jaga = setInterval(() => { if (state.page !== 'drawing' && state.page !== 'chart') { clearInterval(gbr.jaga); gbr.jaga = null; return; } ikatManager(); }, 1000);
    }
    // ── Sinkron gambar & template ke akun (api/chart-state.php) ──
    const sinkron = { impor: false, timer: null, status: '' };
    const kunciGambar = () => String(g('_tvSymbol') || '').replace(/[^a-z0-9]/gi, '_');
    const tsKunci = k => 'qim_sync_ts_' + k;
    function statusSinkron(teks, kelas) {
        sinkron.status = teks;
        const el = $('qdrawSync');
        if (el) { el.textContent = teks; el.className = 'qdraw-sync' + (kelas ? ' ' + kelas : ''); }
    }
    async function apiChart(metode, badan, query) {
        const opsi = { method: metode, cache: 'no-store', headers: {} };
        if (badan) { opsi.headers['Content-Type'] = 'application/json'; opsi.body = JSON.stringify(badan); }
        const r = await fetch('api/chart-state.php' + (query || ''), opsi);
        const d = await r.json().catch(() => ({}));
        if (!r.ok || d.status !== 'success') throw new Error(d.message || 'HTTP ' + r.status);
        return d;
    }
    async function kirimState(kunciServer, nilai, ts) {
        const d = await apiChart('POST', { kunci: kunciServer, nilai, ts });
        simpan(tsKunci(kunciServer), String(d.ts));
        return d;
    }
    /** Saat chart (manajer gambar) baru dibuat: ambil versi akun bila lebih baru, atau unggah versi lokal. */
    async function tarikGambar(m) {
        const kl = kunciGambar();
        if (!m || !kl) return;
        const ks = 'lw:' + kl.toUpperCase();
        try {
            const d = await apiChart('GET', null, '?kunci=' + encodeURIComponent(ks));
            if (m !== mgr()) return;                       // simbol sudah berganti lagi
            const tsLokal = Number(baca(tsKunci(ks)) || 0);
            const lokal = baca('qi_lw_' + kl);
            if (d.nilai && d.ts > tsLokal) {
                sinkron.impor = true;
                try { m.clear(); if (d.nilai !== 'null') m.importJSON(d.nilai); } finally { sinkron.impor = false; }
                simpan('qi_lw_' + kl, d.nilai);
                simpan(tsKunci(ks), String(d.ts));
                statusSinkron('☁ dimuat dari akun', 'ok');
                renderDaftar();
            } else if (lokal && (!d.nilai || tsLokal > d.ts)) {
                await kirimState(ks, lokal, tsLokal || Date.now());
                statusSinkron('☁ tersimpan di akun', 'ok');
            } else statusSinkron('☁ tersinkron', 'ok');
        } catch (e) { statusSinkron('⚠ offline — tersimpan lokal saja', 'warn'); }
    }
    function jadwalKirimGambar(m) {
        if (sinkron.impor || !m) return;
        const ks = 'lw:' + kunciGambar().toUpperCase();
        let nilai;
        try { nilai = m.exportJSON(); } catch (e) { return; }   // ditangkap SEKARANG: simbol bisa berganti sebelum timer jalan
        const ts = Date.now();
        clearTimeout(sinkron.timer);
        statusSinkron('menyimpan…');
        sinkron.timer = setTimeout(async () => {
            try { await kirimState(ks, nilai, ts); statusSinkron('☁ tersimpan ' + new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), 'ok'); }
            catch (e) { statusSinkron('⚠ offline — tersimpan lokal saja', 'warn'); }
        }, 1500);
    }
    /** Template Custom: ambil dari akun bila lebih baru dari salinan lokal. */
    async function tarikTemplate() {
        try {
            const daftar = (await apiChart('GET')).kunci || [];
            for (const x of daftar.filter(x => /^tpl:/.test(x.kunci))) {
                if (x.ts > Number(baca(tsKunci(x.kunci)) || 0)) {
                    const d = await apiChart('GET', null, '?kunci=' + encodeURIComponent(x.kunci));
                    if (d.nilai) { simpan('qim_draw_tpl_' + x.kunci.slice(4), d.nilai); simpan(tsKunci(x.kunci), String(d.ts)); }
                }
            }
            tandaiPreset();
        } catch (e) { /* tetap memakai salinan lokal */ }
    }

    let terapMagnet = null;
    function ikatManager() {
        const m = mgr();
        if (m === gbr.mgr) return;
        gbr.lepas.forEach(f => { try { f(); } catch (e) {} });
        gbr.lepas = [];
        gbr.mgr = m;
        if (m) {
            ['change', 'selection', 'visibility'].forEach(ev => { try { gbr.lepas.push(m.on(ev, () => renderDaftar())); } catch (e) {} });
            try { gbr.lepas.push(m.on('change', () => jadwalKirimGambar(m))); } catch (e) {}
            tarikGambar(m);
            try { gbr.lepas.push(m.on('tool', () => tandaiAlat())); } catch (e) {}
            // Zona Demand/Supply: kotak yang baru ditaruh diberi nama & warna isi zona.
            try {
                gbr.lepas.push(m.on('add', d => {
                    const z = gbr.zona;
                    if (!z || !d || d.kind !== 'rectangle') return;
                    gbr.zona = null;
                    setTimeout(() => { try { m.update(Object.assign({}, d, { name: z.nama, style: Object.assign({}, d.style || {}, { color: z.warna, backgroundColor: z.warna, fillBackground: true, transparency: 82 }) })); } catch (e) {} }, 0);
                }));
            } catch (e) {}
            // Manajer baru (chart dibangun ulang) → terapkan lagi pilihan magnet & mode tetap.
            if (terapMagnet) terapMagnet();
            try { m.setStayInDrawingMode(baca('qim_draw_tetap') === '1'); } catch (e) {}
        }
        renderDaftar();
        tandaiAlat();
    }
    function tandaiAlat() {
        const m = mgr();
        const aktif = m ? (m.tool() || '') : (g('_lwTool') || '');
        document.querySelectorAll('.qdraw-tool[data-alat]').forEach(b => b.classList.toggle('active', (b.dataset.alat || '') === aktif));
        document.querySelectorAll('.qdraw-dbtn[data-dalat]').forEach(b => b.classList.toggle('active', b.dataset.dalat === aktif && !(aktif === 'rectangle' && gbr.zona)));
        const zb = document.querySelector('.qdraw-dbtn[data-aksi="zona"]'); if (zb) zb.classList.toggle('active', aktif === 'rectangle' && !!gbr.zona);
        const sel = document.querySelector('.qdraw-select');
        if (sel) sel.value = Array.from(sel.options).some(o => o.value === aktif) ? aktif : '';
    }
    function namaWarna(hex) {
        const h = String(hex || '').toLowerCase();
        const tabel = [['Kuning', [250, 204, 21]], ['Biru', [37, 99, 235]], ['Ungu', [139, 92, 246]], ['Hijau', [34, 197, 94]], ['Merah', [239, 68, 68]], ['Putih', [240, 240, 240]], ['Oranye', [249, 115, 22]], ['Cyan', [6, 182, 212]], ['Abu-abu', [128, 128, 128]]];
        const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/.exec(h);
        if (!m) return h || '—';
        const rgb = [1, 2, 3].map(i => parseInt(m[i], 16));
        let terbaik = tabel[0], jarak = Infinity;
        tabel.forEach(t => { const d = t[1].reduce((s, v, i) => s + (v - rgb[i]) ** 2, 0); if (d < jarak) { jarak = d; terbaik = t; } });
        return terbaik[0];
    }
    const keHex = c => { const s = String(c || ''); if (/^#[0-9a-f]{6}/i.test(s)) return s.slice(0, 7); const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/i.exec(s); return m ? '#' + [1, 2, 3].map(i => (+m[i]).toString(16).padStart(2, '0')).join('') : '#2962ff'; };
    function renderDaftar() {
        const w = $('qdrawTabel'); if (!w) return;
        const m = mgr();
        if (!m) { w.innerHTML = '<div class="qcomp-empty">Alat gambar belum siap (mode chart Quantum diperlukan).</div>'; return; }
        const daftar = m.drawings();
        const pilih = new Set(m.selection());
        const pair = g('_tvSymLabel') || '—';
        const tf = TF_LABEL[g('_tvInterval')] || g('_tvInterval') || '—';
        if (!daftar.length) { w.innerHTML = '<div class="qcomp-empty">Belum ada gambar. Pilih alat di atas atau tekan “Tambah Gambar”, lalu klik pada chart.</div>'; return; }
        const semuaTampil = m.drawingsVisible();
        w.innerHTML = '<table class="qdraw-table"><thead><tr><th>No</th><th>Tipe</th><th>Pair</th><th>Timeframe</th><th>Warna</th><th>Status</th><th>Aksi</th></tr></thead><tbody>'
            + daftar.map((d, i) => {
                const hex = keHex(d.style && d.style.color);
                const aktif = semuaTampil && !d.hidden;
                return '<tr class="' + (pilih.has(d.id) ? 'sel' : '') + '"><td>' + (i + 1) + '</td><td>' + esc(d.name || NAMA_ALAT[d.kind] || d.kind) + '</td><td>' + esc(pair) + '</td><td>' + esc(tf) + '</td>'
                    + '<td><span class="qdraw-color"><i style="background:' + hex + '"></i>' + esc(namaWarna(hex)) + '<input type="color" value="' + hex + '" data-warna="' + esc(d.id) + '" aria-label="Ubah warna gambar ' + (i + 1) + '"></span></td>'
                    + '<td><button type="button" class="qdraw-status' + (aktif ? '' : ' off') + '" style="border:0;background:none;cursor:pointer" data-sembunyi="' + esc(d.id) + '" title="Klik untuk tampil/sembunyi">' + (aktif ? 'Aktif' : 'Tersembunyi') + '</button></td>'
                    + '<td><button type="button" class="qdraw-act" data-edit="' + esc(d.id) + '">Edit</button> <button type="button" class="qdraw-act del" data-hapus="' + esc(d.id) + '">Hapus</button></td></tr>';
            }).join('') + '</tbody></table>';
    }
    function unduh(nama, isi, tipe) {
        const a = document.createElement('a');
        a.href = typeof isi === 'string' && isi.startsWith('data:') ? isi : URL.createObjectURL(new Blob([isi], { type: tipe }));
        a.download = nama;
        document.body.appendChild(a); a.click(); a.remove();
        if (!a.href.startsWith('data:')) setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }
    function tandaiPreset() {
        const aktif = baca('qim_draw_preset') || '';
        document.querySelectorAll('.qdraw-preset').forEach(b => {
            b.classList.toggle('active', b.dataset.preset === aktif);
            const pr = PRESET[b.dataset.preset];
            if (pr && pr.custom) b.innerHTML = esc(pr.label) + (baca('qim_draw_tpl_' + b.dataset.preset) ? '' : ' <small>(kosong)</small>');
        });
    }
    function setIndikator(daftarOn) {
        SEMUA_IND.forEach(id => {
            const b = $(id); if (!b) return;
            const on = b.dataset.on === 'true';
            if (on !== daftarOn.includes(id)) b.click();
        });
    }
    function terapkanPreset(k) {
        const pr = PRESET[k]; if (!pr) return;
        if (pr.custom) {
            const raw = baca('qim_draw_tpl_' + k);
            if (!raw) { simpan('qim_draw_preset', k); tandaiPreset(); toast(pr.label + ' masih kosong — atur chart lalu tekan “Simpan Template”.', 'info'); return; }
            muatTemplate(k);
            return;
        }
        simpan('qim_draw_preset', k);
        if (typeof window.setChartInterval === 'function') window.setChartInterval(pr.iv);
        setTimeout(() => setIndikator(pr.ind), 300);
        tandaiPreset();
        toast(pr.label + ': ' + TF_LABEL[pr.iv] + ' + ' + pr.ind.length + ' indikator.', 'success');
    }
    function slotTemplate() {
        const k = baca('qim_draw_preset');
        return (k && PRESET[k] && PRESET[k].custom) ? k : 'custom1';
    }
    function simpanTemplate() {
        const k = slotTemplate(), m = mgr();
        const data = {
            iv: g('_tvInterval'), simbol: g('_tvSymbol'),
            ind: SEMUA_IND.filter(id => $(id) && $(id).dataset.on === 'true'),
            gambar: m ? m.exportJSON() : null, disimpan: new Date().toISOString()
        };
        simpan('qim_draw_tpl_' + k, JSON.stringify(data));
        simpan('qim_draw_preset', k);
        tandaiPreset();
        kirimState('tpl:' + k, JSON.stringify(data), Date.now())
            .then(() => toast('Template disimpan ke ' + PRESET[k].label + ' (tersimpan di akun).', 'success'))
            .catch(() => toast('Template disimpan ke ' + PRESET[k].label + ' di perangkat ini (akun tidak terjangkau).', 'warning'));
    }
    function muatTemplate(k) {
        k = k || slotTemplate();
        let data = null;
        try { data = JSON.parse(baca('qim_draw_tpl_' + k) || 'null'); } catch (e) {}
        if (!data) { toast(PRESET[k].label + ' masih kosong.', 'info'); return; }
        simpan('qim_draw_preset', k);
        if (data.iv && typeof window.setChartInterval === 'function') window.setChartInterval(data.iv);
        setTimeout(() => {
            setIndikator(data.ind || []);
            const m = mgr();
            if (m && data.gambar && data.simbol === g('_tvSymbol')) { m.clear(); m.importJSON(data.gambar); }
            else if (data.gambar && data.simbol !== g('_tvSymbol')) toast('Gambar template milik ' + String(data.simbol).split(':').pop() + ' — hanya timeframe & indikator yang diterapkan.', 'info');
            renderDaftar();
        }, 400);
        tandaiPreset();
    }
    const ZONA = {
        demand: { nama: 'Demand Zone', warna: '#22c55e' },
        supply: { nama: 'Supply Zone', warna: '#ef4444' }
    };
    function klikDrawing(e) {
        const m = mgr();
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.dalat) { gbr.zona = null; if (typeof window.setChartTool === 'function') window.setChartTool(b.dataset.dalat); tandaiAlat(); return; }
        if (b.dataset.aksi === 'zona') {
            const p = bukaPopover(b, '<div class="qch-pop-title">Gambar zona</div>'
                + '<button type="button" class="qch-item" data-zona="demand"><i class="qdraw-swatch" style="background:#22c55e"></i>Demand Zone (area beli)</button>'
                + '<button type="button" class="qch-item" data-zona="supply"><i class="qdraw-swatch" style="background:#ef4444"></i>Supply Zone (area jual)</button>', 220);
            if (p) p.addEventListener('click', ev => {
                const z = ev.target.closest('[data-zona]'); if (!z) return;
                gbr.zona = ZONA[z.dataset.zona];
                if (typeof window.setChartTool === 'function') window.setChartTool('rectangle');
                tandaiAlat();
                tutupPopover();
                toast('Tarik kotak di chart untuk ' + gbr.zona.nama + '.', 'info');
            });
            return;
        }
        if (b.dataset.aksi === 'hapus') {
            if (m && m.selection().length) { if (typeof window.lwDeleteSelected === 'function') window.lwDeleteSelected(); }
            else toast('Pilih gambar dulu (klik di chart atau tombol Edit di tabel).', 'info');
            return;
        }
        if (b.dataset.aksi === 'reset') {
            if (m && m.drawings().length && confirm('Hapus SEMUA gambar di chart ' + (g('_tvSymLabel') || '') + '?')) { if (typeof window.lwClearAll === 'function') window.lwClearAll(); }
            gbr.zona = null;
            if (typeof window.setChartTool === 'function') window.setChartTool(null);
            tandaiAlat(); renderDaftar();
            return;
        }
        if (b.dataset.preset) { terapkanPreset(b.dataset.preset); return; }
        if (b.dataset.hapus && m) { m.remove(b.dataset.hapus); return; }
        if (b.dataset.edit && m) { m.select([b.dataset.edit]); renderDaftar(); toast('Gambar dipilih — seret titiknya di chart untuk mengubah, atau ganti warnanya di tabel.', 'info'); return; }
        if (b.dataset.sembunyi && m) {
            if (!m.drawingsVisible()) m.setDrawingsVisible(true);
            const d = m.get(b.dataset.sembunyi); if (d) m.setHidden(d.id, !d.hidden);
            renderDaftar(); return;
        }
        const aksi = b.dataset.aksi;
        if (aksi === 'tambah') { if (typeof window.setChartTool === 'function') window.setChartTool('trend-line'); tandaiAlat(); toast('Klik dua titik di chart untuk menggambar trendline.', 'info'); }
        if (aksi === 'simpan-tpl') simpanTemplate();
        if (aksi === 'muat-tpl') muatTemplate();
        if (aksi === 'png') {
            const c = g('_lwChart');
            try {
                const kanvas = c && c.takeScreenshot();
                if (!kanvas) throw new Error('chart belum siap');
                unduh('qim-' + String(g('_tvSymLabel') || 'chart').replace(/[^A-Za-z0-9]/g, '') + '-' + (TF_LABEL[g('_tvInterval')] || '') + '.png', kanvas.toDataURL('image/png'));
            } catch (er) { toast('Export PNG gagal: ' + er.message, 'error'); }
        }
        if (aksi === 'csv') {
            if (!m || !m.drawings().length) { toast('Belum ada gambar untuk diekspor.', 'info'); return; }
            const pair = g('_tvSymLabel') || '', tf = TF_LABEL[g('_tvInterval')] || '';
            const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
            const baris = [['No', 'Tipe', 'Pair', 'Timeframe', 'Warna', 'Status', 'Titik'].map(q).join(',')];
            m.drawings().forEach((d, i) => baris.push([i + 1, d.name || NAMA_ALAT[d.kind] || d.kind, pair, tf, keHex(d.style && d.style.color), d.hidden ? 'Tersembunyi' : 'Aktif', JSON.stringify(d.points || d.p || '')].map(q).join(',')));
            unduh('qim-gambar-' + pair.replace(/[^A-Za-z0-9]/g, '') + '.csv', baris.join('\r\n'), 'text/csv;charset=utf-8');
        }
    }

    // ═════════════════════════════════════════════════════════════════════════
    // KEPALA CHART: header simbol + bilah alat (timeframe, Indikator, Template, Alert,
    // Bandingkan, Replay, pengaturan, layar penuh) + legenda di atas chart.
    // Elemen lama (bilah atas, baris indikator, bilah OHLC) tidak dihapus: tombolnya
    // dipindah ke menu, jadi handler & status aslinya tetap bekerja.
    // ═════════════════════════════════════════════════════════════════════════
    const NAMA_SIMBOL = {
        BTCUSDT: 'Bitcoin / TetherUS', ETHUSDT: 'Ethereum / TetherUS', SOLUSDT: 'Solana / TetherUS', BNBUSDT: 'BNB / TetherUS', XRPUSDT: 'XRP / TetherUS',
        XAUUSD: 'Gold / U.S. Dollar', EURUSD: 'Euro / U.S. Dollar', GBPUSD: 'British Pound / U.S. Dollar', USDJPY: 'U.S. Dollar / Japanese Yen',
        AUDUSD: 'Australian Dollar / U.S. Dollar', USDCHF: 'U.S. Dollar / Swiss Franc', USDCAD: 'U.S. Dollar / Canadian Dollar',
        GBPJPY: 'British Pound / Japanese Yen', EURJPY: 'Euro / Japanese Yen'
    };
    const TF_UTAMA = [['1', '1m'], ['5', '5m'], ['15', '15m'], ['60', '1h'], ['240', '4h'], ['D', '1D'], ['W', '1W']];
    const TF_LAIN = [['30', '30m'], ['MN', '1M']];
    const ch = { siap: false, timer: null, kunci: '', iv: '', harga: null, popover: null, banding: [], bandingChart: null, bandingIv: '', replay: null };

    function simbolKini() {
        const tv = String(g('_tvSymbol') || '');
        const grup = g('WL_GROUPS') || [];
        const s = grup.flatMap(x => x.syms).find(x => x.tv === tv);
        return s || { key: tv.split(':').pop(), label: g('_tvSymLabel') || tv, tv };
    }
    const angkaRingkas = v => {
        const n = Number(v);
        if (!Number.isFinite(n) || n <= 0) return '—';
        return n >= 1e9 ? (n / 1e9).toFixed(2) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(2) + 'K' : n.toFixed(2);
    };
    const hargaTeks = (v, key) => {
        const n = Number(v);
        if (!Number.isFinite(n)) return '—';
        const d = /JPY$/.test(key) ? 3 : (n < 10 ? 5 : 2);
        return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
    };

    function siapkanKepalaChart() {
        const panel = $('panel-charts');
        if (!panel) return;
        if (!ch.siap) {
            ch.siap = true;
            const ringkas = panel.querySelector('.qim-pair-summary');
            const head = document.createElement('div');
            head.className = 'qch-head';
            head.innerHTML = '<button type="button" class="qch-sym" data-ch="simbol" aria-haspopup="true" title="Ganti simbol"><span class="qch-sym-icon" id="qchIcon"></span>'
                + '<span class="qch-sym-text"><b id="qchTitle">—</b><small id="qchSub">—</small></span></button>'
                + '<button type="button" class="qch-star" id="qchStar" data-ch="favorit" aria-pressed="false" title="Tambah ke watchlist">★</button>'
                + '<div class="qch-price"><strong id="qchPrice">—</strong><span id="qchChg">—</span></div>'
                + '<div class="qch-stat"><small>24h High</small><b id="qchHigh">—</b></div>'
                + '<div class="qch-stat"><small>24h Low</small><b id="qchLow" class="qim-down">—</b></div>'
                + '<div class="qch-stat"><small>24h Vol</small><b id="qchVol">—</b></div>';
            const bar = document.createElement('div');
            bar.className = 'qch-bar';
            bar.setAttribute('role', 'toolbar');
            bar.setAttribute('aria-label', 'Alat chart');
            bar.innerHTML = '<div class="qch-tfs">' + TF_UTAMA.map(([iv, l]) => '<button type="button" class="qch-tf" data-iv="' + iv + '">' + l + '</button>').join('')
                + '<button type="button" class="qch-tf qch-tf-more" data-ch="tf" aria-haspopup="true" title="Timeframe lain">⌄</button></div>'
                + '<span class="qch-sep"></span>'
                + '<button type="button" class="qch-btn" data-ch="indikator">' + ikon('<path d="M3 17l5-6 4 3 6-8 3 3"/>') + 'Indikator</button>'
                + '<button type="button" class="qch-btn" data-ch="template">' + ikon('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>') + 'Template</button>'
                + '<button type="button" class="qch-btn" data-ch="alert">' + ikon('<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>') + 'Alert</button>'
                + '<button type="button" class="qch-btn" data-ch="banding">' + ikon('<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>') + 'Bandingkan</button>'
                + '<button type="button" class="qch-btn" data-ch="replay">' + ikon('<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>') + 'Replay</button>'
                + '<button type="button" class="qch-btn qch-setup-btn" data-ch="setup" title="Setup Analisa: SMC, ICT, Fibonacci, S&amp;D">' + ikon('<path d="M4 19h16"/><path d="M6 15h12v-4H6z"/><path d="M6 11V7h12v4"/>') + 'Setup</button>'
                + '<span class="qch-spacer"></span>'
                + '<button type="button" class="qch-icon" data-ch="setelan" title="Pengaturan chart" aria-label="Pengaturan chart">' + ikon(I.gear) + '</button>'
                + '<button type="button" class="qch-icon" data-ch="layar" title="Layar penuh" aria-label="Layar penuh">' + ikon('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>') + '</button>';
            if (ringkas) { ringkas.insertAdjacentElement('beforebegin', head); ringkas.classList.add('qch-old'); }
            else panel.insertBefore(head, panel.firstChild);
            head.insertAdjacentElement('afterend', bar);
            const atas = $('chartTopBar'); if (atas) atas.classList.add('qch-old');
            const barisInd = $('indEMA20') && $('indEMA20').parentElement; if (barisInd) barisInd.classList.add('qch-old', 'qch-indrow');
            head.addEventListener('click', klikKepala);
            bar.addEventListener('click', klikKepala);
            document.addEventListener('click', e => { if (ch.popover && !e.target.closest('.qch-pop, [data-ch]')) tutupPopover(); });
            document.addEventListener('keydown', e => { if (e.key === 'Escape') tutupPopover(); });
        }
        pasangLegenda();
        segarkanKepala(true);
        clearInterval(ch.timer);
        ch.timer = setInterval(() => {
            if (state.page !== 'chart' && state.page !== 'drawing') { clearInterval(ch.timer); ch.timer = null; return; }
            segarkanKepala(false);
            perbaruiLegenda();
            jagaBanding();
            jagaReplay();
        }, 1000);
    }

    let detikHarga = 0;
    async function segarkanKepala(paksa) {
        const s = simbolKini();
        const iv = String(g('_tvInterval') || '');
        if (s.key !== ch.kunci) {
            ch.kunci = s.key; paksa = true;
            $('qchTitle').textContent = s.key;
            $('qchSub').textContent = NAMA_SIMBOL[s.key] || s.label;
            $('qchIcon').innerHTML = ikonAset(s.key);
            tandaiFavorit();
        }
        if (iv !== ch.iv) {
            ch.iv = iv;
            document.querySelectorAll('.qch-tf[data-iv]').forEach(b => b.classList.toggle('active', b.dataset.iv === iv));
            const lain = TF_LAIN.find(t => t[0] === iv);
            const more = document.querySelector('.qch-tf-more');
            if (more) { more.textContent = lain ? lain[1] + ' ⌄' : '⌄'; more.classList.toggle('active', !!lain); }
        }
        if (!paksa && ++detikHarga < 10) return;
        detikHarga = 0;
        try {
            const r = await fetch('api/live-price.php?symbols=' + encodeURIComponent(s.key), { cache: 'no-store' });
            const d = await r.json();
            const x = d && d.prices && d.prices[s.key];
            if (!x || s.key !== ch.kunci) return;
            ch.harga = Number(x.price);
            const buka = Number(x.open), pct = Number(x.chgPct);
            const naik = !(Number.isFinite(pct) && pct < 0);
            const p = $('qchPrice'); p.textContent = hargaTeks(x.price, s.key); p.className = naik ? 'qim-up' : 'qim-down';
            const abs = Number.isFinite(buka) && buka > 0 ? ch.harga - buka : null;
            const c = $('qchChg');
            c.textContent = Number.isFinite(pct)
                ? (abs != null ? (abs >= 0 ? '+' : '-') + hargaTeks(Math.abs(abs), s.key) + ' ' : '') + '(' + (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%)'
                : '—';
            c.className = naik ? 'qim-up' : 'qim-down';
            $('qchHigh').textContent = hargaTeks(x.high, s.key);
            $('qchLow').textContent = hargaTeks(x.low, s.key);
            const vol = angkaRingkas(x.vol);
            $('qchVol').textContent = vol === '—' ? '—' : vol + (s.key.endsWith('USDT') ? ' ' + s.key.replace('USDT', '') : '');
            $('qchVol').title = vol === '—' ? 'Volume tidak tersedia untuk instrumen OTC/forex dari sumber ini.' : '';
        } catch (e) { /* biarkan nilai terakhir */ }
    }

    const WL_BAWAAN = ['XAUUSD', 'BTCUSDT', 'EURUSD', 'ETHUSDT'];   // sama dengan loadWatchlist() di advanced-trading.js
    function tandaiFavorit() {
        let wl = [];
        try { wl = JSON.parse(localStorage.getItem('qi_watchlist') || '[]'); } catch (e) {}
        if (!wl.length) wl = WL_BAWAAN;
        const on = wl.includes(ch.kunci);
        const b = $('qchStar'); if (!b) return;
        b.classList.toggle('on', on);
        b.setAttribute('aria-pressed', String(on));
        b.title = on ? 'Hapus dari watchlist' : 'Tambah ke watchlist';
    }
    function alihFavorit() {
        let wl = [];
        try { wl = JSON.parse(localStorage.getItem('qi_watchlist') || '[]'); } catch (e) {}
        if (!wl.length) wl = WL_BAWAAN.slice();
        const ada = wl.includes(ch.kunci);
        wl = ada ? wl.filter(x => x !== ch.kunci) : wl.concat(ch.kunci);
        simpan('qi_watchlist', JSON.stringify(wl));
        try { if (typeof window.loadWatchlist === 'function') window.loadWatchlist(); if (typeof window.renderPanelWatchlist === 'function') window.renderPanelWatchlist(); } catch (e) {}
        tandaiFavorit();
        toast(ch.kunci + (ada ? ' dihapus dari' : ' ditambahkan ke') + ' watchlist.', 'success');
    }

    // ── Popover ──
    function tutupPopover() {
        if (ch.popover) {
            // Kait sebelum tutup: mis. tombol indikator asli dikembalikan dulu ke barisnya
            // supaya tidak ikut terhapus bersama popover.
            try { if (typeof ch.popover.qimSebelumTutup === 'function') ch.popover.qimSebelumTutup(); } catch (e) {}
            ch.popover.remove(); ch.popover = null;
        }
        document.querySelectorAll('[data-ch].open').forEach(b => b.classList.remove('open'));
    }
    function bukaPopover(tombol, html, lebar) {
        const sama = ch.popover && ch.popover.dataset.dari === tombol.dataset.ch;
        tutupPopover();
        if (sama) return null;
        const p = document.createElement('div');
        p.className = 'qch-pop';
        p.dataset.dari = tombol.dataset.ch;
        p.setAttribute('role', 'dialog');
        p.innerHTML = html;
        document.body.appendChild(p);
        const r = tombol.getBoundingClientRect();
        const w = lebar || 260;
        p.style.width = w + 'px';
        p.style.top = Math.round(r.bottom + 6) + 'px';
        p.style.left = Math.round(Math.max(8, Math.min(window.innerWidth - w - 8, r.left))) + 'px';
        // Tidak cukup ruang di bawah (mis. bilah status) → buka ke atas.
        const naik = () => { const h = p.offsetHeight; if (r.bottom + 6 + h > window.innerHeight - 8 && r.top - h - 6 > 8) p.style.top = Math.round(r.top - h - 6) + 'px'; };
        naik();
        new MutationObserver(naik).observe(p, { childList: true, subtree: true });
        tombol.classList.add('open');
        ch.popover = p;
        return p;
    }

    window.qimTutupPopoverChart = tutupPopover;

    function klikKepala(e) {
        const tfb = e.target.closest('.qch-tf[data-iv]');
        if (tfb) { if (typeof window.setChartInterval === 'function') window.setChartInterval(tfb.dataset.iv); tutupPopover(); segarkanKepala(false); return; }
        const b = e.target.closest('[data-ch]');
        if (!b) return;
        const aksi = b.dataset.ch;
        if (aksi === 'favorit') return alihFavorit();
        if (aksi === 'layar') { tutupPopover(); if (typeof window.toggleChartFullscreenMode === 'function') window.toggleChartFullscreenMode(); return; }
        if (aksi === 'tf') {
            const p = bukaPopover(b, '<div class="qch-pop-title">Timeframe lain</div>' + TF_LAIN.map(([iv, l]) => '<button type="button" class="qch-item" data-iv-lain="' + iv + '">' + l + '</button>').join(''), 160);
            if (p) p.addEventListener('click', ev => { const x = ev.target.closest('[data-iv-lain]'); if (x) { window.setChartInterval && window.setChartInterval(x.dataset.ivLain); tutupPopover(); } });
            return;
        }
        if (aksi === 'simbol') {
            const grup = g('WL_GROUPS') || [];
            const p = bukaPopover(b, '<input type="search" class="qch-search" placeholder="Cari simbol…" aria-label="Cari simbol">'
                + grup.map(gr => '<div class="qch-pop-title">' + esc(gr.label) + '</div>' + gr.syms.map(s => '<button type="button" class="qch-item qch-symitem" data-sym="' + esc(s.key) + '">' + ikonAset(s.key) + '<b>' + esc(s.label) + '</b><small>' + esc(NAMA_SIMBOL[s.key] || '') + '</small></button>').join('')).join(''), 300);
            if (!p) return;
            const cari = p.querySelector('input');
            cari.focus();
            cari.addEventListener('input', () => { const q = cari.value.trim().toLowerCase(); p.querySelectorAll('.qch-symitem').forEach(x => { x.hidden = q && !x.textContent.toLowerCase().includes(q); }); });
            p.addEventListener('click', ev => {
                const x = ev.target.closest('[data-sym]'); if (!x) return;
                const s = grup.flatMap(gr => gr.syms).find(y => y.key === x.dataset.sym);
                if (s && typeof window.setChartSymbolFull === 'function') window.setChartSymbolFull(s.key, s.tv, s.label);
                tutupPopover();
            });
            return;
        }
        if (aksi === 'indikator') {
            const p = bukaPopover(b, '<div class="qch-pop-title">Indikator di chart</div><div class="qch-indgrid"></div><p class="qim-note" style="margin:8px 0 0">Chart dimulai bersih: nyalakan hanya indikator yang dibutuhkan.</p>', 320);
            if (!p) return;
            const grid = p.querySelector('.qch-indgrid');
            SEMUA_IND.forEach(id => { const t = $(id); if (t) grid.appendChild(t); });
            // Saat popover ditutup, tombol dikembalikan ke barisnya (tetap tersembunyi) supaya id-nya selalu ada di DOM.
            const baris = document.querySelector('.qch-indrow');
            p.qimSebelumTutup = () => { if (baris) Array.from(grid.children).forEach(t => baris.appendChild(t)); };
            return;
        }
        if (aksi === 'template') {
            const aktif = baca('qim_draw_preset') || '';
            const p = bukaPopover(b, '<div class="qch-pop-title">Template chart</div>' + Object.keys(PRESET).map(k => '<button type="button" class="qch-item' + (k === aktif ? ' active' : '') + '" data-preset-ch="' + k + '">' + esc(PRESET[k].label)
                + (PRESET[k].custom ? (baca('qim_draw_tpl_' + k) ? '' : ' <small>(kosong)</small>') : ' <small>' + TF_LABEL[PRESET[k].iv] + '</small>') + '</button>').join('')
                + '<div class="qch-pop-sep"></div><button type="button" class="qch-item" data-ch-tpl="simpan">💾 Simpan setup ke ' + esc(PRESET[slotTemplate()].label) + '</button>', 250);
            if (p) p.addEventListener('click', ev => {
                const x = ev.target.closest('[data-preset-ch]'); if (x) { terapkanPreset(x.dataset.presetCh); tutupPopover(); return; }
                if (ev.target.closest('[data-ch-tpl="simpan"]')) { simpanTemplate(); tutupPopover(); }
            });
            return;
        }
        if (aksi === 'alert') {
            const s = simbolKini();
            const h = ch.harga;
            const p = bukaPopover(b, '<div class="qch-pop-title">Price alert · ' + esc(s.key) + '</div>'
                + '<label class="qch-field"><span>Harga target</span><input type="number" step="any" id="qchAlertHarga" value="' + (Number.isFinite(h) ? h : '') + '"></label>'
                + '<label class="qch-field"><span>Kondisi</span><select id="qchAlertArah"><option value="above">Harga naik ke / di atas</option><option value="below">Harga turun ke / di bawah</option></select></label>'
                + '<button type="button" class="qim-btn qim-btn-primary" style="width:100%" id="qchAlertBuat">Buat Alert</button>'
                + '<button type="button" class="qch-link" id="qchAlertKelola">Kelola semua alert →</button>', 260);
            if (!p) return;
            const inp = p.querySelector('#qchAlertHarga'), arah = p.querySelector('#qchAlertArah');
            inp.addEventListener('input', () => { const v = Number(inp.value); if (Number.isFinite(v) && Number.isFinite(ch.harga)) arah.value = v >= ch.harga ? 'above' : 'below'; });
            p.querySelector('#qchAlertBuat').addEventListener('click', async () => {
                const v = Number(inp.value);
                if (!Number.isFinite(v) || v <= 0) { toast('Isi harga target yang valid.', 'warning'); return; }
                // Disimpan di server (qim-alerts.js): berbunyi juga lewat Telegram/Discord/Slack/email walau dashboard ditutup.
                if (window.QimAlerts) {
                    try {
                        await window.QimAlerts.tambah(s.key, v, arah.value);
                        toast('Alert ' + s.key + ' ' + (arah.value === 'above' ? '≥ ' : '≤ ') + v + ' disimpan di server.', 'success');
                        try { if (typeof window.requestNotificationPermission === 'function') window.requestNotificationPermission(); } catch (er) {}
                        tutupPopover();
                    } catch (er) { toast('Alert gagal disimpan: ' + er.message, 'error'); }
                    return;
                }
                const daftar = window._priceAlerts;
                if (!Array.isArray(daftar) || typeof window.saveAlerts !== 'function') { toast('Modul alert belum siap — buka panel Price Alerts.', 'error'); return; }
                daftar.push({ id: Date.now(), symbol: s.key, price: v, direction: arah.value, active: true, createdAt: new Date().toISOString() });
                window.saveAlerts();
                try { if (typeof window.renderAlerts === 'function') window.renderAlerts(); if (typeof window.requestNotificationPermission === 'function') window.requestNotificationPermission(); } catch (er) {}
                toast('Alert ' + s.key + ' ' + (arah.value === 'above' ? '≥ ' : '≤ ') + v + ' dibuat.', 'success');
                tutupPopover();
            });
            p.querySelector('#qchAlertKelola').addEventListener('click', () => { tutupPopover(); window.switchPanel && window.switchPanel('panel-alerts'); });
            return;
        }
        if (aksi === 'setup') {
            // Layar penuh menutupi kolom kanan, jadi kartu Setup Analisa dipinjamkan ke popover
            // (fungsi dan tombolnya sama) lalu dikembalikan ke kolom kanan saat popover ditutup.
            const kartu = document.querySelector('.qim-setup-card');
            if (!kartu) { toast('Panel Setup Analisa tidak ditemukan.', 'error'); return; }
            const p = bukaPopover(b, '<div class="qch-setup-host"></div>', 370);
            if (!p) return;
            p.classList.add('qch-pop-setup');
            const asal = kartu.parentElement, sesudah = kartu.nextElementSibling;
            p.querySelector('.qch-setup-host').appendChild(kartu);
            p.qimSebelumTutup = () => { if (asal) asal.insertBefore(kartu, sesudah && sesudah.parentElement === asal ? sesudah : null); };
            return;
        }
        if (aksi === 'banding') return popoverBanding(b);
        if (aksi === 'replay') { tutupPopover(); return ch.replay ? hentikanReplay() : mulaiReplay(); }
        if (aksi === 'setelan') {
            const p = bukaPopover(b, '<div class="qch-pop-title">Pengaturan chart</div><div class="qch-setgrid"></div>', 240);
            if (!p) return;
            const grid = p.querySelector('.qch-setgrid');
            ['btnChartQuantum', 'btnChartTradingView', 'btnBersihChart', 'watchlistToggleBtn'].forEach(id => { const t = $(id); if (t) grid.appendChild(t.cloneNode(true)).removeAttribute('id'); });
            const fit = document.createElement('button'); fit.type = 'button'; fit.textContent = '⤢ Fit — tampilkan semua bar'; fit.addEventListener('click', () => { try { g('_lwChart').timeScale().fitContent(); } catch (er) {} });
            grid.appendChild(fit);
            grid.querySelectorAll('button').forEach(x => { x.className = 'qch-item'; x.addEventListener('click', () => setTimeout(tutupPopover, 50)); });
        }
    }

    // ── Bandingkan: overlay % perubahan simbol lain di skala kiri ──
    function popoverBanding(b) {
        const s = simbolKini();
        const grup = (g('WL_GROUPS') || []).flatMap(x => x.syms).filter(x => x.key !== s.key);
        const html = '<div class="qch-pop-title">Bandingkan dengan ' + esc(s.key) + '</div>'
            + '<p class="qim-note" style="margin:0 0 6px">Garis = perubahan % sejak bar pertama yang sama, di skala kiri.</p>'
            + (ch.banding.length ? ch.banding.map(x => '<div class="qch-item qch-cmp"><i style="background:' + x.warna + '"></i>' + esc(x.key) + '<button type="button" data-lepas="' + esc(x.key) + '" aria-label="Hapus ' + esc(x.key) + '">✕</button></div>').join('') + '<div class="qch-pop-sep"></div>' : '')
            + grup.map(x => '<button type="button" class="qch-item qch-symitem" data-banding="' + esc(x.key) + '"' + (ch.banding.some(y => y.key === x.key) ? ' disabled' : '') + '>' + ikonAset(x.key) + '<b>' + esc(x.label) + '</b></button>').join('');
        const p = bukaPopover(b, html, 260);
        if (!p) return;
        p.addEventListener('click', async ev => {
            const lepas = ev.target.closest('[data-lepas]');
            if (lepas) { lepasBanding(lepas.dataset.lepas); tutupPopover(); return; }
            const x = ev.target.closest('[data-banding]');
            if (!x) return;
            tutupPopover();
            if (ch.banding.length >= 3) { toast('Maksimal 3 simbol pembanding.', 'info'); return; }
            await tambahBanding(x.dataset.banding);
        });
    }
    const WARNA_BANDING = ['#f5b83d', '#a78bfa', '#22d3ee'];
    async function tambahBanding(key) {
        const chart = g('_lwChart'), mod = window._lwModules;
        if (!chart || !mod || !mod.LineSeries) { toast('Chart belum siap.', 'error'); return; }
        const warna = WARNA_BANDING.find(w => !ch.banding.some(x => x.warna === w)) || '#94a3b8';
        try {
            const r = await fetch('api/get-chart-data.php?symbol=' + encodeURIComponent(key) + '&interval=' + encodeURIComponent(g('_tvInterval')));
            const d = await r.json();
            const c = (d.candles || []).filter(x => x.time && x.close);
            const utama = g('_lwLastCandles') || [];
            if (!c.length || !utama.length) { toast('Data ' + key + ' tidak tersedia.', 'error'); return; }
            const t0 = utama[0].time;
            const dasar = c.find(x => x.time >= t0) || c[0];
            const data = c.filter(x => x.time >= dasar.time).map(x => ({ time: x.time, value: (x.close / dasar.close - 1) * 100 }));
            const seri = chart.addSeries(mod.LineSeries, { color: warna, lineWidth: 2, priceScaleId: 'left', title: key + ' %', lastValueVisible: true, priceLineVisible: false,
                priceFormat: { type: 'custom', formatter: v => (v >= 0 ? '+' : '') + v.toFixed(2) + '%' } });
            chart.priceScale('left').applyOptions({ visible: true, borderColor: '#18253c' });
            seri.setData(data);
            ch.banding.push({ key, warna, seri, data });
            ch.bandingChart = chart; ch.bandingIv = g('_tvInterval');
            if (d.simulated) toast('Perhatian: data ' + key + ' dari server ditandai simulasi.', 'warning');
            perbaruiLegenda();
        } catch (e) { toast('Gagal memuat ' + key + '.', 'error'); }
    }
    function lepasBanding(key) {
        const chart = g('_lwChart');
        ch.banding = ch.banding.filter(x => { if (x.key !== key) return true; try { if (chart === ch.bandingChart) chart.removeSeries(x.seri); } catch (e) {} return false; });
        if (!ch.banding.length && chart) { try { chart.priceScale('left').applyOptions({ visible: false }); } catch (e) {} }
        perbaruiLegenda();
    }
    function jagaBanding() {
        if (!ch.banding.length) return;
        const chart = g('_lwChart'), iv = g('_tvInterval');
        if (chart === ch.bandingChart && iv === ch.bandingIv) return;
        // Chart dibangun ulang (ganti simbol) atau timeframe berubah → muat ulang pembanding.
        const kunci = ch.banding.map(x => x.key);
        if (chart === ch.bandingChart) ch.banding.forEach(x => { try { chart.removeSeries(x.seri); } catch (e) {} });
        ch.banding = []; ch.bandingChart = chart; ch.bandingIv = iv;
        const s = simbolKini().key;
        kunci.filter(k => k !== s).reduce((p, k) => p.then(() => tambahBanding(k)), Promise.resolve());
    }

    // ── Replay: putar ulang candle dari titik yang dipilih (data asli, tanpa candle masa depan) ──
    function mulaiReplay() {
        const chart = g('_lwChart'), seri = g('_lwSeries'), data = (g('_lwLastCandles') || []).slice();
        if (!chart || !seri || data.length < 30) { toast('Data chart belum cukup untuk replay.', 'error'); return; }
        toast('Klik candle di chart sebagai titik mulai replay (Esc untuk batal).', 'info');
        document.querySelector('[data-ch="replay"]')?.classList.add('open');
        const pilih = param => {
            chart.unsubscribeClick(pilih);
            document.removeEventListener('keydown', batal);
            if (!param || param.time == null) { document.querySelector('[data-ch="replay"]')?.classList.remove('open'); return; }
            let idx = data.findIndex(c => c.time >= param.time);
            if (idx < 0) idx = data.length - 1;
            idx = Math.max(20, Math.min(idx, data.length - 2));
            aktifkanReplay(chart, seri, data, idx);
        };
        const batal = e => { if (e.key === 'Escape') { chart.unsubscribeClick(pilih); document.removeEventListener('keydown', batal); document.querySelector('[data-ch="replay"]')?.classList.remove('open'); } };
        chart.subscribeClick(pilih);
        document.addEventListener('keydown', batal);
    }
    function aktifkanReplay(chart, seri, data, idx) {
        const rsi = g('_lwRsi');
        const asli = { update: seri.update, setData: seri.setData, rsiSet: rsi ? rsi.setData : null, ind: window.drawAutoIndicators, vol: window.perbaruiVolume };
        // Selama replay, semua pembaruan yang membawa data penuh (tick live, muat ulang
        // berkala, indikator, volume, RSI) ditahan supaya candle "masa depan" tidak bocor.
        const kosong = function () {};
        seri.update = kosong; seri.setData = kosong;
        if (rsi) rsi.setData = kosong;
        window.drawAutoIndicators = kosong;
        window.perbaruiVolume = kosong;
        const tampil = n => {
            const potong = data.slice(0, n + 1);
            asli.setData.call(seri, potong);
            try { if (rsi && asli.rsiSet && typeof window._calcRSI === 'function') asli.rsiSet.call(rsi, window._calcRSI(potong, 14)); } catch (e) {}
            try { if (typeof asli.vol === 'function') asli.vol(potong); } catch (e) {}
            // Garis pembanding juga dipotong di titik replay (tanpa data masa depan).
            ch.banding.forEach(x => { try { x.seri.setData(x.data.filter(p => p.time <= data[n].time)); } catch (e) {} });
            const info = $('qchReplayInfo'); if (info) info.textContent = new Date(data[n].time * 1000).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) + ' · ' + (n + 1) + '/' + data.length;
        };
        try { if (typeof window.clearIndicators === 'function') window.clearIndicators(); } catch (e) {}
        ch.replay = { chart, seri, data, idx, asli, main: null, laju: 1 };
        const bar = document.createElement('div');
        bar.className = 'qch-replay';
        bar.innerHTML = '<b>REPLAY</b><button type="button" data-rp="mundur" title="Mundur 1 bar">⏮</button><button type="button" data-rp="main" title="Putar / jeda">▶</button>'
            + '<button type="button" data-rp="maju" title="Maju 1 bar">⏭</button><select data-rp="laju" aria-label="Kecepatan"><option value="1">1x</option><option value="2">2x</option><option value="5">5x</option><option value="10">10x</option></select>'
            + '<span id="qchReplayInfo"></span><button type="button" data-rp="stop" class="stop">✕ Selesai</button>';
        const wadah = $('tv_chart_container') && $('tv_chart_container').parentElement;
        (wadah || document.body).appendChild(bar);
        ch.replay.bar = bar;
        const langkah = d => { const r = ch.replay; if (!r) return; r.idx = Math.max(1, Math.min(r.data.length - 1, r.idx + d)); tampil(r.idx); if (r.idx >= r.data.length - 1) jeda(); };
        const jeda = () => { const r = ch.replay; if (!r) return; clearInterval(r.main); r.main = null; bar.querySelector('[data-rp="main"]').textContent = '▶'; };
        bar.addEventListener('click', e => {
            const t = e.target.closest('[data-rp]'); if (!t) return;
            const r = ch.replay; if (!r) return;
            if (t.dataset.rp === 'maju') langkah(1);
            if (t.dataset.rp === 'mundur') langkah(-1);
            if (t.dataset.rp === 'stop') hentikanReplay();
            if (t.dataset.rp === 'main') {
                if (r.main) return jeda();
                t.textContent = '⏸';
                r.main = setInterval(() => langkah(1), 1000 / r.laju);
            }
        });
        bar.querySelector('select').addEventListener('change', e => { const r = ch.replay; r.laju = Number(e.target.value) || 1; if (r.main) { clearInterval(r.main); r.main = setInterval(() => langkah(1), 1000 / r.laju); } });
        tampil(idx);
    }
    function hentikanReplay() {
        const r = ch.replay;
        document.querySelector('[data-ch="replay"]')?.classList.remove('open');
        if (!r) return;
        clearInterval(r.main);
        r.seri.update = r.asli.update;
        r.seri.setData = r.asli.setData;
        const rsi = g('_lwRsi'); if (rsi && r.asli.rsiSet) rsi.setData = r.asli.rsiSet;
        window.drawAutoIndicators = r.asli.ind;
        window.perbaruiVolume = r.asli.vol;
        r.bar.remove();
        ch.replay = null;
        ch.banding.forEach(x => { try { x.seri.setData(x.data); } catch (e) {} });
        // Muat ulang data penuh + indikator dari server.
        if (typeof window.lwFetchAndSetData === 'function') window.lwFetchAndSetData();
    }
    function jagaReplay() {
        const r = ch.replay;
        if (r && (g('_lwSeries') !== r.seri || state.page === '')) hentikanReplay();
        document.querySelector('[data-ch="replay"]')?.classList.toggle('active', !!ch.replay);
    }

    // ── Legenda indikator di sudut kiri atas chart ──
    function pasangLegenda() {
        const kont = $('tv_chart_container');
        const wadah = kont && kont.parentElement;
        if (!wadah || $('qchLegend')) return;
        wadah.style.position = 'relative';
        const l = document.createElement('div');
        l.id = 'qchLegend';
        l.className = 'qch-legend';
        l.innerHTML = '<div id="qchLegendRows"></div>';
        wadah.appendChild(l);
        const ohlc = $('chartOhlcBar');
        if (ohlc) { ohlc.classList.add('qch-ohlc'); l.insertBefore(ohlc, l.firstChild); }
    }
    const nilaiAkhir = s => { try { const d = s && s.data(); const x = d && d[d.length - 1]; return x && Number.isFinite(x.value) ? x.value : null; } catch (e) { return null; } };
    function perbaruiLegenda() {
        const w = $('qchLegendRows'); if (!w) return;
        const key = ch.kunci;
        const baris = [];
        [['EMA 20', '_lwEma20', '#F59E0B'], ['EMA 50', '_lwEma50', '#facc15'], ['EMA 200', '_lwEma200', '#60a5fa']].forEach(([n, v, c]) => {
            const x = nilaiAkhir(g(v)); if (x != null) baris.push('<div><span>' + n + '</span><b style="color:' + c + '">' + hargaTeks(x, key) + '</b></div>');
        });
        const up = nilaiAkhir(g('_lwBbUpper')), mid = nilaiAkhir(g('_lwBbMiddle')), lo = nilaiAkhir(g('_lwBbLower'));
        if (up != null && mid != null && lo != null) baris.push('<div><span>BB 20 2</span><b>' + hargaTeks(mid, key) + '</b></div><div><span></span><b>' + hargaTeks(up, key) + '</b></div><div><span></span><b>' + hargaTeks(lo, key) + '</b></div>');
        ch.banding.forEach(x => { const v = nilaiAkhir(x.seri); if (v != null) baris.push('<div><span style="color:' + x.warna + '">' + esc(x.key) + '</span><b style="color:' + x.warna + '">' + (v >= 0 ? '+' : '') + v.toFixed(2) + '%</b></div>'); });
        if (ch.replay) baris.unshift('<div class="qch-leg-replay">Mode replay — indikator disembunyikan</div>');
        const html = baris.join('');
        if (w.innerHTML !== html) w.innerHTML = html;
    }

    // ═════════════════════════════════════════════════════════════════════════
    // KOLOM KIRI: kartu News & Broker Connect mengikuti desain
    // (isi tetap dari qim-dashboard.js; di sini hanya ikon bulat, waktu, logo broker)
    // ═════════════════════════════════════════════════════════════════════════
    const LOGO_BROKER = {
        mt5: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l8.2 4.75v9.5L12 21.5l-8.2-4.75v-9.5z" fill="none" stroke="#3b82f6" stroke-width="1.8"/><rect x="8.5" y="8.5" width="7" height="7" rx="1.2" fill="none" stroke="#60a5fa" stroke-width="1.6"/></svg>',
        oanda: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6l6 12 3-6" fill="none" stroke="#22c55e" stroke-width="2.4" stroke-linejoin="round"/><path d="M12 12l3 6 6-12" fill="none" stroke="#facc15" stroke-width="2.4" stroke-linejoin="round"/></svg>',
        alpaca: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3l1.6 3h4.8L16 3l.6 4.5c1.5 1.3 2.4 3.2 2.4 5.5 0 4.4-3.1 8-7 8s-7-3.6-7-8c0-2.3.9-4.2 2.4-5.5z" fill="#f5c443"/><circle cx="10" cy="11.5" r="1.1" fill="#3b2a00"/><circle cx="14" cy="11.5" r="1.1" fill="#3b2a00"/><ellipse cx="12" cy="15.5" rx="2.6" ry="1.8" fill="#fde68a"/></svg>'
    };
    function rapikanKolomKiri() {
        document.querySelectorAll('.qim-broker-row').forEach(row => {
            const st = row.querySelector('[data-broker]');
            const ik = row.querySelector('.qim-broker-icon');
            const k = st && st.dataset.broker;
            if (ik && LOGO_BROKER[k] && !ik.dataset.qim) { ik.innerHTML = LOGO_BROKER[k]; ik.dataset.qim = '1'; ik.classList.add('qim-broker-logo'); }
        });
        const berita = $('qimNewsRows');
        if (!berita || berita.dataset.qimAmati) return;
        berita.dataset.qimAmati = '1';
        // Tiap item dirapikan SEKALI (penanda data-qim). Tanpa penanda, pemindahan elemen di
        // bawah memicu observer lagi dan berputar tanpa henti.
        const rapikan = () => {
            berita.querySelectorAll('.qim-news-item:not([data-qim])').forEach(it => {
                it.dataset.qim = '1';
                const th = it.querySelector('.qim-news-thumb');
                if (th && !th.dataset.qim) {
                    const t = th.textContent.trim();
                    th.dataset.qim = '1';
                    th.classList.add(t === 'Au' ? 'is-gold' : t === '◎' ? 'is-macro' : 'is-crypto');
                    th.innerHTML = t === 'Au' ? 'Au' : t === '◎' ? '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="#e2e8f0" stroke-width="1.6"/><circle cx="12" cy="12" r="4.5" fill="none" stroke="#e2e8f0" stroke-width="1.2"/><path d="M12 7.5v9M7.5 12h9" stroke="#e2e8f0" stroke-width="1"/></svg>' : '₿';
                }
                // "46m lalu" / "3j lalu" → "46m ago" / "3h ago" (mengikuti desain)
                const meta = it.querySelector('.qim-news-meta');
                const waktu = meta && meta.firstElementChild;
                if (waktu && / lalu$/.test(waktu.textContent)) waktu.textContent = waktu.textContent.replace(/(\d+)j lalu$/, '$1h ago').replace(/(\d+)m lalu$/, '$1m ago');
                if (meta && waktu && meta.lastElementChild !== waktu) meta.appendChild(waktu);   // lencana di atas, waktu di bawahnya
            });
        };
        rapikan();
        new MutationObserver(rapikan).observe(berita, { childList: true, subtree: true });
    }

    // ═════════════════════════════════════════════════════════════════════════
    // BANNER BLACKOUT BERITA (api/blackout-berita.php) — aturan sama dengan mesin sinyal
    // ═════════════════════════════════════════════════════════════════════════
    const bo = { data: null, diterima: 0 };
    function bangunBlackout() {
        if ($('qimBlackout')) return;
        const scroll = $('mainScroll');
        if (!scroll) return;
        const el = document.createElement('div');
        el.id = 'qimBlackout';
        el.className = 'qbo';
        el.hidden = true;
        el.setAttribute('role', 'status');
        scroll.parentElement.insertBefore(el, scroll);
        el.addEventListener('click', e => {
            if (e.target.closest('[data-bo="tutup"]')) { try { sessionStorage.setItem('qim_bo_tutup', el.dataset.kunci || ''); } catch (er) {} el.hidden = true; }
            if (e.target.closest('[data-bo="kalender"]')) window.switchPanel && window.switchPanel('panel-heatmap');
        });
        muatBlackout();
        setInterval(() => { if (document.visibilityState === 'visible') muatBlackout(); }, 60000);
        setInterval(() => renderBlackout(bo.data), 20000);
    }
    async function muatBlackout() {
        try {
            const r = await fetch('api/blackout-berita.php', { cache: 'no-store' });
            const d = await r.json();
            if (r.ok && d.status === 'success') { bo.data = d; bo.diterima = Date.now(); renderBlackout(d); }
        } catch (e) { /* biarkan tampilan terakhir */ }
    }
    function renderBlackout(d) {
        const el = $('qimBlackout');
        if (!el || !d) return;
        const kini = (d.sekarang || Date.now() / 1000) + (Date.now() - (bo.diterima || Date.now())) / 1000;
        const jam = t => new Date(t * 1000).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        let kelas = '', isi = '', kunci = '';
        const b = d.blackout || {};
        if (b.aktif && b.event) {
            kelas = 'aktif'; kunci = 'a|' + b.event.judul + '|' + b.event.waktu;
            isi = '<b>⛔ Blackout berita</b> · ' + esc(b.event.judul) + ' (' + esc(b.event.mata_uang) + ') ' + esc(b.event.arah) + ' ' + b.event.menit
                + ' menit. Sinyal baru ditahan ±' + d.jendela + ' menit; hindari entry baru — spread & slippage bisa melebar.';
        } else {
            const ev = (d.mendatang || []).find(x => x.epoch - kini > 0 && x.epoch - kini <= 3600);
            if (ev) {
                const m = Math.max(1, Math.round((ev.epoch - kini) / 60));
                kelas = 'segera'; kunci = 's|' + ev.judul + '|' + ev.epoch;
                const lain = (d.mendatang || []).filter(x => x.epoch === ev.epoch && x !== ev).length;
                isi = '<b>⚠ Berita berdampak tinggi dalam ' + m + ' menit</b> · ' + esc(ev.judul) + (lain ? ' +' + lain + ' lainnya' : '') + ' (' + esc(ev.mata_uang) + ') pukul ' + jam(ev.epoch)
                    + (ev.perkiraan ? ' · perkiraan ' + esc(ev.perkiraan) : '') + '. Sinyal baru akan ditahan mulai ' + jam(ev.epoch - d.jendela * 60) + '.';
            }
        }
        document.body.classList.toggle('qim-blackout', kelas === 'aktif');
        let tutup = '';
        try { tutup = sessionStorage.getItem('qim_bo_tutup') || ''; } catch (e) {}
        if (!kelas || tutup === kunci) { el.hidden = true; return; }
        el.className = 'qbo ' + kelas;
        el.dataset.kunci = kunci;
        el.innerHTML = '<span class="qbo-text">' + isi + '</span><button type="button" class="qbo-link" data-bo="kalender">Kalender</button><button type="button" class="qbo-x" data-bo="tutup" aria-label="Tutup peringatan">✕</button>';
        el.hidden = false;
    }

    // ═════════════════════════════════════════════════════════════════════════
    // TRACK RECORD TERPERINCI (api/track-record.php) — di atas panel Track Record
    // ═════════════════════════════════════════════════════════════════════════
    const tr = { hari: 0, dim: 'mesin', data: null };
    const fmtR = v => v == null ? '—' : (v > 0 ? '+' : '') + Number(v).toFixed(2) + 'R';
    function siapkanTrack() {
        const panel = $('panel-track');
        if (!panel) return;
        if (!$('qtrCard')) {
            const c = document.createElement('section');
            c.id = 'qtrCard';
            c.className = 'qim-card2 qtr';
            c.innerHTML = '<div class="qtr-head"><div><h3>Track Record per Mesin, Pair &amp; Timeframe</h3><p class="qim-muted">Diukur dalam R (kelipatan risiko awal) supaya instrumen berbeda bisa dibandingkan. Hanya sinyal yang sudah kena TP/SL yang dihitung. Ringkasan lama di bawah memakai dolar per 1 lot, sehingga didominasi instrumen berharga besar (mis. BTC) — angkanya bisa berbeda dari ukuran R ini.</p></div>'
                + '<div class="qtr-chips" role="tablist">' + [[7, '7 hari'], [30, '30 hari'], [90, '90 hari'], [0, 'Semua']].map(([h, l]) => '<button type="button" class="qcomp-tab" data-hari="' + h + '">' + l + '</button>').join('') + '</div></div>'
                + '<div id="qtrBody"><div class="qcomp-empty">Memuat…</div></div>';
            panel.insertBefore(c, panel.firstChild);
            c.addEventListener('click', e => {
                const h = e.target.closest('[data-hari]'); if (h) { tr.hari = Number(h.dataset.hari); muatTrack(); return; }
                const d = e.target.closest('[data-dim]'); if (d) { tr.dim = d.dataset.dim; renderTrack(); }
            });
        }
        muatTrack();
    }
    async function muatTrack() {
        document.querySelectorAll('#qtrCard [data-hari]').forEach(b => b.classList.toggle('active', Number(b.dataset.hari) === tr.hari));
        try {
            const r = await fetch('api/track-record.php?hari=' + tr.hari, { cache: 'no-store' });
            const d = await r.json();
            if (!r.ok || d.status !== 'success') throw new Error(d.message || 'HTTP ' + r.status);
            tr.data = d;
            renderTrack();
        } catch (e) { const b = $('qtrBody'); if (b) b.innerHTML = '<div class="qcomp-empty">Track record tidak dapat dimuat.</div>'; }
    }
    function renderTrack() {
        const d = tr.data, b = $('qtrBody');
        if (!d || !b) return;
        const s = d.semua;
        const ci = s.wilson95 ? s.wilson95[0] + '–' + s.wilson95[1] + '%' : '—';
        const peringatan = s.selesai === 0
            ? '<div class="qtr-warn">Belum ada sinyal yang selesai pada periode ini.</div>'
            : (s.sampel_kecil ? '<div class="qtr-warn">⚠ Baru <b>' + s.selesai + '</b> sinyal selesai — butuh minimal ' + d.sampel_min + ' agar angka ini bermakna. Dengan sampel ini, win rate sebenarnya bisa berada di <b>' + ci + '</b>.</div>' : '');
        const ubin = [['Selesai', s.selesai + ' <small>/ ' + s.total + ' sinyal</small>'], ['Win rate', (s.win_rate ?? '—') + (s.win_rate != null ? '%' : '') + ' <small>95%: ' + ci + '</small>'],
            ['Expectancy', fmtR(s.expectancy) + ' <small>per sinyal</small>'], ['Profit factor', s.pf ?? '—'], ['Max drawdown', s.max_dd_r ? '-' + s.max_dd_r + 'R' : '0R'],
            ['Expired / aktif', s.expired + ' / ' + s.aktif]];
        const grup = d[tr.dim] || [];
        b.innerHTML = peringatan
            + '<div class="qtr-tiles">' + ubin.map(([k, v]) => '<div><span>' + k + '</span><b>' + v + '</b></div>').join('') + '</div>'
            + '<div class="qtr-tabs">' + [['mesin', 'Per mesin'], ['pair', 'Per pair'], ['tf', 'Per timeframe']].map(([k, l]) => '<button type="button" class="qcomp-tab' + (tr.dim === k ? ' active' : '') + '" data-dim="' + k + '">' + l + '</button>').join('') + '</div>'
            + (grup.length ? '<div class="qtr-scroll"><table class="qcomp-table qtr-table"><thead><tr><th>' + ({ mesin: 'Mesin', pair: 'Pair', tf: 'Timeframe' })[tr.dim] + '</th><th>Selesai</th><th>Win rate (95%)</th><th>Expectancy</th><th>PF</th><th>Max DD</th><th>12 terakhir</th></tr></thead><tbody>'
                + grup.map(x => '<tr><td>' + esc(x.nama) + (x.sampel_kecil ? ' <span class="qtr-badge" title="Kurang dari ' + d.sampel_min + ' sinyal selesai">sampel kecil</span>' : '') + '</td>'
                    + '<td class="num">' + x.selesai + '<small> / ' + x.total + '</small></td>'
                    + '<td><div class="qtr-ci"><b>' + (x.win_rate ?? '—') + (x.win_rate != null ? '%' : '') + '</b>' + (x.wilson95 ? '<span class="qtr-cibar" title="Interval kepercayaan 95%: ' + x.wilson95[0] + '–' + x.wilson95[1] + '%"><i style="left:' + x.wilson95[0] + '%;width:' + (x.wilson95[1] - x.wilson95[0]) + '%"></i><em style="left:' + (x.win_rate || 0) + '%"></em></span>' : '') + '</div></td>'
                    + '<td class="num ' + (x.expectancy > 0 ? 'qim-up' : x.expectancy < 0 ? 'qim-down' : '') + '">' + fmtR(x.expectancy) + '</td>'
                    + '<td class="num">' + (x.pf ?? '—') + '</td><td class="num">' + (x.max_dd_r ? '-' + x.max_dd_r + 'R' : '0R') + '</td>'
                    + '<td><span class="qtr-jejak">' + (x.jejak || '—').split('').map(c => c === 'W' ? '<i class="w"></i>' : c === 'L' ? '<i class="l"></i>' : c).join('') + '</span></td></tr>').join('')
                + '</tbody></table></div>' : '<div class="qcomp-empty">Tidak ada data.</div>');
    }

    // ═════════════════════════════════════════════════════════════════════════
    // "KENAPA SINYAL INI?" — alasan dari rekor sinyal (api/sinyal-alasan.php)
    // ═════════════════════════════════════════════════════════════════════════
    function htmlAlasan(s) {
        const a = s.alasan || {};
        const bagian = [];
        const kepala = '<div class="qwhy-head"><b class="' + (s.arah === 'BUY' ? 'qim-up' : 'qim-down') + '">' + esc(s.arah) + '</b> ' + esc(s.symbol)
            + '<small>' + esc(s.mesin) + ' · ' + esc(s.waktu) + ' · ' + esc(s.status || '') + '</small></div>';
        if (a.mesin) {
            const h = a.mesin.hitung || {};
            bagian.push('<div class="qwhy-sec"><span>Mesin searah</span><b>' + a.mesin.searah + (a.mesin.tersedia ? ' dari ' + a.mesin.tersedia : '') + '</b>'
                + (a.mesin.setuju && a.mesin.setuju.length ? '<div class="qwhy-chips">' + a.mesin.setuju.map(m => '<i>' + esc(m) + '</i>').join('') + '</div>' : '')
                + (h.BUY != null ? '<small>BUY ' + h.BUY + ' · SELL ' + (h.SELL || 0) + ' · netral ' + (h.NETRAL || 0) + '</small>' : '') + '</div>');
        }
        if (a.ai) {
            const k = Number(a.ai.keyakinan);
            bagian.push('<div class="qwhy-sec"><span>Verdict AI</span><b class="' + (a.ai.aksi === 'BUY' ? 'qim-up' : a.ai.aksi === 'SELL' ? 'qim-down' : '') + '">' + esc(a.ai.aksi)
                + (Number.isFinite(k) ? ' · ' + k + '%' : '') + (a.ai.setuju === false ? ' <em>(tidak sepakat dengan sinyal)</em>' : '') + '</b>'
                + (Number.isFinite(k) ? '<div class="qwhy-bar"><i style="width:' + Math.max(0, Math.min(100, k)) + '%"></i></div>' : '')
                + (a.ai.alasan ? '<p>' + esc(a.ai.alasan) + '</p>' : '') + (a.ai.risiko ? '<p class="warn">Risiko: ' + esc(a.ai.risiko) + '</p>' : '') + '</div>');
        }
        if (a.metode) bagian.push('<div class="qwhy-sec"><span>Metode</span><p>' + esc(a.metode) + '</p></div>');
        if (a.konfluensi != null || a.mtf != null) bagian.push('<div class="qwhy-sec"><span>Konfluensi</span><b>' + (a.konfluensi != null ? a.konfluensi + '/100' : '—') + '</b>'
            + (a.mtf != null ? '<small>' + (a.mtf ? '✓ multi-timeframe selaras' : '✗ multi-timeframe belum selaras') + '</small>' : '') + '</div>');
        if (a.berita) bagian.push('<div class="qwhy-sec"><span>Berita</span><p>' + esc(a.berita) + '</p></div>');
        if (a.invalidasi) bagian.push('<div class="qwhy-sec"><span>Batal bila</span><p>' + esc(a.invalidasi) + '</p></div>');
        return kepala + (bagian.length ? bagian.join('') : '<p class="qim-muted">Rekor sinyal ini tidak menyimpan rincian alasan.</p>')
            + '<p class="qim-note" style="margin:8px 0 0">Diringkas dari data yang tersimpan saat sinyal terbit — bukan jaminan hasil.</p>';
    }
    async function bukaAlasan(tombol, sym) {
        const p = bukaPopover(tombol, '<div class="qch-pop-title">Kenapa sinyal ini?</div><div class="qwhy">Memuat…</div>', 340);
        if (!p) return;
        try {
            const r = await fetch('api/sinyal-alasan.php?symbol=' + encodeURIComponent(sym), { cache: 'no-store' });
            const d = await r.json();
            const w = p.querySelector('.qwhy'); if (!w) return;
            w.innerHTML = (r.ok && d.sinyal) ? htmlAlasan(d.sinyal) : '<p class="qim-muted">' + esc(d.message || 'Belum ada sinyal tersimpan untuk ' + sym + '.') + '</p>';
        } catch (e) { const w = p.querySelector('.qwhy'); if (w) w.textContent = 'Gagal memuat alasan.'; }
    }

    // ═════════════════════════════════════════════════════════════════════════
    // BILAH STATUS BAWAH: event sinyal terakhir + hitung mundur lilin + suara
    // ═════════════════════════════════════════════════════════════════════════
    const sb = { sinyal: null, kunci: '', teks: '', diucap: '', suara: false, memuat: false };
    const DURASI_TF = { '1': 60, '5': 300, '15': 900, '30': 1800, '60': 3600, '240': 14400, D: 86400 };
    function bangunStatusBar() {
        if ($('qimStatusBar')) return;
        sb.suara = baca('qim_suara') === '1';
        const el = document.createElement('footer');
        el.id = 'qimStatusBar';
        el.className = 'qim-statusbar';
        el.innerHTML = '<span class="qsb-dot" id="qsbDot"></span><span class="qsb-event" id="qsbEvent" role="status" aria-live="polite">Memuat status sinyal…</span>'
            + '<span class="qsb-spacer"></span><span class="qsb-candle" id="qsbCandle"></span>'
            + '<button type="button" class="qsb-read" id="qsbRead" title="Bacakan status sinyal">Baca ulang</button><span class="qsb-sep"></span>'
            + '<button type="button" class="qsb-speaker" id="qsbSpeaker" aria-pressed="false"></button>';
        document.body.appendChild(el);
        document.body.classList.add('qim-has-statusbar');
        $('qsbRead').addEventListener('click', () => ucapkan(true));
        const ev = $('qsbEvent');
        ev.dataset.ch = 'why-status';
        ev.title = 'Kenapa sinyal ini?';
        ev.addEventListener('click', () => { if (sb.sinyal && sb.kunci) bukaAlasan(ev, sb.kunci); });
        $('qsbSpeaker').addEventListener('click', () => {
            sb.suara = !sb.suara;
            simpan('qim_suara', sb.suara ? '1' : '0');
            tandaiSpeaker();
            if (sb.suara) ucapkan(true);
            else if ('speechSynthesis' in window) window.speechSynthesis.cancel();
        });
        tandaiSpeaker();
        setInterval(tikLilin, 1000);
        setInterval(() => { if (document.visibilityState === 'visible') muatStatusSinyal(); }, 60000);
        setInterval(() => { if (simbolKini().key !== sb.kunci) muatStatusSinyal(); else perbaruiStatusTeks(); }, 3000);
        tikLilin();
        muatStatusSinyal();
    }
    function tandaiSpeaker() {
        const b = $('qsbSpeaker'); if (!b) return;
        const ada = 'speechSynthesis' in window;
        b.disabled = !ada;
        b.setAttribute('aria-pressed', String(sb.suara));
        b.title = !ada ? 'Peramban ini tidak mendukung suara' : (sb.suara ? 'Suara aktif — status baru dibacakan otomatis (klik untuk mematikan)' : 'Suara mati (klik untuk membacakan status otomatis)');
        b.setAttribute('aria-label', b.title);
        b.innerHTML = ikon(sb.suara
            ? '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>'
            : '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9l5 6M22 9l-5 6"/>');
        b.classList.toggle('on', sb.suara);
    }
    async function muatStatusSinyal() {
        const s = simbolKini();
        if (!s.key || sb.memuat) return;
        sb.memuat = true;
        try {
            const r = await fetch('api/status-sinyal.php?symbol=' + encodeURIComponent(s.key), { cache: 'no-store' });
            const d = await r.json();
            if (r.ok && d.status === 'success') {
                if (sb.kunci !== s.key) sb.sejak = Date.now();   // simbol baru: jangan bacakan perubahan saat data masih dimuat
                sb.kunci = s.key; sb.sinyal = d.sinyal; perbaruiStatusTeks();
            }
        } catch (e) { /* biarkan status terakhir */ } finally { sb.memuat = false; }
    }
    /** Status yang JUJUR: dari status rekor server + candle chart dalam jendela terbit→kedaluwarsa. */
    function hitungStatus() {
        const key = sb.kunci, x = sb.sinyal;
        if (!x) return { kelas: 'none', teks: 'Belum ada sinyal untuk ' + key, arah: '' };
        const st = String(x.status || '').toUpperCase();
        if (st.includes('TP')) return { kelas: 'ok', teks: 'TP tercapai', arah: x.arah };
        if (st.includes('SL')) return { kelas: 'bad', teks: 'SL tersentuh', arah: x.arah };
        const kini = Date.now() / 1000;
        if (x.kedaluwarsa && kini > x.kedaluwarsa) return { kelas: 'none', teks: 'Sinyal kedaluwarsa', arah: x.arah };
        if (!st.includes('AKTIF')) return { kelas: 'none', teks: 'Status: ' + (x.status || '—'), arah: x.arah };
        const candle = simbolKini().key === key ? (g('_lwLastCandles') || []) : [];
        if (candle.length && Number.isFinite(x.entry)) {
            const kena = candle.some(c => c.time > x.terbit && c.time <= x.kedaluwarsa && c.low <= x.entry && c.high >= x.entry);
            return kena ? { kelas: 'ok', teks: 'Entry tersentuh', arah: x.arah }
                        : { kelas: 'wait', teks: 'Menunggu entry ' + hargaTeks(x.entry, key), arah: x.arah };
        }
        return { kelas: 'wait', teks: 'Sinyal aktif', arah: x.arah };
    }
    function perbaruiStatusTeks() {
        const h = hitungStatus();
        const ev = $('qsbEvent'), dot = $('qsbDot');
        if (!ev) return;
        const html = esc(h.teks) + (h.arah ? ' <i>•</i> <b class="' + (h.arah === 'BUY' ? 'qim-up' : 'qim-down') + '">' + esc(h.arah) + '</b>' : '');
        if (ev.innerHTML !== html) ev.innerHTML = html;
        dot.className = 'qsb-dot ' + h.kelas;
        const ucap = sb.kunci + ', ' + h.teks + (h.arah ? ', ' + h.arah : '');
        if (ucap !== sb.teks) {
            const pertama = !sb.teks;
            sb.teks = ucap;
            if (!pertama && sb.suara && Date.now() - (sb.sejak || 0) > 8000) ucapkan(false);   // hanya saat status BERUBAH
        }
    }
    function ucapkan(paksa) {
        if (!('speechSynthesis' in window) || !sb.teks) return;
        if (!paksa && sb.diucap === sb.teks) return;
        sb.diucap = sb.teks;
        try {
            window.speechSynthesis.cancel();
            const u = new SpeechSynthesisUtterance(sb.teks.replace(/USDT/g, ' U S D T').replace(/•/g, ','));
            u.lang = 'id-ID';
            u.rate = 1;
            window.speechSynthesis.speak(u);
        } catch (e) {}
    }
    function tikLilin() {
        const el = $('qsbCandle'); if (!el) return;
        const iv = String(g('_tvInterval') || '60');
        const kini = Math.floor(Date.now() / 1000);
        let tutupBerikut, tutupLalu;
        if (DURASI_TF[iv]) {
            const d = DURASI_TF[iv];
            tutupBerikut = Math.ceil((kini + 1) / d) * d;
            tutupLalu = tutupBerikut - d;
        } else if (iv === 'W') {
            const t = new Date(kini * 1000);
            const senin = Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate() - ((t.getUTCDay() + 6) % 7)) / 1000;
            tutupLalu = senin; tutupBerikut = senin + 7 * 86400;
        } else {
            const t = new Date(kini * 1000);
            tutupLalu = Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 1) / 1000;
            tutupBerikut = Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 1) / 1000;
        }
        const sisa = tutupBerikut - kini;
        const jj = Math.floor(sisa / 3600), mm = Math.floor(sisa % 3600 / 60), dd = sisa % 60;
        const p2 = n => String(n).padStart(2, '0');
        const hitung = sisa >= 86400 ? Math.floor(sisa / 86400) + 'h ' + p2(jj % 24) + ':' + p2(mm) : (jj ? jj + ':' + p2(mm) + ':' + p2(dd) : p2(mm) + ':' + p2(dd));
        const lalu = new Date(tutupLalu * 1000).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        el.innerHTML = 'lilin tutup ' + lalu + ' <i>•</i> berikutnya tutup dalam ' + hitung + ' <i>•</i>';
        el.title = 'Timeframe chart ' + (TF_LABEL[iv] || iv) + ' — waktu lilin mengikuti batas UTC bursa, ditampilkan dalam jam lokal Anda.';
    }

    // ═════════════════════════════════════════════════════════════════════════
    // MULAI
    // ═════════════════════════════════════════════════════════════════════════
    function mulai() {
        const tt = $('tickerTrack');
        const bar = tt && tt.parentElement && tt.parentElement.closest('.h-8');
        if (bar) bar.classList.add('qim-old-ticker');
        bangunRail();
        ikatTopNav();
        kartuPengguna();
        rapikanKolomKiri();
        setTimeout(rapikanKolomKiri, 3000);
        bangunStatusBar();
        bangunBlackout();
        bangunTicker();
        bangunPanelKompetisi();
        document.addEventListener('qim:panel-change', () => terapkan());
        // ?halaman=drawing|competition|… membuka halaman langsung (mis. dari tautan).
        const awal = new URLSearchParams(location.search).get('halaman');
        // Ditunda: dashboard memulihkan panel terakhir sendiri saat dimuat, jangan sampai menimpa ini.
        terapkan();
        if (awal && HALAMAN.some(h => h.kunci === awal)) setTimeout(() => buka(awal), 1500);
    }

    window.QimPages = { buka, terapkan, muatKompetisi, muatNews, renderBlackout };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mulai); else mulai();
})();
