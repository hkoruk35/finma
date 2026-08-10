import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * POST /api/refresh-top100
 * 1. Syncs the 'fixed' composition from the /tracker admin list (shared_store.tracker_v1) —
 *    no cap, every tracker ticker is mirrored 1:1 into top100_tickers/top100_snapshot.
 *    Same engine (computeTop100Snapshot) the nightly job (update_top100_fixed.py) uses.
 * 2. Refreshes prices for 'swing_daily' tickers via /api/watchlist-data (cheap, no recompute).
 * Authorization: User must be authenticated (member area only)
 */

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://bogastock.com";

async function syncFixedFromTracker(): Promise<void> {
  const { data: storeRow } = await supabaseAdmin
    .from("shared_store")
    .select("value")
    .eq("key", "tracker_v1")
    .single();

  const trackerTickers: string[] = Array.from(new Set(storeRow?.value?.tickers ?? []));
  if (trackerTickers.length === 0 || !process.env.REVALIDATE_SECRET) return;

  try {
    await fetch(`${BASE_URL}/api/internal/top100-sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-revalidate-secret": process.env.REVALIDATE_SECRET },
      body: JSON.stringify({ tickers: trackerTickers, source: "fixed" }),
      signal: AbortSignal.timeout(120000),
    });
  } catch (err) {
    console.error("syncFixedFromTracker error:", err);
  }
}

async function getTopicsToUpdate(
  // Çağıran hangi istemciye karar verdiyse onu kullan — cron yolunda burada
  // ikinci kez çerez-bağımlı bir istemci kurmak, ileride top100_tickers'ın
  // RLS'i sıkılaştığında listeyi sessizce boş döndürürdü.
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>> | typeof supabaseAdmin
): Promise<string[]> {
  // Get top100_tickers marked as active, excluding 'fixed' (already fully recomputed above)
  const { data: tickers, error } = await supabase
    .from("top100_tickers")
    .select("ticker")
    .eq("active", true)
    .neq("source", "fixed");

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
    // Vercel Cron (/api/cron/refresh-top100) bu endpoint'i çerezsiz çağırır.
    // Upsert normalde oturum çerezine bağlı istemciyle yapılıyor ve RLS
    // tarafından engelleniyordu: syncFixedFromTracker() servis anahtarıyla
    // 100 satırı tazeliyor, hemen ardından swing_daily upsert'i patlayıp tüm
    // istek 500 dönüyordu. Bu yüzden top100_snapshot'ın swing_daily kısmı
    // 2026-06-26'da kalmıştı. Cron'dan gelen istek CRON_SECRET ile
    // doğrulandığında servis anahtarlı istemciyi kullanıyoruz; tarayıcıdaki
    // "YENİLE" butonunun üye yolu aynen RLS'e tabi kalmaya devam ediyor.
    const isCron =
      !!process.env.CRON_SECRET &&
      req.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`;

    const supabase = isCron ? supabaseAdmin : await createSupabaseServerClient();

    // Sync 'fixed' composition (full tracker list, no cap) — same engine as nightly job
    await syncFixedFromTracker();

    // Get remaining tickers (swing_daily) to refresh with lightweight live data
    const tickers = await getTopicsToUpdate(supabase);
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
