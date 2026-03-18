"""
Market News Bot
Aggregates hourly US market and economy news from Alpha Vantage and Yahoo Finance.
"""

import sys
import os
import logging

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.market_data import update_all_market_news

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("news_bot")

def main():
    logger.info("🚀 News Bot is starting its hourly run...")
    try:
        count = update_all_market_news()
        if count > 0:
            logger.info(f"✅ Success: {count} news items aggregated and saved to database.")
        else:
            logger.warning("⚠️ Warning: No new news items were found.")
    except Exception as e:
        logger.error(f"❌ Critical Error in News Bot: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
