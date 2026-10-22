/**
 * Data candle yang jujur saat sumber gagal (audit sinyal 2026-10-22):
 *   1. api/get-chart-data.php menyajikan cache NYATA yang basi (stale + umur) alih-alih candle
 *      rand(), menolak dengan jujur bila tidak ada data nyata, dan RETURN saat di-include
 *      (tests/chart-basi.test.php — tanpa jaringan, simbol rekaan);
 *   2. api/signals.php tidak menganalisa candle simulasi, melaporkan sumber & umur data, dan
 *      hanya menghitung konsensus dari timeframe yang nyata dan segar. Fungsi aslinya dipotong
 *      dari berkas sumber lalu dijalankan di PHP CLI.
 *
 * Run:  node tests/chart-basi.test.js
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const PHP = process.env.PHP_BIN || (process.platform === 'win32' && fs.existsSync('D:/xamp/php/php.exe') ? 'D:/xamp/php/php.exe' : 'php');
const root = path.join(__dirname, '..');
const baca = (f) => fs.readFileSync(path.join(root, f), 'utf8');
let gagal = 0;
const cek = (nama, ok, info) => {
  console.log(`  ${ok ? '✓' : '✗'} ${nama}${ok || info === undefined ? '' : '  ' + JSON.stringify(info)}`);
  if (!ok) gagal++;
};

console.log('Sambungan (statis)');
const gc = baca('api/get-chart-data.php');
cek('get-chart-data: tidak ada lagi pembangkit candle rand()', !/rand\(-15, 16\)/.test(gc) && !/\$basePrices/.test(gc));
cek('get-chart-data: fallback cache basi bertanda stale + umur_detik', /\['stale'\] = true/.test(gc) && /\['umur_detik'\]/.test(gc) && /X-QI-Cache: STALE-ERROR/.test(gc));
const blokIndeks = gc.slice(gc.indexOf('qi_simbol_indeks($symbol)) {'), gc.indexOf('qi_simbol_indeks($symbol)) {') + 900);
cek('get-chart-data: blok indeks RETURN saat di-include (dulu exit mematikan signals.php)', /if \(defined\('QI_INCLUDED_BY_SIGNALS'\)\) return;\s*exit\(\);/.test(blokIndeks));
const sg = baca('api/signals.php');
cek('signals.php: daftar simbol yang didukung', /\$DIDUKUNG = \[/.test(sg) && /Simbol tidak didukung/.test(sg));
cek('signals.php: load_candles meneruskan simulated/source/stale', /'simulated' => !empty\(\$d\['simulated'\]\)/.test(sg) && /'stale' => !empty\(\$d\['stale'\]\)/.test(sg));
const ai = baca('api/ai-signal.php');
cek('ai-signal: ai_load_candles meneruskan stale', /'stale' => !empty\(\$d\['stale'\]\)/.test(ai));

const probe = spawnSync(PHP, ['-v'], { encoding: 'utf8' });
if (probe.error || probe.status !== 0) {
  console.error(`SKIP (bagian PHP) — PHP binary not runnable ("${PHP}").`);
  process.exit(gagal ? 1 : 0);
}

console.log('\nget-chart-data saat semua sumber gagal');
const run = spawnSync(PHP, [path.join(__dirname, 'chart-basi.test.php')], { encoding: 'utf8' });
process.stdout.write(run.stdout || '');
process.stderr.write(run.stderr || '');
if (run.status !== 0) gagal++;

console.log('\nsignals.php: per timeframe & konsensus');
function potong(src, nama) {
  const awal = src.indexOf('function ' + nama + '(');
  if (awal < 0) return null;
  let i = src.indexOf('{', awal), dalam = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') dalam++;
    else if (src[i] === '}' && --dalam === 0) break;
  }
  return src.slice(awal, i + 1);
}
const fungsi = ['calc_ema', 'calc_rsi', 'calc_macd_hist', 'analyze', 'signals_tf', 'signals_konsensus'].map((n) => potong(sg, n));
cek('fungsi ditemukan di api/signals.php', fungsi.every(Boolean));
if (fungsi.every(Boolean)) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qi-signals-'));
  const skrip = path.join(dir, 'uji.php');
  const pasar = path.join(root, 'api', '_sinyal_pasar.php').replace(/\\/g, '/');
  fs.writeFileSync(skrip, `<?php\nrequire '${pasar}';\n` + fungsi.join('\n') + `
$naik = []; for ($i = 0; $i < 120; $i++) { $c = 100 + $i + ($i % 3) * 0.2; $naik[] = ['time' => $i * 3600, 'open' => $c - 0.4, 'high' => $c + 0.6, 'low' => $c - 0.8, 'close' => $c]; }
$beku = $naik; for ($i = 0; $i < 40; $i++) $beku[] = ['time' => (120 + $i) * 3600, 'open' => 219.2, 'high' => 219.2, 'low' => 219.2, 'close' => 219.2];
$tf = [
  'M15' => signals_tf(['candles' => $naik, 'simulated' => true, 'source' => 'simulasi']),
  'H1'  => signals_tf(['candles' => $naik, 'simulated' => false, 'source' => 'binance']),
  'H4'  => signals_tf(['candles' => $naik, 'simulated' => false, 'source' => 'binance', 'stale' => true, 'umur_detik' => 7200]),
  'D1'  => signals_tf(['candles' => $beku, 'simulated' => false, 'source' => 'oanda_tv']),
];
echo json_encode([
  'tf' => $tf,
  'konsensus' => signals_konsensus($tf),
  'konsensus_3_nyata' => signals_konsensus(['a' => $tf['H1'], 'b' => $tf['D1'], 'c' => $tf['H1']]),
  'rsi_beku' => analyze($beku)['rsi'], 'rsi_naik' => analyze($naik)['rsi'],
  'kosong' => signals_tf(['candles' => [], 'source' => 'binance']),
]);`);
  const r = spawnSync(PHP, [skrip], { encoding: 'utf8' });
  let d = null;
  try { d = JSON.parse(r.stdout); } catch (e) { cek('PHP menghasilkan JSON', false, (r.stdout || '') + (r.stderr || '')); }
  if (d) {
    cek('candle simulasi → NO_DATA "data simulasi ditolak", tidak ikut konsensus', d.tf.M15.signal === 'NO_DATA' && d.tf.M15.alasan === 'data simulasi ditolak' && d.tf.M15.dipakai_konsensus === false, d.tf.M15);
    cek('setiap timeframe membawa sumber datanya', d.tf.H1.source === 'binance' && d.tf.D1.source === 'oanda_tv' && d.tf.M15.source === 'simulasi', d.tf);
    cek('data nyata segar → dianalisa dan ikut konsensus', d.tf.H1.signal === 'BULLISH' && d.tf.H1.dipakai_konsensus === true, d.tf.H1);
    cek('data basi → ditandai stale + umur, TIDAK ikut konsensus', d.tf.H4.stale === true && d.tf.H4.umur_detik === 7200 && d.tf.H4.dipakai_konsensus === false, d.tf.H4);
    cek('konsensus hanya dari 2 timeframe yang dipakai → NEUTRAL (bukan BULLISH dari 4 TF)', d.konsensus === 'NEUTRAL', d.konsensus);
    cek('3 timeframe nyata searah → BULLISH', d.konsensus_3_nyata === 'BULLISH', d.konsensus_3_nyata);
    cek('40 bar beku di ujung tidak mengubah RSI (dibuang sebelum dihitung)', Math.abs(d.rsi_beku - d.rsi_naik) < 1e-9, [d.rsi_beku, d.rsi_naik]);
    cek('tanpa candle → NO_DATA dengan alasan', d.kosong.signal === 'NO_DATA' && d.kosong.dipakai_konsensus === false, d.kosong);
  }
  fs.rmSync(dir, { recursive: true, force: true });
}

console.log(gagal ? `\n${gagal} uji GAGAL` : '\nSemua lulus');
process.exit(gagal ? 1 : 0);
