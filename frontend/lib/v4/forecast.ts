/**
 * SPYEngine — 60 Dakikalık Tahmin (Forecast) Katmanı
 * Son 5 dakikalık mumlardaki hacim ve fiyat eğilimini kullanarak basit,
 * istatistiksel bir doğrusal projeksiyon üretir. Bu KESİN bir tahmin
 * DEĞİLDİR — son barların momentumunu, oynaklığını (ATR benzeri) ve
 * hacim trendini yumuşatarak ileriye taşıyan bir "olasılık çizgisi"dir.
 * Amaç: grafiğin sağ yarısında kesik çizgilerle olası fiyat yolunu ve
 * olası alım/satım noktalarını göstermek; canlı 1m/5m/15m sinyal
 * motorunun yerini TUTMAZ, ona ek bir görsel katmandır.
 */

import type { Bar } from "./types";
import { aggregate, round2 } from "./yahoo";

export interface ForecastPoint {
  time: number; // unix saniye
  price: number;
}

export interface ForecastSignal {
  time: number;
  price: number;
  type: "BUY" | "SELL";
  confidence: number; // 0-100, yalnızca gösterge amaçlı
  reason: string;
}

export interface ForecastResult {
  points: ForecastPoint[];
  signals: ForecastSignal[];
  trend: "UP" | "DOWN" | "FLAT";
  note: string;
}

const EMPTY: ForecastResult = { points: [], signals: [], trend: "FLAT", note: "Tahmin için yeterli veri yok." };

export function buildForecast(
  bars1m: Bar[],
  opts?: { horizonMinutes?: number; stepMinutes?: number }
): ForecastResult {
  const stepMinutes = opts?.stepMinutes ?? 5;
  const horizonMinutes = opts?.horizonMinutes ?? 60;
  const steps = Math.max(1, Math.round(horizonMinutes / stepMinutes));

  const bars5m = aggregate(bars1m, 5);
  if (bars5m.length < 6) return EMPTY;

  // Son ~2 saatlik (24 x 5dk) pencereye bak
  const lookback = Math.min(24, bars5m.length);
  const recent = bars5m.slice(-lookback);
  const closes = recent.map((b) => b.close);
  const n = closes.length;

  // Basit doğrusal regresyon: kapanış fiyatı ~ bar indeksi
  const xs = Array.from({ length: n }, (_, i) => i);
  const xMean = xs.reduce((a, b) => a + b, 0) / n;
  const yMean = closes.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - xMean) * (closes[i] - yMean);
    den += (xs[i] - xMean) ** 2;
  }
  const slopePerBar = den ? num / den : 0; // 5 dakikalık bar başına ortalama değişim

  // Oynaklık (ATR benzeri) — son barların high-low ortalaması
  const atr = recent.reduce((s, b) => s + (b.high - b.low), 0) / n || 0.01;

  // Hacim trendi: son yarının hacmi / önceki yarının hacmi
  const half = Math.floor(n / 2) || 1;
  const volFirst = recent.slice(0, half).reduce((s, b) => s + (b.volume || 0), 0) / half;
  const volSecond = recent.slice(-half).reduce((s, b) => s + (b.volume || 0), 0) / half;
  const volumeTrend = volFirst > 0 ? volSecond / volFirst : 1;

  // Destek / direnç: pencere içindeki en yüksek/en düşük seviyeler
  const resistance = Math.max(...recent.map((b) => b.high));
  const support = Math.min(...recent.map((b) => b.low));

  const lastBar = recent[recent.length - 1];
  const lastClose = lastBar.close;
  const lastTime = lastBar.time;

  const ceiling = resistance + atr * 0.6;
  const floor = support - atr * 0.6;

  const points: ForecastPoint[] = [];
  for (let i = 1; i <= steps; i++) {
    const dampening = Math.pow(0.86, i - 1); // ilerledikçe güven (ve etkisi) azalır
    let projected = lastClose + slopePerBar * i * dampening;
    projected = Math.min(ceiling, Math.max(floor, projected));
    points.push({ time: lastTime + i * stepMinutes * 60, price: round2(projected) });
  }

  const trend: "UP" | "DOWN" | "FLAT" =
    slopePerBar > atr * 0.05 ? "UP" : slopePerBar < -atr * 0.05 ? "DOWN" : "FLAT";
  const momentumStrength = Math.abs(slopePerBar) / atr;

  const signals: ForecastSignal[] = [];

  if (trend === "UP" && volumeTrend >= 1.05) {
    const idx = Math.min(points.length - 1, 2); // ~15 dk sonrası
    signals.push({
      time: points[idx].time,
      price: points[idx].price,
      type: "BUY",
      confidence: Math.round(Math.min(90, 50 + momentumStrength * 20 + (volumeTrend - 1) * 100)),
      reason: "Momentum ve artan hacimle yukarı devam olası",
    });
  } else if (trend === "DOWN" && volumeTrend >= 1.05) {
    const idx = Math.min(points.length - 1, 2);
    signals.push({
      time: points[idx].time,
      price: points[idx].price,
      type: "SELL",
      confidence: Math.round(Math.min(90, 50 + momentumStrength * 20 + (volumeTrend - 1) * 100)),
      reason: "Momentum ve artan hacimle aşağı devam olası",
    });
  }

  // Projeksiyon dirence yaklaşıyorsa olası dönüş/satış noktası
  const nearResistanceIdx = points.findIndex((p) => p.price >= resistance - atr * 0.15);
  if (nearResistanceIdx !== -1 && trend !== "DOWN") {
    signals.push({
      time: points[nearResistanceIdx].time,
      price: points[nearResistanceIdx].price,
      type: "SELL",
      confidence: 55,
      reason: `Olası direnç testi (~$${round2(resistance)})`,
    });
  }
  // Projeksiyon desteğe yaklaşıyorsa olası dönüş/alım noktası
  const nearSupportIdx = points.findIndex((p) => p.price <= support + atr * 0.15);
  if (nearSupportIdx !== -1 && trend !== "UP") {
    signals.push({
      time: points[nearSupportIdx].time,
      price: points[nearSupportIdx].price,
      type: "BUY",
      confidence: 55,
      reason: `Olası destek testi (~$${round2(support)})`,
    });
  }

  signals.sort((a, b) => a.time - b.time);
  const seenTimes = new Set<number>();
  const dedupedSignals = signals.filter((s) => {
    if (seenTimes.has(s.time)) return false;
    seenTimes.add(s.time);
    return true;
  });

  const note = `Bu, son ${lookback * 5} dakikalık hacim ve fiyat eğilimine dayanan istatistiksel bir projeksiyondur; kesin bir tahmin değildir.`;

  return { points, signals: dedupedSignals.slice(0, 3), trend, note };
}
