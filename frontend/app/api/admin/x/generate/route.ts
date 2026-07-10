import { NextRequest, NextResponse } from "next/server";
import { generateLocalizedTexts, LOCALES, type Locale } from "@/lib/x/generateContent";
import { fetchTickerMarketData, trendLabel } from "@/lib/x/marketData";
import { buildStockHashtags, buildPromoHashtags } from "@/lib/x/hashtags";

export const runtime = "nodejs";
export const maxDuration = 60;

function requireAdmin(req: NextRequest): boolean {
  return req.cookies.get("boga_auth")?.value === "admin";
}

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));

  try {
    if (body.contentType === "promo") {
      const texts = await generateLocalizedTexts({ contentType: "promo" });
      return NextResponse.json({ texts, hashtags: buildPromoHashtags() });
    }

    const market = await fetchTickerMarketData(body.ticker);

    const texts = await generateLocalizedTexts({
      contentType: "stock",
      ticker: body.ticker,
      company: body.company,
      sector: body.sector,
      theme: body.theme,
      signal: market?.signal,
      trend: market?.trend,
    });

    return NextResponse.json({
      texts,
      hashtags: buildStockHashtags(body.ticker, body.sector),
      market: market
        ? {
            points: market.points,
            changePct: market.changePct,
            ema50: market.ema50,
            trendLabels: Object.fromEntries(LOCALES.map((l) => [l, trendLabel(market.trend, l)])),
          }
        : null,
    });
  } catch (e: any) {
    console.error("[x/generate]", e?.message);
    return NextResponse.json({ error: e?.message || "generation failed" }, { status: 500 });
  }
}
