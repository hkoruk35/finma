/**
 * Server-only helpers for the post-login home page (/global/{locale}/home).
 * Pulls the same live data sources as /swing, /trend, /top100 and ranks by volume.
 */
import { getSwingAllPicks } from "./data";
import { HOT_THEMES_2026 } from "./hotThemes2026";
import { createSupabaseServerClient } from "./supabase-server";

export interface HomeStock {
  ticker: string;
  sector: string;
  price: number;
  change_pct: number;
}

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://bogastock.com";

async function fetchLiveQuotes(tickers: string[]): Promise<Record<string, any>> {
  if (tickers.length === 0) return {};
  try {
    const res = await fetch(`${BASE_URL}/api/watchlist-data?tickers=${tickers.join(",")}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return {};
    const rows: any[] = await res.json();
    const map: Record<string, any> = {};
    rows.forEach((r) => { if (r?.ticker) map[r.ticker] = r; });
    return map;
  } catch {
    return {};
  }
}

export async function getTopSwingByVolume(limit = 5): Promise<HomeStock[]> {
  const swingData = await getSwingAllPicks();
  const picks: any[] = swingData?.picks ?? [];
  if (picks.length === 0) return [];

  const live = await fetchLiveQuotes(picks.map((p) => p.ticker));

  return picks
    .map((p) => {
      const l = live[p.ticker];
      return {
        ticker: p.ticker,
        sector: l?.sector || p.sector || "—",
        price: l?.price?.current ?? p.current_price ?? 0,
        change_pct: l?.price?.change_pct ?? p.change_1d ?? 0,
        volume: l?.price?.volume ?? 0,
      };
    })
    .sort((a, b) => b.volume - a.volume)
    .slice(0, limit)
    .map(({ ticker, sector, price, change_pct }) => ({ ticker, sector, price, change_pct }));
}

export async function getTopTrendByVolume(limit = 5): Promise<HomeStock[]> {
  const tickers = HOT_THEMES_2026.flatMap((theme) => theme.stocks.map((s) => s.ticker));
  if (tickers.length === 0) return [];

  const live = await fetchLiveQuotes(tickers);

  return tickers
    .map((ticker) => {
      const l = live[ticker];
      return {
        ticker,
        sector: l?.sector || "—",
        price: l?.price?.current ?? 0,
        change_pct: l?.price?.change_pct ?? 0,
        volume: l?.price?.volume ?? 0,
      };
    })
    .filter((s) => s.price > 0)
    .sort((a, b) => b.volume - a.volume)
    .slice(0, limit)
    .map(({ ticker, sector, price, change_pct }) => ({ ticker, sector, price, change_pct }));
}

export async function getTopTop100ByVolume(limit = 5): Promise<HomeStock[]> {
  const supabase = await createSupabaseServerClient();

  const { data: tickers } = await supabase
    .from("top100_tickers")
    .select("ticker, sector")
    .eq("active", true);

  if (!tickers || tickers.length === 0) return [];

  const { data: snapshots } = await supabase
    .from("top100_snapshot")
    .select("ticker, price, volume, change_pct");

  const snapByTicker = new Map((snapshots ?? []).map((s) => [s.ticker, s]));

  return tickers
    .map((t) => {
      const s = snapByTicker.get(t.ticker);
      return {
        ticker: t.ticker,
        sector: t.sector || "—",
        price: s?.price ?? 0,
        change_pct: s?.change_pct ?? 0,
        volume: s?.volume ?? 0,
      };
    })
    .sort((a, b) => b.volume - a.volume)
    .slice(0, limit)
    .map(({ ticker, sector, price, change_pct }) => ({ ticker, sector, price, change_pct }));
}
