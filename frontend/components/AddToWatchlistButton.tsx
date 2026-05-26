"use client";

import { useTracker } from "@/components/TrackerContext";

interface AddToWatchlistButtonProps {
  ticker: string;
  compact?: boolean;
  mobileFull?: boolean;
}

export function AddToWatchlistButton({ ticker, compact = false, mobileFull = false }: AddToWatchlistButtonProps) {
  const { isInTracker, addToTracker, removeFromTracker } = useTracker();
  const inTracker = isInTracker(ticker);

  if (inTracker) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-[#10b981] text-[11px] font-bold flex items-center gap-1 whitespace-nowrap">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Takipte
        </span>
        <button
          onClick={() => removeFromTracker(ticker)}
          className="px-2 py-1 bg-red-700/80 hover:bg-red-600 text-white text-[10px] font-bold rounded-md transition-all"
        >
          Kaldır
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => addToTracker(ticker, "Swing")}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#3b82f6] hover:bg-[#2563eb] active:scale-95 text-white text-[11px] font-bold rounded-lg transition-all shadow-[0_0_12px_rgba(59,130,246,0.3)] hover:shadow-[0_0_18px_rgba(59,130,246,0.5)] whitespace-nowrap"
    >
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
      </svg>
      Tracker'a Ekle
    </button>
  );
}
