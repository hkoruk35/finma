
import asyncio
import aiohttp

TELEGRAM_API_KEY = "7609846781:AAEl_2w8vHXkaDXUZyWoRK5N4_5RRcFkXsM"
TELEGRAM_CHAT_ID = "8061806611"

async def test_tg():
    url = f"https://api.telegram.org/bot{TELEGRAM_API_KEY}/sendMessage"
    payload = {
        "chat_id": TELEGRAM_CHAT_ID,
        "text": "🐂 <b>BOGA AI v6.1</b> — Bağlantı Testi Başarılı ✅",
        "parse_mode": "HTML"
    }
    async with aiohttp.ClientSession() as session:
        async with session.post(url, json=payload) as resp:
            print(f"Status: {resp.status}")
            print(await resp.text())

if __name__ == "__main__":
    asyncio.run(test_tg())
