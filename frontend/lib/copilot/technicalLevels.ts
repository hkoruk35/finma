// Copilot'un "get_technical_levels" aracının veri kaynağı — EMA20/50/200
// mesafeleri, RSI ve yönü, hacim durumu, destek/direnç, 1G/5G/1A/1Y değişim.
// Grafik sayfasının (BogaChartEngine) kullandığı AYNI /api/chart-data
// motorunu (server-to-server) çağırır — model asla EMA/RSI/destek-direnç
// sayısı uydurmaz, hepsi gerçek OHLC'den hesaplanır.

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://bogastock.com";

export interface TechnicalLevels {
  ticker: string;
  currentPrice: number;
  change1dPct: number | null;
  change5dPct: number | null;
  change1mPct: number | null;
  change1yPct: number | null;
  ema20: number | null;
  ema50: number | null;
  ema200: number | null;
  distFromEma20Pct: number | null;
  distFromEma50Pct: number | null;
  distFromEma200Pct: number | null;
  rsi14: number | null;
  rsiTrend5d: "rising" | "falling" | "flat";
  volumeToday: number | null;
  avgVolume20d: number | null;
  volumeVsAvgPct: number | null;
  priceTrend5d: "rising" | "falling" | "flat";
  nearestSupport: number | null;
  nearestResistance: number | null;
}

function lastValue(arr: (number | null)[] | undefined): number | null {
  if (!arr) return null;
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i] != null) return arr[i] as number;
  }
  return null;
}

function trendDirection(vals: (number | null)[], lookback = 5): "rising" | "falling" | "flat" {
  const clean = vals.filter((v): v is number => v != null);
  if (clean.length < lookback + 1) return "flat";
  const recent = clean.slice(-lookback);
  const first = recent[0];
  const last = recent[recent.length - 1];
  if (first === 0) return "flat";
  const pct = ((last - first) / Math.abs(first)) * 100;
  if (pct > 3) return "rising";
  if (pct < -3) return "falling";
  return "flat";
}

export async function getTechnicalLevels(ticker: string): Promise<TechnicalLevels | null> {
  const t = ticker.trim().toUpperCase();
  if (!t || !/^[A-Z.\-]{1,6}$/.test(t)) return null;

  try {
    const res = await fetch(
      `${BASE_URL}/api/chart-data?ticker=${encodeURIComponent(t)}&timeframe=D&indicators=ema20,ema50,ema200,rsi,sr`,
      { signal: AbortSignal.timeout(10000), cache: "no-store" }
    );
    if (!res.ok) return null;
    const d = await res.json();
    const bars: Array<{ close: number; volume: number }> = d?.bars || [];
    if (bars.length === 0) return null;

    const currentPrice = bars[bars.length - 1].close;
    const closes = bars.map((b) => b.close);
    const volumes = bars.map((b) => b.volume);

    const ema20 = lastValue(d.indicators?.ema20);
    const ema50 = lastValue(d.indicators?.ema50);
    const ema200 = lastValue(d.indicators?.ema200);
    const rsiArr: (number | null)[] = d.indicators?.rsi || [];
    const rsi14 = lastValue(rsiArr);

    const pctDist = (ema: number | null) => (ema ? +(((currentPrice - ema) / ema) * 100).toFixed(2) : null);

    const pctChange = (idxFromEnd: number): number | null => {
      const i = bars.length - 1 - idxFromEnd;
      if (i < 0 || !bars[i]) return null;
      const base = bars[i].close;
      return base > 0 ? +(((currentPrice - base) / base) * 100).toFixed(2) : null;
    };

    const avgVol20 =
      volumes.length > 0
        ? volumes.slice(-20).reduce((a, b) => a + b, 0) / Math.min(20, volumes.length)
        : null;
    const volumeToday = volumes[volumes.length - 1] ?? null;
    const volumeVsAvgPct =
      avgVol20 && volumeToday != null ? +(((volumeToday - avgVol20) / avgVol20) * 100).toFixed(1) : null;

    const sr: Array<{ price: number; type: "support" | "resistance" }> = d.sr || [];
    const supports = sr
      .filter((s) => s.type === "support" && s.price < currentPrice)
      .sort((a, b) => b.price - a.price);
    const resistances = sr
      .filter((s) => s.type === "resistance" && s.price > currentPrice)
      .sort((a, b) => a.price - b.price);

    return {
      ticker: t,
      currentPrice: +currentPrice.toFixed(2),
      change1dPct: pctChange(1),
      change5dPct: pctChange(5),
      change1mPct: pctChange(21),
      change1yPct: bars.length > 1 ? +(((currentPrice - bars[0].close) / bars[0].close) * 100).toFixed(2) : null,
      ema20, ema50, ema200,
      distFromEma20Pct: pctDist(ema20),
      distFromEma50Pct: pctDist(ema50),
      distFromEma200Pct: pctDist(ema200),
      rsi14,
      rsiTrend5d: trendDirection(rsiArr),
      volumeToday,
      avgVolume20d: avgVol20 != null ? Math.round(avgVol20) : null,
      volumeVsAvgPct,
      priceTrend5d: trendDirection(closes),
      nearestSupport: supports[0]?.price ?? null,
      nearestResistance: resistances[0]?.price ?? null,
    };
  } catch {
    return null;
  }
}
