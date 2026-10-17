/**
 * QIM TradingView Bridge Server (Node.js)
 * Menggunakan @mathieuc/tradingview v4
 *
 * Endpoints:
 *   - REST: GET /candles?symbol=BTCUSDT&exchange=BINANCE&tf=5m&limit=500
 *   - REST: GET /search?q=gold&exchange=OANDA
 *   - REST: GET /health
 *   - WS  : ws://localhost:3001/ws?symbol=BTCUSDT&exchange=BINANCE&tf=5m
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { WebSocketServer, WebSocket } = require('ws');
const url = require('url');

// Library TradingView-API v4 adalah modul ESM. require() hanya bisa memuat ESM di Node >= 22.12 (dan
// 20.19+), jadi dimuat dengan import() dinamis supaya jalan di semua Node 18+ (mis. 20.18 di VPS).
// Fungsi dipakai hanya saat ada permintaan; server baru listen setelah library selesai dimuat.
let getCandles, searchMarkets, getQuotes, watchQuotes, getTechnicalAnalysis, getScreener, watchCandles, TradingViewError;
const tradingViewReady = import('@mathieuc/tradingview').then((mod) => {
  ({ getCandles, searchMarkets, getQuotes, watchQuotes, getTechnicalAnalysis, getScreener, watchCandles, TradingViewError } = mod);
});

const app = express();
const server = http.createServer(app);
const PORT = process.env.TV_BRIDGE_PORT || 3001;
// Default hanya menerima koneksi dari mesin ini. Untuk bridge di VPS yang dipanggil PHP dari
// hosting lain: pasang reverse proxy HTTPS di depannya (lihat README) dan WAJIB isi BRIDGE_KEY.
const HOST = process.env.TV_BRIDGE_HOST || '127.0.0.1';
const BRIDGE_KEY = process.env.BRIDGE_KEY || '';
const crypto = require('crypto');

function keyOk(provided) {
  if (!BRIDGE_KEY) return true;
  const a = Buffer.from(String(provided || ''));
  const b = Buffer.from(BRIDGE_KEY);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Tanpa BRIDGE_KEY (pengembangan lokal) CORS tetap terbuka seperti semula; dengan kunci,
// bridge hanya untuk panggilan server-ke-server dari PHP.
if (!BRIDGE_KEY) app.use(cors());
app.use((req, res, next) => {
  if (req.path === '/health' || keyOk(req.get('x-bridge-key'))) return next();
  res.status(401).json({ ok: false, error: 'Kunci bridge salah atau tidak ada' });
});
app.use(express.json());

// ── Mapping Exchange ──────────────────────────────────────────────────────────
const EXCHANGE_MAP = {
  // Crypto
  BINANCE  : 'BINANCE',
  BYBIT    : 'BYBIT',
  COINBASE : 'COINBASE',
  // Forex
  OANDA    : 'OANDA',
  FOREX    : 'OANDA',
  FX       : 'OANDA',
  FX_IDC   : 'FX_IDC',
  // Stock US
  NASDAQ   : 'NASDAQ',
  NYSE     : 'NYSE',
  AMEX     : 'AMEX',
  // Stock ID (Saham Indonesia)
  IDX      : 'IDX',
  // Commodity
  COMEX    : 'COMEX',
  NYMEX    : 'NYMEX',
  TVC      : 'TVC',
  CBOT     : 'CBOT',
};

function resolveExchange(exchange) {
  const key = (exchange || 'BINANCE').toUpperCase();
  return EXCHANGE_MAP[key] || key;
}

/**
 * Mapping timeframe ke format TradingView v4:
 * 1m -> '1', 5m -> '5', 15m -> '15', 1h -> '60', 4h -> '240', 1D -> '1D', 1W -> '1W'
 */
function resolveTF(tf) {
  const map = {
    '1m' : '1',
    '3m' : '3',
    '5m' : '5',
    '15m': '15',
    '30m': '30',
    '1h' : '60',
    '2h' : '120',
    '4h' : '240',
    '1D' : '1D',
    '1d' : '1D',
    'D'  : '1D',
    '1W' : '1W',
    '1w' : '1W',
    'W'  : '1W',
    '1M' : '1M',
    'M'  : '1M',
  };
  return map[tf] || tf || '5';
}

function buildFullSymbol(symbol, exchange) {
  const ex = resolveExchange(exchange);
  const sym = (symbol || 'BTCUSDT').toUpperCase().replace(/^[A-Z0-9_]+:/, '');
  return `${ex}:${sym}`;
}

// ── REST: GET /health ────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    quoteStream: quoteWatcherReady,
    quoteAgeMs: quoteLastData ? Date.now() - quoteLastData : null,
    engine: '@mathieuc/tradingview v4',
    port: PORT,
    timestamp: new Date().toISOString()
  });
});

// ── REST: GET /candles ───────────────────────────────────────────────────────
app.get('/candles', async (req, res) => {
  const { symbol = 'BTCUSDT', exchange = 'BINANCE', tf = '5m', limit = 300 } = req.query;
  const fullSymbol = buildFullSymbol(symbol, exchange);
  const timeframe = resolveTF(tf);
  const amount = Math.min(Math.max(parseInt(limit, 10) || 300, 10), 1000);

  try {
    const rawCandles = await getCandles({
      symbol: fullSymbol,
      timeframe,
      count: amount
    });

    if (!Array.isArray(rawCandles) || rawCandles.length === 0) {
      return res.status(404).json({
        ok: false,
        error: `Tidak ada data candle untuk ${fullSymbol} (tf: ${tf})`,
        symbol: fullSymbol
      });
    }

    // Format candle ke format standar Lightweight Charts
    const candles = rawCandles.map(c => ({
      time: Math.floor(c.time),
      open: Number(c.open),
      high: Number(c.high),
      low: Number(c.low),
      close: Number(c.close),
      volume: Number(c.volume || 0)
    })).sort((a, b) => a.time - b.time);

    res.json({
      ok: true,
      symbol: fullSymbol,
      tf,
      timeframe,
      count: candles.length,
      candles
    });
  } catch (err) {
    console.error(`[REST /candles] Error ${fullSymbol}:`, err.message || err);
    res.status(500).json({
      ok: false,
      error: err.message || 'Gagal mengambil data candle',
      symbol: fullSymbol
    });
  }
});

// ── Harga tick: watcher permanen + REST /quotes ─────────────────────────────
// Dulu setiap panggilan /quotes membuka koneksi TradingView baru (getQuotes) → 1–3 detik per
// permintaan. Sekarang SATU koneksi streaming (watchQuotes) dibiarkan terbuka untuk semua
// pasangan OANDA; /quotes membaca tick terakhir dari memori (milidetik) dan getQuotes hanya
// dipakai sebagai cadangan untuk simbol di luar daftar / saat watcher belum siap.
const WATCH_BASE = ['XAUUSD', 'BTCUSD', 'EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'NZDUSD', 'USDCHF',
                    'USDCAD', 'GBPJPY', 'EURJPY', 'EURGBP', 'AUDNZD', 'CHFJPY', 'CADJPY'];
const WATCH_SYMBOLS = WATCH_BASE.map(s => 'OANDA:' + s);
let quoteWatcher = null;
let quoteWatcherReady = false;
let quoteWatcherBackoff = 2000;
let quoteLastData = 0;

function formatQuote(full, q) {
  const nowSec = Math.floor(Date.now() / 1000);
  const num = v => (v != null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : null);
  const lpTime = num(q.lp_time);
  return {
    symbol: full,
    price: Number(q.lp),
    bid: num(q.bid), ask: num(q.ask),
    open: num(q.open_price), high: num(q.high_price), low: num(q.low_price),
    prevClose: num(q.prev_close_price),
    change: num(q.ch), chgPct: num(q.chp), volume: num(q.volume),
    time: lpTime,
    age: lpTime != null ? Math.max(0, nowSec - lpTime) : null,   // detik sejak tick terakhir
    session: q.current_session || null                            // market | out_of_session | pre_market …
  };
}

async function startQuoteWatcher() {
  quoteWatcherReady = false;
  try { if (quoteWatcher) await quoteWatcher.stop(); } catch (_) {}
  quoteWatcher = null;
  try {
    const w = await watchQuotes({ symbols: WATCH_SYMBOLS, fields: 'all', timeoutMs: 20000 }, {
      onData() { quoteLastData = Date.now(); },
      onError(err) {
        const msg = err && (err.message || err.code) || String(err);
        console.warn('[quote-watcher]', msg);
        if (/DISCONNECT|CLOSED/i.test(msg) && quoteWatcher === w) scheduleWatcherRestart();
      }
    });
    quoteWatcher = w;
    quoteWatcherReady = true;
    quoteWatcherBackoff = 2000;
    quoteLastData = Date.now();
    console.log(`[quote-watcher] streaming ${WATCH_SYMBOLS.length} simbol OANDA`);
  } catch (err) {
    console.error('[quote-watcher] gagal mulai:', err.message || err);
    scheduleWatcherRestart();
  }
}
let watcherRestartTimer = null;
function scheduleWatcherRestart() {
  quoteWatcherReady = false;
  if (watcherRestartTimer) return;
  watcherRestartTimer = setTimeout(() => { watcherRestartTimer = null; startQuoteWatcher(); }, quoteWatcherBackoff);
  quoteWatcherBackoff = Math.min(quoteWatcherBackoff * 2, 60000);
}
// Pengaman: bila pasar buka tetapi tidak ada tick >2 menit, sambungkan ulang.
setInterval(() => {
  if (!quoteWatcherReady || !quoteWatcher) return;
  const latest = quoteWatcher.latest || {};
  const open = Object.values(latest).some(q => q && q.current_session === 'market');
  if (open && Date.now() - quoteLastData > 120000) { console.warn('[quote-watcher] tick macet, sambung ulang'); scheduleWatcherRestart(); }
}, 30000);

const quoteCache = new Map();
app.get('/quotes', async (req, res) => {
  const { exchange = 'OANDA', symbols = '' } = req.query;
  const list = [...new Set(String(symbols).split(',').map(s => s.trim().toUpperCase()).filter(Boolean))].slice(0, 30);
  if (!list.length) return res.status(400).json({ ok: false, error: 'Parameter symbols diperlukan' });
  const fulls = list.map(s => buildFullSymbol(s, exchange));

  // 1) Dari watcher permanen (tanpa jaringan) bila semua simbol yang diminta sudah ada.
  if (quoteWatcherReady && quoteWatcher && quoteWatcher.latest) {
    const latest = quoteWatcher.latest;
    if (fulls.every(f => latest[f] && Number(latest[f].lp) > 0)) {
      const quotes = {};
      list.forEach((s, i) => { quotes[s] = formatQuote(fulls[i], latest[fulls[i]]); });
      return res.json({ ok: true, count: list.length, via: 'stream', quotes });
    }
  }

  // 2) Cadangan: satu getQuotes (snapshot), di-cache 2 detik.
  const key = resolveExchange(exchange) + '|' + list.join(',');
  const hit = quoteCache.get(key);
  if (hit && Date.now() - hit.at < 2000) return res.json(hit.body);
  try {
    const raw = await getQuotes({ symbols: fulls, fields: 'all', timeoutMs: 12000 });
    const quotes = {};
    list.forEach((s, i) => {
      const q = raw && raw[fulls[i]];
      if (q && Number(q.lp) > 0) quotes[s] = formatQuote(fulls[i], q);
    });
    const body = { ok: true, count: Object.keys(quotes).length, via: 'snapshot', quotes };
    quoteCache.set(key, { at: Date.now(), body });
    res.json(body);
  } catch (err) {
    console.error('[REST /quotes] Error:', err.message || err);
    if (hit) return res.json(hit.body);
    res.status(500).json({ ok: false, error: err.message || 'Gagal mengambil quote' });
  }
});

// ── REST: GET /ta?symbols=EURUSD,XAUUSD,BTCUSDT ──────────────────────────────
// Rating teknikal TradingView per timeframe lewat library (getTechnicalAnalysis).
// Skala library -2..2 dibagi 2 → skala -1..1 yang sama dengan scanner TradingView
// (ambang BUY ≥ 0,1 / STRONG ≥ 0,5). Forex & emas dari OANDA. OANDA tidak punya data TA untuk
// BTC, jadi BTC memakai BINANCE:BTCUSDT dan ditandai lewat field "ticker".
const TA_TFS = ['15', '60', '240', '1D'];
const taCache = new Map();
function taTicker(sym) {
  const s = sym.toUpperCase();
  if (s === 'BTCUSD' || s === 'BTCUSDT') return 'BINANCE:BTCUSDT';
  if (/(USDT|USDC)$/.test(s)) return `BINANCE:${s}`;
  return `OANDA:${s}`;
}
app.get('/ta', async (req, res) => {
  const list = [...new Set(String(req.query.symbols || '').split(',').map(s => s.trim().toUpperCase()).filter(Boolean))].slice(0, 30);
  if (!list.length) return res.status(400).json({ ok: false, error: 'Parameter symbols diperlukan' });

  const one = async (sym) => {
    const ticker = taTicker(sym);
    const hit = taCache.get(ticker);
    if (hit && Date.now() - hit.at < 30000) return hit.data;
    try {
      const r = await getTechnicalAnalysis(ticker);
      if (!r) return hit ? hit.data : null;
      const tfs = {};
      for (const tf of TA_TFS) {
        const x = r[tf];
        if (!x || typeof x.All !== 'number') continue;
        tfs[tf] = { all: +(x.All / 2).toFixed(4), ma: +(x.MA / 2).toFixed(4), osc: +(x.Other / 2).toFixed(4) };
      }
      if (!Object.keys(tfs).length) return null;
      const data = { ticker, timeframes: tfs };
      taCache.set(ticker, { at: Date.now(), data });
      return data;
    } catch (err) {
      console.error(`[REST /ta] ${ticker}:`, err.message || err);
      return hit ? hit.data : null;
    }
  };

  const out = {};
  // Bertahap (5 sekaligus) supaya tidak membanjiri endpoint TradingView.
  for (let i = 0; i < list.length; i += 5) {
    const chunk = list.slice(i, i + 5);
    const rs = await Promise.all(chunk.map(one));
    chunk.forEach((s, j) => { if (rs[j]) out[s] = rs[j]; });
  }
  res.json({ ok: true, count: Object.keys(out).length, ta: out });
});

// ── REST: POST /scan  (body = format scanner TradingView) ───────────────────
// Body: { "symbols": { "tickers": ["OANDA:EURUSD"] }, "columns": ["close","RSI",...] }
// Dijalankan lewat library (getScreener) dan dijawab dalam bentuk scanner persis
// { totalCount, data:[{ s, d:[nilai sesuai urutan kolom] }] } — supaya kode PHP lama cukup
// mengganti alamatnya. Bila kolom tidak dikenal TradingView → 502 (pemanggil fallback).
app.post('/scan', async (req, res) => {
  const tickers = req.body && req.body.symbols && req.body.symbols.tickers;
  const columns = req.body && req.body.columns;
  if (!Array.isArray(tickers) || !tickers.length || !Array.isArray(columns) || !columns.length) {
    return res.status(400).json({ ok: false, error: 'symbols.tickers dan columns wajib diisi' });
  }
  const t = tickers.map(String).slice(0, 40);
  const cols = [...new Set(columns.map(String))];
  try {
    const page = await getScreener({ symbols: t, columns: cols, range: [0, t.length] });
    const data = (page.rows || []).map(r => ({
      s: r.symbol,
      d: columns.map(c => (r.values && r.values[c] !== undefined ? r.values[c] : null))
    }));
    res.json({ totalCount: page.totalCount, data });
  } catch (err) {
    console.error('[REST /scan] Error:', err.message || err);
    res.status(502).json({ ok: false, error: err.message || 'Scan gagal' });
  }
});

// ── REST: GET /search ────────────────────────────────────────────────────────
app.get('/search', async (req, res) => {
  const { q = '', exchange = '' } = req.query;
  if (!q.trim()) {
    return res.status(400).json({ ok: false, error: 'Query q diperlukan' });
  }

  try {
    const query = q.trim();
    const options = {};
    if (exchange) {
      options.exchange = resolveExchange(exchange);
    }

    const items = await searchMarkets(query, options);

    const results = (items || []).map(item => ({
      id: item.id,
      symbol: item.symbol,
      exchange: item.exchange,
      fullExchange: item.fullExchange || item.exchange,
      description: item.description || '',
      type: item.type || '',
      currency: item.currency || ''
    }));

    res.json({
      ok: true,
      query,
      count: results.length,
      results
    });
  } catch (err) {
    console.error(`[REST /search] Error ${q}:`, err.message || err);
    res.status(500).json({
      ok: false,
      error: err.message || 'Gagal mencari pasar'
    });
  }
});

// ── WebSocket: /ws ───────────────────────────────────────────────────────────
const wss = new WebSocketServer({
  server,
  path: '/ws',
  verifyClient: (info) => keyOk(info.req.headers['x-bridge-key'] || new URLSearchParams(url.parse(info.req.url).query).get('key'))
});

wss.on('connection', (ws, req) => {
  const params = new URLSearchParams(url.parse(req.url).query);
  let currentSymbol = buildFullSymbol(params.get('symbol') || 'BTCUSDT', params.get('exchange') || 'BINANCE');
  let currentTF = resolveTF(params.get('tf') || '5m');

  let watcher = null;
  let isAlive = true;

  ws.on('pong', () => { isAlive = true; });

  const heartbeat = setInterval(() => {
    if (!isAlive) {
      ws.terminate();
      return;
    }
    isAlive = false;
    ws.ping();
  }, 25000);

  function stopWatcher() {
    if (watcher) {
      try { watcher.close(); } catch (_) {}
      watcher = null;
    }
  }

  function startWatcher(symbol, tf) {
    stopWatcher();
    currentSymbol = symbol;
    currentTF = tf;

    try {
      watcher = watchCandles(
        { symbol: currentSymbol, timeframe: currentTF },
        {
          onData: (data) => {
            if (ws.readyState !== WebSocket.OPEN) return;

            // data bisa berupa array candle atau single candle
            const lastCandle = Array.isArray(data) ? data[data.length - 1] : data;
            if (!lastCandle) return;

            const payload = {
              type: 'candle',
              symbol: currentSymbol,
              tf: currentTF,
              candle: {
                time: Math.floor(lastCandle.time),
                open: Number(lastCandle.open),
                high: Number(lastCandle.high),
                low: Number(lastCandle.low),
                close: Number(lastCandle.close),
                volume: Number(lastCandle.volume || 0)
              }
            };
            ws.send(JSON.stringify(payload));
          },
          onError: (err) => {
            console.warn(`[WS watchCandles error ${currentSymbol}]:`, err?.message || err);
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'error', message: err?.message || 'Watcher error' }));
            }
          }
        }
      );

      ws.send(JSON.stringify({
        type: 'subscribed',
        symbol: currentSymbol,
        tf: currentTF
      }));
    } catch (err) {
      console.error(`[WS startWatcher error ${currentSymbol}]:`, err.message || err);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'error', message: err.message }));
      }
    }
  }

  // Mulai streaming pertama kali
  startWatcher(currentSymbol, currentTF);

  // Terima pesan ganti simbol/tf dari client
  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.action === 'subscribe' && msg.symbol) {
        const newSym = buildFullSymbol(msg.symbol, msg.exchange || 'BINANCE');
        const newTF = resolveTF(msg.tf || currentTF);
        startWatcher(newSym, newTF);
      }
    } catch (_) {}
  });

  ws.on('close', () => {
    clearInterval(heartbeat);
    stopWatcher();
  });

  ws.on('error', () => {
    clearInterval(heartbeat);
    stopWatcher();
  });
});

// ── Error resilience handlers ────────────────────────────────────────────────
process.on('uncaughtException', (err) => {
  console.error('[tv-bridge uncaughtException]:', err?.message || err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[tv-bridge unhandledRejection]:', reason?.message || reason);
});

// ── Jalankan Server ──────────────────────────────────────────────────────────
tradingViewReady.then(() => {
server.listen(PORT, HOST, () => {
  startQuoteWatcher();
  if (HOST !== '127.0.0.1' && HOST !== 'localhost' && !BRIDGE_KEY) {
    console.warn('  ! PERINGATAN: bridge terbuka di ' + HOST + ' tanpa BRIDGE_KEY. Isi BRIDGE_KEY di .env.');
  }
  console.log(`\n=================================================`);
  console.log(`  QIM TradingView Engine v4 (@mathieuc/tradingview)`);
  console.log(`=================================================`);
  console.log(`  Listen: ${HOST}:${PORT}  ·  kunci: ${BRIDGE_KEY ? 'AKTIF' : 'tidak dipakai'}`);
  console.log(`  REST  : http://localhost:${PORT}/candles`);
  console.log(`  REST  : http://localhost:${PORT}/search`);
  console.log(`  WS    : ws://localhost:${PORT}/ws`);
  console.log(`=================================================\n`);
});
}).catch((err) => {
  console.error('[tv-bridge] gagal memuat library @mathieuc/tradingview:', err && err.message || err);
  process.exit(1);
});
