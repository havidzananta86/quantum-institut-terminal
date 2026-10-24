import"./Bzak7iHL.js";import"./DQttDCvw.js";import{p as P,_ as F,$ as N,a as C,s as t,a0 as U,c as e,r as d,a1 as a,t as $,b as q,f as y}from"./vnnAQmBw.js";import{h as G}from"./Di_Vksbt.js";import{s as I}from"./BbGUZXP3.js";import{i as O}from"./w5vomPQw.js";import{u as K}from"./BPYnHL8L.js";var L=y('<meta name="description" content="Các gói wrapper React, Vue và Svelte cho TradeCanvas, với props và ref đúng phong cách của từng framework."/>'),W=y(`<h1>Wrapper cho framework</h1> <p>Wrapper đúng phong cách cho React, Vue và Svelte. Cả ba có cùng một bộ props và trao cho bạn instance <code>Chart</code> bên dưới.</p> <h2>Cài đặt</h2> <pre><code></code></pre> <h2>React</h2> <pre><code></code></pre> <h2>Vue</h2> <pre><code></code></pre> <h2>Svelte</h2> <pre><code></code></pre> <h2>Props dùng chung</h2> <p>Nến của riêng bạn, chỉ báo kèm tham số, và một biểu đồ không bao giờ tự mở luồng dữ liệu:</p> <pre><code></code></pre> <table><thead><tr><th>Prop</th><th>Kiểu</th><th>Ghi chú</th></tr></thead><tbody><tr><td><code>symbol</code></td><td><code>string</code></td><td>Mã của luồng dữ liệu. Mặc định <code>'BTCUSDT'</code>.</td></tr><tr><td><code>timeframe</code></td><td><code>TimeFrame</code></td><td>Khung thời gian của luồng. Mặc định <code>'5m'</code>.</td></tr><tr><td><code>theme</code></td><td><code>'dark' | 'light' | Theme</code></td><td>Mặc định <code>'dark'</code>.</td></tr><tr><td><code>chartType</code></td><td><code>ChartType</code></td><td>Mặc định <code>'candlestick'</code>.</td></tr><tr><td><code>data</code></td><td><code>OHLCBar[]</code></td><td>Nến của riêng bạn, hiện đúng như vậy. Có ngay lúc mount thì không mở luồng nào; đưa vào sau thì luồng đang mở vẫn giữ (<code></code> sẽ đóng nó). Với Vue và Svelte, nến push thêm vào cùng mảng, hoặc nến cuối thay đổi, được đưa vào như một tick realtime và khung nhìn giữ nguyên; một mảng mới là một chuỗi dữ liệu mới.</td></tr><tr><td><code>adapter</code></td><td><code>DataAdapter</code></td><td>Nguồn của luồng; không có thì dùng Binance.</td></tr><tr><td><code>stream</code></td><td><code>boolean</code></td><td><code>false</code>: không có luồng nào, biểu đồ chờ <code>data</code>. Mặc định <code>true</code>.</td></tr><tr><td><code>historyLimit</code></td><td><code>number</code></td><td>Số nến luồng nạp lúc đầu. Mặc định 500.</td></tr><tr><td><code>indicators</code></td><td><code>IndicatorSpec[]</code></td><td><code>'rsi'</code>, hoặc <code></code>; chỉ báo nào đổi tham số sẽ được đặt lại với tham số mới.</td></tr><tr><td><code>features</code></td><td><code>FeaturesConfig</code></td><td>Người dùng được làm gì trên biểu đồ; đổi sau khi mount cũng có hiệu lực.</td></tr><tr><td><code>signalMarkers / tradeZones</code></td><td><code>mảng</code></td><td>Điểm mua, bán và lệnh giao dịch; phát lại sẽ hiện chúng khi chạy tới.</td></tr><tr><td><code>signalMarkerStyle / tradeZoneStyle</code></td><td><code>style</code></td><td>Màu và nhãn của chúng.</td></tr><tr><td><code>overrides</code></td><td><code>ChartStyleOverrides</code></td><td>Giao diện biểu đồ theo khoá (xem <a>Giao diện</a>).</td></tr><tr><td><code>autoScale</code></td><td><code>boolean</code></td><td>Mặc định <code>true</code>.</td></tr><tr><td><code>watermarkText</code></td><td><code>string</code></td><td>Chữ chìm phía sau các nến.</td></tr><tr><td><code>options</code></td><td><code>Partial&lt;ChartOptions&gt;</code></td><td>Tuỳ chọn của chart mà các prop không có (<code>maxBarSpacing</code>, <code>rightMargin</code>, <code>renderer</code>…), gộp đè lên mặc định của component khi mount. Đổi sau khi mount không được áp dụng; <code>chartType</code>, <code>theme</code> và <code>autoScale</code> luôn lấy từ prop của chúng.</td></tr><tr><td><code>onReady</code></td><td><code>(chart) =&gt; void</code></td><td>Sau khi biểu đồ mount (Vue: sự kiện <code>ready</code>).</td></tr></tbody></table> <blockquote>Cần nhiều hơn những gì props cung cấp? Truy cập <code>Chart</code> bên dưới qua <code>onReady</code>, một ref (React / Vue) hoặc <code>bind:chart</code> (Svelte)
  để dùng toàn bộ API — hình vẽ, giao dịch, adapter khớp lệnh, plugin, bảng
  đổi được kích thước và nhiều thứ khác.</blockquote>`,1);function X(k,T){P(T,!1);const{href:_}=K();O();var m=W();G("ahs3b0",p=>{var D=L();F(()=>{N.title="Framework — Tài liệu TradeCanvas"}),C(p,D)});var r=t(U(m),6),S=e(r);S.textContent=`npm install @tradecanvas/react   # or @tradecanvas/vue · @tradecanvas/svelte
npm install @tradecanvas/chart   # the core (peer of each wrapper)`,d(r);var n=t(r,4),R=e(n);R.textContent=`import { TradeCanvas, type TradeCanvasRef } from '@tradecanvas/react'
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
}`,d(n);var c=t(n,4),B=e(c);B.textContent=`<script setup lang="ts">
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
</template>`,d(c);var o=t(c,4),x=e(o);x.textContent=`<script lang="ts">
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
/>`,d(o);var h=t(o,6),M=e(h);M.textContent=`<script lang="ts">
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
/>`,d(h);var l=t(h,2),u=t(e(l)),i=t(e(u),4),v=t(e(i),2),w=t(e(v));w.textContent="stream=false",a(),d(v),d(i);var s=t(i,4),g=t(e(s),2),A=t(e(g),2);A.textContent="{ id, params, position }",a(),d(g),d(s);var f=t(s,4),b=t(e(f),2),V=t(e(b));a(),d(b),d(f),a(4),d(u),d(l),a(2),$(p=>I(V,"href",p),[()=>_("/docs/styling#overrides")]),C(k,m),q()}export{X as default};
