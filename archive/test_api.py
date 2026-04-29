import asyncio
import aiohttp
import os

GEMINI_API_KEY = "AIzaSyDBO4A7PxD0VAmRrB9C4IblFJXqqmF6svY"
GEMINI_MODEL = "gemini-2.0-flash"
GEMINI_API_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"

async def test():
    prompt = "Say hello in 6 languages: EN, TR, ES, PT, FR, ID."
    url = f"{GEMINI_API_URL}?key={GEMINI_API_KEY}"
    payload = {"contents": [{"parts": [{"text": prompt}]}]}
    
    async with aiohttp.ClientSession() as session:
        async with session.post(url, json=payload) as resp:
            print(f"Status: {resp.status}")
            print(await resp.text())

asyncio.run(test())
