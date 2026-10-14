/**
 * SPY Engine — Karar Günlüğü: GET arşivi günceller (tamamlanan seanslar) ve öğrenen modeli döndürür;
 * POST sayfanın canlı kararlarını (durum geçişleri) günün bekleyen kaydına ekler. Lib: decisionStore.ts.
 */

import { NextRequest, NextResponse } from "next/server";
import { isEngineAuthed } from "@/lib/apiAuth";
import { appendLiveEvents, updateDecisionLog } from "@/lib/spyengine/decisionStore";
import type { LiveEvent } from "@/lib/spyengine/decisionCore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  if (!isEngineAuthed(req)) return NextResponse.json({ ok: false, error: "Yetkisiz" }, { status: 401 });
  try {
    const { days, model, added } = await updateDecisionLog(req.nextUrl.searchParams.get("force") === "1");
    return NextResponse.json(
      { ok: true, model, added, count: days.length, recent: days.slice(-10).reverse(), trades: days.slice(-60).flatMap((d) => d.attempts.filter((a) => !a.shadow).map((a) => ({ date: d.date, ...a }))) },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

const s = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : "");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v * 100) / 100 : undefined);

export async function POST(req: NextRequest) {
  if (!isEngineAuthed(req)) return NextResponse.json({ ok: false, error: "Yetkisiz" }, { status: 401 });
  try {
    const body = (await req.json()) as { date?: string; events?: unknown[] };
    const date = s(body.date, 10);
    const events: LiveEvent[] = (Array.isArray(body.events) ? body.events.slice(0, 40) : []).flatMap((x) => {
      const e = x as Record<string, unknown>;
      const t = typeof e.t === "number" ? Math.floor(e.t) : 0;
      if (!t || !s(e.status, 20)) return [];
      return [{ t, clock: s(e.clock, 5), status: s(e.status, 20), side: e.side ? s(e.side, 4) : null, mode: s(e.mode, 24), msg: s(e.msg, 160), price: num(e.price) ?? null, entry: num(e.entry), stop: num(e.stop), target: num(e.target) }];
    });
    const n = await appendLiveEvents(date, events);
    return NextResponse.json({ ok: true, added: n });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
