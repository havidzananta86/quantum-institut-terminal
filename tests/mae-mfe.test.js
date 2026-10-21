/**
 * MAE / MFE pada setiap transaksi tertutup, dan pembersihan folder engine/ yang mati.
 *
 * MENGAPA MAE/MFE: win rate dan expectancy hanya memberi tahu HASIL, bukan SEBAB.
 * MAE/MFE menjawab pertanyaan yang menentukan arah perbaikan — apakah masalahnya arah
 * sinyal, SL yang kesempitan, atau TP yang kejauhan.
 *
 * Run:  node tests/mae-mfe.test.js
 */
'use strict';
const fs = require('fs');
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

console.log('Penilai mencatat perjalanan posisi');
const ev = baca('api/signal-evaluator.php');
cek('MAE/MFE dihitung dalam satuan R', /\$maeR = max\(\$maeR, \$melawan\s+\/ \$risiko\)/.test(ev) && /\$mfeR = max\(\$mfeR, \$mendukung \/ \$risiko\)/.test(ev));
cek('keduanya disimpan pada rekor', /'mae_r'\s*=>\s*round\(\$maeR, 3\)/.test(ev) && /'mfe_r'\s*=>\s*round\(\$mfeR, 3\)/.test(ev));
cek('candle penutup ikut dihitung (bagian dari perjalanan)', /\$catatMaeMfe\(\$h, \$l\);/.test(ev));
cek('arah dibedakan BUY vs SELL', /\$side === 'BUY'\) \? \$high - \$entry : \$entry - \$low/.test(ev));
cek('aman saat risiko nol (tidak membagi nol)', /if \(\$risiko <= 0\) return;/.test(ev));

console.log('\nVersi aturan penilaian');
cek('QI_VERSI_PENILAIAN jadi konstanta bernama', /define\('QI_VERSI_PENILAIAN', 3\)/.test(ev));
cek('tidak lagi angka ajaib di tengah kode', !/\$ubah\['versi_penilaian'\] = 3;/.test(ev));
cek('alasan tidak menaikkan versi dijelaskan', /TIDAK menaikkan versi/.test(ev));
cek('statistik tetap memisahkan per versi', /per_versi_penilaian/.test(baca('api/_signal_stats.php')));
cek('versi ATURAN sinyal sudah ada sejak sebelumnya', /define\('QI_VERSI_ATURAN_SINYAL', 'v2'\)/.test(baca('api/_signal_record.php')));

console.log('\nFolder engine/ yang mati sudah dibersihkan');
const mati = ['ai_engine', 'ema200', 'fibonacci', 'golden_cross', 'ichimoku', 'macd', 'momentum_ny', 'smc', 'snr', 'trenm5'];
const tersisa = mati.filter((n) => fs.existsSync(path.join(root, 'engine', n + '.php')));
cek('10 berkas tak terpakai dihapus', tersisa.length === 0, tersisa);
cek('tidak ada kode yang memanggil fungsinya', !/calculateQuantum/.test(baca('api/_middleware.php') + baca('api/signal-generator.php')));
cek('README tidak lagi menyebut engine/ sebagai mesin sinyal', !/^engine\/\s+Mesin sinyal/m.test(baca('README.md')));
cek('README menunjuk lokasi mesin yang sebenarnya', /engine-nine\.js/.test(baca('README.md')) && /_engine_server\.php/.test(baca('README.md')));

// ── Bagian PHP: hitungan MAE/MFE yang bisa dihitung tangan ──────────────────
const probe = spawnSync(PHP, ['-v'], { encoding: 'utf8' });
if (probe.error || probe.status !== 0) {
  console.error(`\nSKIP — PHP binary tidak dapat dijalankan ("${PHP}").`);
  console.log(gagal ? `\n${gagal} uji GAGAL` : '\nSemua lulus (bagian PHP dilewati)');
  process.exit(gagal ? 1 : 0);
}
console.log('');
const run = spawnSync(PHP, [path.join(__dirname, 'mae-mfe.test.php')], { encoding: 'utf8' });
process.stdout.write(run.stdout || '');
process.stderr.write(run.stderr || '');
if (run.status !== 0) gagal++;

console.log(gagal ? `\n${gagal} uji GAGAL` : '\nPASS — MAE/MFE tercatat, versi penilaian bernama, engine/ mati dibersihkan');
process.exit(gagal ? 1 : 0);
