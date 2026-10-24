const R="https://stackblitz.com",_=["angular-cli","create-react-app","html","javascript","node","polymer","typescript","vue"],$=["project","search","ports","settings"],N=["light","dark"],O=["editor","preview"],I={clickToLoad:e=>l("ctl",e),devToolsHeight:e=>D("devtoolsheight",e),forceEmbedLayout:e=>l("embed",e),hideDevTools:e=>l("hidedevtools",e),hideExplorer:e=>l("hideExplorer",e),hideNavigation:e=>l("hideNavigation",e),openFile:e=>h("file",e),showSidebar:e=>U("showSidebar",e),sidebarView:e=>b("sidebarView",e,$),startScript:e=>h("startScript",e),terminalHeight:e=>D("terminalHeight",e),theme:e=>b("theme",e,N),view:e=>b("view",e,O),zenMode:e=>l("zenMode",e),organization:e=>`${h("orgName",e==null?void 0:e.name)}&${h("orgProvider",e==null?void 0:e.provider)}`,crossOriginIsolated:e=>l("corp",e)};function x(e={}){const t=Object.entries(e).map(([r,n])=>n!=null&&I.hasOwnProperty(r)?I[r](n):"").filter(Boolean);return t.length?`?${t.join("&")}`:""}function l(e,t){return t===!0?`${e}=1`:""}function U(e,t){return typeof t=="boolean"?`${e}=${t?"1":"0"}`:""}function D(e,t){if(typeof t=="number"&&!Number.isNaN(t)){const r=Math.min(100,Math.max(0,t));return`${e}=${encodeURIComponent(Math.round(r))}`}return""}function b(e,t="",r=[]){return r.includes(t)?`${e}=${encodeURIComponent(t)}`:""}function h(e,t){return(Array.isArray(t)?t:[t]).filter(n=>typeof n=="string"&&n.trim()!=="").map(n=>`${e}=${encodeURIComponent(n)}`).join("&")}function A(){return Math.random().toString(36).slice(2,6)+Math.random().toString(36).slice(2,6)}function y(e,t){return`${F(t)}${e}${x(t)}`}function T(e,t){const r={forceEmbedLayout:!0};return t&&typeof t=="object"&&Object.assign(r,t),`${F(r)}${e}${x(r)}`}function F(e={}){return(typeof e.origin=="string"?e.origin:R).replace(/\/$/,"")}function w(e,t,r){if(!t||!e||!e.parentNode)throw new Error("Invalid Element");e.id&&(t.id=e.id),e.className&&(t.className=e.className),L(t,r),M(e,t,r),e.replaceWith(t)}function E(e){if(typeof e=="string"){const t=document.getElementById(e);if(!t)throw new Error(`Could not find element with id '${e}'`);return t}else if(e instanceof HTMLElement)return e;throw new Error(`Invalid element: ${e}`)}function S(e){return e&&e.newWindow===!1?"_self":"_blank"}function L(e,t={}){const r=Object.hasOwnProperty.call(t,"height")?`${t.height}`:"300",n=Object.hasOwnProperty.call(t,"width")?`${t.width}`:void 0;e.setAttribute("height",r),n?e.setAttribute("width",n):e.setAttribute("style","width:100%;")}function M(e,t,r={}){var i,a;const n=((a=(i=e.allow)==null?void 0:i.split(";"))==null?void 0:a.map(s=>s.trim()))??[];r.crossOriginIsolated&&!n.includes("cross-origin-isolated")&&n.push("cross-origin-isolated"),n.length>0&&(t.allow=n.join("; "))}class B{constructor(t){this.pending={},this.port=t,this.port.onmessage=this.messageListener.bind(this)}request({type:t,payload:r}){return new Promise((n,i)=>{const a=A();this.pending[a]={resolve:n,reject:i},this.port.postMessage({type:t,payload:{...r,__reqid:a}})})}messageListener(t){var c;if(typeof((c=t.data.payload)==null?void 0:c.__reqid)!="string")return;const{type:r,payload:n}=t.data,{__reqid:i,__success:a,__error:s}=n;this.pending[i]&&(a?this.pending[i].resolve(this.cleanResult(n)):this.pending[i].reject(s?`${r}: ${s}`:r),delete this.pending[i])}cleanResult(t){const r={...t};return delete r.__reqid,delete r.__success,delete r.__error,Object.keys(r).length?r:null}}class V{constructor(t,r){this.editor={openFile:n=>this._rdc.request({type:"SDK_OPEN_FILE",payload:{path:n}}),setCurrentFile:n=>this._rdc.request({type:"SDK_SET_CURRENT_FILE",payload:{path:n}}),setTheme:n=>this._rdc.request({type:"SDK_SET_UI_THEME",payload:{theme:n}}),setView:n=>this._rdc.request({type:"SDK_SET_UI_VIEW",payload:{view:n}}),showSidebar:(n=!0)=>this._rdc.request({type:"SDK_TOGGLE_SIDEBAR",payload:{visible:n}})},this.preview={origin:"",getUrl:()=>this._rdc.request({type:"SDK_GET_PREVIEW_URL",payload:{}}).then(n=>(n==null?void 0:n.url)??null),setUrl:(n="/")=>{if(typeof n!="string"||!n.startsWith("/"))throw new Error(`Invalid argument: expected a path starting with '/', got '${n}'`);return this._rdc.request({type:"SDK_SET_PREVIEW_URL",payload:{path:n}})}},this._rdc=new B(t),Object.defineProperty(this.preview,"origin",{value:typeof r.previewOrigin=="string"?r.previewOrigin:null,writable:!1})}applyFsDiff(t){const r=n=>n!==null&&typeof n=="object";if(!r(t)||!r(t.create))throw new Error("Invalid diff object: expected diff.create to be an object.");if(!Array.isArray(t.destroy))throw new Error("Invalid diff object: expected diff.destroy to be an array.");return this._rdc.request({type:"SDK_APPLY_FS_DIFF",payload:t})}getDependencies(){return this._rdc.request({type:"SDK_GET_DEPS_SNAPSHOT",payload:{}})}getFsSnapshot(){return this._rdc.request({type:"SDK_GET_FS_SNAPSHOT",payload:{}})}}const g=[];class k{constructor(t){this.id=A(),this.element=t,this.pending=new Promise((r,n)=>{const i=({data:o,ports:d})=>{(o==null?void 0:o.action)==="SDK_INIT_SUCCESS"&&o.id===this.id&&(this.vm=new V(d[0],o.payload),r(this.vm),s())},a=()=>{var o;(o=this.element.contentWindow)==null||o.postMessage({action:"SDK_INIT",id:this.id},"*")};function s(){window.clearInterval(m),window.removeEventListener("message",i)}window.addEventListener("message",i),a();let c=0;const m=window.setInterval(()=>{if(this.vm){s();return}if(c>=20){s(),n("Timeout: Unable to establish a connection with the StackBlitz VM"),g.forEach((o,d)=>{o.id===this.id&&g.splice(d,1)});return}c++,a()},500)}),g.push(this)}}const H=e=>{const t=e instanceof Element?"element":"id";return g.find(r=>r[t]===e)??null};function W(e,t){const r=document.createElement("input");return r.type="hidden",r.name=e,r.value=t,r}function G(e){return e.replace(/\[/g,"%5B").replace(/\]/g,"%5D")}function j({template:e,title:t,description:r,dependencies:n,files:i,settings:a}){if(!_.includes(e)){const o=_.map(d=>`'${d}'`).join(", ");console.warn(`Unsupported project.template: must be one of ${o}`)}const s=[],c=(o,d,P="")=>{s.push(W(o,typeof d=="string"?d:P))};c("project[title]",t),typeof r=="string"&&r.length>0&&c("project[description]",r),c("project[template]",e,"javascript"),n&&(e==="node"?console.warn("Invalid project.dependencies: dependencies must be provided as a 'package.json' file when using the 'node' template."):c("project[dependencies]",JSON.stringify(n))),a&&c("project[settings]",JSON.stringify(a)),Object.entries(i).forEach(([o,d])=>{c(`project[files][${G(o)}]`,d)});const m=document.createElement("form");return m.method="POST",m.setAttribute("style","display:none!important;"),m.append(...s),m}function q(e,t){const r=j(e);return r.action=T("/run",t),r.id="sb_run",`<!doctype html>
<html>
<head><title></title></head>
<body>
  ${r.outerHTML}
  <script>document.getElementById('${r.id}').submit();<\/script>
</body>
</html>`}function K(e,t){const r=j(e);r.action=y("/run",t),r.target=S(t),document.body.appendChild(r),r.submit(),document.body.removeChild(r)}function v(e){return e!=null&&e.contentWindow?(H(e)??new k(e)).pending:Promise.reject("Provided element is not an iframe.")}function z(e,t){K(e,t)}function J(e,t){const r=y(`/edit/${e}`,t),n=S(t);window.open(r,n)}function Y(e,t){const r=y(`/github/${e}`,t),n=S(t);window.open(r,n)}function X(e,t,r){var s;const n=E(e),i=q(t,r),a=document.createElement("iframe");return w(n,a,r),(s=a.contentDocument)==null||s.write(i),v(a)}function Q(e,t,r){const n=E(e),i=document.createElement("iframe");return i.src=T(`/edit/${t}`,r),w(n,i,r),v(i)}function Z(e,t,r){const n=E(e),i=document.createElement("iframe");return i.src=T(`/github/${t}`,r),w(n,i,r),v(i)}const ee={connect:v,embedGithubProject:Z,embedProject:X,embedProjectId:Q,openGithubProject:Y,openProject:z,openProjectId:J},p="^1.22.0",C="^1.3.4",te="^6.0.0",re="~5.7.0",ne="html, body { margin: 0; height: 100%; background: #0c1016; }",ie=JSON.stringify({compilerOptions:{target:"ES2020",module:"ESNext",moduleResolution:"bundler",jsx:"react-jsx",strict:!0,esModuleInterop:!0,skipLibCheck:!0,forceConsistentCasingInFileNames:!0},include:["src"]},null,2);function u(e,t,r='<div id="app"></div>',n=""){return["<!DOCTYPE html>",'<html lang="en">',"<head>",'  <meta charset="UTF-8" />','  <meta name="viewport" content="width=device-width, initial-scale=1.0" />',`  <title>${e}</title>`,`  <style>${ne}${n}</style>`,"</head>","<body>",`  ${r}`,`  <script type="module" src="${t}"><\/script>`,"</body>","</html>"].join(`
`)}function f(e){ee.openProject({title:`TradeCanvas — ${e.title}`,template:"node",files:{"package.json":JSON.stringify({name:`tc-sandbox-${e.slug}`,private:!0,type:"module",scripts:{dev:"vite"},dependencies:e.dependencies,devDependencies:{vite:te,typescript:re,...e.devDependencies}},null,2),"tsconfig.json":ie,...e.files}},{openFile:e.openFile,newWindow:!0})}function ae(){f({slug:"vanilla",title:"Vanilla Chart",dependencies:{"@tradecanvas/chart":p},openFile:"src/main.ts",files:{"index.html":u("TradeCanvas — Vanilla","/src/main.ts",'<div id="chart" style="height:100vh"></div>'),"src/main.ts":`import { Chart, BinanceAdapter, DARK_THEME } from '@tradecanvas/chart';

const chart = new Chart(document.getElementById('chart')!, {
  theme: DARK_THEME,
  features: { drawings: true, indicators: true, volume: true },
});

void chart.connect({ adapter: new BinanceAdapter(), symbol: 'BTCUSDT', timeframe: '15m' });

chart.addIndicator('bb', { period: 20, stdDev: 2 });
chart.addIndicator('rsi');
chart.setShapes({ tagRadius: 4 }); // rounded price tags

// Let the user draw: try 'fibRetracement', 'infoLine', 'xabcdPattern', …
chart.setDrawingTool('trendLine');

chart.on('crosshairMove', (e) => {
  // e.payload.bar has the hovered OHLCV
});
chart.on('chartTypeChange', (e) => console.log('type', e.payload.type));

// Bars of 100 trades instead of 15 minutes:
// await chart.setTimeframe('100T');
`}})}function oe(){f({slug:"widget",title:"ChartWidget",dependencies:{"@tradecanvas/chart":p},openFile:"src/main.ts",files:{"index.html":u("TradeCanvas — ChartWidget","/src/main.ts",'<div id="chart" style="height:100vh"></div>'),"src/main.ts":`import { ChartWidget } from '@tradecanvas/chart/widget';
import { BinanceAdapter } from '@tradecanvas/chart';

const widget = new ChartWidget(document.getElementById('chart')!, {
  symbol: 'BTCUSDT',
  symbols: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'PEPEUSDT'],
  timeframe: '5m',
  adapter: new BinanceAdapter(),
  theme: 'dark',
  ui: 'print', // the look: 'print' · 'studio' · 'terminal' · 'capsule', or a theme of yours
  locale: 'en', // 'vi', 'ja', 'ar' (right to left)… with messages from '@tradecanvas/chart/widget/locales'
  watchlist: {
    lists: [
      { id: 'majors', name: 'Majors', symbols: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'] },
      { id: 'memes', name: 'Memes', symbols: ['PEPEUSDT', 'DOGEUSDT'] },
    ],
  },
  trading: true,
  onReady: (chart) => {
    chart.addIndicator('ema', { period: 21 });
    chart.addIndicator('macd');
  },
});

widget.toggleSymbolInfo(true); // price, market status, the day's numbers

// widget.setUI('capsule')     — pills and floating bars
// widget.setTimeframe('100T') — a bar per 100 trades
// widget.toggleReplay()       — bar replay with a scrubber
`}})}function se(){f({slug:"react",title:"React",dependencies:{"@tradecanvas/chart":p,"@tradecanvas/react":C,react:"^19.0.0","react-dom":"^19.0.0"},devDependencies:{"@vitejs/plugin-react":"^4.3.0","@types/react":"^19.0.0","@types/react-dom":"^19.0.0"},openFile:"src/App.tsx",files:{"vite.config.ts":`import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({ plugins: [react()] });
`,"index.html":u("TradeCanvas — React","/src/main.tsx"),"src/main.tsx":`import { createRoot } from 'react-dom/client';
import { App } from './App';

createRoot(document.getElementById('app')!).render(<App />);
`,"src/App.tsx":`import { useRef, useState } from 'react';
import { TradeCanvas, type TradeCanvasRef } from '@tradecanvas/react';
import type { TimeFrame } from '@tradecanvas/chart';

const TIMEFRAMES: TimeFrame[] = ['1m', '5m', '15m', '1h', '4h'];

export function App() {
  const [timeframe, setTimeframe] = useState<TimeFrame>('15m');
  const ref = useRef<TradeCanvasRef>(null);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <nav style={{ display: 'flex', gap: 6, padding: 8 }}>
        {TIMEFRAMES.map((tf) => (
          <button key={tf} onClick={() => setTimeframe(tf)} disabled={tf === timeframe}>{tf}</button>
        ))}
        <button onClick={() => ref.current?.getChart()?.setDrawingTool('fibRetracement')}>Fib</button>
      </nav>
      <div style={{ flex: 1 }}>
        <TradeCanvas ref={ref} symbol="BTCUSDT" timeframe={timeframe} indicators={['bb', 'rsi']} />
      </div>
    </div>
  );
}
`}})}function ce(){f({slug:"vue",title:"Vue 3",dependencies:{"@tradecanvas/chart":p,"@tradecanvas/vue":C,vue:"^3.5.0"},devDependencies:{"@vitejs/plugin-vue":"^5.2.0"},openFile:"src/App.vue",files:{"vite.config.ts":`import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({ plugins: [vue()] });
`,"index.html":u("TradeCanvas — Vue","/src/main.ts"),"src/main.ts":`import { createApp } from 'vue';
import App from './App.vue';

createApp(App).mount('#app');
`,"src/env.d.ts":`declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent;
  export default component;
}
`,"src/App.vue":`<script setup lang="ts">
import { ref } from 'vue';
import { TradeCanvas } from '@tradecanvas/vue';
import type { Chart, TimeFrame } from '@tradecanvas/chart';

const timeframes: TimeFrame[] = ['1m', '5m', '15m', '1h', '4h'];
const timeframe = ref<TimeFrame>('15m');
let chart: Chart | null = null;
<\/script>

<template>
  <div style="height: 100vh; display: flex; flex-direction: column">
    <nav style="display: flex; gap: 6px; padding: 8px">
      <button v-for="tf in timeframes" :key="tf" :disabled="tf === timeframe" @click="timeframe = tf">{{ tf }}</button>
      <button @click="chart?.setDrawingTool('fibRetracement')">Fib</button>
    </nav>
    <div style="flex: 1">
      <TradeCanvas symbol="BTCUSDT" :timeframe="timeframe" :indicators="['bb', 'rsi']" @ready="(c: Chart) => (chart = c)" />
    </div>
  </div>
</template>
`}})}function de(){f({slug:"svelte",title:"Svelte 5",dependencies:{"@tradecanvas/chart":p,"@tradecanvas/svelte":C,svelte:"^5.0.0"},devDependencies:{"@sveltejs/vite-plugin-svelte":"^5.0.0"},openFile:"src/App.svelte",files:{"vite.config.ts":`import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({ plugins: [svelte()] });
`,"index.html":u("TradeCanvas — Svelte","/src/main.ts"),"src/main.ts":`import { mount } from 'svelte';
import App from './App.svelte';

mount(App, { target: document.getElementById('app')! });
`,"src/App.svelte":`<script lang="ts">
  import { TradeCanvas } from '@tradecanvas/svelte';
  import type { Chart, TimeFrame } from '@tradecanvas/chart';

  const timeframes: TimeFrame[] = ['1m', '5m', '15m', '1h', '4h'];
  let timeframe = $state<TimeFrame>('15m');
  let chart = $state<Chart | null>(null);
<\/script>

<div style="height: 100vh; display: flex; flex-direction: column">
  <nav style="display: flex; gap: 6px; padding: 8px">
    {#each timeframes as tf}
      <button disabled={tf === timeframe} onclick={() => (timeframe = tf)}>{tf}</button>
    {/each}
    <button onclick={() => chart?.setDrawingTool('fibRetracement')}>Fib</button>
  </nav>
  <div style="flex: 1">
    <TradeCanvas symbol="BTCUSDT" {timeframe} indicators={['bb', 'rsi']} bind:chart />
  </div>
</div>
`}})}function le(){f({slug:"finance",title:"Finance Charts",dependencies:{"@tradecanvas/chart":p},openFile:"src/main.ts",files:{"index.html":u("TradeCanvas — Finance Charts","/src/main.ts",'<div class="grid"><div class="card"><div class="card-label">P&amp;L Attribution</div><div id="waterfall" class="chart"></div></div><div class="card"><div class="card-label">Fear &amp; Greed</div><div id="gauge" class="chart"></div></div></div>'," .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; padding: 16px; } .card { background: #161b23; border-radius: 8px; overflow: hidden; } .card-label { padding: 10px 16px; font: 600 11px sans-serif; color: #7d8696; text-transform: uppercase; letter-spacing: 0.06em; border-bottom: 1px solid #1f2630; } .chart { height: 320px; width: 100%; }"),"src/main.ts":`import { WaterfallChart, GaugeChart } from '@tradecanvas/chart';
import type { WaterfallBar } from '@tradecanvas/chart';

const waterfallData: WaterfallBar[] = [
  { label: 'Start', value: 10000, type: 'total' },
  { label: 'BTC Long', value: 1850 },
  { label: 'ETH Short', value: -620 },
  { label: 'SOL Long', value: 420 },
  { label: 'Fees', value: -85 },
  { label: 'End', value: 11565, type: 'total' },
];

new WaterfallChart(document.getElementById('waterfall')!, {
  data: waterfallData,
  showValues: true,
  connectorStyle: 'dashed',
  valueFormat: (v) => \`\${v < 0 ? '-' : ''}$\${Math.abs(v).toLocaleString()}\`,
  crosshair: true,
});

const gauge = new GaugeChart(document.getElementById('gauge')!, {
  value: 72,
  min: 0,
  max: 100,
  label: 'Fear & Greed',
  zones: [
    { from: 0, to: 25, color: '#e8505b', label: 'Extreme fear' },
    { from: 25, to: 45, color: '#f2a93b', label: 'Fear' },
    { from: 45, to: 55, color: '#8a93a3', label: 'Neutral' },
    { from: 55, to: 75, color: '#62c895', label: 'Greed' },
    { from: 75, to: 100, color: '#1fa874', label: 'Extreme greed' },
  ],
  animate: true,
});

setInterval(() => gauge.setValue(Math.round(30 + Math.random() * 60)), 3000);
`}})}export{oe as a,se as b,ce as c,de as d,le as e,ae as o};
