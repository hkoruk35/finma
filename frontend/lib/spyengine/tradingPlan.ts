/**
 * SPY Opsiyon Trading Yol Haritası — hesaplama çekirdeği.
 *
 * V8.0 (22 Eyl 2026, @hasan) — MİMARİ TERSİNE DÖNDÜ: 30m açılış rejimi hiç
 * KULLANILMIYOR (aşağıdaki `openingRangeRegime`/`regimeConfirmation15m` artık
 * strategy.ts'in canlı akışından çağrılmıyor — geriye dönük referans için
 * dosyada kalıyor). Yeni sıralama:
 *   5m  → ANA KARAR. VWAP konumu (birincil karar indikatörü) + hacim anomalisi
 *         + mum formasyonu (bkz. candlePatterns.ts) + RSI(14) yönü birlikte
 *         puanlanır (bkz. `setup5mScore`). EMA21(5m) yalnızca trend BİLGİSİ —
 *         skora küçük bonus verir, tek başına karar vermez/engellemez.
 *   15m → YÖN + TEYİT (zorunlu kapı). 15m VWAP+EMA21 konumu 5m sinyalle AYNI
 *         yönde olmalı; aksi halde giriş üretilmez (bkz. `trend15mDirection`).
 *   30m → KULLANILMIYOR.
 * Stop hâlâ 15m yapısından (Stop_SPY, `stopSpyOf`) — bu, giriş mantığından
 * bağımsız bir risk-yönetim kuralı, değişmedi.
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

/**
 * Stop_SPY = son geçerli 15m dip/tepe ∓ (çarpan)×ATR_15m
 * CALL: son 15m DİP − çarpan×ATR ; PUT: son 15m TEPE + çarpan×ATR.
 * `atrMult` v2'de dinamiktir (dynamicAtrMultiplier): normal 0.25, yüksek
 * oynaklık 0.40, veri/FOMC günü 0.50. Varsayılan 0.25 (geriye uyumlu).
 */
export function stopSpyOf(
  swingLevel: number,
  atr15m: number,
  side: "LONG" | "SHORT",
  atrMult = 0.25
): number {
  return side === "LONG" ? swingLevel - atrMult * atr15m : swingLevel + atrMult * atr15m;
}

/**
 * Dinamik ATR tamponu çarpanı (v2 §Volatilite):
 *   veri günü / FOMC sonrası → 0.50
 *   yüksek oynaklık (VIX ≥ 25 veya ATR ort. 1.5x üstünde) → 0.40
 *   normal → 0.25
 * Geniş tampon erken stopu azaltır; risk büyür, bu yüzden aynı anda
 * pozisyon boyutu da düşürülür (risk bandı korunur).
 */
export function dynamicAtrMultiplier(input: {
  vix?: number | null;
  atrRatio?: number | null; // güncel ATR / ortalama ATR
  isDataDay?: boolean;
}): number {
  if (input.isDataDay) return 0.50;
  const highVix = input.vix != null && input.vix >= 25;
  const highAtr = input.atrRatio != null && input.atrRatio >= 1.5;
  if (highVix || highAtr) return 0.40;
  return 0.25;
}

// ── Hedef (Take-Profit, 1.5R) ────────────────────────────────────────

/**
 * Hedef_SPY = giriş ± R×(giriş − stop mesafesi), yön işlemin yönünde.
 * risk mesafesi = |giriş − stop|; hedef = giriş + R×riskMesafesi (CALL),
 * giriş − R×riskMesafesi (PUT). Varsayılan R = 1.5 (v2).
 */
export function takeProfitSpy(
  entrySpy: number,
  stopSpy: number,
  side: "LONG" | "SHORT",
  rMultiple = 1.5
): number {
  const riskDist = Math.abs(entrySpy - stopSpy);
  return side === "LONG" ? entrySpy + rMultiple * riskDist : entrySpy - rMultiple * riskDist;
}

/** Hedef_prim = giriş_prim + (hedef_SPY − giriş_SPY yönlü mesafe) × |delta| */
export function targetPremiumOf(
  entryPremium: number,
  entrySpy: number,
  targetSpy: number,
  delta: number,
  side: "LONG" | "SHORT"
): number {
  const absDelta = Math.abs(delta);
  const spyMove = side === "LONG" ? targetSpy - entrySpy : entrySpy - targetSpy;
  return entryPremium + spyMove * absDelta;
}

// ── VIX / oynaklık ve RSI aşırı-uzama filtreleri (v2) ───────────────

export type VixBand = "olu" | "normal" | "yuksek" | "panik";

export interface VixRegime {
  band: VixBand;
  /** Pozisyon boyutu çarpanı (1 = tam, 0.5 = yarı, 0 = işlem yok) */
  sizeMult: number;
  action: string;
}

export function vixRegime(vix: number | null | undefined): VixRegime {
  if (vix == null) return { band: "normal", sizeMult: 1, action: "VIX verisi yok — normal kabul edilir" };
  if (vix < 12) return { band: "olu", sizeMult: 0.5, action: "Ölü piyasa — çok seçici ol, tercihen pas" };
  if (vix <= 25) return { band: "normal", sizeMult: 1, action: "Normal — sistem standart çalışır" };
  if (vix <= 30) return { band: "yuksek", sizeMult: 0.5, action: "Yüksek oynaklık — boyutu düşür, ATR tamponunu büyüt" };
  return { band: "panik", sizeMult: 0, action: "Panik — 0 işlem, yapı ve stop güvenilmez" };
}

/** RSI(14) 80 üzeri / 20 altı → aşırı uzama uyarısı (giriş şartı değil, gözdür). */
export function rsiOverextended(rsi: number | null | undefined): boolean {
  if (rsi == null) return false;
  return rsi >= 80 || rsi <= 20;
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
 * risk = stopMesafesi(SPY) × |delta| × 100 × kontratSayısı
 * Kontrat sayısı, riski hedef bandında ($150–200 varsayılan, v2 %3–4)
 * tutacak şekilde seçilir — stop mesafesi daraltılmaz.
 */
export function positionSize(
  stopDistanceSpy: number,
  delta: number,
  riskMinDollars = 150,
  riskMaxDollars = 200
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
  const dailyCap = accountSize * 0.08; // v2: %8 (~$400) = 2 stop
  if (input.stopsToday >= 2) return { canTrade: false, reason: "2 stop yendi — gün bitti" };
  if (input.tradesToday >= 2) return { canTrade: false, reason: "günlük işlem limiti doldu (max 2)" };
  if (input.riskUsedDollars >= dailyCap) return { canTrade: false, reason: "günlük risk tavanı (%8) aşıldı" };
  return { canTrade: true, reason: null };
}

// ── V8.0 — 5m ANA KARAR + 15m YÖN TEYİDİ (30m kullanılmıyor) ────────

import type { CandlePatternHit, PatternDirection } from "./candlePatterns";
import { strongestPatternFor } from "./candlePatterns";

/** Fiyatın VWAP'a göre konumu — V8.0'da BİRİNCİL karar indikatörü. */
export function vwapDirectionOf(close: number, vwap: number | null): PatternDirection | "NÖTR" {
  if (vwap == null) return "NÖTR";
  if (close > vwap) return "LONG";
  if (close < vwap) return "SHORT";
  return "NÖTR";
}

/** RSI(14) yönü: seviye + eğim birlikte (tek başına EMA21 gibi "bilgi" değil, skora girer). */
export function rsiDirectionOf(rsiNow: number | null, rsiPrev: number | null): PatternDirection | "NÖTR" {
  if (rsiNow == null || rsiPrev == null) return "NÖTR";
  if (rsiNow > 50 && rsiNow >= rsiPrev) return "LONG";
  if (rsiNow < 50 && rsiNow <= rsiPrev) return "SHORT";
  return "NÖTR";
}

/**
 * 15m YÖN + TEYİT — zorunlu kapı, tetik değil. VWAP konumu birincil, EMA21
 * ikincil/bilgi girdisi olarak aynı yöndeyse teyidi güçlendirir ama tek
 * başına ne üretir ne engeller.
 */
export function trend15mDirection(
  close15: number, vwap15: number | null, ema21_15: number | null
): { direction: PatternDirection | "NÖTR"; strong: boolean; note: string } {
  const vwapDir = vwapDirectionOf(close15, vwap15);
  if (vwapDir === "NÖTR") {
    return { direction: "NÖTR", strong: false, note: "15m VWAP verisi yok" };
  }
  const emaAgrees =
    ema21_15 != null && (vwapDir === "LONG" ? close15 > ema21_15 : close15 < ema21_15);
  return {
    direction: vwapDir,
    strong: emaAgrees,
    note: `15m fiyat VWAP'ın ${vwapDir === "LONG" ? "üstünde" : "altında"}${emaAgrees ? " ve EMA21 aynı yönü destekliyor" : ""}`,
  };
}

/** Hacim, son N (varsayılan 10) kapalı 5m mumun ortalamasına göre kaç kat. */
export function volumeRatio5m(bars: Bar[], idx: number, window = 10): number | null {
  const start = idx - window;
  if (start < 0) return null;
  let sum = 0;
  for (let i = start; i < idx; i++) sum += bars[i].volume || 0;
  const avg = sum / window;
  if (avg <= 0) return null;
  return (bars[idx].volume || 0) / avg;
}

export interface Setup5mScoreInput {
  side: PatternDirection;
  vwapDir: PatternDirection | "NÖTR";
  rsiDir: PatternDirection | "NÖTR";
  ema21Agrees: boolean | null;
  volumeRatio: number | null;
  pattern: CandlePatternHit | null;
}

export interface Setup5mScore {
  side: PatternDirection;
  score: number; // 0-100+ (EMA21 bonus dahil 110'a kadar çıkabilir)
  fired: boolean;
  parts: { label: string; value: number }[];
}

/** Ateşleme eşiği — 30m'siz, ölçekli skor modelinde v8.0 varsayılanı. */
export const SETUP_FIRE_THRESHOLD = 60;

/**
 * 5m ANA KARAR skoru: VWAP(35) + mum formasyonu(30) + hacim(20) + RSI
 * yönü(15) = 100 taban; EMA21 aynı yöndeyse +10 bilgi bonusu (karar
 * vermez, sadece skoru güçlendirir). 15m teyidi bu fonksiyonun DIŞINDA,
 * zorunlu bir kapı olarak strategy.ts'te uygulanır.
 */
export function setup5mScore(input: Setup5mScoreInput): Setup5mScore {
  const parts: Setup5mScore["parts"] = [];
  let score = 0;

  if (input.vwapDir === input.side) {
    parts.push({ label: "VWAP konumu yönü destekliyor (ana karar)", value: 35 });
    score += 35;
  } else {
    parts.push({ label: "VWAP konumu yönü desteklemiyor", value: 0 });
  }

  if (input.pattern) {
    const pts = Math.round(30 * input.pattern.strength);
    parts.push({ label: `Mum formasyonu: ${input.pattern.label} (${input.pattern.detail})`, value: pts });
    score += pts;
  } else {
    parts.push({ label: "Mum formasyonu yok", value: 0 });
  }

  if (input.volumeRatio != null && input.volumeRatio >= 1.15) {
    const pts = input.volumeRatio >= 1.6 ? 20 : 12;
    parts.push({ label: `Hacim ${input.volumeRatio.toFixed(2)}× ortalama`, value: pts });
    score += pts;
  } else {
    parts.push({ label: input.volumeRatio == null ? "Hacim verisi yok" : `Hacim ${input.volumeRatio.toFixed(2)}× — zayıf`, value: 0 });
  }

  if (input.rsiDir === input.side) {
    parts.push({ label: "RSI(14) yönü destekliyor", value: 15 });
    score += 15;
  } else {
    parts.push({ label: "RSI(14) yönü desteklemiyor", value: 0 });
  }

  if (input.ema21Agrees) {
    parts.push({ label: "EMA21 trend bilgisi aynı yönde (bonus)", value: 10 });
    score += 10;
  }

  return { side: input.side, score, fired: score >= SETUP_FIRE_THRESHOLD, parts };
}

export { strongestPatternFor };
export type { CandlePatternHit, PatternDirection };
