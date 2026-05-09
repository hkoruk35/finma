# Optimized Task Scheduler Setup for BOGA AI (Weekdays, NY Time)
# Single Source of Truth: All daily bots are managed via run_all_bots.py

$VENV_PY = "C:\Users\afksm\finma\venv313\Scripts\python.exe"
$FINMA_DIR = "C:\Users\afksm\finma"

function Set-BogaTask {
    param($Name, $Script, $Args, $StartTime, $RepetitionInterval = $null, $RepetitionDuration = $null)
    
    $Action = New-ScheduledTaskAction -Execute $VENV_PY -Argument "$Script $Args" -WorkingDirectory $FINMA_DIR
    $Trigger = New-ScheduledTaskTrigger -Weekly -At $StartTime -DaysOfWeek Monday,Tuesday,Wednesday,Thursday,Friday
    
    if ($RepetitionInterval) {
        $Trigger.Repetition = (New-ScheduledTaskTrigger -Once -At $StartTime -RepetitionInterval $RepetitionInterval -RepetitionDuration $RepetitionDuration).Repetition
    }

    try { Unregister-ScheduledTask -TaskName $Name -Confirm:$false -ErrorAction SilentlyContinue } catch {}
    Register-ScheduledTask -TaskName $Name -Action $Action -Trigger $Trigger -Force -User "SYSTEM"
    Enable-ScheduledTask -TaskName $Name
}

# 1. BOGA AI DAILY MASTER (run_all_bots.py) - 09:15 NY
# Bu görev sırasıyla: DayTrade, Swing (13:00 bekler), Performance, PNL ve Git Push işlemlerini yapar.
Set-BogaTask -Name "BOGA_AI_Daily_Master" -Script "run_all_bots.py" -Args "" -StartTime "09:15:00"

# 2. BOGA AI INDAY PULSE (Hourly 10:00-16:00 NY)
# Gün içi kurumsal momentum takibi için saatlik tarama.
Set-BogaTask -Name "BOGA_AI_Inday_Scanner" -Script "inday313.py" -Args "--force" -StartTime "10:00:00" -RepetitionInterval (New-TimeSpan -Hours 1) -RepetitionDuration (New-TimeSpan -Hours 7)

# 3. BOGA AI HEALTH CHECK - 06:00 NY
Set-BogaTask -Name "BOGA_AI_Health_Check" -Script "site_health_checker.py" -Args "--daily" -StartTime "06:00:00"

# ESKİ GÖREVLERİ TEMİZLE (Duplicate önlemek için)
try { Unregister-ScheduledTask -TaskName "BOGA_AI_Swing_Scanner" -Confirm:$false -ErrorAction SilentlyContinue } catch {}
try { Unregister-ScheduledTask -TaskName "BOGA_AI_Options_Scanner" -Confirm:$false -ErrorAction SilentlyContinue } catch {}
try { Unregister-ScheduledTask -TaskName "BOGA_AI_Options_PNL" -Confirm:$false -ErrorAction SilentlyContinue } catch {}
try { Unregister-ScheduledTask -TaskName "BOGA_AI_DailyBot" -Confirm:$false -ErrorAction SilentlyContinue } catch {}

Write-Host "BOGA AI bot pipeline reconfigured successfully. Use SISTEMI_GUNCELLE.bat to apply."
