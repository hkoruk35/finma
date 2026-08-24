// 2026-08-24 kullanıcı bildirimi: NVDA sayfasında RVOL 0.29x için hem
// "Volume is well below average — liquidity risk" (route.ts uyarısı) HEM DE
// birkaç satır altında "Volume confirmation is moderate" (marketCommentaryEngine
// cümlesi) gösteriliyordu — kendi içinde çelişkili, ve "düşük relative volume"
// ile "likidite riski" farklı kavramlar (NVDA son derece likit bir hisse
// olabilir, tek bir seansta kendi ortalamasının altında hacim görebilir).
// Bu dosya TEK bir merkezi RVOL katılım sınıflaması sağlar — kullanıcının
// önerdiği eşiklerle birebir — ve "Liquidity Risk" kavramını burada HİÇ
// üretmez; likidite riski (ör. Average Dollar Volume, spread, market cap)
// ayrı bir metrikten türemeli, RVOL'den değil.
//
// Kullanan yerler: app/api/preorder-analysis/route.ts (warnings), ve
// lib/marketCommentaryEngine.ts / lib/tradePlanEngine.ts (RVOL cümleleri).

export type RvolTier = "very_low" | "below_average" | "normal" | "increasing" | "strong";

export type RvolLang = "tr" | "en" | "es" | "fr" | "pt" | "id";

// Kullanıcının önerdiği eşikler:
// RVOL < 0.5 → Very Low Participation
// 0.5–0.8    → Below Average
// 0.8–1.2    → Normal
// 1.2–1.5    → Increasing
// > 1.5      → Strong Participation
export function classifyRvol(rvol: number): RvolTier {
  if (rvol < 0.5) return "very_low";
  if (rvol < 0.8) return "below_average";
  if (rvol < 1.2) return "normal";
  if (rvol < 1.5) return "increasing";
  return "strong";
}

// Kısa rozet etiketi (badge/liste görünümü için).
export const RVOL_TIER_LABEL: Record<RvolTier, Record<RvolLang, string>> = {
  very_low: {
    tr: "Çok Düşük Katılım", en: "Very Low Participation", es: "Participación Muy Baja",
    fr: "Participation Très Faible", pt: "Participação Muito Baixa", id: "Partisipasi Sangat Rendah",
  },
  below_average: {
    tr: "Ortalamanın Altında", en: "Below Average", es: "Por Debajo del Promedio",
    fr: "Sous la Moyenne", pt: "Abaixo da Média", id: "Di Bawah Rata-rata",
  },
  normal: {
    tr: "Normal", en: "Normal", es: "Normal", fr: "Normal", pt: "Normal", id: "Normal",
  },
  increasing: {
    tr: "Artış Gösteriyor", en: "Increasing", es: "En Aumento",
    fr: "En Hausse", pt: "Em Alta", id: "Meningkat",
  },
  strong: {
    tr: "Güçlü Katılım", en: "Strong Participation", es: "Participación Fuerte",
    fr: "Participation Forte", pt: "Participação Forte", id: "Partisipasi Kuat",
  },
};

// Yorum motorlarında kullanılan, tek cümlelik "katılım" açıklaması —
// "likidite riski" ifadesi KASITLI olarak hiçbir yerde geçmiyor: düşük RVOL
// sadece o seanstaki zayıf katılım/teyidi anlatır, hissenin likit olup
// olmadığı hakkında tek başına bir şey söylemez.
export const RVOL_PARTICIPATION_CLAUSE: Record<RvolTier, Record<RvolLang, string>> = {
  very_low: {
    tr: "Katılım ortalamanın çok altında — bu zayıf bir teyit sinyali, tek başına likidite riski göstergesi değildir.",
    en: "Participation is well below average — a weak-confirmation signal on its own, not an indicator of liquidity risk.",
    es: "La participación está muy por debajo del promedio — una señal de confirmación débil por sí sola, no un indicador de riesgo de liquidez.",
    fr: "La participation est bien inférieure à la moyenne — un signal de confirmation faible en soi, pas un indicateur de risque de liquidité.",
    pt: "A participação está bem abaixo da média — um sinal de confirmação fraco por si só, não um indicador de risco de liquidez.",
    id: "Partisipasi jauh di bawah rata-rata — sinyal konfirmasi yang lemah, bukan indikator risiko likuiditas.",
  },
  below_average: {
    tr: "Katılım ortalamanın altında; hacim teyidi zayıf kalabilir, pozisyon büyüklüğü buna göre ayarlanabilir.",
    en: "Participation is below average; volume confirmation is weaker here, so position sizing can be adjusted accordingly.",
    es: "La participación está por debajo del promedio; la confirmación por volumen es más débil aquí, ajuste el tamaño de posición en consecuencia.",
    fr: "La participation est inférieure à la moyenne ; la confirmation par le volume est plus faible ici, ajustez la taille de position en conséquence.",
    pt: "A participação está abaixo da média; a confirmação por volume é mais fraca aqui, ajuste o tamanho da posição conforme necessário.",
    id: "Partisipasi di bawah rata-rata; konfirmasi volume lebih lemah di sini, sesuaikan ukuran posisi.",
  },
  normal: {
    tr: "Katılım normal seviyelerde seyrediyor.",
    en: "Participation is around normal levels.",
    es: "La participación se mantiene en niveles normales.",
    fr: "La participation se situe à des niveaux normaux.",
    pt: "A participação está em níveis normais.",
    id: "Partisipasi berada pada level normal.",
  },
  increasing: {
    tr: "Katılım ortalamaya göre artış gösteriyor.",
    en: "Participation is picking up relative to the average.",
    es: "La participación está aumentando en relación con el promedio.",
    fr: "La participation augmente par rapport à la moyenne.",
    pt: "A participação está aumentando em relação à média.",
    id: "Partisipasi meningkat dibandingkan rata-rata.",
  },
  strong: {
    tr: "İşlem aktivitesi ortalamanın belirgin biçimde üzerinde — güçlü katılım.",
    en: "Trading activity is well above average — strong participation.",
    es: "La actividad de negociación está muy por encima del promedio — participación fuerte.",
    fr: "L'activité de négociation est bien supérieure à la moyenne — participation forte.",
    pt: "A atividade de negociação está bem acima da média — participação forte.",
    id: "Aktivitas perdagangan jauh di atas rata-rata — partisipasi kuat.",
  },
};

export function rvolParticipationClause(rvol: number, lang: RvolLang): string {
  const tier = classifyRvol(rvol);
  return RVOL_PARTICIPATION_CLAUSE[tier][lang];
}
