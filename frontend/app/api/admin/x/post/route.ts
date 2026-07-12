import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { renderCardPng, type CardParams } from "@/lib/x/renderTemplate";
import { postTweet, extractXErrorDetail } from "@/lib/x/client";
import { uploadPostImage } from "@/lib/x/storage";

export const runtime = "nodejs";
export const maxDuration = 60;

function requireAdmin(req: NextRequest): boolean {
  return req.cookies.get("boga_auth")?.value === "admin";
}

const DAILY_FREE_TIER_LIMIT = 480; // 500 free-tier limitine güvenlik payı bırakır

async function checkAndIncrementUsage(): Promise<boolean> {
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

// Manuel gönderi: kullanıcı hisse/promo seçer, metin+görsel önizler, doğrudan paylaşır.
export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { locale, contentText, cardParams } = body as {
    locale: string;
    contentText: string;
    cardParams: CardParams;
  };

  if (!locale || !contentText || !cardParams) {
    return NextResponse.json({ error: "locale, contentText, cardParams required" }, { status: 400 });
  }

  const withinLimit = await checkAndIncrementUsage();
  if (!withinLimit) {
    return NextResponse.json({ error: "Daily X API free-tier limit reached" }, { status: 429 });
  }

  const { data: postRow } = await supabaseAdmin
    .from("x_posts")
    .insert({
      content_type: cardParams.kind,
      ticker: cardParams.kind === "stock" ? cardParams.ticker : null,
      sector: cardParams.kind === "stock" ? cardParams.sector ?? null : null,
      theme: cardParams.kind === "stock" ? cardParams.theme ?? null : null,
      locale,
      status: "draft",
      content_text: contentText,
    })
    .select()
    .single();

  try {
    const imageBuffer = await renderCardPng(cardParams);
    const tweetId = await postTweet(contentText, imageBuffer);
    const imageUrl = await uploadPostImage(postRow.id, imageBuffer);

    await supabaseAdmin
      .from("x_posts")
      .update({ status: "posted", tweet_id: tweetId, image_url: imageUrl, posted_at: new Date().toISOString() })
      .eq("id", postRow.id);

    return NextResponse.json({ tweetId, postId: postRow.id });
  } catch (e: any) {
    const detail = extractXErrorDetail(e);
    console.error("[x/post] failed:", detail);
    await supabaseAdmin
      .from("x_posts")
      .update({ status: "failed", error_message: detail })
      .eq("id", postRow.id);
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { data, error } = await supabaseAdmin
    .from("x_posts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ posts: data ?? [] });
}
