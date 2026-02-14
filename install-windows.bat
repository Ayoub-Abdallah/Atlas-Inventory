@echo off
:: ==============================================================================
:: Atlas Inventory - Register Auto-Start (runs setup-windows.ps1 as Admin)
:: ==============================================================================

:: Check if running as admin
net session >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo Requesting Administrator privileges...
    powershell -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File "%~dp0setup-windows.ps1"
pause
