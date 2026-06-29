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

  const { data, error } = await supabaseAdmin
    .from("members")
    .select("id, username, email, plan, trial_ends_at, last_login_at, created_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: "Could not load members." }, { status: 502 });
  return NextResponse.json({ members: data ?? [] });
}

export async function PATCH(req: NextRequest) {
  if (!requireWrite(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { id?: string; plan?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!body.id || !body.plan) return NextResponse.json({ error: "id ve plan gerekli." }, { status: 400 });

  const { error } = await supabaseAdmin.from("members").update({ plan: body.plan }).eq("id", body.id);
  if (error) return NextResponse.json({ error: "Could not update member." }, { status: 502 });

  return NextResponse.json({ ok: true });
}
