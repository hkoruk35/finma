/**
 * Günlük Plan & Seviye Haritası (Geniş Harita v5).
 *   GET  ?symbol=SPY&date=YYYY-MM-DD&version=latest|vN   → kayıtlı sürüm (bugün için gerekirse yenisini üretir)
 *   GET  ?symbol=SPY&asOf=<unix>                          → o an için yeniden hesap (replay, KAYDETMEZ)
 *   POST ?symbol=SPY                                      → yeni sürüm (yalnız admin)
 * Hesap tamamen deterministik (lib/spyengine/dayPlan.ts); LLM yok.
 */

import { NextRequest, NextResponse } from "next/server";
import { isEngineAuthed, isStaffWriteAuthed } from "@/lib/apiAuth";
import { isEngineSymbol } from "@/lib/spyengine/engines";
import { tradeDateOf } from "@/lib/spyengine/dayPlan";
import { computePlan, ensureFresh, readDay, readVersion, saveVersion, versionList } from "@/lib/spyengine/dayPlanStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };
const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status, headers: NO_STORE });

export async function GET(req: NextRequest) {
  if (!isEngineAuthed(req)) return bad("Yetkisiz", 401);
  const q = req.nextUrl.searchParams;
  const symbol = (q.get("symbol") || "SPY").toUpperCase();
  if (!isEngineSymbol(symbol)) return bad("Geçersiz sembol");
  try {
    const asOf = Number(q.get("asOf"));
    if (q.get("asOf") && Number.isFinite(asOf) && asOf > 1.6e9) {
      const plan = await computePlan(symbol, Math.floor(asOf));
      return NextResponse.json({ ok: !!plan, plan, versions: [], replay: true, error: plan ? undefined : "yetersiz veri" }, { headers: NO_STORE });
    }
    const today = tradeDateOf(Math.floor(Date.now() / 1000));
    const date = /^\d{4}-\d{2}-\d{2}$/.test(q.get("date") ?? "") ? q.get("date")! : today;
    const row = date === today ? await ensureFresh(symbol) : await readDay(symbol, date);
    const want = q.get("version") ?? "latest";
    const vs = row?.versions ?? [];
    const hit = want === "latest" ? vs[vs.length - 1] : vs.find((x) => `v${x.v}` === want);
    const plan = hit ? await readVersion(symbol, date, hit.v) : null;
    return NextResponse.json(
      { ok: !!plan, date, plan, versions: versionList(row), error: plan ? undefined : "bu gün için kayıt yok" },
      { headers: NO_STORE },
    );
  } catch (e) {
    return bad(e instanceof Error ? e.message : String(e), 500);
  }
}

export async function POST(req: NextRequest) {
  if (!isStaffWriteAuthed(req)) return bad("Yalnız admin yenileyebilir", 403);
  const symbol = (req.nextUrl.searchParams.get("symbol") || "SPY").toUpperCase();
  if (!isEngineSymbol(symbol)) return bad("Geçersiz sembol");
  try {
    const plan = await computePlan(symbol);
    if (!plan) return bad("yetersiz veri", 503);
    const { payload } = await saveVersion(plan, true);
    const row = await readDay(symbol, plan.meta.date);
    return NextResponse.json({ ok: true, date: plan.meta.date, plan: payload, versions: versionList(row) }, { headers: NO_STORE });
  } catch (e) {
    return bad(e instanceof Error ? e.message : String(e), 500);
  }
}
