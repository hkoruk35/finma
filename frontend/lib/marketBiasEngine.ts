// BOGA View — deterministic market-bias verdict shown under "Today's market
// picture". Computed entirely from real numbers (never asked from the AI —
// see docs/AI_BEHAVIOR.md: a confidence score or bias label must be
// reproducible from the same inputs, not a creative-writing output).

export type MarketBias = "risk_on" | "risk_off" | "neutral";
export type MarketPictureLocale = "en" | "es" | "fr" | "pt" | "tr" | "id";

export interface BiasInput {
  indices: { label: string; changePct: number }[]; // must include one item with label containing "VIX"
  sectors: { label: string; changePct: number }[];
  advancers?: number | null;
  decliners?: number | null;
}

export interface BogaView {
  bias: MarketBias;
  biasLabel: Record<MarketPictureLocale, string>;
  confidence: number; // 0-100
  confirmation: Record<MarketPictureLocale, string>;
  risk: Record<MarketPictureLocale, string>;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

const BIAS_LABEL: Record<MarketBias, Record<MarketPictureLocale, string>> = {
  risk_on: {
    en: "Constructive / Risk-On",
    es: "Constructivo / Apetito por Riesgo",
    fr: "Constructif / Appétit pour le Risque",
    pt: "Construtivo / Apetite por Risco",
    tr: "Yapıcı / Risk İştahı Açık",
    id: "Konstruktif / Risk-On",
  },
  risk_off: {
    en: "Cautious / Risk-Off",
    es: "Cauteloso / Aversión al Riesgo",
    fr: "Prudent / Aversion au Risque",
    pt: "Cauteloso / Aversão a Risco",
    tr: "Temkinli / Risk İştahı Kapalı",
    id: "Hati-hati / Risk-Off",
  },
  neutral: {
    en: "Mixed / Neutral",
    es: "Mixto / Neutral",
    fr: "Mitigé / Neutre",
    pt: "Misto / Neutro",
    tr: "Karışık / Nötr",
    id: "Campuran / Netral",
  },
};

const RISK_ON_RISK: Record<MarketPictureLocale, string> = {
  en: "Breadth deterioration or a VIX rebound",
  es: "Deterioro de la amplitud o repunte del VIX",
  fr: "Détérioration de l'ampleur ou rebond du VIX",
  pt: "Deterioração da amplitude ou repique do VIX",
  tr: "Piyasa genişliğinin bozulması veya VIX'in yeniden yükselmesi",
  id: "Pelemahan breadth atau kenaikan kembali VIX",
};

const RISK_OFF_RISK: Record<MarketPictureLocale, string> = {
  en: "A breadth or volatility reversal that flips the tone",
  es: "Un giro en la amplitud o volatilidad que cambie el tono",
  fr: "Un retournement de l'ampleur ou de la volatilité qui changerait le ton",
  pt: "Uma reversão na amplitude ou volatilidade que mude o tom",
  tr: "Piyasa genişliğinde veya volatilitede tonu değiştirecek bir dönüş",
  id: "Pembalikan breadth atau volatilitas yang mengubah nada pasar",
};

const NEUTRAL_RISK: Record<MarketPictureLocale, string> = {
  en: "A decisive breadth or volatility move in either direction",
  es: "Un movimiento decisivo de amplitud o volatilidad en cualquier dirección",
  fr: "Un mouvement décisif de l'ampleur ou de la volatilité dans un sens ou l'autre",
  pt: "Um movimento decisivo de amplitude ou volatilidade em qualquer direção",
  tr: "Piyasa genişliği veya volatilitede herhangi bir yönde net bir hareket",
  id: "Pergerakan breadth atau volatilitas yang meyakinkan ke arah manapun",
};

const VIX_UP: Record<MarketPictureLocale, string> = { en: "VIX ↑", es: "VIX ↑", fr: "VIX ↑", pt: "VIX ↑", tr: "VIX ↑", id: "VIX ↑" };
const VIX_DOWN: Record<MarketPictureLocale, string> = { en: "VIX ↓", es: "VIX ↓", fr: "VIX ↓", pt: "VIX ↓", tr: "VIX ↓", id: "VIX ↓" };
const BREADTH_LABEL: Record<MarketPictureLocale, string> = {
  en: "Breadth", es: "Amplitud", fr: "Ampleur", pt: "Amplitude", tr: "Genişlik", id: "Breadth",
};

export function computeBogaView(input: BiasInput): BogaView {
  const vixItem = input.indices.find((i) => i.label.toUpperCase().includes("VIX"));
  const coreIndices = input.indices.filter((i) => i !== vixItem);
  const idxAvg = coreIndices.length ? coreIndices.reduce((s, i) => s + i.changePct, 0) / coreIndices.length : 0;
  const vixChange = vixItem?.changePct ?? 0;

  const advancers = input.advancers ?? 0;
  const decliners = input.decliners ?? 0;
  const breadthTotal = advancers + decliners;
  const breadthRatio = breadthTotal > 0 ? advancers / breadthTotal : 0.5;

  const sectorUpCount = input.sectors.filter((s) => s.changePct > 0).length;
  const sectorRatio = input.sectors.length ? sectorUpCount / input.sectors.length : 0.5;

  const idxScore = clamp(idxAvg * 20, -25, 25);
  const vixScore = clamp(-vixChange * 1.5, -25, 25);
  const breadthScore = clamp((breadthRatio - 0.5) * 50, -25, 25);
  const sectorScore = clamp((sectorRatio - 0.5) * 50, -25, 25);

  const total = idxScore + vixScore + breadthScore + sectorScore;
  const confidence = Math.round(clamp(50 + total / 2, 0, 100));

  const bias: MarketBias = total > 15 ? "risk_on" : total < -15 ? "risk_off" : "neutral";

  const leadingSector = [...input.sectors].sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))[0];
  const sectorArrow = leadingSector && leadingSector.changePct >= 0 ? "↑" : "↓";
  const vixArrow = vixChange < 0 ? VIX_DOWN : VIX_UP;
  const breadthArrow = advancers > decliners ? "↑" : "↓";

  const confirmation: Record<MarketPictureLocale, string> = {} as Record<MarketPictureLocale, string>;
  (Object.keys(BREADTH_LABEL) as MarketPictureLocale[]).forEach((loc) => {
    const parts = [vixArrow[loc], `${BREADTH_LABEL[loc]} ${breadthArrow}`];
    if (leadingSector) parts.push(`${leadingSector.label} ${sectorArrow}`);
    confirmation[loc] = parts.join(" + ");
  });

  const risk = bias === "risk_on" ? RISK_ON_RISK : bias === "risk_off" ? RISK_OFF_RISK : NEUTRAL_RISK;

  return {
    bias,
    biasLabel: BIAS_LABEL[bias],
    confidence,
    confirmation,
    risk,
  };
}
