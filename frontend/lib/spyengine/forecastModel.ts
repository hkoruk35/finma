/**
 * SPY Engine — Öğrenen tahmin modeli (saf; sunucu + tarayıcı).
 *
 * Model, tahmin günlüğünde ARŞİVLENEN gerçekleşmiş günlerden hesaplanır; her yeni
 * seans arşive eklenince model kendiliğinden güncellenir (genişleyen pencere).
 * Uydurma katsayı yok: her tahmin, geçmişte aynı durumdaki günlerin gerçekleşen
 * hareket dağılımıdır (ortalama + %20/%80 kantil bandı → tanım gereği ~%60 kapsama).
 *
 *   • Günlük yol (10:00'da dondurulur): açılış kararı sınıfına göre 10:00 fiyatından
 *     her yarım saatlik noktaya hareket. NET YUKARI/AŞAĞI günleri yön-normalize edilip
 *     birlikte ölçülür (daha çok örnek), NET olmayan günler ayrı.
 *   • Kapanış tahmini: kontrol noktasından (10:00 / 12:00 / 14:00 / 15:00) kapanışa kalan hareket.
 *   • Saatlik tahmin (her tam saatte): o anki 5m + 15m VWAP/EMA20 hizasına göre sonraki 60 dk (12×5m).
 */

import type { Bar } from "./core";
import { isRthBar, nyParts, r2, bucketAggregate } from "./core";
import { daySeries, emaByTime, openingRegime } from "./openingMap";

/** Günlük yol noktaları (NY dakikası): 10:00 … 16:00 her 30 dk */
export const DAY_POINTS = [600, 630, 660, 690, 720, 750, 780, 810, 840, 870, 900, 930, 960];
/** Kapanış tahmini kontrol noktaları */
export const CLOSE_CHECKS = [600, 720, 840, 900];
/** Saatlik tahmin başlangıçları */
export const HOUR_STARTS = [600, 660, 720, 780, 840, 900];

export type DayClass = "NET_UP" | "NET_DOWN" | "NONE";
export type HourClass = "UP" | "DOWN" | "MIX";

/** Arşivlenen ham gerçek (bir seans) */
export interface PathFacts {
  cls: DayClass;
  /** DAY_POINTS'teki 5m kapanışlar (son = 16:00 kapanışı) */
  path: number[];
  /** Her saat başı: hiza sınıfı + o anki fiyat + sonraki 12×5m kapanış */
  hours: { h: number; cls: HourClass; p0: number; next: number[] }[];
}

export interface Dist {
  n: number;
  mean: number;
  lo: number;
  hi: number;
  /** Ortalama sapma istatistiksel olarak anlamlı mı (|ort| > 2 standart hata) — değilse orta çizgi kaydırılmaz */
  sig: boolean;
}
export interface ForecastModel {
  n: number;
  /** day[group][k] = 10:00'dan DAY_POINTS[k]'ya hareket (NET: yön-normalize) */
  day: { NET: Dist[]; NONE: Dist[] };
  /** close[group][j] = CLOSE_CHECKS[j]'den kapanışa kalan hareket */
  close: { NET: Dist[]; NONE: Dist[] };
  /** hour[group][s] = saat başından s. 5m kapanışa hareket (ALIGNED: yön-normalize) */
  hour: { ALIGNED: Dist[]; MIX: Dist[] };
}

const q = (xs: number[], p: number) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const i = (s.length - 1) * p;
  const a = Math.floor(i), b = Math.ceil(i);
  return s[a] + (s[b] - s[a]) * (i - a);
};
const dist = (xs: number[]): Dist => {
  const n = xs.length;
  const mean = xs.reduce((a, x) => a + x, 0) / Math.max(1, n);
  const sd = n > 1 ? Math.sqrt(xs.reduce((a, x) => a + (x - mean) ** 2, 0) / (n - 1)) : 0;
  return { n, mean: r2(mean), lo: r2(q(xs, 0.2)), hi: r2(q(xs, 0.8)), sig: n >= 8 && sd > 0 && Math.abs(mean) > (2 * sd) / Math.sqrt(n) };
};
const sgnOf = (c: DayClass) => (c === "NET_UP" ? 1 : c === "NET_DOWN" ? -1 : 0);

export function buildModel(facts: PathFacts[]): ForecastModel {
  const net = facts.filter((f) => f.cls !== "NONE" && f.path.length === DAY_POINTS.length);
  const none = facts.filter((f) => f.cls === "NONE" && f.path.length === DAY_POINTS.length);
  const dayOf = (rows: PathFacts[], norm: boolean) =>
    DAY_POINTS.map((_, k) => dist(rows.map((f) => (norm ? sgnOf(f.cls) : 1) * (f.path[k] - f.path[0]))));
  const closeOf = (rows: PathFacts[], norm: boolean) =>
    CLOSE_CHECKS.map((m) => {
      const j = DAY_POINTS.indexOf(m);
      return dist(rows.map((f) => (norm ? sgnOf(f.cls) : 1) * (f.path[f.path.length - 1] - f.path[j])));
    });
  const hrs = facts.flatMap((f) => f.hours).filter((h) => h.next.length === 12);
  const al = hrs.filter((h) => h.cls !== "MIX"), mx = hrs.filter((h) => h.cls === "MIX");
  const hourOf = (rows: typeof hrs, norm: boolean) =>
    Array.from({ length: 12 }, (_, s) => dist(rows.map((h) => (norm ? (h.cls === "UP" ? 1 : -1) : 1) * (h.next[s] - h.p0))));
  return {
    n: facts.length,
    day: { NET: dayOf(net, true), NONE: dayOf(none, false) },
    close: { NET: closeOf(net, true), NONE: closeOf(none, false) },
    hour: { ALIGNED: hourOf(al, true), MIX: hourOf(mx, false) },
  };
}

/** Bir dağılımı yöne ve başlangıç fiyatına çevir */
export function project(d: Dist, p0: number, dir: number): { mid: number; lo: number; hi: number } {
  // orta çizgi yalnız anlamlı sapmada kayar (walk-forward: anlamsız sapma kapanış hatasını büyütüyordu)
  const m = d.sig ? d.mean : 0;
  if (dir === 0) return { mid: r2(p0 + m), lo: r2(p0 + d.lo), hi: r2(p0 + d.hi) };
  const a = p0 + dir * d.lo, b = p0 + dir * d.hi;
  return { mid: r2(p0 + dir * m), lo: r2(Math.min(a, b)), hi: r2(Math.max(a, b)) };
}

/**
 * Yol tahmini: bant her noktada ölçülmüş dağılımdan; ORTA çizgi tek karar — son noktadaki sapma
 * anlamlıysa başlangıçtan sona doğrusal eğim, değilse yatay (nokta nokta anlamlılık zikzak çiziyordu).
 */
export function pathOf(ds: Dist[], p0: number, dir: number): { mid: number; lo: number; hi: number }[] {
  const last = ds[ds.length - 1];
  const K = Math.max(1, ds.length - 1);
  const slope = last && last.sig ? (dir === 0 ? last.mean : dir * last.mean) : 0;
  return ds.map((d, k) => ({ ...project({ ...d, sig: false }, p0, dir), mid: r2(p0 + (slope * k) / K) }));
}

/** 5m + 15m kapanış VWAP ve EMA20'nin aynı tarafında mı (saatlik tahmin sınıfı) */
export function hourClass(c5: number, v5: number | null, e5: number | null, c15: number | null, v15: number | null, e15: number | null): HourClass {
  if (v5 == null || e5 == null || c15 == null || v15 == null || e15 == null) return "MIX";
  const up = c5 > v5 && c5 > e5 && c15 > v15 && c15 > e15;
  const dn = c5 < v5 && c5 < e5 && c15 < v15 && c15 < e15;
  return up ? "UP" : dn ? "DOWN" : "MIX";
}

/** Bugünün RTH 5m mumlarından NY dakikasındaki kapanış (o dakikada BİTEN mum) */
export function closeAt(rth5: Bar[], minute: number): number | null {
  const b = rth5.find((x) => nyParts(x.time).minutes + 5 === minute);
  return b ? b.close : null;
}

export function dayPathOf(rth5: Bar[]): number[] {
  const out: number[] = [];
  for (const m of DAY_POINTS) {
    const c = closeAt(rth5, m);
    if (c == null) break;
    out.push(c);
  }
  return out;
}

/**
 * Bir seansın ham gerçekleri — tamamlanmış ya da DEVAM EDEN gün (kısmi yol / saatler).
 * bars: çok günlük 5m mumlar (EMA ısınması için); prevClose: dünkü kapanış (açılış sınıfı için).
 */
export function factsOf(bars: Bar[], date: string, prevClose: number | null, nowSec?: number): PathFacts | null {
  const upto = nowSec ? bars.filter((b) => b.time + 300 <= nowSec) : bars;
  const rth = upto.filter((b) => isRthBar(b) && nyParts(b.time).ymd === date);
  if (rth.length < 6) return null;
  // açılış sınıfı: 10:00 kapanışında NET karar
  const t10 = rth[5].time + 300;
  const pre = upto.filter((b) => b.time < t10);
  const m15 = bucketAggregate(pre, 15), m30 = bucketAggregate(pre, 30);
  const op = openingRegime(daySeries(pre, "5m", date, t10, t10), daySeries(m15, "15m", date, t10, t10), emaByTime(pre), daySeries(m30, "30m", date, t10, t10), null, prevClose);
  const cls: DayClass = op.net ? (op.side === "UP" ? "NET_UP" : "NET_DOWN") : "NONE";
  const path = dayPathOf(rth);
  // saatlik sınıflar
  const e5 = emaByTime(upto);
  const all15 = bucketAggregate(upto, 15);
  const e15 = emaByTime(all15);
  let pv = 0, vv = 0;
  const vw = rth.map((b) => { pv += ((b.high + b.low + b.close) / 3) * b.volume; vv += b.volume; return vv ? pv / vv : null; });
  const r15 = all15.filter((b) => isRthBar(b) && nyParts(b.time).ymd === date);
  let p15 = 0, v15 = 0;
  const vw15 = r15.map((b) => { p15 += ((b.high + b.low + b.close) / 3) * b.volume; v15 += b.volume; return v15 ? p15 / v15 : null; });
  const hours: PathFacts["hours"] = [];
  for (const h of HOUR_STARTS) {
    const i = rth.findIndex((b) => nyParts(b.time).minutes + 5 === h);
    const k = r15.findIndex((b) => nyParts(b.time).minutes + 15 === h);
    if (i < 0 || k < 0) continue;
    const c5 = rth[i].close;
    const hc = hourClass(c5, vw[i], e5.get(rth[i].time) ?? null, r15[k].close, vw15[k], e15.get(r15[k].time) ?? null);
    hours.push({ h, cls: hc, p0: c5, next: rth.slice(i + 1, i + 13).map((b) => b.close) });
  }
  return { cls, path, hours };
}

// ── Takip / isabet ──────────────────────────────────────────────────

/** Bir seans için walk-forward üretilmiş tahminler (yalnız ÖNCEKİ günlerin modeliyle) */
export interface ForecastLog {
  modelN: number;
  /** 10:00 günlük yol tahmini: her nokta için orta/bant */
  day: { mid: number; lo: number; hi: number }[] | null;
  /** Kapanış tahminleri: kontrol noktası başına */
  close: { at: number; price: number; mid: number; lo: number; hi: number }[];
  /** Saatlik: başlangıç, sınıf, +60 orta/bant */
  hours: { h: number; cls: HourClass; p0: number; mid: number; lo: number; hi: number }[];
}

export function makeLog(model: ForecastModel, facts: PathFacts): ForecastLog {
  const g = facts.cls === "NONE" ? "NONE" : "NET";
  const dir = sgnOf(facts.cls);
  const ok = (d: Dist[]) => d.length && d[d.length - 1].n >= 5;
  const day = ok(model.day[g]) && facts.path.length ? pathOf(model.day[g], facts.path[0], dir) : null;
  const close = ok(model.close[g])
    ? CLOSE_CHECKS.map((m, j) => {
      const k = DAY_POINTS.indexOf(m);
      const p = facts.path[k];
      if (p == null) return null;
      const pr = project(model.close[g][j], p, dir);
      return { at: m, price: p, ...pr };
    }).filter((x): x is NonNullable<typeof x> => !!x)
    : [];
  const hours = facts.hours.map((h) => {
    const grp = h.cls === "MIX" ? "MIX" : "ALIGNED";
    const d = model.hour[grp][11];
    if (!d || d.n < 5) return null;
    const pr = project(d, h.p0, h.cls === "UP" ? 1 : h.cls === "DOWN" ? -1 : 0);
    return { h: h.h, cls: h.cls, p0: h.p0, ...pr };
  }).filter((x): x is NonNullable<typeof x> => !!x);
  return { modelN: model.n, day, close, hours };
}

export interface ForecastStats {
  /** Günlük yol: gerçekleşen kapanışın bant içinde olma oranı ve ort. mutlak hata (16:00 noktası) */
  day: { n: number; mae: number; inBand: number; dirHit: number | null };
  /** Kapanış tahmini (kontrol noktası başına) */
  close: Record<string, { n: number; mae: number; inBand: number; dirHit: number | null; naiveMae: number }>;
  /** Saatlik tahmin (+60 dk) */
  hour: Record<HourClass, { n: number; mae: number; inBand: number; dirHit: number | null }>;
}

const pctOf = (a: number, b: number) => (b ? Math.round((100 * a) / b) : 0);

export function forecastStats(rows: { facts: PathFacts; log: ForecastLog }[]): ForecastStats {
  const dayRows = rows.filter((r) => r.log.day && r.facts.path.length === DAY_POINTS.length);
  const dErr = dayRows.map((r) => Math.abs(r.facts.path[r.facts.path.length - 1] - r.log.day![r.log.day!.length - 1].mid));
  const dIn = dayRows.filter((r) => { const c = r.facts.path[r.facts.path.length - 1], f = r.log.day![r.log.day!.length - 1]; return c >= f.lo && c <= f.hi; });
  const dDir = dayRows.filter((r) => r.facts.cls !== "NONE");
  const dDirOk = dDir.filter((r) => Math.sign(r.facts.path[r.facts.path.length - 1] - r.facts.path[0]) === sgnOf(r.facts.cls));
  const close: ForecastStats["close"] = {};
  for (const m of CLOSE_CHECKS) {
    const rs = rows.flatMap((r) => {
      const c = r.log.close.find((x) => x.at === m);
      return c && r.facts.path.length === DAY_POINTS.length ? [{ c, actual: r.facts.path[r.facts.path.length - 1], cls: r.facts.cls }] : [];
    });
    if (!rs.length) continue;
    const dirRs = rs.filter((x) => Math.abs(x.c.mid - x.c.price) >= 0.1);
    close[`${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`] = {
      n: rs.length,
      mae: r2(rs.reduce((a, x) => a + Math.abs(x.actual - x.c.mid), 0) / rs.length),
      naiveMae: r2(rs.reduce((a, x) => a + Math.abs(x.actual - x.c.price), 0) / rs.length),
      inBand: pctOf(rs.filter((x) => x.actual >= x.c.lo && x.actual <= x.c.hi).length, rs.length),
      dirHit: dirRs.length ? pctOf(dirRs.filter((x) => Math.sign(x.actual - x.c.price) === Math.sign(x.c.mid - x.c.price)).length, dirRs.length) : null,
    };
  }
  const hour = {} as ForecastStats["hour"];
  for (const cls of ["UP", "DOWN", "MIX"] as HourClass[]) {
    const hs = rows.flatMap((r) => r.log.hours.filter((h) => h.cls === cls).map((h) => {
      const f = r.facts.hours.find((x) => x.h === h.h);
      return f && f.next.length === 12 ? { h, actual: f.next[11] } : null;
    }).filter((x): x is NonNullable<typeof x> => !!x));
    const dirRs = hs.filter((x) => Math.abs(x.h.mid - x.h.p0) >= 0.1);
    hour[cls] = {
      n: hs.length,
      mae: hs.length ? r2(hs.reduce((a, x) => a + Math.abs(x.actual - x.h.mid), 0) / hs.length) : 0,
      inBand: pctOf(hs.filter((x) => x.actual >= x.h.lo && x.actual <= x.h.hi).length, hs.length),
      dirHit: dirRs.length ? pctOf(dirRs.filter((x) => Math.sign(x.actual - x.h.p0) === Math.sign(x.h.mid - x.h.p0)).length, dirRs.length) : null,
    };
  }
  return {
    day: { n: dayRows.length, mae: dErr.length ? r2(dErr.reduce((a, x) => a + x, 0) / dErr.length) : 0, inBand: pctOf(dIn.length, dayRows.length), dirHit: dDir.length ? pctOf(dDirOk.length, dDir.length) : null },
    close,
    hour,
  };
}
