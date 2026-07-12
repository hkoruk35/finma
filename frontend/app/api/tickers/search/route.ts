import { NextRequest, NextResponse } from "next/server";
import { getAllTickers } from "@/lib/data";

export const runtime = "nodejs";

// Ticker/sirket adi autocomplete'i icin hafif, herkese acik arama endpoint'i —
// zaten yuklu olan statik all_tickers_list.json'u filtreler, canli veri
// cekmez (sadece ticker + company doner, hizli olmasi gerekiyor).
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") || "").trim().toUpperCase();
  if (q.length === 0) return NextResponse.json({ results: [] });

  const all = await getAllTickers();
  const results = all
    .filter((t) => t.ticker.toUpperCase().startsWith(q) || (t.company ?? "").toUpperCase().includes(q))
    .sort((a, b) => {
      const aStarts = a.ticker.toUpperCase().startsWith(q) ? 0 : 1;
      const bStarts = b.ticker.toUpperCase().startsWith(q) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      return a.ticker.localeCompare(b.ticker);
    })
    .slice(0, 10)
    .map((t) => ({ ticker: t.ticker, company: t.company }));

  return NextResponse.json({ results });
}
