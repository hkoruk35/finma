@echo off
echo ============================================
echo  BOGA AI - Gorev Duzeltme (Admin Gerekli)
echo ============================================
echo.

:: Admin kontrolu
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [HATA] Bu dosyayi "Yonetici olarak calistir" ile acmaniz gerekiyor!
    echo.
    echo Sag tiklayin ve "Yonetici olarak calistir" secin.
    pause
    exit /B 1
)

echo [INFO] Admin yetkileri onaylandi.
echo [INFO] Gorevler yeniden yapilandiriliyor...
echo.

powershell.exe -ExecutionPolicy Bypass -File "C:\Users\afksm\finma\scratch\setup_boga_tasks.ps1"

echo.
echo [INFO] Mevcut gorev durumu:
echo.
schtasks /query /tn "BOGA_AI_Afternoon_Cycle" /fo LIST /v | findstr /i "Status Logon Battery Next"
echo.
schtasks /query /tn "BOGA_AI_Morning_Cycle" /fo LIST /v | findstr /i "Status Logon Battery Next"
echo.
echo ============================================
echo  TAMAMLANDI - Artik batarya ve ekran kilidi
echo  gorevleri engellemeyecek.
echo ============================================
pause
