import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

/**
 * POST /api/refresh-top100
 * Refresh top100_snapshot table with live data from /api/watchlist-data
 * Authorization: User must be authenticated (member area only)
 */

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://bogastock.com";

async function getTopicsToUpdate(): Promise<string[]> {
  // Get top100_tickers marked as active
  const supabase = await createSupabaseServerClient();
  const { data: tickers, error } = await supabase
    .from("top100_tickers")
    .select("ticker")
    .eq("active", true);

  if (error || !tickers) return [];
  return tickers.map((t) => t.ticker);
}

async function fetchLiveData(tickers: string[]) {
  if (tickers.length === 0) return {};

  const map: Record<string, any> = {};
  const BATCH_SIZE = 50; // Fetch 50 at a time to avoid URL length limits

  try {
    // Process in batches
    for (let i = 0; i < tickers.length; i += BATCH_SIZE) {
      const batch = tickers.slice(i, i + BATCH_SIZE);
      const res = await fetch(
        `${BASE_URL}/api/watchlist-data?tickers=${batch.join(",")}`,
        { signal: AbortSignal.timeout(30000) }
      );
      if (!res.ok) continue;
      const data: any[] = await res.json();
      data.forEach((d) => {
        if (d?.ticker) map[d.ticker] = d;
      });
    }
    return map;
  } catch {
    return {};
  }
}

export async function POST(req: NextRequest) {
  try {
    // Verify authorization (member only)
    const supabase = await createSupabaseServerClient();
    const { data: user, error: authError } = await supabase.auth.getUser();

    if (authError || !user.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get tickers to update
    const tickers = await getTopicsToUpdate();
    if (tickers.length === 0) {
      return NextResponse.json({ updated: 0 });
    }

    // Fetch live data
    const liveData = await fetchLiveData(tickers);

    // Prepare updates
    const now = new Date().toISOString();
    const updates = tickers.map((ticker) => {
      const live = liveData[ticker];
      return {
        ticker,
        price: live?.price?.current ?? null,
        volume: live?.price?.volume ?? null,
        change_pct: live?.price?.change_pct ?? null,
        ema20: live?.tracker_1h?.ema_20 ?? null,
        ema50: live?.tracker_1h?.ema_50 ?? null,
        ema200: live?.tracker_1h?.ema_200 ?? null,
        rsi: live?.tracker_1h?.rsi ?? null,
        macd: null, // Not available in live data
        adx: null,  // Not available in live data
        pattern: live?.tracker_1h?.candle_pattern ?? null,
        signal: live?.tracker_1h?.signal ?? null,
        character: live?.tracker_1h?.signal === "AL" ? "swing" : "investment",
        updated_at: now,
      };
    });

    // Upsert into top100_snapshot
    const { error: upsertError, data } = await supabase
      .from("top100_snapshot")
      .upsert(updates, { onConflict: "ticker" });

    if (upsertError) {
      console.error("Upsert error:", upsertError);
      return NextResponse.json({ error: "Failed to update snapshot" }, { status: 500 });
    }

    return NextResponse.json({
      updated: updates.length,
      tickers: tickers.slice(0, 5), // Return first 5 for logging
      timestamp: now,
    });
  } catch (error) {
    console.error("Refresh top100 error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
