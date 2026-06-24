"use client";

import Link from "next/link";
import { useTracker } from "@/components/TrackerContext";
import type { HotThemeStock } from "@/lib/hotThemes2026";

interface Props {
  stocks: HotThemeStock[];
  accent: string;
}

export default function HotThemeStockGrid({ stocks, accent }: Props) {
  const { addToTracker, isInTracker } = useTracker();

  const missing = stocks.filter((s) => !isInTracker(s.ticker));

  return (
    <div>
      <div className="flex items-center justify-end mb-2">
        <button
          onClick={() => missing.forEach((s) => addToTracker(s.ticker, "Swing"))}
          disabled={missing.length === 0}
          className="text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-lg border transition-all disabled:opacity-40 disabled:cursor-default hover:bg-white/10"
          style={{ borderColor: accent, color: accent }}
        >
          {missing.length === 0 ? "✓ Hepsi Tracker'da" : `+ Tümünü Tracker'a Ekle (${missing.length})`}
        </button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 items-start">
        {stocks.map((stock) => {
          const tracked = isInTracker(stock.ticker);
          return (
            <div key={stock.ticker} className="rounded-lg border border-white/5 bg-black/20 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-baseline gap-2 min-w-0">
                  <Link href={`/stock/${stock.ticker}`} className="font-black text-[12px] hover:underline shrink-0" style={{ color: accent }}>
                    {stock.ticker}
                  </Link>
                  <span className="text-[10px] text-slate-500 truncate">{stock.company}</span>
                </div>
                {tracked ? (
                  <Link
                    href="/tracker"
                    className="shrink-0 text-[9px] font-black px-1.5 py-0.5 rounded border border-[#3fb950] text-[#3fb950] bg-[#0d2a0d] whitespace-nowrap"
                  >
                    ✓ Tracker
                  </Link>
                ) : (
                  <button
                    onClick={() => addToTracker(stock.ticker, "Swing")}
                    className="shrink-0 text-[9px] font-black px-1.5 py-0.5 rounded border border-white/15 text-slate-400 hover:text-white hover:border-white/30 whitespace-nowrap"
                  >
                    + Tracker
                  </button>
                )}
              </div>
              <p className="text-[10.5px] text-slate-500 leading-snug mt-1">{stock.blurb}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
