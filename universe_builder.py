import requests
import yfinance as yf
import pandas as pd
import json
import os
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor

def fetch_sec_tickers():
    print("Fetching tickers from SEC...")
    headers = {'User-Agent': 'BogaScreener/1.0 (admin@bogastock.com)'}
    r = requests.get('https://www.sec.gov/files/company_tickers.json', headers=headers)
    data = r.json()
    # Replace dashes and dots to match Yahoo Finance format (e.g. BRK.B)
    tickers = list(set([v['ticker'].replace('-', '-') for k,v in data.items()]))
    # Filter out warrants and units
    tickers = [t for t in tickers if not any(c in t for c in ['+', '=', 'W', 'U', '.'])]
    print(f"Total raw tickers: {len(tickers)}")
    return tickers

def process_chunk(chunk):
    df = yf.download(chunk, period="20d", group_by="ticker", threads=True, progress=False)
    valid_tickers = []
    
    # yfinance output structure changes based on 1 ticker vs multiple tickers
    if len(chunk) == 1:
        t = chunk[0]
        try:
            if not df.empty and not df['Close'].dropna().empty:
                price = df['Close'].iloc[-1].item() if hasattr(df['Close'].iloc[-1], 'item') else df['Close'].iloc[-1]
                avg_vol = df['Volume'].mean().item() if hasattr(df['Volume'].mean(), 'item') else df['Volume'].mean()
                dol_vol = price * avg_vol
                if price > 1.0 and dol_vol > 500_000:
                    valid_tickers.append({"ticker": t, "dol_vol": dol_vol})
        except: pass
    else:
        for t in chunk:
            try:
                if t not in df.columns.levels[0]: continue
                ticker_df = df[t]
                if ticker_df.empty or ticker_df['Close'].dropna().empty: continue
                
                price = ticker_df['Close'].iloc[-1].item() if hasattr(ticker_df['Close'].iloc[-1], 'item') else ticker_df['Close'].iloc[-1]
                avg_vol = ticker_df['Volume'].mean().item() if hasattr(ticker_df['Volume'].mean(), 'item') else ticker_df['Volume'].mean()
                dol_vol = price * avg_vol
                
                # Filter: Price > $1 and Average Dollar Volume > $500k
                if price > 1.0 and dol_vol > 500_000:
                    valid_tickers.append({"ticker": t, "dol_vol": dol_vol})
            except:
                pass
    return valid_tickers

def build_universe():
    print(f"[{datetime.now()}] Starting daily universe build...")
    tickers = fetch_sec_tickers()
    
    chunk_size = 500
    chunks = [tickers[i:i + chunk_size] for i in range(0, len(tickers), chunk_size)]
    
    all_valid = []
    
    print(f"Downloading historical data for {len(tickers)} tickers in {len(chunks)} chunks...")
    with ThreadPoolExecutor(max_workers=5) as executor:
        results = executor.map(process_chunk, chunks)
        for res in results:
            all_valid.extend(res)
            
    print(f"Found {len(all_valid)} valid tickers meeting liquidity requirements.")
    
    # Sort by Dollar Volume and pick top 1000
    all_valid.sort(key=lambda x: x["dol_vol"], reverse=True)
    top_1000 = [x["ticker"] for x in all_valid[:1000]]
    
    print(f"Top 1000 selected.")
    
    # Always include some crucial ETFs for regime detection and market view
    essential = ["SPY", "QQQ", "IWM", "VXX"]
    for e in essential:
        if e not in top_1000:
            top_1000.insert(0, e)
            
    # Save to frontend public data folder
    out_dir = os.path.join("frontend", "public", "data")
    os.makedirs(out_dir, exist_ok=True)
    
    out_file = os.path.join(out_dir, "daily_universe.json")
    with open(out_file, "w") as f:
        json.dump({
            "timestamp": datetime.now().isoformat(),
            "count": len(top_1000),
            "tickers": top_1000
        }, f, indent=2)
        
    print(f"[{datetime.now()}] Saved to {out_file}")

if __name__ == "__main__":
    build_universe()
