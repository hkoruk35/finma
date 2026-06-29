import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "@/lib/supabase-admin";

function requireAdmin(req: NextRequest): boolean {
  return req.cookies.get("boga_auth")?.value === "admin";
}

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await supabaseAdmin
    .from("admins")
    .select("id, email, role, created_at, created_by")
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: "Could not load admins." }, { status: 502 });
  return NextResponse.json({ admins: data ?? [] });
}

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { email?: string; password?: string; role?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const email = body.email?.toLowerCase().trim();
  const role = body.role === "readonly" ? "readonly" : "admin";
  if (!email || !body.password || body.password.length < 8) {
    return NextResponse.json({ error: "Email ve en az 8 karakterli şifre gerekli." }, { status: 400 });
  }

  const password_hash = await bcrypt.hash(body.password, 12);
  const { error } = await supabaseAdmin
    .from("admins")
    .upsert({ email, password_hash, role, created_by: "admin-panel" }, { onConflict: "email" });

  if (error) return NextResponse.json({ error: "Could not save admin." }, { status: 502 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const email = req.nextUrl.searchParams.get("email")?.toLowerCase().trim();
  if (!email) return NextResponse.json({ error: "Email required." }, { status: 400 });

  const { count } = await supabaseAdmin
    .from("admins")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin");

  const { data: target } = await supabaseAdmin.from("admins").select("role").eq("email", email).single();

  if (target?.role === "admin" && (count ?? 0) <= 1) {
    return NextResponse.json({ error: "Son admin silinemez." }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("admins").delete().eq("email", email);
  if (error) return NextResponse.json({ error: "Could not remove admin." }, { status: 502 });

  return NextResponse.json({ ok: true });
}
