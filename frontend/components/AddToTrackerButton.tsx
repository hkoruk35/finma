"use client";

import { useState } from "react";
import { useSmartTracker } from "@/components/SmartTrackerContext";
import { SizeUnit } from "@/lib/smartTracker";

interface AddToTrackerButtonProps {
  pick: {
    ticker: string;
    company: string;
    sector?: string;
    current_price: number;
    buy_zone: { low: number; high: number };
    profit_zone: { low: number; high: number };
    stop_zone: { low: number; high: number };
    holding_period?: string;
    score: number;
  };
  compact?: boolean;
}

export default function AddToTrackerButton({ pick, compact = false, mobileFull = false }: AddToTrackerButtonProps & { mobileFull?: boolean }) {
  const { isInTracker, addToTracker, activeTracker, openTracker } = useSmartTracker();
  const tracked = isInTracker(pick.ticker);
  const [showModal, setShowModal] = useState(false);
  const [sizeUnit, setSizeUnit] = useState<SizeUnit>("usd");
  const [sizeValue, setSizeValue] = useState(1000);

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (tracked) return;
    setShowModal(true);
  }

  function handleConfirm() {
    if (!activeTracker) openTracker();
    addToTracker(
      { ...pick, sector: pick.sector || "Unknown", holding_period: pick.holding_period || "—" },
      sizeUnit,
      sizeValue
    );
    setShowModal(false);
  }

  const btnBase = compact
    ? "inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-200 w-full"
    : "inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all duration-200 w-full";

  return (
    <>
      <button
        id={`add-tracker-${pick.ticker}`}
        onClick={handleClick}
        className={`${btnBase} ${
          tracked
            ? "bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/40 cursor-default"
            : "bg-[#3b82f6]/10 text-[#3b82f6] border border-[#3b82f6]/30 hover:bg-[#3b82f6]/25 hover:border-[#3b82f6]/60 hover:text-white active:scale-95"
        }`}
      >
        {tracked ? (
          <>
            <svg className={compact ? "w-3 h-3" : "w-3.5 h-3.5"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <span>Tracked</span>
          </>
        ) : (
          <>
            <span className="md:hidden">Add Smart Tracker</span>
            <div className="hidden md:flex items-center gap-1.5">
               <svg className={compact ? "w-3 h-3" : "w-3.5 h-3.5"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                 <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-9H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
               </svg>
               <span>Add to Tracker</span>
            </div>
          </>
        )}
      </button>

      {/* Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-[#0d1117] border border-[#1e2a3a] rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl shadow-black/50"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div>
                <div className="text-white font-black text-xl tracking-tighter">{pick.ticker}</div>
                <div className="text-[#00d2ff] text-xs font-bold">{pick.company}</div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 text-white hover:text-white transition-colors rounded-lg hover:bg-white/10"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Price levels (info) */}
            <div className="grid grid-cols-3 gap-2 mb-5 bg-[#141924] rounded-xl p-3">
              <div className="text-center">
                <div className="text-[9px] text-[#3b82f6] font-black uppercase mb-0.5">Buy Zone</div>
                <div className="text-white text-[11px] font-mono font-bold">${pick.buy_zone.low.toFixed(2)}</div>
              </div>
              <div className="text-center">
                <div className="text-[9px] text-[#10b981] font-black uppercase mb-0.5">Target</div>
                <div className="text-[#10b981] text-[11px] font-mono font-bold">${pick.profit_zone.high.toFixed(2)}</div>
              </div>
              <div className="text-center">
                <div className="text-[9px] text-[#ef4444] font-black uppercase mb-0.5">Stop</div>
                <div className="text-[#ef4444] text-[11px] font-mono font-bold">${pick.stop_zone.low.toFixed(2)}</div>
              </div>
            </div>

            {/* Size unit toggle */}
            <div className="mb-3">
              <label className="text-[10px] text-[#00d2ff] font-black uppercase tracking-wider mb-2 block">
                Position Size Type
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(["usd", "lot"] as SizeUnit[]).map((u) => (
                  <button
                    key={u}
                    onClick={() => setSizeUnit(u)}
                    className={`py-2 rounded-lg text-[11px] font-black uppercase tracking-wider border transition-all ${
                      sizeUnit === u
                        ? "bg-[#3b82f6] text-white border-[#3b82f6]"
                        : "bg-transparent text-[#00d2ff] border-[#1e2a3a] hover:border-[#3b82f6]/40"
                    }`}
                  >
                    {u === "usd" ? "💵 USD Amount" : "📦 Shares (Lot)"}
                  </button>
                ))}
              </div>
            </div>

            {/* Size value */}
            <div className="mb-5">
              <label className="text-[10px] text-[#00d2ff] font-black uppercase tracking-wider mb-2 block">
                {sizeUnit === "usd" ? "Amount (USD)" : "Number of Shares"}
              </label>
              <input
                type="number"
                value={sizeValue}
                min={sizeUnit === "usd" ? 100 : 1}
                step={sizeUnit === "usd" ? 100 : 1}
                onChange={(e) => setSizeValue(parseFloat(e.target.value) || 0)}
                className="w-full bg-[#141924] border border-[#1e2a3a] rounded-xl px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-[#3b82f6] transition-colors"
              />
              {sizeUnit === "usd" && pick.current_price > 0 && (
                <div className="text-[10px] text-[#00d2ff] mt-1.5">
                  ≈ {(sizeValue / pick.current_price).toFixed(2)} shares @ ${pick.current_price.toFixed(2)}
                </div>
              )}
            </div>

            {/* Confirm */}
            <button
              onClick={handleConfirm}
              className="w-full py-3 bg-gradient-to-r from-[#3b82f6] to-[#6366f1] text-white font-black text-sm rounded-xl uppercase tracking-widest hover:from-[#2563eb] hover:to-[#5b21b6] transition-all active:scale-[0.98] shadow-lg shadow-blue-500/20"
            >
              🚀 Add to Smart Tracker
            </button>

            <p className="text-center text-[10px] text-[#00d2ff] mt-3">
              Paper trade · No real money involved
            </p>
          </div>
        </div>
      )}
    </>
  );
}
