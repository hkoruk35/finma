/**
 * Top 100 Tracker kompozisyon + snapshot senkronu — tek merkezi uygulama.
 * /api/internal/top100-sync (bot, gizli anahtarlı HTTP) ve sunucu içi zamanlayıcı
 * (lib/top100Scheduler.ts, HTTP/gizli anahtar yok) AYNI fonksiyonu kullanır.
 */

import { supabaseAdmin } from "@/lib/supabase-admin";
import { computeTop100Snapshot } from "@/lib/top100-engine";
import { getAllTickers } from "@/lib/data";

export type Top100Source = "fixed" | "swing_daily";

export type Top100SyncResult =
  | { ok: true; source: Top100Source; removed: string[]; updated: string[]; failed: string[] }
  | { ok: false; error: string; status: number };

export async function syncTop100Composition(source: Top100Source, rawTickers: string[]): Promise<Top100SyncResult> {
  const tickers = Array.from(new Set(rawTickers.map((t) => t.toUpperCase().trim()).filter(Boolean)));
  if (tickers.length === 0) return { ok: false, error: "tickers[] is empty.", status: 400 };

  const { data: current, error: currentError } = await supabaseAdmin
    .from("top100_tickers")
    .select("ticker")
    .eq("source", source);

  if (currentError) return { ok: false, error: "Could not read current composition.", status: 502 };

  const currentSet = new Set((current ?? []).map((r) => r.ticker));
  const newSet = new Set(tickers);
  const toRemove = [...currentSet].filter((t) => !newSet.has(t));

  if (toRemove.length > 0) {
    const { error: removeError } = await supabaseAdmin.from("top100_tickers").delete().eq("source", source).in("ticker", toRemove);
    if (removeError) return { ok: false, error: "Could not remove stale tickers.", status: 502 };
  }

  const universe = await getAllTickers();
  const sectorByTicker = new Map(universe.map((u) => [u.ticker, u.sector]));

  const results: { ticker: string; ok: boolean }[] = [];

  for (const ticker of tickers) {
    const snapshot = await computeTop100Snapshot(ticker);
    if (!snapshot) {
      results.push({ ticker, ok: false });
      continue;
    }

    const { error: tickerError } = await supabaseAdmin
      .from("top100_tickers")
      .upsert(
        { ticker, company: snapshot.company, sector: sectorByTicker.get(ticker) ?? "Other", source, active: true, added_by: "bot" },
        { onConflict: "ticker" }
      );

    const { error: snapshotError } = await supabaseAdmin.from("top100_snapshot").upsert({
      ticker,
      price: snapshot.price,
      volume: snapshot.volume,
      change_pct: snapshot.change_pct,
      ema20: snapshot.ema20,
      ema50: snapshot.ema50,
      ema200: snapshot.ema200,
      rsi: snapshot.rsi,
      macd: snapshot.macd,
      adx: snapshot.adx,
      pattern: snapshot.pattern,
      signal: snapshot.signal,
      character: snapshot.character,
      updated_at: new Date().toISOString(),
    });

    results.push({ ticker, ok: !tickerError && !snapshotError });
  }

  return {
    ok: true,
    source,
    removed: toRemove,
    updated: results.filter((r) => r.ok).map((r) => r.ticker),
    failed: results.filter((r) => !r.ok).map((r) => r.ticker),
  };
}
