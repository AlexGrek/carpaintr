@echo off
setlocal

echo.
echo [INFO] Stopping stale dev servers (backend :8080, frontend :5173)...

:: --- Kill processes on Port 8080 (Backend) ---
echo.
echo [->] Checking for processes on port 8080...
netstat -ano | findstr ":8080" > nul | find "LISTENING" | For /f "tokens=4" %%i in ('findstr ":8080" ^| find "LISTENING"') do (
    taskkill /PID %%i /F > nul
    echo     Killed process PID: %%i (Port 8080)
)

:: --- Kill processes on Port 5173 (Frontend) ---
echo.
echo [->] Checking for processes on port 5173...
netstat -ano | findstr ":5173" > nul | find "LISTENING" | For /f "tokens=4" %%i in ('findstr ":5173" ^| find "LISTENING"') do (
    taskkill /PID %%i /F > nul
    echo     Killed process PID: %%i (Port 5173)
)

:: --- Kill cargo-watch processes ---
echo.
echo [->] Checking for lingering cargo-watch processes...
taskkill /IM cargo.exe /F > nul 2>&1
taskkill /IM cargo_watch.exe /F > nul 2>&1

echo.
echo [SUCCESS] Done. All detected stale development servers have been terminated.
