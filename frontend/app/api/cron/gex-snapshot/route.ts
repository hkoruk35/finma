/**
 * SPY gamma kaydı için elle tetikleme ucu. Zamanlı kayıt lib/spyengine/gexScheduler.ts ile sunucu içinde yapılır.
 */

import { NextRequest, NextResponse } from "next/server";
import { recordGexSnapshot } from "@/lib/spyengine/gexStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Yetkisiz" }, { status: 401 });
  }
  try {
    return NextResponse.json({ ok: true, ...(await recordGexSnapshot()) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
