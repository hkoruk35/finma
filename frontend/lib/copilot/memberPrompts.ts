// BOGA Copilot Authenticated Member Daily Kickoff & Interactive Suggestion Helpers

export type CopilotLang = "tr" | "en" | "es" | "fr" | "pt";

export interface DailyGreeting {
  welcomeMessage: string;
  pills: { label: string; prompt: string }[];
}

/** Selam satırının başı: isim varsa "Merhaba Ahmet!", yoksa sadece "Merhaba!". */
function greetLine(lang: CopilotLang, userName: string | null): string {
  const n = userName?.trim();
  switch (lang) {
    case "tr": return n ? `Merhaba ${n}!` : "Merhaba!";
    case "pt": return n ? `Olá ${n}!` : "Olá!";
    case "es": return n ? `¡Hola ${n}!` : "¡Hola!";
    case "fr": return n ? `Bonjour ${n} !` : "Bonjour !";
    default: return n ? `Hello ${n}!` : "Hello!";
  }
}

export function buildMemberDailyGreeting(
  userName: string | null,
  favoriteSectors: string[],
  watchlistCount: number,
  lang: CopilotLang = "tr"
): DailyGreeting {
  if (lang === "tr") {
    const welcomeMessage =
      `${greetLine(lang, userName)} BOGASTOCK platformuna hoş geldiniz.\n\n` +
      `Sitedeki canlı panelleriniz üzerinden size rehberlik etmeye ve piyasayı analiz etmeye hazırım.\n\n` +
      `Bugün hangi listenizi incelemek istersiniz?`;

    return {
      welcomeMessage,
      pills: [
        { label: "⭐ İzleme Listem", prompt: "İzleme listemdeki hisseleri ve durumlarını göster" },
        { label: "📈 Trend Hisseleri", prompt: "BOGASTOCK Trend Hisseleri listesini ve durumlarını göster" },
        { label: "🎯 Trend Adayları", prompt: "Trend Adayı İzleme Listesi'ndeki hisseleri ve eksik teyitlerini göster" },
        { label: "🏆 Top7", prompt: "BOGASTOCK Top7 sıralamasındaki hisseleri göster" },
        { label: "🏆 Top100", prompt: "BOGASTOCK Top100 sıralamasındaki hisseleri göster" },
      ],
    };
  }

  if (lang === "pt") {
    const welcomeMessage =
      `${greetLine(lang, userName)} Bem-vindo à plataforma BOGASTOCK.\n\n` +
      `Estou pronto para guiá-lo e analisar o mercado com base nos seus painéis ativos.\n\n` +
      `Qual lista você gostaria de examinar hoje?`;

    return {
      welcomeMessage,
      pills: [
        { label: "⭐ Minha Lista", prompt: "Mostre as ações da minha lista e seu status" },
        { label: "📈 Ações em Tendência", prompt: "Mostre a lista de Ações em Tendência da BOGASTOCK" },
        { label: "🎯 Candidatas a Tendência", prompt: "Mostre a Lista de Candidatas a Tendência e suas confirmações pendentes" },
        { label: "🏆 Top7", prompt: "Mostre as ações do ranking Top7" },
        { label: "🏆 Top100", prompt: "Mostre as ações do ranking Top100" },
      ],
    };
  }

  if (lang === "es") {
    const welcomeMessage =
      `${greetLine(lang, userName)} Bienvenido a la plataforma BOGASTOCK.\n\n` +
      `Estoy listo para guiarte y analizar el mercado según tus paneles activos.\n\n` +
      `¿Qué lista te gustaría examinar hoy?`;

    return {
      welcomeMessage,
      pills: [
        { label: "⭐ Mi Lista", prompt: "Muestra las acciones de mi lista y su estado actual" },
        { label: "📈 Acciones en Tendencia", prompt: "Muestra la lista de Acciones en Tendencia de BOGASTOCK" },
        { label: "🎯 Candidatas a Tendencia", prompt: "Muestra la Lista de Candidatas a Tendencia y sus confirmaciones pendientes" },
        { label: "🏆 Top7", prompt: "Muestra las acciones del ranking Top7" },
        { label: "🏆 Top100", prompt: "Muestra las acciones del ranking Top100" },
      ],
    };
  }

  if (lang === "fr") {
    const welcomeMessage =
      `${greetLine(lang, userName)} Bienvenue sur la plateforme BOGASTOCK.\n\n` +
      `Je suis prêt à vous guider et à analyser le marché selon vos tableaux de bord actifs.\n\n` +
      `Quelle liste souhaitez-vous examiner aujourd'hui ?`;

    return {
      welcomeMessage,
      pills: [
        { label: "⭐ Ma Liste", prompt: "Montrez les actions de ma liste et leur état" },
        { label: "📈 Actions Tendance", prompt: "Montrez la liste des Actions Tendance BOGASTOCK" },
        { label: "🎯 Candidates Tendance", prompt: "Montrez la liste des Candidates Tendance et leurs confirmations manquantes" },
        { label: "🏆 Top7", prompt: "Montrez les actions du classement Top7" },
        { label: "🏆 Top100", prompt: "Montrez les actions du classement Top100" },
      ],
    };
  }

  // Default English
  const welcomeMessage =
    `${greetLine("en", userName)} Welcome to BOGASTOCK.\n\n` +
    `Ready to guide you and analyze the market based on your active dashboard panels.\n\n` +
    `Which list would you like to examine today?`;

  return {
    welcomeMessage,
    pills: [
      { label: "⭐ My Watchlist", prompt: "Show the stocks in my watchlist and their status" },
      { label: "📈 Trend Stocks", prompt: "Show BOGASTOCK Trend Stocks list and status" },
      { label: "🎯 Trend Candidates", prompt: "Show the Trend Candidate Watchlist and what confirmation each stock is missing" },
      { label: "🏆 Top7", prompt: "Show stocks in the BOGASTOCK Top7 ranking" },
      { label: "🏆 Top100", prompt: "Show stocks in the BOGASTOCK Top100 ranking" },
    ],
  };
}
