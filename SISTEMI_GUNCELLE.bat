@echo off
:: Batch script to run the BOGA Task Setup as Administrator
:: Location: c:\Users\afksm\finma\SISTEMI_GUNCELLE.bat

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
    echo BOGA AI Sistem Saatleri Guncelleniyor...
    powershell.exe -ExecutionPolicy Bypass -File "c:\Users\afksm\finma\scratch\setup_boga_tasks.ps1"
    echo.
    echo ==================================================
    echo ISLEM TAMAMLANDI! 
    echo Saglik Raporu: 06:00 NY
    echo Opsiyon Botu:  11:00 NY
    echo Swing Botu:    13:00 NY
    echo ==================================================
    echo.
    pause
