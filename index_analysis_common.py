"""
Endeks analiz botlari (index_daily_analyzer.py / index_weekly_analyzer.py) icin
paylasilan yardimcilar: 9-endeks evreni, Supabase REST yazma/okuma, DeepSeek
cok-dilli narrative uretimi.

Desen top100_sync_common.py ile ayni: dotenv_values(frontend/.env.local) ile
env okunur, supabase-py DEGIL, ham requests ile /rest/v1/<table> cagrilir.

Indikator hesaplari swing117_boga.py'daki ile ayni kutuphane/periyotlari kullanir
(ta.momentum.RSIIndicator, ta.trend.EMAIndicator, ta.volatility.AverageTrueRange,
config.py: RSI_PERIOD=14, EMA_SHORT/MID/LONG=20/50/200, ATR_PERIOD=14) — boylece
platformun geri kalaniyla ayni RSI/EMA/ATR degerleri cikar.
"""
from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass
from datetime import datetime, timezone as dt_timezone
from pathlib import Path
from typing import Optional
from zoneinfo import ZoneInfo

import numpy as np
import pandas as pd
import requests
import yfinance as yf
from dotenv import dotenv_values
from ta.momentum import RSIIndicator
from ta.trend import EMAIndicator
from ta.volatility import AverageTrueRange

import config

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("index_analysis")

REPO_ROOT = Path(__file__).resolve().parent
ENV = dotenv_values(REPO_ROOT / "frontend" / ".env.local")

SUPABASE_URL = ENV.get("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_SERVICE_KEY = ENV.get("SUPABASE_SERVICE_KEY")
DEEPSEEK_API_KEY = ENV.get("DEEPSEEK_API_KEY")

LOCALES = ["en", "tr", "es", "fr", "pt"]

# ============================================================
# 9-ENDEKS EVRENI — frontend/lib/indices.ts ile birebir ayni
# ============================================================


@dataclass(frozen=True)
class AnalysisSession:
    """Bir endeksin kendi yerel saatinde tetiklenen adlandirilmis analiz oturumu."""
    name: str  # "premarket" | "midday" | "closing"
    trigger_time: str  # "HH:MM", endeksin kendi timezone'unda


@dataclass(frozen=True)
class IndexDefinition:
    symbol: str
    slug: str
    region: str  # "us" | "europe" | "asia" | "latam"
    yahoo_ticker: str
    name: str
    # ── Piyasa takvimi — her endeks KENDI borsasinin saatini tasir, "ET"
    # burada hardcode edilmez. Asya/LatAm/FX/kripto eklendiginde ayni desen
    # kullanilacak (bkz. koordinatorden gelen structural-fix talebi).
    timezone: str = "America/New_York"  # IANA tz string
    market_open: str = "09:30"  # yerel saat, "HH:MM"
    market_close: str = "16:00"  # yerel saat, "HH:MM"
    analysis_schedule: tuple[AnalysisSession, ...] = (
        AnalysisSession("premarket", "09:00"),
        AnalysisSession("midday", "13:00"),
        AnalysisSession("closing", "16:30"),
    )


# US endeksleri: NYSE/Nasdaq takvimi (America/New_York, 09:30-16:00 ET)
_US_SCHEDULE = (
    AnalysisSession("premarket", "09:00"),
    AnalysisSession("midday", "13:00"),
    AnalysisSession("closing", "16:30"),
)

# Avrupa (ve artik Asya/LatAm) endeksleri icin TEK gunluk oturum — sahibin
# 2026-08-08 talebi: Avrupa 3x/gun'den 1x/gun "genel ozet"e dusuruldu, yeni
# eklenen Asya/LatAm bolgeleri de bastan itibaren ayni 1x/gun desenini
# kullanir. Session adi hala "closing" (DB session CHECK'i degismedi),
# tetik saati borsanin KENDI kapanisindan ~15dk sonra.
def _closing_only(trigger_time: str) -> tuple[AnalysisSession, ...]:
    return (AnalysisSession("closing", trigger_time),)


INDEX_DEFINITIONS: dict[str, IndexDefinition] = {
    "SPX": IndexDefinition(
        "SPX", "sp500", "us", "^GSPC", "S&P 500",
        timezone="America/New_York", market_open="09:30", market_close="16:00",
        analysis_schedule=_US_SCHEDULE,
    ),
    "NDX": IndexDefinition(
        "NDX", "nasdaq-100", "us", "^NDX", "Nasdaq 100",
        timezone="America/New_York", market_open="09:30", market_close="16:00",
        analysis_schedule=_US_SCHEDULE,
    ),
    "DJI": IndexDefinition(
        "DJI", "dow-jones", "us", "^DJI", "Dow Jones",
        timezone="America/New_York", market_open="09:30", market_close="16:00",
        analysis_schedule=_US_SCHEDULE,
    ),
    "RUT": IndexDefinition(
        "RUT", "russell-2000", "us", "^RUT", "Russell 2000",
        timezone="America/New_York", market_open="09:30", market_close="16:00",
        analysis_schedule=_US_SCHEDULE,
    ),
    "DAX": IndexDefinition(
        "DAX", "dax", "europe", "^GDAXI", "DAX",
        timezone="Europe/Berlin", market_open="09:00", market_close="17:30",
        analysis_schedule=_closing_only("17:35"),
    ),
    "FTSE100": IndexDefinition(
        "FTSE100", "ftse-100", "europe", "^FTSE", "FTSE 100",
        timezone="Europe/London", market_open="08:00", market_close="16:30",
        analysis_schedule=_closing_only("16:35"),
    ),
    "CAC40": IndexDefinition(
        "CAC40", "cac-40", "europe", "^FCHI", "CAC 40",
        timezone="Europe/Paris", market_open="09:00", market_close="17:30",
        analysis_schedule=_closing_only("17:35"),
    ),
    "IBEX35": IndexDefinition(
        "IBEX35", "ibex-35", "europe", "^IBEX", "IBEX 35",
        timezone="Europe/Madrid", market_open="09:00", market_close="17:30",
        analysis_schedule=_closing_only("17:35"),
    ),
    "STOXX600": IndexDefinition(
        "STOXX600", "stoxx-600", "europe", "^STOXX", "STOXX Europe 600",
        timezone="Europe/Amsterdam", market_open="09:00", market_close="17:30",
        analysis_schedule=_closing_only("17:35"),
    ),
    # ── Yeni Avrupa endeksleri (2026-08-08 kapsam genisletme) ──
    "FTSEMIB": IndexDefinition(
        "FTSEMIB", "ftse-mib", "europe", "FTSEMIB.MI", "FTSE MIB",
        timezone="Europe/Rome", market_open="09:00", market_close="17:30",
        analysis_schedule=_closing_only("17:35"),
    ),
    "SMI": IndexDefinition(
        "SMI", "smi", "europe", "^SSMI", "SMI",
        timezone="Europe/Zurich", market_open="09:00", market_close="17:30",
        analysis_schedule=_closing_only("17:35"),
    ),
    "AEX": IndexDefinition(
        "AEX", "aex", "europe", "^AEX", "AEX",
        timezone="Europe/Amsterdam", market_open="09:00", market_close="17:30",
        analysis_schedule=_closing_only("17:35"),
    ),
    # ── Yeni bolge: Asya (2026-08-08) ──
    "NIKKEI225": IndexDefinition(
        "NIKKEI225", "nikkei-225", "asia", "^N225", "Nikkei 225",
        timezone="Asia/Tokyo", market_open="09:00", market_close="15:00",
        analysis_schedule=_closing_only("15:05"),
    ),
    "HANGSENG": IndexDefinition(
        "HANGSENG", "hang-seng", "asia", "^HSI", "Hang Seng",
        timezone="Asia/Hong_Kong", market_open="09:30", market_close="16:00",
        analysis_schedule=_closing_only("16:05"),
    ),
    "SHANGHAI": IndexDefinition(
        "SHANGHAI", "shanghai-composite", "asia", "000001.SS", "Shanghai Composite",
        timezone="Asia/Shanghai", market_open="09:30", market_close="15:00",
        analysis_schedule=_closing_only("15:05"),
    ),
    "KOSPI": IndexDefinition(
        "KOSPI", "kospi", "asia", "^KS11", "KOSPI",
        timezone="Asia/Seoul", market_open="09:00", market_close="15:30",
        analysis_schedule=_closing_only("15:35"),
    ),
    "NIFTY50": IndexDefinition(
        "NIFTY50", "nifty-50", "asia", "^NSEI", "Nifty 50",
        timezone="Asia/Kolkata", market_open="09:15", market_close="15:30",
        analysis_schedule=_closing_only("15:35"),
    ),
    "ASX200": IndexDefinition(
        "ASX200", "asx-200", "asia", "^AXJO", "ASX 200",
        timezone="Australia/Sydney", market_open="10:00", market_close="16:00",
        analysis_schedule=_closing_only("16:05"),
    ),
    # ── Yeni bolge: Latin Amerika (2026-08-08). NOT: IPSA (Sili) yfinance'ta
    # (IPSA / ^IPSA / IPSA.SN denendi) veri donmedigi icin roster'a EKLENMEDI —
    # bkz. rapor. ──
    "BOVESPA": IndexDefinition(
        "BOVESPA", "bovespa", "latam", "^BVSP", "Bovespa",
        timezone="America/Sao_Paulo", market_open="10:00", market_close="17:00",
        analysis_schedule=_closing_only("17:05"),
    ),
    "IPCMEXICO": IndexDefinition(
        "IPCMEXICO", "ipc-mexico", "latam", "^MXX", "IPC Mexico",
        timezone="America/Mexico_City", market_open="08:30", market_close="15:00",
        analysis_schedule=_closing_only("15:05"),
    ),
    "MERVAL": IndexDefinition(
        "MERVAL", "merval", "latam", "^MERV", "MERVAL",
        timezone="America/Argentina/Buenos_Aires", market_open="11:00", market_close="17:00",
        analysis_schedule=_closing_only("17:05"),
    ),
}

ALL_SYMBOLS = list(INDEX_DEFINITIONS.keys())
US_SYMBOLS = [s for s, d in INDEX_DEFINITIONS.items() if d.region == "us"]

MACRO_TICKERS = {"vix": "^VIX", "us10y": "^TNX", "dxy": "DX-Y.NYB"}


def resolve_market_now(index_def: IndexDefinition) -> datetime:
    """Verilen endeksin KENDI zaman diliminde 'su an'i doner (America/New_York
    her yerde hardcode edilmez — her IndexDefinition kendi timezone'unu tasir)."""
    return datetime.now(ZoneInfo(index_def.timezone))


def infer_session_for_index(index_def: IndexDefinition, now_local: Optional[datetime] = None) -> str:
    """
    Endeksin KENDI analysis_schedule'ina (kendi yerel saatinde tanimli tetik
    saatleri) gore en uygun session adini secer. Tum semboller icin tek bir
    global NY-saat kontrolu YAPILMAZ — her endeks kendi borsasinin saatine gore
    degerlendirilir (bkz. Avrupa endeksleri icin structural fix).

    Kural: su anki yerel saat, schedule'daki tetik saatlerinden en son gecmis
    olana (>=) esitse/gectiyse o session secilir; hicbiri gecmediyse (henuz
    ilk tetikten once) yine de ilk session dondurulur (en erken oturum, cunku
    "henuz oturum yok" durumu bu botun DB semasinda yok — session NOT NULL).
    """
    local = now_local or resolve_market_now(index_def)
    local_minutes = local.hour * 60 + local.minute
    schedule = sorted(index_def.analysis_schedule, key=lambda s: s.trigger_time)

    chosen = schedule[0].name
    for session in schedule:
        h, m = session.trigger_time.split(":")
        trigger_minutes = int(h) * 60 + int(m)
        if local_minutes >= trigger_minutes:
            chosen = session.name
        else:
            break
    return chosen


def supabase_headers(upsert: bool = False) -> dict:
    headers = {
        "apikey": SUPABASE_SERVICE_KEY or "",
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY or ''}",
        "Content-Type": "application/json",
    }
    if upsert:
        headers["Prefer"] = "resolution=merge-duplicates"
    return headers


def check_env() -> list[str]:
    """Eksik env degiskenlerini dondurur (bos liste = hepsi tamam)."""
    missing = []
    if not SUPABASE_URL:
        missing.append("NEXT_PUBLIC_SUPABASE_URL")
    if not SUPABASE_SERVICE_KEY:
        missing.append("SUPABASE_SERVICE_KEY")
    if not DEEPSEEK_API_KEY:
        missing.append("DEEPSEEK_API_KEY")
    return missing


# PostgREST "Prefer: resolution=merge-duplicates" TEK BASINA yetmiyor —
# hangi unique constraint uzerinden merge edilecegini bilmesi icin ayrica
# on_conflict query param'i gerekiyor, yoksa duz INSERT dener ve unique
# constraint ihlalinde 409 doner (bkz. 2026-08-08 canli hata).
UPSERT_CONFLICT_TARGETS = {
    "index_daily_snapshot": "index_symbol,trade_date,session",
    "index_weekly_snapshot": "index_symbol,week_start",
}


def supabase_upsert(table: str, row: dict) -> None:
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        raise RuntimeError("Supabase env degiskenleri eksik (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_KEY)")
    on_conflict = UPSERT_CONFLICT_TARGETS.get(table)
    params = {"on_conflict": on_conflict} if on_conflict else None
    res = requests.post(
        f"{SUPABASE_URL}/rest/v1/{table}",
        headers=supabase_headers(upsert=True),
        params=params,
        data=json.dumps(row, default=str),
        timeout=30,
    )
    if res.status_code not in (200, 201, 204):
        raise RuntimeError(f"Supabase upsert HTTP {res.status_code} ({table}): {res.text[:500]}")


def supabase_select(table: str, params: dict) -> list[dict]:
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        return []
    res = requests.get(
        f"{SUPABASE_URL}/rest/v1/{table}",
        headers=supabase_headers(),
        params=params,
        timeout=20,
    )
    res.raise_for_status()
    return res.json()


# ============================================================
# FIYAT VERISI + INDIKATORLER
# ============================================================


def fetch_history(yahoo_ticker: str, lookback_days: int = config.LOOKBACK_DAYS) -> Optional[pd.DataFrame]:
    """yfinance ile gunluk OHLCV cekimi. Basarisiz olursa None doner (crash yok)."""
    try:
        df = yf.download(
            yahoo_ticker,
            period=f"{lookback_days}d",
            interval="1d",
            progress=False,
            auto_adjust=True,
            ignore_tz=True,
        )
        if df is None or df.empty:
            return None
        # yfinance bazen MultiIndex kolon donuyor (tek ticker'da bile) — duzlestir
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)
        return df.dropna(how="all")
    except Exception as exc:
        logger.warning(f"fetch_history({yahoo_ticker}) basarisiz: {exc}")
        return None


def fetch_last_value(yahoo_ticker: str) -> Optional[float]:
    """Tek deger (VIX/US10Y/DXY gibi makro seri) icin son kapanis. Best-effort."""
    try:
        df = yf.download(yahoo_ticker, period="10d", interval="1d", progress=False, ignore_tz=True)
        if df is None or df.empty:
            return None
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)
        close = df["Close"].dropna()
        if close.empty:
            return None
        return round(float(close.iloc[-1]), 4)
    except Exception as exc:
        logger.warning(f"fetch_last_value({yahoo_ticker}) basarisiz: {exc}")
        return None


def compute_quant_metrics(df: pd.DataFrame) -> Optional[dict]:
    """
    Tek bir endeks fiyat serisinden temel quant metrikleri hesaplar.
    Indikator periyotlari config.py ile ayni (RSI_PERIOD=14, EMA 20/50/200, ATR_PERIOD=14).

    volatility_20d: son 20 gunluk basit gunluk getiri stdev'i, yillik-ize edilmis
    (stdev * sqrt(252)) — swing117_boga.py'de ayri bir volatilite metrigi olmadigi
    icin burada standart finans konvansiyonu (annualized realized vol) secildi.
    """
    if df is None or len(df) < 5:
        return None
    close = df["Close"].astype(float)
    high = df["High"].astype(float)
    low = df["Low"].astype(float)
    volume = df["Volume"].astype(float) if "Volume" in df.columns else None

    last_close = float(close.iloc[-1])
    prev_close = float(close.iloc[-2]) if len(close) >= 2 else last_close
    change_pct = round((last_close / prev_close - 1) * 100, 3) if prev_close else None

    change_pct_1w = None
    if len(close) >= 6:
        ref = float(close.iloc[-6])
        change_pct_1w = round((last_close / ref - 1) * 100, 3) if ref else None

    change_pct_20d = None
    if len(close) >= 21:
        ref = float(close.iloc[-21])
        change_pct_20d = round((last_close / ref - 1) * 100, 3) if ref else None

    ema20 = ema50 = ema200 = None
    if len(close) >= config.EMA_SHORT:
        ema20 = round(float(EMAIndicator(close, config.EMA_SHORT).ema_indicator().iloc[-1]), 4)
    if len(close) >= config.EMA_MID:
        ema50 = round(float(EMAIndicator(close, config.EMA_MID).ema_indicator().iloc[-1]), 4)
    if len(close) >= config.EMA_LONG:
        ema200 = round(float(EMAIndicator(close, config.EMA_LONG).ema_indicator().iloc[-1]), 4)

    rsi14 = None
    if len(close) >= config.RSI_PERIOD + 1:
        rsi14 = round(float(RSIIndicator(close, config.RSI_PERIOD).rsi().iloc[-1]), 2)

    atr14 = None
    if len(close) >= config.ATR_PERIOD + 1:
        atr14 = round(float(AverageTrueRange(high, low, close, config.ATR_PERIOD).average_true_range().iloc[-1]), 4)

    volatility_20d = None
    if len(close) >= 21:
        daily_returns = close.pct_change().dropna().iloc[-20:]
        if len(daily_returns) >= 5:
            volatility_20d = round(float(daily_returns.std() * np.sqrt(252) * 100), 3)

    distance_from_20d_high_pct = None
    if len(high) >= 20:
        high_20d = float(high.iloc[-20:].max())
        distance_from_20d_high_pct = round((last_close / high_20d - 1) * 100, 3) if high_20d else None

    last_volume = int(volume.iloc[-1]) if volume is not None and not volume.empty and not pd.isna(volume.iloc[-1]) else None

    return {
        "close": round(last_close, 4),
        "change_pct": change_pct,
        "change_pct_1w": change_pct_1w,
        "change_pct_20d": change_pct_20d,
        "ema20": ema20,
        "ema50": ema50,
        "ema200": ema200,
        "rsi14": rsi14,
        "atr14": atr14,
        "volatility_20d": volatility_20d,
        "distance_from_20d_high_pct": distance_from_20d_high_pct,
        "volume": last_volume,
    }


def compute_top_movers(limit: int = 3) -> dict:
    """
    SADECE US endeksleri (SPX/NDX/DJI/RUT) icin: config.FIXED_100_TICKERS
    evreninden (~350 likit buyuk ABD hissesi, config.py) batch fiyat cekip
    gunluk change_pct'e gore en cok yukselen/dusen `limit` adet hisseyi doner.

    ONEMLI SINIRLAMA: Bu repo'da resmi S&P 500 / Nasdaq 100 / Dow Jones /
    Russell 2000 bilesen listesi YOK (ne CSV ne canli scraper) — bu fonksiyon
    OFISYEL endeks bilesenlerini degil, mevcut curated evreni kullanir. Tum
    US endeksleri su an AYNI evreni paylasir (endekse ozel daha akilli bir
    bolme yok, cunku bu evreni endekslere ayiracak bir kaynak da yok).
    Avrupa endeksleri icin cagrilmaz — compute_sector_breadth ile ayni desen:
    guvenilir bir ulke bazli hisse evreni olmadigi icin bos liste doner (bkz.
    analyze_symbol'daki region=="us" kontrolu).

    `name` alani icin bu kod tabaninda guvenilir/hizli bir ticker->sirket-adi
    haritasi yok (build_swing_performance.py'deki persistent_info_cache.json
    bu pipeline'in disinda, harici/yerel bir dosya) — bu yuzden name=ticker
    fallback kullanilir.
    """
    tickers = config.FIXED_100_TICKERS
    try:
        data = yf.download(
            tickers,
            period="5d",
            interval="1d",
            progress=False,
            auto_adjust=True,
            ignore_tz=True,
            group_by="ticker",
            threads=True,
        )
    except Exception as exc:
        logger.warning(f"compute_top_movers batch fetch basarisiz: {exc}")
        return {"top_gainers": [], "top_losers": []}

    if data is None or data.empty:
        return {"top_gainers": [], "top_losers": []}

    is_multi = isinstance(data.columns, pd.MultiIndex)
    top_level = set(data.columns.get_level_values(0)) if is_multi else None

    movers: list[dict] = []
    for t in tickers:
        try:
            if is_multi:
                if t not in top_level:
                    continue
                close = data[t]["Close"].dropna()
            else:
                # Tek ticker fallback (batch bir tek hisseye dusmusse yfinance MultiIndex donmez)
                close = data["Close"].dropna()
            if len(close) < 2:
                continue
            last = float(close.iloc[-1])
            prev = float(close.iloc[-2])
            if not prev:
                continue
            change_pct = round((last / prev - 1) * 100, 3)
            movers.append({"ticker": t, "name": t, "price": round(last, 2), "change_pct": change_pct})
        except Exception:
            continue

    if not movers:
        return {"top_gainers": [], "top_losers": []}

    ranked = sorted(movers, key=lambda m: m["change_pct"], reverse=True)
    top_gainers = ranked[:limit]
    remaining = ranked[len(top_gainers):]
    top_losers = list(reversed(remaining[-limit:])) if remaining else []

    return {"top_gainers": top_gainers, "top_losers": top_losers}


def compute_sector_breadth(us_index_symbol: str) -> dict:
    """
    SADECE US endeksleri icin: config.SECTOR_ETF_MAP'teki 11 sektor ETF'inin
    gunluk degisimine bakarak advancers/decliners/sector_leaders yaklastirir.
    Avrupa endeksleri icin cagrilmaz (guvenilir sektor ETF proxy'si yok).
    """
    sector_changes: list[dict] = []
    for sector, etf in config.SECTOR_ETF_MAP.items():
        df = fetch_history(etf, lookback_days=10)
        if df is None or len(df) < 2:
            continue
        close = df["Close"].astype(float)
        chg = round((float(close.iloc[-1]) / float(close.iloc[-2]) - 1) * 100, 3)
        sector_changes.append({"sector": sector, "etf": etf, "change_pct": chg})

    if not sector_changes:
        return {"advancers": None, "decliners": None, "sector_leaders": None}

    advancers = sum(1 for s in sector_changes if s["change_pct"] > 0)
    decliners = sum(1 for s in sector_changes if s["change_pct"] < 0)
    top3 = sorted(sector_changes, key=lambda s: s["change_pct"], reverse=True)[:3]
    sector_leaders = [{"sector": s["sector"], "change_pct": s["change_pct"]} for s in top3]

    return {"advancers": advancers, "decliners": decliners, "sector_leaders": sector_leaders}


# ============================================================
# DEEPSEEK — COK DILLI NARRATIVE URETIMI
# ============================================================


def _extract_json(raw: str) -> Optional[dict]:
    """DeepSeek bazen yaniti aciklama/markdown ile sarabiliyor — ilk { son } arasini al."""
    start = raw.find("{")
    end = raw.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return None
    try:
        return json.loads(raw[start : end + 1])
    except Exception:
        return None


def call_deepseek(system_prompt: str, user_prompt: str, max_tokens: int = 2500, timeout: int = 45) -> Optional[dict]:
    """
    OpenAI-uyumlu DeepSeek chat/completions endpoint'ine ham requests cagrisi.
    frontend/lib/earnings/deepseekAnalysis.ts ile ayni desen (model deepseek-chat,
    response_format json_object, temperature 0.1).
    """
    if not DEEPSEEK_API_KEY:
        logger.warning("DEEPSEEK_API_KEY eksik — narrative uretimi atlandi.")
        return None
    try:
        res = requests.post(
            "https://api.deepseek.com/chat/completions",
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {DEEPSEEK_API_KEY}"},
            json={
                "model": "deepseek-chat",
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                "temperature": 0.1,
                "response_format": {"type": "json_object"},
                "max_tokens": max_tokens,
            },
            timeout=timeout,
        )
        if res.status_code != 200:
            logger.warning(f"DeepSeek HTTP {res.status_code}: {res.text[:300]}")
            return None
        data = res.json()
        text = data.get("choices", [{}])[0].get("message", {}).get("content")
        if not text:
            logger.warning("DeepSeek: bos yanit")
            return None
        parsed = _extract_json(text)
        if parsed is None:
            logger.warning("DeepSeek: gecerli JSON parse edilemedi")
        return parsed
    except Exception as exc:
        logger.warning(f"DeepSeek cagrisi basarisiz: {exc}")
        return None


NARRATIVE_TONE_RULE = (
    "Kesinlikle 'X seviyesinden al' / 'Y seviyesinden sat' gibi somut alim-satim tavsiyesi verme. "
    "Bunun yerine bullish/neutral/risk senaryo cercevesiyle konus (orn. 'yukselis senaryosunda...', "
    "'risk senaryosunda...'). Bu bir yatirim tavsiyesi degil, teknik/quant gozlem ozetidir."
)

# AI/rakam ayrimi (strict separation): Frontend TUM sayisal degerleri dogrudan
# DB kolonlarindan / quant_snapshot'tan render eder, hicbir zaman AI metninden
# parse ETMEZ. Bu yuzden AI'nin metin icinde herhangi bir sayi (yuzde, seviye,
# indikator degeri) restate etmesi YASAKLANIR — DB'deki sayi ile AI'nin
# yazdigi sayi bir gun farkli cikarsa (halusinasyon) bu bir tutarsizlik riski
# yaratir. Kural: sadece nitel ifadeler (orn. "hafif toparlanma", "orta
# duzey volatilite", "guclu momentum") kullanilir, hicbir rakam yazilmaz.
NUMBER_FREE_RULE = (
    "COK ONEMLI: Metin icinde HICBIR sayisal deger (yuzde, fiyat seviyesi, RSI/EMA/ATR degeri, "
    "indeks puani, tarih disi herhangi bir rakam) YAZMA. Site zaten tum sayilari veritabanindan "
    "dogrudan gosteriyor; senin yazdigin bir rakam veritabanindakiyle farkli olursa tutarsizlik "
    "yaratir. Bunun yerine SADECE nitel ifadeler kullan: 'hafif toparlanma', 'orta duzey volatilite', "
    "'guclu yukselis momentumu', 'zayif piyasa genisligi' gibi. Yon ve buyuklugu kelimelerle anlat, "
    "rakamla anlatma."
)

# ai_narrative jsonb semasi: her locale -> 7 nitel alan (tek bir serbest-metin
# narrative DEGIL). Boylece frontend her alani ayri ayri, sayidan bagimsiz
# olarak yerlestirebilir.
NARRATIVE_FIELDS = [
    "summary",
    "market_drivers",
    "trend_interpretation",
    "risk_factors",
    "bullish_scenario",
    "neutral_scenario",
    "risk_scenario",
]


def build_daily_narrative_prompt(index_name: str, quant_snapshot: dict) -> tuple[str, str]:
    system_prompt = (
        "Sen BogaStock platformu icin calisan kidemli bir piyasa endeksi analiz sistemisin. "
        "Sadece gecerli bir JSON objesi olarak yanit ver, aciklama/markdown/on soz ekleme. "
        "Ilk karakter { son karakter } olmalidir."
    )
    user_prompt = f"""Asagida {index_name} endeksine ait guncel quant/teknik veriler bulunuyor (SADECE senin baglam icin,
bu rakamlari metinde TEKRARLAMAYACAKSIN — site bunlari zaten DB'den dogrudan gosteriyor):
{json.dumps(quant_snapshot, default=str)}

Bu verilere dayanarak 5 dilin ({', '.join(LOCALES)}) HER BIRI icin, asagidaki 7 nitel alani doldur.
Format (her locale kodu ayni semada, o dilde yazilmis icerikle):
{{
  "en": {{
    "summary": "1-2 sentence qualitative overview",
    "market_drivers": "1-2 sentences on what's driving the move, qualitatively",
    "trend_interpretation": "1-2 sentences on trend structure (e.g. above/below moving averages, momentum direction)",
    "risk_factors": "1-2 sentences on key risks to watch",
    "bullish_scenario": "1-2 sentences describing the bullish scenario qualitatively",
    "neutral_scenario": "1-2 sentences describing the neutral/range-bound scenario",
    "risk_scenario": "1-2 sentences describing the downside/risk scenario"
  }},
  "tr": {{ ... same 7 fields, in Turkish ... }},
  "es": {{ ... }},
  "fr": {{ ... }},
  "pt": {{ ... }}
}}

Kurallar: Sadece verilen rakamlara dayan, uydurma haber/katalizor ekleme. {NARRATIVE_TONE_RULE} {NUMBER_FREE_RULE}"""
    return system_prompt, user_prompt


def parse_narrative_response(parsed: Optional[dict]) -> tuple[dict, bool, bool]:
    """
    parsed = {"en": {"summary": "...", "market_drivers": "...", ...}, ...} beklenir
    (7 alan: bkz. NARRATIVE_FIELDS).

    Kalite kontrolu: her alan icin bos veya ~40 karakterden kisa ise o alan None
    olarak isaretlenir (tum locale/field kombinasyonu ayri ayri kontrol edilir).

    Doner: (ai_narrative {locale: {field: str|None}}, all_ok, any_ok)
      all_ok  = tum locale'lerdeki TUM alanlar kalite kontrolunu gecti mi
      any_ok  = en az bir locale'de en az bir alan gecti mi (tamamen bos degil)
    """
    out: dict = {}
    all_ok = True
    any_ok = False
    for locale in LOCALES:
        entry = parsed.get(locale) if parsed and isinstance(parsed, dict) else None
        locale_out: dict = {}
        for field in NARRATIVE_FIELDS:
            text = entry.get(field) if isinstance(entry, dict) else None
            if isinstance(text, str) and len(text.strip()) >= 40:
                locale_out[field] = text.strip()
                any_ok = True
            else:
                if text is not None:
                    logger.warning(f"Narrative alan kalite kontrolunden gecemedi (locale={locale}, field={field}, len={len(text or '')})")
                locale_out[field] = None
                all_ok = False
        out[locale] = locale_out
    return out, all_ok, any_ok


def empty_narrative() -> dict:
    """Tum locale/field'lari None olarak dondurur (DeepSeek cagrisi hic yapilamadiginda kullanilir)."""
    return {locale: {field: None for field in NARRATIVE_FIELDS} for locale in LOCALES}


# ============================================================
# PROVENANCE / VERSIONING — yazma anindaki izlenebilirlik alanlari
# ============================================================

MODEL_PROVIDER = "deepseek"
MODEL_NAME = "deepseek-chat"
DATA_SOURCE = "yfinance"
ANALYSIS_VERSION = "index-analysis-v1"


def build_provenance_fields(
    prompt_version: str,
    data_as_of: Optional[datetime],
    generation_status: str,
    generation_error: Optional[str] = None,
) -> dict:
    """
    Supabase satirina eklenecek ortak izlenebilirlik alanlarini uretir.
    generation_status: "success" | "partial" | "failed"
    content_status: generation basariliysa (en az 1 locale/alan gectiyse) "published", aksi halde "draft".
    """
    content_status = "published" if generation_status in ("success", "partial") else "draft"
    return {
        "data_as_of": (data_as_of or datetime.now(dt_timezone.utc)).isoformat(),
        "published_at": datetime.now(dt_timezone.utc).isoformat(),
        "analysis_version": ANALYSIS_VERSION,
        "model_provider": MODEL_PROVIDER,
        "model_name": MODEL_NAME if generation_status != "failed" else None,
        "prompt_version": prompt_version,
        "data_source": DATA_SOURCE,
        "content_status": content_status,
        "generation_status": generation_status,
        "generation_error": generation_error,
    }


def sleep_between_calls(seconds: float = 1.0) -> None:
    """DeepSeek/yfinance rate limit'e karsi sembol basina kucuk bekleme."""
    time.sleep(seconds)
