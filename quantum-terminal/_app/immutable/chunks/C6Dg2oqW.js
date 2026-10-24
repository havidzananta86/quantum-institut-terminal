import"./Bzak7iHL.js";import"./DQttDCvw.js";import{p as be,t as y,_ as fe,$ as we,a as v,s as a,a0 as ye,c as t,r as e,b as ke,f as u,g as n,u as Q}from"./vnnAQmBw.js";import{s}from"./BPRzW5Y5.js";import{i as X}from"./CaEBpJzl.js";import{e as ee}from"./CqWi4pek.js";import{h as _e}from"./Di_Vksbt.js";import{s as Ie}from"./BbGUZXP3.js";import{i as xe}from"./w5vomPQw.js";import{c as k}from"./DM_frcBA.js";var Ce=u('<meta name="description"/>'),Se=u("<small>· source</small>"),Te=u("<tr><td><code> </code></td><td> <!></td><td><code> </code></td><td> </td></tr>"),Ae=u("<small>· source</small>"),Pe=u("<tr><td><code> </code></td><td> <!></td><td><code> </code></td><td> </td><td> </td></tr>"),We=u(`<h1>Indicators</h1> <p> </p> <h2>Adding an indicator</h2> <pre><code></code></pre> <p><code>addIndicator</code> returns an instance id: the same indicator can be added several
  times, each instance with its own inputs, colours and levels.</p> <h2>Sources and indicators on indicators</h2> <p>Indicators marked <em>source</em> below can run on another price than the close
  (<code>open</code>, <code>high</code>, <code>low</code>, <code>hl2</code>, <code>hlc3</code>, <code>ohlc4</code>, <code>hlcc4</code>) or on another indicator's line. A moving average of RSI
  is drawn in RSI's pane, on its scale, and goes when RSI does.</p> <pre><code></code></pre> <p>Pane indicators can also share a pane: <code>chart.addIndicator('stochastic', &#123;&#125;, 'bottom', &#123; pane: rsi &#125;)</code>.</p> <h2>Levels, colours and values</h2> <pre><code></code></pre> <p>The legend shows each line's latest value. To tag it on the axis as well, in the line's colour, turn on <code>features.indicatorValueLabels: true</code> or <code>setIndicatorValueLabelsVisible(true)</code> (off by default).
  A pane's lines, levels, axis and crosshair share one scale.</p> <h2>On some intervals only</h2> <p>An indicator can be kept to some intervals: a 200-day average on the daily chart and
  up, a fast oscillator on the minute charts only. Each kind of interval (ticks, seconds,
  minutes, hours, days, weeks, months) is left on, switched off, or given a range of
  counts; a kind left out shows it on all. The chart reads the rules against the interval
  of the stream it is connected to, as the interval changes; for bars given with <code>setData</code>, <code>chart.setDataTimeframe('1h')</code> tells it theirs (ChartWidget does this itself); with neither
  it shows the indicator. The rules are saved with the layout and undone like any other edit.</p> <pre><code></code></pre> <p><code>getActiveIndicators()</code> says of each whether it is <code>visible</code> (switched on) and <code>shown</code> (drawn on this interval). In ChartWidget, its legend row greys out while it isn't.</p> <h2>In ChartWidget</h2> <p>The toolbar's <strong>Indicators</strong> opens a dialog. Type to search every indicator by its
  name or short name (<kbd>Enter</kbd> adds the best match); or pick a group down the side: <strong>Favourites</strong>, <strong>Templates</strong>, <strong>All</strong>, then each kind
  (moving averages, trend, oscillators, volatility, volume, bands and channels, price and
  patterns). A row adds its indicator and the dialog stays open for the next; a count shows how
  many are on the chart, and the star beside it keeps it in the favourites. On a phone the groups
  are a row of chips over the list.</p> <p>An indicator's settings (its legend row's name, or its gear) have three tabs: <strong>Inputs</strong>; <strong>Style</strong>, a row per line (shown or not, its colours, its
  dash), the line width, an overlay's price scale and the levels; and <strong>Visibility</strong>,
  the intervals it shows on. Every edit shows at once. <strong>Cancel</strong> or <kbd>Esc</kbd> puts it all back, <strong>OK</strong> keeps it. <strong>Defaults</strong> resets it, or saves it as
  the default: new indicators of its kind then start with these inputs and this look, in this
  browser.</p> <h2> </h2> <table><thead><tr><th>id</th><th>Name</th><th>Default params</th><th>Lines</th></tr></thead><tbody></tbody></table> <p><code>mtfma</code> plots a moving average from a higher timeframe on the current chart — the
  daily 50-MA on 1h bars, say. It averages only <em>completed</em> higher-timeframe closes, so it
  steps at each boundary and never repaints.</p> <h2> </h2> <table><thead><tr><th>id</th><th>Name</th><th>Default params</th><th>Lines</th><th>Levels</th></tr></thead><tbody></tbody></table> <p><code>voldelta</code> (Volume Delta) approximates buy/sell pressure from OHLCV — bars closing up
  add positive volume, down bars negative. <code>mode: 0</code> is the per-bar histogram, <code>mode: 1</code> cumulative delta. (A true tick delta needs per-trade bid/ask data, which an
  OHLCV series doesn't carry.)</p> <h2>Indicators from Asian price boards</h2> <p>Indicators that traders in Korea, Japan and Vietnam expect on their price boards: the Psychological Line (<code>psy</code>) and the New Psychological Line (<code>newpsy</code>), Volume Ratio (<code>vr</code>), AB Ratio (<code>abratio</code>), <code>sonar</code>, <code>sigma</code>, Binary Wave (<code>binarywave</code>), Trade Value (<code>tradevalue</code>) with Volume Change (<code>volchange</code>), the DeMark projected range (<code>demark</code>) and a moving-average <code>rainbow</code> of up to 20 lines. Trade Value is an estimate, close × volume per bar; the exchange's own figure comes from its feed.</p> <pre><code></code></pre> <h2>Candlestick patterns</h2> <p>64 patterns from one to five bars: dojis, hammers and shooting stars, marubozu and belt holds; engulfing bars, harami, piercing lines and dark clouds, tweezers, kicking; morning and evening stars, abandoned babies, three soldiers and crows, three inside and outside, tasuki gaps; three-line strikes, three methods, mat holds, breakaways and ladder bottoms. A reversal counts only after the trend it reverses (the close before it past both its 10-bar average and the close 10 bars back, <code>trendPeriod</code>), and a body is long or short against the average body of the bars before. The indicator draws an arrow under a bullish pattern and over a bearish one, with its short name once the bars are wide enough; a bar that ends several shows the longest. <code>reversal</code>, <code>continuation</code> and <code>indecision</code> (1 or 0) choose the kinds.</p> <pre><code></code></pre> <h2>Your own indicator</h2> <p>Extend <code>IndicatorBase</code> and declare what it draws (<code>plots</code>), its pane scale,
  levels and inputs; the chart draws it, scales its pane, tags its values and lists it in the
  widget's legend and settings without rendering code of yours. Its <code>category</code> (<code>'oscillators'</code>, <code>'volume'</code>…) puts it in that group of the Indicators dialog;
  without one it is under Other. See the <a href="https://github.com/bonguynvan/tradecanvas/blob/main/skills/tradecanvas/references/recipes.md#a-custom-indicator">custom indicator recipe</a>.</p> <h2>Panes: resize, fold, maximise, reorder</h2> <p><strong>Drag the divider</strong> above a pane to resize it. In ChartWidget each pane
  has buttons at its top right: move it up or down, fold it to its header, maximise it
  (the other panes fold and the price pane keeps a strip). Saved layouts keep each
  pane's size, order, fold and maximise. The same from code:</p> <pre><code></code></pre> <p>Right-click a pane in ChartWidget for its own logarithmic, inverted or percent scale.</p> <h2>Moving an indicator to another pane</h2> <p>An indicator can join another indicator's pane (it then shares that pane's scale),
  take a pane of its own, or go back to the price pane. When it leaves a pane it owned,
  the others in it stay (the next pane indicator takes the pane over), and those reading
  its lines follow it. In ChartWidget, the <strong>⋯</strong> button on a legend row
  offers the pane above, the pane below, a new pane and the price pane.</p> <pre><code></code></pre> <h2>Undo, and templates</h2> <p>Adding, removing, editing and moving indicators are undo steps in the same history
  as drawings (<kbd>Ctrl/⌘ Z</kbd>, <kbd>Ctrl/⌘ Shift Z</kbd>); an undone indicator
  comes back under its own id, so alerts on its lines still match. A burst of edits to
  one indicator (a colour dragged, a period typed) is one step. A loaded layout starts a
  fresh history.</p> <p>The indicators can be taken and put back as a whole, which is what ChartWidget's
  indicator templates do: <strong>Save indicators as template…</strong> on the Templates tab
  of the Indicators dialog keeps them (inputs, style, levels, panes) under a name, and picking a template
  puts them in place of the chart's, as one undo step.</p> <pre><code></code></pre> <h2>Computing outside the chart</h2> <p><code>IndicatorWorkerHost</code> computes an indicator from bars with the same messages a Web Worker would
  use. The worker script is not part of the published packages yet, so pass <code>null</code> and register
  the plugins to compute in place (SSR, tests, scripts):</p> <pre><code></code></pre>`,1);function He(te,ae){be(ae,!1);const B=k.filter(r=>r.placement==="overlay"),F=k.filter(r=>r.placement==="panel"),J=r=>Object.entries(r.params).map(([o,i])=>`${o}: ${JSON.stringify(i)}`).join(", "),K=r=>r.plots.map(o=>o.title).join(", "),Z=r=>"inputs"in r&&Object.values(r.inputs??{}).some(o=>o.source);xe();var U=We();_e("1wcz3mh",r=>{var o=Ce();y(()=>Ie(o,"content",`${k.length??""} built-in technical indicators: moving averages, bands, oscillators, volume and volatility, with sources, indicators on indicators and editable levels.`)),fe(()=>{we.title="Indicators — TradeCanvas docs"}),v(r,o)});var _=a(ye(U),2),oe=t(_);e(_);var I=a(_,4),re=t(I);re.textContent=`const ema = chart.addIndicator('ema', { period: 50 })          // on the price pane
const rsi = chart.addIndicator('rsi', { period: 14 }, 'bottom') // in a pane of its own
chart.updateIndicator(rsi, { period: 21 })
chart.removeIndicator(rsi)`,e(I);var x=a(I,8),ne=t(x);ne.textContent=`import { indicatorSource } from '@tradecanvas/chart'

chart.updateIndicator(ema, { source: 'hlc3' })
const smoothed = chart.addIndicator('sma', { period: 9, source: indicatorSource(rsi, 'value') })`,e(x);var C=a(x,6),se=t(C);se.textContent=`chart.setIndicatorLevels(rsi, [20, 50, 80])   // null restores 30 / 70
chart.updateIndicatorStyle(rsi, { colors: ['#f2a93b'], lineWidths: [2] })
chart.setIndicatorVisible(rsi, false)

const series = chart.getIndicatorOutput(rsi)?.series ?? []
const latest = series[series.length - 1]?.value   // keyed by the line keys below`,e(C);var S=a(C,8),ie=t(S);ie.textContent=`chart.setIndicatorIntervals(ema, { seconds: false, minutes: false, hours: [1, 4] })
chart.getIndicatorIntervals(ema)    // { seconds: false, minutes: false, hours: [1, 4] }
chart.setIndicatorIntervals(ema, null)  // all of them again`,e(S);var T=a(S,10),de=t(T);e(T);var A=a(T,2),Y=a(t(A));ee(Y,5,()=>B,r=>r.id,(r,o)=>{var i=Te(),h=t(i),g=t(h),E=t(g,!0);e(g),e(h);var l=a(h),b=t(l,!0),j=a(b);{var z=d=>{var w=Se();v(d,w)},N=Q(()=>Z(n(o)));X(j,d=>{n(N)&&d(z)})}e(l);var p=a(l),f=t(p),$=t(f,!0);e(f),e(p);var m=a(p),H=t(m,!0);e(m),e(i),y((d,w)=>{s(E,n(o).id),s(b,n(o).name),s($,d),s(H,w)},[()=>J(n(o))||"—",()=>K(n(o))||"—"]),v(r,i)}),e(Y),e(A);var P=a(A,4),ce=t(P);e(P);var W=a(P,2),q=a(t(W));ee(q,5,()=>F,r=>r.id,(r,o)=>{var i=Pe(),h=t(i),g=t(h),E=t(g,!0);e(g),e(h);var l=a(h),b=t(l,!0),j=a(b);{var z=c=>{var M=Ae();v(c,M)},N=Q(()=>Z(n(o)));X(j,c=>{n(N)&&c(z)})}e(l);var p=a(l),f=t(p),$=t(f,!0);e(f),e(p);var m=a(p),H=t(m,!0);e(m);var d=a(m),w=t(d,!0);e(d),e(i),y((c,M,ge)=>{s(E,n(o).id),s(b,n(o).name),s($,c),s(H,M),s(w,ge)},[()=>J(n(o))||"—",()=>K(n(o))||"—",()=>{var c;return"levels"in n(o)?(c=n(o).levels)==null?void 0:c.join(", "):"—"}]),v(r,i)}),e(q),e(W);var L=a(W,8),he=t(L);he.textContent=`chart.addIndicator('psy', { period: 10 }, 'bottom')              // share of up closes; 25 and 75 marked
chart.addIndicator('vr', { period: 20 }, 'bottom')                // volume of up days against down days
chart.addIndicator('tradevalue', {}, 'bottom')                    // close × volume, each bar
chart.addIndicator('rainbow', { first: 10, step: 10, count: 10 }) // ten averages, 10 to 100 bars`,e(L);var V=a(L,6),le=t(V);le.textContent=`chart.addIndicator('candlepatterns')                  // an arrow and the name on each bar that ends one
chart.addIndicator('candlepatterns', { indecision: 1 }) // dojis and spinning tops too

import { detectCandlePatterns, CANDLE_PATTERNS } from '@tradecanvas/chart'

const found = detectCandlePatterns(bars, { patterns: ['bullishEngulfing', 'hammer'] })
// [{ index, time, pattern: { id, name, short, direction, kind, bars } }]
CANDLE_PATTERNS.length                                 // 64`,e(V);var R=a(V,10),pe=t(R);pe.textContent=`chart.setPanelSize(rsi, 180)        // px, clamped to a minimum
chart.setPaneCollapsed(macd, true)  // fold to its header
chart.setMaximizedPane(rsi)         // null puts the panes back
chart.movePane(rsi, -1)             // one place up; 1 = down
chart.on('paneChange', (e) => e.payload.change)  // 'collapsed' | 'maximized' | 'order' | 'scale'
chart.setPaneScale(atr, { log: true, invert: false })  // log while its values are above 0
chart.setPaneScale(atr, { percent: true })             // labels in percent of its first value on screen`,e(R);var O=a(R,8),me=t(O);me.textContent=`chart.moveIndicatorToPane(cci, rsi)      // into RSI's pane
chart.moveIndicatorToPane(cci, 'new')    // a pane of its own
chart.moveIndicatorToPane(ema, 'price')  // an overlay back to the price pane
chart.canMoveIndicatorToPane(cci, rsi)   // whether it would move`,e(O);var D=a(O,8),ve=t(D);ve.textContent=`const setup = chart.getIndicatorSetup()   // what a layout keeps of them
chart.applyIndicatorSetup(setup)          // in place of the chart's indicators

new ChartWidget(host, { indicatorTemplates: true })  // the default`,e(D);var G=a(D,6),ue=t(G);ue.textContent=`import { IndicatorWorkerHost, RSIIndicator } from '@tradecanvas/core'

const host = new IndicatorWorkerHost(null)
host.registerFallbackPlugin(new RSIIndicator())
const output = await host.calculate('rsi', { id: 'rsi', instanceId: 'rsi-1', params: { period: 14 } }, bars)`,e(G),y(()=>{s(oe,`${k.length??""} built-in indicators. Add one by its id; parameters you leave out take
  their defaults, and invalid ones fall back to them.`),s(de,`On the price pane (${B.length??""})`),s(ce,`In a pane of their own (${F.length??""})`)}),v(te,U),ke()}export{He as default};
