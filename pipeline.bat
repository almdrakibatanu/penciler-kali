@echo off
setlocal
cd /d "%~dp0"
echo ==============================================
echo  PencilerKali pipeline  -  one full cycle
echo  (collect -> AI rewrite -> thumbnail -> video -> publish)
echo ==============================================
echo.
echo This takes ~30-90 seconds depending on AI key + ffmpeg.
echo.
call npm run -w apps/api cli all
echo.
echo Pipeline finished. Refresh http://localhost:3000 to see new articles.
pause
