import"./Bzak7iHL.js";import"./DQttDCvw.js";import{p as B,_ as R,$ as F,a as f,s as e,a0 as M,c as t,a1 as y,r,t as A,b as D,f as g}from"./vnnAQmBw.js";import{h as E}from"./Di_Vksbt.js";import{s as b}from"./BbGUZXP3.js";import{i as z}from"./w5vomPQw.js";import{B as T}from"./C5--7Il0.js";import{u as I}from"./BPYnHL8L.js";var N=g('<meta name="description" content="@tradecanvas/analytics — bar-by-bar Backtester, Portfolio tracking, and risk metrics (Sharpe, Sortino, Calmar, max drawdown)."/>'),O=g(`<h1>Analytics</h1> <p><code>@tradecanvas/analytics</code> ships a headless, bar-by-bar strategy
  backtester with portfolio tracking and a summary risk-metrics calculator.
  Pair it with <a>replay mode</a> to visualize trades on the chart.</p> <!> <p style="font-size: 12.5px; color: var(--text-muted); margin-top: -16px; margin-bottom: 24px;">↑ Live SMA(10/30) cross-over backtest on 365 days of deterministic synthetic data.
  Scrub the slider or press Play to step through the equity curve bar-by-bar.</p> <h2>Backtester</h2> <p>Execution model:</p> <ul><li>Strategy fn runs at close of each bar.</li> <li>Orders placed on bar N fill on bar N+1 — market at open; limit/stop when the bar trades through the trigger price.</li> <li>Equity is marked to close of every bar.</li></ul> <pre><code></code></pre> <h2>StrategyContext</h2> <table><thead><tr><th>Field / method</th><th>Description</th></tr></thead><tbody><tr><td><code>bar</code></td><td>Current bar.</td></tr><tr><td><code>index</code></td><td>Index of <code>bar</code> in the input series.</td></tr><tr><td><code>history</code></td><td>Bars up to and including <code>bar</code>.</td></tr><tr><td><code>position</code></td><td>Current position or <code>null</code>.</td></tr><tr><td><code>cash</code></td><td>Available cash.</td></tr><tr><td><code>equity</code></td><td>Cash + mark-to-market position value.</td></tr><tr><td><code>placeOrder(order)</code></td><td>Queue order for next bar.</td></tr><tr><td><code>close(tag?)</code></td><td>Market-close current position.</td></tr><tr><td><code>cancel(orderId)</code></td><td>Cancel a pending order.</td></tr></tbody></table> <h2>Commission &amp; slippage models</h2> <ul><li><code>FixedCommission(perTrade)</code></li> <li><code>PercentCommission(rate)</code> — fraction of notional, e.g. <code>0.001</code> = 10 bps.</li> <li><code>PerShareCommission(perShare, minimum?)</code></li> <li><code>PercentSlippage(rate)</code> — adverse fraction of price.</li> <li><code>RangeBasedSlippage(factor)</code> — proportional to the bar's range.</li></ul> <h2>Portfolio</h2> <p>Tracks cash, one net position, realized P&amp;L, and the equity curve.</p> <pre><code></code></pre> <h2>Risk metrics</h2> <pre><code></code></pre> <p>Pair the result's <code>equityCurve</code> with <a>EquityCurveRenderer</a> to visualize backtests.</p> <h2>Strategy library</h2> <p>Drop-in reference strategies — each returns a <code>StrategyFn</code>:</p> <pre><code></code></pre> <h2>Monte Carlo</h2> <p>Shuffle the order of realised trades N times to expose path-dependence.
  A robust edge keeps the P5/P95 band tight; a strategy that depends on
  lucky sequencing fans wide.</p> <pre><code></code></pre>`,1);function K(v,k){B(k,!1);const{href:p}=I();z();var m=O();E("ynut8n",d=>{var l=N();R(()=>{F.title="Analytics & backtesting — TradeCanvas docs"}),f(d,l)});var a=e(M(m),2),C=e(t(a),2);y(),r(a);var h=e(a,2);T(h,{});var o=e(h,10),P=t(o);P.textContent=`import { Backtester, FixedCommission, PercentSlippage } from '@tradecanvas/analytics'

const bt = new Backtester({
  initialCash: 10_000,
  commission: new FixedCommission(2),
  slippage: new PercentSlippage(0.0005),
  allowShort: true,
})

const result = bt.run(historicalBars, (ctx) => {
  if (!ctx.position) {
    ctx.placeOrder({ side: 'long', type: 'market', quantity: 1 })
  } else if (ctx.bar.close > ctx.position.averagePrice * 1.02) {
    ctx.close()
  }
})

console.log(result.metrics.sharpe, result.metrics.maxDrawdownPct)`,r(o);var i=e(o,14),x=t(i);x.textContent=`const portfolio = new Portfolio({ initialCash: 10_000 })
portfolio.applyFill({ ... })
portfolio.mark(time, price)         // record equity point

portfolio.getPosition()             // → { side, quantity, averagePrice, ... } | null
portfolio.getTrades()               // → closed trades
portfolio.getEquityCurve()          // → equity points
portfolio.equity(price)             // mark-to-market`,r(i);var n=e(i,4),w=t(n);w.textContent=`import { computeRiskMetrics } from '@tradecanvas/analytics'

const m = computeRiskMetrics(initialCash, equityCurve, trades, {
  periodsPerYear: 252,    // optional; auto-detected from timestamps
  riskFreeRate: 0.03,
})

m.totalReturnPct
m.cagr
m.sharpe
m.sortino
m.calmar
m.maxDrawdownPct
m.winRate
m.profitFactor
m.expectancy`,r(n);var s=e(n,2),S=e(t(s),3);y(),r(s);var c=e(s,6),_=t(c);_.textContent=`import {
  Backtester,
  smaCrossStrategy,
  rsiReversionStrategy,
  donchianBreakoutStrategy,
  bollingerReversionStrategy,
} from '@tradecanvas/analytics'

const bt = new Backtester({ initialCash: 10_000 })
bt.run(bars, smaCrossStrategy({ fastPeriod: 10, slowPeriod: 30 }))`,r(c);var u=e(c,6),q=t(u);q.textContent=`import { runMonteCarlo } from '@tradecanvas/analytics'

const result = bt.run(bars, smaCrossStrategy())
const mc = runMonteCarlo(10_000, result.trades, {
  simulations: 1000,
  seed: 42,  // deterministic
})

mc.equityBands         // per-step P5/P25/P50/P75/P95
mc.finalEquityPercentiles  // { p5, p25, p50, p75, p95 }
mc.probabilityProfitable
mc.worstMaxDrawdownPct`,r(u),A((d,l)=>{b(C,"href",d),b(S,"href",l)},[()=>p("/docs/realtime"),()=>p("/docs/finance")]),f(v,m),D()}export{K as default};
