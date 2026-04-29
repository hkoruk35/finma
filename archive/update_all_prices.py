
import json
import os
import yfinance as yf
from datetime import datetime
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')

DATA_DIR = 'frontend/public/data/latest'

def update_prices():
    # 1. Update all_tickers_list.json
    all_tickers_path = os.path.join(DATA_DIR, 'all_tickers_list.json')
    if not os.path.exists(all_tickers_path):
        logging.error("all_tickers_list.json not found")
        return

    with open(all_tickers_path, 'r', encoding='utf-8') as f:
        all_tickers_data = json.load(f)

    tickers_list = all_tickers_data.get('tickers', [])
    tickers = [s['ticker'] for s in tickers_list]
    logging.info(f"Updating prices for {len(tickers)} tickers...")

    # Fetch in chunks to avoid issues
    chunk_size = 50 # Smaller chunks
    price_map = {}
    import time
    import random

    for i in range(0, len(tickers), chunk_size):
        chunk = tickers[i:i+chunk_size]
        logging.info(f"Processing chunk {i//chunk_size + 1}/{(len(tickers)-1)//chunk_size + 1}...")
        try:
            data = yf.download(chunk, period="5d", interval="1d", progress=False, group_by='ticker', auto_adjust=True)
            for t in chunk:
                try:
                    if len(chunk) > 1:
                        df = data[t].dropna()
                    else:
                        df = data.dropna()
                    
                    if not df.empty:
                        price_map[t] = float(df['Close'].iloc[-1])
                except:
                    pass
            # Adaptive sleep to avoid rate limit
            time.sleep(random.uniform(2, 5))
        except Exception as e:
            logging.error(f"Error fetching chunk: {e}")
            time.sleep(10) # Longer sleep on error

    # 2. Apply updates to manifests
    updated_count = 0
    for s in tickers_list:
        t = s['ticker']
        if t in price_map:
            s['price'] = round(price_map[t], 2)
            updated_count += 1

    with open(all_tickers_path, 'w', encoding='utf-8') as f:
        json.dump(all_tickers_data, f, indent=2, ensure_ascii=False)
    logging.info(f"Updated {updated_count} prices in all_tickers_list.json")

    # 3. Update individual stock files
    stocks_dir = os.path.join(DATA_DIR, 'stocks')
    for t, price in price_map.items():
        stock_path = os.path.join(stocks_dir, f"{t}.json")
        if os.path.exists(stock_path):
            with open(stock_path, 'r', encoding='utf-8') as f:
                stock_data = json.load(f)
            
            # Update price
            old_price = stock_data.get('price', {}).get('current', price)
            ratio = price / old_price if old_price > 0 else 1.0
            
            stock_data['price']['current'] = round(price, 2)
            stock_data['price']['last_sync'] = datetime.now().isoformat()
            
            # Sync related fields if they exist
            if 'scores_detail' in stock_data and ratio != 1.0:
                sd = stock_data['scores_detail']
                for key in ['entry_range_low', 'entry_range_high', 'target_price', 'target_range_low', 'target_range_high', 'stop_loss', 'stop_range_low', 'stop_range_high']:
                    if key in sd and sd[key]:
                        sd[key] = round(sd[key] * ratio, 2)

            with open(stock_path, 'w', encoding='utf-8') as f:
                json.dump(stock_data, f, indent=2, ensure_ascii=False)

    # 4. Update options_picks.json (if exists)
    options_picks_path = 'frontend/public/transfer/latest/options_picks.json'
    if os.path.exists(options_picks_path):
        with open(options_picks_path, 'r', encoding='utf-8') as f:
            opt_data = json.load(f)
        
        for p in opt_data.get('picks', []):
            t = p['ticker']
            if t in price_map:
                p['current_price'] = round(price_map[t], 2)
        
        with open(options_picks_path, 'w', encoding='utf-8') as f:
            json.dump(opt_data, f, indent=2, ensure_ascii=False)

    logging.info("Systematic Price Sync Complete.")

if __name__ == "__main__":
    update_prices()
