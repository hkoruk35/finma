"use client";

import Link from "next/link";
import { formatPrice } from "@/lib/data";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { User } from "@supabase/supabase-js";

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
  change_1d?: number;
  change_1w?: number;
  change_1m?: number;
  change_1y?: number;
}

interface Props {
  picks: SwingPick[];
  allTickers?: any[];
}

export default function TopSwingPicks({ picks, allTickers = [] }: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

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

  if (!picks || picks.length === 0) return null;

  return (
    <div className="py-10">
      <div className="flex items-center gap-4 mb-8">
        <div className="relative">
          <div className="absolute -inset-1 rounded-full blur opacity-60 bg-[#3b82f6]"></div>
          <div className="w-2 h-10 bg-[#3b82f6] rounded-full relative"></div>
        </div>
        <div>
          <h2 className="text-3xl font-black text-white tracking-tighter uppercase italic">
            Top 3 Swing Picks
          </h2>
          <p className="text-[#94a3b8] text-sm mt-1">Algorithmic high-conviction swing setups</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {picks.map((item, idx) => {
          const liveData = allTickers?.find((t: any) => t.ticker === item.ticker);
          
          // ACCESS LOGIC
          // Pick 1 (#0): Open for all members
          // Pick 2 & 3 (#1, #2): Open for PRO members only
          const isLocked = false;

          const redirectUrl = isProPick ? "/login?redirect=pro" : "/login";
          
          return (
            <div key={item.ticker} className="relative flex flex-col">
              <Link
                href={isLocked ? redirectUrl : `/stock/${item.ticker}`}
                className={`glass-card p-6 transition-all duration-300 group relative overflow-hidden border-2 border-transparent flex flex-col h-full ${!isLocked ? 'hover:border-[#3b82f6]/50 hover:bg-[#1a2030]' : ''}`}
              >
                {/* Rank badge */}
                <div className={`absolute top-0 right-0 w-14 h-14 rounded-bl-3xl flex items-center justify-center text-lg font-black text-white shadow-2xl bg-gradient-to-br from-[#3b82f6] to-[#1e3a8a] z-20`}>
                  #{idx + 1}
                </div>

                {/* Status Overlay - Shown only if locked */}
                {isLocked && (
                  <div className="absolute top-1/2 left-0 w-full -translate-y-1/2 flex justify-center z-30 pointer-events-none px-4">
                    {idx === 0 ? (
                      <div className="bg-white text-[#0a0e17] text-[11px] font-black px-6 py-2.5 rounded-full uppercase tracking-tighter shadow-[0_0_20px_rgba(255,255,255,0.4)] animate-pulse">
                        Free Member Access Required
                      </div>
                    ) : (
                      <div className="bg-gradient-to-r from-[#3b82f6] to-[#6366f1] text-white text-[13px] font-black px-8 py-3 rounded-full uppercase tracking-widest shadow-[0_0_30px_rgba(59,130,246,0.5)] border border-white/20">
                        PRO REQUIRED
                      </div>
                    )}
                  </div>
                )}

                {/* Ticker & Company */}
                <div className="mb-4 min-h-[70px]">
                  <div className={`text-4xl font-black text-white transition-colors tracking-tighter uppercase ${isLocked ? 'blur-[12px] opacity-40 select-none' : 'group-hover:text-[#3b82f6]'}`}>
                    {isLocked ? 'XXXX' : item.ticker}
                  </div>
                  <div className={`text-sm font-bold text-[#64748b] tracking-wider mt-1 line-clamp-2 ${isLocked ? 'blur-[6px] opacity-30 select-none' : ''}`}>
                    {isLocked 
                      ? (isProPick ? 'PRO MEMBERS ONLY CONTENT' : 'MEMBERSHIP REQUIRED TO VIEW')
                      : item.company}
                  </div>
                </div>

                {/* Score + Pattern */}
                <div className={`flex flex-col gap-3 mb-6 min-h-[140px] transition-all duration-500 ${isLocked ? 'blur-[15px] opacity-30 select-none grayscale' : ''}`}>
                  <div className="flex items-end gap-3">
                    <div className="text-5xl md:text-6xl font-mono font-black text-white leading-none">
                      {item.score.toFixed(1)}
                    </div>
                    <div className="text-[11px] md:text-[12px] text-[#3b82f6] font-black uppercase tracking-[0.2em] mb-2">
                      SWING SCORE
                    </div>
                  </div>
                  {/* Reasoning Box */}
                  <div className="bg-[#1e293b]/50 rounded-xl p-4 border border-[#3b82f6]/20 flex-1">
                    <p className="text-xs md:text-[13px] text-[#d1d5db] leading-relaxed font-medium">
                      {item.reasoning.length > 120 
                        ? item.reasoning.substring(0, 117) + "..." 
                        : item.reasoning}
                    </p>
                  </div>
                </div>

                {/* Zones */}
                <div className={`mb-6 bg-black/40 rounded-xl p-5 border border-white/10 shadow-inner flex-1 transition-all duration-500 ${isLocked ? 'blur-[5px] opacity-20' : ''}`}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-2">
                    <div>
                      <div className="text-[10px] text-[#64748b] font-black uppercase tracking-wider mb-1 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#3b82f6]"></span>
                        BUY ZONE
                      </div>
                      <div className="text-[13px] lg:text-[15px] font-mono font-bold text-white whitespace-nowrap">
                        {formatPrice(item.buy_zone.low)} - {formatPrice(item.buy_zone.high)}
                      </div>
                    </div>
                    
                    <div>
                      <div className="text-[10px] text-[#64748b] font-black uppercase tracking-wider mb-1 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]"></span>
                        PROFIT ZONE
                      </div>
                      <div className="text-[13px] lg:text-[15px] font-mono font-bold text-[#10b981] whitespace-nowrap">
                        {formatPrice(item.profit_zone.low)} - {formatPrice(item.profit_zone.high)}
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] text-[#64748b] font-black uppercase tracking-wider mb-1 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#ef4444]"></span>
                        STOP LOSS
                      </div>
                      <div className="text-[13px] lg:text-[15px] font-mono font-bold text-[#ef4444] whitespace-nowrap">
                        {formatPrice(item.stop_zone.low)} - {formatPrice(item.stop_zone.high)}
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] text-[#64748b] font-black uppercase tracking-wider mb-1 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#a855f7]"></span>
                        HOLDING
                      </div>
                      <div className="text-[13px] lg:text-[15px] font-mono font-bold text-[#f3e8ff] whitespace-nowrap">
                        {item.holding_period}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Metrics */}
                {(() => {
                  const metrics = [
                    { label: "1D", val: liveData?.change_pct ?? item.change_1d },
                    { label: "1W", val: liveData?.change_pct_1w ?? item.change_1w },
                    { label: "1M", val: liveData?.change_pct_1m ?? item.change_1m },
                    { label: "1Y", val: liveData?.change_pct_1y ?? item.change_1y }
                  ];
                  
                  return (
                    <div className="grid grid-cols-4 gap-2 text-center border-t border-white/5 pt-5">
                      {metrics.map((p, i) => (
                        <div key={i}>
                          <div className={`text-[17px] md:text-[19px] font-mono font-black ${p.val !== undefined && p.val >= 0 ? "text-[#10b981]" : p.val !== undefined ? "text-[#ef4444]" : "text-[#64748b]"}`}>
                            {p.val !== undefined ? `${p.val >= 0 ? '+' : ''}${p.val.toFixed(1)}%` : "—"}
                          </div>
                          <div className="text-[11px] text-[#64748b] font-black mt-1.5 uppercase">{p.label}</div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
