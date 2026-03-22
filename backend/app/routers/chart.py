"""Chart Router — FinMA Native Chart Engine (Public Endpoint)"""
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from typing import Optional
import logging
import yfinance as yf
import pandas as pd
import numpy as np

# Set matplotlib to non-interactive backend for Docker/headless environments
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.gridspec import GridSpec
from datetime import datetime
from zoneinfo import ZoneInfo
from ta.trend import EMAIndicator, MACD
from ta.volatility import BollingerBands, AverageTrueRange
from ta.momentum import RSIIndicator
import os
import tempfile

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/chart", tags=["chart"])

# ─────────────────────────────────────────────────────────────
# UTILITY FUNCTIONS
# ─────────────────────────────────────────────────────────────

def get_company_info(ticker: str) -> dict:
    """Şirket bilgisi getir"""
    try:
        info = yf.Ticker(ticker).info
        return {
            'name': info.get('longName', ticker),
            'exchange': info.get('exchange', 'N/A'),
            'sector': info.get('sector', 'N/A'),
        }
    except:
        return {'name': ticker, 'exchange': 'N/A', 'sector': 'N/A'}

def trend_color(change: float) -> str:
    """Trend rengini döndür"""
    if change >= 0:
        return '#00E676'
    else:
        return '#FF5252'

def rsi_color(rsi: float) -> str:
    """RSI rengi"""
    if rsi >= 70:
        return '#FF5252'
    elif rsi <= 30:
        return '#00E676'
    else:
        return '#FFD700'

# ─────────────────────────────────────────────────────────────
# MAIN CHART ENGINE
# ─────────────────────────────────────────────────────────────

def generate_stock_chart(ticker: str, df_1d: pd.DataFrame, df_1h: pd.DataFrame = None,
                         full_name: str = "", candidate_data: dict = None) -> Optional[str]:
    """
    ATMACA DASHBOARD CHART ENGINE (v3.0 - SMART TIMEFRAME & KARTAL EDITION)
    Grafik PNG dosyasının yolunu döndürür
    """
    fig = None
    try:
        # A) GRAFİK VERİ SEÇİMİ
        df = df_1d.copy()
        use_1h = False
        tf_label = "Timeframe: 1D (Macro View)"
        LOOKBACK = 100

        # MultiIndex sütun temizliği
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)

        # B) İNDİKATÖR HESAPLAMALARI
        close = df["Close"]
        high = df["High"]
        low = df["Low"]
        opens = df["Open"]
        volume = df["Volume"]

        ema20 = EMAIndicator(close, window=20).ema_indicator()
        ema50 = EMAIndicator(close, window=50).ema_indicator()
        ema100 = EMAIndicator(close, window=100).ema_indicator()

        bb_obj = BollingerBands(close, window=20, window_dev=2)
        bb_h = bb_obj.bollinger_hband()
        bb_l = bb_obj.bollinger_lband()

        rsi = RSIIndicator(close, window=14).rsi()
        atr = AverageTrueRange(high, low, close, window=14).average_true_range()
        macd = MACD(close)
        macd_line = macd.macd()
        signal_line = macd.macd_signal()

        # Destek / Direnç
        recent_window = 20
        support_level = float(low.tail(recent_window).min())
        resistance_level = float(high.tail(recent_window).max())

        # C) PERFORMANS METRİKLERİ
        curr_price = float(close.iloc[-1])

        def calc_change_1d(days_idx):
            if len(df_1d) > days_idx:
                prev = float(df_1d["Close"].iloc[-days_idx])
                return ((curr_price - prev) / prev) * 100
            return 0.0

        chg_7d = calc_change_1d(6)
        chg_30d = calc_change_1d(22)
        chg_1y = calc_change_1d(252) if len(df_1d) > 252 else calc_change_1d(len(df_1d)-1)
        c_7d = trend_color(chg_7d)
        c_30d = trend_color(chg_30d)
        c_1y = trend_color(chg_1y)
        a_7d = "▲" if chg_7d >= 0 else "▼"
        a_30d = "▲" if chg_30d >= 0 else "▼"
        a_1y = "▲" if chg_1y >= 0 else "▼"

        atr_now = atr.iloc[-1]
        atr_pct = (atr_now / curr_price) * 100
        rsi_now = rsi.iloc[-1]

        vol_now = volume.iloc[-1]
        vol_ma = volume.rolling(20).mean().iloc[-1]
        rvol = vol_now / vol_ma if vol_ma > 0 else 0
        vol_tag = f"RVOL {rvol:.1f}x" + (" 💥" if rvol > 1.8 else "")

        # D) PLOT DATA & GAPLESS INDEXING
        df_plot = df.tail(LOOKBACK)
        x_vals = np.arange(len(df_plot))

        o_plot = opens.tail(LOOKBACK).values
        h_plot = high.tail(LOOKBACK).values
        l_plot = low.tail(LOOKBACK).values
        c_plot = close.tail(LOOKBACK).values
        v_plot = volume.tail(LOOKBACK).values

        ema20_p = ema20.tail(LOOKBACK).values
        ema50_p = ema50.tail(LOOKBACK).values
        ema100_p = ema100.tail(LOOKBACK).values
        bb_h_p = bb_h.tail(LOOKBACK).values
        bb_l_p = bb_l.tail(LOOKBACK).values

        rsi_p = rsi.tail(LOOKBACK).values
        macd_p = macd_line.tail(LOOKBACK).values
        sig_p = signal_line.tail(LOOKBACK).values

        # Tarih Stringleri
        now_ny = datetime.now(ZoneInfo("America/New_York"))
        date_str = now_ny.strftime('%Y-%m-%d')
        time_str = now_ny.strftime('%H:%M NY')

        # E) LAYOUT & CANVAS
        plt.style.use("dark_background")
        plt.rcParams["font.family"] = "DejaVu Sans"
        fig = plt.figure(figsize=(28, 18))

        gs = GridSpec(4, 2, figure=fig,
                      width_ratios=[1.0, 4],
                      height_ratios=[4, 1, 1, 1],
                      left=0.02, right=0.98, top=0.88, bottom=0.05, wspace=0.1, hspace=0.1)
        ax_info = fig.add_subplot(gs[:, 0])
        ax_price = fig.add_subplot(gs[0, 1])
        ax_vol = fig.add_subplot(gs[1, 1], sharex=ax_price)
        ax_rsi = fig.add_subplot(gs[2, 1], sharex=ax_price)
        ax_macd = fig.add_subplot(gs[3, 1], sharex=ax_price)
        ax_info.axis("off")

        # F) HEADER & SOL PANEL
        company_info = get_company_info(ticker)
        header_title = f"{ticker}  •  {company_info['name']}  •  {company_info['exchange']}"

        fig.text(0.70, 0.94, header_title,
                 fontsize=52, fontweight="bold",
                 color="#00B0FF", ha="center", va="top",
                 family='monospace')

        info_lines = [
            ("HEADER_MAIN", "━━━━━━━━━━━━━━"),
            ("DATE", f"📅 {date_str}"),
            ("TIME", f"🕒 {time_str}"),
            ("HEADER_MAIN", "━━━━━━━━━━━━━━"),
            ("PRICE_LBL", "CURRENT PRICE"),
            ("SPACER", ""),
            ("PRICE", f"${curr_price:,.2f}"),
            ("HEADER_MAIN", ""),
            ("SUBHEAD", "📊 PERFORMANCE"),
            ("CHG", f"7D:   {a_7d} %{abs(chg_7d):.1f}", c_7d),
            ("CHG", f"30D:  {a_30d} %{abs(chg_30d):.1f}", c_30d),
            ("CHG", f"1Y:   {a_1y} %{abs(chg_1y):.1f}", c_1y),
            ("HEADER_MAIN", "━━━━━━━━━━━━━━"),
            ("SUBHEAD", "📈 INDICATORS"),
            ("RSI_LEVEL", f"RSI(14): {rsi_now:.1f}", rsi_color(rsi_now)),
            ("ATR", f"ATR: {atr_now:.2f}"),
            ("VOL", f"{vol_tag}"),
            ("HEADER_MAIN", "━━━━━━━━━━━━━━"),
            ("SUBHEAD", "📐 MOVING AVG"),
            ("LEVEL", f"EMA 20: ${ema20_p[-1]:,.2f}"),
            ("LEVEL", f"EMA 50: ${ema50_p[-1]:,.2f}"),
            ("LEVEL", f"EMA 100: ${ema100_p[-1]:,.2f}"),
        ]

        y = 0.95
        bright_blue = "#00B0FF"

        for item in info_lines:
            tag = item[0]
            text = item[1]
            color = item[2] if len(item) > 2 else "white"

            if tag == "HEADER_MAIN":
                ax_info.text(0.02, y, text, fontsize=18, color="#444444", fontweight="bold"); y -= 0.025
            elif tag == "DATE":
                ax_info.text(0.02, y, text, fontsize=26, fontweight="bold", color="#FFFFFF"); y -= 0.045
            elif tag == "TIME":
                ax_info.text(0.02, y, text, fontsize=20, color="#AAAAAA"); y -= 0.045
            elif tag == "PRICE_LBL":
                ax_info.text(0.02, y, text, fontsize=22, color="#888888", fontweight="bold", style='italic'); y -= 0.020
            elif tag == "SPACER":
                y -= 0.030
            elif tag == "PRICE":
                ax_info.text(0.02, y, text, fontsize=56, fontweight="bold", color="#FFFFFF", family='monospace'); y -= 0.080
            elif tag == "SUBHEAD":
                ax_info.text(0.02, y, text, fontsize=32, fontweight="bold", color=bright_blue); y -= 0.050
            elif tag in ["RSI_LEVEL", "CHG", "LEVEL", "ATR", "VOL"]:
                ax_info.text(0.02, y, text, fontsize=26, fontweight="bold", color=color, family='monospace'); y -= 0.045
            else:
                ax_info.text(0.02, y, text, fontsize=24, color=color); y -= 0.045

        ax_info.text(0.02, 0.045, "Created by", fontsize=18, color=bright_blue, alpha=0.8, style='italic')
        ax_info.text(0.02, 0.015, "AFK DaSYS", fontsize=42, fontweight="bold", color=bright_blue, family='monospace')

        # G) MAIN PRICE CHART
        up = c_plot >= o_plot
        down = c_plot < o_plot
        col_up = "#00E676"
        col_down = "#FF5252"

        ax_price.vlines(x_vals, l_plot, h_plot, color="white", linewidth=1.5, zorder=3, alpha=0.8)
        ax_price.bar(x_vals[up], c_plot[up]-o_plot[up], bottom=o_plot[up], width=0.8, color=col_up, zorder=3)
        ax_price.bar(x_vals[down], o_plot[down]-c_plot[down], bottom=c_plot[down], width=0.8, color=col_down, zorder=3)

        ax_price.plot(x_vals, ema20_p, color='#FF9500', linewidth=3.0, label='EMA 20', alpha=1.0)
        ax_price.plot(x_vals, ema50_p, color='#673AB7', linewidth=3.0, label='EMA 50', alpha=0.95)
        ax_price.plot(x_vals, ema100_p, color='#F57C00', linewidth=2.5, label='EMA 100', alpha=0.90, linestyle='--')

        ax_price.fill_between(x_vals, bb_h_p, bb_l_p, alpha=0.15, color='#CCCCCC', label='Bollinger')

        text_offset = x_vals[int(len(x_vals) * 0.1)] if len(x_vals) > 10 else x_vals[0]

        ax_price.axhline(support_level, color="#00E676", linestyle="--", linewidth=2.0, alpha=0.8)
        ax_price.text(text_offset, support_level, f" SUP: ${support_level:.2f}",
                      color="#00E676", fontsize=24, fontweight='bold', va='bottom', ha='left', backgroundcolor='#00000080')

        ax_price.axhline(resistance_level, color="#FF5252", linestyle="--", linewidth=2.0, alpha=0.8)
        ax_price.text(text_offset, resistance_level, f" RES: ${resistance_level:.2f}",
                      color="#FF5252", fontsize=24, fontweight='bold', va='bottom', ha='left', backgroundcolor='#00000080')

        ax_price.text(0.99, 0.02, tf_label, transform=ax_price.transAxes,
                      fontsize=20, color="#AAAAAA", ha='right', fontweight='bold')

        ax_price.grid(True, alpha=0.2, color='#444444', linestyle='--', linewidth=1.0)
        ax_price.set_axisbelow(True)
        ax_price.legend(loc='upper left', framealpha=0.9, fancybox=True, fontsize=20, facecolor='#000000', edgecolor='#444444')
        ax_price.axhline(curr_price, color="white", linestyle="--", linewidth=1.5, alpha=0.7)
        ax_price.tick_params(axis='y', labelsize=16, colors='#DDDDDD')

        fig.text(0.55, 0.55, "AFK DaSYS", fontsize=110, color='white',
                 alpha=0.07, ha='center', va='center', rotation=10, weight='bold', zorder=0)

        # H) SUBPLOTS
        v_colors = np.where(c_plot >= o_plot, col_up, col_down)
        ax_vol.bar(x_vals, v_plot, color=v_colors, alpha=0.8, width=0.8)
        ax_vol.set_ylabel("Vol", color="white", fontsize=16)
        ax_vol.grid(True, alpha=0.2)

        ax_rsi.plot(x_vals, rsi_p, color="#FFD700", linewidth=2.0)
        ax_rsi.axhline(70, color="#FF5252", linestyle="--", alpha=0.6)
        ax_rsi.axhline(30, color="#00E676", linestyle="--", alpha=0.6)
        ax_rsi.set_ylabel("RSI", color="white", fontsize=16)
        ax_rsi.set_ylim(0, 100)

        hist_val = macd_p - sig_p
        ax_macd.plot(x_vals, macd_p, color="#00B0FF", linewidth=2.0, label="MACD")
        ax_macd.plot(x_vals, sig_p, color="#FF9100", linewidth=2.0, label="Signal")
        hist_colors = np.where(hist_val >= 0, "#00E676", "#FF5252")
        ax_macd.bar(x_vals, hist_val, color=hist_colors, alpha=0.7, width=0.8)
        ax_macd.set_ylabel("MACD", color="white", fontsize=16)

        # I) DINAMIK EKSEN ETİKETLERİ
        tick_interval = max(1, len(x_vals) // 8)
        ticks_to_show = x_vals[::tick_interval]

        if use_1h:
            tick_labels = df_plot.index[::tick_interval].strftime('%m-%d %H:%M')
        else:
            tick_labels = df_plot.index[::tick_interval].strftime('%Y-%m-%d')

        ax_macd.set_xticks(ticks_to_show)
        ax_macd.set_xticklabels(tick_labels, rotation=0, ha='center')
        ax_macd.tick_params(axis='x', labelsize=14, colors='#DDDDDD')
        plt.setp(ax_price.get_xticklabels(), visible=False)
        plt.setp(ax_vol.get_xticklabels(), visible=False)
        plt.setp(ax_rsi.get_xticklabels(), visible=False)

        # J) KAYDETME
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
            tmp_path = tmp.name

        plt.savefig(tmp_path, dpi=150, facecolor="#121212", bbox_inches="tight")
        plt.close(fig)

        return tmp_path

    except Exception as e:
        logger.error(f"Chart error for {ticker}: {e}", exc_info=True)
        if fig:
            try:
                plt.close(fig)
            except:
                pass
        raise  # Re-raise so endpoint can report the actual error

# ─────────────────────────────────────────────────────────────
# API ENDPOINTS
# ─────────────────────────────────────────────────────────────

@router.get("/{ticker}")
async def get_chart(
    ticker: str,
    period: str = "1y",
    interval: str = "1d"
):
    """Hisse grafiğini getir"""
    try:
        # Veriyi indir
        logger.info(f"Downloading data for {ticker} period={period} interval={interval}")
        df = yf.download(ticker, period=period, interval=interval, progress=False, auto_adjust=True)

        if df.empty:
            raise HTTPException(status_code=404, detail=f"Ticker {ticker} için veri bulunamadı")

        logger.info(f"Data downloaded for {ticker}: {len(df)} rows, columns: {list(df.columns)}")

        # Flatten MultiIndex columns from yfinance
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.droplevel(1)

        # Grafiği üret
        try:
            chart_path = generate_stock_chart(ticker, df)
        except Exception as chart_err:
            logger.error(f"Chart generation failed for {ticker}: {chart_err}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Chart generation error: {str(chart_err)}")

        if not chart_path or not os.path.exists(chart_path):
            raise HTTPException(status_code=500, detail="Grafik oluşturulamadı - chart_path is None")

        logger.info(f"Chart generated for {ticker}: {chart_path}")

        # Dosyayı gönder ve sonra temizle
        return FileResponse(chart_path, media_type="image/png", filename=f"{ticker}.png")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Chart endpoint error for {ticker}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Grafik hatası: {str(e)}")
