import { NextRequest, NextResponse } from "next/server";
import { generateLocalizedTexts, LOCALES, type Locale, type MarketAssetCategory } from "@/lib/x/generateContent";
import { fetchTickerMarketData, fetchMarketAssetQuote, fetchMarketAssetBars, trendLabel, opportunityLabel } from "@/lib/x/marketData";
import { buildStockHashtags, buildPromoHashtags, buildMarketAssetHashtags } from "@/lib/x/hashtags";
import { getSectorStandouts, getSectorRotation } from "@/lib/x/listOptions";
import { getMarketAssetLabel } from "@/lib/x/marketAssetLabels";

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

    if (body.contentType === "market_asset") {
      const category = body.category as MarketAssetCategory;
      const weekly = !!body.weekly;
      // Kuyrukta saklanan "label" (item.company) sadece Türkçe — hem metin
      // üretimi hem de kart görseli için ticker'a göre kanonik (İngilizce)
      // ada dönülüyor; kart görseli ayrıca kendi hedef dilinde yeniden
      // çözülüyor (bkz. page.tsx buildCardParamsFor + marketAssetLabels.ts).
      const label = getMarketAssetLabel(body.ticker, "en");
      const quote = await fetchMarketAssetQuote(body.ticker);

      // Grafik sadece haftalık gönderilerde ekleniyor — günlük tek cümlelik
      // gönderiler eskisi gibi metin ağırlıklı kalıyor.
      const [sectorStandouts, sectorRotation, bars] = await Promise.all([
        weekly && category === "sector" ? getSectorStandouts(body.ticker) : Promise.resolve(undefined),
        weekly && category === "index" ? getSectorRotation() : Promise.resolve(undefined),
        weekly ? fetchMarketAssetBars(body.ticker) : Promise.resolve<any[]>([]),
      ]);

      // Haftalık gönderide değişim% de HAFTALIK olmalı — /api/quote sadece
      // günlük değişim veriyor, bu yüzden haftalıkta zaten çekilen bars'tan
      // (~5 işlem günü önceki kapanışa göre) hesaplanıyor.
      let changePct = quote.changePct ?? undefined;
      if (weekly && bars.length >= 6) {
        const latest = bars[bars.length - 1].close;
        const weekAgo = bars[bars.length - 6].close;
        if (weekAgo) changePct = Math.round(((latest - weekAgo) / weekAgo) * 10000) / 100;
      }

      const texts = await generateLocalizedTexts({
        contentType: "market_asset",
        ticker: body.ticker,
        label,
        category,
        changePct,
        customInstruction: body.customInstruction || undefined,
        weekly,
        sectorStandouts,
        sectorRotation,
      });
      return NextResponse.json({
        texts,
        hashtags: buildMarketAssetHashtags(body.ticker, label, category),
        quote: { ...quote, changePct },
        sectorStandouts,
        sectorRotation,
        bars,
      });
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
      weekly: !!body.weekly,
      changePct: market?.changePct,
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
