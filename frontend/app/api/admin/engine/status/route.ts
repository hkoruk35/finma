/**
 * Tüm motorların anlık durumu (/api/admin/engine/status?symbols=SPY,QQQ,…; boşsa tümü) — Endeks Merkezi izleme listesi.
 * Gövde: lib/spyengine/liveStatus.ts (60 sn önbellek). Kimlik: /api/* proxy.ts matcher'ının dışında → satır içi isEngineAuthed.
 */

import { NextRequest, NextResponse } from "next/server";
import { isEngineAuthed } from "@/lib/apiAuth";
import { engineLiveStatuses } from "@/lib/spyengine/liveStatus";
import { isEngineSymbol, type EngineSymbol } from "@/lib/spyengine/engines";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  if (!isEngineAuthed(req)) return NextResponse.json({ ok: false, error: "Yetkisiz" }, { status: 401 });
  const syms = (req.nextUrl.searchParams.get("symbols") || "")
    .split(",").map((s) => s.trim().toUpperCase()).filter(isEngineSymbol) as EngineSymbol[];
  try {
    const statuses = await engineLiveStatuses(syms);
    return NextResponse.json({ ok: true, serverTime: Math.floor(Date.now() / 1000), statuses }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
