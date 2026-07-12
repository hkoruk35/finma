import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const YF_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
  Accept: "application/json",
};

// Ticker/sirket adi autocomplete'i icin Yahoo Finance'in kendi arama API'sini
// kullanir (watchlist-data/route.ts'deki ayni Yahoo entegrasyonu) — statik,
// dar bir yerel listeye (all_tickers_list.json sadece BOGA'nin puanladigi
// birkac yuz ticker'i icerir) bagli kalmadan ABD borsalarindaki (NYSE/NASDAQ)
// her hisseyi/ETF'i aninda bulur. Sembolde nokta olan yabanci borsa
// kayitlari (orn. AAPL.BA, AAPL.SW) elenir.
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  if (q.length === 0) return NextResponse.json({ results: [] });

  try {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=15&newsCount=0`;
    const res = await fetch(url, { headers: YF_HEADERS, signal: AbortSignal.timeout(6000) });
    if (!res.ok) return NextResponse.json({ results: [] });

    const data = await res.json();
    const quotes: any[] = data?.quotes ?? [];

    const results = quotes
      .filter(
        (quote) =>
          (quote.quoteType === "EQUITY" || quote.quoteType === "ETF") &&
          typeof quote.symbol === "string" &&
          !quote.symbol.includes(".")
      )
      .slice(0, 10)
      .map((quote) => ({
        ticker: String(quote.symbol).toUpperCase(),
        company: quote.longname || quote.shortname || quote.symbol,
      }));

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
