if __name__ == "__main__":
    import sys
    if os.name == 'nt':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    
    if "--oneshot" in sys.argv:
        try:
            from zoneinfo import ZoneInfo
            ny_tz = ZoneInfo("America/New_York")
            now_ny = datetime.now(ny_tz)
            target_ny = now_ny.replace(hour=11, minute=0, second=0, microsecond=0)
            
            if now_ny < target_ny:
                wait_sec = (target_ny - now_ny).total_seconds()
                print(f"🕒 Saat henüz erken. NY 11:00 bekleniyor ({wait_sec/3600:.1f} saat)...")
                import time
                time.sleep(wait_sec)
            
            print("🚀 BOGA AI v7.1 Options Scanner (One-Shot) başlatıldı...")
            asyncio.run(scan())
            print("✅ Tarama tamamlandı.")
        except Exception as e:
            print(f"Hata: {e}")
    else:
        try:
            asyncio.run(run_scanner())
        except KeyboardInterrupt:
            print("\n🐂 BOGA AI v7.1 durduruldu.")
        except Exception as e:
            print(f"Kritik hata: {e}")
