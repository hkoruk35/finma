/**
 * /api/quote?tickers=SPY,QQQ,^VIX,GC=F,EURUSD=X
 * Yahoo Finance'dan gerçek zamanlı fiyat ve 1D değişim çeker.
 * Strateji:
 *   - Fiyat: v7 batch (tek istek, hızlı) → başarısız tickers için v8 fallback
 *   - 1D değişim: v8 chart closes[-2..-1] (TradingView ile birebir uyumlu)
 *                 regularMarketChangePercent KULLANILMIYOR — yanlış ref fiyat dönebiliyor
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveYahooSymbol } from "@/lib/symbols";

export const runtime = "nodejs";

type QuoteResult = {
  price: number | null;
  change_1d: number | null;
  change_1w: number | null;
  change_1m: number | null;
  change_1y: number | null;
  /** Last ~20 daily closes for lightweight inline sparklines (mirrors /api/watchlist-data's recent_closes). */
  recent_closes: number[];
};

const YF_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "application/json",
  "Referer": "https://finance.yahoo.com/",
  "Accept-Language": "en-US,en;q=0.9",
};

/** Fiyat için v7 batch — tek istekte tüm semboller. */
async function batchPriceV7(symbols: string[]): Promise<Record<string, number>> {
  const ySymbols = symbols.map(resolveYahooSymbol);
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(ySymbols.join(","))}&fields=regularMarketPrice`;
  const res = await fetch(url, {
    headers: YF_HEADERS,
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`v7 HTTP ${res.status}`);
  const data = await res.json();
  const quotes: any[] = data?.quoteResponse?.result ?? [];
  const out: Record<string, number> = {};
  for (let i = 0; i < quotes.length; i++) {
    const q = quotes[i];
    const origTicker = symbols[i] || q.symbol;
    if (q && q.regularMarketPrice != null) {
      out[origTicker] = +q.regularMarketPrice.toFixed(4);
    }
  }
  return out;
}

/**
 * 1D değişim için v8 chart — closes dizisinin son iki değerinden hesaplar.
 * Bu yöntem TradingView'ın 1D change hesabıyla birebir uyumludur.
 * regularMarketChangePercent kullanılmaz: bazı hisseler için yanlış referans dönüyor.
 */
async function change1dV8(ticker: string): Promise<{ price: number | null; change_1d: number | null; recent_closes: number[] }> {
  const ySymbol = resolveYahooSymbol(ticker);
  // range=1mo (5d'den genişletildi): 1D değişim hesabı son iki kapanışı kullanmaya
  // devam ediyor, ama artık mini-sparkline'lar için ~20 günlük seri de aynı istekten çıkıyor.
  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ySymbol)}?interval=1d&range=1mo&includePrePost=false`;
  try {
    const res = await fetch(url, {
      headers: YF_HEADERS,
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return { price: null, change_1d: null, recent_closes: [] };
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) return { price: null, change_1d: null, recent_closes: [] };

    const meta = result.meta;
    const price: number | null = meta?.regularMarketPrice ?? null;

    // closes dizisinden geçerli (null olmayan) son iki kapanış
    const rawCloses: (number | null)[] = result.indicators?.quote?.[0]?.close ?? [];
    const closes = rawCloses.filter((c): c is number => c != null);

    let change_1d: number | null = null;

    if (closes.length >= 2) {
      const marketState: string = meta?.marketState ?? "CLOSED";
      const isRegularOpen = marketState === "REGULAR";

      if (isRegularOpen && price != null) {
        // Piyasa açık: bugünkü fiyat / dünün kapanışı
        const prevClose = closes[closes.length - 1];
        change_1d = prevClose !== 0 ? +((price - prevClose) / prevClose * 100).toFixed(2) : null;
      } else {
        // Piyasa kapalı: bugünün kapanışı / dünün kapanışı
        const todayClose = closes[closes.length - 1];
        const prevClose = closes[closes.length - 2];
        change_1d = prevClose !== 0 ? +((todayClose - prevClose) / prevClose * 100).toFixed(2) : null;
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

  // 1) Fiyatları v7 batch ile al (hızlı, tek istek)
  let prices: Record<string, number> = {};
  try {
    prices = await batchPriceV7(tickers);
  } catch {
    // v7 başarısız — v8'den fiyat da alacağız
  }

  // 2) 1D değişimi v8'den hesapla (paralel, max 8 eşzamanlı)
  const results: Record<string, QuoteResult> = {};
  const BATCH = 8;

  for (let i = 0; i < tickers.length; i += BATCH) {
    await Promise.all(
      tickers.slice(i, i + BATCH).map(async (ticker) => {
        const { price: v8Price, change_1d, recent_closes } = await change1dV8(ticker);
        const price = prices[ticker] ?? v8Price;
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
