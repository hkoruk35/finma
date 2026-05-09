@echo off
:: BOGA AI - Force Kill All Python Processes
:: This script will stop all currently running bots including ghost processes.

echo --------------------------------------------------
echo BOGA AI - TUM BOTLARI DURDURMA ARACI
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
taskkill /F /IM python.exe /T

echo.
echo [+] Gereksiz gorevler temizleniyor...
schtasks /End /TN "BOGA_AI_DailyBot" /F >nul 2>&1
schtasks /End /TN "BOGA_AI_Swing_Scanner" /F >nul 2>&1
schtasks /End /TN "BOGA_AI_Options_Scanner" /F >nul 2>&1

echo.
echo ==================================================
echo ISLEM TAMAMLANDI!
echo Tum hayalet botlar durduruldu.
echo Artik sadece yeni kurdugumuz 'Daily_Master' calisacak.
echo ==================================================
echo.
pause
