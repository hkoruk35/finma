/**
 * SPY Engine V2 — sinyal arşivinin SAF tipleri ve dönüşümü.
 *
 * Depolama katmanından (archiveStore.ts, `server-only`) bilinçli olarak ayrı:
 * arşiv tablosunu çizen istemci bileşeni de aynı `toArchiveTrade` eşlemesini
 * kullanabilsin, iki taraf ayrı ayrı yazılıp zamanla birbirinden kaymasın.
 */

import type { PositionState } from "./strategy";

/** Supabase `shared_store` anahtarı (bkz. docs/DATA_CONTRACTS.md) */
export const ARCHIVE_STORE_KEY = "spyengine_v2_archive";

/** Kaç seans saklanacak */
export const ARCHIVE_MAX_SESSIONS = 90;

export interface ArchivedTrade {
  id: string;
  side: "LONG" | "SHORT";
  contractType: "A" | "B";
  entryTime: number;
  entrySpot: number;
  contract: string | null;
  strike: number | null;
  entryPremium: number | null;
  exitTime: number | null;
  exitSpot: number | null;
  exitPremium: number | null;
  exitReason: string | null;
  exitNote: string | null;
  status: string;
  realizedPnl: number;
  premiumDataMissing: boolean;
  events: { kind: string; time: number; premium: number | null; label: string; note: string }[];
}

export interface ArchiveSession {
  date: string;
  updatedAt: string;
  trades: ArchivedTrade[];
  totalPnl: number;
  closed: number;
  wins: number;
  losses: number;
}

export interface ArchivePayload {
  sessions: Record<string, ArchiveSession>;
}

/** Canlı pozisyon durumundan arşiv kaydına — tek kaynak */
export function toArchiveTrade(p: PositionState): ArchivedTrade {
  return {
    id: p.id,
    side: p.side,
    contractType: p.contractType,
    entryTime: p.entryTime,
    entrySpot: p.entrySpot,
    contract: p.contract,
    strike: p.strike,
    entryPremium: p.entryPremium,
    exitTime: p.exitTime,
    exitSpot: p.exitSpot,
    exitPremium: p.exitPremium,
    exitReason: p.exitReason,
    exitNote: p.exitNote,
    status: p.status,
    realizedPnl: p.realizedPnl,
    premiumDataMissing: p.premiumDataMissing,
    events: p.events.map((e) => ({
      kind: e.kind, time: e.time, premium: e.premium, label: e.label, note: e.note,
    })),
  };
}

/** Bir seansın işlemlerinden özet kayıt üretir (toplam/kazanan/kaybeden) */
export function buildArchiveSession(date: string, trades: ArchivedTrade[]): ArchiveSession {
  const closed = trades.filter((t) => t.status === "CLOSED");
  return {
    date,
    updatedAt: new Date().toISOString(),
    trades,
    totalPnl: Math.round(closed.reduce((s, t) => s + (t.realizedPnl || 0), 0) * 100) / 100,
    closed: closed.length,
    wins: closed.filter((t) => (t.realizedPnl || 0) > 0).length,
    losses: closed.filter((t) => (t.realizedPnl || 0) < 0).length,
  };
}
