@echo off
chcp 65001 >nul
echo.
echo ========================================
echo   ATMACA V113 - Lokal Tarama + Push
echo ========================================
echo.

cd /d "%~dp0\.."
python bots\local_scan_push.py

echo.
pause
