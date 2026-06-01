// Smart Tracker — Paper Trade Basket
// Supabase shared_store üzerinden cross-device sync

export const TRACKER_STORAGE_KEY = "boga_smart_tracker_v1";
export const TRACKER_TTL_DAYS = 30;
const STORE_KEY = "smart_tracker_v1";
const LS_KEY = `shared_${STORE_KEY}`;

export async function loadTrackerStoreRemote(): Promise<TrackerStore> {
  try {
    const res = await fetch(`/api/store/${STORE_KEY}`);
    const { value } = await res.json();
    if (value) {
      try { localStorage.setItem(LS_KEY, JSON.stringify(value)); } catch {}
      return value as TrackerStore;
    }
  } catch {}
  return loadTrackerStore();
}

export async function saveTrackerStoreRemote(store: TrackerStore): Promise<void> {
  store.lastFetched = new Date().toISOString();
  try { localStorage.setItem(LS_KEY, JSON.stringify(store)); } catch {}
  fetch(`/api/store/${STORE_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value: store }),
  }).catch(() => {});
}

export type TradeStatus = "open" | "closed" | "pending";
export type SizeUnit = "usd" | "lot";

export interface TrackerPosition {
  id: string; // uuid-style: ticker + entryDate
  ticker: string;
  company: string;
  sector: string;
  addedDate: string; // ISO date string (day added to tracker)
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

export interface SmartTracker {
  id: string; // single basket id
  name: string;
  createdAt: string;
  updatedAt: string;
  totalBudgetUsd: number;
  positions: TrackerPosition[];
}

export interface TrackerStore {
  activeTracker: SmartTracker | null;
  archivedTrackers: SmartTracker[]; // closed baskets
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

export function loadTrackerStore(): TrackerStore {
  if (typeof window === "undefined") return { activeTracker: null, archivedTrackers: [], lastFetched: "" };
  try {
    // Önce yeni shared key'e bak, sonra eski key'e
    const raw = localStorage.getItem(LS_KEY) || localStorage.getItem(TRACKER_STORAGE_KEY);
    if (!raw) return { activeTracker: null, archivedTrackers: [], lastFetched: "" };
    return JSON.parse(raw) as TrackerStore;
  } catch {
    return { activeTracker: null, archivedTrackers: [], lastFetched: "" };
  }
}

export function saveTrackerStore(store: TrackerStore): void {
  if (typeof window === "undefined") return;
  store.lastFetched = now();
  try { localStorage.setItem(LS_KEY, JSON.stringify(store)); } catch {}
  // Remote kayıt (fire and forget)
  fetch(`/api/store/${STORE_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value: store }),
  }).catch(() => {});
}

// ── Tracker Operations ───────────────────────────────────────────────────────────

export function createTracker(name = "My Smart Tracker", totalBudgetUsd = 10000): SmartTracker {
  return {
    id: generateId("tracker"),
    name,
    createdAt: now(),
    updatedAt: now(),
    totalBudgetUsd,
    positions: [],
  };
}

export function addPosition(
  tracker: SmartTracker,
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
): SmartTracker {
  // Prevent duplicates (same ticker, open or pending)
  const existing = tracker.positions.find(
    (p) => p.ticker === pick.ticker && p.status !== "closed"
  );
  if (existing) return tracker;

  const position: TrackerPosition = {
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
    ...tracker,
    updatedAt: now(),
    positions: [...tracker.positions, position],
  };
}

export function openPosition(
  tracker: SmartTracker,
  positionId: string,
  entryPrice: number
): SmartTracker {
  return {
    ...tracker,
    updatedAt: now(),
    positions: tracker.positions.map((p) =>
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
  tracker: SmartTracker,
  positionId: string,
  closePrice: number
): SmartTracker {
  return {
    ...tracker,
    updatedAt: now(),
    positions: tracker.positions.map((p) => {
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

export function removePosition(tracker: SmartTracker, positionId: string): SmartTracker {
  return {
    ...tracker,
    updatedAt: now(),
    positions: tracker.positions.filter((p) => p.id !== positionId),
  };
}

export function updatePositionSize(
  tracker: SmartTracker,
  positionId: string,
  sizeUnit: SizeUnit,
  sizeValue: number
): SmartTracker {
  return {
    ...tracker,
    updatedAt: now(),
    positions: tracker.positions.map((p) =>
      p.id === positionId ? { ...p, sizeUnit, sizeValue } : p
    ),
  };
}

// ── PnL Computation ───────────────────────────────────────────────────────────

export function computePnl(
  p: TrackerPosition,
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

// ── Tracker Stats ──────────────────────────────────────────────────────────────

export interface TrackerStats {
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
  bestPosition: TrackerPosition | null;
  worstPosition: TrackerPosition | null;
}

export function computeTrackerStats(tracker: SmartTracker): TrackerStats {
  const open = tracker.positions.filter((p) => p.status === "open");
  const closed = tracker.positions.filter((p) => p.status === "closed");
  const pending = tracker.positions.filter((p) => p.status === "pending");

  let totalInvested = 0;
  let totalCurrentValue = 0;
  let totalUnrealizedPnl = 0;
  let totalRealizedPnl = 0;
  const sectorDist: Record<string, number> = {};

  [...open, ...pending].forEach((p) => {
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
  let best: TrackerPosition | null = null;
  let worst: TrackerPosition | null = null;
  [...open, ...pending].forEach((p) => {
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
