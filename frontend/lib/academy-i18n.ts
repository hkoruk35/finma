export type Locale = "en" | "es" | "pt" | "fr" | "tr" | "id";

export const LOCALES: { code: Locale; label: string; flag: string }[] = [
  { code: "en", label: "English",    flag: "🇺🇸" },
  { code: "es", label: "Español",    flag: "🇪🇸" },
  { code: "pt", label: "Português",  flag: "🇧🇷" },
  { code: "fr", label: "Français",   flag: "🇫🇷" },
  { code: "tr", label: "Türkçe",     flag: "🇹🇷" },
  { code: "id", label: "Indonesia",  flag: "🇮🇩" },
];

// ─────────────────────────────────────────────
// ACADEMY INDEX PAGE
// ─────────────────────────────────────────────
export const academyIndex = {
  hero: {
    en: {
      h1: "Stock Market Academy: Learn to Pick Winning Stocks with AI",
      sub: "Beginner to advanced strategies used by real AI systems analyzing 560 US stocks daily.",
      cta: "Start Free AI Stock Analysis",
    },
    es: {
      h1: "Academia del Mercado de Valores: Aprende a Elegir Acciones Ganadoras con IA",
      sub: "Estrategias de principiante a avanzado utilizadas por sistemas de IA reales que analizan 560 acciones de EE. UU. diariamente.",
      cta: "Inicia el Análisis Gratuito de Acciones con IA",
    },
    pt: {
      h1: "Academia do Mercado de Ações: Aprenda a Escolher Ações Vencedoras com IA",
      sub: "Estratégias para iniciantes e avançados usadas por sistemas de IA reais que analisam 560 ações dos EUA diariamente.",
      cta: "Iniciar Análise Gratuita de Ações com IA",
    },
    fr: {
      h1: "Académie Bourse: Apprenez à Sélectionner des Actions Gagnantes avec l'IA",
      sub: "Stratégies du débutant à l'expert utilisées par de vrais systèmes d'IA analysant 560 actions américaines chaque jour.",
      cta: "Démarrer l'Analyse Gratuite des Actions IA",
    },
    tr: {
      h1: "Borsa Akademisi: Yapay Zeka ile Kazanan Hisseleri Seçmeyi Öğren",
      sub: "Gerçek yapay zeka sistemleri tarafından kullanılan, günlük 560 ABD hissesini analiz eden başlangıçtan ileri seviyeye kadar stratejiler.",
      cta: "Ücretsiz Yapay Zeka Hisse Analizini Başlat",
    },
    id: {
      h1: "Akademi Pasar Saham: Pelajari Cara Memilih Saham Pemenang dengan AI",
      sub: "Strategi pemula hingga lanjutan yang digunakan oleh sistem AI nyata yang menganalisis 560 saham AS setiap hari.",
      cta: "Mulai Analisis Saham AI Gratis",
    },
  },
  levels: {
    en: [
      { level: "Level 1", badge: "Beginner", color: "#22c55e", desc: "Master the fundamentals of stock market investing" },
      { level: "Level 2", badge: "Intermediate", color: "#f59e0b", desc: "Learn the technical tools that pros use every day" },
      { level: "Level 3", badge: "BOGA AI Edge", color: "#3b82f6", desc: "Understand how AI finds winning stocks before humans do" },
    ],
    es: [
      { level: "Nivel 1", badge: "Principiante", color: "#22c55e", desc: "Domina los fundamentos de la inversión en bolsa" },
      { level: "Nivel 2", badge: "Intermedio", color: "#f59e0b", desc: "Aprende las herramientas técnicas que los profesionales usan cada día" },
      { level: "Nivel 3", badge: "Ventaja BOGA AI", color: "#3b82f6", desc: "Entiende cómo la IA encuentra acciones ganadoras antes que los humanos" },
    ],
    pt: [
      { level: "Nível 1", badge: "Iniciante", color: "#22c55e", desc: "Domine os fundamentos do investimento em ações" },
      { level: "Nível 2", badge: "Intermediário", color: "#f59e0b", desc: "Aprenda as ferramentas técnicas que os profissionais usam todo dia" },
      { level: "Nível 3", badge: "Vantagem BOGA AI", color: "#3b82f6", desc: "Entenda como a IA encontra ações vencedoras antes dos humanos" },
    ],
    fr: [
      { level: "Niveau 1", badge: "Débutant", color: "#22c55e", desc: "Maîtrisez les fondamentaux de l'investissement en bourse" },
      { level: "Niveau 2", badge: "Intermédiaire", color: "#f59e0b", desc: "Apprenez les outils techniques qu'utilisent les professionnels chaque jour" },
      { level: "Niveau 3", badge: "Avantage BOGA AI", color: "#3b82f6", desc: "Comprenez comment l'IA trouve des actions gagnantes avant les humains" },
    ],
    tr: [
      { level: "Seviye 1", badge: "Başlangıç", color: "#22c55e", desc: "Borsa yatırımının temellerinde ustalaş" },
      { level: "Seviye 2", badge: "Orta Düzey", color: "#f59e0b", desc: "Profesyonellerin her gün kullandığı teknik araçları öğren" },
      { level: "Seviye 3", badge: "BOGA AI Avantajı", color: "#3b82f6", desc: "Yapay zekanın insanlardan önce nasıl kazanan hisseler bulduğunu anla" },
    ],
    id: [
      { level: "Tingkat 1", badge: "Pemula", color: "#22c55e", desc: "Kuasai dasar-dasar investasi pasar saham" },
      { level: "Tingkat 2", badge: "Menengah", color: "#f59e0b", desc: "Pelajari alat teknis yang digunakan para profesional setiap hari" },
      { level: "Tingkat 3", badge: "Keunggulan BOGA AI", color: "#3b82f6", desc: "Pahami bagaimana AI menemukan saham pemenang sebelum manusia" },
    ],
  },
};

// ─────────────────────────────────────────────
// ARTICLE: HOW TO START INVESTING
// ─────────────────────────────────────────────
export const articleInvesting = {
  meta: {
    en: {
      title: "How to Start Investing in US Stocks (Beginner Guide 2026)",
      description: "Complete beginner guide to investing in US stocks. Step-by-step strategy, risk management, and how AI stock analysis can help you buy better.",
      keywords: ["how to invest in stocks USA", "beginner stock investing", "US stock market guide 2026"],
    },
    es: {
      title: "Cómo Empezar a Invertir en Acciones de EE. UU. (Guía para Principiantes 2026)",
      description: "Guía completa para principiantes sobre cómo invertir en acciones de EE. UU. Estrategia paso a paso, gestión de riesgos y análisis de acciones con IA.",
      keywords: ["cómo invertir en acciones USA", "invertir en bolsa principiantes"],
    },
    pt: {
      title: "Como Começar a Investir em Ações dos EUA (Guia para Iniciantes 2026)",
      description: "Guia completo para iniciantes sobre investimentos em ações dos EUA. Estratégia passo a passo, gestão de risco e como a IA pode ajudar.",
      keywords: ["como investir em ações EUA", "guia bolsa de valores iniciantes"],
    },
    fr: {
      title: "Comment Commencer à Investir en Bourse Américaine (Guide Débutant 2026)",
      description: "Guide complet pour débutants sur l'investissement en actions américaines. Stratégie étape par étape, gestion des risques et analyse IA.",
      keywords: ["comment investir en bourse américaine", "guide débutant bourse"],
    },
    tr: {
      title: "ABD Borsasında Yatırıma Nasıl Başlanır? (Başlangıç Rehberi 2026)",
      description: "ABD hisselerine yatırım için kapsamlı başlangıç rehberi. Adım adım strateji, risk yönetimi ve yapay zeka hisse analizi.",
      keywords: ["ABD hisselerine yatırım", "borsa başlangıç rehberi 2026"],
    },
    id: {
      title: "Cara Mulai Berinvestasi di Saham AS (Panduan Pemula 2026)",
      description: "Panduan lengkap pemula untuk berinvestasi di saham AS. Strategi langkah demi langkah, manajemen risiko, dan analisis saham AI.",
      keywords: ["cara investasi saham AS", "panduan pemula saham"],
    },
  },
  content: {
    en: {
      h1: "How to Start Investing in US Stocks (Beginner Guide 2026)",
      intro: "Investing in US stocks is one of the most effective ways to build long-term wealth. Whether you're a complete beginner or looking to improve your strategy, this step-by-step guide will give you everything you need to start confidently.",
      sections: [
        {
          h2: "Step 1 – Understand What the Stock Market Is",
          body: "The US stock market consists of two major exchanges: the Nasdaq (home to technology giants like Apple and NVIDIA) and the NYSE (traditional powerhouses like JPMorgan and ExxonMobil). When you buy a stock, you purchase a small ownership stake in a company. If the company grows, so does your investment — and vice versa.",
          link: { label: "Learn more: Nasdaq vs NYSE Explained", href: "/academy/nasdaq-vs-nyse" },
        },
        {
          h2: "Step 2 – Choose a Strategy That Fits Your Goals",
          body: "There are three main approaches: \n• Long-term investing (buy and hold for years)\n• Swing trading (hold for days to weeks)\n• Momentum trading (capture fast-moving trends)\n\nBeginners are usually best served by a long-term strategy. As you gain experience, you can layer in more tactical approaches.",
          link: { label: "Related: Momentum Trading Explained", href: "/academy/momentum-trading" },
        },
        {
          h2: "Step 3 – Master the Basics of Risk Management",
          body: "The single biggest mistake new investors make is putting too much money into a single stock. Follow these core rules:\n• Never invest more than 5–10% of your portfolio in one position\n• Always use stop-loss levels to limit downside\n• Avoid making emotional decisions during market volatility\n• Diversify across sectors (tech, healthcare, energy, etc.)",
          link: { label: "Related: Risk Management Guide", href: "/academy/risk-management" },
        },
        {
          h2: "Step 4 – Learn to Analyze Stocks",
          body: "Traditional stock analysis involves reading earnings reports, following news, and interpreting technical price charts. Key metrics include Price-to-Earnings (P/E) ratio, revenue growth, and RSI (Relative Strength Index). Understanding these gives you a foundation, but the learning curve can be steep.",
          link: { label: "Related: RSI Indicator Explained", href: "/academy/rsi-indicator" },
        },
        {
          h2: "Step 5 – Use AI to Find the Best Stocks Faster",
          body: "Modern AI systems can scan entire markets in seconds — doing the work of hundreds of analysts. Instead of spending hours researching, AI models analyze thousands of data points across 560 stocks and surface the highest-conviction opportunities every single morning.",
          link: { label: "Learn more: How AI Stock Picking Works", href: "/academy/ai-stock-picking" },
          cta: true,
        },
      ],
      cta_text: "Want AI to find the best stocks for you every day?",
      cta_btn: "Start Free AI Stock Analysis",
    },
    es: {
      h1: "Cómo Empezar a Invertir en Acciones de EE. UU. (Guía para Principiantes 2026)",
      intro: "Invertir en acciones de EE. UU. es una de las formas más efectivas de construir riqueza a largo plazo. Ya seas un principiante completo o quieras mejorar tu estrategia, esta guía paso a paso te dará todo lo que necesitas para empezar con confianza.",
      sections: [
        { h2: "Paso 1 – Entiende Qué es el Mercado de Valores", body: "El mercado de valores de EE. UU. consta de dos bolsas principales: Nasdaq (empresas tecnológicas como Apple y NVIDIA) y NYSE (grandes empresas tradicionales como JPMorgan). Cuando compras una acción, adquieres una pequeña participación en una empresa.", link: { label: "Más info: Diferencias entre Nasdaq y NYSE", href: "/academy/nasdaq-vs-nyse" } },
        { h2: "Paso 2 – Elige una Estrategia", body: "Hay tres enfoques principales: inversión a largo plazo, swing trading y trading de momentum. Los principiantes suelen beneficiarse más de la estrategia a largo plazo.", link: { label: "Relacionado: Qué es el Momentum Trading", href: "/academy/momentum-trading" } },
        { h2: "Paso 3 – Gestión del Riesgo", body: "El mayor error de los nuevos inversores es concentrar demasiado en una sola acción. Diversifica entre sectores, usa stop-loss y evita las decisiones emocionales.", link: { label: "Relacionado: Guía de Gestión del Riesgo", href: "/academy/risk-management" } },
        { h2: "Paso 4 – Aprende a Analizar Acciones", body: "El análisis tradicional incluye leer informes de ganancias, seguir las noticias e interpretar gráficos técnicos. Métricas clave: P/E ratio, crecimiento de ingresos y RSI.", link: { label: "Relacionado: Explicación del Indicador RSI", href: "/academy/rsi-indicator" } },
        { h2: "Paso 5 – Usa la IA para Encontrar las Mejores Acciones", body: "Los sistemas de IA modernos pueden escanear mercados enteros en segundos. En lugar de pasar horas investigando, los modelos de IA analizan 560 acciones y presentan las mejores oportunidades cada mañana.", link: { label: "Aprende más: Cómo Funciona la IA en la Selección de Acciones", href: "/academy/ai-stock-picking" }, cta: true },
      ],
      cta_text: "¿Quieres que la IA encuentre las mejores acciones por ti cada día?",
      cta_btn: "Inicia el Análisis Gratuito con IA",
    },
    pt: {
      h1: "Como Começar a Investir em Ações dos EUA (Guia para Iniciantes 2026)",
      intro: "Investir em ações dos EUA é uma das formas mais eficazes de construir riqueza a longo prazo. Este guia passo a passo vai te dar tudo que você precisa para começar com confiança.",
      sections: [
        { h2: "Passo 1 – Entenda o que é o Mercado de Ações", body: "O mercado de ações dos EUA possui duas grandes bolsas: Nasdaq (empresas de tecnologia como Apple e NVIDIA) e NYSE (empresas tradicionais como JPMorgan). Quando você compra uma ação, adquire uma pequena participação em uma empresa.", link: { label: "Saiba mais: Diferenças entre Nasdaq e NYSE", href: "/academy/nasdaq-vs-nyse" } },
        { h2: "Passo 2 – Escolha uma Estratégia", body: "As três abordagens principais são: investimento de longo prazo, swing trading e trading de momentum. Iniciantes geralmente se beneficiam mais da estratégia de longo prazo.", link: { label: "Relacionado: O que é Momentum Trading", href: "/academy/momentum-trading" } },
        { h2: "Passo 3 – Gestão de Risco", body: "O maior erro dos novos investidores é concentrar muito em uma única ação. Diversifique entre setores, use stop-loss e evite decisões emocionais.", link: { label: "Relacionado: Guia de Gestão de Risco", href: "/academy/risk-management" } },
        { h2: "Passo 4 – Aprenda a Analisar Ações", body: "A análise tradicional inclui ler relatórios de resultados, acompanhar notícias e interpretar gráficos técnicos. Métricas-chave: índice P/L, crescimento de receita e RSI.", link: { label: "Relacionado: RSI Explicado", href: "/academy/rsi-indicator" } },
        { h2: "Passo 5 – Use IA para Encontrar as Melhores Ações", body: "Sistemas de IA modernos varrem mercados inteiros em segundos, analisando 560 ações e apresentando as melhores oportunidades toda manhã.", link: { label: "Saiba mais: Como Funciona a Seleção de Ações com IA", href: "/academy/ai-stock-picking" }, cta: true },
      ],
      cta_text: "Quer que a IA encontre as melhores ações para você todos os dias?",
      cta_btn: "Iniciar Análise Gratuita de IA",
    },
    fr: {
      h1: "Comment Commencer à Investir en Bourse Américaine (Guide Débutant 2026)",
      intro: "Investir dans les actions américaines est l'un des moyens les plus efficaces de bâtir un patrimoine à long terme. Ce guide étape par étape vous donnera tout ce dont vous avez besoin pour démarrer en toute confiance.",
      sections: [
        { h2: "Étape 1 – Comprendre le Marché Boursier", body: "Le marché boursier américain comprend deux grandes bourses : le Nasdaq (entreprises technologiques comme Apple et NVIDIA) et le NYSE (grandes sociétés traditionnelles comme JPMorgan). Acheter une action, c'est acquérir une petite part de propriété dans une entreprise.", link: { label: "En savoir plus: Nasdaq vs NYSE", href: "/academy/nasdaq-vs-nyse" } },
        { h2: "Étape 2 – Choisir une Stratégie", body: "Il existe trois approches principales : l'investissement à long terme, le swing trading et le trading de momentum. Les débutants bénéficient généralement le plus d'une stratégie à long terme.", link: { label: "Connexe: Le Trading de Momentum Expliqué", href: "/academy/momentum-trading" } },
        { h2: "Étape 3 – Gestion des Risques", body: "La plus grande erreur des nouveaux investisseurs est de trop concentrer sur une seule action. Diversifiez entre les secteurs, utilisez des stop-loss et évitez les décisions émotionnelles.", link: { label: "Connexe: Guide de Gestion des Risques", href: "/academy/risk-management" } },
        { h2: "Étape 4 – Apprendre à Analyser les Actions", body: "L'analyse traditionnelle comprend la lecture des rapports de résultats, le suivi des actualités et l'interprétation des graphiques techniques. Métriques clés : ratio P/E, croissance des revenus et RSI.", link: { label: "Connexe: L'Indicateur RSI Expliqué", href: "/academy/rsi-indicator" } },
        { h2: "Étape 5 – Utiliser l'IA pour Trouver les Meilleures Actions", body: "Les systèmes d'IA modernes peuvent scanner des marchés entiers en quelques secondes, analysant 560 actions et présentant les meilleures opportunités chaque matin.", link: { label: "En savoir plus: Comment Fonctionne la Sélection d'Actions par IA", href: "/academy/ai-stock-picking" }, cta: true },
      ],
      cta_text: "Vous voulez que l'IA trouve les meilleures actions pour vous chaque jour ?",
      cta_btn: "Démarrer l'Analyse Gratuite IA",
    },
    tr: {
      h1: "ABD Borsasında Yatırıma Nasıl Başlanır? (Başlangıç Rehberi 2026)",
      intro: "ABD hisselerine yatırım, uzun vadeli servet oluşturmanın en etkili yollarından biridir. Bu adım adım rehber, güvenle başlamak için ihtiyacınız olan her şeyi sağlayacaktır.",
      sections: [
        { h2: "Adım 1 – Borsa Nedir?", body: "ABD borsası iki büyük borsadan oluşur: Nasdaq (Apple ve NVIDIA gibi teknoloji şirketleri) ve NYSE (JPMorgan gibi geleneksel büyük şirketler). Bir hisse satın aldığınızda, bir şirkette küçük bir sahiplik payı edinirsiniz.", link: { label: "Daha fazla: Nasdaq ve NYSE Farkları", href: "/academy/nasdaq-vs-nyse" } },
        { h2: "Adım 2 – Bir Strateji Seçin", body: "Üç ana yaklaşım vardır: uzun vadeli yatırım, swing trading ve momentum trading. Yeni başlayanlar genellikle uzun vadeli stratejiden en çok fayda sağlar.", link: { label: "İlgili: Momentum Trading Nedir?", href: "/academy/momentum-trading" } },
        { h2: "Adım 3 – Risk Yönetimi", body: "Yeni yatırımcıların en büyük hatası tek bir hisseye çok fazla para yatırmaktır. Sektörler arasında çeşitlendirin, stop-loss kullanın ve duygusal kararlardan kaçının.", link: { label: "İlgili: Risk Yönetimi Rehberi", href: "/academy/risk-management" } },
        { h2: "Adım 4 – Hisse Analizi Öğrenin", body: "Geleneksel analiz; kazanç raporları okumayı, haberleri takip etmeyi ve teknik grafikleri yorumlamayı içerir. Temel metrikler: F/K oranı, gelir büyümesi ve RSI.", link: { label: "İlgili: RSI Göstergesi Açıklaması", href: "/academy/rsi-indicator" } },
        { h2: "Adım 5 – Yapay Zeka ile En İyi Hisseleri Bulun", body: "Modern yapay zeka sistemleri tüm piyasaları saniyeler içinde tarayabilir; 560 hisseyi analiz ederek her sabah en yüksek potansiyelli fırsatları öne çıkarır.", link: { label: "Daha fazla: Yapay Zeka Hisse Seçimi Nasıl Çalışır?", href: "/academy/ai-stock-picking" }, cta: true },
      ],
      cta_text: "Yapay zekanın sizin için her gün en iyi hisseleri bulmasını ister misiniz?",
      cta_btn: "Ücretsiz Yapay Zeka Analizini Başlat",
    },
    id: {
      h1: "Cara Mulai Berinvestasi di Saham AS (Panduan Pemula 2026)",
      intro: "Berinvestasi di saham AS adalah salah satu cara paling efektif untuk membangun kekayaan jangka panjang. Panduan langkah demi langkah ini akan memberi Anda semua yang dibutuhkan untuk memulai dengan percaya diri.",
      sections: [
        { h2: "Langkah 1 – Pahami Pasar Saham", body: "Pasar saham AS memiliki dua bursa utama: Nasdaq (perusahaan teknologi seperti Apple dan NVIDIA) dan NYSE (perusahaan tradisional besar seperti JPMorgan). Membeli saham berarti mendapatkan kepemilikan kecil di sebuah perusahaan.", link: { label: "Pelajari: Perbedaan Nasdaq vs NYSE", href: "/academy/nasdaq-vs-nyse" } },
        { h2: "Langkah 2 – Pilih Strategi", body: "Ada tiga pendekatan utama: investasi jangka panjang, swing trading, dan momentum trading. Pemula biasanya paling diuntungkan dengan strategi jangka panjang.", link: { label: "Terkait: Apa itu Momentum Trading?", href: "/academy/momentum-trading" } },
        { h2: "Langkah 3 – Manajemen Risiko", body: "Kesalahan terbesar investor baru adalah menaruh terlalu banyak uang di satu saham. Diversifikasi antar sektor, gunakan stop-loss, dan hindari keputusan emosional.", link: { label: "Terkait: Panduan Manajemen Risiko", href: "/academy/risk-management" } },
        { h2: "Langkah 4 – Pelajari Analisis Saham", body: "Analisis tradisional meliputi membaca laporan keuangan, mengikuti berita, dan menafsirkan grafik teknis. Metrik kunci: rasio P/E, pertumbuhan pendapatan, dan RSI.", link: { label: "Terkait: RSI Dijelaskan", href: "/academy/rsi-indicator" } },
        { h2: "Langkah 5 – Gunakan AI untuk Menemukan Saham Terbaik", body: "Sistem AI modern dapat memindai seluruh pasar dalam hitungan detik, menganalisis 560 saham dan menyajikan peluang terbaik setiap pagi.", link: { label: "Pelajari: Cara Kerja Pemilihan Saham AI", href: "/academy/ai-stock-picking" }, cta: true },
      ],
      cta_text: "Ingin AI menemukan saham terbaik untuk Anda setiap hari?",
      cta_btn: "Mulai Analisis Saham AI Gratis",
    },
  },
};

// ─────────────────────────────────────────────
// ARTICLE: RSI INDICATOR
// ─────────────────────────────────────────────
export const articleRsi = {
  meta: {
    en: {
      title: "RSI Indicator Explained: How to Spot Overbought and Oversold Stocks",
      description: "Learn what the RSI (Relative Strength Index) is, how to read overbought and oversold signals, and how AI tracks RSI across 560 stocks automatically.",
      keywords: ["RSI indicator", "RSI stock trading", "overbought oversold stocks"],
    },
    es: { title: "Indicador RSI Explicado: Cómo Detectar Acciones Sobrecompradas y Sobrevendidas", description: "Aprende qué es el RSI, cómo leer las señales de sobrecompra y sobreventa, y cómo la IA rastrea el RSI en 560 acciones.", keywords: ["indicador RSI", "RSI trading acciones"] },
    pt: { title: "Indicador RSI Explicado: Como Identificar Ações Sobrecompradas e Sobrevendidas", description: "Aprenda o que é o RSI, como ler sinais de sobrecompra e sobrevenda, e como a IA rastreia o RSI em 560 ações automaticamente.", keywords: ["indicador RSI", "RSI bolsa de valores"] },
    fr: { title: "L'Indicateur RSI Expliqué: Comment Repérer les Actions Surachetées et Survendues", description: "Apprenez ce qu'est le RSI, comment lire les signaux de surachat et de survente, et comment l'IA suit le RSI sur 560 actions.", keywords: ["indicateur RSI", "RSI trading actions"] },
    tr: { title: "RSI Göstergesi Açıklandı: Aşırı Alınan ve Aşırı Satılan Hisseler Nasıl Tespit Edilir", description: "RSI'nın ne olduğunu, aşırı alım ve aşırı satım sinyallerini nasıl okuyacağınızı ve yapay zekanın 560 hissede RSI'ı nasıl takip ettiğini öğrenin.", keywords: ["RSI göstergesi", "RSI hisse analizi"] },
    id: { title: "Indikator RSI Dijelaskan: Cara Mendeteksi Saham Overbought dan Oversold", description: "Pelajari apa itu RSI, cara membaca sinyal overbought dan oversold, dan bagaimana AI melacak RSI di 560 saham secara otomatis.", keywords: ["indikator RSI", "RSI trading saham"] },
  },
  content: {
    en: {
      h1: "RSI Indicator Explained: How to Spot Overbought and Oversold Stocks",
      intro: "The RSI (Relative Strength Index) is one of the most widely used technical indicators in stock trading. Used by retail traders and institutional investors alike, RSI tells you whether a stock is overbought, oversold, or moving with healthy momentum.",
      sections: [
        { h2: "What Is RSI?", body: "RSI is a momentum oscillator that measures the speed and magnitude of a stock's recent price changes. It outputs a value between 0 and 100:\n• Above 70 → Overbought (the stock may be due for a pullback)\n• Below 30 → Oversold (the stock may be due for a rebound)\n• 30–70 → Neutral zone (the trend continues)" },
        { h2: "Why RSI Matters for Traders", body: "RSI helps traders:\n• Avoid buying a stock at its peak\n• Identify potential reversal points before they happen\n• Confirm trend strength before entering a position\n• Filter out false breakout signals" },
        { h2: "How to Use RSI in Real Trading", body: "RSI Example:\n• NVDA RSI = 78 → Caution, stock may retreat\n• RIVN RSI = 24 → Potential buy zone for reversal traders\n\nKey rule: Never use RSI alone. Always combine it with volume data, trend direction, and at least one other indicator for confirmation." },
        { h2: "RSI Divergence: The Advanced Signal", body: "RSI divergence occurs when the price moves in one direction but RSI moves in the opposite direction — a powerful early warning of a trend reversal. Bullish divergence (price down, RSI rising) is one of the most reliable buy signals in technical analysis.", link: { label: "Related: Support & Resistance", href: "/academy/support-resistance" } },
        { h2: "How AI Uses RSI Automatically", body: "Manually tracking RSI across hundreds of stocks is nearly impossible for a human. BOGA AI monitors RSI for all 560 stocks in the universe in real-time — combining it with volume, momentum, and trend data to generate a master score. When RSI hits oversold levels alongside strong momentum, the AI flags it as a high-conviction opportunity.", link: { label: "Learn more: AI Stock Picking Explained", href: "/academy/ai-stock-picking" }, cta: true },
      ],
      cta_text: "Stop checking RSI manually across hundreds of stocks.",
      cta_btn: "Let AI Track RSI For You – Start Free",
    },
    es: {
      h1: "Indicador RSI Explicado: Cómo Detectar Acciones Sobrecompradas y Sobrevendidas",
      intro: "El RSI (Índice de Fuerza Relativa) es uno de los indicadores técnicos más utilizados en el trading de acciones. Tanto los traders minoristas como los inversores institucionales usan el RSI para determinar si una acción está sobrecomprada, sobrevendida o moviéndose con momentum saludable.",
      sections: [
        { h2: "¿Qué es el RSI?", body: "El RSI es un oscilador de momentum que mide la velocidad y magnitud de los cambios recientes de precio. Produce un valor entre 0 y 100:\n• Por encima de 70 → Sobrecomprado (posible retroceso)\n• Por debajo de 30 → Sobrevendido (posible rebote)\n• 30–70 → Zona neutral" },
        { h2: "Por Qué el RSI es Importante", body: "El RSI ayuda a los traders a evitar comprar en el pico, identificar reversiones potenciales y confirmar la fuerza de la tendencia antes de entrar en posición." },
        { h2: "Cómo Usar el RSI en el Trading Real", body: "Ejemplo: NVDA RSI = 78 → Precaución. RIVN RSI = 24 → Zona de compra potencial. Nunca uses el RSI solo — combínalo con volumen y otras señales." },
        { h2: "Divergencia RSI: La Señal Avanzada", body: "La divergencia RSI ocurre cuando el precio se mueve en una dirección pero el RSI en la dirección opuesta — una poderosa señal anticipada de reversión.", link: { label: "Relacionado: Soporte y Resistencia", href: "/academy/support-resistance" } },
        { h2: "Cómo la IA Usa el RSI Automáticamente", body: "BOGA AI monitorea el RSI de las 560 acciones en tiempo real, combinándolo con volumen, momentum y datos de tendencias para generar una puntuación maestra.", link: { label: "Aprende más: Selección de Acciones con IA", href: "/academy/ai-stock-picking" }, cta: true },
      ],
      cta_text: "Deja de revisar el RSI manualmente en cientos de acciones.",
      cta_btn: "Deja que la IA Rastree el RSI – Gratis",
    },
    pt: {
      h1: "Indicador RSI Explicado: Como Identificar Ações Sobrecompradas e Sobrevendidas",
      intro: "O RSI (Índice de Força Relativa) é um dos indicadores técnicos mais utilizados no trading de ações. Ele diz se uma ação está sobrecomprada, sobrevendida ou se movendo com momentum saudável.",
      sections: [
        { h2: "O que é o RSI?", body: "O RSI é um oscilador de momentum que mede a velocidade das mudanças de preço recentes. Valor entre 0 e 100:\n• Acima de 70 → Sobrecomprado\n• Abaixo de 30 → Sobrevendido\n• 30–70 → Zona neutra" },
        { h2: "Por que o RSI é Importante", body: "O RSI ajuda traders a evitar comprar no pico, identificar reversões potenciais e confirmar a força da tendência." },
        { h2: "Como Usar o RSI no Trading Real", body: "Exemplo: NVDA RSI = 78 → Atenção. RIVN RSI = 24 → Zona de compra potencial. Nunca use o RSI isoladamente — combine com volume e outras métricas." },
        { h2: "Divergência RSI: O Sinal Avançado", body: "A divergência RSI ocorre quando o preço vai numa direção mas o RSI vai na direção oposta — um aviso antecipado de reversão de tendência.", link: { label: "Relacionado: Suporte e Resistência", href: "/academy/support-resistance" } },
        { h2: "Como a IA Usa o RSI Automaticamente", body: "O BOGA AI monitora o RSI de todas as 560 ações em tempo real, combinando com volume, momentum e tendência para gerar uma pontuação mestre.", link: { label: "Saiba mais: Seleção de Ações com IA", href: "/academy/ai-stock-picking" }, cta: true },
      ],
      cta_text: "Pare de verificar o RSI manualmente em centenas de ações.",
      cta_btn: "Deixe a IA Rastrear o RSI por Você – Grátis",
    },
    fr: {
      h1: "L'Indicateur RSI Expliqué : Comment Repérer les Actions Surachetées et Survendues",
      intro: "Le RSI (Relative Strength Index) est l'un des indicateurs techniques les plus utilisés en bourse. Il indique si une action est surachetée, survendue ou en mouvement avec un momentum sain.",
      sections: [
        { h2: "Qu'est-ce que le RSI?", body: "Le RSI est un oscillateur de momentum mesurant la vitesse des variations de prix récentes. Valeur entre 0 et 100:\n• Au-dessus de 70 → Suracheté\n• En dessous de 30 → Survendu\n• 30–70 → Zone neutre" },
        { h2: "Pourquoi le RSI est Important", body: "Le RSI aide les traders à éviter d'acheter au sommet, identifier les retournements potentiels et confirmer la force d'une tendance." },
        { h2: "Comment Utiliser le RSI en Trading Réel", body: "Exemple: NVDA RSI = 78 → Prudence. RIVN RSI = 24 → Zone d'achat potentiel. Ne jamais utiliser le RSI seul — combinez avec le volume et d'autres indicateurs." },
        { h2: "Divergence RSI : Le Signal Avancé", body: "La divergence RSI se produit quand le prix va dans une direction mais le RSI dans la direction opposée — un signal d'alerte avancé de retournement de tendance.", link: { label: "Connexe: Support et Résistance", href: "/academy/support-resistance" } },
        { h2: "Comment l'IA Utilise le RSI Automatiquement", body: "BOGA AI surveille le RSI des 560 actions en temps réel, le combinant avec le volume, le momentum et les données de tendance pour générer un score maître.", link: { label: "En savoir plus: Sélection d'Actions par IA", href: "/academy/ai-stock-picking" }, cta: true },
      ],
      cta_text: "Arrêtez de vérifier le RSI manuellement sur des centaines d'actions.",
      cta_btn: "Laissez l'IA Surveiller le RSI – Gratuit",
    },
    tr: {
      h1: "RSI Göstergesi Açıklandı: Aşırı Alınan ve Aşırı Satılan Hisseler Nasıl Tespit Edilir",
      intro: "RSI (Göreceli Güç Endeksi), hisse ticaretinde en çok kullanılan teknik göstergelerden biridir. Bir hissenin aşırı alınmış, aşırı satılmış ya da sağlıklı momentum ile hareket edip etmediğini söyler.",
      sections: [
        { h2: "RSI Nedir?", body: "RSI, son fiyat değişikliklerinin hızını ve büyüklüğünü ölçen bir momentum osilatörüdür. 0 ile 100 arasında bir değer üretir:\n• 70'in üzerinde → Aşırı alım (geri çekilme olabilir)\n• 30'un altında → Aşırı satış (toparlanma olabilir)\n• 30–70 → Nötr bölge" },
        { h2: "RSI Neden Önemlidir?", body: "RSI, yatırımcıların zirve fiyattan alım yapmaktan kaçınmasına, potansiyel dönüş noktalarını erken tespit etmesine ve trend gücünü teyit etmesine yardımcı olur." },
        { h2: "RSI Gerçek Ticarette Nasıl Kullanılır?", body: "Örnek: NVDA RSI = 78 → Dikkat. RIVN RSI = 24 → Potansiyel alım bölgesi. RSI'yı asla tek başına kullanmayın — hacim ve diğer göstergelerle birleştirin." },
        { h2: "RSI Diverjansı: Gelişmiş Sinyal", body: "RSI diverjansı, fiyat bir yönde hareket ederken RSI'nın karşı yönde hareket etmesi durumunda ortaya çıkar — trend dönüşünün güçlü bir erken uyarı sinyali.", link: { label: "İlgili: Destek ve Direnç", href: "/academy/support-resistance" } },
        { h2: "Yapay Zeka RSI'yı Otomatik Olarak Nasıl Kullanır?", body: "BOGA AI, 560 hissenin RSI'sını gerçek zamanlı olarak izler; hacim, momentum ve trend verileriyle birleştirerek bir ana puan üretir.", link: { label: "Daha fazla: Yapay Zeka Hisse Seçimi Açıklaması", href: "/academy/ai-stock-picking" }, cta: true },
      ],
      cta_text: "Yüzlerce hissede RSI'ı manuel olarak takip etmeyi bırakın.",
      cta_btn: "Yapay Zekayı RSI'ı Takip Etsin – Ücretsiz",
    },
    id: {
      h1: "Indikator RSI Dijelaskan: Cara Mendeteksi Saham Overbought dan Oversold",
      intro: "RSI (Relative Strength Index) adalah salah satu indikator teknikal paling banyak digunakan dalam trading saham. RSI memberi tahu apakah sebuah saham overbought, oversold, atau bergerak dengan momentum yang sehat.",
      sections: [
        { h2: "Apa itu RSI?", body: "RSI adalah osilator momentum yang mengukur kecepatan perubahan harga terkini. Nilai antara 0 dan 100:\n• Di atas 70 → Overbought\n• Di bawah 30 → Oversold\n• 30–70 → Zona netral" },
        { h2: "Mengapa RSI Penting", body: "RSI membantu trader menghindari membeli di puncak, mengidentifikasi titik pembalikan, dan mengkonfirmasi kekuatan tren." },
        { h2: "Cara Menggunakan RSI dalam Trading Nyata", body: "Contoh: NVDA RSI = 78 → Hati-hati. RIVN RSI = 24 → Zona beli potensial. Jangan pernah gunakan RSI sendirian — kombinasikan dengan volume dan indikator lain." },
        { h2: "Divergensi RSI: Sinyal Lanjutan", body: "Divergensi RSI terjadi ketika harga bergerak ke satu arah tetapi RSI bergerak ke arah berlawanan — peringatan dini yang kuat akan pembalikan tren.", link: { label: "Terkait: Support dan Resistance", href: "/academy/support-resistance" } },
        { h2: "Cara AI Menggunakan RSI Secara Otomatis", body: "BOGA AI memantau RSI dari 560 saham secara real-time, mengombinasikannya dengan volume, momentum, dan data tren untuk menghasilkan skor master.", link: { label: "Pelajari: Pemilihan Saham oleh AI", href: "/academy/ai-stock-picking" }, cta: true },
      ],
      cta_text: "Berhenti periksa RSI secara manual di ratusan saham.",
      cta_btn: "Biarkan AI Lacak RSI untuk Anda – Gratis",
    },
  },
};

// ─────────────────────────────────────────────
// ARTICLE: MOMENTUM TRADING
// ─────────────────────────────────────────────
export const articleMomentum = {
  meta: {
    en: {
      title: "Momentum Trading Explained: How Stocks Start Moving Fast",
      description: "Master momentum trading strategy. Learn how to identify fast-moving stocks, why momentum works, and how AI detects momentum signals before they peak.",
      keywords: ["momentum trading", "momentum stocks", "how to trade momentum"],
    },
    es: { title: "Momentum Trading Explicado: Por Qué las Acciones Se Mueven Rápido", description: "Domina la estrategia de momentum trading. Aprende cómo identificar acciones de movimiento rápido y cómo la IA detecta señales de momentum.", keywords: ["momentum trading acciones", "cómo hacer momentum trading"] },
    pt: { title: "Momentum Trading Explicado: Como as Ações Começam a se Mover Rapidamente", description: "Domine a estratégia de momentum trading. Aprenda como identificar ações de movimento rápido e como a IA detecta sinais de momentum.", keywords: ["momentum trading ações", "trading de momentum"] },
    fr: { title: "Le Momentum Trading Expliqué : Comment les Actions Commencent à Se Déplacer Rapidement", description: "Maîtrisez le momentum trading. Apprenez à identifier les actions à mouvement rapide et comment l'IA détecte les signaux de momentum.", keywords: ["momentum trading", "actions momentum"] },
    tr: { title: "Momentum Trading Açıklandı: Hisseler Neden Hızlı Hareket Eder?", description: "Momentum trading stratejisinde ustalaşın. Hızlı hareket eden hisseleri nasıl tanıyacağınızı ve yapay zekanın momentum sinyallerini nasıl tespit ettiğini öğrenin.", keywords: ["momentum trading", "momentum hisse senetleri"] },
    id: { title: "Momentum Trading Dijelaskan: Bagaimana Saham Mulai Bergerak Cepat", description: "Kuasai strategi momentum trading. Pelajari cara mengidentifikasi saham bergerak cepat dan bagaimana AI mendeteksi sinyal momentum.", keywords: ["momentum trading", "saham momentum"] },
  },
  content: {
    en: {
      h1: "Momentum Trading Explained: How Stocks Start Moving Fast",
      intro: "Momentum trading is one of the most powerful and widely used strategies in the financial markets. The core principle is simple: stocks that are already moving tend to keep moving — and the right tools let you get in early.",
      sections: [
        { h2: "What Is Momentum Trading?", body: "Momentum trading is the practice of buying stocks that show strong upward trends and selling those that are declining. The philosophy is rooted in market psychology: when a stock starts moving, more traders notice, more capital flows in, and the move accelerates.\n\nKey characteristics of momentum stocks:\n• Price breaking above key resistance levels\n• Unusually high trading volume\n• Strong relative strength vs. the broader market" },
        { h2: "Why Momentum Works (The Science Behind It)", body: "Markets are driven by three forces: news catalysts (earnings beats, FDA approvals, product launches), institutional money flows (when large funds buy, prices rise significantly), and retail FOMO (fear of missing out creates self-fulfilling price moves).\n\nResearch consistently shows that high-momentum stocks outperform the market over 3–12 month periods — making momentum one of the most academically validated strategies." },
        { h2: "How to Identify Momentum Stocks", body: "Strong momentum signals include:\n• Price breaking above 20-day or 52-week highs\n• RSI between 55–70 (strong but not yet overbought)\n• Volume 1.5x or higher than the 30-day average\n• EMA stack: 20-day EMA above 50-day EMA above 200-day EMA\n• MACD showing a recent bullish crossover", link: { label: "Related: RSI Indicator Guide", href: "/academy/rsi-indicator" } },
        { h2: "Risks of Momentum Trading", body: "Momentum trading carries real risks:\n• Late entry means buying near the peak\n• Fake breakouts can reverse quickly and trigger stop-losses\n• High volatility requires precise position sizing\n• News-driven reversals can wipe out gains overnight\n\nAlways use stop-loss orders and never risk more than 2% of your portfolio on a single momentum trade." },
        { h2: "How AI Detects Momentum Early — Before It Peaks", body: "The challenge with momentum trading is timing. By the time most traders notice a move, the best entry point has already passed. BOGA AI scans all 560 stocks every morning, combining volume anomalies, EMA alignment, RSI levels, and MACD crossovers to identify momentum building before it becomes obvious to the market.", link: { label: "Learn more: AI Stock Picking Explained", href: "/academy/ai-stock-picking" }, cta: true },
      ],
      cta_text: "Want early momentum alerts before the crowd notices?",
      cta_btn: "Get AI Momentum Signals – Start Free",
    },
    es: {
      h1: "Momentum Trading Explicado: Por Qué las Acciones Se Mueven Rápido",
      intro: "El momentum trading es una de las estrategias más poderosas en los mercados financieros. El principio central es simple: las acciones que ya se están moviendo tienden a seguir moviéndose.",
      sections: [
        { h2: "¿Qué es el Momentum Trading?", body: "El momentum trading consiste en comprar acciones con fuertes tendencias alcistas. Las características clave incluyen precio por encima de niveles de resistencia, volumen inusualmente alto y fortaleza relativa vs. el mercado general." },
        { h2: "Por Qué Funciona el Momentum", body: "Los mercados son impulsados por tres fuerzas: catalizadores de noticias, flujos de dinero institucional y FOMO minorista. Las acciones de alto momentum superan al mercado consistentemente en períodos de 3–12 meses." },
        { h2: "Cómo Identificar Acciones de Momentum", body: "Señales fuertes de momentum: precio por encima de máximos de 52 semanas, RSI entre 55–70, volumen 1.5x superior al promedio de 30 días, stack de EMA alcista.", link: { label: "Relacionado: Guía del Indicador RSI", href: "/academy/rsi-indicator" } },
        { h2: "Riesgos del Momentum Trading", body: "Los riesgos incluyen entradas tardías, falsos breakouts y alta volatilidad. Siempre usa stop-loss y nunca arriesgues más del 2% de tu portfolio en un solo trade." },
        { h2: "Cómo la IA Detecta el Momentum Anticipadamente", body: "BOGA AI escanea las 560 acciones cada mañana, combinando anomalías de volumen, alineación de EMA y cruces MACD para identificar el momentum antes de que sea obvio.", link: { label: "Aprende más: IA en la Selección de Acciones", href: "/academy/ai-stock-picking" }, cta: true },
      ],
      cta_text: "¿Quieres alertas de momentum antes de que la multitud lo note?",
      cta_btn: "Obtén Señales de Momentum con IA – Gratis",
    },
    pt: {
      h1: "Momentum Trading Explicado: Como as Ações Começam a se Mover Rapidamente",
      intro: "O momentum trading é uma das estratégias mais poderosas nos mercados financeiros. O princípio central é simples: ações que já estão se movendo tendem a continuar se movendo.",
      sections: [
        { h2: "O que é Momentum Trading?", body: "O momentum trading consiste em comprar ações com fortes tendências de alta. Características-chave incluem preço acima de níveis de resistência importantes, volume incomumente alto e força relativa vs. o mercado geral." },
        { h2: "Por que o Momentum Funciona", body: "Os mercados são impulsionados por: catalisadores de notícias, fluxos de dinheiro institucional e FOMO de varejo. Pesquisas mostram que ações de alto momentum superam o mercado em períodos de 3–12 meses." },
        { h2: "Como Identificar Ações de Momentum", body: "Sinais fortes de momentum: preço acima das máximas de 52 semanas, RSI entre 55–70, volume 1,5x acima da média de 30 dias, stack EMA de alta.", link: { label: "Relacionado: Guia do Indicador RSI", href: "/academy/rsi-indicator" } },
        { h2: "Riscos do Momentum Trading", body: "Os riscos incluem entrada tardia, falsos rompimentos e alta volatilidade. Sempre use stop-loss e nunca arrisque mais de 2% do portfólio em um único trade." },
        { h2: "Como a IA Detecta o Momentum Antecipadamente", body: "O BOGA AI escaneia todas as 560 ações toda manhã, combinando anomalias de volume, alinhamento de EMA e cruzamentos MACD para identificar o momentum antes que se torne óbvio.", link: { label: "Saiba mais: Seleção de Ações com IA", href: "/academy/ai-stock-picking" }, cta: true },
      ],
      cta_text: "Quer alertas de momentum antes da multidão perceber?",
      cta_btn: "Receba Sinais de Momentum com IA – Grátis",
    },
    fr: {
      h1: "Le Momentum Trading Expliqué : Comment les Actions Commencent à Se Déplacer Rapidement",
      intro: "Le momentum trading est l'une des stratégies les plus puissantes sur les marchés financiers. Le principe de base est simple : les actions déjà en mouvement ont tendance à continuer.",
      sections: [
        { h2: "Qu'est-ce que le Momentum Trading?", body: "Le momentum trading consiste à acheter des actions avec de fortes tendances haussières. Les caractéristiques clés incluent un prix au-dessus des niveaux de résistance, un volume anormalement élevé et une force relative vs. le marché général." },
        { h2: "Pourquoi le Momentum Fonctionne", body: "Les marchés sont animés par : des catalyseurs d'actualité, des flux de capitaux institutionnels et le FOMO des particuliers. Les actions à fort momentum surperforment systématiquement sur des périodes de 3 à 12 mois." },
        { h2: "Comment Identifier les Actions de Momentum", body: "Signaux forts de momentum : prix au-dessus des plus hauts de 52 semaines, RSI entre 55–70, volume 1,5x au-dessus de la moyenne de 30 jours, stack EMA haussier.", link: { label: "Connexe: Guide de l'Indicateur RSI", href: "/academy/rsi-indicator" } },
        { h2: "Risques du Momentum Trading", body: "Les risques comprennent les entrées tardives, les faux breakouts et la forte volatilité. Utilisez toujours des stop-loss et ne risquez jamais plus de 2% de votre portefeuille sur un seul trade." },
        { h2: "Comment l'IA Détecte le Momentum en Avance", body: "BOGA AI scanne les 560 actions chaque matin, combinant anomalies de volume, alignement EMA et croisements MACD pour identifier le momentum avant qu'il ne devienne évident.", link: { label: "En savoir plus: Sélection d'Actions par IA", href: "/academy/ai-stock-picking" }, cta: true },
      ],
      cta_text: "Voulez-vous des alertes momentum avant que la foule ne le remarque ?",
      cta_btn: "Recevez des Signaux de Momentum IA – Gratuit",
    },
    tr: {
      h1: "Momentum Trading Açıklandı: Hisseler Neden Hızlı Hareket Eder?",
      intro: "Momentum trading, finansal piyasalardaki en güçlü stratejilerden biridir. Temel prensip basittir: zaten hareket eden hisseler hareket etmeye devam etme eğilimindedir.",
      sections: [
        { h2: "Momentum Trading Nedir?", body: "Momentum trading, güçlü yükseliş trendleri gösteren hisseleri satın alma pratiğidir. Temel özellikler: önemli direnç seviyelerinin üzerinde fiyat, olağandışı yüksek işlem hacmi ve genel piyasaya kıyasla güçlü rölatif güç." },
        { h2: "Momentum Neden İşe Yarar?", body: "Piyasalar üç güç tarafından yönlendirilir: haber katalizörleri, kurumsal para akışları ve bireysel FOMO. Araştırmalar, yüksek momentum'lu hisselerin 3–12 aylık dönemlerde tutarlı biçimde piyasayı geçtiğini göstermektedir." },
        { h2: "Momentum Hisseleri Nasıl Tanımlanır?", body: "Güçlü momentum sinyalleri: 52 haftanın zirvesinin üzerinde fiyat, RSI 55–70 arasında, 30 günlük ortalama hacmin 1,5 katı veya üzerinde hacim, yükseliş EMA yığını.", link: { label: "İlgili: RSI Göstergesi Rehberi", href: "/academy/rsi-indicator" } },
        { h2: "Momentum Trading'in Riskleri", body: "Riskler şunları içerir: geç giriş, sahte kırılmalar ve yüksek volatilite. Her zaman stop-loss kullanın ve tek bir momentum işleminde portföyünüzün %2'sinden fazlasını riske atmayın." },
        { h2: "Yapay Zeka Momentumu Erken Nasıl Tespit Eder?", body: "BOGA AI her sabah 560 hisseyi tarar; momentum'un bariz hale gelmeden önce tespit etmek için hacim anomalilerini, EMA hizalamasını ve MACD geçişlerini birleştirir.", link: { label: "Daha fazla: Yapay Zeka Hisse Seçimi", href: "/academy/ai-stock-picking" }, cta: true },
      ],
      cta_text: "Kalabalık fark etmeden önce momentum uyarıları almak ister misiniz?",
      cta_btn: "Yapay Zeka Momentum Sinyalleri Al – Ücretsiz",
    },
    id: {
      h1: "Momentum Trading Dijelaskan: Bagaimana Saham Mulai Bergerak Cepat",
      intro: "Momentum trading adalah salah satu strategi paling kuat di pasar keuangan. Prinsip intinya sederhana: saham yang sudah bergerak cenderung terus bergerak.",
      sections: [
        { h2: "Apa itu Momentum Trading?", body: "Momentum trading adalah praktik membeli saham yang menunjukkan tren naik yang kuat. Karakteristik utama: harga di atas level resistensi penting, volume perdagangan sangat tinggi, kekuatan relatif vs. pasar secara umum." },
        { h2: "Mengapa Momentum Bekerja", body: "Pasar digerakkan oleh tiga kekuatan: katalis berita, aliran uang institusional, dan FOMO ritel. Riset secara konsisten menunjukkan saham momentum tinggi mengungguli pasar selama 3–12 bulan." },
        { h2: "Cara Mengidentifikasi Saham Momentum", body: "Sinyal momentum kuat: harga di atas tertinggi 52 minggu, RSI antara 55–70, volume 1,5x di atas rata-rata 30 hari, tumpukan EMA bullish.", link: { label: "Terkait: Panduan Indikator RSI", href: "/academy/rsi-indicator" } },
        { h2: "Risiko Momentum Trading", body: "Risikonya mencakup entri terlambat, breakout palsu, dan volatilitas tinggi. Selalu gunakan stop-loss dan jangan pernah menaruh lebih dari 2% portofolio dalam satu trade momentum." },
        { h2: "Cara AI Mendeteksi Momentum Lebih Awal", body: "BOGA AI memindai semua 560 saham setiap pagi, menggabungkan anomali volume, keselarasan EMA, dan persimpangan MACD untuk mengidentifikasi momentum sebelum menjadi jelas.", link: { label: "Pelajari: Pemilihan Saham oleh AI", href: "/academy/ai-stock-picking" }, cta: true },
      ],
      cta_text: "Ingin peringatan momentum awal sebelum pasar menyadarinya?",
      cta_btn: "Dapatkan Sinyal Momentum AI – Gratis",
    },
  },
};

// ─────────────────────────────────────────────
// ARTICLE: AI STOCK PICKING
// ─────────────────────────────────────────────
export const articleAI = {
  meta: {
    en: {
      title: "AI Stock Picking Explained: How Algorithms Find Winning Stocks",
      description: "Understand how AI stock analysis works, what an AI score means, why 70+ matters, and how BOGA AI scans 560 stocks daily to find the best opportunities.",
      keywords: ["AI stock picking", "AI stock analysis", "algorithmic trading", "AI stock score"],
    },
    es: { title: "Selección de Acciones con IA Explicada: Cómo los Algoritmos Encuentran Acciones Ganadoras", description: "Entiende cómo funciona el análisis de acciones con IA, qué significa una puntuación de IA y cómo BOGA AI escanea 560 acciones diariamente.", keywords: ["selección de acciones IA", "análisis de acciones con IA"] },
    pt: { title: "Seleção de Ações por IA Explicada: Como Algoritmos Encontram Ações Vencedoras", description: "Entenda como funciona a análise de ações por IA, o que significa uma pontuação de IA e como o BOGA AI escaneia 560 ações diariamente.", keywords: ["seleção de ações IA", "análise de ações IA"] },
    fr: { title: "La Sélection d'Actions par IA Expliquée : Comment les Algorithmes Trouvent les Actions Gagnantes", description: "Comprenez comment fonctionne l'analyse d'actions par IA, ce que signifie un score IA et comment BOGA AI scanne 560 actions chaque jour.", keywords: ["sélection actions IA", "analyse actions IA"] },
    tr: { title: "Yapay Zeka Hisse Seçimi Açıklandı: Algoritmalar Kazanan Hisseleri Nasıl Bulur?", description: "Yapay zeka hisse analizinin nasıl çalıştığını, bir yapay zeka puanının ne anlama geldiğini ve BOGA AI'nın günlük olarak 560 hisseyi nasıl taradığını anlayın.", keywords: ["yapay zeka hisse seçimi", "AI hisse analizi"] },
    id: { title: "Pemilihan Saham AI Dijelaskan: Bagaimana Algoritma Menemukan Saham Pemenang", description: "Pahami cara kerja analisis saham AI, apa arti skor AI, dan bagaimana BOGA AI memindai 560 saham setiap hari.", keywords: ["pemilihan saham AI", "analisis saham AI"] },
  },
  content: {
    en: {
      h1: "AI Stock Picking Explained: How Algorithms Find Winning Stocks",
      intro: "Artificial Intelligence is fundamentally changing how investors select stocks. What once required teams of analysts working days can now be done by algorithms in seconds — with greater consistency and zero emotional bias.",
      sections: [
        { h2: "Traditional vs AI Investing: A Side-by-Side Comparison", body: "Traditional investing:\n• Manual analysis of each stock\n• Hours to research one position\n• Subject to emotional bias\n• Limited to ~10–20 stocks\n\nAI investing:\n• Hundreds of data points per stock\n• Seconds to analyze the full market\n• Completely emotion-free\n• Scalable to 500+ stocks simultaneously" },
        { h2: "How AI Stock Scoring Works", body: "AI systems evaluate multiple data categories and generate a combined master score:\n\n• Technical Score – RSI, MACD, EMA alignment, volume\n• Fundamental Score – P/E ratio, revenue growth, margins\n• Momentum Score – price trend, relative strength\n• Sentiment Score – news analysis, insider activity\n\nThese inputs are weighted and combined into a single 0–100 master score.\n\n• 70+ → High-conviction opportunity\n• 50–70 → Neutral (monitor)\n• Below 50 → Weak signal (avoid or short)" },
        { h2: "Why AI Is More Effective Than Human Analysis", body: "Three core advantages:\n\n1. Speed – AI processes 560 stocks in minutes. A human analyst needs weeks.\n2. Consistency – AI applies the same criteria to every stock, every time. Humans are inconsistent.\n3. Emotion-free – AI never panics, never chases, never holds a losing stock out of hope.\n\nStudies show that algorithmic systems consistently outperform human stock pickers over 5+ year periods.", link: { label: "Related: Manual vs Algorithmic Trading", href: "/academy/algorithmic-vs-manual" } },
        { h2: "Real BOGA AI Workflow: How We Analyze 560 Stocks Daily", body: "Every morning at 9:00 AM ET:\n\n1. Universe scan – all 560 US stocks are pulled\n2. Technical computation – 15+ indicators per stock\n3. Fundamental update – earnings, margins, valuation\n4. Scoring – each stock receives a 0–100 BOGA AI score\n5. Ranking – top 100 are selected\n6. Category assignment – Breakout, Momentum, Reversal, Value, Dividend\n7. AI summary – 1 sentence analysis per stock for context", link: { label: "Related: How to Start Investing", href: "/academy/how-to-start-investing" } },
        { h2: "Why AI Beats Human Emotion — Always", body: "The biggest enemy of the retail investor is their own psychology. Fear causes premature selling. Greed causes holding too long. Hope causes ignoring stop-losses.\n\nAI removes all of this. It doesn't care if a stock fell 20% — it scores based on data, not feelings. This structural advantage compounds over time into significantly better returns.", link: { label: "Related: RSI Indicator Guide", href: "/academy/rsi-indicator" }, cta: true },
      ],
      cta_text: "Let AI pick and score stocks for you — no manual research required.",
      cta_btn: "Unlock Free AI Stock Analysis",
    },
    es: {
      h1: "Selección de Acciones con IA Explicada: Cómo los Algoritmos Encuentran Acciones Ganadoras",
      intro: "La Inteligencia Artificial está cambiando fundamentalmente cómo los inversores seleccionan acciones. Lo que antes requería equipos de analistas ahora lo hacen algoritmos en segundos, con mayor consistencia y sin sesgo emocional.",
      sections: [
        { h2: "Inversión Tradicional vs. IA", body: "Inversión tradicional: análisis manual, horas de investigación, sujeto a sesgo emocional, limitado a 10–20 acciones. Inversión con IA: cientos de puntos de datos, segundos de análisis, sin emociones, escalable a 500+ acciones." },
        { h2: "Cómo Funciona la Puntuación de Acciones por IA", body: "Los sistemas de IA evalúan múltiples categorías: Puntuación Técnica (RSI, MACD, EMA), Puntuación Fundamental (P/E, crecimiento), Puntuación de Momentum y Sentimiento. Combinadas en un puntaje maestro de 0–100.\n• 70+ → Alta convicción\n• 50–70 → Neutral\n• Menos de 50 → Señal débil" },
        { h2: "Por Qué la IA Es Más Efectiva", body: "Tres ventajas principales: velocidad (560 acciones en minutos), consistencia (mismos criterios siempre) y sin emociones (nunca entra en pánico ni persigue tendencias).", link: { label: "Relacionado: Trading Manual vs. Algorítmico", href: "/academy/algorithmic-vs-manual" } },
        { h2: "Flujo de Trabajo Real de BOGA AI", body: "Cada mañana a las 9:00 AM ET: escaneo de 560 acciones, cálculo de 15+ indicadores técnicos, obtención de datos fundamentales, puntuación 0–100, ranking top 100 y asignación de categorías." },
        { h2: "Por Qué la IA Siempre Supera las Emociones Humanas", body: "El mayor enemigo del inversor minorista es su propia psicología. La IA elimina el miedo, la codicia y la esperanza — solo datos.", link: { label: "Relacionado: Guía RSI", href: "/academy/rsi-indicator" }, cta: true },
      ],
      cta_text: "Deja que la IA seleccione y puntúe acciones por ti — sin investigación manual.",
      cta_btn: "Desbloquea el Análisis Gratuito de Acciones con IA",
    },
    pt: {
      h1: "Seleção de Ações por IA Explicada: Como Algoritmos Encontram Ações Vencedoras",
      intro: "A Inteligência Artificial está transformando fundamentalmente como os investidores selecionam ações. O que antes exigia equipes de analistas durante dias agora é feito por algoritmos em segundos, com maior consistência e zero viés emocional.",
      sections: [
        { h2: "Investimento Tradicional vs. IA", body: "Investimento tradicional: análise manual, horas de pesquisa, sujeito a viés emocional, limitado a 10–20 ações. Investimento com IA: centenas de pontos de dados, segundos de análise, sem emoção, escalável para 500+ ações." },
        { h2: "Como Funciona a Pontuação de Ações por IA", body: "Os sistemas de IA avaliam múltiplas categorias: Pontuação Técnica (RSI, MACD, EMA), Pontuação Fundamental, Momentum e Sentimento. Combinadas em uma pontuação mestre de 0–100.\n• 70+ → Alta convicção\n• 50–70 → Neutro\n• Abaixo de 50 → Sinal fraco" },
        { h2: "Por que a IA É Mais Eficaz", body: "Três vantagens principais: velocidade (560 ações em minutos), consistência (mesmos critérios sempre) e sem emoção (nunca entra em pânico nem persegue tendências).", link: { label: "Relacionado: Trading Manual vs. Algorítmico", href: "/academy/algorithmic-vs-manual" } },
        { h2: "Fluxo de Trabalho Real do BOGA AI", body: "Toda manhã às 9:00 AM ET: varredura de 560 ações, cálculo de 15+ indicadores técnicos, atualização de dados fundamentais, pontuação 0–100, ranking top 100 e atribuição de categorias." },
        { h2: "Por que a IA Sempre Supera a Emoção Humana", body: "O maior inimigo do investidor individual é sua própria psicologia. A IA elimina o medo, a ganância e a esperança — apenas dados.", link: { label: "Relacionado: Guia RSI", href: "/academy/rsi-indicator" }, cta: true },
      ],
      cta_text: "Deixe a IA selecionar e pontuar ações para você — sem pesquisa manual.",
      cta_btn: "Desbloqueie a Análise Gratuita de Ações com IA",
    },
    fr: {
      h1: "La Sélection d'Actions par IA Expliquée : Comment les Algorithmes Trouvent les Actions Gagnantes",
      intro: "L'Intelligence Artificielle transforme fondamentalement la façon dont les investisseurs sélectionnent les actions. Ce qui nécessitait auparavant des équipes d'analystes peut maintenant être fait par des algorithmes en quelques secondes.",
      sections: [
        { h2: "Investissement Traditionnel vs. IA", body: "Investissement traditionnel: analyse manuelle, des heures de recherche, biais émotionnel, limité à 10–20 actions. Investissement IA: centaines de points de données, secondes d'analyse, sans émotion, évolutif à 500+ actions." },
        { h2: "Comment Fonctionne la Notation des Actions par IA", body: "Les systèmes d'IA évaluent plusieurs catégories: Score Technique (RSI, MACD, EMA), Score Fondamental, Momentum et Sentiment. Combinés en un score maître de 0–100.\n• 70+ → Haute conviction\n• 50–70 → Neutre\n• En dessous de 50 → Signal faible" },
        { h2: "Pourquoi l'IA Est Plus Efficace", body: "Trois avantages principaux: vitesse (560 actions en minutes), cohérence (mêmes critères à chaque fois) et sans émotion (jamais de panique ni de chasse aux tendances).", link: { label: "Connexe: Trading Manuel vs. Algorithmique", href: "/academy/algorithmic-vs-manual" } },
        { h2: "Flux de Travail Réel de BOGA AI", body: "Chaque matin à 9h00 ET: scan de 560 actions, calcul de 15+ indicateurs techniques, mise à jour des données fondamentales, notation 0–100, classement top 100 et attribution des catégories." },
        { h2: "Pourquoi l'IA Bat Toujours l'Émotion Humaine", body: "Le plus grand ennemi de l'investisseur particulier est sa propre psychologie. L'IA élimine la peur, l'avidité et l'espoir — uniquement des données.", link: { label: "Connexe: Guide RSI", href: "/academy/rsi-indicator" }, cta: true },
      ],
      cta_text: "Laissez l'IA sélectionner et noter les actions pour vous — sans recherche manuelle.",
      cta_btn: "Débloquez l'Analyse Gratuite d'Actions IA",
    },
    tr: {
      h1: "Yapay Zeka Hisse Seçimi Açıklandı: Algoritmalar Kazanan Hisseleri Nasıl Bulur?",
      intro: "Yapay Zeka, yatırımcıların hisse seçme biçimini kökten değiştirmektedir. Eskiden analist ekiplerinin günler içinde yapabildiği işlemler artık algoritmalar tarafından saniyeler içinde, daha büyük tutarlılık ve sıfır duygusal önyargıyla yapılabilmektedir.",
      sections: [
        { h2: "Geleneksel vs. Yapay Zeka Yatırımı", body: "Geleneksel yatırım: manuel analiz, saatler süren araştırma, duygusal önyargıya maruz, 10–20 hisseyle sınırlı. Yapay zeka yatırımı: hisse başına yüzlerce veri noktası, saniyeler içinde analiz, tamamen duygusuz, 500+ hisseye ölçeklenebilir." },
        { h2: "Yapay Zeka Hisse Puanlaması Nasıl Çalışır?", body: "Yapay zeka sistemleri birden fazla kategoriyi değerlendirir ve bunları birleşik bir ana puana dönüştürür:\n• Teknik Puan – RSI, MACD, EMA hizalaması\n• Temel Puan – F/K oranı, gelir büyümesi\n• Momentum Puanı\n• Duygu Puanı\n\n70+ → Yüksek inançlı fırsat\n50–70 → Nötr\n50'nin altı → Zayıf sinyal" },
        { h2: "Yapay Zeka Neden Daha Etkili?", body: "Üç temel avantaj: hız (560 hisseyi dakikalar içinde işler), tutarlılık (her seferinde aynı kriterleri uygular) ve duygusuzluk (asla paniklemez, kovalamazlar, umutla kaybeden hisseyi tutmaz).", link: { label: "İlgili: Manuel vs. Algoritmik Trading", href: "/academy/algorithmic-vs-manual" } },
        { h2: "Gerçek BOGA AI İş Akışı", body: "Her sabah saat 9:00 ET'de: 560 hissenin taranması, hisse başına 15+ teknik göstergenin hesaplanması, temel veri güncellemesi, 0–100 puanlama, top 100 sıralaması ve kategori atanması." },
        { h2: "Yapay Zeka İnsan Duygusunu Neden Her Zaman Yener?", body: "Bireysel yatırımcının en büyük düşmanı kendi psikolojisidir. Korku erken satışa neden olur, açgözlülük çok uzun tutmaya. Yapay zeka bunların tamamını ortadan kaldırır — sadece veriler.", link: { label: "İlgili: RSI Rehberi", href: "/academy/rsi-indicator" }, cta: true },
      ],
      cta_text: "Yapay zekanın hisselerinizi seçip puanlamasına izin verin — manuel araştırma gerekmez.",
      cta_btn: "Ücretsiz Yapay Zeka Hisse Analizini Aç",
    },
    id: {
      h1: "Pemilihan Saham AI Dijelaskan: Bagaimana Algoritma Menemukan Saham Pemenang",
      intro: "Kecerdasan Buatan secara fundamental mengubah cara investor memilih saham. Apa yang dulu membutuhkan tim analis berhari-hari kini dapat dilakukan oleh algoritma dalam hitungan detik, dengan konsistensi lebih tinggi dan nol bias emosional.",
      sections: [
        { h2: "Investasi Tradisional vs. AI", body: "Investasi tradisional: analisis manual, jam-jam riset, tunduk pada bias emosional, terbatas pada 10–20 saham. Investasi AI: ratusan titik data per saham, detik untuk analisis, bebas emosi, skalabel ke 500+ saham." },
        { h2: "Cara Kerja Penilaian Saham AI", body: "Sistem AI mengevaluasi beberapa kategori: Skor Teknis (RSI, MACD, EMA), Skor Fundamental, Momentum, dan Sentimen. Digabungkan menjadi skor master 0–100.\n• 70+ → Peluang high-conviction\n• 50–70 → Netral\n• Di bawah 50 → Sinyal lemah" },
        { h2: "Mengapa AI Lebih Efektif", body: "Tiga keunggulan utama: kecepatan (560 saham dalam menit), konsistensi (kriteria yang sama setiap saat), dan bebas emosi (tidak pernah panik, tidak pernah mengejar tren).", link: { label: "Terkait: Trading Manual vs. Algoritmik", href: "/academy/algorithmic-vs-manual" } },
        { h2: "Alur Kerja BOGA AI yang Sesungguhnya", body: "Setiap pagi pukul 09.00 ET: memindai 560 saham, menghitung 15+ indikator teknis, memperbarui data fundamental, penilaian 0–100, peringkat top 100, dan penetapan kategori." },
        { h2: "Mengapa AI Selalu Mengalahkan Emosi Manusia", body: "Musuh terbesar investor ritel adalah psikologi mereka sendiri. AI menghilangkan rasa takut, keserakahan, dan harapan — hanya data.", link: { label: "Terkait: Panduan RSI", href: "/academy/rsi-indicator" }, cta: true },
      ],
      cta_text: "Biarkan AI memilih dan menilai saham untuk Anda — tanpa riset manual.",
      cta_btn: "Buka Analisis Saham AI Gratis",
    },
  },
};
