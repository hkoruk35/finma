@echo off
echo [FinMA] Islemleriniz kaydediliyor...
git add .
set /p msg="Commit mesaji girin (veya enter basin): "
if "%msg%"=="" set msg="Update: Portfolio management and UI enhancements"
git commit -m "%msg%"
echo [FinMA] Sunucuya gonderiliyor...
git push origin main
echo [FinMA] Tamamlandi! Sunucu 1-2 dakika icinde guncellenecektir.
pause
