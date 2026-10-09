/**
 * SPY Engine V11 — 60 günlük arşiv: olay isabet oranları + V11 hükümlerinin
 * geriye dönük (walk-forward, yalnızca kapanmış mum) sonuçları.
 *
 * İlke 7: "Ölçülmeyen şey gösterilmez." Her olay türü arşivde isabet oranıyla
 * tutulur; isabeti %50'nin altında kalan tür ana ekrandan kalkar. Sayılar
 * yalnızca burada, gerçek mumlardan hesaplanır — uydurma yok.
 *
 * Sınırlar (dürüstlük): arşiv 5m mumlarla (Yahoo 5m ≤ 60 gün) çalışır; opsiyon
 * duvarları geçmiş için yoktur (yalnızca canlı gün seviye evrenine girer).
 */

import { prepare, runDay, firstTouch, SETUP_LABEL, type GradedEvent, type Grade, type Prep, type SetupKey, type Trade } from "./engine";
import { V11_CONFIG as CFG } from "./config";
import type { Bar } from "../core";

export interface HitStat { n: number; hit: number; rate: number | null }

export interface ArchiveStats {
  days: number;
  from: string | null;
  to: string | null;
  /** anahtar: `${kind}|${levelKey}|${grade}` ve `${kind}|*|${grade}` */
  events: Record<string, HitStat>;
  trades: {
    n: number;
    winRate: number | null;
    avgR: number | null;
    sumR: number | null;
    bySetup: Record<string, { n: number; winRate: number | null; avgR: number | null }>;
    byRegime: Record<string, { n: number; avgR: number | null }>;
  };
  /** Rastgele mum + rastgele yön için aynı ölçütün tabanı (olay isabeti buna kıyaslanmalı) */
  baseline: { n: number; rate: number | null };
  horizonMin: number;
  minSample: number;
  minHitRate: number;
}

const rate = (hit: number, n: number): number | null => (n > 0 ? Math.round((hit / n) * 1000) / 1000 : null);

export function buildArchive(m5All: Bar[], nowSec: number): ArchiveStats {
  const prep: Prep = prepare(m5All, nowSec);
  const today = prep.days[prep.days.length - 1];
  const past = prep.days.filter((d) => d !== today).slice(-CFG.archive.days);
  const ev: Record<string, { n: number; hit: number }> = {};
  const bump = (key: string, ok: boolean) => {
    const x = (ev[key] ??= { n: 0, hit: 0 });
    x.n++;
    if (ok) x.hit++;
  };
  const allTrades: Trade[] = [];
  let baseN = 0, baseHit = 0;
  const hSteps = CFG.archive.horizonMin / 5;
  for (const d of past) {
    const run = runDay(prep, d);
    {
      const r = prep.dayRange.get(d)!;
      for (let i = 0; i + hSteps < run.bars.length; i++) {
        const a = prep.atr5[r.s + i];
        if (a == null) continue;
        baseN += 2;
        if (firstTouch(run.bars, i, 1, a, hSteps)) baseHit++;
        if (firstTouch(run.bars, i, -1, a, hSteps)) baseHit++;
      }
    }
    for (const t of run.trades) if (t.r != null) allTrades.push(t);
    for (const e of run.events) {
      const o = e.outcomes.find((x) => x.min === CFG.archive.horizonMin);
      if (!o || o.state === "…") continue;
      const ok = o.state === "✓";
      bump(`${e.kind}|${e.levelKey}|${e.grade}`, ok);
      bump(`${e.kind}|*|${e.grade}`, ok);
    }
  }
  const events: Record<string, HitStat> = {};
  for (const [k, v] of Object.entries(ev)) events[k] = { n: v.n, hit: v.hit, rate: rate(v.hit, v.n) };

  const rs = allTrades.map((t) => t.r as number);
  const wins = rs.filter((r) => r > 0).length;
  const sum = rs.reduce((a, x) => a + x, 0);
  const group = <T extends string>(keyOf: (t: Trade) => T) => {
    const m: Record<string, { n: number; w: number; s: number }> = {};
    for (const t of allTrades) {
      const x = (m[keyOf(t)] ??= { n: 0, w: 0, s: 0 });
      x.n++;
      if ((t.r as number) > 0) x.w++;
      x.s += t.r as number;
    }
    return m;
  };
  const bySetupRaw = group((t) => t.setup);
  const byRegimeRaw = group((t) => t.regime);
  return {
    days: past.length,
    from: past[0] ?? null,
    to: past[past.length - 1] ?? null,
    events,
    trades: {
      n: rs.length,
      winRate: rate(wins, rs.length),
      avgR: rs.length ? Math.round((sum / rs.length) * 100) / 100 : null,
      sumR: rs.length ? Math.round(sum * 100) / 100 : null,
      bySetup: Object.fromEntries(Object.entries(bySetupRaw).map(([k, v]) => [k, { n: v.n, winRate: rate(v.w, v.n), avgR: Math.round((v.s / v.n) * 100) / 100 }])),
      byRegime: Object.fromEntries(Object.entries(byRegimeRaw).map(([k, v]) => [k, { n: v.n, avgR: Math.round((v.s / v.n) * 100) / 100 }])),
    },
    baseline: { n: baseN, rate: rate(baseHit, baseN) },
    horizonMin: CFG.archive.horizonMin,
    minSample: CFG.archive.minSample,
    minHitRate: CFG.archive.minHitRate,
  };
}

export interface ArchiveLabel {
  /** "DİP SÜPÜRME @VAL · arşiv %63 (41 olay)" veya "… · arşiv örneklemi yetersiz (n=12)" */
  text: string;
  rate: number | null;
  n: number;
  /** Ana ekranda gösterilebilir mi (İlke 7) */
  eligible: boolean;
  /** isabet < %50 ve yeterli örneklem → kanıt panelinde "deneysel" */
  experimental: boolean;
}

export function archiveLabel(e: Pick<GradedEvent, "kind" | "label" | "levelKey" | "grade">, a: ArchiveStats | null): ArchiveLabel {
  const lvl = e.levelKey && e.levelKey !== "—" ? `@${e.levelKey}` : "";
  const head = `${e.label}${lvl ? ` ${lvl}` : ""}`;
  if (!a) return { text: `${head} · arşiv yok`, rate: null, n: 0, eligible: true, experimental: false };
  // en özelden genele: tür+seviye+sınıf → tür+sınıf
  const specific = a.events[`${e.kind}|${e.levelKey}|${e.grade}`];
  const general = a.events[`${e.kind}|*|${e.grade}`];
  const pick = specific && specific.n >= a.minSample ? specific : general;
  if (!pick || pick.n < a.minSample) {
    const n = pick?.n ?? 0;
    return { text: `${head} · arşiv örneklemi yetersiz (n=${n})`, rate: pick?.rate ?? null, n, eligible: true, experimental: false };
  }
  const pct = Math.round((pick.rate ?? 0) * 100);
  const exp = (pick.rate ?? 0) < a.minHitRate;
  const base = a.baseline.rate != null ? ` · taban %${Math.round(a.baseline.rate * 100)}` : "";
  return { text: `${head} · arşiv %${pct} (${pick.n} olay)${base}`, rate: pick.rate, n: pick.n, eligible: !exp, experimental: exp };
}

export type { Grade, SetupKey };
export { SETUP_LABEL };
