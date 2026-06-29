import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  const lang = req.nextUrl.searchParams.get("lang");
  const country = req.headers.get("x-vercel-ip-country");
  const now = new Date().toISOString();

  let query = supabaseAdmin
    .from("campaigns")
    .select("id, title, message, cta_url, country_code, lang")
    .eq("active", true)
    .or(`starts_at.is.null,starts_at.lte.${now}`)
    .or(`ends_at.is.null,ends_at.gte.${now}`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ campaigns: [] });

  const matched = (data ?? []).filter(
    (c) => (!c.country_code || c.country_code === country) && (!c.lang || c.lang === lang)
  );

  return NextResponse.json({ campaigns: matched });
}
