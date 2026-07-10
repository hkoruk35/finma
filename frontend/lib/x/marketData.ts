export type TrendStatus = "Bullish" | "BullishWeak" | "Bearish" | "BearishWeak" | "Neutral";

export interface OhlcBar {
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface TickerMarketData {
  bars: OhlcBar[]; // gunluk mumlar (1D grafik icin) — /api/chart-data ile ayni kaynak
  changePct: number;
  entryLow: number;
  entryHigh: number;
  trend: TrendStatus;
  signal: string;
}

// Sitenin kendi grafik motorunun (BogaChartEngine) kullandigi ayni endpoint —
// gercek gunluk OHLC mumlari, uydurma bir cizgi degil.
async function fetchDailyBars(base: string, ticker: string): Promise<OhlcBar[]> {
  try {
    const res = await fetch(`${base}/api/chart-data?ticker=${encodeURIComponent(ticker)}&timeframe=D`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = await res.json();
    const bars: OhlcBar[] = Array.isArray(data.bars) ? data.bars : [];
    return bars.slice(-20);
  } catch (e) {
    console.error("[x/marketData] daily bars fetch failed:", (e as Error).message);
    return [];
  }
}

// /api/watchlist-data zaten Yahoo'dan cekilen fiyat serisini, EMA'lari ve
// trend etiketini (ema_status) hesapliyor. Grafik icin ayrica gunluk
// mumlari /api/chart-data'dan alip 1D grafik gosteriyoruz.
export async function fetchTickerMarketData(ticker: string): Promise<TickerMarketData | null> {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://bogastock.com";
  try {
    const res = await fetch(`${base}/api/watchlist-data?tickers=${encodeURIComponent(ticker)}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const arr = await res.json();
    const item = Array.isArray(arr) ? arr[0] : null;
    if (!item) return null;

    const price: number = item.price?.current ?? 0;
    const ema20: number = item.tracker_1h?.ema_20 ?? item.technical?.ema_20 ?? price;
    // Tahmini giris araligi: guncel fiyat ile 20 gunluk trend ortalamasi (EMA20)
    // arasindaki bolge — swing girisleri icin klasik "trende geri cekilme" bandi.
    const entryLow = Math.min(price, ema20);
    const entryHigh = Math.max(price, ema20);

    const bars = await fetchDailyBars(base, ticker);

    return {
      bars,
      changePct: item.price?.change_pct ?? item.tracker_1h?.change_pct_1d ?? 0,
      entryLow,
      entryHigh,
      trend: (item.tracker_1h?.ema_status as TrendStatus) ?? "Neutral",
      signal: item.tracker_1h?.signal ?? "HOLD",
    };
  } catch (e) {
    console.error("[x/marketData] fetch failed:", (e as Error).message);
    return null;
  }
}

const TREND_LABELS: Record<string, Record<TrendStatus, string>> = {
  en: { Bullish: "Bullish", BullishWeak: "Mildly Bullish", Bearish: "Bearish", BearishWeak: "Mildly Bearish", Neutral: "Neutral" },
  es: { Bullish: "Alcista", BullishWeak: "Alcista Débil", Bearish: "Bajista", BearishWeak: "Bajista Débil", Neutral: "Neutral" },
  fr: { Bullish: "Haussier", BullishWeak: "Haussier Faible", Bearish: "Baissier", BearishWeak: "Baissier Faible", Neutral: "Neutre" },
  pt: { Bullish: "Altista", BullishWeak: "Altista Fraco", Bearish: "Baixista", BearishWeak: "Baixista Fraco", Neutral: "Neutro" },
  tr: { Bullish: "Yükseliş", BullishWeak: "Zayıf Yükseliş", Bearish: "Düşüş", BearishWeak: "Zayıf Düşüş", Neutral: "Nötr" },
};

export function trendLabel(trend: TrendStatus, locale: string): string {
  return (TREND_LABELS[locale] ?? TREND_LABELS.en)[trend] ?? trend;
}

const ENTRY_LABELS: Record<string, string> = {
  en: "Entry Zone",
  es: "Zona de Entrada",
  fr: "Zone d'Entrée",
  pt: "Zona de Entrada",
  tr: "Giriş Bölgesi",
};

export function entryLabel(locale: string): string {
  return ENTRY_LABELS[locale] ?? ENTRY_LABELS.en;
}
