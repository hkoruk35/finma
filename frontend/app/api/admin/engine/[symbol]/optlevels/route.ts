/**
 * Takip Sistemi motorları — opsiyon seviyeleri (call/put duvarları + max pain; en yakın vade). Yalnızca seviye; yön vermez.
 * /api/admin/engine/IWM|NVDA|AAPL|TSLA|AMZN/optlevels — QQQ ucu ile aynı (lib/spyengine/optionFetch.ts).
 */

import { NextRequest, NextResponse } from "next/server";
import { isEngineAuthed } from "@/lib/apiAuth";
import { fetchOptionLevels } from "@/lib/spyengine/optionFetch";
import { isEngineSymbol } from "@/lib/spyengine/engines";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 30;

export async function GET(req: NextRequest, { params }: { params: Promise<{ symbol: string }> }) {
  if (!isEngineAuthed(req)) return NextResponse.json({ ok: false, error: "Yetkisiz" }, { status: 401 });
  const sym = (await params).symbol.toUpperCase();
  if (!isEngineSymbol(sym)) return NextResponse.json({ ok: false, error: "Geçersiz sembol" }, { status: 400 });
  try {
    const levels = await fetchOptionLevels(sym);
    return NextResponse.json(
      { ok: !!levels, levels, error: levels ? undefined : "Opsiyon zinciri alınamadı" },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
