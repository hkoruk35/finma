import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

function requireAdmin(req: NextRequest): boolean {
  const role = req.cookies.get("boga_auth")?.value;
  return role === "admin" || role === "readonly";
}

function requireWrite(req: NextRequest): boolean {
  return req.cookies.get("boga_auth")?.value === "admin";
}

interface UnifiedMessage {
  id: string;
  source: "contact" | "member";
  name: string | null;
  email: string;
  subject: string | null;
  body: string;
  created_at: string;
  is_read: boolean;
}

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [contactRes, memberRes] = await Promise.all([
    supabaseAdmin.from("contact_messages").select("id, name, email, subject, body, created_at, is_read"),
    supabaseAdmin.from("member_messages").select("id, email, subject, body, created_at, is_read"),
  ]);

  if (contactRes.error || memberRes.error) {
    return NextResponse.json({ error: "Could not load inbox." }, { status: 502 });
  }

  const messages: UnifiedMessage[] = [
    ...(contactRes.data ?? []).map((m) => ({ ...m, source: "contact" as const })),
    ...(memberRes.data ?? []).map((m) => ({ ...m, name: null, source: "member" as const })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return NextResponse.json({ messages });
}

export async function PATCH(req: NextRequest) {
  if (!requireWrite(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { id?: string; source?: "contact" | "member" };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!body.id || !body.source) return NextResponse.json({ error: "id ve source gerekli." }, { status: 400 });

  const table = body.source === "contact" ? "contact_messages" : "member_messages";
  const { error } = await supabaseAdmin.from(table).update({ is_read: true }).eq("id", body.id);
  if (error) return NextResponse.json({ error: "Could not update message." }, { status: 502 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  if (!requireWrite(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const id = req.nextUrl.searchParams.get("id");
  const source = req.nextUrl.searchParams.get("source");
  if (!id || (source !== "contact" && source !== "member")) {
    return NextResponse.json({ error: "id ve source gerekli." }, { status: 400 });
  }

  const table = source === "contact" ? "contact_messages" : "member_messages";
  const { error } = await supabaseAdmin.from(table).delete().eq("id", id);
  if (error) return NextResponse.json({ error: "Could not delete message." }, { status: 502 });

  return NextResponse.json({ ok: true });
}
