/**
 * SPY Engine V2 — canlı bilgi kartı şeridi.
 * NVDA, AMZN, MSFT, GOOGL, AAPL, XLF, DIA, ES, SPX, VIX, RSP, NQ, QQQ,
 * NDX, IWM, XLK, SMH — hepsi Yahoo'dan gerçek fiyat/oran/yön.
 *
 * Ana akıştan (v2/route.ts) AYRI bir uç nokta: ticker şeridi 15 saniyede
 * bir yenilenmesi yeterli, SPY mumları 2 saniyede bir. Tek uç noktada
 * birleştirilseydi 17 sembol de 2 saniyede bir çekilir, Yahoo rate-limit'i
 * (HTTP 429) tetiklenirdi.
 */

import { NextRequest, NextResponse } from "next/server";
import { isStaffAuthed } from "@/lib/apiAuth";
import { fetchStripQuotes } from "@/lib/spyengine/market";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  if (!isStaffAuthed(req)) {
    return NextResponse.json({ ok: false, error: "Yetkisiz" }, { status: 401 });
  }
  try {
    const quotes = await fetchStripQuotes();
    return NextResponse.json(
      { ok: true, serverTime: Math.floor(Date.now() / 1000), quotes },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
