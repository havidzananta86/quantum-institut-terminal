/**
 * Kripto 24/7 (BTC saat OANDA/broker tutup akhir pekan): lihat tests/kripto-24jam.test.php.
 * Run:  node tests/kripto-24jam.test.js
 * PHP binary: $PHP_BIN, else `php` from PATH (skips when absent).
 */
'use strict';
const path = require('path');
const { spawnSync } = require('child_process');

const fs = require('fs');
const PHP = process.env.PHP_BIN || (process.platform === 'win32' && fs.existsSync('D:/xamp/php/php.exe') ? 'D:/xamp/php/php.exe' : 'php');
const probe = spawnSync(PHP, ['-v'], { encoding: 'utf8' });
if (probe.error || probe.status !== 0) {
  console.error(`SKIP — PHP binary not runnable ("${PHP}"). Set PHP_BIN to enable the crypto 24/7 tests.`);
  process.exit(0);
}

// Run under two php.ini zones: the result must not depend on the server's default zone.
let failed = false;
for (const zone of ['UTC', 'Europe/Berlin']) {
  console.log(`[date.timezone=${zone}]`);
  const run = spawnSync(PHP, ['-d', `date.timezone=${zone}`, path.join(__dirname, 'kripto-24jam.test.php')], { encoding: 'utf8' });
  process.stdout.write(run.stdout || '');
  process.stderr.write(run.stderr || '');
  if (run.status !== 0) failed = true;
}
process.exit(failed ? 1 : 0);
