"use client";

/**
 * SPY Engine V9.0 — Tahmin Haritası (SVG).
 *
 * Bugünün 5m mumları + VWAP üzerine: destek/direnç çizgileri, tahmini
 * yolculuk (kesikli çizgi), kapanış beklentisi ve tahmin bandı (koni).
 * Yolculuk bir TAHMİNDİR; çizimdeki her seviye ölçülmüş veriden gelir.
 */

import { useMemo } from "react";
import { nyClock, nyDateTimeToEpoch, RTH_OPEN_MIN, RTH_CLOSE_MIN, type Bar } from "@/lib/spyengine/core";
import type { ForecastMapData } from "@/lib/spyengine/openingMap";

const W = 920;
const H = 340;
const PAD = { l: 8, r: 118, t: 14, b: 22 };

export default function ForecastMap({
  bars, vwapSeries, map, date, nowSec,
}: {
  /** Bugünün RTH 5m mumları (oluşmakta olan dahil) */
  bars: Bar[];
  /** bars ile aynı uzunlukta VWAP */
  vwapSeries: (number | null)[];
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

  const pathPts = map.path.map((p) => `${X(p.t).toFixed(1)},${Y(p.price).toFixed(1)}`).join(" ");
  const last = map.path[map.path.length - 1];
  const first = map.path[0];
  const cone = `${X(first.t)},${Y(first.price)} ${X(last.t)},${Y(map.closeHigh)} ${X(last.t)},${Y(map.closeLow)}`;
  const biasColor = map.bias === "UP" ? "#22c55e" : map.bias === "DOWN" ? "#ef4444" : "#eab308";
  const nowX = X(Math.min(Math.max(nowSec, g.x0), g.x1));

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

      {/* VWAP */}
      {vwapPts && <polyline points={vwapPts} fill="none" stroke="#e879f9" strokeWidth={1.4} />}

      {/* tahmin konisi + yolculuk */}
      <polygon points={cone} fill={biasColor} opacity={0.09} />
      <polyline points={pathPts} fill="none" stroke={biasColor} strokeWidth={2} strokeDasharray="7 5" />
      {map.path.map((p, i) => (
        <g key={i}>
          <circle cx={X(p.t)} cy={Y(p.price)} r={3.5} fill={i === 0 ? "#e2e8f0" : biasColor} stroke="#0a0e17" strokeWidth={1} />
          {i > 0 && (
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
