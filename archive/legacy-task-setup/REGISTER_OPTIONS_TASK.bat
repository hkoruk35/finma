@echo off
echo ==================================================
echo BOGA AI - OPSYON TARAYICI GOREV KAYDI
echo ==================================================
echo.
echo Bu islem Yonetici yetkisi gerektirebilir.
echo.
SCHTASKS /Create /TN "BOGA_AI_Options_Scanner" /XML "C:\Users\afksm\finma\options_task.xml" /F
echo.
if %errorlevel% equ 0 (
    echo [OK] Gorev basariyla kaydedildi (11:00 ve 15:30 NY).
) else (
    echo [HATA] Gorev kaydedilemedi. Lutfen sag tiklayip 'Yonetici olarak calistir' deyin.
)
echo.
pause
