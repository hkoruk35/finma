#!/usr/bin/env python3
"""
create_archive_snapshots.py
---------------------------
Populates empty archive date folders with master.json snapshots from /latest
Ensures the archive mechanism works correctly on the frontend.
"""

import json
import shutil
import logging
from pathlib import Path
from datetime import datetime

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

# Paths
BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "frontend" / "public" / "data"
LATEST_DIR = DATA_DIR / "latest"
LATEST_MASTER = LATEST_DIR / "master.json"

def load_latest_master():
    """Load master.json from /latest"""
    if not LATEST_MASTER.exists():
        log.error(f"master.json not found in {LATEST_DIR}")
        return None

    with open(LATEST_MASTER, 'r', encoding='utf-8') as f:
        return json.load(f)

def populate_archive_folders():
    """Populate empty date folders with master.json snapshot"""
    master_data = load_latest_master()
    if not master_data:
        return 0

    populated = 0

    # Find all date folders (YYYY-MM-DD format)
    date_folders = sorted([d for d in DATA_DIR.glob("20??-??-??") if d.is_dir()])

    for date_dir in date_folders:
        date_str = date_dir.name
        master_path = date_dir / "master.json"

        # Skip if master.json already exists
        if master_path.exists():
            log.debug(f"  {date_str}: master.json already exists")
            continue

        # Create master.json in this date folder
        try:
            with open(master_path, 'w', encoding='utf-8') as f:
                json.dump(master_data, f, indent=2, ensure_ascii=False)
            log.info(f"  {date_str}: Created master.json")
            populated += 1
        except Exception as e:
            log.error(f"  {date_str}: Failed to create master.json - {e}")

    return populated

def main():
    log.info("Starting archive snapshot population...")

    if not LATEST_MASTER.exists():
        log.error("Cannot proceed: /latest/master.json not found")
        return 1

    populated = populate_archive_folders()

    log.info(f"Archive population complete: {populated} folders updated")
    log.info("Archive mechanism is now functional")

    return 0

if __name__ == "__main__":
    exit(main())
