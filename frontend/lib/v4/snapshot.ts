/**
 * SPX SuperTrade — Seans Kurgulayıcı
 * Piyasa verisini çeker, dakika dakika kare (frame) üretir ve hem canlı
 * anlık görüntüyü hem de yeniden oynatma yanıtını hazırlar.
 * Canlı mod ile simülasyon modu AYNI hesaplama yolunu kullanır.
 */

import { createClient } from "@supabase/supabase-js";

import type {
  Bar,
  FuturesLevels,
  FeedHealth,
  ForecastBundle,
  Frame,
  FrameLite,
  Decision,
  AssetReplayResponse,
  AssetSnapshot,
  RolloverInfo,
  SpotLevels,
  StructureSet,
  AssetClass,
} from "./types";
import { ASSET_MAP } from "./types";
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
  computeFuturesLevels,
  computeSpotLevels,
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
const cacheInFlight = new Map<string, Promise<unknown>>();

/**
 * TTL önbellek + eşzamanlı istek birleştirme (in-flight dedup). `symbol=ALL`
 * modu 6 varlığı paralel çözerken ES=F/NQ=F/^VIX/^VXN gibi paylaşılan
 * enstrümanlar için aynı anda birden fazla Yahoo isteği atılmasını önler.
 */
async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as T;

  const pending = cacheInFlight.get(key);
  if (pending) return pending as Promise<T>;

  const promise = fn()
    .then((value) => {
      cache.set(key, { value, expires: Date.now() + ttlMs });
      return value;
    })
    .finally(() => {
      cacheInFlight.delete(key);
    });

  cacheInFlight.set(key, promise);
  return promise;
}

export interface MarketData {
  futures1m: Bar[];
  spot1m: Bar[];
  nq1m: Bar[];
  vix1m: Bar[];
  spxDaily: Bar[];
  vixDaily: Bar[];
  esMarketPrice: number | null;
  spxMarketPrice: number | null;
  nqMarketPrice: number | null;
  vixMarketPrice: number | null;
  /** Çapraz kontrol enstrümanının Yahoo sembolü (SPX ailesi için NQ=F, NDX ailesi için ES=F) */
  crossFutures: string;
  /** Çapraz kontrol enstrümanının görünen adı ("NQ" veya "ES") */
  crossLabel: string;
  recentLostTrades: { direction: string; net_score: number }[];
  errors: string[];
}

export async function loadMarketData(asset: AssetClass, intradayTtlMs = 15000): Promise<MarketData> {
  const info = ASSET_MAP[asset];
  // Çapraz kontrol her zaman DİĞER endeks ailesinin vadelisidir: SPX ailesi
  // (ES=F) için NQ, NDX ailesi (NQ=F) için ES. Aksi halde bir varlığın
  // kendi vadelisiyle kendini karşılaştırması gibi anlamsız bir durum oluşur.
  const crossFutures = info.futures === "NQ=F" ? "ES=F" : "NQ=F";
  const crossLabel = crossFutures === "NQ=F" ? "NQ" : "ES";

  const [es, spx, nq, vix, spxD, vixD] = await Promise.all([
    cached(`futures1m-${info.futures}`, intradayTtlMs, () => fetchBars(info.futures, "1m", "5d", true)),
    cached(`spot1m-${info.spot}`, intradayTtlMs, () => fetchBars(info.spot, "1m", "5d", false)),
    cached(`futures1m-${crossFutures}`, intradayTtlMs, () => fetchBars(crossFutures, "1m", "2d", true)),
    cached(`vix1m-${info.vix}`, intradayTtlMs, () => fetchBars(info.vix, "1m", "2d", false)),
    cached(`spot1d-${info.spot}`, 6 * 60 * 60 * 1000, () => fetchBars(info.spot, "1d", "2y", false)),
    cached(`vix1d-${info.vix}`, 6 * 60 * 60 * 1000, () => fetchBars(info.vix, "1d", "3mo", false)),
  ]);

  const errors: string[] = [];
  if (es.error) errors.push(`Vadeli verisi alınamadı (${es.error})`);
  if (spx.error) errors.push(`Spot verisi alınamadı (${spx.error})`);
  if (nq.error) errors.push(`${crossLabel} verisi alınamadı (${nq.error})`);
  if (vix.error) errors.push(`VIX verisi alınamadı (${vix.error})`);

  const result: MarketData = {
    futures1m: es.bars,
    spot1m: spx.bars,
    nq1m: nq.bars,
    vix1m: vix.bars,
    spxDaily: spxD.bars,
    vixDaily: vixD.bars,
    esMarketPrice: es.marketPrice,
    spxMarketPrice: spx.marketPrice,
    nqMarketPrice: nq.marketPrice,
    vixMarketPrice: vix.marketPrice,
    crossFutures,
    crossLabel,
    recentLostTrades: [], // varsayılan
    errors,
  };

  // ML mantığı için son 5 LOST işlemi Supabase'den çek
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { data } = await supabase
        .from("supertrade_logs")
        .select("direction, net_score")
        .eq("asset", asset)
        .eq("status", "LOST")
        .order("created_at", { ascending: false })
        .limit(5);
      if (data) {
        result.recentLostTrades = data;
      }
    }
  } catch (e) {
    console.error("ML history fetch error", e);
  }

  return result;
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
  levels: { spot: SpotLevels; futures: FuturesLevels };
  esChart: Bar[];
  spxChart: Bar[];
  esOvernight: Bar[];
  esRthFirst: Bar | null;
  nqChangePct: number;
  esChangePct: number;
}

export function buildSession(data: MarketData, sessionDate: string, asset: AssetClass): SessionBuild | null {
  const allDates = sessionDates(data.spot1m);
  const isFuture = allDates.length > 0 && sessionDate > allDates[allDates.length - 1];
  if (!allDates.includes(sessionDate) && !isFuture) return null;
  const info = ASSET_MAP[asset];
  const scale = info.scale;
  const futuresLabel = info.futures.replace("=F", "");
  const assetLabel = asset as string;

  const slices = buildSessionSlices(data.futures1m, data.spot1m, sessionDate, allDates);
  const { spxRth, esRth, esVwap, esOvernight } = slices;
  
  if (!spxRth.length) {
    if (!esOvernight.length) return null;
    
    const lastSpxDaily = data.spxDaily[data.spxDaily.length - 1];
    const prevSpxClose = lastSpxDaily ? lastSpxDaily.close : data.spxMarketPrice ?? 0;
    const lastEsOvernight = esOvernight[esOvernight.length - 1];
    const p = nyParts(lastEsOvernight.time);
    
    // Statik (gün boyunca değişmeyen) seviyeler bir kez hesaplanır
    const staticEs = computeFuturesLevels(data.futures1m, slices, scale);
    const staticSpx = computeSpotLevels(data.spot1m, slices);

    const esLevels: FuturesLevels = {
      ...staticEs,
      vwap: lastEsOvernight.close,
      vwapSlope: "FLAT",
      vwapDistance: 0,
      priceVsVwap: "AT",
      sessionHigh: staticEs.pdc,
      sessionLow: staticEs.pdc,
      isVwapChop: false,
    };
    
    const spxLevels: SpotLevels = {
      ...staticSpx,
      orh: 0,
      orl: 0,
      orMid: 0,
      orSize: 0,
      isOrDefined: false,
      sessionHigh: prevSpxClose,
      sessionLow: prevSpxClose,
      vsOr: "INSIDE",
    };
    
    const structure: StructureSet = {
      futures15m: "RANGE",
      futures5m: "RANGE",
      futures1m: "RANGE",
      spot5m: "RANGE",
      spot1m: "RANGE",
    };
    
    const decision: Decision = {
      direction: "NEUTRAL",
      tone: "NEUTRAL",
      action: "Piyasa Açılışını Bekleyin",
      confirmation: "Pre-market aşamasında (SPX kapalı).",
      invalidation: "-",
      triggerLevelName: "N/A",
      triggerLevelValue: 0,
      statusBadge: "Beklemede",
      statusStrength: "none",
    };
    
    const frame: Frame = {
      index: 0,
      time: lastEsOvernight.time,
      timeLabel: p.hhmm,
      spotPrice: round2(prevSpxClose),
      futuresPrice: round2(lastEsOvernight.close),
      basis: round2(lastEsOvernight.close - prevSpxClose),
      vwap: esLevels.vwap,
      longScore: 0,
      shortScore: 0,
      netScore: 0,
      state: "NEUTRAL",
      confidence: "LOW",
      phase: sessionPhase(p.minutes),
      trigger: 0,
      factors: [],
      structure,
      decision,
    };
    
    const nqRth = data.nq1m.filter((b) => {
      const pn = nyParts(b.time);
      return pn.ymd === slices.prevDate && pn.minutes >= RTH_OPEN_MIN;
    });
    
    return {
      sessionDate,
      prevDate: slices.prevDate,
      frames: [frame],
      levels: { spot: spxLevels, futures: esLevels },
      esChart: slices.esChart,
      spxChart: slices.spxChart,
      esOvernight: slices.esOvernight,
      esRthFirst: null,
      nqChangePct: pctChangeFromOpen(nqRth, nqRth.length - 1),
      esChangePct: 0,
    };
  }

  // Statik (gün boyunca değişmeyen) seviyeler bir kez hesaplanır
  const staticEs = computeFuturesLevels(data.futures1m, slices, scale);
  const staticSpx = computeSpotLevels(data.spot1m, slices);

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
    const spxLevels: SpotLevels = {
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
    let slope: FuturesLevels["vwapSlope"] = "FLAT";
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

    const esLevels: FuturesLevels = {
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
      futures15m: trendStructure(aggregate(esSoFar, 15), 12, 1),
      futures5m: trendStructure(aggregate(esSoFar, 5), 20, 1),
      futures1m: trendStructure(esSoFar, 40, 2),
      spot5m: trendStructure(aggregate(spxSoFar, 5), 20, 1),
      spot1m: trendStructure(spxSoFar, 40, 2),
    };

    const longBreak = evaluateBreakout(spxSoFar, spxLevels.orh, "LONG");
    const shortBreak = evaluateBreakout(spxSoFar, spxLevels.orl, "SHORT");

    const scores = computeScores({
      spotPrice: spxBar.close,
      futuresPrice: esBar.close,
      nqChangePct: pctChangeFromOpen(nqRth, nqIdx[i]),
      vixChangePct: pctChangeFromOpen(vixRth, vixIdx[i]),
      es: esLevels,
      spx: spxLevels,
      structure,
      longBreak,
      shortBreak,
      futuresLabel,
      assetLabel,
      crossLabel: data.crossLabel,
      recentLostTrades: data.recentLostTrades,
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
      spotPrice: round2(spxBar.close),
      futuresPrice: round2(esBar.close),
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
  const finalSpx: SpotLevels = {
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
      : lastFrame.spotPrice > orh
      ? "ABOVE"
      : lastFrame.spotPrice < orl
      ? "BELOW"
      : "INSIDE",
  };

  const finalEs: FuturesLevels = {
    ...staticEs,
    vwap: lastFrame.vwap,
    sessionHigh: round2(esRunHigh),
    sessionLow: round2(esRunLow),
  };

  return {
    sessionDate,
    prevDate: slices.prevDate,
    frames,
    levels: { spot: finalSpx, futures: finalEs },
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

// ── Gün geçişi (rollover) ─────────────────────────────────────────

/** sessionDate'den sonraki bir sonraki işlem günü — hafta sonu atlanır */
function nextWeekday(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  do {
    date.setUTCDate(date.getUTCDate() + 1);
  } while (date.getUTCDay() === 0 || date.getUTCDay() === 6);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(
    date.getUTCDate()
  ).padStart(2, "0")}`;
}

/**
 * Kapanış sonrası ertesi gün özeti — V4SuperTradeForecast panelindeki basit
 * tahmin motoruyla AYNI mantık, burada sunucu tarafında önceden hesaplanıp
 * anlık görüntüye eklenir ki dashboard/detay ekranları 17:00 ET'den itibaren
 * bunu doğrudan gösterebilsin (istemcinin ayrı hesaplama yapması gerekmez).
 */
function computeForecastBundle(input: {
  futuresPrice: number;
  vwap: number;
  spotPrice: number;
  orh: number;
  orl: number;
  volTrend: "RISING" | "FALLING" | "STABLE";
  analogBias: "BULLISH" | "BEARISH" | "NEUTRAL";
}): ForecastBundle {
  let score = 0;
  if (input.futuresPrice > input.vwap) score += 1;
  else if (input.futuresPrice < input.vwap) score -= 1;

  if (input.spotPrice > input.orh) score += 2;
  else if (input.spotPrice < input.orl) score -= 2;

  if (input.volTrend === "FALLING") score += 1;
  else if (input.volTrend === "RISING") score -= 1;

  if (input.analogBias === "BULLISH") score += 1;
  else if (input.analogBias === "BEARISH") score -= 1;

  let bias: ForecastBundle["bias"] = "NEUTRAL";
  if (score >= 2) bias = "BULLISH";
  else if (score <= -2) bias = "BEARISH";

  let analysisText: string;
  if (bias === "BULLISH") {
    analysisText =
      "Kapanışın VWAP ve direnç seviyeleri üzerinde olması, alıcıların kontrolü ele aldığını gösteriyor. VIX seviyesindeki gevşeme de bu durumu destekliyor. Ertesi gün için yukarı yönlü (Gap Up) açılış veya yükseliş trendinin devamı beklenebilir.";
  } else if (bias === "BEARISH") {
    analysisText =
      "Kapanışın kritik seviyelerin ve VWAP'ın altında kalması, zayıflığa işaret ediyor. Artan veya yüksek kalan VIX oynaklığı satıcıların iştahlı olduğunu gösteriyor. Ertesi gün zayıf bir açılış (Gap Down) muhtemeldir.";
  } else {
    analysisText =
      "Piyasa günü denge arayışı içinde tamamladı. Belirgin bir alıcı veya satıcı baskısı yok. Yarınki açılış yönü büyük ihtimalle gece seansındaki (overnight) gelişmelere bağlı olacaktır.";
  }

  return { bias, score, analysisText };
}

function buildRollover(sessionDate: string, isLiveSession: boolean, nowParts: { ymd: string; minutes: number }): RolloverInfo {
  const displayDate = nowParts.ymd;
  const isNextDay = displayDate !== sessionDate;
  // Gece yarısını geçtiysek (isNextDay) saat sıfırlanmış olur — o durumda da
  // eşik zaten geçilmiş sayılır, sadece nowParts.minutes >= 17:00 kontrolü
  // yetmez.
  const pastPrepThreshold = isNextDay || nowParts.minutes >= 17 * 60;
  const prepReady = !isLiveSession && pastPrepThreshold;
  return {
    displayDate,
    isNextDay,
    nextTradingDate: nextWeekday(sessionDate),
    prepReady,
  };
}

export async function buildSnapshot(asset: AssetClass): Promise<AssetSnapshot> {
  const data = await loadMarketData(asset);
  const notes = [...data.errors];
  const nowSec = Math.floor(Date.now() / 1000);

  const sessionDate = latestSessionDate(data.spot1m, nowSec);
  if (!sessionDate) {
    throw new Error(`${asset} seans verisi alınamadı`);
  }

  const session = buildSession(data, sessionDate, asset);
  if (!session || !session.frames.length) {
    throw new Error("Seans kareleri oluşturulamadı");
  }

  const frames = session.frames;
  const last = frames[frames.length - 1];
  const nowParts = nyParts(nowSec);
  // RTH_OPEN_MIN alt sınırı kritik: latestSessionDate artık gece yarısını
  // geçer geçmez sessionDate'i "bugüne" ilerletiyor (premarket devri), bu
  // kontrol olmadan 00:00–09:30 ET arası (SPX henüz kapalıyken) yanlışlıkla
  // "canlı seans" sayılıp minutesToClose/Strateji Lab gerçek dışı (~700+ dk)
  // bir süre üzerinden fiyatlama yapıyordu.
  const isLiveSession =
    nowParts.ymd === sessionDate && nowParts.minutes >= RTH_OPEN_MIN && nowParts.minutes < 16 * 60 + 5;

  // Seans açık değilken bile doğru evreyi bildir: hafta içi 04:00–09:30 ET
  // arası "açılış öncesi"dir, "seans kapalı" değil.
  const isWeekday = nowParts.weekday >= 1 && nowParts.weekday <= 5;
  const currentPhase: AssetSnapshot["phase"] = isLiveSession
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
    spot1m: data.spot1m,
    spxDaily: data.spxDaily,
    vixDaily: data.vixDaily,
    esOvernight: session.esOvernight,
    esRthFirst: session.esRthFirst,
    esPdc: session.levels.futures.pdc,
    onMid: session.levels.futures.onMid,
    nqChangePct: session.nqChangePct,
    esChangePct: session.esChangePct,
    crossLabel: data.crossLabel,
    spotPrice: last.spotPrice,
    state,
  });

  // Son 5 dakikada ne değişti
  // Türkçe rakam biçimi (binlik nokta, ondalık virgül) — UI'daki `fmt()` ile
  // aynı kural, sunucu tarafında üretilen "from"/"to" metinleri için.
  const fmtTr = (v: number, digits = 2) =>
    v.toLocaleString("tr-TR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  // "WATCH_LONG" → "Watch Long" — durum değişimi satırında ham enum değerinin
  // tamamen büyük harfle görünmesini engeller.
  const stateLabel = (s: string) =>
    s
      .replace(/_/g, " ")
      .toLocaleLowerCase("tr-TR")
      .split(" ")
      .map((w) => (w ? w.charAt(0).toLocaleUpperCase("tr-TR") + w.slice(1) : w))
      .join(" ");

  const ref = frames[Math.max(0, frames.length - 6)];
  const changes: AssetSnapshot["changes"] = [];
  if (ref && ref.index !== last.index) {
    const netDelta = round2(last.netScore - ref.netScore);
    changes.push({
      label: "Net skor",
      from: `${ref.netScore >= 0 ? "+" : ""}${fmtTr(ref.netScore, 1)}`,
      to: `${last.netScore >= 0 ? "+" : ""}${fmtTr(last.netScore, 1)}`,
      tone: netDelta > 0 ? "UP" : netDelta < 0 ? "DOWN" : "FLAT",
    });
    const spxDelta = round2(last.spotPrice - ref.spotPrice);
    changes.push({
      label: asset,
      from: fmtTr(ref.spotPrice, 2),
      to: `${spxDelta >= 0 ? "+" : ""}${fmtTr(spxDelta, 2)} puan`,
      tone: spxDelta > 0 ? "UP" : spxDelta < 0 ? "DOWN" : "FLAT",
    });
    if (ref.state !== last.state) {
      // Yeni durum SHORT ise kırmızı, LONG ise yeşil — teyit gücünden bağımsız.
      const stateTone: "UP" | "DOWN" | "FLAT" = last.state.includes("SHORT")
        ? "DOWN"
        : last.state.includes("LONG")
        ? "UP"
        : "FLAT";
      changes.push({ label: "Durum", from: stateLabel(ref.state), to: stateLabel(last.state), tone: stateTone });
    }
    const vwapPos = last.futuresPrice >= last.vwap;
    changes.push({
      label: "Vadeli / VWAP",
      from: fmtTr(last.vwap, 2),
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
      ? last.spotPrice - Math.max(5, session.levels.spot.orSize * 2)
      : last.spotPrice + Math.max(5, session.levels.spot.orSize * 2);

  const scale = ASSET_MAP[asset].scale;
  const chain = buildChain({
    spot: last.spotPrice,
    vix,
    minutesLeft,
    type: chainType,
    targetPrice: target,
    scale,
  });

  const runners = simulateRunners({ frames, vix, scale });

  const feeds: FeedHealth[] = [
    feedHealth(ASSET_MAP[asset].futures, "Vadeli", data.futures1m, nowSec, isLiveSession),
    feedHealth(ASSET_MAP[asset].spot, "Spot", data.spot1m, nowSec, isLiveSession),
    feedHealth(data.crossFutures, `${data.crossLabel} Vadeli (Çapraz Kontrol)`, data.nq1m, nowSec, isLiveSession),
    feedHealth(ASSET_MAP[asset].vix, "VIX", data.vix1m, nowSec, isLiveSession),
  ];

  const rollover = buildRollover(sessionDate, isLiveSession, nowParts);
  const forecast = rollover.prepReady
    ? computeForecastBundle({
        futuresPrice: last.futuresPrice,
        vwap: last.vwap,
        spotPrice: last.spotPrice,
        orh: session.levels.spot.orh,
        orl: session.levels.spot.orl,
        volTrend: context.volatility.trend,
        analogBias: context.analog.bias,
      })
    : null;

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
    asset,
    spotPrice: last.spotPrice,
    futuresPrice: last.futuresPrice,
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
    bars: { futures: toCompact(session.esChart), spot: toCompact(session.spxChart) },
    frames: frames.map(toLite),
    rollover,
    forecast,
  };
}

/** Canlı modda ağ yükünü düşürmek için gerekçe/karar alanlarını çıkarır */
function toLite(f: Frame): FrameLite {
  return {
    index: f.index,
    time: f.time,
    timeLabel: f.timeLabel,
    spotPrice: f.spotPrice,
    futuresPrice: f.futuresPrice,
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

export async function buildReplay(asset: AssetClass, dateParam?: string): Promise<AssetReplayResponse> {
  const data = await loadMarketData(asset, 60000);
  const notes = [...data.errors];

  const available = sessionDates(data.spot1m);
  if (!available.length) throw new Error("Yeniden oynatma için seans verisi bulunamadı");

  const date = dateParam && available.includes(dateParam) ? dateParam : available[available.length - 1];
  if (dateParam && dateParam !== date) {
    notes.push(`${dateParam} için 1 dakikalık veri bulunamadı; ${date} seansı yüklendi.`);
  }

  const session = buildSession(data, date, asset);
  if (!session || !session.frames.length) throw new Error("Seans yeniden oluşturulamadı");

  const last = session.frames[session.frames.length - 1];

  const context = buildContext({
    sessionDate: date,
    prevDate: session.prevDate,
    spot1m: data.spot1m,
    spxDaily: data.spxDaily,
    vixDaily: data.vixDaily,
    esOvernight: session.esOvernight,
    esRthFirst: session.esRthFirst,
    esPdc: session.levels.futures.pdc,
    onMid: session.levels.futures.onMid,
    nqChangePct: session.nqChangePct,
    esChangePct: session.esChangePct,
    crossLabel: data.crossLabel,
    spotPrice: last.spotPrice,
    state: last.state,
  });

  const runners = simulateRunners({
    frames: session.frames,
    vix: context.volatility.vix || 15,
    scale: ASSET_MAP[asset].scale,
  });

  return {
    ok: true,
    date,
    availableDates: available,
    generatedAt: new Date().toISOString(),
    levels: session.levels,
    context,
    frames: session.frames,
    bars: { futures: toCompact(session.esChart), spot: toCompact(session.spxChart) },
    runners,
    notes,
  };
}

// ── Anlık görüntü önbelleği ──────────────────────────────────────

const snapshotCache = new Map<string, { value: AssetSnapshot; expires: number }>();
const inFlightMap = new Map<string, Promise<AssetSnapshot>>();

/**
 * Anlık görüntüyü önbellekten döndürür. Seans kapalıyken veri saatlerce
 * değişmediği için TTL 5 dakikaya çıkar; böylece kapalı piyasada her 20
 * saniyede bir 6 uzak istek yapılmaz. Eşzamanlı istekler tek yapıma
 * bağlanır (thundering herd koruması).
 */
export async function getSnapshot(asset: AssetClass): Promise<AssetSnapshot> {
  const cacheKey = `snapshot-${asset}`;
  const cached = snapshotCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return cached.value;

  let inFlight = inFlightMap.get(cacheKey);
  if (inFlight) return inFlight;

  inFlight = buildSnapshot(asset)
    .then((value) => {
      const ttl = value.isLiveSession ? 10000 : 5 * 60 * 1000;
      snapshotCache.set(cacheKey, { value, expires: Date.now() + ttl });
      return value;
    })
    .finally(() => {
      inFlightMap.delete(cacheKey);
    });

  inFlightMap.set(cacheKey, inFlight);
  return inFlight;
}

export { impliedVolFor, vwapSeries };
