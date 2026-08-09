import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { MARKET_ASSET_DEFS } from "@/lib/x/listOptions";

export const runtime = "nodejs";
export const maxDuration = 30;

function requireAdmin(req: NextRequest): boolean {
  return req.cookies.get("boga_auth")?.value === "admin";
}

// X Studio "Analiz Yönetimi" — her sektör/endeks/emtia/döviz/kripto varlığı
// için en son gönderi zamanını döner, admin panelinde "hangileri hiç
// paylaşılmamış" görülebilsin diye.
export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const allTickers = Object.values(MARKET_ASSET_DEFS).flat().map((d) => d.ticker);

  const { data, error } = await supabaseAdmin
    .from("x_posts")
    .select("ticker, locale, status, created_at, source")
    .eq("content_type", "market_asset")
    .in("ticker", allTickers)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const lastByTicker: Record<string, { created_at: string; locale: string; status: string; source: string | null }> = {};
  for (const row of data ?? []) {
    if (!lastByTicker[row.ticker]) {
      lastByTicker[row.ticker] = { created_at: row.created_at, locale: row.locale, status: row.status, source: row.source };
    }
  }

  return NextResponse.json({ lastByTicker });
}
