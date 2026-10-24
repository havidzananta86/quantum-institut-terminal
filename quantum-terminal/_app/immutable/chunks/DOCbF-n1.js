import"./Bzak7iHL.js";import"./DQttDCvw.js";import{p as j,_ as K,$ as V,a as k,s as e,a0 as z,c as t,r as a,a1 as Y,t as F,b as $,f as T}from"./vnnAQmBw.js";import{h as G}from"./Di_Vksbt.js";import{s as J}from"./BbGUZXP3.js";import{i as Z}from"./w5vomPQw.js";import{u as X}from"./BPYnHL8L.js";var ee=T('<meta name="description" content="Streaming data adapters, tick aggregation, reconnect logic, and the new ReplayController for historical playback."/>'),te=T(`<h1>Realtime &amp; replay</h1> <p>Stream live data, aggregate ticks into bars, and replay historical data at controlled speed.</p> <h2>Built-in adapters</h2> <p>All free, no API key — connect any of them the same way:</p> <pre><code></code></pre> <h2>Forex with Twelve Data</h2> <p><code>TwelveDataAdapter</code> reads the provider's daily-updated Forex pair catalog and OHLC history
  through REST polling. It supports slash-delimited pairs such as <code>EUR/USD</code>, including major,
  minor and exotic pairs. The free plan requires an API key and has provider rate limits, so cache data
  or put the key behind your own proxy in a production app.</p> <pre><code></code></pre> <h2>DataAdapter interface</h2> <pre><code></code></pre> <h2 id="symbol-info">Symbol details the feed learns later</h2> <p>A connected chart asks <code>resolveSymbol</code> once. A feed that learns the symbol's details only later (on its first message, say) sends them with a <code>symbolInfo</code> event, and the chart applies them: the price scale, legend and tags in the symbol's decimals (<code>pricePrecision</code>), the scale's ticks on its price step (<code>minTick</code>), the exchange's hours.</p> <pre><code></code></pre> <h2>Any feed in ~20 lines</h2> <p>Extend <code>WebSocketAdapter</code> (live + REST history) or <code>PollingAdapter</code> (REST-only feeds). The base handles the connection lifecycle, reconnect, decoding, and
  event emission — you supply a URL and a parse function.</p> <pre><code></code></pre> <h2>Tick aggregation</h2> <p>Roll raw ticks into OHLC bars per timeframe:</p> <pre><code></code></pre> <h2>Quotes for many symbols</h2> <p>A feed with <code>subscribeQuotes</code> sends quotes (last price, the day's change, high, low,
  volume, bid and ask) for many symbols at once until you stop it. <code>BinanceAdapter</code> sends
  a 24 h snapshot, then its mini-ticker stream; <code>MockAdapter</code> makes quotes up. A widget's
  watchlist fills its rows from it.</p> <pre><code></code></pre> <h2>Tick charts</h2> <p>A tick timeframe — <code>'100T'</code> — draws a bar per 100 trades. It is built from a feed's
  trades: its recent ones for the history (<code>fetchTrades</code>), then its live ones
  (<code>subscribeTrades</code>). <code>BinanceAdapter</code> streams aggregate trades. A tick chart
  has no countdown and pages in no older history; a feed without trades refuses tick timeframes.
  Tick bars are not evenly spaced in time, so the time axis and the crosshair give times only to
  bars, not to the empty space beside them.</p> <pre><code></code></pre> <h2>Market status and news</h2> <p><code>marketStatus(info, now)</code> tells whether a symbol's market is open at a moment, from its
  hours in its exchange's zone (clock changes included), and when that changes. Sessions can name the
  weekdays they open on. A feed's <code>fetchNews</code> gives headlines for the widget's symbol info
  panel; <code>readNews</code> keeps only items with a title and a time, and links to web pages.</p> <pre><code></code></pre> <h2>Reconnect</h2> <p><code>ReconnectManager</code> handles exponential backoff with a cap and a final give-up.</p> <pre><code></code></pre> <h2>Replay mode</h2> <p>Drive a historical <code>DataSeries</code> forward at controlled speed.
  Decoupled from <code>Chart</code> so it can power both UI replay and headless
  backtests.</p> <pre><code></code></pre> <p>In the widget's replay mode, <strong>click any revealed bar to jump the replay
  cursor there</strong>. More generally, the chart now emits <code>click</code> and <code>barClick</code> events for plain left-clicks (press and release
  without dragging):</p> <pre><code></code></pre> <h3>Replay on the chart, in finer steps</h3> <p><code>chart.replayStart()</code> replays the chart's own series. Give it finer bars as <code>steps</code> (5-minute bars under an hourly chart) and each step grows the
  forming bar from them, as it grew in the market; closed bars show as they are in the
  series. <code>startIndex</code> and <code>replaySeekToBar</code> count the chart's bars.
  In ChartWidget, the replay bar's <strong>Step</strong> menu offers the finer intervals the
  feed has (or that the bars you loaded can build).</p> <pre><code></code></pre> <h3>A replay in your own app</h3> <p>Buy and sell marks and trade zones show as the replay reaches them: a mark once its bar is shown, a trade once entered, drawn open until its exit is reached (<code>revealMarks: false</code>, ChartWidget: <code>replayRevealMarks: false</code> shows them all). <code>startTime</code> starts at a time instead of a bar; <code>hideHistory</code> leaves the bars before the start out until the replay stops; <code>duration</code> plays to the end in about that long however many bars there are, several bars a frame, and a late frame slows it rather than skip ahead.</p> <pre><code></code></pre> <h3>Paper trading in a replay</h3> <p>An execution adapter with <code>setMarkPrice(price, time)</code> (as <code>PaperExecutionAdapter</code> has) trades on the replay: during a replay the chart
  hands it each replayed price and time, so orders and stops fill as the replay passes
  them and fills land on the replayed bars. Each step's low and high count, and a jump
  ahead passes every step on the way. It only goes forward: after a seek back it waits
  until the replay is past the furthest point it has seen. The live price doesn't move
  it meanwhile; when the replay ends it goes back to the live price, and fills to the
  clock. Price alerts keep watching the live market throughout; alerts on indicator
  lines wait for the replay to end.</p> <pre><code></code></pre> <h3>API</h3> <table><thead><tr><th>Method</th><th>Purpose</th></tr></thead><tbody><tr><td><code>start()</code></td><td>Begin emitting from current index.</td></tr><tr><td><code>pause()</code> / <code>resume()</code></td><td>Pause/continue timer.</td></tr><tr><td><code>step(n)</code></td><td>Emit N bars synchronously without the timer.</td></tr><tr><td><code>seek(index)</code></td><td>Jump without emitting in-between bars.</td></tr><tr><td><code>setSpeed(bps)</code></td><td>Bars per second (clamped to &gt;= 0.01).</td></tr><tr><td><code>destroy()</code></td><td>Clear timer + listeners.</td></tr></tbody></table> <p>See <a>Analytics</a> for using replay alongside the backtester.</p>`,1);function ie(x,A){j(A,!1);const{href:S}=X();Z();var v=te();G("1d0rbl6",g=>{var O=ee();K(()=>{V.title="Realtime & replay — Quantum Terminal docs"}),k(g,O)});var r=e(z(v),8),C=t(r);C.textContent=`import { BinanceAdapter, CoinbaseAdapter, BybitAdapter, KrakenAdapter } from '@tradecanvas/chart'

chart.connect({ adapter: new BinanceAdapter(),  symbol: 'BTCUSDT', timeframe: '1m' })
chart.connect({ adapter: new BybitAdapter(),    symbol: 'BTCUSDT', timeframe: '1m' })
chart.connect({ adapter: new KrakenAdapter(),   symbol: 'BTC/USD', timeframe: '5m' })
chart.connect({ adapter: new CoinbaseAdapter(), symbol: 'BTC-USD', timeframe: '15m' })`,a(r);var o=e(r,6),_=t(o);_.textContent=`import { TwelveDataAdapter } from '@tradecanvas/chart'

const adapter = new TwelveDataAdapter({
  apiKey: import.meta.env.VITE_TWELVE_DATA_API_KEY,
})

chart.connect({ adapter, symbol: 'EUR/USD', timeframe: '5m' })
const pairs = await adapter.searchSymbols?.('', { limit: 1000 })`,a(o);var n=e(o,4),B=t(n);B.textContent=`interface DataAdapter {
  name: string
  connect(config): void
  disconnect(): void
  getConnectionState(): ConnectionState
  fetchHistory(symbol, timeframe, limit?): Promise<OHLCBar[]>
  on(event, listener): void   // 'bar' | 'tick' | 'snapshot' | 'connectionChange' | 'error' | 'symbolInfo'
  off(event, listener): void
  dispose(): void

  // Optional
  fetchHistoryBefore?(symbol, timeframe, before, limit): Promise<OHLCBar[]>
  searchSymbols?(query, options?): Promise<SymbolInfo[]>
  resolveSymbol?(symbol): Promise<SymbolInfo | null>
  subscribeQuotes?(symbols, onQuotes): () => void      // a watchlist's rows
  fetchNews?(symbol, limit?): Promise<NewsItem[]>       // the symbol info panel
  fetchTrades?(symbol, limit?): Promise<Trade[]>        // tick charts, with
  subscribeTrades?(symbol, onTrades): () => void        // subscribeTrades
}`,a(n);var s=e(n,6),I=t(s);I.textContent="emit('symbolInfo', { symbol: 'VNM', pricePrecision: 0, minTick: 10, currency: 'VND' })   // as your adapter sends its other events",a(s);var c=e(s,6),D=t(c);D.textContent=`import { WebSocketAdapter } from '@tradecanvas/chart'

const myAdapter = new WebSocketAdapter({
  name: 'myexchange',
  wsUrl: (c) => 'wss://api.myexchange.com/ws/' + c.symbol + '@kline_' + c.timeframe,
  fetchHistory: (symbol, tf, limit) => fetch('/candles?...').then((r) => r.json()),
  parseMessage: (raw) => ({ bar: toBar(raw), closed: raw.k.x }),
})`,a(c);var d=e(c,6),P=t(d);P.textContent=`import { TickAggregator } from '@tradecanvas/chart'

const agg = new TickAggregator('1m')
agg.processTick({ time, price, volume })

const current = agg.getCurrentBar()         // forming bar
const closed = agg.flushClosedBars()        // bars that have rolled over`,a(d);var i=e(d,6),R=t(i);R.textContent=`const stop = new BinanceAdapter().subscribeQuotes(['BTCUSDT', 'ETHUSDT'], (quotes) => {
  for (const q of quotes) console.log(q.symbol, q.last, q.changePercent)
})
stop()

readQuote({ symbol: 'AAPL', last: 190, prevClose: 188 })   // → change 2, changePercent 1.06`,a(i);var p=e(i,6),E=t(p);E.textContent=`chart.connect({ adapter: new BinanceAdapter(), symbol: 'BTCUSDT', timeframe: '100T' })
await chart.setTimeframe('500T')

// Your own trades into tick bars
const builder = new TickBarBuilder(100)
builder.push([{ time, price, volume }])   // → [{ bar, closed }]`,a(p);var l=e(p,6),U=t(l);U.textContent=`const info = {
  symbol: 'AAPL',
  timezone: 'America/New_York',
  sessions: [{ start: '09:30', end: '16:00', days: [1, 2, 3, 4, 5] }],
}
marketStatus(info, Date.now())   // { state: 'closed', next: <next open, ms> } · 'open' · 'always' (24/7)`,a(l);var h=e(l,6),M=t(h);M.textContent=`import { ReconnectManager } from '@tradecanvas/chart'

const rm = new ReconnectManager({ maxRetries: 6, baseDelay: 500, maxDelay: 30_000 })

rm.start()
rm.schedule(() => connectWebsocket())   // call on disconnect; backs off automatically
rm.onConnected()                        // call on a successful connect to reset`,a(h);var m=e(h,6),H=t(m);H.textContent=`import { ReplayController } from '@tradecanvas/chart'

const replay = new ReplayController({
  data: historicalBars,
  speed: 10,      // bars per second
  startIndex: 0,
})

// Seed the chart with everything before startIndex
chart.setData(replay.getPrefix())

// Wire each emitted bar into the chart
replay.on('bar', ({ bar }) => chart.appendBar(bar))
replay.on('finished', () => console.log('done'))

replay.start()
// replay.pause(); replay.resume(); replay.step(5); replay.seek(200); replay.setSpeed(20)
`,a(m);var y=e(m,4),q=t(y);q.textContent=`chart.on('barClick', (e) => {
  const { bar, barIndex, point } = e.payload
})`,a(y);var f=e(y,6),L=t(f);L.textContent=`const steps = await adapter.fetchHistory('BTCUSDT', '5m', 2000)
chart.replayStart({ steps, startIndex: 120, paused: true, speed: 5 })
chart.replayResume()
chart.getReplayBarIndex()      // the chart bar forming now
chart.replaySeekToBar(150)     // to the end of bar 150
chart.replaySeekToTime(t)      // to the bars that opened before t
chart.on('replayStep', (e) => e.payload)    // { barIndex, time, until, total }
chart.on('replayComplete', (e) => e.payload) // { barIndex, time }
chart.on('replayState', (e) => e.payload)   // { state: 'playing' | 'paused' | 'stopped' }
chart.replayStop()             // back to the live series`,a(f);var b=e(f,6),N=t(b);N.textContent=`chart.setSignalMarkers(signals)          // the whole backtest, kept
chart.setTradeZones(trades)
chart.replayStart({
  startTime: Date.now() - 30 * 86_400_000,   // the last 30 days
  hideHistory: true,                          // only them on the chart
  duration: 3500,                             // in about 3.5 s
})
chart.on('replayComplete', () => chart.replayStop())   // then the whole series again
chart.replayStart({ startIndex: 100, revealMarks: false })   // every mark from the start`,a(b);var u=e(b,6),W=t(u);W.textContent=`chart.connectExecution(new PaperExecutionAdapter())
chart.replayStart({ startIndex: 300, paused: true })
// place orders from the chart or the order ticket, then play`,a(u);var w=e(u,6),Q=e(t(w));Y(),a(w),F(g=>J(Q,"href",g),[()=>S("/docs/analytics")]),k(x,v),$()}export{ie as default};
