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
  types: Record<string, string>;
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

const STORE_KEY = "tracker_v1";
const LS_KEY = "shared_tracker_v1";
const EMPTY: TrackerState = { tickers: [], notes: {}, types: {} };

function saveToAPI(state: TrackerState) {
  fetch(`/api/store/${STORE_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value: state }),
  }).catch(() => {});
}

export function TrackerProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<TrackerState>(EMPTY);
  const initialized = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Mount: localStorage → API sırası
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // 1. localStorage anlık yükle (yeni key → eski key fallback)
    try {
      const raw = localStorage.getItem(LS_KEY) || localStorage.getItem("boga_tracker_v1");
      if (raw) setState(JSON.parse(raw));
    } catch {}

    // 2. API'den taze veri — boşsa eski localStorage'dan migrate
    fetch(`/api/store/${STORE_KEY}`)
      .then((r) => r.json())
      .then(({ value }) => {
        if (value && (value as TrackerState).tickers?.length > 0) {
          setState(value as TrackerState);
          try { localStorage.setItem(LS_KEY, JSON.stringify(value)); } catch {}
        } else {
          // Supabase boş → eski localStorage'dan migrate
          try {
            const old = localStorage.getItem("boga_tracker_v1");
            if (old) {
              const parsed = JSON.parse(old) as TrackerState;
              if (parsed.tickers?.length > 0) {
                setState(parsed);
                saveToAPI(parsed);
              }
            }
          } catch {}
        }
      })
      .catch(() => {});
  }, []);

  // State değişince kaydet (debounced)
  const persistState = useCallback((s: TrackerState) => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch {}
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveToAPI(s), 500);
  }, []);

  const addToTracker = useCallback((ticker: string, type = "Swing") => {
    setState((prev) => {
      if (prev.tickers.includes(ticker)) return prev;
      const next = { ...prev, tickers: [...prev.tickers, ticker], types: { ...prev.types, [ticker]: type } };
      persistState(next);
      return next;
    });
  }, [persistState]);

  const removeFromTracker = useCallback((ticker: string) => {
    setState((prev) => {
      const { [ticker]: _n, ...newNotes } = prev.notes;
      const { [ticker]: _t, ...newTypes } = prev.types;
      const next = { tickers: prev.tickers.filter((t) => t !== ticker), notes: newNotes, types: newTypes };
      persistState(next);
      return next;
    });
  }, [persistState]);

  const isInTracker = useCallback((ticker: string) => state.tickers.includes(ticker), [state.tickers]);

  const updateNote = useCallback((ticker: string, note: string) => {
    setState((prev) => {
      const next = { ...prev, notes: { ...prev.notes, [ticker]: note } };
      persistState(next);
      return next;
    });
  }, [persistState]);

  const updateType = useCallback((ticker: string, type: string) => {
    setState((prev) => {
      const next = { ...prev, types: { ...prev.types, [ticker]: type } };
      persistState(next);
      return next;
    });
  }, [persistState]);

  return (
    <TrackerContext.Provider value={{ tickers: state.tickers, notes: state.notes, types: state.types, addToTracker, removeFromTracker, isInTracker, updateNote, updateType }}>
      {children}
    </TrackerContext.Provider>
  );
}
