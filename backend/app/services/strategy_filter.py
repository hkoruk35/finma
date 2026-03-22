import logging
from typing import Dict, Any, List, Optional
from enum import Enum

logger = logging.getLogger(__name__)

class StrategyGoal(str, Enum):
    BREAKOUT = "BREAKOUT"
    DIP_RETURN = "DIP_RETURN"
    MOMENTUM = "MOMENTUM"
    TREND_FOLLOW = "TREND_FOLLOW"
    BOTTOM_DETECT = "BOTTOM_DETECT"
    DIVIDEND = "DIVIDEND"

class StrategyFilter:
    """
    Personalization Engine for FinMA v5.0.
    Categorizes global signals into specific trading goals and filters them
    based on user-specific preferences.
    """

    def identify_goal(self, technical_data: Dict[str, Any], score_data: Dict[str, Any]) -> Optional[StrategyGoal]:
        """
        Determine the 'Strategy Goal' of a technical setup.
        """
        score = score_data.get('score', 0)
        rsi = technical_data.get('rsi', 50)
        rvol = technical_data.get('rvol', 1.0)
        price = technical_data.get('price', 0)
        ema20 = technical_data.get('ema20', 0)
        
        # 1. BREAKOUT: Price crosses EMA20 + High Volume + High Score
        if price > ema20 and rvol > 1.8 and score > 75:
            return StrategyGoal.BREAKOUT
            
        # 2. MOMENTUM: Very high score + Strong RSI
        if score > 85 and rsi > 60:
            return StrategyGoal.MOMENTUM
            
        # 3. DIP RETURN: Score improving + Low RSI (Oversold)
        if rsi < 35 and score > 50:
            return StrategyGoal.DIP_RETURN
            
        # 4. TREND FOLLOW: Score 60-80 + Stable RSI
        if 60 <= score <= 80 and 45 <= rsi <= 60:
            return StrategyGoal.TREND_FOLLOW
            
        return None

    def matches_user_profile(self, goal: StrategyGoal, user_settings: Dict[str, Any]) -> bool:
        """
        Filter signal based on user's strategy/budget.
        """
        user_strategy = user_settings.get('strategy_type', 'SWING') # DAY, SWING, LONG_TERM
        user_goals = user_settings.get('goals', []) # List of StrategyGoal
        
        # If user has specific goals enabled, check if current goal matches
        if user_goals and goal.value not in user_goals:
            return False
            
        # Logic for Strategy Types
        if user_strategy == 'DAY' and goal in [StrategyGoal.BREAKOUT, StrategyGoal.MOMENTUM]:
            return True
        if user_strategy == 'SWING' and goal in [StrategyGoal.DIP_RETURN, StrategyGoal.TREND_FOLLOW]:
            return True
        if user_strategy == 'LONG_TERM' and goal == StrategyGoal.DIVIDEND:
            return True
            
        # Default fallback: allow if no strict constraints
        return not bool(user_goals)

# Singleton
strategy_filter = StrategyFilter()
