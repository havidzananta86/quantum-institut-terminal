/**
 * Akses feed broker MT5 + kejujuran label sumbernya.
 *
 * Kebijakan akses diatur SATU konstanta produksi, QI_MT5_BRIDGE_AUDIENCE:
 *   'owner' (bawaan) → hanya pemilik akun bridge + admin
 *   'pro'            → semua PRO/VIP/admin (level >= 1)
 *
 * Aturan itu ditulis DUA KALI di repo ini — api/mt5-bridge-token.php (penerbit token
 * WebSocket) dan api/_middleware.php (qi_mt5_allowed, dipakai chart & live-price).
 * Kalau keduanya menyimpang, pengguna bisa mendapat token tetapi tidak mendapat candle,
 * atau lebih buruk: sebaliknya. Uji di bawah mengunci keduanya tetap sama.
 *
 * Bagian PHP menjalankan kode asli (api/_middleware.php) di dua mode.
 *
 * Run:  node tests/mt5-feed-akses.test.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const PHP = process.env.PHP_BIN || (process.platform === 'win32' && fs.existsSync('D:/xamp/php/php.exe') ? 'D:/xamp/php/php.exe' : 'php');
const root = path.join(__dirname, '..');
const baca = (f) => fs.readFileSync(path.join(root, f), 'utf8');
let gagal = 0;
const cek = (nama, lulus, info) => {
  console.log(`  ${lulus ? '✓' : '✗'} ${nama}${lulus || info === undefined ? '' : '  ' + JSON.stringify(info)}`);
  if (!lulus) gagal++;
};

// ── Dua penjaga, satu aturan ─────────────────────────────────────────────────
console.log('Aturan audience sama di kedua tempat');
const token = baca('api/mt5-bridge-token.php');
const middle = baca('api/_middleware.php');

for (const [nama, isi] of [['mt5-bridge-token.php', token], ['_middleware.php', middle]]) {
  cek(`${nama}: audience dibaca dari QI_MT5_BRIDGE_AUDIENCE === 'pro'`, /QI_MT5_BRIDGE_AUDIENCE\s*===\s*'pro'/.test(isi));
  cek(`${nama}: admin (level >= 3) selalu boleh`, /\$level\s*>=\s*3/.test(isi));
  cek(`${nama}: audience 'pro' memakai ambang level >= 1`, /\$level\s*>=\s*1/.test(isi));
  cek(`${nama}: mode owner memeriksa kepemilikan trading_accounts`, /trading_accounts/.test(isi) && /account_reference/.test(isi));
}
// Ambang 'pro' tidak boleh diam-diam dinaikkan jadi >= 2 (itu akan membuang pengguna PRO
// dan hanya menyisakan VIP) — kasus yang pernah terjadi pada qi_require_pro().
cek("tidak ada ambang level >= 2 pada jalur audience 'pro'", !/audience\s*===\s*'pro'[^;]*\$level\s*>=\s*2/.test(token + middle));

console.log('\nToken bridge');
cek("scope token = 'ticks candles' (chart ikut, bukan tick saja)", /'scope'\s*=>\s*'ticks candles'/.test(token));
const ttl = (token.match(/\$ttl\s*=\s*(\d+)/) || [])[1];
cek('token berumur pendek (<= 600 detik)', ttl !== undefined && Number(ttl) > 0 && Number(ttl) <= 600, ttl);
cek('bridge wajib wss:// di produksi', /QI_DEV\s*&&\s*stripos\(\$bridgeUrl,\s*'wss:\/\/'\)/.test(token) || /wss:\/\//.test(token));
cek('pengguna tak berhak dijawab status disabled, bukan token', /BRIDGE_FORBIDDEN/.test(token) && /qi_mt5_nonaktif/.test(token));

// ── Label jujur di chart ─────────────────────────────────────────────────────
console.log('\nLabel sumber candle di dashboard');
const app = baca('assets/js/dashboard-app.js');
const peta = (app.match(/const OHLC_SOURCE_LABELS = \{[\s\S]*?\};/) || [''])[0];
cek("sumber 'mt5' punya label sendiri (bukan jatuh ke toUpperCase)", /\bmt5:\s*'[^']+'/.test(peta));
cek("label mt5 menyebut BROKER QI, bukan 'MT5' polos", /\bmt5:\s*'[^']*BROKER QI[^']*'/.test(peta));
cek('label mt5_tick juga menyebut BROKER QI', /mt5_tick:\s*'[^']*BROKER QI[^']*'/.test(peta));
cek("label simulasi tetap ada", /simulasi:\s*'DATA SIMULASI'/.test(peta));

const catatan = (app.match(/const OHLC_SOURCE_NOTES = \{[\s\S]*?\};/) || [''])[0];
cek('ada penjelasan untuk sumber mt5', /\bmt5:\s*'[^']{40,}'/.test(catatan));
cek('penjelasan mt5 memperingatkan harga broker pengguna bisa berbeda', /broker Anda sendiri bisa berbeda/i.test(catatan));
cek('penjelasan mt5_tick ada', /mt5_tick:\s*'[^']{40,}'/.test(catatan));
cek('penjelasan simulasi memperingatkan bukan harga pasar', /simulasi:\s*'[^']*bukan harga pasar/i.test(catatan));

cek('lencana memasang tooltip dari OHLC_SOURCE_NOTES', /el\.title\s*=\s*OHLC_SOURCE_NOTES\[/.test(app));
cek('tooltip direset saat sumber tidak diketahui', /el\.title\s*=\s*'Sumber data candle'/.test(app));
cek('feed broker QI diberi warna berbeda dari sumber biasa', /brokerQi/.test(app) && /cyan-500/.test(app));
cek('dashboard.html masih punya elemen #ohlcSource', /id="ohlcSource"/.test(baca('dashboard.html')));

// ── Bagian PHP: kode asli ────────────────────────────────────────────────────
const probe = spawnSync(PHP, ['-v'], { encoding: 'utf8' });
if (probe.error || probe.status !== 0) {
  console.error(`\nSKIP — PHP binary tidak dapat dijalankan ("${PHP}").`);
  console.log(gagal ? `\n${gagal} uji GAGAL` : '\nSemua lulus (bagian PHP dilewati)');
  process.exit(gagal ? 1 : 0);
}
for (const mode of ['server', 'anon']) {
  console.log('');
  const run = spawnSync(PHP, [path.join(__dirname, 'mt5-feed-akses.test.php'), mode], { encoding: 'utf8' });
  process.stdout.write(run.stdout || '');
  process.stderr.write(run.stderr || '');
  if (run.status !== 0) gagal++;
}

console.log(gagal ? `\n${gagal} uji GAGAL` : '\nPASS — akses feed MT5 & label sumbernya terkunci');
process.exit(gagal ? 1 : 0);
