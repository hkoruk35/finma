/**
 * QQQ Engine — canlı akış uç noktası (SPY Engine /api/admin/spyengine/v2 ile aynı yanıt biçimi,
 * QQQ verisiyle). Karar mantığı sayfada (lib/spyengine/ladder.ts + lib/qqqengine/config.ts);
 * bu uç yalnızca mumları, seans bilgisini, seviyeleri ve RVOL tabanını sağlar.
 *
 * `?since=<ts>` delta modu, `?date=YYYY-MM-DD` geçmiş seans oynatma (Yahoo 1m ~5 gün).
 * Kimlik: /api/* proxy.ts matcher'ının dışında olduğu için boga_auth satır içi (bkz. frontend/AGENTS.md §3).
 */

import { NextRequest, NextResponse } from "next/server";
import { isStaffAuthed } from "@/lib/apiAuth";
import {
  detectSession, barsOfSessionDay, bucketAggregate, toCompact, nyDateTimeToEpoch, nyParts, sessionVwap, atr, lastNum,
  isRthBar, r2, PRE_OPEN_MIN, RTH_OPEN_MIN, RTH_CLOSE_MIN, POST_CLOSE_MIN, type Bar,
} from "@/lib/spyengine/core";
import { readLevels } from "@/lib/spyengine/levels";
import { closedBars } from "@/lib/spyengine/strategy";
import { fetchBundle, fetch5mHistory } from "@/lib/spyengine/market";
import { rvolBaseline } from "@/lib/spyengine/ladder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 30;

const SYMBOL = "QQQ";

let rvolCache: { key: string; value: { slot: number[]; cum: number[]; days: number } | null } | null = null;

function spotStats(sessionBars: Bar[], date: string) {
  const rth = sessionBars.filter(isRthBar);
  const pre = sessionBars.filter((b) => {
    const p = nyParts(b.time);
    return p.minutes >= PRE_OPEN_MIN && p.minutes < RTH_OPEN_MIN;
  });
  const hi = (arr: Bar[]) => (arr.length ? Math.max(...arr.map((b) => b.high)) : null);
  const lo = (arr: Bar[]) => (arr.length ? Math.min(...arr.map((b) => b.low)) : null);
  const vwapSeries = sessionVwap(sessionBars);
  const atrSeries = atr(sessionBars, 14);
  const sessionHigh = hi(sessionBars);
  const sessionLow = lo(sessionBars);
  const lastClose = sessionBars.length ? sessionBars[sessionBars.length - 1].close : null;
  return {
    date,
    rthHigh: hi(rth), rthLow: lo(rth), preHigh: hi(pre), preLow: lo(pre), sessionHigh, sessionLow,
    rangePct:
      sessionHigh != null && sessionLow != null && lastClose != null && sessionHigh > sessionLow
        ? r2(((lastClose - sessionLow) / (sessionHigh - sessionLow)) * 100) : null,
    vwap: (() => { const v = lastNum(vwapSeries); return v == null ? null : r2(v); })(),
    atr14: (() => { const v = lastNum(atrSeries); return v == null ? null : Math.round(v * 1000) / 1000; })(),
    volume: sessionBars.reduce((s, b) => s + (b.volume || 0), 0),
    rthVolume: rth.reduce((s, b) => s + (b.volume || 0), 0),
    barCount: sessionBars.length,
    firstBarTime: sessionBars.length ? sessionBars[0].time : null,
    lastBarTime: sessionBars.length ? sessionBars[sessionBars.length - 1].time : null,
  };
}

export async function GET(req: NextRequest) {
  if (!isStaffAuthed(req)) return NextResponse.json({ ok: false, error: "Yetkisiz" }, { status: 401 });

  const nowSec = Math.floor(Date.now() / 1000);
  const params = new URL(req.url).searchParams;
  const sinceParam = Number(params.get("since"));
  const since = Number.isFinite(sinceParam) && sinceParam > 0 ? sinceParam : null;
  const dateParam = params.get("date");
  const replayDate = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : null;

  try {
    const [bundle, hist] = await Promise.all([
      fetchBundle(SYMBOL),
      fetch5mHistory(SYMBOL).catch(() => ({ bars: [] as Bar[] })),
    ]);
    const liveSession = detectSession(bundle.m1, nowSec);
    const session: typeof liveSession = replayDate && replayDate !== liveSession.date
      ? {
          date: replayDate, phase: "CLOSED", isLive: false,
          note: `Geriye dönük oynatma — ${replayDate} seansı. Canlı akış duraklatıldı.`,
          rthOpen: nyDateTimeToEpoch(replayDate, RTH_OPEN_MIN),
          rthClose: nyDateTimeToEpoch(replayDate, RTH_CLOSE_MIN),
        }
      : liveSession;
    const evalNow = session.isLive ? nowSec : Math.min(nowSec, session.rthClose + 4 * 60 * 60);

    const sessionM1 = barsOfSessionDay(bundle.m1, session.date);
    const m5All = bundle.m5;
    const m15All = bundle.m15;
    const chartCutoff = nyDateTimeToEpoch(session.date, POST_CLOSE_MIN);
    const chartM1 = bundle.m1.filter((b) => b.time <= chartCutoff);
    const chartM5 = m5All.filter((b) => b.time <= chartCutoff);

    const cut = (bars: Bar[]) => (since ? bars.filter((b) => b.time >= since) : bars);
    const full = !since;
    const m1Out = cut(chartM1);
    const m5Out = cut(chartM5.length ? chartM5 : bucketAggregate(chartM1, 5));
    const m15Out = cut(m15All.slice(-260));

    const stats = spotStats(sessionM1, session.date);
    const lastBar = sessionM1.length ? sessionM1[sessionM1.length - 1] : null;
    let price: number | null = null;
    let priceTime: number | null = null;
    if (lastBar && bundle.marketTime != null) {
      if (lastBar.time >= bundle.marketTime) { price = lastBar.close; priceTime = lastBar.time; }
      else { price = bundle.marketPrice; priceTime = bundle.marketTime; }
    } else if (lastBar) { price = lastBar.close; priceTime = lastBar.time; }
    else if (bundle.marketPrice != null) { price = bundle.marketPrice; priceTime = bundle.marketTime; }
    const prevClose = bundle.previousClose;

    const c1 = closedBars(sessionM1, 1, evalNow), c5 = closedBars(m5All, 5, evalNow), c15 = closedBars(m15All, 15, evalNow);

    return NextResponse.json(
      {
        ok: true,
        symbol: SYMBOL,
        serverTime: nowSec,
        full,
        session,
        dataSource: { primary: "canlı piyasa verisi (premarket + aftermarket dahil)", overnight: bundle.overnightSource, sanitized: bundle.sanitized, errors: bundle.errors },
        spot: {
          price, priceTime, prevClose,
          change: price != null && prevClose != null ? r2(price - prevClose) : null,
          changePct: price != null && prevClose != null && prevClose !== 0 ? r2(((price - prevClose) / prevClose) * 100) : null,
          ...stats,
        },
        bars: { m1: toCompact(m1Out), m5: toCompact(m5Out), m15: toCompact(m15Out) },
        // SPY'a özgü kalibre kapanış bandı QQQ için yok (uydurma yok)
        forecast: null,
        levels: readLevels({ sessionM1, allM1: bundle.m1, date: session.date, prevClose, nowSec: evalNow }),
        lastClosed: {
          m1: c1.length ? c1[c1.length - 1].time : null,
          m5: c5.length ? c5[c5.length - 1].time : null,
          m15: c15.length ? c15[c15.length - 1].time : null,
        },
        openPosition: null,
        events: [],
        rvolBase: (() => {
          const key = `${session.date}:${hist.bars.length}:${hist.bars[hist.bars.length - 1]?.time ?? 0}`;
          if (rvolCache?.key === key) return rvolCache.value;
          const b = rvolBaseline(hist.bars, session.date);
          const value = b ? { slot: b.slot.map(Math.round), cum: b.cum.map(Math.round), days: b.days } : null;
          rvolCache = { key, value };
          return value;
        })(),
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message, serverTime: nowSec }, { status: 500 });
  }
}
