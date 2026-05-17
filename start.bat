@echo off
title PencilerKali launcher
cd /d "%~dp0"

echo ==============================================
echo   PencilerKali.com  --  launcher
echo ==============================================
echo Project folder: %CD%
echo.

REM ---- Check Node ----
where node >nul 2>&1
if errorlevel 1 (
    echo  X  Node.js is not installed or not on PATH.
    echo     Install from https://nodejs.org/  then re-run this file.
    echo.
    pause
    exit /b 1
)
for /f "delims=" %%v in ('node --version') do echo Node.js: %%v
echo.

REM ---- Setup if missing ----
if not exist "node_modules" (
    echo Installing dependencies, please wait...
    call npm install --no-audit --no-fund
    if errorlevel 1 (
        echo X npm install failed.
        echo.
        pause
        exit /b 1
    )
)

if not exist "packages\db\dist\index.js" (
    echo Building workspaces...
    call npm run build
    if errorlevel 1 (
        echo X build failed.
        echo.
        pause
        exit /b 1
    )
)

if not exist "storage\data\penciler.db" (
    echo Seeding database...
    call npm run -w apps/api seed
)

echo.
echo --- launching servers in new windows ---

REM Launch each server in a NEW persistent cmd window.
REM /D sets the working directory for the new window cleanly even with spaces in path.
start "PencilerKali API  (port 4000)"  /D "%CD%"  cmd /k  npm run dev:api
start "PencilerKali Web  (port 3000)"  /D "%CD%"  cmd /k  npm run dev:web

echo Two new windows just opened: API and Web.
echo.
echo Waiting 15 seconds for the web server to compile...
timeout /t 15 /nobreak >nul

echo.
echo Opening Chrome to http://localhost:3000 ...

REM Try Chrome first, fall back to default browser.
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --new-window http://localhost:3000
) else if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" (
    start "" "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" --new-window http://localhost:3000
) else (
    start "" "http://localhost:3000"
)

echo.
echo ==============================================
echo   READY!
echo ==============================================
echo   Web  ->  http://localhost:3000
echo   API  ->  http://localhost:4000
echo ==============================================
echo.
echo Notes:
echo  * The two SERVER windows must stay open while you use the site.
echo  * To run a news pipeline cycle:  double-click  pipeline.bat
echo  * To shut down both servers:     double-click  stop.bat
echo.
echo You can close THIS launcher window any time.
echo.
pause
