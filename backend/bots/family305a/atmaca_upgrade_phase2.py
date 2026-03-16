# ============================================================
# ATMACA BOT - PHASE 2: ADVANCED FEATURES
# Catalyst Detection + Sector Rotation + Volume Analysis
# ============================================================

import logging
import asyncio
import aiohttp
from datetime import datetime, timedelta
from typing import Optional, Dict, List, Tuple
import yfinance as yf
import pandas as pd
import numpy as np
from zoneinfo import ZoneInfo


# ============================================================
# 1. CATALYST DETECTION ENGINE - Sessiz Katalyzörleri Tespit Et
# ============================================================

def check_insider_buying(ticker: str, months_lookback: int = 6) -> Dict:
    """
    Insider trading (CEO/CFO alımları) tespit eder.
    
    Neden Önemli:
    - Insider alımı = Yönetim hisseye güveniyor (bullish sinyal)
    - $1M+ alım = Güçlü katalyzör (artı puan hak ediyor)
    
    Returns:
        {
            'has_insider_buying': bool,
            'total_value': float,
            'transaction_count': int,
            'bonus_score': float,
            'message': str
        }
    """
    try:
        stock = yf.Ticker(ticker)
        insider_txns = stock.insider_transactions
        
        if insider_txns is None or insider_txns.empty:
            return {
                'has_insider_buying': False,
                'total_value': 0,
                'transaction_count': 0,
                'bonus_score': 0.0,
                'message': 'No insider data'
            }
        
        # Son N ay içindeki BUY işlemlerini filtrele
        cutoff_date = datetime.now() - timedelta(days=months_lookback * 30)
        
        recent_buys = insider_txns[
            (insider_txns['Transaction'].str.contains('Buy', case=False, na=False)) &
            (pd.to_datetime(insider_txns['Date']) >= cutoff_date)
        ]
        
        if recent_buys.empty:
            return {
                'has_insider_buying': False,
                'total_value': 0,
                'transaction_count': 0,
                'bonus_score': 0.0,
                'message': 'No recent insider buying'
            }
        
        # Toplam alım değeri
        total_value = recent_buys['Value'].sum()
        txn_count = len(recent_buys)
        
        # Bonus puan hesapla
        bonus_score = 0.0
        message = ""
        
        if total_value >= 5_000_000:  # $5M+ mega alım
            bonus_score = 2.0
            message = f"🔥 MEGA Insider Buy: ${total_value/1e6:.1f}M ({txn_count} işlem)"
        elif total_value >= 1_000_000:  # $1M+ güçlü alım
            bonus_score = 1.5
            message = f"🔥 Insider Buy: ${total_value/1e6:.1f}M ({txn_count} işlem)"
        elif total_value >= 500_000:  # $500K+ orta alım
            bonus_score = 1.0
            message = f"💼 Insider Buy: ${total_value/1e3:.0f}K ({txn_count} işlem)"
        else:
            bonus_score = 0.5
            message = f"📊 Minor Insider Buy: ${total_value/1e3:.0f}K"
        
        logging.info(f"🔥 {ticker} - {message}")
        
        return {
            'has_insider_buying': True,
            'total_value': total_value,
            'transaction_count': txn_count,
            'bonus_score': bonus_score,
            'message': message
        }
        
    except Exception as e:
        logging.debug(f"Insider buying check hatası {ticker}: {e}")
        return {
            'has_insider_buying': False,
            'total_value': 0,
            'transaction_count': 0,
            'bonus_score': 0.0,
            'message': 'Check failed'
        }


def check_short_squeeze_setup(info: dict, ticker: str) -> Dict:
    """
    Short squeeze potential tespit eder.
    
    Kritik Metrikler:
    1. Short Float >20% = Yüksek short interest
    2. Short Ratio (Days to Cover) >5 = Squeeze riski
    3. İkisi birlikte = Potansiyel squeeze setup
    
    Returns:
        {
            'has_squeeze_potential': bool,
            'short_float': float,
            'days_to_cover': float,
            'bonus_score': float,
            'message': str
        }
    """
    try:
        short_pct = info.get('shortPercentOfFloat', 0)
        days_to_cover = info.get('shortRatio', 0)  # Days to Cover
        
        # Short Float kontrolü
        if short_pct == 0:
            return {
                'has_squeeze_potential': False,
                'short_float': 0,
                'days_to_cover': 0,
                'bonus_score': 0.0,
                'message': 'No short data'
            }
        
        bonus_score = 0.0
        message = ""
        has_potential = False
        
        # Squeeze Kriterleri
        if short_pct > 0.25 and days_to_cover > 7:  # Extreme squeeze
            bonus_score = 2.0
            message = f"⚡ EXTREME Short Squeeze Risk: {short_pct*100:.1f}% float, {days_to_cover:.1f}d cover"
            has_potential = True
            
        elif short_pct > 0.20 and days_to_cover > 5:  # Strong squeeze
            bonus_score = 1.5
            message = f"⚡ Strong Short Squeeze: {short_pct*100:.1f}% float, {days_to_cover:.1f}d cover"
            has_potential = True
            
        elif short_pct > 0.20:  # High short interest
            bonus_score = 1.0
            message = f"⚡ High Short Interest: {short_pct*100:.1f}% float"
            has_potential = True
            
        elif short_pct > 0.15:  # Moderate
            bonus_score = 0.5
            message = f"📊 Moderate Short: {short_pct*100:.1f}% float"
        
        if has_potential:
            logging.info(f"⚡ {ticker} - {message}")
        
        return {
            'has_squeeze_potential': has_potential,
            'short_float': short_pct,
            'days_to_cover': days_to_cover,
            'bonus_score': bonus_score,
            'message': message
        }
        
    except Exception as e:
        logging.debug(f"Short squeeze check hatası {ticker}: {e}")
        return {
            'has_squeeze_potential': False,
            'short_float': 0,
            'days_to_cover': 0,
            'bonus_score': 0.0,
            'message': 'Check failed'
        }


def check_institutional_strength(info: dict, ticker: str) -> Dict:
    """
    Kurumsal sahiplik gücünü kontrol eder.
    
    Profesyonel Logic:
    - 70%+ institutional = Güçlü kurumsal destek
    - 80%+ = Mega kurumsal (hedge fund favori)
    - Ancak 95%+ = Float çok düşük (volatilite riski)
    
    Returns:
        {
            'is_strong': bool,
            'institutional_pct': float,
            'bonus_score': float,
            'message': str
        }
    """
    try:
        inst_pct = info.get('heldPercentInstitutions', 0)
        
        if inst_pct == 0:
            return {
                'is_strong': False,
                'institutional_pct': 0,
                'bonus_score': 0.0,
                'message': 'No institutional data'
            }
        
        bonus_score = 0.0
        message = ""
        is_strong = False
        
        if inst_pct > 0.95:  # Çok yüksek (risk var)
            bonus_score = 0.0
            message = f"⚠️ Extreme Institutional: {inst_pct*100:.1f}% (float riski)"
            
        elif inst_pct > 0.80:  # Mega kurumsal
            bonus_score = 1.0
            message = f"🏦 Mega Institutional: {inst_pct*100:.1f}%"
            is_strong = True
            
        elif inst_pct > 0.70:  # Güçlü kurumsal
            bonus_score = 0.7
            message = f"🏦 Strong Institutional: {inst_pct*100:.1f}%"
            is_strong = True
            
        elif inst_pct > 0.60:  # İyi kurumsal
            bonus_score = 0.5
            message = f"🏦 Good Institutional: {inst_pct*100:.1f}%"
            is_strong = True
        
        if is_strong:
            logging.debug(f"🏦 {ticker} - {message}")
        
        return {
            'is_strong': is_strong,
            'institutional_pct': inst_pct,
            'bonus_score': bonus_score,
            'message': message
        }
        
    except Exception as e:
        logging.debug(f"Institutional check hatası {ticker}: {e}")
        return {
            'is_strong': False,
            'institutional_pct': 0,
            'bonus_score': 0.0,
            'message': 'Check failed'
        }


def check_analyst_consensus(info: dict, ticker: str) -> Dict:
    """
    Analyst consensus (Strong Buy/Buy/Hold) kontrol eder.
    
    Returns:
        {
            'recommendation': str,
            'bonus_score': float,
            'message': str
        }
    """
    try:
        recommendation = info.get('recommendationKey', '').lower()
        
        bonus_map = {
            'strong_buy': (1.5, "📈 Strong Buy Consensus"),
            'buy': (1.0, "📈 Buy Consensus"),
            'hold': (0.0, "📊 Hold Consensus"),
            'sell': (-0.5, "📉 Sell Consensus"),
            'strong_sell': (-1.0, "📉 Strong Sell Consensus")
        }
        
        bonus_score, message = bonus_map.get(recommendation, (0.0, "No consensus"))
        
        if bonus_score > 0:
            logging.debug(f"📈 {ticker} - {message}")
        
        return {
            'recommendation': recommendation,
            'bonus_score': bonus_score,
            'message': message
        }
        
    except Exception as e:
        logging.debug(f"Analyst check hatası {ticker}: {e}")
        return {
            'recommendation': 'unknown',
            'bonus_score': 0.0,
            'message': 'Check failed'
        }


def check_upcoming_dividend(info: dict, ticker: str) -> Dict:
    """
    Ex-dividend date yakınsa tespit eder.
    
    Logic:
    - Ex-dividend 10 gün içindeyse = Dividend capture play olabilir
    - Yüksek yield (>3%) = Daha çekici
    
    Returns:
        {
            'has_upcoming_dividend': bool,
            'days_until': int,
            'dividend_yield': float,
            'bonus_score': float,
            'message': str
        }
    """
    try:
        ex_div_date = info.get('exDividendDate', None)
        div_yield = info.get('dividendYield', 0)
        
        if not ex_div_date or ex_div_date == 0:
            return {
                'has_upcoming_dividend': False,
                'days_until': 0,
                'dividend_yield': 0,
                'bonus_score': 0.0,
                'message': 'No dividend'
            }
        
        # Unix timestamp'ı datetime'a çevir
        ex_div_dt = datetime.fromtimestamp(ex_div_date, tz=ZoneInfo("America/New_York"))
        now = datetime.now(ZoneInfo("America/New_York"))
        
        days_until = (ex_div_dt - now).days
        
        # 10 gün içinde ex-dividend
        if 0 < days_until <= 10:
            bonus_score = 0.5 if div_yield > 0.03 else 0.3
            message = f"💰 Ex-Div in {days_until}d: Yield {div_yield*100:.2f}%"
            
            logging.info(f"💰 {ticker} - {message}")
            
            return {
                'has_upcoming_dividend': True,
                'days_until': days_until,
                'dividend_yield': div_yield,
                'bonus_score': bonus_score,
                'message': message
            }
        
        return {
            'has_upcoming_dividend': False,
            'days_until': days_until,
            'dividend_yield': div_yield,
            'bonus_score': 0.0,
            'message': f'Ex-Div {days_until}d away'
        }
        
    except Exception as e:
        logging.debug(f"Dividend check hatası {ticker}: {e}")
        return {
            'has_upcoming_dividend': False,
            'days_until': 0,
            'dividend_yield': 0,
            'bonus_score': 0.0,
            'message': 'Check failed'
        }


def check_silent_catalysts(ticker: str, info: dict) -> Dict:
    """
    TÜM katalyzörleri bir araya getirir ve toplam skoru hesaplar.
    
    Returns:
        {
            'has_catalyst': bool,
            'catalyst_score': float,  # Toplam bonus puan (max 5.0)
            'catalyst_reasons': list,
            'details': dict
        }
    """
    catalysts = []
    total_score = 0.0
    details = {}
    
    # 1. Insider Buying
    insider_data = check_insider_buying(ticker)
    if insider_data['has_insider_buying']:
        catalysts.append(insider_data['message'])
        total_score += insider_data['bonus_score']
        details['insider_buying'] = insider_data
    
    # 2. Short Squeeze
    short_data = check_short_squeeze_setup(info, ticker)
    if short_data['has_squeeze_potential']:
        catalysts.append(short_data['message'])
        total_score += short_data['bonus_score']
        details['short_squeeze'] = short_data
    
    # 3. Institutional
    inst_data = check_institutional_strength(info, ticker)
    if inst_data['is_strong']:
        catalysts.append(inst_data['message'])
        total_score += inst_data['bonus_score']
        details['institutional'] = inst_data
    
    # 4. Analyst
    analyst_data = check_analyst_consensus(info, ticker)
    if analyst_data['bonus_score'] > 0:
        catalysts.append(analyst_data['message'])
        total_score += analyst_data['bonus_score']
        details['analyst'] = analyst_data
    
    # 5. Dividend
    div_data = check_upcoming_dividend(info, ticker)
    if div_data['has_upcoming_dividend']:
        catalysts.append(div_data['message'])
        total_score += div_data['bonus_score']
        details['dividend'] = div_data
    
    # Max 5 puan sınırı
    total_score = min(total_score, 5.0)
    
    if catalysts:
        logging.info(f"✨ {ticker} KATALYZÖRLER: {', '.join(catalysts)} → +{total_score:.1f} puan")
    
    return {
        'has_catalyst': len(catalysts) > 0,
        'catalyst_score': total_score,
        'catalyst_reasons': catalysts,
        'details': details
    }


# ============================================================
# 2. SECTOR ROTATION ANALYZER - Güçlü Sektörleri Tespit Et
# ============================================================

# Sektör ETF Haritası (family305a.py'de zaten var, referans için)
SECTOR_ETF_MAP = {
    "Technology": "XLK",
    "Energy": "XLE",
    "Financial Services": "XLF", "Financials": "XLF",
    "Healthcare": "XLV",
    "Consumer Cyclical": "XLY", "Consumer Discretionary": "XLY",
    "Industrials": "XLI",
    "Utilities": "XLU",
    "Basic Materials": "XLB", "Materials": "XLB",
    "Real Estate": "XLRE",
    "Consumer Defensive": "XLP", "Consumer Staples": "XLP",
    "Communication Services": "XLC"
}

# Global değişken (family305a.py'de zaten var)
SECTOR_PERFORMANCE = {}


async def analyze_sector_momentum() -> Dict:
    """
    Tüm sektör ETF'lerinin momentum'unu hesaplar.
    
    Methodology:
    1. Her sektör ETF'inin 5-günlük getirisini hesapla
    2. RSI kontrolü (50 üstü bullish)
    3. Volume trend (average'ın üstünde mi?)
    4. Composite momentum score hesapla
    
    Returns:
        {
            'top_sectors': list,      # En güçlü 3 sektör
            'weak_sectors': list,     # En zayıf 3 sektör
            'sector_scores': dict,    # Her sektör için detay
            'market_breadth': float   # Genel piyasa sağlığı (-100 to +100)
        }
    """
    sector_scores = {}
    
    logging.info("📊 Sektör momentum analizi başlıyor...")
    
    for sector_name, etf_ticker in SECTOR_ETF_MAP.items():
        try:
            # ETF verisini çek (son 1 ay)
            etf_data = yf.download(
                etf_ticker, 
                period='1mo', 
                interval='1d', 
                progress=False,
                show_errors=False
            )
            
            if len(etf_data) < 10:
                logging.debug(f"⚠️ {sector_name} ({etf_ticker}) - yetersiz veri")
                continue
            
            # 1. 5-günlük getiri
            if len(etf_data) >= 6:
                pct_change_5d = (
                    (etf_data['Close'].iloc[-1] / etf_data['Close'].iloc[-6]) - 1
                ) * 100
            else:
                pct_change_5d = 0
            
            # 2. RSI (14 günlük)
            from ta.momentum import RSIIndicator
            rsi_indicator = RSIIndicator(etf_data['Close'], window=14)
            rsi = rsi_indicator.rsi().iloc[-1] if len(etf_data) >= 14 else 50
            
            # 3. Volume trend
            vol_avg = etf_data['Volume'].rolling(20).mean().iloc[-1]
            vol_current = etf_data['Volume'].iloc[-1]
            vol_ratio = vol_current / vol_avg if vol_avg > 0 else 1.0
            
            # 4. Composite Momentum Score
            # Ağırlıklar: 50% fiyat, 30% RSI, 20% volume
            momentum_score = (
                pct_change_5d * 0.5 +           # Fiyat hareketi
                (rsi - 50) * 0.3 +              # RSI (50 üstü iyi, altı kötü)
                (vol_ratio - 1) * 10 * 0.2      # Volume artışı
            )
            
            sector_scores[sector_name] = {
                'etf': etf_ticker,
                'score': momentum_score,
                'pct_5d': pct_change_5d,
                'rsi': rsi,
                'vol_ratio': vol_ratio,
                'strength': 'Strong' if momentum_score > 2 else 'Weak' if momentum_score < -2 else 'Neutral'
            }
            
            logging.info(
                f"  {sector_name:20s} ({etf_ticker}): "
                f"Score={momentum_score:>6.2f}, "
                f"5D={pct_change_5d:>5.2f}%, "
                f"RSI={rsi:>5.1f}"
            )
            
        except Exception as e:
            logging.error(f"❌ Sector momentum hatası {etf_ticker}: {e}")
    
    if not sector_scores:
        logging.error("❌ Hiçbir sektör verisi alınamadı!")
        return {
            'top_sectors': [],
            'weak_sectors': [],
            'sector_scores': {},
            'market_breadth': 0
        }
    
    # Sektörleri skoruna göre sırala
    sorted_sectors = sorted(
        sector_scores.items(),
        key=lambda x: x[1]['score'],
        reverse=True
    )
    
    # En güçlü ve zayıf 3 sektör
    top_3 = [s[0] for s in sorted_sectors[:3]]
    weak_3 = [s[0] for s in sorted_sectors[-3:]]
    
    # Market Breadth (piyasa genişliği)
    # Pozitif skorlu sektörler vs negatif skorlu sektörler
    positive_count = sum(1 for s in sector_scores.values() if s['score'] > 0)
    total_count = len(sector_scores)
    market_breadth = ((positive_count / total_count) - 0.5) * 200  # -100 to +100
    
    logging.info("=" * 70)
    logging.info(f"🔥 EN GÜÇLÜ SEKTÖRLER: {', '.join(top_3)}")
    logging.info(f"❄️  EN ZAYIF SEKTÖRLER: {', '.join(weak_3)}")
    logging.info(f"📊 MARKET BREADTH: {market_breadth:+.1f} ({positive_count}/{total_count} pozitif)")
    logging.info("=" * 70)
    
    # Global değişkene kaydet
    global SECTOR_PERFORMANCE
    SECTOR_PERFORMANCE = sector_scores
    
    return {
        'top_sectors': top_3,
        'weak_sectors': weak_3,
        'sector_scores': sector_scores,
        'market_breadth': market_breadth
    }


def get_sector_bonus_penalty(sector: str) -> Tuple[float, str]:
    """
    Hissenin sektörüne göre bonus/penalty hesaplar.
    
    Args:
        sector: Hisse sektörü (örn: "Technology")
    
    Returns:
        (float, str): (Puan delta, Açıklama)
    """
    if sector not in SECTOR_PERFORMANCE:
        return 0.0, f"Sektör bilinmiyor: {sector}"
    
    sector_data = SECTOR_PERFORMANCE[sector]
    sector_score = sector_data['score']
    strength = sector_data['strength']
    
    # Bonus/Penalty hesapla
    if sector_score > 3.0:  # Very Strong
        bonus = 1.5
        msg = f"✅ {strength} Sector (+1.5): {sector}"
    elif sector_score > 2.0:  # Strong
        bonus = 1.0
        msg = f"✅ {strength} Sector (+1.0): {sector}"
    elif sector_score > 1.0:  # Moderate
        bonus = 0.5
        msg = f"📊 {strength} Sector (+0.5): {sector}"
    elif sector_score < -3.0:  # Very Weak
        bonus = -1.5
        msg = f"⚠️ {strength} Sector (-1.5): {sector}"
    elif sector_score < -2.0:  # Weak
        bonus = -1.0
        msg = f"⚠️ {strength} Sector (-1.0): {sector}"
    elif sector_score < -1.0:  # Moderate Weak
        bonus = -0.5
        msg = f"📊 {strength} Sector (-0.5): {sector}"
    else:  # Neutral
        bonus = 0.0
        msg = f"📊 Neutral Sector: {sector}"
    
    return bonus, msg


# ============================================================
# 3. VOLUME ANALYSIS - Kurumsal Para Akışı Tespiti
# ============================================================

def analyze_volume_profile(df_1d: pd.DataFrame, ticker: str) -> Dict:
    """
    Volume profili analiz eder.
    
    Kurumsal Para Tespiti:
    1. Son 5 günde volume artışı var mı?
    2. Green days'de volume yüksek, red days'de düşük mü? (Accumulation)
    3. Büyük volume spike'lar var mı?
    
    Returns:
        {
            'has_institutional_flow': bool,
            'avg_volume_ratio': float,  # Son 5 gün / 20 gün average
            'accumulation_score': float,
            'bonus_score': float,
            'message': str
        }
    """
    try:
        # Son 20 gün volume average
        vol_20d_avg = df_1d['volume'].iloc[-20:].mean()
        
        # Son 5 gün volume average
        vol_5d_avg = df_1d['volume'].iloc[-5:].mean()
        
        # Volume ratio
        vol_ratio = vol_5d_avg / vol_20d_avg if vol_20d_avg > 0 else 1.0
        
        # Accumulation/Distribution analizi
        # Green days (yükseliş) volume vs Red days (düşüş) volume
        recent_5d = df_1d.iloc[-5:].copy()
        recent_5d['price_change'] = recent_5d['close'] - recent_5d['open']
        
        green_days = recent_5d[recent_5d['price_change'] > 0]
        red_days = recent_5d[recent_5d['price_change'] < 0]
        
        green_vol_avg = green_days['volume'].mean() if not green_days.empty else 0
        red_vol_avg = red_days['volume'].mean() if not red_days.empty else 0
        
        # Accumulation score: Green volume / Red volume
        if red_vol_avg > 0:
            accum_score = green_vol_avg / red_vol_avg
        else:
            accum_score = 2.0 if green_vol_avg > 0 else 1.0
        
        # Bonus puan hesapla
        bonus_score = 0.0
        message = ""
        has_flow = False
        
        # Kurumsal akış kriterleri
        if vol_ratio > 1.5 and accum_score > 1.3:  # Güçlü akış
            bonus_score = 1.0
            message = f"💰 Strong Inst. Flow: Vol+{(vol_ratio-1)*100:.0f}%, Accum {accum_score:.2f}"
            has_flow = True
            
        elif vol_ratio > 1.3 and accum_score > 1.2:  # Orta akış
            bonus_score = 0.7
            message = f"💰 Moderate Inst. Flow: Vol+{(vol_ratio-1)*100:.0f}%"
            has_flow = True
            
        elif vol_ratio > 1.2:  # Hafif artış
            bonus_score = 0.5
            message = f"📊 Volume Increase: +{(vol_ratio-1)*100:.0f}%"
            has_flow = True
        
        if has_flow:
            logging.info(f"💰 {ticker} - {message}")
        
        return {
            'has_institutional_flow': has_flow,
            'avg_volume_ratio': vol_ratio,
            'accumulation_score': accum_score,
            'bonus_score': bonus_score,
            'message': message
        }
        
    except Exception as e:
        logging.debug(f"Volume analysis hatası {ticker}: {e}")
        return {
            'has_institutional_flow': False,
            'avg_volume_ratio': 1.0,
            'accumulation_score': 1.0,
            'bonus_score': 0.0,
            'message': 'Analysis failed'
        }


# ============================================================
# 4. INTEGRATION HELPERS
# ============================================================

def calculate_phase2_total_score(
    base_score: float,
    catalyst_data: dict,
    sector_bonus: float,
    volume_data: dict
) -> Tuple[float, List[str]]:
    """
    Phase 2'nin tüm bonus puanlarını toplar.
    
    Returns:
        (float, list): (Toplam skor, Bonus sebepleri)
    """
    total_score = base_score
    reasons = []
    
    # Katalyzör bonusu
    if catalyst_data['has_catalyst']:
        total_score += catalyst_data['catalyst_score']
        reasons.extend(catalyst_data['catalyst_reasons'])
    
    # Sektör bonusu
    if sector_bonus != 0:
        total_score += sector_bonus
        sector_msg = f"Sector: {sector_bonus:+.1f} puan"
        reasons.append(sector_msg)
    
    # Volume bonusu
    if volume_data['has_institutional_flow']:
        total_score += volume_data['bonus_score']
        reasons.append(volume_data['message'])
    
    return total_score, reasons


# ============================================================
# 5. UNIT TESTS
# ============================================================

def test_phase2_features():
    """
    Phase 2 özelliklerini test eder.
    """
    print("=" * 60)
    print("PHASE 2 FEATURE TESTS")
    print("=" * 60)
    
    # Test tickers
    test_tickers = ["AAPL", "TSLA", "GME"]  # GME = short squeeze örneği
    
    for ticker in test_tickers:
        print(f"\n[TEST] {ticker}")
        
        try:
            stock = yf.Ticker(ticker)
            info = stock.info
            
            # Katalyzör testi
            catalyst_data = check_silent_catalysts(ticker, info)
            print(f"  Catalysts: {catalyst_data['catalyst_score']:.1f} puan")
            for reason in catalyst_data['catalyst_reasons']:
                print(f"    - {reason}")
            
        except Exception as e:
            print(f"  ERROR: {e}")
    
    print("\n" + "=" * 60)


# ============================================================
# INTEGRATION CHECKLIST
# ============================================================

"""
PHASE 2 ENTEGRASYON ADIMLARI:

1. ✅ Bu dosyayı family305a.py ile aynı dizine kaydet

2. ✅ family305a.py'ye import ekle:
   
   from atmaca_upgrade_phase2 import (
       check_silent_catalysts,
       analyze_sector_momentum,
       get_sector_bonus_penalty,
       analyze_volume_profile,
       calculate_phase2_total_score,
       SECTOR_PERFORMANCE
   )

3. ✅ scan_top_stocks() BAŞLANGICINA ekle:
   
   async def scan_top_stocks():
       logging.info("🦅 ATMACA SWING MASTER - TARAMA BAŞLADI")
       
       # 🔥 PHASE 2: Sektör momentum analizi (İLK OLARAK)
       await analyze_sector_momentum()
       
       # ... geri kalan kod ...

4. ✅ analyze_candidate_detailed() İÇİNE ekle:
   
   # ... Phase 1 filtreleri geçti ...
   
   # 🔥 PHASE 2: Katalyzör kontrolü
   catalyst_data = check_silent_catalysts(ticker, info)
   
   # 🔥 PHASE 2: Sektör bonus/penalty
   sector = info.get('sector', 'Unknown')
   sector_bonus, sector_msg = get_sector_bonus_penalty(sector)
   
   # 🔥 PHASE 2: Volume analizi
   volume_data = analyze_volume_profile(df_1d, ticker)
   
   # 🔥 PHASE 2: R/R Ratio (Phase 1'den - catalyst kontrolü ile)
   has_catalyst = catalyst_data['has_catalyst']
   rr_valid, rr_ratio, rr_reason = validate_risk_reward(
       current_price, stop_loss, profit_target, has_catalyst, ticker
   )
   
   # 🔥 PHASE 2: Toplam skor hesapla
   final_score, bonus_reasons = calculate_phase2_total_score(
       base_score=score,  # Phase 1'den gelen
       catalyst_data=catalyst_data,
       sector_bonus=sector_bonus,
       volume_data=volume_data
   )
   
   # Result dict'e ekle
   result['catalyst_data'] = catalyst_data
   result['sector_bonus'] = sector_bonus
   result['volume_data'] = volume_data
   result['score'] = final_score
   result['bonus_reasons'] = bonus_reasons

5. ✅ Test et:
   python -c "from atmaca_upgrade_phase2 import test_phase2_features; test_phase2_features()"

6. ✅ İlk tarama sonuçlarını kontrol et:
   - Katalyzör bonusu alan hisseler top 10'a çıkmalı
   - Zayıf sektördeki hisseler puan kaybetmeli
   - Volume akışı olan hisseler bonus almalı

BAŞARILI OLURSA → PHASE 3'e geç
"""
