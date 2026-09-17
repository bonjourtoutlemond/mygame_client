@echo off
setlocal

cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File "%~dp0start_web_client.ps1" %*

echo.
echo Web client launcher finished with exit code %ERRORLEVEL%.
if errorlevel 1 pause
