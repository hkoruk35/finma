"""
spy_0dte_options_sync.py — SPY 0DTE Black-Scholes Greeks + prim duyarlılık
eğrisi -> Supabase (Faz 2, bkz. tasks/active/013).

NEDEN AYRI BİR SCRIPT (opsiyon242.py'ye DOKUNULMADI):
  1) opsiyon242.py'nin sabit kapısı (boga_ticker_passes: RVOL>=1.5,
     EMA10>EMA20, RSI>=50 yükseliyor) bir endeks için nadiren geçer — SPY'ı
     aynı boru hattından geçirmek "çoğu zaman sonuç yok" demek olurdu.
  2) opsiyon242.py'nin DTE aralığı (DTE_MIN=1..DTE_MAX=30) 0DTE'yi (dte=0)
     AÇIKÇA dışlıyor; bunu global değiştirmek diğer TÜM ticker'ları etkiler.
  3) opsiyon242.py'nin save_picks() fonksiyonu KENDİ git-push'unu tetikliyor
     (bkz. run_options_scanner.py) — SPY'ı test etmek için tüm evreni
     çalıştırmak istenmeyen bir deploy riski taşırdı.
  Bu yüzden SPY'a özel, opsiyon242'den TAMAMEN BAĞIMSIZ, kendi DTE=0
  mantığıyla çalışan bu script yazıldı. opsiyon242.py'nin tek satırı bile
  değişmedi.

VERİ AKIŞI: yfinance (canlı SPY spot + 0DTE opsiyon zinciri) -> Black-Scholes
Greeks + hedef-fiyat prim eğrisi -> Supabase `shared_store` (key:
spyengine_option_decision) — robinhood_spy_sync.py ile AYNI DOĞRUDAN-REST
deseni kullanılıyor (bkz. o dosyanın üst yorumu: x-revalidate-secret /
Vercel sırrı eşleşmiyordu, doğrudan Supabase REST'e geçildi — aynı
tuzağa düşmemek için buradan başlanıyor, /api/internal/*-sync YOK).

ZAMANLAMA: run_options_scanner.py içinden çağrılır (BOGA_AI_Options_Scanner,
11:00 & 15:30 NY) — ayrı bir Task Scheduler kaydı GEREKMEZ.

UYDURMA YOK: SPY'ın bugünkü (0DTE) vadesi yoksa (hafta sonu/tatil kalıntısı
bir çalıştırma vb.) en yakın vadeye düşülür ve bu `isZeroDte: false` ile
AÇIKÇA raporlanır — sessizce "0DTE" etiketlenmez. IV her zaman Yahoo'nun
kendi ima edilen volatilitesinden gelir (tahmini/HV ile ikame edilmez);
bir strike için IV yoksa o strike atlanır.
"""

import json
import math
import sys
from datetime import datetime, date, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import requests
import yfinance as yf
from dotenv import dotenv_values

# Windows Task Scheduler'da stdout varsayılan cp1252 konsol kod sayfasına
# düşüyor ve Türkçe karakterler (ı, ş, ğ...) içeren print()'ler
# UnicodeEncodeError ile ÇÖKÜYOR -- bu, Supabase yazımı zaten BAŞARILI
# olduktan SONRA, sadece son log satırında oluşuyordu ama script'i hata
# koduyla sonlandırıyordu (run_options_scanner.py'de "başarısız" gibi
# loglanır). errors="replace" ile karakterler kaybolsa bile script asla
# bu yüzden çökmez.
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

REPO_ROOT = Path(__file__).resolve().parent
ROOT_ENV = dotenv_values(REPO_ROOT / ".env")
FRONTEND_ENV = dotenv_values(REPO_ROOT / "frontend" / ".env.local")


def env(key: str):
    return ROOT_ENV.get(key) or FRONTEND_ENV.get(key)


SUPABASE_URL = env("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_SERVICE_KEY = env("SUPABASE_SERVICE_KEY")
SHARED_STORE_KEY = "spyengine_option_decision"
NY_TZ = ZoneInfo("America/New_York")

# opsiyon242.py'deki r=0.05 sabitiyle TUTARLI (bkz. options_engine, satır ~1169)
RISK_FREE_RATE = 0.05

STRIKE_SPAN = 3   # ATM ±3 strike (SPY $1 aralıklarla ~7 kontrat)
TARGET_SPAN = 3   # prim eğrisinde ATM ±3 hedef fiyat


# ── Black-Scholes (call + put, opsiyon242.py'nin sadece-call bs_greeks/bs_price'ından bağımsız) ──

def norm_cdf(x: float) -> float:
    return (1.0 + math.erf(x / math.sqrt(2.0))) / 2.0


def norm_pdf(x: float) -> float:
    return math.exp(-0.5 * x * x) / math.sqrt(2.0 * math.pi)


def bs_price(is_call: bool, S: float, K: float, T: float, r: float, sigma: float) -> float:
    if T <= 0 or sigma <= 0:
        return max(0.0, (S - K) if is_call else (K - S))
    sq = math.sqrt(T)
    d1 = (math.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * sq)
    d2 = d1 - sigma * sq
    if is_call:
        return max(0.0, S * norm_cdf(d1) - K * math.exp(-r * T) * norm_cdf(d2))
    return max(0.0, K * math.exp(-r * T) * norm_cdf(-d2) - S * norm_cdf(-d1))


def bs_greeks(is_call: bool, S: float, K: float, T: float, r: float, sigma: float) -> dict:
    empty = {"delta": 0.0, "gamma": 0.0, "theta": 0.0, "vega": 0.0}
    if T <= 0 or sigma <= 0 or S <= 0 or K <= 0:
        return empty
    try:
        sq = math.sqrt(T)
        d1 = (math.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * sq)
        d2 = d1 - sigma * sq
        nd1 = norm_pdf(d1)
        gamma = nd1 / (S * sigma * sq)
        vega = S * nd1 * sq / 100
        if is_call:
            delta = norm_cdf(d1)
            theta = (-(S * nd1 * sigma) / (2 * sq) - r * K * math.exp(-r * T) * norm_cdf(d2)) / 365
        else:
            delta = norm_cdf(d1) - 1
            theta = (-(S * nd1 * sigma) / (2 * sq) + r * K * math.exp(-r * T) * norm_cdf(-d2)) / 365
        return {"delta": round(delta, 4), "gamma": round(gamma, 5), "theta": round(theta, 4), "vega": round(vega, 4)}
    except Exception:
        return empty


def expiry_candidates(tk: "yf.Ticker", today: date) -> list:
    """
    Denenecek vadeleri ÖNCELİK SIRASIYLA döndürür: bugünkü (0DTE) varsa önce
    o, sonra sırayla gelecek vadeler. TEK bir vade seçip dönmüyoruz çünkü
    "bugünkü" vade Yahoo'nun listesinde 16:00 ET kapanışından SONRA da bir
    süre görünmeye devam edebilir — o an artık T<=0 (süresi dolmuş) demektir
    ve Greeks/prim sıfıra düşer. build_snapshot bu durumda listedeki bir
    SONRAKİ vadeye geçer (bkz. o fonksiyondaki döngü).
    """
    try:
        options = tk.options
    except Exception:
        return []
    if not options:
        return []
    today_str = today.isoformat()
    ordered = sorted(options)
    today_first = [d for d in ordered if d == today_str] + [d for d in ordered if d != today_str]
    return today_first


def years_to_expiry(expiry_str: str, now_ny: datetime) -> float:
    """0DTE için TAKVİM GÜNÜ değil, o günün 16:00 ET kapanışına kalan GERÇEK süre kullanılır."""
    close_dt = datetime.strptime(expiry_str, "%Y-%m-%d").replace(hour=16, minute=0, second=0, tzinfo=NY_TZ)
    seconds = (close_dt - now_ny).total_seconds()
    return max(0.0, seconds / (365.0 * 24 * 3600))


def nearest_strikes(strikes: list, spot: float, span: int) -> list:
    if not strikes:
        return []
    atm = min(strikes, key=lambda s: abs(s - spot))
    idx = strikes.index(atm)
    lo = max(0, idx - span)
    hi = min(len(strikes), idx + span + 1)
    return strikes[lo:hi]


def build_snapshot():
    now_ny = datetime.now(NY_TZ)
    tk = yf.Ticker("SPY")

    hist = tk.history(period="1d", interval="1m")
    if hist.empty:
        print("HATA: SPY spot verisi alınamadı.")
        return None
    spot = float(hist["Close"].dropna().iloc[-1])

    candidates = expiry_candidates(tk, now_ny.date())
    if not candidates:
        print("HATA: SPY için opsiyon vadesi bulunamadı.")
        return None

    # "Bugünkü" vade Yahoo'nun listesinde 16:00 ET kapanışından sonra da bir
    # süre görünebilir -- o an T<=0 (süresi dolmuş) demektir ve Greeks sıfıra
    # düşer. İlk vade dolmuşsa (T<=0) sıradaki vadeye geçilir, uydurma/dejenere
    # bir sıfır-Greeks anlık görüntü YAZILMAZ.
    expiry = None
    years = 0.0
    chain = None
    for candidate in candidates:
        candidate_years = years_to_expiry(candidate, now_ny)
        if candidate_years <= 0:
            continue
        try:
            candidate_chain = tk.option_chain(candidate)
        except Exception:
            continue
        if candidate_chain.calls.empty or candidate_chain.puts.empty:
            continue
        expiry, years, chain = candidate, candidate_years, candidate_chain
        break

    if expiry is None:
        print("HATA: süresi dolmamış, geçerli bir opsiyon zinciri bulunamadı.")
        return None
    is_zero_dte = expiry == now_ny.date().isoformat()

    calls = chain.calls.sort_values("strike").reset_index(drop=True)
    puts = chain.puts.sort_values("strike").reset_index(drop=True)
    if calls.empty or puts.empty:
        print("HATA: opsiyon zinciri boş.")
        return None

    near_strikes = nearest_strikes(calls["strike"].tolist(), spot, STRIKE_SPAN)

    contracts = []
    for k in near_strikes:
        crow = calls[calls["strike"] == k]
        prow = puts[puts["strike"] == k]
        if crow.empty or prow.empty:
            continue
        c = crow.iloc[0]
        p = prow.iloc[0]

        call_iv = float(c.get("impliedVolatility") or 0)
        put_iv = float(p.get("impliedVolatility") or 0)
        if call_iv <= 0 and put_iv <= 0:
            continue  # IV verisi yok -- uydurma sigma kullanılmaz, strike atlanır
        call_sigma = call_iv if call_iv > 0 else put_iv
        put_sigma = put_iv if put_iv > 0 else call_iv

        call_greeks = bs_greeks(True, spot, float(k), years, RISK_FREE_RATE, call_sigma)
        put_greeks = bs_greeks(False, spot, float(k), years, RISK_FREE_RATE, put_sigma)

        premium_curve = []
        for off in range(-TARGET_SPAN, TARGET_SPAN + 1):
            target = round(spot) + off
            premium_curve.append({
                "targetPrice": target,
                "callPremium": round(bs_price(True, target, float(k), years, RISK_FREE_RATE, call_sigma), 4),
                "putPremium": round(bs_price(False, target, float(k), years, RISK_FREE_RATE, put_sigma), 4),
            })

        def _num(v):
            v = float(v or 0)
            return v if v > 0 else None

        contracts.append({
            "strike": float(k),
            "call": {
                "lastPrice": _num(c.get("lastPrice")),
                "bid": _num(c.get("bid")),
                "ask": _num(c.get("ask")),
                "impliedVolatility": call_iv or None,
                "greeks": call_greeks,
            },
            "put": {
                "lastPrice": _num(p.get("lastPrice")),
                "bid": _num(p.get("bid")),
                "ask": _num(p.get("ask")),
                "impliedVolatility": put_iv or None,
                "greeks": put_greeks,
            },
            "premiumCurve": premium_curve,
        })

    if not contracts:
        print("HATA: hiçbir strike için geçerli IV bulunamadı.")
        return None

    return {
        "generatedAt": now_ny.isoformat(),
        "spot": spot,
        "expiry": expiry,
        "isZeroDte": is_zero_dte,
        "yearsToExpiry": years,
        "riskFreeRate": RISK_FREE_RATE,
        "contracts": contracts,
    }


def supabase_headers(upsert: bool = False) -> dict:
    headers = {
        "apikey": SUPABASE_SERVICE_KEY or "",
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY or ''}",
        "Content-Type": "application/json",
    }
    if upsert:
        headers["Prefer"] = "resolution=merge-duplicates,return=minimal"
    return headers


def write_shared_store(value: dict) -> None:
    row = {"key": SHARED_STORE_KEY, "value": value, "updated_at": datetime.now(timezone.utc).isoformat()}
    res = requests.post(
        f"{SUPABASE_URL}/rest/v1/shared_store",
        params={"on_conflict": "key"},
        headers=supabase_headers(upsert=True),
        data=json.dumps([row]),
        timeout=30,
    )
    if res.status_code not in (200, 201, 204):
        raise RuntimeError(f"Supabase upsert HTTP {res.status_code}: {res.text[:400]}")


def check_env() -> list:
    missing = []
    if not SUPABASE_URL:
        missing.append("NEXT_PUBLIC_SUPABASE_URL")
    if not SUPABASE_SERVICE_KEY:
        missing.append("SUPABASE_SERVICE_KEY")
    return missing


def main() -> int:
    missing = check_env()
    if missing:
        print(f"HATA: eksik env değişkeni: {', '.join(missing)} (kök .env dosyasına bak)")
        return 1

    snapshot = build_snapshot()
    if snapshot is None:
        return 1

    try:
        write_shared_store(snapshot)
    except Exception as e:
        print(f"HATA: Supabase yazımı başarısız: {e}")
        return 1

    tag = "0DTE" if snapshot["isZeroDte"] else "en yakın vade (0DTE yok)"
    print(f"OK: SPY {snapshot['expiry']} ({tag}) — {len(snapshot['contracts'])} strike yazıldı.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
