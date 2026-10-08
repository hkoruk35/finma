/**
 * SPY Engine — Tahmin Günlüğü: tamamlanan seansların açılış tahmini ve açılış
 * aşaması sonuçları + gerçekleşen isabet istatistikleri. Okuma sırasında eksik
 * günleri ekler (bkz. lib/spyengine/journal.ts). 10 dk önbellekli.
 */

import { NextRequest, NextResponse } from "next/server";
import { isStaffAuthed } from "@/lib/apiAuth";
import { updateJournal, learned, openBias, MIN_N } from "@/lib/spyengine/journal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  if (!isStaffAuthed(req)) {
    return NextResponse.json({ ok: false, error: "Yetkisiz" }, { status: 401 });
  }
  try {
    const { days, stats, added, model, fstats } = await updateJournal();
    const lr = learned(stats);
    const ob = openBias(days);
    lr.openBias = Object.fromEntries(Object.entries(ob).filter(([, v]) => v.sig).map(([k, v]) => [k, v.bias]));
    // tarayıcıya gün kayıtları hafif gider (fm/fl ham dizileri yalnız son 15 gün için)
    return NextResponse.json(
      { ok: true, stats, learned: lr, openBiasAll: ob, minN: MIN_N, recent: days.slice(-15).reverse(), added, model, fstats },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
