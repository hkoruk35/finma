import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

function requireAdmin(req: NextRequest): boolean {
  const role = req.cookies.get("boga_auth")?.value;
  return role === "admin" || role === "readonly";
}

function requireWrite(req: NextRequest): boolean {
  return req.cookies.get("boga_auth")?.value === "admin";
}

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await supabaseAdmin.from("plans").select("*").order("sort_order", { ascending: true });
  if (error) return NextResponse.json({ error: "Could not load plans." }, { status: 502 });
  return NextResponse.json({ plans: data ?? [] });
}

export async function POST(req: NextRequest) {
  if (!requireWrite(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const key = String(body.key ?? "").trim().toLowerCase();
  const name = String(body.name ?? "").trim();
  const price_usd = Number(body.price_usd);
  if (!key || !name || !Number.isFinite(price_usd)) {
    return NextResponse.json({ error: "key, name ve price_usd gerekli." }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("plans").upsert(
    {
      key,
      name,
      price_usd,
      trial_days: Number(body.trial_days) || 0,
      intro_price_usd: body.intro_price_usd != null ? Number(body.intro_price_usd) : null,
      intro_months: body.intro_months != null ? Number(body.intro_months) : null,
      active: body.active !== false,
      sort_order: Number(body.sort_order) || 0,
    },
    { onConflict: "key" }
  );

  if (error) return NextResponse.json({ error: "Could not save plan." }, { status: 502 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  if (!requireWrite(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const key = req.nextUrl.searchParams.get("key");
  if (!key) return NextResponse.json({ error: "key gerekli." }, { status: 400 });

  const { error } = await supabaseAdmin.from("plans").delete().eq("key", key);
  if (error) return NextResponse.json({ error: "Could not delete plan." }, { status: 502 });

  return NextResponse.json({ ok: true });
}
