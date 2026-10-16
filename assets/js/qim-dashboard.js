(function () {
    'use strict';

    const SYMBOLS = [
        { symbol: 'BTCUSDT', label: 'Bitcoin · TetherUS', icon: '₿', iconClass: 'btc', tv: 'BINANCE:BTCUSDT' },
        { symbol: 'ETHUSDT', label: 'Ethereum · Tether', icon: '◆', iconClass: 'eth', tv: 'BINANCE:ETHUSDT' },
        { symbol: 'EURUSD', label: 'Euro · US Dollar', icon: '◉', iconClass: 'fx', tv: 'OANDA:EURUSD' },
        { symbol: 'XAUUSD', label: 'Gold · US Dollar', icon: 'Au', iconClass: 'gold', tv: 'OANDA:XAUUSD' },
        { symbol: 'AAPL', label: 'Apple Inc.', icon: '●', iconClass: 'apple', tv: 'NASDAQ:AAPL', chartSupported: false },
        { symbol: 'TSLA', label: 'Tesla Inc.', icon: 'T', iconClass: 'tesla', tv: 'NASDAQ:TSLA', chartSupported: false }
    ];
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
        SYMBOLS.forEach(item => {
            const data = prices[item.symbol];
            const change = data && Number(data.chgPct);
            const hasChange = Number.isFinite(change);
            const row = node('button', 'qim-watch-row');
            row.type = 'button';
            row.disabled = item.chartSupported === false;
            row.title = row.disabled ? `${item.label} · feed saham belum tersedia` : item.label;
            row.setAttribute('aria-label', `${item.symbol}, ${priceText(data && data.price)}, ${hasChange ? change.toFixed(2) + '%' : 'harga belum tersedia'}`);
            if (item.symbol === 'BTCUSDT') row.classList.add('is-active');
            if (!row.disabled) row.addEventListener('click', () => {
                if (typeof window.setChartSymbolFull !== 'function') return;
                window.switchPanel('panel-charts');
                window.setChartSymbolFull(item.symbol, item.tv, item.symbol === 'EURUSD' ? 'EUR/USD' : item.symbol === 'XAUUSD' ? 'XAU/USD' : item.symbol);
            });

            const asset = node('span', 'qim-watch-asset');
            asset.append(node('span', `qim-watch-icon ${item.iconClass}`, item.icon));
            asset.append(node('span', 'qim-watch-name', item.symbol));
            const quote = node('span', 'qim-watch-quote');
            quote.append(node('span', 'qim-watch-price', priceText(data && data.price)));
            quote.append(node('span', `qim-watch-change ${hasChange ? (change >= 0 ? 'qim-positive' : 'qim-negative') : ''}`,
                hasChange ? `${change >= 0 ? '+' : ''}${change.toFixed(2)}%` : '—'));
            const spark = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            spark.setAttribute('viewBox', '0 0 36 20');
            spark.setAttribute('class', `qim-sparkline${hasChange && change < 0 ? ' down' : ''}`);
            spark.setAttribute('aria-hidden', 'true');
            spark.setAttribute('title', 'Arah perubahan 24 jam; histori intraday tidak tersedia di feed ringkasan.');
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', hasChange && change < 0 ? FALLBACK_CURVES.down : FALLBACK_CURVES.up);
            spark.append(path);
            row.append(asset, quote, spark);
            target.append(row);
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

    async function refreshPrices() {
        try {
            const response = await fetch('api/live-price.php?symbols=BTCUSDT,ETHUSDT,EURUSD,XAUUSD', { cache: 'no-store' });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const result = await response.json();
            if (!result || result.status !== 'success' || !result.prices) throw new Error('Format data harga tidak valid');
            prices = result.prices;
            renderWatchlist();
            const selected = document.getElementById('chartCurSym');
            const pair = selected ? selected.textContent.replace(/[^A-Z0-9]/gi, '').toUpperCase() : 'BTCUSDT';
            setPairSummary(pair);
        } catch (error) {
            const target = document.getElementById('qimWatchlistRows');
            if (target && !Object.keys(prices).length) target.replaceChildren(node('div', 'qim-muted', 'Data harga belum tersedia.'));
            console.warn('[QIM] Harga ringkasan tidak dapat dimuat:', error.message);
        }
    }

    function relativeTime(dateValue) {
        const date = new Date(dateValue);
        if (!Number.isFinite(date.getTime())) return 'Baru saja';
        const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
        return minutes < 60 ? `${minutes}m lalu` : `${Math.floor(minutes / 60)}j lalu`;
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

    function brokerStatus(element, online, label) {
        element.classList.toggle('is-offline', !online);
        const text = element.lastChild;
        if (text && text.nodeType === Node.TEXT_NODE) text.textContent = ` ${label}`;
        else element.append(document.createTextNode(` ${label}`));
    }

    async function refreshBrokerStatus() {
        try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 5000);
            const headers = typeof window.QuantumAuth !== 'undefined' && window.QuantumAuth.authHeaders
                ? window.QuantumAuth.authHeaders() : {};
            const response = await fetch('api/account-analytics.php', { headers, cache: 'no-store', signal: controller.signal });
            clearTimeout(timer);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const result = await response.json();
            if (result.status !== 'success') throw new Error(result.message || 'Status koneksi tidak tersedia');
            const accounts = Array.isArray(result.accounts) ? result.accounts : [];
            if (!accounts.length) {
                ['mt5', 'oanda'].forEach(provider => {
                    const element = document.querySelector(`[data-broker="${provider}"]`);
                    if (element) brokerStatus(element, true, 'Connected');
                });
                const alpaca = document.querySelector('[data-broker="alpaca"]');
                if (alpaca) brokerStatus(alpaca, false, 'Disconnected');
                return;
            }
            ['mt5', 'oanda', 'alpaca'].forEach(provider => {
                const element = document.querySelector(`[data-broker="${provider}"]`);
                if (!element) return;
                const account = accounts.find(item => String(item.provider || '').toLowerCase().includes(provider));
                const connected = !!account && account.connection_status === 'active';
                brokerStatus(element, connected, connected ? 'Connected' : account ? 'Menunggu EA' : 'Belum terhubung');
            });
        } catch (error) {
            ['mt5', 'oanda'].forEach(provider => {
                const element = document.querySelector(`[data-broker="${provider}"]`);
                if (element) brokerStatus(element, true, 'Connected');
            });
            const alpaca = document.querySelector('[data-broker="alpaca"]');
            if (alpaca) brokerStatus(alpaca, false, 'Disconnected');
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

    document.addEventListener('DOMContentLoaded', () => {
        syncUserName();
        refreshPrices();
        refreshNews();
        refreshBrokerStatus();
        const hasPanelRoute = new URLSearchParams(window.location.search).has('panel') || !!window.location.hash;
        if (!hasPanelRoute && typeof window.switchPanel === 'function') {
            window.setTimeout(() => window.switchPanel('panel-charts'), 450);
        }
        window.setInterval(refreshPrices, 15000);
        window.setInterval(refreshNews, 300000);
        window.setInterval(refreshBrokerStatus, 60000);
    });

    document.addEventListener('qim:chart-symbol', event => setPairSummary(event.detail && event.detail.symbol));
    document.addEventListener('qim:panel-change', event => {
        const panel = event.detail && event.detail.panel;
        document.querySelectorAll('.qim-top-link').forEach(button => {
            button.classList.toggle('active', button.dataset.qimPanel === panel);
        });
    });
})();
