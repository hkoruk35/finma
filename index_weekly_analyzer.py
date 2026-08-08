"""
Endeks Haftalik Analiz Botu — index_weekly_analyzer.py

Cuma kapanisi / Pazartesi acilis-oncesi calismasi hedeflenen, daha hafif bir
haftalik ozet: trend_strength, volatility_regime, key_levels, scenarios ve
5 dilli AI narrative uretip Supabase index_weekly_snapshot tablosuna upsert eder.

Kullanim:
  python index_weekly_analyzer.py --dry-run --symbols=SPX
  python index_weekly_analyzer.py --symbols=SPX,NDX

Ortak quant/DeepSeek yardimcilari index_analysis_common.py'de — kopya kod
onlemek icin index_daily_analyzer.py ile ayni modulu kullanir.

Not: week_start/week_label her endeksin KENDI yerel saatine gore hesaplanir
(bkz. index_analysis_common.py IndexDefinition.timezone) — US ve Avrupa
endeksleri hafta sinirinda (Pazar gecesi/Pazartesi sabahi) farkli takvim
gununde olabilir, bu yuzden tek bir global NY-tarihi kullanilmaz.
"""
from __future__ import annotations

import argparse
import sys
from datetime import datetime, timedelta, timezone as dt_timezone

import index_analysis_common as common

PROMPT_VERSION = "weekly-v1"


def week_start_monday(d: datetime) -> str:
    """Verilen tarihin (o hafta) Pazartesi gununu YYYY-MM-DD olarak dondurur."""
    monday = d - timedelta(days=d.weekday())
    return monday.strftime("%Y-%m-%d")


def week_label(d: datetime) -> str:
    iso = d.isocalendar()
    return f"{iso[0]}-W{iso[1]:02d}"


def compute_trend_strength(ema20: float | None, ema50: float | None) -> str | None:
    """Basit kural: EMA20 vs EMA50 iliskisine gore trend yonu/gucu etiketi."""
    if ema20 is None or ema50 is None or ema50 == 0:
        return None
    diff_pct = (ema20 / ema50 - 1) * 100
    if diff_pct > 2:
        return "strong_bullish"
    if diff_pct > 0.3:
        return "bullish"
    if diff_pct < -2:
        return "strong_bearish"
    if diff_pct < -0.3:
        return "bearish"
    return "neutral"


def compute_volatility_regime(volatility_20d: float | None, history_series) -> str | None:
    """
    volatility_20d'nin kendi trailing gecmisine gore percentile bucket'i.
    Yeterli gecmis yoksa (ilk calismalarda) sabit esik kuralina duser:
    <15 low, 15-30 normal, >30 high (yillik-ize edilmis stdev % olarak).
    """
    if volatility_20d is None:
        return None
    try:
        if history_series is not None and len(history_series) >= 60:
            pct_rank = (history_series < volatility_20d).mean()
            if pct_rank < 0.33:
                return "low"
            if pct_rank < 0.66:
                return "normal"
            return "high"
    except Exception:
        pass
    # Fallback: sabit esik
    if volatility_20d < 15:
        return "low"
    if volatility_20d < 30:
        return "normal"
    return "high"


def build_weekly_narrative_prompt(index_name: str, quant_snapshot: dict, prior_scenarios: dict | None) -> tuple[str, str]:
    system_prompt = (
        "Sen BogaStock platformu icin calisan kidemli bir piyasa endeksi haftalik analiz sistemisin. "
        "Sadece gecerli bir JSON objesi olarak yanit ver, aciklama/markdown/on soz ekleme. "
        "Ilk karakter { son karakter } olmalidir."
    )
    prior_block = ""
    if prior_scenarios:
        prior_block = f"\n\nBir onceki haftanin senaryo tahminleri (dogruluk degerlendirmesi icin referans, sayi icermez):\n{prior_scenarios}"

    user_prompt = f"""Asagida {index_name} endeksine ait bu haftaki quant/teknik ozet bulunuyor (SADECE senin baglam icin,
bu rakamlari metinde TEKRARLAMAYACAKSIN — site bunlari zaten DB'den dogrudan gosteriyor):
{quant_snapshot}
{prior_block}

Su JSON semasini uret (5 dilin {', '.join(common.LOCALES)} HER BIRI icin, asagidaki 7 nitel alan + prior_week_accuracy):
{{
  "en": {{
    "summary": "1-2 sentence qualitative weekly overview",
    "market_drivers": "1-2 sentences on what's driving the week, qualitatively",
    "trend_interpretation": "1-2 sentences on trend structure",
    "risk_factors": "1-2 sentences on key risks to watch",
    "bullish_scenario": "1-2 sentences, qualitative",
    "neutral_scenario": "1-2 sentences, qualitative",
    "risk_scenario": "1-2 sentences, qualitative",
    "prior_week_accuracy": "1-2 sentences on how accurate last week's scenario outlook was, qualitatively (or empty string if no prior data given)"
  }},
  "tr": {{ ... same fields, in Turkish ... }},
  "es": {{ ... }},
  "fr": {{ ... }},
  "pt": {{ ... }}
}}

Ayrica dilden bagimsiz, TEK bir "scenarios" objesi uret (sadece Ingilizce anahtar kelimelerle, 1-2 cumlelik nitel aciklamalarla, RAKAM ICERMEZ):
{{
  "scenarios": {{ "bullish": "...", "neutral": "...", "risk": "..." }}
}}

Bu iki objeyi TEK bir JSON'da birlestir: {{"en": {{...}}, "tr": {{...}}, "es": {{...}}, "fr": {{...}}, "pt": {{...}}, "scenarios": {{"bullish": "...", "neutral": "...", "risk": "..."}}}}

Kurallar: Sadece verilen rakamlara dayan, uydurma haber/katalizor ekleme. {common.NARRATIVE_TONE_RULE} {common.NUMBER_FREE_RULE}"""
    return system_prompt, user_prompt


WEEKLY_NARRATIVE_FIELDS = common.NARRATIVE_FIELDS + ["prior_week_accuracy"]


def parse_weekly_response(parsed: dict | None) -> tuple[dict, dict, dict, bool, bool]:
    """
    Doner: (ai_narrative {locale: {field: str|None}}, accuracy {locale: str|None},
            scenarios {bullish/neutral/risk}, all_ok, any_ok)
    ai_narrative alanlari: common.NARRATIVE_FIELDS (7 nitel alan) — prior_week_accuracy
    ayrica DB'nin ayri text kolonuna gitmek uzere accuracy dict'inde de tutulur.
    """
    ai_narrative: dict = {}
    accuracy: dict = {}
    all_ok = True
    any_ok = False
    for locale in common.LOCALES:
        entry = parsed.get(locale) if parsed and isinstance(parsed, dict) else None
        locale_out: dict = {}
        for field in common.NARRATIVE_FIELDS:
            text = entry.get(field) if isinstance(entry, dict) else None
            if isinstance(text, str) and len(text.strip()) >= 40:
                locale_out[field] = text.strip()
                any_ok = True
            else:
                if text is not None:
                    common.logger.warning(f"Haftalik narrative alan kalite kontrolunden gecemedi (locale={locale}, field={field})")
                locale_out[field] = None
                all_ok = False
        ai_narrative[locale] = locale_out

        acc = entry.get("prior_week_accuracy") if isinstance(entry, dict) else None
        accuracy[locale] = acc.strip() if isinstance(acc, str) and acc.strip() else None

    scenarios_raw = parsed.get("scenarios") if parsed and isinstance(parsed, dict) else None
    scenarios = {
        "bullish": scenarios_raw.get("bullish") if isinstance(scenarios_raw, dict) else None,
        "neutral": scenarios_raw.get("neutral") if isinstance(scenarios_raw, dict) else None,
        "risk": scenarios_raw.get("risk") if isinstance(scenarios_raw, dict) else None,
    }
    return ai_narrative, accuracy, scenarios, all_ok, any_ok


def analyze_symbol_weekly(symbol: str, dry_run: bool) -> bool:
    idx = common.INDEX_DEFINITIONS[symbol]

    # Her endeks KENDI yerel saatinde degerlendirilir (structural fix — bkz. daily bot).
    now_local = common.resolve_market_now(idx)
    week_start = week_start_monday(now_local)
    wk_label = week_label(now_local)

    common.logger.info(
        f"[{symbol}] {idx.name} — haftalik fiyat verisi cekiliyor ({idx.yahoo_ticker}); "
        f"tz={idx.timezone} week_start={week_start} week_label={wk_label}..."
    )

    df = common.fetch_history(idx.yahoo_ticker)
    if df is None:
        common.logger.warning(f"[{symbol}] fiyat verisi alinamadi, atlaniyor.")
        return False

    metrics = common.compute_quant_metrics(df)
    if metrics is None:
        common.logger.warning(f"[{symbol}] yetersiz veri, atlaniyor.")
        return False

    close = df["Close"].astype(float)
    change_pct_week = metrics["change_pct_1w"]  # 5 islem gunu yaklasik 1 hafta

    trend_strength = compute_trend_strength(metrics["ema20"], metrics["ema50"])

    # Volatility regime icin trailing 20g volatilite serisi (percentile bucket denemesi)
    vol_history = None
    try:
        returns = close.pct_change().dropna()
        vol_history = returns.rolling(20).std().dropna() * (252**0.5) * 100
    except Exception:
        vol_history = None
    volatility_regime = compute_volatility_regime(metrics["volatility_20d"], vol_history)

    breadth_change = None
    if idx.region == "us":
        breadth = common.compute_sector_breadth(symbol)
        if breadth.get("advancers") is not None and breadth.get("decliners") is not None:
            breadth_change = breadth["advancers"] - breadth["decliners"]

    high_20d = float(df["High"].astype(float).iloc[-20:].max()) if len(df) >= 20 else None
    low_20d = float(df["Low"].astype(float).iloc[-20:].min()) if len(df) >= 20 else None
    key_levels = {
        "swing_high_20d": round(high_20d, 4) if high_20d else None,
        "swing_low_20d": round(low_20d, 4) if low_20d else None,
        "ema20": metrics["ema20"],
        "ema50": metrics["ema50"],
        "ema200": metrics["ema200"],
    }

    quant_snapshot = {
        "index_symbol": symbol,
        "index_name": idx.name,
        "week_start": week_start,
        "week_label": wk_label,
        "timezone": idx.timezone,
        **metrics,
        "change_pct_week": change_pct_week,
        "trend_strength": trend_strength,
        "volatility_regime": volatility_regime,
        "breadth_change": breadth_change,
        "key_levels": key_levels,
    }

    common.logger.info(f"[{symbol}] weekly quant_snapshot: {quant_snapshot}")

    # Onceki haftanin senaryolarini oku (dogruluk degerlendirmesi icin)
    prior_week_start = (datetime.strptime(week_start, "%Y-%m-%d") - timedelta(days=7)).strftime("%Y-%m-%d")
    prior_scenarios = None
    try:
        rows = common.supabase_select(
            "index_weekly_snapshot",
            {"select": "scenarios", "index_symbol": f"eq.{symbol}", "week_start": f"eq.{prior_week_start}"},
        )
        if rows:
            prior_scenarios = rows[0].get("scenarios")
    except Exception as exc:
        common.logger.warning(f"[{symbol}] onceki hafta okunamadi: {exc}")

    generation_error = None
    if not common.DEEPSEEK_API_KEY:
        common.logger.warning(f"[{symbol}] DEEPSEEK_API_KEY eksik — narrative uretimi atlanacak.")
        ai_narrative = {locale: {field: None for field in WEEKLY_NARRATIVE_FIELDS} for locale in common.LOCALES}
        scenarios = {"bullish": None, "neutral": None, "risk": None}
        prior_week_outlook_accuracy = None
        generation_status = "failed"
        generation_error = "DEEPSEEK_API_KEY eksik"
    else:
        try:
            system_prompt, user_prompt = build_weekly_narrative_prompt(idx.name, quant_snapshot, prior_scenarios)
            parsed = common.call_deepseek(system_prompt, user_prompt, max_tokens=3500)
            if parsed is None:
                ai_narrative = {locale: {field: None for field in WEEKLY_NARRATIVE_FIELDS} for locale in common.LOCALES}
                scenarios = {"bullish": None, "neutral": None, "risk": None}
                prior_week_outlook_accuracy = None
                generation_status = "failed"
                generation_error = "DeepSeek cagrisi basarisiz veya gecersiz JSON dondu"
            else:
                ai_narrative, accuracy, scenarios, all_ok, any_ok = parse_weekly_response(parsed)
                prior_week_outlook_accuracy = accuracy.get("en") or next((v for v in accuracy.values() if v), None)
                if all_ok:
                    generation_status = "success"
                elif any_ok:
                    generation_status = "partial"
                else:
                    generation_status = "failed"
                    generation_error = "Hicbir locale/alan kalite kontrolunu gecemedi (<40 karakter veya bos)"
        except Exception as exc:
            common.logger.warning(f"[{symbol}] DeepSeek haftalik narrative uretimi hata verdi: {exc}")
            ai_narrative = {locale: {field: None for field in WEEKLY_NARRATIVE_FIELDS} for locale in common.LOCALES}
            scenarios = {"bullish": None, "neutral": None, "risk": None}
            prior_week_outlook_accuracy = None
            generation_status = "failed"
            generation_error = str(exc)[:500]

    common.logger.info(f"[{symbol}] generation_status={generation_status} scenarios: {scenarios}")
    common.logger.info(f"[{symbol}] ai_narrative: {ai_narrative}")

    if dry_run:
        common.logger.info(f"[{symbol}] --dry-run: Supabase yazimi atlandi.")
        return True

    provenance = common.build_provenance_fields(
        prompt_version=PROMPT_VERSION,
        data_as_of=now_local.astimezone(dt_timezone.utc),
        generation_status=generation_status,
        generation_error=generation_error,
    )

    row = {
        "index_symbol": symbol,
        "week_start": week_start,
        "week_label": wk_label,
        "close": metrics["close"],
        "change_pct_week": change_pct_week,
        "sector_rotation": None,  # Faz 1: haftalik sektor rotasyonu icin ayri veri kaynagi yok, null birak
        "trend_strength": trend_strength,
        "volatility_regime": volatility_regime,
        "breadth_change": breadth_change,
        "key_levels": key_levels,
        "macro_calendar": None,  # Faz 1: makro takvim entegrasyonu yok, null birak
        "scenarios": scenarios,
        "prior_week_outlook_accuracy": prior_week_outlook_accuracy,
        "quant_snapshot": quant_snapshot,
        # Quant veri, AI basarisiz olsa bile deger tasir — bu yuzden generation_status
        # "failed" olsa dahi satir yine de yazilir (ai_narrative=None).
        "ai_narrative": ai_narrative if generation_status != "failed" else None,
        **provenance,
    }
    common.supabase_upsert("index_weekly_snapshot", row)
    common.logger.info(f"[{symbol}] Supabase upsert basarili (index_weekly_snapshot), generation_status={generation_status}.")
    return True


def main() -> int:
    parser = argparse.ArgumentParser(description="Endeks haftalik quant + AI analiz botu")
    parser.add_argument("--symbols", default=",".join(common.ALL_SYMBOLS), help="Virgul ile ayrilmis endeks sembolleri (varsayilan: tumu)")
    parser.add_argument("--dry-run", action="store_true", help="Supabase'e yazma, sadece hesaplananlari yazdir")
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

    common.logger.info(f"Baslatiliyor: {len(symbols)} sembol, dry_run={args.dry_run} (week_start her sembol icin kendi timezone'unda hesaplanir)")

    success = 0
    failed = 0
    for symbol in symbols:
        try:
            ok = analyze_symbol_weekly(symbol, args.dry_run)
            if ok:
                success += 1
            else:
                failed += 1
        except Exception as exc:
            common.logger.error(f"[{symbol}] beklenmeyen hata: {exc}", exc_info=True)
            failed += 1
        common.sleep_between_calls(1.0)

    common.logger.info(f"Tamamlandi: {success} basarili, {failed} basarisiz (toplam {len(symbols)}).")
    return 0 if success > 0 else 1


if __name__ == "__main__":
    sys.exit(main())
