/**
 * QIM Trading Tools — kalkulator P&L, margin & leverage, risk of ruin, backtest +
 * Monte Carlo, import/export watchlist, dan pengaman posisi paper trading
 * (eksekusi SL/TP, break-even, trailing stop).
 *
 * Simulasi Monte Carlo memakai RNG ber-seed sehingga hasil yang sama selalu keluar
 * untuk input yang sama — angka tidak "berubah sendiri" setiap tombol ditekan.
 */
(function () {
    'use strict';

    // ── Spesifikasi kontrak standar (1 lot) ────────────────────────────────
    const SPECS = {
        XAUUSD: { units: 100, base: 'XAU', quote: 'USD', pip: 0.01 },
        EURUSD: { units: 100000, base: 'EUR', quote: 'USD', pip: 0.0001 },
        GBPUSD: { units: 100000, base: 'GBP', quote: 'USD', pip: 0.0001 },
        AUDUSD: { units: 100000, base: 'AUD', quote: 'USD', pip: 0.0001 },
        NZDUSD: { units: 100000, base: 'NZD', quote: 'USD', pip: 0.0001 },
        USDJPY: { units: 100000, base: 'USD', quote: 'JPY', pip: 0.01 },
        USDCHF: { units: 100000, base: 'USD', quote: 'CHF', pip: 0.0001 },
        USDCAD: { units: 100000, base: 'USD', quote: 'CAD', pip: 0.0001 },
        BTCUSDT: { units: 1, base: 'BTC', quote: 'USD', pip: 1 },
        ETHUSDT: { units: 1, base: 'ETH', quote: 'USD', pip: 0.1 }
    };

    const $ = id => document.getElementById(id);
    const num = id => { const v = parseFloat(($(id) || {}).value); return Number.isFinite(v) ? v : NaN; };
    const usd = v => (v < 0 ? '-$' : '$') + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const pct = (v, d = 1) => (v >= 0 ? '' : '-') + Math.abs(v).toFixed(d) + '%';
    const toast = (msg, type) => { if (typeof window.showQuantumToast === 'function') window.showQuantumToast(msg, type || 'info'); };

    function esc(s) {
        return String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    }

    function card(label, value, cls) {
        return '<div class="bg-qi-panel border border-qi-border rounded-xl p-3 text-center">'
            + '<div class="text-[9px] text-slate-500 uppercase mb-1">' + esc(label) + '</div>'
            + '<div class="font-mono font-bold text-sm ' + (cls || 'text-slate-300') + '">' + esc(value) + '</div></div>';
    }

    function showMessage(targetId, msg) {
        const el = $(targetId);
        if (el) el.innerHTML = '<div class="text-center text-slate-500 text-xs py-4">' + esc(msg) + '</div>';
    }

    function renderCards(targetId, cards, note) {
        const el = $(targetId);
        if (!el) return;
        el.innerHTML = '<div class="grid grid-cols-2 gap-3">' + cards.join('') + '</div>'
            + (note ? '<p class="text-[10px] text-slate-500 mt-2 leading-relaxed">' + esc(note) + '</p>' : '');
    }

    /** Nilai dalam mata uang quote → USD. Pair dengan base USD dibagi harga. */
    function quoteToUsd(amount, spec, price) {
        if (spec.quote === 'USD') return amount;
        return spec.base === 'USD' && price > 0 ? amount / price : NaN;
    }

    // ── Kalkulator P&L ─────────────────────────────────────────────────────
    function calcPnl() {
        const spec = SPECS[($('qtPnlSym') || {}).value];
        const side = ($('qtPnlSide') || {}).value;
        const lots = num('qtPnlLots'), entry = num('qtPnlEntry'), exit = num('qtPnlExit'), bal = num('qtPnlBalance');
        if (!spec || !(lots > 0) || !(entry > 0) || !(exit > 0)) return showMessage('qtPnlResult', 'Isi lot, harga entry, dan harga exit.');
        const diff = side === 'SELL' ? entry - exit : exit - entry;
        const pnl = quoteToUsd(diff * spec.units * lots, spec, exit);
        const pips = diff / spec.pip;
        const cards = [
            card('Profit / Loss', usd(pnl), pnl >= 0 ? 'text-qi-green' : 'text-qi-red'),
            card('Pergerakan', (pips >= 0 ? '+' : '') + pips.toFixed(1) + ' pip', 'text-slate-300'),
            card('Perubahan Harga', pct(diff / entry * 100, 3), 'text-slate-300'),
            card('% dari Balance', bal > 0 ? pct(pnl / bal * 100, 2) : '—', pnl >= 0 ? 'text-qi-green' : 'text-qi-red')
        ];
        renderCards('qtPnlResult', cards, `1 lot = ${spec.units.toLocaleString('en-US')} ${spec.base}. Belum termasuk spread, komisi, dan swap.`);
    }

    // ── Kalkulator margin & leverage ───────────────────────────────────────
    function calcMargin() {
        const spec = SPECS[($('qtMgSym') || {}).value];
        const lots = num('qtMgLots'), price = num('qtMgPrice'), lev = num('qtMgLeverage'), bal = num('qtMgBalance');
        if (!spec || !(lots > 0) || !(price > 0) || !(lev >= 1)) return showMessage('qtMgResult', 'Isi lot, harga, dan leverage (≥ 1).');
        const notional = spec.base === 'USD' ? spec.units * lots : spec.units * lots * price;
        const margin = notional / lev;
        const cards = [
            card('Nilai Kontrak', usd(notional), 'text-slate-300'),
            card('Margin Dibutuhkan', usd(margin), 'text-qi-cyan')
        ];
        if (bal > 0) {
            const level = margin > 0 ? bal / margin * 100 : 0;
            cards.push(card('Free Margin', usd(bal - margin), bal - margin >= 0 ? 'text-qi-green' : 'text-qi-red'));
            cards.push(card('Margin Level', level.toFixed(0) + '%', level >= 200 ? 'text-qi-green' : level >= 100 ? 'text-qi-gold' : 'text-qi-red'));
            cards.push(card('Leverage Efektif', (notional / bal).toFixed(1) + '×', notional / bal > 10 ? 'text-qi-red' : 'text-slate-300'));
        }
        renderCards('qtMgResult', cards, 'Margin level di bawah 100% berarti posisi tidak bisa dibuka; banyak broker melakukan stop-out di 50%.');
    }

    // ── Monte Carlo ────────────────────────────────────────────────────────
    function mulberry32(seed) {
        let a = seed >>> 0;
        return function () {
            a = (a + 0x6D2B79F5) >>> 0;
            let t = a;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    function percentile(sorted, p) {
        if (!sorted.length) return NaN;
        const idx = Math.min(sorted.length - 1, Math.max(0, Math.round(p / 100 * (sorted.length - 1))));
        return sorted[idx];
    }

    /**
     * Simulasi fixed-fractional: tiap trade mengubah saldo sebesar riskPct × R.
     * `sampleR(rng)` mengembalikan hasil satu trade dalam kelipatan risiko (R).
     */
    function monteCarlo({ sampleR, riskPct, trades, paths, ruinPct, startBalance }) {
        const rng = mulberry32(20261016);
        const finals = [], drawdowns = [];
        let ruined = 0, losing = 0;
        for (let p = 0; p < paths; p++) {
            let bal = startBalance, peak = startBalance, maxDd = 0, isRuined = false;
            for (let t = 0; t < trades; t++) {
                bal *= 1 + (riskPct / 100) * sampleR(rng);
                if (bal > peak) peak = bal;
                const dd = (peak - bal) / peak * 100;
                if (dd > maxDd) maxDd = dd;
                if (!isRuined && dd >= ruinPct) isRuined = true;
                if (bal <= 0) { bal = 0; isRuined = true; break; }
            }
            finals.push(bal);
            drawdowns.push(maxDd);
            if (isRuined) ruined++;
            if (bal < startBalance) losing++;
        }
        finals.sort((a, b) => a - b);
        drawdowns.sort((a, b) => a - b);
        return {
            p5: percentile(finals, 5), p50: percentile(finals, 50), p95: percentile(finals, 95),
            dd50: percentile(drawdowns, 50), dd95: percentile(drawdowns, 95),
            ruinProb: ruined / paths * 100, lossProb: losing / paths * 100
        };
    }

    function calcRuin() {
        const winRate = num('qtRrWin'), payoff = num('qtRrPayoff'), risk = num('qtRrRisk');
        const ruin = num('qtRrRuin'), trades = Math.round(num('qtRrTrades'));
        if (!(winRate > 0 && winRate < 100) || !(payoff > 0) || !(risk > 0 && risk <= 100) || !(ruin > 0 && ruin <= 100) || !(trades >= 10 && trades <= 2000)) {
            return showMessage('qtRrResult', 'Win rate 1–99%, RR > 0, risiko 0–100%, batas ruin 1–100%, jumlah trade 10–2000.');
        }
        const p = winRate / 100;
        const expectancy = p * payoff - (1 - p);
        const mc = monteCarlo({
            sampleR: rng => (rng() < p ? payoff : -1), riskPct: risk, trades, paths: 5000, ruinPct: ruin, startBalance: 10000
        });
        const cards = [
            card('Risk of Ruin', mc.ruinProb.toFixed(1) + '%', mc.ruinProb < 1 ? 'text-qi-green' : mc.ruinProb < 10 ? 'text-qi-gold' : 'text-qi-red'),
            card('Expectancy / Trade', (expectancy >= 0 ? '+' : '') + expectancy.toFixed(2) + 'R', expectancy > 0 ? 'text-qi-green' : 'text-qi-red'),
            card('Max DD (median)', pct(mc.dd50), 'text-slate-300'),
            card('Max DD (5% terburuk)', pct(mc.dd95), 'text-qi-red'),
            card('Peluang Rugi', mc.lossProb.toFixed(1) + '%', mc.lossProb < 20 ? 'text-qi-green' : 'text-qi-red'),
            card('Saldo Median', usd(mc.p50), mc.p50 >= 10000 ? 'text-qi-green' : 'text-qi-red')
        ];
        renderCards('qtRrResult', cards,
            `5.000 simulasi × ${trades} trade dari saldo $10.000. "Ruin" = drawdown mencapai ${ruin}% dari puncak. Mengasumsikan setiap trade independen.`);
    }

    // ── Backtest (api/backtest.php) + Monte Carlo ─────────────────────────
    async function runBacktestMC() {
        const sym = ($('qtBtSym') || {}).value || 'BTCUSDT';
        const tf = ($('qtBtTf') || {}).value || '60';
        const risk = num('qtBtRisk');
        if (!(risk >= 0.5 && risk <= 10)) return showMessage('qtBtResult', 'Risiko per trade harus 0,5–10%.');
        const btn = $('qtBtRun');
        if (btn) { btn.disabled = true; btn.textContent = 'Menjalankan…'; }
        showMessage('qtBtResult', 'Menjalankan backtest pada data candle asli…');
        try {
            const headers = window.QuantumAuth && window.QuantumAuth.authHeaders ? window.QuantumAuth.authHeaders() : {};
            const qs = new URLSearchParams({ symbol: sym, interval: tf, risk: String(risk), balance: '10000' });
            const res = await fetch('api/backtest.php?' + qs.toString(), { headers, cache: 'no-store' });
            const data = await res.json().catch(() => null);
            if (res.status === 401 || res.status === 403) return showMessage('qtBtResult', 'Backtest khusus akun PRO — silakan login dengan akun PRO.');
            if (!res.ok || !data || data.status !== 'success') return showMessage('qtBtResult', (data && data.message) || `Backtest gagal (HTTP ${res.status}).`);

            const s = data.stats;
            const curve = Array.isArray(data.equityCurve) ? data.equityCurve : [];
            // Hasil per trade (dalam R) diturunkan dari kurva ekuitas: tiap langkah saldo
            // berubah sebesar risk% × R, jadi R = (saldo_baru / saldo_lama − 1) / risk%.
            const outcomes = [];
            let prev = s.initialBalance;
            curve.forEach(pt => {
                const r = (pt.balance / prev - 1) / (risk / 100);
                if (Number.isFinite(r)) outcomes.push(r);
                prev = pt.balance;
            });

            const cards = [
                card('Total Trade', String(s.totalTrades), 'text-slate-300'),
                card('Win Rate', s.winRate + '%', s.winRate >= 50 ? 'text-qi-green' : 'text-qi-gold'),
                card('Net Profit', usd(s.netProfit) + ' (' + pct(s.roiPct, 2) + ')', s.netProfit >= 0 ? 'text-qi-green' : 'text-qi-red'),
                card('Max Drawdown', pct(s.maxDrawdown, 2), 'text-qi-red'),
                card('Profit Factor', String(s.profitFactor), s.profitFactor >= 1 ? 'text-qi-green' : 'text-qi-red'),
                card('Data', `${data.candlesCount} candle`, 'text-slate-300')
            ];
            let mcHtml;
            if (outcomes.length < 20) {
                mcHtml = '<p class="text-[10px] text-qi-gold mt-3">Monte Carlo butuh minimal 20 trade; backtest ini hanya menghasilkan '
                    + outcomes.length + '. Coba timeframe lebih kecil.</p>';
            } else {
                const mc = monteCarlo({
                    sampleR: rng => outcomes[Math.floor(rng() * outcomes.length)],
                    riskPct: risk, trades: outcomes.length, paths: 5000, ruinPct: 50, startBalance: s.initialBalance
                });
                mcHtml = '<div class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mt-4 mb-2">Monte Carlo — 5.000 urutan acak</div>'
                    + '<div class="grid grid-cols-2 gap-3">'
                    + card('Saldo 5% Terburuk', usd(mc.p5), mc.p5 >= s.initialBalance ? 'text-qi-green' : 'text-qi-red')
                    + card('Saldo Median', usd(mc.p50), mc.p50 >= s.initialBalance ? 'text-qi-green' : 'text-qi-red')
                    + card('Saldo 5% Terbaik', usd(mc.p95), 'text-qi-green')
                    + card('Max DD (5% terburuk)', pct(mc.dd95), 'text-qi-red')
                    + card('Peluang Berakhir Rugi', mc.lossProb.toFixed(1) + '%', mc.lossProb < 20 ? 'text-qi-green' : 'text-qi-red')
                    + card('Peluang DD ≥ 50%', mc.ruinProb.toFixed(1) + '%', mc.ruinProb < 1 ? 'text-qi-green' : 'text-qi-red')
                    + '</div>';
            }
            const el = $('qtBtResult');
            if (el) {
                el.innerHTML = '<div class="grid grid-cols-2 gap-3">' + cards.join('') + '</div>' + mcHtml
                    + '<p class="text-[10px] text-slate-500 mt-2 leading-relaxed">Strategi: persilangan SMA 9/21, SL 1,5× range candle sinyal, TP 2R, '
                    + 'maksimal 14 candle per posisi. Monte Carlo mengacak urutan & komposisi trade (bootstrap) — hasil masa lalu tidak menjamin hasil berikutnya.</p>';
            }
        } catch (e) {
            showMessage('qtBtResult', 'Backtest gagal dijalankan: ' + (e && e.message ? e.message : 'kesalahan jaringan'));
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = 'Jalankan Backtest + Monte Carlo'; }
        }
    }

    // ── Import / export watchlist ──────────────────────────────────────────
    function allowedWatchlistSymbols() {
        const sel = $('wlAddSym');
        return sel ? Array.from(sel.options).map(o => o.value) : [];
    }

    // Daftar watchlist bersifat privat di advanced-trading.js; yang publik hanya
    // add/remove/renderPanelWatchlist. Jadi daftar dibaca dari tabel yang dirender.
    function currentWatchlist() {
        if (typeof window.renderPanelWatchlist === 'function') window.renderPanelWatchlist();
        return Array.from(document.querySelectorAll('#panelWatchlistBody tr td:nth-child(2)'))
            .map(td => td.textContent.trim()).filter(Boolean);
    }

    function exportWatchlist() {
        const symbols = currentWatchlist();
        const blob = new Blob([JSON.stringify({ format: 'qim-watchlist', version: 1, exportedAt: new Date().toISOString(), symbols }, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'qim-watchlist-' + new Date().toISOString().slice(0, 10) + '.json';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        toast(`Watchlist diekspor (${symbols.length} simbol)`, 'success');
    }

    /** Menerima JSON QIM, array JSON, atau teks/CSV berisi simbol. */
    function parseWatchlistFile(text) {
        try {
            const json = JSON.parse(text);
            if (Array.isArray(json)) return json;
            if (json && Array.isArray(json.symbols)) return json.symbols;
        } catch (e) { /* bukan JSON → anggap teks/CSV */ }
        return text.split(/[\s,;]+/);
    }

    function importWatchlist(input) {
        const file = input && input.files && input.files[0];
        if (!file) return;
        if (file.size > 100 * 1024) { toast('File terlalu besar (maks 100 KB)', 'error'); input.value = ''; return; }
        const reader = new FileReader();
        reader.onload = () => {
            const allowed = allowedWatchlistSymbols();
            const candidates = parseWatchlistFile(String(reader.result || ''))
                .map(s => String(s).toUpperCase().replace(/[^A-Z]/g, ''))
                .filter(Boolean);
            const sel = $('wlAddSym');
            if (!sel || typeof window.addToWatchlist !== 'function') { toast('Panel watchlist belum siap', 'error'); input.value = ''; return; }
            const before = currentWatchlist();
            const unknown = candidates.filter(sym => !allowed.includes(sym)).length;
            const fresh = [...new Set(candidates.filter(sym => allowed.includes(sym) && !before.includes(sym)))];
            const previousValue = sel.value;
            const realToast = window.showQuantumToast;
            window.showQuantumToast = function () {};   // redam toast per simbol dari addToWatchlist
            try {
                fresh.forEach(sym => { sel.value = sym; window.addToWatchlist(); });
            } finally {
                window.showQuantumToast = realToast;
                sel.value = previousValue;
            }
            const added = currentWatchlist().length - before.length;
            toast(`Import selesai: ${added} ditambahkan` + (unknown ? `, ${unknown} simbol tidak dikenal diabaikan` : ''), added ? 'success' : 'info');
            input.value = '';
        };
        reader.onerror = () => { toast('File tidak bisa dibaca', 'error'); input.value = ''; };
        reader.readAsText(file);
    }

    // ── Pengaman posisi paper trading: break-even, trailing stop, percepat penyelesaian SL/TP ────
    // SL/TP posisi manual DITEGAKKAN SERVER (api/paper-trading.php → qi_paper_settle, juga saat dashboard
    // tertutup). Pilihan "SL/TP otomatis" lama sudah dibuang: mematikannya tidak pernah bisa mematikan
    // penegakan di server, jadi pilihan itu menyesatkan.
    const GUARD_PREFS_KEY = 'qim_paper_guard';
    const GUARD_RISK_KEY = 'qim_paper_initial_risk';
    const guardDefaults = { breakEven: false, beAt: 1, trailing: false, trailBy: 1 };

    function readJson(key, fallback) {
        try { const v = JSON.parse(localStorage.getItem(key) || 'null'); return v && typeof v === 'object' ? v : fallback; } catch (e) { return fallback; }
    }
    function writeJson(key, value) {
        try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* mode privat: pengaturan tidak diingat */ }
    }

    function guardPrefs() { return Object.assign({}, guardDefaults, readJson(GUARD_PREFS_KEY, {})); }

    function saveGuardPrefs() {
        const prefs = {
            breakEven: !!($('qtGuardBE') || {}).checked,
            beAt: Math.max(0.1, num('qtGuardBEAt') || guardDefaults.beAt),
            trailing: !!($('qtGuardTrail') || {}).checked,
            trailBy: Math.max(0.1, num('qtGuardTrailBy') || guardDefaults.trailBy)
        };
        writeJson(GUARD_PREFS_KEY, prefs);
        guardTick();
    }

    function loadGuardUi() {
        const p = guardPrefs();
        if ($('qtGuardBE')) $('qtGuardBE').checked = p.breakEven;
        if ($('qtGuardBEAt')) $('qtGuardBEAt').value = p.beAt;
        if ($('qtGuardTrail')) $('qtGuardTrail').checked = p.trailing;
        if ($('qtGuardTrailBy')) $('qtGuardTrailBy').value = p.trailBy;
    }

    function paperState() {
        try {
            return {
                positions: typeof _ptPositions !== 'undefined' ? _ptPositions : null,
                prices: typeof _lastPrices !== 'undefined' ? _lastPrices : {}
            };
        } catch (e) { return { positions: null, prices: {} }; }
    }

    // Kunci stabil: id posisi berubah setiap kali snapshot disimpan ulang di server.
    const riskKey = p => [p.symbol, p.side, Number(p.entryPrice), Number(p.lots)].join('|');
    const lastToastAt = {};
    let saveTimer = null;

    // Dua jeda yang TERPISAH (audit trading 2026-10-22). Dulu satu peta jeda dipakai untuk penyimpanan SL
    // yang gagal DAN penutupan yang gagal, dan guardTick melewati posisi itu SELURUHNYA selama 60 detik —
    // trailing yang ditolak server (biasanya karena harga sudah melewati SL baru di feed server, saat keluar
    // paling penting) ikut mematikan pemeriksaan SL/TP-nya.
    //   · jedaSimpan: SL break-even/trailing yang ditolak → posisi itu tidak DIGESER lagi selama 60 detik
    //     (cegah POST tiap 2 detik → 429), tetapi SL/TP-nya tetap diperiksa.
    //   · tungguSampai: SL/TP tersentuh di feed klien, server sudah diminta menyelesaikan, posisi masih
    //     terbuka (feed server belum menyentuhnya) → tidak diminta lagi selama 30 detik.
    const JEDA_SIMPAN_MS = 60000;
    const jedaSimpan = {};
    const JEDA_MINTA_MS = 10000;
    const JEDA_TUNGGU_MS = 30000;
    const tungguSampai = {};
    let mintaPada = 0;

    // Trailing bisa menggeser SL tiap 2 detik; simpan ke server paling sering 15 detik sekali,
    // satu aksi 'ubah' per posisi yang SL-nya bergeser (bukan snapshot seluruh daftar).
    // Toast "SL digeser" baru muncul SETELAH server menerima SL barunya. Bila server menolaknya, SL di layar
    // dikembalikan ke nilai server (muat ulang): dulu SL yang ditolak tetap tampil dan dipakai klien seolah sah.
    const slBerubah = new Map();
    function scheduleSave(p, kind) {
        if (p && p.id) slBerubah.set(p.id, { p, kind });
        if (saveTimer || typeof window.ptUbahSlTp !== 'function') return;
        saveTimer = setTimeout(() => {
            saveTimer = null;
            const daftar = [...slBerubah.values()];
            slBerubah.clear();
            let adaGagal = false;
            const gagal = (id) => { jedaSimpan[id] = Date.now() + JEDA_SIMPAN_MS; adaGagal = true; };
            Promise.all(daftar.map(({ p: x, kind: k }) =>
                Promise.resolve(window.ptUbahSlTp(x.id, x.sl, x.tp)).then((hasil) => {
                    if (hasil) notifySlMove(x, k);
                    else gagal(x.id);
                }, () => gagal(x.id))
            )).then(() => {
                if (adaGagal && typeof window.ptMintaPenyelesaianServer === 'function') {
                    try { window.ptMintaPenyelesaianServer(); } catch (e) {}
                }
            });
        }, 15000);
    }

    function notifySlMove(p, kind) {
        const key = riskKey(p) + '|' + kind;
        if (kind === 'trailing' && Date.now() - (lastToastAt[key] || 0) < 60000) return;
        if (kind === 'break-even' && lastToastAt[key]) return;
        lastToastAt[key] = Date.now();
        toast(`${p.symbol} ${p.side}: SL digeser ke ${p.sl} (${kind})`, 'info');
    }

    /**
     * Pengaman posisi di klien — KEMUDAHAN untuk posisi MANUAL saja. Posisi AUTO/AI dikelola server
     * (ai-cron.php / _auto_paper.php); dulu pengaman ini ikut menggeser SL-nya di layar (SL yang tidak
     * pernah ada di server) dan mencoba menutupnya tiap 2 detik.
     *
     * SL/TP tersentuh → server DIMINTA menyelesaikan (window.ptMintaPenyelesaianServer: GET yang menjalankan
     * qi_paper_settle). Klien tidak lagi mengirim 'tutup' sendiri: penutupan itu tercatat 'manual' di harga
     * pasar, pada level yang mungkin tidak pernah disentuh feed eksekusi server (harga di sini dari
     * ptHargaNilai — feed kanonik bila simbolnya dilayani, selain itu feed tampilan).
     */
    function guardTick() {
        const st = paperState();
        const semua = Array.isArray(st.positions) ? st.positions : [];
        const manual = semua.filter(p => p && (!p.src || p.src === 'manual'));
        if (!manual.length) { updateGuardStatus({ open: 0 }); return; }
        const prefs = guardPrefs();
        const risks = readJson(GUARD_RISK_KEY, {});
        let risksChanged = false, slChanged = false, protectedCount = 0, dipantau = 0, tanpaHarga = 0, pasarTutup = 0;
        const tersentuh = [];
        const kini = Date.now();

        manual.forEach(p => {
            const isBuy = p.side === 'BUY';
            const q = typeof window.ptKutipanPaper === 'function' ? window.ptKutipanPaper(p.symbol) : st.prices[p.symbol];
            if (q && q.market === 'closed') { pasarTutup++; return; }   // pasar tutup: harga tidak bergerak
            // Harga PENUTUPAN yang segar: BUY ditutup di bid, SELL di ask (dashboard-app.js ptHargaNilai).
            // Harga basi / kurs referensi harian → null → posisi tidak dinilai sama sekali (dan tidak dihitung
            // "dipantau": dulu status mengaku memantau semua posisi walau tak satu pun punya harga).
            const price = typeof window.ptHargaNilai === 'function'
                ? window.ptHargaNilai(p.symbol, !isBuy)
                : parseFloat(q && (isBuy ? (q.bid ?? q.price) : (q.ask ?? q.price)));
            const entry = parseFloat(p.entryPrice);
            const sl = parseFloat(p.sl), tp = parseFloat(p.tp);
            if (!(price > 0) || !(entry > 0)) { tanpaHarga++; return; }
            dipantau++;
            const key = riskKey(p);

            // Risiko awal dicatat sekali, selagi SL masih di sisi rugi.
            if (!(risks[key] > 0) && sl > 0 && (isBuy ? sl < entry : sl > entry)) {
                risks[key] = Math.abs(entry - sl);
                risksChanged = true;
            }
            const initialRisk = risks[key];

            if (initialRisk > 0 && (jedaSimpan[p.id] || 0) <= kini) {
                const profit = isBuy ? price - entry : entry - price;
                let newSl = sl > 0 ? sl : null;
                const better = cand => newSl === null || (isBuy ? cand > newSl : cand < newSl);
                if (prefs.breakEven && profit >= prefs.beAt * initialRisk && better(entry)) newSl = entry;
                if (prefs.trailing && profit >= prefs.beAt * initialRisk) {
                    const trail = isBuy ? price - prefs.trailBy * initialRisk : price + prefs.trailBy * initialRisk;
                    if (better(trail)) newSl = trail;
                }
                if (newSl !== null && newSl !== sl) {
                    const decimals = entry >= 1000 ? 2 : entry >= 10 ? 3 : 5;
                    const rounded = +newSl.toFixed(decimals);
                    if (rounded !== sl) {
                        p.sl = rounded;
                        slChanged = true;
                        scheduleSave(p, rounded === +entry.toFixed(decimals) ? 'break-even' : 'trailing');
                    }
                }
            }
            if (initialRisk > 0 && (prefs.breakEven || prefs.trailing)) protectedCount++;

            const curSl = parseFloat(p.sl);
            const kena = (curSl > 0 && (isBuy ? price <= curSl : price >= curSl)) || (tp > 0 && (isBuy ? price >= tp : price <= tp));
            if (kena && (tungguSampai[p.id] || 0) <= kini) tersentuh.push(p.id);
        });

        if (risksChanged) writeJson(GUARD_RISK_KEY, risks);
        // Tidak ada toast di sini: "Stop loss / Take profit tersentuh — … ditutup server @ …" diucapkan
        // dashboard-app.js (ptUmumkanTutupServer) SETELAH server benar-benar menutup posisinya. Satu permintaan
        // untuk semua posisi yang tersentuh, paling sering 10 detik sekali (batas 60/menit paper-trading.php).
        if (tersentuh.length && kini - mintaPada >= JEDA_MINTA_MS && typeof window.ptMintaPenyelesaianServer === 'function') {
            mintaPada = kini;
            const tandaiTunggu = () => {
                const masih = new Set((paperState().positions || []).map(p => p && p.id));
                tersentuh.forEach(id => { if (masih.has(id)) tungguSampai[id] = Date.now() + JEDA_TUNGGU_MS; });
            };
            Promise.resolve(window.ptMintaPenyelesaianServer()).then(tandaiTunggu, tandaiTunggu);
        }
        if (slChanged && typeof window.ptRender === 'function') window.ptRender();
        updateGuardStatus({ open: manual.length, dipantau, tanpaHarga, pasarTutup, protectedCount });
    }

    function updateGuardStatus(s) {
        const el = $('qtGuardStatus');
        if (!el) return;
        if (!s.open) { el.textContent = 'Tidak ada posisi manual terbuka.'; return; }
        const bagian = [`${s.dipantau} dari ${s.open} posisi manual dipantau`];
        if (s.tanpaHarga) bagian.push(`${s.tanpaHarga} tanpa harga live`);
        if (s.pasarTutup) bagian.push(`${s.pasarTutup} pasar tutup`);
        bagian.push('SL/TP ditegakkan server', `${s.protectedCount} dengan BE/trailing`);
        el.textContent = bagian.join(' · ');
    }

    function init() {
        loadGuardUi();
        guardTick();
        setInterval(guardTick, 2000);
    }

    window.QIMTools = { calcPnl, calcMargin, calcRuin, runBacktestMC, exportWatchlist, importWatchlist, saveGuardPrefs, monteCarlo, SPECS };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
    else init();
})();
