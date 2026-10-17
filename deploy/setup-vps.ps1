<#
.SYNOPSIS
  Menyiapkan Windows VPS MT5 untuk Quantum Institut: mt5-bridge (Python) + tv-bridge (Node.js) + Caddy (HTTPS).

.DESCRIPTION
  Jalankan SEKALI di PowerShell sebagai Administrator, di VPS yang menjalankan terminal MT5:

    Set-ExecutionPolicy -Scope Process Bypass -Force
    C:\qim\deploy\setup-vps.ps1 -Domain feed.domainmu.com -SiteOrigins https://domainmu.com,https://www.domainmu.com

  Yang dilakukan (aman diulang; tidak menimpa .env yang sudah ada):
    1. Memeriksa file proyek, Python, Node.js, dan domain/IP.
    2. Memasang Python/Node.js/Caddy bila belum ada - unduhan HANYA dari situs resmi, lalu diverifikasi
       (tanda tangan digital untuk Python & Node.js, SHA-512 dari daftar checksum resmi untuk Caddy).
    3. Membuat rahasia acak LANGSUNG DI VPS ini (tidak lewat chat/perantara) dan menulis .env kedua bridge.
    4. Membuka firewall port 80 & 443 saja (bridge tetap hanya di 127.0.0.1).
    5. Membuat tugas startup (jalan otomatis saat user ini login - sama dengan user yang menjalankan MT5).
    6. Menguji kedua bridge, lalu menulis blok konfigurasi untuk Hostinger ke C:\qim\hostinger-config.txt.

  Gunakan -CheckOnly untuk hanya memeriksa tanpa memasang atau mengubah apa pun.
#>
#Requires -RunAsAdministrator
param(
    [Parameter(Mandatory = $true)][string]$Domain,        # contoh: feed.domainmu.com
    [Parameter(Mandatory = $true)][string[]]$SiteOrigins, # contoh: https://domainmu.com,https://www.domainmu.com
    [string]$Root = 'C:\qim',
    [string]$CaddyDir = 'C:\caddy',
    [string]$Mt5Path = '',
    [string]$Symbols = 'XAUUSD:XAUUSD.vx,BTCUSDT:BTCUSD.vx,EURUSD:EURUSD,GBPUSD:GBPUSD,USDJPY:USDJPY,AUDUSD:AUDUSD,NZDUSD:NZDUSD,USDCHF:USDCHF,USDCAD:USDCAD',
    [string]$PythonVersion = '3.12.8',
    [string]$NodeVersion = '20.18.1',
    [switch]$CheckOnly
)

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$ProgressPreference = 'SilentlyContinue'

function Step($text) { Write-Host "`n== $text" -ForegroundColor Cyan }
function Ok($text)   { Write-Host "   OK  $text" -ForegroundColor Green }
function Warn($text) { Write-Host "   !   $text" -ForegroundColor Yellow }
function Fail($text) { Write-Host "   X   $text" -ForegroundColor Red }

function Refresh-Path {
    $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
}

function New-Secret([int]$bytes) {
    $buf = New-Object byte[] $bytes
    $rng = New-Object System.Security.Cryptography.RNGCryptoServiceProvider
    $rng.GetBytes($buf); $rng.Dispose()
    return ([Convert]::ToBase64String($buf)).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

function Get-EnvValue([string]$file, [string]$name) {
    if (-not (Test-Path $file)) { return $null }
    $line = Select-String -Path $file -Pattern ("^\s*{0}=(.*)$" -f [regex]::Escape($name)) | Select-Object -First 1
    if ($line) { return $line.Matches[0].Groups[1].Value.Trim() }
    return $null
}

function Download-Verified([string]$url, [string]$dest, [string]$publisherLike) {
    Write-Host "   unduh: $url"
    Invoke-WebRequest -Uri $url -OutFile $dest -UseBasicParsing -TimeoutSec 600
    $sig = Get-AuthenticodeSignature $dest
    if ($sig.Status -ne 'Valid' -or $sig.SignerCertificate.Subject -notlike $publisherLike) {
        Remove-Item $dest -Force -ErrorAction SilentlyContinue
        throw "Tanda tangan berkas tidak valid ($($sig.Status); $($sig.SignerCertificate.Subject)). Dibatalkan demi keamanan."
    }
    Ok "tanda tangan valid: $($sig.SignerCertificate.Subject.Split(',')[0])"
}

# ----------------------------- 1. Pemeriksaan -----------------------------
Refresh-Path   # ambil PATH terbaru (Python/Node.js yang baru dipasang pada percobaan sebelumnya)
Step '1. Pemeriksaan awal'
$needFiles = @("$Root\mt5-bridge\main.py", "$Root\mt5-bridge\requirements.txt", "$Root\tv-bridge\server.js", "$Root\tv-bridge\package.json", "$Root\deploy\Caddyfile.windows")
$missing = $needFiles | Where-Object { -not (Test-Path $_) }
if ($missing) { $missing | ForEach-Object { Fail "tidak ada: $_" }; throw "Salin folder mt5-bridge, tv-bridge, dan deploy ke $Root dulu (lihat PANDUAN-DEPLOY-VPS.md Langkah 4)." }
Ok "file proyek lengkap di $Root"

$origins = ($SiteOrigins | ForEach-Object { $_.Trim().TrimEnd('/') }) -join ','
if ($origins -notmatch '^https://') { throw 'SiteOrigins harus berawalan https:// (contoh: https://domainmu.com)' }

try {
    $publicIp = (Invoke-RestMethod -Uri 'https://api.ipify.org' -TimeoutSec 15).Trim()
    $dns = @(Resolve-DnsName -Name $Domain -Type A -ErrorAction Stop | Where-Object { $_.Type -eq 'A' } | ForEach-Object { $_.IPAddress })
    if ($dns -contains $publicIp) { Ok "DNS $Domain -> $publicIp (cocok dengan IP VPS ini)" }
    else { Warn "DNS $Domain menunjuk ke [$($dns -join ', ')], IP publik VPS ini $publicIp. Caddy tidak akan mendapat sertifikat sebelum DNS benar (Langkah 1 panduan)." }
} catch { Warn "Tidak bisa memeriksa DNS/IP: $($_.Exception.Message)" }

$py = Get-Command python -ErrorAction SilentlyContinue
$node = Get-Command node -ErrorAction SilentlyContinue
if ($py)   { Ok "Python: $(& python --version 2>&1)" }   else { Warn 'Python belum terpasang' }
if ($node) { Ok "Node.js: $(& node --version 2>&1)" }    else { Warn 'Node.js belum terpasang' }
if (Test-Path "$CaddyDir\caddy.exe") { Ok 'Caddy terpasang' } else { Warn 'Caddy belum terpasang' }

if (-not $Mt5Path) {
    $procs = @(Get-Process -Name terminal64 -ErrorAction SilentlyContinue | Where-Object { $_.Path } | Select-Object -ExpandProperty Path -Unique)
    if ($procs.Count -eq 1) { $Mt5Path = $procs[0]; Ok "terminal MT5 yang sedang berjalan: $Mt5Path" }
    elseif ($procs.Count -gt 1) { $procs | ForEach-Object { Warn "terminal MT5 berjalan: $_" }; throw 'Ada lebih dari satu terminal MT5. Ulangi dengan -Mt5Path "<path terminal64.exe milik Valetax>".' }
    else { throw 'Tidak ada terminal64.exe yang berjalan. Buka MT5 (login Valetax) dulu, atau beri -Mt5Path.' }
}
if (-not (Test-Path $Mt5Path)) { throw "MT5_PATH tidak ditemukan: $Mt5Path" }

if ($CheckOnly) { Write-Host "`n-CheckOnly: tidak ada yang dipasang atau diubah." -ForegroundColor Cyan; return }

# ----------------------------- 2. Instalasi -----------------------------
Step '2. Python, Node.js, Caddy'
$tmp = Join-Path $env:TEMP 'qim-setup'
New-Item -ItemType Directory -Force $tmp | Out-Null

if (-not $py) {
    $f = "$tmp\python-$PythonVersion-amd64.exe"
    Download-Verified "https://www.python.org/ftp/python/$PythonVersion/python-$PythonVersion-amd64.exe" $f '*Python Software Foundation*'
    Start-Process $f -ArgumentList '/quiet', 'InstallAllUsers=1', 'PrependPath=1', 'Include_test=0' -Wait
    Refresh-Path
}
if (-not $node) {
    $f = "$tmp\node-v$NodeVersion-x64.msi"
    Download-Verified "https://nodejs.org/dist/v$NodeVersion/node-v$NodeVersion-x64.msi" $f '*OpenJS Foundation*'
    Start-Process msiexec.exe -ArgumentList '/i', "`"$f`"", '/qn', '/norestart' -Wait
    Refresh-Path
}
if (-not (Get-Command python -ErrorAction SilentlyContinue)) { throw 'Python belum terdeteksi setelah instalasi. Tutup dan buka lagi PowerShell, lalu jalankan skrip ini lagi.' }
if (-not (Get-Command node -ErrorAction SilentlyContinue))   { throw 'Node.js belum terdeteksi setelah instalasi. Tutup dan buka lagi PowerShell, lalu jalankan skrip ini lagi.' }
if ((& python -c "import sys; print(sys.maxsize > 2**32)") -ne 'True') { throw 'Python harus 64-bit (MetaTrader5 hanya mendukung 64-bit).' }
Ok "Python $(& python --version 2>&1), Node.js $(& node --version 2>&1)"

# Berkas Caddy lokal (disertakan di folder deploy): dipakai bila ada DAN SHA-512 cocok dengan rilis resmi
# v2.11.7 (nilai di bawah diambil dari caddy_2.11.7_checksums.txt di GitHub). Menghindari unduhan lambat.
$localCaddyZip = Join-Path $PSScriptRoot 'caddy_2.11.7_windows_amd64.zip'
$localCaddySha = 'c308154504e53755958ffc62d8a2657ab17eefd6dd25c45dbb2c3d93d29519971f77ca652f7d0f2bcb7f980b9ba3822478865e29969d0272d7613550a43152b1'
if (-not (Test-Path "$CaddyDir\caddy.exe") -and (Test-Path $localCaddyZip)) {
    $actualSha = (Get-FileHash $localCaddyZip -Algorithm SHA512).Hash.ToLower()
    if ($actualSha -eq $localCaddySha) {
        Ok 'Caddy dari berkas lokal: checksum SHA-512 cocok dengan rilis resmi v2.11.7'
        New-Item -ItemType Directory -Force $CaddyDir | Out-Null
        Expand-Archive -Path $localCaddyZip -DestinationPath $CaddyDir -Force
    } else {
        Warn 'Berkas Caddy lokal TIDAK cocok dengan checksum resmi - diabaikan, mengunduh dari GitHub.'
    }
}
if (-not (Test-Path "$CaddyDir\caddy.exe")) {
    Write-Host '   mengambil info rilis Caddy dari GitHub...'
    $rel = Invoke-RestMethod -Uri 'https://api.github.com/repos/caddyserver/caddy/releases/latest' -Headers @{ 'User-Agent' = 'qim-setup' } -TimeoutSec 60
    $zipAsset = $rel.assets | Where-Object { $_.name -like 'caddy_*_windows_amd64.zip' } | Select-Object -First 1
    $sumAsset = $rel.assets | Where-Object { $_.name -like 'caddy_*_checksums.txt' } | Select-Object -First 1
    if (-not $zipAsset -or -not $sumAsset) { throw 'Berkas rilis Caddy tidak ditemukan di GitHub.' }
    $zip = "$tmp\$($zipAsset.name)"; $sum = "$tmp\$($sumAsset.name)"
    Write-Host "   unduh: $($zipAsset.browser_download_url)"
    Invoke-WebRequest -Uri $zipAsset.browser_download_url -OutFile $zip -UseBasicParsing -TimeoutSec 600
    Invoke-WebRequest -Uri $sumAsset.browser_download_url -OutFile $sum -UseBasicParsing -TimeoutSec 120
    $expected = (Select-String -Path $sum -Pattern ([regex]::Escape($zipAsset.name)) | Select-Object -First 1).Line.Split(' ')[0].ToLower()
    $actual = (Get-FileHash $zip -Algorithm SHA512).Hash.ToLower()
    if ($expected -ne $actual) { throw "Checksum Caddy TIDAK cocok. Dibatalkan." }
    Ok "checksum SHA-512 Caddy cocok ($($rel.tag_name))"
    New-Item -ItemType Directory -Force $CaddyDir | Out-Null
    Expand-Archive -Path $zip -DestinationPath $CaddyDir -Force
}
Ok "Caddy: $CaddyDir\caddy.exe"

# ----------------------------- 3. Bridge + rahasia -----------------------------
Step '3. mt5-bridge (Python)'
$mt5Dir = "$Root\mt5-bridge"
if (-not (Test-Path "$mt5Dir\.venv\Scripts\python.exe")) { & python -m venv "$mt5Dir\.venv" }
Write-Host '   memasang paket Python (2-5 menit, tanpa tulisan sampai selesai)...'
& "$mt5Dir\.venv\Scripts\python.exe" -m pip install --quiet --upgrade pip
& "$mt5Dir\.venv\Scripts\python.exe" -m pip install --quiet -r "$mt5Dir\requirements.txt"
if ($LASTEXITCODE -ne 0) { throw 'pip install gagal.' }
$jwt = Get-EnvValue "$mt5Dir\.env" 'BRIDGE_JWT_SECRET'
if ($jwt -and $jwt.Length -ge 32) { Ok '.env mt5-bridge sudah ada - rahasia lama dipertahankan' }
else {
    $jwt = New-Secret 48
    @"
BRIDGE_JWT_SECRET=$jwt
ALLOWED_ORIGINS=$origins
SYMBOLS=$Symbols
BRIDGE_ENV=production
MT5_MOCK=0
MT5_PATH=$Mt5Path
BROKER_TZ_OFFSET_H=auto
POLL_MS=100
THROTTLE_MS=100
HOST=127.0.0.1
PORT=8000
LOG_LEVEL=INFO
"@ | Set-Content -Path "$mt5Dir\.env" -Encoding ASCII
    Ok '.env mt5-bridge dibuat (rahasia acak baru)'
}
New-Item -ItemType Directory -Force "$mt5Dir\logs" | Out-Null

Step '4. tv-bridge (Node.js, library TradingView-API)'
$tvDir = "$Root\tv-bridge"
Push-Location $tvDir
try {
    Write-Host '   memasang paket Node.js (1-3 menit)...'
    if (Test-Path "$tvDir\package-lock.json") { & npm ci --omit=dev --no-audit --no-fund } else { & npm install --omit=dev --no-audit --no-fund }
    if ($LASTEXITCODE -ne 0) { throw 'npm install gagal.' }
} finally { Pop-Location }
$tvKey = Get-EnvValue "$tvDir\.env" 'BRIDGE_KEY'
if ($tvKey -and $tvKey.Length -ge 16) { Ok '.env tv-bridge sudah ada - kunci lama dipertahankan' }
else {
    $tvKey = New-Secret 32
    @"
TV_BRIDGE_PORT=3001
TV_BRIDGE_HOST=127.0.0.1
BRIDGE_KEY=$tvKey
"@ | Set-Content -Path "$tvDir\.env" -Encoding ASCII
    Ok '.env tv-bridge dibuat (kunci acak baru)'
}
New-Item -ItemType Directory -Force "$tvDir\logs" | Out-Null

# ----------------------------- 5. Caddy + firewall -----------------------------
Step '5. Caddy (HTTPS) dan firewall'
$cf = (Get-Content "$Root\deploy\Caddyfile.windows" -Raw).Replace('feed.GANTI-DOMAIN-ANDA.com', $Domain)
Set-Content -Path "$CaddyDir\Caddyfile" -Value $cf -Encoding ASCII
# Caddy menulis lognya ke stderr; di Windows PowerShell 5.1 itu dianggap galat bila $ErrorActionPreference = Stop.
$prevEap = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
& "$CaddyDir\caddy.exe" validate --config "$CaddyDir\Caddyfile" --adapter caddyfile 2>&1 | ForEach-Object { Write-Host "   $_" }
$caddyExit = $LASTEXITCODE
$ErrorActionPreference = $prevEap
if ($caddyExit -ne 0) { throw "Caddyfile tidak valid (kode $caddyExit). Periksa $CaddyDir\Caddyfile." }
foreach ($p in 80, 443) {
    $name = "QIM Caddy $p"
    if (-not (Get-NetFirewallRule -DisplayName $name -ErrorAction SilentlyContinue)) {
        New-NetFirewallRule -DisplayName $name -Direction Inbound -Protocol TCP -LocalPort $p -Action Allow | Out-Null
    }
}
Ok 'firewall Windows: port 80 dan 443 dibuka (3001 dan 8000 TIDAK dibuka)'
Warn 'Jika penyedia VPS punya firewall di panelnya, buka juga port 80 dan 443 di sana.'

# ----------------------------- 6. Tugas startup -----------------------------
Step '6. Tugas startup (jalan otomatis saat login)'
$me = "$env:USERDOMAIN\$env:USERNAME"
$principal = New-ScheduledTaskPrincipal -UserId $me -LogonType Interactive -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RestartCount 5 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero)
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $me

function Register-Qim([string]$taskName, [string]$command, [string]$workDir) {
    $arg = "-NoProfile -WindowStyle Hidden -Command `"Set-Location '$workDir'; $command`""
    $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $arg
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
    Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    Start-ScheduledTask -TaskName $taskName
    Ok "tugas '$taskName' aktif sebagai $me"
}
Register-Qim 'QIM MT5 Bridge' "& '$mt5Dir\.venv\Scripts\python.exe' main.py *>> logs\bridge.log" $mt5Dir
Register-Qim 'QIM TV Bridge'  "& node server.js *>> logs\bridge.log" $tvDir
Register-Qim 'QIM Caddy'      "& '$CaddyDir\caddy.exe' run --config '$CaddyDir\Caddyfile' *>> '$CaddyDir\caddy.log'" $CaddyDir

# ----------------------------- 7. Uji -----------------------------
Step '7. Pengujian'
Start-Sleep -Seconds 12
try {
    $h = Invoke-RestMethod -Uri 'http://127.0.0.1:8000/health' -TimeoutSec 10
    if ($h.connected) { Ok "mt5-bridge: terhubung ke MT5 (source=$($h.source), zona waktu broker=$($h.broker_tz_offset_h))" }
    else { Warn "mt5-bridge hidup tetapi BELUM terhubung ke MT5: $($h.last_error)" }
    if ($h.stale.Count -gt 0) { Warn "simbol tanpa tick: $($h.stale -join ', ') - akhir pekan itu normal untuk forex/emas; selain itu cek nama simbol di SYMBOLS." }
} catch { Fail "mt5-bridge tidak menjawab: $($_.Exception.Message) - lihat $mt5Dir\logs\bridge.log" }
try {
    $t = Invoke-RestMethod -Uri 'http://127.0.0.1:3001/health' -TimeoutSec 10
    Ok "tv-bridge: hidup (stream harga: $($t.quoteStream))"
} catch { Fail "tv-bridge tidak menjawab: $($_.Exception.Message) - lihat $tvDir\logs\bridge.log" }

# ----------------------------- 8. Konfigurasi Hostinger -----------------------------
$wsUrl = "wss://$Domain"
$hostingerBlock = @"
// -- Tempel di config/api_keys.php (Hostinger) --
define('QI_TV_BRIDGE_URL', 'https://$Domain/tv');
define('QI_TV_BRIDGE_KEY', '$tvKey');

define('QI_MT5_BRIDGE_URL', '$wsUrl');
define('QI_MT5_BRIDGE_SECRET', '$jwt');
define('QI_MT5_BRIDGE_AUDIENCE', 'pro');
define('QI_MT5_BRIDGE_SYMBOLS', 'XAUUSD,BTCUSDT,EURUSD,GBPUSD,USDJPY,AUDUSD,NZDUSD,USDCHF,USDCAD');
"@
$out = "$Root\hostinger-config.txt"
Set-Content -Path $out -Value $hostingerBlock -Encoding ASCII
& icacls $out /inheritance:r /grant:r "${me}:(R,W)" "Administrators:(F)" 2>&1 | Out-Null

Write-Host "`n==============================================================" -ForegroundColor Green
Write-Host ' SELESAI. Langkah terakhir (kamu yang melakukan, rahasia tidak lewat chat):' -ForegroundColor Green
Write-Host "   1. Buka  $out  di VPS, salin isinya."
Write-Host '   2. Tempel ke config/api_keys.php di Hostinger (File Manager), simpan.'
Write-Host "   3. Uji dari PC-mu:  https://$Domain/health   dan   https://$Domain/tv/health"
Write-Host '   JANGAN kirim isi file itu ke siapa pun (berisi kunci).'
Write-Host '==============================================================' -ForegroundColor Green
