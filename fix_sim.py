import sys

with open('update_swing_performance.py', 'r', encoding='utf-8') as f:
    content = f.read()

import re
# Find simulate_trade function
match = re.search(r'def simulate_trade.*?def update_performance', content, re.DOTALL)
if not match:
    print("Function not found")
    sys.exit(1)

new_func = '''def simulate_trade(record, ticker_df):
    from datetime import datetime
    import math
    try:
        entry_date = datetime.strptime(record['date'], '%Y-%m-%d')
    except Exception:
        return None

    trade_idx = ticker_df.index[ticker_df.index >= entry_date]
    if len(trade_idx) == 0:
        return None

    recorded_entry = record.get('entry')
    if recorded_entry and float(recorded_entry) > 0:
        entry_price = float(recorded_entry)
    else:
        if len(trade_idx) > 1:
            entry_price = float(ticker_df.loc[trade_idx[1], 'Open'])
        else:
            entry_price = float(ticker_df.loc[trade_idx[0], 'Open'])

    profit_target = record.get('profit_target')
    if profit_target:
        profit_target = float(profit_target)
        
    closes = ticker_df['Close']
    highs = ticker_df['High'] if 'High' in ticker_df else closes
    lows = ticker_df['Low'] if 'Low' in ticker_df else closes
    opens = ticker_df['Open'] if 'Open' in ticker_df else closes
    ema_series = closes.ewm(span=50, adjust=False).mean()

    peak_price = entry_price
    peak_date = record.get('peak_date') or record['date']
    result = 'PENDING'
    return_pct = 0.0
    exit_date = None
    last_days_held = 0
    
    t0_dt = trade_idx[0]
    t0_close = float(closes.loc[t0_dt])
    t0_loc = ticker_df.index.get_loc(t0_dt)
    if t0_loc >= 14:
        tr_list = []
        for i in range(t0_loc - 13, t0_loc + 1):
            h = float(highs.iloc[i])
            l = float(lows.iloc[i])
            pc = float(closes.iloc[i - 1])
            tr_list.append(max(h - l, abs(h - pc), abs(l - pc)))
        atr14 = sum(tr_list) / len(tr_list)
    else:
        atr14 = t0_close * 0.02
    
    targets = [3, 5, 7, 10, 15, 20]
    hits = {t: False for t in targets}
    days_to_hit = {t: None for t in targets}
    
    min_low = entry_price
    last_ema50 = float(ema_series.loc[t0_dt])
    last_price = entry_price
    
    for dt in trade_idx:
        days_held = (dt.to_pydatetime() - entry_date).days
        if days_held <= 0:
            continue

        price = float(closes.loc[dt])
        high = float(highs.loc[dt])
        low = float(lows.loc[dt])
        if math.isnan(price) or price <= 0:
            continue

        ema50 = float(ema_series.loc[dt])
        last_ema50 = ema50
        last_price = price
        last_days_held = days_held
        
        if high > peak_price:
            peak_price = high
            peak_date = dt.strftime('%Y-%m-%d')
        if low < min_low:
            min_low = low
            
        current_ret = ((price - entry_price) / entry_price) * 100
        loss_at_ema = ((ema50 - entry_price) / entry_price) * 100
        
        for t_pct in targets:
            t_price = entry_price * (1 + t_pct / 100)
            if high >= t_price and not hits[t_pct]:
                hits[t_pct] = True
                days_to_hit[t_pct] = days_held

        if days_held <= 60:
            if profit_target and high >= profit_target:
                result, return_pct, exit_date = "WIN", round(((profit_target - entry_price) / entry_price) * 100, 2), dt.strftime("%Y-%m-%d")
                break
            elif not profit_target and current_ret >= 5.0:
                result, return_pct, exit_date = "WIN", round(current_ret, 2), dt.strftime("%Y-%m-%d")
                break
                
            if days_held > 15:
                if price <= ema50 and loss_at_ema <= -8.0:
                    result, return_pct, exit_date = "LOSS", round(loss_at_ema, 2), dt.strftime("%Y-%m-%d")
                    break
        else:
            peak_pct = round(((peak_price - entry_price) / entry_price) * 100, 2)
            result = "WIN" if peak_pct > -8.0 else "LOSS"
            return_pct = peak_pct
            exit_date = dt.strftime("%Y-%m-%d")
            break

    if result == "PENDING":
        return_pct = round(((last_price - entry_price) / entry_price) * 100, 2)
        
    mfe_pct = round(((peak_price - entry_price) / entry_price) * 100, 2)
    mae_pct = round(((min_low - entry_price) / entry_price) * 100, 2)

    return {
        "result": result,
        "return_pct": return_pct,
        "realized_return_pct": return_pct,
        "days": last_days_held,
        "holding_days": last_days_held,
        "exit_date": exit_date,
        "exit_price": round(entry_price * (1 + return_pct / 100), 2),
        "exit_reason": result if result != "PENDING" else "ACTIVE",
        "entry_price": round(entry_price, 2),
        "entry_date": entry_date.strftime("%Y-%m-%d"),
        "atr_14": round(atr14, 2),
        "stop_price": round(entry_price * 0.92, 2),
        "stop_pct": 8.0,
        "max_price": round(peak_price, 2),
        "peak_date": peak_date,
        "peak_gain_pct": mfe_pct,
        "mfe_pct": mfe_pct,
        "mae_pct": mae_pct,
        "ema50_1d": round(float(last_ema50), 2) if last_ema50 is not None else None,
        "active_sl_level": round(float(last_ema50), 2) if last_ema50 is not None else None,
        "hit_3": hits[3], "hit_5": hits[5], "hit_7": hits[7], "hit_10": hits[10], "hit_15": hits[15], "hit_20": hits[20],
        "days_to_3": days_to_hit[3], "days_to_5": days_to_hit[5], "days_to_7": days_to_hit[7], "days_to_10": days_to_hit[10], "days_to_15": days_to_hit[15], "days_to_20": days_to_hit[20],
        "performance_version": "v4_legacy_revert_60d_peak"
    }

def update_performance'''

content = content[:match.start()] + new_func + content[match.end()-22:]

with open('update_swing_performance.py', 'w', encoding='utf-8') as f:
    f.write(content)
print("Replaced!")
