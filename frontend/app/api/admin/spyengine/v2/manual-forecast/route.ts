/**
 * SPY Engine — Manuel Günlük Tahmin (Daily Forecast) API.
 *
 * GET  ?date=YYYY-MM-DD  -> o günün tahmin noktaları + gerçekleşen SPY 5m
 *                           kapanışları (09:30-16:00 ET, hizalı) + fark tablosu
 * GET  (date yok)        -> arşiv listesi (tüm günler, özet isabet)
 * POST                   -> bir günün tahmin noktalarını kaydeder/günceller
 */

import { NextRequest, NextResponse } from "next/server";
import { isStaffAuthed, isStaffWriteAuthed } from "@/lib/apiAuth";
import { fetchChart } from "@/lib/spyengine/market";
import { barsOfSessionDay, isRthBar, nyParts, RTH_OPEN_MIN, RTH_CLOSE_MIN } from "@/lib/spyengine/core";
import {
  readManualForecasts,
  writeManualForecastSession,
  type ManualForecastPoint,
  type ManualForecastSession,
} from "@/lib/spyengine/manualForecastStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** 09:30..16:00 arası her 5 dk için "HH:MM" listesi (78 nokta) */
function sessionSlots(): string[] {
  const out: string[] = [];
  for (let m = RTH_OPEN_MIN; m < RTH_CLOSE_MIN; m += 5) {
    out.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  }
  return out;
}

interface ComparePoint {
  time: string;
  forecast: number | null;
  actual: number | null;
  diff: number | null;
  diffPct: number | null;
}

function buildComparison(
  points: ManualForecastPoint[],
  actualByTime: Map<string, number>
): { rows: ComparePoint[]; checked: number; sumAbsDiffPct: number } {
  const forecastByTime = new Map(points.map((p) => [p.time, p.price]));
  const rows: ComparePoint[] = [];
  let checked = 0;
  let sumAbsDiffPct = 0;
  for (const time of sessionSlots()) {
    const forecast = forecastByTime.get(time) ?? null;
    const actual = actualByTime.get(time) ?? null;
    let diff: number | null = null;
    let diffPct: number | null = null;
    if (forecast != null && actual != null) {
      diff = actual - forecast;
      diffPct = forecast !== 0 ? (diff / forecast) * 100 : null;
      checked++;
      if (diffPct != null) sumAbsDiffPct += Math.abs(diffPct);
    }
    if (forecast != null || actual != null) rows.push({ time, forecast, actual, diff, diffPct });
  }
  return { rows, checked, sumAbsDiffPct };
}

async function actualClosesFor(date: string): Promise<Map<string, number>> {
  const chart = await fetchChart("SPY", "5m", "3mo", false, 20000);
  const dayBars = barsOfSessionDay(chart.bars, date).filter(isRthBar);
  const map = new Map<string, number>();
  for (const b of dayBars) {
    const p = nyParts(b.time);
    map.set(p.hhmm, b.close);
  }
  return map;
}

export async function GET(req: NextRequest) {
  if (!isStaffAuthed(req)) {
    return NextResponse.json({ ok: false, error: "Yetkisiz" }, { status: 401 });
  }

  const date = req.nextUrl.searchParams.get("date");
  const store = await readManualForecasts();

  if (!date) {
    // Arşiv listesi — her gün için özet isabet
    const sessions = Object.values(store.sessions).sort((a, b) => (a.date < b.date ? 1 : -1));
    const summaries = await Promise.all(
      sessions.map(async (s) => {
        const actual = await actualClosesFor(s.date).catch(() => new Map<string, number>());
        const cmp = buildComparison(s.points, actual);
        return {
          date: s.date,
          points: s.points.length,
          checked: cmp.checked,
          avgAbsDiffPct: cmp.checked > 0 ? cmp.sumAbsDiffPct / cmp.checked : null,
          updatedAt: s.updatedAt,
          hasImage: !!s.imageUrl,
        };
      })
    );
    return NextResponse.json(
      { ok: true, sessions: summaries },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ ok: false, error: "date formatı YYYY-MM-DD olmalı" }, { status: 400 });
  }

  const rec: ManualForecastSession | undefined = store.sessions[date];
  const actual = await actualClosesFor(date).catch(() => new Map<string, number>());
  const cmp = buildComparison(rec?.points ?? [], actual);

  return NextResponse.json(
    {
      ok: true,
      date,
      exists: !!rec,
      imageUrl: rec?.imageUrl ?? null,
      updatedAt: rec?.updatedAt ?? null,
      points: rec?.points ?? [],
      rows: cmp.rows,
      checked: cmp.checked,
      avgAbsDiffPct: cmp.checked > 0 ? cmp.sumAbsDiffPct / cmp.checked : null,
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}

export async function POST(req: NextRequest) {
  if (!isStaffWriteAuthed(req)) {
    return NextResponse.json({ ok: false, error: "Yetkisiz" }, { status: 401 });
  }

  let body: { date?: string; points?: { time: string; price: number }[]; imageUrl?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Geçersiz istek" }, { status: 400 });
  }

  const date = body.date;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ ok: false, error: "date (YYYY-MM-DD) gerekli" }, { status: 400 });
  }
  const points = (body.points ?? []).filter(
    (p) => typeof p.time === "string" && /^\d{2}:\d{2}$/.test(p.time) && Number.isFinite(p.price)
  );
  if (!points.length) {
    return NextResponse.json({ ok: false, error: "En az bir tahmin noktası gerekli" }, { status: 400 });
  }

  try {
    const rec = await writeManualForecastSession(date, points, body.imageUrl ?? null);
    return NextResponse.json({ ok: true, date, points: rec.points.length });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: `Kaydedilemedi: ${e instanceof Error ? e.message : String(e)}` },
      { status: 502 }
    );
  }
}
