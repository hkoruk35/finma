/**
 * SPY Engine — TAKİP SİSTEMİ (saf, izomorfik — DOM/ağ yok).
 *
 * Kullanıcı isteği (2026-10-15) + spec_acilis_modulu_v1.md:
 *   • Ana zaman dilimi 5m. Her 5m kapanışında TEK okuma: yön puanı (dir_score), trend/momentum, kademe, kurulum,
 *     sonraki 30 dk tahmini (hedef + geçersizlik). 15m yalnız yön/trend teyidi; 30m / 1h / 4h yönleri izlenir.
 *   • 09:00–09:30 Kademe 0 (seans öncesi eğilim, işlem yok) · 09:35–10:30 AÇILIŞ MODÜLÜ (spec §3–§7: K1 OR5 · K2 15m trend mumu ·
 *     K3 OR15 kırılım/başarısız kırılım · K4 geri çekilme) · 10:35–15:00 TAKİP (spec dışı, kullanıcı isteği: trend/momentum
 *     okuyucu; yön kurulmuşsa geri çekilme girişi T_PB). Açık pozisyon 15:45'e kadar yönetilir.
 *   • Her tahmin (30 dk sonrası yön + hedef) gerçekleşenle kıyaslanır; işlemler ve uyarılar kayda girer
 *     (sunucu: trackerStore.ts — aynı fonksiyon, gün gün yeniden oynatma; geriye dönük test de bu fonksiyonu çağırır).
 *
 * Kurallar:
 *   • Yalnız KAPANMIŞ mumlar; gün her çağrıda baştan oynatılır (deterministik — gün ortasında açılsa da aynı sonuç).
 *   • Saat etiketi = mumun KAPANIŞ saati ("09:35" = 09:30–09:35 mumu). Saat dilimi America/New_York.
 *   • Bütün eşikler TRACK_CFG içinde (spec §12).
 *   • Spec'te "4h/1h EMA20 yönü": fiyat EMA20'nin o tarafında VE EMA20 eğimi aynı yönde → ±1 (5m/15m kuralıyla aynı;
 *     yalnız eğime bakmak sert düşüşte 4h'yi saatlerce "yukarı" gösteriyordu).
 *   • Opsiyon C/P akışı (±0,5) yalnız canlıda ve yalnız son mumda kullanılır (geçmişi yok); geriye dönük testte "flow=off" sayılır.
 *   • Alıcı/satıcı payı mumun kapanış konumundan tahmin edilir (CLV × hacim), emir defteri değildir — canlı ve testte aynı.
 *   • RVOL = 5m hacim / son 20 seansın AYNI SAATTEKİ MEDYAN hacmi (ortalama yüksek hacimli günlerle şişiyordu: tipik RVOL 0,79 çıkıyordu).
 *
 * KALİBRASYON (2026-10-15, SPY 5m Yahoo, 45 seans 12 Ağu → 14 Eki, scripts/backtest_tracker.ts — canlıyla aynı fonksiyon):
 *   • Geleceğe bakış testi: 8 seansta 4 gün içi kesitte (1.216 adım) kesit okuması = tam gün okuması (0 fark).
 *   • Açılış modülü spec eşikleriyle (RVOL ≥ 1,5 giriş / < 1,2 veto, K1 puan ≥ 6, stop ≤ 0,6 ATR15) 45 günde yalnız 1 işlem (K3_BREAK +0,5R);
 *     RVOL şartları kapalıyken 7 K3_BREAK işlemi +4,2R (%71). Bağlayan şartlar: K1 RVOL/puan/mum, K4 geri çekilme + mum. Örnek az — eşikler spec'te bırakıldı.
 *   • Takip uzantısı (10:35–14:30): 24 işlem +1,95R (T_BRK 17 işlem +1,5R %35 · T_PB 7 işlem +0,4R) — kenar ≈ 0, durum GÖZLEM.
 *   • v1.1 (kullanıcı kararı): bütün RVOL eşikleri 0,5 → 55 işlem +7,6R (yarılar +1,2 / +6,4R): K3_BREAK 7 işlem +4,2R %71 ·
 *     T_PB_EMA 12 işlem +3,6R · T_BRK 29 işlem ≈0R · T_PB_VWAP 7 işlem ≈0R. K1/K2/K4 hâlâ işlem üretmiyor (puan/mum/geri çekilme şartları).
 *   • 14 Ekim: yön puanı 10:00'dan kapanışa kadar −5…−9 (▼); 10:00–12:10 arası 30 dk tahminlerinin hepsi doğru yön.
 */

import { atr as atrCalc, ema as emaCalc, nyClock, nyDateTimeToEpoch, nyParts, r2, type Bar } from "./core";
import type { RvolBase } from "./ladder";
import { barEnd, sessionAggregate } from "./setup15";
import { pivotFrames, pivotLevelsAt, type PivotFrames } from "./mtfPivots";

// ── Ayarlar (spec §12 + takip uzantısı) ─────────────────────────────

/** Motor sürümü — değişince sunucu günlüğündeki geriye dönük kayıtlar yeniden üretilir */
export const TRACK_VERSION = "1.1";

export const TRACK_CFG = {
  /** kapanış dakikası (ET) */
  k1Slots: [9 * 60 + 35, 9 * 60 + 40],
  k2Slot: 9 * 60 + 45,
  k3Slots: [9 * 60 + 50, 9 * 60 + 55],
  k3Confirm: 10 * 60,
  k4Window: [10 * 60 + 5, 10 * 60 + 30],
  thresholds: { k1: 6, k2: 5, k3: 5, k4: 5 },
  /** RVOL eşikleri (medyan tabanlı) — kullanıcı kararı 2026-10-15: spec 1,5 / 1,2 çok sert (45 günde 1 işlem, son günlerde hacim düşük) → 0,5 */
  rvolEntry: 0.5,
  rvolK4: 0.5,
  rvolVeto: 0.5,
  bodyMin: 60,
  closePosMin: 70,
  fakeoutBodyMin: 50,
  stopMaxAtr15: 0.6,
  or15Wide: 0.4,
  or15Squeeze: 0.15,
  vwapChopCrosses: 3,
  k2EntryMode: "PULLBACK" as "CLOSE" | "PULLBACK",
  biasThreshold: 2,
  gapFlatAtr: 0.25,
  h1R: 1,
  h2R: 2,
  timeStopBars: 6,
  maxTrades: 2,
  dailyLossR: -2,
  eventSizeMult: 0.5,
  strikeDelta: [0.4, 0.5],
  alertPrewarnSec: 60,
  /** CPI / FOMC / NFP günleri (YYYY-MM-DD) — K1 kapalı, boyut yarım */
  eventDays: [] as string[],
  /** Takip uzantısı (10:30 sonrası) — trend/momentum yönünde geri çekilme girişi */
  trend: {
    on: true,
    from: 10 * 60 + 35,
    to: 14 * 60 + 30,
    threshold: 5,
    /** yön puanı bu kadar ardışık kapanışta eşiğin üstünde kalmalı */
    holdBars: 2,
    rvolMin: 0.5,
    bodyMin: 50,
    closePosMin: 70,
    stopMaxAtr15: 1.0,
    maxTrades: 2,
    /** son 12 mumda bu kadar VWAP kesişimi = testere */
    chopCrosses: 3,
    /** Güçlü trendde fiyat EMA20'ye hiç geri çekilmeyebilir (14 Eki): son 30 dk dibi/tepesinin kapanışla kırılması = devam girişi */
    brkOn: true,
    brkLookback: 6,
  },
  /** Kartlar 15:00'e kadar; açık pozisyon 15:45'te kapanır */
  trackEnd: 15 * 60,
  forceExit: 15 * 60 + 45,
  /** Tahmin ufku (5m mum) */
  predBars: 6,
};
export type TrackCfg = typeof TRACK_CFG;

// ── Tipler ───────────────────────────────────────────────────────────

export type D = 1 | -1 | 0;
export type Side = "CALL" | "PUT";
export type TrackPhase = "PRE" | "K1" | "K2" | "K3" | "K4" | "IN_TRADE" | "MANAGE" | "DONE" | "VETO" | "TAKİP" | "KAPANIŞ";
export type SetupTag =
  | "K1_ORB5" | "K2_TREND_CLOSE" | "K2_TREND_PB" | "K3_BREAK" | "K3_FAKEOUT" | "K4_PB_VWAP" | "K4_PB_EMA" | "T_PB_VWAP" | "T_PB_EMA" | "T_BRK";
export type VetoCode = "LOW_RVOL" | "VWAP_CHOP" | "VWAP_POC_ZONE" | "STOP_TOO_WIDE" | "DAILY_LOSS" | "MAX_TRADES" | "EVENT_K1";
export type DayClass = "TREND_CANDLE" | "INDECISION" | "NORMAL";
export type ExitReason = "STOP" | "H1_BE" | "EMA_EXIT" | "H2" | "TIME" | "FORCE_1545";
export type AlertLevel = "HAZIRLAN" | "TETİK" | "İPTAL" | "YÖNET" | "ÇIKIŞ" | "KADEME";

export const TAG_TEXT: Record<SetupTag, string> = {
  K1_ORB5: "OR5 kırılımı",
  K2_TREND_CLOSE: "09:45 trend mumu · kapanışta",
  K2_TREND_PB: "09:45 trend mumu · geri çekilmede",
  K3_BREAK: "OR15 kırılımı",
  K3_FAKEOUT: "OR15 başarısız kırılım",
  K4_PB_VWAP: "VWAP geri çekilmesi",
  K4_PB_EMA: "EMA20 geri çekilmesi",
  T_PB_VWAP: "trend devamı · VWAP geri çekilmesi",
  T_PB_EMA: "trend devamı · EMA20 geri çekilmesi",
  T_BRK: "trend devamı · 30 dk dip/tepe kırılımı",
};

export const VETO_TEXT: Record<VetoCode, string> = {
  LOW_RVOL: "hacim zayıf (RVOL 5m eşiğin altında)",
  VWAP_CHOP: "VWAP etrafında testere (çok kesişim)",
  VWAP_POC_ZONE: "fiyat VWAP ile POC arasında — yön yok",
  STOP_TOO_WIDE: "stop çok geniş (> eşik × ATR15)",
  DAILY_LOSS: "günlük zarar sınırı doldu (−2R)",
  MAX_TRADES: "günlük işlem hakkı doldu",
  EVENT_K1: "veri günü — Kademe 1 kapalı",
};

export const PHASE_TEXT: Record<TrackPhase, string> = {
  PRE: "Kademe 0 · seans öncesi eğilim",
  K1: "Kademe 1 · OR5 kırılımı",
  K2: "Kademe 2 · 09:45 15m mumu",
  K3: "Kademe 3 · OR15 kırılım/fakeout",
  K4: "Kademe 4 · geri çekilme girişi",
  IN_TRADE: "Pozisyon açık",
  MANAGE: "Pozisyon yönetimi",
  DONE: "Açılış modülü bitti",
  VETO: "Veto — giriş yok",
  TAKİP: "Gün içi trend takibi",
  KAPANIŞ: "Kapanış — yeni giriş yok",
};

export interface Breakdown {
  h4: number; h1: number; vwap_side: number; vwap_slope: number; ema5: number; ema15: number;
  or_break: number; flow: number; opt_cp: number; squeeze: number;
}
export const BREAKDOWN_LABEL: Record<keyof Breakdown, string> = {
  h4: "4h EMA20", h1: "1h EMA20", vwap_side: "VWAP tarafı", vwap_slope: "VWAP eğimi", ema5: "5m EMA20", ema15: "15m EMA20",
  or_break: "açılış aralığı", flow: "alıcı/satıcı", opt_cp: "opsiyon C/P", squeeze: "sıkışma",
};

export interface CheckItem { key: string; ok: boolean; text: string; price?: boolean }

export interface TrackSetup {
  tag: SetupTag;
  side: Side;
  status: "WATCH" | "ARMED" | "OPEN" | "CLOSED";
  /** Tetik fiyatı (sonraki 5m kapanış bunun ötesinde olmalı) */
  trigger: number | null;
  triggerText: string;
  stop: number | null;
  missing: string[];
}

export interface TrackTrade {
  id: string;
  tag: SetupTag;
  reentry: boolean;
  side: Side;
  stage: TrackPhase;
  entryTime: number;
  entryClock: string;
  entry: number;
  stop: number;
  /** ilk stop (yönetimde stop girişe çekilse de R bununla ölçülür) */
  stop0: number;
  rPts: number;
  h1: number;
  h2: number;
  size: "half" | "full";
  confirm10: boolean | null;
  strike: string;
  exitTime: number | null;
  exitClock: string | null;
  exit: number | null;
  exitReason: ExitReason | null;
  resultR: number | null;
  mfeR: number;
  maeR: number;
  barsHeld: number;
  scoreEntry: number;
  rvolEntry: number | null;
  dayClass: DayClass | null;
  bias: Side | "NÖTR";
  gapType: "UP" | "DOWN" | "FLAT";
  eventDay: boolean;
  h1Hit: boolean;
  h1Clock: string | null;
  /** açıkken anlık R (yarısı alındıysa onu da içerir) */
  liveR: number | null;
}

export interface TrackAlert { t: number; clock: string; level: AlertLevel; tag: SetupTag | null; side: Side | null; text: string; key: string }

/**
 * 30 dk tahmin kuralları — ölçüm (2026-10-15, SPY 5m, 45 seans 12 Ağu → 14 Eki, ileri 6 mum kapanışı, iki yarıda da pozitif):
 *   saf trend takibi (yön puanı ≥3/5/7 yönünde) ileri 30 dk'da %44–49 — SPY'da 30 dk sonrası için trend devamı yazı-tura / hafif ters.
 *   Seçilen birleşik kural: n=1390 (adımların ~%40'ı), %54 isabet (|hareket| ≥ 0,05), 30 dk'da ort. +0,13 puan; iki yarıda da pozitif.
 */
export type FcRule = "OPEN_MOM" | "CHOP_FADE" | "TREND_DAY" | "STRUCT";
export const FC_RULES: Record<FcRule, { label: string; hit: number; n: number; avg: number; text: string }> = {
  OPEN_MOM: { label: "açılış ivmesi", hit: 54, n: 437, avg: 0.1, text: "09:35–10:30: ivme (yeni uç · 15m yapı · 30 dk itki · EMA20 tarafı) yönünde" },
  CHOP_FADE: { label: "testere günü → VWAP'a dönüş", hit: 55, n: 449, avg: 0.16, text: "10:35–14:00: gün içi ≥4 VWAP kesişimi ve fiyat VWAP'tan ≥1 ATR5 uzaksa VWAP'a dönüş" },
  TREND_DAY: { label: "trend günü → trend yönü", hit: 56, n: 192, avg: 0.09, text: "10:35–14:00: ≤1 VWAP kesişimi ve |yön puanı| ≥5 ise trend yönünde (aykırı günlerde sert ters dönüş riski)" },
  STRUCT: { label: "15m yapı", hit: 53, n: 312, avg: 0.15, text: "14:05–15:00: 15m yükselen tepe+dip → yukarı · alçalan → aşağı" },
};

export interface TrackForecast {
  dir: D;
  target: number | null;
  targetLabel: string;
  invalid: number | null;
  invalidLabel: string;
  /** Kullanılan ölçülmüş kural (yoksa tahmin yok) */
  rule: FcRule | null;
  text: string;
}

export interface TrackOutcome {
  /** 30 dk sonraki kapanış − tahmin anındaki kapanış */
  move: number;
  /** yönlü tahminde yön doğru mu (yatay tahminde null) */
  hit: boolean | null;
  targetHit: boolean;
  invalidHit: boolean;
  /** tamamlandı mı (6 mum geçti mi) */
  done: boolean;
}

export interface Momentum {
  /** son 30 dk (6 mum) kapanış değişimi / ATR5 */
  impulse: number;
  /** son 3 mumda gün içi yeni tepe (+1) / yeni dip (−1) */
  newExt: D;
  /** 15m salınım yapısı: yükselen tepe+dip (+1) · alçalan (−1) */
  struct: D;
  /** ardışık EMA20 tarafı kapanış sayısı (işaretli) */
  run: number;
  score: number;
}

export interface TrackStep {
  /** mum başlangıcı (epoch sn) */
  t: number;
  /** kapanış saati (ET) — kart etiketi */
  clock: string;
  min: number;
  pre: boolean;
  is15: boolean;
  phase: TrackPhase;
  stageLabel: string;
  price: number;
  open: number;
  high: number;
  low: number;
  vwap: number | null;
  poc: number | null;
  ema5: number | null;
  ema15: number | null;
  rvol5: number | null;
  rvol15: number | null;
  /** ATR14 (5m) · fiyatın VWAP'tan uzaklığı (ATR5 cinsinden) · gün içi VWAP kesişim sayısı */
  atr5: number | null;
  devAtr: number | null;
  crosses: number;
  body: number;
  closePos: number;
  score: number;
  breakdown: Breakdown;
  threshold: number;
  dir: D;
  strength: "ÇOK GÜÇLÜ" | "GÜÇLÜ" | "ORTA" | "ZAYIF";
  trend: string;
  mom: Momentum;
  htf: { m15: D; m30: D; h1: D; h4: D };
  headline: string;
  action: string;
  tone: "bull" | "bear" | "neutral" | "warn";
  checklist: CheckItem[];
  veto: VetoCode | null;
  setup: TrackSetup | null;
  /** bu mumda açık pozisyonun anlık hali */
  pos: { tag: SetupTag; side: Side; entry: number; stop: number; h1: number; h2: number; liveR: number; h1Hit: boolean } | null;
  fc: TrackForecast;
  out: TrackOutcome | null;
  c5: string;
  c15: string | null;
  events: string[];
}

export interface TrackK0 {
  bias: Side | "NÖTR";
  score: number;
  parts: { h4: number; h1: number; pmVsClose: number; pmBreak: number };
  pmHigh: number | null;
  pmLow: number | null;
  pmLast: number | null;
}

export interface TrackRead {
  date: string;
  prevClose: number | null;
  atrDaily: number | null;
  k0: TrackK0;
  gap: { pts: number | null; type: "UP" | "DOWN" | "FLAT" };
  eventDay: boolean;
  or5: { high: number; low: number } | null;
  or15: { high: number; low: number; mid: number; widthPct: number | null; squeeze: boolean; orbDisabled: boolean } | null;
  dayClass: DayClass | null;
  dirEstablished: D;
  confirm10: boolean | null;
  steps: TrackStep[];
  current: TrackStep | null;
  trades: TrackTrade[];
  alerts: TrackAlert[];
  realizedR: number;
  /** bugünkü yönlü tahminler: tamamlanan / doğru yön / hedefe değen */
  pred: { n: number; hit: number; tHit: number };
  nextCheck: string | null;
  /** HAZIRLAN için: sonraki kapanışta tetiklenebilecek kurulum */
  armed: { tag: SetupTag; side: Side; trigger: number; stop: number | null } | null;
}

export interface TrackInput {
  date: string;
  /** Çok günlük 5m mumlar (premarket dahil olabilir); yalnız `nowSec`'te kapanmış olanlar kullanılır */
  m5: Bar[];
  nowSec: number;
  /** Uzun saatlik geçmiş (RTH, seans hizalı) — 4h/1h EMA20 ve günlük ATR için; yoksa 5m'den türetilir */
  h1?: Bar[] | null;
  /** Bugünün 1m mumları (POC daha hassas); yoksa 5m */
  fine?: Bar[] | null;
  prevClose?: number | null;
  rvol?: RvolBase | null;
  /** Canlı opsiyon C/P akışı tarafı (yalnız son mum) */
  optSide?: D | null;
  eventDay?: boolean;
  cfg?: TrackCfg;
}

// ── Yardımcılar ──────────────────────────────────────────────────────

const OPEN_MIN = 9 * 60 + 30;
const f2 = (n: number) => n.toFixed(2);
const sgnR = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(2)}`;
const hm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
const sideOfD = (d: D): Side | null => (d > 0 ? "CALL" : d < 0 ? "PUT" : null);
const dOfSide = (s: Side): 1 | -1 => (s === "CALL" ? 1 : -1);
const arrow = (d: number) => (d > 0 ? "▲" : d < 0 ? "▼" : "◆");
const isRth = (t: number) => { const m = nyParts(t).minutes; return m >= OPEN_MIN && m < 16 * 60; };

function mapOf(bars: Bar[], vals: (number | null)[]): Map<number, number> {
  const m = new Map<number, number>();
  bars.forEach((b, i) => { if (vals[i] != null) m.set(b.time, vals[i] as number); });
  return m;
}

/** `bars` (seans hizalı, `minutes` dakikalık) içinde `t` anında kapanmış son mumun indeksi */
function closedIdx(bars: Bar[], minutes: number, t: number): number {
  let lo = 0, hi = bars.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (barEnd(bars[mid].time, minutes) <= t) { ans = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return ans;
}

interface Tf { bars: Bar[]; ema: (number | null)[]; minutes: number }
function tfOf(bars: Bar[], minutes: number): Tf {
  return { bars, ema: emaCalc(bars.map((b) => b.close), 20), minutes };
}
/** fiyat EMA20'nin o tarafında ve EMA20 eğimi aynı yönde → ±1 */
function emaDir(tf: Tf, t: number, price: number): { d: D; e: number | null } {
  const i = closedIdx(tf.bars, tf.minutes, t);
  if (i < 1) return { d: 0, e: null };
  const e = tf.ema[i], ep = tf.ema[i - 1];
  if (e == null || ep == null) return { d: 0, e: e ?? null };
  const d: D = price > e && e >= ep ? 1 : price < e && e <= ep ? -1 : 0;
  return { d, e };
}

function candleOf(b: Bar) {
  const rng = b.high - b.low;
  const body = rng > 0 ? (Math.abs(b.close - b.open) / rng) * 100 : 0;
  const closePos = rng > 0 ? ((b.close - b.low) / rng) * 100 : 50;
  const upper = b.high - Math.max(b.open, b.close);
  const lower = Math.min(b.open, b.close) - b.low;
  return { rng, body, closePos, upper, lower };
}

function candleText(b: Bar, vwap: number | null, rv: number | null, tf: string): string {
  const c = candleOf(b);
  const kind = c.body < 15 ? "kararsız (doji)" : b.close > b.open ? (c.body >= 60 ? "güçlü alış mumu" : "alış mumu") : (c.body >= 60 ? "güçlü satış mumu" : "satış mumu");
  const pos = c.closePos >= 70 ? "kapanış tepede" : c.closePos <= 30 ? "kapanış dipte" : "kapanış ortada";
  const wick = c.upper > c.rng * 0.45 ? " · uzun üst fitil (yukarıda satıcı)" : c.lower > c.rng * 0.45 ? " · uzun alt fitil (aşağıda alıcı)" : "";
  const vw = vwap == null ? "" : b.close > vwap ? " · VWAP üstü" : " · VWAP altı";
  return `${tf}: ${kind} · gövde %${Math.round(c.body)} · ${pos}${wick}${rv != null ? ` · RVOL ${rv.toFixed(2)}` : ""}${vw}`;
}

/** Hacim profili POC'u (0,05 kovası, mum hacmi aralığa eşit dağıtılır) */
class Profile {
  private bins = new Map<number, number>();
  add(b: Bar) {
    const v = b.volume || 0;
    if (v <= 0) return;
    const lo = Math.round(b.low / 0.05), hi = Math.round(b.high / 0.05);
    const n = Math.max(1, hi - lo + 1);
    for (let k = lo; k <= hi; k++) this.bins.set(k, (this.bins.get(k) ?? 0) + v / n);
  }
  poc(): number | null {
    let best = -1, bk = 0;
    for (const [k, v] of this.bins) if (v > best) { best = v; bk = k; }
    return best < 0 ? null : r2(bk * 0.05);
  }
}

function buyerPct(bars: Bar[]): number | null {
  let buy = 0, vol = 0;
  for (const b of bars) {
    const rng = b.high - b.low;
    const v = b.volume || 0;
    if (v <= 0) continue;
    buy += rng > 0 ? v * ((b.close - b.low) / rng) : v * 0.5;
    vol += v;
  }
  return vol > 0 ? (buy / vol) * 100 : null;
}

/** 5m dilim ortalaması (RVOL) */
function slotAvg(base: RvolBase | null | undefined, min: number): number | null {
  if (!base) return null;
  const k = Math.round((min - OPEN_MIN) / 5);
  // medyan taban (tipik gün = 1,0); eski kayıtta yoksa ortalama
  const v = base.med?.[k] || base.slot[k];
  return v && v > 0 ? v : null;
}

/** 0DTE'de 0,40–0,50 delta ≈ ATM'ye en yakın strike (opsiyon zinciri motora girmez — yalnız öneri) */
function strikeHint(side: Side, price: number): string {
  return `0DTE ${side === "CALL" ? "C" : "P"} ${Math.round(price)} (≈0,45Δ)`;
}

// ── Ana oynatma ──────────────────────────────────────────────────────

export function trackerRead(inp: TrackInput): TrackRead {
  const C = inp.cfg ?? TRACK_CFG;
  const { date, nowSec } = inp;

  // — çok günlük, kapanmış RTH 5m —
  const all5 = inp.m5.filter((b) => b.time + 300 <= nowSec);
  const rth5 = all5.filter((b) => isRth(b.time));
  const ema5Map = mapOf(rth5, emaCalc(rth5.map((b) => b.close), 20));
  const atr5Map = mapOf(rth5, atrCalc(rth5, 14));
  const tf15 = tfOf(sessionAggregate(rth5, 15), 15);
  const atr15Arr = atrCalc(tf15.bars, 14);
  const tf30 = tfOf(sessionAggregate(rth5, 30), 30);
  const frames: PivotFrames = pivotFrames(rth5, inp.h1 ?? null);
  const tf60 = tfOf(frames.h1, 60);
  const tf240 = tfOf(frames.h4, 240);

  // — günlük ATR (bugünden önceki günler) —
  const daily = new Map<string, { h: number; l: number; c: number }>();
  for (const b of frames.h1) {
    const ymd = nyParts(b.time).ymd;
    if (ymd >= date) continue;
    const d = daily.get(ymd);
    if (!d) daily.set(ymd, { h: b.high, l: b.low, c: b.close });
    else { d.h = Math.max(d.h, b.high); d.l = Math.min(d.l, b.low); d.c = b.close; }
  }
  const days = [...daily.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([, v]) => v);
  let atrDaily: number | null = null;
  if (days.length >= 5) {
    const tr = days.slice(1).map((d, i) => Math.max(d.h - d.l, Math.abs(d.h - days[i].c), Math.abs(d.l - days[i].c)));
    const last = tr.slice(-14);
    atrDaily = last.reduce((a, x) => a + x, 0) / last.length;
  }

  // — önceki kapanış / önceki gün tepe-dip —
  const prevRth = rth5.filter((b) => nyParts(b.time).ymd < date);
  const pd = prevRth.length ? nyParts(prevRth[prevRth.length - 1].time).ymd : null;
  const pdBars = pd ? prevRth.filter((b) => nyParts(b.time).ymd === pd) : [];
  const prevClose = inp.prevClose ?? (pdBars.length ? pdBars[pdBars.length - 1].close : null);
  const pdh = pdBars.length ? Math.max(...pdBars.map((b) => b.high)) : null;
  const pdl = pdBars.length ? Math.min(...pdBars.map((b) => b.low)) : null;

  // — bugün: premarket + RTH —
  const todayAll = all5.filter((b) => nyParts(b.time).ymd === date);
  const pmBars = todayAll.filter((b) => { const m = nyParts(b.time).minutes; return m >= 4 * 60 && m < OPEN_MIN; });
  const today = todayAll.filter((b) => isRth(b.time));
  const eventDay = inp.eventDay ?? C.eventDays.includes(date);

  const steps: TrackStep[] = [];
  const alerts: TrackAlert[] = [];
  const pushAlert = (t: number, level: AlertLevel, tag: SetupTag | null, side: Side | null, text: string) => {
    const key = `${date}|${level}|${tag ?? ""}|${side ?? ""}|${t}`;
    if (!alerts.some((a) => a.key === key)) alerts.push({ t, clock: nyClock(t + 300), level, tag, side, text, key });
  };

  // ── Kademe 0: seans öncesi eğilim ─────────────────────────────────
  const pmHigh = pmBars.length ? Math.max(...pmBars.map((b) => b.high)) : null;
  const pmLow = pmBars.length ? Math.min(...pmBars.map((b) => b.low)) : null;
  const k0At = (price: number, t: number, pmB: Bar[]): TrackK0 => {
    const h4 = emaDir(tf240, t, price).d;
    const h1 = emaDir(tf60, t, price).d;
    const pmVsClose = prevClose == null ? 0 : price > prevClose + 0.05 ? 1 : price < prevClose - 0.05 ? -1 : 0;
    const early = pmB.filter((b) => nyParts(b.time).minutes < 9 * 60);
    const eh = early.length ? Math.max(...early.map((b) => b.high)) : null;
    const el = early.length ? Math.min(...early.map((b) => b.low)) : null;
    const pmBreak = eh != null && el != null && nyParts(t).minutes >= 9 * 60 ? (price > eh ? 1 : price < el ? -1 : 0) : 0;
    const score = h4 + h1 + pmVsClose + pmBreak;
    return {
      bias: score >= C.biasThreshold ? "CALL" : score <= -C.biasThreshold ? "PUT" : "NÖTR",
      score, parts: { h4, h1, pmVsClose, pmBreak },
      pmHigh: pmB.length ? Math.max(...pmB.map((b) => b.high)) : null,
      pmLow: pmB.length ? Math.min(...pmB.map((b) => b.low)) : null,
      pmLast: pmB.length ? pmB[pmB.length - 1].close : null,
    };
  };
  for (const b of pmBars) {
    const m = nyParts(b.time).minutes;
    if (m < 9 * 60) continue;
    const upto = pmBars.filter((x) => x.time <= b.time);
    const k = k0At(b.close, b.time + 300, upto);
    const gapPts = prevClose != null ? r2(b.close - prevClose) : null;
    const gType = gapPts == null || atrDaily == null ? "FLAT" : Math.abs(gapPts) < C.gapFlatAtr * atrDaily ? "FLAT" : gapPts > 0 ? "UP" : "DOWN";
    const d: D = k.bias === "CALL" ? 1 : k.bias === "PUT" ? -1 : 0;
    const bd: Breakdown = { h4: k.parts.h4, h1: k.parts.h1, vwap_side: 0, vwap_slope: 0, ema5: 0, ema15: 0, or_break: 0, flow: 0, opt_cp: 0, squeeze: 0 };
    steps.push({
      t: b.time, clock: nyClock(b.time + 300), min: m + 5, pre: true, is15: false, phase: "PRE", stageLabel: PHASE_TEXT.PRE,
      price: b.close, open: b.open, high: b.high, low: b.low, vwap: null, poc: null, ema5: null, ema15: null, rvol5: null, rvol15: null, atr5: null, devAtr: null, crosses: 0,
      ...(() => { const c = candleOf(b); return { body: c.body, closePos: c.closePos }; })(),
      score: k.score, breakdown: bd, threshold: C.biasThreshold, dir: d,
      strength: Math.abs(k.score) >= 3 ? "GÜÇLÜ" : Math.abs(k.score) >= 2 ? "ORTA" : "ZAYIF",
      trend: d > 0 ? "SEANS ÖNCESİ YUKARI EĞİLİM" : d < 0 ? "SEANS ÖNCESİ AŞAĞI EĞİLİM" : "SEANS ÖNCESİ NÖTR",
      mom: { impulse: 0, newExt: 0, struct: 0, run: 0, score: 0 },
      htf: { m15: 0, m30: emaDir(tf30, b.time + 300, b.close).d, h1: k.parts.h1 as D, h4: k.parts.h4 as D },
      headline: `${arrow(d)} Eğilim ${k.bias} (${k.score > 0 ? "+" : ""}${k.score}/4)`,
      action: `İşlem yok (seans öncesi). Gap ${gapPts != null ? sgnR(gapPts) : "—"} → ${gType === "UP" ? "YUKARI" : gType === "DOWN" ? "AŞAĞI" : "YATAY"} açılış bekleniyor.${k.pmHigh != null && k.pmLow != null ? ` PM aralığı ${f2(k.pmLow)}–${f2(k.pmHigh)}.` : ""} 09:35'te ilk karar.`,
      tone: d > 0 ? "bull" : d < 0 ? "bear" : "neutral",
      checklist: [
        { key: "h4", ok: k.parts.h4 !== 0, text: `4h EMA20 ${arrow(k.parts.h4)}` },
        { key: "h1", ok: k.parts.h1 !== 0, text: `1h EMA20 ${arrow(k.parts.h1)}` },
        { key: "pm", ok: k.parts.pmVsClose !== 0, text: `PM fiyatı dünkü kapanışın ${k.parts.pmVsClose > 0 ? "üstünde" : k.parts.pmVsClose < 0 ? "altında" : "üstünde değil"}` },
        { key: "pmb", ok: k.parts.pmBreak !== 0, text: `PM aralık kırılımı ${k.parts.pmBreak > 0 ? "yukarı" : k.parts.pmBreak < 0 ? "aşağı" : "yok"}` },
      ],
      veto: null, setup: null, pos: null,
      fc: { dir: d, target: null, targetLabel: "", invalid: null, invalidLabel: "", rule: null, text: d ? `Açılışta ${d > 0 ? "yukarı" : "aşağı"} eğilim` : "Açılış yönü belirsiz" },
      out: null, c5: candleText(b, null, null, "5m (PM)"), c15: null, events: [],
    });
  }
  const k0 = k0At(pmBars.length ? pmBars[pmBars.length - 1].close : prevClose ?? 0, nyDateTimeToEpoch(date, OPEN_MIN), pmBars);
  const bias = k0.bias;

  // gap: 09:30 açılışından (yoksa premarket son fiyattan)
  const gapPts = prevClose == null ? null : today.length ? r2(today[0].open - prevClose) : k0.pmLast != null ? r2(k0.pmLast - prevClose) : null;
  const gapType: "UP" | "DOWN" | "FLAT" = gapPts == null || atrDaily == null ? "FLAT" : Math.abs(gapPts) < C.gapFlatAtr * atrDaily ? "FLAT" : gapPts > 0 ? "UP" : "DOWN";

  // ── RTH oynatma ──────────────────────────────────────────────────
  const fine = (inp.fine ?? []).filter((b) => nyParts(b.time).ymd === date && isRth(b.time)).sort((a, b) => a.time - b.time);
  const prof = new Profile();
  let fineIdx = 0;
  let pv = 0, vv = 0;
  const vwaps: number[] = [];
  let crossPrev = 0;
  const crossSigns: number[] = [];
  let crosses = 0;

  let or5: TrackRead["or5"] = null;
  let or15: TrackRead["or15"] = null;
  let dayClass: DayClass | null = null;
  let dirEst: D = 0;
  let confirm10: boolean | null = null;
  const trades: TrackTrade[] = [];
  let pos: TrackTrade | null = null;
  let k2Pending: { side: Side; until: number } | null = null;
  let firstStopSide: Side | null = null;
  let reentryUsed = false;
  let prevArmed: { tag: SetupTag; side: Side } | null = null;
  let armedNext: TrackRead["armed"] = null;
  let runSide = 0, runLen = 0;
  const realized = () => trades.reduce((a, x) => a + (x.resultR ?? 0), 0);
  const openingTrades = () => trades.filter((x) => x.tag.startsWith("K")).length;
  const trendTrades = () => trades.filter((x) => x.tag.startsWith("T")).length;

  for (let i = 0; i < today.length; i++) {
    const b = today[i];
    const T = b.time + 300;
    const m = nyParts(b.time).minutes + 5; // kapanış dakikası
    const c = b.close;
    const ev: string[] = [];

    // VWAP + POC
    const vol = b.volume || 0;
    pv += ((b.high + b.low + b.close) / 3) * vol;
    vv += vol;
    const vwap = vv > 0 ? pv / vv : null;
    vwaps.push(vwap ?? c);
    if (fine.length) { while (fineIdx < fine.length && fine[fineIdx].time < T) prof.add(fine[fineIdx++]); }
    else prof.add(b);
    const poc = prof.poc();
    if (vwap != null) {
      const s = Math.sign(c - vwap);
      if (s && crossPrev && s !== crossPrev) { crosses++; crossSigns.push(i); }
      if (s) crossPrev = s;
    }

    const ema5 = ema5Map.get(b.time) ?? null;
    const ema5p = i > 0 ? ema5Map.get(today[i - 1].time) ?? null : (() => { const k = rth5.findIndex((x) => x.time === b.time); return k > 0 ? ema5Map.get(rth5[k - 1].time) ?? null : null; })();
    const atr5 = atr5Map.get(b.time) ?? null;
    const i15 = closedIdx(tf15.bars, 15, T);
    const ema15 = i15 >= 0 ? tf15.ema[i15] : null;
    const ema15p = i15 > 0 ? tf15.ema[i15 - 1] : null;
    const atr15 = i15 >= 0 ? atr15Arr[i15] ?? null : null;
    const is15 = (m - OPEN_MIN) % 15 === 0;

    // RVOL
    const sa = slotAvg(inp.rvol, m - 5);
    const rvol5 = sa ? vol / sa : null;
    let rvol15: number | null = null;
    if (is15 && i >= 2 && inp.rvol) {
      const s3 = [0, 1, 2].map((k) => slotAvg(inp.rvol, m - 5 - k * 5) ?? 0).reduce((a, x) => a + x, 0);
      const v3 = today.slice(i - 2, i + 1).reduce((a, x) => a + (x.volume || 0), 0);
      rvol15 = s3 > 0 ? v3 / s3 : null;
    }
    const cd = candleOf(b);

    // açılış aralıkları
    if (i === 0) { or5 = { high: b.high, low: b.low }; ev.push(`OR5 belirlendi: ${f2(b.low)}–${f2(b.high)}`); pushAlert(b.time, "KADEME", null, null, `OR5 ${f2(b.low)}–${f2(b.high)} · Kademe 1 başladı`); }
    if (i === 2) {
      const hi = Math.max(...today.slice(0, 3).map((x) => x.high));
      const lo = Math.min(...today.slice(0, 3).map((x) => x.low));
      const widthPct = atrDaily ? (hi - lo) / atrDaily : null;
      or15 = { high: hi, low: lo, mid: r2((hi + lo) / 2), widthPct, squeeze: widthPct != null && widthPct < C.or15Squeeze, orbDisabled: widthPct != null && widthPct > C.or15Wide };
      const bar15: Bar = { time: today[0].time, open: today[0].open, high: hi, low: lo, close: c, volume: today.slice(0, 3).reduce((a, x) => a + (x.volume || 0), 0) };
      const q = candleOf(bar15);
      const vside = vwap == null ? 0 : Math.sign(c - vwap);
      const trendDir = q.closePos >= C.closePosMin ? 1 : q.closePos <= 100 - C.closePosMin ? -1 : 0;
      if (q.body >= C.bodyMin && trendDir !== 0 && (rvol15 ?? 0) >= C.rvolEntry && vside === trendDir) dayClass = "TREND_CANDLE";
      else if (q.body < 15 || q.upper + q.lower > Math.abs(bar15.close - bar15.open)) dayClass = "INDECISION";
      else dayClass = "NORMAL";
      ev.push(`OR15 ${f2(lo)}–${f2(hi)}${widthPct != null ? ` (günlük ATR'nin %${Math.round(widthPct * 100)}'i)` : ""} · gün sınıfı ${dayClass}${or15.orbDisabled ? " · ORB kapalı (geniş)" : or15.squeeze ? " · SIKIŞMA" : ""}`);
      pushAlert(b.time, "KADEME", null, null, `OR15 ${f2(lo)}–${f2(hi)} · ${dayClass} · Kademe 2`);
    }

    // ── Yön puanı ──
    const h4 = emaDir(tf240, T, c);
    const h1 = emaDir(tf60, T, c);
    const m30 = emaDir(tf30, T, c);
    const vSide = vwap == null ? 0 : c > vwap + 0.01 ? 1 : c < vwap - 0.01 ? -1 : 0;
    const vPrev = vwaps[Math.max(0, i - 6)];
    const vSlope = vwap == null || i === 0 ? 0 : vwap - vPrev > 0.03 ? 1 : vwap - vPrev < -0.03 ? -1 : 0;
    const e5 = ema5 == null || ema5p == null ? 0 : c > ema5 && ema5 >= ema5p ? 1 : c < ema5 && ema5 <= ema5p ? -1 : 0;
    const e15 = ema15 == null || ema15p == null ? 0 : c > ema15 && ema15 >= ema15p ? 1 : c < ema15 && ema15 <= ema15p ? -1 : 0;
    let orB = 0;
    if (i === 0) orB = cd.body >= C.bodyMin && cd.closePos >= C.closePosMin && c > b.open ? 2 : cd.body >= C.bodyMin && cd.closePos <= 100 - C.closePosMin && c < b.open ? -2 : 0;
    else if (i <= 2 && or5) orB = c > or5.high ? 2 : c < or5.low ? -2 : 0;
    else if (or15) orB = c > or15.high ? 2 : c < or15.low ? -2 : 0;
    const bp = buyerPct(today.slice(Math.max(0, i - 5), i + 1));
    const flow = bp == null ? 0 : bp >= 55 ? 1 : bp <= 45 ? -1 : 0;
    const optCp = i === today.length - 1 && inp.optSide ? inp.optSide * 0.5 : 0;
    const squeeze = or15?.squeeze && i > 2 ? (c > or15.high ? 1 : c < or15.low ? -1 : 0) : 0;
    const breakdown: Breakdown = { h4: h4.d, h1: h1.d, vwap_side: vSide, vwap_slope: vSlope, ema5: e5, ema15: e15, or_break: orB, flow, opt_cp: optCp, squeeze };
    const score = r2(Object.values(breakdown).reduce((a, x) => a + x, 0));

    // ── Momentum (trend/ivme okuyucu) ──
    const back = today[Math.max(0, i - 6)];
    const impulse = atr5 ? r2((c - (i >= 6 ? back.close : today[0].open)) / atr5) : 0;
    const dayHiPrev = i > 0 ? Math.max(...today.slice(0, Math.max(1, i - 2)).map((x) => x.high)) : b.high;
    const dayLoPrev = i > 0 ? Math.min(...today.slice(0, Math.max(1, i - 2)).map((x) => x.low)) : b.low;
    const rec = today.slice(Math.max(0, i - 2), i + 1);
    const newExt: D = i >= 3 && Math.min(...rec.map((x) => x.low)) < dayLoPrev ? -1 : i >= 3 && Math.max(...rec.map((x) => x.high)) > dayHiPrev ? 1 : 0;
    // 15m salınım yapısı (son iki kapanmış 15m tepe/dip, bugün)
    let struct: D = 0;
    {
      const t15 = tf15.bars.slice(0, i15 + 1).filter((x) => nyParts(x.time).ymd === date || nyParts(x.time).ymd === pd);
      const hs: number[] = [], ls: number[] = [];
      for (let k = 1; k < t15.length - 1; k++) {
        if (t15[k].high > t15[k - 1].high && t15[k].high >= t15[k + 1].high) hs.push(t15[k].high);
        if (t15[k].low < t15[k - 1].low && t15[k].low <= t15[k + 1].low) ls.push(t15[k].low);
      }
      if (hs.length >= 2 && ls.length >= 2) {
        const hh = hs[hs.length - 1] > hs[hs.length - 2], hl = ls[ls.length - 1] > ls[ls.length - 2];
        const lh = hs[hs.length - 1] < hs[hs.length - 2], ll = ls[ls.length - 1] < ls[ls.length - 2];
        struct = hh && hl ? 1 : lh && ll ? -1 : 0;
      }
    }
    if (ema5 != null) {
      const s = c > ema5 ? 1 : c < ema5 ? -1 : 0;
      if (s && s === runSide) runLen++; else { runSide = s; runLen = s ? 1 : 0; }
    }
    const momScore = (impulse >= 1.5 ? 1 : impulse <= -1.5 ? -1 : 0) + newExt + struct + (runLen >= 4 ? runSide : 0);
    const mom: Momentum = { impulse, newExt, struct, run: runSide * runLen, score: momScore };

    const dir: D = Math.abs(score) >= 3 ? (Math.sign(score) as D) : 0;
    const absS = Math.abs(score);
    const strength: TrackStep["strength"] = absS >= 7 ? "ÇOK GÜÇLÜ" : absS >= 5 ? "GÜÇLÜ" : absS >= 3 ? "ORTA" : "ZAYIF";
    const prevStep = steps.length && !steps[steps.length - 1].pre ? steps[steps.length - 1] : null;
    let trend: string;
    if (prevStep && Math.abs(prevStep.score) >= 5 && Math.sign(prevStep.score) === -Math.sign(score) && absS >= 3) trend = `YÖN DÖNDÜ ${arrow(score)}`;
    else if (score >= 5) trend = momScore >= 1 ? "YÜKSELİŞ TRENDİ SÜRÜYOR" : momScore <= -1 ? "YÜKSELİŞ YORULUYOR" : "YUKARI TREND";
    else if (score <= -5) trend = momScore <= -1 ? "DÜŞÜŞ TRENDİ SÜRÜYOR" : momScore >= 1 ? "DÜŞÜŞ YORULUYOR" : "AŞAĞI TREND";
    else if (score >= 3) trend = "YUKARI EĞİLİM";
    else if (score <= -3) trend = "AŞAĞI EĞİLİM";
    else if (Math.abs(momScore) >= 2) trend = `ANİ ${momScore > 0 ? "YÜKSELİŞ" : "DÜŞÜŞ"} — puan henüz teyit etmedi`;
    else trend = "YATAY / KARARSIZ";

    // ── Seviyeler (hedef/geçersizlik) ──
    const dayHi = Math.max(...today.slice(0, i + 1).map((x) => x.high));
    const dayLo = Math.min(...today.slice(0, i + 1).map((x) => x.low));
    const lvls: { price: number; label: string }[] = [
      ...(vwap != null ? [{ price: vwap, label: "VWAP" }] : []),
      ...(or15 ? [{ price: or15.high, label: "OR15 tepe" }, { price: or15.low, label: "OR15 dip" }] : or5 ? [{ price: or5.high, label: "OR5 tepe" }, { price: or5.low, label: "OR5 dip" }] : []),
      ...(pdh != null ? [{ price: pdh, label: "dünkü tepe" }] : []), ...(pdl != null ? [{ price: pdl, label: "dünkü dip" }] : []),
      ...(prevClose != null ? [{ price: prevClose, label: "dünkü kapanış" }] : []),
      ...(pmHigh != null ? [{ price: pmHigh, label: "PM tepe" }] : []), ...(pmLow != null ? [{ price: pmLow, label: "PM dip" }] : []),
      ...(poc != null ? [{ price: poc, label: "POC" }] : []),
      { price: dayHi, label: "gün tepesi" }, { price: dayLo, label: "gün dibi" },
      ...pivotLevelsAt(frames, today.slice(0, i + 1), T).map((l) => ({ price: l.price, label: `pivot ${l.label}` })),
    ];
    const a15 = atr15 ?? (atr5 ? atr5 * 1.7 : 1);
    const nextLevel = (d: 1 | -1, from: number, minDist: number) =>
      lvls.filter((l) => d * (l.price - from) >= minDist).sort((x, y) => d * (x.price - y.price))[0] ?? null;

    // ── Pozisyon yönetimi (bu mum) ──
    let entered: TrackTrade | null = null;
    let exited: TrackTrade | null = null;
    if (pos) {
      const p: TrackTrade = pos;
      const d = dOfSide(p.side);
      p.barsHeld++;
      const fav = d > 0 ? b.high - p.entry : p.entry - b.low;
      const adv = d > 0 ? p.entry - b.low : b.high - p.entry;
      p.mfeR = Math.max(p.mfeR, r2(fav / p.rPts));
      p.maeR = Math.max(p.maeR, r2(adv / p.rPts));
      const h1R = r2((d * (p.h1 - p.entry)) / p.rPts);
      const close = (px: number, why: ExitReason) => {
        const rest = r2((d * (px - p.entry)) / p.rPts);
        p.exit = r2(px); p.exitTime = b.time; p.exitClock = nyClock(T); p.exitReason = why;
        p.resultR = r2(p.h1Hit ? 0.5 * h1R + 0.5 * rest : rest);
        p.liveR = null;
        exited = p;
        if (why === "STOP" && !firstStopSide) firstStopSide = p.side;
      };
      if (!p.h1Hit) {
        const stopHit = d > 0 ? b.low <= p.stop : b.high >= p.stop;
        const h1Touch = d > 0 ? b.high >= p.h1 : b.low <= p.h1;
        if (stopHit) close(p.stop, "STOP");
        else if (h1Touch) {
          p.h1Hit = true; p.h1Clock = nyClock(T); p.stop = p.entry;
          pushAlert(b.time, "YÖNET", p.tag, p.side, `H1 ${f2(p.h1)} geldi: yarısını kapat, stopu girişe (${f2(p.entry)}) çek · kalan EMA20 kırılınca ya da H2 ${f2(p.h2)}'de`);
          ev.push(`H1 ${f2(p.h1)} — yarısı alındı, stop girişe`);
        } else if (p.barsHeld >= C.timeStopBars && d * (c - p.entry) < 0) close(c, "TIME");
      } else {
        const beHit = d > 0 ? b.low <= p.entry : b.high >= p.entry;
        const h2Touch = d > 0 ? b.high >= p.h2 : b.low <= p.h2;
        if (beHit) close(p.entry, "H1_BE");
        else if (h2Touch) close(p.h2, "H2");
        else if (ema5 != null && d * (c - ema5) < 0) close(c, "EMA_EXIT");
      }
      if (!exited && m >= C.forceExit) close(c, "FORCE_1545");
      if (exited) {
        const x: TrackTrade = exited;
        pushAlert(b.time, "ÇIKIŞ", x.tag, x.side, `ÇIKIŞ ${x.side} ${x.tag} · ${x.exitReason} ${f2(x.exit as number)} · sonuç ${sgnR(x.resultR as number)}R`);
        ev.push(`ÇIKIŞ ${x.exitReason} ${f2(x.exit as number)} → ${sgnR(x.resultR as number)}R`);
        pos = null;
      } else {
        const rest = r2((d * (c - p.entry)) / p.rPts);
        p.liveR = r2(p.h1Hit ? 0.5 * h1R + 0.5 * rest : rest);
      }
      // 10:00 teyidi (K3)
      if (m === C.k3Confirm && p.stage === "K3" && p.confirm10 == null) {
        const b15 = today.slice(Math.max(0, i - 2), i + 1);
        const dir15 = Math.sign(b15[b15.length - 1].close - b15[0].open);
        p.confirm10 = dir15 === d;
        confirm10 = p.confirm10;
        if (p.confirm10) p.size = eventDay ? "half" : "full";
        ev.push(`10:00 15m teyidi ${p.confirm10 ? "✓ — boyut tam" : "✗ — boyut yarım kalır"}`);
      }
    }

    // ── Faz ──
    let phase: TrackPhase;
    if (m <= C.k1Slots[1]) phase = "K1";
    else if (m === C.k2Slot) phase = "K2";
    else if (m <= C.k3Confirm) phase = "K3";
    else if (m <= C.k4Window[1]) phase = dirEst ? "K4" : "DONE";
    else if (m <= C.trackEnd) phase = "TAKİP";
    else phase = "KAPANIŞ";

    // 10:00: yön kuruldu mu
    if (m === C.k3Confirm && dirEst === 0) {
      const b15 = today.slice(Math.max(0, i - 2), i + 1);
      const dir15 = Math.sign(b15[b15.length - 1].close - b15[0].open);
      if (Math.abs(score) >= C.thresholds.k3 && dir15 === Math.sign(score)) {
        dirEst = Math.sign(score) as D;
        ev.push(`10:00: yön kuruldu ${dirEst > 0 ? "▲ CALL" : "▼ PUT"} (puan ${score}) → Kademe 4 geri çekilme izleniyor`);
        pushAlert(b.time, "KADEME", null, sideOfD(dirEst), `Yön kuruldu ${sideOfD(dirEst)} · Kademe 4 (10:05–10:30)`);
      } else if (!trades.length) {
        ev.push("10:00: yön kurulmadı → açılış modülü 10:30'a kadar beklemede");
      }
    }
    if (m === C.k4Window[1] + 5) pushAlert(b.time, "KADEME", null, null, "Açılış modülü bitti (10:30) · gün içi takip");

    // ── Vetolar ──
    const rvolThr = phase === "TAKİP" ? C.trend.rvolMin : C.rvolVeto;
    const recentCross = crossSigns.filter((k) => k > i - 12).length;
    const vetoes: VetoCode[] = [];
    if (rvol5 != null && rvol5 < rvolThr) vetoes.push("LOW_RVOL");
    if (phase === "TAKİP" ? recentCross >= C.trend.chopCrosses : crosses >= C.vwapChopCrosses) vetoes.push("VWAP_CHOP");
    if (vwap != null && poc != null && Math.abs(vwap - poc) >= 0.05 && c > Math.min(vwap, poc) && c < Math.max(vwap, poc)) vetoes.push("VWAP_POC_ZONE");
    if (realized() <= C.dailyLossR) vetoes.push("DAILY_LOSS");
    if (phase === "TAKİP" ? trendTrades() >= C.trend.maxTrades : openingTrades() >= C.maxTrades) vetoes.push("MAX_TRADES");
    if (eventDay && phase === "K1") vetoes.push("EVENT_K1");

    // ── Kurulum adayları ──
    interface Cand { tag: SetupTag; side: Side; conds: CheckItem[]; stop: number | null; h1?: number; trigger: number | null; triggerText: string; thr: number; noEntry?: boolean }
    const cands: Cand[] = [];
    const thrK = phase === "K1" ? C.thresholds.k1 : phase === "K2" ? C.thresholds.k2 : phase === "K3" ? C.thresholds.k3 : phase === "K4" ? C.thresholds.k4 : C.trend.threshold;
    const biasOk = (s: Side) => bias === "NÖTR" || bias === s;
    const scoreOk = (d: 1 | -1, thr: number) => d * score >= thr;
    const reentryOk = (tag: SetupTag, s: Side) => {
      if (!firstStopSide || !tag.startsWith("K")) return true;
      if (reentryUsed) return false;
      return s === firstStopSide ? tag === "K3_BREAK" || tag.startsWith("K4") : tag === "K3_FAKEOUT";
    };
    const vwapOk = (d: 1 | -1) => vSide === d;

    const sides: (1 | -1)[] = [1, -1];
    if (!pos && phase === "K1" && or5) {
      for (const d of sides) {
        const s: Side = d > 0 ? "CALL" : "PUT";
        const brk = i === 0 ? d * orB >= 2 : d > 0 ? c > or5.high : c < or5.low;
        cands.push({
          tag: "K1_ORB5", side: s, thr: C.thresholds.k1,
          stop: d > 0 ? or5.low : or5.high,
          trigger: i === 0 ? null : d > 0 ? or5.high : or5.low,
          triggerText: d > 0 ? `5m kapanış OR5 tepesi ${f2(or5.high)} üstünde` : `5m kapanış OR5 dibi ${f2(or5.low)} altında`,
          conds: [
            { key: "or_break", ok: brk, price: true, text: i === 0 ? `09:35 güçlü ${d > 0 ? "yükseliş" : "düşüş"} mumu` : d > 0 ? `kapanış > OR5 tepe ${f2(or5.high)}` : `kapanış < OR5 dip ${f2(or5.low)}` },
            { key: "vwap_side", ok: vwapOk(d), price: true, text: `fiyat VWAP ${d > 0 ? "üstünde" : "altında"}` },
            { key: "rvol", ok: (rvol5 ?? 0) >= C.rvolEntry, text: `RVOL 5m ≥ ${C.rvolEntry} (${rvol5 != null ? rvol5.toFixed(2) : "—"})` },
            { key: "candle", ok: cd.body >= C.bodyMin && (d > 0 ? cd.closePos >= C.closePosMin : cd.closePos <= 100 - C.closePosMin), text: `gövde ≥ %${C.bodyMin} · kapanış ${d > 0 ? `≥ %${C.closePosMin}` : `≤ %${100 - C.closePosMin}`}` },
            { key: "bias", ok: biasOk(s), text: `seans öncesi eğilim ters değil (${bias})` },
            { key: "score", ok: scoreOk(d, C.thresholds.k1), text: `yön puanı ${d > 0 ? "≥ +" : "≤ −"}${C.thresholds.k1} (${score})` },
          ],
        });
      }
    }
    if (!pos && phase === "K2" && or15 && dayClass) {
      const q = candleOf({ time: today[0].time, open: today[0].open, high: or15.high, low: or15.low, close: c, volume: 0 });
      const d: 1 | -1 = q.closePos >= 50 ? 1 : -1;
      const s: Side = d > 0 ? "CALL" : "PUT";
      const conds: CheckItem[] = [
        { key: "day_class", ok: dayClass === "TREND_CANDLE", text: `09:45 15m trend mumu (${dayClass})` },
        { key: "vwap_side", ok: vwapOk(d), price: true, text: `fiyat VWAP ${d > 0 ? "üstünde" : "altında"}` },
        { key: "rvol", ok: (rvol15 ?? 0) >= C.rvolEntry, text: `RVOL 15m ≥ ${C.rvolEntry} (${rvol15 != null ? rvol15.toFixed(2) : "—"})` },
        { key: "bias", ok: biasOk(s), text: `eğilim ters değil (${bias})` },
        { key: "score", ok: scoreOk(d, C.thresholds.k2), text: `yön puanı ${d > 0 ? "≥ +" : "≤ −"}${C.thresholds.k2} (${score})` },
      ];
      const all = conds.every((x) => x.ok);
      if (all && C.k2EntryMode === "PULLBACK") {
        k2Pending = { side: s, until: C.k3Slots[1] };
        ev.push(`09:45 trend mumu ${s} — 09:50/09:55'te EMA20/VWAP'a geri çekilme bekleniyor (stop OR15 ortası ${f2(or15.mid)})`);
        pushAlert(b.time, "KADEME", "K2_TREND_PB", s, `09:45 trend mumu ${s} · geri çekilme bekleniyor`);
      }
      // PULLBACK modunda 09:45 yalnız kurulumu başlatır (giriş 09:50/09:55'te)
      cands.push({ tag: C.k2EntryMode === "CLOSE" ? "K2_TREND_CLOSE" : "K2_TREND_PB", side: s, thr: C.thresholds.k2, stop: or15.mid, trigger: null, triggerText: "09:45 kapanışı", conds, noEntry: C.k2EntryMode !== "CLOSE" });
    }
    if (!pos && phase === "K3" && or15 && m !== C.k3Confirm) {
      const rng = or15.high - or15.low;
      if (k2Pending) {
        const s = k2Pending.side, d = dOfSide(s);
        const line = d > 0 ? Math.max(ema5 ?? -Infinity, vwap ?? -Infinity) : Math.min(ema5 ?? Infinity, vwap ?? Infinity);
        const touched = Number.isFinite(line) && (d > 0 ? b.low <= line : b.high >= line);
        cands.push({
          tag: "K2_TREND_PB", side: s, thr: C.thresholds.k2, stop: or15.mid, trigger: Number.isFinite(line) ? r2(line) : null,
          triggerText: `EMA20/VWAP'a dokunup ${d > 0 ? "yükseliş" : "düşüş"} mumu kapanışı`,
          conds: [
            { key: "pullback", ok: touched, price: true, text: `EMA20/VWAP'a geri çekilme (${Number.isFinite(line) ? f2(line) : "—"})` },
            { key: "candle", ok: d * (c - b.open) > 0 && d * (c - line) > 0, price: true, text: `${d > 0 ? "yükseliş" : "düşüş"} mumu, çizginin ${d > 0 ? "üstünde" : "altında"} kapanış` },
            { key: "stop_side", ok: d * (c - or15.mid) > 0, text: `stop (OR15 ortası ${f2(or15.mid)}) doğru tarafta` },
          ],
        });
      }
      if (!or15.orbDisabled) {
        for (const d of sides) {
          const s: Side = d > 0 ? "CALL" : "PUT";
          cands.push({
            tag: "K3_BREAK", side: s, thr: C.thresholds.k3,
            stop: r2(d > 0 ? or15.high - 0.25 * rng : or15.low + 0.25 * rng),
            trigger: d > 0 ? or15.high : or15.low,
            triggerText: d > 0 ? `5m kapanış OR15 tepe ${f2(or15.high)} üstünde` : `5m kapanış OR15 dip ${f2(or15.low)} altında`,
            conds: [
              { key: "or_break", ok: d > 0 ? c > or15.high : c < or15.low, price: true, text: d > 0 ? `kapanış > OR15 tepe ${f2(or15.high)}` : `kapanış < OR15 dip ${f2(or15.low)}` },
              { key: "vwap_side", ok: vwapOk(d), price: true, text: `fiyat VWAP ${d > 0 ? "üstünde" : "altında"}` },
              { key: "rvol", ok: (rvol5 ?? 0) >= C.rvolEntry, text: `RVOL 5m ≥ ${C.rvolEntry} (${rvol5 != null ? rvol5.toFixed(2) : "—"})` },
              { key: "score", ok: scoreOk(d, C.thresholds.k3), text: `yön puanı ${d > 0 ? "≥ +" : "≤ −"}${C.thresholds.k3} (${score})` },
            ],
          });
        }
      }
      // başarısız kırılım (eğilime ters olabilen tek kurulum)
      const pb = i > 0 ? today[i - 1] : null;
      for (const d of sides) {
        const s: Side = d > 0 ? "CALL" : "PUT";
        // CALL fakeout = aşağı kırılım başarısız: önceki kapanış OR15 dibi altı, şimdi içeride, VWAP üstü
        const prevOut = !!pb && (d > 0 ? pb.close < or15.low : pb.close > or15.high);
        const backIn = c >= or15.low && c <= or15.high;
        const ext = pb ? (d > 0 ? Math.min(pb.low, b.low) : Math.max(pb.high, b.high)) : null;
        cands.push({
          tag: "K3_FAKEOUT", side: s, thr: 0,
          stop: ext != null ? r2(ext) : null,
          h1: d > 0 ? or15.high : or15.low,
          trigger: d > 0 ? or15.low : or15.high,
          triggerText: d > 0 ? `aşağı kırılım sonrası OR15 içine (${f2(or15.low)} üstü) dönüş` : `yukarı kırılım sonrası OR15 içine (${f2(or15.high)} altı) dönüş`,
          conds: [
            { key: "prev_out", ok: prevOut, text: `önceki 5m OR15 ${d > 0 ? "altında" : "üstünde"} kapandı` },
            { key: "back_in", ok: prevOut && backIn, price: true, text: "bu 5m OR15 içinde kapandı" },
            { key: "vwap_side", ok: vwapOk(d), price: true, text: `fiyat VWAP ${d > 0 ? "üstünde" : "altında"}` },
            { key: "candle", ok: cd.body >= C.fakeoutBodyMin && d * (c - b.open) > 0, text: `ters yön mumu gövde ≥ %${C.fakeoutBodyMin}` },
          ],
        });
      }
    }
    // K4 ve TAKİP: yön yönünde geri çekilme + yön mumu
    const pbCand = (tagV: SetupTag, tagE: SetupTag, d: 1 | -1, thr: number, rvMin: number, bodyMin: number, cpMin: number): Cand => {
      const s: Side = d > 0 ? "CALL" : "PUT";
      const win = today.slice(Math.max(0, i - 1), i + 1);
      const touchV = vwap != null && win.some((x, k) => { const vw = vwaps[i - (win.length - 1) + k]; return d > 0 ? x.low <= vw : x.high >= vw; });
      const touchE = ema5 != null && win.some((x) => (d > 0 ? x.low <= (ema5 as number) : x.high >= (ema5 as number)));
      const ext = d > 0 ? Math.min(...win.map((x) => x.low)) : Math.max(...win.map((x) => x.high));
      const line = touchV ? vwap : ema5;
      return {
        tag: touchV ? tagV : tagE, side: s, thr, stop: r2(ext - d * 0.02), trigger: line != null ? r2(line) : null,
        triggerText: `EMA20/VWAP'a geri çekilme sonrası ${d > 0 ? "yükseliş" : "düşüş"} mumu kapanışı`,
        conds: [
          { key: "pullback", ok: touchV || touchE, price: true, text: `EMA20 ${ema5 != null ? f2(ema5) : "—"} / VWAP ${vwap != null ? f2(vwap) : "—"}'a geri çekilme` },
          { key: "candle", ok: cd.body >= bodyMin && (d > 0 ? cd.closePos >= cpMin : cd.closePos <= 100 - cpMin) && d * (c - b.open) > 0, price: true, text: `${d > 0 ? "yükseliş" : "düşüş"} mumu · gövde ≥ %${bodyMin} · kapanış ${d > 0 ? `≥ %${cpMin}` : `≤ %${100 - cpMin}`}` },
          { key: "vwap_side", ok: vwapOk(d), price: true, text: `kapanış VWAP ${d > 0 ? "üstünde" : "altında"}` },
          { key: "rvol", ok: (rvol5 ?? 0) >= rvMin, text: `RVOL 5m ≥ ${rvMin} (${rvol5 != null ? rvol5.toFixed(2) : "—"})` },
          { key: "score", ok: scoreOk(d, thr), text: `yön puanı ${d > 0 ? "≥ +" : "≤ −"}${thr} (${score})` },
        ],
      };
    };
    if (!pos && phase === "K4" && dirEst) cands.push(pbCand("K4_PB_VWAP", "K4_PB_EMA", dirEst as 1 | -1, C.thresholds.k4, C.rvolK4, 50, C.closePosMin));
    let trendDir: D = 0;
    if (phase === "TAKİP" && C.trend.on && m <= C.trend.to) {
      const held = [score, ...steps.slice(-(C.trend.holdBars - 1)).filter((x) => !x.pre).map((x) => x.score)];
      const sgn = Math.sign(score);
      if (held.length >= C.trend.holdBars && held.every((x) => Math.sign(x) === sgn && Math.abs(x) >= C.trend.threshold) && Math.sign(momScore) !== -sgn) trendDir = sgn as D;
      if (!pos && trendDir) cands.push(pbCand("T_PB_VWAP", "T_PB_EMA", trendDir as 1 | -1, C.trend.threshold, C.trend.rvolMin, C.trend.bodyMin, C.trend.closePosMin));
      if (!pos && trendDir && C.trend.brkOn && i >= C.trend.brkLookback) {
        const d = trendDir as 1 | -1;
        const prior = today.slice(i - C.trend.brkLookback, i);
        const lvl = d > 0 ? Math.max(...prior.map((x) => x.high)) : Math.min(...prior.map((x) => x.low));
        const last3 = today.slice(Math.max(0, i - 2), i + 1);
        const ext = d > 0 ? Math.min(...last3.map((x) => x.low)) : Math.max(...last3.map((x) => x.high));
        cands.push({
          tag: "T_BRK", side: d > 0 ? "CALL" : "PUT", thr: C.trend.threshold, stop: r2(ext - d * 0.02), trigger: r2(lvl),
          triggerText: d > 0 ? `5m kapanış son 30 dk tepesi ${f2(lvl)} üstünde` : `5m kapanış son 30 dk dibi ${f2(lvl)} altında`,
          conds: [
            { key: "or_break", ok: d * (c - lvl) > 0, price: true, text: d > 0 ? `kapanış > 30 dk tepe ${f2(lvl)}` : `kapanış < 30 dk dip ${f2(lvl)}` },
            { key: "candle", ok: cd.body >= C.trend.bodyMin && (d > 0 ? cd.closePos >= C.trend.closePosMin : cd.closePos <= 100 - C.trend.closePosMin), text: `${d > 0 ? "yükseliş" : "düşüş"} mumu · gövde ≥ %${C.trend.bodyMin}` },
            { key: "vwap_side", ok: vwapOk(d), price: true, text: `kapanış VWAP ${d > 0 ? "üstünde" : "altında"}` },
            { key: "rvol", ok: (rvol5 ?? 0) >= C.trend.rvolMin, text: `RVOL 5m ≥ ${C.trend.rvolMin} (${rvol5 != null ? rvol5.toFixed(2) : "—"})` },
            { key: "score", ok: scoreOk(d, C.trend.threshold), text: `yön puanı ${d > 0 ? "≥ +" : "≤ −"}${C.trend.threshold} (${score})` },
          ],
        });
      }
    }

    // ── Giriş ──
    let veto: VetoCode | null = null;
    for (const cand of cands) {
      if (cand.noEntry || !cand.conds.every((x) => x.ok) || cand.stop == null) continue;
      if (!reentryOk(cand.tag, cand.side)) continue;
      const d = dOfSide(cand.side);
      if (d * (c - cand.stop) <= 0) continue;
      const rPts = r2(Math.abs(c - cand.stop));
      const maxStop = (cand.tag.startsWith("T") ? C.trend.stopMaxAtr15 : C.stopMaxAtr15) * a15;
      const vs = [...vetoes];
      if (rPts > maxStop) vs.push("STOP_TOO_WIDE");
      if (rPts < 0.05) continue;
      if (vs.length) { veto = vs[0]; ev.push(`${cand.side} ${cand.tag} koşulları tamam ama VETO: ${VETO_TEXT[vs[0]]}`); continue; }
      const tp1 = cand.h1 != null && d * (cand.h1 - c) > 0 ? r2(cand.h1) : r2(c + d * C.h1R * rPts);
      const h2R = r2(c + d * C.h2R * rPts);
      const nl = nextLevel(d, tp1, 0.05);
      const h2 = nl && d * (nl.price - h2R) < 0 ? r2(nl.price) : h2R;
      const isReentry = !!firstStopSide && cand.tag.startsWith("K");
      if (isReentry) reentryUsed = true;
      const stage: TrackPhase = phase;
      const size: "half" | "full" = eventDay || cand.tag === "K3_BREAK" || cand.tag === "K3_FAKEOUT" ? "half" : "full";
      const tr: TrackTrade = {
        id: `${date}-${nyClock(T).replace(":", "")}-${cand.tag}`, tag: cand.tag, reentry: isReentry, side: cand.side, stage,
        entryTime: b.time, entryClock: nyClock(T), entry: r2(c), stop: cand.stop, stop0: cand.stop, rPts, h1: tp1, h2, size, confirm10: null,
        strike: strikeHint(cand.side, c), exitTime: null, exitClock: null, exit: null, exitReason: null, resultR: null, mfeR: 0, maeR: 0,
        barsHeld: 0, scoreEntry: score, rvolEntry: rvol5 != null ? r2(rvol5) : null, dayClass, bias, gapType, eventDay, h1Hit: false, h1Clock: null, liveR: 0,
      };
      trades.push(tr);
      pos = tr;
      entered = tr;
      if (cand.tag === "K2_TREND_PB") k2Pending = null;
      pushAlert(b.time, "TETİK", cand.tag, cand.side, `TETİK · ${nyClock(T)} · ${cand.tag} ${cand.side} · giriş ${f2(c)} · stop ${f2(cand.stop)} · H1 ${f2(tp1)} · puan ${score}/${cand.thr}`);
      ev.push(`GİRİŞ ${cand.side} ${cand.tag} ${f2(c)} · stop ${f2(cand.stop)} · H1 ${f2(tp1)} · H2 ${f2(h2)}`);
      break;
    }
    if (k2Pending && m >= k2Pending.until && !entered) {
      pushAlert(b.time, "İPTAL", "K2_TREND_PB", k2Pending.side, `09:45 trend mumu geri çekilmesi gelmedi — K2 iptal`);
      ev.push("K2 geri çekilme gelmedi — iptal");
      k2Pending = null;
    }
    if (!veto && !pos && vetoes.length && cands.length && (phase === "K1" || phase === "K2" || phase === "K3" || phase === "K4" || (phase === "TAKİP" && trendDir))) veto = vetoes[0];

    // ── Gösterilecek kurulum + kontrol listesi ──
    const prefD: 1 | -1 = score >= 0 ? 1 : -1;
    const rank = (x: Cand) => x.conds.filter((k) => k.ok).length / x.conds.length + (dOfSide(x.side) === prefD ? 0.01 : 0);
    const best = cands.length ? [...cands].sort((a, z) => rank(z) - rank(a))[0] : null;
    let setup: TrackSetup | null = null;
    armedNext = null;
    if (pos) {
      const p = pos as TrackTrade;
      setup = { tag: p.tag, side: p.side, status: "OPEN", trigger: null, triggerText: "", stop: p.stop, missing: [] };
    } else if (best) {
      const missing = best.conds.filter((k) => !k.ok);
      // sonraki kapanışa taşınabilir mi (kurulum penceresi devam ediyor mu)
      const nextM = m + 5;
      const nextOpen =
        (best.tag === "K1_ORB5" && nextM <= C.k1Slots[1]) ||
        (best.tag.startsWith("K3") && nextM <= C.k3Slots[1]) ||
        (best.tag === "K2_TREND_PB" && !!k2Pending && nextM <= k2Pending.until) ||
        (best.tag.startsWith("K4") && nextM <= C.k4Window[1]) ||
        (best.tag.startsWith("T") && nextM <= C.trend.to);
      const armed = nextOpen && missing.length === 1 && missing.every((k) => k.price) && best.trigger != null && !vetoes.some((v) => v !== "LOW_RVOL");
      setup = { tag: best.tag, side: best.side, status: armed ? "ARMED" : "WATCH", trigger: best.trigger, triggerText: best.triggerText, stop: best.stop, missing: missing.map((k) => k.text) };
      if (armed && best.trigger != null) armedNext = { tag: best.tag, side: best.side, trigger: best.trigger, stop: best.stop };
    }
    if (prevArmed && !entered && (!setup || setup.status !== "ARMED" || setup.tag !== prevArmed.tag || setup.side !== prevArmed.side)) {
      pushAlert(b.time, "İPTAL", prevArmed.tag, prevArmed.side, `İPTAL · ${prevArmed.tag} ${prevArmed.side} kapanışta tutmadı`);
    }
    prevArmed = setup?.status === "ARMED" ? { tag: setup.tag, side: setup.side } : null;
    const checklist = best && !pos ? best.conds : [];

    // ── Tahmin (sonraki 30 dk) ──
    // Seans dilimine göre ölçülmüş kural (FC_RULES): açılış ivmesi · öğlen testere→VWAP'a dönüş / trend günü→trend yönü · 14:00+ 15m yapı
    const devA = atr5 && vwap != null ? (c - vwap) / atr5 : null;
    let fdir: D = 0;
    let rule: FcRule | null = null;
    if (m <= C.k4Window[1]) { if (Math.abs(momScore) >= 1) { fdir = Math.sign(momScore) as D; rule = "OPEN_MOM"; } }
    else if (m <= 14 * 60) {
      if (crosses >= 4 && devA != null && Math.abs(devA) >= 1) { fdir = -Math.sign(devA) as D; rule = "CHOP_FADE"; }
      else if (crosses <= 1 && absS >= 5) { fdir = Math.sign(score) as D; rule = "TREND_DAY"; }
    } else if (struct && m <= C.trackEnd) { fdir = struct; rule = "STRUCT"; }
    let fc: TrackForecast;
    if (fdir) {
      const tgt = rule === "CHOP_FADE" && vwap != null ? { price: vwap, label: "VWAP" } : nextLevel(fdir as 1 | -1, c, 0.25 * a15);
      const target = tgt && Math.abs(tgt.price - c) <= 2.5 * a15 ? tgt : { price: r2(c + fdir * a15), label: "1 ATR15 hareket" };
      const opp = [vwap != null ? { price: vwap, label: "VWAP" } : null, ema5 != null ? { price: ema5, label: "5m EMA20" } : null]
        .filter((x): x is { price: number; label: string } => !!x && fdir * (c - x.price) > 0.05)
        .sort((x, y) => fdir * (y.price - x.price))[0];
      const inv = opp ?? { price: r2(c - fdir * 0.6 * a15), label: "0,6 ATR15 ters" };
      const rs = FC_RULES[rule as FcRule];
      fc = {
        dir: fdir, target: r2(target.price), targetLabel: target.label, invalid: r2(inv.price), invalidLabel: inv.label, rule,
        text: `30 dk: ${fdir > 0 ? "▲ yukarı" : "▼ aşağı"} (${rs.label}) → hedef ${f2(target.price)} (${target.label}) · iptal: 5m kapanış ${f2(inv.price)} (${inv.label}) ${fdir > 0 ? "altı" : "üstü"} · ölçüm %${rs.hit}`,
      };
    } else {
      const up = nextLevel(1, c, 0.1), dn = nextLevel(-1, c, 0.1);
      fc = {
        dir: 0, target: null, targetLabel: "", invalid: null, invalidLabel: "", rule: null,
        text: `30 dk: ölçülmüş bir kenar yok — yatay/bekle${up ? ` · ${f2(up.price)} (${up.label}) üstü kapanış ▲` : ""}${dn ? ` · ${f2(dn.price)} (${dn.label}) altı kapanış ▼` : ""}`,
      };
    }

    // ── Metinler ──
    const P = pos as TrackTrade | null;
    let headline = `${arrow(dir)} ${dir > 0 ? "YUKARI" : dir < 0 ? "AŞAĞI" : "YÖN YOK"}${dir ? ` · ${strength}` : ""}`;
    let action: string;
    let tone: TrackStep["tone"] = dir > 0 ? "bull" : dir < 0 ? "bear" : "neutral";
    if (entered) {
      const e: TrackTrade = entered;
      headline = `${e.side === "CALL" ? "🟢 ▲ CALL GİR" : "🔴 ▼ PUT GİR"}`;
      action = `${TAG_TEXT[e.tag]} · giriş ${f2(e.entry)} · stop ${f2(e.stop)} · H1 ${f2(e.h1)} · H2 ${f2(e.h2)} · ${e.size === "half" ? "yarım boyut" : "tam boyut"} · ${e.strike}`;
      tone = e.side === "CALL" ? "bull" : "bear";
    } else if (exited) {
      const x: TrackTrade = exited;
      headline = `◼ ${x.side} KAPAT · ${sgnR(x.resultR as number)}R`;
      action = `${x.exitReason === "STOP" ? "Stop oldu" : x.exitReason === "H2" ? "H2 hedefi geldi" : x.exitReason === "EMA_EXIT" ? "5m kapanış EMA20'nin ters tarafında — trend bitti" : x.exitReason === "H1_BE" ? "Kalan yarı girişte kapandı" : x.exitReason === "TIME" ? "30 dk içinde H1 gelmedi, fiyat aleyhte — zaman stopu" : "15:45 zorunlu kapanış"} (${f2(x.exit as number)}). ${dir ? `Yön hâlâ ${dir > 0 ? "yukarı" : "aşağı"} (${score}).` : "Yön yok."}`;
      tone = "warn";
    } else if (P) {
      const d = dOfSide(P.side);
      headline = `${P.side === "CALL" ? "▲ CALL" : "▼ PUT"} AÇIK · ${P.liveR != null ? sgnR(P.liveR) : "0"}R`;
      const against = d * score <= -5;
      action = P.h1Hit
        ? `Yarısı alındı, stop girişte (${f2(P.entry)}). Kalanı TUT — 5m kapanış EMA20 ${ema5 != null ? f2(ema5) : "—"} ${d > 0 ? "altına" : "üstüne"} inerse ya da H2 ${f2(P.h2)} gelirse kapat.`
        : `TUT — stop ${f2(P.stop)} · H1 ${f2(P.h1)}'de yarısını al.${against ? " ⚠ Yön puanı tersine döndü — stopu sıkılaştır." : ""}`;
      tone = against ? "warn" : P.side === "CALL" ? "bull" : "bear";
    } else if (setup?.status === "ARMED" && setup.trigger != null) {
      headline = `⚡ ${setup.side} HAZIR`;
      action = `${hm(m + 5)} kapanışında ${setup.triggerText} → GİR${setup.stop != null ? ` · stop ${f2(setup.stop)}` : ""}. Eksik: ${setup.missing.join(" · ")}.`;
      tone = "warn";
    } else if (veto) {
      action = `BEKLE — ${VETO_TEXT[veto]}${veto === "LOW_RVOL" && rvol5 != null ? ` (${rvol5.toFixed(2)})` : ""}. ${dir ? `Yön ${dir > 0 ? "yukarı" : "aşağı"} ama giriş yok.` : ""}`;
    } else if (dir) {
      const d = dir;
      const line = d > 0 ? Math.max(ema5 ?? -Infinity, vwap ?? -Infinity) : Math.min(ema5 ?? Infinity, vwap ?? Infinity);
      const lineTxt = Number.isFinite(line) ? f2(line) : "—";
      action = `${d > 0 ? "CALL tarafı" : "PUT tarafı"} ${strength === "ZAYIF" || strength === "ORTA" ? "önde" : "güçlü"} — ${d > 0 ? "PUT" : "CALL"} arama. Giriş: EMA20/VWAP (${lineTxt}) bölgesine geri çekilme + ${d > 0 ? "yükseliş" : "düşüş"} mumu kapanışı.`;
      if (phase === "KAPANIŞ") action = `Yön ${d > 0 ? "yukarı" : "aşağı"} — kapanış saatleri, yeni giriş yok.`;
    } else {
      const up = nextLevel(1, c, 0.1), dn = nextLevel(-1, c, 0.1);
      action = `BEKLE — yön yok.${up ? ` ${f2(up.price)} (${up.label}) üstü 5m kapanış ▲` : ""}${dn ? ` · ${f2(dn.price)} (${dn.label}) altı ▼` : ""} yön açar.`;
    }

    const stageLabel = pos && !entered ? (P?.h1Hit ? PHASE_TEXT.MANAGE : PHASE_TEXT.IN_TRADE) : PHASE_TEXT[phase];
    const shownPhase: TrackPhase = pos && !entered ? (P?.h1Hit ? "MANAGE" : "IN_TRADE") : veto && !entered ? "VETO" : phase;
    let c15: string | null = null;
    if (is15 && i >= 2) {
      const g = today.slice(i - 2, i + 1);
      const b15: Bar = { time: g[0].time, open: g[0].open, high: Math.max(...g.map((x) => x.high)), low: Math.min(...g.map((x) => x.low)), close: c, volume: g.reduce((a, x) => a + (x.volume || 0), 0) };
      c15 = candleText(b15, vwap, rvol15, "15m") + ` · 15m EMA20 ${ema15 != null ? (c > ema15 ? "üstü" : "altı") : "—"}`;
    }

    steps.push({
      t: b.time, clock: nyClock(T), min: m, pre: false, is15, phase: shownPhase, stageLabel,
      price: c, open: b.open, high: b.high, low: b.low, vwap: vwap != null ? r2(vwap) : null, poc, ema5: ema5 != null ? r2(ema5) : null, ema15: ema15 != null ? r2(ema15) : null,
      rvol5: rvol5 != null ? r2(rvol5) : null, rvol15: rvol15 != null ? r2(rvol15) : null, atr5: atr5 != null ? r2(atr5) : null, devAtr: atr5 && vwap != null ? r2((c - vwap) / atr5) : null, crosses, body: Math.round(cd.body), closePos: Math.round(cd.closePos),
      score, breakdown, threshold: thrK, dir, strength, trend, mom,
      htf: { m15: e15 as D, m30: m30.d, h1: h1.d, h4: h4.d },
      headline, action, tone, checklist, veto: entered ? null : veto, setup,
      pos: P && !exited ? { tag: P.tag, side: P.side, entry: P.entry, stop: P.stop, h1: P.h1, h2: P.h2, liveR: P.liveR ?? 0, h1Hit: P.h1Hit } : null,
      fc, out: null, c5: candleText(b, vwap, rvol5, "5m"), c15, events: ev,
    });
  }

  // ── Tahmin sonuçları (30 dk sonrası) ──
  const rthSteps = steps.filter((s) => !s.pre);
  rthSteps.forEach((s, k) => {
    const fut = today.slice(k + 1, k + 1 + C.predBars);
    if (!fut.length) return;
    const done = fut.length >= C.predBars;
    const move = r2(fut[fut.length - 1].close - s.price);
    let tHit = false, iHit = false;
    if (s.fc.dir && s.fc.target != null && s.fc.invalid != null) {
      for (const x of fut) {
        const ti = s.fc.dir > 0 ? x.high >= s.fc.target : x.low <= s.fc.target;
        const ii = s.fc.dir > 0 ? x.close <= s.fc.invalid : x.close >= s.fc.invalid;
        if (ii) { iHit = true; break; }
        if (ti) { tHit = true; break; }
      }
    }
    s.out = { move, hit: s.fc.dir ? Math.sign(move) === s.fc.dir && Math.abs(move) >= 0.05 : null, targetHit: tHit, invalidHit: iHit, done };
  });
  const scored = rthSteps.filter((s) => s.fc.dir && s.out?.done);
  const pred = { n: scored.length, hit: scored.filter((s) => s.out?.hit).length, tHit: scored.filter((s) => s.out?.targetHit).length };

  const current = steps.length ? steps[steps.length - 1] : null;
  const lastMin = current ? current.min : null;
  const nextCheck = lastMin == null ? hm(OPEN_MIN + 5) : lastMin < 16 * 60 ? hm(lastMin + 5) : null;
  return {
    date, prevClose, atrDaily: atrDaily != null ? r2(atrDaily) : null, k0, gap: { pts: gapPts, type: gapType }, eventDay,
    or5, or15, dayClass, dirEstablished: dirEst, confirm10, steps, current, trades, alerts,
    realizedR: r2(realized()), pred, nextCheck, armed: armedNext,
  };
}

/** Canlı ön uyarı (HAZIRLAN): kapanışa ≤ 60 sn kala oluşan mum, hazır kurulumun tetik fiyatını geçmişse */
export function trackPrewarn(r: TrackRead | null, forming: Bar | null, nowSec: number, cfg: TrackCfg = TRACK_CFG): TrackAlert | null {
  if (!r?.armed || !forming) return null;
  const left = forming.time + 300 - nowSec;
  if (left > cfg.alertPrewarnSec || left < 0) return null;
  const d = r.armed.side === "CALL" ? 1 : -1;
  if (d * (forming.close - r.armed.trigger) <= 0) return null;
  const clock = nyClock(forming.time + 300);
  return {
    t: forming.time, clock, level: "HAZIRLAN", tag: r.armed.tag, side: r.armed.side,
    text: `HAZIRLAN · ${clock} · ${r.armed.tag} ${r.armed.side} · tetik ${r.armed.trigger.toFixed(2)} · stop ${r.armed.stop != null ? r.armed.stop.toFixed(2) : "—"} · ${left} sn kaldı`,
    key: `${r.date}|HAZIRLAN|${r.armed.tag}|${r.armed.side}|${forming.time}`,
  };
}

// ── Özet istatistikler (sunucu günlüğü ve geriye dönük test için ortak) ──

export interface TagStat { tag: SetupTag; n: number; win: number; avgR: number; medR: number; pf: number | null; avgMfe: number; avgMae: number; maxConsecLoss: number; totalR: number; status: "LIVE_OK" | "OBSERVE" }

export function summarizeTrades(trades: TrackTrade[]): TagStat[] {
  const by = new Map<SetupTag, TrackTrade[]>();
  for (const t of trades) if (t.resultR != null) (by.get(t.tag) ?? by.set(t.tag, []).get(t.tag)!).push(t);
  const out: TagStat[] = [];
  for (const [tag, xs] of by) {
    const rs = xs.map((x) => x.resultR as number);
    const sorted = [...rs].sort((a, b) => a - b);
    const gains = rs.filter((x) => x > 0).reduce((a, x) => a + x, 0);
    const losses = -rs.filter((x) => x < 0).reduce((a, x) => a + x, 0);
    let streak = 0, maxStreak = 0;
    for (const r of rs) { if (r < 0) { streak++; maxStreak = Math.max(maxStreak, streak); } else streak = 0; }
    const avgR = rs.reduce((a, x) => a + x, 0) / rs.length;
    out.push({
      tag, n: rs.length, win: Math.round((100 * rs.filter((x) => x > 0).length) / rs.length), avgR: r2(avgR), medR: r2(sorted[Math.floor(sorted.length / 2)]),
      pf: losses > 0 ? r2(gains / losses) : null, avgMfe: r2(xs.reduce((a, x) => a + x.mfeR, 0) / xs.length), avgMae: r2(xs.reduce((a, x) => a + x.maeR, 0) / xs.length),
      maxConsecLoss: maxStreak, totalR: r2(rs.reduce((a, x) => a + x, 0)), status: rs.length >= 100 && avgR >= 0.2 ? "LIVE_OK" : "OBSERVE",
    });
  }
  return out.sort((a, b) => a.tag.localeCompare(b.tag));
}
