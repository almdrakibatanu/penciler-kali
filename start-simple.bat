@echo off
title PencilerKali simple launcher
cd /d "%~dp0"
echo Opening API window...
start "PencilerKali API"  /D "%CD%"  cmd /k  npm run dev:api
echo Opening Web window...
start "PencilerKali Web"  /D "%CD%"  cmd /k  npm run dev:web
echo Waiting 15 seconds, then opening Chrome...
timeout /t 15
start "" "http://localhost:3000"
echo Done.
pause
