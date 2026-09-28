@echo off
echo Deteniendo procesos del servidor Encuentro Juvenil...
taskkill /F /IM node.exe /T 2>nul
taskkill /F /IM cloudflared.exe /T 2>nul
echo Servidor detenido correctamente.
pause
