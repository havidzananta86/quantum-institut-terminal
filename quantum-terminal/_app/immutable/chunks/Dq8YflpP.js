import"./Bzak7iHL.js";import"./DQttDCvw.js";import{p as ge,t as _,_ as fe,$ as ye,a as h,s as o,a0 as _e,c as a,r as e,b as Ie,f as v,g as s,u as X}from"./vnnAQmBw.js";import{s as d}from"./BPRzW5Y5.js";import{i as Y}from"./CaEBpJzl.js";import{e as ee}from"./CqWi4pek.js";import{h as Ce}from"./Di_Vksbt.js";import{s as qe}from"./BbGUZXP3.js";import{i as xe}from"./w5vomPQw.js";import{c as I}from"./DM_frcBA.js";var je=v('<meta name="description"/>'),ke=v("<small>· fuente</small>"),Pe=v("<tr><td><code> </code></td><td> <!></td><td><code> </code></td><td> </td></tr>"),ze=v("<small>· fuente</small>"),Se=v("<tr><td><code> </code></td><td> <!></td><td><code> </code></td><td> </td><td> </td></tr>"),we=v(`<h1>Indicadores</h1> <p> </p> <h2>Añadir un indicador</h2> <pre><code></code></pre> <p><code>addIndicator</code> devuelve un id de instancia: el mismo indicador se puede
  añadir varias veces, cada instancia con sus propios parámetros, colores y niveles.</p> <h2>Fuentes e indicadores sobre indicadores</h2> <p>Los indicadores marcados con <em>fuente</em> más abajo pueden calcularse sobre
  otro precio distinto del cierre (<code>open</code>, <code>high</code>, <code>low</code>, <code>hl2</code>, <code>hlc3</code>, <code>ohlc4</code>, <code>hlcc4</code>) o sobre la línea de otro indicador. Una media móvil del RSI
  se dibuja en el panel del RSI, en su escala, y desaparece cuando se quita el RSI.</p> <pre><code></code></pre> <p>Los indicadores en panel también pueden compartir un panel: <code>chart.addIndicator('stochastic', &#123;&#125;, 'bottom', &#123; pane: rsi &#125;)</code>.</p> <h2>Niveles, colores y valores</h2> <pre><code></code></pre> <p>La leyenda muestra el último valor de cada línea. Para marcarlo también en su eje, con el color de la línea,
  activa <code>features.indicatorValueLabels: true</code> o <code>setIndicatorValueLabelsVisible(true)</code> (desactivado por defecto). Las líneas, los niveles, el
  eje y la cruz de un panel comparten una misma escala.</p> <h2>Solo en algunas temporalidades</h2> <p>Un indicador puede limitarse a algunas temporalidades: una media de 200 días en el gráfico
  diario y superiores, un oscilador rápido solo en los gráficos de minutos. Cada tipo de
  temporalidad (ticks, segundos, minutos, horas, días, semanas, meses) se deja activado, se
  desactiva o se limita a un rango de valores; un tipo que no se indica lo muestra en todas. El
  gráfico aplica las reglas a la temporalidad del flujo al que está conectado, a medida que esta
  cambia; para las barras dadas con <code>setData</code>, <code>chart.setDataTimeframe('1h')</code> le indica su temporalidad (ChartWidget lo hace por sí mismo); sin
  ninguno de los dos, muestra el indicador. Las reglas se guardan con el diseño y se deshacen como
  cualquier otro cambio.</p> <pre><code></code></pre> <p><code>getActiveIndicators()</code> indica de cada uno si está <code>visible</code> (activado) y si
  está <code>shown</code> (dibujado en esta temporalidad). En ChartWidget, su fila de la leyenda se
  vuelve gris mientras no lo está.</p> <h2>En ChartWidget</h2> <p><strong>Indicadores</strong>, en la barra de herramientas, abre un diálogo. Escribe para buscar
  cualquier indicador por su nombre o su nombre corto (<kbd>Enter</kbd> añade la mejor
  coincidencia), o elige un grupo en el lateral: <strong>Favoritos</strong>, <strong>Plantillas</strong>, <strong>Todos</strong> y luego cada tipo (medias móviles,
  tendencia, osciladores, volatilidad, volumen, bandas y canales, precio y patrones). Una fila
  añade su indicador y el diálogo sigue abierto para el siguiente; un contador muestra cuántos hay
  en el gráfico, y la estrella de al lado lo guarda en favoritos. En un móvil, los grupos son una
  fila de chips sobre la lista.</p> <p>La configuración de un indicador (el nombre en su fila de la leyenda, o su engranaje) tiene tres
  pestañas: <strong>Parámetros</strong>; <strong>Estilo</strong>, una fila por línea (visible o no,
  sus colores, su trazo), el grosor de línea, la escala de precio de un indicador superpuesto y los
  niveles; y <strong>Visibilidad</strong>, las temporalidades en las que se muestra. Cada cambio se
  ve al momento. <strong>Cancelar</strong> o <kbd>Esc</kbd> lo deja todo como estaba, <strong>Aceptar</strong> lo conserva. <strong>Predeterminados</strong> lo restablece, o lo guarda
  como predeterminado: los nuevos indicadores de su tipo empiezan entonces con estos parámetros y
  este aspecto, en este navegador.</p> <h2> </h2> <table><thead><tr><th>id</th><th>Nombre</th><th>Parámetros predeterminados</th><th>Líneas</th></tr></thead><tbody></tbody></table> <p><code>mtfma</code> traza en el gráfico actual una media móvil de una temporalidad
  superior; por ejemplo, la MA de 50 diaria sobre barras de 1h. Solo promedia los
  cierres <em>completados</em> de la temporalidad superior, así que avanza en
  escalones en cada límite y nunca se redibuja.</p> <h2> </h2> <table><thead><tr><th>id</th><th>Nombre</th><th>Parámetros predeterminados</th><th>Líneas</th><th>Niveles</th></tr></thead><tbody></tbody></table> <p><code>voldelta</code> (Volume Delta) aproxima la presión compradora/vendedora a
  partir de OHLCV: las barras que cierran al alza suman volumen positivo y las
  bajistas, negativo. <code>mode: 0</code> es el histograma por barra y <code>mode: 1</code> el delta acumulado. (Un delta real por tick necesita datos
  de compra/venta de cada operación, que una serie OHLCV no incluye).</p> <h2>Indicadores de las pantallas de cotización asiáticas</h2> <p>Indicadores que los operadores de Corea, Japón y Vietnam esperan en sus pantallas de cotización: la Psychological Line (<code>psy</code>) y la New Psychological Line (<code>newpsy</code>), Volume Ratio (<code>vr</code>), AB Ratio (<code>abratio</code>), <code>sonar</code>, <code>sigma</code>, Binary Wave (<code>binarywave</code>), Trade Value (<code>tradevalue</code>) con Volume Change (<code>volchange</code>), el rango proyectado de DeMark (<code>demark</code>) y un arcoíris de medias (<code>rainbow</code>) de hasta 20 líneas. Trade Value es una estimación, cierre × volumen en cada barra; la cifra oficial de la bolsa llega en su feed.</p> <pre><code></code></pre> <h2>Patrones de velas</h2> <p>64 patrones de una a cinco barras: dojis, martillos y estrellas fugaces, marubozu y belt hold; envolventes, harami, líneas penetrantes y nubes oscuras, pinzas, kicking; estrellas de la mañana y de la tarde, bebés abandonados, tres soldados y tres cuervos, tres dentro y tres fuera, huecos tasuki; three-line strike, tres métodos, mat hold, breakaway y ladder bottom. Un patrón de giro solo cuenta tras la tendencia que gira (el cierre anterior más allá de su media de 10 barras y del cierre de 10 barras antes, <code>trendPeriod</code>), y un cuerpo es largo o corto frente al cuerpo medio de las barras anteriores. El indicador dibuja una flecha bajo un patrón alcista y sobre uno bajista, con su nombre corto cuando las barras son lo bastante anchas; una barra que termina varios muestra el más largo. <code>reversal</code>, <code>continuation</code> e <code>indecision</code> (1 o 0) eligen los tipos.</p> <pre><code></code></pre> <h2>Tu propio indicador</h2> <p>Extiende <code>IndicatorBase</code> y declara lo que dibuja (<code>plots</code>),
  la escala de su panel, sus niveles y sus parámetros; el gráfico lo dibuja,
  escala su panel, etiqueta sus valores y lo muestra en la leyenda y la
  configuración del widget sin que tengas que escribir código de renderizado.
  Su <code>category</code> (<code>'oscillators'</code>, <code>'volume'</code>…) lo coloca en ese
  grupo del diálogo Indicadores; sin ella, aparece en Otros. Consulta la <a href="https://github.com/bonguynvan/tradecanvas/blob/main/skills/tradecanvas/references/recipes.md#a-custom-indicator">receta de indicador personalizado</a>.</p> <h2>Paneles: redimensionar, contraer, maximizar, reordenar</h2> <p><strong>Arrastra el divisor</strong> que hay sobre un panel para cambiar su tamaño. En
  ChartWidget cada panel tiene botones arriba a la derecha: subirlo o bajarlo, contraerlo
  hasta su cabecera y maximizarlo (los demás paneles se contraen y el panel de precio
  conserva una franja). Los diseños guardados conservan el tamaño, el orden y el estado
  contraído o maximizado de cada panel. Lo mismo desde código:</p> <pre><code></code></pre> <p>En ChartWidget, haz clic derecho en un panel para darle su propia escala logarítmica,
  invertida o porcentual.</p> <h2>Mover un indicador a otro panel</h2> <p>Un indicador puede unirse al panel de otro indicador (y entonces comparte la escala de
  ese panel), tener un panel propio o volver al panel de precio. Cuando deja un panel que
  era suyo, los demás indicadores se quedan en él (el siguiente indicador en panel pasa a
  ser su dueño), y los que leen sus líneas lo siguen. En ChartWidget, el botón <strong>⋯</strong> de una fila de la leyenda ofrece el panel de arriba, el de abajo, un
  panel nuevo y el panel de precio.</p> <pre><code></code></pre> <h2>Deshacer y plantillas</h2> <p>Añadir, quitar, editar y mover indicadores son pasos que se pueden deshacer, en el mismo
  historial que los dibujos (<kbd>Ctrl/⌘ Z</kbd>, <kbd>Ctrl/⌘ Shift Z</kbd>); un indicador
  que vuelve al deshacer conserva su propio id, así que las alertas sobre sus líneas siguen
  coincidiendo. Una ráfaga de cambios en un mismo indicador (un color arrastrado, un
  periodo escrito) es un solo paso. Al cargar un diseño, el historial empieza de cero.</p> <p>Los indicadores se pueden tomar y volver a poner en bloque, que es lo que hacen las
  plantillas de indicadores de ChartWidget: <strong>Guardar indicadores como plantilla…</strong> en la pestaña Plantillas del diálogo Indicadores los guarda (parámetros, estilo, niveles, paneles) con un nombre, y
  elegir una plantilla los pone en lugar de los del gráfico, como un solo paso de deshacer.</p> <pre><code></code></pre> <h2>Cálculo fuera del gráfico</h2> <p><code>IndicatorWorkerHost</code> calcula un indicador a partir de las barras con
  los mismos mensajes que usaría un Web Worker. El script del worker todavía no
  forma parte de los paquetes publicados, así que pasa <code>null</code> y registra
  los plugins para calcular en el mismo hilo (SSR, tests, scripts):</p> <pre><code></code></pre>`,1);function Oe(ae,oe){ge(oe,!1);const H=I.filter(t=>t.placement==="overlay"),M=I.filter(t=>t.placement==="panel"),B=t=>Object.entries(t.params).map(([r,n])=>`${r}: ${JSON.stringify(n)}`).join(", "),F=t=>t.plots.map(r=>r.title).join(", "),J=t=>"inputs"in t&&Object.values(t.inputs??{}).some(r=>r.source);xe();var Z=we();Ce("1i8m1sg",t=>{var r=je();_(()=>qe(r,"content",`${I.length??""} indicadores técnicos integrados: medias móviles, bandas, osciladores, volumen y volatilidad, con fuentes, indicadores sobre indicadores y niveles editables.`)),fe(()=>{ye.title="Indicadores — Documentación de TradeCanvas"}),h(t,r)});var C=o(_e(Z),2),re=a(C);e(C);var q=o(C,4),te=a(q);te.textContent=`const ema = chart.addIndicator('ema', { period: 50 })          // on the price pane
const rsi = chart.addIndicator('rsi', { period: 14 }, 'bottom') // in a pane of its own
chart.updateIndicator(rsi, { period: 21 })
chart.removeIndicator(rsi)`,e(q);var x=o(q,8),se=a(x);se.textContent=`import { indicatorSource } from '@tradecanvas/chart'

chart.updateIndicator(ema, { source: 'hlc3' })
const smoothed = chart.addIndicator('sma', { period: 9, source: indicatorSource(rsi, 'value') })`,e(x);var j=o(x,6),de=a(j);de.textContent=`chart.setIndicatorLevels(rsi, [20, 50, 80])   // null restores 30 / 70
chart.updateIndicatorStyle(rsi, { colors: ['#f2a93b'], lineWidths: [2] })
chart.setIndicatorVisible(rsi, false)

const series = chart.getIndicatorOutput(rsi)?.series ?? []
const latest = series[series.length - 1]?.value   // keyed by the line keys below`,e(j);var k=o(j,8),ne=a(k);ne.textContent=`chart.setIndicatorIntervals(ema, { seconds: false, minutes: false, hours: [1, 4] })
chart.getIndicatorIntervals(ema)    // { seconds: false, minutes: false, hours: [1, 4] }
chart.setIndicatorIntervals(ema, null)  // todas otra vez`,e(k);var P=o(k,10),ie=a(P);e(P);var z=o(P,2),G=o(a(z));ee(G,5,()=>H,t=>t.id,(t,r)=>{var n=Pe(),l=a(n),b=a(l),V=a(b,!0);e(b),e(l);var p=o(l),g=a(p,!0),R=o(g);{var N=i=>{var y=ke();h(i,y)},D=X(()=>J(s(r)));Y(R,i=>{s(D)&&i(N)})}e(p);var u=o(p),f=a(u),$=a(f,!0);e(f),e(u);var m=o(u),O=a(m,!0);e(m),e(n),_((i,y)=>{d(V,s(r).id),d(g,s(r).name),d($,i),d(O,y)},[()=>B(s(r))||"—",()=>F(s(r))||"—"]),h(t,n)}),e(G),e(z);var S=o(z,4),ce=a(S);e(S);var w=o(S,2),K=o(a(w));ee(K,5,()=>M,t=>t.id,(t,r)=>{var n=Se(),l=a(n),b=a(l),V=a(b,!0);e(b),e(l);var p=o(l),g=a(p,!0),R=o(g);{var N=c=>{var U=ze();h(c,U)},D=X(()=>J(s(r)));Y(R,c=>{s(D)&&c(N)})}e(p);var u=o(p),f=a(u),$=a(f,!0);e(f),e(u);var m=o(u),O=a(m,!0);e(m);var i=o(m),y=a(i,!0);e(i),e(n),_((c,U,be)=>{d(V,s(r).id),d(g,s(r).name),d($,c),d(O,U),d(y,be)},[()=>B(s(r))||"—",()=>F(s(r))||"—",()=>{var c;return"levels"in s(r)?(c=s(r).levels)==null?void 0:c.join(", "):"—"}]),h(t,n)}),e(K),e(w);var E=o(w,8),le=a(E);le.textContent=`chart.addIndicator('psy', { period: 10 }, 'bottom')              // proporción de cierres al alza; marca 25 y 75
chart.addIndicator('vr', { period: 20 }, 'bottom')                // volumen de días al alza frente a días a la baja
chart.addIndicator('tradevalue', {}, 'bottom')                    // cierre × volumen, en cada barra
chart.addIndicator('rainbow', { first: 10, step: 10, count: 10 }) // diez medias, de 10 a 100 barras`,e(E);var L=o(E,6),pe=a(L);pe.textContent=`chart.addIndicator('candlepatterns')                  // una flecha y el nombre en cada barra que termina uno
chart.addIndicator('candlepatterns', { indecision: 1 }) // también dojis y peonzas

import { detectCandlePatterns, CANDLE_PATTERNS } from '@tradecanvas/chart'

const found = detectCandlePatterns(bars, { patterns: ['bullishEngulfing', 'hammer'] })
// [{ index, time, pattern: { id, name, short, direction, kind, bars } }]
CANDLE_PATTERNS.length                                 // 64`,e(L);var T=o(L,10),ue=a(T);ue.textContent=`chart.setPanelSize(rsi, 180)        // px, clamped to a minimum
chart.setPaneCollapsed(macd, true)  // fold to its header
chart.setMaximizedPane(rsi)         // null puts the panes back
chart.movePane(rsi, -1)             // one place up; 1 = down
chart.on('paneChange', (e) => e.payload.change)  // 'collapsed' | 'maximized' | 'order' | 'scale'
chart.setPaneScale(atr, { log: true, invert: false })  // log while its values are above 0
chart.setPaneScale(atr, { percent: true })             // labels in percent of its first value on screen`,e(T);var W=o(T,8),me=a(W);me.textContent=`chart.moveIndicatorToPane(cci, rsi)      // into RSI's pane
chart.moveIndicatorToPane(cci, 'new')    // a pane of its own
chart.moveIndicatorToPane(ema, 'price')  // an overlay back to the price pane
chart.canMoveIndicatorToPane(cci, rsi)   // whether it would move`,e(W);var A=o(W,8),he=a(A);he.textContent=`const setup = chart.getIndicatorSetup()   // what a layout keeps of them
chart.applyIndicatorSetup(setup)          // in place of the chart's indicators

new ChartWidget(host, { indicatorTemplates: true })  // the default`,e(A);var Q=o(A,6),ve=a(Q);ve.textContent=`import { IndicatorWorkerHost, RSIIndicator } from '@tradecanvas/core'

const host = new IndicatorWorkerHost(null)
host.registerFallbackPlugin(new RSIIndicator())
const output = await host.calculate('rsi', { id: 'rsi', instanceId: 'rsi-1', params: { period: 14 } }, bars)`,e(Q),_(()=>{d(re,`${I.length??""} indicadores integrados. Añade uno por su id; los parámetros que
  omitas toman su valor predeterminado, y los no válidos vuelven a él.`),d(ie,`En el panel de precio (${H.length??""})`),d(ce,`En un panel propio (${M.length??""})`)}),h(ae,Z),Ie()}export{Oe as default};
