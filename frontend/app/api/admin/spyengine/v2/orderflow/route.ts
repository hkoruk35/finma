/**
 * SPY Engine — emir defteri (Level 1: en iyi alış/satış fiyatı + miktarı, 2 sn önbellek) ve
 * en yakın vadenin opsiyon Call/Put hacim-prim dengesi (60 sn önbellek). Sayfa birkaç saniyede bir yoklar.
 */

import { NextRequest, NextResponse } from "next/server";
import { isEngineAuthed } from "@/lib/apiAuth";
import { ENGINE_SYMBOLS } from "@/lib/spyengine/engines";
import { fetchOptionFlow, fetchQuoteBook } from "@/lib/spyengine/optionFetch";

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
    const [book, options] = await Promise.all([
      fetchQuoteBook(symbol).catch(() => null),
      fetchOptionFlow(symbol).catch(() => null),
    ]);
    return NextResponse.json(
      { ok: !!book || !!options, book, options },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
