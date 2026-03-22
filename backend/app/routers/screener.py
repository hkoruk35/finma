"""Screener Router — Hisse Tarama"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timedelta
from app.dependencies import get_current_user
from app.database import get_supabase
import logging, uuid, yfinance as yf, pandas as pd

logger = logging.getLogger(__name__)
router = APIRouter()

SCAN_LIMITS = {"free": 2, "pro": 10, "admin": 999}
_screener_memory: List[dict] = []
SCREENER_UNIVERSE = [
    "AAPL","MSFT","NVDA","GOOGL","AMZN","META","TSLA","AMD","AVGO","ORCL",
    "CRM","ADBE","INTC","CSCO","IBM","TXN","QCOM","CRWD","PANW","PLTR",
    "JPM","BAC","GS","MS","WFC","C","V","MA","AXP","BLK",
    "UNH","LLY","JNJ","PFE","ABBV","MRK","TMO","ABT","DHR","MDT",
    "XOM","CVX","COP","SLB","EOG","VLO","MPC","OXY","PSX","HAL",
    "GE","CAT","DE","LMT","RTX","NOC","BA","HON","MMM","UPS",
    "HD","TGT","WMT","COST","LOW","NKE","SBUX","MCD","CMG","BKNG",
    "SMCI","DELL","HPE","NFLX","DIS","CMCSA","CHTR","COIN","HOOD","SOFI",
]

class ScreenerFilter(BaseModel):
    min_price: Optional[float] = 5.0
    max_price: Optional[float] = 1000.0
    min_rvol: Optional[float] = 1.0
    min_rsi: Optional[float] = 30.0
    max_rsi: Optional[float] = 75.0
    ema_trend: Optional[str] = "any"
    min_score: Optional[float] = 40.0
    limit: Optional[int] = 20

def calculate_score(df: pd.DataFrame) -> float:
    try:
        close = df["Close"].squeeze()
        volume = df["Volume"].squeeze()
        if len(close) < 50: return 0.0
        ema20 = float(close.ewm(span=20).mean().iloc[-1])
        ema50 = float(close.ewm(span=50).mean().iloc[-1])
        price = float(close.iloc[-1])
        trend = 80.0 if price > ema20 > ema50 else (55.0 if price > ema20 else 25.0)
        recent_vol = float(volume.tail(5).mean())
        baseline_vol = float(volume.tail(30).mean())
        rvol = recent_vol / baseline_vol if baseline_vol > 0 else 1.0
        vol_score = min(100.0, rvol * 50.0)
        delta = close.diff()
        gain = delta.where(delta > 0, 0).rolling(14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(14).mean()
        rs = gain / loss.replace(0, 1e-9)
        rsi_val = float((100 - (100 / (1 + rs))).iloc[-1])
        momentum = max(0, 100 - abs(rsi_val - 55) * 2)
        ret5 = float((price / float(close.iloc[-6]) - 1) * 100) if len(close) >= 6 else 0
        context = min(100.0, max(0.0, ret5 * 5 + 50))
        return round(trend * 0.30 + vol_score * 0.25 + momentum * 0.32 + context * 0.13, 2)
    except Exception: return 0.0

def get_weekly_scan_count(user_id: str) -> int:
    sb = get_supabase()
    week_ago = (datetime.utcnow() - timedelta(days=7)).isoformat()
    if sb:
        try:
            result = sb.table("screener_results").select("id", count="exact").eq("user_id", user_id).gte("created_at", week_ago).execute()
            return result.count or 0
        except Exception: pass
    cutoff = datetime.utcnow() - timedelta(days=7)
    return sum(1 for s in _screener_memory if s.get("user_id") == user_id and datetime.fromisoformat(s.get("created_at", "2000-01-01")) > cutoff)

@router.get("/credits")
async def get_credits(current_user: dict = Depends(get_current_user)):
    tier = current_user.get("subscription_tier", "free")
    limit = SCAN_LIMITS.get(tier, 2)
    used = get_weekly_scan_count(current_user.get("id", ""))
    return {"limit": limit, "used": used, "remaining": max(0, limit - used), "tier": tier}

@router.post("/run")
async def run_screener(filters: ScreenerFilter, current_user: dict = Depends(get_current_user)):
    user_id = current_user.get("id", "")
    tier = current_user.get("subscription_tier", "free")
    if tier != "admin":
        limit = SCAN_LIMITS.get(tier, 2)
        used = get_weekly_scan_count(user_id)
        if used >= limit:
            raise HTTPException(status_code=403, detail=f"Haftalik tarama limitinize ulastiniz ({limit}).")
    results = []
    try:
        raw = yf.download(SCREENER_UNIVERSE, period="60d", interval="1d", group_by="ticker", auto_adjust=True, progress=False, threads=True)
        for ticker in SCREENER_UNIVERSE:
            try:
                df = raw[ticker].dropna() if len(SCREENER_UNIVERSE) > 1 else raw.dropna()
                if df.empty or len(df) < 20: continue
                close = df["Close"].squeeze(); volume = df["Volume"].squeeze()
                price = float(close.iloc[-1])
                if not (filters.min_price <= price <= filters.max_price): continue
                recent_vol = float(volume.tail(5).mean()); baseline_vol = float(volume.tail(30).mean())
                rvol = recent_vol / baseline_vol if baseline_vol > 0 else 1.0
                if rvol < filters.min_rvol: continue
                delta = close.diff(); gain = delta.where(delta > 0, 0).rolling(14).mean(); loss = (-delta.where(delta < 0, 0)).rolling(14).mean()
                rs = gain / loss.replace(0, 1e-9); rsi_val = float((100 - (100 / (1 + rs))).iloc[-1])
                if not (filters.min_rsi <= rsi_val <= filters.max_rsi): continue
                ema20 = float(close.ewm(span=20).mean().iloc[-1]); ema50 = float(close.ewm(span=50).mean().iloc[-1])
                if filters.ema_trend == "above" and not (price > ema20): continue
                score = calculate_score(df)
                if score < filters.min_score: continue
                signal = "STRONG BUY" if score >= 90 else ("BUY" if score >= 75 else ("WATCH" if score >= 60 else "IGNORE"))
                change_pct = round(float((price / float(close.iloc[-2]) - 1) * 100) if len(close) >= 2 else 0, 2)
                results.append({"ticker": ticker, "company_name": ticker, "sector": "Technology", "price": round(price, 2), "score": score, "signal": signal, "rsi": round(rsi_val, 1), "rvol": round(rvol, 2), "ema_trend": "above" if price > ema20 > ema50 else "below", "change_pct": change_pct})
            except Exception: continue
        results.sort(key=lambda x: x["score"], reverse=True); results = results[:filters.limit]
    except Exception as e:
        logger.error(f"Screener error: {e}"); raise HTTPException(status_code=500, detail="Tarama hatasi")
    scan_record = {"id": str(uuid.uuid4()), "user_id": user_id, "filter_params": filters.dict(), "results": results, "result_count": len(results), "created_at": datetime.utcnow().isoformat()}
    sb = get_supabase()
    if sb:
        try: sb.table("screener_results").insert({k: v for k, v in scan_record.items() if k != "id"}).execute()
        except Exception as e: logger.error(f"Screener save: {e}")
    else: _screener_memory.append(scan_record)
    return {"results": results, "count": len(results), "scan_id": scan_record["id"]}

@router.get("/history")
async def get_history(limit: int = 10, current_user: dict = Depends(get_current_user)):
    user_id = current_user.get("id", "")
    sb = get_supabase()
    if sb:
        try:
            result = sb.table("screener_results").select("id,result_count,created_at,filter_params").eq("user_id", user_id).order("created_at", desc=True).limit(limit).execute()
            return {"history": result.data or []}
        except Exception as e: logger.error(f"History: {e}")
    return {"history": [{k: v for k, v in s.items() if k != "results"} for s in sorted([s for s in _screener_memory if s.get("user_id") == user_id], key=lambda x: x.get("created_at", ""), reverse=True)[:limit]]}
