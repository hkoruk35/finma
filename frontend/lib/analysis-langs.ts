export const LANG_CONFIG = {
  en: { slug: "analysis", name: "English",    flag: "🇺🇸", locale: "en_US" },
  tr: { slug: "analiz",   name: "Türkçe",     flag: "🇹🇷", locale: "tr_TR" },
  es: { slug: "analisis", name: "Español",    flag: "🇪🇸", locale: "es_ES" },
  pt: { slug: "analise",  name: "Português",  flag: "🇧🇷", locale: "pt_BR" },
  fr: { slug: "analyse",  name: "Français",   flag: "🇫🇷", locale: "fr_FR" },
  id: { slug: "analisis", name: "Bahasa",     flag: "🇮🇩", locale: "id_ID" },
} as const;

export type LangCode = keyof typeof LANG_CONFIG;

export function getLangFromParams(lang: string, slug: string): LangCode | null {
  const config = LANG_CONFIG[lang as LangCode];
  if (!config || config.slug !== slug) return null;
  return lang as LangCode;
}

export function getAllLangParams(): { lang: string; slug: string }[] {
  return Object.entries(LANG_CONFIG).map(([lang, cfg]) => ({
    lang,
    slug: cfg.slug,
  }));
}

export const TRADE_LABELS: Record<
  LangCode,
  {
    entry: string; target: string; stop: string; rr: string;
    prevAnalyses: string; basedOn: string; score: string;
    analysisEngine: string; holdingPeriod: string;
  }
> = {
  en: {
    entry: "Entry Zone", target: "Target", stop: "Stop Loss", rr: "Risk/Reward",
    prevAnalyses: "Previous Analyses", basedOn: "Based on today's analysis",
    score: "AI Score", analysisEngine: "BOGA AI Analysis Engine", holdingPeriod: "Holding Period",
  },
  tr: {
    entry: "Giriş Bölgesi", target: "Hedef", stop: "Zarar Kes", rr: "Risk/Ödül",
    prevAnalyses: "Önceki Analizler", basedOn: "Bugünün analizine göre",
    score: "AI Skoru", analysisEngine: "BOGA AI Analiz Motoru", holdingPeriod: "Elde Tutma Süresi",
  },
  es: {
    entry: "Zona de Entrada", target: "Objetivo", stop: "Stop Loss", rr: "Riesgo/Beneficio",
    prevAnalyses: "Análisis Anteriores", basedOn: "Basado en el análisis de hoy",
    score: "Puntuación IA", analysisEngine: "Motor de Análisis BOGA AI", holdingPeriod: "Período de Tenencia",
  },
  pt: {
    entry: "Zona de Entrada", target: "Alvo", stop: "Stop Loss", rr: "Risco/Retorno",
    prevAnalyses: "Análises Anteriores", basedOn: "Baseado na análise de hoje",
    score: "Score IA", analysisEngine: "Motor de Análise BOGA AI", holdingPeriod: "Período de Manutenção",
  },
  fr: {
    entry: "Zone d'Entrée", target: "Objectif", stop: "Stop Loss", rr: "Risque/Rendement",
    prevAnalyses: "Analyses Précédentes", basedOn: "Basé sur l'analyse d'aujourd'hui",
    score: "Score IA", analysisEngine: "Moteur d'Analyse BOGA AI", holdingPeriod: "Période de Détention",
  },
  id: {
    entry: "Zona Masuk", target: "Target", stop: "Stop Loss", rr: "Risiko/Imbal Hasil",
    prevAnalyses: "Analisis Sebelumnya", basedOn: "Berdasarkan analisis hari ini",
    score: "Skor AI", analysisEngine: "Mesin Analisis BOGA AI", holdingPeriod: "Periode Kepemilikan",
  },
};
