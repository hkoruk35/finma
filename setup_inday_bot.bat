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
echo BOGA AI Inday (Saatlik) Scanner Otomasyon Gorevi Kuruluyor...
schtasks /Create /TN "BOGA_AI_IndayScanner" /TR "C:\Users\afksm\finma\venv313\Scripts\python.exe C:\Users\afksm\finma\inday313.py" /SC ONSTART /F /RL HIGHEST

echo.
echo Gorev basariyla olusturuldu! Bu pencereyi kapatabilirsiniz.
pause
