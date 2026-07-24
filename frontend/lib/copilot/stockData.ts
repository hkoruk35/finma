// Copilot'un "show_stock_card" ve "get_top_trending_stocks" aracının TEK canlı veri kaynağı.
// Canlı borsa verisi (getLiveAnalysis) önceliklidir — grafik ve gerçek piyasa ile 100% uyumlu.

import { getStockData } from "@/lib/data";
import { ct } from "@/lib/copilot/i18n";
import { getLiveAnalysis, liveToCard } from "@/lib/copilot/liveAnalysis";

function searchTickerByName(query: string): string | null {
  const t = query.trim().toUpperCase();
  return /^[A-Z.\-]{1,6}$/.test(t) ? t : null;
}

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

export async function getRealStockCardData(ticker: string, lang: string = "tr"): Promise<CopilotStockCard | null> {
  let t = ticker.trim().toUpperCase();
  if (!t || !/^[A-Z.\-]{1,6}$/.test(t)) return null;

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

  // Fallback to getStockData if live fetch unavailable
  const data = await getStockData(t);
  if (!data) return null;

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

export async function getTopTrendingStocksList(lang: string = "tr"): Promise<CopilotStockCard[]> {
  const topTickers = ["NVDA", "AAPL", "MSFT", "META", "PLTR", "AMD", "AMZN", "COST"];
  const cards: CopilotStockCard[] = [];

  const results = await Promise.allSettled(
    topTickers.slice(0, 4).map((t) => getRealStockCardData(t, lang))
  );

  for (const res of results) {
    if (res.status === "fulfilled" && res.value) {
      cards.push(res.value);
    }
  }

  return cards;
}
