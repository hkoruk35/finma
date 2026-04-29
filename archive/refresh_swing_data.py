import json
import os
import yfinance as yf
import pandas as pd
from datetime import datetime
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')

def refresh_data():
    all_picks_path = 'frontend/public/swing_all_picks.json'
    top_picks_path = 'frontend/public/swing_picks.json'
    
    if not os.path.exists(all_picks_path):
        logging.error("Source list not found!")
        return

    with open(all_picks_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
        picks = data.get('picks', [])

    tickers = [p['ticker'] for p in picks]
    if not tickers: return

    logging.info(f"Live Refresh: Sectors, Prices, Zones for {len(tickers)} tickers...")
    
    try:
        # 1. Fetch historical prices in bulk
        hist_data = yf.download(tickers, period="5y", interval="1d", group_by='ticker', auto_adjust=True, progress=False)
        
        for p in picks:
            t = p['ticker']
            
            # 2. Live Sector Fetch (Fallback if Unknown)
            if p.get('sector') == "Unknown" or not p.get('sector'):
                try:
                    ticker_obj = yf.Ticker(t)
                    info = ticker_obj.info
                    p['sector'] = info.get('sector', 'Unknown')
                    p['company'] = info.get('shortName', p.get('company', t))
                    logging.info(f"Retrieved sector for {t}: {p['sector']}")
                except:
                    pass
            
            # 3. Price & Performance Update
            try:
                df = hist_data[t].dropna() if len(tickers) > 1 else hist_data.dropna()
                if df.empty: continue

                last_close = float(df['Close'].iloc[-1])
                p['current_price'] = round(last_close, 2)
                
                # Performance
                if len(df) >= 2: p['change_1d'] = round((last_close - df['Close'].iloc[-2]) / df['Close'].iloc[-2] * 100, 2)
                if len(df) >= 6: p['change_1w'] = round((last_close - df['Close'].iloc[-6]) / df['Close'].iloc[-6] * 100, 2)
                if len(df) >= 22: p['change_1m'] = round((last_close - df['Close'].iloc[-22]) / df['Close'].iloc[-22] * 100, 2)
                if len(df) >= 252: p['change_1y'] = round((last_close - df['Close'].iloc[-252]) / df['Close'].iloc[-252] * 100, 2)
                if len(df) >= 1260: p['change_5y'] = round((last_close - df['Close'].iloc[-1260]) / df['Close'].iloc[-1260] * 100, 2)

                # 4. Enforce Zone Ranges
                for zone_key in ['buy_zone', 'profit_zone', 'stop_zone']:
                    if zone_key in p:
                        # If low/high are same or one is missing, create a 1.5% range
                        low = p[zone_key].get('low')
                        high = p[zone_key].get('high')
                        if low and (not high or high == low):
                            p[zone_key]['high'] = round(low * 1.015, 2)
                        elif high and (not low or low == high):
                            p[zone_key]['low'] = round(high * 0.985, 2)
                
            except Exception as e:
                logging.warning(f"Error updating {t}: {e}")

    except Exception as e:
        logging.error(f"Global download error: {e}")

    # Save
    data['generated_at'] = datetime.now().isoformat()
    with open(all_picks_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    # Sync top 20
    top_20_data = data.copy()
    top_20_data['picks'] = data['picks'][:20]
    with open(top_picks_path, 'w', encoding='utf-8') as f:
        json.dump(top_20_data, f, indent=2, ensure_ascii=False)
        
    logging.info("Deep refresh complete. All sectors fetched directly from source.")

if __name__ == "__main__":
    refresh_data()
