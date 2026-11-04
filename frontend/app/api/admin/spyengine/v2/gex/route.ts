/**
 * SPY gamma kaydı: güncel özet + bugünkü kayıtlar. Yalnız okur ve karar üretmez; yazıcı /api/cron/gex-snapshot.
 */

import { NextRequest, NextResponse } from "next/server";
import { isEngineAuthed } from "@/lib/apiAuth";
import { nyParts } from "@/lib/spyengine/core";
import { fetchGex, readGexDay } from "@/lib/spyengine/gexStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  if (!isEngineAuthed(req)) return NextResponse.json({ ok: false, error: "Yetkisiz" }, { status: 401 });
  const [read, snapshots] = await Promise.all([fetchGex(), readGexDay(nyParts(Math.floor(Date.now() / 1000)).ymd)]);
  return NextResponse.json(
    { ok: !!read, read, snapshots, error: read ? undefined : "Cboe zinciri alınamadı" },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
