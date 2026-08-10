/**
 * /api/quote?tickers=SPY,QQQ,^VIX,GC=F,EURUSD=X
 * Yahoo Finance'dan gerçek zamanlı fiyat ve 1D değişim çeker.
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveYahooSymbol } from "@/lib/symbols";
import { formatNumber } from "@/lib/formatNumber";

export const runtime = "nodejs";

type QuoteResult = {
  price: number | null;
  change_1d: number | null;
  change_1w: number | null;
  change_1m: number | null;
  change_1y: number | null;
  recent_closes: number[];
};

const YF_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "application/json",
  "Referer": "https://finance.yahoo.com/",
  "Accept-Language": "en-US,en;q=0.9",
};

async function change1dV8(ticker: string): Promise<{ price: number | null; change_1d: number | null; recent_closes: number[] }> {
  const ySymbol = resolveYahooSymbol(ticker);

  const fetchChart = async (range: string) => {
    try {
      const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ySymbol)}?interval=1d&range=${range}`;
      const res = await fetch(url, {
        headers: YF_HEADERS,
        signal: AbortSignal.timeout(7000),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  };

  try {
    let data = await fetchChart("1mo");
    let result = data?.chart?.result?.[0];
    if (!result) {
      data = await fetchChart("5d");
      result = data?.chart?.result?.[0];
    }
    if (!result) return { price: null, change_1d: null, recent_closes: [] };

    const meta = result.meta;
    const rawCloses: (number | null)[] = result.indicators?.quote?.[0]?.close ?? [];
    const closes = rawCloses.filter((c): c is number => c != null && c > 0);

    const price: number | null = meta?.regularMarketPrice ?? (closes.length > 0 ? closes[closes.length - 1] : null);

    let change_1d: number | null = meta?.regularMarketChangePercent != null ? +((meta.regularMarketChangePercent).toFixed(2)) : null;

    if (closes.length >= 2) {
      const todayClose = closes[closes.length - 1];
      const prevClose = closes[closes.length - 2];
      if (prevClose > 0) {
        change_1d = +((((todayClose - prevClose) / prevClose * 100)).toFixed(2));
      }
    }

    return { price, change_1d, recent_closes: closes.slice(-20) };
  } catch {
    return { price: null, change_1d: null, recent_closes: [] };
  }
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("tickers") || "";
  const tickers = raw
    .split(",")
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 60);

  if (!tickers.length) return NextResponse.json({});

  const results: Record<string, QuoteResult> = {};
  const BATCH = 10;

  for (let i = 0; i < tickers.length; i += BATCH) {
    await Promise.all(
      tickers.slice(i, i + BATCH).map(async (ticker) => {
        const { price, change_1d, recent_closes } = await change1dV8(ticker);
        if (price != null) {
          results[ticker] = { price, change_1d, change_1w: null, change_1m: null, change_1y: null, recent_closes };
        }
      })
    );
  }

  return NextResponse.json(results, {
    headers: { "Cache-Control": "no-store" },
  });
}
