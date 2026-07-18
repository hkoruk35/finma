// Copilot'un "show_stock_card" aracının TEK veri kaynağı.
// Modelin kendi ürettiği sayılar asla kullanılmaz — burası site genelinde
// zaten kullanılan getStockData() (lib/data.ts) motorunu sarmalar, aynı
// analysis/graphic sayfalarının gösterdiği skor/giriş/hedef/stop değerlerini
// döner. Gerçek veri yoksa (ya da is_mock/is_partial_mock ise) null döner —
// hiçbir zaman uydurma/placeholder veri üretilmez.

import { getStockData } from "@/lib/data";
import { ct } from "@/lib/copilot/i18n";
import { getLiveAnalysis, liveToCard } from "@/lib/copilot/liveAnalysis";

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

function pickSummary(aiSummary: unknown, lang: string): string | null {
  if (!aiSummary) return null;
  if (typeof aiSummary === "string") return aiSummary.trim() || null;
  if (typeof aiSummary === "object") {
    const obj = aiSummary as Record<string, string>;
    const candidate = obj[lang] || obj["en"] || Object.values(obj)[0];
    return candidate ? candidate.trim() || null : null;
  }
  return null;
}

function deriveTrend(scoreType: string | undefined, changePct: number | undefined): "Bullish" | "Bearish" | "Neutral" {
  const t = (scoreType || "").toUpperCase();
  if (t === "HIGH_CONVICTION" || t === "POSITIVE_BIAS") return "Bullish";
  if (t === "NEGATIVE_BIAS" || t === "UNDERPERFORM") return "Bearish";
  if (typeof changePct === "number") {
    if (changePct > 0.5) return "Bullish";
    if (changePct < -0.5) return "Bearish";
  }
  return "Neutral";
}

function deriveRiskLevel(riskReward: number | undefined, lang: string): string {
  if (!riskReward || riskReward <= 0) return ct("riskUnknown", lang);
  if (riskReward >= 2.5) return ct("riskLow", lang);
  if (riskReward >= 1.5) return ct("riskMedium", lang);
  return ct("riskHigh", lang);
}

export async function getRealStockCardData(ticker: string, lang: string = "tr"): Promise<CopilotStockCard | null> {
  const t = ticker.trim().toUpperCase();
  if (!t || !/^[A-Z.\-]{1,6}$/.test(t)) return null;

  const data = await getStockData(t);

  // Curated havuzda yoksa (MOH gibi gerçek ama skorlanmayan hisse) canlı BOGA
  // motoruna düş — grafik sayfasının kullandığı aynı /api/preorder-analysis.
  if (!data || data.is_mock || (data as any).is_partial_mock) {
    const live = await getLiveAnalysis(t, lang);
    if (!live) return null;
    const card = liveToCard(live);
    if (!card) return null;
    return {
      ...card,
      riskLevel: deriveRiskLevel(live.tradePlan?.riskReward, lang),
      summary: ct("liveAnalysisSummary", lang, { ticker: t, score: card.bogaScore }),
    };
  }

  const sd = data.scores_detail;
  const price = data.price?.current;
  if (!sd || typeof price !== "number") return null;

  // Destek/Direnç/Hedef, canonical trade-plan motorunun (scores_detail) alanlarına
  // eşleniyor: stop_loss = en yakın geçersizlik/destek seviyesi, target_range_low
  // = kısa vadeli direnç, target_price = nihai hedef. Aynı analysis/graphic
  // sayfalarının kullandığı sayılar.
  const support = sd.stop_loss;
  const resistance = sd.target_range_low ?? sd.target_price;
  const target = sd.target_price;

  if ([support, resistance, target].some((v) => typeof v !== "number" || Number.isNaN(v))) return null;

  const summary =
    pickSummary(data.ai_summary, lang) ||
    ct("defaultStockSummary", lang, { ticker: t, score: Math.round(data.scores.master_score), sector: data.sector || "N/A" });

  return {
    ticker: t,
    companyName: data.company || t,
    trend: deriveTrend(data.scores?.score_type, data.price?.change_pct),
    bogaScore: Math.round(data.scores.master_score),
    riskLevel: deriveRiskLevel(sd.risk_reward_ratio, lang),
    support,
    resistance,
    target,
    summary,
  };
}
