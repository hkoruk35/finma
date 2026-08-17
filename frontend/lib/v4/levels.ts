/**
 * SPX SuperTrade — Deterministik Seviye, VWAP ve Yapı Motoru
 * Globex ONH/ONL, önceki gün PDH/PDL/PDC, açılış aralığı (OR5),
 * seans VWAP'ı ve çok zaman dilimli trend yapısını hesaplar.
 * Tüm fonksiyonlar saftır (yan etkisiz), aynı girdi aynı çıktıyı verir.
 */

import type { Bar, FuturesLevels, SpotLevels, TrendStructure } from "./types";
import {
  RTH_OPEN_MIN,
  aggregate,
  barsOnDate,
  nyParts,
  overnightBars,
  premarketBars,
  round2,
} from "./yahoo";

/** Kümülatif VWAP serisi — i. eleman, 0..i mumlarının VWAP'ıdır */
export function vwapSeries(bars: Bar[]): number[] {
  const out: number[] = [];
  let tpv = 0;
  let vol = 0;
  let fallbackSum = 0;

  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    const typical = (b.high + b.low + b.close) / 3;
    fallbackSum += typical;
    const v = b.volume || 0;
    tpv += typical * v;
    vol += v;
    // Hacim gelmeyen semboller (endeksler) için basit ortalamaya düşer
    out.push(vol > 0 ? tpv / vol : fallbackSum / (i + 1));
  }
  return out;
}

/**
 * Basit fraktal pivot tabanlı trend yapısı.
 * Son iki tepe ve son iki dip karşılaştırılır: HH+HL = yükselen, LH+LL = düşen.
 */
export function trendStructure(bars: Bar[], lookback = 40, strength = 2): TrendStructure {
  const window = bars.slice(-lookback);
  if (window.length < strength * 2 + 3) return "RANGE";

  const highs: number[] = [];
  const lows: number[] = [];

  for (let i = strength; i < window.length - strength; i++) {
    let isHigh = true;
    let isLow = true;
    for (let j = i - strength; j <= i + strength; j++) {
      if (j === i) continue;
      if (window[j].high >= window[i].high) isHigh = false;
      if (window[j].low <= window[i].low) isLow = false;
    }
    if (isHigh) highs.push(window[i].high);
    if (isLow) lows.push(window[i].low);
  }

  const hh = highs.length >= 2 ? highs[highs.length - 1] > highs[highs.length - 2] : null;
  const hl = lows.length >= 2 ? lows[lows.length - 1] > lows[lows.length - 2] : null;

  if (hh === true && hl === true) return "UPTREND";
  if (hh === false && hl === false) return "DOWNTREND";

  // Pivot yetersizse net fiyat değişimine bakılır
  if (hh === null || hl === null) {
    const first = window[0].close;
    const last = window[window.length - 1].close;
    const range = Math.max(...window.map((b) => b.high)) - Math.min(...window.map((b) => b.low));
    if (range > 0) {
      const drift = (last - first) / range;
      if (drift > 0.45) return "UPTREND";
      if (drift < -0.45) return "DOWNTREND";
    }
  }
  return "RANGE";
}

export interface SessionSlices {
  sessionDate: string;
  prevDate: string | null;
  esRth: Bar[];
  spxRth: Bar[];
  esOvernight: Bar[];
  esPremarket: Bar[];
  esVwap: number[];
  /** Grafik için: gece seansı + RTH (ES) */
  esChart: Bar[];
  spxChart: Bar[];
}

export function buildSessionSlices(
  futuresBars: Bar[],
  spotBars: Bar[],
  sessionDate: string,
  allDates: string[]
): SessionSlices {
  const idx = allDates.indexOf(sessionDate);
  const prevDate = idx > 0 ? allDates[idx - 1] : null;

  const esRth = barsOnDate(futuresBars, sessionDate);
  const spxRth = barsOnDate(spotBars, sessionDate);
  const esOn = overnightBars(futuresBars, sessionDate, prevDate);
  const esPm = premarketBars(futuresBars, sessionDate);

  return {
    sessionDate,
    prevDate,
    esRth,
    spxRth,
    esOvernight: esOn,
    esPremarket: esPm,
    esVwap: vwapSeries(esRth),
    esChart: [...esOn, ...esRth],
    spxChart: spxRth,
  };
}

export function computeFuturesLevels(
  futuresBars: Bar[],
  slices: SessionSlices,
  scale: number,
  upToIndex?: number
): FuturesLevels {
  const { sessionDate, prevDate, esOvernight, esPremarket } = slices;
  const rth = upToIndex === undefined ? slices.esRth : slices.esRth.slice(0, upToIndex + 1);
  const vwaps = slices.esVwap;

  const result: FuturesLevels = {
    vwap: 0,
    vwapSlope: "FLAT",
    priceVsVwap: "AT",
    vwapDistance: 0,
    onh: 0,
    onl: 0,
    onMid: 0,
    onRange: 0,
    premarketHigh: 0,
    premarketLow: 0,
    pdh: 0,
    pdl: 0,
    pdc: 0,
    sessionHigh: 0,
    sessionLow: 0,
    isVwapChop: false,
  };

  if (esOvernight.length) {
    const onh = Math.max(...esOvernight.map((b) => b.high));
    const onl = Math.min(...esOvernight.map((b) => b.low));
    result.onh = round2(onh);
    result.onl = round2(onl);
    result.onMid = round2((onh + onl) / 2);
    result.onRange = round2(onh - onl);
  }

  if (esPremarket.length) {
    result.premarketHigh = round2(Math.max(...esPremarket.map((b) => b.high)));
    result.premarketLow = round2(Math.min(...esPremarket.map((b) => b.low)));
  }

  if (prevDate) {
    const prev = barsOnDate(futuresBars, prevDate);
    if (prev.length) {
      result.pdh = round2(Math.max(...prev.map((b) => b.high)));
      result.pdl = round2(Math.min(...prev.map((b) => b.low)));
      result.pdc = round2(prev[prev.length - 1].close);
    }
  }

  if (rth.length) {
    result.sessionHigh = round2(Math.max(...rth.map((b) => b.high)));
    result.sessionLow = round2(Math.min(...rth.map((b) => b.low)));

    const i = rth.length - 1;
    const vwap = vwaps[i] ?? rth[i].close;
    const price = rth[i].close;
    result.vwap = round2(vwap);
    result.vwapDistance = round2(price - vwap);

    if (price > vwap + 0.5 * scale) result.priceVsVwap = "ABOVE";
    else if (price < vwap - 0.5 * scale) result.priceVsVwap = "BELOW";
    else result.priceVsVwap = "AT";

    if (i >= 5) {
      const delta = vwaps[i] - vwaps[i - 5];
      if (delta > 0.25 * scale) result.vwapSlope = "RISING";
      else if (delta < -0.25 * scale) result.vwapSlope = "FALLING";
    }

    // Son 10 barda VWAP'ı 4+ kez kesiyorsa testere (chop) rejimi
    if (i >= 10) {
      let crosses = 0;
      for (let k = i - 9; k <= i; k++) {
        const prevAbove = rth[k - 1].close > vwaps[k - 1];
        const currAbove = rth[k].close > vwaps[k];
        if (prevAbove !== currAbove) crosses++;
      }
      result.isVwapChop = crosses >= 4;
    }
  }

  // Gece verisi yoksa önceki seans aralığına düş
  if (!result.onh && prevDate) {
    const prev = barsOnDate(futuresBars, prevDate);
    if (prev.length) {
      result.onh = round2(Math.max(...prev.map((b) => b.high)));
      result.onl = round2(Math.min(...prev.map((b) => b.low)));
      result.onMid = round2((result.onh + result.onl) / 2);
      result.onRange = round2(result.onh - result.onl);
    }
  }

  void sessionDate;
  return result;
}

export function computeSpotLevels(
  spotBars: Bar[],
  slices: SessionSlices,
  upToIndex?: number
): SpotLevels {
  const { prevDate } = slices;
  const rth = upToIndex === undefined ? slices.spxRth : slices.spxRth.slice(0, upToIndex + 1);

  const result: SpotLevels = {
    orh: 0,
    orl: 0,
    orMid: 0,
    orSize: 0,
    isOrDefined: false,
    pdh: 0,
    pdl: 0,
    pdc: 0,
    sessionHigh: 0,
    sessionLow: 0,
    vsOr: "INSIDE",
  };

  if (prevDate) {
    const prev = barsOnDate(spotBars, prevDate);
    if (prev.length) {
      result.pdh = round2(Math.max(...prev.map((b) => b.high)));
      result.pdl = round2(Math.min(...prev.map((b) => b.low)));
      result.pdc = round2(prev[prev.length - 1].close);
    }
  }

  if (!rth.length) return result;

  result.sessionHigh = round2(Math.max(...rth.map((b) => b.high)));
  result.sessionLow = round2(Math.min(...rth.map((b) => b.low)));

  // OR5 = 09:30–09:35 ET arasındaki ilk 5 dakikalık mum
  const orBars = slices.spxRth.filter((b) => {
    const p = nyParts(b.time);
    return p.minutes >= RTH_OPEN_MIN && p.minutes < RTH_OPEN_MIN + 5;
  });

  // Replay sırasında OR henüz oluşmamış olabilir
  const orAvailable = rth.length >= Math.min(5, orBars.length) && orBars.length > 0;

  if (orAvailable) {
    const usable = orBars.slice(0, Math.min(orBars.length, rth.length));
    const orh = Math.max(...usable.map((b) => b.high));
    const orl = Math.min(...usable.map((b) => b.low));
    result.orh = round2(orh);
    result.orl = round2(orl);
    result.orMid = round2((orh + orl) / 2);
    result.orSize = round2(orh - orl);
    result.isOrDefined = rth.length >= 5;

    const last = rth[rth.length - 1].close;
    if (last > orh) result.vsOr = "ABOVE";
    else if (last < orl) result.vsOr = "BELOW";
    else result.vsOr = "INSIDE";
  }

  return result;
}

export interface BreakoutState {
  /** Fiyat seviyenin ötesinde mi (1 dakikalık) */
  probed: boolean;
  /** 5 dakikalık kapanış ötede mi (acceptance) */
  accepted: boolean;
  /** Daha önce ötesine geçip geri döndü mü (tuzak kırılım) */
  failed: boolean;
  /** Kaç dakikadır ötede */
  barsBeyond: number;
  /** Tuzak kırılımdan bu yana geçen dakika (tazelik kontrolü) */
  barsSinceFailure: number;
}

export function evaluateBreakout(
  spxRth: Bar[],
  level: number,
  direction: "LONG" | "SHORT"
): BreakoutState {
  const empty: BreakoutState = {
    probed: false,
    accepted: false,
    failed: false,
    barsBeyond: 0,
    barsSinceFailure: Infinity,
  };
  if (!spxRth.length || !level) return empty;

  const beyond = (price: number) => (direction === "LONG" ? price > level : price < level);

  const last = spxRth[spxRth.length - 1];
  const probed = beyond(last.close);

  // 5 dakikalık kapanış teyidi
  const fiveMin = aggregate(spxRth, 5);
  const closed5 = fiveMin.length >= 2 ? fiveMin[fiveMin.length - 2] : null;
  const accepted = probed && !!closed5 && beyond(closed5.close);

  let barsBeyond = 0;
  for (let i = spxRth.length - 1; i >= 0; i--) {
    if (beyond(spxRth[i].close)) barsBeyond++;
    else break;
  }

  // Daha önce en az 3 bar ötede kalıp şu an geri dönmüşse tuzak kırılım.
  // Tazelik önemlidir: gün içinde çok önce olmuş bir tuzak kırılım,
  // güncel durumu artık tanımlamaz.
  let failed = false;
  let barsSinceFailure = Infinity;

  if (!probed) {
    let run = 0;
    let lastBeyondIndex = -1;
    for (let i = 0; i < spxRth.length; i++) {
      if (beyond(spxRth[i].close)) {
        run++;
        lastBeyondIndex = i;
        if (run >= 3) failed = true;
      } else {
        run = 0;
      }
    }
    if (failed && lastBeyondIndex >= 0) {
      barsSinceFailure = spxRth.length - 1 - lastBeyondIndex;
    }
  }

  return { probed, accepted, failed, barsBeyond, barsSinceFailure };
}
