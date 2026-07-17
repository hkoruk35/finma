# BOGA AI Performance Hourly Update Task Setup
$TaskName = "BOGA_AI_Performance_Hourly"
$PythonPath = "C:\Users\afksm\finma\venv313\Scripts\python.exe"
$ScriptPath = "C:\Users\afksm\finma\run_performance_hourly.py"
$WorkingDir = "C:\Users\afksm\finma"

$Action = New-ScheduledTaskAction -Execute $PythonPath -Argument $ScriptPath -WorkingDirectory $WorkingDir

# Hafta içi her gün 10:00'da başlasın, 7 saat boyunca her saat başı çalışsın (10, 11, 12, 1, 2, 3, 4)
$StartTime = "10:00AM"
$Trigger = New-ScheduledTaskTrigger -Weekly -At $StartTime -DaysOfWeek Monday,Tuesday,Wednesday,Thursday,Friday

# 🔄 Saatlik tekrar ekle (1 hour interval for 7 hours total)
$RepetitionTrigger = New-ScheduledTaskTrigger -Once -At $StartTime -RepetitionInterval (New-TimeSpan -Hours 1) -RepetitionDuration (New-TimeSpan -Hours 7)
$Trigger.Repetition = $RepetitionTrigger.Repetition

# Ensure git recognizes this directory as safe for the current user
git config --global --add safe.directory $WorkingDir

$CurrentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name

try { Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue } catch {}

Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -Description "BOGA AI Swing Performance Hourly Tracker (10:00-16:30)" -User $CurrentUser -Force
Enable-ScheduledTask -TaskName $TaskName

Write-Host "DONE: Performance Hourly Task registered for ${CurrentUser}: 10:00 to 16:30 NY time."
