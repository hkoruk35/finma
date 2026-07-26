// BOGA Copilot arayüz metinleri — 5 dil. AIContainer.tsx'teki TEXTS desenini izler.
// Not: Asistanın CEVAPLARI system prompt üzerinden dile zorlanır (route.ts); burası
// sadece statik UI kabuğu (butonlar, placeholder, hata mesajları) içindir.

export type CopilotLocale = "tr" | "en" | "es" | "fr" | "pt";

const T: Record<string, Record<CopilotLocale, string>> = {
  personalize: { tr: "Kişiselleştir", en: "Personalize", es: "Personalizar", fr: "Personnaliser", pt: "Personalizar" },
  copilotTagline: {
    tr: "Şimdi Keşfet ✨",
    en: "Explore Now ✨",
    es: "Explora Ahora ✨",
    fr: "Explorer Maintenant ✨",
    pt: "Explore Agora ✨",
  },
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
  quickSwing: { tr: "🚀 Trend Fırsatları", en: "🚀 Trend Opportunities", es: "🚀 Oportunidades de Tendencia", fr: "🚀 Opportunités Tendance", pt: "🚀 Oportunidades de Tendência" },
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
  addToPortfolio: { tr: "İzleme Listesine Ekle", en: "Add to Watchlist", es: "Añadir a Mi Lista", fr: "Ajouter à Ma Liste", pt: "Adicionar à Minha Lista" },
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
    tr: "{ticker} şu anda takip listelerimizden birinde değil, bu yüzden senin için hızlıca canlı bir analiz çıkardım. Konviksiyon skoru: {score}/100.",
    en: "{ticker} isn't on one of our tracked lists right now, so I ran a quick live analysis for you. Conviction score: {score}/100.",
    es: "{ticker} no está en ninguna de nuestras listas de seguimiento ahora mismo, así que hice un análisis rápido en vivo para ti. Puntuación de convicción: {score}/100.",
    fr: "{ticker} ne figure pas actuellement dans nos listes suivies, j'ai donc fait une analyse rapide en direct pour vous. Score de conviction : {score}/100.",
    pt: "{ticker} não está em nenhuma das nossas listas monitoradas no momento, então fiz uma análise rápida ao vivo para você. Pontuação de convicção: {score}/100.",
  },
  trendListAnalysisSummary: {
    tr: "Şu anda {ticker}, Trend Listesi'nde takip ediliyor. Konviksiyon skoru: {score}/100.",
    en: "{ticker} is currently being tracked in the Trend List. Conviction score: {score}/100.",
    es: "{ticker} está siendo seguido actualmente en la Lista de Tendencia. Puntuación de convicción: {score}/100.",
    fr: "{ticker} est actuellement suivi dans la Liste Tendance. Score de conviction : {score}/100.",
    pt: "{ticker} está sendo acompanhado atualmente na Lista de Tendência. Pontuação de convicção: {score}/100.",
  },
  trendCandidateAnalysisSummary: {
    tr: "Şu anda {ticker}, Trend Adayı olarak radarımızda — henüz teyit tamamlanmadı. Konviksiyon skoru: {score}/100.",
    en: "{ticker} is on our radar as a Trend Candidate right now — confirmation isn't complete yet. Conviction score: {score}/100.",
    es: "{ticker} está en nuestro radar como Candidata a Tendencia por ahora — la confirmación aún no está completa. Puntuación de convicción: {score}/100.",
    fr: "{ticker} est actuellement sur notre radar en tant que Candidate Tendance — la confirmation n'est pas encore terminée. Score de conviction : {score}/100.",
    pt: "{ticker} está no nosso radar como Candidata a Tendência agora — a confirmação ainda não foi concluída. Pontuação de convicção: {score}/100.",
  },
  inListAnalysisSummary: {
    tr: "Şu anda {ticker}, {categoryName} listesinde. Konviksiyon skoru: {score}/100.",
    en: "{ticker} is currently on the {categoryName} list. Conviction score: {score}/100.",
    es: "{ticker} está actualmente en la lista {categoryName}. Puntuación de convicción: {score}/100.",
    fr: "{ticker} figure actuellement dans la liste {categoryName}. Score de conviction : {score}/100.",
    pt: "{ticker} está atualmente na lista {categoryName}. Pontuação de convicção: {score}/100.",
  },
  defaultStockSummary: {
    tr: "{ticker}: BOGA Skoru {score}/100, sektör: {sector}.",
    en: "{ticker}: BOGA Score {score}/100, sector: {sector}.",
    es: "{ticker}: Puntuación BOGA {score}/100, sector: {sector}.",
    fr: "{ticker} : Score BOGA {score}/100, secteur : {sector}.",
    pt: "{ticker}: Pontuação BOGA {score}/100, setor: {sector}.",
  },
  trendBullish: { tr: "Yükseliş", en: "Bullish", es: "Alcista", fr: "Haussier", pt: "Altista" },
  trendBearish: { tr: "Düşüş", en: "Bearish", es: "Bajista", fr: "Baissier", pt: "Baixista" },
  trendNeutral: { tr: "Nötr", en: "Neutral", es: "Neutral", fr: "Neutre", pt: "Neutro" },
  newsHeader: {
    tr: "📰 Canlı ABD Piyasası ve Haber Akışı",
    en: "📰 Live US Market News Feed",
    es: "📰 Feed de Noticias en Vivo del Mercado de EE. UU.",
    fr: "📰 Fil d'Actualités en Direct du Marché Américain",
    pt: "📰 Feed de Notícias ao Vivo do Mercado dos EUA",
  },
  categoryTrendStocks: { tr: "Trend Hisseleri", en: "Trend Stocks", es: "Acciones en Tendencia", fr: "Actions Tendance", pt: "Ações em Tendência" },
  categoryTrendCandidateWatchlist: { tr: "Trend Adayı İzleme Listesi", en: "Trend Candidate Watchlist", es: "Lista de Candidatas a Tendencia", fr: "Liste des Candidates Tendance", pt: "Lista de Candidatas a Tendência" },
  categoryTop7: { tr: "Top 7", en: "Top 7", es: "Top 7", fr: "Top 7", pt: "Top 7" },
  categoryTop100: { tr: "Top 100", en: "Top 100", es: "Top 100", fr: "Top 100", pt: "Top 100" },
  categoryUserWatchlist: { tr: "İzleme Listem", en: "My Watchlist", es: "Mi Lista", fr: "Ma Liste", pt: "Minha Lista" },
  alertListChanged: { tr: "liste değişikliği", en: "list change", es: "cambio de lista", fr: "changement de liste", pt: "mudança na lista" },
  alertEntered: { tr: "Girenler", en: "Entered", es: "Entraron", fr: "Entrées", pt: "Entraram" },
  alertLeft: { tr: "Çıkanlar", en: "Left", es: "Salieron", fr: "Sorties", pt: "Saíram" },
  alertTrendChanged: { tr: "trend değişti", en: "trend changed", es: "cambió la tendencia", fr: "tendance modifiée", pt: "tendência mudou" },
  alertScoreChanged: { tr: "BOGA Score değişti", en: "BOGA Score changed", es: "cambió el BOGA Score", fr: "le BOGA Score a changé", pt: "o BOGA Score mudou" },
  alertTrendUpdated: {
    tr: "Trend {prev} -> {next} olarak güncellendi.",
    en: "Trend updated from {prev} to {next}.",
    es: "Tendencia actualizada de {prev} a {next}.",
    fr: "Tendance mise à jour de {prev} à {next}.",
    pt: "Tendência atualizada de {prev} para {next}.",
  },
  alertScoreUpdated: {
    tr: "BOGA Score {prev} -> {next} olarak güncellendi.",
    en: "BOGA Score updated from {prev} to {next}.",
    es: "BOGA Score actualizado de {prev} a {next}.",
    fr: "BOGA Score mis à jour de {prev} à {next}.",
    pt: "BOGA Score atualizado de {prev} para {next}.",
  },
  alertMove: { tr: "%{pct} hareket", en: "{pct}% move", es: "movimiento del {pct}%", fr: "mouvement de {pct} %", pt: "movimento de {pct}%" },
  alertPriceUpdated: {
    tr: "Fiyat ${prev} -> ${next} ({pct}% günlük).",
    en: "Price updated from ${prev} to ${next} ({pct}% daily).",
    es: "Precio actualizado de ${prev} a ${next} ({pct}% diario).",
    fr: "Prix mis à jour de {prev} $ à {next} $ ({pct} % quotidien).",
    pt: "Preço atualizado de ${prev} para ${next} ({pct}% diário).",
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
