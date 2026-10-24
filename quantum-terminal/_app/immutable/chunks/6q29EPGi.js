var wt=Object.defineProperty;var St=(l,t,s)=>t in l?wt(l,t,{enumerable:!0,configurable:!0,writable:!0,value:s}):l[t]=s;var f=(l,t,s)=>St(l,typeof t!="symbol"?t+"":t,s);import{P as Rt,a as Ct,c as At,f as kt,g as Et,b as Mt,d as Tt}from"./DzrvRgto.js";import{r as Bt}from"./LSw6eVC9.js";const C=6,X=(l,t)=>l.time===t.time&&l.open===t.open&&l.high===t.high&&l.low===t.low&&l.close===t.close&&l.volume===t.volume;class J{constructor(){f(this,"buffer",new Float32Array(0));f(this,"count",0);f(this,"basePrice",0);f(this,"samples",[]);f(this,"last",null);f(this,"source",null)}get values(){return this.buffer}get length(){return this.count}get base(){return this.basePrice}sync(t){const s=t.length;if(s===0)return this.reset(),{full:!0,from:0,to:0};const e=this.count;if(!(t===this.source&&e>0&&s>=e&&this.samples.every(({index:r,bar:a})=>X(t[r],a))))return this.basePrice=t[s-1].close,this.ensure(s),this.write(t,0,s),this.remember(t),{full:!0,from:0,to:s};const i=this.last!==null&&X(t[e-1],this.last)?e:e-1;return s>this.buffer.length/C?(this.ensure(s),this.write(t,0,s),this.remember(t),{full:!0,from:0,to:s}):(this.write(t,i,s),this.remember(t),{full:!1,from:i,to:s})}reset(){this.count=0,this.samples=[],this.last=null,this.source=null}ensure(t){t*C<=this.buffer.length||(this.buffer=new Float32Array(Math.max(t+1024,Math.ceil(t*1.25))*C))}write(t,s,e){const o=this.buffer,i=this.basePrice;for(let r=s;r<e;r++){const a=t[r],n=r*C;o[n]=a.open-i,o[n+1]=a.high-i,o[n+2]=a.low-i,o[n+3]=a.close-i,o[n+4]=a.volume,o[n+5]=a.close>=a.open?1:0}this.count=e}remember(t){const s=t.length,e=s-1,o=new Set;if(e>0)for(let i=0;i<16;i++)o.add(Math.min(e-1,Math.round(i*(e-1)/15)));this.samples=[...o].map(i=>({index:i,bar:{...t[i]}})),this.last={...t[s-1]},this.source=t}}const I=new Map;let R;function L(l,t){return l.endsWith("%")?parseFloat(l)/100:parseFloat(l)/t}function ut(l){const t=l.trim();if(t.toLowerCase()==="transparent")return[0,0,0,0];const s=/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(t);if(s){let o=s[1];o.length<=4&&(o=[...o].map(r=>r+r).join(""));const i=r=>parseInt(o.slice(r,r+2),16)/255;return[i(0),i(2),i(4),o.length===8?i(6):1]}const e=/^rgba?\(\s*([\d.]+%?)[\s,]+([\d.]+%?)[\s,]+([\d.]+%?)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/i.exec(t);return e?[L(e[1],255),L(e[2],255),L(e[3],255),e[4]===void 0?1:L(e[4],1)]:null}function Ft(){if(R!==void 0)return R;try{typeof OffscreenCanvas<"u"?R=new OffscreenCanvas(1,1).getContext("2d"):typeof document<"u"?R=document.createElement("canvas").getContext("2d"):R=null}catch{R=null}return R}function Dt(l){const t=Ft();if(!t)return null;t.fillStyle="#000",t.fillStyle=l;const s=String(t.fillStyle);if(t.fillStyle="#fff",t.fillStyle=l,String(t.fillStyle)!==s)return null;const e=ut(s);if(e)return e;t.clearRect(0,0,1,1),t.fillRect(0,0,1,1);const o=t.getImageData(0,0,1,1).data;return[o[0]/255,o[1]/255,o[2]/255,o[3]/255]}const N=new Set;function ft(l){const t=I.get(l);if(t)return t;if(N.has(l))return null;const s=ut(l)??Dt(l);return I.size>256&&I.clear(),N.size>256&&N.clear(),s?I.set(l,s):N.add(l),s}function b(l){return ft(l)??[0,0,0,0]}function S([l,t,s,e]){return[l*e,t*e,s*e,e]}function Pt(l,t){const{min:s,max:e}=l.priceRange,{y:o,height:i}=l.chartRect,r=l.invertScale===!0?1:0,a={log:0,invert:r,yA:o+i/2,yB:0,logOffset:0,min:1,logFloor:0,logK:0,top:o,bottom:o+i};if(l.logScale&&s>0&&e>0){const h=Math.log(e)-Math.log(s);return h===0?a:{...a,log:1,logOffset:t-s,min:s,logFloor:Number.EPSILON/s,logK:i/h}}const n=e-s;if(n===0)return a;const c=i/n;return r?{...a,yA:o+(t-s)*c,yB:c}:{...a,yA:o+(e-t)*c,yB:-c}}class It{constructor(t){this.gl=t}program(t,s,e){const o=this.gl,i=(u,p)=>{const d=o.createShader(u);if(!d)throw new Error("WebGL: no shader");if(o.shaderSource(d,p),o.compileShader(d),!o.getShaderParameter(d,o.COMPILE_STATUS)){const _=o.getShaderInfoLog(d);throw o.deleteShader(d),new Error(`WebGL shader: ${_}`)}return d},r=i(o.VERTEX_SHADER,t),a=i(o.FRAGMENT_SHADER,s),n=o.createProgram();if(!n)throw new Error("WebGL: no program");if(o.attachShader(n,r),o.attachShader(n,a),o.linkProgram(n),o.deleteShader(r),o.deleteShader(a),!o.getProgramParameter(n,o.LINK_STATUS))throw new Error(`WebGL program: ${o.getProgramInfoLog(n)}`);const c=o.createVertexArray();if(!c)throw new Error("WebGL: no vertex array");const h=new Map;for(const u of e)h.set(u,o.getAttribLocation(n,u));return{program:n,vao:c,uniforms:new Map,attribs:h}}buffer(){const t=this.gl.createBuffer();if(!t)throw new Error("WebGL: no buffer");return t}use(t){return this.gl.useProgram(t.program),this.gl.bindVertexArray(t.vao),t}attrib(t,s,e,o,i,r=1){const a=t.attribs.get(s);if(a===void 0||a<0)return;const n=this.gl;n.enableVertexAttribArray(a),n.vertexAttribPointer(a,e,n.FLOAT,!1,o,i),n.vertexAttribDivisor(a,r)}int(t,s,e){this.gl.uniform1i(this.loc(t,s),e)}float(t,s,e){this.gl.uniform1f(this.loc(t,s),e)}vec2(t,s,e,o){this.gl.uniform2f(this.loc(t,s),e,o)}vec4(t,s,e){this.gl.uniform4f(this.loc(t,s),e[0],e[1],e[2],e[3])}loc(t,s){return t.uniforms.has(s)||t.uniforms.set(s,this.gl.getUniformLocation(t.program,s)),t.uniforms.get(s)??null}deleteProgram(t){this.gl.deleteVertexArray(t.vao),this.gl.deleteProgram(t.program)}scissor(t,s,e,o,i,r){const a=Math.max(0,Math.floor(t)),n=Math.max(0,Math.floor(s)),c=Math.min(i,Math.ceil(e)),h=Math.min(r,Math.ceil(o));if(!(c>a&&h>n))return!1;const u=this.gl;return u.enable(u.SCISSOR_TEST),u.scissor(a,r-h,c-a,h-n),!0}}const dt=8;function Lt(l){const t=l.length/2;if(t<3)return[];let s=0,e=0;for(let r=1;r<t;r++)l[2*r]<l[2*s]&&(s=r),l[2*r]>l[2*e]&&(e=r);if(l[2*s]===l[2*e])return[];const o=Z(l,s,e,1,t),i=Z(l,s,e,-1,t);return!o||!i?null:Nt(o,i)}function Q(l){let t=0;const s=l.length/2;for(let e=0;e<s;e++){const o=(e+1)%s;t+=l[2*e]*l[2*o+1]-l[2*o]*l[2*e+1]}return t/2}function Z(l,t,s,e,o){const i=[l[2*t],l[2*t+1]];for(let r=t;r!==s;){if(r=(r+e+o)%o,l[2*r]<i[i.length-2])return null;i.push(l[2*r],l[2*r+1])}return i}class tt{constructor(t){f(this,"i",0);this.c=t}at(t,s){const e=this.c;for(;this.i+5<e.length&&(e[this.i+2]<s||e[this.i+2]===e[this.i]);)this.i+=2;const o=e[this.i],i=e[this.i+1],r=e[this.i+2],a=e[this.i+3],n=c=>r===o?i:i+(a-i)*(c-o)/(r-o);return[n(t),n(s)]}}function Nt(l,t){const s=new Set;for(let n=0;n<l.length;n+=2)s.add(l[n]);for(let n=0;n<t.length;n+=2)s.add(t[n]);const e=[...s].sort((n,c)=>n-c),o=new tt(l),i=new tt(t),r=[],a=e.length-2;for(let n=0;n<=a;n++){const c=e[n],h=e[n+1],[u,p]=o.at(c,h),[d,_]=i.at(c,h);u===d&&p===_||r.push(c,h,u,p,d,_,n===0?1:0,n===a?1:0)}return r}const k=`#version 300 es
precision highp float;
uniform vec2 u_canvas;
uniform vec4 u_clip;

vec4 toClip(vec2 dev) {
  return vec4(dev.x / u_canvas.x * 2.0 - 1.0, 1.0 - dev.y / u_canvas.y * 2.0, 0.0, 1.0);
}
`,H=`
vec2 corner(int k) {
  if (k == 0) return vec2(0.0, 0.0);
  if (k == 1 || k == 4) return vec2(1.0, 0.0);
  if (k == 2 || k == 3) return vec2(0.0, 1.0);
  return vec2(1.0, 1.0);
}
const vec4 NOWHERE = vec4(-2.0, -2.0, 0.0, 1.0);
`,K=`
// This fragment's pixel centre in device pixels, y down.
vec2 pixelCentre() { return vec2(gl_FragCoord.x, u_canvas.y - gl_FragCoord.y); }

// The share of the pixel centred at p inside the clip.
float clipCoverage(vec2 p) {
  vec2 lo = p - 0.5;
  vec2 c = clamp(min(lo + 1.0, u_clip.zw) - max(lo, u_clip.xy), 0.0, 1.0);
  return c.x * c.y;
}
`,Ot=`${k}${H}
uniform float u_hw;
in vec4 a_p0;
in vec4 a_p1;
in vec4 a_p2;
in vec4 a_p3;
in vec4 a_p4;
in vec4 a_p5;
flat out vec4 v_p0;
flat out vec4 v_p1;
flat out vec4 v_p2;
flat out vec4 v_p3;
flat out vec4 v_p4;
flat out vec4 v_p5;

void main() {
  v_p0 = a_p0; v_p1 = a_p1; v_p2 = a_p2; v_p3 = a_p3; v_p4 = a_p4; v_p5 = a_p5;
  if (a_p2.z < 0.5 || a_p3.z < 0.5) { gl_Position = NOWHERE; return; }
  vec2 a = a_p2.xy;
  vec2 b = a_p3.xy;
  vec2 d = b - a;
  float len = length(d);
  vec2 dir = len > 0.0 ? d / len : vec2(1.0, 0.0);
  vec2 n = vec2(-dir.y, dir.x);
  float m = u_hw + 1.0;
  vec2 cr = corner(gl_VertexID % 6);
  vec2 pos = mix(a - dir * m, b + dir * m, cr.x) + n * mix(-m, m, cr.y);
  gl_Position = toClip(pos);
}
`,Ut=`${k}${K}
uniform vec4 u_color;
uniform float u_hw;
uniform int u_cap;
uniform vec4 u_dash;
flat in vec4 v_p0;
flat in vec4 v_p1;
flat in vec4 v_p2;
flat in vec4 v_p3;
flat in vec4 v_p4;
flat in vec4 v_p5;
out vec4 outColor;

float segDist(vec2 p, vec2 a, vec2 b) {
  vec2 ab = b - a;
  float l2 = dot(ab, ab);
  float t = l2 > 0.0 ? clamp(dot(p - a, ab) / l2, 0.0, 1.0) : 0.0;
  return length(p - a - t * ab);
}

bool joined(vec4 a, vec4 b) { return a.z > -0.5 && b.z > -0.5; }

// The share of a pixel at distance d from the centre line inside a line hw either side.
float across(float d) { return clamp(min(u_hw, d + 0.5) - max(-u_hw, d - 0.5), 0.0, 1.0); }

// The share of [s - 0.5, s + 0.5] inside [lo, hi].
float span(float s, float lo, float hi) { return clamp(min(s + 0.5, hi) - max(s - 0.5, lo), 0.0, 1.0); }

// The share of [s - 0.5, s + 0.5] on a dash.
float onDash(float s) {
  float period = u_dash.x + u_dash.y + u_dash.z + u_dash.w;
  float base = s - mod(s, period);
  float on = 0.0;
  for (int k = -1; k <= 1; k++) {
    float p0 = base + float(k) * period;
    on += span(s, p0, p0 + u_dash.x);
    on += span(s, p0 + u_dash.x + u_dash.y, p0 + u_dash.x + u_dash.y + u_dash.z);
  }
  return min(on, 1.0);
}

void main() {
  vec2 p = pixelCentre();
  float clipCov = clipCoverage(p);
  if (clipCov <= 0.0) discard;
  vec2 a = v_p2.xy;
  vec2 b = v_p3.xy;
  vec2 ab = b - a;
  float len = length(ab);
  vec2 dir = len > 0.0 ? ab / len : vec2(1.0, 0.0);
  float along = dot(p - a, dir);
  float perp = abs(dot(p - a, vec2(-dir.y, dir.x)));
  bool startEnd = v_p1.z < -0.5;
  bool finalEnd = v_p4.z < -0.5;

  float cov;
  if (u_dash.x + u_dash.y > 0.0) {
    cov = across(perp) * onDash(v_p2.w + along) * span(along, 0.0, len);
  } else {
    float self = segDist(p, a, b);
    float nearest = self;
    if (joined(v_p0, v_p1)) { float d = segDist(p, v_p0.xy, v_p1.xy); if (d <= self) discard; nearest = min(nearest, d); }
    if (joined(v_p1, v_p2)) { float d = segDist(p, v_p1.xy, v_p2.xy); if (d <= self) discard; nearest = min(nearest, d); }
    if (joined(v_p3, v_p4)) { float d = segDist(p, v_p3.xy, v_p4.xy); if (d < self) discard; nearest = min(nearest, d); }
    if (joined(v_p4, v_p5)) { float d = segDist(p, v_p4.xy, v_p5.xy); if (d < self) discard; nearest = min(nearest, d); }
    cov = across(nearest);
    // Past an end of the line: its cap, square-ended (butt or square) or round.
    float before = startEnd ? -along : -1e9;
    float after = finalEnd ? along - len : -1e9;
    if (u_cap != 1 && (before > -0.5 || after > -0.5)) {
      float reach = u_cap == 2 ? u_hw : 0.0;
      float lo = startEnd ? -reach : -1e9;
      float hi = finalEnd ? len + reach : 1e9;
      cov = across(perp) * span(along, lo, hi);
    }
  }
  if (cov <= 0.0) discard;
  outColor = u_color * (cov * clipCov);
}
`,Wt=`${k}${H}
in vec2 a_x;
in vec4 a_ab;
in vec2 a_ends;
flat out vec2 v_x;
flat out vec4 v_ab;
flat out vec2 v_ends;

void main() {
  v_x = a_x;
  v_ab = a_ab;
  v_ends = a_ends;
  float lo = min(min(a_ab.x, a_ab.y), min(a_ab.z, a_ab.w));
  float hi = max(max(a_ab.x, a_ab.y), max(a_ab.z, a_ab.w));
  vec2 cr = corner(gl_VertexID % 6);
  gl_Position = toClip(mix(vec2(floor(a_x.x), floor(lo) - 1.0), vec2(ceil(a_x.y), ceil(hi) + 1.0), cr));
}
`,zt=`${k}${K}
uniform int u_kind;
uniform vec4 u_color;
uniform vec4 u_line;
uniform vec4 u_offsets;
uniform int u_stops;
uniform vec4 u_stop0;
uniform vec4 u_stop1;
uniform vec4 u_stop2;
uniform vec4 u_stop3;
flat in vec2 v_x;
flat in vec4 v_ab;
flat in vec2 v_ends;
out vec4 outColor;

vec4 stopColor(int i) {
  if (i == 0) return u_stop0;
  if (i == 1) return u_stop1;
  if (i == 2) return u_stop2;
  return u_stop3;
}

vec4 gradient(vec2 p) {
  vec2 g = u_line.zw - u_line.xy;
  float l2 = dot(g, g);
  // A gradient of no length paints nothing.
  if (l2 <= 0.0) return vec4(0.0);
  float t = dot(p - u_line.xy, g) / l2;
  vec4 c = stopColor(0);
  for (int i = 1; i < 4; i++) {
    if (i >= u_stops) break;
    float o0 = u_offsets[i - 1];
    float o1 = u_offsets[i];
    if (t >= o1) c = stopColor(i);
    else if (t > o0) { c = mix(stopColor(i - 1), stopColor(i), (t - o0) / max(o1 - o0, 1e-6)); break; }
    else break;
  }
  return vec4(c.rgb * c.a, c.a);
}

void main() {
  vec2 p = pixelCentre();
  float x0 = v_x.x;
  float x1 = v_x.y;
  float left = v_ends.x > 0.5 ? clamp(p.x + 0.5 - x0, 0.0, 1.0) : (p.x >= x0 ? 1.0 : 0.0);
  float right = v_ends.y > 0.5 ? clamp(x1 - (p.x - 0.5), 0.0, 1.0) : (p.x < x1 ? 1.0 : 0.0);
  float along = v_ends.x > 0.5 && v_ends.y > 0.5
    ? clamp(min(p.x + 0.5, x1) - max(p.x - 0.5, x0), 0.0, 1.0)
    : min(left, right);
  float t = clamp((clamp(p.x, x0, x1) - x0) / max(x1 - x0, 1e-6), 0.0, 1.0);
  float ya = mix(v_ab.x, v_ab.y, t);
  float yb = mix(v_ab.z, v_ab.w, t);
  float across = clamp(min(p.y + 0.5, max(ya, yb)) - max(p.y - 0.5, min(ya, yb)), 0.0, 1.0);
  float cov = along * across * clipCoverage(p);
  if (cov <= 0.0) discard;
  vec4 color = u_kind == 1 ? gradient(p) : u_color;
  outColor = color * cov;
}
`,Vt=`${k}${H}
in vec3 a_disc;
in vec4 a_color;
flat out vec3 v_disc;
flat out vec4 v_color;
void main() {
  v_disc = a_disc;
  v_color = a_color;
  float m = a_disc.z + 1.0;
  gl_Position = toClip(mix(a_disc.xy - m, a_disc.xy + m, corner(gl_VertexID % 6)));
}
`,Gt=`${k}${K}
flat in vec3 v_disc;
flat in vec4 v_color;
out vec4 outColor;
void main() {
  vec2 p = pixelCentre();
  float cov = clamp(v_disc.z + 0.5 - length(p - v_disc.xy), 0.0, 1.0) * clipCoverage(p);
  if (cov <= 0.0) discard;
  outColor = v_color * cov;
}
`,pt=4,et=pt*4,V=dt*4,_t=7,st=_t*4;class Yt{constructor(t){f(this,"stroke");f(this,"span");f(this,"disc");f(this,"buffer");this.kit=t,this.stroke=t.program(Ot,Ut,["a_p0","a_p1","a_p2","a_p3","a_p4","a_p5"]),this.span=t.program(Wt,zt,["a_x","a_ab","a_ends"]),this.disc=t.program(Vt,Gt,["a_disc","a_color"]),this.buffer=t.buffer()}draw(t,s,e,o){var r;const i=this.kit.gl;i.enable(i.BLEND);for(let a=0;a<t.length;a++){const n=t[a];if(i.blendFunc(i.ONE,i.ONE_MINUS_SRC_ALPHA),i.disable(i.SCISSOR_TEST),n.type==="rects"){const c=[n.values];for(;((r=t[a+1])==null?void 0:r.type)==="rects";)c.push(t[++a].values);this.drawRects(c,o)}else n.type==="stroke"?this.drawStroke(n,s,e):n.type==="fill"?this.drawFill(n,s,e):this.drawDiscs(n.values,n.clip,s,e)}i.disable(i.SCISSOR_TEST)}destroy(){for(const t of[this.stroke,this.span,this.disc])this.kit.deleteProgram(t);this.kit.gl.deleteBuffer(this.buffer)}upload(t){const s=this.kit.gl;s.bindBuffer(s.ARRAY_BUFFER,this.buffer),s.bufferData(s.ARRAY_BUFFER,t,s.STREAM_DRAW)}common(t,s,e,o){const i=this.kit;return i.scissor(s.x0,s.y0,s.x1,s.y1,e,o)?(i.use(t),i.vec2(t,"u_canvas",e,o),i.vec4(t,"u_clip",[s.x0,s.y0,Math.min(s.x1,e),Math.min(s.y1,o)]),!0):!1}drawRects(t,s){let e=0;for(const r of t)e+=r.length/8;const o=new Float32Array(e*10);let i=0;for(const r of t)for(let a=0;a<r.length;a+=8,i++)for(let n=0;n<8;n++)o[i*10+n]=r[a+n];s(o,e)}drawStroke(t,s,e){const o=this.stroke;if(!this.common(o,t.clip,s,e))return;const i=this.kit;i.vec4(o,"u_color",t.color),i.float(o,"u_hw",t.width/2),i.int(o,"u_cap",t.cap),i.vec4(o,"u_dash",t.dash??[0,0,0,0]),this.upload(new Float32Array(t.points));for(let a=0;a<6;a++)i.attrib(o,`a_p${a}`,4,et,a*et);const r=t.points.length/pt-5;r>0&&i.gl.drawArraysInstanced(i.gl.TRIANGLES,0,6,r)}drawFill(t,s,e){const o=this.kit,i=t.bounds;if(!o.scissor(i.x0,i.y0,i.x1,i.y1,s,e))return;const r=o.use(this.span);o.vec2(r,"u_canvas",s,e),o.vec4(r,"u_clip",[t.clip.x0,t.clip.y0,Math.min(t.clip.x1,s),Math.min(t.clip.y1,e)]),this.upload(new Float32Array(t.spans)),o.attrib(r,"a_x",2,V,0),o.attrib(r,"a_ab",4,V,8),o.attrib(r,"a_ends",2,V,24),this.paint(r,t.paint),o.gl.drawArraysInstanced(o.gl.TRIANGLES,0,6,t.spans.length/dt)}paint(t,s){const e=this.kit;if(s.kind==="solid"){e.int(t,"u_kind",0),e.vec4(t,"u_color",s.color);return}e.int(t,"u_kind",1),e.vec4(t,"u_line",[s.x0,s.y0,s.x1,s.y1]);const o=[0,0,0,0];s.stops.forEach((i,r)=>{o[r]=i.offset}),e.vec4(t,"u_offsets",o),e.int(t,"u_stops",s.stops.length);for(let i=0;i<4;i++)e.vec4(t,`u_stop${i}`,(s.stops[i]??s.stops[s.stops.length-1]).color)}drawDiscs(t,s,e,o){const i=this.disc;this.common(i,s,e,o)&&(this.upload(new Float32Array(t)),this.kit.attrib(i,"a_disc",3,st,0),this.kit.attrib(i,"a_color",4,st,12),this.kit.gl.drawArraysInstanced(this.kit.gl.TRIANGLES,0,6,t.length/_t))}}const ot=(l,t)=>({x0:Math.max(l.x0,t.x0),y0:Math.max(l.y0,t.y0),x1:Math.min(l.x1,t.x1),y1:Math.min(l.y1,t.y1)}),vt=l=>!(l.x1>l.x0&&l.y1>l.y0);function G(l,t=0){let s=1/0,e=1/0,o=-1/0,i=-1/0;for(let r=0;r<l.length;r+=2){const a=l[r],n=l[r+1];a<s&&(s=a),a>o&&(o=a),n<e&&(e=n),n>i&&(i=n)}return{x0:s-t,y0:e-t,x1:o+t,y1:i+t}}function it(l){const t=[...l].sort((e,o)=>e.x0-o.x0),s=[];for(const e of t){for(let o=s.length-1;o>=0;o--)s[o].x1<=e.x0&&s.splice(o,1);for(const o of s)if(o.y0<e.y1&&e.y0<o.y1)return!0;s.push(e)}return!1}class Y{constructor(t,s,e,o){f(this,"stops",[]);this.x0=t,this.y0=s,this.x1=e,this.y1=o}addColorStop(t,s){if(!(t>=0&&t<=1))throw new RangeError("offset out of range");this.stops.push({offset:t,color:s})}}const $=typeof Path2D=="function"?Path2D:class{};class F extends ${constructor(s){super(s);f(this,"calls",[]);f(this,"unsupported",!1);s instanceof F?(this.calls.push(...s.calls),this.unsupported=s.unsupported):s!==void 0&&(this.unsupported=!0)}note(s,e,o=e){this.calls.push([s,e]);const i=$.prototype[s];i==null||i.apply(this,o)}unfollowed(s,e){this.unsupported=!0,this.note(s,[],e)}moveTo(s,e){this.note("moveTo",[s,e])}lineTo(s,e){this.note("lineTo",[s,e])}closePath(){this.note("closePath",[])}rect(s,e,o,i){this.note("rect",[s,e,o,i])}arc(s,e,o,i,r,a){this.note("arc",[s,e,o,i,r,a?1:0])}quadraticCurveTo(s,e,o,i){this.note("quadraticCurveTo",[s,e,o,i])}bezierCurveTo(s,e,o,i,r,a){this.note("bezierCurveTo",[s,e,o,i,r,a])}arcTo(...s){this.unfollowed("arcTo",s)}ellipse(...s){this.unfollowed("ellipse",s)}roundRect(...s){this.unfollowed("roundRect",s)}addPath(s,e){var o;!(s instanceof F)||e!==void 0?this.unsupported=!0:(this.calls.push(...s.calls),this.unsupported||(this.unsupported=s.unsupported)),(o=$.prototype.addPath)==null||o.call(this,s,e)}}function $t(l){const t=globalThis,s=Object.prototype.hasOwnProperty.call(t,"Path2D"),e=t.Path2D;t.Path2D=F;try{l()}finally{s?t.Path2D=e:delete t.Path2D}}const jt=.25;function Ht(l,t,s,e){if(s==="round")return!1;const o=l.points,i=o.length/2,r=l.closed?0:1,a=l.closed?i:i-1;for(let n=r;n<a;n++){const c=(n-1+i)%i,h=(n+1)%i,u=o[2*n]-o[2*c],p=o[2*n+1]-o[2*c+1],d=o[2*h]-o[2*n],_=o[2*h+1]-o[2*n+1],g=Math.hypot(u,p),y=Math.hypot(d,_);if(g===0||y===0)continue;const v=Math.max(-1,Math.min(1,(u*d+p*_)/(g*y))),w=Math.sqrt((1+v)/2);if((s==="miter"&&w>0&&1/w<=e?t*(1/w-1):t*(1-w))>jt)return!0}return!1}function Kt(l,t){const s=l.points;for(let e=2;e<s.length;e+=2)if(Math.hypot(s[e]-s[e-2],s[e+1]-s[e-1])<t)return!0;return!1}function qt(l){const t=[],s=()=>t.push(0,0,-1,0);s(),s();for(const{points:e,closed:o}of l){const i=e.length/2,r=o&&i>=3;r&&t.push(e[2*(i-2)],e[2*(i-2)+1],0,0,e[2*(i-1)],e[2*(i-1)+1],0,0);let a=0;for(let n=0;n<i;n++)n>0&&(a+=Math.hypot(e[2*n]-e[2*n-2],e[2*n+1]-e[2*n-1])),t.push(e[2*n],e[2*n+1],1,a);r&&(a+=Math.hypot(e[0]-e[2*(i-1)],e[1]-e[2*(i-1)+1]),t.push(e[0],e[1],1,a),t.push(e[2],e[3],0,0,e[4],e[5],0,0)),s()}return s(),t}const x=Math.PI*2;function Xt(l,t){const s=2*Math.sqrt(Math.max(.2/Math.max(l,.1),1e-6));return Math.min(512,Math.max(4,Math.ceil(Math.abs(t)/Math.min(s,Math.PI/4))))}const nt=new Set(["fillStyle","strokeStyle","lineWidth","lineCap","lineJoin","miterLimit","globalAlpha","globalCompositeOperation","lineDashOffset","font","textAlign","textBaseline","direction","shadowBlur","shadowColor","shadowOffsetX","shadowOffsetY","filter"]),rt=new Set(["fontKerning","fontStretch","fontVariantCaps","letterSpacing","wordSpacing","textRendering"]),at=new Set(["imageSmoothingEnabled","imageSmoothingQuality"]),lt=l=>!!(l.rect||l.circle)||l.points.length>=6;class Jt{constructor(t,s){f(this,"commands",[]);f(this,"ctx");f(this,"texts",[]);f(this,"takesText",!0);f(this,"state");f(this,"stack",[]);f(this,"path",[]);f(this,"ok",!0);f(this,"stepStart",0);f(this,"solid",null);this.dpr=t,this.measure=s,this.reset({x0:0,y0:0,x1:1/0,y1:1/0}),this.ctx=this.proxy()}region(t,s){const e=this.dpr,o={x0:t.x*e,y0:t.y*e,x1:(t.x+t.width)*e,y1:(t.y+t.height)*e},i=[],r=(s==null?void 0:s.text)!==!1;return{step:a=>{this.reset(o),this.texts=i,this.takesText=r;const n={commands:this.commands.length,texts:i.length};this.stepStart=n.commands,this.ok=!0;try{$t(()=>a(this.ctx))}catch{this.ok=!1}return this.ok?!0:(this.commands.length=n.commands,i.length=n.texts,!1)},drawText:a=>Qt(a,i)}}reset(t){this.state={fillStyle:"#000000",strokeStyle:"#000000",lineWidth:1,lineCap:"butt",lineJoin:"miter",miterLimit:10,globalAlpha:1,globalCompositeOperation:"source-over",lineDash:[],lineDashOffset:0,font:"10px sans-serif",textAlign:"start",textBaseline:"alphabetic",direction:"inherit",shadowBlur:0,shadowColor:"rgba(0, 0, 0, 0)",shadowOffsetX:0,shadowOffsetY:0,filter:"none",textExtras:{},transform:[this.dpr,0,0,this.dpr,0,0],clip:t},this.stack=[],this.path=[]}unsupported(){this.ok=!1}copyState(){const t=this.state;return{...t,lineDash:[...t.lineDash],textExtras:{...t.textExtras}}}axisAligned(){const t=this.state.transform;return t[1]===0&&t[2]===0}uniform(){const t=this.state.transform;return this.axisAligned()&&Math.abs(t[0])===Math.abs(t[3])}setMatrix(t){t.every(Number.isFinite)&&(this.state.transform=t)}multiply(t,s,e,o,i,r){const[a,n,c,h,u,p]=this.state.transform;this.setMatrix([a*t+c*s,n*t+h*s,a*e+c*o,n*e+h*o,a*i+c*r+u,n*i+h*r+p])}current(){return this.path[this.path.length-1]}moveTo(t,s){if(!Number.isFinite(t)||!Number.isFinite(s))return;const e=this.state.transform;this.path.push({points:[e[0]*t+e[2]*s+e[4],e[1]*t+e[3]*s+e[5]],closed:!1})}lineTo(t,s){if(!Number.isFinite(t)||!Number.isFinite(s))return;const e=this.current();if(!e||e.closed)return this.moveTo(t,s);const o=this.state.transform;e.points.push(o[0]*t+o[2]*s+o[4],o[1]*t+o[3]*s+o[5]),e.rect=void 0,e.circle=void 0}closePath(){const t=this.current();!t||t.closed||(t.closed=!0,this.path.push({points:[t.points[0],t.points[1]],closed:!1}))}rect(t,s,e,o){if(![t,s,e,o].every(Number.isFinite))return;const i=this.state.transform,r=i[0]*t+i[2]*s+i[4],a=i[1]*t+i[3]*s+i[5],n=i[0]*(t+e)+i[2]*s+i[4],c=i[1]*(t+e)+i[3]*s+i[5],h=i[0]*(t+e)+i[2]*(s+o)+i[4],u=i[1]*(t+e)+i[3]*(s+o)+i[5],p=i[0]*t+i[2]*(s+o)+i[4],d=i[1]*t+i[3]*(s+o)+i[5],_={points:[r,a,n,c,h,u,p,d],closed:!0};this.axisAligned()&&(_.rect={x0:Math.min(r,h),y0:Math.min(a,u),x1:Math.max(r,h),y1:Math.max(a,u)}),this.path.push(_),this.path.push({points:[r,a],closed:!1})}arc(t,s,e,o,i,r=!1){if(![t,s,e,o,i].every(Number.isFinite))return;if(e<0)throw new DOMException("negative radius","IndexSizeError");let a=i-o;!r&&a>=x?a=x:r&&-a>=x?a=-x:r?a=-(((o-i)%x+x)%x):a=(a%x+x)%x;const n=this.current(),c=this.state.transform,h=t+e*Math.cos(o),u=s+e*Math.sin(o),p=!n||n.closed||n.points.length===2&&Math.abs(n.points[0]-(c[0]*h+c[2]*u+c[4]))<1e-6&&Math.abs(n.points[1]-(c[1]*h+c[3]*u+c[5]))<1e-6,d=Xt(e*Math.abs(c[0]),a);for(let g=0;g<=d;g++){const y=o+a*g/d;this.lineTo(t+e*Math.cos(y),s+e*Math.sin(y))}const _=this.current();Math.abs(a)>=x-1e-9&&p&&this.uniform()&&_&&(_.circle={x:c[0]*t+c[4],y:c[3]*s+c[5],r:e*Math.abs(c[0])})}curve(t,s){(!this.current()||this.current().closed)&&this.moveTo(t[0],t[1]);const e=this.current(),o=this.state.transform;if(!e||!this.axisAligned()||o[0]===0||o[3]===0)return this.unsupported();const i=[(e.points[e.points.length-2]-o[4])/o[0],(e.points[e.points.length-1]-o[5])/o[3],...t,...s];let r=0;for(let n=2;n<i.length;n+=2)r+=Math.hypot((i[n]-i[n-2])*o[0],(i[n+1]-i[n-1])*o[3]);const a=Math.max(4,Math.min(64,Math.ceil(r/3)));for(let n=1;n<=a;n++){const c=n/a,h=i.length===6?[(1-c)**2,2*c*(1-c),c*c]:[(1-c)**3,3*c*(1-c)**2,3*c*c*(1-c),c**3];let u=0,p=0;h.forEach((d,_)=>{u+=d*i[2*_],p+=d*i[2*_+1]}),this.lineTo(u,p)}}withPath(t,s){const e=this.path;this.path=[],t(),s(),this.path=e}onPath(t,s){if(!(t instanceof F)||t.unsupported)return this.unsupported();this.withPath(()=>{for(const[e,o]of t.calls)e==="moveTo"?this.moveTo(o[0],o[1]):e==="lineTo"?this.lineTo(o[0],o[1]):e==="closePath"?this.closePath():e==="rect"?this.rect(o[0],o[1],o[2],o[3]):e==="arc"?this.arc(o[0],o[1],o[2],o[3],o[4],!!o[5]):e==="quadraticCurveTo"?this.curve([o[0],o[1]],[o[2],o[3]]):e==="bezierCurveTo"&&this.curve([o[0],o[1],o[2],o[3]],[o[4],o[5]])},s)}baseColor(t){const s=this.solid;if(s&&s.style===t)return s.color;const e=S(b(t));return this.solid={style:t,color:e},e}alpha(){return Math.max(0,Math.min(1,this.state.globalAlpha))}solidColor(t){const s=this.baseColor(t),e=this.alpha();return[s[0]*e,s[1]*e,s[2]*e,s[3]*e]}paint(t){const s=this.alpha();if(typeof t=="string")return{kind:"solid",color:this.solidColor(t)};if(!(t instanceof Y))return null;if(t.stops.length===0)return{kind:"solid",color:[0,0,0,0]};if(t.stops.length>4)return null;const e=this.state.transform,o=t.x0===t.x1||t.y0===t.y1;if(!this.axisAligned()||!this.uniform()&&!o)return null;const i=[...t.stops].sort((r,a)=>r.offset-a.offset).map(r=>{const a=b(r.color);return{offset:r.offset,color:[a[0],a[1],a[2],a[3]*s]}});return{kind:"linear",x0:e[0]*t.x0+e[4],y0:e[3]*t.y0+e[5],x1:e[0]*t.x1+e[4],y1:e[3]*t.y1+e[5],stops:i}}plain(){const t=this.state;return t.globalCompositeOperation!=="source-over"||t.filter!=="none"?!1:t.shadowBlur===0&&t.shadowOffsetX===0&&t.shadowOffsetY===0?!0:!(b(t.shadowColor)[3]>0)}fill(t="nonzero"){if(!this.plain())return this.unsupported();const s=this.paint(this.state.fillStyle);if(!s)return this.unsupported();const e=this.path.filter(lt);if(e.length===0||s.kind==="solid"&&s.color[3]===0)return;if(e.length>1&&it(e.map(a=>G(a.points)))){const a=s.kind==="solid"&&s.color[3]>=1,n=Math.sign(Q(e[0].points));if(!a||t!=="nonzero"||e.some(c=>Math.sign(Q(c.points))!==n))return this.unsupported()}if(s.kind==="solid"&&e.every(a=>a.rect))return this.fillRects(e,s.color);if(s.kind==="solid"&&e.every(a=>a.circle)){const a=[];for(const n of e)a.push(n.circle.x,n.circle.y,n.circle.r,...s.color);this.commands.push({type:"circles",values:a,clip:this.state.clip});return}const o=[];for(const a of e){const n=Lt(a.points);if(!n)return this.unsupported();for(const c of n)o.push(c)}const i=G(e.flatMap(a=>a.points)),r=ot({x0:Math.floor(i.x0),y0:Math.floor(i.y0),x1:Math.ceil(i.x1),y1:Math.ceil(i.y1)},this.state.clip);o.length>0&&!vt(r)&&this.commands.push({type:"fill",spans:o,bounds:r,paint:s,clip:this.state.clip})}fillRects(t,s){for(const e of t)this.pushRect(e.rect,s)}pushRect(t,s,e=1){const o=this.state.clip,i=Math.max(t.x0,o.x0),r=Math.max(t.y0,o.y0),a=Math.min(t.x1,o.x1),n=Math.min(t.y1,o.y1);if(!(a>i&&n>r))return;const c=this.commands[this.commands.length-1],h=c&&c.type==="rects"&&this.commands.length>this.stepStart?c.values:null,u=s[0]*e,p=s[1]*e,d=s[2]*e,_=s[3]*e;h?h.push(i,r,a,n,u,p,d,_):this.commands.push({type:"rects",values:[i,r,a,n,u,p,d,_]})}fillRect(t,s,e,o){const i=this.state.fillStyle;if(typeof i!="string"||!this.axisAligned()||!this.plain())return this.withPath(()=>this.rect(t,s,e,o),()=>this.fill());if(!(Number.isFinite(t)&&Number.isFinite(s)&&Number.isFinite(e)&&Number.isFinite(o)))return;const r=this.baseColor(i),a=this.alpha();if(r[3]*a===0)return;const n=this.state.transform,c=n[0]*t+n[4],h=n[0]*(t+e)+n[4],u=n[3]*s+n[5],p=n[3]*(s+o)+n[5];this.pushRect({x0:Math.min(c,h),y0:Math.min(u,p),x1:Math.max(c,h),y1:Math.max(u,p)},r,a)}stroke(){if(!this.plain())return this.unsupported();const t=this.paint(this.state.strokeStyle);if(!t||t.kind!=="solid"||!this.uniform())return this.unsupported();if(t.color[3]===0)return;const s=this.state,e=Math.abs(s.transform[0]),o=s.lineWidth*e,i=this.path.filter(n=>n.points.length>=4&&(s.lineCap!=="butt"||n.points.some((c,h)=>c!==n.points[h%2])));if(i.length===0)return;const r=this.dash(i,e);if(r===void 0||!this.drawsAlike(i,o,t.color[3]))return this.unsupported();const a=s.lineCap==="round"?1:s.lineCap==="square"?2:0;this.commands.push({type:"stroke",points:qt(i),color:t.color,width:o,cap:a,dash:r,clip:s.clip})}dash(t,s){const e=this.state;if(e.lineDash.length===0)return null;if(e.lineDash.length>4||e.lineDashOffset!==0||e.lineCap!=="butt"||t.some(i=>i.closed||i.points.length!==4))return;const o=e.lineDash.map(i=>i*s);for(;o.length<4;)o.push(...o.slice(0,4-o.length));return o}drawsAlike(t,s,e){const o=this.state,i=s/2;if(s>1&&t.some(a=>Ht(a,i,o.lineJoin,o.miterLimit)))return!1;const r=i+(o.lineCap==="butt"?0:i);return!(t.length>1&&it(t.map(a=>G(a.points,r)))||e<1&&t.some(a=>Kt(a,s)))}clip(){const t=this.path.filter(lt);if(t.length!==1||!t[0].rect)return this.unsupported();this.state.clip=ot(this.state.clip,t[0].rect)}text(t,s,e,o,i){const r=t?this.state.strokeStyle:this.state.fillStyle;if(!this.takesText||typeof r!="string"||!this.plain())return this.unsupported();this.texts.push({stroke:t,text:String(s),x:e,y:o,maxWidth:i,state:this.copyState()})}measureText(t){const s=this.measure;if(!s)return{width:String(t).length*6};const e=s.font;s.font=this.state.font;const o=s.measureText(t);return s.font=e,o}methods(){const t=()=>this.state,s=Object.create(null);return Object.assign(s,{save:()=>{this.stack.push(this.copyState())},restore:()=>{const e=this.stack.pop();e&&(this.state=e)},beginPath:()=>{this.path=[]},moveTo:(e,o)=>this.moveTo(e,o),lineTo:(e,o)=>this.lineTo(e,o),closePath:()=>this.closePath(),rect:(e,o,i,r)=>this.rect(e,o,i,r),arc:(e,o,i,r,a,n)=>this.arc(e,o,i,r,a,n),quadraticCurveTo:(e,o,i,r)=>this.curve([e,o],[i,r]),bezierCurveTo:(e,o,i,r,a,n)=>this.curve([e,o,i,r],[a,n]),fill:(e,o)=>typeof e=="object"?this.onPath(e,()=>this.fill(o)):this.fill(e),stroke:e=>e?this.onPath(e,()=>this.stroke()):this.stroke(),clip:e=>typeof e=="object"?this.onPath(e,()=>this.clip()):this.clip(),fillRect:(e,o,i,r)=>this.fillRect(e,o,i,r),strokeRect:(e,o,i,r)=>this.withPath(()=>this.rect(e,o,i,r),()=>this.stroke()),fillText:(e,o,i,r)=>this.text(!1,e,o,i,r),strokeText:(e,o,i,r)=>this.text(!0,e,o,i,r),measureText:e=>this.measureText(e),setLineDash:e=>{e.every(o=>Number.isFinite(o)&&o>=0)&&(t().lineDash=e.length%2?[...e,...e]:[...e])},getLineDash:()=>[...t().lineDash],translate:(e,o)=>this.multiply(1,0,0,1,e,o),scale:(e,o)=>this.multiply(e,0,0,o,0,0),rotate:e=>this.multiply(Math.cos(e),Math.sin(e),-Math.sin(e),Math.cos(e),0,0),transform:(e,o,i,r,a,n)=>this.multiply(e,o,i,r,a,n),setTransform:(e,o,i,r,a,n)=>typeof e=="number"?this.setMatrix([e,o??0,i??0,r??1,a??0,n??0]):this.unsupported(),resetTransform:()=>this.setMatrix([1,0,0,1,0,0]),getTransform:()=>{const[e,o,i,r,a,n]=t().transform;return{a:e,b:o,c:i,d:r,e:a,f:n,m11:e,m12:o,m21:i,m22:r,m41:a,m42:n,is2D:!0,isIdentity:e===1&&o===0&&i===0&&r===1&&a===0&&n===0}},createLinearGradient:(e,o,i,r)=>new Y(e,o,i,r)}),s}proxy(){const t=this.methods();return new Proxy({},{get:(s,e)=>{var o;if(typeof e=="string"){if(e in t)return t[e];if(nt.has(e))return this.state[e];if(rt.has(e))return this.state.textExtras[e];if(e==="canvas")return(o=this.measure)==null?void 0:o.canvas;if(!at.has(e))return this.unsupported(),()=>{}}},set:(s,e,o)=>(typeof e=="string"&&this.setProp(e,o),!0)})}setProp(t,s){const e=this.state;t==="lineWidth"||t==="miterLimit"?typeof s=="number"&&Number.isFinite(s)&&s>0&&(e[t]=s):t==="globalAlpha"?typeof s=="number"&&Number.isFinite(s)&&s>=0&&s<=1&&(e.globalAlpha=s):t==="fillStyle"||t==="strokeStyle"?s instanceof Y?e[t]=s:typeof s=="string"?ft(s)&&(e[t]=s):this.unsupported():nt.has(t)?e[t]=s:rt.has(t)?this.state.textExtras[t]=s:at.has(t)||this.unsupported()}}function Qt(l,t){for(const s of t){const e=s.state;if(vt(e.clip))continue;l.save(),l.setTransform(1,0,0,1,0,0),Number.isFinite(e.clip.x1)&&Number.isFinite(e.clip.y1)&&(l.beginPath(),l.rect(e.clip.x0,e.clip.y0,e.clip.x1-e.clip.x0,e.clip.y1-e.clip.y0),l.clip());const[o,i,r,a,n,c]=e.transform;l.setTransform(o,i,r,a,n,c),l.font=e.font,l.textAlign=e.textAlign,l.textBaseline=e.textBaseline,l.direction=e.direction,l.globalAlpha=e.globalAlpha,Object.assign(l,e.textExtras),s.stroke?(l.strokeStyle=e.strokeStyle,l.lineWidth=e.lineWidth,l.strokeText(s.text,s.x,s.y,s.maxWidth)):(l.fillStyle=e.fillStyle,l.fillText(s.text,s.x,s.y,s.maxWidth)),l.restore()}}function Zt(l,t){return new Jt(l,t)}const D=`#version 300 es
precision highp float;
uniform vec2 u_canvas;
uniform float u_dpr;
uniform int u_log;
uniform int u_invert;
uniform float u_yA;
uniform float u_yB;
uniform float u_logOffset;
uniform float u_min;
uniform float u_logFloor;
uniform float u_logK;
uniform float u_top;
uniform float u_bottom;
out vec4 v_color;

// A price (relative to the base price) to a CSS-pixel y, as priceToYMapper
// does; mappedY in yMapping.ts is the same steps in TypeScript.
float cssY(float rel) {
  if (u_log == 1) {
    float v = log(max(1.0 + (rel + u_logOffset) / u_min, u_logFloor)) * u_logK;
    return u_invert == 1 ? u_top + v : u_bottom - v;
  }
  return u_yA + rel * u_yB;
}

float snap(float v) { return floor(v + ${Rt.toFixed(4)}); }

vec4 toClip(vec2 dev) {
  return vec4(dev.x / u_canvas.x * 2.0 - 1.0, 1.0 - dev.y / u_canvas.y * 2.0, 0.0, 1.0);
}

// The corners of a quad as two triangles.
vec2 corner(int k) {
  if (k == 0) return vec2(0.0, 0.0);
  if (k == 1 || k == 4) return vec2(1.0, 0.0);
  if (k == 2 || k == 3) return vec2(0.0, 1.0);
  return vec2(1.0, 1.0);
}

// Nothing to draw: every vertex at one point off the canvas.
const vec4 NOWHERE = vec4(-2.0, -2.0, 0.0, 1.0);
`,te=`${D}
in vec4 a_ohlc;
in vec2 a_vd;
uniform float u_x0;
uniform float u_unit;
uniform float u_wick;
uniform float u_body;
uniform vec4 u_upBody;
uniform vec4 u_downBody;
uniform vec4 u_upWick;
uniform vec4 u_downWick;

void main() {
  int vid = gl_VertexID % 12;
  vec2 cr = corner(vid % 6);
  bool up = a_vd.y > 0.5;
  float cx = (u_x0 + float(gl_InstanceID) * u_unit) * u_dpr;
  float wickLeft = snap(cx - u_wick * 0.5);
  float left;
  float width;
  float top;
  float height;
  if (vid < 6) {
    float h = snap(cssY(a_ohlc.y) * u_dpr);
    float l = snap(cssY(a_ohlc.z) * u_dpr);
    left = wickLeft;
    width = u_wick;
    top = min(h, l);
    height = max(abs(l - h), 1.0);
    v_color = up ? u_upWick : u_downWick;
  } else {
    float o = snap(cssY(a_ohlc.x) * u_dpr);
    float c = snap(cssY(a_ohlc.w) * u_dpr);
    left = wickLeft - (u_body - u_wick) * 0.5;
    width = u_body;
    top = min(o, c);
    height = max(abs(c - o), u_wick);
    v_color = up ? u_upBody : u_downBody;
  }
  gl_Position = toClip(vec2(left + cr.x * width, top + cr.y * height));
}
`,ee=`${D}
in vec4 a_ohlc;
in vec2 a_vd;
uniform float u_x0;
uniform float u_unit;
uniform float u_wick;
uniform float u_body;
uniform float u_volBottom;
uniform float u_volScale;
uniform vec4 u_volUp;
uniform vec4 u_volDown;

void main() {
  vec2 cr = corner(gl_VertexID % 6);
  float cx = (u_x0 + float(gl_InstanceID) * u_unit) * u_dpr;
  float left = snap(cx - u_wick * 0.5) - (u_body - u_wick) * 0.5;
  float bottom = snap(u_volBottom * u_dpr);
  float top = snap((u_volBottom - a_vd.x * u_volScale) * u_dpr);
  if (bottom - top < 1.0) { gl_Position = NOWHERE; v_color = vec4(0.0); return; }
  v_color = a_vd.y > 0.5 ? u_volUp : u_volDown;
  gl_Position = toClip(vec2(left + cr.x * u_body, top + cr.y * (bottom - top)));
}
`,se=`${D}
in vec4 a_col;
in float a_up;
uniform vec4 u_upBody;
uniform vec4 u_downBody;

void main() {
  vec2 cr = corner(gl_VertexID % 6);
  float left = snap(a_col.x * u_dpr);
  float width = max(1.0, snap((a_col.x + 1.0) * u_dpr) - left);
  float t = snap(cssY(a_col.y) * u_dpr);
  float b = snap(cssY(a_col.z) * u_dpr);
  v_color = a_up > 0.5 ? u_upBody : u_downBody;
  gl_Position = toClip(vec2(left + cr.x * width, min(t, b) + cr.y * max(abs(b - t), 1.0)));
}
`,oe=`${D}
in vec4 a_col;
in float a_up;
uniform float u_volBottom;
uniform float u_volScale;
uniform vec4 u_volUp;
uniform vec4 u_volDown;

void main() {
  vec2 cr = corner(gl_VertexID % 6);
  float left = snap(a_col.x * u_dpr);
  float width = max(1.0, snap((a_col.x + 1.0) * u_dpr) - left);
  float bottom = snap(u_volBottom * u_dpr);
  float top = snap((u_volBottom - a_col.w * u_volScale) * u_dpr);
  if (bottom - top < 1.0) { gl_Position = NOWHERE; v_color = vec4(0.0); return; }
  v_color = a_up > 0.5 ? u_volUp : u_volDown;
  gl_Position = toClip(vec2(left + cr.x * width, top + cr.y * (bottom - top)));
}
`,ie=`${D}
in vec4 a_rect;
in vec4 a_color;
in vec2 a_dash;
flat out vec4 v_rect;
flat out vec2 v_dash;

void main() {
  vec2 cr = corner(gl_VertexID % 6);
  v_rect = a_rect * u_dpr;
  v_dash = a_dash * u_dpr;
  v_color = a_color;
  gl_Position = toClip(mix(floor(v_rect.xy), ceil(v_rect.zw), cr));
}
`,ne=`#version 300 es
precision highp float;
uniform vec2 u_canvas;
uniform int u_union;
in vec4 v_color;
flat in vec4 v_rect;
flat in vec2 v_dash;
out vec4 outColor;

// The share of rows [y, y + 1] inside the rectangle and, dashed, on a dash.
float rows(float y) {
  float lo = max(y, v_rect.y);
  float hi = min(y + 1.0, v_rect.w);
  if (hi <= lo) return 0.0;
  if (v_dash.x <= 0.0) return hi - lo;
  // A dash period is longer than a device pixel, so the row meets the dash
  // of the period it starts in and the next (a third to spare).
  float period = v_dash.x + v_dash.y;
  float first = v_rect.y + floor((lo - v_rect.y) / period) * period;
  float on = 0.0;
  for (int i = 0; i < 3; i++) {
    float start = first + float(i) * period;
    on += max(0.0, min(hi, start + v_dash.x) - max(lo, start));
  }
  return on;
}

void main() {
  // This pixel's top-left corner in device pixels, y down.
  vec2 p = vec2(floor(gl_FragCoord.x), u_canvas.y - floor(gl_FragCoord.y) - 1.0);
  float coverage = clamp(min(p.x + 1.0, v_rect.z) - max(p.x, v_rect.x), 0.0, 1.0) * rows(p.y);
  outColor = u_union == 1 ? vec4(v_color.rgb * coverage, coverage) : v_color * coverage;
}
`,O=`#version 300 es
precision highp float;
uniform vec2 u_canvas;
uniform vec4 u_clip;
in vec4 v_color;
out vec4 outColor;

void main() {
  vec2 p = vec2(floor(gl_FragCoord.x), u_canvas.y - floor(gl_FragCoord.y) - 1.0);
  vec2 c = clamp(min(p + 1.0, u_clip.zw) - max(p, u_clip.xy), 0.0, 1.0);
  outColor = v_color * (c.x * c.y);
}
`,E=C*4,B=5,ct=B*4,W=10,A=W*4,U=()=>{},M=["a_ohlc","a_vd","a_col","a_up","a_rect","a_color","a_dash"];class mt{constructor(t,s){f(this,"label");f(this,"gl");f(this,"kit");f(this,"drawer");f(this,"candleBars");f(this,"volumeBars");f(this,"candleColumns");f(this,"volumeColumns");f(this,"rects");f(this,"seriesBuffer");f(this,"columnBuffer");f(this,"rectBuffer");f(this,"uploads",new J);f(this,"gpuFloats",0);f(this,"columns",new Float32Array(4096*B));f(this,"rectValues",new Float32Array(64*W));f(this,"clip",[0,0,0,0]);f(this,"lost",!1);f(this,"lostCallback",null);f(this,"restoredCallback",null);f(this,"release",U);f(this,"handleLost",t=>{var s;t.preventDefault(),!this.lost&&(this.lost=!0,this.release(),this.release=U,(s=this.lostCallback)==null||s.call(this))});f(this,"handleRestored",()=>{var s;if(!this.lost||this.gl.isContextLost())return;const t=At();if(!t){T(this.gl);return}try{this.build()}catch(e){t(),j(e),T(this.gl);return}this.release=t,this.lost=!1,(s=this.restoredCallback)==null||s.call(this)});this.canvas=t,this.gl=s,this.kit=new It(s),this.label=re(s),this.build(),t.addEventListener("webglcontextlost",this.handleLost),t.addEventListener("webglcontextrestored",this.handleRestored)}static create(t={}){if(typeof document>"u")return null;const s=document.createElement("canvas");let e=null;try{e=s.getContext("webgl2",{alpha:!0,premultipliedAlpha:!0,antialias:!1,depth:!1,stencil:!1,preserveDrawingBuffer:!1,failIfMajorPerformanceCaveat:t.failIfMajorPerformanceCaveat??!1})}catch(o){return j(o),null}if(!e)return null;try{const o=new mt(s,e);return o.release=t.release??U,o}catch(o){return j(o),T(e),null}}build(){const t=this.kit;Object.assign(this,{candleBars:t.program(te,O,M),volumeBars:t.program(ee,O,M),candleColumns:t.program(se,O,M),volumeColumns:t.program(oe,O,M),rects:t.program(ie,ne,M),seriesBuffer:t.buffer(),columnBuffer:t.buffer(),rectBuffer:t.buffer(),drawer:new Yt(t),uploads:new J,gpuFloats:0})}onRestored(t){this.restoredCallback=t}onLost(t){this.lostCallback=t,(this.lost||this.gl.isContextLost())&&(this.lost=!0,queueMicrotask(()=>{this.lostCallback===t&&t()}))}recorder(t,s){return Zt(t,s)}render(t){const s=this.gl;if(this.lost||s.isContextLost())return{series:!1,volume:!1,background:!1,recorded:!1,under:!1};const e=ht(t.recorded)?t.recorded:null,o=ht(t.under)?t.under:null,i={series:t.candles,volume:t.volume!==null,background:t.background!==null,recorded:e!==null,under:o!==null};return s.viewport(0,0,this.canvas.width,this.canvas.height),s.disable(s.SCISSOR_TEST),s.clearColor(0,0,0,0),s.clear(s.COLOR_BUFFER_BIT),s.enable(s.BLEND),t.background&&this.drawBackground(t,t.background),o&&this.drawRecorded(t,o),this.drawSeries(t),e&&this.drawRecorded(t,e),i}drawSeries(t){const s=this.gl,{data:e,viewport:o,dpr:i}=t;if(e.length===0||!t.candles&&!t.volume)return;this.syncSeries(t);const r=Math.max(0,o.visibleRange.from),a=Math.min(o.visibleRange.to,e.length-1);if(a<r)return;const{chartRect:n}=o;this.clip=[n.x*i,n.y*i,(n.x+n.width)*i,(n.y+n.height)*i];const c=Math.floor(this.clip[0]),h=Math.floor(this.clip[1]),u=Math.ceil(this.clip[2])-c,p=Math.ceil(this.clip[3])-h;s.enable(s.SCISSOR_TEST),s.scissor(c,this.canvas.height-h-p,Math.max(0,u),Math.max(0,p)),s.blendFunc(s.ONE,s.ONE_MINUS_SRC_ALPHA);const d=Ct(o),_=d?this.buildColumns(t,r,a):0;t.volume&&this.drawVolume(t,r,a,d,_);const{min:g,max:y}=o.priceRange;t.candles&&y-g!==0&&this.drawCandles(t,r,a,d,_),s.disable(s.SCISSOR_TEST)}drawRecorded(t,s){s.commands.length!==0&&this.drawer.draw(s.commands,this.canvas.width,this.canvas.height,(e,o)=>this.drawRecordedRects(t,e,o))}drawRecordedRects(t,s,e){const o=this.gl,i=this.use(this.rects,t);this.kit.float(i,"u_dpr",1),this.kit.int(i,"u_union",0),o.bindBuffer(o.ARRAY_BUFFER,this.rectBuffer),o.bufferData(o.ARRAY_BUFFER,s,o.STREAM_DRAW),this.bindRects(i,0),o.drawArraysInstanced(o.TRIANGLES,0,6,e)}destroy(){this.canvas.removeEventListener("webglcontextlost",this.handleLost),this.canvas.removeEventListener("webglcontextrestored",this.handleRestored),this.lostCallback=null,this.restoredCallback=null,this.release(),this.release=U;const t=this.gl;if(t.isContextLost())this.canvas.addEventListener("webglcontextrestored",()=>T(t),{once:!0});else{for(const s of[this.candleBars,this.volumeBars,this.candleColumns,this.volumeColumns,this.rects])this.kit.deleteProgram(s);this.drawer.destroy(),t.deleteBuffer(this.seriesBuffer),t.deleteBuffer(this.columnBuffer),t.deleteBuffer(this.rectBuffer),T(t)}this.canvas.remove()}syncSeries(t){const s=this.gl,e=this.uploads.sync(t.data),o=this.uploads.values;s.bindBuffer(s.ARRAY_BUFFER,this.seriesBuffer),e.full||o.length!==this.gpuFloats?(s.bufferData(s.ARRAY_BUFFER,o,s.DYNAMIC_DRAW),this.gpuFloats=o.length):e.to>e.from&&s.bufferSubData(s.ARRAY_BUFFER,e.from*E,o,e.from*C,(e.to-e.from)*C)}buildColumns(t,s,e){const{viewport:o,data:i}=t,r=o.barWidth+o.barSpacing,a=-o.offset+o.chartRect.x+o.barWidth/2,n=this.uploads.base;let c=0;kt(i,s,e,u=>u*r+a,u=>{if((c+1)*B>this.columns.length){const d=new Float32Array(this.columns.length*2);d.set(this.columns),this.columns=d}const p=c*B;this.columns[p]=u.x,this.columns[p+1]=u.high-n,this.columns[p+2]=u.low-n,this.columns[p+3]=u.volume,this.columns[p+4]=u.close>=u.open?1:0,c++});const h=this.gl;return h.bindBuffer(h.ARRAY_BUFFER,this.columnBuffer),h.bufferData(h.ARRAY_BUFFER,this.columns.subarray(0,c*B),h.STREAM_DRAW),c}drawBackground(t,s){const{viewport:e,theme:o}=t,i=Et(o),r=s.grid?Mt(e,s.marks):{horizontal:[],vertical:[]},a={horizontal:i.horizontal.visible?r.horizontal:[],vertical:i.vertical.visible?r.vertical:[]},n=a.horizontal.length+a.vertical.length,c=n+s.rects.length;if(c===0)return;this.rectValues.length<c*W&&(this.rectValues=new Float32Array(c*W*2));const h=this.rectValues;let u=0;const p=(m,q,gt,xt,bt,yt,P)=>{h[u++]=m,h[u++]=q,h[u++]=gt,h[u++]=xt;for(let z=0;z<4;z++)h[u++]=bt[z]*yt;h[u++]=P?P[0]:0,h[u++]=P?P[1]:0},d=S(b(i.horizontal.visible?i.horizontal.color:i.vertical.color)),{chartRect:_}=e;for(const m of a.horizontal)p(_.x,m-.5,_.x+_.width,m+.5,d,1);for(const m of a.vertical)p(m-.5,_.y,m+.5,_.y+_.height,d,1);let g="",y=d;for(const m of s.rects)m.color!==g&&(g=m.color,y=S(b(m.color))),p(m.x,m.y,m.x+m.width,m.y+m.height,y,m.alpha,m.dash);const v=this.gl,w=this.use(this.rects,t);v.bindBuffer(v.ARRAY_BUFFER,this.rectBuffer),v.bufferData(v.ARRAY_BUFFER,h.subarray(0,u),v.STREAM_DRAW),n>0&&(v.uniform1i(this.loc(w,"u_union"),1),v.blendColor(0,0,0,d[3]),v.blendFuncSeparate(v.ONE,v.ONE_MINUS_SRC_ALPHA,v.CONSTANT_ALPHA,v.ONE_MINUS_SRC_ALPHA),this.bindRects(w,0),v.drawArraysInstanced(v.TRIANGLES,0,6,n)),s.rects.length>0&&(v.uniform1i(this.loc(w,"u_union"),0),v.blendFunc(v.ONE,v.ONE_MINUS_SRC_ALPHA),this.bindRects(w,n),v.drawArraysInstanced(v.TRIANGLES,0,6,s.rects.length))}drawCandles(t,s,e,o,i){const{theme:r,viewport:a,dpr:n}=t,c=S(b(r.candleUp)),h=S(b(r.candleDown));if(o){const p=this.use(this.candleColumns,t);this.vec4(p,"u_upBody",c),this.vec4(p,"u_downBody",h),this.bindColumns(p),this.gl.drawArraysInstanced(this.gl.TRIANGLES,0,6,i);return}const u=this.use(this.candleBars,t);this.barUniforms(u,a,s,n),this.vec4(u,"u_upBody",c),this.vec4(u,"u_downBody",h),this.vec4(u,"u_upWick",S(b(r.candleUpWick))),this.vec4(u,"u_downWick",S(b(r.candleDownWick))),this.bindBars(u,s),this.gl.drawArraysInstanced(this.gl.TRIANGLES,0,12,e-s+1)}drawVolume(t,s,e,o,i){var _;const{data:r,viewport:a,theme:n,dpr:c}=t;let h=0;for(let g=s;g<=e;g++)r[g].volume>h&&(h=r[g].volume);if(h===0)return;const{chartRect:u}=a,p=Bt(n),d=this.use(o?this.volumeColumns:this.volumeBars,t);if(this.float(d,"u_volBottom",u.y+u.height),this.float(d,"u_volScale",u.height*(((_=t.volume)==null?void 0:_.heightRatio)??.15)/h),this.vec4(d,"u_volUp",S(b(p.up))),this.vec4(d,"u_volDown",S(b(p.down))),o){this.bindColumns(d),this.gl.drawArraysInstanced(this.gl.TRIANGLES,0,6,i);return}this.barUniforms(d,a,s,c),this.bindBars(d,s),this.gl.drawArraysInstanced(this.gl.TRIANGLES,0,6,e-s+1)}barUniforms(t,s,e,o){const i=s.barWidth+s.barSpacing,r=-s.offset+s.chartRect.x+s.barWidth/2,{body:a,wick:n}=Tt(s.barWidth,o);this.float(t,"u_x0",e*i+r),this.float(t,"u_unit",i),this.float(t,"u_wick",n),this.float(t,"u_body",a)}use(t,s){const e=this.gl;this.kit.use(t),e.uniform2f(this.loc(t,"u_canvas"),this.canvas.width,this.canvas.height),this.vec4(t,"u_clip",this.clip),this.float(t,"u_dpr",s.dpr);const o=Pt(s.viewport,this.uploads.base);return e.uniform1i(this.loc(t,"u_log"),o.log),e.uniform1i(this.loc(t,"u_invert"),o.invert),this.float(t,"u_yA",o.yA),this.float(t,"u_yB",o.yB),this.float(t,"u_logOffset",o.logOffset),this.float(t,"u_min",o.min),this.float(t,"u_logFloor",o.logFloor),this.float(t,"u_logK",o.logK),this.float(t,"u_top",o.top),this.float(t,"u_bottom",o.bottom),t}bindBars(t,s){const e=this.gl;e.bindBuffer(e.ARRAY_BUFFER,this.seriesBuffer),this.attrib(t,"a_ohlc",4,E,s*E),this.attrib(t,"a_vd",2,E,s*E+16)}bindRects(t,s){this.attrib(t,"a_rect",4,A,s*A),this.attrib(t,"a_color",4,A,s*A+16),this.attrib(t,"a_dash",2,A,s*A+32)}bindColumns(t){const s=this.gl;s.bindBuffer(s.ARRAY_BUFFER,this.columnBuffer),this.attrib(t,"a_col",4,ct,0),this.attrib(t,"a_up",1,ct,16)}attrib(t,s,e,o,i){this.kit.attrib(t,s,e,o,i)}float(t,s,e){this.kit.float(t,s,e)}vec4(t,s,e){this.kit.vec4(t,s,e)}loc(t,s){return this.kit.loc(t,s)}}function ht(l){return typeof l=="object"&&l!==null&&Array.isArray(l.commands)}function re(l){const t=String(l.getParameter(l.RENDERER));if(t&&t!=="WebKit WebGL")return t;const s=l.getExtension("WEBGL_debug_renderer_info");return s?String(l.getParameter(s.UNMASKED_RENDERER_WEBGL)):t}function T(l){var t;(t=l.getExtension("WEBGL_lose_context"))==null||t.loseContext()}function j(l){console.warn("TradeCanvas: WebGL renderer unavailable, drawing with Canvas 2D.",l)}export{mt as WebGLSeriesRenderer};
