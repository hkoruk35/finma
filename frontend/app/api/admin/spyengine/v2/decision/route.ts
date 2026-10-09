/**
 * SPY Engine V11 — tek karar uç noktası. Hükmün tamamı lib/spyengine/v11/engine.ts'te
 * hesaplanır; bu route yalnızca kimlik doğrular ve anlık görüntüyü döndürür.
 *
 * Kimlik: /api/* proxy.ts matcher'ının dışında olduğu için boga_auth burada satır içinde
 * kontrol edilir (bkz. frontend/AGENTS.md §3, tasks/active/001).
 *
 * `?date=YYYY-MM-DD[&asof=HH:MM]` → geriye dönük oynatma (Yahoo 5m ≤ 60 gün).
 */

import { NextRequest, NextResponse } from "next/server";
import { isStaffAuthed } from "@/lib/apiAuth";
import { getV11Snapshot } from "@/lib/spyengine/v11/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  if (!isStaffAuthed(req)) {
    return NextResponse.json({ ok: false, error: "Yetkisiz" }, { status: 401 });
  }
  const q = new URL(req.url).searchParams;
  try {
    const snap = await getV11Snapshot({ date: q.get("date"), asof: q.get("asof") });
    return NextResponse.json(snap, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
