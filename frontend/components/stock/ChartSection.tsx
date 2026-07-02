"use client";

import { useState } from "react";
import TradingViewWidget from "./TradingViewWidget";

interface Props {
  ticker: string;
  exchange?: string;
  companyMismatch?: { local: string; yfinance: string };
}

export default function ChartSection({ ticker, exchange, companyMismatch }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [interval, setInterval] = useState("W");

  const intervals = [
    { label: "15M", value: "15" },
    { label: "1H", value: "60" },
    { label: "1D", value: "D" },
    { label: "1W", value: "W" },
  ];

  return (
    <div className="glass-card overflow-hidden mb-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between px-4 py-2.5 border-b border-[#1e2a3a] bg-[#0d1117]/60 gap-3">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse" />
          <span className="text-xs font-bold text-white uppercase tracking-widest">
            Live Chart · {ticker}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Interval Selector */}
          <div className="flex items-center bg-[#141924] rounded-lg p-0.5 border border-[#1e2a3a]">
            {intervals.map((int) => (
              <button
                key={int.value}
                onClick={() => setInterval(int.value)}
                className={`px-2.5 py-1 rounded text-[10px] font-black transition-all ${
                  interval === int.value
                    ? "bg-[#3b82f6] text-white shadow-lg shadow-blue-500/20"
                    : "text-[#00d2ff] hover:text-white"
                }`}
              >
                {int.label}
              </button>
            ))}
          </div>

          <div className="h-4 w-px bg-[#1e2a3a] mx-1 hidden md:block" />
          
          <span className="px-2 py-1 rounded bg-[#1e2a3a] text-[9px] font-black text-[#00d2ff] uppercase tracking-widest">NY TIME</span>
          
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#3b82f6]/10 hover:bg-[#3b82f6]/20 text-[10px] font-black text-[#3b82f6] hover:text-white transition-all border border-[#3b82f6]/30"
          >
            {expanded ? (
              <>
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M8 3v3a2 2 0 0 1-2 2H3" /><path d="M21 8h-3a2 2 0 0 1-2-2V3" />
                  <path d="M3 16h3a2 2 0 0 1 2 2v3" /><path d="M16 21v-3a2 2 0 0 1 2-2h3" />
                </svg>
                COLLAPSE
              </>
            ) : (
              <>
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M3 8V5a2 2 0 0 1 2-2h3" /><path d="M16 3h3a2 2 0 0 1 2 2v3" />
                  <path d="M21 16v3a2 2 0 0 1-2 2h-3" /><path d="M8 21H5a2 2 0 0 1-2-2v-3" />
                </svg>
                EXPAND
              </>
            )}
          </button>
        </div>
      </div>

      {companyMismatch && (
        <div className="px-4 py-2 bg-[#f59e0b]/10 border-b border-[#f59e0b]/30 flex items-center gap-2">
          <span className="text-[#f59e0b] text-xs">⚠</span>
          <span className="text-xs text-[#f59e0b]">
            Chart may show a different company. BOGA tracks{" "}
            <strong>{companyMismatch.local}</strong>{" "}
            — grafik{" "}
            <strong>{companyMismatch.yfinance}</strong> gösteriyor olabilir.
          </span>
        </div>
      )}

      <div
        className="transition-all duration-500 ease-in-out overflow-hidden"
        style={{ height: expanded ? 520 : 260 }}
      >
        <TradingViewWidget
          symbol={ticker}
          exchange={exchange}
          height={expanded ? 520 : 260}
          interval={interval}
        />
      </div>
    </div>
  );
}
