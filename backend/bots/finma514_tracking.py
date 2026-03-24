"""
FinMA514 Smart Tracking — State Machine Bot
============================================
Her 5 dakikada bir takip listesindeki hisseler icin direktif hesaplar.

8 Direktif:
  TAKİP ET   — Skor 60-69, trend notr
  BEKLE      — Skor 70-74, hacim yetersiz
  KADEMELİ AL — Skor 75-79, RSI 40-50
  AL         — Skor >= 80, hacim + EMA kiriliyor
  TUT        — Pozisyon acik, skor >= 75, yapi bozulmadi
  MALIYET DUS — Fiyat -%3-5, uzun vadeli yapi sagla
  KADEMELİ SAT — Skor 60-74, momentum zayifliyor
  SAT        — Skor < 60 veya SL kirdigi

Profil:
  Day-Trade: SL %2, TP %3, cooldown 30 dk
  Swing:     SL %5, TP %8, cooldown 60 dk
"""

import io
import sys
import json
import time
import logging
import os
from datetime import datetime, timedelta
from typing import Optional

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("finma514_tracking")

# ─── Profil sabitleri ────────────────────────────────────────────────────────

PROFILE_CONFIG = {
    "day": {
        "sl_pct":      0.02,   # %2
        "tp_pct":      0.03,   # %3
        "cooldown_min": 30,
        "score_sensitivity": "high",
    },
    "swing": {
        "sl_pct":      0.05,   # %5
        "tp_pct":      0.08,   # %8
        "cooldown_min": 60,
        "score_sensitivity": "low",
    },
}

# ─── Direktif metinleri (Legal-Safe) ────────────────────────────────────────

DIRECTIVE_TEXT = {
    "TAKIP_ET":      "Yapi gozlem modunda. Su an netleshme bekleniyor.",
    "BEKLE":         "Fiyat hareketleniyor ancak hacim teyit etmiyor.",
    "KADEMELI_AL":   "Bazi yatirimcilar bu bolgede kademeli yaklasimi tercih edebilir.",
    "AL":            "Kirilim yapisi guchleniyor. Momentum artisi izleniyor.",
    "TUT":           "Mevcut yapi devam ediyor. Izleme onerilir.",
    "MALIYET_DUS":   "Bazi yatirimcilar mevcut seviyeyi ortalama icin degerlendiriyor.",
    "KADEMELI_SAT":  "Guc kaybi goruluyor. Bazi yatirimcilar pozisyon kuchultebilir.",
    "SAT":           "Risk referans seviyesi test edildi. Yapi zayiflama sinyali veriyor.",
}

DIRECTIVE_COLOR = {
    "TAKIP_ET":      "gray",
    "BEKLE":         "yellow",
    "KADEMELI_AL":   "cyan",
    "AL":            "green",
    "TUT":           "green",
    "MALIYET_DUS":   "yellow",
    "KADEMELI_SAT":  "orange",
    "SAT":           "red",
}


# ─── Yardimci: Gunluk skor al (Redis / JSON fallback) ───────────────────────

def get_daily_score(ticker: str) -> Optional[dict]:
    """Redis veya lokal JSON'dan gunluk skor bilgisi al."""
    try:
        import redis as redis_lib
        redis_url = os.getenv("REDIS_URL", "")
        if redis_url:
            r = redis_lib.from_url(redis_url, decode_responses=True)
            today = datetime.utcnow().strftime("%Y-%m-%d")
            raw = r.get(f"daily:top54:{today}")
            if raw:
                stocks = json.loads(raw)
                for s in stocks:
                    if s.get("ticker") == ticker:
                        return s
    except Exception:
        pass

    # JSON fallback
    try:
        here = os.path.dirname(os.path.abspath(__file__))
        json_path = os.path.join(here, "output", "finma514_latest.json")
        if os.path.exists(json_path):
            with open(json_path, encoding="utf-8") as f:
                data = json.load(f)
            stocks = data.get("stocks", [])
            for s in stocks:
                if s.get("ticker") == ticker:
                    return s
    except Exception:
        pass

    return None


# ─── Yardimci: Canli fiyat al ───────────────────────────────────────────────

def get_live_price(ticker: str) -> Optional[dict]:
    """yfinance ile anlık fiyat, hacim ve RSI al."""
    try:
        import yfinance as yf
        hist = yf.download(ticker, period="5d", interval="5m",
                           progress=False, threads=False)
        if hist is None or hist.empty:
            return None

        close  = float(hist["Close"].iloc[-1])
        volume = float(hist["Volume"].iloc[-1])

        # RSI (14 periyot)
        closes = hist["Close"].squeeze()
        delta  = closes.diff()
        gain   = delta.clip(lower=0)
        loss   = (-delta).clip(lower=0)
        avg_g  = gain.rolling(14).mean().iloc[-1]
        avg_l  = loss.rolling(14).mean().iloc[-1]
        rsi    = 100 - (100 / (1 + avg_g / avg_l)) if avg_l and avg_l > 0 else 50.0

        # RVOL (son candle vs 20-periyot ortalama)
        avg_vol = float(hist["Volume"].rolling(20).mean().iloc[-1]) or 1.0
        rvol    = volume / avg_vol

        # EMA20 vs EMA50
        ema20 = float(closes.ewm(span=20).mean().iloc[-1])
        ema50 = float(closes.ewm(span=50).mean().iloc[-1])

        return {
            "price":  close,
            "volume": volume,
            "rsi":    float(rsi),
            "rvol":   rvol,
            "ema20":  ema20,
            "ema50":  ema50,
        }
    except Exception as e:
        logger.warning(f"Canli fiyat alinamadi ({ticker}): {e}")
        return None


# ─── Direktif hesaplama ──────────────────────────────────────────────────────

def compute_directive(
    ticker: str,
    entry_price: float,
    profile: str,            # "day" | "swing"
    has_position: bool,
    daily_score: Optional[dict],
    live: Optional[dict],
) -> dict:
    """
    Mevcut score + canli veri ile 8 direktiften birini sechesin.
    Donusen dict: {directive, text, color, tp, sl, score, reason}
    """
    cfg = PROFILE_CONFIG.get(profile, PROFILE_CONFIG["swing"])
    tp  = round(entry_price * (1 + cfg["tp_pct"]), 2)
    sl  = round(entry_price * (1 - cfg["sl_pct"]), 2)

    score = daily_score.get("score", 0) if daily_score else 0
    rsi   = live.get("rsi",  50.0) if live else 50.0
    rvol  = live.get("rvol",  1.0) if live else 1.0
    ema20 = live.get("ema20",  0)  if live else 0
    ema50 = live.get("ema50",  0)  if live else 0
    price = live.get("price", entry_price) if live else entry_price

    # SL kirili mi?
    sl_broken = price < sl

    if sl_broken and has_position:
        directive = "SAT"
    elif score < 60:
        directive = "SAT"
    elif has_position and score >= 75:
        # Pozisyon var, yapi sagla → TUT
        if price < entry_price * 0.97:  # -%3 dusus
            directive = "MALIYET_DUS"
        else:
            directive = "TUT"
    elif score >= 80 and rvol >= 1.5 and ema20 > ema50:
        directive = "AL"
    elif 75 <= score <= 79 and 40 <= rsi <= 55:
        directive = "KADEMELI_AL"
    elif 70 <= score <= 74 and rvol < 1.2:
        directive = "BEKLE"
    elif 60 <= score <= 74 and ema20 < ema50:
        directive = "KADEMELI_SAT"
    elif 60 <= score <= 69:
        directive = "TAKIP_ET"
    else:
        directive = "BEKLE"

    return {
        "directive": directive,
        "text":      DIRECTIVE_TEXT[directive],
        "color":     DIRECTIVE_COLOR[directive],
        "score":     score,
        "tp":        tp,
        "sl":        sl,
        "price":     price,
        "rsi":       round(rsi, 1),
        "rvol":      round(rvol, 2),
        "computed_at": datetime.utcnow().isoformat(),
    }


# ─── State yazar (Redis) ─────────────────────────────────────────────────────

def write_state(user_id: str, ticker: str, state: dict) -> bool:
    """Redis'e state yazar, degisti mi doner."""
    try:
        import redis as redis_lib
        redis_url = os.getenv("REDIS_URL", "")
        if not redis_url:
            return False
        r = redis_lib.from_url(redis_url, decode_responses=True)
        key = f"state:{user_id}:{ticker}"
        prev = r.get(key)
        prev_dir = json.loads(prev).get("directive") if prev else None
        r.setex(key, 300, json.dumps(state))   # 5 dk TTL
        return prev_dir != state["directive"]   # True = degisti
    except Exception as e:
        logger.error(f"State yazma hatasi ({ticker}): {e}")
        return False


# ─── SSE event yayinla ───────────────────────────────────────────────────────

def publish_sse_event(user_id: str, ticker: str, state: dict):
    """Redis Pub/Sub ile SSE broadcast."""
    try:
        import redis as redis_lib
        redis_url = os.getenv("REDIS_URL", "")
        if not redis_url:
            return
        r = redis_lib.from_url(redis_url, decode_responses=True)
        payload = json.dumps({
            "event":     "TRACKING_STATE_UPDATED",
            "user_id":   user_id,
            "ticker":    ticker,
            "directive": state["directive"],
            "text":      state["text"],
            "color":     state["color"],
            "tp":        state["tp"],
            "sl":        state["sl"],
            "price":     state["price"],
        })
        r.publish("finma:tracking_stream", payload)
    except Exception as e:
        logger.error(f"SSE publish hatasi: {e}")


# ─── Ana dongu ───────────────────────────────────────────────────────────────

def run_tracking_cycle(tracking_items: list) -> list:
    """
    tracking_items: [
      {user_id, ticker, entry_price, profile, has_position}
    ]
    Her biri icin direktif hesapla, Redis'e yaz, degismisse SSE yayinla.
    """
    results = []
    processed = set()

    for item in tracking_items:
        user_id     = item["user_id"]
        ticker      = item["ticker"]
        entry_price = float(item.get("entry_price", 0))
        profile     = item.get("profile", "swing")
        has_pos     = bool(item.get("has_position", False))

        if ticker in processed:
            continue
        processed.add(ticker)

        # Cooldown kontrol
        try:
            import redis as redis_lib
            redis_url = os.getenv("REDIS_URL", "")
            if redis_url:
                r = redis_lib.from_url(redis_url, decode_responses=True)
                cd_key = f"cooldown:{user_id}:{ticker}"
                if r.exists(cd_key):
                    logger.debug(f"Cooldown aktif, atlaniyor: {ticker}")
                    continue
        except Exception:
            pass

        logger.info(f"  -> {ticker} hesaplaniyor...")
        daily  = get_daily_score(ticker)
        live   = get_live_price(ticker)
        state  = compute_directive(ticker, entry_price, profile, has_pos, daily, live)

        changed = write_state(user_id, ticker, state)
        if changed:
            logger.info(f"  [!] {ticker} direktif degisti: {state['directive']}")
            publish_sse_event(user_id, ticker, state)

            # Cooldown baslat
            try:
                cfg = PROFILE_CONFIG.get(profile, PROFILE_CONFIG["swing"])
                cd_secs = cfg["cooldown_min"] * 60
                r.setex(f"cooldown:{user_id}:{ticker}", cd_secs, "1")
            except Exception:
                pass

        results.append({"ticker": ticker, "state": state, "changed": changed})
        time.sleep(1.5)   # rate limit

    return results


# ─── Supabase'den tracking listesini al ─────────────────────────────────────

def load_tracking_list() -> list:
    """Supabase tracking_list tablosundan butun aktif kayitlari al."""
    try:
        supabase_url = os.getenv("SUPABASE_URL", "")
        supabase_key = os.getenv("SUPABASE_KEY", "")
        if not supabase_url or not supabase_key:
            return []
        from supabase import create_client
        sb = create_client(supabase_url, supabase_key)
        rows = sb.table("tracking_list").select("*").execute()
        return rows.data or []
    except Exception as e:
        logger.error(f"Tracking listesi yuklenemedi: {e}")
        return []


# ─── Entry point ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    logger.info("FinMA514 Tracking State Machine basliyor...")
    items = load_tracking_list()
    if not items:
        logger.warning("Takip listesi bos veya Supabase baglanamadi.")
    else:
        logger.info(f"{len(items)} kayit isleniyor...")
        results = run_tracking_cycle(items)
        for r in results:
            logger.info(f"  {r['ticker']}: {r['state']['directive']} (degisti={r['changed']})")
    logger.info("Tamamlandi.")
