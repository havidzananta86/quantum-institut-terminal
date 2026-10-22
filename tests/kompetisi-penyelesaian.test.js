/**
 * REGRESI AUDIT G1 (kompetisi) — penyelesaian server, seri harga XAUUSD, akhir periode, turnamen lain.
 *
 * Bagian PHP: tests/kompetisi-penyelesaian.test.php (fungsi murni + MySQL sungguhan di database sementara),
 * dijalankan di dua zona waktu PHP (zona PHP ≠ zona MySQL adalah sumber bug waktu di proyek ini).
 * Bagian statis: kontrak endpoint yang tidak bisa diuji tanpa server HTTP.
 *
 * Run:  node tests/kompetisi-penyelesaian.test.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const baca = (f) => fs.readFileSync(path.join(root, f), 'utf8');
let gagal = 0;
const cek = (nama, lulus, info) => {
  console.log(`  ${lulus ? '✓' : '✗'} ${nama}${lulus || info === undefined ? '' : '  ' + JSON.stringify(info).slice(0, 300)}`);
  if (!lulus) gagal++;
};

const PHP = process.env.PHP_BIN || (process.platform === 'win32' && fs.existsSync('D:/xamp/php/php.exe') ? 'D:/xamp/php/php.exe' : 'php');
const probe = spawnSync(PHP, ['-v'], { encoding: 'utf8' });
if (probe.error || probe.status !== 0) {
  console.error(`SKIP (bagian PHP) — PHP binary not runnable ("${PHP}"). Set PHP_BIN to enable.`);
} else {
  for (const zona of ['UTC', 'Asia/Jakarta']) {
    console.log(`[PHP date.timezone=${zona}]`);
    const run = spawnSync(PHP, ['-d', `date.timezone=${zona}`, '-d', 'error_log=' + (process.platform === 'win32' ? 'NUL' : '/dev/null'), path.join(__dirname, 'kompetisi-penyelesaian.test.php')], { encoding: 'utf8' });
    process.stdout.write(run.stdout || '');
    if (run.status !== 0) { process.stderr.write(run.stderr || ''); gagal++; }
  }
}

console.log('\nPosisi periode lalu hanya diselesaikan server (temuan 2 & 9)');
{
  const pt = baca('api/paper-trading.php');
  const tutup = pt.slice(pt.indexOf("if ($aksi === 'tutup')"), pt.indexOf("if ($aksi === 'ubah')"));
  const ubah = pt.slice(pt.indexOf("if ($aksi === 'ubah')"), pt.indexOf("$tolak('Aksi tidak dikenal.', 400);"));
  cek("'tutup' menolak posisi periode lalu (409 periode_selesai) SEBELUM menghitung harga", tutup.indexOf('$tolakPeriodeLalu($baris);') > 0
    && tutup.indexOf('$tolakPeriodeLalu($baris);') < tutup.indexOf('qi_paper_harga_eksekusi('));
  cek("'ubah' juga menolak posisi periode lalu", ubah.indexOf('$tolakPeriodeLalu($baris);') > 0);
  cek('penolakan memakai kode periode_selesai & jam server (qi_komp_periode_kini)', /'periode_selesai'/.test(pt) && /qi_komp_periode_kini\(\)\[2\]/.test(pt));
  cek("'tutup' memakai harga di SERI POSISI; seri lain → 409 harga_basi dengan alasan", /qi_komp_acuan\(\$baris\['symbol'\], null, \$baris\)/.test(tutup) && /Penutupan ditunda sampai seri itu kembali/.test(tutup));
  const comp = baca('api/competition.php');
  cek('kandidat pemenang periode lampau yang BELUM final → 409 BELUM_FINAL (tidak dinilai dengan harga hari ini)',
    /'belum_final' => true/.test(comp) && /'code' => 'BELUM_FINAL'/.test(comp) && !/qi_komp_papan_bangun\(\$pdo, \$periode, \['simpan' => false\]\)/.test(comp));
  const syarat = baca('api/_kompetisi_syarat.php');
  cek('aturan tertulis sesuai penegakan: kutipan tercatat, tidak bisa ditutup pemilik, batal tanpa P/L', /tidak bisa lagi ditutup atau diubah pemiliknya/.test(syarat) && /dibatalkan tanpa P\/L 72 jam/.test(syarat));
  cek('aturan tertulis tidak lagi menjanjikan "bar M1" tanpa syarat', /bila feed itu menyediakan bar/.test(syarat) && /bila feed menyediakannya/.test(baca('kompetisi.html')));
  const sql = baca('database/migrations/027_kompetisi_live.sql');
  cek('migrasi 027 mendokumentasikan harga_sumber/harga_geser & pembatalan', /harga_sumber/.test(sql) && /harga_geser/.test(sql) && /'cancelled'/.test(sql));
  const skema = baca('api/_kompetisi_skema.php');
  cek('skema runtime memasang harga_sumber/harga_geser (penanda v2 supaya berjalan sekali lagi)', /'harga_sumber'\s+=> 'ADD COLUMN harga_sumber/.test(skema) && /skema-027-v2\.ok/.test(skema));
}

console.log('\nTurnamen lain (temuan 5)');
{
  const comp = baca('api/competition.php');
  const def = comp.slice(comp.indexOf('function qi_comp_turnamen'), comp.indexOf('$berkas = __DIR__'));
  cek('Gold Rush dinilai dari ekuitas (papan yang sama, hanya XAUUSD)', /'gold-rush-weekly' => \[[^\]]*'skor' => 'ekuitas', 'simbol' => \['XAUUSD'\]/.test(def));
  cek('Crypto Sprint (harian) & Forex Battle (bulanan) DITANGGUHKAN', /'crypto-sprint-daily' => \[[^\n]*'ditangguhkan' => true/.test(def) && /'forex-battle-monthly' => \[[^\n]*'ditangguhkan' => true/.test(def));
  cek('pendaftaran turnamen ditangguhkan ditolak (409 TURNAMEN_DITANGGUHKAN)', /if \(!empty\(\$turnamen\[\$kunci\]\['ditangguhkan'\]\)\)/.test(comp) && /'TURNAMEN_DITANGGUHKAN'/.test(comp));
  cek('turnamen ditangguhkan tidak ditawarkan di "lainnya"', /if \(\$k === 'weekly-championship' \|\| !empty\(\$t\['ditangguhkan'\]\)\) continue;/.test(comp));
  cek('evaluasi tidak lagi memakai P/L tertutup menurut closed_at untuk hadiah (ditangguhkan → tanpa kandidat)', /if \(!empty\(\$t\['ditangguhkan'\]\)\) return \[/.test(comp));
}

console.log('\nJeda order & irama (temuan 13)');
{
  const comp = baca('api/competition.php');
  cek('admin ?kandidat memuat irama order per peserta (jumlah, puncak per jam, jeda median & minimum)',
    /function qi_comp_irama\(/.test(comp) && /'irama'\s+=> \$irama\[\$b\['user_id'\]\]/.test(comp) && /'jeda_median_dtk'/.test(comp));
  cek('QI_KOMP_JEDA_ORDER = 2 detik', /define\('QI_KOMP_JEDA_ORDER', 2\.0\)/.test(baca('api/_kompetisi_inti.php')));
}

console.log('\nBar M1 & penyelesaian (temuan 1, 6, 7, 8)');
{
  const settle = baca('api/_kompetisi_settle.php');
  const loop = settle.slice(settle.indexOf('$dariMin = [];'), settle.indexOf('$barCache = [];'));
  cek('awal jendela bar hanya dari posisi ber-SL/TP', /if \(!\$adaSlTp\(\$r\)\) continue;/.test(loop));
  const harga = baca('api/_kompetisi_harga.php');
  cek('Binance: bar terbaru diambil TANPA startTime, rentang lama disusul maju (maks. 3 halaman)', /\$ambil\(\$simbolB, null, null,/.test(harga) && /\$hal < 3/.test(harga));
  cek('cache bar Binance dipakai ulang hanya bila bar terakhirnya mencapai sekarang', /\$kini_\(\$j\['bars'\]\)/.test(harga));
  cek('stop-out memakai tanda nyata terakhir untuk kaki tanpa harga', /qi_komp_akun_db\(\$pdo, \$u, \$periodeKini, \$kutipan, QI_KOMP_UMUR_TANDA_MAKS, \$tanda\)/.test(settle) && /empty\(\$k\['cadangan'\]\)/.test(settle));
  cek('harga akhir periode di-memo per (simbol, batas, seri) dan dibatasi per jalan', /\$memoSebelum\[\$km\]/.test(settle) && /\$cariSebelum >= \$maksSebelum/.test(settle));
}

console.log(gagal ? `\n${gagal} uji GAGAL` : '\nSemua lulus');
process.exit(gagal ? 1 : 0);
