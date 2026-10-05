/**
 * SPY Engine — Açılış Tahmini (04:00 → 09:30 ET): ES fair value merkezli
 * açılış aralığı, gap yönü güveni, kontrol noktası geçmişi. 60 sn önbellekli.
 */

import { NextRequest, NextResponse } from "next/server";
import { isStaffAuthed } from "@/lib/apiAuth";
import { fetchOpenForecast } from "@/lib/spyengine/openForecastFetch";
import { updateJournal, learned } from "@/lib/spyengine/journal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  if (!isStaffAuthed(req)) {
    return NextResponse.json({ ok: false, error: "Yetkisiz" }, { status: 401 });
  }
  try {
    // günlükten öğrenilen bant ölçeği (N ≥ 20 kontrol noktalarında); günlük hatası tahmini engellemez
    const j = await updateJournal().catch(() => null);
    const read = await fetchOpenForecast(learned(j?.stats ?? null).bandScale);
    return NextResponse.json(
      { ok: !!read, read, error: read ? undefined : "Vadeli işlem verisi alınamadı" },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
