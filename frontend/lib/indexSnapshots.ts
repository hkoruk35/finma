// Supabase okuma yardimcilari: index_daily_snapshot / index_weekly_snapshot.
// Sema: frontend/supabase/migrations/0026_index_snapshots.sql
// Tek kaynak: frontend/lib/indices.ts (slug/sembol/isim). Bu dosya sadece
// SSR sayfalarinin ihtiyac duydugu Supabase sorgularini saglar.

// Public/anon Supabase client (cookie-free) — bu sayfalar herkese acik SEO
// arsivleri oldugundan createSupabaseServerClient (cookies() bagimli, sayfayi
// zorunlu dynamic yapar) yerine duz anon client kullaniyoruz, ISR/SSG uyumlu.
import { supabase } from "@/lib/supabase";
import type { IndexLocale, IndexSymbol } from "@/lib/indices";

export type IndexSession = "premarket" | "midday" | "closing";

// DeepSeek yalnizca nitel alanlar uretir (bkz. index_analysis_common.py
// NARRATIVE_FIELDS) — rakamlar HER ZAMAN quant_snapshot/kolonlardan gelir,
// AI'nin ürettiği metinde sayi olmaz. Haftalik snapshot'ta ayrica
// prior_week_accuracy alani bulunur (bkz. index_weekly_analyzer.py).
export interface IndexNarrativeFields {
  summary: string;
  market_drivers: string;
  trend_interpretation: string;
  risk_factors: string;
  bullish_scenario: string;
  neutral_scenario: string;
  risk_scenario: string;
  prior_week_accuracy?: string;
}

export interface IndexDailySnapshot {
  id: number;
  index_symbol: IndexSymbol;
  trade_date: string;
  session: IndexSession;
  close: number | null;
  change_pct: number | null;
  change_pct_1w: number | null;
  change_pct_20d: number | null;
  ema20: number | null;
  ema50: number | null;
  ema200: number | null;
  rsi14: number | null;
  atr14: number | null;
  volatility_20d: number | null;
  distance_from_20d_high_pct: number | null;
  advancers: number | null;
  decliners: number | null;
  sector_leaders: unknown | null;
  vix: number | null;
  us10y: number | null;
  dxy: number | null;
  volume: number | null;
  quant_snapshot: Record<string, unknown> | null;
  ai_narrative: Partial<Record<IndexLocale, IndexNarrativeFields>> | null;
  created_at: string;
  updated_at: string;
}

export interface IndexWeeklySnapshot {
  id: number;
  index_symbol: IndexSymbol;
  week_start: string;
  week_label: string;
  close: number | null;
  change_pct_week: number | null;
  sector_rotation: unknown | null;
  trend_strength: string | null;
  volatility_regime: string | null;
  breadth_change: number | null;
  key_levels: unknown | null;
  macro_calendar: unknown | null;
  scenarios: unknown | null;
  prior_week_outlook_accuracy: string | null;
  quant_snapshot: Record<string, unknown> | null;
  ai_narrative: Partial<Record<IndexLocale, IndexNarrativeFields>> | null;
  created_at: string;
  updated_at: string;
}

const SESSION_ORDER: Record<IndexSession, number> = { premarket: 0, midday: 1, closing: 2 };

/**
 * Birden fazla endeks icin, her sembolun EN SON (en yeni created_at) tek kaydi —
 * ana sayfadaki "Son N Analiz" metin akisi icin (bkz. HomeIndexTextFeed.tsx).
 * Tek sorguda en yeni N*guvenlik-payi satiri cekip JS tarafinda sembol basina
 * ilk (en yeni) satiri tutarak tekillestiriyoruz — sembol basina ayri sorgu
 * atmaktan cok daha ucuz, N sembol / gunde ~3 session icin rahat yeterli.
 */
export async function getLatestSnapshotPerSymbol(
  symbols: IndexSymbol[],
  fetchLimit = 300
): Promise<IndexDailySnapshot[]> {
  if (symbols.length === 0) return [];

  const { data } = await supabase
    .from("index_daily_snapshot")
    .select("*")
    .in("index_symbol", symbols)
    .order("created_at", { ascending: false })
    .limit(fetchLimit);

  const seen = new Set<IndexSymbol>();
  const latest: IndexDailySnapshot[] = [];
  for (const row of (data ?? []) as IndexDailySnapshot[]) {
    if (seen.has(row.index_symbol)) continue;
    seen.add(row.index_symbol);
    latest.push(row);
  }
  return latest;
}

/** Bir endeks icin en son (en yeni trade_date) gunluk kayitlar — o gunun tum session'lari. */
export async function getLatestDailySnapshots(symbol: IndexSymbol): Promise<IndexDailySnapshot[]> {
  const { data: latestDateRow } = await supabase
    .from("index_daily_snapshot")
    .select("trade_date")
    .eq("index_symbol", symbol)
    .order("trade_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latestDateRow?.trade_date) return [];

  const { data } = await supabase
    .from("index_daily_snapshot")
    .select("*")
    .eq("index_symbol", symbol)
    .eq("trade_date", latestDateRow.trade_date);

  return ((data ?? []) as IndexDailySnapshot[]).sort(
    (a, b) => SESSION_ORDER[a.session] - SESSION_ORDER[b.session]
  );
}

/** Belirli bir tarih icin bir endeksin tum session kayitlari (premarket/midday/closing). */
export async function getDailySnapshotsForDate(
  symbol: IndexSymbol,
  tradeDate: string
): Promise<IndexDailySnapshot[]> {
  const { data } = await supabase
    .from("index_daily_snapshot")
    .select("*")
    .eq("index_symbol", symbol)
    .eq("trade_date", tradeDate);

  return ((data ?? []) as IndexDailySnapshot[]).sort(
    (a, b) => SESSION_ORDER[a.session] - SESSION_ORDER[b.session]
  );
}

/** Bir endeks icin en son (index_symbol, trade_date desc) benzersiz tarihler, en yeniden eskiye. */
export async function getDailyArchiveDates(symbol: IndexSymbol, limit = 60): Promise<string[]> {
  // Distinct trade_date almak icin gecerli satirlari cekip client tarafinda tekillestiriyoruz;
  // tablo boyutu (endeks basina gunluk en fazla birkac yuz satir) bunu ucuz kilar.
  const { data } = await supabase
    .from("index_daily_snapshot")
    .select("trade_date")
    .eq("index_symbol", symbol)
    .order("trade_date", { ascending: false })
    .limit(limit * 4);

  const dates: string[] = [];
  const seen = new Set<string>();
  for (const row of (data ?? []) as { trade_date: string }[]) {
    if (!seen.has(row.trade_date)) {
      seen.add(row.trade_date);
      dates.push(row.trade_date);
    }
    if (dates.length >= limit) break;
  }
  return dates;
}

/** Bir endeks icin en son haftalik kayit. */
export async function getLatestWeeklySnapshot(symbol: IndexSymbol): Promise<IndexWeeklySnapshot | null> {
  const { data } = await supabase
    .from("index_weekly_snapshot")
    .select("*")
    .eq("index_symbol", symbol)
    .order("week_start", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data as IndexWeeklySnapshot | null) ?? null;
}

/** Belirli bir hafta etiketi (week_label, orn. "2026-w32") icin haftalik kayit. */
export async function getWeeklySnapshotByLabel(
  symbol: IndexSymbol,
  weekLabel: string
): Promise<IndexWeeklySnapshot | null> {
  const { data } = await supabase
    .from("index_weekly_snapshot")
    .select("*")
    .eq("index_symbol", symbol)
    .ilike("week_label", weekLabel)
    .limit(1)
    .maybeSingle();

  return (data as IndexWeeklySnapshot | null) ?? null;
}

/** Bir endeks icin en son N haftalik ozet (en yeniden eskiye), arsiv listesi icin. */
export async function getWeeklyArchiveList(
  symbol: IndexSymbol,
  limit = 26
): Promise<Pick<IndexWeeklySnapshot, "week_start" | "week_label" | "change_pct_week" | "close">[]> {
  const { data } = await supabase
    .from("index_weekly_snapshot")
    .select("week_start, week_label, change_pct_week, close")
    .eq("index_symbol", symbol)
    .order("week_start", { ascending: false })
    .limit(limit);

  return (data ?? []) as Pick<IndexWeeklySnapshot, "week_start" | "week_label" | "change_pct_week" | "close">[];
}

/** ai_narrative jsonb'den locale narrative objesini cikar, yoksa en (Ingilizce) fallback. */
export function resolveNarrative(
  narrative: Partial<Record<IndexLocale, IndexNarrativeFields>> | null | undefined,
  locale: IndexLocale
): IndexNarrativeFields | null {
  if (!narrative) return null;
  return narrative[locale] || narrative.en || null;
}

/** Distinct trade_date listesi tum semboller icin (sitemap generator'i icin). */
export async function getAllDailyTradeDates(): Promise<{ index_symbol: IndexSymbol; trade_date: string }[]> {
  const { data } = await supabase
    .from("index_daily_snapshot")
    .select("index_symbol, trade_date")
    .order("trade_date", { ascending: false })
    .limit(5000);

  const seen = new Set<string>();
  const out: { index_symbol: IndexSymbol; trade_date: string }[] = [];
  for (const row of (data ?? []) as { index_symbol: IndexSymbol; trade_date: string }[]) {
    const key = `${row.index_symbol}|${row.trade_date}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(row);
    }
  }
  return out;
}

/** Distinct week_label listesi tum semboller icin (sitemap generator'i icin). */
export async function getAllWeeklyLabels(): Promise<{ index_symbol: IndexSymbol; week_label: string }[]> {
  const { data } = await supabase
    .from("index_weekly_snapshot")
    .select("index_symbol, week_label")
    .order("week_start", { ascending: false })
    .limit(2000);

  const seen = new Set<string>();
  const out: { index_symbol: IndexSymbol; week_label: string }[] = [];
  for (const row of (data ?? []) as { index_symbol: IndexSymbol; week_label: string }[]) {
    const key = `${row.index_symbol}|${row.week_label}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(row);
    }
  }
  return out;
}
