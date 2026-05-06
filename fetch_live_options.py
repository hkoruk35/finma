import json
import os
import yfinance as yf
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

def get_atm_option(ticker, expiry_date, current_price, is_high_iv):
    try:
        tk = yf.Ticker(ticker)
        opt = tk.option_chain(expiry_date)
        
        calls = opt.calls
        
        # Find ATM Call
        # Strike closest to current price
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

import pandas as pd

def fetch_live_options():
    input_file = 'frontend/public/swing_all_picks.json'
    output_file = 'frontend/public/swing_options_live.json'
    
    if not os.path.exists(input_file):
        logging.error(f"{input_file} not found.")
        return
        
    with open(input_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    picks = data.get('picks', [])
    options_data = {}
    
    for pick in picks:
        ticker = pick.get('ticker')
        price = pick.get('current_price', 0)
        
        if not ticker or price == 0:
            continue
            
        logging.info(f"Fetching options for {ticker}...")
        
        # We want 45 DTE and 60 DTE
        exp_45 = get_closest_expiry(ticker, 45)
        exp_60 = get_closest_expiry(ticker, 60)
        
        ticker_opts = {}
        
        if exp_45:
            opt45 = get_atm_option(ticker, exp_45, price, False)
            if opt45:
                ticker_opts['dte_45'] = opt45
                
        if exp_60 and exp_60 != exp_45:
            opt60 = get_atm_option(ticker, exp_60, price, False)
            if opt60:
                ticker_opts['dte_60'] = opt60
                
        options_data[ticker] = ticker_opts
        
    # Save the data
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump({
            'generated_at': datetime.now().isoformat(),
            'options': options_data
        }, f, indent=2)
        
    logging.info(f"Saved options data for {len(options_data)} tickers to {output_file}")

if __name__ == "__main__":
    fetch_live_options()
