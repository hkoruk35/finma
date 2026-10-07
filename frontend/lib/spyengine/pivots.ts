/**
 * SPY Engine — Klasik günlük pivot noktaları (saf).
 * Kaynak: bir önceki RTH seansının (09:30–16:00) yüksek / düşük / kapanışı.
 *   P  = (H + L + C) / 3
 *   R1 = 2P − L        S1 = 2P − H
 *   R2 = P + (H − L)   S2 = P − (H − L)
 *   R3 = H + 2(P − L)  S3 = L − 2(H − P)
 * Pivotlar seviye bilgisidir; yön kararına girmez (karar mantığı ve ölçümler değişmez).
 */

import type { Bar } from "./core";
import { isRthBar, nyClock, nyParts, r2 } from "./core";
import type { DaySeries } from "./openingMap";

export type PivotKey = "R3" | "R2" | "R1" | "P" | "S1" | "S2" | "S3";
export const PIVOT_ORDER: PivotKey[] = ["R3", "R2", "R1", "P", "S1", "S2", "S3"];

export interface PivotBase {
  /** Pivotların dayandığı seans */
  date: string;
  H: number;
  L: number;
  C: number;
  levels: Record<PivotKey, number>;
}

export function classicPivots(H: number, L: number, C: number, date: string): PivotBase {
  const P = (H + L + C) / 3;
  return {
    date, H, L, C,
    levels: {
      R3: r2(H + 2 * (P - L)), R2: r2(P + (H - L)), R1: r2(2 * P - L), P: r2(P),
      S1: r2(2 * P - H), S2: r2(P - (H - L)), S3: r2(L - 2 * (H - P)),
    },
  };
}

/** Bugünden (date) önceki son tam RTH seansının H/L/C'si (1m ya da 5m mumlardan) */
export function prevDayPivots(bars: Bar[], date: string, prevClose: number | null): PivotBase | null {
  const prev = bars.filter((b) => isRthBar(b) && nyParts(b.time).ymd < date);
  if (!prev.length) return null;
  const pd = nyParts(prev[prev.length - 1].time).ymd;
  const day = prev.filter((b) => nyParts(b.time).ymd === pd);
  // seansın büyük kısmı yoksa (ör. sadece son saat yüklü) pivot uydurulmaz
  const spanMin = (day[day.length - 1].time - day[0].time) / 60;
  if (spanMin < 300) return null;
  const H = Math.max(...day.map((b) => b.high));
  const L = Math.min(...day.map((b) => b.low));
  const C = prevClose ?? day[day.length - 1].close;
  return classicPivots(H, L, C, pd);
}

export interface PivotLevelRead {
  key: PivotKey;
  price: number;
  /** fiyat − seviye (puan) */
  dist: number;
  /** Bugün ilk değme saati */
  touched: string | null;
  /** Bugünkü davranış */
  state: "DEĞMEDİ" | "TEST · TUTTU" | "KIRILDI ▲" | "KIRILDI ▼" | "ÜZERİNDE";
}

export interface PivotRead {
  base: PivotBase;
  ladder: PivotLevelRead[];
  /** Fiyatın üstündeki / altındaki ilk pivot */
  above: PivotLevelRead | null;
  below: PivotLevelRead | null;
  /** Son 30 dk (6×5m) kapanış değişimi — yön ve hız */
  heading: "UP" | "DOWN" | "FLAT";
  speed30: number;
  /** Gidilen yöndeki pivot ve tahmini varış (dk) — hız sabit kalırsa */
  target: PivotLevelRead | null;
  etaMin: number | null;
  /** Fiyatın bulunduğu bölge, örn. "P – R1" */
  zone: string;
  text: string;
}

export function pivotRead(base: PivotBase, s5: DaySeries, price: number): PivotRead {
  const bars = s5.bars;
  const first = bars[0] ?? null;
  const ladder: PivotLevelRead[] = PIVOT_ORDER.map((key) => {
    const lvl = base.levels[key];
    let touched: string | null = null;
    let state: PivotLevelRead["state"] = "DEĞMEDİ";
    if (first) {
      const startSide = Math.sign(first.open - lvl) || 1;
      let touchIdx = -1;
      for (let i = 0; i < bars.length; i++) if (bars[i].low <= lvl && bars[i].high >= lvl) { touchIdx = i; break; }
      if (touchIdx >= 0) {
        touched = nyClock(bars[touchIdx].time);
        const lastClose = bars[bars.length - 1].close;
        const nowSide = Math.sign(lastClose - lvl);
        if (Math.abs(lastClose - lvl) < 0.05) state = "ÜZERİNDE";
        else if (nowSide === startSide) state = "TEST · TUTTU";
        else state = nowSide > 0 ? "KIRILDI ▲" : "KIRILDI ▼";
      }
    }
    return { key, price: lvl, dist: r2(price - lvl), touched, state };
  });
  const above = [...ladder].filter((l) => l.price > price + 0.02).sort((a, b) => a.price - b.price)[0] ?? null;
  const below = [...ladder].filter((l) => l.price < price - 0.02).sort((a, b) => b.price - a.price)[0] ?? null;

  const n = bars.length;
  const speed30 = n >= 7 ? r2(bars[n - 1].close - bars[n - 7].close) : n >= 2 ? r2(bars[n - 1].close - bars[0].open) : 0;
  const heading: PivotRead["heading"] = speed30 > 0.25 ? "UP" : speed30 < -0.25 ? "DOWN" : "FLAT";
  const target = heading === "UP" ? above : heading === "DOWN" ? below : null;
  const etaMin = target && Math.abs(speed30) > 0.05 ? Math.max(5, Math.round((Math.abs(target.price - price) / Math.abs(speed30)) * 30 / 5) * 5) : null;
  const zone = `${below ? below.key : "S3 altı"} – ${above ? above.key : "R3 üstü"}`;

  const lvlTxt = (l: PivotLevelRead) => `${l.key} ${l.price.toFixed(2)}`;
  let text: string;
  if (heading === "FLAT") {
    text = `Fiyat ${zone} bölgesinde yatay (son 30 dk ${speed30 >= 0 ? "+" : ""}${speed30.toFixed(2)} puan).${above ? ` Üst: ${lvlTxt(above)} (+${(above.price - price).toFixed(2)})` : ""}${below ? ` · Alt: ${lvlTxt(below)} (−${(price - below.price).toFixed(2)})` : ""}.`;
  } else if (target) {
    text = `Fiyat ${heading === "UP" ? "yukarı" : "aşağı"} ${lvlTxt(target)}'e gidiyor: ${Math.abs(target.price - price).toFixed(2)} puan kaldı, son 30 dk hız ${speed30 >= 0 ? "+" : ""}${speed30.toFixed(2)} puan${etaMin ? ` → bu hızla ~${etaMin} dk` : ""}.${target.state === "TEST · TUTTU" ? ` ${target.key} bugün ${target.touched}'te test edilip tutmuştu — tepki ihtimali.` : ""}`;
  } else {
    text = `Fiyat tüm pivotların ${heading === "UP" ? "üstünde" : "altında"} — güçlü trend günü.`;
  }
  return { base, ladder, above, below, heading, speed30, target, etaMin, zone, text };
}
