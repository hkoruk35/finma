"use client";

import React, { useState } from "react";
import TVChartEmbed from "@/components/TVChartEmbed";

interface Props {
  ticker: string;
}

type TF = "1h" | "1D" | "1W";

const TF_MAP: Record<TF, string> = {
  "1h": "60",
  "1D": "D",
  "1W": "W",
};

const SCREENER_STUDIES = [
  "MAExp@tv-basicstudies",   // EMA
  "MAExp@tv-basicstudies",   // EMA second (50)
  "RSI@tv-basicstudies",
  "Volume@tv-basicstudies",
];

export default function ScreenerChart({ ticker }: Props) {
  const [tf, setTf]           = useState<TF>("1D");
  const [isFullscreen, setFs] = useState(false);

  const clean  = ticker.replace("-", ".");
  const tvSymbol = clean;

  const chartHeight = isFullscreen ? (typeof window !== "undefined" ? window.innerHeight - 80 : 600) : 440;

  return (
    <>
      {/* Fullscreen backdrop */}
      {isFullscreen && (
        <div
          onClick={() => setFs(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 9998 }}
        />
      )}

      <div style={{
        background: "#000036",
        border: "1px solid #253347",
        borderRadius: 6,
        marginTop: 12,
        overflow: "hidden",
        position: isFullscreen ? "fixed" : "relative",
        inset: isFullscreen ? "20px" : undefined,
        zIndex: isFullscreen ? 9999 : 1,
      }}>
        {/* Toolbar */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "7px 12px", borderBottom: "1px solid #1e2a3a",
        }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", letterSpacing: 1.5, textTransform: "uppercase" }}>
            {ticker} · Grafik
          </span>

          <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
            {(["1h", "1D", "1W"] as TF[]).map(t => (
              <button key={t} onClick={() => setTf(t)} style={{
                padding: "3px 9px", borderRadius: 3, fontSize: 10, fontWeight: 700, cursor: "pointer",
                border: tf === t ? "1px solid #4ade80" : "1px solid #253347",
                background: tf === t ? "rgba(74,222,128,0.1)" : "transparent",
                color: tf === t ? "#4ade80" : "#7c8fa6",
                transition: "all .15s",
              }}>{t}</button>
            ))}
            <div style={{ width: 1, height: 16, background: "#253347" }} />
            <button
              onClick={() => setFs(f => !f)}
              title={isFullscreen ? "Kapat (Esc)" : "Tam ekran"}
              style={{
                padding: "3px 8px", borderRadius: 3, fontSize: 14, cursor: "pointer",
                border: "1px solid #253347", background: "transparent", color: "#7c8fa6",
              }}
            >
              {isFullscreen ? "✕" : "⛶"}
            </button>
          </div>
        </div>

        {/* Chart — same engine as Terminal */}
        <TVChartEmbed
          key={`${ticker}-${tf}`}
          tvSymbol={tvSymbol}
          interval={TF_MAP[tf]}
          containerId={`screener_chart_${ticker}`}
          height={chartHeight}
          compact={false}
          studies={SCREENER_STUDIES}
        />
      </div>
    </>
  );
}
