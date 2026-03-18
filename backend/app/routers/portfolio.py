"""
Portfolio API Router — Supabase PostgreSQL entegrasyonlu
End-points: summary, trades CRUD, settings, reset
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from app.dependencies import get_current_user
from app.database import TradesDB, PortfolioSettingsDB, UsersDB
import uuid
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


class TradeCreate(BaseModel):
    ticker: str
    direction: str  # LONG, SHORT
    type: str = "SWING"
    strategy: str = ""
    entry_price: float
    stop_loss: float
    target_price: float
    qty: int
    notes: Optional[str] = None


class TradeResponse(BaseModel):
    id: str
    ticker: str
    direction: str
    type: str
    strategy: str
    entry_price: float
    current_price: float
    stop_loss: float
    target_price: float
    qty: int
    status: str
    entry_date: str
    pnl: float
    pnl_pct: float
    notes: Optional[str] = None


class PortfolioSummary(BaseModel):
    net_liquidation: float
    cash_available: float
    margin_used: float
    gross_exposure: float
    current_24h_pnl: float
    last_7_days_pnl: float
    mtd_pnl: float
    ytd_pnl: float
    open_positions: int


class PortfolioSettings(BaseModel):
    initial_capital: float


@router.get("/summary", response_model=PortfolioSummary)
def get_portfolio_summary(current_user: dict = Depends(get_current_user)):
    """Portföy özetini hesapla ve getir"""
    user = UsersDB.get_by_username(current_user["username"])
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    
    user_id = user["id"]
    initial_capital = PortfolioSettingsDB.get_initial_capital(user_id)
    
    open_trades = TradesDB.get_all(user_id=user_id, status="OPEN")
    closed_trades = TradesDB.get_all(user_id=user_id, status="CLOSED")
    
    realized_pnl = sum(float(t.get("pnl", 0)) for t in closed_trades)
    open_pnl = sum(float(t.get("pnl", 0)) for t in open_trades)
    
    # Brüt pozisyon (açık olanların maliyeti)
    gross = sum(float(t.get("entry_price", 0)) * int(t.get("qty", 0)) for t in open_trades)
    
    # Net Likidite = Başlangıç + Gerçekleşen Kar/Zarar + Açık Kar/Zarar
    nav = initial_capital + realized_pnl + open_pnl
    
    # Kullanılabilir Nakit = Başlangıç + Gerçekleşen Kar/Zarar - Açıkların Maliyeti
    cash = initial_capital + realized_pnl - gross

    return PortfolioSummary(
        net_liquidation=round(nav, 2),
        cash_available=round(max(0, cash), 2),
        margin_used=round(gross * 0.5, 2),
        gross_exposure=round(gross, 2),
        current_24h_pnl=round(open_pnl, 2),
        last_7_days_pnl=round(realized_pnl, 2),
        mtd_pnl=0.0,
        ytd_pnl=0.0,
        open_positions=len(open_trades),
    )


@router.get("/settings", response_model=PortfolioSettings)
def get_portfolio_settings(current_user: dict = Depends(get_current_user)):
    """Portföy ayarlarını getir"""
    user = UsersDB.get_by_username(current_user["username"])
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    
    val = PortfolioSettingsDB.get_initial_capital(user["id"])
    return PortfolioSettings(initial_capital=val)


@router.post("/settings")
def update_portfolio_settings(settings: PortfolioSettings, current_user: dict = Depends(get_current_user)):
    """Başlangıç sermayesini güncelle"""
    user = UsersDB.get_by_username(current_user["username"])
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    
    PortfolioSettingsDB.set_initial_capital(user["id"], settings.initial_capital)
    return {"message": "Sermaye güncellendi", "initial_capital": settings.initial_capital}


@router.post("/reset")
def reset_portfolio(current_user: dict = Depends(get_current_user)):
    """Tüm işlemleri temizle ve portföyü sıfırla"""
    user = UsersDB.get_by_username(current_user["username"])
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    
    user_id = user["id"]
    open_trades = TradesDB.get_all(user_id=user_id, status="OPEN")
    
    # Tüm açık trade'leri kapat
    for t in open_trades:
        TradesDB.update(t["id"], {"status": "ARCHIVED", "notes": "Portföy sıfırlandı"})
        
    closed_trades = TradesDB.get_all(user_id=user_id, status="CLOSED")
    for t in closed_trades:
        TradesDB.update(t["id"], {"status": "ARCHIVED"})

    return {"message": "Portföy başarıyla sıfırlandı"}


@router.get("/trades", response_model=List[TradeResponse])
def get_trades(status: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """Trade listesini getir (Kullanıcıya özel)"""
    user = UsersDB.get_by_username(current_user["username"])
    if not user:
        return []
        
    trades = TradesDB.get_all(user_id=user["id"], status=status)
    result = []
    for t in trades:
        try:
            result.append(TradeResponse(
                id=str(t.get("id", "")),
                ticker=t.get("ticker", ""),
                direction=t.get("direction", "LONG"),
                type=t.get("type", "SWING"),
                strategy=t.get("strategy", ""),
                entry_price=float(t.get("entry_price", 0)),
                current_price=float(t.get("current_price", 0)),
                stop_loss=float(t.get("stop_loss", 0)),
                target_price=float(t.get("target_price", 0)),
                qty=int(t.get("qty", 0)),
                status=t.get("status", "OPEN"),
                entry_date=str(t.get("entry_date", "")),
                pnl=float(t.get("pnl", 0)),
                pnl_pct=float(t.get("pnl_pct", 0)),
                notes=t.get("notes"),
            ))
        except Exception as e:
            logger.warning(f"Trade parse hatası: {e}")
            continue
    return result


@router.post("/trades", response_model=TradeResponse)
def create_trade(trade: TradeCreate, current_user: dict = Depends(get_current_user)):
    """Yeni trade oluştur"""
    user = UsersDB.get_by_username(current_user["username"])
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")

    trade_data = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "ticker": trade.ticker.upper(),
        "direction": trade.direction.upper(),
        "type": trade.type,
        "strategy": trade.strategy,
        "entry_price": trade.entry_price,
        "current_price": trade.entry_price,
        "stop_loss": trade.stop_loss,
        "target_price": trade.target_price,
        "qty": trade.qty,
        "status": "OPEN",
        "entry_date": datetime.utcnow().strftime("%Y-%m-%d"),
        "pnl": 0.0,
        "pnl_pct": 0.0,
        "notes": trade.notes,
    }

    created = TradesDB.create(trade_data)
    logger.info(f"✅ Yeni trade oluşturuldu: {trade.ticker} {trade.direction}")

    return TradeResponse(
        id=str(created.get("id", trade_data["id"])),
        ticker=created.get("ticker", trade_data["ticker"]),
        direction=created.get("direction", trade_data["direction"]),
        type=created.get("type", trade_data["type"]),
        strategy=created.get("strategy", trade_data["strategy"]),
        entry_price=float(created.get("entry_price", trade_data["entry_price"])),
        current_price=float(created.get("current_price", trade_data["current_price"])),
        stop_loss=float(created.get("stop_loss", trade_data["stop_loss"])),
        target_price=float(created.get("target_price", trade_data["target_price"])),
        qty=int(created.get("qty", trade_data["qty"])),
        status=created.get("status", "OPEN"),
        entry_date=str(created.get("entry_date", trade_data["entry_date"])),
        pnl=float(created.get("pnl", 0)),
        pnl_pct=float(created.get("pnl_pct", 0)),
        notes=created.get("notes"),
    )


@router.delete("/trades/{trade_id}")
def close_trade(trade_id: str, exit_price: float, current_user: dict = Depends(get_current_user)):
    """Trade'i kapat"""
    trade = TradesDB.get_by_id(trade_id)
    if not trade:
        raise HTTPException(status_code=404, detail="Trade bulunamadı")

    entry = float(trade.get("entry_price", 0))
    qty = int(trade.get("qty", 0))
    direction = trade.get("direction", "LONG")

    pnl = (exit_price - entry) * qty
    if direction == "SHORT":
        pnl = -pnl
    pnl_pct = (pnl / (entry * qty) * 100) if (entry * qty) > 0 else 0

    updates = {
        "status": "CLOSED",
        "current_price": exit_price,
        "exit_price": exit_price,
        "exit_date": datetime.utcnow().strftime("%Y-%m-%d"),
        "pnl": round(pnl, 2),
        "pnl_pct": round(pnl_pct, 2),
    }

    updated = TradesDB.update(trade_id, updates)
    logger.info(f"✅ Trade kapatıldı: {trade.get('ticker')} PnL: ${pnl:.2f}")

    if updated:
        return {"message": "Trade kapatıldı", "pnl": round(pnl, 2), "pnl_pct": round(pnl_pct, 2)}
    return {"message": "Trade kapatıldı (memory)", "pnl": round(pnl, 2)}
