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
echo BOGA AI Otomasyon Gorevi Kuruluyor...
schtasks /Create /TN "BOGA_AI_DailyBot" /TR "C:\Users\afksm\finma\venv313\Scripts\python.exe C:\Users\afksm\finma\run_all_bots.py" /SC WEEKLY /D MON,TUE,WED,THU,FRI /ST 13:00 /F /RL HIGHEST

echo.
echo Gorev basariyla olusturuldu! Bu pencereyi kapatabilirsiniz.
pause
