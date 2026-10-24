import"./Bzak7iHL.js";import"./DQttDCvw.js";import{p as V,_ as E,$ as D,a as g,s as e,a0 as L,c as t,r as a,a1 as o,t as F,b as I,f as C}from"./vnnAQmBw.js";import{h as M}from"./Di_Vksbt.js";import{s as O}from"./BbGUZXP3.js";import{i as U}from"./w5vomPQw.js";import{u as $}from"./BPYnHL8L.js";var N=C('<meta name="description" content="Paquetes envoltorio de TradeCanvas para React, Vue y Svelte, con props y refs idiomáticas."/>'),Z=C(`<h1>Envoltorios para frameworks</h1> <p>Envoltorios idiomáticos para React, Vue y Svelte. Los tres exponen las mismas props y te dan acceso a la instancia de <code>Chart</code> subyacente.</p> <h2>Instalación</h2> <pre><code></code></pre> <h2>React</h2> <pre><code></code></pre> <h2>Vue</h2> <pre><code></code></pre> <h2>Svelte</h2> <pre><code></code></pre> <h2>Props comunes</h2> <p>Velas propias, indicadores con sus parámetros y un gráfico que nunca abre un flujo por su cuenta:</p> <pre><code></code></pre> <table><thead><tr><th>Prop</th><th>Tipo</th><th>Notas</th></tr></thead><tbody><tr><td><code>symbol</code></td><td><code>string</code></td><td>El símbolo del flujo. Por defecto <code>'BTCUSDT'</code>.</td></tr><tr><td><code>timeframe</code></td><td><code>TimeFrame</code></td><td>La temporalidad del flujo. Por defecto <code>'5m'</code>.</td></tr><tr><td><code>theme</code></td><td><code>'dark' | 'light' | Theme</code></td><td>Por defecto <code>'dark'</code>.</td></tr><tr><td><code>chartType</code></td><td><code>ChartType</code></td><td>Por defecto <code>'candlestick'</code>.</td></tr><tr><td><code>data</code></td><td><code>OHLCBar[]</code></td><td>Velas propias, tal cual. Si están al montar, no se abre ningún flujo; si llegan después, un flujo ya abierto sigue (<code></code> lo cierra). En Vue y Svelte, una vela añadida al mismo array, o un cambio en la última, entra como un tick en vivo y la vista se queda donde está; un array nuevo es una serie nueva.</td></tr><tr><td><code>adapter</code></td><td><code>DataAdapter</code></td><td>El origen del flujo; Binance si no se da.</td></tr><tr><td><code>stream</code></td><td><code>boolean</code></td><td><code>false</code>: ningún flujo, el gráfico espera a <code>data</code>. Por defecto <code>true</code>.</td></tr><tr><td><code>historyLimit</code></td><td><code>number</code></td><td>Velas que el flujo carga primero. Por defecto 500.</td></tr><tr><td><code>indicators</code></td><td><code>IndicatorSpec[]</code></td><td><code>'rsi'</code>, o <code></code>; uno cuyos parámetros cambian se vuelve a poner con ellos.</td></tr><tr><td><code>features</code></td><td><code>FeaturesConfig</code></td><td>Lo que el usuario puede hacer en el gráfico; los cambios tras montarlo también se aplican.</td></tr><tr><td><code>signalMarkers / tradeZones</code></td><td><code>arrays</code></td><td>Marcas de compra y venta y operaciones; una repetición las muestra al llegar a ellas.</td></tr><tr><td><code>signalMarkerStyle / tradeZoneStyle</code></td><td><code>estilos</code></td><td>Sus colores y etiquetas.</td></tr><tr><td><code>overrides</code></td><td><code>ChartStyleOverrides</code></td><td>El aspecto del gráfico por clave (ver <a>Estilos</a>).</td></tr><tr><td><code>autoScale</code></td><td><code>boolean</code></td><td>Por defecto <code>true</code>.</td></tr><tr><td><code>watermarkText</code></td><td><code>string</code></td><td>Texto detrás de las velas.</td></tr><tr><td><code>options</code></td><td><code>Partial&lt;ChartOptions&gt;</code></td><td>Opciones del gráfico que las props no cubren (<code>maxBarSpacing</code>, <code>rightMargin</code>, <code>renderer</code>…), combinadas sobre los valores por defecto del componente al montarlo. Los cambios posteriores no se aplican; <code>chartType</code>, <code>theme</code> y <code>autoScale</code> siempre salen de sus props.</td></tr><tr><td><code>onReady</code></td><td><code>(chart) =&gt; void</code></td><td>Tras montar el gráfico (Vue: el evento <code>ready</code>).</td></tr></tbody></table> <blockquote>¿Necesitas algo más allá de las props? Accede al <code>Chart</code> subyacente
  mediante <code>onReady</code>, una ref (React / Vue) o <code>bind:chart</code> (Svelte) para usar la API completa: dibujos, trading, adaptadores de ejecución,
  plugins, paneles redimensionables y más.</blockquote>`,1);function X(T,_){V(_,!1);const{href:S}=$();U();var m=Z();M("11ntwen",p=>{var w=N();E(()=>{D.title="Frameworks — Documentación de TradeCanvas"}),g(p,w)});var d=e(L(m),6),k=t(d);k.textContent=`npm install @tradecanvas/react   # or @tradecanvas/vue · @tradecanvas/svelte
npm install @tradecanvas/chart   # the core (peer of each wrapper)`,a(d);var r=e(d,4),R=t(r);R.textContent=`import { TradeCanvas, type TradeCanvasRef } from '@tradecanvas/react'
import { BinanceAdapter } from '@tradecanvas/chart'
import { useRef } from 'react'

function App() {
  const chartRef = useRef<TradeCanvasRef>(null)

  return (
    <TradeCanvas
      ref={chartRef}
      symbol="BTCUSDT"
      timeframe="5m"
      theme="dark"
      adapter={new BinanceAdapter()}
      onReady={(chart) => {
        chart.on('orderPlace', e => console.log(e.payload))
      }}
    />
  )
}`,a(r);var c=e(r,4),x=t(c);x.textContent=`<script setup lang="ts">
import { TradeCanvas } from '@tradecanvas/vue'
import { BinanceAdapter } from '@tradecanvas/chart'

const adapter = new BinanceAdapter()
<\/script>

<template>
  <TradeCanvas
    symbol="BTCUSDT"
    timeframe="5m"
    theme="dark"
    :adapter="adapter"
    @ready="(chart) => console.log('ready', chart)"
  />
</template>`,a(c);var n=e(c,4),B=t(n);B.textContent=`<script lang="ts">
  import { TradeCanvas } from '@tradecanvas/svelte'
  import { BinanceAdapter } from '@tradecanvas/chart'

  const adapter = new BinanceAdapter()
<\/script>

<TradeCanvas
  symbol="BTCUSDT"
  timeframe="5m"
  theme="dark"
  {adapter}
  onReady={(chart) => console.log('ready', chart)}
/>`,a(n);var s=e(n,6),P=t(s);P.textContent=`<script lang="ts">
  import { TradeCanvas } from '@tradecanvas/svelte'
  import type { Chart } from '@tradecanvas/chart'

  let { bars } = $props()
  let chart = $state<Chart | null>(null)
<\/script>

<TradeCanvas
  data={bars}
  stream={false}
  indicators={['rsi', { id: 'ema', params: { period: 50 } }]}
  features={{ replay: true }}
  bind:chart
/>`,a(s);var u=e(s,2),v=e(t(u)),i=e(t(v),4),f=e(t(i),2),j=e(t(f));j.textContent="stream=false",o(),a(f),a(i);var l=e(i,4),h=e(t(l),2),A=e(t(h),2);A.textContent="{ id, params, position }",o(),a(h),a(l);var y=e(l,4),b=e(t(y),2),q=e(t(b));o(),a(b),a(y),o(4),a(v),a(u),o(2),F(p=>O(q,"href",p),[()=>S("/docs/styling#overrides")]),g(T,m),I()}export{X as default};
