import json
import os
import yfinance as yf
import pandas as pd
from datetime import datetime, timedelta

def debug_sl():
    ticker = "ADPT"
    entry_date_str = "2026-05-08"
    entry_price = 14.69
    sl_price = round(entry_price * (1 + (-3.5 / 100)), 2)
    
    print(f"Auditing {ticker} on {entry_date_str}, entry {entry_price}, sl {sl_price}")
    
    entry_date = datetime.strptime(entry_date_str, '%Y-%m-%d')
    sl_hist = yf.Ticker(ticker).history(start=entry_date.strftime('%Y-%m-%d'), interval='1h')
    
    if not sl_hist.empty:
        sl_hist.index = sl_hist.index.tz_convert('America/New_York').tz_localize(None) if sl_hist.index.tzinfo else sl_hist.index
        print(f"Fetched {len(sl_hist)} bars.")
        
        mask = (sl_hist.index.normalize() > pd.Timestamp(entry_date)) | \
               ((sl_hist.index.normalize() == pd.Timestamp(entry_date)) & (sl_hist.index.hour >= 13))
        relevant_bars = sl_hist[mask]
        print(f"Relevant bars: {len(relevant_bars)}")
        
        for idx, row in relevant_bars.iterrows():
            print(f"  Bar {idx}: Low {row['Low']}, Open {row['Open']}")
            if row['Open'] <= sl_price:
                print(f"    HIT AT OPEN: {row['Open']}")
            elif row['Low'] <= sl_price:
                print(f"    HIT AT LOW: {sl_price}")

if __name__ == "__main__":
    debug_sl()
