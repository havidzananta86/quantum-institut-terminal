const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
let failed = 0;
function check(label, ok, detail = '') { if (ok) console.log('  ✓ ' + label); else { failed += 1; console.error('  ✗ ' + label + (detail ? ' — ' + detail : '')); } }

const dashboard = read('dashboard.html');
const features = read('assets/js/qim-terminal-features.js');
const bridge = read('quantum-terminal/embed/qt-signal-bridge.js');
const alerts = read('api/price-alerts.php');
const proxy = read('api/binance-proxy.php');

check('Tools tab restores alert, journal, track record, and Pine controls', ['qtPanel-tools', 'qtAlertCard', 'qtJournalCard', 'qtTrackCard', 'qtPineCard'].every(id => dashboard.includes('id="' + id + '"')));
check('unbridged Order and Magnet launchers are removed', !/id="qtOrderLauncher"/.test(dashboard) && !/id="qtChartCrosshair"/.test(dashboard));
check('Backtest is marked as a PRO feature', /data-pro-feature="backtest"/.test(dashboard) && /Backtest/.test(features) && /requirePro/.test(features));
check('server price alerts require PRO', /\$pengguna\s*=\s*qi_require_level\('pro'\)/.test(alerts));
check('Binance proxy only permits the five widget REST routes', ['/api/v3/exchangeInfo', '/api/v3/ticker/24hr', '/api/v3/klines', '/api/v3/aggTrades', '/api/v3/depth'].every(route => proxy.includes("'" + route + "'")) && /BINANCE_ROUTE_NOT_ALLOWED/.test(proxy) && /parse_str/.test(proxy) && /embeddedQuery/.test(proxy));
check('Pine overlay messages are bridged to the vendor chart', /qt-pine-overlay/.test(features) && /qt-pine-overlay/.test(bridge) && /qt-pine-position/.test(bridge));

const vendorRoot = path.join(root, 'quantum-terminal', '_app');
let vendor = '';
function walk(dir) { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) { const file = path.join(dir, entry.name); if (entry.isDirectory()) walk(file); else if (entry.isFile() && file.endsWith('.js')) vendor += fs.readFileSync(file, 'utf8'); } }
walk(vendorRoot);
check('embedded vendor has no direct Binance REST or WebSocket host', !/api\.binance\.com|stream\.binance\.com|data-api\.binance|api1\.binance/.test(vendor));
check('embedded Binance adapter uses same-origin REST polling', /binance-proxy\.php\?path=\/api\/v3/.test(vendor) && /startPolling\(\)/.test(vendor));

if (failed) { console.error('\n' + failed + ' terminal tools contract check(s) failed'); process.exit(1); }
console.log('\nPASS — terminal tools, PRO gates, and Binance proxy contracts hold');
