# Installs the bridge as a Windows service with NSSM (https://nssm.cc) so it starts
# on boot and restarts after crashes. Run in an elevated PowerShell on the MT5 VPS:
#   .\scripts\install-windows-service.ps1 -Nssm C:\tools\nssm\win64\nssm.exe
param(
    [Parameter(Mandatory = $true)][string]$Nssm,
    [string]$ServiceName = 'QimMt5Bridge',
    [string]$Python = (Get-Command python).Source
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path "$root\.env")) { throw ".env not found in $root - copy .env.example and fill it in first." }

& $Nssm install $ServiceName $Python "$root\main.py"
& $Nssm set $ServiceName AppDirectory $root
& $Nssm set $ServiceName AppStdout "$root\logs\bridge.log"
& $Nssm set $ServiceName AppStderr "$root\logs\bridge.log"
& $Nssm set $ServiceName AppRotateFiles 1
& $Nssm set $ServiceName AppRotateBytes 10485760
& $Nssm set $ServiceName AppExit Default Restart
& $Nssm set $ServiceName AppRestartDelay 5000
New-Item -ItemType Directory -Force "$root\logs" | Out-Null

Write-Host "Installed. IMPORTANT: run the service as the SAME Windows user that runs terminal64.exe"
Write-Host "(services.msc -> $ServiceName -> Log On), otherwise MetaTrader5.initialize() cannot reach the terminal."
Write-Host "Then: & '$Nssm' start $ServiceName"
