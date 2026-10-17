<#
.SYNOPSIS
  Membuka kedua bridge (mt5-bridge + tv-bridge) ke internet lewat Tailscale Funnel.

.DESCRIPTION
  Untuk VPS di belakang NAT (tanpa IP publik sendiri), port 80/443 dari internet tidak sampai ke VPS,
  sehingga sertifikat Let's Encrypt tidak bisa terbit. Tailscale Funnel membuka sambungan KELUAR dari VPS
  dan memberi alamat HTTPS publik yang valid (https://<nama-vps>.<tailnet>.ts.net), tanpa port masuk dan
  tanpa mengubah DNS domain.

  Prasyarat (dilakukan pengguna sendiri, satu kali):
    1. Pasang Tailscale untuk Windows: https://tailscale.com/download/windows
    2. Login dari ikon Tailscale di taskbar (akun pribadi kamu).

  Jalankan di PowerShell sebagai Administrator:
    Set-ExecutionPolicy -Scope Process Bypass -Force
    & "C:\Program Files\qim\deploy\setup-tailscale.ps1"

  Yang dilakukan (aman diulang):
    1. Mengubah Caddy menjadi router LOKAL di 127.0.0.1:8080 (/tv -> tv-bridge, sisanya -> mt5-bridge).
       Caddyfile lama disimpan sebagai Caddyfile.publik.bak.
    2. Menyalakan ulang tugas 'QIM Caddy' dan menguji kedua bridge lewat router lokal.
    3. Menyalakan Tailscale Funnel ke port 8080.
    4. Menulis konfigurasi Hostinger (alamat baru + kunci yang sudah ada) ke hostinger-config.txt.
#>
#Requires -RunAsAdministrator
param([string]$Root = '')

$ErrorActionPreference = 'Stop'
function Step($t) { Write-Host "`n== $t" -ForegroundColor Cyan }
function Ok($t)   { Write-Host "   OK  $t" -ForegroundColor Green }
function Warn($t) { Write-Host "   !   $t" -ForegroundColor Yellow }

function Get-EnvValue([string]$file, [string]$name) {
    if (-not (Test-Path $file)) { return $null }
    $line = Select-String -Path $file -Pattern ("^\s*{0}=(.*)$" -f [regex]::Escape($name)) | Select-Object -First 1
    if ($line) { return $line.Matches[0].Groups[1].Value.Trim() }
    return $null
}

# ---------------------------------------------------------------- 1. Lokasi & Tailscale
Step '1. Pemeriksaan'
if (-not $Root) {
    foreach ($c in 'C:\qim', 'C:\Program Files\qim') { if (Test-Path "$c\mt5-bridge\.env") { $Root = $c; break } }
}
if (-not $Root -or -not (Test-Path "$Root\mt5-bridge\.env") -or -not (Test-Path "$Root\tv-bridge\.env")) {
    throw 'Folder bridge (dengan .env) tidak ditemukan. Jalankan setup-vps.ps1 dulu, atau beri -Root "<folder qim>".'
}
Ok "folder bridge: $Root"

$ts = 'C:\Program Files\Tailscale\tailscale.exe'
if (-not (Test-Path $ts)) {
    $cmd = Get-Command tailscale -ErrorAction SilentlyContinue
    if ($cmd) { $ts = $cmd.Source }
}
if (-not (Test-Path $ts)) {
    Warn 'Tailscale belum terpasang.'
    Write-Host '   1. Unduh dan pasang: https://tailscale.com/download/windows'
    Write-Host '   2. Login dari ikon Tailscale di taskbar (pojok kanan bawah).'
    Write-Host '   3. Jalankan skrip ini lagi.'
    return
}
$status = $null
try { $status = (& $ts status --json) -join "`n" | ConvertFrom-Json } catch { }
if (-not $status -or $status.BackendState -ne 'Running') {
    Warn 'Tailscale terpasang tetapi BELUM login / belum tersambung.'
    Write-Host '   Klik ikon Tailscale di taskbar -> Log in, selesaikan login di browser, lalu jalankan skrip ini lagi.'
    return
}
$hostName = ([string]$status.Self.DNSName).TrimEnd('.')
Ok "Tailscale tersambung sebagai $hostName"

# ---------------------------------------------------------------- 2. Caddy sebagai router lokal
Step '2. Caddy: router lokal 127.0.0.1:8080'
$caddyDir = 'C:\caddy'
if (-not (Test-Path "$caddyDir\caddy.exe")) { throw "Caddy tidak ditemukan di $caddyDir. Jalankan setup-vps.ps1 dulu." }
if ((Test-Path "$caddyDir\Caddyfile") -and -not (Test-Path "$caddyDir\Caddyfile.publik.bak")) {
    Copy-Item "$caddyDir\Caddyfile" "$caddyDir\Caddyfile.publik.bak"
    Ok 'Caddyfile lama disimpan: Caddyfile.publik.bak'
}
$caddyfile = @'
# Router LOKAL untuk Tailscale Funnel (dibuat oleh setup-tailscale.ps1).
# Tailscale Funnel menerima HTTPS dari internet lalu meneruskan ke sini; Caddy tidak terbuka ke internet.
{
	auto_https off
}

:8080 {
	bind 127.0.0.1
	# /tv/...  -> tv-bridge (awalan /tv dibuang: /tv/quotes menjadi /quotes)
	handle_path /tv/* {
		reverse_proxy 127.0.0.1:3001
	}
	# sisanya -> mt5-bridge (WebSocket /ws/harga, REST /api/candles dan /api/quotes, /health)
	handle {
		reverse_proxy 127.0.0.1:8000
	}
	log {
		output file C:\caddy\access.log {
			roll_size 10mb
			roll_keep 5
		}
	}
}
'@
Set-Content -Path "$caddyDir\Caddyfile" -Value $caddyfile -Encoding ASCII
$prev = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
& "$caddyDir\caddy.exe" validate --config "$caddyDir\Caddyfile" --adapter caddyfile 2>&1 | Select-Object -Last 1 | ForEach-Object { Write-Host "   $_" }
$validExit = $LASTEXITCODE
$ErrorActionPreference = $prev
if ($validExit -ne 0) { throw 'Caddyfile lokal tidak valid.' }

Stop-ScheduledTask -TaskName 'QIM Caddy' -ErrorAction SilentlyContinue
Get-Process caddy -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep 2
if (Get-ScheduledTask -TaskName 'QIM Caddy' -ErrorAction SilentlyContinue) {
    Start-ScheduledTask -TaskName 'QIM Caddy'
} else {
    throw "Tugas 'QIM Caddy' tidak ada. Jalankan setup-vps.ps1 dulu."
}
Start-Sleep 5
$okMt5 = $false; $okTv = $false
try { $h = Invoke-RestMethod -Uri 'http://127.0.0.1:8080/health' -TimeoutSec 10; $okMt5 = $true; Ok "mt5-bridge lewat router: connected=$($h.connected)" } catch { Warn "mt5-bridge lewat router tidak menjawab: $($_.Exception.Message)" }
try { $t = Invoke-RestMethod -Uri 'http://127.0.0.1:8080/tv/health' -TimeoutSec 10; $okTv = $true; Ok "tv-bridge lewat router: status=$($t.status)" } catch { Warn "tv-bridge lewat router tidak menjawab: $($_.Exception.Message)" }
if (-not ($okMt5 -and $okTv)) { Warn 'Periksa tugas QIM MT5 Bridge / QIM TV Bridge di Task Scheduler sebelum lanjut.' }

# ---------------------------------------------------------------- 3. Tailscale Funnel
Step '3. Tailscale Funnel -> 127.0.0.1:8080'
Write-Host '   Jika muncul tautan login.tailscale.com: buka di browser, klik Enable, lalu tunggu di sini.'
$prev = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
# Jangan tangkap keluarannya: bila Funnel belum diizinkan, perintah ini menampilkan tautan lalu MENUNGGU.
& $ts funnel --bg 8080
$funnelExit = $LASTEXITCODE
$status = (& $ts funnel status 2>&1 | Out-String)
$ErrorActionPreference = $prev
if ($funnelExit -ne 0 -or $status -notmatch 'Funnel on|Available on the internet') {
    Write-Host ($status.Trim() -replace '(?m)^', '   ')
    Warn 'Funnel belum aktif. Buka tautan login.tailscale.com di atas, klik Enable, lalu jalankan skrip ini lagi.'
    return
}
Ok "Funnel aktif: https://$hostName"

# ---------------------------------------------------------------- 4. Konfigurasi Hostinger
Step '4. Konfigurasi untuk Hostinger'
$jwt   = Get-EnvValue "$Root\mt5-bridge\.env" 'BRIDGE_JWT_SECRET'
$tvKey = Get-EnvValue "$Root\tv-bridge\.env"  'BRIDGE_KEY'
if (-not $jwt -or -not $tvKey) { throw 'Kunci di .env tidak ditemukan. Jalankan setup-vps.ps1 dulu.' }
$me = "$env:USERDOMAIN\$env:USERNAME"
$block = @"
// -- Hostinger: buat config/bridge.php, baris pertama <?php, lalu tempel blok ini di bawahnya. --
define('QI_TV_BRIDGE_URL', 'https://$hostName/tv');
define('QI_TV_BRIDGE_KEY', '$tvKey');

define('QI_MT5_BRIDGE_URL', 'wss://$hostName');
define('QI_MT5_BRIDGE_SECRET', '$jwt');
define('QI_MT5_BRIDGE_AUDIENCE', 'pro');
define('QI_MT5_BRIDGE_SYMBOLS', 'XAUUSD,BTCUSDT,EURUSD,GBPUSD,USDJPY,AUDUSD,NZDUSD,USDCHF,USDCAD');
"@
$out = "$Root\hostinger-config.txt"
Set-Content -Path $out -Value $block -Encoding ASCII
& icacls $out /inheritance:r /grant:r "${me}:(R,W)" "Administrators:(F)" 2>&1 | Out-Null
Ok "ditulis: $out"

Write-Host "`n==============================================================" -ForegroundColor Green
Write-Host ' SELESAI di VPS.' -ForegroundColor Green
Write-Host "   Alamat publik bridge:  https://$hostName"
Write-Host "   Uji dari PC-mu:        https://$hostName/health   dan   https://$hostName/tv/health"
Write-Host '   Kirim ke Claude HANYA nama alamat di atas (bukan isi hostinger-config.txt).'
Write-Host '==============================================================' -ForegroundColor Green
