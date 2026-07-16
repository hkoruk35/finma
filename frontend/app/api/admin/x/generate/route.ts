import { NextRequest, NextResponse } from "next/server";
import { generateLocalizedTexts, LOCALES, type Locale } from "@/lib/x/generateContent";
import { fetchTickerMarketData, trendLabel, opportunityLabel } from "@/lib/x/marketData";
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

    if (body.contentType === "translate" && body.manualBaseText) {
      const texts = await generateLocalizedTexts({
        contentType: "translate",
        manualBaseText: body.manualBaseText,
      });
      // If a ticker was provided, return stock hashtags, otherwise standard promo hashtags.
      const hashtags = body.ticker ? buildStockHashtags(body.ticker, undefined, undefined) : buildPromoHashtags();
      
      let market = null;
      if (body.ticker) {
        market = await fetchTickerMarketData(body.ticker);
      }

      return NextResponse.json({
        texts,
        hashtags,
        market: market
          ? {
              bars: market.bars,
              changePct: market.changePct,
              rvol: market.rvol,
              opportunity: market.opportunity,
              trendLabels: Object.fromEntries(LOCALES.map((l) => [l, trendLabel(market.trend, l)])),
              opportunityLabels: Object.fromEntries(LOCALES.map((l) => [l, opportunityLabel(l)])),
            }
          : null,
      });
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
      rvol: market?.rvol,
      opportunity: market?.opportunity,
      customInstruction: body.customInstruction || undefined,
    });

    return NextResponse.json({
      texts,
      hashtags: buildStockHashtags(body.ticker, body.sector, market?.trend),
      market: market
        ? {
            bars: market.bars,
            changePct: market.changePct,
            rvol: market.rvol,
            opportunity: market.opportunity,
            trendLabels: Object.fromEntries(LOCALES.map((l) => [l, trendLabel(market.trend, l)])),
            opportunityLabels: Object.fromEntries(LOCALES.map((l) => [l, opportunityLabel(l)])),
          }
        : null,
    });
  } catch (e: any) {
    console.error("[x/generate]", e?.message);
    return NextResponse.json({ error: e?.message || "generation failed" }, { status: 500 });
  }
}
