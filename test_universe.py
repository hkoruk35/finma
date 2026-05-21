import requests
import yfinance as yf
import pandas as pd
import json

def build_universe():
    print("Fetching tickers from SEC...")
    r = requests.get('https://www.sec.gov/files/company_tickers.json', headers={'User-Agent': 'MyApp/1.0 (admin@example.com)'})
    data = r.json()
    tickers = list(set([v['ticker'].replace('-', '-') for k,v in data.items()]))
    # Filter out warrants and units (rough filter)
    tickers = [t for t in tickers if not any(c in t for c in ['+', '=', 'W', 'U', '.'])]
    print(f"Total pure tickers: {len(tickers)}")
    
    # Download 20 days of history for all tickers
    print("Downloading 20d data for all tickers...")
    # Batched download is faster, but we can do it all at once if memory allows
    # For safety, let's just do 5000 first
    df = yf.download(tickers[:5000], period="20d", group_by="ticker", threads=True, progress=False)
    
    valid_tickers = []
    for t in tickers[:5000]:
        try:
            if t not in df.columns.levels[0]: continue
            ticker_df = df[t]
            if ticker_df.empty or ticker_df['Close'].dropna().empty: continue
            
            price = ticker_df['Close'].iloc[-1]
            avg_vol = ticker_df['Volume'].mean()
            dol_vol = price * avg_vol
            
            if price > 1 and dol_vol > 1_000_000:
                valid_tickers.append({"ticker": t, "dol_vol": dol_vol})
        except:
            pass
            
    valid_tickers.sort(key=lambda x: x["dol_vol"], reverse=True)
    top_1000 = [x["ticker"] for x in valid_tickers[:1000]]
    print(f"Found {len(valid_tickers)} valid, selected top {len(top_1000)}")
    print("Sample:", top_1000[:10])
    
build_universe()
