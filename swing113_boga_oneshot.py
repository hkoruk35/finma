import asyncio
import os
import sys

if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

from swing113_boga import scan_top_stocks

async def main():
    print("🚀 BOGA AI Oneshot Scanner Baslatiliyor...")
    try:
        if os.name == 'nt':
            asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
        await scan_top_stocks()
        print("✅ Tarama basariyla tamamlandi.")
    except Exception as e:
        print(f"❌ Kritik Hata: {e}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
