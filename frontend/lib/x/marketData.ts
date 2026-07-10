export type TrendStatus = "Bullish" | "BullishWeak" | "Bearish" | "BearishWeak" | "Neutral";

export interface TickerMarketData {
  points: number[];
  changePct: number;
  ema50: number | null;
  trend: TrendStatus;
  signal: string;
}

// /api/watchlist-data zaten Yahoo'dan cekilen fiyat serisini, EMA'lari ve
// trend etiketini (ema_status) hesapliyor — kart uretimi icin bunu tekrar
// hesaplamak yerine ayni endpoint'i kullaniyoruz.
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

    return {
      points: Array.isArray(item.recent_closes) ? item.recent_closes : [],
      changePct: item.price?.change_pct ?? item.tracker_1h?.change_pct_1d ?? 0,
      ema50: item.tracker_1h?.ema_50 ?? item.technical?.ema_50 ?? null,
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
