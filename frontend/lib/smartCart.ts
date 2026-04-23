// Smart Cart — Paper Trade Basket
// 30-day localStorage cache (auth-agnostic until login system is active)

export const CART_STORAGE_KEY = "boga_smart_cart_v1";
export const CART_TTL_DAYS = 30;

export type TradeStatus = "open" | "closed" | "pending";
export type SizeUnit = "usd" | "lot";

export interface CartPosition {
  id: string; // uuid-style: ticker + entryDate
  ticker: string;
  company: string;
  sector: string;
  addedDate: string; // ISO date string (day added to cart)
  entryDate?: string; // ISO date when trade was opened
  closeDate?: string; // ISO date when trade was closed
  status: TradeStatus;

  // Price levels from the signal
  signalPrice: number;
  buyZoneLow: number;
  buyZoneHigh: number;
  profitZoneLow: number;
  profitZoneHigh: number;
  stopZoneLow: number;
  stopZoneHigh: number;
  holdingPeriod: string;
  score: number;

  // User-defined trade sizing
  sizeUnit: SizeUnit;
  sizeValue: number; // USD amount OR number of lots/shares

  // Resolved prices
  entryPrice?: number; // actual fill price
  currentPrice?: number; // live price (fetched)
  closePrice?: number; // price at close

  // PnL (computed)
  unrealizedPnlUsd?: number;
  unrealizedPnlPct?: number;
  realizedPnlUsd?: number;
  realizedPnlPct?: number;

  // Daily snapshot
  dailyPnlHistory?: Array<{ date: string; pnl: number; price: number }>;
}

export interface SmartCart {
  id: string; // single basket id
  name: string;
  createdAt: string;
  updatedAt: string;
  totalBudgetUsd: number;
  positions: CartPosition[];
}

export interface CartStore {
  activeCart: SmartCart | null;
  archivedCarts: SmartCart[]; // closed baskets
  lastFetched: string; // ISO
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function now(): string {
  return new Date().toISOString();
}

function generateId(ticker: string): string {
  return `${ticker}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ── Storage ───────────────────────────────────────────────────────────────────

export function loadCartStore(): CartStore {
  if (typeof window === "undefined") {
    return { activeCart: null, archivedCarts: [], lastFetched: "" };
  }
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return { activeCart: null, archivedCarts: [], lastFetched: "" };
    const data: CartStore = JSON.parse(raw);

    // TTL check — purge data older than 30 days
    if (data.lastFetched) {
      const ageDays =
        (Date.now() - new Date(data.lastFetched).getTime()) /
        (1000 * 60 * 60 * 24);
      if (ageDays > CART_TTL_DAYS) {
        localStorage.removeItem(CART_STORAGE_KEY);
        return { activeCart: null, archivedCarts: [], lastFetched: "" };
      }
    }
    return data;
  } catch {
    return { activeCart: null, archivedCarts: [], lastFetched: "" };
  }
}

export function saveCartStore(store: CartStore): void {
  if (typeof window === "undefined") return;
  store.lastFetched = now();
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(store));
}

// ── Cart Operations ───────────────────────────────────────────────────────────

export function createCart(name = "My Smart Cart", totalBudgetUsd = 10000): SmartCart {
  return {
    id: generateId("cart"),
    name,
    createdAt: now(),
    updatedAt: now(),
    totalBudgetUsd,
    positions: [],
  };
}

export function addPosition(
  cart: SmartCart,
  pick: {
    ticker: string;
    company: string;
    sector: string;
    current_price: number;
    buy_zone: { low: number; high: number };
    profit_zone: { low: number; high: number };
    stop_zone: { low: number; high: number };
    holding_period: string;
    score: number;
  },
  sizeUnit: SizeUnit = "usd",
  sizeValue = 1000
): SmartCart {
  // Prevent duplicates (same ticker, open or pending)
  const existing = cart.positions.find(
    (p) => p.ticker === pick.ticker && p.status !== "closed"
  );
  if (existing) return cart;

  const position: CartPosition = {
    id: generateId(pick.ticker),
    ticker: pick.ticker,
    company: pick.company,
    sector: pick.sector || "Unknown",
    addedDate: new Date().toISOString().split("T")[0],
    status: "pending",
    signalPrice: pick.current_price,
    buyZoneLow: pick.buy_zone.low,
    buyZoneHigh: pick.buy_zone.high,
    profitZoneLow: pick.profit_zone.low,
    profitZoneHigh: pick.profit_zone.high,
    stopZoneLow: pick.stop_zone.low,
    stopZoneHigh: pick.stop_zone.high,
    holdingPeriod: pick.holding_period || "—",
    score: pick.score,
    sizeUnit,
    sizeValue,
    dailyPnlHistory: [],
  };

  return {
    ...cart,
    updatedAt: now(),
    positions: [...cart.positions, position],
  };
}

export function openPosition(
  cart: SmartCart,
  positionId: string,
  entryPrice: number
): SmartCart {
  return {
    ...cart,
    updatedAt: now(),
    positions: cart.positions.map((p) =>
      p.id === positionId
        ? {
            ...p,
            status: "open",
            entryDate: new Date().toISOString().split("T")[0],
            entryPrice,
            currentPrice: entryPrice,
          }
        : p
    ),
  };
}

export function closePosition(
  cart: SmartCart,
  positionId: string,
  closePrice: number
): SmartCart {
  return {
    ...cart,
    updatedAt: now(),
    positions: cart.positions.map((p) => {
      if (p.id !== positionId) return p;
      const pnl = computePnl(p, closePrice);
      return {
        ...p,
        status: "closed",
        closeDate: new Date().toISOString().split("T")[0],
        closePrice,
        realizedPnlUsd: pnl.pnlUsd,
        realizedPnlPct: pnl.pnlPct,
      };
    }),
  };
}

export function removePosition(cart: SmartCart, positionId: string): SmartCart {
  return {
    ...cart,
    updatedAt: now(),
    positions: cart.positions.filter((p) => p.id !== positionId),
  };
}

export function updatePositionSize(
  cart: SmartCart,
  positionId: string,
  sizeUnit: SizeUnit,
  sizeValue: number
): SmartCart {
  return {
    ...cart,
    updatedAt: now(),
    positions: cart.positions.map((p) =>
      p.id === positionId ? { ...p, sizeUnit, sizeValue } : p
    ),
  };
}

// ── PnL Computation ───────────────────────────────────────────────────────────

export function computePnl(
  p: CartPosition,
  currentPrice?: number
): { pnlUsd: number; pnlPct: number; shares: number; investedUsd: number } {
  const entry = p.entryPrice ?? p.signalPrice;
  const price = currentPrice ?? p.currentPrice ?? entry;

  let shares: number;
  let investedUsd: number;

  if (p.sizeUnit === "usd") {
    investedUsd = p.sizeValue;
    shares = investedUsd / entry;
  } else {
    shares = p.sizeValue;
    investedUsd = shares * entry;
  }

  const pnlUsd = (price - entry) * shares;
  const pnlPct = entry > 0 ? ((price - entry) / entry) * 100 : 0;

  return { pnlUsd, pnlPct, shares, investedUsd };
}

// ── Basket Stats ──────────────────────────────────────────────────────────────

export interface CartStats {
  totalInvested: number;
  totalCurrentValue: number;
  totalUnrealizedPnl: number;
  totalUnrealizedPnlPct: number;
  totalRealizedPnl: number;
  openCount: number;
  closedCount: number;
  pendingCount: number;
  winRate: number; // %
  avgHoldingDays: number;
  sectorDistribution: Record<string, number>; // sector -> investedUsd
  bestPosition: CartPosition | null;
  worstPosition: CartPosition | null;
}

export function computeCartStats(cart: SmartCart): CartStats {
  const open = cart.positions.filter((p) => p.status === "open");
  const closed = cart.positions.filter((p) => p.status === "closed");
  const pending = cart.positions.filter((p) => p.status === "pending");

  let totalInvested = 0;
  let totalCurrentValue = 0;
  let totalUnrealizedPnl = 0;
  let totalRealizedPnl = 0;
  const sectorDist: Record<string, number> = {};

  open.forEach((p) => {
    const { pnlUsd, investedUsd } = computePnl(p);
    totalInvested += investedUsd;
    totalCurrentValue += investedUsd + pnlUsd;
    totalUnrealizedPnl += pnlUsd;
    sectorDist[p.sector] = (sectorDist[p.sector] || 0) + investedUsd;
  });

  let wins = 0;
  closed.forEach((p) => {
    totalRealizedPnl += p.realizedPnlUsd ?? 0;
    if ((p.realizedPnlUsd ?? 0) > 0) wins++;
  });

  const winRate = closed.length > 0 ? (wins / closed.length) * 100 : 0;

  // Avg holding days (closed positions)
  let totalDays = 0;
  let count = 0;
  closed.forEach((p) => {
    if (p.entryDate && p.closeDate) {
      const days =
        (new Date(p.closeDate).getTime() - new Date(p.entryDate).getTime()) /
        (1000 * 60 * 60 * 24);
      totalDays += days;
      count++;
    }
  });
  const avgHoldingDays = count > 0 ? totalDays / count : 0;

  // Best / Worst open positions
  let best: CartPosition | null = null;
  let worst: CartPosition | null = null;
  open.forEach((p) => {
    const { pnlUsd } = computePnl(p);
    if (!best || pnlUsd > computePnl(best).pnlUsd) best = p;
    if (!worst || pnlUsd < computePnl(worst).pnlUsd) worst = p;
  });

  const totalUnrealizedPnlPct =
    totalInvested > 0 ? (totalUnrealizedPnl / totalInvested) * 100 : 0;

  return {
    totalInvested,
    totalCurrentValue,
    totalUnrealizedPnl,
    totalUnrealizedPnlPct,
    totalRealizedPnl,
    openCount: open.length,
    closedCount: closed.length,
    pendingCount: pending.length,
    winRate,
    avgHoldingDays,
    sectorDistribution: sectorDist,
    bestPosition: best,
    worstPosition: worst,
  };
}
