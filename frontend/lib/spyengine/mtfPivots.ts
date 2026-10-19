/**
 * SPY Engine — Pivot noktaları (saf, izomorfik).
 *
 * 2026-10-19 (kullanıcı): 30m / 1h / 4h son mumdan Fibonacci pivotları her mumda değişiyor, fiyat kolayca "bütün pivotların
 * üstünde / R3 – üst yok" kalıyordu — piyasanın baktığı seviyeler değildi. Artık ANA seviyeler piyasa gerçekleri:
 *   • Dünkü seans: tepe · dip · kapanış          • Bugünkü seans: tepe · dip (o ana kadar)
 *   • Klasik günlük pivot (dünkü Y/D/K):  P = (Y + D + K) / 3
 *       R1 = 2P − D   S1 = 2P − Y   R2 = P + (Y − D)   S2 = P − (Y − D)
 * Fibonacci DESTEK olarak kalır (düşük ağırlık): dünkü aralıkla Fib pivotları P ± 0,382 / 0,618 / 1,0 × (Y − D) ve
 * bugünkü salınımın (gün tepesi ↔ dibi) 0,382 / 0,5 / 0,618 geri çekilmeleri. Ana seviyeyle aynı fiyata düşen
 * Fibonacci o seviyeyi güçlendirir (★ = kesişim).
 * Mumlar seans hizalıdır, yalnız RTH. Pivotlar seviye bilgisidir; Takip Sistemi'nde yalnız hedef seviyesi olarak kullanılır.
 */

import { nyClock, nyParts, r2, type Bar } from "./core";
import { sessionAggregate } from "./setup15";

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

/** Bir seansın RTH tepe / dip / kapanışı */
export interface DaySession { ymd: string; H: number; L: number; C: number }

/** `t` anından önceki son tamamlanmış seans (saatlik RTH mumlarından) */
export function prevSessionAt(fr: PivotFrames, t: number): DaySession | null {
  const today = nyParts(t - 1).ymd;
  let ymd: string | null = null;
  let H = -Infinity, L = Infinity, C = 0;
  for (const b of fr.h1) {
    const d = nyParts(b.time).ymd;
    if (d >= today) break;
    if (d !== ymd) { ymd = d; H = b.high; L = b.low; } else { H = Math.max(H, b.high); L = Math.min(L, b.low); }
    C = b.close;
  }
  return ymd ? { ymd, H, L, C } : null;
}

/** Klasik günlük pivot (P, R1, R2, S1, S2) */
export function classicPivots(H: number, L: number, C: number): { key: string; price: number }[] {
  const P = (H + L + C) / 3;
  return [
    { key: "R2", price: r2(P + (H - L)) }, { key: "R1", price: r2(2 * P - L) },
    { key: "P", price: r2(P) },
    { key: "S1", price: r2(2 * P - H) }, { key: "S2", price: r2(P - (H - L)) },
  ];
}

/** Fibonacci pivotları: P ± 0,382 / 0,618 / 1,0 × (Y − D) — destek seviyeleri */
export function fibPivots(H: number, L: number, C: number): { key: string; price: number }[] {
  const P = (H + L + C) / 3;
  const R = H - L;
  return [
    { key: "Fib R3", price: r2(P + FIB[2] * R) }, { key: "Fib R2", price: r2(P + FIB[1] * R) }, { key: "Fib R1", price: r2(P + FIB[0] * R) },
    { key: "Fib S1", price: r2(P - FIB[0] * R) }, { key: "Fib S2", price: r2(P - FIB[1] * R) }, { key: "Fib S3", price: r2(P - FIB[2] * R) },
  ];
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
    levels: [{ key: "Gün Fib 0,382", price: lv(0.382) }, { key: "Gün Fib 0,5", price: lv(0.5) }, { key: "Gün Fib 0,618", price: lv(0.618) }],
  };
}

export type MtfState = "DEĞMEDİ" | "TEST · TUTTU" | "KIRILDI ▲" | "KIRILDI ▼" | "ÜZERİNDE";

/** D = piyasa seviyesi (dün/bugün tepe-dip-kapanış) · R/S/P = klasik pivot · F = Fibonacci desteği */
export type LevelKind = "D" | "R" | "S" | "P" | "F";

export interface MtfLevel {
  price: number;
  /** Kaynaklar, ör. ["Dün kapanış", "P", "Fib R1"] (ana seviye önce) */
  keys: string[];
  /** Kısa etiket (en güçlü kaynak önce) */
  label: string;
  kind: LevelKind;
  /** Kaynak ağırlığı (ana seviye 3 · Fibonacci 1) toplamı — kesişim gücü; ≥ 4 = ★ */
  weight: number;
  /** fiyat − seviye */
  dist: number;
  touched: string | null;
  state: MtfState;
}

export interface MtfPivotRead {
  /** Pivotların dayanağı: dünkü seans */
  prev: DaySession | null;
  /** Klasik günlük pivot P */
  P: number | null;
  /** Bugünkü seans tepe / dip (o ana kadar) */
  today: { hi: number; lo: number } | null;
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

/** Ana seviye ağırlığı · Fibonacci destek ağırlığı */
const W_MAIN = 3;
const W_FIB = 1;

type RawLevel = { price: number; key: string; kind: LevelKind; w: number; formed: number };

/** `t` anındaki tüm seviyeler (birleştirilmemiş) */
function rawLevels(fr: PivotFrames, todayRth5: Bar[], t: number): { raw: RawLevel[]; prev: DaySession | null; P: number | null; fib: DayFib | null } {
  const raw: RawLevel[] = [];
  const prev = prevSessionAt(fr, t);
  let P: number | null = null;
  if (prev) {
    raw.push({ price: r2(prev.H), key: "Dün tepe", kind: "D", w: W_MAIN, formed: 0 });
    raw.push({ price: r2(prev.L), key: "Dün dip", kind: "D", w: W_MAIN, formed: 0 });
    raw.push({ price: r2(prev.C), key: "Dün kapanış", kind: "D", w: W_MAIN, formed: 0 });
    for (const l of classicPivots(prev.H, prev.L, prev.C)) {
      if (l.key === "P") P = l.price;
      raw.push({ price: l.price, key: l.key, kind: l.key === "P" ? "P" : l.key.startsWith("R") ? "R" : "S", w: W_MAIN, formed: 0 });
    }
    for (const l of fibPivots(prev.H, prev.L, prev.C)) raw.push({ price: l.price, key: l.key, kind: "F", w: W_FIB, formed: 0 });
  }
  if (todayRth5.length) {
    let hi = todayRth5[0], lo = todayRth5[0];
    for (const b of todayRth5) { if (b.high > hi.high) hi = b; if (b.low < lo.low) lo = b; }
    // dokunma durumu yalnız tepe/dibi yapan mumdan SONRAKİ mumlarla (yeniden test) ölçülür
    raw.push({ price: r2(hi.high), key: "Bugün tepe", kind: "D", w: W_MAIN, formed: hi.time + 300 });
    raw.push({ price: r2(lo.low), key: "Bugün dip", kind: "D", w: W_MAIN, formed: lo.time + 300 });
  }
  const fib = dayFib(todayRth5);
  if (fib) for (const l of fib.levels) raw.push({ price: l.price, key: l.key, kind: "F", w: W_FIB, formed: 0 });
  return { raw, prev, P, fib };
}

/** Tüm kaynakları tek merdivende birleştirir (yakın seviyeler tek satır; fiyatı ana seviye belirler). */
export function mergeLevels(raw: RawLevel[]): { price: number; keys: string[]; kind: LevelKind; weight: number; formed: number }[] {
  const xs = [...raw].sort((a, b) => b.price - a.price);
  const groups: RawLevel[][] = [];
  for (const x of xs) {
    const last = groups[groups.length - 1];
    if (last && Math.abs(last[last.length - 1].price - x.price) <= MERGE_EPS) last.push(x);
    else groups.push([x]);
  }
  return groups.map((items) => {
    const ord = [...items].sort((a, b) => b.w - a.w);
    const mains = ord.filter((x) => x.w === W_MAIN);
    // fiyat: ana seviye(ler)in ortalaması; yalnız Fibonacci ise onların ortalaması
    const src = mains.length ? mains : ord;
    return {
      price: r2(src.reduce((a, x) => a + x.price, 0) / src.length),
      keys: ord.map((x) => x.key),
      kind: ord[0].kind,
      weight: items.reduce((a, x) => a + x.w, 0),
      formed: Math.max(...items.map((x) => x.formed)),
    };
  });
}

/**
 * Fiyatın çevresindeki pivot merdiveni + hareket okuması.
 * @param todayRth5 bugünün KAPANMIŞ RTH 5m mumları (bugün tepe/dip, dokunma/kırılım durumları ve 30 dk hız için)
 * @param span fiyatın her iki yanında gösterilecek seviye sayısı
 */
export function mtfPivotRead(fr: PivotFrames, todayRth5: Bar[], price: number, t: number, span = 5): MtfPivotRead | null {
  const { raw, prev, P, fib } = rawLevels(fr, todayRth5, t);
  if (!raw.length) return null;
  const merged = mergeLevels(raw);
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
    return { price: m.price, keys: m.keys, label: m.keys.slice(0, 2).join(" · ") + (m.keys.length > 2 ? ` +${m.keys.length - 2}` : ""), kind: m.kind, weight: m.weight, dist: r2(price - m.price), touched, state };
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
  else text = `Fiyat bütün seviyelerin ${heading === "UP" ? "üstünde" : "altında"} — güçlü hareket.`;
  const today = n ? { hi: Math.max(...todayRth5.map((b) => b.high)), lo: Math.min(...todayRth5.map((b) => b.low)) } : null;
  return { prev, P, today, fib, ladder, above: a0, below: b0, heading, speed30, target, etaMin, zone, text };
}

/** Yalnız fiyat listesi (Takip Sistemi hedef seviyeleri için). Dünkü/bugünkü tepe-dip-kapanış Takip Sistemi'nde ayrıca var; burada pivotlar. */
export function pivotLevelsAt(fr: PivotFrames, todayRth5: Bar[], t: number): { price: number; label: string }[] {
  const { raw } = rawLevels(fr, todayRth5, t);
  return mergeLevels(raw.filter((x) => x.kind !== "D")).map((m) => ({ price: m.price, label: m.keys.slice(0, 2).join(" · ") }));
}

/** Sayfa ve testlerde gün ayrımı için yardımcı */
export const ymdOf = (t: number) => nyParts(t).ymd;
