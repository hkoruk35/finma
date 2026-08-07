import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
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
 * kaynağı. Ticker kimliği artık MASKELENMİYOR — herkes (giriş yapmamış dahil)
 * gerçek ticker/sektör/fiyat/grafik görür. Kısıtlama, kimlik gizlemek yerine
 * satıra TIKLAYIP /graphic sayfasına geçişte uygulanıyor: HomeMoversGrid.tsx
 * anonim ziyaretçi için tıklamayı kayıt sayfasına yönlendiriyor (bkz. o dosya).
 * Bu, 2026-08-03'te kullanıcının açık talebiyle değişti — önceki davranış
 * (LOCKED-N maskeleme, /api/top100 ile paylaşılan kural) artık SADECE
 * /api/top100'de duruyor, bu route'ta yok.
 *
 * Sıralama mantığı lib/homeFeed.ts'teki buildTop100MoverRows/rankTop100Movers'ta
 * yaşıyor — /api/internal/movers-snapshot (günlük arşiv yazıcı) da AYNI
 * fonksiyonları çağırır, ikinci bir kopya yok.
 */
export async function GET(req: NextRequest) {
  const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get("limit")) || 7, 1), 20);

  const supabase = await createSupabaseServerClient();

  const [{ data: tickerRows }, { data: snapshotRows }] = await Promise.all([
    supabase.from("top100_tickers").select("ticker, company, sector").eq("active", true),
    supabase.from("top100_snapshot").select("ticker, price, volume, change_pct"),
  ]);

  const tickers = tickerRows ?? [];

  // MAGNIFICENT_7 buyuk olasilikla top100_tickers'in bir alt kumesi — iki ayri
  // fetchLiveQuotes cagrisi (ikisi de /api/watchlist-data'ya HTTP round-trip
  // atiyor, o da rate-limitli batch'lerle isliyor) yerine TEK cagrida birlesik
  // ticker kumesini cekiyoruz. Bu, sayfa yuklemesindeki en yavas adimi
  // (aninda iki kez calisan pahali batch-fetch) yariya indirir.
  const allTickers = Array.from(new Set([...MAGNIFICENT_7, ...tickers.map((t) => t.ticker)]));
  const live = allTickers.length > 0 ? await fetchLiveQuotes(allTickers) : {};

  const top7: MoverRow[] = MAGNIFICENT_7.map((ticker) => {
    const l = live[ticker];
    return {
      ticker,
      sector: l?.sector && l.sector !== "Unknown" ? l.sector : "Technology",
      price: l?.price?.current ?? 0,
      change_pct: l?.tracker_1h?.change_pct_1d ?? l?.price?.change_pct ?? 0,
      sparkline: l?.recent_closes ?? [],
    };
  });

  if (tickers.length === 0) {
    return NextResponse.json(
      { top7, top100: [], gainers: [], losers: [], mostActive: [] },
      { headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=120" } }
    );
  }

  const rows = buildTop100MoverRows(tickers, snapshotRows ?? [], live);
  const { top100, gainers, losers, mostActive } = rankTop100Movers(rows, limit);

  const strip = (arr: RawMoverRow[]): MoverRow[] =>
    arr.map((r) => ({ ticker: r.ticker, sector: r.sector, price: r.price, change_pct: r.change_pct, sparkline: r.sparkline }));

  return NextResponse.json(
    {
      top7,
      top100: strip(top100),
      gainers: strip(gainers),
      losers: strip(losers),
      mostActive: strip(mostActive),
    },
    { headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=120" } }
  );
}
