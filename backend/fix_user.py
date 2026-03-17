import os
import sys
from dotenv import load_dotenv
from supabase import create_client

# .env dosyasını yükle
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ HATA: SUPABASE_URL veya SUPABASE_KEY bulunamadı!")
    sys.exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

EMAIL = "hkoruk3535@gmail.com"

def fix_user():
    print(f"[*] {EMAIL} kullanicisi için yetki guncellemesi baslatiliyor...")
    
    try:
        # Kullanıcıyı bul
        result = supabase.table("users").select("id").eq("email", EMAIL).execute()
        
        if not result.data:
            print(f"[!] DIKKAT: {EMAIL} adresine sahip kullanici bulunamadi.")
            return

        user_id = result.data[0]["id"]
        
        # Yetkisini Pro yap
        supabase.table("users").update({
            "role": "pro",
            "subscription_tier": "pro"
        }).eq("id", user_id).execute()
        
        print(f"[+] BASARILI: {EMAIL} kullanicisi PRO uye yapildi.")

    except Exception as e:
        print(f"HATA olustu: {e}")

if __name__ == "__main__":
    fix_user()
