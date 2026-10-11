/**
 * Cold-cache smoke test for the signals/chart endpoints.
 *
 * Why this exists: signals.php includes get-chart-data.php once per
 * timeframe. A warm cache skips that include, so a fatal in the include
 * path (e.g. an unguarded function redeclaration) only shows up for
 * symbols nobody has requested recently. That shipped to production once
 * and returned HTTP 500 with an empty body, which is invisible in logs
 * unless you look for it.
 *
 * So: clear the chart cache first, then request a spread of symbols,
 * including ones the homepage never asks for.
 *
 * Run:  SMOKE_BASE_URL=http://localhost:8788 node tests/api-smoke.test.js
 * Skipped when SMOKE_BASE_URL is unset, so `npm test` stays offline-safe.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const BASE = process.env.SMOKE_BASE_URL;
if (!BASE) {
  console.error('SKIP — set SMOKE_BASE_URL to run the API smoke test.');
  console.error('       Example: SMOKE_BASE_URL=http://localhost:8788 npm run test:smoke');
  process.exit(0);
}
if (typeof fetch !== 'function') {
  console.error('SKIP — global fetch unavailable (needs Node 18+).');
  process.exit(0);
}

// Symbols the homepage warms, plus ones it never touches (cold path).
const SYMBOLS = ['BTCUSDT', 'XAUUSD', 'ETHUSDT', 'EURUSD', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT'];
const FATAL = /Fatal error|Cannot redeclare|Parse error|Uncaught/i;

function clearChartCache() {
  const dir = path.join(__dirname, '..', 'cache', 'chart');
  if (!fs.existsSync(dir)) return 0;
  let n = 0;
  for (const f of fs.readdirSync(dir)) {
    if (f.endsWith('.json')) { try { fs.unlinkSync(path.join(dir, f)); n++; } catch (e) {} }
  }
  return n;
}

(async () => {
  const cleared = clearChartCache();
  console.log(`Cleared ${cleared} cached chart file(s) to force the cold path.\n`);

  let failed = 0;
  for (const sym of SYMBOLS) {
    const url = `${BASE}/api/signals.php?symbol=${sym}&timeframe=H1&engine=MULTI`;
    let status = 0, body = '';
    try {
      const res = await fetch(url, { headers: { 'Cache-Control': 'no-cache' } });
      status = res.status;
      body = await res.text();
    } catch (e) {
      failed++;
      console.log(`  ✗ ${sym.padEnd(9)} request failed: ${e.message}`);
      continue;
    }

    const fatal = FATAL.exec(body);
    if (status >= 500 || fatal) {
      failed++;
      console.log(`  ✗ ${sym.padEnd(9)} HTTP ${status}${fatal ? ` — ${fatal[0]}` : ' — empty/5xx body'}`);
    } else if (status !== 200) {
      failed++;
      console.log(`  ✗ ${sym.padEnd(9)} HTTP ${status} (expected 200)`);
    } else {
      console.log(`  ✓ ${sym.padEnd(9)} HTTP 200`);
    }
  }

  console.log(
    failed === 0
      ? `\nPASS — ${SYMBOLS.length} symbols served from a cold cache`
      : `\nFAIL — ${failed} of ${SYMBOLS.length} symbols failed`
  );
  process.exit(failed === 0 ? 0 : 1);
})();
