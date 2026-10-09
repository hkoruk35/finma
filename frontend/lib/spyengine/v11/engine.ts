/**
 * SPY Engine V11 — TEK KARAR MODÜLÜ (saf, DOM/ağ yok).
 *
 * Tüm yön hükmü yalnızca burada hesaplanır; sayfa (app/admin/spyengine/v2)
 * hiçbir şeyi yeniden hesaplamaz, yalnızca `V11Snapshot`'ı gösterir.
 * Eşikler `config.ts`'te; koda gömülü sayı yok.
 *
 * Sıra (belge): L1 rejim → L2 skor/yön → L3–L5 kurulum/tetik/yönetim →
 * erken uyarı olayları. Üst katman alt katmanı bağlar; olay yalnızca uyarıdır.
 *
 * Çalışma biçimi: gün, kapanmış 5m RTH mumlarıyla baştan "oynatılır" (replay).
 * Bu sayede histerezis/durum makineleri sunucuda bellek tutmadan, her istekte
 * aynı sonucu verir (deterministik, non-repainting) ve aynı kod 60 günlük
 * arşiv kalibrasyonunda da çalışır.
 *
 * Kullanılan göstergeler V10'dakilerle aynıdır (VWAP, EMA20, POC/VAH/VAL,
 * pivot, likidite havuzu/süpürme, akıllı para olayları, opsiyon duvarları,
 * çok zaman dilimli skor). Yeni gösterge eklenmedi (RSI vb. yok).
 */

import { nyParts, nyClock, isRthBar, r2, ema, atr, type Bar } from "../core";
import { profileOf, flowRead, type FlowEvent } from "../flow";
import { classicPivots, PIVOT_ORDER, type PivotBase } from "../pivots";
import { optionLevelList, type OptionLevels } from "../optionLevels";
import { V11_CONFIG as CFG } from "./config";

// ═══════════════════════════════════════════════════════════════════
// Tipler
// ═══════════════════════════════════════════════════════════════════

export type VerdictState = "BEKLE" | "HAZIRLAN" | "GİR" | "YÖNET" | "ÇIK" | "PAS";
export type RegimeKind = "AÇILIŞ" | "TREND_UP" | "TREND_DOWN" | "YATAY" | "GEÇİŞ";
export type Side = "LONG" | "SHORT";
export type SetupKey = "PULLBACK" | "BREAKOUT" | "EDGE_LONG" | "EDGE_SHORT";
export type Grade = "A" | "B" | "C";

export const SETUP_LABEL: Record<SetupKey, string> = {
  PULLBACK: "Geri çekilme",
  BREAKOUT: "Kırılım devamı",
  EDGE_LONG: "Kenar reddi (VAL)",
  EDGE_SHORT: "Kenar reddi (VAH)",
};

export interface Level {
  price: number;
  label: string;
  kind: "VAH" | "VAL" | "POC" | "PIVOT" | "HAVUZ" | "GÜN" | "DUVAR";
}

export interface Invalidation {
  price: number | null;
  text: string;
}

export interface Verdict {
  state: VerdictState;
  side: Side | null;
  setup: SetupKey | null;
  /** Tek satır: "GİR · Geri çekilme" */
  headline: string;
  /** En fazla 3 madde */
  why: string[];
  invalidation: Invalidation;
  /** Tetik satırı (5m) */
  trigger: string | null;
  plan: { entry: number; stop: number; t1: number | null; t1Label: string | null; t2: number | null; rr: number | null } | null;
  /** Uyarılar (yalnızca sarı) */
  warnings: string[];
  /** Sesli uyarı gerektiren yeni durum */
  alert: boolean;
}

export interface ScoreParts {
  pos: number;
  slope: number;
  struct: number;
  vol: number;
  total: number;
}

export interface TfBar {
  time: number;
  end: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  buy: number;
  ymd: string;
  g0: number;
  g1: number;
}

export interface TfSeries {
  minutes: number;
  bars: TfBar[];
  ema: (number | null)[];
  atr: (number | null)[];
  byEndG: Map<number, number>;
}

export interface Prep {
  nowSec: number;
  rth: Bar[];
  ymd: string[];
  vwap: number[];
  atr5: (number | null)[];
  buy: number[];
  days: string[];
  dayRange: Map<string, { s: number; e: number }>;
  premarket: Map<string, { high: number | null; low: number | null }>;
  tf15: TfSeries;
  tf30: TfSeries;
  tf60: TfSeries;
  memo: Map<string, ScoreParts>;
}

export interface GradedEvent {
  idx: number;
  /** Mumun başlangıcı */
  time: number;
  /** Mumun kapanışı (olayın bilindiği an) */
  end: number;
  clock: string;
  kind: FlowEvent["kind"];
  label: string;
  bias: 1 | -1;
  price: number;
  levelKey: string;
  levelText: string;
  score: number;
  grade: Grade;
  why: string[];
  effect: string;
  invalidation: number;
  atr: number | null;
  outcomes: { min: number; state: "✓" | "✗" | "…" }[];
}

export interface Trade {
  ymd: string;
  setup: SetupKey;
  side: Side;
  regime: RegimeKind;
  entryEnd: number;
  entry: number;
  stop0: number;
  t1: number;
  t2: number | null;
  exitEnd: number | null;
  exit: number | null;
  exitReason: string | null;
  t1Hit: boolean;
  /** Toplam R (kısmi kapanış dahil) — açıksa null */
  r: number | null;
}

interface Position {
  trade: Trade;
  risk: number;
  stop: number;
  mfe: number;
  t1Hit: boolean;
  noAdd: boolean;
  tightened: boolean;
}

export interface StepLite {
  end: number;
  state: VerdictState;
  side: Side | null;
  regime: RegimeKind;
  close: number;
}

export interface DayRun {
  ymd: string;
  bars: Bar[];
  steps: StepLite[];
  trades: Trade[];
  events: GradedEvent[];
  last: StepFull | null;
}

/** Son adımın tam ayrıntısı (kanıt paneli için) */
export interface StepFull {
  i: number;
  end: number;
  close: number;
  vwap: number;
  atr: number | null;
  ema15: number | null;
  regime: RegimeKind;
  regimeSince: number;
  candidate: RegimeKind;
  pendingKind: RegimeKind | null;
  pendingCount: number;
  inputs: {
    cross2h: number;
    insideRatio: number | null;
    insideBars: number;
    acceptance: "UP" | "DOWN" | null;
    htfBias: number | null;
    rangeVsAdr: number | null;
    orBreak: "UP" | "DOWN" | null;
  };
  score15: ScoreParts | null;
  score30: ScoreParts | null;
  score60: ScoreParts | null;
  dir15: 1 | -1 | 0;
  profile: { poc: number; vah: number; val: number } | null;
  dayHigh: number;
  dayLow: number;
  or: { high: number; low: number } | null;
  levels: Level[];
  verdict: Verdict;
  position: Position | null;
  cooldownActive: boolean;
}

// ═══════════════════════════════════════════════════════════════════
// Küçük yardımcılar
// ═══════════════════════════════════════════════════════════════════

const fmt = (n: number) => n.toFixed(2);
const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const a = xs.slice().sort((x, y) => x - y);
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};
const clvOf = (b: Bar) => {
  const rg = b.high - b.low;
  return rg > 0 ? (b.close - b.low) / rg : 0.5;
};
const minutesOf = (t: number) => nyParts(t).minutes;
const OPEN_MIN = 9 * 60 + 30;
const CLOSE_MIN = 16 * 60;

// ═══════════════════════════════════════════════════════════════════
// Hazırlık: kapanmış RTH 5m mumları, VWAP, ATR, 15m/30m/1h seriler
// ═══════════════════════════════════════════════════════════════════

function buildTf(rth: Bar[], ymd: string[], buy: number[], minutes: number): TfSeries {
  const bars: TfBar[] = [];
  const byEndG = new Map<number, number>();
  let s = 0;
  while (s < rth.length) {
    let e = s;
    while (e < rth.length && ymd[e] === ymd[s]) e++;
    // gün [s,e) — kovalara böl
    const groups = new Map<number, number[]>();
    for (let g = s; g < e; g++) {
      const k = Math.floor((minutesOf(rth[g].time) - OPEN_MIN) / minutes);
      (groups.get(k) ?? groups.set(k, []).get(k)!).push(g);
    }
    for (const [k, idxs] of Array.from(groups.entries()).sort((a, b) => a[0] - b[0])) {
      const startMin = OPEN_MIN + k * minutes;
      const endMin = Math.min(startMin + minutes, CLOSE_MIN);
      const need = (endMin - startMin) / 5;
      const last = idxs[idxs.length - 1];
      if (idxs.length !== need || minutesOf(rth[last].time) + 5 !== endMin) continue;
      const comp = idxs.map((g) => rth[g]);
      const tb: TfBar = {
        time: comp[0].time,
        end: comp[comp.length - 1].time + 300,
        open: comp[0].open,
        high: Math.max(...comp.map((b) => b.high)),
        low: Math.min(...comp.map((b) => b.low)),
        close: comp[comp.length - 1].close,
        volume: comp.reduce((a, b) => a + (b.volume || 0), 0),
        buy: idxs.reduce((a, g) => a + buy[g], 0),
        ymd: ymd[s],
        g0: idxs[0],
        g1: last,
      };
      byEndG.set(last, bars.length);
      bars.push(tb);
    }
    s = e;
  }
  const asBars: Bar[] = bars.map((b) => ({ time: b.time, open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume }));
  return {
    minutes,
    bars,
    ema: ema(asBars.map((b) => b.close), CFG.score.emaPeriod),
    atr: atr(asBars, CFG.score.atrPeriod),
    byEndG,
  };
}

/** Tüm 5m geçmişten (premarket/AH dahil) hazırlık. Yalnızca KAPANMIŞ mumlar alınır. */
export function prepare(m5All: Bar[], nowSec: number): Prep {
  const closed = m5All.filter((b) => b.time + 300 <= nowSec);
  const premarket = new Map<string, { high: number | null; low: number | null }>();
  for (const b of closed) {
    const p = nyParts(b.time);
    if (p.minutes >= 4 * 60 && p.minutes < OPEN_MIN) {
      const x = premarket.get(p.ymd) ?? { high: null, low: null };
      x.high = x.high == null ? b.high : Math.max(x.high, b.high);
      x.low = x.low == null ? b.low : Math.min(x.low, b.low);
      premarket.set(p.ymd, x);
    }
  }
  const rth = closed.filter(isRthBar);
  const ymd = rth.map((b) => nyParts(b.time).ymd);
  const buy = rth.map((b) => (b.volume || 0) * clvOf(b));
  const vwap: number[] = [];
  const dayRange = new Map<string, { s: number; e: number }>();
  const days: string[] = [];
  let pv = 0, vv = 0;
  for (let i = 0; i < rth.length; i++) {
    if (i === 0 || ymd[i] !== ymd[i - 1]) {
      pv = 0; vv = 0;
      dayRange.set(ymd[i], { s: i, e: i + 1 });
      days.push(ymd[i]);
    } else dayRange.get(ymd[i])!.e = i + 1;
    const b = rth[i];
    const v = b.volume || 0;
    pv += ((b.high + b.low + b.close) / 3) * v;
    vv += v;
    vwap.push(vv > 0 ? pv / vv : b.close);
  }
  return {
    nowSec, rth, ymd, vwap,
    atr5: atr(rth, CFG.score.atrPeriod),
    buy, days, dayRange, premarket,
    tf15: buildTf(rth, ymd, buy, 15),
    tf30: buildTf(rth, ymd, buy, 30),
    tf60: buildTf(rth, ymd, buy, 60),
    memo: new Map(),
  };
}

// ═══════════════════════════════════════════════════════════════════
// L2 — sadeleştirilmiş yön skoru (−4…+4), 4 bağımsız bileşen
// ═══════════════════════════════════════════════════════════════════

export function tfScore(prep: Prep, ts: TfSeries, k: number): ScoreParts {
  const key = `${ts.minutes}:${k}`;
  const hit = prep.memo.get(key);
  if (hit) return hit;
  const cfg = CFG.score;
  const bar = ts.bars[k];
  const a5 = prep.atr5[bar.g1];
  const vw = prep.vwap[bar.g1];
  const em = ts.ema[k];

  // Konum: VWAP ve EMA20 aynı tarafta VE ölü bölgenin dışında
  let pos = 0;
  if (a5 != null && em != null && Math.abs(bar.close - vw) >= cfg.deadZoneAtr * a5) {
    if (bar.close > vw && bar.close > em) pos = 1;
    else if (bar.close < vw && bar.close < em) pos = -1;
  }
  // Eğim: EMA20'nin son N mumluk değişimi / ATR
  let slope = 0;
  const emPrev = k - cfg.slopeBars >= 0 ? ts.ema[k - cfg.slopeBars] : null;
  const atrTf = ts.atr[k];
  if (em != null && emPrev != null && atrTf != null && atrTf > 0) {
    const x = (em - emPrev) / atrTf;
    if (Math.abs(x) >= cfg.slopeMinAtr) slope = x > 0 ? 1 : -1;
  }
  // Yapı: aynı günün son 3 mumu
  let struct = 0;
  if (k >= 2 && ts.bars[k - 2].ymd === bar.ymd) {
    const [a, b, c] = [ts.bars[k - 2], ts.bars[k - 1], bar];
    if (c.high > b.high && b.high > a.high && c.low > b.low && b.low > a.low) struct = 1;
    else if (c.high < b.high && b.high < a.high && c.low < b.low && b.low < a.low) struct = -1;
  }
  // Hacim: alıcı/satıcı payı ≥ %60 VE son mum hacmi ≥ 1,5× ortalama
  let vol = 0;
  {
    const prior = ts.bars.slice(Math.max(0, k - cfg.volume.avgBars), k).map((x) => x.volume);
    const avg = median(prior);
    const ratio = avg > 0 ? bar.volume / avg : 0;
    const share = bar.volume > 0 ? bar.buy / bar.volume : 0.5;
    if (ratio >= cfg.volume.minRatio) {
      if (share >= cfg.volume.minShare) vol = 1;
      else if (1 - share >= cfg.volume.minShare) vol = -1;
    }
  }
  const out = { pos, slope, struct, vol, total: pos + slope + struct + vol };
  prep.memo.set(key, out);
  return out;
}

// ═══════════════════════════════════════════════════════════════════
// Seviye evreni (tek birleşik liste)
// ═══════════════════════════════════════════════════════════════════

function prevDayOf(prep: Prep, ymd: string): { base: PivotBase; high: number; low: number } | null {
  const di = prep.days.indexOf(ymd);
  if (di <= 0) return null;
  const pd = prep.days[di - 1];
  const r = prep.dayRange.get(pd)!;
  if (r.e - r.s < 60) return null;
  const bars = prep.rth.slice(r.s, r.e);
  const H = Math.max(...bars.map((b) => b.high));
  const L = Math.min(...bars.map((b) => b.low));
  const C = bars[bars.length - 1].close;
  return { base: classicPivots(H, L, C, pd), high: H, low: L };
}

function adrOf(prep: Prep, ymd: string): number | null {
  const di = prep.days.indexOf(ymd);
  const from = Math.max(0, di - CFG.regime.adrDays);
  const rs: number[] = [];
  for (let d = from; d < di; d++) {
    const r = prep.dayRange.get(prep.days[d])!;
    if (r.e - r.s < 60) continue;
    const bars = prep.rth.slice(r.s, r.e);
    rs.push(Math.max(...bars.map((b) => b.high)) - Math.min(...bars.map((b) => b.low)));
  }
  return rs.length >= 5 ? rs.reduce((a, x) => a + x, 0) / rs.length : null;
}

// ═══════════════════════════════════════════════════════════════════
// Olay kalitesi (A/B/C)
// ═══════════════════════════════════════════════════════════════════

const KIND_LABEL: Record<FlowEvent["kind"], string> = {
  SWEEP_LOW: "DİP SÜPÜRME",
  SWEEP_HIGH: "TEPE SÜPÜRME",
  PUSH_UP: "KURUMSAL İTKİ",
  PUSH_DOWN: "KURUMSAL İTKİ",
  ABSORB_BUY: "EMİLİM (dipte)",
  ABSORB_SELL: "EMİLİM (tepede)",
  DIV_BULL: "POZİTİF UYUMSUZLUK",
  DIV_BEAR: "NEGATİF UYUMSUZLUK",
};

const isSweep = (k: FlowEvent["kind"]) => k === "SWEEP_LOW" || k === "SWEEP_HIGH";
const isPush = (k: FlowEvent["kind"]) => k === "PUSH_UP" || k === "PUSH_DOWN";

function levelKeyOf(price: number, levels: Level[], tol: number): { key: string; text: string } {
  let best: Level | null = null;
  for (const l of levels) {
    const d = Math.abs(l.price - price);
    if (d <= tol && (!best || d < Math.abs(best.price - price))) best = l;
  }
  return best ? { key: best.kind, text: `${best.label} ${fmt(best.price)}` } : { key: "—", text: "belirgin seviye yok" };
}

// ═══════════════════════════════════════════════════════════════════
// Hedef seçimi (T1/T2) ve R/R
// ═══════════════════════════════════════════════════════════════════

interface Targets { t1: Level | null; t2: Level | null; rr: number | null }

function clusterLevels(levels: Level[], tol: number): Level[] {
  const sorted = levels.slice().sort((a, b) => a.price - b.price);
  const out: Level[] = [];
  for (const l of sorted) {
    const prev = out[out.length - 1];
    if (prev && Math.abs(l.price - prev.price) <= tol) {
      if (!prev.label.includes(l.label)) prev.label = `${prev.label} + ${l.label}`;
    } else out.push({ ...l });
  }
  return out;
}

function pickTargets(
  side: Side, entry: number, stop: number, levels: Level[],
  atrV: number, yatay: boolean, profile: { poc: number; vah: number; val: number }
): Targets {
  const dir = side === "LONG" ? 1 : -1;
  const risk = Math.abs(entry - stop);
  if (!(risk > 0)) return { t1: null, t2: null, rr: null };
  if (yatay) {
    const poc: Level = { price: profile.poc, label: "POC", kind: "POC" };
    const opp: Level = side === "LONG" ? { price: profile.vah, label: "VAH", kind: "VAH" } : { price: profile.val, label: "VAL", kind: "VAL" };
    const t1 = (poc.price - entry) * dir > 0 ? poc : null;
    const t2 = t1 && (opp.price - t1.price) * dir > 0 ? opp : null;
    return { t1, t2, rr: t1 ? Math.abs(t1.price - entry) / risk : null };
  }
  const beyond = clusterLevels(levels, CFG.setup.levelClusterAtr * atrV)
    .filter((l) => (l.price - entry) * dir > 0.02)
    .sort((a, b) => (a.price - b.price) * dir);
  if (!beyond.length) return { t1: null, t2: null, rr: null };
  let ti = 0;
  // "En az 1R uzakta; daha yakındaysa bir sonraki seviye"
  if (Math.abs(beyond[0].price - entry) < CFG.setup.t1MinR * risk && beyond.length > 1) ti = 1;
  const t1 = beyond[ti];
  return { t1, t2: beyond[ti + 1] ?? null, rr: Math.abs(t1.price - entry) / risk };
}

// ═══════════════════════════════════════════════════════════════════
// Günü oynat
// ═══════════════════════════════════════════════════════════════════

export interface RunOpts {
  options?: OptionLevels | null;
}

function emptyVerdict(state: VerdictState, headline: string, why: string[], inv: Invalidation): Verdict {
  return { state, side: null, setup: null, headline, why: why.slice(0, 3), invalidation: inv, trigger: null, plan: null, warnings: [], alert: false };
}

export function runDay(prep: Prep, ymd: string, opts: RunOpts = {}): DayRun {
  const range = prep.dayRange.get(ymd);
  const empty: DayRun = { ymd, bars: [], steps: [], trades: [], events: [], last: null };
  if (!range) return empty;
  const bars = prep.rth.slice(range.s, range.e);
  const n = bars.length;
  const g0 = range.s;
  const cfg = CFG;

  const pdy = prevDayOf(prep, ymd);
  const adr = adrOf(prep, ymd);
  const pm = prep.premarket.get(ymd) ?? { high: null, low: null };
  const optList = opts.options ? optionLevelList(opts.options) : [];

  // Olaylar: bir geçişte (flowRead) — olay üretimi nedensel (yalnızca geçmiş mumlar)
  const dayVwap = prep.vwap.slice(g0, g0 + n);
  const fr = flowRead({
    m1: prep.rth.slice(0, range.e),
    ymd,
    s5: { bars, vwap: dayVwap },
    price: null,
    premarket: pm,
  });
  const barIdxByTime = new Map(bars.map((b, i) => [b.time, i]));
  const rawByIdx = new Map<number, FlowEvent[]>();
  for (const e of fr?.events ?? []) {
    const i = barIdxByTime.get(e.time);
    if (i == null) continue;
    (rawByIdx.get(i) ?? rawByIdx.set(i, []).get(i)!).push(e);
  }
  const deltaAt = (i: number) => (fr ? fr.deltaSeries[i]?.value ?? 0 : 0);
  const poolDefs = (fr?.pools ?? []).map((p) => ({ price: p.price, side: p.side, label: p.label, from: p.from }));
  const sweptBy = (p: (typeof poolDefs)[number], i: number) => {
    for (let j = 0; j <= i; j++) {
      if (bars[j].time < p.from) continue;
      if (p.side === "BUY" && bars[j].high > p.price + 0.02) return true;
      if (p.side === "SELL" && bars[j].low < p.price - 0.02) return true;
    }
    return false;
  };

  // — durum —
  let regime: RegimeKind = "AÇILIŞ";
  let regimeSince = bars[0].time;
  let candidate: RegimeKind = "AÇILIŞ";
  let prevCand: RegimeKind | null = null;
  let pendingKind: RegimeKind | null = null;
  let pendingCount = 0;
  let trendExitCount = 0;
  let upStreak = 0, dnStreak = 0, dir15: 1 | -1 | 0 = 0;
  const ps: { pos: Position | null } = { pos: null };
  let cooldownUntil = -1;
  let holdUntil = -1;
  const prepSeen: Partial<Record<SetupKey, number>> = {};
  let exitShownUntil = -1;
  let lastExitVerdict: Verdict | null = null;
  const events: GradedEvent[] = [];
  const trades: Trade[] = [];
  const steps: StepLite[] = [];
  let lastProfile: { poc: number; vah: number; val: number } | null = null;
  let lastFull: StepFull | null = null;
  let acceptance: "UP" | "DOWN" | null = null;
  let orBreak: "UP" | "DOWN" | null = null;
  let cross2h = 0, insideRatio: number | null = null, insideBars = 0, htfBias: number | null = null;
  let s15: ScoreParts | null = null, s30: ScoreParts | null = null, s60: ScoreParts | null = null;
  let orBars: Bar[] = [];

  for (let i = 0; i < n; i++) {
    const b = bars[i];
    const g = g0 + i;
    const end = b.time + 300;
    const endMin = minutesOf(b.time) + 5;
    const vw = prep.vwap[g];
    const atrV = prep.atr5[g];
    const profile = profileOf(bars.slice(0, i + 1));
    const dayHighBefore = i > 0 ? Math.max(...bars.slice(0, i).map((x) => x.high)) : b.high;
    const dayLowBefore = i > 0 ? Math.min(...bars.slice(0, i).map((x) => x.low)) : b.low;
    const dayHigh = Math.max(dayHighBefore, b.high);
    const dayLow = Math.min(dayLowBefore, b.low);
    if (endMin <= cfg.time.openEndMin) orBars = bars.slice(0, i + 1);
    const orRange = orBars.length >= 6 ? { high: Math.max(...orBars.map((x) => x.high)), low: Math.min(...orBars.map((x) => x.low)) } : null;

    // ── 15m kapanışı: yön + rejim ───────────────────────────────
    const k15 = prep.tf15.byEndG.get(g);
    if (k15 != null) {
      s15 = tfScore(prep, prep.tf15, k15);
      const sc = s15.total;
      const th = cfg.score.dirThreshold;
      upStreak = sc >= th ? upStreak + 1 : 0;
      dnStreak = sc <= -th ? dnStreak + 1 : 0;
      dir15 = upStreak >= cfg.score.dirCloses ? 1 : dnStreak >= cfg.score.dirCloses ? -1 : 0;

      const k30 = prep.tf30.byEndG.get(g);
      const k60 = prep.tf60.byEndG.get(g);
      // Bugünün son kapanmış 30m / 1h mumu
      const lastOfDay = (ts: TfSeries) => {
        for (let q = ts.bars.length - 1; q >= 0 && ts.bars[q].ymd === ymd; q--) if (ts.bars[q].g1 <= g) return q;
        return -1;
      };
      const q30 = k30 ?? lastOfDay(prep.tf30);
      const q60 = k60 ?? lastOfDay(prep.tf60);
      s30 = q30 >= 0 ? tfScore(prep, prep.tf30, q30) : null;
      s60 = q60 >= 0 ? tfScore(prep, prep.tf60, q60) : null;
      const hs = [s30, s60].filter((x): x is ScoreParts => !!x).map((x) => x.total);
      htfBias = hs.length ? hs.reduce((a, x) => a + x, 0) / hs.length : null;

      // girdiler
      const from = Math.max(0, i - cfg.regime.crossWindowBars5m + 1);
      cross2h = 0;
      {
        let prev = 0;
        for (let j = from; j <= i; j++) {
          const s = Math.sign(bars[j].close - prep.vwap[g0 + j]);
          if (s && prev && s !== prev) cross2h++;
          if (s) prev = s;
        }
      }
      // 15m kapanışlarının bugünkü listesi
      const today15: TfBar[] = [];
      for (let q = k15; q >= 0 && prep.tf15.bars[q].ymd === ymd; q--) today15.unshift(prep.tf15.bars[q]);
      const win = today15.slice(-cfg.regime.insideWindowBars15m);
      insideBars = win.length;
      insideRatio = profile && win.length ? win.filter((x) => x.close >= profile.val && x.close <= profile.vah).length / win.length : null;
      acceptance = null;
      if (profile && today15.length >= cfg.regime.acceptanceCloses) {
        const lastN = today15.slice(-cfg.regime.acceptanceCloses);
        if (lastN.every((x) => x.close > profile.vah)) acceptance = "UP";
        else if (lastN.every((x) => x.close < profile.val)) acceptance = "DOWN";
      }
      orBreak = null;
      if (orRange && endMin > cfg.time.openEndMin) {
        const lastN = today15.filter((x) => minutesOf(x.time) >= cfg.time.openEndMin).slice(-cfg.regime.orBreakCloses);
        if (lastN.length === cfg.regime.orBreakCloses) {
          if (lastN.every((x) => x.close > orRange.high)) orBreak = "UP";
          else if (lastN.every((x) => x.close < orRange.low)) orBreak = "DOWN";
        }
      }

      // sınıflandırma
      const R = cfg.regime;
      const up = acceptance === "UP" && cross2h <= R.trend.maxCrosses && htfBias != null && htfBias >= R.trend.minHtfBias;
      const dn = acceptance === "DOWN" && cross2h <= R.trend.maxCrosses && htfBias != null && htfBias <= -R.trend.minHtfBias;
      const insideOk = insideBars >= R.insideMinBars15m && insideRatio != null && insideRatio >= R.range.minInsideRatio && Math.abs(sc) <= R.range.maxAbsScore15m;
      const rg = cross2h >= R.range.minCrosses || insideOk;
      const cnt = (up ? 1 : 0) + (dn ? 1 : 0) + (rg ? 1 : 0);
      candidate = cnt === 1 ? (up ? "TREND_UP" : dn ? "TREND_DOWN" : "YATAY") : "GEÇİŞ";

      // histerezis
      if (endMin <= cfg.time.openEndMin) {
        prevCand = candidate;
      } else if (regime === "AÇILIŞ") {
        regime = prevCand === candidate ? candidate : "GEÇİŞ";
        regimeSince = end;
        pendingKind = null; pendingCount = 0; trendExitCount = 0;
      } else if (regime === "TREND_UP" || regime === "TREND_DOWN") {
        if (candidate !== regime) {
          trendExitCount++;
          if (trendExitCount >= R.hysteresis.trendExitCloses) {
            regime = "GEÇİŞ"; regimeSince = end; trendExitCount = 0; pendingKind = null; pendingCount = 0;
          }
        } else trendExitCount = 0;
      } else if (candidate === regime) {
        pendingKind = null; pendingCount = 0;
      } else {
        if (candidate === pendingKind) pendingCount++;
        else { pendingKind = candidate; pendingCount = 1; }
        if (pendingCount >= R.hysteresis.confirmCloses && end - regimeSince >= R.hysteresis.minDwellMin * 60) {
          regime = candidate; regimeSince = end; pendingKind = null; pendingCount = 0;
        }
      }
    }
    const ema15 = (() => {
      // son kapanmış 15m'nin EMA20'si
      let q = -1;
      for (let x = prep.tf15.bars.length - 1; x >= 0; x--) if (prep.tf15.bars[x].g1 <= g) { q = x; break; }
      return q >= 0 ? prep.tf15.ema[q] : null;
    })();
    const lastClosed15 = (() => {
      for (let x = prep.tf15.bars.length - 1; x >= 0; x--) if (prep.tf15.bars[x].g1 <= g) return prep.tf15.bars[x];
      return null;
    })();

    // ── seviye evreni ──────────────────────────────────────────
    const levels: Level[] = [];
    if (profile) {
      levels.push({ price: profile.vah, label: "VAH", kind: "VAH" }, { price: profile.val, label: "VAL", kind: "VAL" }, { price: profile.poc, label: "POC", kind: "POC" });
    }
    if (pdy) for (const k of PIVOT_ORDER) levels.push({ price: pdy.base.levels[k], label: `Pivot ${k}`, kind: "PIVOT" });
    if (i > 0) levels.push({ price: dayHighBefore, label: "Gün tepesi", kind: "GÜN" }, { price: dayLowBefore, label: "Gün dibi", kind: "GÜN" });
    const unsweptPools: Level[] = [];
    for (const p of poolDefs) {
      if (bars[i].time < p.from) continue;
      const lv: Level = { price: p.price, label: p.label, kind: "HAVUZ" };
      levels.push(lv); // yakınlık için tüm havuzlar
      if (!sweptBy(p, i)) unsweptPools.push(lv);
    }
    for (const o of optList) levels.push({ price: o.price, label: o.label, kind: "DUVAR" });
    // hedef evreni: süpürülmüş havuzlar çıkar
    const targetLevels = levels.filter((l) => l.kind !== "HAVUZ").concat(unsweptPools);

    // ── olaylar (bu mum) ───────────────────────────────────────
    const tolEvt = (atrV ?? 0) * cfg.events.levelProximityAtr;
    const newRaw: FlowEvent[] = (rawByIdx.get(i) ?? []).slice();
    // kenar süpürmeleri: VAL/VAH (önceki adımın profili) — kenar kurulumunun tetik parçası
    if (lastProfile) {
      const has = (k: FlowEvent["kind"]) => newRaw.some((e) => e.kind === k && Math.abs(e.price - (k === "SWEEP_LOW" ? lastProfile!.val : lastProfile!.vah)) < 0.15);
      if (b.low < lastProfile.val - 0.02 && b.close > lastProfile.val && !has("SWEEP_LOW")) {
        newRaw.push({ time: b.time, clock: nyClock(b.time), kind: "SWEEP_LOW", bias: 1, price: lastProfile.val, text: "VAL altı süpürüldü, üstünde kapandı" });
      }
      if (b.high > lastProfile.vah + 0.02 && b.close < lastProfile.vah && !has("SWEEP_HIGH")) {
        newRaw.push({ time: b.time, clock: nyClock(b.time), kind: "SWEEP_HIGH", bias: -1, price: lastProfile.vah, text: "VAH üstü süpürüldü, altında kapandı" });
      }
    }
    const newEvents: GradedEvent[] = [];
    for (const e of newRaw) {
      const prior = bars.slice(Math.max(0, i - cfg.events.volAvgBars), i).map((x) => x.volume || 0);
      const vr = median(prior) > 0 ? (b.volume || 0) / median(prior) : 0;
      const lk = levelKeyOf(e.price, levels, tolEvt);
      const why: string[] = [];
      let score = 0;
      if (lk.key !== "—") { score++; why.push(`seviyede: ${lk.text}`); }
      if (vr >= cfg.events.volRatio) { score++; why.push(`hacim ${vr.toFixed(1)}×`); }
      const rg = b.high - b.low;
      const closeOk = isSweep(e.kind) ? true : isPush(e.kind) ? rg > 0 && Math.abs(b.close - b.open) / rg >= cfg.events.pushBodyFrac : e.bias > 0 ? clvOf(b) >= 0.5 : clvOf(b) <= 0.5;
      if (closeOk) { score++; why.push(isSweep(e.kind) ? "seviyenin doğru tarafına döndü" : isPush(e.kind) ? "gövde ≥ %50" : "kapanış lehine"); }
      // rejim uyumu
      let regOk = false;
      if (regime === "YATAY" && isSweep(e.kind) && profile) {
        regOk = (e.kind === "SWEEP_LOW" && e.price <= profile.val + 0.3 * (atrV ?? 0)) || (e.kind === "SWEEP_HIGH" && e.price >= profile.vah - 0.3 * (atrV ?? 0));
      } else if (regime === "TREND_UP" || regime === "TREND_DOWN") {
        const d = regime === "TREND_UP" ? 1 : -1;
        const pullback = i >= 4 && (bars[i - 1].close - bars[i - 4].close) * d < 0;
        regOk = e.bias === d && ((isPush(e.kind) && pullback) || isSweep(e.kind));
      }
      if (regOk) { score++; why.push("rejimle uyumlu"); }
      // kümülatif delta
      const dBars = cfg.events.deltaBars;
      const dDelta = deltaAt(i) - (i - dBars >= 0 ? deltaAt(i - dBars) : 0);
      const dOk = e.kind === "DIV_BULL" || e.kind === "DIV_BEAR" || Math.sign(dDelta) === e.bias;
      if (dOk) { score++; why.push("kümülatif delta aynı yönde"); }
      const grade: Grade = score >= cfg.events.gradeA ? "A" : score >= cfg.events.gradeB ? "B" : "C";
      const inv = e.bias > 0 ? Math.min(b.low, e.price) : Math.max(b.high, e.price);
      const ge: GradedEvent = {
        idx: i, time: b.time, end, clock: nyClock(end), kind: e.kind, label: KIND_LABEL[e.kind], bias: e.bias, price: r2(e.price),
        levelKey: lk.key, levelText: lk.text, score, grade, why,
        effect: isSweep(e.kind) ? (e.bias > 0 ? "yukarı dönüş" : "aşağı dönüş") : isPush(e.kind) ? (e.bias > 0 ? "yukarı devam" : "aşağı devam") : e.bias > 0 ? "yukarı tepki" : "aşağı tepki",
        invalidation: r2(inv), atr: atrV, outcomes: [],
      };
      newEvents.push(ge);
      events.push(ge);
    }
    if (profile) lastProfile = profile;
    const aEvents = newEvents.filter((e) => e.grade === "A");

    // ── doğrulama / pozisyon yönetimi ──────────────────────────
    let verdict: Verdict | null = null;
    const warnings: string[] = [];
    let alert = false;
    let exitedNow = false;

    const lows2 = bars.slice(Math.max(0, i - cfg.manage.tightStopBars + 1), i + 1);
    const tightLong = Math.min(...lows2.map((x) => x.low));
    const tightShort = Math.max(...lows2.map((x) => x.high));

    if (ps.pos) {
      const P = ps.pos;
      const long = P.trade.side === "LONG";
      const dir = long ? 1 : -1;
      const reasons: string[] = [];
      let exitReason: string | null = null;
      let exitPrice = b.close;

      // rejim düştü → sıkı stop, ekleme yok
      const trendNow = regime === "TREND_UP" || regime === "TREND_DOWN";
      if (P.trade.regime.startsWith("TREND") && regime !== P.trade.regime && !P.noAdd) {
        P.noAdd = true;
        const ts = long ? tightLong : tightShort;
        if ((ts - P.stop) * dir > 0) P.stop = ts;
        P.tightened = true;
        warnings.push(`Rejim ${regimeText(regime)}'e düştü: stop sıkı stopa çekildi, yeni ekleme yok`);
      }
      void trendNow;
      // karşı A sınıfı olay → sıkı stop + sesli uyarı
      const counter = aEvents.find((e) => e.bias === -dir);
      if (counter) {
        const ts = long ? tightLong : tightShort;
        if ((ts - P.stop) * dir > 0) P.stop = ts;
        P.tightened = true;
        alert = true;
        warnings.push(`A sınıfı karşı olay (${counter.label}): stop sıkı stopa çekildi`);
      }
      // MFE
      const fav = (long ? b.high - P.trade.entry : P.trade.entry - b.low);
      P.mfe = Math.max(P.mfe, fav);

      // zaman kuralı
      if (cfg.time.forceExitEnabled && endMin >= cfg.time.forceExitMin) {
        exitReason = "zaman: seans sonu kapanışı";
      }
      // stop (kapanış bazlı)
      if (!exitReason) {
        const hit = cfg.manage.stopOnClose ? (b.close - P.stop) * dir <= 0 : (long ? b.low <= P.stop : b.high >= P.stop);
        if (hit) { exitReason = P.t1Hit ? "stop (başabaş/iz süren stop)" : "stop"; if (!cfg.manage.stopOnClose) exitPrice = P.stop; }
      }
      // MFE koruması (T1'e varmadan)
      if (!exitReason && !P.t1Hit && P.mfe >= cfg.manage.mfeMinR * P.risk) {
        const cur = (b.close - P.trade.entry) * dir;
        if (P.mfe - cur >= cfg.manage.mfeGiveBack * P.mfe) exitReason = "MFE koruması";
      }
      // T1
      if (!exitReason && !P.t1Hit && (long ? b.high >= P.trade.t1 : b.low <= P.trade.t1)) {
        P.t1Hit = true;
        P.trade.t1Hit = true;
        if ((P.trade.entry - P.stop) * dir > 0) P.stop = P.trade.entry; // başabaş
        reasons.push(`T1 ${fmt(P.trade.t1)} alındı: %${Math.round(cfg.manage.t1ClosePct * 100)} kapandı, stop girişe çekildi`);
      }
      // T1 sonrası: Trend Stop Bölgesi (yalnızca lehte)
      if (!exitReason && P.t1Hit && lastClosed15) {
        const tz = long ? lastClosed15.low - cfg.manage.trendStopAtr * (atrV ?? 0) : lastClosed15.high + cfg.manage.trendStopAtr * (atrV ?? 0);
        if ((tz - P.stop) * dir > 0) P.stop = tz;
      }
      // T2 (yatayda kalan kısmın hedefi)
      if (!exitReason && P.t1Hit && P.trade.t2 != null && P.trade.regime === "YATAY" && (long ? b.high >= P.trade.t2 : b.low <= P.trade.t2)) {
        exitReason = "T2 (karşı kenar)";
        exitPrice = P.trade.t2;
      }

      if (exitReason) {
        const t = P.trade;
        t.exitEnd = end;
        t.exit = r2(exitPrice);
        t.exitReason = exitReason;
        const legT1 = P.t1Hit ? (t.t1 - t.entry) * dir : 0;
        const legRest = (exitPrice - t.entry) * dir;
        const pct = P.t1Hit ? cfg.manage.t1ClosePct : 0;
        t.r = r2((pct * legT1 + (1 - pct) * legRest) / P.risk);
        trades.push(t);
        ps.pos = null;
        exitedNow = true;
        cooldownUntil = i + cfg.setup.cooldownBars;
        exitShownUntil = i + cfg.manage.exitShowBars - 1;
        lastExitVerdict = {
          ...emptyVerdict("ÇIK", `ÇIK · ${SETUP_LABEL[t.setup]}`, [`Neden: ${exitReason}`, `Sonuç: ${t.r! >= 0 ? "+" : ""}${t.r} R (giriş ${fmt(t.entry)} → çıkış ${fmt(t.exit)})`], { price: null, text: "Pozisyon kapandı; yeni kurulum için rejim ve tetik yeniden aranır" }),
          side: t.side, setup: t.setup, warnings, alert: true,
        };
        verdict = lastExitVerdict;
      } else {
        const t = P.trade;
        const cur = (b.close - t.entry) * dir;
        const why = reasons.slice();
        why.push(`Açık R: ${cur >= 0 ? "+" : ""}${(cur / P.risk).toFixed(2)} (giriş ${fmt(t.entry)})`);
        if (!P.t1Hit) why.push(`Hedef T1 ${fmt(t.t1)} · MFE ${(P.mfe / P.risk).toFixed(2)}R`);
        else why.push(`Kalan kısım: iz süren stop ${fmt(P.stop)}${t.t2 != null && t.regime === "YATAY" ? ` · T2 ${fmt(t.t2)}` : ""}`);
        verdict = {
          state: "YÖNET", side: t.side, setup: t.setup,
          headline: `YÖNET · ${SETUP_LABEL[t.setup]}`,
          why: why.slice(0, 3),
          invalidation: { price: r2(P.stop), text: `${fmt(P.stop)} altında 5m kapanış pozisyonu kapatır`.replace("altında", long ? "altında" : "üstünde") },
          trigger: null,
          plan: { entry: t.entry, stop: r2(P.stop), t1: t.t1, t1Label: null, t2: t.t2, rr: null },
          warnings, alert,
        };
      }
    }

    // ── pozisyon yoksa: kurulum aranır ─────────────────────────
    const canTrade = !ps.pos && !exitedNow;
    if (canTrade && !verdict) {
      verdict = decideFlat();
    } else if (!verdict && exitedNow) {
      verdict = lastExitVerdict;
    }
    if (!verdict) verdict = emptyVerdict("BEKLE", "BEKLE", ["Veri yok"], { price: null, text: "" });

    function decideFlat(): Verdict {
      const mk = (state: VerdictState, headline: string, why: string[], inv: Invalidation, extra: Partial<Verdict> = {}): Verdict => ({
        ...emptyVerdict(state, headline, why, inv), warnings: warnings.slice(), alert, ...extra,
      });
      const near = (() => {
        if (!profile) return null;
        return Math.abs(b.close - profile.vah) <= Math.abs(b.close - profile.val)
          ? { price: profile.vah, text: `${fmt(profile.vah)} (VAH) üstünde 2×15m kapanış rejimi değiştirir` }
          : { price: profile.val, text: `${fmt(profile.val)} (VAL) altında 2×15m kapanış rejimi değiştirir` };
      })();
      // BEKLE/GEÇİŞ'te olay yalnızca şeritte görünür (kararı etkilemez)

      if (lastExitVerdict && i <= exitShownUntil) return lastExitVerdict;
      if (endMin <= cfg.time.openEndMin || regime === "AÇILIŞ") {
        return mk("BEKLE", "BEKLE · açılış", [
          "09:30–10:00 açılış aralığı toplanıyor; bu pencerede işlem yok",
          orRange ? `Açılış aralığı ${fmt(orRange.low)} – ${fmt(orRange.high)}` : "Açılış aralığı oluşuyor",
        ], orRange ? { price: orRange.high, text: `Açılış aralığı ${fmt(orRange.low)}–${fmt(orRange.high)}; 10:00'da rejim belirlenir` } : { price: null, text: "10:00'da rejim belirlenir" });
      }
      if (endMin > cfg.time.lastEntryMin) {
        return mk("PAS", "PAS · seans sonu", [`${hm(cfg.time.lastEntryMin)} sonrası yeni giriş yok`], { price: null, text: "Yeni gün bekleniyor" });
      }
      if (regime === "GEÇİŞ") {
        const why = [
          "Rejim GEÇİŞ: kanıtlar tek bir mantığı seçtirmiyor",
          `VWAP kesişimi ${cross2h} · değer alanı içi ${insideRatio == null ? "—" : Math.round(insideRatio * 100) + "%"} · HTF ${htfBias == null ? "—" : fmt(htfBias)}`,
        ];
        if (pendingKind && pendingKind !== "GEÇİŞ") why.push(`${regimeText(pendingKind)} adayı ${pendingCount}/${cfg.regime.hysteresis.confirmCloses} kapanış`);
        return mk("BEKLE", "BEKLE · rejim geçişi", why, near ? { price: near.price, text: near.text } : { price: null, text: "Rejim netleşene kadar işlem yok" });
      }
      if (i <= cooldownUntil) {
        return mk("BEKLE", "BEKLE · bekleme", ["Çıkıştan sonra kısa bekleme (histerezis)"], near ?? { price: null, text: "" });
      }

      // rejime ait kurulumlar
      const long = regime === "TREND_UP";
      const trend = regime === "TREND_UP" || regime === "TREND_DOWN";
      if (trend) {
        const want: 1 | -1 = long ? 1 : -1;
        if (dir15 !== want) {
          return mk("BEKLE", "BEKLE · kanıtlar çatışıyor", [
            `Rejim ${regimeText(regime)} ama 15m yön ${dir15 === 0 ? "nötr" : dir15 > 0 ? "yukarı" : "aşağı"}`,
            `15m skor ${s15 ? signed(s15.total) : "—"} (eşik ±${cfg.score.dirThreshold}, ${cfg.score.dirCloses} kapanış)`,
          ], near ?? { price: null, text: "" });
        }
      }
      if (atrV == null || !profile) return mk("BEKLE", "BEKLE · veri", ["ATR/değer alanı için yeterli mum yok"], { price: null, text: "" });

      const A = atrV;
      const approach = cfg.setup.approachAtr * A;
      type Cand = { key: SetupKey; side: Side; prepOk: boolean; trig: boolean; trigText: string; stop: number; prepText: string; broke?: number };
      const cands: Cand[] = [];
      if (trend) {
        const side: Side = long ? "LONG" : "SHORT";
        const e20 = ema15;
        const nearVwap = Math.abs(b.close - vw) <= approach;
        const nearEma = e20 != null && Math.abs(b.close - e20) <= approach;
        const swing15 = lastClosed15 ? (long ? lastClosed15.low : lastClosed15.high) : (long ? dayLow : dayHigh);
        const stopPb = long ? swing15 - cfg.setup.stopAtr * A : swing15 + cfg.setup.stopAtr * A;
        const trigPb = long ? i > 0 && b.close > bars[i - 1].high && b.close > vw : i > 0 && b.close < bars[i - 1].low && b.close < vw;
        cands.push({
          key: "PULLBACK", side, prepOk: nearVwap || nearEma, trig: trigPb, stop: stopPb,
          prepText: `Fiyat ${nearVwap ? `VWAP (${fmt(vw)})` : `EMA20-15m (${e20 != null ? fmt(e20) : "—"})`} yakınında (≤${cfg.setup.approachAtr}×ATR)`,
          trigText: long ? "5m kapanış önceki 5m tepesinin ve VWAP'ın üstünde" : "5m kapanış önceki 5m dibinin ve VWAP'ın altında",
        });
        const lvl = long ? dayHighBefore : dayLowBefore;
        const nearLvl = i > 0 && Math.abs(lvl - b.close) <= approach;
        const volAvg = median(bars.slice(Math.max(0, i - cfg.setup.volAvgBars), i).map((x) => x.volume || 0));
        const volOk = volAvg > 0 && (b.volume || 0) >= cfg.setup.breakoutVolRatio * volAvg;
        const trigBo = i > 0 && (long ? b.close > lvl : b.close < lvl) && volOk;
        cands.push({
          key: "BREAKOUT", side, prepOk: nearLvl, trig: trigBo, broke: lvl,
          stop: long ? lvl - cfg.setup.stopAtr * A : lvl + cfg.setup.stopAtr * A,
          prepText: `Fiyat gün ${long ? "tepesine" : "dibine"} (${fmt(lvl)}) ≤${cfg.setup.approachAtr}×ATR`,
          trigText: `5m kapanış ${fmt(lvl)} ${long ? "üstünde" : "altında"}, hacim ≥ ${cfg.setup.breakoutVolRatio}×`,
        });
      } else if (regime === "YATAY") {
        const poolBelow = unsweptPools.concat(levels.filter((l) => l.kind === "HAVUZ")).filter((l) => l.price <= b.close + approach).sort((a, c) => c.price - a.price)[0];
        const poolAbove = unsweptPools.concat(levels.filter((l) => l.kind === "HAVUZ")).filter((l) => l.price >= b.close - approach).sort((a, c) => a.price - c.price)[0];
        const lookFrom = Math.max(0, i - cfg.setup.sweepLookbackBars + 1);
        const minGrade = cfg.setup.edgeTriggerMinGrade;
        const okGrade = (g: Grade) => (minGrade === "A" ? g === "A" : g === "A" || g === "B");
        const recent = (kind: FlowEvent["kind"]) => events.filter((e) => e.idx >= lookFrom && e.kind === kind && okGrade(e.grade));
        // uzun: VAL / alttaki havuz
        const nearVal = Math.abs(b.close - profile.val) <= approach || (poolBelow != null && Math.abs(b.close - poolBelow.price) <= approach);
        const sweepLo = recent("SWEEP_LOW");
        const lowSweep = sweepLo.length ? Math.min(...bars.slice(sweepLo[0].idx, i + 1).map((x) => x.low)) : null;
        cands.push({
          key: "EDGE_LONG", side: "LONG", prepOk: nearVal || sweepLo.length > 0, trig: sweepLo.length > 0 && b.close > profile.val && lowSweep != null,
          stop: (lowSweep ?? dayLow) - cfg.setup.stopAtr * A,
          prepText: `Fiyat VAL'a (${fmt(profile.val)}) veya alttaki havuza yakın`,
          trigText: `DİP SÜPÜRME (A) + 5m kapanış VAL (${fmt(profile.val)}) üstüne geri`,
        });
        const nearVah = Math.abs(b.close - profile.vah) <= approach || (poolAbove != null && Math.abs(b.close - poolAbove.price) <= approach);
        const sweepHi = recent("SWEEP_HIGH");
        const hiSweep = sweepHi.length ? Math.max(...bars.slice(sweepHi[0].idx, i + 1).map((x) => x.high)) : null;
        cands.push({
          key: "EDGE_SHORT", side: "SHORT", prepOk: nearVah || sweepHi.length > 0, trig: sweepHi.length > 0 && b.close < profile.vah && hiSweep != null,
          stop: (hiSweep ?? dayHigh) + cfg.setup.stopAtr * A,
          prepText: `Fiyat VAH'a (${fmt(profile.vah)}) veya üstteki havuza yakın`,
          trigText: `TEPE SÜPÜRME (A) + 5m kapanış VAH (${fmt(profile.vah)}) altına geri`,
        });
        // 15m yön, kenar işlemine açıkça karşıysa çelişki
        for (const c of cands) {
          const d = c.side === "LONG" ? 1 : -1;
          if (dir15 === -d && (c.prepOk || c.trig)) {
            return mk("BEKLE", "BEKLE · kanıtlar çatışıyor", [
              `YATAY kenar kurulumu var ama 15m yön ${dir15 > 0 ? "yukarı" : "aşağı"} (kenar işlemine ters)`,
              `15m skor ${s15 ? signed(s15.total) : "—"}`,
            ], near ?? { price: null, text: "" });
          }
        }
      }

      for (const c of cands) if (c.prepOk) prepSeen[c.key] = i;
      const lookback = cfg.setup.prepLookbackBars;
      const live = cands.filter((c) => c.prepOk || (prepSeen[c.key] != null && i - (prepSeen[c.key] as number) <= lookback));
      const trigd = live.find((c) => c.trig && prepSeen[c.key] != null && i - (prepSeen[c.key] as number) <= lookback);

      // karşı A olayı: kurulum 1 mum bekletilir
      const against = aEvents.find((e) => cands.some((c) => (c.side === "LONG" ? 1 : -1) === -e.bias && (live.includes(c))));
      if (against) {
        holdUntil = i + 1;
        warnings.push(`A sınıfı karşı olay (${against.label}): kurulum 1 mum bekletiliyor`);
      }

      if (trigd && holdUntil < i) {
        const c = trigd;
        const entry = b.close;
        const tg = pickTargets(c.side, entry, c.stop, targetLevels, A, regime === "YATAY", profile);
        const stopOk = c.side === "LONG" ? c.stop < entry : c.stop > entry;
        if (!stopOk || !tg.t1 || tg.rr == null) {
          return mk("PAS", `PAS · ${SETUP_LABEL[c.key]}`, [!stopOk ? "Stop giriş fiyatının doğru tarafında değil" : "Yönde anlamlı hedef seviye yok"], { price: null, text: "Tetik geçti; plan oluşmadı" }, { side: c.side, setup: c.key });
        }
        if (tg.rr < cfg.setup.minRR) {
          return mk("PAS", `PAS · ${SETUP_LABEL[c.key]}`, [
            `Hedef stoba göre yakın: R/R ${tg.rr.toFixed(2)} < ${cfg.setup.minRR.toFixed(1)}`,
            `T1 ${fmt(tg.t1.price)} (${tg.t1.label}) · stop ${fmt(c.stop)}`,
          ], { price: r2(c.stop), text: "Plan gösterilmez" }, { side: c.side, setup: c.key });
        }
        // GİR
        const risk = Math.abs(entry - c.stop);
        const trade: Trade = {
          ymd, setup: c.key, side: c.side, regime, entryEnd: end, entry: r2(entry), stop0: r2(c.stop),
          t1: r2(tg.t1.price), t2: tg.t2 ? r2(tg.t2.price) : null, exitEnd: null, exit: null, exitReason: null, t1Hit: false, r: null,
        };
        ps.pos = { trade, risk, stop: c.stop, mfe: 0, t1Hit: false, noAdd: false, tightened: false };
        return {
          state: "GİR", side: c.side, setup: c.key,
          headline: `GİR · ${SETUP_LABEL[c.key]}`,
          why: [`Rejim ${regimeText(regime)}${trend ? ` · 15m yön ${dir15 > 0 ? "yukarı" : "aşağı"}` : ""}`, `Tetik: ${c.trigText}`, `R/R ${tg.rr.toFixed(2)} · T1 ${fmt(tg.t1.price)} (${tg.t1.label})`].slice(0, 3),
          invalidation: { price: r2(c.stop), text: `${fmt(c.stop)} ${c.side === "LONG" ? "altında" : "üstünde"} 5m kapanış planı bozar` },
          trigger: c.trigText,
          plan: { entry: r2(entry), stop: r2(c.stop), t1: r2(tg.t1.price), t1Label: tg.t1.label, t2: tg.t2 ? r2(tg.t2.price) : null, rr: r2(tg.rr) },
          warnings: warnings.slice(), alert: true,
        };
      }

      // HAZIRLAN (en yakın hazır kurulum)
      const best = live[0];
      if (best) {
        const entry = b.close;
        const tg = pickTargets(best.side, entry, best.stop, targetLevels, A, regime === "YATAY", profile);
        const rrTxt = tg.rr != null && tg.t1 ? `Olası R/R ${tg.rr.toFixed(2)} · T1 ${fmt(tg.t1.price)} (${tg.t1.label})` : "Hedef henüz net değil";
        return {
          state: "HAZIRLAN", side: best.side, setup: best.key,
          headline: `HAZIRLAN · ${SETUP_LABEL[best.key]}`,
          why: [`Rejim ${regimeText(regime)}`, best.prepText, rrTxt].slice(0, 3),
          invalidation: { price: r2(best.stop), text: `${fmt(best.stop)} ${best.side === "LONG" ? "altında" : "üstünde"} kapanış kurulumu iptal eder` },
          trigger: best.trigText,
          plan: { entry: r2(entry), stop: r2(best.stop), t1: tg.t1 ? r2(tg.t1.price) : null, t1Label: tg.t1?.label ?? null, t2: tg.t2 ? r2(tg.t2.price) : null, rr: tg.rr != null ? r2(tg.rr) : null },
          warnings: warnings.slice(), alert,
        };
      }
      return mk("BEKLE", `BEKLE · ${regimeText(regime)}`, [
        `Rejim ${regimeText(regime)}: ${trend ? "geri çekilme veya kırılım henüz yaklaşmadı" : "kenara yaklaşan kurulum yok"}`,
        `Fiyat ${fmt(b.close)} · VWAP ${fmt(vw)}${ema15 != null ? ` · EMA20-15m ${fmt(ema15)}` : ""}`,
      ], near ?? { price: null, text: "" });
    }

    steps.push({ end, state: verdict.state, side: verdict.side, regime, close: b.close });

    if (i === n - 1) {
      lastFull = {
        i, end, close: b.close, vwap: vw, atr: atrV, ema15, regime, regimeSince, candidate, pendingKind, pendingCount,
        inputs: { cross2h, insideRatio, insideBars, acceptance, htfBias, rangeVsAdr: adr && adr > 0 ? (dayHigh - dayLow) / adr : null, orBreak },
        score15: s15, score30: s30, score60: s60, dir15,
        profile, dayHigh, dayLow, or: orRange, levels, verdict, position: ps.pos, cooldownActive: i <= cooldownUntil,
      };
    }
  }

  // açık pozisyon gün sonunda kalmışsa arşive "açık" yazılmaz (canlıda sürüyor)
  if (ps.pos) trades.push(ps.pos.trade);

  // olay sonuç etiketleri (15/30 dk sonra)
  for (const e of events) {
    for (const m of cfg.events.outcomeHorizonsMin) {
      const j = e.idx + m / 5;
      if (j >= n) { e.outcomes.push({ min: m, state: "…" }); continue; }
      const A = e.atr;
      e.outcomes.push({ min: m, state: A != null && firstTouch(bars, e.idx, e.bias, A, m / 5) ? "✓" : "✗" });
    }
  }

  return { ymd, bars, steps, trades, events, last: lastFull };
}

/**
 * Sonuç ölçütü (✓/✗): olay mumunun kapanışından sonra, ufuk içinde fiyat beklenen
 * yönde ≥ outcomeMoveAtr×ATR'ye, ters yönde aynı mesafeye ÖNCE ulaşmadan ulaştıysa ✓.
 * Aynı mumda ikisi de değerse belirsizdir → ✗ (muhafazakâr). Rastgele yönün tabanı ~%50
 * olduğundan İlke 7'deki %50 eşiği anlamlı kalır.
 */
export function firstTouch(bars: Bar[], idx: number, bias: 1 | -1, A: number, horizonBars: number): boolean {
  const ref = bars[idx].close;
  const need = CFG.events.outcomeMoveAtr * A;
  for (let q = idx + 1; q <= idx + horizonBars && q < bars.length; q++) {
    const fav = bias > 0 ? bars[q].high - ref : ref - bars[q].low;
    const adv = bias > 0 ? ref - bars[q].low : bars[q].high - ref;
    if (fav >= need && adv >= need) return false;
    if (fav >= need) return true;
    if (adv >= need) return false;
  }
  return false;
}

// ═══════════════════════════════════════════════════════════════════
// Metin yardımcıları
// ═══════════════════════════════════════════════════════════════════

function regimeText(r: RegimeKind): string {
  return r === "TREND_UP" ? "TREND ▲" : r === "TREND_DOWN" ? "TREND ▼" : r === "YATAY" ? "YATAY" : r === "GEÇİŞ" ? "GEÇİŞ" : "AÇILIŞ";
}
const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);
const hm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
export { regimeText };
