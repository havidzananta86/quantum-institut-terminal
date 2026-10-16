/**
 * Unit test — QIM indicators (PSAR, Keltner, SuperTrend, liquidity, candle
 * patterns) and trading tools (Monte Carlo, contract specs).
 * Dependency-free: loads the REAL assets/js/qim-*.js through a minimal shim.
 *
 * Run:  node tests/qim-tools.test.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const win = { addEventListener() {} };
const doc = {
  readyState: 'loading',            // keeps install()/init() from running on load
  addEventListener() {},
  getElementById() { return null; },
  querySelectorAll() { return []; },
};
for (const file of ['qim-indicators.js', 'qim-trading-tools.js']) {
  const src = fs.readFileSync(path.join(__dirname, '..', 'assets', 'js', file), 'utf8');
  new Function('window', 'document', src)(win, doc);
}
const I = win.QIMIndicators && win.QIMIndicators.calc;
const T = win.QIMTools;
if (!I || !T) { console.error('FAIL: QIMIndicators / QIMTools not exported'); process.exit(1); }

let passed = 0, failed = 0;
function ok(name, cond) {
  if (cond) { passed++; console.log('  ✓ ' + name); }
  else { failed++; console.error('  ✗ ' + name); }
}

// Deterministic synthetic candles: a steady uptrend, then a steady downtrend.
function trendCandles(n, start, step) {
  const out = [];
  let price = start;
  for (let i = 0; i < n; i++) {
    const open = price, close = price + step;
    out.push({ time: 1000 + i * 3600, open, close, high: Math.max(open, close) + 0.5, low: Math.min(open, close) - 0.5 });
    price = close;
  }
  return out;
}
const up = trendCandles(60, 100, 1);
const down = trendCandles(60, 160, -1).map((c, i) => ({ ...c, time: up[up.length - 1].time + (i + 1) * 3600 }));

console.log('ATR:');
(() => {
  const atr = I.atrSeries(up, 14);
  ok('null before period', atr[13] === null);
  ok('true range of steady candles is 2', Math.abs(atr[30] - 2) < 1e-9);
})();

console.log('Parabolic SAR:');
(() => {
  const s = I.calcParabolicSAR(up);
  ok('below price in uptrend', s.slice(5).every((p, i) => p.value < up[i + 6].low));
  ok('flips above price in downtrend', I.calcParabolicSAR(up.concat(down)).slice(-5).every(p => p.color === '#ef5350'));
})();

console.log('Keltner Channel:');
(() => {
  const kc = I.calcKeltner(up);
  const last = kc.middle.length - 1;
  ok('upper > middle > lower', kc.upper[last].value > kc.middle[last].value && kc.middle[last].value > kc.lower[last].value);
  ok('band width = 2 × ATR10 each side', Math.abs((kc.upper[last].value - kc.middle[last].value) - 4) < 1e-9);
})();

console.log('SuperTrend:');
(() => {
  const st = I.calcSuperTrend(up.concat(down));
  const lastUp = st.up[st.up.length - 1], lastDown = st.down[st.down.length - 1];
  ok('bearish at the end of the downtrend', lastUp.value === undefined && lastDown.value > 0);
  const earlyUp = st.up[20];
  ok('bullish during the uptrend', earlyUp.value > 0);
})();

console.log('Candle patterns:');
(() => {
  // ≥ 15 bars: patterns are only scored once ATR(14) exists.
  const base = trendCandles(20, 110, -1);             // prior downtrend, ends at 90
  const t = base[base.length - 1].time;
  const bearish = { time: t + 3600, open: 91, close: 90, high: 91.2, low: 89.8 };
  const engulf = { time: t + 7200, open: 89.8, close: 92, high: 92.2, low: 89.6 };
  const marks = I.detectCandlePatterns(base.concat([bearish, engulf]));
  ok('bullish engulfing after downtrend', marks.some(m => m.time === engulf.time && m.text === 'Bull Engulf' && m.position === 'belowBar'));
  const hammerSeries = base.concat([{ time: t + 3600, open: 90, close: 90.3, high: 90.4, low: 87 }]);
  ok('hammer after downtrend', I.detectCandlePatterns(hammerSeries).some(m => m.text === 'Hammer'));
  const upBase = trendCandles(20, 90, 1);              // prior uptrend, ends at 110
  const shooting = upBase.concat([{ time: upBase[19].time + 3600, open: 110, close: 109.7, high: 113, low: 109.6 }]);
  ok('no hammer label in an uptrend', !I.detectCandlePatterns(shooting).some(m => m.text === 'Hammer'));
  ok('shooting star after uptrend', I.detectCandlePatterns(shooting).some(m => m.text === 'Shooting Star'));
})();

console.log('Liquidity zones:');
(() => {
  // Range with two equal swing highs at 120 that price never revisits, ending lower.
  const c = [];
  const push = (h, l, close) => c.push({ time: 1000 + c.length * 3600, open: (h + l) / 2, high: h, low: l, close });
  for (let i = 0; i < 20; i++) push(110, 108, 109);
  [114, 117, 120, 117, 114].forEach(h => push(h, h - 2, h - 1));
  for (let i = 0; i < 6; i++) push(110, 108, 109);
  [114, 117, 120, 117, 114].forEach(h => push(h, h - 2, h - 1));
  for (let i = 0; i < 10; i++) push(110, 108, 109);
  const z = I.calcLiquidityZones(c);
  ok('equal highs at 120 become buy-side liquidity', z.bsl.length === 1 && z.bsl[0].level === 120 && z.bsl[0].touches === 2);
  push(121, 115, 116);                                  // sweep the highs
  ok('swept level is dropped', I.calcLiquidityZones(c).bsl.every(b => b.level !== 120));
})();

console.log('Monte Carlo:');
(() => {
  const args = { sampleR: r => (r() < 0.5 ? 2 : -1), riskPct: 1, trades: 100, paths: 500, ruinPct: 50, startBalance: 10000 };
  const a = T.monteCarlo(args), b = T.monteCarlo(args);
  ok('deterministic for identical input', JSON.stringify(a) === JSON.stringify(b));
  ok('percentiles ordered p5 ≤ p50 ≤ p95', a.p5 <= a.p50 && a.p50 <= a.p95);
  ok('positive edge at 1% risk never ruins', a.ruinProb === 0);
  const losing = T.monteCarlo({ ...args, sampleR: () => -1, riskPct: 10 });
  ok('always-losing strategy is always ruined', losing.ruinProb === 100 && losing.lossProb === 100);
})();

console.log('Contract specs:');
(() => {
  ok('gold is 100 oz per lot', T.SPECS.XAUUSD.units === 100);
  ok('forex is 100,000 units per lot', ['EURUSD', 'USDJPY', 'GBPUSD'].every(s => T.SPECS[s].units === 100000));
  ok('JPY pip is 0.01', T.SPECS.USDJPY.pip === 0.01);
})();

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
