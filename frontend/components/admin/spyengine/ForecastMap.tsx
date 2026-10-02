"use client";

/**
 * SPY Engine V9.0 — Tahmin Haritası (SVG).
 *
 * Bugünün 5m mumları + VWAP üzerine: destek/direnç çizgileri, tahmini
 * yolculuk (kesikli çizgi), kapanış beklentisi ve tahmin bandı (koni).
 * Akış katmanı (flow.ts): salınım dip/tepeleri, gün tepesi/dibi, hacim
 * profili (POC/VAH/VAL), süpürülmemiş likidite havuzları ve süpürme işaretleri.
 * Yolculuk bir TAHMİNDİR; çizimdeki her seviye ölçülmüş veriden gelir.
 */

import { useMemo } from "react";
import { nyClock, nyDateTimeToEpoch, RTH_OPEN_MIN, RTH_CLOSE_MIN, type Bar } from "@/lib/spyengine/core";
import type { ForecastMapData } from "@/lib/spyengine/openingMap";
import type { FlowRead } from "@/lib/spyengine/flow";
import type { OptionLevels } from "@/lib/spyengine/optionLevels";

const W = 920;
const H = 340;
const PAD = { l: 8, r: 118, t: 26, b: 22 };

export default function ForecastMap({
  bars, vwapSeries, emaSeries, flow, optLevels, map, date, nowSec,
}: {
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
    const x1 = nyDateTimeToEpoch(date, RTH_CLOSE_MIN);
    const prices: number[] = [map.price, map.closeLow, map.closeHigh];
    for (const b of bars) prices.push(b.high, b.low);
    for (const l of [...map.supports, ...map.resistances]) prices.push(l.price);
    for (const p of map.path) prices.push(p.price);
    if (map.vwap != null) prices.push(map.vwap);
    let lo = Math.min(...prices);
    let hi = Math.max(...prices);
    const padY = Math.max(0.2, (hi - lo) * 0.06);
    lo -= padY; hi += padY;
    const X = (t: number) => PAD.l + ((t - x0) / (x1 - x0)) * (W - PAD.l - PAD.r);
    const Y = (p: number) => PAD.t + (1 - (p - lo) / (hi - lo)) * (H - PAD.t - PAD.b);
    return { x0, x1, lo, hi, X, Y };
  }, [bars, map, date]);

  const { X, Y } = g;
  const barW = Math.max(1.5, (X(g.x0 + 300) - X(g.x0)) * 0.62);

  const grid: number[] = [];
  const step = g.hi - g.lo > 6 ? 1 : g.hi - g.lo > 3 ? 0.5 : 0.25;
  for (let p = Math.ceil(g.lo / step) * step; p <= g.hi; p += step) grid.push(p);

  const hours = [10, 11, 12, 13, 14, 15].map((h) => nyDateTimeToEpoch(date, h * 60));

  const vwapPts = bars
    .map((b, i) => (vwapSeries[i] != null ? `${X(b.time + 150).toFixed(1)},${Y(vwapSeries[i] as number).toFixed(1)}` : null))
    .filter(Boolean)
    .join(" ");
  const emaPts = (emaSeries ?? [])
    .map((e, i) => (e != null && bars[i] ? `${X(bars[i].time + 150).toFixed(1)},${Y(e).toFixed(1)}` : null))
    .filter(Boolean)
    .join(" ");

  const pathPts = map.path.map((p) => `${X(p.t).toFixed(1)},${Y(p.price).toFixed(1)}`).join(" ");
  const last = map.path[map.path.length - 1];
  const first = map.path[0];
  const cone = `${X(first.t)},${Y(first.price)} ${X(last.t)},${Y(map.closeHigh)} ${X(last.t)},${Y(map.closeLow)}`;
  const biasColor = map.bias === "UP" ? "#22c55e" : map.bias === "DOWN" ? "#ef4444" : "#eab308";
  const nowX = X(Math.min(Math.max(nowSec, g.x0), g.x1));
  const inY = (p: number) => p >= g.lo && p <= g.hi;
  const plotR = W - PAD.r;

  // gün tepesi / dibi (oluşan mum dahil)
  let dayHi: { t: number; p: number } | null = null, dayLo: { t: number; p: number } | null = null;
  for (const b of bars) {
    if (!dayHi || b.high > dayHi.p) dayHi = { t: b.time, p: b.high };
    if (!dayLo || b.low < dayLo.p) dayLo = { t: b.time, p: b.low };
  }
  const swings = (flow?.swings ?? []).filter((sw) => !(dayHi && sw.kind === "HIGH" && sw.time === dayHi.t) && !(dayLo && sw.kind === "LOW" && sw.time === dayLo.t));
  // fiyata en yakın süpürülmemiş havuzlar (her yönde 2)
  const pools = flow
    ? [
        ...flow.pools.filter((pl) => !pl.swept && pl.side === "BUY" && pl.price > map.price && inY(pl.price)).sort((a, b) => a.price - b.price).slice(0, 2),
        ...flow.pools.filter((pl) => !pl.swept && pl.side === "SELL" && pl.price < map.price && inY(pl.price)).sort((a, b) => b.price - a.price).slice(0, 2),
      ]
    : [];
  const sweeps = (flow?.events ?? []).filter((e) => e.kind === "SWEEP_HIGH" || e.kind === "SWEEP_LOW");
  const prof = flow?.profile ?? null;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Tahmin haritası">
      <rect x={0} y={0} width={W} height={H} fill="#0a0e17" />

      {grid.map((p) => (
        <g key={p}>
          <line x1={PAD.l} x2={W - PAD.r} y1={Y(p)} y2={Y(p)} stroke="#1c2635" strokeWidth={0.6} />
          <text x={W - PAD.r + 4} y={Y(p) + 3} fontSize={8} fill="#475569" fontFamily="monospace">{p.toFixed(2)}</text>
        </g>
      ))}
      {hours.map((t) => (
        <g key={t}>
          <line x1={X(t)} x2={X(t)} y1={PAD.t} y2={H - PAD.b} stroke="#131b29" strokeWidth={0.6} />
          <text x={X(t)} y={H - 8} fontSize={8} fill="#475569" textAnchor="middle" fontFamily="monospace">{nyClock(t)}</text>
        </g>
      ))}
      <text x={X(g.x0)} y={H - 8} fontSize={8} fill="#475569" fontFamily="monospace">09:30</text>
      <text x={X(g.x1)} y={H - 8} fontSize={8} fill="#475569" textAnchor="end" fontFamily="monospace">16:00</text>

      {/* destek / direnç */}
      {map.resistances.map((l) => (
        <g key={`r${l.price}`}>
          <line x1={PAD.l} x2={W - PAD.r} y1={Y(l.price)} y2={Y(l.price)} stroke="#ef4444" strokeWidth={0.9} strokeDasharray="5 4" opacity={0.75} />
          <text x={W - PAD.r + 4} y={Y(l.price) - 2} fontSize={8.5} fill="#f87171" fontFamily="monospace">D {l.price.toFixed(2)}</text>
          <text x={W - PAD.r + 4} y={Y(l.price) + 8} fontSize={7} fill="#7f1d1d">{l.label.slice(0, 20)}</text>
        </g>
      ))}
      {map.supports.map((l) => (
        <g key={`s${l.price}`}>
          <line x1={PAD.l} x2={W - PAD.r} y1={Y(l.price)} y2={Y(l.price)} stroke="#22c55e" strokeWidth={0.9} strokeDasharray="5 4" opacity={0.75} />
          <text x={W - PAD.r + 4} y={Y(l.price) - 2} fontSize={8.5} fill="#4ade80" fontFamily="monospace">S {l.price.toFixed(2)}</text>
          <text x={W - PAD.r + 4} y={Y(l.price) + 8} fontSize={7} fill="#14532d">{l.label.slice(0, 20)}</text>
        </g>
      ))}

      {/* hacim profili: POC + değer alanı */}
      {prof && inY(prof.vah) && inY(prof.val) && (
        <rect x={PAD.l} y={Y(prof.vah)} width={plotR - PAD.l} height={Math.max(1, Y(prof.val) - Y(prof.vah))} fill="#f97316" opacity={0.05} />
      )}
      {prof && inY(prof.poc) && (
        <g>
          <line x1={PAD.l} x2={plotR} y1={Y(prof.poc)} y2={Y(prof.poc)} stroke="#f97316" strokeWidth={1.1} opacity={0.85} />
          <text x={PAD.l + 108} y={Y(prof.poc) - 3} fontSize={8} fill="#fb923c" fontFamily="monospace">POC {prof.poc.toFixed(2)}</text>
        </g>
      )}
      {prof && [["VAH", prof.vah], ["VAL", prof.val]].map(([l, p]) => inY(p as number) && (
        <g key={l as string}>
          <line x1={PAD.l} x2={plotR} y1={Y(p as number)} y2={Y(p as number)} stroke="#f97316" strokeWidth={0.7} strokeDasharray="2 3" opacity={0.6} />
          <text x={PAD.l + 108} y={Y(p as number) + (l === "VAL" ? 9 : -3)} fontSize={7.5} fill="#c2410c" fontFamily="monospace">{l} {(p as number).toFixed(2)}</text>
        </g>
      ))}

      {/* süpürülmemiş likidite havuzları (stop kümeleri) */}
      {pools.map((pl) => (
        <g key={`p${pl.side}${pl.price}`}>
          <line x1={X(Math.max(pl.from, g.x0))} x2={plotR} y1={Y(pl.price)} y2={Y(pl.price)} stroke="#facc15" strokeWidth={0.9} strokeDasharray="1 2.5" opacity={0.9} />
          <text x={plotR - 3} y={Y(pl.price) + (pl.side === "BUY" ? -3 : 9)} fontSize={7.5} fill="#facc15" textAnchor="end" fontFamily="monospace">
            $ {pl.price.toFixed(2)} {pl.side === "BUY" ? "alış stopları" : "satış stopları"} · {pl.label}
          </text>
        </g>
      ))}

      {/* 0DTE opsiyon seviyeleri: call/put duvarı + max pain (yalnızca seviye) */}
      {optLevels && [
        ...optLevels.callWalls.map((w, i) => ({ p: w.strike, t: `C${i ? "2" : ""} duvar`, c: "#f472b6" })),
        ...optLevels.putWalls.map((w, i) => ({ p: w.strike, t: `P${i ? "2" : ""} duvar`, c: "#38bdf8" })),
        ...(optLevels.maxPain != null ? [{ p: optLevels.maxPain, t: "max pain", c: "#e2e8f0" }] : []),
      ].filter((l) => inY(l.p)).map((l) => (
        <g key={`o${l.t}${l.p}`}>
          <line x1={PAD.l} x2={plotR} y1={Y(l.p)} y2={Y(l.p)} stroke={l.c} strokeWidth={0.9} strokeDasharray="8 3 1 3" opacity={0.85} />
          <text x={PAD.l + 3} y={Y(l.p) - 2} fontSize={7.5} fill={l.c} fontFamily="monospace">{l.t} {l.p.toFixed(2)}</text>
        </g>
      ))}

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

      {/* salınım dip / tepeleri */}
      {swings.map((sw) => {
        const cx = X(sw.time + 150);
        const hi = sw.kind === "HIGH";
        const y = Y(sw.price) + (hi ? -4 : 4);
        return (
          <g key={`${sw.kind}${sw.time}`}>
            <path d={hi ? `M${cx - 3},${y - 4} L${cx + 3},${y - 4} L${cx},${y}` : `M${cx - 3},${y + 4} L${cx + 3},${y + 4} L${cx},${y}`} fill={hi ? "#f87171" : "#4ade80"} />
            <text x={cx} y={hi ? y - 6 : y + 12} fontSize={7} fill={hi ? "#fca5a5" : "#86efac"} textAnchor="middle" fontFamily="monospace">{sw.price.toFixed(2)}</text>
          </g>
        );
      })}
      {dayHi && (
        <g>
          <path d={`M${X(dayHi.t + 150) - 4},${Y(dayHi.p) - 9} L${X(dayHi.t + 150) + 4},${Y(dayHi.p) - 9} L${X(dayHi.t + 150)},${Y(dayHi.p) - 3}`} fill="#ef4444" />
          <text x={X(dayHi.t + 150)} y={Math.max(PAD.t - 2, Y(dayHi.p) - 12)} fontSize={8.5} fontWeight={700} fill="#f87171" textAnchor="middle" fontFamily="monospace">TEPE {dayHi.p.toFixed(2)}</text>
        </g>
      )}
      {dayLo && (
        <g>
          <path d={`M${X(dayLo.t + 150) - 4},${Y(dayLo.p) + 9} L${X(dayLo.t + 150) + 4},${Y(dayLo.p) + 9} L${X(dayLo.t + 150)},${Y(dayLo.p) + 3}`} fill="#22c55e" />
          <text x={X(dayLo.t + 150)} y={Math.min(H - PAD.b - 2, Y(dayLo.p) + 19)} fontSize={8.5} fontWeight={700} fill="#4ade80" textAnchor="middle" fontFamily="monospace">DİP {dayLo.p.toFixed(2)}</text>
        </g>
      )}
      {/* likidite süpürmeleri */}
      {sweeps.map((e) => (
        <text key={`sw${e.time}${e.kind}`} x={X(e.time + 150)} y={Y(e.price) + (e.kind === "SWEEP_HIGH" ? -2 : 7)} fontSize={9} fontWeight={700} fill="#facc15" textAnchor="middle">✕</text>
      ))}

      {/* VWAP */}
      {vwapPts && <polyline points={vwapPts} fill="none" stroke="#e879f9" strokeWidth={1.4} />}
      {/* EMA20 */}
      {emaPts && <polyline points={emaPts} fill="none" stroke="#22d3ee" strokeWidth={1.2} />}
      <g fontSize={8} fontFamily="monospace">
        <line x1={PAD.l + 4} x2={PAD.l + 18} y1={8} y2={8} stroke="#e879f9" strokeWidth={1.4} />
        <text x={PAD.l + 21} y={11} fill="#e879f9">VWAP</text>
        <line x1={PAD.l + 50} x2={PAD.l + 64} y1={8} y2={8} stroke="#22d3ee" strokeWidth={1.2} />
        <text x={PAD.l + 67} y={11} fill="#22d3ee">EMA20</text>
        {prof && (
          <>
            <line x1={PAD.l + 100} x2={PAD.l + 114} y1={8} y2={8} stroke="#f97316" strokeWidth={1.1} />
            <text x={PAD.l + 117} y={11} fill="#fb923c">POC / değer alanı</text>
          </>
        )}
        {flow && (
          <>
            <line x1={PAD.l + 196} x2={PAD.l + 210} y1={8} y2={8} stroke="#facc15" strokeWidth={0.9} strokeDasharray="1 2.5" />
            <text x={PAD.l + 213} y={11} fill="#facc15">$ likidite · ✕ süpürme · ▲▼ dip/tepe</text>
          </>
        )}
        {optLevels && (
          <>
            <line x1={PAD.l + 400} x2={PAD.l + 414} y1={8} y2={8} stroke="#f472b6" strokeWidth={0.9} strokeDasharray="8 3 1 3" />
            <text x={PAD.l + 417} y={11} fill="#f472b6">opsiyon duvarı / max pain</text>
          </>
        )}
      </g>

      {/* tahmin konisi + yolculuk */}
      <polygon points={cone} fill={biasColor} opacity={0.09} />
      <polyline points={pathPts} fill="none" stroke={biasColor} strokeWidth={2} strokeDasharray="7 5" />
      {map.path.map((p, i) => (
        <g key={i}>
          <circle cx={X(p.t)} cy={Y(p.price)} r={3.5} fill={i === 0 ? "#e2e8f0" : biasColor} stroke="#0a0e17" strokeWidth={1} />
          {i > 0 && (i === map.path.length - 1 || X(map.path[map.path.length - 1].t) - X(p.t) > 70) && (
            <text
              x={Math.min(X(p.t), W - PAD.r - 4)}
              y={Y(p.price) + (i % 2 ? -8 : 14)}
              fontSize={9}
              fill={biasColor}
              textAnchor={i === map.path.length - 1 ? "end" : "middle"}
              fontWeight={600}
            >
              {p.label}
            </text>
          )}
        </g>
      ))}

      {/* şimdi */}
      <line x1={nowX} x2={nowX} y1={PAD.t} y2={H - PAD.b} stroke="#94a3b8" strokeWidth={0.8} strokeDasharray="2 3" />
      <text x={nowX} y={PAD.t - 3} fontSize={8} fill="#94a3b8" textAnchor="middle">şimdi</text>
    </svg>
  );
}
