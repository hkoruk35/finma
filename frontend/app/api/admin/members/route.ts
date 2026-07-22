import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { fetchMemberStats } from "@/lib/telegram";

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
    .select("id, username, email, plan, trial_ends_at, last_login_at, created_at, subscription_status, region")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: "Could not load members." }, { status: 502 });
  
  const stats = await fetchMemberStats();

  return NextResponse.json({ members: data ?? [], stats });
}

export async function POST(req: NextRequest) {
  if (!requireWrite(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { username?: string; email?: string; password?: string; plan?: string; trial_ends_at?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { username, email, password, plan = "pending", trial_ends_at } = body;
  if (!username || !email || !password) {
    return NextResponse.json({ error: "Kullanıcı adı, e-posta ve şifre zorunludur." }, { status: 400 });
  }

  // 1. Create Auth User in Supabase
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username },
  });

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 });
  }

  const userId = authData.user.id;

  // 2. Upsert record in members table
  const { error: dbError } = await supabaseAdmin
    .from("members")
    .upsert({
      id: userId,
      username,
      email,
      plan,
      trial_ends_at: trial_ends_at || null,
      created_at: new Date().toISOString(),
    });

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: userId });
}

export async function PATCH(req: NextRequest) {
  if (!requireWrite(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { id?: string; username?: string; email?: string; plan?: string; trial_ends_at?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!body.id) return NextResponse.json({ error: "id gerekli." }, { status: 400 });

  const patch: Record<string, any> = {};
  if (body.username) patch.username = body.username;
  if (body.email) patch.email = body.email;
  if (body.plan) patch.plan = body.plan;
  if (body.trial_ends_at !== undefined) patch.trial_ends_at = body.trial_ends_at;

  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "Güncellenecek alan yok." }, { status: 400 });

  const { error } = await supabaseAdmin.from("members").update(patch).eq("id", body.id);
  if (error) return NextResponse.json({ error: "Could not update member." }, { status: 502 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  if (!requireWrite(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) return NextResponse.json({ error: "id parametresi gerekli." }, { status: 400 });

  // 1. Delete from members table
  const { error: dbError } = await supabaseAdmin.from("members").delete().eq("id", id);
  if (dbError) {
    return NextResponse.json({ error: "Üye veritabanından silinemedi." }, { status: 500 });
  }

  // 2. Delete from Supabase Auth
  await supabaseAdmin.auth.admin.deleteUser(id).catch(() => {});

  return NextResponse.json({ ok: true });
}
