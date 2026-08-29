/**
 * SPY Engine V2 — 15 günlük günlük OHLC verisi (1d granularity)
 */

import { NextRequest, NextResponse } from "next/server";
import { isStaffAuthed } from "@/lib/apiAuth";
import { fetchChart } from "@/lib/spyengine/market";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  if (!isStaffAuthed(req)) {
    return NextResponse.json({ ok: false, error: "Yetkisiz" }, { status: 401 });
  }
  try {
    const bars = await fetchChart("SPY", "1d", "3mo", true, 3600000);

    if (bars.error) {
      return NextResponse.json(
        { ok: false, error: bars.error },
        { status: 500 }
      );
    }

    // Son 15 günü döndür
    const last15 = bars.bars.slice(-15);

    return NextResponse.json(
      {
        ok: true,
        serverTime: Math.floor(Date.now() / 1000),
        bars: last15.map((b) => ({
          date: new Date(b.time * 1000).toLocaleDateString("tr-TR", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }),
          open: parseFloat(b.open.toFixed(2)),
          high: parseFloat(b.high.toFixed(2)),
          low: parseFloat(b.low.toFixed(2)),
          close: parseFloat(b.close.toFixed(2)),
          volume: b.volume,
        })),
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
