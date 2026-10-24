import"./Bzak7iHL.js";import"./DQttDCvw.js";import{p as N,_ as W,$ as Q,a as k,s as e,a0 as O,c as a,r as o,a1 as K,t as V,b as Y,f as C}from"./vnnAQmBw.js";import{h as $}from"./Di_Vksbt.js";import{s as F}from"./BbGUZXP3.js";import{i as G}from"./w5vomPQw.js";import{u as Z}from"./BPYnHL8L.js";var J=C('<meta name="description" content="Adaptadores de datos en streaming, agregación de ticks, lógica de reconexión y el nuevo ReplayController para reproducir datos históricos."/>'),X=C(`<h1>Tiempo real y repetición</h1> <p>Transmite datos en vivo, agrega ticks en barras y repite datos históricos a una velocidad controlada.</p> <h2>Adaptadores integrados</h2> <p>Todos gratuitos y sin clave de API; se conectan todos de la misma forma:</p> <pre><code></code></pre> <h2>Interfaz DataAdapter</h2> <pre><code></code></pre> <h2 id="symbol-info">Datos del símbolo que el feed conoce más tarde</h2> <p>Un gráfico conectado llama a <code>resolveSymbol</code> una vez. Un feed que conoce los datos del símbolo solo más tarde (en su primer mensaje, por ejemplo) los envía con un evento <code>symbolInfo</code>, y el gráfico los aplica: la escala de precios, la leyenda y las etiquetas con los decimales del símbolo (<code>pricePrecision</code>), las marcas de la escala en su paso de precio (<code>minTick</code>) y el horario de la bolsa.</p> <pre><code></code></pre> <h2>Cualquier fuente de datos en ~20 líneas</h2> <p>Extiende <code>WebSocketAdapter</code> (en vivo + historial por REST) o <code>PollingAdapter</code> (fuentes solo REST). La clase base se encarga del
  ciclo de vida de la conexión, la reconexión, la decodificación y la emisión de
  eventos; tú solo aportas una URL y una función de análisis.</p> <pre><code></code></pre> <h2>Agregación de ticks</h2> <p>Agrupa los ticks sin procesar en barras OHLC para cada temporalidad:</p> <pre><code></code></pre> <h2>Cotizaciones de muchos símbolos</h2> <p>Una fuente con <code>subscribeQuotes</code> envía cotizaciones (último precio, variación del día, máximo, mínimo,
  volumen, compra y venta) de muchos símbolos a la vez hasta que la detienes. <code>BinanceAdapter</code> envía
  una instantánea de 24 h y luego su flujo mini-ticker; <code>MockAdapter</code> se inventa las cotizaciones. La
  lista de seguimiento de un widget llena sus filas con ellas.</p> <pre><code></code></pre> <h2>Gráficos de ticks</h2> <p>Una temporalidad de ticks — <code>'100T'</code> — dibuja una barra cada 100 operaciones. Se construye con las
  operaciones de la fuente: las recientes para el historial (<code>fetchTrades</code>) y después las que llegan en vivo
  (<code>subscribeTrades</code>). <code>BinanceAdapter</code> transmite operaciones agregadas. Un gráfico de ticks no
  tiene cuenta atrás ni carga historial más antiguo; una fuente sin operaciones rechaza las temporalidades de ticks.
  Las barras de ticks no están espaciadas por igual en el tiempo, así que el eje de tiempo y la cruz solo dan hora
  a las barras, no al espacio vacío a su lado.</p> <pre><code></code></pre> <h2>Estado del mercado y noticias</h2> <p><code>marketStatus(info, now)</code> indica si el mercado de un símbolo está abierto en un momento dado, a partir de su
  horario en la zona de su bolsa (con los cambios de hora incluidos), y cuándo cambia eso. Las sesiones pueden indicar los
  días de la semana en que abren. El <code>fetchNews</code> de una fuente da titulares para el panel de información del
  símbolo del widget; <code>readNews</code> solo conserva los elementos con título y hora, y solo los enlaces a páginas web.</p> <pre><code></code></pre> <h2>Reconexión</h2> <p><code>ReconnectManager</code> gestiona un retroceso exponencial con un límite y una renuncia final.</p> <pre><code></code></pre> <h2>Modo de repetición</h2> <p>Hace avanzar una <code>DataSeries</code> histórica a una velocidad controlada.
  Está desacoplado de <code>Chart</code>, así que sirve tanto para la repetición
  en la interfaz como para backtests sin interfaz.</p> <pre><code></code></pre> <p>En el modo de repetición del widget, <strong>haz clic en cualquier barra ya
  mostrada para llevar ahí el cursor de la repetición</strong>. De forma más
  general, el gráfico emite ahora los eventos <code>click</code> y <code>barClick</code> con los clics izquierdos simples (pulsar y soltar sin
  arrastrar):</p> <pre><code></code></pre> <h3>Repetición en el gráfico, en pasos más finos</h3> <p><code>chart.replayStart()</code> repite la propia serie del gráfico. Pásale barras más
  finas como <code>steps</code> (barras de 5 minutos bajo un gráfico horario) y cada paso
  hace crecer con ellas la barra en formación, tal como creció en el mercado; las barras
  cerradas se muestran tal como están en la serie. <code>startIndex</code> y <code>replaySeekToBar</code> cuentan las barras del gráfico. En ChartWidget, el menú <strong>Paso</strong> de la barra de repetición ofrece los intervalos más finos que tiene
  la fuente (o que se pueden construir con las barras que cargaste).</p> <pre><code></code></pre> <h3>Una repetición en tu propia app</h3> <p>Las marcas de compra y venta y las zonas de operación aparecen cuando la repetición llega a ellas: una marca cuando se muestra su vela, una operación cuando se entra, dibujada abierta hasta que se llega a su salida (<code>revealMarks: false</code>, ChartWidget: <code>replayRevealMarks: false</code> las muestra todas). <code>startTime</code> empieza en un momento en lugar de en una vela; <code>hideHistory</code> deja fuera las velas anteriores al inicio hasta que la repetición se detiene; <code>duration</code> llega al final en más o menos ese tiempo, haya las velas que haya, varias por fotograma, y un fotograma tardío la frena en lugar de saltar.</p> <pre><code></code></pre> <h3>Trading simulado en una repetición</h3> <p>Un adaptador de ejecución con <code>setMarkPrice(price, time)</code> (como <code>PaperExecutionAdapter</code>) opera sobre la repetición: durante una repetición, el
  gráfico le pasa cada precio y hora repetidos, así que las órdenes y los stops se ejecutan
  cuando la repetición pasa por ellos y las ejecuciones quedan sobre las barras repetidas.
  Cuentan el mínimo y el máximo de cada paso, y un salto hacia delante pasa por todos los
  pasos intermedios. Solo avanza: tras un salto hacia atrás, espera a que la repetición
  supere el punto más lejano que ha visto. Mientras tanto, el precio en vivo no lo mueve;
  cuando termina la repetición vuelve al precio en vivo, y las ejecuciones, a la hora real.
  Las alertas de precio siguen vigilando el mercado en vivo todo el tiempo; las alertas
  sobre líneas de indicador esperan a que termine la repetición.</p> <pre><code></code></pre> <h3>API</h3> <table><thead><tr><th>Método</th><th>Función</th></tr></thead><tbody><tr><td><code>start()</code></td><td>Empieza a emitir desde el índice actual.</td></tr><tr><td><code>pause()</code> / <code>resume()</code></td><td>Pausa/reanuda el temporizador.</td></tr><tr><td><code>step(n)</code></td><td>Emite N barras de forma síncrona, sin el temporizador.</td></tr><tr><td><code>seek(index)</code></td><td>Salta sin emitir las barras intermedias.</td></tr><tr><td><code>setSpeed(bps)</code></td><td>Barras por segundo (con un mínimo de 0.01).</td></tr><tr><td><code>destroy()</code></td><td>Elimina el temporizador y los listeners.</td></tr></tbody></table> <p>Consulta <a>Análisis</a> para usar la repetición junto con el backtester.</p>`,1);function ce(x,T){N(T,!1);const{href:S}=Z();G();var v=X();$("1oqfdob",f=>{var H=J();W(()=>{Q.title="Tiempo real y repetición — Documentación de TradeCanvas"}),k(f,H)});var r=e(O(v),8),w=a(r);w.textContent=`import { BinanceAdapter, CoinbaseAdapter, BybitAdapter, KrakenAdapter } from '@tradecanvas/chart'

chart.connect({ adapter: new BinanceAdapter(),  symbol: 'BTCUSDT', timeframe: '1m' })
chart.connect({ adapter: new BybitAdapter(),    symbol: 'BTCUSDT', timeframe: '1m' })
chart.connect({ adapter: new KrakenAdapter(),   symbol: 'BTC/USD', timeframe: '5m' })
chart.connect({ adapter: new CoinbaseAdapter(), symbol: 'BTC-USD', timeframe: '15m' })`,o(r);var t=e(r,4),_=a(t);_.textContent=`interface DataAdapter {
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
}`,o(t);var n=e(t,6),A=a(n);A.textContent="emit('symbolInfo', { symbol: 'VNM', pricePrecision: 0, minTick: 10, currency: 'VND' })   // como tu adaptador envía sus otros eventos",o(n);var s=e(n,6),q=a(s);q.textContent=`import { WebSocketAdapter } from '@tradecanvas/chart'

const myAdapter = new WebSocketAdapter({
  name: 'myexchange',
  wsUrl: (c) => 'wss://api.myexchange.com/ws/' + c.symbol + '@kline_' + c.timeframe,
  fetchHistory: (symbol, tf, limit) => fetch('/candles?...').then((r) => r.json()),
  parseMessage: (raw) => ({ bar: toBar(raw), closed: raw.k.x }),
})`,o(s);var c=e(s,6),B=a(c);B.textContent=`import { TickAggregator } from '@tradecanvas/chart'

const agg = new TickAggregator('1m')
agg.processTick({ time, price, volume })

const current = agg.getCurrentBar()         // forming bar
const closed = agg.flushClosedBars()        // bars that have rolled over`,o(c);var i=e(c,6),z=a(i);z.textContent=`const stop = new BinanceAdapter().subscribeQuotes(['BTCUSDT', 'ETHUSDT'], (quotes) => {
  for (const q of quotes) console.log(q.symbol, q.last, q.changePercent)
})
stop()

readQuote({ symbol: 'AAPL', last: 190, prevClose: 188 })   // → change 2, changePercent 1.06`,o(i);var d=e(i,6),P=a(d);P.textContent=`chart.connect({ adapter: new BinanceAdapter(), symbol: 'BTCUSDT', timeframe: '100T' })
await chart.setTimeframe('500T')

// Your own trades into tick bars
const builder = new TickBarBuilder(100)
builder.push([{ time, price, volume }])   // → [{ bar, closed }]`,o(d);var l=e(d,6),D=a(l);D.textContent=`const info = {
  symbol: 'AAPL',
  timezone: 'America/New_York',
  sessions: [{ start: '09:30', end: '16:00', days: [1, 2, 3, 4, 5] }],
}
marketStatus(info, Date.now())   // { state: 'closed', next: <next open, ms> } · 'open' · 'always' (24/7)`,o(l);var p=e(l,6),I=a(p);I.textContent=`import { ReconnectManager } from '@tradecanvas/chart'

const rm = new ReconnectManager({ maxRetries: 6, baseDelay: 500, maxDelay: 30_000 })

rm.start()
rm.schedule(() => connectWebsocket())   // call on disconnect; backs off automatically
rm.onConnected()                        // call on a successful connect to reset`,o(p);var m=e(p,6),U=a(m);U.textContent=`import { ReplayController } from '@tradecanvas/chart'

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
`,o(m);var u=e(m,4),R=a(u);R.textContent=`chart.on('barClick', (e) => {
  const { bar, barIndex, point } = e.payload
})`,o(u);var h=e(u,6),j=a(h);j.textContent=`const steps = await adapter.fetchHistory('BTCUSDT', '5m', 2000)
chart.replayStart({ steps, startIndex: 120, paused: true, speed: 5 })
chart.replayResume()
chart.getReplayBarIndex()      // the chart bar forming now
chart.replaySeekToBar(150)     // to the end of bar 150
chart.replaySeekToTime(t)      // to the bars that opened before t
chart.on('replayStep', (e) => e.payload)    // { barIndex, time, until, total }
chart.on('replayComplete', (e) => e.payload) // { barIndex, time }
chart.on('replayState', (e) => e.payload)   // { state: 'playing' | 'paused' | 'stopped' }
chart.replayStop()             // back to the live series`,o(h);var b=e(h,6),E=a(b);E.textContent=`chart.setSignalMarkers(signals)          // todo el backtest, se conserva
chart.setTradeZones(trades)
chart.replayStart({
  startTime: Date.now() - 30 * 86_400_000,   // los últimos 30 días
  hideHistory: true,                          // solo ellos en el gráfico
  duration: 3500,                             // en unos 3,5 s
})
chart.on('replayComplete', () => chart.replayStop())   // y luego la serie completa
chart.replayStart({ startIndex: 100, revealMarks: false })   // todas las marcas desde el inicio`,o(b);var y=e(b,6),M=a(y);M.textContent=`chart.connectExecution(new PaperExecutionAdapter())
chart.replayStart({ startIndex: 300, paused: true })
// place orders from the chart or the order ticket, then play`,o(y);var g=e(y,6),L=e(a(g));K(),o(g),V(f=>F(L,"href",f),[()=>S("/docs/analytics")]),k(x,v),Y()}export{ce as default};
