/**
 * Web Push crypto tests (RFC 8291 round-trip + VAPID ES256 verification) — runs tests/push.test.php.
 * Run: node tests/push.test.js   (PHP binary: $PHP_BIN, else `php`; skips when absent)
 */
'use strict';
const path = require('path');
const { spawnSync } = require('child_process');

const fs = require('fs');
const PHP = process.env.PHP_BIN || (process.platform === 'win32' && fs.existsSync('D:/xamp/php/php.exe') ? 'D:/xamp/php/php.exe' : 'php');
const probe = spawnSync(PHP, ['-v'], { encoding: 'utf8' });
if (probe.error || probe.status !== 0) {
  console.error(`SKIP — PHP binary not runnable ("${PHP}"). Set PHP_BIN to enable the push tests.`);
  process.exit(0);
}
const run = spawnSync(PHP, [path.join(__dirname, 'push.test.php')], { encoding: 'utf8' });
process.stdout.write(run.stdout || '');
process.stderr.write(run.stderr || '');
process.exit(run.status === 0 ? 0 : 1);
