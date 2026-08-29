@echo off
REM Robinhood -> BOGA overnight SPY veri koprusunu surekli calistirir.
REM Ilk calistirmada robin_stocks interaktif login ister (kullanici adi/sifre/MFA).
REM Kapatmak icin bu pencereyi kapat / Ctrl+C.
REM Sistem genelindeki "python" bozuk oldugu icin diger botlarin kullandigi
REM venv313 sanal ortamiyla calistiriyoruz.
cd /d "%~dp0"
venv313\Scripts\python.exe robinhood_spy_sync.py
pause
