"""
Endeks Narrative Backfill — index_narrative_backfill.py

index_daily_snapshot'ta quant verisi SAGLAM ama AI narrative'i uretilememis
satirlari bulur ve SADECE narrative'i yeniden uretir.

Neden ayri bir komut:
  index_daily_analyzer.py fiyati borsadan YENIDEN ceker. Gecmis bir oturumu
  (orn. "midday") saatler sonra yeniden calistirmak, 13:00'te olusmus dogru
  bir satirin uzerine kapanis sonrasi fiyatlari yazar — kaydi duzeltmek yerine
  bozar. Bu komut fiyata hic dokunmaz: satirda zaten saklanan quant_snapshot'i
  girdi olarak kullanir ve yalnizca narrative + saglayici alanlarini PATCH'ler.

Neyi ASLA degistirmez:
  close, change_pct*, ema*, rsi14, atr14, volatility_20d, volume, advancers,
  decliners, sector_leaders, vix, us10y, dxy, quant_snapshot, trade_date,
  session, data_as_of  (data_as_of fiyatin cekildigi ani gosterir; narrative
  yeniden uretildi diye degismemeli).

Kullanim:
  python index_narrative_backfill.py --dry-run              # son 7 gun, ne yapilacagini yazdir
  python index_narrative_backfill.py                        # son 7 gun, uret ve yaz
  python index_narrative_backfill.py --days 30
  python index_narrative_backfill.py --date 2026-08-10 --symbols=RUT
  python index_narrative_backfill.py --days 90 --limit 20   # DeepSeek maliyetini sinirla

Kapsam: SADECE index_daily_snapshot. index_weekly_snapshot dahil DEGIL —
haftalik satirlarin narrative disinda `scenarios` ve
`prior_week_outlook_accuracy` ciktilari da var ve bunlar bir onceki haftanin
satirina bagli; ayri bir ayristirma yolu gerektirir.
"""
from __future__ import annotations

import argparse
import sys
from datetime import datetime, timedelta, timezone as dt_timezone

import index_analysis_common as common

# index_daily_analyzer.py ile AYNI olmali — ayni prompt'la uretiliyor.
PROMPT_VERSION = "daily-v1"

TABLE = "index_daily_snapshot"


def find_incomplete_rows(
    symbols: list[str],
    date_from: str,
    date_to: str,
    limit: int | None,
) -> list[dict]:
    """generation_status != 'success' olan gunluk satirlari doner (en yeniden eskiye)."""
    params = {
        "select": "index_symbol,trade_date,session,generation_status,generation_error,quant_snapshot",
        "trade_date": f"gte.{date_from}",
        "generation_status": "neq.success",
        "order": "trade_date.desc,index_symbol.asc",
        "and": f"(trade_date.lte.{date_to})",
    }
    if symbols:
        params["index_symbol"] = f"in.({','.join(symbols)})"
    if limit:
        params["limit"] = str(limit)
    return common.supabase_select(TABLE, params)


def regenerate_one(row: dict, dry_run: bool) -> str:
    """Tek satirin narrative'ini yeniden uretir. Doner: 'fixed' | 'partial' | 'skipped' | 'failed'."""
    symbol = row["index_symbol"]
    trade_date = str(row["trade_date"])
    session = row["session"]
    tag = f"[{symbol} {trade_date}/{session}]"

    idx = common.INDEX_DEFINITIONS.get(symbol)
    if idx is None:
        common.logger.warning(f"{tag} INDEX_DEFINITIONS'ta yok — atlaniyor.")
        return "skipped"

    snapshot = row.get("quant_snapshot")
    if not isinstance(snapshot, dict) or not snapshot:
        # Quant da yoksa uretecek girdi yok; bu satir ancak o gunun analizi
        # yeniden kosarak duzelir, burada uydurma yapilmaz.
        common.logger.warning(f"{tag} quant_snapshot bos — narrative uretilemez, atlaniyor.")
        return "skipped"

    prev_error = (row.get("generation_error") or "").strip()
    common.logger.info(f"{tag} yeniden uretiliyor (onceki hata: {prev_error[:120] or 'yok'})")

    if dry_run:
        common.logger.info(f"{tag} --dry-run: DeepSeek cagrilmadi, Supabase yazilmadi.")
        return "fixed"

    system_prompt, user_prompt = common.build_daily_narrative_prompt(idx.name, snapshot)
    parsed = common.call_deepseek(system_prompt, user_prompt)
    if parsed is None:
        common.logger.error(f"{tag} DeepSeek yine basarisiz — satir DEGISMEDI.")
        return "failed"

    ai_narrative, all_ok, any_ok = common.parse_narrative_response(parsed)
    if not any_ok:
        common.logger.error(f"{tag} uretilen icerik kalite kontrolunu gecemedi — satir DEGISMEDI.")
        return "failed"

    generation_status = "success" if all_ok else "partial"

    # SADECE narrative + saglayici alanlari. data_as_of bilerek YOK: o alan
    # fiyatin cekildigi ani gosterir ve bu komut fiyata dokunmaz.
    payload = {
        "ai_narrative": ai_narrative,
        "generation_status": generation_status,
        "generation_error": None,
        "content_status": "published",
        "model_provider": common.MODEL_PROVIDER,
        "model_name": common.MODEL_NAME,
        "prompt_version": PROMPT_VERSION,
        "analysis_version": common.ANALYSIS_VERSION,
        "published_at": datetime.now(dt_timezone.utc).isoformat(),
    }
    common.supabase_patch(
        TABLE,
        {
            "index_symbol": f"eq.{symbol}",
            "trade_date": f"eq.{trade_date}",
            "session": f"eq.{session}",
        },
        payload,
    )
    common.logger.info(f"{tag} DUZELTILDI (generation_status={generation_status}).")
    return "fixed" if all_ok else "partial"


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Quant verisi saglam ama AI narrative'i eksik endeks satirlarini onarir (fiyata dokunmaz)."
    )
    parser.add_argument("--symbols", default="", help="Virgul ile ayrilmis endeksler (varsayilan: tumu)")
    parser.add_argument("--days", type=int, default=7, help="Kac gun geriye bakilacak (varsayilan: 7)")
    parser.add_argument("--date", default=None, help="Tek bir gun (YYYY-MM-DD) — --days'i ezer")
    parser.add_argument("--limit", type=int, default=None, help="En fazla kac satir onarilsin (DeepSeek maliyet siniri)")
    parser.add_argument("--dry-run", action="store_true", help="Sadece hangi satirlarin onarilacagini yazdir")
    args = parser.parse_args()

    missing = common.check_env()
    if missing:
        common.logger.warning(f"Eksik env degiskenleri: {', '.join(missing)}")
        if not args.dry_run and ("NEXT_PUBLIC_SUPABASE_URL" in missing or "SUPABASE_SERVICE_KEY" in missing):
            common.logger.error("Supabase env'leri eksik ve --dry-run verilmedi. Cikiliyor.")
            return 1
        if not args.dry_run and "DEEPSEEK_API_KEY" in missing:
            common.logger.error("DEEPSEEK_API_KEY eksik — narrative uretilemez. Cikiliyor.")
            return 1

    symbols = [s.strip().upper() for s in args.symbols.split(",") if s.strip()]
    invalid = [s for s in symbols if s not in common.INDEX_DEFINITIONS]
    if invalid:
        common.logger.error(f"Gecersiz semboller: {invalid}. Gecerli semboller: {common.ALL_SYMBOLS}")
        return 1

    if args.date:
        date_from = date_to = args.date
    else:
        today = datetime.now(dt_timezone.utc).date()
        date_from = (today - timedelta(days=args.days)).strftime("%Y-%m-%d")
        # Asya/Avustralya endeksleri kendi yerel gunlerinde "yarin"a gecebilir.
        date_to = (today + timedelta(days=1)).strftime("%Y-%m-%d")

    common.logger.info(
        f"Backfill araligi: {date_from} .. {date_to} | "
        f"semboller: {', '.join(symbols) if symbols else 'TUMU'} | dry_run={args.dry_run}"
    )

    try:
        rows = find_incomplete_rows(symbols, date_from, date_to, args.limit)
    except Exception as exc:
        common.logger.error(f"Supabase sorgusu basarisiz: {exc}")
        return 1

    if not rows:
        common.logger.info("Onarilacak satir yok — bu aralikta tum narrative'ler tamam.")
        return 0

    common.logger.info(f"{len(rows)} eksik satir bulundu.")

    fixed = partial = skipped = 0
    failed_rows: list[str] = []
    for row in rows:
        label = f"{row['index_symbol']} {row['trade_date']}/{row['session']}"
        try:
            result = regenerate_one(row, args.dry_run)
        except Exception as exc:
            common.logger.error(f"[{label}] beklenmeyen hata: {exc}", exc_info=True)
            result = "failed"
        if result == "fixed":
            fixed += 1
        elif result == "partial":
            partial += 1
        elif result == "skipped":
            skipped += 1
        else:
            failed_rows.append(label)
        if not args.dry_run:
            common.sleep_between_calls(1.0)

    common.logger.info(
        f"Tamamlandi: {fixed} duzeltildi, {partial} kismi, {skipped} atlandi, "
        f"{len(failed_rows)} basarisiz (toplam {len(rows)})."
    )
    if failed_rows:
        common.logger.error(f"HALA EKSIK: {', '.join(failed_rows)}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
