/**
 * Server-only helpers for the post-login home page (/global/{locale}/home).
 * Pulls the same live data sources as /swing, /trend, /top100 and ranks by volume.
 * Everything here goes through fetch() with an hourly revalidate so the page
 * can be served as ISR and update on the hour during market days.
 */
import { getSwingPicksBackfilled, getMasterData, getWatchlistPicks, getSwingPerformance, type StockQuickView } from "./data";
import { HOT_THEMES_2026 } from "./hotThemes2026";
import { selectHeatMapTickers } from "./sectorHeatMap";
import { translateSector } from "./translationHelpers";
import type { Locale } from "./i18n/copy";

export type TrendStatus = "BULLISH" | "BEARISH" | "NEUTRAL";

export interface HomeStock {
  ticker: string;
  sector: string;
  status: TrendStatus;
  price: number;
  change_pct: number;
  sparkline: number[];
}

function normalizeStatus(emaStatus: string | undefined): TrendStatus {
  if (emaStatus === "Bullish" || emaStatus === "Yükseliş") return "BULLISH";
  if (emaStatus === "Bearish" || emaStatus === "Düşüş") return "BEARISH";
  return "NEUTRAL";
}

const CACHE_TIME = 120; // 2 minutes
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://bogastock.com";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// Diger canli-fiyat tuketicilerinde (admin/stocks kategori/sektor sayfalari
// gibi) de tekrar kullanilabilsin diye export edilir — tek bir fiyat
// kaynagi (bu fonksiyon) ile tutarlilik saglamanin anahtari budur.
export async function fetchLiveQuotes(tickers: string[]): Promise<Record<string, any>> {
  if (tickers.length === 0) return {};
  try {
    const res = await fetch(`${BASE_URL}/api/watchlist-data?tickers=${tickers.join(",")}`, {
      next: { revalidate: CACHE_TIME },
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
      next: { revalidate: CACHE_TIME },
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function getTopSwingByVolume(limit = 5): Promise<HomeStock[]> {
  // Home sayfası 1. sütun: en yüksek BOGA skoruna sahip ilk 5 swing adayı.
  const swingData = await getSwingPicksBackfilled();
  const picks: any[] = swingData?.picks ?? [];
  if (picks.length === 0) return [];

  const topByScore = [...picks]
    .sort((a, b) => (b.score ?? b.boga_score ?? 0) - (a.score ?? a.boga_score ?? 0))
    .slice(0, limit);

  const live = await fetchLiveQuotes(topByScore.map((p) => p.ticker));

  return topByScore
    .map((p) => {
      const l = live[p.ticker];
      return {
        ticker: p.ticker,
        sector: l?.sector || p.sector || "—",
        status: normalizeStatus(l?.tracker_1h?.ema_status),
        price: l?.price?.current ?? p.current_price ?? 0,
        change_pct: l?.price?.change_pct ?? p.change_1d ?? 0,
        sparkline: l?.recent_closes ?? [],
      };
    });
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
        sparkline: l?.recent_closes ?? [],
        volume: l?.price?.volume ?? 0,
      };
    })
    .filter((s) => s.price > 0)
    .sort((a, b) => b.volume - a.volume)
    .slice(0, limit)
    .map(({ ticker, sector, status, price, change_pct, sparkline }) => ({ ticker, sector, status, price, change_pct, sparkline }));
}

// Top 7'nin standart, sabit bileşimi — "sadece zamanlama ile veriler
// güncellensin" kararı: BOGA Copilot da (stockData.ts) AYNI listeyi kullanır.
export const MAGNIFICENT_7 = ["NVDA", "AAPL", "MSFT", "AMZN", "GOOGL", "META", "TSLA"];

export async function getTopWatchlistByVolume(limit = 5): Promise<HomeStock[]> {
  // Home sayfası 2. sütun (İzleme Listesi): Terminal 7 Büyük hisselerinden 5 tanesi
  const tickers = MAGNIFICENT_7.slice(0, limit);
  const live = await fetchLiveQuotes(tickers);

  return tickers.map((ticker) => {
    const l = live[ticker];
    return {
      ticker,
      sector: l?.sector && l.sector !== "Unknown" ? l.sector : "Technology",
      status: normalizeStatus(l?.tracker_1h?.ema_status),
      price: l?.price?.current ?? 0,
      change_pct: l?.price?.change_pct ?? 0,
      sparkline: l?.recent_closes ?? [],
    };
  });
}

// Home sayfası 3. sütun (Performance): son 60 gün içinde giriş yapılmış
// (buy zone yakalayıp swing_performance.json'a geçmiş) işlemler arasından
// en yüksek kâr oranını (return_pct) yakalayan ilk 5. Stock.sector alanı
// gün sayısı etiketine ("4g"/"4d"), Stock.change_pct alanı toplam getiri
// yüzdesine map edilir — HomeSimpleCard aynen yeniden kullanılır, mobil
// tasarım hiç değişmez.
const PERFORMANCE_WINDOW_DAYS = 60;

export async function getTopPerformanceEntries(limit = 5, locale: string = "en"): Promise<HomeStock[]> {
  const perf = await getSwingPerformance();
  const history: any[] = perf?.history ?? [];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - PERFORMANCE_WINDOW_DAYS);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const topGainers = history
    .filter((t) => t?.ticker && !t?.is_duplicate && t?.date && t.date >= cutoffStr)
    .sort((a, b) => (b?.return_pct ?? 0) - (a?.return_pct ?? 0))
    .slice(0, limit);

  const dayLabel = (days: number) => {
    if (locale === "tr") return `${days}g`;
    if (locale === "es" || locale === "fr" || locale === "pt") return `${days}j`;
    return `${days}d`;
  };

  return topGainers.map((t) => ({
    ticker: t.ticker,
    sector: `${translateSector(t.sector, locale as Locale) || "—"} · ${dayLabel(t.days ?? 0)}`,
    status: (t.return_pct ?? 0) >= 0 ? "BULLISH" : "BEARISH",
    price: t.entry ?? 0,
    change_pct: t.return_pct ?? 0,
    sparkline: [],
  }));
}

export async function getTopTop100ByVolume(limit = 5): Promise<HomeStock[]> {
  const tickers = await supabaseSelect("top100_tickers", "select=ticker,sector&active=eq.true");
  if (tickers.length === 0) return [];

  const snapshots = await supabaseSelect("top100_snapshot", "select=ticker,price,volume,change_pct");
  const snapByTicker = new Map(snapshots.map((s) => [s.ticker, s]));

  const live = await fetchLiveQuotes(tickers.map((t) => t.ticker));

  const top = tickers
    .map((t) => {
      const s = snapByTicker.get(t.ticker);
      const l = live[t.ticker];
      return {
        ticker: t.ticker,
        sector: l?.sector && l.sector !== "Unknown" ? l.sector : (t.sector || "—"),
        status: normalizeStatus(l?.tracker_1h?.ema_status),
        price: l?.price?.current ?? s?.price ?? 0,
        change_pct: l?.price?.change_pct ?? s?.change_pct ?? 0,
        volume: l?.price?.volume ?? s?.volume ?? 0,
        sparkline: l?.recent_closes ?? [],
      };
    })
    .sort((a, b) => b.volume - a.volume)
    .slice(0, limit);

  return top.map(({ ticker, sector, status, price, change_pct, sparkline }) => ({
    ticker,
    sector,
    status,
    price,
    change_pct,
    sparkline,
  }));
}

export async function getAllTop100Tickers(limit = 100): Promise<HomeStock[]> {
  const tickers = await supabaseSelect("top100_tickers", "select=ticker,sector&active=eq.true");
  if (tickers.length === 0) return [];

  const snapshots = await supabaseSelect("top100_snapshot", "select=ticker,price,volume,change_pct");
  const snapByTicker = new Map(snapshots.map((s) => [s.ticker, s]));

  const all = tickers
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

  const live = await fetchLiveQuotes(all.map((t) => t.ticker));
  return all.map(({ ticker, sector, price, change_pct }) => ({
    ticker,
    sector: live[ticker]?.sector && live[ticker].sector !== "Unknown" ? live[ticker].sector : sector,
    status: normalizeStatus(live[ticker]?.tracker_1h?.ema_status),
    price: live[ticker]?.price?.current ?? price,
    change_pct: live[ticker]?.price?.change_pct ?? change_pct,
    sparkline: live[ticker]?.recent_closes ?? [],
  }));
}

export async function getLastUpdated(): Promise<string> {
  // Trend Stocks and Top 100 update hourly via ISR revalidation.
  // Use the page build time (new Date()) as the authoritative "last updated"
  // since it always reflects the most recent data fetch across all three tables.
  const master = await getMasterData();
  const swingTime = master?.generated_at ? new Date(master.generated_at).getTime() : 0;
  const now = Date.now();
  const latest = new Date(Math.max(swingTime, now));
  return latest.toLocaleString("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Sector Heat Map, taze olabilecegi garanti edilmeyen statik kaynaklardan
// (all_tickers_list.json, swing_performance.json, options JSON'lari) derlenen
// change_pct degerleriyle geliyordu — ayni sayfadaki Swing/Trend/Top100
// panelleri canli veri kullanirken, ayni ticker Heat Map'te farkli bir
// degisim% gosterebiliyordu. Sadece fiilen gosterilecek ticker'lar
// (selectHeatMapTickers ile ayni sektor-basi-N secimi) icin canli veri
// cekip change_pct'i overlay ediyoruz — binlerce ticker'in tamamini degil.
export async function overlayHeatMapChangePct(allTickers: StockQuickView[]): Promise<StockQuickView[]> {
  const candidates = selectHeatMapTickers(allTickers);
  if (candidates.length === 0) return allTickers;

  const live = await fetchLiveQuotes(candidates.map((t) => t.ticker));
  if (Object.keys(live).length === 0) return allTickers;

  return allTickers.map((t) => {
    const changePct = live[t.ticker]?.price?.change_pct;
    return changePct != null ? { ...t, change_pct: changePct } : t;
  });
}

const INDEX_TICKERS: Record<string, string> = {
  SP500: "^GSPC",
  NASDAQ: "^IXIC",
  DOW: "^DJI",
  RUSSELL: "^RUT",
  VIX: "^VIX",
};

export async function getLiveIndices(): Promise<Record<string, { value: number; change_pct: number }>> {
  const symbols = Object.values(INDEX_TICKERS).join(",");
  try {
    const res = await fetch(`${BASE_URL}/api/quote?tickers=${encodeURIComponent(symbols)}`, {
      next: { revalidate: CACHE_TIME },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return {};
    const data: Record<string, { price: number | null; change_1d: number | null }> = await res.json();

    const out: Record<string, { value: number; change_pct: number }> = {};
    for (const [label, symbol] of Object.entries(INDEX_TICKERS)) {
      const q = data[symbol];
      if (q?.price != null) {
        out[label] = { value: q.price, change_pct: q.change_1d ?? 0 };
      }
    }
    return out;
  } catch {
    return {};
  }
}
