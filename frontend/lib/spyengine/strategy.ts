/**
 * SPY Engine V6.0 — Strateji ve Pozisyon Durum Makinesi (izomorfik, saf)
 *
 * V4.2'den TAM MİMARİ DEĞİŞİKLİK: artık üç zaman dilimi ayrı roller taşıyor.
 *
 *   15m VETO       → yön izni (LONG/SHORT/NÖTR). Karar üretmez, sadece
 *                     ters yöndeki girişleri engeller.
 *   5m TREND        → ANA KARAR KATMANI. Geçerse bir yönde "REJİM" açılır;
 *                     bu rejim, Layer 1 geçerli kaldığı sürece (her yeni
 *                     kapanan 5m barda yeniden kontrol edilerek) AKTİF
 *                     kalan bir DURUMDUR — tek bir bara değil, bir
 *                     pencereye bağlıdır. (V6.0: eski Katman 2 "3'te 2
 *                     oylama" filtresi kaldırıldı — ekstra AND şartları
 *                     sinyal sayısını hızla sıfıra yaklaştırıyordu, kanıtı
 *                     olmayan bir sıkılaştırmaydı.)
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
 * ── HACİM VETOSU (RVOL, Katman 0 ile aynı kategoride) ───────────────
 *   RVOL = o 5m barın hacmi / AYNI SAAT DİLİMİNİN geçmiş günlerdeki
 *   ortalaması (basit "son 20 mum" ortalaması DEĞİL — açılış/kapanış hacim
 *   patlamaları ile öğlen durgunluğunu aynı eşikle ölçmek yanlış sinyal
 *   kaynağıydı).
 *     RVOL < 0.8  → "piyasa şu an anlamsız" — İKİ YÖNÜ DE ENGELLEYEN,
 *                   nadiren tetiklenen ikili (binary) bir VETO.
 *     RVOL > 2.0  → giriş kararını etkilemez; yalnızca strike seçiminde
 *                   "güçlü rejim + kurumsal katılım" ekstra girdisi olarak
 *                   kullanılır (bkz. STRIKE_OFFSET).
 *   RVOL, en az RVOL_MIN_SAMPLE_DAYS gün geçmiş veri gerektirir; yoksa
 *   `null` döner ve veto hiç tetiklenmez — uydurma yok.
 *
 * ── KATMAN 3 — 1m TETİK (zamanlama, sadece rejim aktifken) ──────────
 *   STRUCTURE (zorunlu): Close > önceki 2 KAPALI 1m mumun en yükseği (LONG)
 *   / en düşüğü (SHORT) — "breakout".
 *   CONFIRMATION (zorunlu): RSI7 yönlü — "RSI".
 *   fired = STRUCTURE && CONFIRMATION.
 *   (V6.0: eski EMA21(1m) konum şartı ve "RSI7 VEYA 5m RVOL" OR dalı
 *   kaldırıldı — LONG'u 5/9'dan gereksiz yere geriye çeken, kanıtı olmayan
 *   ekstra katmanlardı; kalan iki şart tek başına yeterli.)
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
 * Strike seçim kademesi. "S" = Süper güçlü (RSI VE MACD ikisi de + RVOL>2.0
 * kurumsal katılım onayı), "A" = Güçlü kurulum (RSI VE MACD ikisi de, RVOL
 * normal), "B" = Orta kurulum (yalnızca biri). İsimlendirme eski V3/V4
 * "kontrat türü" alanıyla uyumluluk için korundu, anlamı değişti.
 */
export type ContractType = "S" | "A" | "B";

export const CONTRACT_RULES: Record<ContractType, { label: string }> = {
  S: { label: "Süper Güçlü Kurulum (RSI + MACD + RVOL>2.0, ATM+2, 0DTE)" },
  A: { label: "Güçlü Kurulum (5m RSI + MACD ikisi de yönlü, ATM+1, 0DTE)" },
  B: { label: "Orta Kurulum (5m RSI veya MACD, ATM, 0DTE)" },
};

/** Strike, ATM'den yön tarafında (LONG: yukarı, SHORT: aşağı) bu kadar $ ötelenir */
export const STRIKE_OFFSET: Record<ContractType, number> = { S: 2, A: 1, B: 0 };

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

/**
 * RVOL (relative volume) — aynı saat diliminin GEÇMİŞ günlerdeki ortalamasına
 * göre hacim oranı. Basit "son 20 mumun ortalaması" DEĞİL: açılış/kapanış
 * hacim patlamaları ile öğlen durgunluğunu aynı eşikle karıştırmaz.
 */
/** RVOL bucket genişliği — 5m barla aynı hizada */
export const RVOL_BUCKET_MIN = 5;
/** Bu eşiğin altı: ikili VETO — iki yönü de engeller */
export const RVOL_VETO_MIN = 0.8;
/** Bu eşik üstü: strike seçiminde "güçlü + kurumsal katılım" ekstra girdisi */
export const RVOL_STRONG_MIN = 2.0;
/** RVOL güvenilir sayılmadan önce gereken asgari geçmiş gün sayısı */
export const RVOL_MIN_SAMPLE_DAYS = 5;

/** 1m Katman 3 — tetik (zamanlama) */
/** Spec RSI7 diyor — eski katmanların RSI14'ünden BİLİNÇLİ OLARAK farklı */
export const M1_RSI_PERIOD = 7;
export const M1_STRUCTURE_LOOKBACK = 2;

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

/** RVOL vetosu — 15m veto ile aynı kategoride: ikili, iki yönü de engelleyebilen blok */
export interface VolumeVetoRead {
  rvol: number | null;
  sampleDays: number;
  active: boolean;
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
  volumeVeto: VolumeVetoRead;
  layer1: Layer1Read;
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

/** Strike, kademeye göre ATM'den yön tarafında ötelenir (LONG: yukarı/OTM call, SHORT: aşağı/OTM put) */
export function strikeFor(spot: number, side: Side, contractType: ContractType): number {
  const offset = STRIKE_OFFSET[contractType];
  const base = atmStrike(spot);
  return side === "LONG" ? base + offset : base - offset;
}

function eodEpochOf(session: SessionInfo): number {
  return session.rthOpen + (EOD_FORCE_MIN - RTH_OPEN_MIN) * 60;
}

function candleDir(b: Bar): "UP" | "DOWN" | "NONE" {
  if (b.close > b.open) return "UP";
  if (b.close < b.open) return "DOWN";
  return "NONE";
}

const rising = (v: number | null, p: number | null) => v != null && p != null && v > p;
const falling = (v: number | null, p: number | null) => v != null && p != null && v < p;

// ── RVOL (aynı saat diliminin geçmiş günlerdeki ortalamasına göre hacim) ──

export interface RvolBaseline {
  /** bucket anahtarı (ET gün-içi dakika, RVOL_BUCKET_MIN'e hizalı) → ortalama hacim */
  bucketAvg: Map<number, number>;
  /** bucket anahtarı → o bucket'a katkı veren farklı gün sayısı */
  bucketDays: Map<number, number>;
}

/**
 * Çok günlü 5m geçmişinden, HER SAAT DİLİMİ için ayrı bir ortalama hacim
 * tablosu kurar. `excludeDate` (bugünkü/canlı seans) hariç tutulur — kendi
 * kendine referans olup gürültüyü büyütmesin diye.
 */
export function buildRvolBaseline(history: Bar[], excludeDate: string): RvolBaseline {
  const sums = new Map<number, number>();
  const counts = new Map<number, number>();
  const daysSeen = new Map<number, Set<string>>();

  for (const b of history) {
    const p = nyParts(b.time);
    if (p.ymd === excludeDate) continue;
    const bucket = Math.floor(p.minutes / RVOL_BUCKET_MIN) * RVOL_BUCKET_MIN;
    sums.set(bucket, (sums.get(bucket) ?? 0) + (b.volume || 0));
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
    if (!daysSeen.has(bucket)) daysSeen.set(bucket, new Set());
    daysSeen.get(bucket)!.add(p.ymd);
  }

  const bucketAvg = new Map<number, number>();
  const bucketDays = new Map<number, number>();
  for (const [bucket, sum] of sums) {
    const n = counts.get(bucket) ?? 1;
    bucketAvg.set(bucket, sum / n);
    bucketDays.set(bucket, daysSeen.get(bucket)?.size ?? 0);
  }
  return { bucketAvg, bucketDays };
}

export const EMPTY_RVOL_BASELINE: RvolBaseline = { bucketAvg: new Map(), bucketDays: new Map() };

/** Bir 5m barın RVOL'u. Yeterli geçmiş yoksa `null` — uydurma yok. */
function rvolOf(baseline: RvolBaseline, bar: Bar): { rvol: number | null; sampleDays: number } {
  const p = nyParts(bar.time);
  const bucket = Math.floor(p.minutes / RVOL_BUCKET_MIN) * RVOL_BUCKET_MIN;
  const avg = baseline.bucketAvg.get(bucket);
  const days = baseline.bucketDays.get(bucket) ?? 0;
  if (avg == null || avg <= 0 || days < RVOL_MIN_SAMPLE_DAYS) return { rvol: null, sampleDays: days };
  return { rvol: (bar.volume || 0) / avg, sampleDays: days };
}

/**
 * Hacim vetosu — 15m veto ile aynı kategoride: RVOL < 0.8 iki yönü de
 * engeller. Oylamaya GÖMÜLMEZ; "2/3 diğer kriter geçti ama katılım yok"
 * durumunda bile kesin blok olması gerektiği için ayrı bir katman.
 */
function volumeVetoOf(rvol: number | null, sampleDays: number): VolumeVetoRead {
  if (rvol == null) {
    return { rvol: null, sampleDays, active: false, note: "RVOL geçmişi yetersiz (< 5 gün) — hacim vetosu devre dışı" };
  }
  const active = rvol < RVOL_VETO_MIN;
  return {
    rvol, sampleDays, active,
    note: active
      ? `RVOL ${rvol.toFixed(2)}× < ${RVOL_VETO_MIN} — piyasa katılımı çok düşük, her iki yönde de giriş engellendi`
      : `RVOL ${rvol.toFixed(2)}× (${sampleDays} gün ortalaması)`,
  };
}

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

// ── KATMAN 3 — 1m TETİK (zamanlama) ─────────────────────────────────

function layer3At(m1: Bar[], m1Rsi7: (number | null)[], idx: number, side: Side): Layer3Read {
  if (idx < M1_STRUCTURE_LOOKBACK) {
    return { checks: [], structureOk: false, confirmationOk: false, fired: false, note: "1m verisi yetersiz" };
  }
  const bar = m1[idx];
  const prevBars = m1.slice(idx - M1_STRUCTURE_LOOKBACK, idx); // önceki 2 KAPALI mum, mevcut hariç
  const isLong = side === "LONG";

  const extreme = isLong
    ? Math.max(...prevBars.map((b) => b.high))
    : Math.min(...prevBars.map((b) => b.low));
  const breakOk = isLong ? bar.close > extreme : bar.close < extreme;
  const structureOk = breakOk;

  const r = m1Rsi7[idx], rp = m1Rsi7[idx - 1];
  const rsiOk = isLong ? r != null && r > 50 && rising(r, rp) : r != null && r < 50 && falling(r, rp);
  const confirmationOk = rsiOk;

  const checks: GateCheck[] = [
    {
      label: `Kapanış önceki 2 mumun ${isLong ? "zirvesini" : "dibini"} kırdı (breakout)`,
      ok: breakOk,
      detail: `${bar.close.toFixed(2)} vs ${extreme.toFixed(2)}`,
    },
    {
      label: `1m RSI7 ${isLong ? "yükseliyor (>50)" : "düşüyor (<50)"}`,
      ok: rsiOk,
      detail: r == null ? "veri yok" : r.toFixed(0),
    },
  ];

  return {
    checks, structureOk, confirmationOk, fired: structureOk && confirmationOk,
    note: !structureOk
      ? "Breakout yok — önceki 2 mumun zirvesi/dibi kırılmadı"
      : !confirmationOk
      ? "Breakout oluştu, RSI7 konfirmasyonu bekleniyor"
      : `1m tetik ateşlendi (${side})`,
  };
}

// ── Güven skoru ──────────────────────────────────────────────────

function buildConfidence(l1: Layer1Read, side: Side, rvol: number | null): { total: number; parts: ConfidencePart[] } {
  const parts: ConfidencePart[] = [{ label: "Rejim + breakout + RSI7 geçildi (taban)", value: 65 }];
  let total = 65;

  const strong = side === "LONG" ? l1.strongLong : l1.strongShort;
  const strongPts = strong ? 20 : 10;
  parts.push({ label: strong ? "Güçlü kurulum (RSI + MACD ikisi de)" : "Orta kurulum (RSI veya MACD)", value: strongPts });
  total += strongPts;

  if (rvol != null && rvol > RVOL_STRONG_MIN) {
    parts.push({ label: `RVOL ${rvol.toFixed(2)}× > ${RVOL_STRONG_MIN} — kurumsal katılım onayı`, value: 5 });
    total += 5;
  }

  return { total: Math.max(0, Math.min(100, total)), parts };
}

// ── Kapı Durumu (manuel işlem için birleşik veto listesi) ───────────

/**
 * Kapı Durumu listesi V6.0'da 5 kalemle sınırlı: 15m veto + hacim + trend +
 * breakout + RSI. "5m filtre (2/3 oy)", "5m rejim aktif" (Layer1'in kendisiyle
 * birebir aynı bilgiyi tekrarlıyordu) ve 1m'nin EMA21 alt-şartı KALDIRILDI —
 * ekstra AND şartları sinyal sayısını hızla sıfıra yaklaştırıyordu.
 */
function gateChecksFor(
  veto: M15VetoRead, volVeto: VolumeVetoRead, l1: Layer1Read, l3ForSide: Layer3Read, side: Side
): GateCheck[] {
  const isLong = side === "LONG";
  const l1Pass = isLong ? l1.passLong : l1.passShort;
  return [
    { label: "15m veto izin veriyor", ok: veto.direction === side, detail: veto.direction === "NEUTRAL" ? "nötr" : veto.direction },
    { label: `Hacim vetosu yok (RVOL ≥ ${RVOL_VETO_MIN})`, ok: !volVeto.active, detail: volVeto.rvol == null ? "veri yok" : `RVOL ${volVeto.rvol.toFixed(2)}×` },
    { label: "5m trend (EMA21 konumu + RSI/MACD)", ok: l1Pass, detail: l1Pass ? "geçti" : "geçmedi" },
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
  /**
   * Çok günlü 5m geçmişi (RVOL baseline için) — bugünkü seans HARİÇ olmak
   * üzere en az RVOL_MIN_SAMPLE_DAYS gün içermeli. Verilmezse RVOL hiçbir
   * yerde hesaplanamaz (`null` kalır) ve o katmanlar sessizce devre dışı
   * kalır — uydurma değer üretilmez.
   */
  m5History?: Bar[];
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

  const m1Closes = closes(m1);
  const m1Rsi7 = rsi(m1Closes, M1_RSI_PERIOD);

  // ── RVOL: her 5m bar için, AYNI SAAT DİLİMİNİN geçmiş günlerdeki ortalamasına
  //    göre hacim oranı (bkz. dosya başlığı "HACİM VETOSU") ─────────────────
  const rvolBaseline = input.m5History?.length ? buildRvolBaseline(input.m5History, session.date) : EMPTY_RVOL_BASELINE;
  const m5Rvol: (number | null)[] = new Array(m5.length);
  const m5RvolDays: number[] = new Array(m5.length);
  for (let j = 0; j < m5.length; j++) {
    const { rvol, sampleDays } = rvolOf(rvolBaseline, m5[j]);
    m5Rvol[j] = rvol;
    m5RvolDays[j] = sampleDays;
  }

  // ── Rejim zaman çizelgesi: her kapalı 5m barda yeniden değerlendirilir,
  //    Layer 1 geçerli kaldığı sürece AKTİF kalan bir DURUM olarak.
  //    RVOL vetosu (<0.8) 15m veto ile aynı kategoride — Layer 1 geçse
  //    bile rejimi doğrudan kapatır ─────────────────────────────────────
  const regimeTimeline: RegimeState[] = new Array(m5.length);
  const volVetoTimeline: VolumeVetoRead[] = new Array(m5.length);
  {
    let side: RegimeSide = "NONE";
    let since: number | null = null;
    for (let j = 0; j < m5.length; j++) {
      const l1 = layer1At(m5, m5Ema, m5Rsi, m5MacdHist, j);
      const volVeto = volumeVetoOf(m5Rvol[j], m5RvolDays[j]);
      volVetoTimeline[j] = volVeto;
      const passLong = l1.passLong && !volVeto.active;
      const passShort = l1.passShort && !volVeto.active;

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
        note: side === "NONE"
          ? volVeto.active ? `Rejim yok — ${volVeto.note}` : "Rejim yok — 5m trend (Layer 1) geçmedi"
          : `${side} rejimi ${since ? nyParts(since).hhmm + " ET'den beri" : ""} aktif`,
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
    const rvol = m5Rvol[m5Cursor];
    const l3 = layer3At(m1, m1Rsi7, i, side);
    if (!l3.fired) continue;

    const l1 = layer1At(m5, m5Ema, m5Rsi, m5MacdHist, m5Cursor);
    const strong = side === "LONG" ? l1.strongLong : l1.strongShort;
    const contractType: ContractType = strong && rvol != null && rvol > RVOL_STRONG_MIN ? "S" : strong ? "A" : "B";
    const { total, parts } = buildConfidence(l1, side, rvol);

    candidates.push({
      time: bar.time,
      side,
      spot: bar.close,
      contractType,
      confidence: total,
      confidenceParts: parts,
      reasoning:
        `5m rejim ${side} aktif (${l1.note}) · ` +
        `1m tetik: breakout + RSI7 konfirmasyonu · ` +
        `15m veto ${side} yönünü serbest bırakıyor`,
    });
  }

  // ── Canlı okuma (son kapalı mumlar üzerinden, panel için) ────────
  const lastM1Idx = m1.length - 1;
  const lastVeto = m15VetoAt(m15, m15Ema, m15Atr, m15Cursor);
  const lastVolVeto: VolumeVetoRead = m5Cursor >= 0 && volVetoTimeline[m5Cursor]
    ? volVetoTimeline[m5Cursor]
    : volumeVetoOf(null, 0);
  const lastL1 = layer1At(m5, m5Ema, m5Rsi, m5MacdHist, m5Cursor);
  const lastRegime: RegimeState = m5Cursor >= 0 && regimeTimeline[m5Cursor] ? regimeTimeline[m5Cursor] : { side: "NONE", since: null, note: "Rejim için 5m verisi yetersiz" };
  const lastL3Long = layer3At(m1, m1Rsi7, lastM1Idx, "LONG");
  const lastL3Short = layer3At(m1, m1Rsi7, lastM1Idx, "SHORT");
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
  let reasoning = "5m rejim aranıyor — Layer 1 (trend) geçmedi.";
  let stateLabel = "İZLEMEDE";
  let nextStep = lastVolVeto.active
    ? `Hacim vetosu aktif: ${lastVolVeto.note}. Rejim aranmıyor.`
    : "5m kapanışında Layer 1 (trend) geçmesi bekleniyor.";

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
    reasoning = `5m rejim ${lastRegime.side} aktif — 1m tetik (breakout + RSI7 konfirmasyonu) bekleniyor.`;
    stateLabel = "HAZIRLANIYOR";
    nextStep = vetoBlocks
      ? `5m rejim ${lastRegime.side} aktif ama 15m veto bu yönü engelliyor (${lastVeto.note}). Motor bekliyor.`
      : !lastL3ForRegime.structureOk
      ? `5m rejim ${lastRegime.side} aktif. 1m'de breakout (önceki 2 mumun ${lastRegime.side === "LONG" ? "zirvesi" : "dibi"}) bekleniyor.`
      : `5m rejim ${lastRegime.side} aktif, 1m breakout oluştu. RSI7 konfirmasyonu bekleniyor.`;
  }

  const gateStatus: GateStatus = {
    long: gateChecksFor(lastVeto, lastVolVeto, lastL1, lastL3Long, "LONG"),
    short: gateChecksFor(lastVeto, lastVolVeto, lastL1, lastL3Short, "SHORT"),
  };

  return {
    candidates,
    read: {
      veto: lastVeto,
      volumeVeto: lastVolVeto,
      layer1: lastL1,
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
    const strike = strikeFor(c.spot, c.side, c.contractType);
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
  S: "#facc15",
  A: "#38bdf8",
  B: "#a855f7",
};
