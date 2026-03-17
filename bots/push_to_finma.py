"""
FinMA Signal Push Script
========================
Swing112 botu çalıştıktan sonra bu script otomatik olarak çağrılır.
Bot sonuçlarını JSON dosyasına yazar → git push → Vercel otomatik deploy eder.

KULLANIM:
  python push_to_finma.py                          # output/bot_analysis_latest.json okur
  python push_to_finma.py --file path/to/file.json # özel dosya yolu
  python push_to_finma.py --dry-run                # sadece görüntüle, push etme

NASIL ÇALIŞIR:
  1. Bot output JSON okunur (20 aday)
  2. FinMA formatına dönüştürülür
  3. frontend/data/signals-latest.json dosyasına yazılır
  4. Git add → commit → push
  5. Vercel otomatik deploy eder (~2 dakika)
  6. Dashboard ve landing page güncellenir
"""

import json
import os
import sys
import argparse
import subprocess
from datetime import datetime

# ─── Dosya Yolları ───
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)  # finma/
SIGNALS_JSON   = os.path.join(PROJECT_ROOT, "frontend", "data", "signals-latest.json")
HISTORY_JSON   = os.path.join(PROJECT_ROOT, "frontend", "data", "signals-history.json")
HISTORY_MAX    = None  # None = sonsuz (admin tüm geçmişi görür, Pro son 10 günü)

# Bot output dosya yolları (sırayla dener)
DEFAULT_PATHS = [
    os.path.join(SCRIPT_DIR, "output", "bot_analysis_latest.json"),
    os.path.join(SCRIPT_DIR, "output", "swing112_latest.json"),
    os.path.join(PROJECT_ROOT, "output", "bot_analysis_latest.json"),
]


def load_bot_output(file_path: str = None) -> dict:
    """Bot output JSON dosyasını oku."""
    paths = [file_path] if file_path else DEFAULT_PATHS

    for path in paths:
        if path and os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
                print(f"  Dosya okundu: {path}")
                return data

    raise FileNotFoundError(
        f"Bot output dosyasi bulunamadi. Beklenen konumlar:\n"
        + "\n".join(f"  - {p}" for p in paths)
    )


def convert_to_signals_format(bot_data: dict) -> dict:
    """
    Bot output formatını signals-latest.json formatına dönüştür.

    Bot output: candidates: [{ticker, score, price, entry, stop_loss, tp1, tp2, sector, ...}]
    Signals format: candidates: [{ticker, score, price, action, entry_zone, stop_loss, target, potential_pct, sector, trend_phase}]
    """
    candidates = bot_data.get("candidates", [])
    signals = []

    for c in candidates:
        ticker = str(c.get("ticker", "")).upper()
        score = float(c.get("score", 0))
        price = float(c.get("price", 0))

        entry = float(c.get("entry", c.get("entry_price", price)))
        stop_loss = float(c.get("stop_loss", c.get("stop", 0)))
        tp1 = float(c.get("tp1", c.get("target1", entry * 1.05)))
        tp2 = float(c.get("tp2", c.get("target2", entry * 1.10)))

        sector = str(c.get("sector", "Unknown"))
        action = str(c.get("action", "BUY")).upper()
        trend_phase = str(c.get("trend_phase", "Expansion"))

        potential_pct = round(((tp2 - entry) / entry) * 100, 2) if entry > 0 else 0

        if not ticker or score <= 0:
            continue

        signals.append({
            "ticker": ticker,
            "score": round(score, 1),
            "price": round(price, 4),
            "action": action,
            "entry_zone": f"{entry:.2f} - {tp1:.2f}",
            "stop_loss": round(stop_loss, 4),
            "target": round(tp2, 2),
            "potential_pct": round(potential_pct, 2),
            "sector": sector,
            "trend_phase": trend_phase,
        })

    # Score'a göre sırala (en yüksek üstte)
    signals.sort(key=lambda x: x["score"], reverse=True)

    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    return {
        "timestamp": timestamp,
        "bot_name": bot_data.get("bot_name", "swing112"),
        "market_regime": bot_data.get("market_regime", "Bull"),
        "vix_level": float(bot_data.get("vix_level", 20.0)),
        "candidates": signals,
    }


def write_signals_json(data: dict):
    """signals-latest.json dosyasına yaz."""
    os.makedirs(os.path.dirname(SIGNALS_JSON), exist_ok=True)

    with open(SIGNALS_JSON, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"  JSON yazildi: {SIGNALS_JSON}")


def update_history_json(signals: dict):
    """
    signals-history.json dosyasını güncelle.
    Yeni sinyalleri başa ekle, eski girişleri (HISTORY_MAX'tan fazla) kaldır.
    Aynı güne ait kayıt varsa üzerine yaz.
    """
    today = datetime.now().strftime("%Y-%m-%d")

    # Mevcut history'yi oku
    if os.path.exists(HISTORY_JSON):
        with open(HISTORY_JSON, "r", encoding="utf-8") as f:
            try:
                history_data = json.load(f)
            except Exception:
                history_data = {"history": []}
    else:
        history_data = {"history": []}

    history = history_data.get("history", [])

    # Backtest için sadece ilk 10 aday (top10)
    top10 = signals["candidates"][:10]
    entry = {
        "date": today,
        "timestamp": signals["timestamp"],
        "market_regime": signals.get("market_regime", "Bull"),
        "vix_level": signals.get("vix_level", 20.0),
        "candidates": [
            {
                "ticker": c["ticker"],
                "sector": c.get("sector", "Unknown"),
                "entry":  round(float(c["price"]), 2),
                "tp":     round(float(c.get("target", c["price"] * 1.10)), 2),
                "sl":     round(float(c.get("stop_loss", c["price"] * 0.92)), 2),
                "score":  round(float(c["score"]), 1),
                "action": c.get("action", "BUY"),
                "potential_pct": round(float(c.get("potential_pct", 10.0)), 2),
            }
            for c in top10
        ]
    }

    # Aynı güne ait kayıt varsa kaldır (yenisini ekleyeceğiz)
    history = [h for h in history if h.get("date") != today]

    # Yeni kayıdı başa ekle
    history.insert(0, entry)

    # HISTORY_MAX varsa kes, None ise tüm geçmiş korunur
    if HISTORY_MAX is not None:
        history = history[:HISTORY_MAX]

    history_data = {"lastUpdated": today, "history": history}

    with open(HISTORY_JSON, "w", encoding="utf-8") as f:
        json.dump(history_data, f, indent=2, ensure_ascii=False)

    print(f"  History guncellendi: {len(history)} kayit — {HISTORY_JSON}")


def git_push():
    """Git add → commit → push."""
    try:
        # Proje kökünden çalıştır
        os.chdir(PROJECT_ROOT)

        # Sadece signals JSON dosyasını ekle
        subprocess.run(["git", "add",
                         "frontend/data/signals-latest.json",
                         "frontend/data/signals-history.json"],
                        check=True, capture_output=True)

        # Değişiklik var mı kontrol et
        result = subprocess.run(["git", "diff", "--cached", "--quiet"], capture_output=True)
        if result.returncode == 0:
            print("  Degisiklik yok — ayni veri, push atlanıyor.")
            return False

        # Commit
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M")
        msg = f"bot: swing112 sinyal guncelleme — {timestamp}"
        subprocess.run(["git", "commit", "-m", msg], check=True, capture_output=True)

        # Push
        subprocess.run(["git", "push"], check=True, capture_output=True)
        print(f"  Git push basarili! Vercel ~2 dk icinde deploy edecek.")
        return True

    except subprocess.CalledProcessError as e:
        print(f"  Git hatasi: {e.stderr.decode() if e.stderr else str(e)}")
        return False


def main():
    parser = argparse.ArgumentParser(description="FinMA Signal Push")
    parser.add_argument("--file", help="Bot output JSON dosya yolu (opsiyonel)")
    parser.add_argument("--dry-run", action="store_true", help="JSON yaz ama git push yapma")
    args = parser.parse_args()

    print(f"\n{'='*50}")
    print(f"  FinMA Push Script — {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*50}\n")

    try:
        # 1. Bot output'unu oku
        print("[1/3] Bot output okunuyor...")
        bot_data = load_bot_output(args.file)

        # 2. Formatı dönüştür ve JSON'ları yaz
        print("[2/3] Sinyal formatina donusturuluyor...")
        signals = convert_to_signals_format(bot_data)
        write_signals_json(signals)
        update_history_json(signals)
        print(f"  {len(signals['candidates'])} aday yazildi")
        print(f"  Bot: {signals['bot_name']} | Rejim: {signals['market_regime']} | VIX: {signals['vix_level']}")
        print(f"  Top 5: {', '.join(c['ticker'] for c in signals['candidates'][:5])}")

        if args.dry_run:
            print("\n[DRY RUN] Git push atlanıyor.")
            print(f"Dosya: {SIGNALS_JSON}")
            return

        # 3. Git push
        print("[3/3] Git push ediliyor...")
        pushed = git_push()

        if pushed:
            print(f"\n{'='*50}")
            print("  FinMA guncellendi!")
            print("  Vercel ~2 dakika icinde deploy edecek.")
            print("  https://www.finmasmart.com")
            print(f"{'='*50}\n")
        else:
            print(f"\n  Sinyal verisi ayni — site zaten guncel.")

    except FileNotFoundError as e:
        print(f"\nHATA: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\nBeklenmedik hata: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
