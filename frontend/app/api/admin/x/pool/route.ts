import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSwingAllPicks } from "@/lib/data";
import { HOT_THEMES_2026 } from "@/lib/hotThemes2026";

export const runtime = "nodejs";
export const maxDuration = 30;

function requireAdmin(req: NextRequest): boolean {
  return req.cookies.get("boga_auth")?.value === "admin";
}

const RECENT_USE_WINDOW_HOURS = 48;

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { data, error } = await supabaseAdmin
    .from("x_content_pool")
    .select("*")
    .is("used_at", null)
    .order("priority", { ascending: false })
    .order("added_at", { ascending: true })
    .limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ pool: data ?? [] });
}

// ?id=<uuid> tek bir satiri siler; parametresiz cagri kuyrukta bekleyen
// (used_at is null) tum satirlari temizler (manuel "Kuyruğu Temizle").
export async function DELETE(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const id = req.nextUrl.searchParams.get("id");

  if (id) {
    const { error } = await supabaseAdmin.from("x_content_pool").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ deleted: 1 });
  }

  const { error, count } = await supabaseAdmin
    .from("x_content_pool")
    .delete({ count: "exact" })
    .is("used_at", null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: count ?? 0 });
}

// Top100 + Swing + Trend kaynaklarından kuyruğu doldurur.
// Son 48 saatte kullanılmış ticker'lar tekrar eklenmez.
export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const countTop100 = body.countTop100 ?? 8;
  const countSwing = body.countSwing ?? 6;
  const countTrend = body.countTrend ?? 6;

  const sinceIso = new Date(Date.now() - RECENT_USE_WINDOW_HOURS * 3600_000).toISOString();
  const { data: recentlyUsed } = await supabaseAdmin
    .from("x_content_pool")
    .select("ticker")
    .gte("used_at", sinceIso);
  const excluded = new Set((recentlyUsed ?? []).map((r: any) => r.ticker));

  const rows: {
    source: "top100" | "swing" | "trend";
    ticker: string;
    company: string | null;
    sector: string | null;
    theme: string | null;
    priority: number;
  }[] = [];

  // Top100
  const { data: top100 } = await supabaseAdmin
    .from("top100_snapshot")
    .select("ticker, change_pct")
    .order("change_pct", { ascending: false })
    .limit(50);
  const top100Tickers = (top100 ?? []).map((t) => t.ticker);
  const { data: top100Meta } = top100Tickers.length
    ? await supabaseAdmin.from("top100_tickers").select("ticker, company, sector").in("ticker", top100Tickers)
    : { data: [] as { ticker: string; company: string | null; sector: string | null }[] };
  const metaByTicker = new Map((top100Meta ?? []).map((m) => [m.ticker, m]));
  for (const t of top100 ?? []) {
    if (rows.filter((r) => r.source === "top100").length >= countTop100) break;
    if (excluded.has(t.ticker)) continue;
    const meta = metaByTicker.get(t.ticker);
    rows.push({ source: "top100", ticker: t.ticker, company: meta?.company ?? null, sector: meta?.sector ?? null, theme: null, priority: 0 });
  }

  // Swing
  try {
    const swing = await getSwingAllPicks();
    const picks: any[] = Array.isArray(swing) ? swing : swing?.picks ?? [];
    for (const p of picks) {
      if (rows.filter((r) => r.source === "swing").length >= countSwing) break;
      if (!p.ticker || excluded.has(p.ticker)) continue;
      rows.push({ source: "swing", ticker: p.ticker, company: p.company ?? null, sector: p.sector ?? null, theme: null, priority: 1 });
    }
  } catch (e: any) {
    console.error("[x/pool] swing fetch failed:", e?.message);
  }

  // Trend
  const shuffledThemes = [...HOT_THEMES_2026].sort(() => Math.random() - 0.5);
  outer: for (const theme of shuffledThemes) {
    for (const s of theme.stocks) {
      if (rows.filter((r) => r.source === "trend").length >= countTrend) break outer;
      if (excluded.has(s.ticker)) continue;
      rows.push({ source: "trend", ticker: s.ticker, company: s.company, sector: null, theme: theme.title, priority: 0 });
    }
  }

  if (rows.length === 0) {
    return NextResponse.json({ inserted: 0 });
  }

  const { error } = await supabaseAdmin.from("x_content_pool").insert(rows);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ inserted: rows.length });
}
