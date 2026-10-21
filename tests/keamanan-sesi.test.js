/**
 * Batch 3 keamanan — tiga lubang yang ditemukan audit 2026-10-20:
 *   1. akun yang dinonaktifkan admin TETAP bisa memakai terminal sampai 30 hari,
 *      karena validasi token hanya mencocokkan token + masa berlaku;
 *   2. mengganti kata sandi TIDAK mencabut sesi lain, sehingga token yang sudah dicuri
 *      tetap hidup sampai kedaluwarsa sendiri;
 *   3. api/health.php tanpa rate limit dan membocorkan versi PHP persis, sisa disk,
 *      serta nama host bridge VPS lewat ?bridges=1.
 *
 * Run:  node tests/keamanan-sesi.test.js
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

// ── 1. Akun non-aktif kehilangan akses seketika ──────────────────────────────
console.log('Akun dinonaktifkan → sesi tidak lagi sah');
const mw = baca('api/_middleware.php');
const kueri = (mw.match(/SELECT u\.id, u\.email, u\.role, s\.expires_at[\s\S]*?\)"\);/) || [''])[0];
cek('query validasi token ditemukan', kueri.length > 0);
cek('memeriksa u.is_active = 1', /u\.is_active\s*=\s*1/.test(kueri));
cek('menolak status banned/suspended/inactive/disabled', /LOWER\(u\.status\) NOT IN \('banned','suspended','inactive','disabled'\)/.test(kueri));
cek('status kosong/NULL tetap dianggap sah (tidak mengunci akun lama)', /u\.status IS NULL OR/.test(kueri));

const au = baca('api/admin-users.php');
cek('menonaktifkan akun ikut menghapus sesinya', /DELETE FROM user_sessions WHERE user_id = :id/.test(au));
cek('penghapusan sesi HANYA saat akun dinonaktifkan', /if \(\$aktif === 0\) \{[\s\S]{0,320}DELETE FROM user_sessions/.test(au));
cek('jumlah sesi yang dicabut dilaporkan ke admin', /'sesi_dicabut'\s*=>\s*\$sesiDihapus/.test(au));
cek('dicatat ke log audit', /qi_log\('warning', 'Akun dinonaktifkan admin, sesi dicabut'/.test(au));

// ── 2. Ganti kata sandi mencabut sesi lain ───────────────────────────────────
console.log('\nGanti kata sandi → perangkat lain dikeluarkan');
const cp = baca('api/change-password.php');
cek('sesi lain dihapus', /DELETE FROM user_sessions WHERE user_id = :id AND token <> :token/.test(cp));
cek('sesi yang sedang dipakai dipertahankan (token <> token sekarang)', /:token'\s*=>\s*hash\('sha256', \$tokenIni\)/.test(cp));
cek('token tidak terbaca → cabut SEMUA sesi (gagal ke sisi aman)', /else \{[\s\S]{0,260}DELETE FROM user_sessions WHERE user_id = :id'\)/.test(cp));
cek('pencabutan terjadi SETELAH kata sandi benar-benar tersimpan', cp.indexOf('UPDATE users SET password_hash') < cp.indexOf('DELETE FROM user_sessions'));
cek('kegagalan pencabutan tidak membatalkan penggantian sandi', /catch \(Throwable \$e\) \{\s*error_log\('\[QI ChangePassword\] Pencabutan sesi gagal/.test(cp));
cek('pengguna diberi tahu berapa perangkat yang dikeluarkan', /perangkat lain telah dikeluarkan/.test(cp));

// Helper token dipakai bersama, bukan disalin ulang.
cek('qi_token_mentah() tersedia di _middleware.php', /function qi_token_mentah\(\): \?string/.test(mw));
cek('qi_validate_token() memakai helper yang sama', /function qi_validate_token\(\) \{\s*\$token = qi_token_mentah\(\);/.test(mw));
// Hanya hitung pemakaian sungguhan, bukan penyebutan di komentar.
cek('penguraian header Authorization tidak diduplikasi', (mw.match(/\$_SERVER\['REDIRECT_HTTP_AUTHORIZATION'\]/g) || []).length === 1);

// ── 3. health.php ────────────────────────────────────────────────────────────
console.log('\nhealth.php: rate limit + detail khusus admin');
const h = baca('api/health.php');
cek('memuat _middleware.php', /require_once __DIR__ \. '\/_middleware\.php';/.test(h));
cek('dibatasi rate limit', /qi_rate_limit\(30, 60\)/.test(h));
cek('rate limit tidak menjatuhkan health check bila cache tidak writable', /try \{ qi_rate_limit\(30, 60\); \} catch \(Throwable \$e\)/.test(h));
cek('peran admin ditentukan dari token', /qi_tingkat_peran\(\$qiUser\['role'\] \?\? null\) >= 3/.test(h));
cek('versi PHP hanya untuk admin', /if \(\$qiAdmin\) \$checks\['php_version'\]/.test(h));
cek('sisa disk GB hanya untuk admin', /if \(\$qiAdmin\) \$checks\['disk_free_gb'\]/.test(h));
cek('?bridges=1 anonim dijawab admin_only', /isset\(\$_GET\['bridges'\]\) && !\$qiAdmin/.test(h) && /'admin_only'/.test(h));
cek('disk_pct_used tetap publik (dipakai halaman status)', /\$checks\['disk_pct_used'\] = round/.test(h) && !/if \(\$qiAdmin\) \$checks\['disk_pct_used'\]/.test(h));

// ── 4. Berkas yang tidak boleh terbuka ───────────────────────────────────────
console.log('\n.htaccess: berkas internal tertutup');
const ht = baca('.htaccess');
cek('folder tools/ diblokir', /\^\(mt5-bridge\|tv-bridge\|deploy\|pine\|tools\|/.test(ht));
cek('vercel.json diblokir', /vercel\\\.json/.test(ht));
cek('tailwind.config.js diblokir', /tailwind\\\.config\\\.js/.test(ht));

// ── Bagian PHP: health.php benar-benar dijalankan ────────────────────────────
const probe = spawnSync(PHP, ['-v'], { encoding: 'utf8' });
if (probe.error || probe.status !== 0) {
  console.error(`\nSKIP — PHP binary tidak dapat dijalankan ("${PHP}").`);
  console.log(gagal ? `\n${gagal} uji GAGAL` : '\nSemua lulus (bagian PHP dilewati)');
  process.exit(gagal ? 1 : 0);
}
console.log('');
const run = spawnSync(PHP, [path.join(__dirname, 'keamanan-sesi.test.php')], { encoding: 'utf8' });
process.stdout.write(run.stdout || '');
process.stderr.write(run.stderr || '');
if (run.status !== 0) gagal++;

console.log(gagal ? `\n${gagal} uji GAGAL` : '\nPASS — sesi dicabut saat perlu, health.php tidak lagi telanjang');
process.exit(gagal ? 1 : 0);
