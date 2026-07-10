import { NextRequest, NextResponse } from "next/server";
import { renderCardPng } from "@/lib/x/renderTemplate";
import { fetchTickerMarketData, trendLabel, opportunityLabel } from "@/lib/x/marketData";

export const runtime = "nodejs";
export const revalidate = 1800;

async function fetchCompanyInfo(ticker: string): Promise<{ company?: string; sector?: string }> {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://bogastock.com";
  try {
    const res = await fetch(`${base}/api/watchlist-data?tickers=${encodeURIComponent(ticker)}`, {
      cache: "no-store",
    });
    if (!res.ok) return {};
    const arr = await res.json();
    const item = Array.isArray(arr) ? arr[0] : null;
    return { company: item?.company, sector: item?.sector };
  } catch {
    return {};
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;
  const tickerUpper = ticker.toUpperCase();

  const [market, info] = await Promise.all([
    fetchTickerMarketData(tickerUpper),
    fetchCompanyInfo(tickerUpper),
  ]);

  try {
    const png = await renderCardPng({
      kind: "stock",
      ticker: tickerUpper,
      company: info.company,
      sector: info.sector,
      changePct: market?.changePct,
      rvol: market?.rvol,
      opportunity: market?.opportunity,
      opportunityLabel: market ? opportunityLabel("en") : undefined,
      trendLabel: market ? trendLabel(market.trend, "en") : undefined,
      bars: market?.bars ?? [],
      headline: "Live chart & technical analysis on Boga AI",
      locale: "en",
    });

    return new NextResponse(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=1800, s-maxage=1800",
      },
    });
  } catch (e) {
    console.error("[og/ticker] render failed:", (e as Error).message);
    return new Response("Failed to generate image", { status: 500 });
  }
}
