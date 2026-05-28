import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 15;

export async function GET(req: NextRequest) {
  const sp       = req.nextUrl.searchParams;
  const ticker   = sp.get("ticker") || "";
  const interval = sp.get("interval") || "1d";
  const range    = sp.get("range")    || "6mo";

  if (!ticker) return NextResponse.json({ error: "ticker required" }, { status: 400 });

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=${interval}&range=${range}&includePrePost=false`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return NextResponse.json({ error: "upstream error" }, { status: 502 });

    const raw   = await res.json();
    const chart = raw?.chart?.result?.[0];
    if (!chart)  return NextResponse.json({ bars: [] });

    const timestamps = chart.timestamp  || [];
    const q          = chart.indicators?.quote?.[0] || {};
    const opens      = q.open   || [];
    const highs      = q.high   || [];
    const lows       = q.low    || [];
    const closes     = q.close  || [];
    const volumes    = q.volume || [];

    const bars = [];
    for (let i = 0; i < timestamps.length; i++) {
      if (opens[i] != null && highs[i] != null && lows[i] != null && closes[i] != null) {
        bars.push({
          time:   timestamps[i],
          open:   opens[i],
          high:   highs[i],
          low:    lows[i],
          close:  closes[i],
          volume: volumes[i] || 0,
        });
      }
    }

    return NextResponse.json({ bars }, {
      headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=30" },
    });
  } catch (e) {
    return NextResponse.json({ error: "fetch failed" }, { status: 500 });
  }
}
