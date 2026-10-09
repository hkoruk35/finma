/**
 * QQQ Engine — büyük teknoloji liderleri takibi: her lider için VWAP/EMA20 tarafı, 15 dk momentum,
 * günlük değişim, QQQ'ya göreli güç ve ağırlıklı genişlik serisi (karar merdiveninin teknoloji filtresi).
 * `?date=YYYY-MM-DD` geçmiş seans oynatma.
 */

import { NextRequest, NextResponse } from "next/server";
import { isEngineAuthed } from "@/lib/apiAuth";
import { fetchChart, TTL } from "@/lib/spyengine/market";
import { nyDateTimeToEpoch, nyParts, type Bar } from "@/lib/spyengine/core";
import { buildTechSnapshot, TECH_HOLDINGS } from "@/lib/qqqengine/techs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  if (!isEngineAuthed(req)) return NextResponse.json({ ok: false, error: "Yetkisiz" }, { status: 401 });
  const nowReal = Math.floor(Date.now() / 1000);
  const dateParam = new URL(req.url).searchParams.get("date");
  const replay = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : null;
  try {
    const syms = [...TECH_HOLDINGS.map((h) => h.sym), "QQQ"];
    const fetched = await Promise.all(
      syms.map((s) =>
        fetchChart(s, "5m", "5d", true, TTL.m5)
          .then((c) => ({ s, bars: c.bars, err: c.error }))
          .catch((e) => ({ s, bars: [] as Bar[], err: String(e) })),
      ),
    );
    const by: Record<string, Bar[]> = {};
    const errors: string[] = [];
    for (const f of fetched) {
      by[f.s] = f.bars;
      if (f.err) errors.push(`${f.s}: ${f.err}`);
    }
    const qqq = by.QQQ ?? [];
    const date = replay ?? nyParts(qqq.length ? qqq[qqq.length - 1].time : nowReal).ymd;
    const now = replay ? nyDateTimeToEpoch(replay, 16 * 60 + 5) : nowReal;
    const snap = buildTechSnapshot(by, qqq, date, now);
    return NextResponse.json(
      {
        ok: true, serverTime: nowReal, date, errors,
        rows: snap.rows, breadth: snap.breadth, momentum: snap.momentum, upWeight: snap.upWeight, downWeight: snap.downWeight,
        read: snap.read, asOf: snap.asOf,
        /** [5m mum başlangıcı, genişlik, momentum] */
        series: Array.from(snap.series.entries()).map(([t, v]) => [t, v.vw, v.mom]),
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
