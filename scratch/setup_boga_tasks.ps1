# Revised Task Scheduler Setup for BOGA AI Bots (Weekdays, NY Time)
# Corrected for Options Bot @ 11:00 AM NY

$VENV_PY = "C:\Users\afksm\finma\venv313\Scripts\python.exe"
$FINMA_DIR = "C:\Users\afksm\finma"

function Set-BogaTask {
    param($Name, $Script, $Args, $StartTime, $RepetitionInterval = $null, $RepetitionDuration = $null)
    
    $Action = New-ScheduledTaskAction -Execute $VENV_PY -Argument "$Script $Args" -WorkingDirectory $FINMA_DIR
    
    # Weekly trigger for Weekdays (Mon-Fri)
    $Trigger = New-ScheduledTaskTrigger -Weekly -At $StartTime -DaysOfWeek Monday,Tuesday,Wednesday,Thursday,Friday
    
    if ($RepetitionInterval) {
        $Trigger.Repetition = (New-ScheduledTaskTrigger -Once -At $StartTime -RepetitionInterval $RepetitionInterval -RepetitionDuration $RepetitionDuration).Repetition
    }

    # Unregister first to ensure clean state
    try { Unregister-ScheduledTask -TaskName $Name -Confirm:$false -ErrorAction SilentlyContinue } catch {}
    
    Register-ScheduledTask -TaskName $Name -Action $Action -Trigger $Trigger -Force -User "SYSTEM"
    Enable-ScheduledTask -TaskName $Name
}

# 1. Swing Bot (v115) - 13:00 NY (Weekdays)
Set-BogaTask -Name "BOGA_AI_Swing_Scanner" -Script "swing115_boga.py" -Args "--oneshot" -StartTime "13:00:00"

# 2. Options Bot (v8.0) - RETIRED
# Set-BogaTask -Name "BOGA_AI_Options_Scanner" -Script "opsiyon218v8.py" -Args "--oneshot" -StartTime "11:00:00"

# 3. Inday Bot (Hourly 10:00-16:00 NY, Weekdays)
Set-BogaTask -Name "BOGA_AI_Inday_Scanner" -Script "inday313.py" -Args "--force" -StartTime "10:00:00" -RepetitionInterval (New-TimeSpan -Hours 1) -RepetitionDuration (New-TimeSpan -Hours 7)

# 4. PNL Tracker - 14:00 NY (Weekdays)
Set-BogaTask -Name "BOGA_AI_Options_PNL" -Script "options_pnl_tracker.py" -Args "" -StartTime "14:00:00"

# 5. Health Checker - Daily at 06:00 AM NY
$HealthAction = New-ScheduledTaskAction -Execute $VENV_PY -Argument "site_health_checker.py --daily" -WorkingDirectory $FINMA_DIR
$HealthTrigger = New-ScheduledTaskTrigger -Daily -At "06:00:00"
try { Unregister-ScheduledTask -TaskName "BOGA_AI_Health_Check" -Confirm:$false -ErrorAction SilentlyContinue } catch {}
Register-ScheduledTask -TaskName "BOGA_AI_Health_Check" -Action $HealthAction -Trigger $HealthTrigger -Force -User "SYSTEM"

Write-Host "BOGA AI bot pipeline reconfigured successfully (Options 11:00, Swing 13:00 NY)."
