import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const maxDuration = 30;

function requireAdmin(req: NextRequest): boolean {
  return req.cookies.get("boga_auth")?.value === "admin";
}

const CATEGORIES = new Set(["stock", "fx", "crypto"]);

// Broker Yönetimi — admin buradan aracı kurum dizinini (Brokers sayfası)
// düzenler. Logo/açıklama gibi telif gerektiren içerikler admin tarafından,
// her broker'ın kendi resmi/izinli kaynağından elle girilir.
export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { data, error } = await supabaseAdmin.from("broker_directory").select("*").order("category").order("sort_order");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ brokers: data ?? [] });
}

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { category, name, websiteUrl, logoUrl, description, sortOrder } = body as {
    category: string;
    name: string;
    websiteUrl?: string;
    logoUrl?: string;
    description?: string;
    sortOrder?: number;
  };

  if (!category || !CATEGORIES.has(category) || !name?.trim()) {
    return NextResponse.json({ error: "category (stock/fx/crypto) and name required" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("broker_directory")
    .insert({
      category,
      name: name.trim(),
      website_url: websiteUrl || null,
      logo_url: logoUrl || null,
      description: description || null,
      sort_order: sortOrder ?? 0,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ broker: data });
}

export async function PATCH(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const body = await req.json().catch(() => ({}));

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.category !== undefined) patch.category = body.category;
  if (body.name !== undefined) patch.name = body.name;
  if (body.websiteUrl !== undefined) patch.website_url = body.websiteUrl || null;
  if (body.logoUrl !== undefined) patch.logo_url = body.logoUrl || null;
  if (body.description !== undefined) patch.description = body.description || null;
  if (body.sortOrder !== undefined) patch.sort_order = body.sortOrder;
  if (body.enabled !== undefined) patch.enabled = !!body.enabled;

  const { data, error } = await supabaseAdmin.from("broker_directory").update(patch).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ broker: data });
}

export async function DELETE(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const { error } = await supabaseAdmin.from("broker_directory").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
