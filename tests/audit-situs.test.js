// Audit menyeluruh 2026-10-18: kontrak untuk bug yang ditemukan di log server, sapuan API, dan browser.
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
let gagal = 0;
function cek(nama, kondisi) { console.log((kondisi ? '  ✓ ' : '  ✗ ') + nama); if (!kondisi) gagal++; }

console.log('Server');
const lb = read('api/leaderboard.php');
cek('leaderboard: $rows diisi fetchAll sebelum dipakai (dulu selalu kosong + PHP Warning)', /\$rows = \$stmt->fetchAll\(PDO::FETCH_ASSOC\);\s*\n\s*\n?\$leaderboard = \[\];\s*\nforeach \(\$rows/.test(lb));
const cs = read('api/currency-strength.php');
cek('currency-strength: cache yang sedang ditulis tidak memunculkan Notice (baca dicek dulu)', /\$cached = @file_get_contents\(\$cacheFile\);/.test(cs) && !/echo file_get_contents\(\$cacheFile\)/.test(cs));
const hl = read('api/health.php');
cek('health: kunci opsional (Telegram, Google) tidak membuat 503 permanen', /api_keys_optional_missing/.test(hl) && !/\$missing\[\] = 'telegram'/.test(hl) && !/\$missing\[\] = 'google'/.test(hl));
cek('rate-limit cleanup tahan balapan: filemtime berkas yang baru dihapus permintaan lain tidak jadi PHP Warning', /\$mtime = @filemtime\(\$f\);[\s\S]{0,40}if \(\$mtime === false\) continue;/.test(read('api/_middleware.php')));
const cf = read('api/crypto-futures.php');
cek('Whale vs Retail: tidak ada angka karangan bila Binance Futures tidak terjangkau (dulu 51.2/48.8 · 58.5/41.5 + verdict palsu)', !/: 51\.2;|: 58\.5;|: 41\.5;|: 48\.8;/.test(cf) && /if \(!\$retail \|\| !\$whale\) \{[\s\S]{0,200}'ok' => false/.test(cf));
cek('Whale vs Retail: browser menampilkan "tidak tersedia" (bukan angka lama) saat ok:false', /if \(!j\.ok\) \{[\s\S]{0,900}j\.message/.test(read('assets/js/dashboard-app.js')));

cek('signals: label zona waktu mengikuti server (dulu "WIB" padahal UTC)', !/'Asia\/Jakarta \(WIB\)'/.test(read('api/signals.php')));

console.log('Posisi akun MT');
const pa = read('api/_posisi_akun.php');
cek('tabel trading_account_positions dibuat otomatis (dulu "migrasi 006" tidak pernah ada)', /CREATE TABLE IF NOT EXISTS trading_account_positions/.test(pa) && /share_positions/.test(pa));
cek('migrasi 025 tersimpan sebagai catatan skema', fs.existsSync(path.join(root, 'database/migrations/025_trading_account_positions.sql')));
const mb = read('api/mt-bridge.php');
cek('mt-bridge: skema disiapkan SEBELUM beginTransaction (DDL = commit implisit)', mb.indexOf('qi_posisi_akun_siapkan($pdo)') > 0 && mb.indexOf('qi_posisi_akun_siapkan($pdo)') < mb.indexOf('$pdo->beginTransaction()'));
cek('positions-feed & berbagi posisi memakai skema yang sama', /qi_posisi_akun_siapkan\(\$pdo\)/.test(read('api/positions-feed.php')) && /qi_posisi_akun_siapkan\(\$pdo\)/.test(read('api/account-connection.php')));

console.log('Kripto 24/7');
const gc = read('api/get-chart-data.php'), lp = read('api/live-price.php');
cek('chart kripto: candle OANDA/MT5 yang basi (akhir pekan) diganti Binance', /qi_candle_kripto_basi\(\$symbol, \$interval, \$candles\)/.test(gc) && gc.indexOf('qi_candle_kripto_basi(') < gc.indexOf("in_array($symbol, ['BTCUSDT'"));
cek('harga kripto: quote OANDA/MT5 yang tutup/basi dilepas supaya diisi Binance', /'closed' \|\| \(int\)\(\$row\['tick_age'\] \?\? 0\) > 900/.test(lp) && lp.indexOf("=== 'closed'") < lp.indexOf('CRYPTO via Binance'));

console.log('Browser');
const app = read('assets/js/dashboard-app.js');
cek('dashboard tidak memanggil api.binance.com langsung (diblokir DNS di Indonesia)', !/fetch\([^)]*api\.binance\.com/.test(app) && !/`https:\/\/api\.binance\.com\/api\/v3\/ticker\/price/.test(app));
const st = read('status.html');
cek('status: kalender dinilai dari status=success (dulu selalu "Degraded" karena bukan array)', /api\/calendar\.php',\s+key: 'status',\s+expect: 'success'/.test(st));
cek('status: AI dicek lewat ?ping=1 tanpa login (dulu POST anonim → 401 merah di konsol)', /api\/ai-chat\.php\?ping=1/.test(st) && !/post_only/.test(st) && /isset\(\$_GET\['ping'\]\)/.test(read('api/ai-chat.php')));
const ai = read('api/ai-chat.php');
cek('ai-chat: ping dijawab sebelum wajib login & sebelum memanggil Groq', ai.indexOf("isset($_GET['ping'])") < ai.indexOf("qi_require_level('pro')"));
cek('favicon.ico ada (dulu 404 di setiap kunjungan)', (() => { try { const b = fs.readFileSync(path.join(root, 'favicon.ico')); return b.readUInt16LE(2) === 1 && b.readUInt16LE(4) >= 1; } catch (e) { return false; } })());
cek('index.html memakai meta mobile-web-app-capable (yang apple- saja sudah usang)', /name="mobile-web-app-capable"/.test(read('index.html')));

console.log(gagal ? `\nFAIL — ${gagal} kontrak audit dilanggar` : '\nPASS — audit situs: server, posisi akun, kripto 24/7, browser');
process.exit(gagal ? 1 : 0);
