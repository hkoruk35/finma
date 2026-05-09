@echo off
cd /d C:\Users\afksm\finma
echo [START] BOGA AI DAYTRADE PIPELINE...
venv313\Scripts\python.exe daytrade_atmaca_v2.py --oneshot --now
venv313\Scripts\python.exe update_daytrade_performance.py
echo [SYNC] Pushing results to GitHub...
git add .
git commit -m "Auto DayTrade Update %date% %time%"
git push
echo [DONE] DayTrade Pipeline complete.
