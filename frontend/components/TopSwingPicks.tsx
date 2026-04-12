"use client";

import Link from "next/link";
import { formatPrice } from "@/lib/data";

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
          // Sync with live data to ensure price/zones are accurate
          const liveData = allTickers?.find((t: any) => t.ticker === item.ticker);
          const realPrice = liveData?.price;
          
          // Calculate price ratio to adjust zones if the pick data is stale/miscalibrated
          // Specifically handles cases like CAR showing $300 zones for a $77 stock
          const priceRatio = (realPrice && item.current_price) 
            ? realPrice / item.current_price 
            : 1.0;

          // Adjusted Zones
          const displayBuyLow = item.buy_zone.low * priceRatio;
          const displayBuyHigh = item.buy_zone.high * priceRatio;
          const displayProfitLow = item.profit_zone.low * priceRatio;
          const displayProfitHigh = item.profit_zone.high * priceRatio;
          const displayStopLow = item.stop_zone.low * priceRatio;
          const displayStopHigh = item.stop_zone.high * priceRatio;

          return (
            <Link
              key={item.ticker}
              href={`/stock/${item.ticker}`}
              className="glass-card p-6 hover:bg-[#1a2030] transition-all duration-300 group relative overflow-hidden border-2 border-transparent hover:border-[#3b82f6]/20"
            >
              {/* Rank badge */}
              <div className={`absolute top-0 right-0 w-14 h-14 rounded-bl-3xl flex items-center justify-center text-lg font-black text-white shadow-2xl bg-gradient-to-br from-[#3b82f6] to-[#1e3a8a]`}>
                #{idx + 1}
              </div>

              {/* Ticker & Company */}
              <div className="mb-4">
                <div className="text-4xl font-black text-white group-hover:text-[#3b82f6] transition-colors tracking-tighter uppercase">
                  {item.ticker}
                </div>
                <div className="text-sm font-bold text-[#64748b] tracking-wider mt-1 line-clamp-1">
                   {item.company}
                </div>
              </div>

              {/* Score + Pattern */}
              <div className="flex flex-col gap-3 mb-6">
                <div className="flex items-end gap-2">
                   <div className="text-5xl font-mono font-black text-white leading-none">
                     {item.score.toFixed(1)}
                   </div>
                   <div className="text-[9px] text-[#3b82f6] font-black uppercase tracking-[0.2em] mb-1">SWING SCORE</div>
                </div>
                <div className="flex">
                  <span className={`px-4 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-wider shadow-xl bg-[#3b82f6]/20 text-[#bfdbfe] border border-[#3b82f6]/40 text-center`}>
                    {item.reasoning.substring(0, 80)}...
                  </span>
                </div>
              </div>

              {/* Zones */}
              <div className="mb-6 bg-black/30 rounded-xl p-4 border border-white/5">
                 <div className="grid grid-cols-2 gap-4 gap-y-6">
                   <div>
                     <div className="text-[10px] text-[#64748b] font-black uppercase tracking-wider mb-1 flex items-center gap-1">
                       <span className="w-1.5 h-1.5 rounded-full bg-[#3b82f6]"></span>
                       BUY ZONE
                     </div>
                     <div className="text-sm font-mono font-bold text-white">
                       {formatPrice(displayBuyLow)} - {formatPrice(displayBuyHigh)}
                     </div>
                   </div>
                   
                   <div>
                     <div className="text-[10px] text-[#64748b] font-black uppercase tracking-wider mb-1 flex items-center gap-1">
                       <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]"></span>
                       PROFIT ZONE
                     </div>
                     <div className="text-sm font-mono font-bold text-[#10b981]">
                       {formatPrice(displayProfitLow)} - {formatPrice(displayProfitHigh)}
                     </div>
                   </div>

                   <div>
                     <div className="text-[10px] text-[#64748b] font-black uppercase tracking-wider mb-1 flex items-center gap-1">
                       <span className="w-1.5 h-1.5 rounded-full bg-[#ef4444]"></span>
                       STOP LOSS
                     </div>
                     <div className="text-sm font-mono font-bold text-[#ef4444]">
                       {formatPrice(displayStopLow)} - {formatPrice(displayStopHigh)}
                     </div>
                   </div>

                   <div>
                     <div className="text-[10px] text-[#64748b] font-black uppercase tracking-wider mb-1 flex items-center gap-1">
                       <span className="w-1.5 h-1.5 rounded-full bg-[#a855f7]"></span>
                       HOLDING
                     </div>
                     <div className="text-sm font-mono font-bold text-[#f3e8ff]">
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
                         <div className={`text-[15px] font-mono font-black ${p.val !== undefined && p.val >= 0 ? "text-[#10b981]" : p.val !== undefined ? "text-[#ef4444]" : "text-[#64748b]"}`}>
                           {p.val !== undefined ? `${p.val >= 0 ? '+' : ''}${p.val.toFixed(1)}%` : "—"}
                         </div>
                         <div className="text-[11px] text-[#64748b] font-black mt-1.5 uppercase">{p.label}</div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
