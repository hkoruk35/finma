"use client";

import Link from "next/link";
import { useMemo, type ReactNode } from "react";

interface Trade {
  ticker: string;
  sector: string;
  return_pct: number | null;
  result: string;
}

interface Props {
  history: Trade[];
  linkHref?: string | null;
}

function CardWrapper({
  href,
  className,
  children,
}: {
  href?: string | null;
  className: string;
  children: ReactNode;
}) {
  if (href) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }
  return <div className={className}>{children}</div>;
}

export default function SectorPerformanceHeatMap({ history, linkHref = "/performance" }: Props) {
  const SL_PCT = -3.5;

  const heatmap = useMemo(() => {
    const map: Record<string, { total: number; sumRet: number }> = {};

    history.forEach(t => {
      if (!t.sector || t.sector === "Unknown") return;

      const effRet = t.return_pct != null
        ? (t.return_pct < SL_PCT ? SL_PCT : t.return_pct)
        : 0;

      if (!map[t.sector]) map[t.sector] = { total: 0, sumRet: 0 };
      map[t.sector].total++;
      map[t.sector].sumRet += effRet;
    });

    return Object.entries(map)
      .map(([name, d]) => ({
        name,
        total: d.total,
        avgReturn: d.total > 0 ? (d.sumRet / d.total) : 0
      }))
      .sort((a, b) => b.avgReturn - a.avgReturn);
  }, [history]);

  function heatColor(avg: number) {
    if (avg >= 12) return "border-[#22c55e]/60 bg-[#22c55e]/5";
    if (avg >= 8)  return "border-[#22c55e]/40 bg-[#22c55e]/5";
    if (avg > 0)   return "border-[#22c55e]/20 bg-[#22c55e]/5";
    return "border-[#ef4444]/30 bg-[#ef4444]/5";
  }

  if (heatmap.length === 0) return null;

  return (
    <div className="mt-6 mb-10">
      <h3 className="text-sm font-black text-white/60 mb-3 flex items-center gap-2 uppercase tracking-widest">
        Sector Profitability Heatmap
      </h3>

      {/* Desktop layout: Single row, smaller items */}
      <div className="hidden md:flex flex-row gap-2 w-full">
        {heatmap.map((s) => (
          <CardWrapper
            key={s.name}
            href={linkHref}
            className={`flex-1 glass-card p-2 border rounded-lg flex flex-col gap-1 transition-all ${linkHref ? "hover:border-[#3b82f6]/50 hover:bg-[#1a2030] group" : ""} min-w-0 ${heatColor(s.avgReturn)}`}
          >
            <p className="text-[9px] font-black text-white/90 uppercase tracking-tight truncate" title={s.name}>
              {s.name}
            </p>
            <div className="flex items-center justify-between gap-1 mt-0.5">
              <span className={`text-xs font-black font-mono leading-none ${s.avgReturn >= 0 ? "text-[#22c55e]" : "text-[#ef4444]"}`}>
                {s.avgReturn >= 0 ? "+" : ""}{s.avgReturn.toFixed(1)}%
              </span>
              <span className="text-[9px] font-black text-white/60 bg-white/5 px-1 rounded">
                {s.total}
              </span>
            </div>
          </CardWrapper>
        ))}
      </div>

      {/* Mobile layout: Marquee running ticker */}
      <div className="md:hidden relative w-full overflow-hidden py-2 border-t border-b border-white/5 bg-[#000036]/40">
        <div className="flex gap-4 animate-marquee-left min-w-max">
          {heatmap.concat(heatmap).map((s, idx) => (
            <CardWrapper
              key={`${s.name}-${idx}`}
              href={linkHref}
              className={`inline-flex items-center gap-2 px-3 py-1 border rounded-full text-[10px] font-bold text-slate-300 ${linkHref ? "hover:text-white" : ""} ${heatColor(s.avgReturn)}`}
            >
              <span className="uppercase tracking-tight whitespace-nowrap">{s.name}</span>
              <span className={`font-mono font-black ${s.avgReturn >= 0 ? "text-[#22c55e]" : "text-[#ef4444]"}`}>
                {s.avgReturn >= 0 ? "+" : ""}{s.avgReturn.toFixed(1)}%
              </span>
              <span className="bg-white/10 px-1.5 py-0.2 rounded-full text-[8px]">{s.total}</span>
            </CardWrapper>
          ))}
        </div>
      </div>
    </div>
  );
}
