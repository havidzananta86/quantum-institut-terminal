// Sumber sinyal bayangan berbasis struktur (api/_setup_shadow.php): jalankan tes PHP di dua zona waktu
// php.ini supaya filter sesi tidak bergantung pada zona server.
// Run: node tests/setup-shadow.test.js   (PHP: $PHP_BIN, atau php dari PATH; dilewati bila tidak ada)
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const PHP = process.env.PHP_BIN || (process.platform === 'win32' && fs.existsSync('D:/xamp/php/php.exe') ? 'D:/xamp/php/php.exe' : 'php');
const probe = spawnSync(PHP, ['-v'], { encoding: 'utf8' });
if (probe.error || probe.status !== 0) {
  console.error(`SKIP — PHP binary not runnable ("${PHP}"). Set PHP_BIN to enable the shadow signal tests.`);
  process.exit(0);
}
let failed = false;
for (const zone of ['UTC', 'Asia/Jakarta']) {
  console.log(`[date.timezone=${zone}]`);
  const run = spawnSync(PHP, ['-d', `date.timezone=${zone}`, path.join(__dirname, 'setup-shadow.test.php')], { encoding: 'utf8' });
  process.stdout.write(run.stdout || '');
  process.stderr.write(run.stderr || '');
  if (run.status !== 0) failed = true;
}
process.exit(failed ? 1 : 0);
