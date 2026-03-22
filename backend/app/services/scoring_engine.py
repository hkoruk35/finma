import logging
from typing import Dict, Any, List
import numpy as np

logger = logging.getLogger(__name__)

class ScoringEngine:
    """
    FinMA v5.0 Master Scoring Engine.
    Converts raw technical indicators into a 0-100 weighted 'Opportunity Score'.
    
    Weights:
    - Trend (30%)
    - Momentum (30%)
    - Volume (25%)
    - Volatility (15%)
    """
    
    def calculate_score(self, technical_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Calculate a 0-100 score based on provided indicator values.
        """
        try:
            # 1. Trend Score (0-100)
            trend_score = self._calculate_trend_score(technical_data)
            
            # 2. Momentum Score (0-100)
            momentum_score = self._calculate_momentum_score(technical_data)
            
            # 3. Volume Score (0-100)
            volume_score = self._calculate_volume_score(technical_data)
            
            # 4. Volatility Score (0-100)
            volatility_score = self._calculate_volatility_score(technical_data)
            
            # Weighted Final Score
            final_score = (
                (trend_score * 0.30) +
                (momentum_score * 0.30) +
                (volume_score * 0.25) +
                (volatility_score * 0.15)
            )
            
            return {
                "score": round(final_score, 1),
                "factors": {
                    "trend": round(trend_score, 1),
                    "momentum": round(momentum_score, 1),
                    "volume": round(volume_score, 1),
                    "volatility": round(volatility_score, 1)
                }
            }
        except Exception as e:
            logger.error(f"Error calculating score: {e}")
            return {"score": 0, "factors": {}}

    def _calculate_trend_score(self, data: Dict[str, Any]) -> float:
        """Trend intensity based on EMA alignments"""
        score = 0
        price = data.get('price', 0)
        ema20 = data.get('ema20', 0)
        ema50 = data.get('ema50', 0)
        ema200 = data.get('ema200', 0)
        
        if not all([price, ema20, ema50, ema200]): return 0
        
        # Bullish Alignment: Price > EMA20 > EMA50 > EMA200
        if price > ema20: score += 25
        if ema20 > ema50: score += 25
        if ema50 > ema200: score += 25
        if price > ema200: score += 25
        
        return float(score)

    def _calculate_momentum_score(self, data: Dict[str, Any]) -> float:
        """Momentum based on RSI and MACD"""
        score = 0
        rsi = data.get('rsi', 50)
        macd = data.get('macd', 0)
        macd_signal = data.get('macd_signal', 0)
        
        # RSI: Strong between 50-70, warning > 70
        if 50 < rsi <= 70: score += 50
        elif 70 < rsi <= 80: score += 25 # Overbought but trending
        elif 30 <= rsi <= 50: score += 10 # Oversold bounce potential
        
        # MACD: Positive and above signal
        if macd > 0: score += 25
        if macd > macd_signal: score += 25
        
        return float(score)

    def _calculate_volume_score(self, data: Dict[str, Any]) -> float:
        """Volume confirmation based on Relative Volume (RVOL)"""
        rvol = data.get('rvol', 1.0)
        obv_trend = data.get('obv_trend', 'neutral') # bullish, bearish, neutral
        
        score = 0
        if rvol > 2.0: score += 50 # High volume
        elif rvol > 1.2: score += 30
        
        if obv_trend == 'bullish': score += 50
        elif obv_trend == 'neutral': score += 25
        
        return float(score)

    def _calculate_volatility_score(self, data: Dict[str, Any]) -> float:
        """Volatility context based on ATR relative to price"""
        atr = data.get('atr', 0)
        price = data.get('price', 1)
        
        if not atr or not price: return 50
        
        atr_pct = (atr / price) * 100
        # High volatility can be good for momentum but risky
        # We aim for "Sweet Spot" volatility
        if 1.0 < atr_pct < 4.0: return 100
        if atr_pct <= 1.0: return 60 # Low volatility breakout candidate
        return 40 # Too volatile/noisy

# Singleton
scoring_engine = ScoringEngine()
