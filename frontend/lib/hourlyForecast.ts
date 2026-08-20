// "Basit, anlaşılır" saatlik yön tahmini — 15 dakikalık mumların son
// formasyonu + hacim (OBV) eğilimini birleştirip tek bir yön/güven etiketi
// üretir. Ağır bir model değil: /api/chart-data'nın zaten hesapladığı
// candlePat (lib/indicators.ts candlestickPatterns) ve obv değerlerini
// yorumlayan saf bir fonksiyon. bkz. components/global/HourlyForecastBadge.tsx

export type ForecastDirection = "bullish" | "bearish" | "neutral";
export type ForecastConfidence = "confirmed" | "mixed" | "low";
export type VolumeTrend = "rising" | "falling" | "flat";

export interface CandlePatternLike {
  time: number;
  name: string;
  type: "bullish" | "bearish" | "neutral";
}

export interface HourlyForecast {
  direction: ForecastDirection;
  confidence: ForecastConfidence;
  patternName: string | null;
  volumeTrend: VolumeTrend;
}

// Son ~1 saatlik pencere icin (15dk mumlarda 4 bar) en guncel formasyon.
const LOOKBACK_PATTERN_BARS = 4;
// Hacim egilimini olcerken karsilastirilan pencere buyuklugu (~2 saat).
const OBV_TREND_WINDOW = 8;

function computeVolumeTrend(obv: (number | null)[]): VolumeTrend {
  const valid = obv.filter((v): v is number => v != null && Number.isFinite(v));
  if (valid.length < OBV_TREND_WINDOW + 1) return "flat";

  const recent = valid.slice(-OBV_TREND_WINDOW);
  const first = recent[0];
  const last = recent[recent.length - 1];
  const span = Math.max(Math.abs(first), Math.abs(last), 1);
  const pctMove = ((last - first) / span) * 100;

  if (pctMove > 2) return "rising";
  if (pctMove < -2) return "falling";
  return "flat";
}

export function computeHourlyForecast(
  candlePat: CandlePatternLike[],
  obv: (number | null)[]
): HourlyForecast {
  const recentPatterns = (candlePat ?? []).slice(-LOOKBACK_PATTERN_BARS);
  const lastPattern = recentPatterns.length ? recentPatterns[recentPatterns.length - 1] : null;
  const volumeTrend = computeVolumeTrend(obv ?? []);

  // Formasyon yoksa ya da noturse, sadece hacim egilimine dayanan zayif bir okuma.
  if (!lastPattern || lastPattern.type === "neutral") {
    if (volumeTrend === "rising") return { direction: "bullish", confidence: "low", patternName: lastPattern?.name ?? null, volumeTrend };
    if (volumeTrend === "falling") return { direction: "bearish", confidence: "low", patternName: lastPattern?.name ?? null, volumeTrend };
    return { direction: "neutral", confidence: "low", patternName: lastPattern?.name ?? null, volumeTrend };
  }

  // Formasyon + hacim ayni yonu isaret ediyorsa "confirmed", cakisiyorsa "mixed".
  const patternDirection: ForecastDirection = lastPattern.type;
  const agrees =
    (patternDirection === "bullish" && volumeTrend === "rising") ||
    (patternDirection === "bearish" && volumeTrend === "falling");
  const conflicts =
    (patternDirection === "bullish" && volumeTrend === "falling") ||
    (patternDirection === "bearish" && volumeTrend === "rising");

  return {
    direction: patternDirection,
    confidence: agrees ? "confirmed" : conflicts ? "mixed" : "low",
    patternName: lastPattern.name,
    volumeTrend,
  };
}
