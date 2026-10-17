# Memasang tv-bridge (library TradingView-API, Node.js) sebagai Windows service lewat NSSM
# (https://nssm.cc) supaya hidup otomatis saat boot dan restart sendiri bila crash.
# Jalankan di PowerShell sebagai Administrator, dari folder tv-bridge:
#   .\scripts\install-windows-service.ps1 -Nssm C:\tools\nssm\win64\nssm.exe
param(
    [Parameter(Mandatory = $true)][string]$Nssm,
    [string]$ServiceName = 'QimTvBridge',
    [string]$Node = (Get-Command node).Source
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path "$root\.env")) { throw ".env tidak ditemukan di $root - buat dulu (TV_BRIDGE_PORT, TV_BRIDGE_HOST=127.0.0.1, BRIDGE_KEY)." }
if (-not (Select-String -Path "$root\.env" -Pattern '^\s*BRIDGE_KEY=.{16,}' -Quiet)) {
    throw "BRIDGE_KEY di .env kosong atau terlalu pendek (min. 16 karakter). Bridge tidak boleh terbuka tanpa kunci."
}
if (-not (Test-Path "$root\node_modules\@mathieuc\tradingview")) { throw "Jalankan 'npm ci --omit=dev' di $root terlebih dahulu." }

New-Item -ItemType Directory -Force "$root\logs" | Out-Null
& $Nssm install $ServiceName $Node "$root\server.js"
& $Nssm set $ServiceName AppDirectory $root
& $Nssm set $ServiceName AppStdout "$root\logs\bridge.log"
& $Nssm set $ServiceName AppStderr "$root\logs\bridge.log"
& $Nssm set $ServiceName AppRotateFiles 1
& $Nssm set $ServiceName AppRotateBytes 10485760
& $Nssm set $ServiceName AppExit Default Restart
& $Nssm set $ServiceName AppRestartDelay 5000
& $Nssm set $ServiceName Start SERVICE_AUTO_START

Write-Host "Terpasang. Jalankan: & '$Nssm' start $ServiceName"
Write-Host "Uji: curl http://127.0.0.1:3001/health  (harus {\"status\":\"ok\",\"quoteStream\":true,...})"
