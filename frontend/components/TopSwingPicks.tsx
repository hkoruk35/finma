"use client";

import Link from "next/link";
import { formatPrice } from "@/lib/data";
import TickerHoverChart from "./TickerHoverChart";
import { LANG_CONFIG } from "@/lib/analysis-langs";
import { useEffect, useState } from "react";
import MiniChart from "./stock/MiniChart";
import { supabase } from "@/lib/supabase";
import { User } from "@supabase/supabase-js";
import AddToTrackerButton from "@/components/AddToTrackerButton";

interface SwingPick {
  rank: number;
  ticker: string;
  company: string;
  score: number;
  current_price: number;
  buy_zone: { low: number; high: number };
  profit_zone: { low: number; high: number };
  stop_zone: { low: number; high: number };
  rvol: number;
  adx: number;
  rsi: number;
  pattern: string;
  market_regime: string;
  holding_period: string;
  reasoning: string;
  ai_summary?: {
    homepage_summary?: Record<string, string>;
    detail_summary?: Record<string, string>;
  };
  change_1d?: number;
  change_1w?: number;
  change_1m?: number;
  change_1y?: number;
}

interface Props {
  picks: SwingPick[];
  allTickers?: any[];
  minimal?: boolean;
}

const TR_TO_EN: Record<string, string> = {
  "Makro Bullish": "Macro Bullish",
  "Yükseliş": "Uptrend",
  "EMA200 Üstü": "Above EMA200",
  "EMA50 Üstü": "Above EMA50",
};

function sanitizeEn(text: string): string {
  return Object.entries(TR_TO_EN).reduce(
    (t, [tr, en]) => t.replaceAll(tr, en),
    text
  );
}


export default function TopSwingPicks({ picks, allTickers = [], minimal = false }: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [quoteData, setQuoteData] = useState<Record<string, { change_1d: number | null; change_1w: number | null; change_1m: number | null; change_1y: number | null }>>({});

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Tickers için change verisi eksikse Yahoo Finance'dan çek
  useEffect(() => {
    if (!picks || picks.length === 0) return;
    const missing = picks
      .slice(0, 5)
      .filter((p) => {
        const live = allTickers?.find((t: any) => t.ticker === p.ticker);
        return !live && p.change_1d === undefined;
      })
      .map((p) => p.ticker);
    if (missing.length === 0) return;
    fetch(`/api/quote?tickers=${missing.join(",")}`)
      .then((r) => r.ok ? r.json() : {})
      .then((data) => setQuoteData(data))
      .catch(() => {});
  }, [picks, allTickers]);

  if (!picks || picks.length === 0) return null;

  return (
    <div className={minimal ? "py-0" : "py-10"}>
      {!minimal && (
        <div className="flex items-center gap-4 mb-8 flex-wrap">
          <div className="relative">
            <div className="absolute -inset-1 rounded-full blur opacity-60 bg-[#3b82f6]"></div>
            <div className="w-2 h-10 bg-[#3b82f6] rounded-full relative"></div>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-4 flex-wrap">
              <h2 className="text-3xl font-black text-white tracking-tighter uppercase italic">
                Top 5 Swing Picks
              </h2>
              <Link
                href="/admin/trading/swing"
                className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#1e293b] border border-[#3b82f6]/30 rounded-full text-[12px] font-medium text-[#3b82f6] hover:bg-[#3b82f6]/10 hover:border-[#3b82f6]/60 transition-all duration-200 uppercase tracking-wider"
              >
                <span>ALL LIST</span>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </Link>
            </div>
            <p className="text-white text-sm mt-1">
              Algorithmic high-conviction swing setups
            </p>
          </div>
        </div>
      )}


      <div className={`grid grid-cols-1 ${minimal ? 'md:grid-cols-1 lg:grid-cols-5' : 'md:grid-cols-2 lg:grid-cols-5'} gap-6`}>
        {picks.slice(0, 5).map((item, idx) => {
          const liveData = allTickers?.find((t: any) => t.ticker === item.ticker);
          
          // ACCESS LOGIC
          const isLocked = false;
          const isProPick = idx > 0;
          const redirectUrl = isProPick ? "/login?redirect=pro" : "/login";
          
          return (
            <div key={item.ticker} className={`relative flex flex-col ${idx > 0 ? 'border-t border-white/15 pt-8 md:border-t-0 md:pt-0' : ''}`}>
              <Link
                href={isLocked ? redirectUrl : `/stock/${item.ticker}`}
                className={`glass-card ${minimal ? 'p-6' : 'p-8'} transition-[border-color,background-color] duration-300 group relative overflow-hidden border-2 border-[#1e2a3a]/50 flex flex-col h-full ${!isLocked ? 'hover:border-[#3b82f6]/50 hover:bg-[#1a2030]' : ''}`}
              >
                {/* Rank badge */}
                <div className={`absolute top-0 right-0 ${minimal ? 'w-8 h-8 text-[10px]' : 'w-10 h-10 text-sm'} rounded-bl-2xl flex items-center justify-center font-black text-white shadow-2xl bg-gradient-to-br from-[#3b82f6] to-[#1e3a8a] z-20`}>
                  #{idx + 1}
                </div>

                {/* Ticker & Company */}
                <div className={`${minimal ? 'mb-3' : 'mb-4'} min-h-[60px]`}>
                  <div className={`${minimal ? 'text-3xl md:text-xl' : 'text-4xl md:text-2xl'} font-black text-white transition-colors tracking-tighter uppercase ${isLocked ? 'blur-[12px] opacity-40 select-none' : 'group-hover:text-[#3b82f6]'}`}>
                    {isLocked ? 'XXXX' : <TickerHoverChart ticker={item.ticker}>{item.ticker}</TickerHoverChart>}
                  </div>
                  <div className={`text-xs md:text-[10px] font-medium text-[#00d2ff] tracking-wider mt-1 line-clamp-1 ${isLocked ? 'blur-[6px] opacity-30 select-none' : ''}`}>
                    {isLocked 
                      ? (isProPick ? 'PRO ONLY' : 'LOGIN')
                      : item.company}
                  </div>
                </div>

                {/* Mini Chart Tool */}
                {!isLocked && (
                  <div className="mb-4 rounded-lg overflow-hidden bg-black/20 border border-white/5 h-[160px] md:h-[180px]">
                    <MiniChart symbol={item.ticker} />
                  </div>
                )}

                {/* Score (Only in detailed mode) */}
                {!minimal && (
                  <div className={`flex flex-col gap-2 mb-6 transition-all duration-500 ${isLocked ? 'blur-[15px] opacity-30 select-none grayscale' : ''}`}>
                    <div className="flex items-end gap-2">
                      <div className="text-5xl md:text-4xl font-mono font-black text-white leading-none">
                        {item.score != null ? item.score.toFixed(1) : "—"}
                      </div>
                      <div className="text-[10px] md:text-[9px] text-[#3b82f6] font-black uppercase tracking-[0.15em] mb-1">
                        SCORE
                      </div>
                    </div>
                  </div>
                )}

                {/* AI Summary Box — always English */}
                <div className={`bg-[#1e293b]/30 rounded-lg ${minimal ? 'p-3' : 'p-4'} border border-[#3b82f6]/10 mb-6`}>
                  <p className={`text-sm md:text-[11px] text-white leading-relaxed font-medium`}>
                    {(() => {
                      const raw = item.ai_summary?.homepage_summary?.en || item.reasoning;
                      const enText = sanitizeEn(raw);
                      const limit = minimal ? 100 : 120;
                      return enText.length > limit ? enText.substring(0, limit - 3) + "..." : enText;
                    })()}
                  </p>
                </div>

                {/* Visual Buy/Sell/SL points - Only in detailed mode, not on homepage */}
                <div className={`mt-auto hidden md:block ${minimal ? 'space-y-1' : 'bg-black/40 rounded-lg border border-white/5 shadow-inner overflow-hidden'}`}>
                  {!minimal && (
                    [
                      { label: "BUY ZONE",    dot: "bg-[#3b82f6]", val: `$${formatPrice(item.buy_zone.low)} – $${formatPrice(item.buy_zone.high)}`,    color: "text-white" },
                      { label: "PROFIT ZONE", dot: "bg-[#10b981]", val: `$${formatPrice(item.profit_zone.low)} – $${formatPrice(item.profit_zone.high)}`, color: "text-[#10b981]" },
                      { label: "STOP LOSS",   dot: "bg-[#ef4444]", val: `$${formatPrice(item.stop_zone.low)} – $${formatPrice(item.stop_zone.high)}`,    color: "text-[#ef4444]" },
                      { label: "HOLDING",     dot: "bg-[#a855f7]", val: item.holding_period,                                                               color: "text-[#f3e8ff]" },
                    ].map((row, i, arr) => (
                      <div key={row.label} className={`flex items-center justify-between px-3 py-2 ${i < arr.length - 1 ? 'border-b border-white/5' : ''}`}>
                        <div className="flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${row.dot}`} />
                          <span className="text-[9px] text-white font-black uppercase tracking-wider">{row.label}</span>
                        </div>
                        <span className={`text-[12px] font-mono font-medium ${row.color}`}>
                          {row.val}
                        </span>
                      </div>
                    ))
                  )}
                </div>

                {/* Add to Tracker button */}
                {!isLocked && (
                  <div className={`mt-3 ${minimal ? '' : 'mt-4'}`}>
                    <AddToTrackerButton
                      pick={{
                        ticker: item.ticker,
                        company: item.company,
                        sector: (item as any).sector || "Unknown",
                        current_price: item.current_price,
                        buy_zone: item.buy_zone,
                        profit_zone: item.profit_zone,
                        stop_zone: item.stop_zone,
                        holding_period: item.holding_period,
                        score: item.score,
                      }}
                      compact={minimal}
                      mobileFull={true}
                    />
                  </div>
                )}

                {/* Detailed mode: Performance strip */}
                {!minimal && (() => {
                  const q = quoteData[item.ticker];
                  const metrics = [
                    { label: "1D", val: liveData?.change_pct ?? item.change_1d ?? q?.change_1d },
                    { label: "1W", val: liveData?.change_pct_1w ?? item.change_1w ?? q?.change_1w },
                    { label: "1M", val: liveData?.change_pct_1m ?? item.change_1m ?? q?.change_1m },
                    { label: "1Y", val: liveData?.change_pct_1y ?? item.change_1y ?? q?.change_1y }
                  ];
                  return (
                    <div className="mt-4 grid grid-cols-4 divide-x divide-[#1e2a3a] border border-[#1e2a3a] rounded-lg overflow-hidden">
                      {metrics.map((p, i) => (
                        <div key={i} className="flex flex-col items-center py-2 px-1">
                          <span className={`text-[13px] font-mono font-black ${p.val != null && p.val >= 0 ? "text-[#10b981]" : p.val != null ? "text-[#ef4444]" : "text-[#00d2ff]"}`}>
                            {p.val != null ? `${p.val >= 0 ? '+' : ''}${p.val.toFixed(1)}%` : "—"}
                          </span>
                          <span className="text-[8px] text-white font-black mt-0.5 uppercase">{p.label}</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </Link>

              {/* Detailed mode: Language analysis pages */}
              {!minimal && !isLocked && (
                <div className="grid grid-cols-6 gap-1 mt-2.5 w-full">
                  {Object.entries(LANG_CONFIG).map(([l, cfg]) => {
                    const [langPart, countryPart] = cfg.locale.split('_');
                    return (
                      <Link
                        key={l}
                        href={`/${l}/${cfg.slug}/${item.ticker.toLowerCase()}`}
                        className="flex flex-col items-center justify-center py-2 rounded-lg border border-[#1e2a3a] bg-[#0d1117] hover:bg-[#141924] hover:border-[#3b82f6]/40 transition-all group/lang shadow-sm"
                      >
                        <span className="text-[7px] font-black text-white group-hover/lang:text-[#3b82f6] transition-colors leading-none mb-0.5 uppercase tracking-tighter">
                          {countryPart}
                        </span>
                        <span className="text-[12px] font-black text-[#00d2ff] group-hover/lang:text-white transition-colors leading-none tracking-tight">
                          {langPart.toUpperCase()}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
