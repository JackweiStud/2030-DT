@echo off
setlocal EnableExtensions
REM ---------------------------------------------------------------------------
REM Windows launcher for case2 Web + adapter (no stub).
REM Encoding: keep THIS .bat ASCII-only. Chinese lives in .ps1 (UTF-8 BOM).
REM Usage (cmd or PowerShell):
REM   .\code\scripts\dev-web-server.bat
REM ---------------------------------------------------------------------------

REM Switch console to UTF-8 before starting PowerShell (avoids mojibake).
chcp 65001 >nul

set "SCRIPT_DIR=%~dp0"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%dev-web-server.ps1" %*
set "EXIT_CODE=%ERRORLEVEL%"
endlocal & exit /b %EXIT_CODE%
