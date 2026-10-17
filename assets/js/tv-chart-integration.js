/**
 * QIM TradingView Chart + Konva Drawing Engine
 * -------------------------------------------------------------
 * 1. @mathieuc/tradingview v4 (Backend)
 * 2. TradingView Lightweight Charts (Candles + Volume)
 * 3. Konva.js (Drawing Tools Overlay: Trendline, Fibo, Box, H-Line, Text)
 * 4. LocalStorage Persistence & 3s WebSocket Auto-Reconnect
 */

(function (global) {
  'use strict';

  // ── Market Catalog ──────────────────────────────────────────────────────────
  const MARKET_GROUPS = {
    'Crypto (BINANCE)': [
      { symbol: 'BTCUSDT', exchange: 'BINANCE', name: 'Bitcoin (BTC/USDT)' },
      { symbol: 'ETHUSDT', exchange: 'BINANCE', name: 'Ethereum (ETH/USDT)' },
      { symbol: 'SOLUSDT', exchange: 'BINANCE', name: 'Solana (SOL/USDT)' },
      { symbol: 'BNBUSDT', exchange: 'BINANCE', name: 'BNB (BNB/USDT)' },
      { symbol: 'XRPUSDT', exchange: 'BINANCE', name: 'Ripple (XRP/USDT)' },
      { symbol: 'DOGEUSDT', exchange: 'BINANCE', name: 'Dogecoin (DOGE/USDT)' },
      { symbol: 'ADAUSDT', exchange: 'BINANCE', name: 'Cardano (ADA/USDT)' },
    ],
    'Forex (OANDA)': [
      { symbol: 'EURUSD', exchange: 'OANDA', name: 'EUR / USD' },
      { symbol: 'GBPUSD', exchange: 'OANDA', name: 'GBP / USD' },
      { symbol: 'USDJPY', exchange: 'OANDA', name: 'USD / JPY' },
      { symbol: 'AUDUSD', exchange: 'OANDA', name: 'AUD / USD' },
      { symbol: 'USDCHF', exchange: 'OANDA', name: 'USD / CHF' },
      { symbol: 'USDCAD', exchange: 'OANDA', name: 'USD / CAD' },
      { symbol: 'NZDUSD', exchange: 'OANDA', name: 'NZD / USD' },
    ],
    'Stock US (NASDAQ)': [
      { symbol: 'AAPL',  exchange: 'NASDAQ', name: 'Apple Inc.' },
      { symbol: 'NVDA',  exchange: 'NASDAQ', name: 'NVIDIA Corp.' },
      { symbol: 'MSFT',  exchange: 'NASDAQ', name: 'Microsoft Corp.' },
      { symbol: 'GOOGL', exchange: 'NASDAQ', name: 'Alphabet Inc.' },
      { symbol: 'AMZN',  exchange: 'NASDAQ', name: 'Amazon.com Inc.' },
      { symbol: 'TSLA',  exchange: 'NASDAQ', name: 'Tesla Inc.' },
      { symbol: 'META',  exchange: 'NASDAQ', name: 'Meta Platforms' },
    ],
    'Stock ID (IDX)': [
      { symbol: 'BBCA', exchange: 'IDX', name: 'Bank Central Asia (BBCA)' },
      { symbol: 'BBRI', exchange: 'IDX', name: 'Bank Rakyat Indonesia (BBRI)' },
      { symbol: 'BMRI', exchange: 'IDX', name: 'Bank Mandiri (BMRI)' },
      { symbol: 'TLKM', exchange: 'IDX', name: 'Telkom Indonesia (TLKM)' },
      { symbol: 'ASII', exchange: 'IDX', name: 'Astra International (ASII)' },
      { symbol: 'GOTO', exchange: 'IDX', name: 'GoTo Gojek Tokopedia (GOTO)' },
      { symbol: 'ANTM', exchange: 'IDX', name: 'Aneka Tambang (ANTM)' },
    ],
    'Commodity (COMEX / TVC)': [
      { symbol: 'GC1!',  exchange: 'COMEX', name: 'Gold Futures (COMEX)' },
      { symbol: 'SI1!',  exchange: 'COMEX', name: 'Silver Futures (COMEX)' },
      { symbol: 'HG1!',  exchange: 'COMEX', name: 'Copper Futures (COMEX)' },
      { symbol: 'XAUUSD', exchange: 'OANDA', name: 'Gold Spot (XAU/USD)' },
      { symbol: 'USOIL',  exchange: 'TVC',   name: 'WTI Crude Oil' },
    ],
  };

  const TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', '1D', '1W'];

  // ── QIMChartApp ─────────────────────────────────────────────────────────────
  class QIMChartApp {
    constructor(options = {}) {
      this.baseUrl = options.baseUrl || 'http://localhost:3001';
      this.wsUrl   = options.wsUrl   || 'ws://localhost:3001';
      this.symbol   = options.symbol   || 'BTCUSDT';
      this.exchange = options.exchange || 'BINANCE';
      this.tf       = options.tf       || '5m';

      // Lightweight Charts
      this.chart = null;
      this.candleSeries = null;
      this.volumeSeries = null;

      // Konva Drawing Layer
      this.stage = null;
      this.layer = null;
      this.tr = null; // Transformer
      this.currentTool = 'cursor'; // 'cursor' | 'trendline' | 'fibo' | 'rectangle' | 'horizontal' | 'text'
      this.activeShape = null;
      this.isDrawing = false;
      this.startPos = null;

      // WebSocket
      this.ws = null;
      this.reconnectTimer = null;
      this.autoReconnectInterval = 3000; // 3 detik

      // Data Cache
      this.candlesData = [];
    }

    init() {
      this.renderControls();
      this.initChart();
      this.initKonva();
      this.loadCandles();
      this.connectWebSocket();
      this.bindEvents();
    }

    // ── Render Top Bar Controls ──────────────────────────────────────────────
    renderControls() {
      const select = document.getElementById('qim-symbol-select');
      if (select) {
        select.innerHTML = Object.entries(MARKET_GROUPS).map(([group, list]) => `
          <optgroup label="${group}">
            ${list.map(item => `
              <option value="${item.exchange}:${item.symbol}" ${item.symbol === this.symbol && item.exchange === this.exchange ? 'selected' : ''}>
                ${item.name} (${item.symbol})
              </option>
            `).join('')}
          </optgroup>
        `).join('');
      }

      const tfContainer = document.getElementById('qim-tf-pills');
      if (tfContainer) {
        tfContainer.innerHTML = TIMEFRAMES.map(t => `
          <button data-tf="${t}" class="px-2.5 py-1 text-xs font-semibold rounded transition ${
            t === this.tf ? 'bg-cyan-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }">
            ${t}
          </button>
        `).join('');
      }
    }

    // ── Initialize Lightweight Charts ─────────────────────────────────────────
    initChart() {
      const container = document.getElementById('chart-viewport');
      if (!container) return;

      container.innerHTML = '';

      this.chart = LightweightCharts.createChart(container, {
        width: container.clientWidth,
        height: container.clientHeight || 560,
        layout: {
          background: { type: 'solid', color: '#090d16' },
          textColor: '#94a3b8',
          fontSize: 12,
        },
        grid: {
          vertLines: { color: 'rgba(30, 41, 59, 0.4)' },
          horzLines: { color: 'rgba(30, 41, 59, 0.4)' },
        },
        crosshair: {
          mode: LightweightCharts.CrosshairMode.Normal,
        },
        rightPriceScale: {
          borderColor: '#1e293b',
          scaleMargins: { top: 0.1, bottom: 0.25 },
        },
        timeScale: {
          borderColor: '#1e293b',
          timeVisible: true,
          secondsVisible: false,
        },
      });

      // Candlestick Series
      this.candleSeries = this.chart.addCandlestickSeries({
        upColor: '#10b981',
        downColor: '#ef4444',
        borderVisible: false,
        wickUpColor: '#10b981',
        wickDownColor: '#ef4444',
      });

      // Volume Series
      this.volumeSeries = this.chart.addHistogramSeries({
        priceFormat: { type: 'volume' },
        priceScaleId: 'vol_scale',
      });

      this.chart.priceScale('vol_scale').applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 },
      });

      // Responsive Resize
      window.addEventListener('resize', () => {
        if (this.chart && container) {
          const w = container.clientWidth;
          const h = container.clientHeight || 560;
          this.chart.applyOptions({ width: w, height: h });
          if (this.stage) {
            this.stage.width(w);
            this.stage.height(h);
          }
        }
      });
    }

    // ── Initialize Konva Drawing Layer ────────────────────────────────────────
    initKonva() {
      const overlay = document.getElementById('drawing-overlay');
      if (!overlay) return;

      const w = overlay.clientWidth;
      const h = overlay.clientHeight || 560;

      this.stage = new Konva.Stage({
        container: 'drawing-overlay',
        width: w,
        height: h,
      });

      this.layer = new Konva.Layer();
      this.stage.add(this.layer);

      // Transformer untuk seleksi & transform shape
      this.tr = new Konva.Transformer({
        rotateEnabled: true,
        borderStroke: '#00e5ff',
        anchorStroke: '#00e5ff',
        anchorFill: '#0b1220',
        anchorSize: 7,
      });
      this.layer.add(this.tr);

      this.setupKonvaInteractions();
      this.loadDrawingsFromStorage();
    }

    setupKonvaInteractions() {
      const overlay = document.getElementById('drawing-overlay');

      this.stage.on('mousedown touchstart', (e) => {
        if (this.currentTool === 'cursor') {
          // Klik pada background melepaskan seleksi
          if (e.target === this.stage) {
            this.tr.nodes([]);
            this.layer.draw();
          }
          return;
        }

        this.isDrawing = true;
        const pos = this.stage.getPointerPosition();
        this.startPos = pos;

        if (this.currentTool === 'trendline') {
          this.activeShape = new Konva.Line({
            points: [pos.x, pos.y, pos.x, pos.y],
            stroke: '#00e5ff',
            strokeWidth: 2,
            draggable: true,
            name: 'trendline',
          });
          this.attachShapeEvents(this.activeShape);
          this.layer.add(this.activeShape);
        } else if (this.currentTool === 'horizontal') {
          const w = this.stage.width();
          this.activeShape = new Konva.Line({
            points: [0, pos.y, w, pos.y],
            stroke: '#f59e0b',
            strokeWidth: 1.5,
            dash: [6, 4],
            draggable: true,
            name: 'horizontal',
          });
          this.attachShapeEvents(this.activeShape);
          this.layer.add(this.activeShape);
          this.isDrawing = false;
          this.saveDrawingsToStorage();
          this.setTool('cursor');
        } else if (this.currentTool === 'rectangle') {
          this.activeShape = new Konva.Rect({
            x: pos.x,
            y: pos.y,
            width: 0,
            height: 0,
            stroke: '#10b981',
            strokeWidth: 1.5,
            fill: 'rgba(16, 185, 129, 0.12)',
            draggable: true,
            name: 'rectangle',
          });
          this.attachShapeEvents(this.activeShape);
          this.layer.add(this.activeShape);
        } else if (this.currentTool === 'fibo') {
          // Fibo Container Group
          const fiboGroup = new Konva.Group({
            draggable: true,
            name: 'fibo',
            x: 0,
            y: 0,
          });
          this.activeShape = fiboGroup;
          this.layer.add(this.activeShape);
        } else if (this.currentTool === 'text') {
          const txtVal = prompt('Masukkan catatan teks pada chart:', 'Entry / Key Level');
          if (txtVal) {
            const textNode = new Konva.Text({
              x: pos.x,
              y: pos.y,
              text: txtVal,
              fontSize: 13,
              fontFamily: 'Inter, sans-serif',
              fill: '#e2e8f0',
              padding: 4,
              draggable: true,
              name: 'text',
            });
            this.attachShapeEvents(textNode);
            this.layer.add(textNode);
            this.saveDrawingsToStorage();
          }
          this.isDrawing = false;
          this.setTool('cursor');
        }
      });

      this.stage.on('mousemove touchmove', () => {
        if (!this.isDrawing || !this.activeShape) return;
        const pos = this.stage.getPointerPosition();

        if (this.currentTool === 'trendline') {
          this.activeShape.points([this.startPos.x, this.startPos.y, pos.x, pos.y]);
          this.layer.batchDraw();
        } else if (this.currentTool === 'rectangle') {
          const w = pos.x - this.startPos.x;
          const h = pos.y - this.startPos.y;
          this.activeShape.width(w);
          this.activeShape.height(h);
          this.layer.batchDraw();
        } else if (this.currentTool === 'fibo') {
          this.renderFiboLevels(this.activeShape, this.startPos, pos);
          this.layer.batchDraw();
        }
      });

      this.stage.on('mouseup touchend', () => {
        if (!this.isDrawing) return;
        this.isDrawing = false;
        this.activeShape = null;
        this.saveDrawingsToStorage();
        this.setTool('cursor'); // Balik ke kursor agar chart bisa di-pan
      });
    }

    renderFiboLevels(group, p1, p2) {
      group.destroyChildren();

      const levels = [
        { pct: 0,     label: '0.0% (Base)',   color: '#94a3b8' },
        { pct: 0.236, label: '23.6%',         color: '#ef4444' },
        { pct: 0.382, label: '38.2%',         color: '#f59e0b' },
        { pct: 0.5,   label: '50.0%',         color: '#10b981' },
        { pct: 0.618, label: '61.8% (Golden)',color: '#00e5ff' },
        { pct: 0.786, label: '78.6%',         color: '#8b5cf6' },
        { pct: 1.0,   label: '100.0%',        color: '#94a3b8' },
      ];

      const dy = p2.y - p1.y;
      const minX = Math.min(p1.x, p2.x);
      const maxX = Math.max(p1.x, p2.x, minX + 220);

      levels.forEach(lv => {
        const y = p1.y + dy * lv.pct;
        const line = new Konva.Line({
          points: [minX, y, maxX, y],
          stroke: lv.color,
          strokeWidth: 1.2,
          dash: lv.pct === 0 || lv.pct === 1 ? [] : [4, 3],
        });
        const label = new Konva.Text({
          x: maxX + 4,
          y: y - 7,
          text: lv.label,
          fontSize: 10,
          fill: lv.color,
          fontFamily: 'Inter, sans-serif',
        });
        group.add(line);
        group.add(label);
      });

      this.attachShapeEvents(group);
    }

    attachShapeEvents(shape) {
      shape.on('click tap', (e) => {
        if (this.currentTool === 'cursor') {
          e.cancelBubble = true;
          this.tr.nodes([shape]);
          this.layer.draw();
        }
      });

      shape.on('dragend transformend', () => {
        this.saveDrawingsToStorage();
      });
    }

    setTool(tool) {
      this.currentTool = tool;
      const overlay = document.getElementById('drawing-overlay');

      document.querySelectorAll('#qim-drawing-tools [data-tool]').forEach(btn => {
        const active = btn.dataset.tool === tool;
        btn.classList.toggle('bg-cyan-500', active);
        btn.classList.toggle('text-slate-950', active);
        btn.classList.toggle('bg-slate-800', !active);
        btn.classList.toggle('text-slate-300', !active);
      });

      if (overlay) {
        if (tool === 'cursor') {
          overlay.style.pointerEvents = 'none'; // Biarkan chart menerima pan/zoom
          this.stage.container().style.pointerEvents = 'auto'; // Konva tetap menerima klik node terpilih
        } else {
          overlay.style.pointerEvents = 'auto';
        }
      }
    }

    deleteSelected() {
      const nodes = this.tr.nodes();
      if (nodes.length > 0) {
        nodes.forEach(n => n.destroy());
        this.tr.nodes([]);
        this.layer.draw();
        this.saveDrawingsToStorage();
      }
    }

    clearAllDrawings() {
      if (!confirm('Hapus semua garis & gambar pada chart ini?')) return;
      this.tr.nodes([]);
      this.layer.destroyChildren();
      this.layer.add(this.tr);
      this.layer.draw();
      this.saveDrawingsToStorage();
    }

    // ── LocalStorage Drawings Persistence ─────────────────────────────────────
    getStorageKey() {
      return `qim_draw_${this.exchange}_${this.symbol}_${this.tf}`;
    }

    saveDrawingsToStorage() {
      if (!this.layer) return;
      try {
        const shapes = [];
        this.layer.children.forEach(child => {
          if (child === this.tr) return;
          shapes.push(child.toObject());
        });
        localStorage.setItem(this.getStorageKey(), JSON.stringify(shapes));
      } catch (e) {
        console.warn('Gagal menyimpan gambar ke localStorage:', e);
      }
    }

    loadDrawingsFromStorage() {
      if (!this.layer) return;
      this.tr.nodes([]);
      this.layer.destroyChildren();
      this.layer.add(this.tr);

      const raw = localStorage.getItem(this.getStorageKey());
      if (!raw) {
        this.layer.draw();
        return;
      }

      try {
        const shapes = JSON.parse(raw);
        shapes.forEach(obj => {
          const node = Konva.Node.create(obj);
          this.attachShapeEvents(node);
          this.layer.add(node);
        });
        this.layer.draw();
      } catch (e) {
        console.warn('Gagal memuat gambar dari localStorage:', e);
      }
    }

    // ── Load Candles Data via REST ────────────────────────────────────────────
    async loadCandles() {
      this.updateStatus('Memuat data historis...', 'connecting');
      try {
        const url = `${this.baseUrl}/candles?symbol=${this.symbol}&exchange=${this.exchange}&tf=${this.tf}&limit=300`;
        const resp = await fetch(url);
        const data = await resp.json();

        if (!data.ok || !data.candles || data.candles.length === 0) {
          throw new Error(data.error || 'Data candle kosong');
        }

        this.candlesData = data.candles;

        this.candleSeries.setData(this.candlesData.map(c => ({
          time: c.time,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        })));

        this.volumeSeries.setData(this.candlesData.map(c => ({
          time: c.time,
          value: c.volume,
          color: c.close >= c.open ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)',
        })));

        this.chart.timeScale().fitContent();

        const last = this.candlesData[this.candlesData.length - 1];
        this.updateHeaderPrice(last.close, last.close - last.open);
        this.updateStatus('Live Stream Aktif', 'online');

        // Muat ulang gambar khusus symbol + tf ini
        this.loadDrawingsFromStorage();
      } catch (err) {
        console.error('loadCandles error:', err);
        this.updateStatus(`Error: ${err.message}`, 'error');
      }
    }

    // ── WebSocket Real-time Stream & 3s Auto-Reconnect ─────────────────────────
    connectWebSocket() {
      if (this.ws) {
        this.ws.onclose = null;
        try { this.ws.close(); } catch (_) {}
        this.ws = null;
      }

      clearTimeout(this.reconnectTimer);

      const wsEndpoint = `${this.wsUrl}/ws?symbol=${this.symbol}&exchange=${this.exchange}&tf=${this.tf}`;
      this.updateStatus('Menghubungkan socket...', 'connecting');

      try {
        this.ws = new WebSocket(wsEndpoint);
      } catch (err) {
        this.scheduleReconnect();
        return;
      }

      this.ws.onopen = () => {
        this.updateStatus('Live Connected', 'online');
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'candle' && msg.candle) {
            const c = msg.candle;
            this.candleSeries.update({
              time: c.time,
              open: c.open,
              high: c.high,
              low: c.low,
              close: c.close,
            });
            this.volumeSeries.update({
              time: c.time,
              value: c.volume,
              color: c.close >= c.open ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)',
            });
            this.updateHeaderPrice(c.close, c.close - c.open);
          }
        } catch (_) {}
      };

      this.ws.onerror = () => {
        this.updateStatus('Socket error', 'error');
      };

      this.ws.onclose = () => {
        this.updateStatus('Disconnected — reconnect 3s...', 'offline');
        this.scheduleReconnect();
      };
    }

    scheduleReconnect() {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = setTimeout(() => {
        console.log('[QIM WebSocket] Menghubungkan ulang...');
        this.connectWebSocket();
      }, this.autoReconnectInterval);
    }

    // ── UI Helpers ────────────────────────────────────────────────────────────
    updateHeaderPrice(price, diff) {
      const elPrice = document.getElementById('qim-live-price');
      const elDiff = document.getElementById('qim-price-diff');
      if (elPrice) elPrice.textContent = Number(price).toLocaleString('en-US', { minimumFractionDigits: 2 });
      if (elDiff) {
        const sign = diff >= 0 ? '+' : '';
        elDiff.textContent = `${sign}${Number(diff).toFixed(2)}`;
        elDiff.className = `text-xs font-semibold ${diff >= 0 ? 'text-emerald-400' : 'text-rose-400'}`;
      }
    }

    updateStatus(text, state) {
      const dot = document.getElementById('qim-status-dot');
      const label = document.getElementById('qim-status-text');
      if (label) label.textContent = text;
      if (dot) {
        const colors = {
          online: 'bg-emerald-400 shadow-[0_0_8px_#10b981]',
          connecting: 'bg-amber-400 animate-pulse',
          offline: 'bg-slate-500',
          error: 'bg-rose-500',
        };
        dot.className = `w-2 h-2 rounded-full ${colors[state] || 'bg-slate-500'}`;
      }
    }

    // ── Bind UI Events ────────────────────────────────────────────────────────
    bindEvents() {
      // Symbol Select
      const select = document.getElementById('qim-symbol-select');
      if (select) {
        select.addEventListener('change', (e) => {
          const [exch, sym] = e.target.value.split(':');
          this.symbol = sym;
          this.exchange = exch;
          this.loadCandles();
          this.connectWebSocket();
        });
      }

      // Timeframe Pills
      const tfContainer = document.getElementById('qim-tf-pills');
      if (tfContainer) {
        tfContainer.addEventListener('click', (e) => {
          const btn = e.target.closest('[data-tf]');
          if (!btn) return;
          this.tf = btn.dataset.tf;
          this.renderControls();
          this.loadCandles();
          this.connectWebSocket();
        });
      }

      // Drawing Tool Buttons
      document.querySelectorAll('#qim-drawing-tools [data-tool]').forEach(btn => {
        btn.addEventListener('click', () => {
          this.setTool(btn.dataset.tool);
        });
      });

      // Delete Shape Button
      const btnDel = document.getElementById('btn-delete-drawing');
      if (btnDel) btnDel.addEventListener('click', () => this.deleteSelected());

      // Clear All Button
      const btnClear = document.getElementById('btn-clear-drawings');
      if (btnClear) btnClear.addEventListener('click', () => this.clearAllDrawings());

      // Search Box
      const searchInput = document.getElementById('qim-search-input');
      const searchBox = document.getElementById('qim-search-results');
      let debounce = null;

      if (searchInput && searchBox) {
        searchInput.addEventListener('input', () => {
          clearTimeout(debounce);
          const q = searchInput.value.trim();
          if (!q) {
            searchBox.classList.add('hidden');
            return;
          }
          debounce = setTimeout(async () => {
            searchBox.classList.remove('hidden');
            searchBox.innerHTML = '<div class="p-2 text-xs text-slate-400">Mencari pasar...</div>';
            try {
              const res = await fetch(`${this.baseUrl}/search?q=${encodeURIComponent(q)}`);
              const data = await res.json();
              if (!data.ok || !data.results.length) {
                searchBox.innerHTML = '<div class="p-2 text-xs text-slate-400">Tidak ada hasil.</div>';
                return;
              }
              searchBox.innerHTML = data.results.slice(0, 12).map(r => `
                <div data-sym="${r.symbol}" data-exch="${r.exchange}" class="px-3 py-2 text-xs hover:bg-slate-800 cursor-pointer flex justify-between border-b border-slate-800/50">
                  <span class="font-bold text-slate-200">${r.symbol} <span class="font-normal text-slate-400">${r.description || ''}</span></span>
                  <span class="text-cyan-400 font-mono">${r.exchange}</span>
                </div>
              `).join('');

              searchBox.querySelectorAll('[data-sym]').forEach(el => {
                el.addEventListener('click', () => {
                  this.symbol = el.dataset.sym;
                  this.exchange = el.dataset.exch;
                  searchBox.classList.add('hidden');
                  searchInput.value = '';
                  this.loadCandles();
                  this.connectWebSocket();
                });
              });
            } catch (err) {
              searchBox.innerHTML = `<div class="p-2 text-xs text-rose-400">${err.message}</div>`;
            }
          }, 350);
        });

        document.addEventListener('click', (e) => {
          if (!searchInput.contains(e.target) && !searchBox.contains(e.target)) {
            searchBox.classList.add('hidden');
          }
        });
      }
    }
  }

  // Export
  global.QIMChartApp = QIMChartApp;

})(window);
