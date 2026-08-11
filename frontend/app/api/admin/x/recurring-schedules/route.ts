import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { computeNextIntervalRunIso, computeNextWeeklyRunIso } from "@/lib/x/recurringSchedules";

export const runtime = "nodejs";
export const maxDuration = 30;

function requireAdmin(req: NextRequest): boolean {
  return req.cookies.get("boga_auth")?.value === "admin";
}

const LOCALES = new Set(["en", "es", "fr", "pt", "tr", "id"]);
const MARKET_ASSET_CATEGORIES = new Set(["sector", "index", "commodity", "fx", "crypto"]);

// X Studio "Tekrarlanan Programlama" — bir ticker/varlık için "her N saatte
// bir" veya "haftalık, belirli NY gün+saat" otomatik gönderi tanımı oluşturur.
// cron/x-recurring-schedules zamanı geldikçe taze AI metniyle üretip yayınlar.
export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const {
    contentType,
    ticker,
    category,
    company,
    sector,
    theme,
    weekly,
    locale,
    recurrenceType,
    intervalHours,
    weekday,
    timeOfDay,
  } = body as {
    contentType: "stock" | "market_asset";
    ticker: string;
    category?: string | null;
    company?: string | null;
    sector?: string | null;
    theme?: string | null;
    weekly?: boolean;
    locale?: string | null;
    recurrenceType: "interval" | "weekly";
    intervalHours?: number;
    weekday?: number;
    timeOfDay?: string;
  };

  if (!contentType || !ticker || !recurrenceType) {
    return NextResponse.json({ error: "contentType, ticker, recurrenceType required" }, { status: 400 });
  }
  if (contentType === "market_asset" && !category) {
    return NextResponse.json({ error: "category required for market_asset" }, { status: 400 });
  }
  if (contentType === "market_asset" && !MARKET_ASSET_CATEGORIES.has(category!)) {
    return NextResponse.json({ error: "invalid category" }, { status: 400 });
  }
  if (locale && !LOCALES.has(locale)) {
    return NextResponse.json({ error: "invalid locale" }, { status: 400 });
  }

  let nextRunAt: string;
  if (recurrenceType === "interval") {
    const hours = Number(intervalHours);
    if (!Number.isFinite(hours) || hours < 1 || hours > 24) {
      return NextResponse.json({ error: "intervalHours must be between 1 and 24" }, { status: 400 });
    }
    nextRunAt = computeNextIntervalRunIso(hours);
  } else if (recurrenceType === "weekly") {
    const wd = Number(weekday);
    if (!Number.isInteger(wd) || wd < 0 || wd > 6) {
      return NextResponse.json({ error: "weekday must be 0-6" }, { status: 400 });
    }
    if (!timeOfDay || !/^\d{2}:\d{2}$/.test(timeOfDay)) {
      return NextResponse.json({ error: "timeOfDay must be HH:mm" }, { status: 400 });
    }
    nextRunAt = computeNextWeeklyRunIso(wd, timeOfDay);
  } else {
    return NextResponse.json({ error: "invalid recurrenceType" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("x_recurring_schedules")
    .insert({
      content_type: contentType,
      ticker: ticker.toUpperCase().trim(),
      category: contentType === "market_asset" ? category : null,
      company: contentType === "stock" ? company ?? null : null,
      sector: contentType === "stock" ? sector ?? null : null,
      theme: contentType === "stock" ? theme ?? null : null,
      weekly: !!weekly,
      locale: locale || null,
      recurrence_type: recurrenceType,
      interval_hours: recurrenceType === "interval" ? Number(intervalHours) : null,
      weekday: recurrenceType === "weekly" ? Number(weekday) : null,
      time_of_day: recurrenceType === "weekly" ? timeOfDay : null,
      next_run_at: nextRunAt,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ schedule: data });
}

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await supabaseAdmin
    .from("x_recurring_schedules")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ schedules: data ?? [] });
}

// enabled acik/kapali toggle icin.
export async function PATCH(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const body = await req.json().catch(() => ({}));

  const { data, error } = await supabaseAdmin
    .from("x_recurring_schedules")
    .update({ enabled: !!body.enabled })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ schedule: data });
}

export async function DELETE(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { error } = await supabaseAdmin.from("x_recurring_schedules").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
