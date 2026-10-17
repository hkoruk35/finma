/**
 * QQQ Engine — canlı akış uç noktası (SPY Engine /api/admin/spyengine/v2 ile aynı yanıt biçimi, QQQ verisiyle).
 * Gövde ortak: lib/spyengine/engineStream.ts (IWM/NVDA/AAPL/TSLA/AMZN de aynısını /api/admin/engine/[symbol] ile kullanır).
 * Kimlik: /api/* proxy.ts matcher'ının dışında olduğu için boga_auth satır içi (bkz. frontend/AGENTS.md §3).
 */

import { NextRequest, NextResponse } from "next/server";
import { isEngineAuthed } from "@/lib/apiAuth";
import { engineStream } from "@/lib/spyengine/engineStream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  if (!isEngineAuthed(req)) return NextResponse.json({ ok: false, error: "Yetkisiz" }, { status: 401 });
  return engineStream(req, "QQQ");
}
