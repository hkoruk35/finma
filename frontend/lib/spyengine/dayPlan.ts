/**
 * Günlük Plan & Seviye Haritası (Geniş Harita v5) — saf, deterministik, izomorfik.
 *
 * Kurallar:
 *   • Yalnız KAPANMIŞ 5m mumlar (time + 300 ≤ asOf). Aynı girdi → aynı payload (rastgelelik yok; MC tohumu girdiden).
 *   • Girdi yoksa uydurma yok: alan `missing` listesine girer, ona bağlı hesap atlanır (EM yoksa EM seviyeleri de yok).
 *   • Olasılık yüzdesi yalnız Monte Carlo motorundan (wideForecast.ts) ve ölçülmüş geçmiş frekanslardan gelir.
 *     Senaryo yolları OLASILIK DEĞİLDİR — seviyelerden çizilir ("seviye tabanlı senaryo").
 *   • Saatler America/New_York.
 *
 * Bileşen formülleri (skor, -100..+100):
 *   trend  = 100 × ortalama(işaret(spot−EMA8g), işaret(EMA8−EMA20), işaret(EMA20−EMA50), işaret(spot−SMA200)) (günlük)
 *   macd   = 0,7 × kırp(hist/ATR4s × 200) + 0,3 × kırp((hist−hist₋₁)/ATR4s × 400)            (4s, extended)
 *   rsi    = RSI<40 → +(40−RSI)×10 · RSI>60 → −(RSI−60)×10 · arası 0 (ters etki; ±100 kırpılır)   (4s)
 *   volume = kırp((hacim oranı−1) × 100, 0..100) × işaret(dünkü kapanış − dünkü açılış)
 *   flow   = kırp((spot − dünkü kapanış) / (0,5 × EM) × 100); EM yoksa ATR4s kullanılır
 *   rel    = kırp(ort(göreli sembol % değişimleri) / 0,5 × 100)
 *   gamma  = spot > flip → +60 · altında → −60 (flip yoksa bileşen yok)
 *   skor   = 1 + (ağırlıklı ort + 100) / 200 × 9 → 1..10
 */

import { atr, ema, macd, rsi, sma, nyParts, nyDateTimeToEpoch, RTH_OPEN_MIN, RTH_CLOSE_MIN, PRE_OPEN_MIN, type Bar } from "./core";
import {
  ANCHORS_MIN, DAYPLAN_CFG, DAYPLAN_VERSION, FIXED_PROFILE_15, SCORE_LABELS,
  type DayPlanCfg, type ScoreKey,
} from "./dayPlanConfig";
import { buildWideForecast } from "./wideForecast";

// ── tipler ──────────────────────────────────────────────────────

export interface DayEvent { date: string; time: string | null; name: string; kind: "macro" | "earnings"; impact?: string }
export interface Walls { flip: number | null; callWall: number | null; putWall: number | null; source: string }
export interface Straddle { expiry: string; strike: number; value: number }

export interface DayPlanInput {
  symbol: string;
  asOf: number;
  /** 5m extended (≥ 20 seans önerilir) */
  bars5: Bar[];
  /** günlük mumlar, temettü düzeltmeli (≥ 200 önerilir) — SMA/EMA/swing/Fib */
  daily: Bar[];
  /** günlük mumlar, düzeltmesiz — yalnız resmi önceki kapanış için (yoksa son 5m kapanışı) */
  dailyRaw?: Bar[];
  /** örtük oynaklık endeksinin değeri (VIX 22.91 gibi) — yoksa null */
  iv: { value: number; label: string } | null;
  /** göreli güç: sembol + 5m extended mumları */
  rel: { symbol: string; bars5: Bar[] }[];
  /** null = takvim verisi yok */
  macroEvents: DayEvent[] | null;
  earnings: DayEvent[] | null;
  walls: Walls | null;
  straddle: Straddle | null;
  cfg?: Partial<DayPlanCfg>;
}

export interface Zone {
  low: number; high: number; label: string; sources: string[];
  type: "R" | "S" | "M"; rejects: number; rejR: number; rejS: number; rejOn: number; confluence: number;
}
export interface PathPt { t: string; m: number; p: number }
export interface Scenario { key: "main" | "break" | "invalid"; label: string; points: PathPt[] }
export interface PlanRow { setup: string; entry: string; entryPx: number; targets: number[]; stop: number; rr: number[] }
export interface ScoreComp { key: ScoreKey; name: string; value: number | null; note: string }
export interface Lean { dir: "UP" | "DOWN" | null; n: number; upPct: number; h1: number; h2: number; avg: number; text: string }

export interface DayPlan {
  meta: {
    symbol: string; date: string; version: string; asof_et: string; asOf: number; spot: number; spot_et: string;
    prev_close: number | null; engine: string; inputs_hash: string; profile: "ölçülen" | "sabit"; sessions: number;
  };
  score: { value: number | null; raw: number | null; components: ScoreComp[] };
  cards: {
    prev: { close: number; high: number; low: number; open: number } | null;
    on_range: { low: number; high: number; lowAt: string; highAt: string; note: string } | null;
    pm_range: { low: number; high: number; lowAt: string; highAt: string; note: string } | null;
    em: { value: number; low: number; high: number; halfLow: number; halfHigh: number; iv: number; ivLabel: string } | null;
    straddle: { value: number; expiry: string; strike: number; ratio: number | null } | null;
    events: DayEvent[];
    walls: Walls | null;
    tech: { rsi4h: number | null; macd4h: number | null; signal4h: number | null; hist4h: number | null; atr4h: number | null; sma200: number | null; volRatio: number | null; vwapPm: number | null; vwapRth: number | null };
    rel: { symbol: string; pct: number | null }[];
    gaps: { low: number; high: number; from: string; dir: "UP" | "DOWN"; filledToday: boolean; filled: boolean }[];
  };
  bias: { dir: "BEAR" | "BULL" | "NÖTR"; line: [number, number] | null; invalidation: number | null; targets: number[]; reason: string };
  levels: Zone[];
  actual_path: PathPt[];
  /** 5m EMA9/20/50 (seans dışı dahil sürekli seri; 60 günle ısınmış), gerçekleşen yolla aynı zaman noktaları */
  ema: { m: number; e9: number; e20: number; e50: number }[];
  /** 5m KAPANIŞ ile bölge kırılımları (bugün 04:00 → son mum) */
  breaks: { m: number; t: string; p: number; dir: "UP" | "DOWN"; zone: string; label: string; inval: boolean }[];
  scenarios: Scenario[];
  band: { m: number; lo: number; hi: number }[];
  plan: PlanRow[];
  texts: { warning: string[]; scenario: string; flow: string[] };
  next15: { at: string; range: number; lo: number; hi: number; state: string | null; lean: Lean | null; note: string };
  nextDays: {
    em: { day: number; date: string; low: number; high: number }[];
    lean1: Lean | null; lean3: Lean | null; state: string;
    mc: { up: { price: number; pct: number }; down: { price: number; pct: number }; none: number; dayEnds: { date: string; p10: number; p50: number; p90: number }[]; zoneTouch: { price: number; label: string; pct: number }[] } | null;
    events: DayEvent[];
  };
  missing: string[];
}

// ── yardımcılar ─────────────────────────────────────────────────

const r2 = (v: number) => Math.round(v * 100) / 100;
const clamp = (v: number, lo = -100, hi = 100) => Math.max(lo, Math.min(hi, v));
const sgn = (v: number) => (v > 0 ? 1 : v < 0 ? -1 : 0);
const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(Math.round(min) % 60).padStart(2, "0")}`;
const clock = (sec: number) => hhmm(nyParts(sec).minutes);
const f2 = (v: number) => v.toFixed(2);
const zf = (z: { low: number; high: number }) => (z.high - z.low < 0.05 ? f2(z.low) : `${f2(z.low)}–${f2(z.high)}`);
function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}
const isWeekday = (ymd: string) => { const w = new Date(`${ymd}T12:00:00Z`).getUTCDay(); return w >= 1 && w <= 5; };
const nextWeekday = (ymd: string) => { let d = addDays(ymd, 1); while (!isWeekday(d)) d = addDays(d, 1); return d; };
function last<T>(a: (T | null)[]): T | null { for (let i = a.length - 1; i >= 0; i--) if (a[i] != null) return a[i]; return null; }
function fnv(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/** Hedef seans: hafta içi 16:00 öncesi → bugün, aksi → sonraki hafta içi (tatiller bilinmez) */
export function tradeDateOf(asOf: number): string {
  const p = nyParts(asOf);
  return isWeekday(p.ymd) && p.minutes < RTH_CLOSE_MIN ? p.ymd : nextWeekday(p.ymd);
}

function cleanBars(bars: Bar[], asOf: number): Bar[] {
  const m = new Map<number, Bar>();
  for (const b of bars) if (b && Number.isFinite(b.close) && b.close > 0 && b.time + 300 <= asOf) m.set(b.time, b);
  return [...m.values()].sort((a, b) => a.time - b.time);
}
const inRthMin = (min: number) => min >= RTH_OPEN_MIN && min < RTH_CLOSE_MIN;

function rthDays(bars: Bar[]): Map<string, Bar[]> {
  const out = new Map<string, Bar[]>();
  for (const b of bars) {
    const p = nyParts(b.time);
    if (!inRthMin(p.minutes)) continue;
    const a = out.get(p.ymd) ?? [];
    a.push(b); out.set(p.ymd, a);
  }
  return out;
}
function hiLo(bs: Bar[]): { low: number; high: number; lowAt: string; highAt: string } | null {
  if (!bs.length) return null;
  let h = bs[0], l = bs[0];
  for (const b of bs) { if (b.high > h.high) h = b; if (b.low < l.low) l = b; }
  return { low: r2(l.low), high: r2(h.high), lowAt: clock(l.time), highAt: clock(h.time) };
}
function vwapOf(bs: Bar[]): number | null {
  let pv = 0, v = 0;
  for (const b of bs) { const w = b.volume || 0; pv += ((b.high + b.low + b.close) / 3) * w; v += w; }
  return v > 0 ? r2(pv / v) : null;
}
function agg(bars: Bar[], keyOf: (b: Bar) => string | null): { key: string; bar: Bar }[] {
  const out: { key: string; bar: Bar }[] = [];
  for (const b of bars) {
    const k = keyOf(b);
    if (k == null) continue;
    const cur = out[out.length - 1];
    if (cur && cur.key === k) {
      cur.bar.high = Math.max(cur.bar.high, b.high); cur.bar.low = Math.min(cur.bar.low, b.low);
      cur.bar.close = b.close; cur.bar.volume += b.volume || 0;
    } else out.push({ key: k, bar: { ...b, volume: b.volume || 0 } });
  }
  return out;
}

/** Yön kapısı: n ≥ minN, |z| ≥ minZ ve iki yarı aynı yönde */
function leanOf(outs: number[], cfg: DayPlanCfg, unit: string): Lean | null {
  const n = outs.length;
  if (n < 10) return null;
  const up = outs.filter((x) => x > 0).length;
  const half = Math.floor(n / 2);
  const rate = (a: number[]) => (a.length ? (a.filter((x) => x > 0).length / a.length) * 100 : 50);
  const h1 = rate(outs.slice(0, half)), h2 = rate(outs.slice(half));
  const upPct = (up / n) * 100;
  const z = (up - n / 2) / Math.sqrt(n / 4);
  const avg = outs.reduce((a, b) => a + b, 0) / n;
  const ok = n >= cfg.minN && Math.abs(z) >= cfg.minZ && (h1 - 50) * (h2 - 50) > 0;
  const dir = ok ? (z > 0 ? "UP" : "DOWN") : null;
  const text = dir
    ? `${dir === "UP" ? "yukarı" : "aşağı"} eğilim: %${Math.round(dir === "UP" ? upPct : 100 - upPct)} (n=${n}, yarılar %${Math.round(h1)}/%${Math.round(h2)}, ort ${avg >= 0 ? "+" : ""}${avg.toFixed(2)} ${unit})`
    : `anlamlı yön avantajı yok (yukarı %${Math.round(upPct)}, n=${n}${n < cfg.minN ? ", örnek az" : ""})`;
  return { dir, n, upPct: Math.round(upPct), h1: Math.round(h1), h2: Math.round(h2), avg: r2(avg), text };
}

// ── ana hesap ───────────────────────────────────────────────────

export function buildDayPlan(inp: DayPlanInput): DayPlan | null {
  const cfg: DayPlanCfg = { ...DAYPLAN_CFG, ...(inp.cfg ?? {}) };
  const { asOf, symbol } = inp;
  const bars = cleanBars(inp.bars5, asOf);
  if (bars.length < 100) return null;
  const date = tradeDateOf(asOf);
  const missing: string[] = [];
  const at = (min: number) => nyDateTimeToEpoch(date, min);

  const days = rthDays(bars);
  const prior = [...days.keys()].filter((d) => d < date).sort();
  if (!prior.length) return null;
  const prevYmd = prior[prior.length - 1];
  const prevBars = days.get(prevYmd)!;
  // resmi kapanış (kapanış müzayedesi) günlük mumdan; yoksa son 5m kapanışı
  const dPrevRaw = (inp.dailyRaw ?? []).find((b) => nyParts(b.time).ymd === prevYmd && b.close > 0);
  const prevClose = r2(dPrevRaw ? dPrevRaw.close : prevBars[prevBars.length - 1].close);
  const prev = { close: prevClose, open: r2(prevBars[0].open), high: r2(Math.max(...prevBars.map((b) => b.high))), low: r2(Math.min(...prevBars.map((b) => b.low))) };
  const lastBar = bars[bars.length - 1];
  const spot = r2(lastBar.close);
  const spotEt = clock(lastBar.time + 300);
  // plan "son kapanan 5m mum itibarıyla" kurulur: aynı mumlar → aynı plan (hesap anı içeriği değiştirmez)
  const barEnd = lastBar.time + 300;
  const asofMin = nyParts(barEnd).ymd === date ? nyParts(barEnd).minutes : PRE_OPEN_MIN;

  // gece (dün 16:00 → bugün 04:00) ve premarket (04:00 → 09:30)
  const onBars = bars.filter((b) => b.time >= nyDateTimeToEpoch(prevYmd, RTH_CLOSE_MIN) && b.time < at(PRE_OPEN_MIN));
  const pmBars = bars.filter((b) => b.time >= at(PRE_OPEN_MIN) && b.time < at(RTH_OPEN_MIN));
  const todayRth = days.get(date) ?? [];
  const onHL = hiLo(onBars), pmHL = hiLo(pmBars);
  const onGapNote = "Yahoo'da 20:00–04:00 gece işlemleri yok; gece aralığı 16:00–20:00 after-hours'tan";
  if (onBars.length && !onBars.some((b) => { const m = nyParts(b.time).minutes; return m < PRE_OPEN_MIN || m >= 20 * 60; })) missing.push("overnight_20_04");

  // ── günlük ──
  const dly = inp.daily.filter((b) => b.close > 0 && nyParts(b.time).ymd < date).sort((a, b) => a.time - b.time);
  const dCloses = dly.map((b) => b.close);
  const smaV: Record<number, number | null> = {};
  for (const p of [5, 10, 20, 50, 100, 200]) smaV[p] = dCloses.length >= p ? r2(last(sma(dCloses, p))!) : null;
  if (smaV[200] == null) missing.push("sma200");
  const emaD = (p: number) => (dCloses.length >= p ? last(ema([...dCloses], p)) : null);
  const e8 = emaD(8), e20 = emaD(20), e50 = emaD(50);

  // ── 4s (extended, 04:00 hizalı: 04–08 · 08–12 · 12–16 · 16–20) ──
  const h4 = agg(bars, (b) => {
    const p = nyParts(b.time);
    if (p.minutes < PRE_OPEN_MIN || p.minutes >= 20 * 60) return null;
    return `${p.ymd}|${Math.floor((p.minutes - PRE_OPEN_MIN) / 240)}`;
  }).filter(({ key }) => {
    const [ymd, k] = key.split("|");
    return nyDateTimeToEpoch(ymd, PRE_OPEN_MIN + (Number(k) + 1) * 240) <= asOf;
  }).map((x) => x.bar);
  const c4 = h4.map((b) => b.close);
  const rsi4 = h4.length >= 15 ? last(rsi(c4, 14)) : null;
  const m4 = h4.length >= 35 ? macd(c4) : null;
  const hist4 = m4 ? last(m4.hist) : null;
  const histPrev = m4 ? (m4.hist.length >= 2 ? m4.hist[m4.hist.length - 2] : null) : null;
  const atr4 = h4.length >= 15 ? last(atr(h4, 14)) : null;

  // ── hacim oranı: dünkü RTH hacmi / ondan önceki 3 seansın ortalaması ──
  const vol = (d: string) => (days.get(d) ?? []).reduce((a, b) => a + (b.volume || 0), 0);
  const prev3 = prior.slice(-4, -1);
  const volRatio = prev3.length === 3 && vol(prevYmd) > 0 ? r2(vol(prevYmd) / (prev3.reduce((a, d) => a + vol(d), 0) / 3)) : null;
  if (volRatio == null) missing.push("volume_ratio");

  // ── EM ──
  const em = inp.iv && inp.iv.value > 0 ? (prevClose * inp.iv.value) / 100 / Math.sqrt(252) : null;
  if (!inp.iv) missing.push("vix");
  const emCard = em != null ? {
    value: r2(em), low: r2(prevClose - em), high: r2(prevClose + em), halfLow: r2(prevClose - em / 2), halfHigh: r2(prevClose + em / 2), iv: inp.iv!.value, ivLabel: inp.iv!.label,
  } : null;
  const scale = em ?? (atr4 != null ? atr4 * 2 : spot * 0.01);

  // ── gap'ler (son N seans, RTH kapanış → sonraki RTH açılış) ──
  const sess = [...prior, ...(todayRth.length ? [date] : [])];
  const gaps: DayPlan["cards"]["gaps"] = [];
  for (let i = Math.max(1, sess.length - cfg.gapSessions); i < sess.length; i++) {
    const a = days.get(sess[i - 1])!, b = days.get(sess[i])!;
    const c = a[a.length - 1].close, o = b[0].open;
    if (Math.abs(o - c) / c * 100 < cfg.gapMinPct) continue;
    const after = bars.filter((x) => x.time >= b[0].time);
    if (o > c) {
      let lo = Infinity, fillT: number | null = null;
      for (const x of after) { lo = Math.min(lo, x.low); if (fillT == null && x.low <= c) fillT = x.time; }
      const filled = fillT != null;
      gaps.push({ low: r2(c), high: r2(filled ? c : Math.min(o, lo)), from: sess[i], dir: "UP", filled, filledToday: filled && nyParts(fillT!).ymd === date });
    } else {
      let hi = -Infinity, fillT: number | null = null;
      for (const x of after) { hi = Math.max(hi, x.high); if (fillT == null && x.high >= c) fillT = x.time; }
      const filled = fillT != null;
      gaps.push({ low: r2(filled ? c : Math.max(o, hi)), high: r2(c), from: sess[i], dir: "DOWN", filled, filledToday: filled && nyParts(fillT!).ymd === date });
    }
  }

  // ── aday seviyeler ──
  type Cand = { price: number; label: string };
  const cands: Cand[] = [];
  const add = (p: number | null | undefined, label: string) => { if (p != null && Number.isFinite(p) && p > 0) cands.push({ price: r2(p), label }); };
  add(prev.high, "PDH"); add(prev.low, "PDL"); add(prevClose, "Dün kapanış");
  if (onHL) { add(onHL.high, "ON tepe"); add(onHL.low, "ON dip"); }
  if (pmHL) { add(pmHL.high, "PM tepe"); add(pmHL.low, "PM dip"); }
  if (todayRth.length) { const t = hiLo(todayRth)!; add(t.high, "Gün tepe"); add(t.low, "Gün dip"); }
  if (emCard) { add(emCard.high, "EM üst"); add(emCard.low, "EM alt"); add(emCard.halfHigh, "Yarım EM üst"); add(emCard.halfLow, "Yarım EM alt"); }
  for (const g of gaps) if (!g.filled) { add(g.low, `Gap alt (${g.from.slice(5)})`); add(g.high, `Gap üst (${g.from.slice(5)})`); }
  for (const p of [20, 50, 100, 200]) add(smaV[p], `${p} SMA`);
  // günlük swing (2+2 fraktal, son 60 gün)
  const dl = dly.slice(-60);
  const swH: number[] = [], swL: number[] = [];
  for (let i = 2; i < dl.length - 2; i++) {
    if (dl[i].high > Math.max(dl[i - 1].high, dl[i - 2].high, dl[i + 1].high, dl[i + 2].high)) swH.push(dl[i].high);
    if (dl[i].low < Math.min(dl[i - 1].low, dl[i - 2].low, dl[i + 1].low, dl[i + 2].low)) swL.push(dl[i].low);
  }
  swH.filter((p) => p > spot).sort((a, b) => a - b).slice(0, 2).forEach((p) => add(p, "Swing tepe"));
  swL.filter((p) => p < spot).sort((a, b) => b - a).slice(0, 2).forEach((p) => add(p, "Swing dip"));
  // Fibonacci: son 20 günün tepe/dibi
  const d20 = dly.slice(-20);
  if (d20.length >= 10) {
    let hiB = d20[0], loB = d20[0];
    for (const b of d20) { if (b.high > hiB.high) hiB = b; if (b.low < loB.low) loB = b; }
    const rng = hiB.high - loB.low;
    if (rng > 0) for (const f of [0.382, 0.5, 0.618]) add(hiB.time > loB.time ? hiB.high - f * rng : loB.low + f * rng, `Fib ${f}`);
  }
  // yuvarlak sayılar
  const rr = cfg.roundRangeEm * scale;
  for (let p = Math.ceil((spot - rr) / cfg.roundStep) * cfg.roundStep; p <= spot + rr; p += cfg.roundStep) add(p, "Yuvarlak");
  if (inp.walls) {
    add(inp.walls.flip, "Gamma flip"); add(inp.walls.callWall, "Call duvarı"); add(inp.walls.putWall, "Put duvarı");
    if (inp.walls.flip == null) missing.push("gamma_flip");
    if (inp.walls.callWall == null) missing.push("call_wall");
    if (inp.walls.putWall == null) missing.push("put_wall");
  } else missing.push("gex", "gamma_flip", "call_wall", "put_wall");
  if (inp.straddle) { add(prevClose + inp.straddle.value, "Straddle üst"); add(prevClose - inp.straddle.value, "Straddle alt"); }
  else missing.push("straddle");

  const win = 3 * scale;
  const pool = cands.filter((c) => Math.abs(c.price - spot) <= win).sort((a, b) => a.price - b.price || a.label.localeCompare(b.label));

  // kümeleme: 1) mergeTol tek bağlantı · 2) yapı birleşmesi (boşluk ≤ structTol, genişlik ≤ maxZone)
  type Z = { low: number; high: number; src: string[] };
  let zs: Z[] = [];
  for (const c of pool) {
    const z = zs[zs.length - 1];
    if (z && c.price - z.high <= cfg.mergeTol) { z.high = c.price; if (!z.src.includes(c.label)) z.src.push(c.label); }
    else zs.push({ low: c.price, high: c.price, src: [c.label] });
  }
  const sTol = em != null ? cfg.structTolEm * em : cfg.structTolPts;
  const maxW = em != null ? cfg.maxZoneEm * em : cfg.maxZonePts;
  const strong = (z: Z) => z.src.some((s) => s !== "Yuvarlak" && !s.startsWith("Fib"));
  // aglomeratif: her adımda koşulu sağlayan EN KÜÇÜK boşluklu komşu çift birleşir (sıra bağımsız, deterministik)
  for (;;) {
    let best = -1, gap = Infinity;
    for (let i = 0; i + 1 < zs.length; i++) {
      const a = zs[i], b = zs[i + 1], g = b.low - a.high;
      if (g <= sTol && b.high - a.low <= maxW && strong(a) && strong(b) && g < gap) { gap = g; best = i; }
    }
    if (best < 0) break;
    const a = zs[best], b = zs[best + 1];
    zs[best] = { low: a.low, high: b.high, src: [...a.src, ...b.src.filter((x) => !a.src.includes(x))] };
    zs.splice(best + 1, 1);
  }
  zs = zs.filter((z) => strong(z) || z.src.length >= 2 || z.src.includes("Yuvarlak"));

  // ── ret sayımı: dün RTH açılışı → asOf ──
  const winBars = bars.filter((b) => b.time >= prevBars[0].time);
  const atrSeries = atr(bars.slice(-Math.max(400, winBars.length + 50)), 14);
  const atrOff = bars.length - atrSeries.length;
  const atrAt = (idx: number) => atrSeries[idx - atrOff] ?? null;
  const idxOf = new Map(bars.map((b, i) => [b.time, i]));
  const onStart = nyDateTimeToEpoch(prevYmd, RTH_CLOSE_MIN), onEnd = at(RTH_OPEN_MIN);
  const countRejects = (z: Z) => {
    let R = 0, S = 0, on = 0;
    const tol = cfg.rejectTol;
    for (let k = 0; k < winBars.length; k++) {
      const b = winBars[k];
      const a = atrAt(idxOf.get(b.time)!) ?? (atr4 != null ? atr4 / 8 : 0.5);
      // direnç testi
      if (b.high >= z.low - tol && b.high <= z.high + tol && b.close <= z.high + tol) {
        for (let j = k + 1; j < Math.min(winBars.length, k + 1 + cfg.rejectLookBars); j++) {
          if (winBars[j].close > z.high + tol) break;
          if (winBars[j].low <= b.high - cfg.rejectAtr * a) { R++; if (b.time >= onStart && b.time < onEnd) on++; k = j; break; }
        }
        continue;
      }
      // destek testi
      if (b.low <= z.high + tol && b.low >= z.low - tol && b.close >= z.low - tol) {
        for (let j = k + 1; j < Math.min(winBars.length, k + 1 + cfg.rejectLookBars); j++) {
          if (winBars[j].close < z.low - tol) break;
          if (winBars[j].high >= b.low + cfg.rejectAtr * a) { S++; if (b.time >= onStart && b.time < onEnd) on++; k = j; break; }
        }
      }
    }
    return { R, S, on };
  };
  const levels: Zone[] = zs.map((z) => {
    const { R, S, on } = countRejects(z);
    const type: Zone["type"] = z.low > spot ? "R" : z.high < spot ? "S" : "M";
    const rejects = type === "R" ? R : type === "S" ? S : R + S;
    return {
      low: r2(z.low), high: r2(z.high), label: z.src.join(" + "), sources: z.src, type,
      rejects, rejR: R, rejS: S, rejOn: on, confluence: z.src.length + rejects * 2,
    };
  }).sort((a, b) => b.high - a.high);

  // ── bias ──
  const above = levels.filter((z) => z.high > spot && z.rejR >= 1).sort((a, b) => Math.max(0, a.low - spot) - Math.max(0, b.low - spot));
  const below = levels.filter((z) => z.low < spot && z.rejS >= 1).sort((a, b) => Math.max(0, spot - a.high) - Math.max(0, spot - b.high));
  const resZ = above[0] ?? null, supZ = below[0] ?? null;
  const minStep = 0.15 * scale;
  let dir: DayPlan["bias"]["dir"] = "NÖTR";
  let reason = "";
  if (hist4 == null) reason = "4s MACD hesaplanamadı (yetersiz 4s mum)";
  else if (resZ && hist4 < 0) { dir = "BEAR"; reason = `Fiyat ${zf(resZ)} direncinin altında (${resZ.rejR} ret) ve 4s MACD histogramı ${hist4.toFixed(2)} < 0`; }
  else if (supZ && hist4 > 0) { dir = "BULL"; reason = `Fiyat ${zf(supZ)} desteğinin üstünde (${supZ.rejS} ret) ve 4s MACD histogramı +${hist4.toFixed(2)} > 0`; }
  else reason = `Koşul yok: ${hist4 < 0 ? "MACD < 0 ama üstte ret almış direnç yok" : "MACD > 0 ama altta ret almış destek yok"}`;
  const biasZ = dir === "BEAR" ? resZ : dir === "BULL" ? supZ : null;
  const downList = levels.filter((z) => z !== biasZ && z.high < spot - minStep).sort((a, b) => b.high - a.high);
  const upList = levels.filter((z) => z !== biasZ && z.low > spot + minStep).sort((a, b) => a.low - b.low);
  const inval = biasZ ? r2(dir === "BEAR" ? biasZ.high + cfg.invalBuf : biasZ.low - cfg.invalBuf) : null;
  const tgtZ = dir === "BEAR" ? downList.slice(0, 3) : dir === "BULL" ? upList.slice(0, 3) : [];
  const edge = (z: Zone) => (dir === "BULL" ? z.low : z.high);
  const targets = tgtZ.map(edge);
  const beyondZ = biasZ ? (dir === "BEAR" ? levels.filter((z) => z.low > inval!).sort((a, b) => a.low - b.low)[0] : levels.filter((z) => z.high < inval!).sort((a, b) => b.high - a.high)[0]) ?? null : null;

  // ── skor ──
  const comps: ScoreComp[] = [];
  const trendSigns = [e8 != null ? sgn(spot - e8) : null, e8 != null && e20 != null ? sgn(e8 - e20) : null, e20 != null && e50 != null ? sgn(e20 - e50) : null, smaV[200] != null ? sgn(spot - smaV[200]!) : null].filter((x): x is number => x != null);
  comps.push({ key: "trend", name: SCORE_LABELS.trend, value: trendSigns.length >= 3 ? Math.round((trendSigns.reduce((a, b) => a + b, 0) / trendSigns.length) * 100) : null,
    note: e8 != null && e20 != null && e50 != null ? `spot ${spot > e8 ? ">" : "<"} EMA8 ${f2(e8)} · EMA20 ${f2(e20)} · EMA50 ${f2(e50)}${smaV[200] ? ` · SMA200 ${f2(smaV[200]!)}` : ""}` : "günlük veri yetersiz" });
  comps.push({ key: "macd", name: SCORE_LABELS.macd, value: hist4 != null && atr4 ? Math.round(0.7 * clamp((hist4 / atr4) * 200) + 0.3 * clamp(((hist4 - (histPrev ?? hist4)) / atr4) * 400)) : null,
    note: hist4 != null ? `hist ${hist4.toFixed(2)} (${histPrev != null ? (hist4 > histPrev ? "yükseliyor" : "düşüyor") : "—"})` : "veri yok" });
  comps.push({ key: "rsi", name: SCORE_LABELS.rsi, value: rsi4 != null ? Math.round(clamp(rsi4 < 40 ? (40 - rsi4) * 10 : rsi4 > 60 ? -(rsi4 - 60) * 10 : 0)) : null,
    note: rsi4 != null ? `4s RSI ${rsi4.toFixed(1)}` : "veri yok" });
  comps.push({ key: "volume", name: SCORE_LABELS.volume, value: volRatio != null ? Math.round(clamp((volRatio - 1) * 100, 0, 100) * sgn(prev.close - prev.open)) : null,
    note: volRatio != null ? `dün ${volRatio.toFixed(2)}x hacim, ${prev.close >= prev.open ? "yükselen" : "düşen"} gün` : "veri yok" });
  comps.push({ key: "flow", name: SCORE_LABELS.flow, value: Math.round(clamp(((spot - prevClose) / (0.5 * scale)) * 100)),
    note: `spot ${spot - prevClose >= 0 ? "+" : ""}${(spot - prevClose).toFixed(2)} (dünkü kapanışa göre)` });
  const relOut = inp.rel.map(({ symbol: s, bars5 }) => {
    const bs = cleanBars(bars5, asOf);
    const pd = rthDays(bs).get(prevYmd);
    if (!pd?.length || !bs.length) return { symbol: s, pct: null as number | null };
    const pc = pd[pd.length - 1].close;
    return { symbol: s, pct: r2(((bs[bs.length - 1].close - pc) / pc) * 100) };
  });
  relOut.filter((r) => r.pct == null).forEach((r) => missing.push(`rel_${r.symbol}`));
  const relVals = relOut.map((r) => r.pct).filter((x): x is number => x != null);
  comps.push({ key: "rel", name: SCORE_LABELS.rel, value: relVals.length ? Math.round(clamp((relVals.reduce((a, b) => a + b, 0) / relVals.length / 0.5) * 100)) : null,
    note: relOut.map((r) => `${r.symbol} ${r.pct == null ? "veri yok" : `${r.pct >= 0 ? "+" : ""}${r.pct.toFixed(2)}%`}`).join(" · ") || "veri yok" });
  const flip = inp.walls?.flip ?? null;
  comps.push({ key: "gamma", name: SCORE_LABELS.gamma, value: flip != null ? (spot > flip ? 60 : -60) : null,
    note: flip != null ? `spot ${spot > flip ? "üstünde" : "altında"} flip ${f2(flip)} → ${spot > flip ? "pozitif" : "negatif"} gamma` : "veri yok" });
  let wsum = 0, vsum = 0;
  for (const c of comps) if (c.value != null) { wsum += cfg.weights[c.key]; vsum += cfg.weights[c.key] * c.value; }
  const raw = wsum > 0 ? vsum / wsum : null;
  const score = { value: raw != null ? Math.max(1, Math.min(10, Math.round(1 + ((raw + 100) / 200) * 9))) : null, raw: raw != null ? Math.round(raw) : null, components: comps };

  // ── gün içi oynaklık profili (60 gün ölçülen; yoksa sabit) ──
  const rth15 = agg(bars.filter((b) => inRthMin(nyParts(b.time).minutes)), (b) => `${b.time - (b.time % 900)}`).map((x) => x.bar);
  const r15ByDay = new Map<string, Bar[]>();
  for (const b of rth15) { const y = nyParts(b.time).ymd; const a = r15ByDay.get(y) ?? []; a.push(b); r15ByDay.set(y, a); }
  const histDays = [...r15ByDay.keys()].filter((d) => d < date).sort();
  const slotSq: number[][] = Array.from({ length: 26 }, () => []);
  const pmSq: number[] = [];
  for (const d of histDays) {
    const bs = r15ByDay.get(d)!;
    for (let i = 0; i < bs.length; i++) {
      const s = Math.floor((nyParts(bs[i].time).minutes - RTH_OPEN_MIN) / 15);
      // 09:30 dilimi: açılış → kapanış (gece boşluğu hariç); diğerleri kapanıştan kapanışa
      const from = i === 0 ? bs[0].open : bs[i - 1].close;
      if (s >= 0 && s < 26 && from > 0) slotSq[s].push(Math.log(bs[i].close / from) ** 2);
    }
  }
  const pm15 = agg(bars.filter((b) => { const m = nyParts(b.time).minutes; return m >= PRE_OPEN_MIN && m < RTH_OPEN_MIN && nyParts(b.time).ymd < date; }), (b) => `${b.time - (b.time % 900)}`).map((x) => x.bar);
  for (let i = 1; i < pm15.length; i++) if (pm15[i].time - pm15[i - 1].time === 900) pmSq.push(Math.log(pm15[i].close / pm15[i - 1].close) ** 2);
  const measured = histDays.length >= 20 && slotSq.every((a) => a.length >= 10);
  const rms = (a: number[]) => Math.sqrt(a.reduce((x, y) => x + y, 0) / Math.max(1, a.length));
  const slotRms = measured ? slotSq.map(rms) : null;
  const meanRms = slotRms ? slotRms.reduce((a, b) => a + b, 0) / 26 : 0;
  const profile = slotRms ? slotRms.map((v) => v / meanRms) : FIXED_PROFILE_15;
  if (!measured) missing.push("intraday_profile");
  // σ15 (fiyat): son 10 seansın RTH 15m getirileri; IV varsa IV'ye ölçeklenir
  const recent = histDays.slice(-10).flatMap((d) => { const bs = r15ByDay.get(d)!; return bs.slice(1).map((b, i) => Math.log(b.close / bs[i].close)); });
  let sig15 = recent.length >= 40 ? rms(recent.map((x) => x * x)) : (atr4 != null ? atr4 / 8 / spot : 0.0015);
  if (em != null) sig15 = em / prevClose / Math.sqrt(26);
  const sig15p = sig15 * spot;
  const pmRel = slotRms && pmSq.length >= 40 ? rms(pmSq) / meanRms : 0.35;

  // vol-saati: 04:00 → 16:00, 15 dk ızgara (48 dilim). Kümülatif varyans (σ15² birimi)
  const hasMacroAt = (min: number) => (inp.macroEvents ?? []).some((e) => e.date === date && e.time != null && Math.abs(toMin(e.time) - min) < 15);
  const grid: number[] = []; // her dilimin varyans ağırlığı
  for (let m = PRE_OPEN_MIN; m < RTH_CLOSE_MIN; m += 15) {
    let w = m < RTH_OPEN_MIN ? pmRel ** 2 : profile[Math.floor((m - RTH_OPEN_MIN) / 15)] ** 2;
    if (hasMacroAt(m)) w += cfg.eventVolMult ** 2;
    grid.push(w);
  }
  const cum = [0];
  for (const w of grid) cum.push(cum[cum.length - 1] + w);
  const C = (min: number) => {
    const x = (Math.max(PRE_OPEN_MIN, Math.min(RTH_CLOSE_MIN, min)) - PRE_OPEN_MIN) / 15;
    const i = Math.min(grid.length - 1, Math.floor(x));
    return cum[i] + (x - i) * grid[i];
  };

  // ── senaryo yolları ──
  const startMin = Math.max(PRE_OPEN_MIN, Math.min(RTH_CLOSE_MIN, asofMin));
  const startP = spot;
  const evToday = [...(inp.macroEvents ?? []), ...(inp.earnings ?? [])].filter((e) => e.date === date);
  const amcEarn = (inp.earnings ?? []).filter((e) => e.date === date && e.time != null && toMin(e.time) >= RTH_CLOSE_MIN);
  const build = (anchors: [number, number][]): PathPt[] => {
    const pts: [number, number][] = [[startMin, startP], ...anchors.filter(([m]) => m > startMin)];
    if (pts.length < 2) return [];
    // 15 dk ızgarada vol-saati interpolasyonu
    const out: PathPt[] = [{ t: hhmm(startMin), m: startMin, p: r2(startP) }];
    for (let m = Math.ceil((startMin + 0.01) / 15) * 15; m <= RTH_CLOSE_MIN; m += 15) {
      let k = 1;
      while (k < pts.length - 1 && pts[k][0] < m) k++;
      const [ma, pa] = pts[k - 1], [mb, pb] = pts[k];
      const den = C(mb) - C(ma);
      const f = m >= mb ? 1 : den > 0 ? (C(m) - C(ma)) / den : (m - ma) / Math.max(1, mb - ma);
      out.push({ t: hhmm(m), m, p: r2(pa + (pb - pa) * Math.max(0, Math.min(1, f))) });
    }
    if (amcEarn.length) {
      const base = out.find((q) => q.m >= 13 * 60 + 30);
      if (base) for (const q of out) if (q.m > base.m) q.p = r2(base.p + (q.p - base.p) * cfg.earningsDamp);
    }
    return out;
  };
  const A = (min: number) => min;
  const [a830, a930, a1000, a1030, a1130, a1200, a1330, a1500, a1600] = ANCHORS_MIN.map(A);
  const scenarios: Scenario[] = [];
  const preOpen = startMin < a930 ? [[a830, startP], [a930, startP]] as [number, number][] : [];
  if (biasZ && targets.length) {
    const s = dir === "BEAR" ? 1 : -1; // BEAR: tavan yukarıda
    const w = biasZ.high - biasZ.low;
    const test2 = dir === "BEAR" ? Math.min(biasZ.high - 0.05, biasZ.low + 0.75 * w) : Math.max(biasZ.low + 0.05, biasZ.high - 0.75 * w);
    const T1 = targets[0];
    const bounce = T1 + 0.25 * (test2 - T1);
    const mainA: [number, number][] = [...preOpen, [a1000, test2], [a1030, (test2 + T1) / 2], [a1130, T1], [a1200, bounce], [a1330, T1], [a1500, T1 + 0.35 * (startP - T1)], [a1600, T1 + 0.5 * (startP - T1)]];
    scenarios.push({ key: "main", label: `Ana: 2. test + ${f2(T1)} retest`, points: build(mainA) });
    if (targets[1] != null) {
      const T2 = targets[1];
      scenarios.push({ key: "break", label: `Retest kırılır → ${f2(T2)}`, points: build([...preOpen, [a1000, test2], [a1030, (test2 + T1) / 2], [a1130, T1], [a1200, bounce], [a1330, T2], [a1500, T2], [a1600, T2 + 0.2 * (T1 - T2)]]) });
    }
    if (beyondZ && inval != null) {
      const nx = dir === "BEAR" ? beyondZ.low : beyondZ.high;
      scenarios.push({ key: "invalid", label: `Geçersiz: ${f2(inval)} ${s > 0 ? "üstü" : "altı"} → ${f2(nx)}`, points: build([...preOpen, [a1000, inval], [a1030, (inval + nx) / 2], [a1130, nx], [a1330, nx - 0.25 * (nx - inval)], [a1600, nx - 0.25 * (nx - inval)]]) });
    }
  } else {
    const R = levels.filter((z) => z.low > spot + minStep).sort((a, b) => a.low - b.low)[0];
    const S = levels.filter((z) => z.high < spot - minStep).sort((a, b) => b.high - a.high)[0];
    if (R && S) {
      const mid = (R.low + S.high) / 2;
      scenarios.push({ key: "main", label: `Ana (aralık): ${f2(S.high)}–${f2(R.low)}`, points: build([...preOpen, [a1000, R.low], [a1130, S.high], [a1330, mid], [a1600, mid]]) });
      const R2 = levels.filter((z) => z.low > R.high + minStep).sort((a, b) => a.low - b.low)[0];
      const S2 = levels.filter((z) => z.high < S.low - minStep).sort((a, b) => b.high - a.high)[0];
      if (S2) scenarios.push({ key: "break", label: `Aşağı kırılım → ${f2(S2.high)}`, points: build([...preOpen, [a1000, R.low], [a1130, S.high], [a1200, S.low - cfg.invalBuf], [a1330, S2.high], [a1600, S2.high]]) });
      if (R2) scenarios.push({ key: "invalid", label: `Yukarı kırılım → ${f2(R2.low)}`, points: build([...preOpen, [a1000, R.high + cfg.invalBuf], [a1130, R2.low], [a1600, R2.low - 0.25 * (R2.low - R.high)]]) });
    }
  }
  const mainPts = scenarios.find((x) => x.key === "main")?.points ?? [];
  const band = mainPts.map((q) => { const sd = sig15p * Math.sqrt(Math.max(0, C(q.m) - C(startMin))); return { m: q.m, lo: r2(q.p - sd), hi: r2(q.p + sd) }; });

  // ── gerçekleşen yol (bugün 04:00 → asOf, kapanmış 5m) ──
  const actual_path: PathPt[] = bars.filter((b) => b.time >= at(PRE_OPEN_MIN) && b.time + 300 <= at(RTH_CLOSE_MIN)).map((b) => {
    const m = nyParts(b.time).minutes + 5;
    return { t: hhmm(m), m, p: r2(b.close) };
  });

  // ── EMA9/20/50 (5m, sürekli) ──
  const closes = bars.map((b) => b.close);
  const E9 = ema(closes, 9), E20 = ema(closes, 20), E50 = ema(closes, 50);
  const dayStart = at(PRE_OPEN_MIN), dayEnd = at(RTH_CLOSE_MIN);
  const emaOut: DayPlan["ema"] = [];
  bars.forEach((b, i) => {
    if (b.time < dayStart || b.time + 300 > dayEnd || E9[i] == null || E20[i] == null || E50[i] == null) return;
    emaOut.push({ m: nyParts(b.time).minutes + 5, e9: r2(E9[i]!), e20: r2(E20[i]!), e50: r2(E50[i]!) });
  });

  // ── 5m kapanış kırılımları: anlamlı bölgeler (ret almış ya da ≥2 kaynak); bölge dışına kapanış = olay, aynı yönde tekrar sayılmaz ──
  const breaks: DayPlan["breaks"] = [];
  const bTol = 0.05;
  const keyZones = levels.filter((z) => z.rejects > 0 || z.sources.length >= 2);
  const startIdx = bars.findIndex((b) => b.time >= dayStart);
  if (startIdx > 0) {
    for (const z of keyZones) {
      const sideOf = (c: number) => (c > z.high + bTol ? 1 : c < z.low - bTol ? -1 : 0);
      let lastNz = sideOf(bars[startIdx - 1].close);
      for (let i = startIdx; i < bars.length && bars[i].time + 300 <= dayEnd; i++) {
        const sd = sideOf(bars[i].close);
        if (sd === 0 || sd === lastNz) continue;
        if (lastNz !== 0 || i > startIdx) {
          const isInval = inval != null && ((dir === "BEAR" && sd > 0 && bars[i].close > inval) || (dir === "BULL" && sd < 0 && bars[i].close < inval)) && z === biasZ;
          breaks.push({ m: nyParts(bars[i].time).minutes + 5, t: hhmm(nyParts(bars[i].time).minutes + 5), p: r2(bars[i].close), dir: sd > 0 ? "UP" : "DOWN", zone: zf(z), label: z.label, inval: isInval });
        }
        lastNz = sd;
      }
    }
  }
  breaks.sort((a, b) => a.m - b.m);

  // ── koşullu plan ──
  const rrOf = (e: number, s: number, ts: number[]) => ts.map((t) => Math.round((Math.abs(t - e) / Math.max(0.01, Math.abs(e - s))) * 10) / 10);
  const plan: PlanRow[] = [];
  const row = (setup: string, entry: string, entryPx: number, tg: number[], stop: number) => {
    const t = tg.filter((x) => Number.isFinite(x)).map(r2);
    if (!t.length) return;
    plan.push({ setup, entry, entryPx: r2(entryPx), targets: t, stop: r2(stop), rr: rrOf(entryPx, stop, t) });
  };
  if (biasZ && inval != null && tgtZ.length) {
    const bear = dir === "BEAR";
    const w = biasZ.high - biasZ.low;
    const S1 = tgtZ[0];
    const beyondS1 = (bear ? downList : upList).slice(1, 3).map(edge);
    row(bear ? "Put (2. test ret)" : "Call (2. test tutunma)", `${zf(biasZ)} 5m ${bear ? "ret" : "tutunma"}`, bear ? biasZ.low + 0.6 * w : biasZ.high - 0.6 * w, targets.slice(0, 2), bear ? inval + cfg.stopBuf : inval - cfg.stopBuf);
    if (beyondS1.length) row(bear ? "Put (kırılım)" : "Call (kırılım)", `${bear ? "<" : ">"}${f2(bear ? S1.low - 0.1 : S1.high + 0.1)} 5m kapanış`, bear ? S1.low - 0.1 : S1.high + 0.1, beyondS1, bear ? S1.high + cfg.stopBuf : S1.low - cfg.stopBuf);
    const w1 = S1.high - S1.low;
    row(bear ? "Call (dip tutunma)" : "Put (tepe reddi)", `${zf(S1)} ${bear ? "tutunma / çift dip" : "ret / çift tepe"}`, bear ? S1.low + 0.4 * w1 : S1.high - 0.4 * w1, [bear ? biasZ.low : biasZ.high], bear ? S1.low - cfg.stopBuf : S1.high + cfg.stopBuf);
    if (beyondZ) {
      // iptal kırılımı: hedefler iptalin ötesindeki ilk iki bölge; stop bias bölgesinin ortası (bölgeye geri dönüş = başarısız kırılım)
      const nx = (bear ? levels.filter((z) => z.low > inval).sort((a, b) => a.low - b.low) : levels.filter((z) => z.high < inval).sort((a, b) => b.high - a.high))
        .slice(0, 2).map((z) => (bear ? z.low : z.high));
      row(bear ? "Call (iptal kırılımı)" : "Put (iptal kırılımı)", `${bear ? ">" : "<"}${f2(inval)} 5m kapanış`, inval, nx, (biasZ.low + biasZ.high) / 2);
    }
  } else {
    const R = levels.filter((z) => z.low > spot + minStep).sort((a, b) => a.low - b.low)[0];
    const S = levels.filter((z) => z.high < spot - minStep).sort((a, b) => b.high - a.high)[0];
    const R2 = R ? levels.filter((z) => z.low > R.high + minStep).sort((a, b) => a.low - b.low)[0] : undefined;
    const S2 = S ? levels.filter((z) => z.high < S.low - minStep).sort((a, b) => b.high - a.high)[0] : undefined;
    if (R && S) {
      row("Put (direnç reddi)", `${zf(R)} 5m ret`, R.low + 0.4 * (R.high - R.low), [S.high], R.high + cfg.stopBuf);
      row("Call (destek tutunma)", `${zf(S)} 5m tutunma`, S.high - 0.4 * (S.high - S.low), [R.low], S.low - cfg.stopBuf);
    }
    if (R && R2) row("Call (yukarı kırılım)", `>${f2(R.high + cfg.invalBuf)} 5m kapanış`, R.high + cfg.invalBuf, [R2.low], R.low - cfg.stopBuf);
    if (S && S2) row("Put (aşağı kırılım)", `<${f2(S.low - cfg.invalBuf)} 5m kapanış`, S.low - cfg.invalBuf, [S2.high], S.high + cfg.stopBuf);
  }

  // ── metinler (kural tabanlı) ──
  const warning: string[] = [];
  for (const z of levels) if (z.rejOn > 0 && Math.abs((z.low + z.high) / 2 - spot) <= scale) warning.push(`${zf(z)} gece/PM ${z.rejOn} kez reddedildi`);
  for (const g of gaps) if (g.filledToday) warning.push(`${f2(g.low)} gap doldu (${g.from} gap'i)`);
  for (const e of evToday) {
    if (e.kind === "macro") warning.push(`${e.name} ${e.time ?? "saat yok"}${e.time && toMin(e.time) < RTH_OPEN_MIN ? ": açılış öncesi oynaklık artışı" : ": o saatte oynaklık artışı"}`);
    else if (e.time && toMin(e.time) >= RTH_CLOSE_MIN) { warning.push(`${e.name} ${e.time}'te: öğleden sonra sıkışma riski`); warning.push(`1DTE taşımak = ${e.name} riskine binary maruziyet`); }
    else warning.push(`${e.name} ${e.time ?? "(saat veri yok)"}`);
  }
  if (inval != null) warning.push(`${f2(inval)} ${dir === "BEAR" ? "üstü" : "altı"} 5m kapanış = iptal`);
  if (emCard && dir !== "NÖTR") warning.push(dir === "BEAR" ? `${f2(emCard.low)} altında kapanış EM dışı = trend günü` : `${f2(emCard.high)} üstünde kapanış EM dışı = trend günü`);
  if (flip != null && spot < flip) warning.push(`Spot gamma flip ${f2(flip)} altında: negatif gamma, hareketler iki yönde de büyüyebilir`);
  if (rsi4 != null && rsi4 < 35) warning.push(`4s RSI ${rsi4.toFixed(1)}: aşırı satıma yakın, ters sıçrama riski`);
  if (rsi4 != null && rsi4 > 65) warning.push(`4s RSI ${rsi4.toFixed(1)}: aşırı alıma yakın, geri çekilme riski`);
  let scenarioText: string;
  if (biasZ && inval != null) {
    const bear = dir === "BEAR";
    const S1 = tgtZ[0];
    const T2 = targets[1];
    scenarioText = `Bias çizgisi ${zf(biasZ)}. ${bear ? "Altında" : "Üstünde"} kaldıkça Ana senaryo öncelikli`
      + (S1 ? `; ${f2(bear ? S1.low : S1.high)} ${bear ? "kırılımı" : "aşılması"}${T2 != null ? ` → ${f2(T2)}` : ""}` : "")
      + `. ${f2(inval)} ${bear ? "üstü" : "altı"} 5m kapanış Geçersiz'i açar${beyondZ ? `, hedef ${f2(bear ? beyondZ.low : beyondZ.high)}` : ""}.`;
  } else scenarioText = `Yön koşulu yok (${reason}). Aralık senaryosu: ${scenarios[0]?.label ?? "seviye yetersiz"}; kırılım yönünde 5m kapanış beklenir.`;
  const flow: string[] = [];
  if (onHL) flow.push(`Gece (16:00–20:00): ${f2(onHL.low)}–${f2(onHL.high)}`);
  if (pmHL) flow.push(`PM: dip ${f2(pmHL.low)} (${pmHL.lowAt}) · tepe ${f2(pmHL.high)} (${pmHL.highAt})`);
  flow.push(`Spot ${f2(spot)} (${spotEt}) · dünkü kapanışa ${spot - prevClose >= 0 ? "+" : ""}${(spot - prevClose).toFixed(2)}${em ? ` (EM'in %${Math.round((Math.abs(spot - prevClose) / em) * 100)}'i)` : ""}`);
  const vwapPm = vwapOf(pmBars), vwapRth = vwapOf(todayRth);
  if (vwapPm != null) flow.push(`PM VWAP ${f2(vwapPm)} — spot ${spot >= vwapPm ? "üstünde" : "altında"}`);
  if (vwapRth != null) flow.push(`RTH VWAP ${f2(vwapRth)} — spot ${spot >= vwapRth ? "üstünde" : "altında"}`);
  if (volRatio != null) flow.push(`Dünkü hacim ${volRatio.toFixed(2)}x (önceki 3 seans ort.)`);
  for (const g of gaps.filter((x) => !x.filled)) flow.push(`Açık gap ${f2(g.low)}–${f2(g.high)} (${g.from})`);

  // ── sonraki 15 dk: geçmiş 15m durum → sonraki 15m (yalnız önceki günler, sızıntı yok) ──
  const stateOf = (bs: Bar[], i: number, vw: number, e: number | null, ePrev: number | null) =>
    `${bs[i].close >= vw ? "VWAP üstü" : "VWAP altı"} · ${e != null && ePrev != null ? (e >= ePrev ? "EMA20 ↑" : "EMA20 ↓") : "EMA20 ?"} · son mum ${bs[i].close >= bs[i].open ? "yeşil" : "kırmızı"}`;
  const ema15 = ema(rth15.map((b) => b.close), 20);
  const e15 = new Map(rth15.map((b, i) => [b.time, i]));
  const outsByState = new Map<string, number[]>();
  let curState: string | null = null;
  for (const [d, bs] of [...r15ByDay.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    let pv = 0, v = 0;
    for (let i = 0; i < bs.length; i++) {
      const b = bs[i]; const w = b.volume || 0; pv += ((b.high + b.low + b.close) / 3) * w; v += w;
      const vw = v > 0 ? pv / v : b.close;
      const gi = e15.get(b.time)!;
      const st = stateOf(bs, i, vw, ema15[gi], gi > 0 ? ema15[gi - 1] : null);
      if (d < date && i + 1 < bs.length) { const a = outsByState.get(st) ?? []; a.push(bs[i + 1].close - b.close); outsByState.set(st, a); }
      if (d === date && i === bs.length - 1) curState = st;
    }
  }
  const nextSlotMin = todayRth.length ? nyParts(todayRth[todayRth.length - 1].time).minutes + 5 : RTH_OPEN_MIN;
  const slotIx = Math.max(0, Math.min(25, Math.floor((Math.ceil(nextSlotMin / 15) * 15 - RTH_OPEN_MIN) / 15)));
  const rng15 = r2(sig15p * profile[slotIx]);
  const live15 = curState != null && asofMin < RTH_CLOSE_MIN - 15;
  const next15 = {
    at: hhmm(RTH_OPEN_MIN + slotIx * 15), range: rng15, lo: r2(spot - rng15), hi: r2(spot + rng15), state: live15 ? curState : null,
    lean: live15 ? leanOf(outsByState.get(curState!) ?? [], cfg, "puan") : null,
    note: live15 ? "Son kapanmış 15m mumun durumu; frekans önceki ~60 seanstan (bugün hariç)." : "Seans dışı: durum istatistiği 09:45 ilk 15m kapanışından sonra; aralık açılış diliminin ölçülen ±1σ'sı.",
  };

  // ── sonraki günler ──
  const dRsi = rsi(dCloses, 14), dS20 = sma(dCloses, 20), dS50 = sma(dCloses, 50);
  const dState = (i: number) => {
    const r = dRsi[i];
    return `${dS20[i] != null && dCloses[i] >= dS20[i]! ? "SMA20 üstü" : "SMA20 altı"} · ${dS50[i] != null && dCloses[i] >= dS50[i]! ? "SMA50 üstü" : "SMA50 altı"} · RSI ${r == null ? "?" : r < 35 ? "<35" : r > 65 ? ">65" : "35–65"}`;
  };
  const o1 = new Map<string, number[]>(), o3 = new Map<string, number[]>();
  for (let i = 50; i < dCloses.length - 1; i++) {
    const st = dState(i);
    (o1.get(st) ?? o1.set(st, []).get(st)!).push(dCloses[i + 1] - dCloses[i]);
    if (i + 3 < dCloses.length) (o3.get(st) ?? o3.set(st, []).get(st)!).push(dCloses[i + 3] - dCloses[i]);
  }
  const dNow = dCloses.length ? dState(dCloses.length - 1) : "veri yok";
  const emDays: DayPlan["nextDays"]["em"] = [];
  if (inp.iv) {
    let d = date;
    for (let k = 1; k <= 3; k++) {
      const half = (spot * inp.iv.value) / 100 * Math.sqrt(k / 252);
      emDays.push({ day: k, date: d, low: r2(spot - half), high: r2(spot + half) });
      d = nextWeekday(d);
    }
  }
  let mc: DayPlan["nextDays"]["mc"] = null;
  const wf = buildWideForecast({
    symbol, livePrice: spot, t: barEnd, bars15: rth15.filter((b) => b.time + 900 <= barEnd),
    levels: levels.map((z) => ({ price: r2((z.low + z.high) / 2), label: z.label })),
    ivAnnual: inp.iv ? inp.iv.value / 100 : null, ivLabel: inp.iv?.label ?? null, basis4h: null,
  });
  if (wf) {
    mc = {
      up: { price: r2(wf.u1.price), pct: wf.up.pct }, down: { price: r2(wf.d1.price), pct: wf.down.pct }, none: wf.none.pct,
      dayEnds: wf.dayEnds.map((q) => ({ date: nyParts(q.endsAt - 60).ymd, p10: r2(q.p10), p50: r2(q.p50), p90: r2(q.p90) })),
      zoneTouch: wf.levelOdds.map((l) => ({ price: r2(l.price), label: l.label, pct: l.touchPct })),
    };
  } else missing.push("monte_carlo");
  const horizon = [date, nextWeekday(date), nextWeekday(nextWeekday(date))];
  const nextDays = {
    em: emDays, state: dNow,
    lean1: leanOf(o1.get(dNow) ?? [], cfg, "puan"), lean3: leanOf(o3.get(dNow) ?? [], cfg, "puan"),
    mc, events: (inp.macroEvents ?? []).filter((e) => horizon.includes(e.date) && e.date !== date).concat((inp.earnings ?? []).filter((e) => horizon.includes(e.date) && e.date !== date)),
  };
  if (inp.macroEvents == null) missing.push("events_macro");
  if (inp.earnings == null) missing.push("events_earnings");

  const hashSrc = JSON.stringify({
    v: DAYPLAN_VERSION, symbol, date, n: bars.length, lb: [lastBar.time, lastBar.close, lastBar.volume],
    d: dly.length ? [dly[dly.length - 1].time, dly[dly.length - 1].close] : null, iv: inp.iv, rel: relOut, ev: evToday, w: inp.walls, st: inp.straddle, cfg,
  });

  return {
    meta: {
      symbol, date, version: "", asof_et: hhmm(nyParts(asOf).minutes), asOf, spot, spot_et: spotEt, prev_close: prevClose,
      engine: DAYPLAN_VERSION, inputs_hash: fnv(hashSrc), profile: measured ? "ölçülen" : "sabit", sessions: histDays.length,
    },
    score,
    cards: {
      prev,
      on_range: onHL ? { ...onHL, note: onGapNote } : null,
      pm_range: pmHL ? { ...pmHL, note: levels.filter((z) => z.rejOn > 0).slice(0, 2).map((z) => `${zf(z)} ${z.rejOn} ret`).join(" · ") || "gece/PM ret yok" } : null,
      em: emCard,
      straddle: inp.straddle ? { value: r2(inp.straddle.value), expiry: inp.straddle.expiry, strike: inp.straddle.strike, ratio: em ? r2(inp.straddle.value / em) : null } : null,
      events: evToday,
      walls: inp.walls,
      tech: {
        rsi4h: rsi4 != null ? r2(rsi4) : null, macd4h: m4 ? r2(last(m4.macd) ?? NaN) : null, signal4h: m4 ? r2(last(m4.signal) ?? NaN) : null,
        hist4h: hist4 != null ? r2(hist4) : null, atr4h: atr4 != null ? r2(atr4) : null, sma200: smaV[200], volRatio, vwapPm, vwapRth,
      },
      rel: relOut,
      gaps,
    },
    bias: { dir, line: biasZ ? [biasZ.low, biasZ.high] : null, invalidation: inval, targets: targets.map(r2), reason },
    levels,
    actual_path,
    ema: emaOut,
    breaks: breaks.slice(-24),
    scenarios: scenarios.filter((s) => s.points.length >= 2),
    band,
    plan,
    texts: { warning, scenario: scenarioText, flow },
    next15,
    nextDays,
    missing: [...new Set(missing)],
  };
}

function toMin(t: string): number { const [h, m] = t.split(":").map(Number); return h * 60 + (m || 0); }
