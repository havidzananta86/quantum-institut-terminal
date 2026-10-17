# Quantum Institute Market — TradingView v4 + Konva.js Drawing Chart

Integrasi penuh:
1. **`@mathieuc/tradingview` v4** — Realtime scraping semua market (Crypto, Forex, US Stocks, IDX, Komoditi)
2. **`tradingview/lightweight-charts`** — Candlestick chart + Volume histogram
3. **`konvajs/konva`** — Drawing tools overlay interaktif dengan penyimpanan otomatis ke `localStorage`

---

## Arsitektur

```
[ Browser Client ]
  ├─ TradingView Lightweight Charts (Candles + Volume Canvas)
  └─ Konva.js Overlay (Drawing Layer: Trendline, Fibo, Box, H-Line, Text)
         ↕ REST & WebSocket (Auto-reconnect 3 detik)
[ Node.js TV Engine :3001 ]
  ├─ REST /candles  -> getCandles()
  ├─ REST /search   -> searchMarkets()
  └─ WS   /ws       -> watchCandles()
         ↕
[ TradingView Official Servers ]
```

---

## 1. Panduan Instalasi & Jalankan

### Buka Terminal di direktori `tv-bridge`:
```bash
cd d:\xamp\htdocs\webapp\tv-bridge

# Install dependensi (Express, ws, @mathieuc/tradingview v4, cors, dotenv)
npm install

# Jalankan Node.js Engine
npm start
```

Server akan aktif di:
- **REST**: `http://localhost:3001/candles`
- **REST**: `http://localhost:3001/search`
- **WS**: `ws://localhost:3001/ws`

*(Opsional)* Jika ingin menjalankan Python FastAPI Proxy di Port 8001:
```bash
pip install -r requirements.txt
python main.py
```

---

## 2. Cara Mengakses Chart Webapp

Buka di browser Anda:
👉 **`http://localhost/webapp/tv-chart.html`**

Atau dari Dashboard utama **`http://localhost/webapp/dashboard.html`**, klik menu sidebar:
👉 **Market Terminal → 📊 TradingView Live**

---

## 3. Fitur Frontend & Drawing Tools

- **Dropdown Market**:
  - `BINANCE` (Crypto): BTCUSDT, ETHUSDT, SOLUSDT, BNBUSDT, dll.
  - `OANDA` (Forex): EURUSD, GBPUSD, USDJPY, AUDUSD, USDCHF, dll.
  - `NASDAQ` (US Stocks): AAPL, NVDA, MSFT, GOOGL, AMZN, TSLA, dll.
  - `IDX` (Saham Indonesia): BBCA, BBRI, BMRI, TLKM, ASII, GOTO, dll.
  - `COMEX` (Komoditi): GC1! (Gold), SI1! (Silver), HG1! (Copper), XAUUSD.
- **Timeframe Pills**: `1m`, `5m`, `15m`, `1h`, `4h`, `1D`, `1W`.
- **Konva Drawing Tools**:
  - ✋ **Pan**: Interaksi normal chart (zoom, pan, drag candle).
  - 📈 **Trendline**: Tarik garis tren antar swing high/low.
  - 🧬 **Fibo**: Fibonacci Retracement bertingkat (0%, 23.6%, 38.2%, 50%, 61.8% Golden Ratio, 78.6%, 100%).
  - ⬛ **Box**: Gambar area Supply/Demand atau konsolidasi.
  - ➖ **H-Line**: Garis support/resistance horizontal penuh.
  - 🔤 **Text**: Beri label catatan setup trading langsung di chart.
  - 🗑️ **Delete / Reset**: Hapus objek terpilih atau reset semua gambar.
  - 💾 **LocalStorage**: Semua gambar otomatis tersimpan per simbol & timeframe.
- **WebSocket Auto-Reconnect**: Otomatis mencoba menyambung kembali setiap 3 detik jika koneksi terputus.

---

## 4. Contoh Request cURL & Testing

### 1. Ambil Historical Candles (OHLCV)
```bash
# Crypto (Binance)
curl "http://localhost:3001/candles?symbol=BTCUSDT&exchange=BINANCE&tf=5m&limit=100"

# Forex (OANDA)
curl "http://localhost:3001/candles?symbol=EURUSD&exchange=OANDA&tf=15m&limit=100"

# Saham Indonesia (IDX)
curl "http://localhost:3001/candles?symbol=BBCA&exchange=IDX&tf=1D&limit=100"

# Komoditi Emas (COMEX / OANDA)
curl "http://localhost:3001/candles?symbol=XAUUSD&exchange=OANDA&tf=1h&limit=100"
```

### 2. Search Pasar TradingView
```bash
# Cari simbol emas
curl "http://localhost:3001/search?q=gold"

# Cari saham IDX
curl "http://localhost:3001/search?q=BBCA&exchange=IDX"
```

### 3. Test Realtime WebSocket Stream
```bash
# Gunakan wscat
wscat -c "ws://localhost:3001/ws?symbol=BTCUSDT&exchange=BINANCE&tf=5m"
```
Respon streaming:
```json
{
  "type": "candle",
  "symbol": "BINANCE:BTCUSDT",
  "tf": "5",
  "candle": {
    "time": 1792236300,
    "open": 81597.09,
    "high": 81597.09,
    "low": 81597.08,
    "close": 81597.08,
    "volume": 0.79738
  }
}
```
