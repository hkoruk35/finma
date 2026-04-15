/**
 * /api/quote?tickers=GSAT,SGI,BBIO
 * Yahoo Finance'dan 1D/1W/1M/1Y değişim yüzdelerini çeker.
 * Swing picks gibi ana scanner'da olmayan hisseler için kullanılır.
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("tickers") || "";
  const tickers = raw
    .split(",")
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 10);

  if (tickers.length === 0) {
    return NextResponse.json({});
  }

  const results: Record<string, { change_1d: number | null; change_1w: number | null; change_1m: number | null; change_1y: number | null }> = {};

  await Promise.all(
    tickers.map(async (ticker) => {
      try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1y&includePrePost=false`;
        const res = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "application/json",
          },
          signal: AbortSignal.timeout(6000),
        });
        if (!res.ok) return;
        const data = await res.json();
        const chart = data?.chart?.result?.[0];
        if (!chart) return;

        const closes: number[] = (chart.indicators?.quote?.[0]?.close || []).filter(
          (v: any) => v != null && typeof v === "number"
        );
        if (closes.length < 2) return;

        const current = chart.meta?.regularMarketPrice ?? closes[closes.length - 1];
        const prev1d  = closes[closes.length - 2];
        const prev1w  = closes.length >= 6  ? closes[closes.length - 6]  : closes[0];
        const prev1m  = closes.length >= 22 ? closes[closes.length - 22] : closes[0];
        const prev1y  = closes[0];

        const pct = (base: number) => base ? +((current - base) / base * 100).toFixed(2) : null;

        results[ticker] = {
          change_1d: pct(prev1d),
          change_1w: pct(prev1w),
          change_1m: pct(prev1m),
          change_1y: pct(prev1y),
        };
      } catch {
        // Timeout veya hata — sonuç döndürme
      }
    })
  );

  return NextResponse.json(results, {
    headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=60" },
  });
}
