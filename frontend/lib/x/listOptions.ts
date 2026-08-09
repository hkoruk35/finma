// X Studio "Listeden Seç" kaynağı — hem sitenin gerçek hisse listelerini
// (Top100/Trend/Trend Adayları) hem de Terminal ana sayfasındaki
// sektör/endeks/emtia/döviz/kripto varlıklarını, canlı fiyat+değişim%
// ile birlikte tarayıp seçime sunar.

import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSwingPicksBackfilled, getWatchlistPicks, getAllTickers } from "@/lib/data";
import { groupBySector } from "@/lib/sectorHeatMap";

export type ListOptionCategory = "top100" | "swing" | "watchlist" | "sector" | "index" | "commodity" | "fx" | "crypto";

export interface ListOptionItem {
  ticker: string;
  label: string; // şirket adı (hisse) veya varlık adı ("Altın", "S&P 500"...)
  sector: string | null;
  price: number | null;
  changePct: number | null;
}

// Terminal ana sayfasının sol/üst barındaki AYNI varlıklar (bkz.
// GraphicDetailContent.tsx INDICES, lib/copilot/crossAssetData.ts KNOWN_ASSETS).
const INDICES: { ticker: string; label: string }[] = [
  { ticker: "^GSPC", label: "S&P 500" },
  { ticker: "^IXIC", label: "NASDAQ" },
  { ticker: "^DJI", label: "DOW" },
  { ticker: "^RUT", label: "RUSSELL 2000" },
  { ticker: "^VIX", label: "VIX" },
];

const SECTORS: { ticker: string; label: string }[] = [
  { ticker: "XLK", label: "Teknoloji" },
  { ticker: "XLF", label: "Finans" },
  { ticker: "XLV", label: "Sağlık" },
  { ticker: "XLY", label: "Tüketici (Döngüsel)" },
  { ticker: "XLP", label: "Tüketici (Temel)" },
  { ticker: "XLE", label: "Enerji" },
  { ticker: "XLI", label: "Endüstriyel" },
  { ticker: "XLB", label: "Materyaller" },
  { ticker: "XLRE", label: "Gayrimenkul" },
  { ticker: "XLU", label: "Kamu Hizmetleri" },
  { ticker: "XLC", label: "İletişim Hizmetleri" },
];

const COMMODITIES: { ticker: string; label: string }[] = [
  { ticker: "GOLD", label: "Altın" },
  { ticker: "SILVER", label: "Gümüş" },
  { ticker: "USOIL", label: "Ham Petrol (WTI)" },
  { ticker: "NATGAS", label: "Doğal Gaz" },
];

const FX: { ticker: string; label: string }[] = [
  { ticker: "EURUSD", label: "EUR/USD" },
  { ticker: "GBPUSD", label: "GBP/USD" },
  { ticker: "USDJPY", label: "USD/JPY" },
  { ticker: "USDCHF", label: "USD/CHF" },
  { ticker: "AUDUSD", label: "AUD/USD" },
  { ticker: "USDCAD", label: "USD/CAD" },
];

const CRYPTO: { ticker: string; label: string }[] = [
  { ticker: "BTCUSD", label: "Bitcoin" },
  { ticker: "ETHUSD", label: "Ethereum" },
  { ticker: "SOLUSD", label: "Solana" },
  { ticker: "XRPUSD", label: "XRP" },
];

// Sektör ETF ticker'ı -> GICS sektör adı (lib/sectorHeatMap.ts'in SECTOR_ORDER
// ile eşleşir) — haftalık sektör/endeks analizinde gerçek hisse verisine
// (getAllTickers/groupBySector) bağlanmak için gerekli.
const SECTOR_TICKER_TO_GICS: Record<string, string> = {
  XLK: "Technology",
  XLF: "Financials",
  XLV: "Healthcare",
  XLY: "Consumer Discretionary",
  XLP: "Consumer Staples",
  XLE: "Energy",
  XLI: "Industrials",
  XLB: "Materials",
  XLRE: "Real Estate",
  XLU: "Utilities",
  XLC: "Communication Services",
};

export const MARKET_ASSET_DEFS: Record<"index" | "sector" | "commodity" | "fx" | "crypto", { ticker: string; label: string }[]> = {
  index: INDICES,
  sector: SECTORS,
  commodity: COMMODITIES,
  fx: FX,
  crypto: CRYPTO,
};

function siteBase(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || "https://bogastock.com";
}

// /api/quote — sitenin index/sektör ETF/emtia/döviz/kripto fiyatları için
// zaten kullandığı AYNI uç nokta (bkz. GraphicDetailContent.tsx endeks şeridi).
async function fetchQuotes(tickers: string[]): Promise<Record<string, { price: number | null; change_1d: number | null }>> {
  if (tickers.length === 0) return {};
  try {
    const res = await fetch(`${siteBase()}/api/quote?tickers=${tickers.map(encodeURIComponent).join(",")}`, { cache: "no-store" });
    if (!res.ok) return {};
    return await res.json();
  } catch {
    return {};
  }
}

// /api/watchlist-data — hisse listeleri (top100/swing/watchlist) için şirket
// adı, sektör, güncel fiyat ve günlük değişim% tek istekte gelir.
async function fetchStockMeta(tickers: string[]): Promise<Record<string, { company: string | null; sector: string | null; price: number | null; changePct: number | null }>> {
  if (tickers.length === 0) return {};
  try {
    const res = await fetch(`${siteBase()}/api/watchlist-data?tickers=${tickers.map(encodeURIComponent).join(",")}`, { cache: "no-store" });
    if (!res.ok) return {};
    const arr = await res.json();
    const out: Record<string, { company: string | null; sector: string | null; price: number | null; changePct: number | null }> = {};
    for (const item of Array.isArray(arr) ? arr : []) {
      if (!item?.ticker) continue;
      out[item.ticker] = {
        company: item.company ?? null,
        sector: item.sector ?? null,
        price: item.price?.current ?? null,
        changePct: item.price?.change_pct ?? item.tracker_1h?.change_pct_1d ?? null,
      };
    }
    return out;
  } catch {
    return {};
  }
}

async function getStockListTickers(category: "top100" | "swing" | "watchlist"): Promise<string[]> {
  if (category === "top100") {
    const { data } = await supabaseAdmin
      .from("top100_snapshot")
      .select("ticker, change_pct")
      .order("change_pct", { ascending: false })
      .limit(100);
    return (data ?? []).map((r: any) => String(r.ticker).toUpperCase());
  }
  if (category === "swing") {
    const swing = await getSwingPicksBackfilled().catch(() => null);
    const picks = ((swing?.picks ?? []) as any[]).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    return picks.slice(0, 20).map((p) => p.ticker);
  }
  const watch = await getWatchlistPicks().catch(() => null);
  const picks = ((watch?.picks ?? []) as any[]).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  return picks.slice(0, 20).map((p) => p.ticker);
}

export async function getListOptions(category: ListOptionCategory): Promise<ListOptionItem[]> {
  if (category === "top100" || category === "swing" || category === "watchlist") {
    const tickers = await getStockListTickers(category);
    if (tickers.length === 0) return [];
    const meta = await fetchStockMeta(tickers);
    return tickers.map((t) => ({
      ticker: t,
      label: meta[t]?.company || t,
      sector: meta[t]?.sector ?? null,
      price: meta[t]?.price ?? null,
      changePct: meta[t]?.changePct ?? null,
    }));
  }

  const defs = MARKET_ASSET_DEFS[category];
  const quotes = await fetchQuotes(defs.map((d) => d.ticker));
  return defs.map((d) => ({
    ticker: d.ticker,
    label: d.label,
    sector: null,
    price: quotes[d.ticker]?.price ?? null,
    changePct: quotes[d.ticker]?.change_1d ?? null,
  }));
}

// Haftalık sektör analizi için — gerçek hisse verisinden (aynı GICS
// sektöründeki, siteye kayıtlı tüm ticker'lar) haftanın en iyi performans
// gösteren 5 hissesini döner (change_pct_1w — sitenin zaten hesaplayıp
// sakladığı 1 haftalık değişim, bkz. lib/data.ts StockQuickView). AI bu
// listeden 2-3 tanesini seçip yorumlar — uydurma ticker riski olmadan.
export async function getSectorStandouts(sectorEtfTicker: string): Promise<{ ticker: string; changePct: number }[]> {
  const gicsName = SECTOR_TICKER_TO_GICS[sectorEtfTicker.toUpperCase()];
  if (!gicsName) return [];
  try {
    const allTickers = await getAllTickers();
    const groups = groupBySector(allTickers);
    const sectorStocks = groups[gicsName] ?? [];
    return [...sectorStocks]
      .map((t) => ({ ticker: t.ticker, changePct: t.change_pct_1w ?? t.change_pct }))
      .filter((t): t is { ticker: string; changePct: number } => typeof t.changePct === "number")
      .sort((a, b) => b.changePct - a.changePct)
      .slice(0, 5);
  } catch (e) {
    console.error("[x/listOptions] getSectorStandouts failed:", (e as Error).message);
    return [];
  }
}

const YF_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
  Accept: "application/json",
};

// /api/quote sadece 1 günlük değişim hesaplıyor (bkz. app/api/quote/route.ts);
// haftalık sektör rotasyonu için ~5 işlem günü öncesine göre gerçek değişim
// gerekiyor, bu yüzden burada ayrı bir Yahoo chart isteği ile hesaplanıyor.
async function fetchWeeklyChangePct(yahooSymbol: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?range=1mo&interval=1d`,
      { headers: YF_HEADERS, signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    const closes: number[] = (result?.indicators?.quote?.[0]?.close ?? []).filter((v: any) => typeof v === "number");
    if (closes.length < 6) return null;
    const latest = closes[closes.length - 1];
    const weekAgo = closes[closes.length - 6]; // ~5 işlem günü önce
    if (!weekAgo) return null;
    return Math.round(((latest - weekAgo) / weekAgo) * 10000) / 100;
  } catch {
    return null;
  }
}

// Haftalık endeks analizi için — 11 sektör ETF'inin gerçek ~1 haftalık
// (5 işlem günü) değişimi, en iyiden en kötüye sıralı. "Para nereye akıyor"
// yorumunu gerçek sektör rotasyon verisine dayandırmak için kullanılır.
export async function getSectorRotation(): Promise<{ label: string; changePct: number }[]> {
  const results = await Promise.all(
    SECTORS.map(async (s) => ({ label: s.label, changePct: await fetchWeeklyChangePct(s.ticker) }))
  );
  return results
    .filter((s): s is { label: string; changePct: number } => s.changePct != null)
    .sort((a, b) => b.changePct - a.changePct);
}
