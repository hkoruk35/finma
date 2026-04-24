export const LANG_CONFIG = {
  en: { slug: "analysis",  name: "English",    flag: "🇺🇸", locale: "en_US" },
  tr: { slug: "analiz",    name: "Türkçe",     flag: "🇹🇷", locale: "tr_TR" },
  es: { slug: "analisis",  name: "Español",    flag: "🇪🇸", locale: "es_ES" },
  pt: { slug: "analise",   name: "Português",  flag: "🇧🇷", locale: "pt_BR" },
  fr: { slug: "analyse",   name: "Français",   flag: "🇫🇷", locale: "fr_FR" },
  id: { slug: "analisis",  name: "Bahasa",     flag: "🇮🇩", locale: "id_ID" },
  de: { slug: "analyse",   name: "Deutsch",    flag: "🇩🇪", locale: "de_DE" },
  it: { slug: "analisi",   name: "Italiano",   flag: "🇮🇹", locale: "it_IT" },
  ru: { slug: "analiz",    name: "Русский",    flag: "🇷🇺", locale: "ru_RU" },
  ar: { slug: "tahlil",    name: "العربية",    flag: "🇸🇦", locale: "ar_SA" },
  ja: { slug: "bunseki",   name: "日本語",      flag: "🇯🇵", locale: "ja_JP" },
  ko: { slug: "bunseok",   name: "한국어",      flag: "🇰🇷", locale: "ko_KR" },
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
  de: {
    entry: "Eingangszone", target: "Ziel", stop: "Stop Loss", rr: "Risiko/Ertrag",
    prevAnalyses: "Frühere Analysen", basedOn: "Basierend auf der heutigen Analyse",
    score: "KI-Bewertung", analysisEngine: "BOGA AI Analyse-Engine", holdingPeriod: "Haltedauer",
  },
  it: {
    entry: "Zona di Ingresso", target: "Obiettivo", stop: "Stop Loss", rr: "Rischio/Rendimento",
    prevAnalyses: "Analisi Precedenti", basedOn: "Basato sull'analisi di oggi",
    score: "Punteggio IA", analysisEngine: "Motore di Analisi BOGA AI", holdingPeriod: "Periodo di Mantenimento",
  },
  ru: {
    entry: "Зона Входа", target: "Цель", stop: "Стоп-лосс", rr: "Риск/Доход",
    prevAnalyses: "Предыдущие Анализы", basedOn: "На основе сегодняшнего анализа",
    score: "Оценка ИИ", analysisEngine: "Аналитический движок BOGA AI", holdingPeriod: "Период удержания",
  },
  ar: {
    entry: "منطقة الدخول", target: "الهدف", stop: "وقف الخسارة", rr: "المخاطرة/العائد",
    prevAnalyses: "التحليلات السابقة", basedOn: "بناءً على تحليل اليوم",
    score: "نقاط الذكاء الاصطناعي", analysisEngine: "محرك تحليل BOGA AI", holdingPeriod: "فترة الاحتفاظ",
  },
  ja: {
    entry: "エントリーゾーン", target: "目標", stop: "ストップロス", rr: "リスク/リターン",
    prevAnalyses: "過去の分析", basedOn: "本日の分析に基づく",
    score: "AIスコア", analysisEngine: "BOGA AI分析エンジン", holdingPeriod: "保有期間",
  },
  ko: {
    entry: "진입 구간", target: "목표", stop: "손절매", rr: "위험/수익",
    prevAnalyses: "이전 분석", basedOn: "오늘 분석 기준",
    score: "AI 점수", analysisEngine: "BOGA AI 분석 엔진", holdingPeriod: "보유 기간",
  },
};
