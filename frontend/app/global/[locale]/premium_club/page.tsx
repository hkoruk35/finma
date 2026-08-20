import { Metadata } from "next";
import Link from "next/link";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";
import PricingSection from "@/components/global/PricingSection";
import PremiumClubCTA from "@/components/global/PremiumClubCTA";
import { HOT_THEMES_2026 } from "@/lib/hotThemes2026";

export const revalidate = 3600; // 60 dk — marketing/pricing sayfasi, canli veriye bagimli degil

const LOCALES = ["tr", "en", "es", "fr", "pt", "id"] as const;
type Locale = (typeof LOCALES)[number];

type Props = {
  params: Promise<{ locale: string }>;
};

interface Benefit {
  title: string;
  desc: string;
  linkLabel: string;
}

interface PageCopy {
  metaTitle: string;
  metaDescription: string;
  badge: string;
  heroTitle: string;
  heroTitleHighlight: string;
  heroSubtitle: string;
  ctaPrimary: string;
  ctaSecondary: string;
  priceNote: string;
  breadcrumbHome: string;
  breadcrumbCurrent: string;
  copilotBadge: string;
  copilotTitle: string;
  copilotDesc: string;
  benefitsTitle: string;
  benefits: Benefit[];
}

const COPY: Record<Locale, PageCopy> = {
  en: {
    metaTitle: "Premium Club — Unlock Full Access | BogaStock",
    metaDescription:
      "Join BogaStock Premium Club for $39/mo: full access to Trending Stocks, Top 100, Trade Plans, Theme lists, a 50-stock watchlist, a 9-chart multi-view, and 24/7 BogaStock Copilot AI.",
    badge: "PREMIUM CLUB",
    heroTitle: "Trade with the full power of",
    heroTitleHighlight: "BogaStock Premium Club",
    heroSubtitle:
      "One membership, complete access. Every signal, every list, every trade plan, and a personal AI assistant that never sleeps — for $39/month.",
    ctaPrimary: "Get Started →",
    ctaSecondary: "See Pricing & Features",
    priceNote: "Cancel anytime. No hidden fees.",
    breadcrumbHome: "Dashboard",
    breadcrumbCurrent: "Premium Club",
    copilotBadge: "THE #1 MEMBER ADVANTAGE",
    copilotTitle: "24/7 access to BogaStock Copilot — your personal financial AI",
    copilotDesc:
      "This is the single biggest reason members upgrade. BogaStock Copilot is a highly advanced, continuously learning financial AI assistant that develops personally around you — available around the clock to answer questions, scan the market, and walk you through every list, chart, and trade setup on the platform.",
    benefitsTitle: "Everything unlocked with Premium Club",
    benefits: [
      { title: "Trending Stocks (Swing)", desc: "Full, unrestricted access to the daily Trending Stocks list — the swing candidates other members only see a preview of.", linkLabel: "Open Trending Stocks" },
      { title: "Performance Tracking", desc: "Full access to every performance page — see exactly how each signal and pick has played out over time.", linkLabel: "Open Performance" },
      { title: "Top 100", desc: "Full access to the complete Top 100 ranked list, not just the first names.", linkLabel: "Open Top 100" },
      { title: "Trade Plans", desc: "Full access to Trade Plans for every stock with trading potential — entries, targets, and stop levels calculated for you.", linkLabel: "See a live example" },
      { title: "Trade Setup Rationale", desc: "Full access to the Trade Setup Rationale behind every plan — the EMA, volume, RSI, and VWAP logic explained in plain language.", linkLabel: "See a live example" },
      { title: "Theme Lists", desc: "Full access to, and tracking of, hundreds of stocks clustered into Theme lists — AI, semiconductors, space, robotics, and more.", linkLabel: "Browse Themes" },
      { title: "50-Stock Personal Watchlist", desc: "Build and track a personalized watchlist of up to 50 stocks, all in one place.", linkLabel: "Open My Watchlist" },
      { title: "9-Stock Multi-Chart Screen", desc: "Track up to 9 stocks side by side on a single screen with the multi-chart view.", linkLabel: "Open Terminal" },
    ],
  },
  tr: {
    metaTitle: "Premium Club — Tam Erişim | BogaStock",
    metaDescription:
      "BogaStock Premium Club'a ayda 39 USD ile katılın: Trend Hisseler, Top 100, Trade Planları, Tema listeleri, 50 hisselik takip listesi, 9'lu çoklu grafik ekranı ve 7/24 BogaStock Copilot yapay zeka asistanına tam erişim.",
    badge: "PREMIUM CLUB",
    heroTitle: "BogaStock'un tüm gücüyle işlem yapın:",
    heroTitleHighlight: "Premium Club",
    heroSubtitle:
      "Tek üyelik, tam erişim. Ayda 39 USD karşılığında tüm sinyaller, tüm listeler, tüm işlem planları ve hiç uyumayan kişisel bir yapay zeka asistanı.",
    ctaPrimary: "Hemen Başla →",
    ctaSecondary: "Fiyat ve Özellikleri Gör",
    priceNote: "İstediğin zaman iptal et. Gizli ücret yok.",
    breadcrumbHome: "Gösterge Paneli",
    breadcrumbCurrent: "Premium Club",
    copilotBadge: "1 NUMARALI ÜYELİK AVANTAJI",
    copilotTitle: "BogaStock Copilot'a 7/24 erişim — kişiye özel finansal yapay zeka asistanınız",
    copilotDesc:
      "Üyelerin yükseltme yapmasının en büyük tek nedeni budur. BogaStock Copilot, kişiye özel gelişim gösteren, son derece gelişmiş ve sürekli öğrenen bir finansal yapay zeka asistanıdır — sorularınızı yanıtlamak, piyasayı taramak ve platformdaki her listeyi, grafiği ve işlem kurgusunu sizinle birlikte incelemek için 7/24 yanınızdadır.",
    benefitsTitle: "Premium Club ile açılan tüm avantajlar",
    benefits: [
      { title: "Trend Hisseler (Swing)", desc: "Günlük Trend Hisseler listesine sınırsız, tam erişim — diğer üyelerin yalnızca önizlemesini gördüğü swing adayları.", linkLabel: "Trend Hisseleri Aç" },
      { title: "Performans Takibi", desc: "Tüm performans sayfalarına tam erişim — her sinyalin ve seçimin zaman içinde nasıl sonuçlandığını görün.", linkLabel: "Performansı Aç" },
      { title: "Top 100", desc: "Sadece ilk isimler değil, Top 100 sıralı listesinin tamamına tam erişim.", linkLabel: "Top 100'ü Aç" },
      { title: "Trade Planları", desc: "İşlem potansiyeli olan tüm hisselerin Trade Planlarına tam erişim — sizin için hesaplanmış giriş, hedef ve stop seviyeleri.", linkLabel: "Canlı örneği gör" },
      { title: "Trade Setup Rationale", desc: "Her planın arkasındaki işlem kurgusu mantığına (Trade Setup Rationale) tam erişim — EMA, hacim, RSI ve VWAP mantığı sade bir dille anlatılır.", linkLabel: "Canlı örneği gör" },
      { title: "Tema Listeleri", desc: "Yapay zeka, yarı iletkenler, uzay, robotik ve daha fazlasını kapsayan, yüzlerce hissenin kümelere ayrıldığı Tema listelerine tam erişim ve takip.", linkLabel: "Temalara Göz At" },
      { title: "50 Hisselik Kişisel Takip Listesi", desc: "50 hisseye kadar kişiselleştirilmiş bir takip listesi oluşturun ve tek yerden takip edin.", linkLabel: "İzleme Listemi Aç" },
      { title: "9'lu Çoklu Grafik Ekranı", desc: "Çoklu grafik ekranı ile aynı anda 9 hisseyi yan yana, tek ekrandan takip edin.", linkLabel: "Terminali Aç" },
    ],
  },
  es: {
    metaTitle: "Premium Club — Acceso Total | BogaStock",
    metaDescription:
      "Únete a BogaStock Premium Club por $39/mes: acceso total a Acciones en Tendencia, Top 100, Planes de Trading, listas de Temas, una lista de seguimiento de 50 acciones, vista multi-gráfico de 9 acciones y el asistente de IA BogaStock Copilot 24/7.",
    badge: "PREMIUM CLUB",
    heroTitle: "Opera con todo el poder de",
    heroTitleHighlight: "BogaStock Premium Club",
    heroSubtitle:
      "Una membresía, acceso completo. Cada señal, cada lista, cada plan de trading y un asistente de IA personal que nunca duerme — por $39/mes.",
    ctaPrimary: "Comenzar Ahora →",
    ctaSecondary: "Ver Precios y Funciones",
    priceNote: "Cancela cuando quieras. Sin cargos ocultos.",
    breadcrumbHome: "Panel",
    breadcrumbCurrent: "Premium Club",
    copilotBadge: "LA VENTAJA N.º 1 PARA MIEMBROS",
    copilotTitle: "Acceso 24/7 a BogaStock Copilot — tu asistente financiero de IA personal",
    copilotDesc:
      "Esta es la razón número uno por la que los miembros actualizan su cuenta. BogaStock Copilot es un asistente financiero de IA muy avanzado y en aprendizaje continuo que se desarrolla de forma personal contigo — disponible las 24 horas para responder preguntas, escanear el mercado y guiarte por cada lista, gráfico y plan de trading de la plataforma.",
    benefitsTitle: "Todo lo que desbloqueas con Premium Club",
    benefits: [
      { title: "Acciones en Tendencia (Swing)", desc: "Acceso total y sin restricciones a la lista diaria de Acciones en Tendencia — los candidatos swing que otros miembros solo ven en vista previa.", linkLabel: "Abrir Acciones en Tendencia" },
      { title: "Seguimiento de Rendimiento", desc: "Acceso total a todas las páginas de rendimiento — mira exactamente cómo se ha comportado cada señal y selección en el tiempo.", linkLabel: "Abrir Rendimiento" },
      { title: "Top 100", desc: "Acceso total a la lista completa del Top 100, no solo a los primeros nombres.", linkLabel: "Abrir Top 100" },
      { title: "Planes de Trading", desc: "Acceso total a los Planes de Trading de todas las acciones con potencial — entradas, objetivos y niveles de stop calculados por ti.", linkLabel: "Ver un ejemplo real" },
      { title: "Trade Setup Rationale", desc: "Acceso total a la lógica de cada configuración de operación (Trade Setup Rationale) — la lógica de EMA, volumen, RSI y VWAP explicada en lenguaje sencillo.", linkLabel: "Ver un ejemplo real" },
      { title: "Listas de Temas", desc: "Acceso total y seguimiento de cientos de acciones agrupadas en listas de Temas — IA, semiconductores, espacio, robótica y más.", linkLabel: "Explorar Temas" },
      { title: "Lista de Seguimiento Personal de 50 Acciones", desc: "Crea y sigue una lista de seguimiento personalizada de hasta 50 acciones, todo en un solo lugar.", linkLabel: "Abrir Mi Lista" },
      { title: "Vista Multi-Gráfico de 9 Acciones", desc: "Sigue hasta 9 acciones lado a lado en una sola pantalla con la vista multi-gráfico.", linkLabel: "Abrir Terminal" },
    ],
  },
  fr: {
    metaTitle: "Premium Club — Accès Complet | BogaStock",
    metaDescription:
      "Rejoignez BogaStock Premium Club pour 39$/mois : accès complet aux Actions Tendance, au Top 100, aux Plans de Trading, aux listes Thématiques, à une liste de suivi de 50 actions, à la vue multi-graphique de 9 actions et à l'assistant IA BogaStock Copilot 24h/24 et 7j/7.",
    badge: "PREMIUM CLUB",
    heroTitle: "Tradez avec toute la puissance de",
    heroTitleHighlight: "BogaStock Premium Club",
    heroSubtitle:
      "Un abonnement, un accès complet. Chaque signal, chaque liste, chaque plan de trading et un assistant IA personnel qui ne dort jamais — pour 39$/mois.",
    ctaPrimary: "Commencer Maintenant →",
    ctaSecondary: "Voir les Tarifs et Fonctionnalités",
    priceNote: "Annulez à tout moment. Aucun frais caché.",
    breadcrumbHome: "Tableau de Bord",
    breadcrumbCurrent: "Premium Club",
    copilotBadge: "L'AVANTAGE N°1 DES MEMBRES",
    copilotTitle: "Accès 24h/24 et 7j/7 à BogaStock Copilot — votre assistant financier IA personnel",
    copilotDesc:
      "C'est la raison numéro un pour laquelle les membres passent à un abonnement supérieur. BogaStock Copilot est un assistant financier IA très avancé et en apprentissage continu qui évolue personnellement avec vous — disponible 24h/24 pour répondre à vos questions, analyser le marché et vous guider à travers chaque liste, graphique et configuration de trading de la plateforme.",
    benefitsTitle: "Tout ce que Premium Club débloque",
    benefits: [
      { title: "Actions Tendance (Swing)", desc: "Accès total et illimité à la liste quotidienne des Actions Tendance — les candidats swing que les autres membres ne voient qu'en aperçu.", linkLabel: "Ouvrir Actions Tendance" },
      { title: "Suivi de Performance", desc: "Accès total à toutes les pages de performance — voyez exactement comment chaque signal et chaque sélection a évolué dans le temps.", linkLabel: "Ouvrir Performance" },
      { title: "Top 100", desc: "Accès total à la liste complète du Top 100, pas seulement aux premiers noms.", linkLabel: "Ouvrir Top 100" },
      { title: "Plans de Trading", desc: "Accès total aux Plans de Trading de toutes les actions à potentiel — entrées, objectifs et niveaux de stop calculés pour vous.", linkLabel: "Voir un exemple réel" },
      { title: "Trade Setup Rationale", desc: "Accès total à la logique derrière chaque configuration de trading (Trade Setup Rationale) — la logique EMA, volume, RSI et VWAP expliquée simplement.", linkLabel: "Voir un exemple réel" },
      { title: "Listes Thématiques", desc: "Accès total et suivi de centaines d'actions regroupées en listes Thématiques — IA, semi-conducteurs, espace, robotique et plus encore.", linkLabel: "Parcourir les Thèmes" },
      { title: "Liste de Suivi Personnelle de 50 Actions", desc: "Créez et suivez une liste de suivi personnalisée pouvant aller jusqu'à 50 actions, le tout au même endroit.", linkLabel: "Ouvrir Ma Liste" },
      { title: "Écran Multi-Graphique de 9 Actions", desc: "Suivez jusqu'à 9 actions côte à côte sur un seul écran grâce à la vue multi-graphique.", linkLabel: "Ouvrir le Terminal" },
    ],
  },
  pt: {
    metaTitle: "Premium Club — Acesso Total | BogaStock",
    metaDescription:
      "Junte-se ao BogaStock Premium Club por $39/mês: acesso total às Ações em Tendência, Top 100, Planos de Trade, listas de Temas, uma watchlist de 50 ações, visualização multi-gráfico de 9 ações e o assistente de IA BogaStock Copilot 24/7.",
    badge: "PREMIUM CLUB",
    heroTitle: "Opere com todo o poder do",
    heroTitleHighlight: "BogaStock Premium Club",
    heroSubtitle:
      "Uma assinatura, acesso completo. Todo sinal, toda lista, todo plano de trade e um assistente de IA pessoal que nunca dorme — por $39/mês.",
    ctaPrimary: "Começar Agora →",
    ctaSecondary: "Ver Preços e Recursos",
    priceNote: "Cancele quando quiser. Sem taxas ocultas.",
    breadcrumbHome: "Painel",
    breadcrumbCurrent: "Premium Club",
    copilotBadge: "A VANTAGEM Nº 1 DOS MEMBROS",
    copilotTitle: "Acesso 24/7 ao BogaStock Copilot — seu assistente financeiro de IA pessoal",
    copilotDesc:
      "Este é o principal motivo pelo qual os membros fazem upgrade. O BogaStock Copilot é um assistente financeiro de IA altamente avançado e em aprendizado contínuo que se desenvolve de forma pessoal com você — disponível 24 horas por dia para responder perguntas, analisar o mercado e guiá-lo por cada lista, gráfico e configuração de trade da plataforma.",
    benefitsTitle: "Tudo o que o Premium Club libera",
    benefits: [
      { title: "Ações em Tendência (Swing)", desc: "Acesso total e irrestrito à lista diária de Ações em Tendência — os candidatos swing que outros membros veem apenas em prévia.", linkLabel: "Abrir Ações em Tendência" },
      { title: "Acompanhamento de Performance", desc: "Acesso total a todas as páginas de performance — veja exatamente como cada sinal e escolha se comportou ao longo do tempo.", linkLabel: "Abrir Performance" },
      { title: "Top 100", desc: "Acesso total à lista completa do Top 100, não apenas aos primeiros nomes.", linkLabel: "Abrir Top 100" },
      { title: "Planos de Trade", desc: "Acesso total aos Planos de Trade de todas as ações com potencial — entradas, alvos e níveis de stop calculados para você.", linkLabel: "Ver um exemplo real" },
      { title: "Trade Setup Rationale", desc: "Acesso total à lógica por trás de cada configuração de operação (Trade Setup Rationale) — a lógica de EMA, volume, RSI e VWAP explicada de forma simples.", linkLabel: "Ver um exemplo real" },
      { title: "Listas de Temas", desc: "Acesso total e acompanhamento de centenas de ações agrupadas em listas de Temas — IA, semicondutores, espaço, robótica e muito mais.", linkLabel: "Explorar Temas" },
      { title: "Watchlist Pessoal de 50 Ações", desc: "Crie e acompanhe uma watchlist personalizada de até 50 ações, tudo em um só lugar.", linkLabel: "Abrir Minha Lista" },
      { title: "Tela Multi-Gráfico de 9 Ações", desc: "Acompanhe até 9 ações lado a lado em uma única tela com a visualização multi-gráfico.", linkLabel: "Abrir Terminal" },
    ],
  },
  id: {
    metaTitle: "Premium Club — Akses Penuh | BogaStock",
    metaDescription:
      "Bergabunglah dengan BogaStock Premium Club seharga $39/bln: akses penuh ke Saham Tren, Top 100, Rencana Trading, daftar Tema, watchlist 50 saham, tampilan multi-chart 9 saham, dan asisten AI BogaStock Copilot 24/7.",
    badge: "PREMIUM CLUB",
    heroTitle: "Trading dengan kekuatan penuh dari",
    heroTitleHighlight: "BogaStock Premium Club",
    heroSubtitle:
      "Satu keanggotaan, akses penuh. Setiap sinyal, setiap daftar, setiap rencana trading, dan asisten AI pribadi yang tidak pernah tidur — hanya $39/bulan.",
    ctaPrimary: "Mulai Sekarang →",
    ctaSecondary: "Lihat Harga & Fitur",
    priceNote: "Batalkan kapan saja. Tanpa biaya tersembunyi.",
    breadcrumbHome: "Dashboard",
    breadcrumbCurrent: "Premium Club",
    copilotBadge: "KEUNGGULAN #1 UNTUK ANGGOTA",
    copilotTitle: "Akses 24/7 ke BogaStock Copilot — asisten AI finansial pribadi Anda",
    copilotDesc:
      "Ini adalah alasan utama mengapa anggota melakukan upgrade. BogaStock Copilot adalah asisten AI finansial yang sangat canggih dan terus belajar, berkembang secara pribadi mengikuti Anda — tersedia 24 jam untuk menjawab pertanyaan, memindai pasar, dan memandu Anda melalui setiap daftar, grafik, dan rencana trading di platform.",
    benefitsTitle: "Semua yang terbuka dengan Premium Club",
    benefits: [
      { title: "Saham Tren (Swing)", desc: "Akses penuh tanpa batas ke daftar Saham Tren harian — kandidat swing yang hanya bisa dilihat sekilas oleh anggota lain.", linkLabel: "Buka Saham Tren" },
      { title: "Pelacakan Performa", desc: "Akses penuh ke semua halaman performa — lihat persis bagaimana setiap sinyal dan pilihan berkembang seiring waktu.", linkLabel: "Buka Performa" },
      { title: "Top 100", desc: "Akses penuh ke seluruh daftar peringkat Top 100, bukan hanya nama-nama teratas.", linkLabel: "Buka Top 100" },
      { title: "Rencana Trading", desc: "Akses penuh ke Rencana Trading untuk setiap saham berpotensi — entry, target, dan level stop yang sudah dihitung untuk Anda.", linkLabel: "Lihat contoh langsung" },
      { title: "Trade Setup Rationale", desc: "Akses penuh ke logika di balik setiap rencana (Trade Setup Rationale) — logika EMA, volume, RSI, dan VWAP dijelaskan dengan bahasa sederhana.", linkLabel: "Lihat contoh langsung" },
      { title: "Daftar Tema", desc: "Akses penuh dan pelacakan ratusan saham yang dikelompokkan ke dalam daftar Tema — AI, semikonduktor, luar angkasa, robotik, dan lainnya.", linkLabel: "Jelajahi Tema" },
      { title: "Watchlist Pribadi 50 Saham", desc: "Buat dan lacak watchlist personal hingga 50 saham, semuanya dalam satu tempat.", linkLabel: "Buka Watchlist Saya" },
      { title: "Layar Multi-Chart 9 Saham", desc: "Lacak hingga 9 saham berdampingan dalam satu layar dengan tampilan multi-chart.", linkLabel: "Buka Terminal" },
    ],
  },
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!LOCALES.includes(locale as Locale)) return { title: "Not Found" };
  const loc = locale as Locale;
  const c = COPY[loc];

  return {
    title: c.metaTitle,
    description: c.metaDescription,
    alternates: {
      canonical: `https://bogastock.com/global/${loc}/premium_club`,
      languages: {
        en: "https://bogastock.com/global/en/premium_club",
        es: "https://bogastock.com/global/es/premium_club",
        fr: "https://bogastock.com/global/fr/premium_club",
        id: "https://bogastock.com/global/id/premium_club",
        pt: "https://bogastock.com/global/pt/premium_club",
        tr: "https://bogastock.com/global/tr/premium_club",
        "x-default": "https://bogastock.com/global/en/premium_club",
      },
    },
  };
}

export async function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export default async function PremiumClubPage({ params }: Props) {
  const { locale } = await params;
  if (!LOCALES.includes(locale as Locale)) {
    return <div>Invalid locale</div>;
  }
  const loc = locale as Locale;
  const c = COPY[loc];

  const registerHref = loc === "tr" ? "/global/tr/kayit" : `/global/${loc}/register`;
  const themeHref = `/global/${loc}/themes/${HOT_THEMES_2026[0].slug}`;

  // Kart -> gercek rota eslesmesi. Trade Plan / Trade Setup Rationale karti icin
  // /graphic/[ticker] altinda somut bir ornek gosteriyoruz (bkz. NVDA ornegi).
  const benefitHrefs = [
    `/global/${loc}/swing`,
    `/global/${loc}/performance`,
    `/global/${loc}/top100`,
    `/global/${loc}/graphic/NVDA`,
    `/global/${loc}/graphic/NVDA`,
    themeHref,
    `/global/${loc}/my-watchlist`,
    `/global/${loc}/terminal`,
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <MemberHeader locale={loc} />

      <main className="flex-1">
        {/* Breadcrumb */}
        <div className="max-w-6xl mx-auto px-4 pt-4">
          <nav className="flex items-center gap-2 text-[10px] font-medium text-slate-500 uppercase tracking-widest mb-3">
            <Link href={`/global/${loc}/home`} className="hover:text-[#3b82f6] transition-colors">
              {c.breadcrumbHome}
            </Link>
            <span className="opacity-30">/</span>
            <span className="text-white italic">{c.breadcrumbCurrent}</span>
          </nav>
        </div>

        {/* Hero */}
        <section className="max-w-5xl mx-auto px-4 pt-6 pb-14 text-center">
          <div className="inline-flex items-center gap-2 bg-[#fbbf24]/10 border border-[#fbbf24]/30 rounded-full px-4 py-1.5 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-[#fbbf24] animate-pulse" />
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#fbbf24]">{c.badge}</span>
          </div>

          <h1 className="text-3xl md:text-5xl font-medium text-white tracking-tight mb-5 leading-tight">
            {c.heroTitle} <span className="text-[#3b82f6]">{c.heroTitleHighlight}</span>
          </h1>

          <p className="text-base md:text-lg text-white/60 max-w-2xl mx-auto leading-relaxed mb-8">{c.heroSubtitle}</p>

          <div className="flex flex-wrap items-center justify-center gap-4 mb-4">
            <PremiumClubCTA
              locale={loc}
              className="px-8 py-4 bg-[#3b82f6] text-white rounded-2xl font-medium uppercase tracking-[0.15em] text-sm hover:bg-[#2563eb] hover:shadow-[0_0_40px_rgba(59,130,246,0.4)] transition-all active:scale-[0.98]"
            >
              {c.ctaPrimary}
            </PremiumClubCTA>
            <a
              href="#pricing"
              className="px-8 py-4 bg-white/5 border border-white/10 text-white rounded-2xl font-medium uppercase tracking-[0.15em] text-sm hover:bg-white/10 transition-all"
            >
              {c.ctaSecondary}
            </a>
          </div>
          <p className="text-xs text-white/30">{c.priceNote}</p>
        </section>

        {/* Copilot spotlight — biggest advantage */}
        <section className="max-w-5xl mx-auto px-4 pb-14">
          <div className="bg-gradient-to-br from-[#161f30] to-[#0d1117] border border-[#8b5cf6]/30 rounded-3xl p-8 md:p-12 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#3b82f6] via-[#8b5cf6] to-[#fbbf24]" />
            <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
              <div className="w-14 h-14 rounded-2xl bg-[#8b5cf6]/10 border border-[#8b5cf6]/30 flex items-center justify-center flex-shrink-0">
                <svg className="w-7 h-7 text-[#8b5cf6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a4 4 0 115.657 0M9 21h6a1 1 0 001-1v-1H8v1a1 1 0 001 1z"
                  />
                </svg>
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#8b5cf6] mb-2">{c.copilotBadge}</div>
                <h2 className="text-xl md:text-2xl font-medium text-white mb-3">{c.copilotTitle}</h2>
                <p className="text-sm md:text-base text-white/60 leading-relaxed">{c.copilotDesc}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Benefits grid */}
        <section className="max-w-6xl mx-auto px-4 pb-16">
          <h2 className="text-2xl md:text-3xl font-medium text-white text-center mb-10">{c.benefitsTitle}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {c.benefits.map((b, idx) => (
              <div
                key={b.title}
                className="bg-[#0d1117] border border-[#1e2a3a] rounded-2xl p-5 hover:border-[#3b82f6]/40 transition-colors flex flex-col"
              >
                <h3 className="text-sm font-semibold text-white mb-2">{b.title}</h3>
                <p className="text-xs text-white/50 leading-relaxed mb-3 flex-1">{b.desc}</p>
                <Link href={benefitHrefs[idx]} className="text-xs font-medium text-[#3b82f6] hover:text-white transition-colors">
                  {b.linkLabel} →
                </Link>
              </div>
            ))}
          </div>
        </section>

        {/* Pricing (shared component — same $9 first month / $39/mo pricing used sitewide) */}
        <PricingSection locale={loc} ctaHref={registerHref} />
      </main>

      <Footer hidePlatform={true} locale={loc} />
    </div>
  );
}
