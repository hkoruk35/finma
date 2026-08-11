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
    # DIKKAT: parametre adi $Args OLAMAZ. $Args PowerShell'in otomatik degiskeni
    # (fonksiyona bagli olmayan argumanlar dizisi). Ayni adla parametre
    # tanimlandiginda cagirandaki -Args degeri SESSIZCE dusuyor ve
    # "$Script $Args" sadece "index_daily_analyzer.py " olarak uretiliyor —
    # hata da vermiyor. Sonucu: bu dosyadaki TUM --symbols/--only-missing
    # bayraklari hicbir zaman goreve islenmedi.
    param($Name, $Script, $ScriptArgs, $StartTime, $DaysOfWeek = @("Monday","Tuesday","Wednesday","Thursday","Friday"))

    $Action = New-ScheduledTaskAction -Execute $VENV_PY -Argument "$Script $ScriptArgs" -WorkingDirectory $FINMA_DIR
    
    $Triggers = @()
    if ($StartTime -is [array]) {
        foreach ($Time in $StartTime) {
            $Triggers += New-ScheduledTaskTrigger -Weekly -At $Time -DaysOfWeek $DaysOfWeek
        }
    } else {
        $Triggers += New-ScheduledTaskTrigger -Weekly -At $StartTime -DaysOfWeek $DaysOfWeek
    }

    $Principal = New-ScheduledTaskPrincipal -UserId $CurrentUser -LogonType S4U -RunLevel Highest
    $Settings = New-ScheduledTaskSettingsSet `
        -MultipleInstances IgnoreNew `
        -ExecutionTimeLimit (New-TimeSpan -Hours 2) `
        -WakeToRun:$false `
        -StartWhenAvailable
    $Settings.DisallowStartIfOnBatteries = $false
    $Settings.StopIfGoingOnBatteries = $false

    $Task = New-ScheduledTask -Action $Action -Trigger $Triggers -Principal $Principal -Settings $Settings

    try { Unregister-ScheduledTask -TaskName $Name -Confirm:$false -ErrorAction SilentlyContinue } catch {}
    Register-ScheduledTask -TaskName $Name -InputObject $Task -Force
    Enable-ScheduledTask -TaskName $Name
    Write-Host "OK: $Name gorev olusturuldu"
}

# Eski gereksiz gorevleri temizle
try { Unregister-ScheduledTask -TaskName "BOGA_AI_Index_EU_PreMarket" -Confirm:$false -ErrorAction SilentlyContinue } catch {}
try { Unregister-ScheduledTask -TaskName "BOGA_AI_Index_EU_Midday" -Confirm:$false -ErrorAction SilentlyContinue } catch {}
try { Unregister-ScheduledTask -TaskName "BOGA_AI_Index_Weekly" -Confirm:$false -ErrorAction SilentlyContinue } catch {}

# --- GUNLUK ANALIZLER (Local Close + 5 Dk ET karsiliklari) ---
#
# NOT (2026-08-10): Canlida kayitli gorevlerin hicbirinde arguman yoktu (hepsi
# duz "index_daily_analyzer.py"), yani her gorev 21 sembolun tamamini
# tariyordu. Sebebi kayit drift'i DEGIL, yukaridaki $Args hatasiydi — bu dosya
# yeniden calistirildiginda bile bayraklar goreve gecmiyordu.
# Degisiklikler FIX_INDEX_TASKS_ADMIN.bat / FIX_TASKS_20260810_ADMIN.bat ile uygulanir.
Set-BogaTask -Name "BOGA_AI_Index_Asia_Daily1"  -Script "index_daily_analyzer.py" -ScriptArgs "--symbols=NIKKEI225,ASX200" -StartTime "02:05:00"
Set-BogaTask -Name "BOGA_AI_Index_Asia_Daily2"  -Script "index_daily_analyzer.py" -ScriptArgs "--symbols=KOSPI" -StartTime "02:35:00"
Set-BogaTask -Name "BOGA_AI_Index_Asia_Daily3"  -Script "index_daily_analyzer.py" -ScriptArgs "--symbols=SHANGHAI" -StartTime "03:05:00"
Set-BogaTask -Name "BOGA_AI_Index_Asia_Daily4"  -Script "index_daily_analyzer.py" -ScriptArgs "--symbols=HANGSENG" -StartTime "04:05:00"
Set-BogaTask -Name "BOGA_AI_Index_Asia_Daily5"  -Script "index_daily_analyzer.py" -ScriptArgs "--symbols=NIFTY50" -StartTime "06:05:00"

# Avrupa: 11:35 ET, DAX/CAC/IBEX/STOXX/MIB/SMI/AEX'in tetik saatiyle (17:35 yerel)
# TAM AYNI dakikaydi — sifir tolerans. 11:45'e alindi (kapanistan 15 dk sonra).
Set-BogaTask -Name "BOGA_AI_Index_EU_Closing"   -Script "index_daily_analyzer.py" -ScriptArgs "--symbols=DAX,FTSE100,CAC40,IBEX35,STOXX600,FTSEMIB,SMI,AEX" -StartTime "11:45:00"

# 16:05 ET'de ABD kapanisi ile LatAm kapanisi ust uste biniyordu (sahibin
# 2026-08-10 talebi): once ABD, 5 dk sonra LatAm.
Set-BogaTask -Name "BOGA_AI_Index_LatAm_Daily1" -Script "index_daily_analyzer.py" -ScriptArgs "--symbols=BOVESPA,MERVAL,IPCMEXICO" -StartTime "16:10:00"

# Gunun kurtarma koşusu: US/EU/LatAm'da eksik veya AI'siz kalmis ne varsa
# tamamlar (--only-missing sayesinde tamam olanlara dokunmaz).
Set-BogaTask -Name "BOGA_AI_Index_LatAm_Daily2" -Script "index_daily_analyzer.py" -ScriptArgs "--only-missing --symbols=SPX,NDX,DJI,RUT,DAX,FTSE100,CAC40,IBEX35,STOXX600,FTSEMIB,SMI,AEX,BOVESPA,MERVAL,IPCMEXICO" -StartTime "17:05:00"

# Son temizlik: quant verisi saglam ama DeepSeek dustugu icin ai_narrative'i
# NULL kalmis satirlari onarir. 17:05 kurtarma kosusunun ARKASINA konumlandi
# (15 dk pay) — cunku o kosu da yeni satir yazabiliyor.
#
# Neden --only-missing yetmiyor: index_daily_analyzer fiyati borsadan YENIDEN
# ceker, yani gecmis bir "midday" satirini 17:20'de kosturmak dogru kaydin
# uzerine kapanis sonrasi fiyatlari yazar. Backfill fiyata hic dokunmaz,
# satirda saklanan quant_snapshot'tan sadece yorumu yeniden uretir.
#
# --days 3: Pazartesi kosusu Cuma/Cumartesi/Pazar'da kalmis satirlari da toplar.
Set-BogaTask -Name "BOGA_AI_Index_Narrative_Backfill" -Script "index_narrative_backfill.py" -ScriptArgs "--days 3" -StartTime "17:20:00"

# --- ABD GUNLUK ANALIZLERI (Mevcut Sabit Yapi) ---
Set-BogaTask -Name "BOGA_AI_Index_US_PreMarket" -Script "index_daily_analyzer.py" -ScriptArgs "--symbols=SPX,NDX,DJI,RUT" -StartTime "09:00:00"
Set-BogaTask -Name "BOGA_AI_Index_US_Midday"    -Script "index_daily_analyzer.py" -ScriptArgs "--symbols=SPX,NDX,DJI,RUT" -StartTime "13:00:00"
Set-BogaTask -Name "BOGA_AI_Index_US_Closing"   -Script "index_daily_analyzer.py" -ScriptArgs "--symbols=SPX,NDX,DJI,RUT" -StartTime "16:05:00"

# --- HAFTALIK ANALIZLER (Cumartesi Staggering) ---
Set-BogaTask -Name "BOGA_AI_Index_Weekly_SPX" -Script "index_weekly_analyzer.py" -ScriptArgs "--symbols=SPX" -StartTime "10:00:00" -DaysOfWeek @("Saturday")
Set-BogaTask -Name "BOGA_AI_Index_Weekly_NDX" -Script "index_weekly_analyzer.py" -ScriptArgs "--symbols=NDX" -StartTime "11:00:00" -DaysOfWeek @("Saturday")
Set-BogaTask -Name "BOGA_AI_Index_Weekly_DJI" -Script "index_weekly_analyzer.py" -ScriptArgs "--symbols=DJI" -StartTime "12:00:00" -DaysOfWeek @("Saturday")
Set-BogaTask -Name "BOGA_AI_Index_Weekly_RUT" -Script "index_weekly_analyzer.py" -ScriptArgs "--symbols=RUT" -StartTime "13:00:00" -DaysOfWeek @("Saturday")
Set-BogaTask -Name "BOGA_AI_Index_Weekly_DAX" -Script "index_weekly_analyzer.py" -ScriptArgs "--symbols=DAX" -StartTime "14:00:00" -DaysOfWeek @("Saturday")
Set-BogaTask -Name "BOGA_AI_Index_Weekly_FTSE100" -Script "index_weekly_analyzer.py" -ScriptArgs "--symbols=FTSE100" -StartTime "15:00:00" -DaysOfWeek @("Saturday")
Set-BogaTask -Name "BOGA_AI_Index_Weekly_CAC40" -Script "index_weekly_analyzer.py" -ScriptArgs "--symbols=CAC40" -StartTime "16:00:00" -DaysOfWeek @("Saturday")
Set-BogaTask -Name "BOGA_AI_Index_Weekly_IBEX35" -Script "index_weekly_analyzer.py" -ScriptArgs "--symbols=IBEX35" -StartTime "17:00:00" -DaysOfWeek @("Saturday")
Set-BogaTask -Name "BOGA_AI_Index_Weekly_STOXX600" -Script "index_weekly_analyzer.py" -ScriptArgs "--symbols=STOXX600" -StartTime "18:00:00" -DaysOfWeek @("Saturday")
Set-BogaTask -Name "BOGA_AI_Index_Weekly_FTSEMIB" -Script "index_weekly_analyzer.py" -ScriptArgs "--symbols=FTSEMIB" -StartTime "19:00:00" -DaysOfWeek @("Saturday")
Set-BogaTask -Name "BOGA_AI_Index_Weekly_SMI" -Script "index_weekly_analyzer.py" -ScriptArgs "--symbols=SMI" -StartTime "20:00:00" -DaysOfWeek @("Saturday")
Set-BogaTask -Name "BOGA_AI_Index_Weekly_AEX" -Script "index_weekly_analyzer.py" -ScriptArgs "--symbols=AEX" -StartTime "21:00:00" -DaysOfWeek @("Saturday")
Set-BogaTask -Name "BOGA_AI_Index_Weekly_BOVESPA" -Script "index_weekly_analyzer.py" -ScriptArgs "--symbols=BOVESPA" -StartTime "22:00:00" -DaysOfWeek @("Saturday")
Set-BogaTask -Name "BOGA_AI_Index_Weekly_IPCMEXICO" -Script "index_weekly_analyzer.py" -ScriptArgs "--symbols=IPCMEXICO" -StartTime "23:00:00" -DaysOfWeek @("Saturday")

# --- HAFTALIK ANALIZLER (Pazar Staggering) ---
Set-BogaTask -Name "BOGA_AI_Index_Weekly_MERVAL" -Script "index_weekly_analyzer.py" -ScriptArgs "--symbols=MERVAL" -StartTime "10:00:00" -DaysOfWeek @("Sunday")
Set-BogaTask -Name "BOGA_AI_Index_Weekly_NIKKEI225" -Script "index_weekly_analyzer.py" -ScriptArgs "--symbols=NIKKEI225" -StartTime "11:00:00" -DaysOfWeek @("Sunday")
Set-BogaTask -Name "BOGA_AI_Index_Weekly_HANGSENG" -Script "index_weekly_analyzer.py" -ScriptArgs "--symbols=HANGSENG" -StartTime "12:00:00" -DaysOfWeek @("Sunday")
Set-BogaTask -Name "BOGA_AI_Index_Weekly_SHANGHAI" -Script "index_weekly_analyzer.py" -ScriptArgs "--symbols=SHANGHAI" -StartTime "13:00:00" -DaysOfWeek @("Sunday")
Set-BogaTask -Name "BOGA_AI_Index_Weekly_KOSPI" -Script "index_weekly_analyzer.py" -ScriptArgs "--symbols=KOSPI" -StartTime "14:00:00" -DaysOfWeek @("Sunday")
Set-BogaTask -Name "BOGA_AI_Index_Weekly_NIFTY50" -Script "index_weekly_analyzer.py" -ScriptArgs "--symbols=NIFTY50" -StartTime "15:00:00" -DaysOfWeek @("Sunday")
Set-BogaTask -Name "BOGA_AI_Index_Weekly_ASX200" -Script "index_weekly_analyzer.py" -ScriptArgs "--symbols=ASX200" -StartTime "16:00:00" -DaysOfWeek @("Sunday")

Write-Host "DONE: Tum kuresel endeks gorevleri basariyla kuruldu/guncellendi."
