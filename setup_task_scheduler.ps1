$TaskName = "BOGA_AI_DailyBot"
$FinmaDir = "C:\Users\afksm\finma"
$VenvPython = "$FinmaDir\venv313\Scripts\python.exe"
$Script = "$FinmaDir\run_all_bots.py"
$RunHourUTC = 13
$RunMinuteUTC = 5

if (-Not (Test-Path $VenvPython)) {
    $VenvPython = (Get-Command python).Source
}

Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue

$Action = New-ScheduledTaskAction -Execute $VenvPython -Argument "`"$Script`"" -WorkingDirectory $FinmaDir
$Trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday, Tuesday, Wednesday, Thursday, Friday -At ([datetime]"$([datetime]::Today.ToString('yyyy-MM-dd'))T$($RunHourUTC.ToString('00')):$($RunMinuteUTC.ToString('00')):00Z")
$Settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Hours 4) -MultipleInstances IgnoreNew -StartWhenAvailable -WakeToRun $false
$Principal = New-ScheduledTaskPrincipal -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType S4U -RunLevel Highest

Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -Principal $Principal -Description "BOGA AI Daily Bot" -Force | Out-Null

$Task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($Task) {
    Write-Host "Task successfully registered."
} else {
    Write-Host "Task failed to register."
}
