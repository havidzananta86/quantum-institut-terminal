import"./Bzak7iHL.js";import"./DQttDCvw.js";import{p as Q,_ as O,$ as K,a as C,s as e,a0 as V,c as t,r,a1 as Y,t as $,b as j,f as T}from"./vnnAQmBw.js";import{h as z}from"./Di_Vksbt.js";import{s as Z}from"./BbGUZXP3.js";import{i as F}from"./w5vomPQw.js";import{u as G}from"./BPYnHL8L.js";var J=T('<meta name="description" content="ストリーミングのデータアダプター、ティックの集計、再接続の処理、そして過去データを再生する新しい ReplayController。"/>'),X=T(`<h1>リアルタイムとリプレイ</h1> <p>ライブデータをストリーミングし、ティックをバーに集計し、過去のデータを速度を制御しながらリプレイします。</p> <h2>組み込みアダプター</h2> <p>すべて無料で、API キーは不要です。どれも同じ方法で接続できます：</p> <pre><code></code></pre> <h2>DataAdapter インターフェース</h2> <pre><code></code></pre> <h2 id="symbol-info">データフィードが後から知る銘柄情報</h2> <p>接続済みのチャートは <code>resolveSymbol</code> を一度だけ呼びます。銘柄の情報を後から（たとえば最初のメッセージで）知るフィードは <code>symbolInfo</code> イベントで送れば、チャートがすぐ適用します。価格軸・凡例・価格タグは銘柄の小数桁（<code>pricePrecision</code>）で表示され、価格軸の目盛りは呼値（<code>minTick</code>）に揃い、取引所の取引時間も使われます。</p> <pre><code></code></pre> <h2>約 20 行で任意のフィードに対応</h2> <p><code>WebSocketAdapter</code>（ライブ + REST での履歴取得）または <code>PollingAdapter</code> （REST のみのフィード）を継承します。接続のライフサイクル、再接続、デコード、イベントの発行は基底クラスが
  処理するので、URL とパース関数を用意するだけです。</p> <pre><code></code></pre> <h2>ティックの集計</h2> <p>生のティックを、時間足ごとの OHLC バーにまとめます：</p> <pre><code></code></pre> <h2>複数シンボルのクオート</h2> <p><code>subscribeQuotes</code> を持つフィードは、止めるまで複数のシンボルのクオート（最新価格、当日の変化、高値、安値、
  出来高、買気配と売気配）をまとめて送ります。<code>BinanceAdapter</code> は 24 時間のスナップショットを送ったあと、
  ミニティッカーのストリームを流します。<code>MockAdapter</code> はクオートを生成します。ウィジェットのウォッチリストは、
  これで各行を埋めます。</p> <pre><code></code></pre> <h2>ティックチャート</h2> <p>ティックの時間足 — <code>'100T'</code> — は 100 約定ごとに 1 本のバーを描きます。フィードの約定から組み立て、
  履歴には直近の約定（<code>fetchTrades</code>）、その後はライブの約定（<code>subscribeTrades</code>）を使います。 <code>BinanceAdapter</code> は集約約定（aggregate trades）をストリーミングします。ティックチャートにはカウントダウンがなく、
  さらに古い履歴も読み込みません。約定を提供しないフィードはティックの時間足を受け付けません。
  ティックのバーは時間的に等間隔ではないため、時間軸とクロスヘアはバーにだけ時刻を表示し、その横の空白には表示しません。</p> <pre><code></code></pre> <h2>市場の状態とニュース</h2> <p><code>marketStatus(info, now)</code> は、取引所のタイムゾーンでの取引時間（夏時間の切り替えを含む）から、ある時点で
  シンボルの市場が開いているかどうかと、それがいつ変わるかを返します。セッションには開く曜日を指定できます。
  フィードの <code>fetchNews</code> はウィジェットのシンボル情報パネルにヘッドラインを渡します。<code>readNews</code> は
  タイトルと時刻のある項目だけを残し、リンクも Web ページへのものだけを残します。</p> <pre><code></code></pre> <h2>再接続</h2> <p><code>ReconnectManager</code> は、上限付きの指数バックオフと、最終的な再試行の打ち切りを処理します。</p> <pre><code></code></pre> <h2>リプレイモード</h2> <p>過去の <code>DataSeries</code> を、速度を制御しながら先へ進めます。 <code>Chart</code> から切り離されているため、UI でのリプレイにもヘッドレスのバックテストにも使えます。</p> <pre><code></code></pre> <p>ウィジェットのリプレイモードでは、<strong>表示済みのバーをクリックすると、リプレイのカーソルが
  そこへ移動します</strong>。より一般的には、チャートは通常の左クリック（ドラッグせずに押して離す操作）に対して <code>click</code> と <code>barClick</code> イベントを発行するようになりました：</p> <pre><code></code></pre> <h3>チャート上のリプレイを細かいステップで</h3> <p><code>chart.replayStart()</code> は、チャート自身の系列をリプレイします。下位足のバーを <code>steps</code> として渡すと（1 時間足のチャートに 5 分足のバーなど）、各ステップでそれらから形成中のバーが
  育っていきます。実際の市場で形成されたときと同じです。確定済みのバーは系列にあるとおりに表示されます。 <code>startIndex</code> と <code>replaySeekToBar</code> はチャートのバーで数えます。
  ChartWidget では、リプレイバーの<strong>ステップ</strong>メニューに、フィードが持つ下位の時間足
  （または読み込んだバーから組み立てられる時間足）が並びます。</p> <pre><code></code></pre> <h3>自分のアプリでのリプレイ</h3> <p>売買のマークと取引ゾーンは、リプレイがそこに届いたときに現れます。マークはその足が表示されたとき、取引はエントリーしたときに現れ、エグジットに届くまでは建玉中として描かれます（<code>revealMarks: false</code>, ChartWidget: <code>replayRevealMarks: false</code> ですべて表示）。<code>startTime</code> は足ではなく時刻から始めます。<code>hideHistory</code> はリプレイが止まるまで開始前の足を外します。<code>duration</code> は足の数にかかわらず、ほぼその時間で最後まで再生します。1 フレームに複数の足を進め、遅れたフレームは飛ばさずに再生を遅らせます。</p> <pre><code></code></pre> <h3>リプレイ中のペーパー取引</h3> <p><code>PaperExecutionAdapter</code> のように <code>setMarkPrice(price, time)</code> を持つ実行アダプターは、
  リプレイ上で取引します。リプレイ中、チャートはリプレイされる価格と時刻を順に渡すので、注文や損切りは
  リプレイがその価格を通過したときに約定し、約定はリプレイ中のバーの上に記録されます。各ステップの安値と高値が
  考慮され、先へジャンプすると途中のステップをすべて通過します。進むのは前方向だけで、後ろへシークした後は、
  リプレイがそれまでに見た最も先の地点を越えるまで待ちます。
  その間、ライブ価格の影響は受けません。リプレイが終わるとライブ価格に戻り、約定時刻も実際の時計に戻ります。
  価格アラートは、その間もずっとライブの市場を監視し続けます。インジケーターのラインに対するアラートは、
  リプレイが終わるまで待機します。</p> <pre><code></code></pre> <h3>API</h3> <table><thead><tr><th>メソッド</th><th>用途</th></tr></thead><tbody><tr><td><code>start()</code></td><td>現在のインデックスから発行を開始します。</td></tr><tr><td><code>pause()</code> / <code>resume()</code></td><td>タイマーを一時停止 / 再開します。</td></tr><tr><td><code>step(n)</code></td><td>タイマーを使わずに N 本のバーを同期的に発行します。</td></tr><tr><td><code>seek(index)</code></td><td>間のバーを発行せずに移動します。</td></tr><tr><td><code>setSpeed(bps)</code></td><td>1 秒あたりのバー数（&gt;= 0.01 に制限）。</td></tr><tr><td><code>destroy()</code></td><td>タイマーとリスナーを解除します。</td></tr></tbody></table> <p>バックテスターとリプレイを組み合わせて使う方法は、<a>分析</a>を参照してください。</p>`,1);function de(S,x){Q(x,!1);const{href:k}=G();F();var u=X();z("1dwi78s",v=>{var L=J();O(()=>{K.title="リアルタイムとリプレイ — TradeCanvas ドキュメント"}),C(v,L)});var a=e(V(u),8),_=t(a);_.textContent=`import { BinanceAdapter, CoinbaseAdapter, BybitAdapter, KrakenAdapter } from '@tradecanvas/chart'

chart.connect({ adapter: new BinanceAdapter(),  symbol: 'BTCUSDT', timeframe: '1m' })
chart.connect({ adapter: new BybitAdapter(),    symbol: 'BTCUSDT', timeframe: '1m' })
chart.connect({ adapter: new KrakenAdapter(),   symbol: 'BTC/USD', timeframe: '5m' })
chart.connect({ adapter: new CoinbaseAdapter(), symbol: 'BTC-USD', timeframe: '15m' })`,r(a);var o=e(a,4),w=t(o);w.textContent=`interface DataAdapter {
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
}`,r(o);var n=e(o,6),A=t(n);A.textContent="emit('symbolInfo', { symbol: 'VNM', pricePrecision: 0, minTick: 10, currency: 'VND' })   // アダプターが他のイベントを送るのと同じ方法で",r(n);var c=e(n,6),B=t(c);B.textContent=`import { WebSocketAdapter } from '@tradecanvas/chart'

const myAdapter = new WebSocketAdapter({
  name: 'myexchange',
  wsUrl: (c) => 'wss://api.myexchange.com/ws/' + c.symbol + '@kline_' + c.timeframe,
  fetchHistory: (symbol, tf, limit) => fetch('/candles?...').then((r) => r.json()),
  parseMessage: (raw) => ({ bar: toBar(raw), closed: raw.k.x }),
})`,r(c);var d=e(c,6),I=t(d);I.textContent=`import { TickAggregator } from '@tradecanvas/chart'

const agg = new TickAggregator('1m')
agg.processTick({ time, price, volume })

const current = agg.getCurrentBar()         // forming bar
const closed = agg.flushClosedBars()        // bars that have rolled over`,r(d);var s=e(d,6),P=t(s);P.textContent=`const stop = new BinanceAdapter().subscribeQuotes(['BTCUSDT', 'ETHUSDT'], (quotes) => {
  for (const q of quotes) console.log(q.symbol, q.last, q.changePercent)
})
stop()

readQuote({ symbol: 'AAPL', last: 190, prevClose: 188 })   // → change 2, changePercent 1.06`,r(s);var p=e(s,6),D=t(p);D.textContent=`chart.connect({ adapter: new BinanceAdapter(), symbol: 'BTCUSDT', timeframe: '100T' })
await chart.setTimeframe('500T')

// Your own trades into tick bars
const builder = new TickBarBuilder(100)
builder.push([{ time, price, volume }])   // → [{ bar, closed }]`,r(p);var i=e(p,6),R=t(i);R.textContent=`const info = {
  symbol: 'AAPL',
  timezone: 'America/New_York',
  sessions: [{ start: '09:30', end: '16:00', days: [1, 2, 3, 4, 5] }],
}
marketStatus(info, Date.now())   // { state: 'closed', next: <next open, ms> } · 'open' · 'always' (24/7)`,r(i);var l=e(i,6),M=t(l);M.textContent=`import { ReconnectManager } from '@tradecanvas/chart'

const rm = new ReconnectManager({ maxRetries: 6, baseDelay: 500, maxDelay: 30_000 })

rm.start()
rm.schedule(() => connectWebsocket())   // call on disconnect; backs off automatically
rm.onConnected()                        // call on a successful connect to reset`,r(l);var m=e(l,6),U=t(m);U.textContent=`import { ReplayController } from '@tradecanvas/chart'

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
`,r(m);var h=e(m,4),H=t(h);H.textContent=`chart.on('barClick', (e) => {
  const { bar, barIndex, point } = e.payload
})`,r(h);var y=e(h,6),N=t(y);N.textContent=`const steps = await adapter.fetchHistory('BTCUSDT', '5m', 2000)
chart.replayStart({ steps, startIndex: 120, paused: true, speed: 5 })
chart.replayResume()
chart.getReplayBarIndex()      // the chart bar forming now
chart.replaySeekToBar(150)     // to the end of bar 150
chart.replaySeekToTime(t)      // to the bars that opened before t
chart.on('replayStep', (e) => e.payload)    // { barIndex, time, until, total }
chart.on('replayComplete', (e) => e.payload) // { barIndex, time }
chart.on('replayState', (e) => e.payload)   // { state: 'playing' | 'paused' | 'stopped' }
chart.replayStop()             // back to the live series`,r(y);var b=e(y,6),W=t(b);W.textContent=`chart.setSignalMarkers(signals)          // バックテスト全体はそのまま
chart.setTradeZones(trades)
chart.replayStart({
  startTime: Date.now() - 30 * 86_400_000,   // 直近 30 日
  hideHistory: true,                          // チャートにはそれだけ
  duration: 3500,                             // 約 3.5 秒で
})
chart.on('replayComplete', () => chart.replayStop())   // そのあと系列全体に戻す
chart.replayStart({ startIndex: 100, revealMarks: false })   // 最初からすべてのマークを表示`,r(b);var f=e(b,6),q=t(f);q.textContent=`chart.connectExecution(new PaperExecutionAdapter())
chart.replayStart({ startIndex: 300, paused: true })
// place orders from the chart or the order ticket, then play`,r(f);var g=e(f,6),E=e(t(g));Y(),r(g),$(v=>Z(E,"href",v),[()=>k("/docs/analytics")]),C(S,u),j()}export{de as default};
