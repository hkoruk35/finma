"use client";

import { useTracker } from "@/components/TrackerContext";
import { useState } from "react";

interface AddToWatchlistButtonProps {
  ticker: string;
  compact?: boolean;
  mobileFull?: boolean;
}

export function AddToWatchlistButton({ ticker, compact = false, mobileFull = false }: AddToWatchlistButtonProps) {
  const { isInTracker, addToTracker, removeFromTracker } = useTracker();
  const [showModal, setShowModal] = useState(false);
  const [type, setType] = useState("Swing");

  const inTracker = isInTracker(ticker);

  const handleAdd = () => {
    addToTracker(ticker, type);
    setShowModal(false);
  };

  const buttonClass = `${
    inTracker
      ? "bg-green-700 hover:bg-green-600"
      : "bg-blue-700 hover:bg-blue-600"
  } text-white font-medium rounded transition ${
    compact ? "px-2 py-1 text-xs" : "px-3 py-2 text-sm"
  } ${mobileFull ? "w-full md:w-auto" : ""}`;

  return (
    <>
      {inTracker ? (
        <div className="flex gap-2 items-center">
          <span className="text-green-400 text-sm font-semibold flex items-center gap-1">
            ✓ Takip ediliyor
          </span>
          <button
            onClick={() => removeFromTracker(ticker)}
            className={`${buttonClass} bg-red-700 hover:bg-red-600`}
          >
            Kaldır
          </button>
        </div>
      ) : (
        <button onClick={() => setShowModal(true)} className={buttonClass}>
          Tracker'a Ekle
        </button>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 max-w-sm w-full">
            <h3 className="text-xl font-bold text-white mb-4">
              {ticker} - Tracker'a Ekle
            </h3>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-slate-300 mb-3">
                Hisse Tipi
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded focus:outline-none focus:border-blue-500"
              >
                <option value="Swing">Swing</option>
                <option value="Long">Long</option>
                <option value="Option">Option (Long Call)</option>
                <option value="CSP">CSP (Cash Secured Put)</option>
                <option value="CC">CC (Covered Call)</option>
              </select>
              <p className="text-xs text-slate-400 mt-2">
                {type === "Swing"
                  ? "Kısa vadeli swing trade - 5-15 gün"
                  : type === "Long"
                  ? "Orta-uzun vadeli position - 30+ gün"
                  : type === "Option"
                  ? "Long call stratejisi - 21-45 DTE"
                  : type === "CSP"
                  ? "Cash secured put - 7-21 DTE"
                  : "Covered call - 7-14 DTE"}
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleAdd}
                className="flex-1 px-4 py-2 bg-green-700 hover:bg-green-600 text-white font-semibold rounded transition"
              >
                Ekle
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded transition"
              >
                İptal
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
