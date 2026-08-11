// BOGA Copilot Authenticated Member Daily Kickoff & Interactive Suggestion Helpers

export type CopilotLang = "tr" | "en" | "es" | "fr" | "pt" | "id";

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
    case "id": return n ? `Halo ${n}!` : "Halo!";
    default: return n ? `Hello ${n}!` : "Hello!";
  }
}

export function buildMemberDailyGreeting(
  userName: string | null,
  favoriteSectors: string[],
  watchlistCount: number,
  lang: CopilotLang = "tr",
  isAnonymous: boolean = false
): DailyGreeting {
  if (lang === "tr") {
    const welcomeMessage =
      `${greetLine(lang, userName)} BOGASTOCK platformuna hoş geldiniz.\n\n` +
      `Sitedeki canlı panelleriniz üzerinden size rehberlik etmeye ve piyasayı analiz etmeye hazırım.\n\n` +
      `Bugün hangi konuyu veya mevcud erişilebilir listenizi incelemek istersiniz?`;

    const pills = isAnonymous
      ? [
          { label: "🏆 Top7", prompt: "BOGASTOCK Top7 sıralamasındaki hisseleri göster" },
          { label: "🚀 En Çok Yükselenler", prompt: "Top Gainers - Piyasada en çok yükselen hisseleri göster" },
          { label: "📉 En Çok Düşenler", prompt: "Top Losers - Piyasada en çok düşen hisseleri göster" },
          { label: "🏆 Top100 (İlk 10)", prompt: "BOGASTOCK Top100 listesinin ilk 10 hissesini göster" },
          { label: "🖥️ Terminal", prompt: "BOGASTOCK Terminal sayfasını ve özelliklerini incele" },
        ]
      : [
          { label: "⭐ İzleme Listem", prompt: "İzleme listemdeki hisseleri ve durumlarını göster" },
          { label: "🏆 Top7", prompt: "BOGASTOCK Top7 sıralamasındaki hisseleri göster" },
          { label: "🏆 Top100", prompt: "BOGASTOCK Top100 sıralamasındaki hisseleri göster" },
          { label: "💡 Bellek & AI Depolama", prompt: "Bellek Üreticiler & AI Depolama temasındaki hisseleri göster" },
          { label: "🚀 En Çok Yükselenler", prompt: "Piyasada en çok yükselen hisseleri göster" },
        ];

    return { welcomeMessage, pills };
  }

  if (lang === "pt") {
    const welcomeMessage =
      `${greetLine(lang, userName)} Bem-vindo à plataforma BOGASTOCK.\n\n` +
      `Estou pronto para guiá-lo e analisar o mercado com base nos seus painéis ativos.\n\n` +
      `Qual lista você gostaria de examinar hoje?`;

    const pills = isAnonymous
      ? [
          { label: "🏆 Top7", prompt: "Mostre as ações do ranking Top7" },
          { label: "🚀 Maiores Altas", prompt: "Mostre as maiores altas do mercado" },
          { label: "📉 Maiores Baixas", prompt: "Mostre as maiores baixas do mercado" },
          { label: "🏆 Top100 (Primeiras 10)", prompt: "Mostre as primeiras 10 ações da lista Top100" },
          { label: "🖥️ Terminal", prompt: "Explore a página e recursos do Terminal" },
        ]
      : [
          { label: "⭐ Minha Lista", prompt: "Mostre as ações da minha lista e seu status" },
          { label: "🏆 Top7", prompt: "Mostre as ações do ranking Top7" },
          { label: "🏆 Top100", prompt: "Mostre as ações do ranking Top100" },
          { label: "💡 Memória & IA", prompt: "Mostre as ações do tema Fabricantes de Memória & Armazenamento IA" },
          { label: "🚀 Maiores Altas", prompt: "Mostre as maiores altas do mercado" },
        ];

    return { welcomeMessage, pills };
  }

  if (lang === "es") {
    const welcomeMessage =
      `${greetLine(lang, userName)} Bienvenido a la plataforma BOGASTOCK.\n\n` +
      `Estoy listo para guiarte y analizar el mercado según tus paneles activos.\n\n` +
      `¿Qué lista te gustaría examinar hoy?`;

    const pills = isAnonymous
      ? [
          { label: "🏆 Top7", prompt: "Muestra las acciones del ranking Top7" },
          { label: "🚀 Más Ganadoras", prompt: "Muestra las acciones con mayores ganancias del mercado" },
          { label: "📉 Más Perdedoras", prompt: "Muestra las acciones con mayores pérdidas del mercado" },
          { label: "🏆 Top100 (Primeras 10)", prompt: "Muestra las primeras 10 acciones del Top100" },
          { label: "🖥️ Terminal", prompt: "Explora la página y funciones del Terminal" },
        ]
      : [
          { label: "⭐ Mi Lista", prompt: "Muestra las acciones de mi lista y su estado actual" },
          { label: "🏆 Top7", prompt: "Muestra las acciones del ranking Top7" },
          { label: "🏆 Top100", prompt: "Muestra las acciones del ranking Top100" },
          { label: "💡 Memoria e IA", prompt: "Muestra las acciones del tema Fabricantes de Memoria y Almacenamiento IA" },
          { label: "🚀 Más Ganadoras", prompt: "Muestra las acciones con mayores ganancias del mercado" },
        ];

    return { welcomeMessage, pills };
  }

  if (lang === "fr") {
    const welcomeMessage =
      `${greetLine(lang, userName)} Bienvenue sur la plateforme BOGASTOCK.\n\n` +
      `Je suis prêt à vous guider et à analyser le marché selon vos tableaux de bord actifs.\n\n` +
      `Quelle liste souhaitez-vous examiner aujourd'hui ?`;

    const pills = isAnonymous
      ? [
          { label: "🏆 Top7", prompt: "Montrez les actions du classement Top7" },
          { label: "🚀 Plus Fortes Hausses", prompt: "Montrez les plus fortes hausses du marché" },
          { label: "📉 Plus Fortes Baisses", prompt: "Montrez les plus fortes baisses du marché" },
          { label: "🏆 Top100 (10 Premières)", prompt: "Montrez les 10 premières actions de la liste Top100" },
          { label: "🖥️ Terminal", prompt: "Explorez la page et fonctionnalités du Terminal" },
        ]
      : [
          { label: "⭐ Ma Liste", prompt: "Montrez les actions de ma liste et leur état" },
          { label: "🏆 Top7", prompt: "Montrez les actions du classement Top7" },
          { label: "🏆 Top100", prompt: "Montrez les actions du classement Top100" },
          { label: "💡 Mémoire & IA", prompt: "Montrez les actions du thème Fabricants de Mémoire & Stockage IA" },
          { label: "🚀 Plus Fortes Hausses", prompt: "Montrez les plus fortes hausses du marché" },
        ];

    return { welcomeMessage, pills };
  }

  if (lang === "id") {
    const welcomeMessage =
      `${greetLine(lang, userName)} Selamat datang di platform BOGASTOCK.\n\n` +
      `Saya siap memandu Anda dan menganalisis pasar berdasarkan panel aktif Anda.\n\n` +
      `Daftar mana yang ingin Anda tinjau hari ini?`;

    const pills = isAnonymous
      ? [
          { label: "🏆 Top7", prompt: "Tampilkan saham dalam peringkat Top7 BOGASTOCK" },
          { label: "🚀 Penguat Teratas", prompt: "Tampilkan saham yang paling menguat di pasar" },
          { label: "📉 Pelemah Teratas", prompt: "Tampilkan saham yang paling melemah di pasar" },
          { label: "🏆 Top100 (10 Teratas)", prompt: "Tampilkan 10 saham teratas dalam daftar Top100 BOGASTOCK" },
          { label: "🖥️ Terminal", prompt: "Jelajahi halaman dan fitur Terminal BOGASTOCK" },
        ]
      : [
          { label: "⭐ Daftar Pantau Saya", prompt: "Tampilkan saham di daftar pantau saya beserta statusnya" },
          { label: "🏆 Top7", prompt: "Tampilkan saham dalam peringkat Top7 BOGASTOCK" },
          { label: "🏆 Top100", prompt: "Tampilkan saham dalam peringkat Top100 BOGASTOCK" },
          { label: "💡 Memori & Penyimpanan AI", prompt: "Tampilkan saham dalam tema Produsen Memori & Penyimpanan AI" },
          { label: "🚀 Penguat Teratas", prompt: "Tampilkan saham yang paling menguat di pasar" },
        ];

    return { welcomeMessage, pills };
  }

  // Default English
  const welcomeMessage =
    `${greetLine("en", userName)} Welcome to BOGASTOCK.\n\n` +
    `Ready to guide you and analyze the market based on your active dashboard panels.\n\n` +
    `Which list would you like to examine today?`;

  const pills = isAnonymous
    ? [
        { label: "🏆 Top7", prompt: "Show stocks in the BOGASTOCK Top7 ranking" },
        { label: "🚀 Top Gainers", prompt: "Show the top gainers in the market" },
        { label: "📉 Top Losers", prompt: "Show the top losers in the market" },
        { label: "🏆 Top100 (First 10)", prompt: "Show the first 10 stocks in the BOGASTOCK Top100 list" },
        { label: "🖥️ Terminal", prompt: "Examine BOGASTOCK Terminal page and features" },
      ]
    : [
        { label: "⭐ My Watchlist", prompt: "Show the stocks in my watchlist and their status" },
        { label: "🏆 Top7", prompt: "Show stocks in the BOGASTOCK Top7 ranking" },
        { label: "🏆 Top100", prompt: "Show stocks in the BOGASTOCK Top100 ranking" },
        { label: "💡 Memory & AI Storage", prompt: "Show stocks in the Memory Makers & AI Storage theme" },
        { label: "🚀 Top Gainers", prompt: "Show the top gainers in the market" },
      ];

  return { welcomeMessage, pills };
}
