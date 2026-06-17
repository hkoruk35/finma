# BOGA AI InDay313 Task Scheduler Kurulumu
# Yonetici PowerShell'de calistir:
#   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
#   .\setup_inday_task.ps1

$TaskName  = "BOGA_AI_IndayScanner"
$PythonExe = "C:\Users\afksm\finma\venv313\Scripts\python.exe"
$Script    = "C:\Users\afksm\finma\inday313.py"
$WorkDir   = "C:\Users\afksm\finma"

# Varsa sil
schtasks /delete /tn $TaskName /f 2>$null | Out-Null

# Action
$Action = New-ScheduledTaskAction `
    -Execute $PythonExe `
    -Argument "`"$Script`"" `
    -WorkingDirectory $WorkDir

# Trigger: Hafta ici her gun 08:45
$Trigger = New-ScheduledTaskTrigger `
    -Weekly `
    -DaysOfWeek Monday,Tuesday,Wednesday,Thursday,Friday `
    -At "08:45"

# Settings: 9 saat limit, crash'te 5dk'da 3 kez yeniden basla
$Settings = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit (New-TimeSpan -Hours 9) `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 5) `
    -StartWhenAvailable `
    -MultipleInstances IgnoreNew `
    -RunOnlyIfNetworkAvailable

# Principal: Mevcut kullanici, oturum acikken
$Principal = New-ScheduledTaskPrincipal `
    -UserId "$env:USERDOMAIN\$env:USERNAME" `
    -LogonType Interactive `
    -RunLevel Highest

# Gorevi kaydet
Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $Action `
    -Trigger $Trigger `
    -Settings $Settings `
    -Principal $Principal `
    -Description "BOGA AI Intraday Scanner - 08:45 ET baslar, 15:45 ET biter, saatte bir calisir." `
    -Force

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host " BOGA_AI_IndayScanner gorevi olusturuldu!" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host " Baslama : Her hafta ici 08:45 ET" -ForegroundColor White
Write-Host " Taramalar: 08:45, 09:45, 10:45, 11:45, 12:45, 13:45, 14:45, 15:45" -ForegroundColor White
Write-Host " GAP UP  : 15:45 ET (gun sonu ozel analiz)" -ForegroundColor White
Write-Host " Crash   : 5 dk icinde 3 kez yeniden baslatilir" -ForegroundColor White
Write-Host " Log     : C:\Users\afksm\finma\logs\inday313.log" -ForegroundColor White
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# Piyasa aciksa hemen basla
$nowUtc = [datetime]::UtcNow
$etZone = [System.TimeZoneInfo]::FindSystemTimeZoneById("Eastern Standard Time")
$nowEt  = [System.TimeZoneInfo]::ConvertTimeFromUtc($nowUtc, $etZone)
$isWeekday = $nowEt.DayOfWeek -notin @([DayOfWeek]::Saturday, [DayOfWeek]::Sunday)
$etMinutes = $nowEt.Hour * 60 + $nowEt.Minute
$inSession = ($etMinutes -ge (8*60+45)) -and ($nowEt.Hour -lt 16)
$etStr = $nowEt.ToString("HH:mm")

if ($isWeekday -and $inSession) {
    Write-Host "Piyasa seansinda ($etStr ET) -- bot simdi baslatiliyor..." -ForegroundColor Yellow
    Start-ScheduledTask -TaskName $TaskName
    Write-Host "Baslandi. Log: C:\Users\afksm\finma\logs\inday313.log" -ForegroundColor Green
} else {
    Write-Host "Piyasa kapali ($etStr ET). Bot yarin 08:45 ETde otomatik baslar." -ForegroundColor Gray
}
