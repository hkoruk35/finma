# BOGA AI Daily 100 — AI-Powered US Stock Analysis Platform
## Master Architecture & Implementation Plan v1.0
**Prepared:** April 2026 | **Status:** Pre-Development | **Author:** AFK DaSYS

---

## TABLE OF CONTENTS

1. [Executive Summary](#1-executive-summary)
2. [Fixed 100-Stock Universe](#2-fixed-100-stock-universe)
3. [Bot Architecture (boga_ai_bot.py)](#3-bot-architecture)
4. [Scoring System](#4-scoring-system)
5. [Menu Categories & Algorithms](#5-menu-categories--algorithms)
6. [JSON Data Architecture](#6-json-data-architecture)
7. [File & Folder Structure](#7-file--folder-structure)
8. [Website Architecture (bogastock.com)](#8-website-architecture)
9. [Page-by-Page Design Spec](#9-page-by-page-design-spec)
10. [SEO Strategy](#10-seo-strategy)
11. [Ad Banner Placements](#11-ad-banner-placements)
12. [Admin Panel](#12-admin-panel)
13. [Member System](#13-member-system)
14. [Smart Watchlist & Notifications](#14-smart-watchlist--notifications)
15. [TradingView Integration](#15-tradingview-integration)
16. [Gemini AI Integration](#16-gemini-ai-integration)
17. [Legal & Compliance (SEC/FINRA)](#17-legal--compliance)
18. [Mobile & PWA Design](#18-mobile--pwa-design)
19. [Social Sharing](#19-social-sharing)
20. [Contact & Communication](#20-contact--communication)
21. [Development Phases & Timeline](#21-development-phases--timeline)
22. [Tech Stack Summary](#22-tech-stack-summary)

---

## 1. EXECUTIVE SUMMARY

**BOGA AI Daily 100** is an AI-powered US stock analysis platform that analyzes a fixed universe of 100 carefully selected, high-volume US equities every business day at 9:00 AM New York time.

### Core Value Proposition
- **Daily fresh analysis** of the same 100 stocks — consistency allows trend tracking
- **7 analysis categories** each with AI-generated summaries
- **Composite scoring** (0–100) combining technical, fundamental, momentum, and sentiment signals
- **Free membership** with smart watchlist (10 stocks) and push notifications
- **Archive access** for members — historical daily snapshots
- **No paid tiers** at launch — monetized via display advertising

### Platform Goals
- Become the go-to daily briefing for retail investors tracking top US growth stocks
- SEO-driven organic traffic via stock-specific pages and daily analysis
- Ad revenue from finance-adjacent advertisers
- Future: Premium tier, broker integration, mobile app

---

## 2. FIXED 100-STOCK UNIVERSE

The 100 stocks are permanent. They are not swapped daily. The bot always scans exactly these tickers.

### Technology (22 stocks)
| # | Ticker | Company |
|---|--------|---------|
| 1 | AAPL | Apple Inc. |
| 2 | MSFT | Microsoft Corp. |
| 3 | NVDA | NVIDIA Corp. |
| 4 | GOOGL | Alphabet Inc. |
| 5 | META | Meta Platforms |
| 6 | AMZN | Amazon.com |
| 7 | TSLA | Tesla Inc. |
| 8 | AMD | Advanced Micro Devices |
| 9 | AVGO | Broadcom Inc. |
| 10 | ORCL | Oracle Corp. |
| 11 | ADBE | Adobe Inc. |
| 12 | CRM | Salesforce Inc. |
| 13 | QCOM | Qualcomm |
| 14 | MU | Micron Technology |
| 15 | NOW | ServiceNow |
| 16 | SNOW | Snowflake |
| 17 | PLTR | Palantir Technologies |
| 18 | MSTR | MicroStrategy |
| 19 | ARM | ARM Holdings |
| 20 | UBER | Uber Technologies |
| 21 | NET | Cloudflare |
| 22 | PANW | Palo Alto Networks |

### Financials (10 stocks)
| # | Ticker | Company |
|---|--------|---------|
| 23 | JPM | JPMorgan Chase |
| 24 | BAC | Bank of America |
| 25 | GS | Goldman Sachs |
| 26 | MS | Morgan Stanley |
| 27 | V | Visa Inc. |
| 28 | MA | Mastercard |
| 29 | PYPL | PayPal Holdings |
| 30 | COIN | Coinbase Global |
| 31 | BX | Blackstone Inc. |
| 32 | BLK | BlackRock Inc. |

### Healthcare (10 stocks)
| # | Ticker | Company |
|---|--------|---------|
| 33 | LLY | Eli Lilly |
| 34 | UNH | UnitedHealth Group |
| 35 | JNJ | Johnson & Johnson |
| 36 | ABBV | AbbVie Inc. |
| 37 | MRK | Merck & Co. |
| 38 | PFE | Pfizer Inc. |
| 39 | AMGN | Amgen Inc. |
| 40 | GILD | Gilead Sciences |
| 41 | ISRG | Intuitive Surgical |
| 42 | DXCM | DexCom Inc. |

### Consumer Discretionary (8 stocks)
| # | Ticker | Company |
|---|--------|---------|
| 43 | NKE | Nike Inc. |
| 44 | SBUX | Starbucks Corp. |
| 45 | MCD | McDonald's Corp. |
| 46 | COST | Costco Wholesale |
| 47 | NFLX | Netflix Inc. |
| 48 | DIS | Walt Disney Co. |
| 49 | ABNB | Airbnb Inc. |
| 50 | BKNG | Booking Holdings |

### Industrials & Defense (8 stocks)
| # | Ticker | Company |
|---|--------|---------|
| 51 | CAT | Caterpillar Inc. |
| 52 | DE | Deere & Company |
| 53 | BA | Boeing Co. |
| 54 | RTX | RTX Corp. |
| 55 | LMT | Lockheed Martin |
| 56 | GE | GE Aerospace |
| 57 | HON | Honeywell Intl. |
| 58 | UPS | United Parcel Service |

### Communication Services (5 stocks)
| # | Ticker | Company |
|---|--------|---------|
| 59 | T | AT&T Inc. |
| 60 | VZ | Verizon Communications |
| 61 | TMUS | T-Mobile US |
| 62 | SPOT | Spotify Technology |
| 63 | SNAP | Snap Inc. |

### Energy (7 stocks)
| # | Ticker | Company |
|---|--------|---------|
| 64 | XOM | Exxon Mobil |
| 65 | CVX | Chevron Corp. |
| 66 | COP | ConocoPhillips |
| 67 | OXY | Occidental Petroleum |
| 68 | SLB | SLB (Schlumberger) |
| 69 | FANG | Diamondback Energy |
| 70 | MPC | Marathon Petroleum |

### Consumer Staples (5 stocks)
| # | Ticker | Company |
|---|--------|---------|
| 71 | WMT | Walmart Inc. |
| 72 | PG | Procter & Gamble |
| 73 | KO | Coca-Cola Co. |
| 74 | PEP | PepsiCo Inc. |
| 75 | MDLZ | Mondelez Intl. |

### Real Estate (5 stocks)
| # | Ticker | Company |
|---|--------|---------|
| 76 | PLD | Prologis Inc. |
| 77 | AMT | American Tower |
| 78 | EQIX | Equinix Inc. |
| 79 | SPG | Simon Property Group |
| 80 | O | Realty Income Corp. |

### Materials (5 stocks)
| # | Ticker | Company |
|---|--------|---------|
| 81 | FCX | Freeport-McMoRan |
| 82 | NEM | Newmont Corp. |
| 83 | LIN | Linde plc |
| 84 | APD | Air Products |
| 85 | NUE | Nucor Corp. |

### Utilities (5 stocks)
| # | Ticker | Company |
|---|--------|---------|
| 86 | NEE | NextEra Energy |
| 87 | DUK | Duke Energy |
| 88 | SO | Southern Co. |
| 89 | AEP | American Electric Power |
| 90 | EXC | Exelon Corp. |

### High-Growth / Special (10 stocks)
| # | Ticker | Company |
|---|--------|---------|
| 91 | SHOP | Shopify Inc. |
| 92 | SQ | Block Inc. |
| 93 | HOOD | Robinhood Markets |
| 94 | MARA | Marathon Digital |
| 95 | RBLX | Roblox Corp. |
| 96 | RIVN | Rivian Automotive |
| 97 | SOFI | SoFi Technologies |
| 98 | SMCI | Super Micro Computer |
| 99 | CELH | Celsius Holdings |
| 100 | IONQ | IonQ Inc. |

---

## 3. BOT ARCHITECTURE

### File: `boga_ai_bot.py` — Main Daily Runner

**Trigger:** Every weekday at 09:00 AM New York time (ET/EST)

### 3.1 Execution Flow

```
STEP 1 — SCHEDULER
  └── Wait until next weekday 09:00 NY
  └── Skip weekends automatically

STEP 2 — MARKET DATA FETCH (Yahoo Finance via yfinance)
  └── For each of 100 tickers:
      ├── OHLCV: 1d period, 200-day history
      ├── Fast Info: price, market cap, volume
      └── Fundamentals: P/E, P/B, D/E, FCF, EPS, dividend

STEP 3 — NEWS FETCH
  └── For each ticker: fetch last 5 news items from Yahoo Finance RSS
  └── Filter: last 7 days only
  └── Store: headline + url + published date + source

STEP 4 — INSIDER DATA
  └── Via yfinance .institutional_holders, .insider_transactions
  └── Store: last 3 months of insider buys/sells

STEP 5 — TECHNICAL INDICATORS (per ticker)
  └── RSI(14), MACD(12,26,9), EMA(20,50,200)
  └── Bollinger Bands(20,2), ATR(14), ADX(14)
  └── OBV, MFI(14), RVOL, Stochastic(14,3)
  └── BB Width (squeeze detection)
  └── CMF (Chaikin Money Flow)

STEP 6 — SCORING ENGINE
  └── technical_score (0–100)
  └── fundamental_score (0–100)
  └── momentum_score (0–100)
  └── sentiment_score (0–100)
  └── sector_score (0–100)
  └── master_score = weighted composite

STEP 7 — CATEGORY SCORING
  └── breakout_score, value_score, reversal_score
  └── momentum_score, dividend_score, signal_score

STEP 8 — MENU BUILDING
  └── For each of 7 menus:
      ├── Filter stocks meeting criteria
      ├── Sort by category score
      └── Select top 3–20

STEP 9 — SECTOR ANALYSIS
  └── Group by sector
  └── Calculate sector avg score & volume change
  └── Select top stocks per sector quota

STEP 10 — GEMINI AI SUMMARIES
  └── For each qualifying stock (in menus):
      └── Call Gemini 1.5 Flash API
      └── Generate 150-word English analysis
      └── Store: ai_summary field in JSON

STEP 11 — JSON GENERATION
  └── Individual stock JSONs: data/YYYY-MM-DD/stocks/TICKER.json
  └── Master JSON: data/YYYY-MM-DD/master.json
  └── Sectors JSON: data/YYYY-MM-DD/sectors.json
  └── Archive JSON: data/YYYY-MM-DD/all_tickers_list.json

STEP 12 — TRANSFER
  └── Copy to /transfer/latest/ (overwrite)
  └── Copy to /transfer/archive/YYYY-MM-DD/
  └── Create /transfer/archive/YYYY-MM-DD.zip

STEP 13 — LOG & REPORT
  └── Write logs/boga_ai_YYYY-MM-DD.log
  └── Print summary: X stocks analyzed, Y signals generated
```

### 3.2 Key Config Constants

```python
FIXED_100_TICKERS = [
    "AAPL","MSFT","NVDA","GOOGL","META","AMZN","TSLA","AMD","AVGO","ORCL",
    "ADBE","CRM","QCOM","MU","NOW","SNOW","PLTR","MSTR","ARM","UBER","NET","PANW",
    "JPM","BAC","GS","MS","V","MA","PYPL","COIN","BX","BLK",
    "LLY","UNH","JNJ","ABBV","MRK","PFE","AMGN","GILD","ISRG","DXCM",
    "NKE","SBUX","MCD","COST","NFLX","DIS","ABNB","BKNG",
    "CAT","DE","BA","RTX","LMT","GE","HON","UPS",
    "T","VZ","TMUS","SPOT","SNAP",
    "XOM","CVX","COP","OXY","SLB","FANG","MPC",
    "WMT","PG","KO","PEP","MDLZ",
    "PLD","AMT","EQIX","SPG","O",
    "FCX","NEM","LIN","APD","NUE",
    "NEE","DUK","SO","AEP","EXC",
    "SHOP","SQ","HOOD","MARA","RBLX","RIVN","SOFI","SMCI","CELH","IONQ"
]

GEMINI_API_KEY = "AIzaSyA6cu1eE5xyh2-1eEFEdZcMXY7MSzqIPnM"
GEMINI_MODEL = "gemini-1.5-flash"
DAILY_RUN_HOUR = 9   # New York time
DAILY_RUN_MINUTE = 0

DATA_DIR = "./data"
TRANSFER_DIR = "./transfer"
LOG_DIR = "./logs"
```

---

## 4. SCORING SYSTEM

### 4.1 Master Score Formula

```
master_score = (
    technical_score    * 0.35  +
    fundamental_score  * 0.25  +
    momentum_score     * 0.20  +
    sentiment_score    * 0.10  +
    sector_score       * 0.10
)
```

### 4.2 Technical Score Components (0–100)

| Indicator | Weight | Bullish Condition |
|-----------|--------|-------------------|
| RSI(14) | 15% | 45–70 range = optimal |
| MACD Histogram | 15% | Positive and rising |
| EMA Stack | 20% | Price > EMA20 > EMA50 > EMA200 |
| ADX | 15% | ADX > 25 = strong trend |
| BB Width | 10% | Narrow = squeeze (breakout prep) |
| RVOL | 15% | RVOL > 1.5 = high conviction |
| OBV Trend | 10% | OBV above 10-day avg and rising |

### 4.3 Fundamental Score Components (0–100)

| Metric | Weight | Bullish Condition |
|--------|--------|-------------------|
| P/E vs Sector | 25% | P/E < sector median |
| Price/Book | 15% | P/B < 3.0 |
| D/E Ratio | 15% | D/E < 1.0 |
| FCF Yield | 20% | FCF Yield > 3% |
| EPS Growth 5Y | 15% | EPS growth > 5%/yr |
| Insider Activity | 10% | Net insider buying |

### 4.4 Momentum Score Components (0–100)

| Indicator | Weight | Bullish Condition |
|-----------|--------|-------------------|
| OBV Trend | 20% | 20-day uptrend |
| MFI | 20% | MFI > 55 |
| 52W High Proximity | 20% | Within 10% of 52W high |
| Sector RS | 20% | Outperforming sector ETF 20d |
| Green Days (10d) | 20% | 6+ green candles in 10 days |

### 4.5 Sentiment Score Components (0–100)

| Metric | Weight | Bullish Condition |
|--------|--------|-------------------|
| Short Interest | 40% | Short ratio declining |
| Insider Buy Ratio | 35% | More buys than sells (3 months) |
| News Sentiment | 25% | No negative news in 7 days |

### 4.6 Signal Confidence Score

```
confidence = master_score / 100
signal_type:
  >= 0.85 → STRONG_BUY
  >= 0.70 → BUY
  >= 0.55 → NEUTRAL (watch)
  >= 0.40 → SELL
  <  0.40 → STRONG_SELL
```

---

## 5. MENU CATEGORIES & ALGORITHMS

### MENU 1: Breakout Potential (Patlama Potansiyeli)
**Max: 20 | Min: 3 stocks**

Scoring criteria:
- BB Band Width in lowest 20% of 52-week range → +30 pts
- Volume > 2× 5-day avg → +25 pts
- Price broke 20-day high or low → +20 pts
- ATR is expanding (today vs 5d avg) → +15 pts
- MACD positive crossover → +10 pts

Extra output fields:
- `squeeze_intensity`: LOW | MEDIUM | HIGH
- `breakout_direction`: UPWARD | DOWNWARD | UNCLEAR
- `previous_breakouts_2y`: count of historical breakouts

### MENU 2: Undervalued (Gerçek Değerinin Altında)
**Max: 20 | Min: 3 stocks**

Scoring criteria:
- P/E < sector median × 0.70 → +25 pts
- P/B < 2.0 (banks < 1.5) → +20 pts
- D/E < 0.5 → +15 pts
- FCF Yield > 5% for 3 consecutive years → +25 pts
- EPS growth > 5%/yr for 5 years → +15 pts

Extra output fields:
- `intrinsic_value_estimate`: DCF-based fair value
- `margin_of_safety`: % discount to intrinsic value
- `value_catalyst`: description of potential catalyst

### MENU 3: Reversal (Dipten Dönüş)
**Max: 20 | Min: 3 stocks**

Scoring criteria:
- RSI(14) < 30 → +30 pts
- Bullish divergence (price down, RSI up) → +25 pts
- Price testing 200 SMA or annual low → +20 pts
- Volume spike on down day (seller exhaustion) → +15 pts
- MACD crossing up below zero line → +10 pts

Extra output fields:
- `risk_level`: ALWAYS "HIGH"
- `stop_loss`: 2× ATR below entry
- `signal_validity_days`: 5 trading days
- `high_risk_label`: true

### MENU 4: Momentum
**Max: 20 | Min: 3 stocks**

Scoring criteria:
- OBV above 20-day avg and rising → +20 pts
- MFI > 60 → +20 pts
- Institutional ownership increased > 2% last quarter → +20 pts
- Short ratio declining → +20 pts
- Within 10% of 52-week high → +20 pts

Extra output fields:
- `institutional_buying`: boolean
- `sector_relative_strength`: float
- `days_in_uptrend`: int

### MENU 5: Passive Income / Dividend
**Max: 20 | Min: 3 stocks**

Scoring criteria:
- Dividend Yield > 3% → +25 pts
- 5 consecutive years of dividend growth → +25 pts
- Payout Ratio 30–70% → +20 pts
- FCF / Dividend Payment > 1.5× → +20 pts
- Beta < 0.8 → +10 pts

Extra output fields:
- `next_dividend_date`: date string
- `annual_dividend_per_share`: float
- `dividend_safety_score`: 0–100
- `dividend_growth_rate_5y`: % per year

### MENU 6: Top Signals (Günün En Güçlü Sinyalleri)
**Max: 20 | Min: 3 stocks**

Algorithm: Stocks that appear in 2+ other menus get priority. Then:
- RVOL > 1.5 → +20 pts
- Daily price change > ±2% → +20 pts
- EMA20 crossover → +20 pts
- RSI > 55 (buy) or < 45 (sell) → +20 pts
- Volume increase > 30% vs 3-day avg → +20 pts

Minimum confidence: 0.85 for inclusion
Output: Full signal card with entry_range, target, stop_loss, TTL

### MENU 7: Sector Analysis
**Fixed quotas — top stocks per sector**

| Sector | Quota |
|--------|-------|
| Technology | 5 |
| Financials | 5 |
| Healthcare | 5 |
| Consumer Discretionary | 5 |
| Industrials | 5 |
| Communication Services | 5 |
| Energy | 5 |
| Consumer Staples | 3 |
| Utilities | 3 |
| Real Estate | 3 |
| Materials | 3 |

**Total sector stocks: 47** → this number feeds the "Active Signals" counter on homepage

---

## 6. JSON DATA ARCHITECTURE

### 6.1 Individual Stock JSON (`stocks/TICKER.json`)

```json
{
  "ticker": "AAPL",
  "company": "Apple Inc.",
  "date": "2026-04-08",
  "generated_at": "2026-04-08T09:05:32-05:00",
  "sector": "Technology",
  "industry": "Consumer Electronics",

  "price": {
    "current": 195.50,
    "open": 193.20,
    "high": 196.80,
    "low": 192.50,
    "prev_close": 194.10,
    "change": 1.40,
    "change_pct": 0.72,
    "volume": 62450000,
    "avg_volume_30d": 58000000
  },

  "scores": {
    "master_score": 78.4,
    "technical_score": 82.1,
    "fundamental_score": 71.3,
    "momentum_score": 79.5,
    "sentiment_score": 68.0,
    "sector_score": 74.2,
    "breakout_score": 65.2,
    "value_score": 58.7,
    "reversal_score": 22.1,
    "dividend_score": 45.3,
    "signal_score": 87.4,
    "confidence": 0.87,
    "signal_type": "STRONG_BUY"
  },

  "technical": {
    "rsi_14": 58.3,
    "macd": 1.23,
    "macd_signal": 0.98,
    "macd_histogram": 0.25,
    "macd_crossover": "bullish",
    "ema_20": 192.40,
    "ema_50": 188.70,
    "ema_200": 175.30,
    "ema_stack_bullish": true,
    "bb_upper": 198.20,
    "bb_middle": 192.40,
    "bb_lower": 186.60,
    "bb_width": 0.059,
    "bb_squeeze": false,
    "bb_squeeze_intensity": "LOW",
    "adx": 28.4,
    "atr": 3.21,
    "atr_pct": 0.0164,
    "obv_trend": "UP",
    "mfi": 63.2,
    "stoch_k": 67.4,
    "stoch_d": 62.1,
    "cmf": 0.14,
    "rvol": 1.34,
    "volume_5d_avg": 58000000,
    "green_days_10d": 7,
    "52w_high": 199.62,
    "52w_low": 164.08,
    "52w_high_proximity_pct": 0.021
  },

  "fundamental": {
    "pe_ratio": 28.4,
    "sector_pe_median": 32.1,
    "pe_vs_sector": "discount",
    "pb_ratio": 42.1,
    "de_ratio": 1.76,
    "fcf_yield": 0.038,
    "eps_growth_5y": 0.142,
    "revenue_growth_ttm": 0.086,
    "gross_margin": 0.434,
    "operating_margin": 0.296,
    "net_margin": 0.253,
    "market_cap": 3020000000000,
    "enterprise_value": 3180000000000,
    "dividend_yield": 0.0054,
    "payout_ratio": 0.157,
    "insider_ownership_pct": 0.028,
    "institutional_ownership_pct": 0.601
  },

  "signals": {
    "signal_type": "STRONG_BUY",
    "entry_range_low": 193.50,
    "entry_range_high": 196.00,
    "target_price": 208.50,
    "stop_loss": 188.20,
    "risk_reward_ratio": 2.1,
    "ttl_hours": 120,
    "generated_at": "2026-04-08T09:05:32-05:00",
    "categories": ["momentum", "top_signals"]
  },

  "breakout": {
    "squeeze_intensity": "MEDIUM",
    "breakout_direction": "UPWARD",
    "breakout_score": 65.2,
    "previous_breakouts_2y": 4
  },

  "dividend": {
    "next_dividend_date": "2026-05-09",
    "annual_dividend_per_share": 1.00,
    "dividend_safety_score": 82,
    "dividend_growth_rate_5y": 5.4
  },

  "reversal": {
    "is_oversold": false,
    "bullish_divergence": false,
    "support_level": 185.00,
    "high_risk": false
  },

  "news": [
    {
      "headline": "Apple Reports Record Q1 Revenue",
      "url": "https://...",
      "source": "Reuters",
      "published": "2026-04-07T14:30:00Z",
      "sentiment": "positive"
    }
  ],

  "insider_activity": {
    "last_90_days_buys": 2,
    "last_90_days_sells": 1,
    "net_direction": "BUY",
    "last_transaction": {
      "type": "BUY",
      "shares": 5000,
      "price": 192.50,
      "date": "2026-03-28",
      "person": "Tim Cook"
    }
  },

  "sector_context": {
    "sector_etf": "XLK",
    "sector_performance_5d": 2.34,
    "stock_vs_sector_20d": 1.15,
    "sector_rank": 3
  },

  "ai_summary": "Apple maintains a dominant position in consumer electronics and services, with AI-powered features driving iPhone 17 upgrade cycles. The stock's RSI of 58 and positive MACD histogram suggest continued bullish momentum without entering overbought territory. Institutional ownership at 60% and declining short interest confirm smart money accumulation. The 52-week high proximity of 2.1% indicates breakout potential if the $196 resistance level is cleared on volume. Revenue growth of 8.6% and 43.4% gross margins remain best-in-class. The $3T market cap provides stability while the services segment — growing at 15%+ annually — shifts the revenue mix toward high-margin recurring income. Near-term catalyst: WWDC 2026 in June. Suggested entry: $193–$196 zone, target $208, stop-loss below $188.",

  "quick_view": {
    "signal_badge": "STRONG BUY",
    "score_bar": 87,
    "price_change_display": "+0.72%",
    "key_metrics": {
      "RSI": 58.3,
      "MACD": "Bullish",
      "Volume": "Above avg",
      "Trend": "Uptrend"
    }
  }
}
```

### 6.2 Master JSON (`master.json`)

```json
{
  "date": "2026-04-08",
  "generated_at": "2026-04-08T09:15:00-05:00",
  "total_tickers_scanned": 100,
  "active_signals_count": 47,
  "market_regime": "Bull",

  "menus": {
    "top_signals": {
      "count": 8,
      "tickers": ["NVDA","PLTR","META","SOFI","MARA","COIN","AMD","TSLA"]
    },
    "breakout": {
      "count": 12,
      "tickers": [...]
    },
    "value": { "count": 9, "tickers": [...] },
    "reversal": { "count": 5, "tickers": [...] },
    "momentum": { "count": 14, "tickers": [...] },
    "dividend": { "count": 11, "tickers": [...] }
  },

  "sector_summary": {
    "Technology": { "avg_score": 74.2, "top_ticker": "NVDA", "volume_change_pct": 12.4 },
    "Financials": { "avg_score": 68.1, "top_ticker": "GS", "volume_change_pct": 5.2 }
  },

  "top_3_overall": [
    { "ticker": "NVDA", "score": 91.2, "signal": "STRONG_BUY" },
    { "ticker": "PLTR", "score": 88.7, "signal": "STRONG_BUY" },
    { "ticker": "META", "score": 85.4, "signal": "BUY" }
  ],

  "market_indices": {
    "SP500": { "value": 5420.30, "change_pct": 0.87 },
    "NASDAQ": { "value": 17840.20, "change_pct": 1.24 },
    "DOW": { "value": 40120.50, "change_pct": 0.54 },
    "VIX": { "value": 18.40, "change_pct": -5.32 }
  }
}
```

---

## 7. FILE & FOLDER STRUCTURE

```
boga_ai/
│
├── boga_ai_bot.py              ← Main bot (single file)
├── config.py                 ← 100 tickers + all settings
├── requirements.txt          ← Python dependencies
│
├── data/
│   ├── 2026-04-08/
│   │   ├── master.json
│   │   ├── sectors.json
│   │   ├── all_tickers_list.json
│   │   └── stocks/
│   │       ├── AAPL.json
│   │       ├── MSFT.json
│   │       └── ... (100 files)
│   ├── 2026-04-07/
│   └── ...
│
├── transfer/
│   ├── latest/               ← Always current (web source)
│   │   ├── master.json
│   │   ├── sectors.json
│   │   └── stocks/
│   └── archive/              ← Dated archives
│       ├── 2026-04-08.zip
│       └── ...
│
└── logs/
    ├── boga_ai_2026-04-08.log
    └── ...
```

---

## 8. WEBSITE ARCHITECTURE

### 8.1 Site Map

```
boga_aismart.com/
│
├── /                         ← Homepage (Dashboard)
├── /stock/[TICKER]           ← Stock detail page (100 pages)
├── /category/top-signals     ← Top Signals page
├── /category/breakout        ← Breakout Potential page
├── /category/undervalued     ← Undervalued stocks page
├── /category/reversal        ← Reversal signals page
├── /category/momentum        ← Momentum stocks page
├── /category/dividend        ← Dividend/Passive income page
├── /sector/[SECTOR]          ← Sector analysis pages (11 sectors)
├── /archive                  ← Historical data (members only)
├── /watchlist                ← Personal watchlist (members only)
├── /login                    ← Authentication
├── /register                 ← Free registration
├── /contact                  ← Contact form
├── /about                    ← About BOGA AI
├── /disclaimer               ← Legal disclaimer (full page)
├── /privacy                  ← Privacy policy
├── /sitemap.xml              ← SEO sitemap
└── /admin/                   ← Admin panel (protected)
    ├── /admin/dashboard
    ├── /admin/content
    ├── /admin/ads
    ├── /admin/members
    ├── /admin/messages
    └── /admin/settings
```

### 8.2 Data Flow: Bot → Website

```
[boga_ai_bot.py runs at 09:00 NY]
         ↓
[Generates JSON files]
         ↓
[Copies to /transfer/latest/]
         ↓
[Deployment script detects new files]
         ↓
[Website reads /transfer/latest/master.json]
         ↓
[Pages render with fresh daily data]
```

---

## 9. PAGE-BY-PAGE DESIGN SPEC

### 9.1 Homepage

**Title:** `BOGA AI Daily 100 | AI-Powered US Stock Analysis & Signals`
**Meta description:** `Daily AI analysis of 100 top US stocks. Breakout signals, momentum picks, undervalued screener. Free stock watchlist and alerts.`

**Sections (top to bottom):**
1. **Ticker Tape** — scrolling real-time sector performance bar
2. **Index Cards** — S&P500, Dow, NASDAQ, VIX, Russell 2K, Sector ETFs
3. **Hero Header** — "Discover the Strongest US Stocks with BOGA AI AI"
4. **Stats Bar** — Active Signals count | Analyzed Today | Last Updated timestamp
5. **Category Tabs** — Top Signals | Breakout | Undervalued | Momentum | Reversal | Dividend
6. **Signal Cards** — Top 5 cards per active tab (ticker, score bar, change%, AI summary snippet)
7. **Sector Heat Map** — 11-sector grid, color-coded by performance
8. **Top 3 of the Day** — Featured section with full signal cards
9. **Ad Banner** — 728×90 leaderboard
10. **Archive Preview** — "See what happened on [yesterday's date]" teaser → login required
11. **Disclaimer Banner** — always visible above footer
12. **Footer** — Links, legal, social, newsletter signup

### 9.2 Stock Detail Page (`/stock/AAPL`)

**Title:** `AAPL Stock Analysis Today | Apple Inc. AI Score & Signals — BOGA AI`
**URL:** `boga_aismart.com/stock/AAPL`

**Sections:**
1. **Header Bar** — Ticker | Company name | Sector | Current price | % change | Signal badge
2. **Quick View Panel** — BOGA AI AI Score bar, signal type, entry/target/stop-loss
3. **TradingView Chart** — 1H timeframe, embedded widget, full-width
4. **AI Summary** — 150-word Gemini-generated analysis card
5. **Advanced Technicals** — RSI gauge, MACD chart, EMA levels table, BB chart
6. **Fundamentals & Margins** — P/E, P/B, D/E, FCF Yield, EPS growth, margins table
7. **Sector Context** — vs sector ETF performance, sector rank badge
8. **Insider Activity** — Last 90 days buy/sell table
9. **Recent News** — Last 5 news items with sentiment badges
10. **Dividend Info** — (if applicable) yield, safety score, next date
11. **Breakout Analysis** — (if applicable) squeeze intensity, direction, history
12. **Category Badges** — which menus this stock appears in today
13. **Social Share Buttons** — Twitter/X, LinkedIn, WhatsApp, Reddit, Copy Link
14. **Ad Slot** — 300×250 sidebar
15. **Legal Disclaimer** — inline mini disclaimer
16. **Related Stocks** — Other stocks from same sector

### 9.3 Category Pages (`/category/top-signals`)

**Layout:**
- Category explanation (2–3 sentences)
- Filter bar (sort by: score, change%, volume)
- Stock cards grid (3 or 4 columns)
- Each card: ticker, company, score, signal, price, change, AI summary excerpt
- Pagination or "load more"

### 9.4 Sector Pages (`/sector/Technology`)

**Sections:**
- Sector overview + ETF performance
- Sector heat map (stocks in that sector only)
- Top 5 stocks by score
- Sector vs S&P500 performance chart

### 9.5 Archive Page (`/archive`)

- Calendar view showing available dates
- Click a date → see that day's master.json data
- Members only — non-members see blurred preview + "Register free" CTA

---

## 10. SEO STRATEGY

### 10.1 On-Page SEO

**For each stock detail page:**
- Unique `<title>` tag: `[TICKER] Stock Analysis [DATE] | [Company] AI Signal — BOGA AI`
- Unique meta description mentioning score, signal type, price
- H1: `[TICKER] — [Company] Stock Analysis`
- H2 sections: "Today's AI Score", "Technical Analysis", "Fundamentals"
- Schema.org structured data: `FinancialProduct`, `Article`, `BreadcrumbList`
- Open Graph tags for social sharing
- Canonical URL to prevent duplicate content
- `robots.txt` properly configured
- `sitemap.xml` with daily refresh (all 100 stock pages + category pages)

### 10.2 Target Keywords

| Page Type | Primary Keyword | Secondary |
|-----------|----------------|-----------|
| Homepage | "US stock AI analysis" | "daily stock signals" |
| Stock page | "[TICKER] stock analysis today" | "[TICKER] buy or sell" |
| Category | "breakout stocks today" | "momentum stocks US" |
| Sector | "technology stocks analysis" | "best tech stocks today" |

### 10.3 Technical SEO

- Page speed < 3s (static JSON data, CDN-served)
- Mobile-first responsive design
- HTTPS / SSL always
- Clean URL structure (no query strings)
- Breadcrumb navigation on all inner pages
- Internal linking: category pages link to stocks, stocks link to sector pages
- Hreflang: English only (no multilingual)

---

## 11. AD BANNER PLACEMENTS

### Homepage
| Slot | Size | Position |
|------|------|----------|
| AD-H1 | 728×90 (Leaderboard) | Below index cards |
| AD-H2 | 300×250 (Medium Rectangle) | Sidebar right, top |
| AD-H3 | 300×600 (Half Page) | Sidebar right, middle |
| AD-H4 | 728×90 (Leaderboard) | Above footer |

### Stock Detail Page
| Slot | Size | Position |
|------|------|----------|
| AD-S1 | 728×90 | Below header / above chart |
| AD-S2 | 300×250 | Sidebar (sticky) |
| AD-S3 | 336×280 | Between fundamentals & news |
| AD-S4 | 728×90 | Above footer |

### Category Pages
| Slot | Size | Position |
|------|------|----------|
| AD-C1 | 728×90 | Below category header |
| AD-C2 | 300×250 | Sidebar |

### Mobile Ad Sizes
- Replace leaderboards with 320×50 mobile banner
- Keep 300×250 medium rectangles (universal)

### Ad Network
- Google AdSense (primary)
- Direct finance/broker ads (future)
- Admin can update ad code via admin panel without deployment

---

## 12. ADMIN PANEL

**URL:** `boga_aismart.com/admin/` (IP-restricted + password protected)

### 12.1 Admin Dashboard (`/admin/dashboard`)
- Today's bot run status (success/fail + timestamp)
- Total members count
- Today's page views
- Active signals count
- Recent contact messages (preview)

### 12.2 Content Management (`/admin/content`)
- Edit homepage hero text
- Edit category page descriptions
- Edit/override any AI summary for any ticker
- Mark stock as "Featured" (appears in top 3 section)
- Add/remove "Breaking" badge on any signal
- Site announcement bar (on/off toggle + text)

### 12.3 Ad Management (`/admin/ads`)
- Per-slot ad code editor (paste AdSense or custom HTML)
- Enable/disable any ad slot independently
- Upload custom banner images for direct ads
- Set ad schedule (start date, end date)

### 12.4 Member Management (`/admin/members`)
- Table: email, join date, watchlist stocks, notification status
- Search and filter
- Manually suspend or delete account
- Export member list to CSV

### 12.5 Contact Messages (`/admin/messages`)
- Inbox of all contact form submissions
- Date, name, email, message
- Mark as read / delete
- Reply by email link

### 12.6 Settings (`/admin/settings`)
- Site title, meta description
- Contact email
- Social media URLs
- Legal disclaimer text editor
- Footer text editor
- Google Analytics ID
- Bot run log viewer (last 30 days)

---

## 13. MEMBER SYSTEM

### 13.1 Free Membership Features

| Feature | Non-Member | Free Member |
|---------|-----------|-------------|
| Homepage | ✅ Full | ✅ Full |
| Stock detail pages | ✅ Full | ✅ Full |
| Category pages | ✅ Full | ✅ Full |
| Archive (past data) | ❌ Blurred | ✅ Up to 30 days |
| Watchlist | ❌ No | ✅ Up to 10 stocks |
| Push notifications | ❌ No | ✅ Yes |
| Email daily digest | ❌ No | ✅ Optional |

### 13.2 Registration Flow

1. User clicks "Register Free"
2. Form: Email + Password + "I accept Terms"
3. Email confirmation sent
4. After confirmation: watchlist setup wizard (pick 10 stocks from the 100)
5. Dashboard shows watchlist with today's signals

### 13.3 Auth Technology

- JWT-based authentication
- Password reset via email
- Sessions expire after 30 days
- No OAuth/social login at launch

---

## 14. SMART WATCHLIST & NOTIFICATIONS

### 14.1 Watchlist Features

- Members select up to 10 stocks from the fixed 100
- Watchlist page shows all 10 stocks with daily scores
- Historical performance chart for each watched stock
- "Remove" / "Add" stocks at any time

### 14.2 Notification Triggers

Members receive notifications when a watched stock:
- Receives `STRONG_BUY` or `STRONG_SELL` signal
- Score changes by more than 15 points vs previous day
- Enters a new category (e.g., first time in "Breakout" list)
- BB Squeeze detected (breakout imminent)

### 14.3 Notification Channels

- **Browser push notifications** (PWA web push API)
- **Daily email digest** (summary of watched stocks at 9:30 AM NY)

---

## 15. TRADINGVIEW INTEGRATION

Each stock detail page embeds a TradingView chart widget:

```html
<!-- TradingView Widget — No API key required for basic embed -->
<script type="text/javascript"
  src="https://s3.tradingview.com/tv.js"></script>
<script type="text/javascript">
new TradingView.widget({
  "width": "100%",
  "height": 500,
  "symbol": "NASDAQ:AAPL",
  "interval": "60",       // 1H default
  "timezone": "America/New_York",
  "theme": "dark",
  "style": "1",
  "locale": "en",
  "toolbar_bg": "#131722",
  "enable_publishing": false,
  "hide_side_toolbar": false,
  "allow_symbol_change": false,
  "container_id": "tradingview_chart"
});
</script>
```

Features:
- Default: 1H timeframe
- User can switch timeframe (15m, 1H, 4H, 1D) via buttons above chart
- Dark theme matching site design
- BOGA AI AI entry/stop/target levels overlaid as horizontal lines (future feature)

---

## 16. GEMINI AI INTEGRATION

### 16.1 API Setup

```python
import google.generativeai as genai

genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel("gemini-1.5-flash")
```

### 16.2 Prompt Template (Per Stock)

```python
def build_gemini_prompt(stock_data: dict) -> str:
    return f"""You are BOGA AI AI, a professional US stock market analyst.
    
Analyze the following stock and write a concise, data-driven analysis in English.
Maximum 150 words. Be specific with numbers. Mention signal type, key technicals, 
and one near-term catalyst. Do not use disclaimers in your response.

Stock: {stock_data['ticker']} — {stock_data['company']}
Sector: {stock_data['sector']}
Date: {stock_data['date']}

PRICE DATA:
Current Price: ${stock_data['price']['current']}
Daily Change: {stock_data['price']['change_pct']:+.2f}%
RVOL: {stock_data['technical']['rvol']:.2f}x

TECHNICAL SIGNALS:
RSI(14): {stock_data['technical']['rsi_14']:.1f}
MACD Histogram: {stock_data['technical']['macd_histogram']:+.3f} ({stock_data['technical']['macd_crossover']})
EMA Stack: {'Bullish' if stock_data['technical']['ema_stack_bullish'] else 'Bearish'}
ADX: {stock_data['technical']['adx']:.1f}
BB Squeeze: {stock_data['technical']['bb_squeeze_intensity']}
52W High Proximity: {stock_data['technical']['52w_high_proximity_pct']*100:.1f}%

FUNDAMENTALS:
P/E: {stock_data['fundamental']['pe_ratio']:.1f} (Sector median: {stock_data['fundamental']['sector_pe_median']:.1f})
Revenue Growth TTM: {stock_data['fundamental']['revenue_growth_ttm']*100:.1f}%
Gross Margin: {stock_data['fundamental']['gross_margin']*100:.1f}%

SIGNAL: {stock_data['scores']['signal_type']} (Confidence: {stock_data['scores']['confidence']*100:.0f}%)

Write the analysis now:"""
```

### 16.3 Rate Limiting

- Gemini 1.5 Flash: 15 requests/minute (free tier)
- Bot processes stocks in batches of 10 with 45-second delays
- Total AI generation time for 100 stocks: ~8 minutes
- Cache: AI summaries saved in JSON, not regenerated unless score changes > 5 pts

---

## 17. LEGAL & COMPLIANCE

### 17.1 Disclaimer — Always Visible

Shown at bottom of every page (sticky banner):

> **BOGA AI is for informational purposes only.** Not financial advice. AI signals are experimental. Trading involves risk of loss. Past performance is not indicative of future results.

### 17.2 Full Disclaimer Page (`/disclaimer`)

**Section 1 — Not Financial Advice**
BOGA AI Daily 100 is an information service only. We are not a registered investment advisor (RIA) or broker-dealer registered with the SEC or FINRA. Information provided on this platform does not constitute investment, financial, trading, or any other type of professional advice. Always consult a licensed financial advisor before making investment decisions.

**Section 2 — Risk Disclosure**
Trading stocks and financial instruments involves significant risk of loss, including the possible loss of all invested capital. Past performance is not indicative of future results. AI-driven signals are experimental and should be used as one input among many in your own independent decision-making process.

**Section 3 — AI & Data Accuracy**
BOGA AI uses artificial intelligence models (Google Gemini) to generate stock analyses. These analyses are automated and may contain errors, omissions, or outdated information. Market data is sourced from Yahoo Finance via yfinance and may be delayed. We do not guarantee accuracy, completeness, or timeliness of any data.

**Section 4 — Data Privacy (CCPA Compliant)**
We comply with US data protection standards including CCPA guidelines. We collect only email addresses for registered members. We do not sell personal data to third parties. Members can request data deletion at any time by contacting us.

**Section 5 — Affiliate & Advertising Disclosure**
This site may display third-party advertisements. Advertisers do not influence editorial content or analysis. We may receive compensation from display advertising networks.

---

## 18. MOBILE & PWA DESIGN

### 18.1 Responsive Breakpoints

| Breakpoint | Width | Layout |
|-----------|-------|--------|
| Mobile S | 320px | Single column |
| Mobile M | 375px | Single column |
| Mobile L | 425px | Single column |
| Tablet | 768px | 2 columns |
| Desktop | 1024px+ | Full layout |

### 18.2 Mobile-Specific Features

- **Collapsible sidebar** (hamburger menu)
- **Bottom navigation bar** on mobile (Home, Signals, Search, Watchlist, Menu)
- **Swipeable category tabs** (horizontal scroll)
- **Compact signal cards** (condensed for smaller screens)
- **"Add to Home Screen"** PWA prompt
- **Touch-optimized** TradingView chart

### 18.3 PWA Configuration

`manifest.json`:
```json
{
  "name": "BOGA AI Daily 100",
  "short_name": "BOGA AI",
  "description": "AI-powered US stock analysis",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0d1117",
  "theme_color": "#1a56db",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

---

## 19. SOCIAL SHARING

### Every page has share buttons:
- **Twitter/X** — Pre-filled tweet: `$AAPL scored 87/100 on BOGA AI today! STRONG BUY signal. #stocks #investing boga_aismart.com/stock/AAPL`
- **LinkedIn** — Article share
- **WhatsApp** — Mobile-friendly share link
- **Reddit** — Share to r/stocks, r/investing
- **Facebook** — Standard share
- **Copy Link** — One-click clipboard copy

### Open Graph tags (per stock page):
```html
<meta property="og:title" content="AAPL — Strong Buy Signal | BOGA AI AI Score: 87">
<meta property="og:description" content="Apple scored 87/100 today. RSI 58, MACD bullish. Entry: $193-$196, Target: $208.">
<meta property="og:image" content="https://boga_aismart.com/og/AAPL.png">
<meta property="og:url" content="https://boga_aismart.com/stock/AAPL">
```

---

## 20. CONTACT & COMMUNICATION

### 20.1 Contact Form (`/contact`)

Fields:
- Name (required)
- Email (required)
- Subject (dropdown: General | Bug Report | Partnership | Advertising | Other)
- Message (required, max 1000 chars)
- CAPTCHA (hCaptcha)

### 20.2 Message Storage

- Saved to `contacts.json` (local) or SQLite DB
- Admin panel inbox shows all messages
- Email notification sent to admin email on new message
- Admin can mark as read / delete

### 20.3 Footer Contact Info

- Email: contact@bogastock.com
- Location: New York, USA
- No phone number (spam prevention)

---

## 21. DEVELOPMENT PHASES & TIMELINE

### Phase 1 — Bot Core (Week 1–2)
- [ ] `config.py` with 100 tickers + all settings
- [ ] Yahoo Finance data fetch module
- [ ] Technical indicators engine (RSI, MACD, BB, EMA, ATR, ADX, OBV, MFI)
- [ ] Composite scoring engine (master + 6 category scores)
- [ ] NY time scheduler
- [ ] Basic JSON output (stock files + master.json)

### Phase 2 — Bot Complete (Week 2–3)
- [ ] Menu building algorithms (all 7 categories)
- [ ] Sector analysis module
- [ ] Gemini AI integration (prompts + rate limiting)
- [ ] News fetch module (Yahoo RSS)
- [ ] Insider activity module (yfinance)
- [ ] Transfer/archive system
- [ ] Logging module
- [ ] End-to-end test run

### Phase 3 — Website Foundation (Week 3–4)
- [ ] Project setup (Next.js or static HTML)
- [ ] Design system (dark theme, components)
- [ ] Homepage layout
- [ ] Stock detail page template
- [ ] JSON data loader
- [ ] TradingView widget integration

### Phase 4 — Website Features (Week 4–5)
- [ ] Category pages (all 7)
- [ ] Sector pages (11 sectors)
- [ ] Sector heat map component
- [ ] Index ticker tape
- [ ] Mobile responsive design
- [ ] PWA manifest + service worker

### Phase 5 — Member System (Week 5–6)
- [ ] Registration / login / JWT
- [ ] Watchlist page + API
- [ ] Archive page (member gate)
- [ ] Push notification setup
- [ ] Email digest system

### Phase 6 — Admin Panel (Week 6–7)
- [ ] Admin authentication (separate)
- [ ] Dashboard
- [ ] Content editor
- [ ] Ad manager
- [ ] Member table
- [ ] Contact inbox
- [ ] Settings page

### Phase 7 — SEO & Legal (Week 7)
- [ ] All meta tags, OG tags
- [ ] Schema.org markup
- [ ] Sitemap.xml generator
- [ ] robots.txt
- [ ] Disclaimer pages
- [ ] Cookie consent banner (CCPA)

### Phase 8 — Testing & Launch (Week 8)
- [ ] Full bot dry run (manual trigger)
- [ ] Website QA (all pages, mobile, tablet)
- [ ] Performance audit (Lighthouse)
- [ ] Security audit
- [ ] DNS setup + SSL
- [ ] Launch! 🚀

---

## 22. TECH STACK SUMMARY

| Layer | Technology |
|-------|-----------|
| Bot Language | Python 3.11+ |
| Market Data | yfinance (Yahoo Finance) |
| AI Analysis | Google Gemini 1.5 Flash |
| Technical Indicators | ta-lib / pandas-ta |
| Scheduling | APScheduler or asyncio |
| Data Format | JSON |
| Frontend | Next.js 14 (React) or Astro |
| Styling | Tailwind CSS |
| Charts | TradingView Embed |
| Heat Map | Custom SVG or D3.js |
| Auth | JWT + bcrypt |
| Database | SQLite (local) or PostgreSQL (prod) |
| Email | SendGrid or Mailgun |
| Push Notifications | Web Push API (VAPID) |
| Ad Network | Google AdSense |
| Hosting | VPS (Ubuntu) + Nginx |
| SSL | Let's Encrypt / Certbot |
| CDN | Cloudflare |

---

## APPENDIX A: Python Dependencies

```
yfinance>=0.2.40
pandas>=2.0.0
numpy>=1.24.0
ta>=0.10.2
aiohttp>=3.9.0
google-generativeai>=0.5.0
apscheduler>=3.10.0
python-dotenv>=1.0.0
requests>=2.31.0
beautifulsoup4>=4.12.0
```

## APPENDIX B: Environment Variables

```bash
GEMINI_API_KEY=AIzaSyA6cu1eE5xyh2-1eEFEdZcMXY7MSzqIPnM
ADMIN_PASSWORD=your_secure_admin_password
JWT_SECRET=your_jwt_secret_key
SENDGRID_API_KEY=your_sendgrid_key
CONTACT_EMAIL=contact@bogastock.com
DATA_DIR=/var/www/boga_ai/data
TRANSFER_DIR=/var/www/boga_ai/transfer
```

---

*Document Version: 1.0 | Last Updated: April 2026 | BOGA AI / AFK DaSYS*
