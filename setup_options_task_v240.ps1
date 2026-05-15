
$taskName = "BOGA_AI_Options_Scanner"
$action = New-ScheduledTaskAction -Execute "C:\Users\afksm\finma\venv313\Scripts\python.exe" -Argument "run_options_scanner.py" -WorkingDirectory "C:\Users\afksm\finma"
$trigger1 = New-ScheduledTaskTrigger -Daily -At 11:00am
$trigger2 = New-ScheduledTaskTrigger -Daily -At 3:30pm
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger1,$trigger2 -Settings $settings -Force
