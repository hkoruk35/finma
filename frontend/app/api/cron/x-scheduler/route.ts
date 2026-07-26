import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { renderCardPng, type CardParams } from "@/lib/x/renderTemplate";
import { postTweet, extractXErrorDetail } from "@/lib/x/client";
import { generateLocalizedTexts, LOCALES, type Locale } from "@/lib/x/generateContent";
import { fetchTickerMarketData, trendLabel, opportunityLabel } from "@/lib/x/marketData";
import { buildStockHashtags, appendHashtagsWithinLimit } from "@/lib/x/hashtags";
import { localizedThemeTitle } from "@/lib/hotThemes2026";
import { uploadPostImage } from "@/lib/x/storage";

export const runtime = "nodejs";
export const maxDuration = 90;

const CRON_SECRET = process.env.CRON_SECRET;
const DAILY_FREE_TIER_LIMIT = 480;

// Otomasyon sadece Ingilizce postlar; diger 4 dilin taslaklari yine de
// startNewCycle() ile olusturulur (kullanici bunlari x-studio'dan ara sira
// elle paylasabilsin diye), sadece otomatik gonderi dongusune girmezler.
const AUTO_LOCALE: Locale = "en";

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

// Kuyruktan bir icerik secip 5 dilde taslak x_posts satiri olusturur (yeni cycle).
// Haftalık itemler (weekly=true) otomatik otomasyon tarafından atlanır — manuel gönderim için ayrılmıştır.
async function startNewCycle(): Promise<string | null> {
  const { data: candidate } = await supabaseAdmin
    .from("x_content_pool")
    .select("id")
    .is("used_at", null)
    .eq("weekly", false)
    .order("priority", { ascending: false })
    .order("added_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!candidate) return null;

  // Atomik claim: iki es zamanli cagri (orn. siki interval + GitHub Actions
  // polling cakismasi) ayni satiri secerse, used_at hala null iken calisan
  // UPDATE'i sadece biri "kazanir" — kaybeden bos donus alip cikar. Bu
  // olmadan ayni ticker icin iki farkli AI metniyle cift cycle olusabiliyordu.
  const { data: poolItem } = await supabaseAdmin
    .from("x_content_pool")
    .update({ used_at: new Date().toISOString() })
    .eq("id", candidate.id)
    .is("used_at", null)
    .select()
    .maybeSingle();

  if (!poolItem) return null; // baska bir istek once claim etti

  const market = await fetchTickerMarketData(poolItem.ticker);

  const texts = await generateLocalizedTexts({
    contentType: "stock",
    ticker: poolItem.ticker,
    company: poolItem.company,
    sector: poolItem.sector,
    theme: poolItem.theme,
    signal: market?.signal,
    trend: market?.trend,
    rvol: market?.rvol,
    opportunity: market?.opportunity,
  });

  const cycleId = crypto.randomUUID();
  const rows = LOCALES.map((locale) => {
    const row: any = {
      cycle_id: cycleId,
      content_type: "stock" as const,
      ticker: poolItem.ticker,
      sector: poolItem.sector,
      theme: poolItem.theme,
      source: poolItem.source,
      locale,
      status: "draft" as const,
      content_text: texts[locale],
    };
    return row;
  });

  const { error: insertError } = await supabaseAdmin.from("x_posts").insert(rows);
  if (insertError) {
    console.error("[x-scheduler] x_posts insert failed:", insertError.message);
    return null;
  }

  return cycleId;
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: settings } = await supabaseAdmin
    .from("x_automation_settings")
    .select("*")
    .eq("id", 1)
    .single();

  if (!settings?.enabled) {
    return NextResponse.json({ skipped: "automation disabled" });
  }

  // X bağlantısı kapalıyken bu döngü yine çalışır (içerik üretilip /news'e
  // gönderi olarak düşer), sadece gerçek postTweet() çağrısı atlanır.
  const postingEnabled = settings.x_posting_enabled !== false;

  const { data: queue } = await supabaseAdmin
    .from("x_language_queue")
    .select("*")
    .eq("id", 1)
    .single();

  if (queue?.last_posted_at) {
    const elapsedMin = (Date.now() - new Date(queue.last_posted_at).getTime()) / 60000;
    if (elapsedMin < settings.interval_minutes) {
      return NextResponse.json({ skipped: "interval not elapsed", elapsedMin, requiredMin: settings.interval_minutes });
    }
  }

  const locale = AUTO_LOCALE;

  // Bu dil icin bekleyen (draft) bir cycle var mi?
  let { data: pendingPost } = await supabaseAdmin
    .from("x_posts")
    .select("*")
    .eq("locale", locale)
    .eq("status", "draft")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!pendingPost) {
    const cycleId = await startNewCycle();
    if (!cycleId) return NextResponse.json({ skipped: "content pool empty or already claimed by another run" });
    const { data: freshPost } = await supabaseAdmin
      .from("x_posts")
      .select("*")
      .eq("cycle_id", cycleId)
      .eq("locale", locale)
      .single();
    pendingPost = freshPost;
  }

  if (!pendingPost) {
    return NextResponse.json({ error: "could not resolve pending post" }, { status: 500 });
  }

  if (postingEnabled) {
    const withinLimit = await withinDailyLimit();
    if (!withinLimit) {
      return NextResponse.json({ skipped: "daily X API free-tier limit reached" });
    }
  }

  // Atomik claim: draft -> scheduled. Iki es zamanli cagri ayni taslagi
  // bulmus olsa bile sadece biri bu adimi gecer (status hala 'draft' iken
  // calisan UPDATE), digeri bos donus alip cikar — ayni icerigin iki kez
  // tweetlenmesini engeller.
  const { data: claimedPost } = await supabaseAdmin
    .from("x_posts")
    .update({ status: "scheduled" })
    .eq("id", pendingPost.id)
    .eq("status", "draft")
    .select()
    .maybeSingle();

  if (!claimedPost) {
    return NextResponse.json({ skipped: "draft already claimed by another run" });
  }
  pendingPost = claimedPost;

  const market = await fetchTickerMarketData(pendingPost.ticker);

  const cardParams: CardParams = {
    kind: "stock",
    ticker: pendingPost.ticker,
    sector: pendingPost.sector ?? undefined,
    theme: localizedThemeTitle(pendingPost.theme, pendingPost.locale),
    changePct: market?.changePct ?? undefined,
    rvol: market?.rvol ?? undefined,
    opportunity: market?.opportunity ?? false,
    opportunityLabel: opportunityLabel(pendingPost.locale),
    trendLabel: market ? trendLabel(market.trend, pendingPost.locale) : undefined,
    bars: market?.bars ?? [],
    headline: pendingPost.content_text,
    locale: pendingPost.locale,
  };

  try {
    const imageBuffer = await renderCardPng(cardParams);
    const hashtags = buildStockHashtags(pendingPost.ticker, pendingPost.sector, market?.trend);
    const tweetText = appendHashtagsWithinLimit(pendingPost.content_text, hashtags);
    const tweetId = postingEnabled ? await postTweet(tweetText, imageBuffer) : null;
    const imageUrl = await uploadPostImage(pendingPost.id, imageBuffer);

    await supabaseAdmin
      .from("x_posts")
      .update({ status: "posted", tweet_id: tweetId, image_url: imageUrl, posted_at: new Date().toISOString() })
      .eq("id", pendingPost.id);

    await supabaseAdmin
      .from("x_language_queue")
      .update({ last_posted_at: new Date().toISOString() })
      .eq("id", 1);

    const otherLocalesPosted = await publishSiblingLocaleDrafts(pendingPost.cycle_id, pendingPost, market);

    return NextResponse.json({ posted: true, tweetId, ticker: pendingPost.ticker, locale, postedToX: postingEnabled, otherLocalesPosted });
  } catch (e: any) {
    const detail = extractXErrorDetail(e);
    console.error("[cron/x-scheduler] post failed:", detail);
    await supabaseAdmin
      .from("x_posts")
      .update({ status: "failed", error_message: detail })
      .eq("id", pendingPost.id);
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}

// EN disindaki 4 dilin taslaklari gercekten tweetlenmez (tek hesap, tek
// gercek paylasim/cycle — X API kotasini 5 katina cikarmamak icin), ama
// kendi /news sayfalarinda gorunebilsinler diye 'posted' olarak isaretlenir.
async function publishSiblingLocaleDrafts(
  cycleId: string,
  enPost: { ticker: string | null; sector: string | null; theme: string | null },
  market: Awaited<ReturnType<typeof fetchTickerMarketData>>
): Promise<string[]> {
  const { data: siblings } = await supabaseAdmin
    .from("x_posts")
    .select("*")
    .eq("cycle_id", cycleId)
    .eq("status", "draft")
    .neq("locale", AUTO_LOCALE);

  if (!siblings || siblings.length === 0) return [];

  const posted: string[] = [];
  for (const sibling of siblings) {
    try {
      const cardParams: CardParams = {
        kind: "stock",
        ticker: sibling.ticker,
        sector: sibling.sector ?? undefined,
        theme: localizedThemeTitle(sibling.theme, sibling.locale),
        changePct: market?.changePct ?? undefined,
        rvol: market?.rvol ?? undefined,
        opportunity: market?.opportunity ?? false,
        opportunityLabel: opportunityLabel(sibling.locale),
        trendLabel: market ? trendLabel(market.trend, sibling.locale) : undefined,
        bars: market?.bars ?? [],
        headline: sibling.content_text,
        locale: sibling.locale,
      };
      const imageBuffer = await renderCardPng(cardParams);
      const imageUrl = await uploadPostImage(sibling.id, imageBuffer);

      await supabaseAdmin
        .from("x_posts")
        .update({ status: "posted", tweet_id: null, image_url: imageUrl, posted_at: new Date().toISOString() })
        .eq("id", sibling.id);

      posted.push(sibling.locale);
    } catch (e: any) {
      console.error(`[cron/x-scheduler] sibling locale ${sibling.locale} publish failed:`, e?.message || e);
      await supabaseAdmin
        .from("x_posts")
        .update({ status: "failed", error_message: extractXErrorDetail(e) })
        .eq("id", sibling.id);
    }
  }
  return posted;
}
