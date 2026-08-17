/**
 * GET /api/technical-analyst-consensus?ticker=MU&lang=tr
 *
 * "Teknik ve Analist Görünümü" panelinin GERÇEK veri katmanı. Önceki sürüm
 * (bkz. eski TechnicalAnalystConsensus.tsx) ticker adının hash'inden
 * tamamen SAHTE (seeded-random) sayılar üretiyordu — bu route onun yerini
 * alır.
 *
 * Önbellek: earnings_reports (0022) ile birebir aynı desen —
 * technical_analyst_consensus tablosunda ticker başına TEK satır, 30 gün
 * boyunca geçerli. Bir ticker ilk kez sorgulandığında (ya da satır 30
 * günden eskiyse) Yahoo Finance'ten GERÇEK günlük bar + analist verisi
 * çekilir, 26 gösterge hesaplanır, DeepSeek'ten kısa bir sentez metni
 * istenir ve satır upsert edilir. O andan sonraki TÜM kullanıcılar (ilk
 * sorgulayan kim olursa olsun) 30 gün boyunca AYNI satırı okur — hiçbir
 * istek Yahoo/DeepSeek'i tekrar tetiklemez.
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { resolveYahooSymbol } from "@/lib/symbols";
import { computeTechnicalConsensus, type OhlcvSeries } from "@/lib/indicators/technicalConsensus";
import { getRealAnalystConsensus } from "@/lib/analystConsensus/yahooAnalystData";
import { synthesizeConsensusWithDeepSeek, CONSENSUS_LOCALES, type ConsensusLocale } from "@/lib/analystConsensus/deepseekSynthesis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CACHE_DAYS = 30;

const inFlight = new Map<string, Promise<any>>();

async function fetchDailyBars(yahooSymbol: string): Promise<OhlcvSeries | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?range=2y&interval=1d`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(10000),
      }
    );
    if (!res.ok) return null;
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result) return null;
    const quote = result.indicators?.quote?.[0] ?? {};
    const rawCloses: (number | null)[] = quote.close ?? [];
    const rawHighs: (number | null)[] = quote.high ?? [];
    const rawLows: (number | null)[] = quote.low ?? [];
    const rawVolumes: (number | null)[] = quote.volume ?? [];
    const out: OhlcvSeries = { closes: [], highs: [], lows: [], volumes: [] };
    for (let i = 0; i < rawCloses.length; i++) {
      if (rawCloses[i] == null || rawHighs[i] == null || rawLows[i] == null) continue;
      out.closes.push(rawCloses[i] as number);
      out.highs.push(rawHighs[i] as number);
      out.lows.push(rawLows[i] as number);
      out.volumes.push((rawVolumes[i] as number) ?? 0);
    }
    return out.closes.length >= 30 ? out : null;
  } catch {
    return null;
  }
}

async function computeAndStore(ticker: string) {
  const yahooSymbol = resolveYahooSymbol(ticker);
  const [series, analyst] = await Promise.all([
    fetchDailyBars(yahooSymbol),
    getRealAnalystConsensus(yahooSymbol),
  ]);

  if (!series) {
    return { error: "Yahoo Finance'ten yeterli geçmiş veri alınamadı" };
  }

  const tech = computeTechnicalConsensus(series);
  const currentPrice = series.closes[series.closes.length - 1];

  const aiSummary = await synthesizeConsensusWithDeepSeek(ticker, {
    oscPos: tech.oscPos, oscNeu: tech.oscNeu, oscNeg: tech.oscNeg,
    maPos: tech.maPos, maNeu: tech.maNeu, maNeg: tech.maNeg,
    hasAnalystCoverage: analyst.hasCoverage,
    analystStrongBuy: analyst.strongBuy, analystBuy: analyst.buy, analystHold: analyst.hold,
    analystSell: analyst.sell, analystStrongSell: analyst.strongSell,
    targetMean: analyst.targetMean, currentPrice,
  });

  const row = {
    ticker: ticker.toUpperCase(),
    price_at_computation: currentPrice,
    osc_pos: tech.oscPos, osc_neu: tech.oscNeu, osc_neg: tech.oscNeg,
    ma_pos: tech.maPos, ma_neu: tech.maNeu, ma_neg: tech.maNeg,
    indicators: { oscillators: tech.oscillators, movingAverages: tech.movingAverages },
    has_analyst_coverage: analyst.hasCoverage,
    analyst_strong_buy: analyst.strongBuy,
    analyst_buy: analyst.buy,
    analyst_hold: analyst.hold,
    analyst_sell: analyst.sell,
    analyst_strong_sell: analyst.strongSell,
    analyst_count: analyst.count,
    target_mean: analyst.targetMean,
    target_low: analyst.targetLow,
    target_high: analyst.targetHigh,
    target_median: analyst.targetMedian,
    ai_summary: aiSummary,
    computed_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseAdmin
    .from("technical_analyst_consensus")
    .upsert(row, { onConflict: "ticker" })
    .select()
    .maybeSingle();

  if (error) {
    console.error("[technical-analyst-consensus] upsert hatası:", error.message);
    return { row };
  }
  return { row: data ?? row };
}

function toResponse(row: any, lang: ConsensusLocale) {
  const summary = row.ai_summary && typeof row.ai_summary === "object" ? row.ai_summary[lang]?.summary ?? row.ai_summary["en"]?.summary ?? "" : "";
  return {
    ok: true,
    ticker: row.ticker,
    computedAt: row.computed_at,
    priceAtComputation: row.price_at_computation,
    technical: {
      oscPos: row.osc_pos, oscNeu: row.osc_neu, oscNeg: row.osc_neg,
      maPos: row.ma_pos, maNeu: row.ma_neu, maNeg: row.ma_neg,
      pos: row.osc_pos + row.ma_pos, neu: row.osc_neu + row.ma_neu, neg: row.osc_neg + row.ma_neg,
      indicators: row.indicators ?? null,
    },
    analyst: {
      hasCoverage: row.has_analyst_coverage,
      strongBuy: row.analyst_strong_buy ?? 0,
      buy: row.analyst_buy ?? 0,
      hold: row.analyst_hold ?? 0,
      sell: row.analyst_sell ?? 0,
      strongSell: row.analyst_strong_sell ?? 0,
      count: row.analyst_count ?? 0,
      targetMean: row.target_mean,
      targetLow: row.target_low,
      targetHigh: row.target_high,
      targetMedian: row.target_median,
    },
    aiSummary: summary,
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tickerRaw = (searchParams.get("ticker") || "").trim().toUpperCase();
  const langParam = (searchParams.get("lang") || "en").toLowerCase();
  const lang: ConsensusLocale = (CONSENSUS_LOCALES as readonly string[]).includes(langParam) ? (langParam as ConsensusLocale) : "en";

  if (!tickerRaw || !/^[A-Z0-9.\-]{1,12}$/.test(tickerRaw)) {
    return NextResponse.json({ ok: false, error: "Geçersiz ticker" }, { status: 400 });
  }

  try {
    const cutoff = new Date(Date.now() - CACHE_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { data: cached } = await supabaseAdmin
      .from("technical_analyst_consensus")
      .select("*")
      .eq("ticker", tickerRaw)
      .gte("computed_at", cutoff)
      .maybeSingle();

    if (cached) {
      return NextResponse.json(toResponse(cached, lang), { headers: { "Cache-Control": "no-store" } });
    }

    let promise = inFlight.get(tickerRaw);
    if (!promise) {
      promise = computeAndStore(tickerRaw).finally(() => inFlight.delete(tickerRaw));
      inFlight.set(tickerRaw, promise);
    }
    const result = await promise;
    if (result.error) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
    }
    return NextResponse.json(toResponse(result.row, lang), { headers: { "Cache-Control": "no-store" } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    console.error("[technical-analyst-consensus] hata:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
