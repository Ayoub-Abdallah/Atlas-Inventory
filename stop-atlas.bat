@echo off
:: ==============================================================================
:: Atlas Inventory - Stop Server
:: ==============================================================================

echo Stopping Atlas Inventory server...

:: Kill node processes on port 3000
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING 2^>nul') do (
    echo Killing process PID: %%a
    taskkill /PID %%a /F >nul 2>&1
)

:: Also kill any npm/node that might be related
taskkill /FI "WINDOWTITLE eq Atlas Inventory*" /F >nul 2>&1

echo.
echo Atlas Inventory server stopped.
timeout /t 3
