"""
Insider Trading Data Bot
Fetches latest insider trades for major US stocks via yfinance.
"""

import sys
import os
import logging

# Add project root to path to allow importing app modules
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.market_data import update_market_insiders

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("insider_bot")

def main():
    logger.info("🚀 Insider Bot is starting its daily run...")
    try:
        count = update_market_insiders()
        if count > 0:
            logger.info(f"✅ Success: {count} insider transactions aggregated and saved to database.")
        else:
            logger.warning("⚠️ Warning: No new transactions were found for the selected universe.")
    except Exception as e:
        logger.error(f"❌ Critical Error in Insider Bot: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
