/**
 * SPX SuperTrade — Seans Kurgulayıcı
 * Piyasa verisini çeker, dakika dakika kare (frame) üretir ve hem canlı
 * anlık görüntüyü hem de yeniden oynatma yanıtını hazırlar.
 * Canlı mod ile simülasyon modu AYNI hesaplama yolunu kullanır.
 */

import type {
  Bar,
  EsLevels,
  FeedHealth,
  Frame,
  FrameLite,
  SPXReplayResponse,
  SPXSnapshot,
  SpxLevels,
  StructureSet,
} from "./types";
import {
  aggregate,
  fetchBars,
  latestSessionDate,
  nyParts,
  RTH_OPEN_MIN,
  round2,
  sessionDates,
  toCompact,
} from "./yahoo";
import {
  buildSessionSlices,
  computeEsLevels,
  computeSpxLevels,
  evaluateBreakout,
  trendStructure,
  vwapSeries,
} from "./levels";
import {
  buildDecision,
  computeScores,
  determineState,
  sessionPhase,
} from "./scoring";
import { buildContext } from "./context";
import { buildChain, impliedVolFor, minutesToClose, simulateRunners } from "./options";

// ── Basit bellek içi önbellek ────────────────────────────────────

interface CacheEntry<T> {
  value: T;
  expires: number;
}
const cache = new Map<string, CacheEntry<unknown>>();

async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as T;
  const value = await fn();
  cache.set(key, { value, expires: Date.now() + ttlMs });
  return value;
}

export interface MarketData {
  es1m: Bar[];
  spx1m: Bar[];
  nq1m: Bar[];
  vix1m: Bar[];
  spxDaily: Bar[];
  vixDaily: Bar[];
  esMarketPrice: number | null;
  spxMarketPrice: number | null;
  nqMarketPrice: number | null;
  vixMarketPrice: number | null;
  errors: string[];
}

export async function loadMarketData(intradayTtlMs = 15000): Promise<MarketData> {
  const [es, spx, nq, vix, spxD, vixD] = await Promise.all([
    cached("es1m", intradayTtlMs, () => fetchBars("ES", "1m", "5d", true)),
    cached("spx1m", intradayTtlMs, () => fetchBars("SPX", "1m", "5d", false)),
    cached("nq1m", intradayTtlMs, () => fetchBars("NQ", "1m", "2d", true)),
    cached("vix1m", intradayTtlMs, () => fetchBars("VIX", "1m", "2d", false)),
    cached("spx1d", 6 * 60 * 60 * 1000, () => fetchBars("SPX", "1d", "2y", false)),
    cached("vix1d", 6 * 60 * 60 * 1000, () => fetchBars("VIX", "1d", "3mo", false)),
  ]);

  const errors: string[] = [];
  if (es.error) errors.push(`ES verisi alınamadı (${es.error})`);
  if (spx.error) errors.push(`SPX verisi alınamadı (${spx.error})`);
  if (nq.error) errors.push(`NQ verisi alınamadı (${nq.error})`);
  if (vix.error) errors.push(`VIX verisi alınamadı (${vix.error})`);

  return {
    es1m: es.bars,
    spx1m: spx.bars,
    nq1m: nq.bars,
    vix1m: vix.bars,
    spxDaily: spxD.bars,
    vixDaily: vixD.bars,
    esMarketPrice: es.marketPrice,
    spxMarketPrice: spx.marketPrice,
    nqMarketPrice: nq.marketPrice,
    vixMarketPrice: vix.marketPrice,
    errors,
  };
}

// ── Kare (frame) üretimi ─────────────────────────────────────────

/** Zaman damgasına göre hizalama indeksi: her hedef zaman için <= olan son bar */
function alignIndex(source: Bar[], targets: number[]): number[] {
  const out: number[] = [];
  let j = -1;
  for (const t of targets) {
    while (j + 1 < source.length && source[j + 1].time <= t) j++;
    out.push(j);
  }
  return out;
}

function pctChangeFromOpen(bars: Bar[], idx: number): number {
  if (idx < 0 || !bars.length) return 0;
  const open = bars[0].open || bars[0].close;
  if (!open) return 0;
  return ((bars[idx].close - open) / open) * 100;
}

export interface SessionBuild {
  sessionDate: string;
  prevDate: string | null;
  frames: Frame[];
  levels: { spx: SpxLevels; es: EsLevels };
  esChart: Bar[];
  spxChart: Bar[];
  esOvernight: Bar[];
  esRthFirst: Bar | null;
  nqChangePct: number;
  esChangePct: number;
}

export function buildSession(data: MarketData, sessionDate: string): SessionBuild | null {
  const allDates = sessionDates(data.spx1m);
  if (!allDates.includes(sessionDate)) return null;

  const slices = buildSessionSlices(data.es1m, data.spx1m, sessionDate, allDates);
  const { spxRth, esRth, esVwap } = slices;
  if (!spxRth.length) return null;

  // Statik (gün boyunca değişmeyen) seviyeler bir kez hesaplanır
  const staticEs = computeEsLevels(data.es1m, slices);
  const staticSpx = computeSpxLevels(data.spx1m, slices);

  const targets = spxRth.map((b) => b.time);
  const esIdx = alignIndex(esRth, targets);
  const nqRth = data.nq1m.filter((b) => {
    const p = nyParts(b.time);
    return p.ymd === sessionDate && p.minutes >= RTH_OPEN_MIN;
  });
  const vixRth = data.vix1m.filter((b) => {
    const p = nyParts(b.time);
    return p.ymd === sessionDate && p.minutes >= RTH_OPEN_MIN;
  });
  const nqIdx = alignIndex(nqRth, targets);
  const vixIdx = alignIndex(vixRth, targets);

  // Açılış aralığı (OR5) — ilk 5 dakika
  const orBars = spxRth.filter((b) => {
    const p = nyParts(b.time);
    return p.minutes >= RTH_OPEN_MIN && p.minutes < RTH_OPEN_MIN + 5;
  });
  const orh = orBars.length ? round2(Math.max(...orBars.map((b) => b.high))) : 0;
  const orl = orBars.length ? round2(Math.min(...orBars.map((b) => b.low))) : 0;

  const frames: Frame[] = [];
  let runHigh = -Infinity;
  let runLow = Infinity;
  let esRunHigh = -Infinity;
  let esRunLow = Infinity;

  for (let i = 0; i < spxRth.length; i++) {
    const spxBar = spxRth[i];
    const p = nyParts(spxBar.time);
    const ei = esIdx[i] >= 0 ? esIdx[i] : 0;
    const esBar = esRth[ei] ?? spxBar;

    runHigh = Math.max(runHigh, spxBar.high);
    runLow = Math.min(runLow, spxBar.low);
    esRunHigh = Math.max(esRunHigh, esBar.high);
    esRunLow = Math.min(esRunLow, esBar.low);

    const orDefined = i >= 4 && orh > 0;

    // Dinamik SPX seviyeleri
    const spxLevels: SpxLevels = {
      ...staticSpx,
      orh: orDefined ? orh : 0,
      orl: orDefined ? orl : 0,
      orMid: orDefined ? round2((orh + orl) / 2) : 0,
      orSize: orDefined ? round2(orh - orl) : 0,
      isOrDefined: orDefined,
      sessionHigh: round2(runHigh),
      sessionLow: round2(runLow),
      vsOr: !orDefined
        ? "INSIDE"
        : spxBar.close > orh
        ? "ABOVE"
        : spxBar.close < orl
        ? "BELOW"
        : "INSIDE",
    };

    // Dinamik ES seviyeleri (VWAP ve seans aralığı)
    const vwap = esVwap[ei] ?? esBar.close;
    let slope: EsLevels["vwapSlope"] = "FLAT";
    if (ei >= 5) {
      const d = esVwap[ei] - esVwap[ei - 5];
      slope = d > 0.25 ? "RISING" : d < -0.25 ? "FALLING" : "FLAT";
    }
    let chop = false;
    if (ei >= 10) {
      let crosses = 0;
      for (let k = ei - 9; k <= ei; k++) {
        if ((esRth[k - 1].close > esVwap[k - 1]) !== (esRth[k].close > esVwap[k])) crosses++;
      }
      chop = crosses >= 4;
    }

    const esLevels: EsLevels = {
      ...staticEs,
      vwap: round2(vwap),
      vwapSlope: slope,
      vwapDistance: round2(esBar.close - vwap),
      priceVsVwap:
        esBar.close > vwap + 0.5 ? "ABOVE" : esBar.close < vwap - 0.5 ? "BELOW" : "AT",
      sessionHigh: round2(esRunHigh),
      sessionLow: round2(esRunLow),
      isVwapChop: chop,
    };

    const esSoFar = esRth.slice(0, ei + 1);
    const spxSoFar = spxRth.slice(0, i + 1);

    const structure: StructureSet = {
      es15m: trendStructure(aggregate(esSoFar, 15), 12, 1),
      es5m: trendStructure(aggregate(esSoFar, 5), 20, 1),
      es1m: trendStructure(esSoFar, 40, 2),
      spx5m: trendStructure(aggregate(spxSoFar, 5), 20, 1),
      spx1m: trendStructure(spxSoFar, 40, 2),
    };

    const longBreak = evaluateBreakout(spxSoFar, spxLevels.orh, "LONG");
    const shortBreak = evaluateBreakout(spxSoFar, spxLevels.orl, "SHORT");

    const scores = computeScores({
      spxPrice: spxBar.close,
      esPrice: esBar.close,
      nqChangePct: pctChangeFromOpen(nqRth, nqIdx[i]),
      vixChangePct: pctChangeFromOpen(vixRth, vixIdx[i]),
      es: esLevels,
      spx: spxLevels,
      structure,
      longBreak,
      shortBreak,
    });

    const prev10 = frames[i - 10];
    const netScoreDelta = prev10 ? scores.netScore - prev10.netScore : 0;

    const phase = sessionPhase(p.minutes);
    const state = determineState({
      phase,
      isStale: false,
      spx: spxLevels,
      es: esLevels,
      netScore: scores.netScore,
      longBreak,
      shortBreak,
      netScoreDelta,
    });

    const decision = buildDecision(state, spxLevels, esLevels, { longBreak, shortBreak });

    frames.push({
      index: i,
      time: spxBar.time,
      timeLabel: p.hhmm,
      spxPrice: round2(spxBar.close),
      esPrice: round2(esBar.close),
      basis: round2(esBar.close - spxBar.close),
      vwap: esLevels.vwap,
      longScore: scores.longScore,
      shortScore: scores.shortScore,
      netScore: scores.netScore,
      state,
      confidence: scores.confidence,
      phase,
      trigger: decision.triggerLevelValue,
      factors: scores.factors,
      structure,
      decision,
    });
  }

  const lastFrame = frames[frames.length - 1];
  const finalSpx: SpxLevels = {
    ...staticSpx,
    orh,
    orl,
    orMid: orh ? round2((orh + orl) / 2) : 0,
    orSize: orh ? round2(orh - orl) : 0,
    isOrDefined: orh > 0,
    sessionHigh: round2(runHigh),
    sessionLow: round2(runLow),
    vsOr: !orh
      ? "INSIDE"
      : lastFrame.spxPrice > orh
      ? "ABOVE"
      : lastFrame.spxPrice < orl
      ? "BELOW"
      : "INSIDE",
  };

  const finalEs: EsLevels = {
    ...staticEs,
    vwap: lastFrame.vwap,
    sessionHigh: round2(esRunHigh),
    sessionLow: round2(esRunLow),
  };

  return {
    sessionDate,
    prevDate: slices.prevDate,
    frames,
    levels: { spx: finalSpx, es: finalEs },
    esChart: slices.esChart,
    spxChart: slices.spxChart,
    esOvernight: slices.esOvernight,
    esRthFirst: esRth[0] ?? null,
    nqChangePct: pctChangeFromOpen(nqRth, nqRth.length - 1),
    esChangePct: esRth.length ? ((esRth[esRth.length - 1].close - esRth[0].open) / esRth[0].open) * 100 : 0,
  };
}

// ── Canlı anlık görüntü ──────────────────────────────────────────

function feedHealth(
  symbol: string,
  label: string,
  bars: Bar[],
  nowSec: number,
  isLiveSession: boolean
): FeedHealth {
  if (!bars.length) {
    return { symbol, label, status: "MISSING", ageSec: 0, lastPrice: 0 };
  }
  const last = bars[bars.length - 1];
  const age = Math.max(0, Math.round(nowSec - last.time));
  // Seans kapalıyken veri "gecikmeli" değildir — son kapanış verisidir.
  // İkisini ayırmazsak kapalı piyasada 50 saatlik "gecikme" gösterilir.
  let status: FeedHealth["status"] = "LIVE";
  if (!isLiveSession) status = "CLOSED";
  else if (age > 300) status = "STALE";
  else if (age > 120) status = "DELAYED";
  return { symbol, label, status, ageSec: age, lastPrice: round2(last.close) };
}

export async function buildSnapshot(): Promise<SPXSnapshot> {
  const data = await loadMarketData();
  const notes = [...data.errors];
  const nowSec = Math.floor(Date.now() / 1000);

  const sessionDate = latestSessionDate(data.spx1m);
  if (!sessionDate) {
    throw new Error("SPX seans verisi alınamadı");
  }

  const session = buildSession(data, sessionDate);
  if (!session || !session.frames.length) {
    throw new Error("Seans kareleri oluşturulamadı");
  }

  const frames = session.frames;
  const last = frames[frames.length - 1];
  const nowParts = nyParts(nowSec);
  const isLiveSession = nowParts.ymd === sessionDate && nowParts.minutes < 16 * 60 + 5;

  // Seans açık değilken bile doğru evreyi bildir: hafta içi 04:00–09:30 ET
  // arası "açılış öncesi"dir, "seans kapalı" değil.
  const isWeekday = nowParts.weekday >= 1 && nowParts.weekday <= 5;
  const currentPhase: SPXSnapshot["phase"] = isLiveSession
    ? last.phase
    : isWeekday && nowParts.minutes >= 4 * 60 && nowParts.minutes < RTH_OPEN_MIN
    ? "PREMARKET"
    : "AFTER_HOURS";

  const dataAgeSec = Math.max(0, nowSec - last.time);
  const isStale = isLiveSession && dataAgeSec > 300;
  if (isStale) notes.push("Son mum 5 dakikadan eski — sinyaller askıya alındı.");
  if (!isLiveSession) {
    notes.push(
      `Piyasa kapalı — gösterilen değerler ${sessionDate} seansının kapanış verileridir.`
    );
  }

  const state = isStale ? "DATA_STALE" : last.state;

  const context = buildContext({
    sessionDate,
    prevDate: session.prevDate,
    spx1m: data.spx1m,
    spxDaily: data.spxDaily,
    vixDaily: data.vixDaily,
    esOvernight: session.esOvernight,
    esRthFirst: session.esRthFirst,
    esPdc: session.levels.es.pdc,
    onMid: session.levels.es.onMid,
    nqChangePct: session.nqChangePct,
    esChangePct: session.esChangePct,
    spotPrice: last.spxPrice,
    state,
  });

  // Son 5 dakikada ne değişti
  const ref = frames[Math.max(0, frames.length - 6)];
  const changes: SPXSnapshot["changes"] = [];
  if (ref && ref.index !== last.index) {
    const netDelta = round2(last.netScore - ref.netScore);
    changes.push({
      label: "Net skor",
      from: ref.netScore.toFixed(1),
      to: `${last.netScore >= 0 ? "+" : ""}${last.netScore.toFixed(1)}`,
      tone: netDelta > 0 ? "UP" : netDelta < 0 ? "DOWN" : "FLAT",
    });
    const spxDelta = round2(last.spxPrice - ref.spxPrice);
    changes.push({
      label: "SPX",
      from: ref.spxPrice.toFixed(2),
      to: `${spxDelta >= 0 ? "+" : ""}${spxDelta.toFixed(2)} puan`,
      tone: spxDelta > 0 ? "UP" : spxDelta < 0 ? "DOWN" : "FLAT",
    });
    if (ref.state !== last.state) {
      changes.push({ label: "Durum", from: ref.state, to: last.state, tone: "FLAT" });
    }
    const vwapPos = last.esPrice >= last.vwap;
    changes.push({
      label: "ES / VWAP",
      from: `${last.vwap.toFixed(2)}`,
      to: vwapPos ? "üstünde" : "altında",
      tone: vwapPos ? "UP" : "DOWN",
    });
  }

  const vix = context.volatility.vix || data.vixMarketPrice || 15;
  const minutesLeft = minutesToClose(
    isLiveSession ? nowParts.minutes : 15 * 60 + 30
  );

  const direction = last.decision.direction;
  const chainType: "CALL" | "PUT" = direction === "SHORT" ? "PUT" : "CALL";
  const target =
    direction === "SHORT"
      ? last.spxPrice - Math.max(5, session.levels.spx.orSize * 2)
      : last.spxPrice + Math.max(5, session.levels.spx.orSize * 2);

  const chain = buildChain({
    spot: last.spxPrice,
    vix,
    minutesLeft,
    type: chainType,
    targetPrice: target,
  });

  const runners = simulateRunners({ frames, vix });

  const feeds: FeedHealth[] = [
    feedHealth("ES", "ES Vadeli (CME)", data.es1m, nowSec, isLiveSession),
    feedHealth("SPX", "SPX Endeksi (CBOE)", data.spx1m, nowSec, isLiveSession),
    feedHealth("NQ", "NQ Vadeli (CME)", data.nq1m, nowSec, isLiveSession),
    feedHealth("VIX", "VIX (CBOE)", data.vix1m, nowSec, isLiveSession),
  ];

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    asOf: new Date(last.time * 1000).toISOString(),
    sessionDate,
    phase: currentPhase,
    isLiveSession,
    dataAgeSec,
    isStale,
    notes,
    feeds,
    spxPrice: last.spxPrice,
    esPrice: last.esPrice,
    nqPrice: data.nq1m.length ? round2(data.nq1m[data.nq1m.length - 1].close) : 0,
    vixPrice: round2(vix),
    basis: last.basis,
    levels: session.levels,
    structure: last.structure,
    longScore: last.longScore,
    shortScore: last.shortScore,
    netScore: last.netScore,
    factors: last.factors,
    confidence: last.confidence,
    state,
    decision: last.decision,
    changes,
    context,
    chain,
    runners,
    bars: { es: toCompact(session.esChart), spx: toCompact(session.spxChart) },
    frames: frames.map(toLite),
  };
}

/** Canlı modda ağ yükünü düşürmek için gerekçe/karar alanlarını çıkarır */
function toLite(f: Frame): FrameLite {
  return {
    index: f.index,
    time: f.time,
    timeLabel: f.timeLabel,
    spxPrice: f.spxPrice,
    esPrice: f.esPrice,
    basis: f.basis,
    vwap: f.vwap,
    longScore: f.longScore,
    shortScore: f.shortScore,
    netScore: f.netScore,
    state: f.state,
    confidence: f.confidence,
    phase: f.phase,
    trigger: f.trigger,
  };
}

// ── Yeniden oynatma (simülasyon) ─────────────────────────────────

export async function buildReplay(dateParam?: string): Promise<SPXReplayResponse> {
  const data = await loadMarketData(60000);
  const notes = [...data.errors];

  const available = sessionDates(data.spx1m);
  if (!available.length) throw new Error("Yeniden oynatma için seans verisi bulunamadı");

  const date = dateParam && available.includes(dateParam) ? dateParam : available[available.length - 1];
  if (dateParam && dateParam !== date) {
    notes.push(`${dateParam} için 1 dakikalık veri bulunamadı; ${date} seansı yüklendi.`);
  }

  const session = buildSession(data, date);
  if (!session || !session.frames.length) throw new Error("Seans yeniden oluşturulamadı");

  const last = session.frames[session.frames.length - 1];

  const context = buildContext({
    sessionDate: date,
    prevDate: session.prevDate,
    spx1m: data.spx1m,
    spxDaily: data.spxDaily,
    vixDaily: data.vixDaily,
    esOvernight: session.esOvernight,
    esRthFirst: session.esRthFirst,
    esPdc: session.levels.es.pdc,
    onMid: session.levels.es.onMid,
    nqChangePct: session.nqChangePct,
    esChangePct: session.esChangePct,
    spotPrice: last.spxPrice,
    state: last.state,
  });

  const runners = simulateRunners({
    frames: session.frames,
    vix: context.volatility.vix || 15,
  });

  return {
    ok: true,
    date,
    availableDates: available,
    generatedAt: new Date().toISOString(),
    levels: session.levels,
    context,
    frames: session.frames,
    bars: { es: toCompact(session.esChart), spx: toCompact(session.spxChart) },
    runners,
    notes,
  };
}

// ── Anlık görüntü önbelleği ──────────────────────────────────────

let snapshotCache: { value: SPXSnapshot; expires: number } | null = null;
let inFlight: Promise<SPXSnapshot> | null = null;

/**
 * Anlık görüntüyü önbellekten döndürür. Seans kapalıyken veri saatlerce
 * değişmediği için TTL 5 dakikaya çıkar; böylece kapalı piyasada her 20
 * saniyede bir 6 uzak istek yapılmaz. Eşzamanlı istekler tek yapıma
 * bağlanır (thundering herd koruması).
 */
export async function getSnapshot(): Promise<SPXSnapshot> {
  if (snapshotCache && snapshotCache.expires > Date.now()) return snapshotCache.value;
  if (inFlight) return inFlight;

  inFlight = buildSnapshot()
    .then((value) => {
      const ttl = value.isLiveSession ? 10000 : 5 * 60 * 1000;
      snapshotCache = { value, expires: Date.now() + ttl };
      return value;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

export { impliedVolFor, vwapSeries };
