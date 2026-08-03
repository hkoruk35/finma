import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { fetchLiveQuotes, buildTop100MoverRows, rankTop100Movers, type RawMoverRow } from "@/lib/homeFeed";

export const runtime = "nodejs";

const SNAPSHOT_LIMIT = 20;

function requireBotSecret(req: NextRequest): boolean {
  // Mevcut bot-pipeline kimlik doğrulaması (/api/internal/top100-sync ile aynı desen).
  const secret = req.headers.get("x-revalidate-secret");
  return !!secret && secret === process.env.REVALIDATE_SECRET;
}

function todayNY(): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/**
 * Gainers/losers/most-active/top100 için günlük arşiv anlık görüntüsü.
 * /api/home-movers ile AYNI türetme fonksiyonlarını kullanır
 * (buildTop100MoverRows/rankTop100Movers, lib/homeFeed.ts) — ikinci bir
 * sıralama kopyası yok (bkz. docs/AI_BEHAVIOR.md Rule 3). Maskesiz (ham)
 * veri yazar; okuma tarafında (ileride eklenecek arşiv sayfası) aynı
 * maskTop100Ticker kuralı ayrıca uygulanmalı — bu yazma katmanının işi değil.
 *
 * .github/workflows/movers-snapshot.yml tarafından günde bir kez,
 * /api/internal/top100-sync ile AYNI REVALIDATE_SECRET ile çağrılır.
 */
export async function POST(req: NextRequest) {
  if (!requireBotSecret(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: tickerRows, error: tickersError } = await supabaseAdmin
    .from("top100_tickers")
    .select("ticker, company, sector")
    .eq("active", true);
  if (tickersError) return NextResponse.json({ error: "Could not read top100_tickers." }, { status: 502 });

  const tickers = tickerRows ?? [];
  if (tickers.length === 0) {
    return NextResponse.json({ ok: true, written: 0, note: "No active top100 tickers." });
  }

  const { data: snapshotRows, error: snapshotError } = await supabaseAdmin
    .from("top100_snapshot")
    .select("ticker, price, volume, change_pct");
  if (snapshotError) return NextResponse.json({ error: "Could not read top100_snapshot." }, { status: 502 });

  const live = await fetchLiveQuotes(tickers.map((t) => t.ticker));
  const rows = buildTop100MoverRows(tickers, snapshotRows ?? [], live);
  const { top100, gainers, losers, mostActive } = rankTop100Movers(rows, SNAPSHOT_LIMIT);

  const snapshotDate = todayNY();
  const toInsertRows = (category: "top100" | "gainers" | "losers" | "mostActive", arr: RawMoverRow[]) =>
    arr.map((r, i) => ({
      snapshot_date: snapshotDate,
      category,
      rank: i + 1,
      ticker: r.ticker,
      sector: r.sector,
      price: r.price,
      change_pct: r.change_pct,
      volume: r.volume,
    }));

  const allRows = [
    ...toInsertRows("top100", top100),
    ...toInsertRows("gainers", gainers),
    ...toInsertRows("losers", losers),
    ...toInsertRows("mostActive", mostActive),
  ];

  const { error: upsertError } = await supabaseAdmin
    .from("movers_daily_snapshot")
    .upsert(allRows, { onConflict: "snapshot_date,category,rank" });

  if (upsertError) {
    return NextResponse.json({ error: "Could not write snapshot.", detail: upsertError.message }, { status: 502 });
  }

  return NextResponse.json({ ok: true, date: snapshotDate, written: allRows.length });
}
