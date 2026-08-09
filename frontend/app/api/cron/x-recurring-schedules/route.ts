import { NextRequest, NextResponse } from "next/server";
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
import { isXPostingEnabled } from "@/lib/x/settings";
import { generateLocalizedTexts, LOCALES, type Locale, type MarketAssetCategory } from "@/lib/x/generateContent";
import { getSectorStandouts, getSectorRotation } from "@/lib/x/listOptions";
import { getMarketAssetLabel } from "@/lib/x/marketAssetLabels";
import { computeNextIntervalRunIso, computeNextWeeklyRunIso } from "@/lib/x/recurringSchedules";

export const runtime = "nodejs";
export const maxDuration = 90;

const CRON_SECRET = process.env.CRON_SECRET;
const DAILY_FREE_TIER_LIMIT = 480;
const MAX_SCHEDULES_PER_RUN = 5;
const MANUAL_POST_LIMIT = 2500;

function siteBase(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || "https://bogastock.com";
}

async function withinDailyLimit(): Promise<boolean> {
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

interface RecurringSchedule {
  id: string;
  content_type: "stock" | "market_asset";
  ticker: string;
  category: MarketAssetCategory | null;
  company: string | null;
  sector: string | null;
  theme: string | null;
  weekly: boolean;
  locale: Locale | null;
  recurrence_type: "interval" | "weekly";
  interval_hours: number | null;
  weekday: number | null;
  time_of_day: string | null;
  next_run_at: string;
}

// Ticker/varlık için taze AI metni + kart görselini üretip, hedeflenen her
// dilde (locale=null ise 5 dilin hepsinde) tweet atar ve x_posts'a loglar.
// generate route.ts (/api/admin/x/generate) ile AYNI üretim mantığı — burada
// tek AI çağrısıyla 5 dilin hepsi birden alınıp döngüyle yayınlanıyor.
async function fireSchedule(sched: RecurringSchedule, postingEnabled: boolean) {
  const targetLocales: Locale[] = sched.locale ? [sched.locale] : [...LOCALES];
  let texts: Record<Locale, string>;
  let hashtagsBase: string;
  let buildCard: (loc: Locale) => CardParams;

  if (sched.content_type === "stock") {
    const market = await fetchTickerMarketData(sched.ticker);
    const bars = sched.weekly && market ? await fetchWeeklyBars(siteBase(), sched.ticker) : market?.bars ?? [];
    texts = await generateLocalizedTexts({
      contentType: "stock",
      ticker: sched.ticker,
      company: sched.company,
      sector: sched.sector,
      theme: sched.theme,
      signal: market?.signal,
      trend: market?.trend,
      rvol: market?.rvol,
      opportunity: market?.opportunity,
      weekly: sched.weekly,
      changePct: market?.changePct,
    });
    hashtagsBase = buildStockHashtags(sched.ticker, sched.sector, market?.trend);
    buildCard = (loc) => ({
      kind: "stock",
      ticker: sched.ticker,
      company: sched.company ?? undefined,
      sector: sched.sector ?? undefined,
      theme: localizedThemeTitle(sched.theme, loc),
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
    const category = sched.category as MarketAssetCategory;
    const label = getMarketAssetLabel(sched.ticker, "en");
    const quote = await fetchMarketAssetQuote(sched.ticker);
    const [sectorStandouts, sectorRotation, bars] = await Promise.all([
      sched.weekly && category === "sector" ? getSectorStandouts(sched.ticker) : Promise.resolve(undefined),
      sched.weekly && category === "index" ? getSectorRotation() : Promise.resolve(undefined),
      sched.weekly ? fetchMarketAssetBars(sched.ticker) : Promise.resolve([]),
    ]);
    let changePct = quote.changePct ?? undefined;
    if (sched.weekly && bars.length >= 6) {
      const latest = bars[bars.length - 1].close;
      const weekAgo = bars[bars.length - 6].close;
      if (weekAgo) changePct = Math.round(((latest - weekAgo) / weekAgo) * 10000) / 100;
    }
    texts = await generateLocalizedTexts({
      contentType: "market_asset",
      ticker: sched.ticker,
      label,
      category,
      changePct,
      weekly: sched.weekly,
      sectorStandouts,
      sectorRotation,
    });
    hashtagsBase = buildMarketAssetHashtags(sched.ticker, label, category);
    buildCard = (loc) => ({
      kind: "market_asset",
      ticker: sched.ticker,
      label: getMarketAssetLabel(sched.ticker, loc),
      category,
      changePct,
      price: quote.price ?? undefined,
      weekly: sched.weekly,
      bars,
      headline: texts[loc],
      locale: loc,
    });
  }

  const results: { locale: Locale; posted: boolean; error?: string }[] = [];

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
          content_type: sched.content_type,
          ticker: sched.ticker,
          sector: sched.content_type === "stock" ? sched.sector : null,
          theme: sched.content_type === "stock" ? sched.theme : null,
          source: "recurring",
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
      console.error("[cron/x-recurring-schedules] locale failed:", sched.ticker, loc, detail);
      await supabaseAdmin.from("x_posts").insert({
        content_type: sched.content_type,
        ticker: sched.ticker,
        source: "recurring",
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

// Zamani gelmis (next_run_at <= now, enabled=true) tekrarlanan programlari
// bulup ateşler, sonra bir sonraki calisma zamanina ilerletir. pg_cron
// tarafindan her 15 dakikada bir tetiklenir (bkz. 0029_pg_cron_x_recurring_schedules.sql).
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: due } = await supabaseAdmin
    .from("x_recurring_schedules")
    .select("*")
    .eq("enabled", true)
    .lte("next_run_at", new Date().toISOString())
    .order("next_run_at", { ascending: true })
    .limit(MAX_SCHEDULES_PER_RUN);

  if (!due || due.length === 0) {
    return NextResponse.json({ processed: [] });
  }

  const postingEnabled = await isXPostingEnabled();
  const processed: Array<{ scheduleId: string; ticker: string; results?: Awaited<ReturnType<typeof fireSchedule>>; error?: string }> = [];

  for (const sched of due as RecurringSchedule[]) {
    const nextRunAt =
      sched.recurrence_type === "interval"
        ? computeNextIntervalRunIso(sched.interval_hours!)
        : computeNextWeeklyRunIso(sched.weekday!, sched.time_of_day!);

    // Optimistik kilit: next_run_at hala beklenen degerse ilerlet ve bu satiri
    // biz kazanmis oluruz — ayni anda iki cron calismasi ayni satiri iki kez
    // islemez.
    const { data: claimed } = await supabaseAdmin
      .from("x_recurring_schedules")
      .update({ next_run_at: nextRunAt, last_run_at: new Date().toISOString() })
      .eq("id", sched.id)
      .eq("next_run_at", sched.next_run_at)
      .select()
      .maybeSingle();

    if (!claimed) continue;

    try {
      const results = await fireSchedule(sched, postingEnabled);
      processed.push({ scheduleId: sched.id, ticker: sched.ticker, results });
    } catch (e: any) {
      console.error("[cron/x-recurring-schedules] schedule failed:", sched.ticker, e?.message);
      processed.push({ scheduleId: sched.id, ticker: sched.ticker, error: e?.message });
    }
  }

  return NextResponse.json({ processed });
}
