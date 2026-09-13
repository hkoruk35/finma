/**
 * SPY Engine — Dönüş Yakalama Modülü (Reversal Catch Layer)
 *
 * Tier 3 mikro giriş tetikleyicisi. Mevcut rejim tespiti (TREND/SIKIŞMA/BELİRSİZ)
 * katmanını DEĞİŞTİRMEZ; makro filtre olarak kalmaya devam eder.
 * Bu modül mikro giriş tetikleyicisi ve çıkış uyarı sistemidir.
 *
 * Strateji:
 *   Katman 0 — Early Warning: RSI aşırı bölgesi + BB teması + hacim → WATCH_PUT/CALL
 *   Katman 1 — Entry Trigger: Mum formasyonu + hacim teyidi + RSI dönüşü → GİRİŞ
 *   Çıkış    — Exit Warning: Ters mum + hacim + RSI 50 kesişimi → ÇIKIŞ UYARISI
 *
 * Market hours: Sadece NY 09:30-16:00 arasında sinyaller aktifleşir.
 * Diğer saatlerde hesaplamalar yapılır fakat sinyal üretilmez (sadece takip).
 *
 * NOT: Bu modül strategy.ts'deki mevcut giriş/çıkış mantığını DEĞİŞTİRMEZ;
 * GatePanel'in yeni gösterimi için bağımsız paralel bir katmandır.
 * Aynı veriden farklı bir lens: AND-tabanlı (hepsi-birden) yerine puanlama tabanlı.
 */

import { bollinger, rsi, sma, nyParts, RTH_OPEN_MIN, RTH_CLOSE_MIN, type Bar } from "./core";

// ── Config (hardcode değil — tüm eşikler burada) ───────────────────

export const REVERSAL_CONFIG = {
  rsi_period: 14,
  rsi_overbought: 65,
  rsi_oversold: 35,
  vol_sma_period: 20,
  vol_spike_multiplier: 1.5,
  bb_period: 20,
  bb_stddev: 2,
  watch_score_threshold: 2,   // 3 üzerinden
  entry_score_threshold: 2,   // 3 üzerinden
  exit_score_threshold: 2,    // 3 üzerinden
  pinbar_wick_ratio: 2,       // fitil/gövde oranı
  pinbar_body_max_ratio: 0.35, // gövde/range üst sınırı
} as const;

// ── Tipler ──────────────────────────────────────────────────────────

export type WatchState = "WATCH_PUT" | "WATCH_CALL" | "NONE";

export interface ReversalCheck {
  label: string;
  ok: boolean;
  detail: string;
}

export interface ReversalState {
  /** NY 09:30-16:00 içinde mi? Hayırsa sinyaller susturulmuş (sadece takip). */
  isMarketHours: boolean;
  /** Katman 0: izleme modu */
  watchState: WatchState;
  watchScore: number;
  watchChecks: ReversalCheck[];
  /** Katman 1: giriş tetikleyici */
  entryTrigger: boolean;
  entryScore: number;
  entryChecks: ReversalCheck[];
  /** Çıkış uyarısı (pozisyon açıkken aktif) */
  exitWarn: boolean;
  exitScore: number;
  exitChecks: ReversalCheck[];
  /** Gösterge verileri */
  rsi5m: number | null;
  bbUpper: number | null;
  bbLower: number | null;
  volSma20: number | null;
  lastVol: number | null;
  /** Aktif pozisyon yönü (çıkış hesaplaması için) */
  openSide: "LONG" | "SHORT" | null;
  note: string;
}

// ── Saat kontrolü ───────────────────────────────────────────────────

function isNyMarketHours(epochSec: number): boolean {
  const p = nyParts(epochSec);
  return p.minutes >= RTH_OPEN_MIN && p.minutes < RTH_CLOSE_MIN;
}

// ── Mum formasyonu tespiti ──────────────────────────────────────────

function detectReversalCandle(
  prev: Bar,
  curr: Bar,
  direction: "BEARISH_REV" | "BULLISH_REV"
): { detected: boolean; kind: string } {
  const body = Math.abs(curr.close - curr.open);
  const range = curr.high - curr.low;
  const upperWick = curr.high - Math.max(curr.open, curr.close);
  const lowerWick = Math.min(curr.open, curr.close) - curr.low;
  const cfg = REVERSAL_CONFIG;

  if (range <= 0) return { detected: false, kind: "" };

  if (direction === "BEARISH_REV") {
    const isEngulfing =
      curr.close < curr.open &&
      prev.close > prev.open &&
      curr.open >= prev.close &&
      curr.close <= prev.open;
    const isPinBar = upperWick >= body * cfg.pinbar_wick_ratio && body / range < cfg.pinbar_body_max_ratio;
    if (isEngulfing) return { detected: true, kind: "Bearish Engulfing" };
    if (isPinBar) return { detected: true, kind: "Shooting Star / Pin Bar" };
  } else {
    const isEngulfing =
      curr.close > curr.open &&
      prev.close < curr.open &&
      curr.open <= prev.close &&
      curr.close >= prev.open;
    const isPinBar = lowerWick >= body * cfg.pinbar_wick_ratio && body / range < cfg.pinbar_body_max_ratio;
    if (isEngulfing) return { detected: true, kind: "Bullish Engulfing" };
    if (isPinBar) return { detected: true, kind: "Hammer / Pin Bar" };
  }
  return { detected: false, kind: "" };
}

// ── Katman 0 — Erken Uyarı ──────────────────────────────────────────

function checkEarlyWarning(
  curr: Bar,
  rsiVal: number | null,
  bbUpper: number | null,
  bbLower: number | null,
  volSma20: number | null,
  direction: "PUT_WATCH" | "CALL_WATCH"
): { score: number; checks: ReversalCheck[] } {
  const cfg = REVERSAL_CONFIG;
  const checks: ReversalCheck[] = [];

  if (direction === "PUT_WATCH") {
    const rsiHigh = rsiVal != null && rsiVal >= cfg.rsi_overbought;
    checks.push({
      label: `RSI ≥ ${cfg.rsi_overbought} (aşırı alım)`,
      ok: rsiHigh,
      detail: rsiVal == null ? "veri yok" : rsiVal.toFixed(0),
    });
    const bbTouch = bbUpper != null && curr.high >= bbUpper;
    checks.push({
      label: "Fiyat BB üst bandına değdi",
      ok: bbTouch,
      detail: bbUpper == null ? "veri yok" : `yüksek=${curr.high.toFixed(2)} / BB=${bbUpper.toFixed(2)}`,
    });
  } else {
    const rsiLow = rsiVal != null && rsiVal <= cfg.rsi_oversold;
    checks.push({
      label: `RSI ≤ ${cfg.rsi_oversold} (aşırı satım)`,
      ok: rsiLow,
      detail: rsiVal == null ? "veri yok" : rsiVal.toFixed(0),
    });
    const bbTouch = bbLower != null && curr.low <= bbLower;
    checks.push({
      label: "Fiyat BB alt bandına değdi",
      ok: bbTouch,
      detail: bbLower == null ? "veri yok" : `düşük=${curr.low.toFixed(2)} / BB=${bbLower.toFixed(2)}`,
    });
  }

  const volSpike = volSma20 != null && curr.volume >= volSma20 * cfg.vol_spike_multiplier;
  checks.push({
    label: `Hacim ≥ ${cfg.vol_spike_multiplier}× SMA20 (momentum)`,
    ok: volSpike,
    detail: volSma20 == null
      ? "veri yok"
      : `${curr.volume.toFixed(0)} / SMA=${volSma20.toFixed(0)}`,
  });

  const score = checks.filter((c) => c.ok).length;
  return { score, checks };
}

// ── Katman 1 — Giriş Tetikleyici ───────────────────────────────────

function checkEntryTrigger(
  prev: Bar,
  curr: Bar,
  rsiCurr: number | null,
  rsiPrev: number | null,
  watchState: WatchState
): { trigger: boolean; score: number; checks: ReversalCheck[] } {
  const cfg = REVERSAL_CONFIG;
  const isPut = watchState === "WATCH_PUT";
  const checks: ReversalCheck[] = [];

  const direction = isPut ? "BEARISH_REV" : "BULLISH_REV";
  const pattern = detectReversalCandle(prev, curr, direction);
  checks.push({
    label: `Dönüş mumu (${isPut ? "Bearish" : "Bullish"}: Engulfing veya Pin Bar)`,
    ok: pattern.detected,
    detail: pattern.detected ? pattern.kind : "formasyon yok",
  });

  const volOk = curr.volume > prev.volume;
  checks.push({
    label: "Hacim teyidi (dönüş mumu > önceki mum)",
    ok: volOk,
    detail: `${curr.volume.toFixed(0)} vs ${prev.volume.toFixed(0)}`,
  });

  const rsiTurning = isPut
    ? rsiPrev != null && rsiPrev >= cfg.rsi_overbought && rsiCurr != null && rsiCurr < rsiPrev
    : rsiPrev != null && rsiPrev <= cfg.rsi_oversold && rsiCurr != null && rsiCurr > rsiPrev;
  checks.push({
    label: `RSI dönüşü (extreme bölgeden geri ${isPut ? "dönüyor (aşağı)" : "dönüyor (yukarı)"})`,
    ok: rsiTurning,
    detail:
      rsiCurr == null || rsiPrev == null
        ? "veri yok"
        : `önceki=${rsiPrev.toFixed(0)} → şimdi=${rsiCurr.toFixed(0)}`,
  });

  const score = checks.filter((c) => c.ok).length;
  return {
    trigger: score >= cfg.entry_score_threshold,
    score,
    checks,
  };
}

// ── Çıkış Uyarısı ────────────────────────────────────────────────

function checkExitWarning(
  prev: Bar,
  curr: Bar,
  rsiCurr: number | null,
  rsiPrev: number | null,
  openSide: "LONG" | "SHORT"
): { warn: boolean; score: number; checks: ReversalCheck[] } {
  const cfg = REVERSAL_CONFIG;
  const oppDir = openSide === "LONG" ? "BEARISH_REV" : "BULLISH_REV";
  const checks: ReversalCheck[] = [];

  const pattern = detectReversalCandle(prev, curr, oppDir);
  checks.push({
    label: `Ters dönüş mumu (${openSide === "LONG" ? "Bearish" : "Bullish"})`,
    ok: pattern.detected,
    detail: pattern.detected ? pattern.kind : "formasyon yok",
  });

  const volSpike = curr.volume > prev.volume;
  checks.push({
    label: "Hacim artışı (ters yön momenti)",
    ok: volSpike,
    detail: `${curr.volume.toFixed(0)} vs ${prev.volume.toFixed(0)}`,
  });

  const rsiCross50 =
    openSide === "LONG"
      ? rsiCurr != null && rsiCurr < 50 && rsiPrev != null && rsiPrev >= 50
      : rsiCurr != null && rsiCurr > 50 && rsiPrev != null && rsiPrev <= 50;
  checks.push({
    label: `RSI 50 ${openSide === "LONG" ? "altına geçti" : "üstüne geçti"}`,
    ok: rsiCross50,
    detail:
      rsiCurr == null || rsiPrev == null
        ? "veri yok"
        : `önceki=${rsiPrev.toFixed(0)} → şimdi=${rsiCurr.toFixed(0)}`,
  });

  const score = checks.filter((c) => c.ok).length;
  return {
    warn: score >= cfg.exit_score_threshold,
    score,
    checks,
  };
}

// ── Ana fonksiyon ────────────────────────────────────────────────────

export interface ReversalInput {
  m5: Bar[];
  nowSec: number;
  openSide?: "LONG" | "SHORT" | null;
}

export function checkReversalCatch(input: ReversalInput): ReversalState {
  const { m5, nowSec, openSide = null } = input;
  const cfg = REVERSAL_CONFIG;

  const isMarketHours = isNyMarketHours(nowSec);

  const empty: ReversalState = {
    isMarketHours,
    watchState: "NONE",
    watchScore: 0,
    watchChecks: [],
    entryTrigger: false,
    entryScore: 0,
    entryChecks: [],
    exitWarn: false,
    exitScore: 0,
    exitChecks: [],
    rsi5m: null,
    bbUpper: null,
    bbLower: null,
    volSma20: null,
    lastVol: null,
    openSide,
    note: "5m veri yetersiz.",
  };

  if (m5.length < cfg.bb_period + 2) return empty;

  const closes = m5.map((b) => b.close);
  const highs = m5.map((b) => b.high);
  const lows = m5.map((b) => b.low);
  const volumes = m5.map((b) => b.volume);

  const rsiSeries = rsi(closes, cfg.rsi_period);
  const bbResult = bollinger(closes, cfg.bb_period, cfg.bb_stddev);
  const volSeries = sma(volumes, cfg.vol_sma_period);

  const last = m5.length - 1;
  const prev = last - 1;

  const rsiNow = rsiSeries[last];
  const rsiPrev = rsiSeries[prev];
  const bbUpper = bbResult.upper[last];
  const bbLower = bbResult.lower[last];
  const volSma20 = volSeries[last];
  const lastVol = m5[last].volume;

  const state: ReversalState = {
    ...empty,
    rsi5m: rsiNow,
    bbUpper,
    bbLower,
    volSma20,
    lastVol,
  };

  // ── Çıkış uyarısı (pozisyon açıksa) ─────────────────────────────
  if (openSide) {
    const exitResult = checkExitWarning(m5[prev], m5[last], rsiNow, rsiPrev, openSide);
    state.exitChecks = exitResult.checks;
    state.exitScore = exitResult.score;
    // Piyasa saatinde aktifleşir; dışında hesaplamalar yapılır ama warn=false
    state.exitWarn = isMarketHours && exitResult.warn;
  }

  // ── Katman 0: Erken uyarı ────────────────────────────────────────
  const putWatch = checkEarlyWarning(m5[last], rsiNow, bbUpper, bbLower, volSma20, "PUT_WATCH");
  const callWatch = checkEarlyWarning(m5[last], rsiNow, bbUpper, bbLower, volSma20, "CALL_WATCH");

  let watchState: WatchState = "NONE";
  let watchScore = 0;
  let watchChecks: ReversalCheck[] = [];

  if (putWatch.score >= cfg.watch_score_threshold && putWatch.score >= callWatch.score) {
    watchState = "WATCH_PUT";
    watchScore = putWatch.score;
    watchChecks = putWatch.checks;
  } else if (callWatch.score >= cfg.watch_score_threshold) {
    watchState = "WATCH_CALL";
    watchScore = callWatch.score;
    watchChecks = callWatch.checks;
  } else {
    // Her ikisi de eşiği geçmedi — en yüksek skoru göster
    const best = putWatch.score >= callWatch.score ? putWatch : callWatch;
    watchChecks = best.checks;
    watchScore = best.score;
  }

  state.watchState = watchState;
  state.watchScore = watchScore;
  state.watchChecks = watchChecks;

  // ── Katman 1: Giriş tetikleyici ─────────────────────────────────
  let entryTrigger = false;
  let entryScore = 0;
  let entryChecks: ReversalCheck[] = [];

  if (watchState !== "NONE") {
    const trig = checkEntryTrigger(m5[prev], m5[last], rsiNow, rsiPrev, watchState);
    entryScore = trig.score;
    entryChecks = trig.checks;
    // Piyasa saatinde ateşlenir; dışında hesaplamalar görünür ama trigger=false
    entryTrigger = isMarketHours && trig.trigger;
  }

  state.entryTrigger = entryTrigger;
  state.entryScore = entryScore;
  state.entryChecks = entryChecks;

  // ── Not ─────────────────────────────────────────────────────────
  if (!isMarketHours) {
    state.note = "Piyasa kapalı — sinyaller susturulmuş, takipte.";
  } else if (openSide && state.exitWarn) {
    state.note = `ÇIKIŞ UYARISI — ${openSide} pozisyon için ters dönüş sinyali (skor ${state.exitScore}/3).`;
  } else if (entryTrigger) {
    const dir = watchState === "WATCH_PUT" ? "PUT (düşüş)" : "CALL (yükseliş)";
    state.note = `GİRİŞ TETİKLEYİCİ — ${dir} · skor ${entryScore}/3.`;
  } else if (watchState !== "NONE") {
    const dir = watchState === "WATCH_PUT" ? "PUT" : "CALL";
    state.note = `${dir} İZLEME — erken uyarı aktif (skor ${watchScore}/3), giriş tetikleyici bekleniyor.`;
  } else {
    state.note = "İzleme modunda — erken uyarı koşulları sağlanmadı.";
  }

  return state;
}
