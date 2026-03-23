"""
swing113 Local Runner + Railway Push
=====================================
Bu script:
1) swing113.py'yi lokal bilgisayarınızda çalıştırır (Yahoo ban yok)
2) Oluşan swing113_latest.json dosyasını okur
3) Railway backend API'sine push eder
4) Frontend anında güncellenir

Kullanım (CMD):
    cd C:\\Users\\afksm\\finma\\backend
    python bots\\local_scan_push.py
"""

import subprocess
import sys
import os
import json
import time
import urllib.request
import urllib.error

# ─── Ayarlar ──────────────────────────────────────────────────
BACKEND_URL = "https://finma-production.up.railway.app"
API_KEY = os.environ.get("BOT_API_KEY", "finma-bot-secret-key")

# Paths
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(SCRIPT_DIR)   # .../backend
BOT_SCRIPT = os.path.join(SCRIPT_DIR, "swing113.py")
OUTPUT_JSON = os.path.join(SCRIPT_DIR, "output", "swing113_latest.json")


def run_bot_locally():
    """swing113.py'yi --one-shot modunda çalıştır"""
    print("=" * 60)
    print("🦅 ATMACA V113 — Lokal Tarama Başlıyor...")
    print("=" * 60)
    
    start = time.time()
    
    result = subprocess.run(
        [sys.executable, BOT_SCRIPT, "--one-shot"],
        cwd=BACKEND_DIR,
        text=True,
        encoding="utf-8",
    )
    
    elapsed = time.time() - start
    print(f"\n⏱ Tarama süresi: {elapsed:.1f} saniye")
    
    if result.returncode != 0:
        print(f"❌ Bot hata ile çıktı (exit code: {result.returncode})")
        return False
    
    print("✅ Tarama başarıyla tamamlandı!")
    return True


def push_to_railway():
    """swing113_latest.json dosyasını Railway API'sine gönder"""
    if not os.path.exists(OUTPUT_JSON):
        print(f"❌ JSON dosyası bulunamadı: {OUTPUT_JSON}")
        return False
    
    with open(OUTPUT_JSON, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    opportunities = data.get("opportunities", [])
    if not opportunities:
        print("⚠️ JSON'da fırsat bulunamadı, push atlanıyor.")
        return False
    
    # Push endpoint payload
    payload = {
        "run_id": data.get("run_id", f"local_{int(time.time())}"),
        "run_at": data.get("run_timestamp", data.get("run_at", "")),
        "schedule_slot": data.get("run_time_ny", "local"),
        "opportunities": opportunities,
    }
    
    url = f"{BACKEND_URL}/api/signals/swing113/push"
    
    print(f"\n📡 {len(opportunities)} fırsat Railway'e gönderiliyor...")
    print(f"   URL: {url}")
    
    try:
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "X-API-Key": API_KEY,
            },
            method="POST",
        )
        
        with urllib.request.urlopen(req, timeout=30) as resp:
            result = json.loads(resp.read().decode("utf-8"))
            print(f"✅ Push başarılı! Sonuç: {result}")
            return True
            
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        print(f"❌ HTTP {e.code} hatası: {body}")
        return False
    except Exception as e:
        print(f"❌ Push hatası: {e}")
        return False


def main():
    print()
    
    # Adım 1: Lokal tarama
    success = run_bot_locally()
    if not success:
        print("\n❌ Tarama başarısız oldu. Push atlanıyor.")
        sys.exit(1)
    
    # Adım 2: Railway'e push
    print("\n" + "=" * 60)
    print("📡 Sonuçlar Railway'e gönderiliyor...")
    print("=" * 60)
    
    pushed = push_to_railway()
    
    if pushed:
        print("\n" + "=" * 60)
        print("🎉 TAMAMLANDI!")
        print("   → Fırsatlar Railway'e başarıyla gönderildi")
        print("   → Frontend şimdi otomatik güncellenecek")
        print("   → https://finmasmart.com/featured adresinden kontrol edin")
        print("=" * 60)
    else:
        print("\n⚠️ Push başarısız. JSON dosyası hâlâ yerelde mevcut:")
        print(f"   {OUTPUT_JSON}")
    
    print()


if __name__ == "__main__":
    main()
