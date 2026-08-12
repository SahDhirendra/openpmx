@echo off
title OpenPMX
echo Starting OpenPMX...

:: Create required directories
mkdir "%~dp0nginx\logs" 2>nul
mkdir "%~dp0nginx\temp\client_body_temp" 2>nul
mkdir "%~dp0nginx\temp\proxy_temp" 2>nul
mkdir "%~dp0nginx\temp\fastcgi_temp" 2>nul
mkdir "%~dp0data" 2>nul
mkdir "%~dp0logs" 2>nul

:: Start backend
start /B "" "%~dp0openpmx-backend.exe"

:: Wait for backend to start
timeout /t 5 /nobreak > nul

:: Start nginx
cd /d "%~dp0nginx"
start /B "" "%~dp0nginx\nginx.exe" -p "%~dp0nginx"
cd /d "%~dp0"

:: Open dashboard in browser
timeout /t 3 /nobreak > nul
start http://localhost:5173

echo OpenPMX is running!
echo Dashboard: http://localhost:5173
echo API: http://localhost:8000
echo.
echo Press any key to stop OpenPMX...
pause > nul

:: Stop services
taskkill /F /IM openpmx-backend.exe > nul 2>&1
"%~dp0nginx\nginx.exe" -p "%~dp0nginx" -s stop > nul 2>&1
echo OpenPMX stopped.