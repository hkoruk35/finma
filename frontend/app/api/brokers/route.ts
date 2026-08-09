import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const revalidate = 3600;

// Public — Brokers sayfası (app/global/[locale]/brokers) burayı okur.
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("broker_directory")
    .select("id, category, name, website_url, logo_url, description")
    .eq("enabled", true)
    .order("category")
    .order("sort_order");

  if (error) return NextResponse.json({ brokers: [] }, { headers: { "Cache-Control": "public, s-maxage=3600" } });
  return NextResponse.json({ brokers: data ?? [] }, { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } });
}
