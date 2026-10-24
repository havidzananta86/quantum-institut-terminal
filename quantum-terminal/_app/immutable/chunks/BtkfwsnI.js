import"./Bzak7iHL.js";import"./DQttDCvw.js";import{p as kn,t as _,_ as yn,$ as _n,a as u,s as c,a0 as fn,c as t,r as n,b as Cn,f as b,g as e,u as Y}from"./vnnAQmBw.js";import{s as a}from"./BPRzW5Y5.js";import{i as U}from"./CaEBpJzl.js";import{e as nn}from"./CqWi4pek.js";import{h as In}from"./Di_Vksbt.js";import{s as xn}from"./BbGUZXP3.js";import{i as Tn}from"./w5vomPQw.js";import{c as f}from"./DM_frcBA.js";var wn=b('<meta name="description"/>'),Sn=b("<small>· nguồn</small>"),Pn=b("<tr><td><code> </code></td><td> <!></td><td><code> </code></td><td> </td></tr>"),Mn=b("<small>· nguồn</small>"),Wn=b("<tr><td><code> </code></td><td> <!></td><td><code> </code></td><td> </td><td> </td></tr>"),Nn=b(`<h1>Chỉ báo</h1> <p> </p> <h2>Thêm một chỉ báo</h2> <pre><code></code></pre> <p><code>addIndicator</code> trả về một id instance: cùng một chỉ báo có thể thêm nhiều
  lần, mỗi instance có thông số, màu và mức riêng.</p> <h2>Nguồn dữ liệu và chỉ báo trên chỉ báo</h2> <p>Các chỉ báo có đánh dấu <em>nguồn</em> bên dưới có thể chạy trên một giá khác giá đóng cửa
  (<code>open</code>, <code>high</code>, <code>low</code>, <code>hl2</code>, <code>hlc3</code>, <code>ohlc4</code>, <code>hlcc4</code>) hoặc trên đường của một chỉ báo khác. Đường trung bình động của RSI
  được vẽ trong bảng của RSI, trên thang của RSI, và bị xoá cùng lúc với RSI.</p> <pre><code></code></pre> <p>Các chỉ báo ở bảng riêng cũng có thể dùng chung một bảng: <code>chart.addIndicator('stochastic', &#123;&#125;, 'bottom', &#123; pane: rsi &#125;)</code>.</p> <h2>Mức, màu và giá trị</h2> <pre><code></code></pre> <p>Chú giải hiện giá trị mới nhất của mỗi đường. Để gắn thêm nhãn giá trị đó trên trục, bằng màu của đường, hãy bật <code>features.indicatorValueLabels: true</code> hoặc <code>setIndicatorValueLabelsVisible(true)</code> (mặc định tắt).
  Các đường, mức, trục và con trỏ chữ thập trong cùng một bảng dùng chung một thang.</p> <h2>Chỉ trên một số khung thời gian</h2> <p>Có thể giới hạn một chỉ báo trong một số khung thời gian: đường trung bình 200 ngày trên biểu đồ
  ngày trở lên, một bộ dao động nhanh chỉ trên các biểu đồ phút. Mỗi loại khung (tick, giây, phút,
  giờ, ngày, tuần, tháng) có thể để bật, tắt đi, hoặc chỉ bật trong một khoảng, từ bao nhiêu đến bao
  nhiêu đơn vị; loại nào không nêu thì chỉ báo hiện trên mọi khung của loại đó. Biểu đồ đối chiếu các
  quy tắc với khung thời gian của luồng dữ liệu mà nó đang kết nối, mỗi khi khung thời gian đổi; với nến nạp bằng <code>setData</code>, <code>chart.setDataTimeframe('1h')</code> cho biết khung thời gian của chúng (ChartWidget tự
  làm việc này); khi không có cả hai, chỉ báo vẫn hiện. Các quy tắc được lưu cùng bố cục và hoàn tác được như mọi
  chỉnh sửa khác.</p> <pre><code></code></pre> <p><code>getActiveIndicators()</code> cho biết từng chỉ báo có <code>visible</code> (đang bật) và có <code>shown</code> (được vẽ trên khung thời gian này) hay không. Trong ChartWidget, dòng chú thích
  của chỉ báo chuyển sang màu xám khi nó không được vẽ.</p> <h2>Trong ChartWidget</h2> <p>Nút <strong>Chỉ báo</strong> trên thanh công cụ mở một hộp thoại. Gõ để tìm mọi chỉ báo theo tên
  hoặc tên viết tắt (<kbd>Enter</kbd> thêm chỉ báo khớp nhất); hoặc chọn một nhóm ở cột bên cạnh: <strong>Yêu thích</strong>, <strong>Mẫu</strong>, <strong>Tất cả</strong>, rồi đến từng loại
  (đường trung bình động, xu hướng, dao động, biến động, khối lượng, dải và kênh, giá và mô hình).
  Bấm một dòng để thêm chỉ báo của dòng đó, và hộp thoại vẫn mở để thêm chỉ báo tiếp theo; một con số
  cho biết biểu đồ đang có bao nhiêu chỉ báo loại đó, và ngôi sao bên cạnh giữ nó trong mục yêu thích.
  Trên điện thoại, các nhóm là một hàng chip phía trên danh sách.</p> <p>Phần cài đặt của một chỉ báo (bấm tên trên dòng chú thích của nó, hoặc nút bánh răng) có ba tab: <strong>Thông số</strong>; <strong>Kiểu</strong>, mỗi đường một dòng (hiện hay ẩn, màu, kiểu nét),
  độ dày nét, thang giá của một chỉ báo phủ lên biểu đồ và các mức; và <strong>Hiển thị</strong>, các
  khung thời gian mà chỉ báo hiện trên đó. Mọi chỉnh sửa hiện ra ngay. <strong>Huỷ</strong> hoặc <kbd>Esc</kbd> trả mọi thứ về như cũ, <strong>OK</strong> giữ lại. <strong>Mặc định</strong> đặt lại
  chỉ báo, hoặc lưu nó làm mặc định: từ đó các chỉ báo mới cùng loại sẽ bắt đầu với các thông số và
  giao diện này, trên trình duyệt này.</p> <h2> </h2> <table><thead><tr><th>id</th><th>Tên</th><th>Tham số mặc định</th><th>Đường</th></tr></thead><tbody></tbody></table> <p><code>mtfma</code> vẽ một đường trung bình động từ khung thời gian lớn hơn lên biểu đồ hiện tại — ví dụ
  MA50 khung ngày trên nến 1h. Nó chỉ lấy trung bình các giá đóng cửa <em>đã hoàn tất</em> của khung lớn hơn, nên
  đổi bậc tại mỗi ranh giới và không bao giờ vẽ lại (repaint).</p> <h2> </h2> <table><thead><tr><th>id</th><th>Tên</th><th>Tham số mặc định</th><th>Đường</th><th>Mức</th></tr></thead><tbody></tbody></table> <p><code>voldelta</code> (Volume Delta) ước lượng áp lực mua/bán từ OHLCV — nến đóng cửa tăng
  cộng khối lượng dương, nến giảm cộng khối lượng âm. <code>mode: 0</code> là histogram theo từng nến, <code>mode: 1</code> là delta luỹ kế. (Delta tick thực sự cần dữ liệu bid/ask theo từng giao dịch, thứ mà
  một chuỗi OHLCV không có.)</p> <h2>Chỉ báo quen thuộc trên bảng giá châu Á</h2> <p>Những chỉ báo mà nhà đầu tư ở Hàn Quốc, Nhật Bản và Việt Nam quen thấy trên bảng giá: Psychological Line (<code>psy</code>, tâm lý) và New Psychological Line (<code>newpsy</code>), Volume Ratio (<code>vr</code>), AB Ratio (<code>abratio</code>), <code>sonar</code>, <code>sigma</code>, Binary Wave (<code>binarywave</code>), Trade Value (<code>tradevalue</code>, giá trị giao dịch) cùng Volume Change (<code>volchange</code>), vùng giá dự phóng DeMark (<code>demark</code>) và dải đường trung bình <code>rainbow</code> tới 20 đường. Trade Value là ước tính, giá đóng cửa × khối lượng mỗi nến; con số chính thức của sở giao dịch có trong nguồn dữ liệu của họ.</p> <pre><code></code></pre> <h2>Mẫu nến</h2> <p>64 mẫu từ một đến năm nến: doji, búa và sao băng, marubozu và belt hold; nhấn chìm, harami, đường xuyên và mây đen, nhíp, kicking; sao mai và sao hôm, em bé bị bỏ rơi, ba chàng lính và ba con quạ, ba nến trong và ngoài, khoảng trống tasuki; three-line strike, ba phương pháp, mat hold, breakaway và ladder bottom. Mẫu đảo chiều chỉ được tính khi có xu hướng trước đó để đảo (giá đóng cửa trước mẫu vượt cả trung bình 10 nến lẫn giá đóng cửa 10 nến trước, <code>trendPeriod</code>), và thân nến dài hay ngắn được so với thân trung bình của các nến trước. Chỉ báo vẽ mũi tên dưới mẫu tăng và trên mẫu giảm, kèm tên viết tắt khi nến đủ rộng; nến kết thúc nhiều mẫu thì hiện mẫu dài nhất. <code>reversal</code>, <code>continuation</code> và <code>indecision</code> (1 hoặc 0) chọn loại mẫu.</p> <pre><code></code></pre> <h2>Chỉ báo của riêng bạn</h2> <p>Kế thừa <code>IndicatorBase</code> và khai báo những gì nó vẽ (<code>plots</code>), thang của bảng,
  các mức và thông số; biểu đồ sẽ tự vẽ nó, co giãn bảng của nó, gắn nhãn giá trị và liệt kê nó trong
  chú thích và phần cài đặt của widget mà bạn không phải viết dòng code vẽ nào. Thuộc tính <code>category</code> của nó (<code>'oscillators'</code>, <code>'volume'</code>…) xếp nó vào nhóm đó
  trong hộp thoại Chỉ báo; nếu không có, nó nằm trong nhóm Khác. Xem <a href="https://github.com/bonguynvan/tradecanvas/blob/main/skills/tradecanvas/references/recipes.md#a-custom-indicator">hướng dẫn mẫu cho chỉ báo tuỳ chỉnh</a>.</p> <h2>Bảng: đổi kích thước, thu gọn, phóng to, sắp xếp lại</h2> <p><strong>Kéo đường phân cách</strong> phía trên một bảng để đổi kích thước. Trong ChartWidget, mỗi bảng
  có các nút ở góc phải trên: đưa bảng lên hoặc xuống, thu gọn chỉ còn dòng tiêu đề, phóng to
  (các bảng khác thu gọn lại, còn bảng giá chính giữ một dải hẹp). Bố cục đã lưu giữ kích thước, thứ tự,
  trạng thái thu gọn và phóng to của từng bảng. Làm điều tương tự bằng code:</p> <pre><code></code></pre> <p>Bấm chuột phải vào một bảng trong ChartWidget để bật thang logarit, thang đảo ngược hoặc thang phần trăm riêng cho bảng đó.</p> <h2>Chuyển một chỉ báo sang bảng khác</h2> <p>Một chỉ báo có thể vào bảng của một chỉ báo khác (khi đó nó dùng chung thang của bảng đó),
  có bảng riêng, hoặc quay về bảng giá chính. Khi nó rời một bảng mà nó làm chủ, các chỉ báo khác
  trong bảng vẫn ở lại (chỉ báo kế tiếp trong bảng sẽ làm chủ bảng), và các chỉ báo đọc đường của nó
  sẽ đi theo nó. Trong ChartWidget, nút <strong>⋯</strong> trên một dòng chú thích cho chọn bảng phía
  trên, bảng phía dưới, một bảng mới và bảng giá chính.</p> <pre><code></code></pre> <h2>Hoàn tác và mẫu</h2> <p>Thêm, xoá, sửa và di chuyển chỉ báo đều là các bước hoàn tác, nằm chung lịch sử với hình vẽ
  (<kbd>Ctrl/⌘ Z</kbd>, <kbd>Ctrl/⌘ Shift Z</kbd>); một chỉ báo được khôi phục khi hoàn tác sẽ quay lại
  với đúng id cũ, nên các cảnh báo trên đường của nó vẫn khớp. Một loạt chỉnh sửa liền nhau trên cùng
  một chỉ báo (kéo chọn màu, gõ chu kỳ) tính là một bước. Khi tải một bố cục, lịch sử bắt đầu lại từ đầu.</p> <p>Có thể lấy ra và đặt lại toàn bộ chỉ báo cùng một lúc, và đó chính là việc mẫu chỉ báo của
  ChartWidget làm: <strong>Lưu các chỉ báo thành mẫu…</strong> ở tab Mẫu của hộp thoại Chỉ báo lưu chúng (thông số,
  kiểu, mức, bảng) dưới một cái tên, còn chọn một mẫu sẽ đặt chúng vào thay cho các chỉ báo hiện có
  của biểu đồ, trong một bước hoàn tác.</p> <pre><code></code></pre> <h2>Tính toán bên ngoài biểu đồ</h2> <p><code>IndicatorWorkerHost</code> tính một chỉ báo từ dữ liệu nến bằng chính các thông điệp mà một Web Worker
  sẽ dùng. Script worker chưa có trong các gói đã phát hành, nên hãy truyền <code>null</code> và đăng ký
  các plugin để tính ngay tại chỗ (SSR, test, script):</p> <pre><code></code></pre>`,1);function En(tn,cn){kn(cn,!1);const K=f.filter(o=>o.placement==="overlay"),O=f.filter(o=>o.placement==="panel"),z=o=>Object.entries(o.params).map(([h,r])=>`${h}: ${JSON.stringify(r)}`).join(", "),Z=o=>o.plots.map(h=>h.title).join(", "),F=o=>"inputs"in o&&Object.values(o.inputs??{}).some(h=>h.source);Tn();var G=Nn();In("jzoabj",o=>{var h=wn();_(()=>xn(h,"content",`${f.length??""} chỉ báo kỹ thuật có sẵn: đường trung bình động, dải, dao động, khối lượng và biến động, với nguồn dữ liệu, chỉ báo trên chỉ báo và mức chỉnh được.`)),yn(()=>{_n.title="Chỉ báo — Tài liệu TradeCanvas"}),u(o,h)});var C=c(fn(G),2),hn=t(C);n(C);var I=c(C,4),on=t(I);on.textContent=`const ema = chart.addIndicator('ema', { period: 50 })          // on the price pane
const rsi = chart.addIndicator('rsi', { period: 14 }, 'bottom') // in a pane of its own
chart.updateIndicator(rsi, { period: 21 })
chart.removeIndicator(rsi)`,n(I);var x=c(I,8),en=t(x);en.textContent=`import { indicatorSource } from '@tradecanvas/chart'

chart.updateIndicator(ema, { source: 'hlc3' })
const smoothed = chart.addIndicator('sma', { period: 9, source: indicatorSource(rsi, 'value') })`,n(x);var T=c(x,6),an=t(T);an.textContent=`chart.setIndicatorLevels(rsi, [20, 50, 80])   // null restores 30 / 70
chart.updateIndicatorStyle(rsi, { colors: ['#f2a93b'], lineWidths: [2] })
chart.setIndicatorVisible(rsi, false)

const series = chart.getIndicatorOutput(rsi)?.series ?? []
const latest = series[series.length - 1]?.value   // keyed by the line keys below`,n(T);var w=c(T,8),rn=t(w);rn.textContent=`chart.setIndicatorIntervals(ema, { seconds: false, minutes: false, hours: [1, 4] })
chart.getIndicatorIntervals(ema)    // { seconds: false, minutes: false, hours: [1, 4] }
chart.setIndicatorIntervals(ema, null)  // lại hiện trên mọi khung`,n(w);var S=c(w,10),gn=t(S);n(S);var P=c(S,2),J=c(t(P));nn(J,5,()=>K,o=>o.id,(o,h)=>{var r=Pn(),d=t(r),p=t(d),q=t(p,!0);n(p),n(d);var s=c(d),v=t(s,!0),B=c(v);{var H=i=>{var y=Sn();u(i,y)},$=Y(()=>F(e(h)));U(B,i=>{e($)&&i(H)})}n(s);var m=c(s),k=t(m),A=t(k,!0);n(k),n(m);var l=c(m),D=t(l,!0);n(l),n(r),_((i,y)=>{a(q,e(h).id),a(v,e(h).name),a(A,i),a(D,y)},[()=>z(e(h))||"—",()=>Z(e(h))||"—"]),u(o,r)}),n(J),n(P);var M=c(P,4),dn=t(M);n(M);var W=c(M,2),Q=c(t(W));nn(Q,5,()=>O,o=>o.id,(o,h)=>{var r=Wn(),d=t(r),p=t(d),q=t(p,!0);n(p),n(d);var s=c(d),v=t(s,!0),B=c(v);{var H=g=>{var E=Mn();u(g,E)},$=Y(()=>F(e(h)));U(B,g=>{e($)&&g(H)})}n(s);var m=c(s),k=t(m),A=t(k,!0);n(k),n(m);var l=c(m),D=t(l,!0);n(l);var i=c(l),y=t(i,!0);n(i),n(r),_((g,E,vn)=>{a(q,e(h).id),a(v,e(h).name),a(A,g),a(D,E),a(y,vn)},[()=>z(e(h))||"—",()=>Z(e(h))||"—",()=>{var g;return"levels"in e(h)?(g=e(h).levels)==null?void 0:g.join(", "):"—"}]),u(o,r)}),n(Q),n(W);var N=c(W,8),sn=t(N);sn.textContent=`chart.addIndicator('psy', { period: 10 }, 'bottom')              // tỷ lệ phiên tăng; đánh dấu 25 và 75
chart.addIndicator('vr', { period: 20 }, 'bottom')                // khối lượng phiên tăng so với phiên giảm
chart.addIndicator('tradevalue', {}, 'bottom')                    // giá đóng cửa × khối lượng, mỗi nến
chart.addIndicator('rainbow', { first: 10, step: 10, count: 10 }) // mười đường trung bình, 10 đến 100 nến`,n(N);var R=c(N,6),mn=t(R);mn.textContent=`chart.addIndicator('candlepatterns')                  // mũi tên và tên mẫu trên mỗi nến kết thúc một mẫu
chart.addIndicator('candlepatterns', { indecision: 1 }) // hiện cả doji và con xoay

import { detectCandlePatterns, CANDLE_PATTERNS } from '@tradecanvas/chart'

const found = detectCandlePatterns(bars, { patterns: ['bullishEngulfing', 'hammer'] })
// [{ index, time, pattern: { id, name, short, direction, kind, bars } }]
CANDLE_PATTERNS.length                                 // 64`,n(R);var V=c(R,10),ln=t(V);ln.textContent=`chart.setPanelSize(rsi, 180)        // px, clamped to a minimum
chart.setPaneCollapsed(macd, true)  // fold to its header
chart.setMaximizedPane(rsi)         // null puts the panes back
chart.movePane(rsi, -1)             // one place up; 1 = down
chart.on('paneChange', (e) => e.payload.change)  // 'collapsed' | 'maximized' | 'order' | 'scale'
chart.setPaneScale(atr, { log: true, invert: false })  // log while its values are above 0
chart.setPaneScale(atr, { percent: true })             // labels in percent of its first value on screen`,n(V);var L=c(V,8),un=t(L);un.textContent=`chart.moveIndicatorToPane(cci, rsi)      // into RSI's pane
chart.moveIndicatorToPane(cci, 'new')    // a pane of its own
chart.moveIndicatorToPane(ema, 'price')  // an overlay back to the price pane
chart.canMoveIndicatorToPane(cci, rsi)   // whether it would move`,n(L);var j=c(L,8),bn=t(j);bn.textContent=`const setup = chart.getIndicatorSetup()   // what a layout keeps of them
chart.applyIndicatorSetup(setup)          // in place of the chart's indicators

new ChartWidget(host, { indicatorTemplates: true })  // the default`,n(j);var X=c(j,6),pn=t(X);pn.textContent=`import { IndicatorWorkerHost, RSIIndicator } from '@tradecanvas/core'

const host = new IndicatorWorkerHost(null)
host.registerFallbackPlugin(new RSIIndicator())
const output = await host.calculate('rsi', { id: 'rsi', instanceId: 'rsi-1', params: { period: 14 } }, bars)`,n(X),_(()=>{a(hn,`${f.length??""} chỉ báo có sẵn. Thêm một chỉ báo bằng id của nó; tham số bạn bỏ qua sẽ lấy
  giá trị mặc định, và tham số không hợp lệ cũng quay về giá trị mặc định.`),a(gn,`Trên bảng giá chính (${K.length??""})`),a(dn,`Trong bảng riêng (${O.length??""})`)}),u(tn,G),Cn()}export{En as default};
