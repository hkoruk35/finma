"""
FinMA Signal Push Script
========================
Swing112 botu çalıştıktan sonra bu script otomatik olarak çağrılır.
Bot sonuçlarını Railway'deki FinMA API'ye push eder.

KULLANIM:
  python push_to_finma.py                          # output/bot_analysis_latest.json okur
  python push_to_finma.py --file path/to/file.json # özel dosya yolu

BOT SCHEDULER'A EKLEMEK İÇİN:
  Swing112 botu bittikten sonra bu scripti çağır:
    subprocess.run(["python", "push_to_finma.py"], check=True)
  veya scheduler'da sırayla çalıştır.
"""

import json
import os
import sys
import argparse
import requests
from datetime import datetime

# ─── Konfigürasyon ───
# Vercel'e push (Supabase'e kalıcı yazar) — Railway bypass
FINMA_API_URL = "https://www.finmasmart.com"
BOT_API_KEY   = os.environ.get("BOT_API_KEY", "finma-bot-2026")

# Bot output dosya yolları (sırayla dener)
DEFAULT_PATHS = [
    os.path.join(os.path.dirname(__file__), "output", "bot_analysis_latest.json"),
    os.path.join(os.path.dirname(__file__), "output", "swing112_latest.json"),
    os.path.join(os.path.dirname(__file__), "..", "output", "bot_analysis_latest.json"),
]


def load_bot_output(file_path: str = None) -> dict:
    """Bot output JSON dosyasını oku."""
    paths = [file_path] if file_path else DEFAULT_PATHS

    for path in paths:
        if path and os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
                print(f"✅ Dosya okundu: {path}")
                return data

    raise FileNotFoundError(
        f"Bot output dosyası bulunamadı. Beklenen konumlar:\n"
        + "\n".join(f"  - {p}" for p in paths)
    )


def convert_to_push_format(bot_data: dict) -> dict:
    """
    Bot output formatını FinMA push formatına dönüştür.

    Bot output formatı (bot_analysis_latest.json):
      candidates: [{ticker, score, price, entry, stop_loss, tp1, tp2, sector, ...}]

    FinMA push formatı:
      candidates: [{ticker, score, price, entry, stop_loss, tp1, tp2, action, sector, notes}]
    """
    candidates = bot_data.get("candidates", [])
    push_candidates = []

    for c in candidates:
        ticker = str(c.get("ticker", "")).upper()
        score  = float(c.get("score", 0))
        price  = float(c.get("price", 0))

        # Giriş fiyatı: entry veya price
        entry  = float(c.get("entry", c.get("entry_price", price)))

        # Stop loss
        stop_loss = float(c.get("stop_loss", c.get("stop", 0)))

        # Hedefler: tp1/tp2 veya target1/target2 veya target
        tp1 = float(c.get("tp1", c.get("target1", c.get("target", entry * 1.05))))
        tp2 = float(c.get("tp2", c.get("target2", c.get("target", entry * 1.10))))

        sector = str(c.get("sector", "Unknown"))
        action = str(c.get("action", "BUY")).upper()
        notes  = c.get("notes", [f"Swing112 skor: {score}"])

        if not ticker or score <= 0:
            continue

        push_candidates.append({
            "ticker":    ticker,
            "score":     round(score, 1),
            "price":     round(price, 4),
            "entry":     round(entry, 4),
            "stop_loss": round(stop_loss, 4),
            "tp1":       round(tp1, 4),
            "tp2":       round(tp2, 4),
            "action":    action,
            "sector":    sector,
            "notes":     notes if isinstance(notes, list) else [str(notes)],
        })

    return {
        "bot_name":      bot_data.get("bot_name", "swing112"),
        "market_regime": bot_data.get("market_regime", "Bull"),
        "vix_level":     float(bot_data.get("vix_level", 20.0)),
        "sector_leaders": bot_data.get("sector_leaders", []),
        "candidates":    push_candidates,
    }


def push_to_finma(payload: dict) -> dict:
    """FinMA API'ye push et."""
    url = f"{FINMA_API_URL}/api/signals/push"
    headers = {
        "Content-Type": "application/json",
        "X-Api-Key": BOT_API_KEY,
    }

    print(f"🚀 FinMA API'ye push ediliyor: {url}")
    print(f"   Aday sayısı: {len(payload['candidates'])}")
    print(f"   Bot: {payload['bot_name']} | Rejim: {payload['market_regime']} | VIX: {payload['vix_level']}")

    resp = requests.post(url, json=payload, headers=headers, timeout=30)
    resp.raise_for_status()

    result = resp.json()
    print(f"✅ Başarılı! {result.get('count', 0)} sinyal push edildi — {result.get('timestamp', '')}")
    return result


def main():
    parser = argparse.ArgumentParser(description="FinMA Signal Push")
    parser.add_argument("--file", help="Bot output JSON dosya yolu (opsiyonel)")
    parser.add_argument("--dry-run", action="store_true", help="API'ye göndermeden sadece dosyayı okur/gösterir")
    args = parser.parse_args()

    print(f"\n{'='*50}")
    print(f"  FinMA Push Script — {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*50}\n")

    try:
        # 1. Bot output'unu oku
        bot_data = load_bot_output(args.file)

        # 2. Formatı dönüştür
        payload = convert_to_push_format(bot_data)

        if args.dry_run:
            print("\n[DRY RUN] Push edilecek veri:")
            print(json.dumps(payload, indent=2, ensure_ascii=False)[:1000])
            print(f"\nToplam {len(payload['candidates'])} aday")
            return

        # 3. API'ye push et
        push_to_finma(payload)

    except FileNotFoundError as e:
        print(f"❌ Hata: {e}")
        sys.exit(1)
    except requests.HTTPError as e:
        print(f"❌ API Hatası: {e.response.status_code} — {e.response.text}")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Beklenmedik hata: {e}")
        sys.exit(1)

    print(f"\n{'='*50}")
    print("  FinMA güncellendi. Site otomatik yenilendi.")
    print(f"{'='*50}\n")


if __name__ == "__main__":
    main()
