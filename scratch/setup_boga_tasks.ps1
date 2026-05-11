# Optimized Task Scheduler Setup for BOGA AI (Weekdays, NY Time)
# Single Source of Truth: All daily bots are managed via run_all_bots.py

$VENV_PY = "C:\Users\afksm\finma\venv313\Scripts\python.exe"
$FINMA_DIR = "C:\Users\afksm\finma"

function Set-BogaTask {
    param($Name, $Script, $Args, $StartTime, $RepetitionInterval = $null, $RepetitionDuration = $null)
    
    $Action = New-ScheduledTaskAction -Execute $VENV_PY -Argument "$Script $Args" -WorkingDirectory $FINMA_DIR
    
    # 🕒 Her zaman Weekly (Weekdays) tetikleyicisi kullanıyoruz
    $Trigger = New-ScheduledTaskTrigger -Weekly -At $StartTime -DaysOfWeek Monday,Tuesday,Wednesday,Thursday,Friday
    
    # 🔄 Eğer tekrarlı bir görevse (örn: saatlik), Weekly tetikleyicisine Repetition ekle
    if ($RepetitionInterval) {
        $Trigger.RepetitionInterval = $RepetitionInterval
        $Trigger.RepetitionDuration = $RepetitionDuration
    }

    try { Unregister-ScheduledTask -TaskName $Name -Confirm:$false -ErrorAction SilentlyContinue } catch {}
    Register-ScheduledTask -TaskName $Name -Action $Action -Trigger $Trigger -Force -User "SYSTEM"
    Enable-ScheduledTask -TaskName $Name
}

# 1. BOGA AI MORNING CYCLE (run_morning_cycle.py) - 09:15 NY
Set-BogaTask -Name "BOGA_AI_Morning_Cycle" -Script "run_morning_cycle.py" -Args "" -StartTime "09:15:00"

# 2. BOGA AI AFTERNOON CYCLE (run_afternoon_cycle.py) - 13:00 NY
Set-BogaTask -Name "BOGA_AI_Afternoon_Cycle" -Script "run_afternoon_cycle.py" -Args "" -StartTime "13:00:00"

# 3. BOGA AI TERMINAL PULSE (Hourly Data) - 09:00 NY (Every 1 hour)
Set-BogaTask -Name "BOGA_AI_Terminal_Pulse" -Script "run_terminal_pulse.py" -Args "" -StartTime "09:00:00" -RepetitionInterval (New-TimeSpan -Hours 1) -RepetitionDuration (New-TimeSpan -Hours 8)

# 4. BOGA AI HEALTH CHECK - Every 4 hours (7/24)
Set-BogaTask -Name "BOGA_AI_Health_Check" -Script "site_health_checker.py" -Args "--daily" -StartTime "00:00:00" -RepetitionInterval (New-TimeSpan -Hours 4) -RepetitionDuration ([TimeSpan]::MaxValue)

# ESKİ GÖREVLERİ TEMİZLE (Tamamen silmek için)
$OldTasks = @(
    "BOGA_AI_Swing_Scanner",
    "BOGA_AI_Options_Scanner",
    "BOGA_AI_Options_PNL",
    "BOGA_AI_DailyBot",
    "BOGA_AI_DayTradeBot",
    "BOGA_AI_Hourly_Scanner",
    "BOGA_AI_v6.1_SWING",
    "BOGA_AI_v8.0_SWING",
    "BOGA_AI_Daily_Master",
    "BOGA_AI_Inday_Scanner"
)

foreach ($Task in $OldTasks) {
    try { 
        Unregister-ScheduledTask -TaskName $Task -Confirm:$false -ErrorAction SilentlyContinue 
        Write-Host "🗑️ Eski görev silindi: $Task"
    } catch {}
}

Write-Host "✅ BOGA AI bot pipeline reconfigured successfully. Use SISTEMI_GUNCELLE.bat as Administrator to apply."
