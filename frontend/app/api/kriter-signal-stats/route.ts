import { NextRequest, NextResponse } from "next/server";
import { readPublicJson } from "@/lib/data-server";
import {
  getLastNReportDays,
  readArchiveForDate,
  enrichTrade,
  computeSignalMatrix,
  computeAggregateStats,
  type PerformanceTrade,
  type EnrichedTrade,
} from "@/lib/kriter-helpers";
import { formatNumber } from "@/lib/formatNumber";

export const runtime = "nodejs";

// 30 dakikalık in-memory cache
const cache = new Map<string, { ts: number; data: unknown }>();
const CACHE_TTL = 30 * 60 * 1000;

export async function GET(req: NextRequest) {
  try {
    const days = parseInt(req.nextUrl.searchParams.get("days") ?? "10");
    const cacheKey = `signal_stats_${days}`;

    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      return NextResponse.json(cached.data, {
        headers: { "X-Cache": "HIT" },
      });
    }

    const perfData = readPublicJson("swing_performance.json");
    if (!perfData?.history) {
      return NextResponse.json({ error: "Veri yüklenemedi" }, { status: 503 });
    }

    const allHistory: PerformanceTrade[] = perfData.history;
    const reportDays = getLastNReportDays(allHistory, days);
    const filteredTrades = allHistory.filter((t) => reportDays.includes(t.date));

    const archiveByDate: Record<string, ReturnType<typeof readArchiveForDate>> = {};
    for (const date of reportDays) {
      archiveByDate[date] = readArchiveForDate(date);
    }

    const enrichedTrades: EnrichedTrade[] = filteredTrades.map((t) =>
      enrichTrade(t, archiveByDate[t.date] ?? null)
    );

    const stats = computeAggregateStats(enrichedTrades, reportDays);
    const signal_matrix = computeSignalMatrix(enrichedTrades);

    // Sektör bazlı istatistikler
    const sectorMap = new Map<string, { win: number; loss: number; pending: number }>();
    for (const t of enrichedTrades) {
      const sector = t.sector ?? "Unknown";
      if (!sectorMap.has(sector)) sectorMap.set(sector, { win: 0, loss: 0, pending: 0 });
      const entry = sectorMap.get(sector)!;
      if (t.result === "WIN") entry.win++;
      else if (t.result === "LOSS") entry.loss++;
      else entry.pending++;
    }

    const sector_stats = Array.from(sectorMap.entries()).map(([sector, data]) => {
      const completed = data.win + data.loss;
      return {
        sector,
        total: data.win + data.loss + data.pending,
        win: data.win,
        loss: data.loss,
        pending: data.pending,
        win_rate: completed > 0 ? +((((data.win / completed) * 100)).toFixed(1)) : 0,
      };
    }).sort((a, b) => b.total - a.total);

    const result = {
      stats,
      signal_matrix,
      sector_stats,
      report_days: reportDays,
      generated_at: new Date().toISOString(),
    };

    cache.set(cacheKey, { ts: Date.now(), data: result });

    return NextResponse.json(result, {
      headers: { "X-Cache": "MISS" },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Server error" }, { status: 500 });
  }
}
