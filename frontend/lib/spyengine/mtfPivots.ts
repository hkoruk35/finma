/**
 * SPY Engine — Pivot noktaları (saf, izomorfik).
 *
 * 2026-11-04 (kullanıcı): günlük pivot + Fibonacci merdiveni çok dar aralıklarda tıkanıyordu. Yeni merdiven:
 *   • Son KAPANMIŞ RTH 4h mumu: klasik P, R1–R3, S1–S3. Mumlar 09:30–13:30 ve 13:30–16:00 olduğundan pivotlar seans içinde bir kez değişir.
 *   • Dünkü seans: tepe · dip · kapanış          • Bugünkü seans: tepe · dip (o ana kadar)
 * 44 seans ölçümü: medyan seviye aralığı 0,48 → 0,77 puan, dar bant süresi %67 → %36, ilk temasta tutma %54 → %59.
 * Mumlar seans hizalıdır, yalnız RTH. Pivotlar seviye bilgisidir; Takip Sistemi girişlerine ve çıkışlarına girmez.
 */

import { nyClock, nyDateTimeToEpoch, nyParts, r2, type Bar } from "./core";
import { sessionAggregate } from "./setup15";

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

/** `t` anında kapanmış son RTH 4h mumu */
export function lastClosed4h(fr: PivotFrames, t: number): Bar | null {
  for (let i = fr.h4.length - 1; i >= 0; i--) {
    const b = fr.h4[i];
    const close = nyDateTimeToEpoch(nyParts(b.time).ymd, 16 * 60);
    if (Math.min(b.time + 240 * 60, close) <= t) return b;
  }
  return null;
}

/** Klasik 4h pivotları (P, R1–R3, S1–S3) */
export function classic4hPivots(H: number, L: number, C: number): { key: string; price: number }[] {
  const P = (H + L + C) / 3;
  return [
    { key: "4h R3", price: r2(H + 2 * (P - L)) }, { key: "4h R2", price: r2(P + (H - L)) }, { key: "4h R1", price: r2(2 * P - L) },
    { key: "4h P", price: r2(P) },
    { key: "4h S1", price: r2(2 * P - H) }, { key: "4h S2", price: r2(P - (H - L)) }, { key: "4h S3", price: r2(L - 2 * (H - P)) },
  ];
}

export type MtfState = "DEĞMEDİ" | "TEST · TUTTU" | "KIRILDI ▲" | "KIRILDI ▼" | "ÜZERİNDE";

/** D = piyasa seviyesi (dün/bugün tepe-dip-kapanış) · R/S/P = 4h klasik pivot */
export type LevelKind = "D" | "R" | "S" | "P";

export interface MtfLevel {
  price: number;
  /** Kaynaklar, ör. ["Dün kapanış", "4h P"] */
  keys: string[];
  /** Kısa etiket (en güçlü kaynak önce) */
  label: string;
  kind: LevelKind;
  /** Kaynak ağırlığı toplamı — iki seviye kesişirse ≥ 4 = ★ */
  weight: number;
  /** fiyat − seviye */
  dist: number;
  touched: string | null;
  state: MtfState;
}

export interface MtfPivotRead {
  /** Pivotların dayanağı: dünkü seans */
  prev: DaySession | null;
  /** Pivotların dayanağı olan son kapanmış 4h mum */
  anchor4h: { H: number; L: number; C: number; clock: string; date: string } | null;
  /** 4h klasik pivot P */
  P: number | null;
  /** Bugünkü seans tepe / dip (o ana kadar) */
  today: { hi: number; lo: number } | null;
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

/** Seviye ağırlığı */
const W_MAIN = 3;

type RawLevel = { price: number; key: string; kind: LevelKind; w: number; formed: number };

/** `t` anındaki tüm seviyeler (birleştirilmemiş) */
function rawLevels(fr: PivotFrames, todayRth5: Bar[], t: number): { raw: RawLevel[]; prev: DaySession | null; P: number | null; anchor4h: MtfPivotRead["anchor4h"] } {
  const raw: RawLevel[] = [];
  const prev = prevSessionAt(fr, t);
  let P: number | null = null;
  if (prev) {
    raw.push({ price: r2(prev.H), key: "Dün tepe", kind: "D", w: W_MAIN, formed: 0 });
    raw.push({ price: r2(prev.L), key: "Dün dip", kind: "D", w: W_MAIN, formed: 0 });
    raw.push({ price: r2(prev.C), key: "Dün kapanış", kind: "D", w: W_MAIN, formed: 0 });
  }
  const h4 = lastClosed4h(fr, t);
  const anchor4h = h4 ? { H: h4.high, L: h4.low, C: h4.close, clock: nyClock(h4.time), date: nyParts(h4.time).ymd } : null;
  if (h4) {
    for (const l of classic4hPivots(h4.high, h4.low, h4.close)) {
      if (l.key === "4h P") P = l.price;
      raw.push({ price: l.price, key: l.key, kind: l.key === "4h P" ? "P" : l.key.startsWith("4h R") ? "R" : "S", w: W_MAIN, formed: 0 });
    }
  }
  if (todayRth5.length) {
    let hi = todayRth5[0], lo = todayRth5[0];
    for (const b of todayRth5) { if (b.high > hi.high) hi = b; if (b.low < lo.low) lo = b; }
    // dokunma durumu yalnız tepe/dibi yapan mumdan SONRAKİ mumlarla (yeniden test) ölçülür
    raw.push({ price: r2(hi.high), key: "Bugün tepe", kind: "D", w: W_MAIN, formed: hi.time + 300 });
    raw.push({ price: r2(lo.low), key: "Bugün dip", kind: "D", w: W_MAIN, formed: lo.time + 300 });
  }
  return { raw, prev, P, anchor4h };
}

/** Tüm kaynakları tek merdivende birleştirir (yakın seviyeler tek satır). */
export function mergeLevels(raw: RawLevel[]): { price: number; keys: string[]; kind: LevelKind; weight: number; formed: number }[] {
  const xs = [...raw].sort((a, b) => b.price - a.price);
  const groups: RawLevel[][] = [];
  for (const x of xs) {
    const last = groups[groups.length - 1];
    if (last && Math.abs(last[last.length - 1].price - x.price) <= MERGE_EPS) last.push(x);
    else groups.push([x]);
  }
  return groups.map((items) => {
    return {
      price: r2(items.reduce((a, x) => a + x.price, 0) / items.length),
      keys: items.map((x) => x.key),
      kind: items[0].kind,
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
  const { raw, prev, P, anchor4h } = rawLevels(fr, todayRth5, t);
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
  return { prev, anchor4h, P, today, ladder, above: a0, below: b0, heading, speed30, target, etaMin, zone, text };
}

export interface NextLevelOdds {
  up: MtfLevel;
  down: MtfLevel;
  upPct: number;
  downPct: number;
}

/**
 * En az 0,5 ATR5 uzaktaki iki seviyeden hangisine önce değileceğinin mesafe oranı. Yön tahmini değildir.
 * 44 seans: 30 dk içinde iki seviyeden birine değilen durumlarda isabet iki dönemde %71 ve %69.
 * 15m/5m yönü, son mumlar ve VWAP uzaklığı karşı dönem testinde bu oranı iyileştirmedi.
 */
export function nextLevelOdds(levels: MtfLevel[], price: number, atr5: number | null): NextLevelOdds | null {
  if (!atr5 || atr5 <= 0) return null;
  const min = 0.5 * atr5;
  const up = levels.filter((l) => l.price >= price + min).sort((a, b) => a.price - b.price)[0];
  const down = levels.filter((l) => l.price <= price - min).sort((a, b) => b.price - a.price)[0];
  if (!up || !down) return null;
  const upPct = Math.round((100 * (price - down.price)) / (up.price - down.price));
  return { up, down, upPct, downPct: 100 - upPct };
}

/** Yalnız fiyat listesi (Takip Sistemi hedef seviyeleri için). Dünkü/bugünkü tepe-dip-kapanış Takip Sistemi'nde ayrıca var; burada pivotlar. */
export function pivotLevelsAt(fr: PivotFrames, todayRth5: Bar[], t: number): { price: number; label: string }[] {
  const { raw } = rawLevels(fr, todayRth5, t);
  return mergeLevels(raw.filter((x) => x.kind !== "D")).map((m) => ({ price: m.price, label: m.keys.slice(0, 2).join(" · ") }));
}

/** Sayfa ve testlerde gün ayrımı için yardımcı */
export const ymdOf = (t: number) => nyParts(t).ymd;
