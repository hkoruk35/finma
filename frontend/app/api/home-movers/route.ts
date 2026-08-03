import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getMemberAccess, resolveMemberTierFromAccess } from "@/lib/apiAuth";
import { maskTop100Ticker } from "@/lib/publicTeaserTickers";
import { fetchLiveQuotes, MAGNIFICENT_7, buildTop100MoverRows, rankTop100Movers, type RawMoverRow } from "@/lib/homeFeed";

export const runtime = "nodejs";

interface MoverRow {
  ticker: string;
  sector: string;
  price: number;
  change_pct: number;
  sparkline: number[];
}

/**
 * Yeni ana sayfanın (Top7/Top100/Gainers/Losers/MostActive kartları) tek veri
 * kaynağı. /api/top100 ile AYNI ticker-kimliği maskeleme kuralını kullanır
 * (maskTop100Ticker — bkz. docs/AI_BEHAVIOR.md Rule 3): anonim ziyaretçi
 * sadece PUBLIC_TEASER_TICKERS'ı gerçek görür. Tier çözümü (cookie okuma)
 * burada, per-request bir API route'ta yapılıyor — home/page.tsx (ISR,
 * revalidate=120, tüm ziyaretçiler için paylaşılan cache) BUNU asla
 * doğrudan yapamaz, aksi halde sayfa istemeden dynamic'e döner ya da daha
 * kötüsü bir ziyaretçinin tier'ıyla render edilmiş HTML başka bir
 * ziyaretçiye servis edilir.
 *
 * Sıralama mantığı lib/homeFeed.ts'teki buildTop100MoverRows/rankTop100Movers'ta
 * yaşıyor — /api/internal/movers-snapshot (günlük arşiv yazıcı) da AYNI
 * fonksiyonları çağırır, ikinci bir kopya yok.
 */
export async function GET(req: NextRequest) {
  const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get("limit")) || 7, 1), 20);

  const supabase = await createSupabaseServerClient();
  const access = await getMemberAccess();
  const tier = resolveMemberTierFromAccess(access);

  const [{ data: tickerRows }, { data: snapshotRows }, top7Live] = await Promise.all([
    supabase.from("top100_tickers").select("ticker, company, sector").eq("active", true),
    supabase.from("top100_snapshot").select("ticker, price, volume, change_pct"),
    fetchLiveQuotes(MAGNIFICENT_7),
  ]);

  // Top 7 sabit/herkese açık (Magnificent 7) — hiçbir zaman maskelenmez.
  const top7: MoverRow[] = MAGNIFICENT_7.map((ticker) => {
    const l = top7Live[ticker];
    return {
      ticker,
      sector: l?.sector && l.sector !== "Unknown" ? l.sector : "Technology",
      price: l?.price?.current ?? 0,
      change_pct: l?.tracker_1h?.change_pct_1d ?? l?.price?.change_pct ?? 0,
      sparkline: l?.recent_closes ?? [],
    };
  });

  const tickers = tickerRows ?? [];
  if (tickers.length === 0) {
    return NextResponse.json(
      { top7, top100: [], gainers: [], losers: [], mostActive: [] },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  const live = await fetchLiveQuotes(tickers.map((t) => t.ticker));
  const rows = buildTop100MoverRows(tickers, snapshotRows ?? [], live);
  const { top100, gainers, losers, mostActive } = rankTop100Movers(rows, limit);

  const maskAndStrip = (arr: RawMoverRow[]): MoverRow[] =>
    arr.map((r, idx) => {
      const masked = maskTop100Ticker({ ticker: r.ticker, company: r.company }, idx, tier);
      return { ticker: masked.ticker, sector: r.sector, price: r.price, change_pct: r.change_pct, sparkline: r.sparkline };
    });

  return NextResponse.json(
    {
      top7,
      top100: maskAndStrip(top100),
      gainers: maskAndStrip(gainers),
      losers: maskAndStrip(losers),
      mostActive: maskAndStrip(mostActive),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
