// Copilot'un "get_deep_analysis" aracının veri kaynağı — bilanço/temel veriler,
// insider aktivitesi, sektör bağlamı, haberler ve BOGA'nın bu ticker'da GERÇEKTEN
// yaptığı geçmiş işlemlerin performansı (swing_performance.json). Hepsi site
// genelinde zaten kullanılan gerçek veri kaynaklarından okunur — uydurma yok.

import { getStockData, getSwingPerformance } from "@/lib/data";
import { ct } from "@/lib/copilot/i18n";
import { getLiveAnalysis } from "@/lib/copilot/liveAnalysis";
import { getLiveFundamentals } from "@/lib/copilot/liveFundamentals";

export interface CopilotDeepAnalysis {
  ticker: string;
  // "curated": BOGA'nın statik taranmış havuzundan; "live": curated'da yok,
  // Yahoo Finance'ten canlı çekildi (KEEL gibi havuz-dışı ama gerçek hisseler
  // için) — model kaynağı kullanıcıya doğru şekilde belirtebilsin diye.
  fundamentalSource: "curated" | "live" | null;
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
    // Yalnızca canlı (havuz-dışı) kaynakta dolu olabilir:
    returnOnEquityPct?: number | null;
    debtToEquity?: number | null;
    currentRatio?: number | null;
    revenuePerShare?: number | null;
    earningsGrowthPct?: number | null;
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
  // Havuz-dışı hisselerde canlı kaynaktan gelen ek bağlam — üst düzey yönetim
  // ve analist konsensüsü (bilanço ile birlikte Yahoo'dan gelir).
  companyProfile: {
    companyName: string | null;
    sector: string | null;
    industry: string | null;
    topExecutives: { name: string; title: string }[];
    analystRecommendation: string | null;
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

  // Curated bilanço/temel veri yoksa (havuz-dışı hisse — KEEL gibi), canlı
  // BOGA teknik analizini VE canlı bilanço/insider/yönetici verisini ekle —
  // böylece havuz-dışı bir hisse için de "erişemiyorum" denmez, gerçek,
  // site-tutarlı veri döner (aynı Yahoo Finance kaynağı Derin Analiz
  // sayfasının kullandığı, uydurma değil).
  let liveTechnical: CopilotDeepAnalysis["liveTechnical"] = null;
  let fundamentalSource: CopilotDeepAnalysis["fundamentalSource"] = fundamental ? "curated" : null;
  let liveFundamental: CopilotDeepAnalysis["fundamental"] = null;
  let companyProfile: CopilotDeepAnalysis["companyProfile"] = null;
  let liveInsiderActivity: CopilotDeepAnalysis["insiderActivity"] = null;

  if (!fundamental) {
    const [live, liveF] = await Promise.all([
      getLiveAnalysis(t, lang),
      getLiveFundamentals(t).catch(() => null),
    ]);
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
    if (liveF) {
      fundamentalSource = "live";
      liveFundamental = {
        peRatio: liveF.peRatio,
        marketCapUsd: liveF.marketCapUsd,
        revenueGrowthTtm: liveF.revenueGrowthTtm,
        grossMargin: liveF.grossMargin,
        operatingMargin: liveF.operatingMargin,
        netMargin: liveF.netMargin,
        fcfYield: null,
        institutionalOwnershipPct: liveF.institutionalOwnershipPct,
        dividendYield: liveF.dividendYield,
        returnOnEquityPct: liveF.returnOnEquityPct,
        debtToEquity: liveF.debtToEquity,
        currentRatio: liveF.currentRatio,
        revenuePerShare: liveF.revenuePerShare,
        earningsGrowthPct: liveF.earningsGrowthPct,
      };
      companyProfile = {
        companyName: liveF.companyName,
        sector: liveF.sector,
        industry: liveF.industry,
        topExecutives: liveF.topExecutives,
        analystRecommendation: liveF.analystRecommendation,
      };
      if (liveF.insiderLast90DaysBuys > 0 || liveF.insiderLast90DaysSells > 0) {
        liveInsiderActivity = {
          last90DaysBuys: liveF.insiderLast90DaysBuys,
          last90DaysSells: liveF.insiderLast90DaysSells,
          netDirection: liveF.insiderNetDirection,
        };
      }
    }
  }

  const finalFundamental = fundamental || liveFundamental;
  const finalInsiderActivity = insiderActivity || liveInsiderActivity;

  if (
    !finalFundamental &&
    !finalInsiderActivity &&
    !sectorContext &&
    recentNews.length === 0 &&
    !performanceHistory &&
    !liveTechnical &&
    !companyProfile
  ) {
    return null;
  }

  return {
    ticker: t,
    fundamentalSource,
    fundamental: finalFundamental,
    insiderActivity: finalInsiderActivity,
    sectorContext,
    recentNews,
    performanceHistory,
    companyProfile,
    liveTechnical,
  };
}
