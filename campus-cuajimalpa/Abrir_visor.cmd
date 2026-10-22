@echo off
cd /d "%~dp0"
start "UAM Cuajimalpa" /min node server.mjs
start "" "http://127.0.0.1:8769/Visor_UAM_autonomo.html"
