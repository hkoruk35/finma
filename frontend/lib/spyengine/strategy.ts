/**
 * SPY Engine V8.0 — Strateji ve Pozisyon Durum Makinesi (izomorfik, saf)
 *
 * V7.0'dan MİMARİ TERSİNE DÖNDÜ (22 Eyl 2026, @hasan): 30m açılış rejimi
 * hiçbir yerde kullanılmıyor — 2 gün boyunca hiç işlem üretmeyen, aşırı katı
 * bir AND-kapısı olduğu için tamamen terk edildi. Yeni sıralama:
 *
 *   5m ANA KARAR    → VWAP konumu (BİRİNCİL karar indikatörü — fiyat VWAP
 *                     üstünde/altında) + mum formasyonu (bkz.
 *                     candlePatterns.ts: yutan mum, çekiç, yıldız, iç mum,
 *                     kırılım+retest, başarısız kırılım, hacim doruğu,
 *                     düşük-hacim-konsolidasyon-kırılımı) + hacim anomalisi
 *                     (son 10×5m ortalamasına göre) + RSI(14) yönü birlikte
 *                     AĞIRLIKLI PUANLANIR (bkz. tradingPlan.ts setup5mScore:
 *                     VWAP 35 + formasyon 30 + hacim 20 + RSI 15 = 100 taban,
 *                     +10 EMA21 bonusu). Skor ≥ SETUP_FIRE_THRESHOLD (60)
 *                     olunca giriş adayı üretilir — eski "dördü de VE"
 *                     modelinden çok daha sık tetiklenir.
 *   15m YÖN+TEYİT   → ZORUNLU KAPI, tetik değil. 15m VWAP (birincil) + EMA21
 *                     (ikincil) konumu 5m sinyalle AYNI yönde olmalı; aksi
 *                     halde giriş üretilmez ("15m onayı olmadan işlem
 *                     açılmaz" — kullanıcı kuralı).
 *   30m             → KULLANILMIYOR.
 *   EMA21(5m)       → SADECE trend bilgisi/bonus — tek başına karar vermez,
 *                     engellemez (kullanıcı kuralı).
 *
 * STOP hâlâ 15m yapısından: Stop_SPY = son geçerli 15m dip/tepe ∓ 0.25×
 * ATR_15m (bkz. tradingPlan.ts stopSpyOf) — bu risk-yönetim kuralı giriş
 * mantığından bağımsız, DEĞİŞMEDİ.
 *
 * ── GİRİŞ PENCERESİ — 09:45 – 15:00 ET (değişmedi) ──────────────────
 *   09:45'ten önce giriş yok: açılışın ilk çeyreği fiyat keşfidir.
 *   15:00'ten sonra YENİ giriş yok. 15:45 ET zorunlu 0DTE kapaması bundan
 *   ayrı ve mutlak kalır.
 *
 * ── ÇIKIŞ — öncelik sıralı, asimetrik hız (giriş konfirmasyonlu/yavaş,
 *   çıkış hızlı) — DEĞİŞMEDİ. ──────────────────────────────────────────
 *   0 (mutlak)  15:45 ET zorunlu 0DTE kapaması.
 *   1 (ACİL)    5m EMA21 zıt yönde kesilirse → anlık.
 *   2 (NORMAL)  5m RSI yön değiştirirse çıkış HAZIRLANIR, uygulama 15m
 *               yapı stopunun (bkz. aşağı) tetiklenmesini VEYA 1m'de ters
 *               dönüşü bekler (girişin aynası, ama VE değil VEYA).
 *   3 (STOP)    15m yapı stopu (Stop_SPY) kırılırsa → anlık (mum içi en
 *               kötü seviye). Yapı verisi henüz yoksa sabit prim yüzdesi
 *               (EXIT_STOP_PCT) güvenlik ağı olarak devrede.
 *   4 (TRAILING) Kâr +%40'ı geçince taban breakeven'e, +%50'yi geçince
 *               tabana yükselir; her kapanmış 5m barda güncellenir.
 *
 * NON-REPAINTING: tüm kararlar SADECE kapanmış mumlarla verilir. Her
 * fonksiyon saftır (yan etkisiz) — girdi bar dizisi + index, çıktı
 * hesaplanmış değer/karar.
 *
 * ── DIŞ TÜKETİCİ UYUMLULUĞU (kapsam kısıtı) ─────────────────────────
 * `app/api/admin/spyengine/v2/route.ts`, `lib/spyengine/heuristics.ts`,
 * `components/admin/spyengine/{SpyChart,SignalsArchive}.tsx` bu görevin
 * KAPSAMI DIŞINDA ve değiştirilmiyor. Bu yüzden `M15VetoRead`, `Layer1Read`,
 * `VolumeVetoRead`, `RegimeState`, `Layer3Read`, `EngineRead`, `PositionState`
 * tiplerinin ALAN ADLARI/ŞEKLİ korunuyor — sadece İÇERİKLERİ yeni mimariye
 * göre yeniden yorumlanıyor:
 *   - `veto` (M15VetoRead)     → şimdi "15m Yön + Teyit" (zorunlu kapı).
 *   - `layer1` (Layer1Read)    → DEĞİŞMEDİ: gerçek 5m EMA21/RSI14/MACD
 *                                (heuristics.ts'in reversal/tükenme skoru
 *                                bunu okumaya devam ediyor).
 *   - `volumeVeto` (VolumeVetoRead) → DEĞİŞMEDİ: gerçek çok-günlü 5m RVOL
 *                                (heuristics.ts `rvolForReversal` için gerçek
 *                                sayı okumaya devam ediyor); "aktif" bayrağı
 *                                hâlâ RVOL<0.8 piyasa-ölü vetosu.
 *   - `regime` (RegimeState)   → şimdi "5m ana karar ateşlendi mi" durumu.
 *   - `layer3` (Layer3Read)    → şimdi 5m ana karar skorunun bileşen
 *                                dökümü (VWAP/formasyon/hacim/RSI/EMA21).
 * `EngineRead`e SADECE EKLEME yapıldı (`refinement5m`, `stopSpy`) — route.ts
 * bu alanlara dokunmuyor, ekleme onu bozmaz. `refinement5m` artık kullanılan
 * bir "zamanlama" katmanı değil (5m zaten ana karar) — geriye uyumluluk için
 * her zaman `{readyToEnter: true, note: "5m ana karar katmanı"}` döner.
 */

import {
  Bar,
  Series,
  SessionInfo,
  ema,
  rsi,
  macd,
  atr,
  bucketAggregate,
  sessionVwap,
  nyParts,
  RTH_OPEN_MIN,
  EOD_FORCE_MIN,
  r2,
} from "./core";
import {
  chopBandOf,
  atr15mSeries,
  ema21Of15m,
  stopSpyOf,
  stopPremiumOf,
  vwapDirectionOf,
  rsiDirectionOf,
  trend15mDirection,
  volumeRatio5m,
  setup5mScore,
  SETUP_FIRE_THRESHOLD,
  type Setup5mScore,
  type FiveMinuteRefinement,
} from "./tradingPlan";
import { detectCandlePatterns, strongestPatternFor, type CandlePatternHit } from "./candlePatterns";

// ── Tipler ────────────────────────────────────────────────────────

export type Side = "LONG" | "SHORT";
export type VetoDirection = "LONG" | "SHORT" | "NEUTRAL";
export type RegimeSide = "LONG" | "SHORT" | "NONE";

/**
 * Strike seçim kademesi. "S" = Süper güçlü (5m ana karar skoru ≥85 — VWAP+
 * formasyon+hacim+RSI'nin çoğu birden hizalı), "A" = Güçlü kurulum (skor
 * ≥70), "B" = Orta kurulum (eşiği geçen taban, skor ≥60). İsimlendirme eski
 * V3/V4 "kontrat türü" alanıyla uyumluluk için korundu, girdileri V8.0'da
 * güncellendi (5m ana karar skoru + 15m yön teyidi).
 */
export type ContractType = "S" | "A" | "B";

export const CONTRACT_RULES: Record<ContractType, { label: string }> = {
  S: { label: "Süper Güçlü Kurulum (5m skor ≥85: VWAP+formasyon+hacim+RSI çoğu hizalı, ATM+2, 0DTE)" },
  A: { label: "Güçlü Kurulum (5m skor ≥70, ATM+1, 0DTE)" },
  B: { label: "Orta Kurulum (5m skor ≥60 — eşik, ATM, 0DTE)" },
};

/** Strike, ATM'den yön tarafında (LONG: yukarı, SHORT: aşağı) bu kadar $ ötelenir */
export const STRIKE_OFFSET: Record<ContractType, number> = { S: 2, A: 1, B: 0 };

// ── Katman sabitleri ─────────────────────────────────────────────

/** 15m yön + teyit katmanı (zorunlu kapı) — EMA21(15m) periyodu */
export const M15_EMA_PERIOD = 21;

/** 5m bağlam katmanı (zamanlama girdisi + Faz 1 reversal skoru) — DEĞİŞMEDİ */
export const M5_EMA_PERIOD = 21;
export const M5_RSI_PERIOD = 14;
export const M5_MACD_FAST = 12;
export const M5_MACD_SLOW = 26;
export const M5_MACD_SIGNAL = 9;

/**
 * RVOL (relative volume) — aynı saat diliminin GEÇMİŞ günlerdeki ortalamasına
 * göre hacim oranı. `layer1`/`volumeVeto` alanlarını beslemeye devam eder
 * (heuristics.ts reversal skoru için gerçek sayı gerektiriyor); 15m tetiğin
 * KENDİ hacim şartı artık `rollingVolumeAvg`/`volumeFilterOk`
 * (tradingPlan.ts, son 8×15m ortalamasının 1.15 katı) — ayrı ve ek bir filtre.
 */
export const RVOL_BUCKET_MIN = 5;
/** Bu eşiğin altı: ikili VETO — iki yönü de engeller (piyasa "ölü") */
export const RVOL_VETO_MIN = 0.8;
/** Bu eşik üstü: strike seçiminde "güçlü + kurumsal katılım" ekstra girdisi */
export const RVOL_STRONG_MIN = 2.0;
/** RVOL güvenilir sayılmadan önce gereken asgari geçmiş gün sayısı */
export const RVOL_MIN_SAMPLE_DAYS = 5;

/** Saatte azami giriş (kayan 60 dakikalık pencere) — V4'ten korundu */
export const MAX_ENTRIES_PER_HOUR = 3;

// ── Giriş penceresi (kullanıcı kuralı, 2026-09-18 — değişmedi) ──────

export const ENTRY_OPEN_MIN = 9 * 60 + 45; // 09:45
export const ENTRY_CUTOFF_MIN = 15 * 60; // 15:00

// ── Çıkış sabitleri (spec §6) ───────────────────────────────────────

/**
 * Sabit stop, opsiyon primi yüzdesi olarak — V7.0'da ARTIK BİRİNCİL DEĞİL.
 * 15m yapı stopu (Stop_SPY, bkz. tradingPlan.ts stopSpyOf) hesaplanabildiği
 * sürece o kullanılır; bu sabit yalnızca ilk barlarda (henüz swing/ATR verisi
 * olgunlaşmamışken) devreye giren bir güvenlik ağıdır.
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
  /** 15m yapı stopu (Stop_SPY) — trailing, her kapanan 15m barda yeniden hesaplanır */
  stopSpy: number | null;
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
  /** Girişteki 15m yapı stopu (Stop_SPY) — bilgi amaçlı, ilk hesap */
  entryStopSpy: number | null;
  /** Stop_prem (giriş primi - SPY hareketi×delta + 0.10) — gerçek delta akışı
   * olmadan hesaplanamaz, bu yüzden delta verilmediği sürece `null` kalır
   * (uydurma yok). `runLifecycle`e `delta` verildiğinde doldurulur. */
  entryStopPremium: number | null;
}

export interface EntryCandidate {
  time: number;
  side: Side;
  spot: number;
  contractType: ContractType;
  confidence: number;
  confidenceParts: ConfidencePart[];
  reasoning: string;
  /** 15m yapı stopu — giriş anında hesaplanan ilk değer */
  stopSpy: number | null;
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

/** V7.0: "30m Rejim + 15m Teyit" katmanı (eski adı korundu, bkz. dosya başlığı) */
export interface M15VetoRead {
  direction: VetoDirection;
  close: number | null;
  ema21: number | null;
  note: string;
}

/** DEĞİŞMEDİ: gerçek 5m EMA21/RSI14/MACD bağlamı (heuristics.ts + zamanlama girdisi) */
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

/** RVOL vetosu — DEĞİŞMEDİ: ikili, iki yönü de engelleyebilen blok */
export interface VolumeVetoRead {
  rvol: number | null;
  sampleDays: number;
  active: boolean;
  note: string;
}

/** V7.0: "15m tetik ateşlendi mi" durumu (eski adı korundu) */
export interface RegimeState {
  side: RegimeSide;
  since: number | null;
  note: string;
}

/** V7.0: 15m tetiğin dört şartlık kontrol listesi (eski adı korundu, eskiden 1m) */
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
  /** 5m zamanlama katmanı okuması — bağımsız sinyal/stop ÜRETMEZ */
  refinement5m: FiveMinuteRefinement;
  /** Güncel/aday 15m yapı stopu (Stop_SPY) */
  stopSpy: number | null;
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
// DEĞİŞMEDİ — heuristics.ts (kapsam dışı) `volumeVeto.rvol` gerçek sayısını
// okumaya devam ediyor.

export interface RvolBaseline {
  /** bucket anahtarı (ET gün-içi dakika, RVOL_BUCKET_MIN'e hizalı) → ortalama hacim */
  bucketAvg: Map<number, number>;
  /** bucket anahtarı → o bucket'a katkı veren farklı gün sayısı */
  bucketDays: Map<number, number>;
}

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

/** Hacim vetosu — RVOL < 0.8 iki yönü de engeller (DEĞİŞMEDİ). */
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

// ── V8.0 — 15m YÖN + TEYİT (zorunlu kapı, 30m KULLANILMIYOR) ────────

/**
 * "Katman 0" artık 15m'in kendi VWAP (birincil) + EMA21 (ikincil) konumu.
 * 30m açılış rejimi hiç hesaba katılmıyor. `idx` -1 ise (henüz 15m barı
 * yoksa) nötr döner.
 */
function trend15mLayerAt(m15: Bar[], m15Ema21: Series, m15Vwap: Series, idx: number): M15VetoRead {
  if (idx < 0 || idx >= m15.length) {
    return { direction: "NEUTRAL", close: null, ema21: null, note: "15m verisi yetersiz" };
  }
  const bar = m15[idx];
  const t = trend15mDirection(bar.close, m15Vwap[idx], m15Ema21[idx]);
  return {
    direction: t.direction === "NÖTR" ? "NEUTRAL" : t.direction,
    close: bar.close,
    ema21: m15Ema21[idx],
    note: t.note,
  };
}

// ── KATMAN 1 — 5m BAĞLAM (DEĞİŞMEDİ: gerçek EMA21/RSI14/MACD) ───────

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
      : "5m bağlam şartı sağlanmıyor (artık ana karar değil, sadece bilgi/zamanlama girdisi)",
  };
}

// ── V8.0 — 5m ANA KARAR skorunu Layer3Read (kontrol listesi) şekline çevir ──

function setup5mReadOf(scored: Setup5mScore | null, side: Side): Layer3Read {
  if (!scored) {
    return { checks: [], structureOk: false, confirmationOk: false, fired: false, note: "5m verisi yetersiz" };
  }
  const checks: GateCheck[] = scored.parts.map((p) => ({ label: p.label, ok: p.value > 0, detail: p.value > 0 ? `+${p.value}` : "0" }));
  return {
    checks,
    structureOk: scored.score >= SETUP_FIRE_THRESHOLD,
    confirmationOk: scored.fired,
    fired: scored.fired,
    note: scored.fired
      ? `5m ana karar ${side} ateşlendi (skor ${scored.score})`
      : `5m ana karar skoru ${scored.score}/100 — eşik ${SETUP_FIRE_THRESHOLD}`,
  };
}

// ── V7.0 — 15m yapı stopu (Stop_SPY), her kapanan 15m barda yeniden ──
// hesaplanan trailing stop serisi. `bucketAggregate(m5,15)` kullanılır ki
// route.ts'e (kapsam dışı) yeni bir alan eklemeden, elindeki m5 mumlarından
// türetilebilsin.

interface M15StopPoint {
  time: number;
  stopSpy: number | null;
  swingLevel: number | null;
  atr15m: number | null;
}

function buildM15StopSeries(m5: Bar[], side: Side): M15StopPoint[] {
  const m15 = bucketAggregate(m5, 15);
  const atr15 = atr15mSeries(m15);
  const out: M15StopPoint[] = [];
  for (let i = 0; i < m15.length; i++) {
    const chop = chopBandOf(m15.slice(0, i), 3);
    const swingLevel = side === "LONG" ? chop.hi : chop.lo;
    const a = atr15[i];
    const stopSpy = swingLevel != null && a != null ? stopSpyOf(swingLevel, a, side) : null;
    out.push({ time: m15[i].time, stopSpy, swingLevel, atr15m: a });
  }
  return out;
}

function stopAt(series: M15StopPoint[], cursor: number): M15StopPoint | null {
  return cursor >= 0 && cursor < series.length ? series[cursor] : null;
}

// ── Giriş/çıkış çelişkisi koruması (DEĞİŞMEDİ) ──────────────────────

function exitAlreadyActive(
  m5Ema: (number | null)[], idx: number, side: Side, triggerClose: number
): { blocked: boolean; detail: string } {
  if (idx < 1) return { blocked: false, detail: "5m verisi yetersiz" };
  const isLong = side === "LONG";
  const e5 = m5Ema[idx];
  if (e5 != null && (isLong ? triggerClose < e5 : triggerClose > e5)) {
    return {
      blocked: true,
      detail: `fiyat ${triggerClose.toFixed(2)} zaten 5m EMA21'in ${isLong ? "altında" : "üstünde"} (${e5.toFixed(2)}) — acil çıkış koşulu aktif`,
    };
  }
  return { blocked: false, detail: "acil çıkış koşulu girişte aktif değil" };
}

// ── Kapı Durumu (manuel işlem için birleşik veto listesi) ───────────

function gateChecksFor(
  veto: M15VetoRead, volVeto: VolumeVetoRead, l3ForSide: Layer3Read, side: Side,
  exitClash: { blocked: boolean; detail: string }
): GateCheck[] {
  return [
    { label: "15m yön + teyit aynı yönde (zorunlu kapı)", ok: veto.direction === side, detail: veto.direction === "NEUTRAL" ? "nötr" : veto.direction },
    { label: `Hacim vetosu yok (RVOL ≥ ${RVOL_VETO_MIN})`, ok: !volVeto.active, detail: volVeto.rvol == null ? "veri yok" : `RVOL ${volVeto.rvol.toFixed(2)}×` },
    ...l3ForSide.checks,
    { label: "Acil çıkış (5m EMA21) girişte aktif değil", ok: !exitClash.blocked, detail: exitClash.detail },
  ];
}

// ── Giriş adaylarının üretimi (5m ANA KARAR skoru + 15m yön teyidi kapısı) ─

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

/** Mum formasyonu + hacim anomalisi için geriye dönük bakılan bar sayısı */
const PATTERN_LOOKBACK = 10;
const VOLUME_LOOKBACK = 10;

export function generateCandidates(input: GenerateInput): GenerateOutput {
  const { session, nowSec } = input;
  const m1 = closedBars(input.m1, 1, nowSec);
  const m5 = closedBars(input.m5, 5, nowSec);
  const m15 = closedBars(input.m15, 15, nowSec);

  // ── 15m YÖN + TEYİT (zorunlu kapı) — VWAP birincil, EMA21 ikincil ────
  const m15Ema21 = ema21Of15m(m15);
  const m15Vwap = sessionVwap(m15); // gün başına otomatik sıfırlanır (core.ts)
  const vetoTimeline: M15VetoRead[] = m15.map((_, j) => trend15mLayerAt(m15, m15Ema21, m15Vwap, j));

  /** Verilen zamana kadar en son TAM KAPANMIŞ 15m barın yön teyidi (non-repainting). */
  function confirming15mAt(t: number): M15VetoRead {
    let idx = -1;
    for (let i = 0; i < m15.length; i++) {
      if (m15[i].time + 900 <= t) idx = i;
      else break;
    }
    return idx >= 0 ? vetoTimeline[idx] : { direction: "NEUTRAL", close: null, ema21: null, note: "15m verisi henüz yok" };
  }

  // ── 5m ANA KARAR girdileri — VWAP + mum formasyonu + hacim + RSI ─────
  const m5Closes = closes(m5);
  const m5Ema = ema(m5Closes, M5_EMA_PERIOD);
  const m5Rsi = rsi(m5Closes, M5_RSI_PERIOD);
  const m5MacdHist = macd(m5Closes, M5_MACD_FAST, M5_MACD_SLOW, M5_MACD_SIGNAL).hist;
  const m5Vwap = sessionVwap(m5);

  // ── RVOL (çok-günlü, DEĞİŞMEDİ) — hâlâ ikili "piyasa ölü" vetosu ─────
  const rvolBaseline = input.m5History?.length ? buildRvolBaseline(input.m5History, session.date) : EMPTY_RVOL_BASELINE;
  const m5Rvol: (number | null)[] = new Array(m5.length);
  const m5RvolDays: number[] = new Array(m5.length);
  for (let j = 0; j < m5.length; j++) {
    const { rvol, sampleDays } = rvolOf(rvolBaseline, m5[j]);
    m5Rvol[j] = rvol;
    m5RvolDays[j] = sampleDays;
  }
  const volVetoTimeline: VolumeVetoRead[] = m5.map((_, j) => volumeVetoOf(m5Rvol[j], m5RvolDays[j]));

  const stopSeriesLong = buildM15StopSeries(m5, "LONG");
  const stopSeriesShort = buildM15StopSeries(m5, "SHORT");
  const m15StopTimeIndex = new Map<number, number>(bucketAggregate(m5, 15).map((b, i) => [b.time, i]));

  /** 15m yapı stopu — atTime'dan önce TAM KAPANMIŞ son 15m bucket'tan (non-repainting). */
  function stopFor(side: Side, atTime: number): number | null {
    const stopSeries = side === "LONG" ? stopSeriesLong : stopSeriesShort;
    let stopIdx = -1;
    for (const [t15, idx15] of m15StopTimeIndex) {
      if (t15 + 900 <= atTime && idx15 > stopIdx) stopIdx = idx15;
    }
    return stopAt(stopSeries, stopIdx)?.stopSpy ?? null;
  }

  /** Verilen 5m bar index'inde bir yön için 5m ana karar skoru. */
  function scoreAt(idx: number, side: Side): Setup5mScore | null {
    if (idx < PATTERN_LOOKBACK || idx >= m5.length) return null;
    const bar = m5[idx];
    const vwapDir = vwapDirectionOf(bar.close, m5Vwap[idx]);
    const patterns = detectCandlePatterns(m5, idx, PATTERN_LOOKBACK);
    const pattern = strongestPatternFor(patterns, side);
    const volRatio = volumeRatio5m(m5, idx, VOLUME_LOOKBACK);
    const rsiDir = rsiDirectionOf(m5Rsi[idx], m5Rsi[idx - 1] ?? null);
    const e = m5Ema[idx];
    const ema21Agrees = e != null && (side === "LONG" ? bar.close > e : bar.close < e);
    return setup5mScore({ side, vwapDir, rsiDir, ema21Agrees, volumeRatio: volRatio, pattern });
  }

  // ── Giriş adayları: her 5m bar için, 15m teyidiyle AYNI yönde skor ────
  //    eşiği geçince aday üretilir (30m yok, AND-kapısı yok — puanlama).
  const candidates: EntryCandidate[] = [];

  for (let i = PATTERN_LOOKBACK; i < m5.length; i++) {
    const bar = m5[i];
    const p = nyParts(bar.time);
    const inEntryWindow = p.ymd === session.date && p.minutes >= ENTRY_OPEN_MIN && p.minutes < ENTRY_CUTOFF_MIN;
    if (!inEntryWindow) continue;

    const vwapDir = vwapDirectionOf(bar.close, m5Vwap[i]);
    if (vwapDir === "NÖTR") continue;
    const side: Side = vwapDir;

    const confirm15 = confirming15mAt(bar.time);
    if (confirm15.direction !== side) continue; // 15m onayı olmadan işlem açılmaz (zorunlu kapı)

    const volVeto = volVetoTimeline[i];
    if (volVeto.active) continue; // piyasa katılımı çok düşük — RVOL vetosu

    if (exitAlreadyActive(m5Ema, i, side, bar.close).blocked) continue;

    const scored = scoreAt(i, side);
    if (!scored || !scored.fired) continue;

    const pattern = strongestPatternFor(detectCandlePatterns(m5, i, PATTERN_LOOKBACK), side);
    const volRatio = volumeRatio5m(m5, i, VOLUME_LOOKBACK);
    const rsiDir = rsiDirectionOf(m5Rsi[i], m5Rsi[i - 1] ?? null);
    const contractType: ContractType = scored.score >= 85 ? "S" : scored.score >= 70 ? "A" : "B";

    candidates.push({
      time: bar.time,
      side,
      spot: bar.close,
      contractType,
      confidence: scored.score,
      confidenceParts: scored.parts,
      stopSpy: stopFor(side, bar.time),
      reasoning:
        `5m ana karar (skor ${scored.score}/100): VWAP ${side === "LONG" ? "üstünde" : "altında"}` +
        (pattern ? ` + ${pattern.label} (${pattern.detail})` : "") +
        (volRatio != null ? ` + hacim ${volRatio.toFixed(2)}×` : "") +
        (rsiDir === side ? " + RSI(14) aynı yönde" : "") +
        ` · 15m teyit: ${confirm15.note}`,
    });
  }

  // ── Canlı okuma (son kapalı mumlar üzerinden, panel için) ────────────
  const lastM5Idx = m5.length - 1;
  const lastM15Idx = m15.length - 1;
  const lastVeto = lastM15Idx >= 0 ? vetoTimeline[lastM15Idx] : { direction: "NEUTRAL" as VetoDirection, close: null, ema21: null, note: "15m verisi yetersiz" };
  const lastVolVeto: VolumeVetoRead = lastM5Idx >= 0 ? volVetoTimeline[lastM5Idx] : volumeVetoOf(null, 0);
  const lastL1 = layer1At(m5, m5Ema, m5Rsi, m5MacdHist, lastM5Idx);

  const lastClose = lastM5Idx >= 0 ? m5[lastM5Idx].close : null;
  const clashLong = lastClose == null
    ? { blocked: false, detail: "5m verisi yok" }
    : exitAlreadyActive(m5Ema, lastM5Idx, "LONG", lastClose);
  const clashShort = lastClose == null
    ? { blocked: false, detail: "5m verisi yok" }
    : exitAlreadyActive(m5Ema, lastM5Idx, "SHORT", lastClose);

  // Sürekli okuma: son 5m barda HER İKİ yön için de skor — sadece ateşlenince
  // değil, her zaman bir "şu an nereye yakın" görünümü verir.
  const lastLongScore = scoreAt(lastM5Idx, "LONG");
  const lastShortScore = scoreAt(lastM5Idx, "SHORT");
  const leaderSide: Side | null =
    lastLongScore && lastShortScore
      ? (lastLongScore.score >= lastShortScore.score ? "LONG" : "SHORT")
      : lastLongScore ? "LONG" : lastShortScore ? "SHORT" : null;
  const leaderScore = leaderSide === "LONG" ? lastLongScore : leaderSide === "SHORT" ? lastShortScore : null;

  const lastRegime: RegimeState = {
    side: leaderScore?.fired && leaderSide ? leaderSide : "NONE",
    since: leaderScore?.fired && lastM5Idx >= 0 ? m5[lastM5Idx].time : null,
    note: leaderScore ? `5m ana karar skoru ${leaderSide}: ${leaderScore.score}/100` : "5m verisi yetersiz",
  };
  const lastLayer3 = setup5mReadOf(leaderScore, leaderSide ?? "LONG");

  const lastCandidate =
    candidates.length && lastM5Idx >= 0 && candidates[candidates.length - 1].time === m5[lastM5Idx].time
      ? candidates[candidates.length - 1]
      : null;

  let state: EngineState = "WATCHING";
  let action: EngineRead["action"] = "BEKLE";
  let contractType: ContractType | null = null;
  let confidence = leaderScore?.score ?? 0;
  let confidenceParts: ConfidencePart[] = leaderScore?.parts ?? [{ label: "5m verisi bekleniyor", value: 0 }];
  let reasoning = "5m ana karar (VWAP + mum formasyonu + hacim + RSI) taranıyor.";
  let stateLabel = "İZLEMEDE";
  let nextStep = lastVolVeto.active
    ? `Hacim vetosu aktif: ${lastVolVeto.note}. Tarama duraklatıldı.`
    : "5m ana karar skoru izleniyor, 15m yön teyidi bekleniyor.";
  let liveStopSpy: number | null = null;

  const nowMin = nyParts(nowSec).minutes;
  const entryWindowOpen = nowMin >= ENTRY_OPEN_MIN && nowMin < ENTRY_CUTOFF_MIN;

  if (input.hasOpenPosition) {
    state = "IN_POSITION";
    stateLabel = "POZİSYONDA";
    nextStep = "Açık pozisyon taşınıyor — çıkış öncelik sırasına göre izleniyor (Açık Pozisyon kutusuna bak).";
    reasoning = "Pozisyon açık; çıkış önceliği: 15:45 EOD > 5m EMA21 kesişimi > 5m RSI dönüşü > 15m yapı stopu > trailing.";
  } else if (!entryWindowOpen) {
    state = "WATCHING";
    stateLabel = "GİRİŞ PENCERESİ KAPALI";
    nextStep =
      nowMin < ENTRY_OPEN_MIN
        ? "Giriş penceresi 09:45 ET'de açılıyor — açılışın ilk çeyreğinde giriş üretilmiyor."
        : "Giriş penceresi 15:00 ET'de kapandı — yeni pozisyon açılmıyor (15:45 zorunlu 0DTE kapaması ayrıca geçerli).";
    reasoning = `Giriş penceresi dışında (09:45–15:00 ET). 5m/15m okumaları bilgi amaçlı gösterilmeye devam ediyor.`;
  } else if (lastCandidate) {
    state = "TRIGGERED";
    action = lastCandidate.side;
    contractType = lastCandidate.contractType;
    confidence = lastCandidate.confidence;
    confidenceParts = lastCandidate.confidenceParts;
    reasoning = lastCandidate.reasoning;
    stateLabel = lastCandidate.side === "LONG" ? "LONG GİRİŞ SİNYALİ" : "SHORT GİRİŞ SİNYALİ";
    nextStep = "5m ana karar skoru eşiği geçti, 15m yön teyidi de var — pozisyon açılıyor.";
    liveStopSpy = lastCandidate.stopSpy;
  } else if (leaderSide && leaderScore && leaderScore.score > 0 && lastM5Idx >= 0) {
    const atTime = m5[lastM5Idx].time;
    const confirm15 = confirming15mAt(atTime);
    const gated = confirm15.direction === leaderSide;
    state = "ARMED";
    confidence = leaderScore.score;
    confidenceParts = leaderScore.parts;
    stateLabel = leaderScore.score >= SETUP_FIRE_THRESHOLD - 15 ? "HAZIRLANIYOR" : "İZLEMEDE";
    liveStopSpy = stopFor(leaderSide, atTime);
    reasoning = `5m ana karar ${leaderSide} yönünde şekilleniyor (skor ${leaderScore.score}/100)${gated ? ", 15m teyidi de aynı yönde" : ", 15m teyidi henüz eşleşmiyor"}.`;
    nextStep = !gated
      ? `5m skor ${leaderScore.score}/100 ama 15m yön teyidi ${confirm15.direction === "NEUTRAL" ? "nötr" : confirm15.direction} — eşleşmiyor, giriş yok.`
      : leaderScore.score >= SETUP_FIRE_THRESHOLD
      ? "Eşik geçildi — giriş üretiliyor."
      : `Eşiğe (${SETUP_FIRE_THRESHOLD}/100) ${SETUP_FIRE_THRESHOLD - leaderScore.score} puan kaldı.`;
  }

  const gateStatus: GateStatus = {
    long: gateChecksFor(lastVeto, lastVolVeto, setup5mReadOf(lastLongScore, "LONG"), "LONG", clashLong),
    short: gateChecksFor(lastVeto, lastVolVeto, setup5mReadOf(lastShortScore, "SHORT"), "SHORT", clashShort),
  };

  return {
    candidates,
    read: {
      veto: lastVeto,
      volumeVeto: lastVolVeto,
      layer1: lastL1,
      regime: lastRegime,
      layer3: lastLayer3,
      action,
      contractType,
      state,
      stateLabel,
      nextStep,
      confidence,
      confidenceParts,
      reasoning,
      gateStatus,
      refinement5m: { readyToEnter: true, note: "5m ana karar katmanı — ayrı zamanlama katmanı yok (V8.0)" },
      stopSpy: liveStopSpy,
    },
    lastClosed: {
      m1: m1.length ? m1[m1.length - 1].time : null,
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

  // 15m yapı stopu — Stop_SPY, her kapanan 15m barda yeniden hesaplanır
  const stopSeries = buildM15StopSeries(m5, side);
  const m15StopTimeIndex = new Map<number, number>(bucketAggregate(m5, 15).map((b, i) => [b.time, i]));
  let stopCursor = -1;

  let m5Cursor = -1;
  let barsHeld = 0;
  let bestSpot: number | null = null;
  let emaFavor: boolean | null = null;
  let emaGapPct: number | null = null;
  let rsiSupportive: boolean | null = null;
  let rsi5: number | null = null;
  let lastPct: number | null = null;
  let trailFloorPct: number | null = null;
  let currentStopSpy: number | null = null;
  /** 5m RSI ters döndü ama 15m yapı stopu/1m teyidi henüz gelmedi — çıkış hazırda bekliyor */
  let rsiExitArmed = false;

  const progressOf = (note: string): ExitProgress => ({
    emaFavor, emaGapPct, rsiSupportive, rsi5, barsHeld, bestSpot, premiumPct: lastPct, trailFloorPct, stopSpy: currentStopSpy, note,
  });

  for (let i = 1; i < m1.length; i++) {
    const bar = m1[i];
    if (bar.time <= entryTime) continue;

    while (m5Cursor + 1 < m5.length && m5[m5Cursor + 1].time + 300 <= bar.time + 60) m5Cursor++;
    barsHeld++;

    // 15m yapı stopunu, tetik mumu kapandıkça güncelle (trailing, non-repainting)
    for (const [t15, idx15] of m15StopTimeIndex) {
      if (t15 + 900 <= bar.time && idx15 > stopCursor) stopCursor = idx15;
    }
    const stopPoint = stopAt(stopSeries, stopCursor);
    if (stopPoint?.stopSpy != null) currentStopSpy = stopPoint.stopSpy;

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

    // 2 (NORMAL) — 5m RSI yön değiştirdi (karar) + 15m yapı stopu/1m ters yönlü mum (zamanlama)
    //
    // Girişin aynası: 5m RSI dönüşü çıkışı HAZIRLAR; 15m yapı stopu kırılana
    // (aşağıdaki 3 numaralı kural zaten bunu anlık yakalar) VEYA 1m'de ters
    // yönlü bir mum oluşana kadar pozisyon taşınır. RSI aynı yöne dönerse
    // hazırlık kendiliğinden iptal olur (`flipped` her barda yeniden hesaplanır).
    rsiExitArmed = false;
    if (m5Cursor >= 1) {
      const r5 = m5Rsi[m5Cursor], r5p = m5Rsi[m5Cursor - 1];
      rsi5 = r5;
      if (r5 != null && r5p != null) {
        const flipped = side === "LONG" ? r5 < r5p : r5 > r5p;
        rsiSupportive = !flipped;
        if (flipped) {
          rsiExitArmed = true;
          const against1m = side === "LONG" ? bar.close < bar.open : bar.close > bar.open;
          if (against1m) {
            return {
              signal: {
                time: bar.time, spot: bar.close, reason: "RSI_FLIP_EXIT",
                note: `5m RSI yön değiştirdi (${r5.toFixed(0)}, önceki ${r5p.toFixed(0)}) ve 1m mumu ters yönde kapandı — normal çıkış.`,
              },
              progress: progressOf("5m RSI dönüşü + 1m ters mumla çıkış."),
            };
          }
        }
      }
    }

    // 3 (STOP) — 15m yapı stopu (Stop_SPY) kırıldı mı (anlık: mum içi en kötü seviye);
    //            henüz swing/ATR verisi yoksa sabit prim yüzdesi (EXIT_STOP_PCT) güvenlik ağı.
    if (currentStopSpy != null) {
      const worstSpy = side === "LONG" ? bar.low : bar.high;
      const breached = side === "LONG" ? worstSpy <= currentStopSpy : worstSpy >= currentStopSpy;
      if (breached) {
        return {
          signal: {
            time: bar.time, spot: bar.close, reason: "STOP_EXIT",
            note: `15m yapı stopu (Stop_SPY ${currentStopSpy.toFixed(2)}) kırıldı (mum içi en kötü ${worstSpy.toFixed(2)}).`,
          },
          progress: progressOf("15m yapı stopuyla kapandı."),
        };
      }
    } else {
      const worstPct = worstPctAt(bar.time);
      if (worstPct != null && worstPct <= EXIT_STOP_PCT) {
        return {
          signal: {
            time: bar.time, spot: bar.close, reason: "STOP_EXIT",
            note: `15m yapı stopu henüz hesaplanamadı (swing/ATR verisi yok) — güvenlik ağı: prim en kötü %${(worstPct * 100).toFixed(0)} (eşik %${EXIT_STOP_PCT * 100}).`,
          },
          progress: progressOf("Sabit stop güvenlik ağıyla kapandı."),
        };
      }
    }

    // 4 (TRAILING) — kâr +%40/+%50 sonrası taban yükselir (yalnızca kapalı 5m bar güncellemesi)
    if (m5Cursor >= 1 && pct != null) {
      if (pct >= EXIT_TRAIL_ARM2_PCT) trailFloorPct = Math.max(trailFloorPct ?? -Infinity, EXIT_TRAIL_FLOOR2);
      else if (pct >= EXIT_TRAIL_ARM1_PCT) trailFloorPct = Math.max(trailFloorPct ?? -Infinity, EXIT_TRAIL_FLOOR1);
    }
    {
      const worstPctForTrail = worstPctAt(bar.time);
      if (trailFloorPct != null && worstPctForTrail != null && worstPctForTrail <= trailFloorPct) {
        return {
          signal: {
            time: bar.time, spot: bar.close, reason: "TRAIL_EXIT",
            note: `Trailing kilit: prim daha önce +%${(trailFloorPct >= EXIT_TRAIL_FLOOR2 ? EXIT_TRAIL_ARM2_PCT : EXIT_TRAIL_ARM1_PCT) * 100} eşiğini geçmişti, taban %${(trailFloorPct * 100).toFixed(0)} seviyesine döndü.`,
          },
          progress: progressOf(`Trailing kilit tabanıyla (%${(trailFloorPct * 100).toFixed(0)}) kapandı.`),
        };
      }
    }
  }

  return {
    signal: null,
    progress: progressOf(
      barsHeld === 0
        ? "Pozisyon henüz taşınmaya başlamadı."
        : `${barsHeld} mum taşındı — 5m EMA21 ${emaFavor === false ? "aleyhte (acil çıkış tetiklenmek üzere)" : "lehte"}, 5m RSI ${
            rsiExitArmed ? "ters döndü: çıkış hazırda, 15m yapı stopu/1m ters mumu bekleniyor" : "destekliyor"
          }.`
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
  /**
   * Gerçek opsiyon deltası — verilirse Stop_prem (stopPremiumOf) hesaplanır.
   * Verilmezse `entryStopPremium` `null` kalır (uydurma delta kullanılmaz).
   */
  delta?: number | null;
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
    entryStopSpy: candidate.stopSpy,
    entryStopPremium: null,
  };

  const entryIdx = premiumBars.findIndex((b) => b.time >= candidate.time);
  const entryPremium = entryIdx >= 0 ? premiumBars[entryIdx].close : null;
  pos.entryPremium = entryPremium;
  pos.premiumDataMissing = entryPremium == null;

  if (entryPremium != null && candidate.stopSpy != null && input.delta != null) {
    pos.entryStopPremium = stopPremiumOf(entryPremium, candidate.spot, candidate.stopSpy, input.delta, candidate.side);
  }

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

  /**
   * "Kontrat başına tek deneme" — bir strike+yön İKİNCİ kez denenmez.
   *
   * Bu küme, KABUL EDİLEN adaylarla birlikte adım adım doldurulur. Önceden
   * `positions` listesinin TAMAMINDAN (ki çağıran taraf oraya her adayın
   * kabuğunu veriyor) önden dolduruluyordu; o hâliyle her aday kendi
   * strike'ını daha döngüye girmeden "kullanılmış" yapıp KENDİNİ
   * engelliyordu — 2026-09-03'ten beri çıkışı çözülmüş hiçbir aday
   * pozisyona dönüşemiyordu (5 seanslık ölçümde 111 adayın 111'i bloklandı,
   * kabul edilen 0). Tek doğru zaman, adayın gerçekten kabul edildiği andır.
   */
  const usedContracts = new Set<string>();

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
    usedContracts.add(`${strike}:${c.side}`);

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
  STOP_EXIT: "15m Yapı Stopu",
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
