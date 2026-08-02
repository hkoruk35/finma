import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getMemberAccess, resolveMemberTierFromAccess } from "@/lib/apiAuth";
import { maskTop100Ticker } from "@/lib/publicTeaserTickers";
import { fetchLiveQuotes, MAGNIFICENT_7 } from "@/lib/homeFeed";

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

  const snapshotByTicker = new Map((snapshotRows ?? []).map((s) => [s.ticker, s]));
  const live = await fetchLiveQuotes(tickers.map((t) => t.ticker));

  const rows = tickers
    .map((t, idx) => {
      const l = live[t.ticker];
      const s = snapshotByTicker.get(t.ticker);
      const masked = maskTop100Ticker({ ticker: t.ticker, company: t.company }, idx, tier);
      const preciseChange: number | undefined = l?.tracker_1h?.change_pct_1d;
      return {
        ticker: masked.ticker,
        sector: (l?.sector && l.sector !== "Unknown" ? l.sector : t.sector) || "—",
        price: l?.price?.current ?? s?.price ?? 0,
        change_pct: preciseChange ?? s?.change_pct ?? 0,
        preciseChange,
        volume: l?.price?.volume ?? s?.volume ?? 0,
        sparkline: l?.recent_closes ?? [],
      };
    })
    .filter((r) => r.price > 0);

  const top100 = [...rows].sort((a, b) => b.volume - a.volume).slice(0, limit);

  // Gainers/losers sadece gerçek tracker_1h verisi olan satırlardan türetilir
  // (GlobalLandingPage.tsx'in client-side eşdeğeriyle aynı filtre) — aksi
  // halde canlı veri eksik satırlar 0% olarak sıralamaya sızar.
  const byGainDesc = rows
    .filter((r) => r.preciseChange != null)
    .sort((a, b) => (b.preciseChange as number) - (a.preciseChange as number));
  const gainers = byGainDesc.slice(0, limit);
  const losers = byGainDesc.slice(-limit).reverse();
  const mostActive = [...rows].sort((a, b) => b.volume - a.volume).slice(0, limit);

  const strip = (arr: typeof rows): MoverRow[] =>
    arr.map(({ ticker, sector, price, change_pct, sparkline }) => ({ ticker, sector, price, change_pct, sparkline }));

  return NextResponse.json(
    {
      top7,
      top100: strip(top100),
      gainers: strip(gainers),
      losers: strip(losers),
      mostActive: strip(mostActive),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
