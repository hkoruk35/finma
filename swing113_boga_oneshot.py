"""
swing113_boga_oneshot.py
One-shot wrapper: imports scan_top_stocks from swing113_boga
and runs it exactly ONCE, then exits.

Used by run_all_bots.py (Task Scheduler).
"""
import asyncio
import os
import sys
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger("swing_oneshot")

# Resolve paths
_THIS_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _THIS_DIR)
os.chdir(_THIS_DIR)  # Ensure CWD is finma/ so paths resolve correctly

async def main():
    log.info("▶ Swing113 BOGA — Tek Seferlik Tarama Başlatıldı")
    try:
        # Import the scan function and required globals
        from swing113_boga import scan_top_stocks, send_telegram_message
    except ImportError as e:
        log.critical(f"❌ swing113_boga import hatası: {e}")
        sys.exit(1)

    try:
        await scan_top_stocks()
        log.info("✅ Swing taraması tamamlandı.")
    except Exception as e:
        log.error(f"❌ Tarama hatası: {e}", exc_info=True)
        try:
            await send_telegram_message(f"🚨 Swing Oneshot Tarama Hatası: {str(e)[:200]}")
        except Exception:
            pass
        sys.exit(1)

if __name__ == "__main__":
    if os.name == "nt":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())
