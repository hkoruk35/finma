
$taskName = "BOGA_AI_Options_Scanner"
$action = New-ScheduledTaskAction -Execute "C:\Users\afksm\finma\venv313\Scripts\python.exe" -Argument "run_options_scanner.py" -WorkingDirectory "C:\Users\afksm\finma"

$trig1 = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday,Tuesday,Wednesday,Thursday,Friday -At 11:00am
$trig2 = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday,Tuesday,Wednesday,Thursday,Friday -At 3:30pm

$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 2)

# Eski v240 görevini kaldır (varsa)
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue

# v241 görevini kaydet
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trig1, $trig2 -Settings $settings -Force
Write-Host "DONE: BOGA_AI_Options_Scanner (v241) gorev olarak kaydedildi. 11:00 & 15:30 NY"
