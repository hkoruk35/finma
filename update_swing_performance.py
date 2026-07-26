import json
import math
import os
import yfinance as yf
from datetime import datetime, timedelta
import time

MOJIBAKE_FIXES = {'â€"': '–', 'â€™': ''', 'â€˜': ''', 'â€œ': '"', 'â€¦': '…'}

def fix_encoding(text: str) -> str:
    if not text:
        return text
    for bad, good in MOJIBAKE_FIXES.items():
        text = text.replace(bad, good)
    try:
        return text.encode('latin-1').decode('utf-8')
    except Exception:
        return text

def fetch_ticker_meta(ticker: str) -> dict:
    """yfinance'den company name, sector ve subsector (industry) çeker."""
    try:
        info = yf.Ticker(ticker).info
        return {
            'company': info.get('longName') or info.get('shortName') or ticker,
            'sector':  info.get('sector', ''),
            'subsector': info.get('industry', ''),
        }
    except Exception:
        return {}

# Paths
performance_file = 'frontend/public/swing_performance.json'
picks_file = 'frontend/public/swing_all_picks.json'
log_file = 'logs/performance_update.log'

os.makedirs('logs', exist_ok=True)

def log(msg):
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    print(f"[{timestamp}] {msg}")
    with open(log_file, 'a', encoding='utf-8') as f:
        f.write(f"[{timestamp}] {msg}\n")

# v3.1: Bekleme süresi 60-90 günden 30 güne indirildi (oranlı küçültme,
# eski 60/90 = 2:3 oranı korunuyor: 20/30 = 2:3).
MAX_HOLD_DAYS = 30      # işlemler en geç 30 günde kapanır
SL_WINDOW_DAYS = 20     # EMA50 / -%10 zarar ve +%5 kazanç kuralı ilk 20 gün için geçerli
MIN_SL_PCT = -10.0      # minimum stop-loss oranı: en az %10
WIN_PCT_60D = 5.0       # SL_WINDOW_DAYS içinde +%5 geçen işlem Kazanç sayılır (isim korunuyor, davranış SL_WINDOW_DAYS'e bağlı)

def simulate_trade(record, ticker_df):
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

def update_performance():
    if not os.path.exists(performance_file):
        log("Performance file not found.")
        return

    with open(performance_file, 'r', encoding='utf-8') as f:
        data = json.load(f)

    history = data.get('history', [])
    today = datetime.now()

    # ── Metadata Backfill: subsector/sector boş olan kayıtları doldur ──────────
    meta_missing = [r for r in history if not r.get('subsector') or not r.get('sector') or r.get('sector') == 'Unknown']
    if meta_missing:
        log(f"Backfilling metadata for {len(meta_missing)} records with missing sector/subsector...")
        for record in meta_missing:
            ticker = record['ticker']
            try:
                meta = fetch_ticker_meta(ticker)
                if not record.get('subsector') and meta.get('subsector'):
                    record['subsector'] = meta['subsector']
                if (not record.get('sector') or record['sector'] == 'Unknown') and meta.get('sector'):
                    record['sector'] = meta['sector']
                if (not record.get('company') or record['company'] == ticker) and meta.get('company'):
                    record['company'] = meta['company']
                time.sleep(0.2)
            except Exception as e:
                log(f"Metadata backfill error for {ticker}: {e}")

    # 1. Tüm kayıtları yeni kurallarla (90g max, 60g pencere, min %10 SL, %5 kazanç)
    #    baştan simüle et — sadece PENDING değil, tamamlanmış kayıtlar da yeniden hesaplanır.
    all_tickers = list(set(r['ticker'] for r in history))
    earliest_entry = min(datetime.strptime(r['date'], '%Y-%m-%d') for r in history)
    # EMA50'nin sağlıklı hesaplanması için giriş tarihinden ~150 gün öncesine kadar veri çek
    start_date = (earliest_entry - timedelta(days=150)).strftime('%Y-%m-%d')
    end_date = (today + timedelta(days=1)).strftime('%Y-%m-%d')

    if not all_tickers:
        log("No trades to simulate.")
    else:
        log(f"Simulating {len(history)} records across {len(all_tickers)} tickers...")
        try:
            prices_df = yf.download(all_tickers, start=start_date, end=end_date, interval="1d", group_by='ticker', threads=True, progress=False)

            for record in history:
                ticker = record['ticker']
                try:
                    if len(all_tickers) == 1:
                        ticker_data = prices_df
                    else:
                        ticker_data = prices_df[ticker]

                    ticker_data = ticker_data.dropna(subset=['Close'])
                    if ticker_data.empty:
                        continue

                    sim = simulate_trade(record, ticker_data)
                    if sim is None:
                        continue

                    for k, v in sim.items():
                        record[k] = v

                except Exception as e:
                    log(f"Error simulating {ticker}: {str(e)}")
        except Exception as e:
            log(f"Bulk download failed: {str(e)}")

    # 2. Add NEW picks if any (with 5-day rule)
    if os.path.exists(picks_file):
        with open(picks_file, 'r', encoding='utf-8') as f:
            picks_data = json.load(f)
            json_date = picks_data.get('date', '')
            new_picks = picks_data.get('picks', [])
            
            if json_date:
                # 5-Day Rule check
                json_date_dt = datetime.strptime(json_date, '%Y-%m-%d')
                lookback = json_date_dt - timedelta(days=5)
                
                recent_tickers = [r['ticker'] for r in history if datetime.strptime(r['date'], '%Y-%m-%d') >= lookback]
                
                for p in new_picks:
                    ticker = p['ticker']
                    # Kullanıcı kararı (2026-07-19, netleştirildi): sadece GERÇEKTEN
                    # "Giriş Zone" durumuna geçmiş (entry_status == "ENTERED") hisseler
                    # Geçmiş İşlem Kayıtları'na girer. "Bekle" (PENDING) durumundaki
                    # sinyal-listesi adayları saatlik kontrollerde (ENTRY_CHECK modu)
                    # gerçekten Giriş Zone'a geçtiğinde otomatik eklenir — burada
                    # atlanır, erken eklenmez.
                    if p.get('entry_status') != 'ENTERED':
                        continue
                    if ticker not in recent_tickers:
                        # Giriş fiyatı: entry_zone'un orta noktası (gerçek giriş anında
                        # yakalanan aralık); yoksa buy_zone, o da yoksa current_price.
                        zone = p.get('entry_zone') or p.get('buy_zone') or {}
                        if zone.get('low') and zone.get('high'):
                            entry = (float(zone['low']) + float(zone['high'])) / 2
                        else:
                            entry = p.get('current_price', 0)
                        if entry <= 0: continue

                        tracker = p.get('tracker_logic', {})
                        sl_high = tracker.get('stop_loss_high', entry * 0.9474)
                        sl_val = round(((entry - sl_high) / entry) * 100, 2) if entry > 0 else 5.26

                        # Bot's own profit target and hold limit
                        profit_zone = p.get('profit_zone', {})
                        profit_target = profit_zone.get('low') or tracker.get('profit_target_tp1')
                        max_hold_days = tracker.get('max_hold_days', 5)

                        # Get company/sector/subsector — fetch from yfinance if missing
                        company   = p.get('company', '') or ''
                        sector    = p.get('sector', '')   or ''
                        subsector = p.get('subsector', '') or ''
                        if not company or company == ticker or not subsector or subsector in ('N/A', 'Unknown'):
                            try:
                                meta = fetch_ticker_meta(ticker)
                                if not company or company == ticker:
                                    company = meta.get('company', ticker)
                                if not sector:
                                    sector = meta.get('sector', '')
                                if not subsector or subsector in ('N/A', 'Unknown'):
                                    subsector = meta.get('subsector', '')
                                time.sleep(0.2)
                            except Exception:
                                pass

                        history.insert(0, {
                            'date': json_date,
                            'ticker': ticker,
                            'company': company or ticker,
                            'sector': sector or 'Unknown',
                            'subsector': subsector or '',
                            'entry': round(entry, 2),
                            'max_price': round(entry, 2),
                            'sl_pct': abs(sl_val),
                            'stop_loss_high': round(float(sl_high), 2) if sl_high else None,
                            'profit_target': round(float(profit_target), 2) if profit_target else None,
                            'max_hold_days': int(max_hold_days),
                            'return_pct': 0.0,
                            'days': 0,
                            'result': 'PENDING',
                            'peak_date': json_date
                        })
                        recent_tickers.append(ticker)

    # 3. Fix encoding in all string fields
    for entry in history:
        for field in ('company', 'sector', 'subsector'):
            if entry.get(field):
                entry[field] = fix_encoding(entry[field])

    # 3b. 30-Day Duplicate Rule — within a 30-day window, only the FIRST occurrence
    # of a ticker is counted in stats; later repeats are flagged as is_duplicate
    # and excluded from win-rate / avg-return / etc. (but kept visible in the log).
    by_ticker = {}
    for r in history:
        by_ticker.setdefault(r['ticker'], []).append(r)

    for ticker, records in by_ticker.items():
        records.sort(key=lambda r: r['date'])
        last_counted_date = None
        for r in records:
            r_date = datetime.strptime(r['date'], '%Y-%m-%d')
            if last_counted_date is not None and (r_date - last_counted_date).days < 30:
                r['is_duplicate'] = True
            else:
                r['is_duplicate'] = False
                last_counted_date = r_date

    # 4. Update Stats (duplicates excluded from all calculations)
    countable = [r for r in history if not r.get('is_duplicate')]
    all_completed = [r for r in countable if r.get('result', 'NO_DATA') != 'PENDING' and r.get('result') != 'NO_DATA']
    wins = [r for r in all_completed if r.get('result') == 'WIN']
    above_5 = [r for r in all_completed if (r.get('return_pct') or 0) >= 5]
    above_10 = [r for r in all_completed if (r.get('return_pct') or 0) >= 10]

    data['stats']['total_picks'] = len(history)
    data['stats']['counted_picks'] = len(countable)
    data['stats']['duplicate_count'] = len(history) - len(countable)
    data['stats']['completed_count'] = len(all_completed)
    data['stats']['pending_count'] = len(countable) - len(all_completed)
    data['stats']['win_rate'] = round((len(wins) / len(all_completed) * 100), 1) if all_completed else 0
    
    completed_rets = [r['return_pct'] for r in all_completed if r.get('return_pct') is not None and not (isinstance(r['return_pct'], float) and math.isnan(r['return_pct']))]
    data['stats']['avg_return_pct'] = round(sum(completed_rets) / len(completed_rets), 2) if completed_rets else 0
    data['stats']['above_5pct_rate'] = round((len(above_5) / len(all_completed) * 100), 1) if all_completed else 0
    data['stats']['above_10pct_rate'] = round((len(above_10) / len(all_completed) * 100), 1) if all_completed else 0
    data['stats']['last_updated'] = today.strftime('%Y-%m-%dT%H:%M:%S')

    data['history'] = history

    def clean_nan(obj):
        if isinstance(obj, float) and math.isnan(obj):
            return None
        elif isinstance(obj, dict):
            return {k: clean_nan(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [clean_nan(v) for v in obj]
        return obj

    data = clean_nan(data)

    with open(performance_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    log("Performance update cycle completed.")

if __name__ == "__main__":
    update_performance()
