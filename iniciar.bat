@echo off
title WebToPDF Exporter - Compilador Web a PDF
color 0A

echo ========================================================
echo      Iniciando WebToPDF Exporter (Servidor Web)
echo ========================================================
echo.

:: Cambiar al directorio del script
cd /d "%~dp0"

:: Verificar si node_modules existe
if not exist node_modules (
    echo [1/2] Instalando paquetes y navegador de Playwright con pnpm...
    call pnpm install
    call pnpm exec playwright install chromium
) else (
    echo [1/2] Entorno verificado correctamente.
)

echo.
echo [2/2] Lanzando servidor en http://localhost:3000 ...
echo.

:: Abrir navegador automaticamente
timeout /t 2 /nobreak >nul
start http://localhost:3000

:: Iniciar servidor Node.js
node server.js

pause
