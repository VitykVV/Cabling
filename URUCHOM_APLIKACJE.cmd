@echo off
setlocal
powershell -ExecutionPolicy Bypass -File "%~dp0URUCHOM_APLIKACJE.ps1" %*
endlocal
