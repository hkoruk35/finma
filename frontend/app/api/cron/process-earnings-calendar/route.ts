import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUpcomingEarnings } from "@/lib/earnings/yahooCalendar";
import { getTickerCikMap } from "@/lib/earnings/secClient";

export const runtime = "nodejs";
export const maxDuration = 90;

const CRON_SECRET = process.env.CRON_SECRET;
const TICKER_SCAN_LIMIT = 250;
const CONCURRENCY = 10;

async function processTicker(ticker: string, companyNames: Map<string, string>): Promise<{ ticker: string; updated: boolean; error?: string }> {
  try {
    const upcoming = await getUpcomingEarnings(ticker);
    if (!upcoming) return { ticker, updated: false };

    // Geçmişte kalmış (dünkü/eski) tahminler takvimde gösterilmemeli —
    // Yahoo bazen bildirim gerçekleşene kadar eski tarihi döndürmeye devam eder.
    const today = new Date().toISOString().split("T")[0];
    if (upcoming.earningsDate < today) return { ticker, updated: false };

    const { error } = await supabaseAdmin.from("earnings_calendar").upsert(
      {
        ticker: upcoming.ticker,
        company_name: companyNames.get(upcoming.ticker) || null,
        earnings_date: upcoming.earningsDate,
        is_estimate: upcoming.isEstimate,
        eps_estimate: upcoming.epsEstimate,
        revenue_estimate_usd: upcoming.revenueEstimate,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "ticker" }
    );
    if (error) return { ticker, updated: false, error: error.message };
    return { ticker, updated: true };
  } catch (err: any) {
    return { ticker, updated: false, error: err?.message || String(err) };
  }
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let tickers: string[] = [];
  try {
    const raw = await fs.readFile(path.join(process.cwd(), "public", "data", "daily_universe.json"), "utf8");
    tickers = (JSON.parse(raw)?.tickers || []).slice(0, TICKER_SCAN_LIMIT);
  } catch (err: any) {
    return NextResponse.json({ error: `universe read failed: ${err?.message || err}` }, { status: 500 });
  }
  if (tickers.length === 0) {
    return NextResponse.json({ skipped: "empty ticker universe" });
  }

  const cikMap = await getTickerCikMap().catch(() => new Map());
  const companyNames = new Map<string, string>();
  for (const t of tickers) {
    const entry = cikMap.get(t.toUpperCase());
    if (entry) companyNames.set(t.toUpperCase(), entry.title);
  }

  const results: Awaited<ReturnType<typeof processTicker>>[] = [];
  for (let i = 0; i < tickers.length; i += CONCURRENCY) {
    const batch = tickers.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(batch.map((t) => processTicker(t, companyNames)));
    results.push(...batchResults);
  }

  const updatedCount = results.filter((r) => r.updated).length;
  const errors = results.filter((r) => r.error).map((r) => ({ ticker: r.ticker, error: r.error }));

  return NextResponse.json({
    scanned: tickers.length,
    updated: updatedCount,
    errors: errors.slice(0, 20),
  });
}
