import sys
import os

# Add backend to path
sys.path.append(r"C:\Users\afksm\finma\backend")

try:
    from app.services.market_data import get_ticker_info, get_market_movers
except ImportError as e:
    print(f"Import error: {e}")
    sys.exit(1)

def test():
    print("Testing get_ticker_info('CGON')...")
    info = get_ticker_info("CGON")
    print(f"Result: {info.get('symbol')} - Price: {info.get('price')} - PE: {info.get('pe_ratio')}")
    
    print("\nTesting get_market_movers('1d')...")
    movers = get_market_movers("1d")
    print(f"Gainers: {len(movers.get('gainers', []))}")
    if movers.get('gainers'):
        print(f"First gainer: {movers['gainers'][0]}")
    
    print(f"Losers: {len(movers.get('losers', []))}")
    print(f"Volume: {len(movers.get('volume', []))}")

if __name__ == "__main__":
    test()
