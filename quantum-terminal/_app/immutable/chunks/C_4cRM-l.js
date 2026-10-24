import"./Bzak7iHL.js";import"./DQttDCvw.js";import{p as q,_ as E,$ as J,a as _,s as a,a0 as N,c as e,r as t,a1 as d,t as R,b as U,f as x}from"./vnnAQmBw.js";import{h as j}from"./Di_Vksbt.js";import{s as c}from"./BbGUZXP3.js";import{i as z}from"./w5vomPQw.js";import{u as F}from"./BPYnHL8L.js";var H=x('<meta name="description" content="安装 TradeCanvas，一分钟内渲染出你的第一个 Canvas 交易图表。"/>'),Q=x(`<h1>快速开始</h1> <p>安装 TradeCanvas，一分钟内即可渲染出图表。</p> <h2>安装</h2> <p>使用你习惯的包管理器：</p> <pre><code>npm install @tradecanvas/chart
# or
pnpm add @tradecanvas/chart
# or
yarn add @tradecanvas/chart</code></pre> <h2>开箱即用的组件</h2> <p><code>ChartWidget</code> 是得到一个可用图表的最快方式。它会在任意宿主元素中渲染完整的
  交易界面——工具栏、画线侧边栏、设置对话框、状态栏——且不依赖任何框架。</p> <pre><code></code></pre> <p>组件默认支持全套专业交易员手势：
  拖动越过最后一根K线进入右侧空白区域，拖动价格轴 / 时间轴进行缩放， <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+拖动框选多个画线，<kbd>Shift</kbd>+拖动进行测量， <kbd>Alt</kbd>+点击固定提示，<kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>K</kbd> 打开命令面板，<kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>P</kbd> 搜索代码，
  按 <kbd>?</kbd> 查看完整的快捷键列表。</p> <h2>无界面 Chart</h2> <p>如果要完全掌控周边界面，可以直接使用更底层的 <code>Chart</code> 类。工具栏由你自己实现，所有功能依然可用：</p> <pre><code></code></pre> <h2>框架封装</h2> <p>React、Vue 和 Svelte 的封装组件见 <a>框架</a>一节。</p> <h2 id="ai">配合编程 agent 使用</h2> <p>编程 agent 可以学会 TradeCanvas，而不必靠猜。<strong>agent 技能</strong>通过经过类型检查的示例讲解 API；在 Claude Code 中用两条命令安装：</p> <pre><code></code></pre> <p><strong>MCP 服务器</strong> <code>@tradecanvas/mcp</code> 依据库自身的目录作答：指标 id、参数及各条线的 key；画线工具及每种需要的点数；<code>ChartWidget</code>、<code>Chart</code> 和 <code>ChartWidgetGrid</code> 的选项；功能开关和样式 key。其中 <code>validate_options</code> 工具会在使用前检查选项对象，并指出本意要写的选项。在 Claude Code 中：</p> <pre><code></code></pre> <p>Cursor、Claude Desktop 和大多数其他客户端在 MCP 设置中使用同样的命令：</p> <pre><code></code></pre> <p>在 Windows 上（不经过 WSL），npx 需要通过 <code>cmd</code> 启动：<code>claude mcp add tradecanvas -- cmd /c npx -y @tradecanvas/mcp</code>，或在设置中写 <code>"command": "cmd", "args": ["/c", "npx", "-y", "@tradecanvas/mcp"]</code>。 在 Git Bash 中（Claude Code 在 Windows 上用它运行 <code>!</code> 命令）要写成 <code>//c</code>：Git Bash 会把 <code>/c</code> 改写成路径。</p> <p>两者都不用时，<a href="https://tradecanvas.dev/llms.txt">llms.txt</a> 和 <a href="https://tradecanvas.dev/llms-full.txt">llms-full.txt</a> 把文档集中在一个文件里提供给 AI 助手。</p> <h2>下一步</h2> <ul><li><a>API 参考</a> — <code>Chart</code> 与 <code>ChartWidget</code> 的完整接口</li> <li><a>图表类型</a> — 18 种内置图表类型</li> <li><a>指标</a> — 134 个指标的目录</li> <li><a>实时数据与回放</a> — 流式数据适配器与回放模式</li> <li><a>分析</a> — 策略回测与风险指标</li></ul>`,1);function da(y,w){q(w,!1);const{href:r}=F();z();var k=Q();j("qntbe8",f=>{var b=H();E(()=>{J.title="快速开始 — TradeCanvas 文档"}),_(f,b)});var n=a(N(k),14),W=e(n);W.textContent=`import { ChartWidget } from '@tradecanvas/chart/widget'
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
})`,t(n);var o=a(n,8),I=e(o);I.textContent=`import { Chart } from '@tradecanvas/chart'

const chart = new Chart(host, {
  chartType: 'candlestick',
  theme: 'dark',
})

chart.setData(bars)
chart.addIndicator('sma', { period: 20 })`,t(o);var s=a(o,4),S=a(e(s));d(),t(s);var p=a(s,6),T=e(p);T.textContent=`/plugin marketplace add bonguynvan/tradecanvas
/plugin install tradecanvas@tradecanvas`,t(p);var i=a(p,4),A=e(i);A.textContent="claude mcp add tradecanvas -- npx -y @tradecanvas/mcp",t(i);var l=a(i,4),B=e(l);B.textContent=`{
  "mcpServers": {
    "tradecanvas": { "command": "npx", "args": ["-y", "@tradecanvas/mcp"] }
  }
}`,t(l);var u=a(l,8),h=e(u),P=e(h);d(5),t(h);var m=a(h,2),D=e(m);d(),t(m);var v=a(m,2),G=e(v);d(),t(v);var C=a(v,2),L=e(C);d(),t(C);var g=a(C,2),K=e(g);d(),t(g),t(u),R((f,b,M,O,V,$)=>{c(S,"href",f),c(P,"href",b),c(D,"href",M),c(G,"href",O),c(L,"href",V),c(K,"href",$)},[()=>r("/docs/frameworks"),()=>r("/docs/api"),()=>r("/docs/chart-types"),()=>r("/docs/indicators"),()=>r("/docs/realtime"),()=>r("/docs/analytics")]),_(y,k),U()}export{da as default};
