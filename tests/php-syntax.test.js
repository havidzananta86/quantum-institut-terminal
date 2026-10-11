/**
 * Lint every PHP file with `php -l`.
 *
 * A parse error in an API file surfaces in production as HTTP 500 with an
 * empty body (display_errors is off there), so it is invisible until a user
 * reports it. This catches it before deploy.
 *
 * Run:  node tests/php-syntax.test.js
 * PHP binary: $PHP_BIN, else `php` from PATH.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const PHP = process.env.PHP_BIN || 'php';
const SKIP_DIRS = new Set(['node_modules', '.git', '.claude', 'cache', 'vendor']);

function findPhpFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') && entry.name !== '.htaccess') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) findPhpFiles(full, out);
    } else if (entry.name.endsWith('.php')) {
      out.push(full);
    }
  }
  return out;
}

const probe = spawnSync(PHP, ['-v'], { encoding: 'utf8' });
if (probe.error || probe.status !== 0) {
  console.error(`SKIP — PHP binary not runnable ("${PHP}").`);
  console.error('       Set PHP_BIN to your php executable to enable this check.');
  console.error('       Example: PHP_BIN="D:/xamp/php/php.exe" npm test');
  process.exit(0);
}

const files = findPhpFiles(ROOT).sort();
let failed = 0;

for (const file of files) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  const res = spawnSync(PHP, ['-l', file], { encoding: 'utf8' });
  const out = `${res.stdout || ''}${res.stderr || ''}`;
  if (res.status === 0 && /No syntax errors/.test(out)) {
    console.log(`  \u2713 ${rel}`);
  } else {
    failed++;
    console.log(`  \u2717 ${rel}`);
    console.log(`      ${out.trim().split('\n')[0]}`);
  }
}

console.log(
  failed === 0
    ? `\nPASS — ${files.length} PHP files parse cleanly`
    : `\nFAIL — ${failed} of ${files.length} PHP files have syntax errors`
);
process.exit(failed === 0 ? 0 : 1);
