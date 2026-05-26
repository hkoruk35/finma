"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface CSPList {
  key: string;
  label: string;
  range: string;
  description: string;
  color: string;
  borderColor: string;
  textColor: string;
  href: string;
}

const CSP_LISTS: CSPList[] = [
  {
    key: "terminal_watchlist_525csp",
    label: "525 CSP",
    range: "$5 – $25",
    description: "Cash Secured Put candidates. Low-priced stocks ideal for weekly/monthly CSP premium collection.",
    color: "bg-[#10b981]/5",
    borderColor: "border-[#10b981]/30",
    textColor: "text-[#10b981]",
    href: "/csp/525",
  },
  {
    key: "terminal_watchlist_2550csp",
    label: "2550 CSP",
    range: "$25 – $50",
    description: "Mid-priced CSP candidates with balanced premium and margin requirements.",
    color: "bg-[#3b82f6]/5",
    borderColor: "border-[#3b82f6]/30",
    textColor: "text-[#3b82f6]",
    href: "/csp/2550",
  },
  {
    key: "terminal_watchlist_50250csp",
    label: "50250 CSP",
    range: "$50 – $250",
    description: "Higher-priced stocks for premium CSP strategies with larger capital allocation.",
    color: "bg-[#a78bfa]/5",
    borderColor: "border-[#a78bfa]/30",
    textColor: "text-[#a78bfa]",
    href: "/csp/50250",
  },
];

export default function CSPWatchlistSection() {
  const [lists, setLists] = useState<Record<string, string[]>>({});
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const loaded: Record<string, string[]> = {};
    for (const csp of CSP_LISTS) {
      try {
        const raw = localStorage.getItem(csp.key);
        loaded[csp.key] = raw ? JSON.parse(raw) : [];
      } catch {
        loaded[csp.key] = [];
      }
    }
    setLists(loaded);
  }, []);

  if (!mounted) return null;

  const hasAny = CSP_LISTS.some((c) => (lists[c.key]?.length ?? 0) > 0);

  return (
    <div className="mb-12">
      <div className="flex items-center gap-3 mb-4 border-b border-white/10 pb-3">
        <h2 className="text-xs font-black text-[#10b981] uppercase tracking-[0.2em]">
          CSP STRATEGY WATCHLISTS
        </h2>
        <span className="text-[10px] text-slate-500 uppercase tracking-wider">Cash Secured Put — Price Tiers</span>
        <Link
          href="/terminal"
          className="ml-auto text-[10px] text-[#3b82f6] hover:text-white border border-[#3b82f6]/30 px-2 py-1 rounded transition-all hover:bg-[#3b82f6]/10"
        >
          Manage in Terminal →
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {CSP_LISTS.map((csp) => {
          const tickers = lists[csp.key] ?? [];
          return (
            <div
              key={csp.key}
              className={`${csp.color} border ${csp.borderColor} rounded-xl p-5`}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className={`text-sm font-black ${csp.textColor} uppercase tracking-wider`}>
                    {csp.label}
                  </h3>
                  <div className="text-[11px] text-slate-400 font-mono mt-0.5">{csp.range}</div>
                </div>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${csp.borderColor} ${csp.textColor}`}>
                  {tickers.length} hisse
                </span>
              </div>

              <p className="text-[11px] text-slate-500 mb-4 leading-relaxed">{csp.description}</p>

              {/* Ticker list */}
              {tickers.length === 0 ? (
                <div className="text-center py-6 border border-dashed border-white/10 rounded-lg">
                  <p className="text-slate-600 text-[11px]">Terminal'den hisse ekleyin</p>
                  <Link
                    href="/terminal"
                    className={`inline-block mt-2 text-[10px] font-bold ${csp.textColor} hover:underline`}
                  >
                    Terminal'e git →
                  </Link>
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {tickers.map((ticker) => (
                    <Link
                      key={ticker}
                      href={`/stock/${ticker}`}
                      className={`px-2 py-0.5 text-[11px] font-bold rounded border ${csp.borderColor} ${csp.textColor} hover:bg-white/10 transition-all font-mono`}
                    >
                      {ticker}
                    </Link>
                  ))}
                </div>
              )}

              <div className="mt-4 pt-3 border-t border-white/5 flex gap-2">
                <Link
                  href={csp.href}
                  className={`flex-1 text-center py-1.5 text-[10px] font-black uppercase tracking-wider border ${csp.borderColor} ${csp.textColor} rounded-lg hover:bg-white/5 transition-all`}
                >
                  Listeyi Gör →
                </Link>
                <Link
                  href="/terminal"
                  className="px-3 py-1.5 text-[10px] text-slate-500 border border-white/5 rounded-lg hover:text-white hover:bg-white/5 transition-all"
                >
                  Düzenle
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {!hasAny && (
        <div className="mt-3 text-center text-[11px] text-slate-600">
          Terminal sayfasında 525CSP, 2550CSP ve 50250CSP sekmelerinden hisse ekleyebilirsiniz.
        </div>
      )}
    </div>
  );
}
