(function () {
    'use strict';

    // Grup watchlist: Metals · Crypto · Forex · Saham. Harga: OANDA (emas, BTC, forex) & Binance (kripto lain).
    const GROUPS = [
        { key: 'metals', label: 'Metals' },
        { key: 'crypto', label: 'Crypto' },
        { key: 'forex',  label: 'Forex' },
        { key: 'saham',  label: 'Saham' }
    ];
    const SYMBOLS = [
        { group: 'metals', symbol: 'XAUUSD', label: 'Gold · U.S. Dollar', icon: 'Au', iconClass: 'gold', tv: 'OANDA:XAUUSD' },
        { group: 'crypto', symbol: 'BTCUSDT', label: 'Bitcoin · TetherUS', icon: '₿', iconClass: 'btc', tv: 'OANDA:BTCUSD' },
        { group: 'crypto', symbol: 'ETHUSDT', label: 'Ethereum · Tether', icon: '◆', iconClass: 'eth', tv: 'BINANCE:ETHUSDT' },
        { group: 'crypto', symbol: 'SOLUSDT', label: 'Solana · Tether', icon: '◎', iconClass: 'sol', tv: 'BINANCE:SOLUSDT' },
        { group: 'crypto', symbol: 'BNBUSDT', label: 'BNB · Tether', icon: '◈', iconClass: 'bnb', tv: 'BINANCE:BNBUSDT' },
        { group: 'forex', symbol: 'EURUSD', label: 'Euro · U.S. Dollar', icon: '€', iconClass: 'fx', tv: 'OANDA:EURUSD' },
        { group: 'forex', symbol: 'GBPUSD', label: 'Pound · U.S. Dollar', icon: '£', iconClass: 'fx', tv: 'OANDA:GBPUSD' },
        { group: 'forex', symbol: 'USDJPY', label: 'U.S. Dollar · Yen', icon: '¥', iconClass: 'fx', tv: 'OANDA:USDJPY' },
        { group: 'forex', symbol: 'AUDUSD', label: 'Aussie · U.S. Dollar', icon: 'A$', iconClass: 'fx', tv: 'OANDA:AUDUSD' },
        { group: 'forex', symbol: 'NZDUSD', label: 'Kiwi · U.S. Dollar', icon: 'N$', iconClass: 'fx', tv: 'OANDA:NZDUSD' },
        { group: 'forex', symbol: 'USDCHF', label: 'U.S. Dollar · Franc', icon: '₣', iconClass: 'fx', tv: 'OANDA:USDCHF' },
        { group: 'forex', symbol: 'USDCAD', label: 'U.S. Dollar · CAD', icon: 'C$', iconClass: 'fx', tv: 'OANDA:USDCAD' },
        { group: 'forex', symbol: 'GBPJPY', label: 'Pound · Yen', icon: '£', iconClass: 'fx', tv: 'OANDA:GBPJPY' },
        { group: 'forex', symbol: 'EURJPY', label: 'Euro · Yen', icon: '€', iconClass: 'fx', tv: 'OANDA:EURJPY' },
        { group: 'saham', symbol: 'AAPL', label: 'Apple Inc.', icon: '●', iconClass: 'apple', tv: 'NASDAQ:AAPL', chartSupported: false },
        { group: 'saham', symbol: 'TSLA', label: 'Tesla Inc.', icon: 'T', iconClass: 'tesla', tv: 'NASDAQ:TSLA', chartSupported: false }
    ];
    const LIVE_SYMBOLS = SYMBOLS.filter(item => item.chartSupported !== false).map(item => item.symbol).join(',');
    function pairLabel(symbol) {
        return /^[A-Z]{6}$/.test(symbol) ? symbol.slice(0, 3) + '/' + symbol.slice(3)
            : symbol === 'BTCUSDT' ? 'BTC/USDT' : symbol;
    }
    // B/S hanya MEMBUKA panel Paper Trading dengan instrumen & arah terpilih; tidak mengeksekusi apa pun.
    function openPaper(symbol, side) {
        if (typeof window.switchPanel !== 'function') return;
        window.switchPanel('panel-paper');
        setTimeout(() => {
            const sym = document.getElementById('ptSymbol');
            if (sym && Array.from(sym.options).some(o => o.value === symbol)) { sym.value = symbol; sym.dispatchEvent(new Event('change')); }
            const dir = document.getElementById('ptSide');
            if (dir) { dir.value = side; dir.dispatchEvent(new Event('change')); }
        }, 80);
    }
    const FALLBACK_CURVES = {
        up: 'M1 16 L6 14 L10 15 L15 10 L20 12 L25 7 L30 8 L35 2',
        down: 'M1 2 L6 5 L10 4 L15 9 L20 7 L25 13 L30 11 L35 17'
    };
    let prices = {};

    function node(tag, className, text) {
        const el = document.createElement(tag);
        if (className) el.className = className;
        if (text !== undefined) el.textContent = text;
        return el;
    }

    function priceText(value) {
        const number = Number(value);
        return Number.isFinite(number)
            ? number.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: number < 10 ? 5 : 2 })
            : '—';
    }

    function renderWatchlist() {
        const target = document.getElementById('qimWatchlistRows');
        if (!target) return;
        target.replaceChildren();
        const active = (typeof currentChartSymbol === 'function' ? currentChartSymbol() : '') || 'XAUUSD';
        GROUPS.forEach(group => {
            const items = SYMBOLS.filter(item => item.group === group.key);
            if (!items.length) return;
            const heading = node('div', 'qim-watch-group', group.label);
            heading.dataset.group = group.key;
            target.append(heading);
            items.forEach(item => {
                const data = prices[item.symbol];
                const change = data && Number(data.chgPct);
                const hasChange = Number.isFinite(change);
                const disabled = item.chartSupported === false;
                const row = node('div', 'qim-watch-row');
                row.setAttribute('role', 'button');
                row.tabIndex = 0;   // tetap bisa difokus: baris nonaktif menjelaskan dirinya saat dipilih
                if (disabled) row.setAttribute('aria-disabled', 'true');
                row.title = disabled ? item.label + ' · feed saham belum tersedia' : item.label;
                row.setAttribute('aria-label', item.symbol + ', ' + priceText(data && data.price) + ', ' + (hasChange ? change.toFixed(2) + '%' : 'harga belum tersedia'));
                if (item.symbol === active) row.classList.add('is-active');
                const select = () => {
                    if (disabled) {
                        // Di layar sentuh tidak ada tooltip; dulu ketukan pada saham tidak memberi tanggapan apa pun.
                        const pesan = item.symbol + ': feed harga saham belum tersedia — chart & Paper Trading saham menyusul.';
                        if (typeof window.showToast === 'function') window.showToast(pesan, 'info', 3500);
                        return;
                    }
                    if (typeof window.setChartSymbolFull !== 'function') return;
                    window.switchPanel('panel-charts');
                    window.setChartSymbolFull(item.symbol, item.tv, pairLabel(item.symbol));
                };
                row.addEventListener('click', select);
                row.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(); } });

                const asset = node('span', 'qim-watch-asset');
                asset.append(node('span', 'qim-watch-icon ' + item.iconClass, item.icon));
                const name = node('span', 'qim-watch-name');
                name.append(node('b', '', item.symbol), node('small', '', item.label.replace(' · ', ' / ')));
                asset.append(name);
                const quote = node('span', 'qim-watch-quote');
                quote.append(node('span', 'qim-watch-price', disabled ? 'Segera' : priceText(data && data.price)));
                quote.append(node('span', 'qim-watch-change ' + (hasChange ? (change >= 0 ? 'qim-positive' : 'qim-negative') : ''),
                    hasChange ? (change >= 0 ? '+' : '') + change.toFixed(2) + '%' : '—'));
                const spark = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                spark.setAttribute('viewBox', '0 0 36 20');
                spark.setAttribute('class', 'qim-sparkline' + (hasChange && change < 0 ? ' down' : ''));
                spark.setAttribute('aria-hidden', 'true');
                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                path.setAttribute('d', hasChange && change < 0 ? FALLBACK_CURVES.down : FALLBACK_CURVES.up);
                spark.append(path);
                const trade = node('span', 'qim-watch-trade');
                [['B', 'BUY'], ['S', 'SELL']].forEach(([text, side]) => {
                    const tip = 'Buka Paper Trading: ' + side + ' ' + item.symbol;
                    const button = node('button', 'qim-bs ' + (side === 'BUY' ? 'buy' : 'sell'), text);
                    button.type = 'button';
                    button.title = tip;
                    button.setAttribute('aria-label', tip);
                    button.disabled = disabled;
                    button.addEventListener('click', e => { e.stopPropagation(); openPaper(item.symbol, side); });
                    trade.append(button);
                });
                row.append(asset, quote, spark, trade);
                target.append(row);
            });
        });
    }

    function bindWatchTabs() {
        const tabs = document.getElementById('qimWatchTabs');
        if (!tabs || tabs.dataset.bound) return;
        tabs.dataset.bound = '1';
        tabs.addEventListener('click', event => {
            const button = event.target.closest('[data-group]');
            if (!button) return;
            tabs.querySelectorAll('[data-group]').forEach(b => b.classList.toggle('active', b === button));
            const heading = document.querySelector('#qimWatchlistRows .qim-watch-group[data-group="' + button.dataset.group + '"]');
            const scroller = document.getElementById('qimWatchlistRows');
            if (heading && scroller) scroller.scrollTo({ top: Math.max(0, heading.offsetTop - scroller.offsetTop), behavior: 'smooth' });
        });
    }

    function setPairSummary(symbol) {
        const pair = SYMBOLS.find(item => item.symbol === symbol) || SYMBOLS[0];
        const data = prices[pair.symbol];
        const title = document.getElementById('qimPairTitle');
        const subtitle = document.getElementById('qimPairSub');
        const price = document.getElementById('qimPairPrice');
        const change = document.getElementById('qimPairChange');
        const high = document.getElementById('qimPairHigh');
        const low = document.getElementById('qimPairLow');
        const volume = document.getElementById('qimPairVolume');
        if (title) title.textContent = pair.symbol;
        if (subtitle) subtitle.textContent = pair.label.replace(' · ', ' / ');
        if (price) price.textContent = priceText(data && data.price);
        if (change) {
            const pct = data && Number(data.chgPct);
            change.textContent = Number.isFinite(pct) ? `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%` : 'Harga belum tersedia';
            change.className = Number.isFinite(pct) ? (pct >= 0 ? 'qim-positive' : 'qim-negative') : '';
        }
        if (high) high.textContent = priceText(data && data.high);
        if (low) low.textContent = priceText(data && data.low);
        if (volume) volume.textContent = data && Number(data.vol) > 0 ? Number(data.vol).toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—';
    }

    // Lencana status pasar di kepala chart: bila OANDA tutup (akhir pekan / di luar jam), harga memang
    // diam — itu bukan kerusakan data. Ditampilkan supaya jelas kenapa tidak bergerak seperti MT5.
    function ageText(seconds) {
        const s = Number(seconds) || 0;
        if (s < 90) return `${s}d`;
        if (s < 5400) return `${Math.round(s / 60)}m`;
        return s < 172800 ? `${Math.round(s / 3600)}j` : `${Math.round(s / 86400)}h`;
    }
    function updateMarketBadge() {
        const host = document.querySelector('.qch-price');
        if (!host) return;
        let badge = document.getElementById('qimMarketBadge');
        if (!badge) { badge = node('span', 'qim-market-badge'); badge.id = 'qimMarketBadge'; host.append(badge); }
        const symbol = currentChartSymbol() || 'XAUUSD';
        const data = prices[symbol];
        if (data && data.market === 'closed') {
            badge.hidden = false;
            badge.className = 'qim-market-badge is-closed';
            badge.textContent = 'PASAR TUTUP · tick terakhir ' + ageText(data.tick_age) + ' lalu';
            badge.title = 'Sumber (OANDA via TradingView) sedang di luar sesi perdagangan, jadi harga tidak bergerak.';
        } else if (data && data.source === 'oanda_tv') {
            badge.hidden = false;
            badge.className = 'qim-market-badge is-live';
            badge.textContent = 'LIVE · OANDA';
            badge.title = 'Tick real-time OANDA lewat TradingView-API';
        } else {
            badge.hidden = true;
        }
    }

    let pricesInFlight = false;
    async function refreshPrices() {
        if (pricesInFlight) return;
        pricesInFlight = true;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 12000);
        try {
            const response = await fetch('api/live-price.php?symbols=' + LIVE_SYMBOLS, { cache: 'no-store', signal: controller.signal });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const result = await response.json();
            if (!result || result.status !== 'success' || !result.prices) throw new Error('Format data harga tidak valid');
            prices = result.prices;
            // Penunjuk status data di header (qim-header.js) membaca harga yang sama.
            try { window.dispatchEvent(new CustomEvent('qim-prices', { detail: { prices } })); } catch (e) {}
            renderWatchlist();
            updateMarketBadge();
            const selected = document.getElementById('chartCurSym');
            const pair = selected ? selected.textContent.replace(/[^A-Z0-9]/gi, '').toUpperCase() : 'XAUUSD';
            setPairSummary(pair);
        } catch (error) {
            const target = document.getElementById('qimWatchlistRows');
            if (target && !Object.keys(prices).length) target.replaceChildren(node('div', 'qim-muted', 'Data harga belum tersedia.'));
            console.warn('[QIM] Harga ringkasan tidak dapat dimuat:', error.message);
        } finally {
            clearTimeout(timer);
            pricesInFlight = false;
        }
    }

    function relativeTime(dateValue) {
        const date = new Date(dateValue);
        if (!Number.isFinite(date.getTime())) return 'Baru saja';
        const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
        if (minutes < 60) return `${minutes}m lalu`;
        return minutes < 1440 ? `${Math.floor(minutes / 60)}j lalu` : `${Math.floor(minutes / 1440)}h lalu`;
    }

    async function refreshNews() {
        const target = document.getElementById('qimNewsRows');
        if (!target) return;
        try {
            const response = await fetch('api/news.php', { cache: 'no-store' });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const result = await response.json();
            const articles = Array.isArray(result.data) ? result.data.slice(0, 3) : [];
            target.replaceChildren();
            if (!articles.length) throw new Error('Feed berita kosong');
            articles.forEach(article => {
                const safeUrl = /^https:\/\//i.test(article.url || '') ? article.url : '#';
                const link = node('a', 'qim-news-item');
                link.href = safeUrl;
                if (safeUrl !== '#') { link.target = '_blank'; link.rel = 'noopener noreferrer'; }
                const category = String(article.category || '').toUpperCase();
                link.append(node('span', 'qim-news-thumb', category === 'GOLD' ? 'Au' : category === 'MACRO' ? '◎' : '₿'));
                const content = node('span');
                content.append(node('span', 'qim-news-title', article.title || 'Berita pasar'));
                const meta = node('span', 'qim-news-meta');
                meta.append(node('span', '', relativeTime(article.published_at)));
                const sentiment = String(article.sentiment || 'neutral').toLowerCase();
                const badge = node('span', `qim-news-badge ${sentiment === 'bullish' ? 'is-bullish' : sentiment === 'bearish' ? 'is-bearish' : 'is-neutral'}`,
                    sentiment === 'bullish' ? 'BULLISH' : sentiment === 'bearish' ? 'BEARISH' : 'NEUTRAL');
                meta.append(badge);
                content.append(meta);
                link.append(content);
                target.append(link);
            });
        } catch (error) {
            target.replaceChildren(node('div', 'qim-muted', 'Berita belum tersedia.'));
            console.warn('[QIM] Feed berita tidak dapat dimuat:', error.message);
        }
    }

    // ─── Panel kanan: data nyata, tanpa angka contoh ───────────────────────
    function authHeaders() {
        return typeof window.QuantumAuth !== 'undefined' && window.QuantumAuth.authHeaders
            ? window.QuantumAuth.authHeaders() : {};
    }

    function signedUsd(value) {
        const number = Number(value) || 0;
        return `${number >= 0 ? '+' : '-'}$${Math.abs(number).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    function setBadge(element, text, tone) {
        if (!element) return;
        element.hidden = !text;
        element.textContent = text || '';
        element.className = tone ? `is-${tone}` : '';
    }

    function currentChartSymbol() {
        const selected = document.getElementById('chartCurSym');
        return selected ? selected.textContent.replace(/[^A-Z0-9]/gi, '').toUpperCase() : '';
    }

    // Auto Analisa AI: konsensus 4 timeframe + indikator D1 dari api/tv-scan.php,
    // endpoint yang sama dengan Signal Matrix (fetchSignalMatrix di dashboard-app.js).
    let analysisSymbol = '';
    let analysisInFlight = false;
    function resetAnalysis(note) {
        const gaugeValue = document.getElementById('qimAiGaugeValue');
        if (gaugeValue) gaugeValue.style.strokeDasharray = '0 302';
        const consensus = document.getElementById('qimAiConsensus');
        if (consensus) consensus.textContent = '—';
        const label = document.getElementById('qimAiConsensusLabel');
        if (label) label.textContent = 'Konsensus TF';
        const gauge = document.getElementById('qimAiGauge');
        if (gauge) gauge.setAttribute('aria-label', 'Konsensus timeframe belum tersedia');
        const rsi = document.getElementById('qimAiRsi');
        if (rsi) rsi.textContent = '—';
        ['qimAiRsiState', 'qimAiMacd', 'qimAiTrend'].forEach(id => setBadge(document.getElementById(id), ''));
        const noteEl = document.getElementById('qimAiNote');
        if (noteEl) noteEl.textContent = note;
    }

    async function refreshAnalysis(symbol) {
        const sym = String(symbol || currentChartSymbol() || '').toUpperCase();
        if (!sym || !document.getElementById('qimAiGauge')) return;
        if (analysisInFlight && sym === analysisSymbol) return;
        const changed = sym !== analysisSymbol;
        analysisSymbol = sym;
        analysisInFlight = true;
        if (changed) resetAnalysis(`Memuat analisa ${sym}…`);
        try {
            const response = await fetch(`api/tv-scan.php?symbols=${encodeURIComponent(sym)}`, { cache: 'no-store' });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const result = await response.json();
            if (sym !== analysisSymbol) return;
            const data = result && result.status === 'success' && result.data ? result.data[sym] : null;
            if (!data) { resetAnalysis(`Analisa ${sym} belum tersedia dari TradingView.`); return; }

            const frames = ['15', '60', '240', '1D'].map(tf => (data.timeframes && data.timeframes[tf] && data.timeframes[tf].signal) || 'NO_DATA');
            const available = frames.filter(signal => signal !== 'NO_DATA').length;
            const buys = frames.filter(signal => signal.includes('BUY')).length;
            const sells = frames.filter(signal => signal.includes('SELL')).length;
            const direction = buys > sells ? 'BUY' : sells > buys ? 'SELL' : 'NETRAL';
            const agree = direction === 'BUY' ? buys : direction === 'SELL' ? sells : 0;
            const pct = available ? Math.round(agree / available * 100) : 0;
            const gaugeValue = document.getElementById('qimAiGaugeValue');
            if (gaugeValue) gaugeValue.style.strokeDasharray = `${Math.round(226 * pct / 100)} 302`;
            document.getElementById('qimAiConsensus').textContent = available ? `${pct}%` : '—';
            document.getElementById('qimAiConsensusLabel').textContent = available ? `${agree}/${available} TF ${direction}` : 'Konsensus TF';
            document.getElementById('qimAiGauge').setAttribute('aria-label', available
                ? `${sym}: ${agree} dari ${available} timeframe ${direction}` : `${sym}: konsensus timeframe belum tersedia`);

            const ind = data.indicators || {};
            const rsi = Number(ind.rsi);
            const hasRsi = ind.rsi != null && Number.isFinite(rsi);
            document.getElementById('qimAiRsi').textContent = hasRsi ? rsi.toFixed(1) : '—';
            setBadge(document.getElementById('qimAiRsiState'), hasRsi ? (rsi < 30 ? 'Oversold' : rsi > 70 ? 'Overbought' : 'Netral') : '',
                hasRsi ? (rsi < 30 ? 'bullish' : rsi > 70 ? 'bearish' : 'warning') : '');
            const hasMacd = ind.macd != null && ind.macd_signal != null;
            setBadge(document.getElementById('qimAiMacd'), hasMacd ? (ind.macd > ind.macd_signal ? 'Bullish' : 'Bearish') : '',
                hasMacd ? (ind.macd > ind.macd_signal ? 'bullish' : 'bearish') : '');
            const hasTrend = ind.ema50 != null && ind.ema200 != null;
            setBadge(document.getElementById('qimAiTrend'), hasTrend ? (ind.ema50 > ind.ema200 ? 'Golden' : 'Death') : '',
                hasTrend ? (ind.ema50 > ind.ema200 ? 'warning' : 'bearish') : '');
            document.getElementById('qimAiTrend').title = hasTrend ? 'EMA50 terhadap EMA200 (D1)' : '';

            const loaded = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
            document.getElementById('qimAiNote').textContent = `${sym} · konsensus M15–D1, indikator D1 · TradingView ${loaded}`;
        } catch (error) {
            if (sym === analysisSymbol) resetAnalysis(`Analisa ${sym} belum tersedia.`);
            console.warn('[QIM] Auto Analisa tidak dapat dimuat:', error.message);
        } finally {
            if (sym === analysisSymbol) analysisInFlight = false;
        }
    }

    // Signal Feed: rekor terbaru dari api/signal-history.php (cache/signal_history.json).
    function signalIcon(symbol) {
        if (symbol.startsWith('BTC')) return ['₿', 'btc'];
        if (symbol.startsWith('ETH')) return ['◆', 'eth'];
        if (symbol.startsWith('XAU')) return ['Au', 'gold'];
        if (/^[A-Z]{6}$/.test(symbol) && !symbol.endsWith('USDT')) return [symbol.slice(0, 3), 'fx'];
        return [symbol.replace(/USDT$/, '').slice(0, 3), 'alt'];
    }

    function signalStatus(status) {
        const text = String(status || '').toUpperCase();
        if (text.includes('HIT TP')) return 'TP';
        if (text.includes('HIT SL')) return 'SL';
        if (text.includes('AKTIF') || text.includes('ACTIVE')) return 'Aktif';
        if (text.includes('EXPIRED') || text.includes('KEDALUWARSA')) return 'Expired';
        return text.replace(/[^\w ]/g, '').trim();
    }

    async function refreshSignalFeed() {
        const target = document.getElementById('qimSignalFeed');
        if (!target) return;
        const note = document.getElementById('qimSignalNote');
        try {
            const response = await fetch('api/signal-history.php', { cache: 'no-store' });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const result = await response.json();
            if (!result || result.status !== 'success') throw new Error(result && result.message || 'Format riwayat sinyal tidak valid');
            const history = Array.isArray(result.history) ? result.history.slice() : [];
            const stamp = value => new Date(String(value || '').replace(' ', 'T')).getTime() || 0;
            // Utamakan timestamp_epoch dari server: rekor baru ditulis UTC, rekor lama tanpa zona.
            // Cadangan untuk server lama: string dibandingkan dengan server_time (zona sama).
            const epochMs = item => Number(item && item.timestamp_epoch) > 0 ? Number(item.timestamp_epoch) * 1000 : 0;
            const skew = Number(result.server_epoch) > 0 ? Date.now() - Number(result.server_epoch) * 1000 : 0;
            const offset = result.server_time ? Date.now() - stamp(result.server_time) : 0;
            const when = item => epochMs(item) ? epochMs(item) + skew : (stamp(item.timestamp) ? stamp(item.timestamp) + offset : 0);
            history.sort((a, b) => when(b) - when(a));
            target.replaceChildren();
            if (!history.length) {
                target.append(node('div', 'qim-muted', 'Belum ada sinyal tercatat.'));
                if (note) note.textContent = 'Sinyal baru muncul di sini setelah dicatat mesin Auto Signal.';
                return;
            }
            history.slice(0, 3).forEach(item => {
                const symbol = String(item.symbol || '').toUpperCase();
                const long = String(item.side || '').toUpperCase() === 'BUY';
                const [iconText, iconClass] = signalIcon(symbol);
                const status = signalStatus(item.status);
                const article = node('article', 'qim-signal');
                article.dataset.signalSymbol = symbol;
                article.title = `${item.engine_name || item.engine || 'Sinyal'} · ${item.timestamp || ''}${status ? ' · ' + status : ''}`;

                const top = node('div', 'qim-signal-top');
                top.append(node('span', `qim-signal-icon ${iconClass}`, iconText), node('b', '', symbol),
                    node('em', long ? 'is-bullish' : 'is-bearish', long ? 'Long' : 'Short'));
                const age = when(item) ? relativeTime(when(item)) : '—';
                const time = node('time', '', `${age}${status ? ' · ' + status : ''}`);
                if (item.timestamp) time.dateTime = epochMs(item) ? new Date(epochMs(item)).toISOString() : String(item.timestamp).replace(' ', 'T');
                top.append(time);

                const values = node('div', 'qim-signal-values');
                [['Entry', item.entry], ['SL', item.sl], ['TP', item.tp]].forEach(([label, value]) => {
                    const span = node('span', '', `${label} `);
                    span.append(node('b', '', priceText(value)));
                    values.append(span);
                });

                const quality = node('div', 'qim-quality');
                const score = Number(item.confluence_score);
                const hasScore = Number.isFinite(score);
                const bar = node('i');
                const fill = node('b');
                fill.style.width = `${hasScore ? Math.max(0, Math.min(100, score)) : 0}%`;
                bar.append(fill);
                quality.title = 'Grade A/B/C dari konfluensi, keselarasan MTF, mesin setuju, dan R:R saat sinyal dibuat — bukan jaminan hasil.';
                quality.append(node('span', '', item.grade ? `Grade ${item.grade}` : 'Grade —'), bar, node('strong', '', hasScore ? `${Math.round(score)}%` : '—'));

                article.append(top, values, quality);
                target.append(article);
            });
            if (note) note.textContent = `${history.length} sinyal tercatat · skor = konfluensi saat sinyal dibuat`;
        } catch (error) {
            target.replaceChildren(node('div', 'qim-muted', 'Riwayat sinyal belum tersedia.'));
            if (note) note.textContent = 'Sumber: riwayat sinyal tercatat';
            console.warn('[QIM] Signal Feed tidak dapat dimuat:', error.message);
        }
    }

    // Simulation Balance: ekuitas paper trading dari api/paper-trading.php (tabel paper_positions):
    // saldo awal + P&L tertutup + P&L mengambang posisi terbuka pada harga live.
    function setSimulation(values) {
        const set = (id, text, className) => {
            const element = document.getElementById(id);
            if (!element) return;
            element.textContent = text;
            if (className !== undefined) element.className = className;
        };
        set('qimSimEquity', values.equity);
        set('qimSimPct', values.pct);
        set('qimSimInitial', values.initial);
        set('qimSimRealized', values.realized, values.realizedClass || '');
        set('qimSimOpen', values.open, values.openClass || '');
        set('qimSimNote', values.note);
        const summary = document.getElementById('qimSimSummary');
        if (summary) summary.classList.toggle('is-down', !!values.down);
        const spark = document.getElementById('qimSimSpark');
        const path = document.getElementById('qimSimSparkPath');
        if (spark && path) {
            const points = values.curve || [];
            spark.toggleAttribute('hidden', points.length < 2);
            if (points.length >= 2) {
                const min = Math.min(...points);
                const max = Math.max(...points);
                const span = max - min || 1;
                path.setAttribute('d', points.map((value, index) => {
                    const x = 2 + index * 146 / (points.length - 1);
                    const y = max === min ? 24 : 44 - (value - min) / span * 40;
                    return `${index ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
                }).join(' '));
            }
        }
    }

    let simulationInFlight = false;
    async function refreshSimulation() {
        if (simulationInFlight || !document.getElementById('qimSimEquity')) return;
        const level = typeof window.qiTingkatSaatIni === 'function' ? window.qiTingkatSaatIni() : 0;
        if (level < 1) {
            // Endpoint ini khusus PRO: tidak dipanggil untuk paket lain (hanya menghasilkan 403).
            setSimulation({ equity: '—', pct: '—', initial: '—', realized: '—', open: '—', note: 'Paper Trading tersedia untuk paket PRO ke atas.' });
            return;
        }
        simulationInFlight = true;
        try {
            const response = await fetch('api/paper-trading.php', { headers: authHeaders(), cache: 'no-store' });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const result = await response.json();
            if (!result || result.status !== 'success' || !result.data) throw new Error(result && result.message || 'Format data paper trading tidak valid');
            const positions = Array.isArray(result.data.positions) ? result.data.positions : [];
            const history = Array.isArray(result.data.history) ? result.data.history : [];
            const balance = Number(result.data.balance) || 0;
            const realizedList = history.map(item => Number(item.realizedPnL) || 0);
            const realized = realizedList.reduce((sum, value) => sum + value, 0);
            const initial = balance - realized;

            let floating = 0;
            let priced = 0;
            const symbols = [...new Set(positions.map(item => String(item.symbol || '').toUpperCase()).filter(Boolean))];
            if (symbols.length) {
                let quotes = {};
                try {
                    const priceResponse = await fetch(`api/live-price.php?symbols=${encodeURIComponent(symbols.join(','))}`, { cache: 'no-store' });
                    const priceResult = priceResponse.ok ? await priceResponse.json() : null;
                    if (priceResult && priceResult.status === 'success' && priceResult.prices) quotes = priceResult.prices;
                } catch (error) { console.info('[QIM] Harga posisi paper belum tersedia:', error.message); }
                positions.forEach(item => {
                    const quote = quotes[String(item.symbol || '').toUpperCase()];
                    const price = quote && Number(quote.price);
                    const entry = Number(item.entryPrice);
                    if (!Number.isFinite(price) || !Number.isFinite(entry) || typeof window.ptPnlMult !== 'function') return;
                    const diff = item.side === 'SELL' ? entry - price : price - entry;
                    floating += diff * (Number(item.lots) || 0) * window.ptPnlMult(String(item.symbol).toUpperCase());
                    priced++;
                });
            }

            const equity = balance + floating;
            const change = initial ? (equity - initial) / initial * 100 : 0;
            // Kurva dibangun dari penutupan terlama (closedAt dari server); tanpa closedAt
            // dipakai urutan API (terbaru lebih dulu) yang dibalik.
            const closedAt = item => new Date(item.closedAt || 0).getTime() || 0;
            const ordered = history.every(item => closedAt(item))
                ? history.slice().sort((x, y) => closedAt(x) - closedAt(y))
                : history.slice().reverse();
            const curve = [initial];
            ordered.forEach(item => curve.push(curve[curve.length - 1] + (Number(item.realizedPnL) || 0)));
            if (positions.length && priced) curve.push(equity);
            const tone = value => value > 0 ? 'is-bullish' : value < 0 ? 'is-bearish' : '';
            const trades = history.length;
            setSimulation({
                equity: `$${equity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                pct: `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`,
                initial: `$${initial.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                realized: signedUsd(realized), realizedClass: tone(realized),
                open: positions.length ? (priced ? signedUsd(floating) : 'Harga belum tersedia') : '—',
                openClass: priced ? tone(floating) : '',
                down: equity < initial,
                curve,
                note: trades || positions.length
                    ? `Akun simulasi · ${trades} trade tertutup · ${positions.length} posisi terbuka`
                    : 'Akun simulasi · belum ada transaksi paper trading'
            });
        } catch (error) {
            setSimulation({ equity: '—', pct: '—', initial: '—', realized: '—', open: '—', note: 'Data paper trading belum tersedia.' });
            console.warn('[QIM] Simulation Balance tidak dapat dimuat:', error.message);
        } finally {
            simulationInFlight = false;
        }
    }

    function brokerStatus(element, online, label) {
        element.classList.toggle('is-offline', !online);
        const text = element.lastChild;
        if (text && text.nodeType === Node.TEXT_NODE) text.textContent = ` ${label}`;
        else element.append(document.createTextNode(` ${label}`));
    }

    async function refreshBrokerStatus() {
        try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 15000);
            const headers = typeof window.QuantumAuth !== 'undefined' && window.QuantumAuth.authHeaders
                ? window.QuantumAuth.authHeaders() : {};
            const response = await fetch('api/account-analytics.php', { headers, cache: 'no-store', signal: controller.signal });
            clearTimeout(timer);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const result = await response.json();
            if (result.status !== 'success') throw new Error(result.message || 'Status koneksi tidak tersedia');
            const accounts = Array.isArray(result.accounts) ? result.accounts : [];
            if (!accounts.length) {
                // Jujur: broker tidak pernah ditandai "Connected" tanpa akun yang benar-benar tersambung.
                ['mt5', 'oanda', 'alpaca'].forEach(provider => {
                    const element = document.querySelector(`[data-broker="${provider}"]`);
                    if (element) brokerStatus(element, false, 'Disconnected');
                });
                return;
            }
            ['mt5', 'oanda', 'alpaca'].forEach(provider => {
                const element = document.querySelector(`[data-broker="${provider}"]`);
                if (!element) return;
                const account = accounts.find(item => String(item.provider || '').toLowerCase().includes(provider));
                const connected = !!account && account.connection_status === 'active';
                brokerStatus(element, connected, connected ? 'Connected' : account ? 'Menunggu EA' : 'Disconnected');
            });
        } catch (error) {
            // Jujur: broker tidak pernah ditandai "Connected" tanpa akun yang benar-benar tersambung.
            ['mt5', 'oanda', 'alpaca'].forEach(provider => {
                const element = document.querySelector(`[data-broker="${provider}"]`);
                if (element) brokerStatus(element, false, 'Status tidak tersedia');
            });
            console.info('[QIM] Status broker belum tersedia (demo):', error.message);
        }
    }

    function syncUserName() {
        let name = 'Trader';
        try {
            name = localStorage.getItem('qi_user_name') || sessionStorage.getItem('qi_user_name') || name;
            if (name === 'Trader') {
                const raw = localStorage.getItem('qi_user') || sessionStorage.getItem('qi_user');
                if (raw) {
                    const user = JSON.parse(raw);
                    name = user.name || user.email || name;
                }
            }
        } catch (error) { console.info('[QIM] Nama profil tidak tersedia:', error.message); }
        const target = document.getElementById('qimUserName');
        if (target) target.textContent = name;
        const avatar = document.querySelector('.qim-avatar');
        if (avatar) avatar.textContent = name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
    }


    // ─── News Signal Engine + Active Alerts & Guardrails ───────────────────
    // Data nyata dari api/calendar.php (kalender ekonomi). Tidak ada sinyal/angka rekaan:
    // kartu hanya menampilkan event High impact, hitung mundur, dan status blackout ±30 menit.
    const BLACKOUT_MENIT = 30;
    let calendarEvents = [];
    function eventTime(item) { const t = new Date(item.date).getTime(); return Number.isFinite(t) ? t : 0; }
    function dash(value) { return value && value !== '-' ? value : '—'; }
    function countdownText(ms) {
        const abs = Math.abs(ms);
        const m = Math.floor(abs / 60000);
        const text = m >= 1440 ? `${Math.floor(m / 1440)}h ${Math.floor((m % 1440) / 60)}j` : m >= 60 ? `${Math.floor(m / 60)}j ${m % 60}m` : `${m}m`;
        return ms >= 0 ? `dalam ${text}` : `${text} lalu`;
    }
    function renderEvents() {
        const list = document.getElementById('qimEventList');
        const guard = document.getElementById('qimGuardBody');
        if (!list || !guard) return;
        const now = Date.now();
        const high = calendarEvents.filter(e => String(e.impact).toLowerCase() === 'high').sort((a, b) => eventTime(a) - eventTime(b));
        const upcoming = high.filter(e => eventTime(e) >= now - BLACKOUT_MENIT * 60000);
        const shown = upcoming.length ? upcoming.slice(0, 3) : high.slice(-3).reverse();

        list.replaceChildren();
        if (!shown.length) list.append(node('div', 'qim-muted', 'Tidak ada event High impact di kalender minggu ini.'));
        shown.forEach((e, i) => {
            const ms = eventTime(e) - now;
            const hasActual = e.actual && e.actual !== '-';
            const row = node('a', 'qim-event' + (i === 0 && ms >= 0 && ms < 3600000 ? ' is-soon' : ''));
            row.href = '#';
            row.addEventListener('click', ev => { ev.preventDefault(); if (typeof window.switchPanel === 'function') window.switchPanel('panel-news'); });
            const badge = node('span', 'qim-event-ccy', e.currency || e.country || '—');
            const body = node('span', 'qim-event-body');
            body.append(node('b', '', e.title || 'Event ekonomi'));
            body.append(node('small', '', 'Forecast ' + dash(e.forecast) + ' · Prev ' + dash(e.previous) + (hasActual ? ' · Aktual ' + e.actual : '')));
            const side = node('span', 'qim-event-side');
            side.append(node('em', 'is-bearish', 'HIGH'));
            side.append(node('time', '', countdownText(ms)));
            row.append(badge, body, side);
            list.append(row);
        });
        const note = document.getElementById('qimEventNote');
        if (note) note.textContent = (upcoming.length ? 'Event High impact terdekat' : 'Tidak ada event mendatang — menampilkan yang terakhir') + ' · ForexFactory';

        // Guardrail: blackout berita ±30 menit di sekitar event High impact.
        const active = high.find(e => Math.abs(eventTime(e) - now) <= BLACKOUT_MENIT * 60000);
        guard.replaceChildren();
        const banner = node('div', 'qim-guard-banner ' + (active ? 'is-alert' : 'is-ok'));
        banner.append(node('span', 'qim-guard-icon', active ? '!' : '✓'));
        const text = node('span');
        if (active) {
            text.append(node('b', '', 'BLACKOUT BERITA AKTIF'),
                node('small', '', (active.currency || '') + ' ' + (active.title || '') + ' · ' + countdownText(eventTime(active) - now) + ' · sinyal mesin biasa ditahan ±' + BLACKOUT_MENIT + ' menit'));
        } else {
            const next = upcoming[0];
            text.append(node('b', '', 'Tidak ada blackout berita'),
                node('small', '', next ? 'Berikutnya: ' + (next.currency || '') + ' ' + (next.title || '') + ' ' + countdownText(eventTime(next) - now) : 'Tidak ada event High impact mendatang'));
        }
        banner.append(text);
        guard.append(banner);
        [['Filter berita ±' + BLACKOUT_MENIT + ' menit', 'Aktif', 'on'], ['Mode berita', 'Proteksi Ketat', 'on']].forEach(([label, value, tone]) => {
            const row = node('div', 'qim-guard-row');
            row.append(node('span', '', label), node('b', 'is-' + tone, value));
            guard.append(row);
        });
    }
    async function refreshEvents() {
        try {
            const response = await fetch('api/calendar.php', { cache: 'no-store' });
            if (!response.ok) throw new Error('HTTP ' + response.status);
            const result = await response.json();
            if (!result || result.status !== 'success' || !Array.isArray(result.data)) throw new Error('Format kalender tidak valid');
            calendarEvents = result.data;
            renderEvents();
        } catch (error) {
            const list = document.getElementById('qimEventList');
            if (list && !calendarEvents.length) list.replaceChildren(node('div', 'qim-muted', 'Kalender ekonomi belum tersedia.'));
            console.warn('[QIM] Kalender tidak dapat dimuat:', error.message);
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        syncUserName();
        bindWatchTabs();
        refreshPrices();
        refreshNews();
        refreshBrokerStatus();
        refreshAnalysis();
        refreshSignalFeed();
        refreshSimulation();
        refreshEvents();
        const hasPanelRoute = new URLSearchParams(window.location.search).has('panel') || !!window.location.hash;
        if (!hasPanelRoute && typeof window.switchPanel === 'function') {
            window.setTimeout(() => window.switchPanel('panel-charts'), 450);
        }
        window.setInterval(refreshPrices, 4000);
        window.setInterval(refreshNews, 300000);
        window.setInterval(refreshBrokerStatus, 60000);
        window.setInterval(() => refreshAnalysis(), 120000);
        window.setInterval(refreshSignalFeed, 120000);
        window.setInterval(refreshSimulation, 30000);
        window.setInterval(refreshEvents, 300000);
        window.setInterval(renderEvents, 30000);
    });

    document.addEventListener('qim:chart-symbol', event => {
        setPairSummary(event.detail && event.detail.symbol);
        document.querySelectorAll('#qimWatchlistRows .qim-watch-row').forEach(row => {
            const name = row.querySelector('.qim-watch-name b');
            row.classList.toggle('is-active', !!name && name.textContent === String(event.detail && event.detail.symbol || '').toUpperCase());
        });
        // Event ini ikut terpicu tiap tick harga; analisa hanya dimuat ulang bila simbolnya berganti.
        const symbol = String(event.detail && event.detail.symbol || '').toUpperCase();
        if (symbol && symbol !== analysisSymbol) refreshAnalysis(symbol);
    });
    document.addEventListener('qim:panel-change', event => {
        const panel = event.detail && event.detail.panel;
        // Paper Trading menyimpan posisi saat panelnya dipakai; segarkan saldo setelah keluar/masuk.
        if (panel === 'panel-paper' || panel === 'panel-charts') refreshSimulation();
        document.querySelectorAll('.qim-top-link').forEach(button => {
            button.classList.toggle('active', button.dataset.qimPanel === panel);
        });
    });
})();
