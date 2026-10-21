// Klik watchlist harus selalu memunculkan chart: kode `tv` tiap simbol di watchlist kolom kiri
// (qim-dashboard.js) HARUS sama dengan kode yang dicari chart (WL_GROUPS di dashboard-app.js),
// dan setChartSymbolFull menormalkannya bila ada pemanggil dengan kode lama.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const dash = fs.readFileSync(path.join(root, 'assets/js/qim-dashboard.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'assets/js/dashboard-app.js'), 'utf8');

let gagal = 0;
function cek(nama, kondisi, info) { console.log((kondisi ? '  ✓ ' : '  ✗ ') + nama + (kondisi || info === undefined ? '' : '  ' + JSON.stringify(info))); if (!kondisi) gagal++; }

const kiri = [...dash.matchAll(/\{ group: '[a-z]+', symbol: '([A-Z0-9]+)'[^}]*?tv: '([^']+)'(?:, chartSupported: (false))?/g)]
    .map(m => ({ key: m[1], tv: m[2], chart: m[3] !== 'false' }));
const chart = Object.fromEntries([...app.matchAll(/\{ label:'[^']+', key:'([A-Z0-9]+)',\s*tv:'([^']+)' \}/g)].map(m => [m[1], m[2]]));

cek('daftar watchlist kiri terbaca', kiri.length >= 14, kiri.length);
cek('daftar simbol chart terbaca', Object.keys(chart).length >= 14, Object.keys(chart).length);
const beda = kiri.filter(k => k.chart && chart[k.key] !== undefined && chart[k.key] !== k.tv);
cek('kode tv watchlist = kode tv chart untuk semua simbol', beda.length === 0, beda);
const hilang = kiri.filter(k => k.chart && chart[k.key] === undefined);
cek('setiap simbol watchlist yang bisa dicharting ada di chart', hilang.length === 0, hilang);
// BTC dilabeli "BTC/USDT" dan harganya diambil dari api/live-price.php untuk kunci
// BTCUSDT (Binance). Dulu kedua daftar memetakannya ke CFD 'OANDA:BTCUSD' — instrumen
// LAIN dengan harga lain — sehingga chart tidak cocok dengan angka di tape.
cek('BTCUSDT memakai BINANCE:BTCUSDT di kedua daftar (cocok dengan sumber harganya)',
    chart.BTCUSDT === 'BINANCE:BTCUSDT' && (kiri.find(k => k.key === 'BTCUSDT') || {}).tv === 'BINANCE:BTCUSDT',
    { chart: chart.BTCUSDT, kiri: (kiri.find(k => k.key === 'BTCUSDT') || {}).tv });

// Perilaku: setChartSymbolFull memakai tv milik chart walau pemanggil membawa kode lama.
const a = app.indexOf('function setChartSymbolFull(');
let d = 0, i = app.indexOf('{', a);
for (; i < app.length; i++) { if (app[i] === '{') d++; else if (app[i] === '}') { d--; if (d === 0) break; } }
const fn = app.slice(a, i + 1);
const f = new Function('WL_GROUPS', 'updateChartHeader', 'renderWatchlist', 'buildLwChart',
    'let _tvSymbol = "", _tvSymLabel = ""; ' + fn + '; return { set: setChartSymbolFull, tv: () => _tvSymbol, label: () => _tvSymLabel };');
const grup = [{ syms: Object.entries(chart).map(([key, tv]) => ({ key, tv, label: key })) }];
let dibangun = 0;
const api = f(grup, () => {}, () => {}, () => { dibangun++; });
api.set('BTCUSDT', 'OANDA:BTCUSD', 'BTC/USDT');
cek('klik BTCUSDT dengan kode lama OANDA:BTCUSD → chart menormalkan ke BINANCE:BTCUSDT', api.tv() === 'BINANCE:BTCUSDT' && dibangun === 1, api.tv());
api.set('ETHUSDT', 'BINANCE:ETHUSDT', 'ETH/USDT');
cek('ETHUSDT tetap BINANCE:ETHUSDT', api.tv() === 'BINANCE:ETHUSDT');
api.set('ZZZ', 'X:ZZZ', 'ZZZ');
cek('simbol yang tak dikenal tetap memakai kode pemanggil', api.tv() === 'X:ZZZ');

if (gagal) { console.error('\nFAIL — ' + gagal + ' pemeriksaan gagal'); process.exit(1); }
console.log('\nPASS — klik watchlist memunculkan chart (kode tv sinkron)');
