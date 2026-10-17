@echo off
rem Menjalankan tv-bridge (TradingView-API) di port 3001.
rem Dipakai start-bridge-hidden.vbs (tanpa jendela) atau bisa diklik dua kali manual.
cd /d "%~dp0"
node server.js >> bridge.log 2>&1
