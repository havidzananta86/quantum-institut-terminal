/**
 * Fase 1 "kejujuran data": gap SL/TP keluar di harga pembukaan, biaya spread pada penilaian
 * sinyal, kunci bersama rekor JSON (termasuk uji tulis PARALEL sungguhan), salinan database
 * rekor bayangan/Pine, dan tidak ada angka bawaan karangan pada POST riwayat sinyal.
 *
 * Run:  node tests/kejujuran-data.test.js
 * PHP binary: $PHP_BIN, else `php` from PATH (skips when absent, like the other PHP tests).
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const PHP = process.env.PHP_BIN || (process.platform === 'win32' && fs.existsSync('D:/xamp/php/php.exe') ? 'D:/xamp/php/php.exe' : 'php');
const root = path.join(__dirname, '..');
let gagal = 0;
const cek = (nama, lulus, info) => {
  console.log(`  ${lulus ? '✓' : '✗'} ${nama}${lulus || info === undefined ? '' : '  ' + JSON.stringify(info)}`);
  if (!lulus) gagal++;
};

console.log('Tanpa angka karangan (statis)');
const riwayat = fs.readFileSync(path.join(root, 'api/signal-history.php'), 'utf8');
cek('POST: confluence_score tidak lagi bawaan 85', !/confluence_score'\]\s*\?\?\s*85/.test(riwayat));
cek('POST: sample_size tidak lagi bawaan 100', !/sample_size'\]\s*\?\?\s*100/.test(riwayat));
cek('POST: menulis lewat kunci bersama', /qi_json_ubah\(\$historyFile/.test(riwayat));
const evaluator = fs.readFileSync(path.join(root, 'api/signal-evaluator.php'), 'utf8');
cek('evaluator: tidak lagi menulis ulang salinan lama tanpa kunci', !/file_put_contents\(\$historyFile/.test(evaluator) && /qi_json_ubah\(\$historyFile/.test(evaluator));
// Dulu pemeriksaan ini menunjuk QuantumTrackRecord di assets/js/pro-trading-tools.js,
// modul yang merender ke #panelTrackRecord — elemen yang tidak ada di dashboard.html,
// jadi seluruhnya kode mati dan sudah dihapus. Aturan yang sama sekarang ditegakkan
// di sumbernya: server mengirim null (bukan 0) ketika skornya memang tidak ada.
cek('server: confluence_score kosong dikirim null, bukan angka', /is_numeric\(\$input\['confluence_score'\] \?\? null\)[^;]*: null,/.test(riwayat));
cek('migrasi 026 tersimpan sebagai catatan skema', fs.existsSync(path.join(root, 'database/migrations/026_signal_records.sql')));

const probe = spawnSync(PHP, ['-v'], { encoding: 'utf8' });
if (probe.error || probe.status !== 0) {
  console.error(`SKIP — PHP binary not runnable ("${PHP}"). Set PHP_BIN to enable the PHP part.`);
  process.exit(gagal ? 1 : 0);
}

const run = spawnSync(PHP, [path.join(__dirname, 'kejujuran-data.test.php')], { encoding: 'utf8' });
process.stdout.write(run.stdout || '');
process.stderr.write(run.stderr || '');
if (run.status !== 0) gagal++;

(async () => {
  console.log('Tulis paralel ke satu berkas rekor');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qi-paralel-'));
  const berkas = path.join(dir, 'rekor.json');
  const N = 25, PROSES = 4;
  const kode = await Promise.all(Array.from({ length: PROSES }, (_, p) => new Promise((ok) => {
    const c = spawn(PHP, [path.join(__dirname, 'kejujuran-data.tulis.php'), berkas, String(N), 'P' + p], { stdio: 'inherit' });
    c.on('close', ok);
  })));
  const isi = JSON.parse(fs.readFileSync(berkas, 'utf8'));
  cek(`${PROSES} proses × ${N} tambahan → ${PROSES * N} rekor, tidak ada yang hilang`, isi.length === PROSES * N && new Set(isi).size === PROSES * N, { jumlah: isi.length });
  cek('semua proses selesai tanpa gagal kunci', kode.every((k) => k === 0), kode);
  cek('tidak ada berkas kunci/sementara tertinggal', fs.readdirSync(dir).every((f) => f === 'rekor.json'), fs.readdirSync(dir));
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(gagal ? `\n${gagal} uji GAGAL` : '\nSemua lulus');
  process.exit(gagal ? 1 : 0);
})();
