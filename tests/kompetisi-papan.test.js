/**
 * KOMPETISI LANGSUNG (audit kompetisi 2026-10-22) — papan ekuitas, penyelesaian SL/TP server,
 * margin & stop-out, akhir periode, dan pengerasan endpoint yang dulu bisa memalsukan P/L.
 *
 * Bagian PHP: tests/kompetisi-papan.test.php (fungsi murni + MySQL sungguhan di database sementara),
 * dijalankan di dua zona waktu PHP — zona PHP ≠ zona MySQL adalah sumber bug waktu di proyek ini.
 * Bagian statis: kontrak endpoint yang tidak bisa diuji tanpa server HTTP.
 *
 * Run:  node tests/kompetisi-papan.test.js
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

// Admin = penyelenggara: tidak tampil dan tidak bersaing di papan peringkat.
{
  const papan = baca('api/_kompetisi_papan.php');
  const fungsi = papan.slice(papan.indexOf('function qi_komp_sql_aktif'), papan.indexOf('function qi_komp_lencana'));
  cek('papan mengecualikan akun admin', /LOWER\(COALESCE\(\$alias\.role, ''\)\) <> 'admin'/.test(fungsi), fungsi.slice(0, 300));
}

const PHP = process.env.PHP_BIN || (process.platform === 'win32' && fs.existsSync('D:/xamp/php/php.exe') ? 'D:/xamp/php/php.exe' : 'php');
const probe = spawnSync(PHP, ['-v'], { encoding: 'utf8' });
if (probe.error || probe.status !== 0) {
  console.error(`SKIP (bagian PHP) — PHP binary not runnable ("${PHP}"). Set PHP_BIN to enable.`);
} else {
  for (const zona of ['UTC', 'Asia/Jakarta']) {
    console.log(`[PHP date.timezone=${zona}]`);
    const run = spawnSync(PHP, ['-d', `date.timezone=${zona}`, path.join(__dirname, 'kompetisi-papan.test.php')], { encoding: 'utf8' });
    process.stdout.write(run.stdout || ''); process.stderr.write(run.stderr || '');
    if (run.status !== 0) gagal++;
  }
}

console.log('\nai-auto-trade.php tidak bisa lagi menulis P/L karangan');
{
  const at = baca('api/ai-auto-trade.php');
  const close = at.slice(at.indexOf("if ($action === 'close')"), at.indexOf("http_response_code(400);\necho json_encode(['status' => 'error', 'message' => 'Action tidak dikenali"));
  cek("close: SELECT hanya baris source = 'ai'", /SELECT \* FROM paper_positions WHERE id = :id AND user_id = :uid AND status = 'open' AND source = 'ai'/.test(close));
  cek("close: UPDATE juga dibatasi source='ai' dan status open", /WHERE id=:id AND user_id=:uid AND status='open' AND source='ai'/.test(close));
  cek('close: close_price kiriman klien TIDAK dibaca', !/\$body\['close_price'\]/.test(at));
  cek('close: harga = harga eksekusi server dari feed kanonik', /qi_paper_harga_eksekusi\([\s\S]{0,160}qi_komp_acuan\(/.test(close) && /\$cp = \$eks\['harga'\];/.test(close));
  const exe = at.slice(at.indexOf("if ($action === 'execute')"), at.indexOf("if ($action === 'close')"));
  cek('execute: entry_price sinyal hanya dicatat, harga masuk = harga eksekusi server', /\$epSaran\s*= \(float\)\(\$sig\['entry_price'\]/.test(exe) && /\$ep = \$eks\['harga'\];/.test(exe) && /':ep'   => \$ep,/.test(exe));
  cek('execute: SL/TP di sisi salah dibuang (qi_paper_cek_sltp)', /qi_paper_cek_sltp\(\$direction, \$ep, \$sl, null\)/.test(exe));
}

console.log('\napi/paper-trading.php');
{
  const pt = baca('api/paper-trading.php');
  cek('snapshot lama → HTTP 410 dengan pesan muat ulang', /http_response_code\(410\)/.test(pt) && /Versi halaman ini sudah lama — muat ulang halaman \(Ctrl\+F5\)\./.test(pt));
  cek('jalur snapshot tidak lagi memproses positions[]/history[]', !/\$input\['positions'\]/.test(pt) && !/\$history\s*=\s*is_array/.test(pt));
  cek('settle pemanggil dijalankan sebelum GET/POST', pt.indexOf('qi_paper_settle($pdo, $uid)') > 0 && pt.indexOf('qi_paper_settle($pdo, $uid)') < pt.indexOf("if ($_SERVER['REQUEST_METHOD'] === 'GET')"));
  cek('skema 027 dipasang sebelum transaksi', /\$skemaSiap = qi_komp_skema_siapkan\(\$pdo\);/.test(pt));
  const buka = pt.slice(pt.indexOf("if ($aksi === 'buka')"), pt.indexOf("if ($aksi === 'tutup')"));
  cek('buka: idempoten lewat client_order_id (duplikat → baris yang sama, duplikat:true)', /client_order_id = :c/.test(buka) && /'duplikat' => true/.test(buka) && /'23000'/.test(buka));
  cek('buka: jeda antar order per pengguna (kode terlalu_cepat)', /QI_KOMP_JEDA_ORDER/.test(buka) && /'terlalu_cepat'/.test(buka) && /LOCK_EX \| LOCK_NB/.test(buka));
  cek('jeda antar order ≥ 2 detik (desain audit §B1), pesan memakai konstanta', /define\('QI_KOMP_JEDA_ORDER', 2\.0\)/.test(baca('api/_kompetisi_inti.php'))
    && /'Terlalu cepat — beri jeda ' \. \(int\)QI_KOMP_JEDA_ORDER \. ' detik antar order\.'/.test(buka) && !/jeda 1 detik/.test(pt));
  cek('buka: batas order harian per pengguna (QI_KOMP_ORDER_HARIAN_MAKS) sebelum INSERT',
    /QI_KOMP_ORDER_HARIAN_MAKS/.test(buka) && /opened_at >= NOW\(\) - INTERVAL 1 DAY/.test(buka)
    && buka.indexOf('QI_KOMP_ORDER_HARIAN_MAKS') < buka.indexOf('INSERT INTO paper_positions'));
  cek('buka: margin diperiksa sebelum INSERT', buka.indexOf('qi_komp_cek_margin(') > 0 && buka.indexOf('qi_komp_cek_margin(') < buka.indexOf('INSERT INTO paper_positions'));
  cek('buka: harga dari feed kanonik qi_komp_acuan', /\$acuan = qi_komp_acuan\(\$sym\);/.test(buka) && /qi_paper_harga_eksekusi\(\$sym, [^;]*\$acuan\)/.test(buka));
  cek('buka: seri harga tempat posisi diisi disimpan (harga_sumber / harga_geser)', /harga_sumber, harga_geser\)/.test(buka) && /':hs' => \$hargaSumber, ':hg' => \$hargaGeser/.test(buka));
  cek('buka: komp_periode dari jam server + pendaftaran otomatis PRO/VIP', /qi_komp_periode_kini\(\)/.test(buka) && /INSERT IGNORE INTO competition_entries/.test(buka) && /\[1, 2\]/.test(buka));
  cek("tutup: close_reason 'manual'", /close_reason = 'manual'/.test(pt));
  cek('GET: closeReason & kompPeriode & data.kompetisi', /'closeReason'/.test(pt) && /'kompPeriode'/.test(pt) && /'kompetisi' => \$kompetisi/.test(pt));
}

console.log('\nPapan publik, alias, dan cron');
{
  const comp = baca('api/competition.php');
  cek('GET papan mingguan tidak memaksa login (qi_validate_token opsional)', /\$papan === 'weekly' \? qi_validate_token\(\) : qi_require_auth\(\)/.test(comp));
  cek('POST tetap butuh login; daftar butuh PRO ke atas', /if \(\$metode === 'POST'\) \{\s*\$pengguna = qi_require_auth\(\);/.test(comp) && /PRO_REQUIRED/.test(comp));
  cek('?harga butuh PRO; ?trader publik dengan kode 12 heksa', /isset\(\$_GET\['harga'\]\)\) \{\s*qi_require_level\('pro'\);/.test(comp) && /\/\^\[0-9a-f\]\{12\}\$\//.test(comp));
  cek('batas laju GET 120/menit (papan dibaca dari cache 5 dtk)', /qi_rate_limit\(\$metode === 'POST' \? 30 : 120, 60\)/.test(comp));
  const lb = baca('api/leaderboard.php');
  cek('leaderboard.php = alias papan mingguan (pembangun yang sama)', /require_once __DIR__ \. '\/_kompetisi_papan\.php';/.test(lb) && /qi_komp_papan\(\$pdo\)/.test(lb) && !/FROM paper_positions/.test(lb));
  cek('leaderboard.php tidak lagi menjanjikan hadiah sendiri (prize = null)', /'prize'\s*=>\s*null/.test(lb) && !/\$reward = 'Free/.test(lb));
  const papan = baca('api/_kompetisi_papan.php');
  cek("pembangun papan: hanya source 'manual' + komp_periode", (papan.match(/pp\.source = 'manual' AND pp\.komp_periode = :p/g) || []).length >= 2);
  cek('papan dibangun satu proses sekaligus (flock) dan di-cache', /LOCK_EX \| LOCK_NB/.test(papan) && /QI_KOMP_PAPAN_TTL/.test(papan));
  const cron = baca('api/alert-cron.php');
  cek('alert-cron menjalankan qi_paper_settle untuk semua pengguna', /qi_paper_settle\(\$pdo, null\)/.test(cron) && /catch \(Throwable \$e\)/.test(cron));
  const mig = baca('database/migrations/027_kompetisi_live.sql');
  cek('migrasi 027 mendokumentasikan kolom & tabel klasemen', ['komp_periode', 'client_order_id', 'close_reason', 'sltp_checked_at', 'uq_pp_order', 'competition_standings'].every((k) => mig.includes(k)));
}

console.log(gagal ? `\n${gagal} uji GAGAL` : '\nSemua lulus');
process.exit(gagal ? 1 : 0);
