@echo off
echo Registering BOGA_AI_DayTradeBot...
SCHTASKS /Create /SC WEEKLY /D MON,TUE,WED,THU,FRI /TN "BOGA_AI_DayTradeBot" /TR "C:\Users\afksm\finma\RUN_DAYTRADE.bat" /ST 09:15 /F /RL HIGHEST
if %errorlevel% equ 0 (
    echo [OK] Task registered successfully.
) else (
    echo [ERROR] Failed to register task.
)
timeout /t 5
