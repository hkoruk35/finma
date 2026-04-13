#!/usr/bin/env python3
"""
Quick run script to execute BOGA AI bot immediately without waiting for scheduler.
"""
import asyncio
import sys
import os

# Add the current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Import the daily_run function
from finma_bot import daily_run

if __name__ == "__main__":
    print("🚀 BOGA AI Manual Trigger: Starting daily run...")
    asyncio.run(daily_run())
