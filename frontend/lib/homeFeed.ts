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
import { SUPABASE_TIMEOUT_MS } from "./supabaseFetch";
import { GET as getWatchlistData } from "@/app/api/watchlist-data/route";
import { NextRequest } from "next/server";
import { getDailyOnePicks } from "./dailyOnePick";

export interface FeaturedTrendStock {
  ticker: string;
  company: string;
  sector: string;
  score: number;
  price: number;
  change_pct: number;
  change_pct_1w: number | null;
  change_pct_1m: number | null;
  change_pct_1y: number | null;
  change_pct_5y: number | null;
  sparkline: number[];
  targetPct: number;
  entryLow: number;
  entryHigh: number;
  riskReward: number;
  selectionReasons: string[];
  summary: string | null;
}

// Çoklu-dilli ai_summary objesi ise sadece o dilde gercek metin varsa gosterir
// (Turkce metni baska dile sizdirmamak icin) — string/eski format ise sadece
// TR sayfasinda dusuyor (kaynak veri Turkce yazilmis).
function resolveFeaturedSummary(rawPick: any, locale: Locale): string | null {
  const s = rawPick?.ai_summary;
  if (s && typeof s === "object") return typeof s[locale] === "string" && s[locale].trim() ? s[locale] : null;
  if (locale !== "tr") return null;
  if (typeof s === "string" && s.trim()) return s;
  return rawPick?.detail_reasoning || rawPick?.reasoning || null;
}

/**
 * Ana sayfada eski Nasdaq 100 sutununun yerine gecen "Gunun Trend
 * Hisselerinden" karti icin veri: getDailyOnePicks()'in zaten hacim-agirlikli
 * formationScore'a gore siraladigi en iyi adayi (picks[0]) alir, haftalik/
 * aylik/yillik/5 yillik degisim oranlari ve sparkline icin swing_all_picks
 * ham verisiyle ve canli watchlist-data ile zenginlestirir.
 */
export async function getFeaturedTrendCardData(locale: Locale): Promise<FeaturedTrendStock | null> {
  const [dailyOnePicks, swingData] = await Promise.all([
    getDailyOnePicks(),
    getSwingPicksBackfilled(30),
  ]);
  const top = dailyOnePicks?.[0];
  if (!top) return null;

  const rawPicks: any[] = swingData?.picks ?? [];
  const raw = rawPicks.find((p) => p?.ticker === top.ticker) ?? null;

  let live: any = null;
  try {
    const req = new NextRequest(new URL(`http://localhost/api?tickers=${top.ticker}`));
    const res = await getWatchlistData(req);
    const rows = await res.json();
    live = Array.isArray(rows) ? rows[0] : null;
  } catch {
    live = null;
  }

  return {
    ticker: top.ticker,
    company: top.company,
    sector: live?.sector ?? top.sector ?? raw?.sector ?? "",
    score: top.score,
    price: live?.price?.current ?? top.currentPrice ?? 0,
    change_pct: live?.tracker_1h?.change_pct_1d ?? live?.price?.change_pct ?? raw?.change_1d ?? 0,
    change_pct_1w: typeof raw?.change_1w === "number" ? raw.change_1w : null,
    change_pct_1m: typeof raw?.change_1m === "number" ? raw.change_1m : null,
    change_pct_1y: typeof raw?.change_1y === "number" ? raw.change_1y : null,
    change_pct_5y: typeof raw?.change_5y === "number" ? raw.change_5y : null,
    sparkline: live?.recent_closes ?? [],
    targetPct: top.targetPct,
    entryLow: top.entryLow,
    entryHigh: top.entryHigh,
    riskReward: top.riskReward,
    selectionReasons: top.selectionReasons ?? [],
    summary: resolveFeaturedSummary(raw, locale),
  };
}

export async function getTrendStocksServerData() {
  const data = await getSwingPicksBackfilled(10);
  const picks = data?.picks ?? [];
  if (picks.length === 0) return [];
  const tickers = picks.map((p: any) => p.ticker).join(",");
  const req = new NextRequest(new URL(`http://localhost/api?tickers=${tickers}`));
  const res = await getWatchlistData(req);
  const liveRows = await res.json();
  const liveMap: Record<string, any> = {};
  liveRows.forEach((item: any) => { if (item?.ticker) liveMap[item.ticker] = item; });
  return picks.slice(0, 7).map((p: any) => {
    const d = liveMap[p.ticker];
    const signal = d?.tracker_1h?.signal;
    const status = signal === 'STRONG' ? 'BULLISH' : signal === 'WEAK' ? 'BEARISH' : 'NEUTRAL';
    return {
      ticker: p.ticker,
      sector: d?.sector ?? p.sector ?? '',
      status,
      price: d?.price?.current ?? p.current_price ?? 0,
      change_pct: d?.tracker_1h?.change_pct_1d ?? d?.price?.change_pct ?? 0,
      sparkline: d?.recent_closes ?? [],
    };
  });
}

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

const CACHE_TIME = 900; // 15 minutes — canli veri baglantisini gevsetip Supabase/self-fetch yukunu azaltir (bkz. 2026-08-08 stabilite fix)
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://bogastock.com";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// Diger canli-fiyat tuketicilerinde (admin/stocks kategori/sektor sayfalari
// gibi) de tekrar kullanilabilsin diye export edilir — tek bir fiyat
// kaynagi (bu fonksiyon) ile tutarlilik saglamanin anahtari budur.
export async function fetchLiveQuotes(tickers: string[]): Promise<Record<string, any>> {
  if (tickers.length === 0) return {};
  try {
    const res = await fetch(`${BASE_URL}/api/watchlist-data?cb=1&tickers=${tickers.join(",")}`, {
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
      // DB düştüğünde bu çağrı süresiz askıda kalıp sayfayı/build'i kilitliyordu
      // (bkz. lib/supabaseFetch.ts).
      signal: AbortSignal.timeout(SUPABASE_TIMEOUT_MS),
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
    if (locale === "id") return `${days}h`;
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
    const res = await fetch(`${BASE_URL}/api/quote?cb=1&tickers=${encodeURIComponent(symbols)}`, {
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

/**
 * Herhangi bir ticker listesi için tek seferde fiyat + günlük değişim.
 * getLiveIndices()'in genelleştirilmiş hali — anonim ana sayfadaki 5 yeni
 * varlık sınıfı bölümü (endeks/sektör/FX/emtia/kripto) burayı kullanır.
 * Anahtarlar `lib/symbols.ts`'teki dostane isimler olabilir (GOLD, EURUSD,
 * VIX...) ya da doğrudan gerçek ticker (XLK, SPY...) — /api/quote zaten
 * resolveYahooSymbol() ile ikisini de çözer.
 */
export async function getMultiQuote(tickers: string[]): Promise<Record<string, { value: number; change_pct: number; recent_closes: number[] }>> {
  if (tickers.length === 0) return {};
  try {
    const res = await fetch(`${BASE_URL}/api/quote?cb=1&tickers=${encodeURIComponent(tickers.join(","))}`, {
      next: { revalidate: CACHE_TIME },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return {};
    const data: Record<string, { price: number | null; change_1d: number | null; recent_closes?: number[] }> = await res.json();

    const out: Record<string, { value: number; change_pct: number; recent_closes: number[] }> = {};
    for (const ticker of tickers) {
      const q = data[ticker.toUpperCase()];
      if (q?.price != null) {
        out[ticker] = { value: q.price, change_pct: q.change_1d ?? 0, recent_closes: q.recent_closes ?? [] };
      }
    }
    return out;
  } catch {
    return {};
  }
}

// Top100 ticker kimliği anonim ziyaretçiden maskelenmesi gereken veri (bkz.
// app/api/top100/route.ts, docs/AI_BEHAVIOR.md Rule 3). Bu dosyadaki diğer
// fonksiyonlar ISR'lı (revalidate=120, tüm ziyaretçiler için ortak cache)
// home sayfasından çağrılıyor — cookie/tier-farkındalı maskeleme burada
// YAPILAMAZ (yapılırsa sayfa istemeden per-request dynamic'e döner ya da
// bir ziyaretçinin tier'ıyla render edilmiş HTML başkasına servis edilir).
//
// Bu yüzden aşağıdaki iki fonksiyon SADECE saf sıralama/türetmedir — Supabase/
// cookie okuma YAPMAZ, zaten çekilmiş veriyi alıp sıralar. Maskeleme onları
// ÇAĞIRAN taraf (bir API route, her zaman per-request) sorumluluğunda:
//   - /api/home-movers (public, tier'a göre maskTop100Ticker uygular)
//   - /api/internal/movers-snapshot (bot-only, maskesiz arşive yazar)
// İki ayrı sıralama kopyası yerine tek kaynak — bkz. docs/AI_BEHAVIOR.md
// Rule 3 cross-cutting principle.
export interface RawMoverRow {
  ticker: string;
  company: string | null;
  sector: string;
  price: number;
  change_pct: number;
  /** Sadece tracker_1h.change_pct_1d mevcutsa dolu — gainers/losers sıralaması bunu kullanır. */
  preciseChange?: number;
  volume: number;
  sparkline: number[];
}

export function buildTop100MoverRows(
  tickers: { ticker: string; company?: string | null; sector?: string | null }[],
  snapshots: { ticker: string; price?: number | null; change_pct?: number | null; volume?: number | null }[],
  live: Record<string, any>
): RawMoverRow[] {
  const snapshotByTicker = new Map(snapshots.map((s) => [s.ticker, s]));
  return tickers
    .map((t) => {
      const l = live[t.ticker];
      const s = snapshotByTicker.get(t.ticker);
      const preciseChange: number | undefined = l?.tracker_1h?.change_pct_1d;
      return {
        ticker: t.ticker,
        company: t.company ?? null,
        sector: (l?.sector && l.sector !== "Unknown" ? l.sector : t.sector) || "—",
        price: l?.price?.current ?? s?.price ?? 0,
        change_pct: preciseChange ?? s?.change_pct ?? 0,
        preciseChange,
        volume: l?.price?.volume ?? s?.volume ?? 0,
        sparkline: l?.recent_closes ?? [],
      } as RawMoverRow;
    })
    .filter((r) => r.price > 0);
}

export interface Top100MoverSlices {
  top100: RawMoverRow[];
  gainers: RawMoverRow[];
  losers: RawMoverRow[];
  mostActive: RawMoverRow[];
}

export function rankTop100Movers(rows: RawMoverRow[], limit: number): Top100MoverSlices {
  const top100 = [...rows].sort((a, b) => b.volume - a.volume).slice(0, limit);

  // Gainers/losers sadece gerçek tracker_1h verisi olan satırlardan türetilir
  // (GlobalLandingPage.tsx'in client-side eşdeğeriyle aynı filtre) — aksi
  // halde canlı veri eksik satırlar 0% olarak sıralamaya sızar.
  const byGainDesc = rows
    .filter((r) => r.preciseChange != null)
    .sort((a, b) => (b.preciseChange as number) - (a.preciseChange as number));
  const gainers = byGainDesc.slice(0, limit);
  const losers = byGainDesc.slice(-limit).reverse();
  const mostActive = [...rows].sort((a, b) => b.volume - a.volume).slice(0, limit);

  return { top100, gainers, losers, mostActive };
}
