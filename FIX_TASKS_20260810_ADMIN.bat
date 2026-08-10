@echo off
echo ============================================
echo  BOGA AI - Gorev Duzeltmeleri (2026-08-10)
echo ============================================
echo.
echo  1) BOGA_AI_Top100_Hourly    -^> DEVRE DISI
echo  2) BOGA_AI_Top100_Swing10   -^> DEVRE DISI
echo     (Top100 senkronu Vercel cron'una tasindi; bu iki gorev her
echo      calismada "top100-sync HTTP 403" ile dusuyordu.)
echo.
echo  3) Endeks gorevleri setup_index_analysis_tasks.ps1'e gore
echo     yeniden kaydedilir:
echo       - EU_Closing    11:35 -^> 11:45  (Avrupa kapanisi + 15 dk)
echo       - US_Closing    16:30 -^> 16:05  (once ABD)
echo       - LatAm_Daily1  16:05 -^> 16:10  (5 dk sonra LatAm)
echo       - LatAm_Daily2  17:05         (--only-missing kurtarma kosusu)
echo       - Tum gorevlere --symbols eklenir (her gorev 21 sembolu
echo         bastan sona taramayi birakir)
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
echo.

echo [1/3] Top100 gorevleri devre disi birakiliyor...
schtasks /Change /TN "BOGA_AI_Top100_Hourly" /DISABLE
schtasks /Change /TN "BOGA_AI_Top100_Swing10" /DISABLE
echo.

echo [2/3] Endeks gorevleri yeniden kaydediliyor...
powershell.exe -ExecutionPolicy Bypass -File "C:\Users\afksm\finma\setup_index_analysis_tasks.ps1"
echo.

echo [3/3] Sonuc kontrolu...
powershell.exe -ExecutionPolicy Bypass -Command "Get-ScheduledTask -TaskName 'BOGA_AI_Top100_*','BOGA_AI_Index_*' | ForEach-Object { $a=$_.Actions[0]; [PSCustomObject]@{ Task=$_.TaskName; State=$_.State; Args=$a.Arguments } } | Sort-Object Task | Format-Table -AutoSize -Wrap"

echo.
echo ============================================
echo  TAMAMLANDI
echo ============================================
pause
