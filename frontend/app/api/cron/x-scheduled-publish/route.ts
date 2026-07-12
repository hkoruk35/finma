import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { renderCardPng, type CardParams } from "@/lib/x/renderTemplate";
import { postTweet, extractXErrorDetail } from "@/lib/x/client";
import { fetchTickerMarketData, trendLabel, opportunityLabel } from "@/lib/x/marketData";
import { buildStockHashtags, appendHashtagsWithinLimit } from "@/lib/x/hashtags";
import { localizedThemeTitle } from "@/lib/hotThemes2026";

export const runtime = "nodejs";
export const maxDuration = 90;

const CRON_SECRET = process.env.CRON_SECRET;
const DAILY_FREE_TIER_LIMIT = 480;
const MAX_PER_RUN = 5;
// Kullanicinin X Studio'dan elle zamanladigi gonderiler icin, manuel paylasim
// akisiyla ayni (2500) karakter sinirini kullaniyoruz — otomasyonun 280'lik
// varsayilanindan farkli.
const MANUAL_POST_LIMIT = 2500;

async function withinDailyLimit(): Promise<boolean> {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabaseAdmin
    .from("x_api_usage")
    .select("post_count")
    .eq("usage_date", today)
    .maybeSingle();
  const count = data?.post_count ?? 0;
  if (count >= DAILY_FREE_TIER_LIMIT) return false;
  await supabaseAdmin
    .from("x_api_usage")
    .upsert({ usage_date: today, post_count: count + 1 }, { onConflict: "usage_date" });
  return true;
}

// Kullanicinin belirli bir NY saati icin plana aldigi (scheduled_at set edilmis)
// gonderileri bulup yayinlar. Otomasyonun (x-scheduler) gecici 'scheduled'
// claim durumundan ayristirmak icin daima scheduled_at IS NOT NULL filtrelenir.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: duePosts } = await supabaseAdmin
    .from("x_posts")
    .select("*")
    .eq("status", "scheduled")
    .not("scheduled_at", "is", null)
    .lte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(MAX_PER_RUN);

  if (!duePosts || duePosts.length === 0) {
    return NextResponse.json({ processed: [] });
  }

  const results: Array<{ id: string; ticker: string | null; locale: string; posted: boolean; error?: string }> = [];

  for (const post of duePosts) {
    // Atomik claim: 'scheduled' -> 'publishing'. Kaybeden (baska bir run once
    // claim ettiyse) bos donus alip bu satiri atlar.
    const { data: claimed } = await supabaseAdmin
      .from("x_posts")
      .update({ status: "publishing" })
      .eq("id", post.id)
      .eq("status", "scheduled")
      .select()
      .maybeSingle();

    if (!claimed) continue;

    const withinLimit = await withinDailyLimit();
    if (!withinLimit) {
      // Limit dolu — bir sonraki calistirmada tekrar denensin diye geri al.
      await supabaseAdmin.from("x_posts").update({ status: "scheduled" }).eq("id", claimed.id);
      results.push({ id: claimed.id, ticker: claimed.ticker, locale: claimed.locale, posted: false, error: "daily limit reached" });
      continue;
    }

    try {
      let cardParams: CardParams;
      let hashtagText = "";

      if (claimed.content_type === "stock") {
        const market = claimed.ticker ? await fetchTickerMarketData(claimed.ticker) : null;
        cardParams = {
          kind: "stock",
          ticker: claimed.ticker,
          sector: claimed.sector ?? undefined,
          theme: localizedThemeTitle(claimed.theme, claimed.locale),
          changePct: market?.changePct ?? undefined,
          rvol: market?.rvol ?? undefined,
          opportunity: market?.opportunity ?? false,
          opportunityLabel: opportunityLabel(claimed.locale),
          trendLabel: market ? trendLabel(market.trend, claimed.locale) : undefined,
          bars: market?.bars ?? [],
          headline: claimed.content_text,
          locale: claimed.locale,
        };
        hashtagText = buildStockHashtags(claimed.ticker, claimed.sector, market?.trend);
      } else {
        cardParams = {
          kind: "promo",
          headline: claimed.content_text,
          subheadline: "bogastock.com",
          locale: claimed.locale,
        };
      }

      const imageBuffer = await renderCardPng(cardParams);
      const tweetText = hashtagText
        ? appendHashtagsWithinLimit(claimed.content_text, hashtagText, MANUAL_POST_LIMIT)
        : claimed.content_text;
      const tweetId = await postTweet(tweetText, imageBuffer);

      await supabaseAdmin
        .from("x_posts")
        .update({ status: "posted", tweet_id: tweetId, posted_at: new Date().toISOString() })
        .eq("id", claimed.id);

      results.push({ id: claimed.id, ticker: claimed.ticker, locale: claimed.locale, posted: true });
    } catch (e: any) {
      const detail = extractXErrorDetail(e);
      console.error("[cron/x-scheduled-publish] post failed:", detail);
      await supabaseAdmin
        .from("x_posts")
        .update({ status: "failed", error_message: detail })
        .eq("id", claimed.id);
      results.push({ id: claimed.id, ticker: claimed.ticker, locale: claimed.locale, posted: false, error: detail });
    }
  }

  return NextResponse.json({ processed: results });
}
