import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_DAYS_AHEAD = 30;

function requireAdmin(req: NextRequest): boolean {
  return req.cookies.get("boga_auth")?.value === "admin";
}

// Kullanicinin belirli bir NY saati + dil icin ileri tarihli plana aldigi
// gonderi. Gorsel/tweet burada uretilmez — cron/x-scheduled-publish zamani
// gelince taze piyasa verisiyle uretip paylasir.
export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const {
    locale,
    contentText,
    contentType,
    ticker,
    sector,
    theme,
    source,
    scheduledAtUtc,
    customPrompt,
  } = body as {
    locale: string;
    contentText: string;
    contentType: "stock" | "promo";
    ticker?: string | null;
    sector?: string | null;
    theme?: string | null;
    source?: string | null;
    scheduledAtUtc: string;
    customPrompt?: string | null;
  };

  if (!locale || !contentText || !contentType || !scheduledAtUtc) {
    return NextResponse.json({ error: "locale, contentText, contentType, scheduledAtUtc required" }, { status: 400 });
  }
  if (contentType === "stock" && !ticker) {
    return NextResponse.json({ error: "ticker required for stock content" }, { status: 400 });
  }

  const scheduledAt = new Date(scheduledAtUtc);
  if (Number.isNaN(scheduledAt.getTime())) {
    return NextResponse.json({ error: "invalid scheduledAtUtc" }, { status: 400 });
  }
  const now = Date.now();
  const maxAheadMs = MAX_DAYS_AHEAD * 24 * 60 * 60 * 1000;
  if (scheduledAt.getTime() <= now) {
    return NextResponse.json({ error: "scheduledAtUtc must be in the future" }, { status: 400 });
  }
  if (scheduledAt.getTime() - now > maxAheadMs) {
    return NextResponse.json({ error: `scheduledAtUtc must be within ${MAX_DAYS_AHEAD} days` }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("x_posts")
    .insert({
      content_type: contentType,
      ticker: contentType === "stock" ? ticker : null,
      sector: contentType === "stock" ? sector ?? null : null,
      theme: contentType === "stock" ? theme ?? null : null,
      source: contentType === "stock" ? source ?? "manual" : null,
      locale,
      status: "scheduled",
      content_text: contentText,
      scheduled_at: scheduledAt.toISOString(),
      custom_prompt: customPrompt || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ post: data });
}

// Zamani gelmemis (henuz yayinlanmamis) planli gonderileri listeler.
export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await supabaseAdmin
    .from("x_posts")
    .select("*")
    .eq("status", "scheduled")
    .not("scheduled_at", "is", null)
    .order("scheduled_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ scheduled: data ?? [] });
}

// Henuz yayinlanmamis planli bir gonderiyi iptal eder.
export async function DELETE(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("x_posts")
    .delete()
    .eq("id", id)
    .eq("status", "scheduled");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
