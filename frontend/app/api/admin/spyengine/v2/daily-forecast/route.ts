/**
 * SPY Engine V2 — Otomatik Günlük Tahmin (Daily Forecast) beslemesi.
 *
 * Şimdiki (piyasa açıksa) veya sonraki (kapalıysa) NY seansının 09:30–16:00
 * en-olası saatlik yolunu üretir. Kaynaklar: SPY 15m EMA21/VWAP/ATR yapısı +
 * ES=F gece hareketi + Kalshi ima edilen kapanış + VIX + NASDAQ. Çıktı bir
 * TAHMİNDİR (dailyForecastEngine, tek en-olası yol), ölçüm değil.
 *
 * Salt okunur; Task Scheduler/Supabase/Python'a dokunmaz. NY saat/tarih
 * etiketleri gerçek epoch üzerinden (nyDateTimeToEpoch) üretilir.
 */

import { NextRequest, NextResponse } from "next/server";
import { isStaffAuthed } from "@/lib/apiAuth";
import { fetchSpyBundle, fetchChart, TTL } from "@/lib/spyengine/market";
import {
  atr, ema, sessionVwap, bucketAggregate, lastNum, nyParts, nyDateTimeToEpoch,
  isRthBar, RTH_OPEN_MIN, RTH_CLOSE_MIN, r2, type Bar,
} from "@/lib/spyengine/core";
import { fetchKalshiSpxLadder } from "@/lib/spyengine/kalshi";
import { buildDailyForecast, type ForecastInputs } from "@/lib/spyengine/dailyForecastEngine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 30;

/** Hedef seans NY tarihi: hafta içi & 16:00'dan önce → bugün, aksi → sonraki iş günü. */
function targetSessionDate(nowSec: number): string {
  const p = nyParts(nowSec);
  const isWeekday = p.weekday >= 1 && p.weekday <= 5;
  if (isWeekday && p.minutes < RTH_CLOSE_MIN) return p.ymd;
  // sonraki iş gününe ilerle
  let t = nowSec;
  for (let i = 0; i < 5; i++) {
    t += 24 * 3600;
    const q = nyParts(t);
    if (q.weekday >= 1 && q.weekday <= 5) return q.ymd;
  }
  return p.ymd;
}

function changePctOf(marketPrice: number | null, prevClose: number | null): number | null {
  if (marketPrice == null || prevClose == null || prevClose <= 0) return null;
  return (marketPrice - prevClose) / prevClose;
}

export async function GET(req: NextRequest) {
  if (!isStaffAuthed(req)) {
    return NextResponse.json({ ok: false, error: "Yetkisiz" }, { status: 401 });
  }
  try {
    const nowSec = Math.floor(Date.now() / 1000);
    const targetDate = targetSessionDate(nowSec);

    const [bundle, es, vixC, ndx, spx] = await Promise.all([
      fetchSpyBundle(),
      fetchChart("ES=F", "5m", "5d", true, TTL.m5),
      fetchChart("^VIX", "5m", "1d", false, TTL.m5),
      fetchChart("^IXIC", "5m", "1d", false, TTL.m5),
      fetchChart("^GSPC", "5m", "1d", false, TTL.m5),
    ]);

    const spyPrevClose = bundle.previousClose ?? (bundle.m15.length ? bundle.m15[0].open : null);
    if (spyPrevClose == null || !(spyPrevClose > 0)) {
      return NextResponse.json({ ok: false, error: "SPY önceki kapanış alınamadı" }, { status: 502 });
    }

    // 15m yapı: EMA21 eğimi, VWAP konumu, ATR
    const m15 = bundle.m15.length ? bundle.m15 : bucketAggregate(bundle.m5, 15);
    const closes15 = m15.map((b) => b.close);
    const ema21 = ema(closes15, 21);
    const e0 = lastNum(ema21);
    const e1 = ema21.length >= 2 ? ema21[ema21.length - 2] : null;
    const ema21Slope = e0 != null && e1 != null ? e0 - e1 : null;
    const atr15m = lastNum(atr(m15, 14));
    const vw = sessionVwap(m15.filter((b) => nyParts(b.time).ymd === targetDate));
    const lastVwap = lastNum(vw);
    const lastClose15 = closes15.length ? closes15[closes15.length - 1] : null;
    const aboveVwap = lastClose15 != null && lastVwap != null ? lastClose15 > lastVwap : null;

    // Bugünkü seans açıldıysa gerçekleşen açılış (ilk RTH 15m barı)
    const todayRth = m15.filter((b) => nyParts(b.time).ymd === targetDate && isRthBar(b));
    const sessionOpenActual = todayRth.length ? todayRth[0].open : null;

    // Kalshi ima edilen kapanış (SPX) → SPY (spot oranıyla)
    const spxSpot = spx.marketPrice ?? (spx.bars.length ? spx.bars[spx.bars.length - 1].close : null);
    const spySpot = bundle.marketPrice ?? lastClose15;
    const ratio = spxSpot != null && spySpot != null && spxSpot > 0 ? spySpot / spxSpot : null;
    const ladder = await fetchKalshiSpxLadder(targetDate);
    const kalshiImpliedCloseSpy =
      ladder?.impliedCloseSpx != null && ratio != null ? ladder.impliedCloseSpx * ratio : null;

    const inputs: ForecastInputs = {
      spyPrevClose,
      esChangePct: changePctOf(es.marketPrice, es.previousClose),
      vix: vixC.marketPrice ?? (vixC.bars.length ? vixC.bars[vixC.bars.length - 1].close : null),
      nasdaqChangePct: changePctOf(ndx.marketPrice, ndx.previousClose),
      kalshiImpliedCloseSpy,
      ema21Slope,
      aboveVwap,
      atr15m,
      liveSpot: spySpot,
      sessionOpenActual,
    };

    const forecast = buildDailyForecast(inputs);

    // Epoch'a çevrilmiş yol (NY saat etiketleri için)
    const path = forecast.path.map((pt) => ({
      time: nyDateTimeToEpoch(targetDate, pt.minutesEt),
      open: pt.open, high: pt.high, low: pt.low, close: pt.close,
    }));

    // Gerçekleşen (bugünkü seans açıldıysa) — 30dk kapanışları
    const actual = todayRth.length
      ? bucketAggregate(todayRth, 30).map((b) => ({
          time: b.time, open: r2(b.open), high: r2(b.high), low: r2(b.low), close: r2(b.close),
        }))
      : [];

    return NextResponse.json(
      {
        ok: true,
        serverTime: nowSec,
        targetDate,
        marketOpen: sessionOpenActual != null,
        spyPrevClose: r2(spyPrevClose),
        spySpot: spySpot != null ? r2(spySpot) : null,
        forecast: {
          openEstimate: forecast.openEstimate,
          closeTarget: forecast.closeTarget,
          expectedRangePct: forecast.expectedRangePct,
          direction: forecast.direction,
          confidence: forecast.confidence,
          narrative: forecast.narrative,
          votes: forecast.votes,
        },
        kalshi: ladder
          ? { eventTicker: ladder.eventTicker, impliedCloseSpx: ladder.impliedCloseSpx, impliedCloseSpy: kalshiImpliedCloseSpy != null ? r2(kalshiImpliedCloseSpy) : null }
          : null,
        inputs: {
          esChangePct: inputs.esChangePct,
          vix: inputs.vix,
          nasdaqChangePct: inputs.nasdaqChangePct,
          ema21Slope: inputs.ema21Slope != null ? r2(inputs.ema21Slope) : null,
          aboveVwap: inputs.aboveVwap,
          atr15m: inputs.atr15m != null ? r2(inputs.atr15m) : null,
        },
        path,
        actual,
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
