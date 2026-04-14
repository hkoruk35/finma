@echo off
:: Yonetici izinlerini kontrol et
net session >nul 2>&1
if %errorLevel% == 0 (
    echo Yonetici izinleri onaylandi.
) else (
    echo Yonetici izinleri isteniyor... Lutfen "Evet" diyerek onaylayin.
    powershell -Command "Start-Process '%~dpnx0' -Verb RunAs"
    exit /b
)

echo.
echo BOGA AI Saglik Kontrol Botu Zamanlaniyor...
schtasks /Create /TN "BOGA_AI_HealthCheck" /TR "C:\Users\afksm\finma\venv313\Scripts\python.exe C:\Users\afksm\finma\site_health_checker.py" /SC DAILY /ST 09:00 /F /RL HIGHEST
echo.
echo Saglik denetimi her sabah 09:00 NY vaktine ayarlandi.
pause
