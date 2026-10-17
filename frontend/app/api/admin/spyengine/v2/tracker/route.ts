/**
 * SPY / QQQ Engine — Takip Sistemi günlüğü (?symbol=SPY|QQQ, varsayılan SPY): GET tamamlanan seansları (tahmin · gerçekleşen · işlem · uyarı) kaydeder ve özet döner;
 * ?ref15=1&date= → QQQ girişleri için SPY'ın kapanmış 15m yönü (Takip kuralı, qqqengine/config.ts).
 * POST sayfanın canlı uyarılarını (HAZIRLAN / TETİK / YÖNET / ÇIKIŞ / İPTAL) günün bekleyen kaydına ekler. Lib: trackerStore.ts.
 */

import { NextRequest, NextResponse } from "next/server";
import { isEngineAuthed } from "@/lib/apiAuth";
import { appendTrackerAlerts, liveRefSide15, summarizeLog, updateTrackerLog, TRACK_SYMBOLS, type LiveAlert, type TrackSymbol } from "@/lib/spyengine/trackerStore";

const symOf = (req: NextRequest): TrackSymbol | null => {
  const v = (req.nextUrl.searchParams.get("symbol") || "SPY").toUpperCase();
  return (TRACK_SYMBOLS as string[]).includes(v) ? (v as TrackSymbol) : null;
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  if (!isEngineAuthed(req)) return NextResponse.json({ ok: false, error: "Yetkisiz" }, { status: 401 });
  try {
    const sym = symOf(req);
    if (!sym) return NextResponse.json({ ok: false, error: "Geçersiz sembol" }, { status: 400 });
    // ?ref15=1&date=YYYY-MM-DD → referans sembolün (QQQ için SPY) kapanmış 15m yönü [5m mum zamanı, yön][]
    if (req.nextUrl.searchParams.get("ref15") === "1") {
      const ref = await liveRefSide15(sym, req.nextUrl.searchParams.get("date") || "");
      return NextResponse.json({ ok: true, ref }, { headers: { "Cache-Control": "no-store, max-age=0" } });
    }
    const days = await updateTrackerLog(req.nextUrl.searchParams.get("force") === "1", sym);
    return NextResponse.json({ ok: true, ...summarizeLog(days) }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

const s = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : "");
const LEVELS = new Set(["HAZIRLAN", "TETİK", "İPTAL", "YÖNET", "ÇIKIŞ", "KADEME"]);

export async function POST(req: NextRequest) {
  if (!isEngineAuthed(req)) return NextResponse.json({ ok: false, error: "Yetkisiz" }, { status: 401 });
  try {
    const body = (await req.json()) as { date?: string; alerts?: unknown[] };
    const alerts: LiveAlert[] = (Array.isArray(body.alerts) ? body.alerts.slice(0, 40) : []).flatMap((x) => {
      const a = x as Record<string, unknown>;
      const t = typeof a.t === "number" ? Math.floor(a.t) : 0;
      const level = s(a.level, 12);
      if (!t || !LEVELS.has(level)) return [];
      return [{ t, clock: s(a.clock, 5), level, tag: a.tag ? s(a.tag, 16) : null, side: a.side ? s(a.side, 4) : null, text: s(a.text, 220) }];
    });
    const sym = symOf(req);
    if (!sym) return NextResponse.json({ ok: false, error: "Geçersiz sembol" }, { status: 400 });
    const n = await appendTrackerAlerts(s(body.date, 10), alerts, sym);
    return NextResponse.json({ ok: true, added: n });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
