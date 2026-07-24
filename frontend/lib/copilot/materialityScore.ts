// Materiality Score Engine for BOGA Copilot Smart News & Alert Filtering

export interface MaterialityFactors {
  companyRelevance: number; // 0 - 20
  financialImpact: number;  // 0 - 25
  sourceConfidence: number; // 0 - 15 (SEC Form 4 = 15, Reuters/BBG = 12, Unconfirmed = 5)
  priceReaction: number;    // 0 - 15 (% move in premarket/hours)
  volumeAnomaly: number;    // 0 - 10 (RVOL > 2.0 = 10)
  userRelevance: number;    // 0 - 10 (User owns or follows in watchlist)
  novelty: number;          // 0 - 5 (New event = 5)
  duplicatePenalty: number; // 0 - 30 (If same story reported in last 6 hours)
}

export interface MaterialityResult {
  score: number; // 0 - 100
  tier: "ignore" | "scheduled_report" | "instant_alert" | "critical_alert";
  wordLimit: { min: number; max: number };
  actionText: string;
}

export function calculateMaterialityScore(factors: MaterialityFactors): MaterialityResult {
  const rawScore =
    factors.companyRelevance +
    factors.financialImpact +
    factors.sourceConfidence +
    factors.priceReaction +
    factors.volumeAnomaly +
    factors.userRelevance +
    factors.novelty -
    factors.duplicatePenalty;

  const score = Math.max(0, Math.min(100, Math.round(rawScore)));

  if (score >= 80) {
    return {
      score,
      tier: "critical_alert",
      wordLimit: { min: 40, max: 90 },
      actionText: "🔴 KRİTİK GELİŞME BİLDİRİMİ + Analiz Yenileme",
    };
  }
  if (score >= 60) {
    return {
      score,
      tier: "instant_alert",
      wordLimit: { min: 40, max: 90 },
      actionText: "🟠 Anlık Bildirim (40–90 kelime)",
    };
  }
  if (score >= 40) {
    return {
      score,
      tier: "scheduled_report",
      wordLimit: { min: 80, max: 180 },
      actionText: "🟡 Sonraki Planlı Rapora Ekle (08:45 / 12:00 / 16:15 ET)",
    };
  }
  return {
    score,
    tier: "ignore",
    wordLimit: { min: 0, max: 0 },
    actionText: "⚪ Kaydet, Bildirim Gönderme (Önem derecesi yetersiz)",
  };
}
