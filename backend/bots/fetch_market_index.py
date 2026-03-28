#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Google Finance ve Yahoo Finance'tan market index verilerini çeker
Eğer API başarısız olursa, fallback HTML scraping kullanır
"""

import json
import sys
import os
from datetime import datetime
from pathlib import Path
import urllib.request
import urllib.error
from urllib.parse import quote

# Set UTF-8 encoding for stdout on Windows
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# Symbols to fetch
SYMBOLS = {
    '^GSPC': {'label': 'S&P 500', 'sublabel': 'SPX'},
    '^IXIC': {'label': 'NASDAQ', 'sublabel': 'COMP'},
    '^DJI': {'label': 'DOW', 'sublabel': 'DJI'},
    '^RUT': {'label': 'Russell 2000', 'sublabel': 'RUT'},
    '^VIX': {'label': 'VIX', 'sublabel': 'VIX'},
}

OUTPUT_DIR = Path(__file__).parent / 'output'
OUTPUT_FILE = OUTPUT_DIR / 'market_index.json'


def get_comment(label: str, pct: float) -> str:
    """Get Turkish comment based on percentage change"""
    if label == 'S&P 500':
        if pct > 1.5: return 'Güçlü ralli'
        if pct > 0.5: return 'Yükselen trend'
        if pct > 0: return 'Hafif pozitif'
        if pct > -0.5: return 'Temkinli seyir'
        if pct > -1.5: return 'Baskı devam'
        return 'Sert satış'

    if label == 'NASDAQ':
        if pct > 1.5: return 'Tech rallisi'
        if pct > 0.5: return 'Momentum güçlü'
        if pct > 0: return 'Hafif alım'
        if pct > -0.5: return 'Duraksıyor'
        if pct > -1.5: return 'Baskı var'
        return 'Tech satışı'

    if label == 'DOW':
        if pct > 1: return 'Sanayi güçlü'
        if pct > 0: return 'Hafif pozitif'
        if pct > -1: return 'Temkinli seyir'
        return 'Sanayi geriliyor'

    if label == 'Russell 2000':
        if pct > 1.5: return 'Küçük cap rallisi'
        if pct > 0.5: return 'Küçük cap güçlü'
        if pct > 0: return 'Hafif alım'
        if pct > -0.5: return 'Temkinli'
        if pct > -1.5: return 'Baskı var'
        return 'Küçük cap satışı'

    if label == 'VIX':
        if pct > 20: return 'Yüksek korku'
        if pct > 15: return 'Korku artıyor'
        if pct > 10: return 'Volatilite yükseliyor'
        if pct > 0: return 'Risk farkındalığı'
        if pct > -10: return 'Sakinlik'
        return 'Çok sakin'

    return 'Yükseliyor' if pct >= 0 else 'Geriyor'


def fetch_from_google_finance(symbol: str) -> dict | None:
    """Fetch data from Google Finance"""
    try:
        # Google Finance URL
        url = f"https://www.google.com/finance/quote/{quote(symbol)}"

        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }

        req = urllib.request.Request(url, headers=headers)

        with urllib.request.urlopen(req, timeout=5) as response:
            html = response.read().decode('utf-8')

            # Look for percentage data in HTML
            import re

            # Try multiple patterns
            patterns = [
                r'data-change-percent="([+-]?\d+\.?\d*)"',
                r'"regularMarketChangePercent":"([+-]?\d+\.?\d*)"',
                r'>([+-]?\d+\.?\d*)%<',
                r'aria-label="[^"]*Change ([+-]?\d+\.?\d*)%[^"]*"',
            ]

            for pattern in patterns:
                match = re.search(pattern, html)
                if match:
                    try:
                        pct = float(match.group(1))
                        return {'change_pct': pct, 'source': 'google'}
                    except (ValueError, IndexError):
                        continue

        return None
    except Exception as e:
        print(f"Error fetching {symbol} from Google Finance: {e}")
        return None


def fetch_from_yfinance(symbol: str) -> dict | None:
    """Fetch data using yfinance (requires yfinance package)"""
    try:
        import yfinance as yf
        ticker = yf.Ticker(symbol)
        data = ticker.history(period='1d')

        if not data.empty:
            current = ticker.info.get('currentPrice', data['Close'].iloc[-1])
            prev_close = ticker.info.get('previousClose', data['Open'].iloc[0])

            if current and prev_close:
                change_pct = ((current - prev_close) / prev_close) * 100
                return {'change_pct': change_pct, 'source': 'yfinance'}

        return None
    except ImportError:
        return None
    except Exception as e:
        print(f"Error fetching {symbol} from yfinance: {e}")
        return None


def fetch_market_data():
    """Fetch market data from multiple sources"""
    results = []

    for symbol, info in SYMBOLS.items():
        data = None

        # Try Google Finance first
        print(f"Fetching {symbol}...", end=' ')
        data = fetch_from_google_finance(symbol)

        # Try yfinance if Google Finance fails
        if not data:
            data = fetch_from_yfinance(symbol)

        if data:
            pct = data['change_pct']
            pct_str = f"+{pct:.2f}%" if pct >= 0 else f"{pct:.2f}%"
            direction = 'up' if pct >= 0 else 'down'

            result = {
                'symbol': symbol,
                'label': info['label'],
                'sublabel': info['sublabel'],
                'pct': pct_str,
                'dir': direction,
                'comment': get_comment(info['label'], pct),
                'raw_pct': pct,
            }
            results.append(result)
            print(f"[OK] {pct_str}")
        else:
            print(f"[FAIL] Fallback")

    return results


def save_results(data: list):
    """Save results to JSON file"""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    output = {
        'indices': data,
        'updated_at': datetime.now().isoformat(),
    }

    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"\n[OK] Saved to {OUTPUT_FILE}")


if __name__ == '__main__':
    print("Fetching market indices from Google Finance...")
    data = fetch_market_data()

    if data:
        save_results(data)
        sys.exit(0)
    else:
        print("✗ Failed to fetch data")
        sys.exit(1)
