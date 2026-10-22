/**
 * Riwayat candle hanya digabung dari SUMBER YANG SAMA (api/get-chart-data.php).
 *
 * Saat bridge OANDA mati, rantai cadangan berganti-ganti (biquote → Twelve Data → proksi
 * PAXG). qi_merge_candle_history() dulu menggabungkan cache lama apa pun sumbernya, jadi bar
 * proksi PAXG — yang diperdagangkan 24/7 — masuk ke chart "biquote": XAUUSD punya candle hari
 * Sabtu dan deret candle datar puluhan jam (terlihat di arena kompetisi, 2026-10-22).
 *
 * Fungsi aslinya dipotong dari berkas sumber dan dijalankan di PHP CLI dengan cache sementara.
 * Run:  node tests/chart-sumber-tunggal.test.js
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(root, 'api/get-chart-data.php'), 'utf8');
let gagal = 0;
const cek = (nama, ok, info) => {
  console.log(`  ${ok ? '✓' : '✗'} ${nama}${ok || info === undefined ? '' : '  ' + JSON.stringify(info)}`);
  if (!ok) gagal++;
};

/** Potong satu fungsi PHP (dari "function nama(" sampai kurung kurawal penutupnya). */
function potong(nama) {
  const awal = SRC.indexOf('function ' + nama + '(');
  if (awal < 0) return null;
  let i = SRC.indexOf('{', awal), dalam = 0;
  for (; i < SRC.length; i++) {
    if (SRC[i] === '{') dalam++;
    else if (SRC[i] === '}' && --dalam === 0) break;
  }
  return SRC.slice(awal, i + 1);
}

const fungsi = ['qi_candle_step', 'qi_merge_candle_history'].map(potong);
cek('fungsi ditemukan di api/get-chart-data.php', fungsi.every(Boolean));
cek('pemanggil meneruskan sumber data', /qi_merge_candle_history\(\$cacheFile, \$candles, 1000, \$source\)/.test(SRC));

const PHP = process.env.PHP_BIN || (process.platform === 'win32' && fs.existsSync('D:/xamp/php/php.exe') ? 'D:/xamp/php/php.exe' : 'php');
if (spawnSync(PHP, ['-v'], { encoding: 'utf8' }).error) {
  console.error(`SKIP (bagian PHP) — PHP binary not runnable ("${PHP}").`);
} else if (fungsi.every(Boolean)) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qi-sumber-'));
  const cache = path.join(dir, 'c.json').replace(/\\/g, '/');
  const jam = 3600, t0 = 1790000000;
  const bar = (t, h) => ({ time: t, open: h, high: h + 1, low: h - 1, close: h });
  fs.writeFileSync(cache, JSON.stringify({ simulated: false, source: 'binance_paxg', candles: [bar(t0, 4100), bar(t0 + jam, 4101)] }));
  const skrip = path.join(dir, 'uji.php');
  fs.writeFileSync(skrip, '<?php\n' + fungsi.join('\n') + `
$baru = [['time' => ${t0 + 2 * jam}, 'open' => 4200, 'high' => 4201, 'low' => 4199, 'close' => 4200]];
echo json_encode([
  'beda'   => count(qi_merge_candle_history('${cache}', $baru, 1000, 'biquote')),
  'sama'   => count(qi_merge_candle_history('${cache}', $baru, 1000, 'binance_paxg')),
  'tanpa'  => count(qi_merge_candle_history('${cache}', $baru, 1000)),
]);`);
  const run = spawnSync(PHP, [skrip], { encoding: 'utf8' });
  let r = null;
  try { r = JSON.parse(run.stdout); } catch (e) { cek('PHP menghasilkan JSON', false, run.stdout + run.stderr); }
  if (r) {
    cek('cache dari sumber LAIN tidak digabung (hanya 1 bar baru)', r.beda === 1, r);
    cek('cache dari sumber yang sama tetap digabung (3 bar)', r.sama === 3, r);
    cek('pemanggil lama tanpa sumber tetap berperilaku seperti dulu', r.tanpa === 3, r);
  }
  fs.rmSync(dir, { recursive: true, force: true });
}

console.log(gagal ? `\n${gagal} uji GAGAL` : '\nSemua lulus');
process.exit(gagal ? 1 : 0);
