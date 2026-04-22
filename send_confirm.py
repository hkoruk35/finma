
import asyncio
import aiohttp

TELEGRAM_API_KEY = "7609846781:AAEl_2w8vHXkaDXUZyWoRK5N4_5RRcFkXsM"
TELEGRAM_CHAT_ID = "8061806611"

async def send_tg(text):
    url = f"https://api.telegram.org/bot{TELEGRAM_API_KEY}/sendMessage"
    payload = {
        "chat_id": TELEGRAM_CHAT_ID,
        "text": text,
        "parse_mode": "HTML"
    }
    async with aiohttp.ClientSession() as session:
        async with session.post(url, json=payload, timeout=20) as resp:
            return await resp.text()

if __name__ == "__main__":
    res = asyncio.run(send_tg("🐂 <b>BOGA AI</b> — Bot Yeniden Başlatıldı (Genişletilmiş Filtreler Aktif)"))
    print(res)
