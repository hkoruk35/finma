"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Props {
  slug: "525" | "2550" | "50250";
}

const CONFIG = {
  "525": {
    label: "525 CSP",
    range: "$5 – $25",
    storageKey: "terminal_watchlist_525csp",
    color: "text-[#10b981]",
    border: "border-[#10b981]/30",
    bg: "bg-[#10b981]/5",
    badgeBg: "bg-[#10b981]/15",
    description: "Düşük fiyatlı hisseler için Cash Secured Put stratejisi. Haftalık / aylık prim toplama için idealdir.",
  },
  "2550": {
    label: "2550 CSP",
    range: "$25 – $50",
    storageKey: "terminal_watchlist_2550csp",
    color: "text-[#3b82f6]",
    border: "border-[#3b82f6]/30",
    bg: "bg-[#3b82f6]/5",
    badgeBg: "bg-[#3b82f6]/15",
    description: "Orta fiyatlı CSP adayları. Dengeli prim ve marjin gereksinimleri.",
  },
  "50250": {
    label: "50250 CSP",
    range: "$50 – $250",
    storageKey: "terminal_watchlist_50250csp",
    color: "text-[#a78bfa]",
    border: "border-[#a78bfa]/30",
    bg: "bg-[#a78bfa]/5",
    badgeBg: "bg-[#a78bfa]/15",
    description: "Yüksek fiyatlı hisseler için premium CSP stratejisi. Daha büyük sermaye gerektirir.",
  },
};

export default function CSPDetailClient({ slug }: Props) {
  const cfg = CONFIG[slug];
  const [tickers, setTickers] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const raw = localStorage.getItem(cfg.storageKey);
      setTickers(raw ? JSON.parse(raw) : []);
    } catch {
      setTickers([]);
    }
  }, [cfg.storageKey]);

  if (!mounted) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <div className="text-slate-600 font-mono text-sm animate-pulse">loading watchlist...</div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-xs text-slate-500 font-mono mb-4">
          <Link href="/theme" className="hover:text-white transition-colors">THEMES</Link>
          <span>/</span>
          <span className={cfg.color}>CSP</span>
          <span>/</span>
          <span className="text-white">{cfg.label}</span>
        </div>

        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className={`text-3xl font-black uppercase tracking-tighter ${cfg.color} mb-1`}>
              {cfg.label}
            </h1>
            <div className="text-slate-400 font-mono text-sm mb-2">{cfg.range} price range</div>
            <p className="text-slate-500 text-sm max-w-xl">{cfg.description}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-xs font-black font-mono border ${cfg.border} ${cfg.color}`}>
              {tickers.length} hisse
            </span>
            <Link
              href="/terminal"
              className={`px-4 py-2 rounded-lg border ${cfg.border} ${cfg.color} text-xs font-bold hover:bg-white/5 transition-all`}
            >
              Terminal'de Düzenle →
            </Link>
          </div>
        </div>
      </div>

      {tickers.length === 0 ? (
        <div className="border border-dashed border-white/10 rounded-xl p-16 text-center">
          <div className={`text-4xl font-black ${cfg.color} opacity-20 mb-4`}>∅</div>
          <p className="text-slate-500 text-sm mb-4">Bu listede henüz hisse yok.</p>
          <Link
            href="/terminal"
            className={`inline-block px-5 py-2.5 border ${cfg.border} ${cfg.color} text-xs font-bold rounded-lg hover:bg-white/5 transition-all`}
          >
            Terminal'e git ve {cfg.label} sekmesinden ekle →
          </Link>
        </div>
      ) : (
        <>
          {/* Ticker Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 mb-8">
            {tickers.map((ticker, idx) => (
              <div
                key={ticker}
                className={`${cfg.bg} border ${cfg.border} rounded-xl p-4 group hover:border-white/30 transition-all`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-slate-600 font-mono text-[10px]">#{idx + 1}</span>
                  <span className={`text-[10px] font-black font-mono ${cfg.color}`}>CSP</span>
                </div>
                <div className="text-white font-black text-lg font-mono tracking-tight mb-3 group-hover:text-white transition-colors">
                  {ticker}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Link
                    href={`/stock/${ticker}`}
                    className="block w-full text-center py-1 text-[10px] font-bold text-slate-400 border border-white/10 rounded hover:bg-white/10 hover:text-white transition-all"
                  >
                    Analiz
                  </Link>
                  <Link
                    href={`/optanaliz?symbol=${ticker}`}
                    className={`block w-full text-center py-1 text-[10px] font-bold border ${cfg.border} ${cfg.color} rounded hover:bg-white/5 transition-all`}
                  >
                    OptAnaliz
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* Quick Actions */}
          <div className={`${cfg.bg} border ${cfg.border} rounded-xl p-5`}>
            <div className={`text-[11px] font-black uppercase tracking-widest ${cfg.color} mb-3`}>
              Hızlı Erişim
            </div>
            <div className="flex flex-wrap gap-2">
              {tickers.map((ticker) => (
                <Link
                  key={ticker}
                  href={`/optanaliz?symbol=${ticker}`}
                  className={`px-2.5 py-1 text-[11px] font-bold font-mono border ${cfg.border} ${cfg.color} rounded hover:bg-white/10 transition-all`}
                >
                  {ticker}
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
