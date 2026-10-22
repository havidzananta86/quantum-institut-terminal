// Skrip halaman beranda (index.html) — dulu <script> inline, dipindah agar lolos CSP tanpa 'unsafe-inline'.
// Urutan blok sama dengan urutan aslinya di halaman.
(function(){
    var grid = document.getElementById('tradeIdeasGrid');
    if (!grid) return;
    function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function(c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
    function sym(s) { s = String(s || ''); if (/USDT$/.test(s)) return s.replace(/USDT$/, '/USDT'); return s.replace(/([A-Z]{3})([A-Z]{3})/, '$1/$2'); }
    // Waktu sinyal dalam ms. Utamakan timestamp_epoch dari server (qi_sig_epoch, tanpa ambigu
    // zona): rekor lama menulis 'Y-m-d H:i:s' TANPA zona, yang dibaca Chrome sebagai jam lokal
    // peramban (umur meleset sampai 7 jam di WIB) dan oleh Safari sebagai NaN — pembanding
    // sort yang mengembalikan NaN membuat urutannya acak (audit sinyal 2026-10-22).
    // String hanya cadangan untuk server lama; yang tak terbaca = 0 (paling bawah, tanpa umur).
    function waktuMs(x) {
        var e = Number(x && x.timestamp_epoch);
        if (isFinite(e) && e > 0) return e * 1000;
        var t = Date.parse(String((x && x.timestamp) || '').replace(' ', 'T'));
        return isNaN(t) ? 0 : t;
    }
    function lalu(x) {
        var t = waktuMs(x); if (!t) return '';
        var d = Math.max(0, (Date.now() - t) / 1000);
        if (d < 3600) return Math.max(1, Math.round(d / 60)) + ' menit lalu';
        if (d < 86400) return Math.round(d / 3600) + ' jam lalu';
        return Math.round(d / 86400) + ' hari lalu';
    }
    function angka(v) { var n = Number(v); if (!isFinite(n)) return '—'; return n >= 1000 ? n.toLocaleString('en-US', {maximumFractionDigits: 2}) : String(n); }
    function status(st) {
        st = String(st || '');
        if (st.indexOf('HIT TP') === 0) return { t: 'TP KENA', c: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30' };
        if (st.indexOf('HIT SL') === 0) return { t: 'SL KENA', c: 'text-rose-400 bg-rose-500/15 border-rose-500/30' };
        if (st.indexOf('EXPIRED') === 0) return { t: 'KEDALUWARSA', c: 'text-slate-300 bg-slate-500/15 border-slate-500/30' };
        if (st === 'AKTIF') return { t: 'AKTIF', c: 'text-cyan-300 bg-cyan-500/15 border-cyan-500/30' };
        return { t: esc(st || '—'), c: 'text-slate-300 bg-slate-500/15 border-slate-500/30' };
    }
    function kosong(pesan) { grid.innerHTML = '<div class="glass-card rounded-2xl border border-slate-700/40 p-6 text-center text-slate-500 text-xs font-mono sm:col-span-2 lg:col-span-3">' + esc(pesan) + '</div>'; }
    fetch('api/signal-history.php', { cache: 'no-store', signal: AbortSignal.timeout(8000) })
        .then(function(r) { return r.json(); })
        .then(function(d) {
            var h = (d && d.status === 'success' && Array.isArray(d.history)) ? d.history.slice() : [];
            h.sort(function(a, b) { return waktuMs(b) - waktuMs(a); });
            h = h.slice(0, 6);
            if (!h.length) return kosong('Belum ada sinyal tercatat.');
            grid.innerHTML = '';
            h.forEach(function(x) {
                var beli = String(x.side).toUpperCase() === 'BUY';
                var st = status(x.status);
                var warna = beli ? 'emerald' : 'rose';
                var el = document.createElement('div');
                el.className = 'glass-card rounded-2xl overflow-hidden border border-' + warna + '-500/20 hover:border-' + warna + '-500/50 transition-all cursor-pointer';
                el.onclick = function() { window.location.href = 'transparansi.html'; };
                el.innerHTML = '<div class="h-1.5 w-full bg-gradient-to-r from-' + warna + '-500 to-' + (beli ? 'cyan' : 'orange') + '-500"></div>'
                    + '<div class="p-5">'
                    + '<div class="flex items-center justify-between mb-3">'
                    + '<span class="px-2 py-0.5 text-[10px] font-mono font-bold bg-' + warna + '-500/15 text-' + warna + '-400 border border-' + warna + '-500/30 rounded">' + (beli ? '▲ BUY' : '▼ SELL') + '</span>'
                    + '<span class="text-[10px] font-mono text-slate-400">' + esc(x.timeframe || '') + ' · ' + esc(lalu(x)) + '</span></div>'
                    + '<div class="font-heading font-bold text-white text-base mb-2">' + esc(sym(x.symbol)) + '</div>'
                    + '<div class="grid grid-cols-3 gap-2 text-[11px] font-mono text-slate-400 mb-3">'
                    + '<div>Entry<br><b class="text-white">' + esc(angka(x.entry)) + '</b></div>'
                    + '<div>SL<br><b class="text-rose-300">' + esc(angka(x.sl)) + '</b></div>'
                    + '<div>TP<br><b class="text-emerald-300">' + esc(angka(x.tp)) + '</b></div></div>'
                    + '<div class="flex items-center justify-between text-[10px] font-mono border-t border-slate-800/60 pt-3">'
                    + '<span class="text-slate-500 truncate pr-2">' + esc(x.engine_name || 'Quantum') + '</span>'
                    + '<span class="px-2 py-0.5 rounded border ' + st.c + '">' + st.t + '</span></div>'
                    + '</div>';
                grid.appendChild(el);
            });
        }).catch(function() { kosong('Sinyal belum bisa dimuat saat ini. Kami tidak menampilkan contoh pengganti.'); });
})();

(function(){
    var COLORS = ['amber','emerald','cyan','purple','blue','rose'];
    function el(id) { return document.getElementById(id); }
    function set(id, t) { var e = el(id); if (e) e.textContent = t; }
    function formatSym(s) {
        if (!s) return s;
        s = String(s);
        if (/USDT$/.test(s)) return s.replace(/USDT$/, '/USDT');
        return s.replace(/([A-Z]{3})([A-Z]{3})/, '$1/$2');
    }
    function gagal() {
        set('idxSampelCatatan', 'Statistik sinyal belum bisa dimuat saat ini. Kami tidak menampilkan angka perkiraan.');
        set('idxStatWrN', 'belum bisa dimuat');
        var c = el('idxWinrateByPair'); if (c) c.innerHTML = '<div class="text-[11px] text-slate-500">Data belum tersedia.</div>';
    }
    function renderBars(pairs) {
        var c = el('idxWinrateByPair');
        if (!c) return;
        if (!pairs.length) { c.innerHTML = '<div class="text-[11px] text-slate-500">Belum ada sinyal selesai.</div>'; return; }
        c.innerHTML = '';
        pairs.forEach(function(p, i) {
            var warna = p.sampel_kecil ? 'slate' : COLORS[i % COLORS.length];
            var row = document.createElement('div');
            row.className = 'flex items-center gap-3';
            var lebar = Math.max(2, Math.min(100, Math.round(p.win_rate)));
            row.innerHTML = '<span class="w-24 text-[11px] font-mono text-slate-400 shrink-0">' + formatSym(p.simbol) + ' <span class="text-slate-600">(n=' + p.dinilai + ')</span></span>'
                + '<div class="flex-1 bg-slate-900 rounded-full h-2 overflow-hidden"><div class="h-full bg-gradient-to-r from-' + warna + '-400 to-' + warna + '-500 rounded-full" style="width:' + lebar + '%"></div></div>'
                + '<span class="w-10 text-right text-[11px] font-mono text-' + warna + '-400">' + Math.round(p.win_rate) + '%</span>';
            c.appendChild(row);
        });
    }
    fetch('api/transparansi.php', { cache: 'no-store', signal: AbortSignal.timeout(8000) })
        .then(function(r) { return r.json(); })
        .then(function(d) {
            if (!d || d.status !== 'success') return gagal();
            var st = (d.sinyal_resmi && d.sinyal_resmi.statistik) || {};
            var n = st.dinilai || 0;
            set('idxWinrate', st.win_rate == null ? '—' : st.win_rate + '%');
            set('idxTotalWins', n ? String(st.menang) : '—');
            set('idxAvgRR', st.rr_rata ? '1:' + st.rr_rata : '—');
            set('idxStatSinyal', d.sinyal_resmi.total_tercatat ? Number(d.sinyal_resmi.total_tercatat).toLocaleString('id-ID') : '—');
            set('idxStatWr', st.win_rate == null ? '—' : st.win_rate + '%');
            set('idxStatWrN', n ? ('dari ' + n + ' sinyal selesai · interval 95%: ' + st.ci_bawah + '–' + st.ci_atas + '%' + (st.cukup_sampel ? '' : ' · sampel kecil')) : 'belum ada sinyal selesai');
            var pairs = (st.per_simbol || []).filter(function(p) { return p.dinilai > 0 && p.win_rate != null; })
                .sort(function(a, b) { return b.dinilai - a.dinilai; }).slice(0, 6);
            renderBars(pairs);
            var layak = pairs.filter(function(p) { return p.dinilai >= 10; }).sort(function(a, b) { return b.win_rate - a.win_rate; })[0];
            set('idxBestPair', layak ? formatSym(layak.simbol) : '—');
            set('idxBestPairWr', layak ? layak.win_rate.toFixed(1) + '% (n=' + layak.dinilai + ')' : 'min. 10 sinyal selesai');
            // Selaras dengan metodologi di api/transparansi.php (audit sinyal 2026-10-22): dulu
            // tertulis "spread/komisi belum dikurangkan", padahal penilai versi 2/3 sudah
            // mengurangkan spread dan slippage; yang belum hanya komisi akun forex/emas.
            set('idxSampelCatatan', (st.catatan || '') + ' Hasil dalam R; sejak aturan penilaian versi 2 spread dikurangkan (versi 3: juga slippage perkiraan), komisi akun forex/emas belum. Hasil masa lalu tidak menjamin hasil di masa depan.');
        }).catch(gagal);
})();

// ── WIB LIVE CLOCK (UTC+7) ────────────────────────────────────────────────
(function tickWIB() {
    const el = document.getElementById('wibClock');
    if (!el) return;
    function update() {
        // Zona waktu eksplisit: rumus lama (+7 jam − getTimezoneOffset) menambah 14 jam bila browser sudah WIB.
        el.textContent = new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Jakarta', hour12: false });
    }
    update();
    setInterval(update, 1000);
})();

// ── LIVE SIGNAL READOUT — rotating pairs from Binance ───────────────────
const SIGNAL_PAIRS = [
    { sym:'BTCUSDT',  label:'BTC/USDT',  dec:0 },
    { sym:'ETHUSDT',  label:'ETH/USDT',  dec:2 },
    { sym:'SOLUSDT',  label:'SOL/USDT',  dec:2 },
    { sym:'BNBUSDT',  label:'BNB/USDT',  dec:2 },
    { sym:'XRPUSDT',  label:'XRP/USDT',  dec:4 },
    { sym:'DOGEUSDT', label:'DOGE/USDT', dec:5 },
];
let _sigPairIdx = 0;

// RSI(14) WILDER — rumus yang SAMA dengan panel RSI dashboard (dashboard-app.js
// qiRsiWilderSeri) dan Mesin 9 (engine-nine.js rsiWilderSeri); tests/rsi-satu-rumus.test.js
// membuktikan angkanya identik. Dulu di sini rata-rata sederhana 14 perubahan terakhir dari
// 20 kline, dan `losses === 0 → 100` juga untuk harga yang sama sekali datar (audit sinyal
// 2026-10-22). Riwayat penuh, seed SMA 14 perubahan pertama, bar ber-rentang nol dibuang,
// datar → 50, avgLoss 0 → 100; data kurang → null (bukan tebakan 50).
function _calcRSI14(data) {
    const p = 14, c = [];
    (data || []).forEach(x => {
        if (typeof x === 'number') { if (Number.isFinite(x)) c.push(x); return; }
        if (!x) return;
        const o = Number(x.open), h = Number(x.high), l = Number(x.low), cl = Number(x.close);
        if (!Number.isFinite(cl) || (o === h && h === l && l === cl)) return;
        c.push(cl);
    });
    if (c.length < p + 1) return null;
    let naik = 0, turun = 0;
    for (let i = 1; i <= p; i++) { const d = c[i] - c[i - 1]; if (d > 0) naik += d; else turun -= d; }
    naik /= p; turun /= p;
    for (let i = p + 1; i < c.length; i++) {
        const d = c[i] - c[i - 1];
        naik = (naik * (p - 1) + (d > 0 ? d : 0)) / p;
        turun = (turun * (p - 1) + (d < 0 ? -d : 0)) / p;
    }
    if (naik === 0 && turun === 0) return 50;
    if (turun === 0) return 100;
    return 100 - 100 / (1 + naik / turun);
}

async function fetchLiveSignal() {
    const pair = SIGNAL_PAIRS[_sigPairIdx];
    _sigPairIdx = (_sigPairIdx + 1) % SIGNAL_PAIRS.length;
    try {
        const [tr, kr] = await Promise.all([
            fetch(`https://data-api.binance.vision/api/v3/ticker/24hr?symbol=${pair.sym}`),
            // 200 kline H1: RSI Wilder butuh riwayat panjang supaya seed-nya tidak lagi berbobot.
            fetch(`https://data-api.binance.vision/api/v3/klines?symbol=${pair.sym}&interval=1h&limit=200`)
        ]);
        if (!tr.ok || !kr.ok) throw new Error('fetch fail');
        const ticker = await tr.json();
        const klines = await kr.json();

        const price  = parseFloat(ticker.lastPrice);
        const chgPct = parseFloat(ticker.priceChangePercent);
        // Kline lengkap (open/high/low/close) supaya bar ber-rentang nol bisa dibuang.
        const candles = (Array.isArray(klines) ? klines : []).map(k => ({ open: parseFloat(k[1]), high: parseFloat(k[2]), low: parseFloat(k[3]), close: parseFloat(k[4]) }));
        const rsi    = _calcRSI14(candles);
        if (rsi === null || !isFinite(price) || !isFinite(chgPct)) throw new Error('data kurang');

        // KEJUJURAN (telaah ulang G3b): kartu ini hanya memeriksa DUA hal — gerak 24 jam Binance
        // (> ±0,8%) dan RSI(14) H1 belum ekstrem. Dulu teksnya menyebut "Quantum Momentum" /
        // "Quantum SNR Rejection" dan "trend bullish H1" padahal tidak ada tren atau level SNR
        // yang dihitung, zona entry dikarang ±0,1% di sekitar harga, dan status WAIT tetap
        // memajang SL −0,60% / TP +1,80% / R:R 1 : 3.0 untuk keadaan yang jelas BUKAN setup.
        // Sekarang: WAIT tanpa angka level; BUY/SELL menyebut SL/TP sebagai jarak TETAP.
        const naik24 = chgPct > 0.8, turun24 = chgPct < -0.8;
        const dataCek = `gerak 24 jam ${chgPct >= 0 ? '+' : ''}${chgPct.toFixed(2)}%, RSI ${rsi.toFixed(0)} (14, H1)`;
        let statusTxt, statusClass, modeTxt, slMult = null, tpMult = null;
        if (naik24 && rsi < 65) {
            statusTxt = 'BUY SETUP'; statusClass = 'bg-emerald-400/10 text-emerald-400 border-emerald-400/40';
            modeTxt = `Cek cepat momentum: ${dataCek}. SL/TP = jarak tetap −0,75% / +2,20% dari harga terakhir, bukan level struktur — analisa 9 mesin ada di Terminal.`;
            slMult = -0.0075; tpMult = 0.022;
        } else if (turun24 && rsi > 35) {
            statusTxt = 'SELL SETUP'; statusClass = 'bg-rose-400/10 text-rose-400 border-rose-400/40';
            modeTxt = `Cek cepat momentum: ${dataCek}. SL/TP = jarak tetap +0,75% / −2,20% dari harga terakhir, bukan level struktur — analisa 9 mesin ada di Terminal.`;
            slMult = 0.0075; tpMult = -0.022;
        } else {
            // Gerak > ±0,8% tetapi RSI sudah ekstrem bukan "konsolidasi" — sebut sebab sebenarnya.
            statusTxt = (naik24 || turun24) ? 'WAIT — RSI EKSTREM' : 'WAIT — KONSOLIDASI';
            statusClass = 'bg-cyan-400/10 text-cyan-400 border-cyan-400/40';
            modeTxt = `Tidak ada setup: ${dataCek} (syarat: gerak 24 jam > ±0,8% dan RSI belum ekstrem). Level entry/SL/TP tidak ditampilkan.`;
        }

        const fmt = v => v.toLocaleString('en-US', {minimumFractionDigits: pair.dec, maximumFractionDigits: pair.dec});
        const adaLevel = slMult !== null;
        const sl  = adaLevel ? price * (1 + slMult) : null;
        const tp  = adaLevel ? price * (1 + tpMult) : null;
        const rr  = adaLevel ? (Math.abs(tpMult) / Math.abs(slMult)).toFixed(1) : null;
        // Prasyarat yang BENAR-BENAR diperiksa kartu ini hanya dua: gerak 24 jam > ±0,8% dan RSI
        // belum ekstrem (<65 untuk BUY, >35 untuk SELL). Dulu tertulis "N dari 8 Syarat" dengan
        // N = 5 + |RSI−50|/10 — angka karangan, tidak ada delapan syarat yang dihitung.
        const syaratBeli = (chgPct > 0.8 ? 1 : 0) + (rsi < 65 ? 1 : 0);
        const syaratJual = (chgPct < -0.8 ? 1 : 0) + (rsi > 35 ? 1 : 0);
        const conditions = statusTxt === 'BUY SETUP' ? syaratBeli : statusTxt === 'SELL SETUP' ? syaratJual : Math.max(syaratBeli, syaratJual);

        document.getElementById('sigPair').innerHTML = `${pair.label} <span class="text-xs px-2 py-0.5 bg-cyan-500/20 text-cyan-300 rounded">H1</span>`;
        const ss = document.getElementById('sigStatus');
        ss.textContent = statusTxt;
        ss.className = `px-2.5 py-1 text-[11px] font-bold rounded border ${statusClass}`;
        document.getElementById('sigMode').textContent = modeTxt;
        if (adaLevel) {
            // Entry = harga terakhir apa adanya (dulu rentang ±0,1% yang dikarang).
            document.getElementById('sigEntry').textContent = `$${fmt(price)} (harga terakhir)`;
            const slSign = slMult > 0 ? '+' : '';
            const tpSign = tpMult > 0 ? '+' : '';
            document.getElementById('sigSL').textContent = `$${fmt(sl)} (${slSign}${(slMult * 100).toFixed(2)}% tetap)`;
            document.getElementById('sigTP').textContent = `$${fmt(tp)} (${tpSign}${(tpMult * 100).toFixed(2)}% tetap)`;
            document.getElementById('sigRR').textContent = `1 : ${rr} (jarak tetap)`;
        } else {
            ['sigEntry', 'sigSL', 'sigTP', 'sigRR'].forEach(id => { document.getElementById(id).textContent = '—'; });
        }
        document.getElementById('sigConditions').textContent = `${conditions} dari 2 syarat`;
    } catch(e) {
        // Gagal memuat = katakan apa adanya. Dulu cabang ini menulis "SETUP TERBENTUK" —
        // status setup yang dikarang justru saat TIDAK ada data — dan membiarkan angka pair
        // sebelumnya tetap tampil di bawah label lama.
        const tulis = (id, t) => { const el = document.getElementById(id); if (el) el.textContent = t; };
        const pe = document.getElementById('sigPair');
        if (pe) pe.innerHTML = `${pair.label} <span class="text-xs px-2 py-0.5 bg-cyan-500/20 text-cyan-300 rounded">H1</span>`;
        const ss = document.getElementById('sigStatus');
        if (ss) { ss.textContent = 'DATA BELUM TERSEDIA'; ss.className = 'px-2.5 py-1 text-[11px] font-bold rounded bg-slate-400/10 text-slate-300 border border-slate-400/40'; }
        tulis('sigMode', 'Data harga Binance belum bisa dimuat — tidak ada angka yang ditampilkan. Analisa lengkap ada di Terminal.');
        ['sigEntry', 'sigSL', 'sigTP', 'sigRR', 'sigConditions'].forEach(id => tulis(id, '—'));
    }
}
fetchLiveSignal();
setInterval(fetchLiveSignal, 60000);

// (Blok "LIVE TRADE IDEAS" yang dulu ada di sini DIHAPUS — audit sinyal 2026-10-22: ia
// menanyai api/signals.php untuk 5 simbol tiap 2 menit lalu mencari kolom `signal` yang tidak
// pernah ada di jawaban server, jadi tidak pernah memperbarui apa pun — tetapi tetap memakan
// kuota laju per-IP (60/menit) dan memicu get-chart-data sampai 4× per permintaan. Grid
// #tradeIdeasGrid sudah diisi dari api/signal-history.php oleh blok pertama berkas ini.)

// ── STATS COUNT-UP ANIMATION (#3) ───────────────────────────────────────
(function() {
    function animateCount(el, target, suffix, duration) {
        if (!el) return;
        const start = 0;
        const startTime = performance.now();
        function step(now) {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            const val = Math.round(start + (target - start) * eased);
            el.textContent = val.toLocaleString('id-ID') + (suffix || '');
            if (progress < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
    }
    const obs = new IntersectionObserver((entries) => {
        entries.forEach(e => {
            if (e.isIntersecting) {
                const el2 = document.getElementById('idxTotalWins');
                const val = el2 ? parseInt(el2.textContent.replace(/\D/g,''),10) || 0 : 0;
                if (val > 0) animateCount(el2, val, '', 1800);
                obs.disconnect();
            }
        });
    }, { threshold: 0.3 });
    const el = document.getElementById('idxTotalWins');
    if (el) obs.observe(el);
})();

// ── LIVE TICKER BAR — updates both copies via data-ticker-sym ────────────
(function() {
    const FMT = {
        BTCUSDT: { dec: 0, prefix: '$' }, XAUUSD: { dec: 2, prefix: '$' },
        ETHUSDT: { dec: 2, prefix: '$' }, EURUSD: { dec: 5, prefix: ''  },
        SOLUSDT: { dec: 2, prefix: '$' },
    };
    async function refreshTicker() {
        try {
            const res = await fetch('api/live-price.php?symbols=BTCUSDT,XAUUSD,ETHUSDT,EURUSD,SOLUSDT', { cache: 'no-store' });
            if (!res.ok) return;
            const json = await res.json();
            if (!json.prices) return;
            for (const [sym, data] of Object.entries(json.prices)) {
                if (!data || data.price == null || isNaN(data.price)) continue;
                const cfg = FMT[sym]; if (!cfg) continue;
                const price = data.price.toLocaleString('en-US', { minimumFractionDigits: cfg.dec, maximumFractionDigits: cfg.dec });
                const chg = data.chgPct ?? 0;
                const sign = chg >= 0 ? '+' : '';
                const cls = chg >= 0 ? 'ticker-price text-emerald-400' : 'ticker-price text-rose-400';
                document.querySelectorAll(`[data-ticker-sym="${sym}"] .ticker-price`).forEach(el => {
                    el.textContent = `${cfg.prefix}${price} (${sign}${chg.toFixed(2)}%)`;
                    el.className = cls;
                });
            }
        } catch(e) {}
    }
    refreshTicker();
    setInterval(refreshTicker, 30000);
})();

(function() {
    const counters = document.querySelectorAll('[data-count-to]');
    if (!counters.length) return;
    const io = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting || entry.target._counted) return;
            entry.target._counted = true;
            const el = entry.target;
            const target = parseInt(el.dataset.countTo, 10);
            const suffix = el.dataset.countSuffix || '';
            const fmt = el.dataset.countFormat === 'true';
            const dur = Math.min(1800, 400 + target * 1.2);
            const start = performance.now();
            function step(now) {
                const t = Math.min((now - start) / dur, 1);
                const ease = 1 - Math.pow(1 - t, 3);
                const val = Math.round(ease * target);
                el.textContent = (fmt ? val.toLocaleString('en-US') : val) + suffix;
                if (t < 1) requestAnimationFrame(step);
            }
            requestAnimationFrame(step);
        });
    }, { threshold: 0.3 });
    counters.forEach(c => io.observe(c));
})();

let _deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    _deferredInstallPrompt = e;
    const btn = document.getElementById('btnInstallAndroid');
    if (btn) {
        btn.classList.add('animate-pulse');
        btn.textContent = 'Install Sekarang';
    }
});
function triggerPWAInstall() {
    if (_deferredInstallPrompt) {
        _deferredInstallPrompt.prompt();
        _deferredInstallPrompt.userChoice.then(result => {
            if (result.outcome === 'accepted') {
                if (window.showQuantumToast) showQuantumToast('Aplikasi berhasil diinstall!', 'success');
            }
            _deferredInstallPrompt = null;
        });
    } else {
        window.location.href = 'pwa.html';
    }
}
window.addEventListener('appinstalled', () => {
    if (window.showQuantumToast) showQuantumToast('Quantum Terminal terinstall di perangkat Anda!', 'success');
});
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // Versi pada URL memaksa browser mengambil service worker terbaru;
        // tanpa itu .js yang di-cache "immutable" bisa menahan versi lama.
        navigator.serviceWorker.register('sw.js?v=7f4759b370').then((reg) => {
            if (reg && reg.update) reg.update();
        }).catch(() => {});
    });
}

document.addEventListener('click', function(e) {
    var wrap = document.getElementById('navCtaWrap');
    var drop = document.getElementById('navCtaDrop');
    if (wrap && drop && !wrap.contains(e.target)) drop.classList.add('hidden');
});

// Pengganti atribut onclick="..." (dilarang CSP tanpa 'unsafe-inline').
(function() {
    var cta = document.getElementById('navCtaBtn');
    if (cta) cta.addEventListener('click', function() { document.getElementById('navCtaDrop').classList.toggle('hidden'); });
    var pasang = document.getElementById('btnInstallAndroid');
    if (pasang) pasang.addEventListener('click', triggerPWAInstall);
})();

// ── Navigasi sadar sesi ─────────────────────────────────────────────────────
// Sudah masuk → tombol "Masuk" menjadi "Terminal". Belum masuk → tautan ke dashboard.html langsung
// menuju login.html (tujuannya diingat), tanpa memuat dashboard lebih dulu hanya untuk dialihkan
// ke login (dulu: 2 bundel sinkron + 9 CSS, lalu location.replace('login.html')).
function perbaruiNavSesi() {
    var adaSesi = false;
    try { adaSesi = !!(localStorage.getItem('qi_token') || sessionStorage.getItem('qi_token')); }
    catch (e) { try { adaSesi = !!sessionStorage.getItem('qi_token'); } catch (e2) {} }
    if (adaSesi) {
        document.querySelectorAll('a[data-qi-nav-masuk]').forEach(function (a) {
            a.setAttribute('href', 'dashboard.html');
            a.textContent = 'Terminal';
        });
    }
    return adaSesi;
}
(function () {
    perbaruiNavSesi();
    document.addEventListener('click', function (e) {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        var a = e.target && e.target.closest ? e.target.closest('a[href^="dashboard.html"]') : null;
        if (!a || a.target === '_blank') return;
        // Diperiksa saat diklik (sesi bisa berubah di tab lain sejak halaman dimuat).
        if (perbaruiNavSesi()) return;
        e.preventDefault();
        try {
            sessionStorage.setItem('qi_redirect_after_login', a.getAttribute('href'));
            sessionStorage.setItem('qi_alasan_masuk', 'perlu_masuk');
        } catch (err) {}
        window.location.href = 'login.html';
    });
    // Kembali lewat back-forward cache setelah masuk/keluar: perbarui tombolnya.
    window.addEventListener('pageshow', function (e) {
        if (!e.persisted) return;
        if (!perbaruiNavSesi()) {
            document.querySelectorAll('a[data-qi-nav-masuk]').forEach(function (a) {
                a.setAttribute('href', 'login.html');
                a.textContent = 'Masuk';
            });
        }
    });
})();
