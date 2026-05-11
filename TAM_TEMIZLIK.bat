@echo off
:: BOGA AI - TOTAL WIPE OUT SCRIPT
:: This script will remove ALL scheduled tasks and kill all processes.

echo --------------------------------------------------
echo BOGA AI - TAM TEMIZLIK (WIPE OUT) ARACI
echo --------------------------------------------------
echo.

REM Check for permissions
IF "%PROCESSOR_ARCHITECTURE%" EQU "amd64" (
>nul 2>&1 "%SYSTEMROOT%\SysWOW64\cacls.exe" "%SYSTEMROOT%\SysWOW64\config\system"
) ELSE (
>nul 2>&1 "%SYSTEMROOT%\system32\cacls.exe" "%SYSTEMROOT%\system32\config\system"
)

REM If error flag set, we do not have admin.
if '%errorlevel%' NEQ '0' (
    echo Yonetici yetkisi isteniyor...
    goto UACPrompt
) else ( goto gotAdmin )

:UACPrompt
    echo Set UAC = CreateObject^("Shell.Application"^) > "%temp%\getadmin.vbs"
    set params = %*:"=""
    echo UAC.ShellExecute "cmd.exe", "/c ""%~s0"" %params%", "", "runas", 1 >> "%temp%\getadmin.vbs"
    "%temp%\getadmin.vbs"
    del "%temp%\getadmin.vbs"
    exit /B

:gotAdmin
    pushd "%CD%"
    CD /D "%~dp0"

echo [+] Hafizadaki tum Python surecleri sonlandiriliyor...
taskkill /F /IM python.exe /T >nul 2>&1

echo.
echo [+] Windows Gorev Zamanlayicisi tamamen temizleniyor...

REM List of all known task names to delete
set tasks=BOGA_AI_Daily_Master BOGA_AI_Inday_Scanner BOGA_AI_Health_Check BOGA_AI_DayTradeBot BOGA_AI_HealthCheck BOGA_AI_IndayScanner BOGA_AI_Swing_Scanner BOGA_AI_Options_Scanner BOGA_AI_Options_PNL BOGA_AI_DailyBot BOGA_AI_v8.0_SWING BOGA_AI_v6.1_SWING

for %%t in (%tasks%) do (
    echo [!] Siliniyor: %%t
    schtasks /Delete /TN "%%t" /F >nul 2>&1
)

echo.
echo [+] Ekran temizleniyor...
powershell.exe -Command "Get-ScheduledTask | Where-Object {$_.TaskName -like '*BOGA*'} | Unregister-ScheduledTask -Confirm:$false" >nul 2>&1

echo.
echo ==================================================
echo TEMIZLIK TAMAMLANDI!
echo Windows uzerinde BOGA AI ile ilgili HICBIR gorev kalmadi.
echo Tum arka plan surecleri durduruldu.
echo ==================================================
echo.
pause
