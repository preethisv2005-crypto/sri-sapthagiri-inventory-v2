@echo off
echo ========================================= > diagnose_results.txt
echo SRI SAPTHAGIRI SYSTEM DIAGNOSTIC REPORT >> diagnose_results.txt
echo Generated at: %date% %time% >> diagnose_results.txt
echo ========================================= >> diagnose_results.txt
echo. >> diagnose_results.txt

echo [1] Checking what is running on Port 5001... >> diagnose_results.txt
netstat -ano | findstr :5001 >> diagnose_results.txt 2>&1
if errorlevel 1 (
    echo No process found listening on Port 5001. >> diagnose_results.txt
) else (
    echo Process is listening on Port 5001! >> diagnose_results.txt
)
echo. >> diagnose_results.txt

echo [2] Checking all running 'node' processes... >> diagnose_results.txt
tasklist /FI "IMAGENAME eq node.exe" >> diagnose_results.txt 2>&1
echo. >> diagnose_results.txt

echo [3] Attempting to FORCE KILL Port 5001... >> diagnose_results.txt
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5001') do (
    echo Found PID %%a on Port 5001. Killing it... >> diagnose_results.txt
    taskkill /F /PID %%a >> diagnose_results.txt 2>&1
)
echo. >> diagnose_results.txt

echo [4] Starting the backend server fresh... >> diagnose_results.txt
start cmd /k "node api/server.js"
echo Backend server start command triggered in new window. >> diagnose_results.txt
echo. >> diagnose_results.txt

echo Diagnostic finished! Check this file contents. >> diagnose_results.txt
echo DONE.
