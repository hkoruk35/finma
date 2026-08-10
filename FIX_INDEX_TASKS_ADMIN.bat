@echo off
echo ============================================
echo  BOGA AI - Endeks Gorevlerini Guncelle (Admin Gerekli)
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
echo [INFO] Haftalik (Cumartesi saat basi) gorevleri yapilandiriliyor...
echo.

powershell.exe -ExecutionPolicy Bypass -File "C:\Users\afksm\finma\setup_index_analysis_tasks.ps1"

echo.
echo ============================================
echo  TAMAMLANDI 
echo ============================================
pause
