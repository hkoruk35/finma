/**
 * QQQ Engine — büyük teknoloji liderleri takibi (saf, izomorfik — DOM/ağ yok).
 *
 * QQQ'nun yönü birkaç dev hissenin hareketiyle belirlenir. Her lider için kapanmış
 * 5m mumlardan: fiyatın günlük VWAP'a (09:30 ankrajlı) ve EMA20'ye (5m) göre tarafı,
 * son 15 dk momentumu, günlük değişim ve QQQ'ya göre göreli güç hesaplanır; ağırlıklı
 * toplam "genişlik" (−1…+1) olarak karar merdivenine (ladder.ts · tech) girer.
 *
 * Ağırlıklar YAKLAŞIKTIR (Nasdaq-100'de büyük paylar; fon dağılımı zamanla değişir) —
 * ölçümde sıra/oran önemli, tam yüzde değil. Güncel ağırlıklar için fon sağlayıcısına bakın.
 */

import { nyParts, r2, type Bar } from "../spyengine/core";
import { emaByTime } from "../spyengine/openingMap";

export interface TechHolding {
  sym: string;
  name: string;
  /** Yaklaşık Nasdaq-100 ağırlığı (%) */
  weight: number;
}

export const TECH_HOLDINGS: TechHolding[] = [
  { sym: "NVDA", name: "NVIDIA", weight: 13 },
  { sym: "MSFT", name: "Microsoft", weight: 12 },
  { sym: "AAPL", name: "Apple", weight: 11 },
  { sym: "AMZN", name: "Amazon", weight: 7 },
  { sym: "GOOGL", name: "Alphabet", weight: 6 },
  { sym: "META", name: "Meta", weight: 5 },
  { sym: "AVGO", name: "Broadcom", weight: 5 },
  { sym: "TSLA", name: "Tesla", weight: 3 },
  { sym: "COST", name: "Costco", weight: 3 },
  { sym: "NFLX", name: "Netflix", weight: 3 },
];

export interface TechRow {
  sym: string;
  name: string;
  weight: number;
  price: number | null;
  /** Günlük değişim (%): bugünkü açılış değil, önceki kapanışa göre */
  dayPct: number | null;
  /** Fiyat − VWAP (%) */
  vwapPct: number | null;
  /** VWAP ve EMA20'ye göre taraf: +1 ikisinin de üstünde · −1 ikisinin de altında · 0 karışık */
  side: 1 | -1 | 0;
  vwapSide: 1 | -1 | 0;
  emaSide: 1 | -1 | 0;
  /** Son 15 dk (3 × 5m) değişim (%) */
  mom15Pct: number | null;
  /** Günlük değişim − QQQ günlük değişim (puan) */
  rsPct: number | null;
  /** QQQ'nun günlük hareketine katkı (ağırlık × günlük değişim, bps) */
  contribBps: number | null;
}

export interface TechSnapshot {
  rows: TechRow[];
  /** Ağırlıklı genişlik (−1…+1): VWAP + EMA20 tarafı */
  breadth: number | null;
  /** Ağırlıklı 15 dk momentum yönü (−1…+1) */
  momentum: number | null;
  /** İkisinin de üstünde / altında olan liderlerin ağırlık payı (%) */
  upWeight: number;
  downWeight: number;
  /** Liderlerin QQQ'ya göre okuması (tek cümle) */
  read: string;
  /** Her 5m mum başlangıcı → {vw, mom} (ladder girişi) */
  series: Map<number, { vw: number; mom: number }>;
  asOf: number | null;
}

const sgn = (x: number): 1 | -1 | 0 => (x > 0 ? 1 : x < 0 ? -1 : 0);

interface Prepared {
  close: Map<number, number>;
  vwap: Map<number, number>;
  ema: Map<number, number>;
  firstOpen: number | null;
  prevClose: number | null;
}

function prepare(bars: Bar[], date: string): Prepared {
  const close = new Map<number, number>();
  const vwap = new Map<number, number>();
  const ema = emaByTime(bars);
  let pv = 0, vv = 0, firstOpen: number | null = null, prevClose: number | null = null;
  let lastPrevDay = "";
  for (const b of bars) {
    const p = nyParts(b.time);
    const rth = p.minutes >= 9 * 60 + 30 && p.minutes < 16 * 60;
    if (rth && p.ymd < date && p.ymd >= lastPrevDay) { lastPrevDay = p.ymd; prevClose = b.close; }
    if (!rth || p.ymd !== date) continue;
    if (firstOpen == null) firstOpen = b.open;
    pv += ((b.high + b.low + b.close) / 3) * (b.volume || 0);
    vv += b.volume || 0;
    close.set(b.time, b.close);
    vwap.set(b.time, vv > 0 ? pv / vv : b.close);
  }
  return { close, vwap, ema, firstOpen, prevClose };
}

/** Liderlerin 5m verisinden (kapanmış mumlar: `nowSec`'ten önce biten) tam görünüm */
export function buildTechSnapshot(
  bySymbol: Record<string, Bar[]>,
  qqq: Bar[],
  date: string,
  nowSec: number,
): TechSnapshot {
  const cutoff = (bars: Bar[]) => bars.filter((b) => b.time + 300 <= nowSec);
  const prep: Record<string, Prepared> = {};
  for (const h of TECH_HOLDINGS) if (bySymbol[h.sym]?.length) prep[h.sym] = prepare(cutoff(bySymbol[h.sym]), date);
  const q = prepare(cutoff(qqq), date);

  // 5m mum başlangıcı → genişlik / momentum (QQQ'nun kapanmış mumları üzerinden)
  const series = new Map<number, { vw: number; mom: number }>();
  let lastT: number | null = null;
  for (const t of q.close.keys()) {
    let s = 0, m = 0, w = 0;
    for (const h of TECH_HOLDINGS) {
      const x = prep[h.sym];
      if (!x) continue;
      const c = x.close.get(t), v = x.vwap.get(t);
      if (c == null || v == null) continue;
      const e = x.ema.get(t);
      w += h.weight;
      s += (h.weight * (sgn(c - v) + (e != null ? sgn(c - e) : 0))) / 2;
      const c3 = x.close.get(t - 900);
      if (c3 != null) m += h.weight * sgn(c - c3);
    }
    if (w > 0) {
      series.set(t, { vw: Math.round((s / w) * 1000) / 1000, mom: Math.round((m / w) * 1000) / 1000 });
      lastT = t;
    }
  }

  const qNow = lastT != null ? q.close.get(lastT) ?? null : null;
  const qDay = qNow != null && q.prevClose ? ((qNow - q.prevClose) / q.prevClose) * 100 : null;
  const rows: TechRow[] = TECH_HOLDINGS.map((h) => {
    const x = prep[h.sym];
    const t = lastT;
    const c = x && t != null ? x.close.get(t) ?? null : null;
    const v = x && t != null ? x.vwap.get(t) ?? null : null;
    const e = x && t != null ? x.ema.get(t) ?? null : null;
    const c3 = x && t != null ? x.close.get(t - 900) ?? null : null; // 3 mum önceki kapanış → 15 dk
    const day = c != null && x?.prevClose ? ((c - x.prevClose) / x.prevClose) * 100 : null;
    const vs = c != null && v != null ? sgn(c - v) : 0;
    const es = c != null && e != null ? sgn(c - e) : 0;
    return {
      sym: h.sym, name: h.name, weight: h.weight,
      price: c != null ? r2(c) : null,
      dayPct: day != null ? r2(day) : null,
      vwapPct: c != null && v != null ? r2(((c - v) / v) * 100) : null,
      side: vs === es ? vs : 0, vwapSide: vs, emaSide: es,
      mom15Pct: c != null && c3 != null ? r2(((c - c3) / c3) * 100) : null,
      rsPct: day != null && qDay != null ? r2(day - qDay) : null,
      contribBps: day != null ? Math.round(h.weight * day) : null,
    };
  });

  const cur = lastT != null ? series.get(lastT) ?? null : null;
  const tw = rows.filter((r) => r.price != null).reduce((a, r) => a + r.weight, 0) || 1;
  const upW = rows.filter((r) => r.side > 0).reduce((a, r) => a + r.weight, 0);
  const dnW = rows.filter((r) => r.side < 0).reduce((a, r) => a + r.weight, 0);
  const up = Math.round((upW / tw) * 100), dn = Math.round((dnW / tw) * 100);
  const lead = rows.filter((r) => r.price != null).slice().sort((a, b) => b.weight - a.weight).slice(0, 3);
  const leadTxt = lead.map((r) => `${r.sym} ${r.side > 0 ? "VWAP/EMA20 üstü" : r.side < 0 ? "altı" : "karışık"}`).join(" · ");
  const read = cur == null ? "Liderlerden veri bekleniyor."
    : cur.vw >= 0.5 ? `Liderler QQQ'yu yukarı destekliyor (ağırlığın %${up}'i VWAP+EMA20 üstünde). ${leadTxt}.`
    : cur.vw <= -0.5 ? `Liderler QQQ'yu aşağı çekiyor (ağırlığın %${dn}'i VWAP+EMA20 altında). ${leadTxt}.`
    : `Liderler karışık (üstünde %${up} · altında %${dn}): net bir lider yönü yok. ${leadTxt}.`;

  return {
    rows, breadth: cur ? cur.vw : null, momentum: cur ? cur.mom : null, upWeight: up, downWeight: dn, read, series,
    asOf: lastT != null ? lastT + 300 : null,
  };
}
