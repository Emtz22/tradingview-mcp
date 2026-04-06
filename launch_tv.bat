@echo off
REM Launch TradingView Desktop with CDP debug mode for MCP server
REM Usage: double-click this file or run from terminal

set PORT=9222

REM Kill existing TradingView instances
taskkill /F /IM TradingView.exe >nul 2>&1
timeout /t 2 /nobreak >nul

REM Find TradingView exe in WindowsApps
set "TV_EXE="
for /f "tokens=*" %%i in ('dir /s /b "%PROGRAMFILES%\WindowsApps\TradingView*\TradingView.exe" 2^>nul') do set "TV_EXE=%%i"

if "%TV_EXE%"=="" (
    echo Error: TradingView not found in WindowsApps.
    pause
    exit /b 1
)

echo Found: %TV_EXE%
echo Starting with --remote-debugging-port=%PORT%...
start "" "%TV_EXE%" --remote-debugging-port=%PORT%

echo Waiting for CDP...
timeout /t 5 /nobreak >nul

:check
curl -s http://localhost:%PORT%/json/version >nul 2>&1
if %errorlevel% neq 0 (
    echo Still waiting...
    timeout /t 2 /nobreak >nul
    goto check
)

echo.
echo CDP ready at http://localhost:%PORT%
curl -s http://localhost:%PORT%/json/version
echo.
echo You can now use Claude Code with the TradingView MCP server.
pause
