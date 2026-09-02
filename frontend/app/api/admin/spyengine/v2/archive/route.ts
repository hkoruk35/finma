/**
 * SPY Engine V2 — sinyal arşivi uç noktası.
 *
 * GET  → tüm seanslar + toplamlar
 * POST → tek seansı yaz (idempotent; aynı gün tekrar gönderilirse üzerine yazar)
 *
 * Tipler, dönüşüm ve depolama `lib/spyengine/archiveTypes.ts` +
 * `archiveStore.ts` içinde — geri doldurma uç noktası (./backfill) da aynı
 * kaynağı kullanır, iki yazıcı zamanla birbirinden kaymasın diye.
 *
 * Kimlik: /api/* proxy.ts matcher'ının dışında kaldığı için (bkz.
 * frontend/AGENTS.md §3, tasks/active/001) boga_auth kontrolü burada satır
 * içinde yapılır.
 */

import { NextRequest, NextResponse } from "next/server";
import { isStaffAuthed, isStaffWriteAuthed } from "@/lib/apiAuth";
import { readArchive, writeSession } from "@/lib/spyengine/archiveStore";
import type { ArchivedTrade } from "@/lib/spyengine/archiveTypes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

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

  try {
    await writeSession(date, trades);
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: `Arşiv yazılamadı: ${e instanceof Error ? e.message : String(e)}` },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, date, saved: trades.length });
}
