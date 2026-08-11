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

const VALID_SOURCES = new Set([
  "top100", "swing", "trend", "manual",
  "watchlist", "sector", "index", "commodity", "fx", "crypto",
]);

const VALID_LOCALES = new Set(["en", "es", "fr", "pt", "tr", "id"]);

async function fetchTickerMeta(ticker: string): Promise<{ company: string | null; sector: string | null }> {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://bogastock.com";
  try {
    const res = await fetch(`${base}/api/watchlist-data?tickers=${encodeURIComponent(ticker)}`, { cache: "no-store" });
    if (!res.ok) return { company: null, sector: null };
    const arr = await res.json();
    const item = Array.isArray(arr) ? arr[0] : null;
    return { company: item?.company ?? null, sector: item?.sector ?? null };
  } catch {
    return { company: null, sector: null };
  }
}

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

  // "Listeden Seç" toplu ekleme: { "items": [...], "weekly"?: boolean, "locale"?: "en"|"es"|"fr"|"pt"|"tr" }.
  // Kullanıcının Top100/Trend/Trend Adayları veya Terminal ana sayfasındaki
  // sektör/endeks/emtia/döviz/kripto listelerinden işaretleyip gönderdiği
  // seçim — tek ticker eklemeyle aynı öncelikte (priority=2) kuyruğun
  // başına girer, zaten bekleyen ticker'lar sessizce atlanır. weekly/locale
  // tüm seçilen öğelere aynı şekilde uygulanır — admin bunu ekleme anında
  // seçer, her öğeyi ayrı ayrı tekrar ayarlamasına gerek kalmaz.
  if (Array.isArray(body.items) && body.items.length > 0) {
    const incoming = body.items as { ticker: string; source?: string; company?: string | null; sector?: string | null }[];
    const weekly = !!body.weekly;
    const locale = VALID_LOCALES.has(body.locale) ? body.locale : null;
    const rows: { source: string; ticker: string; company: string | null; sector: string | null; theme: string | null; priority: number; weekly: boolean; locale: string | null }[] = [];
    const skipped: string[] = [];

    for (const it of incoming) {
      const ticker = String(it.ticker || "").trim().toUpperCase();
      if (!ticker) continue;
      const source = it.source && VALID_SOURCES.has(it.source) ? it.source : "manual";

      const { data: existing } = await supabaseAdmin
        .from("x_content_pool")
        .select("id")
        .eq("ticker", ticker)
        .is("used_at", null)
        .maybeSingle();
      if (existing) {
        skipped.push(ticker);
        continue;
      }
      rows.push({ source, ticker, company: it.company ?? null, sector: it.sector ?? null, theme: null, priority: 2, weekly, locale });
    }

    if (rows.length === 0) {
      return NextResponse.json({ inserted: 0, skipped });
    }
    const { error } = await supabaseAdmin.from("x_content_pool").insert(rows);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ inserted: rows.length, skipped });
  }

  // Tek ticker manuel ekleme: { "ticker": "AAPL" }. Kullanıcı sırayla ekledikçe
  // priority=2 ile en üste (top100/trend=0, swing=1'in önüne) yerleşir, böylece
  // otomasyon kendi eklediklerini, eklediği sırayla (added_at) önce işler.
  if (typeof body.ticker === "string" && body.ticker.trim()) {
    const ticker = body.ticker.trim().toUpperCase();

    const { data: existing } = await supabaseAdmin
      .from("x_content_pool")
      .select("id")
      .eq("ticker", ticker)
      .is("used_at", null)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ error: `${ticker} zaten kuyrukta bekliyor` }, { status: 409 });
    }

    const meta = await fetchTickerMeta(ticker);
    const { error } = await supabaseAdmin.from("x_content_pool").insert({
      source: "manual",
      ticker,
      company: meta.company,
      sector: meta.sector,
      theme: null,
      priority: 2,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ inserted: 1, ticker });
  }

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
