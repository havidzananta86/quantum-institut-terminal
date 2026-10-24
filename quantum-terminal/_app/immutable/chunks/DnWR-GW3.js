import"./Bzak7iHL.js";import"./DQttDCvw.js";import{p as N,_ as R,$ as V,a as y,s as e,a0 as $,c as a,r as t,a1 as d,t as j,b as E,f as w}from"./vnnAQmBw.js";import{h as H}from"./Di_Vksbt.js";import{s as n}from"./BbGUZXP3.js";import{i as J}from"./w5vomPQw.js";import{u as K}from"./BPYnHL8L.js";var Y=w('<meta name="description" content="Install TradeCanvas and render your first canvas trading chart in under a minute."/>'),q=w(`<h1>Getting started</h1> <p>Install TradeCanvas and render a chart in under a minute.</p> <h2>Installation</h2> <p>Use whichever package manager you prefer:</p> <pre><code>npm install @tradecanvas/chart
# or
pnpm add @tradecanvas/chart
# or
yarn add @tradecanvas/chart</code></pre> <h2>Drop-in widget</h2> <p><code>ChartWidget</code> is the fastest path to a working chart. It renders a full
  trading UI inside any host element — toolbar, drawing sidebar, settings
  dialog, status bar — with zero framework dependency.</p> <pre><code></code></pre> <p>Out of the box, the widget supports a full set of pro-trader gestures:
  drag past the last bar into empty future space, drag the price/time axes to scale, <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+drag to select several drawings, <kbd>Shift</kbd>+drag to measure, <kbd>Alt</kbd>+click to pin a tooltip, <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>K</kbd> for the command palette, <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>P</kbd> for symbol search,
  and <kbd>?</kbd> to see the full shortcut sheet.</p> <h2>Headless Chart</h2> <p>For full control over the surrounding UI, use the lower-level <code>Chart</code> class directly. You bring your own toolbar; you keep all features:</p> <pre><code></code></pre> <h2>Framework wrappers</h2> <p>React, Vue, and Svelte wrappers are available in the <a>frameworks</a> section.</p> <h2 id="ai">With a coding agent</h2> <p>Coding agents can learn TradeCanvas instead of guessing it. The <strong>agent skill</strong> teaches the API with examples that are type-checked; in Claude Code it installs with two commands:</p> <pre><code></code></pre> <p>The <strong>MCP server</strong>, <code>@tradecanvas/mcp</code>, answers from the library's own catalog: indicator ids, their params and the keys of their lines; drawing tools and the points each takes; the options of <code>ChartWidget</code>, <code>Chart</code> and <code>ChartWidgetGrid</code>; feature switches and style keys. Its <code>validate_options</code> tool checks an options object before it is used and names the option that was meant. In Claude Code:</p> <pre><code></code></pre> <p>Cursor, Claude Desktop and most other clients take the same command in their MCP settings:</p> <pre><code></code></pre> <p>On Windows outside WSL, npx starts through <code>cmd</code>: <code>claude mcp add tradecanvas -- cmd /c npx -y @tradecanvas/mcp</code>, or in the settings <code>"command": "cmd", "args": ["/c", "npx", "-y", "@tradecanvas/mcp"]</code>. In Git Bash, which runs the <code>!</code> commands of Claude Code on Windows, write <code>//c</code>: Git Bash turns <code>/c</code> into a path.</p> <p>Without either, <a href="https://tradecanvas.dev/llms.txt">llms.txt</a> and <a href="https://tradecanvas.dev/llms-full.txt">llms-full.txt</a> hand an assistant the docs in one file.</p> <h2>Next steps</h2> <ul><li><a>API reference</a> — full surface of <code>Chart</code> and <code>ChartWidget</code></li> <li><a>Chart types</a> — 18 built-in chart types</li> <li><a>Indicators</a> — catalog of 134 indicators</li> <li><a>Realtime &amp; replay</a> — streaming adapters and replay mode</li> <li><a>Analytics</a> — strategy backtester and risk metrics</li></ul>`,1);function de(_,x){N(x,!1);const{href:r}=K();J();var b=q();H("8eszyb",v=>{var g=Y();R(()=>{V.title="Getting Started — TradeCanvas docs"}),y(v,g)});var s=e($(b),14),I=a(s);I.textContent=`import { ChartWidget } from '@tradecanvas/chart/widget'
import { BinanceAdapter } from '@tradecanvas/chart'

const widget = new ChartWidget(document.getElementById('chart')!, {
  symbol: 'BTCUSDT',
  timeframe: '5m',
  theme: 'dark',
  adapter: new BinanceAdapter(),
  historyLimit: 500,
  trading: true,
  // Optional features
  watchlist: true,         // right-side sparkline panel
  persistLayouts: true,    // remember per-symbol indicators / drawings
  // dragDropImport defaults to true — drop a CSV / JSON onto the chart
})`,t(s);var o=e(s,8),W=a(o);W.textContent=`import { Chart } from '@tradecanvas/chart'

const chart = new Chart(host, {
  chartType: 'candlestick',
  theme: 'dark',
})

chart.setData(bars)
chart.addIndicator('sma', { period: 20 })`,t(o);var c=e(o,4),T=e(a(c));d(),t(c);var i=e(c,6),S=a(i);S.textContent=`/plugin marketplace add bonguynvan/tradecanvas
/plugin install tradecanvas@tradecanvas`,t(i);var p=e(i,4),A=a(p);A.textContent="claude mcp add tradecanvas -- npx -y @tradecanvas/mcp",t(p);var l=e(p,4),B=a(l);B.textContent=`{
  "mcpServers": {
    "tradecanvas": { "command": "npx", "args": ["-y", "@tradecanvas/mcp"] }
  }
}`,t(l);var k=e(l,8),h=a(k),G=a(h);d(4),t(h);var m=e(h,2),D=a(m);d(),t(m);var u=e(m,2),P=a(u);d(),t(u);var f=e(u,2),O=a(f);d(),t(f);var C=e(f,2),U=a(C);d(),t(C),t(k),j((v,g,L,z,F,M)=>{n(T,"href",v),n(G,"href",g),n(D,"href",L),n(P,"href",z),n(O,"href",F),n(U,"href",M)},[()=>r("/docs/frameworks"),()=>r("/docs/api"),()=>r("/docs/chart-types"),()=>r("/docs/indicators"),()=>r("/docs/realtime"),()=>r("/docs/analytics")]),y(_,b),E()}export{de as default};
