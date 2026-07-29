import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface MarketIndexQuote {
  name: string;
  ticker: string;
  price: number;
  changePct: number;
  sparkline: number[];
}

const INDEX_MAP = [
  { name: "S&P 500", ticker: "^GSPC" },
  { name: "DOW", ticker: "^DJI" },
  { name: "NASDAQ", ticker: "^IXIC" },
  { name: "Gold", ticker: "GC=F" },
  { name: "US Oil WTI", ticker: "CL=F" },
  { name: "Russell 2000", ticker: "^RUT" },
  { name: "VIX", ticker: "^VIX" },
];

async function fetchIndexData(name: string, ticker: string): Promise<MarketIndexQuote | null> {
  try {
    // 1 month daily data for sparkline
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=1mo&interval=1d`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        Accept: "application/json",
      },
      next: { revalidate: 300 }, // Cache for 5 minutes
    });

    if (!res.ok) return null;
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) return null;

    const meta = result.meta ?? {};
    const quotes = result.indicators?.quote?.[0]?.close ?? [];
    const closes: number[] = quotes.filter((v: any) => typeof v === "number" && v > 0);

    const price = meta.regularMarketPrice ?? closes.at(-1);
    const prevClose = meta.chartPreviousClose ?? closes.at(-2) ?? price;

    if (typeof price !== "number") return null;

    const changePct = prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0;

    // Take last 15 points for clean sparkline rendering
    const sparkline = closes.slice(-15);

    return {
      name,
      ticker,
      price: Math.round(price * 100) / 100,
      changePct: Math.round(changePct * 100) / 100,
      sparkline,
    };
  } catch (err) {
    console.error(`[markets-api] Error fetching ${ticker}:`, err);
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    const promises = INDEX_MAP.map((idx) => fetchIndexData(idx.name, idx.ticker));
    const results = await Promise.all(promises);
    const validResults = results.filter((r): r is MarketIndexQuote => r !== null);

    return NextResponse.json(validResults);
  } catch (err) {
    console.error("[markets-api] Global error:", err);
    return NextResponse.json({ error: "Failed to load market data" }, { status: 500 });
  }
}
