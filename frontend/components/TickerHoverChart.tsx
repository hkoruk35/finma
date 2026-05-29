"use client";

import { useState, useRef, useCallback, ReactNode } from "react";
import { createPortal } from "react-dom";

interface Props {
  ticker: string;
  children: ReactNode;
  className?: string;
}

export default function TickerHoverChart({ ticker, children, className }: Props) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleEnter = useCallback((e: React.MouseEvent<HTMLSpanElement>) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const r = e.currentTarget.getBoundingClientRect();
    setPos({ x: r.right + 10, y: r.top });
  }, []);

  const handleLeave = useCallback(() => {
    timerRef.current = setTimeout(() => setPos(null), 120);
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
          onMouseLeave={() => setPos(null)}
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
              {ticker} — 1W Chart
            </span>
            <div style={{ display: "flex", gap: 12, fontSize: 10 }}>
              <a
                href={`/stock/${ticker}`}
                style={{ color: "#3fb950" }}
              >
                Detay ↗
              </a>
              <a
                href={`https://finviz.com/quote.ashx?t=${ticker}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "#8b949e" }}
              >
                Finviz ↗
              </a>
            </div>
          </div>
          <iframe
            src={`https://s.tradingview.com/widgetembed/?frameElementId=tv_hover_${ticker}&symbol=${ticker}&interval=W&theme=dark&style=1&locale=en&hide_top_toolbar=1&hide_legend=1&save_image=0&withdateranges=0&hideideas=1&hide_side_toolbar=1`}
            width="430"
            height="220"
            style={{ border: "none", display: "block" }}
            title={`${ticker} 1W`}
          />
        </div>,
        document.body
      )}
    </>
  );
}
