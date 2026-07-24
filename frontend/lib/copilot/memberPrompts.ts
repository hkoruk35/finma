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
  if (lang === "tr") {
    const welcomeMessage =
      `Merhaba ${userName}! BOGASTOCK masasına hoş geldiniz.\n\n` +
      `Sitedeki canlı panelleriniz (İzleme Listem, Trend Hisseleri, BOGA AI Watchlist ve Top7/Top100) üzerinden analiz yapmaya hazırım.\n\n` +
      `Bugün hangi listenizle başlayalım?`;

    return {
      welcomeMessage,
      pills: [
        { label: "⭐ İzleme Listem", prompt: "İzleme listemdeki hisseleri ve son durumlarını göster" },
        { label: "📈 Trend Hisseleri", prompt: "BOGASTOCK Trend Hisseleri listesini ve durumlarını göster" },
        { label: "🤖 BOGA AI Watchlist", prompt: "BOGA AI Watchlist listesindeki öne çıkan hisseleri göster" },
        { label: "🏆 Top7 / Top100", prompt: "BOGASTOCK Top7 ve Top100 sıralamasındaki hisseleri göster" },
      ],
    };
  }

  if (lang === "pt") {
    const welcomeMessage =
      `Olá ${userName}! Bem-vindo ao BOGASTOCK.\n\n` +
      `Estou pronto para analisar seus painéis (Minha Lista, Ações em Tendência, BOGA AI Watchlist e Top7/Top100).\n\n` +
      `Por qual lista gostaria de começar hoje?`;

    return {
      welcomeMessage,
      pills: [
        { label: "⭐ Minha Lista", prompt: "Mostre as ações da minha lista e seu status" },
        { label: "📈 Ações em Tendência", prompt: "Mostre a lista de Ações em Tendência da BOGASTOCK" },
        { label: "🤖 BOGA AI Watchlist", prompt: "Mostre as ações do BOGA AI Watchlist" },
        { label: "🏆 Top7 / Top100", prompt: "Mostre as ações do ranking Top7 e Top100" },
      ],
    };
  }

  if (lang === "es") {
    const welcomeMessage =
      `¡Hola ${userName}! Bienvenido a BOGASTOCK.\n\n` +
      `Estoy listo para analizar tus paneles (Mi Lista, Acciones en Tendencia, BOGA AI Watchlist y Top7/Top100).\n\n` +
      `¿Con qué lista nos gustaría comenzar hoy?`;

    return {
      welcomeMessage,
      pills: [
        { label: "⭐ Mi Lista", prompt: "Muestra las acciones de mi lista y su estado actual" },
        { label: "📈 Acciones en Tendencia", prompt: "Muestra la lista de Acciones en Tendencia de BOGASTOCK" },
        { label: "🤖 BOGA AI Watchlist", prompt: "Muestra las acciones del BOGA AI Watchlist" },
        { label: "🏆 Top7 / Top100", prompt: "Muestra las acciones del ranking Top7 y Top100" },
      ],
    };
  }

  if (lang === "fr") {
    const welcomeMessage =
      `Bonjour ${userName} ! Bienvenue sur BOGASTOCK.\n\n` +
      `Je suis prêt à analyser vos tableaux de bord (Ma Liste, Actions Tendance, BOGA AI Watchlist et Top7/Top100).\n\n` +
      `Par quelle liste souhaitez-vous commencer aujourd'hui ?`;

    return {
      welcomeMessage,
      pills: [
        { label: "⭐ Ma Liste", prompt: "Montrez les actions de ma liste et leur état" },
        { label: "📈 Actions Tendance", prompt: "Montrez la liste des Actions Tendance BOGASTOCK" },
        { label: "🤖 BOGA AI Watchlist", prompt: "Montrez les actions du BOGA AI Watchlist" },
        { label: "🏆 Top7 / Top100", prompt: "Montrez les actions du classement Top7 et Top100" },
      ],
    };
  }

  // Default English
  const welcomeMessage =
    `Hello ${userName}! Welcome to BOGASTOCK.\n\n` +
    `Ready to analyze your dashboard panels (My Watchlist, Trend Stocks, BOGA AI Watchlist, and Top7/Top100).\n\n` +
    `Which list would you like to start with today?`;

  return {
    welcomeMessage,
    pills: [
      { label: "⭐ My Watchlist", prompt: "Show the stocks in my watchlist and their status" },
      { label: "📈 Trend Stocks", prompt: "Show BOGASTOCK Trend Stocks list and status" },
      { label: "🤖 BOGA AI Watchlist", prompt: "Show stocks in the BOGA AI Watchlist" },
      { label: "🏆 Top7 / Top100", prompt: "Show stocks in the BOGASTOCK Top7 and Top100 rankings" },
    ],
  };
}
