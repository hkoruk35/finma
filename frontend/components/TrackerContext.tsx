"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

interface TrackerState {
  tickers: string[];
  notes: Record<string, string>;
  types: Record<string, string>; // Swing/Long/Option/CSP/CC
}

interface TrackerCtx {
  tickers: string[];
  notes: Record<string, string>;
  types: Record<string, string>;
  addToTracker: (ticker: string, type?: string) => void;
  removeFromTracker: (ticker: string) => void;
  isInTracker: (ticker: string) => boolean;
  updateNote: (ticker: string, note: string) => void;
  updateType: (ticker: string, type: string) => void;
}

const TrackerContext = createContext<TrackerCtx | null>(null);

export function useTracker(): TrackerCtx {
  const ctx = useContext(TrackerContext);
  if (!ctx) throw new Error("useTracker must be used within TrackerProvider");
  return ctx;
}

const STORAGE_KEY = "boga_tracker_v1";

function loadTrackerState(): TrackerState {
  if (typeof window === "undefined") {
    return { tickers: [], notes: {}, types: {} };
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return { tickers: [], notes: {}, types: {} };
    return JSON.parse(stored);
  } catch {
    return { tickers: [], notes: {}, types: {} };
  }
}

function saveTrackerState(state: TrackerState) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error("Failed to save tracker state:", e);
  }
}

export function TrackerProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<TrackerState>(() => loadTrackerState());
  const initialized = useRef(false);

  // Hydrate from localStorage once on mount
  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      setState(loadTrackerState());
    }
  }, []);

  // Persist whenever state changes
  useEffect(() => {
    if (initialized.current) {
      saveTrackerState(state);
    }
  }, [state]);

  const addToTracker = useCallback((ticker: string, type = "Swing") => {
    setState((prev) => {
      if (prev.tickers.includes(ticker)) return prev;
      return {
        ...prev,
        tickers: [...prev.tickers, ticker],
        types: { ...prev.types, [ticker]: type },
      };
    });
  }, []);

  const removeFromTracker = useCallback((ticker: string) => {
    setState((prev) => {
      const newTickers = prev.tickers.filter((t) => t !== ticker);
      const { [ticker]: _, ...newNotes } = prev.notes;
      const { [ticker]: __, ...newTypes } = prev.types;
      return {
        tickers: newTickers,
        notes: newNotes,
        types: newTypes,
      };
    });
  }, []);

  const isInTracker = useCallback(
    (ticker: string) => state.tickers.includes(ticker),
    [state.tickers]
  );

  const updateNote = useCallback((ticker: string, note: string) => {
    setState((prev) => ({
      ...prev,
      notes: { ...prev.notes, [ticker]: note },
    }));
  }, []);

  const updateType = useCallback((ticker: string, type: string) => {
    setState((prev) => ({
      ...prev,
      types: { ...prev.types, [ticker]: type },
    }));
  }, []);

  const value: TrackerCtx = {
    tickers: state.tickers,
    notes: state.notes,
    types: state.types,
    addToTracker,
    removeFromTracker,
    isInTracker,
    updateNote,
    updateType,
  };

  return (
    <TrackerContext.Provider value={value}>{children}</TrackerContext.Provider>
  );
}
