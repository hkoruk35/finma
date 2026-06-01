"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  TrackerStore,
  SmartTracker,
  TrackerPosition,
  SizeUnit,
  addPosition,
  closePosition,
  computeTrackerStats,
  createTracker,
  loadTrackerStore,
  loadTrackerStoreRemote,
  openPosition,
  removePosition,
  saveTrackerStore,
  updatePositionSize,
  TrackerStats,
} from "@/lib/smartTracker";

// ── Context shape ─────────────────────────────────────────────────────────────

interface SmartTrackerCtx {
  store: TrackerStore;
  activeTracker: SmartTracker | null;
  stats: TrackerStats | null;

  // Tracker lifecycle
  openTracker: (name?: string, budget?: number) => void;
  closeTracker: () => void; // archives active tracker

  // Position management
  addToTracker: (pick: any, sizeUnit?: SizeUnit, sizeValue?: number) => void;
  openTrade: (positionId: string, entryPrice: number) => void;
  closeTrade: (positionId: string, closePrice: number) => void;
  removeFromTracker: (positionId: string) => void;
  updateSize: (positionId: string, unit: SizeUnit, value: number) => void;

  // Helpers
  isInTracker: (ticker: string) => boolean;
  refreshPrices: (overrides?: Record<string, number>) => Promise<void>;
  loading: boolean;
}

// ── Context ───────────────────────────────────────────────────────────────────

const SmartTrackerContext = createContext<SmartTrackerCtx | null>(null);

export function useSmartTracker(): SmartTrackerCtx {
  const ctx = useContext(SmartTrackerContext);
  if (!ctx) throw new Error("useSmartTracker must be used within SmartTrackerProvider");
  return ctx;
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function SmartTrackerProvider({ children }: { children: React.ReactNode }) {
  const [store, setStore] = useState<TrackerStore>(() => loadTrackerStore());
  const [loading, setLoading] = useState(false);
  const initialized = useRef(false);

  // Hydrate: localStorage anlık → API taze
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    setStore(loadTrackerStore()); // anlık
    loadTrackerStoreRemote().then(setStore).catch(() => {}); // taze
  }, []);

  // Persist whenever store changes
  useEffect(() => {
    if (initialized.current) {
      saveTrackerStore(store);
    }
  }, [store]);

  const activeTracker = store.activeTracker;

  const stats = useMemo(
    () => (activeTracker ? computeTrackerStats(activeTracker) : null),
    [activeTracker]
  );

  // ── Tracker lifecycle ────────────────────────────────────────────────────────

  const openTracker = useCallback((name = "Smart Tracker", budget = 10000) => {
    setStore((prev) => {
      if (prev.activeTracker) return prev; // only 1 active tracker
      const tracker = createTracker(name, budget);
      return { ...prev, activeTracker: tracker };
    });
  }, []);

  const closeTracker = useCallback(() => {
    setStore((prev) => {
      if (!prev.activeTracker) return prev;
      return {
        ...prev,
        activeTracker: null,
        archivedTrackers: [prev.activeTracker, ...prev.archivedTrackers],
      };
    });
  }, []);

  // ── Position management ─────────────────────────────────────────────────────

  const addToTracker = useCallback(
    (pick: any, sizeUnit: SizeUnit = "usd", sizeValue = 1000) => {
      setStore((prev) => {
        let tracker = prev.activeTracker;
        if (!tracker) {
          tracker = createTracker();
        }
        const updated = addPosition(tracker, pick, sizeUnit, sizeValue);
        return { ...prev, activeTracker: updated };
      });
    },
    []
  );

  const openTrade = useCallback((positionId: string, entryPrice: number) => {
    setStore((prev) => {
      if (!prev.activeTracker) return prev;
      return {
        ...prev,
        activeTracker: openPosition(prev.activeTracker, positionId, entryPrice),
      };
    });
  }, []);

  const closeTrade = useCallback((positionId: string, closePrice: number) => {
    setStore((prev) => {
      if (!prev.activeTracker) return prev;
      return {
        ...prev,
        activeTracker: closePosition(prev.activeTracker, positionId, closePrice),
      };
    });
  }, []);

  const removeFromTracker = useCallback((positionId: string) => {
    setStore((prev) => {
      if (!prev.activeTracker) return prev;
      return {
        ...prev,
        activeTracker: removePosition(prev.activeTracker, positionId),
      };
    });
  }, []);

  const updateSize = useCallback(
    (positionId: string, unit: SizeUnit, value: number) => {
      setStore((prev) => {
        if (!prev.activeTracker) return prev;
        return {
          ...prev,
          activeTracker: updatePositionSize(prev.activeTracker, positionId, unit, value),
        };
      });
    },
    []
  );

  const isInTracker = useCallback(
    (ticker: string) =>
      !!activeTracker?.positions.find(
        (p) => p.ticker === ticker && p.status !== "closed"
      ),
    [activeTracker]
  );

  // ── Live price refresh ──────────────────────────────────────────────────────

  const refreshPrices = useCallback(async (overrides?: Record<string, number>) => {
    if (!activeTracker) return;
    
    // We want to refresh both OPEN and PENDING positions to see live status
    const tickersToRefresh = activeTracker.positions
      .filter((p) => p.status === "open" || p.status === "pending")
      .map((p) => p.ticker);
      
    if (tickersToRefresh.length === 0 && !overrides) return;

    let data: Record<string, { price?: number; change_1d?: number }> = {};
    
    if (overrides) {
      // Use provided prices (e.g. from intraday signals)
      Object.entries(overrides).forEach(([ticker, price]) => {
        data[ticker] = { price };
      });
    } else {
      setLoading(true);
      try {
        const res = await fetch(`/api/quote?tickers=${tickersToRefresh.join(",")}`);
        if (res.ok) {
          data = await res.json();
        }
      } catch (err) {
        console.error("Failed to fetch prices:", err);
      } finally {
        setLoading(false);
      }
    }

    if (Object.keys(data).length === 0) return;

    setStore((prev) => {
      if (!prev.activeTracker) return prev;
      const today = new Date().toISOString().split("T")[0];
      const updatedPositions: TrackerPosition[] = prev.activeTracker.positions.map(
        (p) => {
          // Only update if it's not closed
          if (p.status === "closed") return p;
          
          const q = data[p.ticker];
          if (!q?.price) return p;
          
          const newPrice = q.price;
          const entry = p.entryPrice ?? p.signalPrice;
          
          // Calculate PnL if it's an open position
          let pnlUsd = p.unrealizedPnlUsd;
          let pnlPct = p.unrealizedPnlPct;
          let history = p.dailyPnlHistory ?? [];

          if (p.status === "open") {
            const shares = p.sizeUnit === "usd" ? p.sizeValue / entry : p.sizeValue;
            pnlUsd = (newPrice - entry) * shares;
            pnlPct = entry > 0 ? ((newPrice - entry) / entry) * 100 : 0;

            // Append daily snapshot
            const lastEntry = history[history.length - 1];
            history = lastEntry?.date === today
                ? history.slice(0, -1).concat({ date: today, pnl: pnlUsd, price: newPrice })
                : [...history, { date: today, pnl: pnlUsd, price: newPrice }];
          }

          return {
            ...p,
            currentPrice: newPrice,
            unrealizedPnlUsd: pnlUsd,
            unrealizedPnlPct: pnlPct,
            dailyPnlHistory: history.slice(-90), // keep 90 days max
          };
        }
      );
      return {
        ...prev,
        activeTracker: { ...prev.activeTracker, positions: updatedPositions, updatedAt: new Date().toISOString() },
      };
    });
  }, [activeTracker]);

  const value: SmartTrackerCtx = {
    store,
    activeTracker,
    stats,
    openTracker,
    closeTracker,
    addToTracker,
    openTrade,
    closeTrade,
    removeFromTracker,
    updateSize,
    isInTracker,
    refreshPrices,
    loading,
  };

  return (
    <SmartTrackerContext.Provider value={value}>
      {children}
    </SmartTrackerContext.Provider>
  );
}
