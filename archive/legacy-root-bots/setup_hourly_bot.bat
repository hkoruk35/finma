@echo off
title BOGA AI Hourly Bot
echo Starting BOGA AI Hourly Bot...
:loop
.\venv313\Scripts\python.exe master_bot.py
echo Bot crashed or stopped. Restarting in 10 seconds...
timeout /t 10
goto loop
