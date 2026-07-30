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

  const baseClass = "inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-medium uppercase tracking-wider transition-all duration-150 whitespace-nowrap";

  if (inTracker) {
    return (
      <div className="flex items-center gap-1">
        <span className={`${baseClass} bg-[#3b82f6]/15 text-[#3b82f6] border border-[#3b82f6]/30 cursor-default`}>
          <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Active ✓
        </span>
        <button
          onClick={() => removeFromTracker(ticker)}
          className="px-1.5 py-1 text-[#ef4444] border border-[#ef4444]/30 rounded text-[10px] font-medium hover:bg-[#ef4444]/15 transition-all"
          title="Kaldır"
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => addToTracker(ticker, "Swing")}
      className={`${baseClass} bg-transparent text-[#3b82f6] border border-[#3b82f6]/40 hover:bg-[#3b82f6]/15 hover:border-[#3b82f6]/70 active:scale-95`}
    >
      <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
      </svg>
      Active Tracker
    </button>
  );
}
