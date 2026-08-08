# BOGA AI Index Analysis — Task Scheduler kurulumu (SADECE yeni endeks botlari).
# Mevcut 6 canli goreve (Morning/Afternoon/Terminal Pulse/Options/Health/Swing Hourly)
# DOKUNULMAZ — sadece asagidaki 7 yeni gorev eklenir/guncellenir.
# Kaynak: scratch/setup_boga_tasks.ps1 (Set-BogaTask deseni ile birebir ayni).

$VENV_PY = "C:\Users\afksm\finma\venv313\Scripts\python.exe"
$FINMA_DIR = "C:\Users\afksm\finma"

$CurrentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
Write-Host "INFO: Tasks will be registered for user: $CurrentUser"

git config --global --add safe.directory $FINMA_DIR

function Set-BogaTask {
    param($Name, $Script, $Args, $StartTime, $DaysOfWeek = @("Monday","Tuesday","Wednesday","Thursday","Friday"))

    $Action = New-ScheduledTaskAction -Execute $VENV_PY -Argument "$Script $Args" -WorkingDirectory $FINMA_DIR
    $Trigger = New-ScheduledTaskTrigger -Weekly -At $StartTime -DaysOfWeek $DaysOfWeek
    $Principal = New-ScheduledTaskPrincipal -UserId $CurrentUser -LogonType S4U -RunLevel Highest
    $Settings = New-ScheduledTaskSettingsSet `
        -MultipleInstances IgnoreNew `
        -ExecutionTimeLimit (New-TimeSpan -Hours 2) `
        -WakeToRun:$false `
        -StartWhenAvailable
    $Settings.DisallowStartIfOnBatteries = $false
    $Settings.StopIfGoingOnBatteries = $false

    $Task = New-ScheduledTask -Action $Action -Trigger $Trigger -Principal $Principal -Settings $Settings

    try { Unregister-ScheduledTask -TaskName $Name -Confirm:$false -ErrorAction SilentlyContinue } catch {}
    Register-ScheduledTask -TaskName $Name -InputObject $Task -Force
    Enable-ScheduledTask -TaskName $Name
    Write-Host "OK: $Name gorev olusturuldu"
}

# Sistem saati Eastern (ET). Avrupa yerel tetik saatleri (Berlin/Paris/Madrid/Amsterdam
# 08:30/13:00/17:45 CET, London 07:30/12:00/16:45 GMT) ~-6h/-5h ile ET'ye cevrildi.
Set-BogaTask -Name "BOGA_AI_Index_EU_PreMarket" -Script "index_daily_analyzer.py" -Args "--symbols=DAX,FTSE100,CAC40,IBEX35,STOXX600" -StartTime "02:30:00"
Set-BogaTask -Name "BOGA_AI_Index_EU_Midday"    -Script "index_daily_analyzer.py" -Args "--symbols=DAX,FTSE100,CAC40,IBEX35,STOXX600" -StartTime "07:00:00"
Set-BogaTask -Name "BOGA_AI_Index_US_PreMarket" -Script "index_daily_analyzer.py" -Args "--symbols=SPX,NDX,DJI,RUT" -StartTime "09:00:00"
Set-BogaTask -Name "BOGA_AI_Index_EU_Closing"   -Script "index_daily_analyzer.py" -Args "--symbols=DAX,FTSE100,CAC40,IBEX35,STOXX600" -StartTime "11:45:00"
Set-BogaTask -Name "BOGA_AI_Index_US_Midday"    -Script "index_daily_analyzer.py" -Args "--symbols=SPX,NDX,DJI,RUT" -StartTime "13:00:00"
Set-BogaTask -Name "BOGA_AI_Index_US_Closing"   -Script "index_daily_analyzer.py" -Args "--symbols=SPX,NDX,DJI,RUT" -StartTime "16:30:00"
Set-BogaTask -Name "BOGA_AI_Index_Weekly"       -Script "index_weekly_analyzer.py" -Args "" -StartTime "17:00:00" -DaysOfWeek @("Friday")

Write-Host "DONE: 7 BOGA AI Index Analysis gorevi kuruldu/guncellendi. Mevcut diger gorevlere dokunulmadi."
