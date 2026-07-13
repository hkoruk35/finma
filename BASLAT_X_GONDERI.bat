@echo off
title BOGA STOCK X Otomatik Gonderici
echo Bogastock X otomatik gonderim baslatiliyor...
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
    echo Hata: .venv bulunamadi!
    pause
    exit /b
)
.venv\Scripts\python.exe send_x_queue.py
pause
