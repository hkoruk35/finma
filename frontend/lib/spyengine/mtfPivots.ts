/**
 * SPY Engine — Çok zaman dilimli FIBONACCI pivotları (saf, izomorfik).
 *
 * Neden (2026-10-15, kullanıcı): klasik günlük pivot (önceki seans Y/D/K) dar aralıklı bir günün ertesinde
 * işe yaramıyordu — 14 Ekim'de fiyat bütün gün "S4 altı" göründü. Pivotlar artık 30m / 1h / 4h
 * zaman dilimlerinin SON KAPANMIŞ mumundan, Fibonacci kuralıyla hesaplanır ve her yeni mum kapanışında güncellenir:
 *   P  = (H + L + C) / 3
 *   R1 = P + 0,382 × (H − L)   S1 = P − 0,382 × (H − L)
 *   R2 = P + 0,618 × (H − L)   S2 = P − 0,618 × (H − L)
 *   R3 = P + 1,000 × (H − L)   S3 = P − 1,000 × (H − L)
 * Ek olarak seansın ana salınımına (gün tepesi ↔ gün dibi) Fibonacci geri çekilmeleri (0,382 / 0,5 / 0,618) —
 * trend günlerinde geri çekilmenin duracağı yerler.
 * Mumlar seans hizalıdır (30m: 09:30, 10:00 … · 1h: 09:30, 10:30 … · 4h: 09:30, 13:30), yalnız RTH.
 * Aynı fiyata (≤ 0,08 puan) düşen seviyeler birleştirilir: birden çok kaynak = güçlü seviye (kesişim).
 * Pivotlar seviye bilgisidir; Takip Sistemi'nde yalnız hedef / geçersizlik seviyesi olarak kullanılır.
 */

import { nyClock, nyParts, r2, type Bar } from "./core";
import { barEnd, sessionAggregate } from "./setup15";

export type PivTf = "30m" | "1h" | "4h";
const TF_MIN: Record<PivTf, number> = { "30m": 30, "1h": 60, "4h": 240 };
const FIB = [0.382, 0.618, 1.0] as const;
const MERGE_EPS = 0.08;

export interface PivotFrames {
  m30: Bar[];
  h1: Bar[];
  h4: Bar[];
}

/** Çok günlük RTH 30m / 1h / 4h mumları. `h1Hist` (uzun saatlik geçmiş) verilirse 5m'nin kapsamadığı eski saatler ondan gelir. */
export function pivotFrames(m5: Bar[], h1Hist?: Bar[] | null): PivotFrames {
  const m30 = sessionAggregate(m5, 30);
  const fresh = sessionAggregate(m5, 60);
  const firstFresh = fresh.length ? fresh[0].time : Infinity;
  const map = new Map<number, Bar>();
  for (const b of h1Hist ?? []) if (b.time < firstFresh) map.set(b.time, b);
  for (const b of fresh) map.set(b.time, b);
  const h1 = [...map.values()].sort((a, b) => a.time - b.time);
  const h4 = sessionAggregate(h1, 240);
  return { m30, h1, h4 };
}

export interface FibPivotSet {
  tf: PivTf;
  /** Dayanak mum (son kapanmış) */
  base: { time: number; end: number; clock: string; H: number; L: number; C: number };
  levels: { key: string; price: number }[];
}

/** `bars` içinde `t` anında kapanmış son mumun indeksi (bars artan zamanlı) */
function lastClosedIdx(bars: Bar[], minutes: number, t: number): number {
  let lo = 0, hi = bars.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (barEnd(bars[mid].time, minutes) <= t) { ans = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return ans;
}

export function fibPivots(H: number, L: number, C: number): { key: string; price: number }[] {
  const P = (H + L + C) / 3;
  const R = H - L;
  return [
    { key: "R3", price: r2(P + FIB[2] * R) }, { key: "R2", price: r2(P + FIB[1] * R) }, { key: "R1", price: r2(P + FIB[0] * R) },
    { key: "P", price: r2(P) },
    { key: "S1", price: r2(P - FIB[0] * R) }, { key: "S2", price: r2(P - FIB[1] * R) }, { key: "S3", price: r2(P - FIB[2] * R) },
  ];
}

/** `t` anındaki 30m / 1h / 4h Fibonacci pivot setleri */
export function fibSetsAt(fr: PivotFrames, t: number): FibPivotSet[] {
  const out: FibPivotSet[] = [];
  for (const [tf, bars] of [["4h", fr.h4], ["1h", fr.h1], ["30m", fr.m30]] as const) {
    const i = lastClosedIdx(bars, TF_MIN[tf], t);
    if (i < 0) continue;
    const b = bars[i];
    out.push({ tf, base: { time: b.time, end: barEnd(b.time, TF_MIN[tf]), clock: nyClock(b.time), H: b.high, L: b.low, C: b.close }, levels: fibPivots(b.high, b.low, b.close) });
  }
  return out;
}

export interface DayFib {
  /** Salınım yönü: tepe dipten SONRA geldiyse UP (geri çekilmeler aşağıda), değilse DOWN */
  dir: "UP" | "DOWN";
  hi: number;
  lo: number;
  hiClock: string;
  loClock: string;
  levels: { key: string; price: number }[];
}

/** Seansın ana salınımına Fibonacci geri çekilmeleri (aralık ≥ 1 puan ise) */
export function dayFib(todayRth5: Bar[]): DayFib | null {
  if (todayRth5.length < 3) return null;
  let hi = todayRth5[0], lo = todayRth5[0];
  for (const b of todayRth5) { if (b.high > hi.high) hi = b; if (b.low < lo.low) lo = b; }
  const range = hi.high - lo.low;
  if (range < 1) return null;
  const dir: DayFib["dir"] = hi.time > lo.time ? "UP" : "DOWN";
  const lv = (f: number) => r2(dir === "UP" ? hi.high - f * range : lo.low + f * range);
  return {
    dir, hi: hi.high, lo: lo.low, hiClock: nyClock(hi.time), loClock: nyClock(lo.time),
    levels: [{ key: "Fib 0,382", price: lv(0.382) }, { key: "Fib 0,5", price: lv(0.5) }, { key: "Fib 0,618", price: lv(0.618) }],
  };
}

export type MtfState = "DEĞMEDİ" | "TEST · TUTTU" | "KIRILDI ▲" | "KIRILDI ▼" | "ÜZERİNDE";

export interface MtfLevel {
  price: number;
  /** Kaynaklar, ör. ["4h R1", "1h P"] */
  keys: string[];
  /** Kısa etiket (en güçlü kaynak önce) */
  label: string;
  kind: "R" | "S" | "P" | "F";
  /** Kaynak ağırlığı (4h=3 · 1h=2 · 30m=1 · Fib=2) toplamı — kesişim gücü */
  weight: number;
  /** fiyat − seviye */
  dist: number;
  touched: string | null;
  state: MtfState;
}

export interface MtfPivotRead {
  sets: FibPivotSet[];
  fib: DayFib | null;
  /** Yüksekten alçağa */
  ladder: MtfLevel[];
  above: MtfLevel | null;
  below: MtfLevel | null;
  heading: "UP" | "DOWN" | "FLAT";
  speed30: number;
  target: MtfLevel | null;
  etaMin: number | null;
  zone: string;
  text: string;
}

const TF_W: Record<string, number> = { "4h": 3, "1h": 2, "30m": 1 };

/** Tüm kaynakları tek merdivende birleştirir (yakın seviyeler tek satır). */
export function mergeLevels(sets: FibPivotSet[], fib: DayFib | null): { price: number; keys: string[]; weight: number; formed: number }[] {
  const raw: { price: number; key: string; w: number; formed: number }[] = [];
  for (const s of sets) for (const l of s.levels) raw.push({ price: l.price, key: `${s.tf} ${l.key}`, w: TF_W[s.tf], formed: s.base.end });
  if (fib) for (const l of fib.levels) raw.push({ price: l.price, key: l.key, w: 2, formed: 0 });
  raw.sort((a, b) => b.price - a.price);
  const out: { price: number; keys: string[]; weight: number; formed: number; sum: number }[] = [];
  for (const x of raw) {
    const last = out[out.length - 1];
    if (last && Math.abs(last.price - x.price) <= MERGE_EPS) {
      last.keys.push(x.key);
      last.sum += x.price * x.w;
      last.weight += x.w;
      last.price = r2(last.sum / last.weight);
      last.formed = Math.max(last.formed, x.formed);
    } else out.push({ price: x.price, keys: [x.key], weight: x.w, formed: x.formed, sum: x.price * x.w });
  }
  return out.map(({ price, keys, weight, formed }) => ({ price, keys: keys.sort((a, b) => (TF_W[b.split(" ")[0]] ?? 2) - (TF_W[a.split(" ")[0]] ?? 2)), weight, formed }));
}

const kindOf = (keys: string[]): MtfLevel["kind"] => {
  const k = keys[0];
  if (k.startsWith("Fib")) return "F";
  const s = k.split(" ")[1] ?? "";
  return s.startsWith("R") ? "R" : s.startsWith("S") ? "S" : "P";
};

/**
 * Fiyatın çevresindeki pivot merdiveni + hareket okuması.
 * @param todayRth5 bugünün KAPANMIŞ RTH 5m mumları (dokunma/kırılım durumları ve 30 dk hız için)
 * @param span fiyatın her iki yanında gösterilecek seviye sayısı
 */
export function mtfPivotRead(fr: PivotFrames, todayRth5: Bar[], price: number, t: number, span = 5): MtfPivotRead | null {
  const sets = fibSetsAt(fr, t);
  if (!sets.length) return null;
  const fib = dayFib(todayRth5);
  const merged = mergeLevels(sets, fib);
  const lv: MtfLevel[] = merged.map((m) => {
    const after = todayRth5.filter((b) => b.time + 300 > m.formed);
    let touched: string | null = null;
    let state: MtfState = "DEĞMEDİ";
    const first = after[0];
    if (first) {
      const startSide = Math.sign(first.open - m.price) || 1;
      const ti = after.findIndex((b) => b.low <= m.price && b.high >= m.price);
      if (ti >= 0) {
        touched = nyClock(after[ti].time);
        const lastClose = after[after.length - 1].close;
        const nowSide = Math.sign(lastClose - m.price);
        state = Math.abs(lastClose - m.price) < 0.05 ? "ÜZERİNDE" : nowSide === startSide ? "TEST · TUTTU" : nowSide > 0 ? "KIRILDI ▲" : "KIRILDI ▼";
      }
    }
    return { price: m.price, keys: m.keys, label: m.keys.slice(0, 2).join(" · ") + (m.keys.length > 2 ? ` +${m.keys.length - 2}` : ""), kind: kindOf(m.keys), weight: m.weight, dist: r2(price - m.price), touched, state };
  });
  const above = lv.filter((l) => l.price > price + 0.02).sort((a, b) => a.price - b.price);
  const below = lv.filter((l) => l.price < price - 0.02).sort((a, b) => b.price - a.price);
  const ladder = [...above.slice(0, span).reverse(), ...lv.filter((l) => Math.abs(l.price - price) <= 0.02), ...below.slice(0, span)];

  const n = todayRth5.length;
  const speed30 = n >= 7 ? r2(todayRth5[n - 1].close - todayRth5[n - 7].close) : n >= 2 ? r2(todayRth5[n - 1].close - todayRth5[0].open) : 0;
  const heading: MtfPivotRead["heading"] = speed30 > 0.25 ? "UP" : speed30 < -0.25 ? "DOWN" : "FLAT";
  const a0 = above[0] ?? null, b0 = below[0] ?? null;
  const target = heading === "UP" ? a0 : heading === "DOWN" ? b0 : null;
  const etaMin = target && Math.abs(speed30) > 0.05 ? Math.max(5, Math.round(((Math.abs(target.price - price) / Math.abs(speed30)) * 30) / 5) * 5) : null;
  const short = (l: MtfLevel) => l.keys[0];
  const zone = `${b0 ? short(b0) : "alt yok"} – ${a0 ? short(a0) : "üst yok"}`;
  const lt = (l: MtfLevel) => `${l.label} ${l.price.toFixed(2)}`;
  let text: string;
  if (heading === "FLAT") text = `Fiyat ${zone} arasında yatay (30 dk ${speed30 >= 0 ? "+" : ""}${speed30.toFixed(2)}).${a0 ? ` Üst: ${lt(a0)} (+${(a0.price - price).toFixed(2)})` : ""}${b0 ? ` · Alt: ${lt(b0)} (−${(price - b0.price).toFixed(2)})` : ""}.`;
  else if (target) text = `Fiyat ${heading === "UP" ? "yukarı" : "aşağı"} ${lt(target)} seviyesine gidiyor: ${Math.abs(target.price - price).toFixed(2)} puan kaldı (30 dk hız ${speed30 >= 0 ? "+" : ""}${speed30.toFixed(2)}${etaMin ? `, bu hızla ~${etaMin} dk` : ""}).`;
  else text = `Fiyat bütün pivotların ${heading === "UP" ? "üstünde" : "altında"} — güçlü hareket.`;
  return { sets, fib, ladder, above: a0, below: b0, heading, speed30, target, etaMin, zone, text };
}

/** Yalnız fiyat listesi (Takip Sistemi hedef/geçersizlik seviyeleri için) */
export function pivotLevelsAt(fr: PivotFrames, todayRth5: Bar[], t: number): { price: number; label: string }[] {
  const merged = mergeLevels(fibSetsAt(fr, t), dayFib(todayRth5));
  return merged.map((m) => ({ price: m.price, label: m.keys.slice(0, 2).join(" · ") }));
}

/** Sayfa ve testlerde gün ayrımı için yardımcı */
export const ymdOf = (t: number) => nyParts(t).ymd;
