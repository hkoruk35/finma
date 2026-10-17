/**
 * Takip Sistemi motorları — canlı akış (/api/admin/engine/IWM|NVDA|AAPL|TSLA|AMZN). Gövde: lib/spyengine/engineStream.ts
 * (QQQ ile aynı). SPY ve QQQ kendi uçlarını kullanır. Yalnız lib/spyengine/engines.ts'teki semboller.
 * Kimlik: /api/* proxy.ts matcher'ının dışında olduğu için boga_auth satır içi (isEngineAuthed, frontend/AGENTS.md §3).
 */

import { NextRequest, NextResponse } from "next/server";
import { isEngineAuthed } from "@/lib/apiAuth";
import { engineStream } from "@/lib/spyengine/engineStream";
import { isEngineSymbol } from "@/lib/spyengine/engines";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 30;

export async function GET(req: NextRequest, { params }: { params: Promise<{ symbol: string }> }) {
  if (!isEngineAuthed(req)) return NextResponse.json({ ok: false, error: "Yetkisiz" }, { status: 401 });
  const sym = (await params).symbol.toUpperCase();
  if (!isEngineSymbol(sym) || sym === "SPY") return NextResponse.json({ ok: false, error: "Geçersiz sembol" }, { status: 400 });
  return engineStream(req, sym);
}
