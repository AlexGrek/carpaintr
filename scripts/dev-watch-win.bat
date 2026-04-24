@echo off
setlocal

REM --- Setup ---
set "ROOT_DIR=%~dp0"
cd "%ROOT_DIR%"

echo.
echo [INFO] Starting development services (Frontend and Backend)...
echo [TIP] Press Ctrl+C when you are finished to stop all services and clean up processes.
echo.

REM --- Start Frontend (NPM) ---
echo [->] Starting Frontend Development Server (in carpaintr-front)...
REM /B starts the process in the background without creating a new console window.
start /D "carpaintr-front" /B npm run dev
echo [SUCCESS] Frontend launched (note: start /B returns before process completes)

REM --- Start Backend (Cargo) ---
echo.
echo.
echo [->] Starting Backend Development Server (in backend-service-rust)...
REM Check if cargo-watch is available (fall back to cargo run if not)
where cargo-watch > nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [INFO] Using cargo watch for hot reload...
    start /D "backend-service-rust" /B cargo watch -x run
    echo [SUCCESS] Backend launched via cargo watch.
) else (
    echo [WARNING] cargo-watch not found, falling back to cargo run (no hot reload)...
    start /D "backend-service-rust" /B cargo run
    echo [SUCCESS] Backend launched via cargo run.
)

echo.
echo ==================================================
echo [INFO] Development servers are now running in the background.
echo Press Ctrl+C to stop all services and clean up processes.
echo ==================================================

REM --- Wait for user interruption ---
:WAIT_LOOP
timeout /t 1 /nobreak > nul

REM --- Cleanup Phase (Executed when Ctrl+C is pressed) ---
echo.
echo.
echo [INFO] Received shutdown signal. Cleaning up stale development servers...

REM 1. Kill processes by port (8080 and 5173)
echo [->] Killing processes on port 8080 (Backend)...
for /f "tokens=5" %%i in ('netstat -ano ^| findstr ":8080" ^| findstr "LISTENING" 2^>nul') do (
    taskkill /PID %%i /F > nul 2>&1
    echo   Killed PID %%i (Port 8080)
)

echo [->] Killing processes on port 5173 (Frontend)...
for /f "tokens=5" %%i in ('netstat -ano ^| findstr ":5173" ^| findstr "LISTENING" 2^>nul') do (
    taskkill /PID %%i /F > nul 2>&1
    echo   Killed PID %%i (Port 5173)
)

REM 2. Kill cargo-watch processes (General cleanup)
echo [->] Cleaning up lingering cargo-watch processes...
taskkill /IM cargo-watch.exe /F > nul 2>&1

echo.
echo [SUCCESS] All development servers have been successfully terminated.
endlocal
