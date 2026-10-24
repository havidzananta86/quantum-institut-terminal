import"./Bzak7iHL.js";import"./DQttDCvw.js";import{p as U,_ as $,$ as F,a as T,s as e,a0 as I,c as t,r as d,a1 as a,t as M,b as O,f as b}from"./vnnAQmBw.js";import{h as q}from"./Di_Vksbt.js";import{s as L}from"./BbGUZXP3.js";import{i as Z}from"./w5vomPQw.js";import{u as H}from"./BPYnHL8L.js";var j=b('<meta name="description" content="TradeCanvas 用の React、Vue、Svelte ラッパーパッケージ。各フレームワークに沿った props と ref を備えています。"/>'),z=b(`<h1>フレームワーク用ラッパー</h1> <p>React、Vue、Svelte のそれぞれの流儀に沿ったラッパーです。3 つとも同じ props を公開し、内部の <code>Chart</code> インスタンスを受け取れます。</p> <h2>インストール</h2> <pre><code></code></pre> <h2>React</h2> <pre><code></code></pre> <h2>Vue</h2> <pre><code></code></pre> <h2>Svelte</h2> <pre><code></code></pre> <h2>共通の props</h2> <p>自前の足、入力つきのインジケーター、そして自分からストリームを開かないチャート：</p> <pre><code></code></pre> <table><thead><tr><th>Prop</th><th>型</th><th>説明</th></tr></thead><tbody><tr><td><code>symbol</code></td><td><code>string</code></td><td>ストリームの銘柄。既定は <code>'BTCUSDT'</code>。</td></tr><tr><td><code>timeframe</code></td><td><code>TimeFrame</code></td><td>ストリームの時間足。既定は <code>'5m'</code>。</td></tr><tr><td><code>theme</code></td><td><code>'dark' | 'light' | Theme</code></td><td>既定は <code>'dark'</code>。</td></tr><tr><td><code>chartType</code></td><td><code>ChartType</code></td><td>既定は <code>'candlestick'</code>。</td></tr><tr><td><code>data</code></td><td><code>OHLCBar[]</code></td><td>自前の足をそのまま表示します。マウント時にあればストリームは開きません。あとから渡した場合、開いているストリームはそのままです（<code></code> で閉じます）。Vue と Svelte では、同じ配列に追加した足や最後の足の変更はライブの tick として入り、表示位置はそのままです。新しい配列は新しい系列になります。</td></tr><tr><td><code>adapter</code></td><td><code>DataAdapter</code></td><td>ストリームの取得元。なければ Binance。</td></tr><tr><td><code>stream</code></td><td><code>boolean</code></td><td><code>false</code>：ストリームを一切開かず、<code>data</code> を待ちます。既定は <code>true</code>。</td></tr><tr><td><code>historyLimit</code></td><td><code>number</code></td><td>ストリームが最初に読み込む足の数。既定は 500。</td></tr><tr><td><code>indicators</code></td><td><code>IndicatorSpec[]</code></td><td><code>'rsi'</code>、または <code></code>。入力が変わったものは新しい入力で付け直します。</td></tr><tr><td><code>features</code></td><td><code>FeaturesConfig</code></td><td>チャート上でユーザーができること。マウント後の変更も反映されます。</td></tr><tr><td><code>signalMarkers / tradeZones</code></td><td><code>配列</code></td><td>売買のマークと取引。リプレイは届いた時点で表示します。</td></tr><tr><td><code>signalMarkerStyle / tradeZoneStyle</code></td><td><code>スタイル</code></td><td>色とラベル。</td></tr><tr><td><code>overrides</code></td><td><code>ChartStyleOverrides</code></td><td>キーで指定するチャートの見た目（<a>スタイル設定</a>を参照）。</td></tr><tr><td><code>autoScale</code></td><td><code>boolean</code></td><td>既定は <code>true</code>。</td></tr><tr><td><code>watermarkText</code></td><td><code>string</code></td><td>足の背後に出す透かし文字。</td></tr><tr><td><code>options</code></td><td><code>Partial&lt;ChartOptions&gt;</code></td><td>props でカバーされないチャートのオプション（<code>maxBarSpacing</code>、<code>rightMargin</code>、<code>renderer</code>…）。マウント時にコンポーネントの既定値に重ねてマージされます。マウント後の変更は反映されません。<code>chartType</code>、<code>theme</code>、<code>autoScale</code> は常にそれぞれの props から取られます。</td></tr><tr><td><code>onReady</code></td><td><code>(chart) =&gt; void</code></td><td>チャートのマウント後（Vue は <code>ready</code> イベント）。</td></tr></tbody></table> <blockquote>props だけでは足りない場合は、<code>onReady</code>、ref（React / Vue）、
  または <code>bind:chart</code>（Svelte）で内部の <code>Chart</code> にアクセスしてください。
  描画、トレーディング、執行アダプター、プラグイン、サイズ変更できるペインなど、
  API のすべてを使えます。</blockquote>`,1);function X(g,_){U(_,!1);const{href:S}=H();Z();var l=z();q("6myce0",m=>{var P=j();$(()=>{F.title="フレームワーク — TradeCanvas ドキュメント"}),T(m,P)});var r=e(I(l),6),R=t(r);R.textContent=`npm install @tradecanvas/react   # or @tradecanvas/vue · @tradecanvas/svelte
npm install @tradecanvas/chart   # the core (peer of each wrapper)`,d(r);var o=e(r,4),k=t(o);k.textContent=`import { TradeCanvas, type TradeCanvasRef } from '@tradecanvas/react'
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
}`,d(o);var c=e(o,4),B=t(c);B.textContent=`<script setup lang="ts">
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
</template>`,d(c);var n=e(c,4),x=t(n);x.textContent=`<script lang="ts">
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
/>`,d(n);var s=e(n,6),A=t(s);A.textContent=`<script lang="ts">
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
/>`,d(s);var h=e(s,2),v=e(t(h)),p=e(t(v),4),f=e(t(p),2),w=e(t(f));w.textContent="stream=false",a(),d(f),d(p);var i=e(p,4),u=e(t(i),2),V=e(t(u),2);V.textContent="{ id, params, position }",a(),d(u),d(i);var C=e(i,4),y=e(t(C),2),D=e(t(y));a(),d(y),d(C),a(4),d(v),d(h),a(2),M(m=>L(D,"href",m),[()=>S("/docs/styling#overrides")]),T(g,l),O()}export{X as default};
