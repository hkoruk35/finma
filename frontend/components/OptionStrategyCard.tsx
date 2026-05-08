"use client";

interface OptionStrategyCardProps {
  title: string;
  ticker: string;
  price: number;
  type: "CALL" | "PUT";
  sentiment: "BULLISH" | "BEARISH";
  risk: "LOW" | "MEDIUM" | "HIGH";
  strike: number;
  optionData?: any;
  reason: string;
}

export default function OptionStrategyCard({
  title,
  ticker,
  price,
  type,
  sentiment,
  risk,
  strike,
  optionData,
  reason
}: OptionStrategyCardProps) {
  const isBullish = sentiment === "BULLISH";
  
  return (
    <div className="glass-card p-6 border border-white/5 relative overflow-hidden group">
      {/* Background Glow */}
      <div className={`absolute -right-12 -top-12 w-32 h-32 blur-3xl opacity-10 transition-opacity group-hover:opacity-20 ${isBullish ? 'bg-[#10b981]' : 'bg-[#ef4444]'}`} />
      
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="text-white font-black text-lg uppercase tracking-tight mb-1">{title}</h3>
          <div className="flex items-center gap-2">
            <span className={`text-[9px] font-black px-2 py-0.5 rounded border ${
              isBullish ? 'bg-[#10b981]/20 text-[#10b981] border-[#10b981]/30' : 'bg-[#ef4444]/20 text-[#ef4444] border-[#ef4444]/30'
            }`}>
              {sentiment}
            </span>
            <span className="text-[9px] font-black px-2 py-0.5 rounded bg-white/5 text-white/60 border border-white/10 uppercase tracking-widest">
              RISK: {risk}
            </span>
          </div>
        </div>
        <div className="text-right">
           <div className="text-[10px] text-[#475569] font-black uppercase tracking-widest">Target Strike</div>
           <div className="text-xl font-black text-white font-mono">${strike.toFixed(2)}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="p-3 rounded-xl bg-white/2 border border-white/5">
           <div className="text-[9px] text-[#475569] font-black uppercase tracking-widest mb-1">Contract Type</div>
           <div className={`text-sm font-black ${type === 'CALL' ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>{type}</div>
        </div>
        <div className="p-3 rounded-xl bg-white/2 border border-white/5">
           <div className="text-[9px] text-[#475569] font-black uppercase tracking-widest mb-1">Entry Zone</div>
           <div className="text-sm font-black text-white font-mono">${price.toFixed(2)}</div>
        </div>
      </div>

      <div className="mb-6">
        <h4 className="text-[10px] text-[#475569] font-black uppercase tracking-widest mb-2">Strategy Rationale</h4>
        <p className="text-xs text-white/70 leading-relaxed font-medium italic">
          "{reason}"
        </p>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-white/5">
        <div className="flex flex-col">
           <span className="text-[8px] text-[#475569] font-black uppercase tracking-[0.2em]">Live Volatility</span>
           <span className="text-[11px] font-black text-[#00d2ff]">
             {optionData?.iv_rank != null ? `IV RANK: ${optionData.iv_rank}%` : 'IV DATA PENDING'}
           </span>
        </div>
        <button className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[10px] font-black text-white uppercase tracking-widest transition-all">
          View Chain
        </button>
      </div>
    </div>
  );
}
