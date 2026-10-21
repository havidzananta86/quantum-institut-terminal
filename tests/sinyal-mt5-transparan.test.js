/**
 * Dua aturan yang tidak boleh goyah:
 *
 *  1. SATU SUMBER UNTUK SINYAL. Analisa yang diterbitkan sebagai sinyal resmi harus selalu
 *     dihitung dari feed broker MT5, bukan dari OANDA/sumber lain, dan TIDAK boleh bergantung
 *     pada siapa yang kebetulan memuat halaman lebih dulu. Sebelum perbaikan ini
 *     api/ai-signal.php memilih berkas cache lewat qi_chart_use_mt5($sym) — true untuk
 *     pengunjung PRO/VIP, false untuk proses server dan pengunjung gratis — sehingga sinyal
 *     yang sama bisa lahir dari dua sumber berbeda.
 *
 *  2. DRAWDOWN IKUT DIPUBLIKASIKAN. qi_signal_drawdown() sudah lama menghitungnya, tetapi
 *     halaman publik hanya memperlihatkan win rate dan expectancy — angka yang enak dilihat.
 *
 * Run:  node tests/sinyal-mt5-transparan.test.js
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

console.log('Semua jalur sinyal memakai feed broker MT5');
const SUMBER_MT5 = [
  ['api/ai-signal.php', 'Auto Analisa AI'],
  ['api/signal-generator.php', 'sinyal otomatis'],
  ['api/signal-setup-shadow.php', 'sinyal bayangan'],
];
for (const [berkas, label] of SUMBER_MT5) {
  cek(`${label} (${berkas}) menetapkan QI_SERVER_MT5`, /if \(!defined\('QI_SERVER_MT5'\)\) define\('QI_SERVER_MT5', true\);/.test(baca(berkas)));
}
const mc = baca('api/maintenance-cron.php');
cek('cron sinyal bayangan & pemindai Pine juga menetapkannya', (mc.match(/define\('QI_SERVER_MT5', true\)/g) || []).length >= 2);

// Penilai TP/SL harus memakai feed yang SAMA dengan penerbit sinyal, kalau tidak rekornya
// menilai harga yang berbeda dari harga yang dipakai saat sinyal lahir.
const ev = baca('api/signal-evaluator.php');
cek('penilai mengutamakan cache MT5', /\$pilih = \$kandidat\['mt5'\] \?\? \$kandidat\['umum'\];/.test(ev));
cek('mundur ke sumber umum HANYA bila MT5 tertinggal > 1 batang', /\$kandidat\['mt5'\]\['akhir'\] < \$kandidat\['umum'\]\['akhir'\] - qi_sig_durasi_interval\(\$iv\)/.test(ev));
cek('candle simulasi tidak pernah dipakai menilai', /!empty\(\$data\['simulated'\]\)\) continue;/.test(ev));

const ai = baca('api/ai-signal.php');
cek('ai-signal menjelaskan alasannya (bukan konstanta tanpa konteks)', /TIDAK BOLEH bergantung pada siapa/.test(ai));
cek('QI_SERVER_MT5 ditetapkan SEBELUM pelindung library', ai.indexOf("define('QI_SERVER_MT5'") < ai.indexOf("if (!defined('QI_AI_SIGNAL_LIB'))"));

console.log('\nDrawdown dipublikasikan');
const tr = baca('api/transparansi.php');
cek('transparansi.php menghitung drawdown', /\$dd = qi_signal_drawdown\(\$resmi\);/.test(tr));
cek('drawdown masuk statistik sinyal resmi', /'drawdown' => \$drawdown/.test(tr));
for (const k of ['maks_r', 'maks_pct', 'r_terburuk', 'dari_transaksi', 'satuan', 'arti']) {
  cek(`balasan memuat '${k}'`, new RegExp(`'${k}'\\s*=>`).test(tr));
}
cek("satuan dinyatakan (R = kelipatan risiko)", /kelipatan risiko/.test(tr));

const html = baca('transparansi.html');
cek('halaman punya kartu penurunan terdalam', /id="kDd"/.test(html) && /Penurunan terdalam/.test(html));
cek('ada tempat untuk detail & artinya', /id="kDdDetail"/.test(html) && /id="kDdArti"/.test(html));
const js = baca('assets/js/halaman-transparansi.js');
cek('kartu diisi dari statistik.drawdown', /st\.drawdown/.test(js));
cek('nilai ditampilkan sebagai penurunan (bertanda minus)', /'-' \+ r\(Math\.abs\(dd\.maks_r\), 1\)/.test(js));
cek('tanpa transaksi → catatan jujur, bukan angka nol', /dd\.catatan \|\| 'belum ada transaksi tertutup'/.test(js));
cek('persentase hanya ditampilkan bila ada', /dd\.maks_pct != null/.test(js));

// ── Bagian PHP: hitungan drawdown yang bisa dihitung tangan ─────────────────
const probe = spawnSync(PHP, ['-v'], { encoding: 'utf8' });
if (probe.error || probe.status !== 0) {
  console.error(`\nSKIP — PHP binary tidak dapat dijalankan ("${PHP}").`);
  console.log(gagal ? `\n${gagal} uji GAGAL` : '\nSemua lulus (bagian PHP dilewati)');
  process.exit(gagal ? 1 : 0);
}
console.log('');
const run = spawnSync(PHP, [path.join(__dirname, 'transparansi-drawdown.test.php')], { encoding: 'utf8' });
process.stdout.write(run.stdout || '');
process.stderr.write(run.stderr || '');
if (run.status !== 0) gagal++;

console.log(gagal ? `\n${gagal} uji GAGAL` : '\nPASS — sinyal dari satu sumber (MT5), drawdown terbuka ke publik');
process.exit(gagal ? 1 : 0);
