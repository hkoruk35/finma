#!/usr/bin/env python3
"""
BOGA AI 7-Day Daily Analysis Runner
run_7day_analysis.py v1.0 | April 2026

Runs boga_ai_bot.py daily for 7 consecutive days at 09:00 AM New York time.
If market is closed, uses previous close prices instead of live prices.
"""

import asyncio
import logging
import os
import sys
import subprocess
import json
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

# Add parent directory to path to import boga_ai_bot modules
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import (
    NY_TIMEZONE, DAILY_RUN_HOUR, DAILY_RUN_MINUTE,
    DATA_DIR, LOG_DIR
)
from boga_ai_bot import is_market_open, use_prev_close_mode

# ──────────────────────────────────────────────────────────────
# Logging
# ──────────────────────────────────────────────────────────────

os.makedirs(LOG_DIR, exist_ok=True)
log_file = os.path.join(LOG_DIR, "run_7day.log")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(log_file, encoding="utf-8"),
        logging.StreamHandler(),
    ]
)
log = logging.getLogger("run_7day")

NY_TZ = ZoneInfo(NY_TIMEZONE)


# ──────────────────────────────────────────────────────────────
# Main 7-Day Runner
# ──────────────────────────────────────────────────────────────

async def wait_until_next_run(target_hour: int, target_minute: int) -> timedelta:
    """
    Calculate seconds until next run time (target_hour:target_minute NY time).
    Returns the time delta.
    """
    now = datetime.now(NY_TZ)
    next_run = now.replace(hour=target_hour, minute=target_minute, second=0, microsecond=0)

    # If target time has already passed today, schedule for tomorrow
    if next_run <= now:
        next_run += timedelta(days=1)

    wait_seconds = (next_run - now).total_seconds()
    return wait_seconds


async def run_boga_ai_bot() -> bool:
    """
    Execute boga_ai_bot.py with --run-now flag for manual trigger.
    Returns True if successful, False if failed.
    """
    try:
        cmd = [sys.executable, "boga_ai_bot.py", "--run-now"]
        log.info(f"Starting BOGA AI bot: {' '.join(cmd)}")

        result = subprocess.run(
            cmd,
            cwd=os.path.dirname(os.path.abspath(__file__)),
            capture_output=True,
            text=True,
            timeout=600  # 10-minute timeout
        )

        if result.returncode == 0:
            log.info("✓ boga_ai_bot completed successfully")
            return True
        else:
            log.error(f"✗ boga_ai_bot failed with code {result.returncode}")
            log.error(f"STDOUT: {result.stdout}")
            log.error(f"STDERR: {result.stderr}")
            return False

    except subprocess.TimeoutExpired:
        log.error("✗ boga_ai_bot timed out (exceeded 10 minutes)")
        return False
    except Exception as e:
        log.error(f"✗ Error running boga_ai_bot: {e}")
        return False


async def run_7day_cycle(days: int = 7):
    """
    Main 7-day cycle runner.
    Runs boga_ai_bot.py at 09:00 NY time each day for `days` consecutive days.
    """
    log.info("=" * 70)
    log.info(f"BOGA AI 7-Day Analysis Runner Started")
    log.info(f"Running {days} consecutive days at {DAILY_RUN_HOUR:02d}:{DAILY_RUN_MINUTE:02d} NY time")
    log.info("=" * 70)

    run_count = 0
    success_count = 0
    market_open_count = 0
    market_closed_count = 0

    for day_num in range(1, days + 1):
        now = datetime.now(NY_TZ)

        # Calculate wait time until next run
        wait_seconds = await wait_until_next_run(DAILY_RUN_HOUR, DAILY_RUN_MINUTE)
        next_run_time = datetime.now(NY_TZ) + timedelta(seconds=wait_seconds)

        log.info("-" * 70)
        log.info(f"Day {day_num}/{days}")
        log.info(f"Current time: {now.strftime('%Y-%m-%d %H:%M:%S %Z')}")
        log.info(f"Next run: {next_run_time.strftime('%Y-%m-%d %H:%M:%S %Z')}")
        log.info(f"Waiting {int(wait_seconds):,} seconds ({int(wait_seconds/60):.1f} minutes)...")

        # Wait until scheduled run time
        await asyncio.sleep(wait_seconds)

        # Check market status at run time
        is_open = is_market_open()
        status = "OPEN" if is_open else "CLOSED"
        log.info(f"Market Status: {status}")

        if is_open:
            market_open_count += 1
            log.info("Using LIVE prices from yfinance")
        else:
            market_closed_count += 1
            log.info("Using PREVIOUS CLOSE prices (market is closed)")

        # Run the bot
        run_count += 1
        success = await run_boga_ai_bot()
        if success:
            success_count += 1
            log.info(f"✓ Day {day_num} completed successfully")
        else:
            log.warning(f"⚠ Day {day_num} failed (analysis may be incomplete)")

        # After each run (except the last), add delay before next iteration
        if day_num < days:
            # Wait 65 seconds to avoid re-triggering in the same minute
            log.info("Waiting 65 seconds before next iteration...")
            await asyncio.sleep(65)

    # Summary
    log.info("=" * 70)
    log.info("BOGA AI ANALYSIS COMPLETE")
    log.info(f"Days run: {run_count}/{days}")
    log.info(f"Successful runs: {success_count}/{run_count}")
    log.info(f"Market open days: {market_open_count}")
    log.info(f"Market closed days: {market_closed_count}")
    log.info("=" * 70)

    return success_count == run_count


def main():
    """
    Entry point for 7-day runner.
    Can be called with optional argument: --days N (default 7)

    Usage:
        python run_7day_analysis.py          # Run 7 days
        python run_7day_analysis.py --days 3 # Run 3 days
    """
    days = 7

    # Parse command line arguments
    if len(sys.argv) > 1:
        if sys.argv[1] == "--days" and len(sys.argv) > 2:
            try:
                days = int(sys.argv[2])
                if days < 1 or days > 365:
                    log.error("Days must be between 1 and 365")
                    sys.exit(1)
            except ValueError:
                log.error(f"Invalid days value: {sys.argv[2]}")
                sys.exit(1)
        elif sys.argv[1] in ["--help", "-h"]:
            print("Usage: python run_7day_analysis.py [--days N]")
            print("  Runs BOGA AI bot daily for N consecutive days (default 7)")
            sys.exit(0)
        else:
            log.error(f"Unknown argument: {sys.argv[1]}")
            sys.exit(1)

    # Run the 7-day cycle
    try:
        success = asyncio.run(run_7day_cycle(days))
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        log.info("7-day runner interrupted by user")
        sys.exit(130)
    except Exception as e:
        log.error(f"Unexpected error: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
