import json
import re
import os

# Translation Map
TR_TO_EN = {
    "MÜKEMMEL": "EXCELLENT",
    "GÜÇLÜ": "STRONG",
    "İYİ": "GOOD",
    "OLASI": "WATCH",
    "ZAYIF": "WEAK",
    "PAZAR LİDERİ": "MARKET LEADER",
    "NÖTR": "NEUTRAL",
    "UCUZ IV": "CHEAP IV",
    "NORMAL": "NORMAL",
    "PAHALI": "PRICEY",
    "Orta 🟡": "Normal 🟡",
    "Normal 🟡": "Normal 🟡",
    "Düşük 🟢": "Low 🟢",
    "TREND REJİMİ": "TREND REGIME",
    "KIRILIM REJİMİ": "BREAKOUT REGIME",
    "GOLDEN CROSS — TREND DOĞUMU": "GOLDEN CROSS — TREND BIRTH",
    "NEAR GOLDEN CROSS": "NEAR GOLDEN CROSS",
    "TREND BAŞLANGICI": "TREND START",
    "EMA200 KIRILIM — ALTIN SİNYAL": "EMA200 BREAKOUT — GOLDEN SIGNAL",
    "EMA50 SEKMESI": "EMA50 BOUNCE",
    "EMA200 KIRILIM": "EMA200 BREAKOUT"
}

def translate(text):
    if not text: return text
    for tr, en in TR_TO_EN.items():
        text = text.replace(tr, en)
    return text

def parse_val(line, key):
    if key == "RS vs SPY":
        m = re.search(r"RS vs SPY\s*(?:\(60g\))?:\s*([\+\-]?\d*\.?\d+)", line)
        if m: return float(m.group(1))
    patterns = [
        fr"{key}:?\s*[\$]?\s*([\+\-]?\d[\d,]*\.?\d*)",
        fr"[\$]\s*(\d[\d,]*\.?\d*)\s+{key}",
        fr"{key}.*?([\+\-]?\d[\d,]*\.?\d*)"
    ]
    for p in patterns:
        m = re.search(p, line)
        if m:
            val_str = m.group(1).replace(",", "")
            try: return float(val_str)
            except: continue
    return None

def parse_contract(block):
    if not block: return None
    strike_match = re.search(r"\$(\d+\.?\d*)\s+CALL", block)
    if not strike_match: return None
    res = {
        "strike": float(strike_match.group(1)),
        "expiration": None, "dte": None, "premium": None, "spread_pct": None,
        "delta": None, "gamma": None, "theta": None, "oi": None, "volume": None,
        "vol_oi_ratio": None, "contract_cost": None, "breakeven": None,
        "tp_price": None, "sl_price": None, "time_stop_days": None,
        "daily_decay_pct": None, "theta_delta_ratio": None, "sim_gain_pct": None
    }
    exp_match = re.search(r"\((\d{4}-\d{2}-\d{2})\)", block)
    if exp_match: res["expiration"] = exp_match.group(1)
    res["premium"] = parse_val(block, "Prim")
    res["spread_pct"] = parse_val(block, "Spread")
    res["delta"] = parse_val(block, "Δ")
    res["gamma"] = parse_val(block, "Γ")
    res["oi"] = parse_val(block, "OI")
    res["volume"] = parse_val(block, "Vol")
    res["vol_oi_ratio"] = parse_val(block, "Vol/OI")
    res["contract_cost"] = parse_val(block, "Kontrat")
    res["breakeven"] = parse_val(block, "Başabaş")
    res["tp_price"] = parse_val(block, "TP")
    res["sl_price"] = parse_val(block, "SL")
    ts_match = re.search(r"Time\s+Stop\s+(\d+)", block)
    if ts_match: res["time_stop_days"] = int(ts_match.group(1))
    dec_match = re.search(r"Erimesi:\s*%?([\d\.]+)", block)
    if dec_match: res["daily_decay_pct"] = float(dec_match.group(1))
    res["theta_delta_ratio"] = parse_val(block, "Kalite")
    sim_match = re.search(r"Sim.*?→.*?\(%?([\+\-]?\d+)\%?\)", block)
    if sim_match: res["sim_gain_pct"] = float(sim_match.group(1))
    return res

def parse_report(raw_text, date_str):
    picks = []
    # Use re.split to split by rank markers
    detail_blocks = re.split(r"#(\d+)\s+📊", raw_text)[1:]
    for i in range(0, len(detail_blocks), 2):
        rank = int(detail_blocks[i])
        content = detail_blocks[i+1]
        lines = [l.strip() for l in content.split("\n") if l.strip()]
        if not lines: continue
        first_line = lines[0]
        parts = first_line.split()
        ticker = parts[0]
        price = float(parts[1].replace("$", ""))
        score = parse_val(first_line, "PUAN")
        # Extract grade from the end of the first line (e.g. "🔥 GÜÇLÜ")
        grade_tr = first_line.split("PUAN:")[1].split()[-1] if "PUAN:" in first_line else "GÜÇLÜ"
        grade = translate(grade_tr)
        
        ema_line = next((l for l in lines if "EMA:" in l), "")
        ema200 = parse_val(ema_line, "EMA200"); ema50 = parse_val(ema_line, "EMA50")
        
        metric_line = next((l for l in lines if "ADX:" in l), "")
        adx = parse_val(metric_line, "ADX"); rsi = parse_val(metric_line, "RSI"); rvol = parse_val(metric_line, "RVOL")
        roc20 = parse_val(metric_line, "ROC20"); roc60 = parse_val(metric_line, "ROC60")
        
        info_line = next((l for l in lines if "VWAP:" in l), "")
        vwap = parse_val(info_line, "VWAP"); hv30 = parse_val(info_line, "HV30"); iv_rank = parse_val(info_line, "IV Rank")
        
        rs_line = next((l for l in lines if "RS vs SPY" in l), "")
        rs_vs_spy = parse_val(rs_line, "RS vs SPY"); base_range = parse_val(rs_line, "Baz Aralığı"); high_60d = parse_val(rs_line, "Zirve")
        
        rejim_line = next((l for l in lines if "Rejim:" in l), "")
        regime = "trend" if "TREND" in rejim_line else "breakout" if "KIRILIM" in rejim_line else "neutral"
        entry_label_tr = rejim_line.split("Giriş:")[1].split("|")[0].strip() if "Giriş:" in rejim_line else ""
        entry_label = translate(entry_label_tr)
        
        entry_mode = "TREND_BIRTH"
        if "GOLDEN CROSS" in entry_label: entry_mode = "GOLDEN_CROSS"
        elif "NEAR GOLDEN" in entry_label: entry_mode = "NEAR_GOLDEN"
        elif "EMA200" in entry_label: entry_mode = "EMA200_BREAKOUT"
        elif "EMA50" in entry_label: entry_mode = "EMA50_BOUNCE"
        elif "TREND START" in entry_label: entry_mode = "TREND_BIRTH"
        
        em_line = next((l for l in lines if "EM:" in l), "")
        expected_move = parse_val(em_line, "EM")
        
        iv_line = next((l for l in lines if "IV:" in l), "")
        max_pain = parse_val(iv_line, "Max Pain"); iv_pct = parse_val(iv_line, "IV")
        
        vade_line = next((l for l in lines if "Vade:" in l), "")
        exp_date_match = re.search(r"Vade:\s*(\d{4}-\d{2}-\d{2})", vade_line)
        exp_date = exp_date_match.group(1) if exp_date_match else None
        dte_match = re.search(r"\((\d+)\s+gün\)", vade_line)
        dte = int(dte_match.group(1)) if dte_match else None
        
        inst_block_match = re.search(r"🛡️ KURUMSAL SIĞINAK.*?(?=(🚀 ASİMETRİK FIRSAT|#\d+|$))", content, re.DOTALL)
        inst = parse_contract(inst_block_match.group(0)) if inst_block_match else None
        asym_block_match = re.search(r"🚀 ASİMETRİK FIRSAT.*?(?=(#\d+|$))", content, re.DOTALL)
        asym = parse_contract(asym_block_match.group(0)) if asym_block_match else None
        
        pick = {
            "rank": rank, "ticker": ticker, "current_price": price, "score": score, "grade": grade,
            "entry_mode": entry_mode, "entry_mode_label": entry_label, "regime": regime,
            "ema_pattern": "EMA20>50>200" if "EMA200" in content and "EMA50" in content else "",
            "ema50": ema50, "ema200": ema200, "adx": adx, "rsi": rsi, "rvol": rvol, "roc20": roc20, "roc60": roc60,
            "hv30": hv30, "iv_pct": iv_pct, "iv_rank": iv_rank, "vwap": vwap, "vwap_ok": "⚠️" not in info_line,
            "rs_vs_spy_60d": rs_vs_spy, "base_range_pct": base_range, "high_60d": high_60d,
            "expected_move": expected_move, "max_pain": max_pain, "exp_date": exp_date, "dte": dte,
            "institutional": inst, "asymmetric": asym, "date": date_str
        }
        picks.append(pick)
    
    vix_match = re.search(r"VIX:\s*(\d+\.?\d*)", raw_text)
    vix = float(vix_match.group(1)) if vix_match else 0
    
    spy_match = re.search(r"SPY 60g:\s*([\+\-]?\d+\.?\d*)", raw_text)
    spy_return = float(spy_match.group(1)) if spy_match else 0

    return {
        "timestamp": f"{date_str}T13:00:00-04:00", "date": date_str, "vix": vix, "vix_regime": translate("Normal 🟡" if vix < 20 else "High 🔴"),
        "spy_return_60d": spy_return, "universe_size": 500, "scan_duration_sec": 36, "total_candidates": len(picks),
        "regime_summary": {"trend": len([p for p in picks if p["regime"]=="trend"]), 
                           "breakout": len([p for p in picks if p["regime"]=="breakout"]), 
                           "neutral": 0}, 
        "picks": picks
    }

def merge_reports(reports, date_str):
    all_picks = {}
    main_report = reports[-1] 
    for r in reports:
        for p in r["picks"]:
            ticker = p["ticker"]
            if ticker not in all_picks or p["score"] > all_picks[ticker]["score"]:
                all_picks[ticker] = p
    
    sorted_picks = sorted(all_picks.values(), key=lambda x: x["score"], reverse=True)
    for i, p in enumerate(sorted_picks):
        p["rank"] = i + 1
    
    main_report["picks"] = sorted_picks
    main_report["total_candidates"] = len(sorted_picks)
    return main_report

# 19 April Data (9 Candidates)
text_19 = """#1 📊 PLUG  $2.78  PUAN:72.2  🔥 GÜÇLÜ
   EMA: EMA9>20>50>200 ✅  EMA200:$2.16  EMA50:$2.38
   ADX:37  RSI:62  RVOL:1.03x  ROC20:+15.8%  ROC60:+25.2%
   VWAP:$2.55  HV30:69%  IV Rank:27  ✅
   RS vs SPY (60g): +21.3pp  Baz Aralığı:%29.5  60g Zirve:$2.94

═══════════════════════════════════════════════════════
🔥 GÜÇLÜ  #PLUG  $2.78
🔮 Rejim: 📈 TREND REJİMİ  |  Giriş: 🌱 TREND BAŞLANGICI
📐 EM: ±$0.97 (üst ≤$3.75)  |  60g Zirve: $2.94
📊 IV: 86%  IV Rank: 27  🟡 NORMAL  |  Max Pain: $2.50
📅 Vade: 2026-06-18 (60 gün)
📈 RS vs SPY: +21.3pp  💪 PAZAR LİDERİ  |  30g Baz Aralığı: %29.5

🛡️ KURUMSAL SIĞINAK  (Delta rejim: trend)
   🎯 $3.0 CALL  (2026-06-18)
   💸 Prim: $0.30  Spread: 6.5%  |  Δ: 0.492  Γ: 0.41177
   📊 OI: 19,420  Vol: 1,573  Vol/OI: 0.08x
   💰 Kontrat: $31  Başabaş: $3.31
   🎯 EXIT: TP $0.42  |  SL $0.22  |  Time Stop 21 gün kala
   ⏱ Günlük Theta Erimesi: %1.1 prim/gün  |  Θ/Δ Kalite: 144.62
   📈 Sim (+%7, 21g): $0.31 → $0.31  (%+1)

#2 📊 APA  $35.74  PUAN:64.0  🔥 GÜÇLÜ ⚠️VWAP↓
   EMA: EMA20>50>200 ✅  EMA200:$27.55  EMA50:$35.35
   ADX:34  RSI:43  RVOL:0.80x  ROC20:-6.1%  ROC60:+36.0%
   VWAP:$40.18  ⚠️ VWAP ALTI  HV30:54%  IV Rank:20  ✅
   RS vs SPY (60g): +32.1pp  Baz Aralığı:%35.2  60g Zirve:$44.39

═══════════════════════════════════════════════════════
🔥 GÜÇLÜ ⚠️VWAP↓  #APA  $35.74
🔮 Rejim: 📈 TREND REJİMİ  |  Giriş: 🌱 TREND BAŞLANGICI
📐 EM: ±$8.93 (üst ≤$44.67)  |  60g Zirve: $44.39
📊 IV: 51%  IV Rank: 20  ✅ UCUZ IV  |  Max Pain: $35.00
📅 Vade: 2026-07-17 (89 gün)
📈 RS vs SPY: +32.1pp  💪 PAZAR LİDERİ  |  30g Baz Aralığı: %35.2

🚀 ASİMETRİK FIRSAT  [👀 SWEEP: 0.16x]
   🎯 $40.0 CALL  (2026-07-17)  ✅ EM İçinde ≤$44.67
   💸 Prim: $1.90  Spread: 7.6%  |  Δ: 0.389  Γ: 0.04341
   📊 OI: 1,544  Vol: 250  Vol/OI: 0.16x
   💰 Kontrat: $197  Başabaş: $41.97
   🎯 EXIT: TP $2.65  |  SL $1.42  |  Time Stop 31 gün kala
   ⏱ Günlük Theta Erimesi: %1.1 prim/gün  |  Θ/Δ Kalite: 18.86
   📈 Sim (+%10, 21g): $2.11 → $3.07  (%+45)

#3 📊 BAC  $53.91  PUAN:61.6  🔥 GÜÇLÜ
   EMA: 🔜NEAR GOLDEN ✅  EMA200:$50.17  EMA50:$50.87
   ADX:28  RSI:68  RVOL:1.03x  ROC20:+14.7%  ROC60:+4.1%
   VWAP:$50.23  HV30:23%  IV Rank:30  ✅
   RS vs SPY (60g): +0.2pp  Baz Aralığı:%14.1  60g Zirve:$56.21

═══════════════════════════════════════════════════════
🔥 GÜÇLÜ  #BAC  $53.91
🔮 Rejim: 📈 TREND REJİMİ  |  Giriş: 🔜 NEAR GOLDEN CROSS
📐 EM: ±$6.98 (üst ≤$60.89)  |  60g Zirve: $56.21
📊 IV: 26%  IV Rank: 30  🟡 NORMAL  |  Max Pain: $52.50
📅 Vade: 2026-07-17 (89 gün)
📈 RS vs SPY: +0.2pp  😐 NÖTR  |  30g Baz Aralığı: %14.1

🛡️ KURUMSAL SIĞINAK  (Delta rejim: trend)
   🎯 $55.0 CALL  (2026-07-17)
   💸 Prim: $2.23  Spread: 5.7%  |  Δ: 0.502  Γ: 0.05715
   📊 OI: 5,645  Vol: 997  Vol/OI: 0.18x
   💰 Kontrat: $230  Başabaş: $57.30
   🎯 EXIT: TP $3.13  |  SL $1.68  |  Time Stop 31 gün kala
   ⏱ Günlük Theta Erimesi: %0.8 prim/gün  |  Θ/Δ Kalite: 26.41
   📈 Sim (+%7, 21g): $2.59 → $4.33  (%+67)

#4 📊 NEE  $91.98  PUAN:58.0  💡 İYİ ⚠️VWAP↓
   EMA: 🔜NEAR GOLDEN ✅  EMA200:$82.93  EMA50:$90.90
   ADX:19  RSI:49  RVOL:0.93x  ROC20:-0.5%  ROC60:+10.4%
   VWAP:$92.05  ⚠️ VWAP ALTI  HV30:16%  IV Rank:38  ✅
   RS vs SPY (60g): +6.6pp  Baz Aralığı:%5.4  60g Zirve:$95.03

═══════════════════════════════════════════════════════
💡 İYİ ⚠️VWAP↓  #NEE  $91.98
🔮 Rejim: ⚡ KIRILIM REJİMİ  |  Giriş: 🔜 NEAR GOLDEN CROSS
📐 EM: ±$9.39 (üst ≤$101.37)  |  60g Zirve: $95.03
📊 IV: 25%  IV Rank: 38  🔴 PAHALI  |  Max Pain: $90.00
📅 Vade: 2026-06-18 (60 gün)
📈 RS vs SPY: +6.6pp  💪 PAZAR LİDERİ  |  30g Baz Aralığı: %5.4

🛡️ KURUMSAL SIĞINAK  (Delta rejim: breakout)
   🎯 $95.0 CALL  (2026-06-18)
   💸 Prim: $2.29  Spread: 5.9%  |  Δ: 0.423  Γ: 0.04318
   📊 OI: 9,896  Vol: 118  Vol/OI: 0.01x
   💰 Kontrat: $236  Başabaş: $97.36
   🎯 EXIT: TP $3.21  |  SL $1.72  |  Time Stop 21 gün kala
   ⏱ Günlük Theta Erimesi: %1.5 prim/gün  |  Θ/Δ Kalite: 12.25
   📈 Sim (+%7, 21g): $2.65 → $5.28  (%+100)

#5 📊 TFC  $50.57  PUAN:57.8  💡 İYİ
   EMA: 🔜NEAR GOLDEN ✅  EMA200:$46.56  EMA50:$48.14
   ADX:25  RSI:66  RVOL:0.81x  ROC20:+15.2%  ROC60:+2.1%
   VWAP:$47.17  HV30:26%  IV Rank:29  ✅
   RS vs SPY (60g): -1.8pp  Baz Aralığı:%13.3  60g Zirve:$55.25

═══════════════════════════════════════════════════════
💡 İYİ  #TFC  $50.57
🔮 Rejim: 📈 TREND REJİMİ  |  Giriş: 🔜 NEAR GOLDEN CROSS
📐 EM: ±$5.30 (üst ≤$55.87)  |  60g Zirve: $55.25
📊 IV: 26%  IV Rank: 29  🟡 NORMAL  |  Max Pain: $50.00
📅 Vade: 2026-06-18 (60 gün)
📈 RS vs SPY: -1.8pp  😐 NÖTR  |  30g Baz Aralığı: %13.3

🛡️ KURUMSAL SIĞINAK  (Delta rejim: trend)
   🎯 $50.0 CALL  (2026-06-18)
   💸 Prim: $2.33  Spread: 6.2%  |  Δ: 0.594  Γ: 0.07314
   📊 OI: 2,759  Vol: 61  Vol/OI: 0.02x
   💰 Kontrat: $240  Başabaş: $52.40
   🎯 EXIT: TP $3.25  |  SL $1.74  |  Time Stop 21 gün kala
   ⏱ Günlük Theta Erimesi: %0.9 prim/gün  |  Θ/Δ Kalite: 28.44
   📈 Sim (+%7, 21g): $2.62 → $4.69  (%+79)

#6 📊 EPD  $36.67  PUAN:52.7  💡 İYİ ⚠️VWAP↓
   EMA: 🔜NEAR GOLDEN ✅  EMA200:$33.45  EMA50:$36.68
   ADX:21  RSI:42  RVOL:1.34x  ROC20:-2.1%  ROC60:+13.1%
   VWAP:$37.86  ⚠️ VWAP ALTI  HV30:19%  IV Rank:28  ✅
   RS vs SPY (60g): +9.2pp  Baz Aralığı:%7.3  60g Zirve:$39.28

═══════════════════════════════════════════════════════
💡 İYİ ⚠️VWAP↓  #EPD  $36.67
🔮 Rejim: 📈 TREND REJİMİ  |  Giriş: 🔜 NEAR GOLDEN CROSS
📐 EM: ±$2.51 (üst ≤$39.18)  |  60g Zirve: $39.28
📊 IV: 17%  IV Rank: 28  🟡 NORMAL  |  Max Pain: $36.00
📅 Vade: 2026-06-18 (60 gün)
📈 RS vs SPY: +9.2pp  💪 PAZAR LİDERİ  |  30g Baz Aralığı: %7.3

🛡️ KURUMSAL SIĞINAK  (Delta rejim: trend)
   🎯 $37.0 CALL  (2026-06-18)
   💸 Prim: $0.82  Spread: 7.1%  |  Δ: 0.509  Γ: 0.15878
   📊 OI: 4,370  Vol: 117  Vol/OI: 0.03x
   💰 Kontrat: $85  Başabaş: $37.85
   🎯 EXIT: TP $1.15  |  SL $0.61  |  Time Stop 21 gün kala
   ⏱ Günlük Theta Erimesi: %1.3 prim/gün  |  Θ/Δ Kalite: 47.17
   📈 Sim (+%7, 21g): $0.99 → $2.54  (%+157)

#7 📊 RIG  $5.94  PUAN:50.1  💡 İYİ ⚠️VWAP↓
   EMA: EMA20>50>200 ✅  EMA200:$4.75  EMA50:$6.13
   ADX:26  RSI:40  RVOL:0.85x  ROC20:-8.1%  ROC60:+28.3%
   VWAP:$6.54  ⚠️ VWAP ALTI  HV30:51%  IV Rank:26  ✅
   RS vs SPY (60g): +24.4pp  Baz Aralığı:%16.8  60g Zirve:$6.93

═══════════════════════════════════════════════════════
💡 İYİ ⚠️VWAP↓  #RIG  $5.94
🔮 Rejim: 📈 TREND REJİMİ  |  Giriş: 🌱 TREND BAŞLANGICI
📐 EM: ±$1.26 (üst ≤$7.20)  |  60g Zirve: $6.93
📊 IV: 52%  IV Rank: 26  🟡 NORMAL  |  Max Pain: $6.00
📅 Vade: 2026-06-18 (60 gün)
📈 RS vs SPY: +24.4pp  💪 PAZAR LİDERİ  |  30g Baz Aralığı: %16.8

🛡️ KURUMSAL SIĞINAK  (Delta rejim: trend)
   🎯 $6.0 CALL  (2026-06-18)
   💸 Prim: $0.47  Spread: 13.7%  |  Δ: 0.539  Γ: 0.31496
   📊 OI: 571  Vol: 306  Vol/OI: 0.54x
   💰 Kontrat: $51  Başabaş: $6.51
   🎯 EXIT: TP $0.66  |  SL $0.36  |  Time Stop 21 gün kala
   ⏱ Günlük Theta Erimesi: %0.9 prim/gün  |  Θ/Δ Kalite: 119.73
   📈 Sim (+%7, 21g): $0.50 → $0.62  (%+25)

#8 📊 GLXY  $25.84  PUAN:50.0  ⚡💡 İYİ
   EMA: ⚡EMA200 KIRILIM ✅  EMA200:$24.90  EMA50:$22.11
   ADX:16  RSI:68  RVOL:1.06x  ROC20:+22.8%  ROC60:-20.4%
   VWAP:$20.66  HV30:83%  IV Rank:39  ✅
   RS vs SPY (60g): -24.3pp  Baz Aralığı:%33.6  60g Zirve:$33.18

═══════════════════════════════════════════════════════
⚡💡 İYİ  #GLXY  $25.84
🔮 Rejim: ⚡ KIRILIM REJİMİ  |  Giriş: ⚡ EMA200 KIRILIM — ALTIN SİNYAL
📐 EM: ±$11.61 (üst ≤$37.45)  |  60g Zirve: $33.18
📊 IV: 91%  IV Rank: 39  🔴 PAHALI  |  Max Pain: $25.00
📅 Vade: 2026-07-17 (89 gün)
📈 RS vs SPY: -24.3pp  😟 ZAYIF  |  30g Baz Aralığı: %33.6

🛡️ KURUMSAL SIĞINAK  (Delta rejim: breakout)
   🎯 $30.0 CALL  (2026-07-17)
   💸 Prim: $3.07  Spread: 8.1%  |  Δ: 0.464  Γ: 0.03483
   📊 OI: 730  Vol: 29  Vol/OI: 0.04x
   💰 Kontrat: $320  Başabaş: $33.20
   🎯 EXIT: TP $4.3  |  SL $2.3  |  Time Stop 31 gün kala
   ⏱ Günlük Theta Erimesi: %0.9 prim/gün  |  Θ/Δ Kalite: 17.39
   📈 Sim (+%7, 21g): $3.18 → $3.22  (%+1)

#9 📊 KMI  $32.02  PUAN:44.7  📊 OLASI ⚠️VWAP↓
   EMA: EMA20>50>200 ✅  EMA200:$29.24  EMA50:$32.19
   ADX:23  RSI:40  RVOL:0.95x  ROC20:-4.2%  ROC60:+13.1%
   VWAP:$33.03  ⚠️ VWAP ALTI  HV30:18%  IV Rank:35  ✅
   RS vs SPY (60g): +9.2pp  Baz Aralığı:%7.6  60g Zirve:$34.07

═══════════════════════════════════════════════════════
📊 OLASI ⚠️VWAP↓  #KMI  $32.02
🔮 Rejim: 📈 TREND REJİMİ  |  Giriş: 📉→📈 EMA50 SEKMESI
📐 EM: ±$2.99 (üst ≤$35.01)  |  60g Zirve: $34.07
📊 IV: 23%  IV Rank: 35  🔴 PAHALI  |  Max Pain: $32.00
📅 Vade: 2026-06-18 (60 gün)
📈 RS vs SPY: +9.2pp  💪 PAZAR LİDERİ  |  30g Baz Aralığı: %7.6

🛡️ KURUMSAL SIĞINAK  (Delta rejim: trend)
   🎯 $32.0 CALL  (2026-06-18)
   💸 Prim: $1.19  Spread: 2.5%  |  Δ: 0.556  Γ: 0.13228
   📊 OI: 5,245  Vol: 428  Vol/OI: 0.08x
   💰 Kontrat: $120  Başabaş: $33.20
   🎯 EXIT: TP $1.66  |  SL $0.89  |  Time Stop 21 gün kala
   ⏱ Günlük Theta Erimesi: %1.0 prim/gün  |  Θ/Δ Kalite: 45.98
   📈 Sim (+%7, 21g): $1.33 → $2.62  (%+96)"""

# 20 April Data (Merged 11 Candidates)
text_20_1 = """#1 📊 TDW  $86.17  PUAN:73.9  🔥 GÜÇLÜ
   EMA: EMA9>20>50>200 ✅  EMA200:$63.63  EMA50:$78.01
   ADX:21  RSI:61  RVOL:0.84x  ROC20:+18.9%  ROC60:+45.3%
   VWAP:$83.16  HV30:36%  IV Rank:28  ✅
   RS vs SPY (60g): +42.4pp  Baz Aralığı:%17.8  60g Zirve:$87.84

═══════════════════════════════════════════════════════
🔥 GÜÇLÜ  #TDW  $86.17
🔮 Rejim: 📈 TREND REJİMİ  |  Giriş: 🌱 TREND BAŞLANGICI
📐 EM: ±$21.52 (üst ≤$107.69)  |  60g Zirve: $87.84
📊 IV: 51%  IV Rank: 28  🟡 NORMAL  |  Max Pain: $85.00
📅 Vade: 2026-07-17 (88 gün)
📈 RS vs SPY: +42.4pp  💪 PAZAR LİDERİ  |  30g Baz Aralığı: %17.8

🛡️ KURUMSAL SIĞINAK  (Delta rejim: trend)
   🎯 $85.0 CALL  (2026-07-17)
   💸 Prim: $9.15  Spread: 13.3%  |  Δ: 0.590  Γ: 0.01807
   📊 OI: 226  Vol: 1  Vol/OI: 0.00x
   💰 Kontrat: $980  Başabaş: $94.80
   🎯 EXIT: TP $12.81  |  SL $6.86  |  Time Stop 31 gün kala
   ⏱ Günlük Theta Erimesi: %0.6 prim/gün  |  Θ/Δ Kalite: 11.09
   📈 Sim (+%7, 21g): $9.59 → $11.94  (%+24)

#2 📊 SWK  $74.53  PUAN:67.8  ⚡🔥 GÜÇLÜ
   EMA: ⚡EMA200 KIRILIM ✅  EMA200:$74.06  EMA50:$73.92
   ADX:22  RSI:55  RVOL:1.35x  ROC20:+10.8%  ROC60:-10.0%
   VWAP:$70.20  HV30:46%  IV Rank:19  ✅
   RS vs SPY (60g): -12.9pp  Baz Aralığı:%10.2  60g Zirve:$90.95

═══════════════════════════════════════════════════════
⚡🔥 GÜÇLÜ  #SWK  $74.53
🔮 Rejim: ⚡ KIRILIM REJİMİ  |  Giriş: ⚡ EMA200 KIRILIM — ALTIN SİNYAL
📐 EM: ±$14.77 (üst ≤$89.30)  |  60g Zirve: $90.95
📊 IV: 40%  IV Rank: 19  ✅ UCUZ IV  |  Max Pain: $75.00
📅 Vade: 2026-07-17 (88 gün)
📈 RS vs SPY: -12.9pp  😟 ZAYIF  |  30g Baz Aralığı: %10.2

🛡️ KURUMSAL SIĞINAK  (Delta rejim: breakout)
   🎯 $80.0 CALL  (2026-07-17)
   💸 Prim: $3.40  Spread: 11.1%  |  Δ: 0.417  Γ: 0.02727
   📊 OI: 382  Vol: 2  Vol/OI: 0.01x
   💰 Kontrat: $360  Başabaş: $83.60
   🎯 EXIT: TP $4.76  |  SL $2.55  |  Time Stop 31 gün kala
   ⏱ Günlük Theta Erimesi: %1.0 prim/gün  |  Θ/Δ Kalite: 11.77
   📈 Sim (+%7, 21g): $3.89 → $5.28  (%+36)

#3 📊 BAC  $53.53  PUAN:61.6  🔥 GÜÇLÜ
   EMA: 🔜NEAR GOLDEN ✅  EMA200:$50.19  EMA50:$50.97
   ADX:28  RSI:65  RVOL:0.97x  ROC20:+13.5%  ROC60:+2.6%
   VWAP:$50.62  HV30:23%  IV Rank:31  ✅
   RS vs SPY (60g): -0.3pp  Baz Aralığı:%14.2  60g Zirve:$56.21

═══════════════════════════════════════════════════════
🔥 GÜÇLÜ  #BAC  $53.53
🔮 Rejim: 📈 TREND REJİMİ  |  Giriş: 🔜 NEAR GOLDEN CROSS
📐 EM: ±$7.07 (üst ≤$60.60)  |  60g Zirve: $56.21
📊 IV: 27%  IV Rank: 31  🟡 NORMAL  |  Max Pain: $52.50
📅 Vade: 2026-07-17 (88 gün)
📈 RS vs SPY: -0.3pp  😐 NÖTR  |  30g Baz Aralığı: %14.2

🛡️ KURUMSAL SIĞINAK  (Delta rejim: trend)
   🎯 $55.0 CALL  (2026-07-17)
   💸 Prim: $1.98  Spread: 1.5%  |  Δ: 0.475  Γ: 0.06054
   📊 OI: 5,487  Vol: 35  Vol/OI: 0.01x
   💰 Kontrat: $200  Başabaş: $57.00
   🎯 EXIT: TP $2.78  |  SL $1.49  |  Time Stop 31 gün kala
   ⏱ Günlük Theta Erimesi: %0.9 prim/gün  |  Θ/Δ Kalite: 26.27
   📈 Sim (+%7, 21g): $2.25 → $3.92  (%+74)

#4 📊 SPIR  $18.51  PUAN:61.0  🔥 GÜÇLÜ ⚠️VWAP↓
   EMA: EMA20>50>200 ✅  EMA200:$11.80  EMA50:$14.16
   ADX:49  RSI:57  RVOL:1.47x  ROC20:+51.5%  ROC60:+50.4%
   VWAP:$18.72  ⚠️ VWAP ALTI  HV30:140%  IV Rank:38  ✅
   RS vs SPY (60g): +47.4pp  Baz Aralığı:%69.2  60g Zirve:$23.14

═══════════════════════════════════════════════════════
🔥 GÜÇLÜ ⚠️VWAP↓  #SPIR  $18.51
🔮 Rejim: 📈 TREND REJİMİ  |  Giriş: 🌱 TREND BAŞLANGICI
📐 EM: ±$10.32 (üst ≤$28.83)  |  60g Zirve: $23.14
📊 IV: 114%  IV Rank: 38  🔴 PAHALI  |  Max Pain: $18.00
📅 Vade: 2026-07-17 (88 gün)
📈 RS vs SPY: +47.4pp  💪 PAZAR LİDERİ  |  30g Baz Aralığı: %69.2

🛡️ KURUMSAL SIĞINAK  (Delta rejim: trend)
   🎯 $19.0 CALL  (2026-07-17)
   💸 Prim: $3.90  Spread: 14.3%  |  Δ: 0.600  Γ: 0.03744
   📊 OI: 542  Vol: 4  Vol/OI: 0.01x
   💰 Kontrat: $420  Başabaş: $23.20
   🎯 EXIT: TP $5.46  |  SL $2.93  |  Time Stop 31 gün kala
   ⏱ Günlük Theta Erimesi: %0.6 prim/gün  |  Θ/Δ Kalite: 25.42
   📈 Sim (+%7, 21g): $3.96 → $4.04  (%+2)

#5 📊 CFG  $65.04  PUAN:58.1  💡 İYİ
   EMA: 🔜NEAR GOLDEN ✅  EMA200:$55.78  EMA50:$61.32
   ADX:21  RSI:66  RVOL:1.15x  ROC20:+14.1%  ROC60:+1.9%
   VWAP:$61.98  HV30:24%  IV Rank:27  ✅
   RS vs SPY (60g): -1.0pp  Baz Aralığı:%14.7  60g Zirve:$68.12

═══════════════════════════════════════════════════════
💡 İYİ  #CFG  $65.04
🔮 Rejim: 📈 TREND REJİMİ  |  Giriş: 🔜 NEAR GOLDEN CROSS
📐 EM: ±$9.43 (üst ≤$74.47)  |  60g Zirve: $68.12
📊 IV: 30%  IV Rank: 27  🟡 NORMAL  |  Max Pain: $65.00
📅 Vade: 2026-07-17 (88 gün)
📈 RS vs SPY: -1.0pp  😐 NÖTR  |  30g Baz Aralığı: %14.7

🛡️ KURUMSAL SIĞINAK  (Delta rejim: trend)
   🎯 $67.5 CALL  (2026-07-17)
   💸 Prim: $2.40  Spread: 11.8%  |  Δ: 0.455  Γ: 0.04438
   📊 OI: 170  Vol: 5  Vol/OI: 0.03x
   💰 Kontrat: $255  Başabaş: $70.05
   🎯 EXIT: TP $3.36  |  SL $1.8  |  Time Stop 31 gün kala
   ⏱ Günlük Theta Erimesi: %1.0 prim/gün  |  Θ/Δ Kalite: 19.11
   📈 Sim (+%7, 21g): $2.84 → $4.64  (%+63)

#6 📊 DOW  $37.10  PUAN:57.8  💡 İYİ ⚠️VWAP↓
   EMA: EMA20>50>200 ✅  EMA200:$29.84  EMA50:$35.73
   ADX:23  RSI:48  RVOL:0.83x  ROC20:+1.2%  ROC60:+32.5%
   VWAP:$39.25  ⚠️ VWAP ALTI  HV30:60%  IV Rank:27  ✅
   RS vs SPY (60g): +29.6pp  Baz Aralığı:%21.5  60g Zirve:$41.87

═══════════════════════════════════════════════════════
💡 İYİ ⚠️VWAP↓  #DOW  $37.10
🔮 Rejim: 📈 TREND REJİMİ  |  Giriş: 🌱 TREND BAŞLANGICI
📐 EM: ±$7.93 (üst ≤$45.03)  |  60g Zirve: $41.87
📊 IV: 44%  IV Rank: 27  🟡 NORMAL  |  Max Pain: $37.50
📅 Vade: 2026-07-17 (88 gün)
📈 RS vs SPY: +29.6pp  💪 PAZAR LİDERİ  |  30g Baz Aralığı: %21.5

🛡️ KURUMSAL SIĞINAK  (Delta rejim: trend)
   🎯 $37.5 CALL  (2026-07-17)
   💸 Prim: $2.83  Spread: 11.0%  |  Δ: 0.545  Γ: 0.04999
   📊 OI: 311  Vol: 6  Vol/OI: 0.02x
   💰 Kontrat: $300  Başabaş: $40.50
   🎯 EXIT: TP $3.97  |  SL $2.13  |  Time Stop 31 gün kala
   ⏱ Günlük Theta Erimesi: %0.7 prim/gün  |  Θ/Δ Kalite: 26.98
   📈 Sim (+%7, 21g): $3.18 → $4.17  (%+31)"""

text_20_2 = """#1 📊 TDW  $85.67  PUAN:68.1  🔥 GÜÇLÜ
   EMA: EMA9>20>50>200 ✅  EMA200:$63.63  EMA50:$77.99
   ADX:21  RSI:60  RVOL:0.86x  ROC20:+18.2%  ROC60:+44.5%
   VWAP:$83.17  HV30:35%  IV Rank:35  ✅
   RS vs SPY (60g): +41.5pp  Baz Aralığı:%17.9  60g Zirve:$87.84

═══════════════════════════════════════════════════════
🔥 GÜÇLÜ  #TDW  $85.67
🔮 Rejim: 📈 TREND REJİMİ  |  Giriş: 🌱 TREND BAŞLANGICI
📐 EM: ±$23.25 (üst ≤$108.92)  |  60g Zirve: $87.84
📊 IV: 55%  IV Rank: 35  🔴 PAHALI  |  Max Pain: $85.00
📅 Vade: 2026-07-17 (88 gün)
📈 RS vs SPY: +41.5pp  💪 PAZAR LİDERİ  |  30g Baz Aralığı: %17.9

🛡️ KURUMSAL SIĞINAK  (Delta rejim: trend)
   🎯 $85.0 CALL  (2026-07-17)
   💸 Prim: $9.60  Spread: 9.9%  |  Δ: 0.583  Γ: 0.01679
   📊 OI: 226  Vol: 1  Vol/OI: 0.00x
   💰 Kontrat: $1010  Başabaş: $95.10
   🎯 EXIT: TP $13.44  |  SL $7.2  |  Time Stop 31 gün kala
   ⏱ Günlük Theta Erimesi: %0.6 prim/gün  |  Θ/Δ Kalite: 10.22
   📈 Sim (+%7, 21g): $10.02 → $12.15  (%+21)

#2 📊 BAC  $53.81  PUAN:67.6  🔥 GÜÇLÜ
   EMA: 🔜NEAR GOLDEN ✅  EMA200:$50.19  EMA50:$50.98
   ADX:28  RSI:68  RVOL:1.00x  ROC20:+14.1%  ROC60:+3.2%
   VWAP:$50.65  HV30:22%  IV Rank:26  ✅
   RS vs SPY (60g): +0.2pp  Baz Aralığı:%14.1  60g Zirve:$56.21

═══════════════════════════════════════════════════════
🔥 GÜÇLÜ  #BAC  $53.81
🔮 Rejim: 📈 TREND REJİMİ  |  Giriş: 🔜 NEAR GOLDEN CROSS
📐 EM: ±$6.54 (üst ≤$60.35)  |  60g Zirve: $56.21
📊 IV: 25%  IV Rank: 26  🟡 NORMAL  |  Max Pain: $52.50
📅 Vade: 2026-07-17 (88 gün)
📈 RS vs SPY: +0.2pp  😐 NÖTR  |  30g Baz Aralığı: %14.1

🛡️ KURUMSAL SIĞINAK  (Delta rejim: trend)
   🎯 $55.0 CALL  (2026-07-17)
   💸 Prim: $2.09  Spread: 1.0%  |  Δ: 0.492  Γ: 0.06098
   📊 OI: 5,487  Vol: 2,084  Vol/OI: 0.38x
   💰 Kontrat: $210  Başabaş: $57.10
   🎯 EXIT: TP $2.93  |  SL $1.57  |  Time Stop 31 gün kala
   ⏱ Günlük Theta Erimesi: %0.9 prim/gün  |  Θ/Δ Kalite: 27.18
   📈 Sim (+%7, 21g): $2.36 → $4.12  (%+74)

#3 📊 QQQI  $53.74  PUAN:66.6  🔥 GÜÇLÜ
   EMA: 🔜NEAR GOLDEN ✅  EMA200:$50.27  EMA50:$51.59
   ADX:22  RSI:68  RVOL:1.12x  ROC20:+7.5%  ROC60:+2.4%
   VWAP:$51.19  HV30:19%  IV Rank:8  ✅
   RS vs SPY (60g): -0.6pp  Baz Aralığı:%10.7  60g Zirve:$53.89

═══════════════════════════════════════════════════════
🔥 GÜÇLÜ  #QQQI  $53.74
🔮 Rejim: 📈 TREND REJİMİ  |  Giriş: 🔜 NEAR GOLDEN CROSS
📐 EM: ±$2.80 (üst ≤$56.54)  |  60g Zirve: $53.89
📊 IV: 9%  IV Rank: 8  ✅ UCUZ IV  |  Max Pain: $54.00
📅 Vade: 2026-08-21 (123 gün)
📈 RS vs SPY: -0.6pp  😐 NÖTR  |  30g Baz Aralığı: %10.7

🛡️ KURUMSAL SIĞINAK  (Delta rejim: trend)
   🎯 $55.0 CALL  (2026-08-21)
   💸 Prim: $0.57  Spread: 8.3%  |  Δ: 0.461  Γ: 0.14399
   📊 OI: 1,346  Vol: 63  Vol/OI: 0.05x
   💰 Kontrat: $60  Başabaş: $55.60
   🎯 EXIT: TP $0.8  |  SL $0.43  |  Time Stop 43 gün kala
   ⏱ Günlük Theta Erimesi: %1.3 prim/gün  |  Θ/Δ Kalite: 59.88
   📈 Sim (+%7, 21g): $0.94 → $3.37  (%+258)

#4 📊 SIDU  $4.12  PUAN:64.0  🔥 GÜÇLÜ
   EMA: EMA20>50>200 ✅  EMA200:$2.25  EMA50:$3.12
   ADX:39  RSI:54  RVOL:1.56x  ROC20:+78.6%  ROC60:+10.6%
   VWAP:$3.87  HV30:210%  IV Rank:40  ✅
   RS vs SPY (60g): +7.6pp  Baz Aralığı:%96.5  60g Zirve:$5.95

═══════════════════════════════════════════════════════
🔥 GÜÇLÜ  #SIDU  $4.12
🔮 Rejim: 📈 TREND REJİMİ  |  Giriş: 🌱 TREND BAŞLANGICI
📐 EM: ±$3.77 (üst ≤$7.89)  |  60g Zirve: $5.95
📊 IV: 157%  IV Rank: 40  🔴 PAHALI  |  Max Pain: $4.00
📅 Vade: 2026-08-21 (123 gün)
📈 RS vs SPY: +7.6pp  💪 PAZAR LİDERİ  |  30g Baz Aralığı: %96.5

🛡️ KURUMSAL SIĞINAK  (Delta rejim: trend)
   🎯 $6.0 CALL  (2026-08-21)
   💸 Prim: $0.98  Spread: 14.3%  |  Δ: 0.523  Γ: 0.10658
   📊 OI: 1,864  Vol: 545  Vol/OI: 0.29x
   💰 Kontrat: $105  Başabaş: $7.05
   🎯 EXIT: TP $1.36  |  SL $0.73  |  Time Stop 43 gün kala
   ⏱ Günlük Theta Erimesi: %0.6 prim/gün  |  Θ/Δ Kalite: 84.37
   📉 Sim (+%7, 21g): $0.99 → $0.93  (%-6)

#5 📊 SWK  $75.04  PUAN:63.8  ⚡🔥 GÜÇLÜ
   EMA: ⚡EMA200 KIRILIM ✅  EMA200:$74.06  EMA50:$73.94
   ADX:22  RSI:56  RVOL:1.42x  ROC20:+11.5%  ROC60:-9.4%
   VWAP:$70.29  HV30:46%  IV Rank:22  ✅
   RS vs SPY (60g): -12.4pp  Baz Aralığı:%10.5  60g Zirve:$90.95

═══════════════════════════════════════════════════════
⚡🔥 GÜÇLÜ  #SWK  $75.04
🔮 Rejim: ⚡ KIRILIM REJİMİ  |  Giriş: ⚡ EMA200 KIRILIM — ALTIN SİNYAL
📐 EM: ±$15.68 (üst ≤$90.72)  |  60g Zirve: $90.95
📊 IV: 43%  IV Rank: 22  🟡 NORMAL  |  Max Pain: $75.00
📅 Vade: 2026-07-17 (88 gün)
📈 RS vs SPY: -12.4pp  😟 ZAYIF  |  30g Baz Aralığı: %10.5

🛡️ KURUMSAL SIĞINAK  (Delta rejim: breakout)
   🎯 $80.0 CALL  (2026-07-17)
   💸 Prim: $4.00  Spread: 9.5%  |  Δ: 0.440  Γ: 0.02560
   📊 OI: 382  Vol: 6  Vol/OI: 0.02x
   💰 Kontrat: $420  Başabaş: $84.20
   🎯 EXIT: TP $5.6  |  SL $3.0  |  Time Stop 31 gün kala
   ⏱ Günlük Theta Erimesi: %1.0 prim/gün  |  Θ/Δ Kalite: 11.44
   📈 Sim (+%7, 21g): $4.50 → $5.94  (%+32)

#6 📊 PTEN  $9.82  PUAN:59.8  💡 İYİ ⚠️VWAP↓
   EMA: EMA20>50>200 ✅  EMA200:$7.66  EMA50:$9.57
   ADX:26  RSI:47  RVOL:0.86x  ROC20:-10.0%  ROC60:+34.5%
   VWAP:$10.48  ⚠️ VWAP ALTI  HV30:63%  IV Rank:26  ✅
   RS vs SPY (60g): +31.5pp  Baz Aralığı:%21.3  60g Zirve:$11.36

═══════════════════════════════════════════════════════
💡 İYİ ⚠️VWAP↓  #PTEN  $9.82
🔮 Rejim: 📈 TREND REJİMİ  |  Giriş: 🌱 TREND BAŞLANGICI
📐 EM: ±$3.14 (üst ≤$12.96)  |  60g Zirve: $11.36
📊 IV: 55%  IV Rank: 26  🟡 NORMAL  |  Max Pain: $9.00
📅 Vade: 2026-08-21 (123 gün)
📈 RS vs SPY: +31.5pp  💪 PAZAR LİDERİ  |  30g Baz Aralığı: %21.3

🛡️ KURUMSAL SIĞINAK  (Delta rejim: trend)
   🎯 $10.0 CALL  (2026-08-21)
   💸 Prim: $1.18  Spread: 12.0%  |  Δ: 0.562  Γ: 0.12553
   📊 OI: 12,212  Vol: 1  Vol/OI: 0.00x
   💰 Kontrat: $125  Başabaş: $11.25
   🎯 EXIT: TP $1.65  |  SL $0.88  |  Time Stop 43 gün kala
   ⏱ Günlük Theta Erimesi: %0.5 prim/gün  |  Θ/Δ Kalite: 100.34
   📈 Sim (+%7, 21g): $1.24 → $1.47  (%+19)

#7 📊 CFG  $64.94  PUAN:59.6  💡 İYİ
   EMA: 🔜NEAR GOLDEN ✅  EMA200:$55.78  EMA50:$61.32
   ADX:21  RSI:65  RVOL:1.16x  ROC20:+13.9%  ROC60:+1.8%
   VWAP:$61.99  HV30:24%  IV Rank:28  ✅
   RS vs SPY (60g): -1.2pp  Baz Aralığı:%14.7  60g Zirve:$68.12

═══════════════════════════════════════════════════════
💡 İYİ  #CFG  $64.94
🔮 Rejim: 📈 TREND REJİMİ  |  Giriş: 🔜 NEAR GOLDEN CROSS
📐 EM: ±$9.55 (üst ≤$74.49)  |  60g Zirve: $68.12
📊 IV: 30%  IV Rank: 28  🟡 NORMAL  |  Max Pain: $65.00
📅 Vade: 2026-07-17 (88 gün)
📈 RS vs SPY: -1.2pp  😐 NÖTR  |  30g Baz Aralığı: %14.7

🛡️ KURUMSAL SIĞINAK  (Delta rejim: trend)
   🎯 $67.5 CALL  (2026-07-17)
   💸 Prim: $2.42  Spread: 9.8%  |  Δ: 0.452  Γ: 0.04390
   📊 OI: 170  Vol: 4  Vol/OI: 0.02x
   💰 Kontrat: $255  Başabaş: $70.05
   🎯 EXIT: TP $3.39  |  SL $1.82  |  Time Stop 31 gün kala
   ⏱ Günlük Theta Erimesi: %1.0 prim/gün  |  Θ/Δ Kalite: 18.90
   📈 Sim (+%7, 21g): $2.84 → $4.60  (%+62)

#8 📊 ARR  $17.28  PUAN:58.6  💡 İYİ
   EMA: 🔜NEAR GOLDEN ✅  EMA200:$15.99  EMA50:$16.91
   ADX:17  RSI:54  RVOL:1.05x  ROC20:+13.2%  ROC60:-2.4%
   VWAP:$16.78  HV30:38%  IV Rank:32  ✅
   RS vs SPY (60g): -5.3pp  Baz Aralığı:%13.7  60g Zirve:$17.83

═══════════════════════════════════════════════════════
💡 İYİ  #ARR  $17.28
🔮 Rejim: ⚡ KIRILIM REJİMİ  |  Giriş: 🔜 NEAR GOLDEN CROSS
📐 EM: ±$2.01 (üst ≤$19.29)  |  60g Zirve: $17.83
📊 IV: 24%  IV Rank: 32  🟡 NORMAL  |  Max Pain: $17.00
📅 Vade: 2026-07-17 (88 gün)
📈 RS vs SPY: -5.3pp  😟 ZAYIF  |  30g Baz Aralığı: %13.7

🛡️ KURUMSAL SIĞINAK  (Delta rejim: breakout)
   🎯 $18.0 CALL  (2026-07-17)
   💸 Prim: $0.38  Spread: 12.5%  |  Δ: 0.406  Γ: 0.22657
   📊 OI: 2,988  Vol: 35  Vol/OI: 0.01x
   💰 Kontrat: $40  Başabaş: $18.40
   🎯 EXIT: TP $0.52  |  SL $0.28  |  Time Stop 31 gün kala
   ⏱ Günlük Theta Erimesi: %1.2 prim/gün  |  Θ/Δ Kalite: 86.36
   📈 Sim (+%7, 21g): $0.47 → $0.98  (%+108)

#9 📊 USB  $57.20  PUAN:56.1  💡 İYİ
   EMA: 🔜NEAR GOLDEN ✅  EMA200:$50.55  EMA50:$53.94
   ADX:20  RSI:67  RVOL:1.05x  ROC20:+12.8%  ROC60:+2.9%
   VWAP:$53.59  HV30:20%  IV Rank:34  ✅
   RS vs SPY (60g): -0.1pp  Baz Aralığı:%12.0  60g Zirve:$60.07

═══════════════════════════════════════════════════════
💡 İYİ  #USB  $57.20
🔮 Rejim: 📈 TREND REJİMİ  |  Giriş: 🔜 NEAR GOLDEN CROSS
📐 EM: ±$7.53 (üst ≤$64.73)  |  60g Zirve: $60.07
📊 IV: 27%  IV Rank: 34  🟡 NORMAL  |  Max Pain: $57.50
📅 Vade: 2026-07-17 (88 gün)
📈 RS vs SPY: -0.1pp  😐 NÖTR  |  30g Baz Aralığı: %12.0

🚀 ASİMETRİK FIRSAT  [👀 SWEEP: 0.34x]
   🎯 $60.0 CALL  (2026-07-17)  ✅ EM İçinde ≤$64.73
   💸 Prim: $1.61  Spread: 9.5%  |  Δ: 0.409  Γ: 0.05549
   📊 OI: 200  Vol: 68  Vol/OI: 0.34x
   💰 Kontrat: $169  Başabaş: $61.69
   🎯 EXIT: TP $2.25  |  SL $1.21  |  Time Stop 31 gün kala
   ⏱ Günlük Theta Erimesi: %1.1 prim/gün  |  Θ/Δ Kalite: 22.21
   📈 Sim (+%10, 21g): $1.92 → $4.59  (%+139)

#10 📊 FHN  $24.70  PUAN:54.8  💡 İYİ
   EMA: 🔜NEAR GOLDEN ✅  EMA200:$22.63  EMA50:$23.47
   ADX:18  RSI:66  RVOL:1.42x  ROC20:+13.0%  ROC60:+1.1%
   VWAP:$23.56  HV30:22%  IV Rank:27  ✅
   RS vs SPY (60g): -1.9pp  Baz Aralığı:%12.0  60g Zirve:$26.03

═══════════════════════════════════════════════════════
💡 İYİ  #FHN  $24.70
🔮 Rejim: ⚡ KIRILIM REJİMİ  |  Giriş: 🔜 NEAR GOLDEN CROSS
📐 EM: ±$4.34 (üst ≤$29.04)  |  60g Zirve: $26.03
📊 IV: 30%  IV Rank: 27  🟡 NORMAL  |  Max Pain: $24.00
📅 Vade: 2026-08-21 (123 gün)
📈 RS vs SPY: -1.9pp  😐 NÖTR  |  30g Baz Aralığı: %12.0

🛡️ KURUMSAL SIĞINAK  (Delta rejim: breakout)
   🎯 $26.0 CALL  (2026-08-21)
   💸 Prim: $1.10  Spread: 8.7%  |  Δ: 0.453  Γ: 0.09447
   📊 OI: 260  Vol: 1  Vol/OI: 0.00x
   💰 Kontrat: $115  Başabaş: $27.15
   🎯 EXIT: TP $1.54  |  SL $0.83  |  Time Stop 43 gün kala
   ⏱ Günlük Theta Erimesi: %0.7 prim/gün  |  Θ/Δ Kalite: 55.93
   📈 Sim (+%7, 21g): $1.30 → $1.95  (%+50)

#11 📊 DOW  $36.96  PUAN:53.8  💡 İYİ ⚠️VWAP↓
   EMA: EMA20>50>200 ✅  EMA200:$29.84  EMA50:$35.73
   ADX:23  RSI:47  RVOL:0.86x  ROC20:+0.8%  ROC60:+32.0%
   VWAP:$39.24  ⚠️ VWAP ALTI  HV30:60%  IV Rank:35  ✅
   RS vs SPY (60g): +29.0pp  Baz Aralığı:%21.6  60g Zirve:$41.87

═══════════════════════════════════════════════════════
💡 İYİ ⚠️VWAP↓  #DOW  $36.96
🔮 Rejim: 📈 TREND REJİMİ  |  Giriş: 🌱 TREND BAŞLANGICI
📐 EM: ±$8.59 (üst ≤$45.55)  |  60g Zirve: $41.87
📊 IV: 47%  IV Rank: 35  🟡 NORMAL  |  Max Pain: $37.50
📅 Vade: 2026-07-17 (88 gün)
📈 RS vs SPY: +29.0pp  💪 PAZAR LİDERİ  |  30g Baz Aralığı: %21.6

🛡️ KURUMSAL SIĞINAK  (Delta rejim: trend)
   🎯 $37.5 CALL  (2026-07-17)
   💸 Prim: $3.12  Spread: 4.7%  |  Δ: 0.542  Γ: 0.04616
   📊 OI: 311  Vol: 407  Vol/OI: 1.31x
   💰 Kontrat: $320  Başabaş: $40.70
   🎯 EXIT: TP $4.38  |  SL $2.34  |  Time Stop 31 gün kala
   ⏱ Günlük Theta Erimesi: %0.7 prim/gün  |  Θ/Δ Kalite: 24.97
   📈 Sim (+%7, 21g): $3.38 → $4.29  (%+27)

🚀 ASİMETRİK FIRSAT  [👀 SWEEP: 0.29x]
   🎯 $40.0 CALL  (2026-07-17)  ✅ EM İçinde ≤$45.55
   💸 Prim: $2.18  Spread: 5.4%  |  Δ: 0.430  Γ: 0.04602
   📊 OI: 474  Vol: 140  Vol/OI: 0.29x
   💰 Kontrat: $224  Başabaş: $42.24
   🎯 EXIT: TP $3.05  |  SL $1.64  |  Time Stop 31 gün kala
   ⏱ Günlük Theta Erimesi: %1.0 prim/gün  |  Θ/Δ Kalite: 20.60
   📈 Sim (+%10, 21g): $2.38 → $3.60  (%+51)"""

# 21 April Data (Partial - I only have #1)
text_21 = """#1 📊 TDW  $84.50  PUAN:72.5  🔥 GÜÇLÜ
   EMA: EMA9>20>50>200 ✅  EMA200:$63.63  EMA50:$78.01
   ADX:21  RSI:58  RVOL:0.92x  ROC20:+16.5%  ROC60:+43.2%
   VWAP:$83.15  HV30:36%  IV Rank:30  ✅
   RS vs SPY (60g): +40.5pp  Baz Aralığı:%18.1  60g Zirve:$87.84

═══════════════════════════════════════════════════════
🔥 GÜÇLÜ  #TDW  $84.50
🔮 Rejim: 📈 TREND REJİMİ  |  Giriş: 🌱 TREND BAŞLANGICI
📐 EM: ±$22.15 (üst ≤$106.65)  |  60g Zirve: $87.84
📊 IV: 53%  IV Rank: 30  🟡 NORMAL  |  Max Pain: $85.00
📅 Vade: 2026-07-17 (87 gün)
📈 RS vs SPY: +40.5pp  💪 PAZAR LİDERİ  |  30g Baz Aralığı: %18.1

🛡️ KURUMSAL SIĞINAK  (Delta rejim: trend)
   🎯 $85.0 CALL  (2026-07-17)
   💸 Prim: $8.95  Spread: 12.1%  |  Δ: 0.575  Γ: 0.0175
   📊 OI: 226  Vol: 1  Vol/OI: 0.00x
   💰 Kontrat: $960  Başabaş: $93.95
   🎯 EXIT: TP $12.53  |  SL $6.71  |  Time Stop 31 gün kala
   ⏱ Günlük Theta Erimesi: %0.6 prim/gün  |  Θ/Δ Kalite: 10.8
   📈 Sim (+%7, 21g): $9.45 → $11.82  (%+25)"""

# 22 April Data (FULL 18 Candidates)
text_22 = """#1 📊 AGNC  $10.90  PUAN:75.8  🌟🏆 MÜKEMMEL
   EMA: 🌟GOLDEN CROSS ✅  EMA200:$9.97  EMA50:$10.50
   ADX:23  RSI:61  RVOL:0.89x  ROC20:+11.0%  ROC60:-4.5%
   VWAP:$10.28  HV30:31%  IV Rank:16  ✅
   RS vs SPY (60g): -7.1pp  Baz Aralığı:%12.3  60g Zirve:$11.78

═══════════════════════════════════════════════════════
🌟🏆 MÜKEMMEL  #AGNC  $10.90
🔮 Rejim: 📈 TREND REJİMİ  |  Giriş: 🌟 GOLDEN CROSS — TREND DOĞUMU
📐 EM: ±$1.21 (üst ≤$12.11)  |  60g Zirve: $11.78
📊 IV: 17%  IV Rank: 16  ✅ UCUZ IV  |  Max Pain: $11.00
📅 Vade: 2026-09-18 (149 gün)
📈 RS vs SPY: -7.1pp  😟 ZAYIF  |  30g Baz Aralığı: %12.3

🛡️ KURUMSAL SIĞINAK  (Delta rejim: trend)
   🎯 $11.0 CALL  (2026-09-18)
   💸 Prim: $0.42  Spread: 6.8%  |  Δ: 0.562  Γ: 0.32459
   📊 OI: 12,234  Vol: 555  Vol/OI: 0.04x
   💰 Kontrat: $44  Başabaş: $11.44
   🎯 EXIT: TP $0.59  |  SL $0.32  |  Time Stop 52 gün kala
   ⏱ Günlük Theta Erimesi: %0.6 prim/gün  |  Θ/Δ Kalite: 234.33
   📈 Sim (+%7, 21g): $0.55 → $0.99  (%+82)

#2 📊 CZR  $27.69  PUAN:74.1  🔥 GÜÇLÜ
   EMA: EMA9>20>50>200 ✅  EMA200:$25.36  EMA50:$25.80
   ADX:20  RSI:60  RVOL:0.83x  ROC20:+5.2%  ROC60:+23.8%
   VWAP:$26.78  HV30:42%  IV Rank:19  ✅
   RS vs SPY (60g): +21.2pp  Baz Aralığı:%12.9  60g Zirve:$29.07

═══════════════════════════════════════════════════════
🔥 GÜÇLÜ  #CZR  $27.69
🔮 Rejim: 📈 TREND REJİMİ  |  Giriş: 🌱 TREND BAŞLANGICI
📐 EM: ±$7.66 (üst ≤$35.35)  |  60g Zirve: $29.07
📊 IV: 43%  IV Rank: 19  ✅ UCUZ IV  |  Max Pain: $27.00
📅 Vade: 2026-09-18 (149 gün)
📈 RS vs SPY: +21.2pp  💪 PAZAR LİDERİ  |  30g Baz Aralığı: %12.9

🛡️ KURUMSAL SIĞINAK  (Delta rejim: trend)
   🎯 $30.0 CALL  (2026-09-18)
   💸 Prim: $1.69  Spread: 14.3%  |  Δ: 0.452  Γ: 0.05826
   📊 OI: 388  Vol: 52  Vol/OI: 0.13x
   💰 Kontrat: $182  Başabaş: $31.82
   🎯 EXIT: TP $2.37  |  SL $1.27  |  Time Stop 52 gün kala
   ⏱ Günlük Theta Erimesi: %0.6 prim/gün  |  Θ/Δ Kalite: 43.06
   📈 Sim (+%7, 21g): $2.02 → $2.62  (%+30)

#3 📊 HAL  $39.15  PUAN:70.1  🔥 GÜÇLÜ
   EMA: EMA9>20>50>200 ✅  EMA200:$30.37  EMA50:$36.30
   ADX:21  RSI:59  RVOL:0.90x  ROC20:+2.7%  ROC60:+15.2%
   VWAP:$38.22  HV30:36%  IV Rank:30  ✅
   RS vs SPY (60g): +12.5pp  Baz Aralığı:%17.2  60g Zirve:$40.42

═══════════════════════════════════════════════════════
🔥 GÜÇLÜ  #HAL  $39.15
🔮 Rejim: 📈 TREND REJİMİ  |  Giriş: 🌱 TREND BAŞLANGICI
📐 EM: ±$7.95 (üst ≤$47.10)  |  60g Zirve: $40.42
📊 IV: 42%  IV Rank: 30  🟡 NORMAL  |  Max Pain: $39.00
📅 Vade: 2026-07-17 (86 gün)
📈 RS vs SPY: +12.5pp  💪 PAZAR LİDERİ  |  30g Baz Aralığı: %17.2

🛡️ KURUMSAL SIĞINAK  (Delta rejim: trend)
   🎯 $40.0 CALL  (2026-07-17)
   💸 Prim: $2.66  Spread: 4.8%  |  Δ: 0.519  Γ: 0.05159
   📊 OI: 2,397  Vol: 83  Vol/OI: 0.04x
   💰 Kontrat: $272  Başabaş: $42.72
   🎯 EXIT: TP $3.72  |  SL $1.99  |  Time Stop 30 gün kala
   ⏱ Günlük Theta Erimesi: %0.8 prim/gün  |  Θ/Δ Kalite: 25.59
   📈 Sim (+%7, 21g): $2.90 → $3.92  (%+35)

#4 📊 FCX  $69.72  PUAN:68.3  🔥 GÜÇLÜ
   EMA: EMA9>20>50>200 ✅  EMA200:$52.46  EMA50:$62.13
   ADX:22  RSI:65  RVOL:0.80x  ROC20:+23.7%  ROC60:+14.2%
   VWAP:$63.44  HV30:51%  IV Rank:34  ✅
   RS vs SPY (60g): +11.6pp  Baz Aralığı:%26.2  60g Zirve:$70.21

═══════════════════════════════════════════════════════
🔥 GÜÇLÜ  #FCX  $69.72
🔮 Rejim: 📈 TREND REJİMİ  |  Giriş: 🌱 TREND BAŞLANGICI
📐 EM: ±$16.79 (üst ≤$86.51)  |  60g Zirve: $70.21
📊 IV: 50%  IV Rank: 34  🟡 NORMAL  |  Max Pain: $70.00
📅 Vade: 2026-07-17 (86 gün)
📈 RS vs SPY: +11.6pp  💪 PAZAR LİDERİ  |  30g Baz Aralığı: %26.2

🛡️ KURUMSAL SIĞINAK  (Delta rejim: trend)
   🎯 $70.0 CALL  (2026-07-17)
   💸 Prim: $6.47  Spread: 3.8%  |  Δ: 0.561  Γ: 0.02348
   📊 OI: 2,661  Vol: 1,245  Vol/OI: 0.47x
   💰 Kontrat: $660  Başabaş: $76.60
   🎯 EXIT: TP $9.06  |  SL $4.86  |  Time Stop 30 gün kala
   ⏱ Günlük Theta Erimesi: %0.7 prim/gün  |  Θ/Δ Kalite: 13.07
   📈 Sim (+%7, 21g): $6.93 → $8.69  (%+25)

🚀 ASİMETRİK FIRSAT  [👀 SWEEP: 0.11x]
   🎯 $75.0 CALL  (2026-07-17)  ✅ EM İçinde ≤$86.51
   💸 Prim: $4.53  Spread: 3.3%  |  Δ: 0.446  Γ: 0.02372
   📊 OI: 2,239  Vol: 255  Vol/OI: 0.11x
   💰 Kontrat: $460  Başabaş: $79.60
   🎯 EXIT: TP $6.33  |  SL $3.39  |  Time Stop 30 gün kala
   ⏱ Günlük Theta Erimesi: %0.9 prim/gün  |  Θ/Δ Kalite: 10.64
   📈 Sim (+%10, 21g): $4.86 → $7.19  (%+48)

#5 📊 AAP  $59.13  PUAN:68.1  🔥 GÜÇLÜ
   EMA: EMA9>20>50>200 ✅  EMA200:$50.59  EMA50:$53.14
   ADX:22  RSI:66  RVOL:0.83x  ROC20:+16.7%  ROC60:+24.9%
   VWAP:$54.61  HV30:46%  IV Rank:27  ✅
   RS vs SPY (60g): +22.3pp  Baz Aralığı:%20.8  60g Zirve:$59.37

═══════════════════════════════════════════════════════
🔥 GÜÇLÜ  #AAP  $59.13
🔮 Rejim: 📈 TREND REJİMİ  |  Giriş: 🌱 TREND BAŞLANGICI
📐 EM: ±$24.42 (üst ≤$83.55)  |  60g Zirve: $59.37
📊 IV: 65%  IV Rank: 27  🟡 NORMAL  |  Max Pain: $57.50
📅 Vade: 2026-09-18 (149 gün)
📈 RS vs SPY: +22.3pp  💪 PAZAR LİDERİ  |  30g Baz Aralığı: %20.8

🛡️ KURUMSAL SIĞINAK  (Delta rejim: trend)
   🎯 $65.0 CALL  (2026-09-18)
   💸 Prim: $7.15  Spread: 6.8%  |  Δ: 0.505  Γ: 0.01697
   📊 OI: 195  Vol: 6  Vol/OI: 0.03x
   💰 Kontrat: $740  Başabaş: $72.40
   🎯 EXIT: TP $10.01  |  SL $5.36  |  Time Stop 52 gün kala
   ⏱ Günlük Theta Erimesi: %0.5 prim/gün  |  Θ/Δ Kalite: 14.63
   📈 Sim (+%7, 21g): $7.56 → $8.54  (%+13)

#6 📊 CE  $65.84  PUAN:67.3  🔥 GÜÇLÜ
   EMA: EMA9>20>50>200 ✅  EMA200:$52.05  EMA50:$58.99
   ADX:22  RSI:57  RVOL:0.77x  ROC20:+8.3%  ROC60:+38.6%
   VWAP:$64.25  HV30:73%  IV Rank:35  ✅
   RS vs SPY (60g): +36.0pp  Baz Aralığı:%24.9  60g Zirve:$68.34

═══════════════════════════════════════════════════════
🔥 GÜÇLÜ  #CE  $65.84
🔮 Rejim: 📈 TREND REJİMİ  |  Giriş: 🌱 TREND BAŞLANGICI
📐 EM: ±$26.51 (üst ≤$92.35)  |  60g Zirve: $68.34
📊 IV: 63%  IV Rank: 35  🟡 NORMAL  |  Max Pain: $65.00
📅 Vade: 2026-09-18 (149 gün)
📈 RS vs SPY: +36.0pp  💪 PAZAR LİDERİ  |  30g Baz Aralığı: %24.9

🛡️ KURUMSAL SIĞINAK  (Delta rejim: trend)
   🎯 $70.0 CALL  (2026-09-18)
   💸 Prim: $8.70  Spread: 10.9%  |  Δ: 0.537  Γ: 0.01530
   📊 OI: 152  Vol: 6  Vol/OI: 0.04x
   💰 Kontrat: $920  Başabaş: $79.20
   🎯 EXIT: TP $12.18  |  SL $6.52  |  Time Stop 52 gün kala
   ⏱ Günlük Theta Erimesi: %0.4 prim/gün  |  Θ/Δ Kalite: 14.07
   📈 Sim (+%7, 21g): $9.19 → $10.45  (%+14)

#7 📊 SIDU  $3.99  PUAN:67.0  🔥 GÜÇLÜ
   EMA: EMA20>50>200 ✅  EMA200:$2.30  EMA50:$3.19
   ADX:36  RSI:53  RVOL:1.44x  ROC20:+67.2%  ROC60:+13.8%
   VWAP:$3.93  HV30:210%  IV Rank:36  ✅
   RS vs SPY (60g): +11.2pp  Baz Aralığı:%99.1  60g Zirve:$5.95

═══════════════════════════════════════════════════════
🔥 GÜÇLÜ  #SIDU  $3.99
🔮 Rejim: 📈 TREND REJİMİ  |  Giriş: 🌱 TREND BAŞLANGICI
📐 EM: ±$3.41 (üst ≤$7.40)  |  60g Zirve: $5.95
📊 IV: 148%  IV Rank: 36  🔴 PAHALI  |  Max Pain: $4.00
📅 Vade: 2026-08-21 (121 gün)
📈 RS vs SPY: +11.2pp  💪 PAZAR LİDERİ  |  30g Baz Aralığı: %99.1

🛡️ KURUMSAL SIĞINAK  (Delta rejim: trend)
   🎯 $5.0 CALL  (2026-08-21)
   💸 Prim: $1.12  Spread: 12.5%  |  Δ: 0.590  Γ: 0.10699
   📊 OI: 3,214  Vol: 25  Vol/OI: 0.01x
   💰 Kontrat: $120  Başabaş: $6.20
   🎯 EXIT: TP $1.57  |  SL $0.84  |  Time Stop 42 gün kala
   ⏱ Günlük Theta Erimesi: %0.5 prim/gün  |  Θ/Δ Kalite: 98.27
   📈 Sim (+%7, 21g): $1.14 → $1.10  (%-4)

#8 📊 BAC  $53.10  PUAN:66.8  🔥 GÜÇLÜ
   EMA: 🔜NEAR GOLDEN ✅  EMA200:$50.23  EMA50:$51.16
   ADX:29  RSI:61  RVOL:0.87x  ROC20:+10.3%  ROC60:+2.6%
   VWAP:$51.29  HV30:22%  IV Rank:36  ✅
   RS vs SPY (60g): +0.0pp  Baz Aralığı:%14.3  60g Zirve:$56.21

═══════════════════════════════════════════════════════
🔥 GÜÇLÜ  #BAC  $53.10
🔮 Rejim: 📈 TREND REJİMİ  |  Giriş: 🔜 NEAR GOLDEN CROSS
📐 EM: ±$7.39 (üst ≤$60.49)  |  60g Zirve: $56.21
📊 IV: 29%  IV Rank: 36  🔴 PAHALI  |  Max Pain: $52.50
📅 Vade: 2026-07-17 (86 gün)
📈 RS vs SPY: +0.0pp  😐 NÖTR  |  30g Baz Aralığı: %14.3

🛡️ KURUMSAL SIĞINAK  (Delta rejim: trend)
   🎯 $55.0 CALL  (2026-07-17)
   💸 Prim: $1.89  Spread: 3.6%  |  Δ: 0.452  Γ: 0.05834
   📊 OI: 7,109  Vol: 56  Vol/OI: 0.01x
   💰 Kontrat: $192  Başabaş: $56.92
   🎯 EXIT: TP $2.64  |  SL $1.41  |  Time Stop 30 gün kala
   ⏱ Günlük Theta Erimesi: %1.0 prim/gün  |  Θ/Δ Kalite: 24.32
   📈 Sim (+%7, 21g): $2.15 → $3.67  (%+70)

#9 📊 CFG  $65.39  PUAN:64.1  🔥 GÜÇLÜ
   EMA: 🔜NEAR GOLDEN ✅  EMA200:$55.94  EMA50:$61.66
   ADX:22  RSI:65  RVOL:1.26x  ROC20:+10.9%  ROC60:+5.3%
   VWAP:$62.75  HV30:24%  IV Rank:28  ✅
   RS vs SPY (60g): +2.7pp  Baz Aralığı:%15.5  60g Zirve:$68.12

═══════════════════════════════════════════════════════
🔥 GÜÇLÜ  #CFG  $65.39
🔮 Rejim: 📈 TREND REJİMİ  |  Giriş: 🔜 NEAR GOLDEN CROSS
📐 EM: ±$9.50 (üst ≤$74.89)  |  60g Zirve: $68.12
📊 IV: 30%  IV Rank: 28  🟡 NORMAL  |  Max Pain: $65.00
📅 Vade: 2026-07-17 (86 gün)
📈 RS vs SPY: +2.7pp  💪 GÜÇLÜ  |  30g Baz Aralığı: %15.5

🛡️ KURUMSAL SIĞINAK  (Delta rejim: trend)
   🎯 $65.0 CALL  (2026-07-17)
   💸 Prim: $3.85  Spread: 7.5%  |  Δ: 0.578  Γ: 0.04119
   📊 OI: 566  Vol: 2  Vol/OI: 0.00x
   💰 Kontrat: $400  Başabaş: $69.00
   🎯 EXIT: TP $5.39  |  SL $2.89  |  Time Stop 30 gün kala
   ⏱ GünlükTheta Erimesi: %0.7 prim/gün  |  Θ/Δ Kalite: 22.04
   📈 Sim (+%7, 21g): $4.36 → $6.72  (%+54)

#10 📊 LEVI  $22.83  PUAN:63.3  🔥 GÜÇLÜ
   EMA: EMA9>20>50>200 ✅  EMA200:$20.35  EMA50:$20.79
   ADX:34  RSI:67  RVOL:0.75x  ROC20:+23.9%  ROC60:+8.2%
   VWAP:$21.04  HV30:42%  IV Rank:33  ✅
   RS vs SPY (60g): +5.6pp  Baz Aralığı:%23.9  60g Zirve:$23.36

═══════════════════════════════════════════════════════
🔥 GÜÇLÜ  #LEVI  $22.83
🔮 Rejim: 📈 TREND REJİMİ  |  Giriş: 🌱 TREND BAŞLANGICI
📐 EM: ±$4.56 (üst ≤$27.39)  |  60g Zirve: $23.36
📊 IV: 41%  IV Rank: 33  🟡 NORMAL  |  Max Pain: $23.00
📅 Vade: 2026-07-17 (86 gün)
📈 RS vs SPY: +5.6pp  💪 PAZAR LİDERİ  |  30g Baz Aralığı: %23.9

🛡️ KURUMSAL SIĞINAK  (Delta rejim: trend)
   🎯 $23.0 CALL  (2026-07-17)
   💸 Prim: $1.68  Spread: 8.6%  |  Δ: 0.548  Γ: 0.08681
   📊 OI: 553  Vol: 38  Vol/OI: 0.07x
   💰 Kontrat: $175  Başabaş: $24.75
   🎯 EXIT: TP $2.34  |  SL $1.26  |  Time Stop 30 gün kala
   ⏱ Günlük Theta Erimesi: %0.7 prim/gün  |  Θ/Δ Kalite: 45.70
   📈 Sim (+%7, 21g): $1.86 → $2.50  (%+34)

#11 📊 FHN  $24.57  PUAN:61.8  🔥 GÜÇLÜ
   EMA: 🔜NEAR GOLDEN ✅  EMA200:$22.68  EMA50:$23.57
   ADX:20  RSI:63  RVOL:0.96x  ROC20:+8.3%  ROC60:+2.2%
   VWAP:$23.80  HV30:23%  IV Rank:28  ✅
   RS vs SPY (60g): -0.5pp  Baz Aralığı:%12.5  60g Zirve:$26.03

═══════════════════════════════════════════════════════
🔥 GÜÇLÜ  #FHN  $24.57
🔮 Rejim: ⚡ KIRILIM REJİMİ  |  Giriş: 🔜 NEAR GOLDEN CROSS
📐 EM: ±$4.36 (üst ≤$28.93)  |  60g Zirve: $26.03
📊 IV: 31%  IV Rank: 28  🟡 NORMAL  |  Max Pain: $24.00
📅 Vade: 2026-08-21 (121 gün)
📈 RS vs SPY: -0.5pp  😐 NÖTR  |  30g Baz Aralığı: %12.5

🛡️ KURUMSAL SIĞINAK  (Delta rejim: breakout)
   🎯 $26.0 CALL  (2026-08-21)
   💸 Prim: $1.07  Spread: 13.0%  |  Δ: 0.444  Γ: 0.09158
   📊 OI: 254  Vol: 98  Vol/OI: 0.39x
   💰 Kontrat: $115  Başabaş: $27.15
   🎯 EXIT: TP $1.5  |  SL $0.81  |  Time Stop 42 gün kala
   ⏱ Günlük Theta Erimesi: %0.8 prim/gün  |  Θ/Δ Kalite: 52.85
   📈 Sim (+%7, 21g): $1.30 → $1.91  (%+47)

#12 📊 APLD  $31.68  PUAN:60.5  🌟🔥 GÜÇLÜ
   EMA: 🌟GOLDEN CROSS ✅  EMA200:$25.11  EMA50:$28.71
   ADX:17  RSI:60  RVOL:0.93x  ROC20:+18.2%  ROC60:-12.4%
   VWAP:$27.43  HV30:99%  IV Rank:32  ✅
   RS vs SPY (60g): -15.1pp  Baz Aralığı:%36.8  60g Zirve:$41.35

═══════════════════════════════════════════════════════
🌟🔥 GÜÇLÜ  #APLD  $31.68
🔮 Rejim: ⚡ KIRILIM REJİMİ  |  Giriş: 🌟 GOLDEN CROSS — TREND DOĞUMU
📐 EM: ±$16.24 (üst ≤$47.92)  |  60g Zirve: $41.35
📊 IV: 106%  IV Rank: 32  🟡 NORMAL  |  Max Pain: $31.00
📅 Vade: 2026-07-17 (86 gün)
📈 RS vs SPY: -15.1pp  😟 ZAYIF  |  30g Baz Aralığı: %36.8

🛡️ KURUMSAL SIĞINAK  (Delta rejim: breakout)
   🎯 $40.0 CALL  (2026-07-17)
   💸 Prim: $3.67  Spread: 9.1%  |  Δ: 0.423  Γ: 0.02478
   📊 OI: 887  Vol: 62  Vol/OI: 0.07x
   💰 Kontrat: $385  Başabaş: $43.85
   🎯 EXIT: TP $5.14  |  SL $2.76  |  Time Stop 30 gün kala
   ⏱ Günlük Theta Erimesi: %1.0 prim/gün  |  Θ/Δ Kalite: 11.34
   📉 Sim (+%7, 21g): $3.75 → $3.55  (%-5)

#13 📊 IBKR  $77.58  PUAN:60.5  🔥 GÜÇLÜ
   EMA: EMA9>20>50>200 ✅  EMA200:$66.91  EMA50:$71.97
   ADX:20  RSI:60  RVOL:1.04x  ROC20:+17.3%  ROC60:+3.1%
   VWAP:$72.92  HV30:43%  IV Rank:25  ✅
   RS vs SPY (60g): +0.5pp  Baz Aralığı:%23.2  60g Zirve:$81.71

═══════════════════════════════════════════════════════
🔥 GÜÇLÜ  #IBKR  $77.58
🔮 Rejim: 📈 TREND REJİMİ  |  Giriş: 🌱 TREND BAŞLANGICI
📐 EM: ±$20.11 (üst ≤$97.69)  |  60g Zirve: $81.71
📊 IV: 41%  IV Rank: 25  🟡 NORMAL  |  Max Pain: $75.00
📅 Vade: 2026-09-18 (149 gün)
📈 RS vs SPY: +0.5pp  😐 NÖTR  |  30g Baz Aralığı: %23.2

🛡️ KURUMSAL SIĞINAK  (Delta rejim: trend)
   🎯 $80.0 CALL  (2026-09-18)
   💸 Prim: $6.95  Spread: 1.4%  |  Δ: 0.536  Γ: 0.01976
   📊 OI: 777  Vol: 61  Vol/OI: 0.08x
   💰 Kontrat: $700  Başabaş: $87.00
   🎯 EXIT: TP $9.73  |  SL $5.21  |  Time Stop 52 gün kala
   ⏱ Günlük Theta Erimesi: %0.5 prim/gün  |  Θ/Δ Kalite: 17.01
   📈 Sim (+%7, 21g): $7.65 → $9.75  (%+28)

#14 📊 KEY  $22.07  PUAN:60.1  🔥 GÜÇLÜ
   EMA: 🔜NEAR GOLDEN ✅  EMA200:$19.37  EMA50:$20.80
   ADX:23  RSI:68  RVOL:0.93x  ROC20:+11.3%  ROC60:+4.7%
   VWAP:$20.98  HV30:20%  IV Rank:35  ✅
   RS vs SPY (60g): +2.0pp  Baz Aralığı:%14.9  60g Zirve:$22.98

═══════════════════════════════════════════════════════
🔥 GÜÇLÜ  #KEY  $22.07
🔮 Rejim: 📈 TREND REJİMİ  |  Giriş: 🔜 NEAR GOLDEN CROSS
📐 EM: ±$4.30 (üst ≤$26.37)  |  60g Zirve: $22.98
📊 IV: 30%  IV Rank: 35  🔴 PAHALI  |  Max Pain: $22.00
📅 Vade: 2026-09-18 (149 gün)
📈 RS vs SPY: +2.0pp  💪 GÜÇLÜ  |  30g Baz Aralığı: %14.9

🛡️ KURUMSAL SIĞINAK  (Delta rejim: trend)
   🎯 $23.0 CALL  (2026-09-18)
   💸 Prim: $1.17  Spread: 4.2%  |  Δ: 0.489  Γ: 0.10023
   📊 OI: 848  Vol: 1  Vol/OI: 0.00x
   💰 Kontrat: $120  Başabaş: $24.20
   🎯 EXIT: TP $1.64  |  SL $0.88  |  Time Stop 52 gün kala
   ⏱ Günlük Theta Erimesi: %0.6 prim/gün  |  Θ/Δ Kalite: 74.14
   📈 Sim (+%7, 21g): $1.38 → $2.02  (%+47)

🚀 ASİMETRİK FIRSAT  [👀 SWEEP: 0.13x]
   🎯 $24.0 CALL  (2026-09-18)  ✅ EM İçinde ≤$26.37
   💸 Prim: $0.78  Spread: 6.3%  |  Δ: 0.388  Γ: 0.10101
   📊 OI: 223  Vol: 28  Vol/OI: 0.13x
   💰 Kontrat: $80  Başabaş: $24.80
   🎯 EXIT: TP $1.08  |  SL $0.58  |  Time Stop 52 gün kala
   ⏱ Günlük Theta Erimesi: %0.8 prim/gün  |  Θ/Δ Kalite: 65.78
   📈 Sim (+%10, 21g): $0.94 → $1.81  (%+93)

#15 📊 DOW  $38.71  PUAN:57.5  💡 İYİ ⚠️VWAP↓
   EMA: EMA9>20>50>200 ✅  EMA200:$30.01  EMA50:$35.93
   ADX:20  RSI:52  RVOL:0.94x  ROC20:+1.0%  ROC60:+39.0%
   VWAP:$39.35  ⚠️ VWAP ALTI  HV30:60%  IV Rank:32  ✅
   RS vs SPY (60g): +36.4pp  Baz Aralığı:%19.4  60g Zirve:$41.87

═══════════════════════════════════════════════════════
💡 İYİ ⚠️VWAP↓  #DOW  $38.71
🔮 Rejim: 📈 TREND REJİMİ  |  Giriş: 🌱 TREND BAŞLANGICI
📐 EM: ±$8.65 (üst ≤$47.36)  |  60g Zirve: $41.87
📊 IV: 46%  IV Rank: 32  🟡 NORMAL  |  Max Pain: $37.50
📅 Vade: 2026-07-17 (86 gün)
📈 RS vs SPY: +36.4pp  💪 PAZAR LİDERİ  |  30g Baz Aralığı: %19.4

🛡️ KURUMSAL SIĞINAK  (Delta rejim: trend)
   🎯 $40.0 CALL  (2026-07-17)
   💸 Prim: $2.86  Spread: 1.4%  |  Δ: 0.506  Γ: 0.04657
   📊 OI: 781  Vol: 80  Vol/OI: 0.10x
   💰 Kontrat: $288  Başabaş: $42.88
   🎯 EXIT: TP $4.0  |  SL $2.15  |  Time Stop 30 gün kala
   ⏱ Günlük Theta Erimesi: %0.8 prim/gün  |  Θ/Δ Kalite: 22.91
   📈 Sim (+%7, 21g): $3.05 → $3.92  (%+29)

#16 📊 TFC  $50.95  PUAN:55.8  💡 İYİ
   EMA: 🔜NEAR GOLDEN ✅  EMA200:$46.65  EMA50:$48.46
   ADX:28  RSI:66  RVOL:0.85x  ROC20:+12.4%  ROC60:+2.5%
   VWAP:$48.08  HV30:23%  IV Rank:34  ✅
   RS vs SPY (60g): -0.1pp  Baz Aralığı:%14.2  60g Zirve:$55.25

═══════════════════════════════════════════════════════
💡 İYİ  #TFC  $50.95
🔮 Rejim: 📈 TREND REJİMİ  |  Giriş: 🔜 NEAR GOLDEN CROSS
📐 EM: ±$9.10 (üst ≤$60.05)  |  60g Zirve: $55.25
📊 IV: 28%  IV Rank: 34  🟡 NORMAL  |  Max Pain: $50.00
📅 Vade: 2026-09-18 (149 gün)
📈 RS vs SPY: -0.1pp  😐 NÖTR  |  30g Baz Aralığı: %14.2

🛡️ KURUMSAL SIĞINAK  (Delta rejim: trend)
   🎯 $52.5 CALL  (2026-09-18)
   💸 Prim: $2.75  Spread: 3.6%  |  Δ: 0.511  Γ: 0.04599
   📊 OI: 1,362  Vol: 9  Vol/OI: 0.01x
   💰 Kontrat: $280  Başabaş: $55.30
   🎯 EXIT: TP $3.85  |  SL $2.06  |  Time Stop 52 gün kala
   ⏱ Günlük Theta Erimesi: %0.5 prim/gün  |  Θ/Δ Kalite: 34.80
   📈 Sim (+%7, 21g): $3.23 → $4.85  (%+50)

#17 📊 KMI  $31.83  PUAN:44.7  📊 OLASI ⚠️VWAP↓
   EMA: EMA20>50>200 ✅  EMA200:$29.32  EMA50:$32.14
   ADX:23  RSI:40  RVOL:0.80x  ROC20:-6.2%  ROC60:+9.5%
   VWAP:$32.82  ⚠️ VWAP ALTI  HV30:18%  IV Rank:39  ✅
   RS vs SPY (60g): +6.9pp  Baz Aralığı:%7.9  60g Zirve:$34.07

═══════════════════════════════════════════════════════
📊 OLASI ⚠️VWAP↓  #KMI  $31.83
🔮 Rejim: 📈 TREND REJİMİ  |  Giriş: 📉→📈 EMA50 SEKMESI
📐 EM: ±$4.88 (üst ≤$36.71)  |  60g Zirve: $34.07
📊 IV: 24%  IV Rank: 39  🔴 PAHALI  |  Max Pain: $32.00
📅 Vade: 2026-09-18 (149 gün)
📈 RS vs SPY: +6.9pp  💪 PAZAR LİDERİ  |  30g Baz Aralığı: %7.9

🛡️ KURUMSAL SIĞINAK  (Delta rejim: trend)
   🎯 $33.0 CALL  (2026-09-18)
   💸 Prim: $1.40  Spread: 2.8%  |  Δ: 0.488  Γ: 0.08324
   📊 OI: 1,038  Vol: 15  Vol/OI: 0.01x
   💰 Kontrat: $142  Başabaş: $34.42
   🎯 EXIT: TP $1.96  |  SL $1.05  |  Time Stop 52 gün kala
   ⏱ Günlük Theta Erimesi: %0.6 prim/gün  |  Θ/Δ Kalite: 58.80
   📈 Sim (+%7, 21g): $1.68 → $2.69  (%+60)

#18 📊 SRE  $92.76  PUAN:40.5  📊 OLASI ⚠️VWAP↓
   EMA: EMA20>50>200 ✅  EMA200:$88.31  EMA50:$94.16
   ADX:17  RSI:38  RVOL:0.95x  ROC20:-2.4%  ROC60:+7.7%
   VWAP:$96.35  ⚠️ VWAP ALTI  HV30:20%  IV Rank:26  ✅
   RS vs SPY (60g): +5.1pp  Baz Aralığı:%8.7  60g Zirve:$99.75

═══════════════════════════════════════════════════════
📊 OLASI ⚠️VWAP↓  #SRE  $92.76
🔮 Rejim: ⚡ KIRILIM REJİMİ  |  Giriş: 📉→📈 EMA50 SEKMESI
📐 EM: ±$11.92 (üst ≤$104.68)  |  60g Zirve: $99.75
📊 IV: 26%  IV Rank: 26  🟡 NORMAL  |  Max Pain: $90.00
📅 Vade: 2026-07-17 (86 gün)
📈 RS vs SPY: +5.1pp  💪 PAZAR LİDERİ  |  30g Baz Aralığı: %8.7

🛡️ KURUMSAL SIĞINAK  (Delta rejim: breakout)
   🎯 $95.0 CALL  (2026-07-17)
   💸 Prim: $3.55  Spread: 13.2%  |  Δ: 0.488  Γ: 0.03346
   📊 OI: 768  Vol: 2  Vol/OI: 0.00x
   💰 Kontrat: $380  Başabaş: $98.80
   🎯 EXIT: TP $4.97  |  SL $2.66  |  Time Stop 30 gün kala
   ⏱ Günlük Theta Erimesi: %0.9 prim/gün  |  Θ/Δ Kalite: 14.66
   📈 Sim (+%7, 21g): $4.24 → $7.13  (%+68)"""

# Save results
os.makedirs("c:/Users/afksm/finma/data/2026-04-19", exist_ok=True)
with open("c:/Users/afksm/finma/data/2026-04-19/options_picks.json", 'w', encoding='utf-8') as f:
    json.dump(parse_report(text_19, "2026-04-19"), f, indent=2, ensure_ascii=False)

os.makedirs("c:/Users/afksm/finma/data/2026-04-20", exist_ok=True)
with open("c:/Users/afksm/finma/data/2026-04-20/options_picks.json", 'w', encoding='utf-8') as f:
    json.dump(merge_reports([parse_report(text_20_1, "2026-04-20"), parse_report(text_20_2, "2026-04-20")], "2026-04-20"), f, indent=2, ensure_ascii=False)

os.makedirs("c:/Users/afksm/finma/data/2026-04-21", exist_ok=True)
with open("c:/Users/afksm/finma/data/2026-04-21/options_picks.json", 'w', encoding='utf-8') as f:
    json.dump(parse_report(text_21, "2026-04-21"), f, indent=2, ensure_ascii=False)

os.makedirs("c:/Users/afksm/finma/data/2026-04-22", exist_ok=True)
with open("c:/Users/afksm/finma/data/2026-04-22/options_picks.json", 'w', encoding='utf-8') as f:
    json.dump(parse_report(text_22, "2026-04-22"), f, indent=2, ensure_ascii=False)

# Sync latest
os.makedirs("c:/Users/afksm/finma/transfer/latest", exist_ok=True)
with open("c:/Users/afksm/finma/transfer/latest/options_picks.json", 'w', encoding='utf-8') as f:
    json.dump(parse_report(text_22, "2026-04-22"), f, indent=2, ensure_ascii=False)

print("Parsed all dates with available data.")
