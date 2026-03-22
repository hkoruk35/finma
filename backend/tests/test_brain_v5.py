import asyncio
import logging
from app.services.scoring_engine import scoring_engine
from app.services.strategy_filter import strategy_filter, StrategyGoal
from app.services.ai_cache import ai_cache
from app.services.redis_service import redis_service

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("brain_test")

async def test_brain():
    logger.info("🧠 Starting FinMA v5.0 Brain Logic Test...")

    # Mock technical data for a BREAKOUT setup
    tech_data = {
        'price': 150.0,
        'ema20': 142.0,
        'ema50': 135.0,
        'ema200': 120.0,
        'rsi': 65.0,
        'macd': 2.5,
        'macd_signal': 1.2,
        'rvol': 2.5,
        'obv_trend': 'bullish',
        'atr': 3.5
    }

    # 1. Test Scoring Engine
    result = scoring_engine.calculate_score(tech_data)
    logger.info(f"📊 Calculated Score: {result['score']} | Factors: {result['factors']}")
    assert result['score'] > 80, f"Expected high score for breakout setup, got {result['score']}"

    # 2. Test Strategy Filter identification
    goal = strategy_filter.identify_goal(tech_data, result)
    logger.info(f"🎯 Identified Goal: {goal}")
    assert goal == StrategyGoal.BREAKOUT, f"Expected BREAKOUT, got {goal}"

    # 3. Test AI Hashing & Caching
    setup_hash = ai_cache.generate_setup_hash("AAPL", tech_data)
    logger.info(f"🔑 Generated Setup Hash: {setup_hash}")
    
    # Mocking a cache set/get
    mock_analysis = {"report": "Bullish breakout confirmed on high volume."}
    await ai_cache.set_cached_analysis(setup_hash, mock_analysis, ttl=60)
    
    cached = await ai_cache.get_cached_analysis(setup_hash)
    logger.info(f"💾 Cache Retrieval: {cached}")
    assert cached == mock_analysis, "Cache mismatch!"

    # 4. Test User Filtering
    user_settings = {
        "strategy_type": "DAY",
        "goals": ["BREAKOUT"]
    }
    is_match = strategy_filter.matches_user_profile(goal, user_settings)
    logger.info(f"👤 User Match (DAY + BREAKOUT): {is_match}")
    assert is_match == True, "Expected match for DAY strategy with BREAKOUT goal"

    user_settings_fail = {
        "strategy_type": "LONG_TERM",
        "goals": ["DIVIDEND"]
    }
    is_match_fail = strategy_filter.matches_user_profile(goal, user_settings_fail)
    logger.info(f"👤 User Match (LONG_TERM + DIVIDEND vs BREAKOUT): {is_match_fail}")
    assert is_match_fail == False, "Expected NO match for LONG_TERM with DIVIDEND goal against a BREAKOUT"

    await redis_service.close()
    logger.info("🎉 Brain Logic Test Completed Successfully!")

if __name__ == "__main__":
    asyncio.run(test_brain())
