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
  CartStore,
  SmartCart,
  CartPosition,
  SizeUnit,
  addPosition,
  closePosition,
  computeCartStats,
  createCart,
  loadCartStore,
  openPosition,
  removePosition,
  saveCartStore,
  updatePositionSize,
  CartStats,
} from "@/lib/smartCart";

// ── Context shape ─────────────────────────────────────────────────────────────

interface SmartCartCtx {
  store: CartStore;
  activeCart: SmartCart | null;
  stats: CartStats | null;

  // Basket lifecycle
  openBasket: (name?: string, budget?: number) => void;
  closeBasket: () => void; // archives active cart

  // Position management
  addToCart: (pick: any, sizeUnit?: SizeUnit, sizeValue?: number) => void;
  openTrade: (positionId: string, entryPrice: number) => void;
  closeTrade: (positionId: string, closePrice: number) => void;
  removeFromCart: (positionId: string) => void;
  updateSize: (positionId: string, unit: SizeUnit, value: number) => void;

  // Helpers
  isInCart: (ticker: string) => boolean;
  refreshPrices: () => Promise<void>;
  loading: boolean;
}

// ── Context ───────────────────────────────────────────────────────────────────

const SmartCartContext = createContext<SmartCartCtx | null>(null);

export function useSmartCart(): SmartCartCtx {
  const ctx = useContext(SmartCartContext);
  if (!ctx) throw new Error("useSmartCart must be used within SmartCartProvider");
  return ctx;
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function SmartCartProvider({ children }: { children: React.ReactNode }) {
  const [store, setStore] = useState<CartStore>(() => loadCartStore());
  const [loading, setLoading] = useState(false);
  const initialized = useRef(false);

  // Hydrate from localStorage once on mount
  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      setStore(loadCartStore());
    }
  }, []);

  // Persist whenever store changes
  useEffect(() => {
    if (initialized.current) {
      saveCartStore(store);
    }
  }, [store]);

  const activeCart = store.activeCart;

  const stats = useMemo(
    () => (activeCart ? computeCartStats(activeCart) : null),
    [activeCart]
  );

  // ── Basket lifecycle ────────────────────────────────────────────────────────

  const openBasket = useCallback((name = "Smart Cart", budget = 10000) => {
    setStore((prev) => {
      if (prev.activeCart) return prev; // only 1 active cart
      const cart = createCart(name, budget);
      return { ...prev, activeCart: cart };
    });
  }, []);

  const closeBasket = useCallback(() => {
    setStore((prev) => {
      if (!prev.activeCart) return prev;
      return {
        ...prev,
        activeCart: null,
        archivedCarts: [prev.activeCart, ...prev.archivedCarts],
      };
    });
  }, []);

  // ── Position management ─────────────────────────────────────────────────────

  const addToCart = useCallback(
    (pick: any, sizeUnit: SizeUnit = "usd", sizeValue = 1000) => {
      setStore((prev) => {
        let cart = prev.activeCart;
        if (!cart) {
          cart = createCart();
        }
        const updated = addPosition(cart, pick, sizeUnit, sizeValue);
        return { ...prev, activeCart: updated };
      });
    },
    []
  );

  const openTrade = useCallback((positionId: string, entryPrice: number) => {
    setStore((prev) => {
      if (!prev.activeCart) return prev;
      return {
        ...prev,
        activeCart: openPosition(prev.activeCart, positionId, entryPrice),
      };
    });
  }, []);

  const closeTrade = useCallback((positionId: string, closePrice: number) => {
    setStore((prev) => {
      if (!prev.activeCart) return prev;
      return {
        ...prev,
        activeCart: closePosition(prev.activeCart, positionId, closePrice),
      };
    });
  }, []);

  const removeFromCart = useCallback((positionId: string) => {
    setStore((prev) => {
      if (!prev.activeCart) return prev;
      return {
        ...prev,
        activeCart: removePosition(prev.activeCart, positionId),
      };
    });
  }, []);

  const updateSize = useCallback(
    (positionId: string, unit: SizeUnit, value: number) => {
      setStore((prev) => {
        if (!prev.activeCart) return prev;
        return {
          ...prev,
          activeCart: updatePositionSize(prev.activeCart, positionId, unit, value),
        };
      });
    },
    []
  );

  const isInCart = useCallback(
    (ticker: string) =>
      !!activeCart?.positions.find(
        (p) => p.ticker === ticker && p.status !== "closed"
      ),
    [activeCart]
  );

  // ── Live price refresh ──────────────────────────────────────────────────────

  const refreshPrices = useCallback(async () => {
    if (!activeCart) return;
    const openTickers = activeCart.positions
      .filter((p) => p.status === "open")
      .map((p) => p.ticker);
    if (openTickers.length === 0) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/quote?tickers=${openTickers.join(",")}`);
      if (!res.ok) return;
      const data: Record<string, { price?: number; change_1d?: number }> =
        await res.json();

      setStore((prev) => {
        if (!prev.activeCart) return prev;
        const today = new Date().toISOString().split("T")[0];
        const updatedPositions: CartPosition[] = prev.activeCart.positions.map(
          (p) => {
            if (p.status !== "open") return p;
            const q = data[p.ticker];
            if (!q?.price) return p;
            const newPrice = q.price;
            const entry = p.entryPrice ?? p.signalPrice;
            const shares =
              p.sizeUnit === "usd" ? p.sizeValue / entry : p.sizeValue;
            const pnlUsd = (newPrice - entry) * shares;
            const pnlPct = entry > 0 ? ((newPrice - entry) / entry) * 100 : 0;

            // Append daily snapshot
            const history = p.dailyPnlHistory ?? [];
            const lastEntry = history[history.length - 1];
            const updated =
              lastEntry?.date === today
                ? history.slice(0, -1).concat({ date: today, pnl: pnlUsd, price: newPrice })
                : [...history, { date: today, pnl: pnlUsd, price: newPrice }];

            return {
              ...p,
              currentPrice: newPrice,
              unrealizedPnlUsd: pnlUsd,
              unrealizedPnlPct: pnlPct,
              dailyPnlHistory: updated.slice(-90), // keep 90 days max
            };
          }
        );
        return {
          ...prev,
          activeCart: { ...prev.activeCart, positions: updatedPositions, updatedAt: new Date().toISOString() },
        };
      });
    } finally {
      setLoading(false);
    }
  }, [activeCart]);

  const value: SmartCartCtx = {
    store,
    activeCart,
    stats,
    openBasket,
    closeBasket,
    addToCart,
    openTrade,
    closeTrade,
    removeFromCart,
    updateSize,
    isInCart,
    refreshPrices,
    loading,
  };

  return (
    <SmartCartContext.Provider value={value}>
      {children}
    </SmartCartContext.Provider>
  );
}
