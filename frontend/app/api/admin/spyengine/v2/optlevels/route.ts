/**
 * SPY Engine — 0DTE opsiyon seviyeleri (call/put duvarları + max pain).
 * Yalnızca seviye; yön kararına girmez. 5 dk önbellekli (Yahoo'yu yormamak için).
 */

import { NextRequest, NextResponse } from "next/server";
import { isStaffAuthed } from "@/lib/apiAuth";
import { fetchOptionLevels } from "@/lib/spyengine/optionFetch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  if (!isStaffAuthed(req)) {
    return NextResponse.json({ ok: false, error: "Yetkisiz" }, { status: 401 });
  }
  try {
    const levels = await fetchOptionLevels();
    return NextResponse.json(
      { ok: !!levels, levels, error: levels ? undefined : "Opsiyon zinciri alınamadı" },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
