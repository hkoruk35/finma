"""
AI Analysis API Router
Endpoints: analyze, stock-analysis, market-summary, parse-trade, audit-positions, chat
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from app.services.gemini_ai import (
    call_gemini,
    analyze_stock,
    analyze_market_summary,
    parse_trade_command,
    audit_positions,
    MARKET_ANALYST_PROMPT,
)
from app.services.market_data import (
    get_ticker_info,
    get_technical_analysis,
    get_market_regime,
    get_sector_performance,
)
from app.dependencies import get_current_user

router = APIRouter()


class AIRequest(BaseModel):
    prompt: str
    context: Optional[str] = None


class AIResponse(BaseModel):
    response: str
    model: str = "gemini-2.0-flash"


class ChatMessage(BaseModel):
    role: str  # "user" or "ai"
    content: str


class ChatRequest(BaseModel):
    message: str
    history: List[ChatMessage] = []


class PositionAuditRequest(BaseModel):
    positions: List[dict]


# ─── Public Endpoints (Free tier) ───

@router.post("/analyze", response_model=AIResponse)
async def analyze(request: AIRequest):
    """Genel piyasa/hisse analizi (Free: 5/gün, Gold: sınırsız)"""
    full_prompt = request.prompt
    if request.context:
        full_prompt = f"Bağlam: {request.context}\n\nSoru: {request.prompt}"

    response = await call_gemini(full_prompt)
    return AIResponse(response=response)


# ─── Gold Tier Endpoints ───

@router.get("/stock-analysis/{ticker}", response_model=AIResponse)
async def stock_analysis(ticker: str):
    """Kapsamlı AI hisse analizi (Gold üyelik)"""
    try:
        info = get_ticker_info(ticker.upper())
        technicals = get_technical_analysis(ticker.upper())

        if "error" in technicals:
            raise HTTPException(status_code=404, detail=f"Yeterli veri yok: {ticker}")

        response = await analyze_stock(ticker.upper(), technicals, info)
        return AIResponse(response=response)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analiz hatası: {str(e)}")


@router.get("/market-summary", response_model=AIResponse)
async def market_summary():
    """Günlük AI piyasa özeti"""
    try:
        regime = get_market_regime()
        sectors = get_sector_performance("1d")
        response = await analyze_market_summary(regime, sectors)
        return AIResponse(response=response)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Özet hatası: {str(e)}")


@router.post("/parse-trade", response_model=AIResponse)
async def parse_trade(request: AIRequest):
    """Doğal dil trade komutunu JSON'a çevir"""
    result = await parse_trade_command(request.prompt)
    if result:
        import json
        return AIResponse(response=json.dumps(result, ensure_ascii=False, indent=2))
    return AIResponse(response="Trade komutu anlaşılamadı. Lütfen tekrar deneyin.")


@router.post("/audit-positions", response_model=AIResponse)
async def audit(request: PositionAuditRequest):
    """Açık pozisyon risk denetimi"""
    if not request.positions:
        return AIResponse(response="Denetlenecek pozisyon bulunamadı.")

    response = await audit_positions(request.positions)
    return AIResponse(response=response)


@router.post("/chat", response_model=AIResponse)
async def chat(request: ChatRequest):
    """AI sohbet - geçmiş mesaj bağlamı ile"""
    # Build context from history
    history_text = ""
    if request.history:
        history_text = "Önceki konuşma:\n"
        for msg in request.history[-10:]:  # Son 10 mesaj
            role_label = "Kullanıcı" if msg.role == "user" else "AI"
            history_text += f"{role_label}: {msg.content}\n"
        history_text += "\n"

    full_prompt = f"{history_text}Kullanıcı: {request.message}"
    response = await call_gemini(full_prompt)

    # Append disclaimer
    if "yatırım tavsiyesi" not in response.lower():
        response += "\n\n⚠️ Bu bir yatırım tavsiyesi değildir. Tüm analizler bilgilendirme amaçlıdır."

    return AIResponse(response=response)
