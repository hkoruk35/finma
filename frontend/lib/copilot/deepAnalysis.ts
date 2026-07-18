// Copilot'un "get_deep_analysis" aracının veri kaynağı — bilanço/temel veriler,
// insider aktivitesi, sektör bağlamı, haberler ve BOGA'nın bu ticker'da GERÇEKTEN
// yaptığı geçmiş işlemlerin performansı (swing_performance.json). Hepsi site
// genelinde zaten kullanılan gerçek veri kaynaklarından okunur — uydurma yok.

import { getStockData, getSwingPerformance } from "@/lib/data";
import { ct } from "@/lib/copilot/i18n";
import { getLiveAnalysis } from "@/lib/copilot/liveAnalysis";

export interface CopilotDeepAnalysis {
  ticker: string;
  fundamental: {
    peRatio: number | null;
    marketCapUsd: number | null;
    revenueGrowthTtm: number | null;
    grossMargin: number | null;
    operatingMargin: number | null;
    netMargin: number | null;
    fcfYield: number | null;
    institutionalOwnershipPct: number | null;
    dividendYield: number | null;
  } | null;
  insiderActivity: {
    last90DaysBuys: number;
    last90DaysSells: number;
    netDirection: string;
  } | null;
  sectorContext: {
    sectorEtf: string;
    sectorPerformance5d: number;
  } | null;
  recentNews: { headline: string; source: string; sentiment: string }[];
  performanceHistory: {
    tickerTradeCount: number;
    tickerWinRate: number | null;
    recentTrades: { date: string; result: string; returnPct: number; days: number }[];
    systemOverallWinRate: number | null;
    systemOverallAvgReturnPct: number | null;
  } | null;
  // Curated bilanço verisi olmayan (havuz-dışı) hisseler için canlı BOGA
  // teknik analizi — grafik motorundan (preorder-analysis) gerçek sayılar.
  liveTechnical: {
    price: number;
    changePct: number;
    conviction: number;
    recommendation: string;
    bogaScore: { trend: number; momentum: number; liquidity: number };
    momentum: { macd: number; adx: number; roc10: number };
    rvol: number;
    weinsteinStage: string;
    pct52h: number;
    return1y: number;
    wyckoff: string;
    activeSignals: string[];
    warnings: string[];
  } | null;
}

export async function getDeepAnalysis(ticker: string, lang: string = "en"): Promise<CopilotDeepAnalysis | null> {
  const t = ticker.trim().toUpperCase();
  if (!t || !/^[A-Z.\-]{1,6}$/.test(t)) return null;

  const [data, perf] = await Promise.all([getStockData(t), getSwingPerformance().catch(() => null)]);
  // Not: getStockData null dönebilir (BOGA'nın aktif dar tarama havuzunda değil —
  // ör. MU gibi gerçek ama şu an skorlanmayan bir hisse). Bu durumda fundamental/
  // insider/sector/news yok sayılır AMA geçmiş işlem performansı (swing_performance.json)
  // BAĞIMSIZ bir kaynak olduğu için yine de kontrol edilir — bot geçmişte bu hissede
  // işlem yapmış olabilir, o veriyi kaybetmeyelim.
  const hasCuratedData = !!data && !data.is_mock;

  const f = hasCuratedData ? (data!.fundamental as Record<string, any> | undefined) : undefined;
  const fundamental = f
    ? {
        peRatio: f.pe_ratio ?? null,
        marketCapUsd: f.market_cap ?? null,
        revenueGrowthTtm: f.revenue_growth_ttm ?? null,
        grossMargin: f.gross_margin ?? null,
        operatingMargin: f.operating_margin ?? null,
        netMargin: f.net_margin ?? null,
        fcfYield: f.fcf_yield ?? null,
        institutionalOwnershipPct: f.institutional_ownership_pct ?? null,
        dividendYield: f.dividend_yield ?? null,
      }
    : null;

  const ia = hasCuratedData ? data!.insider_activity : null;
  const insiderActivity =
    ia && typeof ia === "object"
      ? {
          last90DaysBuys: ia.last_90_days_buys ?? 0,
          last90DaysSells: ia.last_90_days_sells ?? 0,
          netDirection: ia.net_direction || ct("riskUnknown", lang),
        }
      : null;

  const sc = hasCuratedData ? data!.sector_context : null;
  const sectorContext =
    sc && typeof sc === "object" && sc.sector_etf
      ? { sectorEtf: sc.sector_etf, sectorPerformance5d: sc.sector_performance_5d ?? 0 }
      : null;

  const recentNews = hasCuratedData
    ? (data!.news || []).slice(0, 5).map((n: any) => ({
        headline: n.headline,
        source: n.source,
        sentiment: n.sentiment,
      }))
    : [];

  let performanceHistory: CopilotDeepAnalysis["performanceHistory"] = null;
  if (perf?.history) {
    const tickerTrades = (perf.history as any[])
      .filter((h) => h.ticker === t && !h.is_duplicate && h.result && h.result !== "PENDING")
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    if (tickerTrades.length > 0) {
      const wins = tickerTrades.filter((h) => h.result === "WIN").length;
      performanceHistory = {
        tickerTradeCount: tickerTrades.length,
        tickerWinRate: Math.round((wins / tickerTrades.length) * 1000) / 10,
        recentTrades: tickerTrades.slice(0, 5).map((h) => ({
          date: h.date,
          result: h.result,
          returnPct: h.return_pct,
          days: h.days,
        })),
        systemOverallWinRate: perf.stats?.win_rate ?? null,
        systemOverallAvgReturnPct: perf.stats?.avg_return_pct ?? null,
      };
    } else if (perf.stats) {
      performanceHistory = {
        tickerTradeCount: 0,
        tickerWinRate: null,
        recentTrades: [],
        systemOverallWinRate: perf.stats.win_rate ?? null,
        systemOverallAvgReturnPct: perf.stats.avg_return_pct ?? null,
      };
    }
  }

  // Curated bilanço/temel veri yoksa (havuz-dışı hisse), canlı BOGA teknik
  // analizini ekle — böylece MOH gibi bir hisse için de gerçek, site-tutarlı
  // teknik döner (uydurma değil, grafik sayfasıyla aynı motor).
  let liveTechnical: CopilotDeepAnalysis["liveTechnical"] = null;
  if (!fundamental) {
    const live = await getLiveAnalysis(t, lang);
    if (live) {
      liveTechnical = {
        price: live.price,
        changePct: live.changePct,
        conviction: Math.round(live.conviction),
        recommendation: live.recommendation?.label || "",
        bogaScore: live.bogaScore,
        momentum: { macd: live.momentum?.macd, adx: live.momentum?.adx, roc10: live.momentum?.roc10 },
        rvol: live.rvol,
        weinsteinStage: live.context?.weinstein?.label || "",
        pct52h: live.context?.pct52h,
        return1y: live.context?.stockReturn1y,
        wyckoff: live.wyckoff?.signal || "",
        activeSignals: live.activeSignals || [],
        warnings: live.warnings || [],
      };
    }
  }

  if (!fundamental && !insiderActivity && !sectorContext && recentNews.length === 0 && !performanceHistory && !liveTechnical) {
    return null;
  }

  return { ticker: t, fundamental, insiderActivity, sectorContext, recentNews, performanceHistory, liveTechnical };
}
