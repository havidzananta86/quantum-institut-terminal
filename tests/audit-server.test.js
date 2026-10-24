/**
 * Sisa kontrak SERVER dari audit panel 2026-10-21 (tests/audit-panel.test.js lama).
 *
 * Berkas lama mengunci perbaikan 33 panel dashboard panel-lama — panel-panel itu sudah dibuang
 * (dashboard kini chart-first, tests/mobile.test.js), jadi pemeriksaan teks panelnya ikut dihapus.
 * Yang dipertahankan di sini hanya yang menjaga kode server yang masih hidup.
 *
 * Run:  node tests/audit-server.test.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const baca = (f) => fs.readFileSync(path.join(root, f), 'utf8');
let gagal = 0;
const cek = (nama, lulus, info) => {
  console.log(`  ${lulus ? '✓' : '✗'} ${nama}${lulus || info === undefined ? '' : '  ' + JSON.stringify(info)}`);
  if (!lulus) gagal++;
};

console.log('News Impact (galat 25/27)');
{
  const ni = baca('api/news-impact.php');
  cek('jumlah rilis dihitung server', /array_sum\(array_column\(\$filtered, 'rel'\)\)/.test(ni));
  cek('jendela News Impact dibatasi ke yang datanya ada (30m & 1h)', /in_array\(\(\$_GET\['window'\] \?\? '1h'\), \['30m', '1h'\], true\)/.test(ni));
}

console.log('\nKalender ekonomi');
{
  const cal = baca('api/calendar.php');
  cek('server kalender mendukung last/this/next', /'last' => 'ff_calendar_lastweek\.json'/.test(cal));
  cek('hanya minggu berjalan yang menulis cache/calendar.json (dipakai pipeline sinyal)', /\$week === 'this' \? '\/calendar\.json'/.test(cal));
}

console.log('\nDokumentasi yang bertentangan dengan kodenya (galat 65)');
{
  const lb = baca('api/leaderboard.php');
  cek('komentar leaderboard tidak lagi mengaku publik', !/public, tidak butuh auth/.test(lb));
  cek('komentar menyebut syarat PRO yang sebenarnya', /BUTUH PAKET PRO/.test(lb) && /qi_require_level\('pro'\)/.test(lb));
}

console.log(gagal ? `\n${gagal} uji GAGAL` : '\nPASS — kontrak server audit panel terjaga');
process.exit(gagal ? 1 : 0);
