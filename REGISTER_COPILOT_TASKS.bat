@echo off
echo Registering BOGA_Copilot_Tasks_Cron...
SCHTASKS /Create /SC HOURLY /MO 1 /TN "BOGA_Copilot_Tasks_Cron" /TR "C:\Users\afksm\finma\RUN_COPILOT_TASKS.bat" /ST 00:00 /F
if %errorlevel% equ 0 (
    echo [OK] Task registered successfully.
) else (
    echo [ERROR] Failed to register task.
)
timeout /t 5
