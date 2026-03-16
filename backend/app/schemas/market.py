from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class MarketQuote(BaseModel):
    symbol: str
    name: Optional[str] = None
    price: float
    change: float
    change_pct: float
    volume: Optional[int] = None
    market_cap: Optional[float] = None
    high: Optional[float] = None
    low: Optional[float] = None
    open: Optional[float] = None
    prev_close: Optional[float] = None


class SignalCandidate(BaseModel):
    ticker: str
    score: float
    price: float
    action: str
    atr: Optional[float] = None
    rvol: Optional[float] = None
    rs_score: Optional[float] = None
    setup: Optional[str] = None
    trend_phase: Optional[str] = None
    entry_zone: str
    stop_loss: float
    target: float
    potential_pct: float
    sector: str
    market_cap: Optional[float] = None
    notes: List[str] = []


class SignalReport(BaseModel):
    timestamp: str
    market_regime: str
    sector_leaders: List[str]
    vix_level: float
    candidates: List[SignalCandidate]
