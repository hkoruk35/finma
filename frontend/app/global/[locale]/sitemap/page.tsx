import { Metadata } from "next";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";
import Link from "next/link";

type Locale = "en" | "tr" | "es" | "fr" | "pt" | "id";

export const metadata: Metadata = {
  title: "Sitemap",
};

const LOCALE_ROUTES: Record<Locale, { login: string; register: string; account: string; faq: string }> = {
  en: { login: "login", register: "register", account: "account", faq: "faq" },
  tr: { login: "giris", register: "kayit", account: "hesabim", faq: "sss" },
  es: { login: "login", register: "register", account: "account", faq: "faq" },
  fr: { login: "login", register: "register", account: "account", faq: "faq" },
  pt: { login: "login", register: "register", account: "account", faq: "Perguntas_Frequentes" },
  id: { login: "login", register: "register", account: "account", faq: "faq" },
};

const SITEMAP_TITLES: Record<Locale, string> = {
  en: "Site Map",
  tr: "Site Haritası",
  es: "Mapa del Sitio",
  fr: "Plan du Site",
  pt: "Mapa do Site",
  id: "Peta Situs",
};

const SECTION_LABELS: Record<Locale, Record<string, string>> = {
  en: {
    main: "Main Pages",
    markets: "Markets & Analysis",
    trackers: "Rankings & Trackers",
    extras: "More",
    account: "Account",
    legal: "Company & Legal",
  },
  tr: {
    main: "Ana Sayfalar",
    markets: "Piyasa & Analiz",
    trackers: "Sıralamalar & Takip",
    extras: "Diğer",
    account: "Hesap",
    legal: "Şirket & Yasal",
  },
  es: {
    main: "Páginas Principales",
    markets: "Mercados y Análisis",
    trackers: "Rankings y Seguimiento",
    extras: "Más",
    account: "Cuenta",
    legal: "Empresa y Legal",
  },
  fr: {
    main: "Pages Principales",
    markets: "Marchés et Analyse",
    trackers: "Classements et Suivi",
    extras: "Plus",
    account: "Compte",
    legal: "Entreprise et Légal",
  },
  pt: {
    main: "Páginas Principais",
    markets: "Mercados e Análise",
    trackers: "Rankings e Rastreamento",
    extras: "Mais",
    account: "Conta",
    legal: "Empresa e Legal",
  },
  id: {
    main: "Halaman Utama",
    markets: "Pasar & Analisis",
    trackers: "Peringkat & Pelacak",
    extras: "Lainnya",
    account: "Akun",
    legal: "Perusahaan & Legal",
  },
};

const LINK_LABELS: Record<Locale, Record<string, string>> = {
  en: {
    home: "Home / Dashboard",
    terminal: "Copilot Terminal",
    search: "Search",
    discover: "Discover",
    today: "Today in Market",
    newsroom: "Newsroom",
    markets: "Global Markets",
    analysisHub: "Analysis Hub",
    earningCalendar: "Earnings Calendar",
    insider: "Insider Transactions",
    themes: "Stock Themes",
    sectors: "Sector Heat Map",
    brokers: "Broker Directory",
    top100: "Top 100",
    top7: "Top 7",
    swing: "Swing Tracker",
    swingPerformance: "Swing Performance",
    gainers: "Top Gainers",
    losers: "Top Losers",
    mostActive: "Most Active",
    watchlist: "Watchlist",
    myWatchlist: "My Watchlist",
    sports: "Sports",
    weather: "Weather",
    login: "Sign In",
    register: "Sign Up",
    account: "My Account",
    about: "About Us",
    future: "Our Future / Vision",
    faq: "FAQ",
    contact: "Contact",
    terms: "Terms of Service",
    privacy: "Privacy Policy",
    disclaimer: "Disclaimer",
  },
  tr: {
    home: "Ana Sayfa / Panel",
    terminal: "Copilot Terminal",
    search: "Arama",
    discover: "Keşfet",
    today: "Bugün Piyasada",
    newsroom: "Haber Odası",
    markets: "Küresel Piyasalar",
    analysisHub: "Analiz Merkezi",
    earningCalendar: "Kazanç Takvimi",
    insider: "İçeriden Öğrenenler İşlemleri",
    themes: "Hisse Temaları",
    sectors: "Sektör Isı Haritası",
    brokers: "Aracı Kurum Rehberi",
    top100: "Top 100",
    top7: "Top 7",
    swing: "Swing Tracker",
    swingPerformance: "Swing Performansı",
    gainers: "En Çok Yükselenler",
    losers: "En Çok Düşenler",
    mostActive: "En Çok İşlem Görenler",
    watchlist: "İzleme Listesi",
    myWatchlist: "İzleme Listem",
    sports: "Spor",
    weather: "Hava Durumu",
    login: "Giriş Yap",
    register: "Üye Ol",
    account: "Hesabım",
    about: "Hakkımızda",
    future: "Geleceğimiz / Vizyonumuz",
    faq: "Sıkça Sorulan Sorular",
    contact: "İletişim",
    terms: "Kullanım Koşulları",
    privacy: "Gizlilik Politikası",
    disclaimer: "Sorumluluk Reddi",
  },
  es: {
    home: "Inicio / Panel",
    terminal: "Copilot Terminal",
    search: "Buscar",
    discover: "Descubrir",
    today: "Hoy en el Mercado",
    newsroom: "Sala de Noticias",
    markets: "Mercados Globales",
    analysisHub: "Centro de Análisis",
    earningCalendar: "Calendario de Resultados",
    insider: "Transacciones de Insiders",
    themes: "Temas de Acciones",
    sectors: "Mapa de Calor de Sectores",
    brokers: "Directorio de Brokers",
    top100: "Top 100",
    top7: "Top 7",
    swing: "Swing Tracker",
    swingPerformance: "Rendimiento Swing",
    gainers: "Mayores Alzas",
    losers: "Mayores Bajas",
    mostActive: "Más Activas",
    watchlist: "Lista de Seguimiento",
    myWatchlist: "Mi Lista de Seguimiento",
    sports: "Deportes",
    weather: "Clima",
    login: "Iniciar Sesión",
    register: "Registrarse",
    account: "Mi Cuenta",
    about: "Sobre Nosotros",
    future: "Nuestro Futuro / Visión",
    faq: "Preguntas Frecuentes",
    contact: "Contacto",
    terms: "Términos de Servicio",
    privacy: "Política de Privacidad",
    disclaimer: "Aviso Legal",
  },
  fr: {
    home: "Accueil / Tableau de Bord",
    terminal: "Copilot Terminal",
    search: "Recherche",
    discover: "Découvrir",
    today: "Aujourd'hui sur le Marché",
    newsroom: "Salle de Presse",
    markets: "Marchés Mondiaux",
    analysisHub: "Centre d'Analyse",
    earningCalendar: "Calendrier des Résultats",
    insider: "Transactions des Initiés",
    themes: "Thèmes Boursiers",
    sectors: "Carte Thermique des Secteurs",
    brokers: "Annuaire des Courtiers",
    top100: "Top 100",
    top7: "Top 7",
    swing: "Swing Tracker",
    swingPerformance: "Performance Swing",
    gainers: "Plus Fortes Hausses",
    losers: "Plus Fortes Baisses",
    mostActive: "Plus Actives",
    watchlist: "Liste de Suivi",
    myWatchlist: "Ma Liste de Suivi",
    sports: "Sports",
    weather: "Météo",
    login: "Connexion",
    register: "Inscription",
    account: "Mon Compte",
    about: "À Propos",
    future: "Notre Avenir / Vision",
    faq: "FAQ",
    contact: "Contact",
    terms: "Conditions d'Utilisation",
    privacy: "Politique de Confidentialité",
    disclaimer: "Avertissement",
  },
  pt: {
    home: "Início / Painel",
    terminal: "Copilot Terminal",
    search: "Pesquisar",
    discover: "Descobrir",
    today: "Hoje no Mercado",
    newsroom: "Sala de Imprensa",
    markets: "Mercados Globais",
    analysisHub: "Central de Análise",
    earningCalendar: "Calendário de Resultados",
    insider: "Transações de Insiders",
    themes: "Temas de Ações",
    sectors: "Mapa de Calor de Setores",
    brokers: "Diretório de Corretoras",
    top100: "Top 100",
    top7: "Top 7",
    swing: "Swing Tracker",
    swingPerformance: "Desempenho Swing",
    gainers: "Maiores Altas",
    losers: "Maiores Baixas",
    mostActive: "Mais Negociadas",
    watchlist: "Lista de Observação",
    myWatchlist: "Minha Lista de Observação",
    sports: "Esportes",
    weather: "Clima",
    login: "Entrar",
    register: "Cadastrar-se",
    account: "Minha Conta",
    about: "Sobre Nós",
    future: "Nosso Futuro / Visão",
    faq: "Perguntas Frequentes",
    contact: "Contato",
    terms: "Termos de Serviço",
    privacy: "Política de Privacidade",
    disclaimer: "Aviso Legal",
  },
  id: {
    home: "Beranda / Dasbor",
    terminal: "Copilot Terminal",
    search: "Pencarian",
    discover: "Jelajahi",
    today: "Hari Ini di Pasar",
    newsroom: "Ruang Berita",
    markets: "Pasar Global",
    analysisHub: "Pusat Analisis",
    earningCalendar: "Kalender Laba",
    insider: "Transaksi Insider",
    themes: "Tema Saham",
    sectors: "Peta Panas Sektor",
    brokers: "Direktori Broker",
    top100: "Top 100",
    top7: "Top 7",
    swing: "Swing Tracker",
    swingPerformance: "Performa Swing",
    gainers: "Penguat Teratas",
    losers: "Pelemah Teratas",
    mostActive: "Paling Aktif",
    watchlist: "Daftar Pantauan",
    myWatchlist: "Daftar Pantauan Saya",
    sports: "Olahraga",
    weather: "Cuaca",
    login: "Masuk",
    register: "Daftar",
    account: "Akun Saya",
    about: "Tentang Kami",
    future: "Masa Depan / Visi Kami",
    faq: "FAQ",
    contact: "Kontak",
    terms: "Ketentuan Layanan",
    privacy: "Kebijakan Privasi",
    disclaimer: "Sangkalan",
  },
};

export default async function SitemapPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const t = SITEMAP_TITLES[locale] || SITEMAP_TITLES.en;
  const sec = SECTION_LABELS[locale] || SECTION_LABELS.en;
  const l = LINK_LABELS[locale] || LINK_LABELS.en;
  const r = LOCALE_ROUTES[locale] || LOCALE_ROUTES.en;
  const base = `/global/${locale}`;

  const routes = [
    {
      category: sec.main,
      links: [
        { href: `${base}/home`, label: l.home },
        { href: `${base}/terminal`, label: l.terminal },
        { href: `${base}/search`, label: l.search },
        { href: `${base}/discover`, label: l.discover },
        { href: `${base}/today`, label: l.today },
        { href: `${base}/newsroom`, label: l.newsroom },
      ],
    },
    {
      category: sec.markets,
      links: [
        { href: `${base}/markets`, label: l.markets },
        { href: `${base}/analysis-hub`, label: l.analysisHub },
        { href: `${base}/earning-calendar`, label: l.earningCalendar },
        { href: `${base}/insider`, label: l.insider },
        { href: `${base}/themes`, label: l.themes },
        { href: `${base}/sectors`, label: l.sectors },
        { href: `${base}/brokers`, label: l.brokers },
      ],
    },
    {
      category: sec.trackers,
      links: [
        { href: `${base}/top100`, label: l.top100 },
        { href: `${base}/top7`, label: l.top7 },
        { href: `${base}/swing`, label: l.swing },
        { href: `${base}/swingperformance`, label: l.swingPerformance },
        { href: `${base}/gainers`, label: l.gainers },
        { href: `${base}/losers`, label: l.losers },
        { href: `${base}/mostactive`, label: l.mostActive },
        { href: `${base}/watchlist`, label: l.watchlist },
        { href: `${base}/my-watchlist`, label: l.myWatchlist },
      ],
    },
    {
      category: sec.account,
      links: [
        { href: `${base}/${r.login}`, label: l.login },
        { href: `${base}/${r.register}`, label: l.register },
        { href: `${base}/${r.account}`, label: l.account },
      ],
    },
    {
      category: sec.legal,
      links: [
        { href: `${base}/about`, label: l.about },
        { href: `${base}/future`, label: l.future },
        { href: `${base}/${r.faq}`, label: l.faq },
        { href: `${base}/contact`, label: l.contact },
        { href: `${base}/terms`, label: l.terms },
        { href: `${base}/privacy`, label: l.privacy },
        { href: `${base}/disclaimer`, label: l.disclaimer },
      ],
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17] font-manrope">
      <MemberHeader locale={locale} />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-12 md:py-20">
        <h1 className="text-3xl md:text-5xl font-black text-white mb-12 tracking-tight border-b border-[#1e2a3a] pb-6">
          {t}
        </h1>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
          {routes.map((section, i) => (
            <div key={i} className="flex flex-col">
              <h2 className="text-xl font-bold text-[#3b82f6] mb-4">{section.category}</h2>
              <ul className="space-y-3">
                {section.links.map((link, j) => (
                  <li key={j}>
                    <Link
                      href={link.href}
                      className="text-[#94a3b8] hover:text-white transition-colors text-sm md:text-base"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </main>

      <Footer locale={locale} />
    </div>
  );
}
