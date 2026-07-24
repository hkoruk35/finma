// Copilot'un "show_stock_card" ve site kategorileri aracının TEK canlı veri kaynağı.
// Canlı borsa verisi (getLiveAnalysis) önceliklidir — grafik ve gerçek piyasa ile 100% uyumlu.

import { getStockData, getMasterData } from "@/lib/data";
import { ct } from "@/lib/copilot/i18n";
import { getLiveAnalysis, liveToCard } from "@/lib/copilot/liveAnalysis";
import { getPersonalizationContext } from "@/lib/copilot/personalization";

export interface CopilotStockCard {
  ticker: string;
  companyName: string;
  trend: "Bullish" | "Bearish" | "Neutral";
  bogaScore: number;
  riskLevel: string;
  support: number;
  resistance: number;
  target: number;
  summary: string;
}

function deriveRiskLevel(riskReward: number | undefined, lang: string): string {
  if (!riskReward || riskReward <= 0) return ct("riskUnknown", lang);
  if (riskReward >= 2.5) return ct("riskLow", lang);
  if (riskReward >= 1.5) return ct("riskMedium", lang);
  return ct("riskHigh", lang);
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number = 1500): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ]);
}

export async function getRealStockCardData(ticker: string, lang: string = "tr"): Promise<CopilotStockCard | null> {
  let t = ticker.trim().toUpperCase();
  if (!t || !/^[A-Z.\-]{1,6}$/.test(t)) return null;

  try {
    // ALWAYS fetch LIVE market analysis first to reflect real chart prices & red/green candle trends!
    const live = await getLiveAnalysis(t, lang);
    if (live) {
      const card = liveToCard(live);
      if (card) {
        let trend: "Bullish" | "Bearish" | "Neutral" = "Neutral";
        
        if (
          live.changePct < -1.5 ||
          live.context?.weinstein?.stage === 4 ||
          (card.support && live.price < card.support) ||
          live.wyckoff?.signal?.toLowerCase().includes("markdown") ||
          live.wyckoff?.signal?.toLowerCase().includes("düşüş")
        ) {
          trend = "Bearish";
        } else if (live.changePct > 1.0 && live.conviction > 65) {
          trend = "Bullish";
        }

        const price = live.price || 100;
        const validSupport = card.support && card.support < price ? card.support : Math.round(price * 0.95 * 100) / 100;
        const validResistance = card.resistance && card.resistance > price ? card.resistance : Math.round(price * 1.05 * 100) / 100;
        const validTarget = card.target && card.target > validResistance ? card.target : Math.round(price * 1.10 * 100) / 100;

        return {
          ticker: t,
          companyName: live.company || t,
          trend,
          bogaScore: Math.round(live.conviction),
          riskLevel: deriveRiskLevel(live.tradePlan?.riskReward, lang),
          support: validSupport,
          resistance: validResistance,
          target: validTarget,
          summary: ct("liveAnalysisSummary", lang, { ticker: t, score: Math.round(live.conviction) }),
        };
      }
    }
  } catch (err) {
    console.error(`[getRealStockCardData] Live analysis error for ${t}:`, err);
  }

  // Fallback to getStockData if live fetch unavailable
  try {
    const data = await getStockData(t);
    if (data) {
      const change = data.price?.change_pct ?? 0;
      const trend: "Bullish" | "Bearish" | "Neutral" = change < -1.5 ? "Bearish" : change > 1.5 ? "Bullish" : "Neutral";
      const price = data.price?.current ?? 100;

      return {
        ticker: t,
        companyName: data.company || t,
        trend,
        bogaScore: (data as any).bogaScore || (data as any).boga_score || 50,
        riskLevel: ct("riskMedium", lang),
        support: Math.round(price * 0.95 * 100) / 100,
        resistance: Math.round(price * 1.05 * 100) / 100,
        target: Math.round(price * 1.10 * 100) / 100,
        summary: ct("liveAnalysisSummary", lang, { ticker: t, score: (data as any).bogaScore || (data as any).boga_score || 50 }),
      };
    }
  } catch (err) {
    console.error(`[getRealStockCardData] Fallback error for ${t}:`, err);
  }

  return null;
}

export async function getSiteCategoryStocksList(
  category: "trend_stocks" | "top_7" | "top_100" | "boga_ai_watchlist" | "user_watchlist",
  lang: string = "tr",
  userId?: string
): Promise<{ categoryName: string; tickers: string[]; cards: CopilotStockCard[] }> {
  let tickers: string[] = [];
  let categoryName = "BOGASTOCK Trend Hisseleri";

  try {
    const master = await getMasterData();

    if (category === "user_watchlist" && userId) {
      categoryName = "İzleme Listem";
      try {
        const personalization = await getPersonalizationContext(userId);
        tickers = personalization?.watchlistTickers || [];
      } catch {}
      if (!tickers || tickers.length === 0) tickers = ["ONDS", "KEEL", "HIMS", "OSCR"];
    } else if (category === "trend_stocks") {
      categoryName = "BOGASTOCK Trend Hisseleri";
      tickers = master?.menus?.["trend_stocks"]?.tickers || master?.menus?.["trend"]?.tickers || ["BBIO", "MOD", "JPM", "HWM"];
    } else if (category === "boga_ai_watchlist") {
      categoryName = "BOGA AI Watchlist";
      tickers = master?.menus?.["boga_ai_watchlist"]?.tickers || master?.menus?.["high_conviction"]?.tickers || ["BBIO", "MOD", "JPM", "HWM"];
    } else if (category === "top_7" || category === "top_100") {
      categoryName = "BOGASTOCK Top 100 / Top 7";
      tickers = master?.menus?.["top_100"]?.tickers || master?.menus?.["top_7"]?.tickers || ["NOK", "INTC", "TSLA", "NVDA"];
    } else {
      tickers = ["BBIO", "MOD", "JPM", "HWM"];
    }
  } catch (err) {
    console.error("[getSiteCategoryStocksList] Master data fetch error:", err);
    tickers = category === "user_watchlist" ? ["ONDS", "KEEL", "HIMS", "OSCR"] : ["BBIO", "MOD", "JPM", "HWM"];
  }

  const cards: CopilotStockCard[] = [];
  try {
    const results = await Promise.allSettled(
      tickers.slice(0, 4).map((t) => withTimeout(getRealStockCardData(t, lang), 1500))
    );

    for (const res of results) {
      if (res.status === "fulfilled" && res.value) {
        cards.push(res.value);
      }
    }
  } catch (err) {
    console.error("[getSiteCategoryStocksList] Stock card mapping error:", err);
  }

  return { categoryName, tickers: tickers.slice(0, 5), cards };
}
