// Port PHP indikator Pine SMC+SnD (api/_pine_smcsnd.php) harus identik dengan port JS (yang sudah dicocokkan
// dengan TradingView). Dibandingkan pada banyak titik potong fixture 5.000 bar H4 OANDA.
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const JS = require('../assets/js/qim-pine-smcsnd.js');

let gagal = 0;
function cek(nama, kondisi, info) { console.log((kondisi ? '  ✓ ' : '  ✗ ') + nama + (kondisi || info === undefined ? '' : '  ' + JSON.stringify(info).slice(0, 400))); if (!kondisi) gagal++; }

const PHP = process.env.PHP_BIN || (process.platform === 'win32' && fs.existsSync('D:/xamp/php/php.exe') ? 'D:/xamp/php/php.exe' : 'php');
if (spawnSync(PHP, ['-v'], { encoding: 'utf8' }).error) { console.error(`SKIP — PHP binary not runnable ("${PHP}")`); process.exit(0); }

const fx = path.join(__dirname, 'fixtures', 'xauusd_h4_oanda.json');
const semua = JSON.parse(fs.readFileSync(fx, 'utf8')).candles.map(r => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] }));
const potong = [];
for (let n = 400; n <= semua.length; n += 173) potong.push(n);
potong.push(semua.length);

console.log('Port PHP = port JS (' + potong.length + ' titik potong)');
const run = spawnSync(PHP, [path.join(__dirname, 'pine-php.run.php'), fx, potong.join(',')], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
if (run.status !== 0) { console.log(run.stdout, run.stderr); cek('PHP berjalan', false); process.exit(1); }
const php = JSON.parse(run.stdout);

const dekat = (a, b) => (a === null && b === null) || (typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) <= 1e-7 * Math.max(1, Math.abs(a)));
const samaZ = (zj, zp) => zj.length === zp.length && zj.every((b, k) => Math.abs(b.top - zp[k][0]) < 2e-6 && Math.abs(b.bottom - zp[k][1]) < 2e-6);
let beda = [], jumlahValid = 0;
for (const n of potong) {
  const j = JS.hitung(semua.slice(0, n)), p = php[String(n)];
  const a = j.ema13.length - 1;
  const lvl = (x, y) => ['entry', 'sl', 'tp1', 'tp2', 'tp3'].every(k => dekat(x[k], y[k])) && x.status === y.status;
  const ok = j.ok === p.ok
    && dekat(j.ema13[a], p.ema13) && dekat(j.ema21[a], p.ema21) && dekat(j.ema100[a], p.ema100) && dekat(j.ema200[a], p.ema200) && dekat(j.atr[a], p.atr)
    && samaZ(j.zona.supply, p.supply) && samaZ(j.zona.demand, p.demand)
    && j.bos.supply.length === p.bos.supply && j.bos.demand.length === p.bos.demand
    && lvl(j.buy, p.buy) && lvl(j.sell, p.sell);
  if (!ok) beda.push(n);
  if (j.buy.valid || j.sell.valid) jumlahValid++;
}
cek('EMA 13/21/100/200, ATR, zona supply/demand, BOS, level & status identik di semua titik potong', beda.length === 0, { beda: beda.slice(0, 5) });
cek('uji mencakup status VALID sungguhan (bukan hanya WAIT)', jumlahValid > 0, { jumlahValid });
const akhir = php[String(semua.length)];
cek('bar terakhir fixture: nilai sama dengan angka TradingView yang dikunci di uji JS (EMA13 4 desimal)', Math.abs(akhir.ema13 - JS.hitung(semua).ema13.at(-1)) < 1e-9);

const sinyal = spawnSync(PHP, [path.join(__dirname, 'pine-sinyal.test.php')], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
process.stdout.write(sinyal.stdout || ''); process.stderr.write(sinyal.stderr || '');
if (sinyal.status !== 0) gagal++;

console.log(gagal ? `\n${gagal} GAGAL` : '\nSemua lulus');
process.exit(gagal ? 1 : 0);
