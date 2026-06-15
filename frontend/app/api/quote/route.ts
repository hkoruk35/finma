/**
 * /api/quote?tickers=SPY,QQQ,^VIX,GC=F,EURUSD=X
 * Yahoo Finance'dan gerçek zamanlı fiyat ve 1D değişim çeker.
 * Strateji: v7/batch (tek istek) → eksikler için v8/chart fallback
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type QuoteResult = {
  price: number | null;
  change_1d: number | null;
  change_1w: number | null;
  change_1m: number | null;
  change_1y: number | null;
};

const YF_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "application/json",
  "Referer": "https://finance.yahoo.com/",
  "Accept-Language": "en-US,en;q=0.9",
};

async function batchQuoteV7(symbols: string[]): Promise<Record<string, QuoteResult>> {
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols.join(","))}&fields=regularMarketPrice,regularMarketChangePercent,regularMarketPreviousClose`;
  const res = await fetch(url, {
    headers: YF_HEADERS,
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`v7 HTTP ${res.status}`);
  const data = await res.json();
  const quotes: any[] = data?.quoteResponse?.result ?? [];
  const out: Record<string, QuoteResult> = {};
  for (const q of quotes) {
    if (!q.symbol || q.regularMarketPrice == null) continue;
    out[q.symbol] = {
      price: +q.regularMarketPrice.toFixed(4),
      change_1d: q.regularMarketChangePercent != null
        ? +q.regularMarketChangePercent.toFixed(2)
        : null,
      change_1w: null,
      change_1m: null,
      change_1y: null,
    };
  }
  return out;
}

async function singleQuoteV8(ticker: string): Promise<QuoteResult | null> {
  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=5d&includePrePost=false`;
  const res = await fetch(url, {
    headers: YF_HEADERS,
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const meta = data?.chart?.result?.[0]?.meta;
  if (!meta) return null;
  const price: number | null = meta.regularMarketPrice ?? null;
  const prev: number | null = meta.chartPreviousClose ?? meta.previousClose ?? null;
  const change_1d = price != null && prev != null && prev !== 0
    ? +((price - prev) / prev * 100).toFixed(2)
    : null;
  return { price, change_1d, change_1w: null, change_1m: null, change_1y: null };
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

  // 1) Batch v7 — tek istekte tüm semboller
  try {
    const batch = await batchQuoteV7(tickers);
    Object.assign(results, batch);
  } catch {
    // v7 başarısız olursa devam et, fallback devreye girer
  }

  // 2) Eksik tikkerlar için v8/chart fallback (paralel, max 8)
  const missing = tickers.filter((t) => !results[t]);
  if (missing.length) {
    const BATCH = 8;
    for (let i = 0; i < missing.length; i += BATCH) {
      await Promise.all(
        missing.slice(i, i + BATCH).map(async (ticker) => {
          const r = await singleQuoteV8(ticker).catch(() => null);
          if (r) results[ticker] = r;
        })
      );
    }
  }

  return NextResponse.json(results, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
