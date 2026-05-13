# BOGA AI Performance Hourly Update Task Setup
$TaskName = "BOGA_AI_Performance_Hourly"
$PythonPath = "C:\Users\afksm\finma\venv313\Scripts\python.exe"
$ScriptPath = "C:\Users\afksm\finma\update_swing_performance.py"
$WorkingDir = "C:\Users\afksm\finma"

$Action = New-ScheduledTaskAction -Execute $PythonPath -Argument $ScriptPath -WorkingDirectory $WorkingDir

# Hafta içi her gün 10:00'da başlasın, 7 saat boyunca her saat başı çalışsın (10, 11, 12, 1, 2, 3, 4)
$StartTime = "10:00AM"
$Trigger = New-ScheduledTaskTrigger -Weekly -At $StartTime -DaysOfWeek Monday,Tuesday,Wednesday,Thursday,Friday

# 🔄 Saatlik tekrar ekle (1 hour interval for 7 hours total)
$Trigger.Repetition.Interval = "PT1H"
$Trigger.Repetition.Duration = "PT7H"

try { Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue } catch {}

Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Description "BOGA AI Swing Performance Hourly Tracker (10:00-16:30)"
Enable-ScheduledTask -TaskName $TaskName

Write-Host "✅ Performance Hourly Task registered: 10:00 to 16:30 NY time."
