"""
archive_analysis.py
===================
Archives the CURRENT swing picks before they are overwritten by a new run.

USAGE
-----
  # Run BEFORE updating swing_all_picks.json with new data:
  python archive_analysis.py

  # Or integrate directly in swing113_boga.py / daily_comprehensive_analysis.py:
  from archive_analysis import archive_current_picks
  archive_current_picks()          # archives current, then let the bot overwrite

HOW IT WORKS
------------
1. Reads frontend/public/swing_all_picks.json  (current 10 picks)
2. For each pick, writes:
     frontend/public/analysis-archive/<TICKER>/<DATE>.json
   where DATE comes from the "date" field in the JSON (e.g. "2026-04-17").
3. Skips a file if it already exists (idempotent — safe to run multiple times).

NEXT RUN BEHAVIOUR
------------------
Next time the swing bot produces new picks, call archive_current_picks() first.
If a ticker appears again, the old analysis is already archived under its date.
The Next.js static pages (generateStaticParams) will pick up new archive files
on the next Vercel build/deploy.
"""

import json
import os
import sys
from pathlib import Path

# Paths relative to repo root
REPO_ROOT = Path(__file__).parent
SWING_PICKS_PATH = REPO_ROOT / "frontend" / "public" / "swing_all_picks.json"
ARCHIVE_BASE = REPO_ROOT / "frontend" / "public" / "analysis-archive"


def archive_current_picks(dry_run: bool = False) -> list[str]:
    """
    Archive every pick in swing_all_picks.json.
    Returns list of newly written archive file paths.
    """
    if not SWING_PICKS_PATH.exists():
        print(f"[archive] ERROR: {SWING_PICKS_PATH} not found.")
        sys.exit(1)

    with open(SWING_PICKS_PATH, encoding="utf-8") as f:
        data = json.load(f)

    picks = data.get("picks", [])
    date_str = data.get("date", "")

    if not date_str:
        from datetime import date as dt
        date_str = dt.today().isoformat()
        print(f"[archive] WARNING: no 'date' field in JSON — using today: {date_str}")

    if not picks:
        print("[archive] No picks found — nothing to archive.")
        return []

    written = []
    for pick in picks:
        ticker = pick.get("ticker", "UNKNOWN").upper()
        ticker_dir = ARCHIVE_BASE / ticker
        archive_path = ticker_dir / f"{date_str}.json"

        if archive_path.exists():
            print(f"[archive] SKIP  {ticker}/{date_str}.json (already exists)")
            continue

        if dry_run:
            print(f"[archive] DRY   would write {archive_path}")
        else:
            ticker_dir.mkdir(parents=True, exist_ok=True)
            with open(archive_path, "w", encoding="utf-8") as f:
                json.dump(pick, f, ensure_ascii=False, indent=2)
            print(f"[archive] WROTE {ticker}/{date_str}.json  (score={pick.get('score','?')})")
            written.append(str(archive_path))

    print(f"[archive] Done — {len(written)} file(s) written for date {date_str}.")
    return written


if __name__ == "__main__":
    dry = "--dry-run" in sys.argv or "-n" in sys.argv
    if dry:
        print("[archive] DRY RUN — no files will be written.\n")
    archive_current_picks(dry_run=dry)
