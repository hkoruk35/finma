"""
GEÇİCİ doğrulama scripti — git'e dokunmaz, sadece okuma (yfinance) yapar.
discover_top_n()'in yeni 1H mantığını küçük, gerçek bir ticker listesinde
izole çalıştırıp eski/yeni skor karşılaştırması gösterir. Onay sonrası silinecek.
"""
import asyncio
import logging

logging.basicConfig(level=logging.WARNING)

from inday313 import (
    discover_top_n,
    _download_chunk_multi,
    calculate_boga_indicators,
    analyze_1h_structure,
    detect_1h_candle_pattern,
    BULLISH_1H_PATTERNS,
    BEARISH_1H_PATTERNS,
)

TEST_UNIVERSE = [
    "AAPL", "MSFT", "NVDA", "TSLA", "AMD", "META", "AMZN", "GOOGL",
    "AVGO", "NFLX", "CRM", "PLTR", "SMCI", "COIN", "MARA", "SOFI",
    "RIVN", "F", "BAC", "XOM",
]


async def main():
    print(f"İndiriliyor: {len(TEST_UNIVERSE)} ticker...\n")

    # 1) Gerçek (değiştirilmiş) discover_top_n çıktısı — production'da çalışacak kod, birebir.
    results = await discover_top_n(TEST_UNIVERSE, top_n=20)
    by_ticker = {r["ticker"]: r for r in results}

    # 2) Sadece component breakdown göstermek için bağımsız tekrar-hesap
    #    (struct_1h_score scored dict'te yok, sadece debug amaçlı tekrar çağırıyoruz).
    data_1h = await _download_chunk_multi(TEST_UNIVERSE, period="1mo", interval="1h", prepost=True)

    rows = []
    for ticker, r in by_ticker.items():
        df_1h = data_1h.get(ticker)
        rsi_bonus = struct_contrib = pattern_contrib = 0.0
        if df_1h is not None and not df_1h.empty:
            try:
                df_1h_ind = calculate_boga_indicators(df_1h, "1h")
                rsi_1h = float(df_1h_ind["RSI"].iloc[-1])
                rsi_slope_1h = float(df_1h_ind["RSI"].diff(periods=5).iloc[-1])
                if rsi_slope_1h > 0 and 40 <= rsi_1h <= 75:
                    rsi_bonus = 1.0
                struct_1h = analyze_1h_structure(df_1h_ind)
                struct_contrib = float(struct_1h.get("1h_score", 0.0)) * 0.5
                pattern_1h = detect_1h_candle_pattern(df_1h)
                if pattern_1h in BULLISH_1H_PATTERNS:
                    pattern_contrib = 2.0
                elif pattern_1h in BEARISH_1H_PATTERNS:
                    pattern_contrib = -1.5
            except Exception as e:
                print(f"  [diag hata] {ticker}: {e}")

        new_score = r["discovery_score"]
        added = rsi_bonus + struct_contrib + pattern_contrib
        old_score_approx = round(new_score - added, 2)
        rows.append({
            **r,
            "old_score_approx": old_score_approx,
            "rsi_1h_bonus": rsi_bonus,
            "struct_1h_contrib": round(struct_contrib, 2),
            "pattern_1h_contrib": pattern_contrib,
        })

    # ── Detaylı tablo (yeni skora göre sıralı) ──
    rows_new_sorted = sorted(rows, key=lambda x: x["discovery_score"], reverse=True)
    print("=" * 148)
    print(f"{'Ticker':<7}{'Yeni':>7}{'Eski~':>8}{'Δ':>7}  {'RSI1h':>6}{'Slope1h':>8}{'+RSI':>6}{'+Yapı':>7}{'Patern1h':>16}{'+Pat':>6}  {'Setup1H':<18}{'Onaylı':<8}")
    print("=" * 148)
    for r in rows_new_sorted:
        delta = round(r["discovery_score"] - r["old_score_approx"], 2)
        print(
            f"{r['ticker']:<7}{r['discovery_score']:>7.2f}{r['old_score_approx']:>8.2f}{delta:>+7.2f}  "
            f"{r['rsi_1h']:>6.1f}{r['rsi_slope_1h']:>+8.1f}{r['rsi_1h_bonus']:>6.1f}{r['struct_1h_contrib']:>7.2f}"
            f"{r['pattern_1h']:>16}{r['pattern_1h_contrib']:>+6.1f}  {r['setup_type_1h']:<18}{str(r['confirmed_1d']):<8}"
        )

    # ── Sıralama karşılaştırması: eski formülde sıra neydi, yeni formülde ne oldu ──
    rows_old_sorted = sorted(rows, key=lambda x: x["old_score_approx"], reverse=True)
    old_rank = {r["ticker"]: i + 1 for i, r in enumerate(rows_old_sorted)}
    new_rank = {r["ticker"]: i + 1 for i, r in enumerate(rows_new_sorted)}

    print("\n" + "=" * 60)
    print("SIRALAMA DEĞİŞİMİ (eski formül sırası → yeni formül sırası)")
    print("=" * 60)
    for r in rows_new_sorted:
        t = r["ticker"]
        move = old_rank[t] - new_rank[t]
        arrow = "▲" if move > 0 else ("▼" if move < 0 else "=")
        print(f"  {t:<7} #{old_rank[t]:>2} → #{new_rank[t]:>2}  {arrow} {abs(move)}")


if __name__ == "__main__":
    asyncio.run(main())
