/**
 * SPY Engine V2 — Public ticker mini grafik verisi.
 * Son 20 günlük 1d mum (OHLC) + tam seriden hesaplanan EMA21 değeri.
 *
 * EMA21 doğru çıksın diye 3 aylık seri çekilir, EMA tüm seri üzerinde
 * hesaplanır, sonra son 20 mum dilimlenir. 21 mumdan az veri varsa
 * ema alanı null döner — uydurma değer üretilmez.
 */

import { NextRequest, NextResponse } from "next/server";
import { fetchChart } from "@/lib/spyengine/market";
import { ema } from "@/lib/spyengine/core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 15;

const WINDOW = 20;

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol");
  if (!symbol) {
    return NextResponse.json({ ok: false, error: "symbol gerekli" }, { status: 400 });
  }

  try {
    const chart = await fetchChart(symbol, "1d", "6mo", false, 600000);

    if (chart.error) {
      return NextResponse.json({ ok: false, error: chart.error }, { status: 502 });
    }
    if (!chart.bars.length) {
      return NextResponse.json({ ok: false, error: "mum verisi yok" }, { status: 404 });
    }

    const closes = chart.bars.map((b) => b.close);
    const ema21 = ema(closes, 21);
    const start = Math.max(0, chart.bars.length - WINDOW);

    const bars = chart.bars.slice(start).map((b, i) => ({
      time: b.time,
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
      ema: ema21[start + i] ?? null,
    }));

    return NextResponse.json(
      { ok: true, symbol, bars },
      { headers: { "Cache-Control": "public, max-age=300" } }
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
