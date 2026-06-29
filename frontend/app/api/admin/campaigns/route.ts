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

  const { data, error } = await supabaseAdmin.from("campaigns").select("*").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Could not load campaigns." }, { status: 502 });
  return NextResponse.json({ campaigns: data ?? [] });
}

export async function POST(req: NextRequest) {
  if (!requireWrite(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const title = String(body.title ?? "").trim();
  const message = String(body.message ?? "").trim();
  if (!title || !message) return NextResponse.json({ error: "title ve message gerekli." }, { status: 400 });

  const { error } = await supabaseAdmin.from("campaigns").insert({
    title,
    message,
    country_code: body.country_code ? String(body.country_code).toUpperCase() : null,
    lang: body.lang || null,
    cta_url: body.cta_url || null,
    starts_at: body.starts_at || null,
    ends_at: body.ends_at || null,
    active: body.active !== false,
  });

  if (error) return NextResponse.json({ error: "Could not save campaign." }, { status: 502 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  if (!requireWrite(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { id?: string; active?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!body.id) return NextResponse.json({ error: "id gerekli." }, { status: 400 });

  const { error } = await supabaseAdmin.from("campaigns").update({ active: body.active }).eq("id", body.id);
  if (error) return NextResponse.json({ error: "Could not update campaign." }, { status: 502 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  if (!requireWrite(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id gerekli." }, { status: 400 });

  const { error } = await supabaseAdmin.from("campaigns").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "Could not delete campaign." }, { status: 502 });

  return NextResponse.json({ ok: true });
}
