import"./Bzak7iHL.js";import"./DQttDCvw.js";import{p as V,_ as $,$ as j,a as y,s as a,a0 as z,c as t,r as n,a1 as c,t as E,b as J,f as _}from"./vnnAQmBw.js";import{h as R}from"./Di_Vksbt.js";import{s as r}from"./BbGUZXP3.js";import{i as U}from"./w5vomPQw.js";import{u as F}from"./BPYnHL8L.js";var H=_('<meta name="description" content="Cài đặt TradeCanvas và hiển thị biểu đồ giao dịch canvas đầu tiên trong chưa đầy một phút."/>'),Q=_(`<h1>Bắt đầu</h1> <p>Cài đặt TradeCanvas và hiển thị một biểu đồ trong chưa đầy một phút.</p> <h2>Cài đặt</h2> <p>Dùng trình quản lý gói nào bạn thích:</p> <pre><code>npm install @tradecanvas/chart
# or
pnpm add @tradecanvas/chart
# or
yarn add @tradecanvas/chart</code></pre> <h2>Widget dùng ngay</h2> <p><code>ChartWidget</code> là cách nhanh nhất để có một biểu đồ chạy được. Nó dựng toàn bộ
  giao diện giao dịch bên trong bất kỳ phần tử chứa nào — thanh công cụ, thanh bên công cụ vẽ,
  hộp thoại cài đặt, thanh trạng thái — mà không phụ thuộc vào framework nào.</p> <pre><code></code></pre> <p>Ngay khi cài xong, widget đã hỗ trợ đầy đủ các thao tác quen thuộc của trader chuyên nghiệp:
  kéo qua nến cuối vào vùng tương lai còn trống, kéo trục giá/thời gian để co giãn, <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+kéo để chọn nhiều hình vẽ, <kbd>Shift</kbd>+kéo để đo, <kbd>Alt</kbd>+bấm để ghim chú thích, <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>K</kbd> để mở bảng lệnh, <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>P</kbd> để tìm mã,
  và <kbd>?</kbd> để xem toàn bộ bảng phím tắt.</p> <h2>Chart headless</h2> <p>Để toàn quyền kiểm soát giao diện xung quanh, hãy dùng trực tiếp lớp <code>Chart</code> ở tầng thấp hơn. Bạn tự làm thanh công cụ, mà vẫn giữ đủ mọi tính năng:</p> <pre><code></code></pre> <h2>Wrapper cho framework</h2> <p>Wrapper cho React, Vue và Svelte có trong mục <a>framework</a>.</p> <h2 id="ai">Dùng với coding agent</h2> <p>Coding agent có thể học TradeCanvas thay vì đoán. <strong>Agent skill</strong> dạy API qua các ví dụ được kiểm kiểu; trong Claude Code, cài bằng hai lệnh:</p> <pre><code></code></pre> <p><strong>MCP server</strong> <code>@tradecanvas/mcp</code> trả lời từ chính catalog của thư viện: id của chỉ báo, tham số và key của từng đường; công cụ vẽ và số điểm mỗi công cụ cần; tùy chọn của <code>ChartWidget</code>, <code>Chart</code> và <code>ChartWidgetGrid</code>; công tắc tính năng và style key. Công cụ <code>validate_options</code> kiểm tra một object tùy chọn trước khi dùng và chỉ ra tùy chọn đúng. Trong Claude Code:</p> <pre><code></code></pre> <p>Cursor, Claude Desktop và hầu hết các client khác nhận cùng lệnh đó trong phần cài đặt MCP:</p> <pre><code></code></pre> <p>Trên Windows (không qua WSL), npx chạy qua <code>cmd</code>: <code>claude mcp add tradecanvas -- cmd /c npx -y @tradecanvas/mcp</code>, hoặc trong phần cài đặt <code>"command": "cmd", "args": ["/c", "npx", "-y", "@tradecanvas/mcp"]</code>. Trong Git Bash, nơi Claude Code chạy các lệnh <code>!</code> trên Windows, hãy viết <code>//c</code>: Git Bash đổi <code>/c</code> thành một đường dẫn.</p> <p>Không dùng cả hai thì <a href="https://tradecanvas.dev/llms.txt">llms.txt</a> và <a href="https://tradecanvas.dev/llms-full.txt">llms-full.txt</a> gom tài liệu vào một file cho trợ lý AI.</p> <h2>Bước tiếp theo</h2> <ul><li><a>Tham chiếu API</a> — toàn bộ API của <code>Chart</code> và <code>ChartWidget</code></li> <li><a>Loại biểu đồ</a> — 18 loại biểu đồ có sẵn</li> <li><a>Chỉ báo</a> — danh mục 134 chỉ báo</li> <li><a>Thời gian thực &amp; phát lại</a> — adapter dữ liệu stream và chế độ phát lại</li> <li><a>Phân tích</a> — bộ backtest chiến lược và chỉ số rủi ro</li></ul>`,1);function ca(x,w){V(w,!1);const{href:e}=F();U();var k=Q();R("svfz49",u=>{var b=H();$(()=>{j.title="Bắt đầu — Tài liệu TradeCanvas"}),y(u,b)});var d=a(z(k),14),T=t(d);T.textContent=`import { ChartWidget } from '@tradecanvas/chart/widget'
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
})`,n(d);var o=a(d,8),W=t(o);W.textContent=`import { Chart } from '@tradecanvas/chart'

const chart = new Chart(host, {
  chartType: 'candlestick',
  theme: 'dark',
})

chart.setData(bars)
chart.addIndicator('sma', { period: 20 })`,n(o);var h=a(o,4),B=a(t(h));c(),n(h);var i=a(h,6),q=t(i);q.textContent=`/plugin marketplace add bonguynvan/tradecanvas
/plugin install tradecanvas@tradecanvas`,n(i);var p=a(i,4),A=t(p);A.textContent="claude mcp add tradecanvas -- npx -y @tradecanvas/mcp",n(p);var s=a(p,4),I=t(s);I.textContent=`{
  "mcpServers": {
    "tradecanvas": { "command": "npx", "args": ["-y", "@tradecanvas/mcp"] }
  }
}`,n(s);var C=a(s,8),m=t(C),P=t(m);c(4),n(m);var l=a(m,2),S=t(l);c(),n(l);var g=a(l,2),D=t(g);c(),n(g);var v=a(g,2),G=t(v);c(),n(v);var f=a(v,2),L=t(f);c(),n(f),n(C),E((u,b,N,K,M,O)=>{r(B,"href",u),r(P,"href",b),r(S,"href",N),r(D,"href",K),r(G,"href",M),r(L,"href",O)},[()=>e("/docs/frameworks"),()=>e("/docs/api"),()=>e("/docs/chart-types"),()=>e("/docs/indicators"),()=>e("/docs/realtime"),()=>e("/docs/analytics")]),y(x,k),J()}export{ca as default};
