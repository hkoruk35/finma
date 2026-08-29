/**
 * SPY Engine V2 — Ticker sparkline (son 20 mum)
 * Hover popup'ta mini grafik göstermek için
 */

import { NextRequest, NextResponse } from "next/server";
import { isStaffAuthed } from "@/lib/apiAuth";
import { fetchChart } from "@/lib/spyengine/market";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 15;

export async function GET(req: NextRequest) {
  if (!isStaffAuthed(req)) {
    return NextResponse.json({ ok: false, error: "Yetkisiz" }, { status: 401 });
  }

  const symbol = req.nextUrl.searchParams.get("symbol");
  if (!symbol) {
    return NextResponse.json({ ok: false, error: "symbol gerekli" }, { status: 400 });
  }

  try {
    const bars = await fetchChart(symbol, "1d", "3mo", true, 600000);

    if (bars.error) {
      return NextResponse.json(
        { ok: false, error: bars.error },
        { status: 500 }
      );
    }

    const last20 = bars.bars.slice(-20).map((b) => ({
      close: b.close,
      time: b.time,
    }));

    return NextResponse.json(
      { ok: true, bars: last20, low: Math.min(...last20.map(b => b.close)), high: Math.max(...last20.map(b => b.close)) },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
