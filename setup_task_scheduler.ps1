$TaskName  = "BOGA_AI_DailyBot"
$FinmaDir  = "C:\Users\afksm\finma"
$Python    = "$FinmaDir\venv313\Scripts\python.exe"
$Script    = "$FinmaDir\run_all_bots.py"

if (-Not (Test-Path $Python)) { $Python = (Get-Command python -ErrorAction SilentlyContinue).Source }

Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue

$Action    = New-ScheduledTaskAction -Execute $Python -Argument $Script -WorkingDirectory $FinmaDir
$Trigger   = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday,Tuesday,Wednesday,Thursday,Friday -At "13:00"
$Settings  = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Hours 4) -MultipleInstances IgnoreNew -StartWhenAvailable -WakeToRun $false
$Principal = New-ScheduledTaskPrincipal -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType S4U -RunLevel Highest

Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -Principal $Principal -Description "BOGA AI Daily Bot - run_all_bots.py weekdays 13:00 NY (EDT)" -Force | Out-Null

$Task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($Task) {
    $Info = $Task | Get-ScheduledTaskInfo
    Write-Host "TASK_OK"
    Write-Host "Name    : $($Task.TaskName)"
    Write-Host "State   : $($Task.State)"
    Write-Host "Schedule: Weekdays 13:00 NY (EDT)"
    Write-Host "Script  : $Script"
    Write-Host "Python  : $Python"
    Write-Host "NextRun : $($Info.NextRunTime)"
    Write-Host "LastRun : $($Info.LastRunTime)"
} else {
    Write-Host "TASK_FAIL"
}
