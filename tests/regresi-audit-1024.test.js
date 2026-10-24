/**
 * Regresi dari audit backend 2026-10-24 (setiap temuan direproduksi agen terpisah sebelum diperbaiki):
 *
 *  1. rencana-live.php & engine-server.php menyajikan data panel PRO ke tamu / akun gratis.
 *  2. live-trade.php: queue_manual (order uang nyata) lolos dari gerbang paket.
 *  3. Simbol broker berhuruf kecil ("XAUUSD.pro") selalu ditolak guardrail (in_array peka huruf).
 *  4. Kesegaran EA dihitung dengan strtotime(NOW() MySQL . ' UTC') → EA "mati" bila MySQL tidak UTC.
 *  5. ai-chat.php membaca curl_error() SEBELUM curl_exec().
 *  6. chart-state menjanjikan 512 KB, middleware memotong di 64 KB.
 *  7. payment.php menurunkan VIP/admin menjadi 'pro'.
 *  8. Gerbang feed MT5 'owner' bisa dilewati dengan mendaftarkan nomor pemilik sebagai MT4.
 *  9. Input larik (?x[]=1 / JSON ["x"]) → TypeError HTTP 500; nama kompetisi tersimpan "Array".
 * 10. Kunci minggu ISO 2026-W99 / W00 diterima dan digulir diam-diam ke minggu lain.
 *
 * Run:  node tests/regresi-audit-1024.test.js
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

console.log('Gerbang PRO');
cek('rencana-live.php wajib PRO', /qi_require_level\('pro'\)/.test(baca('api/rencana-live.php')));
cek('engine-server.php wajib PRO', /qi_require_level\('pro'\)/.test(baca('api/engine-server.php')));
cek('dashboard tidak meminta rencana-live untuk akun gratis', /if \(qiTingkatSaatIni\(\) >= 1\) try \{\s*\n?\s*const res2 = await fetch\('api\/rencana-live\.php/.test(baca('assets/js/dashboard-app.js').replace(/\r/g, '')));
const lt = baca('api/live-trade.php');
cek('queue_manual ikut gerbang paket', /in_array\(\$action, \[[^\]]*'queue_manual'[^\]]*\], true\)\s*&& !qi_exec_role_boleh/.test(lt));

console.log('Eksekusi');
cek('live-trade: simbol dicocokkan lewat qi_exec_simbol_diizinkan', /qi_exec_simbol_diizinkan\(\$account, \$symbol\)/.test(lt) && !/in_array\(\$symbol, \$allowed/.test(lt));
const mx = baca('api/mt-execution.php');
cek('mt-execution: simbol dicocokkan lewat qi_exec_simbol_diizinkan', /qi_exec_simbol_diizinkan\(\$profile,/.test(mx) && !/in_array\(\$order\['symbol'\]/.test(mx));
const ex = baca('api/_execution.php');
cek('kesegaran EA dari UNIX_TIMESTAMP MySQL, bukan strtotime', /UNIX_TIMESTAMP\(updated_at\)/.test(ex) && !/strtotime\([^)]*diperbarui/.test(ex));

console.log('Lain-lain');
const ai = baca('api/ai-chat.php');
cek('ai-chat: curl_error dibaca setelah curl_exec', ai.indexOf('curl_exec($ch)') > 0 && ai.indexOf('curl_error($ch)') > ai.indexOf('curl_exec($ch)'));
cek('chart-state memberi batas body ≥ 2 × 512 KB', /qi_get_json_body\(2 \* 524288/.test(baca('api/chart-state.php')));
cek('qi_get_json_body menerima batas per endpoint', /function qi_get_json_body\(int \$maksByte = 65536\)/.test(baca('api/_middleware.php')));
const pay = baca('api/payment.php');
cek("payment tidak menurunkan VIP/admin", /UPDATE users SET role = 'pro' WHERE id = :uid AND role NOT IN \([^)]*'vip'[^)]*'admin'/.test(pay));
cek('payment memperpanjang dari lisensi aktif terakhir', /GREATEST\(NOW\(\), COALESCE\(MAX\(expires_at\)/.test(pay));
for (const f of ['api/mt5-bridge-token.php', 'api/_middleware.php']) {
  const s = baca(f);
  cek(`${f}: gerbang owner hanya provider MT5`, !/LIKE 'mt%'/.test(s) && /provider = 'MT5'/.test(s));
}

const probe = spawnSync(PHP, ['-v'], { encoding: 'utf8' });
if (probe.error || probe.status !== 0) {
  console.error(`\nSKIP — PHP binary tidak dapat dijalankan ("${PHP}").`);
  console.log(gagal ? `\n${gagal} uji GAGAL` : '\nSemua lulus (bagian PHP dilewati)');
  process.exit(gagal ? 1 : 0);
}
console.log('\nFungsi PHP');
const kode = `
require ${JSON.stringify(path.join(root, 'api/_middleware.php'))};
require ${JSON.stringify(path.join(root, 'api/_execution.php'))};
require ${JSON.stringify(path.join(root, 'api/_kompetisi_inti.php'))};
echo json_encode([
  'str_larik' => qi_str(['x'], 'HIGH'), 'str_teks' => qi_str('abc'), 'str_angka' => qi_str(5), 'str_null' => qi_str(null, 'd'),
  'simbol_kecil' => qi_exec_simbol_diizinkan(['allowed_symbols' => '["XAUUSD.PRO"]'], 'XAUUSD.pro'),
  'simbol_lain' => qi_exec_simbol_diizinkan(['allowed_symbols' => '["XAUUSD.PRO"]'], 'GBPUSD'),
  'w42' => qi_komp_batas_periode('2026-W42') !== null, 'w53' => qi_komp_batas_periode('2026-W53') !== null,
  'w99' => qi_komp_batas_periode('2026-W99'), 'w00' => qi_komp_batas_periode('2026-W00'),
]);`;
const r = spawnSync(PHP, ['-r', kode], { encoding: 'utf8' });
let h = null;
try { h = JSON.parse((r.stdout || '').trim().split('\n').pop()); } catch (e) { cek('PHP menjawab JSON', false, (r.stdout || '') + (r.stderr || '')); }
if (h) {
  cek('qi_str: larik → nilai bawaan', h.str_larik === 'HIGH');
  cek('qi_str: teks & angka utuh, null → bawaan', h.str_teks === 'abc' && h.str_angka === '5' && h.str_null === 'd');
  cek('simbol broker huruf kecil diizinkan', h.simbol_kecil === true);
  cek('simbol di luar daftar tetap ditolak', h.simbol_lain === false);
  cek('minggu ISO sah (W42, W53 di 2026) diterima', h.w42 && h.w53);
  cek('minggu ISO mustahil (W99, W00) ditolak', h.w99 === null && h.w00 === null);
}

console.log(gagal ? `\n${gagal} uji GAGAL` : '\nPASS — regresi audit 2026-10-24 terkunci');
process.exit(gagal ? 1 : 0);
