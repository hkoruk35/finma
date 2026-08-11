"use client";

import { useState } from "react";
import BogaChartEngine from "@/components/charts/BogaChartEngine";

type Locale = "en" | "tr" | "es" | "fr" | "pt" | "id";

interface Props {
  ticker: string;
  exchange?: string;
  companyMismatch?: { local: string; yfinance: string };
  lang?: Locale;
}

const EXPAND_LABEL: Record<Locale, [string, string]> = {
  en: ["EXPAND", "COLLAPSE"],
  tr: ["GENÄ°ÅžLET", "DARALT"],
  es: ["EXPANDIR", "CONTRAER"],
  fr: ["AGRANDIR", "RÃ‰DUIRE"],
  pt: ["EXPANDIR", "RECOLHER"],
  id: ["PERLUAS", "CIUTKAN"],
};

export default function ChartSection({ ticker, exchange, companyMismatch, lang = "en" }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [expandLabel, collapseLabel] = EXPAND_LABEL[lang] || EXPAND_LABEL.en;

  return (
    <div className="glass-card overflow-hidden mb-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between px-4 py-2.5 border-b border-[#1e2a3a] bg-[#0d1117]/60 gap-3">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse" />
          <span className="text-xs font-medium text-white uppercase tracking-widest">
            Live Chart Â· {ticker}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-2 py-1 rounded bg-[#1e2a3a] text-[9px] font-medium text-[#00d2ff] uppercase tracking-widest">NY TIME</span>

          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#3b82f6]/10 hover:bg-[#3b82f6]/20 text-[10px] font-medium text-[#3b82f6] hover:text-white transition-all border border-[#3b82f6]/30"
          >
            {expanded ? (
              <>
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M8 3v3a2 2 0 0 1-2 2H3" /><path d="M21 8h-3a2 2 0 0 1-2-2V3" />
                  <path d="M3 16h3a2 2 0 0 1 2 2v3" /><path d="M16 21v-3a2 2 0 0 1 2-2h3" />
                </svg>
                {collapseLabel}
              </>
            ) : (
              <>
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M3 8V5a2 2 0 0 1 2-2h3" /><path d="M16 3h3a2 2 0 0 1 2 2v3" />
                  <path d="M21 16v3a2 2 0 0 1-2 2h-3" /><path d="M8 21H5a2 2 0 0 1-2-2v-3" />
                </svg>
                {expandLabel}
              </>
            )}
          </button>
        </div>
      </div>

      {companyMismatch && (
        <div className="px-4 py-2 bg-[#f59e0b]/10 border-b border-[#f59e0b]/30 flex items-center gap-2">
          <span className="text-[#f59e0b] text-xs">âš </span>
          <span className="text-xs text-[#f59e0b]">
            Chart may show a different company. BOGA tracks{" "}
            <strong>{companyMismatch.local}</strong>{" "}
            â€” grafik{" "}
            <strong>{companyMismatch.yfinance}</strong> gÃ¶steriyor olabilir.
          </span>
        </div>
      )}

      <div
        className="transition-all duration-500 ease-in-out overflow-hidden"
        style={{ height: expanded ? 560 : 300 }}
      >
        <BogaChartEngine
          symbol={ticker}
          height={expanded ? 560 : 300}
          lang={lang}
        />
      </div>
    </div>
  );
}

