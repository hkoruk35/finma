// BOGA Copilot Authenticated Member Daily Kickoff & Interactive Suggestion Helpers

export type CopilotLang = "tr" | "en" | "es" | "fr" | "pt";

export interface DailyGreeting {
  welcomeMessage: string;
  pills: { label: string; prompt: string }[];
}

export function buildMemberDailyGreeting(
  userName: string,
  favoriteSectors: string[],
  watchlistCount: number,
  lang: CopilotLang = "tr"
): DailyGreeting {
  const primarySector = favoriteSectors[0] || (lang === "tr" ? "Teknoloji" : "Technology");

  if (lang === "tr") {
    const welcomeMessage =
      `Merhaba ${userName}! Bugün sizin için piyasayı taramaya hazırım.\n\n` +
      `Sık ilgilendiğiniz **${primarySector}** sektörü ve izleme listenizdeki hisseler için borsalar açılmadan önce güncel bir özet hazırlayabilirim.\n\n` +
      `Güne nasıl başlayalım?`;

    return {
      welcomeMessage,
      pills: [
        { label: "📊 Bugünün Piyasa Özeti", prompt: "Bugünün piyasa özetini ve genel durumunu aktar" },
        { label: `💡 ${primarySector} Sektör Analizi`, prompt: `${primarySector} sektörü için kısa analiz ve son durumu aktar` },
        { label: `🔥 ${primarySector} Öne Çıkan Hisseler`, prompt: `${primarySector} sektöründe en güçlü ve öne çıkan şirketleri listele` },
        { label: "🚀 Gününün BOGA AI Trend Hisseleri", prompt: "Günün en güçlü BOGA AI Trend hisselerini göster" },
        { label: "🌐 Farklı Bir Sektör İncele", prompt: "İnceleyebileceğimiz diğer güçlü sektörler hangileri?" },
      ],
    };
  }

  if (lang === "pt") {
    const welcomeMessage =
      `Olá ${userName}! Estou pronto para analisar o mercado para você hoje.\n\n` +
      `Posso preparar um resumo atualizado focado no setor de **${primarySector}** e nas suas ações acompanhadas antes da abertura.\n\n` +
      `Como gostaria de começar o dia?`;

    return {
      welcomeMessage,
      pills: [
        { label: "📊 Resumo do Mercado de Hoje", prompt: "Apresente o resumo e panorama geral do mercado hoje" },
        { label: `💡 Análise de ${primarySector}`, prompt: `Faça uma análise rápida do setor de ${primarySector}` },
        { label: `🔥 Destaques de ${primarySector}`, prompt: `Liste as principais empresas em destaque no setor de ${primarySector}` },
        { label: "🚀 Ações em Tendência BOGA AI", prompt: "Mostre as ações de tendência mais fortes da BOGA AI hoje" },
      ],
    };
  }

  if (lang === "es") {
    const welcomeMessage =
      `¡Hola ${userName}! Estoy listo para analizar el mercado para ti hoy.\n\n` +
      `Puedo preparar un resumen actualizado enfocado en el sector de **${primarySector}** y tus acciones favoritas antes de la apertura.\n\n` +
      `¿Cómo nos gustaría comenzar hoy?`;

    return {
      welcomeMessage,
      pills: [
        { label: "📊 Resumen del Mercado Hoy", prompt: "Proporciona el resumen y panorama general del mercado de hoy" },
        { label: `💡 Análisis de ${primarySector}`, prompt: `Haz un análisis rápido del sector de ${primarySector}` },
        { label: `🔥 Destacadas de ${primarySector}`, prompt: `Enumera las principales empresas destacadas en el sector de ${primarySector}` },
        { label: "🚀 Acciones en Tendencia BOGA AI", prompt: "Muestra las acciones con tendencia más fuerte de BOGA AI hoy" },
      ],
    };
  }

  if (lang === "fr") {
    const welcomeMessage =
      `Bonjour ${userName} ! Je suis prêt à analyser le marché pour vous aujourd'hui.\n\n` +
      `Je peux préparer un résumé rapide axé sur le secteur **${primarySector}** et vos actions suivies avant l'ouverture.\n\n` +
      `Par quoi souhaitez-vous commencer aujourd'hui ?`;

    return {
      welcomeMessage,
      pills: [
        { label: "📊 Résumé du Marché d'Aujourd'hui", prompt: "Donnez le résumé et la vue d'ensemble du marché aujourd'hui" },
        { label: `💡 Analyse de ${primarySector}`, prompt: `Faites une analyse rapide du secteur ${primarySector}` },
        { label: `🔥 Actions Phares de ${primarySector}`, prompt: `Listez les entreprises phares du secteur ${primarySector}` },
        { label: "🚀 Actions Tendance BOGA AI", prompt: "Montrez les actions tendance BOGA AI les plus fortes aujourd'hui" },
      ],
    };
  }

  // Default English
  const welcomeMessage =
    `Hello ${userName}! Ready to analyze the market for you today.\n\n` +
    `I can prepare an updated briefing focused on the **${primarySector}** sector and your watched stocks before the market opens.\n\n` +
    `How would you like to start today?`;

  return {
    welcomeMessage,
    pills: [
      { label: "📊 Today's Market Briefing", prompt: "Provide today's overall market summary and current regime" },
      { label: `💡 ${primarySector} Sector Briefing`, prompt: `Provide a quick briefing on the ${primarySector} sector` },
      { label: `🔥 Top Stocks in ${primarySector}`, prompt: `List the top-performing companies in the ${primarySector} sector` },
      { label: "🚀 Today's BOGA AI Trend Picks", prompt: "Show today's top BOGA AI Trend picks" },
    ],
  };
}
