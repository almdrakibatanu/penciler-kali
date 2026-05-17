@echo off
setlocal
echo Stopping PencilerKali servers on ports 3000 and 4000...
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 3000,4000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { try { Stop-Process -Id $_ -Force -ErrorAction Stop; Write-Output ('  killed PID ' + $_) } catch {} }"
echo Done.
pause
