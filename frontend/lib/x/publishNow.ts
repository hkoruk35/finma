// Bir ticker/varlık için taze AI metni + kart görselini üretip, hedeflenen
// dil(ler)de tweet atan ve x_posts'a loglayan ortak mantık. Hem cron/
// x-recurring-schedules (otomatik tetikleme) hem de admin/x/publish-now
// (X Studio "Analiz Yönetimi" sayfasındaki manuel "Şimdi Üret ve Yayınla"
// butonu) AYNI fonksiyonu kullanır — üretim mantığı tek yerde.

import { supabaseAdmin } from "@/lib/supabase-admin";
import { renderCardPng, type CardParams } from "@/lib/x/renderTemplate";
import { postTweet, extractXErrorDetail } from "@/lib/x/client";
import {
  fetchTickerMarketData,
  fetchWeeklyBars,
  fetchMarketAssetBars,
  fetchMarketAssetQuote,
  trendLabel,
  opportunityLabel,
} from "@/lib/x/marketData";
import { buildStockHashtags, buildMarketAssetHashtags, appendHashtagsWithinLimit } from "@/lib/x/hashtags";
import { localizedThemeTitle } from "@/lib/hotThemes2026";
import { uploadPostImage } from "@/lib/x/storage";
import { generateLocalizedTexts, LOCALES, type Locale, type MarketAssetCategory } from "@/lib/x/generateContent";
import { getSectorStandouts, getSectorRotation } from "@/lib/x/listOptions";
import { getMarketAssetLabel } from "@/lib/x/marketAssetLabels";

const DAILY_FREE_TIER_LIMIT = 480;
const MANUAL_POST_LIMIT = 2500;

function siteBase(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || "https://bogastock.com";
}

export async function withinDailyLimit(): Promise<boolean> {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabaseAdmin
    .from("x_api_usage")
    .select("post_count")
    .eq("usage_date", today)
    .maybeSingle();
  const count = data?.post_count ?? 0;
  if (count >= DAILY_FREE_TIER_LIMIT) return false;
  await supabaseAdmin.from("x_api_usage").upsert({ usage_date: today, post_count: count + 1 }, { onConflict: "usage_date" });
  return true;
}

export interface PublishTarget {
  contentType: "stock" | "market_asset";
  ticker: string;
  category?: MarketAssetCategory | null;
  company?: string | null;
  sector?: string | null;
  theme?: string | null;
  weekly: boolean;
  source?: string; // x_posts.source — "recurring" (cron) veya "manual" (admin butonu)
}

export interface PublishLocaleResult {
  locale: Locale;
  posted: boolean;
  error?: string;
}

export async function publishTargetNow(target: PublishTarget, targetLocales: Locale[], postingEnabled: boolean): Promise<PublishLocaleResult[]> {
  let texts: Record<Locale, string>;
  let hashtagsBase: string;
  let buildCard: (loc: Locale) => CardParams;

  if (target.contentType === "stock") {
    const market = await fetchTickerMarketData(target.ticker);
    const bars = target.weekly && market ? await fetchWeeklyBars(siteBase(), target.ticker) : market?.bars ?? [];
    texts = await generateLocalizedTexts({
      contentType: "stock",
      ticker: target.ticker,
      company: target.company,
      sector: target.sector,
      theme: target.theme,
      signal: market?.signal,
      trend: market?.trend,
      rvol: market?.rvol,
      opportunity: market?.opportunity,
      weekly: target.weekly,
      changePct: market?.changePct,
    });
    hashtagsBase = buildStockHashtags(target.ticker, target.sector, market?.trend);
    buildCard = (loc) => ({
      kind: "stock",
      ticker: target.ticker,
      company: target.company ?? undefined,
      sector: target.sector ?? undefined,
      theme: localizedThemeTitle(target.theme ?? null, loc),
      changePct: market?.changePct,
      rvol: market?.rvol,
      opportunity: market?.opportunity,
      opportunityLabel: opportunityLabel(loc),
      trendLabel: market ? trendLabel(market.trend, loc) : undefined,
      bars,
      headline: texts[loc],
      locale: loc,
    });
  } else {
    const category = target.category as MarketAssetCategory;
    const label = getMarketAssetLabel(target.ticker, "en");
    const quote = await fetchMarketAssetQuote(target.ticker);
    const [sectorStandouts, sectorRotation, bars] = await Promise.all([
      target.weekly && category === "sector" ? getSectorStandouts(target.ticker) : Promise.resolve(undefined),
      target.weekly && category === "index" ? getSectorRotation() : Promise.resolve(undefined),
      target.weekly ? fetchMarketAssetBars(target.ticker) : Promise.resolve([]),
    ]);
    let changePct = quote.changePct ?? undefined;
    if (target.weekly && bars.length >= 6) {
      const latest = bars[bars.length - 1].close;
      const weekAgo = bars[bars.length - 6].close;
      if (weekAgo) changePct = Math.round(((latest - weekAgo) / weekAgo) * 10000) / 100;
    }
    texts = await generateLocalizedTexts({
      contentType: "market_asset",
      ticker: target.ticker,
      label,
      category,
      changePct,
      weekly: target.weekly,
      sectorStandouts,
      sectorRotation,
    });
    hashtagsBase = buildMarketAssetHashtags(target.ticker, label, category);
    buildCard = (loc) => ({
      kind: "market_asset",
      ticker: target.ticker,
      label: getMarketAssetLabel(target.ticker, loc),
      category,
      changePct,
      price: quote.price ?? undefined,
      weekly: target.weekly,
      bars,
      headline: texts[loc],
      locale: loc,
    });
  }

  const results: PublishLocaleResult[] = [];
  const source = target.source ?? "manual";

  for (const loc of targetLocales) {
    if (!texts[loc]) continue;
    try {
      let allowPost = postingEnabled;
      if (allowPost) {
        const withinLimit = await withinDailyLimit();
        if (!withinLimit) allowPost = false;
      }

      const finalText = appendHashtagsWithinLimit(texts[loc], hashtagsBase, MANUAL_POST_LIMIT);
      const cardParams = buildCard(loc);
      const imageBuffer = await renderCardPng(cardParams);
      const tweetId = allowPost ? await postTweet(finalText, imageBuffer) : null;

      const { data: inserted } = await supabaseAdmin
        .from("x_posts")
        .insert({
          content_type: target.contentType,
          ticker: target.ticker,
          sector: target.contentType === "stock" ? target.sector : null,
          theme: target.contentType === "stock" ? target.theme : null,
          source,
          locale: loc,
          status: "posted",
          content_text: finalText,
          tweet_id: tweetId,
          posted_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (inserted) {
        const imageUrl = await uploadPostImage(inserted.id, imageBuffer);
        if (imageUrl) await supabaseAdmin.from("x_posts").update({ image_url: imageUrl }).eq("id", inserted.id);
      }

      results.push({ locale: loc, posted: !!tweetId });
    } catch (e: any) {
      const detail = extractXErrorDetail(e);
      console.error("[publishTargetNow] locale failed:", target.ticker, loc, detail);
      await supabaseAdmin.from("x_posts").insert({
        content_type: target.contentType,
        ticker: target.ticker,
        source,
        locale: loc,
        status: "failed",
        content_text: texts[loc] ?? null,
        error_message: detail,
      });
      results.push({ locale: loc, posted: false, error: detail });
    }
  }

  return results;
}

export { LOCALES };
export type { Locale };
