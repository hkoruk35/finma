import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { computeTop100Snapshot } from "@/lib/top100-engine";
import { getAllTickers } from "@/lib/data";

function requireAdmin(req: NextRequest): boolean {
  return req.cookies.get("boga_auth")?.value === "admin";
}

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await supabaseAdmin
    .from("top100_tickers")
    .select("id, ticker, company, source, added_by, added_at, active")
    .order("source", { ascending: true })
    .order("ticker", { ascending: true });

  if (error) return NextResponse.json({ error: "Could not load tickers." }, { status: 502 });
  return NextResponse.json({ tickers: data ?? [] });
}

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { ticker?: string; source?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const ticker = body.ticker?.toUpperCase().trim();
  const source = body.source === "swing_daily" ? "swing_daily" : "fixed";
  if (!ticker) return NextResponse.json({ error: "Ticker required." }, { status: 400 });

  const snapshot = await computeTop100Snapshot(ticker);
  if (!snapshot) {
    return NextResponse.json({ error: "Could not fetch market data for this ticker." }, { status: 400 });
  }

  const universe = await getAllTickers();
  const sector = universe.find((u) => u.ticker === ticker)?.sector ?? "Other";

  const { error: tickerError } = await supabaseAdmin
    .from("top100_tickers")
    .upsert({ ticker, company: snapshot.company, sector, source, active: true, added_by: "admin" }, { onConflict: "ticker" });

  if (tickerError) return NextResponse.json({ error: "Could not save ticker." }, { status: 502 });

  const { error: snapshotError } = await supabaseAdmin.from("top100_snapshot").upsert({
    ticker,
    price: snapshot.price,
    volume: snapshot.volume,
    change_pct: snapshot.change_pct,
    ema20: snapshot.ema20,
    ema50: snapshot.ema50,
    ema200: snapshot.ema200,
    rsi: snapshot.rsi,
    macd: snapshot.macd,
    adx: snapshot.adx,
    pattern: snapshot.pattern,
    signal: snapshot.signal,
    character: snapshot.character,
    updated_at: new Date().toISOString(),
  });

  if (snapshotError) return NextResponse.json({ error: "Ticker saved but snapshot failed." }, { status: 207 });

  return NextResponse.json({ ok: true, ticker, snapshot });
}

export async function PATCH(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { ticker?: string; active?: boolean; source?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const ticker = body.ticker?.toUpperCase().trim();
  if (!ticker) return NextResponse.json({ error: "Ticker required." }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (typeof body.active === "boolean") patch.active = body.active;
  if (body.source === "fixed" || body.source === "swing_daily") patch.source = body.source;
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });

  const { error } = await supabaseAdmin.from("top100_tickers").update(patch).eq("ticker", ticker);
  if (error) return NextResponse.json({ error: "Could not update ticker." }, { status: 502 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const ticker = req.nextUrl.searchParams.get("ticker")?.toUpperCase().trim();
  if (!ticker) return NextResponse.json({ error: "Ticker required." }, { status: 400 });

  const { error } = await supabaseAdmin.from("top100_tickers").delete().eq("ticker", ticker);
  if (error) return NextResponse.json({ error: "Could not remove ticker." }, { status: 502 });

  return NextResponse.json({ ok: true });
}
