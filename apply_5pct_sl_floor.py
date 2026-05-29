"""
V117.v2 SL Floor Uygulaması:
- Tüm kayıtlarda sl_pct < 5% ise stop_loss_high = entry * 0.95
- PENDING: yeni SL ile güncelle
- LOSS (sl_pct < 5%): gerçek OHLCV ile yeniden değerlendir (çünkü dar SL yanlış tetiklenmiş olabilir)
- WIN: dokunma (zaten kazandı, SL genişliği sonucu etkilemez)
"""
import json, math, sys, time
import yfinance as yf
from datetime import datetime, timedelta

sys.stdout.reconfigure(encoding='utf-8')

PERFORMANCE_FILE = 'frontend/public/swing_performance.json'
SL_FLOOR_PCT     = 0.05   # %5 — botun yeni minimum SL mesafesi

def log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")

def main():
    with open(PERFORMANCE_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)
    history = data['history']

    # ── 1. Tüm kayıtlara %5 SL floor uygula ──────────────────────────────────
    floor_applied = 0
    to_reevaluate = []   # LOSS kayıtları — dar SL ile yanlış kapanmış olabilir

    for record in history:
        entry  = float(record.get('entry', 0))
        if entry <= 0:
            continue

        sl_floor = round(entry * (1 - SL_FLOOR_PCT), 2)
        old_sl_h = record.get('stop_loss_high')
        old_sl_pct = float(record.get('sl_pct') or 0)

        # Stop_loss_high yoksa sl_pct'den hesapla, varsa doğrudan kullan
        if old_sl_h:
            effective_sl = float(old_sl_h)
        elif old_sl_pct > 0:
            effective_sl = round(entry * (1 - old_sl_pct / 100), 2)
        else:
            continue

        # Floor kontrolü: stop_loss_high, entry'nin %5 altından YUKARDAYSA → çok dar → floor'a çek
        if effective_sl > sl_floor:
            record['stop_loss_high'] = sl_floor
            record['sl_pct'] = round(SL_FLOOR_PCT * 100, 2)
            floor_applied += 1

            # LOSS ise yeniden değerlendirme kuyruğuna ekle
            if record['result'] == 'LOSS' and record.get('exit_date'):
                to_reevaluate.append(record)
        else:
            # SL zaten geniş ama sl_pct tutarsızsa güncelle
            if old_sl_h:
                correct_pct = round((entry - float(old_sl_h)) / entry * 100, 2)
                if abs(correct_pct - old_sl_pct) > 0.01:
                    record['sl_pct'] = correct_pct

    log(f"SL floor uygulandı: {floor_applied} kayıt")
    log(f"Yeniden değerlendirilecek LOSS kayıt: {len(to_reevaluate)}")

    # ── 2. Dar SL ile kapanmış LOSS kayıtları yeniden değerlendir ────────────
    if to_reevaluate:
        tickers = list(set(r['ticker'] for r in to_reevaluate))
        log(f"OHLCV indiriliyor: {len(tickers)} ticker...")

        try:
            prices = yf.download(
                tickers,
                start='2025-12-01',
                end=(datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d'),
                interval='1d', group_by='ticker', threads=True,
                progress=False, auto_adjust=True
            )
        except Exception as e:
            log(f"Download hatası: {e}")
            prices = None

        changed = 0
        if prices is not None and not prices.empty:
            for record in to_reevaluate:
                ticker      = record['ticker']
                entry_price = float(record['entry'])
                sl_price    = float(record['stop_loss_high'])   # artık %5 floor uygulanmış
                pt          = record.get('profit_target')
                profit_tgt  = float(pt) if pt else entry_price * 1.05
                max_hold    = int(record.get('max_hold_days', 5))
                entry_date  = datetime.strptime(record['date'], '%Y-%m-%d')
                end_date    = entry_date + timedelta(days=max_hold + 5)

                try:
                    if len(tickers) == 1:
                        df = prices
                    else:
                        if ticker not in prices.columns.get_level_values(0):
                            continue
                        df = prices[ticker]

                    if df is None or df.empty:
                        continue

                    mask = (df.index >= entry_date.strftime('%Y-%m-%d')) & \
                           (df.index <= end_date.strftime('%Y-%m-%d'))
                    window = df[mask]
                    if window.empty:
                        continue

                    new_result = None
                    new_exit   = None
                    new_ret    = None

                    for bar_date, row in window.iterrows():
                        try:
                            bar_low   = float(row['Low'])
                            bar_high  = float(row['High'])
                            bar_close = float(row['Close'])
                            days_held = (bar_date.to_pydatetime() - entry_date).days
                        except Exception:
                            continue

                        if bar_low <= sl_price:
                            new_result = 'LOSS'
                            new_ret    = round((sl_price - entry_price) / entry_price * 100, 2)
                            new_exit   = bar_date.strftime('%Y-%m-%d')
                            break
                        if bar_high >= profit_tgt:
                            new_result = 'WIN'
                            new_ret    = round((profit_tgt - entry_price) / entry_price * 100, 2)
                            new_exit   = bar_date.strftime('%Y-%m-%d')
                            break
                        if days_held >= max_hold:
                            ret = round((bar_close - entry_price) / entry_price * 100, 2)
                            new_result = 'WIN' if ret > 0 else 'LOSS'
                            new_ret    = ret
                            new_exit   = bar_date.strftime('%Y-%m-%d')
                            break

                    if new_result:
                        old_result = record['result']
                        old_ret    = record.get('return_pct')
                        record['result']     = new_result
                        record['return_pct'] = new_ret
                        record['exit_date']  = new_exit
                        if new_result != old_result or abs((new_ret or 0) - (old_ret or 0)) > 0.3:
                            changed += 1
                            log(f"  {record['date']} {ticker}: {old_result}({old_ret}%) → {new_result}({new_ret}%)")

                except Exception as e:
                    log(f"  Hata {ticker}: {e}")

        log(f"Sonuç değişen kayıt: {changed}")

    # ── 3. PENDING kayıtlar: sl_pct güncellendiğinden sadece max_price kontrol ─
    # (Asıl fiyat kontrolü update_swing_performance.py'de yapılıyor)
    # Burada sadece sl_pct/stop_loss_high tutarlılığı sağlandı.

    # ── 4. İstatistikleri güncelle ─────────────────────────────────────────────
    all_completed = [r for r in history if r['result'] != 'PENDING']
    wins          = [r for r in all_completed if r['result'] == 'WIN']
    valid_rets    = [r['return_pct'] for r in history
                     if r.get('return_pct') is not None
                     and not (isinstance(r['return_pct'], float) and math.isnan(r['return_pct']))]

    today_str = datetime.now().strftime('%Y-%m-%dT%H:%M:%S')
    data['stats']['total_picks']       = len(history)
    data['stats']['completed_count']   = len(all_completed)
    data['stats']['pending_count']     = len(history) - len(all_completed)
    data['stats']['win_rate']          = round(len(wins) / len(all_completed) * 100, 1) if all_completed else 0
    data['stats']['avg_return_pct']    = round(sum(valid_rets) / len(valid_rets), 2) if valid_rets else 0
    data['stats']['last_updated']      = today_str
    data['history']                    = history

    with open(PERFORMANCE_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    log(f"Tamamlandı. WIN={len(wins)}, LOSS={len(all_completed)-len(wins)}, PENDING={len(history)-len(all_completed)}")
    log(f"Win rate: {data['stats']['win_rate']}% | Avg ret: {data['stats']['avg_return_pct']}%")

if __name__ == '__main__':
    main()
