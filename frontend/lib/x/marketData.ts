export type TrendStatus = "Bullish" | "BullishWeak" | "Bearish" | "BearishWeak" | "Neutral";

export interface OhlcBar {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TickerMarketData {
  bars: OhlcBar[]; // gunluk mumlar + hacim (1D grafik icin) — /api/chart-data ile ayni kaynak
  changePct: number;
  rvol: number; // ortalama hacme oranla bugunku hacim (1.0 = ortalama)
  trend: TrendStatus;
  signal: string;
  opportunity: boolean; // trend + hacim birlikte swing/yatirim firsati isaret ediyor mu
}

// Sitenin kendi grafik motorunun (BogaChartEngine) kullandigi ayni endpoint —
// gercek gunluk OHLC + hacim mumlari, uydurma bir cizgi degil.
async function fetchDailyBars(base: string, ticker: string): Promise<OhlcBar[]> {
  try {
    const res = await fetch(`${base}/api/chart-data?ticker=${encodeURIComponent(ticker)}&timeframe=D`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = await res.json();
    const bars: OhlcBar[] = Array.isArray(data.bars) ? data.bars : [];
    // timeframe=D zaten 1 yillik veri dondurur (bkz. chart-data route TIMEFRAME_MAP);
    // 1Y getiri hesaplayabilmek icin ~1 yillik islem gunu saklanir. Grafik yine de
    // sadece son ~60 gunu cizer (buildChart kendi ici slice(-60) yapar).
    return bars.slice(-260);
  } catch (e) {
    console.error("[x/marketData] daily bars fetch failed:", (e as Error).message);
    return [];
  }
}

// /api/watchlist-data zaten Yahoo'dan cekilen fiyat serisini, EMA'lari,
// trend etiketini (ema_status) ve goreli hacmi (rvol) hesapliyor. Grafik
// icin ayrica gunluk mumlari /api/chart-data'dan alip 1D grafik gosteriyoruz.
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

    const bars = await fetchDailyBars(base, ticker);
    const trend = (item.tracker_1h?.ema_status as TrendStatus) ?? "Neutral";
    const rvol: number = item.technical?.rvol ?? item.tracker_1h?.volume_ratio_1d ?? 1;

    // Orta/uzun vadeli firsat isareti: trend yukselis yonunde VE hacim
    // ortalamanin belirgin uzerindeyse (kurumsal ilgi/momentum onayi).
    const opportunity = (trend === "Bullish" || trend === "BullishWeak") && rvol >= 1.1;

    return {
      bars,
      changePct: item.price?.change_pct ?? item.tracker_1h?.change_pct_1d ?? 0,
      rvol,
      trend,
      signal: item.tracker_1h?.signal ?? "HOLD",
      opportunity,
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

const OPPORTUNITY_LABELS: Record<string, string> = {
  en: "Swing Opportunity",
  es: "Oportunidad Swing",
  fr: "Opportunité Swing",
  pt: "Oportunidade Swing",
  tr: "Swing Fırsatı",
};

export function opportunityLabel(locale: string): string {
  return OPPORTUNITY_LABELS[locale] ?? OPPORTUNITY_LABELS.en;
}
