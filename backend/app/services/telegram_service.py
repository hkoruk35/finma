"""
Telegram Service - Ported from bots/telegram_notifier.py
Signal broadcasting and PnL reporting
"""

import aiohttp
import logging
from typing import Optional, List, Dict
from app.config import get_settings

logger = logging.getLogger(__name__)

TELEGRAM_MAX_LENGTH = 4096


async def send_telegram_message(text: str, chat_id: Optional[str] = None) -> bool:
    """Send a message via Telegram Bot API"""
    settings = get_settings()
    token = settings.telegram_bot_token
    target_chat = chat_id or settings.telegram_chat_id

    if not token or not target_chat:
        logger.warning("Telegram token veya chat_id eksik")
        return False

    url = f"https://api.telegram.org/bot{token}/sendMessage"

    # Split long messages
    chunks = [text[i:i + TELEGRAM_MAX_LENGTH] for i in range(0, len(text), TELEGRAM_MAX_LENGTH)]

    success = True
    try:
        async with aiohttp.ClientSession() as session:
            for chunk in chunks:
                payload = {
                    "chat_id": target_chat,
                    "text": chunk,
                    "parse_mode": "HTML",
                }
                async with session.post(url, json=payload) as resp:
                    if resp.status != 200:
                        error_body = await resp.text()
                        logger.error(f"Telegram hata: {resp.status} - {error_body}")
                        success = False
    except Exception as e:
        logger.error(f"Telegram gönderim hatası: {e}")
        success = False

    return success


def format_signal_message(signal: Dict) -> str:
    """Format a bot signal as Telegram message"""
    action = signal.get("action", "N/A")
    emoji = "🟢" if action == "BUY" else "🔴" if action in ("SELL", "CLOSE") else "🟡"

    return f"""{emoji} <b>FinMA Sinyal</b> | {signal.get('ticker', 'N/A')}

📊 Aksiyon: <b>{action}</b>
💰 Fiyat: ${signal.get('price', 0):.2f}
🎯 Giriş Bölgesi: {signal.get('entry_zone', 'N/A')}
🛑 Stop Loss: ${signal.get('stop_loss', 0):.2f}
🏁 Hedef: ${signal.get('target', 0):.2f}
📈 Potansiyel: {signal.get('potential_pct', 0):.2f}%
⭐ Skor: {signal.get('score', 0):.1f}
🏭 Sektör: {signal.get('sector', 'N/A')}

⚠️ Bu finansal tavsiye değildir.
🤖 FinMA Terminal"""


def format_daily_report(signals: List[Dict], regime: Dict) -> str:
    """Format daily signal report for Telegram"""
    header = f"""📋 <b>FinMA Günlük Rapor</b>

🌍 Piyasa: <b>{regime.get('regime_tr', 'Bilinmiyor')}</b>
📊 VIX: {regime.get('vix', 'N/A')}
📈 S&P 500: {regime.get('spy_price', 'N/A')}

━━━━━━━━━━━━━━━━━━━━━━━━
<b>Bot Sinyalleri ({len(signals)} aday)</b>
━━━━━━━━━━━━━━━━━━━━━━━━
"""
    rows = []
    for s in signals[:10]:
        action = s.get("action", "?")
        emoji = "🟢" if action == "BUY" else "🔴" if action in ("SELL", "CLOSE") else "🟡"
        rows.append(
            f"{emoji} <b>{s.get('ticker', '?')}</b> | "
            f"Skor: {s.get('score', 0):.1f} | "
            f"${s.get('price', 0):.2f} | "
            f"Pot: {s.get('potential_pct', 0):+.1f}%"
        )

    body = "\n".join(rows) if rows else "Sinyal bulunamadı"

    footer = "\n\n⚠️ Bu finansal tavsiye değildir.\n🤖 FinMA Terminal"

    return header + body + footer


def format_trade_table(trades: List[Dict]) -> str:
    """Format active trades as Telegram table"""
    if not trades:
        return "📭 Açık pozisyon bulunmuyor."

    header = """🔔 <b>Açık Pozisyonlar</b>

┌────────┬────┬──────────┬──────────┬─────────┐
│ Sembol │Yön │  Giriş   │  Mevcut  │   PnL   │
├────────┼────┼──────────┼──────────┼─────────┤"""

    rows = []
    total_pnl = 0
    for t in trades:
        pnl = t.get("pnl", 0)
        total_pnl += pnl
        direction = "L" if t.get("direction", "").upper() == "LONG" else "S"
        pnl_str = f"{pnl:+.2f}"
        rows.append(
            f"│ {t.get('ticker', '?'):6s} │ {direction:2s} │ "
            f"{t.get('entry_price', 0):8.2f} │ "
            f"{t.get('current_price', 0):8.2f} │ "
            f"{pnl_str:7s} │"
        )

    footer = f"""├────────┴────┴──────────┴──────────┴─────────┤
│ TOPLAM PnL: ${total_pnl:+.2f}{' ' * max(0, 22 - len(f'${total_pnl:+.2f}'))}│
└─────────────────────────────────────────────┘

⚠️ Bu finansal tavsiye değildir.
🤖 FinMA Terminal"""

    return header + "\n" + "\n".join(rows) + "\n" + footer


async def broadcast_signals(signals: List[Dict], regime: Dict) -> bool:
    """Broadcast daily signals to Telegram"""
    message = format_daily_report(signals, regime)
    return await send_telegram_message(message)


async def broadcast_trade_update(trades: List[Dict]) -> bool:
    """Broadcast trade updates to Telegram"""
    message = format_trade_table(trades)
    return await send_telegram_message(message)
