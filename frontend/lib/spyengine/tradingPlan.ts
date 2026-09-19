/**
 * SPY Opsiyon Trading Yol Haritası — hesaplama çekirdeği (19 Eyl 2026, @hasan).
 *
 * Mimari: 30m açılış rejimi (gün karakteri) → 15m ANA tetik (yön onayı olmuş
 * rejim + swing kırılımı + hacim + gövde/ATR filtresi) → 5m SADECE giriş
 * zamanlaması (bağımsız sinyal/stop üretmez) → stop 15m yapısından.
 *
 * İzomorfik: fetch/DOM yok, hem frontend (TS) hem gerekirse sunucu tarafında
 * çalışır. Tüm fonksiyonlar saftır (yan etkisiz) — girdi bar dizisi + index,
 * çıktı hesaplanmış değer/karar.
 */

import { atr as atrSeries, ema as emaSeries, sessionVwap, bucketAggregate, type Bar, type Series } from "./core";
import { pivots } from "./levels";

// ── Rejim (30m açılış filtresi) ────────────────────────────────────

export type RegimeDir = "YUKARI" | "AŞAĞI" | "BELİRSİZ";

export interface OpeningRangeRegime {
  regime: RegimeDir;
  rangeHigh: number;
  rangeLow: number;
  rangeOpen: number;
  rangeClose: number;
}

/**
 * İlk 30 dakikalık mum (09:30–10:00 ET) günün karakterini belirler.
 * `m5` seans başından itibaren 5m mumlar olmalı; ilk 6×5m mum 30m'a
 * toplanır (bucketAggregate zaten epoch hizalı kova kullanıyor).
 */
export function openingRangeRegime(m5SessionBars: Bar[]): OpeningRangeRegime | null {
  if (!m5SessionBars.length) return null;
  const m30 = bucketAggregate(m5SessionBars, 30);
  const first = m30[0];
  if (!first) return null;

  const vwap = sessionVwap(m5SessionBars);
  // İlk 30m penceresinin son 5m barının VWAP'ı = 30m kapanış anındaki VWAP
  const firstWindowBars = m5SessionBars.filter((b) => b.time < first.time + 30 * 60);
  const vwapAtClose = vwap[firstWindowBars.length - 1] ?? null;

  const brokeUp = first.close > first.open && vwapAtClose != null && first.close > vwapAtClose;
  const brokeDown = first.close < first.open && vwapAtClose != null && first.close < vwapAtClose;

  const regime: RegimeDir = brokeUp ? "YUKARI" : brokeDown ? "AŞAĞI" : "BELİRSİZ";

  return {
    regime,
    rangeHigh: first.high,
    rangeLow: first.low,
    rangeOpen: first.open,
    rangeClose: first.close,
  };
}

/**
 * İkinci 15m mum (09:45–10:00), 30m rejimle aynı yönde EMA21/VWAP hizası
 * ile kapanmalı. Aykırı kapanış = tez bozuldu, o gün işlem yok.
 */
export function regimeConfirmation15m(
  m15: Bar[],
  ema21_15m: Series,
  vwap15m: Series,
  idx: number,
  regime: RegimeDir
): boolean {
  if (regime === "BELİRSİZ") return false;
  const bar = m15[idx];
  const ema21 = ema21_15m[idx];
  const vwap = vwap15m[idx];
  if (!bar || ema21 == null || vwap == null) return false;
  if (regime === "YUKARI") return bar.close > ema21 && bar.close > vwap;
  return bar.close < ema21 && bar.close < vwap;
}

// ── 15m tetik (yeni ANA sinyal katmanı) ─────────────────────────────

/** Chop bandı dışındaki son anlamlı 15m dip/tepe — kırılım bunun dışında olmalı. */
export interface ChopBand {
  hi: number | null;
  lo: number | null;
}

export function chopBandOf(m15ClosedBars: Bar[], pivotLookback = 3): ChopBand {
  const { highs, lows } = pivots(m15ClosedBars, pivotLookback);
  return {
    hi: highs.length ? highs[highs.length - 1] : null,
    lo: lows.length ? lows[lows.length - 1] : null,
  };
}

/** Son N (varsayılan 8) kapalı 15m mumun ortalama hacmi. */
export function rollingVolumeAvg(bars: Bar[], idx: number, window = 8): number | null {
  const start = idx - window;
  if (start < 0) return null;
  let sum = 0;
  for (let i = start; i < idx; i++) sum += bars[i].volume || 0;
  return sum / window;
}

export function volumeFilterOk(bar: Bar, avgVol: number | null, mult = 1.15): boolean {
  if (avgVol == null || avgVol <= 0) return false;
  return (bar.volume || 0) >= avgVol * mult;
}

export function bodyAtrFilterOk(bar: Bar, atr15m: number | null, mult = 2): boolean {
  if (atr15m == null || atr15m <= 0) return false;
  return Math.abs(bar.close - bar.open) <= atr15m * mult;
}

export interface Trigger15mRead {
  fired: boolean;
  side: "LONG" | "SHORT" | null;
  regimeOk: boolean;
  breakoutOk: boolean;
  volumeOk: boolean;
  bodyOk: boolean;
  swingLevel: number | null;
  avgVol: number | null;
  atr15m: number | null;
}

/**
 * Asıl 15m tetik: dört şart birden sağlanmadan giriş yok.
 *   1) 15m mum rejim yönünde kapanır
 *   2) chop bandı dışındaki son swing dip/tepe kırılır
 *   3) hacim >= son 8×15m ortalamasının 1.15 katı
 *   4) gövde <= 15m ATR'nin 2 katı
 */
export function trigger15mAt(
  m15: Bar[],
  idx: number,
  regime: RegimeDir,
  chopBand: ChopBand,
  atr15Series: Series,
  volWindow = 8
): Trigger15mRead {
  const bar = m15[idx];
  const atr15m = atr15Series[idx] ?? null;
  const avgVol = rollingVolumeAvg(m15, idx, volWindow);
  const empty: Trigger15mRead = {
    fired: false, side: null, regimeOk: false, breakoutOk: false,
    volumeOk: false, bodyOk: false, swingLevel: null, avgVol, atr15m,
  };
  if (!bar || regime === "BELİRSİZ") return empty;

  const side: "LONG" | "SHORT" = regime === "YUKARI" ? "LONG" : "SHORT";
  const regimeOk = side === "LONG" ? bar.close > bar.open : bar.close < bar.open;

  const swingLevel = side === "LONG" ? chopBand.hi : chopBand.lo;
  const breakoutOk =
    swingLevel != null && (side === "LONG" ? bar.close > swingLevel : bar.close < swingLevel);

  const volumeOk = volumeFilterOk(bar, avgVol);
  const bodyOk = bodyAtrFilterOk(bar, atr15m);

  return {
    fired: regimeOk && breakoutOk && volumeOk && bodyOk,
    side,
    regimeOk,
    breakoutOk,
    volumeOk,
    bodyOk,
    swingLevel,
    avgVol,
    atr15m,
  };
}

/** 15m serisi için ATR(14) — dışa açık kısaltma. */
export function atr15mSeries(m15: Bar[]): Series {
  return atrSeries(m15, 14);
}

export function ema21Of15m(m15: Bar[]): Series {
  return emaSeries(m15.map((b) => b.close), 21);
}

// ── 5m alt katman — SADECE giriş zamanlaması ────────────────────────

export interface FiveMinuteRefinement {
  readyToEnter: boolean;
  note: string;
}

/**
 * 5m bağımsız strateji DEĞİLDİR: 15m tetiği zaten onaylanmışken en erken
 * güvenli giriş anını bulur. Bağımsız sinyal üretmez, bağımsız stop üretmez
 * — stop her zaman 15m yapısından gelir (stopSpyOf). İkinci 5m mumu
 * beklemek gerekmez; tek mumluk hacim/RSI teyidi yeterlidir.
 */
export function fiveMinuteRefinement(
  m5WithinTriggerBar: Bar[],
  rsi5m: Series,
  triggerSide: "LONG" | "SHORT" | null
): FiveMinuteRefinement {
  if (!triggerSide || !m5WithinTriggerBar.length) {
    return { readyToEnter: false, note: "15m tetik onayı bekleniyor" };
  }
  const lastIdx = m5WithinTriggerBar.length - 1;
  const bar = m5WithinTriggerBar[lastIdx];
  const r = rsi5m[lastIdx];
  if (r == null) return { readyToEnter: false, note: "5m RSI hesaplanamadı" };

  const priceOk = triggerSide === "LONG" ? bar.close >= bar.open : bar.close <= bar.open;
  const rsiOk = triggerSide === "LONG" ? r > 50 : r < 50;

  return {
    readyToEnter: priceOk && rsiOk,
    note: priceOk && rsiOk
      ? "5m fiyat + RSI teyidi tamam — en erken güvenli giriş"
      : "5m teyit henüz yok, 15m mum içinde bekleniyor",
  };
}

// ── Stop hesabı ──────────────────────────────────────────────────────

/** Stop_SPY = son geçerli 15m dip/tepe ∓ 0.25×ATR_15m */
export function stopSpyOf(swingLevel: number, atr15m: number, side: "LONG" | "SHORT"): number {
  return side === "LONG" ? swingLevel - 0.25 * atr15m : swingLevel + 0.25 * atr15m;
}

/**
 * Stop_prim = Giriş_prim - (SPY_giriş - SPY_stop) × delta + 0.10
 * LONG (CALL) için SPY_giriş > SPY_stop, fark pozitif, prim düşer.
 * SHORT (PUT) için SPY_giriş < SPY_stop, fark negatif → aynı formül işareti
 * kendiliğinden çevirir (PUT deltası da negatif kabul edilirse); burada delta
 * mutlak değer olarak alınıp yön `side` ile açıkça yönetilir.
 */
export function stopPremiumOf(
  entryPremium: number,
  spyEntry: number,
  spyStop: number,
  delta: number,
  side: "LONG" | "SHORT"
): number {
  const absDelta = Math.abs(delta);
  const spyMove = side === "LONG" ? spyEntry - spyStop : spyStop - spyEntry;
  return entryPremium - spyMove * absDelta + 0.10;
}

// ── Strike / DTE / spread filtreleri ────────────────────────────────

export function timeValueRatioOk(premium: number, intrinsicValue: number, maxRatio = 0.35): boolean {
  if (premium <= 0) return false;
  const timeValue = Math.max(0, premium - Math.max(0, intrinsicValue));
  return timeValue / premium < maxRatio;
}

export function spreadFilterOk(bid: number, ask: number, premium: number, maxPct = 0.015): boolean {
  if (premium <= 0) return false;
  return ask - bid <= premium * maxPct;
}

export type DteChoice = 0 | 1 | 2 | 3 | 4 | 5;

/**
 * 0DTE sadece 09:45–11:00 ET giriş penceresinde; yüksek güven günü (30m+15m
 * ikisi de net teyitli) 3–5DTE; aksi varsayılan 1–2DTE.
 */
export function pickDte(
  minutesSinceMidnightEt: number,
  highConfidence: boolean
): DteChoice {
  const zeroDteWindowStart = 9 * 60 + 45;
  const zeroDteWindowEnd = 11 * 60;
  if (minutesSinceMidnightEt >= zeroDteWindowStart && minutesSinceMidnightEt <= zeroDteWindowEnd) {
    return 0;
  }
  if (highConfidence) return 3;
  return 1;
}

// ── Pozisyon boyutlandırma ($5.000 hesap) ───────────────────────────

export interface PositionSizeResult {
  contracts: number;
  riskDollars: number;
}

/**
 * risk = stopMesafesi(SPY) × delta × 100 × kontratSayısı
 * Kontrat sayısı, riski hedef bandında ($200–300 varsayılan) tutacak
 * şekilde seçilir — stop mesafesi daraltılmaz.
 */
export function positionSize(
  stopDistanceSpy: number,
  delta: number,
  riskMinDollars = 200,
  riskMaxDollars = 300
): PositionSizeResult {
  const perContractRisk = Math.abs(stopDistanceSpy) * Math.abs(delta) * 100;
  if (perContractRisk <= 0) return { contracts: 0, riskDollars: 0 };
  const targetMid = (riskMinDollars + riskMaxDollars) / 2;
  let contracts = Math.max(1, Math.round(targetMid / perContractRisk));
  // Bandın dışına taşıyorsa bir alt/üst kontrat sayısını dene
  if (contracts * perContractRisk > riskMaxDollars && contracts > 1) contracts -= 1;
  return { contracts, riskDollars: contracts * perContractRisk };
}

// ── Günlük limitler ───────────────────────────────────────────────

export interface DailyLimitInput {
  tradesToday: number;
  stopsToday: number;
  riskUsedDollars: number;
  accountSize?: number;
}

export interface DailyLimitState {
  canTrade: boolean;
  reason: string | null;
}

export function dailyLimitState(input: DailyLimitInput): DailyLimitState {
  const accountSize = input.accountSize ?? 5000;
  const dailyCap = accountSize * 0.10;
  if (input.stopsToday >= 2) return { canTrade: false, reason: "2 stop yendi — gün bitti" };
  if (input.tradesToday >= 2) return { canTrade: false, reason: "günlük işlem limiti doldu (max 2)" };
  if (input.riskUsedDollars >= dailyCap) return { canTrade: false, reason: "günlük risk tavanı (%10) aşıldı" };
  return { canTrade: true, reason: null };
}
