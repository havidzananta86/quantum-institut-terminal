/**
 * Signal expiry + timezone regression tests: expired signals close as EXPIRED (never a win
 * or a loss), new signal times are ISO 8601 UTC, and old naive timestamps are read the
 * same way by every entry point (api/_signal_time.php, api/signal-evaluator.php).
 *
 * Run:  node tests/signal-time.test.js
 * PHP binary: $PHP_BIN, else `php` from PATH (skips like php-syntax.test.js when absent).
 */
'use strict';
const path = require('path');
const { spawnSync } = require('child_process');

const fs = require('fs');
const PHP = process.env.PHP_BIN || (process.platform === 'win32' && fs.existsSync('D:/xamp/php/php.exe') ? 'D:/xamp/php/php.exe' : 'php');
const probe = spawnSync(PHP, ['-v'], { encoding: 'utf8' });
if (probe.error || probe.status !== 0) {
  console.error(`SKIP — PHP binary not runnable ("${PHP}"). Set PHP_BIN to enable the signal time tests.`);
  process.exit(0);
}

// Run under two php.ini zones: the result must not depend on the server's default zone.
let failed = false;
for (const zone of ['UTC', 'Europe/Berlin']) {
  console.log(`[date.timezone=${zone}]`);
  const run = spawnSync(PHP, ['-d', `date.timezone=${zone}`, path.join(__dirname, 'signal-time.test.php')], { encoding: 'utf8' });
  process.stdout.write(run.stdout || '');
  process.stderr.write(run.stderr || '');
  if (run.status !== 0) failed = true;
}
process.exit(failed ? 1 : 0);
