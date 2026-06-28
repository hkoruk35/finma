/**
 * Server-only helpers for the post-login home page (/global/{locale}/home).
 * Pulls the same live data sources as /swing, /trend, /top100 and ranks by volume.
 * Everything here goes through fetch() with an hourly revalidate so the page
 * can be served as ISR and update on the hour during market days.
 */
import { getSwingAllPicks, getMasterData } from "./data";
import { HOT_THEMES_2026 } from "./hotThemes2026";

export type TrendStatus = "BULLISH" | "BEARISH" | "NEUTRAL";

export interface HomeStock {
  ticker: string;
  sector: string;
  status: TrendStatus;
  price: number;
  change_pct: number;
}

function normalizeStatus(emaStatus: string | undefined): TrendStatus {
  if (emaStatus === "Bullish" || emaStatus === "Yükseliş") return "BULLISH";
  if (emaStatus === "Bearish" || emaStatus === "Düşüş") return "BEARISH";
  return "NEUTRAL";
}

const HOUR = 3600;
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://bogastock.com";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

async function fetchLiveQuotes(tickers: string[]): Promise<Record<string, any>> {
  if (tickers.length === 0) return {};
  try {
    const res = await fetch(`${BASE_URL}/api/watchlist-data?tickers=${tickers.join(",")}`, {
      next: { revalidate: HOUR },
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

async function supabaseSelect(table: string, query: string): Promise<any[]> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return [];
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      next: { revalidate: HOUR },
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
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
        status: normalizeStatus(l?.tracker_1h?.ema_status),
        price: l?.price?.current ?? p.current_price ?? 0,
        change_pct: l?.price?.change_pct ?? p.change_1d ?? 0,
        volume: l?.price?.volume ?? 0,
      };
    })
    .sort((a, b) => b.volume - a.volume)
    .slice(0, limit)
    .map(({ ticker, sector, status, price, change_pct }) => ({ ticker, sector, status, price, change_pct }));
}

export async function getTopTrendByVolume(limit = 5): Promise<HomeStock[]> {
  const allTickers = HOT_THEMES_2026.flatMap((theme) => theme.stocks.map((s) => s.ticker));
  const tickers = [...new Set(allTickers)];
  if (tickers.length === 0) return [];

  const live = await fetchLiveQuotes(tickers);

  return tickers
    .map((ticker) => {
      const l = live[ticker];
      return {
        ticker,
        sector: l?.sector || "—",
        status: normalizeStatus(l?.tracker_1h?.ema_status),
        price: l?.price?.current ?? 0,
        change_pct: l?.price?.change_pct ?? 0,
        volume: l?.price?.volume ?? 0,
      };
    })
    .filter((s) => s.price > 0)
    .sort((a, b) => b.volume - a.volume)
    .slice(0, limit)
    .map(({ ticker, sector, status, price, change_pct }) => ({ ticker, sector, status, price, change_pct }));
}

export async function getTopTop100ByVolume(limit = 5): Promise<HomeStock[]> {
  const tickers = await supabaseSelect("top100_tickers", "select=ticker,sector&active=eq.true");
  if (tickers.length === 0) return [];

  const snapshots = await supabaseSelect("top100_snapshot", "select=ticker,price,volume,change_pct");
  const snapByTicker = new Map(snapshots.map((s) => [s.ticker, s]));

  const top = tickers
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
    .slice(0, limit);

  // top100_tickers.sector is often a placeholder ("Other") — overlay the real
  // sector (and trend status, which isn't in Supabase at all) from live data
  // for just this shortlist instead of the full 100.
  const live = await fetchLiveQuotes(top.map((t) => t.ticker));
  return top.map(({ ticker, sector, price, change_pct }) => ({
    ticker,
    sector: live[ticker]?.sector && live[ticker].sector !== "Unknown" ? live[ticker].sector : sector,
    status: normalizeStatus(live[ticker]?.tracker_1h?.ema_status),
    price,
    change_pct,
  }));
}

export async function getLastUpdated(): Promise<string> {
  const master = await getMasterData();
  if (!master?.generated_at) return "";
  return new Date(master.generated_at).toLocaleString("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
  });
}
