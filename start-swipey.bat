@echo off
setlocal

cd /d "%~dp0"

echo Swipey wordt gestart...
echo.
echo Dit opent de app met snelle toegang, zodat je niet telkens hoeft in te loggen.
echo Sluit dit venster niet zolang je de app gebruikt.
echo.

start "Swipey app + API" cmd /k "cd /d ""%~dp0"" && npm run dev:stripe"

timeout /t 4 /nobreak >nul
start "" "http://localhost:5173/?quick=1"

endlocal
