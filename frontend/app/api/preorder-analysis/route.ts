import { NextRequest, NextResponse } from "next/server";
import { calculateTradePlanZones, buildTradePlanRationale } from "@/lib/tradePlanEngine";
import { resolveYahooSymbol, getAssetCategory } from "@/lib/symbols";
import { generateAiMarketCommentary, type AiMarketCommentary } from "@/lib/marketCommentaryEngine";

// Simple in-memory cache (2 min TTL per ticker)
const cache = new Map<string, { data: PreorderAnalysis; ts: number }>();
const CACHE_TTL = 2 * 60 * 1000;

// Public erişim — in-memory rate limiter (app/api/auth/login/route.ts deseni, okuma trafiğine göre gevşek eşik)
const rlAttempts = new Map<string, { count: number; resetAt: number }>();
const RL_MAX = 120;
const RL_WINDOW_MS = 15 * 60 * 1000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rlAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    rlAttempts.set(ip, { count: 1, resetAt: now + RL_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > RL_MAX;
}

// activeSignals/warnings are generated in Turkish by default (this endpoint's
// original consumers are all Turkish-locale pages). Non-Turkish pages
// (/global/{en,es,fr,pt}/graphic) pass ?lang={locale} to get these translated
// — applied post-computation (and post-cache-hit) so the shared per-ticker
// cache itself always stays Turkish, and translation never mutates cached
// data. 5 languages supported (was en-only; es/fr/pt used to silently fall
// back to English).
type AnalysisLang = "en" | "es" | "fr" | "pt";

const MACD_POSITIVE: Record<AnalysisLang, string> = {
  en: "MACD Positive", es: "MACD Positivo", fr: "MACD Positif", pt: "MACD Positivo",
};
const STRONG_DAY: Record<AnalysisLang, string> = {
  en: "Strong day", es: "Día fuerte", fr: "Jour fort", pt: "Dia forte",
};

const WARNING_TRANSLATIONS: Record<string, Record<AnalysisLang, string>> = {
  "RSI aşırı alım bölgesinde — kısa vadede geri çekilme riski": {
    en: "RSI is in overbought territory — risk of a short-term pullback",
    es: "El RSI está en zona de sobrecompra — riesgo de un retroceso a corto plazo",
    fr: "Le RSI est en zone de surachat — risque de repli à court terme",
    pt: "O RSI está em território de sobrecompra — risco de recuo no curto prazo",
  },
  "52 haftalık zirveden uzak — trend zayıf olabilir": {
    en: "Far from the 52-week high — trend may be weak",
    es: "Lejos del máximo de 52 semanas — la tendencia podría ser débil",
    fr: "Loin du plus haut sur 52 semaines — la tendance pourrait être faible",
    pt: "Longe da máxima de 52 semanas — a tendência pode estar fraca",
  },
  "ATR% yüksek — pozisyon büyüklüğünü oynaklığa göre ayarla": {
    en: "ATR% is high — size your position according to volatility",
    es: "El ATR% es alto — ajusta el tamaño de tu posición según la volatilidad",
    fr: "L'ATR% est élevé — ajuste la taille de ta position selon la volatilité",
    pt: "O ATR% está alto — ajuste o tamanho da sua posição de acordo com a volatilidade",
  },
  "Hacim ortalamanın çok altında — likidite riski": {
    en: "Volume is well below average — liquidity risk",
    es: "El volumen está muy por debajo del promedio — riesgo de liquidez",
    fr: "Le volume est bien en dessous de la moyenne — risque de liquidité",
    pt: "O volume está bem abaixo da média — risco de liquidez",
  },
};

const PATTERN_TRANSLATIONS: Record<string, Record<AnalysisLang, string>> = {
  "Güçlü Kapanış ↑": { en: "Strong Close ↑", es: "Cierre Fuerte ↑", fr: "Clôture Forte ↑", pt: "Fechamento Forte ↑" },
  "Zayıf Kapanış ↓": { en: "Weak Close ↓", es: "Cierre Débil ↓", fr: "Clôture Faible ↓", pt: "Fechamento Fraco ↓" },
  "Yeşil Mum ↑": { en: "Green Candle ↑", es: "Vela Verde ↑", fr: "Bougie Verte ↑", pt: "Candle Verde ↑" },
  "Kırmızı Mum ↓": { en: "Red Candle ↓", es: "Vela Roja ↓", fr: "Bougie Rouge ↓", pt: "Candle Vermelho ↓" },
};

function localizeAnalysis(data: PreorderAnalysis, lang: string): PreorderAnalysis {
  if (lang !== "en" && lang !== "es" && lang !== "fr" && lang !== "pt") return data;
  const l = lang as AnalysisLang;
  return {
    ...data,
    activeSignals: data.activeSignals.map((s) =>
      s === "MACD Pozitif" ? MACD_POSITIVE[l] : s.replace("Güçlü gün", STRONG_DAY[l])
    ),
    warnings: data.warnings.map((w) => WARNING_TRANSLATIONS[w]?.[l] || w),
    timeframes: {
      ...data.timeframes,
      d1: { ...data.timeframes.d1, pattern: PATTERN_TRANSLATIONS[data.timeframes.d1.pattern]?.[l] || data.timeframes.d1.pattern },
      h1: { ...data.timeframes.h1, pattern: PATTERN_TRANSLATIONS[data.timeframes.h1.pattern]?.[l] || data.timeframes.h1.pattern },
      m15: { ...data.timeframes.m15, pattern: PATTERN_TRANSLATIONS[data.timeframes.m15.pattern]?.[l] || data.timeframes.m15.pattern },
    },
  };
}

// ── Math helpers ────────────────────────────────────────────────────────────

function calcEMA(closes: number[], period: number): number {
  if (closes.length === 0) return 0;
  if (closes.length < period) return closes.at(-1)!;
  const k = 2 / (period + 1);
  let ema = closes.slice(0, period).reduce((s, v) => s + v, 0) / period;
  for (let i = period; i < closes.length; i++) ema = closes[i] * k + ema * (1 - k);
  return ema;
}

function calcSMA(closes: number[], period: number): number {
  const arr = closes.slice(-period);
  if (arr.length === 0) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

// Wilder's smoothed RSI, recomputed over the full closes history — matches
// lib/indicators.ts's rsi() (used by the live chart) so the chart and this
// table never disagree on the same ticker's RSI.
function calcRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  let gainSum = 0, lossSum = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gainSum += diff; else lossSum -= diff;
  }
  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }
  return avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
}

function calcATR(highs: number[], lows: number[], closes: number[], period = 14): number {
  const trs: number[] = [];
  for (let i = 1; i < highs.length; i++) {
    trs.push(Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    ));
  }
  if (trs.length === 0) return 0;
  return trs.slice(-period).reduce((s, v) => s + v, 0) / Math.min(period, trs.length);
}

// SMA-seeded EMA — matches lib/indicators.ts's ema() (used by the live
// chart) exactly, so MACD/signal computed here never drifts from the
// chart's own MACD given the same closes array.
function emaSeries(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (values.length === 0) return out;
  const k = 2 / (period + 1);
  let prev: number | null = null;
  for (let i = 0; i < values.length; i++) {
    if (prev == null) {
      if (i >= period - 1) {
        const slice = values.slice(i - period + 1, i + 1);
        prev = slice.reduce((a, b) => a + b, 0) / period;
        out[i] = prev;
      }
    } else {
      prev = values[i] * k + prev * (1 - k);
      out[i] = prev;
    }
  }
  return out;
}

function calcMACD(closes: number[]): { macd: number; signal: number; histogram: number } {
  if (closes.length < 26) return { macd: 0, signal: 0, histogram: 0 };
  const ema12 = emaSeries(closes, 12);
  const ema26 = emaSeries(closes, 26);
  const macdLine: (number | null)[] = closes.map((_, i) =>
    ema12[i] != null && ema26[i] != null ? (ema12[i] as number) - (ema26[i] as number) : null
  );
  const firstValid = macdLine.findIndex((v) => v != null);
  let macd = 0, signal = 0;
  if (firstValid !== -1) {
    const tail = macdLine.slice(firstValid) as number[];
    const signalTail = emaSeries(tail, 9);
    macd = tail.at(-1) ?? 0;
    signal = (signalTail.at(-1) as number) ?? 0;
  }
  return { macd, signal, histogram: macd - signal };
}

function calcADX(highs: number[], lows: number[], closes: number[], period = 14): number {
  const n = highs.length;
  if (n < period * 2) return 20;
  const plusDM: number[] = [0], minusDM: number[] = [0], tr: number[] = [0];
  for (let i = 1; i < n; i++) {
    const upMove = highs[i] - highs[i - 1];
    const downMove = lows[i - 1] - lows[i];
    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
    tr.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1])));
  }
  const smooth = (arr: number[]): number[] => {
    const out: number[] = [];
    let sum = arr.slice(1, period + 1).reduce((s, v) => s + v, 0);
    out[period] = sum;
    for (let i = period + 1; i < arr.length; i++) { sum = sum - arr[i - period] + arr[i]; out[i] = sum; }
    return out;
  };
  const trS = smooth(tr), plusS = smooth(plusDM), minusS = smooth(minusDM);
  const dx: number[] = [];
  for (let i = period; i < n; i++) {
    const trv = trS[i] || 1e-9;
    const plusDI = (100 * plusS[i]) / trv;
    const minusDI = (100 * minusS[i]) / trv;
    const sum = plusDI + minusDI || 1e-9;
    dx.push((100 * Math.abs(plusDI - minusDI)) / sum);
  }
  if (dx.length === 0) return 20;
  const tail = dx.slice(-period);
  return tail.reduce((s, v) => s + v, 0) / tail.length;
}

function calcROC(closes: number[], period = 10): number {
  if (closes.length < period + 1) return 0;
  const past = closes[closes.length - 1 - period];
  const now = closes.at(-1)!;
  return past > 0 ? ((now - past) / past) * 100 : 0;
}

function calcBBPercent(closes: number[], period = 20, mult = 2): number {
  if (closes.length < period) return 0.5;
  const slice = closes.slice(-period);
  const mean = slice.reduce((s, v) => s + v, 0) / period;
  const variance = slice.reduce((s, v) => s + (v - mean) ** 2, 0) / period;
  const sd = Math.sqrt(variance);
  const upper = mean + mult * sd;
  const lower = mean - mult * sd;
  const price = closes.at(-1)!;
  return upper > lower ? (price - lower) / (upper - lower) : 0.5;
}

// ── BOGA Score bileşenleri (public — Opsiyon bileşeni yok, Karar H) ─────────

function calcTrendScorePublic(params: { price: number; ema9: number; ema20: number; ema50: number; ema200: number; adx: number; pct52h: number }): number {
  const { price, ema9, ema20, ema50, ema200, adx, pct52h } = params;
  let score = 0;
  if (ema9 > ema20 && ema20 > ema50 && ema50 > ema200) score += 40;
  else if (ema20 > ema50 && ema50 > ema200) score += 30;
  else if (ema20 > ema50) score += 20;
  if (price > ema200) score += 20;
  if (adx >= 35) score += 20; else if (adx >= 25) score += 15; else if (adx >= 20) score += 10;
  if (pct52h >= -3) score += 20; else if (pct52h >= -8) score += 15; else if (pct52h >= -15) score += 10;
  return Math.min(100, score);
}

function calcMomentumScorePublic(params: { rsi: number; rvol: number; macd: number; macdHist: number; roc: number }): number {
  const { rsi, rvol, macd, macdHist, roc } = params;
  let score = 0;
  if (rvol >= 4.0) score += 30; else if (rvol >= 2.5) score += 22; else if (rvol >= 1.5) score += 15; else if (rvol >= 1.0) score += 5;
  if (rsi >= 60 && rsi <= 72) score += 25; else if (rsi >= 55 && rsi < 60) score += 18; else if (rsi >= 50 && rsi < 55) score += 10;
  if (macd > 0 && macdHist > 0) score += 25; else if (macd > 0) score += 15; else if (macdHist > 0) score += 10;
  if (roc >= 8) score += 20; else if (roc >= 5) score += 15; else if (roc >= 2) score += 8;
  return Math.min(100, score);
}

function calcLiquidityScorePublic(rvol: number, avgVol: number, price: number): number {
  let score = 0;
  const dolVol = avgVol * price;
  if (dolVol >= 50e6) score += 50; else if (dolVol >= 10e6) score += 38; else if (dolVol >= 5e6) score += 25; else if (dolVol >= 1e6) score += 12;
  if (rvol >= 3.0) score += 50; else if (rvol >= 2.0) score += 36; else if (rvol >= 1.5) score += 24; else if (rvol >= 1.0) score += 10;
  return Math.min(100, score);
}

function calcPivots(high: number, low: number, close: number) {
  const p = (high + low + close) / 3;
  return {
    p:  +p.toFixed(2),
    r1: +(2 * p - low).toFixed(2),
    r2: +(p + high - low).toFixed(2),
    r3: +(high + 2 * (p - low)).toFixed(2),
    s1: +(2 * p - high).toFixed(2),
    s2: +(p - high + low).toFixed(2),
    s3: +(low - 2 * (high - low)).toFixed(2),
  };
}

function detectSwings(highs: number[], lows: number[], lookback = 5) {
  const sHighs: number[] = [], sLows: number[] = [];
  const n = highs.length;
  for (let i = lookback; i < n - lookback; i++) {
    const localH = Math.max(...highs.slice(i - lookback, i + lookback + 1));
    if (highs[i] >= localH) sHighs.push(highs[i]);
    const localL = Math.min(...lows.slice(i - lookback, i + lookback + 1));
    if (lows[i] <= localL) sLows.push(lows[i]);
  }
  return {
    swingHigh: sHighs.at(-1) ?? highs.at(-1) ?? 0,
    swingLow:  sLows.at(-1) ?? lows.at(-1) ?? 0,
    allHighs:  sHighs.slice(-5),
    allLows:   sLows.slice(-5),
  };
}

function detectCandle(closes: number[], opens: number[], highs: number[], lows: number[]): string {
  if (closes.length < 2) return "—";
  const n = closes.length - 1;
  const c = closes[n], o = opens[n], h = highs[n], l = lows[n];
  const pc = closes[n - 1], po = opens[n - 1];
  const body = Math.abs(c - o);
  const range = h - l;
  if (range === 0) return "—";
  const isUp = c > o;
  const lowerWick = Math.min(c, o) - l;
  const upperWick = h - Math.max(c, o);
  const closePos = (c - l) / range;
  if (body / range < 0.1) return isUp ? "Doji +" : "Doji -";
  if (lowerWick > body * 2 && upperWick < body * 0.5 && isUp) return "Hammer ↑";
  if (upperWick > body * 2 && lowerWick < body * 0.5 && !isUp) return "Shooting Star ↓";
  if (isUp && c > po && o < pc && pc > po) return "Bullish Engulfing ↑";
  if (!isUp && c < po && o > pc && pc < po) return "Bearish Engulfing ↓";
  if (h < highs[n - 1] && l > lows[n - 1]) return "Inside Bar";
  if (h > highs[n - 1] && l < lows[n - 1]) return isUp ? "Outside ↑" : "Outside ↓";
  if (closePos > 0.7 && isUp) return "Güçlü Kapanış ↑";
  if (closePos < 0.3 && !isUp) return "Zayıf Kapanış ↓";
  return isUp ? "Yeşil Mum ↑" : "Kırmızı Mum ↓";
}

function wyckoff(closes: number[], opens: number[], highs: number[], lows: number[], volumes: number[], avgVol: number) {
  const n = Math.min(10, closes.length);
  let acc = 0, dist = 0, noSup = 0, noDem = 0;
  for (let i = closes.length - n; i < closes.length; i++) {
    const range = highs[i] - lows[i];
    const isUp = closes[i] > opens[i];
    const cp = range > 0 ? (closes[i] - lows[i]) / range : 0.5;
    const vol = volumes[i] ?? avgVol;
    if (isUp  && vol > avgVol * 1.2) acc++;
    if (!isUp && vol > avgVol * 1.2) dist++;
    if (!isUp && cp > 0.5 && vol < avgVol * 0.7) noSup++;
    if (isUp  && cp < 0.5 && vol < avgVol * 0.7) noDem++;
  }
  let score = Math.max(0, Math.min(100, 50 + (acc - dist) * 7 + (noSup - noDem) * 5));
  return {
    score,
    accumDays: acc, distribDays: dist, noSupplyDays: noSup, noDemandDays: noDem,
    phase:  score > 65 ? "Markup / Birikim" : score > 45 ? "Nötr" : "Dağılım / Markdown",
    signal: score > 70 ? "GÜÇLÜ BİRİKİM" : score > 55 ? "BİRİKİM" : score > 40 ? "NÖTR" : "DAĞILIM",
    effortVsResult: score > 60 ? "Pozitif" : score > 45 ? "Nötr" : "Negatif",
  };
}

function weinsteinStage(closes: number[]) {
  if (closes.length < 40) return { stage: 1, label: "Stage 1 (Baz)" };
  const sma30      = calcSMA(closes, 30);
  const sma30_prev = calcSMA(closes.slice(0, -10), 30);
  const slope = sma30 - sma30_prev;
  const price = closes.at(-1)!;
  if (price > sma30 && slope > sma30 * 0.001) return { stage: 2, label: "Stage 2 ↑ (Yükseliş)" };
  if (price > sma30 && slope <= sma30 * 0.001) return { stage: 3, label: "Stage 3 (Tepe)" };
  if (price < sma30 && slope < 0)              return { stage: 4, label: "Stage 4 ↓ (Düşüş)" };
  return { stage: 1, label: "Stage 1 (Baz)" };
}

interface SRLevel {
  price: number;
  type: "resistance" | "support";
  source: string;
  strength: number;
}

function buildSRTable(
  price: number,
  pivots1d: ReturnType<typeof calcPivots>,
  pivotsW: ReturnType<typeof calcPivots>,
  swingHighs: number[], swingLows: number[],
  ema9: number, ema20: number, ema50: number
): SRLevel[] {
  const levels: SRLevel[] = [];

  const add = (p: number, src: string, str: number) => {
    if (!p || p <= 0) return;
    const type: "resistance" | "support" = p > price * 1.002 ? "resistance" : "support";
    const ex = levels.find(l => Math.abs(l.price - p) / p < 0.006);
    if (ex) { ex.strength = Math.max(ex.strength, str); ex.source += ` + ${src}`; }
    else levels.push({ price: +p.toFixed(2), type, source: src, strength: str });
  };

  // Daily pivots
  add(pivots1d.r1, "1G R1", 3); add(pivots1d.r2, "1G R2", 2); add(pivots1d.r3, "1G R3", 2);
  add(pivots1d.s1, "1G S1", 3); add(pivots1d.s2, "1G S2", 2); add(pivots1d.s3, "1G S3", 2);

  // Weekly pivots
  add(pivotsW.r1, "H R1", 4); add(pivotsW.r2, "H R2", 3);
  add(pivotsW.s1, "H S1", 4); add(pivotsW.s2, "H S2", 3);

  // Swing levels
  swingHighs.forEach(sh => add(sh, "Swing D", 3));
  swingLows.forEach(sl => add(sl, "Destek D", 3));

  // Dynamic EMAs
  add(ema9,  "EMA9",  3);
  add(ema20, "EMA20", 4);
  add(ema50, "EMA50", 4);

  // Round numbers (nearest $5 multiples, ±3 steps)
  const nearest5 = Math.round(price / 5) * 5;
  for (let i = -3; i <= 3; i++) {
    const rn = nearest5 + i * 5;
    if (Math.abs(rn - price) / price > 0.002) add(rn, "Yuvarlak", 2);
  }

  return levels
    .filter(l => Math.abs(l.price - price) / price < 0.22)
    .sort((a, b) => b.price - a.price);
}

// ── Types ────────────────────────────────────────────────────────────────────

interface PreorderAnalysis {
  ticker: string;
  company: string;
  exchange: string;
  price: number;
  prevClose: number;
  changePct: number;
  volume: number;
  avgVol30: number;
  rvol: number;
  generatedAt: string;
  context: {
    hi52: number; lo52: number; pct52h: number;
    atr: number; atrPct: number;
    weinstein: { stage: number; label: string };
    stockReturn1y: number;
    vcpDetected: boolean;
  };
  timeframes: {
    d1: {
      ema9: number; ema20: number; ema50: number; ema200: number;
      rsi: number; pattern: string; rvol: number;
      pivots: ReturnType<typeof calcPivots>;
      pivotsWeekly: ReturnType<typeof calcPivots>;
      swingHigh: number; swingLow: number;
      swingHighs: number[]; swingLows: number[];
    };
    h1: {
      ema9: number; ema20: number; ema50: number;
      rsi: number; pattern: string; rvol: number;
      pivots: ReturnType<typeof calcPivots>;
      swingHigh: number; swingLow: number;
    };
    m15: {
      ema9: number; ema20: number;
      pattern: string; vwap: number;
      pivots: { p: number; r1: number; s1: number };
      swingHigh: number; swingLow: number;
    };
  };
  wyckoff: ReturnType<typeof wyckoff>;
  srLevels: SRLevel[];
  conviction: number;
  recommendation: { type: string; label: string; reason: string; hold: string };
  tradePlan: {
    // lib/tradePlanEngine.ts'deki paylasilan pivot/ATR motorundan gelir —
    // /api/ask (analiz sayfasi) ile ayni mantik, boylece iki sayfa ayni
    // ticker icin celismez.
    entryZone: { low: number; high: number };
    entryType: string;
    entryCondition: string;
    stop: { price: number; pct: number };
    stopRationale: string;
    targets: { price: number; rr: number; label: string }[];
    riskReward: number;
    rationale: { ema: string; vwap: string; volume: string; rsi: string };
    // risk<=0 (stop entry'nin uzerinde kaldi, %5 tabanina ragmen) ya da acik
    // dusus yapisinda (Weinstein Stage 4) long pozisyon icin anlamli bir
    // plan yoktur — tuketiciler (orn. TickerDetailPanel) sayilari degil bir
    // uyari gostermeli.
    valid: boolean;
  };
  momentum: {
    macd: number; macdSignal: number; macdHist: number;
    adx: number; roc10: number; bbPercent: number;
  };
  bogaScore: { trend: number; momentum: number; liquidity: number };
  activeSignals: string[];
  warnings: string[];
  aiCommentary: AiMarketCommentary;
}

// ── Fetch helper ─────────────────────────────────────────────────────────────

async function yf(url: string) {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "application/json",
      },
      next: { revalidate: 120 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

function safeArr(arr: any[] | null | undefined): number[] {
  return (arr ?? []).filter((v: any) => v != null && isFinite(v)) as number[];
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: "Too many requests. Please wait a few minutes." }, { status: 429 });
  }

  const ticker = req.nextUrl.searchParams.get("ticker")?.toUpperCase().trim();
  if (!ticker) return NextResponse.json({ error: "ticker required" }, { status: 400 });
  const rawLang = req.nextUrl.searchParams.get("lang");
  const lang = (["en", "es", "fr", "pt"].includes(rawLang || "") ? rawLang : "tr") as "en" | "tr" | "es" | "fr" | "pt";

  const cacheKey = `${ticker}_${lang}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.ts < CACHE_TTL) return NextResponse.json(localizeAnalysis(hit.data, lang));

  const yahooSymbol = resolveYahooSymbol(ticker);
  const BASE = "https://query1.finance.yahoo.com/v8/finance/chart";
  const [r1d, r1h, r15m] = await Promise.all([
    yf(`${BASE}/${encodeURIComponent(yahooSymbol)}?range=1y&interval=1d`),
    yf(`${BASE}/${encodeURIComponent(yahooSymbol)}?range=10d&interval=1h`),
    yf(`${BASE}/${encodeURIComponent(yahooSymbol)}?range=5d&interval=15m`),
  ]);

  if (!r1d?.chart?.result?.[0]) {
    return NextResponse.json({ error: "Yahoo Finance veri alınamadı" }, { status: 502 });
  }

  const meta  = r1d.chart.result[0].meta ?? {};
  const q1d   = r1d.chart.result[0].indicators?.quote?.[0] ?? {};
  const q1h   = r1h?.chart?.result?.[0]?.indicators?.quote?.[0] ?? {};
  const q15m  = r15m?.chart?.result?.[0]?.indicators?.quote?.[0] ?? {};

  const closes1d = safeArr(q1d.close);
  const highs1d  = safeArr(q1d.high);
  const lows1d   = safeArr(q1d.low);
  const opens1d  = safeArr(q1d.open);
  const vols1d   = safeArr(q1d.volume);

  if (closes1d.length < 20) {
    return NextResponse.json({ error: "Yetersiz geçmiş data" }, { status: 400 });
  }

  const closes1h = safeArr(q1h.close);
  const highs1h  = safeArr(q1h.high);
  const lows1h   = safeArr(q1h.low);
  const opens1h  = safeArr(q1h.open);
  const vols1h   = safeArr(q1h.volume);

  const closes15m = safeArr(q15m.close);
  const highs15m  = safeArr(q15m.high);
  const lows15m   = safeArr(q15m.low);
  const opens15m  = safeArr(q15m.open);

  // ── Price / Volume ────────────────────────────────────────────────────────
  // FIX 2026-07-27: Data consistency — EMA'lar closes1d (historical) üzerinden
  // hesaplandığı için, tüm teknik karşılaştırmalar closes1d'nin son değeriyle
  // yapılmalı. meta.regularMarketPrice (real-time) ile closes1d karışması
  // tutarsızlıklara neden oluyor (fiyat EMA'nın altında görünüyorken trend
  // sinyal "EMA20>EMA50" yüksek oluyor gibi).
  const price     = closes1d.at(-1)!;  // Tutarlılık için closes1d'nin son close'unu kullan
  const prevClose = closes1d.at(-2) ?? closes1d.at(-1)!;
  const changePct = prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0;
  const curVol    = vols1d.at(-1) ?? 0;
  const avgVol30  = vols1d.length >= 5 ? vols1d.slice(-30).reduce((s, v) => s + v, 0) / Math.min(30, vols1d.length) : curVol;
  const rvol      = avgVol30 > 0 ? curVol / avgVol30 : 1;

  // ── 1D indicators ────────────────────────────────────────────────────────
  const d1_ema9   = calcEMA(closes1d, 9);
  const d1_ema20  = calcEMA(closes1d, 20);
  const d1_ema50  = calcEMA(closes1d, 50);
  const d1_ema200 = calcEMA(closes1d, 200);
  const d1_rsi    = calcRSI(closes1d);
  const d1_atr    = calcATR(highs1d, lows1d, closes1d);
  const d1_swings = detectSwings(highs1d, lows1d, 5);
  const d1_pat    = detectCandle(closes1d, opens1d, highs1d, lows1d);
  const hi52      = Math.max(...highs1d.slice(-252));
  const lo52      = Math.min(...lows1d.slice(-252));
  const pct52h    = hi52 > 0 ? ((price - hi52) / hi52) * 100 : 0;
  const atrPct    = d1_atr > 0 ? (d1_atr / price) * 100 : 0;
  const ret1y     = closes1d.length > 1 ? ((price - closes1d[0]) / closes1d[0]) * 100 : 0;

  // Daily pivots (from yesterday's bar)
  const yH = highs1d.at(-2) ?? highs1d.at(-1)!;
  const yL = lows1d.at(-2) ?? lows1d.at(-1)!;
  const yC = closes1d.at(-2) ?? closes1d.at(-1)!;
  const pivots1d = calcPivots(yH, yL, yC);

  // Weekly pivots (aggregate last 5 daily bars)
  const wSize = Math.min(5, highs1d.length);
  const pivotsW = calcPivots(
    Math.max(...highs1d.slice(-wSize)),
    Math.min(...lows1d.slice(-wSize)),
    closes1d.at(-1)!
  );

  const weinstein = weinsteinStage(closes1d);
  const vcpDetected = vols1d.length >= 10 && Math.min(...vols1d.slice(-10)) < avgVol30 * 0.65;

  // ── Momentum bileşenleri (MACD/ADX/ROC/BB%) ──────────────────────────────
  const macdResult = calcMACD(closes1d);
  const d1_adx     = calcADX(highs1d, lows1d, closes1d);
  const roc10      = calcROC(closes1d, 10);
  const bbPercent  = calcBBPercent(closes1d);

  // ── BOGA Score bileşenleri (public — Trend/Momentum/Likidite) ───────────
  const trendScore     = calcTrendScorePublic({ price, ema9: d1_ema9, ema20: d1_ema20, ema50: d1_ema50, ema200: d1_ema200, adx: d1_adx, pct52h });
  const momentumScore  = calcMomentumScorePublic({ rsi: d1_rsi, rvol, macd: macdResult.macd, macdHist: macdResult.histogram, roc: roc10 });
  const liquidityScore = calcLiquidityScorePublic(rvol, avgVol30, price);

  // ── Aktif sinyaller + uyarılar ───────────────────────────────────────────
  const activeSignals: string[] = [];
  if (price > d1_ema200) activeSignals.push("Price>EMA200");
  if (d1_ema20 > d1_ema50) activeSignals.push("EMA20>EMA50");
  if (d1_rsi >= 55 && d1_rsi <= 70) activeSignals.push(`RSI ${d1_rsi.toFixed(0)} (Momentum)`);
  if (rvol >= 1.5) activeSignals.push(`RVOL ${rvol.toFixed(1)}x`);
  if (changePct > 2) activeSignals.push(`+${changePct.toFixed(1)}% Güçlü gün`);
  if (atrPct > 5) activeSignals.push(`ATR ${atrPct.toFixed(1)}%`);
  if (macdResult.histogram > 0) activeSignals.push("MACD Pozitif");

  const warnings: string[] = [];
  if (d1_rsi > 78) warnings.push("RSI aşırı alım bölgesinde — kısa vadede geri çekilme riski");
  if (pct52h < -25) warnings.push("52 haftalık zirveden uzak — trend zayıf olabilir");
  if (atrPct > 8) warnings.push("ATR% yüksek — pozisyon büyüklüğünü oynaklığa göre ayarla");
  if (rvol < 0.5) warnings.push("Hacim ortalamanın çok altında — likidite riski");

  // ── 1H indicators ────────────────────────────────────────────────────────
  let h1_ema9 = 0, h1_ema20 = 0, h1_ema50 = 0, h1_rsi = 50, h1_pat = "—", h1_rvol = 1;
  let h1_swings = { swingHigh: 0, swingLow: 0, allHighs: [] as number[], allLows: [] as number[] };
  let h1_pivots = calcPivots(yH, yL, yC);

  if (closes1h.length >= 9) {
    h1_ema9  = calcEMA(closes1h, 9);
    h1_ema20 = calcEMA(closes1h, 20);
    h1_ema50 = closes1h.length >= 50 ? calcEMA(closes1h, 50) : calcEMA(closes1h, closes1h.length);
    h1_rsi   = calcRSI(closes1h);
    h1_pat   = detectCandle(closes1h, opens1h, highs1h, lows1h);
    h1_swings = detectSwings(highs1h, lows1h, 3);
    const avgV1h = vols1h.slice(-20).reduce((s, v) => s + v, 0) / Math.min(20, vols1h.length);
    h1_rvol  = avgV1h > 0 ? (vols1h.at(-1) ?? 0) / avgV1h : 1;
    // 1H pivot from ~previous session (bars -18 to -9 approx)
    const prev9H = Math.max(...highs1h.slice(-18, -9));
    const prev9L = Math.min(...lows1h.slice(-18, -9));
    const prev9C = closes1h.at(-9) ?? closes1h.at(-1)!;
    if (prev9H > 0 && prev9L > 0) h1_pivots = calcPivots(prev9H, prev9L, prev9C);
  }

  // ── 15M indicators ───────────────────────────────────────────────────────
  let m15_ema9 = 0, m15_ema20 = 0, m15_pat = "—", vwap = price;
  let m15_swings = { swingHigh: 0, swingLow: 0, allHighs: [] as number[], allLows: [] as number[] };
  let m15_pivots = { p: pivots1d.p, r1: pivots1d.r1, s1: pivots1d.s1 };

  if (closes15m.length >= 9) {
    m15_ema9  = calcEMA(closes15m, 9);
    m15_ema20 = closes15m.length >= 20 ? calcEMA(closes15m, 20) : calcEMA(closes15m, closes15m.length);
    m15_pat   = detectCandle(closes15m, opens15m, highs15m, lows15m);
    m15_swings = detectSwings(highs15m, lows15m, 3);
    const todayN = Math.min(26, closes15m.length);
    vwap = closes15m.slice(-todayN).reduce((s, v) => s + v, 0) / todayN;
    if (closes15m.length >= 52) {
      const prevH = Math.max(...highs15m.slice(-52, -26));
      const prevL = Math.min(...lows15m.slice(-52, -26));
      const prevC = closes15m.at(-27) ?? closes15m.at(-1)!;
      const fp = calcPivots(prevH, prevL, prevC);
      m15_pivots = { p: fp.p, r1: fp.r1, s1: fp.s1 };
    }
  }

  // ── Wyckoff ──────────────────────────────────────────────────────────────
  const wyckoffResult = wyckoff(closes1d, opens1d, highs1d, lows1d, vols1d, avgVol30);

  // ── S/R table ────────────────────────────────────────────────────────────
  const srLevels = buildSRTable(
    price, pivots1d, pivotsW,
    d1_swings.allHighs, d1_swings.allLows,
    d1_ema9, d1_ema20, d1_ema50
  );

  // ── Conviction score (0–100) ─────────────────────────────────────────────
  let conviction = 0;
  // 1D EMA alignment (max 25)
  if (price > d1_ema9 && d1_ema9 > d1_ema20 && d1_ema20 > d1_ema50) conviction += 25;
  else if (price > d1_ema20 && d1_ema20 > d1_ema50) conviction += 16;
  else if (price > d1_ema50) conviction += 8;
  // 1H structure (max 20)
  if (closes1h.length >= 9) {
    if (h1_ema9 > h1_ema20 && h1_ema20 > h1_ema50) conviction += 20;
    else if (h1_ema20 > h1_ema50) conviction += 12;
    else if (price > h1_ema50) conviction += 5;
  }
  // 15M entry timing (max 10)
  if (closes15m.length >= 9) {
    if (m15_ema9 > m15_ema20 && price > m15_ema9) conviction += 10;
    else if (price > m15_ema20) conviction += 5;
  }
  // Wyckoff (max 15)
  conviction += Math.round(wyckoffResult.score * 0.15);
  // RSI zone (max 10)
  if (d1_rsi >= 45 && d1_rsi <= 65) conviction += 10;
  else if (d1_rsi >= 40 && d1_rsi <= 70) conviction += 5;
  // RVOL (max 10)
  if (rvol >= 1.5) conviction += 10;
  else if (rvol >= 1.0) conviction += 6;
  else if (rvol >= 0.7) conviction += 2;
  // RS / stock return (max 5)
  if (ret1y > 30) conviction += 5;
  else if (ret1y > 10) conviction += 3;
  // Weinstein Stage 2 bonus
  if (weinstein.stage === 2) conviction += 5;
  // VCP bonus
  if (vcpDetected) conviction += 3;
  conviction = Math.min(100, Math.max(0, conviction));

  // ── Recommendation ───────────────────────────────────────────────────────
  const fullEmaStack = price > d1_ema9 && d1_ema9 > d1_ema20 && d1_ema20 > d1_ema50 && d1_ema50 > d1_ema200;
  let recommendation: PreorderAnalysis["recommendation"];
  if (conviction >= 72 && weinstein.stage === 2 && d1_rsi < 70) {
    if (fullEmaStack && ret1y > 15) {
      recommendation = { type: "longterm", label: "LONG TERM ↗", reason: "Stage 2 olgun, tam EMA stack, güçlü RS", hold: "3–12 ay" };
    } else {
      recommendation = { type: "swing", label: "SWING ↑", reason: "EMA uyumu + Wyckoff birikim + uygun RSI", hold: "5–20 gün" };
    }
  } else if (conviction >= 55) {
    recommendation = { type: "both", label: "SWING / LONG", reason: "Orta konviksiyon — strateji seçimine göre değerlendir", hold: "Pozisyon tipine göre" };
  } else {
    recommendation = { type: "wait", label: "BEKLE", reason: "Yeterli sinyal yok, koşulların olgunlaşmasını bekle", hold: "—" };
  }

  // ── Trade plan ───────────────────────────────────────────────────────────
  // Paylasilan motor (lib/tradePlanEngine.ts) — /api/ask'in (analiz sayfasi)
  // kullandigi ayni pivot/ATR tabanli zon mantigi, boylece grafik sayfasi ve
  // analiz sayfasi ayni ticker icin celismez.
  const zones = calculateTradePlanZones(
    closes1d, highs1d, lows1d,
    closes1h.length > 0 ? closes1h : null,
    highs1h.length > 0 ? highs1h : null,
    lows1h.length > 0 ? lows1h : null,
    opens1h.length > 0 ? opens1h : null,
    vols1h.length > 0 ? vols1h : null,
    price
  );

  // Hedefler paylasilan motorun swing TP merdiveninden gelir (tp1..tp3) —
  // eskiden en yakin 3 direnc alinyordu, bu da scalp seviyesinde dar
  // hedefler gosteriyordu ve /analysis ile celisiyordu.
  const targets = [zones.tp1, zones.tp2, zones.tp3].map((p, i) => ({
    price: p,
    rr: zones.riskUsd > 0 ? +((p - zones.avgEntry) / zones.riskUsd).toFixed(1) : 0,
    label: `Target ${i + 1}`,
  }));

  const rationale = buildTradePlanRationale({
    price, ema20: d1_ema20, ema50: d1_ema50, ema200: d1_ema200,
    vwap, rvol, rsi: d1_rsi, zones, lang,
  });

  // Gecersizlik: risk<=0 (stop entry'nin uzerinde kaldi, %5 tabanina ragmen)
  // ya da acik dusus yapisi (Weinstein Stage 4) — boyle bir kurulumda long
  // pozisyon icin anlamli bir plan yok.
  const tradePlanValid = zones.riskUsd > 0 && weinstein.stage !== 4;

  const result: PreorderAnalysis = {
    ticker,
    company: meta.shortName || meta.longName || ticker,
    exchange: meta.exchangeName || meta.fullExchangeName || "NASDAQ",
    price:     +price.toFixed(2),
    prevClose: +prevClose.toFixed(2),
    changePct: +changePct.toFixed(2),
    volume:    curVol,
    avgVol30:  Math.round(avgVol30),
    rvol:      +rvol.toFixed(2),
    generatedAt: new Date().toISOString(),
    context: {
      hi52: +hi52.toFixed(2), lo52: +lo52.toFixed(2), pct52h: +pct52h.toFixed(1),
      atr: +d1_atr.toFixed(2), atrPct: +atrPct.toFixed(2),
      weinstein, stockReturn1y: +ret1y.toFixed(1), vcpDetected,
    },
    timeframes: {
      d1: {
        ema9: +d1_ema9.toFixed(2), ema20: +d1_ema20.toFixed(2),
        ema50: +d1_ema50.toFixed(2), ema200: +d1_ema200.toFixed(2),
        rsi: +d1_rsi.toFixed(1), pattern: d1_pat, rvol: +rvol.toFixed(2),
        pivots: pivots1d, pivotsWeekly: pivotsW,
        swingHigh: +d1_swings.swingHigh.toFixed(2),
        swingLow:  +d1_swings.swingLow.toFixed(2),
        swingHighs: d1_swings.allHighs.map(v => +v.toFixed(2)),
        swingLows:  d1_swings.allLows.map(v => +v.toFixed(2)),
      },
      h1: {
        ema9: +h1_ema9.toFixed(2), ema20: +h1_ema20.toFixed(2), ema50: +h1_ema50.toFixed(2),
        rsi: +h1_rsi.toFixed(1), pattern: h1_pat, rvol: +h1_rvol.toFixed(2),
        pivots: h1_pivots,
        swingHigh: +h1_swings.swingHigh.toFixed(2),
        swingLow:  +h1_swings.swingLow.toFixed(2),
      },
      m15: {
        ema9: +m15_ema9.toFixed(2), ema20: +m15_ema20.toFixed(2),
        pattern: m15_pat, vwap: +vwap.toFixed(2),
        pivots: m15_pivots,
        swingHigh: +m15_swings.swingHigh.toFixed(2),
        swingLow:  +m15_swings.swingLow.toFixed(2),
      },
    },
    wyckoff: wyckoffResult,
    srLevels: srLevels.slice(0, 14),
    conviction,
    recommendation,
    tradePlan: {
      entryZone: zones.buyZone,
      entryType: zones.entryEngine.type,
      entryCondition: rationale.entryCondition,
      stop: { price: zones.stopPrice, pct: +(((zones.stopPrice - price) / price) * 100).toFixed(1) },
      stopRationale: rationale.stopRationale,
      targets,
      riskReward: zones.riskReward,
      rationale: { ema: rationale.ema, vwap: rationale.vwap, volume: rationale.volume, rsi: rationale.rsi },
      valid: tradePlanValid,
    },
    momentum: {
      macd: +macdResult.macd.toFixed(3), macdSignal: +macdResult.signal.toFixed(3), macdHist: +macdResult.histogram.toFixed(3),
      adx: +d1_adx.toFixed(1), roc10: +roc10.toFixed(1), bbPercent: +bbPercent.toFixed(2),
    },
    bogaScore: { trend: trendScore, momentum: momentumScore, liquidity: liquidityScore },
    activeSignals,
    warnings,
    aiCommentary: generateAiMarketCommentary({
      ticker,
      category: getAssetCategory(ticker),
      price,
      changePct,
      rsi: d1_rsi,
      rvol,
      atrPct,
      ema20: d1_ema20,
      ema50: d1_ema50,
      ema200: d1_ema200,
      vwap,
      pivotP: pivots1d.p,
      pivotR1: pivots1d.r1,
      pivotS1: pivots1d.s1,
      wyckoffScore: wyckoffResult.score,
      weinsteinStage: weinstein.stage,
      macdHist: macdResult.histogram,
      lang,
    }),
  };

  cache.set(cacheKey, { data: result, ts: Date.now() });
  return NextResponse.json(localizeAnalysis(result, lang));
}
