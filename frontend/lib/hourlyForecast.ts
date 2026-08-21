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
//
// 2026-08-20 (2. tur) — KÖK NEDEN DÜZELTMESİ: forex tablosunda 8 enstrümanın
// 8'i de aynı 26 puanı üretiyordu. Neden: computeVolumeTrend eski haliyle
// OBV'nin (kümülatif, sınırsız büyüyen) ham seviyesine göre % değişim
// ölçüyordu — OBV günler boyunca biriktiği için, son birkaç barın gerçek
// hareketi bu büyük taban sayıya göre her zaman "önemsiz" (~%0) kalıyor,
// yani her enstrüman her zaman "yatay" (flat) çıkıyordu. Düzeltme: OBV'nin
// SON pencere içindeki net değişimini, o enstrümanın YAKIN GEÇMİŞTEKİ
// TİPİK bar-bar oynaklığına göre (z-skoru benzeri) ölçekliyoruz — böylece
// eşik, enstrümanın kendi ölçeğine göre anlamlı kalır ve OBV ne kadar
// "yaşlanırsa yaşlansın" bozulmaz.

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
  /** Hacim (OBV) hareketinin ham büyüklüğü (0-100'e ölçeklendirilmiş) — sıralama seçeneği ("Hacim Eğilimi") için. */
  volumeMagnitudePct: number;
}

// Son ~1 saatlik pencere icin (15dk mumlarda 4 bar) en guncel formasyon.
const LOOKBACK_PATTERN_BARS = 4;
// Hacim egilimini olcerken karsilastirilan pencere buyuklugu (~2 saat).
const OBV_TREND_WINDOW = 8;
// "Tipik" bar-bar oynakligi bu pencereden olculur (~15 saat) — OBV_TREND_WINDOW
// penceresindeki degisimi neye gore anlamli sayacagimizin referansi.
const OBV_BASELINE_WINDOW = 60;

/** score >= 30: yönlü göster (Yukarı/Aşağı). score < 30: "Yönsüz" göster —
 * düşük güvenli bir tahmini renkli okla sunmak yanıltıcı olur. */
export const NEUTRAL_THRESHOLD = 30;
/** score >= 60: "Güçlü Yukarı/Aşağı" kademesi. */
export const STRONG_THRESHOLD = 60;

function computeVolumeTrend(obv: (number | null)[]): { trend: VolumeTrend; magnitudePct: number } {
  const valid = obv.filter((v): v is number => v != null && Number.isFinite(v));
  if (valid.length < OBV_TREND_WINDOW + 1) return { trend: "flat", magnitudePct: 0 };

  const recent = valid.slice(-OBV_TREND_WINDOW);
  const delta = recent[recent.length - 1] - recent[0]; // son pencerede net OBV degisimi

  // Referans pencere: bar-bar OBV adimlarinin tipik buyuklugu (std sapma).
  const baseline = valid.slice(-OBV_BASELINE_WINDOW);
  const steps: number[] = [];
  for (let i = 1; i < baseline.length; i++) steps.push(baseline[i] - baseline[i - 1]);

  if (steps.length < OBV_TREND_WINDOW) return { trend: "flat", magnitudePct: 0 };

  const meanStep = steps.reduce((a, b) => a + b, 0) / steps.length;
  const variance = steps.reduce((a, b) => a + (b - meanStep) ** 2, 0) / steps.length;
  const stdStep = Math.sqrt(variance);

  if (!Number.isFinite(stdStep) || stdStep === 0) return { trend: "flat", magnitudePct: 0 };

  // Pencere boyunca kumulatif degisimin beklenen std sapmasi ~ stdStep * sqrt(N)
  // (rastgele-yuruyus varsayimi) — delta'yi buna gore z-skoruna cevirip
  // enstrumana-ozgu, olceklenebilir bir "hacim egilimi" elde ediyoruz.
  const z = delta / (stdStep * Math.sqrt(OBV_TREND_WINDOW));

  const trend: VolumeTrend = z > 0.6 ? "rising" : z < -0.6 ? "falling" : "flat";
  const magnitudePct = Math.max(0, Math.min(100, Math.abs(z) * 20));
  return { trend, magnitudePct };
}

// 2026-08-20 (2. tur) — eski formul (base + min(magnitude,40)) "confirmed +
// guclu hacim" olan HER enstrumani ayni tavan degere (95) topluyordu, kok
// nedenin daha hafif bir tekrariydi. Simdi katki oranli/duz (magnitude*0.45,
// erken doygunluk yok) — sentetik dagilim testinde (bkz. is agent notlari)
// skorlar 15-90 araligina yayiliyor, kullanicinin istedigi 15-85 hedefine
// yakin.
function computeStrength(confidence: ForecastConfidence, hasPattern: boolean, magnitudePct: number): number {
  const confidenceBase = confidence === "confirmed" ? 45 : confidence === "mixed" ? 25 : hasPattern ? 15 : 5;
  const magnitudeContribution = magnitudePct * 0.45;
  return Math.max(5, Math.min(95, Math.round(confidenceBase + magnitudeContribution)));
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

/** Kullanıcıya GÖSTERİLEN yön — ham model tahmininden (forecast.direction)
 * farklı olabilir: güç NEUTRAL_THRESHOLD altındaysa "yönsüz" gösterilir.
 * Düşük güvenli bir tahmini renkli bir okla sunmak yanıltıcıdır — model
 * "emin değilim" derken arayüz "yukarı" diye bağırmasın diye. Rozet, özet
 * çubuğu ve isabet-oranı kaydı (bkz. app/api/forecast-accuracy) hep bunu
 * kullanır, ham forecast.direction'ı değil. */
export function displayDirection(forecast: HourlyForecast): ForecastDirection {
  if (forecast.strength < NEUTRAL_THRESHOLD) return "neutral";
  return forecast.direction;
}

/** Mevcut tahminin "gecerlilik ufku" — bir sonraki tam saat. Sadece bir
 * etiket: "bu tahmin XX:00'a kadar gecerli". Gercek tuttu/tutmadi takibi
 * app/api/forecast-accuracy route'unda, ayri bir mekanizma ile yapiliyor. */
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
