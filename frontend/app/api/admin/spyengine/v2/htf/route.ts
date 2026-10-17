/**
 * SPY Engine — üst zaman dilimi mumları (1h, RTH, ~6 ay). 15m setup tahmininin 1h / 4h teyidi için.
 * 4h mumlar istemcide bu 1h mumlardan seans hizalı (09:30–13:30, 13:30–16:00) türetilir.
 * Canlı akışın 1m verisi yalnız ~5 günlük olduğu için EMA20 (1h/4h) ısınması bu uçtan gelir. 5 dk önbellekli.
 */

import { NextRequest, NextResponse } from "next/server";
import { isEngineAuthed } from "@/lib/apiAuth";
import { ENGINE_SYMBOLS } from "@/lib/spyengine/engines";
import { fetchChart } from "@/lib/spyengine/market";
import { isRthBar, toCompact } from "@/lib/spyengine/core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 30;

/** Takip Sistemi motorlarının sembolleri (lib/spyengine/engines.ts) */
const SYMBOLS = new Set<string>(ENGINE_SYMBOLS);

export async function GET(req: NextRequest) {
  if (!isEngineAuthed(req)) {
    return NextResponse.json({ ok: false, error: "Yetkisiz" }, { status: 401 });
  }
  const symbol = (req.nextUrl.searchParams.get("symbol") || "SPY").toUpperCase();
  if (!SYMBOLS.has(symbol)) return NextResponse.json({ ok: false, error: "Geçersiz sembol" }, { status: 400 });
  try {
    const c = await fetchChart(symbol, "60m", "6mo", false, 5 * 60 * 1000);
    const h1 = c.bars.filter(isRthBar);
    return NextResponse.json(
      { ok: h1.length > 0, h1: toCompact(h1), error: h1.length ? undefined : c.error ?? "1h veri yok" },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
