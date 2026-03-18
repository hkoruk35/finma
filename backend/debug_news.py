import sys
import os
import logging
import json
import urllib.request

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database import NewsDB, is_db_available
from app.services.market_data import update_all_market_news

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("debug_news")

def debug():
    logger.info("--- News Debug Start ---")
    
    # 1. DB Check
    db_ok = is_db_available()
    logger.info(f"Supabase Connection: {'✅' if db_ok else '❌ (In-memory mode)')}")
    
    # 2. Table Count Check
    try:
        results = NewsDB.get_latest(limit=5)
        logger.info(f"Existing news: {len(results)}")
    except Exception as e:
        logger.error(f"Error reading news: {e}")

    # 3. Manual Fetch Trigger
    logger.info("Triggering manual fetch (using internal urllib)...")
    try:
        count = update_all_market_news()
        logger.info(f"Manual fetch results: {count} items")
    except Exception as e:
        logger.error(f"Error during manual fetch: {e}")

    logger.info("--- Debug End ---")

if __name__ == "__main__":
    debug()
