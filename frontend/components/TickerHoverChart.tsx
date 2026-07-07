"use client";

import { useState, useRef, useCallback, ReactNode } from "react";
import { createPortal } from "react-dom";
import BogaChartEngine from "@/components/charts/BogaChartEngine";

interface Props {
  ticker: string;
  children: ReactNode;
  className?: string;
  detailHref?: string;
  /** When set, "Detay" becomes a button calling this instead of navigating —
   *  used to open Deep Analysis in place without ever exposing the /ai URL. */
  onDetailClick?: () => void;
  detailLabel?: string;
}

export default function TickerHoverChart({ ticker, children, className, detailHref, onDetailClick, detailLabel }: Props) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleEnter = useCallback((e: React.MouseEvent<HTMLSpanElement>) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const r = e.currentTarget.getBoundingClientRect();
    setPos({ x: r.right + 10, y: r.top });
  }, []);

  const handleLeave = useCallback(() => {
    timerRef.current = setTimeout(() => setPos(null), 750);
  }, []);

  const left = pos ? Math.min(pos.x, (typeof window !== "undefined" ? window.innerWidth : 1400) - 440) : 0;
  const top  = pos ? Math.max(8,  Math.min(pos.y, (typeof window !== "undefined" ? window.innerHeight : 900) - 270)) : 0;

  return (
    <>
      <span
        className={className}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        style={{ cursor: "default" }}
      >
        {children}
      </span>

      {pos && typeof document !== "undefined" && createPortal(
        <div
          onMouseEnter={() => { if (timerRef.current) clearTimeout(timerRef.current); }}
          onMouseLeave={() => {
            timerRef.current = setTimeout(() => setPos(null), 750);
          }}
          style={{
            position: "fixed",
            left,
            top,
            width: 430,
            zIndex: 9999,
            background: "#161b22",
            border: "1px solid #30363d",
            borderRadius: 6,
            overflow: "hidden",
            pointerEvents: "auto",
            boxShadow: "0 8px 32px rgba(0,0,0,0.7)",
          }}
        >
          <div style={{
            padding: "7px 12px",
            borderBottom: "1px solid #30363d",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}>
            <span style={{ color: "#58a6ff", fontWeight: 900, fontSize: 12 }}>
              {ticker} — 1D Chart
            </span>
            <div style={{ display: "flex", gap: 12, fontSize: 10 }}>
              {onDetailClick ? (
                <button
                  onClick={onDetailClick}
                  style={{ color: "#3fb950", background: "none", border: "none", padding: 0, cursor: "pointer", font: "inherit" }}
                >
                  {detailLabel || "Detay ↗"}
                </button>
              ) : (
                <a
                  href={detailHref || `/stock/${ticker}`}
                  style={{ color: "#3fb950" }}
                >
                  Detay ↗
                </a>
              )}
              <a
                href={`/global/en/graphic/${ticker}`}
                style={{ color: "#8b949e" }}
              >
                Grafik Detay ↗
              </a>
            </div>
          </div>
          <div style={{ width: 430, height: 220 }}>
            <BogaChartEngine symbol={ticker} interval="D" height={220} compact showToolbar={false} indicators={["ema20"]} />
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
