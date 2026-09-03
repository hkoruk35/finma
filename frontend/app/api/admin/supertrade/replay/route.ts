/**
 * GET /api/admin/supertrade/replay?date=YYYY-MM-DD
 * Geçmiş bir seansı dakika dakika yeniden kurar. Kareler canlı motorla
 * birebir aynı hesaplama yolundan geçer, böylece simülasyon gerçeği yansıtır.
 */

import { NextRequest, NextResponse } from "next/server";
import { isStaffAuthed } from "@/lib/apiAuth";
import { buildReplay } from "@/lib/spx/snapshot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  if (!isStaffAuthed(request)) {
    return NextResponse.json({ ok: false, error: "Yetkisiz" }, { status: 401 });
  }
  const date = request.nextUrl.searchParams.get("date") || undefined;

  try {
    const replay = await buildReplay(date);
    return NextResponse.json(replay, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    console.error("[supertrade] replay hatası:", message);
    return NextResponse.json(
      { ok: false, error: message, hint: "1 dakikalık geçmiş veri yalnızca son ~7 seans için sunulur." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
