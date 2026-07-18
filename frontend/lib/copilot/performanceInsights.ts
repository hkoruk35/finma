import { getSwingPerformance } from "@/lib/data";
import { ct } from "@/lib/copilot/i18n";

export interface PerformanceInsights {
  periodLabel: string;
  totalTrades: number;
  winRate: number;
  avgReturnPct: number;
  topPerformers: Array<{
    ticker: string;
    company: string;
    sector: string;
    returnPct: number;
    days: number;
    date: string;
  }>;
  worstPerformers: Array<{
    ticker: string;
    company: string;
    sector: string;
    returnPct: number;
    days: number;
    date: string;
  }>;
  sectorBreakdown: Record<string, { count: number; avgReturnPct: number; winRate: number }>;
  systemWinRate: number;
  systemAvgReturnPct: number;
}

/**
 * Zaman aralığına göre geçmiş işlemleri filtrele.
 * daysBack: kaç gün öncesinden itibaren (0 = tümü)
 */
function filterByDaysBack(trades: any[], daysBack: number = 0): any[] {
  if (daysBack === 0) return trades;

  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - daysBack);

  return trades.filter((t) => {
    if (!t.date) return false;
    try {
      const tradeDate = new Date(t.date);
      return tradeDate >= cutoff;
    } catch {
      return false;
    }
  });
}

export async function getPerformanceInsights(
  daysBack: number = 0,
  locale: string = "en"
): Promise<PerformanceInsights | null> {
  try {
    const perfData = await getSwingPerformance();
    if (!perfData?.history || !Array.isArray(perfData.history)) {
      return null;
    }

    // Zaman filtresi uygula — daysBack=0 → tüm history, daysBack=7 → son 7 gün
    const filtered = filterByDaysBack(perfData.history, daysBack);
    if (filtered.length === 0) {
      return null;
    }

    // Sort by date descending (en yeni önce)
    const sorted = [...filtered].sort((a, b) => (b.date || "").localeCompare(a.date || ""));

    // Top performers (highest return)
    const topPerformers = sorted
      .filter((t) => t.result === "WIN" || t.return_pct > 0)
      .sort((a, b) => (b.return_pct ?? 0) - (a.return_pct ?? 0))
      .slice(0, 5)
      .map((t) => ({
        ticker: t.ticker,
        company: t.company || "N/A",
        sector: t.sector || "N/A",
        returnPct: t.return_pct,
        days: t.days,
        date: t.date,
      }));

    // Worst performers (lowest return)
    const worstPerformers = sorted
      .filter((t) => t.result === "LOSS" || t.return_pct < 0)
      .sort((a, b) => (a.return_pct ?? 0) - (b.return_pct ?? 0))
      .slice(0, 5)
      .map((t) => ({
        ticker: t.ticker,
        company: t.company || "N/A",
        sector: t.sector || "N/A",
        returnPct: t.return_pct,
        days: t.days,
        date: t.date,
      }));

    // Win rate ve avg return
    const completedTrades = sorted.filter((t) => t.result === "WIN" || t.result === "LOSS");
    const wins = completedTrades.filter((t) => t.result === "WIN").length;
    const winRate =
      completedTrades.length > 0 ? Math.round((wins / completedTrades.length) * 100 * 10) / 10 : 0;
    const avgReturnPct =
      sorted.length > 0
        ? Math.round((sorted.reduce((sum, t) => sum + (t.return_pct ?? 0), 0) / sorted.length) * 100) / 100
        : 0;

    // Sector breakdown
    const sectorMap: Record<string, { count: number; sumReturn: number; wins: number }> = {};
    sorted.forEach((t) => {
      const sector = t.sector || "Unknown";
      if (!sectorMap[sector]) {
        sectorMap[sector] = { count: 0, sumReturn: 0, wins: 0 };
      }
      sectorMap[sector].count++;
      sectorMap[sector].sumReturn += t.return_pct ?? 0;
      if (t.result === "WIN") sectorMap[sector].wins++;
    });

    const sectorBreakdown: Record<string, { count: number; avgReturnPct: number; winRate: number }> = {};
    Object.entries(sectorMap).forEach(([sector, data]) => {
      sectorBreakdown[sector] = {
        count: data.count,
        avgReturnPct: Math.round((data.sumReturn / data.count) * 100) / 100,
        winRate: Math.round((data.wins / data.count) * 100 * 10) / 10,
      };
    });

    // System-wide stats (all-time)
    const systemWinRate = perfData.stats?.win_rate ?? 0;
    const systemAvgReturnPct = perfData.stats?.avg_return_pct ?? 0;

    // Period label
    let periodLabel = "Tüm Zaman";
    if (daysBack === 7) periodLabel = "Geçen 7 Gün";
    else if (daysBack === 30) periodLabel = "Geçen 30 Gün";
    else if (daysBack === 90) periodLabel = "Geçen 90 Gün";

    return {
      periodLabel,
      totalTrades: sorted.length,
      winRate,
      avgReturnPct,
      topPerformers,
      worstPerformers,
      sectorBreakdown,
      systemWinRate,
      systemAvgReturnPct,
    };
  } catch (error) {
    console.error("[performanceInsights]", error);
    return null;
  }
}

/**
 * System prompt'a yapıştırılacak performance summary.
 * Top performers, sector breakdown gibi quick facts.
 */
export async function getPerformanceSummaryForPrompt(locale: string = "en"): Promise<string> {
  const insights = await getPerformanceInsights(0, locale);
  if (!insights) {
    return "";
  }

  const topTickersStr = insights.topPerformers.slice(0, 3)
    .map((t) => `$${t.ticker} (+${t.returnPct}%, ${t.days} gün)`)
    .join(", ");

  const bestSectorStr = Object.entries(insights.sectorBreakdown)
    .sort((a, b) => (b[1].avgReturnPct ?? 0) - (a[1].avgReturnPct ?? 0))
    .slice(0, 2)
    .map(([sector, data]) => `${sector} (${data.avgReturnPct}% ort., ${data.count} işlem)`)
    .join(", ");

  return `BOGA SWING MOTOR PERFORMANSI (${insights.periodLabel}):
- Toplam İşlem (Görmek): ${insights.totalTrades}
- Kazanma Oranı: %${insights.winRate} (Sistem Geneli: %${insights.systemWinRate})
- Ort. Getiri: %${insights.avgReturnPct} (Sistem Geneli: %${insights.systemAvgReturnPct})
- En Çok Kar Eden: ${topTickersStr}
- En Güçlü Sektörler: ${bestSectorStr}

Kullanıcı "geçen hafta", "geçen ay" vb. sorduğunda, get_performance_insights aracını çağır.`;
}
