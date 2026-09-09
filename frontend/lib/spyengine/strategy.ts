/**
 * SPY Engine V5.0 — Strateji ve Pozisyon Durum Makinesi (izomorfik, saf)
 *
 * V4.2'den TAM MİMARİ DEĞİŞİKLİK: artık üç zaman dilimi ayrı roller taşıyor.
 *
 *   15m VETO       → yön izni (LONG/SHORT/NÖTR). Karar üretmez, sadece
 *                     ters yöndeki girişleri engeller.
 *   5m TREND+FİLTRE → ANA KARAR KATMANI. İkisi birlikte geçerse bir yönde
 *                     "REJİM" açılır; bu rejim, Layer 1+2 geçerli kaldığı
 *                     sürece (her yeni kapanan 5m barda yeniden kontrol
 *                     edilerek) AKTİF kalan bir DURUMDUR — tek bir bara
 *                     değil, bir pencereye bağlıdır.
 *   1m TETİK        → ZAMANLAMA. Karar vermez — rejim aktifken HER kapanan
 *                     1m barda bağımsız olarak "şimdi mi?" sorusunu sorar.
 *                     Eskiden üç katman aynı anda hizalanmayı beklediği için
 *                     giriş hareketin geç bir noktasında oluşuyordu; artık
 *                     rejim aktifken herhangi bir 1m barda tetiklenebilir.
 *
 * Zaman filtresi (açılış/öğlen/kapanış hariç tutma) BİLİNÇLİ OLARAK
 * UYGULANMADI — kanıtsız varsayım olarak değerlendirildi, RTH içinde her an
 * giriş üretilebilir. Yalnızca 15:45 ET zorunlu 0DTE kapaması (EOD) mutlak
 * kalır — bu bir "giriş kısıtı" değil, gün sonu pozisyon tasfiyesidir.
 *
 * ── KATMAN 0 — 15m VETO (kapanmış mum) ─────────────────────────────
 *   LONG yasak eğer 15m kapanış < 15m EMA21; SHORT yasak eğer > EMA21.
 *   Nötr tampon (ATR×çarpan) varsayılan KAPALI (M15_VETO_BUFFER_ATR_MULT=0)
 *   — spec'in "ilk testte kapalı bırakılabilir" notuna göre.
 *
 * ── KATMAN 1 — 5m TREND (rejim yönü, kapanmış mum) ──────────────────
 *   LONG: Close>EMA21 AND (RSI14>50 ve yükseliyor OR MACD_hist>0 ve yükseliyor)
 *   SHORT: simetrik ters.
 *
 * ── KATMAN 2 — 5m FİLTRE (rejim kalite onayı, 3'te 2 oylama) ────────
 *   A) Hacim > Avg20×1.0   B) Gövde > ATR14×0.40   C) Karşı gölge < Gövde×0.40
 *   En az 2/3 sağlanmalı. Layer 1 + Layer 2 birlikte REJİMİ açar/sürdürür.
 *
 * ── KATMAN 3 — 1m TETİK (zamanlama, sadece rejim aktifken) ──────────
 *   STRUCTURE (zorunlu): Close>EMA21(1m) AND Close > önceki 2 KAPALI 1m
 *   mumun en yükseği (LONG) / en düşüğü (SHORT).
 *   CONFIRMATION (en az biri): RSI7 yönlü VEYA Hacim > Avg10×1.3.
 *
 * ── ÇIKIŞ — öncelik sıralı, asimetrik hız (giriş konfirmasyonlu/yavaş,
 *   çıkış hızlı) ───────────────────────────────────────────────────────
 *   0 (mutlak)  15:45 ET zorunlu 0DTE kapaması.
 *   1 (ACİL)    5m EMA21 zıt yönde kesilirse → anlık (her kapalı 1m barda
 *               en güncel 5m EMA21'e göre kontrol edilir, 5m kapanışı
 *               beklenmez).
 *   2 (NORMAL)  5m RSI yön değiştirirse → kapanmış 5m bar.
 *   3 (STOP)    Opsiyon değeri EXIT_STOP_PCT'ye (−%25/−%30 aralığı,
 *               kalibre edilecek) ulaşırsa → anlık (mum içi en kötü seviye).
 *   4 (TRAILING) Kâr +%40'ı geçince taban breakeven'e, +%50'yi geçince
 *               tabana yükselir; her kapanmış 5m barda güncellenir.
 *
 * NON-REPAINTING: tüm kararlar SADECE kapanmış mumlarla verilir (1m/5m/15m
 * ayrı ayrı). Her fonksiyon saftır; aynı girdi her zaman aynı çıktıyı verir.
 */

import {
  Bar,
  SessionInfo,
  ema,
  rsi,
  macd,
  atr,
  nyParts,
  RTH_OPEN_MIN,
  RTH_CLOSE_MIN,
  EOD_FORCE_MIN,
  r2,
} from "./core";

// ── Tipler ────────────────────────────────────────────────────────

export type Side = "LONG" | "SHORT";
export type VetoDirection = "LONG" | "SHORT" | "NEUTRAL";
export type RegimeSide = "LONG" | "SHORT" | "NONE";

/**
 * Strike seçim kademesi — spec §5. "A" = Güçlü kurulum (RSI VE MACD ikisi de
 * aynı yönde), "B" = Orta kurulum (yalnızca biri). İsimlendirme eski V3/V4
 * "kontrat türü" alanıyla uyumluluk için korundu, anlamı değişti.
 */
export type ContractType = "A" | "B";

export const CONTRACT_RULES: Record<ContractType, { label: string }> = {
  A: { label: "Güçlü Kurulum (5m RSI + MACD ikisi de yönlü, ATM ±1, 0DTE)" },
  B: { label: "Orta Kurulum (5m RSI veya MACD, ATM ±0.5, 0DTE/1DTE)" },
};

// ── Katman sabitleri ─────────────────────────────────────────────

/** 15m veto — EMA21 üzerinden yön izni */
export const M15_EMA_PERIOD = 21;
/**
 * Nötr tampon çarpanı (ATR×bu değer). Spec: "önerilir, ilk testte kapalı
 * bırakılabilir". Varsayılan 0 = tampon YOK, her zaman kesin LONG/SHORT
 * yönü var (fiyat==EMA21 dışında). Canlı ölçümde flip-flop görülürse >0
 * yapılabilir.
 */
export const M15_VETO_BUFFER_ATR_MULT = 0;

/** 5m Katman 1 — trend */
export const M5_EMA_PERIOD = 21;
export const M5_RSI_PERIOD = 14;
export const M5_MACD_FAST = 12;
export const M5_MACD_SLOW = 26;
export const M5_MACD_SIGNAL = 9;

/** 5m Katman 2 — filtre (3'te 2 oylama) */
export const M5_ATR_PERIOD = 14;
export const M5_VOL_AVG_PERIOD = 20;
export const M5_FILTER_VOL_MULT = 1.0;
export const M5_FILTER_BODY_ATR_MULT = 0.4;
export const M5_FILTER_WICK_BODY_MULT = 0.4;
export const M5_FILTER_MIN_VOTES = 2;

/** 1m Katman 3 — tetik (zamanlama) */
export const M1_EMA_PERIOD = 21;
/** Spec RSI7 diyor — eski katmanların RSI14'ünden BİLİNÇLİ OLARAK farklı */
export const M1_RSI_PERIOD = 7;
export const M1_STRUCTURE_LOOKBACK = 2;
export const M1_VOL_AVG_PERIOD = 10;
export const M1_VOL_MULT = 1.3;

/** Saatte azami giriş (kayan 60 dakikalık pencere) — V4'ten korundu */
export const MAX_ENTRIES_PER_HOUR = 3;

// ── Çıkış sabitleri (spec §6) ───────────────────────────────────────

/**
 * Sabit stop, opsiyon primi yüzdesi olarak. Spec bir ARALIK veriyor
 * (−%25 ile −%30 arası, "backtest ile kalibre edilecek"); tek sabit gerekli
 * olduğu için aralığın ortası seçildi. Canlı/backtest ölçümüyle ayarlanabilir.
 */
export const EXIT_STOP_PCT = -0.28;
/** Trailing kilit 1. eşik: prim bu yüzdeye ulaşınca taban breakeven'e çekilir */
export const EXIT_TRAIL_ARM1_PCT = 0.4;
export const EXIT_TRAIL_FLOOR1 = 0.0;
/** Trailing kilit 2. eşik: prim bu yüzdeye ulaşınca taban yükselir */
export const EXIT_TRAIL_ARM2_PCT = 0.5;
export const EXIT_TRAIL_FLOOR2 = 0.2;

// ── Ortak tipler ──────────────────────────────────────────────────

export interface ConfidencePart {
  label: string;
  value: number;
}

export type ExitKind = "EMA_CROSS_EXIT" | "RSI_FLIP_EXIT" | "STOP_EXIT" | "TRAIL_EXIT" | "EOD_EXIT";
export type EventKind = "ENTRY" | ExitKind;

export interface EngineEvent {
  id: string;
  kind: EventKind;
  time: number;
  side: Side;
  spot: number;
  premium: number | null;
  pnl: number | null;
  label: string;
  note: string;
}

export interface ExitProgress {
  /** Fiyat, 5m EMA21'e göre hâlâ pozisyon LEHİNDE mi (ACİL çıkış tetikleyicisi) */
  emaFavor: boolean | null;
  emaGapPct: number | null;
  /** 5m RSI pozisyonu destekliyor mu (NORMAL çıkış tetikleyicisi) */
  rsiSupportive: boolean | null;
  rsi5: number | null;
  /** Girişten bu yana taşınan 1m mum sayısı */
  barsHeld: number;
  bestSpot: number | null;
  /** Primin giriş primine göre anlık/en son bilinen yüzdesi (veri yoksa null) */
  premiumPct: number | null;
  /** Trailing kilidi aktifse (yalnızca yükselir) taban yüzdesi */
  trailFloorPct: number | null;
  note: string;
}

export interface PositionState {
  id: string;
  side: Side;
  contractType: ContractType;
  entryTime: number;
  entrySpot: number;
  contract: string | null;
  strike: number | null;
  expiry: string | null;
  entryPremium: number | null;
  status: "OPEN" | "CLOSED";
  lastPremium: number | null;
  realizedPnl: number;
  unrealizedPnl: number | null;
  events: EngineEvent[];
  exitTime: number | null;
  exitSpot: number | null;
  exitPremium: number | null;
  exitReason: ExitKind | null;
  exitNote: string | null;
  progress: ExitProgress;
  premiumDataMissing: boolean;
}

export interface EntryCandidate {
  time: number;
  side: Side;
  spot: number;
  contractType: ContractType;
  confidence: number;
  confidenceParts: ConfidencePart[];
  reasoning: string;
}

export interface GateCheck {
  label: string;
  ok: boolean;
  detail: string;
}

export interface GateStatus {
  long: GateCheck[];
  short: GateCheck[];
}

export type EngineState = "WATCHING" | "ARMED" | "TRIGGERED" | "IN_POSITION";

// ── Katman okumaları (panelde şeffaf gösterim için) ─────────────────

export interface M15VetoRead {
  direction: VetoDirection;
  close: number | null;
  ema21: number | null;
  note: string;
}

export interface Layer1Read {
  passLong: boolean;
  passShort: boolean;
  closeAboveEma: boolean;
  closeBelowEma: boolean;
  rsi: number | null;
  rsiRising: boolean;
  rsiFalling: boolean;
  macdHist: number | null;
  macdRising: boolean;
  macdFalling: boolean;
  /** Güçlü kurulum: RSI VE MACD ikisi de aynı yönde */
  strongLong: boolean;
  strongShort: boolean;
  note: string;
}

export interface Layer2Read {
  longVotes: GateCheck[];
  longPassed: number;
  passLong: boolean;
  shortVotes: GateCheck[];
  shortPassed: number;
  passShort: boolean;
  note: string;
}

export interface RegimeState {
  side: RegimeSide;
  since: number | null;
  note: string;
}

export interface Layer3Read {
  checks: GateCheck[];
  structureOk: boolean;
  confirmationOk: boolean;
  fired: boolean;
  note: string;
}

export interface EngineRead {
  veto: M15VetoRead;
  layer1: Layer1Read;
  layer2: Layer2Read;
  regime: RegimeState;
  layer3: Layer3Read;
  action: "LONG" | "SHORT" | "BEKLE";
  contractType: ContractType | null;
  state: EngineState;
  stateLabel: string;
  nextStep: string;
  confidence: number;
  confidenceParts: ConfidencePart[];
  reasoning: string;
  gateStatus: GateStatus;
}

// ── Yardımcılar ───────────────────────────────────────────────────

const closes = (b: Bar[]) => b.map((x) => x.close);

/** `nowSec` itibarıyla KAPANMIŞ mumlar (son, hâlâ oluşmakta olan mum atılır) */
export function closedBars(bars: Bar[], tfMinutes: number, nowSec: number): Bar[] {
  const span = tfMinutes * 60;
  const out: Bar[] = [];
  for (const b of bars) {
    if (b.time + span <= nowSec) out.push(b);
  }
  return out;
}

function idOf(prefix: string, t: number, side: string) {
  return `${prefix}-${t}-${side}`;
}

export function buildOptionSymbol(underlying: string, ymd: string, isCall: boolean, strike: number): string {
  const [y, m, d] = ymd.split("-");
  const strikePart = String(Math.round(strike * 1000)).padStart(8, "0");
  return `${underlying}${y.slice(2)}${m}${d}${isCall ? "C" : "P"}${strikePart}`;
}

export function atmStrike(spot: number): number {
  return Math.round(spot);
}

function eodEpochOf(session: SessionInfo): number {
  return session.rthOpen + (EOD_FORCE_MIN - RTH_OPEN_MIN) * 60;
}

function candleDir(b: Bar): "UP" | "DOWN" | "NONE" {
  if (b.close > b.open) return "UP";
  if (b.close < b.open) return "DOWN";
  return "NONE";
}

/** `uptoExclusive` mumundan ÖNCEKİ `n` mumun ortalama hacmi (bakış-ileri sızıntısı yok) */
function avgVolume(bars: Bar[], uptoExclusive: number, n: number): number | null {
  const start = Math.max(0, uptoExclusive - n);
  if (start >= uptoExclusive) return null;
  const slice = bars.slice(start, uptoExclusive);
  if (!slice.length) return null;
  return slice.reduce((s, b) => s + (b.volume || 0), 0) / slice.length;
}

const rising = (v: number | null, p: number | null) => v != null && p != null && v > p;
const falling = (v: number | null, p: number | null) => v != null && p != null && v < p;

// ── KATMAN 0 — 15m VETO ─────────────────────────────────────────────

function m15VetoAt(m15: Bar[], m15Ema: (number | null)[], m15Atr: (number | null)[], idx: number): M15VetoRead {
  if (idx < 0 || idx >= m15.length) {
    return { direction: "NEUTRAL", close: null, ema21: null, note: "15m verisi yetersiz — henüz veto okunamıyor" };
  }
  const e = m15Ema[idx];
  if (e == null) return { direction: "NEUTRAL", close: m15[idx].close, ema21: null, note: "15m EMA21 ısınıyor" };
  const close = m15[idx].close;
  const buf = (m15Atr[idx] ?? 0) * M15_VETO_BUFFER_ATR_MULT;

  if (M15_VETO_BUFFER_ATR_MULT > 0 && Math.abs(close - e) < buf) {
    return { direction: "NEUTRAL", close, ema21: e, note: `Fiyat 15m EMA21'e çok yakın (tampon içinde) — nötr, giriş yok` };
  }
  if (close > e) return { direction: "LONG", close, ema21: e, note: `15m kapanış EMA21 üstünde (${close.toFixed(2)} > ${e.toFixed(2)}) — LONG serbest, SHORT veto` };
  if (close < e) return { direction: "SHORT", close, ema21: e, note: `15m kapanış EMA21 altında (${close.toFixed(2)} < ${e.toFixed(2)}) — SHORT serbest, LONG veto` };
  return { direction: "NEUTRAL", close, ema21: e, note: "Fiyat EMA21'e eşit — nötr" };
}

// ── KATMAN 1 — 5m TREND ──────────────────────────────────────────────

function layer1At(
  m5: Bar[], m5Ema: (number | null)[], m5Rsi: (number | null)[], m5MacdHist: (number | null)[], idx: number
): Layer1Read {
  if (idx < 1 || idx >= m5.length) {
    return {
      passLong: false, passShort: false, closeAboveEma: false, closeBelowEma: false,
      rsi: null, rsiRising: false, rsiFalling: false, macdHist: null, macdRising: false, macdFalling: false,
      strongLong: false, strongShort: false, note: "5m verisi yetersiz",
    };
  }
  const close = m5[idx].close;
  const e = m5Ema[idx];
  const r = m5Rsi[idx], rp = m5Rsi[idx - 1];
  const h = m5MacdHist[idx], hp = m5MacdHist[idx - 1];

  const closeAboveEma = e != null && close > e;
  const closeBelowEma = e != null && close < e;
  const rsiRising = rising(r, rp);
  const rsiFalling = falling(r, rp);
  const macdRising = h != null && hp != null && h > 0 && h > hp;
  const macdFalling = h != null && hp != null && h < 0 && h < hp;
  const rsiCondLong = r != null && r > 50 && rsiRising;
  const rsiCondShort = r != null && r < 50 && rsiFalling;

  const passLong = closeAboveEma && (rsiCondLong || macdRising);
  const passShort = closeBelowEma && (rsiCondShort || macdFalling);

  return {
    passLong, passShort, closeAboveEma, closeBelowEma,
    rsi: r, rsiRising, rsiFalling, macdHist: h, macdRising, macdFalling,
    strongLong: rsiCondLong && macdRising,
    strongShort: rsiCondShort && macdFalling,
    note: passLong
      ? `5m fiyat EMA21 üstünde + ${rsiCondLong && macdRising ? "RSI ve MACD ikisi de" : rsiCondLong ? "RSI" : "MACD"} yukarı`
      : passShort
      ? `5m fiyat EMA21 altında + ${rsiCondShort && macdFalling ? "RSI ve MACD ikisi de" : rsiCondShort ? "RSI" : "MACD"} aşağı`
      : "5m trend şartı sağlanmıyor",
  };
}

// ── KATMAN 2 — 5m FİLTRE (3'te 2 oylama) ────────────────────────────

function layer2At(m5: Bar[], m5Atr: (number | null)[], idx: number): Layer2Read {
  if (idx < 1 || idx >= m5.length) {
    return { longVotes: [], longPassed: 0, passLong: false, shortVotes: [], shortPassed: 0, passShort: false, note: "5m verisi yetersiz" };
  }
  const bar = m5[idx];
  const body = Math.abs(bar.close - bar.open);
  const bullish = bar.close > bar.open;
  const bearish = bar.close < bar.open;
  const upperWick = bar.high - Math.max(bar.open, bar.close);
  const lowerWick = Math.min(bar.open, bar.close) - bar.low;
  const a = m5Atr[idx] ?? 0;
  const avgVol = avgVolume(m5, idx, M5_VOL_AVG_PERIOD);
  const volRatio = avgVol != null && avgVol > 0 ? (bar.volume || 0) / avgVol : null;
  const volOk = volRatio != null && volRatio > M5_FILTER_VOL_MULT;

  const longBodyOk = bullish && a > 0 && body > a * M5_FILTER_BODY_ATR_MULT;
  const longWickOk = bullish && body > 0 && upperWick < body * M5_FILTER_WICK_BODY_MULT;
  const longVotes: GateCheck[] = [
    { label: `Hacim > ort.×${M5_FILTER_VOL_MULT}`, ok: volOk, detail: volRatio == null ? "veri yok" : `ort.×${volRatio.toFixed(2)}` },
    { label: `Gövde (yükseliş) > ATR×${M5_FILTER_BODY_ATR_MULT}`, ok: longBodyOk, detail: a > 0 ? `${(body / a).toFixed(2)}×ATR` : "veri yok" },
    { label: `Üst gölge < gövde×${M5_FILTER_WICK_BODY_MULT}`, ok: longWickOk, detail: body > 0 ? `%${((upperWick / body) * 100).toFixed(0)}` : "veri yok" },
  ];
  const longPassed = longVotes.filter((v) => v.ok).length;

  const shortBodyOk = bearish && a > 0 && body > a * M5_FILTER_BODY_ATR_MULT;
  const shortWickOk = bearish && body > 0 && lowerWick < body * M5_FILTER_WICK_BODY_MULT;
  const shortVotes: GateCheck[] = [
    { label: `Hacim > ort.×${M5_FILTER_VOL_MULT}`, ok: volOk, detail: volRatio == null ? "veri yok" : `ort.×${volRatio.toFixed(2)}` },
    { label: `Gövde (düşüş) > ATR×${M5_FILTER_BODY_ATR_MULT}`, ok: shortBodyOk, detail: a > 0 ? `${(body / a).toFixed(2)}×ATR` : "veri yok" },
    { label: `Alt gölge < gövde×${M5_FILTER_WICK_BODY_MULT}`, ok: shortWickOk, detail: body > 0 ? `%${((lowerWick / body) * 100).toFixed(0)}` : "veri yok" },
  ];
  const shortPassed = shortVotes.filter((v) => v.ok).length;

  const passLong = longPassed >= M5_FILTER_MIN_VOTES;
  const passShort = shortPassed >= M5_FILTER_MIN_VOTES;

  return {
    longVotes, longPassed, passLong,
    shortVotes, shortPassed, passShort,
    note: passLong
      ? `5m filtre LONG'u ${longPassed}/3 oyla onayladı`
      : passShort
      ? `5m filtre SHORT'u ${shortPassed}/3 oyla onayladı`
      : `5m filtre onaylamadı (LONG ${longPassed}/3 · SHORT ${shortPassed}/3, en az 2 gerekli)`,
  };
}

// ── KATMAN 3 — 1m TETİK (zamanlama) ─────────────────────────────────

function layer3At(
  m1: Bar[], m1Ema: (number | null)[], m1Rsi7: (number | null)[], idx: number, side: Side
): Layer3Read {
  if (idx < M1_STRUCTURE_LOOKBACK) {
    return { checks: [], structureOk: false, confirmationOk: false, fired: false, note: "1m verisi yetersiz" };
  }
  const bar = m1[idx];
  const e = m1Ema[idx];
  const prevBars = m1.slice(idx - M1_STRUCTURE_LOOKBACK, idx); // önceki 2 KAPALI mum, mevcut hariç
  const isLong = side === "LONG";

  const emaOk = e != null && (isLong ? bar.close > e : bar.close < e);
  const extreme = isLong
    ? Math.max(...prevBars.map((b) => b.high))
    : Math.min(...prevBars.map((b) => b.low));
  const breakOk = isLong ? bar.close > extreme : bar.close < extreme;
  const structureOk = emaOk && breakOk;

  const r = m1Rsi7[idx], rp = m1Rsi7[idx - 1];
  const rsiOk = isLong ? r != null && r > 50 && rising(r, rp) : r != null && r < 50 && falling(r, rp);
  const avgVol = avgVolume(m1, idx, M1_VOL_AVG_PERIOD);
  const volRatio = avgVol != null && avgVol > 0 ? (bar.volume || 0) / avgVol : null;
  const volOk = volRatio != null && volRatio > M1_VOL_MULT;
  const confirmationOk = rsiOk || volOk;

  const checks: GateCheck[] = [
    {
      label: `1m fiyat EMA21'in ${isLong ? "üstünde" : "altında"}`,
      ok: emaOk,
      detail: e == null ? "veri yok" : `${bar.close.toFixed(2)} / EMA21 ${e.toFixed(2)}`,
    },
    {
      label: `Kapanış önceki 2 mumun ${isLong ? "zirvesini" : "dibini"} kırdı`,
      ok: breakOk,
      detail: `${bar.close.toFixed(2)} vs ${extreme.toFixed(2)}`,
    },
    {
      label: `1m RSI7 ${isLong ? "yükseliyor (>50)" : "düşüyor (<50)"}`,
      ok: rsiOk,
      detail: r == null ? "veri yok" : r.toFixed(0),
    },
    {
      label: `Hacim > ort.×${M1_VOL_MULT}`,
      ok: volOk,
      detail: volRatio == null ? "veri yok" : `ort.×${volRatio.toFixed(2)}`,
    },
  ];

  return {
    checks, structureOk, confirmationOk, fired: structureOk && confirmationOk,
    note: !structureOk
      ? "Yapı kırılımı yok — EMA21 konumu ve önceki 2 mum kırılımı ikisi de gerekli"
      : !confirmationOk
      ? "Yapı kırıldı, konfirmasyon (RSI7 veya hacim) bekleniyor"
      : `1m tetik ateşlendi (${side})`,
  };
}

// ── Güven skoru ──────────────────────────────────────────────────

function buildConfidence(l1: Layer1Read, l2: Layer2Read, l3: Layer3Read, side: Side): { total: number; parts: ConfidencePart[] } {
  const parts: ConfidencePart[] = [{ label: "Rejim + tetik geçildi (taban)", value: 50 }];
  let total = 50;

  const strong = side === "LONG" ? l1.strongLong : l1.strongShort;
  const strongPts = strong ? 20 : 10;
  parts.push({ label: strong ? "Güçlü kurulum (RSI + MACD ikisi de)" : "Orta kurulum (RSI veya MACD)", value: strongPts });
  total += strongPts;

  const l2Passed = side === "LONG" ? l2.longPassed : l2.shortPassed;
  const l2Pts = l2Passed >= 3 ? 15 : 8;
  parts.push({ label: `5m filtre ${l2Passed}/3`, value: l2Pts });
  total += l2Pts;

  const bothConfirm = l3.checks.filter((c) => c.ok).length >= 4;
  const confirmPts = bothConfirm ? 15 : 8;
  parts.push({ label: bothConfirm ? "1m RSI7 + hacim ikisi de destekliyor" : "1m konfirmasyonlarından biri", value: confirmPts });
  total += confirmPts;

  return { total: Math.max(0, Math.min(100, total)), parts };
}

// ── Kapı Durumu (manuel işlem için birleşik veto listesi) ───────────

function gateChecksFor(
  veto: M15VetoRead, l1: Layer1Read, l2: Layer2Read, regime: RegimeState, l3ForSide: Layer3Read, side: Side
): GateCheck[] {
  const isLong = side === "LONG";
  const l1Pass = isLong ? l1.passLong : l1.passShort;
  const l2Pass = isLong ? l2.passLong : l2.passShort;
  const l2Passed = isLong ? l2.longPassed : l2.shortPassed;
  return [
    { label: "15m veto izin veriyor", ok: veto.direction === side, detail: veto.direction === "NEUTRAL" ? "nötr" : veto.direction },
    { label: "5m trend (EMA21 konumu + RSI/MACD)", ok: l1Pass, detail: l1Pass ? "geçti" : "geçmedi" },
    { label: "5m filtre (en az 2/3 oy)", ok: l2Pass, detail: `${l2Passed}/3` },
    { label: `5m rejim ${side} aktif`, ok: regime.side === side, detail: regime.side === "NONE" ? "yok" : regime.side },
    ...l3ForSide.checks,
  ];
}

// ── Giriş adaylarının üretimi (5m ana karar, 1m zamanlama) ─────────

export interface GenerateInput {
  m1: Bar[];
  m5: Bar[];
  m15: Bar[];
  session: SessionInfo;
  nowSec: number;
  hasOpenPosition?: boolean;
}

export interface GenerateOutput {
  candidates: EntryCandidate[];
  read: EngineRead;
  lastClosed: { m1: number | null; m5: number | null; m15: number | null };
}

export function generateCandidates(input: GenerateInput): GenerateOutput {
  const { session, nowSec } = input;
  const m1 = closedBars(input.m1, 1, nowSec);
  const m5 = closedBars(input.m5, 5, nowSec);
  const m15 = closedBars(input.m15, 15, nowSec);

  const m15Ema = ema(closes(m15), M15_EMA_PERIOD);
  const m15Atr = atr(m15, 14);

  const m5Closes = closes(m5);
  const m5Ema = ema(m5Closes, M5_EMA_PERIOD);
  const m5Rsi = rsi(m5Closes, M5_RSI_PERIOD);
  const m5MacdHist = macd(m5Closes, M5_MACD_FAST, M5_MACD_SLOW, M5_MACD_SIGNAL).hist;
  const m5Atr = atr(m5, M5_ATR_PERIOD);

  const m1Closes = closes(m1);
  const m1Ema = ema(m1Closes, M1_EMA_PERIOD);
  const m1Rsi7 = rsi(m1Closes, M1_RSI_PERIOD);

  // ── Rejim zaman çizelgesi: her kapalı 5m barda yeniden değerlendirilir,
  //    Layer 1+2 geçerli kaldığı sürece AKTİF kalan bir DURUM olarak ──────
  const regimeTimeline: RegimeState[] = new Array(m5.length);
  {
    let side: RegimeSide = "NONE";
    let since: number | null = null;
    for (let j = 0; j < m5.length; j++) {
      const l1 = layer1At(m5, m5Ema, m5Rsi, m5MacdHist, j);
      const l2 = layer2At(m5, m5Atr, j);
      const passLong = l1.passLong && l2.passLong;
      const passShort = l1.passShort && l2.passShort;

      if (side === "LONG" && passLong) {
        // aktif kalır
      } else if (side === "SHORT" && passShort) {
        // aktif kalır
      } else if (passLong) {
        side = "LONG"; since = m5[j].time;
      } else if (passShort) {
        side = "SHORT"; since = m5[j].time;
      } else {
        side = "NONE"; since = null;
      }
      regimeTimeline[j] = {
        side, since,
        note: side === "NONE" ? "Rejim yok — Layer 1+2 ikisi de geçmedi" : `${side} rejimi ${since ? nyParts(since).hhmm + " ET'den beri" : ""} aktif`,
      };
    }
  }

  const candidates: EntryCandidate[] = [];
  let m5Cursor = -1;
  let m15Cursor = -1;

  for (let i = 1; i < m1.length; i++) {
    const bar = m1[i];
    while (m5Cursor + 1 < m5.length && m5[m5Cursor + 1].time + 300 <= bar.time + 60) m5Cursor++;
    while (m15Cursor + 1 < m15.length && m15[m15Cursor + 1].time + 900 <= bar.time + 60) m15Cursor++;

    const p = nyParts(bar.time);
    const inRth = p.ymd === session.date && p.minutes >= RTH_OPEN_MIN && p.minutes < RTH_CLOSE_MIN;
    if (!inRth) continue;
    if (m5Cursor < 1 || m15Cursor < 0) continue;

    const regime = regimeTimeline[m5Cursor];
    if (regime.side === "NONE") continue;

    const veto = m15VetoAt(m15, m15Ema, m15Atr, m15Cursor);
    if (veto.direction !== regime.side) continue; // 15m veto engelliyor

    const side = regime.side;
    const l3 = layer3At(m1, m1Ema, m1Rsi7, i, side);
    if (!l3.fired) continue;

    const l1 = layer1At(m5, m5Ema, m5Rsi, m5MacdHist, m5Cursor);
    const l2 = layer2At(m5, m5Atr, m5Cursor);
    const strong = side === "LONG" ? l1.strongLong : l1.strongShort;
    const { total, parts } = buildConfidence(l1, l2, l3, side);

    candidates.push({
      time: bar.time,
      side,
      spot: bar.close,
      contractType: strong ? "A" : "B",
      confidence: total,
      confidenceParts: parts,
      reasoning:
        `5m rejim ${side} aktif (${l1.note}) · ${l2.note} · ` +
        `1m tetik: yapı kırılımı + ${l3.checks[2]?.ok ? "RSI7" : "hacim"} konfirmasyonu · ` +
        `15m veto ${side} yönünü serbest bırakıyor`,
    });
  }

  // ── Canlı okuma (son kapalı mumlar üzerinden, panel için) ────────
  const lastM1Idx = m1.length - 1;
  const lastVeto = m15VetoAt(m15, m15Ema, m15Atr, m15Cursor);
  const lastL1 = layer1At(m5, m5Ema, m5Rsi, m5MacdHist, m5Cursor);
  const lastL2 = layer2At(m5, m5Atr, m5Cursor);
  const lastRegime: RegimeState = m5Cursor >= 0 && regimeTimeline[m5Cursor] ? regimeTimeline[m5Cursor] : { side: "NONE", since: null, note: "Rejim için 5m verisi yetersiz" };
  const lastL3Long = layer3At(m1, m1Ema, m1Rsi7, lastM1Idx, "LONG");
  const lastL3Short = layer3At(m1, m1Ema, m1Rsi7, lastM1Idx, "SHORT");
  const lastL3ForRegime = lastRegime.side === "SHORT" ? lastL3Short : lastL3Long;

  const lastCandidate =
    candidates.length && lastM1Idx >= 0 && candidates[candidates.length - 1].time === m1[lastM1Idx].time
      ? candidates[candidates.length - 1]
      : null;

  let state: EngineState = "WATCHING";
  let action: EngineRead["action"] = "BEKLE";
  let contractType: ContractType | null = null;
  let confidence = 30;
  let confidenceParts: ConfidencePart[] = [{ label: "Taban (rejim yok)", value: 30 }];
  let reasoning = "5m rejim aranıyor — Layer 1 (trend) + Layer 2 (filtre) ikisi de geçmedi.";
  let stateLabel = "İZLEMEDE";
  let nextStep = "5m kapanışında Layer 1 (trend) + Layer 2 (filtre) ikisinin de geçmesi bekleniyor.";

  if (input.hasOpenPosition) {
    state = "IN_POSITION";
    stateLabel = "POZİSYONDA";
    nextStep = "Açık pozisyon taşınıyor — çıkış öncelik sırasına göre izleniyor (Açık Pozisyon kutusuna bak).";
    reasoning = "Pozisyon açık; çıkış önceliği: 15:45 EOD > 5m EMA21 kesişimi > 5m RSI dönüşü > stop > trailing.";
  } else if (lastCandidate) {
    state = "TRIGGERED";
    action = lastCandidate.side;
    contractType = lastCandidate.contractType;
    confidence = lastCandidate.confidence;
    confidenceParts = lastCandidate.confidenceParts;
    reasoning = lastCandidate.reasoning;
    stateLabel = lastCandidate.side === "LONG" ? "LONG GİRİŞ SİNYALİ" : "SHORT GİRİŞ SİNYALİ";
    nextStep = "1m tetik ateşlendi — pozisyon açılıyor.";
  } else if (lastRegime.side !== "NONE") {
    const vetoBlocks = lastVeto.direction !== lastRegime.side;
    state = "ARMED";
    confidence = 55;
    confidenceParts = [
      { label: "Taban", value: 30 },
      { label: `5m rejim ${lastRegime.side} aktif`, value: 25 },
    ];
    reasoning = `5m rejim ${lastRegime.side} aktif — 1m tetik (yapı kırılımı + RSI7/hacim konfirmasyonu) bekleniyor.`;
    stateLabel = "HAZIRLANIYOR";
    nextStep = vetoBlocks
      ? `5m rejim ${lastRegime.side} aktif ama 15m veto bu yönü engelliyor (${lastVeto.note}). Motor bekliyor.`
      : !lastL3ForRegime.structureOk
      ? `5m rejim ${lastRegime.side} aktif. 1m'de yapı kırılımı (EMA21 konumu + önceki 2 mumun ${lastRegime.side === "LONG" ? "zirvesi" : "dibi"}) bekleniyor.`
      : `5m rejim ${lastRegime.side} aktif, 1m yapı kırıldı. RSI7 veya hacim konfirmasyonu bekleniyor.`;
  }

  const gateStatus: GateStatus = {
    long: gateChecksFor(lastVeto, lastL1, lastL2, lastRegime, lastL3Long, "LONG"),
    short: gateChecksFor(lastVeto, lastL1, lastL2, lastRegime, lastL3Short, "SHORT"),
  };

  return {
    candidates,
    read: {
      veto: lastVeto,
      layer1: lastL1,
      layer2: lastL2,
      regime: lastRegime,
      layer3: lastL3ForRegime,
      action,
      contractType,
      state,
      stateLabel,
      nextStep,
      confidence,
      confidenceParts,
      reasoning,
      gateStatus,
    },
    lastClosed: {
      m1: lastM1Idx >= 0 ? m1[lastM1Idx].time : null,
      m5: m5.length ? m5[m5.length - 1].time : null,
      m15: m15.length ? m15[m15.length - 1].time : null,
    },
  };
}

// ── Çıkış sinyali (öncelik sıralı, spec §6) ─────────────────────────

export interface ExitSignal {
  time: number;
  spot: number;
  reason: ExitKind;
  note: string;
}

export interface ExitScan {
  signal: ExitSignal | null;
  progress: ExitProgress;
}

export interface ExitScanInput {
  m1: Bar[];
  m5: Bar[];
  entryTime: number;
  side: Side;
  entrySpot: number;
  session: SessionInfo;
  nowSec: number;
  /** 0DTE prim mumları — GERÇEK veri, yoksa $ kâr/zarar hesaplanmaz (uydurma yok) */
  premiumBars?: Bar[];
}

export function findExitSignal(input: ExitScanInput): ExitScan {
  const { side, entryTime, session, nowSec } = input;
  const premAt = new Map<number, number>();
  for (const b of input.premiumBars ?? []) premAt.set(b.time, b.close);
  const premLowAt = new Map<number, number>();
  for (const b of input.premiumBars ?? []) premLowAt.set(b.time, b.low);
  const entryPremium = (() => {
    for (const b of input.premiumBars ?? []) if (b.time >= entryTime) return b.close;
    return null;
  })();
  const pctAt = (t: number): number | null => {
    if (entryPremium == null || entryPremium <= 0) return null;
    const p = premAt.get(t);
    return p == null ? null : p / entryPremium - 1;
  };
  /** Stop, mum kapanışı değil mum içi EN KÖTÜ (low) seviyeyle kontrol edilir */
  const worstPctAt = (t: number): number | null => {
    if (entryPremium == null || entryPremium <= 0) return null;
    const p = premLowAt.get(t);
    return p == null ? null : p / entryPremium - 1;
  };

  const m1 = closedBars(input.m1, 1, nowSec);
  const m5 = closedBars(input.m5, 5, nowSec);
  const m5Closes = closes(m5);
  const m5Ema = ema(m5Closes, M5_EMA_PERIOD);
  const m5Rsi = rsi(m5Closes, M5_RSI_PERIOD);
  const eodEpoch = eodEpochOf(session);

  let m5Cursor = -1;
  let barsHeld = 0;
  let bestSpot: number | null = null;
  let emaFavor: boolean | null = null;
  let emaGapPct: number | null = null;
  let rsiSupportive: boolean | null = null;
  let rsi5: number | null = null;
  let lastPct: number | null = null;
  let trailFloorPct: number | null = null;

  const progressOf = (note: string): ExitProgress => ({
    emaFavor, emaGapPct, rsiSupportive, rsi5, barsHeld, bestSpot, premiumPct: lastPct, trailFloorPct, note,
  });

  for (let i = 1; i < m1.length; i++) {
    const bar = m1[i];
    if (bar.time <= entryTime) continue;

    while (m5Cursor + 1 < m5.length && m5[m5Cursor + 1].time + 300 <= bar.time + 60) m5Cursor++;
    barsHeld++;

    const favorable = side === "LONG" ? bar.high : bar.low;
    bestSpot = bestSpot == null ? favorable : side === "LONG" ? Math.max(bestSpot, favorable) : Math.min(bestSpot, favorable);

    const pct = pctAt(bar.time);
    if (pct != null) lastPct = pct;

    // 0 (MUTLAK) — 15:45 ET zorunlu 0DTE kapaması
    if (bar.time >= eodEpoch) {
      return {
        signal: { time: bar.time, spot: bar.close, reason: "EOD_EXIT", note: "15:45 ET zorunlu 0DTE kapaması — diğer tüm kurallardan önceliklidir." },
        progress: progressOf("Gün sonu kapaması."),
      };
    }

    // 1 (ACİL) — 5m EMA21 zıt yönde kesildi (anlık: en güncel 5m EMA21, 1m granülerlikte kontrol)
    if (m5Cursor >= 0) {
      const e5 = m5Ema[m5Cursor];
      if (e5 != null) {
        const against = side === "LONG" ? bar.close < e5 : bar.close > e5;
        emaFavor = !against;
        emaGapPct = ((bar.close - e5) / e5) * 100;
        if (against) {
          return {
            signal: {
              time: bar.time, spot: bar.close, reason: "EMA_CROSS_EXIT",
              note: `5m EMA21 ${side === "LONG" ? "altına" : "üstüne"} zıt yönde kesildi (fiyat ${bar.close.toFixed(2)}, EMA21 ${e5.toFixed(2)}) — acil çıkış.`,
            },
            progress: progressOf("5m EMA21 kesişimiyle acil çıkış."),
          };
        }
      }
    }

    // 2 (NORMAL) — 5m RSI yön değiştirdi (yalnızca kapalı 5m bar)
    if (m5Cursor >= 1) {
      const r5 = m5Rsi[m5Cursor], r5p = m5Rsi[m5Cursor - 1];
      rsi5 = r5;
      if (r5 != null && r5p != null) {
        const flipped = side === "LONG" ? r5 < r5p : r5 > r5p;
        rsiSupportive = !flipped;
        if (flipped) {
          return {
            signal: {
              time: bar.time, spot: bar.close, reason: "RSI_FLIP_EXIT",
              note: `5m RSI yön değiştirdi (${r5.toFixed(0)}, önceki ${r5p.toFixed(0)}) — normal çıkış.`,
            },
            progress: progressOf("5m RSI yön değişimiyle çıkış."),
          };
        }
      }
    }

    // 3 (STOP) — opsiyon değeri eşiği geçti (anlık: mum içi en kötü seviye)
    const worstPct = worstPctAt(bar.time);
    if (worstPct != null && worstPct <= EXIT_STOP_PCT) {
      return {
        signal: {
          time: bar.time, spot: bar.close, reason: "STOP_EXIT",
          note: `Sabit stop: prim en kötü %${(worstPct * 100).toFixed(0)} (eşik %${EXIT_STOP_PCT * 100}).`,
        },
        progress: progressOf("Sabit stopla kapandı."),
      };
    }

    // 4 (TRAILING) — kâr +%40/+%50 sonrası taban yükselir (yalnızca kapalı 5m bar güncellemesi)
    if (m5Cursor >= 1 && pct != null) {
      if (pct >= EXIT_TRAIL_ARM2_PCT) trailFloorPct = Math.max(trailFloorPct ?? -Infinity, EXIT_TRAIL_FLOOR2);
      else if (pct >= EXIT_TRAIL_ARM1_PCT) trailFloorPct = Math.max(trailFloorPct ?? -Infinity, EXIT_TRAIL_FLOOR1);
    }
    if (trailFloorPct != null && worstPct != null && worstPct <= trailFloorPct) {
      return {
        signal: {
          time: bar.time, spot: bar.close, reason: "TRAIL_EXIT",
          note: `Trailing kilit: prim daha önce +%${(trailFloorPct >= EXIT_TRAIL_FLOOR2 ? EXIT_TRAIL_ARM2_PCT : EXIT_TRAIL_ARM1_PCT) * 100} eşiğini geçmişti, taban %${(trailFloorPct * 100).toFixed(0)} seviyesine döndü.`,
        },
        progress: progressOf(`Trailing kilit tabanıyla (%${(trailFloorPct * 100).toFixed(0)}) kapandı.`),
      };
    }
  }

  return {
    signal: null,
    progress: progressOf(
      barsHeld === 0
        ? "Pozisyon henüz taşınmaya başlamadı."
        : `${barsHeld} mum taşındı — 5m EMA21 ${emaFavor === false ? "aleyhte (acil çıkış tetiklenmek üzere)" : "lehte"}, 5m RSI ${rsiSupportive === false ? "aleyhte" : "destekliyor"}.`
    ),
  };
}

// ── Pozisyon durum makinesi ────────────────────────────────────────

export interface LifecycleInput {
  candidate: EntryCandidate;
  exit: ExitScan;
  premiumBars: Bar[];
  contract: string | null;
  strike: number | null;
  expiry: string | null;
  livePremium?: number | null;
}

export function runLifecycle(input: LifecycleInput): PositionState {
  const { candidate, exit, premiumBars } = input;
  const events: EngineEvent[] = [];
  const rules = CONTRACT_RULES[candidate.contractType];
  const sideWord = candidate.side === "LONG" ? "LONG" : "SHORT";

  const pos: PositionState = {
    id: idOf("pos", candidate.time, candidate.side),
    side: candidate.side,
    contractType: candidate.contractType,
    entryTime: candidate.time,
    entrySpot: candidate.spot,
    contract: input.contract,
    strike: input.strike,
    expiry: input.expiry,
    entryPremium: null,
    status: exit.signal ? "CLOSED" : "OPEN",
    lastPremium: null,
    realizedPnl: 0,
    unrealizedPnl: null,
    events,
    exitTime: exit.signal?.time ?? null,
    exitSpot: exit.signal?.spot ?? null,
    exitPremium: null,
    exitReason: exit.signal?.reason ?? null,
    exitNote: exit.signal?.note ?? null,
    progress: exit.progress,
    premiumDataMissing: true,
  };

  const entryIdx = premiumBars.findIndex((b) => b.time >= candidate.time);
  const entryPremium = entryIdx >= 0 ? premiumBars[entryIdx].close : null;
  pos.entryPremium = entryPremium;
  pos.premiumDataMissing = entryPremium == null;

  events.push({
    id: idOf("ev", candidate.time, "ENTRY"),
    kind: "ENTRY",
    time: candidate.time,
    side: candidate.side,
    spot: candidate.spot,
    premium: entryPremium,
    pnl: entryPremium == null ? null : 0,
    label: `${sideWord} GİRİŞ`,
    note: `${rules.label} · ${candidate.reasoning}${entryPremium == null ? " · Opsiyon primi verisi yok — $ kâr/zarar hesaplanamıyor." : ""}`,
  });

  if (exit.signal) {
    const exitIdx = premiumBars.findIndex((b) => b.time >= exit.signal!.time);
    const exitPremium = exitIdx >= 0 ? premiumBars[exitIdx].close : null;
    pos.exitPremium = exitPremium;
    pos.lastPremium = exitPremium;

    if (entryPremium != null && exitPremium != null) {
      pos.realizedPnl = r2((exitPremium - entryPremium) * 100);
    }
    pos.unrealizedPnl = 0;

    events.push({
      id: idOf("ev", exit.signal.time, exit.signal.reason),
      kind: exit.signal.reason,
      time: exit.signal.time,
      side: candidate.side,
      spot: exit.signal.spot,
      premium: exitPremium,
      pnl: entryPremium != null && exitPremium != null ? pos.realizedPnl : null,
      label: `${sideWord} ÇIKIŞ`,
      note: exit.signal.note,
    });
  } else {
    const lastBar = premiumBars.length ? premiumBars[premiumBars.length - 1] : null;
    const live = input.livePremium ?? lastBar?.close ?? null;
    pos.lastPremium = live;
    if (entryPremium != null && live != null) {
      pos.unrealizedPnl = r2((live - entryPremium) * 100);
    }
  }

  return pos;
}

export interface FilterOverlappingResult {
  accepted: EntryCandidate[];
  contractReuseBlocked: { time: number; side: Side; strike: number }[];
}

/**
 * Aynı anda tek pozisyon + yeniden giriş (re-arm) + saatlik kota + kontrat
 * başına tek deneme. Mantık V4'ten değişmedi — bu, giriş/çıkış KATMANLARINA
 * değil, pozisyon YÖNETİMİNE ait bir kural.
 */
export function filterOverlapping(
  candidates: EntryCandidate[],
  positions: Pick<PositionState, "entryTime" | "side" | "contractType" | "exitTime" | "strike">[],
  m1: Bar[]
): FilterOverlappingResult {
  const posByKey = new Map<string, (typeof positions)[number]>();
  for (const p of positions) posByKey.set(`${p.entryTime}:${p.side}:${p.contractType}`, p);

  const usedContracts = new Set<string>();
  for (const p of positions) {
    if (p.exitTime != null && p.strike != null) usedContracts.add(`${p.strike}:${p.side}`);
  }

  const out: EntryCandidate[] = [];
  const contractReuseBlocked: FilterOverlappingResult["contractReuseBlocked"] = [];
  let blockedUntil = -Infinity;
  const recent: number[] = [];

  for (const c of candidates) {
    const strike = atmStrike(c.spot);
    if (usedContracts.has(`${strike}:${c.side}`)) {
      contractReuseBlocked.push({ time: c.time, side: c.side, strike });
      continue;
    }

    if (c.time < blockedUntil) continue;

    while (recent.length && c.time - recent[0] > 3600) recent.shift();
    if (recent.length >= MAX_ENTRIES_PER_HOUR) continue;

    out.push(c);
    recent.push(c.time);

    const pos = posByKey.get(`${c.time}:${c.side}:${c.contractType}`);
    if (!pos || pos.exitTime == null) {
      blockedUntil = Infinity;
      continue;
    }
    const correction = m1.find((b) => b.time > pos.exitTime! && candleDir(b) === (pos.side === "LONG" ? "DOWN" : "UP"));
    blockedUntil = correction ? correction.time : Infinity;
  }
  return { accepted: out, contractReuseBlocked };
}

// ── Etiketler (UI) ────────────────────────────────────────────────

export const EVENT_LABEL: Record<EventKind, string> = {
  ENTRY: "Giriş",
  EMA_CROSS_EXIT: "5m EMA21 Kesişimi — Acil Çıkış",
  RSI_FLIP_EXIT: "5m RSI Dönüşü — Çıkış",
  STOP_EXIT: "Sabit Stop",
  TRAIL_EXIT: "Trailing Kilit",
  EOD_EXIT: "Gün Sonu Kapama",
};

export const EXIT_LABEL_SHORT: Record<ExitKind, string> = {
  EMA_CROSS_EXIT: "EMA21 Kesişimi",
  RSI_FLIP_EXIT: "RSI Dönüşü",
  STOP_EXIT: "Stop",
  TRAIL_EXIT: "Trailing",
  EOD_EXIT: "Gün Sonu",
};

export const EVENT_STYLE: Record<EventKind, { color: string; shape: "arrowUp" | "arrowDown" | "circle" | "square"; glyph: string }> = {
  ENTRY:          { color: "#22c55e", shape: "arrowUp",   glyph: "▲" },
  EMA_CROSS_EXIT: { color: "#ef4444", shape: "arrowDown", glyph: "▼" },
  RSI_FLIP_EXIT:  { color: "#f97316", shape: "arrowDown", glyph: "▼" },
  STOP_EXIT:      { color: "#f97316", shape: "square",    glyph: "■" },
  TRAIL_EXIT:     { color: "#38bdf8", shape: "circle",    glyph: "●" },
  EOD_EXIT:       { color: "#94a3b8", shape: "square",    glyph: "■" },
};

export const CONTRACT_TONE: Record<ContractType, string> = {
  A: "#38bdf8",
  B: "#a855f7",
};
