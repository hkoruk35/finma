"""
Endeks Gunluk Analiz Botu — index_daily_analyzer.py

SEO amacli piyasa endeksi (S&P 500, Nasdaq 100, Dow Jones, Russell 2000, DAX,
FTSE 100, CAC 40, IBEX 35, STOXX 600) gunluk quant + AI analizini uretip
Supabase index_daily_snapshot tablosuna upsert eder.

Kullanim:
  python index_daily_analyzer.py --dry-run --symbols=SPX
  python index_daily_analyzer.py --symbols=SPX,NDX,DJI --session=closing
  python index_daily_analyzer.py                      # tum 9 endeks, session HER ENDEKSIN KENDI
                                                        # yerel saatinden/schedule'indan cikarilir

ONEMLI: session artik TEK bir global NY-saat kontrolunden degil, HER ENDEKSIN
KENDI timezone + analysis_schedule'indan (bkz. index_analysis_common.py
IndexDefinition) cikarilir. --session verilirse tum semboller icin o deger
zorlanir (manuel override), verilmezse her sembol kendi yerel saatine gore
degerlendirilir (US ve Avrupa endeksleri ayni anda FARKLI session'da olabilir).

Desen: top100_sync_common.py (Supabase REST + service-role) ve
frontend/lib/earnings/deepseekAnalysis.ts (DeepSeek cok-dilli JSON) ile ayni.
Ortak yardimcilar index_analysis_common.py'de (bkz. o dosya, weekly bot da kullanir).
"""
from __future__ import annotations

import argparse
import sys
from datetime import datetime, timezone as dt_timezone

import index_analysis_common as common

PROMPT_VERSION = "daily-v1"

# analyze_symbol sonuclari — "atlandi" ile "hata" ayni sey DEGIL:
#   SKIPPED  = o endeksin analiz saati henuz gelmedi (veya zaten tamam) → normal
#   FAILED   = analiz saati gelmisti ama uretilemedi                    → gercek ariza
SUCCESS, SKIPPED, FAILED = "success", "skipped", "failed"


def analyze_symbol(
    symbol: str,
    forced_session: str | None,
    macro: dict,
    dry_run: bool,
    completed: set[tuple[str, str, str]] | None = None,
) -> str:
    idx = common.INDEX_DEFINITIONS[symbol]

    # Her endeks KENDI yerel saatinde degerlendirilir (ET her yerde hardcode edilmez).
    now_local = common.resolve_market_now(idx)
    session = forced_session or common.infer_session_for_index(idx, now_local)

    if not session:
        common.logger.warning(f"[{symbol}] Piyasa kapanmadi veya analiz saati gelmedi (yerel saat: {now_local.strftime('%H:%M')}). Atlaniyor.")
        return SKIPPED

    trade_date = now_local.strftime("%Y-%m-%d")

    # --only-missing: bu endeks/gun/oturum icin zaten basarili satir varsa
    # yeniden uretme (bos yere DeepSeek cagrisi ve upsert yapilmaz).
    if completed is not None and (symbol, trade_date, session) in completed:
        common.logger.info(f"[{symbol}] {trade_date}/{session} zaten tamam — atlaniyor (--only-missing).")
        return SKIPPED

    common.logger.info(
        f"[{symbol}] {idx.name} — fiyat verisi cekiliyor ({idx.yahoo_ticker}); "
        f"tz={idx.timezone} yerel_saat={now_local.strftime('%H:%M')} session={session}..."
    )

    df = common.fetch_history(idx.yahoo_ticker)
    if df is None:
        common.logger.error(f"[{symbol}] fiyat verisi alinamadi — ANALIZ EKSIK.")
        return FAILED

    metrics = common.compute_quant_metrics(df)
    if metrics is None:
        common.logger.error(f"[{symbol}] yetersiz veri (min. bar sayisi karsilanmadi) — ANALIZ EKSIK.")
        return FAILED

    if idx.region == "us":
        breadth = common.compute_sector_breadth(symbol)
        movers = common.compute_top_movers()
    else:
        breadth = {"advancers": None, "decliners": None, "sector_leaders": None}
        # Avrupa: guvenilir ulke bazli hisse evreni yok — compute_sector_breadth
        # ile ayni desen, fabrike veri yok, bos liste.
        movers = {"top_gainers": [], "top_losers": []}

    quant_snapshot = {
        "index_symbol": symbol,
        "index_name": idx.name,
        "session": session,
        "trade_date": trade_date,
        "timezone": idx.timezone,
        **metrics,
        **breadth,
        **movers,
        **macro,
    }

    common.logger.info(f"[{symbol}] quant_snapshot: {quant_snapshot}")

    generation_error = None
    if not common.DEEPSEEK_API_KEY:
        common.logger.warning(f"[{symbol}] DEEPSEEK_API_KEY eksik — narrative uretimi atlanacak.")
        ai_narrative = common.empty_narrative()
        generation_status = "failed"
        generation_error = "DEEPSEEK_API_KEY eksik"
    else:
        try:
            system_prompt, user_prompt = common.build_daily_narrative_prompt(idx.name, quant_snapshot)
            parsed = common.call_deepseek(system_prompt, user_prompt)
            if parsed is None:
                ai_narrative = common.empty_narrative()
                generation_status = "failed"
                generation_error = "DeepSeek cagrisi basarisiz veya gecersiz JSON dondu"
            else:
                ai_narrative, all_ok, any_ok = common.parse_narrative_response(parsed)
                if all_ok:
                    generation_status = "success"
                elif any_ok:
                    generation_status = "partial"
                else:
                    generation_status = "failed"
                    generation_error = "Hicbir locale/alan kalite kontrolunu gecemedi (<40 karakter veya bos)"
        except Exception as exc:
            common.logger.warning(f"[{symbol}] DeepSeek narrative uretimi hata verdi: {exc}")
            ai_narrative = common.empty_narrative()
            generation_status = "failed"
            generation_error = str(exc)[:500]

    common.logger.info(f"[{symbol}] generation_status={generation_status} ai_narrative={ai_narrative}")

    if dry_run:
        common.logger.info(f"[{symbol}] --dry-run: Supabase yazimi atlandi.")
        return SUCCESS

    provenance = common.build_provenance_fields(
        prompt_version=PROMPT_VERSION,
        data_as_of=now_local.astimezone(dt_timezone.utc),
        generation_status=generation_status,
        generation_error=generation_error,
    )

    row = {
        "index_symbol": symbol,
        "trade_date": trade_date,
        "session": session,
        "close": metrics["close"],
        "change_pct": metrics["change_pct"],
        "change_pct_1w": metrics["change_pct_1w"],
        "change_pct_20d": metrics["change_pct_20d"],
        "ema20": metrics["ema20"],
        "ema50": metrics["ema50"],
        "ema200": metrics["ema200"],
        "rsi14": metrics["rsi14"],
        "atr14": metrics["atr14"],
        "volatility_20d": metrics["volatility_20d"],
        "distance_from_20d_high_pct": metrics["distance_from_20d_high_pct"],
        "advancers": breadth["advancers"],
        "decliners": breadth["decliners"],
        "sector_leaders": breadth["sector_leaders"],
        "vix": macro.get("vix"),
        "us10y": macro.get("us10y"),
        "dxy": macro.get("dxy"),
        "volume": metrics["volume"],
        "quant_snapshot": quant_snapshot,
        # Quant veri, AI basarisiz olsa bile deger tasir — bu yuzden generation_status
        # "failed" olsa dahi satir yine de yazilir (ai_narrative=None alanlarla).
        "ai_narrative": ai_narrative if generation_status != "failed" else None,
        **provenance,
    }
    common.supabase_upsert("index_daily_snapshot", row)
    common.logger.info(f"[{symbol}] Supabase upsert basarili (index_daily_snapshot), generation_status={generation_status}.")
    return SUCCESS


def fetch_completed_keys(symbols: list[str]) -> set[tuple[str, str, str]]:
    """--only-missing icin: bugun ZATEN basariyla uretilmis (symbol, trade_date, session)
    anahtarlarini doner.

    trade_date her endeksin KENDI yerel gunu oldugundan (Tokyo ile New York ayni
    anda farkli tarihte olabilir) tarih kumesi sembol bazinda toplanir.
    generation_status != "success" olan satirlar "eksik" sayilir — yani AI
    narrative uretilemeden yazilmis quant satirlari kurtarma koşusunda tekrar
    denenir.
    """
    dates = sorted({
        common.resolve_market_now(common.INDEX_DEFINITIONS[s]).strftime("%Y-%m-%d")
        for s in symbols
    })
    try:
        rows = common.supabase_select(
            "index_daily_snapshot",
            {
                "select": "index_symbol,trade_date,session,generation_status",
                "trade_date": f"in.({','.join(dates)})",
                "index_symbol": f"in.({','.join(symbols)})",
            },
        )
    except Exception as exc:
        # Kontrol edilemiyorsa TAMAMI eksik varsayilir — kurtarma koşusu hicbir
        # sey yapmamaktansa fazladan is yapsin.
        common.logger.warning(f"--only-missing kontrolu yapilamadi ({exc}); tum semboller yeniden uretilecek.")
        return set()

    completed = {
        (r["index_symbol"], str(r["trade_date"]), r["session"])
        for r in rows
        if r.get("generation_status") == "success"
    }
    common.logger.info(f"--only-missing: {len(completed)} endeks/oturum zaten tamam, kalanlar uretilecek.")
    return completed


def main() -> int:
    parser = argparse.ArgumentParser(description="Endeks gunluk quant + AI analiz botu")
    parser.add_argument("--symbols", default=",".join(common.ALL_SYMBOLS), help="Virgul ile ayrilmis endeks sembolleri (varsayilan: tumu)")
    parser.add_argument(
        "--session",
        choices=["premarket", "midday", "closing"],
        default=None,
        help="Manuel override — verilmezse HER endeks kendi timezone/analysis_schedule'ina gore hesaplar",
    )
    parser.add_argument("--dry-run", action="store_true", help="Supabase'e yazma, sadece hesaplananlari yazdir")
    parser.add_argument(
        "--only-missing",
        action="store_true",
        help="Bugun icin zaten basarili (generation_status=success) satiri olan endeksleri atla — "
             "eksik/basarisiz kalanlari tamamlamak icin kullanilir (kurtarma koşusu).",
    )
    args = parser.parse_args()

    missing = common.check_env()
    if missing:
        common.logger.warning(f"Eksik env degiskenleri: {', '.join(missing)}")
        if not args.dry_run and ("NEXT_PUBLIC_SUPABASE_URL" in missing or "SUPABASE_SERVICE_KEY" in missing):
            common.logger.error("Supabase yazim env'leri eksik ve --dry-run verilmedi. Cikiliyor.")
            return 1

    symbols = [s.strip().upper() for s in args.symbols.split(",") if s.strip()]
    invalid = [s for s in symbols if s not in common.INDEX_DEFINITIONS]
    if invalid:
        common.logger.error(f"Gecersiz semboller: {invalid}. Gecerli semboller: {common.ALL_SYMBOLS}")
        return 1

    common.logger.info(f"Baslatiliyor: {len(symbols)} sembol, session_override={args.session}, dry_run={args.dry_run}")

    # Sanity-check icin: her sembolun kendi cozumlenen piyasa konfigurasyonunu yazdir.
    for symbol in symbols:
        idx = common.INDEX_DEFINITIONS[symbol]
        now_local = common.resolve_market_now(idx)
        resolved_session = args.session or common.infer_session_for_index(idx, now_local)
        common.logger.info(
            f"[{symbol}] market_config: tz={idx.timezone} open={idx.market_open} close={idx.market_close} "
            f"yerel_saat={now_local.strftime('%Y-%m-%d %H:%M %Z')} -> session={resolved_session}"
        )

    # Makro seri (VIX/US10Y/DXY) — tum semboller icin ortak, tek seferde cekilir. Best-effort.
    macro = {}
    for key, ticker in common.MACRO_TICKERS.items():
        macro[key] = common.fetch_last_value(ticker)
        if macro[key] is None:
            common.logger.warning(f"Makro seri alinamadi: {key} ({ticker}) — null olarak yazilacak.")

    completed = fetch_completed_keys(symbols) if args.only_missing else None

    success = 0
    skipped = 0
    failed_symbols: list[str] = []
    for symbol in symbols:
        try:
            result = analyze_symbol(symbol, args.session, macro, args.dry_run, completed)
        except Exception as exc:
            common.logger.error(f"[{symbol}] beklenmeyen hata: {exc}", exc_info=True)
            result = FAILED
        if result == SUCCESS:
            success += 1
        elif result == SKIPPED:
            skipped += 1
        else:
            failed_symbols.append(symbol)
        common.sleep_between_calls(1.0)

    common.logger.info(
        f"Tamamlandi: {success} basarili, {skipped} atlandi (sirasi gelmedi/zaten tamam), "
        f"{len(failed_symbols)} basarisiz (toplam {len(symbols)})."
    )

    # Cikis kodu SADECE gercek arizayi bildirir. Onceden "success == 0" ise 1
    # doniyordu; sirasi gelmemis endeksler yuzunden saglikli koşular da kirmizi
    # gorunuyor, tersine kismi kayiplar (1 basarili + 7 basarisiz) yesil
    # gorunuyordu. Artik: analiz saati GELMIS ama uretilememis her endeks hata.
    if failed_symbols:
        common.logger.error(f"EKSIK ANALIZ: {', '.join(failed_symbols)} — bu endeksler icin veri yazilamadi.")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
