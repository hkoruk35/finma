/**
 * SPY Engine — 15m setup kurulumu + sonraki 4 adet 15m mum simülasyonu (forecast).
 *
 * Her 15m mum KAPANIŞINDA yeniden hesaplanır (yalnız kapanmış mumlar; oluşan mum karar vermez):
 *   1) Üst zaman teyidi: 1h ve 4h (seans hizalı) — EMA20 konumu + eğimi + salınım yapısı (HH/HL – LH/LL).
 *   2) 15m yapı: fraktal salınım dip/tepeleri (2 sol / 2 sağ), EMA20, VWAP, ATR14.
 *   3) Seviyeler: klasik günlük pivotlar (P, R1–R3, S1–S3), dünkü tepe/dip, salınımlar, VWAP, EMA20 (15m/1h).
 *   4) Setup adayları: KIRILIM (breakout), GERİ ÇEKİLME (pullback), SÜPÜRME DÖNÜŞÜ (reversal), BANT (range).
 *      Her biri giriş / stop / hedef ve çizim bölgesiyle; skor = tür tabanı + üst zaman uyumu + hacim + pivot çakışması.
 *   5) Simülasyon: birincil setup (yoksa trend uyumu) yönünde ATR ölçekli sürüklenme; yoldaki karşı seviyelerde
 *      fitil/duraklama; kapanış bandı geçmiş 15m değişimlerinin dağılımından (≈%20–%80).
 * Bu bir TAHMİNDİR; seviyeler ölçülmüş veriden gelir. Yön kararı Karar Merdiveni'nde kalır.
 */

import { atr, ema, nyDateTimeToEpoch, nyParts, RTH_CLOSE_MIN, RTH_OPEN_MIN, type Bar } from "./core";

const M15 = 900;

// ── Seans hizalı toplama ──────────────────────────────────────────

/** RTH mumlarını seans açılışına (09:30) hizalı N dakikalık kovalara toplar (1h: 09:30, 10:30 … · 4h: 09:30, 13:30). */
export function sessionAggregate(bars: Bar[], minutes: number): Bar[] {
  const out: Bar[] = [];
  let cur: Bar | null = null;
  let curKey = -1;
  for (const b of bars) {
    const p = nyParts(b.time);
    if (p.minutes < RTH_OPEN_MIN || p.minutes >= RTH_CLOSE_MIN) continue;
    const slot = RTH_OPEN_MIN + Math.floor((p.minutes - RTH_OPEN_MIN) / minutes) * minutes;
    const key = nyDateTimeToEpoch(p.ymd, slot);
    if (key !== curKey) {
      if (cur) out.push(cur);
      curKey = key;
      cur = { time: key, open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume || 0 };
    } else if (cur) {
      cur.high = Math.max(cur.high, b.high);
      cur.low = Math.min(cur.low, b.low);
      cur.close = b.close;
      cur.volume += b.volume || 0;
    }
  }
  if (cur) out.push(cur);
  return out;
}

/** Seans hizalı mumun bitiş anı (son kova 16:00'da kesilir) */
export function barEnd(t: number, minutes: number): number {
  const p = nyParts(t);
  return Math.min(t + minutes * 60, nyDateTimeToEpoch(p.ymd, RTH_CLOSE_MIN));
}

/** 1h serisi: uzun geçmiş (htf ucu) + son günler 1m'den; aynı saat varsa 1m'den türetilen (taze) kazanır. Yalnız kapanmışlar. */
export function mergeHourly(htf: Bar[], m1: Bar[], nowSec: number): Bar[] {
  const fresh = sessionAggregate(m1, 60);
  const firstFresh = fresh.length ? fresh[0].time : Infinity;
  const map = new Map<number, Bar>();
  for (const b of htf) if (b.time < firstFresh) map.set(b.time, b);
  // ilk 1m günü eksik başlayabilir: o günün saatlerini htf'den tamamla
  for (const b of fresh) map.set(b.time, b);
  return [...map.values()].sort((a, b) => a.time - b.time).filter((b) => barEnd(b.time, 60) <= nowSec);
}

// ── Salınımlar ve trend ───────────────────────────────────────────

export interface Swing { time: number; idx: number; price: number; kind: "H" | "L" }

/** Teyitli fraktal salınımlar: tepe = solundaki `left` ve sağındaki `right` mumdan yüksek (dip tersi). */
export function fractalSwings(bars: Bar[], left = 2, right = 2): Swing[] {
  const out: Swing[] = [];
  for (let i = left; i < bars.length - right; i++) {
    let isH = true, isL = true;
    for (let k = i - left; k <= i + right; k++) {
      if (k === i) continue;
      if (bars[k].high >= bars[i].high) isH = false;
      if (bars[k].low <= bars[i].low) isL = false;
    }
    if (isH) out.push({ time: bars[i].time, idx: i, price: bars[i].high, kind: "H" });
    if (isL) out.push({ time: bars[i].time, idx: i, price: bars[i].low, kind: "L" });
  }
  return out;
}

export type Dir = 1 | 0 | -1;

function structureOf(sw: Swing[]): { dir: Dir; text: string } {
  const hs = sw.filter((s) => s.kind === "H").slice(-2);
  const ls = sw.filter((s) => s.kind === "L").slice(-2);
  if (hs.length < 2 || ls.length < 2) return { dir: 0, text: "yapı yetersiz" };
  const hh = hs[1].price > hs[0].price, hl = ls[1].price > ls[0].price;
  if (hh && hl) return { dir: 1, text: "HH/HL (yükselen)" };
  if (!hh && !hl) return { dir: -1, text: "LH/LL (düşen)" };
  return { dir: 0, text: hh ? "HH/LL (genişleyen)" : "LH/HL (daralan)" };
}

export interface TfTrend {
  tf: "1h" | "4h" | "15m";
  dir: Dir;
  close: number;
  ema: number | null;
  /** EMA20'nin son 3 mumdaki eğimi, ATR cinsinden */
  slopeAtr: number | null;
  structure: string;
  text: string;
}

function trendOf(bars: Bar[], tf: TfTrend["tf"]): TfTrend | null {
  if (bars.length < 8) return null;
  const closes = bars.map((b) => b.close);
  const e = ema(closes, Math.min(20, Math.max(5, bars.length - 3)));
  const a = atr(bars, Math.min(14, bars.length - 2));
  const n = bars.length - 1;
  const eN = e[n], e3 = e[n - 3] ?? null, aN = a[n] ?? null;
  const slopeAtr = eN != null && e3 != null && aN ? (eN - e3) / aN : null;
  const st = structureOf(fractalSwings(bars, 2, 2));
  let score = 0;
  if (eN != null) score += closes[n] > eN ? 1 : closes[n] < eN ? -1 : 0;
  if (slopeAtr != null && Math.abs(slopeAtr) > 0.15) score += Math.sign(slopeAtr);
  score += st.dir;
  const dir: Dir = score >= 2 ? 1 : score <= -2 ? -1 : 0;
  const pos = eN == null ? "" : closes[n] > eN ? "EMA20 üstü" : "EMA20 altı";
  const slope = slopeAtr == null ? "" : slopeAtr > 0.15 ? "eğim yukarı" : slopeAtr < -0.15 ? "eğim aşağı" : "eğim yatay";
  return {
    tf, dir, close: closes[n], ema: eN, slopeAtr, structure: st.text,
    text: [pos, slope, st.text].filter(Boolean).join(" · "),
  };
}

// ── Setup ─────────────────────────────────────────────────────────

export interface Level { price: number; label: string; kind: "pivot" | "swing" | "vwap" | "ema" | "prev" }

export type SetupKind = "BREAKOUT" | "PULLBACK" | "REVERSAL" | "RANGE";
export const SETUP_NAME: Record<SetupKind, string> = {
  BREAKOUT: "Kırılım", PULLBACK: "Geri çekilme", REVERSAL: "Süpürme dönüşü", RANGE: "Bant",
};

export interface Setup15 {
  kind: SetupKind;
  dir: 1 | -1;
  title: string;
  status: "KURULUYOR" | "TETİKLENDİ";
  score: number;
  trigger: number;
  stop: number;
  targets: number[];
  /** Çizim bölgesi (fiyat aralığı) ve başladığı mum zamanı */
  zone: [number, number];
  anchor: number;
  rr: number;
  reasons: string[];
}

/**
 * 60 seanslık walk-forward kalibrasyonu (SPY 15m, 2026-07 → 2026-10): birincil setup → 8 mum içinde H1 mi stop mu.
 * Giriş: kuruluyor = tetik seviyesi; tetiklendi (kırılım) = seviyeye geri test. Anahtar: tür/durum/üst-zaman (1 uyumlu, 0 nötr, -1 ters).
 * n = sonuçlanan işlem sayısı. Hiçbir türün belirgin pozitif beklentisi yok — kartlarda bu yüzden gösterilir.
 */
export const SETUP15_HIST: Record<string, { n: number; win: number; avgR: number }> = {
  "BREAKOUT/KURULUYOR/1": { n: 35, win: 40, avgR: -0.28 },
  "BREAKOUT/KURULUYOR/0": { n: 6, win: 33, avgR: -0.27 },
  "BREAKOUT/KURULUYOR/-1": { n: 2, win: 100, avgR: 1.98 },
  "BREAKOUT/TETİKLENDİ/1": { n: 67, win: 43, avgR: -0.02 },
  "BREAKOUT/TETİKLENDİ/0": { n: 24, win: 21, avgR: -0.5 },
  "BREAKOUT/TETİKLENDİ/-1": { n: 37, win: 46, avgR: 0.09 },
  "PULLBACK/KURULUYOR/1": { n: 227, win: 60, avgR: 0.02 },
  "PULLBACK/KURULUYOR/0": { n: 40, win: 65, avgR: 0.08 },
  "PULLBACK/KURULUYOR/-1": { n: 34, win: 32, avgR: -0.34 },
  "RANGE/KURULUYOR/1": { n: 18, win: 61, avgR: -0.19 },
  "REVERSAL/KURULUYOR/1": { n: 6, win: 67, avgR: 0.17 },
};
export function setupHist(s: Setup15, align: number) {
  return SETUP15_HIST[`${s.kind}/${s.status}/${Math.sign(align * s.dir)}`] ?? null;
}

export interface FcCandle { t: number; o: number; h: number; l: number; c: number; lo: number; hi: number }

export interface Forecast15 {
  /** Tahmini üreten son kapanmış 15m mumun zamanı */
  key: number;
  base: number;
  dir: Dir;
  candles: FcCandle[];
  text: string;
}

export interface Setup15Read {
  key: number;
  atr: number;
  h1: TfTrend | null;
  h4: TfTrend | null;
  m15: TfTrend | null;
  /** Üst zaman uyumu: h1.dir + h4.dir (−2…+2) */
  align: number;
  swings: Swing[];
  levels: Level[];
  setups: Setup15[];
  primary: Setup15 | null;
  forecast: Forecast15;
  ema15: (number | null)[];
}

/** Simülasyon katsayıları (ATR cinsinden) — 60 seanslık walk-forward ile kalibre edilir */
export interface Setup15Cfg {
  /** Birincil setup varken mum başına azami sürüklenme */
  kSetup: number;
  /** Setup yokken trend uyumu sürüklenmesi */
  kTrend: number;
  /** Kapanış bandı genişliği (σ√n çarpanı) */
  band: number;
}
export const SETUP15_CFG: Setup15Cfg = { kSetup: 0.1, kTrend: 0.05, band: 0.55 };

export interface Setup15Input {
  /** Kapanmış RTH 15m mumları (çok günlük, eskiden yeniye) */
  m15: Bar[];
  /** Kapanmış RTH 1h mumları (seans hizalı) */
  h1: Bar[];
  /** Mumun seans günü için önceki seansın pivotları ve tepe/dibi */
  pivots: { levels: Record<string, number>; H: number; L: number } | null;
  /** Bugünün VWAP'ı (son kapanmış 15m'e kadar) */
  vwap: number | null;
  cfg?: Setup15Cfg;
}

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const r2 = (x: number) => Math.round(x * 100) / 100;

function nextTimes(lastTime: number, count: number): number[] {
  // sıradaki 15m mum zamanları; 15:45'ten sonra bir sonraki seansa (hafta sonu atlanır)
  const out: number[] = [];
  let t = lastTime;
  while (out.length < count) {
    t += M15;
    const p = nyParts(t);
    if (p.minutes >= RTH_OPEN_MIN && p.minutes < RTH_CLOSE_MIN && p.weekday >= 1 && p.weekday <= 5) { out.push(t); continue; }
    if (p.minutes >= RTH_CLOSE_MIN || p.minutes < RTH_OPEN_MIN) {
      // ertesi günün 09:30'u
      let d = new Date(`${p.ymd}T12:00:00Z`);
      if (p.minutes >= RTH_CLOSE_MIN) d = new Date(d.getTime() + 86400000);
      for (let k = 0; k < 7; k++) {
        const wd = d.getUTCDay();
        if (wd >= 1 && wd <= 5) break;
        d = new Date(d.getTime() + 86400000);
      }
      t = nyDateTimeToEpoch(d.toISOString().slice(0, 10), RTH_OPEN_MIN) - M15;
    }
  }
  return out;
}

export function readSetup15(inp: Setup15Input): Setup15Read | null {
  const bars = inp.m15;
  const cfg = inp.cfg ?? SETUP15_CFG;
  if (bars.length < 30) return null;
  const n = bars.length - 1;
  const c = bars[n];
  const aS = atr(bars, 14);
  const A = (aS[n] as number | null) ?? null;
  if (!A || A <= 0) return null;
  const ema15 = ema(bars.map((b) => b.close), 20);
  const e = ema15[n];

  const h1 = trendOf(inp.h1, "1h");
  const h4 = trendOf(sessionAggregate(inp.h1, 240), "4h");
  const m15 = trendOf(bars, "15m");
  const align = (h1?.dir ?? 0) + (h4?.dir ?? 0);

  const swings = fractalSwings(bars, 2, 2);
  const lastSH = [...swings].reverse().find((s) => s.kind === "H") ?? null;
  const lastSL = [...swings].reverse().find((s) => s.kind === "L") ?? null;

  // ── seviyeler ──
  const lv: Level[] = [];
  if (inp.pivots) {
    for (const [k, p] of Object.entries(inp.pivots.levels)) lv.push({ price: p, label: `pivot ${k}`, kind: "pivot" });
    lv.push({ price: inp.pivots.H, label: "dünkü tepe", kind: "prev" }, { price: inp.pivots.L, label: "dünkü dip", kind: "prev" });
  }
  for (const s of swings.slice(-8)) lv.push({ price: s.price, label: s.kind === "H" ? "15m tepe" : "15m dip", kind: "swing" });
  if (inp.vwap != null) lv.push({ price: inp.vwap, label: "VWAP", kind: "vwap" });
  if (e != null) lv.push({ price: e, label: "EMA20 15m", kind: "ema" });
  if (h1?.ema != null) lv.push({ price: h1.ema, label: "EMA20 1h", kind: "ema" });
  // yakın seviyeleri birleştir (pivot/dünkü öncelikli)
  const pri = (l: Level) => (l.kind === "pivot" || l.kind === "prev" ? 0 : l.kind === "vwap" ? 1 : 2);
  const levels: Level[] = [];
  for (const l of [...lv].sort((a, b) => pri(a) - pri(b))) {
    if (!levels.some((x) => Math.abs(x.price - l.price) < 0.08 * A)) levels.push({ ...l, price: r2(l.price) });
  }
  levels.sort((a, b) => b.price - a.price);
  const above = (p: number, gap = 0.4) => levels.filter((l) => l.price > p + gap * A).sort((a, b) => a.price - b.price);
  const below = (p: number, gap = 0.4) => levels.filter((l) => l.price < p - gap * A).sort((a, b) => b.price - a.price);
  const nearPivot = (p: number) => levels.find((l) => (l.kind === "pivot" || l.kind === "prev") && Math.abs(l.price - p) <= 0.25 * A) ?? null;

  const vols = bars.slice(Math.max(0, n - 20), n).map((b) => b.volume || 0);
  const avgVol = vols.length ? vols.reduce((x, y) => x + y, 0) / vols.length : 0;
  const volX = avgVol > 0 ? (c.volume || 0) / avgVol : 1;
  const range = c.high - c.low || 0.01;
  const body = Math.abs(c.close - c.open);

  const setups: Setup15[] = [];
  const mk = (s: Omit<Setup15, "score" | "rr" | "title"> & { base: number }) => {
    const risk = Math.abs(s.trigger - s.stop) || 0.01;
    const rr = s.targets.length ? Math.abs(s.targets[0] - s.trigger) / risk : 0;
    let score = s.base + 12 * align * s.dir;
    if (m15 && m15.dir === s.dir) score += 6;
    if (volX >= 1.3) score += 6;
    else if (volX < 0.8) score -= 8;
    const pv = nearPivot(s.trigger);
    if (pv) { score += 6; s.reasons.push(`${pv.label} çakışması`); }
    if (rr < 1) score -= 10;
    if (align === -2 * s.dir) s.reasons.push("üst zaman TERS — düşük güven");
    setups.push({
      kind: s.kind, dir: s.dir, status: s.status, trigger: r2(s.trigger), stop: r2(s.stop),
      targets: s.targets.map(r2), zone: [r2(Math.min(...s.zone)), r2(Math.max(...s.zone))], anchor: s.anchor,
      reasons: s.reasons, rr: Math.round(rr * 10) / 10, score: Math.round(clamp(score, 5, 95)),
      title: `${SETUP_NAME[s.kind]} ${s.dir === 1 ? "▲ CALL" : "▼ PUT"}`,
    });
  };
  const tgts = (dir: 1 | -1, from: number) => {
    const list = (dir === 1 ? above(from) : below(from)).slice(0, 2).map((l) => l.price);
    while (list.length < 2) list.push(from + dir * A * (list.length + 1));
    return list;
  };

  // 1) KIRILIM: son 2 mumda salınım seviyesinin kapanışla aşılması (ya da hemen altında baskı)
  for (const dir of [1, -1] as const) {
    const sw = dir === 1 ? lastSH : lastSL;
    if (!sw || sw.idx >= n - 1) continue;
    const lvl = sw.price;
    const broke = dir === 1 ? c.close > lvl && bars[n - 2].close <= lvl : c.close < lvl && bars[n - 2].close >= lvl;
    const brokeNow = dir === 1 ? c.close > lvl && bars[n - 1].close <= lvl : c.close < lvl && bars[n - 1].close >= lvl;
    if (broke || brokeNow) {
      mk({
        kind: "BREAKOUT", dir, status: "TETİKLENDİ", base: 58 + (body / range > 0.55 ? 4 : 0),
        trigger: lvl, stop: lvl - dir * 0.6 * A, targets: tgts(dir, dir === 1 ? Math.max(lvl, c.close) : Math.min(lvl, c.close)),
        zone: [lvl, lvl + dir * 0.25 * A], anchor: sw.time,
        reasons: [`15m ${dir === 1 ? "tepe" : "dip"} ${lvl.toFixed(2)} kapanışla ${dir === 1 ? "yukarı" : "aşağı"} kırıldı`, `hacim ×${volX.toFixed(1)}`, "giriş: seviyeye geri test"],
      });
    } else {
      const dist = dir === 1 ? lvl - c.close : c.close - lvl;
      if (dist > 0 && dist <= 0.35 * A && m15?.dir === dir) {
        mk({
          kind: "BREAKOUT", dir, status: "KURULUYOR", base: 42,
          trigger: lvl + dir * 0.05, stop: c.close - dir * 0.6 * A, targets: tgts(dir, lvl),
          zone: [lvl, c.close], anchor: sw.time,
          reasons: [`fiyat 15m ${dir === 1 ? "tepesinin" : "dibinin"} ${dist.toFixed(2)} puan yakınında baskı yapıyor`, "tetik: seviyenin kapanışla aşılması"],
        });
      }
    }
  }

  // 2) GERİ ÇEKİLME: trend yönünde EMA20 / VWAP / destek-direnç testi ve tutunma
  for (const dir of [1, -1] as const) {
    const trendOk = (m15?.dir === dir) || (e != null && (dir === 1 ? c.close > e : c.close < e) && align * dir > 0);
    if (!trendOk) continue;
    const cands = levels.filter((l) => (dir === 1 ? l.price <= c.close + 0.05 * A : l.price >= c.close - 0.05 * A));
    const touched = cands.find((l) => (dir === 1 ? c.low <= l.price + 0.15 * A && c.close > l.price : c.high >= l.price - 0.15 * A && c.close < l.price));
    if (!touched) continue;
    const trig = dir === 1 ? c.high + 0.02 : c.low - 0.02;
    mk({
      kind: "PULLBACK", dir, status: "KURULUYOR", base: 52,
      trigger: trig, stop: (dir === 1 ? Math.min(c.low, touched.price) : Math.max(c.high, touched.price)) - dir * 0.25 * A,
      targets: tgts(dir, trig), zone: [touched.price, dir === 1 ? c.low : c.high], anchor: bars[Math.max(0, n - 3)].time,
      reasons: [`${touched.label} ${touched.price.toFixed(2)} test edildi ve kapanış tuttu`, `tetik: geri çekilme mumunun ${dir === 1 ? "tepesi" : "dibi"} aşılırsa`],
    });
  }

  // 3) SÜPÜRME DÖNÜŞÜ: salınım seviyesinin fitille aşılıp kapanışın içeri dönmesi
  for (const dir of [1, -1] as const) {
    const sw = dir === 1 ? lastSL : lastSH; // dir=1 → dip süpürüldü, yukarı dönüş
    if (!sw || sw.idx >= n) continue;
    const swept = dir === 1 ? c.low < sw.price - 0.02 && c.close > sw.price : c.high > sw.price + 0.02 && c.close < sw.price;
    const wick = dir === 1 ? Math.min(c.open, c.close) - c.low : c.high - Math.max(c.open, c.close);
    if (!swept || wick / range < 0.45) continue;
    const trig = dir === 1 ? c.high + 0.02 : c.low - 0.02;
    mk({
      kind: "REVERSAL", dir, status: "KURULUYOR", base: 48,
      trigger: trig, stop: (dir === 1 ? c.low : c.high) - dir * 0.1 * A, targets: tgts(dir, trig),
      zone: [sw.price, dir === 1 ? c.low : c.high], anchor: sw.time,
      reasons: [`15m ${dir === 1 ? "dibi" : "tepesi"} ${sw.price.toFixed(2)} süpürüldü, kapanış içeri döndü (fitil %${Math.round((wick / range) * 100)})`],
    });
  }

  // 4) BANT: yatay EMA, son salınım tepe-dip arası 1–4 ATR; kenarlardan dönüş
  if (lastSH && lastSL && m15 && m15.slopeAtr != null && Math.abs(m15.slopeAtr) < 0.25) {
    const top = lastSH.price, bot = lastSL.price, w = top - bot;
    if (w >= A && w <= 4 * A && c.close < top && c.close > bot) {
      const pos = (c.close - bot) / w;
      if (pos >= 0.75 || pos <= 0.25) {
        const dir = pos >= 0.75 ? -1 : 1;
        const edge = dir === -1 ? top : bot;
        mk({
          kind: "RANGE", dir, status: "KURULUYOR", base: 40,
          trigger: dir === -1 ? c.low - 0.02 : c.high + 0.02, stop: edge - dir * 0.2 * A, targets: [bot + w / 2, dir === -1 ? bot : top],
          zone: [bot, top], anchor: Math.min(lastSH.time, lastSL.time),
          reasons: [`${bot.toFixed(2)} – ${top.toFixed(2)} bandı (${(w / A).toFixed(1)} ATR), fiyat ${dir === -1 ? "üst" : "alt"} kenarda`],
        });
      }
    }
  }

  setups.sort((a, b) => b.score - a.score);
  const primary = setups.length && setups[0].score >= 40 ? setups[0] : null;

  // ── simülasyon: sonraki 4 adet 15m mum ──
  const diffs: number[] = [];
  for (let i = Math.max(1, n - 60); i <= n; i++) diffs.push(bars[i].close - bars[i - 1].close);
  const mean = diffs.reduce((x, y) => x + y, 0) / diffs.length;
  const sd = Math.sqrt(diffs.reduce((x, y) => x + (y - mean) ** 2, 0) / Math.max(1, diffs.length - 1)) || 0.4 * A;

  let dir: Dir = 0;
  let mu = 0;
  let cap: number | null = null;
  let text: string;
  if (primary) {
    dir = primary.dir;
    const conv = clamp((primary.score - 45) / 45, 0.1, 1);
    mu = dir * conv * cfg.kSetup * A;
    cap = primary.targets[0];
    text = `${primary.title} (${primary.status.toLowerCase()}, skor ${primary.score}) yönünde: hedef ${primary.targets[0].toFixed(2)}`;
  } else {
    const t = align + (m15?.dir ?? 0);
    dir = t >= 2 ? 1 : t <= -2 ? -1 : 0;
    mu = (t / 3) * cfg.kTrend * A;
    text = dir === 0 ? "net setup yok — üst zamanlar karışık, yatay salınım bekleniyor" : `setup yok — trend uyumu yönünde hafif sürüklenme (${dir === 1 ? "yukarı" : "aşağı"})`;
  }
  const times = nextTimes(c.time, 4);
  const candles: FcCandle[] = [];
  let p = c.close;
  let pause = false;
  for (let i = 0; i < 4; i++) {
    const step = pause ? mu * 0.3 : mu;
    let c2 = p + step;
    if (cap != null && dir !== 0 && (c2 - cap) * dir > 0) c2 = cap - dir * 0.05 * A;
    // yoldaki karşı seviye: fitil + duraklama (birincil hedefin kendisi hariç)
    const block = dir === 0 ? null : levels.find((l) => (dir === 1 ? l.price > p && l.price < c2 + 0.2 * A : l.price < p && l.price > c2 - 0.2 * A) && l.price !== cap);
    let h = Math.max(p, c2) + 0.22 * A, l = Math.min(p, c2) - 0.22 * A;
    // tetiklenmiş kırılımda ilk mum seviyeye geri test fitili atar (kapanış yolu değişmez)
    if (i === 0 && primary?.kind === "BREAKOUT" && primary.status === "TETİKLENDİ") {
      if (dir === 1) l = Math.min(l, primary.zone[1]); else h = Math.max(h, primary.zone[0]);
    }
    if (block) {
      // fitil seviyeyi yoklar, kapanış seviyenin altında kalır — ama tahmin yönünün tersine çevrilmez
      if (dir === 1) { h = block.price + 0.08 * A; c2 = Math.max(p, Math.min(c2, block.price - 0.12 * A)); }
      else { l = block.price - 0.08 * A; c2 = Math.min(p, Math.max(c2, block.price + 0.12 * A)); }
      pause = !(primary && primary.score >= 65);
    } else pause = false;
    if (dir === 0) c2 = p + (i % 2 ? 0.15 : -0.15) * A * 0.5;
    const band = cfg.band * sd * Math.sqrt(i + 1);
    candles.push({ t: times[i], o: r2(p), h: r2(Math.max(h, p, c2)), l: r2(Math.min(l, p, c2)), c: r2(c2), lo: r2(c2 - band), hi: r2(c2 + band) });
    p = c2;
  }

  return {
    key: c.time, atr: A, h1, h4, m15, align, swings, levels, setups: setups.slice(0, 3), primary,
    forecast: { key: c.time, base: c.close, dir, candles, text },
    ema15,
  };
}

// ── Geçmişte tutarlılık (walk-forward: her kapanışta yalnız o ana kadarki veri) ──

export interface Setup15Stats {
  n: number;
  /** 4. mum kapanışında yön isabeti (yalnız yönlü tahminler) */
  dirN: number;
  dirHit: number;
  /** Gerçek kapanışların tahmin bandında kalma oranı (4 mumun hepsi) */
  inBand: number;
  /** 4. mum kapanış hatası: model / "fiyat aynı kalır" */
  mae: number;
  naiveMae: number;
}

export function backtestSetup15(
  m15: Bar[],
  h1: Bar[],
  pivotsFor: (ymd: string) => Setup15Input["pivots"],
  vwapAt: (t: number) => number | null,
  maxRuns = 120,
  cfg?: Setup15Cfg,
): Setup15Stats | null {
  if (m15.length < 40) return null;
  let n = 0, dirN = 0, dirHit = 0, bandN = 0, bandHit = 0, ae = 0, nae = 0;
  const start = Math.max(30, m15.length - 4 - maxRuns);
  for (let i = start; i < m15.length - 4; i++) {
    const t = m15[i].time;
    const end = t + M15;
    const r = readSetup15({
      m15: m15.slice(0, i + 1),
      h1: h1.filter((b) => barEnd(b.time, 60) <= end),
      pivots: pivotsFor(nyParts(t).ymd),
      vwap: vwapAt(t),
      cfg,
    });
    if (!r) continue;
    const real = m15.slice(i + 1, i + 5);
    // sonraki 4 mum aynı seansta değilse (gece boşluğu) atla
    if (real.length < 4 || real[3].time - t > 4 * M15 + 60) continue;
    n++;
    const fc = r.forecast;
    fc.candles.forEach((k, j) => { bandN++; if (real[j].close >= k.lo && real[j].close <= k.hi) bandHit++; });
    const move = real[3].close - fc.base;
    ae += Math.abs(real[3].close - fc.candles[3].c);
    nae += Math.abs(move);
    if (fc.dir !== 0 && Math.abs(fc.candles[3].c - fc.base) >= 0.1 * r.atr) {
      dirN++;
      if (Math.sign(move) === fc.dir) dirHit++;
    }
  }
  if (!n) return null;
  return {
    n, dirN, dirHit: dirN ? Math.round((dirHit / dirN) * 100) : 0,
    inBand: Math.round((bandHit / bandN) * 100), mae: ae / n, naiveMae: nae / n,
  };
}
