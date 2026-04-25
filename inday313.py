import asyncio
import logging
import time
import aiohttp
import os
import html
import json


# ✅ Gemini API - Compatible with both old and new packages
try:
    # Try new package first (google-genai)
    from google import genai as genai_new
    GEMINI_NEW_API = True
except ImportError:
    # Fallback to old package (google.generativeai) 
    import google.generativeai as genai_old
    GEMINI_NEW_API = False
    import warnings
    warnings.filterwarnings('ignore', category=FutureWarning, module='google.generativeai')

import pandas as pd
import numpy as np
import yfinance as yf

from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional
from zoneinfo import ZoneInfo

# --- Teknik İndikatörler (Master Plan v3.0 Gereksinimleri) ---
from ta.trend import EMAIndicator, ADXIndicator
from ta.volatility import AverageTrueRange, BollingerBands  # Bollinger eklendi (Squeeze tespiti için)
from ta.momentum import RSIIndicator
from ta.volume import ChaikinMoneyFlowIndicator


# =====================================================================
# 🦅 KARTAL YUVASI v3.3 (SENTIMENT+AI) – INSTITUTIONAL SWING ENGINE
#
# Amaç:
# - Smart Money (Akıllı Para) ayak izlerini takip etmek.
# - Family305a + Manual havuzlardan "Kurumsal Birikim" (Accumulation)
#   ve "Ayrışma" (Decoupling) gösteren hisseleri seçmek.
#
# Zaman Dilimi Disiplini (Institutional Hierarchy):
# - 1D  → Yapısal Bağlam & Trend Fazı (Accumulation / Expansion / Exhaustion)
# - 1H  → Kurumsal Değer Bölgesi (Institutional Value Zone & VWAP Logic)
# - 15M → Mikro Yapı Kırılımı (Micro Structure Break - Entry Timing)
#
# Felsefe (Price vs Intent):
# - Sadece yükselen değil, "Hazırlanan" hisseyi bul.
# - Fiyat düşerken Hacim/Range analizi ile "Absorption" (Emilim) tespiti.
# - Relative Strength (RS) ile Endeksten pozitif ayrışanları yakala.
# - Normalized ATR (NATR) ile volatiliteyi kurumsal filtreye sok.
#
# Çıktı:
# - Institutional Action (Absorption, Aggressive Buy)
# - Setup Type (Dip Reversal, Power Trend, Pullback)
# - Invalidation Level (Yapısal İptal Seviyesi)
# - Entry Zone (Kurumsal Maliyet Bölgesi)
#
# Notlar:
# ❌ Basit indikatör kesişimleri (Retail Logic) YOK.
# ❌ Intraday scalp YOK.
# ✅ Hacim/Fiyat analizi (VPA) ve Kurumsal "Footprint" odaklı.
# =====================================================================



# ============================================================
# 📊 SENTIMENT ANALYSIS MODULE (Multi-Source Intelligence)
# ============================================================

from datetime import datetime, timedelta
from typing import Dict, List, Optional
import json


# ============================================================
# 📰 FREE API KEYS (Replace with your own)
# ============================================================

NEWS_API_KEY = "YOUR_NEWSAPI_KEY"  # https://newsapi.org/register (100 req/day free)
FINNHUB_API_KEY = "YOUR_FINNHUB_KEY"  # https://finnhub.io/register (60 calls/min free)
ALPHA_VANTAGE_KEY = "YOUR_ALPHAVANTAGE_KEY"  # https://www.alphavantage.co/support/#api-key (500 req/day free)


# ============================================================
# 1️⃣ NEWS SENTIMENT (NewsAPI + Finnhub)
# ============================================================

async def fetch_news_sentiment(session: aiohttp.ClientSession, ticker: str) -> Dict:
    """
    Fetch recent news and analyze sentiment
    Sources: NewsAPI (headlines) + Finnhub (company news)
    """
    try:
        news_data = {
            "news_count": 0,
            "sentiment": "NEUTRAL",
            "sentiment_score": 0.0,  # -1 to +1
            "headlines": []
        }
        
        # NewsAPI - Last 30 days news
        last_30_days = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
        newsapi_url = f"https://newsapi.org/v2/everything?q={ticker}&from={last_30_days}&sortBy=publishedAt&apiKey={NEWS_API_KEY}&pageSize=5"
        
        try:
            async with session.get(newsapi_url, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    articles = data.get('articles', [])
                    
                    news_data["news_count"] = len(articles)
                    news_data["headlines"] = [
                        {
                            "title": art.get('title', ''),
                            "source": art.get('source', {}).get('name', 'Unknown'),
                            "published": art.get('publishedAt', '')
                        }
                        for art in articles[:3]
                    ]
                    
                    # Simple keyword-based sentiment (can be improved with NLP)
                    positive_keywords = ['surge', 'profit', 'beat', 'upgrade', 'bullish', 'growth', 'acquisition', 'innovation']
                    negative_keywords = ['loss', 'miss', 'downgrade', 'bearish', 'lawsuit', 'scandal', 'decline', 'layoff']
                    
                    pos_score = 0
                    neg_score = 0
                    
                    for art in articles:
                        title_lower = art.get('title', '').lower()
                        pos_score += sum(1 for kw in positive_keywords if kw in title_lower)
                        neg_score += sum(1 for kw in negative_keywords if kw in title_lower)
                    
                    if pos_score > neg_score:
                        news_data["sentiment"] = "POSITIVE"
                        news_data["sentiment_score"] = min(1.0, (pos_score - neg_score) / 5.0)
                    elif neg_score > pos_score:
                        news_data["sentiment"] = "NEGATIVE"
                        news_data["sentiment_score"] = max(-1.0, (pos_score - neg_score) / 5.0)
                    
        except Exception as e:
            pass  # Silent fail
        
        return news_data
        
    except Exception:
        return {
            "news_count": 0,
            "sentiment": "NEUTRAL",
            "sentiment_score": 0.0,
            "headlines": []
        }


# ============================================================
# 2️⃣ INSIDER TRADING (SEC Edgar via Finnhub)
# ============================================================

async def fetch_insider_activity(session: aiohttp.ClientSession, ticker: str) -> Dict:
    """
    Fetch insider trading activity (last 30 days)
    Free API: Finnhub
    """
    try:
        insider_data = {
            "insider_buys": 0,
            "insider_sells": 0,
            "net_sentiment": "NEUTRAL",
            "sentiment_score": 0.0,  # -1 to +1
            "recent_transactions": []
        }
        
        # Finnhub Insider Transactions
        from_date = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
        to_date = datetime.now().strftime('%Y-%m-%d')
        
        url = f"https://finnhub.io/api/v1/stock/insider-transactions?symbol={ticker}&from={from_date}&to={to_date}&token={FINNHUB_API_KEY}"
        
        async with session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as resp:
            if resp.status == 200:
                data = await resp.json()
                transactions = data.get('data', [])
                
                for txn in transactions[:10]:  # Last 10 transactions
                    change = txn.get('change', 0)
                    
                    if change > 0:
                        insider_data["insider_buys"] += 1
                    elif change < 0:
                        insider_data["insider_sells"] += 1
                    
                    insider_data["recent_transactions"].append({
                        "name": txn.get('name', 'Unknown'),
                        "change": change,
                        "filing_date": txn.get('filingDate', '')
                    })
                
                # Calculate net sentiment
                net = insider_data["insider_buys"] - insider_data["insider_sells"]
                
                if net > 2:
                    insider_data["net_sentiment"] = "BULLISH"
                    insider_data["sentiment_score"] = min(1.0, net / 5.0)
                elif net < -2:
                    insider_data["net_sentiment"] = "BEARISH"
                    insider_data["sentiment_score"] = max(-1.0, net / 5.0)
        
        return insider_data
        
    except Exception:
        return {
            "insider_buys": 0,
            "insider_sells": 0,
            "net_sentiment": "NEUTRAL",
            "sentiment_score": 0.0,
            "recent_transactions": []
        }


# ============================================================
# 3️⃣ SOCIAL SENTIMENT (Reddit WallStreetBets - Pushshift API)
# ============================================================

async def fetch_social_sentiment(session: aiohttp.ClientSession, ticker: str) -> Dict:
    """
    Fetch social media sentiment from Reddit WallStreetBets
    Free API: Reddit API (no key needed for read-only)
    """
    try:
        social_data = {
            "mentions": 0,
            "sentiment": "NEUTRAL",
            "sentiment_score": 0.0,
            "trending": False
        }
        
        # Reddit search (last 24h)
        reddit_url = f"https://www.reddit.com/r/wallstreetbets/search.json?q={ticker}&restrict_sr=1&sort=new&limit=50"
        headers = {'User-Agent': 'Mozilla/5.0'}
        
        async with session.get(reddit_url, headers=headers, timeout=aiohttp.ClientTimeout(total=10)) as resp:
            if resp.status == 200:
                data = await resp.json()
                posts = data.get('data', {}).get('children', [])
                
                social_data["mentions"] = len(posts)
                
                # Simple sentiment from titles
                bullish_words = ['moon', 'buy', 'calls', 'yolo', 'rocket', '🚀', 'bullish', 'squeeze']
                bearish_words = ['puts', 'short', 'crash', 'dump', 'bearish', 'sell']
                
                bull_count = 0
                bear_count = 0
                
                for post in posts:
                    title = post.get('data', {}).get('title', '').lower()
                    bull_count += sum(1 for w in bullish_words if w in title)
                    bear_count += sum(1 for w in bearish_words if w in title)
                
                if bull_count > bear_count:
                    social_data["sentiment"] = "BULLISH"
                    social_data["sentiment_score"] = min(1.0, (bull_count - bear_count) / 10.0)
                elif bear_count > bull_count:
                    social_data["sentiment"] = "BEARISH"
                    social_data["sentiment_score"] = max(-1.0, (bull_count - bear_count) / 10.0)
                
                # Trending if > 10 mentions in 24h
                social_data["trending"] = social_data["mentions"] > 10
        
        return social_data
        
    except Exception:
        return {
            "mentions": 0,
            "sentiment": "NEUTRAL",
            "sentiment_score": 0.0,
            "trending": False
        }


# ============================================================
# 4️⃣ ANALYST RATINGS (Finnhub Recommendations)
# ============================================================

async def fetch_analyst_consensus(session: aiohttp.ClientSession, ticker: str) -> Dict:
    """
    Fetch analyst recommendations and price targets
    Free API: Finnhub
    """
    try:
        analyst_data = {
            "consensus": "HOLD",
            "buy_ratings": 0,
            "hold_ratings": 0,
            "sell_ratings": 0,
            "sentiment_score": 0.0,
            "price_target": None
        }
        
        # Finnhub Recommendation Trends
        url = f"https://finnhub.io/api/v1/stock/recommendation?symbol={ticker}&token={FINNHUB_API_KEY}"
        
        async with session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as resp:
            if resp.status == 200:
                data = await resp.json()
                
                if data and len(data) > 0:
                    latest = data[0]  # Most recent month
                    
                    analyst_data["buy_ratings"] = latest.get('buy', 0) + latest.get('strongBuy', 0)
                    analyst_data["hold_ratings"] = latest.get('hold', 0)
                    analyst_data["sell_ratings"] = latest.get('sell', 0) + latest.get('strongSell', 0)
                    
                    # Determine consensus
                    if analyst_data["buy_ratings"] > analyst_data["hold_ratings"] + analyst_data["sell_ratings"]:
                        analyst_data["consensus"] = "BUY"
                        analyst_data["sentiment_score"] = 0.8
                    elif analyst_data["sell_ratings"] > analyst_data["buy_ratings"]:
                        analyst_data["consensus"] = "SELL"
                        analyst_data["sentiment_score"] = -0.8
        
        # Price Target
        target_url = f"https://finnhub.io/api/v1/stock/price-target?symbol={ticker}&token={FINNHUB_API_KEY}"
        
        async with session.get(target_url, timeout=aiohttp.ClientTimeout(total=10)) as resp:
            if resp.status == 200:
                target_data = await resp.json()
                analyst_data["price_target"] = target_data.get('targetMean')
        
        return analyst_data
        
    except Exception:
        return {
            "consensus": "HOLD",
            "buy_ratings": 0,
            "hold_ratings": 0,
            "sell_ratings": 0,
            "sentiment_score": 0.0,
            "price_target": None
        }


# ============================================================
# 🎯 MASTER SENTIMENT AGGREGATOR
# ============================================================

async def enrich_with_sentiment(candidate: Dict) -> Dict:
    """
    ⚠️ CRITICAL: NO ELIMINATION - Just add sentiment data!
    
    Adds comprehensive sentiment analysis to technical candidate
    Returns: Enhanced candidate with sentiment fields
    """
    ticker = candidate['symbol']
    
    async with aiohttp.ClientSession() as session:
        # Parallel fetch all sentiment sources
        news_data, insider_data, social_data, analyst_data = await asyncio.gather(
            fetch_news_sentiment(session, ticker),
            fetch_insider_activity(session, ticker),
            fetch_social_sentiment(session, ticker),
            fetch_analyst_consensus(session, ticker),
            return_exceptions=True
        )
        
        # Handle exceptions
        if isinstance(news_data, Exception):
            news_data = {"sentiment_score": 0.0, "sentiment": "NEUTRAL", "news_count": 0, "headlines": []}
        if isinstance(insider_data, Exception):
            insider_data = {"sentiment_score": 0.0, "net_sentiment": "NEUTRAL", "insider_buys": 0, "insider_sells": 0}
        if isinstance(social_data, Exception):
            social_data = {"sentiment_score": 0.0, "sentiment": "NEUTRAL", "mentions": 0, "trending": False}
        if isinstance(analyst_data, Exception):
            analyst_data = {"sentiment_score": 0.0, "consensus": "HOLD", "price_target": None}
    
    # Calculate composite sentiment score (weighted average)
    composite_score = (
        news_data["sentiment_score"] * 0.35 +      # News: 35%
        insider_data["sentiment_score"] * 0.30 +   # Insider: 30%
        social_data["sentiment_score"] * 0.15 +    # Social: 15%
        analyst_data["sentiment_score"] * 0.20     # Analyst: 20%
    )
    
    # Add sentiment data to candidate (NO ELIMINATION!)
    candidate['sentiment'] = {
        "composite_score": round(composite_score, 2),  # -1 to +1
        "composite_rating": _get_sentiment_rating(composite_score),
        
        "news": {
            "score": news_data["sentiment_score"],
            "sentiment": news_data["sentiment"],
            "count": news_data["news_count"],
            "headlines": news_data["headlines"]
        },
        
        "insider": {
            "score": insider_data["sentiment_score"],
            "sentiment": insider_data["net_sentiment"],
            "buys": insider_data["insider_buys"],
            "sells": insider_data["insider_sells"]
        },
        
        "social": {
            "score": social_data["sentiment_score"],
            "sentiment": social_data["sentiment"],
            "mentions": social_data["mentions"],
            "trending": social_data["trending"]
        },
        
        "analyst": {
            "score": analyst_data["sentiment_score"],
            "consensus": analyst_data["consensus"],
            "buy_ratings": analyst_data["buy_ratings"],
            "price_target": analyst_data["price_target"]
        }
    }
    
    return candidate


def _get_sentiment_rating(score: float) -> str:
    """Convert sentiment score to human-readable rating"""
    if score > 0.5:
        return "VERY POSITIVE"
    elif score > 0.2:
        return "POSITIVE"
    elif score > -0.2:
        return "NEUTRAL"
    elif score > -0.5:
        return "NEGATIVE"
    else:
        return "VERY NEGATIVE"


# ============================================================
# 📊 BATCH ENRICHMENT (For multiple candidates)
# ============================================================

async def enrich_candidates_batch(candidates: List[Dict], max_concurrent: int = 5) -> List[Dict]:
    """
    Enrich multiple candidates with sentiment data
    Rate-limited to avoid API throttling
    """
    semaphore = asyncio.Semaphore(max_concurrent)
    
    async def enrich_with_limit(candidate):
        async with semaphore:
            try:
                return await enrich_with_sentiment(candidate)
            except Exception as e:
                print(f"   ⚠️ Sentiment fetch failed for {candidate['symbol']}: {e}")
                return candidate  # Hata olsa bile adayı geri döndür (sentimentsiz)
    
    print(f"\n📊 Enriching {len(candidates)} candidates with sentiment data...")
    
    tasks = [enrich_with_limit(c) for c in candidates]
    # Hata yönetimi içeride yapıldığı için burada try-except'e gerek yok
    enriched = await asyncio.gather(*tasks)
    
    print(f"✅ Sentiment enrichment complete!\n")
    return enriched


# ============================================================
# 🤖 AI FINAL SELECTOR (Catalyst-Driven Selection)
# ============================================================

async def ai_final_selection(
    enriched_candidates: List[Dict],
    gemini_client,
    top_n: int = 20
) -> List[Dict]:
    """
    AŞAMA 3: AI Final Selection - GEMINI 2.0 ONLY
    
    Input: Teknik + Sentiment verileriyle zenginleştirilmiş adaylar
    Output: En kısa vadede en yüksek kazançlı swing trade setup'ları (top N)
    """
    
    print(f"\n🤖 AI FINAL SELECTION: Analyzing {len(enriched_candidates)} enriched candidates...")
    print(f"   Goal: Select Top {top_n} for highest short-term gain potential\n")
    
    # 1. Hazırlık: Aday özetleri
    candidate_summaries = []
    
    for idx, c in enumerate(enriched_candidates):
        # Haber başlıklarını derle
        news_headlines = []
        if 'sentiment' in c and 'news' in c['sentiment']:
            headlines = c['sentiment']['news'].get('headlines', [])
            if headlines:
                news_headlines = [f"{h.get('title', '')} ({h.get('published', '')[:10]})" for h in headlines[:3]]
        
        # Sektör Performansı (Global Context'ten)
        sec = c.get('sector', 'Unknown')
        sec_perf = SECTOR_CONTEXT.get(sec, 0.0) if 'SECTOR_CONTEXT' in globals() else 0.0
        
        summary = {
            "ticker": c['symbol'],
            "price": c['price'],
            "sector": sec,
            "sector_performance_5d": f"{sec_perf:.2f}%",
            "technical_score": c['score'],
            "setup": c.get('setup_type', 'NONE'),
            "trend": c.get('trend_phase', 'UNKNOWN'),
            "sentiment_score": c['sentiment']['composite_score'],
            "news_headlines": news_headlines,
            "calculated_entry_zone": c.get('entry_zone', 'N/A'),
            "calculated_target": c.get('target', 0),
            "calculated_stop_loss": c.get('stop_loss', 0),
        }
        candidate_summaries.append(summary)
    
    # 2. Gemini Prompt Oluşturma (TÜRKÇE)
    gemini_prompt = f"""
ROLE: Senior Quantitative Analyst & Swing Trader (Uzman Borsa Analisti)
MISSION: Aday hisseleri analiz et ve en iyi {top_n} fırsatı seç.
LANGUAGE: Yanıtların (reasoning dahil) TAMAMI TÜRKÇE olmalı.

OBJECTIVE:
En kısa sürede en yüksek getiri potansiyelini (1-7 gün) hedefle.
Teknik destek/direnç noktalarını dikkate alarak Giriş (Entry), Stop (SL) ve Hedef (TP) belirle.

INPUT DATA (Adaylar):
{json.dumps(candidate_summaries, indent=2)}

CRITERIA & LOGIC:
1. SECTOR ANALYSIS (Sektör Analizi):
   - ABD Borsası sektörel durumuna bak (verilen 'sector_performance_5d' verisi).
   - YÜKSELEN sektörlerdeki hisselere öncelik ver (Positive Momentum).
   - DÜŞEN sektörlerdeki hisseler için reasoning kısmına "Düşen Sektör Uyarısı" ekle.

2. TECHNICAL & S/R LEVELS (Teknik ve Destek/Direnç):
   - Verilen "calculated_" değerleri referans al, ancak grafik formasyonuna göre (Breakout, Pullback) optimize et.
   - Entry Range: Destek bölgesine yakın alım aralığı ver.

3. CATALYST (Haber/Katalizör): Son 30 günlük haberlerde "Earnings Beat", "Contract", "FDA Approval" gibi pozitif sinyal ara.

OUTPUT FORMAT (JSON):
tek bir "selections" listesi döndür ({top_n} adet).
Her obje şunları içermeli:
- "ticker": Sembol
- "rank": 1'den {top_n}'e sıralama
- "confidence": 1-10 arası güven skoru
- "reasoning": Neden seçildi? (Türkçe, kısa, net. Haber ve Sektörden bahset).
- "setup_type": Formasyon tipi (Örn: "Earnings Breakout", "Bull Flag").
- "entry_range": Önerilen giriş aralığı (Örn: "150.50 - 152.00").
- "stop_loss": Stop seviyesi.
- "take_profit": Kar al seviyesi.
- "hold_period": Tahmini vade (Örn: "2-5 Gün").

Example:
{{
  "selections": [
    {{
        "ticker": "NVDA",
        "rank": 1,
        "confidence": 9,
        "reasoning": "Teknoloji sektörü güçlü (+%3.5). Bilanço beklentisiyle ATH kırılımı yaptı. Haber akışı pozitif.",
        "setup_type": "ATH Breakout",
        "entry_range": "145.00 - 146.50",
        "stop_loss": 142.00,
        "take_profit": 155.00,
        "hold_period": "3-7 Gün"
    }}
  ]
}}

RESPOND ONLY WITH VALID JSON. NO MARKDOWN.
"""
    
    print("   🚀 Sending data to Gemini 2.0...")
    
    try:
        response_text = ""
        
        # Gemini API Call
        if GEMINI_NEW_API and gemini_client:
             response = await asyncio.to_thread(
                gemini_client.models.generate_content,
                model="gemini-2.0-flash", # Or pro if available
                contents=gemini_prompt
            )
             response_text = response.text
        elif not GEMINI_NEW_API and gemini_client: # Old lib logic placeholder if compatible
             model = genai_old.GenerativeModel('gemini-pro') # Fallback to pro if 2.0 not available in old lib
             response = await asyncio.to_thread(model.generate_content, gemini_prompt)
             response_text = response.text
        else:
             print("   ⚠️ Gemini Client not initialized.")
             return enriched_candidates[:top_n]

        # Clean JSON
        cleaned_text = response_text.replace("```json", "").replace("```", "").strip()
        
        try:
            data = json.loads(cleaned_text)
            selections = data.get("selections", [])
            
            final_selections = []
            
            # Map AI results back to full candidate objects
            for sel in selections:
                ticker = sel.get('ticker')
                # Find original candidate
                orig = next((c for c in enriched_candidates if c['symbol'] == ticker), None)
                if orig:
                    # Enrich with AI insights
                    orig['ai_validation'] = {
                        "approved": True,
                        "confidence": sel.get('confidence', 0),
                        "key_strength": sel.get('reasoning', ''),
                        "setup_override": sel.get('setup_type', ''),
                        "hold_period": sel.get('hold_period', 'Unknown'),
                        "ai_entry": sel.get('entry_range', str(sel.get('entry_zone', 'N/A'))),
                        "ai_sl": sel.get('stop_loss', 0),
                        "ai_tp": sel.get('take_profit', 0),
                        "rank": sel.get('rank', 99)
                    }
                    final_selections.append(orig)
            
            # Sort by rank
            final_selections.sort(key=lambda x: x['ai_validation']['rank'])
            
            print(f"   ✅ Gemini selected {len(final_selections)} candidates.")
            return final_selections

        except json.JSONDecodeError:
            print(f"   ❌ Gemini JSON Parse Error. Response: {cleaned_text[:100]}...")
            return enriched_candidates[:top_n] # Fallback
            
    except Exception as e:
        print(f"   ❌ Gemini API Error: {e}")
        return enriched_candidates[:top_n] # Fallback

def generate_ai_report(ai_selections: List[Dict]) -> str:
    """
    AI tarafından seçilen adaylar için Türkçe Telegram raporu oluşturur.
    Format: HİSSE + AI GEREKÇESİ + İŞLEM KURULUMU
    """
    if not ai_selections:
        return "🤖 <b>AI NİHAİ SEÇİM</b>\n\n⚠️ Yapay zeka doğrulamasından geçen aday olmadı."
    
    # Başlık Bölümü
    report = ["🤖 <b>YAPAY ZEKA (AI) SWING FIRSATLARI</b>"]
    report.append(f"📅 {datetime.now().strftime('%d/%m %H:%M')}\n")
    report.append(f"🎯 <b>Hedef: Maksimum Kısa Vadeli Getiri Potansiyeli</b>\n")
    
    # Adayları Listeleme
    for idx, c in enumerate(ai_selections[:20], 1):
        ai_val = c['ai_validation']
        sent = c['sentiment']
        
        # İngilizce gelen bazı terimleri anlık Türkçeleştirme (Opsiyonel ama şık durur)
        rating_tr = sent['composite_rating'].replace("POSITIVE", "POZİTİF").replace("NEGATIVE", "NEGATİF").replace("NEUTRAL", "NÖTR")
        hold_tr = str(ai_val['hold_period']).replace("days", "gün").replace("weeks", "hafta")

        block = (
            f"{idx}. <b>{c['symbol']}</b> | Güven Skoru: {ai_val['confidence']}/10\n"
            f"   💰 Fiyat: ${c['price']} | Puan: {c['score']}\n"
            f"   🎯 Katalizör: {ai_val['key_strength']}\n"
            f"   📊 Algı: {rating_tr} ({sent['composite_score']:+.2f})\n"
            f"   🟢 Giriş: {c.get('entry_zone', 'N/A')}\n"
            f"   🛑 Stop: ${c.get('stop_loss', 0)} | 🎯 Hedef: ${c.get('target', 0)}\n"
            f"   ⏱️ Vade: {hold_tr}\n"
        )
        
        if ai_val.get('key_risk'):
            block += f"   ⚠️ Risk: {ai_val.get('key_risk')}\n"
        
        report.append(block)
    
    report.append("\n👉 <i>Yapay Zeka Seçimi: Teknik + Algı + Haber Analizi</i>")
    
    return "\n".join(report)

# ============================================================
# 📊 REAL-TIME DATA VALIDATION (Yahoo Finance)
# ============================================================

def get_realtime_price_and_volume(ticker: str) -> dict:
    """
    Get daily close data for SWING TRADE analysis
    Swing trade uses daily closes, not intraday ticks
    Returns: {price, volume, volume_avg_20d, daily_change, trend}
    """
    try:
        import yfinance as yf
        stock = yf.Ticker(ticker)
        
        # Get daily data (not 5-minute!) - Swing trade uses DAILY
        daily = stock.history(period="30d", interval="1d")
        if daily.empty or len(daily) < 5:
            return None
        
        # Use LAST CLOSE (most recent daily close)
        current_price = daily['Close'].iloc[-1]
        current_volume = daily['Volume'].iloc[-1]
        
        # 20-day average volume - swing111 uyumu: Bugünün eksik mumunu hesaba katma
        volume_avg_20d = daily['Volume'].iloc[-21:-1].mean() if len(daily) >= 21 else daily['Volume'].iloc[:-1].mean()
        
        # Daily change (today vs yesterday CLOSE)
        if len(daily) >= 2:
            prev_close = daily['Close'].iloc[-2]
            daily_change = ((current_price - prev_close) / prev_close) * 100
        else:
            daily_change = 0
        
        # 5-day trend direction (swing trade timeframe)
        if len(daily) >= 5:
            price_5d_ago = daily['Close'].iloc[-5]
            trend = "UP" if current_price > price_5d_ago else "DOWN"
            trend_strength = ((current_price - price_5d_ago) / price_5d_ago) * 100
        else:
            trend = "NEUTRAL"
            trend_strength = 0
        
        return {
            'price': round(float(current_price), 2),
            'volume': int(current_volume),
            'volume_avg_20d': int(volume_avg_20d),
            'volume_ratio': round(float(current_volume / volume_avg_20d), 2) if volume_avg_20d > 0 else 0,
            'daily_change_pct': round(float(daily_change), 2),
            'trend': trend,
            'trend_strength_pct': round(float(trend_strength), 2),
            'data_type': 'DAILY_CLOSE'  # Swing trade uses daily data
        }
        
    except Exception as e:
        logging.warning(f"Daily data failed for {ticker}: {e}")
        return None


def validate_entry_zone(current_price: float, entry_zone: str) -> dict:
    """
    Check if current price is within swing trade entry zone
    Swing trade: Daily close within ±2% of zone is acceptable
    Returns: {status, message}
    """
    try:
        # Parse entry zone "174.00-177.00" or "174.00 - 177.00"
        parts = entry_zone.replace(" ", "").split("-")
        if len(parts) != 2:
            return {'status': 'UNKNOWN', 'message': 'Invalid entry zone format'}
        
        entry_low = float(parts[0])
        entry_high = float(parts[1])
        zone_mid = (entry_low + entry_high) / 2
        
        # Swing trade: ±2% tolerance around zone boundaries
        
        if current_price > entry_high * 1.05:  # 5% above zone = too extended
            return {
                'status': 'EXTENDED',
                'message': f'Fiyat çok yüksek (${current_price:.2f}), zone ${entry_low:.2f}-${entry_high:.2f}'
            }
        elif current_price < entry_low * 0.95:  # 5% below zone = setup failed
            return {
                'status': 'INVALIDATED',
                'message': f'Fiyat çok düşük (${current_price:.2f}), setup geçersiz'
            }
        elif current_price > entry_high * 1.02:  # 2-5% above = wait for pullback
            return {
                'status': 'WAIT',
                'message': f'Entry zone üstünde (${current_price:.2f}), pullback bekle'
            }
        elif current_price < entry_low * 0.98:  # 2-5% below = caution
            return {
                'status': 'BELOW',
                'message': f'Entry zone altında (${current_price:.2f}), dikkatli ol'
            }
        else:
            # Within zone ±2% = GOOD for swing trade
            distance_from_mid = abs((current_price - zone_mid) / zone_mid) * 100
            return {
                'status': 'VALID',
                'message': f'Entry zone içinde (${entry_low:.2f}-${entry_high:.2f}), GİRİŞ UYGUN ✅ ({distance_from_mid:.1f}% from mid)'
            }
            
    except Exception as e:
        return {'status': 'UNKNOWN', 'message': str(e)}
        

def validate_volume_for_setup(setup_type: str, volume_ratio: float, ticker: str = None) -> dict:
    """
    Check if volume supports the setup - ADVANCED SWING TRADE version
    
    Rules:
    1. Check 15m trend (last 4 bars) - must be UP
    2. Check 1h trend (last 4 bars) - must be UP
    3. Check volume trend - must be stable or rising
    
    NO catching falling knives! Price UP + Volume DOWN = Trap
    """
    # Swing trade thresholds
    thresholds = {
        'BREAKOUT': 1.3,
        'SQUEEZE': 1.2,
        'ABSORPTION': 1.0,
        'TREND': 0.8
    }
    
    required = thresholds.get(setup_type, 1.0)
    
    # Check daily volume ratio first
    if volume_ratio < required:
        return {
            'valid': False,
            'message': f'Volume yetersiz ({volume_ratio:.1f}x < {required}x) ❌'
        }
    
    # 🔥 CRITICAL: Multi-timeframe trend + volume check
    if not ticker:
        # If no ticker, only check daily volume
        return {
            'valid': True,
            'message': f'Volume OK ({volume_ratio:.1f}x) - trend check skipped'
        }
    
    try:
        import yfinance as yf
        stock = yf.Ticker(ticker)
        
        # ============================================
        # 1. CHECK 15m TREND (Last 4 bars = 1 hour)
        # ============================================
        hist_15m = stock.history(period="1d", interval="15m")
        
        if hist_15m.empty or len(hist_15m) < 4:
            return {
                'valid': True,
                'message': f'Volume OK ({volume_ratio:.1f}x) - 15m data unavailable'
            }
        
        last_4_bars_15m = hist_15m.iloc[-4:]
        
        # Price trend (first bar close vs last bar close)
        price_first = last_4_bars_15m['Close'].iloc[0]
        price_last = last_4_bars_15m['Close'].iloc[-1]
        price_trend_15m = "UP" if price_last > price_first else "DOWN"
        price_change_15m = ((price_last - price_first) / price_first) * 100
        
        # Volume trend (first 2 bars avg vs last 2 bars avg)
        volumes_15m = last_4_bars_15m['Volume'].tolist()
        vol_first_half = sum(volumes_15m[:2]) / 2
        vol_second_half = sum(volumes_15m[2:]) / 2
        volume_trend_15m = "UP" if vol_second_half >= vol_first_half else "DOWN"
        volume_change_15m = ((vol_second_half - vol_first_half) / vol_first_half) * 100
        
        # 15m REJECTION RULES
        if price_trend_15m == "DOWN":
            return {
                'valid': False,
                'message': f'15m trend DOWN ({price_change_15m:+.1f}%) 🔻 Düşen bıçak - RED'
            }
        
        # YENİ: Sahte yükselişlere sıfır tolerans (Hacim %5 bile düşse dikkat, %10 düşerse RED)
        if price_trend_15m == "UP" and volume_trend_15m == "DOWN" and volume_change_15m < -10:
            return {
                'valid': False,
                'message': f'15m: Fiyat UP ama hacim DOWN ({volume_change_15m:.0f}%) ⚠️ Sahte Yükseliş Tuzağı - RED'
            }
            
        # ============================================
        # 2. CHECK 1h TREND (Last 4 bars = 4 hours)
        # ============================================
        hist_1h = stock.history(period="5d", interval="1h")
        
        if hist_1h.empty or len(hist_1h) < 4:
            # 15m passed but 1h unavailable - allow with warning
            return {
                'valid': True,
                'message': f'Volume OK, 15m trend UP - 1h data unavailable'
            }
        
        last_4_bars_1h = hist_1h.iloc[-4:]
        
        # Price trend
        price_first_1h = last_4_bars_1h['Close'].iloc[0]
        price_last_1h = last_4_bars_1h['Close'].iloc[-1]
        price_trend_1h = "UP" if price_last_1h > price_first_1h else "DOWN"
        price_change_1h = ((price_last_1h - price_first_1h) / price_first_1h) * 100
        
        # Volume trend
        volumes_1h = last_4_bars_1h['Volume'].tolist()
        vol_first_half_1h = sum(volumes_1h[:2]) / 2
        vol_second_half_1h = sum(volumes_1h[2:]) / 2
        volume_trend_1h = "UP" if vol_second_half_1h >= vol_first_half_1h else "DOWN"
        volume_change_1h = ((vol_second_half_1h - vol_first_half_1h) / vol_first_half_1h) * 100
        
        # 1h REJECTION RULES
        if price_trend_1h == "DOWN":
            return {
                'valid': False,
                'message': f'1h trend DOWN ({price_change_1h:+.1f}%) 🔻 Düşen bıçak - RED'
            }
        
        if price_trend_1h == "UP" and volume_trend_1h == "DOWN" and volume_change_1h < -15:
            return {
                'valid': False,
                'message': f'1h: Fiyat UP ama hacim DOWN ({volume_change_1h:.0f}%) ⚠️ Divergence - RED'
            }
        
        # ============================================
        # 3. ALL CHECKS PASSED ✅
        # ============================================
        return {
            'valid': True,
            'message': f'Volume OK ({volume_ratio:.1f}x) | 15m: P{price_change_15m:+.1f}% V{volume_change_15m:+.0f}% | 1h: P{price_change_1h:+.1f}% V{volume_change_1h:+.0f}% ✅'
        }
        
    except Exception as e:
        # If any check fails, fall back to daily volume only
        return {
            'valid': True,
            'message': f'Volume OK ({volume_ratio:.1f}x) - trend check error: {str(e)[:30]}'
        }

# ------------------------------------------------
# 🔹 LOG CONFIGURATION
# ------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logging.getLogger("yfinance").setLevel(logging.CRITICAL)

# --- AI API KEYS ---
GEMINI_API_KEY = "AIzaSyA6cu1eE5xyh2-1eEFEdZcMXY7MSzqIPnM"

# --- SENTIMENT API KEYS ---
# ... (API Keys stay data) ...

# Configuration
# Gemini Client Configuration
if GEMINI_NEW_API:
    try:
        gemini_client = genai_new.Client(api_key=GEMINI_API_KEY)
    except Exception as e:
        print(f"Gemini Client Init Error: {e}")
        gemini_client = None
else:
    genai_old.configure(api_key=GEMINI_API_KEY)
    gemini_client = genai_old

# ------------------------------------------------
# 🔹 TIME SETTINGS (NEW YORK)
# ------------------------------------------------
NY_TZ = ZoneInfo("America/New_York")

RUN_START_HOUR = 9      # 09:00 NY (Pre-market sonu)
RUN_END_HOUR = 16       # 16:00 NY (Kapanış)
WEEKDAY_SET = {0, 1, 2, 3, 4}

# ------------------------------------------------
# 🔹 CACHE SETTINGS
# ------------------------------------------------
UNIVERSE_TTL = 168 * 3600       # 1 hafta
UNIVERSE_CACHE: Dict[str, Any] = {
    "ts": 0.0,
    "data": []
}

# ------------------------------------------------
# 🔹 DATA LOOKBACK LIMITS (INSTITUTIONAL MODE)
# ------------------------------------------------
# Kurumsal analiz için daha geniş veri setine ihtiyaç var (VWAP & 52W High)
LOOKBACK_DAYS_1D = 365     # 1 Yıl (Year-to-Date VWAP ve Yapısal Analiz için)
LOOKBACK_DAYS_1H = 90      # Stabilizasyon ve Kurumsal Maliyet Bölgesi
LOOKBACK_DAYS_15M = 14     # Entry Timing (Kısa vade yeterli)

MIN_BARS_1D = 200          # EMA200 ve Volatilite hesaplaması için zorunlu
MIN_BARS_1H = 300
MIN_BARS_15M = 200

# ------------------------------------------------
# 🔹 INSTITUTIONAL STRATEGY SETTINGS (v3.0)
# ------------------------------------------------
INSTITUTIONAL_SETTINGS = {
    # --- VOLATILITY QUALITY (NATR) ---
    "NATR_MIN": 2.0,       # %2'nin altı "Dead Money" (Ölü Para)
    "NATR_SWEET_SPOT_MIN": 2.5,
    "NATR_SWEET_SPOT_MAX": 6.0,
    "NATR_MAX": 7.5,       # %7.5 üzeri "Kumar/Haber Bazlı" (High Risk)

    # --- RELATIVE STRENGTH (RS) ---
    "RS_LOOKBACK_DAYS": 5, # 1 Haftalık ayrışmaya bakarız
    "RS_DECOUPLING_THRESHOLD": 0.5, # Endeksten %0.5 pozitif ayrışma şartı

    # --- VOLUME PRICE ANALYSIS (VPA) ---
    "ABSORPTION_RVOL": 1.8,       # Ortalamanın 1.8 katı hacim
    "ABSORPTION_RANGE_PCT": 1.5,  # Ama fiyat %1.5 içinde sıkışmış (Emilim)

    # --- TREND ENERGY (ADX) ---
    "ADX_MIN_TREND": 20,          # Trend başlangıcı
    "ADX_MAX_SAFE": 45,           # 45 üzeri "Late Trend" (Geç kalınmış)

    # --- TARGETS ---
    "MIN_RR_RATIO": 2.0,          # Risk/Reward en az 1:2 olmalı
}

# ------------------------------------------------
# 🔹 LIQUIDITY & FILTERING (SMART MONEY)
# ------------------------------------------------
# Kurumsal algoritmalar sığ tahtalara girmez.
PRICE_MIN = 3.0
PRICE_MAX = 1500.0

MIN_MARKET_CAP = 300_000_000    # Min 300M$ (Small Cap üstü)
MIN_AVG_VOLUME = 500_000        # Günlük 500k lot
MIN_DOLLAR_VOLUME = 5_000_000  # Günlük 5 Milyon $ işlem hacmi (Zorunlu)

MIN_BETA = 0.3
MAX_BETA = 3.0                  # Aşırı spekülatifleri ele
MAX_SHORT_FLOAT = 0.30          # Short Squeeze tuzağına düşmemek için limit

# ------------------------------------------------
# 🔹 GLOBAL MARKET CONTEXT (DYNAMIC)
# ------------------------------------------------
INDEX_BENCHMARK = "^GSPC"  # S&P 500

MARKET_CONTEXT = {
    "regime": "Neutral",      # Bull / Bear / Neutral
    "risk_modifier": 1.0,     # Pozisyon büyüklüğü çarpanı
    "spy_5d_pct": 0.0,        # RS hesaplaması için gerekli
    "spy_20d_pct": 0.0,       # Orta vade trend yönü
    "vix_level": 0.0,         # Volatilite endeksi (Korku ölçümü)
}

SECTOR_CONTEXT: Dict[str, float] = {}
MAX_PER_SECTOR_LATEST = 3
MAX_PER_SECTOR_OTHERS = 3
LAST_PRE_GAP_ALERT_DATE = None

# ============================================================
# 📁 KARTAL YUVASI – CANDIDATE UNIVERSE LOADER
#
# Kaynaklar (DEĞİŞMEZ):
# 1) watchlist_rolling.txt        (family304 / family305a)
# 2) watchlist_YYYYMMDD.txt       (en güncel tarihli)
# 3) manual_watchlist.txt         (manuel eklenenler)
# ============================================================

WATCHLIST_DIR = r"C:\Users\afksm\.gemini\antigravity\scratch\financial_tracker\watchlists"
MANUAL_TXT_PATH = os.path.join(WATCHLIST_DIR, "manual_watchlist.txt")


def _find_latest_family304_watchlist() -> Optional[str]:
    """
    watchlist_YYYYMMDD.txt formatındaki en güncel tarihli dosyayı bulur.
    """
    try:
        if not os.path.exists(WATCHLIST_DIR):
            logging.warning(f"⚠️ Watchlist dizini bulunamadı: {WATCHLIST_DIR}")
            return None

        files = [
            f for f in os.listdir(WATCHLIST_DIR)
            if f.startswith("watchlist_") and f.endswith(".txt") and any(c.isdigit() for c in f)
        ]

        if not files:
            logging.warning("⚠️ Tarihli watchlist dosyası bulunamadı.")
            return None

        files.sort(reverse=True)
        latest_path = os.path.join(WATCHLIST_DIR, files[0])
        
        # Extract date from filename (watchlist_YYYYMMDD.txt)
        filename = files[0]
        date_str = filename.replace("watchlist_", "").replace(".txt", "")
        
        logging.info(f"📄 Latest watchlist: {filename} (Date: {date_str})")
        return latest_path

    except Exception as e:
        logging.error(f"Watchlist arama hatası: {e}")
        return None


def _read_symbols_from_path(path: Optional[str], source_name: str) -> List[str]:
    """Ortak dosya okuma yardımcısı."""
    symbols = set()
    if not path or not os.path.exists(path):
        logging.warning(f"⚠️ {source_name} bulunamadı: {path}")
        return []

    count = 0
    try:
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                raw = line.split("#")[0].strip().upper()
                if not raw: continue
                sym = raw.split()[0]
                if sym.isalpha() and 1 <= len(sym) <= 6:
                    symbols.add(sym)
                    count += 1
        logging.info(f"✅ {source_name} yüklendi: {count} sembol.")
        return sorted(list(symbols))
    except Exception as e:
        logging.error(f"❌ Dosya okuma hatası ({source_name}): {e}")
        return []

def load_latest_universe_from_txt() -> List[str]:
    json_path = os.path.join(r"C:\Users\afksm\finma\frontend\public", "swing_all_picks.json")
    symbols = []
    try:
        if os.path.exists(json_path):
            import json
            with open(json_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                for c in data.get("picks", []):
                    sym = c.get("ticker")
                    if sym:
                        symbols.append(sym)
            if symbols:
                logging.info(f"✅ Latest Watchlist (JSON) yüklendi: {len(symbols)} sembol.")
                return symbols
    except Exception as e:
        logging.warning(f"JSON okuma hatası: {e}. Fallback to TXT.")
        
    path = _find_latest_family304_watchlist()
    return _read_symbols_from_path(path, "Latest Watchlist")

def load_manual_universe_from_txt() -> List[str]:
    return _read_symbols_from_path(MANUAL_TXT_PATH, "Manual Watchlist")

def load_rolling_universe_from_txt() -> List[str]:
    path = os.path.join(WATCHLIST_DIR, "watchlist_rolling.txt")
    return _read_symbols_from_path(path, "Rolling Watchlist")
    
# ============================================================
# 3) KARTAL YUVASI – MULTI TIMEFRAME DATA FETCHER
#
# Amaç:
# - 1D  → Yapısal bağlam (Kurumsal trend, 52W High, YTD VWAP)
# - 1H  → Stabilizasyon & Kurumsal Maliyet Bölgesi (Value Zone)
# - 15M → Mikro Yapı Kırılımı (Timing & Invalidation)
#
# Not:
# - Veri çekme işlemi paralel (asyncio) yapılır.
# - Kurumsal filtreler (MIN_BARS) burada uygulanır.
# ============================================================

YF_SEMAPHORE = asyncio.Semaphore(4)   # Aynı anda max 4 Yahoo çağrısı


async def get_kartal_yuvasi_data(
    ticker: str
) -> Optional[Dict[str, pd.DataFrame]]:
    """
    Çok zaman dilimli swing-entry veri seti üretir.
    Institutional Mode (v3.0) uyumlu veri derinliği sağlar.
    """

    async with YF_SEMAPHORE:
        try:
            stock = yf.Ticker(ticker)

            # -------------------------------------------------
            # 📥 PARALLEL FETCH (THREAD-SAFE)
            # -------------------------------------------------
            # Not: Kurumsal analiz için 1D'de en az 1 yıl (200MA ve YTD VWAP için),
            # 1H'de 6 ay (max limit) ve 15M'de 1 ay (yapı kırılımı) verisi çekiyoruz.
            df_1d, df_1h, df_15m = await asyncio.gather(
                asyncio.to_thread(
                    stock.history,
                    period="1y",        # 1D: 1 Yıl (~252 bar) -> Trend Fazı Analizi
                    interval="1d",
                    auto_adjust=True,
                    timeout=20,
                ),
                asyncio.to_thread(
                    stock.history,
                    period="6mo",       # 1H: 6 Ay (Max) -> Value Zone tespiti
                    interval="1h",
                    auto_adjust=True,
                    timeout=20,
                ),
                asyncio.to_thread(
                    stock.history,
                    period="1mo",       # 15M: 1 Ay -> Micro Structure (14g yerine 1 ay)
                    interval="15m",
                    auto_adjust=True,
                    timeout=20,
                ),
            )

            # -------------------------------------------------
            # 🧹 BASIC VALIDATION
            # -------------------------------------------------
            if any(df is None for df in (df_1d, df_1h, df_15m)):
                return None

            if df_1d.empty or df_1h.empty or df_15m.empty:
                return None

            # Minimum bar gereksinimleri (Global ayarlardan gelir - v3.0)
            # 1D: Min 200 (SMA200 için), 1H: Min 300, 15M: Min 200
            if len(df_1d) < MIN_BARS_1D:
                return None
            if len(df_1h) < MIN_BARS_1H:
                return None
            if len(df_15m) < MIN_BARS_15M:
                return None

            # -------------------------------------------------
            # 🧼 CLEAN & NORMALIZE
            # -------------------------------------------------
            def _clean(df: pd.DataFrame) -> pd.DataFrame:
                df = df.copy()

                # Standart OHLCV isimlendirme
                df.columns = [c.strip().capitalize() for c in df.columns]

                # Duplicate timestamp temizliği
                if df.index.has_duplicates:
                    df = df[~df.index.duplicated(keep="last")]

                # Zaman sıralaması
                df.sort_index(inplace=True)

                # Temel veri bütünlüğü
                # Hacimsiz barları veya hatalı OHLC verilerini temizle
                df.dropna(subset=["Open", "High", "Low", "Close"], inplace=True)

                # Volume güvenli dönüşüm
                if "Volume" in df.columns:
                    df["Volume"] = (
                        pd.to_numeric(df["Volume"], errors="coerce")
                        .fillna(0.0)
                    )

                return df

            df_1d = _clean(df_1d)
            df_1h = _clean(df_1h)
            df_15m = _clean(df_15m)

            # Temizlik sonrası son kontrol (Veri kaybı olduysa ele)
            if (
                len(df_1d) < MIN_BARS_1D
                or len(df_1h) < MIN_BARS_1H
                or len(df_15m) < MIN_BARS_15M
            ):
                return None

            return {
                "1d": df_1d,
                "1h": df_1h,
                "15m": df_15m,
            }

        except Exception:
            # Hata durumunda (örn: delist olmuş hisse) sessizce geç
            return None
            
# ============================================================
# 4) KARTAL YUVASI – INDICATOR ENGINE (INSTITUTIONAL)
#
# Zaman Dilimi Rolleri:
# - 1D  → Trend Fazı (Phase), Yapısal Eğim, NATR Kalitesi
# - 1H  → Sıkışma (Squeeze), Emilim (Absorption), VWAP İlişkisi
# - 15M → Mikro Kırılım (Micro Break)
# ============================================================

# ============================================================
# 4) KARTAL YUVASI – INDICATOR ENGINE (SAFE MODE)
# ============================================================

def calculate_kartal_indicators(df: pd.DataFrame, tf: str) -> pd.DataFrame:
    """
    Master Plan v3.1 - GÜVENLİ İndikatör Seti
    Veri kaybını önlemek için 'dropna' yerine 'fillna' ve manuel hesaplama kullanır.
    """
    df = df.copy()
    
    # Veri yetersizse hesaplama yapmadan dön
    if len(df) < 20: return df

    # --- EMA Hesapları ---
    df["EMA20"] = df["Close"].ewm(span=20, adjust=False).mean()
    df["EMA50"] = df["Close"].ewm(span=50, adjust=False).mean()
    df["EMA200"] = df["Close"].ewm(span=200, adjust=False).mean()
    # Slope için 5 bar yetmezse 0 bas
    df["EMA200_Slope"] = df["EMA200"].diff(periods=5).fillna(0)

    # --- ATR (Manuel Hesap - Kütüphane Bağımsız) ---
    # Kütüphane sorunlarını ve NaN riskini minimize eder
    prev_close = df["Close"].shift(1)
    tr1 = df["High"] - df["Low"]
    tr2 = (df["High"] - prev_close).abs()
    tr3 = (df["Low"] - prev_close).abs()
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    df["ATR"] = tr.rolling(14, min_periods=1).mean() # min_periods=1: tek bar bile olsa hesapla
    
    # NATR (Normalized ATR)
    df["NATR"] = (df["ATR"] / df["Close"]) * 100

    # --- Hacim ve RVOL ---
    # 15M grafiğinde veri az olabilir, pencereyi 20 bara sabitledik
    window_vol = 20
    
    df["VolMA"] = df["Volume"].rolling(window=window_vol, min_periods=1).mean()
    # Sıfıra bölünme hatasını önle (replace 0 with 1)
    df["RVOL"] = df["Volume"] / df["VolMA"].replace(0, 1) 

    # --- VPA (Effort vs Result) ---
    spread = (df["High"] - df["Low"]).replace(0, 0.01) # Spread 0 olamaz
    raw_effort = df["Volume"] / spread
    # Normalize effort (Kendi geçmişine göre)
    effort_ma = raw_effort.rolling(window=20, min_periods=1).mean()
    df["VPA_Effort"] = raw_effort / effort_ma.replace(0, 1)

    # --- Bollinger Bands (Manuel - Squeeze için) ---
    sma = df["Close"].rolling(20, min_periods=1).mean()
    std = df["Close"].rolling(20, min_periods=1).std()
    df["BB_Upper"] = sma + (2 * std)
    df["BB_Lower"] = sma - (2 * std)
    # Band genişliği
    df["BB_Width"] = (df["BB_Upper"] - df["BB_Lower"]) / sma.replace(0, 1)

    # --- ADX (Güvenli Hesaplama) ---
    try:
        # Kütüphane varsa kullan
        adx_ind = ADXIndicator(df["High"], df["Low"], df["Close"], window=14)
        df["ADX"] = adx_ind.adx().fillna(0)
    except:
        # Kütüphane hatası olursa veya veri yetmezse "Trend Gücü" proxy'si
        # (Fiyat Değişimi / ATR) trendin gücünü kabaca gösterir
        df["ADX"] = (df["Close"] - df["Close"].shift(10)).abs() / df["ATR"].replace(0, 1) * 10
        df["ADX"] = df["ADX"].fillna(0)

    # Trend Phase Mapping
    conditions = [
        (df["ADX"] < 20), 
        (df["ADX"] >= 20) & (df["ADX"] < 45),
        (df["ADX"] >= 45)
    ]
    choices = ["ACCUMULATION", "EXPANSION", "EXHAUSTION"]
    df["Trend_Phase"] = np.select(conditions, choices, default="ACCUMULATION")

    # --- VWAP Proxy (Rolling) ---
    v = df["Volume"].values
    tp = (df["High"] + df["Low"] + df["Close"]).values / 3
    # Rolling VWAP Hesabı
    vp = pd.Series(tp * v)
    vol_sum = df["Volume"].rolling(20, min_periods=1).sum().replace(0, 1)
    df["VWAP_Roll"] = vp.rolling(20, min_periods=1).sum() / vol_sum

    # --- KRİTİK DEĞİŞİKLİK: TEMİZLİK ---
    # dropna() yerine fillna() kullanıyoruz ki veri silinmesin.
    # EMA hesaplamaları baştaki verileri NaN yapar, onları geriye dönük dolduruyoruz.
    df = df.bfill() 
    df.fillna(0, inplace=True) # Hala NaN varsa 0 yap

    return df
    
# ================================================================
# 5) KARTAL YUVASI – 15M TIMING & MICRO STRUCTURE ENGINE
# ================================================================

def detect_15m_timing_pattern(df_15m: pd.DataFrame) -> tuple[str, float]:
    """
    15M Mikro Yapı Analizi (Institutional MSB)
    Amaç: Mum şekillerinden ziyade, Yapı Kırılımı (Breakout) ve
    Hacim (Volume) onaylı dönüşleri tespit etmek.

    Çıktı:
    - pattern_name (MSB, EMA Reclaim, Liquidity Grab)
    - timing_score (0.0 – 3.0)
    """
    try:
        if len(df_15m) < 21:
            return "Insufficient Data", 0.0

        curr = df_15m.iloc[-1]
        prev = df_15m.iloc[-2]
        
        # Temel Veriler
        close = curr["Close"]
        open_p = curr["Open"]
        vol = curr["Volume"]
        
        # 15M İndikatörleri (Anlık Hesaplama)
        ema20 = df_15m["Close"].ewm(span=20, adjust=False).mean().iloc[-1]
        
        # Hacim Ortalaması (Son 20 bar)
        avg_vol = df_15m["Volume"].rolling(20).mean().iloc[-1]
        rvol_15m = vol / avg_vol if avg_vol > 0 else 0
        
        # Lokal Yapı (Son 20 barın en yükseği - Hariç son bar)
        recent_high = df_15m["High"].iloc[-21:-1].max()
        
        is_green = close > open_p
        
        # ---------------------------------------------------------
        # 1️⃣ MSB: Micro Structure Break (En Güçlü Sinyal)
        # Son 20 barın tepesini, hacimli bir şekilde kırma.
        # ---------------------------------------------------------
        if close > recent_high and is_green:
            if rvol_15m > 2.5: # YENİ: Opsiyon Sweep benzeri devasa taze para girişi
                return "🚀 HYPER MSB (Smart Money Sweep)", 4.0
            elif rvol_15m > 1.5:
                return "🔥 MSB + Vol Breakout", 3.0

        # ---------------------------------------------------------
        # 2️⃣ EMA20 Reclaim (Trende Geri Dönüş)
        # Fiyat EMA20'nin altındaydı, şimdi üstüne hacimli attı.
        # ---------------------------------------------------------
        prev_close = prev["Close"]
        prev_ema20 = df_15m["Close"].ewm(span=20, adjust=False).mean().iloc[-2]
        
        if prev_close < prev_ema20 and close > ema20 and rvol_15m > 1.2:
            return "⚡ EMA20 Reclaim", 2.5

        # ---------------------------------------------------------
        # 3️⃣ Consolidation Breakout (Sıkışma Kırılımı)
        # Daralan bir yapıdan yukarı patlama.
        # ---------------------------------------------------------
        # Son 5 barın range'i (ATR'ye göre düşükse sıkışmadır)
        atr_15m = df_15m["ATR"].iloc[-1]
        recent_range = (df_15m["High"].iloc[-5:].max() - df_15m["Low"].iloc[-5:].min())
        
        if recent_range < (2.0 * atr_15m): # Sıkışma var
            if close > df_15m["High"].iloc[-5:-1].max() and rvol_15m > 1.3:
                 return "📦 Consolidation Breakout", 2.2

        # ---------------------------------------------------------
        # 4️⃣ Liquidity Grab (Fitil Atıp Dönme - Hammer/Pinbar)
        # ---------------------------------------------------------
        # Kurumsal "Stop Patlatma" mumu. Aşağı uzun fitil, yukarı kapanış.
        body = abs(close - open_p)
        lower_wick = min(close, open_p) - curr["Low"]
        
        if lower_wick > (body * 2.5) and rvol_15m > 1.5:
            return "🪝 Liquidity Grab (Pinbar)", 2.0

        # ---------------------------------------------------------
        # 5️⃣ Standart Bullish Engulfing (İkincil Sinyal)
        # ---------------------------------------------------------
        if is_green and prev["Close"] < prev["Open"]:
            if close > prev["Open"] and open_p < prev["Close"]:
                 return "🕯️ Bullish Engulfing", 1.0

        return "Neutral", 0.0

    except Exception:
        return "Pattern Error", 0.0


# ================================================================
# 🦅 KARTAL YUVASI – 15M ENTRY TIMING ASSESSMENT
# ================================================================

def assess_15m_entry_timing(
    df_15m: pd.DataFrame,
    df_1h: pd.DataFrame,
) -> Dict[str, Any]:
    """
    Giriş Zamanlaması Değerlendirmesi.
    Trade kararı vermez, 'Tetiği Çekme' anının uygunluğunu ölçer.
    """

    try:
        c15 = df_15m.iloc[-1]
        c1h = df_1h.iloc[-1]

        timing_notes = []
        timing_score = 0.0

        # ------------------------------------------------
        # 1️⃣ Mikro Yapı (Pattern) Analizi
        # ------------------------------------------------
        pattern, pattern_score = detect_15m_timing_pattern(df_15m)
        timing_score += pattern_score
        
        if pattern_score > 0:
            timing_notes.append(f"15M Trigger: {pattern}")

        # ------------------------------------------------
        # 2️⃣ 1H ve 15M Trend Uyumu (MTF Alignment)
        # ------------------------------------------------
        price = float(c15["Close"])
        ema20_1h = float(c1h.get("EMA20", 0))
        ema50_1h = float(c1h.get("EMA50", 0))
        ema20_15m = df_15m["Close"].ewm(span=20, adjust=False).mean().iloc[-1]
        
        is_15m_bullish = price > ema20_15m

        # İdeal Senkronizasyon: 15M ve 1H aynı anda yukarı bakıyor
        if price > ema20_1h > 0 and is_15m_bullish:
            timing_score += 2.0
            timing_notes.append("✅ MTF Aligned: 1H & 15M Bullish")
        
        # Kabul Edilebilir: 1H Pullback bölgesinde ama 15M dönüş başlatmış
        elif price > ema50_1h > 0 and is_15m_bullish:
            timing_score += 1.0
            timing_notes.append("Aligned with 1H EMA50 & 15M Trend")
        
        # Riskli: Çatışma durumu (1H düşüyor veya 15M henüz onay vermemiş)
        else:
            timing_score -= 2.0
            timing_notes.append("⚠️ MTF Conflict: 1H vs 15M Uyumsuz")

        # ------------------------------------------------
        # 3️⃣ Extension Check (Kovalama Kontrolü)
        # ------------------------------------------------
        # Fiyat 15M EMA20'den çok uzaklaştıysa girilmez (Mean Reversion riski).
        ema20_15m = df_15m["Close"].ewm(span=20, adjust=False).mean().iloc[-1]
        atr_15m = float(c15.get("ATR", c15["Close"]*0.01))
        
        dist_from_ema = (price - ema20_15m) / atr_15m
        
        if dist_from_ema > 3.0: # 3 ATR uzakta
            timing_notes.append("⛔ Extended (Don't Chase)")
            timing_score -= 2.0 # Ciddi ceza

        # ------------------------------------------------
        # SONUÇ (STATE MAKİNESİ)
        # ------------------------------------------------
        # READY: Güçlü bir kırılım var ve ana trendle uyumlu.
        # FORMING: Yapı oluşuyor ama henüz tam tetiklenmedi.
        return {
            "timing_score": round(timing_score, 2),
            "timing_state": (
                "READY"
                if timing_score >= 4.0
                else "FORMING"
                if timing_score >= 2.0
                else "WAIT"
            ),
            "notes": timing_notes,
        }

    except Exception as e:
        return {
            "timing_score": 0.0,
            "timing_state": "ERROR",
            "notes": [str(e)],
        }
        
# ================================================================
# 🧠 KARTAL YUVASI v3.3 (SENTIMENT+AI) – STRATEGIC ANALYSIS ENGINE
# ================================================================

def analyze_1d_context(df_1d: pd.DataFrame) -> Dict[str, Any]:
    """
    1D Yapısal Analiz (Institutional Context)
    Kontroller: NATR Kalitesi, Trend Fazı, Yapısal Eğim, İptal Seviyesi.
    """
    try:
        curr = df_1d.iloc[-1]
        
        # 1️⃣ VOLATILITY QUALITY CHECK (NATR)
        # Önce hissenin karakterini test et.
        natr = curr.get("NATR", 0.0)
        vol_score = 0.0
        vol_note = ""
        
        # Institutional Sweet Spot: %2.5 - %6.0
        if natr < 2.0:
            return {"structure": "DEAD_MONEY", "1d_score": -99, "1d_notes": ["NATR < 2% (Too Stable)"]}
        elif natr > 7.5:
            return {"structure": "HIGH_RISK", "1d_score": -99, "1d_notes": ["NATR > 7.5% (Gamble)"]}
        elif 2.5 <= natr <= 6.0:
            vol_score = 2.0
            vol_note = "Vol: Prime Swing"
        else:
            vol_score = 1.0 # Kabul edilebilir sınır
            vol_note = "Vol: Acceptable"

        # 2️⃣ TREND ALIGNMENT (EMA Slope)
        # EMA200 yukarı bakmıyorsa kurumsal trend yoktur.
        ema200_slope = curr.get("EMA200_Slope", 0)
        price = curr["Close"]
        ema50 = curr.get("EMA50", 0)
        
        trend_score = 0.0
        
        if ema200_slope > 0 and price > ema50:
            trend_score = 3.0 # Güçlü Trend
        elif price > ema50:
            trend_score = 1.5 # Recovery / Early Trend
        else:
            return {"structure": "BEARISH", "1d_score": -50, "1d_notes": ["Price below EMA50 & Slope Negative"]}

        # 3️⃣ TREND PHASE (ADX Based)
        phase = curr.get("Trend_Phase", "UNKNOWN")
        phase_score = 0.0
        
        if phase == "EXPANSION":
            phase_score = 2.5
        elif phase == "ACCUMULATION":
            phase_score = 1.5 # Erken giriş fırsatı
        elif phase == "EXHAUSTION":
            phase_score = -2.0 # Geç kalınmış
            
        # 4️⃣ INVALIDATION LEVEL (Pivot Low)
        # Son 20 günün en düşüğü yapısal stop seviyesidir.
        pivot_low = df_1d["Low"].iloc[-20:].min()

        # SONUÇ
        total_score = vol_score + trend_score + phase_score
        notes = [f"Phase: {phase}", vol_note]
        if ema200_slope > 0: notes.append("Slope: Positive")

        return {
            "structure": phase,
            "1d_score": total_score,
            "1d_notes": notes,
            "invalidation_level": pivot_low
        }

    except Exception:
        return {"structure": "ERROR", "1d_score": 0, "1d_notes": [], "invalidation_level": 0}


def evaluate_hourly_status(current_price: float, entry_zone: str, target: float, stop_loss: float, rsi_1h: float, rsi_15m: float = 50.0, trend_1h: str = "FLAT", swing_data: dict = None) -> dict:
    """
    Boga Finance AI - Hourly Direction & Status Evaluation (English Only)
    """
    try:
        # Check swing trade management first
        if swing_data:
            profit_zone = swing_data.get("profit_zone", {})
            stop_zone = swing_data.get("stop_zone", {})
            
            p_low = float(profit_zone.get("low", target))
            s_high = float(stop_zone.get("high", stop_loss))
            
            if current_price >= p_low:
                return {"status": "🟢 TAKE PROFIT", "msg": f"Price reached swing target zone (${p_low:.2f}+). Consider taking partial or full profits as momentum continues."}
            if current_price <= s_high:
                return {"status": "🔴 STOP LOSS HIT", "msg": f"Price broke below swing safety cut-off (${s_high:.2f}). Invalidated."}

        # Entry zone parsing (e.g. "150.00 - 152.00")
        parts = entry_zone.replace(" ", "").split("-")
        if len(parts) == 2:
            entry_low, entry_high = float(parts[0]), float(parts[1])
        else:
            entry_low, entry_high = current_price * 0.99, current_price * 1.01

        # Calculate distance to levels for justification
        dist_stop = ((current_price - stop_loss) / stop_loss) * 100
        dist_target = ((target - current_price) / current_price) * 100

        # 1. STOP LOSS EVALUATION (Intraday Fallback)
        if current_price <= stop_loss * 1.005:
            return {"status": "🔴 STOP LOSS / INVALID", "msg": f"Price is at or below the intraday safety cut-off (${stop_loss:.2f}). Setup invalidated."}

        # 2. OVERBOUGHT REJECTION (1H RSI > 75)
        if rsi_1h > 75:
            return {"status": "⚠️ HOLD (Overbought)", "msg": f"1H RSI is heavily overbought ({rsi_1h:.0f}). Pullback imminent, do not buy."}

        # 3. BUY ZONE EVALUATION
        if entry_low * 0.99 <= current_price <= entry_high * 1.01:
            if trend_1h == "DOWN" or rsi_15m < 35:
                # Price is in zone but crashing (falling knife)
                return {"status": "⏳ HOLD (Falling Knife)", "msg": f"In entry zone, but 15m RSI is crashing ({rsi_15m:.0f}) and short-term trend is DOWN. Wait for stabilization."}
            elif rsi_1h < 40:
                return {"status": "🟢 BUY ZONE (Oversold Bounce)", "msg": f"Price in buy zone. 1H RSI is oversold ({rsi_1h:.0f}). Expecting an upward reaction."}
            else:
                return {"status": "🟢 BUY ZONE (Active)", "msg": f"Price is within entry range (${entry_low:.2f}-${entry_high:.2f}). Trend is stable (1H RSI: {rsi_1h:.0f})."}

        # 4. HOLD / WAIT FOR PULLBACK
        if current_price > entry_high * 1.01 and current_price < target * 0.98:
            return {"status": "⚠️ HOLD (Wait Pullback)", "msg": f"Price extended above entry zone (${entry_high:.2f}). Wait for a pullback or consolidation."}

        # 5. TARGET REACHED (Intraday Fallback)
        if current_price >= target * 0.98:
            return {"status": "🟢 TAKE PROFIT", "msg": f"Price reached or near intraday target (${target:.2f}). Secure profits."}

        # Default fallback
        return {"status": "⏳ NEUTRAL", "msg": f"Price is in a neutral zone. 1H RSI: {rsi_1h:.0f}. No clear action."}

    except Exception as e:
        return {"status": "UNKNOWN", "msg": "Failed to calculate status."}

def analyze_1h_structure(df_1h: pd.DataFrame) -> Dict[str, Any]:
    """
    1H Taktiksel Analiz (Institutional Footprint)
    Odak: VWAP Savunma Alanı, Absorption, Volatility Squeeze
    """
    try:
        curr = df_1h.iloc[-1]

        score = 0.0
        setup = "NONE"
        notes = []

        # =========================
        # 1️⃣ INSTITUTIONAL VALUE ZONE (VWAP & EMA50) – ATR BASED
        # =========================
        price = curr["Close"]
        ema50 = curr.get("EMA50", 0.0)
        vwap = curr.get("VWAP_Roll", 0.0)
        atr = curr.get("ATR", price * 0.01)

        # ATR bazlı mesafe (kurumsal yaklaşım)
        vwap_dist_atr = abs(price - vwap) / atr if atr > 0 else 99
        ema50_dist_atr = abs(price - ema50) / atr if atr > 0 else 99

        # Savunma / Kabul / Geç kalınmış ayrımı
        in_defense_zone = (vwap_dist_atr <= 0.8) or (ema50_dist_atr <= 0.8)
        in_acceptable_zone = (vwap_dist_atr <= 1.5) or (ema50_dist_atr <= 1.5)

        if in_defense_zone and price >= ema50:
            score += 2.0
            notes.append("VWAP/EMA50 Defense Zone")
        elif in_acceptable_zone and price >= ema50:
            score += 0.8
            notes.append("VWAP/EMA50 Acceptable Zone")
        else:
            notes.append("VWAP Extended")

        # =========================
        # 2️⃣ ABSORPTION (High Effort / Low Result)
        # =========================
        vpa_effort = curr.get("VPA_Effort", 1.0)
        rvol = curr.get("RVOL", 1.0)

        absorption = (vpa_effort > 1.8) and (rvol > 1.5)

        if absorption:
            score += 3.0
            setup = "ABSORPTION"
            notes.append("🔥 Institutional Absorption")

        # =========================
        # 3️⃣ COILED SPRING (Bollinger Squeeze)
        # =========================
        bb_width = curr.get("BB_Width", 10.0)
        avg_width = df_1h["BB_Width"].rolling(20).mean().iloc[-1]

        squeeze = bb_width < (avg_width * 0.7)

        if squeeze and not absorption:
            score += 2.0
            setup = "SQUEEZE"
            notes.append("⚡ Bollinger Squeeze")

        # =========================
        # 4️⃣ MOMENTUM CONFIRMATION (ADX + VOLUME)
        # =========================
        adx = curr.get("ADX", 0.0)

        # YENİ: 1H Grafikte devasa kurumsal alım (Taze Para)
        if rvol > 2.5 and price > curr.get("Open", price):
            score += 2.5
            setup = "AGGRESSIVE_BUY"
            notes.append("🚀 1H Institutional Sweep (Massive Volume)")

        # ADX tek başına değil, hacimle birlikte (FOMO kuralı: ADX 45 üstüyse geç kaldın)
        if 18 <= adx <= 45 and (absorption or rvol > 1.3):
            score += 1.0
            notes.append("ADX + Volume Confirmation")


        return {
            "setup_type": setup,
            "1h_score": score,
            "1h_notes": notes,
            "vpa_signal": absorption
        }

    except Exception as e:
        return {
            "setup_type": "ERROR",
            "1h_score": 0.0,
            "1h_notes": [str(e)],
            "vpa_signal": False
        }


def detect_closing_absorption_setup(df_15m: pd.DataFrame, df_1h: pd.DataFrame) -> dict:
    """
    Kurumsal PRE-GAP (15:30 - 16:00 NY) - "Go-Home Production"
    Kurumlar pozisyonu eve (overnight) götürmeye istekli mi?
    """
    try:
        if len(df_15m) < 8 or len(df_1h) < 2:
            return {"pre_gap": False, "score": 0.0}

        last_bars = df_15m.iloc[-2:]      # Son 30 dk
        curr_1h = df_1h.iloc[-1]
        
        score = 0.0

        # 1️⃣ VWAP Üzerinde Kapanış (ZORUNLU)
        # Gün sonu VWAP üstü = Bullish Conviction
        price = last_bars.iloc[-1]["Close"]
        vwap_1h = curr_1h.get("VWAP_Roll", 0)
        
        if price < vwap_1h:
            return {"pre_gap": False, "score": 0.0} # VWAP altıysa taşıma
            
        score += 1.5 # VWAP Check Pass

        # 2️⃣ Gün Tepesine Yakınlık (High of Day)
        # Günlük en yükseğin %95'i bölgesinde kapatıyorsa
        day_high = df_15m["High"].iloc[-26:].max() # Son 1 gün (yaklaşık)
        if price >= day_high * 0.98:
            score += 2.0
        
        # 3️⃣ Hacimli ama Dar Range (Absorption) - VURKAÇ GÜNCELLEMESİ
        avg_vol = df_15m["Volume"].rolling(10).mean().iloc[-1]
        curr_vol = last_bars["Volume"].mean()
        
        # Son dakikalarda hacim en az 2 katına çıkmalı (Gerçek kurumsal izi)
        if curr_vol > avg_vol * 2.0: 
             score += 2.0
        elif curr_vol > avg_vol * 1.5: 
             score += 1.0

        return {
            "pre_gap": score >= 4.0,
            "score": round(score, 2)
        }

    except Exception:
        return {"pre_gap": False, "score": 0.0}


async def process_single_stock(ticker: str) -> Optional[Dict[str, Any]]:
    """
    KARTAL YUVASI v3.5 - MASTER PROCESSOR
    Institutional Swing Engine (1–7 gün)
    
    Improvements:
    - Manual entry zone calculation (removed calculate_entry_zone dependency)
    - Volume validation integrated
    - Market cap & sector info added
    - Safe .get() accessors
    - NaN/Inf protection
    """

    # ================================================
    # 1. VERİ ÇEKME
    # ================================================
    data_pack = await get_kartal_yuvasi_data(ticker)
    if not data_pack:
        return None

    # ================================================
    # 2. İNDİKATÖR HESAPLARI
    # ================================================
    try:
        df_1d = calculate_kartal_indicators(data_pack["1d"], "1d")
        df_1h = calculate_kartal_indicators(data_pack["1h"], "1h")
        df_15m = calculate_kartal_indicators(data_pack["15m"], "15m")
    except Exception as e:
        logging.warning(f"{ticker}: Indicator calculation failed: {e}")
        return None

    # 🛑 HATA ÖNLEYİCİ KONTROL
    if df_1d.empty or df_1h.empty or df_15m.empty:
        return None

    # ================================================
    # 3. RELATIVE STRENGTH (RS) – KADEMELİ
    # ================================================
    rs_score = 0.0
    rs_note = ""

    try:
        # En az 6 bar gerekli (5 gün öncesi için)
        if len(df_1d) > 5:  # Index 0-5 = 6 bar
            close_curr = df_1d["Close"].iloc[-1]
            close_5d = df_1d["Close"].iloc[-6]
            stock_5d_pct = ((close_curr - close_5d) / close_5d) * 100

            spy_5d_pct = MARKET_CONTEXT.get("spy_5d_pct", 0.0)

            # Strong decoupling
            if spy_5d_pct < -0.5 and stock_5d_pct > 0:
                rs_score = 3.0
                rs_note = "🛡️ RS: Strong Decoupling"

            # Clear outperformance
            elif stock_5d_pct > spy_5d_pct + 2.0:
                rs_score = 2.0
                rs_note = "🚀 RS: Outperformer"

            # Relative resilience
            elif stock_5d_pct > spy_5d_pct - 0.5:
                rs_score = 1.0
                rs_note = "🧱 RS: Resilient"

    except Exception as e:
        logging.debug(f"{ticker}: RS calculation warning: {e}")
        rs_score = 0.0
        rs_note = ""

    # ================================================
    # 4. ANALİZ BLOKLARI
    # ================================================
    ctx_1d = analyze_1d_context(df_1d)

    # HARD FILTER
    if ctx_1d.get("1d_score", 0) <= -50:
        return None

    st_1h = analyze_1h_structure(df_1h)
    timing_15m = assess_15m_entry_timing(df_15m, df_1h)

    # Pre-Gap Setup Detection
    now_ny = datetime.now(NY_TZ)
    pre_gap_setup = {"pre_gap": False, "score": 0.0}
    
    # Bot artık 14:30'da çalışıyor, bu yüzden saati 14 olarak güncelliyoruz
    # veya saati kaldırsan da olur çünkü zaten main sadece 14:30'da çalışıyor.
    if now_ny.hour == 14: 
        pre_gap_setup = detect_closing_absorption_setup(df_15m, df_1h)

    # ================================================
    # 5. AĞIRLIKLI SKORLAMA (KURUMSAL DENGELEME)
    # ================================================
    final_score = (
        (rs_score * 1.8) +                           # RS yön verici
        (st_1h.get("1h_score", 0) * 1.1) +          # Para / yapı
        (ctx_1d.get("1d_score", 0) * 1.1) +         # Trend fazı
        (timing_15m.get("timing_score", 0) * 0.5)   # Timing = ince ayar
    )

    if pre_gap_setup.get("pre_gap", False):
        final_score += 1.5

    # Market risk modifiyeri
    risk_modifier = MARKET_CONTEXT.get("risk_modifier", 1.0)
    final_score *= risk_modifier

    # ================================================
    # 6. FİYAT & METRİK HESAPLAMALARI
    # ================================================
    current_price = float(df_15m["Close"].iloc[-1])
    
    # --- 1H & 24H Değişim ---
    change_1h = 0.0
    change_24h = 0.0
    try:
        import math
        
        # 1H Değişim
        if len(df_1h) >= 2:
            prev_1h_close = float(df_1h["Close"].iloc[-2])
            if prev_1h_close > 0:
                change_1h = ((current_price - prev_1h_close) / prev_1h_close) * 100
        
        # 24H Değişim
        if len(df_1d) >= 2:
            prev_1d_close = float(df_1d["Close"].iloc[-2])
            if prev_1d_close > 0:
                change_24h = ((current_price - prev_1d_close) / prev_1d_close) * 100
        
        # NaN / Inf Koruma
        if math.isnan(change_1h) or math.isinf(change_1h):
            change_1h = 0.0
        if math.isnan(change_24h) or math.isinf(change_24h):
            change_24h = 0.0

    except Exception as e:
        logging.debug(f"{ticker}: Change calculation warning: {e}")
        change_1h = 0.0
        change_24h = 0.0
    
    # --- ATR & RVOL ---
    atr_val = float(df_1d["NATR"].iloc[-1])
    atr_abs = float(df_1d["ATR"].iloc[-1])
    rvol = float(df_1h["RVOL"].iloc[-1])
    
    # ================================================
    # 7. ENTRY ZONE & STOP LOSS HESAPLAMA
    # ================================================
    invalidation = ctx_1d.get("invalidation_level", 0)
    
    # Entry Zone (ATR bazlı buffer)
    entry_buffer = atr_abs * 0.5  # ATR'nin yarısı
    entry_low = current_price - entry_buffer
    entry_high = current_price + entry_buffer
    
    # Stop Loss Belirleme
    if invalidation > 0:
        dist_to_invalid = (current_price - invalidation) / current_price
        
        # Invalidation %1-%8 arasındaysa kullan
        if 0.01 < dist_to_invalid < 0.08:
            stop_loss = invalidation * 0.995  # Pivot altı (buffer)
            stop_type = "Structural (Pivot)"
        else:
            # Çok yakın veya çok uzak: ATR kullan
            stop_loss = current_price - (2.0 * atr_abs)
            stop_type = "Volatility (2ATR)"
    else:
        # Invalidation yok: ATR kullan
        stop_loss = current_price - (2.0 * atr_abs)
        stop_type = "Volatility (2ATR)"
    
    # Risk & Target Hesaplama
    risk = current_price - stop_loss
    if risk <= 0:
        risk = current_price * 0.02  # Minimum %2 risk
    
    target_conservative = current_price + (risk * 2.0)  # 2R
    target_aggressive = current_price + (risk * 3.5)    # 3.5R
    
    scenario = {
        "entry_zone": f"{entry_low:.2f} - {entry_high:.2f}",
        "stop_loss": round(stop_loss, 2),
        "stop_type": stop_type,
        "target": round(target_conservative, 2),
        "target_agg": round(target_aggressive, 2),
        "potential_pct": round((target_conservative - current_price) / current_price * 100, 2),
        "rr_ratio": 2.0
    }
    
    # ================================================
    # 8. VOLUME VALIDATION (Multi-Timeframe)
    # ================================================
    setup_type = st_1h.get("setup_type", "NONE")
    
    volume_check = validate_volume_for_setup(setup_type, rvol, ticker)
    
    if not volume_check.get('valid', True):
        # Volume invalid: Score düşür ve not ekle
        final_score -= 2.0
        # Note sonra eklenecek (all_notes'a)

    # ================================================
    # 9. AKSİYON MANTIĞI (KURUMSAL)
    # ================================================
    action = "WATCH"

    if final_score >= 7.0:
        action = "BUY"
        
        # Pre-gap setup override
        if pre_gap_setup.get("pre_gap") and pre_gap_setup.get("score", 0) >= 4.0:
            action = "CLOSE"  # Closing absorption play
    
    # Final filter: Only BUY and CLOSE allowed
    if action not in ["BUY", "CLOSE"]:
        action = "WATCH"

    # ================================================
    # 10. MARKET CAP & SECTOR BİLGİSİ
    # ================================================
    market_cap = 0
    sector = "Unknown"
    
    try:
        import yfinance as yf
        stock = yf.Ticker(ticker)
        info = stock.info
        market_cap = info.get('marketCap', 0)
        sector = info.get('sector', 'Unknown')
    except Exception as e:
        logging.debug(f"{ticker}: Market cap/sector fetch failed: {e}")
        market_cap = 0
        sector = "Unknown"

    # ================================================
    # 11. NOTLARI BİRLEŞTİR
    # ================================================
    all_notes = []
    
    if rs_note:
        all_notes.append(rs_note)
    
    all_notes.extend(ctx_1d.get("1d_notes", []))
    all_notes.extend(st_1h.get("1h_notes", []))
    all_notes.extend(timing_15m.get("notes", []))
    
    if pre_gap_setup.get("pre_gap"):
        all_notes.append("🏦 PRE-GAP BUY")
    
    # Volume warning ekle
    if not volume_check.get('valid', True):
        all_notes.append(f"⚠️ {volume_check.get('message', 'Volume weak')}")

    # ================================================
    # 11.B SAATLİK DURUM (HOURLY STATUS)
    # ================================================
    rsi_val = 50.0
    if "RSI" in df_1h.columns and len(df_1h) > 0:
        rsi_val = float(df_1h["RSI"].iloc[-1])
    elif "Close" in df_1h.columns and len(df_1h) > 14:
        delta = df_1h["Close"].diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
        rs = gain / loss
        rsi_series = 100 - (100 / (1 + rs))
        rsi_val = float(rsi_series.iloc[-1])
        
    rsi_15m_val = 50.0
    if df_15m is not None and not df_15m.empty:
        if "RSI" in df_15m.columns:
            rsi_15m_val = float(df_15m["RSI"].iloc[-1])
        elif "Close" in df_15m.columns and len(df_15m) > 14:
            delta15 = df_15m["Close"].diff()
            gain15 = (delta15.where(delta15 > 0, 0)).rolling(window=14).mean()
            loss15 = (-delta15.where(delta15 < 0, 0)).rolling(window=14).mean()
            rs15 = gain15 / loss15
            rsi_series15 = 100 - (100 / (1 + rs15))
            rsi_15m_val = float(rsi_series15.iloc[-1])

    trend_1h = "FLAT"
    if df_1h is not None and len(df_1h) >= 3:
        if df_1h["Close"].iloc[-1] < df_1h["Close"].iloc[-3] * 0.99:
            trend_1h = "DOWN"
        elif df_1h["Close"].iloc[-1] > df_1h["Close"].iloc[-3] * 1.01:
            trend_1h = "UP"

    hourly_status = evaluate_hourly_status(
        current_price=current_price,
        entry_zone=scenario["entry_zone"],
        target=scenario["target"],
        stop_loss=scenario["stop_loss"],
        rsi_1h=rsi_val,
        rsi_15m=rsi_15m_val,
        trend_1h=trend_1h,
        swing_data=AI_SWING_ZONES.get(ticker)
    )

    # ================================================
    # 12. FINAL ÇIKTI
    # ================================================
    return {
        "symbol": ticker,
        "score": round(final_score, 1),
        "price": round(current_price, 2),
        "action": action,
        "timing": action,
        "source_bucket": "latest",  # Watchlist type
        
        "hourly_action": hourly_status["status"],
        "hourly_msg": hourly_status["msg"],
        
        # Volatility & Volume
        "atr": round(atr_abs, 2),
        "natr": round(atr_val, 2),
        "rvol": round(rvol, 2),
        
        # Performance
        "rs_score": rs_score,
        "change_1h": round(change_1h, 2),
        "change_24h": round(change_24h, 2),

        # Setup
        "setup_type": setup_type,
        "trend_phase": ctx_1d.get("structure", "UNKNOWN"),
        
        # Entry & Risk
        "entry_zone": scenario["entry_zone"],
        "stop_loss": scenario["stop_loss"],
        "stop_type": scenario["stop_type"],
        "target": scenario["target"],
        "potential_pct": scenario["potential_pct"],
        
        # Company Info
        "sector": sector,
        "market_cap": market_cap,

        # Notes
        "notes": all_notes,

        # Pre-gap
        "pre_gap": pre_gap_setup.get("pre_gap", False),
        "pre_gap_score": pre_gap_setup.get("score", 0.0),
    }
    
# ============================================================
# 5) TELEGRAM YAPILANDIRMASI
# ============================================================

# 🔹 Telegram Bildirim Ayarları
TELEGRAM_API_KEY = "8501733970:AAHM1l2wkPRKOWQdtq8jRqWZazGQhYteH5k"
TELEGRAM_CHAT_ID = "-1003569445341"
ENABLE_TELEGRAM_NOTIFICATIONS = True


_TELEGRAM_SESSION: Optional[aiohttp.ClientSession] = None


async def get_telegram_session() -> aiohttp.ClientSession:
    global _TELEGRAM_SESSION
    if _TELEGRAM_SESSION is None or _TELEGRAM_SESSION.closed:
        timeout = aiohttp.ClientTimeout(total=20)
        _TELEGRAM_SESSION = aiohttp.ClientSession(timeout=timeout)
    return _TELEGRAM_SESSION


def tg(text: str) -> str:
    """Telegram HTML sanitizer."""
    if not text:
        return ""

    escaped = html.escape(text)
    allowed = {
        "&lt;b&gt;": "<b>", "&lt;/b&gt;": "</b>",
        "&lt;i&gt;": "<i>", "&lt;/i&gt;": "</i>",
        "&lt;u&gt;": "<u>", "&lt;/u&gt;": "</u>",
        "&lt;code&gt;": "<code>", "&lt;/code&gt;": "</code>",
        "&lt;pre&gt;": "<pre>", "&lt;/pre&gt;": "</pre>",
    }
    for k, v in allowed.items():
        escaped = escaped.replace(k, v)
    return escaped

async def send_pre_gap_telegram(pre_gap_list: list[dict]) -> None:
    if not pre_gap_list:
        return

    msg = (
        "⏰ <b>15:45 PRE-GAP BUY WATCHLIST</b>\n"
        "🏦 Institutional Closing Absorption\n"
        "📌 Action: BUY INTO CLOSE (LIMIT)\n\n"
    )

    for r in pre_gap_list[:8]:
        msg += f"• <b>{r['symbol']}</b> | Score: {r['pre_gap_score']}\n"

    msg += "\n⚠️ Overnight risk – size accordingly."

    await send_telegram_message(msg)


def split_html_safe(text: str, max_len: int = 3900) -> list[str]:
    """Uzun mesajları HTML bozulmadan böler."""
    if len(text) <= max_len:
        return [text]

    parts: list[str] = []
    current: list[str] = []

    for ch in text:
        current.append(ch)
        if len(current) >= max_len:
            parts.append("".join(current))
            current = []

    if current:
        parts.append("".join(current))

    return parts


async def send_telegram_message(message: str) -> None:
    if not ENABLE_TELEGRAM_NOTIFICATIONS:
        return

    safe_text = tg(message)
    parts = split_html_safe(safe_text)
    session = await get_telegram_session()

    url = f"https://api.telegram.org/bot{TELEGRAM_API_KEY}/sendMessage"

    for part in parts:
        try:
            payload = {
                "chat_id": TELEGRAM_CHAT_ID,
                "text": part,
                "parse_mode": "HTML",
                "disable_web_page_preview": True,
            }
            async with session.post(url, data=payload) as resp:
                if resp.status != 200:
                    logging.error(f"Telegram Msg Err: {await resp.text()}")
        except Exception as e:
            logging.error(f"Telegram Connection Err: {e}")


async def send_telegram_photo(photo_path: str, caption: str = "") -> None:
    if not ENABLE_TELEGRAM_NOTIFICATIONS:
        return
    if not os.path.exists(photo_path):
        return

    session = await get_telegram_session()
    url = f"https://api.telegram.org/bot{TELEGRAM_API_KEY}/sendPhoto"

    try:
        with open(photo_path, "rb") as img:
            form = aiohttp.FormData()
            form.add_field("chat_id", TELEGRAM_CHAT_ID)
            form.add_field("caption", tg(caption))
            form.add_field("parse_mode", "HTML")
            form.add_field("photo", img, filename=os.path.basename(photo_path))

            async with session.post(url, data=form) as resp:
                if resp.status != 200:
                    logging.error(f"Telegram Photo Err: {await resp.text()}")

    except Exception as e:
        logging.error(f"Telegram Photo Exception: {e}")


# ============================================================
# 7) PİYASA & SEKTÖR ANALİZİ — KARTAL YUVASI (INSTITUTIONAL CONTEXT)
# ============================================================

MARKET_SEMAPHORE = asyncio.Semaphore(2)

if "SECTOR_ETF_MAP" not in globals():
    SECTOR_ETF_MAP = {
        "Technology": "XLK", "Finance": "XLF", "Energy": "XLE",
        "Healthcare": "XLV", "Consumer Disc": "XLY", "Industrials": "XLI",
        "Utilities": "XLU", "Real Estate": "XLRE", "Materials": "XLB",
        "Comms": "XLC"
    }

async def analyze_market_and_sectors() -> None:
    """
    Kurumsal Piyasa Analizi.
    Amaç:
    1. SPY Trend ve Relative Strength verilerini (5D/20D) hesaplamak.
    2. VIX (Korku Endeksi) ile risk katsayısını belirlemek.
    3. Sektör rotasyonunu (Lider/Geride Kalan) tespit etmek.
    """
    global MARKET_CONTEXT, SECTOR_CONTEXT

    async with MARKET_SEMAPHORE:
        logging.info("🌍 Kurumsal Piyasa ve Sektör Analizi (v3.0)...")

        # =====================================================
        # 1. MARKET REGIME (SPY & VIX)
        # =====================================================
        try:
            # SPY ve VIX verilerini paralel çek
            spy_ticker = yf.Ticker("SPY")
            vix_ticker = yf.Ticker("^VIX")

            spy_hist, vix_hist = await asyncio.gather(
                asyncio.to_thread(spy_ticker.history, period="1y", interval="1d", auto_adjust=True),
                asyncio.to_thread(vix_ticker.history, period="5d", interval="1d", auto_adjust=True)
            )

            # --- SPY ANALİZİ ---
            if len(spy_hist) >= 200:
                close = spy_hist["Close"]
                curr_price = float(close.iloc[-1])
                
                # EMA Hesapları
                ema200 = float(close.ewm(span=200, adjust=False).mean().iloc[-1])
                ema50 = float(close.ewm(span=50, adjust=False).mean().iloc[-1])

                # Performans Metrikleri (RS Hesabı için)
                # 5 Günlük Değişim
                close_5d = close.iloc[-6] if len(close) > 6 else close.iloc[0]
                spy_5d_pct = ((curr_price - close_5d) / close_5d) * 100
                MARKET_CONTEXT["spy_5d_pct"] = spy_5d_pct

                # 20 Günlük Değişim
                close_20d = close.iloc[-21] if len(close) > 21 else close.iloc[0]
                spy_20d_pct = ((curr_price - close_20d) / close_20d) * 100
                MARKET_CONTEXT["spy_20d_pct"] = spy_20d_pct

                # Rejim Belirleme
                if curr_price > ema200:
                    MARKET_CONTEXT["regime"] = "Bull"
                    base_risk = 1.0 if curr_price > ema50 else 0.8
                else:
                    MARKET_CONTEXT["regime"] = "Bear"
                    base_risk = 0.5

            else:
                logging.warning("⚠️ SPY verisi yetersiz.")
                base_risk = 0.5

            # --- VIX ANALİZİ (Korku Ayarı) ---
            if not vix_hist.empty:
                curr_vix = float(vix_hist["Close"].iloc[-1])
                MARKET_CONTEXT["vix_level"] = curr_vix
                
                # VIX < 20: Güvenli (Risk On)
                # VIX > 25: Korku (Risk Off) -> Risk çarpanını düşür
                if curr_vix > 25.0:
                    base_risk *= 0.7
                    logging.info(f"😨 High VIX ({curr_vix:.2f}) -> Risk Reduced")
                elif curr_vix < 15.0:
                    base_risk *= 1.1 # Düşük volatilite, biraz daha agresif olunabilir
            
            MARKET_CONTEXT["risk_modifier"] = round(base_risk, 2)
            logging.info(f"📊 Market: {MARKET_CONTEXT['regime']} | Risk Mod: {MARKET_CONTEXT['risk_modifier']} | SPY 5D: {MARKET_CONTEXT.get('spy_5d_pct',0):.2f}%")

        except Exception as e:
            logging.error(f"🚨 Market Context Error: {e}")

        # =====================================================
        # 2. SECTOR ROTATION
        # =====================================================
        try:
            SECTOR_CONTEXT.clear()
            
            async def _fetch_sector(name, ticker):
                try:
                    etf = yf.Ticker(ticker)
                    h = await asyncio.to_thread(etf.history, period="5d", interval="1d", auto_adjust=True)
                    if len(h) >= 2:
                        chg = ((h["Close"].iloc[-1] - h["Close"].iloc[0]) / h["Close"].iloc[0]) * 100
                        SECTOR_CONTEXT[name] = round(chg, 2)
                except:
                    pass

            tasks = [ _fetch_sector(n, t) for n, t in SECTOR_ETF_MAP.items() ]
            await asyncio.gather(*tasks)
            
            # Liderleri Logla
            sorted_sectors = sorted(SECTOR_CONTEXT.items(), key=lambda x: x[1], reverse=True)
            if sorted_sectors:
                top_str = ", ".join([f"{s[0]}: {s[1]}%" for s in sorted_sectors[:3]])
                logging.info(f"🚀 Sector Leaders (5D): {top_str}")

        except Exception as e:
            logging.error(f"🚨 Sector Analysis Error: {e}")


# ============================================================
# 8) YARDIMCI FONKSİYONLAR & SEÇİM MOTORU
# ============================================================

def get_stock_info(ticker: str) -> Dict[str, Any]:
    """Yahoo Finance'den temel verileri çeker (Cache mekanizmalı)"""
    if "STOCK_INFO_CACHE" not in globals():
        global STOCK_INFO_CACHE
        STOCK_INFO_CACHE = {}

    if ticker in STOCK_INFO_CACHE:
        return STOCK_INFO_CACHE[ticker]

    try:
        info = yf.Ticker(ticker).info
        data = {
            "market_cap": info.get("marketCap", 0),
            "sector": info.get("sector", "Unknown"),
            "beta": info.get("beta", 0),
            "short_float": info.get("shortPercentOfFloat", 0)
        }
        STOCK_INFO_CACHE[ticker] = data
        return data
    except:
        return {"market_cap": 0, "sector": "Unknown", "beta": 0, "short_float": 0}


def select_final_candidates(
    latest_results: List[Dict],
    other_results: List[Dict],
    target_latest: int = 10,
    target_others: int = 20,
    max_per_sector: int = 3
) -> List[Dict]:
    """
    KARTAL YUVASI – Institutional Allocation Engine
    Önce kalite, sonra kaynak, en son sektör dağılımı.
    """

    # -----------------------------
    # 1️⃣ Ön Seçim (Kaynak Bazlı)
    # -----------------------------
    latest_sorted = sorted(latest_results, key=lambda x: x["score"], reverse=True)
    others_sorted = sorted(other_results, key=lambda x: x["score"], reverse=True)

    preselected = []

    for item in latest_sorted[:target_latest]:
        item["source_bucket"] = "latest"
        preselected.append(item)

    for item in others_sorted[:target_others]:
        item["source_bucket"] = "others"
        preselected.append(item)

    # -----------------------------
    # 2️⃣ Global Sıralama (KURUMSAL)
    # -----------------------------
    preselected = sorted(preselected, key=lambda x: x["score"], reverse=True)

    final_list = []
    seen = set() # DEDUPLICATION
    sector_counts = {}

    # weakest latest skorunu referans al (override için)
    latest_scores = [x["score"] for x in preselected if x["source_bucket"] == "latest"]
    weakest_latest_score = min(latest_scores) if latest_scores else 0

    # -----------------------------
    # 3️⃣ Nihai Seçim (20 Latest + 20 Others = 40 Total)
    # -----------------------------
    # Adım 1: Latest listesini koşulsuz ekle (Sektör kotası ve override yok)
    for item in [x for x in preselected if x["source_bucket"] == "latest"]:
        if len(final_list) >= target_latest:
            break
        if item["symbol"] not in seen:
            item["sector_info"] = get_stock_info(item["symbol"]).get("sector", "Unknown")
            final_list.append(item)
            seen.add(item["symbol"])

    # Adım 2: Kalan boşluğu Others listesiyle doldur (Sektör kotası uygulanır)
    for item in [x for x in preselected if x["source_bucket"] == "others"]:
        if len(final_list) >= (target_latest + target_others):
            break
        if item["symbol"] not in seen:
            sector = get_stock_info(item["symbol"]).get("sector", "Unknown")
            sec_count = sector_counts.get(sector, 0)
            
            if sec_count < max_per_sector:
                item["sector_info"] = sector
                final_list.append(item)
                seen.add(item["symbol"])
                sector_counts[sector] = sec_count + 1

    return final_list

def generate_telegram_report(results: List[Dict[str, Any]], limit: int = 10) -> str:
    """Telegram için Kurumsal Rapor Formatı."""
    
    if not results:
        return "🦅 Kartal Yuvası: Uygun kurumsal swing fırsatı bulunamadı."

    # En yüksek skorlu 5'i al (Final listeden)
    top_picks = sorted(results, key=lambda x: x["score"], reverse=True)[:limit]
    
    report = [f"🦅 <b>KARTAL YUVASI v3.3 (SENTIMENT+AI) (INSTITUTIONAL)</b>"]
    report.append(f"📅 {datetime.now().strftime('%d/%m %H:%M')} | 🌍 {MARKET_CONTEXT.get('regime', '-')}\n")

    for i, res in enumerate(top_picks):
        symbol = res['symbol']
        score = res['score']
        price = res['price']
        action = res.get('action', 'WATCH')
        
        # ✅ FIXED Format: Ticker + ACTION + Price + Entry + SL + TP
        entry = res.get('entry_zone', 'N/A')
        sl = res.get('stop_loss', 0)
        tp = res.get('target', 0)
        
        block = (
            f"{i+1}. <b>{symbol}</b> | {action}\n"
            f"   💰 Price: ${price}\n"
            f"   🟢 Entry: {entry}\n"
            f"   🛑 SL: ${sl}\n"
            f"   🎯 TP: ${tp}\n"
        )
        report.append(block)

    report.append(f"👉 <i>Detaylar Dashboard'da.</i>")
    return "\n".join(report)


def save_json_for_dashboard(results: List[Dict[str, Any]]):
    """
    Dashboard için genişletilmiş JSON çıktısı.
    Yeni alanlar: NATR, RS Score, Setup Type, Source Bucket.
    """
    import os
    
    # Son bir sıralama (Dashboard'da en iyiler üstte görünsün)
    sorted_results = sorted(results, key=lambda x: x["score"], reverse=True)
    
    export_data = {
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "market_regime": MARKET_CONTEXT.get("regime", "Unknown"),
        "sector_leaders": list(SECTOR_CONTEXT.keys())[:3],
        "vix_level": MARKET_CONTEXT.get("vix_level", 0),
        "candidates": []
    }

    seen_tickers = set()

    for res in sorted_results:
        ticker = res["symbol"]
        
        # --- STRICT DEDUPLICATION ---
        if ticker in seen_tickers:
            continue
        seen_tickers.add(ticker)

        # Fundamental Veri
        fund = get_stock_info(ticker)
        
        # Helper for robust float conversion
        def safe_float(val, default=0.0):
            try:
                f = float(val)
                import math
                if math.isnan(f) or math.isinf(f): return default
                return f
            except: return default

        item = {
            "ticker": ticker,
            "score": safe_float(res["score"]),
            "price": safe_float(res["price"]),
            "current_price": safe_float(res["price"]),
            
            # --- INSTITUTIONAL METRICS ---
            "action": res.get("action", "WATCH"),
            "timing": res.get("action", "WATCH"),
            "source_bucket": res.get("source_bucket", "unknown"),
            
            "change_1h": safe_float(res.get("change_1h")),
            "change_24h": safe_float(res.get("change_24h")),
            
            "atr": safe_float(res.get("atr")),
            "natr": safe_float(res.get("natr")),   # Yeni: Volatilite Kalitesi
            "atr_pct": safe_float(res.get("natr")), # DATA ENGINE UYUMU İÇİN
            "rvol": safe_float(res.get("rvol")),
            "rs_score": safe_float(res.get("rs_score")), 
            
            "setup": res.get("setup_type", "NONE"),
            "trend_phase": res.get("trend_phase", "UNKNOWN"),
            
            "entry_zone": str(res.get("entry_zone", "-")),
            "stop_loss": safe_float(res.get("stop_loss")),
            "stop_type": res.get("stop_type", "Vol"),
            "target": safe_float(res.get("target")),
            "potential_pct": safe_float(res.get("potential_pct")),
            
            "sector": fund.get("sector", "Unknown"),
            "market_cap": safe_float(fund.get("market_cap")),
            "notes": res.get("notes", [])
        }
        export_data["candidates"].append(item)

    try:
        if not os.path.exists(WATCHLIST_DIR): os.makedirs(WATCHLIST_DIR, exist_ok=True)
        json_path = os.path.join(WATCHLIST_DIR, "bot_analysis_latest.json")
        
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(export_data, f, indent=4)
            
        logging.info(f"💾 Dashboard JSON Saved: {json_path} ({len(export_data['candidates'])} items)")
    except Exception as e:
        logging.error(f"❌ JSON Save Error: {e}")

def save_to_setup_folder(results: List[Dict[str, Any]]):
    """
    Belirtilen klasöre versiyonlu ve detaylı JSON kaydı yapar.
    Format: date + sembol + sector + action + price + entry zone + SL + TP
    """
    SETUP_DIR = r"C:\Users\afksm\.gemini\antigravity\scratch\financial_tracker\watchlists\setup"
    if not os.path.exists(SETUP_DIR):
        os.makedirs(SETUP_DIR, exist_ok=True)

    now = datetime.now()
    date_str = now.strftime("%Y%m%d")
    
    # Versiyon kontrolü (v1, v2...)
    version = 1
    while os.path.exists(os.path.join(SETUP_DIR, f"{date_str}_v{version}.json")):
        version += 1
    
    file_name = f"{date_str}_v{version}.json"
    full_path = os.path.join(SETUP_DIR, file_name)

    export_list = []
    for res in results:
        # İstenen spesifik alanları map et
        item = {
            "date": now.strftime("%Y-%m-%d %H:%M"),
            "symbol": res.get("symbol"),
            "sector": res.get("sector", "Unknown"),
            "action": res.get("action", "BUY"),
            "price": res.get("price"),
            "entry_zone": res.get("entry_zone"),
            "SL": res.get("stop_loss"),
            "TP": res.get("target")
        }
        export_list.append(item)

    with open(full_path, "w", encoding="utf-8") as f:
        json.dump(export_list, f, indent=4)
    
    logging.info(f"✅ SETUP JSON KAYDEDİLDİ: {file_name} ({len(export_list)} hisse)")

def save_txt_for_archive(results: List[Dict[str, Any]]):
    """
    Agresif botuna benzer şekilde TXT formatında arşiv kaydı yapar.
    """
    INDAY_DIR = os.path.join(WATCHLIST_DIR, "inday")
    if not os.path.exists(INDAY_DIR):
        os.makedirs(INDAY_DIR, exist_ok=True)

    now = datetime.now()
    date_tag = now.strftime("%Y%m%d")
    
    daily_path = os.path.join(INDAY_DIR, f"inday_{date_tag}.txt")
    rolling_path = os.path.join(INDAY_DIR, "inday_rolling.txt")

    tickers = [res.get("symbol") for res in results if res.get("symbol")]

    if not tickers:
        return

    # Günlük dosya
    with open(daily_path, "w", encoding="utf-8") as f:
        f.write(f"# INDAY Swing Watchlist - {now.strftime('%Y-%m-%d %H:%M')}\n")
        for t in tickers:
            f.write(f"{t}\n")
            
    # Rolling dosya
    with open(rolling_path, "a", encoding="utf-8") as f:
        f.write(f"\n# --- {now.strftime('%Y-%m-%d')} ---\n")
        for t in tickers:
            f.write(f"{t}\n")

    logging.info(f"✅ INDAY TXT ARŞİV KAYDEDİLDİ: {daily_path}")
    
# ============================================================
# 9) MAIN EXECUTION & SCHEDULER
# ============================================================

async def send_pre_gap_telegram(pre_gap_list: list[dict]) -> None:
    if not pre_gap_list: return
    msg = "⏰ <b>15:45 PRE-GAP BUY ALERT</b>\n🏦 Institutional Closing Absorption\n\n"
    for r in pre_gap_list[:5]:
        msg += f"• <b>{r['symbol']}</b> | Score: {r['pre_gap_score']}\n"
    await send_telegram_message(msg)

def filter_pre_gap_candidates(results: list[dict]) -> list[dict]:
    return [r for r in results if r.get("pre_gap") is True and r.get("pre_gap_score", 0) >= 4.0]

# --- Telegram Helper Functions (Placeholder - Previous implementations assumed) ---
# Assuming send_telegram_message and related logic exists from previous context
# if not, they should be kept as they were in the original file.


# ============================================================
# 📊 MAIN FUNCTION - KARTAL YUVASI v3.5 SWING ENGINE
# ============================================================

def save_hourly_portfolio_json(results: list[dict]):
    """
    Boga AI - Saatlik 25 Hisselik Portföy Durum Raporu
    """
    import os
    import json
    
    WATCHLIST_DIR = r"C:\Users\afksm\.gemini\antigravity\scratch\financial_tracker\watchlists"
    
    export_data = {
        "timestamp_ny": datetime.now(NY_TZ).strftime("%Y-%m-%d %H:%M:%S"),
        "total_tracked": len(results),
        "portfolio_status": []
    }
    
    # Listeyi aksiyona göre önceliklendir (Alım Bölgesi ve Satış Yap olanlar üstte görünsün)
    for res in sorted(results, key=lambda x: x.get("score", 0), reverse=True):
        item = {
            "symbol": res.get("symbol"),
            "price": res.get("price"),
            "hourly_action": res.get("hourly_action", "UNKNOWN"),
            "directive_msg": res.get("hourly_msg", ""),
            "entry_zone": res.get("entry_zone"),
            "stop_loss": res.get("stop_loss"),
            "take_profit": res.get("target"),
            "boga_score": res.get("score"),
            "change_24h": res.get("change_24h"),
            "volume_profile": res.get("rvol")
        }
        export_data["portfolio_status"].append(item)
        
    try:
        json_path = os.path.join(WATCHLIST_DIR, "boga_hourly_portfolio.json")
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(export_data, f, indent=4, ensure_ascii=False)
        logging.info(f"💾 Saatlik Portföy JSON Kaydedildi: {json_path}")
        
        # Frontend'e kopyala ve Github'a pushla
        import shutil
        import subprocess
        frontend_dst = r"C:\Users\afksm\finma\frontend\public\data\boga_hourly_portfolio.json"
        os.makedirs(os.path.dirname(frontend_dst), exist_ok=True)
        shutil.copy2(json_path, frontend_dst)
        logging.info(f"✅ Saatlik JSON Frontend'e kopyalandı.")
        
        finma_dir = r"C:\Users\afksm\finma"
        subprocess.run(["git", "add", "frontend/public/data/boga_hourly_portfolio.json"], cwd=finma_dir)
        subprocess.run(["git", "commit", "-m", f"Hourly update: {export_data['timestamp_ny']}"], cwd=finma_dir)
        subprocess.run(["git", "push", "origin", "main"], cwd=finma_dir)
        logging.info("✅ Saatlik güncelleme Github'a iletildi (Vercel deploy tetiklenecek).")
        
    except Exception as e:
        logging.error(f"❌ Saatlik JSON kayıt/senk hatası: {e}")

async def main():
    """
Ana tarama fonksiyonu
    Çalışma zamanı: Sadece 14:30
    """
    global LAST_PRE_GAP_ALERT_DATE

    print("\n" + "=" * 60)
    
    # 1️⃣ SESSION AYARI (Sabit 14:30)
    now_ny = datetime.now(NY_TZ)
    session_name = "CRITICAL (14:30)" 
    
    print(f"🦅 KARTAL YUVASI v3.5 - {session_name} SESSION")
    print(f"⏰ Time: {now_ny.strftime('%Y-%m-%d %H:%M')}")
    print("=" * 60 + "\n")

    # ================================================
    # 1️⃣ Market & Sector Analysis
    # ================================================
    await analyze_market_and_sectors()

    # ================================================
    # 2️⃣ Load Watchlists
    # ================================================
    latest_universe = load_latest_universe_from_txt()
    manual_universe = load_manual_universe_from_txt()
    rolling_universe = load_rolling_universe_from_txt()

    if not latest_universe and not manual_universe and not rolling_universe:
        print("❌ All watchlists are empty.")
        await send_telegram_message("❌ Watchlist boş, tarama yapılamadı")
        return

    print(f"\n📊 Watchlists Loaded:")
    print(f"   • Latest: {len(latest_universe)} tickers")
    print(f"   • Manual: {len(manual_universe)} tickers")
    print(f"   • Rolling: {len(rolling_universe)} tickers")
    print(f"   • Total: {len(latest_universe) + len(manual_universe) + len(rolling_universe)} tickers\n")

    # ================================================
    # 3️⃣ Scan All Universes
    # ================================================
    results = []
    chunk_size = 10

    async def scan_universe(universe, source_name):
        """Helper: Scan a watchlist in chunks"""
        nonlocal results
        for i in range(0, len(universe), chunk_size):
            chunk = universe[i:i + chunk_size]
            tasks = [process_single_stock(sym) for sym in chunk]
            chunk_results = await asyncio.gather(*tasks)
            
            for r in chunk_results:
                if r:
                    r["source"] = source_name  # Track source
                    results.append(r)
            
            print(f"   {source_name.upper()}: {min(i + chunk_size, len(universe))}/{len(universe)}", end="\r")
            await asyncio.sleep(0.5)
        print()

    # Scan all watchlists
    if latest_universe:
        await scan_universe(latest_universe, "latest")
    if manual_universe:
        await scan_universe(manual_universe, "manual")
    if rolling_universe:
        await scan_universe(rolling_universe, "rolling")

    print(f"\n✅ Scan Complete. Raw Candidates: {len(results)}")

    # ================================================
    # 4️⃣ Smart Candidate Selection
    # ================================================
    latest_results = [r for r in results if r.get("source") == "latest"]
    other_results = [r for r in results if r.get("source") in ("manual", "rolling")]
    
    # Allocation targets (boosted for Critical session)
    t_latest = 20 if session_name == "CRITICAL (14:30)" else 10
    t_others = 20
    
    if session_name == "CRITICAL (14:30)":
        logging.info("🔥 CRITICAL SESSION: Boosting Latest allocations to 20")
    
    final_results = select_final_candidates(
        latest_results=latest_results,
        other_results=other_results,
        target_latest=t_latest,
        target_others=t_others,
        max_per_sector=3
    )
    
    # Deduplication (safety check)
    unique_map = {}
    for r in final_results:
        symbol = r.get("symbol")
        if symbol and symbol not in unique_map:
            unique_map[symbol] = r
    
    final_results = list(unique_map.values())
    
    print(
        f"\n📊 Final Selection:\n"
        f"   📌 Latest: {len([r for r in final_results if r.get('source_bucket')=='latest'])}\n"
        f"   📌 Others: {len([r for r in final_results if r.get('source_bucket')=='others'])}\n"
        f"   👉 Total: {len(final_results)}"
    )

    # ================================================
    # 5️⃣ AI PIPELINE (3-STAGE)
    # ================================================
    print("\n" + "=" * 60)
    print("🎯 3-STAGE AI SELECTION PIPELINE")
    print("=" * 60)
    
    # ------------------------------------------------
    # STAGE 1: Selection Preparation (10 Latest + 10 Others)
    # ------------------------------------------------
    print(f"\n📊 STAGE 1: SELECTION (10 Latest + 10 Others)")
    
    latest_sorted = sorted([c for c in final_results if c.get('source_bucket') == 'latest'], key=lambda x: x['score'], reverse=True)
    others_sorted = sorted([c for c in final_results if c.get('source_bucket') == 'others'], key=lambda x: x['score'], reverse=True)
    
    ai_candidates = []
    
    # Select Top 20 from Latest (Latest listesinin tamamı)
    ai_candidates.extend(latest_sorted[:20])
    
    # Select Top 20 from Others
    ai_candidates.extend(others_sorted[:20])
    
    print(f"   Selected {len(ai_candidates)} candidates for AI Analysis.")
    if not ai_candidates:
        print("⚠️ No candidates available.")
        save_json_for_dashboard(final_results)
        return
    
    # ------------------------------------------------
    # STAGE 2: Sentiment Enrichment
    # ------------------------------------------------
    print(f"\n📊 STAGE 2: SENTIMENT ENRICHMENT")
    
    try:
        enriched_candidates = await enrich_candidates_batch(
            ai_candidates,
            max_concurrent=5
        )
        print(f"   ✅ Sentiment enrichment complete ({len(enriched_candidates)} candidates)")
    except Exception as e:
        logging.error(f"Sentiment enrichment failed: {e}")
        enriched_candidates = ai_candidates  # Fallback
        print(f"   ⚠️ Sentiment enrichment failed, continuing without sentiment")
    
    # ------------------------------------------------
    # STAGE 2.5: Real-Time Validation (NEW)
    # ------------------------------------------------
    print(f"\n📊 STAGE 2.5: REAL-TIME VALIDATION")
    print(f"   Validating volume & entry zones for {len(enriched_candidates)} candidates...")
    
    for candidate in enriched_candidates:
        symbol = candidate.get('symbol')
        
        # Get real-time data
        rt_data = get_realtime_price_and_volume(symbol)
        
        if rt_data:
            # Add real-time fields
            candidate['realtime_price'] = rt_data['price']
            candidate['volume_ratio'] = rt_data.get('volume_ratio', 1.0)
            candidate['intraday_momentum'] = rt_data.get('weekly_change_pct', 0.0)  # Swing: weekly not intraday
            candidate['trend_direction'] = rt_data.get('trend', 'UNKNOWN')
            candidate['data_age'] = 0  # Daily data
            
            # Validate entry zone
            entry_check = validate_entry_zone(
                rt_data['price'],
                candidate.get('entry_zone', 'N/A')
            )
            candidate['entry_status'] = entry_check['status']
            candidate['entry_message'] = entry_check['message']
            
            # Validate volume (with 15m/1h trend check)
            volume_check = validate_volume_for_setup(
                candidate.get('setup_type', 'NONE'),
                rt_data.get('volume_ratio', 1.0),
                ticker=symbol  # Enable trend check
            )
            candidate['volume_valid'] = volume_check['valid']
            candidate['volume_message'] = volume_check['message']
            
            # Status output
            status_emoji = "✅" if entry_check['status'] == 'VALID' and volume_check['valid'] else "⚠️"
            print(f"   {status_emoji} {symbol}: Vol {rt_data.get('volume_ratio', 0):.1f}x, Entry {entry_check['status']}")
        else:
            # Fallback if real-time fails
            candidate['realtime_price'] = candidate.get('price', 0)
            candidate['volume_ratio'] = 1.0
            candidate['intraday_momentum'] = 0.0
            candidate['trend_direction'] = 'UNKNOWN'
            candidate['entry_status'] = 'UNKNOWN'
            candidate['entry_message'] = 'Real-time data unavailable'
            candidate['volume_valid'] = True  # Don't filter
            candidate['volume_message'] = 'N/A'
            print(f"   ⚠️ {symbol}: Real-time data failed")
    
    # Filter based on validation (RELAXED FOR AI ANALYSIS)
    # We want to send candidates to AI even if technicals are slightly off, 
    # to let Gemini find potential setups (e.g. Pullbacks).
    # Only filter completely INVALIDATED ones if strictly necessary, but for now we pass ALL.
    
    warnings_count = 0
    for c in enriched_candidates:
         if c.get('entry_status') in ['INVALIDATED', 'EXTENDED'] or not c.get('volume_valid', True):
             warnings_count += 1
    
    print(f"   ℹ️ Real-time validation: {warnings_count} candidates have technical warnings but will be sent to AI.")
    # enriched_candidates = [ ... ] # FILTER DISABLED
    
    print(f"   ✅ {len(enriched_candidates)} candidates ready for AI analysis")
    
    if not enriched_candidates:
        print("⚠️ No candidates remain after real-time validation")
        save_json_for_dashboard(final_results)
        return
    
    # ================================================
    # STAGE 3: AI FINAL SELECTION (GEMINI) - KALDIRILDI
    # ================================================
    final_results = enriched_candidates
    
    print(f"\n✅ Saatlik değerlendirme tamamlandı. {len(final_results)} hisse işlendi.")

    # ================================================
    # 6️⃣ Save Data (Setup Folder & Dashboard)
    # ================================================
    # 🟢 SENİN EKLEDİĞİN FONKSİYONU BURADA ÇAĞIRIYORUZ:
    try:
        save_to_setup_folder(final_results)
        save_txt_for_archive(final_results)
    except Exception as e:
        logging.error(f"Archive export error: {e}")
        
    # ================================================
    # 6️⃣ Save Dashboard JSON & Hourly Export
    # ================================================
    save_json_for_dashboard(final_results)
    save_hourly_portfolio_json(final_results)

    # ================================================
    # 7️⃣ Pre-Gap Alert (Artık 14:30 taramasında çalışacak)
    # ================================================
    # Saat kontrolünü kaldırdık, her taramada kontrol etsin:
    if LAST_PRE_GAP_ALERT_DATE != now_ny.date():
        pre_gap_list = filter_pre_gap_candidates(final_results)
        if pre_gap_list:
            await send_pre_gap_telegram(pre_gap_list)
            LAST_PRE_GAP_ALERT_DATE = now_ny.date()
            print("✅ Pre-Gap Alert sent (14:30 Check)")

    # ================================================
    # 8️⃣ Console Preview
    # ================================================
    preview = generate_telegram_report(final_results, limit=5)
    clean_preview = preview.replace("<b>", "").replace("</b>", "").replace("<i>", "").replace("</i>", "")
    print("\n" + "-" * 60)
    print(clean_preview)
    print("-" * 60 + "\n")

# ============================================================
# 📅 SCHEDULER FUNCTIONS
# ============================================================

async def scan_top_stocks():
    """Wrapper for main scan with error handling"""
    try:
        await main()
    except Exception as e:
        logging.exception("Scan Error")
        await send_telegram_message(f"❌ Scan Error: {e}")


def get_next_run_time_ny() -> datetime:
    """
    Boga Finance AI - Saatlik Döngü (10:00 - 16:00 arası)
    """
    now = datetime.now(NY_TZ).replace(second=0, microsecond=0)
    
    # Piyasa saatleri içinde saat başı tarama
    SCHEDULE = [(10, 0), (11, 0), (12, 0), (13, 0), (14, 0), (15, 0), (16, 0)]
    
    for hour, minute in SCHEDULE:
        target = now.replace(hour=hour, minute=minute)
        if target > now:
            return target
    
    # Bugünün seans saatleri bittiyse, bir sonraki iş günü saat 10:00'a ayarla
    next_day = now + timedelta(days=1)
    while next_day.weekday() >= 5: # Hafta sonunu atla
        next_day += timedelta(days=1)
    
    return next_day.replace(hour=SCHEDULE[0][0], minute=SCHEDULE[0][1])


async def run_scheduler():
    """
    Main scheduler loop
    - Runs on startup
    - Then runs ONLY at 14:30 NY
    """
    print("\n🦅 KARTAL YUVASI v3.5 (SWING TRADE ENGINE) ONLINE")
    await send_telegram_message(
        "🦅 <b>KARTAL YUVASI v3.5</b> Online!\n"
        "📊 Swing Trade Mode\n"
        "⏰ Schedule: DAILY 14:30 NY ONLY"
    )
    
    # Run immediately on startup
    try:
        print("\n🚀 Initial scan on startup...")
        await scan_top_stocks()
    except Exception as e:
        logging.error(f"Startup scan error: {e}")
    
    # Main scheduler loop
    while True:
        try:
            # ... (geri kalan kod aynı kalacak, sadece yukarıdaki print değişti)
            # Calculate next run time
            next_run = get_next_run_time_ny().astimezone(timezone.utc)
            wait_seconds = (next_run - datetime.now(timezone.utc)).total_seconds()
            
            if wait_seconds < 0: wait_seconds = 60
            
            wait_hours = wait_seconds / 3600
            next_run_ny = next_run.astimezone(NY_TZ)
            
            logging.info(f"💤 Next scan: {next_run_ny.strftime('%Y-%m-%d %H:%M')} NY ({wait_hours:.1f}h wait)")
            
            await asyncio.sleep(wait_seconds)
            
            logging.info("⏰ Scheduled scan starting...")
            await scan_top_stocks()
            
        except Exception as e:
            logging.error(f"Scheduler error: {e}")
            await asyncio.sleep(1800)

# ============================================================
# 🚀 ENTRY POINT
# ============================================================

if __name__ == "__main__":
    import sys
    import io
    
    # UTF-8 encoding for Windows console
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')
    
    # Windows event loop policy
    if os.name == 'nt':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    
    try:
        # Check for force mode
        if "--force" in sys.argv or "--force-ai" in sys.argv:
            print("🔥 Force mode: Running immediate scan...")
            asyncio.run(scan_top_stocks())
        else:
            print("📅 Scheduler mode: Running on schedule (DAILY 14:30 NY ONLY)")
            asyncio.run(run_scheduler())
    except KeyboardInterrupt:
        print("\n⏹️  Stopped by user")