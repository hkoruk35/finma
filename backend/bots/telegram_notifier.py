import sys
import os
import asyncio
import aiohttp
import pandas as pd
import time
from datetime import datetime

# Add Parent Directory to Path to import modules from root
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from trade_manager import TradeManager

# Telegram Config
TELEGRAM_API_KEY = "8501733970:AAHM1l2wkPRKOWQdtq8jRqWZazGQhYteH5k"
TELEGRAM_CHAT_ID = "-1003569445341"

# Formatting Helpers
def format_currency(val):
    try:
        if pd.isna(val) or val == "": return "$0.00"
        return f"${float(val):,.2f}"
    except: return str(val)

def format_percentage(val):
    try:
        if pd.isna(val) or val == "": return "0.00%"
        return f"{float(val):.2f}%"
    except: return str(val)

async def send_telegram_message(message: str):
    """Sends a message to the Telegram chat."""
    if not TELEGRAM_API_KEY:
        print("Telegram API Key missing.")
        return

    url = f"https://api.telegram.org/bot{TELEGRAM_API_KEY}/sendMessage"
    
    # Simple split if too long (Telegram limit ~4096)
    max_len = 4000
    messages = [message[i:i+max_len] for i in range(0, len(message), max_len)]
    
    async with aiohttp.ClientSession() as session:
        for part in messages:
            payload = {
                "chat_id": TELEGRAM_CHAT_ID,
                "text": part,
                "parse_mode": "HTML"
            }
            try:
                async with session.post(url, data=payload) as resp:
                    if resp.status != 200:
                        print(f"Error sending message: {await resp.text()}")
                    else:
                        print("Message sent successfully.")
            except Exception as e:
                print(f"Connection error: {e}")

def construct_table_message(df):
    """Formats the DataFrame as an HTML table for Telegram."""
    if df.empty:
        return "🔔 <b>Antigravity Notification</b>\n\nNo active operations at the moment."
    
    # Columns to display - Mapping to "Active Operation Zone 4" likely view
    # Based on user request, they want specific columns. 
    # Let's infer from standard Dashboard or Cockpit view.
    # Usually: ID, Ticker, Direction, Entry, Current, PnL
    
    # Let's grab relevant columns
    cols_to_keep = ["ticker", "direction", "entry_price", "current_price", "pnl_unrealized", "day_pnl_pct"]
    
    # Ensure they exist
    for c in cols_to_keep:
        if c not in df.columns: df[c] = "N/A"
        
    lines = ["🔔 <b>Active Operation Zone 4 Report</b>", f"<i>{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</i>", ""]
    lines.append("<pre>")
    
    # Header
    # Ticker | Dir | Entry | Curr | PnL
    header = f"{'SYM':<6} {'DIR':<5} {'ENTRY':<8} {'CURR':<8} {'PNL':<8}"
    lines.append(header)
    lines.append("-" * len(header))
    
    total_pnl = 0.0
    
    for _, row in df.iterrows():
        sym = str(row['ticker'])[:6]
        dire = str(row['direction'])[:1] # L or S
        entry = f"{float(row['entry_price']):.2f}"
        curr = f"{float(row['current_price']):.2f}"
        pnl = float(row['pnl_unrealized'])
        total_pnl += pnl
        
        # Color coding isn't supported in <pre>, just text
        line = f"{sym:<6} {dire:<5} {entry:<8} {curr:<8} {pnl:+,.1f}"
        lines.append(line)
        
    lines.append("-" * len(header))
    lines.append(f"TOTAL PnL: ${total_pnl:+,.2f}")
    lines.append("</pre>")
    
    return "\n".join(lines)

def run_once():
    print("Starting Telegram Notifier...")
    tm = TradeManager()
    
    # Fetch Active Data
    print("Fetching active trades...")
    df = tm.get_active_df()
    
    msg = construct_table_message(df)
    
    # Send
    asyncio.run(send_telegram_message(msg))

def main_loop():
    # --- SINGLETON CHECK (MSVCRT Locking) ---
    LOCK_FILE = os.path.join(os.path.dirname(__file__), "telegram_notifier.lock")
    
    # Check if lock file exists, if not create it
    if not os.path.exists(LOCK_FILE):
        open(LOCK_FILE, 'w').close()
        
    try:
        import msvcrt
        lock_fp = open(LOCK_FILE, 'r+')
        # Try to lock the file. LK_NBLCK throws error if locked.
        msvcrt.locking(lock_fp.fileno(), msvcrt.LK_NBLCK, 1)
        
        # Write PID for info purposes (not logic)
        lock_fp.seek(0)
        lock_fp.truncate()
        lock_fp.write(str(os.getpid()))
        lock_fp.flush()
        
        print(f"Acquired Lock. PID: {os.getpid()}")
        
    except IOError:
        print(f"⚠️ Telegram Notifier is already running. Could not acquire lock on {LOCK_FILE}. Exiting.")
        return # Exit this instance
    except Exception as e:
        print(f"Lock error: {e}")
        return

    print(f"Initializing Telegram Notifier Loop (PID: {os.getpid()})...")
    print("Schedule: Weekdays 09:30 - 16:00")
    
    # Send startup message
    asyncio.run(send_telegram_message("🤖 <b>Antigravity Bot Started</b>\nMonitoring Active Operations (M-F 09:30-16:00)."))
    
    while True:
        try:
            now = datetime.now()
            
            # 1. Weekday Check (0=Monday, 6=Sunday)
            if now.weekday() > 4: # If Saturday (5) or Sunday (6)
                print("Weekend. Sleeping for 1 hour...")
                time.sleep(3600)
                continue
                
            # 2. Time Check
            current_time = now.time()
            start_time = datetime.strptime("09:30", "%H:%M").time()
            end_time = datetime.strptime("16:00", "%H:%M").time()
            
            if start_time <= current_time <= end_time:
                print(f"Market Open ({current_time}). Running scan...")
                run_once()
                # Wait 15 minutes
                print("Sleeping for 15 minutes...")
                time.sleep(15 * 60)
            else:
                # Outside hours
                if current_time < start_time:
                    print(f"Before Market Open ({current_time}). Waiting...")
                else:
                    print(f"After Market Close ({current_time}). Waiting...")
                
                time.sleep(60) # Check every minute
                
        except Exception as e:
            print(f"Error in loop: {e}")
            time.sleep(60)

if __name__ == "__main__":
    # Ensure psutil is installed (it is in requirements usually, but good to handle import if needed)
    try:
        import psutil
    except ImportError:
        print("Installing psutil...")
        os.system("pip install psutil")
        import psutil
        
    main_loop()
