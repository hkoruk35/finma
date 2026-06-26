$FinmaDir  = "C:\Users\afksm\finma"
$Python    = "$FinmaDir\venv313\Scripts\python.exe"
if (-Not (Test-Path $Python)) { $Python = (Get-Command python -ErrorAction SilentlyContinue).Source }

$Principal = New-ScheduledTaskPrincipal -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType S4U -RunLevel Highest
$Settings  = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Hours 2) -MultipleInstances IgnoreNew -StartWhenAvailable -WakeToRun:$false

function Register-Top100Task {
    param($Name, $Script, $Trigger, $Description)
    Unregister-ScheduledTask -TaskName $Name -Confirm:$false -ErrorAction SilentlyContinue
    $Action = New-ScheduledTaskAction -Execute $Python -Argument "$FinmaDir\$Script" -WorkingDirectory $FinmaDir
    Register-ScheduledTask -TaskName $Name -Action $Action -Trigger $Trigger -Settings $Settings -Principal $Principal -Description $Description -Force | Out-Null
    $Task = Get-ScheduledTask -TaskName $Name -ErrorAction SilentlyContinue
    if ($Task) {
        $Info = $Task | Get-ScheduledTaskInfo
        Write-Host "OK   $Name -> NextRun: $($Info.NextRunTime)"
    } else {
        Write-Host "FAIL $Name"
    }
}

# 1) 90'lik sabit liste — haftalik, Cuma 23:59 NY
$T1 = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Friday -At "23:59"
Register-Top100Task -Name "BOGA_AI_Top100_Fixed90" -Script "update_top100_fixed.py" -Trigger $T1 `
    -Description "Top 100 Tracker - 90'lik sabit liste (hacme gore /tracker'dan) - haftalik Cuma 23:59 NY"

# 2) 10'luk gunluk swing dilimi — gunluk, 14:00 NY
$T2 = New-ScheduledTaskTrigger -Daily -At "14:00"
Register-Top100Task -Name "BOGA_AI_Top100_Swing10" -Script "update_top100_swing.py" -Trigger $T2 `
    -Description "Top 100 Tracker - 10'luk gunluk swing dilimi (skora gore /swing'den) - gunluk 14:00 NY"
