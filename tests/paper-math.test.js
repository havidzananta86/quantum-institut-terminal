/**
 * Paper-trading P/L model parity: assets/js/qim-paper-math.js (browser) must give the same
 * result as qi_paper_pnl() in api/_paper_math.php (server), otherwise the floating P/L a
 * user sees differs from what is stored when the trade closes.
 *
 * Run: node tests/paper-math.test.js   (PHP binary: $PHP_BIN, else `php`; skips when absent)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { qimPaperPnl, qimPaperMult } = require('../assets/js/qim-paper-math.js');

const KASUS = [
  ['EURUSD', 'BUY', 1.1, 1.101, 1],
  ['GBPUSD', 'SELL', 1.3, 1.29, 0.5],
  ['AUDUSD', 'BUY', 0.69, 0.6925, 0.2],
  ['USDJPY', 'BUY', 150, 151, 1],
  ['USDJPY', 'SELL', 158.2, 157.9, 0.3],
  ['XAUUSD', 'SELL', 4000, 3990, 0.1],
  ['BTCUSDT', 'BUY', 80000, 81000, 0.01],
  ['ETHUSDT', 'SELL', 2450, 2400, 2],
  ['DOGEUSDT', 'BUY', 0.08, 0.085, 1000],
];

let gagal = 0;
const cek = (nama, lulus, info) => { console.log(`  ${lulus ? '✓' : '✗'} ${nama}${lulus ? '' : ' — ' + info}`); if (!lulus) gagal++; };

// Known-correct values (1 standard lot = 100,000 units for FX).
cek('EURUSD 1 lot +10 pips = $100', qimPaperPnl('EURUSD', 'BUY', 1.1, 1.101, 1) === 100, qimPaperPnl('EURUSD', 'BUY', 1.1, 1.101, 1));
cek('USDJPY 1 lot +100 pips at 151 ≈ $662.25', qimPaperPnl('USDJPY', 'BUY', 150, 151, 1) === 662.25, qimPaperPnl('USDJPY', 'BUY', 150, 151, 1));
cek('XAUUSD 0.1 lot -$10 move = +$100 on SELL', qimPaperPnl('XAUUSD', 'SELL', 4000, 3990, 0.1) === 100, '');
cek('USD-base pair without price keeps legacy 1000', qimPaperMult('USDJPY') === 1000, qimPaperMult('USDJPY'));

const PHP = process.env.PHP_BIN || (process.platform === 'win32' && fs.existsSync('D:/xamp/php/php.exe') ? 'D:/xamp/php/php.exe' : 'php');
const berkasPhp = path.join(__dirname, '..', 'api', '_paper_math.php');
const probe = spawnSync(PHP, ['-v'], { encoding: 'utf8' });
if (probe.error || probe.status !== 0 || !fs.existsSync(berkasPhp)) {
  console.log('  - SKIP PHP parity (PHP binary or api/_paper_math.php not available)');
} else {
  const kode = `require ${JSON.stringify(berkasPhp)}; $k = json_decode($argv[1], true); $o = [];
    foreach ($k as $c) $o[] = qi_paper_pnl($c[0], $c[1], (float)$c[2], (float)$c[3], (float)$c[4]);
    echo json_encode($o);`;
  const run = spawnSync(PHP, ['-r', kode, JSON.stringify(KASUS)], { encoding: 'utf8' });
  let php = null;
  try { php = JSON.parse(run.stdout); } catch (e) { cek('PHP output parse', false, run.stdout + run.stderr); }
  if (php) KASUS.forEach((c, i) => {
    const js = qimPaperPnl(...c);
    cek(`parity ${c[0]} ${c[1]} ${c[2]}→${c[3]} × ${c[4]}`, Math.abs(js - php[i]) < 0.005, `JS ${js} vs PHP ${php[i]}`);
  });
}

console.log(gagal ? `\nFAIL — ${gagal} paper-math check(s) failed` : '\nPASS — paper P/L model consistent');
process.exit(gagal ? 1 : 0);
