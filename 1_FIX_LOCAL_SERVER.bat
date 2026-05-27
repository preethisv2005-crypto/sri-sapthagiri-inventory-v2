@echo off
echo =========================================
echo RESTARTING LOCAL BACKEND SERVER...
echo =========================================
echo.
echo Stopping existing Node servers...
taskkill /F /IM node.exe >nul 2>&1
echo.
echo Starting server with updated code...
start cmd /k "node api/server.js"
echo.
echo Done! You can now test adding a fitting locally.
echo (You can close this window)
pause
