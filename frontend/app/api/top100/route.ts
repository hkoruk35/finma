import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getMemberAccess, resolveMemberTierFromAccess } from "@/lib/apiAuth";
import { maskTop100Ticker } from "@/lib/publicTeaserTickers";

// Public erişim — in-memory rate limiter (app/api/auth/login/route.ts deseni)
const rlAttempts = new Map<string, { count: number; resetAt: number }>();
const RL_MAX = 120;
const RL_WINDOW_MS = 15 * 60 * 1000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rlAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    rlAttempts.set(ip, { count: 1, resetAt: now + RL_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > RL_MAX;
}

export interface Top100Row {
  ticker: string;
  realTicker: string;
  company: string | null;
  sector: string | null;
  source: "fixed" | "swing_daily";
  price: number | null;
  volume: number | null;
  change_pct: number | null;
  ema20: number | null;
  ema50: number | null;
  ema200: number | null;
  rsi: number | null;
  macd: number | null;
  adx: number | null;
  pattern: string | null;
  signal: string | null;
  character: "investment" | "swing" | null;
  updated_at: string | null;
}

export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: "Too many requests. Please wait a few minutes." }, { status: 429 });
  }

  const supabase = await createSupabaseServerClient();

  const access = await getMemberAccess();
  const tier = resolveMemberTierFromAccess(access);

  const { data: tickers, error: tickersError } = await supabase
    .from("top100_tickers")
    .select("ticker, company, sector, source")
    .eq("active", true)
    .order("id", { ascending: true });

  if (tickersError) {
    return NextResponse.json({ error: "Could not load Top 100 composition." }, { status: 502 });
  }

  const { data: snapshots, error: snapshotError } = await supabase
    .from("top100_snapshot")
    .select("ticker, price, volume, change_pct, ema20, ema50, ema200, rsi, macd, adx, pattern, signal, character, updated_at");

  if (snapshotError) {
    return NextResponse.json({ error: "Could not load Top 100 snapshot." }, { status: 502 });
  }

  const snapshotByTicker = new Map((snapshots ?? []).map((s) => [s.ticker, s]));

  const rows: Top100Row[] = (tickers ?? []).map((t, idx) => {
    const s = snapshotByTicker.get(t.ticker);
    const masked = maskTop100Ticker({ ticker: t.ticker, company: t.company }, idx, tier);
    return {
      ticker: masked.ticker,
      realTicker: t.ticker,
      company: masked.company,
      sector: t.sector,
      source: t.source as "fixed" | "swing_daily",
      price: s?.price ?? null,
      volume: s?.volume ?? null,
      change_pct: s?.change_pct ?? null,
      ema20: s?.ema20 ?? null,
      ema50: s?.ema50 ?? null,
      ema200: s?.ema200 ?? null,
      rsi: s?.rsi ?? null,
      macd: s?.macd ?? null,
      adx: s?.adx ?? null,
      pattern: s?.pattern ?? null,
      signal: s?.signal ?? null,
      character: (s?.character as "investment" | "swing") ?? null,
      updated_at: s?.updated_at ?? null,
    };
  });

  return NextResponse.json({
    rows,
    count: rows.length,
    lastUpdated: rows.reduce<string | null>((latest, r) => {
      if (!r.updated_at) return latest;
      if (!latest || r.updated_at > latest) return r.updated_at;
      return latest;
    }, null),
  });
}
