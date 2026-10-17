# QIM MT5 Bridge

Mengalirkan tick MetaTrader 5 ke chart dashboard QIM secara realtime lewat WebSocket.

```
terminal64.exe ──IPC──▶ bridge Python (FastAPI) ──wss──▶ nginx ──▶ browser
   (Windows VPS)         poll tiap 100 ms                    qim-mt5-socket.js
                         batch tiap 100 ms                   → window.qiRealtimeTick()
                                                             → _lwSeries.update() (candle terakhir)
PHP (Hostinger) ── api/mt5-bridge-token.php ── token JWT 5 menit ──▶ browser ──▶ bridge
```

- Chart hanya memperbarui **candle terakhir** (`_lwSeries.update`), tidak menggambar ulang.
- Bila bridge mati, tidak dikonfigurasi, atau pengguna tidak berhak, dashboard otomatis
  tetap memakai polling yang sudah ada (EA → `api/tick.php`, live-price). Tidak ada harga mati.
- Selama socket mengirim tick (≤ 3 detik terakhir), sumber lain untuk simbol yang sama
  diabaikan agar harga tidak "meloncat mundur".

## Struktur

```
mt5-bridge/
├── bridge/
│   ├── config.py      # pengaturan dari environment (.env)
│   ├── auth.py        # verifikasi token HS256 dari PHP
│   ├── source.py      # MT5Source (terminal asli) + MockSource (khusus development)
│   ├── hub.py         # fan-out tick, throttle per klien, putuskan klien lambat
│   └── app.py         # FastAPI: poller thread, /ws/harga, /api/candles, /health
├── tests/             # pytest (tanpa terminal MT5: modul MetaTrader5 dipalsukan)
├── nginx/             # reverse proxy produksi + dev
├── scripts/install-windows-service.ps1
├── Dockerfile, docker-compose.yml   # development/CI saja (lihat catatan)
└── main.py
```

Di sisi webapp: `api/mt5-bridge-token.php` dan `assets/js/qim-mt5-socket.js`
(dimuat oleh `dashboard.html`).

## Catatan penting soal Docker

Paket Python `MetaTrader5` **hanya ada untuk Windows** dan berkomunikasi dengan
`terminal64.exe` yang berjalan di mesin yang sama (IPC). Karena itu:

- **Produksi**: bridge berjalan *native* di Windows VPS yang sama dengan terminal MT5,
  sebagai Windows service (NSSM), di belakang nginx (atau proxy Linux di depannya).
- **Docker** (image Linux) hanya untuk development/CI dengan `MT5_MOCK=1`. Konfigurasi
  menolak mode mock di luar `BRIDGE_ENV=development`, dan setiap tick mock berlabel `src: "mock"`.

## Setup produksi (Windows VPS)

1. Instal MetaTrader 5, login ke akun broker, aktifkan **Tools → Options → Expert Advisors →
   Allow algorithmic trading** (diperlukan agar API Python boleh terhubung). Biarkan terminal tetap berjalan.
2. Instal Python 3.12 (64-bit), lalu:
   ```powershell
   cd mt5-bridge
   python -m venv .venv; .\.venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   copy .env.example .env   # isi BRIDGE_JWT_SECRET, ALLOWED_ORIGINS, SYMBOLS, BROKER_TZ_OFFSET_H
   python main.py           # uji dulu: http://127.0.0.1:8000/health → "connected": true
   ```
3. Jadikan service: `.\scripts\install-windows-service.ps1 -Nssm C:\tools\nssm\win64\nssm.exe`
   — jalankan service sebagai **user Windows yang sama** dengan terminal MT5.
4. Pasang nginx + sertifikat TLS (Let's Encrypt, mis. via win-acme di Windows), pakai
   `nginx/qim-bridge.conf`. Buka hanya port 443 di firewall; port 8000 tetap lokal.
5. Di server PHP, tambahkan ke `config/api_keys.php` (file ini gitignored):
   ```php
   define('QI_MT5_BRIDGE_URL', 'wss://bridge.quantum-institut.com');
   define('QI_MT5_BRIDGE_SECRET', '...sama persis dengan BRIDGE_JWT_SECRET...');
   define('QI_MT5_BRIDGE_ACCOUNT', '12345678');   // nomor login MT5 terminal bridge
   define('QI_MT5_BRIDGE_AUDIENCE', 'owner');     // 'owner' (bawaan) atau 'pro'
   define('QI_MT5_BRIDGE_SYMBOLS', 'XAUUSD,EURUSD,BTCUSDT');
   ```
   - `owner`: hanya pengguna yang punya baris `trading_accounts` (provider MT*) dengan
     `account_reference` = `QI_MT5_BRIDGE_ACCOUNT`, plus admin — aturan yang sama dengan
     `qi_broker_tick()`: harga broker milik seseorang tidak dibagikan ke pengguna lain.
   - `pro`: semua pengguna PRO/VIP/admin.
6. Buka dashboard: label status berubah menjadi **LIVE · MT5**, dan
   `QIMMT5Socket.state()` di console menampilkan `state: "live"`.

## Development lokal (tanpa terminal MT5)

```powershell
cd mt5-bridge
$env:BRIDGE_ENV='development'; $env:MT5_MOCK='1'
$env:BRIDGE_JWT_SECRET='dev-secret-dev-secret-dev-secret-1234'
$env:ALLOWED_ORIGINS='http://localhost'
python main.py
```
Lalu di `config/api_keys.php` XAMPP: `QI_MT5_BRIDGE_URL = 'ws://127.0.0.1:8000'` (ws:// hanya
diterima PHP saat development) dan secret yang sama. Docker: buat sertifikat dev di
`nginx/certs/dev.crt|dev.key`, lalu `docker compose up --build`.

Tes: `pip install -r requirements-dev.txt` lalu `python -m pytest`.

## Protokol WebSocket `/ws/harga`

| Arah | Pesan |
|---|---|
| klien → | `{"type":"auth","token":"<jwt>"}` — wajib dalam 5 detik pertama (token **tidak** di URL agar tidak tercatat di log proxy) |
| ← server | `{"type":"ready","symbols":[...],"exp":<unix>,"source":"mt5","throttle_ms":100}` |
| ← server | `{"type":"ticks","data":[{"s":"XAUUSD","bid":..,"ask":..,"spread":..,"t":<ms broker>,"src":"mt5"}]}` — paling sering 1 batch / 100 ms, hanya tick yang berubah |
| klien → | `{"type":"subscribe","symbols":["XAUUSD"]}` → `{"type":"subscribed",...}` + snapshot |
| klien → | `{"type":"auth","token":"<jwt baru>"}` → `{"type":"renewed","exp":..}` (perpanjang tanpa putus; user harus sama) |
| klien → | `{"type":"ping"}` → `{"type":"pong"}` |

Kode tutup: `4401` token tidak sah/kedaluwarsa (klien meminta token baru lalu sambung ulang),
`4403` origin/izin ditolak (klien berhenti, kembali ke polling), `4408` tidak mengirim auth,
`1013` server penuh atau klien terlalu lambat.

REST: `GET /api/candles?symbol=XAUUSD&tf=H1&count=500` dengan header
`Authorization: Bearer <jwt>` → candle dari `copy_rates_from_pos` (cache 2 detik).
Dari browser: `await QIMMT5Socket.candles('XAUUSD', 'H1', 500)`.

## Troubleshooting

**`initialize() failed: (-10003, 'IPC initialize failed, MetaTrader 5 x64 not found')`**
- Terminal belum terinstal/berjalan, atau `MT5_PATH` salah. Isi `MT5_PATH` dengan path lengkap `terminal64.exe`.
- Python 32-bit tidak bisa bicara dengan terminal 64-bit: cek `python -c "import struct;print(struct.calcsize('P')*8)"` → harus 64.
- Service berjalan sebagai user lain (mis. LocalSystem) dari terminal → jalankan service sebagai user yang sama.

**`initialize()` gagal `(-6, 'Terminal: Authorization failed')`**
- `MT5_LOGIN`/`MT5_PASSWORD`/`MT5_SERVER` salah. Nama server harus persis seperti di dialog login MT5 (mis. `Exness-MT5Real8`). Kosongkan ketiganya untuk memakai sesi terminal yang sudah login.

**Tick tidak masuk / `/health` menunjukkan `stale`**
- Nama simbol broker berbeda: log menulis `symbol_select(...) failed`. Cek nama persis di Market Watch (suffix `.m`, `.pro`, `#`) dan sesuaikan `SYMBOLS`.
- Pasar tutup (akhir pekan untuk forex/emas): tidak ada tick baru — itu normal; dashboard kembali ke polling.
- "Allow algorithmic trading" mati, atau terminal kehilangan koneksi ke server broker (pojok kanan bawah MT5: "No connection").
- Browser tidak menerima apa pun: lihat console. `bridge belum dikonfigurasi` → konstanta PHP belum diisi; `akun tidak terhubung` → policy `owner` dan akun Anda tidak cocok; close `4403` → `ALLOWED_ORIGINS` tidak memuat origin dashboard (harus persis, termasuk `https://` dan tanpa `/` di akhir); close `4401` berulang → secret PHP ≠ secret bridge, atau jam server berbeda jauh (sinkronkan NTP).
- WebSocket terputus tiap ±60 detik: `proxy_read_timeout` nginx terlalu kecil, atau proxy lain (Cloudflare) memutus — pastikan WebSocket diizinkan.

**Latency tinggi / chart tersendat**
- Ukur di console: `QIMMT5Socket.state().lastTickAt` vs waktu sekarang. Bila jeda besar di bridge, cek CPU VPS dan jumlah simbol (setiap simbol = satu panggilan `symbol_info_tick` per 100 ms).
- Letakkan VPS dekat server broker (ping rendah ke broker lebih penting daripada ke pengguna).
- Pastikan `proxy_buffering off` dan tidak ada kompresi/antrian di proxy untuk `/ws/`.
- Jangan turunkan `THROTTLE_MS` di bawah ~50: browser tidak menggambar lebih cepat dari ~60 fps dan chart hanya butuh tick terakhir per frame.
- Klien lambat diputus otomatis (`1013`) agar tidak menahan klien lain.

**Candle bergeser beberapa jam**
- MT5 mengembalikan waktu bar dalam zona waktu server broker. Isi `BROKER_TZ_OFFSET_H` (mis. `3` untuk GMT+3; perhatikan DST broker).

## Rekomendasi produksi

- Satu terminal = satu akun = satu bridge. Untuk banyak akun, jalankan beberapa terminal (folder
  instalasi terpisah, `MT5_PATH` berbeda) dan beberapa bridge di port berbeda.
- Pantau `/health` (status `degraded` bila terputus atau ada simbol basi) dari monitoring yang IP-nya diizinkan di nginx.
- Rotasi `BRIDGE_JWT_SECRET` = ganti di `.env` dan `config/api_keys.php` bersamaan, lalu restart service.
- Bila nanti butuh banyak instance bridge di belakang load balancer, pindahkan cache candle ke Redis dan
  gunakan pub/sub untuk tick; satu instance sudah cukup untuk ratusan klien karena tick di-batch.
- Bridge ini **hanya membaca harga** (tick + candle). Eksekusi order sengaja tidak disediakan di sini;
  eksekusi tetap lewat jalur EA yang sudah punya pengaman di webapp (`AllowRealExecution`, gerbang, jeda).
