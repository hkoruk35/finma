/**
 * SPY Engine V2 — sinyal arşivi.
 *
 * Motor deterministik olduğu için (aynı mumlar → aynı sinyaller) arşiv
 * "kaynak" değil, KALICI KOPYA'dır: seans günü geçtikten ve Yahoo'nun 1m
 * geçmişi (~7 gün) düştükten sonra bile o günün sinyalleri ve sonuçları
 * okunabilsin diye tutulur.
 *
 * Depolama: Supabase `shared_store` KV (bkz. docs/DATA_CONTRACTS.md) —
 * ayrı bir migration gerektirmez. Anahtar: spyengine_v2_archive.
 * Seans başına tek kayıt; aynı gün tekrar gönderilirse üzerine yazılır,
 * bu yüzden istemcinin defalarca göndermesi zararsızdır (idempotent).
 */

import { NextRequest, NextResponse } from "next/server";
import { isStaffAuthed, isStaffWriteAuthed } from "@/lib/apiAuth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const STORE_KEY = "spyengine_v2_archive";
/** Kaç seans saklanacak */
const MAX_SESSIONS = 90;

interface ArchivedTrade {
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

interface ArchiveSession {
  date: string;
  updatedAt: string;
  trades: ArchivedTrade[];
  totalPnl: number;
  closed: number;
  wins: number;
  losses: number;
}

interface ArchivePayload {
  sessions: Record<string, ArchiveSession>;
}

async function readArchive(): Promise<ArchivePayload> {
  try {
    const { data } = await supabaseAdmin
      .from("shared_store")
      .select("value")
      .eq("key", STORE_KEY)
      .maybeSingle();
    const value = data?.value as ArchivePayload | undefined;
    if (value && typeof value === "object" && value.sessions) return value;
  } catch {
    // Supabase erişilemiyorsa boş arşiv dön — sayfa yine de çalışsın.
  }
  return { sessions: {} };
}

export async function GET(req: NextRequest) {
  if (!isStaffAuthed(req)) {
    return NextResponse.json({ ok: false, error: "Yetkisiz" }, { status: 401 });
  }
  const archive = await readArchive();
  const sessions = Object.values(archive.sessions).sort((a, b) => (a.date < b.date ? 1 : -1));

  const totals = sessions.reduce(
    (acc, s) => {
      acc.pnl += s.totalPnl || 0;
      acc.closed += s.closed || 0;
      acc.wins += s.wins || 0;
      acc.losses += s.losses || 0;
      return acc;
    },
    { pnl: 0, closed: 0, wins: 0, losses: 0 }
  );

  return NextResponse.json(
    { ok: true, sessions, totals },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}

export async function POST(req: NextRequest) {
  if (!isStaffWriteAuthed(req)) {
    return NextResponse.json({ ok: false, error: "Yetkisiz" }, { status: 401 });
  }

  let body: { date?: string; trades?: ArchivedTrade[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Geçersiz istek" }, { status: 400 });
  }

  const date = body.date;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ ok: false, error: "date (YYYY-MM-DD) gerekli" }, { status: 400 });
  }
  const trades = Array.isArray(body.trades) ? body.trades : [];

  const closedTrades = trades.filter((t) => t.status === "CLOSED");
  const record: ArchiveSession = {
    date,
    updatedAt: new Date().toISOString(),
    trades,
    totalPnl: Math.round(closedTrades.reduce((s, t) => s + (t.realizedPnl || 0), 0) * 100) / 100,
    closed: closedTrades.length,
    wins: closedTrades.filter((t) => (t.realizedPnl || 0) > 0).length,
    losses: closedTrades.filter((t) => (t.realizedPnl || 0) < 0).length,
  };

  const archive = await readArchive();
  archive.sessions[date] = record;

  // Sadece en yeni MAX_SESSIONS seansı sakla
  const keys = Object.keys(archive.sessions).sort().reverse().slice(0, MAX_SESSIONS);
  const trimmed: Record<string, ArchiveSession> = {};
  for (const k of keys) trimmed[k] = archive.sessions[k];

  try {
    const { error } = await supabaseAdmin
      .from("shared_store")
      .upsert({ key: STORE_KEY, value: { sessions: trimmed }, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) throw new Error(error.message);
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: `Arşiv yazılamadı: ${e instanceof Error ? e.message : String(e)}` },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, date, saved: trades.length });
}
