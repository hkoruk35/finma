import time
import subprocess
import logging
import sys
import os
from datetime import datetime
from zoneinfo import ZoneInfo

# Configuration
NY_TZ = ZoneInfo("America/New_York")
LOG_DIR = os.path.join(os.path.dirname(__file__), "logs")
os.makedirs(LOG_DIR, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(os.path.join(LOG_DIR, "master_bot.log"), encoding='utf-8')
    ]
)

def is_market_hours():
    """Check if current time is within NY market hours (9:30 AM - 4:00 PM)."""
    now = datetime.now(NY_TZ)
    # Weekdays only (0=Mon, 6=Sun)
    if now.weekday() > 4:
        return False
    
    current_time = now.time()
    start_time = datetime.strptime("09:30", "%H:%M").time()
    end_time = datetime.strptime("16:00", "%H:%M").time()
    
    return start_time <= current_time <= end_time

def run_script(script_name):
    """Run a python script and log the output."""
    logging.info(f"▶ [{script_name}] starting...")
    try:
        result = subprocess.run([sys.executable, script_name], capture_output=True, text=True)
        if result.returncode == 0:
            logging.info(f"✅ [{script_name}] completed successfully.")
            return True, result.stdout
        else:
            logging.error(f"❌ [{script_name}] failed with code {result.returncode}")
            logging.error(result.stderr)
            return False, result.stderr
    except Exception as e:
        logging.error(f"❌ [{script_name}] exception: {e}")
        return False, str(e)

def main():
    logging.info("🤖 BOGA AI Master Orchestrator Bot started.")
    
    # Track when tasks were last run
    last_perf_update = 0
    last_health_check = 0
    
    while True:
        now = time.time()
        
        # 1. SITE HEALTH CHECKER - Every 2 Hours (7200 seconds)
        if now - last_health_check >= 7200:
            logging.info("🔍 Running bi-hourly health check...")
            success, output = run_script("site_health_checker.py")
            last_health_check = now
            
            # If health check reports critical errors (X or ⚠️ in output but let's check for specific trigger)
            if "❌" in output or " Analiz Dosyası Yok" in output:
                logging.warning("🚨 Issues detected! Triggering deep summary update...")
                run_script("update_summaries_now.py")

        # 2. PERFORMANCE UPDATE - Every Hour (3600 seconds)
        # Requirement: Must be during market hours
        if now - last_perf_update >= 3600:
            if is_market_hours():
                logging.info("📈 Running hourly performance update (Market Open)...")
                run_script("update_swing_performance.py")
                last_perf_update = now
            else:
                logging.info("💤 Market is closed. Skipping performance update.")
                # We update the timer anyway to check again in an hour
                last_perf_update = now

        # Check more frequently for the loop (every minute)
        time.sleep(60)

if __name__ == "__main__":
    main()
