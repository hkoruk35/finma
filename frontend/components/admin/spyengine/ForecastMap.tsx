"use client";

/**
 * SPY Engine — Tahmin Haritası (SVG).
 *
 * Bugünün 5m mumları + VWAP + EMA20 üzerine yalnızca karar için gereken seviyeler:
 * en yakın 2 destek / 2 direnç, POC (değer alanı gölge), en yakın likidite havuzu (her yönde 1),
 * opsiyon duvarları / max pain, gün tepesi / dibi. Takip Sistemi senaryoları (ana + iptal yolu)
 * çizgi olarak çizilir; açıklamaları grafiğin içine değil üstteki senaryo satırına yazılır.
 *
 * Netlik kuralları (2026-10-15, kullanıcı: "kaos var, iç içe geçmesin"):
 *   • Fiyat ekseni solda; sağ kenar yalnız seviye etiketleri için. Etiketler çakışmayacak şekilde dikeyde
 *     dizilir (en az 11 px aralık); yerine sığmayan düşük öncelikli etiket çizilmez (çizgisi soluk kalır).
 *   • Salınım dip/tepeleri yalnız küçük işaret (fiyat yazısı yok); süpürmeler ✕.
 * Senaryo bir TAHMİNDİR; her seviye ölçülmüş veriden gelir.
 */

import { useMemo } from "react";
import { nyClock, nyDateTimeToEpoch, RTH_OPEN_MIN, RTH_CLOSE_MIN, type Bar } from "@/lib/spyengine/core";
import type { ForecastMapData } from "@/lib/spyengine/openingMap";
import type { FlowRead } from "@/lib/spyengine/flow";
import type { OptionLevels } from "@/lib/spyengine/optionLevels";

const W = 920;
const H = 360;
const PAD = { l: 46, r: 150, t: 42, b: 22 };
const MIN_GAP = 11;

export interface MapScenario {
  /** şimdi → … noktaları */
  pts: { t: number; price: number; label: string }[];
  /** ölçülmüş olasılık / isabet (%) */
  pct: number | null;
  color: string;
  /** ana senaryo kalın, alternatif ince */
  main: boolean;
}

interface Lvl { price: number; text: string; color: string; dash: string; width: number; prio: number; opacity?: number }

/** Sağ kenar etiketleri: çizgiye en yakın boş yere, çakışmadan; sığmayan düşük öncelikliler atlanır */
function layoutLabels(items: { y: number; prio: number; i: number }[], top: number, bottom: number): Map<number, number> {
  const placed: { y: number; i: number }[] = [];
  const out = new Map<number, number>();
  for (const it of [...items].sort((a, b) => a.prio - b.prio || a.y - b.y)) {
    let best: number | null = null;
    for (let d = 0; d <= 18; d += 1) {
      for (const cand of [it.y + d, it.y - d]) {
        if (cand < top || cand > bottom) continue;
        if (placed.every((p) => Math.abs(p.y - cand) >= MIN_GAP)) { best = cand; break; }
      }
      if (best != null) break;
    }
    if (best == null) continue;
    placed.push({ y: best, i: it.i });
    out.set(it.i, best);
  }
  return out;
}

export default function ForecastMap({
  bars, vwapSeries, emaSeries, flow, optLevels, map, date, nowSec, endSec, scenarios,
}: {
  /** x ekseninin sonu (verilmezse 16:00) — Takip Sistemi ufku: şimdi + 90 dk */
  endSec?: number;
  /** Takip Sistemi senaryoları — verilirse gün sonu yolculuğu/konisi yerine çizilir */
  scenarios?: MapScenario[];
  /** Bugünün RTH 5m mumları (oluşmakta olan dahil) */
  bars: Bar[];
  /** bars ile aynı uzunlukta VWAP */
  vwapSeries: (number | null)[];
  /** bars ile aynı uzunlukta EMA20 (çok günlük akıştan ısınmış) */
  emaSeries?: (number | null)[];
  flow?: FlowRead | null;
  /** 0DTE opsiyon duvarları + max pain — yalnızca seviye çizgisi */
  optLevels?: OptionLevels | null;
  map: ForecastMapData;
  date: string;
  nowSec: number;
}) {
  const g = useMemo(() => {
    const x0 = nyDateTimeToEpoch(date, RTH_OPEN_MIN);
    const x1 = Math.min(nyDateTimeToEpoch(date, RTH_CLOSE_MIN), Math.max(endSec ?? Infinity, x0 + 3600));
    const useScen = !!scenarios?.length;
    const prices: number[] = useScen ? [map.price] : [map.price, map.closeLow, map.closeHigh];
    for (const sc of scenarios ?? []) for (const p of sc.pts) prices.push(p.price);
    for (const b of bars) prices.push(b.high, b.low);
    for (const l of [...map.supports.slice(0, 2), ...map.resistances.slice(0, 2)]) prices.push(l.price);
    if (!useScen) for (const p of map.path) prices.push(p.price);
    if (map.vwap != null) prices.push(map.vwap);
    let lo = Math.min(...prices);
    let hi = Math.max(...prices);
    const padY = Math.max(0.2, (hi - lo) * 0.05);
    lo -= padY; hi += padY;
    const X = (t: number) => PAD.l + ((t - x0) / (x1 - x0)) * (W - PAD.l - PAD.r);
    const Y = (p: number) => PAD.t + (1 - (p - lo) / (hi - lo)) * (H - PAD.t - PAD.b);
    return { x0, x1, lo, hi, X, Y, useScen };
  }, [bars, map, date, endSec, scenarios]);

  const { X, Y } = g;
  const plotR = W - PAD.r;
  const barW = Math.max(1.5, (X(g.x0 + 300) - X(g.x0)) * 0.62);
  const inY = (p: number) => p >= g.lo && p <= g.hi;

  const grid: number[] = [];
  const step = g.hi - g.lo > 8 ? 1 : g.hi - g.lo > 4 ? 0.5 : 0.25;
  for (let p = Math.ceil(g.lo / step) * step; p <= g.hi; p += step) grid.push(p);
  const hours = [10, 11, 12, 13, 14, 15].map((h) => nyDateTimeToEpoch(date, h * 60)).filter((t) => t < g.x1 - 600);

  const vwapPts = bars.map((b, i) => (vwapSeries[i] != null ? `${X(b.time + 150).toFixed(1)},${Y(vwapSeries[i] as number).toFixed(1)}` : null)).filter(Boolean).join(" ");
  const emaPts = (emaSeries ?? []).map((e, i) => (e != null && bars[i] ? `${X(bars[i].time + 150).toFixed(1)},${Y(e).toFixed(1)}` : null)).filter(Boolean).join(" ");

  const biasColor = map.bias === "UP" ? "#22c55e" : map.bias === "DOWN" ? "#ef4444" : "#eab308";
  const nowX = X(Math.min(Math.max(nowSec, g.x0), g.x1));

  // gün tepesi / dibi
  let dayHi: { t: number; p: number } | null = null, dayLo: { t: number; p: number } | null = null;
  for (const b of bars) {
    if (!dayHi || b.high > dayHi.p) dayHi = { t: b.time, p: b.high };
    if (!dayLo || b.low < dayLo.p) dayLo = { t: b.time, p: b.low };
  }
  const swings = (flow?.swings ?? []).filter((sw) => !(dayHi && sw.kind === "HIGH" && sw.time === dayHi.t) && !(dayLo && sw.kind === "LOW" && sw.time === dayLo.t));
  const sweeps = (flow?.events ?? []).filter((e) => e.kind === "SWEEP_HIGH" || e.kind === "SWEEP_LOW");
  const prof = flow?.profile ?? null;

  // ── seviyeler (öncelik: 1 S/R · 2 POC · 3 likidite/opsiyon · 4 VAH/VAL) ──
  const short = (s: string) => (s.length > 16 ? `${s.slice(0, 15)}…` : s);
  const lv: Lvl[] = [];
  map.resistances.slice(0, 2).forEach((l) => lv.push({ price: l.price, text: `D ${l.price.toFixed(2)} · ${short(l.label)}`, color: "#f87171", dash: "5 4", width: 0.9, prio: 1 }));
  map.supports.slice(0, 2).forEach((l) => lv.push({ price: l.price, text: `S ${l.price.toFixed(2)} · ${short(l.label)}`, color: "#4ade80", dash: "5 4", width: 0.9, prio: 1 }));
  if (prof) {
    lv.push({ price: prof.poc, text: `POC ${prof.poc.toFixed(2)}`, color: "#fb923c", dash: "", width: 1.1, prio: 2 });
    lv.push({ price: prof.vah, text: `VAH ${prof.vah.toFixed(2)}`, color: "#c2410c", dash: "2 3", width: 0.6, prio: 4, opacity: 0.6 });
    lv.push({ price: prof.val, text: `VAL ${prof.val.toFixed(2)}`, color: "#c2410c", dash: "2 3", width: 0.6, prio: 4, opacity: 0.6 });
  }
  if (flow) {
    const up = flow.pools.filter((pl) => !pl.swept && pl.side === "BUY" && pl.price > map.price && inY(pl.price)).sort((a, b) => a.price - b.price)[0];
    const dn = flow.pools.filter((pl) => !pl.swept && pl.side === "SELL" && pl.price < map.price && inY(pl.price)).sort((a, b) => b.price - a.price)[0];
    if (up) lv.push({ price: up.price, text: `$ ${up.price.toFixed(2)} alış stopları`, color: "#facc15", dash: "1 2.5", width: 0.9, prio: 3 });
    if (dn) lv.push({ price: dn.price, text: `$ ${dn.price.toFixed(2)} satış stopları`, color: "#facc15", dash: "1 2.5", width: 0.9, prio: 3 });
  }
  if (optLevels) {
    optLevels.callWalls.slice(0, 1).forEach((w) => lv.push({ price: w.strike, text: `C duvar ${w.strike.toFixed(0)}`, color: "#f472b6", dash: "8 3 1 3", width: 0.8, prio: 3 }));
    optLevels.putWalls.slice(0, 1).forEach((w) => lv.push({ price: w.strike, text: `P duvar ${w.strike.toFixed(0)}`, color: "#38bdf8", dash: "8 3 1 3", width: 0.8, prio: 3 }));
    if (optLevels.maxPain != null) lv.push({ price: optLevels.maxPain, text: `max pain ${optLevels.maxPain.toFixed(0)}`, color: "#e2e8f0", dash: "8 3 1 3", width: 0.7, prio: 4 });
  }
  // aynı fiyattaki tekrarları birleştir (yüksek öncelikli kalır)
  const levels: Lvl[] = [];
  for (const l of lv.filter((x) => inY(x.price)).sort((a, b) => a.prio - b.prio)) {
    if (levels.some((x) => Math.abs(x.price - l.price) < 0.03)) continue;
    levels.push(l);
  }
  const labelY = layoutLabels(levels.map((l, i) => ({ y: Y(l.price), prio: l.prio, i })), PAD.t + 4, H - PAD.b - 2);

  // senaryo özeti (grafiğin içine yazılmaz)
  const scen = scenarios ?? [];
  const mainSc = scen.find((s) => s.main) ?? null;
  const altSc = scen.filter((s) => !s.main);
  const endLabel = (s: MapScenario) => s.pts.slice(1).map((p) => p.label).join(" → ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Tahmin haritası">
      <rect x={0} y={0} width={W} height={H} fill="#0a0e17" />

      {/* fiyat ızgarası (eksen solda) */}
      {grid.map((p) => (
        <g key={p}>
          <line x1={PAD.l} x2={plotR} y1={Y(p)} y2={Y(p)} stroke="#151c28" strokeWidth={0.6} />
          <text x={PAD.l - 4} y={Y(p) + 3} fontSize={8} fill="#475569" textAnchor="end" fontFamily="monospace">{p.toFixed(2)}</text>
        </g>
      ))}
      {hours.map((t) => (
        <g key={t}>
          <line x1={X(t)} x2={X(t)} y1={PAD.t} y2={H - PAD.b} stroke="#131b29" strokeWidth={0.6} />
          <text x={X(t)} y={H - 8} fontSize={8} fill="#475569" textAnchor="middle" fontFamily="monospace">{nyClock(t)}</text>
        </g>
      ))}
      <text x={X(g.x0)} y={H - 8} fontSize={8} fill="#475569" fontFamily="monospace">09:30</text>
      <text x={plotR} y={H - 8} fontSize={8} fill="#475569" textAnchor="end" fontFamily="monospace">{nyClock(g.x1)}</text>

      {/* değer alanı gölgesi */}
      {prof && inY(prof.vah) && inY(prof.val) && (
        <rect x={PAD.l} y={Y(prof.vah)} width={plotR - PAD.l} height={Math.max(1, Y(prof.val) - Y(prof.vah))} fill="#f97316" opacity={0.04} />
      )}

      {/* seviyeler + sağ kenar etiketleri (çakışmasız) */}
      {levels.map((l, i) => {
        const ly = labelY.get(i);
        const y = Y(l.price);
        return (
          <g key={`l${i}`} opacity={l.opacity ?? 1}>
            <line x1={PAD.l} x2={plotR} y1={y} y2={y} stroke={l.color} strokeWidth={l.width} strokeDasharray={l.dash || undefined} opacity={ly == null ? 0.35 : 0.8} />
            {ly != null && (
              <>
                {Math.abs(ly - y) > 1 && <line x1={plotR} x2={plotR + 6} y1={y} y2={ly} stroke={l.color} strokeWidth={0.6} opacity={0.7} />}
                <text x={plotR + 8} y={ly + 3} fontSize={8.5} fill={l.color} fontFamily="monospace">{l.text}</text>
              </>
            )}
          </g>
        );
      })}

      {/* 5m mumlar */}
      {bars.map((b) => {
        const up = b.close >= b.open;
        const c = up ? "#22c55e" : "#ef4444";
        const cx = X(b.time + 150);
        const yo = Y(b.open), yc = Y(b.close);
        return (
          <g key={b.time}>
            <line x1={cx} x2={cx} y1={Y(b.high)} y2={Y(b.low)} stroke={c} strokeWidth={0.8} />
            <rect x={cx - barW / 2} y={Math.min(yo, yc)} width={barW} height={Math.max(1, Math.abs(yo - yc))} fill={c} />
          </g>
        );
      })}

      {/* salınım dip/tepe: yalnız işaret */}
      {swings.map((sw) => {
        const cx = X(sw.time + 150);
        const hi = sw.kind === "HIGH";
        const y = Y(sw.price) + (hi ? -4 : 4);
        return <path key={`${sw.kind}${sw.time}`} d={hi ? `M${cx - 2.5},${y - 3.5} L${cx + 2.5},${y - 3.5} L${cx},${y}` : `M${cx - 2.5},${y + 3.5} L${cx + 2.5},${y + 3.5} L${cx},${y}`} fill={hi ? "#f87171" : "#4ade80"} opacity={0.7} />;
      })}
      {dayHi && (
        <text x={X(dayHi.t + 150)} y={Math.max(PAD.t + 8, Y(dayHi.p) - 6)} fontSize={8.5} fontWeight={700} fill="#f87171" textAnchor="middle" fontFamily="monospace">▼ TEPE {dayHi.p.toFixed(2)}</text>
      )}
      {dayLo && (
        <text x={X(dayLo.t + 150)} y={Math.min(H - PAD.b - 2, Y(dayLo.p) + 13)} fontSize={8.5} fontWeight={700} fill="#4ade80" textAnchor="middle" fontFamily="monospace">▲ DİP {dayLo.p.toFixed(2)}</text>
      )}
      {sweeps.map((e) => (
        <text key={`sw${e.time}${e.kind}`} x={X(e.time + 150)} y={Y(e.price) + (e.kind === "SWEEP_HIGH" ? -2 : 7)} fontSize={8} fontWeight={700} fill="#facc15" textAnchor="middle" opacity={0.8}>✕</text>
      ))}

      {/* VWAP / EMA20 */}
      {vwapPts && <polyline points={vwapPts} fill="none" stroke="#e879f9" strokeWidth={1.4} />}
      {emaPts && <polyline points={emaPts} fill="none" stroke="#22d3ee" strokeWidth={1.2} />}

      {/* Takip senaryoları — yalnız çizgi + uç noktası */}
      {g.useScen && scen.map((sc, k) => {
        const pts = sc.pts.map((p) => `${X(Math.min(p.t, g.x1)).toFixed(1)},${Y(p.price).toFixed(1)}`).join(" ");
        return (
          <g key={`sc${k}`}>
            <polyline points={pts} fill="none" stroke={sc.color} strokeWidth={sc.main ? 2.2 : 1.2} strokeDasharray={sc.main ? "7 4" : "3 4"} opacity={sc.main ? 1 : 0.75} />
            {sc.pts.slice(1).map((p, i) => <circle key={i} cx={X(Math.min(p.t, g.x1))} cy={Y(p.price)} r={sc.main ? 3.5 : 2.5} fill={sc.color} stroke="#0a0e17" strokeWidth={1} />)}
          </g>
        );
      })}
      {/* gün sonu yolculuğu (senaryo yoksa) */}
      {!g.useScen && (() => {
        const first = map.path[0], last = map.path[map.path.length - 1];
        return (
          <>
            <polygon points={`${X(first.t)},${Y(first.price)} ${X(last.t)},${Y(map.closeHigh)} ${X(last.t)},${Y(map.closeLow)}`} fill={biasColor} opacity={0.08} />
            <polyline points={map.path.map((p) => `${X(p.t).toFixed(1)},${Y(p.price).toFixed(1)}`).join(" ")} fill="none" stroke={biasColor} strokeWidth={2} strokeDasharray="7 5" />
          </>
        );
      })()}

      {/* şimdi */}
      <line x1={nowX} x2={nowX} y1={PAD.t} y2={H - PAD.b} stroke="#94a3b8" strokeWidth={0.8} strokeDasharray="2 3" />
      <text x={nowX} y={PAD.t - 2} fontSize={8} fill="#94a3b8" textAnchor="middle">şimdi</text>

      {/* üst satır: çizgi açıklamaları + senaryo özeti (grafiğin içine yazı yok) */}
      <g fontSize={8.5} fontFamily="monospace">
        <line x1={PAD.l} x2={PAD.l + 12} y1={9} y2={9} stroke="#e879f9" strokeWidth={1.4} />
        <text x={PAD.l + 15} y={12} fill="#e879f9">VWAP</text>
        <line x1={PAD.l + 46} x2={PAD.l + 58} y1={9} y2={9} stroke="#22d3ee" strokeWidth={1.2} />
        <text x={PAD.l + 61} y={12} fill="#22d3ee">EMA20</text>
        <text x={PAD.l + 100} y={12} fill="#64748b">S/D destek-direnç · POC · $ likidite · ✕ süpürme · ▲▼ dip/tepe</text>
        {mainSc && (
          <text x={PAD.l} y={23} fill={mainSc.color} fontWeight={700}>
            ━ Ana senaryo: {endLabel(mainSc)}{mainSc.pct != null ? ` · hedefe değme %${mainSc.pct}` : ""}
          </text>
        )}
        {!mainSc && altSc.length > 0 && (
          <text x={PAD.l} y={23} fill="#94a3b8">┄ Yön yok — {altSc.map(endLabel).join("  |  ")}</text>
        )}
        {mainSc && altSc.length > 0 && (
          <text x={PAD.l} y={33} fill="#94a3b8">┄ İptal yolu: {altSc.map(endLabel).join("  |  ")}</text>
        )}
      </g>
    </svg>
  );
}
