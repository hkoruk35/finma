import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { computeTop100Snapshot } from "@/lib/top100-engine";
import { getAllTickers } from "@/lib/data";

/**
 * Bot pipeline -> canli site internal sync.
 * Kompozisyon kaynaklari (Faz 6):
 *  - source='fixed'      <- /tracker'daki admin listesinden hacme gore Top 90 (haftalik, Cuma 23:59 NY)
 *  - source='swing_daily' <- /swing'in en guncel Top 10'u (gunluk, 14:00 NY)
 * Ayni endpoint, kompozisyon degismeden tekrar cagrildiginda (hourly job) snapshot'lari da tazeler —
 * tek merkezi hesaplama (computeTop100Snapshot), paralel mekanizma yok.
 */

function requireBotSecret(req: NextRequest): boolean {
  // Mevcut bot-pipeline kimlik dogrulamasi (swing117_boga.py -> /api/revalidate-swing ile ayni desen)
  const secret = req.headers.get("x-revalidate-secret");
  return !!secret && secret === process.env.REVALIDATE_SECRET;
}

export async function POST(req: NextRequest) {
  if (!requireBotSecret(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { tickers?: string[]; source?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const source = body.source === "swing_daily" ? "swing_daily" : body.source === "fixed" ? "fixed" : null;
  const tickers = (body.tickers ?? []).map((t) => t.toUpperCase().trim()).filter(Boolean);
  if (!source || tickers.length === 0) {
    return NextResponse.json({ error: "source ('fixed'|'swing_daily') and a non-empty tickers[] are required." }, { status: 400 });
  }

  const { data: current, error: currentError } = await supabaseAdmin
    .from("top100_tickers")
    .select("ticker")
    .eq("source", source);

  if (currentError) return NextResponse.json({ error: "Could not read current composition." }, { status: 502 });

  const currentSet = new Set((current ?? []).map((r) => r.ticker));
  const newSet = new Set(tickers);
  const toRemove = [...currentSet].filter((t) => !newSet.has(t));

  if (toRemove.length > 0) {
    const { error: removeError } = await supabaseAdmin.from("top100_tickers").delete().eq("source", source).in("ticker", toRemove);
    if (removeError) return NextResponse.json({ error: "Could not remove stale tickers." }, { status: 502 });
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

  return NextResponse.json({
    ok: true,
    source,
    removed: toRemove,
    updated: results.filter((r) => r.ok).map((r) => r.ticker),
    failed: results.filter((r) => !r.ok).map((r) => r.ticker),
  });
}
