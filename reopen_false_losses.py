"""
Dar SL ile yanlış kapatılmış LOSS kayıtları tespit edip düzeltir.
stop_loss_high (5% floor) hiç tetiklenmediyse PENDING veya zaman limiti sonucuna göre günceller.
"""
import json, yfinance as yf, sys, math
from datetime import datetime, timedelta
sys.stdout.reconfigure(encoding='utf-8')

PERF_FILE = 'frontend/public/swing_performance.json'

def main():
    with open(PERF_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)
    h = data['history']
    today = datetime.now()

    # stop_loss_high mevcut, sl_pct=5.0, result=LOSS, exit_date var
    candidates = [r for r in h
                  if r['result'] == 'LOSS'
                  and abs(r.get('sl_pct', 0) - 5.0) < 0.01
                  and r.get('stop_loss_high') is not None
                  and r.get('exit_date')]

    print(f'Kontrol edilecek: {len(candidates)} kayit')
    if not candidates:
        return

    tickers = list(set(r['ticker'] for r in candidates))
    prices = yf.download(
        tickers, start='2025-12-01',
        end=(today + timedelta(days=1)).strftime('%Y-%m-%d'),
        interval='1d', group_by='ticker', threads=True,
        progress=False, auto_adjust=True
    )

    changed = 0
    for r in candidates:
        ticker   = r['ticker']
        entry    = float(r['entry'])
        sl_h     = float(r['stop_loss_high'])
        pt       = float(r.get('profit_target', entry * 1.05))
        entry_dt = datetime.strptime(r['date'], '%Y-%m-%d')
        max_hold = int(r.get('max_hold_days', 5))
        hold_end = entry_dt + timedelta(days=max_hold + 2)

        try:
            df = prices[ticker] if len(tickers) > 1 else prices
            if df is None or df.empty:
                continue

            mask   = (df.index >= r['date']) & (df.index <= hold_end.strftime('%Y-%m-%d'))
            window = df[mask]
            if window.empty:
                continue

            sl_hit = any(float(row['Low']) <= sl_h  for _, row in window.iterrows())
            tp_hit = any(float(row['High']) >= pt   for _, row in window.iterrows())

            if sl_hit or tp_hit:
                # Daha once dogru kapatilmis, dokunma
                continue

            # Ne SL ne TP tetiklenmedi
            last_close = float(window['Close'].iloc[-1])
            last_date  = window.index[-1].strftime('%Y-%m-%d')
            days_held  = (window.index[-1].to_pydatetime() - entry_dt).days
            ret        = round((last_close - entry) / entry * 100, 2)

            if days_held >= max_hold:
                # Zaman limiti dolmus
                new_result = 'WIN' if ret > 0 else 'LOSS'
                print(f'  TL: {r["date"]} {ticker} {r["result"]}({r["return_pct"]}%) -> {new_result}({ret}%) exit={last_date}')
                r['result']     = new_result
                r['return_pct'] = ret
                r['exit_date']  = last_date
            else:
                # Trade penceresi henuz dolmamis -> PENDING
                print(f'  REOPEN: {r["date"]} {ticker} {r["result"]}({r["return_pct"]}%) -> PENDING({ret}%) days={days_held}/{max_hold}')
                r['result']     = 'PENDING'
                r['return_pct'] = ret
                r['days']       = days_held
                if 'exit_date' in r:
                    del r['exit_date']

            changed += 1

        except Exception as e:
            print(f'  Hata {ticker}: {e}')

    print(f'Degistirilen: {changed}')

    all_c = [x for x in h if x['result'] != 'PENDING']
    wins  = [x for x in all_c if x['result'] == 'WIN']
    vr    = [x['return_pct'] for x in h
             if x.get('return_pct') is not None
             and not (isinstance(x['return_pct'], float) and math.isnan(x['return_pct']))]

    data['stats']['win_rate']        = round(len(wins) / len(all_c) * 100, 1) if all_c else 0
    data['stats']['avg_return_pct']  = round(sum(vr) / len(vr), 2) if vr else 0
    data['stats']['pending_count']   = len(h) - len(all_c)
    data['stats']['completed_count'] = len(all_c)
    data['stats']['last_updated']    = today.strftime('%Y-%m-%dT%H:%M:%S')
    data['history'] = h

    with open(PERF_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f'WIN={len(wins)} LOSS={len(all_c)-len(wins)} PENDING={len(h)-len(all_c)} WR={data["stats"]["win_rate"]}%')

if __name__ == '__main__':
    main()
