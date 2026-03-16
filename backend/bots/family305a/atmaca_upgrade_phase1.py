# ============================================================
# ATMACA BOT - PHASE 1: CRITICAL UPGRADES
# Bu kodu family305a.py dosyasına ekleyin (Line 500 civarı)
# ============================================================

import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, List
import yfinance as yf
import pandas as pd
import numpy as np
from zoneinfo import ZoneInfo


# ============================================================
# 1. EARNINGS DATE FILTER - KRİTİK ÖNEM
# ============================================================

def get_earnings_date_safe(ticker: str) -> Optional[datetime]:
    """
    Yahoo Finance'dan earnings tarihini güvenli şekilde çeker.
    
    Stratejik önem: Earnings öncesi/sonrası 48 saat swing trade ölüm bölgesidir.
    IV Crush, gap riski, ve volatility spike bu dönemde maksimum.
    
    Args:
        ticker: Hisse sembolü (örn: "AAPL")
    
    Returns:
        datetime: Bir sonraki earnings tarihi
        None: Earnings tarihi belirlenemezse
    
    Methodology:
        1. Önce calendar attribute kontrol (en hızlı)
        2. Sonra earnings_dates attribute (en güvenilir)
        3. En son info dict fallback (yedek)
    """
    try:
        stock = yf.Ticker(ticker)
        
        # Method 1: calendar attribute (Yahoo Finance hızlı API)
        if hasattr(stock, 'calendar') and stock.calendar is not None:
            earnings_date = stock.calendar.get('Earnings Date', None)
            if earnings_date is not None:
                # Bazen list olarak dönüyor (range veriyorsa ilk tarih)
                if isinstance(earnings_date, list) and len(earnings_date) > 0:
                    earnings_date = earnings_date[0]
                
                # Datetime'a çevir
                if pd.notna(earnings_date):
                    return pd.to_datetime(earnings_date)
        
        # Method 2: earnings_dates attribute (en güvenilir ama yavaş)
        if hasattr(stock, 'earnings_dates') and stock.earnings_dates is not None:
            try:
                # Gelecek tarihli earnings'leri filtrele
                now = datetime.now(ZoneInfo("America/New_York"))
                upcoming = stock.earnings_dates[stock.earnings_dates.index >= now]
                
                if not upcoming.empty:
                    next_earnings = upcoming.index[0]
                    # Timezone-aware datetime'a çevir
                    if next_earnings.tzinfo is None:
                        next_earnings = next_earnings.replace(tzinfo=ZoneInfo("America/New_York"))
                    return next_earnings
            except Exception as e:
                logging.debug(f"earnings_dates parse hatası {ticker}: {e}")
        
        # Method 3: info dict fallback (son çare)
        info = stock.info
        if info and 'earningsDate' in info:
            earnings_date = info['earningsDate']
            
            # Bazen unix timestamp olarak geliyor
            if isinstance(earnings_date, (int, float)):
                return datetime.fromtimestamp(earnings_date, tz=ZoneInfo("America/New_York"))
            
            # Liste formatında gelebilir
            if isinstance(earnings_date, list) and len(earnings_date) > 0:
                ed = earnings_date[0]
                if isinstance(ed, (int, float)):
                    return datetime.fromtimestamp(ed, tz=ZoneInfo("America/New_York"))
        
        # Hiçbir method çalışmazsa
        return None
        
    except Exception as e:
        logging.warning(f"⚠️ {ticker} earnings tarihi alınamadı: {e}")
        return None


def is_earnings_safe_for_swing(
    ticker: str, 
    min_days_forward: int = 7,
    max_days_backward: int = 2
) -> tuple[bool, str]:
    """
    Swing trade için earnings güvenli mi kontrol eder.
    
    Profesyonel Kurallar:
    1. Forward Check: Earnings en az 7 gün uzakta olmalı
    2. Backward Check: Son 2 gün içinde earnings geçmişse RED (post-volatility)
    3. Same Day: Bugün earnings varsa RED
    
    Args:
        ticker: Hisse sembolü
        min_days_forward: Gelecek earnings için minimum gün sayısı
        max_days_backward: Geçmiş earnings için maksimum gün sayısı
    
    Returns:
        (bool, str): (Güvenli mi?, Sebep mesajı)
        
    Example:
        safe, reason = is_earnings_safe_for_swing("AAPL")
        if not safe:
            logging.info(f"❌ AAPL elendi: {reason}")
            return None
    """
    try:
        earnings_date = get_earnings_date_safe(ticker)
        
        # Earnings tarihi bilinmiyorsa
        if earnings_date is None:
            # Risk tolerance: Bilinmeyen tarihler için CAUTION ama RED etme
            # Alternatif: return False, "Earnings tarihi belirsiz"
            logging.debug(f"⚠️ {ticker} earnings tarihi belirsiz (dikkatli devam)")
            return True, "Earnings tarihi belirsiz (risk var)"
        
        # Şu anki zaman (New York)
        now = datetime.now(ZoneInfo("America/New_York"))
        
        # Timezone uyumlulaştırma
        if earnings_date.tzinfo is None:
            earnings_date = earnings_date.replace(tzinfo=ZoneInfo("America/New_York"))
        
        # Gün farkı hesapla
        time_delta = earnings_date - now
        days_until_earnings = time_delta.days
        hours_until = time_delta.total_seconds() / 3600
        
        # BUGÜN EARNINGS (0 gün kaldı)
        if days_until_earnings == 0 or abs(hours_until) < 24:
            reason = f"Earnings BUGÜN ({earnings_date.strftime('%Y-%m-%d')})"
            logging.info(f"❌ {ticker} REDDEDİLDİ: {reason}")
            return False, reason
        
        # FORWARD CHECK (Gelecek earnings çok yakın)
        if 0 < days_until_earnings < min_days_forward:
            reason = f"Earnings {days_until_earnings} gün sonra ({earnings_date.strftime('%Y-%m-%d')})"
            logging.info(f"❌ {ticker} REDDEDİLDİ: {reason}")
            return False, reason
        
        # BACKWARD CHECK (Geçmiş earnings - post-volatility riski)
        if -max_days_backward <= days_until_earnings < 0:
            abs_days = abs(days_until_earnings)
            reason = f"Earnings {abs_days} gün önce oldu (post-volatility riski)"
            logging.info(f"❌ {ticker} REDDEDİLDİ: {reason}")
            return False, reason
        
        # GÜVENLİ - Earnings yeterince uzak
        if days_until_earnings >= min_days_forward:
            logging.debug(f"✅ {ticker} Earnings Güvenli: {days_until_earnings} gün uzakta")
            return True, f"Earnings {days_until_earnings} gün uzakta"
        
        # Geçmişte ama yeterince eski (max_days_backward'dan fazla)
        if days_until_earnings < -max_days_backward:
            logging.debug(f"✅ {ticker} Earnings Güvenli: {abs(days_until_earnings)} gün önce oldu")
            return True, f"Earnings {abs(days_until_earnings)} gün önce (temiz)"
        
        # Fallback (shouldn't reach here)
        return True, "Earnings kontrolü tamamlandı"
        
    except Exception as e:
        logging.error(f"❌ Earnings check hatası {ticker}: {e}")
        # Hata durumunda RED et (güvenli tarafta kal)
        return False, f"Earnings kontrol hatası: {str(e)}"


# ============================================================
# 2. RSI IMPROVEMENTS - Aşırı Alım/Satım + Divergence
# ============================================================

# Global Parametreler (family305a.py başına ekle)
RSI_MIN_SWING = 45          # Minimum RSI (aşırı satım filtresi)
RSI_MAX_SWING = 68          # Maximum RSI (aşırı alım filtresi - 70 yerine 68)
RSI_4H_MAX = 75             # 4H timeframe için max (daha gevşek)
RSI_DIVERGENCE_LOOKBACK = 5 # Divergence için geriye bakış


def check_rsi_overbought_oversold(
    df_1d: pd.DataFrame,
    df_4h: pd.DataFrame,
    ticker: str
) -> tuple[bool, str]:
    """
    RSI aşırı alım/satım kontrolü.
    
    Kurallar:
    1. 1D RSI 45-68 arası olmalı (profesyonel swing zone)
    2. 4H RSI 75 altında olmalı (intraday aşırı alım değil)
    3. Her iki timeframe da kurallara uymalı
    
    Returns:
        (bool, str): (Uygun mu?, Sebep)
    """
    try:
        # 1D RSI
        rsi_1d = df_1d['rsi_14'].iloc[-1]
        
        # 4H RSI
        rsi_4h = df_4h['rsi_14'].iloc[-1]
        
        # 1D Kontrol
        if rsi_1d < RSI_MIN_SWING:
            reason = f"RSI(1D) aşırı satım: {rsi_1d:.1f} < {RSI_MIN_SWING}"
            logging.info(f"⛔ {ticker} - {reason}")
            return False, reason
        
        if rsi_1d > RSI_MAX_SWING:
            reason = f"RSI(1D) aşırı alım: {rsi_1d:.1f} > {RSI_MAX_SWING}"
            logging.info(f"⛔ {ticker} - {reason}")
            return False, reason
        
        # 4H Kontrol (daha gevşek limit)
        if rsi_4h > RSI_4H_MAX:
            reason = f"RSI(4H) aşırı alım: {rsi_4h:.1f} > {RSI_4H_MAX}"
            logging.info(f"⛔ {ticker} - {reason}")
            return False, reason
        
        # İdeal RSI zone
        logging.debug(f"✅ {ticker} RSI OK: 1D={rsi_1d:.1f}, 4H={rsi_4h:.1f}")
        return True, f"RSI ideal zone: 1D={rsi_1d:.1f}"
        
    except Exception as e:
        logging.error(f"RSI check hatası {ticker}: {e}")
        return False, f"RSI hesaplama hatası"


def check_rsi_divergence(
    df_1d: pd.DataFrame,
    ticker: str,
    lookback: int = 5
) -> tuple[bool, str]:
    """
    Bearish RSI Divergence tespit eder.
    
    Divergence Nedir:
    - Fiyat yeni high yapıyor AMA RSI düşüyor → Momentum zayıflıyor (RED FLAG)
    - Bu genelde trend dönüş sinyalidir (swing trader için ölüm)
    
    Methodology:
    1. Son N günün fiyat hareketine bak
    2. Son N günün RSI hareketine bak  
    3. Eğer fiyat yükseliyor ama RSI düşüyorsa → Divergence VAR
    
    Returns:
        (bool, str): (Divergence VAR MI?, Açıklama)
    """
    try:
        # Son N günün verisi
        recent_close = df_1d['close'].iloc[-lookback:].values
        recent_rsi = df_1d['rsi_14'].iloc[-lookback:].values
        
        # Fiyat trendi (yükseliyor mu?)
        price_trend = recent_close[-1] - recent_close[0]
        
        # RSI trendi (yükseliyor mu?)
        rsi_trend = recent_rsi[-1] - recent_rsi[0]
        
        # Bearish Divergence: Fiyat UP, RSI DOWN
        if price_trend > 0 and rsi_trend < -3:  # RSI en az 3 puan düşmüş
            pct_price_change = (price_trend / recent_close[0]) * 100
            rsi_change = rsi_trend
            
            reason = (
                f"Bearish Divergence: Fiyat +{pct_price_change:.1f}% "
                f"ama RSI {rsi_change:.1f} düşmüş"
            )
            logging.warning(f"⚠️ {ticker} - {reason}")
            return True, reason  # True = Divergence VAR (RED)
        
        # Bullish Divergence: Fiyat DOWN, RSI UP (bu iyi bir sinyal, geçir)
        # Hidden Divergence: Daha kompleks (şimdilik skip)
        
        logging.debug(f"✅ {ticker} RSI Divergence yok")
        return False, "RSI Divergence tespit edilmedi"
        
    except Exception as e:
        logging.error(f"RSI Divergence check hatası {ticker}: {e}")
        return False, "Divergence kontrolü yapılamadı"


# ============================================================
# 3. R/R RATIO OPTIMIZATION - Minimum 2.5
# ============================================================

# Global Parametreler
MIN_RR_RATIO_STRICT = 2.5    # Standart minimum (katalyzör yoksa)
MIN_RR_RATIO_RELAXED = 2.0   # Güçlü katalyzör varsa kabul edilir


def calculate_risk_reward_ratio(
    current_price: float,
    stop_loss: float,
    profit_target: float
) -> float:
    """
    Risk/Reward ratio hesaplar.
    
    Formula:
        R/R = (Target - Entry) / (Entry - Stop)
    
    Example:
        Entry: $100
        Stop: $95 (risk = $5)
        Target: $115 (reward = $15)
        R/R = 15/5 = 3.0 ✅
    """
    risk = current_price - stop_loss
    reward = profit_target - current_price
    
    if risk <= 0:
        return 0.0  # Invalid setup
    
    return reward / risk


def validate_risk_reward(
    current_price: float,
    stop_loss: float,
    profit_target: float,
    has_catalyst: bool,
    ticker: str
) -> tuple[bool, float, str]:
    """
    R/R ratio validation.
    
    Args:
        current_price: Mevcut fiyat
        stop_loss: Stop loss fiyatı
        profit_target: Kar hedefi
        has_catalyst: Güçlü katalyzör var mı?
        ticker: Sembol
    
    Returns:
        (bool, float, str): (Geçti mi?, R/R değeri, Sebep)
    """
    rr_ratio = calculate_risk_reward_ratio(current_price, stop_loss, profit_target)
    
    # Katalyzör varsa relaxed standart, yoksa strict
    required_rr = MIN_RR_RATIO_RELAXED if has_catalyst else MIN_RR_RATIO_STRICT
    
    if rr_ratio < required_rr:
        reason = (
            f"R/R yetersiz: {rr_ratio:.2f} < {required_rr:.2f} "
            f"({'relaxed' if has_catalyst else 'strict'} standart)"
        )
        logging.info(f"⛔ {ticker} - {reason}")
        return False, rr_ratio, reason
    
    # Mükemmel R/R için bonus mesaj
    quality = "Mükemmel" if rr_ratio >= 3.5 else "Güçlü" if rr_ratio >= 3.0 else "İyi"
    reason = f"R/R {quality}: {rr_ratio:.2f}"
    logging.debug(f"✅ {ticker} - {reason}")
    
    return True, rr_ratio, reason


# ============================================================
# 4. INTEGRATION - analyze_candidate_detailed() UPDATES
# ============================================================

# Bu fonksiyon family305a.py içindeki mevcut analyze_candidate_detailed()
# fonksiyonunun BAŞINA eklenecek

"""
async def analyze_candidate_detailed(ticker: str, df_1d, df_4h, info) -> Optional[Dict]:
    '''
    MEVCUT FONKSİYON - PHASE 1 UPGRADE'LER EKLENECEK
    '''
    
    # ==========================================
    # 🔥 PHASE 1 - STEP 1: EARNINGS CHECK
    # ==========================================
    # EN BAŞA EKLE (hızlı red için)
    
    earnings_safe, earnings_reason = is_earnings_safe_for_swing(
        ticker, 
        min_days_forward=7,
        max_days_backward=2
    )
    
    if not earnings_safe:
        logging.info(f"⛔ {ticker} earnings riski nedeniyle elendi: {earnings_reason}")
        return None
    
    # ... mevcut likidite/fiyat kontrolleri ...
    
    # ==========================================
    # 🔥 PHASE 1 - STEP 2: RSI IMPROVEMENTS
    # ==========================================
    # Mevcut RSI kontrolünü değiştir
    
    # ESKİ KOD:
    # rsi = df_1d['rsi_14'].iloc[-1]
    # if not (45 <= rsi <= 75):  # ❌ ESKI
    #     return None
    
    # YENİ KOD:
    rsi_ok, rsi_reason = check_rsi_overbought_oversold(df_1d, df_4h, ticker)
    if not rsi_ok:
        return None
    
    # RSI Divergence kontrolü
    has_divergence, div_reason = check_rsi_divergence(df_1d, ticker)
    if has_divergence:
        logging.info(f"⛔ {ticker} Bearish Divergence nedeniyle elendi")
        return None
    
    # ... mevcut EMA/ADX/OBV kontrolleri ...
    
    # ==========================================
    # 🔥 PHASE 1 - STEP 3: R/R VALIDATION
    # ==========================================
    # Stop/Target hesaplama sonrasına ekle
    
    # ... stop_loss ve profit_target hesaplanmış olmalı ...
    
    # Phase 2'den gelecek katalyzör verisi (şimdilik False)
    has_catalyst = False  # Phase 2'de güncellenecek
    
    rr_valid, rr_ratio, rr_reason = validate_risk_reward(
        current_price=current_price,
        stop_loss=stop_loss,
        profit_target=profit_target,
        has_catalyst=has_catalyst,
        ticker=ticker
    )
    
    if not rr_valid:
        return None
    
    # Result dict'e ekle
    result = {
        'ticker': ticker,
        'earnings_check': earnings_reason,
        'rsi_check': rsi_reason,
        'rr_ratio': rr_ratio,
        'rr_quality': rr_reason,
        # ... diğer alanlar ...
    }
    
    return result
"""


# ============================================================
# 5. LOGGING IMPROVEMENTS
# ============================================================

def log_phase1_summary(ticker: str, passed: bool, details: dict):
    """
    Phase 1 filtrelerinin özet logu.
    
    Debug amacıyla hangi adımdan geçip/geçmediğini gösterir.
    """
    if passed:
        logging.info(
            f"✅ {ticker} PHASE 1 GEÇTİ - "
            f"Earnings: {details.get('earnings', 'OK')}, "
            f"RSI: {details.get('rsi', 'OK')}, "
            f"R/R: {details.get('rr', 'OK')}"
        )
    else:
        logging.info(
            f"❌ {ticker} PHASE 1 ELENDİ - "
            f"Sebep: {details.get('reason', 'Unknown')}"
        )


# ============================================================
# 6. UNIT TESTS (OPTIONAL - Geliştirme için)
# ============================================================

def test_phase1_filters():
    """
    Phase 1 filtrelerini test eder.
    Manuel çalıştırma: python -c "from atmaca_upgrade_phase1 import test_phase1_filters; test_phase1_filters()"
    """
    print("=" * 60)
    print("PHASE 1 FILTER TESTS")
    print("=" * 60)
    
    # Test 1: Earnings Filter
    print("\n[TEST 1] Earnings Filter")
    test_tickers = ["AAPL", "MSFT", "TSLA"]
    for ticker in test_tickers:
        safe, reason = is_earnings_safe_for_swing(ticker)
        status = "✅ PASS" if safe else "❌ FAIL"
        print(f"  {ticker}: {status} - {reason}")
    
    # Test 2: RSI Divergence
    print("\n[TEST 2] RSI Divergence")
    print("  (Gerçek veri gerektirir - manuel test edilmeli)")
    
    # Test 3: R/R Ratio
    print("\n[TEST 3] R/R Ratio")
    test_cases = [
        (100, 95, 115, False, "Standard setup"),  # R/R = 3.0 ✅
        (100, 98, 110, False, "Weak setup"),      # R/R = 5.0 ✅
        (100, 95, 105, False, "Bad setup"),       # R/R = 1.0 ❌
        (100, 95, 110, True, "Catalyst setup"),   # R/R = 2.0 ✅ (relaxed)
    ]
    
    for entry, stop, target, catalyst, desc in test_cases:
        valid, rr, reason = validate_risk_reward(entry, stop, target, catalyst, "TEST")
        status = "✅ PASS" if valid else "❌ FAIL"
        print(f"  {desc}: {status} - R/R={rr:.2f}")
    
    print("\n" + "=" * 60)


# ============================================================
# INTEGRATION CHECKLIST
# ============================================================

"""
PHASE 1 ENTEGRASYON ADIMLARI:

1. ✅ Bu dosyayı family305a.py ile aynı dizine kaydet
2. ✅ family305a.py'ye import ekle:
   
   from atmaca_upgrade_phase1 import (
       is_earnings_safe_for_swing,
       check_rsi_overbought_oversold,
       check_rsi_divergence,
       validate_risk_reward,
       RSI_MIN_SWING,
       RSI_MAX_SWING,
       MIN_RR_RATIO_STRICT,
       MIN_RR_RATIO_RELAXED
   )

3. ✅ analyze_candidate_detailed() fonksiyonunu yukarıdaki yorumlara göre güncelle

4. ✅ Test et:
   python -c "from atmaca_upgrade_phase1 import test_phase1_filters; test_phase1_filters()"

5. ✅ Botunu çalıştır ve logları kontrol et:
   - Earnings riski olanlar "❌ earnings riski" ile elenmeli
   - RSI >68 olanlar "⛔ RSI aşırı alım" ile elenmeli
   - R/R <2.5 olanlar "⛔ R/R yetersiz" ile elenmeli

6. ✅ İlk tarama sonuçlarını kontrol et:
   - Bugünkü gibi 16/20 kullanılamaz hisse → 4/20'ye düşmeli
   - Top 20'de earnings bugün/yarın olan hisse OLMAMALI
   - RSI 70+ hisse OLMAMALI

BAŞARILI OLURSA → PHASE 2'ye geç
"""
