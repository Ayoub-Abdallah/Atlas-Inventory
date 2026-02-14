@echo off
:: ==============================================================================
:: Atlas Inventory - Startup Script for Windows
:: ==============================================================================
:: This script starts the Atlas Inventory server in the background.
:: It is designed to be called by Task Scheduler or the Startup folder.
:: ==============================================================================

title Atlas Inventory Server

:: Navigate to the application directory
cd /d "%~dp0"

:: Check if Node.js is available
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

:: Check if node_modules exists
if not exist "node_modules" (
    echo [INFO] Installing dependencies...
    call npm install
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] Failed to install dependencies.
        pause
        exit /b 1
    )
)

:: Initialize the database if .data folder doesn't exist
if not exist ".data" (
    echo [INFO] Initializing database...
    node init-db.mjs
)

:: Kill any existing process on port 3000
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING 2^>nul') do (
    echo [INFO] Killing existing process on port 3000 (PID: %%a)
    taskkill /PID %%a /F >nul 2>&1
)

:: Start the application
echo [INFO] Starting Atlas Inventory on http://localhost:3000 ...
echo [INFO] Press Ctrl+C to stop the server.
echo.

npm run dev -- --host
