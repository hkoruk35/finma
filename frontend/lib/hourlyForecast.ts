// "Basit, anlaşılır" saatlik yön tahmini — 15 dakikalık mumların son
// formasyonu + hacim (OBV) eğilimini birleştirip tek bir yön/güç etiketi
// üretir. Ağır bir model değil: /api/chart-data'nın zaten hesapladığı
// candlePat (lib/indicators.ts candlestickPatterns) ve obv değerlerini
// yorumlayan saf bir fonksiyon. bkz. components/global/HourlyForecastBadge.tsx
//
// "strength" (0-100) — sinyalin ne kadar belirgin olduğunu gösterir, bir
// "kesinlik yüzdesi" DEĞİLDİR. Güven kademesinden (confirmed/mixed/low) ve
// hacim hareketinin büyüklüğünden türetilir; enstrümanlar arasında görsel
// farklılaşma sağlamak için var — 2026-08-20 kullanıcı geri bildirimi:
// "beş satırın beşinde de aynı rozet varsa hiçbiri bir şey söylemiyor."

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
  /** 0-100 — rozette/güç barında görsel farklılaşma için (bkz. dosya başı notu). */
  strength: number;
  /** Hacim (OBV) hareketinin ham büyüklüğü (%) — sıralama seçeneği ("Hacim Eğilimi") için. */
  volumeMagnitudePct: number;
}

// Son ~1 saatlik pencere icin (15dk mumlarda 4 bar) en guncel formasyon.
const LOOKBACK_PATTERN_BARS = 4;
// Hacim egilimini olcerken karsilastirilan pencere buyuklugu (~2 saat).
const OBV_TREND_WINDOW = 8;

function computeVolumeTrend(obv: (number | null)[]): { trend: VolumeTrend; magnitudePct: number } {
  const valid = obv.filter((v): v is number => v != null && Number.isFinite(v));
  if (valid.length < OBV_TREND_WINDOW + 1) return { trend: "flat", magnitudePct: 0 };

  const recent = valid.slice(-OBV_TREND_WINDOW);
  const first = recent[0];
  const last = recent[recent.length - 1];
  const span = Math.max(Math.abs(first), Math.abs(last), 1);
  const pctMove = ((last - first) / span) * 100;

  const trend: VolumeTrend = pctMove > 2 ? "rising" : pctMove < -2 ? "falling" : "flat";
  return { trend, magnitudePct: Math.abs(pctMove) };
}

function computeStrength(confidence: ForecastConfidence, hasPattern: boolean, magnitudePct: number): number {
  const base = confidence === "confirmed" ? 60 : confidence === "mixed" ? 32 : hasPattern ? 26 : 12;
  const bonus = Math.min(magnitudePct, 30); // hacim buyuklugu katkisi, 30 puanla sinirli
  return Math.max(5, Math.min(100, Math.round(base + bonus)));
}

export function computeHourlyForecast(
  candlePat: CandlePatternLike[],
  obv: (number | null)[]
): HourlyForecast {
  const recentPatterns = (candlePat ?? []).slice(-LOOKBACK_PATTERN_BARS);
  const lastPattern = recentPatterns.length ? recentPatterns[recentPatterns.length - 1] : null;
  const { trend: volumeTrend, magnitudePct } = computeVolumeTrend(obv ?? []);

  // Formasyon yoksa ya da noturse, sadece hacim egilimine dayanan zayif bir okuma.
  if (!lastPattern || lastPattern.type === "neutral") {
    const strength = computeStrength("low", !!lastPattern, magnitudePct);
    const patternName = lastPattern?.name ?? null;
    if (volumeTrend === "rising") return { direction: "bullish", confidence: "low", patternName, volumeTrend, strength, volumeMagnitudePct: magnitudePct };
    if (volumeTrend === "falling") return { direction: "bearish", confidence: "low", patternName, volumeTrend, strength, volumeMagnitudePct: magnitudePct };
    return { direction: "neutral", confidence: "low", patternName, volumeTrend, strength, volumeMagnitudePct: magnitudePct };
  }

  // Formasyon + hacim ayni yonu isaret ediyorsa "confirmed", cakisiyorsa "mixed".
  const patternDirection: ForecastDirection = lastPattern.type;
  const agrees =
    (patternDirection === "bullish" && volumeTrend === "rising") ||
    (patternDirection === "bearish" && volumeTrend === "falling");
  const conflicts =
    (patternDirection === "bullish" && volumeTrend === "falling") ||
    (patternDirection === "bearish" && volumeTrend === "rising");
  const confidence: ForecastConfidence = agrees ? "confirmed" : conflicts ? "mixed" : "low";
  const strength = computeStrength(confidence, true, magnitudePct);

  return {
    direction: patternDirection,
    confidence,
    patternName: lastPattern.name,
    volumeTrend,
    strength,
    volumeMagnitudePct: magnitudePct,
  };
}

/** Mevcut tahminin "gecerlilik ufku" — bir sonraki tam saat. Sadece bir
 * etiket: "bu tahmin XX:00'a kadar gecerli" — henuz tuttu/tutmadi takibi
 * yok (bkz. HourlyForecastBadge.tsx dosya basi notu). */
export function nextHourBoundaryLabel(): string {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  const hh = String(d.getHours()).padStart(2, "0");
  return `${hh}:00`;
}

/** Son 1 saatlik fiyat değişimi (%) — 15dk barlarda 4 bar geriye bakar.
 * `closes` /api/chart-data'nın `bars` alanından (timeframe=15) türetilir,
 * ayrı bir istek gerektirmez. Yetersiz veri varsa null döner. */
export function compute1hChangePct(closes: number[]): number | null {
  if (!closes || closes.length < 5) return null;
  const now = closes[closes.length - 1];
  const hourAgo = closes[closes.length - 5];
  if (!Number.isFinite(now) || !Number.isFinite(hourAgo) || hourAgo === 0) return null;
  return ((now - hourAgo) / hourAgo) * 100;
}
