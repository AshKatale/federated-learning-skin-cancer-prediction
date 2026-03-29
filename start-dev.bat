@echo off
REM Start Federated Learning System (All Components for Windows)

echo ==========================================
echo Starting Federated Learning System
echo ==========================================
echo.

set SCRIPT_DIR=%~dp0
cd /d %SCRIPT_DIR%

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Node.js not found. Please install Node.js
    exit /b 1
)

REM Check if Python is installed
where python >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Python not found. Please install Python 3.8+
    exit /b 1
)

REM Install dependencies
echo Checking dependencies...
cd /d %SCRIPT_DIR%\server
call npm install --quiet >nul 2>&1

cd /d %SCRIPT_DIR%\federated-learning
pip install -q -r requirements.txt >nul 2>&1

echo.
echo Starting Backend Services
echo ================================
echo.

REM Start Node.js server
echo Starting Node.js Backend...
cd /d %SCRIPT_DIR%\server
start "Node.js Backend" npm start
timeout /t 2 /nobreak

REM Start Flask ML server
echo Starting Python ML Server...
cd /d %SCRIPT_DIR%\ml-model
start "ML Server" python app.py
timeout /t 2 /nobreak

REM Start Flower FL server
echo Starting Flower FL Server...
cd /d %SCRIPT_DIR%\federated-learning
start "FL Server" python fl_server.py
timeout /t 2 /nobreak

REM Start React frontend
echo Starting React Frontend...
cd /d %SCRIPT_DIR%\client
start "React Frontend" npm start
timeout /t 3 /nobreak

echo.
echo ==========================================
echo Federated Learning System Ready!
echo ==========================================
echo.
echo Services:
echo   Frontend:      http://localhost:3000
echo   Backend:       http://localhost:3001
echo   ML Server:     http://localhost:5000
echo   FL Server:     localhost:8080
echo.
echo All services started in separate windows
echo Close windows to stop services
echo.
pause
