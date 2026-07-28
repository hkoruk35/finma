$TaskName  = "BOGA_AI_DayTradeBot"
$FinmaDir  = "C:\Users\afksm\finma"
$Python    = "$FinmaDir\venv313\Scripts\python.exe"
$Script    = "$FinmaDir\daytrade_atmaca_v2.py"

if (-Not (Test-Path $Python)) { $Python = (Get-Command python -ErrorAction SilentlyContinue).Source }

$Command = "cmd.exe"
$ArgList = "/c $Python $Script --oneshot --now && $Python update_daytrade_performance.py && git add . && git commit -m 'Auto DayTrade Update' && git push"

Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue

$Action    = New-ScheduledTaskAction -Execute $Command -Argument $ArgList -WorkingDirectory $FinmaDir
$Trigger   = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday,Tuesday,Wednesday,Thursday,Friday -At "09:15"
# Simplified settings
$Settings  = New-ScheduledTaskSettingsSet -StartWhenAvailable
$Principal = New-ScheduledTaskPrincipal -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType InteractiveOrPassword -RunLevel Highest

Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -Principal $Principal -Description "BOGA AI DayTrade Bot - 09:15 NY" -Force

Write-Host "DayTrade Task Registered successfully for 09:15 NY weekdays."
