@echo off
REM Start Electron Desktop App for Windows

echo ==========================================
echo Starting Skin Cancer Detection Desktop App
echo ==========================================
echo.

set SCRIPT_DIR=%~dp0
cd /d %SCRIPT_DIR%\desktop-app

REM Check if node_modules exist
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
)

REM Start Electron app
echo Starting Electron app...
call npm start

pause
