import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

function requireAdmin(req: NextRequest): boolean {
  return req.cookies.get("boga_auth")?.value === "admin";
}

const VALID_KEYS = new Set(["markets", "watchlist", "news", "analysis", "brokers", "premium"]);

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { data, error } = await supabaseAdmin.from("site_menu_toggles").select("*").order("key");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ toggles: data ?? [] });
}

// Menü Yönetimi — üst seviye menü öğesinin görünürlüğünü ve (opsiyonel)
// etiket override'ını günceller. Menü ağacının yapısı (alt öğeler, rotalar)
// koda gömülü kalır — bu sadece açık/kapalı + etiket kontrolü sağlar.
export async function PATCH(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { key, enabled, labelOverride } = body as { key: string; enabled?: boolean; labelOverride?: string | null };

  if (!key || !VALID_KEYS.has(key)) {
    return NextResponse.json({ error: "invalid key" }, { status: 400 });
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof enabled === "boolean") patch.enabled = enabled;
  if (labelOverride !== undefined) patch.label_override = labelOverride || null;

  const { data, error } = await supabaseAdmin.from("site_menu_toggles").update(patch).eq("key", key).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ toggle: data });
}
