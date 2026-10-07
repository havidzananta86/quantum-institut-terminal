/**
 * Unit test — Correlation Matrix math (QuantumCorrelation)
 * Dependency-free. Loads the REAL assets/js/pro-trading-tools.js via a
 * minimal window/document shim, then asserts the pure math functions.
 *
 * Run:  node tests/correlation.test.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

// ---- minimal shim so the IIFE loads without a browser ----
const win = { addEventListener() {} };
const doc = {
  readyState: 'loading',          // prevents initProTools() from firing on load
  addEventListener() {},
  getElementById() { return null; },
  querySelectorAll() { return []; },
};
const src = fs.readFileSync(path.join(__dirname, '..', 'assets', 'js', 'pro-trading-tools.js'), 'utf8');
// The file ends with `})(window, document);` — feed our stubs as those identifiers.
new Function('window', 'document', src)(win, doc);

const C = win.QuantumCorrelation;
if (!C) { console.error('FAIL: QuantumCorrelation not exported'); process.exit(1); }

// ---- tiny assert harness ----
let passed = 0, failed = 0;
const EPS = 1e-9;
function ok(name, cond) {
  if (cond) { passed++; console.log('  ✓ ' + name); }
  else { failed++; console.error('  ✗ ' + name); }
}
function near(name, a, b, eps = 1e-9) { ok(`${name} (${a} ≈ ${b})`, Math.abs(a - b) <= eps); }

console.log('logReturns:');
(() => {
  const r = C.logReturns([100, 110, 121]);
  ok('length 2 from 3 closes', r.length === 2);
  near('ln(1.1) twice', r[0], Math.log(1.1), EPS);
  near('second equals first', r[1], Math.log(1.1), EPS);
  // any return-pair touching a non-positive price is skipped: 100→110 ok, 110→0 skip, 0→120 skip, 120→132 ok
  ok('skips pairs touching non-positive prices', C.logReturns([100, 110, 0, 120, 132]).length === 2);
  ok('empty on single value', C.logReturns([100]).length === 0);
})();

console.log('pearson:');
(() => {
  near('identical series = 1',  C.pearson([1, 2, 3, 4], [2, 4, 6, 8]),  1, 1e-12);
  near('negated series = -1',   C.pearson([1, 2, 3, 4], [8, 6, 4, 2]), -1, 1e-12);
  ok('NaN when < 2 points',     Number.isNaN(C.pearson([1], [1])));
  ok('NaN on zero variance',    Number.isNaN(C.pearson([5, 5, 5], [1, 2, 3])));
  // hand-computed: a=[1,2,3,4,5], b=[2,1,4,3,6] -> cov=10, va=10, vb=14.8 -> r = 10/sqrt(148)
  near('known case = 10/sqrt(148)', C.pearson([1, 2, 3, 4, 5], [2, 1, 4, 3, 6]), 10 / Math.sqrt(148), 1e-12);
  // symmetry
  near('symmetric', C.pearson([3, 1, 4, 1, 5], [9, 2, 6, 5, 3]), C.pearson([9, 2, 6, 5, 3], [3, 1, 4, 1, 5]), EPS);
})();

console.log('buildMatrix:');
(() => {
  const syms = ['A', 'B', 'C'];
  const rets = { A: [1, 2, 3, 4], B: [2, 4, 6, 8], C: [4, 3, 2, 1] };
  const m = C.buildMatrix(rets, syms);
  ok('3x3 shape', m.length === 3 && m.every(r => r.length === 3));
  ok('diagonal = 1', m[0][0] === 1 && m[1][1] === 1 && m[2][2] === 1);
  near('A/B perfectly correlated', m[0][1], 1, 1e-12);
  near('A/C perfectly anti-correlated', m[0][2], -1, 1e-12);
  near('symmetric off-diagonal', m[0][1], m[1][0], EPS);
})();

console.log('dayKey / alignByDay:');
(() => {
  ok('dayKey buckets same UTC day', C.dayKey(1791331200) === C.dayKey(1791331200 + 3600));
  ok('dayKey different days differ', C.dayKey(1791331200) !== C.dayKey(1791331200 + 86400));
  // two symbols whose epochs are offset within the same calendar days must still align
  const DAY = 86400;
  const base = 20000 * DAY;
  const A = [0,1,2,3,4].map(i => ({ d: C.dayKey(base + i*DAY),            c: 100 + i }));        // midnight
  const B = [0,1,2,3,4].map(i => ({ d: C.dayKey(base + i*DAY + 50000),    c: 200 + i*2 }));      // +~14h offset
  const { days, closesBySym } = C.alignByDay({ A, B }, ['A', 'B'], 10);
  ok('aligns across epoch offset (5 shared days)', days.length === 5);
  ok('A closes aligned in day order', JSON.stringify(closesBySym.A) === JSON.stringify([100,101,102,103,104]));
  ok('B closes aligned in day order', JSON.stringify(closesBySym.B) === JSON.stringify([200,202,204,206,208]));
  // intersection drops non-shared days (e.g. crypto weekend vs forex)
  const F = [0,1,2,3].map(i => ({ d: 100 + i, c: i }));          // days 100,101,102,103
  const X = [1,2,3,4].map(i => ({ d: 100 + i, c: i }));          // days 101,102,103,104
  const r2 = C.alignByDay({ F, X }, ['F', 'X'], 10);
  ok('intersection keeps only shared days', JSON.stringify(r2.days) === JSON.stringify([101,102,103]));
  // slice keeps the LAST `need` shared days
  const G = Array.from({length:10}, (_,i) => ({ d: 500 + i, c: i }));
  const r3 = C.alignByDay({ G }, ['G'], 3);
  ok('keeps last `need` days', JSON.stringify(r3.days) === JSON.stringify([507,508,509]));
})();

console.log('cellColor:');
(() => {
  ok('NaN -> neutral slate', /1e293b|64748b/.test(C.cellColor(NaN)));
  ok('null -> neutral slate', /1e293b/.test(C.cellColor(null)));
  ok('positive -> red rgba', /239,68,68/.test(C.cellColor(0.5)));
  ok('negative -> blue rgba', /59,130,246/.test(C.cellColor(-0.5)));
})();

console.log(`\n${failed === 0 ? 'PASS' : 'FAIL'} — ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
