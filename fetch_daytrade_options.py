import json
import os
import yfinance as yf
import pandas as pd
from datetime import datetime, timedelta
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')

def get_closest_expiry(ticker, target_dte):
    try:
        tk = yf.Ticker(ticker)
        expirations = tk.options
        if not expirations:
            return None
            
        today = datetime.now()
        closest_exp = None
        min_diff = 9999
        
        for exp in expirations:
            exp_date = datetime.strptime(exp, '%Y-%m-%d')
            dte = (exp_date - today).days
            
            diff = abs(dte - target_dte)
            if diff < min_diff:
                min_diff = diff
                closest_exp = exp
                
        return closest_exp
    except Exception as e:
        logging.error(f"Error getting expiry for {ticker}: {e}")
        return None

def get_atm_option(ticker, expiry_date, current_price):
    try:
        tk = yf.Ticker(ticker)
        opt = tk.option_chain(expiry_date)
        
        calls = opt.calls
        if calls.empty:
            return None
            
        # Find ATM Call (Strike closest to current price)
        calls['distance'] = abs(calls['strike'] - current_price)
        atm_call = calls.sort_values('distance').iloc[0]
        
        return {
            'strike': float(atm_call['strike']),
            'lastPrice': float(atm_call['lastPrice']),
            'bid': float(atm_call['bid']),
            'ask': float(atm_call['ask']),
            'volume': int(atm_call['volume']) if not pd.isna(atm_call['volume']) else 0,
            'openInterest': int(atm_call['openInterest']) if not pd.isna(atm_call['openInterest']) else 0,
            'impliedVolatility': float(atm_call['impliedVolatility']),
            'expiry': expiry_date,
            'type': 'CALL'
        }
    except Exception as e:
        logging.error(f"Error getting ATM option for {ticker} at {expiry_date}: {e}")
        return None

def fetch_daytrade_options():
    input_file = 'frontend/public/daytrade_picks.json'
    output_file = 'frontend/public/daytrade_options_live.json'
    
    if not os.path.exists(input_file):
        logging.error(f"{input_file} not found. Running DayTrade bot first might be needed.")
        return
        
    with open(input_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    picks = data.get('picks', [])
    options_data = {}
    
    # Process only top candidates to avoid hitting rate limits
    for pick in picks[:15]:
        ticker = pick.get('ticker')
        price = pick.get('price', 0)
        
        if not ticker or price == 0:
            continue
            
        logging.info(f"Fetching DayTrade options for {ticker}...")
        
        # We want 30, 45, and 60 DTE
        exp_30 = get_closest_expiry(ticker, 30)
        exp_45 = get_closest_expiry(ticker, 45)
        exp_60 = get_closest_expiry(ticker, 60)
        
        ticker_opts = {}
        
        for dte_label, exp in [('dte_30', exp_30), ('dte_45', exp_45), ('dte_60', exp_60)]:
            if exp:
                opt = get_atm_option(ticker, exp, price)
                if opt:
                    ticker_opts[dte_label] = opt
                
        options_data[ticker] = ticker_opts
        
    # Save the data
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump({
            'generated_at': datetime.now().isoformat(),
            'options': options_data
        }, f, indent=2)
        
    logging.info(f"Saved DayTrade options data for {len(options_data)} tickers to {output_file}")

if __name__ == "__main__":
    fetch_daytrade_options()
