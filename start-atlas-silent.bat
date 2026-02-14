@echo off
:: ==============================================================================
:: Atlas Inventory - Silent Background Starter
:: ==============================================================================
:: Starts the server minimized/hidden. Used by Task Scheduler.
:: ==============================================================================

cd /d "%~dp0"

:: Kill any existing process on port 3000
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING 2^>nul') do (
    taskkill /PID %%a /F >nul 2>&1
)

:: Start minimized
start /min "Atlas Inventory" cmd /c "npm run dev"
