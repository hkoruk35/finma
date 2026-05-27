# Optimized Task Scheduler Setup for BOGA AI (Weekdays, NY Time)
# Single Source of Truth: All daily bots are managed via run_all_bots.py

$VENV_PY = "C:\Users\afksm\finma\venv313\Scripts\python.exe"
$FINMA_DIR = "C:\Users\afksm\finma"

# Get current user for task registration
$CurrentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
Write-Host "INFO: Tasks will be registered for user: $CurrentUser"

# Ensure git recognizes this directory as safe for the current user
git config --global --add safe.directory $FINMA_DIR

function Set-BogaTask {
    param($Name, $Script, $Args, $StartTime, $RepetitionInterval = $null, $RepetitionDuration = $null)

    $Action = New-ScheduledTaskAction -Execute $VENV_PY -Argument "$Script $Args" -WorkingDirectory $FINMA_DIR

    $Trigger = New-ScheduledTaskTrigger -Weekly -At $StartTime -DaysOfWeek Monday,Tuesday,Wednesday,Thursday,Friday

    if ($RepetitionInterval) {
        $RepetitionTrigger = New-ScheduledTaskTrigger -Once -At $StartTime -RepetitionInterval $RepetitionInterval -RepetitionDuration $RepetitionDuration
        $Trigger.Repetition = $RepetitionTrigger.Repetition
    }

    # S4U: kullanıcı oturumu açık olmasa da çalışır, şifre gerektirmez
    $Principal = New-ScheduledTaskPrincipal -UserId $CurrentUser -LogonType S4U -RunLevel Highest

    $Settings = New-ScheduledTaskSettingsSet `
        -MultipleInstances IgnoreNew `
        -ExecutionTimeLimit (New-TimeSpan -Hours 72) `
        -WakeToRun:$false
    # Pil kısıtlamalarını kapat (dizüstü bilgisayar desteği için kritik)
    $Settings.DisallowStartIfOnBatteries = $false
    $Settings.StopIfGoingOnBatteries = $false

    $Task = New-ScheduledTask -Action $Action -Trigger $Trigger -Principal $Principal -Settings $Settings

    try { Unregister-ScheduledTask -TaskName $Name -Confirm:$false -ErrorAction SilentlyContinue } catch {}
    Register-ScheduledTask -TaskName $Name -InputObject $Task -Force
    Enable-ScheduledTask -TaskName $Name
    Write-Host "OK: $Name gorev olusturuldu (S4U, batarya kisitlamasi yok)"
}

# 1. BOGA AI MORNING CYCLE (run_morning_cycle.py) - 09:15 NY
Set-BogaTask -Name "BOGA_AI_Morning_Cycle" -Script "run_morning_cycle.py" -Args "" -StartTime "09:15:00"

# 2. BOGA AI AFTERNOON CYCLE (run_afternoon_cycle.py) - 13:00 NY
Set-BogaTask -Name "BOGA_AI_Afternoon_Cycle" -Script "run_afternoon_cycle.py" -Args "" -StartTime "13:00:00"

# 3. BOGA AI TERMINAL PULSE (Hourly Data) - 09:00 NY (Every 1 hour)
Set-BogaTask -Name "BOGA_AI_Terminal_Pulse" -Script "run_terminal_pulse.py" -Args "" -StartTime "09:00:00" -RepetitionInterval (New-TimeSpan -Hours 1) -RepetitionDuration (New-TimeSpan -Hours 8)

# 4. BOGA AI OPTIONS SCANNER - 11:00 NY
Set-BogaTask -Name "BOGA_AI_Options_Scanner" -Script "run_options_scanner.py" -Args "" -StartTime "11:00:00"

# 5. BOGA AI HEALTH CHECK - Every 4 hours (7/24)
Set-BogaTask -Name "BOGA_AI_Health_Check" -Script "site_health_checker.py" -Args "--daily" -StartTime "00:00:00" -RepetitionInterval (New-TimeSpan -Hours 4) -RepetitionDuration (New-TimeSpan -Days 3650)

# ESKİ GÖREVLERİ TEMİZLE (Tamamen silmek için)
$OldTasks = @(
    "BOGA_AI_Swing_Scanner",
    "BOGA_AI_Options_PNL",
    "BOGA_AI_DailyBot",
    "BOGA_AI_DayTradeBot",
    "BOGA_AI_Hourly_Scanner",
    "BOGA_AI_v6.1_SWING",
    "BOGA_AI_v8.0_SWING",
    "BOGA_AI_Daily_Master",
    "BOGA_AI_Inday_Scanner",
    "BOGA_AI_Closing_Cycle"
)

foreach ($Task in $OldTasks) {
    try { 
        Unregister-ScheduledTask -TaskName $Task -Confirm:$false -ErrorAction SilentlyContinue 
        Write-Host "DELETED: Old task removed: $Task"
    } catch {}
}

Write-Host "DONE: BOGA AI bot pipeline reconfigured successfully. Use SISTEMI_GUNCELLE.bat as Administrator to apply."
