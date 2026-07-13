import os
import time
import urllib.request
import urllib.error
import json
from datetime import datetime

# Load env variables from frontend/.env.local
ENV_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "frontend", ".env.local")
env = {}
if os.path.exists(ENV_PATH):
    with open(ENV_PATH, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, val = line.split("=", 1)
                env[key.strip()] = val.strip()

CRON_SECRET = env.get("CRON_SECRET")
SUPABASE_URL = env.get("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = env.get("SUPABASE_SERVICE_KEY")

if not CRON_SECRET or not SUPABASE_URL or not SUPABASE_KEY:
    print("HATA: Gerekli çevre değişkenleri yüklenemedi. Lütfen frontend/.env.local dosyasını kontrol edin.")
    exit(1)

def check_queue():
    """Checks if there are any unused items in content pool or any draft posts left."""
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}"
    }
    
    # Check unused items in pool
    pool_url = f"{SUPABASE_URL}/rest/v1/x_content_pool?select=id&used_at=is.null"
    # Check draft posts in x_posts
    posts_url = f"{SUPABASE_URL}/rest/v1/x_posts?select=id&status=eq.draft"
    
    try:
        # Check pool
        req_pool = urllib.request.Request(pool_url, headers=headers)
        with urllib.request.urlopen(req_pool) as res:
            pool_items = json.loads(res.read().decode())
            unused_count = len(pool_items)
            
        # Check drafts
        req_posts = urllib.request.Request(posts_url, headers=headers)
        with urllib.request.urlopen(req_posts) as res:
            draft_items = json.loads(res.read().decode())
            draft_count = len(draft_items)
            
        return unused_count, draft_count
    except Exception as e:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] Veritabani kontrolu basarisiz: {e}")
        return -1, -1

def trigger_scheduler():
    url = "https://bogastock.com/api/cron/x-scheduler"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {CRON_SECRET}"})
    try:
        with urllib.request.urlopen(req) as res:
            response_data = json.loads(res.read().decode())
            return True, response_data
    except urllib.error.HTTPError as e:
        try:
            err_data = json.loads(e.read().decode())
        except Exception:
            err_data = e.reason
        return False, f"HTTP Hata {e.code}: {err_data}"
    except Exception as e:
        return False, str(e)

print("==================================================")
print("     BOGA STOCK X OTOMATIK GONDERICI BASLATILDI   ")
print(f"     Baslangic Zamani: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print("==================================================")

# Loop until queue is empty
while True:
    unused_pool, draft_posts = check_queue()
    
    # Database connection issues
    if unused_pool == -1 and draft_posts == -1:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] DB baglanti hatasi nedeniyle 30 saniye sonra tekrar denenecek...")
        time.sleep(30)
        continue
        
    print(f"[{datetime.now().strftime('%H:%M:%S')}] Mevcut durum - Kuyruktaki kullanilmamis hisseler: {unused_pool}, Gonderilmeyi bekleyen taslaklar: {draft_posts}")
    
    if unused_pool == 0 and draft_posts == 0:
        print("Tebrikler! Kuyruktaki tum hisseler ve tum dil versiyonlari basariyla paylasildi. Otomasyon sonlandiriliyor.")
        break
        
    print("X-Scheduler tetikleniyor...")
    success, result = trigger_scheduler()
    
    if success:
        print(f"Tetikleme Basarili! Cikti: {json.dumps(result, indent=2, ensure_ascii=False)}")
        # Check if rate limit, elapsed time skip, etc.
        if "skipped" in result:
            reason = result.get("skipped")
            print(f"Gonderim atlandi: {reason}")
            if "interval not elapsed" in reason:
                # If interval is not elapsed, wait 1 minute before checking again
                print("Paylasim araligi henuz dolmamis, 1 dakika bekleniyor...")
                time.sleep(60)
                continue
            elif "daily X API free-tier limit reached" in reason:
                print("Gunluk API limitine ulasildi. 1 saat bekleniyor...")
                time.sleep(3600)
                continue
        # Normal posting occurred
        print("Sonraki paylasim icin 5 dakika (300 saniye) bekleniyor...")
        time.sleep(300)
    else:
        print(f"Tetikleme Hatali: {result}")
        print("1 dakika sonra tekrar denenecek...")
        time.sleep(60)
