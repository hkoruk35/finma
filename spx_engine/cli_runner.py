"""
SPX Live Engine — CLI Runner for Next.js API Routes
Outputs latest snapshot or session replay data as raw JSON.
Usage:
  python spx_engine/cli_runner.py snapshot
  python spx_engine/cli_runner.py replay --date 2026-08-15
"""

import sys
import os
import json
import argparse

# Add parent directory to sys.path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from spx_engine.worker import SPXBackgroundWorker
from spx_engine.storage import SPXStorageManager
from spx_engine.analytics_replay import SPXSessionReplayEngine
from spx_engine.data_provider import YFinanceProvider

def get_snapshot():
    storage = SPXStorageManager()
    worker = SPXBackgroundWorker(storage_mgr=storage)
    snapshot = worker.run_single_cycle()
    print(json.dumps(snapshot, indent=2))

def get_replay(date_str):
    storage = SPXStorageManager()
    provider = YFinanceProvider()
    es_df = provider.fetch_intraday_candles("ES", "1m", lookback_days=5)
    spx_df = provider.fetch_intraday_candles("SPX", "1m", lookback_days=5)
    
    replay_engine = SPXSessionReplayEngine(storage)
    snapshots = replay_engine.run_historical_replay(es_df, spx_df, date_str)
    report = replay_engine.generate_daily_session_review(date_str, snapshots)
    
    output = {
        "date": date_str,
        "snapshot_count": len(snapshots),
        "snapshots": snapshots,
        "daily_review_markdown": report
    }
    print(json.dumps(output, indent=2))

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="SPX Live Engine CLI Runner")
    parser.add_argument("mode", choices=["snapshot", "replay"], help="Execution mode")
    parser.add_argument("--date", type=str, default="2026-08-15", help="Target replay date (YYYY-MM-DD)")
    
    args = parser.parse_args()
    
    if args.mode == "snapshot":
        get_snapshot()
    elif args.mode == "replay":
        get_replay(args.date)
