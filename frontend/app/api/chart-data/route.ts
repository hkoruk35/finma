import { NextRequest, NextResponse } from "next/server";
import {
  Bar,
  ema,
  rsi,
  macd,
  bollingerBands,
  vwap,
  pivotSupportResistance,
  resampleBars,
} from "@/lib/indicators";

export const runtime = "nodejs";
export const maxDuration = 15;

// TV-style interval string (used across the app's chart components) ->
// Yahoo Finance `interval`/`range` params. Yahoo has no native 4h bucket,
// so "240" is fetched as 60m and resampled server-side.
const TIMEFRAME_MAP: Record<string, { yInterval: string; yRange: string; resampleTo?: number }> = {
  "1":   { yInterval: "1m",  yRange: "1d" },
  "5":   { yInterval: "5m",  yRange: "5d" },
  "15":  { yInterval: "15m", yRange: "5d" },
  "30":  { yInterval: "30m", yRange: "1mo" },
  "60":  { yInterval: "60m", yRange: "3mo" },
  "240": { yInterval: "60m", yRange: "6mo", resampleTo: 4 * 60 * 60 },
  "D":   { yInterval: "1d",  yRange: "1y" },
  "W":   { yInterval: "1wk", yRange: "5y" },
};

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const ticker = sp.get("ticker") || "";
  const timeframe = sp.get("timeframe"); // TV-style: 15/60/240/D/W — takes priority when present
  const interval = timeframe ? (TIMEFRAME_MAP[timeframe]?.yInterval || "1d") : sp.get("interval") || "1d";
  const range = timeframe ? TIMEFRAME_MAP[timeframe]?.yRange || "6mo" : sp.get("range") || "6mo";
  const resampleTo = timeframe ? TIMEFRAME_MAP[timeframe]?.resampleTo : undefined;
  const indicatorParam = sp.get("indicators"); // csv: ema9,ema20,ema50,ema200,rsi,macd,bb,vwap,sr

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

    const raw = await res.json();
    const chart = raw?.chart?.result?.[0];
    if (!chart) return NextResponse.json({ bars: [] });

    const timestamps = chart.timestamp || [];
    const q = chart.indicators?.quote?.[0] || {};
    const opens = q.open || [];
    const highs = q.high || [];
    const lows = q.low || [];
    const closes = q.close || [];
    const volumes = q.volume || [];

    let bars: Bar[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      if (opens[i] != null && highs[i] != null && lows[i] != null && closes[i] != null) {
        bars.push({
          time: timestamps[i],
          open: opens[i],
          high: highs[i],
          low: lows[i],
          close: closes[i],
          volume: volumes[i] || 0,
        });
      }
    }

    if (resampleTo) bars = resampleBars(bars, resampleTo);

    if (!indicatorParam) {
      return NextResponse.json({ bars }, {
        headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=30" },
      });
    }

    const wanted = new Set(indicatorParam.split(",").map((s) => s.trim()).filter(Boolean));
    const closesArr = bars.map((b) => b.close);
    const indicators: Record<string, unknown> = {};

    if (wanted.has("ema9")) indicators.ema9 = ema(closesArr, 9);
    if (wanted.has("ema20")) indicators.ema20 = ema(closesArr, 20);
    if (wanted.has("ema50")) indicators.ema50 = ema(closesArr, 50);
    if (wanted.has("ema200")) indicators.ema200 = ema(closesArr, 200);
    if (wanted.has("rsi")) indicators.rsi = rsi(closesArr, 14);
    if (wanted.has("macd")) indicators.macd = macd(closesArr);
    if (wanted.has("bb")) indicators.bb = bollingerBands(closesArr);
    if (wanted.has("vwap")) indicators.vwap = vwap(bars);

    const sr = wanted.has("sr") ? pivotSupportResistance(bars) : undefined;

    return NextResponse.json(
      { bars, indicators, sr },
      { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=30" } }
    );
  } catch (e) {
    return NextResponse.json({ error: "fetch failed" }, { status: 500 });
  }
}
