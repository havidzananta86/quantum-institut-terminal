# Panduan: shared hosting (Hostinger) + Windows VPS MT5 (penyedia lain)

Susunan akhir:

```
Pengguna ──► situs-anda.com (Hostinger shared: PHP + tampilan)
                 │  HTTPS + kunci/JWT                    ▲ cadangan bila VPS mati:
                 ▼                                       │ Binance / Twelve Data / biquote
         feed.situs-anda.com  (Windows VPS, penyedia lain)
           ├─ /tv/…  → tv-bridge  (Node.js, library TradingView-API → data OANDA)
           └─ /…     → mt5-bridge (Python + terminal MT5 → feed broker, WebSocket realtime)
```

- **Subdomain `feed`** tidak perlu dibuat di hosting. Cukup satu *DNS record* yang menunjuk ke IP VPS (Langkah 1).
- Semua kode ada di proyek ini: `mt5-bridge/`, `tv-bridge/`, `deploy/Caddyfile.windows`.
- Kerjakan berurutan. Setiap langkah punya cara memeriksa hasilnya.

---

## Jalur cepat (disarankan): satu skrip di VPS

Langkah 3–9 di bawah sudah diotomatiskan oleh `deploy/setup-vps.ps1`. Rahasia (kunci JWT dan kunci bridge) dibuat
**di VPS-mu sendiri** dan tidak pernah lewat chat. Yang tetap kamu lakukan sendiri hanya DNS (Langkah 1),
firewall panel penyedia (Langkah 2), dan menempel hasil ke Hostinger.

1. Selesaikan **Langkah 1 (DNS)** dan buka port 80 dan 443 di panel penyedia VPS (**Langkah 2**).
2. Di PC-mu ada berkas `qim-vps-bundle.zip` (di folder proyek). Salin ke VPS lewat RDP (drag & drop), lalu ekstrak
   isinya ke `C:\qim` sehingga ada `C:\qim\mt5-bridge`, `C:\qim\tv-bridge`, dan `C:\qim\deploy`.
3. Pastikan terminal MT5 **Valetax** sedang terbuka dan login. Di PowerShell **sebagai Administrator** di VPS:

   ```powershell
   Set-ExecutionPolicy -Scope Process Bypass -Force
   C:\qim\deploy\setup-vps.ps1 -Domain feed.situs-anda.com -SiteOrigins https://situs-anda.com,https://www.situs-anda.com
   ```

   Tambahkan `-CheckOnly` lebih dulu bila ingin memeriksa tanpa memasang apa pun.
   Skrip memasang Python, Node.js, dan Caddy dari situs resmi (tanda tangan/checksum diverifikasi), menulis `.env`,
   membuka firewall Windows, membuat tugas startup, lalu menguji kedua bridge.
4. Buka `C:\qim\hostinger-config.txt`, salin isinya, tempel ke `config/api_keys.php` di Hostinger (File Manager), simpan.
5. Uji dari PC-mu: `https://feed.situs-anda.com/health` dan `https://feed.situs-anda.com/tv/health`.

Bila skrip berhenti dengan pesan galat, kirim pesan galatnya (bukan isi file `.env` atau `hostinger-config.txt`).

---

## Langkah 1 — DNS: buat `feed.situs-anda.com` → IP VPS

1. Catat **IP publik VPS** (dari panel penyedia VPS-mu).
2. Di Hostinger (hPanel) buka pengaturan **DNS / DNS Zone** untuk domainmu (nama menunya bisa sedikit berbeda), lalu tambah record:

   | Type | Name | Points to | TTL |
   |---|---|---|---|
   | A | `feed` | IP publik VPS | 300 |

   (Jika nameserver domainmu bukan milik Hostinger, tambahkan record yang sama di tempat DNS-nya berada.)
3. Tunggu 5–30 menit, lalu dari PC-mu: `nslookup feed.situs-anda.com` → harus menampilkan IP VPS.

## Langkah 2 — Firewall VPS: buka port 80 dan 443

Caddy butuh keduanya untuk mengambil sertifikat HTTPS gratis. Port bridge (3001, 8000) **tidak** dibuka ke internet.

PowerShell sebagai Administrator di VPS:

```powershell
New-NetFirewallRule -DisplayName "QIM HTTP"  -Direction Inbound -Protocol TCP -LocalPort 80  -Action Allow
New-NetFirewallRule -DisplayName "QIM HTTPS" -Direction Inbound -Protocol TCP -LocalPort 443 -Action Allow
```

Bila penyedia VPS punya firewall sendiri di panelnya, buka juga port 80 dan 443 di sana.
Jika port **tidak bisa dibuka** sama sekali, pakai Cloudflare Tunnel (kabari saya; langkahnya berbeda).

## Langkah 3 — Pasang perangkat lunak di VPS

| Perangkat lunak | Catatan |
|---|---|
| **Python 3.12 (64-bit)** | Centang *Add python.exe to PATH*. Cek: `python -c "import struct;print(struct.calcsize('P')*8)"` → `64` |
| **Node.js LTS (18 ke atas)** | Cek: `node -v` |
| **NSSM** (nssm.cc/download) | Ekstrak ke `C:\tools\nssm\` — untuk menjadikan bridge sebagai Windows service |
| **Caddy** (caddyserver.com/download, Windows amd64) | Simpan sebagai `C:\caddy\caddy.exe` |

## Langkah 4 — Salin proyek ke VPS

Di PC-mu, zip folder **`mt5-bridge`**, **`tv-bridge`** (tanpa `node_modules`), dan **`deploy`**. Salin lewat RDP (drag & drop atau clipboard) ke:

```
C:\qim\mt5-bridge
C:\qim\tv-bridge
C:\caddy\Caddyfile        ← isi dari deploy\Caddyfile.windows
```

## Langkah 5 — Terminal MT5

1. Login ke akun broker di terminal MT5. Aktifkan **Tools → Options → Expert Advisors → Allow algorithmic trading**.
2. Buka **Market Watch**, catat **nama persis** simbol emas, BTC, dan forex di broker-mu (contoh: `XAUUSDm`, `BTCUSD#`, `EURUSD.pro`). Nama ini dipakai di `SYMBOLS` (Langkah 6).
3. Agar tetap hidup setelah VPS restart: atur **auto-login Windows** dan taruh pintasan MT5 di folder *Startup*.
   Bridge hanya jalan bila terminal MT5 terbuka di sesi Windows yang sama.

## Langkah 6 — mt5-bridge (Python)

Buat dua rahasia acak (simpan, dipakai lagi di Langkah 9):

```powershell
python -c "import secrets; print(secrets.token_urlsafe(48))"   # → BRIDGE_JWT_SECRET (QI_MT5_BRIDGE_SECRET)
```

```powershell
cd C:\qim\mt5-bridge
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
notepad .env
```

Isi `.env` (yang lain biarkan):

```ini
BRIDGE_JWT_SECRET=<rahasia dari atas, min 32 karakter>
ALLOWED_ORIGINS=https://situs-anda.com,https://www.situs-anda.com
SYMBOLS=XAUUSD:XAUUSDm,BTCUSDT:BTCUSD#,EURUSD:EURUSDm,GBPUSD:GBPUSDm,USDJPY:USDJPYm
BROKER_TZ_OFFSET_H=auto       # selisih jam server broker terhadap UTC; 'auto' mengikuti DST broker
HOST=127.0.0.1
```

### Contoh untuk VPS-mu (Valetax-Live2, dari screenshot Market Watch)

Nama simbol di brokermu: forex **tanpa** akhiran, emas dan BTC memakai akhiran `.vx`.

```ini
SYMBOLS=XAUUSD:XAUUSD.vx,BTCUSDT:BTCUSD.vx,EURUSD:EURUSD,GBPUSD:GBPUSD,USDJPY:USDJPY,AUDUSD:AUDUSD,NZDUSD:NZDUSD,USDCHF:USDCHF,USDCAD:USDCAD
BROKER_TZ_OFFSET_H=auto
MT5_PATH=C:\Program Files\<folder MT5 Valetax>\terminal64.exe
```

- `BROKER_TZ_OFFSET_H=auto`: zona waktu server broker dideteksi dari tick yang bergerak, jadi ikut berpindah
  saat DST broker berakhir (±25 Oktober) tanpa kamu mengubah apa pun. Saat ini kira-kira UTC+3.
  `/health` menampilkan nilai yang terdeteksi di `broker_tz_offset_h`.
- Di VPS-mu terpasang **dua terminal MT5** (ada akun Exness dan Valetax). Isi `MT5_PATH` dengan path
  `terminal64.exe` milik **Valetax** (lihat di Properties → Target pada pintasan MT5 Valetax di taskbar), supaya bridge tidak menempel ke terminal yang salah. Terminal itu harus yang
  sedang login ke ValetaxIntl-Live2.
- Pasangan lain (GBPJPY, EURJPY, dst.) bisa ditambahkan ke `SYMBOLS` bila ada di brokermu; bridge otomatis
  memasukkannya ke Market Watch, dan mencatat peringatan di log bila namanya tidak ada.
- Forex dan emas diam di akhir pekan (tidak ada tick baru) — itu normal; BTC tetap bergerak.

Uji: `python main.py`, lalu di browser VPS buka `http://127.0.0.1:8000/health` → harus `"connected": true`.
Hentikan (Ctrl+C), lalu pasang sebagai service:

```powershell
.\scripts\install-windows-service.ps1 -Nssm C:\tools\nssm\win64\nssm.exe
```

**Penting:** di `services.msc` → `QimMt5Bridge` → tab *Log On* → pilih **user Windows yang sama** dengan yang menjalankan MT5. Lalu: `& C:\tools\nssm\win64\nssm.exe start QimMt5Bridge`.

## Langkah 7 — tv-bridge (Node.js)

```powershell
cd C:\qim\tv-bridge
npm ci --omit=dev
python -c "import secrets; print(secrets.token_urlsafe(32))"   # → BRIDGE_KEY
notepad .env
```

`.env`:

```ini
TV_BRIDGE_PORT=3001
TV_BRIDGE_HOST=127.0.0.1
BRIDGE_KEY=<kunci dari atas, min 16 karakter>
```

```powershell
.\scripts\install-windows-service.ps1 -Nssm C:\tools\nssm\win64\nssm.exe
& C:\tools\nssm\win64\nssm.exe start QimTvBridge
curl http://127.0.0.1:3001/health        # {"status":"ok","quoteStream":true,...}
```

## Langkah 8 — Caddy (HTTPS)

1. Edit `C:\caddy\Caddyfile`: ganti `feed.GANTI-DOMAIN-ANDA.com` dengan subdomainmu.
2. Uji sekali: `cd C:\caddy; .\caddy.exe run --config Caddyfile` — saat pertama kali Caddy mengambil sertifikat (butuh DNS Langkah 1 dan port Langkah 2).
3. Jadikan service:

```powershell
C:\tools\nssm\win64\nssm.exe install Caddy C:\caddy\caddy.exe run --config C:\caddy\Caddyfile
C:\tools\nssm\win64\nssm.exe set Caddy AppDirectory C:\caddy
C:\tools\nssm\win64\nssm.exe start Caddy
```

**Periksa dari PC-mu (bukan dari VPS):**

```
curl https://feed.situs-anda.com/health                      → JSON mt5-bridge, "connected": true
curl https://feed.situs-anda.com/tv/health                   → {"status":"ok",...}
curl https://feed.situs-anda.com/tv/quotes?symbols=XAUUSD    → 401 (benar: tanpa kunci ditolak)
```

## Langkah 9 — Hostinger: isi `config/api_keys.php`

Di File Manager Hostinger, buka `config/api_keys.php` (salin dari `api_keys.php.example` bila belum ada). Tambahkan:

```php
// Data OANDA lewat library TradingView-API
define('QI_TV_BRIDGE_URL', 'https://feed.situs-anda.com/tv');
define('QI_TV_BRIDGE_KEY', '<BRIDGE_KEY dari Langkah 7>');

// Feed broker MT5 (hanya PRO/VIP/admin)
define('QI_MT5_BRIDGE_URL', 'wss://feed.situs-anda.com');
define('QI_MT5_BRIDGE_SECRET', '<BRIDGE_JWT_SECRET dari Langkah 6>');
define('QI_MT5_BRIDGE_AUDIENCE', 'pro');
define('QI_MT5_BRIDGE_SYMBOLS', 'XAUUSD,BTCUSDT,EURUSD,GBPUSD,USDJPY,AUDUSD,NZDUSD,USDCHF,USDCAD');
```

Pastikan folder `cache/` bisa ditulis (izin 755 atau 775).

## Langkah 10 — Uji akhir

1. `https://situs-anda.com/api/get-chart-data.php?symbol=XAUUSD&interval=60` → `"source":"oanda_tv"` (pengunjung tanpa login).
2. Login sebagai akun PRO/admin, buka dashboard → chart dan harga XAUUSD berasal dari broker MT5, dan label status menjadi **LIVE · MT5**.
3. Matikan service `QimMt5Bridge` sebentar → dalam ±20 detik dashboard kembali ke OANDA; matikan `QimTvBridge` juga → kembali ke sumber cadangan. Nyalakan lagi.

---

## Perawatan dan keamanan

- **Jangan** membuka port 3001 dan 8000 di firewall. Hanya 80 dan 443 (Caddy).
- Simpan `BRIDGE_JWT_SECRET`, `BRIDGE_KEY`, dan isi `.env` — jangan masuk git dan jangan dikirim lewat chat.
- Pantau: `https://feed.situs-anda.com/health` (cek `"connected": true` dan `"stale": []`). Tick tidak masuk di akhir pekan itu normal untuk emas dan forex.
- Log: `C:\qim\mt5-bridge\logs\bridge.log`, `C:\qim\tv-bridge\logs\bridge.log`, `C:\caddy\access.log`.
- Update kode: salin file baru, lalu `nssm restart QimMt5Bridge` / `QimTvBridge`.

## Catatan hukum

- Feed broker MT5 yang dibagikan ke banyak pelanggan bisa melanggar ketentuan broker. Baca syaratnya, atau ubah `QI_MT5_BRIDGE_AUDIENCE` menjadi `'owner'` (hanya pemilik akun).
- Library TradingView-API tidak resmi dan melanggar ketentuan TradingView; IP VPS bisa dibatasi.
