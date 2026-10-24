import"./Bzak7iHL.js";import"./DQttDCvw.js";import{p as O,_ as R,$ as U,a as y,s as a,a0 as V,c as e,r,a1 as o,t as $,b as J,f as _}from"./vnnAQmBw.js";import{h as K}from"./Di_Vksbt.js";import{s as d}from"./BbGUZXP3.js";import{i as N}from"./w5vomPQw.js";import{u as F}from"./BPYnHL8L.js";var H=_('<meta name="description" content="Instala TradeCanvas y muestra tu primer gráfico de trading en canvas en menos de un minuto."/>'),Q=_(`<h1>Primeros pasos</h1> <p>Instala TradeCanvas y muestra un gráfico en menos de un minuto.</p> <h2>Instalación</h2> <p>Usa el gestor de paquetes que prefieras:</p> <pre><code>npm install @tradecanvas/chart
# or
pnpm add @tradecanvas/chart
# or
yarn add @tradecanvas/chart</code></pre> <h2>Widget listo para usar</h2> <p><code>ChartWidget</code> es el camino más rápido hacia un gráfico funcional.
  Muestra una interfaz de trading completa dentro de cualquier elemento
  contenedor —barra de herramientas, barra lateral de dibujo, cuadro de
  configuración, barra de estado— sin depender de ningún framework.</p> <pre><code></code></pre> <p>De serie, el widget admite todos los gestos de un trader profesional:
  arrastrar más allá de la última barra hacia el espacio futuro vacío, arrastrar
  los ejes de precio/tiempo para escalar, <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+arrastrar
  para seleccionar varios dibujos, <kbd>Shift</kbd>+arrastrar para medir, <kbd>Alt</kbd>+clic para fijar la información de una barra, <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>K</kbd> para la paleta de comandos, <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>P</kbd> para buscar símbolos y <kbd>?</kbd> para ver la lista completa de atajos.</p> <h2>Chart sin interfaz</h2> <p>Para controlar por completo la interfaz que lo rodea, usa directamente la clase <code>Chart</code>, de más bajo nivel. Tú pones la barra de herramientas y
  conservas todas las funciones:</p> <pre><code></code></pre> <h2>Envoltorios para frameworks</h2> <p>Los envoltorios para React, Vue y Svelte están en la sección de <a>frameworks</a>.</p> <h2 id="ai">Con un agente de programación</h2> <p>Los agentes de programación pueden aprender TradeCanvas en lugar de adivinarlo. La <strong>skill para agentes</strong> enseña la API con ejemplos cuyos tipos se comprueban; en Claude Code se instala con dos comandos:</p> <pre><code></code></pre> <p>El <strong>servidor MCP</strong>, <code>@tradecanvas/mcp</code>, responde con el propio catálogo de la biblioteca: los ids de los indicadores, sus parámetros y las claves de sus líneas; las herramientas de dibujo y los puntos que pide cada una; las opciones de <code>ChartWidget</code>, <code>Chart</code> y <code>ChartWidgetGrid</code>; los interruptores de funciones y las claves de estilo. Su herramienta <code>validate_options</code> revisa un objeto de opciones antes de usarlo y nombra la opción que se quería escribir. En Claude Code:</p> <pre><code></code></pre> <p>Cursor, Claude Desktop y la mayoría de los demás clientes aceptan el mismo comando en su configuración MCP:</p> <pre><code></code></pre> <p>En Windows fuera de WSL, npx se inicia a través de <code>cmd</code>: <code>claude mcp add tradecanvas -- cmd /c npx -y @tradecanvas/mcp</code>, o en la configuración <code>"command": "cmd", "args": ["/c", "npx", "-y", "@tradecanvas/mcp"]</code>. En Git Bash, que ejecuta los comandos <code>!</code> de Claude Code en Windows, escribe <code>//c</code>: Git Bash convierte <code>/c</code> en una ruta.</p> <p>Sin ninguno de los dos, <a href="https://tradecanvas.dev/llms.txt">llms.txt</a> y <a href="https://tradecanvas.dev/llms-full.txt">llms-full.txt</a> dan a un asistente la documentación en un solo archivo.</p> <h2>Siguientes pasos</h2> <ul><li><a>Referencia de la API</a> — superficie completa de <code>Chart</code> y <code>ChartWidget</code></li> <li><a>Tipos de gráfico</a> — 18 tipos de gráfico integrados</li> <li><a>Indicadores</a> — catálogo de 134 indicadores</li> <li><a>Tiempo real y repetición</a> — adaptadores de streaming y modo de repetición</li> <li><a>Análisis</a> — backtester de estrategias y métricas de riesgo</li></ul>`,1);function oa(x,w){O(w,!1);const{href:t}=F();N();var b=Q();K("8prof6",f=>{var g=H();R(()=>{U.title="Primeros pasos — Documentación de TradeCanvas"}),y(f,g)});var n=a(V(b),14),j=e(n);j.textContent=`import { ChartWidget } from '@tradecanvas/chart/widget'
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
})`,r(n);var s=a(n,8),I=e(s);I.textContent=`import { Chart } from '@tradecanvas/chart'

const chart = new Chart(host, {
  chartType: 'candlestick',
  theme: 'dark',
})

chart.setData(bars)
chart.addIndicator('sma', { period: 20 })`,r(s);var c=a(s,4),S=a(e(c));o(),r(c);var i=a(c,6),T=e(i);T.textContent=`/plugin marketplace add bonguynvan/tradecanvas
/plugin install tradecanvas@tradecanvas`,r(i);var p=a(i,4),W=e(p);W.textContent="claude mcp add tradecanvas -- npx -y @tradecanvas/mcp",r(p);var l=a(p,4),q=e(l);q.textContent=`{
  "mcpServers": {
    "tradecanvas": { "command": "npx", "args": ["-y", "@tradecanvas/mcp"] }
  }
}`,r(l);var C=a(l,8),m=e(C),P=e(m);o(4),r(m);var u=a(m,2),A=e(u);o(),r(u);var h=a(u,2),B=e(h);o(),r(h);var v=a(h,2),D=e(v);o(),r(v);var k=a(v,2),E=e(k);o(),r(k),r(C),$((f,g,L,G,z,M)=>{d(S,"href",f),d(P,"href",g),d(A,"href",L),d(B,"href",G),d(D,"href",z),d(E,"href",M)},[()=>t("/docs/frameworks"),()=>t("/docs/api"),()=>t("/docs/chart-types"),()=>t("/docs/indicators"),()=>t("/docs/realtime"),()=>t("/docs/analytics")]),y(x,b),J()}export{oa as default};
