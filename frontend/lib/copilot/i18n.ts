// BOGA Copilot arayüz metinleri — 5 dil. AIContainer.tsx'teki TEXTS desenini izler.
// Not: Asistanın CEVAPLARI system prompt üzerinden dile zorlanır (route.ts); burası
// sadece statik UI kabuğu (butonlar, placeholder, hata mesajları) içindir.

export type CopilotLocale = "tr" | "en" | "es" | "fr" | "pt";

const T: Record<string, Record<CopilotLocale, string>> = {
  personalize: { tr: "Kişiselleştir", en: "Personalize", es: "Personalizar", fr: "Personnaliser", pt: "Personalizar" },
  assistantName: { tr: "Asistan Adı", en: "Assistant Name", es: "Nombre del Asistente", fr: "Nom de l'Assistant", pt: "Nome do Assistente" },
  chooseAvatar: { tr: "Avatar Seç", en: "Choose Avatar", es: "Elegir Avatar", fr: "Choisir un Avatar", pt: "Escolher Avatar" },
  save: { tr: "Kaydet", en: "Save", es: "Guardar", fr: "Enregistrer", pt: "Salvar" },
  welcomeTicker: {
    tr: "Şu anda {ticker} grafiğini inceliyorsun. Sana yardımcı olabilirim:\n• Teknik analiz\n• Risk değerlendirmesi\n• Benzer hisseler",
    en: "You're currently viewing the {ticker} chart. I can help with:\n• Technical analysis\n• Risk assessment\n• Similar stocks",
    es: "Ahora mismo estás viendo el gráfico de {ticker}. Puedo ayudarte con:\n• Análisis técnico\n• Evaluación de riesgo\n• Acciones similares",
    fr: "Vous consultez actuellement le graphique de {ticker}. Je peux vous aider avec :\n• Analyse technique\n• Évaluation des risques\n• Actions similaires",
    pt: "Você está vendo o gráfico de {ticker} agora. Posso ajudar com:\n• Análise técnica\n• Avaliação de risco\n• Ações semelhantes",
  },
  welcomeDefault: {
    tr: "Bugün Ne Yapmak İstiyorsun?\n• Bir hisseyi analiz et\n• Günün en güçlü adaylarını bul\n• Portföyünü incele",
    en: "What would you like to do today?\n• Analyze a stock\n• Find today's strongest candidates\n• Review your portfolio",
    es: "¿Qué te gustaría hacer hoy?\n• Analizar una acción\n• Encontrar los candidatos más fuertes de hoy\n• Revisar tu cartera",
    fr: "Que voulez-vous faire aujourd'hui ?\n• Analyser une action\n• Trouver les meilleurs candidats du jour\n• Consulter votre portefeuille",
    pt: "O que você quer fazer hoje?\n• Analisar uma ação\n• Encontrar os melhores candidatos do dia\n• Revisar sua carteira",
  },
  quickTechnical: { tr: "Teknik Analiz", en: "Technical Analysis", es: "Análisis Técnico", fr: "Analyse Technique", pt: "Análise Técnica" },
  quickTechnicalMsg: { tr: "Teknik durumu analiz et", en: "Analyze the technical setup", es: "Analiza la situación técnica", fr: "Analyse la situation technique", pt: "Analise o quadro técnico" },
  quickSupportResistance: { tr: "Destek / Direnç", en: "Support / Resistance", es: "Soporte / Resistencia", fr: "Support / Résistance", pt: "Suporte / Resistência" },
  quickSupportResistanceMsg: { tr: "Destek ve direnç seviyeleri nedir?", en: "What are the support and resistance levels?", es: "¿Cuáles son los niveles de soporte y resistencia?", fr: "Quels sont les niveaux de support et de résistance ?", pt: "Quais são os níveis de suporte e resistência?" },
  quickSwing: { tr: "🚀 Swing Fırsatları", en: "🚀 Swing Opportunities", es: "🚀 Oportunidades Swing", fr: "🚀 Opportunités Swing", pt: "🚀 Oportunidades Swing" },
  quickSwingMsg: { tr: "Günün en güçlü hisseleri hangileri?", en: "What are today's strongest stocks?", es: "¿Cuáles son las acciones más fuertes de hoy?", fr: "Quelles sont les actions les plus fortes aujourd'hui ?", pt: "Quais são as ações mais fortes de hoje?" },
  quickNvda: { tr: "⚡ NVDA Analizi", en: "⚡ NVDA Analysis", es: "⚡ Análisis de NVDA", fr: "⚡ Analyse NVDA", pt: "⚡ Análise NVDA" },
  quickNvdaMsg: { tr: "NVIDIA'nın son durumunu değerlendir", en: "Assess NVIDIA's current situation", es: "Evalúa la situación actual de NVIDIA", fr: "Évalue la situation actuelle de NVIDIA", pt: "Avalie a situação atual da NVIDIA" },
  fetchingData: { tr: "Veri getiriliyor...", en: "Fetching data...", es: "Obteniendo datos...", fr: "Récupération des données...", pt: "Buscando dados..." },
  navigating: { tr: "🔄 {ticker} sayfasına yönlendiriliyor...", en: "🔄 Navigating to {ticker}...", es: "🔄 Redirigiendo a {ticker}...", fr: "🔄 Redirection vers {ticker}...", pt: "🔄 Redirecionando para {ticker}..." },
  navigateFailed: { tr: "Yönlendirme yapılamadı.", en: "Could not navigate.", es: "No se pudo redirigir.", fr: "Impossible de rediriger.", pt: "Não foi possível redirecionar." },
  noStockData: { tr: "Bu hisse için veri bulunamadı.", en: "No data found for this stock.", es: "No se encontraron datos para esta acción.", fr: "Aucune donnée trouvée pour cette action.", pt: "Nenhum dado encontrado para esta ação." },
  analyzeTickerPrompt: { tr: "{ticker} hissesini analiz et", en: "Analyze {ticker} stock", es: "Analiza la acción {ticker}", fr: "Analyse l'action {ticker}", pt: "Analise a ação {ticker}" },
  quotaExhausted: { tr: "Bugünkü Copilot isteklerini doldurdun ({limit}/{limit}). Yarın sıfırlanacak.", en: "You've used all your Copilot requests today ({limit}/{limit}). Resets tomorrow.", es: "Has usado todas tus solicitudes de Copilot hoy ({limit}/{limit}). Se reinicia mañana.", fr: "Vous avez utilisé toutes vos requêtes Copilot aujourd'hui ({limit}/{limit}). Réinitialisation demain.", pt: "Você usou todas as suas solicitações do Copilot hoje ({limit}/{limit}). Reinicia amanhã." },
  noAccess: { tr: "Copilot için aktif bir üyelik gerekiyor.", en: "An active membership is required for Copilot.", es: "Se requiere una membresía activa para Copilot.", fr: "Un abonnement actif est requis pour Copilot.", pt: "É necessária uma assinatura ativa para o Copilot." },
  genericError: { tr: "Bir hata oluştu, yanıt alınamadı. Lütfen tekrar dener misin?", en: "Something went wrong, no response received. Could you try again?", es: "Algo salió mal, no se recibió respuesta. ¿Podrías intentarlo de nuevo?", fr: "Une erreur s'est produite, aucune réponse reçue. Pouvez-vous réessayer ?", pt: "Algo deu errado, nenhuma resposta recebida. Você pode tentar novamente?" },
  inputPlaceholder: { tr: "BOGA AI'a sor...", en: "Ask BOGA AI...", es: "Pregúntale a BOGA AI...", fr: "Demandez à BOGA AI...", pt: "Pergunte à BOGA AI..." },
  disclaimer: { tr: "BOGA AI yatırım tavsiyesi vermez.", en: "BOGA AI does not provide investment advice.", es: "BOGA AI no ofrece asesoramiento de inversión.", fr: "BOGA AI ne fournit pas de conseils en investissement.", pt: "A BOGA AI não oferece aconselhamento de investimento." },
  requestsLeft: { tr: "{n} / {limit} İstek Kaldı", en: "{n} / {limit} Requests Left", es: "{n} / {limit} Solicitudes Restantes", fr: "{n} / {limit} Requêtes Restantes", pt: "{n} / {limit} Solicitações Restantes" },
  support: { tr: "DESTEK", en: "SUPPORT", es: "SOPORTE", fr: "SUPPORT", pt: "SUPORTE" },
  resistance: { tr: "DİRENÇ", en: "RESISTANCE", es: "RESISTENCIA", fr: "RÉSISTANCE", pt: "RESISTÊNCIA" },
  target: { tr: "HEDEF", en: "TARGET", es: "OBJETIVO", fr: "OBJECTIF", pt: "ALVO" },
  riskProfile: { tr: "Risk Profili:", en: "Risk Profile:", es: "Perfil de Riesgo:", fr: "Profil de Risque :", pt: "Perfil de Risco:" },
  openChart: { tr: "Grafiği Aç", en: "Open Chart", es: "Abrir Gráfico", fr: "Ouvrir le Graphique", pt: "Abrir Gráfico" },
  addToPortfolio: { tr: "Portföye Ekle", en: "Add to Portfolio", es: "Añadir a Cartera", fr: "Ajouter au Portefeuille", pt: "Adicionar à Carteira" },
  added: { tr: "Eklendi ✓", en: "Added ✓", es: "Añadido ✓", fr: "Ajouté ✓", pt: "Adicionado ✓" },
  adding: { tr: "Ekleniyor...", en: "Adding...", es: "Añadiendo...", fr: "Ajout en cours...", pt: "Adicionando..." },
  addError: { tr: "Hata, tekrar dene", en: "Error, try again", es: "Error, intenta de nuevo", fr: "Erreur, réessayez", pt: "Erro, tente novamente" },
  riskUnknown: { tr: "Bilinmiyor", en: "Unknown", es: "Desconocido", fr: "Inconnu", pt: "Desconhecido" },
  riskLow: { tr: "Düşük", en: "Low", es: "Bajo", fr: "Faible", pt: "Baixo" },
  riskMedium: { tr: "Orta", en: "Medium", es: "Medio", fr: "Moyen", pt: "Médio" },
  riskHigh: { tr: "Yüksek", en: "High", es: "Alto", fr: "Élevé", pt: "Alto" },
  invalidTicker: { tr: "Geçersiz hisse senedi sembolü.", en: "Invalid stock symbol.", es: "Símbolo bursátil inválido.", fr: "Symbole boursier invalide.", pt: "Símbolo de ação inválido." },
  tickerNotFound: { tr: "Bu sembol için sistemde veri bulunamadı.", en: "No data found in the system for this symbol.", es: "No se encontraron datos en el sistema para este símbolo.", fr: "Aucune donnée trouvée dans le système pour ce symbole.", pt: "Nenhum dado encontrado no sistema para este símbolo." },
  liveAnalysisSummary: {
    tr: "{ticker} için canlı BOGA AI analizi (havuz dışı — grafik motoruyla anlık hesaplandı). Konviksiyon skoru: {score}/100.",
    en: "Live BOGA AI analysis for {ticker} (outside the curated pool — computed live by the chart engine). Conviction score: {score}/100.",
    es: "Análisis BOGA AI en vivo para {ticker} (fuera del pool curado — calculado en vivo por el motor gráfico). Puntuación de convicción: {score}/100.",
    fr: "Analyse BOGA AI en direct pour {ticker} (hors pool sélectionné — calculée en direct par le moteur graphique). Score de conviction : {score}/100.",
    pt: "Análise BOGA AI ao vivo para {ticker} (fora do pool selecionado — calculada ao vivo pelo motor gráfico). Pontuação de convicção: {score}/100.",
  },
  defaultStockSummary: {
    tr: "{ticker}: BOGA Skoru {score}/100, sektör: {sector}.",
    en: "{ticker}: BOGA Score {score}/100, sector: {sector}.",
    es: "{ticker}: Puntuación BOGA {score}/100, sector: {sector}.",
    fr: "{ticker} : Score BOGA {score}/100, secteur : {sector}.",
    pt: "{ticker}: Pontuação BOGA {score}/100, setor: {sector}.",
  },
};

export function ct(key: keyof typeof T, locale: string, vars?: Record<string, string | number>): string {
  const localeKey = (["tr", "en", "es", "fr", "pt"].includes(locale) ? locale : "en") as CopilotLocale;
  let str = T[key]?.[localeKey] ?? T[key]?.en ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    }
  }
  return str;
}
