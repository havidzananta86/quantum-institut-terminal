var Is=Object.defineProperty;var Ps=(i,t,e)=>t in i?Is(i,t,{enumerable:!0,configurable:!0,writable:!0,value:e}):i[t]=e;var d=(i,t,e)=>Ps(i,typeof t!="symbol"?t+"":t,e);import{l as Ds,aV as Lt,i as oe,bu as St,q as he,O as vt,K as we,N as fe,bv as Je,bw as Ze,bx as Bs,by as zs,t as z,bd as gt,aR as Hn,az as pt,z as Os,bz as Fs,a8 as vr,a7 as yr,bA as Rs,bB as xr,bC as Oe,ab as $s,aX as Qe,bD as Hs,bE as Ws,bF as _s,bG as Us,bH as js,v as Vs,bo as Ks,bI as qs,bJ as Gs,bK as Ys,bL as Xs,bM as Js,bN as Zs,C as Qs,ad as ti,b2 as ei,b8 as zt,bO as kr,bp as Ot,bP as Fe,aO as ri,bQ as ni}from"./DzrvRgto.js";import{EN_MESSAGES as It}from"./ChxTx1mi.js";import{VI_MESSAGES as si}from"./ChIMm5zU.js";import{b as ii,m as Wn,I as Sr,M as ai,c as Er,D as oi,r as Cr,L as _n,l as Un,i as ci}from"./DYVTu5T-.js";import{a as Xl}from"./DYVTu5T-.js";import{L as Tr,D as ge}from"./LSw6eVC9.js";function Lr(i,t,e={}){if(i.length===0)return[];const r=e.weekStartsOn??1,n=[];let s=null,a=Number.NaN;for(const o of i){const c=Ds(o.time,t,r);s===null||c!==a?(s!==null&&n.push(s),s={time:c,open:o.open,high:o.high,low:o.low,close:o.close,volume:o.volume},a=c):s={time:s.time,open:s.open,high:Math.max(s.high,o.high),low:Math.min(s.low,o.low),close:o.close,volume:s.volume+o.volume}}return s!==null&&n.push(s),n}function be(i){if(i.length<2)return 0;const t=[];for(let e=1;e<i.length;e++){const r=i[e].time-i[e-1].time;r>0&&t.push(r)}return t.length===0?0:(t.sort((e,r)=>e-r),t[Math.floor(t.length/2)])}const li=[{zone:"Pacific/Honolulu",city:"Honolulu"},{zone:"America/Los_Angeles",city:"Los Angeles"},{zone:"America/Denver",city:"Denver"},{zone:"America/Chicago",city:"Chicago"},{zone:"America/New_York",city:"New York"},{zone:"America/Toronto",city:"Toronto"},{zone:"America/Sao_Paulo",city:"São Paulo"},{zone:"UTC",city:"UTC"},{zone:"Europe/London",city:"London"},{zone:"Europe/Berlin",city:"Frankfurt"},{zone:"Europe/Paris",city:"Paris"},{zone:"Europe/Zurich",city:"Zurich"},{zone:"Africa/Johannesburg",city:"Johannesburg"},{zone:"Europe/Istanbul",city:"Istanbul"},{zone:"Europe/Moscow",city:"Moscow"},{zone:"Asia/Dubai",city:"Dubai"},{zone:"Asia/Kolkata",city:"Mumbai"},{zone:"Asia/Bangkok",city:"Bangkok"},{zone:"Asia/Ho_Chi_Minh",city:"Ho Chi Minh City"},{zone:"Asia/Jakarta",city:"Jakarta"},{zone:"Asia/Singapore",city:"Singapore"},{zone:"Asia/Hong_Kong",city:"Hong Kong"},{zone:"Asia/Shanghai",city:"Shanghai"},{zone:"Asia/Taipei",city:"Taipei"},{zone:"Asia/Seoul",city:"Seoul"},{zone:"Asia/Tokyo",city:"Tokyo"},{zone:"Australia/Sydney",city:"Sydney"},{zone:"Pacific/Auckland",city:"Auckland"}];function Re(i){return!i||i==="local"?null:i==="exchange"?"exchange":/^-?\d+$/.test(i)?Number(i):oe(i)?i:null}function di(i){return i===null?"local":String(i)}function $e(i,t,e,r){const n=Lt(null,t),s=li.filter(({zone:c})=>oe(c)).map(({zone:c,city:l})=>{const h=Lt(c,t);return{value:c,label:c==="UTC"?"UTC":`(${St(h)}) ${l}`,offset:h}}),a=Re(i);typeof a=="number"&&s.push({value:i,label:St(a),offset:a}),s.sort((c,l)=>c.offset-l.offset);const o=[{value:"local",label:`${e} (${St(n)})`,offset:n}];if(r){const c=r.zone&&oe(r.zone)?r.zone:"UTC",l=Lt(c,t);o.push({value:"exchange",label:`${r.label} (${St(l)})`,offset:l})}return[...o,...s]}const Ft=6,Rt=8,Ar=120;function tr(i,t,e="left"){const r=i.style,n=t.getBoundingClientRect();r.position="fixed",r.margin="0",r.top=r.bottom=r.left=r.right="";const s=window.innerHeight-n.bottom-Ft-Rt,a=n.top-Ft-Rt;i.scrollHeight<=s||s>=a?(r.top=`${n.bottom+Ft}px`,r.bottom="auto",r.maxHeight=`${Math.max(Ar,s)}px`):(r.top="auto",r.bottom=`${window.innerHeight-n.top+Ft}px`,r.maxHeight=`${Math.max(Ar,a)}px`);const c=getComputedStyle(t).direction==="rtl",l=e==="right"!==c,h=i.offsetWidth,p=l?n.right-h:n.left;r.left=`${Math.max(Rt,Math.min(p,window.innerWidth-h-Rt))}px`}const Nr=700;class hi{constructor(t){d(this,"select",null);d(this,"panel",null);d(this,"rows",[]);d(this,"active",-1);d(this,"typed","");d(this,"typedAt",0);d(this,"onOutside",t=>{var r,n;const e=t.target;(r=this.panel)!=null&&r.contains(e)||(n=this.select)!=null&&n.contains(e)||this.close(!1)});d(this,"onAway",()=>this.close(!1));d(this,"onScroll",t=>{var e;t.target instanceof Node&&((e=this.panel)!=null&&e.contains(t.target))||this.close(!1)});d(this,"watch",new MutationObserver(()=>{this.select&&!this.select.isConnected&&this.close(!1)}));this.layer=t}isOpenFor(t){return this.select===t}owns(t){var e;return t!==null&&(t===this.select||((e=this.panel)==null?void 0:e.contains(t))===!0)}open(t){var s,a;this.close(!1),this.select=t;const e=document.createElement("div");e.className="tcw-dropdown tcw-select-menu",e.setAttribute("role","listbox"),e.id=`tcw-select-menu-${Math.random().toString(36).slice(2,9)}`;const r=t.getAttribute("aria-label")??((a=(s=t.labels)==null?void 0:s[0])==null?void 0:a.textContent)??"";r&&e.setAttribute("aria-label",r.trim()),e.style.minWidth=`${t.getBoundingClientRect().width}px`,this.rows=[];for(const o of t.children)if(o instanceof HTMLOptGroupElement){const c=document.createElement("div");c.className="tcw-select-group",c.textContent=o.label,e.appendChild(c);for(const l of o.querySelectorAll("option"))this.addRow(e,l,o.disabled)}else o instanceof HTMLOptionElement&&this.addRow(e,o,!1);e.addEventListener("mousedown",o=>o.preventDefault());const n=o=>this.rows.findIndex(c=>c.el.contains(o.target));e.addEventListener("click",o=>{const c=n(o);c>=0&&this.pick(c)}),e.addEventListener("mousemove",o=>{const c=n(o);c>=0&&c!==this.active&&this.enabled(c)&&this.setActive(c,!1)}),this.layer().appendChild(e),this.panel=e,tr(e,t),t.setAttribute("aria-expanded","true"),t.setAttribute("aria-controls",e.id),this.setActive(this.rows.findIndex(o=>o.option.selected)),document.addEventListener("pointerdown",this.onOutside,!0),window.addEventListener("resize",this.onAway),document.addEventListener("scroll",this.onScroll,{capture:!0,passive:!0}),this.watch.observe(document.documentElement,{childList:!0,subtree:!0})}close(t){var r;const e=this.select;e&&(document.removeEventListener("pointerdown",this.onOutside,!0),window.removeEventListener("resize",this.onAway),document.removeEventListener("scroll",this.onScroll,{capture:!0}),this.watch.disconnect(),(r=this.panel)==null||r.remove(),this.panel=null,this.rows=[],this.select=null,e.setAttribute("aria-expanded","false"),e.removeAttribute("aria-controls"),e.removeAttribute("aria-activedescendant"),t&&e.isConnected&&e.focus())}key(t){if(!this.select)return!1;switch(t.key){case"ArrowDown":return this.step(1),!0;case"ArrowUp":return this.step(-1),!0;case"Home":return this.setActive(this.nextEnabled(-1,1)),!0;case"End":return this.setActive(this.nextEnabled(this.rows.length,-1)),!0;case"PageDown":return this.step(8),!0;case"PageUp":return this.step(-8),!0;case" ":return this.typed&&Date.now()-this.typedAt<=Nr?(this.typeahead(" "),!0):(this.active>=0?this.pick(this.active):this.close(!0),!0);case"Enter":return this.active>=0?this.pick(this.active):this.close(!0),!0;case"Escape":return this.close(!0),!0;case"Tab":return this.close(!1),!1;default:return t.key.length===1&&!t.ctrlKey&&!t.metaKey&&!t.altKey?(this.typeahead(t.key),!0):!1}}destroy(){this.close(!1)}addRow(t,e,r){const n=document.createElement("div");n.className="tcw-select-option",n.id=`${t.id}-${this.rows.length}`,n.setAttribute("role","option"),n.setAttribute("aria-selected",String(e.selected)),(e.disabled||r)&&n.setAttribute("aria-disabled","true");const s=document.createElement("span");s.className="tcw-select-option-text",s.textContent=e.label||e.textContent||"";const a=document.createElement("span");a.className="tcw-select-check",a.setAttribute("aria-hidden","true"),n.append(a,s),t.appendChild(n),this.rows.push({option:e,el:n})}enabled(t){var e;return((e=this.rows[t])==null?void 0:e.el.getAttribute("aria-disabled"))!=="true"}nextEnabled(t,e){for(let r=t+e;r>=0&&r<this.rows.length;r+=e)if(this.enabled(r))return r;return-1}step(t){const e=t>0?1:-1;let r=this.active;for(let n=0;n<Math.abs(t);n++){const s=this.nextEnabled(r,e);if(s<0)break;r=s}r>=0&&this.setActive(r)}setActive(t,e=!0){var n,s,a,o;(n=this.rows[this.active])==null||n.el.classList.remove("tcw-active"),this.active=t;const r=this.rows[t];r&&(r.el.classList.add("tcw-active"),(s=this.select)==null||s.setAttribute("aria-activedescendant",r.el.id),e&&((o=(a=r.el).scrollIntoView)==null||o.call(a,{block:"nearest"})))}typeahead(t){const e=Date.now();this.typed=e-this.typedAt>Nr?t.toLowerCase():this.typed+t.toLowerCase(),this.typedAt=e;const r=s=>this.enabled(s)&&(this.rows[s].el.textContent??"").trim().toLowerCase().startsWith(this.typed),n=this.typed.length===1?this.active+1:Math.max(0,this.active);for(let s=0;s<this.rows.length;s++){const a=(n+s)%this.rows.length;if(r(a)){this.setActive(a);return}}}pick(t){const e=this.select,r=this.rows[t];if(!e||!r||!this.enabled(t))return;const n=!r.option.selected;r.option.selected=!0,this.close(!0),n&&(e.dispatchEvent(new Event("input",{bubbles:!0})),e.dispatchEvent(new Event("change",{bubbles:!0})))}}const ui=42,st=7,pi=new Set(["US","CA","MX","BR","JP","KR","TW","HK","IL","PH","IN","ZA","AU","TH","SA","PE","CO"]);function Mr(i){var t;try{const e=new Intl.Locale(i),r=((t=e.getWeekInfo)==null?void 0:t.call(e))??e.weekInfo;return r?r.firstDay===7?0:1:pi.has(e.maximize().region??"")?0:1}catch{return 1}}function mi(i,t,e){const n=(new Date(Date.UTC(i,t,1)).getUTCDay()-e+st)%st,s=[];for(let a=0;a<ui;a++){const o=new Date(Date.UTC(i,t,1-n+a));s.push({year:o.getUTCFullYear(),month:o.getUTCMonth(),day:o.getUTCDate()})}return s}const Ir=i=>String(i).padStart(2,"0"),J=i=>`${String(i.year).padStart(4,"0")}-${Ir(i.month+1)}-${Ir(i.day)}`;function ve(i){const t=/^(\d{4})-(\d{2})-(\d{2})$/.exec(i);return t?{year:Number(t[1]),month:Number(t[2])-1,day:Number(t[3])}:null}function $t(){const i=new Date;return{year:i.getFullYear(),month:i.getMonth(),day:i.getDate()}}function wi(i,t){const e=new Date(Date.UTC(i.year,i.month,i.day+t));return{year:e.getUTCFullYear(),month:e.getUTCMonth(),day:e.getUTCDate()}}class fi{constructor(t,e,r){d(this,"input",null);d(this,"panel",null);d(this,"grid",null);d(this,"titleEl",null);d(this,"view",{year:0,month:0});d(this,"focusDay",$t());d(this,"onOutside",t=>{var r,n;const e=t.target;(r=this.panel)!=null&&r.contains(e)||(n=this.input)!=null&&n.contains(e)||this.close(!1)});d(this,"onAway",()=>this.close(!1));d(this,"onScroll",t=>{var e;t.target instanceof Node&&((e=this.panel)!=null&&e.contains(t.target))||this.close(!1)});d(this,"watch",new MutationObserver(()=>{this.input&&!this.input.isConnected&&this.close(!1)}));this.layer=t,this.labels=e,this.locale=r}isOpenFor(t){return this.input===t}owns(t){var e;return t!==null&&(t===this.input||((e=this.panel)==null?void 0:e.contains(t))===!0)}open(t){var y,L;this.close(!1),this.input=t;const e=this.clamp(ve(t.value)??$t());this.focusDay=e,this.view={year:e.year,month:e.month};const r=this.labels(),n=document.createElement("div");n.className="tcw-calendar",n.setAttribute("role","dialog");const s=t.getAttribute("aria-label")??((L=(y=t.labels)==null?void 0:y[0])==null?void 0:L.textContent)??"";s&&n.setAttribute("aria-label",s.trim());const a=document.createElement("div");a.className="tcw-calendar-head";const o=this.navButton(r.prevMonth,-1),c=this.navButton(r.nextMonth,1),l=document.createElement("div");l.className="tcw-calendar-title",l.setAttribute("aria-live","polite"),a.append(o,l,c);const h=document.createElement("div");h.className="tcw-calendar-weekdays",h.setAttribute("aria-hidden","true");const p=Mr(this.locale()),m=new Intl.DateTimeFormat(this.locale(),{weekday:"narrow",timeZone:"UTC"});for(let C=0;C<st;C++){const E=document.createElement("span");E.className="tcw-calendar-weekday",E.textContent=m.format(new Date(Date.UTC(2023,0,1+(p+C)%st))),h.appendChild(E)}const f=document.createElement("div");f.className="tcw-calendar-grid",f.setAttribute("role","grid"),f.addEventListener("keydown",C=>this.onKey(C)),f.addEventListener("click",C=>{const E=C.target.closest(".tcw-calendar-day");E&&!E.disabled&&E.dataset.date&&this.pick(E.dataset.date)});const g=document.createElement("div");g.className="tcw-calendar-foot";const v=document.createElement("button");v.type="button",v.className="tcw-calendar-today",v.textContent=r.today,v.addEventListener("click",()=>{const C=J($t());this.allowed(C)&&this.pick(C)}),g.appendChild(v),n.append(a,h,f,g),n.addEventListener("mousedown",C=>{C.target.closest("button")||C.preventDefault()}),n.addEventListener("keydown",C=>{C.stopPropagation(),C.key==="Escape"&&(C.preventDefault(),this.close(!0))}),this.panel=n,this.grid=f,this.titleEl=l,this.render(),this.layer().appendChild(n),tr(n,t),document.addEventListener("pointerdown",this.onOutside,!0),window.addEventListener("resize",this.onAway),document.addEventListener("scroll",this.onScroll,{capture:!0,passive:!0}),this.watch.observe(document.documentElement,{childList:!0,subtree:!0})}close(t){var r;const e=this.input;e&&(document.removeEventListener("pointerdown",this.onOutside,!0),window.removeEventListener("resize",this.onAway),document.removeEventListener("scroll",this.onScroll,{capture:!0}),this.watch.disconnect(),(r=this.panel)==null||r.remove(),this.panel=this.grid=this.titleEl=null,this.input=null,t&&e.isConnected&&e.focus())}focusGrid(){var t,e;(e=(t=this.grid)==null?void 0:t.querySelector('[tabindex="0"]'))==null||e.focus()}destroy(){this.close(!1)}navButton(t,e){const r=document.createElement("button");return r.type="button",r.className="tcw-calendar-nav",r.setAttribute("aria-label",t),r.innerHTML=e<0?'<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3.5L5.5 8l4.5 4.5"/></svg>':'<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3.5L10.5 8 6 12.5"/></svg>',r.addEventListener("click",()=>this.turn(e)),r}turn(t){const e=new Date(Date.UTC(this.view.year,this.view.month+t,1));this.view={year:e.getUTCFullYear(),month:e.getUTCMonth()};const r=new Date(Date.UTC(this.view.year,this.view.month+1,0)).getUTCDate();this.focusDay=this.clamp({...this.view,day:Math.min(this.focusDay.day,r)}),this.view={year:this.focusDay.year,month:this.focusDay.month},this.render()}clamp(t){var s,a;const e=J(t),r=(s=this.input)!=null&&s.min?ve(this.input.min):null,n=(a=this.input)!=null&&a.max?ve(this.input.max):null;return r&&e<J(r)?r:n&&e>J(n)?n:t}allowed(t){const e=this.input;return e?!(e.min&&t<e.min)&&!(e.max&&t>e.max):!1}render(){const t=this.grid,e=this.input;if(!t||!e||!this.titleEl)return;const r=this.locale();this.titleEl.textContent=new Intl.DateTimeFormat(r,{month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(Date.UTC(this.view.year,this.view.month,1)));const n=e.value,s=J($t()),a=J(this.focusDay),o=new Intl.DateTimeFormat(r,{dateStyle:"full",timeZone:"UTC"});t.textContent="";let c=null;for(const[l,h]of mi(this.view.year,this.view.month,Mr(r)).entries()){l%st===0&&(c=document.createElement("div"),c.className="tcw-calendar-week",c.setAttribute("role","row"),t.appendChild(c));const p=J(h),m=document.createElement("button");m.type="button",m.className="tcw-calendar-day",m.dataset.date=p,m.setAttribute("role","gridcell"),m.textContent=String(h.day),m.setAttribute("aria-label",o.format(new Date(Date.UTC(h.year,h.month,h.day)))),m.setAttribute("aria-selected",String(p===n)),m.tabIndex=p===a?0:-1,h.month!==this.view.month&&m.classList.add("tcw-outside"),p===s&&m.classList.add("tcw-today"),this.allowed(p)||(m.disabled=!0),c==null||c.appendChild(m)}}onKey(t){const e={ArrowLeft:-1,ArrowRight:1,ArrowUp:-st,ArrowDown:st},r=this.panel?getComputedStyle(this.panel).direction==="rtl":!1;if(t.key in e){const n=r&&(t.key==="ArrowLeft"||t.key==="ArrowRight")?-e[t.key]:e[t.key];this.moveFocus(wi(this.focusDay,n))}else if(t.key==="PageUp"||t.key==="PageDown")this.turn(t.key==="PageUp"?-1:1),this.focusGrid();else if(t.key==="Home"||t.key==="End"){const n=new Date(Date.UTC(this.view.year,this.view.month+1,0)).getUTCDate();this.moveFocus({...this.view,day:t.key==="Home"?1:n})}else if(t.key==="Enter"||t.key===" "){const n=J(this.focusDay);this.allowed(n)&&this.pick(n)}else return;t.preventDefault()}moveFocus(t){const e=this.clamp(t);this.focusDay=e,(e.year!==this.view.year||e.month!==this.view.month)&&(this.view={year:e.year,month:e.month}),this.render(),this.focusGrid()}pick(t){const e=this.input;if(!e||!this.allowed(t))return;const r=e.value!==t;e.value=t,this.close(!0),r&&(e.dispatchEvent(new Event("input",{bubbles:!0})),e.dispatchEvent(new Event("change",{bubbles:!0})))}}const gi=()=>typeof matchMedia=="function"&&matchMedia("(pointer: coarse)").matches,bi=()=>typeof CSS>"u"||typeof CSS.supports!="function"||CSS.supports("selector(::-webkit-calendar-picker-indicator)");function Pr(i){if(!(i instanceof Element))return null;const t=i.closest("select");return!t||t.matches(":disabled")||t.multiple||t.size>1?null:t}function Dr(i){return!(i instanceof HTMLInputElement)||i.type!=="date"||i.matches(":disabled")||i.readOnly?null:i}function vi(i,t){const e=new hi(t.layer),r=new fi(t.layer,t.labels,t.locale),n=t.native??gi,s=t.calendar??bi,a=new WeakSet,o=m=>a.has(m)?!1:(a.add(m),!0),c=m=>{if(m.button!==0||n()||!o(m))return;const f=Pr(m.target);if(f){if(m.preventDefault(),e.isOpenFor(f)){e.close(!0);return}f.focus(),e.open(f)}},l=m=>{if(n()||!s()||!o(m))return;const f=Dr(m.target);f&&(m.preventDefault(),r.isOpenFor(f)||r.open(f))},h=m=>{if(n()||!o(m))return;const f=Pr(m.target);if(f){if(e.isOpenFor(f)){e.key(m)&&(m.preventDefault(),m.stopPropagation());return}(m.key==="Enter"||m.key===" "||m.altKey&&(m.key==="ArrowDown"||m.key==="ArrowUp")||m.key==="F4")&&(m.preventDefault(),m.stopPropagation(),e.open(f));return}const g=Dr(m.target);!g||!s()||(m.key==="Escape"&&r.isOpenFor(g)?(m.preventDefault(),m.stopPropagation(),r.close(!0)):(m.altKey&&m.key==="ArrowDown"||m.key==="F4")&&(m.preventDefault(),r.isOpenFor(g)||r.open(g),r.focusGrid()))},p=m=>{if(!o(m))return;const f=m.target instanceof Node?m.target:null,g=m.relatedTarget instanceof Node?m.relatedTarget:null;e.owns(f)&&!e.owns(g)&&e.close(!1),r.owns(f)&&!r.owns(g)&&r.close(!1)};for(const m of i)m.addEventListener("mousedown",c,!0),m.addEventListener("click",l,!0),m.addEventListener("keydown",h,!0),m.addEventListener("focusout",p,!0);return()=>{for(const m of i)m.removeEventListener("mousedown",c,!0),m.removeEventListener("click",l,!0),m.removeEventListener("keydown",h,!0),m.removeEventListener("focusout",p,!0);e.destroy(),r.destroy()}}const re=[{label:"Candlestick",value:"candlestick"},{label:"Line",value:"line"},{label:"Area",value:"area"},{label:"Bar",value:"bar"},{label:"Heikin-Ashi",value:"heikinAshi"},{label:"Hollow Candle",value:"hollowCandle"},{label:"Baseline",value:"baseline"},{label:"Volume Candles",value:"volumeCandles"},{label:"Equivolume",value:"equivolume"},{label:"HLC Area",value:"hlcArea"},{label:"Step Line",value:"stepLine"},{label:"Line + Markers",value:"lineWithMarkers"},{label:"High-Low",value:"hiLo"},{label:"Renko",value:"renko"},{label:"Line Break",value:"lineBreak"},{label:"Kagi",value:"kagi"},{label:"Point & Figure",value:"pointAndFigure"},{label:"Range Bars",value:"rangeBars"}],Br=[{label:"Lines",section:"lines",tools:[{label:"Trend Line",value:"trendLine"},{label:"Ray",value:"ray"},{label:"Extended Line",value:"extendedLine"},{label:"Info Line",value:"infoLine"},{label:"Trend Angle",value:"trendAngle"}]},{label:"Horizontal/Vertical",section:"lines",tools:[{label:"Horizontal Line",value:"horizontalLine"},{label:"Horizontal Ray",value:"horizontalRay"},{label:"Vertical Line",value:"verticalLine"},{label:"Cross Line",value:"crossLine"}]},{label:"Channels",section:"lines",tools:[{label:"Parallel Channel",value:"parallelChannel"},{label:"Regression Channel",value:"regressionChannel"}]},{label:"Fibonacci",section:"fibonacci",tools:[{label:"Fib Retracement",value:"fibRetracement"},{label:"Fib Extension",value:"fibExtension"},{label:"Fib Channel",value:"fibChannel"},{label:"Fib Time Zones",value:"fibTimeZones"},{label:"Fib Speed Resistance Fan",value:"fibSpeedResistanceFan"},{label:"Fib Speed Resistance Arcs",value:"fibArcs"},{label:"Fib Circles",value:"fibCircles"},{label:"Fib Spiral",value:"fibSpiral"},{label:"Fib Wedge",value:"fibWedge"}]},{label:"Gann & Pitchforks",section:"fibonacci",tools:[{label:"Pitchfork",value:"pitchfork"},{label:"Schiff Pitchfork",value:"schiffPitchfork"},{label:"Modified Schiff Pitchfork",value:"modifiedSchiffPitchfork"},{label:"Gann Fan",value:"gannFan"},{label:"Gann Box",value:"gannBox"},{label:"Gann Square",value:"gannSquare"},{label:"Pitchfan",value:"pitchfan"}]},{label:"Cycles",section:"fibonacci",tools:[{label:"Cyclic Lines",value:"cyclicLines"},{label:"Time Cycles",value:"timeCycles"},{label:"Sine Line",value:"sineLine"}]},{label:"Patterns",section:"patterns",tools:[{label:"XABCD Pattern",value:"xabcdPattern"},{label:"ABCD Pattern",value:"abcdPattern"},{label:"Head and Shoulders",value:"headAndShoulders"},{label:"Cypher Pattern",value:"cypherPattern"},{label:"Three Drives Pattern",value:"threeDrives"}]},{label:"Elliott Waves",section:"patterns",tools:[{label:"Elliott Wave",value:"elliottWave"},{label:"Elliott Impulse Wave",value:"elliottImpulse"},{label:"Elliott Correction Wave",value:"elliottCorrection"},{label:"Elliott Triangle Wave",value:"elliottTriangle"},{label:"Elliott Double Combo Wave",value:"elliottDoubleCombo"},{label:"Elliott Triple Combo Wave",value:"elliottTripleCombo"}]},{label:"Forecasting",section:"forecasting",tools:[{label:"Long/Short Position",value:"riskReward"},{label:"Anchored VWAP",value:"anchoredVWAP"},{label:"Fixed Range Volume Profile",value:"volumeProfileRange"},{label:"Forecast",value:"forecast"},{label:"Projection",value:"projection"},{label:"Bars Pattern",value:"barsPattern"}]},{label:"Measure",section:"forecasting",tools:[{label:"Price Range",value:"priceRange"},{label:"Date Range",value:"dateRange"},{label:"Date and Price Range",value:"dateAndPriceRange"},{label:"Measure",value:"measure"}]},{label:"Shapes",section:"annotation",tools:[{label:"Rectangle",value:"rectangle"},{label:"Circle",value:"circle"},{label:"Ellipse",value:"ellipse"},{label:"Triangle",value:"triangle"},{label:"Polyline",value:"polyline"},{label:"Curve",value:"curve"},{label:"Arc",value:"arc"}]},{label:"Brushes",section:"annotation",tools:[{label:"Brush",value:"brush"},{label:"Highlighter",value:"highlighter"},{label:"Path",value:"path"}]},{label:"Annotation",section:"annotation",tools:[{label:"Text",value:"text"},{label:"Price Label",value:"priceLabel"},{label:"Arrow",value:"arrow"},{label:"Note",value:"note"},{label:"Callout",value:"callout"},{label:"Flag Mark",value:"flag"},{label:"Arrow Mark",value:"arrowMark"},{label:"Icon",value:"icon"}]}],yi=["BTCUSDT","ETHUSDT","SOLUSDT","BNBUSDT"],jn={gridVisible:!0,volumeVisible:!0,volumeProfileVisible:!1,marketProfileVisible:!1,marketProfileSplit:!1,marketProfileLetters:!1,marketProfileBuckets:48,marketProfileOpacity:.32,depthHeatmapVisible:!1,depthHeatmapOpacity:.7,sessionShadingVisible:!1,pivotMarkersVisible:!1,pivotStrength:5,pivotStructureLabels:!1,periodLevelsVisible:!1,periodLevelsPeriod:"day",legendVisible:!0,barCountdown:!0,indicatorValueLabels:!1,logScale:!1,scaleMode:"regular",autoScale:!0,invertScale:!1,leftPriceScale:!1,crosshairMode:"magnet",numberLocale:"en-US",timezone:"local",highLowLines:!1,mainSeriesVisible:!0,extendedHours:!0,chartTypeOptions:{}},N=(i,...t)=>({label:i,keys:t}),P=(i,t,e={})=>({label:i,keys:[t],auto:e}),H=i=>({hint:i}),Vn={from:"panes.titleColor"},Kn={title:"settings.section.lastPrice",rows:[N("settings.priceLine","lastPrice.visible"),N("settings.up","lastPrice.upColor"),N("settings.down","lastPrice.downColor"),N("drawingSettings.lineStyle","lastPrice.style"),N("drawingSettings.lineWidth","lastPrice.width")]},qn={title:"settings.volume",rows:[N("settings.up","volume.upColor"),N("settings.down","volume.downColor")]},Gn={title:"settings.highLowLines",rows:[P("drawingSettings.color","highLow.color",Vn)]},xi=[Kn,qn,Gn],Yn=[N("settings.legendText","legend.textColor"),N("settings.legendLabels","legend.labelColor"),N("settings.paneTitles","panes.titleColor")],Xn=[N("drawingSettings.text","axis.price.textColor","axis.time.textColor"),N("settings.scaleLines","axis.price.lineColor","axis.time.lineColor")],Jn=[{title:"settings.section.background",rows:[N("settings.background","background.color"),N("settings.paneBackground","panes.background"),N("settings.paneSeparator","panes.separatorColor"),P("settings.watermark","watermark.color",Vn)]},{title:"settings.gridLines",rows:[N("settings.horizontal","grid.horizontal.visible"),N("settings.vertical","grid.vertical.visible"),N("drawingSettings.color","grid.horizontal.color","grid.vertical.color"),N("drawingSettings.lineStyle","grid.horizontal.style","grid.vertical.style"),N("drawingSettings.lineWidth","grid.horizontal.width","grid.vertical.width")]},{title:"settings.crosshairMode",rows:[N("settings.horizontal","crosshair.horizontal.visible"),N("settings.vertical","crosshair.vertical.visible"),N("drawingSettings.color","crosshair.horizontal.color","crosshair.vertical.color"),N("drawingSettings.lineStyle","crosshair.horizontal.style","crosshair.vertical.style"),N("drawingSettings.lineWidth","crosshair.horizontal.width","crosshair.vertical.width"),N("settings.labelBackground","crosshair.labelBackground"),N("settings.labelText","crosshair.labelTextColor")]},{title:"settings.sessionBreaks",rows:[P("drawingSettings.color","sessionBreaks.color",{from:"axis.price.lineColor"}),P("drawingSettings.lineStyle","sessionBreaks.style"),P("drawingSettings.lineWidth","sessionBreaks.width")]},{title:"objects.drawings",rows:[P("settings.handles","drawings.handleColor",H("#ffffff"))]}];var zn,On,Fn,Rn,$n;const Zn=[{title:"settings.section.orders",trading:!0,rows:[P("ticket.buy","trading.buyColor",H((zn=vt.orderColors)==null?void 0:zn.buy)),P("ticket.sell","trading.sellColor",H((On=vt.orderColors)==null?void 0:On.sell)),P("settings.profit","trading.profitColor",H((Fn=vt.positionColors)==null?void 0:Fn.profit)),P("settings.loss","trading.lossColor",H((Rn=vt.positionColors)==null?void 0:Rn.loss)),P("account.entry","trading.entryColor",H(($n=vt.positionColors)==null?void 0:$n.entry))]},{title:"settings.section.signals",rows:[P("account.long","markers.longColor",H(we.longColor)),P("account.short","markers.shortColor",H(we.shortColor)),P("markers.neutral","markers.neutralColor",H(we.neutralColor))]},{title:"settings.section.tradeZones",rows:[P("settings.profit","tradeZones.profitColor",H(fe.profitColor)),P("settings.loss","tradeZones.lossColor",H(fe.lossColor)),P("settings.openTrade","tradeZones.activeColor",H(fe.activeColor))]}],ki={upColor:"settings.up",downColor:"settings.down",wickUpColor:"settings.upWick",wickDownColor:"settings.downWick",color:"drawingSettings.color",lineColor:"drawingSettings.color",lineWidth:"drawingSettings.lineWidth",topColor:"settings.areaTop",bottomColor:"settings.areaBottom"},zr=new Set(["candlestick","heikinAshi","volumeCandles","equivolume"]);function Si(i){const t=`series.${i}.`;return Object.keys(he).filter(e=>e.startsWith(t)).map(e=>{const r=e.slice(t.length);let n=ki[r]??"drawingSettings.color";return zr.has(i)&&r==="upColor"&&(n="settings.upBody"),zr.has(i)&&r==="downColor"&&(n="settings.downBody"),i==="baseline"&&r==="upColor"&&(n="settings.aboveBase"),i==="baseline"&&r==="downColor"&&(n="settings.belowBase"),N(n,e)})}const it=[...new Set([...Object.keys(he).filter(i=>i.startsWith("series.")),...[...xi,...Jn,...Zn].flatMap(i=>i.rows.flatMap(t=>t.keys)),...[...Yn,...Xn].flatMap(i=>i.keys)])],Ei=`/* === TradeCanvas Widget — Premium Styles === */\r
\r
/*\r
 * The HTML \`hidden\` attribute only sets \`display: none\` via the UA stylesheet,\r
 * which any author \`display\` rule (e.g. \`.tcw-alerts-panel { display: flex }\`)\r
 * silently overrides — leaving panels stuck open when JS sets \`el.hidden = true\`.\r
 * Force \`hidden\` to win for every namespaced widget element. Scoped to \`tcw-\`\r
 * so it never touches the host page.\r
 */\r
[class^="tcw-"][hidden],\r
[class*=" tcw-"][hidden] {\r
  display: none !important;\r
}\r
\r
/* Control tooltips (WidgetTooltip): quick to appear, slide in from the control. */\r
.tcw-tooltip {\r
  position: absolute;\r
  top: 0;\r
  left: 0;\r
  z-index: 60;\r
  max-width: 240px;\r
  padding: var(--tcw-space-3) var(--tcw-space-4);\r
  border-radius: var(--tcw-tooltip-radius);\r
  background: var(--tcw-tooltip-bg);\r
  color: var(--tcw-tooltip-fg);\r
  box-shadow: var(--tcw-tooltip-shadow);\r
  width: max-content;\r
  font-size: var(--tcw-font-size-sm);\r
  font-weight: var(--tcw-weight);\r
  line-height: 1.35;\r
  overflow-wrap: anywhere;\r
  pointer-events: none;\r
  opacity: 0;\r
  visibility: hidden;\r
  transform: translate(var(--tcw-tip-dx, 0), var(--tcw-tip-dy, 0));\r
  transition:\r
    opacity 110ms var(--tcw-ease-out),\r
    transform 110ms var(--tcw-ease-out),\r
    visibility 0s linear 110ms;\r
}\r
\r
.tcw-tooltip--visible {\r
  opacity: 1;\r
  visibility: visible;\r
  transform: none;\r
  transition:\r
    opacity 110ms var(--tcw-ease-out),\r
    transform 110ms var(--tcw-ease-out),\r
    visibility 0s;\r
}\r
\r
/* The modal portal: carries the tokens and fonts, but no box of its own. */\r
.tcw-root.tcw-portal {\r
  display: contents;\r
}\r
\r
/* Fullscreen: the root fills the screen; the chart resizes with it. */\r
.tcw-root:fullscreen {\r
  width: 100vw;\r
  height: 100vh;\r
  height: 100dvh;\r
}\r
\r
.tcw-root {\r
  display: flex;\r
  flex-direction: column;\r
  width: 100%;\r
  height: 100%;\r
  font-family: var(--tcw-font);\r
  font-feature-settings: 'cv11', 'ss01', 'ss03';\r
  font-size: var(--tcw-font-size);\r
  line-height: 1.4;\r
  color: #e6e3dc;\r
  background: #131416;\r
  font-variant-numeric: tabular-nums;\r
  position: relative;\r
  overflow: hidden;\r
  -webkit-font-smoothing: antialiased;\r
  -moz-osx-font-smoothing: grayscale;\r
\r
  /* --- Dark theme tokens (default) ---\r
   * Print at night: warm ink on an off-black, never pure white on black, so\r
   * text doesn't glare. Grey for everything that is normal; colour only where\r
   * it means something. */\r
  --tcw-bg: #131416;\r
  --tcw-bg-surface: #131416;\r
  --tcw-bg-elevated: #1b1c1f;\r
  --tcw-bg-overlay: rgba(19, 20, 22, 0.6);\r
  --tcw-border: #2a2b2f;\r
  --tcw-border-strong: #3a3b40;\r
  /* Tooltips are the ink turned over: light on the dark ground. */\r
  --tcw-tooltip-bg: #e6e3dc;\r
  --tcw-tooltip-fg: #131416;\r
  --tcw-text: #e6e3dc;\r
  --tcw-text-dim: #a9a6a0;\r
  --tcw-text-muted: #8c8a85;\r
\r
  /* Ink blue: links, focus and what you picked. --tcw-accent-ink is the text colour on an accent fill. */\r
  --tcw-accent: #7d9bff;\r
  --tcw-accent-hover: #98b0ff;\r
  --tcw-accent-ink: #131416;\r
  --tcw-accent-soft: rgba(125, 155, 255, 0.14);\r
  --tcw-accent-glow: rgba(125, 155, 255, 0.22);\r
  --tcw-accent-line: rgba(125, 155, 255, 0.55);\r
\r
  --tcw-red: #e2706b;\r
  --tcw-red-soft: rgba(226, 112, 107, 0.12);\r
  --tcw-green: #4fae8a;\r
  --tcw-green-soft: rgba(79, 174, 138, 0.12);\r
\r
  --tcw-hover-bg: rgba(230, 227, 220, 0.06);\r
  --tcw-active-bg: rgba(230, 227, 220, 0.1);\r
  --tcw-divider: rgba(230, 227, 220, 0.07);\r
\r
  /* Motion */\r
  --tcw-ease: cubic-bezier(0.2, 0, 0, 1);\r
  --tcw-ease-out: cubic-bezier(0.16, 1, 0.3, 1);\r
  --tcw-dur-fast: 120ms;\r
  --tcw-dur-normal: 180ms;\r
  --tcw-dur-slow: 260ms;\r
\r
  /* Spacing: Fibonacci numbers, so each step is near φ times the one before. */\r
  --tcw-space-1: 2px;\r
  --tcw-space-2: 3px;\r
  --tcw-space-3: 5px;\r
  --tcw-space-4: 8px;\r
  --tcw-space-5: 13px;\r
  --tcw-space-6: 21px;\r
  --tcw-space-7: 34px;\r
\r
  /* The look (UI system): Print's values. The \`ui\` option sets them inline. */\r
  --tcw-radius-xs: 1px;\r
  --tcw-radius-sm: 2px;\r
  --tcw-radius: 3px;\r
  --tcw-radius-lg: 5px;\r
  --tcw-radius-xl: 8px;\r
  --tcw-control-radius: var(--tcw-radius);\r
  --tcw-input-radius: var(--tcw-radius);\r
  --tcw-menu-radius: var(--tcw-radius-lg);\r
  --tcw-dialog-radius: var(--tcw-radius-xl);\r
  --tcw-panel-radius: var(--tcw-radius-lg);\r
  --tcw-tooltip-radius: var(--tcw-radius-sm);\r
  --tcw-tag-radius: var(--tcw-radius-sm);\r
  --tcw-toast-radius: var(--tcw-radius-lg);\r
  --tcw-toolbar-radius: 0px;\r
  --tcw-sidebar-radius: 0px;\r
  --tcw-toolbar-h: 42px;\r
  --tcw-control-h: 26px;\r
  --tcw-control-h-sm: 20px;\r
  --tcw-icon: 16px;\r
  --tcw-sidebar-w: 42px;\r
  --tcw-menu-item-h: 33px;\r
  --tcw-font: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;\r
  --tcw-font-size: 13px;\r
  --tcw-font-size-sm: 11px;\r
  --tcw-font-size-xs: 10px;\r
  --tcw-font-size-lg: 15px;\r
  --tcw-font-size-xl: 18px;\r
  --tcw-font-size-display: 21px;\r
  --tcw-weight: 400;\r
  --tcw-weight-strong: 600;\r
  --tcw-label-case: uppercase;\r
  --tcw-label-tracking: 0.06em;\r
  --tcw-border-w: 1px;\r
  --tcw-sep-w: 1px;\r
  --tcw-menu-shadow: 0 0 0 1px var(--tcw-border), var(--tcw-shadow-md);\r
  --tcw-dialog-shadow: 0 0 0 1px var(--tcw-border), var(--tcw-shadow-lg);\r
  --tcw-tooltip-shadow: var(--tcw-shadow-sm);\r
  --tcw-blur: 0px;\r
  --tcw-surface-opacity: 100%;\r
\r
  /* Elevation */\r
  --tcw-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);\r
  --tcw-shadow-md: 0 4px 12px rgba(0, 0, 0, 0.35), 0 1px 3px rgba(0, 0, 0, 0.2);\r
  --tcw-shadow-lg: 0 12px 36px rgba(0, 0, 0, 0.5), 0 4px 12px rgba(0, 0, 0, 0.3);\r
  --tcw-shadow-xl: 0 24px 64px rgba(0, 0, 0, 0.55), 0 12px 24px rgba(0, 0, 0, 0.35);\r
  --tcw-ring: 0 0 0 2px rgba(125, 155, 255, 0.5);\r
\r
  /* Type */\r
  --tcw-font-mono: 'Cascadia Mono', 'SF Mono', ui-monospace, Menlo, Consolas, monospace;\r
}\r
\r
/* Print by day: ink on paper. */\r
.tcw-root[data-tcw-theme='light'] {\r
  color: #1b1d21;\r
  background: #fbfaf6;\r
\r
  --tcw-bg: #fbfaf6;\r
  --tcw-bg-surface: #fbfaf6;\r
  --tcw-bg-elevated: #ffffff;\r
  --tcw-bg-overlay: rgba(251, 250, 246, 0.8);\r
  --tcw-border: #dcd8cf;\r
  --tcw-border-strong: #c7c2b7;\r
  --tcw-tooltip-bg: #1b1d21;\r
  --tcw-tooltip-fg: #fbfaf6;\r
  --tcw-text: #1b1d21;\r
  --tcw-text-dim: #4a4e57;\r
  --tcw-text-muted: #6c7077;\r
\r
  /* A deeper ink blue: readable as text on paper, white text readable on it. */\r
  --tcw-accent: #2348c4;\r
  --tcw-accent-hover: #1b3a9f;\r
  --tcw-accent-ink: #ffffff;\r
  --tcw-accent-soft: rgba(35, 72, 196, 0.1);\r
  --tcw-accent-glow: rgba(35, 72, 196, 0.16);\r
  --tcw-accent-line: rgba(35, 72, 196, 0.45);\r
  --tcw-ring: 0 0 0 2px rgba(35, 72, 196, 0.4);\r
\r
  /* Darker semantic colours: used as text on paper. */\r
  --tcw-red: #b8423f;\r
  --tcw-red-soft: rgba(184, 66, 63, 0.1);\r
  --tcw-green: #1f7a5c;\r
  --tcw-green-soft: rgba(31, 122, 92, 0.1);\r
\r
  --tcw-hover-bg: rgba(27, 29, 33, 0.05);\r
  --tcw-active-bg: rgba(27, 29, 33, 0.08);\r
  --tcw-divider: #e7e3da;\r
\r
  /* Warm shadows, as paper casts. */\r
  --tcw-shadow-sm: 0 1px 2px rgba(40, 34, 22, 0.06);\r
  --tcw-shadow-md: 0 4px 12px rgba(40, 34, 22, 0.08), 0 1px 3px rgba(40, 34, 22, 0.05);\r
  --tcw-shadow-lg: 0 12px 36px rgba(40, 34, 22, 0.13), 0 4px 12px rgba(40, 34, 22, 0.07);\r
  --tcw-shadow-xl: 0 24px 64px rgba(40, 34, 22, 0.17), 0 12px 24px rgba(40, 34, 22, 0.09);\r
}\r
\r
/* === Toolbar === */\r
\r
.tcw-toolbar {\r
  display: flex;\r
  align-items: center;\r
  gap: 0;\r
  padding: 0 var(--tcw-space-4);\r
  height: var(--tcw-toolbar-h);\r
  border-bottom: var(--tcw-border-w) solid var(--tcw-border);\r
  background: var(--tcw-bg-surface);\r
  flex-shrink: 0;\r
  position: relative;\r
  z-index: 20;\r
}\r
\r
.tcw-toolbar-symbol {\r
  font-size: var(--tcw-font-size-lg);\r
  font-weight: var(--tcw-weight-strong);\r
  color: var(--tcw-text);\r
  display: inline-flex;\r
  align-items: center;\r
  height: var(--tcw-control-h);\r
  padding: 0 var(--tcw-space-4);\r
  white-space: nowrap;\r
  letter-spacing: -0.015em;\r
  cursor: pointer;\r
  border: none;\r
  background: transparent;\r
  font-family: inherit;\r
  border-radius: var(--tcw-control-radius);\r
  transition: background var(--tcw-dur-fast) var(--tcw-ease);\r
}\r
\r
.tcw-toolbar-symbol:hover {\r
  background: var(--tcw-hover-bg);\r
}\r
\r
/* With the symbol search switched off, the button only names the symbol. */\r
.tcw-toolbar-symbol[aria-disabled="true"] {\r
  cursor: default;\r
}\r
\r
.tcw-toolbar-symbol[aria-disabled="true"]:hover {\r
  background: transparent;\r
}\r
\r
.tcw-toolbar-sep {\r
  width: var(--tcw-sep-w);\r
  /* A button's height over phi: the rule stands as tall as the icons beside it. */\r
  height: calc(var(--tcw-control-h) / 1.618);\r
  background: var(--tcw-border);\r
  flex-shrink: 0;\r
  margin: 0 var(--tcw-space-3);\r
}\r
\r
.tcw-toolbar-group {\r
  display: flex;\r
  align-items: center;\r
  gap: var(--tcw-space-1);\r
  padding: 0 var(--tcw-space-2);\r
}\r
\r
.tcw-toolbar-spacer {\r
  flex: 1;\r
}\r
\r
.tcw-btn {\r
  display: inline-flex;\r
  align-items: center;\r
  justify-content: center;\r
  height: var(--tcw-control-h);\r
  padding: 0 var(--tcw-space-4);\r
  font-size: var(--tcw-font-size);\r
  font-weight: var(--tcw-weight);\r
  font-family: inherit;\r
  border: none;\r
  border-radius: var(--tcw-control-radius);\r
  background: transparent;\r
  color: var(--tcw-text-dim);\r
  cursor: pointer;\r
  transition:\r
    background var(--tcw-dur-fast) var(--tcw-ease),\r
    color var(--tcw-dur-fast) var(--tcw-ease),\r
    transform var(--tcw-dur-fast) var(--tcw-ease);\r
  white-space: nowrap;\r
  line-height: 1;\r
  letter-spacing: -0.005em;\r
}\r
\r
.tcw-btn:hover {\r
  background: var(--tcw-hover-bg);\r
  color: var(--tcw-text);\r
}\r
\r
.tcw-btn:active {\r
  transform: translateY(0.5px);\r
}\r
\r
.tcw-btn.tcw-active {\r
  background: var(--tcw-on-bg);\r
  color: var(--tcw-on-fg);\r
  font-weight: var(--tcw-weight-strong);\r
  box-shadow: var(--tcw-on-ring);\r
}\r
\r
.tcw-btn:focus-visible,\r
.tcw-btn-icon:focus-visible,\r
.tcw-sidebar-btn:focus-visible,\r
.tcw-dropdown-trigger:focus-visible {\r
  outline: none;\r
  box-shadow: var(--tcw-ring);\r
}\r
\r
.tcw-btn-icon {\r
  width: var(--tcw-control-h);\r
  height: var(--tcw-control-h);\r
  display: inline-flex;\r
  align-items: center;\r
  justify-content: center;\r
  font-family: inherit;\r
  border: none;\r
  border-radius: var(--tcw-control-radius);\r
  background: transparent;\r
  color: var(--tcw-text-muted);\r
  cursor: pointer;\r
  transition:\r
    background var(--tcw-dur-fast) var(--tcw-ease),\r
    color var(--tcw-dur-fast) var(--tcw-ease);\r
  line-height: 1;\r
  position: relative;\r
}\r
\r
.tcw-btn-icon:hover {\r
  background: var(--tcw-hover-bg);\r
  color: var(--tcw-text);\r
}\r
\r
.tcw-btn-icon svg {\r
  display: block;\r
  width: var(--tcw-icon);\r
  height: var(--tcw-icon);\r
}\r
\r
.tcw-badge-count {\r
  font-size: var(--tcw-font-size-xs);\r
  font-weight: var(--tcw-weight-strong);\r
  color: var(--tcw-accent);\r
  background: var(--tcw-accent-soft);\r
  padding: 1px var(--tcw-space-3);\r
  border-radius: var(--tcw-tag-radius);\r
  font-family: var(--tcw-font-mono);\r
}\r
\r
/* === Dropdown === */\r
\r
.tcw-dropdown-trigger {\r
  display: inline-flex;\r
  align-items: center;\r
  gap: var(--tcw-space-3);\r
  height: var(--tcw-control-h);\r
  padding: 0 var(--tcw-space-4);\r
  font-size: var(--tcw-font-size);\r
  font-weight: var(--tcw-weight);\r
  font-family: inherit;\r
  border: none;\r
  border-radius: var(--tcw-control-radius);\r
  background: transparent;\r
  color: var(--tcw-text-dim);\r
  cursor: pointer;\r
  transition: background var(--tcw-dur-fast) var(--tcw-ease), color var(--tcw-dur-fast) var(--tcw-ease);\r
  white-space: nowrap;\r
  line-height: 1;\r
}\r
\r
.tcw-dropdown-trigger:hover {\r
  background: var(--tcw-hover-bg);\r
  color: var(--tcw-text);\r
}\r
\r
.tcw-dropdown {\r
  position: absolute;\r
  top: 100%;\r
  margin-top: var(--tcw-space-3);\r
  background: var(--tcw-bg-elevated);\r
  border: var(--tcw-border-w) solid var(--tcw-border);\r
  border-radius: var(--tcw-menu-radius);\r
  box-shadow: var(--tcw-menu-shadow);\r
  z-index: 50;\r
  width: max-content;\r
  max-width: min(340px, calc(100vw - 16px));\r
  padding: var(--tcw-menu-pad);\r
  max-height: 420px;\r
  overflow-y: auto;\r
  backdrop-filter: blur(var(--tcw-blur));\r
  -webkit-backdrop-filter: blur(var(--tcw-blur));\r
  animation: tcw-pop-in var(--tcw-dur-normal) var(--tcw-ease-out);\r
}\r
\r
@keyframes tcw-pop-in {\r
  from { opacity: 0; transform: translateY(-4px) scale(0.98); }\r
  to { opacity: 1; transform: translateY(0) scale(1); }\r
}\r
\r
.tcw-dropdown-item {\r
  display: flex;\r
  align-items: center;\r
  justify-content: space-between;\r
  min-height: var(--tcw-menu-item-h);\r
  padding: var(--tcw-space-1) var(--tcw-space-4);\r
  font-size: var(--tcw-font-size);\r
  color: var(--tcw-text-dim);\r
  cursor: pointer;\r
  transition: background var(--tcw-dur-fast) var(--tcw-ease), color var(--tcw-dur-fast) var(--tcw-ease);\r
  width: 100%;\r
  border: none;\r
  background: transparent;\r
  font-family: inherit;\r
  text-align: start;\r
  border-radius: var(--tcw-menu-item-radius);\r
  gap: var(--tcw-space-5);\r
}\r
\r
.tcw-dropdown-item:hover {\r
  background: var(--tcw-hover-bg);\r
  color: var(--tcw-text);\r
}\r
\r
/* A menu row led by an icon (chart types): icon then label, not spread apart. */\r
.tcw-dropdown-item--icon {\r
  justify-content: flex-start;\r
  gap: var(--tcw-space-4);\r
}\r
\r
.tcw-dropdown-item svg,\r
.tcw-flyout-item svg {\r
  flex-shrink: 0;\r
}\r
\r
/* The drawing-group button's icon holder: a plain box for the swapped SVG. */\r
.tcw-sidebar-icon {\r
  display: inline-flex;\r
}\r
\r
.tcw-dropdown-item.tcw-active {\r
  color: var(--tcw-accent);\r
  background: var(--tcw-accent-soft);\r
  font-weight: var(--tcw-weight-strong);\r
}\r
\r
/* Timeframe menu: pick on the left, pin (star) on the right. */\r
.tcw-tf-more {\r
  padding: 0 5px;\r
}\r
\r
.tcw-tf-more svg {\r
  display: block;\r
}\r
\r
.tcw-tf-row {\r
  display: flex;\r
  align-items: center;\r
  gap: 2px;\r
}\r
\r
.tcw-tf-row .tcw-dropdown-item {\r
  flex: 1;\r
  min-width: 0;\r
}\r
\r
.tcw-tf-star {\r
  display: inline-grid;\r
  place-items: center;\r
  width: var(--tcw-control-h-sm);\r
  height: var(--tcw-control-h-sm);\r
  flex-shrink: 0;\r
  border: none;\r
  border-radius: var(--tcw-control-radius);\r
  background: transparent;\r
  color: var(--tcw-text-muted);\r
  cursor: pointer;\r
  transition: color var(--tcw-dur-fast) var(--tcw-ease), background var(--tcw-dur-fast) var(--tcw-ease);\r
}\r
\r
.tcw-tf-star:hover {\r
  background: var(--tcw-hover-bg);\r
  color: var(--tcw-text);\r
}\r
\r
.tcw-tf-star.tcw-active {\r
  color: var(--tcw-accent);\r
}\r
\r
.tcw-tf-star.tcw-active svg {\r
  fill: currentColor;\r
}\r
\r
.tcw-tf-star:focus-visible {\r
  outline: 2px solid var(--tcw-accent);\r
  outline-offset: -2px;\r
}\r
\r
.tcw-tf-remove {\r
  display: inline-grid;\r
  place-items: center;\r
  width: var(--tcw-control-h-sm);\r
  height: var(--tcw-control-h-sm);\r
  flex-shrink: 0;\r
  border: none;\r
  border-radius: var(--tcw-control-radius);\r
  background: transparent;\r
  color: var(--tcw-text-muted);\r
  cursor: pointer;\r
  opacity: 0;\r
  transition: opacity var(--tcw-dur-fast) var(--tcw-ease), color var(--tcw-dur-fast) var(--tcw-ease);\r
}\r
\r
.tcw-tf-row:hover .tcw-tf-remove,\r
.tcw-tf-remove:focus-visible {\r
  opacity: 1;\r
}\r
\r
/* No hover on touch screens: keep it visible rather than a hidden tap target. */\r
@media (hover: none) {\r
  .tcw-tf-remove { opacity: 1; }\r
}\r
\r
.tcw-tf-remove:hover {\r
  color: var(--tcw-red);\r
  background: var(--tcw-hover-bg);\r
}\r
\r
.tcw-tf-remove:focus-visible {\r
  outline: 2px solid var(--tcw-accent);\r
  outline-offset: -2px;\r
}\r
\r
/* Typed interval, under the list: stays in view while the list scrolls. */\r
.tcw-tf-custom {\r
  position: sticky;\r
  bottom: -6px;\r
  display: flex;\r
  flex-wrap: wrap;\r
  gap: 4px;\r
  margin: 4px -6px -6px;\r
  padding: 6px 10px 8px;\r
  border-top: 1px solid var(--tcw-divider);\r
  background: var(--tcw-bg-elevated);\r
}\r
\r
.tcw-tf-custom-hint:empty {\r
  display: none;\r
}\r
\r
.tcw-tf-custom-hint {\r
  flex-basis: 100%;\r
  width: 0;\r
  min-width: 100%;\r
  color: var(--tcw-red);\r
  font-size: var(--tcw-font-size-xs);\r
  line-height: 1.35;\r
}\r
\r
.tcw-tf-custom-input {\r
  flex: 1;\r
  /* Fills the row: its own width would follow the font (16px on touch). */\r
  width: 0;\r
  min-width: 0;\r
  height: 26px;\r
  padding: 0 8px;\r
  border: 1px solid var(--tcw-border);\r
  border-radius: var(--tcw-input-radius);\r
  background: var(--tcw-bg);\r
  color: var(--tcw-text);\r
  font: inherit;\r
  font-family: var(--tcw-font-mono);\r
  font-size: var(--tcw-font-size-sm);\r
}\r
\r
.tcw-tf-custom-input::placeholder {\r
  color: var(--tcw-text-dim);\r
}\r
\r
.tcw-tf-custom-input:focus {\r
  outline: none;\r
  border-color: var(--tcw-accent);\r
  box-shadow: 0 0 0 2px var(--tcw-accent-soft);\r
}\r
\r
.tcw-tf-custom-input[aria-invalid='true'] {\r
  border-color: var(--tcw-red);\r
  box-shadow: 0 0 0 2px var(--tcw-red-soft);\r
}\r
\r
.tcw-tf-custom-add {\r
  display: inline-grid;\r
  place-items: center;\r
  width: var(--tcw-control-h-sm);\r
  height: var(--tcw-control-h-sm);\r
  flex-shrink: 0;\r
  border: 1px solid var(--tcw-border);\r
  border-radius: var(--tcw-control-radius);\r
  background: var(--tcw-bg-surface);\r
  color: var(--tcw-text);\r
  cursor: pointer;\r
}\r
\r
.tcw-tf-custom-add:hover {\r
  border-color: var(--tcw-accent);\r
  color: var(--tcw-accent);\r
}\r
\r
.tcw-tf-custom-add:focus-visible {\r
  outline: 2px solid var(--tcw-accent);\r
  outline-offset: 1px;\r
}\r
\r
.tcw-dropdown-label {\r
  text-transform: var(--tcw-label-case);\r
  font-size: var(--tcw-font-size-xs);\r
  color: var(--tcw-text-muted);\r
  letter-spacing: var(--tcw-label-tracking);\r
  padding: var(--tcw-space-4) var(--tcw-space-4) var(--tcw-space-2);\r
  font-weight: var(--tcw-weight-strong);\r
}\r
\r
.tcw-dropdown-divider {\r
  border-top: 1px solid var(--tcw-divider);\r
  margin: 6px 4px;\r
}\r
\r
.tcw-tag {\r
  font-size: var(--tcw-font-size-xs);\r
  font-family: var(--tcw-font-mono);\r
  color: var(--tcw-text-muted);\r
  padding: 2px 6px;\r
  border-radius: var(--tcw-tag-radius);\r
  background: var(--tcw-hover-bg);\r
  letter-spacing: 0.02em;\r
}\r
\r
/* === Body === */\r
\r
.tcw-body {\r
  position: relative;\r
  display: flex;\r
  flex: 1;\r
  min-height: 0;\r
  background: var(--tcw-bg);\r
}\r
\r
.tcw-chart-container {\r
  flex: 1;\r
  min-width: 0;\r
  min-height: 0;\r
  width: 100%;\r
  height: 100%;\r
  position: relative;\r
}\r
\r
/* === Symbol search results: name and exchange === */\r
\r
.tcw-cmd-item-desc {\r
  flex: 1;\r
  min-width: 0;\r
  overflow: hidden;\r
  color: var(--tcw-text-muted);\r
  font-size: var(--tcw-font-size-sm);\r
  text-overflow: ellipsis;\r
  white-space: nowrap;\r
}\r
\r
.tcw-cmd-item-meta {\r
  flex-shrink: 0;\r
  color: var(--tcw-text-dim);\r
  font-size: var(--tcw-font-size-xs);\r
  letter-spacing: 0.02em;\r
}\r
\r
/* === History pill (older bars loading at the left edge) === */\r
\r
.tcw-history-pill {\r
  position: absolute;\r
  top: 50%;\r
  left: 10px;\r
  z-index: 4;\r
  display: flex;\r
  align-items: center;\r
  gap: 7px;\r
  padding: 5px 10px 5px 8px;\r
  border: 1px solid var(--tcw-border);\r
  border-radius: var(--tcw-tag-radius);\r
  background: var(--tcw-bg-elevated);\r
  box-shadow: var(--tcw-shadow-sm);\r
  color: var(--tcw-text-muted);\r
  font-size: var(--tcw-font-size-xs);\r
  line-height: 1;\r
  white-space: nowrap;\r
  transform: translateY(-50%);\r
  opacity: 1;\r
  transition: opacity var(--tcw-dur-normal) var(--tcw-ease-out);\r
  pointer-events: none;\r
}\r
\r
.tcw-history-pill--hidden {\r
  opacity: 0;\r
}\r
\r
.tcw-history-pill--error {\r
  border-color: color-mix(in srgb, var(--tcw-red) 45%, var(--tcw-border));\r
  color: var(--tcw-red);\r
}\r
\r
.tcw-history-spinner {\r
  width: 10px;\r
  height: 10px;\r
  border: 1.5px solid var(--tcw-accent-soft);\r
  border-top-color: var(--tcw-accent);\r
  border-radius: 50%;\r
  animation: tcw-history-spin 0.8s linear infinite;\r
}\r
\r
.tcw-history-pill--error .tcw-history-spinner {\r
  border-color: currentColor;\r
  animation: none;\r
}\r
\r
@keyframes tcw-history-spin {\r
  to { transform: rotate(360deg); }\r
}\r
\r
/* === Loading overlay (candle skeleton) === */\r
\r
.tcw-loading-overlay {\r
  /* Uses a modifier class rather than the \`hidden\` attribute — the global\r
     \`[hidden] { display: none !important }\` rule above would cut the\r
     opacity transition off before it can play. */\r
  position: absolute;\r
  inset: 0;\r
  z-index: 5;\r
  display: flex;\r
  align-items: center;\r
  justify-content: center;\r
  background: var(--tcw-bg);\r
  opacity: 1;\r
  transition: opacity var(--tcw-dur-slow) var(--tcw-ease-out);\r
  pointer-events: none;\r
}\r
\r
.tcw-loading-overlay--hidden {\r
  opacity: 0;\r
}\r
\r
.tcw-loading-card {\r
  display: flex;\r
  flex-direction: column;\r
  align-items: center;\r
  gap: 14px;\r
  padding: 22px 26px 20px;\r
  border: 1px solid transparent;\r
  border-radius: var(--tcw-panel-radius);\r
}\r
\r
/* A slow switch: the previous chart stays readable underneath, dimmed, so the\r
   click visibly registered without blanking the screen. */\r
.tcw-loading-overlay--veil {\r
  background: color-mix(in srgb, var(--tcw-bg) 55%, transparent);\r
}\r
\r
.tcw-loading-overlay--veil .tcw-loading-card {\r
  background: var(--tcw-bg-elevated);\r
  border-color: var(--tcw-border);\r
  box-shadow: var(--tcw-menu-shadow);\r
}\r
\r
.tcw-loading-candles {\r
  position: relative;\r
  display: flex;\r
  gap: 7px;\r
  height: 64px;\r
}\r
\r
/* One candle: the element is the wick's column, ::before the wick, ::after the body. */\r
.tcw-loading-candle {\r
  position: relative;\r
  width: 8px;\r
  height: 100%;\r
  color: var(--tcw-red);\r
  opacity: 0.28;\r
  animation: tcw-candle-light 1.6s var(--tcw-ease) infinite;\r
  animation-delay: var(--tcw-delay, 0ms);\r
}\r
\r
.tcw-loading-candle--up { color: var(--tcw-green); }\r
\r
.tcw-loading-candle::before,\r
.tcw-loading-candle::after {\r
  content: '';\r
  position: absolute;\r
  left: 50%;\r
  background: currentColor;\r
  transform: translateX(-50%);\r
}\r
\r
.tcw-loading-candle::before {\r
  top: var(--tcw-wick-top);\r
  width: 1.5px;\r
  height: var(--tcw-wick-h);\r
}\r
\r
.tcw-loading-candle::after {\r
  top: var(--tcw-body-top);\r
  width: 8px;\r
  height: var(--tcw-body-h);\r
  border-radius: 1.5px;\r
}\r
\r
/* Each candle brightens and lifts slightly in turn, left to right. */\r
@keyframes tcw-candle-light {\r
  0%, 55%, 100% { opacity: 0.28; transform: translateY(0); }\r
  20% { opacity: 1; transform: translateY(-2px); }\r
}\r
\r
.tcw-loading-track {\r
  position: relative;\r
  width: 100%;\r
  min-width: 88px;\r
  height: 2px;\r
  border-radius: 1px;\r
  background: var(--tcw-border);\r
  overflow: hidden;\r
}\r
\r
.tcw-loading-track > span {\r
  position: absolute;\r
  inset: 0;\r
  width: 40%;\r
  border-radius: 1px;\r
  background: linear-gradient(90deg, transparent, var(--tcw-accent), transparent);\r
  animation: tcw-loading-sweep 1.6s var(--tcw-ease) infinite;\r
}\r
\r
@keyframes tcw-loading-sweep {\r
  from { transform: translateX(-100%); }\r
  to { transform: translateX(250%); }\r
}\r
\r
/* The status text is announced, not shown — the candles say "loading". */\r
.tcw-loading-label {\r
  position: absolute;\r
  width: 1px;\r
  height: 1px;\r
  overflow: hidden;\r
  clip-path: inset(50%);\r
  white-space: nowrap;\r
}\r
\r
.tcw-loading-overlay--error .tcw-loading-candles,\r
.tcw-loading-overlay--error .tcw-loading-track {\r
  display: none;\r
}\r
\r
/* A failure is shown: why the chart is empty and that a retry is running. */\r
.tcw-loading-overlay--error .tcw-loading-label {\r
  position: static;\r
  width: auto;\r
  height: auto;\r
  overflow: visible;\r
  clip-path: none;\r
  white-space: normal;\r
  max-width: 320px;\r
  text-align: center;\r
  color: var(--tcw-red);\r
  font-size: var(--tcw-font-size);\r
}\r
\r
/* Reduced motion: nothing slides or lifts, but the candles still glow in\r
   turn and the track breathes, so the wait never looks frozen. */\r
@media (prefers-reduced-motion: reduce) {\r
  .tcw-loading-candle {\r
    animation: tcw-candle-glow 2.4s ease-in-out infinite;\r
    animation-delay: var(--tcw-delay, 0ms);\r
  }\r
  .tcw-loading-track > span {\r
    width: 100%;\r
    background: var(--tcw-accent);\r
    animation: tcw-loading-breathe 2.4s ease-in-out infinite;\r
  }\r
}\r
\r
@keyframes tcw-candle-glow {\r
  0%, 60%, 100% { opacity: 0.28; }\r
  25% { opacity: 0.9; }\r
}\r
\r
@keyframes tcw-loading-breathe {\r
  0%, 100% { opacity: 0.15; }\r
  50% { opacity: 0.7; }\r
}\r
\r
/* === On-chart indicator legend (WidgetIndicatorLegend) === */\r
\r
.tcw-ind-legend {\r
  position: absolute;\r
  z-index: 3;\r
  display: flex;\r
  flex-direction: column;\r
  align-items: flex-start;\r
  gap: 1px;\r
  max-width: calc(100% - 140px);\r
  pointer-events: none;\r
}\r
\r
.tcw-ind-legend--collapsed > .tcw-ind-legend-row {\r
  display: none;\r
}\r
\r
.tcw-ind-legend-row {\r
  display: flex;\r
  align-items: center;\r
  gap: var(--tcw-space-4);\r
  max-width: 100%;\r
  padding: 0 var(--tcw-space-2);\r
  border-radius: var(--tcw-radius-sm);\r
  /* The figures face at the size of the price legend above: one block, columns that line up. */\r
  font-family: var(--tcw-font-mono);\r
  font-size: var(--tcw-font-size-sm);\r
  line-height: 19px;\r
  font-feature-settings: 'tnum';\r
  white-space: nowrap;\r
  color: var(--tcw-text-dim);\r
  pointer-events: auto;\r
  cursor: default;\r
  /* A narrow pane: the values shrink first, then the row is clipped. */\r
  overflow: hidden;\r
}\r
\r
/* A pane's indicator: at the top of its pane, where the canvas title was,\r
   short enough to sit in the pane's header below the divider's grab zone. */\r
.tcw-ind-legend-row--pane {\r
  position: absolute;\r
  z-index: 3;\r
  line-height: 15px;\r
}\r
\r
.tcw-ind-legend-row:hover,\r
.tcw-ind-legend-row:focus-within {\r
  background: color-mix(in srgb, var(--tcw-bg-elevated) 90%, transparent);\r
  box-shadow: 0 0 0 1px var(--tcw-border);\r
}\r
\r
.tcw-ind-legend-name {\r
  padding: 0;\r
  border: none;\r
  background: none;\r
  font: inherit;\r
  font-weight: var(--tcw-weight-strong);\r
  color: var(--tcw-text);\r
  cursor: pointer;\r
}\r
\r
.tcw-ind-legend-name:hover {\r
  color: var(--tcw-accent);\r
}\r
\r
.tcw-ind-legend-values {\r
  display: inline-flex;\r
  gap: var(--tcw-space-4);\r
  min-width: 0;\r
  overflow: hidden;\r
}\r
\r
.tcw-ind-legend-row--hidden .tcw-ind-legend-name,\r
.tcw-ind-legend-row--hidden .tcw-ind-legend-values {\r
  opacity: 0.45;\r
}\r
\r
/* Show / settings / remove: on hover or keyboard focus (always on touch). */\r
.tcw-ind-legend-actions {\r
  display: none;\r
  gap: 1px;\r
  margin-left: -2px;\r
}\r
\r
.tcw-ind-legend-row:hover .tcw-ind-legend-actions,\r
.tcw-ind-legend-row:focus-within .tcw-ind-legend-actions {\r
  display: inline-flex;\r
}\r
\r
@media (hover: none) {\r
  .tcw-ind-legend-actions {\r
    display: inline-flex;\r
  }\r
\r
  /* Finger-sized targets. */\r
  .tcw-ind-legend-act,\r
  .tcw-ind-legend-toggle {\r
    min-width: 28px;\r
    min-height: 24px;\r
  }\r
}\r
\r
.tcw-ind-legend-act {\r
  display: inline-grid;\r
  place-items: center;\r
  width: 20px;\r
  height: 18px;\r
  padding: 0;\r
  border: none;\r
  border-radius: var(--tcw-control-radius);\r
  background: transparent;\r
  color: var(--tcw-text-muted);\r
  cursor: pointer;\r
}\r
\r
.tcw-ind-legend-act:hover {\r
  color: var(--tcw-text);\r
  background: var(--tcw-hover-bg);\r
}\r
\r
.tcw-ind-legend-act[data-act='remove']:hover {\r
  color: var(--tcw-red);\r
}\r
\r
.tcw-ind-legend-toggle {\r
  display: inline-flex;\r
  align-items: center;\r
  gap: 3px;\r
  margin-top: 1px;\r
  padding: 1px 5px;\r
  border: none;\r
  border-radius: var(--tcw-control-radius);\r
  background: transparent;\r
  color: var(--tcw-text-muted);\r
  font: inherit;\r
  font-size: var(--tcw-font-size-xs);\r
  cursor: pointer;\r
  pointer-events: auto;\r
}\r
\r
.tcw-ind-legend-toggle[hidden] {\r
  display: none;\r
}\r
\r
.tcw-ind-legend-toggle:hover {\r
  color: var(--tcw-text);\r
  background: var(--tcw-hover-bg);\r
}\r
\r
.tcw-ind-legend-name:focus-visible,\r
.tcw-ind-legend-act:focus-visible,\r
.tcw-ind-legend-toggle:focus-visible {\r
  outline: 2px solid var(--tcw-accent);\r
  outline-offset: -2px;\r
}\r
\r
/* === Sidebar === */\r
\r
.tcw-sidebar {\r
  width: var(--tcw-sidebar-w);\r
  flex-shrink: 0;\r
  background: var(--tcw-bg-surface);\r
  border-inline-end: var(--tcw-border-w) solid var(--tcw-border);\r
  display: flex;\r
  flex-direction: column;\r
  align-items: center;\r
  padding: var(--tcw-space-3) 0;\r
  /* On a short screen the tools scroll; the menus sit outside it. */\r
  overflow-x: hidden;\r
  overflow-y: auto;\r
  scrollbar-width: none;\r
}\r
.tcw-sidebar::-webkit-scrollbar {\r
  display: none;\r
}\r
.tcw-sidebar > * {\r
  flex-shrink: 0;\r
}\r
\r
.tcw-tool-group-wrap {\r
  position: relative;\r
}\r
\r
.tcw-sidebar-btn {\r
  width: var(--tcw-control-h);\r
  height: var(--tcw-control-h);\r
  margin: 1px 0;\r
  display: flex;\r
  align-items: center;\r
  justify-content: center;\r
  border: none;\r
  background: transparent;\r
  color: var(--tcw-text-muted);\r
  cursor: pointer;\r
  font-family: inherit;\r
  transition:\r
    background var(--tcw-dur-fast) var(--tcw-ease),\r
    color var(--tcw-dur-fast) var(--tcw-ease);\r
  position: relative;\r
  flex-shrink: 0;\r
  line-height: 1;\r
  border-radius: var(--tcw-control-radius);\r
}\r
\r
.tcw-sidebar-btn svg {\r
  width: var(--tcw-icon);\r
  height: var(--tcw-icon);\r
}\r
\r
.tcw-sidebar-btn:hover {\r
  color: var(--tcw-text);\r
  background: var(--tcw-hover-bg);\r
}\r
\r
.tcw-sidebar-btn.tcw-active {\r
  color: var(--tcw-on-icon-fg);\r
  background: var(--tcw-on-icon-bg);\r
  box-shadow: var(--tcw-on-icon-ring);\r
}\r
\r
.tcw-sidebar-btn.tcw-danger:hover {\r
  color: var(--tcw-red);\r
  background: var(--tcw-red-soft);\r
}\r
\r
.tcw-multi-dot {\r
  position: absolute;\r
  bottom: 3px;\r
  right: 3px;\r
  width: 4px;\r
  height: 4px;\r
  border-radius: 50%;\r
  background: var(--tcw-text-muted);\r
  opacity: 0.7;\r
}\r
\r
/* The drawing tools' sections: always a hairline (it groups the tools), even in\r
   looks that drop the rules between toolbar groups. */\r
.tcw-sidebar-divider {\r
  width: 20px;\r
  height: max(1px, var(--tcw-sep-w));\r
  background: var(--tcw-divider);\r
  margin: 5px 0;\r
  flex-shrink: 0;\r
}\r
\r
.tcw-sidebar-spacer {\r
  flex: 1;\r
}\r
\r
/* === Flyout === */\r
\r
.tcw-flyout {\r
  position: absolute;\r
  margin-inline-start: 6px;\r
  overflow-y: auto;\r
  overscroll-behavior: contain;\r
  min-width: 180px;\r
  background: var(--tcw-bg-elevated);\r
  border: var(--tcw-border-w) solid var(--tcw-border);\r
  border-radius: var(--tcw-menu-radius);\r
  box-shadow: var(--tcw-menu-shadow);\r
  z-index: 30;\r
  padding: var(--tcw-menu-pad);\r
  backdrop-filter: blur(var(--tcw-blur));\r
  -webkit-backdrop-filter: blur(var(--tcw-blur));\r
  animation: tcw-slide-right var(--tcw-dur-normal) var(--tcw-ease-out);\r
}\r
\r
/* Spans the gap to the toolbar button: crossing it stays inside the menu. */\r
.tcw-flyout::before {\r
  content: '';\r
  position: absolute;\r
  top: -1px;\r
  bottom: -1px;\r
  right: 100%;\r
  width: 8px;\r
}\r
\r
@keyframes tcw-slide-right {\r
  from { opacity: 0; transform: translateX(-4px); }\r
  to { opacity: 1; transform: translateX(0); }\r
}\r
\r
.tcw-flyout-header {\r
  text-transform: var(--tcw-label-case);\r
  font-size: var(--tcw-font-size-xs);\r
  color: var(--tcw-text-muted);\r
  letter-spacing: var(--tcw-label-tracking);\r
  padding: var(--tcw-space-3) var(--tcw-space-4) var(--tcw-space-2);\r
  font-weight: var(--tcw-weight-strong);\r
}\r
\r
.tcw-flyout-hint {\r
  padding: var(--tcw-space-3) var(--tcw-space-4) var(--tcw-space-1);\r
  border-top: 1px solid var(--tcw-border);\r
  margin-top: var(--tcw-space-2);\r
  font-size: var(--tcw-font-size-xs);\r
  color: var(--tcw-text-muted);\r
}\r
\r
.tcw-flyout-item {\r
  min-height: var(--tcw-menu-item-h);\r
  padding: var(--tcw-space-1) var(--tcw-space-4);\r
  font-size: var(--tcw-font-size);\r
  color: var(--tcw-text-dim);\r
  cursor: pointer;\r
  width: 100%;\r
  display: flex;\r
  align-items: center;\r
  gap: 10px;\r
  border: none;\r
  background: transparent;\r
  text-align: start;\r
  font-family: inherit;\r
  border-radius: var(--tcw-menu-item-radius);\r
  transition: background var(--tcw-dur-fast) var(--tcw-ease), color var(--tcw-dur-fast) var(--tcw-ease);\r
}\r
\r
.tcw-flyout-item:hover {\r
  background: var(--tcw-hover-bg);\r
  color: var(--tcw-text);\r
}\r
.tcw-flyout-item:focus-visible {\r
  outline: none;\r
  background: var(--tcw-hover-bg);\r
  color: var(--tcw-text);\r
  box-shadow: inset 0 0 0 1px var(--tcw-accent);\r
}\r
\r
.tcw-flyout-item.tcw-active {\r
  color: var(--tcw-accent);\r
  background: var(--tcw-accent-soft);\r
  font-weight: var(--tcw-weight-strong);\r
}\r
\r
\r
/* Favorites strip — pinned drawing tools above the tool groups. */\r
.tcw-sidebar-favorites {\r
  display: flex;\r
  flex-direction: column;\r
  gap: 2px;\r
}\r
.tcw-sidebar-favorites .tcw-sidebar-btn {\r
  position: relative;\r
}\r
.tcw-sidebar-favorites .tcw-sidebar-btn::before {\r
  content: '';\r
  position: absolute;\r
  top: 3px;\r
  right: 3px;\r
  width: 4px;\r
  height: 4px;\r
  border-radius: 50%;\r
  background: var(--tcw-accent);\r
  opacity: 0.7;\r
}\r
\r
/* === Modal === */\r
\r
.tcw-modal-backdrop {\r
  position: fixed;\r
  inset: 0;\r
  background: rgba(12, 12, 10, 0.42);\r
  backdrop-filter: blur(var(--tcw-blur));\r
  -webkit-backdrop-filter: blur(var(--tcw-blur));\r
  z-index: 100;\r
  animation: tcw-fade-in var(--tcw-dur-normal) var(--tcw-ease-out);\r
}\r
\r
@keyframes tcw-fade-in {\r
  from { opacity: 0; }\r
  to { opacity: 1; }\r
}\r
\r
.tcw-modal {\r
  position: fixed;\r
  z-index: 101;\r
  top: 50%;\r
  left: 50%;\r
  transform: translate(-50%, -50%);\r
  background: var(--tcw-bg-elevated);\r
  border: var(--tcw-border-w) solid var(--tcw-border);\r
  border-radius: var(--tcw-dialog-radius);\r
  width: 520px;\r
  max-width: 92vw;\r
  max-height: 82vh;\r
  max-height: 82dvh;\r
  display: flex;\r
  flex-direction: column;\r
  box-shadow: var(--tcw-dialog-shadow);\r
  animation: tcw-modal-in var(--tcw-dur-slow) var(--tcw-ease-out);\r
}\r
\r
@keyframes tcw-modal-in {\r
  from { opacity: 0; transform: translate(-50%, -48%) scale(0.96); }\r
  to { opacity: 1; transform: translate(-50%, -50%) scale(1); }\r
}\r
\r
.tcw-modal-header {\r
  display: flex;\r
  align-items: center;\r
  justify-content: space-between;\r
  padding: var(--tcw-space-5) var(--tcw-space-6);\r
  border-bottom: 1px solid var(--tcw-divider);\r
}\r
\r
/* A dialog's title is phi times its text (21 to 13). */\r
.tcw-modal-header h3 {\r
  font-size: var(--tcw-font-size-display);\r
  font-weight: var(--tcw-weight-strong);\r
  margin: 0;\r
  color: var(--tcw-text);\r
  letter-spacing: -0.015em;\r
}\r
\r
.tcw-modal-close {\r
  width: var(--tcw-control-h-sm);\r
  height: var(--tcw-control-h-sm);\r
  display: flex;\r
  align-items: center;\r
  justify-content: center;\r
  border: none;\r
  background: transparent;\r
  color: var(--tcw-text-muted);\r
  cursor: pointer;\r
  border-radius: var(--tcw-control-radius);\r
  transition: background var(--tcw-dur-fast) var(--tcw-ease), color var(--tcw-dur-fast) var(--tcw-ease);\r
}\r
\r
.tcw-modal-close:hover {\r
  background: var(--tcw-hover-bg);\r
  color: var(--tcw-text);\r
}\r
\r
.tcw-modal-tabs {\r
  display: flex;\r
  /* Four tabs in a long language on a phone: they wrap rather than clip. No overflow here: in the\r
     dialog's column it would let a long body squash the tabs, and clip the underline of the active one. */\r
  flex-wrap: wrap;\r
  flex-shrink: 0;\r
  gap: var(--tcw-space-2);\r
  padding: var(--tcw-tabs-pad-block) var(--tcw-space-6);\r
  border-bottom: 1px solid var(--tcw-divider);\r
}\r
\r
.tcw-modal-tab {\r
  flex-shrink: 0;\r
  white-space: nowrap;\r
  height: var(--tcw-tab-h);\r
  padding: var(--tcw-tab-pad);\r
  font-size: var(--tcw-font-size);\r
  font-weight: var(--tcw-weight);\r
  color: var(--tcw-text-muted);\r
  border: none;\r
  background: transparent;\r
  cursor: pointer;\r
  border-bottom: var(--tcw-tab-line) solid transparent;\r
  border-radius: var(--tcw-tab-radius);\r
  margin-bottom: calc(var(--tcw-tab-line) / -2);\r
  transition: color var(--tcw-dur-fast) var(--tcw-ease), border-color var(--tcw-dur-fast) var(--tcw-ease);\r
  font-family: inherit;\r
  text-transform: capitalize;\r
  letter-spacing: -0.005em;\r
}\r
\r
.tcw-modal-tab:hover {\r
  color: var(--tcw-text-dim);\r
  background: var(--tcw-tab-hover);\r
}\r
\r
.tcw-modal-tab.tcw-active {\r
  color: var(--tcw-tab-on-fg);\r
  background: var(--tcw-tab-on-bg);\r
  border-bottom-color: var(--tcw-accent);\r
  font-weight: var(--tcw-weight-strong);\r
}\r
\r
.tcw-modal-body {\r
  padding: var(--tcw-space-6);\r
  overflow-y: auto;\r
  flex: 1;\r
}\r
\r
.tcw-settings-section {\r
  margin-bottom: var(--tcw-space-6);\r
}\r
\r
.tcw-settings-section:last-child {\r
  margin-bottom: 0;\r
}\r
\r
.tcw-settings-section-title {\r
  font-size: var(--tcw-font-size-xs);\r
  font-weight: var(--tcw-weight-strong);\r
  text-transform: var(--tcw-label-case);\r
  letter-spacing: var(--tcw-label-tracking);\r
  color: var(--tcw-text-muted);\r
  margin-bottom: var(--tcw-space-4);\r
}\r
\r
.tcw-settings-row {\r
  display: flex;\r
  align-items: center;\r
  justify-content: space-between;\r
  padding: var(--tcw-space-4) 0;\r
}\r
\r
.tcw-settings-row + .tcw-settings-row {\r
  border-top: 1px solid var(--tcw-divider);\r
}\r
\r
.tcw-settings-label {\r
  font-size: var(--tcw-font-size);\r
  color: var(--tcw-text-dim);\r
  letter-spacing: -0.005em;\r
}\r
\r
.tcw-color-picker-wrap {\r
  display: flex;\r
  align-items: center;\r
  gap: 8px;\r
}\r
\r
.tcw-color-picker-wrap input[type='color'] {\r
  width: 28px;\r
  height: 28px;\r
  border: 1px solid var(--tcw-border-strong);\r
  border-radius: var(--tcw-radius-sm);\r
  background: transparent;\r
  cursor: pointer;\r
  padding: 2px;\r
}\r
\r
.tcw-color-picker-wrap input[type='color']::-webkit-color-swatch-wrapper {\r
  padding: 0;\r
}\r
\r
.tcw-color-picker-wrap input[type='color']::-webkit-color-swatch {\r
  border: none;\r
  border-radius: var(--tcw-radius-xs);\r
}\r
\r
.tcw-color-hex {\r
  font-size: var(--tcw-font-size-xs);\r
  font-family: var(--tcw-font-mono);\r
  color: var(--tcw-text-muted);\r
  min-width: 64px;\r
  letter-spacing: 0.01em;\r
}\r
\r
/* A colour left to the part itself: the swatch shows where the picker starts, faded. */\r
.tcw-color-auto input[type='color'] {\r
  opacity: 0.45;\r
  border-style: dashed;\r
}\r
\r
.tcw-color-auto .tcw-color-hex {\r
  font-family: inherit;\r
  font-style: italic;\r
}\r
\r
.tcw-color-auto-btn {\r
  height: 24px;\r
  padding: 0 8px;\r
  font: inherit;\r
  font-size: var(--tcw-font-size-xs);\r
  color: var(--tcw-text-muted);\r
  background: transparent;\r
  border: 1px solid var(--tcw-border-strong);\r
  border-radius: var(--tcw-radius-sm);\r
  cursor: pointer;\r
  transition: color var(--tcw-dur-fast) var(--tcw-ease), border-color var(--tcw-dur-fast) var(--tcw-ease);\r
}\r
\r
.tcw-color-auto-btn:hover,\r
.tcw-color-auto-btn:focus-visible {\r
  color: var(--tcw-text);\r
  border-color: var(--tcw-accent);\r
}\r
\r
.tcw-toggle {\r
  width: 36px;\r
  height: 20px;\r
  background: rgba(255, 255, 255, 0.12);\r
  border-radius: 10px;\r
  position: relative;\r
  cursor: pointer;\r
  transition: background var(--tcw-dur-fast) var(--tcw-ease);\r
  border: none;\r
  padding: 0;\r
  flex-shrink: 0;\r
}\r
\r
.tcw-toggle::after {\r
  content: '';\r
  position: absolute;\r
  top: 2px;\r
  left: 2px;\r
  width: 16px;\r
  height: 16px;\r
  border-radius: 50%;\r
  background: var(--tcw-text-muted);\r
  transition:\r
    left var(--tcw-dur-normal) var(--tcw-ease-out),\r
    background var(--tcw-dur-fast) var(--tcw-ease);\r
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);\r
}\r
\r
.tcw-toggle.tcw-on {\r
  background: var(--tcw-accent);\r
  box-shadow: 0 0 0 2px var(--tcw-accent-glow);\r
}\r
\r
.tcw-toggle.tcw-on::after {\r
  left: 18px;\r
  background: #fff;\r
}\r
\r
.tcw-root[data-tcw-theme='light'] .tcw-toggle {\r
  background: rgba(0, 0, 0, 0.12);\r
}\r
\r
.tcw-root[data-tcw-theme='light'] .tcw-toggle::after {\r
  background: #999;\r
}\r
\r
.tcw-root[data-tcw-theme='light'] .tcw-toggle.tcw-on {\r
  background: var(--tcw-accent);\r
}\r
\r
.tcw-root[data-tcw-theme='light'] .tcw-toggle.tcw-on::after {\r
  background: #fff;\r
}\r
\r
.tcw-settings-select {\r
  padding: 6px 10px;\r
  font-size: var(--tcw-font-size-sm);\r
  font-family: inherit;\r
  background: var(--tcw-bg-surface);\r
  border: 1px solid var(--tcw-border);\r
  border-radius: var(--tcw-input-radius);\r
  color: var(--tcw-text);\r
  cursor: pointer;\r
  transition: border-color var(--tcw-dur-fast) var(--tcw-ease);\r
}\r
\r
.tcw-settings-select:hover {\r
  border-color: var(--tcw-border-strong);\r
}\r
\r
.tcw-settings-select:focus-visible {\r
  outline: none;\r
  border-color: var(--tcw-accent);\r
  box-shadow: var(--tcw-ring);\r
}\r
\r
.tcw-modal-footer {\r
  display: flex;\r
  align-items: center;\r
  justify-content: space-between;\r
  padding: var(--tcw-space-5) var(--tcw-space-6);\r
  border-top: 1px solid var(--tcw-divider);\r
  background: var(--tcw-bg-surface);\r
  border-radius: 0 0 var(--tcw-dialog-radius) var(--tcw-dialog-radius);\r
}\r
\r
.tcw-reset-link {\r
  font-size: var(--tcw-font-size-sm);\r
  color: var(--tcw-text-muted);\r
  cursor: pointer;\r
  border: none;\r
  background: transparent;\r
  font-family: inherit;\r
  text-decoration: underline;\r
  text-underline-offset: 2px;\r
  text-decoration-color: var(--tcw-border-strong);\r
  transition: color var(--tcw-dur-fast) var(--tcw-ease), text-decoration-color var(--tcw-dur-fast) var(--tcw-ease);\r
}\r
\r
.tcw-reset-link:hover {\r
  color: var(--tcw-text-dim);\r
  text-decoration-color: currentColor;\r
}\r
\r
.tcw-done-btn {\r
  padding: var(--tcw-space-4) var(--tcw-space-6);\r
  font-size: var(--tcw-font-size);\r
  font-weight: var(--tcw-weight-strong);\r
  background: var(--tcw-accent);\r
  color: var(--tcw-accent-ink);\r
  border: none;\r
  border-radius: var(--tcw-control-radius);\r
  cursor: pointer;\r
  font-family: inherit;\r
  transition:\r
    background var(--tcw-dur-fast) var(--tcw-ease),\r
    transform var(--tcw-dur-fast) var(--tcw-ease),\r
    box-shadow var(--tcw-dur-fast) var(--tcw-ease);\r
  letter-spacing: -0.005em;\r
}\r
\r
.tcw-done-btn:hover {\r
  background: var(--tcw-accent-hover);\r
}\r
\r
.tcw-done-btn:active {\r
  transform: translateY(0.5px);\r
}\r
\r
/* === Status Bar === */\r
\r
.tcw-statusbar {\r
  /* Above sidebar buttons that overflow a short chart; menus (z 30+) stay on top. */\r
  position: relative;\r
  z-index: 1;\r
  display: flex;\r
  align-items: center;\r
  justify-content: space-between;\r
  padding: 7px 16px;\r
  border-top: 1px solid var(--tcw-border);\r
  background: var(--tcw-bg-surface);\r
  font-size: var(--tcw-font-size-xs);\r
  color: var(--tcw-text-muted);\r
  flex-shrink: 0;\r
  font-feature-settings: 'tnum';\r
}\r
\r
.tcw-status-right {\r
  display: flex;\r
  align-items: center;\r
  gap: 14px;\r
  margin-inline-start: auto;\r
  min-width: 0;\r
  white-space: nowrap;\r
}\r
\r
/* Narrow screens: the range presets close up. */\r
@media (max-width: 640px) {\r
  .tcw-range-btn {\r
    padding: 4px 5px;\r
  }\r
}\r
\r
/* Range presets + go to date, bottom left */\r
.tcw-range-bar {\r
  display: flex;\r
  align-items: center;\r
  gap: 1px;\r
  margin: -4px 12px -4px -8px;\r
  min-width: 0;\r
  overflow-x: auto;\r
  scrollbar-width: none;\r
}\r
\r
.tcw-range-bar::-webkit-scrollbar {\r
  display: none;\r
}\r
\r
.tcw-range-btn {\r
  flex-shrink: 0;\r
  padding: 4px 7px;\r
  font: inherit;\r
  font-weight: var(--tcw-weight-strong);\r
  letter-spacing: 0.02em;\r
  color: var(--tcw-text-muted);\r
  background: transparent;\r
  border: none;\r
  border-radius: var(--tcw-control-radius);\r
  cursor: pointer;\r
  transition: color var(--tcw-dur-fast) var(--tcw-ease), background var(--tcw-dur-fast) var(--tcw-ease);\r
}\r
\r
.tcw-range-btn:hover {\r
  color: var(--tcw-text);\r
  background: var(--tcw-hover-bg);\r
}\r
\r
.tcw-range-btn:active {\r
  color: var(--tcw-accent);\r
}\r
\r
.tcw-range-btn:focus-visible {\r
  outline: 2px solid var(--tcw-accent);\r
  outline-offset: -2px;\r
}\r
\r
.tcw-range-goto {\r
  display: inline-grid;\r
  place-items: center;\r
  margin-inline-start: 6px;\r
  padding: 4px 6px;\r
}\r
\r
.tcw-range-goto svg {\r
  display: block;\r
}\r
\r
/* Go-to-date popover, anchored above the range bar */\r
.tcw-goto {\r
  position: absolute;\r
  left: 10px;\r
  bottom: 40px;\r
  z-index: 40;\r
  display: grid;\r
  gap: 10px;\r
  width: 232px;\r
  padding: 14px;\r
  background: var(--tcw-bg-elevated);\r
  border: 1px solid var(--tcw-border);\r
  border-radius: var(--tcw-menu-radius);\r
  box-shadow: var(--tcw-menu-shadow);\r
  color: var(--tcw-text);\r
  font-size: var(--tcw-font-size-sm);\r
}\r
\r
.tcw-goto-title {\r
  font-weight: var(--tcw-weight-strong);\r
  font-size: var(--tcw-font-size);\r
}\r
\r
.tcw-goto-field {\r
  display: grid;\r
  gap: 4px;\r
  color: var(--tcw-text-muted);\r
  font-size: var(--tcw-font-size-xs);\r
}\r
\r
.tcw-goto-input {\r
  height: 30px;\r
  padding: 0 8px;\r
  font: inherit;\r
  font-size: var(--tcw-font-size-sm);\r
  color: var(--tcw-text);\r
  background: var(--tcw-bg);\r
  border: 1px solid var(--tcw-border);\r
  border-radius: var(--tcw-input-radius);\r
  color-scheme: dark;\r
}\r
\r
.tcw-root[data-tcw-theme='light'] .tcw-goto-input {\r
  color-scheme: light;\r
}\r
\r
.tcw-goto-input:focus {\r
  outline: none;\r
  border-color: var(--tcw-accent);\r
  box-shadow: 0 0 0 2px var(--tcw-accent-soft);\r
}\r
\r
.tcw-goto-actions {\r
  display: flex;\r
  justify-content: flex-end;\r
  gap: 6px;\r
}\r
\r
.tcw-goto-submit {\r
  background: var(--tcw-accent);\r
  color: var(--tcw-accent-ink);\r
  font-weight: var(--tcw-weight-strong);\r
}\r
\r
.tcw-goto-submit:hover {\r
  background: var(--tcw-accent);\r
  color: var(--tcw-accent-ink);\r
  filter: brightness(1.08);\r
}\r
\r
.tcw-status-indicator {\r
  display: flex;\r
  align-items: center;\r
  gap: 7px;\r
  font-weight: var(--tcw-weight);\r
}\r
\r
.tcw-status-dot {\r
  width: 7px;\r
  height: 7px;\r
  border-radius: 50%;\r
  background: var(--tcw-text-muted);\r
  transition: background var(--tcw-dur-normal) var(--tcw-ease), box-shadow var(--tcw-dur-normal) var(--tcw-ease);\r
  position: relative;\r
}\r
\r
.tcw-status-dot.tcw-connected {\r
  background: var(--tcw-green);\r
  box-shadow: 0 0 0 3px rgba(31, 168, 116, 0.18);\r
}\r
\r
.tcw-status-dot.tcw-connected::after {\r
  content: '';\r
  position: absolute;\r
  inset: -3px;\r
  border-radius: 50%;\r
  border: 2px solid var(--tcw-green);\r
  opacity: 0;\r
  animation: tcw-pulse 2.2s ease-out 3;\r
}\r
\r
@keyframes tcw-pulse {\r
  0% { opacity: 0.6; transform: scale(0.6); }\r
  100% { opacity: 0; transform: scale(2.2); }\r
}\r
\r
.tcw-status-dot.tcw-error {\r
  background: var(--tcw-red);\r
  box-shadow: 0 0 0 3px rgba(232, 80, 91, 0.2);\r
}\r
\r
/* === Command Palette === */\r
\r
.tcw-cmd-palette {\r
  position: fixed;\r
  z-index: 102;\r
  top: 18%;\r
  left: 50%;\r
  transform: translateX(-50%);\r
  background: var(--tcw-bg-elevated);\r
  border: var(--tcw-border-w) solid var(--tcw-border);\r
  border-radius: var(--tcw-dialog-radius);\r
  width: 560px;\r
  max-width: 92vw;\r
  max-height: 62vh;\r
  max-height: 62dvh;\r
  display: flex;\r
  flex-direction: column;\r
  box-shadow: var(--tcw-dialog-shadow);\r
  overflow: hidden;\r
  backdrop-filter: blur(var(--tcw-blur));\r
  -webkit-backdrop-filter: blur(var(--tcw-blur));\r
  animation: tcw-modal-in var(--tcw-dur-slow) var(--tcw-ease-out);\r
}\r
\r
.tcw-cmd-header {\r
  display: flex;\r
  align-items: center;\r
  padding: 14px 18px;\r
  border-bottom: 1px solid var(--tcw-divider);\r
  gap: 12px;\r
}\r
\r
.tcw-cmd-icon {\r
  color: var(--tcw-text-muted);\r
  flex-shrink: 0;\r
  display: inline-flex;\r
  align-items: center;\r
}\r
\r
.tcw-cmd-input {\r
  flex: 1;\r
  background: transparent;\r
  border: none;\r
  outline: none;\r
  font-size: var(--tcw-font-size-lg);\r
  font-family: inherit;\r
  color: var(--tcw-text);\r
  caret-color: var(--tcw-accent);\r
  letter-spacing: -0.005em;\r
}\r
\r
.tcw-cmd-input::placeholder {\r
  color: var(--tcw-text-muted);\r
}\r
\r
.tcw-cmd-hint {\r
  font-size: var(--tcw-font-size-xs);\r
  color: var(--tcw-text-muted);\r
  font-family: var(--tcw-font-mono);\r
  border: 1px solid var(--tcw-border);\r
  background: var(--tcw-bg-surface);\r
  padding: 3px 7px;\r
  border-radius: 4px;\r
  flex-shrink: 0;\r
  box-shadow: inset 0 -1px 0 var(--tcw-border);\r
}\r
\r
.tcw-cmd-list {\r
  overflow-y: auto;\r
  flex: 1;\r
  padding: 6px;\r
  max-height: 380px;\r
}\r
\r
.tcw-cmd-category {\r
  text-transform: var(--tcw-label-case);\r
  font-size: var(--tcw-font-size-xs);\r
  color: var(--tcw-text-muted);\r
  letter-spacing: var(--tcw-label-tracking);\r
  padding: 10px 10px 4px;\r
  font-weight: var(--tcw-weight-strong);\r
}\r
\r
.tcw-cmd-item {\r
  display: flex;\r
  align-items: center;\r
  justify-content: space-between;\r
  padding: 9px 12px;\r
  font-size: var(--tcw-font-size);\r
  color: var(--tcw-text-dim);\r
  cursor: pointer;\r
  width: 100%;\r
  border: none;\r
  background: transparent;\r
  font-family: inherit;\r
  text-align: start;\r
  transition: background var(--tcw-dur-fast) var(--tcw-ease), color var(--tcw-dur-fast) var(--tcw-ease);\r
  gap: 10px;\r
  border-radius: var(--tcw-radius);\r
  letter-spacing: -0.005em;\r
}\r
\r
.tcw-cmd-item:hover,\r
.tcw-cmd-item.tcw-selected {\r
  background: var(--tcw-hover-bg);\r
  color: var(--tcw-text);\r
}\r
\r
.tcw-cmd-item.tcw-selected {\r
  box-shadow: inset 2px 0 0 var(--tcw-accent);\r
}\r
\r
.tcw-cmd-item.tcw-active .tcw-cmd-item-label {\r
  color: var(--tcw-accent);\r
  font-weight: var(--tcw-weight-strong);\r
}\r
\r
.tcw-cmd-item-label {\r
  flex: 1;\r
}\r
\r
.tcw-cmd-check {\r
  display: inline-flex;\r
  color: var(--tcw-accent);\r
}\r
\r
.tcw-cmd-kbd {\r
  font-size: var(--tcw-font-size-xs);\r
  font-family: var(--tcw-font-mono);\r
  color: var(--tcw-text-muted);\r
  background: var(--tcw-bg-surface);\r
  border: 1px solid var(--tcw-border);\r
  padding: 2px 6px;\r
  border-radius: var(--tcw-tag-radius);\r
  box-shadow: inset 0 -1px 0 var(--tcw-border);\r
}\r
\r
.tcw-cmd-empty {\r
  padding: 32px 16px;\r
  text-align: center;\r
  color: var(--tcw-text-muted);\r
  font-size: var(--tcw-font-size);\r
}\r
\r
/* A key and what it does, in a list dialog's footer: keys in the shortcut chips (.tcw-cmd-kbd). */\r
.tcw-cmd-help {\r
  display: inline-flex;\r
  align-items: center;\r
  gap: 3px;\r
}\r
.tcw-cmd-help-text { margin-inline-start: 3px; }\r
.tcw-cmd-key {\r
  display: inline-flex;\r
  align-items: center;\r
  justify-content: center;\r
  min-width: 18px;\r
  font-style: normal;\r
}\r
\r
.tcw-cmd-footer {\r
  display: flex;\r
  align-items: center;\r
  gap: 18px;\r
  padding: 10px 18px;\r
  border-top: 1px solid var(--tcw-divider);\r
  font-size: var(--tcw-font-size-xs);\r
  color: var(--tcw-text-muted);\r
  background: var(--tcw-bg-surface);\r
}\r
\r
/* === Watchlist === */\r
\r
.tcw-watchlist {\r
  width: 220px;\r
  flex-shrink: 0;\r
  background: var(--tcw-bg-surface);\r
  border-inline-start: 1px solid var(--tcw-border);\r
  display: flex;\r
  flex-direction: column;\r
  overflow: hidden;\r
  box-shadow: var(--tcw-shadow-sm);\r
}\r
\r
/* TradingView-style edge rail: the chart keeps a small control even while\r
 * the watchlist is collapsed, so the panel can be restored without a menu. */\r
.tcw-watchlist-toggle {\r
  flex: 0 0 30px;\r
  width: 30px;\r
  min-width: 30px;\r
  align-self: stretch;\r
  display: grid;\r
  place-items: center;\r
  padding: 0;\r
  border: 0;\r
  border-inline-start: 1px solid var(--tcw-border);\r
  background: var(--tcw-bg-surface);\r
  color: var(--tcw-text-muted);\r
  cursor: pointer;\r
}\r
.tcw-watchlist-toggle:hover {\r
  background: var(--tcw-hover-bg);\r
  color: var(--tcw-text);\r
}\r
.tcw-watchlist-toggle:focus-visible {\r
  outline: none;\r
  box-shadow: var(--tcw-ring);\r
}\r
.tcw-watchlist-toggle svg {\r
  width: var(--tcw-icon);\r
  height: var(--tcw-icon);\r
}\r
\r
.tcw-watchlist-header {\r
  position: relative;\r
  display: flex;\r
  align-items: center;\r
  gap: 4px;\r
  padding: 6px 8px 6px 8px;\r
  border-bottom: 1px solid var(--tcw-divider);\r
}\r
\r
/* The shown list's name: opens the lists menu. */\r
.tcw-watchlist-name {\r
  flex: 1;\r
  min-width: 0;\r
  display: flex;\r
  align-items: center;\r
  gap: 6px;\r
  height: var(--tcw-control-h-sm);\r
  padding: 0 6px;\r
  border: 0;\r
  border-radius: var(--tcw-control-radius);\r
  background: transparent;\r
  color: var(--tcw-text-dim);\r
  font: inherit;\r
  font-size: var(--tcw-font-size-xs);\r
  font-weight: var(--tcw-weight-strong);\r
  text-transform: var(--tcw-label-case);\r
  letter-spacing: var(--tcw-label-tracking);\r
  text-align: start;\r
  white-space: nowrap;\r
  overflow: hidden;\r
  text-overflow: ellipsis;\r
  cursor: pointer;\r
}\r
.tcw-watchlist-name::after {\r
  content: '';\r
  flex: none;\r
  width: 0;\r
  height: 0;\r
  margin-inline-start: auto;\r
  border: 4px solid transparent;\r
  border-top-color: currentColor;\r
  border-bottom-width: 0;\r
  opacity: 0.7;\r
}\r
\r
.tcw-watchlist-add {\r
  flex: none;\r
  width: var(--tcw-control-h-sm);\r
  height: var(--tcw-control-h-sm);\r
  border: 0;\r
  border-radius: var(--tcw-control-radius);\r
  background: transparent;\r
  color: var(--tcw-text-muted);\r
  font: inherit;\r
  font-size: var(--tcw-font-size-lg);\r
  line-height: 1;\r
  cursor: pointer;\r
}\r
\r
.tcw-watchlist-name:hover,\r
.tcw-watchlist-add:hover {\r
  background: var(--tcw-hover-bg);\r
  color: var(--tcw-text);\r
}\r
.tcw-watchlist-name:focus-visible,\r
.tcw-watchlist-add:focus-visible,\r
.tcw-watchlist-input:focus-visible {\r
  outline: none;\r
  box-shadow: var(--tcw-ring);\r
}\r
\r
/* The lists menu, under the header. */\r
.tcw-watchlist-menu {\r
  top: calc(100% - 2px);\r
  left: 6px;\r
  right: 6px;\r
  margin-top: 0;\r
}\r
.tcw-watchlist-count {\r
  color: var(--tcw-text-muted);\r
  font-family: var(--tcw-font-mono);\r
  font-size: var(--tcw-font-size-xs);\r
}\r
.tcw-watchlist-menu .tcw-danger {\r
  color: var(--tcw-red);\r
}\r
\r
/* Naming a list in place. */\r
.tcw-watchlist-input {\r
  flex: 1;\r
  min-width: 0;\r
  height: var(--tcw-control-h-sm);\r
  padding: 0 8px;\r
  border: var(--tcw-border-w) solid var(--tcw-border-strong);\r
  border-radius: var(--tcw-input-radius);\r
  background: var(--tcw-bg);\r
  color: var(--tcw-text);\r
  font: inherit;\r
  font-size: var(--tcw-font-size-sm);\r
}\r
\r
.tcw-watchlist-empty {\r
  padding: 16px 14px;\r
  color: var(--tcw-text-muted);\r
  font-size: var(--tcw-font-size-sm);\r
  line-height: 1.5;\r
}\r
\r
/* A row's remove button shows on hover or focus, over its numbers. */\r
.tcw-watchlist-remove {\r
  position: absolute;\r
  top: 50%;\r
  right: 6px;\r
  display: grid;\r
  place-items: center;\r
  width: 20px;\r
  height: 20px;\r
  border: 0;\r
  border-radius: var(--tcw-radius-sm);\r
  background: var(--tcw-bg-elevated);\r
  color: var(--tcw-text-muted);\r
  font: inherit;\r
  font-size: var(--tcw-font-size);\r
  line-height: 1;\r
  opacity: 0;\r
  transform: translateY(-50%);\r
  cursor: pointer;\r
  transition: opacity var(--tcw-dur-fast) var(--tcw-ease);\r
}\r
.tcw-watchlist-row:hover .tcw-watchlist-remove,\r
.tcw-watchlist-row:focus-within .tcw-watchlist-remove {\r
  opacity: 1;\r
}\r
.tcw-watchlist-remove:hover {\r
  color: var(--tcw-red);\r
}\r
.tcw-watchlist-row.tcw-watchlist-dragging {\r
  opacity: 0.45;\r
}\r
\r
.tcw-watchlist-list {\r
  flex: 1;\r
  overflow-y: auto;\r
  padding: 4px 0;\r
}\r
\r
.tcw-watchlist-row {\r
  position: relative;\r
  display: grid;\r
  grid-template-columns: 1fr auto auto;\r
  align-items: center;\r
  gap: 8px;\r
  padding: 8px 12px;\r
  cursor: pointer;\r
  transition: background var(--tcw-dur-fast) var(--tcw-ease);\r
  border-inline-start: 2px solid transparent;\r
  outline: none;\r
}\r
\r
.tcw-watchlist-row:hover {\r
  background: var(--tcw-hover-bg);\r
}\r
\r
.tcw-watchlist-row:focus-visible {\r
  background: var(--tcw-hover-bg);\r
  border-inline-start-color: var(--tcw-accent);\r
}\r
\r
.tcw-watchlist-row.tcw-watchlist-active {\r
  background: var(--tcw-accent-soft);\r
  border-inline-start-color: var(--tcw-accent);\r
}\r
\r
.tcw-watchlist-symbol {\r
  font-size: var(--tcw-font-size-sm);\r
  font-weight: var(--tcw-weight-strong);\r
  color: var(--tcw-text);\r
  letter-spacing: -0.005em;\r
  white-space: nowrap;\r
}\r
\r
.tcw-watchlist-spark {\r
  width: 56px;\r
  height: 22px;\r
  align-self: center;\r
}\r
\r
.tcw-watchlist-stats {\r
  display: flex;\r
  flex-direction: column;\r
  align-items: flex-end;\r
  gap: 1px;\r
  font-variant-numeric: tabular-nums;\r
  font-family: var(--tcw-font-mono);\r
}\r
\r
.tcw-watchlist-price {\r
  font-size: var(--tcw-font-size-sm);\r
  color: var(--tcw-text);\r
  font-weight: var(--tcw-weight);\r
}\r
\r
.tcw-watchlist-change {\r
  font-size: var(--tcw-font-size-xs);\r
  color: var(--tcw-text-muted);\r
  font-weight: var(--tcw-weight);\r
}\r
\r
.tcw-watchlist-change.tcw-up {\r
  color: var(--tcw-green);\r
}\r
\r
.tcw-watchlist-change.tcw-down {\r
  color: var(--tcw-red);\r
}\r
\r
@media (max-width: 768px) {\r
  .tcw-watchlist,\r
  .tcw-watchlist-toggle {\r
    display: none;\r
  }\r
}\r
\r
/* === Toast === */\r
\r
.tcw-toast-icon {\r
  display: inline-flex;\r
  vertical-align: -2px;\r
  margin-inline-end: 7px;\r
  color: var(--tcw-accent);\r
}\r
.tcw-toast-error .tcw-toast-icon { color: var(--tcw-red); }\r
\r
/* Over an open dialog: above its backdrop, at the window's foot. */\r
.tcw-toast.tcw-toast-over {\r
  position: fixed;\r
  z-index: 120;\r
}\r
\r
.tcw-toast {\r
  position: absolute;\r
  bottom: 60px;\r
  left: 50%;\r
  transform: translate(-50%, 12px);\r
  z-index: 40;\r
  padding: var(--tcw-space-4) var(--tcw-space-5);\r
  background: var(--tcw-bg-elevated);\r
  border: 1px solid var(--tcw-border-strong);\r
  border-radius: var(--tcw-toast-radius);\r
  box-shadow: var(--tcw-menu-shadow);\r
  font-size: var(--tcw-font-size-sm);\r
  font-weight: var(--tcw-weight);\r
  color: var(--tcw-text);\r
  opacity: 0;\r
  transition: opacity var(--tcw-dur-normal) var(--tcw-ease-out), transform var(--tcw-dur-normal) var(--tcw-ease-out);\r
  pointer-events: none;\r
  max-width: calc(100% - 32px);\r
  white-space: nowrap;\r
  overflow: hidden;\r
  text-overflow: ellipsis;\r
  letter-spacing: -0.005em;\r
}\r
\r
.tcw-toast.tcw-toast-in {\r
  opacity: 1;\r
  transform: translate(-50%, 0);\r
}\r
\r
.tcw-toast-error {\r
  border-color: var(--tcw-red);\r
  color: var(--tcw-red);\r
}\r
\r
/* === Replay scrubber === */\r
\r
/* Picking the replay start: the bars right of the pointer would be hidden. */\r
.tcw-replay-shade {\r
  position: absolute;\r
  z-index: 4;\r
  pointer-events: none;\r
  background: color-mix(in srgb, var(--tcw-bg) 62%, transparent);\r
  border-inline-start: 1.5px dashed var(--tcw-accent);\r
}\r
\r
.tcw-replay-group {\r
  display: inline-flex;\r
  align-items: center;\r
  gap: 6px;\r
}\r
\r
.tcw-replay-group[hidden] { display: none; }\r
\r
.tcw-replay-hint {\r
  display: inline-flex;\r
  align-items: center;\r
  gap: 6px;\r
  padding: 0 4px;\r
  color: var(--tcw-text-dim);\r
  white-space: nowrap;\r
}\r
\r
.tcw-replay-text-btn {\r
  height: 26px;\r
  padding: 0 10px;\r
  border: 1px solid var(--tcw-border);\r
  border-radius: var(--tcw-control-radius);\r
  background: transparent;\r
  color: var(--tcw-text);\r
  font: inherit;\r
  font-weight: var(--tcw-weight);\r
  white-space: nowrap;\r
  cursor: pointer;\r
  transition: background var(--tcw-dur-fast), border-color var(--tcw-dur-fast), color var(--tcw-dur-fast);\r
}\r
\r
.tcw-replay-text-btn:hover { background: var(--tcw-hover-bg); border-color: var(--tcw-border-strong); }\r
.tcw-replay-text-btn:focus-visible { outline: none; box-shadow: var(--tcw-ring); }\r
\r
/* At the last bar: the way out is the next thing to do. */\r
.tcw-replay-bar--ended .tcw-replay-realtime {\r
  background: var(--tcw-accent);\r
  border-color: var(--tcw-accent);\r
  color: var(--tcw-accent-ink);\r
}\r
\r
.tcw-replay-btn:disabled { opacity: 0.4; cursor: default; }\r
\r
@media (max-width: 640px) {\r
  .tcw-replay-bar {\r
    flex-wrap: wrap;\r
    justify-content: center;\r
    max-width: calc(100% - 24px);\r
    border-radius: var(--tcw-panel-radius);\r
  }\r
  .tcw-replay-hint { white-space: normal; }\r
}\r
\r
.tcw-replay-bar {\r
  position: absolute;\r
  left: 50%;\r
  /* Above the 30px time axis, so its dates stay readable. */\r
  bottom: 40px;\r
  transform: translateX(-50%);\r
  z-index: 25;\r
  display: flex;\r
  align-items: center;\r
  gap: 6px;\r
  padding: 6px 10px;\r
  background: var(--tcw-bg-elevated);\r
  border: 1px solid var(--tcw-border);\r
  border-radius: var(--tcw-panel-radius);\r
  box-shadow: var(--tcw-menu-shadow);\r
  backdrop-filter: blur(var(--tcw-blur));\r
  -webkit-backdrop-filter: blur(var(--tcw-blur));\r
  font-size: var(--tcw-font-size-sm);\r
  color: var(--tcw-text);\r
  animation: tcw-pop-in var(--tcw-dur-normal) var(--tcw-ease-out);\r
}\r
\r
.tcw-replay-btn {\r
  width: 28px;\r
  height: 28px;\r
  display: inline-flex;\r
  align-items: center;\r
  justify-content: center;\r
  border: none;\r
  background: transparent;\r
  color: var(--tcw-text-dim);\r
  border-radius: var(--tcw-control-radius);\r
  cursor: pointer;\r
  font-family: inherit;\r
  transition: background var(--tcw-dur-fast) var(--tcw-ease), color var(--tcw-dur-fast) var(--tcw-ease);\r
}\r
\r
.tcw-replay-btn:hover {\r
  background: var(--tcw-hover-bg);\r
  color: var(--tcw-text);\r
}\r
\r
.tcw-replay-btn.tcw-replay-play {\r
  background: var(--tcw-accent);\r
  color: var(--tcw-accent-ink);\r
  width: 32px;\r
  height: 32px;\r
  box-shadow: 0 0 0 3px var(--tcw-accent-glow);\r
}\r
\r
.tcw-replay-btn.tcw-replay-play:hover {\r
  background: var(--tcw-accent-hover);\r
}\r
\r
.tcw-replay-scrubber {\r
  appearance: none;\r
  -webkit-appearance: none;\r
  width: 220px;\r
  height: 4px;\r
  background: var(--tcw-border-strong);\r
  border-radius: 2px;\r
  outline: none;\r
  cursor: pointer;\r
}\r
\r
.tcw-replay-scrubber::-webkit-slider-thumb {\r
  -webkit-appearance: none;\r
  appearance: none;\r
  width: 14px;\r
  height: 14px;\r
  border-radius: 50%;\r
  background: var(--tcw-accent);\r
  border: 2px solid var(--tcw-bg-elevated);\r
  box-shadow: 0 0 0 1px var(--tcw-accent), 0 2px 6px rgba(0, 0, 0, 0.3);\r
  cursor: pointer;\r
}\r
\r
.tcw-replay-scrubber::-moz-range-thumb {\r
  width: 14px;\r
  height: 14px;\r
  border-radius: 50%;\r
  background: var(--tcw-accent);\r
  border: 2px solid var(--tcw-bg-elevated);\r
  box-shadow: 0 0 0 1px var(--tcw-accent), 0 2px 6px rgba(0, 0, 0, 0.3);\r
  cursor: pointer;\r
}\r
\r
.tcw-replay-progress {\r
  font-size: var(--tcw-font-size-xs);\r
  font-family: var(--tcw-font-mono);\r
  color: var(--tcw-text-muted);\r
  min-width: 64px;\r
  text-align: center;\r
  font-feature-settings: 'tnum';\r
}\r
\r
.tcw-replay-speed {\r
  padding: 4px 8px;\r
  font-size: var(--tcw-font-size-xs);\r
  font-family: var(--tcw-font-mono);\r
  background: var(--tcw-bg-surface);\r
  border: 1px solid var(--tcw-border);\r
  border-radius: var(--tcw-control-radius);\r
  color: var(--tcw-text-dim);\r
  cursor: pointer;\r
}\r
\r
.tcw-replay-speed:hover {\r
  border-color: var(--tcw-border-strong);\r
}\r
\r
@media (max-width: 640px) {\r
  .tcw-replay-scrubber {\r
    width: 140px;\r
  }\r
  .tcw-replay-progress {\r
    display: none;\r
  }\r
}\r
\r
/* === Hotkey sheet === */\r
\r
.tcw-hotkey-grid {\r
  display: grid;\r
  grid-template-columns: 1fr 1fr;\r
  gap: 24px 32px;\r
}\r
\r
.tcw-hotkey-section .tcw-settings-section-title {\r
  margin-bottom: 8px;\r
}\r
\r
.tcw-hotkey-row {\r
  display: flex;\r
  align-items: center;\r
  justify-content: space-between;\r
  gap: 12px;\r
  padding: 6px 0;\r
  border-bottom: 1px solid var(--tcw-divider);\r
}\r
\r
.tcw-hotkey-row:last-child {\r
  border-bottom: none;\r
}\r
\r
.tcw-hotkey-keys {\r
  display: flex;\r
  align-items: center;\r
  gap: 4px;\r
  flex-shrink: 0;\r
}\r
\r
.tcw-hotkey-sep {\r
  font-size: var(--tcw-font-size-xs);\r
  color: var(--tcw-text-muted);\r
}\r
\r
.tcw-hotkey-label {\r
  font-size: var(--tcw-font-size-sm);\r
  color: var(--tcw-text-dim);\r
  text-align: end;\r
  letter-spacing: -0.005em;\r
}\r
\r
@media (max-width: 640px) {\r
  .tcw-hotkey-grid {\r
    grid-template-columns: 1fr;\r
    gap: 18px;\r
  }\r
}\r
\r
\r
/* === Responsive === */\r
\r
@media (max-width: 768px) {\r
  .tcw-toolbar {\r
    padding: 0 4px;\r
    height: max(44px, var(--tcw-toolbar-h));   /* Apple HIG minimum touch target */\r
  }\r
  .tcw-toolbar-sep {\r
    display: none;\r
  }\r
  .tcw-btn,\r
  .tcw-dropdown-trigger {\r
    height: max(40px, var(--tcw-control-h));   /* fatter tap target */\r
    padding: 0 12px;\r
    font-size: var(--tcw-font-size);\r
  }\r
  .tcw-btn-icon {\r
    width: max(40px, var(--tcw-control-h));\r
    height: max(40px, var(--tcw-control-h));\r
  }\r
  .tcw-sidebar {\r
    width: max(44px, var(--tcw-sidebar-w));\r
  }\r
  .tcw-sidebar-btn {\r
    width: max(40px, var(--tcw-control-h));\r
    height: max(40px, var(--tcw-control-h));\r
  }\r
  .tcw-modal,\r
  .tcw-cmd-palette {\r
    width: 94vw;\r
    border-radius: var(--tcw-dialog-radius);\r
  }\r
\r
  /* Hide the right-side watchlist on tablets too — already declared but\r
   * grouped here for clarity. */\r
  .tcw-watchlist {\r
    display: none;\r
  }\r
\r
  /* Replay scrubber compact mode */\r
  .tcw-replay-scrubber {\r
    width: 120px;\r
  }\r
  .tcw-replay-progress {\r
    display: none;\r
  }\r
}\r
\r
/* === Mobile bottom-sheet pattern ===\r
 * On phones, swap floating-centered modals for full-width sheets that slide\r
 * up from the bottom. Bigger hit targets, no awkward off-screen clipping,\r
 * matches how every modern iOS/Android app handles overflow UI.\r
 */\r
@media (max-width: 640px) {\r
  .tcw-modal,\r
  .tcw-cmd-palette {\r
    top: auto;\r
    /* Above the on-screen keyboard (the widget sets it from visualViewport). */\r
    bottom: var(--tcw-keyboard-inset, 0px);\r
    padding-left: env(safe-area-inset-left, 0px);\r
    padding-right: env(safe-area-inset-right, 0px);\r
    left: 0;\r
    right: 0;\r
    transform: none;\r
    /* The border and the safe-area padding inside the screen's width. */\r
    box-sizing: border-box;\r
    width: 100vw;\r
    max-width: 100vw;\r
    max-height: 92vh;\r
    max-height: 92dvh;\r
    border-radius: var(--tcw-dialog-radius) var(--tcw-dialog-radius) 0 0;\r
    border-bottom: none;\r
    /* Grab handle */\r
    padding-top: 8px;\r
  }\r
\r
  /* Visual "grab handle" affordance — a short pill at the top of every sheet */\r
  .tcw-modal::before,\r
  .tcw-cmd-palette::before {\r
    content: '';\r
    display: block;\r
    width: 36px;\r
    height: 4px;\r
    border-radius: 2px;\r
    background: var(--tcw-border-strong);\r
    margin: 0 auto 8px;\r
    opacity: 0.7;\r
  }\r
\r
  /* Reuse the existing modal-in animation but slide from below instead of\r
   * popping from center, so the entrance reads as a sheet, not a dialog. */\r
  @keyframes tcw-modal-in {\r
    from { opacity: 0; transform: translateY(20px); }\r
    to { opacity: 1; transform: translateY(0); }\r
  }\r
\r
  .tcw-modal,\r
  .tcw-cmd-palette {\r
    animation: tcw-modal-in var(--tcw-dur-slow) var(--tcw-ease-out);\r
  }\r
\r
  /* Safe-area-aware footer padding for iPhone notch / home indicator */\r
  .tcw-modal-footer,\r
  .tcw-cmd-footer {\r
    padding-bottom: max(14px, env(safe-area-inset-bottom));\r
  }\r
\r
  /* Larger tap targets inside sheets: taller, not more padding, so a tab's text stays inside its chip. */\r
  .tcw-modal-tab {\r
    min-height: 40px;\r
    padding-inline: 16px;\r
  }\r
  .tcw-cmd-item {\r
    padding: 12px 14px;\r
    font-size: var(--tcw-font-size-lg);\r
  }\r
  .tcw-dropdown-item {\r
    padding: 12px 12px;\r
    font-size: var(--tcw-font-size-lg);\r
  }\r
\r
  /* Hotkey sheet — single column on phones */\r
  .tcw-hotkey-grid {\r
    grid-template-columns: 1fr;\r
  }\r
}\r
\r
/* === Price alerts panel === */\r
\r
.tcw-alerts-panel {\r
  position: absolute;\r
  top: var(--tcw-panel-top);\r
  inset-inline-end: 12px;\r
  z-index: 40;\r
  width: 300px;\r
  max-width: calc(100vw - 24px);\r
  display: flex;\r
  flex-direction: column;\r
  background: var(--tcw-bg-elevated);\r
  border: var(--tcw-border-w) solid var(--tcw-border-strong);\r
  border-radius: var(--tcw-panel-radius);\r
  box-shadow: var(--tcw-menu-shadow);\r
  overflow: hidden;\r
  animation: tcw-alerts-in var(--tcw-dur, 160ms) var(--tcw-ease, ease) both;\r
}\r
\r
@keyframes tcw-alerts-in {\r
  from { opacity: 0; transform: translateY(-6px) scale(0.98); }\r
  to { opacity: 1; transform: none; }\r
}\r
\r
.tcw-alerts-header {\r
  display: flex;\r
  align-items: center;\r
  justify-content: space-between;\r
  padding: 10px 12px;\r
  font-weight: var(--tcw-weight-strong);\r
  font-size: var(--tcw-font-size);\r
  color: var(--tcw-text);\r
  border-bottom: 1px solid var(--tcw-border);\r
}\r
\r
.tcw-alerts-close {\r
  display: inline-flex;\r
  align-items: center;\r
  justify-content: center;\r
  width: var(--tcw-control-h-sm);\r
  height: var(--tcw-control-h-sm);\r
  border: none;\r
  background: transparent;\r
  color: var(--tcw-text-muted);\r
  border-radius: var(--tcw-control-radius);\r
  cursor: pointer;\r
}\r
.tcw-alerts-close:hover {\r
  background: var(--tcw-bg-surface);\r
  color: var(--tcw-text);\r
}\r
\r
.tcw-alerts-form {\r
  display: grid;\r
  grid-template-columns: 1fr 1fr;\r
  gap: 8px;\r
  padding: 12px;\r
  border-bottom: 1px solid var(--tcw-border);\r
}\r
\r
.tcw-alerts-form input,\r
.tcw-alerts-form select {\r
  width: 100%;\r
  min-width: 0;\r
  box-sizing: border-box;\r
  height: 32px;\r
  padding: 0 8px;\r
  font-size: var(--tcw-font-size-sm);\r
  color: var(--tcw-text);\r
  background: var(--tcw-bg-surface);\r
  border: 1px solid var(--tcw-border);\r
  border-radius: var(--tcw-radius-sm);\r
  outline: none;\r
}\r
.tcw-alerts-form input:focus,\r
.tcw-alerts-form select:focus {\r
  border-color: var(--tcw-accent);\r
  box-shadow: 0 0 0 2px var(--tcw-accent-soft);\r
}\r
.tcw-alerts-message,\r
.tcw-alerts-source {\r
  grid-column: 1 / -1;\r
}\r
\r
.tcw-alerts-add {\r
  grid-column: 1 / -1;\r
  display: inline-flex;\r
  align-items: center;\r
  justify-content: center;\r
  gap: 6px;\r
  height: 34px;\r
  font-size: var(--tcw-font-size-sm);\r
  font-weight: var(--tcw-weight-strong);\r
  color: var(--tcw-accent-ink);\r
  background: var(--tcw-accent);\r
  border: none;\r
  border-radius: var(--tcw-control-radius);\r
  cursor: pointer;\r
}\r
.tcw-alerts-add:hover {\r
  background: var(--tcw-accent-hover);\r
}\r
\r
.tcw-alerts-list {\r
  max-height: 260px;\r
  overflow-y: auto;\r
  padding: 6px;\r
}\r
\r
.tcw-alerts-empty {\r
  padding: 18px 12px;\r
  text-align: center;\r
  font-size: var(--tcw-font-size-sm);\r
  color: var(--tcw-text-muted);\r
  line-height: 1.5;\r
}\r
\r
.tcw-alerts-row {\r
  display: flex;\r
  align-items: center;\r
  justify-content: space-between;\r
  gap: 8px;\r
  padding: 8px 8px;\r
  border-radius: var(--tcw-radius-sm);\r
}\r
.tcw-alerts-row:hover {\r
  background: var(--tcw-bg-surface);\r
}\r
.tcw-alerts-triggered {\r
  background: var(--tcw-accent-soft);\r
}\r
\r
.tcw-alerts-info {\r
  min-width: 0;\r
}\r
.tcw-alerts-row-main {\r
  display: flex;\r
  align-items: center;\r
  gap: 8px;\r
  font-size: var(--tcw-font-size-sm);\r
  font-weight: var(--tcw-weight-strong);\r
  color: var(--tcw-text);\r
  font-variant-numeric: tabular-nums;\r
}\r
.tcw-alerts-row-note {\r
  margin-top: 2px;\r
  font-size: var(--tcw-font-size-xs);\r
  color: var(--tcw-text-muted);\r
  overflow: hidden;\r
  text-overflow: ellipsis;\r
  white-space: nowrap;\r
}\r
.tcw-alerts-badge {\r
  font-size: var(--tcw-font-size-xs);\r
  font-weight: calc(var(--tcw-weight-strong) + 100);\r
  text-transform: var(--tcw-label-case);\r
  letter-spacing: var(--tcw-label-tracking);\r
  padding: 2px 5px;\r
  border-radius: var(--tcw-tag-radius);\r
  color: var(--tcw-accent);\r
  background: var(--tcw-accent-soft);\r
}\r
\r
.tcw-alerts-del {\r
  flex-shrink: 0;\r
  display: inline-flex;\r
  align-items: center;\r
  justify-content: center;\r
  width: var(--tcw-control-h-sm);\r
  height: var(--tcw-control-h-sm);\r
  border: none;\r
  background: transparent;\r
  color: var(--tcw-text-muted);\r
  border-radius: var(--tcw-control-radius);\r
  cursor: pointer;\r
}\r
.tcw-alerts-del:hover {\r
  background: var(--tcw-red-soft);\r
  color: var(--tcw-red);\r
}\r
\r
@media (max-width: 640px) {\r
  .tcw-alerts-panel {\r
    top: auto;\r
    bottom: 0;\r
    left: 0;\r
    right: 0;\r
    width: 100vw;\r
    max-width: 100vw;\r
    border-radius: var(--tcw-radius-xl) var(--tcw-radius-xl) 0 0;\r
  }\r
  .tcw-alerts-list {\r
    max-height: 40vh;\r
    max-height: 40dvh;\r
    padding-bottom: max(8px, env(safe-area-inset-bottom));\r
  }\r
}\r
\r
/* === Data Window === */\r
\r
.tcw-datawin {\r
  position: absolute;\r
  top: var(--tcw-panel-top);\r
  inset-inline-end: 12px;\r
  z-index: 38;\r
  width: 200px;\r
  display: flex;\r
  flex-direction: column;\r
  background: var(--tcw-bg-elevated);\r
  border: 1px solid var(--tcw-border-strong);\r
  border-radius: var(--tcw-panel-radius);\r
  box-shadow: var(--tcw-menu-shadow);\r
  overflow: hidden;\r
  animation: tcw-alerts-in var(--tcw-dur, 160ms) var(--tcw-ease, ease) both;\r
}\r
.tcw-datawin-header {\r
  display: flex;\r
  align-items: center;\r
  justify-content: space-between;\r
  padding: 9px 12px;\r
  font-size: var(--tcw-font-size-sm);\r
  font-weight: var(--tcw-weight-strong);\r
  color: var(--tcw-text);\r
  border-bottom: 1px solid var(--tcw-border);\r
}\r
.tcw-datawin-close {\r
  display: inline-flex;\r
  align-items: center;\r
  justify-content: center;\r
  width: var(--tcw-control-h-sm);\r
  height: var(--tcw-control-h-sm);\r
  border: none;\r
  background: transparent;\r
  color: var(--tcw-text-muted);\r
  border-radius: var(--tcw-control-radius);\r
  cursor: pointer;\r
}\r
.tcw-datawin-close:hover { background: var(--tcw-bg-surface); color: var(--tcw-text); }\r
.tcw-datawin-body { padding: 6px 4px; max-height: 360px; overflow-y: auto; }\r
.tcw-datawin-empty { padding: 14px; text-align: center; font-size: var(--tcw-font-size-sm); color: var(--tcw-text-muted); }\r
.tcw-datawin-row {\r
  display: flex;\r
  align-items: center;\r
  justify-content: space-between;\r
  gap: 10px;\r
  padding: 3px 8px;\r
  font-size: var(--tcw-font-size-sm);\r
}\r
.tcw-datawin-label { color: var(--tcw-text-muted); }\r
.tcw-datawin-value { color: var(--tcw-text); font-variant-numeric: tabular-nums; font-weight: var(--tcw-weight-strong); }\r
.tcw-datawin-value.tcw-up { color: var(--tcw-green); }\r
.tcw-datawin-value.tcw-down { color: var(--tcw-red); }\r
.tcw-datawin-sub {\r
  margin: 6px 8px 2px;\r
  font-size: var(--tcw-font-size-xs);\r
  font-weight: calc(var(--tcw-weight-strong) + 100);\r
  text-transform: var(--tcw-label-case);\r
  letter-spacing: var(--tcw-label-tracking);\r
  color: var(--tcw-text-muted);\r
  border-top: 1px solid var(--tcw-border);\r
  padding-top: 6px;\r
}\r
\r
@media (max-width: 640px) {\r
  .tcw-datawin { top: auto; bottom: 0; left: 0; right: 0; width: 100vw; border-radius: var(--tcw-radius-xl) var(--tcw-radius-xl) 0 0; }\r
}\r
\r
/* === Depth-of-market ladder === */\r
\r
.tcw-ladder {\r
  position: absolute;\r
  top: var(--tcw-panel-top);\r
  inset-inline-end: 12px;\r
  z-index: 41;\r
  width: 240px;\r
  display: flex;\r
  flex-direction: column;\r
  background: var(--tcw-bg-elevated);\r
  border: 1px solid var(--tcw-border-strong);\r
  border-radius: var(--tcw-panel-radius);\r
  box-shadow: var(--tcw-menu-shadow);\r
  overflow: hidden;\r
  animation: tcw-alerts-in var(--tcw-dur, 160ms) var(--tcw-ease, ease) both;\r
}\r
.tcw-ladder-header {\r
  display: flex;\r
  align-items: center;\r
  justify-content: space-between;\r
  padding: 10px 12px;\r
  font-size: var(--tcw-font-size);\r
  font-weight: var(--tcw-weight-strong);\r
  color: var(--tcw-text);\r
  border-bottom: 1px solid var(--tcw-border);\r
}\r
.tcw-ladder-close {\r
  display: inline-flex;\r
  align-items: center;\r
  justify-content: center;\r
  width: var(--tcw-control-h-sm);\r
  height: var(--tcw-control-h-sm);\r
  border: none;\r
  background: transparent;\r
  color: var(--tcw-text-muted);\r
  border-radius: var(--tcw-control-radius);\r
  cursor: pointer;\r
}\r
.tcw-ladder-close:hover { background: var(--tcw-bg-surface); color: var(--tcw-text); }\r
.tcw-ladder-cols {\r
  display: grid;\r
  grid-template-columns: 1fr 1fr 1fr;\r
  padding: 4px 0;\r
  font-size: var(--tcw-font-size-xs);\r
  font-weight: calc(var(--tcw-weight-strong) + 100);\r
  text-transform: var(--tcw-label-case);\r
  letter-spacing: var(--tcw-label-tracking);\r
  color: var(--tcw-text-muted);\r
  border-bottom: 1px solid var(--tcw-border);\r
}\r
.tcw-ladder-cols span { text-align: center; }\r
.tcw-ladder-body { max-height: 360px; overflow-y: auto; }\r
.tcw-ladder-empty { padding: 18px; text-align: center; font-size: var(--tcw-font-size-sm); color: var(--tcw-text-muted); }\r
\r
.tcw-ladder-row {\r
  display: grid;\r
  grid-template-columns: 1fr 1fr 1fr;\r
  height: 22px;\r
  font-variant-numeric: tabular-nums;\r
}\r
.tcw-ladder-cell {\r
  position: relative;\r
  display: flex;\r
  align-items: center;\r
  border: none;\r
  background: transparent;\r
  font-size: var(--tcw-font-size-xs);\r
  cursor: pointer;\r
  font-variant-numeric: tabular-nums;\r
  overflow: hidden;\r
}\r
.tcw-ladder-cell:disabled { cursor: default; }\r
/* Depth bar grows from the centre column outward. */\r
.tcw-ladder-cell::before {\r
  content: '';\r
  position: absolute;\r
  top: 1px; bottom: 1px;\r
  width: var(--w, 0%);\r
}\r
.tcw-ladder-bid { justify-content: flex-end; padding-right: 8px; color: var(--tcw-green); }\r
.tcw-ladder-bid::before { right: 0; background: var(--tcw-green-soft); }\r
.tcw-ladder-bid span, .tcw-ladder-bid { position: relative; }\r
.tcw-ladder-ask { justify-content: flex-start; padding-left: 8px; color: var(--tcw-red); }\r
.tcw-ladder-ask::before { left: 0; background: var(--tcw-red-soft); }\r
.tcw-ladder-cell:not(:disabled):hover::before { opacity: 0.7; filter: brightness(1.4); }\r
.tcw-ladder-cell > * { position: relative; }\r
.tcw-ladder-price {\r
  display: flex;\r
  align-items: center;\r
  justify-content: center;\r
  font-size: var(--tcw-font-size-xs);\r
  font-weight: var(--tcw-weight-strong);\r
  color: var(--tcw-text-dim);\r
  border-inline-start: 1px solid var(--tcw-border);\r
  border-inline-end: 1px solid var(--tcw-border);\r
}\r
.tcw-ladder-price.tcw-ask { color: var(--tcw-red); }\r
.tcw-ladder-price.tcw-bid { color: var(--tcw-green); }\r
\r
@media (max-width: 640px) {\r
  .tcw-ladder { top: auto; bottom: 0; left: 0; right: 0; width: 100vw; border-radius: var(--tcw-radius-xl) var(--tcw-radius-xl) 0 0; }\r
  .tcw-ladder-body { max-height: 45vh; max-height: 45dvh; padding-bottom: max(0px, env(safe-area-inset-bottom)); }\r
}\r
\r
/* === Bracket order placement === */\r
\r
.tcw-btn-long:hover { color: var(--tcw-green) !important; }\r
.tcw-btn-short:hover { color: var(--tcw-red) !important; }\r
\r
.tcw-bracket-bar {\r
  position: absolute;\r
  top: calc(var(--tcw-panel-top) + 2px);\r
  left: 50%;\r
  transform: translateX(-50%);\r
  z-index: 45;\r
  display: flex;\r
  align-items: center;\r
  gap: 10px;\r
  padding: 7px 8px 7px 14px;\r
  background: var(--tcw-bg-elevated);\r
  border: 1px solid var(--tcw-border-strong);\r
  border-radius: var(--tcw-panel-radius);\r
  box-shadow: var(--tcw-menu-shadow);\r
  animation: tcw-alerts-in var(--tcw-dur, 160ms) var(--tcw-ease, ease) both;\r
}\r
.tcw-bracket-label {\r
  font-size: var(--tcw-font-size-sm);\r
  font-weight: calc(var(--tcw-weight-strong) + 100);\r
}\r
.tcw-bracket-label[data-side='buy'] { color: var(--tcw-green); }\r
.tcw-bracket-label[data-side='sell'] { color: var(--tcw-red); }\r
.tcw-bracket-hint {\r
  font-size: var(--tcw-font-size-xs);\r
  color: var(--tcw-text-muted);\r
}\r
.tcw-bracket-cancel, .tcw-bracket-confirm {\r
  display: inline-flex;\r
  align-items: center;\r
  gap: 5px;\r
  height: 30px;\r
  padding: 0 12px;\r
  font-size: var(--tcw-font-size-sm);\r
  font-weight: var(--tcw-weight-strong);\r
  border: none;\r
  border-radius: var(--tcw-control-radius);\r
  cursor: pointer;\r
}\r
.tcw-bracket-cancel {\r
  color: var(--tcw-text-dim);\r
  background: var(--tcw-bg-surface);\r
}\r
.tcw-bracket-cancel:hover { color: var(--tcw-text); }\r
.tcw-bracket-confirm {\r
  color: var(--tcw-accent-ink);\r
  background: var(--tcw-accent);\r
}\r
.tcw-bracket-confirm:hover { background: var(--tcw-accent-hover); }\r
\r
@media (max-width: 640px) {\r
  .tcw-bracket-bar { width: calc(100vw - 24px); justify-content: space-between; }\r
  .tcw-bracket-hint { display: none; }\r
}\r
\r
/* === Drawing style + templates popover === */\r
\r
.tcw-style-panel {\r
  position: absolute;\r
  bottom: 12px;\r
  inset-inline-start: var(--tcw-panel-left);\r
  z-index: 40;\r
  width: 220px;\r
  display: flex;\r
  flex-direction: column;\r
  gap: 8px;\r
  padding: 12px;\r
  background: var(--tcw-bg-elevated);\r
  border: 1px solid var(--tcw-border-strong);\r
  border-radius: var(--tcw-panel-radius);\r
  box-shadow: var(--tcw-menu-shadow);\r
  animation: tcw-alerts-in var(--tcw-dur, 160ms) var(--tcw-ease, ease) both;\r
}\r
.tcw-style-header {\r
  display: flex;\r
  align-items: center;\r
  justify-content: space-between;\r
  font-size: var(--tcw-font-size-sm);\r
  font-weight: var(--tcw-weight-strong);\r
  color: var(--tcw-text);\r
}\r
.tcw-style-close {\r
  display: inline-flex;\r
  align-items: center;\r
  justify-content: center;\r
  width: var(--tcw-control-h-sm);\r
  height: var(--tcw-control-h-sm);\r
  border: none;\r
  background: transparent;\r
  color: var(--tcw-text-muted);\r
  border-radius: var(--tcw-control-radius);\r
  cursor: pointer;\r
}\r
.tcw-style-close:hover { background: var(--tcw-bg-surface); color: var(--tcw-text); }\r
\r
.tcw-style-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }\r
.tcw-style-swatch {\r
  width: 18px;\r
  height: 18px;\r
  border-radius: 50%;\r
  border: 1px solid var(--tcw-border-strong);\r
  cursor: pointer;\r
  padding: 0;\r
}\r
.tcw-style-swatch.tcw-on { outline: 2px solid var(--tcw-accent); outline-offset: 1px; }\r
.tcw-style-picker {\r
  width: 22px;\r
  height: 22px;\r
  padding: 0;\r
  border: 1px solid var(--tcw-border);\r
  border-radius: var(--tcw-radius-sm);\r
  background: transparent;\r
  cursor: pointer;\r
}\r
.tcw-style-width, .tcw-style-dash {\r
  flex: 1;\r
  min-width: 0;\r
  height: 26px;\r
  display: flex;\r
  align-items: center;\r
  justify-content: center;\r
  background: var(--tcw-bg-surface);\r
  border: 1px solid var(--tcw-border);\r
  border-radius: var(--tcw-control-radius);\r
  color: var(--tcw-text-dim);\r
  cursor: pointer;\r
  font-size: var(--tcw-font-size-xs);\r
}\r
.tcw-style-width span { width: 16px; background: currentColor; border-radius: var(--tcw-radius-xs); }\r
.tcw-style-width.tcw-on, .tcw-style-dash.tcw-on {\r
  border-color: var(--tcw-accent);\r
  color: var(--tcw-accent);\r
}\r
\r
.tcw-style-subhead {\r
  font-size: var(--tcw-font-size-xs);\r
  font-weight: calc(var(--tcw-weight-strong) + 100);\r
  text-transform: var(--tcw-label-case);\r
  letter-spacing: var(--tcw-label-tracking);\r
  color: var(--tcw-text-muted);\r
  margin-top: 2px;\r
}\r
.tcw-style-save { display: flex; gap: 6px; }\r
.tcw-style-name {\r
  flex: 1;\r
  min-width: 0;\r
  height: 28px;\r
  padding: 0 8px;\r
  font-size: var(--tcw-font-size-sm);\r
  color: var(--tcw-text);\r
  background: var(--tcw-bg-surface);\r
  border: 1px solid var(--tcw-border);\r
  border-radius: var(--tcw-input-radius);\r
  outline: none;\r
}\r
.tcw-style-name:focus { border-color: var(--tcw-accent); }\r
.tcw-style-savebtn {\r
  display: inline-flex;\r
  align-items: center;\r
  gap: 4px;\r
  padding: 0 10px;\r
  height: 28px;\r
  font-size: var(--tcw-font-size-sm);\r
  font-weight: var(--tcw-weight-strong);\r
  color: var(--tcw-accent-ink);\r
  background: var(--tcw-accent);\r
  border: none;\r
  border-radius: var(--tcw-control-radius);\r
  cursor: pointer;\r
}\r
.tcw-style-savebtn:hover { background: var(--tcw-accent-hover); }\r
\r
.tcw-style-templates { display: flex; flex-direction: column; gap: 2px; max-height: 140px; overflow-y: auto; }\r
.tcw-style-empty { font-size: var(--tcw-font-size-xs); color: var(--tcw-text-muted); padding: 4px 0; }\r
.tcw-style-template { display: flex; align-items: center; gap: 4px; }\r
.tcw-style-apply {\r
  flex: 1;\r
  min-width: 0;\r
  display: flex;\r
  align-items: center;\r
  gap: 7px;\r
  padding: 5px 7px;\r
  font-size: var(--tcw-font-size-sm);\r
  color: var(--tcw-text);\r
  background: transparent;\r
  border: none;\r
  border-radius: var(--tcw-control-radius);\r
  cursor: pointer;\r
  text-align: start;\r
}\r
.tcw-style-apply:hover { background: var(--tcw-bg-surface); }\r
.tcw-style-tdot { flex-shrink: 0; width: 9px; height: 9px; border-radius: 50%; }\r
.tcw-style-tdel {\r
  display: inline-flex;\r
  align-items: center;\r
  justify-content: center;\r
  width: var(--tcw-control-h-sm);\r
  height: var(--tcw-control-h-sm);\r
  border: none;\r
  background: transparent;\r
  color: var(--tcw-text-muted);\r
  border-radius: var(--tcw-control-radius);\r
  cursor: pointer;\r
}\r
.tcw-style-tdel:hover { background: var(--tcw-red-soft); color: var(--tcw-red); }\r
\r
/* === Settings range slider === */\r
\r
.tcw-settings-range {\r
  display: flex;\r
  align-items: center;\r
  gap: 8px;\r
}\r
.tcw-settings-range input[type='range'] {\r
  width: 110px;\r
  accent-color: var(--tcw-accent);\r
  cursor: pointer;\r
}\r
.tcw-settings-range-val {\r
  min-width: 38px;\r
  text-align: end;\r
  font-size: var(--tcw-font-size-sm);\r
  font-variant-numeric: tabular-nums;\r
  color: var(--tcw-text-dim);\r
}\r
\r
/* === Indicator settings dialog === */\r
\r
/* Narrow on a desktop; on a phone a sheet across the screen like every dialog. */\r
@media (min-width: 641px) {\r
  .tcw-modal-narrow {\r
    max-width: 360px;\r
  }\r
}\r
.tcw-indi-input {\r
  width: 110px;\r
  height: 30px;\r
  padding: 0 8px;\r
  font-size: var(--tcw-font-size-sm);\r
  color: var(--tcw-text);\r
  background: var(--tcw-bg-surface);\r
  border: 1px solid var(--tcw-border);\r
  border-radius: var(--tcw-input-radius);\r
  outline: none;\r
  font-variant-numeric: tabular-nums;\r
}\r
.tcw-indi-input:focus {\r
  border-color: var(--tcw-accent);\r
  box-shadow: 0 0 0 2px var(--tcw-accent-soft);\r
}\r
.tcw-indi-select {\r
  width: 150px;\r
  padding-right: 4px;\r
  cursor: pointer;\r
}\r
/* A level: its value and a remove button. */\r
.tcw-indi-level {\r
  display: inline-flex;\r
  align-items: center;\r
  gap: 6px;\r
}\r
.tcw-indi-remove {\r
  display: inline-grid;\r
  place-items: center;\r
  width: var(--tcw-control-h-sm);\r
  height: var(--tcw-control-h-sm);\r
  padding: 0;\r
  border: none;\r
  border-radius: var(--tcw-control-radius);\r
  background: transparent;\r
  color: var(--tcw-text-muted);\r
  cursor: pointer;\r
}\r
.tcw-indi-remove:hover {\r
  color: var(--tcw-red);\r
  background: var(--tcw-hover-bg);\r
}\r
.tcw-indi-remove:focus-visible {\r
  outline: 2px solid var(--tcw-accent);\r
  outline-offset: -2px;\r
}\r
.tcw-indi-add {\r
  margin-top: 8px;\r
}\r
.tcw-indi-color {\r
  width: 36px;\r
  height: 28px;\r
  padding: 2px;\r
  background: var(--tcw-bg-surface);\r
  border: 1px solid var(--tcw-border);\r
  border-radius: var(--tcw-radius-sm);\r
  cursor: pointer;\r
}\r
\r
/* === Object tree panel === */\r
\r
.tcw-tree-panel {\r
  position: absolute;\r
  top: var(--tcw-panel-top);\r
  inset-inline-end: 12px;\r
  z-index: 39;\r
  width: 280px;\r
  max-width: calc(100vw - 24px);\r
  display: flex;\r
  flex-direction: column;\r
  background: var(--tcw-bg-elevated);\r
  border: 1px solid var(--tcw-border-strong);\r
  border-radius: var(--tcw-panel-radius);\r
  box-shadow: var(--tcw-menu-shadow);\r
  overflow: hidden;\r
  animation: tcw-alerts-in var(--tcw-dur, 160ms) var(--tcw-ease, ease) both;\r
}\r
\r
.tcw-tree-header {\r
  display: flex;\r
  align-items: center;\r
  justify-content: space-between;\r
  padding: 10px 12px;\r
  font-weight: var(--tcw-weight-strong);\r
  font-size: var(--tcw-font-size);\r
  color: var(--tcw-text);\r
  border-bottom: 1px solid var(--tcw-border);\r
}\r
.tcw-tree-close {\r
  display: inline-flex;\r
  align-items: center;\r
  justify-content: center;\r
  width: var(--tcw-control-h-sm);\r
  height: var(--tcw-control-h-sm);\r
  border: none;\r
  background: transparent;\r
  color: var(--tcw-text-muted);\r
  border-radius: var(--tcw-control-radius);\r
  cursor: pointer;\r
}\r
.tcw-tree-close:hover {\r
  background: var(--tcw-bg-surface);\r
  color: var(--tcw-text);\r
}\r
\r
.tcw-tree-section {\r
  padding: 6px;\r
  border-bottom: 1px solid var(--tcw-border);\r
}\r
.tcw-tree-section:last-child {\r
  border-bottom: none;\r
}\r
.tcw-tree-section-head {\r
  display: flex;\r
  align-items: center;\r
  justify-content: space-between;\r
  padding: 6px 8px 4px;\r
  font-size: var(--tcw-font-size-xs);\r
  font-weight: calc(var(--tcw-weight-strong) + 100);\r
  text-transform: var(--tcw-label-case);\r
  letter-spacing: var(--tcw-label-tracking);\r
  color: var(--tcw-text-muted);\r
}\r
.tcw-tree-add {\r
  display: inline-flex;\r
  align-items: center;\r
  justify-content: center;\r
  width: var(--tcw-control-h-sm);\r
  height: var(--tcw-control-h-sm);\r
  border: none;\r
  background: transparent;\r
  color: var(--tcw-text-muted);\r
  border-radius: var(--tcw-control-radius);\r
  cursor: pointer;\r
}\r
.tcw-tree-add:hover {\r
  background: var(--tcw-accent-soft);\r
  color: var(--tcw-accent);\r
}\r
.tcw-tree-dot {\r
  flex-shrink: 0;\r
  width: 8px;\r
  height: 8px;\r
  border-radius: 50%;\r
}\r
.tcw-tree-list {\r
  max-height: 200px;\r
  overflow-y: auto;\r
}\r
\r
.tcw-tree-row {\r
  display: flex;\r
  align-items: center;\r
  justify-content: space-between;\r
  gap: 8px;\r
  padding: 6px 8px;\r
  border-radius: var(--tcw-radius-sm);\r
}\r
.tcw-tree-row:hover {\r
  background: var(--tcw-bg-surface);\r
}\r
.tcw-tree-hidden .tcw-tree-name {\r
  opacity: 0.5;\r
}\r
.tcw-tree-name {\r
  min-width: 0;\r
  font-size: var(--tcw-font-size-sm);\r
  color: var(--tcw-text);\r
  overflow: hidden;\r
  text-overflow: ellipsis;\r
  white-space: nowrap;\r
}\r
.tcw-tree-actions {\r
  display: flex;\r
  align-items: center;\r
  gap: 2px;\r
  flex-shrink: 0;\r
}\r
.tcw-tree-btn {\r
  display: inline-flex;\r
  align-items: center;\r
  justify-content: center;\r
  width: var(--tcw-control-h-sm);\r
  height: var(--tcw-control-h-sm);\r
  border: none;\r
  background: transparent;\r
  color: var(--tcw-text-muted);\r
  border-radius: var(--tcw-control-radius);\r
  cursor: pointer;\r
}\r
.tcw-tree-btn:hover {\r
  background: var(--tcw-bg-elevated);\r
  color: var(--tcw-text);\r
}\r
.tcw-tree-btn.tcw-tree-on {\r
  color: var(--tcw-accent);\r
}\r
.tcw-tree-btn.tcw-tree-del:hover {\r
  background: var(--tcw-red-soft);\r
  color: var(--tcw-red);\r
}\r
.tcw-tree-group .tcw-tree-name {\r
  display: inline-flex;\r
  align-items: center;\r
  gap: 6px;\r
  font-weight: var(--tcw-weight-strong);\r
}\r
.tcw-tree-group .tcw-tree-name svg {\r
  flex: none;\r
  color: var(--tcw-text-muted);\r
}\r
.tcw-tree-member {\r
  margin-left: 14px;\r
  padding-left: 10px;\r
  border-inline-start: 1px solid var(--tcw-border-strong);\r
  border-radius: 0 var(--tcw-radius-sm) var(--tcw-radius-sm) 0;\r
}\r
.tcw-tree-rename {\r
  flex: 1;\r
  min-width: 0;\r
  padding: 3px 6px;\r
  border: 1px solid var(--tcw-accent-line);\r
  border-radius: var(--tcw-input-radius);\r
  background: var(--tcw-bg-surface);\r
  color: var(--tcw-text);\r
  font: inherit;\r
  font-size: var(--tcw-font-size-sm);\r
}\r
.tcw-tree-rename:focus {\r
  outline: none;\r
  box-shadow: 0 0 0 2px var(--tcw-accent-soft);\r
}\r
.tcw-tree-empty {\r
  padding: 8px;\r
  font-size: var(--tcw-font-size-sm);\r
  color: var(--tcw-text-muted);\r
}\r
\r
@media (max-width: 640px) {\r
  .tcw-tree-panel {\r
    top: auto;\r
    bottom: 0;\r
    left: 0;\r
    right: 0;\r
    width: 100vw;\r
    max-width: 100vw;\r
    border-radius: var(--tcw-radius-xl) var(--tcw-radius-xl) 0 0;\r
  }\r
  .tcw-tree-list {\r
    max-height: 30vh;\r
    max-height: 30dvh;\r
  }\r
  .tcw-tree-section:last-child {\r
    padding-bottom: max(6px, env(safe-area-inset-bottom));\r
  }\r
}\r
\r
/* === Reduced motion === */\r
\r
@media (prefers-reduced-motion: reduce) {\r
  .tcw-root *,\r
  .tcw-root *::before,\r
  .tcw-root *::after {\r
    animation-duration: 0.01ms !important;\r
    animation-iteration-count: 1 !important;\r
    transition-duration: 0.01ms !important;\r
  }\r
\r
  /* Except the loader's slow glow (opacity only): without it a long wait\r
     looks frozen. */\r
  .tcw-root .tcw-loading-candle,\r
  .tcw-root .tcw-loading-track > span {\r
    animation-duration: 2.4s !important;\r
    animation-iteration-count: infinite !important;\r
    animation-delay: var(--tcw-delay, 0ms) !important;\r
  }\r
}\r
\r
/* --- Drawing settings dialog --- */\r
.tcw-drawing-settings .tcw-modal-footer { gap: 12px; }\r
.tcw-drawing-settings-tools {\r
  display: flex;\r
  gap: 14px;\r
  margin-inline-end: auto;\r
}\r
.tcw-drawing-text {\r
  min-height: 56px;\r
  resize: vertical;\r
  font-family: inherit;\r
}\r
.tcw-levels-editor { display: grid; gap: 6px; margin-bottom: 10px; }\r
.tcw-levels-grid {\r
  display: grid;\r
  gap: 4px;\r
  max-height: 260px;\r
  overflow-y: auto;\r
  padding-right: 2px;\r
}\r
.tcw-level-row {\r
  display: grid;\r
  grid-template-columns: auto minmax(0, 1fr) 32px 24px;\r
  align-items: center;\r
  gap: 8px;\r
}\r
.tcw-level-row input[type='checkbox'] { accent-color: var(--tcw-accent); }\r
.tcw-level-remove {\r
  display: inline-flex;\r
  align-items: center;\r
  justify-content: center;\r
  width: var(--tcw-control-h-sm);\r
  height: var(--tcw-control-h-sm);\r
  border: 0;\r
  border-radius: var(--tcw-radius-sm, 4px);\r
  background: transparent;\r
  color: var(--tcw-text-muted);\r
  cursor: pointer;\r
}\r
.tcw-level-remove:hover { color: var(--tcw-text); background: var(--tcw-bg-elevated); }\r
.tcw-level-remove:focus-visible { outline: 2px solid var(--tcw-accent); outline-offset: 1px; }\r
.tcw-level-add { justify-self: start; }\r
.tcw-drawing-templates { display: grid; gap: 2px; margin-bottom: 8px; }\r
.tcw-drawing-alert { display: inline-flex; align-items: center; gap: 6px; }\r
\r
/* --- Context menu (right-click on a drawing) --- */\r
.tcw-context-menu {\r
  position: absolute;\r
  z-index: 70;\r
  min-width: 200px;\r
  /* Taller than the room (many templates, say), it scrolls. */\r
  overflow-y: auto;\r
  overscroll-behavior: contain;\r
  padding: var(--tcw-menu-pad);\r
  background: var(--tcw-bg-elevated);\r
  border: var(--tcw-border-w) solid var(--tcw-border);\r
  border-radius: var(--tcw-menu-radius);\r
  box-shadow: var(--tcw-menu-shadow);\r
}\r
.tcw-context-item {\r
  display: flex;\r
  align-items: center;\r
  gap: var(--tcw-space-4);\r
  width: 100%;\r
  min-height: var(--tcw-menu-item-h);\r
  padding: var(--tcw-space-1) var(--tcw-space-4);\r
  border: 0;\r
  border-radius: var(--tcw-menu-item-radius);\r
  background: transparent;\r
  color: var(--tcw-text);\r
  font: inherit;\r
  font-size: var(--tcw-font-size);\r
  text-align: start;\r
  cursor: pointer;\r
}\r
.tcw-context-item svg, .tcw-context-icon { flex: none; width: 14px; height: 14px; color: var(--tcw-text-muted); }\r
.tcw-context-item:hover, .tcw-context-item:focus-visible { background: var(--tcw-hover-bg); outline: none; }\r
.tcw-context-item:focus-visible { box-shadow: inset 0 0 0 1px var(--tcw-accent); }\r
.tcw-context-danger, .tcw-context-danger svg { color: var(--tcw-red); }\r
.tcw-context-sep { height: 1px; margin: var(--tcw-space-2) var(--tcw-space-4); background: var(--tcw-divider); }\r
.tcw-context-label { flex: 1; min-width: 0; }\r
/* A shortcut, and the mark of a submenu, at the row's end. */\r
.tcw-context-key {\r
  flex: none;\r
  margin-inline-start: var(--tcw-space-5);\r
  font: inherit;\r
  font-size: var(--tcw-font-size-xs);\r
  font-variant-numeric: tabular-nums;\r
  color: var(--tcw-text-muted);\r
}\r
.tcw-context-item svg.tcw-context-more { width: 12px; height: 12px; }\r
/* Right to left, a submenu opens to the left: its marks point there. */\r
[dir='rtl'] .tcw-context-more, [dir='rtl'] .tcw-context-back > svg { transform: scaleX(-1); }\r
/* No keyboard under a finger: the keys stay named to a screen reader only. */\r
@media (hover: none) { .tcw-context-key { display: none; } }\r
.tcw-context-item[aria-expanded='true'] { background: var(--tcw-hover-bg); }\r
/* The choice made among radios: a dot where a switch has its tick. */\r
.tcw-context-dot { display: grid; place-items: center; }\r
.tcw-context-dot::after { content: ''; width: 6px; height: 6px; border-radius: 50%; background: var(--tcw-text); }\r
/* An entry that can be removed: its x on the row in hand, always on a touch screen. */\r
.tcw-context-row { display: flex; align-items: center; border-radius: var(--tcw-menu-item-radius); }\r
.tcw-context-row .tcw-context-item { flex: 1; min-width: 0; }\r
.tcw-context-row:hover { background: var(--tcw-hover-bg); }\r
.tcw-context-row:hover .tcw-context-item { background: transparent; }\r
.tcw-context-remove {\r
  flex: none;\r
  display: inline-grid;\r
  place-items: center;\r
  width: var(--tcw-control-h-sm);\r
  height: var(--tcw-control-h-sm);\r
  margin-inline-end: var(--tcw-space-1);\r
  border: 0;\r
  border-radius: var(--tcw-menu-item-radius);\r
  background: transparent;\r
  color: var(--tcw-text-muted);\r
  cursor: pointer;\r
  opacity: 0;\r
  transition: opacity var(--tcw-dur-fast) var(--tcw-ease), color var(--tcw-dur-fast) var(--tcw-ease);\r
}\r
.tcw-context-row:hover .tcw-context-remove, .tcw-context-row:focus-within .tcw-context-remove { opacity: 1; }\r
.tcw-context-remove:hover { color: var(--tcw-red); background: var(--tcw-hover-bg); }\r
@media (hover: none) { .tcw-context-remove { opacity: 1; } }\r
/* --- Toolbar over a selected drawing --- */\r
.tcw-sel-toolbar {\r
  position: absolute;\r
  z-index: 65;\r
  display: flex;\r
  align-items: center;\r
  gap: 2px;\r
  padding: 3px;\r
  background: var(--tcw-bg-elevated);\r
  border: var(--tcw-border-w) solid var(--tcw-divider);\r
  border-radius: var(--tcw-menu-radius);\r
  box-shadow: var(--tcw-menu-shadow);\r
  font-family: var(--tcw-font);\r
  white-space: nowrap;\r
  animation: tcw-sel-in var(--tcw-dur-fast) var(--tcw-ease-out);\r
}\r
@keyframes tcw-sel-in { from { opacity: 0; transform: translateY(3px); } }\r
.tcw-sel-btn {\r
  display: inline-flex;\r
  align-items: center;\r
  justify-content: center;\r
  gap: 5px;\r
  min-width: var(--tcw-control-h-sm);\r
  height: var(--tcw-control-h-sm);\r
  padding: 0 6px;\r
  border: 0;\r
  border-radius: var(--tcw-control-radius);\r
  background: transparent;\r
  color: var(--tcw-text-muted);\r
  font: inherit;\r
  font-size: var(--tcw-font-size-xs);\r
  font-variant-numeric: tabular-nums;\r
  cursor: pointer;\r
  transition: background var(--tcw-dur-fast) var(--tcw-ease), color var(--tcw-dur-fast) var(--tcw-ease);\r
}\r
.tcw-sel-btn svg { flex: none; }\r
.tcw-sel-btn:hover, .tcw-sel-btn[aria-expanded="true"] { background: var(--tcw-hover-bg); color: var(--tcw-text); }\r
.tcw-sel-btn:focus-visible, .tcw-sel-swatch:focus-visible, .tcw-sel-option:focus-visible { outline: none; box-shadow: inset 0 0 0 1px var(--tcw-accent); }\r
.tcw-sel-btn.tcw-sel-on { color: var(--tcw-accent); background: var(--tcw-accent-soft); }\r
.tcw-sel-danger:hover { color: var(--tcw-red); background: var(--tcw-red-soft); }\r
.tcw-sel-color {\r
  width: 14px;\r
  height: 14px;\r
  border-radius: 50%;\r
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--tcw-text) 25%, transparent);\r
}\r
.tcw-sel-width {\r
  display: inline-block;\r
  width: 16px;\r
  height: var(--w, 1px);\r
  max-height: 6px;\r
  border-radius: 1px;\r
  background: currentColor;\r
}\r
.tcw-sel-sep { flex: none; width: 1px; height: 18px; margin: 0 3px; background: var(--tcw-divider); }\r
.tcw-sel-pop {\r
  position: absolute;\r
  z-index: 66;\r
  display: flex;\r
  flex-direction: column;\r
  gap: 2px;\r
  min-width: 120px;\r
  padding: 4px;\r
  background: var(--tcw-bg-elevated);\r
  border: var(--tcw-border-w) solid var(--tcw-divider);\r
  border-radius: var(--tcw-menu-radius);\r
  box-shadow: var(--tcw-menu-shadow);\r
  font-family: var(--tcw-font);\r
}\r
.tcw-sel-pop--color {\r
  display: grid;\r
  grid-template-columns: repeat(4, 24px);\r
  gap: 6px;\r
  min-width: 0;\r
  padding: 8px;\r
}\r
.tcw-sel-swatch {\r
  width: 24px;\r
  height: 24px;\r
  padding: 0;\r
  border: 0;\r
  border-radius: 50%;\r
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--tcw-text) 20%, transparent);\r
  cursor: pointer;\r
  transition: transform var(--tcw-dur-fast) var(--tcw-ease);\r
}\r
.tcw-sel-swatch:hover { transform: scale(1.1); }\r
.tcw-sel-swatch.tcw-sel-on { box-shadow: 0 0 0 2px var(--tcw-bg-elevated), 0 0 0 4px var(--tcw-accent); }\r
.tcw-sel-option {\r
  display: flex;\r
  align-items: center;\r
  gap: 10px;\r
  min-height: var(--tcw-menu-item-h);\r
  padding: 4px 10px;\r
  border: 0;\r
  border-radius: var(--tcw-radius-sm);\r
  background: transparent;\r
  color: var(--tcw-text);\r
  font: inherit;\r
  font-size: var(--tcw-font-size-sm);\r
  text-align: start;\r
  cursor: pointer;\r
}\r
.tcw-sel-option:hover { background: var(--tcw-bg-surface); }\r
.tcw-sel-option.tcw-sel-on { color: var(--tcw-accent); }\r
@media (prefers-reduced-motion: reduce) {\r
  .tcw-sel-toolbar { animation: none; }\r
  .tcw-sel-swatch { transition: none; }\r
}\r
\r
/* --- Account panel (positions, orders, history) --- */\r
.tcw-account-dock {\r
  flex: none;\r
}\r
.tcw-account {\r
  display: flex;\r
  flex-direction: column;\r
  height: 220px;\r
  border-top: 1px solid var(--tcw-border);\r
  background: var(--tcw-bg-surface);\r
}\r
.tcw-account-head {\r
  display: flex;\r
  align-items: center;\r
  gap: 8px;\r
  padding: 4px 8px;\r
  border-bottom: 1px solid var(--tcw-divider);\r
}\r
.tcw-account-tabs {\r
  display: flex;\r
  gap: 2px;\r
  flex: 1;\r
  min-width: 0;\r
  overflow-x: auto;\r
}\r
.tcw-account-tab {\r
  padding: 6px 10px;\r
  border: 0;\r
  border-radius: var(--tcw-control-radius);\r
  background: transparent;\r
  color: var(--tcw-text-muted);\r
  font: inherit;\r
  font-size: var(--tcw-font-size-sm);\r
  white-space: nowrap;\r
  cursor: pointer;\r
}\r
.tcw-account-tab:hover { color: var(--tcw-text); background: var(--tcw-hover-bg); }\r
.tcw-account-tab[aria-selected="true"] { color: var(--tcw-text); background: var(--tcw-active-bg); }\r
.tcw-account-tab:focus-visible, .tcw-account-new:focus-visible { outline: none; box-shadow: inset 0 0 0 1px var(--tcw-accent); }\r
.tcw-account-new {\r
  display: inline-flex;\r
  align-items: center;\r
  gap: 6px;\r
  padding: 5px 10px;\r
  border: 1px solid var(--tcw-accent-line);\r
  border-radius: var(--tcw-control-radius);\r
  background: var(--tcw-accent-soft);\r
  color: var(--tcw-accent);\r
  font: inherit;\r
  font-size: var(--tcw-font-size-sm);\r
  cursor: pointer;\r
}\r
.tcw-account-new:hover { background: var(--tcw-accent-glow); }\r
.tcw-account-body {\r
  flex: 1;\r
  min-height: 0;\r
  overflow: auto;\r
}\r
.tcw-account-table {\r
  width: 100%;\r
  border-collapse: collapse;\r
  font-size: var(--tcw-font-size-sm);\r
  font-variant-numeric: tabular-nums;\r
}\r
.tcw-account-table th {\r
  position: sticky;\r
  top: 0;\r
  padding: 6px 10px;\r
  background: var(--tcw-bg-surface);\r
  color: var(--tcw-text-muted);\r
  font-weight: var(--tcw-weight);\r
  text-align: start;\r
  border-bottom: 1px solid var(--tcw-divider);\r
}\r
.tcw-account-table td {\r
  padding: 5px 10px;\r
  color: var(--tcw-text);\r
  border-bottom: 1px solid var(--tcw-divider);\r
  white-space: nowrap;\r
}\r
.tcw-account-table tr:hover td { background: var(--tcw-hover-bg); }\r
.tcw-account-side { font-weight: var(--tcw-weight-strong); }\r
.tcw-account-buy, .tcw-account-up { color: var(--tcw-green); }\r
.tcw-account-sell, .tcw-account-down { color: var(--tcw-red); }\r
.tcw-account-actions { display: flex; gap: 2px; }\r
.tcw-account-empty, .tcw-account-summary {\r
  margin: 0;\r
  padding: 14px 12px;\r
  color: var(--tcw-text-muted);\r
  font-size: var(--tcw-font-size-sm);\r
}\r
.tcw-account-summary { padding: 8px 12px; color: var(--tcw-text-dim); }\r
@media (max-width: 640px) {\r
  .tcw-account { height: 45vh; height: 45dvh; }\r
}\r
\r
/* --- Order ticket --- */\r
.tcw-ticket-side {\r
  display: grid;\r
  grid-template-columns: 1fr 1fr;\r
  gap: 6px;\r
  margin-bottom: 12px;\r
}\r
.tcw-ticket-side-btn {\r
  padding: 8px;\r
  border: 1px solid var(--tcw-border);\r
  border-radius: var(--tcw-control-radius);\r
  background: transparent;\r
  color: var(--tcw-text-muted);\r
  font: inherit;\r
  font-weight: var(--tcw-weight-strong);\r
  cursor: pointer;\r
}\r
.tcw-ticket-buy[aria-pressed="true"] { background: var(--tcw-green-soft); border-color: var(--tcw-green); color: var(--tcw-green); }\r
.tcw-ticket-sell[aria-pressed="true"] { background: var(--tcw-red-soft); border-color: var(--tcw-red); color: var(--tcw-red); }\r
.tcw-ticket-side-btn:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--tcw-accent-soft); }\r
.tcw-ticket-optional { display: flex; align-items: center; gap: 8px; }\r
.tcw-ticket-optional > span { flex: 1; }\r
.tcw-ticket-optional .tcw-indi-input { width: 110px; }\r
.tcw-ticket-problems {\r
  min-height: 18px;\r
  padding: 0 22px 8px;\r
  font-size: var(--tcw-font-size-sm);\r
  color: var(--tcw-text-dim);\r
}\r
.tcw-ticket-problems p { margin: 2px 0; }\r
.tcw-ticket-problems.tcw-ticket-bad { color: var(--tcw-red); }\r
.tcw-done-btn.tcw-ticket-sell { background: var(--tcw-red); color: #fff; }\r
.tcw-done-btn:disabled { opacity: 0.45; cursor: not-allowed; }\r
\r
/* --- Named layouts --- */\r
.tcw-layouts-btn { max-width: 190px; }\r
.tcw-layouts-label {\r
  overflow: hidden;\r
  text-overflow: ellipsis;\r
  min-width: 0;\r
}\r
.tcw-layouts-dirty {\r
  width: 6px;\r
  height: 6px;\r
  flex: none;\r
  border-radius: 50%;\r
  background: var(--tcw-accent);\r
}\r
.tcw-name-field { display: flex; flex-direction: column; gap: 6px; font-size: var(--tcw-font-size-sm); color: var(--tcw-text-dim); }\r
.tcw-name-field .tcw-indi-input { width: 100%; height: 34px; font-size: var(--tcw-font-size); }\r
.tcw-layouts-body { display: flex; flex-direction: column; gap: 10px; }\r
.tcw-layouts-search { width: 100%; height: 32px; }\r
.tcw-layouts-list {\r
  display: flex;\r
  flex-direction: column;\r
  gap: 2px;\r
  max-height: 50vh;\r
  max-height: 50dvh;\r
  overflow-y: auto;\r
}\r
.tcw-layouts-row {\r
  display: flex;\r
  align-items: center;\r
  gap: 6px;\r
  border-radius: var(--tcw-radius);\r
}\r
.tcw-layouts-row:hover { background: var(--tcw-hover-bg); }\r
.tcw-layouts-open {\r
  flex: 1;\r
  min-width: 0;\r
  display: flex;\r
  flex-direction: column;\r
  align-items: flex-start;\r
  gap: 2px;\r
  padding: 7px 8px;\r
  border: none;\r
  background: transparent;\r
  color: var(--tcw-text);\r
  font: inherit;\r
  text-align: start;\r
  cursor: pointer;\r
  border-radius: var(--tcw-radius);\r
}\r
.tcw-layouts-open:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--tcw-accent-soft); }\r
.tcw-layouts-name {\r
  display: flex;\r
  align-items: center;\r
  gap: 6px;\r
  max-width: 100%;\r
  font-size: var(--tcw-font-size);\r
  font-weight: var(--tcw-weight-strong);\r
  overflow: hidden;\r
  text-overflow: ellipsis;\r
  white-space: nowrap;\r
}\r
.tcw-layouts-open[aria-current="true"] .tcw-layouts-name { color: var(--tcw-accent); }\r
.tcw-layouts-meta {\r
  max-width: 100%;\r
  font-size: var(--tcw-font-size-xs);\r
  color: var(--tcw-text-muted);\r
  font-variant-numeric: tabular-nums;\r
  overflow: hidden;\r
  text-overflow: ellipsis;\r
  white-space: nowrap;\r
}\r
.tcw-layouts-confirm {\r
  padding: 4px 10px;\r
  border: none;\r
  border-radius: var(--tcw-control-radius);\r
  background: var(--tcw-red);\r
  color: #fff;\r
  font: inherit;\r
  font-size: var(--tcw-font-size-sm);\r
  font-weight: var(--tcw-weight-strong);\r
  cursor: pointer;\r
}\r
.tcw-layouts-confirm:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--tcw-red-soft); }\r
\r
/* --- Chart grid --- */\r
.tcw-grid { background: var(--tcw-bg); }\r
.tcw-grid-bar {\r
  display: flex;\r
  align-items: center;\r
  gap: 6px;\r
  min-height: calc(var(--tcw-control-h) + 8px);\r
  padding: 0 8px;\r
  border-bottom: 1px solid var(--tcw-border);\r
  background: var(--tcw-bg-surface);\r
  overflow-x: auto;\r
  scrollbar-width: none;\r
}\r
.tcw-grid-bar::-webkit-scrollbar { display: none; }\r
.tcw-grid-group { display: flex; align-items: center; gap: 2px; flex: none; }\r
.tcw-grid-label {\r
  display: inline-flex;\r
  align-items: center;\r
  gap: 4px;\r
  margin-right: 4px;\r
  font-size: var(--tcw-font-size-xs);\r
  font-weight: var(--tcw-weight-strong);\r
  letter-spacing: var(--tcw-label-tracking);\r
  text-transform: var(--tcw-label-case);\r
  color: var(--tcw-text-muted);\r
}\r
.tcw-grid-sync[aria-pressed="true"] { color: var(--tcw-accent); }\r
.tcw-grid-cells {\r
  flex: 1;\r
  min-height: 0;\r
  display: grid;\r
  gap: 1px;\r
  background: var(--tcw-border);\r
}\r
.tcw-grid-cell {\r
  position: relative;\r
  min-width: 0;\r
  min-height: 0;\r
  background: var(--tcw-bg);\r
}\r
.tcw-grid-cell-active::after {\r
  content: '';\r
  position: absolute;\r
  inset: 0;\r
  border: 1px solid var(--tcw-accent);\r
  pointer-events: none;\r
  z-index: 5;\r
}\r
\r
/* --- Host toolbar buttons --- */\r
.tcw-toolbar-host { display: inline-flex; align-items: center; gap: 2px; }\r
.tcw-toolbar-host:empty { display: none; }\r
.tcw-host-btn { display: inline-flex; align-items: center; gap: 4px; }\r
\r
/* --- Host sidebar buttons, status bar items, and the layer over the chart --- */\r
.tcw-sidebar-host { display: flex; flex-direction: column; align-items: center; }\r
.tcw-sidebar-host:empty { display: none; }\r
.tcw-status-host { display: flex; align-items: center; gap: 10px; min-width: 0; }\r
.tcw-status-host:empty { display: none; }\r
.tcw-status-host-item { white-space: nowrap; }\r
.tcw-status-host-btn {\r
  margin: -4px -6px;\r
  padding: 4px 6px;\r
  font: inherit;\r
  color: inherit;\r
  background: transparent;\r
  border: none;\r
  border-radius: var(--tcw-control-radius);\r
  cursor: pointer;\r
  transition: color var(--tcw-dur-fast) var(--tcw-ease), background var(--tcw-dur-fast) var(--tcw-ease);\r
}\r
.tcw-status-host-btn:hover { color: var(--tcw-text); background: var(--tcw-hover-bg); }\r
.tcw-status-host-btn:focus-visible { outline: 2px solid var(--tcw-accent); outline-offset: -2px; }\r
/* Over the plot and under the widget's own overlays; the pointer reaches the chart unless an element of yours takes it. */\r
.tcw-host-layer { position: absolute; inset: 0; z-index: 2; pointer-events: none; }\r
\r
/* --- Pane buttons (move, fold, maximise) --- */\r
.tcw-pane-controls {\r
  position: absolute;\r
  z-index: 4;\r
  display: flex;\r
  gap: 1px;\r
  transform: translateX(-100%);\r
  padding: 1px;\r
  border-radius: var(--tcw-radius-sm);\r
  background: color-mix(in srgb, var(--tcw-bg) 80%, transparent);\r
  opacity: 0.55;\r
  transition: opacity var(--tcw-dur-fast) var(--tcw-ease);\r
}\r
.tcw-pane-controls:hover,\r
.tcw-pane-controls:focus-within { opacity: 1; }\r
.tcw-pane-btn {\r
  display: inline-grid;\r
  place-items: center;\r
  width: 18px;\r
  height: 16px;\r
  padding: 0;\r
  border: none;\r
  border-radius: var(--tcw-control-radius);\r
  background: transparent;\r
  color: var(--tcw-text-muted);\r
  cursor: pointer;\r
}\r
.tcw-pane-btn:hover { color: var(--tcw-text); background: var(--tcw-hover-bg); }\r
.tcw-pane-btn:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--tcw-accent-soft); }\r
\r
/* --- Typed interval --- */\r
.tcw-interval-input {\r
  position: absolute;\r
  z-index: 20;\r
  left: 50%;\r
  top: 40%;\r
  transform: translate(-50%, -50%);\r
  display: flex;\r
  flex-direction: column;\r
  gap: 6px;\r
  padding: 10px 12px;\r
  border: 1px solid var(--tcw-border);\r
  border-radius: var(--tcw-radius-lg, 10px);\r
  background: var(--tcw-bg-elevated);\r
  box-shadow: var(--tcw-menu-shadow);\r
}\r
.tcw-interval-field {\r
  width: 150px;\r
  height: 36px;\r
  padding: 0 10px;\r
  font: inherit;\r
  font-size: var(--tcw-font-size-xl);\r
  font-weight: var(--tcw-weight-strong);\r
  font-variant-numeric: tabular-nums;\r
  color: var(--tcw-text);\r
  background: var(--tcw-bg-surface);\r
  border: 1px solid var(--tcw-accent);\r
  border-radius: var(--tcw-input-radius);\r
  outline: none;\r
}\r
.tcw-interval-field[aria-invalid] { border-color: var(--tcw-red); }\r
.tcw-interval-hint { font-size: var(--tcw-font-size-xs); color: var(--tcw-text-muted); max-width: 170px; }\r
\r
/* --- Alerts: lines, moves, bar close, expiry --- */\r
.tcw-alerts-source { grid-column: auto; }\r
.tcw-alerts-row-fields {\r
  grid-column: 1 / -1;\r
  display: grid;\r
  grid-template-columns: 1fr 1fr;\r
  gap: 8px;\r
}\r
.tcw-alerts-row-fields[hidden] { display: none; }\r
.tcw-alerts-row-fields > input[hidden] { display: none; }\r
.tcw-alerts-row-fields:has(> input[hidden]) { grid-template-columns: 1fr; }\r
.tcw-alerts-options { align-items: center; }\r
.tcw-alerts-form .tcw-alerts-check {\r
  display: inline-flex;\r
  align-items: center;\r
  gap: 6px;\r
  font-size: var(--tcw-font-size-sm);\r
  color: var(--tcw-text-dim);\r
}\r
.tcw-alerts-form .tcw-alerts-check input { width: auto; height: auto; }\r
.tcw-alerts-form input[aria-invalid="true"] { border-color: var(--tcw-red); }\r
.tcw-alerts-row-meta { margin-top: 2px; font-size: var(--tcw-font-size-xs); color: var(--tcw-text-muted); }\r
.tcw-alerts-expired { opacity: 0.6; }\r
\r
/* --- Signal marker note --- */\r
.tcw-marker-tip {\r
  position: absolute;\r
  z-index: 12;\r
  pointer-events: none;\r
  padding: 6px 8px;\r
  border: 1px solid var(--tcw-border);\r
  border-radius: var(--tcw-tooltip-radius);\r
  background: var(--tcw-tooltip-bg);\r
  color: var(--tcw-tooltip-fg);\r
  font-size: var(--tcw-font-size-xs);\r
  line-height: 1.45;\r
  font-variant-numeric: tabular-nums;\r
  box-shadow: var(--tcw-menu-shadow);\r
  max-width: 240px;\r
}\r
.tcw-marker-tip strong { display: block; font-size: var(--tcw-font-size-sm); }\r
\r
/* === Navigation over the chart ===\r
 * Centred on the plot's bottom edge, shown while a mouse is over the chart. */\r
.tcw-nav {\r
  position: absolute;\r
  z-index: 15;\r
  display: flex;\r
  gap: 2px;\r
  padding: 3px;\r
  border: var(--tcw-border-w) solid var(--tcw-border);\r
  border-radius: calc(var(--tcw-control-radius) + 3px);\r
  background: var(--tcw-bg-elevated);\r
  box-shadow: var(--tcw-menu-shadow);\r
  opacity: 0;\r
  pointer-events: none;\r
  transform: translate(-50%, calc(-100% - 12px));\r
  transition: opacity var(--tcw-dur-fast) var(--tcw-ease);\r
}\r
.tcw-nav.tcw-nav-shown {\r
  opacity: 1;\r
  pointer-events: auto;\r
}\r
.tcw-nav-btn {\r
  display: inline-flex;\r
  align-items: center;\r
  justify-content: center;\r
  width: var(--tcw-control-h);\r
  height: var(--tcw-control-h);\r
  border: 0;\r
  border-radius: var(--tcw-control-radius);\r
  background: transparent;\r
  color: var(--tcw-text-dim);\r
  cursor: pointer;\r
  touch-action: none;\r
}\r
.tcw-nav-btn:hover {\r
  background: var(--tcw-hover-bg);\r
  color: var(--tcw-text);\r
}\r
.tcw-nav-btn:active {\r
  background: var(--tcw-active-bg);\r
}\r
.tcw-nav-btn:focus-visible {\r
  outline: none;\r
  box-shadow: var(--tcw-ring);\r
}\r
.tcw-nav-btn svg {\r
  width: var(--tcw-icon);\r
  height: var(--tcw-icon);\r
}\r
@media (hover: none) {\r
  .tcw-nav { display: none; }\r
}\r
\r
/* === Symbol info ===\r
 * Top left, beside the drawing tools: the panels on the right stay clear. */\r
.tcw-syminfo {\r
  position: absolute;\r
  top: var(--tcw-panel-top);\r
  inset-inline-start: var(--tcw-panel-left);\r
  z-index: 38;\r
  width: 288px;\r
  max-height: calc(100% - var(--tcw-panel-top) - 12px);\r
  display: flex;\r
  flex-direction: column;\r
  background: var(--tcw-bg-elevated);\r
  border: var(--tcw-border-w) solid var(--tcw-border-strong);\r
  border-radius: var(--tcw-panel-radius);\r
  box-shadow: var(--tcw-menu-shadow);\r
  overflow: hidden;\r
  animation: tcw-alerts-in var(--tcw-dur, 160ms) var(--tcw-ease, ease) both;\r
}\r
.tcw-syminfo-header {\r
  display: flex;\r
  align-items: center;\r
  justify-content: space-between;\r
  padding: 9px 12px;\r
  font-size: var(--tcw-font-size-sm);\r
  font-weight: var(--tcw-weight-strong);\r
  color: var(--tcw-text);\r
  border-bottom: 1px solid var(--tcw-border);\r
}\r
.tcw-syminfo-close {\r
  display: inline-flex;\r
  align-items: center;\r
  justify-content: center;\r
  width: var(--tcw-control-h-sm);\r
  height: var(--tcw-control-h-sm);\r
  border: none;\r
  border-radius: var(--tcw-control-radius);\r
  background: transparent;\r
  color: var(--tcw-text-muted);\r
  cursor: pointer;\r
}\r
.tcw-syminfo-close:hover { background: var(--tcw-bg-surface); color: var(--tcw-text); }\r
.tcw-syminfo-body,\r
.tcw-syminfo-news {\r
  padding: 12px 14px;\r
  overflow-y: auto;\r
}\r
.tcw-syminfo-body {\r
  display: grid;\r
  gap: 10px;\r
}\r
.tcw-syminfo-symbol {\r
  font-size: var(--tcw-font-size-lg);\r
  font-weight: var(--tcw-weight-strong);\r
  color: var(--tcw-text);\r
}\r
.tcw-syminfo-desc {\r
  font-size: var(--tcw-font-size-sm);\r
  color: var(--tcw-text-dim);\r
}\r
.tcw-syminfo-meta {\r
  margin-top: 2px;\r
  font-size: var(--tcw-font-size-xs);\r
  color: var(--tcw-text-muted);\r
}\r
.tcw-syminfo-quote {\r
  display: flex;\r
  align-items: baseline;\r
  gap: 10px;\r
  font-family: var(--tcw-font-mono);\r
  font-variant-numeric: tabular-nums;\r
}\r
.tcw-syminfo-price {\r
  font-size: var(--tcw-font-size-display);\r
  font-weight: var(--tcw-weight-strong);\r
  color: var(--tcw-text);\r
}\r
.tcw-syminfo-change { font-size: var(--tcw-font-size-sm); }\r
.tcw-syminfo-change.tcw-up { color: var(--tcw-green); }\r
.tcw-syminfo-change.tcw-down { color: var(--tcw-red); }\r
.tcw-syminfo-status {\r
  display: flex;\r
  align-items: center;\r
  gap: 7px;\r
  font-size: var(--tcw-font-size-sm);\r
  color: var(--tcw-text-dim);\r
}\r
.tcw-syminfo-status::before,\r
.tcw-status-market::before {\r
  content: '';\r
  flex: none;\r
  width: 7px;\r
  height: 7px;\r
  border-radius: 50%;\r
  background: var(--tcw-text-muted);\r
}\r
.tcw-syminfo-status[data-state='open']::before,\r
.tcw-syminfo-status[data-state='always']::before,\r
.tcw-status-market[data-state='open']::before {\r
  background: var(--tcw-green);\r
}\r
.tcw-syminfo-stats {\r
  display: grid;\r
  gap: 4px;\r
  margin: 0;\r
  padding-top: 10px;\r
  border-top: 1px solid var(--tcw-divider);\r
}\r
.tcw-syminfo-stat {\r
  display: flex;\r
  justify-content: space-between;\r
  gap: 12px;\r
  font-size: var(--tcw-font-size-sm);\r
}\r
.tcw-syminfo-stat dt { color: var(--tcw-text-muted); }\r
.tcw-syminfo-stat dd {\r
  margin: 0;\r
  color: var(--tcw-text);\r
  text-align: end;\r
  font-variant-numeric: tabular-nums;\r
  overflow-wrap: anywhere;\r
}\r
.tcw-syminfo-news {\r
  border-top: 1px solid var(--tcw-divider);\r
}\r
.tcw-syminfo-news-title {\r
  margin-bottom: 8px;\r
  font-size: var(--tcw-font-size-xs);\r
  font-weight: var(--tcw-weight-strong);\r
  color: var(--tcw-text-muted);\r
  text-transform: var(--tcw-label-case);\r
  letter-spacing: var(--tcw-label-tracking);\r
}\r
.tcw-syminfo-news-list {\r
  display: grid;\r
  gap: 10px;\r
  margin: 0;\r
  padding: 0;\r
  list-style: none;\r
}\r
.tcw-syminfo-news-item {\r
  font-size: var(--tcw-font-size-sm);\r
  line-height: 1.4;\r
  color: var(--tcw-text);\r
}\r
.tcw-syminfo-news-item a {\r
  color: var(--tcw-text);\r
  text-decoration: none;\r
}\r
.tcw-syminfo-news-item a:hover { color: var(--tcw-accent); text-decoration: underline; }\r
.tcw-syminfo-news-item a:focus-visible { outline: none; box-shadow: var(--tcw-ring); border-radius: var(--tcw-radius-xs); }\r
.tcw-syminfo-news-meta,\r
.tcw-syminfo-news-note {\r
  margin-top: 2px;\r
  font-size: var(--tcw-font-size-xs);\r
  color: var(--tcw-text-muted);\r
}\r
\r
/* Numbers keep their sign on the left, and mixed text its own order, in a right-to-left widget too. */\r
.tcw-watchlist-price,\r
.tcw-watchlist-change,\r
.tcw-syminfo-price,\r
.tcw-syminfo-change {\r
  unicode-bidi: isolate;\r
  direction: ltr;\r
}\r
.tcw-syminfo-desc,\r
.tcw-syminfo-meta,\r
.tcw-syminfo-status,\r
.tcw-syminfo-stat dd,\r
.tcw-syminfo-news-meta {\r
  unicode-bidi: plaintext;\r
}\r
\r
/* The market's status in the status bar. */\r
.tcw-status-market {\r
  display: flex;\r
  align-items: center;\r
  gap: 7px;\r
  color: var(--tcw-text-muted);\r
}\r
\r
@media (max-width: 640px) {\r
  .tcw-syminfo {\r
    top: auto;\r
    bottom: 0;\r
    left: 0;\r
    right: 0;\r
    width: 100vw;\r
    max-height: 70%;\r
    border-radius: var(--tcw-dialog-radius) var(--tcw-dialog-radius) 0 0;\r
  }\r
}\r
\r
/* === The look: how chosen controls show, floating bars, segmented intervals ===\r
 * Each switch sets variables on its own root, which its parts read: a grid's\r
 * look never reaches into a chart that has one of its own. */\r
\r
/* A chosen button (\`ui.active\`): a tinted fill (default), a solid pill, or an underline.\r
 * Dialog tabs are chips, or underlined in the underline look. Panels sit below the\r
 * toolbar and beside the drawing tools. */\r
.tcw-root {\r
  --tcw-on-bg: var(--tcw-accent-soft);\r
  --tcw-on-fg: var(--tcw-accent);\r
  --tcw-on-ring: none;\r
  --tcw-on-icon-bg: var(--tcw-accent-soft);\r
  --tcw-on-icon-fg: var(--tcw-accent);\r
  --tcw-on-icon-ring: none;\r
  --tcw-tabs-pad-block: var(--tcw-space-4);\r
  --tcw-tab-h: var(--tcw-control-h);\r
  --tcw-tab-pad: 0 var(--tcw-space-5);\r
  --tcw-tab-line: 0px;\r
  --tcw-tab-radius: var(--tcw-control-radius);\r
  --tcw-tab-hover: var(--tcw-hover-bg);\r
  --tcw-tab-on-bg: var(--tcw-on-bg);\r
  --tcw-tab-on-fg: var(--tcw-on-fg);\r
  /* A menu's rows sit inside its padding with corners that follow its own: the menu's\r
   * corner less the padding between, so the two curves run parallel (Print: 5 - 3 = 2). */\r
  --tcw-menu-pad: var(--tcw-space-2);\r
  --tcw-menu-item-radius: max(0px, calc(var(--tcw-menu-radius) - var(--tcw-menu-pad)));\r
  --tcw-panel-top: calc(var(--tcw-toolbar-h) + var(--tcw-space-3));\r
  --tcw-panel-left: calc(var(--tcw-sidebar-w) + var(--tcw-space-5));\r
}\r
.tcw-root[data-tcw-active='solid'] {\r
  --tcw-on-bg: var(--tcw-text);\r
  --tcw-on-fg: var(--tcw-bg);\r
  --tcw-on-icon-bg: var(--tcw-text);\r
  --tcw-on-icon-fg: var(--tcw-bg);\r
}\r
/* Print picks a tool in ink blue on a tint: a solid square would outweigh the chart beside it. */\r
.tcw-root[data-tcw-ui='print'][data-tcw-active='solid'] {\r
  --tcw-on-icon-bg: var(--tcw-accent-soft);\r
  --tcw-on-icon-fg: var(--tcw-accent);\r
}\r
.tcw-root[data-tcw-active='underline'] {\r
  --tcw-on-bg: var(--tcw-active-bg);\r
  --tcw-on-fg: var(--tcw-text);\r
  --tcw-on-ring: inset 0 -2px 0 var(--tcw-accent);\r
  --tcw-on-icon-bg: var(--tcw-active-bg);\r
  --tcw-on-icon-fg: var(--tcw-accent);\r
  --tcw-on-icon-ring: inset 2px 0 0 var(--tcw-accent);\r
  --tcw-tabs-pad-block: 0px;\r
  --tcw-tab-h: auto;\r
  --tcw-tab-pad: 11px 14px;\r
  --tcw-tab-line: 2px;\r
  --tcw-tab-radius: 0px;\r
  --tcw-tab-hover: transparent;\r
  --tcw-tab-on-bg: transparent;\r
  --tcw-tab-on-fg: var(--tcw-accent);\r
}\r
.tcw-root[data-tcw-toolbar='floating'] {\r
  --tcw-panel-top: calc(var(--tcw-toolbar-h) + 2 * var(--tcw-border-w) + 14px);\r
}\r
.tcw-root[data-tcw-sidebar='floating'] {\r
  --tcw-panel-left: calc(var(--tcw-sidebar-w) + 2 * var(--tcw-border-w) + 22px);\r
}\r
\r
/* The toolbar as an island (\`ui.toolbar: 'floating'\`). */\r
.tcw-root[data-tcw-toolbar='floating'] > .tcw-toolbar {\r
  margin: 8px 10px 0;\r
  padding-inline: calc(min(var(--tcw-toolbar-radius), var(--tcw-toolbar-h) / 2) / 2 + 8px);\r
  border: var(--tcw-border-w) solid var(--tcw-border);\r
  border-radius: var(--tcw-toolbar-radius);\r
  background: var(--tcw-bg-elevated);\r
  box-shadow: var(--tcw-menu-shadow);\r
}\r
\r
/* The drawing tools as an island (\`ui.sidebar: 'floating'\`). */\r
.tcw-root[data-tcw-sidebar='floating'] > .tcw-body > .tcw-sidebar {\r
  align-self: flex-start;\r
  max-height: calc(100% - 20px);\r
  margin: 10px 6px 10px 10px;\r
  padding-block: calc(min(var(--tcw-sidebar-radius), var(--tcw-sidebar-w) / 2) / 2 + 6px);\r
  border: var(--tcw-border-w) solid var(--tcw-border);\r
  border-radius: var(--tcw-sidebar-radius);\r
  background: var(--tcw-bg-elevated);\r
  box-shadow: var(--tcw-menu-shadow);\r
}\r
\r
/* Frosted menus (\`ui.blur\` above 0): the chart shows through, blurred. */\r
@supports (background: color-mix(in srgb, red 50%, transparent)) {\r
  .tcw-dropdown,\r
  .tcw-flyout,\r
  .tcw-context-menu {\r
    background: color-mix(in srgb, var(--tcw-bg-elevated) var(--tcw-surface-opacity), transparent);\r
  }\r
}\r
\r
/* The interval buttons in one track (\`ui.intervals: 'segmented'\`). */\r
.tcw-root[data-tcw-intervals='segmented'] > .tcw-toolbar > .tcw-tf-group {\r
  gap: 2px;\r
  margin: 0 4px;\r
  padding: 3px;\r
  border-radius: calc(var(--tcw-control-radius) + 3px);\r
  background: var(--tcw-hover-bg);\r
}\r
.tcw-root[data-tcw-intervals='segmented'] > .tcw-toolbar > .tcw-tf-group .tcw-btn {\r
  height: calc(var(--tcw-control-h) - 6px);\r
  padding: 0 9px;\r
}\r
\r
/* Phones: the variants keep comfortable tap targets and room for the bar. */\r
@media (max-width: 768px) {\r
  .tcw-root[data-tcw-intervals='segmented'] > .tcw-toolbar > .tcw-tf-group .tcw-btn {\r
    height: max(34px, calc(var(--tcw-control-h) - 6px));\r
    padding: 0 10px;\r
  }\r
  .tcw-root[data-tcw-toolbar='floating'] > .tcw-toolbar {\r
    margin: 6px 6px 0;\r
    padding-inline: 4px;\r
  }\r
  .tcw-root[data-tcw-sidebar='floating'] > .tcw-body > .tcw-sidebar {\r
    margin: 6px 4px 6px 6px;\r
  }\r
}\r
\r
/* --- Phones and tablets --- */\r
\r
/* Taps without the grey flash or the double-tap zoom's wait. The chart area\r
   sets its own touch-action for its gestures. */\r
.tcw-root {\r
  -webkit-tap-highlight-color: transparent;\r
  touch-action: manipulation;\r
}\r
\r
/* iOS zooms the page into an input under 16 px when it takes focus. */\r
@media (pointer: coarse) {\r
  .tcw-root input:not([type='color']):not([type='range']):not([type='checkbox']):not([type='radio']),\r
  .tcw-root select,\r
  .tcw-root textarea {\r
    font-size: max(16px, 1em);\r
  }\r
}\r
\r
/* Sheets and lists scroll on their own, without dragging the page behind them. */\r
.tcw-modal,\r
.tcw-cmd-palette,\r
.tcw-cmd-list {\r
  overscroll-behavior: contain;\r
}\r
\r
/* === The bars' newer parts ===\r
 * Interval sections and the chart type's icon, the Trade menu's button, undo\r
 * and redo off while idle, the tool menus' shortcuts and stars, the status\r
 * bar's clock and scale switches, and the grip of the selection toolbar. */\r
\r
/* The interval menu: each unit under its heading, a hairline between them. */\r
.tcw-tf-section + .tcw-tf-section {\r
  margin-top: var(--tcw-space-2);\r
  padding-top: var(--tcw-space-1);\r
  border-top: 1px solid var(--tcw-divider);\r
}\r
\r
/* The chart type: its icon alone, square. */\r
.tcw-dropdown-trigger[data-role='charttype'] {\r
  justify-content: center;\r
  width: var(--tcw-control-h);\r
  padding: 0;\r
}\r
\r
/* Undo and redo with nothing to do: there, quiet, not pressable. */\r
.tcw-btn-icon:disabled {\r
  opacity: 0.35;\r
  cursor: default;\r
  background: transparent;\r
  color: var(--tcw-text-muted);\r
}\r
\r
/* A tool menu's row: the tool, its shortcut, and a star beside it. */\r
.tcw-flyout-row {\r
  display: flex;\r
  align-items: center;\r
  gap: var(--tcw-space-1);\r
}\r
.tcw-flyout-row > .tcw-flyout-item {\r
  flex: 1;\r
  min-width: 0;\r
}\r
.tcw-flyout-name {\r
  flex: 1;\r
  min-width: 0;\r
  overflow: hidden;\r
  text-overflow: ellipsis;\r
  white-space: nowrap;\r
}\r
.tcw-flyout-key {\r
  flex: none;\r
  margin-inline-start: var(--tcw-space-5);\r
  font-family: var(--tcw-font-mono);\r
  font-size: var(--tcw-font-size-xs);\r
  color: var(--tcw-text-muted);\r
}\r
.tcw-flyout-pin {\r
  flex: none;\r
  display: inline-grid;\r
  place-items: center;\r
  width: var(--tcw-control-h-sm);\r
  height: var(--tcw-control-h-sm);\r
  border: none;\r
  border-radius: var(--tcw-menu-item-radius);\r
  background: transparent;\r
  color: var(--tcw-text-muted);\r
  cursor: pointer;\r
  opacity: 0;\r
  transition: opacity var(--tcw-dur-fast) var(--tcw-ease), color var(--tcw-dur-fast) var(--tcw-ease);\r
}\r
/* Shown on the row in hand; always for a pinned tool, filled in ink blue; always on a touch screen. */\r
.tcw-flyout-row:hover .tcw-flyout-pin,\r
.tcw-flyout-row:focus-within .tcw-flyout-pin,\r
.tcw-flyout-pin[aria-pressed='true'],\r
.tcw-root[data-tcw-narrow] .tcw-flyout-pin {\r
  opacity: 1;\r
}\r
@media (hover: none) {\r
  .tcw-flyout-pin {\r
    opacity: 1;\r
  }\r
}\r
.tcw-flyout-pin:hover {\r
  color: var(--tcw-text);\r
  background: var(--tcw-hover-bg);\r
}\r
.tcw-flyout-pin[aria-pressed='true'] {\r
  color: var(--tcw-accent);\r
}\r
.tcw-flyout-pin[aria-pressed='true'] svg path {\r
  fill: currentColor;\r
}\r
\r
/* The clock: the time in figures, the zone beside it; it opens the zones. */\r
.tcw-status-clock,\r
.tcw-status-scale-btn {\r
  height: var(--tcw-control-h-sm);\r
  padding: 0 var(--tcw-space-3);\r
  border: none;\r
  border-radius: var(--tcw-control-radius);\r
  background: transparent;\r
  color: var(--tcw-text-dim);\r
  font: inherit;\r
  cursor: pointer;\r
  transition: color var(--tcw-dur-fast) var(--tcw-ease), background var(--tcw-dur-fast) var(--tcw-ease);\r
}\r
.tcw-status-clock {\r
  font-family: var(--tcw-font-mono);\r
}\r
.tcw-status-clock:hover,\r
.tcw-status-scale-btn:hover {\r
  color: var(--tcw-text);\r
  background: var(--tcw-hover-bg);\r
}\r
.tcw-status-clock:focus-visible,\r
.tcw-status-scale-btn:focus-visible {\r
  outline: 2px solid var(--tcw-accent);\r
  outline-offset: -2px;\r
}\r
\r
/* The scale switches: %, log, auto, in ink blue while on. */\r
.tcw-status-scale {\r
  display: flex;\r
  align-items: center;\r
  gap: var(--tcw-space-1);\r
  padding-inline-start: var(--tcw-space-3);\r
  border-inline-start: var(--tcw-sep-w) solid var(--tcw-border);\r
}\r
.tcw-status-scale-btn[aria-pressed='true'] {\r
  color: var(--tcw-accent);\r
  font-weight: var(--tcw-weight-strong);\r
}\r
\r
/* A narrow widget keeps the range presets and the clock: the scale switches (also in the\r
   settings and the scale's menu) give them the room, and the connection's word is left to\r
   screen readers beside its dot. */\r
.tcw-root[data-tcw-narrow] .tcw-status-scale {\r
  display: none;\r
}\r
.tcw-root[data-tcw-narrow] .tcw-status-indicator > span:not(.tcw-status-dot) {\r
  position: absolute;\r
  width: 1px;\r
  height: 1px;\r
  overflow: hidden;\r
  clip-path: inset(50%);\r
  white-space: nowrap;\r
}\r
\r
/* The selection toolbar's grip: dots to take it by. */\r
.tcw-sel-grip {\r
  flex: none;\r
  width: var(--tcw-space-4);\r
  height: var(--tcw-control-h-sm);\r
  margin-inline: var(--tcw-space-1) var(--tcw-space-2);\r
  background-image: radial-gradient(circle, var(--tcw-text-muted) 1px, transparent 1.4px);\r
  background-size: 4px 4px;\r
  background-position: center;\r
  opacity: 0.7;\r
  cursor: grab;\r
  touch-action: none;\r
}\r
.tcw-sel-grip:active {\r
  cursor: grabbing;\r
}\r
\r
/* --- A narrow widget (a phone, or a narrow column): data-tcw-narrow ---\r
   Set from the widget's own width, below 641px. The toolbar keeps the\r
   chart's own controls (symbol, interval, type, indicators) and puts the\r
   rest under "more"; the drawing tools wait behind a button over the chart;\r
   a grid shows one chart at a time, picked by its tab. */\r
\r
.tcw-toolbar-more,\r
.tcw-sidebar-fab,\r
.tcw-tf-current,\r
.tcw-grid-tabs {\r
  display: none;\r
}\r
\r
/* The toolbar fits itself too (on a tablet, a window half a screen wide):\r
   the right-hand buttons that don't fit fold under "more" (\`--collapsed\`\r
   shows it), and \`--icons\` drops the menus' labels and the interval buttons.\r
   Narrow folds them all. */\r
.tcw-toolbar [data-tcw-folded],\r
.tcw-root[data-tcw-narrow] > .tcw-toolbar .tcw-toolbar-overflow {\r
  display: none;\r
}\r
.tcw-toolbar--collapsed > .tcw-toolbar-more,\r
.tcw-root[data-tcw-narrow] > .tcw-toolbar > .tcw-toolbar-more {\r
  display: inline-flex;\r
  margin-inline-start: auto;\r
}\r
.tcw-toolbar--icons.tcw-toolbar--tf-menu > .tcw-tf-group,\r
.tcw-root[data-tcw-narrow] > .tcw-toolbar.tcw-toolbar--tf-menu > .tcw-tf-group {\r
  display: none;\r
}\r
.tcw-toolbar--icons .tcw-tf-more,\r
.tcw-root[data-tcw-narrow] > .tcw-toolbar .tcw-tf-more {\r
  display: inline-flex;\r
  align-items: center;\r
  gap: 4px;\r
  padding: 0 10px;\r
}\r
.tcw-toolbar--icons .tcw-tf-current,\r
.tcw-root[data-tcw-narrow] > .tcw-toolbar .tcw-tf-current {\r
  display: inline;\r
  font-weight: var(--tcw-weight-strong);\r
  color: var(--tcw-accent);\r
}\r
.tcw-toolbar--icons .tcw-trigger-label,\r
.tcw-root[data-tcw-narrow] > .tcw-toolbar .tcw-trigger-label {\r
  display: none;\r
}\r
\r
/* The drawing tools lie over the chart when opened, from its edge. */\r
.tcw-root[data-tcw-narrow] > .tcw-body > .tcw-sidebar {\r
  position: absolute;\r
  inset-block: 0;\r
  inset-inline-start: 0;\r
  /* Under the toolbar (20), whose menus open over it. */\r
  z-index: 18;\r
  box-shadow: var(--tcw-menu-shadow);\r
  transform: translateX(-100%);\r
  visibility: hidden;\r
  transition: transform var(--tcw-dur-normal) var(--tcw-ease-out), visibility 0s linear var(--tcw-dur-normal);\r
}\r
.tcw-root[data-tcw-narrow][dir='rtl'] > .tcw-body > .tcw-sidebar {\r
  transform: translateX(100%);\r
}\r
.tcw-root[data-tcw-narrow] > .tcw-body > .tcw-sidebar.tcw-sidebar-open {\r
  transform: none;\r
  visibility: visible;\r
  transition: transform var(--tcw-dur-normal) var(--tcw-ease-out), visibility 0s;\r
}\r
.tcw-root[data-tcw-narrow] > .tcw-body > .tcw-flyout {\r
  z-index: 19;\r
}\r
.tcw-root[data-tcw-narrow] > .tcw-body > .tcw-sidebar-fab {\r
  display: inline-flex;\r
  align-items: center;\r
  justify-content: center;\r
  position: absolute;\r
  inset-inline-start: 10px;\r
  /* Clear of the time axis. */\r
  bottom: 44px;\r
  z-index: 17;\r
  width: 44px;\r
  height: 44px;\r
  padding: 0;\r
  border: var(--tcw-border-w) solid var(--tcw-border-strong);\r
  border-radius: 999px;\r
  background: var(--tcw-bg-elevated);\r
  color: var(--tcw-text);\r
  box-shadow: var(--tcw-menu-shadow);\r
  cursor: pointer;\r
  transition: background var(--tcw-dur-fast), color var(--tcw-dur-fast), border-color var(--tcw-dur-fast);\r
}\r
.tcw-root[data-tcw-narrow] > .tcw-body > .tcw-sidebar-fab.tcw-active {\r
  background: var(--tcw-accent);\r
  border-color: var(--tcw-accent);\r
  color: var(--tcw-accent-ink);\r
}\r
.tcw-root[data-tcw-narrow] > .tcw-body > .tcw-sidebar-fab:focus-visible {\r
  outline: none;\r
  box-shadow: var(--tcw-ring);\r
}\r
.tcw-root[data-tcw-narrow] > .tcw-body > .tcw-sidebar-fab[aria-expanded='true'] {\r
  visibility: hidden;\r
}\r
\r
@media (prefers-reduced-motion: reduce) {\r
  .tcw-root[data-tcw-narrow] > .tcw-body > .tcw-sidebar,\r
  .tcw-root[data-tcw-narrow] > .tcw-body > .tcw-sidebar.tcw-sidebar-open {\r
    transition: none;\r
  }\r
}\r
\r
/* A narrow grid: one chart at a time, a tab for each. */\r
.tcw-grid[data-tcw-narrow] > .tcw-grid-bar > .tcw-grid-tabs {\r
  display: flex;\r
}\r
.tcw-grid-tab {\r
  white-space: nowrap;\r
}\r
.tcw-grid-has-tabs[data-tcw-narrow] > .tcw-grid-cells {\r
  display: flex;\r
  flex-direction: column;\r
}\r
.tcw-grid-has-tabs[data-tcw-narrow] > .tcw-grid-cells > .tcw-grid-cell {\r
  flex: 1;\r
}\r
.tcw-grid-has-tabs[data-tcw-narrow] > .tcw-grid-cells > .tcw-grid-cell:not(.tcw-grid-cell-current) {\r
  display: none;\r
}\r
.tcw-grid-has-tabs[data-tcw-narrow] > .tcw-grid-cells > .tcw-grid-cell-active::after {\r
  display: none;\r
}\r
\r
/* Phones: menus open as sheets from the bottom, in reach of a thumb and\r
   never off screen (a menu's own place may be off the side of a phone). */\r
@media (max-width: 640px) {\r
  .tcw-dropdown,\r
  .tcw-context-menu {\r
    position: fixed !important;\r
    /* Above the on-screen keyboard (the indicators' search). */\r
    inset: auto 0 var(--tcw-keyboard-inset, 0px) 0 !important;\r
    margin: 0 !important;\r
    width: auto;\r
    max-width: none;\r
    max-height: 70vh !important;\r
    max-height: 70dvh !important;\r
    overflow-y: auto;\r
    overscroll-behavior: contain;\r
    z-index: 80;\r
    padding: 8px 8px calc(8px + env(safe-area-inset-bottom, 0px));\r
    border-radius: var(--tcw-dialog-radius) var(--tcw-dialog-radius) 0 0;\r
    border-bottom: none;\r
  }\r
  .tcw-dropdown-item,\r
  .tcw-context-item {\r
    min-height: 44px;\r
  }\r
}\r
`,Ci=`/* === Base controls: fields, selects, checks, sliders, calendar, scrollbars ===\r
 *\r
 * One look for every form control in the widget, from tokens. Fields are\r
 * quiet until used: a faint fill and hairline, a firmer line on hover, and\r
 * on focus the line turns accent (no ring). Selects and date fields open\r
 * the widget's own list and calendar (formControls.ts).\r
 */\r
\r
.tcw-root {\r
  color-scheme: dark;\r
\r
  --tcw-field-bg: rgba(230, 227, 220, 0.04);\r
  --tcw-field-bg-hover: rgba(230, 227, 220, 0.06);\r
  --tcw-field-bg-focus: rgba(230, 227, 220, 0.03);\r
  --tcw-field-line: rgba(230, 227, 220, 0.12);\r
  --tcw-field-line-hover: rgba(230, 227, 220, 0.22);\r
  --tcw-field-line-focus: var(--tcw-accent-line);\r
  --tcw-field-placeholder: var(--tcw-text-muted);\r
  --tcw-check-line: rgba(230, 227, 220, 0.3);\r
  --tcw-scroll-thumb: rgba(230, 227, 220, 0.14);\r
  --tcw-scroll-thumb-hover: rgba(230, 227, 220, 0.26);\r
  /* Glyphs drawn in a field's background (a background image takes no currentColor). */\r
  --tcw-field-chevron: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Cpath d='M3 4.75l3 3 3-3' fill='none' stroke='%238c8a85' stroke-width='1.4' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");\r
  --tcw-field-calendar: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cg fill='none' stroke='%238c8a85' stroke-width='1.3' stroke-linecap='round'%3E%3Crect x='2.5' y='3.5' width='11' height='10' rx='2'/%3E%3Cpath d='M2.5 6.5h11M5.5 2v3M10.5 2v3'/%3E%3C/g%3E%3C/svg%3E");\r
  --tcw-check-mark: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M4 8.25l2.6 2.6L12 5.5' fill='none' stroke='%23131416' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");\r
}\r
\r
.tcw-root[data-tcw-theme='light'] {\r
  color-scheme: light;\r
\r
  /* Fields are white boxes on the paper, ruled in ink, as on a printed form. */\r
  --tcw-field-bg: #ffffff;\r
  --tcw-field-bg-hover: #ffffff;\r
  --tcw-field-bg-focus: #ffffff;\r
  --tcw-field-line: rgba(27, 29, 33, 0.16);\r
  --tcw-field-line-hover: rgba(27, 29, 33, 0.3);\r
  --tcw-check-line: rgba(27, 29, 33, 0.34);\r
  --tcw-scroll-thumb: rgba(27, 29, 33, 0.16);\r
  --tcw-scroll-thumb-hover: rgba(27, 29, 33, 0.3);\r
  --tcw-field-chevron: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Cpath d='M3 4.75l3 3 3-3' fill='none' stroke='%236c7077' stroke-width='1.4' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");\r
  --tcw-field-calendar: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cg fill='none' stroke='%236c7077' stroke-width='1.3' stroke-linecap='round'%3E%3Crect x='2.5' y='3.5' width='11' height='10' rx='2'/%3E%3Cpath d='M2.5 6.5h11M5.5 2v3M10.5 2v3'/%3E%3C/g%3E%3C/svg%3E");\r
  --tcw-check-mark: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M4 8.25l2.6 2.6L12 5.5' fill='none' stroke='%23ffffff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");\r
}\r
\r
/* --- Text, number, date and time fields, and selects --- */\r
\r
/* Fields speak the widget's type, not the browser's (a part's own font still wins). */\r
:where(.tcw-root) :where(input, select, textarea, button) {\r
  font-family: inherit;\r
  font-weight: inherit;\r
  letter-spacing: inherit;\r
}\r
\r
.tcw-root :is(\r
  .tcw-tf-custom-input,\r
  .tcw-settings-select,\r
  .tcw-settings-number,\r
  .tcw-goto-input,\r
  .tcw-watchlist-input,\r
  .tcw-indi-input,\r
  .tcw-style-name,\r
  .tcw-drawing-text,\r
  .tcw-replay-speed,\r
  .tcw-alerts-form input:not([type='checkbox']),\r
  .tcw-alerts-form select\r
) {\r
  border: 1px solid var(--tcw-field-line);\r
  border-radius: var(--tcw-input-radius);\r
  background-color: var(--tcw-field-bg);\r
  color: var(--tcw-text);\r
  outline: none;\r
  box-shadow: none;\r
  transition:\r
    border-color var(--tcw-dur-fast) var(--tcw-ease),\r
    background-color var(--tcw-dur-fast) var(--tcw-ease);\r
}\r
\r
.tcw-root :is(\r
  .tcw-tf-custom-input,\r
  .tcw-settings-select,\r
  .tcw-settings-number,\r
  .tcw-goto-input,\r
  .tcw-watchlist-input,\r
  .tcw-indi-input,\r
  .tcw-style-name,\r
  .tcw-drawing-text,\r
  .tcw-replay-speed,\r
  .tcw-alerts-form input:not([type='checkbox']),\r
  .tcw-alerts-form select\r
):hover:not(:disabled, :focus) {\r
  border-color: var(--tcw-field-line-hover);\r
  background-color: var(--tcw-field-bg-hover);\r
}\r
\r
.tcw-root :is(\r
  .tcw-tf-custom-input,\r
  .tcw-settings-select,\r
  .tcw-settings-number,\r
  .tcw-goto-input,\r
  .tcw-watchlist-input,\r
  .tcw-indi-input,\r
  .tcw-style-name,\r
  .tcw-drawing-text,\r
  .tcw-replay-speed,\r
  .tcw-alerts-form input:not([type='checkbox']),\r
  .tcw-alerts-form select\r
):is(:focus, :focus-visible, [aria-expanded='true']) {\r
  border-color: var(--tcw-field-line-focus);\r
  background-color: var(--tcw-field-bg-focus);\r
  outline: none;\r
  box-shadow: none;\r
}\r
\r
.tcw-root :is(\r
  .tcw-tf-custom-input,\r
  .tcw-indi-input,\r
  .tcw-watchlist-input,\r
  .tcw-alerts-form input\r
):is([aria-invalid='true'], [aria-invalid='']):is(*, :hover, :focus) {\r
  /* As specific as the hover rule and later, so a wrong value stays red under the pointer and in focus. */\r
  border-color: var(--tcw-red);\r
  box-shadow: none;\r
}\r
\r
.tcw-root :is(input, textarea)::placeholder {\r
  color: var(--tcw-field-placeholder);\r
  opacity: 1;\r
}\r
\r
.tcw-root :is(input, select, textarea):disabled {\r
  opacity: 0.5;\r
  cursor: not-allowed;\r
}\r
\r
/* Selects: the browser's arrow gives way to a fine chevron. */\r
.tcw-root select:not([multiple]):not([size]) {\r
  appearance: none;\r
  -webkit-appearance: none;\r
  background-image: var(--tcw-field-chevron);\r
  background-repeat: no-repeat;\r
  background-size: 12px 12px;\r
  background-position: right 8px center;\r
  padding-inline-end: 26px;\r
  text-overflow: ellipsis;\r
  cursor: pointer;\r
}\r
\r
.tcw-root[dir='rtl'] select:not([multiple]):not([size]),\r
.tcw-root [dir='rtl'] select:not([multiple]):not([size]) {\r
  background-position: left 8px center;\r
}\r
\r
/* Number fields: the steppers show only on a field in use. */\r
.tcw-root input[type='number']::-webkit-inner-spin-button,\r
.tcw-root input[type='number']::-webkit-outer-spin-button {\r
  opacity: 0;\r
  transition: opacity var(--tcw-dur-fast) var(--tcw-ease);\r
}\r
\r
.tcw-root input[type='number']:is(:hover, :focus)::-webkit-inner-spin-button {\r
  opacity: 0.55;\r
}\r
\r
/* Date and time: the widget's calendar icon where the browser's own can be hidden. */\r
@supports selector(::-webkit-calendar-picker-indicator) {\r
  .tcw-root input[type='date'] {\r
    background-image: var(--tcw-field-calendar);\r
    background-repeat: no-repeat;\r
    background-size: 15px 15px;\r
    background-position: right 8px center;\r
    padding-inline-end: 30px;\r
    cursor: text;\r
  }\r
\r
  .tcw-root[dir='rtl'] input[type='date'],\r
  .tcw-root [dir='rtl'] input[type='date'] {\r
    background-position: left 8px center;\r
  }\r
}\r
\r
.tcw-root input:is([type='date'], [type='time'])::-webkit-calendar-picker-indicator {\r
  display: none;\r
}\r
\r
.tcw-root input:is([type='date'], [type='time'])::-webkit-datetime-edit-fields-wrapper {\r
  padding: 0;\r
}\r
\r
/* --- Checkboxes and radios --- */\r
\r
.tcw-root input:is([type='checkbox'], [type='radio']) {\r
  appearance: none;\r
  -webkit-appearance: none;\r
  flex-shrink: 0;\r
  width: 16px;\r
  height: 16px;\r
  margin: 0;\r
  border: 1.5px solid var(--tcw-check-line);\r
  border-radius: var(--tcw-radius-sm);\r
  background: transparent center / 14px 14px no-repeat;\r
  cursor: pointer;\r
  vertical-align: middle;\r
  transition:\r
    border-color var(--tcw-dur-fast) var(--tcw-ease),\r
    background-color var(--tcw-dur-fast) var(--tcw-ease),\r
    box-shadow var(--tcw-dur-fast) var(--tcw-ease);\r
}\r
\r
.tcw-root input[type='radio'] {\r
  border-radius: 50%;\r
}\r
\r
.tcw-root input:is([type='checkbox'], [type='radio']):hover:not(:disabled) {\r
  border-color: var(--tcw-text-dim);\r
}\r
\r
.tcw-root input[type='checkbox']:checked {\r
  border-color: var(--tcw-accent);\r
  background-color: var(--tcw-accent);\r
  background-image: var(--tcw-check-mark);\r
}\r
\r
.tcw-root input[type='radio']:checked {\r
  border-color: var(--tcw-accent);\r
  background-image: radial-gradient(circle, var(--tcw-accent) 0 3.5px, transparent 4px);\r
}\r
\r
.tcw-root input:is([type='checkbox'], [type='radio']):focus {\r
  outline: none;\r
}\r
\r
.tcw-root input:is([type='checkbox'], [type='radio']):focus-visible {\r
  box-shadow: 0 0 0 3px var(--tcw-accent-soft);\r
}\r
\r
/* --- Sliders --- */\r
\r
.tcw-root input[type='range'] {\r
  appearance: none;\r
  -webkit-appearance: none;\r
  height: 4px;\r
  border-radius: 999px;\r
  background: var(--tcw-field-line-hover);\r
  outline: none;\r
  cursor: pointer;\r
}\r
\r
.tcw-root input[type='range']::-webkit-slider-thumb {\r
  -webkit-appearance: none;\r
  appearance: none;\r
  width: 14px;\r
  height: 14px;\r
  border-radius: 50%;\r
  background: var(--tcw-accent);\r
  border: 2px solid var(--tcw-bg-elevated);\r
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);\r
  transition: transform var(--tcw-dur-fast) var(--tcw-ease);\r
}\r
\r
.tcw-root input[type='range']::-moz-range-thumb {\r
  width: 10px;\r
  height: 10px;\r
  border-radius: 50%;\r
  background: var(--tcw-accent);\r
  border: 2px solid var(--tcw-bg-elevated);\r
}\r
\r
.tcw-root input[type='range']:hover::-webkit-slider-thumb {\r
  transform: scale(1.12);\r
}\r
\r
.tcw-root input[type='range']:focus-visible::-webkit-slider-thumb {\r
  box-shadow: 0 0 0 4px var(--tcw-accent-soft);\r
}\r
\r
/* --- The select list --- */\r
\r
.tcw-select-menu {\r
  z-index: 120;\r
  padding: var(--tcw-menu-pad);\r
  max-width: min(360px, calc(100vw - 16px));\r
  font-size: var(--tcw-font-size);\r
}\r
\r
.tcw-select-group {\r
  padding: var(--tcw-space-4) var(--tcw-space-4) var(--tcw-space-2);\r
  font-size: var(--tcw-font-size-xs);\r
  font-weight: var(--tcw-weight-strong);\r
  color: var(--tcw-text-muted);\r
  text-transform: var(--tcw-label-case);\r
  letter-spacing: var(--tcw-label-tracking);\r
}\r
\r
.tcw-select-option {\r
  display: flex;\r
  align-items: center;\r
  gap: var(--tcw-space-3);\r
  min-height: var(--tcw-menu-item-h);\r
  padding-block: 0;\r
  padding-inline: var(--tcw-space-3) var(--tcw-space-5);\r
  border-radius: var(--tcw-menu-item-radius);\r
  color: var(--tcw-text-dim);\r
  cursor: pointer;\r
  user-select: none;\r
  white-space: nowrap;\r
}\r
\r
.tcw-select-option-text {\r
  overflow: hidden;\r
  text-overflow: ellipsis;\r
}\r
\r
.tcw-select-check {\r
  flex-shrink: 0;\r
  width: 14px;\r
  height: 14px;\r
}\r
\r
.tcw-select-option.tcw-active {\r
  background: var(--tcw-hover-bg);\r
  color: var(--tcw-text);\r
}\r
\r
.tcw-select-option[aria-selected='true'] {\r
  color: var(--tcw-text);\r
  font-weight: var(--tcw-weight-strong);\r
}\r
\r
.tcw-select-option[aria-selected='true'] .tcw-select-check {\r
  background: var(--tcw-accent);\r
  -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M3.5 8.25l3 3L12.5 5' fill='none' stroke='black' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center / contain no-repeat;\r
  mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M3.5 8.25l3 3L12.5 5' fill='none' stroke='black' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center / contain no-repeat;\r
}\r
\r
.tcw-select-option[aria-disabled='true'] {\r
  opacity: 0.4;\r
  cursor: default;\r
  background: none;\r
}\r
\r
/* --- The calendar --- */\r
\r
.tcw-calendar {\r
  z-index: 120;\r
  width: 268px;\r
  padding: 10px;\r
  background: var(--tcw-bg-elevated);\r
  border: var(--tcw-border-w) solid var(--tcw-border);\r
  border-radius: var(--tcw-menu-radius);\r
  box-shadow: var(--tcw-menu-shadow);\r
  color: var(--tcw-text);\r
  font-size: var(--tcw-font-size-sm);\r
  backdrop-filter: blur(var(--tcw-blur));\r
  -webkit-backdrop-filter: blur(var(--tcw-blur));\r
  animation: tcw-pop-in var(--tcw-dur-normal) var(--tcw-ease-out);\r
}\r
\r
.tcw-calendar-head {\r
  display: flex;\r
  align-items: center;\r
  gap: 4px;\r
  margin-bottom: 8px;\r
}\r
\r
.tcw-calendar-title {\r
  flex: 1;\r
  text-align: center;\r
  font-size: var(--tcw-font-size);\r
  font-weight: var(--tcw-weight-strong);\r
  letter-spacing: -0.01em;\r
}\r
\r
.tcw-calendar-nav {\r
  display: inline-grid;\r
  place-items: center;\r
  width: 28px;\r
  height: 28px;\r
  padding: 0;\r
  border: none;\r
  border-radius: var(--tcw-radius-sm);\r
  background: transparent;\r
  color: var(--tcw-text-dim);\r
  cursor: pointer;\r
  transition: background var(--tcw-dur-fast) var(--tcw-ease), color var(--tcw-dur-fast) var(--tcw-ease);\r
}\r
\r
.tcw-calendar-nav svg {\r
  width: 16px;\r
  height: 16px;\r
  fill: none;\r
  stroke: currentColor;\r
  stroke-width: 1.6;\r
  stroke-linecap: round;\r
  stroke-linejoin: round;\r
}\r
\r
.tcw-calendar[dir='rtl'] .tcw-calendar-nav svg,\r
[dir='rtl'] .tcw-calendar-nav svg {\r
  transform: scaleX(-1);\r
}\r
\r
.tcw-calendar-nav:hover {\r
  background: var(--tcw-hover-bg);\r
  color: var(--tcw-text);\r
}\r
\r
.tcw-calendar-weekdays,\r
.tcw-calendar-grid {\r
  display: grid;\r
  grid-template-columns: repeat(7, 1fr);\r
}\r
\r
.tcw-calendar-weekdays {\r
  margin-bottom: 4px;\r
  padding: 3px 0;\r
  border-radius: var(--tcw-radius-sm);\r
  background: var(--tcw-hover-bg);\r
}\r
\r
.tcw-calendar-weekday {\r
  text-align: center;\r
  font-size: var(--tcw-font-size-xs);\r
  font-weight: var(--tcw-weight-strong);\r
  color: var(--tcw-text-muted);\r
  line-height: 20px;\r
}\r
\r
.tcw-calendar-grid {\r
  row-gap: 2px;\r
}\r
\r
.tcw-calendar-week {\r
  display: contents;\r
}\r
\r
.tcw-calendar-day {\r
  position: relative;\r
  height: 32px;\r
  padding: 0;\r
  border: none;\r
  border-radius: var(--tcw-radius-sm);\r
  background: transparent;\r
  color: var(--tcw-text);\r
  font: inherit;\r
  font-variant-numeric: tabular-nums;\r
  cursor: pointer;\r
  transition: background var(--tcw-dur-fast) var(--tcw-ease);\r
}\r
\r
.tcw-calendar-day:hover:not(:disabled) {\r
  background: var(--tcw-hover-bg);\r
}\r
\r
.tcw-calendar-day.tcw-outside {\r
  color: var(--tcw-text-muted);\r
  opacity: 0.55;\r
}\r
\r
/* Today: accent figures over a short line. */\r
.tcw-calendar-day.tcw-today {\r
  color: var(--tcw-accent);\r
  font-weight: var(--tcw-weight-strong);\r
}\r
\r
.tcw-calendar-day.tcw-today::after {\r
  content: '';\r
  position: absolute;\r
  left: 50%;\r
  bottom: 5px;\r
  width: 12px;\r
  height: 2px;\r
  margin-left: -6px;\r
  border-radius: 1px;\r
  background: currentColor;\r
}\r
\r
.tcw-calendar-day[aria-selected='true'] {\r
  background: var(--tcw-accent);\r
  color: var(--tcw-accent-ink);\r
  font-weight: var(--tcw-weight-strong);\r
  opacity: 1;\r
}\r
\r
.tcw-calendar-day:disabled {\r
  opacity: 0.28;\r
  cursor: not-allowed;\r
}\r
\r
.tcw-calendar-day:focus {\r
  outline: none;\r
}\r
\r
.tcw-calendar-day:focus-visible {\r
  box-shadow: inset 0 0 0 1.5px var(--tcw-accent);\r
}\r
\r
.tcw-calendar-foot {\r
  display: flex;\r
  justify-content: flex-end;\r
  margin-top: 8px;\r
  padding-top: 8px;\r
  border-top: 1px solid var(--tcw-divider);\r
}\r
\r
.tcw-calendar-today {\r
  height: 26px;\r
  padding: 0 10px;\r
  border: none;\r
  border-radius: var(--tcw-radius-sm);\r
  background: transparent;\r
  color: var(--tcw-accent);\r
  font: inherit;\r
  font-weight: var(--tcw-weight-strong);\r
  cursor: pointer;\r
}\r
\r
.tcw-calendar-today:hover {\r
  background: var(--tcw-accent-soft);\r
}\r
\r
.tcw-calendar-today:focus-visible,\r
.tcw-calendar-nav:focus-visible {\r
  outline: none;\r
  box-shadow: inset 0 0 0 1.5px var(--tcw-accent);\r
}\r
\r
/* --- Scrollbars: thin and rounded, a thumb on no track. Low specificity:\r
   a part that hides its bar keeps it hidden. --- */\r
\r
:where(.tcw-root) ::-webkit-scrollbar {\r
  width: 10px;\r
  height: 10px;\r
}\r
\r
:where(.tcw-root) ::-webkit-scrollbar-track,\r
:where(.tcw-root) ::-webkit-scrollbar-corner {\r
  background: transparent;\r
}\r
\r
:where(.tcw-root) ::-webkit-scrollbar-thumb {\r
  background: var(--tcw-scroll-thumb);\r
  background-clip: padding-box;\r
  border: 3px solid transparent;\r
  border-radius: 999px;\r
}\r
\r
:where(.tcw-root) ::-webkit-scrollbar-thumb:hover {\r
  background: var(--tcw-scroll-thumb-hover);\r
  background-clip: padding-box;\r
  border: 2.5px solid transparent;\r
}\r
\r
/* Engines without the pseudo-elements take the standard properties. */\r
@supports not selector(::-webkit-scrollbar) {\r
  :where(.tcw-root, .tcw-root *) {\r
    scrollbar-width: thin;\r
    scrollbar-color: var(--tcw-scroll-thumb) transparent;\r
  }\r
}\r
\r
/* --- Switches: flat, no glow --- */\r
\r
.tcw-root .tcw-toggle.tcw-on {\r
  box-shadow: none;\r
}\r
\r
.tcw-root .tcw-toggle::after {\r
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);\r
}\r
\r
.tcw-root .tcw-toggle:focus-visible {\r
  outline: none;\r
  box-shadow: 0 0 0 3px var(--tcw-accent-soft);\r
}\r
`,Ti=`/* === The indicators dialog === */\r
\r
/* 610 wide, a Fibonacci number: the groups take 233 and the list 377 beside them (377 : 233 = phi).\r
   A fixed height, so the dialog keeps still while a search shortens the list. */\r
.tcw-modal.tcw-ip {\r
  width: 610px;\r
  height: min(610px, 86vh);\r
  height: min(610px, 86dvh);\r
  max-height: none;\r
}\r
\r
.tcw-ip-search {\r
  display: flex;\r
  align-items: center;\r
  gap: var(--tcw-space-3);\r
  flex: none;\r
  height: var(--tcw-control-h);\r
  margin: var(--tcw-space-4) var(--tcw-space-6);\r
  padding: 0 var(--tcw-space-4);\r
  border: var(--tcw-border-w) solid var(--tcw-border);\r
  border-radius: var(--tcw-input-radius);\r
  background: var(--tcw-bg);\r
  color: var(--tcw-text-muted);\r
  transition: border-color var(--tcw-dur-fast) var(--tcw-ease), box-shadow var(--tcw-dur-fast) var(--tcw-ease);\r
}\r
\r
.tcw-ip-search:focus-within {\r
  border-color: var(--tcw-accent);\r
  box-shadow: var(--tcw-ring);\r
}\r
\r
.tcw-ip-search svg {\r
  flex: none;\r
}\r
\r
.tcw-ip-search input {\r
  flex: 1;\r
  min-width: 0;\r
  height: 100%;\r
  border: none;\r
  outline: none;\r
  background: transparent;\r
  color: var(--tcw-text);\r
  font: inherit;\r
  font-size: var(--tcw-font-size);\r
}\r
\r
.tcw-ip-search input::placeholder {\r
  color: var(--tcw-text-muted);\r
}\r
\r
.tcw-ip-body {\r
  display: grid;\r
  grid-template-columns: 233px minmax(0, 1fr);\r
  flex: 1;\r
  min-height: 0;\r
  border-top: 1px solid var(--tcw-divider);\r
}\r
\r
.tcw-ip-nav,\r
.tcw-set-nav {\r
  display: flex;\r
  flex-direction: column;\r
  gap: 1px;\r
  padding: var(--tcw-space-4) var(--tcw-space-3);\r
  /* Logical sides: in Arabic, Hebrew or Persian the tabs sit on the right. */\r
  border-inline-end: 1px solid var(--tcw-divider);\r
  background: var(--tcw-bg-surface);\r
  overflow-y: auto;\r
  border-end-start-radius: var(--tcw-dialog-radius);\r
}\r
\r
.tcw-ip-tab,\r
.tcw-set-tab {\r
  display: flex;\r
  align-items: center;\r
  gap: var(--tcw-space-3);\r
  flex: none;\r
  height: var(--tcw-menu-item-h);\r
  padding: 0 var(--tcw-space-4);\r
  border: none;\r
  border-radius: var(--tcw-menu-item-radius);\r
  background: transparent;\r
  color: var(--tcw-text-dim);\r
  font: inherit;\r
  font-size: var(--tcw-font-size);\r
  text-align: start;\r
  white-space: nowrap;\r
  cursor: pointer;\r
  transition: background var(--tcw-dur-fast) var(--tcw-ease), color var(--tcw-dur-fast) var(--tcw-ease);\r
}\r
\r
.tcw-ip-tab svg,\r
.tcw-set-tab svg {\r
  flex: none;\r
}\r
\r
/* The kinds start below a gap: favourites and templates are yours, the rest the library's. */\r
.tcw-ip-tab[data-view='all'] {\r
  margin-top: var(--tcw-space-4);\r
}\r
\r
.tcw-ip-tab:hover,\r
.tcw-set-tab:hover {\r
  background: var(--tcw-hover-bg);\r
  color: var(--tcw-text);\r
}\r
\r
.tcw-ip-tab.tcw-active,\r
.tcw-set-tab.tcw-active {\r
  background: var(--tcw-on-bg);\r
  color: var(--tcw-on-fg);\r
  font-weight: var(--tcw-weight-strong);\r
}\r
\r
.tcw-ip-nav--searching .tcw-ip-tab.tcw-active {\r
  background: transparent;\r
  color: var(--tcw-text-dim);\r
  font-weight: var(--tcw-weight);\r
}\r
\r
.tcw-ip-list {\r
  overflow-y: auto;\r
  overscroll-behavior: contain;\r
  padding: 0 var(--tcw-space-4) var(--tcw-space-5);\r
}\r
\r
/* Each kind's name stays at the top while its indicators scroll under it. */\r
.tcw-ip-heading {\r
  position: sticky;\r
  top: 0;\r
  z-index: 1;\r
  padding: var(--tcw-space-5) var(--tcw-space-4) var(--tcw-space-2);\r
  background: var(--tcw-bg-elevated);\r
  color: var(--tcw-text-muted);\r
  font-size: var(--tcw-font-size-xs);\r
  font-weight: var(--tcw-weight-strong);\r
  text-transform: var(--tcw-label-case);\r
  letter-spacing: var(--tcw-label-tracking);\r
}\r
\r
.tcw-ip-list > :first-child:not(.tcw-ip-heading) {\r
  margin-top: var(--tcw-space-4);\r
}\r
\r
.tcw-ip-row {\r
  display: flex;\r
  align-items: center;\r
  gap: var(--tcw-space-1);\r
  border-radius: var(--tcw-menu-item-radius);\r
  transition: background var(--tcw-dur-fast) var(--tcw-ease);\r
}\r
\r
.tcw-ip-row:hover {\r
  background: var(--tcw-hover-bg);\r
}\r
\r
.tcw-ip-add {\r
  display: flex;\r
  align-items: center;\r
  gap: var(--tcw-space-3);\r
  flex: 1;\r
  min-width: 0;\r
  height: var(--tcw-menu-item-h);\r
  padding: 0 var(--tcw-space-4);\r
  border: none;\r
  border-radius: var(--tcw-menu-item-radius);\r
  background: transparent;\r
  color: var(--tcw-text);\r
  font: inherit;\r
  font-size: var(--tcw-font-size);\r
  text-align: start;\r
  cursor: pointer;\r
}\r
\r
.tcw-ip-add:focus-visible,\r
.tcw-ip-aside:focus-visible,\r
.tcw-ip-tab:focus-visible,\r
.tcw-set-tab:focus-visible {\r
  outline: none;\r
  box-shadow: var(--tcw-ring);\r
}\r
\r
.tcw-ip-add svg {\r
  flex: none;\r
  color: var(--tcw-text-muted);\r
}\r
\r
.tcw-ip-name {\r
  min-width: 0;\r
  overflow: hidden;\r
  text-overflow: ellipsis;\r
  white-space: nowrap;\r
}\r
\r
.tcw-ip-short {\r
  flex: none;\r
  color: var(--tcw-text-muted);\r
  font-family: var(--tcw-font-mono);\r
  font-size: var(--tcw-font-size-xs);\r
}\r
\r
/* Where it draws, quietly at the row's end. */\r
.tcw-ip-kind {\r
  flex: none;\r
  margin-inline-start: auto;\r
  color: var(--tcw-text-muted);\r
  font-size: var(--tcw-font-size-xs);\r
  text-transform: var(--tcw-label-case);\r
  letter-spacing: var(--tcw-label-tracking);\r
}\r
\r
/* How many are on the chart: ink on its wash, the figures in a column. */\r
.tcw-ip-count {\r
  flex: none;\r
  display: inline-grid;\r
  place-items: center;\r
  min-width: var(--tcw-space-6);\r
  height: var(--tcw-space-6);\r
  padding: 0 var(--tcw-space-2);\r
  border-radius: var(--tcw-tag-radius);\r
  background: var(--tcw-accent-soft);\r
  color: var(--tcw-accent);\r
  font-family: var(--tcw-font-mono);\r
  font-size: var(--tcw-font-size-xs);\r
  font-variant-numeric: tabular-nums;\r
}\r
\r
.tcw-ip-aside {\r
  flex: none;\r
  display: inline-grid;\r
  place-items: center;\r
  width: var(--tcw-control-h-sm);\r
  height: var(--tcw-control-h-sm);\r
  border: none;\r
  border-radius: var(--tcw-menu-item-radius);\r
  background: transparent;\r
  color: var(--tcw-text-muted);\r
  cursor: pointer;\r
  opacity: 0;\r
  transition: opacity var(--tcw-dur-fast) var(--tcw-ease), color var(--tcw-dur-fast) var(--tcw-ease);\r
}\r
\r
/* Shown on the row in hand; always for a starred one, filled in ink; always on a touch screen. */\r
.tcw-ip-row:hover .tcw-ip-aside,\r
.tcw-ip-row:focus-within .tcw-ip-aside,\r
.tcw-ip-star[aria-pressed='true'] {\r
  opacity: 1;\r
}\r
\r
@media (hover: none) {\r
  .tcw-ip-aside {\r
    opacity: 1;\r
  }\r
}\r
\r
.tcw-ip-aside:hover {\r
  color: var(--tcw-text);\r
  background: var(--tcw-hover-bg);\r
}\r
\r
.tcw-ip-star[aria-pressed='true'] {\r
  color: var(--tcw-accent);\r
}\r
\r
.tcw-ip-star[aria-pressed='true'] svg path {\r
  fill: currentColor;\r
}\r
\r
.tcw-ip-remove:hover {\r
  color: var(--tcw-red);\r
}\r
\r
.tcw-ip-save {\r
  flex: none;\r
  width: 100%;\r
  color: var(--tcw-accent);\r
  font-weight: var(--tcw-weight-strong);\r
}\r
\r
.tcw-ip-save svg {\r
  color: currentColor;\r
}\r
\r
.tcw-ip-save:hover {\r
  background: var(--tcw-accent-soft);\r
}\r
\r
.tcw-ip-empty {\r
  max-width: 34ch;\r
  padding: var(--tcw-space-6) var(--tcw-space-4);\r
  color: var(--tcw-text-muted);\r
  font-size: var(--tcw-font-size-sm);\r
  line-height: 1.5;\r
  text-wrap: pretty;\r
}\r
\r
/* Heard by a screen reader, not seen. */\r
.tcw-visually-hidden {\r
  position: absolute;\r
  width: 1px;\r
  height: 1px;\r
  overflow: hidden;\r
  clip-path: inset(50%);\r
  white-space: nowrap;\r
}\r
\r
/* A phone: the dialog is the widget's sheet, as tall as a sheet goes, and the groups a row of chips. */\r
@media (max-width: 640px) {\r
  .tcw-modal.tcw-ip {\r
    height: 92vh;\r
    height: 92dvh;\r
  }\r
\r
  .tcw-ip-search {\r
    margin-inline: var(--tcw-space-4);\r
  }\r
\r
  .tcw-ip-body {\r
    grid-template-columns: minmax(0, 1fr);\r
    grid-template-rows: auto minmax(0, 1fr);\r
  }\r
\r
  .tcw-ip-nav,\r
  .tcw-set-nav {\r
    flex-direction: row;\r
    gap: var(--tcw-space-2);\r
    padding: var(--tcw-space-3) var(--tcw-space-4);\r
    border-inline-end: none;\r
    border-bottom: 1px solid var(--tcw-divider);\r
    border-radius: 0;\r
    overflow-x: auto;\r
    overflow-y: hidden;\r
    scrollbar-width: none;\r
  }\r
\r
  .tcw-ip-tab[data-view='all'] {\r
    margin-top: 0;\r
    margin-inline-start: var(--tcw-space-4);\r
  }\r
\r
  .tcw-ip-tab,\r
  .tcw-set-tab {\r
    /* A finger's size, as the dialogs' other tabs on a phone. */\r
    min-height: 40px;\r
    border: var(--tcw-border-w) solid var(--tcw-border);\r
  }\r
\r
\r
  .tcw-ip-list {\r
    padding-inline: var(--tcw-space-3);\r
  }\r
}\r
\r
/* === The indicator settings === */\r
\r
/* One half step of phi under the indicators dialog: 610 / sqrt(phi) = 480. */\r
@media (min-width: 641px) {\r
  .tcw-modal.tcw-modal-narrow.tcw-indi {\r
    width: 480px;\r
    max-width: 92vw;\r
  }\r
}\r
\r
/* A line, or a kind of interval: ticked where it shows, its name, then what sets it. */\r
.tcw-indi-plot-name {\r
  display: inline-flex;\r
  align-items: center;\r
  gap: var(--tcw-space-4);\r
  min-width: 0;\r
  cursor: pointer;\r
}\r
\r
.tcw-indi-plot-name .tcw-settings-label {\r
  overflow: hidden;\r
  text-overflow: ellipsis;\r
  white-space: nowrap;\r
}\r
\r
/* Unticked, its name steps back. */\r
.tcw-indi-plot-name:has(input:not(:checked)) .tcw-settings-label {\r
  color: var(--tcw-text-muted);\r
}\r
\r
.tcw-indi-plot-controls,\r
.tcw-indi-range {\r
  display: inline-flex;\r
  align-items: center;\r
  gap: var(--tcw-space-3);\r
  flex: none;\r
}\r
\r
.tcw-indi-plot-controls .tcw-indi-select {\r
  width: 104px;\r
}\r
\r
.tcw-indi-range {\r
  color: var(--tcw-text-muted);\r
}\r
\r
.tcw-indi-range .tcw-indi-input {\r
  width: 68px;\r
  text-align: end;\r
}\r
\r
.tcw-indi-range .tcw-indi-input:disabled {\r
  opacity: 0.45;\r
  cursor: not-allowed;\r
}\r
\r
/* Defaults on the left; Cancel and Ok on the right, one height for all three. */\r
.tcw-indi .tcw-modal-footer,\r
.tcw-set .tcw-modal-footer {\r
  gap: var(--tcw-space-4);\r
}\r
\r
.tcw-footer-end {\r
  display: flex;\r
  align-items: center;\r
  gap: var(--tcw-space-4);\r
}\r
\r
.tcw-indi .tcw-modal-footer button,\r
.tcw-set .tcw-modal-footer button {\r
  height: var(--tcw-menu-item-h);\r
  padding-block: 0;\r
}\r
\r
.tcw-footer-menu,\r
.tcw-footer-cancel {\r
  display: inline-flex;\r
  align-items: center;\r
  gap: var(--tcw-space-2);\r
  padding-inline: var(--tcw-space-5);\r
  border: var(--tcw-border-w) solid var(--tcw-border);\r
  border-radius: var(--tcw-control-radius);\r
  background: transparent;\r
  color: var(--tcw-text-dim);\r
  font: inherit;\r
  font-size: var(--tcw-font-size);\r
  cursor: pointer;\r
  transition: background var(--tcw-dur-fast) var(--tcw-ease), color var(--tcw-dur-fast) var(--tcw-ease), border-color var(--tcw-dur-fast) var(--tcw-ease);\r
}\r
\r
.tcw-footer-cancel {\r
  border-color: var(--tcw-border-strong);\r
  color: var(--tcw-text);\r
}\r
\r
.tcw-footer-menu:hover,\r
.tcw-footer-menu[aria-expanded='true'],\r
.tcw-footer-cancel:hover {\r
  background: var(--tcw-hover-bg);\r
  color: var(--tcw-text);\r
}\r
\r
.tcw-footer-menu:focus-visible,\r
.tcw-footer-cancel:focus-visible,\r
.tcw-indi .tcw-done-btn:focus-visible,\r
.tcw-set .tcw-done-btn:focus-visible {\r
  outline: none;\r
  box-shadow: var(--tcw-ring);\r
}\r
\r
/* === The chart settings === */\r
\r
/* 776 x 610: half a step of phi wider than the indicators dialog (610 x sqrt(phi) = 776), as tall as it,\r
   so the dialog is a sqrt(phi) rectangle. The tabs take 233 down the side, as the indicator groups do. */\r
.tcw-modal.tcw-set {\r
  width: 776px;\r
  max-width: 94vw;\r
  height: min(610px, 86vh);\r
  height: min(610px, 86dvh);\r
  max-height: none;\r
}\r
\r
.tcw-set-body {\r
  display: grid;\r
  grid-template-columns: 233px minmax(0, 1fr);\r
  flex: 1;\r
  min-height: 0;\r
}\r
\r
.tcw-set-panel {\r
  min-width: 0;\r
}\r
\r
/* A phone: the widget's sheet across the screen, the tabs a row of chips over the settings. After the rules above, which it overrides. */\r
@media (max-width: 640px) {\r
  .tcw-modal.tcw-set {\r
    width: 100vw;\r
    max-width: 100vw;\r
    height: 92vh;\r
    height: 92dvh;\r
  }\r
\r
  .tcw-set-body {\r
    grid-template-columns: minmax(0, 1fr);\r
    grid-template-rows: auto minmax(0, 1fr);\r
  }\r
}\r
`,Pt=["toolbar","sidebar","statusBar","alerts","objectTree","symbolInfo","symbolSearch","settings","indicatorSettings","drawingSettings","dataWindow","commandPalette","hotkeySheet","goToDate","replay","screenshot","copyImage","shareView","autoFib","themeToggle","fullscreen","accountPanel","orderTicket","bracketOrders","depthLadder","layouts","indicatorTemplates","compare","indicatorLegend","navigation","customTimeframes","intervalTyping","dragDropImport","hotkeys","toasts","toolbar.symbol","toolbar.symbolInfo","toolbar.timeframes","toolbar.timeframeMenu","toolbar.chartType","toolbar.indicators","toolbar.layouts","toolbar.replay","toolbar.bracketOrders","toolbar.depthLadder","toolbar.accountPanel","toolbar.objectTree","toolbar.alerts","toolbar.screenshot","toolbar.settings","toolbar.themeToggle","toolbar.fullscreen","toolbar.compare","toolbar.undo","toolbar.redo","toolbar.trade","sidebar.cursor","sidebar.favorites","sidebar.lines","sidebar.fibonacci","sidebar.patterns","sidebar.forecasting","sidebar.annotation","sidebar.style","sidebar.magnet","sidebar.eraser","sidebar.zoomArea","sidebar.stayInDrawing","sidebar.undo","sidebar.redo","sidebar.clear","sidebar.lockAll","sidebar.hideAll","statusBar.range","statusBar.goToDate","statusBar.market","statusBar.connection","statusBar.symbol","statusBar.clock","statusBar.scale","statusBar.rangeTimeframe","indicatorLegend.values","indicatorLegend.visibility","indicatorLegend.settings","indicatorLegend.remove","indicatorLegend.more","pane.move","pane.collapse","pane.maximize","navigation.zoom","navigation.scroll","navigation.reset","menu.chart","menu.chart.alert","menu.chart.order","menu.chart.orderTicket","menu.chart.horizontalLine","menu.chart.resetView","menu.chart.drawings","menu.chart.exportData","menu.chart.settings","menu.chart.scale","menu.chart.goToDate","menu.chart.paneScale","menu.priceAxisAdd","menu.chart.indicators","menu.chart.timezone","menu.drawing","menu.drawing.settings","menu.drawing.alert","menu.drawing.order","menu.drawing.group","menu.drawing.lock","menu.drawing.hide","menu.drawing.duplicate","menu.drawing.delete","selectionToolbar","hotkeys.commandPalette","hotkeys.symbolSearch","hotkeys.save","hotkeys.tools","hotkeys.invertScale","hotkeys.goToDate","hotkeys.help","hotkeys.resetView"],Li=new Set(Pt),Ai={toolbar:["toolbar"],drawingTools:["sidebar","drawingSettings","hotkeys.tools","menu.chart.horizontalLine"],settings:["settings"],statusBar:["statusBar","goToDate"],rangeBar:["statusBar.range","statusBar.rangeTimeframe","goToDate"],indicatorLegend:["indicatorLegend"],fullscreen:["fullscreen"],alerts:["alerts"],objectTree:["objectTree"],accountPanel:["accountPanel","orderTicket"],indicatorTemplates:["indicatorTemplates"],intervalTyping:["intervalTyping"],symbolInfo:["symbolInfo"],navigation:["navigation"],dragDropImport:["dragDropImport"],customTimeframes:["customTimeframes"]},Or={alert:["alerts","menu.chart.alert"],buyLimit:["menu.chart.order"],buyStop:["menu.chart.order"],sellLimit:["menu.chart.order"],sellStop:["menu.chart.order"],orderTicket:["orderTicket","menu.chart.orderTicket"],horizontalLine:["menu.chart.horizontalLine"],resetView:["menu.chart.resetView"],paste:["menu.chart.drawings"],hideDrawings:["menu.chart.drawings"],showDrawings:["menu.chart.drawings"],removeDrawings:["menu.chart.drawings"],removeIndicators:["menu.chart.indicators"],settings:["settings","menu.chart.settings"],exportData:["menu.chart.exportData"],resetPriceScale:["menu.chart.scale"],autoScale:["menu.chart.scale"],invertScale:["menu.chart.scale"],leftScale:["menu.chart.scale"],regularScale:["menu.chart.scale"],logScale:["menu.chart.scale"],percentScale:["menu.chart.scale"],indexedScale:["menu.chart.scale"],labels:["menu.chart.scale"],indicatorValueLabels:["menu.chart.scale"],barCountdown:["menu.chart.scale"],lines:["menu.chart.scale"],highLowLines:["menu.chart.scale"],lastPriceLine:["menu.chart.scale"],goToDate:["goToDate","menu.chart.goToDate"],timezone:["menu.chart.timezone"],paneLog:["menu.chart.paneScale"],paneInvert:["menu.chart.paneScale"],panePercent:["menu.chart.paneScale"]},Ni={settings:["drawingSettings","menu.drawing.settings"],alert:["alerts","menu.drawing.alert"],front:["menu.drawing.order"],forward:["menu.drawing.order"],backward:["menu.drawing.order"],back:["menu.drawing.order"],group:["menu.drawing.group"],ungroup:["menu.drawing.group"],lock:["menu.drawing.lock"],unlock:["menu.drawing.lock"],hide:["menu.drawing.hide"],duplicate:["menu.drawing.duplicate"],delete:["menu.drawing.delete"]},Fr={screenshot:"screenshot",copyImage:"copyImage",toggleTheme:"themeToggle",settings:"settings",shareView:"shareView",autoFib:"autoFib",dataWindow:"dataWindow",symbolInfo:"symbolInfo"};function er(i){if(typeof i!="object"||i===null||Array.isArray(i))return{};const t={},e=[];for(const[r,n]of Object.entries(i))Li.has(r)&&typeof n=="boolean"?t[r]=n:e.push(r);return e.length>0&&console.warn(`[ChartWidget] Unknown or non-boolean feature switches left out: ${e.join(", ")}.`),t}function Mi(i){const t=Object.fromEntries(Pt.map(e=>[e,!0]));for(const[e,r]of Object.entries(Ai))if(i[e]===!1)for(const n of r)t[n]=!1;return{...t,...er(i.features)}}function Ii(i){return Pt.filter(t=>!i[t]).join(" ")}const Et="tcw-divider-off",Pi=[{names:["navigation.zoom","navigation.scroll","navigation.reset"],selector:".tcw-nav"},{names:["pane.move","pane.collapse","pane.maximize"],selector:".tcw-pane-controls"},{names:["indicatorLegend.visibility","indicatorLegend.settings","indicatorLegend.more","indicatorLegend.remove"],selector:".tcw-ind-legend-actions"}];function Di(){return[...Pt.map(i=>`.tcw-root[data-tcw-off~="${i}"] [data-tcw-part~="${i}"]{display:none!important}`),...Pi.map(({names:i,selector:t})=>`.tcw-root${i.map(e=>`[data-tcw-off~="${e}"]`).join("")} ${t}{display:none!important}`),`.${Et}{display:none!important}`].join(`
`)}function k(i,...t){i.dataset.tcwPart=t.join(" ")}function Bi(...i){return`data-tcw-part="${i.join(" ")}"`}function zi(i){return Object.prototype.hasOwnProperty.call(Fr,i)?Fr[i]:void 0}function Qn(i,t,e){const r=[...i.children],n=l=>l.classList.contains(t);for(const l of r)n(l)&&l.classList.remove(Et);const s=l=>!l.hidden&&getComputedStyle(l).display!=="none",a=l=>s(l)&&(l instanceof HTMLButtonElement||l.childElementCount>0||l.textContent!=="");let o=!1,c=null;for(const l of r)if(e!==void 0&&l.classList.contains(e))c==null||c.classList.add(Et),c=null,o=!1;else if(n(l)){if(!s(l))continue;o?(c=l,o=!1):l.classList.add(Et)}else a(l)&&(o=!0,c=null);c==null||c.classList.add(Et)}function ne(i,t,e){const r=i.flatMap(n=>{if(n==="separator")return[n];if(!(t[n.id]??[]).every(o=>e[o]))return[];if(!n.submenu)return[n];const a=ne(n.submenu,t,e);return a.length>0?[{...n,submenu:a}]:[]});return r.filter((n,s)=>{if(n!=="separator")return!0;const a=r.slice(0,s).some(c=>c!=="separator"),o=r[s+1];return a&&o!==void 0&&o!=="separator"})}let ce=0;const He="tcw-styles";function ts(){if(ce++,ce>1||document.getElementById(He))return;const i=document.createElement("style");i.id=He,i.textContent=`${Ei}
${Ci}
${Ti}
${Di()}`,document.head.insertBefore(i,document.head.firstChild)}function es(){if(ce--,ce>0)return;const i=document.getElementById(He);i&&i.remove()}const rr=(i,t)=>Object.prototype.hasOwnProperty.call(i,t)?i[t]:void 0;function b(i,t=14){const e=rr(Ze,i);return e?Je(e,t):""}function yt(i,t=16){return Je(rr(Bs,i)??Ze.penLine,t)}function We(i,t=14){return Je(rr(zs,i)??Ze.barChart,t)}function T(i){return i.replace(/[&<>"']/g,t=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[t])}class Rr{constructor(t,e={}){d(this,"trigger");d(this,"panel");d(this,"_isOpen",!1);d(this,"onOutsideClick");d(this,"onEscapeKey");d(this,"onTriggerClick");d(this,"layer");d(this,"align");d(this,"onAway",()=>this.close());d(this,"onScroll",t=>{t.target instanceof Node&&this.panel.contains(t.target)||this.close()});this.trigger=t,this.layer=e.layer??null,this.align=e.align??"left",this.panel=document.createElement("div"),this.panel.className="tcw-dropdown",this.panel.style.minWidth=e.width??"200px",this.panel.style.display="none",this.layer?(this.layer().appendChild(this.panel),this.panel.addEventListener("click",()=>this.close())):(this.align==="right"?this.panel.style.insetInlineEnd="0px":this.panel.style.insetInlineStart="0px",t.style.position="relative",t.appendChild(this.panel)),this.onTriggerClick=()=>{this._isOpen?this.close():this.open()},this.onOutsideClick=r=>{const n=r.target;!this.trigger.contains(n)&&!this.panel.contains(n)&&this.close()},this.onEscapeKey=r=>{r.key==="Escape"&&this.close()},t.addEventListener("click",this.onTriggerClick)}setContent(t){this.panel.innerHTML=t}open(){if(!this._isOpen){if(this._isOpen=!0,this.layer){const t=this.layer();this.panel.parentElement!==t&&t.appendChild(this.panel)}this.panel.style.display="",this.layer&&(this.place(),window.addEventListener("resize",this.onAway),document.addEventListener("scroll",this.onScroll,{capture:!0,passive:!0})),document.addEventListener("pointerdown",this.onOutsideClick),document.addEventListener("keydown",this.onEscapeKey)}}close(){this._isOpen&&(this._isOpen=!1,this.panel.style.display="none",document.removeEventListener("pointerdown",this.onOutsideClick),document.removeEventListener("keydown",this.onEscapeKey),window.removeEventListener("resize",this.onAway),document.removeEventListener("scroll",this.onScroll,{capture:!0}))}isOpen(){return this._isOpen}destroy(){this.close(),this.trigger.removeEventListener("click",this.onTriggerClick),this.panel.remove()}place(){tr(this.panel,this.trigger,this.align)}}const $r=4,Oi=150,Fi="[role=menuitem], [role=menuitemcheckbox], [role=menuitemradio]",Ri="(max-width: 640px)",ye="tcw:back";function Hr(i,t,e,r=i,n=!1){const s=n?r-t>=0?r-t:i:i+t>e?r-t:i;return Math.max(0,Math.min(s,e-t))}function $i(i){return i.radio?"menuitemradio":i.checked===void 0?"menuitem":"menuitemcheckbox"}function Hi(i){const t='<span class="tcw-context-icon"></span>';return i.radio?i.checked?'<span class="tcw-context-icon tcw-context-dot"></span>':t:i.checked!==void 0?i.checked?b("check",14):t:i.icon&&b(i.icon,14)||t}class W{constructor(t,e,r=""){d(this,"el");d(this,"onPick",null);d(this,"onRemove",null);d(this,"returnFocus",null);d(this,"anchor",null);d(this,"child",null);d(this,"parent",null);d(this,"hoverTimer",null);d(this,"onDocPointer",t=>{var r;const e=t.target;this.holds(e)||(r=this.anchor)!=null&&r.contains(e)||this.close()});d(this,"onWheel",t=>{this.holds(t.target)||this.close()});d(this,"onAway",()=>this.close());this.host=t,this.backLabel=r,this.el=document.createElement("div"),this.el.className="tcw-context-menu",this.el.setAttribute("role","menu"),this.el.setAttribute("aria-label",e),this.el.hidden=!0,this.el.addEventListener("keydown",n=>this.onKeyDown(n)),t.appendChild(this.el)}open(t,e,r,n,s,a){this.show(t,{x:e,y:r,xBack:e,yBack:r},n,s,a,!0)}close(){var e,r,n;if(this.clearHover(),(e=this.child)==null||e.close(),this.el.hidden)return;const t=!this.parent||this.el.contains(document.activeElement);this.el.hidden=!0,this.onPick=null,this.onRemove=null,(r=this.anchor)==null||r.setAttribute("aria-expanded","false"),this.anchor=null,document.removeEventListener("pointerdown",this.onDocPointer,!0),document.removeEventListener("wheel",this.onWheel,{capture:!0}),window.removeEventListener("resize",this.onAway),window.removeEventListener("blur",this.onAway),t&&((n=this.returnFocus)!=null&&n.isConnected)&&this.returnFocus.focus({preventScroll:!0}),this.returnFocus=null}isOpen(){return!this.el.hidden}destroy(){var t;this.close(),(t=this.child)==null||t.destroy(),this.el.remove()}show(t,e,r,n,s,a){var p,m,f;this.clearHover(),(p=this.child)==null||p.close(),this.returnFocus=document.activeElement instanceof HTMLElement?document.activeElement:null,this.onPick=r,this.onRemove=s??null,this.anchor=n??null,(m=this.anchor)==null||m.setAttribute("aria-expanded","true"),this.el.replaceChildren(...t.map(g=>this.entry(g))),this.el.hidden=!1;const o=this.host.getBoundingClientRect(),c=Math.min(this.host.clientWidth,window.innerWidth-o.left)-$r,l=Math.min(this.host.clientHeight,window.innerHeight-o.top)-$r;this.el.style.maxHeight=`${Math.max(0,l)}px`,this.el.style.left=`${Hr(e.x,this.el.offsetWidth,c,e.xBack,e.before)}px`,this.el.style.top=`${Hr(e.y,this.el.offsetHeight,l,e.yBack)}px`,document.addEventListener("pointerdown",this.onDocPointer,!0),document.addEventListener("wheel",this.onWheel,{capture:!0,passive:!0}),window.addEventListener("resize",this.onAway),window.addEventListener("blur",this.onAway);const h=this.revealChoice();a&&((f=h??this.items()[0])==null||f.focus({preventScroll:!0}))}revealChoice(){const t=this.el.querySelector("[role=menuitemradio][aria-checked=true]");return!t||t.offsetTop+t.offsetHeight<=this.el.clientHeight?null:(this.el.scrollTop=t.offsetTop-(this.el.clientHeight-t.offsetHeight)/2,t)}rtl(){var t;return((t=this.host.closest("[dir]"))==null?void 0:t.getAttribute("dir"))==="rtl"}holds(t){var e;return this.el.contains(t)||(((e=this.child)==null?void 0:e.holds(t))??!1)}entry(t){if(t==="separator"){const s=document.createElement("div");return s.className="tcw-context-sep",s.setAttribute("role","separator"),s}const e=document.createElement("button");e.type="button",e.className=`tcw-context-item${t.danger?" tcw-context-danger":""}`,e.setAttribute("role",$i(t)),(t.radio||t.checked!==void 0)&&e.setAttribute("aria-checked",String(t.checked??!1)),e.tabIndex=-1,e.dataset.id=t.id,e.innerHTML=Hi(t);const r=document.createElement("span");r.className="tcw-context-label",r.textContent=t.label,e.appendChild(r),this.appendEnd(e,t);const n=t.submenu;return e.addEventListener("pointerenter",s=>{s.pointerType!=="touch"&&this.hover(e,t.label,n)}),e.addEventListener("click",()=>{n?this.openSubmenu(e,t.label,n,!0):this.pick(t.id)}),t.remove?this.removableRow(e,t.remove):e}appendEnd(t,e){var r;if(e.shortcut){t.setAttribute("aria-keyshortcuts",e.shortcut);const n=document.createElement("kbd");n.className="tcw-context-key",n.setAttribute("aria-hidden","true"),n.textContent=e.shortcut,t.appendChild(n)}e.submenu&&(t.setAttribute("aria-haspopup","menu"),t.setAttribute("aria-expanded","false"),t.insertAdjacentHTML("beforeend",b("chevronRight",12)),(r=t.lastElementChild)==null||r.classList.add("tcw-context-more"))}removableRow(t,e){t.setAttribute("aria-keyshortcuts","Delete");const r=document.createElement("button");r.type="button",r.className="tcw-context-remove",r.tabIndex=-1,r.setAttribute("aria-hidden","true"),r.title=e,r.innerHTML=b("x",12),r.addEventListener("click",()=>this.remove(t));const n=document.createElement("div");return n.className="tcw-context-row",n.setAttribute("role","none"),n.append(t,r),n}openSubmenu(t,e,r,n){var m,f;this.clearHover();const s=this.child??this.makeChild();if(s.isOpen()&&s.anchor===t){n&&((m=s.items()[0])==null||m.focus({preventScroll:!0}));return}s.close(),s.el.setAttribute("aria-label",e);const a=this.host.getBoundingClientRect(),o=t.getBoundingClientRect(),c={x:o.right-a.left,y:o.top-a.top,xBack:o.left-a.left,yBack:o.bottom-a.top,before:this.rtl()},l=((f=window.matchMedia)==null?void 0:f.call(window,Ri).matches)??!1,h=l?[{id:ye,label:e,icon:"chevronLeft"},"separator",...r]:r;s.show(h,c,g=>{g!==ye&&this.pick(g)},t,g=>{var v;return(v=this.onRemove)==null?void 0:v.call(this,g)},n);const p=l?s.el.querySelector(`[data-id="${ye}"]`):null;p==null||p.classList.add("tcw-context-back"),p&&this.backLabel&&p.setAttribute("aria-label",`${this.backLabel}: ${e}`),s.returnFocus=t}makeChild(){const t=new W(this.host,"",this.backLabel);return t.parent=this,t.el.addEventListener("pointerenter",()=>this.clearHover()),this.child=t,t}hover(t,e,r){var s;this.clearHover();const n=(s=this.child)!=null&&s.isOpen()?this.child.anchor:null;(r?n===t:n===null)||(this.hoverTimer=setTimeout(()=>{var a;this.hoverTimer=null,r?this.openSubmenu(t,e,r,!1):(a=this.child)==null||a.close()},Oi))}clearHover(){this.hoverTimer!==null&&(clearTimeout(this.hoverTimer),this.hoverTimer=null)}remove(t){var c;const e=t.dataset.id,r=t.closest(".tcw-context-row");if(!e||!r)return;const s=this.items().indexOf(t);(c=this.onRemove)==null||c.call(this,e),r.remove();const a=[...this.el.children].filter((l,h,p)=>l.classList.contains("tcw-context-sep")&&(h===0||h===p.length-1||p[h-1].classList.contains("tcw-context-sep")));for(const l of a)l.remove();const o=this.items();if(o.length===0){this.close();return}o[Math.min(s,o.length-1)].focus({preventScroll:!0})}pick(t){const e=this.onPick;this.close(),e==null||e(t)}items(){return[...this.el.querySelectorAll(Fi)]}onKeyDown(t){var o,c,l;const e=this.items(),r=e.indexOf(document.activeElement),[n,s]=this.rtl()?["ArrowLeft","ArrowRight"]:["ArrowRight","ArrowLeft"];let a=-1;if(t.key==="ArrowDown")a=(r+1)%e.length;else if(t.key==="ArrowUp")a=(r-1+e.length)%e.length;else if(t.key==="Home")a=0;else if(t.key==="End")a=e.length-1;else if(t.key===n&&((o=e[r])!=null&&o.hasAttribute("aria-haspopup"))){t.preventDefault(),e[r].click();return}else if(t.key===s&&this.parent){t.preventDefault(),this.close();return}else if(t.key==="Delete"&&r>=0){t.preventDefault(),this.remove(e[r]);return}else if(t.key==="Escape"||t.key==="Tab"){t.preventDefault(),t.stopPropagation();let h=this;for(;t.key==="Tab"&&h.parent;)h=h.parent;h.close();return}else return;t.preventDefault(),(c=this.child)==null||c.close(),(l=e[a])==null||l.focus({preventScroll:!0})}}const xe=["en-US","en-GB","en-IN","de-DE","fr-FR","es-ES","it-IT","pt-BR","ru-RU","tr-TR","vi-VN","id-ID","th-TH","zh-CN","zh-TW","ja-JP","ko-KR"],Wi=65234;function _i(i){return(i&&!xe.includes(i)?[i,...xe]:xe).map(e=>{let r;try{r=new Intl.NumberFormat(e,{minimumFractionDigits:2,maximumFractionDigits:2}).format(Wi)}catch{r=""}return{value:e,label:r?`${e} (${r})`:e}})}const Wr={Lines:"toolGroup.lines","Horizontal/Vertical":"toolGroup.horizontalVertical",Channels:"toolGroup.channels",Fibonacci:"toolGroup.fibonacci",Shapes:"toolGroup.shapes","Gann & Pitchforks":"toolGroup.gannPitchforks",Patterns:"toolGroup.patterns",Measure:"toolGroup.measure",Annotation:"toolGroup.annotation",Forecasting:"toolGroup.forecasting",Brushes:"toolGroup.brushes",Cycles:"toolGroup.cycles","Elliott Waves":"toolGroup.elliott"};function nr(i,t){const e=`chartType.${i.value}`,r=t(e);return r===e?i.label:r}function _r(i,t){return i.map(e=>({...e,label:Wr[e.label]?t(Wr[e.label]):e.label,tools:e.tools.map(r=>{const n=`tool.${r.value}`,s=t(n);return{...r,label:s===n?r.label:s}})}))}const Ui=["1m","3m","5m","15m","30m","1h","2h","4h","1d","1w","1M"],ji=["1m","5m","15m","1h","4h","1d"],Vi=6;function Ur(i){const t=i.slice(-1);return t==="h"||t==="d"||t==="w"?i.slice(0,-1)+t.toUpperCase():i}const rs=i=>Number.isFinite(z(i))||gt(i)!==null,sr=(i,t)=>{const e=gt(i),r=gt(t);return e!==null||r!==null?e===null?1:r===null?-1:e-r:z(i)-z(t)};function Ki(i,t){const e=t!=null&&t.length?t:null,r=i!=null&&i.length?i:e??Ui;return[...new Set(r)].filter(n=>rs(n)&&(!e||e.includes(n))).sort(sr)}function qi(i,t,e=!1){if(t!=null&&t.length)return i.filter(n=>t.includes(n));if(e)return[...i];const r=i.filter(n=>ji.includes(n));return r.length>0?r:i.slice(0,Vi)}const jr=9999,Gi={"":"m",s:"s",S:"s",m:"m",h:"h",H:"h",d:"d",D:"d",w:"w",W:"w",M:"M"},Vr={s:["m",60],m:["h",60],h:["d",24]};function _e(i){const t=/^(\d+)([a-zA-Z]?)$/.exec(i.trim());if(!t)return null;if(t[2]==="T"||t[2]==="t"){const s=`${Number(t[1])}T`;return Number(t[1])<=jr&&gt(s)!==null?s:null}let e=Number(t[1]),r=Gi[t[2]];if(!r||!Number.isSafeInteger(e)||e<1)return null;for(let s=Vr[r];s&&e%s[1]===0;s=Vr[r])e/=s[1],r=s[0];if(e>jr)return null;const n=`${e}${r}`;return Hn(n)?n:null}function ke(i,t,e){const r=e!=null&&e.length?e:null,n=t.filter(s=>rs(s)&&(!r||r.includes(s)));return[...new Set([...i,...n])].sort(sr)}const Yi=2,Kr=["T","s","m","h","d","w","M"];function Xi(i){const t=e=>{const r=e.slice(-1);return Kr.includes(r)?r:"m"};return Kr.map(e=>({unit:e,timeframes:i.filter(r=>t(r.value)===e)})).filter(e=>e.timeframes.length>0)}const qr=864e5,Ji=5/7;function Zi(i){const t=z(i.current),e=z(i.chosen);if(!Number.isFinite(t)||!Number.isFinite(e)||!(i.width>0)||!(i.spanMs>0))return i.current;const r=s=>{if(s===t)return i.barsInSpan;if(s<qr)return i.barsInSpan*t/s;const a=i.spanMs/s;return s===qr?a*(i.dayShare??Ji):a},n=[...new Set([...i.available,i.current])].filter(s=>{const a=z(s);return Number.isFinite(a)&&a>=e}).sort(sr);for(const s of n)if(r(z(s))*Yi<=i.width)return s;return n[n.length-1]??i.current}const Qi={ticket:"receipt",long:"trendingUp",short:"trendingDown",ladder:"ladder",account:"layers"},Gr=["ladder","account"],ta=2;function ea(i,t){const e=[];i.onOrderTicket&&e.push({id:"ticket",label:t("chartMenu.orderTicket"),parts:["orderTicket"],run:i.onOrderTicket});const r=i.onBracket;return r&&(e.push({id:"long",label:t("toolbar.longBracket"),parts:["bracketOrders","toolbar.bracketOrders"],run:()=>r("buy")}),e.push({id:"short",label:t("toolbar.shortBracket"),parts:["bracketOrders","toolbar.bracketOrders"],run:()=>r("sell")})),i.onToggleLadder&&e.push({id:"ladder",label:t("toolbar.depthLadder"),parts:["depthLadder","toolbar.depthLadder"],run:i.onToggleLadder}),i.onToggleAccount&&e.push({id:"account",label:t("toolbar.account"),parts:["accountPanel","toolbar.accountPanel"],run:i.onToggleAccount}),e}class ir{constructor(t,e,r,n){d(this,"button");d(this,"menu",null);d(this,"open",new Set);this.items=t,this.t=e,this.root=r;const s=document.createElement("button");s.type="button",s.className="tcw-dropdown-trigger tcw-toolbar-overflow",s.dataset.role="trade",s.dataset.icon="trendingUp",s.title=e("toolbar.trade"),s.setAttribute("aria-haspopup","menu"),s.setAttribute("aria-expanded","false"),k(s,"toolbar.trade"),s.innerHTML=`${b("trendingUp",14)} <span class="tcw-trigger-label">${T(e("toolbar.trade"))}</span> ${b("chevronDown",12)}`,s.addEventListener("click",()=>this.toggle(n(s))),this.button=s}static create(t,e,r,n){const s=ea(t,e);return s.length>0?new ir(s,e,r,n):null}tidy(){this.button.hidden=this.items.every(t=>this.isOff(t.parts))}setOpen(t,e){const r=Gr.find(n=>n===t);r&&(e?this.open.add(r):this.open.delete(r))}destroy(){var t;(t=this.menu)==null||t.destroy(),this.button.remove()}isOff(t){const e=new Set((this.root().getAttribute("data-tcw-off")??"").split(/\s+/).filter(Boolean));return t.some(r=>e.has(r))}toggle(t){var o;if((o=this.menu)!=null&&o.isOpen()){this.menu.close();return}const e=this.items.filter(c=>!this.isOff(c.parts));if(e.length===0)return;const r=e.map(c=>Gr.includes(c.id)?{id:c.id,label:c.label,checked:this.open.has(c.id)}:{id:c.id,label:c.label,icon:Qi[c.id]}),n=this.root();this.menu??(this.menu=new W(n,this.t("toolbar.trade")));const s=t.getBoundingClientRect(),a=n.getBoundingClientRect();this.menu.open(r,s.left-a.left,s.bottom-a.top+ta,c=>{var l;(l=e.find(h=>h.id===c))==null||l.run()},t)}}let ra=0;const Yr={T:"toolbar.timeframes.ticks",s:"toolbar.timeframes.seconds",m:"toolbar.timeframes.minutes",h:"toolbar.timeframes.hours",d:"toolbar.timeframes.days",w:"toolbar.timeframes.weeks",M:"toolbar.timeframes.months"};function ns(i,t){var r;const e=((r=i.querySelector(".tcw-host-btn-text"))==null?void 0:r.textContent)??"";e===t?i.removeAttribute("aria-label"):i.setAttribute("aria-label",e?`${t}: ${e}`:t)}class na{constructor(t,e,r,n,s){d(this,"config");d(this,"callbacks");d(this,"t");d(this,"el");d(this,"chartTypeDropdown",null);d(this,"tfGroup",null);d(this,"tfDropdown",null);d(this,"tfFavorites",[]);d(this,"uid",(ra++).toString(36));d(this,"tfRendered","");d(this,"themeBtn",null);d(this,"fullscreenBtn",null);d(this,"hostLeft",null);d(this,"hostRight",null);d(this,"moreMenu",null);d(this,"tfCurrent",null);d(this,"resizeObserver",null);d(this,"moreBtn",null);d(this,"fitFrame",0);d(this,"undoBtn",null);d(this,"redoBtn",null);d(this,"trade",null);var a;this.host=t,this.layer=s,this.config=e,this.callbacks=r,this.t=n,this.el=document.createElement("div"),this.el.className="tcw-toolbar",k(this.el,"toolbar"),this.build(),t.appendChild(this.el),typeof ResizeObserver<"u"&&(this.resizeObserver=new ResizeObserver(()=>this.fit()),this.resizeObserver.observe(this.el)),(a=document.fonts)==null||a.ready.then(()=>this.scheduleFit())}scheduleFit(){this.fitFrame||typeof requestAnimationFrame>"u"||(this.fitFrame=requestAnimationFrame(()=>{this.fitFrame=0,this.fit()}))}anchorOf(t){return(t.hasAttribute("data-tcw-folded")||this.el.closest("[data-tcw-narrow]")!==null)&&this.moreBtn?this.moreBtn:t}fit(){const{el:t}=this,e=()=>t.scrollWidth<=t.clientWidth+1,r=[...t.querySelectorAll(".tcw-toolbar-overflow")];for(const n of r)n.removeAttribute("data-tcw-folded");if(t.classList.remove("tcw-toolbar--collapsed","tcw-toolbar--icons"),!(t.clientWidth===0||e())){t.classList.add("tcw-toolbar--collapsed");for(let n=r.length-1;n>=0;n--)if(r[n].setAttribute("data-tcw-folded",""),e())return;t.classList.add("tcw-toolbar--icons");for(const n of r)if(n.removeAttribute("data-tcw-folded"),!e()){n.setAttribute("data-tcw-folded","");break}}}build(){const{config:t,callbacks:e,el:r}=this,n=document.createElement("button");if(n.className="tcw-toolbar-symbol",n.dataset.role="symbol",k(n,"toolbar.symbol"),n.addEventListener("click",e.onSymbolClick),r.appendChild(n),e.onSymbolInfo){const p=this.iconBtn("info",this.t("symbolInfo.title"),e.onSymbolInfo);p.classList.remove("tcw-toolbar-overflow"),p.dataset.role="symbolInfo",k(p,"symbolInfo","toolbar.symbolInfo"),r.appendChild(p)}if(r.appendChild(this.sep()),this.tfFavorites=[...t.timeframeFavorites??t.timeframes.map(p=>p.value)],this.tfGroup=document.createElement("div"),this.tfGroup.className="tcw-toolbar-group tcw-tf-group",k(this.tfGroup,"toolbar.timeframes"),r.appendChild(this.tfGroup),e.onToggleTimeframeFavorite&&t.timeframes.length>0){const p=document.createElement("div");p.style.position="relative",p.style.display="inline-flex",k(p,"toolbar.timeframeMenu");const m=document.createElement("button");m.className="tcw-btn tcw-tf-more",m.dataset.role="timeframes",m.title=this.t("toolbar.timeframes"),m.setAttribute("aria-label",this.t("toolbar.timeframes")),this.tfCurrent=document.createElement("span"),this.tfCurrent.className="tcw-tf-current",m.appendChild(this.tfCurrent),m.insertAdjacentHTML("beforeend",b("chevronDown",12)),p.appendChild(m),r.appendChild(p),this.tfDropdown=new Rr(p,{width:"150px",layer:this.layer}),r.classList.add("tcw-toolbar--tf-menu"),this.buildTimeframeMenu()}r.appendChild(this.sep());const s=document.createElement("div");s.style.position="relative",s.style.display="inline-flex",k(s,"toolbar.chartType");const a=document.createElement("button");a.className="tcw-dropdown-trigger",a.dataset.role="charttype",s.appendChild(a),r.appendChild(s),this.chartTypeDropdown=new Rr(s,{width:"160px",layer:this.layer}),this.buildChartTypeMenu(),r.appendChild(this.sep());const o=document.createElement("button");if(o.type="button",o.className="tcw-dropdown-trigger",o.dataset.role="indicators",o.setAttribute("aria-haspopup","dialog"),o.setAttribute("aria-expanded","false"),k(o,"toolbar.indicators"),o.addEventListener("click",()=>e.onIndicators()),r.appendChild(o),e.onCompare){const p=document.createElement("button");p.type="button",p.className="tcw-dropdown-trigger",p.dataset.role="compare",k(p,"compare","toolbar.compare");const m=this.t("objects.compare");p.setAttribute("aria-label",m),p.title=m,p.innerHTML=`${b("plus",14)} <span class="tcw-trigger-label">${T(m)}</span>`,p.addEventListener("click",e.onCompare),r.appendChild(p)}if(this.hostLeft=this.hostGroup(),r.appendChild(this.hostLeft),e.onUndo&&e.onRedo&&(r.appendChild(this.sep()),this.undoBtn=this.iconBtn("undo",this.t("drawing.undo"),e.onUndo),this.undoBtn.dataset.role="undo",k(this.undoBtn,"toolbar.undo","sidebar.undo"),this.redoBtn=this.iconBtn("redo",this.t("drawing.redo"),e.onRedo),this.redoBtn.dataset.role="redo",k(this.redoBtn,"toolbar.redo","sidebar.redo"),r.append(this.undoBtn,this.redoBtn),this.setHistory(!1,!1)),r.appendChild(this.spacer()),e.onLayouts){const p=e.onLayouts,m=document.createElement("button");m.type="button",m.className="tcw-dropdown-trigger tcw-layouts-btn tcw-toolbar-overflow",m.dataset.role="layouts",m.dataset.icon="save",k(m,"layouts","toolbar.layouts"),m.setAttribute("aria-haspopup","menu"),m.addEventListener("click",()=>p(this.anchorOf(m))),r.appendChild(m),this.setLayout(null,!1)}if(this.hostRight=this.hostGroup(),r.appendChild(this.hostRight),r.appendChild(this.sep()),e.onToggleReplay){const p=this.iconBtn("play",this.t("toolbar.replay"),e.onToggleReplay);p.dataset.role="replay",k(p,"replay","toolbar.replay"),r.appendChild(p)}if(e.onToggleObjects){const p=this.iconBtn("layers",this.t("toolbar.objects"),e.onToggleObjects);p.dataset.role="objects",k(p,"objectTree","toolbar.objectTree"),r.appendChild(p)}if(e.onToggleAlerts){const p=this.iconBtn("bell",this.t("toolbar.priceAlerts"),e.onToggleAlerts);p.dataset.role="alerts",k(p,"alerts","toolbar.alerts"),r.appendChild(p)}this.trade=ir.create(e,this.t,()=>this.rootEl(),p=>this.anchorOf(p)),this.trade&&r.appendChild(this.trade.button),r.appendChild(this.sep());const c=this.iconBtn("camera",this.t("toolbar.screenshot"),e.onScreenshot);k(c,"screenshot","toolbar.screenshot"),r.appendChild(c);const l=this.iconBtn("settings",this.t("toolbar.settings"),e.onSettings);k(l,"settings","toolbar.settings"),r.appendChild(l),this.themeBtn=this.iconBtn("moon",this.t("toolbar.toggleTheme"),e.onToggleTheme),this.themeBtn.dataset.role="theme",k(this.themeBtn,"themeToggle","toolbar.themeToggle"),r.appendChild(this.themeBtn),e.onToggleFullscreen&&(this.fullscreenBtn=this.iconBtn("maximize",this.t("toolbar.fullscreen"),e.onToggleFullscreen),this.fullscreenBtn.dataset.role="fullscreen",k(this.fullscreenBtn,"fullscreen","toolbar.fullscreen"),this.fullscreenBtn.setAttribute("aria-pressed","false"),r.appendChild(this.fullscreenBtn));const h=document.createElement("button");h.type="button",h.className="tcw-btn-icon tcw-toolbar-more",h.title=this.t("toolbar.more"),h.setAttribute("aria-haspopup","menu"),h.setAttribute("aria-expanded","false"),h.innerHTML=b("more",16),h.addEventListener("click",()=>this.toggleMore(h)),r.appendChild(h),this.moreBtn=h}toggleMore(t){var h;if((h=this.moreMenu)!=null&&h.isOpen()){this.moreMenu.close();return}const e=this.rootEl(),r=new Set((e.getAttribute("data-tcw-off")??"").split(/\s+/).filter(Boolean)),n=p=>(p.dataset.tcwPart??"").split(/\s+/).some(m=>r.has(m)),s=this.el.closest("[data-tcw-narrow]")!==null,a=[];for(const p of this.el.querySelectorAll(".tcw-toolbar-overflow")){if(n(p)||!s&&!p.hasAttribute("data-tcw-folded"))continue;const m=p instanceof HTMLButtonElement?[p]:[...p.querySelectorAll("button")];a.push(...m.filter(f=>!f.hidden&&!f.disabled&&!n(f)))}if(a.length===0)return;const o=a.map((p,m)=>{var g;const f=p.title||p.getAttribute("aria-label")||((g=p.textContent)==null?void 0:g.trim())||"";return p.getAttribute("aria-pressed")==="true"?{id:String(m),label:f,checked:!0}:{id:String(m),label:f,icon:p.dataset.icon}});this.moreMenu??(this.moreMenu=new W(e,this.t("toolbar.more")));const c=t.getBoundingClientRect(),l=e.getBoundingClientRect();this.moreMenu.open(o,c.right-l.left,c.bottom-l.top+2,p=>{var m;return(m=a[Number(p)])==null?void 0:m.click()},t)}addHostButton(t){var n;const e=document.createElement("button");e.type="button",e.className=t.text||!t.icon?"tcw-btn tcw-host-btn":"tcw-btn-icon tcw-host-btn",e.dataset.hostButton=t.id,typeof t.icon=="string"&&(e.dataset.icon=t.icon),e.title=t.label,t.toggle&&e.setAttribute("aria-pressed","false"),typeof t.icon=="string"?e.innerHTML=b(t.icon,14):t.icon&&e.appendChild(t.icon);const r=t.text??(t.icon?"":t.label);if(r){const s=document.createElement("span");s.className="tcw-host-btn-text",s.textContent=r,e.appendChild(s)}return ns(e,t.label),e.addEventListener("click",()=>t.onClick(e)),t.side!=="left"&&e.classList.add("tcw-toolbar-overflow"),(n=t.side==="left"?this.hostLeft:this.hostRight)==null||n.appendChild(e),this.scheduleFit(),e}hostSlot(t){return t==="left"?this.hostLeft:this.hostRight}hostGroup(){const t=document.createElement("div");return t.className="tcw-toolbar-host",t}setSymbolSearch(t){const e=this.el.querySelector('[data-role="symbol"]');e&&(t?e.removeAttribute("aria-disabled"):e.setAttribute("aria-disabled","true"))}tidy(){var t;(t=this.trade)==null||t.tidy(),Qn(this.el,"tcw-toolbar-sep","tcw-toolbar-spacer"),this.scheduleFit()}setHistory(t,e){this.undoBtn&&(this.undoBtn.disabled=!t),this.redoBtn&&(this.redoBtn.disabled=!e)}rootEl(){return this.el.closest(".tcw-root")??this.host}setActive(t,e){var n;(n=this.trade)==null||n.setOpen(t,e);const r=this.el.querySelector(`[data-role="${t}"]`);r&&(r.classList.toggle("tcw-active",e),r.setAttribute("aria-pressed",String(e)))}setLayout(t,e){const r=this.el.querySelector('[data-role="layouts"]');if(!r)return;const n=t??this.t("layouts.unnamed"),s=`${this.t("toolbar.layouts")}: ${n}${e?` (${this.t("layouts.unsavedChanges")})`:""}`;r.innerHTML=`${b("save",14)}<span class="tcw-layouts-label">${T(n)}</span>`+(e?'<span class="tcw-layouts-dirty" aria-hidden="true"></span>':"")+b("chevronDown",12),r.title=s,r.setAttribute("aria-label",s)}setFullscreen(t){if(!this.fullscreenBtn)return;const e=this.t(t?"toolbar.exitFullscreen":"toolbar.fullscreen");this.fullscreenBtn.innerHTML=b(t?"minimize":"maximize",14),this.fullscreenBtn.title=e,this.fullscreenBtn.setAttribute("aria-pressed",String(t))}chartTypeLabel(t){return nr(t,this.t)}buildChartTypeMenu(){if(!this.chartTypeDropdown)return;const t=this.config.chartTypes.map(r=>`<button class="tcw-dropdown-item tcw-dropdown-item--icon" data-ct="${T(r.value)}">${We(r.value,16)}<span>${T(this.chartTypeLabel(r))}</span></button>`).join("");this.chartTypeDropdown.setContent(t),this.chartTypeDropdown.panel.querySelectorAll(".tcw-dropdown-item").forEach(r=>{r.addEventListener("click",n=>{var a;const s=n.currentTarget.dataset.ct;this.callbacks.onChartType(s),(a=this.chartTypeDropdown)==null||a.close()})})}setSymbolDescription(t){const e=this.el.querySelector('[data-role="symbol"]');e&&(t?e.title=t:e.removeAttribute("title"))}setTimeframes(t,e){this.config={...this.config,timeframes:t},this.setTimeframeFavorites(e)}setTimeframeFavorites(t){this.tfFavorites=[...t],this.tfRendered="",this.buildTimeframeMenu()}buildTimeframeMenu(){if(!this.tfDropdown)return;const t=T(this.t("toolbar.timeframes.pin")),e=T(this.t("toolbar.timeframes.remove"));let r="";for(const{unit:a,timeframes:o}of Xi(this.config.timeframes)){r+=`<div class="tcw-tf-section" data-tf-section="${a}" role="group" aria-label="${T(this.t(Yr[a]))}"><div class="tcw-dropdown-label">${T(this.t(Yr[a]))}</div>`;for(const c of o){const l=this.tfFavorites.includes(c.value),[h,p]=[T(c.value),T(c.label)];r+=`<div class="tcw-tf-row"><button class="tcw-dropdown-item" data-tf-pick="${h}">${p}</button>`+(c.custom&&this.callbacks.onRemoveTimeframe?`<button class="tcw-tf-remove" data-tf-remove="${h}" title="${e}" aria-label="${e}: ${p}">${b("x",12)}</button>`:"")+`<button class="tcw-tf-star${l?" tcw-active":""}" data-tf-star="${h}" aria-pressed="${l}" title="${t}" aria-label="${t}: ${p}">${b("star",12)}</button></div>`}r+="</div>"}if(this.callbacks.onAddTimeframe){const a=T(this.t("toolbar.timeframes.custom")),o=T(this.t("toolbar.timeframes.add"));r+=`<form class="tcw-tf-custom" ${Bi("customTimeframes")} novalidate><input class="tcw-tf-custom-input" type="text" autocomplete="off" spellcheck="false" maxlength="6" placeholder="7m, 90m, 2h…" aria-label="${a}" aria-describedby="tcw-tf-hint-${this.uid}"><button type="submit" class="tcw-tf-custom-add" title="${o}" aria-label="${o}">${b("plus",12)}</button><div class="tcw-tf-custom-hint" id="tcw-tf-hint-${this.uid}" role="status"></div></form>`}this.tfDropdown.setContent(r);const n=this.tfDropdown.panel;n.querySelectorAll("[data-tf-pick]").forEach(a=>{a.addEventListener("click",()=>this.callbacks.onTimeframe(a.dataset.tfPick))}),n.querySelectorAll("[data-tf-star]").forEach(a=>{a.addEventListener("click",o=>{var c,l;o.stopPropagation(),(l=(c=this.callbacks).onToggleTimeframeFavorite)==null||l.call(c,a.dataset.tfStar)})}),n.querySelectorAll("[data-tf-remove]").forEach(a=>{a.addEventListener("click",o=>{var c,l;o.stopPropagation(),(l=(c=this.callbacks).onRemoveTimeframe)==null||l.call(c,a.dataset.tfRemove)})});const s=n.querySelector(".tcw-tf-custom");s&&this.wireCustomTimeframe(s)}wireCustomTimeframe(t){const e=t.querySelector(".tcw-tf-custom-input"),r=t.querySelector(".tcw-tf-custom-hint");t.addEventListener("click",n=>n.stopPropagation()),e.addEventListener("input",()=>{e.removeAttribute("aria-invalid"),r.textContent=""}),t.addEventListener("submit",n=>{var s,a,o,c;n.preventDefault(),n.stopPropagation(),(a=(s=this.callbacks).onAddTimeframe)!=null&&a.call(s,e.value)?(e.value="",r.textContent="",(o=this.tfDropdown)==null||o.close(),(c=this.el.querySelector('[data-role="timeframes"]'))==null||c.focus()):(e.setAttribute("aria-invalid","true"),r.textContent=this.t("toolbar.timeframes.invalid"))})}renderTimeframes(t){var s,a;if(!this.tfGroup)return;const e=this.config.timeframes.filter(o=>this.tfFavorites.includes(o.value)||o.value===t),r=`${e.map(o=>o.value).join(",")}|${t}`;if(r===this.tfRendered)return;this.tfRendered=r,this.tfCurrent&&(this.tfCurrent.textContent=((s=this.config.timeframes.find(o=>o.value===t))==null?void 0:s.label)??t),this.tfGroup.replaceChildren(...e.map(o=>{const c=document.createElement("button");return c.className="tcw-btn",c.textContent=o.label,c.dataset.tf=o.value,c.classList.toggle("tcw-active",o.value===t),c.addEventListener("click",()=>this.callbacks.onTimeframe(o.value)),c}));const n=(a=this.tfDropdown)==null?void 0:a.panel;n==null||n.querySelectorAll("[data-tf-pick]").forEach(o=>{o.classList.toggle("tcw-active",o.dataset.tfPick===t)})}setIndicatorsOpen(t){var e;(e=this.el.querySelector('[data-role="indicators"]'))==null||e.setAttribute("aria-expanded",String(t))}update(t){const e=this.el.querySelector('[data-role="symbol"]');e&&(e.textContent=t.symbol),this.renderTimeframes(t.timeframe);const r=this.el.querySelector('[data-role="charttype"]');if(r){const s=this.config.chartTypes.find(o=>o.value===t.chartType),a=s?this.chartTypeLabel(s):t.chartType;r.innerHTML=We(t.chartType,16),r.title=a,r.setAttribute("aria-label",a)}const n=this.el.querySelector('[data-role="indicators"]');if(n){const s=t.activeIndicators.size;let a=`${b("trendingUp",14)} <span class="tcw-trigger-label">${T(this.t("toolbar.indicators"))}</span>`;n.setAttribute("aria-label",this.t("toolbar.indicators")),s>0&&(a+=` <span class="tcw-badge-count">${s}</span>`),n.innerHTML=a}if(this.themeBtn){const s=t.isDark?"moon":"sun";this.themeBtn.innerHTML=b(s,14),this.themeBtn.dataset.icon=s}this.scheduleFit()}sep(){const t=document.createElement("span");return t.className="tcw-toolbar-sep",t}spacer(){const t=document.createElement("span");return t.className="tcw-toolbar-spacer",t}iconBtn(t,e,r){const n=document.createElement("button");return n.className="tcw-btn-icon tcw-toolbar-overflow",n.dataset.icon=t,n.title=e,n.innerHTML=b(t,14),n.addEventListener("click",r),n}destroy(){var t,e,r,n,s;(t=this.resizeObserver)==null||t.disconnect(),this.fitFrame&&cancelAnimationFrame(this.fitFrame),(e=this.chartTypeDropdown)==null||e.destroy(),(r=this.tfDropdown)==null||r.destroy(),(n=this.moreMenu)==null||n.destroy(),(s=this.trade)==null||s.destroy(),this.el.remove()}}function Xr(i,t,e){i.classList.toggle("tcw-active",t),e&&i.setAttribute("aria-pressed",String(t))}function Jr(i,t,e){let r=i.querySelector(".tcw-host-btn-text");r||(r=document.createElement("span"),r.className="tcw-host-btn-text",i.appendChild(r)),r.textContent=e,ns(i,t)}const at=new Map([["en",It],["vi",si]]);new Proxy({},{get:(i,t)=>typeof t=="string"?at.get(t.toLowerCase()):void 0,has:(i,t)=>typeof t=="string"&&at.has(t.toLowerCase()),ownKeys:()=>[...at.keys()],getOwnPropertyDescriptor:(i,t)=>typeof t=="string"&&at.has(t.toLowerCase())?{enumerable:!0,configurable:!0,value:at.get(t.toLowerCase())}:void 0});function Vl(i,t){at.set(i.toLowerCase(),t)}function sa(i){const t=i.toLowerCase().replace("_","-"),e=[t];/^zh-(tw|hk|mo|hant)/.test(t)&&e.push("zh-hant");const r=t.split("-")[0];return r!==t&&e.push(r),(r==="no"||r==="nn")&&e.push("nb"),e}function ia(i){for(const t of sa(i)){const e=at.get(t);if(e)return e}}const Zr=new Set;function ss(i,t){const e={...It},r=i?ia(i):void 0;return r?Object.assign(e,r):i&&!t&&!Zr.has(i)&&(Zr.add(i),console.warn(`[ChartWidget] No strings for locale "${i}"; showing English. Import the language from '@tradecanvas/chart/widget/locales' and pass it as \`messages\`.`)),t&&Object.assign(e,t),e}function ar(i){return t=>i[t]??It[t]??t}const D=ar(It);function S(i,t){return i.replace(/\{(\w+)\}/g,(e,r)=>r in t?String(t[r]):e)}const Ht=16,aa=150,Qr=4;function oa(i){const t=`sidebar.${i}`;return Pt.includes(t)?t:null}function tn(i,t){for(const e of i){const r=e.tools.find(n=>n.value===t);if(r)return r.label}return t}class ca{constructor(t,e,r,n=D){d(this,"config");d(this,"callbacks");d(this,"el");d(this,"groupWraps",[]);d(this,"groupButtons",[]);d(this,"groupIcons",[]);d(this,"groupTools",[]);d(this,"cursorBtn",null);d(this,"magnetBtn",null);d(this,"eraserBtn",null);d(this,"zoomBtn",null);d(this,"stayBtn",null);d(this,"lockAllBtn",null);d(this,"hideAllBtn",null);d(this,"drawings",{locked:!1,hidden:!1});d(this,"flyoutEl",null);d(this,"flyoutIdx",-1);d(this,"flyoutHideTimer",null);d(this,"hostEl",null);d(this,"favoritesEl",null);d(this,"favoritesDivider",null);d(this,"favorites",[]);d(this,"fab");d(this,"fabShows","");d(this,"onPressAway",t=>{var r;const e=t.target;e&&(this.el.contains(e)||this.fab.contains(e)||(r=this.flyoutEl)!=null&&r.contains(e))||this.setOpen(!1)});d(this,"onEscape",t=>{t.key==="Escape"&&!this.flyoutEl&&this.setOpen(!1)});this.host=t,this.t=n,this.config=e,this.callbacks=r,this.el=document.createElement("div"),this.el.className="tcw-sidebar",k(this.el,"sidebar"),this.build(),this.el.addEventListener("scroll",()=>this.hideFlyout(),{passive:!0}),t.appendChild(this.el),this.fab=document.createElement("button"),this.fab.type="button",this.fab.className="tcw-sidebar-fab",this.fab.setAttribute("aria-label",this.t("drawing.tools")),this.fab.setAttribute("aria-expanded","false"),this.fab.innerHTML=b("penLine",18),k(this.fab,"sidebar"),this.fab.addEventListener("click",()=>this.setOpen(!this.isOpen())),t.appendChild(this.fab)}isNarrow(){return this.el.closest("[data-tcw-narrow]")!==null}isOpen(){return this.el.classList.contains("tcw-sidebar-open")}setOpen(t){var e;if(t!==this.isOpen())if(this.el.classList.toggle("tcw-sidebar-open",t),this.fab.setAttribute("aria-expanded",String(t)),t)document.addEventListener("pointerdown",this.onPressAway,!0),document.addEventListener("keydown",this.onEscape);else{const r=this.el.contains(document.activeElement)||!!((e=this.flyoutEl)!=null&&e.contains(document.activeElement));this.hideFlyout(),document.removeEventListener("pointerdown",this.onPressAway,!0),document.removeEventListener("keydown",this.onEscape),r&&this.isNarrow()&&this.fab.focus({preventScroll:!0})}}closeOverlay(){this.setOpen(!1)}closeForChart(){this.isNarrow()&&this.setOpen(!1)}pick(t){this.callbacks.onDrawingTool(t),this.closeForChart()}build(){const{config:t,callbacks:e,el:r}=this;this.cursorBtn=document.createElement("button"),this.cursorBtn.className="tcw-sidebar-btn",this.cursorBtn.title=this.t("drawing.cursor"),this.cursorBtn.innerHTML=b("cursor",14),this.cursorBtn.addEventListener("click",()=>{e.onCancelDrawing(),this.closeForChart()}),k(this.cursorBtn,"sidebar.cursor"),r.appendChild(this.cursorBtn),r.appendChild(this.divider()),e.onToggleFavorite&&(this.favorites=[...t.favorites??[]],this.favoritesEl=document.createElement("div"),this.favoritesEl.className="tcw-sidebar-favorites",k(this.favoritesEl,"sidebar.favorites"),r.appendChild(this.favoritesEl),this.favoritesDivider=this.divider(),k(this.favoritesDivider,"sidebar.favorites"),r.appendChild(this.favoritesDivider),this.renderFavorites());let n;t.drawingToolGroups.forEach((o,c)=>{if(!o.tools[0])return;o.section!==void 0&&n!==void 0&&o.section!==n&&this.appendDivider(),n=o.section;const l=document.createElement("div");l.className="tcw-tool-group-wrap";const h=oa(o.section);h&&k(l,h);const p=document.createElement("button");p.className="tcw-sidebar-btn";const m=o.tools[0].value;o.tools.length>1?p.setAttribute("aria-label",`${o.label}: ${o.tools[0].label}`):p.title=o.label;const f=document.createElement("span");if(f.className="tcw-sidebar-icon",f.innerHTML=yt(m,Ht),p.appendChild(f),this.groupIcons.push(f),this.groupTools.push(m),o.tools.length>1){const g=document.createElement("span");g.className="tcw-multi-dot",p.appendChild(g)}p.addEventListener("click",()=>{if(this.isNarrow()&&o.tools.length>1){this.flyoutEl&&this.flyoutIdx===c?this.hideFlyout():this.showFlyout(c);return}this.pick(this.groupTools[c])}),l.appendChild(p),l.addEventListener("mouseenter",()=>{this.isNarrow()||this.showFlyout(c)}),l.addEventListener("mouseleave",()=>{this.isNarrow()||this.scheduleHideFlyout()}),o.tools.length>1&&(p.setAttribute("aria-haspopup","menu"),p.setAttribute("aria-expanded","false"),p.addEventListener("keydown",g=>{g.key==="ArrowRight"||g.key==="ArrowDown"?(g.preventDefault(),this.showFlyout(c),this.focusFlyoutItem(0)):g.key==="Escape"&&this.flyoutEl&&(g.stopPropagation(),this.hideFlyout())})),l.addEventListener("focusout",g=>{var y;const v=g.relatedTarget;!l.contains(v)&&!((y=this.flyoutEl)!=null&&y.contains(v))&&this.scheduleHideFlyout()}),r.appendChild(l),this.groupWraps.push(l),this.groupButtons.push(p)});const s=document.createElement("div");if(s.className="tcw-sidebar-spacer",r.appendChild(s),r.appendChild(this.divider()),e.onToggleStyle){const o=document.createElement("button");o.className="tcw-sidebar-btn",o.title=this.t("drawing.style"),o.dataset.role="style",k(o,"sidebar.style"),o.innerHTML=b("palette",14);const c=e.onToggleStyle;o.addEventListener("click",()=>{c(),this.closeForChart()}),r.appendChild(o)}if(e.onToggleMagnet&&(this.magnetBtn=document.createElement("button"),this.magnetBtn.className="tcw-sidebar-btn",this.magnetBtn.title=this.t("drawing.magnet"),this.magnetBtn.innerHTML=b("magnet",14),this.magnetBtn.addEventListener("click",e.onToggleMagnet),k(this.magnetBtn,"sidebar.magnet"),r.appendChild(this.magnetBtn)),e.onToggleEraser){const o=e.onToggleEraser;this.eraserBtn=this.toggleButton("eraser",this.t("drawing.eraser"),()=>{o(),this.closeForChart()}),k(this.eraserBtn,"sidebar.eraser"),r.appendChild(this.eraserBtn)}if(e.onToggleZoomArea){const o=e.onToggleZoomArea;this.zoomBtn=this.toggleButton("zoomIn",this.t("drawing.zoomArea"),()=>{o(),this.closeForChart()}),k(this.zoomBtn,"sidebar.zoomArea"),r.appendChild(this.zoomBtn)}if(e.onToggleStayInDrawing&&(this.stayBtn=document.createElement("button"),this.stayBtn.className="tcw-sidebar-btn",this.stayBtn.dataset.role="stay",this.stayBtn.title=this.t("drawing.stay"),this.stayBtn.setAttribute("aria-pressed","false"),this.stayBtn.innerHTML=b("repeat",14),this.stayBtn.addEventListener("click",e.onToggleStayInDrawing),k(this.stayBtn,"sidebar.stayInDrawing"),r.appendChild(this.stayBtn)),this.hostEl=document.createElement("div"),this.hostEl.className="tcw-sidebar-host",r.appendChild(this.hostEl),this.appendDivider(),e.onLockAll){const o=e.onLockAll;this.lockAllBtn=this.toggleButton("lock",this.t("drawing.lockAll"),()=>o(!this.drawings.locked)),this.lockAllBtn.dataset.role="lockAll",k(this.lockAllBtn,"sidebar.lockAll"),r.appendChild(this.lockAllBtn)}if(e.onHideAll){const o=e.onHideAll;this.hideAllBtn=this.toggleButton("eyeOff",this.t("drawing.hideAll"),()=>o(!this.drawings.hidden)),this.hideAllBtn.dataset.role="hideAll",k(this.hideAllBtn,"sidebar.hideAll"),r.appendChild(this.hideAllBtn)}const a=document.createElement("button");a.className="tcw-sidebar-btn tcw-danger",a.title=this.t("drawing.clearAll"),a.innerHTML=b("trash",14),a.addEventListener("click",e.onClearDrawings),k(a,"sidebar.clear"),r.appendChild(a)}setDrawingsState(t){if(!(t.locked===this.drawings.locked&&t.hidden===this.drawings.hidden)){this.drawings={...t};for(const[e,r]of[[this.lockAllBtn,t.locked],[this.hideAllBtn,t.hidden]])e==null||e.setAttribute("aria-pressed",String(r)),e==null||e.classList.toggle("tcw-active",r)}}setFavorites(t){var e,r;this.favorites=[...t],this.renderFavorites();for(const n of((e=this.flyoutEl)==null?void 0:e.querySelectorAll(".tcw-flyout-row"))??[]){const s=this.favorites.includes(n.dataset.toolValue??"");n.classList.toggle("tcw-flyout-faved",s),(r=n.querySelector("[data-pin]"))==null||r.setAttribute("aria-pressed",String(s))}}renderFavorites(){if(!this.favoritesEl)return;this.favoritesEl.replaceChildren();const t=this.favorites.length>0;this.favoritesEl.style.display=t?"":"none",this.favoritesDivider&&(this.favoritesDivider.style.display=t?"":"none");for(const e of this.favorites){const r=document.createElement("button");r.className="tcw-sidebar-btn",r.title=S(this.t("sidebar.unpinHint"),{tool:tn(this.config.drawingToolGroups,e)}),r.dataset.toolValue=e,r.innerHTML=yt(e,Ht),r.addEventListener("click",()=>this.pick(e)),r.addEventListener("contextmenu",n=>{var s,a;n.preventDefault(),(a=(s=this.callbacks).onToggleFavorite)==null||a.call(s,e)}),this.favoritesEl.appendChild(r)}}showFlyout(t){var a;if(this.cancelHideFlyout(),this.flyoutEl&&this.flyoutIdx===t)return;const e=this.config.drawingToolGroups[t];if(!e||e.tools.length<=1){this.hideFlyout();return}this.hideFlyout();const r=document.createElement("div");r.className="tcw-flyout",r.setAttribute("role","menu"),r.setAttribute("aria-label",e.label),r.addEventListener("keydown",o=>this.onFlyoutKey(o,t));const n=document.createElement("div");n.className="tcw-flyout-header",n.textContent=e.label,r.appendChild(n);const s=this.t("drawing.pinFavorite");for(const o of e.tools){const c=document.createElement("div");c.className="tcw-flyout-row",c.setAttribute("role","none"),c.dataset.toolValue=o.value;const l=document.createElement("button");l.className="tcw-flyout-item",l.setAttribute("role","menuitem"),l.tabIndex=-1,l.innerHTML=yt(o.value,Ht);const h=document.createElement("span");h.className="tcw-flyout-name",h.textContent=o.label,l.appendChild(h);const p=(a=this.config.shortcuts)==null?void 0:a[o.value];if(p){const m=document.createElement("kbd");m.className="tcw-flyout-key",m.textContent=p,k(m,"hotkeys","hotkeys.tools"),l.appendChild(m)}if(l.dataset.toolValue=o.value,l.addEventListener("click",()=>{this.hideFlyout(),this.pick(o.value)}),c.appendChild(l),this.callbacks.onToggleFavorite){const m=this.favorites.includes(o.value);c.classList.toggle("tcw-flyout-faved",m);const f=document.createElement("button");f.type="button",f.className="tcw-flyout-pin",f.dataset.pin=o.value,f.tabIndex=-1,f.title=s,f.setAttribute("aria-label",`${s}: ${o.label}`),f.setAttribute("aria-pressed",String(m)),f.innerHTML=b("star",12),f.addEventListener("click",g=>{var v,y;g.stopPropagation(),(y=(v=this.callbacks).onToggleFavorite)==null||y.call(v,o.value)}),c.appendChild(f),l.addEventListener("contextmenu",g=>{var v,y;g.preventDefault(),(y=(v=this.callbacks).onToggleFavorite)==null||y.call(v,o.value)})}r.appendChild(c)}r.addEventListener("mouseenter",()=>this.cancelHideFlyout()),r.addEventListener("mouseleave",()=>this.scheduleHideFlyout()),r.addEventListener("focusout",o=>{const c=o.relatedTarget;!r.contains(c)&&!this.groupWraps[t].contains(c)&&this.scheduleHideFlyout()}),this.flyoutEl=r,this.flyoutIdx=t,this.host.appendChild(r),this.placeFlyout(r,this.groupButtons[t]),this.groupButtons[t].setAttribute("aria-expanded","true")}flyoutItems(){return this.flyoutEl?[...this.flyoutEl.querySelectorAll(".tcw-flyout-item")]:[]}focusFlyoutItem(t){const e=this.flyoutItems();e.length!==0&&e[(t+e.length)%e.length].focus()}onFlyoutKey(t,e){var s,a;const r=this.flyoutItems(),n=r.indexOf(document.activeElement);switch(t.key){case"ArrowDown":this.focusFlyoutItem(n+1);break;case"ArrowUp":this.focusFlyoutItem(n-1);break;case"Home":this.focusFlyoutItem(0);break;case"End":this.focusFlyoutItem(r.length-1);break;case"Escape":case"ArrowLeft":t.stopPropagation(),this.hideFlyout(),(s=this.groupButtons[e])==null||s.focus();break;case"Tab":this.hideFlyout(),(a=this.groupButtons[e])==null||a.focus();return;default:return}t.preventDefault()}placeFlyout(t,e){var a;const r=this.host.getBoundingClientRect(),n=e.getBoundingClientRect();t.style.maxHeight=`${Math.max(0,this.host.clientHeight-Qr*2)}px`;const s=this.host.clientHeight-t.offsetHeight-Qr;((a=this.host.closest("[dir]"))==null?void 0:a.getAttribute("dir"))==="rtl"?(t.style.left="",t.style.right=`${r.right-n.left}px`):(t.style.right="",t.style.left=`${n.right-r.left}px`),t.style.top=`${Math.max(0,Math.min(n.top-r.top,s))}px`}scheduleHideFlyout(){this.cancelHideFlyout(),this.flyoutHideTimer=setTimeout(()=>{this.flyoutHideTimer=null,this.hideFlyout()},aa)}cancelHideFlyout(){this.flyoutHideTimer!==null&&(clearTimeout(this.flyoutHideTimer),this.flyoutHideTimer=null)}hideFlyout(){var t;this.cancelHideFlyout(),this.flyoutEl&&(this.flyoutEl.remove(),this.flyoutEl=null),(t=this.groupButtons[this.flyoutIdx])==null||t.setAttribute("aria-expanded","false"),this.flyoutIdx=-1}update(t){this.cursorBtn&&this.cursorBtn.classList.toggle("tcw-active",t.activeTool===null);const e=t.activeTool??"";e!==this.fabShows&&(this.fabShows=e,this.fab.innerHTML=t.activeTool?yt(t.activeTool,18):b("penLine",18)),this.fab.classList.toggle("tcw-active",t.activeTool!==null||t.eraser||t.zoomArea);const{drawingToolGroups:r}=this.config;for(let n=0;n<r.length;n++){const s=r[n].tools.some(a=>a.value===t.activeTool);this.groupButtons[n].classList.toggle("tcw-active",s),s&&t.activeTool&&t.activeTool!==this.groupTools[n]&&(this.groupTools[n]=t.activeTool,this.groupIcons[n].innerHTML=yt(t.activeTool,Ht),r[n].tools.length>1&&this.groupButtons[n].setAttribute("aria-label",`${r[n].label}: ${tn(r,t.activeTool)}`))}if(this.flyoutEl&&this.flyoutEl.querySelectorAll(".tcw-flyout-item").forEach(n=>{const s=n;s.classList.toggle("tcw-active",s.dataset.toolValue===t.activeTool)}),this.magnetBtn){const n=t.magnetEnabled&&t.magnetStrong;this.magnetBtn.classList.toggle("tcw-active",t.magnetEnabled),this.magnetBtn.innerHTML=b(n?"magnetStrong":"magnet",14),this.magnetBtn.title=n?this.t("drawing.magnetStrong"):t.magnetEnabled?this.t("drawing.magnetOn"):this.t("drawing.magnetOff"),this.magnetBtn.setAttribute("aria-label",this.magnetBtn.title)}for(const[n,s]of[[this.eraserBtn,t.eraser],[this.zoomBtn,t.zoomArea]])n&&(n.classList.toggle("tcw-active",s),n.setAttribute("aria-pressed",String(s)));this.stayBtn&&(this.stayBtn.classList.toggle("tcw-active",t.stayInDrawing),this.stayBtn.setAttribute("aria-pressed",String(t.stayInDrawing)))}addHostButton(t){var r;const e=document.createElement("button");return e.type="button",e.className="tcw-sidebar-btn tcw-host-btn",e.dataset.hostButton=t.id,e.title=t.label,e.setAttribute("aria-label",t.label),t.toggle&&e.setAttribute("aria-pressed","false"),typeof t.icon=="string"?e.innerHTML=b(t.icon,14):e.appendChild(t.icon),e.addEventListener("click",()=>t.onClick(e)),(r=this.hostEl)==null||r.appendChild(e),this.tidy(),e}hostSlot(){return this.hostEl}tidy(){Qn(this.el,"tcw-sidebar-divider","tcw-sidebar-spacer")}toggleButton(t,e,r){const n=document.createElement("button");return n.className="tcw-sidebar-btn",n.title=e,n.setAttribute("aria-label",e),n.setAttribute("aria-pressed","false"),n.innerHTML=b(t,14),n.addEventListener("click",r),n}appendDivider(){var t;(t=this.el.lastElementChild)!=null&&t.classList.contains("tcw-sidebar-divider")||this.el.appendChild(this.divider())}divider(){const t=document.createElement("div");return t.className="tcw-sidebar-divider",t}destroy(){this.setOpen(!1),this.hideFlyout(),this.fab.remove(),this.el.remove()}}const is='button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';function lt(i,t){if(i.key!=="Tab")return;const e=document.activeElement,r=[...t.querySelectorAll(is)].filter(c=>c.tabIndex>=0&&(c.getClientRects().length>0||c===e));if(r.length===0)return;const n=r[0],s=r[r.length-1],a=e instanceof Node&&t.contains(e),o=(c,l)=>(c.compareDocumentPosition(l)&Node.DOCUMENT_POSITION_PRECEDING)!==0;i.shiftKey&&(!a||e===n||o(n,e))?(i.preventDefault(),s.focus()):!i.shiftKey&&(!a||e===s||o(e,s))&&(i.preventDefault(),n.focus())}function I(i,t){const e=document.createElement("label");e.className="tcw-settings-row";const r=document.createElement("span");return r.className="tcw-settings-label",r.textContent=i,e.append(r,t),e}function or(i,t){const e=document.createElement("button");return e.type="button",e.className=`tcw-toggle${i?" tcw-on":""}`,e.setAttribute("role","switch"),e.setAttribute("aria-checked",String(i)),e.addEventListener("click",()=>{const r=!e.classList.contains("tcw-on");e.classList.toggle("tcw-on",r),e.setAttribute("aria-checked",String(r)),t(r)}),e}function ot(i,t,e){const r=document.createElement("input");return r.type="number",r.className="tcw-indi-input",r.value=String(i),r.step=String(t.step??(Number.isInteger(i)?1:.001)),t.min!==void 0&&(r.min=String(t.min)),t.max!==void 0&&(r.max=String(t.max)),r.addEventListener("change",()=>{if(r.value.trim()==="")return;let n=Number(r.value);Number.isFinite(n)&&(t.min!==void 0&&(n=Math.max(t.min,n)),t.max!==void 0&&(n=Math.min(t.max,n)),r.value=String(n),e(n))}),r}function At(i,t){const e=document.createElement("input");return e.type="color",e.className="tcw-indi-color",e.value=Dt(i),e.addEventListener("input",()=>t(e.value)),e}function X(i,t,e){const r=document.createElement("select");r.className="tcw-indi-input tcw-indi-select";for(const n of i){const s=document.createElement("option");s.value=n.value,s.textContent=n.label,r.appendChild(s)}return r.value=t,r.addEventListener("change",()=>e(r.value)),r}function Dt(i){if(typeof i!="string")return"#000000";const t=i.trim();if(/^#[0-9a-f]{6}$/i.test(t))return t.toLowerCase();if(/^#[0-9a-f]{8}$/i.test(t))return t.slice(0,7).toLowerCase();if(/^#[0-9a-f]{3,4}$/i.test(t))return`#${t[1]}${t[1]}${t[2]}${t[2]}${t[3]}${t[3]}`.toLowerCase();const e=/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i.exec(t);if(e)return`#${[e[1],e[2],e[3]].map(n=>Math.min(255,Number(n)).toString(16).padStart(2,"0")).join("")}`;const r=la(t);return r!==null&&r!==t?Dt(r):"#000000"}let tt;function la(i){if(tt===void 0)try{tt=typeof document<"u"?document.createElement("canvas").getContext("2d"):null}catch{tt=null}if(!tt)return null;tt.fillStyle="#010203",tt.fillStyle=i;const t=String(tt.fillStyle);return t==="#010203"?null:t}function da(i){if(typeof i!="string")return 1;const t=/^rgba\([^)]*,\s*([\d.]+)\s*\)$/i.exec(i.trim());return t?Math.max(0,Math.min(1,Number(t[1]))):1}function en(i,t){const e=Dt(i),[r,n,s]=[1,3,5].map(a=>parseInt(e.slice(a,a+2),16));return`rgba(${r}, ${n}, ${s}, ${Math.round(t*100)/100})`}let ha=0;function rn(i){const t=document.createElement("div");if(t.className="tcw-settings-section",i){const e=document.createElement("div");e.className="tcw-settings-section-title",e.textContent=i,t.appendChild(e),t.setAttribute("role","group"),t.setAttribute("aria-label",i)}return t}function ue(i){const t=document.createElement("div");t.className="tcw-settings-row";const e=document.createElement("span");return e.className="tcw-settings-label",e.textContent=i,t.appendChild(e),t}function ua(i,t,e,r,n){const s=ue(i),a=document.createElement("div");a.className="tcw-color-picker-wrap";const o=document.createElement("input");o.type="color",o.setAttribute("aria-label",i);const c=document.createElement("span");c.className="tcw-color-hex",c.id=`tcw-color-${++ha}`,o.setAttribute("aria-describedby",c.id);let l=null;const h=p=>{var m;o.value=Dt(p??((m=r.start)==null?void 0:m.call(r))),c.textContent=p??n("settings.auto"),s.classList.toggle("tcw-color-auto",p===null),p!==null&&r.start&&!l?(l=document.createElement("button"),l.type="button",l.className="tcw-color-auto-btn",l.textContent=n("settings.auto"),l.setAttribute("aria-label",`${i}: ${n("settings.auto")}`),l.addEventListener("click",()=>{e(null),o.focus(),h(r.read())}),a.appendChild(l)):p===null&&l&&(l.remove(),l=null)};return o.addEventListener("input",()=>{e(o.value),h(o.value)}),a.append(o,c),s.appendChild(a),h(t),{row:s,sync:()=>h(r.read())}}function M(i,t,e){const r=ue(i),n=document.createElement("button");return n.type="button",n.className=`tcw-toggle${t?" tcw-on":""}`,n.setAttribute("role","switch"),n.setAttribute("aria-checked",String(t)),n.setAttribute("aria-label",i),n.addEventListener("click",()=>{const s=!n.classList.contains("tcw-on");n.classList.toggle("tcw-on",s),n.setAttribute("aria-checked",String(s)),e(s)}),r.appendChild(n),r}function Z(i,t,e,r){const n=ue(i),s=document.createElement("select");s.className="tcw-settings-select",s.setAttribute("aria-label",i);for(const a of e){const o=document.createElement("option");o.value=a.value,o.textContent=a.label,a.value===t&&(o.selected=!0),s.appendChild(o)}return e.some(a=>a.value===t)||(s.selectedIndex=-1),s.addEventListener("change",()=>r(s.value)),n.appendChild(s),n}function Wt(i,t,e,r,n=s=>String(s)){const s=ue(i),a=document.createElement("div");a.className="tcw-settings-range";const o=document.createElement("input");o.type="range",o.min=String(e.min),o.max=String(e.max),o.step=String(e.step),o.value=String(t),o.setAttribute("aria-label",i);const c=document.createElement("span");return c.className="tcw-settings-range-val",c.textContent=n(t),o.addEventListener("input",()=>{const l=Number(o.value);c.textContent=n(l),r(l)}),a.append(o,c),s.appendChild(a),s}function pa(i,t,e,r,n){const s=document.createElement("div");s.className="tcw-settings-row";const a=document.createElement("label");a.className="tcw-settings-label",a.textContent=i,s.appendChild(a);const o=document.createElement("input");return o.type="number",o.className="tcw-settings-number",o.min="0",o.step=e.step,Number.isFinite(e.max)&&(o.max=String(e.max)),o.placeholder=n("settings.auto"),o.value=t===null?"":String(t),o.setAttribute("aria-label",i),o.addEventListener("change",()=>{if(o.value.trim()===""){o.removeAttribute("aria-invalid"),r(null);return}const c=Number(o.value),l=Number.isFinite(c)&&c>0&&c<=e.max&&(e.step!=="1"||Number.isInteger(c));o.toggleAttribute("aria-invalid",!l),l&&r(c)}),s.appendChild(o),s}const et=[{id:"symbol",icon:"chartType:candlestick"},{id:"statusLine",icon:"type"},{id:"scales",icon:"ruler"},{id:"appearance",icon:"palette"},{id:"layers",icon:"layers"},{id:"trading",icon:"trendingUp"}],Se=[1,2,3,4],_t="t:";let ma=1;class wa{constructor(t,e,r={},n=()=>document.body){d(this,"callbacks");d(this,"t");d(this,"backdrop",null);d(this,"modal",null);d(this,"bodyEl",null);d(this,"tabButtons",[]);d(this,"templateBtn",null);d(this,"menu",null);d(this,"currentTab","symbol");d(this,"currentSettings",null);d(this,"chartType",null);d(this,"lookRows",[]);d(this,"returnFocus",null);d(this,"uid",ma++);this.available=r,this.host=n,this.callbacks=t,this.t=e}open(t,e=null,r="symbol"){var n;this.modal&&this.remove(),this.returnFocus=document.activeElement instanceof HTMLElement?document.activeElement:null,this.currentSettings={...t},this.chartType=e,this.currentTab=r,this.buildModal(),(n=this.tabButtons.find(s=>s.dataset.tab===r))==null||n.focus()}isOpen(){return this.modal!==null}refresh(t,e){this.modal&&(this.currentSettings={...t},e!==void 0&&(this.chartType=e),this.renderTabContent())}close(){this.finish(!0)}destroy(){this.remove()}finish(t){var e,r,n;this.modal&&(t?this.callbacks.onClose():(r=(e=this.callbacks).onCancel)==null||r.call(e),this.remove(),(n=this.returnFocus)!=null&&n.isConnected&&this.returnFocus.focus(),this.returnFocus=null)}remove(){var t,e;(t=this.menu)==null||t.destroy(),this.menu=null,(e=this.backdrop)==null||e.remove(),this.backdrop=this.modal=this.bodyEl=this.templateBtn=null,this.tabButtons=[]}buildModal(){const t=document.createElement("div");t.className="tcw-modal-backdrop";let e=!1;t.addEventListener("pointerdown",n=>{e=n.target===t}),t.addEventListener("click",n=>{n.target===t&&e&&this.finish(!1),e=!1});const r=document.createElement("div");r.className="tcw-modal tcw-set",r.setAttribute("role","dialog"),r.setAttribute("aria-modal","true"),r.setAttribute("aria-labelledby",`tcw-set-title-${this.uid}`),r.tabIndex=-1,r.addEventListener("keydown",n=>{if(n.key==="Escape"){n.preventDefault(),n.stopPropagation(),this.finish(!1);return}lt(n,r)}),this.backdrop=t,this.modal=r,r.append(this.buildHeader(),this.buildBody(),this.buildFooter()),t.appendChild(r),this.host().appendChild(t),this.markTabs(),this.renderTabContent()}buildHeader(){const t=document.createElement("div");t.className="tcw-modal-header";const e=document.createElement("h3");e.id=`tcw-set-title-${this.uid}`,e.textContent=this.t("settings.title");const r=document.createElement("button");return r.type="button",r.className="tcw-modal-close",r.setAttribute("aria-label",this.t("common.close")),r.innerHTML=b("x",16),r.addEventListener("click",()=>this.finish(!1)),t.append(e,r),t}buildBody(){const t=document.createElement("div");t.className="tcw-set-body";const e=document.createElement("div");e.className="tcw-set-nav",e.setAttribute("role","tablist"),e.setAttribute("aria-orientation","vertical"),e.setAttribute("aria-label",this.t("settings.title")),e.addEventListener("keydown",n=>this.onTabKey(n)),this.tabButtons=et.map(({id:n,icon:s})=>{const a=document.createElement("button");a.type="button",a.className="tcw-set-tab",a.id=`tcw-set-tab-${this.uid}-${n}`,a.dataset.tab=n,a.setAttribute("role","tab"),a.setAttribute("aria-controls",`tcw-set-panel-${this.uid}`);const o=s.startsWith("chartType:")?We(s.slice(10),16):b(s,16);return a.innerHTML=`${o}<span></span>`,a.querySelector("span").textContent=this.t(`settings.tab.${n}`),a.addEventListener("click",()=>this.selectTab(n)),a}),e.append(...this.tabButtons);const r=document.createElement("div");return r.className="tcw-modal-body tcw-set-panel",r.id=`tcw-set-panel-${this.uid}`,r.setAttribute("role","tabpanel"),this.bodyEl=r,t.append(e,r),t}buildFooter(){const t=document.createElement("div");t.className="tcw-modal-footer";const e=this.footerButton("template","tcw-footer-menu",()=>this.openTemplates());e.setAttribute("aria-haspopup","menu"),e.setAttribute("aria-expanded","false"),e.innerHTML=`<span></span>${b("chevronDown",12)}`,e.querySelector("span").textContent=this.t("settings.template"),this.templateBtn=e;const r=document.createElement("div");return r.className="tcw-footer-end",r.append(this.footerButton("cancel","tcw-footer-cancel",()=>this.finish(!1),this.t("common.cancel")),this.footerButton("ok","tcw-done-btn",()=>this.finish(!0),this.t("drawingSettings.ok"))),t.append(e,r),t}footerButton(t,e,r,n){const s=document.createElement("button");return s.type="button",s.className=e,s.dataset.act=t,n&&(s.textContent=n),s.addEventListener("click",r),s}markTabs(){var t;for(const e of this.tabButtons){const r=e.dataset.tab===this.currentTab;e.classList.toggle("tcw-active",r),e.setAttribute("aria-selected",String(r)),e.tabIndex=r?0:-1,r&&((t=this.bodyEl)==null||t.setAttribute("aria-labelledby",e.id))}}selectTab(t,e=!1){var r;this.currentTab=t,this.markTabs(),this.renderTabContent(),e&&((r=this.tabButtons.find(n=>n.dataset.tab===t))==null||r.focus())}onTabKey(t){const e=et.findIndex(n=>n.id===this.currentTab),r=t.key==="ArrowDown"||t.key==="ArrowRight"?(e+1)%et.length:t.key==="ArrowUp"||t.key==="ArrowLeft"?(e-1+et.length)%et.length:t.key==="Home"?0:t.key==="End"?et.length-1:-1;r<0||(t.preventDefault(),this.selectTab(et[r].id,!0))}openTemplates(){var o;const t=this.templateBtn;if(!this.modal||!t)return;if((o=this.menu)!=null&&o.isOpen()){this.menu.close();return}const e=this.callbacks.templates,r=((e==null?void 0:e.list())??[]).map(c=>({id:`${_t}${c}`,label:c,icon:"layers",remove:S(this.t("templates.delete"),{name:c})})),n=[...r,...r.length>0?["separator"]:[],...e?[{id:"save",label:this.t("settings.saveTemplate"),icon:"save"}]:[],{id:"reset",label:this.t("settings.resetToDefaults"),icon:"reset"}];this.menu??(this.menu=new W(this.modal,this.t("settings.template")));const s=t.getBoundingClientRect(),a=this.modal.getBoundingClientRect();this.menu.open(n,s.left-a.left,s.top-a.top,c=>{c==="reset"?this.callbacks.onReset():c==="save"?e==null||e.save():c.startsWith(_t)&&(e==null||e.apply(c.slice(_t.length)))},t,c=>e==null?void 0:e.remove(c.slice(_t.length)))}renderTabContent(){if(!(!this.bodyEl||!this.currentSettings))switch(this.bodyEl.replaceChildren(),this.lookRows=[],this.currentTab){case"symbol":this.renderSymbolTab(this.currentSettings);break;case"statusLine":this.renderStatusLineTab(this.currentSettings);break;case"scales":this.renderScalesTab(this.currentSettings);break;case"appearance":this.renderAppearanceTab(this.currentSettings);break;case"layers":this.renderLayersTab(this.currentSettings);break;case"trading":for(const t of Zn)(!t.trading||this.available.trading!==!1)&&this.renderLookSection(t);break}}renderSymbolTab(t){this.renderChartTypeSection(),this.addSection(void 0,[M(this.t("settings.mainSeries"),t.mainSeriesVisible,r=>this.patch({mainSeriesVisible:r})),M(this.t("settings.extendedHours"),t.extendedHours,r=>this.patch({extendedHours:r}))]);const e=this.t("common.show");this.renderLookSection(Kn),this.renderLookSection(qn,[M(e,t.volumeVisible,r=>this.patch({volumeVisible:r}))]),this.renderLookSection(Gn,[M(e,t.highLowLines,r=>this.patch({highLowLines:r}))])}renderStatusLineTab(t){this.addSection(void 0,[M(this.t("settings.ohlcLegend"),t.legendVisible,e=>this.patch({legendVisible:e})),...Yn.map(e=>this.lookRow(e))])}renderScalesTab(t){const e=[{value:"regular",label:this.t("settings.scale.regular")},{value:"logarithmic",label:this.t("settings.scale.logarithmic")},{value:"percentage",label:this.t("settings.scale.percentage")},{value:"indexedTo100",label:this.t("settings.scale.indexedTo100")}].filter(n=>n.value!=="logarithmic"||this.available.logScale!==!1),r=$e(t.timezone,Date.now(),this.t("settings.timezone.local"),this.available.exchangeZone?{label:this.t("settings.timezone.exchange"),zone:this.available.exchangeZone()}:void 0);this.addSection(void 0,[Z(this.t("settings.priceScale"),t.scaleMode,e,n=>this.patch({scaleMode:n})),M(this.t("settings.autoScale"),t.autoScale,n=>this.patch({autoScale:n})),M(this.t("settings.invertScale"),t.invertScale,n=>this.patch({invertScale:n})),M(this.t("settings.leftScale"),t.leftPriceScale,n=>this.patch({leftPriceScale:n})),M(this.t("settings.indicatorValues"),t.indicatorValueLabels,n=>this.patch({indicatorValueLabels:n})),...this.available.barCountdown!==!1?[M(this.t("settings.barCountdown"),t.barCountdown,n=>this.patch({barCountdown:n}))]:[],Z(this.t("settings.timezone"),t.timezone,r,n=>this.patch({timezone:n})),Z(this.t("settings.numberLocale"),t.numberLocale,_i(t.numberLocale),n=>this.patch({numberLocale:n}))]),this.addSection(this.t("settings.section.axes"),Xn.map(n=>this.lookRow(n)))}renderAppearanceTab(t){const[e,r,n,...s]=Jn;this.renderLookSection(e),this.renderLookSection(r,[M(this.t("common.show"),t.gridVisible,a=>this.patch({gridVisible:a}))]),this.renderLookSection(n,[Z(this.t("settings.crosshairMode"),t.crosshairMode,[{label:this.t("settings.crosshair.magnet"),value:"magnet"},{label:this.t("settings.crosshair.normal"),value:"normal"},{label:this.t("settings.crosshair.hidden"),value:"hidden"}],a=>this.patch({crosshairMode:a}))]);for(const a of s)this.renderLookSection(a)}renderLayersTab(t){const e=n=>`${Math.round(n*100)}%`,r=n=>this.t(n);this.addSection(void 0,[M(r("settings.volumeProfile"),t.volumeProfileVisible,n=>this.patch({volumeProfileVisible:n}))]),this.addSection(void 0,[M(r("settings.marketProfile"),t.marketProfileVisible,n=>this.patch({marketProfileVisible:n})),M(r("settings.marketProfileSplit"),t.marketProfileSplit,n=>this.patch({marketProfileSplit:n})),M(r("settings.marketProfileLetters"),t.marketProfileLetters,n=>this.patch({marketProfileLetters:n})),Wt(r("settings.marketProfileBuckets"),t.marketProfileBuckets,{min:8,max:200,step:1},n=>this.patch({marketProfileBuckets:n})),Wt(r("settings.marketProfileOpacity"),t.marketProfileOpacity,{min:.05,max:1,step:.05},n=>this.patch({marketProfileOpacity:n}),e)]),this.addSection(void 0,[M(r("settings.depthHeatmap"),t.depthHeatmapVisible,n=>this.patch({depthHeatmapVisible:n})),Wt(r("settings.depthHeatmapOpacity"),t.depthHeatmapOpacity,{min:.1,max:1,step:.05},n=>this.patch({depthHeatmapOpacity:n}),e)]),this.addSection(void 0,[M(r("settings.swingMarkers"),t.pivotMarkersVisible,n=>this.patch({pivotMarkersVisible:n})),Wt(r("settings.swingStrength"),t.pivotStrength,{min:2,max:20,step:1},n=>this.patch({pivotStrength:n})),M(r("settings.swingStructure"),t.pivotStructureLabels,n=>this.patch({pivotStructureLabels:n}))]),this.addSection(void 0,[M(r("settings.sessionShading"),t.sessionShadingVisible,n=>this.patch({sessionShadingVisible:n})),M(r("settings.periodLevels"),t.periodLevelsVisible,n=>this.patch({periodLevelsVisible:n})),Z(r("settings.periodLevelsBasis"),t.periodLevelsPeriod,[{value:"day",label:r("settings.priorDay")},{value:"week",label:r("settings.priorWeek")}],n=>this.patch({periodLevelsPeriod:n}))])}addSection(t,e){var n;const r=rn(t);return r.append(...e),(n=this.bodyEl)==null||n.appendChild(r),r}renderLookSection(t,e=[]){this.addSection(this.t(t.title),[...e,...t.rows.map(r=>this.lookRow(r))])}lookRow(t){const e=this.t(t.label),r=()=>this.callbacks.styleValue(t.keys[0]),n=()=>{const l=t.keys.map(h=>this.callbacks.styleValue(h));return l.every(h=>h===l[0])&&l[0]!==null?String(l[0]):""};let s;const a=l=>{this.callbacks.onStyleChange(Object.fromEntries(t.keys.map(h=>[h,l])));for(const h of this.lookRows)h.el!==s&&h.sync()},o=t.auto?[{value:"",label:this.t("settings.auto")}]:[];let c;switch(he[t.keys[0]]){case"boolean":{s=M(e,r()===!0,a);const l=s.querySelector("button");c=()=>{const h=r()===!0;l.classList.toggle("tcw-on",h),l.setAttribute("aria-checked",String(h))};break}case"lineStyle":s=Z(e,n(),[...o,...this.lineStyles()],l=>a(l===""?null:fa(l))),c=()=>{s.querySelector("select").value=n()};break;case"width":{const l=r(),h=typeof l=="number"&&!Se.includes(l)?[...Se,l].sort((p,m)=>p-m):Se;s=Z(e,n(),[...o,...h.map(p=>({value:String(p),label:`${p}px`}))],p=>a(p===""?null:Number(p))),c=()=>{s.querySelector("select").value=n()};break}default:{const l=r(),h=ua(e,typeof l=="string"?l:null,a,{read:()=>{const p=r();return typeof p=="string"?p:null},start:t.auto?()=>{var p,m;return((p=t.auto)!=null&&p.from?this.callbacks.styleValue(t.auto.from):(m=t.auto)==null?void 0:m.hint)??null}:void 0},this.t);s=h.row,c=h.sync}}return this.lookRows.push({el:s,sync:c}),s}lineStyles(){return[{value:"solid",label:this.t("drawingSettings.lineStyle.solid")},{value:"dashed",label:this.t("drawingSettings.lineStyle.dashed")},{value:"dotted",label:this.t("drawingSettings.lineStyle.dotted")}]}renderChartTypeSection(){var c,l,h,p,m,f;if(!this.bodyEl||!this.currentSettings||!this.chartType)return;const t=this.chartType,e=this.currentSettings.chartTypeOptions??{},r=re.find(g=>g.value===t),n=rn(r?nr(r,this.t):t),s=()=>{var g;return((g=this.currentSettings)==null?void 0:g.chartTypeOptions)??{}},a=(g,v)=>this.patch({chartTypeOptions:{...s(),[g]:v}}),o=(g,v,y,L,C)=>n.appendChild(pa(this.t(g),v,{step:y,max:L},C,this.t));switch(t){case"renko":{const g=e.renko??{};o("settings.boxSize",typeof g.boxSize=="number"?g.boxSize:null,"any",1/0,v=>a("renko",{...s().renko??{},boxSize:v??"atr"})),o("settings.atrPeriod",g.atrPeriod??null,"1",500,v=>a("renko",Ut(s().renko,"atrPeriod",v)));break}case"lineBreak":o("settings.lineBreakLines",((c=e.lineBreak)==null?void 0:c.lines)??null,"1",10,g=>a("lineBreak",Ut(s().lineBreak,"lines",g)));break;case"kagi":o("settings.reversal",((l=e.kagi)==null?void 0:l.reversal)??null,"any",1/0,g=>a("kagi",Ut(s().kagi,"reversal",g))),n.appendChild(Z(this.t("settings.reversalType"),((h=e.kagi)==null?void 0:h.reversalType)??"percent",[{value:"percent",label:this.t("settings.reversalType.percent")},{value:"price",label:this.t("settings.reversalType.price")}],g=>a("kagi",{...s().kagi??{},reversalType:g==="price"?"price":"percent"})));break;case"pointAndFigure":o("settings.boxSize",typeof((p=e.pointAndFigure)==null?void 0:p.boxSize)=="number"?e.pointAndFigure.boxSize:null,"any",1/0,g=>a("pointAndFigure",{...s().pointAndFigure??{},boxSize:g??"auto"})),o("settings.reversalBoxes",((m=e.pointAndFigure)==null?void 0:m.reversal)??null,"1",10,g=>a("pointAndFigure",Ut(s().pointAndFigure,"reversal",g)));break;case"rangeBars":o("settings.barRange",typeof((f=e.rangeBars)==null?void 0:f.range)=="number"?e.rangeBars.range:null,"any",1/0,g=>a("rangeBars",{range:g??"auto"}));break}for(const g of Si(t))n.appendChild(this.lookRow(g));this.bodyEl.appendChild(n)}patch(t){this.currentSettings&&Object.assign(this.currentSettings,t),this.callbacks.onChange(t)}}function Ut(i,t,e){const r={...i??{}};return e===null?delete r[t]:r[t]=e,r}function fa(i){return i==="dashed"||i==="dotted"?i:"solid"}class ga{constructor(t,e,r={}){d(this,"el");d(this,"dotEl");d(this,"messageEl");d(this,"marketEl");d(this,"hostLeft");d(this,"hostRight");d(this,"clockBtn",null);d(this,"clockMenu",null);d(this,"scaleBtns",null);d(this,"scaleShown","");this.host=t,this.extras=r,this.el=document.createElement("div"),this.el.className="tcw-statusbar",k(this.el,"statusBar"),e&&this.el.appendChild(this.buildRange(e)),this.hostLeft=this.hostGroup(),this.el.appendChild(this.hostLeft);const n=document.createElement("div");n.className="tcw-status-right",this.hostRight=this.hostGroup(),n.appendChild(this.hostRight);const s=document.createElement("div");s.className="tcw-status-indicator",k(s,"statusBar.connection"),this.dotEl=document.createElement("span"),this.dotEl.className="tcw-status-dot",s.appendChild(this.dotEl),this.messageEl=document.createElement("span"),s.appendChild(this.messageEl),this.marketEl=document.createElement("span"),this.marketEl.className="tcw-status-market",this.marketEl.hidden=!0,k(this.marketEl,"statusBar.market"),n.appendChild(this.marketEl),n.appendChild(s),r.clock&&n.appendChild(this.buildClock(r.clock)),r.scale&&n.appendChild(this.buildScale(r.scale)),this.el.appendChild(n),t.appendChild(this.el)}update(t){this.dotEl.className="tcw-status-dot",t.connectionState==="connected"?this.dotEl.classList.add("tcw-connected"):t.connectionState==="error"&&this.dotEl.classList.add("tcw-error"),this.messageEl.textContent=t.message}tick(){if(!this.clockBtn||!this.extras.clock)return;const{time:t,zone:e}=this.extras.clock.now(),r=`${t} ${e}`;this.clockBtn.textContent!==r&&(this.clockBtn.textContent=r)}setScale(t){var r,n,s;const e=`${t.mode}|${t.auto}`;!this.scaleBtns||e===this.scaleShown||(this.scaleShown=e,(r=this.scaleBtns.percent)==null||r.setAttribute("aria-pressed",String(t.mode==="percentage")),(n=this.scaleBtns.log)==null||n.setAttribute("aria-pressed",String(t.mode==="logarithmic")),(s=this.scaleBtns.auto)==null||s.setAttribute("aria-pressed",String(t.auto)))}setMarket(t,e){this.marketEl.hidden=t==="always",this.marketEl.dataset.state=t,this.marketEl.textContent=t==="always"?"":e}addHostItem(t){const e=t.onClick,r=e?document.createElement("button"):document.createElement("span");return r.className=e?"tcw-status-host-item tcw-status-host-btn":"tcw-status-host-item",r.dataset.hostItem=t.id,r.textContent=t.text,t.label&&(r.title=t.label,e||r.setAttribute("role","group"),t.label!==t.text&&r.setAttribute("aria-label",`${t.label}: ${t.text}`)),r instanceof HTMLButtonElement&&e&&(r.type="button",r.addEventListener("click",()=>e(r))),(t.side==="left"?this.hostLeft:this.hostRight).appendChild(r),r}hostSlot(t){return t==="left"?this.hostLeft:this.hostRight}destroy(){var t;(t=this.clockMenu)==null||t.destroy(),this.el.remove()}buildClock(t){const e=document.createElement("button");return e.type="button",e.className="tcw-status-clock",e.dataset.role="clock",e.title=t.label,e.setAttribute("aria-haspopup","menu"),k(e,"statusBar.clock"),e.addEventListener("click",()=>this.toggleZones(e,t)),this.clockBtn=e,this.tick(),e}toggleZones(t,e){var o;if((o=this.clockMenu)!=null&&o.isOpen()){this.clockMenu.close();return}const{current:r,list:n}=e.options();this.clockMenu??(this.clockMenu=new W(this.host,e.label));const s=t.getBoundingClientRect(),a=this.host.getBoundingClientRect();this.clockMenu.open(n.map(c=>({id:c.value,label:c.label,checked:c.value===r})),s.left-a.left,s.top-a.top,c=>e.onPick(c),t)}buildScale(t){var n,s;const e=document.createElement("div");e.className="tcw-status-scale",e.setAttribute("role","group"),t.labels.group&&e.setAttribute("aria-label",t.labels.group),k(e,"statusBar.scale");const r=(a,o,c)=>{const l=document.createElement("button");return l.type="button",l.className="tcw-status-scale-btn",l.dataset.scale=a,l.textContent=o,l.title=t.labels[a],l.setAttribute("aria-label",t.labels[a]),l.setAttribute("aria-pressed","false"),l.addEventListener("click",c),e.appendChild(l),l};return this.scaleBtns={percent:r("percent","%",t.onPercent),...t.onLog?{log:r("log",((n=t.texts)==null?void 0:n.log)??"log",t.onLog)}:{},auto:r("auto",((s=t.texts)==null?void 0:s.auto)??"auto",t.onAuto)},e}hostGroup(){const t=document.createElement("div");return t.className="tcw-status-host",t}buildRange(t){var n;const e=document.createElement("div");e.className="tcw-range-bar",e.setAttribute("role","group"),e.setAttribute("aria-label",t.groupLabel);for(const s of t.presets){const a=document.createElement("button");a.type="button",a.className="tcw-range-btn",a.dataset.range=s,k(a,"statusBar.range"),a.textContent=((n=t.presetLabels)==null?void 0:n[s])??s,a.addEventListener("click",()=>t.onPreset(s)),e.appendChild(a)}const r=document.createElement("button");return r.type="button",r.className="tcw-range-btn tcw-range-goto",r.dataset.role="goto",k(r,"goToDate","statusBar.goToDate"),r.title=`${t.goToLabel} (Alt+G)`,r.setAttribute("aria-label",t.goToLabel),r.innerHTML=b("calendar",13),r.addEventListener("click",t.onGoTo),e.appendChild(r),e}}function as(i,t,e){const r=(...s)=>s.map(a=>`<kbd class="tcw-cmd-kbd tcw-cmd-key">${a}</kbd>`).join(""),n=(s,a)=>`<span class="tcw-cmd-help">${s}<span class="tcw-cmd-help-text">${T(a)}</span></span>`;return n(r(b("arrowUp",11),b("arrowDown",11)),i)+n(r(b("enter",11)),t)+n(r("Esc"),e)}class ba{constructor(t,e=()=>document.body,r=D){d(this,"backdrop",null);d(this,"modal",null);d(this,"input",null);d(this,"list",null);d(this,"items",[]);d(this,"filtered",[]);d(this,"selectedIndex",0);d(this,"callbacks");d(this,"boundKeydown");this.host=e,this.t=r,this.callbacks=t,this.boundKeydown=this.handleKeydown.bind(this)}open(t){if(this.backdrop)return;this.items=t,this.filtered=t,this.selectedIndex=0,this.backdrop=document.createElement("div"),this.backdrop.className="tcw-modal-backdrop",this.backdrop.addEventListener("click",()=>this.close()),this.modal=document.createElement("div"),this.modal.className="tcw-cmd-palette";const e=document.createElement("div");e.className="tcw-cmd-header";const r=document.createElement("span");r.className="tcw-cmd-icon",r.innerHTML=b("search",16),e.appendChild(r),this.input=document.createElement("input"),this.input.className="tcw-cmd-input",this.input.type="text",this.input.placeholder=this.t("palette.placeholder"),this.input.addEventListener("input",()=>this.filter()),e.appendChild(this.input);const n=document.createElement("span");n.className="tcw-cmd-hint",n.textContent="ESC",e.appendChild(n),this.modal.appendChild(e),this.list=document.createElement("div"),this.list.className="tcw-cmd-list",this.modal.appendChild(this.list);const s=document.createElement("div");s.className="tcw-cmd-footer",s.innerHTML=as(this.t("common.navigate"),this.t("common.select"),this.t("common.close")),this.modal.appendChild(s),this.host().append(this.backdrop,this.modal),this.renderList(),this.input.focus(),document.addEventListener("keydown",this.boundKeydown)}close(){var t,e;document.removeEventListener("keydown",this.boundKeydown),(t=this.backdrop)==null||t.remove(),(e=this.modal)==null||e.remove(),this.backdrop=null,this.modal=null,this.input=null,this.list=null,this.callbacks.onClose()}isOpen(){return this.backdrop!==null}filter(){var e;const t=((e=this.input)==null?void 0:e.value.toLowerCase().trim())??"";t?this.filtered=this.items.filter(r=>r.label.toLowerCase().includes(t)||r.category.toLowerCase().includes(t)||r.id.toLowerCase().includes(t)):this.filtered=this.items,this.selectedIndex=0,this.renderList()}renderList(){if(!this.list)return;if(this.list.innerHTML="",this.filtered.length===0){const e=document.createElement("div");e.className="tcw-cmd-empty",e.textContent=this.t("palette.empty"),this.list.appendChild(e);return}let t="";for(let e=0;e<this.filtered.length;e++){const r=this.filtered[e];if(r.category!==t){t=r.category;const a=document.createElement("div");a.className="tcw-cmd-category",a.textContent=this.categoryLabel(t),this.list.appendChild(a)}const n=document.createElement("button");n.className="tcw-cmd-item",e===this.selectedIndex&&n.classList.add("tcw-selected"),r.active&&n.classList.add("tcw-active"),n.dataset.index=String(e);const s=document.createElement("span");if(s.className="tcw-cmd-item-label",s.textContent=r.label,n.appendChild(s),r.active){const a=document.createElement("span");a.className="tcw-cmd-check",a.innerHTML=b("check",14),n.appendChild(a)}if(r.shortcut){const a=document.createElement("kbd");a.className="tcw-cmd-kbd",a.textContent=r.shortcut,n.appendChild(a)}n.addEventListener("click",()=>this.select(e)),n.addEventListener("mouseenter",()=>{this.selectedIndex=e,this.updateSelection()}),this.list.appendChild(n)}}updateSelection(){var e;if(!this.list)return;const t=this.list.querySelectorAll(".tcw-cmd-item");t.forEach((r,n)=>{r.classList.toggle("tcw-selected",n===this.selectedIndex)}),(e=t[this.selectedIndex])==null||e.scrollIntoView({block:"nearest"})}select(t){const e=this.filtered[t];if(e){switch(e.category){case"indicator":this.callbacks.onIndicator(e.id);break;case"chartType":this.callbacks.onChartType(e.id);break;case"drawing":this.callbacks.onDrawingTool(e.id);break;case"timeframe":this.callbacks.onTimeframe(e.id);break;case"action":this.callbacks.onAction(e.id);break}this.close()}}handleKeydown(t){switch(t.key){case"Escape":t.preventDefault(),this.close();break;case"ArrowDown":t.preventDefault(),this.filtered.length>0&&(this.selectedIndex=(this.selectedIndex+1)%this.filtered.length,this.updateSelection());break;case"ArrowUp":t.preventDefault(),this.filtered.length>0&&(this.selectedIndex=(this.selectedIndex-1+this.filtered.length)%this.filtered.length,this.updateSelection());break;case"Enter":t.preventDefault(),this.select(this.selectedIndex);break}}categoryLabel(t){switch(t){case"indicator":return this.t("palette.group.indicator");case"chartType":return this.t("palette.group.chartType");case"drawing":return this.t("palette.group.drawing");case"timeframe":return this.t("palette.group.timeframe");case"action":return this.t("palette.group.action");default:return t}}destroy(){this.close()}}const va=150;class ya{constructor(t,e=()=>document.body,r=D){d(this,"backdrop",null);d(this,"modal",null);d(this,"input",null);d(this,"list",null);d(this,"symbols",[]);d(this,"current","");d(this,"filtered",[]);d(this,"selectedIndex",0);d(this,"callbacks");d(this,"boundKeydown");d(this,"pickOverride",null);d(this,"searchFn",null);d(this,"searchTimer",null);d(this,"searchAbort",null);d(this,"status","idle");d(this,"pickOnResults",!1);this.host=e,this.t=r,this.callbacks=t,this.boundKeydown=this.handleKeydown.bind(this)}open(t,e,r,n){if(this.backdrop)return;this.pickOverride=r??null,this.searchFn=n??null,this.status="idle",this.symbols=t,this.current=e,this.filtered=t.map(l=>({symbol:l,score:0})),this.selectedIndex=Math.max(0,t.indexOf(e)),this.backdrop=document.createElement("div"),this.backdrop.className="tcw-modal-backdrop",this.backdrop.addEventListener("click",()=>this.close()),this.modal=document.createElement("div"),this.modal.className="tcw-cmd-palette";const s=document.createElement("div");s.className="tcw-cmd-header";const a=document.createElement("span");a.className="tcw-cmd-icon",a.innerHTML=b("search",16),s.appendChild(a),this.input=document.createElement("input"),this.input.className="tcw-cmd-input",this.input.type="text",this.input.placeholder=this.t("symbolSearch.placeholder"),this.input.autocomplete="off",this.input.spellcheck=!1,this.input.addEventListener("input",()=>this.filter()),s.appendChild(this.input);const o=document.createElement("span");o.className="tcw-cmd-hint",o.textContent="ESC",s.appendChild(o),this.modal.appendChild(s),this.list=document.createElement("div"),this.list.className="tcw-cmd-list",this.modal.appendChild(this.list);const c=document.createElement("div");c.className="tcw-cmd-footer",c.innerHTML=as(this.t("common.navigate"),this.t("common.open"),this.t("common.close")),this.modal.appendChild(c),this.host().append(this.backdrop,this.modal),this.renderList(),this.input.focus(),document.addEventListener("keydown",this.boundKeydown)}close(){var t,e;document.removeEventListener("keydown",this.boundKeydown),this.cancelSearch(),this.pickOnResults=!1,this.searchFn=null,(t=this.backdrop)==null||t.remove(),(e=this.modal)==null||e.remove(),this.backdrop=null,this.modal=null,this.input=null,this.list=null,this.pickOverride=null,this.callbacks.onClose()}isOpen(){return this.backdrop!==null}destroy(){this.close()}filter(){var e,r;this.pickOnResults=!1;const t=(((e=this.input)==null?void 0:e.value)??"").toUpperCase().trim();if(this.searchFn&&t){this.scheduleSearch(((r=this.input)==null?void 0:r.value.trim())??"");return}this.cancelSearch(),this.status="idle",t?this.filtered=this.symbols.map(n=>({symbol:n,score:xa(n.toUpperCase(),t)})).filter(n=>n.score>0).sort((n,s)=>s.score-n.score):this.filtered=this.symbols.map(n=>({symbol:n,score:0})),this.selectedIndex=0,this.renderList()}scheduleSearch(t){this.searchTimer!==null&&clearTimeout(this.searchTimer),this.searchTimer=setTimeout(()=>{this.searchTimer=null,this.runSearch(t)},va)}searchNow(){var t;this.searchTimer!==null&&clearTimeout(this.searchTimer),this.searchTimer=null,this.runSearch(((t=this.input)==null?void 0:t.value.trim())??"")}async runSearch(t){var n;const e=this.searchFn;if(!e)return;(n=this.searchAbort)==null||n.abort();const r=new AbortController;this.searchAbort=r,this.status="searching",this.filtered=[],this.renderList();try{const s=await e(t,r.signal);if(r.signal.aborted)return;this.filtered=s.map(a=>({symbol:a.symbol,score:0,description:a.description,meta:[a.exchange,a.type].filter(Boolean).join(" · ")||void 0})),this.status="idle"}catch{if(r.signal.aborted)return;this.filtered=[],this.status="failed"}this.selectedIndex=0,this.renderList(),this.pickOnResults&&(this.pickOnResults=!1,this.pick(0))}cancelSearch(){var t;this.searchTimer!==null&&clearTimeout(this.searchTimer),this.searchTimer=null,(t=this.searchAbort)==null||t.abort(),this.searchAbort=null}renderList(){var e;if(!this.list)return;if(this.list.innerHTML="",this.filtered.length===0){const r=document.createElement("div");r.className="tcw-cmd-empty",r.setAttribute("role","status"),r.textContent=this.status==="searching"?this.t("symbolSearch.searching"):this.status==="failed"?this.t("symbolSearch.failed"):this.t("symbolSearch.empty"),this.list.appendChild(r);return}const t=(((e=this.input)==null?void 0:e.value)??"").toUpperCase().trim();for(let r=0;r<this.filtered.length;r++){const{symbol:n,description:s,meta:a}=this.filtered[r],o=document.createElement("button");o.className="tcw-cmd-item",r===this.selectedIndex&&o.classList.add("tcw-selected"),n===this.current&&o.classList.add("tcw-active");const c=document.createElement("span");if(c.className="tcw-cmd-item-label",c.innerHTML=ka(n,t),o.appendChild(c),s&&s!==n){const l=document.createElement("span");l.className="tcw-cmd-item-desc",l.textContent=s,o.appendChild(l)}if(a){const l=document.createElement("span");l.className="tcw-cmd-item-meta",l.textContent=a,o.appendChild(l)}if(n===this.current){const l=document.createElement("span");l.className="tcw-cmd-check",l.innerHTML=b("check",14),o.appendChild(l)}o.addEventListener("click",()=>this.pick(r)),o.addEventListener("mouseenter",()=>{this.selectedIndex=r,this.updateSelection()}),this.list.appendChild(o)}}updateSelection(){var e,r;if(!this.list)return;const t=this.list.querySelectorAll(".tcw-cmd-item");t.forEach((n,s)=>n.classList.toggle("tcw-selected",s===this.selectedIndex)),(r=(e=t[this.selectedIndex])==null?void 0:e.scrollIntoView)==null||r.call(e,{block:"nearest"})}pick(t){const e=this.filtered[t];if(!e)return;const r=this.pickOverride;r?r(e.symbol):this.callbacks.onPick(e.symbol),this.close()}handleKeydown(t){switch(t.key){case"Escape":t.preventDefault(),this.close();break;case"ArrowDown":t.preventDefault(),this.filtered.length>0&&(this.selectedIndex=(this.selectedIndex+1)%this.filtered.length,this.updateSelection());break;case"ArrowUp":t.preventDefault(),this.filtered.length>0&&(this.selectedIndex=(this.selectedIndex-1+this.filtered.length)%this.filtered.length,this.updateSelection());break;case"Enter":if(t.preventDefault(),this.searchTimer!==null||this.status==="searching"){this.pickOnResults=!0,this.searchTimer!==null&&this.searchNow();break}this.pick(this.selectedIndex);break}}}function xa(i,t){if(i===t)return 1e3;if(i.startsWith(t))return 500+(50-Math.min(50,i.length-t.length));if(i.includes(t))return 200+(50-Math.min(50,i.length-t.length));let e=0,r=-1,n=0;for(let s=0;s<i.length&&e<t.length;s++)i[s]===t[e]&&(r>=0&&(n+=s-r-1),r=s,e++);return e<t.length?0:100-Math.min(99,n)}function ka(i,t){if(!t)return T(i);const e=i.toUpperCase();let r="",n=0;for(let s=0;s<i.length;s++)n<t.length&&e[s]===t[n]?(r+=`<mark style="background:transparent;color:var(--tcw-accent);font-weight:700">${T(i[s])}</mark>`,n++):r+=T(i[s]);return r}const Sa={"Search & navigation":"hotkeys.group.searchNavigation","Chart manipulation":"hotkeys.group.chartManipulation","Touch (mobile / tablet)":"hotkeys.group.touch",Keyboard:"hotkeys.group.keyboard",Drawing:"hotkeys.group.drawing",More:"hotkeys.group.more"},Ea=typeof navigator<"u"&&/mac|iphone|ipad|ipod/i.test(navigator.platform||navigator.userAgent),F=Ea?"⌘":"Ctrl",Ca=[{title:"Search & navigation",entries:[{keys:[F,"K"],label:"hotkeys.commandPalette",feature:"hotkeys.commandPalette"},{keys:[F,"P"],label:"hotkeys.symbolSearch",feature:"hotkeys.symbolSearch"},{keys:["Alt","G"],label:"hotkeys.goToDate",feature:"hotkeys.goToDate"},{keys:["Alt","I"],label:"hotkeys.invertScale",feature:"hotkeys.invertScale"},{keys:["Alt","R"],label:"chartMenu.resetView",feature:"hotkeys.resetView"},{keys:[F,"S"],label:"hotkeys.saveLayout",feature:"hotkeys.save"},{keys:["0–9"],label:"hotkeys.typeInterval",feature:"intervalTyping"},{keys:["?"],label:"hotkeys.showSheet",feature:"hotkeys.help"}]},{title:"Chart manipulation",entries:[{keys:["key.drag"],label:"hotkeys.pan"},{keys:[F,"key.drag"],label:"hotkeys.boxSelect"},{keys:[F,"key.click"],label:"hotkeys.toggleSelect"},{keys:["Shift","key.drag"],label:"hotkeys.measure"},{keys:["key.drag","key.priceAxis"],label:"hotkeys.scalePrice"},{keys:["key.drag","key.timeAxis"],label:"hotkeys.zoomTime"},{keys:["key.doubleClick","key.priceAxis"],label:"hotkeys.autoScale"},{keys:["key.doubleClick","key.timeAxis"],label:"hotkeys.fit"},{keys:["key.scroll"],label:"hotkeys.zoomCursor"}]},{title:"Touch (mobile / tablet)",entries:[{keys:["key.oneFinger","key.drag"],label:"hotkeys.touchPan"},{keys:["key.twoFingers","key.pinch"],label:"hotkeys.pinch"},{keys:["key.longPress"],label:"hotkeys.longPress"},{keys:["key.drag","key.axisStrip"],label:"hotkeys.touchAxis"}]},{title:"Keyboard",entries:[{keys:["←","→"],label:"hotkeys.panBar"},{keys:["+","−"],label:"hotkeys.zoomInOut"},{keys:["Home"],label:"hotkeys.toStart"},{keys:["End"],label:"hotkeys.toEnd"},{keys:["F"],label:"hotkeys.fit"}]},{title:"Drawing",entries:[{keys:[F,"Z"],label:"hotkeys.undo"},{keys:[F,"Shift","Z"],label:"hotkeys.redo"},{keys:["Esc"],label:"hotkeys.cancelDrawing"},{keys:[F,"C"],label:"hotkeys.copy"},{keys:[F,"V"],label:"hotkeys.paste"},{keys:["key.rightClick"],label:"hotkeys.drawingMenu"},{keys:["key.doubleClick"],label:"hotkeys.drawingSettings"},{keys:[F,"G"],label:"hotkeys.group"},{keys:[F,"Shift","G"],label:"hotkeys.ungroup"},{keys:[F,"]","["],label:"hotkeys.orderStep"},{keys:[F,"Shift","]","["],label:"hotkeys.orderEnd"},{keys:["Enter"],label:"hotkeys.finishPath"},{keys:["Alt","T"],label:"tool.trendLine",feature:"hotkeys.tools"},{keys:["Alt","H"],label:"tool.horizontalLine",feature:"hotkeys.tools"},{keys:["Alt","J"],label:"tool.horizontalRay",feature:"hotkeys.tools"},{keys:["Alt","V"],label:"tool.verticalLine",feature:"hotkeys.tools"},{keys:["Alt","C"],label:"tool.crossLine",feature:"hotkeys.tools"},{keys:["Alt","F"],label:"tool.fibRetracement",feature:"hotkeys.tools"}]}];class Ta{constructor(t,e,r=()=>document.body){d(this,"backdrop",null);d(this,"modal",null);d(this,"callbacks");d(this,"t");d(this,"boundKeydown");this.host=r,this.callbacks=t,this.t=e,this.boundKeydown=n=>{n.key==="Escape"&&(n.preventDefault(),this.close())}}open(t={}){if(this.backdrop)return;const e=t.isOn??(()=>!0),r=new Set((t.extra??[]).map(f=>f.keys.join("+").toLowerCase())),n=Ca.map(f=>({title:f.title,entries:f.entries.filter(g=>(!g.feature||e(g.feature))&&!r.has(g.keys.join("+").toLowerCase()))})).filter(f=>f.entries.length>0);t.extra&&t.extra.length>0&&n.push({title:"More",entries:[...t.extra]}),this.backdrop=document.createElement("div"),this.backdrop.className="tcw-modal-backdrop",this.backdrop.addEventListener("click",()=>this.close()),this.modal=document.createElement("div"),this.modal.className="tcw-modal tcw-hotkey-sheet",this.modal.style.width="640px";const s=document.createElement("div");s.className="tcw-modal-header";const a=document.createElement("h3");a.textContent=this.t("hotkeys.title"),s.appendChild(a);const o=document.createElement("button");o.className="tcw-modal-close",o.setAttribute("aria-label",this.t("hotkeys.close")),o.innerHTML=b("x",14),o.addEventListener("click",()=>this.close()),s.appendChild(o),this.modal.appendChild(s);const c=document.createElement("div");c.className="tcw-modal-body";const l=document.createElement("div");l.className="tcw-hotkey-grid";for(const f of n){const g=document.createElement("section");g.className="tcw-hotkey-section";const v=document.createElement("div");v.className="tcw-settings-section-title";const y=Sa[f.title];v.textContent=y?this.t(y):f.title,g.appendChild(v);for(const L of f.entries){const C=document.createElement("div");C.className="tcw-hotkey-row";const E=document.createElement("div");E.className="tcw-hotkey-keys";for(let U=0;U<L.keys.length;U++){if(U>0){const G=document.createElement("span");G.className="tcw-hotkey-sep",G.textContent="+",E.appendChild(G)}const K=document.createElement("kbd");K.className="tcw-cmd-kbd";const q=L.keys[U];K.textContent=q.startsWith("key.")?this.t(q):q,E.appendChild(K)}C.appendChild(E);const R=document.createElement("span");R.className="tcw-hotkey-label",R.textContent="text"in L?L.text:this.t(L.label),C.appendChild(R),g.appendChild(C)}l.appendChild(g)}c.appendChild(l),this.modal.appendChild(c);const h=document.createElement("div");h.className="tcw-modal-footer";const p=document.createElement("span");p.style.cssText="font-size:11px;color:var(--tcw-text-muted)",p.textContent=this.t("hotkeys.footer"),h.appendChild(p);const m=document.createElement("button");m.className="tcw-done-btn",m.textContent=this.t("hotkeys.gotIt"),m.addEventListener("click",()=>this.close()),h.appendChild(m),this.modal.appendChild(h),this.host().append(this.backdrop,this.modal),document.addEventListener("keydown",this.boundKeydown)}close(){var t,e;document.removeEventListener("keydown",this.boundKeydown),(t=this.backdrop)==null||t.remove(),(e=this.modal)==null||e.remove(),this.backdrop=null,this.modal=null,this.callbacks.onClose()}isOpen(){return this.backdrop!==null}destroy(){this.close()}}const La={selectHint:"Click a bar to start the replay",random:"Random bar",realtime:"Back to realtime",barsPerSecond:"bars/s",play:"Play",pause:"Pause",stepBack:"Step back (Shift+←)",stepForward:"Step forward (Shift+→)",replay:"Replay",position:"Replay position",speed:"Speed",step:"Step"},Aa=[1,2,3,5,10,25,50],Ue=5;class Na{constructor(t,e={}){d(this,"root",null);d(this,"scrubber",null);d(this,"progressLabel",null);d(this,"playBtn",null);d(this,"realtimeBtn",null);d(this,"state","stopped");d(this,"mode","select");d(this,"ended",!1);d(this,"total",0);d(this,"speed",Ue);d(this,"steps",[]);d(this,"step","bar");d(this,"labels");this.callbacks=t,this.labels={...La,...e}}mount(t,e){this.root||(this.total=Math.max(0,e.total),this.speed=e.speed??Ue,this.steps=e.steps??[],this.step=e.step??"bar",this.state="paused",this.mode=e.mode??"select",this.root=document.createElement("div"),this.root.className="tcw-replay-bar",k(this.root,"replay"),this.root.setAttribute("role","toolbar"),this.root.setAttribute("aria-label",this.labels.replay),this.root.innerHTML=this.markup(),t.appendChild(this.root),this.wireEvents(),this.syncUi())}unmount(){var t;(t=this.root)==null||t.remove(),this.root=null,this.scrubber=null,this.progressLabel=null,this.playBtn=null,this.realtimeBtn=null,this.state="stopped",this.ended=!1}isMounted(){return this.root!==null}getMode(){return this.mode}setMode(t){var r,n;const e=!!((r=this.root)!=null&&r.contains(document.activeElement));this.mode=t,this.syncUi(),e&&t==="replay"&&((n=this.playBtn)==null||n.focus())}setState(t){this.state=t,this.syncUi()}setEnded(t){this.ended!==t&&(this.ended=t,this.syncUi())}setProgress(t,e){this.total=e,this.scrubber&&(this.scrubber.max=String(Math.max(0,e-1)),this.scrubber.value=String(t)),this.progressLabel&&(this.progressLabel.textContent=`${Math.min(t+1,e)} / ${e}`)}destroy(){this.unmount()}markup(){const t=this.labels,e=Aa.map(r=>`<option value="${r}"${r===this.speed?" selected":""}>${r} ${T(t.barsPerSecond)}</option>`).join("");return`
      <span class="tcw-replay-group" data-mode="select">
        <span class="tcw-replay-hint" role="status">${Da()}${T(t.selectHint)}</span>
        <button class="tcw-replay-text-btn" data-act="random">${T(t.random)}</button>
      </span>
      <span class="tcw-replay-group" data-mode="replay">
        <button class="tcw-replay-btn" data-act="stepBack" title="${T(t.stepBack)}" aria-label="${T(t.stepBack)}">${Ia()}</button>
        <button class="tcw-replay-btn tcw-replay-play" data-act="play" title="${T(t.play)}" aria-label="${T(t.play)}">${nn()}</button>
        <button class="tcw-replay-btn" data-act="stepForward" title="${T(t.stepForward)}" aria-label="${T(t.stepForward)}">${Pa()}</button>
        <input type="range" class="tcw-replay-scrubber" data-act="seek" min="0" max="${Math.max(0,this.total-1)}" value="0" step="1" aria-label="${T(this.labels.position)}" />
        <span class="tcw-replay-progress" data-tcw="progress">1 / ${this.total}</span>
        <select class="tcw-replay-speed" data-act="speed" aria-label="${T(this.labels.speed)}">${e}</select>
      </span>
      ${this.steps.length>1?`<select class="tcw-replay-speed tcw-replay-step" data-act="step" aria-label="${T(t.step)}" title="${T(t.step)}">${this.steps.map(r=>`<option value="${T(r.value)}"${r.value===this.step?" selected":""}>${T(r.label)}</option>`).join("")}</select>`:""}
      <button class="tcw-replay-text-btn tcw-replay-realtime" data-act="realtime">${T(t.realtime)}</button>
    `}wireEvents(){var e,r,n,s,a,o,c,l;const t=this.root;t&&(this.scrubber=t.querySelector('input[data-act="seek"]'),this.progressLabel=t.querySelector('[data-tcw="progress"]'),this.playBtn=t.querySelector('button[data-act="play"]'),this.realtimeBtn=t.querySelector('button[data-act="realtime"]'),(e=this.realtimeBtn)==null||e.addEventListener("click",()=>this.callbacks.onClose()),(r=t.querySelector('[data-act="random"]'))==null||r.addEventListener("click",()=>this.callbacks.onRandomStart()),(n=t.querySelector('[data-act="stepBack"]'))==null||n.addEventListener("click",()=>this.callbacks.onStepBack()),(s=t.querySelector('[data-act="stepForward"]'))==null||s.addEventListener("click",()=>this.callbacks.onStepForward()),(a=this.playBtn)==null||a.addEventListener("click",()=>{this.state==="playing"?this.callbacks.onPause():this.callbacks.onPlay()}),(o=this.scrubber)==null||o.addEventListener("input",()=>this.callbacks.onSeek(Number(this.scrubber.value))),(c=t.querySelector('[data-act="speed"]'))==null||c.addEventListener("change",h=>{const p=Number(h.target.value);this.speed=p,this.callbacks.onSpeedChange(p)}),(l=t.querySelector('[data-act="step"]'))==null||l.addEventListener("change",h=>{var p,m;this.step=h.target.value,(m=(p=this.callbacks).onStepChange)==null||m.call(p,this.step)}))}syncUi(){var e;const t=this.root;if(t){for(const r of t.querySelectorAll(".tcw-replay-group"))r.hidden=r.dataset.mode!==this.mode;if(t.classList.toggle("tcw-replay-bar--ended",this.ended),this.playBtn){const r=this.state==="playing";this.playBtn.innerHTML=r?Ma():nn(),this.playBtn.title=r?this.labels.pause:this.labels.play,this.playBtn.setAttribute("aria-label",this.playBtn.title);const n=this.ended&&!r;n&&document.activeElement===this.playBtn&&((e=this.realtimeBtn)==null||e.focus()),this.playBtn.disabled=n}}}}const nn=()=>b("play",14),Ma=()=>b("pause",14),Ia=()=>b("stepBack",14),Pa=()=>b("stepForward",14),Da=()=>b("cursor",14);class Ba{constructor(t,e,r,n={}){d(this,"el");d(this,"toggleEl",null);d(this,"headerEl");d(this,"nameBtn");d(this,"menuEl");d(this,"listEl");d(this,"rowMap",new Map);d(this,"entries",new Map);d(this,"lists",[]);d(this,"activeList","");d(this,"active",null);d(this,"locale");d(this,"dragging",null);d(this,"collapsed",!1);d(this,"onOutside",t=>{this.headerEl.contains(t.target)||this.closeMenu()});this.callbacks=e,this.labels=r,this.el=document.createElement("div"),this.el.className="tcw-watchlist",this.el.setAttribute("aria-label",r.title),this.headerEl=document.createElement("div"),this.headerEl.className="tcw-watchlist-header",this.nameBtn=document.createElement("button"),this.nameBtn.type="button",this.nameBtn.className="tcw-watchlist-name",this.nameBtn.setAttribute("aria-haspopup","menu"),this.nameBtn.setAttribute("aria-expanded","false"),this.nameBtn.title=r.lists,this.nameBtn.addEventListener("click",()=>this.menuEl.hidden?this.openMenu():this.closeMenu());const s=document.createElement("button");s.type="button",s.className="tcw-watchlist-add",s.textContent="+",s.title=r.add,s.setAttribute("aria-label",r.add),s.hidden=!e.onAdd,s.addEventListener("click",()=>{var a;return(a=e.onAdd)==null?void 0:a.call(e)}),this.menuEl=document.createElement("div"),this.menuEl.className="tcw-dropdown tcw-watchlist-menu",this.menuEl.setAttribute("role","menu"),this.menuEl.hidden=!0,this.headerEl.append(this.nameBtn,s,this.menuEl),this.el.appendChild(this.headerEl),this.listEl=document.createElement("div"),this.listEl.className="tcw-watchlist-list",this.listEl.setAttribute("role","list"),this.el.appendChild(this.listEl),n.collapsible&&(this.toggleEl=document.createElement("button"),this.toggleEl.type="button",this.toggleEl.className="tcw-watchlist-toggle",this.toggleEl.title=r.title,this.toggleEl.setAttribute("aria-label",r.title),this.toggleEl.setAttribute("aria-expanded","true"),this.toggleEl.addEventListener("click",()=>this.setCollapsed(!this.collapsed)),this.updateToggle(),t.appendChild(this.toggleEl)),t.appendChild(this.el)}setLists(t,e){var n;this.lists=t.map(s=>({...s,symbols:[...s.symbols]})),this.activeList=t.some(s=>s.id===e)?e:((n=t[0])==null?void 0:n.id)??"";const r=this.shownList();this.nameBtn.textContent=(r==null?void 0:r.name)??this.labels.title,this.renderRows((r==null?void 0:r.symbols)??[]),this.menuEl.hidden||this.renderMenu()}setLocale(t){this.locale=t;for(const e of this.rowMap.keys())this.renderRow(e)}setActive(t){this.active=t;for(const[e,r]of this.rowMap){const n=e===t;r.row.classList.toggle("tcw-watchlist-active",n),n?r.row.setAttribute("aria-current","true"):r.row.removeAttribute("aria-current")}}setEntry(t,e){const r=this.entries.get(t)??{symbol:t};this.entries.set(t,{...r,...e,symbol:t}),this.renderRow(t)}destroy(){var t;this.closeMenu(),(t=this.toggleEl)==null||t.remove(),this.toggleEl=null,this.el.remove(),this.rowMap.clear(),this.entries.clear()}setCollapsed(t){this.collapsed=t,this.closeMenu(),this.el.hidden=t,this.updateToggle()}updateToggle(){this.toggleEl&&(this.toggleEl.innerHTML=b(this.collapsed?"chevronLeft":"chevronRight",16),this.toggleEl.setAttribute("aria-expanded",String(!this.collapsed)))}shownList(){return this.lists.find(t=>t.id===this.activeList)}renderRows(t){for(const e of[...this.rowMap.keys()])t.includes(e)||(this.rowMap.get(e).row.remove(),this.rowMap.delete(e));for(const e of t)this.rowMap.has(e)||this.makeRow(e);if(this.listEl.replaceChildren(...t.map(e=>this.rowMap.get(e).row)),t.length===0){const e=document.createElement("div");e.className="tcw-watchlist-empty",e.textContent=this.labels.empty,this.listEl.appendChild(e)}this.active&&this.setActive(this.active)}makeRow(t){const e=document.createElement("div");e.className="tcw-watchlist-row",e.setAttribute("role","listitem"),e.dataset.symbol=t,e.tabIndex=0,e.draggable=!!this.callbacks.onMove;const r=document.createElement("div");r.className="tcw-watchlist-symbol",r.textContent=za(t);const n=document.createElement("canvas");n.className="tcw-watchlist-spark",n.width=64,n.height=22;const s=document.createElement("div");s.className="tcw-watchlist-stats";const a=document.createElement("span");a.className="tcw-watchlist-price",a.textContent="—";const o=document.createElement("span");if(o.className="tcw-watchlist-change",s.append(a,o),e.append(r,n,s),this.callbacks.onRemove){const c=document.createElement("button");c.type="button",c.className="tcw-watchlist-remove",c.innerHTML=b("x",12),c.tabIndex=-1;const l=S(this.labels.remove,{symbol:t});c.title=l,c.setAttribute("aria-label",l),c.addEventListener("click",h=>{var p,m;h.stopPropagation(),(m=(p=this.callbacks).onRemove)==null||m.call(p,t)}),e.appendChild(c)}e.addEventListener("click",()=>this.callbacks.onSelect(t)),e.addEventListener("keydown",c=>this.onRowKey(c,t)),e.addEventListener("dragstart",c=>{var l;this.dragging=t,(l=c.dataTransfer)==null||l.setData("text/plain",t),c.dataTransfer&&(c.dataTransfer.effectAllowed="move"),e.classList.add("tcw-watchlist-dragging")}),e.addEventListener("dragend",()=>{this.dragging=null,e.classList.remove("tcw-watchlist-dragging")}),e.addEventListener("dragover",c=>{this.dragging&&this.dragging!==t&&c.preventDefault()}),e.addEventListener("drop",c=>{var p,m,f;c.preventDefault();const l=this.dragging;if(this.dragging=null,!l||l===t)return;const h=((p=this.shownList())==null?void 0:p.symbols)??[];(f=(m=this.callbacks).onMove)==null||f.call(m,l,h.indexOf(t))}),this.rowMap.set(t,{row:e,priceEl:a,changeEl:o,sparkCanvas:n}),this.renderRow(t)}onRowKey(t,e){var s,a,o,c,l,h;const r=((s=this.shownList())==null?void 0:s.symbols)??[],n=r.indexOf(e);if(["Enter"," ","Delete","Backspace","ArrowDown","ArrowUp"].includes(t.key)&&t.stopPropagation(),t.key==="Enter"||t.key===" ")t.preventDefault(),this.callbacks.onSelect(e);else if((t.key==="Delete"||t.key==="Backspace")&&this.callbacks.onRemove){t.preventDefault();const p=r[n+1]??r[n-1];this.callbacks.onRemove(e),p&&((a=this.rowMap.get(p))==null||a.row.focus())}else if(t.key==="ArrowDown"||t.key==="ArrowUp"){t.preventDefault();const p=n+(t.key==="ArrowDown"?1:-1);if(p<0||p>=r.length)return;t.altKey?((c=(o=this.callbacks).onMove)==null||c.call(o,e,p),(l=this.rowMap.get(e))==null||l.row.focus()):(h=this.rowMap.get(r[p]))==null||h.row.focus()}}renderRow(t){const e=this.rowMap.get(t),r=this.entries.get(t);if(!(!e||!r)){if(r.lastPrice!==void 0&&(e.priceEl.textContent=Oa(r.lastPrice,this.locale)),r.lastPrice!==void 0&&r.refPrice!==void 0&&r.refPrice!==0){const n=r.lastPrice-r.refPrice,s=n/r.refPrice*100,a=n>=0?"+":"-",o=Math.abs(s).toLocaleString(this.locale,{minimumFractionDigits:2,maximumFractionDigits:2});e.changeEl.textContent=`${a}${o}%`,e.changeEl.className=`tcw-watchlist-change ${n>=0?"tcw-up":"tcw-down"}`}else e.changeEl.textContent="";r.sparkline&&r.sparkline.length>=2&&Fa(e.sparkCanvas,r.sparkline,r.refPrice??r.sparkline[0])}}openMenu(){this.renderMenu(),this.menuEl.hidden=!1,this.nameBtn.setAttribute("aria-expanded","true"),document.addEventListener("mousedown",this.onOutside)}closeMenu(){this.menuEl.hidden=!0,this.nameBtn.setAttribute("aria-expanded","false"),document.removeEventListener("mousedown",this.onOutside)}renderMenu(){const t=(s,a)=>{const o=document.createElement("button");return o.type="button",o.className="tcw-dropdown-item",o.setAttribute("role","menuitem"),o.textContent=s,o.addEventListener("click",a),o},e=this.lists.map(s=>{const a=t("",()=>{var l,h;this.closeMenu(),(h=(l=this.callbacks).onPickList)==null||h.call(l,s.id)});a.dataset.list=s.id,a.classList.toggle("tcw-active",s.id===this.activeList);const o=document.createElement("span");o.textContent=s.name;const c=document.createElement("span");return c.className="tcw-watchlist-count",c.textContent=String(s.symbols.length),a.append(o,c),a}),r=document.createElement("div");if(r.className="tcw-dropdown-divider",e.push(r),this.callbacks.onCreateList){const s=t(this.labels.newList,()=>this.editName("",a=>{var o,c;return(c=(o=this.callbacks).onCreateList)==null?void 0:c.call(o,a)}));s.dataset.action="new",e.push(s)}const n=this.shownList();if(n&&this.callbacks.onRenameList){const s=t(this.labels.rename,()=>this.editName(n.name,a=>{var o,c;return(c=(o=this.callbacks).onRenameList)==null?void 0:c.call(o,n.id,a)}));s.dataset.action="rename",e.push(s)}if(n&&this.callbacks.onDeleteList&&this.lists.length>1){let s=!1;const a=t(this.labels.deleteList,()=>{var o,c;if(!s){s=!0,a.textContent=S(this.labels.confirmDelete,{name:n.name}),a.classList.add("tcw-danger");return}this.closeMenu(),(c=(o=this.callbacks).onDeleteList)==null||c.call(o,n.id)});a.dataset.action="delete",e.push(a)}this.menuEl.replaceChildren(...e)}editName(t,e){this.closeMenu();const r=document.createElement("input");r.className="tcw-watchlist-input",r.type="text",r.maxLength=60,r.value=t,r.placeholder=this.labels.listName,r.setAttribute("aria-label",this.labels.listName),this.nameBtn.hidden=!0,this.headerEl.insertBefore(r,this.nameBtn);let n=!1;const s=a=>{if(n)return;n=!0;const o=r.value.trim();r.remove(),this.nameBtn.hidden=!1,a&&o&&o!==t&&e(o),this.nameBtn.focus()};r.addEventListener("keydown",a=>{a.stopPropagation(),a.key==="Enter"?(a.preventDefault(),s(!0)):a.key==="Escape"&&(a.preventDefault(),a.stopPropagation(),s(!1))}),r.addEventListener("blur",()=>s(!1)),r.focus()}}function za(i){for(const t of["USDT","USD","BTC","ETH","EUR"])if(i.length>t.length&&i.endsWith(t))return i.slice(0,-t.length)+"/"+t;return i}function Oa(i,t){if(i===0)return"0";const e=Math.abs(i);return e>=1e3?i.toLocaleString(t,{minimumFractionDigits:2,maximumFractionDigits:2}):e>=1?i.toLocaleString(t,{minimumFractionDigits:4,maximumFractionDigits:4}):Number(i.toPrecision(4)).toLocaleString(t,{maximumFractionDigits:10})}function Fa(i,t,e){const r=i.getContext("2d");if(!r)return;const n=window.devicePixelRatio||1;i.width!==i.clientWidth*n&&(i.width=(i.clientWidth||64)*n,i.height=(i.clientHeight||22)*n);const s=i.width,a=i.height;let o=1/0,c=-1/0;for(const g of t)g<o&&(o=g),g>c&&(c=g);const l=Math.max(c-o,1e-9),m=t[t.length-1]>=e?"#1fa874":"#e8505b";r.clearRect(0,0,s,a),r.lineWidth=1.4*n,r.strokeStyle=m,r.beginPath();const f=s/(t.length-1);for(let g=0;g<t.length;g++){const v=g*f,y=a-(t[g]-o)/l*(a-4)-2;g===0?r.moveTo(v,y):r.lineTo(v,y)}r.stroke()}const os=50,cs=500,Ra=60,ls=64,se=i=>typeof i!="string"?null:i.trim().slice(0,Ra)||null,ds=i=>{if(typeof i!="string")return null;const t=i.trim();return t&&t.length<=ls?t:null};function hs(i){const t=[];for(const e of i){const r=ds(e);if(r&&!t.includes(r)&&t.push(r),t.length===cs)break}return t}function Ee(i){if(!i||typeof i!="object")return null;const t=i;if(!Array.isArray(t.lists))return null;const e=[];for(const n of t.lists){if(e.length===os)break;if(!n||typeof n!="object")continue;const s=n,a=typeof s.id=="string"&&s.id&&s.id.length<=ls?s.id:null,o=se(s.name);!a||!o||e.some(c=>c.id===a)||e.push({id:a,name:o,symbols:Array.isArray(s.symbols)?hs(s.symbols):[]})}if(e.length===0)return null;const r=typeof t.active=="string"&&e.some(n=>n.id===t.active)?t.active:e[0].id;return{lists:e,active:r}}const Ce=i=>({...i,symbols:[...i.symbols]});class $a{constructor(t){d(this,"lists");d(this,"active");d(this,"listeners",new Set);d(this,"storage");d(this,"storageKey");this.storage=t.storage??null,this.storageKey=t.storageKey??"tcw:watchlists";const e=this.load(),r=t.lists?Ee({lists:t.lists,active:t.activeList}):null,n=e??r??{lists:[{id:"default",name:se(t.defaultName)??"Watchlist",symbols:hs(t.symbols??[])}],active:"default"};this.lists=n.lists,this.active=n.active}getLists(){return this.lists.map(Ce)}getActive(){return Ce(this.activeList())}setActive(t){t===this.active||!this.lists.some(e=>e.id===t)||(this.active=t,this.changed())}replace(t,e){const r=Ee({lists:t,active:e??this.active});r&&(this.lists=r.lists,this.active=r.active,this.changed())}create(t){const e=se(t);if(!e||this.lists.length>=os)return null;let r=this.lists.length+1;for(;this.lists.some(s=>s.id===`list-${r}`);)r++;const n={id:`list-${r}`,name:e,symbols:[]};return this.lists=[...this.lists,n],this.active=n.id,this.changed(),Ce(n)}rename(t,e){const r=se(e);r&&this.update(t,n=>({...n,name:r}))}remove(t){this.lists.length<=1||!this.lists.some(e=>e.id===t)||(this.lists=this.lists.filter(e=>e.id!==t),this.active===t&&(this.active=this.lists[0].id),this.changed())}add(t,e=this.active){const r=ds(t),n=this.lists.find(s=>s.id===e);return!r||!n||n.symbols.includes(r)||n.symbols.length>=cs?!1:(this.update(e,s=>({...s,symbols:[...s.symbols,r]})),!0)}removeSymbol(t,e=this.active){const r=this.lists.find(n=>n.id===e);r!=null&&r.symbols.includes(t)&&this.update(e,n=>({...n,symbols:n.symbols.filter(s=>s!==t)}))}move(t,e,r=this.active){const n=this.lists.find(c=>c.id===r);if(!n)return;const s=n.symbols.indexOf(t);if(s<0)return;const a=n.symbols.filter(c=>c!==t),o=Math.max(0,Math.min(Math.round(e),a.length));o!==s&&this.update(r,c=>({...c,symbols:[...a.slice(0,o),t,...a.slice(o)]}))}subscribe(t){return this.listeners.add(t),()=>this.listeners.delete(t)}activeList(){return this.lists.find(t=>t.id===this.active)??this.lists[0]}update(t,e){this.lists=this.lists.map(r=>r.id===t?e(r):r),this.changed()}changed(){this.save();for(const t of this.listeners)t()}load(){if(!this.storage)return null;try{const t=this.storage.getItem(this.storageKey);return t?Ee(JSON.parse(t)):null}catch{return null}}save(){if(this.storage)try{this.storage.setItem(this.storageKey,JSON.stringify({lists:this.lists,active:this.active}))}catch{}}}class Ha{constructor(t,e=D,r={}){d(this,"el");d(this,"bodyEl");d(this,"newsEl");d(this,"shown",!1);this.t=e,this.callbacks=r,this.el=document.createElement("div"),this.el.className="tcw-syminfo",k(this.el,"symbolInfo"),this.el.setAttribute("role","dialog"),this.el.setAttribute("aria-label",e("symbolInfo.title")),this.el.hidden=!0;const n=document.createElement("div");n.className="tcw-syminfo-header";const s=document.createElement("span");s.textContent=e("symbolInfo.title");const a=document.createElement("button");a.type="button",a.className="tcw-syminfo-close",a.setAttribute("aria-label",e("common.close")),a.innerHTML=b("x",14),a.addEventListener("click",()=>this.close()),n.append(s,a),this.bodyEl=document.createElement("div"),this.bodyEl.className="tcw-syminfo-body",this.newsEl=document.createElement("div"),this.newsEl.className="tcw-syminfo-news",this.newsEl.hidden=!0,this.el.append(n,this.bodyEl,this.newsEl),t.appendChild(this.el)}isOpen(){return this.shown}toggle(){this.shown?this.close():this.open()}open(){var t,e;this.shown||(this.shown=!0,this.el.hidden=!1,(e=(t=this.callbacks).onToggle)==null||e.call(t,!0))}close(){var t,e;this.shown&&(this.shown=!1,this.el.hidden=!0,(e=(t=this.callbacks).onToggle)==null||e.call(t,!1))}render(t){const e=document.createElement("div");e.className="tcw-syminfo-head",e.append($("div","tcw-syminfo-symbol",t.symbol)),t.description&&e.append($("div","tcw-syminfo-desc",t.description)),t.meta&&e.append($("div","tcw-syminfo-meta",t.meta));const r=document.createElement("div");if(r.className="tcw-syminfo-quote",t.price&&r.append($("span","tcw-syminfo-price",t.price)),t.change){const a=$("span","tcw-syminfo-change",t.change.text);a.classList.add(t.change.up?"tcw-up":"tcw-down"),r.append(a)}const n=$("div","tcw-syminfo-status",t.status.text);n.dataset.state=t.status.state;const s=document.createElement("dl");s.className="tcw-syminfo-stats";for(const a of t.stats){const o=document.createElement("div");o.className="tcw-syminfo-stat",o.append($("dt","",a.label),$("dd","",a.value)),s.append(o)}this.bodyEl.replaceChildren(e,r,n,s)}renderNews(t){if(this.newsEl.hidden=t.kind==="none",t.kind==="none"){this.newsEl.replaceChildren();return}const e=$("div","tcw-syminfo-news-title",this.t("symbolInfo.news"));if(t.kind==="loading"||t.kind==="failed"||t.items.length===0){const n=t.kind==="loading"?"symbolInfo.loading":t.kind==="failed"?"symbolInfo.newsFailed":"symbolInfo.noNews";this.newsEl.replaceChildren($("div","tcw-syminfo-news-note",this.t(n)));return}const r=document.createElement("ul");r.className="tcw-syminfo-news-list";for(const n of t.items){const s=document.createElement("li");if(s.className="tcw-syminfo-news-item",n.url){const a=document.createElement("a");a.href=n.url,a.target="_blank",a.rel="noopener noreferrer",a.textContent=n.title,s.append(a)}else s.append($("span","",n.title));n.meta&&s.append($("div","tcw-syminfo-news-meta",n.meta)),r.append(s)}this.newsEl.replaceChildren(e,r)}destroy(){this.el.remove()}}function $(i,t,e){const r=document.createElement(i);return t&&(r.className=t),r.textContent=e,r}const sn=10,Wa=5*6e4,_a=864e5;function Ua(i){const{info:t,quote:e,t:r,textLocale:n}=i,s=Va(i.bars,t==null?void 0:t.timezone),a=i.formatPrice,o=(e==null?void 0:e.last)??(s==null?void 0:s.close),c=(e==null?void 0:e.prevClose)??(s==null?void 0:s.prevClose),l=(e==null?void 0:e.change)??(o!==void 0&&c!==void 0?o-c:void 0),h=o!==void 0&&l!==void 0?o-l:void 0,p=(e==null?void 0:e.changePercent)??(l!==void 0&&h?l/h*100:void 0),m=Wn(t,i.now);let f=r(m.state==="open"?"symbolInfo.open":m.state==="closed"?"symbolInfo.closed":"symbolInfo.always");if(m.state!=="always"&&m.next!==null){const E=us(m.next-i.now,n);f+=` · ${S(r(m.state==="open"?"symbolInfo.closesIn":"symbolInfo.opensIn"),{when:E})}`}const g=[],v=(E,R)=>{R&&g.push({label:E,value:R})},y=E=>E!==void 0?a(E):void 0;v(r("dataWindow.open"),y((e==null?void 0:e.open)??(s==null?void 0:s.open))),v(r("dataWindow.high"),y((e==null?void 0:e.high)??(s==null?void 0:s.high))),v(r("dataWindow.low"),y((e==null?void 0:e.low)??(s==null?void 0:s.low))),v(r("symbolInfo.prevClose"),y(c));const L=(e==null?void 0:e.volume)??(s==null?void 0:s.volume);v(r("dataWindow.volume"),L!==void 0?Ka(L,i.numberLocale):void 0),v(r("symbolInfo.bid"),y(e==null?void 0:e.bid)),v(r("symbolInfo.ask"),y(e==null?void 0:e.ask)),v(r("symbolInfo.tick"),(t==null?void 0:t.minTick)!==void 0?String(t.minTick):void 0),v(r("symbolInfo.currency"),t==null?void 0:t.currency),v(r("symbolInfo.timezone"),t==null?void 0:t.timezone),v(r("symbolInfo.hours"),qa(t,n));const C=(l??0)>=0?"+":"-";return{symbol:i.symbol,description:t==null?void 0:t.description,meta:[t==null?void 0:t.exchange,t==null?void 0:t.type].filter(Boolean).join(" · ")||void 0,price:o!==void 0?a(o):void 0,change:l!==void 0?{text:`${C}${a(Math.abs(l))}${p!==void 0?` (${C}${Math.abs(p).toFixed(2)}%)`:""}`,up:l>=0}:void 0,status:{state:m.state,text:f},stats:g}}class ja{constructor(){d(this,"request",0);d(this,"cache",new Map)}load(t,e,r,n,s){const a=++this.request;if(!e){r({kind:"none"});return}const o=l=>{const h=Date.now();r({kind:"items",items:l.map(p=>({title:p.title,url:p.url,meta:[p.source,us(p.time-h,n)].filter(Boolean).join(" · ")}))})},c=this.cache.get(t);if(c&&Date.now()-c.at<Wa){o(c.items);return}r({kind:"loading"}),Promise.resolve().then(()=>e(t,sn)).then(l=>{if(a!==this.request||s())return;const h=ii(l,sn);this.cache.set(t,{at:Date.now(),items:h}),o(h)}).catch(()=>{a===this.request&&!s()&&r({kind:"failed"})})}}function Va(i,t){if(i.length===0)return null;const e=t&&oe(t)?t:null,r=pt(i),n=p=>{const m=p*r;return Math.floor((m+(e?Os(e,m)*6e4:0))/_a)},s=i[i.length-1],a=n(s.time);let o=i.length-1;for(;o>0&&n(i[o-1].time)===a;)o--;let c=-1/0,l=1/0,h=0;for(let p=o;p<i.length;p++)c=Math.max(c,i[p].high),l=Math.min(l,i[p].low),h+=i[p].volume??0;return{open:i[o].open,high:c,low:l,close:s.close,volume:h,prevClose:o>0?i[o-1].close:void 0}}function us(i,t){const e=i/6e4,[r,n]=Math.abs(e)<60?[Math.round(e)||Math.sign(e)||1,"minute"]:Math.abs(e)<1440?[Math.round(e/60),"hour"]:[Math.round(e/1440),"day"];try{return new Intl.RelativeTimeFormat(t,{numeric:"auto"}).format(r,n)}catch{return new Intl.RelativeTimeFormat("en",{numeric:"auto"}).format(r,n)}}function Ka(i,t){try{return new Intl.NumberFormat(t,{notation:"compact",maximumFractionDigits:2}).format(i)}catch{return String(i)}}function qa(i,t){const e=(i==null?void 0:i.sessions)??[];if(e.length===0)return;let r;try{const s=new Intl.DateTimeFormat(t,{weekday:"short",timeZone:"UTC"});r=Array.from({length:7},(a,o)=>s.format(Date.UTC(1970,0,4+o)))}catch{r=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]}const n=s=>{const a=[...new Set((s??[]).filter(c=>Number.isInteger(c)&&c>=0&&c<=6))].sort((c,l)=>c-l);return a.length===0||a.length===7?"":a.every((c,l)=>l===0||c===a[l-1]+1)&&a.length>2?`${r[a[0]]}–${r[a[a.length-1]]}`:a.map(c=>r[c]).join(", ")};return e.map(s=>[`⁦${s.start}–${s.end}⁩`,n(s.days)].filter(Boolean).join(" ")).join(", ")}const je={KeyT:"trendLine",KeyH:"horizontalLine",KeyJ:"horizontalRay",KeyV:"verticalLine",KeyC:"crossLine",KeyF:"fibRetracement"};function Ga(){const i={};for(const[t,e]of Object.entries(je))i[e]=`Alt+${t.replace(/^Key/,"")}`;return i}const Ya=300,Xa=80,Ja=Fs**-3,Za=80;class Qa{constructor(t,e,r=D){d(this,"el");d(this,"holdTimer",null);d(this,"repeatTimer",null);d(this,"pressed",!1);d(this,"keyboardFocus",!1);d(this,"onMove",t=>{if(t.pointerType!=="touch"&&!(this.holdTimer||this.repeatTimer)){if(!this.nearBottom(t)&&!this.keyboardFocus){this.el.classList.remove("tcw-nav-shown"),this.stopHold();return}this.el.classList.contains("tcw-nav-shown")||this.place(),this.el.classList.add("tcw-nav-shown")}});d(this,"onLeave",()=>{this.el.classList.remove("tcw-nav-shown"),this.stopHold()});this.host=t,this.actions=e,this.el=document.createElement("div"),this.el.className="tcw-nav",k(this.el,"navigation"),this.el.setAttribute("role","toolbar"),this.el.setAttribute("aria-label",r("nav.label"));const n=[["zoomOut","minus",r("nav.zoomOut"),"navigation.zoom"],["zoomIn","plus",r("nav.zoomIn"),"navigation.zoom"],["scrollLeft","chevronLeft",r("nav.scrollLeft"),"navigation.scroll"],["scrollRight","chevronRight",r("nav.scrollRight"),"navigation.scroll"],["reset","reset",r("nav.reset"),"navigation.reset"]];for(const[s,a,o,c]of n){const l=document.createElement("button");if(l.type="button",l.className="tcw-nav-btn",l.dataset.nav=s,k(l,c),l.title=o,l.setAttribute("aria-label",o),l.innerHTML=b(a,16),s==="scrollLeft"||s==="scrollRight"){const h=s==="scrollRight"?1:-1;l.addEventListener("pointerdown",p=>{if(p.button===0){p.preventDefault();try{l.setPointerCapture(p.pointerId)}catch{}this.startHold(h)}});for(const p of["pointerup","pointercancel","pointerleave"])l.addEventListener(p,()=>this.stopHold());l.addEventListener("click",p=>{p.detail===0&&e.scroll(h)})}else l.addEventListener("click",()=>{s==="zoomIn"?e.zoomIn():s==="zoomOut"?e.zoomOut():e.reset()});this.el.appendChild(l)}for(const s of["dblclick","contextmenu","pointerdown","mousedown"])this.el.addEventListener(s,a=>a.stopPropagation());this.el.addEventListener("pointerdown",()=>{this.pressed=!0},{capture:!0}),this.el.addEventListener("pointerup",()=>{this.pressed=!1},{capture:!0}),this.el.addEventListener("focusin",()=>{this.keyboardFocus=!this.pressed,this.pressed=!1,this.place(),this.el.classList.add("tcw-nav-shown")}),this.el.addEventListener("focusout",s=>{this.el.contains(s.relatedTarget)||(this.keyboardFocus=!1,this.el.classList.remove("tcw-nav-shown"))}),t.appendChild(this.el),t.addEventListener("pointermove",this.onMove),t.addEventListener("pointerleave",this.onLeave)}destroy(){this.stopHold(),this.host.removeEventListener("pointermove",this.onMove),this.host.removeEventListener("pointerleave",this.onLeave),this.el.remove()}nearBottom(t){const e=this.actions.plotRect(),r=this.host.getBoundingClientRect(),n=t.clientX-r.left,s=t.clientY-r.top,a=Math.max(Za,e.height*Ja);return n>=e.x&&n<=e.x+e.width&&s<=e.y+e.height&&s>=e.y+e.height-a}place(){const t=this.actions.plotRect();this.el.style.left=`${Math.round(t.x+t.width/2)}px`,this.el.style.top=`${Math.round(t.y+t.height)}px`}startHold(t){this.stopHold(),this.actions.scroll(t),this.holdTimer=setTimeout(()=>{this.repeatTimer=setInterval(()=>this.actions.scroll(t),Xa)},Ya)}stopHold(){this.holdTimer&&clearTimeout(this.holdTimer),this.repeatTimer&&clearInterval(this.repeatTimer),this.holdTimer=null,this.repeatTimer=null}}function ps(i,t,e,r=!1){const n=i.label??t("alerts.source.price"),s=eo.get(i.condition),a=s?t(s):i.condition;if(Ve.includes(i.condition))return`${n} ${a} ${S(t("alerts.moveSummary"),{percent:i.percent??0,bars:i.bars??0})}`;if(i.target)return`${n} ${a} ${i.targetLabel??i.target}`;const o=i.channel&&i.channel!=="price",c=Number.isFinite(i.price)?o?no(i.price):e(i.price):"—";return`${(o||i.drawingId)&&i.label?`${i.label} `:r?`${n} `:""}${a} ${c}`}const ms=[{value:"crossing",key:"alerts.condition.crossing"},{value:"crossingUp",key:"alerts.condition.crossingUp"},{value:"crossingDown",key:"alerts.condition.crossingDown"},{value:"greaterThan",key:"alerts.condition.greaterThan"},{value:"lessThan",key:"alerts.condition.lessThan"},{value:"movesUp",key:"alerts.condition.movesUp"},{value:"movesDown",key:"alerts.condition.movesDown"}],Ve=["movesUp","movesDown"],to={hour:36e5,day:864e5,week:7*864e5,month:30*864e5},jt="",eo=new Map(ms.map(i=>[i.value,i.key]));function ro(i){return Math.round(i*1e6)/1e6}function no(i){const t=Math.abs(i);return t>=1e3||t>=1?i.toFixed(2):i.toPrecision(4)}class so{constructor(t,e,r=D){d(this,"el");d(this,"listEl");d(this,"priceInput");d(this,"conditionSelect");d(this,"sourceSelect");d(this,"targetSelect");d(this,"percentInput");d(this,"barsInput");d(this,"levelRow");d(this,"moveRow");d(this,"closeCheck");d(this,"expirySelect");d(this,"messageInput");d(this,"emptyEl");d(this,"callbacks");d(this,"open",!1);d(this,"alerts",[]);d(this,"sources");this.t=r,this.callbacks=e,this.sources=[{channel:"price",label:this.t("alerts.source.price")}],this.el=document.createElement("div"),this.el.className="tcw-alerts-panel",k(this.el,"alerts"),this.el.hidden=!0;const n=document.createElement("div");n.className="tcw-alerts-header";const s=document.createElement("span");s.textContent=this.t("alerts.title");const a=document.createElement("button");a.className="tcw-alerts-close",a.type="button",a.setAttribute("aria-label",this.t("alerts.close")),a.innerHTML=b("x",14),a.addEventListener("click",()=>this.close()),n.appendChild(s),n.appendChild(a),this.el.appendChild(n);const o=document.createElement("form");o.className="tcw-alerts-form",o.noValidate=!0,this.sourceSelect=document.createElement("select"),this.sourceSelect.className="tcw-alerts-source",this.sourceSelect.setAttribute("aria-label",this.t("alerts.source")),this.sourceSelect.addEventListener("change",()=>{this.renderTargets(),this.prefillPrice()}),this.conditionSelect=document.createElement("select"),this.conditionSelect.className="tcw-alerts-condition",this.conditionSelect.setAttribute("aria-label",this.t("alerts.conditionLabel"));for(const p of ms){const m=document.createElement("option");m.value=p.value,m.textContent=this.t(p.key),this.conditionSelect.appendChild(m)}this.conditionSelect.addEventListener("change",()=>this.showFields()),this.levelRow=document.createElement("div"),this.levelRow.className="tcw-alerts-row-fields",this.targetSelect=document.createElement("select"),this.targetSelect.className="tcw-alerts-target",this.targetSelect.setAttribute("aria-label",this.t("alerts.compareWith")),this.targetSelect.addEventListener("change",()=>this.showFields()),this.priceInput=document.createElement("input"),this.priceInput.type="number",this.priceInput.step="any",this.priceInput.placeholder=this.t("alerts.value"),this.priceInput.setAttribute("aria-label",this.t("alerts.value")),this.priceInput.className="tcw-alerts-price",this.levelRow.append(this.targetSelect,this.priceInput),this.moveRow=document.createElement("div"),this.moveRow.className="tcw-alerts-row-fields",this.percentInput=this.numberField("tcw-alerts-percent",this.t("alerts.percent"),"1","0.01"),this.barsInput=this.numberField("tcw-alerts-bars",this.t("alerts.bars"),"10","1"),this.barsInput.min=String(vr),this.barsInput.max=String(yr),this.moveRow.append(this.percentInput,this.barsInput);const c=document.createElement("div");c.className="tcw-alerts-row-fields tcw-alerts-options";const l=document.createElement("label");l.className="tcw-alerts-check",this.closeCheck=document.createElement("input"),this.closeCheck.type="checkbox",l.append(this.closeCheck,document.createTextNode(this.t("alerts.onBarClose"))),this.expirySelect=document.createElement("select"),this.expirySelect.className="tcw-alerts-expiry",this.expirySelect.setAttribute("aria-label",this.t("alerts.expires"));for(const p of["never","hour","day","week","month"]){const m=document.createElement("option");m.value=p,m.textContent=this.t(`alerts.expires.${p}`),this.expirySelect.appendChild(m)}c.append(l,this.expirySelect),this.messageInput=document.createElement("input"),this.messageInput.type="text",this.messageInput.placeholder=this.t("alerts.note"),this.messageInput.setAttribute("aria-label",this.t("alerts.note")),this.messageInput.className="tcw-alerts-message";const h=document.createElement("button");h.type="submit",h.className="tcw-alerts-add",h.innerHTML=`${b("plus",14)}<span>${T(this.t("alerts.add"))}</span>`,o.append(this.sourceSelect,this.conditionSelect,this.levelRow,this.moveRow,c,this.messageInput,h),o.addEventListener("submit",p=>{p.preventDefault(),this.submitForm()}),this.el.appendChild(o),this.listEl=document.createElement("div"),this.listEl.className="tcw-alerts-list",this.el.appendChild(this.listEl),this.emptyEl=document.createElement("div"),this.emptyEl.className="tcw-alerts-empty",this.emptyEl.textContent=this.t("alerts.empty"),this.listEl.appendChild(this.emptyEl),this.renderSources(),this.showFields(),t.appendChild(this.el)}numberField(t,e,r,n){const s=document.createElement("input");return s.type="number",s.step=n,s.min="0",s.value=r,s.className=t,s.placeholder=e,s.setAttribute("aria-label",e),s}showFields(){const t=Ve.includes(this.conditionSelect.value);this.moveRow.hidden=!t,this.levelRow.hidden=t,this.priceInput.hidden=this.targetSelect.value!==jt}renderTargets(){const t=this.targetSelect.value,e=this.sourceSelect.value||"price";this.targetSelect.replaceChildren();const r=document.createElement("option");r.value=jt,r.textContent=this.t("alerts.compare.value"),this.targetSelect.appendChild(r);for(const n of this.sources){if(n.channel===e)continue;const s=document.createElement("option");s.value=n.channel,s.textContent=n.label,this.targetSelect.appendChild(s)}this.targetSelect.value=[...this.targetSelect.options].some(n=>n.value===t)?t:jt,this.showFields()}setSources(t){this.sources=t.length>0?t:[{channel:"price",label:this.t("alerts.source.price")}],this.renderSources()}renderSources(){const t=this.sourceSelect.value||"price";this.sourceSelect.replaceChildren();for(const e of this.sources){const r=document.createElement("option");r.value=e.channel,r.textContent=e.label,this.sourceSelect.appendChild(r)}this.sourceSelect.value=this.sources.some(e=>e.channel===t)?t:"price",this.renderTargets()}isOpen(){return this.open}toggle(){this.open?this.close():this.openPanel()}openPanel(){this.open=!0,this.el.hidden=!1,this.priceInput.value===""&&this.prefillPrice()}prefillPrice(){const t=this.callbacks.getChannelValue(this.sourceSelect.value||"price");this.priceInput.value=t!==null?String(ro(t)):""}close(){this.open=!1,this.el.hidden=!0}setAlerts(t){this.alerts=t,this.renderList()}destroy(){this.el.remove()}submitForm(){var c;const t=this.conditionSelect.value,e=this.messageInput.value.trim()||void 0,r=this.sourceSelect.value||"price",n=((c=this.sources.find(l=>l.channel===r))==null?void 0:c.label)??this.t("alerts.source.price"),s={};let a=Number.NaN;if(Ve.includes(t)){s.percent=Number(this.percentInput.value),s.bars=Number(this.barsInput.value);const l=Number.isInteger(s.bars)&&s.bars>=vr&&s.bars<=yr;if(!(s.percent>0)||!l){this.markInvalid(s.percent>0?this.barsInput:this.percentInput);return}}else if(this.targetSelect.value!==jt)s.target=this.targetSelect.value;else if(a=Number(this.priceInput.value),this.priceInput.value.trim()===""||!Number.isFinite(a)){this.markInvalid(this.priceInput);return}this.closeCheck.checked&&(s.onBarClose=!0);const o=to[this.expirySelect.value];o&&(s.expiresAt=(this.callbacks.now??Date.now)()+o),this.callbacks.onAdd({price:a,condition:t,message:e,channel:r,label:n,options:s})!==!1&&(this.messageInput.value="",this.prefillPrice())}markInvalid(t){t.setAttribute("aria-invalid","true"),t.focus(),t.addEventListener("input",()=>t.removeAttribute("aria-invalid"),{once:!0})}describe(t){return ps(t,this.t,this.callbacks.formatPrice)}renderList(){var t,e;if(this.listEl.replaceChildren(),this.alerts.length===0){this.listEl.appendChild(this.emptyEl);return}for(const r of[...this.alerts].reverse()){const n=document.createElement("div");n.className="tcw-alerts-row"+(r.triggered?" tcw-alerts-triggered":"")+(r.expired?" tcw-alerts-expired":"");const s=document.createElement("div");s.className="tcw-alerts-info";const a=document.createElement("div");a.className="tcw-alerts-row-main",a.textContent=this.describe(r),s.appendChild(a);const o=[];if(r.onBarClose&&o.push(this.t("alerts.onClose")),r.expiresAt!==void 0&&!r.expired){const l=((e=(t=this.callbacks).formatTime)==null?void 0:e.call(t,r.expiresAt))??new Date(r.expiresAt).toISOString();o.push(S(this.t("alerts.until"),{time:l}))}if(o.length>0){const l=document.createElement("div");l.className="tcw-alerts-row-meta",l.textContent=o.join(" · "),s.appendChild(l)}if(r.message){const l=document.createElement("div");l.className="tcw-alerts-row-note",l.textContent=r.message,s.appendChild(l)}if(r.triggered||r.expired){const l=document.createElement("span");l.className="tcw-alerts-badge",l.textContent=this.t(r.expired?"alerts.expired":"alerts.triggered"),a.appendChild(l)}const c=document.createElement("button");c.type="button",c.className="tcw-alerts-del",c.setAttribute("aria-label",this.t("alerts.delete")),c.innerHTML=b("trash",14),c.addEventListener("click",()=>this.callbacks.onRemove(r.id)),n.appendChild(s),n.appendChild(c),this.listEl.appendChild(n)}}}const io="print",ao=3,oo=10;function mt(i,t){return Math.max(oo,Rs(i,t,ao))}const Te="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",an="'JetBrains Mono', 'SF Mono', 'Cascadia Code', 'Fira Code', 'Consolas', ui-monospace, monospace",co="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",lo="'Cascadia Mono', 'SF Mono', ui-monospace, Menlo, Consolas, monospace",pe={print:{radius:{xs:1,sm:2,md:3,lg:5,xl:8},components:{tag:2,toolbar:0,sidebar:0},sizes:{toolbar:42,control:26,controlSmall:20,icon:16,sidebar:42,menuItem:33},density:{compact:{toolbar:33,control:20,controlSmall:20,icon:16,sidebar:33,menuItem:26},spacious:{toolbar:53,control:33,controlSmall:26,icon:20,sidebar:53,menuItem:42}},font:{family:co,mono:lo,size:13,weight:400,strongWeight:600,labelCase:"uppercase",labelTracking:.06},borders:{width:1,separators:!0},shadows:{menu:"0 0 0 1px var(--tcw-border), var(--tcw-shadow-md)",dialog:"0 0 0 1px var(--tcw-border), var(--tcw-shadow-lg)",tooltip:"var(--tcw-shadow-sm)"},blur:0,active:"solid",toolbar:"docked",sidebar:"docked",intervals:"plain",tagRadius:2},studio:{radius:{xs:3,sm:5,md:7,lg:11,xl:16},components:{toolbar:0,sidebar:0},sizes:{toolbar:46,control:30,controlSmall:24,icon:18,sidebar:48,menuItem:30},font:{family:`'Manrope', 'Inter', ${Te}`,mono:an,size:13,weight:500,strongWeight:600,labelCase:"none",labelTracking:0},borders:{width:1,separators:!1},shadows:{menu:"var(--tcw-shadow-lg)",dialog:"var(--tcw-shadow-xl)",tooltip:"var(--tcw-shadow-md)"},blur:0,active:"tint",toolbar:"docked",sidebar:"docked",intervals:"segmented",tagRadius:4},terminal:{radius:{xs:1,sm:2,md:2,lg:2,xl:3},components:{tag:0,toolbar:0,sidebar:0},sizes:{toolbar:36,control:26,controlSmall:20,icon:16,sidebar:40,menuItem:26},font:{family:`'IBM Plex Sans Condensed', 'Roboto Condensed', 'Arial Narrow', ${Te}`,mono:"'IBM Plex Mono', ui-monospace, monospace",size:12,weight:500,strongWeight:600,labelCase:"uppercase",labelTracking:.08},borders:{width:1,separators:!0},shadows:{menu:"0 0 0 1px var(--tcw-border-strong)",dialog:"0 0 0 1px var(--tcw-border-strong), var(--tcw-shadow-lg)",tooltip:"none"},blur:0,active:"underline",toolbar:"docked",sidebar:"docked",intervals:"plain",tagRadius:0},capsule:{radius:{xs:6,sm:10,md:999,lg:18,xl:24},components:{tooltip:10,toolbar:999,sidebar:999,toast:999,tag:999},sizes:{toolbar:44,control:32,controlSmall:26,icon:18,sidebar:48,menuItem:34},font:{family:`'Sora', 'Manrope', ${Te}`,mono:an,size:13,weight:500,strongWeight:600,labelCase:"none",labelTracking:0},borders:{width:1,separators:!1},shadows:{menu:"0 0 0 1px var(--tcw-divider), var(--tcw-shadow-xl)",dialog:"0 0 0 1px var(--tcw-divider), var(--tcw-shadow-xl)",tooltip:"var(--tcw-shadow-lg)"},blur:16,active:"solid",toolbar:"floating",sidebar:"floating",intervals:"segmented",tagRadius:999}},ho={compact:{toolbar:38,control:26,controlSmall:20,icon:16,sidebar:40,menuItem:26},spacious:{toolbar:52,control:34,controlSmall:28,icon:20,sidebar:54,menuItem:34}};function ws(i,t){return{control:i.md,input:i.md,menu:i.lg,dialog:i.xl,panel:i.lg,tooltip:i.sm,tag:i.sm,toast:i.lg,toolbar:0,sidebar:0,...t}}const Kl=Object.freeze(Object.fromEntries(Object.keys(pe).map(i=>[i,fs(uo(i))])));function uo(i){const{density:t,...e}=pe[i];return{...e,preset:i,radius:{...e.radius},components:ws(e.radius,e.components),sizes:{...e.sizes},font:{...e.font},borders:{...e.borders},shadows:{...e.shadows}}}function fs(i){for(const t of Object.values(i))t&&typeof t=="object"&&fs(t);return Object.freeze(i)}const po=i=>typeof i=="string"&&Object.prototype.hasOwnProperty.call(pe,i),j=(i,t,e)=>typeof i=="number"&&Number.isFinite(i)&&i>=t&&i<=e,on=i=>typeof i=="string"&&i.trim().length>0&&i.length<=300&&!/[;{}<>\\]|url\s*\(|expression\s*\(|\/\*/i.test(i)&&mo(i);function mo(i){let t=0,e="";for(const r of i)if(e)r===e&&(e="");else if(r==='"'||r==="'")e=r;else if(r==="(")t++;else if(r===")"&&--t<0)return!1;return t===0&&!e}const Vt=(i,t)=>typeof i=="string"&&t.includes(i);function dt(i,t,e){const r={...i};if(!t||typeof t!="object")return r;for(const n of Object.keys(i)){const s=t[n];s!==void 0&&e(n,s)&&(r[n]=s)}return r}function ft(i){const t=typeof i=="string"?{preset:i}:i??{},e=po(t.preset)?t.preset:io,r=pe[e],n=dt(r.radius,t.radius,(l,h)=>j(h,0,999)),s=t.density==="compact"||t.density==="spacious"?(r.density??ho)[t.density]:r.sizes,a=dt(s,t.sizes,(l,h)=>l==="icon"?j(h,10,32):j(h,16,80)),o=dt(r.font,t.font,(l,h)=>l==="family"||l==="mono"?on(h):l==="size"?j(h,11,20):l==="weight"||l==="strongWeight"?j(h,100,900):l==="labelCase"?h==="none"||h==="uppercase":j(h,0,.5)),c=dt(ws(n,r.components),t.components,(l,h)=>j(h,0,999));return{preset:e,radius:n,components:c,sizes:a,font:o,borders:dt(r.borders,t.borders,(l,h)=>l==="width"?j(h,0,4):typeof h=="boolean"),shadows:dt(r.shadows,t.shadows,(l,h)=>on(h)),blur:j(t.blur,0,40)?t.blur:r.blur,active:Vt(t.active,["tint","solid","underline"])?t.active:r.active,toolbar:Vt(t.toolbar,["docked","floating"])?t.toolbar:r.toolbar,sidebar:Vt(t.sidebar,["docked","floating"])?t.sidebar:r.sidebar,intervals:Vt(t.intervals,["plain","segmented"])?t.intervals:r.intervals,tagRadius:j(t.tagRadius,0,999)?t.tagRadius:r.tagRadius}}function wo(i){const t=a=>`${a}px`,e=i.radius,r=i.components,n=i.sizes,s=i.font;return{"--tcw-radius-xs":t(e.xs),"--tcw-radius-sm":t(e.sm),"--tcw-radius":t(e.md),"--tcw-radius-lg":t(e.lg),"--tcw-radius-xl":t(e.xl),"--tcw-control-radius":t(r.control),"--tcw-input-radius":t(r.input),"--tcw-menu-radius":t(r.menu),"--tcw-dialog-radius":t(r.dialog),"--tcw-panel-radius":t(r.panel),"--tcw-tooltip-radius":t(r.tooltip),"--tcw-tag-radius":t(r.tag),"--tcw-toast-radius":t(r.toast),"--tcw-toolbar-radius":t(r.toolbar),"--tcw-sidebar-radius":t(r.sidebar),"--tcw-toolbar-h":t(n.toolbar),"--tcw-control-h":t(n.control),"--tcw-control-h-sm":t(n.controlSmall),"--tcw-icon":t(n.icon),"--tcw-sidebar-w":t(n.sidebar),"--tcw-menu-item-h":t(n.menuItem),"--tcw-font":s.family,"--tcw-font-mono":s.mono,"--tcw-font-size":t(s.size),"--tcw-font-size-sm":t(mt(s.size,-1)),"--tcw-font-size-xs":t(mt(s.size,-2)),"--tcw-font-size-lg":t(mt(s.size,1)),"--tcw-font-size-xl":t(mt(s.size,2)),"--tcw-font-size-display":t(mt(s.size,3)),"--tcw-weight":String(s.weight),"--tcw-weight-strong":String(s.strongWeight),"--tcw-label-case":s.labelCase,"--tcw-label-tracking":`${s.labelTracking}em`,"--tcw-border-w":t(i.borders.width),"--tcw-sep-w":i.borders.separators?t(Math.max(1,i.borders.width)):"0px","--tcw-menu-shadow":i.shadows.menu,"--tcw-dialog-shadow":i.shadows.dialog,"--tcw-tooltip-shadow":i.shadows.tooltip,"--tcw-blur":t(i.blur),"--tcw-surface-opacity":i.blur>0?"82%":"100%"}}function wt(i,t,e={}){const r=e.variables!==!1;for(const[n,s]of Object.entries(wo(t)))r?i.style.setProperty(n,s):i.style.removeProperty(n);i.dataset.tcwUi=t.preset,i.dataset.tcwActive=t.active,i.dataset.tcwToolbar=t.toolbar,i.dataset.tcwSidebar=t.sidebar,i.dataset.tcwIntervals=t.intervals,i.dataset.tcwSeparators=t.borders.separators?"on":"off"}class fo{constructor(t,e,r=D){d(this,"el");d(this,"indicatorsEl");d(this,"drawingsEl");d(this,"compareEl",null);d(this,"callbacks");d(this,"open",!1);var o;this.t=r,this.callbacks=e,this.el=document.createElement("div"),this.el.className="tcw-tree-panel",k(this.el,"objectTree"),this.el.hidden=!0;const n=document.createElement("div");n.className="tcw-tree-header";const s=document.createElement("span");s.textContent=this.t("objects.title");const a=document.createElement("button");if(a.type="button",a.className="tcw-tree-close",a.setAttribute("aria-label",this.t("objects.close")),a.innerHTML=b("x",14),a.addEventListener("click",()=>this.close()),n.appendChild(s),n.appendChild(a),this.el.appendChild(n),this.indicatorsEl=this.makeSection(this.t("objects.indicators")),this.drawingsEl=this.makeSection(this.t("objects.drawings")),this.callbacks.onAddCompare){this.compareEl=this.makeSection(this.t("objects.compare"),{label:this.t("objects.addCompare"),run:()=>{var l,h;return(h=(l=this.callbacks).onAddCompare)==null?void 0:h.call(l)}});const c=(o=this.compareEl.parentElement)==null?void 0:o.querySelector(".tcw-tree-add");c&&k(c,"compare")}t.appendChild(this.el)}isOpen(){return this.open}toggle(){this.open?this.close():this.openPanel()}openPanel(){this.open=!0,this.el.hidden=!1}close(){this.open=!1,this.el.hidden=!0}destroy(){this.el.remove()}setObjects(t,e,r=[]){this.renderIndicators(t),this.renderDrawings(e),this.renderCompares(r)}makeSection(t,e){const r=document.createElement("div");r.className="tcw-tree-section";const n=document.createElement("div");n.className="tcw-tree-section-head";const s=document.createElement("span");if(s.textContent=t,n.appendChild(s),e){const o=document.createElement("button");o.type="button",o.className="tcw-tree-add",o.setAttribute("aria-label",e.label),o.title=e.label,o.innerHTML=b("plus",13),o.addEventListener("click",e.run),n.appendChild(o)}const a=document.createElement("div");return a.className="tcw-tree-list",r.appendChild(n),r.appendChild(a),this.el.appendChild(r),a}renderIndicators(t){if(this.indicatorsEl.replaceChildren(),t.length===0){this.indicatorsEl.appendChild(this.emptyRow(this.t("objects.noIndicators")));return}for(const e of t){const r=this.row(e.name);e.visible||r.classList.add("tcw-tree-hidden");const n=document.createElement("div");if(n.className="tcw-tree-actions",this.callbacks.onToggleIndicatorVisible&&n.appendChild(this.iconButton(e.visible?"eye":"eyeOff",e.visible?this.t("common.hide"):this.t("common.show"),"",()=>{var s,a;return(a=(s=this.callbacks).onToggleIndicatorVisible)==null?void 0:a.call(s,e.instanceId,!e.visible)})),this.callbacks.onConfigureIndicator){const s=this.iconButton("settings",this.t("objects.indicatorSettings"),"",()=>{var a,o;return(o=(a=this.callbacks).onConfigureIndicator)==null?void 0:o.call(a,e.instanceId)});k(s,"indicatorSettings"),n.appendChild(s)}n.appendChild(this.iconButton("trash",this.t("objects.removeIndicator"),"tcw-tree-del",()=>this.callbacks.onRemoveIndicator(e.instanceId))),r.appendChild(n),this.indicatorsEl.appendChild(r)}}renderDrawings(t){if(this.drawingsEl.replaceChildren(),t.length===0){this.drawingsEl.appendChild(this.emptyRow(this.t("objects.noDrawings")));return}const e=new Set;for(const r of t){if(!r.group){this.drawingsEl.appendChild(this.drawingRow(r));continue}if(e.has(r.group.id))continue;e.add(r.group.id);const n=r.group.id,s=t.filter(a=>{var o;return((o=a.group)==null?void 0:o.id)===n});this.drawingsEl.appendChild(this.groupRow(n,r.group.name,s));for(const a of s){const o=this.drawingRow(a);o.classList.add("tcw-tree-member"),this.drawingsEl.appendChild(o)}}}groupRow(t,e,r){const n=this.row(e);n.classList.add("tcw-tree-group");const s=r.some(l=>l.visible),a=r.every(l=>l.locked);s||n.classList.add("tcw-tree-hidden");const o=n.querySelector(".tcw-tree-name");o.innerHTML=b("layers",13),o.append(` ${e}`);const c=document.createElement("div");return c.className="tcw-tree-actions",this.callbacks.onRenameGroup&&(o.addEventListener("dblclick",()=>this.renameGroup(o,t,e)),c.appendChild(this.iconButton("penLine",this.t("objects.renameGroup"),"",()=>this.renameGroup(o,t,e)))),this.callbacks.onToggleGroupVisible&&c.appendChild(this.iconButton(s?"eye":"eyeOff",s?this.t("common.hide"):this.t("common.show"),"",()=>{var l,h;return(h=(l=this.callbacks).onToggleGroupVisible)==null?void 0:h.call(l,t,!s)})),this.callbacks.onToggleGroupLocked&&c.appendChild(this.iconButton(a?"lock":"unlock",a?this.t("common.unlock"):this.t("common.lock"),a?"tcw-tree-on":"",()=>{var l,h;return(h=(l=this.callbacks).onToggleGroupLocked)==null?void 0:h.call(l,t,!a)})),this.callbacks.onUngroup&&c.appendChild(this.iconButton("x",this.t("drawingMenu.ungroup"),"",()=>{var l,h;return(h=(l=this.callbacks).onUngroup)==null?void 0:h.call(l,t)})),n.appendChild(c),n}renameGroup(t,e,r){if(!t.isConnected)return;const n=document.createElement("input");n.type="text",n.className="tcw-tree-rename",n.value=r,n.maxLength=80,n.setAttribute("aria-label",this.t("objects.renameGroup"));let s=!1;const a=o=>{var l,h;if(s)return;s=!0;const c=n.value.trim();n.isConnected&&n.replaceWith(t),o&&c&&c!==r&&((h=(l=this.callbacks).onRenameGroup)==null||h.call(l,e,c))};n.addEventListener("keydown",o=>{o.key==="Enter"?a(!0):o.key==="Escape"&&(o.stopPropagation(),a(!1))}),n.addEventListener("blur",()=>a(!0)),t.replaceWith(n),n.focus(),n.select()}drawingRow(t){const e=this.row(t.label);t.visible||e.classList.add("tcw-tree-hidden");const r=document.createElement("div");if(r.className="tcw-tree-actions",r.appendChild(this.iconButton(t.visible?"eye":"eyeOff",t.visible?this.t("common.hide"):this.t("common.show"),"",()=>this.callbacks.onToggleDrawingVisible(t.id,!t.visible))),r.appendChild(this.iconButton(t.locked?"lock":"unlock",t.locked?this.t("common.unlock"):this.t("common.lock"),t.locked?"tcw-tree-on":"",()=>this.callbacks.onToggleDrawingLocked(t.id,!t.locked))),this.callbacks.onConfigureDrawing){const n=this.iconButton("settings",this.t("objects.drawingSettings"),"",()=>{var s,a;return(a=(s=this.callbacks).onConfigureDrawing)==null?void 0:a.call(s,t.id)});k(n,"drawingSettings"),r.appendChild(n)}return r.appendChild(this.iconButton("trash",this.t("objects.removeDrawing"),"tcw-tree-del",()=>this.callbacks.onRemoveDrawing(t.id))),e.appendChild(r),e}renderCompares(t){if(this.compareEl){if(this.compareEl.replaceChildren(),t.length===0){this.compareEl.appendChild(this.emptyRow(this.t("objects.noComparisons")));return}for(const e of t){const r=this.row(e.label),n=document.createElement("span");n.className="tcw-tree-dot",n.style.background=e.color,r.insertBefore(n,r.firstChild),this.callbacks.onRemoveCompare&&r.appendChild(this.iconButton("trash",this.t("objects.removeComparison"),"tcw-tree-del",()=>{var s,a;return(a=(s=this.callbacks).onRemoveCompare)==null?void 0:a.call(s,e.id)})),this.compareEl.appendChild(r)}}}row(t){const e=document.createElement("div");e.className="tcw-tree-row";const r=document.createElement("span");return r.className="tcw-tree-name",r.textContent=t,r.title=t,e.appendChild(r),e}emptyRow(t){const e=document.createElement("div");return e.className="tcw-tree-empty",e.textContent=t,e}iconButton(t,e,r,n){const s=document.createElement("button");return s.type="button",s.className=`tcw-tree-btn ${r}`.trim(),s.setAttribute("aria-label",e),s.title=e,s.innerHTML=b(t,14),s.addEventListener("click",n),s}}const go={trendLine:"Trend Line",ray:"Ray",extendedLine:"Extended Line",horizontalLine:"Horizontal Line",horizontalRay:"Horizontal Ray",crossLine:"Cross Line",infoLine:"Info Line",trendAngle:"Trend Angle",circle:"Circle",fibChannel:"Fib Channel",fibSpeedResistanceFan:"Fib Speed Resistance Fan",schiffPitchfork:"Schiff Pitchfork",modifiedSchiffPitchfork:"Modified Schiff Pitchfork",xabcdPattern:"XABCD Pattern",abcdPattern:"ABCD Pattern",headAndShoulders:"Head and Shoulders",dateAndPriceRange:"Date and Price Range",cyclicLines:"Cyclic Lines",priceLabel:"Price Label",verticalLine:"Vertical Line",rectangle:"Rectangle",ellipse:"Ellipse",triangle:"Triangle",arrow:"Arrow",parallelChannel:"Parallel Channel",regressionChannel:"Regression Channel",pitchfork:"Pitchfork",fibRetracement:"Fib Retracement",fibExtension:"Fib Extension",fibTimeZones:"Fib Time Zones",gannBox:"Gann Box",gannFan:"Gann Fan",elliottWave:"Elliott Wave",priceRange:"Price Range",dateRange:"Date Range",measure:"Measure",text:"Text",textAnnotation:"Text",anchoredVWAP:"Anchored VWAP",volumeProfileRange:"Volume Profile",riskReward:"Long/Short Position"};function bo(i,t){const e=`tool.${i}`,r=t==null?void 0:t(e);return r&&r!==e?r:go[i]??i}const vo=[1,1.5,2,3,4],yo=["solid","dashed","dotted"],xo="#4c8dff",ko=10,cn={ticks:"toolbar.timeframes.ticks",seconds:"toolbar.timeframes.seconds",minutes:"toolbar.timeframes.minutes",hours:"toolbar.timeframes.hours",days:"toolbar.timeframes.days",weeks:"toolbar.timeframes.weeks",months:"toolbar.timeframes.months"};function So(i,t,e,r,n){const s=cr();for(const o of[...t.plots].sort((c,l)=>c.color-l.color))s.appendChild(Eo(o,t,e,r));const a=X(vo.map(o=>({value:String(o),label:`${o} px`})),String(t.lineWidth),o=>e.lineWidth(Number(o)));if(a.dataset.role="line-width",s.appendChild(I(r("indicatorSettings.lineWidth"),a)),t.scale&&e.scale){const o=X([{value:"right",label:r("indicatorSettings.scale.right")},{value:"left",label:r("indicatorSettings.scale.left")}],t.scale,c=>{var l;return(l=e.scale)==null?void 0:l.call(e,c==="left"?"left":"right")});o.dataset.role="scale",s.appendChild(I(r("indicatorSettings.scale"),o))}i.appendChild(s),t.levels&&e.levels&&i.appendChild(Co([...t.levels],e.levels,r,n))}function Eo(i,t,e,r){const n=t.plotStyles[i.key]??{},s=document.createElement("div");s.className="tcw-settings-row tcw-indi-plot",s.dataset.plot=i.key;const a=document.createElement("label");a.className="tcw-indi-plot-name";const o=document.createElement("input");o.type="checkbox",o.checked=n.visible!==!1,o.addEventListener("change",()=>e.plot(i.key,{visible:o.checked}));const c=document.createElement("span");c.className="tcw-settings-label",c.textContent=i.title,a.append(o,c);const l=document.createElement("span");l.className="tcw-indi-plot-controls";const h=(m,f)=>{const g=At(t.colors[m]??t.colors[0]??xo,v=>e.color(m,v));return g.setAttribute("aria-label",f),g};if(i.tone!==void 0&&i.downColor!==void 0?l.append(h(i.color,`${i.title} ${r("indicatorSettings.up")}`),h(i.downColor,`${i.title} ${r("indicatorSettings.down")}`)):l.appendChild(h(i.color,i.title)),(i.kind??"line")==="line"||i.kind==="step"){const m=X(yo.map(f=>({value:f,label:r(`drawingSettings.lineStyle.${f}`)})),n.lineStyle??"solid",f=>e.plot(i.key,{lineStyle:f}));m.setAttribute("aria-label",`${i.title}: ${r("drawingSettings.lineStyle")}`),l.appendChild(m)}return s.append(a,l),s}function Co(i,t,e,r){const n=cr();let s=i;const a=()=>{const l=document.createElement("div");l.className="tcw-settings-section-title",l.textContent=e("indicatorSettings.tab.levels");const h=s.map((m,f)=>c(m,f)),p=document.createElement("button");p.type="button",p.className="tcw-reset-link tcw-indi-add",p.textContent=`+ ${e("indicatorSettings.addLevel")}`,p.addEventListener("click",()=>{var g;const m=s[s.length-1];o([...s,m===void 0?0:m+ko]);const f=n.querySelectorAll(".tcw-indi-level input");(g=f[f.length-1])==null||g.focus()}),n.replaceChildren(l,...s.length===0?[Ao(e("indicatorSettings.noLevels"))]:h,p)},o=l=>{s=l,t([...l]),a()},c=(l,h)=>{const p=ot(l,{step:"any"},L=>{s=s.map((C,E)=>E===h?L:C),t([...s])});p.id=`tcw-indi-level-${r}-${h}`;const m=document.createElement("button");m.type="button",m.className="tcw-indi-remove",m.innerHTML=b("x",12);const f=e("indicatorSettings.removeLevel");m.title=f,m.setAttribute("aria-label",`${f} ${h+1}`),m.addEventListener("click",()=>{var L;o(s.filter((C,E)=>E!==h)),(L=n.querySelectorAll(".tcw-indi-remove")[h]??n.querySelector(".tcw-indi-add"))==null||L.focus()});const g=document.createElement("span");g.className="tcw-indi-level",g.append(p,m);const v=document.createElement("div");v.className="tcw-settings-row";const y=document.createElement("label");return y.className="tcw-settings-label",y.htmlFor=p.id,y.textContent=`${e("indicatorSettings.level")} ${h+1}`,v.append(y,g),v};return a(),n}function To(i,t,e,r){const n=new Map(xr.map(o=>{const c=t==null?void 0:t[o],l=Array.isArray(c)?c:[1,Oe[o]];return[o,{on:c!==!1,from:l[0],to:l[1]}]})),s=()=>{const o={};for(const[c,{on:l,from:h,to:p}]of n){const[m,f]=[Math.min(h,p),Math.max(h,p)];l?(m>1||f<Oe[c])&&(o[c]=[m,f]):o[c]=!1}e(Object.keys(o).length>0?o:null)},a=cr();for(const o of xr)a.appendChild(Lo(o,n.get(o),s,r));i.appendChild(a)}function Lo(i,t,e,r){const n=document.createElement("div");n.className="tcw-settings-row tcw-indi-unit",n.dataset.unit=i;const s=document.createElement("label");s.className="tcw-indi-plot-name";const a=document.createElement("input");a.type="checkbox",a.checked=t.on;const o=document.createElement("span");o.className="tcw-settings-label",o.textContent=r(cn[i]),s.append(a,o),n.appendChild(s);const c=[];if(i!=="ticks"){const l=(m,f)=>{const g=ot(t[m],{min:1,max:Oe[i],step:1},v=>{t[m]=Math.round(v),g.value=String(t[m]),e()});return g.setAttribute("aria-label",`${r(cn[i])}: ${r(f)}`),g.disabled=!t.on,c.push(g),g},h=document.createElement("span");h.className="tcw-indi-range";const p=document.createElement("span");p.setAttribute("aria-hidden","true"),p.textContent="–",h.append(l("from","indicatorSettings.rangeFrom"),p,l("to","indicatorSettings.rangeTo")),n.appendChild(h)}return a.addEventListener("change",()=>{t.on=a.checked;for(const l of c)l.disabled=!a.checked;e()}),n}function cr(){const i=document.createElement("div");return i.className="tcw-settings-section",i}function Ao(i){const t=document.createElement("div");return t.className="tcw-settings-label",t.textContent=i,t}let No=1;const Mo=/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/,Le=1.5,Io={visible:!0,lineStyle:"solid"},ht=(i,t)=>JSON.stringify(i)===JSON.stringify(t),ln=i=>JSON.parse(JSON.stringify(i));function Po(i){return i.replace(/_/g," ").replace(/([a-z0-9])([A-Z])/g,"$1 $2").replace(/^./,t=>t.toUpperCase())}function dn(i,t){return Object.fromEntries([...new Set([...Object.keys(i),...Object.keys(t)])].map(e=>[e,{...Io,...t[e]}]))}class Do{constructor(t,e,r){d(this,"backdrop");d(this,"modal");d(this,"bodyEl");d(this,"titleEl");d(this,"tabsEl");d(this,"defaultsBtn");d(this,"menu",null);d(this,"callbacks");d(this,"target",null);d(this,"draft",{});d(this,"initial",null);d(this,"look",{colors:[],lineWidth:Le,plots:{},levels:[],intervals:null});d(this,"tab","inputs");d(this,"tabButtons",[]);d(this,"returnFocus",null);d(this,"uid",No++);d(this,"t");this.callbacks=e,this.t=r??(o=>It[o]),this.backdrop=document.createElement("div"),this.backdrop.className="tcw-modal-backdrop",this.backdrop.hidden=!0;let n=!1;this.backdrop.addEventListener("pointerdown",o=>{n=o.target===this.backdrop}),this.backdrop.addEventListener("click",o=>{o.target===this.backdrop&&n&&this.finish(!1),n=!1}),this.modal=document.createElement("div"),this.modal.className="tcw-modal tcw-modal-narrow tcw-indi",this.modal.setAttribute("role","dialog"),this.modal.setAttribute("aria-modal","true"),this.modal.setAttribute("aria-labelledby",`tcw-indi-title-${this.uid}`),this.modal.tabIndex=-1,this.modal.addEventListener("keydown",o=>this.onKeyDown(o));const s=document.createElement("div");s.className="tcw-modal-header",this.titleEl=document.createElement("h3"),this.titleEl.id=`tcw-indi-title-${this.uid}`;const a=document.createElement("button");a.type="button",a.className="tcw-modal-close",a.setAttribute("aria-label",this.t("indicatorSettings.close")),a.innerHTML=b("x",16),a.addEventListener("click",()=>this.finish(!1)),s.append(this.titleEl,a),this.tabsEl=document.createElement("div"),this.tabsEl.className="tcw-modal-tabs",this.tabsEl.setAttribute("role","tablist"),this.tabsEl.addEventListener("keydown",o=>this.onTabKey(o)),this.bodyEl=document.createElement("div"),this.bodyEl.className="tcw-modal-body",this.bodyEl.id=`tcw-indi-panel-${this.uid}`,this.bodyEl.setAttribute("role","tabpanel"),this.defaultsBtn=this.footerButton("defaults","tcw-footer-menu",()=>this.openDefaults()),this.modal.append(s,this.tabsEl,this.bodyEl,this.buildFooter()),this.backdrop.appendChild(this.modal),t.appendChild(this.backdrop)}buildFooter(){this.defaultsBtn.setAttribute("aria-haspopup","menu"),this.defaultsBtn.setAttribute("aria-expanded","false"),this.defaultsBtn.innerHTML=`<span></span>${b("chevronDown",12)}`,this.defaultsBtn.querySelector("span").textContent=this.t("indicatorSettings.defaults");const t=document.createElement("div");t.className="tcw-footer-end",t.append(this.footerButton("cancel","tcw-footer-cancel",()=>this.finish(!1),this.t("common.cancel")),this.footerButton("ok","tcw-done-btn",()=>this.finish(!0),this.t("drawingSettings.ok")));const e=document.createElement("div");return e.className="tcw-modal-footer",e.append(this.defaultsBtn,t),e}open(t){this.target&&this.finish(!0),this.backdrop.hidden&&(this.returnFocus=document.activeElement instanceof HTMLElement?document.activeElement:null),this.target=t,this.titleEl.textContent=this.t("indicatorSettings.title").replace("{name}",t.name),this.draft={},this.look={colors:[...t.colors??[]],lineWidth:t.lineWidth??Le,plots:Object.fromEntries(Object.entries(t.plotStyles??{}).map(([r,n])=>[r,{...n}])),levels:[...t.levels??[]],scale:t.scale,intervals:t.intervals??null},this.initial={params:this.currentParams(),look:ln(this.look)},this.tab="inputs",this.renderTabs(),this.renderBody(),this.backdrop.hidden=!1;const e=this.tabsEl.hidden?null:this.tabButtons[0]??null;(this.bodyEl.querySelector(is)??e??this.modal).focus()}close(){this.finish(!0)}isOpen(){return!this.backdrop.hidden}destroy(){var t;(t=this.menu)==null||t.destroy(),this.backdrop.remove()}finish(t){var e,r;if(this.target){if(t){const n=document.activeElement;(n instanceof HTMLInputElement||n instanceof HTMLSelectElement)&&this.modal.contains(n)&&n.dispatchEvent(new Event("change"))}else this.revert();this.target=null,(e=this.menu)==null||e.close(),this.backdrop.hidden=!0,this.callbacks.onClose(),(r=this.returnFocus)!=null&&r.isConnected&&this.returnFocus.focus(),this.returnFocus=null}}revert(){var a,o,c,l,h,p,m,f;const t=this.target,e=this.initial;if(!t||!e)return;const r=t.instanceId;ht(this.currentParams(),e.params)||this.callbacks.onApply(r,{...e.params});const n=e.look,s={};ht(this.look.colors,n.colors)||(s.colors=[...n.colors]),this.look.lineWidth!==n.lineWidth&&(s.lineWidths=[n.lineWidth]),ht(this.look.plots,n.plots)||(s.plots=dn(this.look.plots,n.plots)),Object.keys(s).length>0&&((o=(a=this.callbacks).onStyle)==null||o.call(a,r,s)),ht(this.look.levels,n.levels)||(l=(c=this.callbacks).onLevels)==null||l.call(c,r,t.ownLevels?[...n.levels]:null),this.look.scale!==n.scale&&n.scale&&((p=(h=this.callbacks).onScale)==null||p.call(h,r,n.scale)),ht(this.look.intervals,n.intervals)||(f=(m=this.callbacks).onIntervals)==null||f.call(m,r,n.intervals)}currentParams(){const t=this.target;return t?{...t.defaults,...t.params,...this.draft}:{}}tabs(){var n;const t=this.target;if(!t)return[];const e=!!((n=t.plots)!=null&&n.length&&t.colors&&this.callbacks.onStyle),r=!!(t.levels&&this.callbacks.onLevels);return["inputs",...e||r?["style"]:[],...this.callbacks.onIntervals?["visibility"]:[]]}renderTabs(){const t=this.tabs();this.tabsEl.hidden=t.length<2,this.tabButtons=t.map(e=>{const r=document.createElement("button");return r.type="button",r.className="tcw-modal-tab",r.id=`tcw-indi-tab-${this.uid}-${e}`,r.setAttribute("role","tab"),r.setAttribute("aria-controls",this.bodyEl.id),r.dataset.tab=e,r.textContent=this.t(`indicatorSettings.tab.${e}`),r.addEventListener("click",()=>this.selectTab(e)),r}),this.tabsEl.replaceChildren(...this.tabButtons),this.markTabs()}markTabs(){for(const t of this.tabButtons){const e=t.dataset.tab===this.tab;t.classList.toggle("tcw-active",e),t.setAttribute("aria-selected",String(e)),t.tabIndex=e?0:-1,e&&this.bodyEl.setAttribute("aria-labelledby",t.id)}}selectTab(t,e=!1){var r;this.tab=t,this.markTabs(),this.renderBody(),e&&((r=this.tabButtons.find(n=>n.dataset.tab===t))==null||r.focus())}onTabKey(t){const e=this.tabButtons.map(s=>s.dataset.tab),r=e.indexOf(this.tab),n=t.key==="ArrowRight"?(r+1)%e.length:t.key==="ArrowLeft"?(r-1+e.length)%e.length:t.key==="Home"?0:t.key==="End"?e.length-1:-1;n<0||e.length===0||(t.preventDefault(),this.selectTab(e[n],!0))}onKeyDown(t){if(t.key==="Escape"){t.preventDefault(),t.stopPropagation(),this.finish(!1);return}lt(t,this.modal)}renderBody(){this.bodyEl.replaceChildren();const t=this.target;t&&(this.tab==="style"?this.renderStyle(t):this.tab==="visibility"?To(this.bodyEl,this.look.intervals,e=>this.setIntervals(e),this.t):this.renderInputs())}currentValue(t){var n,s;if(t in this.draft)return this.draft[t];const e=(n=this.target)==null?void 0:n.params[t],r=(s=this.target)==null?void 0:s.defaults[t];return e??r}setValue(t,e){this.target&&(this.draft[t]=e,this.callbacks.onApply(this.target.instanceId,{...this.draft}))}renderInputs(){const t=document.createElement("div");t.className="tcw-settings-section";const e=Object.keys(this.target.defaults);e.length===0&&t.appendChild(this.note(this.t("indicatorSettings.noInputs")));for(const r of e)t.appendChild(this.fieldRow(r));this.bodyEl.appendChild(t)}fieldRow(t){var a,o,c;const e=(o=(a=this.target)==null?void 0:a.inputs)==null?void 0:o[t],r=this.currentValue(t),n=typeof(((c=this.target)==null?void 0:c.defaults[t])??r);let s;if(e!=null&&e.source)s=this.sourceControl(t,String(r??"close"));else if(e!=null&&e.options)s=this.choiceControl(t,e.options,r);else if(n==="boolean")s=or(!!r,l=>this.setValue(t,l));else if(n==="number"){const l=Number(r);s=ot(l,{min:e==null?void 0:e.min,max:e==null?void 0:e.max,step:(e==null?void 0:e.step)??(Number.isInteger(l)?1:.1)},h=>this.setValue(t,h))}else typeof r=="string"&&Mo.test(r)?s=At(r,l=>this.setValue(t,l)):s=this.textControl(t,String(r??""));return I((e==null?void 0:e.label)??Po(t),s)}sourceControl(t,e){var a;const r=document.createElement("select");r.className="tcw-indi-input tcw-indi-select";const n=document.createElement("optgroup");n.label=this.t("indicatorSettings.source.prices");for(const o of $s)n.appendChild(this.option(o,o));r.appendChild(n);const s=((a=this.target)==null?void 0:a.lineSources)??[];if(s.length){const o=document.createElement("optgroup");o.label=this.t("indicatorSettings.source.indicators");for(const c of s)o.appendChild(this.option(c.value,c.label));r.appendChild(o)}return r.value=e,r.value!==e&&(r.value="close"),r.addEventListener("change",()=>this.setValue(t,r.value)),r}choiceControl(t,e,r){const n=document.createElement("select");n.className="tcw-indi-input tcw-indi-select";for(const s of e)n.appendChild(this.option(String(s),String(s)));return n.value=String(r),n.addEventListener("change",()=>{const s=e.find(a=>String(a)===n.value);s!==void 0&&this.setValue(t,s)}),n}textControl(t,e){const r=document.createElement("input");return r.type="text",r.className="tcw-indi-input",r.value=e,r.addEventListener("change",()=>this.setValue(t,r.value)),r}renderStyle(t){const e=t.instanceId,r=()=>this.target===t,n=o=>{var c,l;return r()&&((l=(c=this.callbacks).onStyle)==null?void 0:l.call(c,e,o))},s=o=>{var c,l;return r()&&((l=(c=this.callbacks).onLevels)==null?void 0:l.call(c,e,o))},a=o=>{var c,l;return r()&&((l=(c=this.callbacks).onScale)==null?void 0:l.call(c,e,o))};So(this.bodyEl,{plots:t.colors&&this.callbacks.onStyle?t.plots??[]:[],colors:this.look.colors,plotStyles:this.look.plots,lineWidth:this.look.lineWidth,scale:t.scale&&this.callbacks.onScale?this.look.scale:void 0,levels:t.levels&&this.callbacks.onLevels?this.look.levels:void 0},{color:(o,c)=>{if(!r())return;const l=[...this.look.colors];for(;l.length<=o;)l.push(l[0]??c);l[o]=c,this.look.colors=l,n({colors:[...l]})},plot:(o,c)=>{r()&&(this.look.plots={...this.look.plots,[o]:{...this.look.plots[o],...c}},n({plots:{[o]:c}}))},lineWidth:o=>{r()&&(this.look.lineWidth=o,n({lineWidths:[o]}))},scale:o=>{r()&&(this.look.scale=o,a(o))},levels:o=>{r()&&(this.look.levels=o,s([...o]))}},this.t,this.uid)}setIntervals(t){var e,r;this.target&&(this.look.intervals=t,(r=(e=this.callbacks).onIntervals)==null||r.call(e,this.target.instanceId,t))}openDefaults(){var n;if((n=this.menu)!=null&&n.isOpen()){this.menu.close();return}this.menu??(this.menu=new W(this.modal,this.t("indicatorSettings.defaults")));const t=this.defaultsBtn.getBoundingClientRect(),e=this.modal.getBoundingClientRect(),r=[{id:"reset",label:this.t("indicatorSettings.resetSettings"),icon:"reset"},...this.callbacks.onSaveDefault?[{id:"save",label:this.t("indicatorSettings.saveAsDefault"),icon:"save"}]:[]];this.menu.open(r,t.left-e.left,t.top-e.top,s=>{s==="reset"?this.resetAll():this.saveDefault()},this.defaultsBtn)}resetAll(){var n,s;const t=this.target;if(!t)return;const e=t.instanceId,r={...t.defaults};this.draft={...r},this.callbacks.onApply(e,{...r}),Object.keys(this.look.plots).length>0&&((s=(n=this.callbacks).onStyle)==null||s.call(n,e,{plots:dn(this.look.plots,{})}),this.look.plots={}),t.levels&&this.callbacks.onLevels&&(this.callbacks.onLevels(e,null),this.look.levels=[...t.defaultLevels??[]]),this.look.intervals&&this.setIntervals(null),this.renderBody()}saveDefault(){var n,s;const t=this.target;if(!t)return;const e=Object.fromEntries(Object.entries(this.currentParams()).filter(([a,o])=>!ht(o,t.defaults[a])&&!(typeof o=="string"&&Qe(o)))),r={};Hs(this.look.colors)||(r.colors=[...this.look.colors]),this.look.lineWidth!==Le&&(r.lineWidths=[this.look.lineWidth]),Object.keys(this.look.plots).length>0&&(r.plots=ln(this.look.plots)),(s=(n=this.callbacks).onSaveDefault)==null||s.call(n,t.indicatorId,{params:e,style:r})}footerButton(t,e,r,n){const s=document.createElement("button");return s.type="button",s.className=e,s.dataset.act=t,n&&(s.textContent=n),s.addEventListener("click",r),s}note(t){const e=document.createElement("div");return e.className="tcw-settings-label",e.textContent=t,e}option(t,e){const r=document.createElement("option");return r.value=t,r.textContent=e,r}}function ie(i){return i.normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase()}const hn=/[\s/()%-]+/;function Bo(i,t){const e=ie(i.shortName),r=ie(i.name);return e===t||ie(i.id)===t?0:e.startsWith(t)||r.startsWith(t)?1:[...r.split(hn),...e.split(hn)].some(n=>n.startsWith(t))?2:r.includes(t)||e.includes(t)?3:null}function zo(i,t){const e=ie(t.trim());return e?i.map(r=>({item:r,rank:Bo(r,e)})).filter(r=>r.rank!==null).sort((r,n)=>r.rank-n.rank||r.item.name.localeCompare(n.item.name)).map(r=>r.item):[]}let Oo=1;const Ae=(i,t)=>i.name.localeCompare(t.name);class Fo{constructor(t,e,r){d(this,"backdrop",null);d(this,"listEl",null);d(this,"navEl",null);d(this,"searchEl",null);d(this,"liveEl",null);d(this,"content",{items:[],favorites:[],templates:[]});d(this,"favorites",new Set);d(this,"counts",new Map);d(this,"view","all");d(this,"lastView",null);d(this,"query","");d(this,"returnFocus",null);d(this,"uid",Oo++);this.layer=t,this.callbacks=e,this.t=r}open(t){var e;this.backdrop&&this.close(!1),this.returnFocus=document.activeElement instanceof HTMLElement?document.activeElement:null,this.content=t,this.favorites=new Set(t.favorites),this.counts=t.counts??new Map,this.query="",this.view=this.startView(),this.build(),(e=this.searchEl)==null||e.focus()}close(t=!0){var e,r,n;this.backdrop&&(this.backdrop.remove(),this.backdrop=this.listEl=this.navEl=this.searchEl=this.liveEl=null,(r=(e=this.callbacks).onClose)==null||r.call(e),t&&((n=this.returnFocus)!=null&&n.isConnected)&&this.returnFocus.focus(),this.returnFocus=null)}isOpen(){return this.backdrop!==null}setTemplates(t){var r;if(this.content={...this.content,templates:[...t]},!this.listEl||this.view!=="templates"||this.query)return;const e=this.listEl.contains(document.activeElement);this.renderList(),e&&!this.listEl.contains(document.activeElement)&&((r=this.listEl.querySelector("[data-tpl-save]"))==null||r.focus())}setCounts(t){var e;this.counts=t,(e=this.listEl)==null||e.querySelectorAll(".tcw-ip-row[data-ind]").forEach(r=>this.markCount(r))}destroy(){this.close(!1)}startView(){const t=this.views();return this.lastView&&t.includes(this.lastView)&&!(this.lastView==="favorites"&&this.favorites.size===0)?this.lastView:this.favorites.size>0?"favorites":"all"}views(){const t=new Set(this.content.items.map(e=>e.category));return["favorites",...this.callbacks.templates&&this.content.templates?["templates"]:[],"all",...Sr.filter(e=>t.has(e))]}viewLabel(t){return t==="favorites"?this.t("indicatorPicker.favorites"):t==="templates"?this.t("toolbar.indicators.templates"):t==="all"?this.t("toolbar.indicators.all"):this.t(`indicatorCategory.${t}`)}build(){const t=document.createElement("div");t.className="tcw-modal-backdrop",t.addEventListener("click",n=>{n.target===t&&this.close()});const e=document.createElement("div");e.className="tcw-modal tcw-ip",e.setAttribute("role","dialog"),e.setAttribute("aria-modal","true"),e.setAttribute("aria-labelledby",`tcw-ip-title-${this.uid}`),e.tabIndex=-1,e.addEventListener("keydown",n=>this.onKeyDown(n,e));const r=document.createElement("div");r.className="tcw-visually-hidden",r.setAttribute("aria-live","polite"),e.append(this.buildHeader(),this.buildSearch(),this.buildBody(),r),t.appendChild(e),this.layer().appendChild(t),this.backdrop=t,this.liveEl=r,this.renderNav(),this.renderList()}buildHeader(){const t=document.createElement("div");t.className="tcw-modal-header";const e=document.createElement("h3");e.id=`tcw-ip-title-${this.uid}`,e.textContent=this.t("toolbar.indicators");const r=document.createElement("button");return r.type="button",r.className="tcw-modal-close",r.setAttribute("aria-label",this.t("indicatorSettings.close")),r.innerHTML=b("x",16),r.addEventListener("click",()=>this.close()),t.append(e,r),t}buildSearch(){const t=document.createElement("label");t.className="tcw-ip-search";const e=document.createElement("input");return e.type="search",e.id=`tcw-ip-search-${this.uid}`,e.placeholder=this.t("indicatorPicker.search"),e.setAttribute("aria-label",this.t("indicatorPicker.search")),e.autocomplete="off",e.spellcheck=!1,e.addEventListener("input",()=>{this.query=e.value,this.renderList()}),e.addEventListener("keydown",r=>this.onSearchKey(r)),t.innerHTML=b("search",16),t.appendChild(e),this.searchEl=e,t}buildBody(){const t=document.createElement("div");t.className="tcw-ip-body";const e=document.createElement("div");e.className="tcw-ip-nav",e.setAttribute("role","tablist"),e.setAttribute("aria-orientation","vertical"),e.setAttribute("aria-label",this.t("indicatorPicker.groups")),e.addEventListener("keydown",n=>this.onNavKey(n));const r=document.createElement("div");return r.className="tcw-ip-list",r.id=`tcw-ip-list-${this.uid}`,r.setAttribute("role","tabpanel"),r.addEventListener("keydown",n=>this.onListKey(n)),r.addEventListener("focusin",n=>this.rove(n.target)),t.append(e,r),this.navEl=e,this.listEl=r,t}renderNav(){const t=this.navEl;t&&(t.replaceChildren(...this.views().map(e=>{const r=document.createElement("button");r.type="button",r.className="tcw-ip-tab",r.id=`tcw-ip-tab-${this.uid}-${e}`,r.dataset.view=e,r.setAttribute("role","tab"),r.setAttribute("aria-controls",`tcw-ip-list-${this.uid}`);const n=e==="favorites"?b("star",14):e==="templates"?b("layers",14):"";return r.innerHTML=`${n}<span></span>`,r.querySelector("span").textContent=this.viewLabel(e),e==="templates"&&k(r,"indicatorTemplates"),r.addEventListener("click",()=>this.select(e)),r})),this.markNav())}markNav(){var t;(t=this.navEl)==null||t.querySelectorAll(".tcw-ip-tab").forEach(e=>{const r=e.dataset.view===this.view;e.setAttribute("aria-selected",String(r)),e.classList.toggle("tcw-active",r),e.tabIndex=r?0:-1}),this.labelList()}labelList(){var e;const t=this.query.trim()!=="";(e=this.listEl)==null||e.setAttribute("aria-labelledby",t?`tcw-ip-search-${this.uid}`:`tcw-ip-tab-${this.uid}-${this.view}`)}select(t,e=!1){var r,n;this.view=this.lastView=t,this.searchEl&&this.query&&(this.searchEl.value=this.query=""),this.markNav(),this.renderList(),e&&((n=(r=this.navEl)==null?void 0:r.querySelector(`[data-view="${t}"]`))==null||n.focus())}renderList(){var r,n;const t=this.listEl;if(!t)return;t.replaceChildren();const e=this.content.items;if((r=this.navEl)==null||r.classList.toggle("tcw-ip-nav--searching",this.query.trim()!==""),this.labelList(),this.query.trim()){const s=zo(e,this.query);s.length===0?t.appendChild(this.note(S(this.t("indicatorPicker.noMatch"),{query:this.query.trim()}))):t.append(...s.map(a=>this.row(a)))}else if(this.view==="templates")this.renderTemplates(t);else if(this.view==="favorites"){const s=e.filter(a=>this.favorites.has(a.id)).sort(Ae);s.length===0?t.appendChild(this.note(this.t("indicatorPicker.noFavorites"))):t.append(...s.map(a=>this.row(a)))}else if(this.view==="all")for(const s of Sr){const a=e.filter(c=>c.category===s).sort(Ae);if(a.length===0)continue;const o=document.createElement("div");o.className="tcw-ip-heading",o.textContent=this.viewLabel(s),t.append(o,...a.map(c=>this.row(c)))}else t.append(...e.filter(s=>s.category===this.view).sort(Ae).map(s=>this.row(s)));(n=t.querySelector(".tcw-ip-add"))==null||n.setAttribute("tabindex","0")}row(t){const e=document.createElement("div");e.className="tcw-ip-row",e.dataset.ind=t.id;const r=document.createElement("button");r.type="button",r.className="tcw-ip-add",r.dataset.ind=t.id,r.tabIndex=-1;const n=document.createElement("span");n.className="tcw-ip-name",n.textContent=t.name,r.appendChild(n),t.shortName&&t.shortName!==t.name&&r.appendChild(this.tag("tcw-ip-short",t.shortName)),r.appendChild(this.tag("tcw-ip-kind",this.t(`indicatorType.${t.placement}`))),r.addEventListener("click",()=>this.add(t));const s=document.createElement("button");return s.type="button",s.className="tcw-ip-aside tcw-ip-star",s.tabIndex=-1,s.title=this.t("indicatorPicker.favorite"),s.setAttribute("aria-label",`${this.t("indicatorPicker.favorite")}: ${t.name}`),s.setAttribute("aria-pressed",String(this.favorites.has(t.id))),s.innerHTML=b("star",14),s.addEventListener("click",()=>this.toggleFavorite(t.id,s)),e.append(r,s),this.markCount(e),e}renderTemplates(t){const e=document.createElement("button");e.type="button",e.className="tcw-ip-add tcw-ip-save",e.tabIndex=-1,e.dataset.tplSave="",e.innerHTML=`${b("save",14)}<span class="tcw-ip-name"></span>`,e.querySelector("span").textContent=this.t("templates.save"),e.addEventListener("click",()=>{var n;this.close(),(n=this.callbacks.templates)==null||n.onSave()}),t.appendChild(e);const r=this.content.templates??[];r.length===0&&t.appendChild(this.note(this.t("indicatorPicker.noTemplates")));for(const n of r){const s=document.createElement("div");s.className="tcw-ip-row";const a=document.createElement("button");a.type="button",a.className="tcw-ip-add",a.tabIndex=-1,a.dataset.tplApply=n,a.innerHTML=`${b("layers",14)}<span class="tcw-ip-name"></span>`,a.querySelector("span").textContent=n,a.addEventListener("click",()=>{var l;this.close(),(l=this.callbacks.templates)==null||l.onApply(n)});const o=document.createElement("button");o.type="button",o.className="tcw-ip-aside tcw-ip-remove",o.tabIndex=-1,o.dataset.tplDelete=n;const c=S(this.t("templates.delete"),{name:n});o.title=c,o.setAttribute("aria-label",c),o.innerHTML=b("x",12),o.addEventListener("click",()=>{var l;return(l=this.callbacks.templates)==null?void 0:l.onDelete(n)}),s.append(a,o),t.appendChild(s)}}add(t){if(this.callbacks.onAdd(t.id)===!1||!this.liveEl)return;const e=S(this.t("indicatorPicker.added"),{name:t.name});this.liveEl.textContent=this.liveEl.textContent===e?`${e} `:e}toggleFavorite(t,e){var c,l,h;const r=!this.favorites.has(t);if(r?this.favorites.add(t):this.favorites.delete(t),this.callbacks.onFavorite(t,r),e.setAttribute("aria-pressed",String(r)),this.view!=="favorites"||this.query||r)return;const s=[...((c=this.listEl)==null?void 0:c.querySelectorAll(".tcw-ip-star"))??[]].indexOf(e),a=document.activeElement===e;if(this.renderList(),!a)return;const o=[...((l=this.listEl)==null?void 0:l.querySelectorAll(".tcw-ip-star"))??[]];(h=o[s]??o[o.length-1]??this.searchEl)==null||h.focus()}markCount(t){const e=this.counts.get(t.dataset.ind??"")??0,r=t.querySelector(".tcw-ip-add");let n=t.querySelector(".tcw-ip-count");if(e===0){n==null||n.remove();return}n||(n=this.tag("tcw-ip-count",""),r==null||r.appendChild(n)),n.textContent=String(e),n.title=S(this.t("indicatorPicker.onChart"),{count:String(e)})}tag(t,e){const r=document.createElement("span");return r.className=t,r.textContent=e,r}note(t){const e=document.createElement("div");return e.className="tcw-ip-empty",e.textContent=t,e}rove(t){var e;!(t instanceof HTMLElement)||!t.classList.contains("tcw-ip-add")||((e=this.listEl)==null||e.querySelectorAll('.tcw-ip-add[tabindex="0"]').forEach(r=>{r!==t&&(r.tabIndex=-1)}),t.tabIndex=0)}onKeyDown(t,e){if(t.key==="Escape"){t.preventDefault(),t.stopPropagation(),this.close();return}lt(t,e)}onSearchKey(t){var r;const e=(r=this.listEl)==null?void 0:r.querySelector(".tcw-ip-add");t.key==="ArrowDown"&&e?(t.preventDefault(),e.focus()):t.key==="Enter"&&this.query.trim()&&e&&(t.preventDefault(),e.click())}onNavKey(t){const e=this.views(),r=e.indexOf(this.view),n=t.key==="ArrowDown"?Math.min(e.length-1,r+1):t.key==="ArrowUp"?Math.max(0,r-1):t.key==="Home"?0:t.key==="End"?e.length-1:-1;n<0||(t.preventDefault(),this.select(e[n],!0))}onListKey(t){var c;const e=t.target,r=e.closest(".tcw-ip-row, .tcw-ip-save"),n=[...((c=this.listEl)==null?void 0:c.querySelectorAll(".tcw-ip-add"))??[]],s=r!=null&&r.classList.contains("tcw-ip-save")?r:r==null?void 0:r.querySelector(".tcw-ip-add"),a=s?n.indexOf(s):-1;let o=null;t.key==="ArrowDown"?o=n[a+1]:t.key==="ArrowUp"?o=a>0?n[a-1]:this.searchEl:t.key==="Home"?o=n[0]:t.key==="End"?o=n[n.length-1]:t.key==="ArrowRight"&&e===s?o=r==null?void 0:r.querySelector(".tcw-ip-aside"):t.key==="ArrowLeft"&&e!==s&&(o=s),o&&(t.preventDefault(),o.focus())}}function Ro(){try{return typeof localStorage<"u"?localStorage:null}catch{return null}}const le=i=>typeof i=="object"&&i!==null&&!Array.isArray(i);function un(i){return le(i)?Object.fromEntries(Object.entries(i).filter(([,t])=>typeof t=="number"&&Number.isFinite(t)||typeof t=="string"&&!Qe(t)||typeof t=="boolean")):{}}function pn(i){if(!le(i))return{};const t={};if(Array.isArray(i.colors)){const r=i.colors.filter(n=>typeof n=="string"&&n.trim()!=="");r.length>0&&(t.colors=r)}if(Array.isArray(i.lineWidths)){const r=i.lineWidths.filter(n=>typeof n=="number"&&Number.isFinite(n)&&n>0);r.length>0&&(t.lineWidths=r)}const e=Ws(i.plots);return e&&(t.plots=e),t}class $o{constructor(t="tcw:indicator-defaults",e=Ro()){this.key=t,this.storage=e}all(){var r;const t=new Map;let e;try{e=JSON.parse(((r=this.storage)==null?void 0:r.getItem(this.key))??"{}")}catch{return t}if(!le(e))return t;for(const[n,s]of Object.entries(e))le(s)&&t.set(n,{params:un(s.params),style:pn(s.style)});return t}get(t){return this.all().get(t)??null}save(t,e){if(!this.storage)return!1;const r=Object.fromEntries([...this.all(),[t,{params:un(e.params),style:pn(e.style)}]]);try{return this.storage.setItem(this.key,JSON.stringify(r)),!0}catch{return!1}}}const Ho=new Set(["timezone","numberLocale","chartTypeOptions","logScale","autoScale"]),mn=80,Wo={crosshairMode:["normal","magnet","hidden"],scaleMode:["regular","logarithmic","percentage","indexedTo100"],periodLevelsPeriod:["day","week"]},gs=i=>typeof i=="object"&&i!==null&&!Array.isArray(i);function wn(i){if(!gs(i))return{};const t={};for(const[e,r]of Object.entries(jn)){if(Ho.has(e)||!(e in i))continue;const n=i[e];if(typeof n!=typeof r||typeof n=="number"&&!Number.isFinite(n))continue;const s=Wo[e];s&&!s.includes(n)||(t[e]=n)}return t}function fn(i){const{overrides:t}=_s(i);return Object.fromEntries(Object.entries(t).filter(([e,r])=>r!==null&&it.includes(e)))}function _o(){try{return typeof localStorage<"u"?localStorage:null}catch{return null}}class Uo{constructor(t="tcw:chart-templates",e=_o()){this.key=t,this.storage=e}list(){var r;let t;try{t=JSON.parse(((r=this.storage)==null?void 0:r.getItem(this.key))??"[]")}catch{return[]}if(!Array.isArray(t))return[];const e=[];for(const n of t)!gs(n)||typeof n.name!="string"||!n.name.trim()||e.push({name:n.name.slice(0,mn).trim(),settings:wn(n.settings),style:fn(n.style)});return e.sort((n,s)=>n.name.localeCompare(s.name))}get(t){return this.list().find(e=>e.name===t)??null}save(t,e,r){const n=t.replace(/\s+/g," ").slice(0,mn).trim();if(!n||!this.storage)return!1;const s=[...this.list().filter(a=>a.name!==n),{name:n,settings:wn(e),style:fn(r)}];try{return this.storage.setItem(this.key,JSON.stringify(s)),!0}catch{return!1}}remove(t){var e;try{(e=this.storage)==null||e.setItem(this.key,JSON.stringify(this.list().filter(r=>r.name!==t)))}catch{}}}function bs(){try{return typeof localStorage<"u"?localStorage:null}catch{return null}}const gn=80;function bn(i){const{text:t,...e}=Us(i);return e}function vn(i){const t={name:i.name,style:{...i.style}};return i.type&&(t.type=i.type),i.options&&(t.options=structuredClone(i.options)),t}class jo{constructor(t="tcw:draw-templates",e=bs()){d(this,"templates",[]);this.storageKey=t,this.storage=e,this.load()}list(t){return this.templates.filter(e=>!e.type||e.type===t).map(vn)}get(t,e){const r=this.templates.find(n=>n.name===t&&n.type===e);return r?vn(r):null}save(t,e,r){const n=t.trim().slice(0,gn);if(!n)return;const s={name:n,style:bn(e)};r&&(s.type=r.type,s.options=structuredClone(r.options)),this.templates=this.templates.filter(a=>!(a.name===n&&a.type===s.type)),this.templates.push(s),this.persist()}remove(t,e){this.templates=this.templates.filter(r=>!(r.name===t&&r.type===e)),this.persist()}clear(){this.templates=[],this.persist()}load(){if(this.storage)try{const t=this.storage.getItem(this.storageKey);if(!t)return;const e=JSON.parse(t);if(!Array.isArray(e))return;this.templates=e.filter(r=>r&&typeof r.name=="string"&&r.name.trim()!=="").map(r=>{const n={name:r.name.trim().slice(0,gn),style:bn(r.style)};return typeof r.type=="string"&&(n.type=r.type),r.options&&typeof r.options=="object"&&!Array.isArray(r.options)&&(n.options=r.options),n})}catch{}}persist(){if(this.storage)try{this.storage.setItem(this.storageKey,JSON.stringify(this.templates))}catch{}}}class Vo{constructor(t="tcw:drawing-defaults",e=bs()){d(this,"defaults",{});var r;this.storageKey=t,this.storage=e;try{const n=(r=this.storage)==null?void 0:r.getItem(this.storageKey),s=n?JSON.parse(n):null;if(s&&typeof s=="object"&&!Array.isArray(s))for(const[a,o]of Object.entries(s))o&&typeof o=="object"&&!Array.isArray(o)&&(this.defaults[a]=o)}catch{}}all(){return structuredClone(this.defaults)}set(t,e){var r;e&&Object.keys(e).length>0?this.defaults[t]=structuredClone(e):delete this.defaults[t];try{(r=this.storage)==null||r.setItem(this.storageKey,JSON.stringify(this.defaults))}catch{}}}const vs=["#4c8dff","#1fa874","#e8505b","#f2a93b","#a57cff","#1398a8","#ffffff","#7d8696"],ys=[1,2,3,4],lr=["solid","dashed","dotted"];class Ko{constructor(t,e,r,n=D){d(this,"el");d(this,"templatesEl");d(this,"nameInput");d(this,"callbacks");d(this,"store");d(this,"open",!1);this.t=n,this.callbacks=e,this.store=r,this.el=document.createElement("div"),this.el.className="tcw-style-panel",this.el.hidden=!0;const s=document.createElement("div");s.className="tcw-style-header";const a=document.createElement("span");a.textContent=this.t("drawingStyle.title");const o=document.createElement("button");o.type="button",o.className="tcw-style-close",o.setAttribute("aria-label",this.t("common.close")),o.innerHTML=b("x",14),o.addEventListener("click",()=>this.close()),s.appendChild(a),s.appendChild(o),this.el.appendChild(s),this.el.appendChild(this.colorRow()),this.el.appendChild(this.widthRow()),this.el.appendChild(this.lineStyleRow());const c=document.createElement("div");c.className="tcw-style-subhead",c.textContent=this.t("drawingStyle.templates"),this.el.appendChild(c);const l=document.createElement("div");l.className="tcw-style-save",this.nameInput=document.createElement("input"),this.nameInput.type="text",this.nameInput.placeholder=this.t("drawingStyle.templateName"),this.nameInput.className="tcw-style-name";const h=document.createElement("button");h.type="button",h.className="tcw-style-savebtn",h.innerHTML=`${b("plus",13)}<span>${T(this.t("common.save"))}</span>`,h.addEventListener("click",()=>this.saveTemplate()),l.appendChild(this.nameInput),l.appendChild(h),this.el.appendChild(l),this.templatesEl=document.createElement("div"),this.templatesEl.className="tcw-style-templates",this.el.appendChild(this.templatesEl),t.appendChild(this.el),this.renderTemplates()}isOpen(){return this.open}toggle(){this.open?this.close():this.openPanel()}openPanel(){this.open=!0,this.el.hidden=!1,this.syncActiveControls(),this.renderTemplates()}close(){this.open=!1,this.el.hidden=!0}destroy(){this.el.remove()}colorRow(){const t=document.createElement("div");t.className="tcw-style-row tcw-style-colors";for(const r of vs){const n=document.createElement("button");n.type="button",n.className="tcw-style-swatch",n.style.background=r,n.dataset.color=r,n.setAttribute("aria-label",r),n.addEventListener("click",()=>this.applyStyle({color:r})),t.appendChild(n)}const e=document.createElement("input");return e.type="color",e.className="tcw-style-picker",e.addEventListener("input",()=>this.applyStyle({color:e.value})),t.appendChild(e),t}widthRow(){const t=document.createElement("div");t.className="tcw-style-row tcw-style-widths";for(const e of ys){const r=document.createElement("button");r.type="button",r.className="tcw-style-width",r.dataset.width=String(e);const n=document.createElement("span");n.style.height=`${e}px`,r.appendChild(n),r.addEventListener("click",()=>this.applyStyle({lineWidth:e})),t.appendChild(r)}return t}lineStyleRow(){const t=document.createElement("div");t.className="tcw-style-row tcw-style-dashes";for(const e of lr){const r=document.createElement("button");r.type="button",r.className="tcw-style-dash",r.dataset.linestyle=e,r.textContent=e==="solid"?"──":e==="dashed"?"╌╌":"┄┄",r.title=e,r.addEventListener("click",()=>this.applyStyle({lineStyle:e})),t.appendChild(r)}return t}applyStyle(t){this.callbacks.onStyleChange(t),this.syncActiveControls()}syncActiveControls(){const t=this.callbacks.getStyle();this.el.querySelectorAll(".tcw-style-swatch").forEach(e=>{var r,n;e.classList.toggle("tcw-on",((r=e.dataset.color)==null?void 0:r.toLowerCase())===((n=t.color)==null?void 0:n.toLowerCase()))}),this.el.querySelectorAll(".tcw-style-width").forEach(e=>{e.classList.toggle("tcw-on",Number(e.dataset.width)===t.lineWidth)}),this.el.querySelectorAll(".tcw-style-dash").forEach(e=>{e.classList.toggle("tcw-on",e.dataset.linestyle===t.lineStyle)})}saveTemplate(){const t=this.nameInput.value.trim();t&&(this.store.save(t,this.callbacks.getStyle()),this.nameInput.value="",this.renderTemplates())}renderTemplates(){this.templatesEl.replaceChildren();const t=this.store.list();if(t.length===0){const e=document.createElement("div");e.className="tcw-style-empty",e.textContent=this.t("drawingStyle.noTemplates"),this.templatesEl.appendChild(e);return}for(const e of t){const r=document.createElement("div");r.className="tcw-style-template";const n=document.createElement("button");n.type="button",n.className="tcw-style-apply";const s=document.createElement("span");s.className="tcw-style-tdot",s.style.background=e.style.color??"var(--tcw-text-muted)";const a=document.createElement("span");a.textContent=e.name,n.appendChild(s),n.appendChild(a),n.addEventListener("click",()=>{this.callbacks.onStyleChange({...e.style}),this.syncActiveControls()});const o=document.createElement("button");o.type="button",o.className="tcw-style-tdel",o.setAttribute("aria-label",this.t("drawingStyle.deleteTemplate")),o.innerHTML=b("trash",13),o.addEventListener("click",()=>{this.store.remove(e.name),this.renderTemplates()}),r.appendChild(n),r.appendChild(o),this.templatesEl.appendChild(r)}}}const yn=10,V=4,qo=4,Go=20,Yo=/^(#[0-9a-f]{3,8}|(rgb|hsl)a?\([\d\s.,%/+-]+\)|[a-z]+)$/i;function Ne(i){return typeof i=="string"&&Yo.test(i.trim())?i.trim():"#7d8696"}function Me(i){const t=Number(i);return Number.isFinite(t)&&t>0?Math.min(t,Go):1}function Kt(i){return lr.includes(i)?i:"solid"}class Xo{constructor(t,e,r=D){d(this,"el");d(this,"pop");d(this,"target",null);d(this,"built","");d(this,"size",null);d(this,"openPop",null);d(this,"pinned",null);d(this,"drag",null);d(this,"onDragMove",t=>{!this.drag||!this.target||t.pointerId!==this.drag.id||(this.pinned={left:this.drag.left+t.clientX-this.drag.x,top:this.drag.top+t.clientY-this.drag.y},this.place(this.target))});d(this,"onDragEnd",t=>{t&&this.drag&&t.pointerId!==this.drag.id||(this.drag=null,document.removeEventListener("pointermove",this.onDragMove),document.removeEventListener("pointerup",this.onDragEnd),document.removeEventListener("pointercancel",this.onDragEnd))});d(this,"onDocDown",t=>{this.openPop&&!this.el.contains(t.target)&&!this.pop.contains(t.target)&&this.closePop()});this.host=t,this.callbacks=e,this.t=r,this.el=document.createElement("div"),this.el.className="tcw-sel-toolbar",this.el.setAttribute("role","toolbar"),this.el.setAttribute("aria-label",r("selectionToolbar.label")),this.el.hidden=!0,this.pop=document.createElement("div"),this.pop.className="tcw-sel-pop",this.pop.setAttribute("role","dialog"),this.pop.hidden=!0,t.append(this.el,this.pop),this.el.addEventListener("click",n=>this.onClick(n)),this.el.addEventListener("keydown",n=>this.onKey(n)),this.pop.addEventListener("click",n=>this.onPick(n)),this.pop.addEventListener("keydown",n=>this.onPopKey(n));for(const n of[this.el,this.pop])n.addEventListener("pointerdown",s=>s.stopPropagation());this.el.addEventListener("pointerdown",n=>{n.target.closest(".tcw-sel-grip")&&(n.preventDefault(),this.closePop(),this.drag={id:n.pointerId,x:n.clientX,y:n.clientY,left:parseFloat(this.el.style.left)||0,top:parseFloat(this.el.style.top)||0},document.addEventListener("pointermove",this.onDragMove),document.addEventListener("pointerup",this.onDragEnd),document.addEventListener("pointercancel",this.onDragEnd))}),this.el.addEventListener("dblclick",n=>{!n.target.closest(".tcw-sel-grip")||!this.target||(this.pinned=null,this.place(this.target))}),document.addEventListener("pointerdown",this.onDocDown,!0)}isOpen(){return!this.el.hidden}show(t){this.target=t;const e=t.style,r=[Ne(e.color),Me(e.lineWidth),Kt(e.lineStyle),t.locked,t.canDelete,t.canSettings,t.canAlert].join("|");r!==this.built&&(this.built=r,this.render(t),this.size=null),this.el.hidden=!1,this.size||(this.size={w:this.el.offsetWidth,h:this.el.offsetHeight}),this.place(t),this.openPop&&this.placePop()}hide(){this.closePop(),this.el.hidden=!0,this.target=null}destroy(){this.onDragEnd(),document.removeEventListener("pointerdown",this.onDocDown,!0),this.el.remove(),this.pop.remove()}render(t){const e=this.t,r=Ne(t.style.color),n=Me(t.style.lineWidth),s=Kt(t.style.lineStyle),a=t.locked,o=this.el.contains(document.activeElement)?document.activeElement.dataset.action:void 0,c=(m,f,g,v="")=>`<button type="button" class="tcw-sel-btn${v}" data-action="${m}" aria-label="${T(f)}" title="${T(f)}">${g}</button>`,l=(m,f,g)=>c(m,f,g," tcw-sel-has-pop").replace("<button ",'<button aria-haspopup="dialog" aria-expanded="false" ');this.el.innerHTML=['<span class="tcw-sel-grip" aria-hidden="true"></span>',l("color",e("drawingSettings.color"),`<span class="tcw-sel-color" style="background:${T(r)}"></span>`),l("width",e("drawingSettings.lineWidth"),`<span class="tcw-sel-width" style="--w:${n}px"></span><span class="tcw-sel-num">${n}px</span>`),l("lineStyle",e("drawingSettings.lineStyle"),xn(s)),'<span class="tcw-sel-sep" aria-hidden="true"></span>',t.canSettings?c("settings",e("legend.settings"),b("settings",15)):"",t.canAlert?c("alert",e("drawingSettings.addAlert"),b("bell",15)):"",c("lock",e(a?"common.unlock":"common.lock"),b(a?"lock":"unlock",15),a?" tcw-sel-on":"").replace("<button ",`<button aria-pressed="${a}" `),c("more",e("legend.more"),b("more",15)),t.canDelete?c("delete",e("drawingMenu.delete"),b("trash",15)," tcw-sel-danger"):""].join("");const h=this.buttons(),p=h.find(m=>m.dataset.action===o)??(o?h.find(m=>m.dataset.action==="lock"):void 0);this.rove(p??h[0],p!==void 0)}buttons(){return[...this.el.querySelectorAll("button")]}rove(t,e){for(const r of this.buttons())r.tabIndex=r===t?0:-1;e&&(t==null||t.focus())}place(t){const{rect:e,bounds:r}=t,{w:n,h:s}=this.size??{w:0,h:0};if(this.pinned){const c=Math.max(r.x+V,Math.min(this.pinned.left,r.x+r.width-n-V)),l=Math.max(r.y+V,Math.min(this.pinned.top,r.y+r.height-s-V));this.el.style.left=`${Math.round(c)}px`,this.el.style.top=`${Math.round(l)}px`;return}let a=e.x+e.width/2-n/2;a=Math.max(r.x+V,Math.min(a,r.x+r.width-n-V));let o=e.y-s-yn;o<r.y+V&&(o=Math.min(e.y+e.height+yn,r.y+r.height-s-V)),o=Math.max(o,r.y+V),this.el.style.left=`${Math.round(a)}px`,this.el.style.top=`${Math.round(o)}px`}onClick(t){var n;const e=t.target.closest("[data-action]");if(!e)return;this.rove(e,!1);const r=e.dataset.action;if(r==="color"||r==="width"||r==="lineStyle"){this.openPop===r?this.closePop():this.openPopover(r,e);return}if(this.closePop(),r==="settings")this.callbacks.onSettings();else if(r==="alert")this.callbacks.onAlert();else if(r==="lock")this.callbacks.onLock(!((n=this.target)!=null&&n.locked));else if(r==="delete")this.callbacks.onDelete();else if(r==="more"){const s=e.getBoundingClientRect(),a=this.host.getBoundingClientRect();this.callbacks.onMore(s.left-a.left,s.bottom-a.top+V)}}onKey(t){if(t.key==="Escape"&&this.openPop){t.stopPropagation(),this.closePop(!0);return}const e=this.buttons(),r=e.indexOf(document.activeElement);if(r<0)return;const n=t.key==="ArrowRight"?(r+1)%e.length:t.key==="ArrowLeft"?(r-1+e.length)%e.length:t.key==="Home"?0:t.key==="End"?e.length-1:-1;n<0||(t.preventDefault(),this.rove(e[n],!0))}openPopover(t,e){var c;const r=this.target.style,n=Ne(r.color).toLowerCase(),s=Me(r.lineWidth),a=Kt(r.lineStyle),o=(l,h,p,m="")=>`<button type="button" class="${l}${h?" tcw-sel-on":""}" aria-pressed="${h}" ${p}>${m}</button>`;this.openPop=t,t==="color"?this.pop.innerHTML=vs.map(l=>o("tcw-sel-swatch",l.toLowerCase()===n,`data-color="${l}" style="background:${l}" aria-label="${l}"`)).join(""):t==="width"?this.pop.innerHTML=ys.map(l=>o("tcw-sel-option",l===s,`data-width="${l}"`,`<span class="tcw-sel-width" style="--w:${l}px"></span>${l}px`)).join(""):this.pop.innerHTML=lr.map(l=>o("tcw-sel-option",l===a,`data-style="${l}"`,xn(l)+T(this.t(`drawingSettings.lineStyle.${l}`)))).join(""),this.pop.className=`tcw-sel-pop tcw-sel-pop--${t}`,this.pop.setAttribute("aria-label",e.getAttribute("aria-label")??""),this.pop.hidden=!1;for(const l of this.el.querySelectorAll('[aria-expanded="true"]'))l.setAttribute("aria-expanded","false");e.setAttribute("aria-expanded","true"),this.placePop(),(c=this.pop.querySelector(".tcw-sel-on, button"))==null||c.focus()}onPopKey(t){if(t.key==="Escape"){t.stopPropagation(),this.closePop(!0);return}const e=[...this.pop.querySelectorAll("button")],r=e.indexOf(document.activeElement);if(r<0)return;const n=this.openPop==="color"?qo:1,s=t.key==="ArrowRight"?1:t.key==="ArrowLeft"?-1:t.key==="ArrowDown"?n:t.key==="ArrowUp"?-n:0;s&&(t.preventDefault(),e[(r+s+e.length)%e.length].focus())}placePop(){const t=this.el.querySelector(`[data-action="${this.openPop}"]`);t&&(this.pop.style.left=`${this.el.offsetLeft+t.offsetLeft}px`,this.pop.style.top=`${this.el.offsetTop+this.el.offsetHeight+6}px`)}onPick(t){const e=t.target.closest("button");e&&(e.dataset.color?this.callbacks.onStyle({color:e.dataset.color}):e.dataset.width?this.callbacks.onStyle({lineWidth:Number(e.dataset.width)}):e.dataset.style&&this.callbacks.onStyle({lineStyle:Kt(e.dataset.style)}),this.closePop(!0))}closePop(t=!1){if(!this.openPop)return;const e=this.el.querySelector(`[data-action="${this.openPop}"]`);e==null||e.setAttribute("aria-expanded","false"),this.openPop=null,this.pop.hidden=!0,t&&(e==null||e.focus())}}function xn(i){return`<svg class="tcw-sel-line" width="22" height="10" viewBox="0 0 22 10" aria-hidden="true"><line x1="1" y1="5" x2="21" y2="5" stroke="currentColor" stroke-width="2"${i==="dashed"?' stroke-dasharray="4 3"':i==="dotted"?' stroke-dasharray="1 3" stroke-linecap="round"':""}/></svg>`}const Jo=12,Zo=[1,2,3,4],Qo=["solid","dashed","dotted"],tc=[10,11,12,14,16,18,20,24,28,32],ec=48;let rc=1;class nc{constructor(t,e,r=D){d(this,"backdrop");d(this,"modal");d(this,"titleEl");d(this,"tabsEl");d(this,"bodyEl");d(this,"footerLeft");d(this,"tabButtons",[]);d(this,"target",null);d(this,"style");d(this,"options",{});d(this,"anchors",[]);d(this,"tab","style");d(this,"returnFocus",null);d(this,"uid",rc++);this.callbacks=e,this.t=r,this.backdrop=document.createElement("div"),this.backdrop.className="tcw-modal-backdrop",this.backdrop.hidden=!0;let n=!1;this.backdrop.addEventListener("pointerdown",h=>{n=h.target===this.backdrop}),this.backdrop.addEventListener("click",h=>{h.target===this.backdrop&&n&&this.close(!0),n=!1}),this.modal=document.createElement("div"),this.modal.className="tcw-modal tcw-modal-narrow tcw-drawing-settings",this.modal.setAttribute("role","dialog"),this.modal.setAttribute("aria-modal","true"),this.modal.setAttribute("aria-labelledby",`tcw-draw-title-${this.uid}`),this.modal.tabIndex=-1,this.modal.addEventListener("keydown",h=>this.onKeyDown(h));const s=document.createElement("div");s.className="tcw-modal-header",this.titleEl=document.createElement("h3"),this.titleEl.id=`tcw-draw-title-${this.uid}`;const a=document.createElement("button");a.type="button",a.className="tcw-modal-close",a.setAttribute("aria-label",this.t("common.close")),a.innerHTML=b("x",16),a.addEventListener("click",()=>this.close(!0)),s.append(this.titleEl,a),this.tabsEl=document.createElement("div"),this.tabsEl.className="tcw-modal-tabs",this.tabsEl.setAttribute("role","tablist"),this.tabsEl.addEventListener("keydown",h=>this.onTabKey(h)),this.bodyEl=document.createElement("div"),this.bodyEl.className="tcw-modal-body",this.bodyEl.id=`tcw-draw-panel-${this.uid}`,this.bodyEl.setAttribute("role","tabpanel");const o=document.createElement("div");o.className="tcw-modal-footer",this.footerLeft=document.createElement("div"),this.footerLeft.className="tcw-drawing-settings-tools";const c=document.createElement("button");c.type="button",c.className="tcw-reset-link",c.textContent=this.t("common.cancel"),c.addEventListener("click",()=>this.close(!0));const l=document.createElement("button");l.type="button",l.className="tcw-done-btn",l.textContent=this.t("drawingSettings.ok"),l.addEventListener("click",()=>this.close(!1)),o.append(this.footerLeft,c,l),this.modal.append(s,this.tabsEl,this.bodyEl,o),this.backdrop.appendChild(this.modal),t.appendChild(this.backdrop)}open(t){this.target&&this.close(!1),this.returnFocus=document.activeElement instanceof HTMLElement?document.activeElement:null,this.target=t,this.style={...t.style},this.options=structuredClone(t.options),this.anchors=t.anchors.map(e=>({...e})),this.titleEl.textContent=t.name,this.tab="style",this.callbacks.onBegin(t.id);try{this.renderTabs(),this.renderBody()}catch(e){throw this.target=null,this.callbacks.onEnd(t.id,!0),e}this.backdrop.hidden=!1,(this.tabButtons[0]??this.modal).focus()}close(t){var n;const e=this.target;if(!e)return;const r=document.activeElement;!t&&(r instanceof HTMLInputElement||r instanceof HTMLTextAreaElement)&&this.modal.contains(r)&&r.dispatchEvent(new Event("change")),this.target=null,this.backdrop.hidden=!0,this.callbacks.onEnd(e.id,t),(n=this.returnFocus)!=null&&n.isConnected&&this.returnFocus.focus(),this.returnFocus=null}isOpen(){return this.target!==null}editing(){var t;return((t=this.target)==null?void 0:t.id)??null}destroy(){this.close(!0),this.backdrop.remove()}tabs(){const t=["style"];return this.target&&Object.keys(this.target.defs).length>0&&t.push("options"),this.target&&this.target.anchors.length<=Jo&&t.push("coordinates"),t}renderTabs(){this.tabButtons=this.tabs().map(t=>{const e=document.createElement("button");return e.type="button",e.className="tcw-modal-tab",e.id=`tcw-draw-tab-${this.uid}-${t}`,e.setAttribute("role","tab"),e.setAttribute("aria-controls",this.bodyEl.id),e.dataset.tab=t,e.textContent=this.t(`drawingSettings.tab.${t}`),e.addEventListener("click",()=>this.selectTab(t)),e}),this.tabsEl.replaceChildren(...this.tabButtons),this.markTabs()}markTabs(){for(const t of this.tabButtons){const e=t.dataset.tab===this.tab;t.classList.toggle("tcw-active",e),t.setAttribute("aria-selected",String(e)),t.tabIndex=e?0:-1,e&&this.bodyEl.setAttribute("aria-labelledby",t.id)}}selectTab(t,e=!1){var r;this.tab=t,this.markTabs(),this.renderBody(),e&&((r=this.tabButtons.find(n=>n.dataset.tab===t))==null||r.focus())}onTabKey(t){const e=this.tabButtons.map(s=>s.dataset.tab),r=e.indexOf(this.tab),n=t.key==="ArrowRight"?(r+1)%e.length:t.key==="ArrowLeft"?(r-1+e.length)%e.length:t.key==="Home"?0:t.key==="End"?e.length-1:-1;n<0||(t.preventDefault(),this.selectTab(e[n],!0))}onKeyDown(t){if(t.key==="Escape"){t.preventDefault(),t.stopPropagation(),this.close(!0);return}lt(t,this.modal)}renderBody(){if(this.bodyEl.replaceChildren(),this.footerLeft.replaceChildren(),!this.target)return;if(this.target.alertable&&this.callbacks.onAddAlert){const e=document.createElement("button");e.type="button",e.className="tcw-reset-link tcw-drawing-alert",k(e,"alerts"),e.innerHTML=`${b("bell",13)}<span></span>`,e.querySelector("span").textContent=this.t("drawingSettings.addAlert"),e.addEventListener("click",()=>{var r,n;return(n=(r=this.callbacks).onAddAlert)==null?void 0:n.call(r,this.target.id)}),this.footerLeft.appendChild(e)}const t=document.createElement("div");t.className="tcw-settings-section",this.tab==="options"?this.renderOptions(t):this.tab==="coordinates"?this.renderCoordinates(t):this.renderStyle(t),this.bodyEl.appendChild(t)}change(t){this.target&&this.callbacks.onChange(this.target.id,t)}setStyle(t){this.style={...this.style,...t},this.change({style:t})}setOptions(t){this.options={...this.options,...structuredClone(t)},this.change({options:t})}renderStyle(t){const e=this.target;t.appendChild(I(this.t("drawingSettings.color"),At(this.style.color,r=>this.setStyle({color:r})))),t.appendChild(I(this.t("drawingSettings.lineWidth"),X(Zo.map(r=>({value:String(r),label:`${r} px`})),String(this.style.lineWidth),r=>this.setStyle({lineWidth:Number(r)})))),t.appendChild(I(this.t("drawingSettings.lineStyle"),X(Qo.map(r=>({value:r,label:this.t(`drawingSettings.lineStyle.${r}`)})),this.style.lineStyle,r=>this.setStyle({lineStyle:r})))),e.fill&&this.renderFill(t),e.text&&this.renderText(t),this.callbacks.templates&&this.renderTemplates(t)}renderFill(t){const e=this.style.fillColor??en(this.style.color,.1);let r=Dt(e),n=da(e);const s=()=>this.setStyle({fillColor:en(r,n),fillOpacity:n});t.appendChild(I(this.t("drawingSettings.fill"),At(r,a=>{r=a,s()}))),t.appendChild(I(this.t("drawingSettings.opacity"),ot(Math.round(n*100),{min:0,max:100,step:5},a=>{n=a/100,s()})))}renderText(t){const e=document.createElement("textarea");e.className="tcw-indi-input tcw-drawing-text",e.rows=3,e.value=this.style.text??"",e.addEventListener("input",()=>this.setStyle({text:e.value})),t.appendChild(I(this.t("drawingSettings.text"),e)),t.appendChild(I(this.t("drawingSettings.fontSize"),X(tc.map(r=>({value:String(r),label:`${r} px`})),String(this.style.fontSize??12),r=>this.setStyle({fontSize:Number(r)}))))}renderTemplates(t){const e=this.callbacks.templates,r=this.target,n=document.createElement("div");n.className="tcw-style-subhead",n.textContent=this.t("drawingStyle.templates"),t.appendChild(n);const s=document.createElement("div");s.className="tcw-drawing-templates";const a=e.list(r.type);if(a.length===0){const h=document.createElement("div");h.className="tcw-settings-label",h.textContent=this.t("drawingStyle.noTemplates"),s.appendChild(h)}for(const h of a){const p=document.createElement("div");p.className="tcw-style-tmpl";const m=document.createElement("button");m.type="button",m.className="tcw-style-tmpl-apply",m.textContent=h.name,m.addEventListener("click",()=>{this.setStyle(h.style),h.options&&this.setOptions(js(r.defs,h.options)),this.renderBody()});const f=document.createElement("button");f.type="button",f.className="tcw-style-tmpl-del",f.setAttribute("aria-label",this.t("drawingStyle.deleteTemplate")),f.innerHTML=b("x",12),f.addEventListener("click",()=>{e.remove(h.name,h.type),this.renderBody()}),p.append(m,f),s.appendChild(p)}t.appendChild(s);const o=document.createElement("div");o.className="tcw-style-save";const c=document.createElement("input");c.type="text",c.className="tcw-style-name",c.placeholder=this.t("drawingStyle.templateName"),c.setAttribute("aria-label",this.t("drawingStyle.templateName"));const l=document.createElement("button");l.type="button",l.className="tcw-style-savebtn",l.textContent=this.t("common.save"),l.addEventListener("click",()=>{c.value.trim()&&(e.save(c.value,this.style,{type:r.type,options:this.options}),this.renderBody())}),o.append(c,l),t.appendChild(o)}label(t,e){const r=`drawingOption.${t}`,n=this.t(r);return n===r?e:n}renderOptions(t){const e=this.target;for(const[n,s]of Object.entries(e.defs))s.kind==="levels"?t.appendChild(this.levelsEditor(n,s)):t.appendChild(I(this.label(n,s.label),this.optionControl(n,s)));const r=document.createElement("button");if(r.type="button",r.className="tcw-reset-link",r.textContent=this.t("settings.resetToDefaults"),r.addEventListener("click",()=>{const n={};for(const[s,a]of Object.entries(e.defs))n[s]=structuredClone(a.default);this.setOptions(n),this.renderBody()}),this.footerLeft.appendChild(r),this.callbacks.onSaveDefault){const n=document.createElement("button");n.type="button",n.className="tcw-reset-link",n.textContent=this.t("drawingSettings.saveDefault"),n.addEventListener("click",()=>{var s,a;return(a=(s=this.callbacks).onSaveDefault)==null?void 0:a.call(s,e.type,structuredClone(this.options))}),this.footerLeft.appendChild(n)}}optionControl(t,e){const r=this.options[t];switch(e.kind){case"boolean":return or(!!r,n=>this.setOptions({[t]:n}));case"number":return ot(Number(r),{min:e.min,max:e.max,step:e.step},n=>this.setOptions({[t]:n}));case"choice":return X(e.choices.map(n=>({value:n.value,label:this.label(`${t}.${n.value}`,n.label)})),String(r),n=>this.setOptions({[t]:n}));case"text":{const n=document.createElement("input");return n.type="text",n.className="tcw-indi-input",n.value=String(r??""),n.addEventListener("change",()=>this.setOptions({[t]:n.value})),n}}}levelsEditor(t,e){const r=document.createElement("div");r.className="tcw-levels-editor";const n=document.createElement("div");n.className="tcw-style-subhead",n.textContent=this.label(t,e.label),r.appendChild(n);const s=()=>{const l=this.options[t];return Array.isArray(l)?l:[]},a=l=>this.setOptions({[t]:l}),o=document.createElement("div");o.className="tcw-levels-grid",s().forEach((l,h)=>{const p=document.createElement("div");p.className="tcw-level-row";const m=document.createElement("input");m.type="checkbox",m.checked=l.visible;const f=` ${h+1}`;m.setAttribute("aria-label",this.t("drawingSettings.levelVisible")+f),m.addEventListener("change",()=>a(s().map((L,C)=>C===h?{...L,visible:m.checked}:L)));const g=ot(l.value,{step:.001},L=>a(s().map((C,E)=>E===h?{...C,value:L}:C)));g.setAttribute("aria-label",this.t("drawingSettings.levelValue")+f);const v=At(l.color??this.style.color,L=>a(s().map((C,E)=>E===h?{...C,color:L}:C)));v.setAttribute("aria-label",this.t("drawingSettings.levelColor")+f);const y=document.createElement("button");y.type="button",y.className="tcw-level-remove",y.setAttribute("aria-label",this.t("drawingSettings.removeLevel")+f),y.innerHTML=b("x",12),y.addEventListener("click",()=>{a(s().filter((L,C)=>C!==h)),this.renderBody()}),p.append(m,g,v,y),o.appendChild(p)}),r.appendChild(o);const c=document.createElement("button");return c.type="button",c.className="tcw-reset-link tcw-level-add",c.textContent=this.t("drawingSettings.addLevel"),c.disabled=s().length>=ec,c.addEventListener("click",()=>{var h;const l=((h=s().at(-1))==null?void 0:h.value)??0;a([...s(),{value:Math.round((l+.5)*1e3)/1e3,visible:!0}]),this.renderBody()}),r.appendChild(c),r}renderCoordinates(t){this.anchors.forEach((e,r)=>{const n=document.createElement("div");n.className="tcw-style-subhead",n.textContent=S(this.t("drawingSettings.point"),{n:r+1}),t.appendChild(n);const s=this.callbacks.toWallTime(e.time),a=document.createElement("input");a.type="date",a.className="tcw-indi-input",a.value=s.date;const o=document.createElement("input");o.type="time",o.className="tcw-indi-input",o.value=s.time;const c=()=>{const l=this.callbacks.fromWallTime(a.value,o.value);l!==null&&this.setAnchor(r,{time:l})};a.addEventListener("change",c),o.addEventListener("change",c),t.appendChild(I(this.t("drawingSettings.date"),a)),t.appendChild(I(this.t("drawingSettings.time"),o)),t.appendChild(I(this.t("drawingSettings.price"),this.priceInput(e.price,l=>this.setAnchor(r,{price:l}))))})}priceInput(t,e){var a,o;const r=this.callbacks.roundPrice??(c=>c),n=(o=(a=this.callbacks).priceStep)==null?void 0:o.call(a),s=ot(r(t),{step:n!==void 0&&n>0?n:"any"},c=>{const l=r(c);s.value=String(l),e(l)});return s}setAnchor(t,e){this.anchors=this.anchors.map((r,n)=>n===t?{...r,...e}:r),this.change({anchors:this.anchors.map(r=>({...r}))})}}function sc(i,t){const{selected:e}=i,r=e.length===1,n=new Set(e.map(c=>c.groupId)),s=n.size===1&&!n.has(null),a=[];i.canConfigure&&r&&a.push({id:"settings",label:t("drawingMenu.settings"),icon:"settings"}),i.canAlert&&r&&a.push({id:"alert",label:t("drawingSettings.addAlert"),icon:"bell"}),a.length>0&&a.push("separator"),r&&a.push({id:"front",label:t("drawingMenu.front")},{id:"forward",label:t("drawingMenu.forward")},{id:"backward",label:t("drawingMenu.backward")},{id:"back",label:t("drawingMenu.back")},"separator"),e.length>1&&!s&&a.push({id:"group",label:t("drawingMenu.group"),icon:"layers"}),e.some(c=>c.groupId)&&a.push({id:"ungroup",label:t("drawingMenu.ungroup"),icon:"layers"});const o=e.every(c=>c.locked);return a.push(o?{id:"unlock",label:t("common.unlock"),icon:"unlock"}:{id:"lock",label:t("common.lock"),icon:"lock"},{id:"hide",label:t("common.hide"),icon:"eyeOff"}),r&&a.push({id:"duplicate",label:t("drawingMenu.duplicate"),icon:"plus"}),o||a.push("separator",{id:"delete",label:t("drawingMenu.delete"),icon:"trash",danger:!0}),a}const Ke="tz:",xs=[{id:"regularScale",mode:"regular",label:"settings.scale.regular"},{id:"logScale",mode:"logarithmic",label:"settings.scale.logarithmic"},{id:"percentScale",mode:"percentage",label:"settings.scale.percentage"},{id:"indexedScale",mode:"indexedTo100",label:"settings.scale.indexedTo100"}],ic=[{action:"resetView",keys:"Alt+R",feature:"hotkeys.resetView"},{action:"invertScale",keys:"Alt+I",feature:"hotkeys.invertScale"},{action:"goToDate",keys:"Alt+G",feature:"hotkeys.goToDate"}];function ac(i){var t;return(t=xs.find(e=>e.id===i))==null?void 0:t.mode}function me(...i){return i.filter(t=>t.length>0).flatMap((t,e)=>e===0?[...t]:["separator",...t])}function Mt(i,t){const e=t.keys[i.id];return e?{...i,shortcut:e}:i}function dr(i,t){if(i.price===void 0||!Number.isFinite(i.price))return[];const e=i.formatPrice(i.price),r=[];if(i.canAlert&&r.push({id:"alert",label:S(t("chartMenu.addAlert"),{price:e}),icon:"bell"}),i.canTrade){const n=i.lastPrice===null||i.price<=i.lastPrice;r.push(n?{id:"buyLimit",label:S(t("chartMenu.buyLimit"),{price:e}),icon:"trendingUp"}:{id:"buyStop",label:S(t("chartMenu.buyStop"),{price:e}),icon:"trendingUp"},n?{id:"sellStop",label:S(t("chartMenu.sellStop"),{price:e}),icon:"trendingDown"}:{id:"sellLimit",label:S(t("chartMenu.sellLimit"),{price:e}),icon:"trendingDown"}),i.canOrderTicket&&r.push({id:"orderTicket",label:t("chartMenu.orderTicket"),icon:"receipt"})}return i.canDraw&&r.push({id:"horizontalLine",label:S(t("chartMenu.horizontalLine"),{price:e}),icon:"minus"}),r}const hr=i=>({id:"settings",label:i("chartMenu.settings"),icon:"settings"});function oc(i,t){const e=[Mt({id:"resetView",label:t("chartMenu.resetView")},i)];i.canPaste&&e.push({id:"paste",label:t("chartMenu.paste")});const r=[];i.hasDrawings&&r.push(i.drawingsHidden?{id:"showDrawings",label:t("chartMenu.showDrawings"),icon:"eye"}:{id:"hideDrawings",label:t("chartMenu.hideDrawings"),icon:"eyeOff"},{id:"removeDrawings",label:t("chartMenu.removeDrawings"),icon:"trash",danger:!0}),i.hasIndicators&&r.push({id:"removeIndicators",label:t("chartMenu.removeIndicators"),icon:"trash",danger:!0});const n=i.canExport?[{id:"exportData",label:t("chartMenu.exportData"),icon:"save"}]:[];return me(dr(i,t),e,r,[...n,hr(t)])}function cc(i,t){const e=[{id:"resetPriceScale",label:t("chartMenu.resetPriceScale")},{id:"autoScale",label:t("settings.autoScale"),checked:i.autoScale},Mt({id:"invertScale",label:t("chartMenu.invertScale"),checked:i.inverted},i),{id:"leftScale",label:t("settings.leftScale"),checked:i.leftScale}],r=xs.filter(c=>c.mode!=="logarithmic"||i.canLog).map(c=>({id:c.id,label:t(c.label),radio:!0,checked:i.scaleMode===c.mode})),n=[{id:"indicatorValueLabels",label:t("settings.indicatorValues"),checked:i.labels.values}];i.labels.countdown!==void 0&&n.push({id:"barCountdown",label:t("settings.barCountdown"),checked:i.labels.countdown});const s=[{id:"highLowLines",label:t("settings.highLowLines"),checked:i.lines.highLow},{id:"lastPriceLine",label:t("chartMenu.lastPriceLine"),checked:i.lines.lastPrice}],a=[{id:"labels",label:t("chartMenu.labels"),submenu:n},{id:"lines",label:t("chartMenu.lines"),submenu:s}],o=dr({...i,canTrade:!1,canDraw:!1},t);return me(e,r,a,o,[hr(t)])}function lc(i,t){const e=[Mt({id:"resetView",label:t("chartMenu.resetTimeScale")},i)];i.canGoToDate&&e.push(Mt({id:"goToDate",label:t("chartMenu.goToDate"),icon:"calendar"},i));const r=i.timezone.options.map(n=>({id:`${Ke}${n.value}`,label:n.label,radio:!0,checked:n.value===i.timezone.current}));return me(e,r.length>0?[{id:"timezone",label:t("settings.timezone"),submenu:r}]:[])}function dc(i,t){const e=i.pane?[{id:"paneLog",label:t("chartMenu.paneLog"),checked:i.pane.log},{id:"paneInvert",label:t("chartMenu.paneInvert"),checked:i.pane.invert},{id:"panePercent",label:t("chartMenu.panePercent"),checked:i.pane.percent}]:[];return me([Mt({id:"resetView",label:t("chartMenu.resetView")},i)],e,[hr(t)])}function hc(i,t,e){switch(i){case"priceAxis":return cc(t,e);case"timeAxis":return lc(t,e);case"pane":return dc(t,e);default:return oc(t,e)}}const xt=["positions","orders","history"],uc=["order","close","reverse","stopLoss","takeProfit"],pc=["market","limit","stop"],mc=["gtc","day"];function Ie(i,t,e){return i.includes(t??"")?t:e}function Pe(i,t){return i.length===t.length&&i.every((e,r)=>e===t[r])}function kn(i,t){if(t===null)return null;const e=i.quantity-(i.closedQuantity??0),r=i.side==="buy"?1:-1,n=(t-i.entryPrice)*e*r,s=i.entryPrice!==0?(t-i.entryPrice)/i.entryPrice*100*r:0;return{pnl:n,pct:s}}function qt(i,t=2){return`${i>0?"+":""}${i.toFixed(t)}`}class wc{constructor(t,e,r=D){d(this,"el");d(this,"tabButtons",new Map);d(this,"content");d(this,"tab","positions");d(this,"snapshot",{positions:[],orders:[],fills:[],price:null});d(this,"open",!1);d(this,"live",[]);this.callbacks=e,this.t=r,this.el=document.createElement("section"),this.el.className="tcw-account",this.el.hidden=!0,this.el.setAttribute("aria-label",this.t("account.title"));const n=document.createElement("div");n.className="tcw-account-head";const s=document.createElement("div");s.className="tcw-account-tabs",s.setAttribute("role","tablist"),s.addEventListener("keydown",c=>this.onTabKey(c));for(const c of xt){const l=document.createElement("button");l.type="button",l.className="tcw-account-tab",l.setAttribute("role","tab"),l.id=`tcw-account-tab-${c}`,l.addEventListener("click",()=>this.selectTab(c)),this.tabButtons.set(c,l),s.appendChild(l)}const a=document.createElement("button");a.type="button",a.className="tcw-account-new",k(a,"orderTicket"),a.innerHTML=b("plus",13),a.append(this.t("account.newOrder")),a.addEventListener("click",()=>this.callbacks.onNewOrder());const o=document.createElement("button");o.type="button",o.className="tcw-tree-close",o.setAttribute("aria-label",this.t("account.close")),o.innerHTML=b("x",14),o.addEventListener("click",()=>this.closePanel()),n.append(s,a,o),this.content=document.createElement("div"),this.content.className="tcw-account-body",this.content.setAttribute("role","tabpanel"),this.el.append(n,this.content),t.appendChild(this.el),this.renderTabs()}isOpen(){return this.open}toggle(){this.open?this.closePanel():this.openPanel()}openPanel(){var t,e;this.open=!0,this.el.hidden=!1,this.render(),(e=(t=this.callbacks).onToggle)==null||e.call(t,!0)}closePanel(){var t,e;this.open&&(this.open=!1,this.el.hidden=!0,(e=(t=this.callbacks).onToggle)==null||e.call(t,!1))}update(t){const e=this.snapshot;if(this.snapshot=t,Pe(e.positions,t.positions)&&Pe(e.orders,t.orders)&&Pe(e.fills,t.fills)&&e.realisedPnl===t.realisedPnl){this.open&&this.tab==="positions"&&e.price!==t.price&&this.patchPrices();return}this.renderTabs(),this.open&&this.render()}destroy(){this.el.remove()}selectTab(t){this.tab=t,this.renderTabs(),this.render()}onTabKey(t){var s;const e=xt.indexOf(this.tab),r=t.key==="ArrowRight"?e+1:t.key==="ArrowLeft"?e-1:-2;if(r===-2)return;t.preventDefault();const n=xt[(r+xt.length)%xt.length];this.selectTab(n),(s=this.tabButtons.get(n))==null||s.focus()}renderTabs(){const t={positions:this.snapshot.positions.length,orders:this.snapshot.orders.length,history:this.snapshot.fills.length};for(const[e,r]of this.tabButtons){const n=e===this.tab;r.textContent=`${this.t(`account.${e}`)} (${t[e]})`,r.setAttribute("aria-selected",String(n)),r.tabIndex=n?0:-1,n&&this.content.setAttribute("aria-labelledby",r.id)}}render(){var r;const t=document.activeElement,e=t instanceof HTMLElement&&this.content.contains(t)?t.dataset.focusKey:void 0;this.live=[],this.tab==="positions"?this.renderPositions():this.tab==="orders"?this.renderOrders():this.renderHistory(),e&&((r=[...this.content.querySelectorAll("[data-focus-key]")].find(n=>n.dataset.focusKey===e))==null||r.focus())}patchPrices(){const{price:t}=this.snapshot;for(const e of this.live)e.price.textContent=t===null?"—":this.callbacks.formatPrice(t),this.writePnl(e.pnl,kn(e.position,t))}writePnl(t,e){t.className=e===null?"":e.pnl>=0?"tcw-account-up":"tcw-account-down",t.textContent=e===null?"—":`${qt(e.pnl)} (${qt(e.pct)}%)`}table(t,e,r){if(e.length===0){const a=document.createElement("p");a.className="tcw-account-empty",a.textContent=this.t(r),this.content.replaceChildren(a);return}const n=document.createElement("table");n.className="tcw-account-table";const s=n.createTHead().insertRow();for(const a of t){const o=document.createElement("th");o.scope="col",o.textContent=a?this.t(a):"",s.appendChild(o)}n.createTBody().append(...e),this.content.replaceChildren(n)}row(t,e=""){const r=document.createElement("tr");e&&(r.className=e);for(const n of t){const s=r.insertCell();typeof n=="string"?s.textContent=n:s.appendChild(n)}return r}sideCell(t,e="position"){const r=document.createElement("span");return r.className=`tcw-account-side tcw-account-${t}`,r.textContent=this.sideText(t,e),r}sideText(t,e){return e==="trade"?this.t(t==="buy"?"ticket.buy":"ticket.sell"):this.t(t==="buy"?"account.long":"account.short")}actions(...t){const e=document.createElement("div");e.className="tcw-account-actions";for(const r of t){const n=document.createElement("button");n.type="button",n.className=`tcw-tree-btn${r.danger?" tcw-tree-del":""}`,n.setAttribute("aria-label",r.label),n.title=r.label,n.dataset.focusKey=r.key,n.innerHTML=b(r.icon,14),n.addEventListener("click",r.run),e.appendChild(n)}return e}renderPositions(){const{formatPrice:t}=this.callbacks,{price:e}=this.snapshot,r=this.snapshot.positions.map(n=>{const s=n.quantity-(n.closedQuantity??0),a=document.createElement("span");this.writePnl(a,kn(n,e));const o=`${this.sideText(n.side,"position")} ${s} @ ${t(n.entryPrice)}`,c=this.row([this.sideCell(n.side),String(s),t(n.entryPrice),e===null?"—":t(e),a,n.stopLoss===void 0?"—":t(n.stopLoss),n.takeProfit===void 0?"—":t(n.takeProfit),this.actions({icon:"repeat",label:`${this.t("account.reverse")}: ${o}`,key:`reverse:${n.id}`,run:()=>this.callbacks.onReversePosition(n.id)},{icon:"x",label:`${this.t("account.closePosition")}: ${o}`,key:`close:${n.id}`,run:()=>this.callbacks.onClosePosition(n.id),danger:!0})]);return this.live.push({position:n,price:c.cells[3],pnl:a}),c});this.table(["account.side","account.quantity","account.entry","account.price","account.pnl","account.stopLoss","account.takeProfit","account.actions"],r,"account.noPositions")}renderOrders(){const{formatPrice:t}=this.callbacks,e=this.snapshot.orders.map(r=>{const n=Ie(pc,r.type==="stopLimit"?"stop":r.type,"limit"),s=`${this.sideText(r.side,"trade")} ${r.quantity} @ ${t(r.price)}`;return this.row([this.sideCell(r.side,"trade"),this.t(`ticket.type.${n}`),String(r.quantity),t(r.price),r.stopLoss===void 0?"—":t(r.stopLoss),r.takeProfit===void 0?"—":t(r.takeProfit),r.timeInForce?this.t(`ticket.tif.${Ie(mc,r.timeInForce,"gtc")}`):"—",this.actions({icon:"x",label:`${this.t("account.cancelOrder")}: ${s}`,key:`cancel:${r.id}`,run:()=>this.callbacks.onCancelOrder(r.id),danger:!0})])});this.table(["account.side","ticket.type","account.quantity","account.price","account.stopLoss","account.takeProfit","ticket.timeInForce","account.actions"],e,"account.noOrders")}renderHistory(){const{formatPrice:t,formatTime:e}=this.callbacks,r=[...this.snapshot.fills].reverse().map(s=>{const a=document.createElement("span");return s.pnl!==void 0?(a.className=s.pnl>=0?"tcw-account-up":"tcw-account-down",a.textContent=qt(s.pnl)):a.textContent="—",this.row([e(s.time),this.sideCell(s.side,"trade"),String(s.quantity),t(s.price),this.t(`account.reason.${Ie(uc,s.reason,"order")}`),a])});this.table(["account.time","account.side","account.quantity","account.price","account.reason","account.pnl"],r,"account.noFills");const n=this.snapshot.realisedPnl??this.snapshot.fills.reduce((s,a)=>s+(a.pnl??0),0);if(r.length>0){const s=document.createElement("p");s.className="tcw-account-summary",s.textContent=S(this.t("account.realised"),{pnl:qt(n)}),this.content.appendChild(s)}}}const De=1e-9;function ks(i,t){return i.type==="market"?t:i.price}function Sn(i,t,e={}){const r=[];(!(i.quantity>0)||!Number.isFinite(i.quantity))&&r.push("quantity"),i.type!=="market"&&(!(i.price>0)||!Number.isFinite(i.price))&&r.push("price"),i.type==="market"&&!((t??i.price)>0)&&r.push("market");const n=i.side==="buy";if(t!==null&&i.type!=="market"&&i.price>0){const o=i.price<t;i.type==="limit"&&o!==n&&i.price!==t&&r.push("limitSide"),i.type==="stop"&&o===n&&i.price!==t&&r.push("stopSide")}const s=o=>o===null||Number.isFinite(o)&&o>0;s(i.stopLoss)||r.push("stopLoss"),s(i.takeProfit)||r.push("takeProfit");const a=ks(i,t);return a!==null&&a>0&&(i.stopLoss!==null&&s(i.stopLoss)&&(n?i.stopLoss>=a:i.stopLoss<=a)&&r.push("stopLossSide"),i.takeProfit!==null&&s(i.takeProfit)&&(n?i.takeProfit<=a:i.takeProfit>=a)&&r.push("takeProfitSide")),[...r,...fc(i,e)]}function fc(i,t){const e=[],r=i.type==="market"?null:i.price,n=[r,i.stopLoss,i.takeProfit].filter(c=>c!==null&&Number.isFinite(c)&&c>0),{roundPrice:s,limits:a,lot:o}=t;return s&&n.some(c=>Math.abs(s(c)-c)>De)&&e.push("priceStep"),a&&r!==null&&r>0&&(r>a.ceiling+De||r<a.floor-De)&&e.push("priceLimits"),o!==void 0&&o>1&&i.quantity>o&&i.quantity%o!==0&&e.push("lot"),e}function gc(i,t){const e={side:i.side,type:i.type,price:i.type==="market"?t??i.price:i.price,quantity:i.quantity};return i.type==="stop"&&(e.stopPrice=i.price),i.type!=="market"&&(e.timeInForce=i.timeInForce),i.stopLoss!==null&&(e.stopLoss=i.stopLoss),i.takeProfit!==null&&(e.takeProfit=i.takeProfit),e}function bc(i,t){const e=ks(i,t);if(e===null||i.stopLoss===null||i.takeProfit===null)return null;const r=Math.abs(e-i.stopLoss);return r>0?Math.abs(i.takeProfit-e)/r:null}let vc=0;class yc{constructor(t,e,r=D){d(this,"backdrop");d(this,"modal");d(this,"body");d(this,"problemsEl");d(this,"submit");d(this,"draft",null);d(this,"lastPrice",null);d(this,"rules",{});d(this,"returnFocus",null);d(this,"uid",++vc);this.callbacks=e,this.t=r,this.backdrop=document.createElement("div"),this.backdrop.className="tcw-modal-backdrop",this.backdrop.hidden=!0;let n=!1;this.backdrop.addEventListener("pointerdown",h=>{n=h.target===this.backdrop}),this.backdrop.addEventListener("click",h=>{h.target===this.backdrop&&n&&this.close(),n=!1}),this.modal=document.createElement("div"),this.modal.className="tcw-modal tcw-modal-narrow tcw-order-ticket",this.modal.setAttribute("role","dialog"),this.modal.setAttribute("aria-modal","true"),this.modal.setAttribute("aria-labelledby",`tcw-ticket-title-${this.uid}`),this.modal.addEventListener("keydown",h=>{if(h.key==="Escape"){h.stopPropagation(),this.close();return}lt(h,this.modal)});const s=document.createElement("div");s.className="tcw-modal-header";const a=document.createElement("h3");a.id=`tcw-ticket-title-${this.uid}`,a.textContent=this.t("ticket.title");const o=document.createElement("button");o.type="button",o.className="tcw-modal-close",o.setAttribute("aria-label",this.t("common.close")),o.innerHTML=b("x",16),o.addEventListener("click",()=>this.close()),s.append(a,o),this.body=document.createElement("div"),this.body.className="tcw-modal-body",this.problemsEl=document.createElement("div"),this.problemsEl.className="tcw-ticket-problems",this.problemsEl.setAttribute("aria-live","polite");const c=document.createElement("div");c.className="tcw-modal-footer";const l=document.createElement("button");l.type="button",l.className="tcw-reset-link",l.textContent=this.t("common.cancel"),l.addEventListener("click",()=>this.close()),this.submit=document.createElement("button"),this.submit.type="button",this.submit.className="tcw-done-btn",this.submit.addEventListener("click",()=>this.place()),c.append(l,this.submit),this.modal.append(s,this.body,this.problemsEl,c),this.backdrop.appendChild(this.modal),t.appendChild(this.backdrop)}open(t){var a;this.returnFocus=document.activeElement instanceof HTMLElement?document.activeElement:null,this.lastPrice=t.lastPrice,this.rules=t.rules??{};const e=t.price??t.lastPrice??0,r=t.side??"buy";let n="market";t.price!==void 0&&t.lastPrice!==null&&t.price!==t.lastPrice&&(n=t.price<t.lastPrice==(r==="buy")?"limit":"stop");const s=this.rules.lot!==void 0&&this.rules.lot>1?this.rules.lot:1;this.draft={side:r,type:n,quantity:s,price:e,stopLoss:null,takeProfit:null,timeInForce:"gtc"},this.render(),this.backdrop.hidden=!1,(a=this.body.querySelector("button, input, select"))==null||a.focus()}close(){var t;this.backdrop.hidden||(this.backdrop.hidden=!0,this.draft=null,(t=this.returnFocus)!=null&&t.isConnected&&this.returnFocus.focus(),this.returnFocus=null)}isOpen(){return!this.backdrop.hidden}setLastPrice(t){!this.draft||t===this.lastPrice||(this.lastPrice=t,this.check())}destroy(){this.close(),this.backdrop.remove()}place(){const t=this.draft;!t||Sn(t,this.lastPrice,this.rules).length>0||(this.callbacks.onSubmit(gc(t,this.lastPrice)),this.close())}set(t,e=!1){this.draft&&(this.draft={...this.draft,...t},e?this.render():this.check())}render(){var a;const t=this.draft;if(!t)return;const e=document.activeElement,r=e instanceof HTMLElement&&this.body.contains(e)?e.dataset.ticketField:void 0;this.body.replaceChildren(this.sideToggle(t.side),I(this.t("ticket.type"),Gt("type",X(["market","limit","stop"].map(o=>({value:o,label:this.t(`ticket.type.${o}`)})),t.type,o=>this.set({type:o},!0)))),I(this.t("ticket.quantity"),Gt("quantity",this.number(t.quantity,o=>this.set({quantity:o}))))),t.type!=="market"&&this.body.append(I(this.t("ticket.price"),Gt("price",this.number(t.price,o=>this.set({price:o})))),I(this.t("ticket.timeInForce"),Gt("timeInForce",X(["gtc","day"].map(o=>({value:o,label:this.t(`ticket.tif.${o}`)})),t.timeInForce,o=>this.set({timeInForce:o})))));const n=t.type==="market"?this.lastPrice??t.price:t.price,s=o=>xc(n*(1+(t.side==="buy"?o:-o)/100),n);this.body.append(this.optionalPrice("ticket.stopLoss",t.stopLoss,s(-1),o=>this.set({stopLoss:o},o===null||t.stopLoss===null)),this.optionalPrice("ticket.takeProfit",t.takeProfit,s(2),o=>this.set({takeProfit:o},o===null||t.takeProfit===null))),r&&((a=this.body.querySelector(`[data-ticket-field="${r}"]`))==null||a.focus()),this.check()}sideToggle(t){const e=document.createElement("div");e.className="tcw-ticket-side",e.setAttribute("role","group");for(const r of["buy","sell"]){const n=document.createElement("button");n.type="button",n.className=`tcw-ticket-side-btn tcw-ticket-${r}`,n.textContent=this.t(`ticket.${r}`),n.setAttribute("aria-pressed",String(t===r)),n.dataset.ticketField=`side-${r}`,n.addEventListener("click",()=>this.set({side:r},!0)),e.appendChild(n)}return e}number(t,e){const r=document.createElement("input");return r.type="number",r.className="tcw-indi-input",r.step="any",r.min="0",r.value=String(t),r.addEventListener("input",()=>e(r.value.trim()===""?NaN:Number(r.value))),r}optionalPrice(t,e,r,n){const s=document.createElement("div");s.className="tcw-settings-row tcw-ticket-optional";const a=document.createElement("span");a.textContent=this.t(t);const o=or(e!==null,c=>n(c?r:null));if(o.setAttribute("aria-label",this.t(t)),o.dataset.ticketField=`${t}-switch`,s.append(a,o),e!==null){const c=this.number(e,l=>n(Number.isFinite(l)?l:NaN));c.setAttribute("aria-label",this.t(t)),c.dataset.ticketField=t,s.appendChild(c)}return s}check(){const t=this.draft;if(!t)return;const e=Sn(t,this.lastPrice,this.rules),r=e.map(s=>this.problemText(s)),n=bc(t,this.lastPrice);e.length===0&&n!==null&&r.push(S(this.t("ticket.riskReward"),{rr:n.toFixed(2)})),this.problemsEl.replaceChildren(...r.map(s=>{const a=document.createElement("p");return a.textContent=s,a})),this.problemsEl.classList.toggle("tcw-ticket-bad",e.length>0),this.submit.disabled=e.length>0,this.submit.classList.toggle("tcw-ticket-sell",t.side==="sell"),this.submit.textContent=this.t(t.side==="buy"?"ticket.placeBuy":"ticket.placeSell")}problemText(t){const e=this.t(`ticket.problem.${t}`),{limits:r,lot:n}=this.rules;return t==="priceLimits"&&r?S(e,{floor:this.callbacks.formatPrice(r.floor),ceiling:this.callbacks.formatPrice(r.ceiling)}):t==="lot"?S(e,{lot:n??1}):e}}function Gt(i,t){return t.dataset.ticketField=i,t}function xc(i,t){const e=Math.abs(t),r=e>=10||e===0?2:e>=1?4:Math.min(10,Math.ceil(-Math.log10(e))+3);return Number(i.toFixed(r))}let kc=0;class qe{constructor(t,e=D){d(this,"backdrop");d(this,"titleEl");d(this,"input");d(this,"submit");d(this,"request",null);d(this,"returnFocus",null);d(this,"busy",!1);d(this,"uid",++kc);this.t=e,this.backdrop=document.createElement("div"),this.backdrop.className="tcw-modal-backdrop",this.backdrop.hidden=!0;let r=!1;this.backdrop.addEventListener("pointerdown",m=>{r=m.target===this.backdrop}),this.backdrop.addEventListener("click",m=>{m.target===this.backdrop&&r&&this.close(),r=!1});const n=document.createElement("form");n.className="tcw-modal tcw-modal-narrow tcw-name-prompt",n.noValidate=!0,n.setAttribute("role","dialog"),n.setAttribute("aria-modal","true"),n.setAttribute("aria-labelledby",`tcw-name-title-${this.uid}`),n.addEventListener("keydown",m=>{if(m.key==="Escape"){m.stopPropagation(),this.close();return}lt(m,n)}),n.addEventListener("submit",m=>{m.preventDefault(),this.done()});const s=document.createElement("div");s.className="tcw-modal-header",this.titleEl=document.createElement("h3"),this.titleEl.id=`tcw-name-title-${this.uid}`;const a=document.createElement("button");a.type="button",a.className="tcw-modal-close",a.setAttribute("aria-label",this.t("common.close")),a.innerHTML=b("x",16),a.addEventListener("click",()=>this.close()),s.append(this.titleEl,a);const o=document.createElement("div");o.className="tcw-modal-body";const c=document.createElement("label");c.className="tcw-name-field";const l=document.createElement("span");l.textContent=this.t("layouts.name"),this.input=document.createElement("input"),this.input.type="text",this.input.className="tcw-indi-input",this.input.maxLength=ai,this.input.autocomplete="off",this.input.spellcheck=!1,this.input.placeholder=this.t("layouts.namePlaceholder"),this.input.addEventListener("input",()=>this.check()),c.append(l,this.input),o.appendChild(c);const h=document.createElement("div");h.className="tcw-modal-footer";const p=document.createElement("button");p.type="button",p.className="tcw-reset-link",p.textContent=this.t("common.cancel"),p.addEventListener("click",()=>this.close()),this.submit=document.createElement("button"),this.submit.type="submit",this.submit.className="tcw-done-btn",h.append(p,this.submit),n.append(s,o,h),this.backdrop.appendChild(n),t.appendChild(this.backdrop)}open(t){var e;this.isOpen()||(this.returnFocus=document.activeElement instanceof HTMLElement?document.activeElement:null),this.request=t,this.busy=!1,this.titleEl.textContent=t.title,this.submit.textContent=t.submitLabel,this.input.value=t.value??"",this.input.placeholder=t.placeholder??this.t("layouts.namePlaceholder"),this.check(),(e=this.backdrop.parentElement)==null||e.appendChild(this.backdrop),this.backdrop.hidden=!1,this.input.focus(),this.input.select()}close(){var t;this.backdrop.hidden||(this.backdrop.hidden=!0,this.request=null,(t=this.returnFocus)!=null&&t.isConnected&&this.returnFocus.focus(),this.returnFocus=null)}isOpen(){return!this.backdrop.hidden}destroy(){this.close(),this.backdrop.remove()}check(){this.submit.disabled=this.busy||Er(this.input.value)===null}async done(){const t=this.request,e=Er(this.input.value);if(!(!t||e===null||this.busy)){this.busy=!0,this.check();try{await t.onSubmit(e),this.request===t&&this.close()}catch{}finally{this.busy=!1,this.check()}}}}let Sc=0;class Ec{constructor(t,e,r=D){d(this,"backdrop");d(this,"search");d(this,"listEl");d(this,"layouts",[]);d(this,"confirming",null);d(this,"returnFocus",null);d(this,"loadSeq",0);d(this,"uid",++Sc);this.callbacks=e,this.t=r,this.backdrop=document.createElement("div"),this.backdrop.className="tcw-modal-backdrop",this.backdrop.hidden=!0;let n=!1;this.backdrop.addEventListener("pointerdown",h=>{n=h.target===this.backdrop}),this.backdrop.addEventListener("click",h=>{h.target===this.backdrop&&n&&this.close(),n=!1});const s=document.createElement("div");s.className="tcw-modal tcw-modal-narrow tcw-layouts-dialog",s.setAttribute("role","dialog"),s.setAttribute("aria-modal","true"),s.setAttribute("aria-labelledby",`tcw-layouts-title-${this.uid}`),s.addEventListener("keydown",h=>{if(h.key!=="Escape"){lt(h,s);return}h.stopPropagation(),this.confirming?this.setConfirming(null):this.close()});const a=document.createElement("div");a.className="tcw-modal-header";const o=document.createElement("h3");o.id=`tcw-layouts-title-${this.uid}`,o.textContent=this.t("layouts.dialogTitle");const c=document.createElement("button");c.type="button",c.className="tcw-modal-close",c.setAttribute("aria-label",this.t("common.close")),c.innerHTML=b("x",16),c.addEventListener("click",()=>this.close()),a.append(o,c),this.search=document.createElement("input"),this.search.type="search",this.search.className="tcw-indi-input tcw-layouts-search",this.search.placeholder=this.t("layouts.search"),this.search.setAttribute("aria-label",this.t("layouts.search")),this.search.addEventListener("input",()=>this.render()),this.listEl=document.createElement("div"),this.listEl.className="tcw-layouts-list",this.listEl.setAttribute("role","list");const l=document.createElement("div");l.className="tcw-modal-body tcw-layouts-body",l.append(this.search,this.listEl),s.append(a,l),this.backdrop.appendChild(s),t.appendChild(this.backdrop)}async open(){this.isOpen()||(this.returnFocus=document.activeElement instanceof HTMLElement?document.activeElement:null),this.search.value="",this.confirming=null,this.backdrop.hidden=!1,this.search.focus(),await this.refresh()}async refresh(){const t=++this.loadSeq;let e;try{e=await this.callbacks.list()}catch{e=[]}t===this.loadSeq&&(this.layouts=e,this.render())}close(){var t;this.backdrop.hidden||(this.backdrop.hidden=!0,this.confirming=null,(t=this.returnFocus)!=null&&t.isConnected&&this.returnFocus.focus(),this.returnFocus=null)}isOpen(){return!this.backdrop.hidden}destroy(){this.close(),this.backdrop.remove()}shown(){const t=this.search.value.trim().toLowerCase();return t?this.layouts.filter(e=>e.name.toLowerCase().includes(t)||(e.symbol??"").toLowerCase().includes(t)):this.layouts}render(){const t=this.shown();if(t.length===0){const r=document.createElement("p");r.className="tcw-account-empty",r.textContent=this.t(this.layouts.length===0?"layouts.empty":"layouts.noMatch"),this.listEl.replaceChildren(r);return}const e=this.callbacks.currentId();this.listEl.replaceChildren(...t.map(r=>this.row(r,r.id===e)))}row(t,e){const r=document.createElement("div");r.className="tcw-layouts-row",r.setAttribute("role","listitem"),r.dataset.id=t.id;const n=document.createElement("button");n.type="button",n.className="tcw-layouts-open",e&&n.setAttribute("aria-current","true");const s=document.createElement("span");s.className="tcw-layouts-name",s.textContent=t.name;const a=document.createElement("span");if(a.className="tcw-layouts-meta",a.textContent=[[t.symbol,t.timeframe].filter(Boolean).join(" · "),S(this.t("layouts.updated"),{time:this.callbacks.formatTime(t.updatedAt)})].filter(Boolean).join(" — "),n.append(s,a),e){const c=document.createElement("span");c.className="tcw-tag",c.textContent=this.t("layouts.current"),s.appendChild(c)}n.addEventListener("click",()=>{this.callbacks.onOpen(t.id),this.close()});const o=document.createElement("div");if(o.className="tcw-account-actions",this.confirming===t.id){const c=document.createElement("button");c.type="button",c.className="tcw-layouts-confirm",c.textContent=this.t("layouts.deleteConfirm"),c.setAttribute("aria-label",S(this.t("layouts.deleteNamed"),{name:t.name})),c.addEventListener("click",()=>void this.remove(t.id));const l=this.iconButton("x",this.t("common.cancel"),()=>this.setConfirming(null));o.append(c,l)}else o.append(this.iconButton("penLine",S(this.t("layouts.renameNamed"),{name:t.name}),()=>this.callbacks.onRename(t)),this.iconButton("trash",S(this.t("layouts.deleteNamed"),{name:t.name}),()=>this.setConfirming(t.id),!0));return r.append(n,o),r}iconButton(t,e,r,n=!1){const s=document.createElement("button");return s.type="button",s.className=`tcw-tree-btn${n?" tcw-tree-del":""}`,s.setAttribute("aria-label",e),s.title=e,s.innerHTML=b(t,14),s.addEventListener("click",r),s}setConfirming(t){var s;const e=this.confirming;this.confirming=t,this.render();const r=t??e;if(!r)return;const n=[...this.listEl.querySelectorAll(".tcw-layouts-row")].find(a=>a.dataset.id===r);(s=n==null?void 0:n.querySelector(t?".tcw-layouts-confirm":".tcw-tree-del"))==null||s.focus()}async remove(t){try{await this.callbacks.onDelete(t)}finally{this.confirming=null,await this.refresh(),this.isOpen()&&this.search.focus()}}}const Cc=5;class Ss{constructor(t,e){d(this,"menu");d(this,"prompt");d(this,"dialog");d(this,"destroyed",!1);this.session=t,this.host=e;const{root:r,t:n}=e;this.menu=new W(r,n("toolbar.layouts")),this.prompt=new qe(r,n),this.dialog=new Ec(r,{list:()=>t.list(),currentId:()=>{var s;return((s=t.current())==null?void 0:s.id)??null},onOpen:s=>void this.open(s),onRename:s=>this.promptRename(s),onDelete:async s=>{try{await t.remove(s)}catch{this.host.toast(n("layouts.deleteFailed"),"error")}},formatTime:e.formatTime},n)}async save(){if(this.prompt.isOpen())return;if(!this.session.current()){this.promptSaveAs();return}const{t,toast:e}=this.host;try{const r=await this.session.save();r&&e(S(t("layouts.saved"),{name:r.name}))}catch{e(t("layouts.saveFailed"),"error")}}async open(t){try{if(await this.session.open(t))return!0}catch{}return this.destroyed||this.host.toast(this.host.t("layouts.openFailed"),"error"),!1}promptSaveAs(){const{t,toast:e}=this.host,r=this.session.current();this.prompt.open({title:t("layouts.saveAsTitle"),value:r?S(t("layouts.copyName"),{name:r.name}):"",submitLabel:t("common.save"),onSubmit:async n=>{try{const s=await this.session.saveAs(n);e(S(t("layouts.saved"),{name:s.name}))}catch(s){throw e(t("layouts.saveFailed"),"error"),s}}})}promptRename(t=this.session.current()){if(!t)return;const{t:e,toast:r}=this.host;this.prompt.open({title:e("layouts.renameTitle"),value:t.name,submitLabel:e("layouts.renameSubmit"),onSubmit:async n=>{try{await this.session.rename(t.id,n)}catch(s){throw r(e("layouts.saveFailed"),"error"),s}this.dialog.isOpen()&&this.dialog.refresh()}})}openDialog(){return this.dialog.open()}async openMenu(t){if(this.menu.isOpen()){this.menu.close();return}const{session:e}=this,{t:r,root:n}=this.host;let s=[];try{s=(await e.list()).slice(0,Cc)}catch{}if(this.destroyed)return;const a=e.current(),o=[{id:"save",label:r("layouts.save"),icon:"save"},{id:"saveAs",label:r("layouts.saveAs"),icon:"plus"}];a&&o.push({id:"rename",label:r("layouts.rename"),icon:"penLine"}),o.push({id:"autoSave",label:r("layouts.autoSave"),checked:e.isAutoSave()}),s.length>0&&o.push("separator",...s.map(h=>({id:`open:${h.id}`,label:h.name,checked:h.id===(a==null?void 0:a.id)}))),o.push("separator",{id:"manage",label:r("layouts.open"),icon:"folder"});const c=t.getBoundingClientRect(),l=n.getBoundingClientRect();this.menu.open(o,c.left-l.left,c.bottom-l.top+2,h=>{h==="save"?this.save():h==="saveAs"?this.promptSaveAs():h==="rename"?this.promptRename():h==="autoSave"?e.setAutoSave(!e.isAutoSave()):h==="manage"?this.openDialog():h.startsWith("open:")&&this.open(h.slice(5))},t)}destroy(){this.destroyed=!0,this.menu.destroy(),this.prompt.destroy(),this.dialog.destroy()}}let Tc=0;class Lc{constructor(t,e,r){d(this,"el");d(this,"input");d(this,"hint");d(this,"returnFocus",null);this.labels=e,this.onApply=r,this.el=document.createElement("div"),this.el.className="tcw-interval-input",this.el.hidden=!0,this.el.setAttribute("role","dialog"),this.el.setAttribute("aria-label",e.title),this.input=document.createElement("input"),this.input.type="text",this.input.className="tcw-interval-field",this.input.autocomplete="off",this.input.spellcheck=!1,this.input.maxLength=6,this.input.setAttribute("aria-label",e.title),this.hint=document.createElement("div"),this.hint.className="tcw-interval-hint",this.hint.setAttribute("role","status"),this.hint.id=`tcw-interval-hint-${++Tc}`,this.input.setAttribute("aria-describedby",this.hint.id),this.el.append(this.input,this.hint),t.appendChild(this.el),this.input.addEventListener("input",()=>this.check()),this.input.addEventListener("keydown",n=>{n.key==="Enter"?(n.preventDefault(),n.stopPropagation(),this.apply()):n.key==="Escape"&&(n.preventDefault(),n.stopPropagation(),this.close())}),this.input.addEventListener("blur",()=>this.close(!1))}open(t){this.isOpen()||(this.returnFocus=document.activeElement instanceof HTMLElement?document.activeElement:null),this.el.hidden=!1,this.input.value=t,this.check(),this.input.focus(),this.input.setSelectionRange(t.length,t.length)}close(t=!0){if(this.el.hidden)return;this.el.hidden=!0;const e=this.returnFocus;this.returnFocus=null,t&&(e!=null&&e.isConnected)&&e.focus({preventScroll:!0})}isOpen(){return!this.el.hidden}destroy(){this.el.remove()}check(){const t=_e(this.input.value)!==null;!t&&this.input.value.trim()!==""?this.input.setAttribute("aria-invalid","true"):this.input.removeAttribute("aria-invalid"),this.hint.textContent=t||this.input.value.trim()===""?this.labels.hint:this.labels.invalid}apply(){const t=_e(this.input.value);if(t&&this.onApply(t)){this.close();return}this.input.setAttribute("aria-invalid","true"),this.hint.textContent=this.labels.invalid}}const En=60;class Ac{constructor(t="tcw:indicator-templates"){this.key=t}list(){let t;try{t=JSON.parse(localStorage.getItem(this.key)??"[]")}catch{return[]}if(!Array.isArray(t))return[];const e=[];for(const r of t){if(typeof r!="object"||r===null)continue;const{name:n,indicators:s}=r;if(typeof n!="string"||!n.trim()||!Array.isArray(s))continue;const a=Vs.deserialize(JSON.stringify({version:2,indicators:s})).indicators;a.length>0&&e.push({name:n.slice(0,En),indicators:a})}return e.sort((r,n)=>r.name.localeCompare(n.name))}get(t){return this.list().find(e=>e.name===t)??null}save(t,e){const r=t.replace(/\s+/g," ").trim().slice(0,En);if(!r)throw new Error("A template needs a name");const n=[...this.list().filter(s=>s.name!==r),{name:r,indicators:[...e]}];localStorage.setItem(this.key,JSON.stringify(n))}remove(t){try{localStorage.setItem(this.key,JSON.stringify(this.list().filter(e=>e.name!==t)))}catch{}}}const Nt=[];let ct=null;function Es(i){const t=()=>{ct=i};return i.addEventListener("pointerdown",t,!0),Nt.push(i),()=>{i.removeEventListener("pointerdown",t,!0);const e=Nt.indexOf(i);e>=0&&Nt.splice(e,1),ct===i&&(ct=null)}}function Ct(i,t=!1){let e=ct!=null&&ct.isConnected?ct:null;if(!e){const r=document.activeElement;e=r?Nt.find(n=>n.contains(r))??null:null}return!e&&!t&&(e=Nt.find(r=>r.isConnected)??null),e!==null&&i.contains(e)}function nt(){const i=document.activeElement;return!!i&&(i.tagName==="INPUT"||i.tagName==="TEXTAREA"||i.tagName==="SELECT"||i.isContentEditable)}const Nc=["regular","logarithmic","percentage","indexedTo100"],Cn=i=>typeof i=="object"&&i!==null&&!Array.isArray(i);function Ge(i){const{theme:t,timestamp:e,...r}=i;return r}function Cs(i){return!Cn(i)||i.v!==1||typeof i.symbol!="string"||!i.symbol||typeof i.timeframe!="string"||!(Hn(i.timeframe)||gt(i.timeframe)!==null)?null:{v:1,symbol:i.symbol,timeframe:i.timeframe,scaleMode:Nc.find(t=>t===i.scaleMode)??"regular",invertScale:i.invertScale===!0,chart:Cn(i.chart)?Ge(i.chart):null}}function Ye(i){try{return JSON.parse(i)}catch{return null}}function Mc(){try{return typeof localStorage<"u"?localStorage:null}catch{return null}}class Yt{constructor(t="tcw:draw-favorites",e=Mc()){d(this,"favorites",[]);this.storageKey=t,this.storage=e,this.load()}list(){return[...this.favorites]}has(t){return this.favorites.includes(t)}add(t){!t||this.favorites.includes(t)||(this.favorites=[...this.favorites,t],this.persist())}remove(t){this.favorites.includes(t)&&(this.favorites=this.favorites.filter(e=>e!==t),this.persist())}toggle(t){return this.has(t)?(this.remove(t),!1):(this.add(t),!0)}seedDefaults(t){this.favorites.length>0||(this.favorites=[...new Set(t.filter(Boolean))],this.persist())}load(){if(this.storage)try{const t=this.storage.getItem(this.storageKey);if(!t)return;const e=JSON.parse(t);Array.isArray(e)&&(this.favorites=[...new Set(e.filter(r=>typeof r=="string"))])}catch{}}persist(){if(this.storage)try{this.storage.setItem(this.storageKey,JSON.stringify(this.favorites))}catch{}}}function Ic(i){const t=typeof window<"u"?window.visualViewport:null;if(!t)return()=>{};let e=-1;const r=()=>{const s=(t.scale??1)>1.01?0:Math.max(0,Math.round(window.innerHeight-t.height-t.offsetTop));if(s!==e){e=s;for(const a of i)a.style.setProperty("--tcw-keyboard-inset",`${s}px`)}};return r(),t.addEventListener("resize",r),t.addEventListener("scroll",r),()=>{t.removeEventListener("resize",r),t.removeEventListener("scroll",r)}}const Pc=641;function Ts(i,t){let e=null;const r=()=>{const s=i.clientWidth;if(s===0&&e!==null)return;const a=s<Pc;a!==e&&(e=a,i.toggleAttribute("data-tcw-narrow",a),t==null||t(a))};if(r(),typeof ResizeObserver>"u")return()=>{};const n=new ResizeObserver(r);return n.observe(i),()=>n.disconnect()}const Dc=/^(\d{4})-(\d{2})-(\d{2})$/,Bc=/^(\d{2}):(\d{2})$/;function Tn(i,t,e){const r=Dc.exec(i),n=t?Bc.exec(t):["","00","00"];if(!r||!n)return null;const[s,a,o,c,l]=[+r[1],+r[2],+r[3],+n[1],+n[2]];if(a<1||a>12||o<1||o>31||c>23||l>59)return null;const h=Date.UTC(s,a-1,o,c,l);return new Date(h).getUTCDate()!==o?null:Ks(h,e)}function Q(i,t){const e=n=>String(n).padStart(2,"0"),r=qs(i,t);return{date:`${r.year}-${e(r.month)}-${e(r.day)}`,time:`${e(r.hours)}:${e(r.minutes)}`}}class zc{constructor(t,e,r){d(this,"form",null);d(this,"returnFocus",null);d(this,"opener",null);d(this,"onOutside",t=>{var r;const e=t.target;this.form&&!this.form.contains(e)&&!((r=this.opener)!=null&&r.contains(e))&&this.close()});this.host=t,this.labels=e,this.onSubmit=r}isOpen(){return this.form!==null}open(t,e=null){this.close(),this.opener=e,this.returnFocus=document.activeElement;const r=document.createElement("form");r.className="tcw-goto",k(r,"goToDate"),r.setAttribute("role","dialog"),r.setAttribute("aria-label",this.labels.title);const n=document.createElement("div");n.className="tcw-goto-title",n.textContent=this.labels.title;const s=this.field(r,this.labels.date,"date",t.date);s.required=!0;const a=this.field(r,this.labels.time,"time",t.time),o=document.createElement("div");o.className="tcw-goto-actions";const c=document.createElement("button");c.type="button",c.className="tcw-btn",c.textContent=this.labels.cancel,c.addEventListener("click",()=>this.close());const l=document.createElement("button");l.type="submit",l.className="tcw-btn tcw-goto-submit",l.textContent=this.labels.submit,o.append(c,l),r.prepend(n),r.append(o),r.addEventListener("submit",h=>{if(h.preventDefault(),!s.value)return;const p={date:s.value,time:a.value};this.close(),this.onSubmit(p)}),r.addEventListener("keydown",h=>{h.stopPropagation(),h.key==="Escape"&&this.close()}),this.host.appendChild(r),this.form=r,document.addEventListener("mousedown",this.onOutside),s.focus()}close(){if(!this.form)return;document.removeEventListener("mousedown",this.onOutside),this.form.remove(),this.form=null;const t=this.returnFocus;this.returnFocus=null,t!=null&&t.isConnected&&t.focus()}destroy(){this.close()}field(t,e,r,n){const s=document.createElement("label");s.className="tcw-goto-field";const a=document.createElement("span");a.textContent=e;const o=document.createElement("input");return o.type=r,o.value=n,o.className="tcw-goto-input",s.append(a,o),t.appendChild(s),o}}const Oc=300,Fc=500,rt=8,Xt=4,Jt=3,Rc='[title]:not([title=""]), [data-tip]:not([data-tip=""])';class $c{constructor(t){d(this,"el");d(this,"target",null);d(this,"source",null);d(this,"pressed",null);d(this,"showTimer",null);d(this,"watchFrame",0);d(this,"warmUntil",0);d(this,"observer");d(this,"onOver",t=>{if(t.pointerType==="touch")return;const e=this.tipTarget(t.target);!e||e===this.pressed||e===this.target&&this.source==="pointer"||(Be(e),this.schedule(e,"pointer",Date.now()<this.warmUntil||this.isVisible()))});d(this,"onOut",t=>{const e=t.relatedTarget,r=n=>!!n&&!!e&&n.contains(e);this.pressed&&!r(this.pressed)&&(kt(this.pressed),this.pressed=null),this.source==="pointer"&&!r(this.target)&&this.hide()});d(this,"onPress",()=>{const t=this.target,e=this.source==="pointer";this.warmUntil=0,this.clearTimer(),cancelAnimationFrame(this.watchFrame),this.el.classList.remove("tcw-tooltip--visible"),this.target=null,this.source=null,this.pressed&&this.pressed!==t&&kt(this.pressed),this.pressed=e?t:null});d(this,"onFocus",t=>{const e=this.tipTarget(t.target);!e||!Wc(e)||e===this.pressed||this.schedule(e,"focus",!0)});d(this,"onBlur",t=>{if(this.source!=="focus")return;const e=t.relatedTarget;this.target&&e&&this.target.contains(e)||this.hide()});d(this,"hide",()=>{this.clearTimer(),cancelAnimationFrame(this.watchFrame),this.isVisible()&&(this.warmUntil=Date.now()+Fc),this.el.classList.remove("tcw-tooltip--visible"),this.target&&this.source==="pointer"&&kt(this.target),this.target=null,this.source=null});this.root=t,this.el=document.createElement("div"),this.el.className="tcw-tooltip",this.el.setAttribute("aria-hidden","true"),t.appendChild(this.el),t.addEventListener("pointerover",this.onOver),t.addEventListener("pointerout",this.onOut),t.addEventListener("pointerdown",this.onPress,!0),t.addEventListener("keydown",this.onPress,!0),t.addEventListener("focusin",this.onFocus),t.addEventListener("focusout",this.onBlur),t.addEventListener("wheel",this.hide,{passive:!0}),this.observer=new MutationObserver(()=>{var r;(r=this.pressed)!=null&&r.hasAttribute("title")&&Be(this.pressed);const e=this.target;!e||this.source!=="pointer"||!e.hasAttribute("title")||(Be(e),this.isVisible()&&this.show(e))}),this.observer.observe(t,{subtree:!0,attributes:!0,attributeFilter:["title"]})}destroy(){this.hide(),this.pressed&&kt(this.pressed),this.observer.disconnect(),this.root.removeEventListener("pointerover",this.onOver),this.root.removeEventListener("pointerout",this.onOut),this.root.removeEventListener("pointerdown",this.onPress,!0),this.root.removeEventListener("keydown",this.onPress,!0),this.root.removeEventListener("focusin",this.onFocus),this.root.removeEventListener("focusout",this.onBlur),this.root.removeEventListener("wheel",this.hide),this.el.remove()}tipTarget(t){if(!(t instanceof Element))return null;const e=t.closest(Rc);return e&&e!==this.el&&this.root.contains(e)?e:null}schedule(t,e,r){const n=this.target;if(this.clearTimer(),cancelAnimationFrame(this.watchFrame),n&&n!==t&&this.source==="pointer"&&kt(n),this.target=t,this.source=e,r){this.show(t);return}this.el.classList.remove("tcw-tooltip--visible"),this.showTimer=setTimeout(()=>{this.showTimer=null,this.target===t&&this.show(t)},Oc)}show(t){if(!Ln(t)){this.hide();return}this.el.textContent=Hc(t),this.place(t),this.el.classList.add("tcw-tooltip--visible"),this.watch(t)}watch(t){cancelAnimationFrame(this.watchFrame),this.watchFrame=requestAnimationFrame(()=>{this.target===t&&(Ln(t)?this.watch(t):this.hide())})}place(t){const e=this.root.getBoundingClientRect(),r=t.getBoundingClientRect(),n=this.el.offsetWidth,s=this.el.offsetHeight,a=r.left-e.left,o=r.top-e.top;let c=_c(t);c==="bottom"&&o+r.height+rt+s>e.height?c="top":c==="top"&&o-rt-s<0?c="bottom":c==="right"&&a+r.width+rt+n>e.width&&(c="left");let l,h;c==="top"||c==="bottom"?(l=a+r.width/2-n/2,h=c==="bottom"?o+r.height+rt:o-rt-s):(l=c==="right"?a+r.width+rt:a-rt-n,h=o+r.height/2-s/2),l=Math.max(Xt,Math.min(e.width-n-Xt,l)),h=Math.max(Xt,Math.min(e.height-s-Xt,h)),this.el.style.left=`${Math.round(l)}px`,this.el.style.top=`${Math.round(h)}px`;const p={top:[0,Jt],bottom:[0,-Jt],left:[Jt,0],right:[-Jt,0]}[c];this.el.style.setProperty("--tcw-tip-dx",`${p[0]}px`),this.el.style.setProperty("--tcw-tip-dy",`${p[1]}px`),this.el.dataset.side=c}isVisible(){return this.el.classList.contains("tcw-tooltip--visible")}clearTimer(){this.showTimer!==null&&(clearTimeout(this.showTimer),this.showTimer=null)}}function Be(i){const t=i.getAttribute("title");t!==null&&(i.dataset.tip=t,i.removeAttribute("title"))}function kt(i){i.dataset.tip!==void 0&&!i.hasAttribute("title")&&(i.setAttribute("title",i.dataset.tip),delete i.dataset.tip)}function Hc(i){return i.dataset.tip??i.getAttribute("title")??""}function Ln(i){return i.isConnected&&i.getClientRects().length>0&&!i.disabled}function Wc(i){try{return i.matches(":focus-visible")}catch{return!1}}function _c(i){const t=i.dataset.tipSide;return t||(i.closest(".tcw-sidebar")?"right":i.closest(".tcw-statusbar, .tcw-replay-bar")?"top":"bottom")}const Uc=2;class jc{constructor(t,e,r){d(this,"stack");d(this,"toggle");d(this,"rows",new Map);d(this,"panes",new Map);d(this,"collapsed",!1);d(this,"toggleKey","");d(this,"stackKey","");this.host=t,this.callbacks=e,this.labels=r,this.stack=document.createElement("div"),this.stack.className="tcw-ind-legend",k(this.stack,"indicatorLegend"),this.toggle=document.createElement("button"),this.toggle.type="button",this.toggle.className="tcw-ind-legend-toggle",this.toggle.addEventListener("click",()=>{this.setCollapsed(!this.collapsed),this.renderToggle(this.overlayCount())}),this.stack.appendChild(this.toggle),t.appendChild(this.stack)}update(t,e,r=[]){this.updatePanes(r);const n=`${Math.round(e.left)},${Math.round(e.top)}`;n!==this.stackKey&&(this.stackKey=n,this.stack.style.left=`${Math.round(e.left)}px`,this.stack.style.top=`${Math.round(e.top)}px`);const s=new Set;let a=!1;for(const o of t){s.add(o.instanceId);const c=this.rows.get(o.instanceId)??this.createRow(o.instanceId);this.fill(c,o),o.pane?c.el.parentElement!==this.host&&this.host.appendChild(c.el):c.el.parentElement!==this.stack&&(this.stack.insertBefore(c.el,this.toggle),a=!0),this.place(c,o.pane)}for(const[o,c]of this.rows)s.has(o)||(c.el.remove(),this.rows.delete(o));a&&this.collapsed&&this.setCollapsed(!1),this.renderToggle(t.filter(o=>!o.pane).length)}destroy(){for(const t of this.rows.values())t.el.remove();this.rows.clear();for(const t of this.panes.values())t.el.remove();this.panes.clear(),this.stack.remove()}updatePanes(t){if(!this.callbacks.onPaneAction)return;const e=new Set;for(const r of t){e.add(r.instanceId);const n=this.panes.get(r.instanceId)??this.createPane(r.instanceId),s=`${Math.round(r.x)},${Math.round(r.y)}|${r.label}|${r.collapsed}|${r.maximized}|${r.canMoveUp}|${r.canMoveDown}`;if(s===n.key)continue;n.key=s,n.el.style.left=`${Math.round(r.x)}px`,n.el.style.top=`${Math.round(r.y)}px`;const a=this.labels,o=(c,l,h,p)=>{const m=n.buttons.get(c);!l&&document.activeElement===m&&n.buttons.get("max").focus(),m.hidden=!l,m.innerHTML=b(h,12),ut(m,p??c,r.label)};o("up",r.canMoveUp&&!r.maximized,"arrowUp",a.paneUp),o("down",r.canMoveDown&&!r.maximized,"arrowDown",a.paneDown),o("fold",!r.maximized,r.collapsed?"chevronDown":"chevronUp",r.collapsed?a.paneExpand:a.paneCollapse),o("max",!0,r.maximized?"minimize":"maximize",r.maximized?a.paneRestore:a.paneMaximize),n.el.dataset.collapsed=String(r.collapsed),n.el.dataset.maximized=String(r.maximized)}for(const[r,n]of this.panes)e.has(r)||(n.el.remove(),this.panes.delete(r))}createPane(t){const e=document.createElement("div");e.className="tcw-pane-controls",k(e,"indicatorLegend"),e.dataset.instance=t;const r=new Map,n=o=>o==="up"||o==="down"?o:o==="fold"?e.dataset.collapsed==="true"?"expand":"collapse":e.dataset.maximized==="true"?"restore":"maximize",s={up:"pane.move",down:"pane.move",fold:"pane.collapse",max:"pane.maximize"};for(const o of["up","down","fold","max"]){const c=document.createElement("button");c.type="button",c.className="tcw-pane-btn",c.dataset.act=o,k(c,s[o]),c.addEventListener("click",()=>{var l,h;return(h=(l=this.callbacks).onPaneAction)==null?void 0:h.call(l,t,n(o))}),r.set(o,c),e.appendChild(c)}this.host.appendChild(e);const a={el:e,buttons:r,key:""};return this.panes.set(t,a),a}createRow(t){const e=document.createElement("div");e.className="tcw-ind-legend-row",k(e,"indicatorLegend"),e.dataset.instance=t;const r=document.createElement("button");r.type="button",r.className="tcw-ind-legend-name",r.addEventListener("click",()=>this.callbacks.onSettings(t));const n=document.createElement("span");n.className="tcw-ind-legend-values",k(n,"indicatorLegend.values");const s=document.createElement("span");s.className="tcw-ind-legend-actions";const a=(m,f,g,...v)=>{const y=document.createElement("button");return y.type="button",y.className="tcw-ind-legend-act",y.dataset.act=m,k(y,...v),y.innerHTML=b(f,13),y.addEventListener("click",g),s.appendChild(y),y},o=a("visible","eye",()=>{this.callbacks.onToggleVisible(t,!p.visible)},"indicatorLegend.visibility"),c=a("settings","settings",()=>this.callbacks.onSettings(t),"indicatorSettings","indicatorLegend.settings"),l=this.callbacks.onMore?a("more","more",()=>{var m,f;return(f=(m=this.callbacks).onMore)==null?void 0:f.call(m,t,l)},"indicatorLegend.more"):null,h=a("remove","x",()=>this.callbacks.onRemove(t),"indicatorLegend.remove");e.append(r,n,s);const p={el:e,name:r,values:n,eye:o,settings:c,more:l,remove:h,visible:!0,valuesKey:"",state:"",placeKey:""};return this.rows.set(t,p),p}fill(t,e){const r=`${e.label}|${e.visible}|${!!e.offInterval}`;r!==t.state&&(t.state=r,t.visible=e.visible,t.name.textContent=e.label,t.name.title=this.labels.settings,t.el.classList.toggle("tcw-ind-legend-row--hidden",!e.visible||!!e.offInterval),e.offInterval&&this.labels.offInterval?t.el.title=this.labels.offInterval:t.el.removeAttribute("title"),t.eye.innerHTML=b(e.visible?"eye":"eyeOff",13),ut(t.eye,e.visible?this.labels.hide:this.labels.show,e.label),ut(t.settings,this.labels.settings,e.label),t.more&&(ut(t.more,this.labels.more??"More",e.label),t.more.setAttribute("aria-haspopup","menu")),ut(t.remove,this.labels.remove,e.label));const n=e.values.map(s=>`${s.text}${s.color??""}`).join("");n!==t.valuesKey&&(t.valuesKey=n,t.values.replaceChildren(...e.values.map(s=>{const a=document.createElement("span");return a.textContent=s.text,s.color&&(a.style.color=s.color),a})))}place(t,e){const r=e?`${Math.round(e.x)},${Math.round(e.y)},${Math.round(e.width)}`:"";r!==t.placeKey&&(t.placeKey=r,t.el.classList.toggle("tcw-ind-legend-row--pane",e!==null),t.el.style.left=e?`${Math.round(e.x)}px`:"",t.el.style.top=e?`${Math.round(e.y)}px`:"",t.el.style.maxWidth=e?`${Math.max(0,Math.round(e.width))}px`:"")}setCollapsed(t){this.collapsed=t,this.stack.classList.toggle("tcw-ind-legend--collapsed",t)}overlayCount(){return this.stack.querySelectorAll(":scope > .tcw-ind-legend-row").length}renderToggle(t){const e=t>=Uc;!e&&this.collapsed&&this.setCollapsed(!1);const r=`${e}|${this.collapsed}|${t}`;if(r===this.toggleKey||(this.toggleKey=r,this.toggle.hidden=!e,!e))return;const n=this.collapsed?this.labels.expand:this.labels.collapse;ut(this.toggle,n,this.collapsed?`(${t})`:void 0),this.toggle.setAttribute("aria-expanded",String(!this.collapsed));const s=b(this.collapsed?"chevronDown":"chevronUp",12);this.toggle.innerHTML=this.collapsed?`${s}<span>${t}</span>`:s}}function ut(i,t,e){i.title=t,i.setAttribute("aria-label",e?`${t} ${e}`:t)}function Vc(i,t,e,r){if(!t)return[];const n=i.plots;if(!n){const o=[];for(const l in t){const h=t[l];typeof h=="number"&&Number.isFinite(h)&&o.push(h)}const c=o.length===1?e[0]??null:null;return o.map(l=>({value:l,color:c}))}const s={colors:[...e]},a=[];for(const o of n){if(!Gs(o,{plots:r}))continue;const c=t[o.key];typeof c!="number"||!Number.isFinite(c)||a.push({value:c,color:e.length?Ys(o,s,t):null})}return a}const An=new Map;function Kc(i){let t=An.get(i);return t||(t=new Intl.NumberFormat(i,{notation:"compact",maximumFractionDigits:2}),An.set(i,t)),t}function qc(i,t="en-US"){return Math.abs(i)>=1e6?Kc(t).format(i):Xs(i,Js(i),t)}class Gc{constructor(t,e,r=D){d(this,"el");d(this,"labelEl");d(this,"callbacks");d(this,"visible",!1);this.t=r,this.callbacks=e,this.el=document.createElement("div"),this.el.className="tcw-bracket-bar",this.el.hidden=!0,this.labelEl=document.createElement("span"),this.labelEl.className="tcw-bracket-label",this.el.appendChild(this.labelEl);const n=document.createElement("span");n.className="tcw-bracket-hint",n.textContent=this.t("bracket.hint"),this.el.appendChild(n);const s=document.createElement("button");s.type="button",s.className="tcw-bracket-cancel",s.innerHTML=`${b("x",14)}<span>${T(this.t("common.cancel"))}</span>`,s.addEventListener("click",()=>this.callbacks.onCancel());const a=document.createElement("button");a.type="button",a.className="tcw-bracket-confirm",a.innerHTML=`${b("check",14)}<span>${T(this.t("bracket.place"))}</span>`,a.addEventListener("click",()=>this.callbacks.onConfirm()),this.el.appendChild(s),this.el.appendChild(a),t.appendChild(this.el)}show(t){this.visible=!0,this.labelEl.textContent=t==="buy"?this.t("toolbar.longBracket"):this.t("toolbar.shortBracket"),this.labelEl.dataset.side=t,this.el.hidden=!1}hide(){this.visible=!1,this.el.hidden=!0}isVisible(){return this.visible}destroy(){this.el.remove()}}class Yc{constructor(t={}){d(this,"options");d(this,"audioCtx",null);d(this,"audioEl",null);d(this,"permissionAsked",!1);if(this.options=t,typeof t.sound=="string")try{this.audioEl=new Audio(t.sound),this.audioEl.preload="auto"}catch{this.audioEl=null}t.desktop&&this.ensurePermission()}setOptions(t){this.options={...this.options,...t}}notify(t){this.options.sound&&this.playSound(),this.options.desktop&&this.showDesktop(t)}playSound(){if(this.audioEl){this.audioEl.currentTime=0,this.audioEl.play().catch(()=>{});return}this.beep()}beep(){try{const t=window.AudioContext??window.webkitAudioContext;if(!t)return;this.audioCtx||(this.audioCtx=new t);const e=this.audioCtx,r=e.currentTime,n=e.createGain();n.gain.setValueAtTime(1e-4,r),n.gain.exponentialRampToValueAtTime(.2,r+.01),n.gain.exponentialRampToValueAtTime(1e-4,r+.35),n.connect(e.destination);const s=e.createOscillator();s.type="sine",s.frequency.setValueAtTime(880,r),s.frequency.setValueAtTime(1320,r+.16),s.connect(n),s.start(r),s.stop(r+.36)}catch{}}ensurePermission(){this.permissionAsked||(this.permissionAsked=!0,!(typeof Notification>"u")&&Notification.permission==="default"&&Notification.requestPermission().catch(()=>{}))}showDesktop(t){if(!(typeof Notification>"u")){if(Notification.permission!=="granted"){this.ensurePermission();return}try{new Notification(this.options.title??"Price alert",{body:t})}catch{}}}destroy(){var t;try{(t=this.audioCtx)==null||t.close()}catch{}this.audioCtx=null,this.audioEl=null}}function Xc(i,t=12){const e=[...i.asks].sort((p,m)=>p.price-m.price).slice(0,t),r=[...i.bids].sort((p,m)=>m.price-p.price).slice(0,t),n=e.length>0?e[0].price:null,s=r.length>0?r[0].price:null,a=n!==null&&s!==null?(n+s)/2:null,o=new Map,c=p=>{let m=o.get(p);return m||(m={price:p,bidVolume:0,askVolume:0},o.set(p,m)),m};for(const p of e)c(p.price).askVolume+=p.volume;for(const p of r)c(p.price).bidVolume+=p.volume;const l=[...o.values()].sort((p,m)=>m.price-p.price);let h=0;for(const p of l)h=Math.max(h,p.bidVolume,p.askVolume);return{rows:l,maxVolume:h,mid:a}}class Jc{constructor(t,e,r=12,n=D){d(this,"el");d(this,"bodyEl");d(this,"callbacks");d(this,"open",!1);d(this,"levels");this.t=n,this.callbacks=e,this.levels=r,this.el=document.createElement("div"),this.el.className="tcw-ladder",k(this.el,"depthLadder"),this.el.hidden=!0;const s=document.createElement("div");s.className="tcw-ladder-header";const a=document.createElement("span");a.textContent=this.t("ladder.title");const o=document.createElement("button");o.type="button",o.className="tcw-ladder-close",o.setAttribute("aria-label",this.t("common.close")),o.innerHTML=b("x",14),o.addEventListener("click",()=>this.close()),s.appendChild(a),s.appendChild(o),this.el.appendChild(s);const c=document.createElement("div");c.className="tcw-ladder-cols",c.innerHTML=[this.t("ladder.bid"),this.t("ladder.price"),this.t("ladder.ask")].map(l=>`<span>${T(l)}</span>`).join(""),this.el.appendChild(c),this.bodyEl=document.createElement("div"),this.bodyEl.className="tcw-ladder-body",this.el.appendChild(this.bodyEl),t.appendChild(this.el)}isOpen(){return this.open}toggle(){this.open?this.close():this.openPanel()}openPanel(){var t,e;this.open=!0,this.el.hidden=!1,(e=(t=this.callbacks).onToggle)==null||e.call(t,!0)}close(){var t,e;this.open=!1,this.el.hidden=!0,(e=(t=this.callbacks).onToggle)==null||e.call(t,!1)}setData(t){if(!t){this.renderEmpty();return}this.render(Xc(t,this.levels))}destroy(){this.el.remove()}renderEmpty(){this.bodyEl.replaceChildren();const t=document.createElement("div");t.className="tcw-ladder-empty",t.textContent=this.t("ladder.empty"),this.bodyEl.appendChild(t)}render(t){if(this.bodyEl.replaceChildren(),t.rows.length===0){this.renderEmpty();return}const e=t.maxVolume>0?1/t.maxVolume:0;for(const r of t.rows){const n=r.askVolume>0,s=document.createElement("div");s.className="tcw-ladder-row";const a=document.createElement("button");a.type="button",a.className="tcw-ladder-cell tcw-ladder-bid",r.bidVolume>0?(a.textContent=Nn(r.bidVolume),a.style.setProperty("--w",`${(r.bidVolume*e*100).toFixed(1)}%`),a.title=S(this.t("ladder.sellAt"),{price:this.callbacks.formatPrice(r.price)}),a.addEventListener("click",()=>this.callbacks.onTrade("sell",r.price))):a.disabled=!0;const o=document.createElement("div");o.className=`tcw-ladder-price ${n?"tcw-ask":"tcw-bid"}`,o.textContent=this.callbacks.formatPrice(r.price);const c=document.createElement("button");c.type="button",c.className="tcw-ladder-cell tcw-ladder-ask",r.askVolume>0?(c.textContent=Nn(r.askVolume),c.style.setProperty("--w",`${(r.askVolume*e*100).toFixed(1)}%`),c.title=S(this.t("ladder.buyAt"),{price:this.callbacks.formatPrice(r.price)}),c.addEventListener("click",()=>this.callbacks.onTrade("buy",r.price))):c.disabled=!0,s.appendChild(a),s.appendChild(o),s.appendChild(c),this.bodyEl.appendChild(s)}}}function Nn(i){return i>=1e3?(i/1e3).toFixed(1)+"k":i>=1?i.toFixed(2).replace(/\.00$/,""):i.toPrecision(2)}class Zc{constructor(t,e,r=D){d(this,"el");d(this,"bodyEl");d(this,"callbacks");d(this,"open",!1);this.t=r,this.callbacks=e,this.el=document.createElement("div"),this.el.className="tcw-datawin",k(this.el,"dataWindow"),this.el.hidden=!0;const n=document.createElement("div");n.className="tcw-datawin-header";const s=document.createElement("span");s.textContent=this.t("dataWindow.title");const a=document.createElement("button");a.type="button",a.className="tcw-datawin-close",a.setAttribute("aria-label",this.t("common.close")),a.innerHTML=b("x",14),a.addEventListener("click",()=>this.close()),n.appendChild(s),n.appendChild(a),this.el.appendChild(n),this.bodyEl=document.createElement("div"),this.bodyEl.className="tcw-datawin-body",this.el.appendChild(this.bodyEl),t.appendChild(this.el)}isOpen(){return this.open}toggle(){this.open?this.close():this.openPanel()}openPanel(){this.open=!0,this.el.hidden=!1}close(){this.open=!1,this.el.hidden=!0}destroy(){this.el.remove()}render(t){if(!this.open)return;if(this.bodyEl.replaceChildren(),!t.ohlc){const a=document.createElement("div");a.className="tcw-datawin-empty",a.textContent=this.t("dataWindow.hover"),this.bodyEl.appendChild(a);return}const e=this.callbacks.formatPrice,r=t.ohlc;this.bodyEl.appendChild(this.row(this.t("dataWindow.open"),e(r.open))),this.bodyEl.appendChild(this.row(this.t("dataWindow.high"),e(r.high))),this.bodyEl.appendChild(this.row(this.t("dataWindow.low"),e(r.low))),this.bodyEl.appendChild(this.row(this.t("dataWindow.close"),e(r.close)));const n=t.change>0?"up":t.change<0?"down":"",s=t.change>0?"+":"";this.bodyEl.appendChild(this.row(this.t("dataWindow.change"),`${s}${e(t.change)} (${s}${t.changePct.toFixed(2)}%)`,n)),this.bodyEl.appendChild(this.row(this.t("dataWindow.volume"),tl(r.volume)));for(const a of t.indicators){const o=document.createElement("div");o.className="tcw-datawin-sub",o.textContent=a.name,this.bodyEl.appendChild(o);for(const c of a.values)this.bodyEl.appendChild(this.row(c.key,Qc(c.value)))}}row(t,e,r=""){const n=document.createElement("div");n.className="tcw-datawin-row";const s=document.createElement("span");s.className="tcw-datawin-label",s.textContent=t;const a=document.createElement("span");return a.className=`tcw-datawin-value${r?` tcw-${r}`:""}`,a.textContent=e,n.appendChild(s),n.appendChild(a),n}}function Qc(i){if(!Number.isFinite(i))return"—";const t=Math.abs(i);return t>=1e3?i.toFixed(2):t>=1?i.toFixed(4):i.toPrecision(4)}function tl(i){return i>=1e9?(i/1e9).toFixed(2)+"B":i>=1e6?(i/1e6).toFixed(2)+"M":i>=1e3?(i/1e3).toFixed(2)+"K":i.toFixed(0)}const de=globalThis.Buffer;function el(i){if(de)return de.from(i,"utf8").toString("base64");const t=new TextEncoder().encode(i);let e="";for(const r of t)e+=String.fromCharCode(r);return btoa(e)}function rl(i){if(de)return de.from(i,"base64").toString("utf8");const t=atob(i),e=new Uint8Array(t.length);for(let r=0;r<t.length;r++)e[r]=t.charCodeAt(r);return new TextDecoder().decode(e)}function nl(i){return i.replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"")}function sl(i){const t=i.replace(/-/g,"+").replace(/_/g,"/"),e=t.length%4===0?"":"=".repeat(4-t.length%4);return t+e}function il(i){return nl(el(JSON.stringify(i)))}function al(i){if(!i)return null;try{const t=rl(sl(i)),e=JSON.parse(t);return!e||e.v!==1||typeof e.symbol!="string"?null:{v:1,symbol:e.symbol,timeframe:e.timeframe,chartType:e.chartType,scaleMode:e.scaleMode??"regular",indicators:Array.isArray(e.indicators)?e.indicators:[],drawings:Array.isArray(e.drawings)?e.drawings:[]}}catch{return null}}const Ls="tcw";function ol(i){const t=i.startsWith("#")?i.slice(1):i;for(const e of t.split("&")){const r=e.indexOf("=");if(r>0&&e.slice(0,r)===Ls)return decodeURIComponent(e.slice(r+1))}return null}function cl(i,t){const[e]=i.split("#");return`${e}#${Ls}=${t}`}const ll=200,dl=[[34,16,28,26,!1],[30,14,24,26,!0],[26,18,20,30,!0],[30,10,24,22,!1],[20,16,14,28,!0],[14,18,8,30,!0],[18,10,12,20,!1],[8,18,2,30,!0]];class hl{constructor(t,e){d(this,"el");d(this,"label");d(this,"showTimer",null);d(this,"phase","loading");this.loadingText=e,this.el=document.createElement("div"),this.el.className="tcw-loading-overlay",this.el.setAttribute("role","status"),this.el.setAttribute("aria-live","polite");const r=document.createElement("div");r.className="tcw-loading-card";const n=document.createElement("div");n.className="tcw-loading-candles",n.setAttribute("aria-hidden","true"),dl.forEach(([a,o,c,l,h],p)=>{const m=document.createElement("span");m.className=h?"tcw-loading-candle tcw-loading-candle--up":"tcw-loading-candle",m.style.setProperty("--tcw-body-top",`${a}px`),m.style.setProperty("--tcw-body-h",`${o}px`),m.style.setProperty("--tcw-wick-top",`${c}px`),m.style.setProperty("--tcw-wick-h",`${l}px`),m.style.setProperty("--tcw-delay",`${p*110}ms`),n.appendChild(m)}),r.appendChild(n);const s=document.createElement("div");s.className="tcw-loading-track",s.setAttribute("aria-hidden","true"),s.appendChild(document.createElement("span")),r.appendChild(s),this.label=document.createElement("div"),this.label.className="tcw-loading-label",this.label.textContent=e,r.appendChild(this.label),this.el.appendChild(r),t.appendChild(this.el)}begin(t,e=!1){if(this.phase="loading",this.clearTimer(),this.label.textContent=this.loadingText,this.el.classList.remove("tcw-loading-overlay--error"),this.el.classList.toggle("tcw-loading-overlay--veil",t),!t||e||this.isShown()){this.el.classList.remove("tcw-loading-overlay--hidden");return}this.showTimer=setTimeout(()=>{this.showTimer=null,this.el.classList.remove("tcw-loading-overlay--hidden")},ll)}end(){this.phase="idle",this.clearTimer(),this.el.classList.add("tcw-loading-overlay--hidden")}fail(t){this.phase!=="idle"&&(this.phase="failed",this.clearTimer(),this.label.textContent=t,this.el.classList.add("tcw-loading-overlay--error"),this.el.classList.remove("tcw-loading-overlay--hidden"))}isActive(){return this.phase!=="idle"}hasFailed(){return this.phase==="failed"}isShown(){return!this.el.classList.contains("tcw-loading-overlay--hidden")}destroy(){this.clearTimer(),this.el.remove()}clearTimer(){this.showTimer!==null&&(clearTimeout(this.showTimer),this.showTimer=null)}}const ul=4e3;class pl{constructor(t,e){d(this,"el");d(this,"text");d(this,"hideTimer",null);this.texts=e,this.el=document.createElement("div"),this.el.className="tcw-history-pill tcw-history-pill--hidden",this.el.setAttribute("aria-hidden","true"),this.el.setAttribute("role","status"),this.el.setAttribute("aria-live","polite");const r=document.createElement("span");r.className="tcw-history-spinner",r.setAttribute("aria-hidden","true"),this.text=document.createElement("span"),this.el.append(r,this.text),t.appendChild(this.el)}update(t){this.clearTimer(),t.state==="loading"?this.show(this.texts.loading,!1):t.state==="error"?(this.show(this.texts.failed,!0),this.hideTimer=setTimeout(()=>this.hide(),ul)):this.hide()}destroy(){this.clearTimer(),this.el.remove()}show(t,e){this.text.textContent=t,this.el.classList.toggle("tcw-history-pill--error",e),this.el.classList.remove("tcw-history-pill--hidden"),this.el.removeAttribute("aria-hidden")}hide(){this.hideTimer=null,this.el.classList.add("tcw-history-pill--hidden"),this.el.setAttribute("aria-hidden","true"),this.text.textContent=""}clearTimer(){this.hideTimer!==null&&clearTimeout(this.hideTimer),this.hideTimer=null}}const Xe="host:";function Zt(i,t){return[...i,...i.length>0&&t.length>0?["separator"]:[],...t.map((e,r)=>({id:`${Xe}${r}`,label:e.label,icon:e.icon,danger:e.danger,checked:e.checked}))]}function Qt(i,t){var e;return i.startsWith(Xe)?((e=t[Number(i.slice(Xe.length))])==null||e.onSelect(),!0):!1}const ml=typeof navigator<"u"&&/mac|iphone|ipad|ipod/i.test(navigator.platform||navigator.userAgent),Mn={ctrl:"ctrl",control:"ctrl",cmd:"ctrl",command:"ctrl",meta:"ctrl",mod:"ctrl",alt:"alt",option:"alt",opt:"alt",shift:"shift"},wl={esc:"escape",space:" ",spacebar:" ",up:"arrowup",down:"arrowdown",left:"arrowleft",right:"arrowright",del:"delete",return:"enter",plus:"+"};function fl(i){const t=i.split("+").map(s=>s.trim()),e=t.pop();if(!e)return null;const r={ctrl:!1,alt:!1,shift:!1,display:[]};for(const s of t){const a=Mn[s.toLowerCase()];if(!a)return null;r[a]=!0}const n=e.toLowerCase();if(Mn[n])return null;if(/^[a-z]$/.test(n))r.code=`Key${n.toUpperCase()}`,r.char=n;else if(/^[0-9]$/.test(n))r.code=`Digit${n}`,r.char=n;else if(r.key=wl[n]??n,r.shift&&r.key.length===1)return null;return r.display=[...r.ctrl?[ml?"⌘":"Ctrl"]:[],...r.alt?["Alt"]:[],...r.shift?["Shift"]:[],r.key===" "?"Space":e.length===1?e.toUpperCase():e],r}function gl(i,t){if((i.ctrlKey||i.metaKey)!==t.ctrl||i.altKey!==t.alt)return!1;if(t.code!==void 0){if(i.shiftKey!==t.shift)return!1;if(t.alt)return i.code===t.code;const e=i.key.length===1&&/^[a-z0-9]$/i.test(i.key)?i.key.toLowerCase():null;return e!==null?e===t.char:i.code===t.code}return t.shift&&!i.shiftKey?!1:i.key.toLowerCase()===t.key}const bl=new Set(["escape","enter","delete","backspace","arrowleft","arrowright","arrowup","arrowdown","home","end","+","-","="," ",",",".","ctrl+z","ctrl+shift+z","ctrl+y","ctrl+c","ctrl+v","ctrl+d","ctrl+g","ctrl+shift+g","ctrl+[","ctrl+]"]);function vl(i){const t=`${i.ctrl?"ctrl+":""}${i.alt?"alt+":""}${i.shift?"shift+":""}${i.char??i.key}`;return bl.has(t)}function yl(i){const t=typeof i.composedPath=="function"?i.composedPath()[0]:i.target;return t instanceof HTMLElement?t.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName):!1}const xl=48,kl=5e4,Sl=100;function El(){return new Promise(i=>{if(typeof requestAnimationFrame!="function"||document.hidden){setTimeout(i,0);return}const t=setTimeout(i,Sl);requestAnimationFrame(()=>setTimeout(()=>{clearTimeout(t),i()},0))})}const In=["#4c8dff","#a57cff","#1398a8","#e25592","#8a93a3","#62c895"],te=4,Pn=7,Dn=17,Cl=3,Tl=["1m","3m","5m","15m","30m","1h","2h","4h","1d"],Ll=5e3,ze=()=>{const i=document.activeElement;return i instanceof Element&&i.closest('[role="dialog"], [aria-modal="true"], [role="menu"]')!==null},Al=229,Nl=1e3,Ml=it.filter(i=>he[i]!=="color"),ee=()=>typeof document<"u"&&document.hidden;class Il{constructor(t,e={}){d(this,"chart");d(this,"state");d(this,"themeOf",{dark:ge,light:Tr});d(this,"toolbar",null);d(this,"sidebar",null);d(this,"settings",null);d(this,"statusBar",null);d(this,"goToDate",null);d(this,"tooltip");d(this,"indicatorLegend",null);d(this,"legendFrame",0);d(this,"portal",document.createElement("div"));d(this,"stopKeyboardInset",null);d(this,"stopNarrow",null);d(this,"stopFormControls",null);d(this,"overlayHost",()=>{const t=document.fullscreenElement===this.root?this.root:document.body;return this.portal.parentElement!==t&&t.appendChild(this.portal),this.portal});d(this,"unregisterKeys",()=>{});d(this,"onFullscreenChange",()=>{var t;(t=this.toolbar)==null||t.setFullscreen(document.fullscreenElement===this.root),this.portal.isConnected&&this.overlayHost()});d(this,"commandPalette",null);d(this,"symbolSearch",null);d(this,"hotkeySheet",null);d(this,"replayBar",null);d(this,"dragDrop",null);d(this,"alertsPanel",null);d(this,"objectTree",null);d(this,"indicatorSettings",null);d(this,"indicatorPicker",null);d(this,"drawingStyle",null);d(this,"drawingSettings",null);d(this,"drawingMenu",null);d(this,"selectionToolbar",null);d(this,"selectionToolbarFrame",null);d(this,"chartMenu",null);d(this,"menuPane",null);d(this,"canExport",!0);d(this,"symbolLoads",new Map);d(this,"ui");d(this,"legendMenu",null);d(this,"templates",new Ac);d(this,"templatePrompt",null);d(this,"chartTemplates",new Uo);d(this,"chartTemplatePrompt",null);d(this,"settingsEdit",null);d(this,"intervalInput",null);d(this,"markerTip",null);d(this,"accountPanel",null);d(this,"orderTicket",null);d(this,"accountFrame",0);d(this,"layoutSession",null);d(this,"layoutsUI",null);d(this,"bracketBar",null);d(this,"alertNotifier",null);d(this,"depthLadder",null);d(this,"dataWindow",null);d(this,"lastHoverIndex",null);d(this,"legendHoverIndex",null);d(this,"favoritesStore",new Yt);d(this,"indicatorFavorites",new Yt("tcw:indicator-favorites"));d(this,"indicatorDefaults",new $o);d(this,"timeframeFavorites",new Yt("tcw:tf-favorites"));d(this,"customTimeframes",new Yt("tcw:tf-custom"));d(this,"timeframes",[]);d(this,"watchlist",null);d(this,"watchlistSparkBuffer",new Map);d(this,"sessionRefPrice",null);d(this,"hostWatchlistRefPrice",new Map);d(this,"watchlistInterval",null);d(this,"watchlistStore",null);d(this,"watchlistFromSymbols",!1);d(this,"quoteSource",null);d(this,"stopQuotes",null);d(this,"quotedKey","");d(this,"quotes",new Map);d(this,"symbolInfoPanel",null);d(this,"news",new ja);d(this,"marketTimer",null);d(this,"clockTimer",null);d(this,"onPageShown",null);d(this,"chartNav",null);d(this,"visibleBarCount",50);d(this,"replayPollInterval",null);d(this,"replaySpeed",Ue);d(this,"replayStep","bar");d(this,"replayStartSeq",0);d(this,"replayStepsCache",null);d(this,"replayShade",null);d(this,"layoutKeyPrefix",null);d(this,"layoutDebounceMs",1500);d(this,"activeLayoutKey",null);d(this,"root");d(this,"chartContainer");d(this,"loading");d(this,"historyPill");d(this,"connectSeq",0);d(this,"localSeq",0);d(this,"lastLocalSwitchMs",0);d(this,"destroyed",!1);d(this,"options");d(this,"symbols");d(this,"settingsState");d(this,"settingsDefaults");d(this,"t");d(this,"adapter",null);d(this,"boundGlobalKeydown",null);d(this,"baseSeries",null);d(this,"baseTimeframeMs",0);d(this,"chosenTimeframe",null);d(this,"rangeSeq",0);d(this,"rangeQueue",Promise.resolve());d(this,"compares",[]);d(this,"featureState");d(this,"hostHotkeys",[]);d(this,"hostMenus",new Set);d(this,"hostLayer",null);d(this,"priceAxisAddDefault",!1);d(this,"hideReplayShade",()=>this.positionReplayShade(null));var E,R,U,K,q,G,bt;this.options=e,this.symbols=e.symbols??yi;const r=e.chartOptions;if(this.settingsState={...jn,...r!=null&&r.numberLocale?{numberLocale:r.numberLocale}:{},...(r==null?void 0:r.timeZone)!=null?{timezone:di(r.timeZone)}:{},...(r==null?void 0:r.leftPriceScale)!==void 0?{leftPriceScale:r.leftPriceScale}:{},...(r==null?void 0:r.highLowLines)!==void 0?{highLowLines:r.highLowLines}:{},...(r==null?void 0:r.extendedHours)!==void 0?{extendedHours:r.extendedHours}:{},...r!=null&&r.chartTypeOptions?{chartTypeOptions:Zs(r.chartTypeOptions)}:{}},this.t=ar(ss(e.locale,e.messages)),this.featureState=Mi(e),e.persistLayouts){const u=e.persistLayouts===!0?{}:e.persistLayouts;this.layoutKeyPrefix=u.keyPrefix??"tcw:layout:",this.layoutDebounceMs=u.debounceMs??1500}const n=this.resolveIsDark(e.theme),s=this.resolveTheme(e.theme);this.themeOf={...this.themeOf,[n?"dark":"light"]:s};const a={drawings:!0,drawingMagnet:!0,drawingUndoRedo:!0,indicators:!0,trading:e.trading!==!1,tradingContextMenu:!1,priceAxisAddButton:this.featureState.alerts||e.trading!==!1||this.featureState.sidebar,volume:!0,legend:!0,crosshair:!0,crosshairTooltip:!1,keyboard:!0,screenshot:!0,alerts:!0,barCountdown:!0,logScale:!0,watermark:!0,...(E=e.chartOptions)==null?void 0:E.features};this.priceAxisAddDefault=a.priceAxisAddButton===!0;const o={...a,priceAxisAddButton:this.priceAxisAddDefault&&this.featureState["menu.priceAxisAdd"]};if(this.canExport=a.dataExport!==!1,this.settingsDefaults={...this.settingsState,legendVisible:a.legend!==!1,barCountdown:a.barCountdown!==!1,indicatorValueLabels:a.indicatorValueLabels===!0},this.settingsState={...this.settingsDefaults},this.timeframes=ke(Ki(e.timeframes,a.timeframes),this.customTimeframes.list(),a.timeframes),!this.timeframes.some(u=>this.timeframeFavorites.has(u))){const u=qi(this.timeframes,a.defaultTimeframeFavorites,!!((R=e.timeframes)!=null&&R.length));for(const w of u)this.timeframeFavorites.add(w)}const c=e.timeframe??"5m",l=!((U=a.timeframes)!=null&&U.length)||a.timeframes.includes(c)?c:this.timeframes[0]??c;this.state={symbol:e.symbol??this.symbols[0]??"BTCUSDT",timeframe:l,chartType:((K=e.chartOptions)==null?void 0:K.chartType)??"candlestick",isDark:n,activeIndicators:new Map,activeTool:null,magnetEnabled:a.drawingMagnet!==!1,magnetStrong:!1,eraser:!1,zoomArea:!1,stayInDrawing:!1,connectionState:e.adapter?"connecting":"disconnected",connectionMessage:e.adapter?this.t("status.connecting"):""},ts(),this.root=document.createElement("div"),this.root.className="tcw-root",this.root.dataset.tcwTheme=n?"dark":"light";const h=e.dir==="ltr"||e.dir==="rtl"?e.dir:zl(e.locale)?"rtl":"ltr";this.root.dir=h,this.portal.dir=h,t.appendChild(this.root),this.tooltip=new $c(this.root),this.portal.className="tcw-root tcw-portal",this.portal.dataset.tcwTheme=this.root.dataset.tcwTheme,this.stopKeyboardInset=Ic([this.root,this.portal]),this.stopNarrow=Ts(this.root,u=>{var w,x;(w=this.toolbar)==null||w.fit(),u||(x=this.sidebar)==null||x.closeOverlay()}),this.ui=ft(e.ui);const p=e.ui!==void 0;wt(this.root,this.ui,{variables:p}),wt(this.portal,this.ui,{variables:p}),this.markSwitchedOff(),this.stopFormControls=vi([this.root,this.portal],{layer:this.overlayHost,labels:()=>({prevMonth:this.t("calendar.prevMonth"),nextMonth:this.t("calendar.nextMonth"),today:this.t("calendar.today")}),locale:()=>this.intlLocale()}),this.toolbar=new na(this.root,{symbols:this.symbols,timeframes:this.timeframeMenu(),timeframeFavorites:this.pinnedTimeframes(),chartTypes:e.chartTypes?re.filter(u=>e.chartTypes.includes(u.value)):re},{onSymbolClick:()=>this.handleSymbolClick(),onSymbolInfo:()=>this.toggleSymbolInfo(),onTimeframe:u=>this.handleTimeframe(u),onToggleTimeframeFavorite:u=>this.handleToggleTimeframeFavorite(u),onAddTimeframe:u=>this.handleAddTimeframe(u),onRemoveTimeframe:u=>this.handleRemoveTimeframe(u),onChartType:u=>this.handleChartType(u),onIndicators:()=>this.toggleIndicatorPicker(),onScreenshot:()=>this.chart.screenshot(),onSettings:()=>this.openSettings(),onToggleTheme:()=>this.handleToggleTheme(),onToggleReplay:()=>this.toggleReplay(),onToggleAlerts:()=>this.toggleAlerts(),onToggleObjects:()=>this.toggleObjects(),onToggleAccount:e.trading!==!1?()=>this.toggleAccountPanel():void 0,onLayouts:e.layouts!==!1?u=>{var w;return void((w=this.layoutsUI)==null?void 0:w.openMenu(u))}:void 0,onBracket:e.trading!==!1?u=>this.startBracket(u):void 0,onToggleLadder:e.trading!==!1&&e.depthLadder?()=>{var u;return(u=this.depthLadder)==null?void 0:u.toggle()}:void 0,onOrderTicket:e.trading!==!1?()=>this.openOrderTicket():void 0,onCompare:e.adapter&&a.compareSymbols!==!1?()=>this.handleAddCompare():void 0,onUndo:()=>this.chart.undo(),onRedo:()=>this.chart.redo(),onToggleFullscreen:typeof document<"u"&&document.fullscreenEnabled?()=>this.toggleFullscreen():void 0},this.t,this.overlayHost);const m=document.createElement("div");m.className="tcw-body",e.drawingFavorites&&this.favoritesStore.seedDefaults(e.drawingFavorites),this.sidebar=new ca(m,{drawingToolGroups:_r(Br,this.t),favorites:this.favoritesStore.list(),shortcuts:Ga()},{onDrawingTool:u=>this.handleDrawingTool(u),onCancelDrawing:()=>this.handleCancelDrawing(),onToggleMagnet:a.drawingMagnet!==!1?()=>this.handleToggleMagnet():void 0,onToggleEraser:()=>this.chart.setEraserMode(!this.chart.isEraserMode()),onToggleZoomArea:()=>this.chart.setZoomAreaMode(!this.chart.isZoomAreaMode()),onToggleFavorite:u=>this.handleToggleFavorite(u),onClearDrawings:()=>{this.chart.clearDrawings(),this.state={...this.state,activeTool:null},this.updateUI()},onToggleStyle:()=>{var u;return(u=this.drawingStyle)==null?void 0:u.toggle()},onToggleStayInDrawing:()=>this.handleToggleStayInDrawing(),onLockAll:u=>{this.chart.setDrawingsLocked(this.chart.getDrawings().map(w=>w.id),u),this.refreshDrawingsState(),this.refreshObjects()},onHideAll:u=>{this.chart.setDrawingsVisible(this.chart.getDrawings().map(w=>w.id),!u),this.refreshDrawingsState(),this.refreshObjects()}},this.t),this.chartContainer=document.createElement("div"),this.chartContainer.className="tcw-chart-container",this.chartContainer.dir="ltr",m.appendChild(this.chartContainer),this.loading=new hl(this.chartContainer,this.t("status.loading")),this.historyPill=new pl(this.chartContainer,{loading:this.t("history.loading"),failed:this.t("history.failed")}),e.watchlist&&this.createWatchlist(m,e.watchlist===!0?{}:e.watchlist),this.root.appendChild(m);const f=document.createElement("div");f.className="tcw-account-dock",k(f,"accountPanel"),this.root.appendChild(f),this.chart=new Qs(this.chartContainer,{chartType:this.state.chartType,theme:s,autoScale:!0,crosshair:{mode:"magnet"},a11y:{labels:{role:this.t("a11y.role"),summary:this.t("a11y.summary"),empty:this.t("a11y.empty"),view:this.t("a11y.view"),bar:this.t("a11y.bar"),keys:this.t("a11y.keys"),typeName:u=>{const w=`chartType.${u}`,x=this.t(w);return x===w?u:x}}},...e.chartOptions,features:o}),(q=e.chartOptions)!=null&&q.shapes||this.applyChartShapes(),this.applyLegendFont();for(const[u,w]of this.indicatorDefaults.all())this.chart.setIndicatorDefaults(u,w.style);this.chart.on("visibleRangeChange",u=>{const{from:w,to:x}=u.payload;Number.isFinite(w)&&Number.isFinite(x)&&(this.visibleBarCount=Math.max(1,x-w))}),this.chartNav=new Qa(this.chartContainer,{zoomIn:()=>this.chart.zoomIn(),zoomOut:()=>this.chart.zoomOut(),scroll:u=>this.chart.scrollBars(u*Math.max(1,Math.round(this.visibleBarCount/10))),reset:()=>this.resetView(),plotRect:()=>this.chart.getPlotRect()},this.t),this.chart.on("dataUpdate",u=>this.handleDataUpdate(u.payload)),this.chart.on("historyLoad",u=>this.historyPill.update(u.payload)),this.chart.on("symbolInfoChange",u=>{var A;const w=u.payload.info,x=w?[w.description,w.exchange].filter(Boolean).join(" · "):"";(A=this.toolbar)==null||A.setSymbolDescription(x||null),this.refreshMarket()}),this.symbolInfoPanel=new Ha(this.root,this.t,{onToggle:u=>{var w;(w=this.toolbar)==null||w.setActive("symbolInfo",u),u&&(this.refreshSymbolInfo(),this.loadNews())}}),this.marketTimer=setInterval(()=>this.refreshMarket(),3e4),this.onPageShown=()=>{ee()||this.refreshMarket()},document.addEventListener("visibilitychange",this.onPageShown),this.dragDrop=new oi(this.chartContainer,{onData:(u,w,x)=>{this.setData(u);const A=S(this.t("toast.fileLoaded"),{count:w.data.length,file:x.name});this.say(w.skipped>0?`${A} (${S(this.t("toast.fileSkipped"),{count:w.skipped})})`:A)},onError:(u,w)=>{this.say(`${w.name}: ${u.message}`,"error")}}),this.featureState.dragDropImport&&this.dragDrop.attach(),this.statusBar=new ga(this.root,{presets:ti,presetLabels:{All:this.t("range.all")},groupLabel:this.t("range.presets"),goToLabel:this.t("range.goTo"),onPreset:u=>void this.applyRangePreset(u),onGoTo:()=>this.toggleGoToDate()},{clock:{label:this.t("settings.timezone"),now:()=>this.clockNow(),options:()=>{var u,w;return{current:this.settingsState.timezone,list:$e(this.settingsState.timezone,Date.now(),this.t("settings.timezone.local"),(u=this.adapter)!=null&&u.resolveSymbol?{label:this.t("settings.timezone.exchange"),zone:((w=this.chart.getSymbolInfo())==null?void 0:w.timezone)??null}:void 0)}},onPick:u=>this.changeSettings({timezone:u})},scale:{labels:{group:this.t("settings.priceScale"),percent:this.t("settings.scale.percentage"),log:this.t("settings.scale.logarithmic"),auto:this.t("settings.autoScale")},texts:{log:this.t("statusBar.log"),auto:this.t("statusBar.auto")},onPercent:()=>this.toggleScaleMode("percentage"),onLog:a.logScale!==!1?()=>this.toggleScaleMode("logarithmic"):void 0,onAuto:()=>this.changeSettings({autoScale:!this.chart.isAutoScale()})}}),this.clockTimer=setInterval(()=>{var u;!ee()&&this.featureState.statusBar&&this.featureState["statusBar.clock"]&&((u=this.statusBar)==null||u.tick())},Nl),this.chart.on("priceRangeChange",()=>this.refreshScaleSwitches()),this.refreshScaleSwitches(),this.goToDate=new zc(this.root,{title:this.t("range.goTo"),date:this.t("range.date"),time:this.t("range.time"),submit:this.t("range.goToSubmit"),cancel:this.t("range.cancel")},({date:u,time:w})=>this.goToWallTime(u,w)),this.settings=new wa({onChange:u=>this.changeSettings(u),onReset:()=>this.resetSettings(),onClose:()=>this.endSettingsEdit(!0),onCancel:()=>this.endSettingsEdit(!1),templates:{list:()=>this.chartTemplates.list().map(u=>u.name),apply:u=>this.applyChartTemplate(u),remove:u=>this.chartTemplates.remove(u),save:()=>this.promptSaveChartTemplate()},styleValue:u=>{var w,x;return((x=(w=this.chart).getStyleValue)==null?void 0:x.call(w,u))??null},onStyleChange:u=>this.changeStyle(u)},this.t,{barCountdown:a.barCountdown,logScale:a.logScale,trading:a.trading!==!1,exchangeZone:(G=this.adapter)!=null&&G.resolveSymbol?()=>{var u;return((u=this.chart.getSymbolInfo())==null?void 0:u.timezone)??null}:void 0},this.overlayHost),this.symbolSearch=new ya({onPick:u=>{this.setSymbol(u)},onClose:()=>{}},this.overlayHost,this.t),this.hotkeySheet=new Ta({onClose:()=>{}},this.t,this.overlayHost),this.chart.on("drawingToolChange",u=>{const w=u.payload.tool;w!==this.state.activeTool&&(this.state={...this.state,activeTool:w},this.updateUI())}),this.chart.on("toolModeChange",u=>{const{eraser:w,zoomArea:x}=u.payload;this.state={...this.state,eraser:w??this.state.eraser,zoomArea:x??this.state.zoomArea},this.updateUI()}),this.chart.on("indicatorAdd",()=>this.syncIndicatorsFromChart()),this.chart.on("indicatorRemove",()=>this.syncIndicatorsFromChart()),this.chart.setPaneTitlesVisible(!this.featureState.indicatorLegend),this.indicatorLegend=new jc(this.chartContainer,{onToggleVisible:(u,w)=>{var x;this.chart.setIndicatorVisible(u,w),this.scheduleLegend(),(x=this.objectTree)!=null&&x.isOpen()&&this.refreshObjects()},onSettings:u=>{this.featureState["indicatorLegend.settings"]&&this.openIndicatorSettings(u)},onRemove:u=>this.handleRemoveIndicator(u),onMore:(u,w)=>this.openLegendMenu(u,w),onPaneAction:(u,w)=>this.runPaneAction(u,w)},{show:this.t("legend.show"),hide:this.t("legend.hide"),settings:this.t("legend.settings"),remove:this.t("legend.remove"),collapse:this.t("legend.collapse"),expand:this.t("legend.expand"),more:this.t("legend.more"),paneUp:this.t("pane.moveUp"),paneDown:this.t("pane.moveDown"),paneCollapse:this.t("pane.collapse"),paneExpand:this.t("pane.expand"),paneMaximize:this.t("pane.maximize"),paneRestore:this.t("pane.restore"),offInterval:this.t("indicatorSettings.offInterval")}),this.legendMenu=new W(this.root,this.t("legend.more")),this.chart.on("crosshairMove",u=>{const w=u.payload;this.legendHoverIndex=typeof w.barIndex=="number"?w.barIndex:null,this.scheduleLegend()}),this.chart.on("crosshairLeave",()=>{this.legendHoverIndex=null,this.scheduleLegend()});for(const u of["indicatorUpdate","indicatorChange","dataUpdate","resize","paneResize","paneChange","themeChange","timeframeChange"])this.chart.on(u,()=>this.scheduleLegend());this.chart.on("barClick",u=>{var x;if(!((x=this.replayBar)!=null&&x.isMounted()))return;const w=u.payload.barIndex;if(typeof w=="number"){if(this.replayBar.getMode()==="select"){this.startReplayAt(w);return}this.chart.getReplayState()==="playing"&&this.chart.replayPause(),this.chart.replaySeekToBar(w),this.replayBar.setState("paused")}}),this.chart.on("crosshairMove",u=>{var x;if(((x=this.replayBar)==null?void 0:x.getMode())!=="select"||!this.replayBar.isMounted())return;const w=u.payload.point;this.positionReplayShade((w==null?void 0:w.x)??null)}),this.dataWindow=new Zc(this.root,{formatPrice:u=>this.formatAlertPrice(u)},this.t),this.chart.on("crosshairMove",u=>{var x;const w=u.payload;this.lastHoverIndex=typeof w.barIndex=="number"?w.barIndex:null,(x=this.dataWindow)!=null&&x.isOpen()&&this.dataWindow.render(this.buildDataWindowModel())});const g=new jo,v=new Vo;for(const[u,w]of Object.entries(v.all()))this.chart.setDrawingToolDefaults(u,w??null);this.drawingSettings=new nc(this.root,{onBegin:u=>this.chart.beginDrawingEdit(u),onChange:(u,w)=>this.chart.updateDrawing(u,w),onEnd:(u,w)=>{this.chart.endDrawingEdit(u,{cancel:w}),this.refreshObjects()},toWallTime:u=>Q(u*pt(this.chart.getData()),this.displayTimezone()),fromWallTime:(u,w)=>{const x=Tn(u,w,this.displayTimezone());return x===null?null:x/pt(this.chart.getData())},roundPrice:u=>this.chart.roundPrice(u),priceStep:()=>this.chart.getPriceStep(),onAddAlert:u=>this.addDrawingAlert(u),onSaveDefault:(u,w)=>{this.chart.setDrawingToolDefaults(u,w),v.set(u,this.chart.getDrawingToolDefaults(u)),this.say(S(this.t("drawingSettings.defaultSaved"),{name:this.drawingToolName(u)}))},templates:g},this.t),this.chart.on("drawingDoubleClick",u=>this.openDrawingSettings(u.payload.id)),this.drawingStyle=new Ko(this.root,{onStyleChange:u=>{this.chart.setDrawingStyle(u),this.chart.setSelectedDrawingStyle(u)},getStyle:()=>this.chart.getDrawingStyle()},g,this.t),this.drawingMenu=new W(this.root,this.t("drawingMenu.label")),this.chart.on("drawingContextMenu",u=>{const{id:w,x,y:A}=u.payload;this.openDrawingMenu(w,x,A)}),this.selectionToolbar=new Xo(this.root,{onStyle:u=>{for(const w of this.chart.getSelectedDrawingIds())this.chart.setSelectedDrawingStyle(u,w);this.updateSelectionToolbar()},onSettings:()=>{const u=this.chart.getSelectedDrawingIds()[0];u&&this.openDrawingSettings(u)},onAlert:()=>{const u=this.chart.getSelectedDrawingIds()[0];u&&this.addDrawingAlert(u)},onLock:u=>{this.chart.setDrawingsLocked(this.chart.getSelectedDrawingIds(),u),this.refreshObjects(),this.updateSelectionToolbar()},onMore:(u,w)=>{const x=this.chart.getSelectedDrawingIds()[0];if(!x)return;const A=this.chartOffset();this.openDrawingMenu(x,u-A.x,w-A.y)},onDelete:()=>{this.chart.removeDrawings(this.chart.getSelectedDrawingIds()),this.refreshObjects(),this.updateSelectionToolbar()}},this.t);for(const u of["drawingCreate","drawingUpdate","drawingRemove"])this.chart.on(u,()=>this.refreshDrawingsState());this.chart.on("historyChange",u=>{var A;const{canUndo:w,canRedo:x}=u.payload;(A=this.toolbar)==null||A.setHistory(w,x)});for(const u of["drawingSelect","drawingToolChange","toolModeChange"])this.chart.on(u,()=>this.updateSelectionToolbar());for(const u of["drawingUpdate","drawingRemove","historyChange","visibleRangeChange","priceRangeChange","zoomChange","resize","paneResize","paneChange","dataUpdate","replayStep","chartTypeChange"])this.chart.on(u,()=>this.scheduleSelectionToolbar());if(this.chartMenu=new W(this.root,this.t("chartMenu.label"),this.t("common.back")),this.chart.on("symbolSeriesRequest",u=>void this.loadSymbolSeries(u.payload.symbol)),this.chart.on("chartContextMenu",u=>{if(!this.featureState["menu.chart"])return;const{area:w,x,y:A,price:O,time:_,pane:Y}=u.payload,B=O===void 0?void 0:this.chart.roundPrice(O),Bt={...this.chartMenuContext(B),...Y?{pane:this.chart.getPaneScale(Y)}:{}};this.menuPane=Y??null,this.openChartMenu(ne(hc(w,Bt,this.t),Or,this.featureState),x,A,{area:w,price:B,time:_})}),this.chart.on("priceAxisAdd",u=>{if(!this.featureState["menu.priceAxisAdd"])return;const{price:w,x,y:A}=u.payload,O=this.chart.roundPrice(w),_=ne(dr(this.chartMenuContext(O),this.t),Or,this.featureState);this.openChartMenu(_,x,A,{area:"priceAxisAdd",price:O})}),this.chart.on("signalMarkerHover",u=>this.showMarkerTip(u.payload)),this.intervalInput=new Lc(this.chartContainer,{title:this.t("interval.title"),hint:this.t("interval.hint"),invalid:this.t("interval.invalid")},u=>this.selectTypedTimeframe(u)),e.layouts!==!1&&this.setupLayouts(e.layouts===!0||e.layouts===void 0?{}:e.layouts),e.trading!==!1){this.orderTicket=new yc(this.root,{onSubmit:u=>{this.chart.placeOrderIntent(u),this.say(S(this.t("ticket.sent"),{side:this.t(u.side==="buy"?"ticket.buy":"ticket.sell"),quantity:u.quantity??1,price:this.formatAlertPrice(u.price)}))},formatPrice:u=>this.formatAlertPrice(u)},this.t),this.accountPanel=new wc(f,{onClosePosition:u=>this.chart.closePositionIntent(u),onReversePosition:u=>this.chart.reversePositionIntent(u),onCancelOrder:u=>this.chart.cancelOrderIntent(u),onNewOrder:()=>this.openOrderTicket(),formatPrice:u=>this.formatAlertPrice(u),formatTime:u=>{const{date:w,time:x}=Q(u,this.displayTimezone());return`${w} ${x}`},onToggle:u=>{var w;(w=this.toolbar)==null||w.setActive("account",u),this.refreshAccount()}},this.t);for(const u of["ordersChange","positionsChange","executionFill","dataUpdate","indicatorUpdate"])this.chart.on(u,()=>this.refreshAccountSoon())}e.trading!==!1&&(this.bracketBar=new Gc(this.root,{onConfirm:()=>this.chart.confirmBracket(),onCancel:()=>{var u;this.chart.cancelBracket(),(u=this.bracketBar)==null||u.hide()}},this.t),this.chart.on("bracketPlace",u=>{var x;const w=u.payload;(x=this.bracketBar)==null||x.hide(),this.say(S(this.t(w.side==="buy"?"bracket.longPlaced":"bracket.shortPlaced"),{rr:w.riskReward.toFixed(2)}))}),e.depthLadder&&(this.depthLadder=new Jc(this.root,{onTrade:(u,w)=>{this.chart.placeOrderIntent({side:u,type:"limit",price:w}),this.say(S(this.t(u==="buy"?"order.buyLimit":"order.sellLimit"),{price:this.formatAlertPrice(w)}))},formatPrice:u=>this.formatAlertPrice(u),onToggle:u=>{var w;return(w=this.toolbar)==null?void 0:w.setActive("ladder",u)}},void 0,this.t)),this.chart.on("dataUpdate",u=>{var x;const w=u.payload;w&&w.bracket==="cancelled"&&((x=this.bracketBar)==null||x.hide())})),this.alertsPanel=new so(this.root,{onAdd:({price:u,condition:w,message:x,channel:A,label:O,options:_})=>{try{return this.chart.addAlert(u,w,x,A,O,_),!0}catch{return this.say(this.t("alerts.invalid"),"error"),!1}},formatTime:u=>{const{date:w,time:x}=Q(u,this.displayTimezone());return`${w} ${x}`},onRemove:u=>this.chart.removeAlert(u),onClear:()=>this.chart.clearAlerts(),getChannelValue:u=>this.getAlertChannelValue(u),formatPrice:u=>this.formatAlertPrice(u)},this.t),this.chart.on("alertAdd",()=>this.refreshAlerts()),this.chart.on("alertRemove",()=>this.refreshAlerts()),this.chart.on("alertUpdate",()=>this.refreshAlerts()),this.chart.on("alertExpired",u=>{const w=u.payload;this.refreshAlerts(),this.featureState.alerts&&this.say(S(this.t("alerts.expiredToast"),{text:w.message??this.alertText(w)}))}),e.alertNotifications&&(this.alertNotifier=new Yc(e.alertNotifications)),this.chart.on("alertTriggered",u=>{var A;const w=u.payload;if(this.refreshAlerts(),!this.featureState.alerts)return;const x=`${this.alertText(w)}${w.message?` — ${w.message}`:""}`;this.say(S(this.t("alerts.fired"),{text:x}),"info","bell"),(A=this.alertNotifier)==null||A.notify(x)}),this.indicatorPicker=new Fo(this.overlayHost,{onAdd:u=>this.handleAddIndicator(u),onFavorite:(u,w)=>w?this.indicatorFavorites.add(u):this.indicatorFavorites.remove(u),templates:{onApply:u=>this.applyIndicatorTemplate(u),onDelete:u=>{var w;this.templates.remove(u),(w=this.indicatorPicker)==null||w.setTemplates(this.templateNames())},onSave:()=>this.promptSaveIndicatorTemplate()},onClose:()=>{var u;return(u=this.toolbar)==null?void 0:u.setIndicatorsOpen(!1)}},this.t),this.indicatorSettings=new Do(this.root,{onApply:(u,w)=>{this.chart.updateIndicator(u,w),this.syncIndicatorsFromChart()},onStyle:(u,w)=>this.chart.updateIndicatorStyle(u,w),onLevels:(u,w)=>this.chart.setIndicatorLevels(u,w),onScale:(u,w)=>this.chart.setIndicatorScale(u,w),onIntervals:(u,w)=>this.chart.setIndicatorIntervals(u,w),onSaveDefault:(u,w)=>this.saveIndicatorDefault(u,w),onClose:()=>this.chart.endIndicatorEdit()},this.t),this.objectTree=new fo(this.root,{onRemoveIndicator:u=>this.handleRemoveIndicator(u),onConfigureIndicator:u=>this.openIndicatorSettings(u),onToggleIndicatorVisible:(u,w)=>{this.chart.setIndicatorVisible(u,w),this.refreshObjects(),this.scheduleLegend()},onRemoveDrawing:u=>{var w;((w=this.drawingSettings)==null?void 0:w.editing())===u&&this.drawingSettings.close(!0),this.chart.removeDrawing(u),this.refreshObjects()},onConfigureDrawing:this.drawingSettings?u=>this.openDrawingSettings(u):void 0,onToggleDrawingVisible:(u,w)=>{this.chart.setDrawingVisible(u,w),this.refreshObjects()},onToggleDrawingLocked:(u,w)=>{this.chart.setDrawingLocked(u,w),this.refreshObjects()},onToggleGroupVisible:(u,w)=>{this.chart.setDrawingGroupVisible(u,w),this.refreshObjects()},onToggleGroupLocked:(u,w)=>{this.chart.setDrawingGroupLocked(u,w),this.refreshObjects()},onUngroup:u=>{this.chart.ungroupDrawings(u),this.refreshObjects()},onRenameGroup:(u,w)=>{this.chart.renameDrawingGroup(u,w),this.refreshObjects()},onAddCompare:a.compareSymbols!==!1?()=>this.handleAddCompare():void 0,onRemoveCompare:u=>this.handleRemoveCompare(u)},this.t);const y=()=>{var u;(u=this.objectTree)!=null&&u.isOpen()&&this.refreshObjects()};let L=0;const C=()=>{var u;L||!((u=this.objectTree)!=null&&u.isOpen())||(L=requestAnimationFrame(()=>{L=0,this.destroyed||y()}))};if(this.chart.on("drawingCreate",y),this.chart.on("drawingRemove",y),this.chart.on("drawingUpdate",C),this.chart.on("indicatorAdd",y),this.chart.on("indicatorRemove",y),this.chart.on("indicatorChange",y),this.commandPalette=new ba({onIndicator:u=>this.handleAddIndicator(u),onChartType:u=>this.handleChartType(u),onDrawingTool:u=>this.handleDrawingTool(u),onTimeframe:u=>this.handleTimeframe(u),onAction:u=>this.handleAction(u),onClose:()=>{}},this.overlayHost,this.t),this.boundGlobalKeydown=u=>{var A,O,_,Y;if(this.featureState.hotkeys&&((A=this.replayBar)!=null&&A.isMounted())&&this.handleReplayKey(u)||this.handleHostHotkey(u))return;const w=Ct(this.root),x=B=>this.featureState.hotkeys&&this.featureState[B];if((u.ctrlKey||u.metaKey)&&u.key==="k"){if(!w||!x("hotkeys.commandPalette")||!this.featureState.commandPalette)return;u.preventDefault(),this.toggleCommandPalette()}else if((u.ctrlKey||u.metaKey)&&(u.key==="p"||u.key==="P")){if(!w||!x("hotkeys.symbolSearch")||!this.featureState.symbolSearch)return;u.preventDefault(),(O=this.symbolSearch)==null||O.open(this.symbols,this.state.symbol,void 0,this.symbolSearchFn())}else if((u.ctrlKey||u.metaKey)&&!u.altKey&&!u.shiftKey&&(u.key==="s"||u.key==="S")){if(!this.layoutSession||!x("hotkeys.save")||!this.featureState.layouts||nt()||!Ct(this.root,!0))return;u.preventDefault(),this.saveLayout()}else if(u.altKey&&!u.ctrlKey&&!u.metaKey&&!u.shiftKey&&je[u.code]){if(u.defaultPrevented||nt()||!w||ze()||!x("hotkeys.tools"))return;u.preventDefault(),this.handleDrawingTool(je[u.code])}else if(/^[0-9]$/.test(u.key)&&!u.ctrlKey&&!u.metaKey&&!u.altKey){if(u.defaultPrevented||!this.intervalInput||!x("intervalTyping")||nt()||ze()||!Ct(this.root,!0))return;const B=document.activeElement;if(B&&B!==document.body&&!this.root.contains(B))return;u.preventDefault(),this.intervalInput.open(u.key)}else if(u.altKey&&!u.ctrlKey&&!u.metaKey&&(u.code==="KeyI"||u.code==="KeyG"||u.code==="KeyR")){if(nt()||!w)return;if(u.code==="KeyI"){if(!x("hotkeys.invertScale"))return;u.preventDefault(),this.changeSettings({invertScale:!this.settingsState.invertScale}),(_=this.settings)==null||_.refresh(this.settingsState)}else if(u.code==="KeyR"){if(!x("hotkeys.resetView"))return;u.preventDefault(),this.resetView()}else this.goToDate&&x("hotkeys.goToDate")&&this.featureState.goToDate&&(u.preventDefault(),this.toggleGoToDate())}else if(u.key==="?"&&!u.ctrlKey&&!u.metaKey&&!u.altKey){if(nt()||!w||!x("hotkeys.help")||!this.featureState.hotkeySheet)return;u.preventDefault(),(Y=this.hotkeySheet)==null||Y.open({isOn:B=>this.sheetKeyOn(B),extra:this.hostHotkeys.map(B=>({keys:B.parsed.display,text:B.spec.label}))})}},document.addEventListener("keydown",this.boundGlobalKeydown),document.addEventListener("fullscreenchange",this.onFullscreenChange),this.unregisterKeys=Es(this.root),e.adapter?(this.adapter=e.adapter,this.connectStream()):this.chart.setDataTimeframe(this.state.timeframe),this.watchlist&&(this.watchlistInterval=setInterval(()=>this.tickWatchlist(),1e3)),this.markSwitchedOff(),requestAnimationFrame(()=>{var u,w;this.destroyed||((u=this.toolbar)==null||u.tidy(),(w=this.sidebar)==null||w.tidy())}),this.refreshMarket(),this.updateUI(),(bt=e.onReady)==null||bt.call(e,this.chart),e.shareUrl&&typeof location<"u"){const u=ol(location.hash);u&&this.importState(u)}}setSymbols(t){this.symbols=t;const e=this.watchlistStore;e&&this.watchlistFromSymbols&&e.replace(e.getLists().map(r=>r.id==="default"?{...r,symbols:t}:r))}getWatchlists(){var t;return((t=this.watchlistStore)==null?void 0:t.getLists())??[]}getActiveWatchlist(){var t;return((t=this.watchlistStore)==null?void 0:t.getActive().id)??null}setWatchlists(t,e){var r;this.watchlistFromSymbols=!1,(r=this.watchlistStore)==null||r.replace(t,e)}setActiveWatchlist(t){var e;(e=this.watchlistStore)==null||e.setActive(t)}addToWatchlist(t,e){var r;(r=this.watchlistStore)==null||r.add(t,e)}removeFromWatchlist(t,e){var r;(r=this.watchlistStore)==null||r.removeSymbol(t,e)}setQuotes(t){const e=t.map(Cr).filter(r=>r!==null);e.length>0&&this.takeQuotes(e)}getQuote(t){const e=this.quotes.get(t);return e?{...e}:null}toggleSymbolInfo(t){const e=this.symbolInfoPanel;if(!e)return;const r=t??!e.isOpen();r&&!this.featureState.symbolInfo||(r?e.open():e.close())}refreshMarket(){var e;if(ee())return;const t=Wn(this.chart.getSymbolInfo(),Date.now());(e=this.statusBar)==null||e.setMarket(t.state,this.t(t.state==="open"?"symbolInfo.open":"symbolInfo.closed")),this.refreshSymbolInfo()}refreshSymbolInfo(){const t=this.symbolInfoPanel;!(t!=null&&t.isOpen())||this.destroyed||t.render(this.symbolInfoView())}symbolInfoView(){const t=this.state.symbol;return Ua({symbol:t,info:this.chart.getSymbolInfo(),quote:this.quotes.get(t),bars:this.chart.getData(),formatPrice:e=>this.formatAlertPrice(e),t:this.t,textLocale:this.textLocale(),numberLocale:this.intlLocale(),now:Date.now()})}loadNews(){const t=this.symbolInfoPanel;if(!(t!=null&&t.isOpen()))return;const e=this.options.adapter,r=this.options.news??(e!=null&&e.fetchNews?e.fetchNews.bind(e):null);this.news.load(this.state.symbol,r,n=>t.renderNews(n),this.textLocale(),()=>this.destroyed)}intlLocale(){return this.settingsState.numberLocale||this.options.locale||"en"}textLocale(){return this.options.locale||"en"}createWatchlist(t,e){var o;const r=e.persist?Dl():null,n=new $a({lists:e.lists,activeList:e.activeList,symbols:this.symbols,defaultName:this.t("watchlist.title"),storage:r,storageKey:e.storageKey});this.watchlistStore=n,this.watchlistFromSymbols=!e.lists&&!e.persist,this.quoteSource=e.quotes===!1?null:e.quotes??((o=this.options.adapter)!=null&&o.subscribeQuotes?this.options.adapter:null);const s=c=>this.t(c);this.watchlist=new Ba(t,{onSelect:c=>{this.setSymbol(c)},onAdd:()=>{var c;return(c=this.symbolSearch)==null?void 0:c.open(this.symbols,this.state.symbol,l=>n.add(l),this.symbolSearchFn())},onRemove:c=>n.removeSymbol(c),onMove:(c,l)=>n.move(c,l),onPickList:c=>n.setActive(c),onCreateList:c=>n.create(c),onRenameList:(c,l)=>n.rename(c,l),onDeleteList:c=>n.remove(c)},{title:s("watchlist.title"),lists:s("watchlist.lists"),newList:s("watchlist.newList"),rename:s("watchlist.rename"),deleteList:s("watchlist.deleteList"),confirmDelete:s("watchlist.confirmDelete"),add:s("watchlist.add"),remove:s("watchlist.remove"),empty:s("watchlist.empty"),listName:s("watchlist.listName")},{collapsible:e.collapsible===!0}),this.watchlist.setActive(this.state.symbol),this.watchlist.setLocale(this.settingsState.numberLocale||void 0);const a=()=>{var c;(c=this.watchlist)==null||c.setLists(n.getLists(),n.getActive().id),this.followQuotes()};n.subscribe(()=>{var c;a(),(c=e.onChange)==null||c.call(e,n.getLists(),n.getActive().id)}),a()}followQuotes(){var r;if(!this.quoteSource||!this.watchlistStore||this.destroyed)return;const t=this.watchlistStore.getActive().symbols,e=[...t].sort().join("\0");if(e!==this.quotedKey&&(this.quotedKey=e,(r=this.stopQuotes)==null||r.call(this),this.stopQuotes=null,t.length!==0))try{this.stopQuotes=this.quoteSource.subscribeQuotes(t,n=>{if(this.destroyed||!Array.isArray(n))return;const s=n.map(Cr).filter(a=>a!==null);s.length>0&&this.takeQuotes(s)})}catch{this.stopQuotes=null}}takeQuotes(t){var e;for(const r of t){const n={...this.quotes.get(r.symbol),...r};this.quotes.set(n.symbol,n);const s=this.watchlistSparkBuffer.get(n.symbol)??[];s.push(n.last),s.length>40&&s.shift(),this.watchlistSparkBuffer.set(n.symbol,s);const a=this.hostWatchlistRefPrice.get(n.symbol);(e=this.watchlist)==null||e.setEntry(n.symbol,{lastPrice:n.last,refPrice:a??(n.change!==void 0?n.last-n.change:void 0),sparkline:s.slice()})}t.some(r=>r.symbol===this.state.symbol)&&this.refreshSymbolInfo()}async setSymbol(t){var e,r,n,s;this.flushActiveLayout(),t!==this.state.symbol&&this.chart.clearFills(),this.state={...this.state,symbol:t},this.sessionRefPrice=null,(r=(e=this.options).onSymbolChange)==null||r.call(e,t),this.updateUI(),(n=this.watchlist)==null||n.setActive(t),this.refreshMarket(),this.loadNews(),(s=this.layoutSession)==null||s.changed(),this.adapter&&await this.connectStream()}setWatchlistEntry(t,e){var r;e.refPrice!==void 0&&this.hostWatchlistRefPrice.set(t,e.refPrice),(r=this.watchlist)==null||r.setEntry(t,e)}tickWatchlist(){if(!this.watchlist||this.quotes.has(this.state.symbol)||ee())return;const t=this.chart.getData();if(t.length===0)return;const e=t[t.length-1],r=this.hostWatchlistRefPrice.get(this.state.symbol);r===void 0&&this.sessionRefPrice===null&&(this.sessionRefPrice=t[0].open);const n=this.watchlistSparkBuffer.get(this.state.symbol)??[];n.push(e.close),n.length>40&&n.shift(),this.watchlistSparkBuffer.set(this.state.symbol,n),this.watchlist.setEntry(this.state.symbol,{lastPrice:e.close,refPrice:r??this.sessionRefPrice??t[0].open,sparkline:n.slice()})}async setTimeframe(t){this.chart.isTimeframeAllowed(t)&&(this.chosenTimeframe=t,this.rangeSeq++,await this.switchTimeframe(t))}async switchTimeframe(t){var e,r,n;if(this.state={...this.state,timeframe:t},(r=(e=this.options).onTimeframeChange)==null||r.call(e,t),this.updateUI(),(n=this.layoutSession)==null||n.changed(),this.adapter){await this.connectStream();return}if(this.chart.setDataTimeframe(t),this.options.resampleTimeframes!==!1){if(!this.baseSeries){const s=this.chart.getData();s.length>0&&(this.baseSeries=s,this.baseTimeframeMs=be(s))}await this.switchLocalTimeframe()}}setTheme(t){const e=this.resolveIsDark(t),r=this.resolveTheme(t);this.themeOf={...this.themeOf,[e?"dark":"light"]:r},this.state={...this.state,isDark:e},this.root.dataset.tcwTheme=e?"dark":"light",this.portal.dataset.tcwTheme=this.root.dataset.tcwTheme,this.keepingLook(()=>this.chart.setTheme(r)),this.updateUI()}getChart(){return this.chart}setUI(t){this.ui=ft(t),wt(this.root,this.ui),wt(this.portal,this.ui),this.applyChartShapes(),this.applyLegendFont()}getUI(){return ft({...this.ui})}applyLegendFont(){this.chart.setLegend({fontFamily:this.ui.font.mono,fontSize:mt(this.ui.font.size,-1)})}applyChartShapes(){this.chart.setShapes({tagRadius:this.ui.tagRadius})}destroy(){var t,e,r,n,s,a,o,c,l,h,p,m,f,g,v,y,L,C,E,R,U,K,q,G,bt,u,w,x,A,O,_,Y,B,Bt,ur,pr,mr,wr,fr,gr,br;if(!this.destroyed){this.destroyed=!0,(t=this.stopKeyboardInset)==null||t.call(this),this.stopKeyboardInset=null,(e=this.stopNarrow)==null||e.call(this),this.stopNarrow=null,(r=this.stopFormControls)==null||r.call(this),this.stopFormControls=null,this.boundGlobalKeydown&&document.removeEventListener("keydown",this.boundGlobalKeydown),document.removeEventListener("fullscreenchange",this.onFullscreenChange),this.unregisterKeys(),this.tooltip.destroy(),this.legendFrame&&cancelAnimationFrame(this.legendFrame),(n=this.indicatorLegend)==null||n.destroy(),this.portal.remove(),document.fullscreenElement===this.root&&document.exitFullscreen().catch(()=>{}),this.flushActiveLayout(),(s=this.commandPalette)==null||s.destroy(),(a=this.symbolSearch)==null||a.destroy(),(o=this.hotkeySheet)==null||o.destroy(),this.replayPollInterval&&clearInterval(this.replayPollInterval),(c=this.replayShade)==null||c.remove(),(l=this.replayBar)==null||l.destroy(),(h=this.dragDrop)==null||h.detach(),(p=this.alertsPanel)==null||p.destroy(),(m=this.objectTree)==null||m.destroy(),(f=this.indicatorSettings)==null||f.destroy(),(g=this.indicatorPicker)==null||g.destroy(),(v=this.drawingStyle)==null||v.destroy(),(y=this.drawingSettings)==null||y.destroy(),(L=this.drawingMenu)==null||L.destroy(),(C=this.selectionToolbar)==null||C.destroy(),this.selectionToolbarFrame!==null&&cancelAnimationFrame(this.selectionToolbarFrame),(E=this.chartMenu)==null||E.destroy(),(R=this.legendMenu)==null||R.destroy();for(const Ms of this.hostMenus)Ms.destroy();this.hostMenus.clear(),(U=this.templatePrompt)==null||U.destroy(),(K=this.chartTemplatePrompt)==null||K.destroy(),(q=this.intervalInput)==null||q.destroy(),(G=this.markerTip)==null||G.remove(),(bt=this.layoutSession)==null||bt.destroy(),(u=this.layoutsUI)==null||u.destroy(),(w=this.accountPanel)==null||w.destroy(),(x=this.orderTicket)==null||x.destroy(),this.accountFrame&&cancelAnimationFrame(this.accountFrame),(A=this.bracketBar)==null||A.destroy(),(O=this.alertNotifier)==null||O.destroy(),(_=this.depthLadder)==null||_.destroy(),(Y=this.dataWindow)==null||Y.destroy(),this.watchlistInterval&&clearInterval(this.watchlistInterval),this.marketTimer&&clearInterval(this.marketTimer),this.clockTimer&&clearInterval(this.clockTimer),this.onPageShown&&document.removeEventListener("visibilitychange",this.onPageShown),this.onPageShown=null,(B=this.chartNav)==null||B.destroy(),(Bt=this.symbolInfoPanel)==null||Bt.destroy(),(ur=this.stopQuotes)==null||ur.call(this),this.stopQuotes=null,(pr=this.watchlist)==null||pr.destroy(),(mr=this.toolbar)==null||mr.destroy(),(wr=this.sidebar)==null||wr.destroy(),(fr=this.settings)==null||fr.destroy(),(gr=this.statusBar)==null||gr.destroy(),(br=this.goToDate)==null||br.destroy(),this.loading.destroy(),this.historyPill.destroy(),this.chart.destroy(),this.root.remove(),es()}}handleSymbolClick(){var t;this.featureState.symbolSearch&&((t=this.symbolSearch)==null||t.open(this.symbols,this.state.symbol,void 0,this.symbolSearchFn()))}symbolSearchFn(){if(this.options.searchSymbols)return this.options.searchSymbols;const t=this.adapter;if(t!=null&&t.searchSymbols)return(e,r)=>t.searchSymbols(e,{signal:r,limit:50})}handleTimeframe(t){this.setTimeframe(t)}applyRangePreset(t){const e=++this.rangeSeq;return this.rangeQueue=this.rangeQueue.then(()=>this.runRangePreset(t,e)).catch(r=>{this.say(r instanceof Error?r.message:String(r),"error")}),this.rangeQueue}async runRangePreset(t,e){const r=()=>e===this.rangeSeq&&!this.destroyed;if(!r())return;this.chosenTimeframe??(this.chosenTimeframe=this.state.timeframe);const n=this.featureState["statusBar.rangeTimeframe"]?this.timeframeForPreset(t):this.state.timeframe;n!==this.state.timeframe&&(await this.switchTimeframe(n),!r()||this.adapter&&this.state.connectionState==="error")||this.chart.setVisibleRangePreset(t)}timeframeForPreset(t){const e=this.state.timeframe,r=this.chart.getData();if(r.length<2)return e;const n=pt(r),s=r[r.length-1].time*n,a=t==="All"?r[0].time*n:ei(t,s,this.displayTimezone());if(a===null)return e;let o=r.length-1;for(;o>0&&r[o-1].time*n>=a;)o--;const c=this.displayTimezone(),l=r.slice(-200).some(h=>{const p=h.time*n,m=new Date(p+Lt(c,p)*6e4).getUTCDay();return m===0||m===6});return Zi({dayShare:l?1:5/7,spanMs:s-a,barsInSpan:r.length-o,width:this.chart.getPlotRect().width,current:e,chosen:this.chosenTimeframe??e,available:this.timeframes.filter(h=>this.chart.isTimeframeAllowed(h)&&this.canShowTimeframe(h))})}canShowTimeframe(t){if(this.adapter)return zt(this.adapter,t);if(this.options.resampleTimeframes===!1)return!1;const e=this.chart.getData();if(e.length<2)return!1;const r=this.baseSeries?this.baseTimeframeMs:be(e);return!(r>0)||z(t)>=r}toggleFullscreen(){if(document.fullscreenElement===this.root){document.exitFullscreen().catch(()=>{});return}this.root.requestFullscreen().catch(t=>{this.say(t instanceof Error?t.message:this.t("toast.fullscreenUnavailable"),"error")})}drawingToolName(t){var n;const e=`tool.${t}`,r=this.t(e);return r===e?((n=this.chart.getDrawingToolDescriptor(t))==null?void 0:n.name)??t:r}chartOffset(){const t=this.chartContainer.getBoundingClientRect(),e=this.root.getBoundingClientRect();return{x:t.left-e.left,y:t.top-e.top}}scheduleSelectionToolbar(){var t;this.selectionToolbarFrame!==null||!((t=this.selectionToolbar)!=null&&t.isOpen())||(this.selectionToolbarFrame=requestAnimationFrame(()=>{this.selectionToolbarFrame=null,this.updateSelectionToolbar()}))}updateSelectionToolbar(){const t=this.selectionToolbar;if(!t||this.destroyed)return;const e=this.chart.getSelectedDrawingIds();if(!this.featureState.selectionToolbar||!(e!=null&&e.length)){t.hide();return}const r=new Set(e),n=this.chart.getDrawings().filter(h=>r.has(h.id)&&h.visible);if(this.chart.getDrawingTool()!==null||this.chart.isEraserMode()||this.chart.isZoomAreaMode()||n.length===0){t.hide();return}const a=this.chartOffset(),o=this.chart.getPlotRect(),c=Bl(n.map(h=>this.chart.getDrawingRect(h.id)))??{x:o.x+o.width/2,y:o.y,width:0,height:0},l=n[0];t.show({rect:{x:c.x+a.x,y:c.y+a.y,width:c.width,height:c.height},bounds:{x:o.x+a.x,y:o.y+a.y,width:o.width,height:o.height},style:l.style,locked:n.every(h=>h.locked),canDelete:n.some(h=>!h.locked),canSettings:this.drawingSettings!==null&&this.featureState.drawingSettings&&n.length===1,canAlert:this.featureState.alerts&&n.length===1&&this.chart.canAddDrawingAlert(l.id)})}openDrawingSettings(t){const e=this.chart.getDrawings().find(n=>n.id===t),r=e?this.chart.getDrawingToolDescriptor(e.type):null;!e||!r||!this.drawingSettings||!this.featureState.drawingSettings||this.drawingSettings.open({id:t,type:e.type,name:this.drawingToolName(e.type),style:{...e.style},options:this.chart.getDrawingOptions(t),defs:r.options??{},anchors:e.anchors.map(n=>({...n})),fill:r.fill===!0,text:r.text===!0,alertable:this.chart.canAddDrawingAlert(t)})}addDrawingAlert(t){if(!this.featureState.alerts)return;const e=this.chart.getDrawings().find(n=>n.id===t),r=e?this.drawingToolName(e.type):"";this.chart.addDrawingAlert(t,{label:r})&&this.say(S(this.t("drawingSettings.alertAdded"),{name:r}))}openDrawingMenu(t,e,r){var f,g;if(!this.drawingMenu||!this.featureState["menu.drawing"])return;const n=new Map(this.chart.getDrawings().map(v=>[v.id,v])),s=this.chart.getSelectedDrawingIds().flatMap(v=>{var L;const y=n.get(v);return y?[{id:y.id,locked:y.locked,groupId:((L=y.group)==null?void 0:L.id)??null}]:[]});if(s.length===0)return;const a=ne(sc({selected:s,canConfigure:this.drawingSettings!==null,canAlert:this.chart.canAddDrawingAlert(t)},this.t),Ni,this.featureState),o=s.map(v=>v.id),c=n.get(t),l=c?((g=(f=this.options).drawingMenuItems)==null?void 0:g.call(f,{id:t,type:c.type,selected:o}))??[]:[],h=Zt(a,l);if(h.length===0)return;const p=this.chartContainer.getBoundingClientRect(),m=this.root.getBoundingClientRect();this.drawingMenu.open(h,p.left-m.left+e,p.top-m.top+r,v=>{Qt(v,l)||this.runDrawingMenuAction(t,o,v)})}runDrawingMenuAction(t,e,r){var n,s,a;switch(r){case"settings":this.openDrawingSettings(t);return;case"alert":this.addDrawingAlert(t);return;case"front":case"forward":case"backward":case"back":this.chart.moveDrawing(t,r);break;case"group":this.chart.groupDrawings(e);break;case"ungroup":{const o=new Set(this.chart.getDrawings().filter(c=>e.includes(c.id)).map(c=>{var l;return(l=c.group)==null?void 0:l.id}));for(const c of o)c&&this.chart.ungroupDrawings(c);break}case"lock":case"unlock":this.chart.setDrawingsLocked(e,r==="lock");break;case"hide":this.chart.setDrawingsVisible(e,!1);break;case"duplicate":this.chart.duplicateDrawing(t);break;case"delete":{const o=(n=this.drawingSettings)==null?void 0:n.editing();o&&e.includes(o)&&((s=this.drawingSettings)==null||s.close(!0)),this.chart.removeDrawings(e);break}}(a=this.objectTree)!=null&&a.isOpen()&&this.refreshObjects()}chartMenuContext(t){const e=this.chart.getDrawings(),r=this.chart.getData(),n=this.settingsState,s=this.chart.getFeatures();return{price:t,lastPrice:r.length>0?r[r.length-1].close:null,formatPrice:a=>this.formatAlertPrice(a),canAlert:this.alertsPanel!==null,canTrade:this.options.trading!==!1,canOrderTicket:this.orderTicket!==null,canDraw:!0,hasDrawings:e.length>0,drawingsHidden:e.length>0&&e.every(a=>!a.visible),canPaste:this.chart.canPasteDrawings(),hasIndicators:s.indicators!==!1&&this.removableIndicators().length>0,canGoToDate:this.goToDate!==null,canExport:this.canExport,autoScale:this.chart.isAutoScale(),scaleMode:n.scaleMode,canLog:s.logScale!==!1,inverted:this.chart.isInvertScale(),leftScale:n.leftPriceScale,labels:{values:n.indicatorValueLabels,...s.barCountdown!==!1?{countdown:n.barCountdown}:{}},lines:{highLow:n.highLowLines,lastPrice:this.chart.getStyleValue("lastPrice.visible")!==!1},timezone:{current:n.timezone,options:this.timezoneChoices()},keys:Object.fromEntries(ic.filter(a=>this.featureState.hotkeys&&this.featureState[a.feature]).map(a=>[a.action,a.keys]))}}removableIndicators(){return this.chart.getActiveIndicators().filter(t=>!kr.has(t.id)).map(t=>t.instanceId)}timezoneChoices(){var e,r;const t=(e=this.adapter)!=null&&e.resolveSymbol?{label:this.t("settings.timezone.exchange"),zone:((r=this.chart.getSymbolInfo())==null?void 0:r.timezone)??null}:void 0;return $e(this.settingsState.timezone,Date.now(),this.t("settings.timezone.local"),t).map(({value:n,label:s})=>({value:n,label:s}))}openChartMenu(t,e,r,n){var l,h;if(!this.chartMenu)return;const s=((h=(l=this.options).chartMenuItems)==null?void 0:h.call(l,n))??[],a=Zt(t,s);if(a.length===0)return;const o=this.chartContainer.getBoundingClientRect(),c=this.root.getBoundingClientRect();this.chartMenu.open(a,o.left-c.left+e,o.top-c.top+r,p=>{Qt(p,s)||(p.startsWith(Ke)?this.changeSettings({timezone:p.slice(Ke.length)}):this.runChartMenuAction(p,n))})}setFeatures(t){var n,s;const e=this.featureState;this.featureState={...e,...er(t)};const r=a=>e[a]!==this.featureState[a];this.markSwitchedOff(),this.closeSwitchedOff(a=>e[a]&&!this.featureState[a]),r("selectionToolbar")&&this.updateSelectionToolbar(),r("indicatorLegend")&&(this.chart.setPaneTitlesVisible(!this.featureState.indicatorLegend),this.scheduleLegend()),r("menu.priceAxisAdd")&&this.chart.setFeatures({priceAxisAddButton:this.priceAxisAddDefault&&this.featureState["menu.priceAxisAdd"]}),r("dragDropImport")&&(this.featureState.dragDropImport?(n=this.dragDrop)==null||n.attach():(s=this.dragDrop)==null||s.detach()),["toolbar","sidebar","statusBar","accountPanel"].some(r)&&this.chart.resize()}getFeatures(){return{...this.featureState}}isFeatureOn(t){return this.featureState[t]===!0}closeSwitchedOff(t){var r;t("replay")&&((r=this.replayBar)!=null&&r.isMounted())&&this.exitReplay();const e=[["alerts",()=>{var n;return(n=this.alertsPanel)==null?void 0:n.close()}],["objectTree",()=>{var n;return(n=this.objectTree)==null?void 0:n.close()}],["symbolInfo",()=>{var n;return(n=this.symbolInfoPanel)==null?void 0:n.close()}],["dataWindow",()=>{var n;return(n=this.dataWindow)==null?void 0:n.close()}],["accountPanel",()=>this.toggleAccountPanel(!1)],["orderTicket",()=>{var n;return(n=this.orderTicket)==null?void 0:n.close()}],["depthLadder",()=>{var n;return(n=this.depthLadder)==null?void 0:n.close()}],["goToDate",()=>{var n;return(n=this.goToDate)==null?void 0:n.close()}],["settings",()=>{var n;return(n=this.settings)==null?void 0:n.close()}],["indicatorSettings",()=>{var n;return(n=this.indicatorSettings)==null?void 0:n.close()}],["toolbar.indicators",()=>{var n;return(n=this.indicatorPicker)==null?void 0:n.close()}],["drawingSettings",()=>{var n;return(n=this.drawingSettings)==null?void 0:n.close(!1)}],["sidebar",()=>{var n;return(n=this.drawingStyle)==null?void 0:n.close()}],["commandPalette",()=>{var n;return(n=this.commandPalette)==null?void 0:n.close()}],["hotkeySheet",()=>{var n;return(n=this.hotkeySheet)==null?void 0:n.close()}],["symbolSearch",()=>{var n;return(n=this.symbolSearch)==null?void 0:n.close()}],["menu.chart",()=>{var n;return(n=this.chartMenu)==null?void 0:n.close()}],["menu.priceAxisAdd",()=>{var n;return(n=this.chartMenu)==null?void 0:n.close()}],["menu.drawing",()=>{var n;return(n=this.drawingMenu)==null?void 0:n.close()}],["indicatorLegend",()=>{var n;return(n=this.legendMenu)==null?void 0:n.close()}],["indicatorLegend.more",()=>{var n;return(n=this.legendMenu)==null?void 0:n.close()}]];for(const[n,s]of e)t(n)&&s()}addHotkey(t){const e=fl(t.keys);if(!e)return console.warn(`[ChartWidget] Can't read the shortcut "${t.keys}": modifiers (Ctrl, Alt, Shift) and a key, joined by +.`),null;vl(e)&&console.warn(`[ChartWidget] The chart answers ${t.keys} itself (drawings, scrolling or zoom): both will run.`);const r={spec:t,parsed:e};return this.hostHotkeys=[...this.hostHotkeys,r],{remove:()=>{this.hostHotkeys=this.hostHotkeys.filter(n=>n!==r)}}}handleHostHotkey(t){var s;if(this.hostHotkeys.length===0||!this.featureState.hotkeys||t.isComposing||t.keyCode===Al||(s=t.getModifierState)!=null&&s.call(t,"AltGraph")||t.defaultPrevented||nt()||yl(t)||ze())return!1;const e=this.hostHotkeys.find(a=>gl(t,a.parsed));if(!e)return!1;const r=!e.parsed.ctrl&&!e.parsed.alt;if(!Ct(this.root,r))return!1;const n=document.activeElement;return r&&n&&n!==document.body&&!this.root.contains(n)?!1:(t.preventDefault(),e.spec.onPress(t),!0)}keepingLook(t){var n,s,a;this.settingsEdit&&((n=this.settings)==null||n.close());const e=((a=(s=this.chart).getOverrides)==null?void 0:a.call(s,{layer:"user"}))??{},r=Object.fromEntries(Ml.filter(o=>e[o]!==void 0).map(o=>[o,e[o]]));t(),Object.keys(r).length>0&&this.chart.applyOverrides(r,{layer:"user"})}sheetKeyOn(t){const e=this.featureState;if(!e.hotkeys||!e[t])return!1;switch(t){case"hotkeys.commandPalette":return e.commandPalette;case"hotkeys.symbolSearch":return e.symbolSearch;case"hotkeys.goToDate":return e.goToDate;case"hotkeys.save":return e.layouts&&this.layoutSession!==null;case"hotkeys.help":return e.hotkeySheet;case"intervalTyping":return this.intervalInput!==null;default:return!0}}markSwitchedOff(){var e,r,n;const t=Ii(this.featureState);for(const s of[this.root,this.portal])t?s.dataset.tcwOff=t:delete s.dataset.tcwOff;(e=this.toolbar)==null||e.setSymbolSearch(this.featureState.symbolSearch),(r=this.toolbar)==null||r.tidy(),(n=this.sidebar)==null||n.tidy()}addToolbarButton(t){if(!this.toolbar)return null;const e=this.toolbar,r=e.addHostButton(t);return e.tidy(),{element:r,setActive:n=>Xr(r,n,t.toggle===!0),setText:n=>Jr(r,t.label,n),remove:()=>{r.remove(),e.tidy()}}}addToolbarDropdown(t){const e=this.toolbar;if(!e)return null;const r=new W(this.root,t.label);this.hostMenus.add(r);const n=e.addHostButton({id:t.id,label:t.label,icon:t.icon,text:t.text,side:t.side,onClick:s=>{if(r.isOpen()){r.close();return}const a=t.items();if(a.length===0)return;const o=s.getBoundingClientRect(),c=this.root.getBoundingClientRect();r.open(Zt([],a),o.left-c.left,o.bottom-c.top+2,l=>Qt(l,a),s)}});return n.setAttribute("aria-haspopup","menu"),n.setAttribute("aria-expanded","false"),e.tidy(),{element:n,setText:s=>Jr(n,t.label,s),remove:()=>{r.destroy(),this.hostMenus.delete(r),n.remove(),e.tidy()}}}addSidebarButton(t){const e=this.sidebar;if(!e)return null;const r=e.addHostButton(t);return{element:r,setActive:n=>Xr(r,n,t.toggle===!0),remove:()=>{r.remove(),e.tidy()}}}addStatusBarItem(t){if(!this.statusBar)return null;const e=this.statusBar.addHostItem(t);return{element:e,setText:r=>{e.textContent=r,t.label&&t.label!==r?e.setAttribute("aria-label",`${t.label}: ${r}`):e.removeAttribute("aria-label")},remove:()=>e.remove()}}getSlot(t){var e,r,n,s,a;switch(t){case"toolbar.left":return((e=this.toolbar)==null?void 0:e.hostSlot("left"))??null;case"toolbar.right":return((r=this.toolbar)==null?void 0:r.hostSlot("right"))??null;case"sidebar":return((n=this.sidebar)==null?void 0:n.hostSlot())??null;case"statusBar.left":return((s=this.statusBar)==null?void 0:s.hostSlot("left"))??null;case"statusBar.right":return((a=this.statusBar)==null?void 0:a.hostSlot("right"))??null;case"chart":return this.hostLayer||(this.hostLayer=document.createElement("div"),this.hostLayer.className="tcw-host-layer",this.chartContainer.appendChild(this.hostLayer)),this.hostLayer;default:return null}}runChartMenuAction(t,e){var o;const{price:r}=e,n=r??NaN,s=this.settingsState,a=ac(t);if(a){this.changeSettings({scaleMode:a});return}switch(t){case"alert":this.chart.addAlert(n,"crossing"),this.say(S(this.t("chartMenu.alertAdded"),{price:this.formatAlertPrice(n)}));break;case"buyLimit":case"sellLimit":case"buyStop":case"sellStop":this.placeOrderAt(t,n);break;case"orderTicket":this.openOrderTicket(r);break;case"exportData":this.chart.exportAllData("csv",`${this.state.symbol}-${this.state.timeframe}.csv`.replace(/[^\w.-]+/g,"_"));break;case"paneLog":case"paneInvert":case"panePercent":{const c=this.menuPane;if(!c)break;const l=this.chart.getPaneScale(c);this.chart.setPaneScale(c,t==="paneLog"?{log:!l.log}:t==="paneInvert"?{invert:!l.invert}:{percent:!l.percent});break}case"horizontalLine":{const c=this.chart.getData();c.length>0&&this.chart.addDrawing({type:"horizontalLine",anchors:[{time:c[c.length-1].time,price:n}]});break}case"resetView":this.resetView();break;case"resetPriceScale":this.changeSettings({autoScale:!0});break;case"paste":this.chart.pasteDrawings();break;case"removeIndicators":this.chart.removeIndicators(this.removableIndicators());break;case"hideDrawings":this.chart.setDrawingsVisible(this.chart.getDrawings().map(c=>c.id),!1);break;case"showDrawings":this.chart.setDrawingsVisible(this.chart.getDrawings().map(c=>c.id),!0);break;case"removeDrawings":this.chart.removeDrawings(this.chart.getDrawings().map(c=>c.id));break;case"settings":this.openSettings(e.area==="priceAxis"?"scales":void 0);break;case"autoScale":this.changeSettings({autoScale:!this.chart.isAutoScale()});break;case"invertScale":this.changeSettings({invertScale:!this.chart.isInvertScale()});break;case"leftScale":this.changeSettings({leftPriceScale:!s.leftPriceScale});break;case"indicatorValueLabels":this.changeSettings({indicatorValueLabels:!s.indicatorValueLabels});break;case"barCountdown":this.changeSettings({barCountdown:!s.barCountdown});break;case"highLowLines":this.changeSettings({highLowLines:!s.highLowLines});break;case"lastPriceLine":this.changeStyle({"lastPrice.visible":this.chart.getStyleValue("lastPrice.visible")===!1});break;case"goToDate":this.toggleGoToDate();break}(o=this.objectTree)!=null&&o.isOpen()&&this.refreshObjects()}toggleAccountPanel(t){const e=this.accountPanel;!e||t===e.isOpen()||!e.isOpen()&&!this.featureState.accountPanel||e.toggle()}openOrderTicket(t){var r;if(!this.featureState.orderTicket)return;const e=this.chart.getData();(r=this.orderTicket)==null||r.open({price:t,lastPrice:e.length>0?e[e.length-1].close:null,rules:this.orderRules()})}orderRules(){var r;const t=this.chart.getMarket();return t?{roundPrice:t.priceStep!==void 0||(((r=t.priceSteps)==null?void 0:r.length)??0)>0?n=>this.chart.roundPrice(n):void 0,limits:this.chart.getPriceLimits(),lot:t.volumeUnit}:{}}refreshAccountSoon(){this.accountFrame||!this.accountPanel||(this.accountFrame=requestAnimationFrame(()=>{this.accountFrame=0,this.destroyed||this.refreshAccount()}))}refreshAccount(){var r;if(!this.accountPanel)return;const t=this.chart.getData(),e=t.length>0?t[t.length-1].close:null;this.accountPanel.update({positions:this.chart.getPositions(),orders:this.chart.getOrders(),fills:this.chart.getFills(),price:e,realisedPnl:this.chart.getRealisedPnl()}),(r=this.orderTicket)==null||r.setLastPrice(e)}placeOrderAt(t,e){const r=t.startsWith("buy")?"buy":"sell",n=t.endsWith("Stop");this.chart.placeOrderIntent(n?{side:r,type:"stop",price:e,stopPrice:e,quantity:1}:{side:r,type:"limit",price:e,quantity:1}),this.say(S(this.t(`order.${t}`),{price:this.formatAlertPrice(e)}))}clockNow(){const t=Date.now(),e=this.displayTimezone(),r=s=>String(s).padStart(2,"0"),{time:n}=Q(t,e);return{time:`${n}:${r(new Date(t).getUTCSeconds())}`,zone:St(Lt(e,t))}}refreshDrawingsState(){var r;const t=this.chart.getDrawings()??[],e=t.length>0;(r=this.sidebar)==null||r.setDrawingsState({locked:e&&t.every(n=>n.locked),hidden:e&&t.every(n=>!n.visible)})}refreshScaleSwitches(){var t;(t=this.statusBar)==null||t.setScale({mode:this.chart.getScaleMode(),auto:this.chart.isAutoScale()})}toggleScaleMode(t){this.changeSettings({scaleMode:this.chart.getScaleMode()===t?"regular":t})}displayTimezone(){const t=Re(this.settingsState.timezone);return t==="exchange"?this.chart.getEffectiveTimezone():t}toggleGoToDate(){if(!this.goToDate||!this.featureState.goToDate)return;if(this.goToDate.isOpen()){this.goToDate.close();return}const t=this.chart.getData();t.length!==0&&this.goToDate.open(Q(t[t.length-1].time*pt(t),this.displayTimezone()),this.root.querySelector('[data-role="goto"]'))}goToWallTime(t,e){const r=Tn(t,e,this.displayTimezone()),n=this.chart.getData();if(r===null||n.length===0)return;const s=r/pt(n);this.chart.goToTime(s),s<n[0].time&&this.say(this.t("range.beforeData"))}pinnedTimeframes(){const t=this.timeframeFavorites.list();return this.timeframes.filter(e=>t.includes(e))}timeframeMenu(){return this.timeframes.map(t=>({value:t,label:Ur(t),custom:this.customTimeframes.has(t)}))}handleAddTimeframe(t){var r;if(!this.featureState.customTimeframes)return!1;const e=_e(t);return!e||!this.chart.isTimeframeAllowed(e)||this.adapter&&!zt(this.adapter,e)||!this.adapter&&gt(e)!==null?!1:(this.timeframes.includes(e)||(this.customTimeframes.add(e),this.timeframeFavorites.add(e),this.timeframes=ke(this.timeframes,[e]),(r=this.toolbar)==null||r.setTimeframes(this.timeframeMenu(),this.pinnedTimeframes())),this.handleTimeframe(e),!0)}showMarkerTip(t){const{marker:e}=t;if(!e){this.markerTip&&(this.markerTip.hidden=!0);return}this.markerTip||(this.markerTip=document.createElement("div"),this.markerTip.className="tcw-marker-tip",this.markerTip.setAttribute("role","tooltip"),this.chartContainer.appendChild(this.markerTip));const r=e.direction==="long"?this.t("account.long"):e.direction==="short"?this.t("account.short"):this.t("markers.neutral"),n=document.createElement("strong");n.textContent=e.label?`${e.label} · ${e.source}`:e.source;const s=document.createElement("div");s.textContent=`${r} · ${this.formatAlertPrice(e.price)} · ${S(this.t("markers.confidence"),{pct:Math.round(e.confidence*100)})}`;const a=document.createElement("div"),{date:o,time:c}=Q(e.time,this.displayTimezone());a.textContent=`${o} ${c}`,this.markerTip.replaceChildren(n,s,a),this.markerTip.hidden=!1;const l=this.chartContainer.getBoundingClientRect(),h=Math.min(t.x+12,Math.max(0,l.width-this.markerTip.offsetWidth-4)),p=Math.max(0,t.y-this.markerTip.offsetHeight-10);this.markerTip.style.left=`${h}px`,this.markerTip.style.top=`${p}px`}selectTypedTimeframe(t){var e;return!this.chart.isTimeframeAllowed(t)||!this.timeframes.includes(t)&&!this.featureState.customTimeframes||this.adapter&&!zt(this.adapter,t)?!1:(this.timeframes.includes(t)||(this.customTimeframes.add(t),this.timeframes=ke(this.timeframes,[t]),(e=this.toolbar)==null||e.setTimeframes(this.timeframeMenu(),this.pinnedTimeframes())),this.handleTimeframe(t),!0)}applyIndicatorTemplate(t){if(!this.featureState.indicatorTemplates)return;const e=this.templates.get(t);e&&(this.chart.applyIndicatorSetup(e.indicators),this.syncIndicatorsFromChart(),this.updateUI(),this.say(S(this.t("templates.applied"),{name:e.name})))}promptSaveIndicatorTemplate(){if(this.featureState.indicatorTemplates){if(this.chart.getActiveIndicators().length===0){this.say(this.t("templates.nothing"),"error");return}this.templatePrompt??(this.templatePrompt=new qe(this.root,this.t)),this.templatePrompt.open({title:this.t("templates.saveTitle"),submitLabel:this.t("common.save"),placeholder:this.t("templates.namePlaceholder"),onSubmit:t=>{var e;try{this.templates.save(t,this.chart.getIndicatorSetup())}catch(r){throw this.say(this.t("templates.saveFailed"),"error"),r}(e=this.indicatorPicker)==null||e.setTemplates(this.templateNames()),this.say(S(this.t("templates.saved"),{name:t}))}})}}handleRemoveTimeframe(t){var e;this.customTimeframes.has(t)&&(this.customTimeframes.remove(t),this.timeframeFavorites.remove(t),this.timeframes=this.timeframes.filter(r=>r!==t),(e=this.toolbar)==null||e.setTimeframes(this.timeframeMenu(),this.pinnedTimeframes()),this.updateUI())}handleToggleTimeframeFavorite(t){var e;this.timeframeFavorites.toggle(t),(e=this.toolbar)==null||e.setTimeframeFavorites(this.pinnedTimeframes()),this.updateUI()}setData(t){this.localSeq++,this.baseSeries=t,this.baseTimeframeMs=be(t),this.applyTimeframeData(),this.adapter||this.loading.end()}async switchLocalTimeframe(){if(!this.baseSeries)return;const t=++this.localSeq,e=this.lastLocalSwitchMs>=xl||this.baseSeries.length>=kl;try{if(e&&(this.loading.begin(this.chart.getData().length>0,!0),await El(),t!==this.localSeq||this.destroyed))return;this.applyTimeframeData()}finally{t===this.localSeq&&this.loading.end()}}applyTimeframeData(){if(!this.baseSeries)return;const t=performance.now(),e=z(this.state.timeframe);if(this.baseTimeframeMs>0&&e>this.baseTimeframeMs){const r=this.options.weekStartsOn??1;this.chart.setData(Lr(this.baseSeries,this.state.timeframe,{weekStartsOn:r}))}else this.chart.setData(this.baseSeries);this.lastLocalSwitchMs=performance.now()-t}handleDataUpdate(t){var r;if(!t||typeof t!="object")return;const e=t;if(typeof e.length=="number"){e.length>0&&this.loading.isActive()&&(this.loading.end(),this.state.connectionState==="error"&&this.setConnectionState("connected",this.t("status.live")));return}if(e.error!==void 0){this.loading.isActive()&&(this.loading.fail(this.t("status.connectionFailed")),this.setConnectionState("error",e.error||this.t("status.connectionFailed")));return}switch((r=e.connection)==null?void 0:r.state){case"connected":this.loading.hasFailed()&&this.loading.end(),!this.loading.isActive()&&this.state.connectionState!=="connected"&&this.setConnectionState("connected",this.t("status.live"));break;case"reconnecting":this.loading.isActive()||this.setConnectionState("connecting",this.t("status.connecting"));break;case"error":this.loading.isActive()||this.setConnectionState("error",this.t("status.connectionFailed"));break}}setConnectionState(t,e){this.state={...this.state,connectionState:t,connectionMessage:e},this.updateUI()}toggleAlerts(){!this.alertsPanel||!this.featureState.alerts||(this.alertsPanel.toggle(),this.alertsPanel.isOpen()&&this.refreshAlerts())}handleToggleFavorite(t){var r;const e=this.favoritesStore.toggle(t);(r=this.sidebar)==null||r.setFavorites(this.favoritesStore.list()),this.say(e?this.t("toast.pinned"):this.t("toast.unpinned"))}exportState(){const t=this.chart.getActiveIndicators().map(e=>({id:e.id,params:e.params}));return il({v:1,symbol:this.state.symbol,timeframe:this.state.timeframe,chartType:this.state.chartType,scaleMode:this.chart.getScaleMode(),indicators:t,drawings:this.chart.getDrawings()})}async importState(t){const e=al(t);return e?(e.symbol&&e.symbol!==this.state.symbol&&await this.setSymbol(e.symbol),e.timeframe&&e.timeframe!==this.state.timeframe&&await this.setTimeframe(e.timeframe),e.chartType&&this.applyChartType(e.chartType),this.chart.setScaleMode(e.scaleMode),this.chart.applyIndicatorSetup(e.indicators.map((r,n)=>({id:r.id,instanceId:`shared_${n}`,params:r.params}))),this.chart.setDrawings(e.drawings),this.updateUI(),!0):!1}async copyChartImage(){const t=await this.chart.copyScreenshot();this.say(t?this.t("toast.imageCopied"):this.t("toast.imageCopyFailed"),t?"info":"error")}async copyShareLink(){const t=typeof location<"u"?location.href:"",e=cl(t,this.exportState());try{await navigator.clipboard.writeText(e),this.say(this.t("toast.linkCopied"))}catch{this.say(this.t("toast.copyFailed"),"error")}}setDepth(t){var e;this.chart.setDepthData(t),(e=this.depthLadder)==null||e.setData(t),t&&this.chart.pushDepthSnapshot(t)}startBracket(t){var e;this.chart.startBracket(t)&&((e=this.bracketBar)==null||e.show(t))}buildDataWindowModel(){const t=this.chart.getData(),e=this.lastHoverIndex;if(e===null||e<0||e>=t.length)return{ohlc:null,change:0,changePct:0,indicators:[]};const r=t[e],n=e>0?t[e-1].close:r.open,s=r.close-n,a=n!==0?s/n*100:0,o=this.chart.getActiveIndicators().map(c=>{var f,g;const l=(f=this.chart.getIndicatorOutput(c.instanceId))==null?void 0:f.series,h=(l==null?void 0:l[e])??null,p=((g=c.descriptor.plots)==null?void 0:g.map(v=>[v.key,v.title]))??Object.keys(h??{}).map(v=>[v,v]),m=h?p.filter(([v])=>typeof h[v]=="number"&&Number.isFinite(h[v])).map(([v,y])=>({key:y,value:h[v]})):[];return{name:c.descriptor.name,values:m}}).filter(c=>c.values.length>0);return{ohlc:{open:r.open,high:r.high,low:r.low,close:r.close,volume:r.volume},change:s,changePct:a,indicators:o}}toggleDataWindow(){!this.dataWindow||!this.featureState.dataWindow||(this.dataWindow.toggle(),this.dataWindow.isOpen()&&this.dataWindow.render(this.buildDataWindowModel()))}toggleObjects(){!this.objectTree||!this.featureState.objectTree||(this.objectTree.toggle(),this.objectTree.isOpen()&&this.refreshObjects())}openIndicatorSettings(t){var o;if(!this.indicatorSettings||!this.featureState.indicatorSettings)return;const e=this.chart.getActiveIndicators(),r=e.find(c=>c.instanceId===t);if(!r)return;const n=this.chart.getIndicatorStyle(t),s=r.descriptor.placement==="panel"||!!r.pane,a=((o=(this.chart.getIndicatorSetup()??[]).find(c=>c.instanceId===t))==null?void 0:o.levels)!==void 0;this.chart.beginIndicatorEdit(t),this.indicatorSettings.open({instanceId:t,indicatorId:r.id,name:r.descriptor.name,defaults:r.descriptor.defaultConfig,params:r.params,inputs:r.descriptor.inputs,lineSources:Pl(t,e),plots:r.descriptor.plots,colors:n==null?void 0:n.colors,lineWidth:n==null?void 0:n.lineWidths[0],plotStyles:n==null?void 0:n.plots,intervals:this.chart.getIndicatorIntervals(t)??null,levels:s?this.chart.getIndicatorLevels(t):void 0,defaultLevels:r.descriptor.levels,ownLevels:a,scale:s?void 0:this.chart.getIndicatorScale(t)})}refreshObjects(){if(this.refreshDrawingsState(),!this.objectTree)return;const t=this.chart.getActiveIndicators().map(n=>({instanceId:n.instanceId,name:n.descriptor.name,visible:n.visible})),e=this.chart.getDrawings().map(n=>({id:n.id,label:bo(n.type,this.t),visible:n.visible,locked:n.locked,group:n.group})),r=this.compares.map(n=>({id:n.id,label:n.symbol,color:n.color}));this.objectTree.setObjects(t,e,r)}async handleAddCompare(){var r;if(!this.featureState.compare)return;if(!this.adapter){this.say(this.t("toast.compareNeedsAdapter"),"error");return}const t=new Set([this.state.symbol,...this.compares.map(n=>n.symbol)]),e=this.symbols.filter(n=>!t.has(n));(r=this.symbolSearch)==null||r.open(e.length?e:this.symbols,this.state.symbol,n=>{this.pickCompareWay(n)},this.symbolSearchFn())}pickCompareWay(t){var s;const e=this.state.symbol,r=[{id:"percent",label:this.t("compare.percent")},{id:"scale",label:this.t("compare.ownScale")},{id:"pane",label:this.t("compare.ownPane")},{id:"spread",label:S(this.t("compare.spread"),{main:e,other:t})},{id:"ratio",label:S(this.t("compare.ratio"),{main:e,other:t})},{id:"correlation",label:S(this.t("compare.correlation"),{main:e,other:t})},{id:"correlationLog",label:S(this.t("compare.correlationLog"),{main:e,other:t})}],n=this.chart.getPlotRect();(s=this.chartMenu)==null||s.open(r,n.x+24,n.y+24,a=>void this.addCompareSymbol(t,a))}async addCompareSymbol(t,e="percent"){if(!this.adapter){this.say(this.t("toast.compareNeedsAdapter"),"error");return}if(e!=="percent"){const s=e==="scale"?this.chart.addIndicator("compareSymbol",{symbol:t},"bottom",{scale:"left"}):e==="pane"?this.chart.addIndicator("compareSymbol",{symbol:t}):e==="correlation"?this.chart.addIndicator("correlation",{symbol:t}):e==="correlationLog"?this.chart.addIndicator("correlationlog",{symbol:t}):this.chart.addIndicator("spread",{symbol:t,mode:e});s&&e==="pane"&&this.chart.moveIndicatorToPane(s,"new");return}if(this.compares.some(s=>s.symbol===t))return;const r=In[this.compares.length%In.length],n=`cmp_${t}`;try{const s=await Ot(this.adapter).fetchHistory(t,this.state.timeframe,this.options.historyLimit??500);this.compares.length===0&&this.chart.setCompareMode("percent"),this.chart.addCompareSymbol(n,t,s,r),this.compares=[...this.compares,{id:n,symbol:t,color:r}],this.refreshObjects(),this.say(S(this.t("toast.comparing"),{symbol:t}))}catch(s){this.say(`${t}: ${s instanceof Error?s.message:this.t("toast.loadFailed")}`,"error")}}handleRemoveCompare(t){this.chart.removeCompareSymbol(t),this.compares=this.compares.filter(e=>e.id!==t),this.refreshObjects()}async loadSymbolSeries(t){if(!this.adapter){this.say(this.t("toast.compareNeedsAdapter"),"error");return}const e=this.state.timeframe,r=(this.symbolLoads.get(t)??0)+1;this.symbolLoads.set(t,r);const n=()=>this.destroyed||e!==this.state.timeframe||this.symbolLoads.get(t)!==r;try{const s=Math.max(this.chart.getData().length,this.options.historyLimit??500),a=await Ot(this.adapter).fetchHistory(t,e,s);if(n())return;this.chart.setSymbolSeries(t,a)}catch(s){if(n())return;this.chart.setSymbolSeries(t,this.chart.getSymbolSeries(t)),this.say(`${t}: ${s instanceof Error?s.message:this.t("toast.loadFailed")}`,"error")}}async refetchCompares(){var e,r;for(const n of((r=(e=this.chart).getRequiredSymbols)==null?void 0:r.call(e))??[])this.loadSymbolSeries(n);if(!this.adapter||this.compares.length===0)return;const t=this.compares.filter(n=>n.symbol===this.state.symbol);for(const n of t)this.handleRemoveCompare(n.id);for(const n of this.compares)try{const s=await Ot(this.adapter).fetchHistory(n.symbol,this.state.timeframe,this.options.historyLimit??500);this.chart.updateCompareData(n.id,s)}catch{}}refreshAlerts(){if(!this.alertsPanel)return;const t=this.buildAlertSources();this.alertsPanel.setSources(t),this.alertsPanel.setAlerts(this.chart.getAlerts().map(e=>this.alertListItem(e,t)))}alertListItem(t,e){var r;return{id:t.id,price:t.price,condition:t.condition,message:t.message,triggered:t.triggered,channel:t.channel,label:t.label,drawingId:t.drawingId,target:t.target,targetLabel:t.target?(r=e.find(n=>n.channel===t.target))==null?void 0:r.label:void 0,percent:t.percent,bars:t.bars,onBarClose:t.onBarClose,expiresAt:t.expiresAt,expired:t.expired}}alertText(t){return ps(this.alertListItem(t,this.buildAlertSources()),this.t,e=>this.formatAlertPrice(e),!0)}buildAlertSources(){var e;const t=[{channel:"price",label:this.t("alerts.source.price")}];for(const r of this.chart.getActiveIndicators()){const n=(e=this.chart.getIndicatorOutput(r.instanceId))==null?void 0:e.series,s=n&&n.length>0?n[n.length-1]:null,a=s?Object.keys(s).filter(o=>typeof s[o]=="number"):[];for(const o of a){const c=a.length>1?`${r.descriptor.name} ${o}`:r.descriptor.name;t.push({channel:`${r.instanceId}:${o}`,label:c})}}return t}getAlertChannelValue(t){var o,c,l;const e=this.chart.getData();if(t==="price")return e.length>0?this.chart.roundPrice(e[e.length-1].close):null;const r=t.indexOf(":");if(r<0||e.length===0)return null;const n=t.slice(0,r),s=t.slice(r+1),a=(l=(c=(o=this.chart.getIndicatorOutput(n))==null?void 0:o.series)==null?void 0:c[e.length-1])==null?void 0:l[s];return typeof a=="number"&&Number.isFinite(a)?a:null}formatAlertPrice(t){var a,o;const e=(o=(a=this.chart).getPriceFormatter)==null?void 0:o.call(a);if(e)return e(t);const r=Math.abs(t),n=r>=1e3?2:r>=1?4:6,s=this.settingsState.numberLocale||void 0;return t.toLocaleString(s,{minimumFractionDigits:2,maximumFractionDigits:n})}handleChartType(t){const e=this.state.chartType;t!==e&&(this.applyChartType(t),this.chart.recordUndo({subject:"chartType",undo:()=>this.applyChartType(e),redo:()=>this.applyChartType(t)}))}applyChartType(t){var e;this.state={...this.state,chartType:t},this.chart.setChartType(t),(e=this.settings)==null||e.refresh(this.settingsState,t),this.updateUI()}handleAddIndicator(t){var e;return this.chart.addIndicator(t,((e=this.indicatorDefaults.get(t))==null?void 0:e.params)??{})!==null}saveIndicatorDefault(t,e){var n,s;if(!this.indicatorDefaults.save(t,e)){this.say(this.t("indicatorSettings.defaultSaveFailed"),"error");return}this.chart.setIndicatorDefaults(t,e.style);const r=((s=(n=this.chart.getAvailableIndicators())==null?void 0:n.find(a=>a.id===t))==null?void 0:s.shortName)??t.toUpperCase();this.say(S(this.t("indicatorSettings.defaultSaved"),{name:r}))}handleRemoveIndicator(t){this.chart.removeIndicator(t)}toggleCommandPalette(){var t,e;if((t=this.commandPalette)!=null&&t.isOpen()){this.commandPalette.close();return}this.featureState.commandPalette&&((e=this.commandPalette)==null||e.open(this.buildCommandItems()))}buildCommandItems(){const t=[];for(const e of this.indicatorPickerItems())t.push({id:e.id,label:e.name,category:"indicator",active:[...this.state.activeIndicators.values()].some(r=>r.id===e.id)});for(const e of re)t.push({id:e.value,label:nr(e,this.t),category:"chartType",active:this.state.chartType===e.value});for(const e of _r(Br,this.t))for(const r of e.tools)t.push({id:r.value,label:r.label,category:"drawing",active:this.state.activeTool===r.value});for(const e of this.timeframes)t.push({id:e,label:Ur(e),category:"timeframe",active:this.state.timeframe===e});return t.push({id:"screenshot",label:this.t("action.screenshot"),category:"action",shortcut:""},{id:"copyImage",label:this.t("action.copyImage"),category:"action"},{id:"toggleTheme",label:this.t("action.toggleTheme"),category:"action"},{id:"settings",label:this.t("action.settings"),category:"action"},{id:"shareView",label:this.t("action.shareView"),category:"action"},{id:"autoFib",label:this.t("action.autoFib"),category:"action"},{id:"dataWindow",label:this.t("action.dataWindow"),category:"action"},{id:"symbolInfo",label:this.t("action.symbolInfo"),category:"action"},{id:"clearDrawings",label:this.t("action.clearDrawings"),category:"action"}),t.filter(e=>e.category!=="action"||this.commandOn(e.id))}commandOn(t){const e=zi(t);return e===void 0||this.featureState[e]}handleAction(t){if(this.commandOn(t))switch(t){case"screenshot":this.chart.screenshot();break;case"toggleTheme":this.handleToggleTheme();break;case"settings":this.openSettings();break;case"copyImage":this.copyChartImage();break;case"shareView":this.copyShareLink();break;case"autoFib":{const e=this.chart.autoFib();this.say(e?this.t("toast.autoFibAdded"):this.t("toast.noSwing"));break}case"dataWindow":this.toggleDataWindow();break;case"symbolInfo":this.toggleSymbolInfo();break;case"clearDrawings":this.chart.clearDrawings(),this.state={...this.state,activeTool:null},this.updateUI();break}}handleDrawingTool(t){this.state={...this.state,activeTool:t},this.chart.setDrawingTool(t),this.updateUI()}handleCancelDrawing(){this.state={...this.state,activeTool:null},this.chart.setDrawingTool(null),this.chart.setEraserMode(!1),this.chart.setZoomAreaMode(!1),this.updateUI()}handleToggleStayInDrawing(){const t=!this.state.stayInDrawing;this.state={...this.state,stayInDrawing:t},this.chart.setStayInDrawingMode(t),this.updateUI()}handleToggleMagnet(){const t=this.state.magnetEnabled?this.state.magnetStrong?"off":"strong":"weak";this.state={...this.state,magnetEnabled:t!=="off",magnetStrong:t==="strong"},this.chart.setDrawingMagnetMode(t),this.updateUI()}handleToggleTheme(){if(!this.featureState.themeToggle)return;const t=!this.state.isDark;this.state={...this.state,isDark:t},this.root.dataset.tcwTheme=t?"dark":"light",this.portal.dataset.tcwTheme=this.root.dataset.tcwTheme,this.keepingLook(()=>this.chart.setTheme(t?this.themeOf.dark:this.themeOf.light)),this.chart.setWatermark(this.state.symbol.replace("USDT"," / USDT"),{fontSize:48,color:t?"rgba(255,255,255,0.03)":"rgba(0,0,0,0.03)"}),this.updateUI()}openSettings(t){var e,r,n,s,a,o;!this.featureState.settings||(e=this.settings)!=null&&e.isOpen()||(this.settingsState={...this.settingsState,chartTypeOptions:((n=(r=this.chart).getChartTypeOptions)==null?void 0:n.call(r))??{},autoScale:((a=(s=this.chart).isAutoScale)==null?void 0:a.call(s))??this.settingsState.autoScale},this.settingsEdit={settings:{...this.settingsState},style:this.settingsStyle(),keys:new Set,styleKeys:new Set},(o=this.settings)==null||o.open(this.settingsState,this.state.chartType,t))}resetView(){var t;this.chart.fitContent(),this.changeSettings({autoScale:!0}),(t=this.settings)==null||t.refresh(this.settingsState)}endSettingsEdit(t){const e=this.settingsEdit;if(this.settingsEdit=null,!e)return;const r=[...e.keys],n=h=>Object.fromEntries(r.map(p=>[p,h[p]])),s=[...e.styleKeys],a=n(e.settings),o=s.length>0?{theme:e.style.theme,overrides:Object.fromEntries(s.map(h=>[h,e.style.overrides[h]??null]))}:null;if(!t){this.restoreSettings(a,o);return}const c=n(this.settingsState),l=s.length>0?this.settingsStyle(s):null;JSON.stringify([a,o])!==JSON.stringify([c,l])&&this.chart.recordUndo({undo:()=>this.restoreSettings(a,o),redo:()=>this.restoreSettings(c,l)})}touchSettings(t,e=[]){if(this.settingsEdit){for(const r of t)this.settingsEdit.keys.add(r);for(const r of e)this.settingsEdit.styleKeys.add(r)}}applyChartTemplate(t){var r;const e=this.chartTemplates.get(t);e&&(this.touchSettings(Object.keys(e.settings),it),this.applySettings(e.settings),this.chart.resetOverrides([...it],{layer:"user"}),this.chart.applyOverrides(e.style,{layer:"user"}),(r=this.settings)==null||r.refresh(this.settingsState),this.say(S(this.t("templates.applied"),{name:t})))}promptSaveChartTemplate(){this.chartTemplatePrompt??(this.chartTemplatePrompt=new qe(this.overlayHost(),this.t)),this.chartTemplatePrompt.open({title:this.t("settings.saveTemplateTitle"),submitLabel:this.t("common.save"),placeholder:this.t("settings.templatePlaceholder"),onSubmit:t=>{if(!this.chartTemplates.save(t,this.settingsState,this.settingsStyle().overrides))throw this.say(this.t("templates.saveFailed"),"error"),new Error("The template could not be saved");this.say(S(this.t("templates.saved"),{name:t}))}})}toast(t,e="info",r){const n=document.createElement("div");n.className=`tcw-toast ${e==="error"?"tcw-toast-error":""}`,n.setAttribute("role",e==="error"?"alert":"status");const s=r?b(r,14):"";if(s){const c=document.createElement("span");c.className="tcw-toast-icon",c.innerHTML=s,n.appendChild(c)}n.appendChild(document.createTextNode(t));const a=c=>c.querySelector(".tcw-modal-backdrop:not([hidden])")!==null,o=a(this.portal)?this.portal:this.root;n.classList.toggle("tcw-toast-over",o===this.portal||a(this.root)),o.appendChild(n),requestAnimationFrame(()=>n.classList.add("tcw-toast-in")),setTimeout(()=>{n.classList.remove("tcw-toast-in"),n.addEventListener("transitionend",()=>n.remove(),{once:!0}),setTimeout(()=>n.remove(),400)},3500)}say(t,e="info",r){(this.featureState.toasts||e==="error")&&this.toast(t,e,r)}getLayoutSession(){return this.layoutSession}getSymbol(){return this.state.symbol}getTimeframe(){return this.state.timeframe}captureLayout(){const t=this.chart.saveState(),e=t?Ye(t):null,r=e&&typeof e=="object"?Ge(e):null;return{v:1,symbol:this.state.symbol,timeframe:this.chosenTimeframe??this.state.timeframe,scaleMode:this.settingsState.scaleMode,invertScale:this.settingsState.invertScale,chart:r}}async restoreLayout(t){var e;if(t.symbol!==this.state.symbol&&await this.setSymbol(t.symbol),t.timeframe!==this.state.timeframe&&await this.setTimeframe(t.timeframe),!this.destroyed){if(t.chart){this.chart.loadState(JSON.stringify(Ge(t.chart)));const r=t.chart.chartType;typeof r=="string"&&(this.state={...this.state,chartType:r})}this.applySettings({scaleMode:t.scaleMode,invertScale:t.invertScale}),this.syncIndicatorsFromChart(),this.updateUI(),(e=this.settings)==null||e.refresh(this.settingsState,this.state.chartType)}}getLayoutContent(){return JSON.stringify(this.captureLayout())}async applyLayoutContent(t){const e=Cs(Ye(t));return e?(await this.restoreLayout(e),!0):!1}setupLayouts(t){const e=new _n(t.storage??Un(),{capture:()=>({content:this.getLayoutContent(),symbol:this.state.symbol,timeframe:this.chosenTimeframe??this.state.timeframe}),apply:async r=>{if(!await this.applyLayoutContent(r.content))throw new Error("Not a widget layout")}},{autoSave:t.autoSave,debounceMs:t.debounceMs,onChange:()=>{var r,n;return(n=this.toolbar)==null?void 0:n.setLayout(((r=e.current())==null?void 0:r.name)??null,e.isDirty())},onError:()=>this.say(this.t("layouts.saveFailed"),"error")});this.layoutSession=e,this.layoutsUI=new Ss(e,{root:this.root,t:this.t,toast:(r,n)=>this.say(r,n),formatTime:r=>{const{date:n,time:s}=Q(r,this.displayTimezone());return`${n} ${s}`}}),this.chart.on("stateChange",()=>e.changed()),t.openLast&&e.list().then(([r])=>r&&!this.destroyed?this.openLayout(r.id):void 0,()=>{})}async saveLayout(){var t;await((t=this.layoutsUI)==null?void 0:t.save())}async openLayout(t){var e;return await((e=this.layoutsUI)==null?void 0:e.open(t))??!1}clearSavedLayout(t){if(!this.layoutKeyPrefix)return;const e=t??this.state.symbol;try{localStorage.removeItem(this.layoutKeyPrefix+e)}catch{}}applySymbolLayout(t){if(!this.layoutKeyPrefix)return;const e=this.layoutKeyPrefix+t;this.activeLayoutKey=e;try{this.chart.loadStateFromStorage(e)&&this.syncIndicatorsFromChart()}catch{}this.chart.setAutoSave(e,this.layoutDebounceMs)}flushActiveLayout(){if(this.activeLayoutKey){try{this.chart.saveState(this.activeLayoutKey)}catch{}this.chart.disableAutoSave(),this.activeLayoutKey=null}}syncIndicatorsFromChart(){var e;const t=new Map;for(const r of this.chart.getActiveIndicators())t.set(r.instanceId,{id:r.id,label:Fe(r.id,r.params,r.descriptor.defaultConfig,r.descriptor.shortName)});this.state={...this.state,activeIndicators:t},this.updateUI(),(e=this.indicatorPicker)==null||e.setCounts(this.indicatorCounts())}toggleIndicatorPicker(){var t,e;if((t=this.indicatorPicker)!=null&&t.isOpen()){this.indicatorPicker.close();return}!this.indicatorPicker||!this.featureState["toolbar.indicators"]||(this.indicatorPicker.open({items:this.indicatorPickerItems(),favorites:this.indicatorFavorites.list(),templates:this.featureState.indicatorTemplates?this.templateNames():null,counts:this.indicatorCounts()}),(e=this.toolbar)==null||e.setIndicatorsOpen(!0))}indicatorPickerItems(){return(this.chart.getAvailableIndicators()??[]).filter(t=>!kr.has(t.id)&&this.chart.isIndicatorAllowed(t.id)!==!1).map(t=>({id:t.id,name:t.name,shortName:t.shortName??t.id.toUpperCase(),placement:t.placement==="panel"?"panel":"overlay",category:ci(t)}))}indicatorCounts(){const t=new Map;for(const{id:e}of this.state.activeIndicators.values())t.set(e,(t.get(e)??0)+1);return t}templateNames(){return this.templates.list().map(t=>t.name)}toggleReplay(){var t;(t=this.replayBar)!=null&&t.isMounted()?this.exitReplay():this.featureState.replay&&this.enterReplay()}enterReplay(){if(this.replayTotal()<2)return;const t=this.t;this.replayBar=new Na({onPlay:()=>{var r,n;if(((r=this.replayBar)==null?void 0:r.getMode())==="select"){this.startReplayAt(Math.max(1,this.replayTotal()-100),!0);return}this.chart.getReplayState()==="paused"&&this.chart.replayResume(),(n=this.replayBar)==null||n.setState("playing")},onPause:()=>{var r;this.chart.replayPause(),(r=this.replayBar)==null||r.setState("paused")},onStepBack:()=>this.stepReplay(-1),onStepForward:()=>this.stepReplay(1),onSeek:r=>{var n;this.chart.getReplayState()==="playing"&&this.chart.replayPause(),this.chart.replaySeek(r),(n=this.replayBar)==null||n.setState("paused")},onSpeedChange:r=>{this.replaySpeed=r,this.chart.setReplaySpeed(r)},onRandomStart:()=>{const r=this.replayTotal(),n=Math.max(1,Math.floor(r*.1)),s=Math.max(n,Math.floor(r*.9));this.startReplayAt(n+Math.floor(Math.random()*(s-n+1)))},onClose:()=>this.exitReplay(),onStepChange:r=>{var s;if(this.replayStep=r,((s=this.replayBar)==null?void 0:s.getMode())!=="replay")return;const n=this.chart.getReplayState()==="playing";this.startReplayAt(Math.max(0,this.chart.getReplayBarIndex()-1),n)}},{selectHint:t("replay.selectHint"),random:t("replay.random"),realtime:t("replay.realtime"),barsPerSecond:t("replay.barsPerSecond"),play:t("replay.play"),pause:t("replay.pause"),stepBack:t("replay.stepBack"),stepForward:t("replay.stepForward"),replay:t("replay.label"),position:t("replay.position"),speed:t("replay.speed"),step:t("replay.step")});const e=[{value:"bar",label:t("replay.step.bar")},...this.replayStepOptions().map(r=>({value:r,label:r}))];e.some(r=>r.value===this.replayStep)||(this.replayStep="bar"),this.replayBar.mount(this.chartContainer,{total:this.replayTotal(),speed:this.replaySpeed,mode:"select",steps:e,step:this.replayStep}),this.replayShade=document.createElement("div"),this.replayShade.className="tcw-replay-shade",this.replayShade.hidden=!0,this.chartContainer.appendChild(this.replayShade),this.chartContainer.addEventListener("mouseleave",this.hideReplayShade)}replayFrom(t,e=!1){var r;this.featureState.replay&&((r=this.replayBar)!=null&&r.isMounted()||this.enterReplay(),this.startReplayAt(t,e))}startReplayAt(t,e=!1){var c;const r=this.replayBar;if(!r)return;const n=this.replayTotal(),s=Math.max(0,Math.min(Number.isFinite(t)?Math.floor(t):0,n-1));(c=this.replayShade)==null||c.remove(),this.replayShade=null,this.chartContainer.removeEventListener("mouseleave",this.hideReplayShade),r.setMode("replay");const a=++this.replayStartSeq,o=l=>{this.destroyed||this.replayBar!==r||!r.isMounted()||a!==this.replayStartSeq||(this.chart.replayStart({speed:this.replaySpeed,interval:1e3,startIndex:s,paused:!0,revealMarks:this.options.replayRevealMarks!==!1,...l?{steps:l}:{}}),e&&this.chart.replayResume(),r.setState(e?"playing":"paused"),this.syncReplayBar(),this.replayPollInterval&&clearInterval(this.replayPollInterval),this.replayPollInterval=setInterval(()=>this.syncReplayBar(),150))};if(this.replayStep==="bar"){o(null);return}this.replayStepsFor(this.replayStep).then(l=>{a===this.replayStartSeq&&(l||this.say(this.t("replay.stepsFailed"),"error"),o(l))})}replayStepOptions(){const t=z(this.state.timeframe);return Tl.filter(e=>{const r=z(e);return!(r<t)||t%r!==0?!1:this.adapter?zt(this.adapter,e):this.baseSeries!==null&&this.baseTimeframeMs>0&&r>=this.baseTimeframeMs&&r%this.baseTimeframeMs===0})}async replayStepsFor(t){var n;const e=`${this.state.symbol}|${this.state.timeframe}|${t}`;if(((n=this.replayStepsCache)==null?void 0:n.key)===e)return this.replayStepsCache.steps;let r=null;if(this.adapter){const s=Math.max(1,Math.round(z(this.state.timeframe)/z(t))),a=Math.min(Ll,Math.max(this.chart.getData().length,100)*s);try{r=await Ot(this.adapter).fetchHistory(this.state.symbol,t,a)}catch{r=null}}else this.baseSeries&&(r=z(t)===this.baseTimeframeMs?this.baseSeries:Lr(this.baseSeries,t));return!r||r.length===0?null:(this.replayStepsCache={key:e,steps:r},r)}replayTotal(){return this.chart.isReplayActive()?this.chart.getReplayProgress().total:this.chart.getData().length}syncReplayBar(){const t=this.replayBar;if(!(t!=null&&t.isMounted())||t.getMode()!=="replay")return;if(!this.chart.isReplayActive()){this.teardownReplayUi();return}const e=this.chart.getReplayProgress(),r=this.chart.getReplayState();t.setProgress(e.current,e.total),t.setState(r==="stopped"?"paused":r),t.setEnded(r!=="playing"&&e.total>0&&e.current>=e.total-1)}stepReplay(t){var r;if(((r=this.replayBar)==null?void 0:r.getMode())!=="replay")return;const e=this.chart.getReplayProgress();this.chart.getReplayState()==="playing"&&this.chart.replayPause(),this.chart.replaySeek(Math.max(0,Math.min(e.total-1,e.current+t))),this.replayBar.setState("paused"),this.syncReplayBar()}handleReplayKey(t){var r,n;if(t.defaultPrevented)return!1;const e=document.activeElement;return e&&(e.tagName==="INPUT"||e.tagName==="TEXTAREA"||e.tagName==="SELECT"||e.isContentEditable)?!1:t.shiftKey&&(t.key==="ArrowRight"||t.key==="ArrowLeft")&&((r=this.replayBar)==null?void 0:r.getMode())==="replay"?(t.preventDefault(),t.stopPropagation(),this.stepReplay(t.key==="ArrowRight"?1:-1),!0):t.key==="Escape"&&((n=this.replayBar)==null?void 0:n.getMode())==="select"?(this.exitReplay(),!0):!1}positionReplayShade(t){const e=this.replayShade;if(!e)return;const r=this.chart.getPlotRect();if(t===null||t<r.x||t>r.x+r.width){e.hidden=!0;return}e.hidden=!1,e.style.left=`${t}px`,e.style.top=`${r.y}px`,e.style.width=`${r.x+r.width-t}px`,e.style.height=`${r.height}px`}exitReplay(){this.teardownReplayUi(),this.chart.replayStop()}teardownReplayUi(){var t,e;this.replayPollInterval&&(clearInterval(this.replayPollInterval),this.replayPollInterval=null),(t=this.replayShade)==null||t.remove(),this.replayShade=null,this.chartContainer.removeEventListener("mouseleave",this.hideReplayShade),(e=this.replayBar)==null||e.unmount(),this.replayBar=null}applySettings(t){var e,r;this.settingsState={...this.settingsState,...t},(t.scaleMode!==void 0||t.logScale!==void 0||t.invertScale!==void 0)&&((e=this.layoutSession)==null||e.changed()),this.scheduleLegend(),t.gridVisible!==void 0&&this.chart.setGridVisible(t.gridVisible),t.volumeVisible!==void 0&&this.chart.setVolumeVisible(t.volumeVisible),t.volumeProfileVisible!==void 0&&this.chart.setVolumeProfileVisible(t.volumeProfileVisible),t.marketProfileVisible!==void 0&&this.chart.setMarketProfileVisible(t.marketProfileVisible),t.marketProfileSplit!==void 0&&this.chart.setMarketProfileConfig({splitBySession:t.marketProfileSplit}),t.marketProfileLetters!==void 0&&this.chart.setMarketProfileConfig({letters:t.marketProfileLetters}),t.marketProfileBuckets!==void 0&&this.chart.setMarketProfileConfig({buckets:t.marketProfileBuckets}),t.marketProfileOpacity!==void 0&&this.chart.setMarketProfileConfig({opacity:t.marketProfileOpacity}),t.depthHeatmapVisible!==void 0&&this.chart.setDepthHeatmapVisible(t.depthHeatmapVisible),t.depthHeatmapOpacity!==void 0&&this.chart.setDepthHeatmapConfig({opacity:t.depthHeatmapOpacity}),t.sessionShadingVisible!==void 0&&this.chart.setSessionShadingVisible(t.sessionShadingVisible),t.pivotMarkersVisible!==void 0&&this.chart.setPivotMarkersVisible(t.pivotMarkersVisible),t.pivotStrength!==void 0&&this.chart.setPivotMarkersConfig({left:t.pivotStrength,right:t.pivotStrength}),t.pivotStructureLabels!==void 0&&this.chart.setPivotMarkersConfig({structureLabels:t.pivotStructureLabels}),t.periodLevelsVisible!==void 0&&this.chart.setPeriodLevelsVisible(t.periodLevelsVisible),t.periodLevelsPeriod!==void 0&&this.chart.setPeriodLevelsPeriod(t.periodLevelsPeriod),t.legendVisible!==void 0&&this.chart.setLegend({visible:t.legendVisible}),t.barCountdown!==void 0&&this.chart.setBarCountdownVisible(t.barCountdown),t.indicatorValueLabels!==void 0&&this.chart.setIndicatorValueLabelsVisible(t.indicatorValueLabels),t.crosshairMode!==void 0&&this.chart.setCrosshairMode(t.crosshairMode),t.autoScale!==void 0&&this.chart.setAutoScale(t.autoScale),t.invertScale!==void 0&&this.chart.setInvertScale(t.invertScale),t.leftPriceScale!==void 0&&this.chart.setLeftPriceScaleVisible(t.leftPriceScale),(t.scaleMode!==void 0||t.autoScale!==void 0)&&queueMicrotask(()=>this.refreshScaleSwitches()),t.timezone!==void 0&&queueMicrotask(()=>{var n;return(n=this.statusBar)==null?void 0:n.tick()}),t.scaleMode!==void 0?(this.chart.setScaleMode(t.scaleMode),this.settingsState={...this.settingsState,logScale:t.scaleMode==="logarithmic"}):t.logScale!==void 0&&(this.chart.setLogScale(t.logScale),this.settingsState={...this.settingsState,scaleMode:t.logScale?"logarithmic":"regular"}),t.numberLocale!==void 0&&(this.chart.setNumberLocale(t.numberLocale),(r=this.watchlist)==null||r.setLocale(t.numberLocale||void 0)),t.timezone!==void 0&&this.chart.setTimezone(Re(t.timezone)),t.highLowLines!==void 0&&this.chart.setHighLowLines(t.highLowLines),t.extendedHours!==void 0&&this.chart.setExtendedHours(t.extendedHours),t.mainSeriesVisible!==void 0&&this.chart.setMainSeriesVisible(t.mainSeriesVisible),t.chartTypeOptions!==void 0&&this.chart.setChartTypeOptions({renko:{},lineBreak:{},kagi:{},pointAndFigure:{},rangeBars:{},...t.chartTypeOptions})}resetSettings(){var a;const t={...this.settingsState},e=this.settingsStyle(),r={...this.settingsDefaults};this.touchSettings(Object.keys(r),it),this.applySettings(r),this.chart.resetOverrides([...it],{layer:"user"});const n={...this.settingsState},s=this.settingsStyle();(a=this.settings)==null||a.refresh(this.settingsState),!(this.settingsEdit||JSON.stringify([t,e])===JSON.stringify([n,s]))&&this.chart.recordUndo({undo:()=>this.restoreSettings(t,e),redo:()=>this.restoreSettings(n,s)})}changeStyle(t){const e=Object.keys(t);this.touchSettings([],e);const r=this.settingsStyle(e);this.chart.applyOverrides(t,{layer:"user"});const n=this.settingsStyle(e);this.settingsEdit||JSON.stringify(r)===JSON.stringify(n)||this.chart.recordUndo({subject:`style:${Object.keys(t).sort().join(",")}`,undo:()=>this.restoreSettings({},r),redo:()=>this.restoreSettings({},n)})}changeSettings(t){const e=Object.keys(t);if(e.includes("scaleMode")||e.includes("logScale"))for(const a of["scaleMode","logScale"])e.includes(a)||e.push(a);const r=()=>Object.fromEntries(e.map(a=>[a,this.settingsState[a]]));this.touchSettings(e);const n=r();this.applySettings(t);const s=r();this.settingsEdit||JSON.stringify(n)===JSON.stringify(s)||this.chart.recordUndo({subject:`settings:${Object.keys(t).sort().join(",")}`,undo:()=>this.restoreSettings(n),redo:()=>this.restoreSettings(s)})}settingsStyle(t=it){var n,s,a;const e=((s=(n=this.chart).getOverrides)==null?void 0:s.call(n,{layer:"user"}))??{},r=Object.fromEntries(t.map(o=>{const c=e[o];return[o,typeof c=="string"||typeof c=="boolean"||typeof c=="number"?c:null]}));return{theme:((a=this.chart.getTheme())==null?void 0:a.name)??"",overrides:r}}restoreSettings(t,e=null){var r,n;this.applySettings(t),e&&e.theme===(((r=this.chart.getTheme())==null?void 0:r.name)??"")&&this.chart.applyOverrides(e.overrides,{layer:"user"}),(n=this.settings)==null||n.refresh(this.settingsState)}async connectStream(){if(!this.adapter)return;const t=++this.connectSeq;this.state={...this.state,connectionState:"connecting",connectionMessage:this.t("status.connecting")},this.updateUI(),this.loading.begin(this.chart.getData().length>0);try{if(this.chart.disconnectStream(),await this.chart.connect({adapter:this.adapter,symbol:this.state.symbol,timeframe:this.state.timeframe,historyLimit:this.options.historyLimit??500,historyPageSize:this.options.historyPageSize}),t!==this.connectSeq||this.destroyed)return;this.chart.setWatermark(this.state.symbol.replace("USDT"," / USDT"),{fontSize:48,color:this.state.isDark?"rgba(255,255,255,0.03)":"rgba(0,0,0,0.03)"}),this.applySymbolLayout(this.state.symbol),this.loading.hasFailed()?this.state={...this.state,connectionState:"error"}:(this.loading.end(),this.state={...this.state,connectionState:"connected",connectionMessage:this.t("status.live")}),this.refetchCompares()}catch(e){if(t!==this.connectSeq||this.destroyed)return;this.loading.fail(this.t("status.connectionFailed")),this.state={...this.state,connectionState:"error",connectionMessage:e instanceof Error?e.message:this.t("status.connectionFailed")}}this.updateUI()}scheduleLegend(){!this.indicatorLegend||this.legendFrame||!this.featureState.indicatorLegend||(this.legendFrame=requestAnimationFrame(()=>{this.legendFrame=0,this.renderLegend()}))}renderLegend(){if(!this.indicatorLegend||this.destroyed)return;const t=this.chart.getData().length-1,e=this.chart.isTimeAligned()?this.legendHoverIndex:null,r=e===null?t:Math.min(Math.max(e,0),t),n=new Map;for(const p of this.chart.getIndicatorPanes())(p.instanceIds??[p.instanceId]).forEach((m,f)=>n.set(m,{...p.rect,row:f}));const s=this.settingsState.numberLocale||"en-US",a=this.chart.getActiveIndicators().map(p=>{var L,C;const m=n.get(p.instanceId)??null,f=r>=0?(C=(L=this.chart.getIndicatorOutput(p.instanceId))==null?void 0:L.series)==null?void 0:C[r]:null,g=this.chart.getIndicatorStyle(p.instanceId),v=p.visible&&p.shown===!1,y=v?[]:Vc(p.descriptor,f,(g==null?void 0:g.colors)??[],g==null?void 0:g.plots);return{instanceId:p.instanceId,label:Fe(p.id,p.params,p.descriptor.defaultConfig,p.descriptor.shortName),visible:p.visible,offInterval:v,values:y.map(E=>({text:m?qc(E.value,s):this.chart.formatPrice(E.value),color:E.color})),pane:m?{x:m.x+te,y:m.y+Math.min(Pn+m.row*Dn,Math.max(Pn,m.height-Dn)),width:m.width-2*te}:null}}),o=this.chart.getPlotRect(),c=this.chart.getMaximizedPane(),l=p=>{var m;return((m=a.find(f=>f.instanceId===p))==null?void 0:m.label)??""},h=this.chart.getIndicatorPanes().map(p=>({instanceId:p.instanceId,x:p.rect.x+p.rect.width-te,y:p.rect.y+Cl,label:l(p.instanceId),collapsed:this.chart.isPaneCollapsed(p.instanceId),maximized:c===p.instanceId,canMoveUp:this.chart.canMovePane(p.instanceId,-1),canMoveDown:this.chart.canMovePane(p.instanceId,1)}));this.indicatorLegend.update(a,{left:o.x+te,top:this.chart.getLegendBottom()+1},h)}runPaneAction(t,e){e==="up"||e==="down"?this.chart.movePane(t,e==="up"?-1:1):e==="collapse"||e==="expand"?this.chart.setPaneCollapsed(t,e==="collapse"):this.chart.setMaximizedPane(e==="maximize"?t:null),this.scheduleLegend()}openLegendMenu(t,e){var y,L,C;const r=this.legendMenu;if(!r)return;if(r.isOpen()){r.close();return}const n=["price",...this.chart.getIndicatorPanes().map(E=>E.instanceId)],s=1+this.chart.getIndicatorPanes().findIndex(E=>E.instanceIds.includes(t)),a=n[s-1],o=n[s+1],c=E=>E!==void 0&&this.chart.canMoveIndicatorToPane(t,E),l=[];c(a)&&l.push({id:`move:${a}`,label:this.t(a==="price"?"legend.movePrice":"legend.moveUp"),icon:"arrowUp"}),c(o)&&l.push({id:`move:${o}`,label:this.t("legend.moveDown"),icon:"arrowDown"}),c("new")&&l.push({id:"move:new",label:this.t("legend.moveNew"),icon:"plus"}),a!=="price"&&c("price")&&l.push({id:"move:price",label:this.t("legend.movePrice"),icon:"trendingUp"});const h=[];this.featureState.indicatorSettings&&this.featureState["indicatorLegend.settings"]&&h.push({id:"settings",label:this.t("legend.settings"),icon:"settings"}),this.featureState["indicatorLegend.remove"]&&h.push({id:"remove",label:this.t("legend.remove"),icon:"trash",danger:!0}),l.length>0&&h.length>0&&l.push("separator"),l.push(...h);const p=((y=this.chart.getActiveIndicators().find(E=>E.instanceId===t))==null?void 0:y.id)??"",m=((C=(L=this.options).indicatorMenuItems)==null?void 0:C.call(L,{instanceId:t,indicatorId:p}))??[],f=Zt(l,m);if(f.length===0)return;const g=e.getBoundingClientRect(),v=this.root.getBoundingClientRect();r.open(f,g.left-v.left,g.bottom-v.top+2,E=>{Qt(E,m)||(E==="settings"?this.openIndicatorSettings(t):E==="remove"?this.handleRemoveIndicator(t):E.startsWith("move:")&&this.chart.moveIndicatorToPane(t,E.slice(5)),this.scheduleLegend())},e)}updateUI(){var t,e,r;this.refreshDrawingsState(),this.scheduleLegend(),(t=this.toolbar)==null||t.update(this.state),(e=this.sidebar)==null||e.update(this.state),(r=this.statusBar)==null||r.update({connectionState:this.state.connectionState,message:this.state.connectionMessage,symbol:this.state.symbol,timeframe:this.state.timeframe})}resolveIsDark(t){return t===void 0||t==="dark"?!0:t==="light"?!1:typeof t=="object"&&t.background?this.isColorDark(t.background):!0}resolveTheme(t){return t===void 0||t==="dark"?ge:t==="light"?Tr:typeof t=="object"?t:ge}isColorDark(t){if(t.startsWith("#")&&t.length>=7){const e=parseInt(t.slice(1,3),16),r=parseInt(t.slice(3,5),16),n=parseInt(t.slice(5,7),16);return e+r+n<384}return!0}}function Pl(i,t){const e=s=>{var o;const a=ni(s.descriptor);return a&&((o=Qe(s.params[a]))==null?void 0:o.instanceId)||null},r=new Set([i]);for(let s=!0;s;){s=!1;for(const a of t){const o=e(a);o&&r.has(o)&&!r.has(a.instanceId)&&(r.add(a.instanceId),s=!0)}}const n=[];for(const s of t){if(r.has(s.instanceId))continue;const a=Fe(s.id,s.params,s.descriptor.defaultConfig,s.descriptor.shortName);for(const o of s.descriptor.plots??[])n.push({value:ri(s.instanceId,o.key),label:`${a}: ${o.title}`})}return n}function Dl(){try{return typeof localStorage<"u"?localStorage:null}catch{return null}}function Bl(i){const t=i.filter(a=>a!==null);if(t.length===0)return null;const e=Math.min(...t.map(a=>a.x)),r=Math.min(...t.map(a=>a.y)),n=Math.max(...t.map(a=>a.x+a.width)),s=Math.max(...t.map(a=>a.y+a.height));return{x:e,y:r,width:n-e,height:s-r}}function zl(i){return!!i&&/^(ar|he|iw|fa|ur|ps|yi|dv|ckb|sd|ug)(-|$)/i.test(i)}const As={symbol:!1,interval:!1,crosshair:!0,time:!1,drawings:!1,replay:!1},Ns=["symbol","interval","crosshair","time","drawings","replay"],Tt={"1x1":{cols:1,rows:1},"1x2":{cols:2,rows:1},"2x1":{cols:1,rows:2},"2x2":{cols:2,rows:2},"1x3":{cols:3,rows:1},"3x1":{cols:1,rows:3},"2x3":{cols:3,rows:2},"3x2":{cols:2,rows:3}};function ae(i){return typeof i=="string"&&Object.prototype.hasOwnProperty.call(Tt,i)}function Bn(i){return JSON.parse(JSON.stringify(i))}function Ol(i,t,e=16){const n=(20-2*(i-1))/i,s=(20-2*(t-1))/t;let a="";for(let o=0;o<t;o++)for(let c=0;c<i;c++)a+=`<rect x="${2+c*(n+2)}" y="${2+o*(s+2)}" width="${n}" height="${s}" rx="1"/>`;return`<svg width="${e}" height="${e}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">${a}</svg>`}function Fl(i){if(typeof i!="object"||i===null)return null;const t=i;if(t.v!==1||t.kind!=="grid"||!ae(t.layout)||!Array.isArray(t.cells))return null;const e=t.cells.map(Cs);if(e.some(a=>a===null))return null;const r=typeof t.sync=="object"&&t.sync!==null?t.sync:{},n={...As};for(const a of Ns)typeof r[a]=="boolean"&&(n[a]=r[a]);const s=typeof t.active=="number"&&Number.isInteger(t.active)?t.active:0;return{v:1,kind:"grid",layout:t.layout,sync:n,active:s,cells:e}}class ql{constructor(t,e={}){d(this,"root");d(this,"cellsEl");d(this,"cells",[]);d(this,"layout");d(this,"sync");d(this,"active",0);d(this,"hovered",null);d(this,"relayDepth",0);d(this,"uiTheme",null);d(this,"styleOverrides",{});d(this,"featureSwitches",{});d(this,"parked",new Map);d(this,"drawingFrame",0);d(this,"drawingSource",null);d(this,"layoutButtons",new Map);d(this,"syncButtons",new Map);d(this,"layoutsButton",null);d(this,"tabsEl",null);d(this,"stopNarrow",()=>{});d(this,"session",null);d(this,"layoutsUI",null);d(this,"t");d(this,"destroyed",!1);d(this,"unregisterKeys",()=>{});d(this,"onKeyDown",t=>{!(t.ctrlKey||t.metaKey)||t.altKey||t.shiftKey||t.key!=="s"&&t.key!=="S"||!this.layoutsUI||nt()||!Ct(this.root,!0)||(t.preventDefault(),this.layoutsUI.save())});var n,s,a,o,c,l,h;this.options=e,this.layout=ae(e.layout)?e.layout:"1x2",this.sync={...As,...e.sync},this.t=ar(ss((n=e.widget)==null?void 0:n.locale,(s=e.widget)==null?void 0:s.messages)),ts(),this.root=document.createElement("div"),this.root.className="tcw-root tcw-grid",this.root.dataset.tcwTheme=((a=e.widget)==null?void 0:a.theme)==="light"?"light":"dark",wt(this.root,ft((o=e.widget)==null?void 0:o.ui),{variables:((c=e.widget)==null?void 0:c.ui)!==void 0}),e.bar!==!1&&this.root.appendChild(this.buildBar()),this.cellsEl=document.createElement("div"),this.cellsEl.className="tcw-grid-cells",this.root.appendChild(this.cellsEl),t.appendChild(this.root),this.stopNarrow=Ts(this.root),this.applyShape();for(let p=0;p<this.shapeCount();p++)this.cells.push(this.createCell(p));this.markActive();const r=(h=(l=this.cells[0])==null?void 0:l.el.querySelector(".tcw-root"))==null?void 0:h.dataset.tcwTheme;r&&(this.root.dataset.tcwTheme=r),e.layouts!==!1&&this.setupLayouts(e.layouts===!0||e.layouts===void 0?{}:e.layouts),this.unregisterKeys=Es(this.root),document.addEventListener("keydown",this.onKeyDown)}get relaying(){return this.relayDepth>0}quietly(t){this.relayDepth++;try{return t()}finally{this.relayDepth--}}getWidget(t){var e;return((e=this.cells[t])==null?void 0:e.widget)??null}getWidgets(){return this.cells.map(t=>t.widget)}getActiveIndex(){return this.active}getActiveWidget(){return this.cells[this.active].widget}setActive(t){var e,r,n;t<0||t>=this.cells.length||t===this.active||(this.active=t,this.markActive(),(r=(e=this.options).onActiveChange)==null||r.call(e,t,this.cells[t].widget),(n=this.session)==null||n.changed())}getLayout(){return this.layout}setLayout(t){var r,n,s;if(t===this.layout||!ae(t))return;this.layout=t;const e=this.shapeCount();for(;this.cells.length>e;){const a=this.cells.length-1,o=this.cells.pop();this.parked.set(a,o.widget.captureLayout()),this.destroyCell(o)}this.applyShape();for(let a=this.cells.length;a<e;a++){const o=this.createCell(a);this.cells.push(o),this.unpark(a,o)}this.active>=e&&(this.active=0,(n=(r=this.options).onActiveChange)==null||n.call(r,0,this.cells[0].widget)),this.markActive(),this.renderBar(),(s=this.session)==null||s.changed()}getSync(){return{...this.sync}}setUI(t){const e=ft(t);wt(this.root,e);for(const r of this.cells)r.widget.setUI(e);this.uiTheme=e}getUI(){var t;return ft(this.uiTheme??((t=this.options.widget)==null?void 0:t.ui))}setSync(t){var n;const e=this.sync;if(this.sync={...this.sync,...t},e.crosshair&&!this.sync.crosshair)for(const s of this.cells)s.widget.getChart().setCrosshairTime(null);const r=this.cells[this.active];if(r&&!this.relaying){const s=r.widget.getSymbol(),a=r.widget.getTimeframe();!e.symbol&&this.sync.symbol&&this.relay(r,o=>void o.setSymbol(s)),!e.interval&&this.sync.interval&&this.relay(r,o=>void o.setTimeframe(a)),!e.drawings&&this.sync.drawings&&this.mergeDrawings()}this.renderBar(),(n=this.session)==null||n.changed()}applyOverrides(t){for(const r of this.cells)r.widget.getChart().applyOverrides(t);const e={...this.styleOverrides};for(const[r,n]of Object.entries(t))n==null?delete e[r]:e[r]=n;this.styleOverrides=e}setFeatures(t){const e=er(t);for(const r of this.cells)r.widget.setFeatures(e);this.featureSwitches={...this.featureSwitches,...e}}setTheme(t){for(const e of this.cells)e.widget.setTheme(t);this.followTheme()}getLayoutSession(){return this.session}captureLayout(){const t=[...this.parked.entries()].sort(([e],[r])=>e-r).map(([,e])=>e);return{v:1,kind:"grid",layout:this.layout,sync:{...this.sync},active:this.active,cells:[...this.cells.map(e=>e.widget.captureLayout()),...t]}}async restoreLayout(t){this.relayDepth++;let e;try{this.parked.clear(),this.setLayout(t.layout),this.sync={...t.sync},this.renderBar();const n=this.cells.length;t.cells.slice(n).forEach((s,a)=>this.parked.set(n+a,s)),e=await Promise.allSettled(this.cells.map((s,a)=>t.cells[a]?s.widget.restoreLayout(t.cells[a]):Promise.resolve()))}finally{this.relayDepth--}if(this.destroyed)return;this.setActive(Math.min(Math.max(0,t.active),this.cells.length-1)),this.renderTabs();const r=e.find(n=>n.status==="rejected");if(r)throw r.reason}getLayoutContent(){return JSON.stringify(this.captureLayout())}async applyLayoutContent(t){const e=Fl(Ye(t));return e?(await this.restoreLayout(e),!0):!1}destroy(){var t,e;if(!this.destroyed){this.destroyed=!0,document.removeEventListener("keydown",this.onKeyDown),this.unregisterKeys(),this.stopNarrow(),this.drawingFrame&&cancelAnimationFrame(this.drawingFrame),(t=this.session)==null||t.destroy(),(e=this.layoutsUI)==null||e.destroy();for(const r of this.cells)this.destroyCell(r);this.cells=[],this.root.remove(),es()}}shapeCount(){const{cols:t,rows:e}=Tt[this.layout];return t*e}applyShape(){const{cols:t,rows:e}=Tt[this.layout];this.cellsEl.style.gridTemplateColumns=`repeat(${t}, minmax(0, 1fr))`,this.cellsEl.style.gridTemplateRows=`repeat(${e}, minmax(0, 1fr))`}createCell(t){var c,l,h,p;const e=document.createElement("div");e.className="tcw-grid-cell",e.setAttribute("role","region"),e.setAttribute("aria-label",S(this.t("grid.chart"),{n:t+1})),this.cellsEl.appendChild(e);const r=this.options.widget??{},n=((c=this.options.cells)==null?void 0:c[t])??{},s=(l=this.cells[this.active])==null?void 0:l.widget,a={},o=new Il(e,{...r,...n,...s&&this.sync.symbol?{symbol:s.getSymbol()}:{},...s&&this.sync.interval?{timeframe:s.getTimeframe()}:{},...this.options.adapter&&!n.adapter?{adapter:this.options.adapter(t)}:{},...this.uiTheme?{ui:this.uiTheme}:{},layouts:!1,onSymbolChange:m=>{var f,g,v;(f=n.onSymbolChange)==null||f.call(n,m),(g=r.onSymbolChange)==null||g.call(r,m),this.sync.symbol&&this.relay(a,y=>void y.setSymbol(m)),this.renderTabs(),(v=this.session)==null||v.changed()},onTimeframeChange:m=>{var f,g,v;(f=n.onTimeframeChange)==null||f.call(n,m),(g=r.onTimeframeChange)==null||g.call(r,m),this.sync.interval&&this.relay(a,y=>void y.setTimeframe(m)),this.renderTabs(),(v=this.session)==null||v.changed()}});return a.el=e,a.widget=o,Object.keys(this.styleOverrides).length>0&&o.getChart().applyOverrides(this.styleOverrides),Object.keys(this.featureSwitches).length>0&&o.setFeatures(this.featureSwitches),this.wireCell(a),e.addEventListener("pointerdown",()=>this.setActive(this.cells.indexOf(a)),!0),e.addEventListener("pointerenter",()=>{this.hovered=a}),e.addEventListener("pointerleave",()=>{this.hovered===a&&(this.hovered=null)}),(p=(h=this.options).onChartAdd)==null||p.call(h,o,t),a}wireCell(t){const e=t.widget.getChart(),r=()=>this.cells.filter(n=>n!==t);e.on("crosshairMove",n=>{var a;const s=(a=n.payload.bar)==null?void 0:a.time;if(!(!this.sync.crosshair||s===void 0))for(const o of r())o.widget.getChart().setCrosshairTime(s)}),e.on("crosshairLeave",()=>{if(this.sync.crosshair)for(const n of r())n.widget.getChart().setCrosshairTime(null)}),e.on("visibleRangeChange",n=>{var h,p;if(!this.sync.time||this.relaying||(this.hovered??this.cells[this.active])!==t)return;const{from:s,to:a}=n.payload,o=e.getData(),c=(h=o[s])==null?void 0:h.time,l=(p=o[a])==null?void 0:p.time;c===void 0||l===void 0||this.relay(t,m=>m.getChart().setVisibleRange(c,l))});for(const n of["drawingCreate","drawingUpdate","drawingRemove"])e.on(n,()=>{this.sync.drawings&&!this.relaying&&this.copyDrawingsSoon(t)});e.on("replayStep",n=>{if(!this.sync.replay||this.relaying)return;const{until:s}=n.payload;this.relay(t,a=>{const o=a.getChart();if(o.isReplayActive()){o.replaySeekToTime(s);return}const c=Rl(o.getData(),s);c>=0&&o.replayStart({startIndex:c,paused:!0})})}),e.on("replayState",n=>{!this.sync.replay||this.relaying||n.payload.state!=="stopped"||this.relay(t,s=>{s.getChart().isReplayActive()&&s.getChart().replayStop()})}),e.on("stateChange",()=>{var n;return(n=this.session)==null?void 0:n.changed()}),e.on("themeChange",()=>{this.relaying||this.followTheme(t)})}destroyCell(t){this.hovered===t&&(this.hovered=null),this.drawingSource===t&&(this.drawingSource=null),this.quietly(()=>t.widget.destroy()),t.el.remove()}relay(t,e){this.relaying||this.quietly(()=>{for(const r of this.cells)r!==t&&e(r.widget)})}unpark(t,e){var a;const r=this.parked.get(t);if(!r)return;this.parked.delete(t);const n=(a=this.cells[this.active])==null?void 0:a.widget,s={...r,...n&&this.sync.symbol?{symbol:n.getSymbol()}:{},...n&&this.sync.interval?{timeframe:n.getTimeframe()}:{}};this.relayDepth++,e.widget.restoreLayout(s).catch(()=>e.widget.toast(this.t("layouts.openFailed"),"error")).finally(()=>{this.relayDepth--})}copyDrawingsSoon(t){this.drawingSource=t,!this.drawingFrame&&(this.drawingFrame=requestAnimationFrame(()=>{this.drawingFrame=0;const e=this.drawingSource;this.drawingSource=null,e&&!this.destroyed&&!this.relaying&&this.copyDrawings(e)}))}copyDrawings(t){const e=t.widget.getSymbol(),r=t.widget.getChart().getDrawings();this.quietly(()=>{for(const n of this.cells)n!==t&&n.widget.getSymbol()===e&&n.widget.getChart().setDrawings(Bn(r))})}mergeDrawings(){const t=new Map;for(const e of this.cells)t.set(e.widget.getSymbol(),[...t.get(e.widget.getSymbol())??[],e]);this.quietly(()=>{for(const e of t.values()){if(e.length<2)continue;const r=new Map;for(const s of e)for(const a of s.widget.getChart().getDrawings())r.has(a.id)||r.set(a.id,a);const n=[...r.values()];for(const s of e)s.widget.getChart().setDrawings(Bn(n))}})}followTheme(t=this.cells[this.active]){var r;const e=(r=t==null?void 0:t.el.querySelector(".tcw-root"))==null?void 0:r.dataset.tcwTheme;e&&(this.root.dataset.tcwTheme=e,this.quietly(()=>{var n;for(const s of this.cells)s!==t&&((n=s.el.querySelector(".tcw-root"))==null?void 0:n.dataset.tcwTheme)!==e&&s.widget.setTheme(e)}))}markActive(){this.cells.forEach((t,e)=>{t.el.classList.toggle("tcw-grid-cell-active",e===this.active&&this.cells.length>1),t.el.classList.toggle("tcw-grid-cell-current",e===this.active)}),this.renderTabs()}renderTabs(){var r;const t=this.tabsEl;if(!t)return;const e=this.cells.map(n=>`${n.widget.getSymbol()} · ${n.widget.getTimeframe()}`);for(;t.children.length>e.length;)(r=t.lastElementChild)==null||r.remove();for(;t.children.length<e.length;){const n=t.children.length,s=document.createElement("button");s.type="button",s.className="tcw-btn tcw-grid-tab",s.addEventListener("click",()=>this.setActive(n)),t.appendChild(s)}e.forEach((n,s)=>{const a=t.children[s];a.textContent!==n&&(a.textContent=n);const o=s===this.active;a.classList.toggle("tcw-active",o),a.setAttribute("aria-pressed",String(o))})}buildBar(){var o;const t=document.createElement("div");t.className="tcw-grid-bar",t.setAttribute("role","toolbar"),t.setAttribute("aria-label",this.t("grid.bar")),this.tabsEl=document.createElement("div"),this.tabsEl.className="tcw-grid-group tcw-grid-tabs",this.root.classList.add("tcw-grid-has-tabs"),this.tabsEl.setAttribute("role","group"),this.tabsEl.setAttribute("aria-label",this.t("grid.charts")),t.appendChild(this.tabsEl);const e=document.createElement("div");e.className="tcw-grid-group",e.setAttribute("role","group"),e.setAttribute("aria-label",this.t("grid.layout"));const r=((o=this.options.layoutChoices)==null?void 0:o.filter(ae))??Object.keys(Tt);for(const c of r){const{cols:l,rows:h}=Tt[c],p=l*h===1?this.t("grid.single"):S(this.t("grid.layoutOption"),{count:l*h,cols:l,rows:h}),m=document.createElement("button");m.type="button",m.className="tcw-btn-icon",m.title=p,m.setAttribute("aria-label",p),m.innerHTML=Ol(l,h),m.addEventListener("click",()=>this.setLayout(c)),this.layoutButtons.set(c,m),e.appendChild(m)}const n=document.createElement("div");n.className="tcw-grid-group",n.setAttribute("role","group"),n.setAttribute("aria-label",this.t("grid.sync"));const s=document.createElement("span");s.className="tcw-grid-label",s.innerHTML=`${b("link",13)}<span>${T(this.t("grid.sync"))}</span>`,n.appendChild(s);for(const c of Ns){const l=document.createElement("button");l.type="button",l.className="tcw-btn tcw-grid-sync",l.textContent=this.t(`grid.sync.${c}`),l.title=this.t(`grid.sync.${c}.hint`),l.addEventListener("click",()=>this.setSync({[c]:!this.sync[c]})),this.syncButtons.set(c,l),n.appendChild(l)}const a=document.createElement("span");return a.className="tcw-toolbar-spacer",t.append(e,this.sep(),n,a),this.options.layouts!==!1&&(this.layoutsButton=document.createElement("button"),this.layoutsButton.type="button",this.layoutsButton.className="tcw-dropdown-trigger tcw-layouts-btn",this.layoutsButton.setAttribute("aria-haspopup","menu"),this.layoutsButton.addEventListener("click",()=>{var c;this.layoutsButton&&((c=this.layoutsUI)==null||c.openMenu(this.layoutsButton))}),t.appendChild(this.layoutsButton)),this.renderBar(),t}sep(){const t=document.createElement("span");return t.className="tcw-toolbar-sep",t}renderBar(){for(const[t,e]of this.layoutButtons){const r=t===this.layout;e.classList.toggle("tcw-active",r),e.setAttribute("aria-pressed",String(r))}for(const[t,e]of this.syncButtons)e.classList.toggle("tcw-active",this.sync[t]),e.setAttribute("aria-pressed",String(this.sync[t]));this.renderLayoutsButton()}renderLayoutsButton(){var s,a,o;const t=this.layoutsButton;if(!t)return;const e=((a=(s=this.session)==null?void 0:s.current())==null?void 0:a.name)??this.t("layouts.unnamed"),r=((o=this.session)==null?void 0:o.isDirty())??!1,n=`${this.t("toolbar.layouts")}: ${e}${r?` (${this.t("layouts.unsavedChanges")})`:""}`;t.innerHTML=`${b("save",14)}<span class="tcw-layouts-label">${T(e)}</span>`+(r?'<span class="tcw-layouts-dirty" aria-hidden="true"></span>':"")+b("chevronDown",12),t.title=n,t.setAttribute("aria-label",n)}setupLayouts(t){const e=new _n(t.storage??Un("tcw:grid-layouts:"),{capture:()=>{const r=this.cells[this.active].widget;return{content:this.getLayoutContent(),symbol:r.getSymbol(),timeframe:r.getTimeframe()}},apply:async r=>{if(!await this.applyLayoutContent(r.content))throw new Error("Not a grid layout")}},{autoSave:t.autoSave,debounceMs:t.debounceMs,kind:"grid",onChange:()=>this.renderLayoutsButton(),onError:()=>this.toast(this.t("layouts.saveFailed"),"error")});this.session=e,this.layoutsUI=new Ss(e,{root:this.root,t:this.t,toast:(r,n)=>this.toast(r,n),formatTime:r=>{const{date:n,time:s}=Q(r,null);return`${n} ${s}`}}),this.renderLayoutsButton(),t.openLast&&e.list().then(([r])=>{var n;return r&&!this.destroyed?(n=this.layoutsUI)==null?void 0:n.open(r.id):void 0},()=>{})}toast(t,e="info"){var r;(r=this.cells[this.active])==null||r.widget.toast(t,e)}}function Rl(i,t){let e=-1;for(let r=0;r<i.length&&i[r].time<t;r++)e=r;return e}export{zs as CHART_TYPE_ICONS,Il as ChartWidget,ql as ChartWidgetGrid,As as DEFAULT_GRID_SYNC,Bs as DRAWING_TOOL_ICONS,It as EN_MESSAGES,Tt as GRID_SHAPES,_n as LayoutSession,ai as MAX_LAYOUT_NAME,Ze as UI_ICONS,si as VI_MESSAGES,Pt as WIDGET_FEATURES,Kl as WIDGET_UI_PRESETS,wt as applyWidgetUI,Er as cleanLayoutName,We as createChartTypeIcon,b as createIcon,yt as createToolIcon,ia as findWidgetLocale,Je as iconSvg,Un as localStorageLayouts,Xl as memoryLayouts,Fl as readGridLayout,Ee as readWatchlists,Cs as readWidgetLayout,Vl as registerWidgetLocale,ft as resolveWidgetUI,wo as widgetUIVariables};
