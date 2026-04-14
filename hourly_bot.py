import time
import subprocess
import logging
import sys
from datetime import datetime

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')

def run_performance_update():
    logging.info("🚀 Starting hourly performance update...")
    try:
        # Run the update_swing_performance script using the same interpreter
        result = subprocess.run([sys.executable, "update_swing_performance.py"], capture_output=True, text=True)
        if result.returncode == 0:
            logging.info("✅ Performance update completed successfully.")
            logging.info(result.stdout)
        else:
            logging.error(f"❌ Performance update failed with exit code {result.returncode}")
            logging.error(result.stderr)
    except Exception as e:
        logging.error(f"❌ Error running performance update: {e}")

def main():
    logging.info("🤖 BOGA AI Hourly Bot started.")
    while True:
        run_performance_update()
        
        # Wait for 1 hour (3600 seconds)
        logging.info("😴 Waiting for 1 hour...")
        time.sleep(3600)

if __name__ == "__main__":
    main()
