// "Ikuti Auto Analisa" (akun simulasi otomatis): logika server (PHP, di dua zona waktu), format tampilan (JS),
// dan kontrak statis: posisi otomatis dilindungi dari simpan klien dan tidak ikut peringkat Competition.
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

let gagal = 0;
function cek(nama, kondisi, info) { console.log((kondisi ? '  ✓ ' : '  ✗ ') + nama + (kondisi || info === undefined ? '' : '  ' + JSON.stringify(info).slice(0, 300))); if (!kondisi) gagal++; }

// ── 1. PHP (murni): lot, pemilihan sinyal, penutupan ─────────────────────────
const PHP = process.env.PHP_BIN || (process.platform === 'win32' && fs.existsSync('D:/xamp/php/php.exe') ? 'D:/xamp/php/php.exe' : 'php');
const probe = spawnSync(PHP, ['-v'], { encoding: 'utf8' });
if (probe.error || probe.status !== 0) {
  console.error(`SKIP (bagian PHP) — PHP binary not runnable ("${PHP}"). Set PHP_BIN to enable.`);
} else {
  for (const zone of ['UTC', 'Asia/Jakarta']) {
    console.log(`[PHP date.timezone=${zone}]`);
    const run = spawnSync(PHP, ['-d', `date.timezone=${zone}`, path.join(__dirname, 'auto-paper.test.php')], { encoding: 'utf8' });
    process.stdout.write(run.stdout || ''); process.stderr.write(run.stderr || '');
    if (run.status !== 0) gagal++;
  }
}

// ── 2. JS: format nominal ────────────────────────────────────────────────────
console.log('Format tampilan');
const U = require('../assets/js/qim-auto-paper.js');
cek('kena TP: "+$249.84", kena SL: "−$86.12"', U.usd(249.84, true) === '+$249.84' && U.usd(-86.12, true) === '−$86.12');
cek('tanpa tanda: saldo "$10,168.60"', U.usd(10168.6) === '$10,168.60');
cek('nol tidak diberi tanda', U.usd(0, true) === '$0.00');
cek('harga JPY 3 desimal, forex 5 desimal, emas 2 desimal', U.hargaTeks('USDJPY', 150.5) === '150.500' && U.hargaTeks('EURUSD', 1.11397) === '1.11397' && U.hargaTeks('XAUUSD', 4084.76) === '4,084.76');
const b = U.barisTransaksi({ symbol: 'XAUUSD', side: 'SELL', lots: 0.04, entry: 4084.76, exit: 4106.29, pnl: -86.12, hasil: 'SL', r: -1 });
cek('baris transaksi SL: nominal dan R terbaca', b.nominal === '−$86.12 (−1.00R)' && b.turun === true && b.pair === 'XAU/USD' && b.harga === '4,084.76 → 4,106.29', b);
const c = U.barisTransaksi({ symbol: 'ETHUSDT', side: 'BUY', lots: 5.97, entry: 2566.21, exit: 2608.06, pnl: 249.84, hasil: 'TP', r: 2.5 });
cek('baris transaksi TP: "+$249.84 (+2.50R)"', c.nominal === '+$249.84 (+2.50R)' && c.naik === true, c);

// ── 3. Kontrak statis ────────────────────────────────────────────────────────
console.log('Kontrak');
const pt = read('api/paper-trading.php');
// Jalur snapshot klien dipensiunkan (410); posisi auto/ai tidak bisa ditutup/diubah lewat {aksi}.
cek('posisi source auto/ai tidak bisa ditutup/diubah klien; snapshot lama ditolak 410', (pt.match(/in_array\(\$baris\['source'\], \['ai', 'auto'\], true\)/g) || []).length >= 2 && /http_response_code\(410\)/.test(pt));
cek('GET paper-trading menyertakan sumber posisi (src)', /'src'\s*=>\s*\$r\['source'\]/.test(pt));
cek('Competition hanya menghitung posisi manual (bukan auto, bukan ai)', /pp\.source = 'manual'/.test(read('api/competition.php')) && !/pp\.source <> 'auto'/.test(read('api/competition.php')));
// api/leaderboard.php kini alias papan mingguan (api/_kompetisi_papan.php) — filternya ada di pembangun papan.
const lb = read('api/leaderboard.php'), papanKomp = read('api/_kompetisi_papan.php');
cek('Leaderboard = papan mingguan yang hanya menghitung posisi manual (bukan auto, bukan ai)', /_kompetisi_papan\.php/.test(lb) && !/FROM paper_positions/.test(lb)
  && (papanKomp.match(/source = 'manual'/g) || []).length >= 3 && !/source <> 'auto'/.test(papanKomp), (papanKomp.match(/source = 'manual'/g) || []).length);
cek('penilai sinyal & pembangkit menutup/membuka posisi simulasi (hook terpasang)', /qi_ap_sinkron\(/.test(read('api/signal-evaluator.php')) && /qi_ap_sinkron\(/.test(read('api/signal-generator.php')));
const html = read('dashboard.html');
cek('kartu Ikuti Auto Analisa, tombol, risiko, dan banner ada di dashboard', ['autoPaperCard', 'apToggle', 'apRisiko', 'apBanner', 'apSaldo', 'apTambah', 'apKurang', 'apRiwayat'].every(id => html.includes('id="' + id + '"')));
// Skrip dashboard dibundel (npm run build:js): daftar & urutannya ada di assets/js/bundel.json.
cek('skrip qim-auto-paper.js dimuat', JSON.parse(read('assets/js/bundel.json')).bundel.some(b => b.file.includes('qim-auto-paper.js')));
cek('posisi AUTO tidak punya tombol Tutup di tabel posisi', /src === 'auto' \? 'AUTO'/.test(read('assets/js/dashboard-app.js')));
const ep = read('api/auto-paper.php');
cek('endpoint memerlukan PRO dan memvalidasi risiko 0,25–5%', /qi_require_level\('pro'\)/.test(ep) && /risiko_min/.test(ep) && /risiko_maks/.test(ep));
cek('endpoint tidak mengirim order sungguhan (tidak ada kode MT5/broker)', !/order_send|mt5|broker/i.test(ep + read('api/_auto_paper.php').replace(/\/\*\*[\s\S]*?\*\//g, '')));

if (gagal) { console.error('\nFAIL — ' + gagal + ' pemeriksaan gagal'); process.exit(1); }
console.log('\nPASS — Ikuti Auto Analisa: server, tampilan, dan kontrak');
