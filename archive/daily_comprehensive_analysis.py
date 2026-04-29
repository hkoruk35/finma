#!/usr/bin/env python3
"""
daily_comprehensive_analysis.py — Günlük Sektör/Altsektör Analiz Botu
Runs daily at 09:00 ET
Analyzes all 500+ tickers by sector, subsector, and category
Outputs JSON with homepage_summary and detail_summary (BOGA AI placeholder)
"""

import asyncio
import json
import logging
import os
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import pandas as pd
import yfinance as yf

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger(__name__)

# Config
NY_TZ = ZoneInfo("America/New_York")
BASE_DIR = Path(__file__).parent
DATA_BASE = BASE_DIR / "data"
TRANSFER_DIR = BASE_DIR / "transfer" / "latest"

# Sector/Subsector Mapping (from config.py)
SECTOR_SUBSECTOR_MAP = {
    "Technology": {
        "subsectors": {
            "Mega-cap Platform & Cloud": ["AAPL", "MSFT", "GOOGL", "META", "AMZN"],
            "Semiconductors & Hardware": ["NVDA", "AMD", "AVGO", "QCOM", "TXN", "MU", "LRCX", "AMAT", "KLAC", "MRVL", "MCHP", "SWKS", "MPWR", "ON", "WOLF", "SMCI", "ARM", "ADI", "STX", "WDC", "SNDK", "COHR", "LITE"],
            "Software & Cloud": ["ORCL", "CRM", "ADBE", "NOW", "INTU", "WDAY", "TEAM", "ZM", "DDOG", "MDB", "SNOW", "HUBS", "VEEV", "BILL", "GTLB", "TTD", "SMAR", "ZS"],
            "Cybersecurity": ["PANW", "CRWD", "FTNT", "OKTA", "S", "CYBR"],
            "AI & Data": ["PLTR", "MSTR", "IBM", "ANSS", "CDNS", "SNPS"],
            "Infrastructure & Networking": ["CSCO", "NET", "AKAM", "ANET", "JNPR", "NTAP"],
            "Hardware & Devices": ["DELL", "INTC", "TSM", "GLW", "GRMN", "KEYS", "VRT"],
        }
    },
    "Communication Services": {
        "subsectors": {
            "Social & Search": ["GOOGL", "META"],
            "Streaming & Entertainment": ["NFLX", "DIS", "SPOT", "ROKU", "WBD", "PARA"],
            "Telecom - US": ["T", "VZ", "TMUS", "CHTR", "CMCSA"],
            "Telecom - Global": ["NOK", "ERIC", "VOD", "AMX"],
            "Gaming": ["EA", "TTWO", "RBLX"],
            "Interactive & Social": ["SNAP", "PINS", "MTCH", "TKO"],
            "Advertising": ["OMC"],
            "EM Digital": ["BIDU"],
        }
    },
    "Consumer Discretionary": {
        "subsectors": {
            "E-commerce & Marketplace": ["AMZN", "EBAY", "ETSY", "W", "BABA"],
            "Automotive & EV": ["TSLA", "F", "GM", "RIVN", "LCID"],
            "Home Improvement": ["HD", "LOW", "WSM"],
            "Fast Food & Restaurant": ["MCD", "SBUX", "CMG", "YUM", "QSR", "DPZ", "WEN"],
            "Apparel & Footwear": ["NKE", "LULU", "RL", "PVH", "TPR", "VFC", "UAA"],
            "Travel & Leisure": ["BKNG", "ABNB", "EXPE", "MAR", "HLT", "H", "RCL", "CCL", "NCLH", "LYV", "FUN"],
            "Retail": ["TJX", "ROST", "FIVE", "DLTR", "DG"],
            "Delivery & Gig": ["UBER", "LYFT", "DASH"],
            "Luxury & Other": ["TSCO", "SIG", "ANF", "CAVA", "CAR"],
        }
    },
    "Consumer Staples": {
        "subsectors": {
            "Household & Personal Care": ["PG", "CL", "KMB", "CHD"],
            "Beverages": ["KO", "PEP", "MNST", "STZ", "BF.B"],
            "Food & Snacks": ["MDLZ", "GIS", "CPB", "HRL", "CAG", "SJM", "K", "HSY", "TSN"],
            "Tobacco": ["PM", "MO", "BTI"],
            "Retail / Wholesale": ["WMT", "COST", "TGT", "KR", "SFM"],
            "Beauty & Cosmetics": ["EL", "ULTA", "COTY"],
            "Agriculture": ["ADM", "BG", "MOS", "CTVA"],
            "Food Service": ["SYY"],
        }
    },
    "Healthcare": {
        "subsectors": {
            "Large-cap Pharma - US": ["LLY", "JNJ", "ABBV", "MRK", "PFE", "BMY", "AMGN", "REGN", "GILD", "BIIB", "VRTX", "ALNY", "MRNA", "EXEL"],
            "Large-cap Pharma - Global": ["AZN", "NVS", "TAK", "TEVA", "BNTX"],
            "Medical Devices": ["UNH", "ABT", "MDT", "ISRG", "BSX", "SYK", "EW", "ZBH", "HOLX", "BDX", "BAX", "DXCM", "PODD", "INSP", "NVCR"],
            "Diagnostics & Services": ["TMO", "DHR", "A", "IQV", "PKI", "ILMN", "LH", "DGX"],
            "Health Insurance": ["CVS", "CI", "ELV", "HCA", "THC"],
            "Veterinary": ["ZTS", "IDEXX"],
            "Biotech Emerging": ["SRPT", "RARE", "ACAD"],
        }
    },
    "Financials": {
        "subsectors": {
            "Money-Center Banks - US": ["JPM", "BAC", "WFC", "C", "USB", "TFC", "PNC"],
            "Regional Banks - US": ["RF", "HBAN", "CFG", "FITB", "MTB", "KEY"],
            "Banks - Canada": ["RY", "TD", "BNS", "CM", "BMO"],
            "Investment Banking & Wealth": ["GS", "MS", "BLK", "BX", "KKR", "APO", "ARES", "CG", "AMP", "NTRS", "BK"],
            "Insurance": ["BRK.B", "AIG", "MET", "PRU", "AFL", "ALL", "CB", "TRV", "HIG", "PUK"],
            "Payment Networks": ["V", "MA", "AXP", "PYPL", "SQ", "FIS", "FISV", "GPN"],
            "Fintech & Crypto": ["COIN", "HOOD", "SOFI", "NU"],
            "Data & Ratings": ["MCO", "SPGI", "MSCI"],
        }
    },
    "Energy": {
        "subsectors": {
            "Integrated Majors": ["XOM", "CVX", "SHEL", "TTE", "BP", "EQNR"],
            "E&P - US": ["COP", "EOG", "OXY", "DVN", "FANG", "HES", "APA", "MRO", "MTDR", "CHRD", "CRGY", "EQT", "MUR"],
            "E&P - Canada": ["CNQ", "CVE", "SU", "OVV"],
            "E&P - International": ["PBR", "EC"],
            "Oilfield Services": ["SLB", "HAL", "BKR", "OII"],
            "Refining & Marketing": ["MPC", "VLO", "PSX", "PARR"],
            "Midstream & Pipeline": ["KMI", "WMB", "ET", "EPD", "MPLX", "OKE", "TRGP", "DTM", "KNTK", "ENB", "TRP"],
            "LNG & Shipping": ["LNG", "GLNG", "FLNG", "WDS"],
            "Coal & Uranium": ["BTU", "ARCH", "CCJ"],
        }
    },
    "Materials": {
        "subsectors": {
            "Copper & Base Metals": ["FCX", "SCCO", "TECK"],
            "Diversified Mining": ["RIO", "BHP", "VALE", "MT"],
            "Gold Mining": ["NEM", "GOLD", "AEM", "WPM", "RGLD", "FNV", "KGC", "GFI", "AU", "SSRM"],
            "Silver Mining": ["PAAS", "FSM"],
            "Lithium & Battery Metals": ["ALB", "SQM", "LTHM", "SGML"],
            "Industrial Gases": ["LIN", "APD", "CE"],
            "Chemicals": ["SHW", "ECL", "PPG", "DD", "DOW", "LYB", "EMN", "CF", "NTR"],
            "Steel & Aluminum": ["NUE", "STLD", "X", "AA", "CENX"],
            "Construction Materials": ["MLM", "VMC", "CRH", "EXP"],
            "Paper & Packaging": ["IP", "PKG", "WRK"],
        }
    },
    "Industrials": {
        "subsectors": {
            "Aerospace & Defense": ["BA", "LMT", "RTX", "NOC", "GD", "HII", "TDG", "AXON", "LHX", "KTOS"],
            "Machinery & Equipment": ["CAT", "DE", "EMR", "ETN", "ROK", "PH", "IR", "XYL", "DOV", "HUBB", "HWM", "WAB", "ALSN"],
            "Engines & Power": ["GE", "GEV", "CMI"],
            "Conglomerate": ["HON", "MMM"],
            "Transportation - Rail": ["UNP", "CSX", "NSC", "CNI"],
            "Transportation - Logistics": ["UPS", "FDX", "ODFL", "EXPD"],
            "Transportation - Airlines": ["DAL", "UAL", "AAL", "LUV", "ALK"],
            "Staffing & Services": ["WM", "RSG", "CTAS", "ROP", "FAST", "GWW", "ROL"],
            "Construction & Engineering": ["PWR", "FLR", "J", "PRIM", "MTZ", "STRL"],
        }
    },
    "Utilities": {
        "subsectors": {
            "Electric - Regulated": ["NEE", "DUK", "SO", "AEP", "EXC", "PEG", "XEL", "ED", "ES", "WEC", "ETR", "CMS", "DTE", "EVRG", "OGE", "AEE", "ATO", "EIX", "FE", "PPL"],
            "Electric - Clean/Nuclear": ["VST", "CEG", "NRG", "AES"],
            "Gas & Multi-Utility": ["SRE", "PCG", "NI", "OGS", "CNP"],
            "Water": ["AWK", "WTRG", "CWT", "MSEX"],
            "Renewable / YieldCo": ["CWEN", "AY", "BE"],
        }
    },
    "Real Estate": {
        "subsectors": {
            "Diversified REIT": ["PLD", "O", "VICI", "EPRT", "GOOD", "GTY"],
            "Data Center REIT": ["EQIX", "AMT", "DLR", "CCI", "SBAC"],
            "Industrial / Logistics": ["EGP", "FR"],
            "Office REIT": ["BXP", "VNO"],
            "Retail REIT": ["SPG", "MAC", "KIM", "REG", "FRT", "KRG"],
            "Residential REIT": ["AVB", "EQR", "MAA", "UDR", "CPT", "NMI", "AMH"],
            "Healthcare REIT": ["WELL", "VTR", "HR", "OHI"],
            "Storage REIT": ["PSA", "EXR", "CUBE", "LSI"],
            "Specialty REIT": ["IRM", "ARE", "CBRE", "HST", "LAMR", "SUI", "RHP", "PEB"],
            "Timber REIT": ["WY", "PCH"],
        }
    },
}

# Categories (muhasebeci tarafındaki kategorileri sakla)
CATEGORIES = ["top_scores", "breakout", "value", "momentum", "reversal", "dividend"]


def get_subsector(ticker: str) -> tuple[str, str]:
    """Find sector and subsector for a ticker."""
    for sector, data in SECTOR_SUBSECTOR_MAP.items():
        for subsector, tickers in data["subsectors"].items():
            if ticker in tickers:
                return sector, subsector
    return "Unknown", "Unknown"


def calculate_technical_indicators(df: pd.DataFrame) -> dict:
    """Calculate 1D technical indicators for trend and momentum analysis."""
    if len(df) < 2:
        return {"rsi": None, "momentum": None, "trend": "neutral", "sma_20": None}

    close = df['Close']
    high = df['High']
    low = df['Low']

    # RSI (Relative Strength Index) - 14 period
    delta = close.diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
    rs = gain / loss
    rsi = 100 - (100 / (1 + rs))
    current_rsi = rsi.iloc[-1] if len(rsi) > 0 else None

    # Momentum (ROC - Rate of Change) - 12 period
    if len(close) >= 12:
        momentum = ((close.iloc[-1] - close.iloc[-12]) / close.iloc[-12]) * 100
    else:
        momentum = ((close.iloc[-1] - close.iloc[0]) / close.iloc[0]) * 100 if len(close) > 1 else None

    # Simple Moving Average 20
    sma_20 = close.rolling(window=min(20, len(close))).mean().iloc[-1] if len(close) >= 1 else None

    # Trend determination (High/Low comparison)
    trend = "neutral"
    if current_rsi is not None:
        if current_rsi > 70:
            trend = "overbought"
        elif current_rsi < 30:
            trend = "oversold"
        elif current_rsi > 55:
            trend = "bullish"
        elif current_rsi < 45:
            trend = "bearish"
        else:
            trend = "neutral"

    return {
        "rsi": round(current_rsi, 2) if current_rsi is not None else None,
        "momentum": round(momentum, 2) if momentum is not None else None,
        "trend": trend,
        "sma_20": round(sma_20, 2) if sma_20 is not None else None,
    }


def generate_boga_summary(ticker: str, sector: str, subsector: str, price: float, change_pct: float, tech_indicators: dict) -> dict:
    """Generate BOGA AI placeholder summaries with technical indicators."""
    rsi = tech_indicators.get("rsi")
    momentum = tech_indicators.get("momentum")
    trend = tech_indicators.get("trend", "neutral")

    direction = "bullish" if change_pct >= 0 else "bearish"
    magnitude = abs(change_pct)

    homepage = f"BOGA AI analysis for {ticker} ({sector} / {subsector}). Trend: {trend}, RSI: {rsi}. [AI summary coming soon]"
    detail = f"Comprehensive analysis of {ticker} in the {subsector} subsector of {sector}. "
    detail += f"Current price ${price:.2f} with {change_pct:+.2f}% 1D change. "
    detail += f"Technical: RSI={rsi}, Momentum={momentum}%, SMA Trend={trend}. "
    detail += "This analysis is powered by BOGA AI. Full insights and recommendations will be provided based on sector trends, technical patterns, and fundamental health metrics."

    return {
        "homepage_summary": {
            "en": homepage,
            "tr": f"BOGA AI tarafından {ticker} analizi ({sector} / {subsector}). Eğilim: {trend}, RSI: {rsi}. [AI özeti yakında]",
            "es": f"Análisis BOGA AI para {ticker}. Tendencia: {trend}, RSI: {rsi}. [Resumen de IA próximamente]",
            "pt": f"Análise BOGA AI para {ticker}. Tendência: {trend}, RSI: {rsi}. [Resumo de IA em breve]",
            "fr": f"Analyse BOGA AI pour {ticker}. Tendance: {trend}, RSI: {rsi}. [Résumé IA à venir]",
            "id": f"Analisis BOGA AI untuk {ticker}. Tren: {trend}, RSI: {rsi}. [Ringkasan AI akan datang]",
        },
        "detail_summary": {
            "en": detail,
            "tr": f"{ticker} ({sector} / {subsector}) için ayrıntılı analiz. [Yakında güncellenecek]",
            "es": f"Análisis detallado para {ticker}. [Actualizaciones próximamente]",
            "pt": f"Análise detalhada para {ticker}. [Atualizações em breve]",
            "fr": f"Analyse détaillée pour {ticker}. [Mises à jour à venir]",
            "id": f"Analisis terperinci untuk {ticker}. [Pembaruan akan datang]",
        }
    }


async def analyze_all_tickers():
    """Main analysis function."""
    logger.info("Starting daily comprehensive analysis...")

    # Load ticker universe
    all_tickers = []
    for sector_data in SECTOR_SUBSECTOR_MAP.values():
        for tickers in sector_data["subsectors"].values():
            all_tickers.extend(tickers)

    # Remove duplicates
    all_tickers = list(set(all_tickers))
    logger.info(f"Analyzing {len(all_tickers)} unique tickers...")

    # Fetch 1D data with proper error handling
    logger.info("Fetching 1D data from yfinance...")
    data = yf.download(all_tickers, period="30d", progress=False)

    # Build analysis output
    analysis_by_sector = {}
    analysis_by_ticker = {}

    for ticker in all_tickers:
        try:
            sector, subsector = get_subsector(ticker)

            # Get 1D price info - fix for DataFrame structure
            try:
                # Extract ticker data properly from multi-ticker download
                if isinstance(data, pd.DataFrame) and 'Close' in data.columns:
                    # Single column means data structure is (date, price)
                    if len(data.columns) <= 5:
                        ticker_df = pd.DataFrame({
                            'Open': data.get('Open', data.get('Open', [None])),
                            'High': data.get('High', data.get('High', [None])),
                            'Low': data.get('Low', data.get('Low', [None])),
                            'Close': data.get('Close', [None]),
                            'Volume': data.get('Volume', [None])
                        })
                    else:
                        # Multi-index DataFrame - extract ticker-specific data
                        ticker_df = pd.DataFrame({
                            'Open': data['Open'].get(ticker, None),
                            'High': data['High'].get(ticker, None),
                            'Low': data['Low'].get(ticker, None),
                            'Close': data['Close'].get(ticker, None),
                            'Volume': data['Volume'].get(ticker, None)
                        })

                    if ticker_df['Close'].isna().all():
                        raise ValueError(f"No valid price data for {ticker}")

                    current_price = ticker_df['Close'].iloc[-1]
                    previous_price = ticker_df['Close'].iloc[-2] if len(ticker_df) > 1 else ticker_df['Close'].iloc[-1]
                    change_pct = ((current_price - previous_price) / previous_price) * 100 if previous_price != 0 else 0.0

                    # Calculate technical indicators
                    tech_indicators = calculate_technical_indicators(ticker_df)
                else:
                    raise ValueError(f"Invalid data structure for {ticker}")
            except Exception as e:
                logger.warning(f"Price data error for {ticker}: {e}")
                current_price = 0.0
                change_pct = 0.0
                tech_indicators = {"rsi": None, "momentum": None, "trend": "neutral", "sma_20": None}

            # Generate summaries with technical indicators
            summaries = generate_boga_summary(ticker, sector, subsector, current_price, change_pct, tech_indicators)

            # Store by sector
            if sector not in analysis_by_sector:
                analysis_by_sector[sector] = {
                    "subsectors": {},
                    "tickers": []
                }

            if subsector not in analysis_by_sector[sector]["subsectors"]:
                analysis_by_sector[sector]["subsectors"][subsector] = []

            analysis_by_sector[sector]["subsectors"][subsector].append({
                "ticker": ticker,
                "price": round(current_price, 2),
                "change_1d": round(change_pct, 2),
                "technical": tech_indicators,
                "ai_summary": summaries
            })
            analysis_by_sector[sector]["tickers"].append(ticker)

            # Store by ticker
            analysis_by_ticker[ticker] = {
                "sector": sector,
                "subsector": subsector,
                "price": round(current_price, 2),
                "change_1d": round(change_pct, 2),
                "technical": tech_indicators,
                "ai_summary": summaries,
                "category": None  # Will be set by categorization logic
            }

            logger.info(f"✓ {ticker}: ${current_price:.2f} ({change_pct:+.2f}%)")

        except Exception as e:
            logger.warning(f"✗ {ticker}: {e}")

    # Write outputs
    TRANSFER_DIR.mkdir(parents=True, exist_ok=True)

    # Output 1: Full analysis by sector
    sector_analysis_file = TRANSFER_DIR / "sector_analysis.json"
    with open(sector_analysis_file, "w", encoding="utf-8") as f:
        json.dump(
            {
                "generated_at": datetime.now(NY_TZ).isoformat(),
                "total_tickers": len(analysis_by_ticker),
                "analysis_by_sector": analysis_by_sector
            },
            f,
            indent=2,
            ensure_ascii=False
        )
    logger.info(f"✅ Sector analysis saved: {sector_analysis_file}")

    # Output 2: Individual ticker analysis
    ticker_analysis_file = TRANSFER_DIR / "ticker_analysis.json"
    with open(ticker_analysis_file, "w", encoding="utf-8") as f:
        json.dump(
            {
                "generated_at": datetime.now(NY_TZ).isoformat(),
                "total_tickers": len(analysis_by_ticker),
                "analysis_by_ticker": analysis_by_ticker
            },
            f,
            indent=2,
            ensure_ascii=False
        )
    logger.info(f"✅ Ticker analysis saved: {ticker_analysis_file}")

    logger.info("Daily comprehensive analysis complete!")


async def main():
    await analyze_all_tickers()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        sys.exit(1)
