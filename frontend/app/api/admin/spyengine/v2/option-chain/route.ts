/**
 * SPY Engine V2 — canlı opsiyon zinciri + SL/TP hesaplayıcı beslemesi.
 *
 * SL/TP Hesaplayıcı ekranını (SPY Option sekmesi altı) besler:
 *   • Canlı SPY spot (Yahoo)
 *   • Canlı 15m ve 5m ATR(14) — gerçek barlardan hesaplanır (uydurma yok)
 *   • Son tamamlanmış 15m dip/tepe (stop referansı)
 *   • 0DTE'den 5 takvim gününe kadar opsiyon zinciri: strike, prim (bid/ask/mid),
 *     IV ve Black-Scholes delta (optionMath.bsDelta, IV yoksa null)
 *
 * Salt okunur; Task Scheduler / Supabase / Python servisine dokunmaz. Yahoo
 * rate-limit'ini korumak için zincir 60 sn önbellekli (market.TTL.chain).
 * Kimlik: /api/* proxy dışında olduğu için isStaffAuthed satır içi kontrol.
 */

import { NextRequest, NextResponse } from "next/server";
import { isStaffAuthed } from "@/lib/apiAuth";
import { fetchSpyBundle, fetchSpy5mHistory, fetchSpyOptionChainMulti } from "@/lib/spyengine/market";
import { atr, bucketAggregate, lastNum, nyParts, r2, type Bar } from "@/lib/spyengine/core";
import { bsDelta } from "@/lib/spyengine/optionMath";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 30;

interface OutRow {
  contractSymbol: string;
  strike: number;
  isCall: boolean;
  premiumAsk: number | null;
  premiumMid: number | null;
  bid: number | null;
  ask: number | null;
  iv: number | null;
  delta: number | null;
}

/** Son tamamlanmış 15m mumun dip/tepesi (stop referansı). */
function last15mSwing(m15: Bar[]): { low: number | null; high: number | null } {
  // Son eleman canlı (kapanmamış) olabilir → bir öncekini al.
  const idx = m15.length - 2 >= 0 ? m15.length - 2 : m15.length - 1;
  const b = m15[idx];
  if (!b) return { low: null, high: null };
  return { low: r2(b.low), high: r2(b.high) };
}

export async function GET(req: NextRequest) {
  if (!isStaffAuthed(req)) {
    return NextResponse.json({ ok: false, error: "Yetkisiz" }, { status: 401 });
  }
  try {
    const bundle = await fetchSpyBundle();
    const spot =
      bundle.marketPrice ??
      (bundle.m5.length ? bundle.m5[bundle.m5.length - 1].close : null) ??
      (bundle.m1.length ? bundle.m1[bundle.m1.length - 1].close : null);

    if (spot == null || !(spot > 0)) {
      return NextResponse.json(
        { ok: false, error: "SPY spot fiyatı alınamadı" },
        { status: 502 }
      );
    }

    // ATR(14): 5m doğrudan; 15m için 5m geçmişini 15m'e topla (daha uzun
    // ısınma için m5History; yoksa bundle.m5'e düş).
    const hist = await fetchSpy5mHistory();
    const m5 = hist.bars.length ? hist.bars : bundle.m5;
    const m15 = bucketAggregate(m5, 15);
    const atr5m = lastNum(atr(m5, 14));
    const atr15m = lastNum(atr(m15, 14));
    const swing = last15mSwing(bundle.m15.length ? bundle.m15 : m15);

    const chain = await fetchSpyOptionChainMulti(spot, 5, 6);
    const nowSec = Math.floor(Date.now() / 1000);

    const toOut = (rows: import("@/lib/spyengine/market").ChainRow[], expiryEpoch: number): OutRow[] =>
      rows.map((r) => {
        // Kalan süre (yıl) — vade 16:00 ET kapanışına kadar kabul edilir.
        const tYears = Math.max(0, (expiryEpoch - nowSec)) / (365 * 24 * 3600);
        const iv = r.impliedVolatility;
        const delta = iv != null ? bsDelta(r.isCall, spot, r.strike, tYears || 1 / (365 * 24), iv) : null;
        return {
          contractSymbol: r.contractSymbol,
          strike: r.strike,
          isCall: r.isCall,
          premiumAsk: r.ask,
          premiumMid: r.mid,
          bid: r.bid,
          ask: r.ask,
          iv,
          delta: delta != null ? Math.round(delta * 1000) / 1000 : null,
        };
      });

    const expiries = chain.map((e) => ({
      expiryEpoch: e.expiryEpoch,
      expiryDate: e.expiryDate,
      dte: e.dte,
      calls: toOut(e.calls, e.expiryEpoch),
      puts: toOut(e.puts, e.expiryEpoch),
    }));

    return NextResponse.json(
      {
        ok: true,
        serverTime: nowSec,
        spot: r2(spot),
        atr15m: atr15m != null ? r2(atr15m) : null,
        atr5m: atr5m != null ? r2(atr5m) : null,
        last15mLow: swing.low,
        last15mHigh: swing.high,
        expiries,
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
